/**
 * Simple Analytics Engine validation tests
 * These tests validate the Analytics Engine structure and basic functionality
 * without requiring database connectivity
 */

describe('AnalyticsEngine - Simple Validation', () => {
  it('should be able to import AnalyticsEngine', () => {
    const { AnalyticsEngine } = require('../../services/AnalyticsEngine');
    expect(AnalyticsEngine).toBeDefined();
    expect(typeof AnalyticsEngine).toBe('function');
  });

  it('should have getInstance method', () => {
    const { AnalyticsEngine } = require('../../services/AnalyticsEngine');
    expect(typeof AnalyticsEngine.getInstance).toBe('function');
  });

  it('should return singleton instance', () => {
    const { AnalyticsEngine } = require('../../services/AnalyticsEngine');
    const instance1 = AnalyticsEngine.getInstance();
    const instance2 = AnalyticsEngine.getInstance();
    
    expect(instance1).toBe(instance2);
    expect(instance1).toBeInstanceOf(AnalyticsEngine);
  });

  it('should have all required public methods', () => {
    const { AnalyticsEngine } = require('../../services/AnalyticsEngine');
    const analyticsEngine = AnalyticsEngine.getInstance();
    
    // Verify all required methods exist
    expect(typeof analyticsEngine.trackViewerEvent).toBe('function');
    expect(typeof analyticsEngine.getRealtimeMetrics).toBe('function');
    expect(typeof analyticsEngine.generateReport).toBe('function');
    expect(typeof analyticsEngine.queryAnalytics).toBe('function');
    expect(typeof analyticsEngine.updateChannelMetrics).toBe('function');
    expect(typeof analyticsEngine.cleanupOldData).toBe('function');
  });

  it('should validate analytics types are properly imported', () => {
    const analyticsTypes = require('../../types/analytics');
    
    // Verify key types are exported
    expect(analyticsTypes.ViewerSession).toBeDefined();
    expect(analyticsTypes.ViewerEvent).toBeDefined();
    expect(analyticsTypes.ChannelMetrics).toBeDefined();
    expect(analyticsTypes.RealtimeMetrics).toBeDefined();
    expect(analyticsTypes.AnalyticsReport).toBeDefined();
  });

  it('should validate analytics routes are properly exported', () => {
    const analyticsRoutes = require('../../routes/analytics');
    expect(analyticsRoutes.default).toBeDefined();
    expect(typeof analyticsRoutes.default).toBe('function'); // Express router
  });
});