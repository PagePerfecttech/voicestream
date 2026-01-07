import { ServiceContainer } from '../../container/ServiceContainer';
import { SystemHealthMonitor } from '../../services/SystemHealthMonitor';
import { PerformanceMonitor } from '../../services/PerformanceMonitor';
import { initializeDatabase, closeDatabase } from '../../config/database';
import { initializeRedis, closeRedis } from '../../config/redis';
import { logger } from '../../utils/logger';

describe('Basic Integration Tests', () => {
  let serviceContainer: ServiceContainer;
  let healthMonitor: SystemHealthMonitor;
  let performanceMonitor: PerformanceMonitor;

  beforeAll(async () => {
    try {
      // Initialize infrastructure
      await initializeDatabase();
      await initializeRedis();

      // Initialize service container
      serviceContainer = ServiceContainer.getInstance();
      await serviceContainer.initialize();

      // Initialize monitoring services
      healthMonitor = SystemHealthMonitor.getInstance();
      performanceMonitor = PerformanceMonitor.getInstance();

      logger.info('Basic integration test setup completed');
    } catch (error) {
      logger.error('Failed to setup integration tests:', error);
      throw error;
    }
  }, 30000);

  afterAll(async () => {
    try {
      // Cleanup in reverse order
      healthMonitor.stop();
      performanceMonitor.shutdown();
      await serviceContainer.shutdown();
      await closeDatabase();
      await closeRedis();

      logger.info('Basic integration test cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup integration tests:', error);
    }
  }, 30000);

  describe('Service Container', () => {
    test('should initialize all core services', () => {
      const services = serviceContainer.getAllServices();
      
      expect(services.channelManager).toBeDefined();
      expect(services.streamManager).toBeDefined();
      expect(services.playoutEngine).toBeDefined();
      expect(services.analyticsEngine).toBeDefined();
      expect(services.aiEngine).toBeDefined();
      expect(services.distributionEngine).toBeDefined();
      expect(services.interactionEngine).toBeDefined();
      expect(services.concurrentOperationsManager).toBeDefined();
      expect(services.realtimeNotificationService).toBeDefined();
      expect(services.errorRecoveryService).toBeDefined();
    });

    test('should retrieve individual services', () => {
      const channelManager = serviceContainer.getService('channelManager');
      expect(channelManager).toBeDefined();

      const analyticsEngine = serviceContainer.getService('analyticsEngine');
      expect(analyticsEngine).toBeDefined();
    });

    test('should throw error for non-existent service', () => {
      expect(() => {
        // @ts-ignore - intentionally testing invalid service name
        serviceContainer.getService('nonExistentService');
      }).toThrow();
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
      // Test starting monitoring
      expect(() => healthMonitor.start()).not.toThrow();
      
      // Test stopping monitoring
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

  describe('Database and Redis Integration', () => {
    test('should have working database connection', async () => {
      const { knex } = await import('../../config/database');
      const result = await knex.raw('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);
    });

    test('should have working Redis connection', async () => {
      const { redisClient } = await import('../../config/redis');
      const result = await redisClient.ping();
      expect(result).toBe('PONG');
    });
  });

  describe('Error Handling', () => {
    test('should handle service container errors gracefully', async () => {
      // Test getting service before initialization
      const newContainer = new (ServiceContainer as any)();
      expect(() => newContainer.getService('channelManager')).toThrow();
    });

    test('should handle health monitor errors gracefully', async () => {
      // This should not throw even if some health checks fail
      const health = await healthMonitor.getSystemHealth();
      expect(health).toBeDefined();
    });
  });

  describe('Service Lifecycle', () => {
    test('should handle service container shutdown', async () => {
      // Create a new container for this test
      const testContainer = new (ServiceContainer as any)();
      await testContainer.initialize();
      
      // Should shutdown without errors
      await expect(testContainer.shutdown()).resolves.not.toThrow();
    });

    test('should handle performance monitor shutdown', () => {
      const testMonitor = PerformanceMonitor.getInstance();
      expect(() => testMonitor.shutdown()).not.toThrow();
    });
  });
});