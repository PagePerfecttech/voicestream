import { AIEngine } from '../../services/AIEngine';
import { MediaItem, OptimizedSchedule, ChurnPrediction, ContentCategories, Recommendation } from '../../types/ai';
import { db } from '../../config/database';

// Mock the database
jest.mock('../../config/database', () => ({
  db: {
    transaction: jest.fn(),
    raw: jest.fn(),
    select: jest.fn(),
    where: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    first: jest.fn(),
    limit: jest.fn(),
    orderBy: jest.fn(),
    groupBy: jest.fn(),
    count: jest.fn(),
    sum: jest.fn(),
    avg: jest.fn(),
    max: jest.fn(),
    min: jest.fn(),
    whereBetween: jest.fn(),
    whereNull: jest.fn(),
    whereNotNull: jest.fn(),
    join: jest.fn(),
    leftJoin: jest.fn(),
    countDistinct: jest.fn(),
    onConflict: jest.fn(),
    merge: jest.fn(),
    schema: {
      createTable: jest.fn(),
      dropTableIfExists: jest.fn()
    }
  }
}));

// Mock AnalyticsEngine
jest.mock('../../services/AnalyticsEngine', () => ({
  AnalyticsEngine: {
    getInstance: jest.fn(() => ({
      getRealtimeMetrics: jest.fn(),
      generateReport: jest.fn(),
      trackViewerEvent: jest.fn()
    }))
  }
}));

