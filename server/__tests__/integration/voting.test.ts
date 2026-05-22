// Mock Supabase
jest.mock('../../src/db/supabase', () => {
  return {
    supabase: {
      from: jest.fn(),
    },
  };
});

import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { AddressInfo } from 'net';
import { socketAuthMiddleware } from '../../src/middleware/socketAuth';
import { registerRoomHandlers } from '../../src/socket/roomHandler';
import { supabase } from '../../src/db/supabase';
import { clearRoomTimer } from '../../src/socket/gameMachine';

const mockFrom = supabase.from as jest.Mock;
const store = (global as any).redisStore;

describe('Voting and Scoring Integration', () => {
  let io: Server;
  let httpServer: any;
  let port: number;
  let clients: ClientSocket[] = [];
  let roomCode: string;

  const mockSelect = jest.fn();
  const mockEq = jest.fn();
  const mockLimit = jest.fn();
  const mockMaybeSingle = jest.fn();
  const mockSingle = jest.fn();

  const mockQueryBuilder = {
    select: mockSelect,
    eq: mockEq,
    limit: mockLimit,
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
  };

  beforeAll((done) => {
    httpServer = createServer();
    io = new Server(httpServer);

    io.use(socketAuthMiddleware);
    io.on('connection', (socket) => {
      registerRoomHandlers(io, socket);
    });

    httpServer.listen(() => {
      const address = httpServer.address() as AddressInfo;
      port = address.port;
      done();
    });
  });

  afterAll((done) => {
    if (roomCode) {
      clearRoomTimer(roomCode);
    }
    io.close();
    httpServer.close();
    done();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear Redis mock
    if (store) {
      for (const key in store) {
        delete store[key];
      }
    }

    mockFrom.mockReturnValue(mockQueryBuilder);
    mockSelect.mockImplementation((columns?: string) => {
      if (columns === 'key, value') {
        return Promise.resolve({
          data: [
            { key: 'categories', value: ['Όνομα', 'Ζώο'] },
            { key: 'time_per_category', value: 10 },
            { key: 'total_rounds', value: 3 }
          ],
          error: null
        });
      }
      return mockQueryBuilder;
    });
    mockEq.mockReturnValue(mockQueryBuilder);
    mockLimit.mockReturnValue(mockQueryBuilder);
    mockMaybeSingle.mockReturnValue(mockQueryBuilder);
    mockSingle.mockReturnValue(mockQueryBuilder);
  });

  afterEach(() => {
    clients.forEach((client) => {
      if (client.connected) {
        client.disconnect();
      }
    });
    clients = [];
    if (roomCode) {
      clearRoomTimer(roomCode);
    }
  });

  function connectClient(token: string): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const client = Client(`http://localhost:${port}`, {
        auth: { token },
        transports: ['websocket'],
      });
      client.on('connect', () => {
        clients.push(client);
        resolve(client);
      });
      client.on('connect_error', (err) => {
        reject(err);
      });
    });
  }

  it('should run a game round, validate answers, accept/cast votes, and calculate final scores correctly', async () => {
    const hostClient = await connectClient('mock_host_id');
    const guestClient = await connectClient('mock_guest_id');

    // 1. Create Room with 2 categories: ['Όνομα', 'Ζώο']
    mockSingle.mockResolvedValueOnce({
      data: { username: 'zeus_player', avatar_url: '' },
      error: null,
    });

    roomCode = await new Promise<string>((resolve) => {
      hostClient.emit('create_room', (res: any) => resolve(res.roomState.roomCode));
    });

    mockSingle.mockResolvedValueOnce({
      data: { username: 'athena_player', avatar_url: '' },
      error: null,
    });
    await new Promise<void>((resolve) => {
      guestClient.emit('join_room', { roomCode }, () => resolve());
    });

    // Start game
    await new Promise<void>((resolve) => {
      hostClient.emit('start_game', () => resolve());
    });

    // Wait for state to be ROUND_ACTIVE
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Force letter to 'A' in global mock store to test exact letter starts
    const rawStoreKey = `room:${roomCode}`;
    const state = JSON.parse(store[rawStoreKey]);
    state.letter = 'Α';
    store[rawStoreKey] = JSON.stringify(state);

    const statesReceived: any[] = [];
    hostClient.on('room_state_updated', (updated) => {
      statesReceived.push(updated);
    });

    // 2. Submit Category 0 (Όνομα)
    // Both players write 'ΑΝΝΑ' (shared correct answer)
    await new Promise<void>((resolve) => {
      hostClient.emit('submit_answer', { answer: 'ΑΝΝΑ' }, () => resolve());
    });
    await new Promise<void>((resolve) => {
      guestClient.emit('submit_answer', { answer: 'ΑΝΝΑ' }, () => resolve());
    });

    // Wait for transition to Category 1 (Ζώο)
    await new Promise((resolve) => setTimeout(resolve, 60));

    // 3. Submit Category 1 (Ζώο)
    // Host writes 'ΑΛΟΓΟ'
    // Guest writes 'ΑΡΚΟΥΔΑ'
    await new Promise<void>((resolve) => {
      hostClient.emit('submit_answer', { answer: 'ΑΛΟΓΟ' }, () => resolve());
    });
    await new Promise<void>((resolve) => {
      guestClient.emit('submit_answer', { answer: 'ΑΡΚΟΥΔΑ' }, () => resolve());
    });

    // Wait for transition to VALIDATING and then VOTING
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Current status should be VOTING and currentCategoryIndex = 0
    let lastState = statesReceived[statesReceived.length - 1];
    expect(lastState.status).toBe('VOTING');
    expect(lastState.currentCategoryIndex).toBe(0);

    // Verify AI approved both answers for Category 0
    expect(lastState.answers[0]['host_id'].approved).toBe(true);
    expect(lastState.answers[0]['guest_id'].approved).toBe(true);

    // 4. Cast votes for Category 0
    // Host votes TRUE on guest answer
    // Guest votes TRUE on host answer
    await new Promise<void>((resolve) => {
      hostClient.emit('cast_vote', { categoryIndex: 0, targetUserId: 'guest_id', vote: true }, () => resolve());
    });
    await new Promise<void>((resolve) => {
      guestClient.emit('cast_vote', { categoryIndex: 0, targetUserId: 'host_id', vote: true }, () => resolve());
    });

    // All voted triggers fast-forward to Category 1 voting
    await new Promise((resolve) => setTimeout(resolve, 60));

    lastState = statesReceived[statesReceived.length - 1];
    expect(lastState.currentCategoryIndex).toBe(1);

    // 5. Cast votes for Category 1
    // Host votes TRUE on guest answer
    // Guest votes TRUE on host answer
    await new Promise<void>((resolve) => {
      hostClient.emit('cast_vote', { categoryIndex: 1, targetUserId: 'guest_id', vote: true }, () => resolve());
    });
    await new Promise<void>((resolve) => {
      guestClient.emit('cast_vote', { categoryIndex: 1, targetUserId: 'host_id', vote: true }, () => resolve());
    });

    // All voted triggers transition to SCORING, then FINISHED
    await new Promise((resolve) => setTimeout(resolve, 100));

    lastState = statesReceived[statesReceived.length - 1];
    expect(lastState.status).toBe('FINISHED');

    // Score calculations:
    // Category 0: Both wrote 'ΑΝΝΑ' (shared, correct) => 5 points each
    // Category 1: Host wrote 'ΑΛΟΓΟ', Guest wrote 'ΑΡΚΟΥΔΑ' (both correct, unique words, but multiple players correct) => 10 points each
    // Total: Host = 15 points, Guest = 15 points
    expect(lastState.players['host_id'].score).toBe(15);
    expect(lastState.players['guest_id'].score).toBe(15);
  });
});
