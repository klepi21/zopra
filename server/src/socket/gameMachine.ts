import { Server } from 'socket.io';
import { RoomState } from '../types/game';
import { getRoomState, setRoomState, updateRoomState } from '../db/roomState';
import logger from '../utils/logger';
import { validateAnswer } from '../utils/aiValidator';
import { supabase } from '../db/supabase';


const activeTimers: Record<string, NodeJS.Timeout> = {};

const GREEK_ALPHABET = [
  'Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ', 'Λ', 'Μ', 
  'Ν', 'Ξ', 'Ο', 'Π', 'Ρ', 'Σ', 'Τ', 'Υ', 'Φ', 'Χ', 'Ψ', 'Ω'
];

export function getRandomLetter(): string {
  return GREEK_ALPHABET[Math.floor(Math.random() * GREEK_ALPHABET.length)];
}

// Helper to mask answers in RoomState to prevent cheating
export function maskRoomState(state: RoomState, userId: string): RoomState {
  if (state.status !== 'ROUND_ACTIVE') {
    return state;
  }

  const maskedState = JSON.parse(JSON.stringify(state)) as RoomState;
  
  if (maskedState.answers) {
    for (const categoryIndex in maskedState.answers) {
      const categoryAnswers = maskedState.answers[categoryIndex];
      for (const pId in categoryAnswers) {
        if (pId !== userId) {
          // Replace other users' answer contents with a indicator
          categoryAnswers[pId] = {
            raw: 'SUBMITTED',
            normalized: 'SUBMITTED',
            submittedAt: categoryAnswers[pId].submittedAt
          };
        }
      }
    }
  }
  
  return maskedState;
}

export function broadcastRoomState(io: Server, state: RoomState) {
  const roomCode = state.roomCode.toUpperCase();
  const sockets = io.sockets.adapter.rooms.get(`room:${roomCode}`);
  if (!sockets) return;

  for (const socketId of sockets) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.data.userId) {
      const masked = maskRoomState(state, socket.data.userId);
      socket.emit('room_state_updated', masked);
    }
  }
}

export function clearRoomTimer(roomCode: string) {
  const uppercaseCode = roomCode.toUpperCase();
  if (activeTimers[uppercaseCode]) {
    clearTimeout(activeTimers[uppercaseCode]);
    delete activeTimers[uppercaseCode];
  }
}

export async function startGame(io: Server, roomCode: string, roundNumber: number = 1) {
  const uppercaseCode = roomCode.toUpperCase();
  clearRoomTimer(uppercaseCode);

  try {
    const updatedState = await updateRoomState(uppercaseCode, (state) => {
      state.status = 'STARTING';
      state.currentRound = roundNumber; // start at specified round
      state.letter = getRandomLetter();
      state.currentCategoryIndex = 0;
      state.timerStartedAt = Date.now();
      state.answers = {}; // Reset answers for the new round
      return state;
    });

    broadcastRoomState(io, updatedState);

    // 3-second lobby countdown before game round starts (shortened to 50ms in test environment)
    const startDelay = process.env.NODE_ENV === 'test' ? 50 : 3000;
    const countdownTimer = setTimeout(async () => {
      try {
        const activeState = await updateRoomState(uppercaseCode, (state) => {
          state.status = 'ROUND_ACTIVE';
          state.timerStartedAt = Date.now();
          return state;
        });

        broadcastRoomState(io, activeState);
        startCategoryTimer(io, uppercaseCode, 0);
      } catch (err) {
        logger.error(`Error transitioning to ROUND_ACTIVE for room ${uppercaseCode}`, err);
      }
    }, startDelay);

    activeTimers[uppercaseCode] = countdownTimer;
  } catch (err) {
    logger.error(`Error starting game for room ${uppercaseCode}`, err);
  }
}

