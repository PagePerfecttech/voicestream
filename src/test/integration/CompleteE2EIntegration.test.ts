import request from 'supertest';
import { createApp } from '../../app';
import { ServiceContainer } from '../../container/ServiceContainer';
import { SystemHealthMonitor } from '../../services/SystemHealthMonitor';
import { PerformanceMonitor } from '../../services/PerformanceMonitor';
import { AlertingService } from '../../services/AlertingService';
import { initializeDatabase, closeDatabase } from '../../config/database';
import { initializeRedis, closeRedis } from '../../config/redis';
import { knex } from '../../config/database';
import { logger } from '../../utils/logger';
import { Express } from 'express';

describe('Complete End-to-End System Integration Tests', () => {
  let app: Express;
  let serviceContainer: ServiceContainer;
  let healthMonitor: SystemHealthMonitor;
  let performanceMonitor: PerformanceMonitor;
  let alertingService: AlertingService;

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
    alertingService = AlertingService.getInstance();

    // Start monitoring
    healthMonitor.start();
    alertingService.start();

    // Create app
    app = createApp();

    logger.info('Complete E2E integration test setup completed');
  }, 60000);

  afterAll(async () => {
    // Cleanup in reverse order
    alertingService.stop();
    healthMonitor.stop();
    performanceMonitor.shutdown();
    await serviceContainer.shutdown();
    await closeDatabase();
    await closeRedis();

    logger.info('Complete E2E integration test cleanup completed');
  }, 60000);

  describe('Complete System Integration Workflow', () => {
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

  describe('Alerting System Integration', () => {
    test('should handle alert lifecycle', async () => {
      // Create test alert
      const testAlert = await request(app)
        .post('/api/system/alerts/test')
        .send({
          type: 'performance',
          severity: 'medium',
          title: 'Test Performance Alert',
          message: 'This is a test alert for integration testing'
        })
        .expect(200);

      expect(testAlert.body.success).toBe(true);
      const alertId = testAlert.body.data.id;

      // Get active alerts
      const activeAlerts = await request(app)
        .get('/api/system/alerts?active=true')
        .expect(200);

      expect(activeAlerts.body.success).toBe(true);
      expect(activeAlerts.body.data.alerts.some((alert: any) => alert.id === alertId)).toBe(true);

      // Acknowledge alert
      const acknowledgeResponse = await request(app)
        .post(`/api/system/alerts/${alertId}/acknowledge`)
        .send({ acknowledgedBy: 'integration-test' })
        .expect(200);

      expect(acknowledgeResponse.body.success).toBe(true);

      // Resolve alert
      const resolveResponse = await request(app)
        .post(`/api/system/alerts/${alertId}/resolve`)
        .send({ resolvedBy: 'integration-test' })
        .expect(200);

      expect(resolveResponse.body.success).toBe(true);

      // Verify alert is no longer active
      const finalActiveAlerts = await request(app)
        .get('/api/system/alerts?active=true')
        .expect(200);

      expect(finalActiveAlerts.body.data.alerts.some((alert: any) => alert.id === alertId)).toBe(false);

      // Get alert stats
      const alertStats = await request(app)
        .get('/api/system/alerts/stats')
        .expect(200);

      expect(alertStats.body.success).toBe(true);
      expect(alertStats.body.data.totalAlerts).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring Integration', () => {
    test('should track performance metrics during operations', async () => {
      // Make several requests to generate metrics
      for (let i = 0; i < 10; i++) {
        await request(app).get('/health');
      }

      // Get performance metrics
      const response = await request(app)
        .get('/api/system/performance')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requestMetrics.totalRequests).toBeGreaterThan(0);
      expect(response.body.data.systemMetrics).toBeDefined();
      expect(response.body.data.streamingMetrics).toBeDefined();
      expect(response.body.data.thresholds).toBeDefined();
    });
  });

  describe('Service Container Integration', () => {
    test('should have all services properly wired', async () => {
      const servicesResponse = await request(app)
        .get('/api/system/services')
        .expect(200);

      expect(servicesResponse.body.success).toBe(true);
      expect(servicesResponse.body.data.initialized).toBe(true);

      const services = servicesResponse.body.data.services;
      
      // Verify core services are present
      expect(services.channelManager).toBeDefined();
      expect(services.analyticsEngine).toBeDefined();
      expect(services.monetizationEngine).toBeDefined();
      expect(services.aiEngine).toBeDefined();
      expect(services.distributionEngine).toBeDefined();
      expect(services.interactionEngine).toBeDefined();
      expect(services.concurrentOperationsManager).toBeDefined();
      expect(services.previewPlayer).toBeDefined();
      expect(services.realtimeNotificationService).toBeDefined();
      expect(services.errorRecoveryService).toBeDefined();
      expect(services.systemHealthMonitor).toBeDefined();
      expect(services.performanceMonitor).toBeDefined();
    });
  });
});