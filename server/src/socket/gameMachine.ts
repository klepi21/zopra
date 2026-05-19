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

    // Run validation checks on all answers
    const answersToUpdate = JSON.parse(JSON.stringify(validatingState.answers));
    for (let catIndex = 0; catIndex < validatingState.categories.length; catIndex++) {
      const categoryAnswers = answersToUpdate[catIndex] || {};
      const categoryName = validatingState.categories[catIndex];

      for (const userId in categoryAnswers) {
        const playerAnswer = categoryAnswers[userId];
        const isValid = await validateAnswer(playerAnswer.raw, validatingState.letter, categoryName);
        playerAnswer.approved = isValid;
        playerAnswer.votes = {}; // initialize voting records
      }
      answersToUpdate[catIndex] = categoryAnswers;
    }

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

            const isAccepted = acceptVotes >= rejectVotes && answer.approved;
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
