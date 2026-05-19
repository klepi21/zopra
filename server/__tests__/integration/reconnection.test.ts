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

describe('Graceful Reconnection and Background Tracking', () => {
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
    mockSelect.mockReturnValue(mockQueryBuilder);
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

  it('should handle background toggles, graceful disconnect grace periods, and re-entry reconnection', async () => {
    const hostClient = await connectClient('mock_host_id');
    let guestClient = await connectClient('mock_guest_id');

    // 1. Setup Room
    mockSingle.mockResolvedValueOnce({
      data: { username: 'zeus_player', avatar_url: '' },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { categories: ['Όνομα'], time_per_category: 10, total_rounds: 3 },
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

    // 2. Start game to lock it into active state
    await new Promise<void>((resolve) => {
      hostClient.emit('start_game', () => resolve());
    });

    // Wait for game to enter ROUND_ACTIVE
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Listen to updates on Host client
    const statesReceivedByHost: any[] = [];
    hostClient.on('room_state_updated', (state) => {
      statesReceivedByHost.push(state);
    });

    // 3. Test App Backgrounding
    hostClient.emit('player_backgrounded');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(statesReceivedByHost[statesReceivedByHost.length - 1].players['host_id'].backgrounded).toBe(true);
    expect(statesReceivedByHost[statesReceivedByHost.length - 1].players['host_id'].backgroundCount).toBe(1);

    hostClient.emit('player_foregrounded');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(statesReceivedByHost[statesReceivedByHost.length - 1].players['host_id'].backgrounded).toBe(false);

    // 4. Test Guest Disconnection (Grace Period starts)
    guestClient.disconnect();
    
    // Wait for host to receive the disconnected update
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(statesReceivedByHost[statesReceivedByHost.length - 1].players['guest_id'].connected).toBe(false);

    // 5. Reconnect Guest before the 50ms test grace timer expires
    guestClient = await connectClient('mock_guest_id');
    
    const reconnectResult = await new Promise<any>((resolve) => {
      guestClient.emit('join_room', { roomCode }, (res: any) => resolve(res));
    });

    expect(reconnectResult.roomState.players['guest_id'].connected).toBe(true);
    
    // Host should receive update showing guest reconnected
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(statesReceivedByHost[statesReceivedByHost.length - 1].players['guest_id'].connected).toBe(true);

    // 6. Test Disconnect Grace Expiration
    // Disconnect guest client again
    guestClient.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(statesReceivedByHost[statesReceivedByHost.length - 1].players['guest_id'].connected).toBe(false);

    // Wait 60ms for grace timer (50ms in test environment) to expire
    await new Promise((resolve) => setTimeout(resolve, 70));

    // Guest should be removed from the room entirely
    expect(statesReceivedByHost[statesReceivedByHost.length - 1].players['guest_id']).toBeUndefined();
  });
});