export async function startCategoryTimer(io: Server, roomCode: string, categoryIndex: number) {
  const uppercaseCode = roomCode.toUpperCase();
  clearRoomTimer(uppercaseCode);

  try {
    const state = await getRoomState(uppercaseCode);
    if (!state || state.status !== 'ROUND_ACTIVE' || state.currentCategoryIndex !== categoryIndex) {
      return;
    }

    // Category duration is shortened to 100ms in test environment
    const durationMs = process.env.NODE_ENV === 'test' ? 100 : state.timePerCategory * 1000;

    const timer = setTimeout(async () => {
      await advanceCategory(io, uppercaseCode, categoryIndex);
    }, durationMs);

    activeTimers[uppercaseCode] = timer;
  } catch (err) {
    logger.error(`Error starting category timer for room ${uppercaseCode}`, err);
  }
}

export async function advanceCategory(io: Server, roomCode: string, categoryIndex: number) {
  const uppercaseCode = roomCode.toUpperCase();
  clearRoomTimer(uppercaseCode);

  try {
    const state = await getRoomState(uppercaseCode);
    if (!state || state.status !== 'ROUND_ACTIVE' || state.currentCategoryIndex !== categoryIndex) {
      return;
    }

    // Check if there are more categories remaining in this round
    if (categoryIndex + 1 < state.categories.length) {
      const nextIndex = categoryIndex + 1;
      const updatedState = await updateRoomState(uppercaseCode, (currentState) => {
        currentState.currentCategoryIndex = nextIndex;
        currentState.timerStartedAt = Date.now();
        return currentState;
      });

      broadcastRoomState(io, updatedState);
      startCategoryTimer(io, uppercaseCode, nextIndex);
    } else {
      // Transition to validating status and run AI validation checks
      await runAIValidation(io, uppercaseCode);
    }
  } catch (err) {
    logger.error(`Error advancing category for room ${uppercaseCode}`, err);
  }
}

export async function runAIValidation(io: Server, roomCode: string) {
  const uppercaseCode = roomCode.toUpperCase();
  try {
    const state = await getRoomState(uppercaseCode);
    if (!state) return;

    // Set validating status first
    const validatingState = await updateRoomState(uppercaseCode, (curr) => {
      curr.status = 'VALIDATING';
      curr.timerStartedAt = Date.now();
      return curr;
    });
    broadcastRoomState(io, validatingState);

    // Run validation checks on all answers in parallel
    const answersToUpdate = JSON.parse(JSON.stringify(validatingState.answers));
    const validationPromises: Promise<void>[] = [];

    for (let catIndex = 0; catIndex < validatingState.categories.length; catIndex++) {
      const categoryAnswers = answersToUpdate[catIndex] || {};
      const categoryName = validatingState.categories[catIndex];

      for (const userId in categoryAnswers) {
        const playerAnswer = categoryAnswers[userId];
        
        validationPromises.push(
          (async () => {
            const isValid = await validateAnswer(playerAnswer.raw, validatingState.letter, categoryName);
            playerAnswer.approved = isValid;
            playerAnswer.votes = {}; // initialize voting records
          })()
        );
      }
      answersToUpdate[catIndex] = categoryAnswers;
    }

    await Promise.all(validationPromises);

    // Advance state to VOTING
    const votingState = await updateRoomState(uppercaseCode, (curr) => {
      curr.status = 'VOTING';
      curr.currentCategoryIndex = 0;
      curr.answers = answersToUpdate;
      curr.timerStartedAt = Date.now();
      return curr;
    });

    broadcastRoomState(io, votingState);
    startVotingTimer(io, uppercaseCode, 0);
  } catch (err) {
    logger.error(`Error in runAIValidation for room ${uppercaseCode}`, err);
  }
}

export async function startVotingTimer(io: Server, roomCode: string, categoryIndex: number) {
  const uppercaseCode = roomCode.toUpperCase();
  clearRoomTimer(uppercaseCode);

  try {
    const state = await getRoomState(uppercaseCode);
    if (!state || state.status !== 'VOTING' || state.currentCategoryIndex !== categoryIndex) {
      return;
    }

    // Dynamic voting duration per category (shortened to 100ms in test environment)
    const durationMs = process.env.NODE_ENV === 'test' ? 100 : state.votingTimeLimit * 1000;

    const timer = setTimeout(async () => {
      await advanceVoting(io, uppercaseCode, categoryIndex);
    }, durationMs);

    activeTimers[uppercaseCode] = timer;
  } catch (err) {
    logger.error(`Error starting voting timer for room ${uppercaseCode}`, err);
  }
}

