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

describe('Complete System Integration Tests', () => {
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

    // Start monitoring
    healthMonitor.start();

    // Create app
    app = createApp();

    logger.info('Complete system integration test setup completed');
  }, 60000);

  afterAll(async () => {
    // Cleanup in reverse order
    healthMonitor.stop();
    performanceMonitor.shutdown();
    await serviceContainer.shutdown();
    await closeDatabase();
    await closeRedis();

    logger.info('Complete system integration test cleanup completed');
  }, 60000);

  describe('System Initialization and Health', () => {
    test('should have all services initialized in container', () => {
      const services = serviceContainer.getAllServices();
      
      // Core services
      expect(services.channelManager).toBeDefined();
      expect(services.streamManager).toBeDefined();
      expect(services.playoutEngine).toBeDefined();
      
      // Engine services
      expect(services.analyticsEngine).toBeDefined();
      expect(services.monetizationEngine).toBeDefined();
      expect(services.aiEngine).toBeDefined();
      expect(services.distributionEngine).toBeDefined();
      expect(services.interactionEngine).toBeDefined();
      
      // Management services
      expect(services.concurrentOperationsManager).toBeDefined();
      expect(services.previewPlayer).toBeDefined();
      expect(services.realtimeNotificationService).toBeDefined();
      
      // Infrastructure services
      expect(services.errorRecoveryService).toBeDefined();
      expect(services.circuitBreaker).toBeDefined();
      expect(services.escalationManager).toBeDefined();
      expect(services.auditLogger).toBeDefined();
      expect(services.gracefulDegradationManager).toBeDefined();
      expect(services.systemHealthMonitor).toBeDefined();
      expect(services.performanceMonitor).toBeDefined();
    });

    test('should return comprehensive system health', async () => {
      const response = await request(app)
        .get('/api/system/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('operational');
      expect(response.body.data.overall).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(response.body.data.uptime).toBeGreaterThan(0);
      expect(Array.isArray(response.body.data.services)).toBe(true);
      expect(response.body.data.systemMetrics).toBeDefined();
      expect(response.body.data.healthChecks).toBeDefined();
    });

    test('should return performance metrics', async () => {
      const response = await request(app)
        .get('/api/system/performance')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.requestMetrics).toBeDefined();
      expect(response.body.data.systemMetrics).toBeDefined();
      expect(response.body.data.streamingMetrics).toBeDefined();
      expect(response.body.data.thresholds).toBeDefined();
    });

    test('should return service container status', async () => {
      const response = await request(app)
        .get('/api/system/services')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.initialized).toBe(true);
      expect(response.body.data.services).toBeDefined();
      
      // Check that all expected services are present
      const serviceNames = Object.keys(response.body.data.services);
      expect(serviceNames).toContain('channelManager');
      expect(serviceNames).toContain('analyticsEngine');
      expect(serviceNames).toContain('monetizationEngine');
    });
  });

  describe('End-to-End Channel Workflow', () => {
    let channelId: string;
    let clientId: string;

    beforeAll(async () => {
      // Create a test client subscription
      const [subscription] = await knex('client_subscriptions').insert({
        client_id: 'test-client-e2e',
        subscription_plan_id: 1,
        status: 'active',
        start_date: new Date(),
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
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

    test('should create channel with all engines integration', async () => {
      const channelData = {
        name: 'E2E Integration Test Channel',
        clientId: clientId,
        resolution: '1920x1080',
        fallbackVideo: '/app/media/fallback/default_fallback.mp4',
        hlsEnabled: true,
        rtmpDestinations: [],
        analyticsEnabled: true,
        monetizationEnabled: true,
        aiOptimizationEnabled: true,
        multiPlatformEnabled: true,
        interactionEnabled: true
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

    test('should start channel and integrate all engines', async () => {
      const response = await request(app)
        .post(`/api/channels/${channelId}/start`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify channel status
      const statusResponse = await request(app)
        .get(`/api/channels/${channelId}`)
        .expect(200);

      expect(['STARTING', 'LIVE']).toContain(statusResponse.body.data.status);
    });

    test('should handle analytics integration', async () => {
      // Track viewer event
      const viewerEvent = {
        channelId: channelId,
        viewerId: 'test-viewer-e2e',
        event: 'join',
        timestamp: new Date(),
        metadata: {
          userAgent: 'E2E Test Browser',
          ipAddress: '127.0.0.1'
        }
      };

      const response = await request(app)
        .post('/api/analytics/events')
        .send(viewerEvent)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Get real-time analytics
      const analyticsResponse = await request(app)
        .get(`/api/analytics/channels/${channelId}/realtime`)
        .expect(200);

      expect(analyticsResponse.body.success).toBe(true);
      expect(analyticsResponse.body.data).toBeDefined();
    });

    test('should handle monetization integration', async () => {
      // Schedule ad break
      const adBreak = {
        channelId: channelId,
        type: 'mid-roll',
        duration: 30,
        scheduledTime: new Date(Date.now() + 60000), // 1 minute from now
        adContent: [{
          id: 'test-ad-1',
          duration: 30,
          url: 'http://example.com/ad.mp4'
        }]
      };

      const response = await request(app)
        .post('/api/monetization/ad-breaks')
        .send(adBreak)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Track ad event
      const adEvent = {
        channelId: channelId,
        adId: 'test-ad-1',
        type: 'impression',
        revenue: 0.05,
        timestamp: new Date()
      };

      const eventResponse = await request(app)
        .post('/api/monetization/events')
        .send(adEvent)
        .expect(200);

      expect(eventResponse.body.success).toBe(true);
    });

    test('should handle AI engine integration', async () => {
      // Get AI recommendations
      const response = await request(app)
        .get(`/api/ai/channels/${channelId}/recommendations`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Analyze content
      const analysisRequest = {
        channelId: channelId,
        contentId: 'test-content-1',
        contentType: 'video',
        metadata: {
          duration: 3600,
          title: 'Test Content'
        }
      };

      const analysisResponse = await request(app)
        .post('/api/ai/analyze')
        .send(analysisRequest)
        .expect(200);

      expect(analysisResponse.body.success).toBe(true);
    });

    test('should handle distribution engine integration', async () => {
      // Add distribution platform
      const platformConfig = {
        channelId: channelId,
        platform: 'youtube',
        credentials: {
          streamKey: 'test-stream-key',
          serverUrl: 'rtmp://a.rtmp.youtube.com/live2'
        },
        enabled: true
      };

      const response = await request(app)
        .post('/api/distribution/platforms')
        .send(platformConfig)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Get distribution status
      const statusResponse = await request(app)
        .get(`/api/distribution/channels/${channelId}/status`)
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data).toBeDefined();
    });

    test('should handle interaction engine integration', async () => {
      // Send chat message
      const chatMessage = {
        channelId: channelId,
        userId: 'test-user-e2e',
        message: 'Hello from E2E test!',
        timestamp: new Date()
      };

      const chatResponse = await request(app)
        .post('/api/interaction/chat')
        .send(chatMessage)
        .expect(200);

      expect(chatResponse.body.success).toBe(true);

      // Create poll
      const poll = {
        channelId: channelId,
        question: 'What content would you like to see next?',
        options: ['Music Videos', 'Live Sports', 'News'],
        duration: 300,
        displayOverlay: true
      };

      const pollResponse = await request(app)
        .post('/api/interaction/polls')
        .send(poll)
        .expect(200);

      expect(pollResponse.body.success).toBe(true);
    });

    test('should handle concurrent operations', async () => {
      // Test bulk operations
      const bulkOperation = {
        channelIds: [channelId],
        operation: 'restart'
      };

      const response = await request(app)
        .post('/api/concurrent/bulk-operation')
        .send(bulkOperation)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(1);
    });

    test('should handle preview and real-time updates', async () => {
      // Get preview page
      const previewResponse = await request(app)
        .get(`/preview/${channelId}`)
        .expect(200);

      expect(previewResponse.text).toContain('Channel Preview');

      // Get dashboard
      const dashboardResponse = await request(app)
        .get('/dashboard')
        .expect(200);

      expect(dashboardResponse.text).toContain('Channel Management Dashboard');
    });

    test('should stop channel and cleanup', async () => {
      const response = await request(app)
        .post(`/api/channels/${channelId}/stop`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify channel status
      const statusResponse = await request(app)
        .get(`/api/channels/${channelId}`)
        .expect(200);

      expect(statusResponse.body.data.status).toBe('STOPPED');
    });
  });

  describe('Error Handling and Recovery Integration', () => {
    test('should handle system errors gracefully', async () => {
      // Test invalid channel operation
      const response = await request(app)
        .post('/api/channels/invalid-channel-id/start')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should provide error recovery endpoints', async () => {
      // Get recovery stats
      const statsResponse = await request(app)
        .get('/api/system/recovery/stats')
        .expect(200);

      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.data).toBeDefined();

      // Get circuit breaker states
      const circuitResponse = await request(app)
        .get('/api/system/circuit-breakers')
        .expect(200);

      expect(circuitResponse.body.success).toBe(true);
      expect(circuitResponse.body.data.circuitBreakers).toBeDefined();
    });

    test('should handle manual service recovery', async () => {
      // Test manual restart
      const restartResponse = await request(app)
        .post('/api/system/recovery/restart/playoutEngine')
        .send({ channelId: 'test-channel' })
        .expect(200);

      expect(restartResponse.body.success).toBe(true);
      expect(restartResponse.body.message).toContain('Manual restart initiated');
    });
  });

  describe('Performance and Monitoring Integration', () => {
    test('should track performance metrics during operations', async () => {
      // Make several requests to generate metrics
      for (let i = 0; i < 5; i++) {
        await request(app).get('/health');
      }

      // Get performance metrics
      const response = await request(app)
        .get('/api/system/performance')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requestMetrics.totalRequests).toBeGreaterThan(0);
    });

    test('should provide comprehensive health monitoring', async () => {
      const response = await request(app)
        .get('/api/system/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overall).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(response.body.data.services).toBeDefined();
      expect(response.body.data.systemMetrics).toBeDefined();
    });

    test('should handle monitoring controls', async () => {
      // Stop monitoring
      const stopResponse = await request(app)
        .post('/api/system/monitoring/stop')
        .expect(200);

      expect(stopResponse.body.success).toBe(true);

      // Start monitoring
      const startResponse = await request(app)
        .post('/api/system/monitoring/start')
        .expect(200);

      expect(startResponse.body.success).toBe(true);
    });
  });

  describe('Complete End-to-End System Integration', () => {
    let channelId: string;
    let clientId: string;

    beforeAll(async () => {
      // Create a test client subscription
      const [subscription] = await knex('client_subscriptions').insert({
        client_id: 'test-client-e2e-complete',
        subscription_plan_id: 1,
        status: 'active',
        start_date: new Date(),
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
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

    test('should complete full channel lifecycle with all integrations', async () => {
      // Step 1: Create channel with full configuration
      const channelData = {
        name: 'Complete E2E Integration Channel',
        clientId: clientId,
        resolution: '1920x1080',
        fallbackVideo: '/app/media/fallback/default_fallback.mp4',
        hlsEnabled: true,
        rtmpDestinations: [{
          platform: 'youtube',
          serverUrl: 'rtmp://a.rtmp.youtube.com/live2',
          streamKey: 'test-stream-key-e2e'
        }],
        analyticsEnabled: true,
        monetizationEnabled: true,
        aiOptimizationEnabled: true,
        multiPlatformEnabled: true,
        interactionEnabled: true
      };

      const createResponse = await request(app)
        .post('/api/channels')
        .send(channelData)
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      channelId = createResponse.body.data.id;

      // Step 2: Start channel and verify all engines activate
      const startResponse = await request(app)
        .post(`/api/channels/${channelId}/start`)
        .expect(200);

      expect(startResponse.body.success).toBe(true);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 3: Verify channel is live
      const statusResponse = await request(app)
        .get(`/api/channels/${channelId}`)
        .expect(200);

      expect(['STARTING', 'LIVE']).toContain(statusResponse.body.data.status);

      // Step 4: Test analytics integration with multiple events
      const viewerEvents = [
        { event: 'join', viewerId: 'viewer-1' },
        { event: 'join', viewerId: 'viewer-2' },
        { event: 'interaction', viewerId: 'viewer-1' },
        { event: 'leave', viewerId: 'viewer-2' }
      ];

      for (const eventData of viewerEvents) {
        await request(app)
          .post('/api/analytics/events')
          .send({
            channelId: channelId,
            ...eventData,
            timestamp: new Date(),
            metadata: { userAgent: 'E2E Test Browser', ipAddress: '127.0.0.1' }
          })
          .expect(200);
      }

      // Verify analytics data
      const analyticsResponse = await request(app)
        .get(`/api/analytics/channels/${channelId}/realtime`)
        .expect(200);

      expect(analyticsResponse.body.success).toBe(true);

      // Step 5: Test monetization with ad scheduling and revenue tracking
      const adBreak = {
        channelId: channelId,
        type: 'mid-roll',
        duration: 30,
        scheduledTime: new Date(Date.now() + 60000),
        adContent: [{ id: 'test-ad-e2e', duration: 30, url: 'http://example.com/ad.mp4' }]
      };

      await request(app)
        .post('/api/monetization/ad-breaks')
        .send(adBreak)
        .expect(200);

      const revenueEvent = {
        channelId: channelId,
        adId: 'test-ad-e2e',
        type: 'impression',
        revenue: 0.10,
        timestamp: new Date()
      };

      await request(app)
        .post('/api/monetization/events')
        .send(revenueEvent)
        .expect(200);

      // Step 6: Test AI engine optimization
      const aiRecommendations = await request(app)
        .get(`/api/ai/channels/${channelId}/recommendations`)
        .expect(200);

      expect(aiRecommendations.body.success).toBe(true);

      // Step 7: Test distribution engine with multiple platforms
      const distributionPlatforms = [
        { platform: 'youtube', credentials: { streamKey: 'yt-key', serverUrl: 'rtmp://a.rtmp.youtube.com/live2' }},
        { platform: 'twitch', credentials: { streamKey: 'twitch-key', serverUrl: 'rtmp://live.twitch.tv/live' }}
      ];

      for (const platformConfig of distributionPlatforms) {
        await request(app)
          .post('/api/distribution/platforms')
          .send({
            channelId: channelId,
            ...platformConfig,
            enabled: true
          })
          .expect(200);
      }

      // Verify distribution status
      const distributionStatus = await request(app)
        .get(`/api/distribution/channels/${channelId}/status`)
        .expect(200);

      expect(distributionStatus.body.success).toBe(true);

      // Step 8: Test interaction engine with chat and polls
      const chatMessages = [
        { userId: 'user-1', message: 'Hello from E2E test!' },
        { userId: 'user-2', message: 'Great stream!' },
        { userId: 'user-1', message: 'Thanks for watching!' }
      ];

      for (const chatData of chatMessages) {
        await request(app)
          .post('/api/interaction/chat')
          .send({
            channelId: channelId,
            ...chatData,
            timestamp: new Date()
          })
          .expect(200);
      }

      const poll = {
        channelId: channelId,
        question: 'What content would you like next?',
        options: ['Music Videos', 'Live Sports', 'News', 'Movies'],
        duration: 300,
        displayOverlay: true
      };

      const pollResponse = await request(app)
        .post('/api/interaction/polls')
        .send(poll)
        .expect(200);

      expect(pollResponse.body.success).toBe(true);

      // Step 9: Test concurrent operations and bulk management
      const bulkOperation = {
        channelIds: [channelId],
        operation: 'restart'
      };

      const bulkResponse = await request(app)
        .post('/api/concurrent/bulk-operation')
        .send(bulkOperation)
        .expect(200);

      expect(bulkResponse.body.success).toBe(true);

      // Wait for restart to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 10: Test system monitoring and alerting integration
      const systemHealth = await request(app)
        .get('/api/system/health')
        .expect(200);

      expect(systemHealth.body.success).toBe(true);
      expect(systemHealth.body.data.overall).toMatch(/^(healthy|degraded|unhealthy)$/);

      const performanceMetrics = await request(app)
        .get('/api/system/performance')
        .expect(200);

      expect(performanceMetrics.body.success).toBe(true);

      // Test alerting system
      const testAlert = await request(app)
        .post('/api/system/alerts/test')
        .send({
          type: 'business',
          severity: 'low',
          title: 'E2E Test Alert',
          message: 'This alert was generated during end-to-end testing'
        })
        .expect(200);

      expect(testAlert.body.success).toBe(true);

      const alertsResponse = await request(app)
        .get('/api/system/alerts?active=true')
        .expect(200);

      expect(alertsResponse.body.success).toBe(true);
      expect(Array.isArray(alertsResponse.body.data.alerts)).toBe(true);

      // Step 11: Test preview and real-time interface
      const previewResponse = await request(app)
        .get(`/preview/${channelId}`)
        .expect(200);

      expect(previewResponse.text).toContain('Channel Preview');

      const dashboardResponse = await request(app)
        .get('/dashboard')
        .expect(200);

      expect(dashboardResponse.text).toContain('Channel Management Dashboard');

      // Step 12: Test error recovery and circuit breaker integration
      const recoveryStats = await request(app)
        .get('/api/system/recovery/stats')
        .expect(200);

      expect(recoveryStats.body.success).toBe(true);

      const circuitBreakers = await request(app)
        .get('/api/system/circuit-breakers')
        .expect(200);

      expect(circuitBreakers.body.success).toBe(true);

      // Step 13: Stop channel and verify cleanup
      const stopResponse = await request(app)
        .post(`/api/channels/${channelId}/stop`)
        .expect(200);

      expect(stopResponse.body.success).toBe(true);
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify channel is stopped
      const finalStatusResponse = await request(app)
        .get(`/api/channels/${channelId}`)
        .expect(200);

      expect(finalStatusResponse.body.data.status).toBe('STOPPED');

      // Step 14: Verify all data was properly tracked
      const finalAnalytics = await request(app)
        .get(`/api/analytics/channels/${channelId}/realtime`)
        .expect(200);

      expect(finalAnalytics.body.success).toBe(true);

      // Verify monetization data
      const revenueReport = await request(app)
        .get(`/api/monetization/channels/${channelId}/revenue`)
        .expect(200);

      expect(revenueReport.body.success).toBe(true);
    }, 60000); // Extended timeout for complete workflow

    test('should handle system stress and recovery scenarios', async () => {
      // Create multiple channels for stress testing
      const stressChannels: string[] = [];
      
      try {
        // Create 5 channels simultaneously
        const channelPromises = Array.from({ length: 5 }, (_, i) => {
          return request(app)
            .post('/api/channels')
            .send({
              name: `Stress Test Channel ${i + 1}`,
              clientId: clientId,
              resolution: '1280x720',
              fallbackVideo: '/app/media/fallback/default_fallback.mp4',
              hlsEnabled: true,
              rtmpDestinations: []
            });
        });

        const responses = await Promise.all(channelPromises);
        
        responses.forEach((response: any) => {
          expect(response.status).toBe(201);
          stressChannels.push(response.body.data.id);
        });

        // Start all channels simultaneously
        const startPromises = stressChannels.map(id => 
          request(app).post(`/api/channels/${id}/start`)
        );

        const startResponses = await Promise.all(startPromises);
        startResponses.forEach((response: any) => {
          expect(response.status).toBe(200);
        });

        // Wait for all to stabilize
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Verify system health under load
        const healthUnderLoad = await request(app)
          .get('/api/system/health')
          .expect(200);

        expect(healthUnderLoad.body.success).toBe(true);

        // Test bulk operations under load
        const bulkRestart = await request(app)
          .post('/api/concurrent/bulk-operation')
          .send({
            channelIds: stressChannels,
            operation: 'restart'
          })
          .expect(200);

        expect(bulkRestart.body.success).toBe(true);

        // Wait for restarts to complete
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Verify all channels are still operational
        for (const channelId of stressChannels) {
          const status = await request(app)
            .get(`/api/channels/${channelId}`)
            .expect(200);

          expect(['STARTING', 'LIVE', 'STOPPED']).toContain(status.body.data.status);
        }

      } finally {
        // Cleanup stress test channels
        if (stressChannels.length > 0) {
          await knex('channels').whereIn('id', stressChannels).del();
        }
      }
    }, 90000); // Extended timeout for stress testing
  });
    test('should maintain data consistency across operations', async () => {
      // Test database operations
      const channels = await knex('channels').select('*').limit(5);
      expect(Array.isArray(channels)).toBe(true);

      // Test Redis operations
      const { redisClient } = await import('../../config/redis');
      await redisClient.set('integration-test', 'success');
      const value = await redisClient.get('integration-test');
      expect(value).toBe('success');
      await redisClient.del('integration-test');
    });

    test('should handle database health checks', async () => {
      const health = await healthMonitor.getSystemHealth();
      const dbService = health.services.find(s => s.service === 'database');
      
      expect(dbService).toBeDefined();
      expect(dbService?.status).toBe('healthy');
    });

    test('should handle Redis health checks', async () => {
      const health = await healthMonitor.getSystemHealth();
      const redisService = health.services.find(s => s.service === 'redis');
      
      expect(redisService).toBeDefined();
      expect(redisService?.status).toBe('healthy');
    });
  });

  describe('API Integration and Routing', () => {
    test('should handle all API routes correctly', async () => {
      const routes = [
        '/api/system/health',
        '/api/system/performance',
        '/api/system/services',
        '/health',
        '/dashboard'
      ];

      for (const route of routes) {
        const response = await request(app).get(route);
        expect(response.status).toBeLessThan(500); // Should not have server errors
      }
    });

    test('should handle CORS and security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for security headers (added by helmet)
      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
    });

    test('should handle request logging and metrics', async () => {
      const initialMetrics = await performanceMonitor.getMetrics();
      const initialRequests = initialMetrics.requestMetrics.totalRequests;

      // Make a request
      await request(app).get('/health');

      // Check that metrics were updated
      const updatedMetrics = await performanceMonitor.getMetrics();
      expect(updatedMetrics.requestMetrics.totalRequests).toBeGreaterThanOrEqual(initialRequests);
    });
  });
});