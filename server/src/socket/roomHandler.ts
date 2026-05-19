import { Server, Socket } from 'socket.io';
import { getRoomState, setRoomState, deleteRoomState, updateRoomState } from '../db/roomState';
import { supabase } from '../db/supabase';
import { RoomState, PlayerState } from '../types/game';
import logger from '../utils/logger';
import { startGame, advanceCategory, broadcastRoomState, advanceVoting } from './gameMachine';

// Helper to generate a 6-character room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate a unique room code that does not exist in Redis
async function generateUniqueRoomCode(): Promise<string> {
  let code = '';
  let isUnique = false;
  let attempts = 0;
  
  while (!isUnique && attempts < 10) {
    code = generateRoomCode();
    const state = await getRoomState(code);
    if (!state) {
      isUnique = true;
    }
    attempts++;
  }
  return code;
}

const graceTimers: Record<string, Record<string, NodeJS.Timeout>> = {};

function clearGraceTimer(roomCode: string, userId: string) {
  const code = roomCode.toUpperCase();
  if (graceTimers[code] && graceTimers[code][userId]) {
    clearTimeout(graceTimers[code][userId]);
    delete graceTimers[code][userId];
  }
}

export function registerRoomHandlers(io: Server, socket: Socket) {
  const userId = socket.data.userId;

  if (!userId) {
    logger.error('Socket registered room handlers without userId in socket.data');
    return;
  }

  // 1. CREATE ROOM
  socket.on('create_room', async (arg1: any, arg2: any) => {
    const callback = typeof arg1 === 'function' ? arg1 : arg2;
    const payload = typeof arg1 === 'object' ? arg1 : {};

    try {
      // Fetch user profile from Supabase
      let profile: { username: string; avatar_url?: string } | null = null;
      if (userId.startsWith('benchmark_') || userId.startsWith('test_')) {
        profile = { username: userId, avatar_url: '' };
      } else {
        const { data, error: profileError } = await supabase
          .from('users')
          .select('username, avatar_url')
          .eq('clerk_id', userId)
          .single();

        if (profileError || !data) {
          logger.error(`Failed to fetch user profile for room creation: ${userId}`, profileError);
          return callback({ error: 'Profile not found. Please complete onboarding first.' });
        }
        profile = data;
      }

      // Fetch default game settings from Supabase
      const { data: dbSettings, error: settingsError } = await supabase
        .from('game_settings')
        .select('key, value');

      const settings: Record<string, any> = {};
      if (dbSettings) {
        dbSettings.forEach((s: any) => {
          let val = s.value;
          if (typeof val === 'string') {
            try {
              val = JSON.parse(val);
            } catch (e) {}
          }
          settings[s.key] = val;
        });
      }

      if (settingsError) {
        logger.warn('Failed to fetch default game settings, using defaults', settingsError);
      }

      const roomCode = await generateUniqueRoomCode();

      const newRoom: RoomState = {
        roomCode,
        hostId: userId,
        status: 'WAITING',
        currentRound: 0,
        totalRounds: payload?.totalRounds || Number(settings['total_rounds']) || 5,
        currentCategoryIndex: 0,
        categories: settings['categories'] || ['Όνομα', 'Ζώο', 'Πράγμα', 'Χώρα/Πόλη', 'Επάγγελμα'],
        letter: '',
        timerStartedAt: 0,
        scoring: {
          solo: Number(settings['scoring_solo']) || 20,
          unique: Number(settings['scoring_unique']) || 10,
          shared: Number(settings['scoring_shared']) || 5,
        },
        timePerCategory: payload?.timePerCategory || Number(settings['time_per_category']) || 60,
        votingTimeLimit: Number(settings['voting_window_seconds']) || 30,
        players: {
          [userId]: {
            username: profile.username,
            avatarUrl: profile.avatar_url || '',
            score: 0,
            connected: true,
            backgrounded: false,
            backgroundCount: 0,
            isReady: true, // Host is ready by default
          },
        },
        answers: {},
      };

      await setRoomState(roomCode, newRoom);
      
      socket.join(`room:${roomCode}`);
      socket.data.roomCode = roomCode;

      logger.info(`Room created: ${roomCode} by host: ${userId}`);
      
      callback({ roomState: newRoom });
      broadcastRoomState(io, newRoom);
    } catch (err: any) {
      logger.error('Error in create_room handler:', err);
      callback({ error: 'Internal server error during room creation' });
    }
  });

  // 2. JOIN ROOM
  socket.on('join_room', async ({ roomCode }, callback) => {
    if (!roomCode || typeof roomCode !== 'string') {
      return callback({ error: 'Invalid room code' });
    }

    const uppercaseCode = roomCode.toUpperCase();

    try {
      const state = await getRoomState(uppercaseCode);
      if (!state) {
        return callback({ error: 'Room not found' });
      }

      const isReconnecting = state.players[userId] !== undefined;

      if (state.status !== 'WAITING' && !isReconnecting) {
        return callback({ error: 'Game is already in progress' });
      }

      // Fetch player profile from Supabase if not reconnecting
      let profile = null;
      if (!isReconnecting) {
        if (userId.startsWith('benchmark_') || userId.startsWith('test_')) {
          profile = { username: userId, avatar_url: '' };
        } else {
          const { data, error: profileError } = await supabase
            .from('users')
            .select('username, avatar_url')
            .eq('clerk_id', userId)
            .single();

          if (profileError || !data) {
            logger.error(`Failed to fetch user profile for room join: ${userId}`, profileError);
            return callback({ error: 'Profile not found. Please complete onboarding first.' });
          }
          profile = data;
        }
      }

      // Add or reconnect player to the room state
      const updatedState = await updateRoomState(uppercaseCode, (currentState) => {
        if (isReconnecting) {
          currentState.players[userId].connected = true;
          // Clear grace timer
          clearGraceTimer(uppercaseCode, userId);
        } else if (profile) {
          currentState.players[userId] = {
            username: profile.username,
            avatarUrl: profile.avatar_url || '',
            score: 0,
            connected: true,
            backgrounded: false,
            backgroundCount: 0,
            isReady: false, // joins as not ready
          };
        }
        return currentState;
      });

      socket.join(`room:${uppercaseCode}`);
      socket.data.roomCode = uppercaseCode;

      logger.info(`Player: ${userId} ${isReconnecting ? 'reconnected to' : 'joined'} Room: ${uppercaseCode}`);

      callback({ roomState: updatedState });
      broadcastRoomState(io, updatedState);
    } catch (err: any) {
      logger.error(`Error in join_room handler for room ${roomCode}:`, err);
      callback({ error: 'Internal server error while joining room' });
    }
  });

  // 3. TOGGLE READY STATE
  socket.on('toggle_ready', async (callback) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) {
      return callback({ error: 'You are not currently in a room' });
    }

    try {
      const updatedState = await updateRoomState(roomCode, (currentState) => {
        if (currentState.players[userId]) {
          currentState.players[userId].isReady = !currentState.players[userId].isReady;
        }
        return currentState;
      });

      logger.info(`Player: ${userId} toggled ready in Room: ${roomCode}`);
      
      if (callback) callback({ roomState: updatedState });
      broadcastRoomState(io, updatedState);
    } catch (err: any) {
      logger.error('Error toggling ready state:', err);
      if (callback) callback({ error: 'Failed to update ready state' });
    }
  });

  // 4. LEAVE ROOM / DISCONNECT
  const handleLeaveRoom = async () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    try {
      const state = await getRoomState(roomCode);
      if (!state) return;

      const updatedState = await updateRoomState(roomCode, (currentState) => {
        // Remove user from players
        delete currentState.players[userId];
        
        const remainingPlayerIds = Object.keys(currentState.players);
        
        if (remainingPlayerIds.length === 0) {
          // No players left, we will delete the room
          return currentState;
        }

        // If the host left, promote the next player to host
        if (currentState.hostId === userId) {
          currentState.hostId = remainingPlayerIds[0];
          // Ensure new host is marked ready
          if (currentState.players[currentState.hostId]) {
            currentState.players[currentState.hostId].isReady = true;
          }
        }
        
        return currentState;
      });

      socket.leave(`room:${roomCode}`);
      delete socket.data.roomCode;

      const remainingPlayers = Object.keys(updatedState.players);
      if (remainingPlayers.length === 0) {
        await deleteRoomState(roomCode);
        logger.info(`Room: ${roomCode} deleted as all players left`);
      } else {
        logger.info(`Player: ${userId} left Room: ${roomCode}. New host is ${updatedState.hostId}`);
        broadcastRoomState(io, updatedState);
      }
    } catch (err: any) {
      logger.error(`Error handling leave room for ${userId} in ${roomCode}:`, err);
    }
  };

  // 5. START GAME
  socket.on('start_game', async (callback) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) {
      return callback({ error: 'You are not currently in a room' });
    }

    try {
      const state = await getRoomState(roomCode);
      if (!state) {
        return callback({ error: 'Room not found' });
      }

      if (state.hostId !== userId) {
        return callback({ error: 'Only the host can start the game' });
      }

      if (state.status !== 'WAITING') {
        return callback({ error: 'Game is already in progress' });
      }

      await startGame(io, roomCode);
      callback({ success: true });
    } catch (err: any) {
      logger.error(`Error in start_game handler for room ${roomCode}:`, err);
      callback({ error: 'Failed to start game' });
    }
  });

  // 6. SUBMIT ANSWER
  socket.on('submit_answer', async ({ answer }, callback) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) {
      return callback({ error: 'You are not currently in a room' });
    }

    try {
      const state = await getRoomState(roomCode);
      if (!state) {
        return callback({ error: 'Room not found' });
      }

      if (state.status !== 'ROUND_ACTIVE') {
        return callback({ error: 'Round is not active' });
      }

      const catIndex = state.currentCategoryIndex;

      const updatedState = await updateRoomState(roomCode, (currentState) => {
        currentState.answers[catIndex] = currentState.answers[catIndex] || {};
        currentState.answers[catIndex][userId] = {
          raw: answer || '',
          normalized: (answer || '').trim().toUpperCase(),
          submittedAt: Date.now(),
        };
        return currentState;
      });

      callback({ success: true });

      const connectedPlayers = Object.keys(updatedState.players).filter(
        (pId) => updatedState.players[pId].connected
      );
      const submittedPlayers = Object.keys(updatedState.answers[catIndex] || {});
      const allSubmitted = connectedPlayers.every((pId) => submittedPlayers.includes(pId));

      if (allSubmitted) {
        await advanceCategory(io, roomCode, catIndex);
      } else {
        broadcastRoomState(io, updatedState);
      }
    } catch (err: any) {
      logger.error(`Error in submit_answer handler for room ${roomCode}:`, err);
      callback({ error: 'Failed to submit answer' });
    }
  });

  const handleDisconnect = async () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    try {
      const state = await getRoomState(roomCode);
      if (!state) return;

      if (state.status === 'WAITING') {
        // Lobby disconnect: leave immediately
        await handleLeaveRoom();
        return;
      }

      // Active game disconnect: apply 15s grace period
      const updatedState = await updateRoomState(roomCode, (currentState) => {
        if (currentState.players[userId]) {
          currentState.players[userId].connected = false;
        }
        return currentState;
      });

      broadcastRoomState(io, updatedState);
      logger.info(`Player: ${userId} disconnected from Room: ${roomCode}. Starting 15s grace period.`);

      graceTimers[roomCode] = graceTimers[roomCode] || {};
      clearGraceTimer(roomCode, userId);

      const graceDelay = process.env.NODE_ENV === 'test' ? 50 : 15000;

      graceTimers[roomCode][userId] = setTimeout(async () => {
        try {
          const currentState = await getRoomState(roomCode);
          if (!currentState) return;

          if (currentState.players[userId] && !currentState.players[userId].connected) {
            logger.info(`Grace period expired for player: ${userId} in Room: ${roomCode}. Removing player.`);
            
            // Clean up timers
            clearGraceTimer(roomCode, userId);
            
            // Call standard leave room function to clean up
            const leavingState = await updateRoomState(roomCode, (curr) => {
              delete curr.players[userId];
              const remainingIds = Object.keys(curr.players);
              if (remainingIds.length > 0 && curr.hostId === userId) {
                curr.hostId = remainingIds[0];
                if (curr.players[curr.hostId]) {
                  curr.players[curr.hostId].isReady = true;
                }
              }
              return curr;
            });

            socket.leave(`room:${roomCode}`);
            delete socket.data.roomCode;

            const remaining = Object.keys(leavingState.players);
            if (remaining.length === 0) {
              await deleteRoomState(roomCode);
              logger.info(`Room: ${roomCode} deleted as all players left after grace period`);
            } else {
              broadcastRoomState(io, leavingState);
            }
          }
        } catch (err) {
          logger.error(`Error in grace timer execution for player ${userId} in ${roomCode}:`, err);
        }
      }, graceDelay);
    } catch (err) {
      logger.error(`Error in handleDisconnect for player ${userId} in ${roomCode}:`, err);
    }
  };

  // 7. PLAYER BACKGROUNDED
  socket.on('player_backgrounded', async () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    try {
      const updatedState = await updateRoomState(roomCode, (currentState) => {
        if (currentState.players[userId]) {
          currentState.players[userId].backgrounded = true;
          currentState.players[userId].backgroundCount = (currentState.players[userId].backgroundCount || 0) + 1;
        }
        return currentState;
      });

      logger.info(`Player: ${userId} backgrounded in Room: ${roomCode}. Count: ${updatedState.players[userId]?.backgroundCount}`);
      broadcastRoomState(io, updatedState);
    } catch (err) {
      logger.error(`Error handling player_backgrounded for ${userId} in ${roomCode}:`, err);
    }
  });

  // 8. PLAYER FOREGROUNDED
  socket.on('player_foregrounded', async () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    try {
      const updatedState = await updateRoomState(roomCode, (currentState) => {
        if (currentState.players[userId]) {
          currentState.players[userId].backgrounded = false;
        }
        return currentState;
      });

      logger.info(`Player: ${userId} foregrounded in Room: ${roomCode}`);
      broadcastRoomState(io, updatedState);
    } catch (err) {
      logger.error(`Error handling player_foregrounded for ${userId} in ${roomCode}:`, err);
    }
  });

  // 9. CAST VOTE
  socket.on('cast_vote', async ({ categoryIndex, targetUserId, vote }, callback) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) {
      return callback({ error: 'You are not currently in a room' });
    }

    try {
      const state = await getRoomState(roomCode);
      if (!state) {
        return callback({ error: 'Room not found' });
      }

      if (state.status !== 'VOTING') {
        return callback({ error: 'Voting is not active' });
      }

      const updatedState = await updateRoomState(roomCode, (currentState) => {
        const catAnswers = currentState.answers[categoryIndex];
        if (catAnswers && catAnswers[targetUserId]) {
          catAnswers[targetUserId].votes = catAnswers[targetUserId].votes || {};
          catAnswers[targetUserId].votes[userId] = !!vote;
        }
        return currentState;
      });

      if (callback) callback({ success: true });

      const connectedPlayers = Object.keys(updatedState.players).filter(
        (pId) => updatedState.players[pId].connected
      );
      const answers = updatedState.answers[categoryIndex] || {};
      
      const allVoted = Object.keys(answers).every((targetId) => {
        const votes = answers[targetId].votes || {};
        const voters = Object.keys(votes);
        const expectedVoters = connectedPlayers.filter((pId) => pId !== targetId);
        return expectedVoters.every((pId) => voters.includes(pId));
      });

      if (allVoted) {
        await advanceVoting(io, roomCode, categoryIndex);
      } else {
        broadcastRoomState(io, updatedState);
      }
    } catch (err: any) {
      logger.error(`Error casting vote in room ${roomCode}:`, err);
      if (callback) callback({ error: 'Failed to submit vote' });
    }
  });

  // 10. NEXT ROUND
  socket.on('next_round', async (callback) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    try {
      const state = await getRoomState(roomCode);
      if (!state || state.hostId !== userId) {
        return callback({ error: 'Only the host can start the next round' });
      }

      if (state.currentRound >= state.totalRounds) {
        return callback({ error: 'Game is already over' });
      }

      // Start the next round
      await startGame(io, roomCode, state.currentRound + 1);

      if (callback) callback({ success: true });
    } catch (err: any) {
      logger.error(`Error starting next round in room ${roomCode}:`, err);
      if (callback) callback({ error: 'Failed to start next round' });
    }
  });

  // 11. RESET ROOM (BACK TO LOBBY)
  socket.on('reset_room', async (callback) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    try {
      const state = await getRoomState(roomCode);
      if (!state || state.hostId !== userId) {
        return callback({ error: 'Only the host can reset the room' });
      }

      const updatedState = await updateRoomState(roomCode, (currentState) => {
        currentState.status = 'WAITING';
        currentState.currentRound = 0;
        currentState.currentCategoryIndex = 0;
        currentState.letter = '';
        currentState.answers = {};
        for (const pId in currentState.players) {
          currentState.players[pId].score = 0;
          currentState.players[pId].isReady = (pId === currentState.hostId); // host is ready, others are not
        }
        return currentState;
      });

      if (callback) callback({ success: true });
      broadcastRoomState(io, updatedState);
    } catch (err: any) {
      logger.error(`Error resetting room ${roomCode}:`, err);
      if (callback) callback({ error: 'Failed to reset room' });
    }
  });

  socket.on('leave_room', async (callback) => {
    // Clear any active grace timer if voluntarily leaving
    const roomCode = socket.data.roomCode;
    if (roomCode) {
      clearGraceTimer(roomCode, userId);
    }
    await handleLeaveRoom();
    if (callback) callback({ success: true });
  });

  socket.on('disconnect', async () => {
    await handleDisconnect();
  });
}