export async function advanceVoting(io: Server, roomCode: string, categoryIndex: number) {
  const uppercaseCode = roomCode.toUpperCase();
  clearRoomTimer(uppercaseCode);

  try {
    const state = await getRoomState(uppercaseCode);
    if (!state || state.status !== 'VOTING' || state.currentCategoryIndex !== categoryIndex) {
      return;
    }

    if (categoryIndex + 1 < state.categories.length) {
      const nextIndex = categoryIndex + 1;
      const updatedState = await updateRoomState(uppercaseCode, (currentState) => {
        currentState.currentCategoryIndex = nextIndex;
        currentState.timerStartedAt = Date.now();
        return currentState;
      });

      broadcastRoomState(io, updatedState);
      startVotingTimer(io, uppercaseCode, nextIndex);
    } else {
      // Transition to scoring phase
      const scoringState = await updateRoomState(uppercaseCode, (currentState) => {
        currentState.status = 'SCORING';
        currentState.timerStartedAt = Date.now();
        return currentState;
      });
      broadcastRoomState(io, scoringState);

      // Perform score calculation and transition to FINISHED
      const finalState = await updateRoomState(uppercaseCode, (currentState) => {
        const playerIds = Object.keys(currentState.players);

        const roundScores: Record<string, number> = {};
        playerIds.forEach(id => {
          roundScores[id] = 0;
        });

        for (let catIdx = 0; catIdx < currentState.categories.length; catIdx++) {
          const categoryAnswers = currentState.answers[catIdx] || {};

          // Determine which answers are accepted
          const acceptedAnswers: Record<string, { norm: string; pId: string }> = {};
          
          for (const pId in categoryAnswers) {
            const answer = categoryAnswers[pId];
            
            const votes = answer.votes || {};
            const acceptVotes = Object.values(votes).filter(v => v === true).length;
            const rejectVotes = Object.values(votes).filter(v => v === false).length;

            // Decouple from AI validation: only player votes and non-empty answers count for points
            const isAccepted = answer.raw && answer.raw.trim().length > 0 && acceptVotes >= rejectVotes;
            if (isAccepted) {
              acceptedAnswers[pId] = {
                norm: answer.normalized,
                pId,
              };
            }
          }

          const acceptedPlayerIds = Object.keys(acceptedAnswers);
          const totalAcceptedCount = acceptedPlayerIds.length;

          if (totalAcceptedCount === 1) {
            const winnerId = acceptedPlayerIds[0];
            roundScores[winnerId] += currentState.scoring?.solo || 20;
          } else if (totalAcceptedCount > 1) {
            acceptedPlayerIds.forEach(currId => {
              const currNorm = acceptedAnswers[currId].norm;
              
              const matchCount = acceptedPlayerIds.filter(
                id => acceptedAnswers[id].norm === currNorm
              ).length;

              if (matchCount > 1) {
                roundScores[currId] += currentState.scoring?.shared || 5;
              } else {
                roundScores[currId] += currentState.scoring?.unique || 10;
              }
            });
          }
        }

        playerIds.forEach(id => {
          if (currentState.players[id]) {
            currentState.players[id].score = (currentState.players[id].score || 0) + roundScores[id];
          }
        });

        currentState.status = 'FINISHED';
        currentState.timerStartedAt = Date.now();
        return currentState;
      });

      broadcastRoomState(io, finalState);

      // Async save round and game progress to database
      saveRoundToDatabase(uppercaseCode, finalState);

      // Save to database if game is fully finished and multiplayer
      if (finalState.currentRound >= finalState.totalRounds) {
        const playerIds = Object.keys(finalState.players);
        // Only save competitive stats for multiplayer games
        if (playerIds.length > 1) {
          const sortedPlayers = playerIds
            .map(id => ({ id, score: finalState.players[id].score || 0 }))
            .sort((a, b) => b.score - a.score);
          
          const topScore = sortedPlayers[0]?.score || 0;
          const winners = sortedPlayers.filter(p => p.score === topScore).map(p => p.id);

          for (const id of playerIds) {
            try {
              const isWinner = winners.includes(id);
              const scoreToAdd = finalState.players[id].score || 0;
              
              const { data: user } = await supabase
                .from('users')
                .select('games_played, wins, total_score')
                .eq('clerk_id', id)
                .single();

              if (user) {
                await supabase
                  .from('users')
                  .update({
                    games_played: (user.games_played || 0) + 1,
                    wins: (user.wins || 0) + (isWinner ? 1 : 0),
                    total_score: (user.total_score || 0) + scoreToAdd,
                  })
                  .eq('clerk_id', id);
              }
            } catch (err) {
              logger.error(`Error saving stats for player ${id}`, err);
            }
          }
        }
      }
    }
  } catch (err) {
    logger.error(`Error advancing voting for room ${uppercaseCode}`, err);
  }
}

