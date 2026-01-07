import { MonetizationEngine } from '../../services/MonetizationEngine';
import { db } from '../../config/database';
import { v4 as uuidv4 } from 'uuid';

// Mock the database
jest.mock('../../config/database', () => ({
  db: jest.fn()
}));

const mockDb = db as jest.MockedFunction<any>;

describe('MonetizationEngine', () => {
  let monetizationEngine: MonetizationEngine;
  let mockChannelId: string;
  let mockViewerId: string;

  beforeEach(() => {
    monetizationEngine = MonetizationEngine.getInstance();
    mockChannelId = uuidv4();
    mockViewerId = 'test-viewer-123';
    jest.clearAllMocks();
  });

  describe('scheduleAdBreak', () => {
    it('should schedule an ad break successfully', async () => {
      const mockAdBreak = {
        channelId: mockChannelId,
        type: 'mid-roll' as const,
        scheduledTime: new Date(),
        duration: 30,
        status: 'scheduled' as const,
        targetingCriteria: {},
        adContent: []
      };

      mockDb.mockReturnValue({
        insert: jest.fn().mockResolvedValue([])
      });

      const result = await monetizationEngine.scheduleAdBreak(mockChannelId, mockAdBreak);

      expect(result).toMatchObject({
        channelId: mockChannelId,
        type: 'mid-roll',
        duration: 30,
        status: 'scheduled'
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });

    it('should handle ad break with content', async () => {
      const mockAdContent = [{
        id: uuidv4(),
        adNetworkId: uuidv4(),
        adType: 'video' as const,
        contentUrl: 'https://example.com/ad.mp4',
        duration: 30,
        targetAudience: ['18-35'],
        bidAmount: 5.0,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      const mockAdBreak = {
        channelId: mockChannelId,
        type: 'pre-roll' as const,
        scheduledTime: new Date(),
        duration: 30,
        status: 'scheduled' as const,
        targetingCriteria: {},
        adContent: mockAdContent
      };

      mockDb.mockReturnValue({
        insert: jest.fn().mockResolvedValue([])
      });

      const result = await monetizationEngine.scheduleAdBreak(mockChannelId, mockAdBreak);

      expect(result.adContent).toHaveLength(1);
      expect(mockDb).toHaveBeenCalledTimes(2); // Once for ad_breaks, once for ad_content
    });
  });

  describe('integrateAdNetwork', () => {
    it('should integrate a new ad network', async () => {
      const mockNetwork = {
        name: 'Test Ad Network',
        type: 'custom' as const,
        apiEndpoint: 'https://api.testnetwork.com',
        isActive: true,
        supportedAdTypes: ['video' as const],
        minimumBid: 1.0,
        currency: 'USD',
        fillRate: 85.5,
        averageCPM: 2.5
      };

      const mockCredentials = {
        apiKey: 'test-api-key',
        secretKey: 'test-secret'
      };

      mockDb.mockReturnValue({
        insert: jest.fn().mockResolvedValue([])
      });

      const result = await monetizationEngine.integrateAdNetwork(mockNetwork, mockCredentials);

      expect(result).toMatchObject({
        name: 'Test Ad Network',
        type: 'custom',
        apiEndpoint: 'https://api.testnetwork.com',
        isActive: true
      });
      expect(result.id).toBeDefined();
      expect(result.credentials).toEqual(mockCredentials);
    });
  });

  describe('trackRevenue', () => {
    it('should track revenue successfully', async () => {
      mockDb.mockReturnValue({
        insert: jest.fn().mockResolvedValue([])
      });

      const result = await monetizationEngine.trackRevenue(
        mockChannelId,
        'advertising',
        25.50,
        {
          sourceId: 'ad-break-123',
          viewerId: mockViewerId,
          currency: 'USD'
        }
      );

      expect(result).toMatchObject({
        channelId: mockChannelId,
        source: 'advertising',
        amount: 25.50,
        currency: 'USD',
        sourceId: 'ad-break-123',
        viewerId: mockViewerId
      });
      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should use default currency when not specified', async () => {
      mockDb.mockReturnValue({
        insert: jest.fn().mockResolvedValue([])
      });

      const result = await monetizationEngine.trackRevenue(
        mockChannelId,
        'subscription',
        9.99
      );

      expect(result.currency).toBe('USD');
    });
  });

  describe('enforceSubscriptionAccess', () => {
    it('should allow access when subscription is not required', async () => {
      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null) // No config found
      });

      const result = await monetizationEngine.enforceSubscriptionAccess(mockChannelId, mockViewerId);

      expect(result).toEqual({
        hasAccess: true,
        accessLevel: 'full'
      });
    });

    it('should allow access when subscription is not required in config', async () => {
      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          subscription_required: false
        })
      });

      const result = await monetizationEngine.enforceSubscriptionAccess(mockChannelId, mockViewerId);

      expect(result).toEqual({
        hasAccess: true,
        accessLevel: 'full'
      });
    });

    it('should deny access when subscription is required but viewer has none', async () => {
      mockDb
        .mockReturnValueOnce({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({
            subscription_required: true,
            allowed_subscription_tiers: '[]',
            free_trial_duration: 7
          })
        })
        .mockReturnValueOnce({
          join: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(null) // No subscription
        });

      const result = await monetizationEngine.enforceSubscriptionAccess(mockChannelId, mockViewerId);

      expect(result).toEqual({
        hasAccess: false,
        reason: 'subscription_required',
        requiredAction: {
          type: 'subscribe',
          details: {
            availableTiers: [],
            freeTrialDuration: 7
          }
        }
      });
    });

    it('should allow access with valid subscription', async () => {
      mockDb
        .mockReturnValueOnce({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({
            subscription_required: true,
            allowed_subscription_tiers: '[]'
          })
        })
        .mockReturnValueOnce({
          join: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({
            subscription_tier_id: 'tier-123',
            name: 'Premium',
            ad_free_experience: true
          })
        });

      const result = await monetizationEngine.enforceSubscriptionAccess(mockChannelId, mockViewerId);

      expect(result).toEqual({
        hasAccess: true,
        accessLevel: 'full'
      });
    });
  });

  describe('createPPVEvent', () => {
    it('should create a PPV event successfully', async () => {
      const mockEvent = {
        channelId: mockChannelId,
        eventName: 'Special Live Event',
        description: 'An exclusive live streaming event',
        startTime: new Date('2024-02-01T20:00:00Z'),
        endTime: new Date('2024-02-01T22:00:00Z'),
        timezone: 'UTC',
        price: 19.99,
        currency: 'USD',
        purchaseDeadline: new Date('2024-02-01T19:00:00Z'),
        accessDuration: 24,
        status: 'upcoming' as const
      };

      mockDb.mockReturnValue({
        insert: jest.fn().mockResolvedValue([])
      });

      const result = await monetizationEngine.createPPVEvent(mockEvent);

      expect(result).toMatchObject({
        channelId: mockChannelId,
        eventName: 'Special Live Event',
        price: 19.99,
        currency: 'USD',
        status: 'upcoming',
        totalPurchases: 0,
        totalRevenue: 0
      });
      expect(result.id).toBeDefined();
    });
  });

  describe('purchasePPVEvent', () => {
    it('should purchase PPV event successfully', async () => {
      const mockEventId = uuidv4();
      const mockEvent = {
        id: mockEventId,
        price: 19.99,
        currency: 'USD',
        purchase_deadline: new Date(Date.now() + 3600000), // 1 hour from now
        start_time: new Date(Date.now() + 7200000), // 2 hours from now
        access_duration: 24,
        channel_id: mockChannelId
      };

      // Mock database calls
      mockDb
        .mockReturnValueOnce({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockEvent) // Event lookup
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue([]) // Purchase insert
        })
        .mockReturnValueOnce({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({
            id: 'purchase-123',
            event_id: mockEventId,
            viewer_id: mockViewerId,
            price: 19.99
          }) // Purchase lookup for completion
        })
        .mockReturnValueOnce({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockEvent) // Event lookup for completion
        })
        .mockReturnValueOnce({
          where: jest.fn().mockReturnThis(),
          update: jest.fn().mockResolvedValue([]) // Purchase update
        })
        .mockReturnValueOnce({
          where: jest.fn().mockReturnThis(),
          increment: jest.fn().mockReturnThis()
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue([]) // Revenue tracking
        });

      const result = await monetizationEngine.purchasePPVEvent(
        mockViewerId,
        mockEventId,
        'payment-method-123'
      );

      expect(result).toMatchObject({
        viewerId: mockViewerId,
        eventId: mockEventId,
        price: 19.99,
        currency: 'USD',
        paymentStatus: 'pending'
      });
      expect(result.id).toBeDefined();
    });

    it('should throw error when purchase deadline has passed', async () => {
      const mockEventId = uuidv4();
      const mockEvent = {
        id: mockEventId,
        purchase_deadline: new Date(Date.now() - 3600000) // 1 hour ago
      };

      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockEvent)
      });

      await expect(
        monetizationEngine.purchasePPVEvent(mockViewerId, mockEventId, 'payment-method-123')
      ).rejects.toThrow('Purchase deadline has passed');
    });

    it('should throw error when event not found', async () => {
      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null)
      });

      await expect(
        monetizationEngine.purchasePPVEvent(mockViewerId, 'non-existent-event', 'payment-method-123')
      ).rejects.toThrow('PPV event not found');
    });
  });

  describe('generateRevenueReport', () => {
    it('should generate comprehensive revenue report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const mockRevenueRecords = [
        { amount: '100.00', source: 'advertising' },
        { amount: '50.00', source: 'subscription' },
        { amount: '25.00', source: 'ppv' },
        { amount: '10.00', source: 'advertising' }
      ];

      const mockAdBreaks = [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'failed' }
      ];

      const mockActiveSubscribers = { count: '150' };

      const mockPPVEvents = [
        { total_purchases: 5, total_revenue: 99.95 },
        { total_purchases: 3, total_revenue: 59.97 }
      ];

      mockDb
        .mockReturnValueOnce({
          where: jest.fn().mockReturnThis(),
          whereBetween: jest.fn().mockReturnThis(),
          mockResolvedValue: mockRevenueRecords
        })
        .mockReturnValueOnce({
          where: jest.fn().mockReturnThis(),
          whereBetween: jest.fn().mockReturnThis(),
          mockResolvedValue: mockAdBreaks
        })
        .mockReturnValueOnce({
          join: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          count: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockActiveSubscribers)
        })
        .mockReturnValueOnce({
          where: jest.fn().mockReturnThis(),
          whereBetween: jest.fn().mockReturnThis(),
          mockResolvedValue: mockPPVEvents
        });

      // Mock the actual database calls
      mockDb.mockImplementation((table: string) => {
        if (table === 'revenue_records') {
          return {
            where: () => ({ whereBetween: () => mockRevenueRecords })
          };
        }
        if (table === 'ad_breaks') {
          return {
            where: () => ({ whereBetween: () => mockAdBreaks })
          };
        }
        if (table === 'viewer_subscriptions') {
          return {
            join: () => ({
              where: () => ({
                count: () => ({ first: () => mockActiveSubscribers })
              })
            })
          };
        }
        if (table === 'ppv_events') {
          return {
            where: () => ({ whereBetween: () => mockPPVEvents })
          };
        }
        return {};
      });

      const result = await monetizationEngine.generateRevenueReport(mockChannelId, startDate, endDate);

      expect(result).toMatchObject({
        channelId: mockChannelId,
        reportPeriod: { start: startDate, end: endDate },
        totalRevenue: 185,
        adRevenue: 110,
        subscriptionRevenue: 50,
        ppvRevenue: 25,
        otherRevenue: 0
      });
      expect(result.generatedAt).toBeDefined();
    });
  });

  describe('getMonetizationConfig', () => {
    it('should return existing config', async () => {
      const mockConfig = {
        channel_id: mockChannelId,
        ad_insertion_enabled: true,
        ad_break_frequency: 10,
        max_ad_duration: 60,
        allowed_ad_types: '["pre-roll", "mid-roll"]',
        subscription_required: false,
        allowed_subscription_tiers: '[]',
        free_trial_duration: null,
        ppv_enabled: true,
        default_event_price: 9.99,
        currency: 'USD',
        revenue_share_percentage: 25,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockConfig)
      });

      const result = await monetizationEngine.getMonetizationConfig(mockChannelId);

      expect(result).toMatchObject({
        channelId: mockChannelId,
        adInsertionEnabled: true,
        adBreakFrequency: 10,
        maxAdDuration: 60,
        allowedAdTypes: ['pre-roll', 'mid-roll'],
        subscriptionRequired: false,
        ppvEnabled: true,
        defaultEventPrice: 9.99,
        currency: 'USD',
        revenueSharePercentage: 25
      });
    });

    it('should create default config when none exists', async () => {
      mockDb
        .mockReturnValueOnce({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(null) // No existing config
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue([]) // Insert default config
        })
        .mockReturnValueOnce({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({
            channel_id: mockChannelId,
            ad_insertion_enabled: false,
            ad_break_frequency: 15,
            max_ad_duration: 120,
            allowed_ad_types: '["mid-roll"]',
            subscription_required: false,
            allowed_subscription_tiers: '[]',
            free_trial_duration: null,
            ppv_enabled: false,
            default_event_price: 0,
            currency: 'USD',
            revenue_share_percentage: 30,
            created_at: new Date(),
            updated_at: new Date()
          })
        });

      const result = await monetizationEngine.getMonetizationConfig(mockChannelId);

      expect(result).toMatchObject({
        channelId: mockChannelId,
        adInsertionEnabled: false,
        adBreakFrequency: 15,
        maxAdDuration: 120,
        allowedAdTypes: ['mid-roll'],
        subscriptionRequired: false,
        ppvEnabled: false,
        defaultEventPrice: 0,
        currency: 'USD',
        revenueSharePercentage: 30
      });
    });
  });

  describe('updateMonetizationConfig', () => {
    it('should update config successfully', async () => {
      const updates = {
        adInsertionEnabled: true,
        adBreakFrequency: 8,
        subscriptionRequired: true
      };

      const updatedConfig = {
        channel_id: mockChannelId,
        ad_insertion_enabled: true,
        ad_break_frequency: 8,
        max_ad_duration: 120,
        allowed_ad_types: '["mid-roll"]',
        subscription_required: true,
        allowed_subscription_tiers: '[]',
        free_trial_duration: null,
        ppv_enabled: false,
        default_event_price: 0,
        currency: 'USD',
        revenue_share_percentage: 30,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb
        .mockReturnValueOnce({
          where: jest.fn().mockReturnThis(),
          update: jest.fn().mockResolvedValue([]) // Update operation
        })
        .mockReturnValueOnce({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(updatedConfig) // Get updated config
        });

      const result = await monetizationEngine.updateMonetizationConfig(mockChannelId, updates);

      expect(result).toMatchObject({
        channelId: mockChannelId,
        adInsertionEnabled: true,
        adBreakFrequency: 8,
        subscriptionRequired: true
      });
    });
  });
});