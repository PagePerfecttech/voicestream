/**
 * Standalone AIEngine Tests
 * Tests that can run independently without complex mocking
 */

import { AIEngine } from '../../services/AIEngine';
import { MediaItem } from '../../types/ai';

// Simple mock for database
jest.mock('../../config/database', () => ({
  db: {
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue([]),
    whereBetween: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    avg: jest.fn().mockReturnThis(),
    sum: jest.fn().mockReturnThis(),
    max: jest.fn().mockReturnThis(),
    countDistinct: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    raw: jest.fn().mockReturnThis(),
    mockResolvedValue: jest.fn().mockResolvedValue([])
  }
}));

jest.mock('../../services/AnalyticsEngine', () => ({
  AnalyticsEngine: {
    getInstance: () => ({
      getRealtimeMetrics: jest.fn().mockResolvedValue({}),
      generateReport: jest.fn().mockResolvedValue({}),
      trackViewerEvent: jest.fn().mockResolvedValue({})
    })
  }
}));

describe('AIEngine Standalone Tests', () => {
  let aiEngine: AIEngine;

  beforeAll(() => {
    aiEngine = AIEngine.getInstance();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('AIEngine singleton pattern works correctly', () => {
    const instance1 = AIEngine.getInstance();
    const instance2 = AIEngine.getInstance();
    
    expect(instance1).toBe(instance2);
    expect(instance1).toBeInstanceOf(AIEngine);
  });

  test('Content categorization returns valid structure', async () => {
    const testContent: MediaItem = {
      id: 'test-123',
      title: 'Test Documentary',
      duration: 3600,
      filePath: '/media/test.mp4',
      fileSize: 1000000,
      format: 'mp4',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await aiEngine.categorizeContent(testContent);

    // Validate structure
    expect(result).toHaveProperty('primary');
    expect(result).toHaveProperty('secondary');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('tags');
    expect(result).toHaveProperty('mood');
    expect(result).toHaveProperty('targetAudience');

    // Validate types
    expect(typeof result.primary).toBe('string');
    expect(Array.isArray(result.secondary)).toBe(true);
    expect(typeof result.confidence).toBe('number');
    expect(Array.isArray(result.tags)).toBe(true);
    expect(typeof result.mood).toBe('string');
    expect(Array.isArray(result.targetAudience)).toBe(true);

    // Validate ranges
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });

  test('Schedule optimization handles empty content gracefully', async () => {
    const channelId = 'empty-channel';
    const emptyContent: MediaItem[] = [];

    const result = await aiEngine.optimizeSchedule(channelId, emptyContent);

    expect(result).toHaveProperty('channelId', channelId);
    expect(result).toHaveProperty('timeSlots');
    expect(result).toHaveProperty('expectedViewership');
    expect(result).toHaveProperty('revenueProjection');
    expect(result).toHaveProperty('confidenceScore');
    expect(result).toHaveProperty('optimizationStrategy');
    expect(result).toHaveProperty('generatedAt');

    expect(Array.isArray(result.timeSlots)).toBe(true);
    expect(result.timeSlots).toHaveLength(0);
    expect(result.expectedViewership).toBe(0);
    expect(result.optimizationStrategy).toBe('balanced');
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  test('Churn prediction returns valid risk assessment', async () => {
    const channelId = 'risk-channel';

    const result = await aiEngine.predictViewerChurn(channelId);

    // Validate structure
    expect(result).toHaveProperty('channelId', channelId);
    expect(result).toHaveProperty('riskLevel');
    expect(result).toHaveProperty('churnProbability');
    expect(result).toHaveProperty('riskFactors');
    expect(result).toHaveProperty('recommendations');
    expect(result).toHaveProperty('affectedViewerSegments');
    expect(result).toHaveProperty('confidenceScore');
    expect(result).toHaveProperty('generatedAt');

    // Validate types and ranges
    expect(['low', 'medium', 'high']).toContain(result.riskLevel);
    expect(typeof result.churnProbability).toBe('number');
    expect(result.churnProbability).toBeGreaterThanOrEqual(0);
    expect(result.churnProbability).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.riskFactors)).toBe(true);
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(Array.isArray(result.affectedViewerSegments)).toBe(true);
    expect(typeof result.confidenceScore).toBe('number');
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(result.confidenceScore).toBeLessThanOrEqual(100);
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  test('Recommendations generation returns valid recommendations', async () => {
    const channelId = 'rec-channel';

    const result = await aiEngine.generateRecommendations(channelId);

    expect(Array.isArray(result)).toBe(true);

    // If recommendations exist, validate their structure
    if (result.length > 0) {
      const rec = result[0];
      
      expect(rec).toHaveProperty('id');
      expect(rec).toHaveProperty('type');
      expect(rec).toHaveProperty('priority');
      expect(rec).toHaveProperty('title');
      expect(rec).toHaveProperty('description');
      expect(rec).toHaveProperty('rationale');
      expect(rec).toHaveProperty('expectedImpact');
      expect(rec).toHaveProperty('implementation');
      expect(rec).toHaveProperty('createdAt');

      expect(['content', 'scheduling', 'monetization', 'engagement', 'technical']).toContain(rec.type);
      expect(['low', 'medium', 'high', 'critical']).toContain(rec.priority);
      expect(typeof rec.title).toBe('string');
      expect(typeof rec.description).toBe('string');
      expect(typeof rec.rationale).toBe('string');
      expect(rec.createdAt).toBeInstanceOf(Date);
    }
  });

  test('Ad placement optimization returns valid structure', async () => {
    const channelId = 'ad-channel';
    const contentId = 'ad-content';

    const result = await aiEngine.optimizeAdPlacement(channelId, contentId);

    expect(result).toHaveProperty('channelId', channelId);
    expect(result).toHaveProperty('contentId', contentId);
    expect(result).toHaveProperty('optimalPlacements');
    expect(result).toHaveProperty('expectedRevenue');
    expect(result).toHaveProperty('expectedViewerImpact');
    expect(result).toHaveProperty('optimizationStrategy');
    expect(result).toHaveProperty('confidenceScore');
    expect(result).toHaveProperty('generatedAt');

    expect(Array.isArray(result.optimalPlacements)).toBe(true);
    expect(typeof result.expectedRevenue).toBe('number');
    expect(typeof result.expectedViewerImpact).toBe('number');
    expect(typeof result.confidenceScore).toBe('number');
    expect(result.generatedAt).toBeInstanceOf(Date);

    // Validate placements if they exist
    if (result.optimalPlacements.length > 0) {
      const placement = result.optimalPlacements[0];
      
      expect(placement).toHaveProperty('timestamp');
      expect(placement).toHaveProperty('type');
      expect(placement).toHaveProperty('duration');
      expect(placement).toHaveProperty('expectedViewers');
      expect(placement).toHaveProperty('expectedRevenue');
      expect(placement).toHaveProperty('viewerDropProbability');
      expect(placement).toHaveProperty('reasonForPlacement');

      expect(['pre-roll', 'mid-roll', 'post-roll']).toContain(placement.type);
      expect(typeof placement.timestamp).toBe('number');
      expect(placement.timestamp).toBeGreaterThanOrEqual(0);
      expect(typeof placement.duration).toBe('number');
      expect(placement.duration).toBeGreaterThan(0);
    }
  });

  test('Viewer behavior analysis returns comprehensive data', async () => {
    const channelId = 'behavior-channel';

    const result = await aiEngine.analyzeViewerBehavior(channelId);

    expect(result).toHaveProperty('channelId', channelId);
    expect(result).toHaveProperty('analysisDate');
    expect(result).toHaveProperty('totalViewers');
    expect(result).toHaveProperty('segments');
    expect(result).toHaveProperty('patterns');
    expect(result).toHaveProperty('trends');
    expect(result).toHaveProperty('seasonality');

    expect(result.analysisDate).toBeInstanceOf(Date);
    expect(typeof result.totalViewers).toBe('number');
    expect(Array.isArray(result.segments)).toBe(true);
    expect(Array.isArray(result.patterns)).toBe(true);
    expect(typeof result.trends).toBe('object');
    expect(typeof result.seasonality).toBe('object');

    // Validate trends structure
    expect(result.trends).toHaveProperty('viewership');
    expect(result.trends).toHaveProperty('engagement');
    expect(result.trends).toHaveProperty('retention');

    // Validate seasonality structure
    expect(result.seasonality).toHaveProperty('daily');
    expect(result.seasonality).toHaveProperty('weekly');
    expect(result.seasonality).toHaveProperty('monthly');
  });

  test('All methods handle invalid input gracefully', async () => {
    const invalidChannelId = '';
    const invalidContent: MediaItem = {
      id: '',
      title: '',
      duration: 0,
      filePath: '',
      fileSize: 0,
      format: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // These should not throw errors
    await expect(aiEngine.predictViewerChurn(invalidChannelId)).resolves.toBeDefined();
    await expect(aiEngine.categorizeContent(invalidContent)).resolves.toBeDefined();
    await expect(aiEngine.generateRecommendations(invalidChannelId)).resolves.toBeDefined();
    await expect(aiEngine.optimizeAdPlacement(invalidChannelId, '')).resolves.toBeDefined();
    await expect(aiEngine.analyzeViewerBehavior(invalidChannelId)).resolves.toBeDefined();
  });

  test('Methods return consistent data types', async () => {
    const channelId = 'consistent-channel';
    const testContent: MediaItem = {
      id: 'test-content',
      title: 'Test Content',
      duration: 1800,
      filePath: '/media/test.mp4',
      fileSize: 1000000,
      format: 'mp4',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Run multiple calls and ensure consistent return types
    const [schedule1, schedule2] = await Promise.all([
      aiEngine.optimizeSchedule(channelId, [testContent]),
      aiEngine.optimizeSchedule(channelId, [testContent])
    ]);

    expect(typeof schedule1.expectedViewership).toBe(typeof schedule2.expectedViewership);
    expect(typeof schedule1.revenueProjection).toBe(typeof schedule2.revenueProjection);
    expect(typeof schedule1.confidenceScore).toBe(typeof schedule2.confidenceScore);

    const [churn1, churn2] = await Promise.all([
      aiEngine.predictViewerChurn(channelId),
      aiEngine.predictViewerChurn(channelId)
    ]);

    expect(typeof churn1.churnProbability).toBe(typeof churn2.churnProbability);
    expect(typeof churn1.confidenceScore).toBe(typeof churn2.confidenceScore);
  });
});