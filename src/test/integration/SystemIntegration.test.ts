import request from 'supertest';
import { createApp } from '../../app';
import { ServiceContainer } from '../../container/ServiceContainer';
import { SystemHealthMonitor } from '../../services/SystemHealthMonitor';
import { PerformanceMonitor } from '../../services/PerformanceMonitor';
import { initializeDatabase, closeDatabase } from '../../config/database';
import { initializeRedis, closeRedis } from '../../config/redis';
import { knex } from '../../config/database';
import { logger } from '../../utils/logger';
import { Express } from 'express';

describe('System Integration Tests', () => {
  let app: Express;
  let serviceContainer: ServiceContainer;
  let healthMonitor: SystemHealthMonitor;
  let performanceMonitor: PerformanceMonitor;

  beforeAll(async () => {
    // Initialize infrastructure
    await initializeDatabase();
    await initializeRedis();

    // Initialize service container
    serviceContainer = ServiceContainer.getInstance();
    await serviceContainer.initialize();

    // Initialize monitoring services
    healthMonitor = SystemHealthMonitor.getInstance();
    performanceMonitor = PerformanceMonitor.getInstance();

    // Create app
    app = createApp();

    logger.info('Integration test setup completed');
  }, 30000);

  afterAll(async () => {
    // Cleanup in reverse order
    healthMonitor.stop();
    performanceMonitor.shutdown();
    await serviceContainer.shutdown();
    await closeDatabase();
    await closeRedis();

    logger.info('Integration test cleanup completed');
  }, 30000);

  describe('System Health and Monitoring', () => {
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

    test('should return performance metrics', async () => {
      const metrics = await performanceMonitor.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(metrics.requestMetrics).toBeDefined();
      expect(metrics.systemMetrics).toBeDefined();
      expect(metrics.streamingMetrics).toBeDefined();
      expect(metrics.thresholds).toBeDefined();
    });

    test('should handle health check endpoint', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeGreaterThan(0);
    });
  });

  describe('Service Container Integration', () => {
    test('should have all services initialized', () => {
      const services = serviceContainer.getAllServices();
      
      expect(services.channelManager).toBeDefined();
      expect(services.streamManager).toBeDefined();
      expect(services.playoutEngine).toBeDefined();
      expect(services.analyticsEngine).toBeDefined();
      expect(services.monetizationEngine).toBeDefined();
      expect(services.aiEngine).toBeDefined();
      expect(services.distributionEngine).toBeDefined();
      expect(services.interactionEngine).toBeDefined();
      expect(services.concurrentOperationsManager).toBeDefined();
      expect(services.previewPlayer).toBeDefined();
      expect(services.realtimeNotificationService).toBeDefined();
      expect(services.errorRecoveryService).toBeDefined();
    });

    test('should retrieve individual services', () => {
      const channelManager = serviceContainer.getService('channelManager');
      expect(channelManager).toBeDefined();
      expect(typeof channelManager.createChannel).toBe('function');

      const analyticsEngine = serviceContainer.getService('analyticsEngine');
      expect(analyticsEngine).toBeDefined();
      expect(typeof analyticsEngine.trackViewerEvent).toBe('function');
    });
  });

  describe('Complete Channel Workflow', () => {
    let channelId: string;
    let clientId: string;

    beforeAll(async () => {
      // Create a test client subscription
      const [subscription] = await knex('client_subscriptions').insert({
        client_id: 'test-client-integration',
        subscription_plan_id: 1,
        status: 'active',
        start_date: new Date(),
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }).returning('client_id');
      
      clientId = subscription.client_id;
    });

    afterAll(async () => {
      // Cleanup test data
      if (channelId) {
        await knex('channels').where('id', channelId).del();
      }
      await knex('client_subscriptions').where('client_id', clientId).del();
    });

    test('should create a channel through API', async () => {
      const channelData = {
        name: 'Integration Test Channel',
        clientId: clientId,
        resolution: '1920x1080',
        fallbackVideo: '/app/media/fallback/default_fallback.mp4',
        hlsEnabled: true,
        rtmpDestinations: []
      };

      const response = await request(app)
        .post('/api/channels')
        .send(channelData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.name).toBe(channelData.name);
      expect(response.body.data.status).toBe('STOPPED');
      
      channelId = response.body.data.id;
    });

    test('should start a channel and track analytics', async () => {
      const response = await request(app)
        .post(`/api/channels/${channelId}/start`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Wait a moment for async operations
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check channel status
      const statusResponse = await request(app)
        .get(`/api/channels/${channelId}`)
        .expect(200);

      expect(['STARTING', 'LIVE']).toContain(statusResponse.body.data.status);
    });

    test('should track viewer analytics', async () => {
      // Simulate viewer joining
      const viewerEvent = {
        channelId: channelId,
        viewerId: 'test-viewer-1',
        event: 'join',
        timestamp: new Date(),
        metadata: {
          userAgent: 'Test Browser',
          ipAddress: '127.0.0.1'
        }
      };

      const response = await request(app)
        .post('/api/analytics/events')
        .send(viewerEvent)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Get analytics data
      const analyticsResponse = await request(app)
        .get(`/api/analytics/channels/${channelId}/realtime`)
        .expect(200);

      expect(analyticsResponse.body.success).toBe(true);
      expect(analyticsResponse.body.data).toBeDefined();
    });

    test('should handle monetization events', async () => {
      const adEvent = {
        channelId: channelId,
        adId: 'test-ad-1',
        type: 'impression',
        revenue: 0.05,
        timestamp: new Date()
      };

      const response = await request(app)
        .post('/api/monetization/events')
        .send(adEvent)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should handle interaction events', async () => {
      const chatMessage = {
        channelId: channelId,
        userId: 'test-user-1',
        message: 'Hello from integration test!',
        timestamp: new Date()
      };

      const response = await request(app)
        .post('/api/interaction/chat')
        .send(chatMessage)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should stop a channel', async () => {
      const response = await request(app)
        .post(`/api/channels/${channelId}/stop`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Wait a moment for async operations
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check channel status
      const statusResponse = await request(app)
        .get(`/api/channels/${channelId}`)
        .expect(200);

      expect(statusResponse.body.data.status).toBe('STOPPED');
    });
  });

  describe('Multi-Channel Concurrent Operations', () => {
    const channelIds: string[] = [];
    let clientId: string;

    beforeAll(async () => {
      // Create a test client subscription with higher limits
      const [subscription] = await knex('client_subscriptions').insert({
        client_id: 'test-client-concurrent',
        subscription_plan_id: 2, // Assuming plan 2 has higher limits
        status: 'active',
        start_date: new Date(),
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }).returning('client_id');
      
      clientId = subscription.client_id;
    });

    afterAll(async () => {
      // Cleanup test data
      if (channelIds.length > 0) {
        await knex('channels').whereIn('id', channelIds).del();
      }
      await knex('client_subscriptions').where('client_id', clientId).del();
    });

    test('should create multiple channels concurrently', async () => {
      const channelPromises = Array.from({ length: 3 }, (_, i) => {
        const channelData = {
          name: `Concurrent Test Channel ${i + 1}`,
          clientId: clientId,
          resolution: '1280x720',
          fallbackVideo: '/app/media/fallback/default_fallback.mp4',
          hlsEnabled: true,
          rtmpDestinations: []
        };

        return request(app)
          .post('/api/channels')
          .send(channelData);
      });

      const responses = await Promise.all(channelPromises);
      
      responses.forEach((response: any) => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        channelIds.push(response.body.data.id);
      });

      expect(channelIds).toHaveLength(3);
    });

    test('should handle concurrent operations', async () => {
      const bulkOperation = {
        channelIds: channelIds,
        operation: 'start'
      };

      const response = await request(app)
        .post('/api/concurrent/bulk-operation')
        .send(bulkOperation)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(channelIds.length);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle invalid channel operations gracefully', async () => {
      const response = await request(app)
        .post('/api/channels/invalid-channel-id/start')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should handle system errors gracefully', async () => {
      const response = await request(app)
        .get('/api/system/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overall).toMatch(/^(healthy|degraded|unhealthy)$/);
    });

    test('should handle performance monitoring', async () => {
      const response = await request(app)
        .get('/api/system/performance')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requestMetrics).toBeDefined();
      expect(response.body.data.systemMetrics).toBeDefined();
    });
  });

  describe('Real-time Features', () => {
    test('should handle WebSocket connections', (done) => {
      // This is a simplified test - in a real scenario you'd use a WebSocket client
      request(app)
        .get('/preview/test-channel')
        .expect(200)
        .end((err: any, res: any) => {
          if (err) return done(err);
          expect(res.text).toContain('WebSocket');
          done();
        });
    });

    test('should serve dashboard interface', async () => {
      const response = await request(app)
        .get('/dashboard')
        .expect(200);

      expect(response.text).toContain('Channel Management Dashboard');
    });
  });
});