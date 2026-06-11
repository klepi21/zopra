import redis from '../db/redis';
import { supabase } from '../db/supabase';
import logger from '../utils/logger';

// In-memory rate-limit fallback when Redis is unavailable
const inMemoryNotified = new Map<string, number>();

// Send a push notification to all opted-in users when a new public room opens.
// Rate-limited: max 2 notifications per user per 24 hours to avoid spam.
// This function is fire-and-forget — it swallows errors so room creation is never blocked.
export async function notifyPublicGameCreated(hostName: string, roomCode: string): Promise<void> {
  try {
    // Fetch opted-in users with a push token
    const { data: users, error } = await supabase
      .from('users')
      .select('id, push_token')
      .eq('notifications_enabled', true)
      .not('push_token', 'is', null);

    if (error || !users || users.length === 0) return;

    const tokensToNotify: string[] = [];

    for (const user of users) {
      if (!user.push_token) continue;

      const rateKey = `push_notified:${user.id}`;
      let count = 0;

      try {
        const val = await redis.get(rateKey);
        count = val ? parseInt(val, 10) : 0;
      } catch {
        // Redis down: check in-memory fallback
        const lastTime = inMemoryNotified.get(user.id);
        if (lastTime && Date.now() - lastTime < 86400000) {
          count = 2; // treat as already hit daily limit
        }
      }

      if (count >= 2) continue;

      tokensToNotify.push(user.push_token);

      // Increment counter; set 24h TTL on first increment
      try {
        const newCount = await redis.incr(rateKey);
        if (newCount === 1) await redis.expire(rateKey, 86400);
      } catch {
        inMemoryNotified.set(user.id, Date.now());
      }
    }

    if (tokensToNotify.length === 0) return;

    // Expo push API accepts batches of up to 100 tokens
    const batch = tokensToNotify.slice(0, 100).map((token) => ({
      to: token,
      sound: 'default',
      title: '🎮 Νέο δημόσιο παιχνίδι!',
      body: `${hostName} δημιούργησε ένα παιχνίδι — μπες τώρα!`,
      data: { roomCode },
    }));

    const response = await fetch('https://exp.host/--/push/v2/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      logger.warn(`Expo push API non-OK response: ${response.status}`);
    } else {
      logger.info(`Push notifications sent to ${tokensToNotify.length} users for room ${roomCode}`);
    }
  } catch (err) {
    // Non-fatal: game creation is not blocked by push failures
    logger.error('Failed to send push notifications:', err);
  }
}
