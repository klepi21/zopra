import Redis from 'ioredis';
import logger from '../utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // needed for Bull
});

redis.on('connect', () => {
  logger.info('Connected to Redis server');
});

let loggedError = false;
redis.on('error', (err: any) => {
  if (!loggedError) {
    logger.warn(`Redis is offline/not running (code: ${err.code || 'UNKNOWN'}). Server will use in-memory room storage fallback.`);
    loggedError = true;
  }
});

export default redis;
