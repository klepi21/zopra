import { Router, Request, Response } from 'express';
import { Server } from 'socket.io';
import { getRoomState } from '../db/roomState';
import { getPublicRoomCodes, removePublicRoom } from '../db/publicRooms';
import { authMiddleware } from '../middleware/authMiddleware';
import logger from '../utils/logger';

// Factory function receives the Socket.IO server so the online-count endpoint
// can read the live connected socket count without a circular import.
export function createRoomsRouter(io: Server) {
  const router = Router();

  // GET /api/rooms/public — list active public rooms waiting for players.
  // Performs lazy cleanup: codes pointing to expired/started rooms are removed from the SET.
  router.get('/public', authMiddleware, async (req: Request, res: Response) => {
    try {
      const codes = await getPublicRoomCodes();
      const rooms = [];
      const staleCodes: string[] = [];

      for (const code of codes) {
        const state = await getRoomState(code);
        if (!state || state.status !== 'WAITING') {
          // Room expired, started, or was deleted — clean it up lazily
          staleCodes.push(code);
          continue;
        }
        const connectedPlayers = Object.values(state.players).filter((p) => p.connected);
        rooms.push({
          code: state.roomCode,
          hostName: state.players[state.hostId]?.username || 'Άγνωστος',
          playerCount: connectedPlayers.length,
          maxPlayers: 8,
          totalRounds: state.totalRounds,
          timePerCategory: state.timePerCategory,
        });
      }

      // Remove stale codes from the index
      for (const stale of staleCodes) {
        await removePublicRoom(stale);
      }

      return res.status(200).json(rooms);
    } catch (err) {
      logger.error('Error fetching public rooms:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/rooms/online-count — number of currently connected authenticated sockets.
  // Used by the public rooms screen to show social proof ("X players online now").
  router.get('/online-count', authMiddleware, async (_req: Request, res: Response) => {
    try {
      const count = io.engine.clientsCount;
      return res.status(200).json({ count });
    } catch {
      return res.status(200).json({ count: 0 });
    }
  });

  return router;
}