// Persist all rooms, room_players, rounds, answers, and votes to Supabase
async function saveRoundToDatabase(roomCode: string, state: RoomState) {
  try {
    const uppercaseCode = roomCode.toUpperCase();
    
    // 1. Get or create the room in Supabase
    const { data: dbHost } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', state.hostId)
      .single();
    
    if (!dbHost) {
      logger.error(`Could not find host in database during saveRoundToDatabase for clerk_id: ${state.hostId}`);
      return;
    }
    
    const { data: dbRoom, error: roomError } = await supabase
      .from('rooms')
      .upsert({
        code: uppercaseCode,
        status: state.currentRound >= state.totalRounds ? 'finished' : 'active',
        host_id: dbHost.id,
        round_count: state.totalRounds,
        current_round: state.currentRound,
        finished_at: state.currentRound >= state.totalRounds ? new Date().toISOString() : null
      }, { onConflict: 'code' })
      .select()
      .single();

    if (roomError || !dbRoom) {
      logger.error(`Error saving room to DB:`, roomError);
      return;
    }

    const roomId = dbRoom.id;

    // 2. Fetch all player internal UUIDs and save to room_players
    const playerClerkIds = Object.keys(state.players);
    const { data: dbPlayers, error: playersFetchError } = await supabase
      .from('users')
      .select('id, clerk_id')
      .in('clerk_id', playerClerkIds);

    if (playersFetchError || !dbPlayers) {
      logger.error(`Error fetching players for room_players:`, playersFetchError);
      return;
    }

    const clerkToUuidMap: Record<string, string> = {};
    dbPlayers.forEach(p => {
      clerkToUuidMap[p.clerk_id] = p.id;
    });

    // Save room_players using bulk upsert
    const roomPlayersToUpsert = [];
    for (const pId of playerClerkIds) {
      const userUuid = clerkToUuidMap[pId];
      if (userUuid) {
        roomPlayersToUpsert.push({
          room_id: roomId,
          user_id: userUuid,
          score: state.players[pId].score || 0,
          is_ready: state.players[pId].isReady || false
        });
      }
    }
    
    if (roomPlayersToUpsert.length > 0) {
      const { error: rpError } = await supabase
        .from('room_players')
        .upsert(roomPlayersToUpsert, { onConflict: 'room_id,user_id' });
        
      if (rpError) {
        logger.error(`Error bulk saving room_players:`, rpError);
      }
    }

    // 3. Insert or update the round record
    let roundId: string;
    const { data: existingRound } = await supabase
      .from('rounds')
      .select('id')
      .eq('room_id', roomId)
      .eq('round_number', state.currentRound)
      .maybeSingle();

    if (existingRound) {
      roundId = existingRound.id;
      await supabase
        .from('rounds')
        .update({
          letter: state.letter,
          status: 'done',
          finished_at: new Date().toISOString()
        })
        .eq('id', roundId);
    } else {
      const { data: newRound, error: roundError } = await supabase
        .from('rounds')
        .insert({
          room_id: roomId,
          round_number: state.currentRound,
          letter: state.letter,
          status: 'done',
          finished_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (roundError || !newRound) {
        logger.error(`Error saving round to DB:`, roundError);
        return;
      }
      roundId = newRound.id;
    }

    // 4. Save answers and votes using bulk upserts
    const answersToUpsert = [];
    const answerToVotesMap = new Map(); // Maps `${userId}-${category}` to their votes

    for (let catIdx = 0; catIdx < state.categories.length; catIdx++) {
      const categoryName = state.categories[catIdx];
      const categoryAnswers = state.answers[catIdx] || {};

      // Determine points awarded for each answer
      const acceptedAnswers: Record<string, { norm: string; pId: string }> = {};
      const answerPointsMap: Record<string, number> = {};
      
      for (const pId in categoryAnswers) {
        const answer = categoryAnswers[pId];
        const votes = answer.votes || {};
        const acceptVotes = Object.values(votes).filter(v => v === true).length;
        const rejectVotes = Object.values(votes).filter(v => v === false).length;

        const isAccepted = answer.raw && answer.raw.trim().length > 0 && acceptVotes >= rejectVotes;
        if (isAccepted) {
          acceptedAnswers[pId] = {
            norm: answer.normalized,
            pId,
          };
        }
        answerPointsMap[pId] = 0;
      }

      const acceptedPlayerIds = Object.keys(acceptedAnswers);
      const totalAcceptedCount = acceptedPlayerIds.length;

      if (totalAcceptedCount === 1) {
        const winnerId = acceptedPlayerIds[0];
        answerPointsMap[winnerId] = state.scoring?.solo || 20;
      } else if (totalAcceptedCount > 1) {
        acceptedPlayerIds.forEach(currId => {
          const currNorm = acceptedAnswers[currId].norm;
          const matchCount = acceptedPlayerIds.filter(
            id => acceptedAnswers[id].norm === currNorm
          ).length;

          if (matchCount > 1) {
            answerPointsMap[currId] = state.scoring?.shared || 5;
          } else {
            answerPointsMap[currId] = state.scoring?.unique || 10;
          }
        });
      }

      // Collect answers for bulk upsert
      for (const pId in categoryAnswers) {
        const answer = categoryAnswers[pId];
        const userUuid = clerkToUuidMap[pId];
        if (!userUuid) continue;

        const votes = answer.votes || {};
        const acceptVotes = Object.values(votes).filter(v => v === true).length;
        const rejectVotes = Object.values(votes).filter(v => v === false).length;
        const isValid = answer.raw && answer.raw.trim().length > 0 && acceptVotes >= rejectVotes;

        answersToUpsert.push({
          round_id: roundId,
          user_id: userUuid,
          category: categoryName,
          answer_raw: answer.raw,
          answer_normalized: answer.normalized,
          is_valid: isValid,
          validated_by: 'community',
          points_awarded: answerPointsMap[pId]
        });

        // Store votes for later, mapped to user_id and category
        answerToVotesMap.set(`${userUuid}-${categoryName}`, votes);
      }
    }

    if (answersToUpsert.length > 0) {
      const { data: dbAnswers, error: answerInsertError } = await supabase
        .from('answers')
        .upsert(answersToUpsert, { onConflict: 'round_id,user_id,category' })
        .select();

      if (answerInsertError || !dbAnswers) {
        logger.error(`Error bulk saving answers to DB:`, answerInsertError);
      } else {
        // Now collect votes for bulk upsert
        const votesToUpsert = [];
        
        for (const dbAnswer of dbAnswers) {
          const votes = answerToVotesMap.get(`${dbAnswer.user_id}-${dbAnswer.category}`);
          if (votes) {
            for (const voterClerkId in votes) {
              const voterUuid = clerkToUuidMap[voterClerkId];
              if (voterUuid) {
                votesToUpsert.push({
                  answer_id: dbAnswer.id,
                  voter_id: voterUuid,
                  vote: votes[voterClerkId]
                });
              }
            }
          }
        }
        
        if (votesToUpsert.length > 0) {
          const { error: votesError } = await supabase
            .from('votes')
            .upsert(votesToUpsert, { onConflict: 'answer_id,voter_id' });
            
          if (votesError) {
            logger.error(`Error bulk saving votes to DB:`, votesError);
          }
        }
      }
    }
    
    logger.info(`Successfully saved room, round, answers, and votes to DB for room: ${uppercaseCode}, round: ${state.currentRound}`);
  } catch (err) {
    logger.error(`Failed to save round to database for room ${roomCode}:`, err);
  }
}
