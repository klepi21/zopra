import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import logger from './utils/logger';
import webhooksRouter from './api/webhooks';
import usersRouter from './api/users';

import { socketAuthMiddleware } from './middleware/socketAuth';
import { registerRoomHandlers } from './socket/roomHandler';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
// Webhooks route must use raw body parsing for Svix signature verification
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooksRouter);

app.use(express.json());

// Routes
app.use('/api/users', usersRouter);

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Mount socket auth middleware
io.use(socketAuthMiddleware);

// Socket connection handler
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id} (user: ${socket.data.userId})`);

  registerRoomHandlers(io, socket);
});

const PORT = process.env.PORT || 3001;

// Only start listening if not running in a test environment
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

export { app, httpServer, io };
