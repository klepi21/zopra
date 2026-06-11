import redis from './redis';
import logger from '../utils/logger';

const PUBLIC_ROOMS_KEY = 'public_rooms';

// In-memory fallback when Redis is unavailable
const inMemorySet = new Set<string>();

// Add a room code to the public rooms index
export async function addPublicRoom(code: string): Promise<void> {
  const upper = code.toUpperCase();
  inMemorySet.add(upper);
  try {
    await redis.sadd(PUBLIC_ROOMS_KEY, upper);
  } catch (err) {
    logger.error(`Failed to add public room ${upper} to Redis SET:`, err);
  }
}

// Remove a room code from the public rooms index
export async function removePublicRoom(code: string): Promise<void> {
  const upper = code.toUpperCase();
  inMemorySet.delete(upper);
  try {
    await redis.srem(PUBLIC_ROOMS_KEY, upper);
  } catch (err) {
    logger.error(`Failed to remove public room ${upper} from Redis SET:`, err);
  }
}

// Get all room codes currently listed as public
export async function getPublicRoomCodes(): Promise<string[]> {
  try {
    const members = await redis.smembers(PUBLIC_ROOMS_KEY);
    inMemorySet.clear();
    members.forEach((m) => inMemorySet.add(m));
    return members;
  } catch (err) {
    logger.error('Failed to get public rooms from Redis, using in-memory fallback:', err);
    return Array.from(inMemorySet);
  }
}
