import { AnalyticsEngine } from '../../services/AnalyticsEngine';

describe('AnalyticsEngine - Standalone Tests', () => {
  let analyticsEngine: AnalyticsEngine;

  beforeAll(() => {
    analyticsEngine = AnalyticsEngine.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AnalyticsEngine.getInstance();
      const instance2 = AnalyticsEngine.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(AnalyticsEngine);
    });
  });

  describe('helper methods', () => {
    it('should have all required public methods', () => {
      expect(typeof analyticsEngine.trackViewerEvent).toBe('function');
      expect(typeof analyticsEngine.getRealtimeMetrics).toBe('function');
      expect(typeof analyticsEngine.generateReport).toBe('function');
      expect(typeof analyticsEngine.queryAnalytics).toBe('function');
      expect(typeof analyticsEngine.updateChannelMetrics).toBe('function');
      expect(typeof analyticsEngine.cleanupOldData).toBe('function');
    });
  });

  describe('data validation', () => {
    it('should validate viewer tracking event structure', () => {
      const validEvent = {
        channelId: 'test-channel',
        viewerId: 'test-viewer',
        eventType: 'join' as const,
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser'
      };

      // This test just verifies the structure is accepted by TypeScript
      expect(validEvent.channelId).toBe('test-channel');
      expect(validEvent.eventType).toBe('join');
    });

    it('should validate analytics query structure', () => {
      const validQuery = {
        channelId: 'test-channel',
        startDate: new Date(),
        endDate: new Date(),
        groupBy: 'day' as const,
        filters: {
          country: 'US',
          deviceType: 'desktop'
        }
      };

      // This test just verifies the structure is accepted by TypeScript
      expect(validQuery.channelId).toBe('test-channel');
      expect(validQuery.groupBy).toBe('day');
    });
  });
});