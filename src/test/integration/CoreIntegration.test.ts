import { initializeDatabase, closeDatabase } from '../../config/database';
import { initializeRedis, closeRedis } from '../../config/redis';
import { SystemHealthMonitor } from '../../services/SystemHealthMonitor';
import { PerformanceMonitor } from '../../services/PerformanceMonitor';
import { logger } from '../../utils/logger';

describe('Core Integration Tests', () => {
  let healthMonitor: SystemHealthMonitor;
  let performanceMonitor: PerformanceMonitor;

  beforeAll(async () => {
    try {
      // Initialize infrastructure
      await initializeDatabase();
      await initializeRedis();

      // Initialize monitoring services
      healthMonitor = SystemHealthMonitor.getInstance();
      performanceMonitor = PerformanceMonitor.getInstance();

      logger.info('Core integration test setup completed');
    } catch (error) {
      logger.error('Failed to setup core integration tests:', error);
      throw error;
    }
  }, 30000);

  afterAll(async () => {
    try {
      // Cleanup
      healthMonitor.stop();
      performanceMonitor.shutdown();
      await closeDatabase();
      await closeRedis();

      logger.info('Core integration test cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup core integration tests:', error);
    }
  }, 30000);

  describe('Database Integration', () => {
    test('should connect to database successfully', async () => {
      const { knex } = await import('../../config/database');
      const result = await knex.raw('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);
    });

    test('should run basic database queries', async () => {
      const { knex } = await import('../../config/database');
      
      // Test that we can query the subscription plans table
      const plans = await knex('subscription_plans').select('*').limit(1);
      expect(Array.isArray(plans)).toBe(true);
    });
  });

  describe('Redis Integration', () => {
    test('should connect to Redis successfully', async () => {
      const { redisClient } = await import('../../config/redis');
      const result = await redisClient.ping();
      expect(result).toBe('PONG');
    });

    test('should set and get values from Redis', async () => {
      const { redisClient } = await import('../../config/redis');
      
      const testKey = 'integration-test-key';
      const testValue = 'integration-test-value';
      
      await redisClient.set(testKey, testValue);
      const retrievedValue = await redisClient.get(testKey);
      
      expect(retrievedValue).toBe(testValue);
      
      // Cleanup
      await redisClient.del(testKey);
    });
  });

  describe('System Health Monitor', () => {
    test('should return system health status', async () => {
      const health = await healthMonitor.getSystemHealth();
      
      expect(health).toBeDefined();
      expect(health.overall).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.uptime).toBeGreaterThan(0);
      expect(Array.isArray(health.services)).toBe(true);
      expect(health.system).toBeDefined();
      expect(health.system.cpu).toBeGreaterThanOrEqual(0);
      expect(health.system.memory.total).toBeGreaterThan(0);
    });

    test('should start and stop monitoring', () => {
      expect(() => healthMonitor.start()).not.toThrow();
      expect(() => healthMonitor.stop()).not.toThrow();
    });
  });

  describe('Performance Monitor', () => {
    test('should return performance metrics', async () => {
      const metrics = await performanceMonitor.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(metrics.requestMetrics).toBeDefined();
      expect(metrics.systemMetrics).toBeDefined();
      expect(metrics.streamingMetrics).toBeDefined();
      expect(metrics.thresholds).toBeDefined();
    });

    test('should record request metrics', () => {
      const testMetric = {
        method: 'GET',
        path: '/test',
        statusCode: 200,
        responseTime: 100,
        timestamp: new Date(),
        userAgent: 'Test Agent',
        ip: '127.0.0.1'
      };

      expect(() => performanceMonitor.recordRequest(testMetric)).not.toThrow();
    });

    test('should provide express middleware', () => {
      const middleware = performanceMonitor.getExpressMiddleware();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('Infrastructure Health', () => {
    test('should have healthy database connection', async () => {
      const health = await healthMonitor.getSystemHealth();
      const dbService = health.services.find(s => s.service === 'database');
      
      expect(dbService).toBeDefined();
      expect(dbService?.status).toBe('healthy');
    });

    test('should have healthy Redis connection', async () => {
      const health = await healthMonitor.getSystemHealth();
      const redisService = health.services.find(s => s.service === 'redis');
      
      expect(redisService).toBeDefined();
      expect(redisService?.status).toBe('healthy');
    });
  });

  describe('System Metrics', () => {
    test('should collect system performance metrics', async () => {
      const metrics = await performanceMonitor.getMetrics();
      
      expect(metrics.systemMetrics.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.systemMetrics.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.systemMetrics.memoryUsage).toBeLessThanOrEqual(100);
    });

    test('should track streaming metrics', async () => {
      const metrics = await performanceMonitor.getMetrics();
      
      expect(metrics.streamingMetrics.activeChannels).toBeGreaterThanOrEqual(0);
      expect(metrics.streamingMetrics.totalViewers).toBeGreaterThanOrEqual(0);
      expect(metrics.streamingMetrics.averageBitrate).toBeGreaterThanOrEqual(0);
      expect(metrics.streamingMetrics.streamErrors).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle health check errors gracefully', async () => {
      // This should not throw even if some health checks fail
      const health = await healthMonitor.getSystemHealth();
      expect(health).toBeDefined();
      expect(health.overall).toBeDefined();
    });

    test('should handle performance monitoring errors gracefully', async () => {
      // This should not throw even if some metrics fail to collect
      const metrics = await performanceMonitor.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.timestamp).toBeDefined();
    });
  });
});