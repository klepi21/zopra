import { useRoomStore, RoomState } from '../store/roomStore';

// Mock Socket.io client instance methods
const mockEmit = jest.fn();
const mockOff = jest.fn();
const mockOn = jest.fn();

const mockSocket = {
  connected: true,
  emit: mockEmit,
  off: mockOff,
  on: mockOn,
};

jest.mock('@/socket/socketService', () => {
  return {
    socketService: {
      getSocket: jest.fn().mockImplementation(() => mockSocket),
    },
  };
});

describe('roomStore Zustand Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useRoomStore.getState().reset();
  });

  it('should initialize with default state', () => {
    const state = useRoomStore.getState();
    expect(state.roomState).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  describe('createRoom', () => {
    it('should emit create_room and update roomState on success', async () => {
      const mockState: RoomState = {
        roomCode: 'ABCDEF',
        hostId: 'host-1',
        status: 'WAITING',
        currentRound: 0,
        totalRounds: 5,
        currentCategoryIndex: 0,
        categories: ['Όνομα'],
        letter: '',
        timerStartedAt: 0,
        timePerCategory: 60,
        players: {},
        answers: {},
      };

      // Simulate successful server response callback
      mockEmit.mockImplementationOnce((event: string, arg2: any, arg3?: any) => {
        const callback = typeof arg2 === 'function' ? arg2 : arg3;
        callback({ roomState: mockState });
      });

      const promise = useRoomStore.getState().createRoom();
      
      expect(mockEmit).toHaveBeenCalledWith('create_room', expect.any(Object), expect.any(Function));
      
      const result = await promise;
      expect(result).toEqual(mockState);
      expect(useRoomStore.getState().roomState).toEqual(mockState);
      expect(useRoomStore.getState().isLoading).toBe(false);
      expect(useRoomStore.getState().error).toBeNull();
    });

    it('should set error state if create_room returns error callback', async () => {
      mockEmit.mockImplementationOnce((event: string, arg2: any, arg3?: any) => {
        const callback = typeof arg2 === 'function' ? arg2 : arg3;
        callback({ error: 'Server creation error' });
      });

      await expect(useRoomStore.getState().createRoom()).rejects.toThrow('Server creation error');
      
      expect(useRoomStore.getState().roomState).toBeNull();
      expect(useRoomStore.getState().isLoading).toBe(false);
      expect(useRoomStore.getState().error).toBe('Server creation error');
    });
  });

  describe('joinRoom', () => {
    it('should emit join_room with code and update roomState on success', async () => {
      const mockState: RoomState = {
        roomCode: 'XYZ987',
        hostId: 'host-2',
        status: 'WAITING',
        currentRound: 0,
        totalRounds: 5,
        currentCategoryIndex: 0,
        categories: ['Όνομα'],
        letter: '',
        timerStartedAt: 0,
        timePerCategory: 60,
        players: {},
        answers: {},
      };

      mockEmit.mockImplementationOnce((event: string, payload: any, callback: any) => {
        callback({ roomState: mockState });
      });

      const promise = useRoomStore.getState().joinRoom('XYZ987');
      
      expect(mockEmit).toHaveBeenCalledWith(
        'join_room',
        { roomCode: 'XYZ987' },
        expect.any(Function)
      );

      const result = await promise;
      expect(result).toEqual(mockState);
      expect(useRoomStore.getState().roomState).toEqual(mockState);
      expect(useRoomStore.getState().isLoading).toBe(false);
      expect(useRoomStore.getState().error).toBeNull();
    });
  });

  describe('toggleReady', () => {
    it('should emit toggle_ready and update roomState', async () => {
      const mockState: RoomState = {
        roomCode: 'XYZ987',
        hostId: 'host-2',
        status: 'WAITING',
        currentRound: 0,
        totalRounds: 5,
        currentCategoryIndex: 0,
        categories: ['Όνομα'],
        letter: '',
        timerStartedAt: 0,
        timePerCategory: 60,
        players: {
          'user-1': {
            username: 'achilles',
            avatarUrl: '',
            score: 0,
            connected: true,
            backgrounded: false,
            backgroundCount: 0,
            isReady: true,
          },
        },
        answers: {},
      };

      mockEmit.mockImplementationOnce((event: string, callback: any) => {
        callback({ roomState: mockState });
      });

      await useRoomStore.getState().toggleReady();
      
      expect(mockEmit).toHaveBeenCalledWith('toggle_ready', expect.any(Function));
      expect(useRoomStore.getState().roomState).toEqual(mockState);
    });
  });

  describe('leaveRoom', () => {
    it('should emit leave_room, clean up listeners, and clear roomState', async () => {
      mockEmit.mockImplementationOnce((event: string, callback: any) => {
        callback();
      });

      // Prepopulate roomState
      useRoomStore.setState({
        roomState: {
          roomCode: 'XYZ987',
          hostId: 'host-2',
          status: 'WAITING',
          currentRound: 0,
          totalRounds: 5,
          currentCategoryIndex: 0,
          categories: ['Όνομα'],
          letter: '',
          timerStartedAt: 0,
          timePerCategory: 60,
          players: {},
          answers: {},
        },
      });

      await useRoomStore.getState().leaveRoom();

      expect(mockEmit).toHaveBeenCalledWith('leave_room', expect.any(Function));
      expect(mockOff).toHaveBeenCalledWith('room_state_updated');
      expect(useRoomStore.getState().roomState).toBeNull();
    });
  });

  describe('startGame', () => {
    it('should emit start_game and resolve on success', async () => {
      mockEmit.mockImplementationOnce((event: string, callback: any) => {
        callback({ success: true });
      });

      await expect(useRoomStore.getState().startGame()).resolves.toBeUndefined();
      expect(mockEmit).toHaveBeenCalledWith('start_game', expect.any(Function));
    });

    it('should throw error if server returns error on start_game', async () => {
      mockEmit.mockImplementationOnce((event: string, callback: any) => {
        callback({ error: 'Cannot start game yet' });
      });

      await expect(useRoomStore.getState().startGame()).rejects.toThrow('Cannot start game yet');
    });
  });

  describe('submitAnswer', () => {
    it('should emit submit_answer with answer and resolve on success', async () => {
      mockEmit.mockImplementationOnce((event: string, payload: any, callback: any) => {
        callback({ success: true });
      });

      await expect(useRoomStore.getState().submitAnswer('ΑΘΗΝΑ')).resolves.toBeUndefined();
      expect(mockEmit).toHaveBeenCalledWith(
        'submit_answer',
        { answer: 'ΑΘΗΝΑ' },
        expect.any(Function)
      );
    });

    it('should throw error if server returns error on submit_answer', async () => {
      mockEmit.mockImplementationOnce((event: string, payload: any, callback: any) => {
        callback({ error: 'Round not active' });
      });

      await expect(useRoomStore.getState().submitAnswer('ΑΘΗΝΑ')).rejects.toThrow('Round not active');
    });
  });
});
