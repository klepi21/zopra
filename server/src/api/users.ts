import { Router, Request, Response } from 'express';
import { supabase } from '../db/supabase';
import { authMiddleware, clerkClient } from '../middleware/authMiddleware';
import logger from '../utils/logger';

const router = Router();

// ─── Username validation ──────────────────────────────────────────────────────

// Allow Greek (including extended/accented), Latin, digits, underscores, spaces.
const USERNAME_REGEX = /^[a-zA-Z0-9_Ͱ-Ͽἀ-῿\s]{2,20}$/;

const BLOCKED_WORDS = ['admin', 'administrator', 'moderator', 'support', 'zopra'];

function validateUsername(username: string): string | null {
  if (!USERNAME_REGEX.test(username)) {
    return 'Το όνομα χρήστη επιτρέπει μόνο γράμματα, αριθμούς και κάτω παύλα (2–20 χαρακτήρες)';
  }
  const lower = username.toLowerCase();
  if (BLOCKED_WORDS.some((w) => lower.includes(w))) {
    return 'Αυτό το όνομα χρήστη δεν επιτρέπεται';
  }
  return null;
}

// ─── In-memory caches ────────────────────────────────────────────────────────

// Leaderboard: full sorted list cached for 3 minutes.
// Supabase .order() doesn't support formula expressions, so we fetch the top
// 500 users by total_score, sort by win-rate in Node, and paginate from the
// cached result. This also removes the per-page DB hit on every scroll.
const LEADERBOARD_TTL = 3 * 60 * 1000;
let leaderboardCache: { data: any[]; expiresAt: number } | null = null;

// Global stats: two COUNT(*) queries on large tables — cache for 5 minutes.
const GLOBAL_STATS_TTL = 5 * 60 * 1000;
let globalStatsCache: { data: { games: number; words: number }; expiresAt: number } | null = null;

// GET /api/users/leaderboard - Get top players sorted by win-rate then total_score.
// Uses a 3-minute in-memory cache of the full sorted list to avoid repeated DB hits
// and to ensure pagination is consistent (all pages come from the same sorted snapshot).
router.get('/leaderboard', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const now = Date.now();

    if (!leaderboardCache || now > leaderboardCache.expiresAt) {
      const { data, error } = await supabase
        .from('users')
        .select('id, clerk_id, username, avatar_url, total_score, games_played, wins')
        .order('total_score', { ascending: false })
        .limit(500);

      if (error) {
        logger.error('Error fetching global leaderboard:', error);
        return res.status(500).json({ error: 'Database error fetching leaderboard' });
      }

      const sorted = (data || []).sort((a, b) => {
        const aRate = (a.games_played ?? 0) > 0 ? (a.wins ?? 0) / (a.games_played ?? 1) : 0;
        const bRate = (b.games_played ?? 0) > 0 ? (b.wins ?? 0) / (b.games_played ?? 1) : 0;
        if (bRate !== aRate) return bRate - aRate;
        return (b.total_score ?? 0) - (a.total_score ?? 0);
      });

      leaderboardCache = { data: sorted, expiresAt: now + LEADERBOARD_TTL };
    }

    return res.status(200).json(leaderboardCache.data.slice(offset, offset + limit));
  } catch (error) {
    logger.error('Server error fetching global leaderboard:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/global-stats - Aggregate stats shown on the home screen.
// Counts are stable enough to cache for 5 minutes — avoids two COUNT(*) hits
// on large tables every time the home screen mounts.
router.get('/global-stats', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const now = Date.now();

    if (!globalStatsCache || now > globalStatsCache.expiresAt) {
      const [gamesResult, wordsResult] = await Promise.all([
        supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('status', 'finished'),
        supabase.from('answers').select('id', { count: 'exact', head: true }).eq('is_valid', true),
      ]);

      globalStatsCache = {
        data: { games: gamesResult.count ?? 0, words: wordsResult.count ?? 0 },
        expiresAt: now + GLOBAL_STATS_TTL,
      };
    }

    return res.status(200).json(globalStatsCache.data);
  } catch (err) {
    logger.error('Error fetching global stats:', err);
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

    if (user) {
      return res.status(200).json(user);
    }

    // No row for this clerk_id — this can happen when a returning user re-authenticates
    // against a different Clerk instance (e.g. dev -> production migration), which issues
    // a brand new clerk_id for the same person. Try to recover their old profile by email
    // before treating them as a first-time user.
    const clerkUser = await clerkClient.users.getUser(clerkId).catch(() => null);
    const email = clerkUser?.emailAddresses?.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress;

    if (email) {
      const { data: legacyUser, error: legacyError } = await supabase
        .from('users')
        .select('*')
        .eq('legacy_email', email)
        .maybeSingle();

      if (!legacyError && legacyUser) {
        const { data: healedUser, error: healError } = await supabase
          .from('users')
          .update({ clerk_id: clerkId })
          .eq('id', legacyUser.id)
          .select()
          .single();

        if (!healError && healedUser) {
          logger.info(`Healed legacy profile for ${email}: old clerk_id replaced with ${clerkId}`);
          return res.status(200).json(healedUser);
        }
        logger.error(`Failed to heal legacy profile for ${email}:`, healError);
      }
    }

    return res.status(404).json({ error: 'User profile not found' });
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

  const usernameError = validateUsername(username.trim());
  if (usernameError) {
    return res.status(400).json({ error: usernameError });
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

    // Record the email on file so any future Clerk instance change can be self-healed
    // the same way GET /me recovers migrated profiles, instead of repeating a manual export.
    const clerkUser = await clerkClient.users.getUser(clerkId).catch(() => null);
    const email = clerkUser?.emailAddresses?.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress;

    // Insert user, or update if user was partially created via webhook
    const { data: newUser, error: upsertError } = await supabase
      .from('users')
      .upsert({
        clerk_id: clerkId,
        username: username.trim(),
        avatar_url: avatar_url || null,
        ...(email ? { legacy_email: email } : {}),
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

    // 3 + 4. Fetch room details and all room_players in parallel — both only need roomIds.
    const [
      { data: rooms, error: roomsError },
      { data: allRoomPlayers, error: allRpError },
    ] = await Promise.all([
      supabase
        .from('rooms')
        .select('id, code, status, round_count, current_round, finished_at')
        .in('id', roomIds),
      supabase
        .from('room_players')
        .select('room_id, score, user_id')
        .in('room_id', roomIds),
    ]);

    if (roomsError || !rooms) {
      logger.error(`Error fetching rooms:`, roomsError);
      return res.status(500).json({ error: 'Database error fetching rooms' });
    }

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

  const usernameError = validateUsername(trimmed);
  if (usernameError) {
    return res.status(400).json({ error: usernameError });
  }

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

// PATCH /api/users/push-token - Register or clear a push notification token
router.patch('/push-token', authMiddleware, async (req: Request, res: Response) => {
  const clerkId = req.auth?.userId;
  const { push_token, notifications_enabled } = req.body;

  if (!clerkId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        push_token: push_token ?? null,
        notifications_enabled: notifications_enabled === true,
      })
      .eq('clerk_id', clerkId)
      .select()
      .single();

    if (error || !updatedUser) {
      logger.error('Error updating push token:', error);
      return res.status(500).json({ error: 'Failed to update push token' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error(`Server error updating push token for ${clerkId}:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