describe('AIEngine', () => {
  let aiEngine: AIEngine;
  let mockDb: any;

  beforeEach(() => {
    aiEngine = AIEngine.getInstance();
    mockDb = db as any;
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock chain
    mockDb.where = jest.fn().mockReturnThis();
    mockDb.select = jest.fn().mockReturnThis();
    mockDb.orderBy = jest.fn().mockReturnThis();
    mockDb.limit = jest.fn().mockReturnThis();
    mockDb.first = jest.fn().mockResolvedValue(null);
    mockDb.insert = jest.fn().mockResolvedValue([]);
    mockDb.whereBetween = jest.fn().mockReturnThis();
    mockDb.groupBy = jest.fn().mockReturnThis();
    mockDb.count = jest.fn().mockReturnThis();
    mockDb.avg = jest.fn().mockReturnThis();
    mockDb.sum = jest.fn().mockReturnThis();
    mockDb.max = jest.fn().mockReturnThis();
    mockDb.countDistinct = jest.fn().mockReturnThis();
    mockDb.join = jest.fn().mockReturnThis();
    mockDb.whereNull = jest.fn().mockReturnThis();
    mockDb.whereNotNull = jest.fn().mockReturnThis();
    mockDb.raw = jest.fn().mockReturnThis();
  });

  describe('optimizeSchedule', () => {
    it('should generate an optimized schedule for given content', async () => {
      const channelId = 'test-channel-id';
      const content: MediaItem[] = [
        {
          id: 'content-1',
          title: 'Test Content 1',
          duration: 1800,
          filePath: '/media/test1.mp4',
          fileSize: 1024000,
          format: 'mp4',
          contentType: 'entertainment',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'content-2',
          title: 'Test Content 2',
          duration: 3600,
          filePath: '/media/test2.mp4',
          fileSize: 2048000,
          format: 'mp4',
          contentType: 'news',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      // Mock viewer patterns query
      mockDb.first.mockResolvedValueOnce(null); // For patterns query
      mockDb.mockResolvedValueOnce([
        {
          day_of_week: 1,
          hour: 20,
          viewer_count: '150',
          avg_watch_time: '900',
          avg_interactions: '5'
        }
      ]);

      const result = await aiEngine.optimizeSchedule(channelId, content);

      expect(result).toBeDefined();
      expect(result.channelId).toBe(channelId);
      expect(result.timeSlots).toBeDefined();
      expect(result.expectedViewership).toBeGreaterThanOrEqual(0);
      expect(result.revenueProjection).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(100);
      expect(result.optimizationStrategy).toBe('balanced');
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should handle empty content array', async () => {
      const channelId = 'test-channel-id';
      const content: MediaItem[] = [];

      mockDb.mockResolvedValueOnce([]); // Empty patterns

      const result = await aiEngine.optimizeSchedule(channelId, content);

      expect(result).toBeDefined();
      expect(result.timeSlots).toHaveLength(0);
      expect(result.expectedViewership).toBe(0);
    });

    it('should respect different optimization strategies', async () => {
      const channelId = 'test-channel-id';
      const content: MediaItem[] = [
        {
          id: 'content-1',
          title: 'Test Content',
          duration: 1800,
          filePath: '/media/test.mp4',
          fileSize: 1024000,
          format: 'mp4',
          contentType: 'entertainment',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockDb.mockResolvedValueOnce([]);

      const request = {
        channelId,
        content,
        timeRange: {
          start: new Date(),
          end: new Date(Date.now() + 24 * 60 * 60 * 1000)
        },
        strategy: 'revenue' as const
      };

      const result = await aiEngine.optimizeSchedule(channelId, content, request);

      expect(result.optimizationStrategy).toBe('revenue');
    });
  });

  describe('predictViewerChurn', () => {
    it('should predict viewer churn with risk factors', async () => {
      const channelId = 'test-channel-id';

      // Mock recent metrics
      mockDb.first.mockResolvedValueOnce([
        { concurrent_viewers: 80, total_interactions: 10, average_watch_time: 600 }
      ]);

      // Mock historical metrics
      mockDb.mockResolvedValueOnce([
        { concurrent_viewers: 100, total_interactions: 15, average_watch_time: 800 }
      ]);

      const result = await aiEngine.predictViewerChurn(channelId);

      expect(result).toBeDefined();
      expect(result.channelId).toBe(channelId);
      expect(result.riskLevel).toMatch(/^(low|medium|high)$/);
      expect(result.churnProbability).toBeGreaterThanOrEqual(0);
      expect(result.churnProbability).toBeLessThanOrEqual(100);
      expect(result.riskFactors).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.affectedViewerSegments).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(100);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should identify high churn risk when metrics decline significantly', async () => {
      const channelId = 'test-channel-id';

      // Mock significant decline in metrics
      mockDb.first.mockResolvedValueOnce([
        { concurrent_viewers: 50, total_interactions: 5, average_watch_time: 300 }
      ]);

      mockDb.mockResolvedValueOnce([
        { concurrent_viewers: 200, total_interactions: 25, average_watch_time: 1200 }
      ]);

      const result = await aiEngine.predictViewerChurn(channelId);

      expect(result.riskLevel).toBe('high');
      expect(result.churnProbability).toBeGreaterThan(50);
      expect(result.riskFactors.length).toBeGreaterThan(0);
    });

    it('should provide prevention recommendations for high risk channels', async () => {
      const channelId = 'test-channel-id';

      mockDb.first.mockResolvedValueOnce([
        { concurrent_viewers: 30, total_interactions: 2, average_watch_time: 200 }
      ]);

      mockDb.mockResolvedValueOnce([
        { concurrent_viewers: 150, total_interactions: 20, average_watch_time: 900 }
      ]);

      const result = await aiEngine.predictViewerChurn(channelId);

      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
      
      const highPriorityRecs = result.recommendations.filter(r => r.priority === 'high');
      expect(highPriorityRecs.length).toBeGreaterThan(0);
    });
  });

  describe('categorizeContent', () => {
    it('should categorize content and generate metadata', async () => {
      const mediaItem: MediaItem = {
        id: 'content-1',
        title: 'Documentary: Ocean Life',
        description: 'An educational documentary about marine ecosystems',
        duration: 3600,
        filePath: '/media/ocean-doc.mp4',
        fileSize: 5120000,
        format: 'mp4',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await aiEngine.categorizeContent(mediaItem);

      expect(result).toBeDefined();
      expect(result.primary).toBeDefined();
      expect(result.secondary).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
      expect(result.tags).toBeDefined();
      expect(result.mood).toBeDefined();
      expect(result.targetAudience).toBeDefined();
      expect(Array.isArray(result.secondary)).toBe(true);
      expect(Array.isArray(result.tags)).toBe(true);
      expect(Array.isArray(result.targetAudience)).toBe(true);
    });

    it('should handle content with minimal information', async () => {
      const mediaItem: MediaItem = {
        id: 'content-minimal',
        title: 'Untitled',
        duration: 600,
        filePath: '/media/unknown.mp4',
        fileSize: 512000,
        format: 'mp4',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await aiEngine.categorizeContent(mediaItem);

      expect(result).toBeDefined();
      expect(result.primary).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('generateRecommendations', () => {
    it('should generate various types of recommendations', async () => {
      const channelId = 'test-channel-id';

      const result = await aiEngine.generateRecommendations(channelId);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      if (result.length > 0) {
        const recommendation = result[0];
        expect(recommendation.id).toBeDefined();
        expect(recommendation.type).toMatch(/^(content|scheduling|monetization|engagement|technical)$/);
        expect(recommendation.priority).toMatch(/^(low|medium|high|critical)$/);
        expect(recommendation.title).toBeDefined();
        expect(recommendation.description).toBeDefined();
        expect(recommendation.rationale).toBeDefined();
        expect(recommendation.expectedImpact).toBeDefined();
        expect(recommendation.implementation).toBeDefined();
        expect(recommendation.createdAt).toBeInstanceOf(Date);
      }
    });

    it('should prioritize recommendations correctly', async () => {
      const channelId = 'test-channel-id';

      const result = await aiEngine.generateRecommendations(channelId);

      if (result.length > 1) {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        
        for (let i = 0; i < result.length - 1; i++) {
          const currentPriority = priorityOrder[result[i].priority];
          const nextPriority = priorityOrder[result[i + 1].priority];
          
          expect(currentPriority).toBeGreaterThanOrEqual(nextPriority);
        }
      }
    });
  });

  describe('optimizeAdPlacement', () => {
    it('should optimize ad placement for content', async () => {
      const channelId = 'test-channel-id';
      const contentId = 'content-1';

      const result = await aiEngine.optimizeAdPlacement(channelId, contentId);

      expect(result).toBeDefined();
      expect(result.channelId).toBe(channelId);
      expect(result.contentId).toBe(contentId);
      expect(result.optimalPlacements).toBeDefined();
      expect(Array.isArray(result.optimalPlacements)).toBe(true);
      expect(result.expectedRevenue).toBeGreaterThanOrEqual(0);
      expect(result.expectedViewerImpact).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(100);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should generate valid ad placements', async () => {
      const channelId = 'test-channel-id';
      const contentId = 'content-1';

      const result = await aiEngine.optimizeAdPlacement(channelId, contentId);

      if (result.optimalPlacements.length > 0) {
        const placement = result.optimalPlacements[0];
        
        expect(placement.timestamp).toBeGreaterThanOrEqual(0);
        expect(placement.type).toMatch(/^(pre-roll|mid-roll|post-roll)$/);
        expect(placement.duration).toBeGreaterThan(0);
        expect(placement.expectedViewers).toBeGreaterThanOrEqual(0);
        expect(placement.expectedRevenue).toBeGreaterThanOrEqual(0);
        expect(placement.viewerDropProbability).toBeGreaterThanOrEqual(0);
        expect(placement.viewerDropProbability).toBeLessThanOrEqual(100);
        expect(placement.reasonForPlacement).toBeDefined();
      }
    });
  });

  describe('analyzeViewerBehavior', () => {
    it('should analyze viewer behavior patterns', async () => {
      const channelId = 'test-channel-id';

      // Mock viewer data
      mockDb.first.mockResolvedValueOnce({ count: '250' }); // Total viewers

      const result = await aiEngine.analyzeViewerBehavior(channelId);

      expect(result).toBeDefined();
      expect(result.channelId).toBe(channelId);
      expect(result.analysisDate).toBeInstanceOf(Date);
      expect(result.totalViewers).toBeGreaterThanOrEqual(0);
      expect(result.segments).toBeDefined();
      expect(Array.isArray(result.segments)).toBe(true);
      expect(result.patterns).toBeDefined();
      expect(Array.isArray(result.patterns)).toBe(true);
      expect(result.trends).toBeDefined();
      expect(result.seasonality).toBeDefined();
    });

    it('should identify viewer segments correctly', async () => {
      const channelId = 'test-channel-id';

      mockDb.first.mockResolvedValueOnce({ count: '100' });

      const result = await aiEngine.analyzeViewerBehavior(channelId);

      if (result.segments.length > 0) {
        const segment = result.segments[0];
        
        expect(segment.id).toBeDefined();
        expect(segment.name).toBeDefined();
        expect(segment.description).toBeDefined();
        expect(segment.size).toBeGreaterThanOrEqual(0);
        expect(segment.characteristics).toBeDefined();
        expect(Array.isArray(segment.behaviorPatterns)).toBe(true);
        expect(segment.churnRisk).toBeGreaterThanOrEqual(0);
        expect(segment.churnRisk).toBeLessThanOrEqual(100);
        expect(segment.valueScore).toBeGreaterThanOrEqual(0);
        expect(segment.valueScore).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const channelId = 'test-channel-id';
      
      mockDb.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(aiEngine.predictViewerChurn(channelId)).rejects.toThrow('Database connection failed');
    });

    it('should handle invalid channel IDs', async () => {
      const invalidChannelId = 'invalid-id';
      
      mockDb.mockResolvedValueOnce([]); // No data found

      const result = await aiEngine.predictViewerChurn(invalidChannelId);
      
      expect(result.churnProbability).toBe(10); // Base probability
      expect(result.riskLevel).toBe('low');
    });
  });

  describe('Integration', () => {
    it('should work with real-like data flow', async () => {
      const channelId = 'integration-test-channel';
      const content: MediaItem[] = [
        {
          id: 'content-1',
          title: 'Morning News',
          duration: 1800,
          filePath: '/media/news.mp4',
          fileSize: 1024000,
          format: 'mp4',
          contentType: 'news',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      // Mock realistic viewer patterns
      mockDb.mockResolvedValueOnce([
        {
          day_of_week: 1,
          hour: 8,
          viewer_count: '200',
          avg_watch_time: '1200',
          avg_interactions: '8'
        }
      ]);

      // Test schedule optimization
      const schedule = await aiEngine.optimizeSchedule(channelId, content);
      expect(schedule).toBeDefined();

      // Test content categorization
      const categories = await aiEngine.categorizeContent(content[0]);
      expect(categories).toBeDefined();

      // Test recommendations
      const recommendations = await aiEngine.generateRecommendations(channelId);
      expect(recommendations).toBeDefined();
    });
  });
});