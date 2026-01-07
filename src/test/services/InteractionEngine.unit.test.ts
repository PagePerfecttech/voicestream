import { InteractionEngine } from '../../services/InteractionEngine';

// Mock the database module
jest.mock('../../config/database', () => ({
  db: jest.fn()
}));

describe('InteractionEngine - Standalone Tests', () => {
  let interactionEngine: InteractionEngine;

  beforeAll(() => {
    interactionEngine = new InteractionEngine();
  });

  describe('Class Instantiation', () => {
    it('should create InteractionEngine instance', () => {
      expect(interactionEngine).toBeInstanceOf(InteractionEngine);
    });

    it('should have all required methods', () => {
      expect(typeof interactionEngine.enableLiveChat).toBe('function');
      expect(typeof interactionEngine.createPoll).toBe('function');
      expect(typeof interactionEngine.votePoll).toBe('function');
      expect(typeof interactionEngine.voteContent).toBe('function');
      expect(typeof interactionEngine.integrateSocialFeed).toBe('function');
      expect(typeof interactionEngine.addSocialFeedItem).toBe('function');
      expect(typeof interactionEngine.triggerEffect).toBe('function');
      expect(typeof interactionEngine.sendChatMessage).toBe('function');
      expect(typeof interactionEngine.trackEngagement).toBe('function');
      expect(typeof interactionEngine.awardPoints).toBe('function');
      expect(typeof interactionEngine.spendPoints).toBe('function');
      expect(typeof interactionEngine.getViewerPoints).toBe('function');
      expect(typeof interactionEngine.getInteractionConfig).toBe('function');
      expect(typeof interactionEngine.updateInteractionConfig).toBe('function');
      expect(typeof interactionEngine.getInteractionMetrics).toBe('function');
    });
  });

  describe('Profanity Filter', () => {
    it('should filter profanity words', () => {
      // Access the private method through any casting for testing
      const engine = interactionEngine as any;
      const filtered = engine.applyProfanityFilter('This contains badword1 and badword2');
      expect(filtered).toBe('This contains ******** and ********');
    });

    it('should handle case insensitive filtering', () => {
      const engine = interactionEngine as any;
      const filtered = engine.applyProfanityFilter('This contains BADWORD1 and BadWord2');
      expect(filtered).toBe('This contains ******** and ********');
    });

    it('should not filter clean messages', () => {
      const engine = interactionEngine as any;
      const filtered = engine.applyProfanityFilter('This is a clean message');
      expect(filtered).toBe('This is a clean message');
    });
  });

  describe('Data Mapping Functions', () => {
    it('should map poll data from database format', () => {
      const engine = interactionEngine as any;
      const dbRow = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        channel_id: '550e8400-e29b-41d4-a716-446655440001',
        question: 'Test question?',
        options: JSON.stringify(['Option 1', 'Option 2']),
        duration: 300,
        display_overlay: true,
        status: 'ACTIVE',
        created_at: '2023-01-01T00:00:00Z',
        end_time: '2023-01-01T00:05:00Z',
        total_votes: 5
      };

      const poll = engine.mapPollFromDb(dbRow);
      expect(poll.id).toBe(dbRow.id);
      expect(poll.channelId).toBe(dbRow.channel_id);
      expect(poll.question).toBe(dbRow.question);
      expect(poll.options).toEqual(['Option 1', 'Option 2']);
      expect(poll.duration).toBe(dbRow.duration);
      expect(poll.displayOverlay).toBe(dbRow.display_overlay);
      expect(poll.status).toBe(dbRow.status);
      expect(poll.totalVotes).toBe(dbRow.total_votes);
    });

    it('should map social feed item from database format', () => {
      const engine = interactionEngine as any;
      const dbRow = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        channel_id: '550e8400-e29b-41d4-a716-446655440001',
        platform: 'twitter',
        content: 'Great stream!',
        author: '@testuser',
        author_avatar: 'https://example.com/avatar.jpg',
        timestamp: '2023-01-01T00:00:00Z',
        likes: 10,
        shares: 5,
        url: 'https://twitter.com/testuser/status/123'
      };

      const item = engine.mapSocialFeedItemFromDb(dbRow);
      expect(item.id).toBe(dbRow.id);
      expect(item.channelId).toBe(dbRow.channel_id);
      expect(item.platform).toBe(dbRow.platform);
      expect(item.content).toBe(dbRow.content);
      expect(item.author).toBe(dbRow.author);
      expect(item.authorAvatar).toBe(dbRow.author_avatar);
      expect(item.likes).toBe(dbRow.likes);
      expect(item.shares).toBe(dbRow.shares);
      expect(item.url).toBe(dbRow.url);
    });

    it('should map chat message from database format', () => {
      const engine = interactionEngine as any;
      const dbRow = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        channel_id: '550e8400-e29b-41d4-a716-446655440001',
        viewer_id: 'viewer123',
        username: 'TestUser',
        message: 'Hello world!',
        timestamp: '2023-01-01T00:00:00Z',
        moderated: false,
        deleted: false
      };

      const message = engine.mapChatMessageFromDb(dbRow);
      expect(message.id).toBe(dbRow.id);
      expect(message.channelId).toBe(dbRow.channel_id);
      expect(message.viewerId).toBe(dbRow.viewer_id);
      expect(message.username).toBe(dbRow.username);
      expect(message.message).toBe(dbRow.message);
      expect(message.moderated).toBe(dbRow.moderated);
      expect(message.deleted).toBe(dbRow.deleted);
    });

    it('should map viewer points from database format', () => {
      const engine = interactionEngine as any;
      const dbRow = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        channel_id: '550e8400-e29b-41d4-a716-446655440001',
        viewer_id: 'viewer123',
        points: 100,
        total_earned: 500,
        total_spent: 400,
        last_activity: '2023-01-01T00:00:00Z'
      };

      const points = engine.mapViewerPointsFromDb(dbRow);
      expect(points.id).toBe(dbRow.id);
      expect(points.channelId).toBe(dbRow.channel_id);
      expect(points.viewerId).toBe(dbRow.viewer_id);
      expect(points.points).toBe(dbRow.points);
      expect(points.totalEarned).toBe(dbRow.total_earned);
      expect(points.totalSpent).toBe(dbRow.total_spent);
    });

    it('should map interaction metrics from database format', () => {
      const engine = interactionEngine as any;
      const dbRow = {
        channel_id: '550e8400-e29b-41d4-a716-446655440001',
        timestamp: '2023-01-01T00:00:00Z',
        active_chat_users: 25,
        total_chat_messages: 150,
        active_polls: 2,
        total_poll_votes: 75,
        content_votes: 30,
        effects_triggered: 10,
        points_distributed: 500,
        badges_earned: 5,
        social_feed_items: 20
      };

      const metrics = engine.mapInteractionMetricsFromDb(dbRow);
      expect(metrics.channelId).toBe(dbRow.channel_id);
      expect(metrics.activeChatUsers).toBe(dbRow.active_chat_users);
      expect(metrics.totalChatMessages).toBe(dbRow.total_chat_messages);
      expect(metrics.activePolls).toBe(dbRow.active_polls);
      expect(metrics.totalPollVotes).toBe(dbRow.total_poll_votes);
      expect(metrics.contentVotes).toBe(dbRow.content_votes);
      expect(metrics.effectsTriggered).toBe(dbRow.effects_triggered);
      expect(metrics.pointsDistributed).toBe(dbRow.points_distributed);
      expect(metrics.badgesEarned).toBe(dbRow.badges_earned);
      expect(metrics.socialFeedItems).toBe(dbRow.social_feed_items);
    });
  });

  describe('Default Configuration', () => {
    it('should return default interaction config when none exists', async () => {
      const mockDb = require('../../config/database').db;
      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ interaction_config: null })
      });

      const config = await interactionEngine.getInteractionConfig('test-channel-id');
      
      expect(config).toEqual({
        chatConfig: {
          enabled: false,
          moderationEnabled: true,
          profanityFilter: true,
          slowMode: 0,
          subscriberOnly: false,
          emoteOnly: false
        },
        pollsEnabled: false,
        votingEnabled: false,
        socialFeedEnabled: false,
        effectsEnabled: false,
        gamificationEnabled: false,
        socialPlatforms: [],
        enabledEffects: []
      });
    });

    it('should parse existing interaction config from database', async () => {
      const existingConfig = {
        chatConfig: {
          enabled: true,
          moderationEnabled: true,
          profanityFilter: false,
          slowMode: 10,
          subscriberOnly: true,
          emoteOnly: false
        },
        pollsEnabled: true,
        votingEnabled: true,
        socialFeedEnabled: false,
        effectsEnabled: true,
        gamificationEnabled: true,
        socialPlatforms: [],
        enabledEffects: ['confetti', 'applause']
      };

      const mockDb = require('../../config/database').db;
      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ 
          interaction_config: JSON.stringify(existingConfig) 
        })
      });

      const config = await interactionEngine.getInteractionConfig('test-channel-id');
      expect(config).toEqual(existingConfig);
    });
  });
});