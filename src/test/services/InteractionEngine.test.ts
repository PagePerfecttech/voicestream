import { InteractionEngine } from '../../services/InteractionEngine';
import { ChatConfig, CreatePollRequest, CreateChatMessageRequest } from '../../types/interaction';
import { db } from '../../config/database';

describe('InteractionEngine', () => {
  let interactionEngine: InteractionEngine;
  const testChannelId = '550e8400-e29b-41d4-a716-446655440000';
  const testClientId = '550e8400-e29b-41d4-a716-446655440001';
  const testViewerId = 'test-viewer-interaction-456';

  beforeAll(async () => {
    interactionEngine = new InteractionEngine();
    
    // Create test channel
    await db('channels').insert({
      id: testChannelId,
      client_id: testClientId,
      name: 'Test Interaction Channel',
      status: 'STOPPED',
      hls_endpoint: `https://example.com/hls/${testChannelId}/playlist.m3u8`,
      interaction_enabled: true
    });
  });

  beforeEach(async () => {
    // Clean up test data
    await db('chat_messages').where('channel_id', testChannelId).del();
    await db('polls').where('channel_id', testChannelId).del();
    await db('poll_votes').where('viewer_id', testViewerId).del();
    await db('content_votes').where('channel_id', testChannelId).del();
    await db('viewer_points').where('channel_id', testChannelId).del();
    await db('engagement_events').where('channel_id', testChannelId).del();
    await db('triggered_effects').where('channel_id', testChannelId).del();
    await db('social_feed_items').where('channel_id', testChannelId).del();
  });

  afterAll(async () => {
    // Final cleanup
    await db('chat_messages').where('channel_id', testChannelId).del();
    await db('polls').where('channel_id', testChannelId).del();
    await db('poll_votes').where('viewer_id', testViewerId).del();
    await db('content_votes').where('channel_id', testChannelId).del();
    await db('viewer_points').where('channel_id', testChannelId).del();
    await db('engagement_events').where('channel_id', testChannelId).del();
    await db('triggered_effects').where('channel_id', testChannelId).del();
    await db('social_feed_items').where('channel_id', testChannelId).del();
    await db('channels').where('id', testChannelId).del();
  });

  describe('enableLiveChat', () => {
    it('should enable live chat with configuration', async () => {
      const chatConfig: ChatConfig = {
        enabled: true,
        moderationEnabled: true,
        profanityFilter: true,
        slowMode: 5,
        subscriberOnly: false,
        emoteOnly: false
      };

      await interactionEngine.enableLiveChat(testChannelId, chatConfig);

      const config = await interactionEngine.getInteractionConfig(testChannelId);
      expect(config.chatConfig).toEqual(chatConfig);
    });
  });

  describe('sendChatMessage', () => {
    it('should send chat message and award points', async () => {
      // Enable chat first
      const chatConfig: ChatConfig = {
        enabled: true,
        moderationEnabled: false,
        profanityFilter: false,
        slowMode: 0,
        subscriberOnly: false,
        emoteOnly: false
      };
      await interactionEngine.enableLiveChat(testChannelId, chatConfig);

      const messageRequest: CreateChatMessageRequest = {
        message: 'Hello, world!',
        username: 'TestUser'
      };

      const chatMessage = await interactionEngine.sendChatMessage(
        testChannelId,
        messageRequest,
        testViewerId
      );

      expect(chatMessage.message).toBe('Hello, world!');
      expect(chatMessage.username).toBe('TestUser');
      expect(chatMessage.viewerId).toBe(testViewerId);

      // Check that points were awarded
      const points = await interactionEngine.getViewerPoints(testChannelId, testViewerId);
      expect(points.points).toBe(1);
      expect(points.totalEarned).toBe(1);
    });

    it('should apply profanity filter when enabled', async () => {
      const chatConfig: ChatConfig = {
        enabled: true,
        moderationEnabled: false,
        profanityFilter: true,
        slowMode: 0,
        subscriberOnly: false,
        emoteOnly: false
      };
      await interactionEngine.enableLiveChat(testChannelId, chatConfig);

      const messageRequest: CreateChatMessageRequest = {
        message: 'This contains badword1 in it',
        username: 'TestUser'
      };

      const chatMessage = await interactionEngine.sendChatMessage(
        testChannelId,
        messageRequest,
        testViewerId
      );

      expect(chatMessage.message).toBe('This contains ******** in it');
    });
  });

  describe('createPoll', () => {
    it('should create a poll and track engagement', async () => {
      const pollRequest: CreatePollRequest = {
        question: 'What is your favorite color?',
        options: ['Red', 'Blue', 'Green', 'Yellow'],
        duration: 300, // 5 minutes
        displayOverlay: true
      };

      const poll = await interactionEngine.createPoll(testChannelId, pollRequest);

      expect(poll.question).toBe(pollRequest.question);
      expect(poll.options).toEqual(pollRequest.options);
      expect(poll.duration).toBe(pollRequest.duration);
      expect(poll.status).toBe('ACTIVE');
      expect(poll.totalVotes).toBe(0);
    });
  });

  describe('votePoll', () => {
    it('should record poll vote and award points', async () => {
      // Create a poll first
      const pollRequest: CreatePollRequest = {
        question: 'Test poll?',
        options: ['Option 1', 'Option 2'],
        duration: 300
      };

      const poll = await interactionEngine.createPoll(testChannelId, pollRequest);

      // Vote on the poll
      await interactionEngine.votePoll(poll.id, testViewerId, 0);

      // Check that vote was recorded
      const vote = await db('poll_votes')
        .where({ poll_id: poll.id, viewer_id: testViewerId })
        .first();

      expect(vote).toBeDefined();
      expect(vote.option_index).toBe(0);

      // Check that points were awarded
      const points = await interactionEngine.getViewerPoints(testChannelId, testViewerId);
      expect(points.points).toBe(5);
    });

    it('should update existing vote instead of creating duplicate', async () => {
      const pollRequest: CreatePollRequest = {
        question: 'Test poll?',
        options: ['Option 1', 'Option 2'],
        duration: 300
      };

      const poll = await interactionEngine.createPoll(testChannelId, pollRequest);

      // Vote twice
      await interactionEngine.votePoll(poll.id, testViewerId, 0);
      await interactionEngine.votePoll(poll.id, testViewerId, 1);

      // Check that only one vote exists
      const votes = await db('poll_votes')
        .where({ poll_id: poll.id, viewer_id: testViewerId });

      expect(votes).toHaveLength(1);
      expect(votes[0].option_index).toBe(1);
    });
  });

  describe('voteContent', () => {
    it('should record content vote and award points', async () => {
      await interactionEngine.voteContent(testChannelId, testViewerId, {
        contentId: 'content-123',
        voteType: 'UPVOTE'
      });

      const vote = await db('content_votes')
        .where({
          channel_id: testChannelId,
          viewer_id: testViewerId,
          content_id: 'content-123'
        })
        .first();

      expect(vote).toBeDefined();
      expect(vote.vote_type).toBe('UPVOTE');

      // Check points were awarded
      const points = await interactionEngine.getViewerPoints(testChannelId, testViewerId);
      expect(points.points).toBe(3);
    });
  });

  describe('triggerEffect', () => {
    it('should trigger effect and deduct points', async () => {
      // First, give the viewer some points
      await interactionEngine.awardPoints(testChannelId, testViewerId, 100, 'Test points');

      // Create a test effect
      const [effect] = await db('viewer_effects').insert({
        name: 'Test Effect',
        type: 'ANIMATION',
        cost: 50,
        duration: 3,
        enabled: true
      }).returning('*');

      await interactionEngine.triggerEffect(testChannelId, {
        viewerId: testViewerId,
        effectId: effect.id
      });

      // Check that points were deducted
      const points = await interactionEngine.getViewerPoints(testChannelId, testViewerId);
      expect(points.points).toBe(50); // 100 - 50
      expect(points.totalSpent).toBe(50);

      // Check that effect was triggered
      const triggeredEffect = await db('triggered_effects')
        .where({
          channel_id: testChannelId,
          viewer_id: testViewerId,
          effect_id: effect.id
        })
        .first();

      expect(triggeredEffect).toBeDefined();
      expect(triggeredEffect.status).toBe('PENDING');
    });

    it('should fail when viewer has insufficient points', async () => {
      // Create a test effect
      const [effect] = await db('viewer_effects').insert({
        name: 'Expensive Effect',
        type: 'ANIMATION',
        cost: 100,
        duration: 3,
        enabled: true
      }).returning('*');

      await expect(
        interactionEngine.triggerEffect(testChannelId, {
          viewerId: testViewerId,
          effectId: effect.id
        })
      ).rejects.toThrow('Insufficient points');
    });
  });

  describe('getViewerPoints', () => {
    it('should create initial points record for new viewer', async () => {
      const points = await interactionEngine.getViewerPoints(testChannelId, 'new-viewer-123');

      expect(points.points).toBe(0);
      expect(points.totalEarned).toBe(0);
      expect(points.totalSpent).toBe(0);
    });
  });

  describe('integrateSocialFeed', () => {
    it('should integrate social media platforms', async () => {
      const platforms = [
        {
          id: 'twitter-1',
          name: 'twitter' as const,
          enabled: true,
          hashtags: ['#test', '#stream'],
          refreshInterval: 60
        }
      ];

      await interactionEngine.integrateSocialFeed(testChannelId, platforms);

      const config = await interactionEngine.getInteractionConfig(testChannelId);
      expect(config.socialFeedEnabled).toBe(true);
      expect(config.socialPlatforms).toEqual(platforms);
    });
  });

  describe('addSocialFeedItem', () => {
    it('should add social feed item', async () => {
      const feedItem = await interactionEngine.addSocialFeedItem(testChannelId, {
        platform: 'twitter',
        content: 'Great stream! #awesome',
        author: '@testuser',
        authorAvatar: 'https://example.com/avatar.jpg',
        timestamp: new Date(),
        likes: 5,
        shares: 2,
        url: 'https://twitter.com/testuser/status/123'
      });

      expect(feedItem.platform).toBe('twitter');
      expect(feedItem.content).toBe('Great stream! #awesome');
      expect(feedItem.author).toBe('@testuser');
    });
  });
});