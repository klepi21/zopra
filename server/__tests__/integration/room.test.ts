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

const mockFrom = supabase.from as jest.Mock;
const store = (global as any).redisStore;

describe('Room Sockets Integration', () => {
  let io: Server;
  let httpServer: any;
  let port: number;
  let clients: ClientSocket[] = [];

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

  describe('Authentication Middleware', () => {
    it('should reject connection if token is missing', async () => {
      await expect(connectClient('')).rejects.toThrow();
    });

    it('should connect successfully with a valid mock token', async () => {
      const client = await connectClient('mock_user_1');
      expect(client.connected).toBe(true);
    });
  });

  describe('Room Operations', () => {
    it('should successfully create a room and generate a code', async () => {
      const client = await connectClient('mock_host_id');

      // Mock user profile retrieval
      mockSingle.mockResolvedValueOnce({
        data: { username: 'zeus_player', avatar_url: '{"id":"zeus","emoji":"⚡"}' },
        error: null,
      });

      // Mock default settings retrieval
      mockMaybeSingle.mockResolvedValueOnce({
        data: { categories: ['Όνομα', 'Ζώο'], time_per_category: 30, total_rounds: 3 },
        error: null,
      });

      return new Promise<void>((resolve, reject) => {
        client.emit('create_room', (response: any) => {
          try {
            expect(response.error).toBeUndefined();
            expect(response.roomState).toBeDefined();
            expect(response.roomState.roomCode).toHaveLength(6);
            expect(response.roomState.hostId).toBe('host_id');
            expect(response.roomState.status).toBe('WAITING');
            expect(response.roomState.players['host_id']).toEqual({
              username: 'zeus_player',
              avatarUrl: '{"id":"zeus","emoji":"⚡"}',
              score: 0,
              connected: true,
              backgrounded: false,
              backgroundCount: 0,
              isReady: true,
            });
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
    });

    it('should allow other players to join the created room', async () => {
      const hostClient = await connectClient('mock_host_id');
      const guestClient = await connectClient('mock_guest_id');

      // 1. Host creates a room
      mockSingle.mockResolvedValueOnce({
        data: { username: 'zeus_player', avatar_url: '{"id":"zeus","emoji":"⚡"}' },
        error: null,
      });
      mockMaybeSingle.mockResolvedValueOnce({
        data: { categories: ['Όνομα'], time_per_category: 30, total_rounds: 3 },
        error: null,
      });

      const roomCode = await new Promise<string>((resolve) => {
        hostClient.emit('create_room', (res: any) => {
          resolve(res.roomState.roomCode);
        });
      });

      // 2. Guest joins the room
      mockSingle.mockResolvedValueOnce({
        data: { username: 'athena_player', avatar_url: '{"id":"athena","emoji":"🦉"}' },
        error: null,
      });

      return new Promise<void>((resolve, reject) => {
        guestClient.emit('join_room', { roomCode }, (response: any) => {
          try {
            expect(response.error).toBeUndefined();
            expect(response.roomState).toBeDefined();
            expect(response.roomState.players['guest_id']).toEqual({
              username: 'athena_player',
              avatarUrl: '{"id":"athena","emoji":"🦉"}',
              score: 0,
              connected: true,
              backgrounded: false,
              backgroundCount: 0,
              isReady: false,
            });
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
    });

    it('should handle toggle_ready state properly', async () => {
      const hostClient = await connectClient('mock_host_id');
      const guestClient = await connectClient('mock_guest_id');

      // Host creates room
      mockSingle.mockResolvedValueOnce({
        data: { username: 'zeus_player', avatar_url: '' },
        error: null,
      });
      const roomCode = await new Promise<string>((resolve) => {
        hostClient.emit('create_room', (res: any) => resolve(res.roomState.roomCode));
      });

      // Guest joins room
      mockSingle.mockResolvedValueOnce({
        data: { username: 'athena_player', avatar_url: '' },
        error: null,
      });
      await new Promise<void>((resolve) => {
        guestClient.emit('join_room', { roomCode }, () => resolve());
      });

      // Guest toggles ready
      return new Promise<void>((resolve, reject) => {
        guestClient.emit('toggle_ready', (response: any) => {
          try {
            expect(response.error).toBeUndefined();
            expect(response.roomState.players['guest_id'].isReady).toBe(true);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
    });

    it('should clean up room state when all players leave', async () => {
      const hostClient = await connectClient('mock_host_id');

      mockSingle.mockResolvedValueOnce({
        data: { username: 'zeus_player', avatar_url: '' },
        error: null,
      });
      const roomCode = await new Promise<string>((resolve) => {
        hostClient.emit('create_room', (res: any) => resolve(res.roomState.roomCode));
      });

      // Host leaves
      return new Promise<void>((resolve, reject) => {
        hostClient.emit('leave_room', async (response: any) => {
          try {
            expect(response.success).toBe(true);
            
            // Check Redis directly to verify the room state is deleted
            const redisKey = `room:${roomCode}`;
            expect(store[redisKey]).toBeUndefined();
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
    });
  });
});
