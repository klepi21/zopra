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

describe('Game Loop Sockets Integration', () => {
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
    
    // Clear in-memory Redis
    if (store) {
      for (const key in store) {
        delete store[key];
      }
    }
    
    // Set up default Supabase mock chain
    mockFrom.mockReturnValue(mockQueryBuilder);
    mockSelect.mockImplementation((columns?: string) => {
      if (columns === 'key, value') {
        return Promise.resolve({
          data: [
            { key: 'categories', value: ['Όνομα', 'Ζώο', 'Πράγμα'] },
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

  it('should run start_game, transition status, mask answers, handle submissions and advance categories', async () => {
    const hostClient = await connectClient('mock_host_id');
    const guestClient = await connectClient('mock_guest_id');

    // 1. Host creates room
    mockSingle.mockResolvedValueOnce({
      data: { username: 'zeus_player', avatar_url: '' },
      error: null,
    });

    roomCode = await new Promise<string>((resolve) => {
      hostClient.emit('create_room', (res: any) => resolve(res.roomState.roomCode));
    });

    // 2. Guest joins room
    mockSingle.mockResolvedValueOnce({
      data: { username: 'athena_player', avatar_url: '' },
      error: null,
    });
    await new Promise<void>((resolve) => {
      guestClient.emit('join_room', { roomCode }, () => resolve());
    });

    // Setup state change listeners to track game progression
    const statesReceivedByGuest: any[] = [];
    guestClient.on('room_state_updated', (state) => {
      statesReceivedByGuest.push(state);
    });

    const statesReceivedByHost: any[] = [];
    hostClient.on('room_state_updated', (state) => {
      statesReceivedByHost.push(state);
    });

    // 3. Host starts game
    const startResult = await new Promise<any>((resolve) => {
      hostClient.emit('start_game', (res: any) => resolve(res));
    });

    expect(startResult.success).toBe(true);

    // Verify STARTING status broadcasted
    const startingState = statesReceivedByHost.find((s) => s.status === 'STARTING');
    expect(startingState).toBeDefined();
    expect(startingState.letter).toHaveLength(1);
    expect(startingState.currentRound).toBe(1);

    // 4. Wait for the STARTING countdown (50ms) to trigger ROUND_ACTIVE
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Verify status advanced to ROUND_ACTIVE
    const lastHostState = statesReceivedByHost[statesReceivedByHost.length - 1];
    expect(lastHostState.status).toBe('ROUND_ACTIVE');
    expect(lastHostState.currentCategoryIndex).toBe(0);

    // 5. Host submits answer for category 0 ('Όνομα')
    await new Promise<void>((resolve) => {
      hostClient.emit('submit_answer', { answer: 'ΑΛΕΞΗΣ' }, (res: any) => {
        expect(res.success).toBe(true);
        resolve();
      });
    });

    // Wait slightly for socket to broadcast update
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Anti-cheat verification: Guest should receive a masked state where host's answer is masked
    const maskedStateForGuest = statesReceivedByGuest[statesReceivedByGuest.length - 1];
    expect(maskedStateForGuest.answers['0']['host_id'].raw).toBe('SUBMITTED');
    expect(maskedStateForGuest.answers['0']['host_id'].normalized).toBe('SUBMITTED');

    // Host should see their own answer unmasked
    const unmaskedStateForHost = statesReceivedByHost[statesReceivedByHost.length - 1];
    expect(unmaskedStateForHost.answers['0']['host_id'].raw).toBe('ΑΛΕΞΗΣ');
    expect(unmaskedStateForHost.answers['0']['host_id'].normalized).toBe('ΑΛΕΞΗΣ');

    // 6. Guest submits answer for category 0 ('Όνομα')
    await new Promise<void>((resolve) => {
      guestClient.emit('submit_answer', { answer: 'ΑΝΝΑ' }, (res: any) => {
        expect(res.success).toBe(true);
        resolve();
      });
    });

    // Wait slightly for socket to process and advance
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Since both players submitted, verify that the category immediately advanced to category index 1 ('Ζώο')
    const advancedHostState = statesReceivedByHost[statesReceivedByHost.length - 1];
    expect(advancedHostState.currentCategoryIndex).toBe(1);
    expect(advancedHostState.status).toBe('ROUND_ACTIVE');

    // 7. Let category 1 timeout run (100ms) without any answer submissions
    await new Promise((resolve) => setTimeout(resolve, 120));

    // Verify that category index automatically advanced to index 2 ('Πράγμα')
    const timeoutHostState = statesReceivedByHost[statesReceivedByHost.length - 1];
    expect(timeoutHostState.currentCategoryIndex).toBe(2);
    expect(timeoutHostState.status).toBe('ROUND_ACTIVE');
  });
});
