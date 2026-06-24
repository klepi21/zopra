import redis from './redis';
import { RoomState } from '../types/game';
import logger from '../utils/logger';

const ROOM_KEY_PREFIX = 'room:';
const ROOM_TTL = 7200; // 2 hours in seconds

// In-memory fallback map if Redis is not connected or fails.
// memoryExpiry mirrors Redis TTL so stale rooms are evicted even without Redis.
const memoryRooms = new Map<string, string>();
const memoryExpiry = new Map<string, number>();
let isRedisConnected = process.env.NODE_ENV === 'test';

function isMemoryRoomExpired(key: string): boolean {
  const expiry = memoryExpiry.get(key);
  return expiry !== undefined && Date.now() > expiry;
}

function evictMemoryRoom(key: string) {
  memoryRooms.delete(key);
  memoryExpiry.delete(key);
}

redis.on('connect', () => {
  isRedisConnected = true;
});
redis.on('end', () => {
  isRedisConnected = false;
});
redis.on('error', () => {
  isRedisConnected = false;
});

export async function getRoomState(roomCode: string): Promise<RoomState | null> {
  const key = `${ROOM_KEY_PREFIX}${roomCode.toUpperCase()}`;
  try {
    if (isRedisConnected) {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as RoomState;
    }
  } catch (error) {
    logger.error(`Error getting room state from Redis for ${roomCode}`, error);
  }
  
  // Fallback to memory
  if (isMemoryRoomExpired(key)) { evictMemoryRoom(key); return null; }
  const data = memoryRooms.get(key);
  if (!data) return null;
  return JSON.parse(data) as RoomState;
}

export async function setRoomState(roomCode: string, state: RoomState): Promise<void> {
  const key = `${ROOM_KEY_PREFIX}${roomCode.toUpperCase()}`;
  const serialized = JSON.stringify(state);
  
  // Always update memory backup with TTL
  memoryRooms.set(key, serialized);
  memoryExpiry.set(key, Date.now() + ROOM_TTL * 1000);
  
  if (isRedisConnected) {
    try {
      await redis.setex(key, ROOM_TTL, serialized);
    } catch (error) {
      logger.error(`Error setting room state in Redis for ${roomCode}`, error);
    }
  }
}

export async function updateRoomState(
  roomCode: string,
  updateFn: (state: RoomState) => RoomState | Promise<RoomState>
): Promise<RoomState> {
  const key = `${ROOM_KEY_PREFIX}${roomCode.toUpperCase()}`;
  try {
    let state: RoomState | null = null;
    
    if (isRedisConnected) {
      try {
        const data = await redis.get(key);
        if (data) {
          state = JSON.parse(data) as RoomState;
        }
      } catch (e) {
        logger.error(`Error fetching room state from Redis for update: ${roomCode}`, e);
      }
    }
    
    // Fallback to memory if Redis fetch returned nothing or failed
    if (!state) {
      if (isMemoryRoomExpired(key)) { evictMemoryRoom(key); }
      const data = memoryRooms.get(key);
      if (!data) {
        throw new Error(`Room ${roomCode} not found in memory or Redis`);
      }
      state = JSON.parse(data) as RoomState;
    }
    
    const updatedState = await updateFn(state);
    const serialized = JSON.stringify(updatedState);
    memoryRooms.set(key, serialized);
    memoryExpiry.set(key, Date.now() + ROOM_TTL * 1000);
    
    if (isRedisConnected) {
      try {
        await redis.setex(key, ROOM_TTL, serialized);
      } catch (e) {
        logger.error(`Error saving updated room state to Redis for ${roomCode}`, e);
      }
    }
    
    return updatedState;
  } catch (error) {
    logger.error(`Error updating room state for ${roomCode}`, error);
    throw error;
  }
}

export async function deleteRoomState(roomCode: string): Promise<void> {
  const key = `${ROOM_KEY_PREFIX}${roomCode.toUpperCase()}`;
  evictMemoryRoom(key);
  
  if (isRedisConnected) {
    try {
      await redis.del(key);
    } catch (error) {
      logger.error(`Error deleting room state from Redis for ${roomCode}`, error);
    }
  }
}
