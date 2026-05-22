import { Router, Request, Response } from 'express';
import { supabase } from '../db/supabase';
import { authMiddleware } from '../middleware/authMiddleware';
import logger from '../utils/logger';

const router = Router();

// GET /api/users/leaderboard - Get top players by total_score
router.get('/leaderboard', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const { data: leaderboard, error } = await supabase
      .from('users')
      .select('id, clerk_id, username, avatar_url, total_score, games_played, wins')
      .order('total_score', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Error fetching global leaderboard:', error);
      return res.status(500).json({ error: 'Database error fetching leaderboard' });
    }

    return res.status(200).json(leaderboard);
  } catch (error) {
    logger.error('Server error fetching global leaderboard:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/me - Get current user profile
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const clerkId = req.auth?.userId;

  if (!clerkId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', clerkId)
      .maybeSingle();

    if (error) {
      logger.error(`Error fetching user profile for ${clerkId}:`, error);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    return res.status(200).json(user);
  } catch (error) {
    logger.error(`Server error fetching user profile for ${clerkId}:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users - Create/Onboard new user profile
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  const clerkId = req.auth?.userId;
  const { username, avatar_url } = req.body;

  if (!clerkId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    // Check if username is already taken by a different user
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, clerk_id')
      .eq('username', username.trim())
      .maybeSingle();

    if (checkError) {
      logger.error('Error checking username uniqueness:', checkError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingUser && existingUser.clerk_id !== clerkId) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Insert user, or update if user was partially created via webhook
    const { data: newUser, error: upsertError } = await supabase
      .from('users')
      .upsert({
        clerk_id: clerkId,
        username: username.trim(),
        avatar_url: avatar_url || null,
      }, { onConflict: 'clerk_id' })
      .select()
      .single();

    if (upsertError) {
      logger.error('Error onboarding user:', upsertError);
      return res.status(500).json({ error: 'Database error creating profile' });
    }

    return res.status(201).json(newUser);
  } catch (error) {
    logger.error('Server error onboarding user:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/matches - Get recent match history for current user
router.get('/matches', authMiddleware, async (req: Request, res: Response) => {
  const clerkId = req.auth?.userId;

  if (!clerkId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Get user UUID from users table
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // 2. Fetch rooms this user participated in
    const { data: userRoomPlayers, error: rpError } = await supabase
      .from('room_players')
      .select('room_id, score, joined_at')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(10);

    if (rpError || !userRoomPlayers) {
      logger.error(`Error fetching user room_players for ${user.id}:`, rpError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (userRoomPlayers.length === 0) {
      return res.status(200).json([]);
    }

    const roomIds = userRoomPlayers.map((rp: any) => rp.room_id);

    // 3. Fetch room details
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, code, status, round_count, current_round, finished_at')
      .in('id', roomIds);

    if (roomsError || !rooms) {
      logger.error(`Error fetching rooms:`, roomsError);
      return res.status(500).json({ error: 'Database error fetching rooms' });
    }

    // 4. Fetch all room_players for those rooms with user info
    const { data: allRoomPlayers, error: allRpError } = await supabase
      .from('room_players')
      .select('room_id, score, user_id')
      .in('room_id', roomIds);

    if (allRpError) {
      logger.error(`Error fetching all room_players:`, allRpError);
      return res.status(500).json({ error: 'Database error fetching players' });
    }

    // Build lookup maps
    const roomMap: Record<string, any> = {};
    rooms.forEach((r: any) => { roomMap[r.id] = r; });

    const myScoreMap: Record<string, number> = {};
    const myJoinedAtMap: Record<string, string> = {};
    userRoomPlayers.forEach((rp: any) => {
      myScoreMap[rp.room_id] = rp.score || 0;
      myJoinedAtMap[rp.room_id] = rp.joined_at;
    });

    const roomPlayersMap: Record<string, any[]> = {};
    (allRoomPlayers || []).forEach((rp: any) => {
      if (!roomPlayersMap[rp.room_id]) roomPlayersMap[rp.room_id] = [];
      roomPlayersMap[rp.room_id].push(rp);
    });

    // 5. Build formatted matches
    const formattedMatches = roomIds.map((roomId: string) => {
      const room = roomMap[roomId];
      if (!room) return null;

      const myScore = myScoreMap[roomId] || 0;
      const joinedAt = myJoinedAtMap[roomId];
      const playersInRoom = (roomPlayersMap[roomId] || []).sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
      const playersCount = playersInRoom.length;

      // Find rank (1-indexed) — handle ties by finding first position >= myScore
      const rankIdx = playersInRoom.findIndex((p: any) => (p.score || 0) <= myScore);
      const rank = rankIdx !== -1 ? rankIdx + 1 : playersCount;

      return {
        room_id: room.id,
        code: room.code,
        status: room.status,
        round_count: room.round_count,
        current_round: room.current_round,
        finished_at: room.finished_at || joinedAt,
        myScore,
        playersCount,
        rank,
      };
    }).filter(Boolean);

    return res.status(200).json(formattedMatches);
  } catch (error) {
    logger.error(`Server error fetching matches for ${clerkId}:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/username - Update username for current user
router.patch('/username', authMiddleware, async (req: Request, res: Response) => {
  const clerkId = req.auth?.userId;
  const { username } = req.body;

  if (!clerkId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!username || typeof username !== 'string' || username.trim().length < 2) {
    return res.status(400).json({ error: 'Username must be at least 2 characters' });
  }

  const trimmed = username.trim();

  try {
    // Check if username is already taken by another user
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id, clerk_id')
      .eq('username', trimmed)
      .maybeSingle();

    if (checkError) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (existing && existing.clerk_id !== clerkId) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ username: trimmed })
      .eq('clerk_id', clerkId)
      .select()
      .single();

    if (updateError || !updatedUser) {
      logger.error('Error updating username:', updateError);
      return res.status(500).json({ error: 'Failed to update username' });
    }

    return res.status(200).json(updatedUser);
  } catch (error) {
    logger.error(`Server error updating username for ${clerkId}:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
