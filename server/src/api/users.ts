import { Router, Request, Response } from 'express';
import { supabase } from '../db/supabase';
import { authMiddleware } from '../middleware/authMiddleware';
import logger from '../utils/logger';

const router = Router();

// GET /api/users/leaderboard - Get top players by total_score
router.get('/leaderboard', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { data: leaderboard, error } = await supabase
      .from('users')
      .select('id, clerk_id, username, avatar_url, total_score, games_played, wins')
      .order('total_score', { ascending: false })
      .limit(50);

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

export default router;
