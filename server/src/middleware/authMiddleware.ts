import { Request, Response, NextFunction } from 'express';
import { createClerkClient, verifyToken } from '@clerk/express';
import logger from '../utils/logger';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
      };
    }
  }
}

const clerkSecretKey = process.env.CLERK_SECRET_KEY || 'mock_secret_key';
export const clerkClient = createClerkClient({ secretKey: clerkSecretKey });

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow bypassing in tests with a mock token
  if (process.env.NODE_ENV === 'test' && req.headers.authorization?.startsWith('Bearer mock_')) {
    const mockUserId = req.headers.authorization.split(' ')[1].replace('mock_', '');
    req.auth = { userId: mockUserId };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = await verifyToken(token, { secretKey: clerkSecretKey });
    req.auth = { userId: payload.sub };
    next();
  } catch (error) {
    logger.error('Error verifying Clerk token', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}
