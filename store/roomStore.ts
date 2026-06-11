import { create } from 'zustand';
import { socketService } from '@/socket/socketService';

export interface PlayerState {
  username: string;
  avatarUrl: string;
  score: number;
  connected: boolean;
  backgrounded: boolean;
  backgroundCount: number;
  isReady?: boolean;
}

export interface PlayerAnswer {
  raw: string;
  normalized: string;
  submittedAt: number;
  approved?: boolean | null; // null = AI unavailable (no badge shown); true/false = AI verdict
  votes?: Record<string, boolean>;
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  status: 'WAITING' | 'STARTING' | 'ROUND_ACTIVE' | 'VALIDATING' | 'VOTING' | 'SCORING' | 'FINISHED';
  currentRound: number;
  totalRounds: number;
  currentCategoryIndex: number;
  categories: string[];
  letter: string;
  timerStartedAt: number;
  scoring: { solo: number; unique: number; shared: number };
  timePerCategory: number;
  votingTimeLimit: number;
  players: Record<string, PlayerState>;
  answers: Record<string, Record<string, PlayerAnswer>>;
  isPublic?: boolean;
}

export interface PublicRoom {
  code: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  totalRounds: number;
  timePerCategory: number;
}

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3000';

interface RoomStoreState {
  roomState: RoomState | null;
  isLoading: boolean;
  error: string | null;

  setRoomState: (state: RoomState | null) => void;
  createRoom: (options?: { totalRounds?: number; timePerCategory?: number; isPublic?: boolean }) => Promise<RoomState>;
  fetchPublicRooms: (authToken: string) => Promise<PublicRoom[]>;
  fetchOnlineCount: (authToken: string) => Promise<number>;
  joinRoom: (roomCode: string) => Promise<RoomState>;
  toggleReady: () => Promise<void>;
  leaveRoom: () => Promise<void>;
  startGame: () => Promise<void>;
  submitAnswer: (answer: string) => Promise<void>;
  castVote: (categoryIndex: number, targetUserId: string, vote: boolean) => Promise<void>;
  resetRoom: () => Promise<void>;
  nextRound: () => Promise<void>;
  setupSocketListeners: () => void;
  cleanupSocketListeners: () => void;
  reset: () => void;
}

export const useRoomStore = create<RoomStoreState>((set, get) => ({
  roomState: null,
  isLoading: false,
  error: null,

  setRoomState: (state) => set({ roomState: state }),

  createRoom: (options) => {
    return new Promise(async (resolve, reject) => {
      set({ isLoading: true, error: null });

      // Guard: if the socket disconnects before the server callback fires the Promise
      // would hang forever. Reject after 10 s so the UI can show an error instead.
      const timeout = setTimeout(() => {
        set({ isLoading: false, error: 'Connection timed out. Please try again.' });
        reject(new Error('Connection timed out. Please try again.'));
      }, 10000);

      try {
        const socket = await socketService.ensureConnected();

        socket.emit('create_room', options ?? {}, (response: any) => {
          clearTimeout(timeout);
          set({ isLoading: false });
          if (response.error) {
            set({ error: response.error });
            reject(new Error(response.error));
          } else {
            set({ roomState: response.roomState });
            resolve(response.roomState);
          }
        });
      } catch (err: any) {
        clearTimeout(timeout);
        set({ isLoading: false, error: err.message || 'Socket is not connected' });
        reject(err);
      }
    });
  },

  fetchPublicRooms: async (authToken: string) => {
    const res = await fetch(`${SERVER_URL}/api/rooms/public`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch public rooms');
    return res.json() as Promise<PublicRoom[]>;
  },

  fetchOnlineCount: async (authToken: string) => {
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms/online-count`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.count ?? 0;
    } catch {
      return 0;
    }
  },

  joinRoom: (roomCode: string) => {
    return new Promise(async (resolve, reject) => {
      set({ isLoading: true, error: null });

      const timeout = setTimeout(() => {
        set({ isLoading: false, error: 'Connection timed out. Please try again.' });
        reject(new Error('Connection timed out. Please try again.'));
      }, 10000);

      try {
        const socket = await socketService.ensureConnected();

        socket.emit('join_room', { roomCode }, (response: any) => {
          clearTimeout(timeout);
          set({ isLoading: false });
          if (response.error) {
            set({ error: response.error });
            reject(new Error(response.error));
          } else {
            set({ roomState: response.roomState });
            resolve(response.roomState);
          }
        });
      } catch (err: any) {
        clearTimeout(timeout);
        set({ isLoading: false, error: err.message || 'Socket is not connected' });
        reject(err);
      }
    });
  },

  toggleReady: () => {
    return new Promise((resolve, reject) => {
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        return reject(new Error('Socket is not connected'));
      }

      socket.emit('toggle_ready', (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          set({ roomState: response.roomState });
          resolve();
        }
      });
    });
  },

  leaveRoom: () => {
    return new Promise((resolve) => {
      const socket = socketService.getSocket();
      if (socket && socket.connected) {
        socket.emit('leave_room', () => {
          get().cleanupSocketListeners();
          set({ roomState: null, error: null, isLoading: false });
          resolve();
        });
      } else {
        set({ roomState: null, error: null, isLoading: false });
        resolve();
      }
    });
  },

  startGame: () => {
    return new Promise((resolve, reject) => {
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        return reject(new Error('Socket is not connected'));
      }

      socket.emit('start_game', (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  },

  submitAnswer: (answer: string) => {
    return new Promise((resolve, reject) => {
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        return reject(new Error('Socket is not connected'));
      }

      socket.emit('submit_answer', { answer }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  },

  castVote: (categoryIndex: number, targetUserId: string, vote: boolean) => {
    return new Promise((resolve, reject) => {
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        return reject(new Error('Socket is not connected'));
      }

      socket.emit('cast_vote', { categoryIndex, targetUserId, vote }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  },

  resetRoom: () => {
    return new Promise((resolve, reject) => {
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        return reject(new Error('Socket is not connected'));
      }

      socket.emit('reset_room', (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  },

  nextRound: () => {
    return new Promise((resolve, reject) => {
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        return reject(new Error('Socket is not connected'));
      }

      socket.emit('next_round', (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  },

  setupSocketListeners: () => {
    const socket = socketService.getSocket();
    if (!socket) return;

    // Remove existing listener to avoid duplicates
    socket.off('room_state_updated');
    socket.off('connect');
    
    socket.on('room_state_updated', (updatedState: RoomState) => {
      set({ roomState: updatedState });
    });

    // Handle reconnection to automatically rejoin the active room
    socket.on('connect', () => {
      const currentRoom = get().roomState?.roomCode;
      if (currentRoom) {
        socket.emit('join_room', { roomCode: currentRoom }, (response: any) => {
          if (!response.error && response.roomState) {
            set({ roomState: response.roomState });
          }
        });
      }
    });
  },

  cleanupSocketListeners: () => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.off('room_state_updated');
    }
  },

  reset: () => {
    get().cleanupSocketListeners();
    set({ roomState: null, error: null, isLoading: false });
  },
}));
