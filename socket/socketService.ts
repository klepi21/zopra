import { io, Socket } from 'socket.io-client';

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3000';

class SocketService {
  private socket: Socket | null = null;
  private tokenGetter: (() => Promise<string | null>) | null = null;

  initialize(tokenGetter: () => Promise<string | null>) {
    this.tokenGetter = tokenGetter;
  }

  async connect() {
    if (this.socket?.connected) return;

    if (!this.tokenGetter) {
      console.warn('SocketService initialized without tokenGetter');
      return;
    }

    const token = await this.tokenGetter();
    if (!token) {
      console.warn('Cannot connect to socket: No auth token retrieved');
      return;
    }

    // Initialize the socket connection
    this.socket = io(SERVER_URL, {
      auth: {
        token,
      },
      transports: ['websocket'],
      autoConnect: false,
    });

    // Handle authentication errors and trigger token refresh
    this.socket.on('connect_error', async (err) => {
      console.log('Socket connection error:', err.message);
      if ((err.message === 'Authentication error' || err.message === 'jwt expired') && this.tokenGetter) {
        console.log('Re-authenticating socket with fresh token...');
        const freshToken = await this.tokenGetter();
        if (freshToken && this.socket) {
          this.socket.auth = { token: freshToken };
          this.socket.connect();
        }
      }
    });

    this.socket.connect();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketService = new SocketService();
