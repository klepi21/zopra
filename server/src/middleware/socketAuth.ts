import { Socket } from 'socket.io';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import logger from '../utils/logger';

const clerkSecretKey = process.env.CLERK_SECRET_KEY || 'mock_secret_key';
const clerkClient = createClerkClient({ secretKey: clerkSecretKey });

export async function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;

  if (!token) {
    return next(new Error('Authentication error: Missing token'));
  }

  // Bypass token verification in test or development environments for mock tokens
  const isBypassEnv = !process.env.NODE_ENV || process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  if (isBypassEnv && typeof token === 'string' && token.startsWith('mock_')) {
    socket.data.userId = token.replace('mock_', '');
    return next();
  }

  try {
    const payload = await clerkClient.verifyToken(token as string);
    socket.data.userId = payload.sub;
    next();
  } catch (error) {
    logger.error('Socket authentication verification failed:', error);
    next(new Error('Authentication error: Invalid token'));
  }
}
