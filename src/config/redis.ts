import { createClient, RedisClientType } from 'redis';
import { config } from './index';

export let redisClient: RedisClientType;
export { redisClient as redis }; // Export as redis for compatibility

export async function initializeRedis(): Promise<void> {
  // Skip Redis in test environment if not explicitly required
  if (process.env.NODE_ENV === 'test' && !process.env.REDIS_REQUIRED) {
    console.log('⚠️ Skipping Redis initialization in test environment');
    return;
  }

  try {
    const redisConfig: any = {
      url: config.redis.url,
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        connectTimeout: 5000, // 5 second timeout
        lazyConnect: true, // Don't connect immediately
      },
    };
    
    if (config.redis.password) {
      redisConfig.password = config.redis.password;
    }
    
    redisClient = createClient(redisConfig);

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
      // In test environment, don't fail completely
      if (process.env.NODE_ENV === 'test') {
        console.warn('⚠️ Redis error in test environment, continuing...');
        return;
      }
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connection established');
    });

    redisClient.on('disconnect', () => {
      console.log('Redis connection disconnected');
    });

    // Try to connect with timeout
    const connectPromise = redisClient.connect();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
    });

    await Promise.race([connectPromise, timeoutPromise]);
    
    // Test Redis connection
    await redisClient.ping();
    console.log('✅ Redis connection tested successfully');
  } catch (error) {
    console.error('❌ Redis initialization failed:', error);
    
    // In test environment, don't fail completely - allow tests to run without Redis
    if (process.env.NODE_ENV === 'test') {
      console.warn('⚠️ Continuing tests without Redis connection');
      return;
    }
    
    throw error;
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.quit();
      console.log('✅ Redis connection closed');
    } catch (error) {
      console.warn('⚠️ Error closing Redis connection:', error);
    }
  }
}