import { db } from '../config/database';
import {
  ChatConfig,
  Poll,
  SocialPlatform,
  SocialFeedItem,
  ViewerPoints,
  ChatMessage,
  EngagementEvent,
  InteractionConfig,
  InteractionMetrics,
  CreatePollRequest,
  CreateChatMessageRequest,
  TriggerEffectRequest,
  VoteContentRequest,
  UpdateInteractionConfigRequest
} from '../types/interaction';

export class InteractionEngine {
  /**
   * Enable live chat for a channel with specified configuration
   */
  async enableLiveChat(channelId: string, config: ChatConfig): Promise<void> {
    try {
      // Update channel's interaction config
      const currentConfig = await this.getInteractionConfig(channelId);
      const updatedConfig: InteractionConfig = {
        ...currentConfig,
        chatConfig: config
      };

      await db('channels')
        .where('id', channelId)
        .update({
          interaction_config: JSON.stringify(updatedConfig),
          updated_at: new Date()
        });

      console.log(`Live chat enabled for channel ${channelId}`);
    } catch (error) {
      console.error('Error enabling live chat:', error);
      throw new Error(`Failed to enable live chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new poll for viewer participation
   */
  async createPoll(channelId: string, pollRequest: CreatePollRequest): Promise<Poll> {
    try {
      const endTime = new Date(Date.now() + pollRequest.duration * 1000);
      
      const [poll] = await db('polls')
        .insert({
          channel_id: channelId,
          question: pollRequest.question,
          options: JSON.stringify(pollRequest.options),
          duration: pollRequest.duration,
          display_overlay: pollRequest.displayOverlay ?? true,
          end_time: endTime,
          status: 'ACTIVE'
        })
        .returning('*');

      // Track engagement event
      await this.trackEngagement(channelId, 'system', 'POLL_VOTE', {
        pollId: poll.id,
        action: 'created'
      }, 0);

      return this.mapPollFromDb(poll);
    } catch (error) {
      console.error('Error creating poll:', error);
      throw new Error(`Failed to create poll: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Vote on a poll
   */
  async votePoll(pollId: string, viewerId: string, optionIndex: number): Promise<void> {
    try {
      // Check if poll is still active
      const poll = await db('polls').where('id', pollId).first();
      if (!poll) {
        throw new Error('Poll not found');
      }
      
      if (poll.status !== 'ACTIVE' || new Date() > new Date(poll.end_time)) {
        throw new Error('Poll is no longer active');
      }

      // Check if user already voted
      const existingVote = await db('poll_votes')
        .where({ poll_id: pollId, viewer_id: viewerId })
        .first();

      if (existingVote) {
        // Update existing vote
        await db('poll_votes')
          .where('id', existingVote.id)
          .update({
            option_index: optionIndex,
            timestamp: new Date()
          });
      } else {
        // Create new vote
        await db('poll_votes').insert({
          poll_id: pollId,
          viewer_id: viewerId,
          option_index: optionIndex
        });

        // Increment total votes
        await db('polls')
          .where('id', pollId)
          .increment('total_votes', 1);
      }

      // Award points for participation
      await this.awardPoints(poll.channel_id, viewerId, 5, 'Poll participation');

      // Track engagement event
      await this.trackEngagement(poll.channel_id, viewerId, 'POLL_VOTE', {
        pollId,
        optionIndex
      }, 5);

      console.log(`Vote recorded for poll ${pollId} by viewer ${viewerId}`);
    } catch (error) {
      console.error('Error voting on poll:', error);
      throw new Error(`Failed to vote on poll: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Vote on upcoming content
   */
  async voteContent(channelId: string, viewerId: string, request: VoteContentRequest): Promise<void> {
    try {
      // Check if user already voted on this content
      const existingVote = await db('content_votes')
        .where({
          channel_id: channelId,
          viewer_id: viewerId,
          content_id: request.contentId
        })
        .first();

      if (existingVote) {
        // Update existing vote
        await db('content_votes')
          .where('id', existingVote.id)
          .update({
            vote_type: request.voteType,
            timestamp: new Date()
          });
      } else {
        // Create new vote
        await db('content_votes').insert({
          channel_id: channelId,
          viewer_id: viewerId,
          content_id: request.contentId,
          vote_type: request.voteType
        });
      }

      // Award points for content engagement
      await this.awardPoints(channelId, viewerId, 3, 'Content voting');

      // Track engagement event
      await this.trackEngagement(channelId, viewerId, 'CONTENT_VOTE', {
        contentId: request.contentId,
        voteType: request.voteType
      }, 3);

      console.log(`Content vote recorded for ${request.contentId} by viewer ${viewerId}`);
    } catch (error) {
      console.error('Error voting on content:', error);
      throw new Error(`Failed to vote on content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Integrate social media feed for a channel
   */
  async integrateSocialFeed(channelId: string, platforms: SocialPlatform[]): Promise<void> {
    try {
      // Update channel's interaction config
      const currentConfig = await this.getInteractionConfig(channelId);
      const updatedConfig: InteractionConfig = {
        ...currentConfig,
        socialFeedEnabled: true,
        socialPlatforms: platforms
      };

      await db('channels')
        .where('id', channelId)
        .update({
          interaction_config: JSON.stringify(updatedConfig),
          updated_at: new Date()
        });

      console.log(`Social feed integrated for channel ${channelId} with ${platforms.length} platforms`);
    } catch (error) {
      console.error('Error integrating social feed:', error);
      throw new Error(`Failed to integrate social feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add social feed item
   */
  async addSocialFeedItem(channelId: string, item: Omit<SocialFeedItem, 'id' | 'channelId'>): Promise<SocialFeedItem> {
    try {
      const [feedItem] = await db('social_feed_items')
        .insert({
          channel_id: channelId,
          platform: item.platform,
          content: item.content,
          author: item.author,
          author_avatar: item.authorAvatar,
          timestamp: item.timestamp,
          likes: item.likes,
          shares: item.shares,
          url: item.url
        })
        .returning('*');

      return this.mapSocialFeedItemFromDb(feedItem);
    } catch (error) {
      console.error('Error adding social feed item:', error);
      throw new Error(`Failed to add social feed item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Trigger viewer effect
   */
  async triggerEffect(channelId: string, request: TriggerEffectRequest): Promise<void> {
    try {
      // Get effect details
      const effect = await db('viewer_effects').where('id', request.effectId).first();
      if (!effect) {
        throw new Error('Effect not found');
      }

      if (!effect.enabled) {
        throw new Error('Effect is disabled');
      }

      // Check if viewer has enough points
      const viewerPoints = await this.getViewerPoints(channelId, request.viewerId);
      if (viewerPoints.points < effect.cost) {
        throw new Error('Insufficient points');
      }

      // Deduct points
      await this.spendPoints(channelId, request.viewerId, effect.cost, `Triggered effect: ${effect.name}`);

      // Create triggered effect record
      await db('triggered_effects').insert({
        channel_id: channelId,
        viewer_id: request.viewerId,
        effect_id: request.effectId,
        status: 'PENDING'
      });

      // Track engagement event
      await this.trackEngagement(channelId, request.viewerId, 'EFFECT_TRIGGER', {
        effectId: request.effectId,
        effectName: effect.name,
        cost: effect.cost
      }, 0);

      console.log(`Effect ${effect.name} triggered by viewer ${request.viewerId}`);
    } catch (error) {
      console.error('Error triggering effect:', error);
      throw new Error(`Failed to trigger effect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send chat message
   */
  async sendChatMessage(channelId: string, request: CreateChatMessageRequest, viewerId: string): Promise<ChatMessage> {
    try {
      // Get chat config
      const config = await this.getInteractionConfig(channelId);
      if (!config.chatConfig.enabled) {
        throw new Error('Chat is disabled for this channel');
      }

      // Check slow mode
      if (config.chatConfig.slowMode > 0) {
        const lastMessage = await db('chat_messages')
          .where({ channel_id: channelId, viewer_id: viewerId })
          .orderBy('timestamp', 'desc')
          .first();

        if (lastMessage) {
          const timeSinceLastMessage = (Date.now() - new Date(lastMessage.timestamp).getTime()) / 1000;
          if (timeSinceLastMessage < config.chatConfig.slowMode) {
            throw new Error(`Slow mode active. Please wait ${Math.ceil(config.chatConfig.slowMode - timeSinceLastMessage)} seconds`);
          }
        }
      }

      // Apply profanity filter if enabled
      let filteredMessage = request.message;
      if (config.chatConfig.profanityFilter) {
        filteredMessage = this.applyProfanityFilter(request.message);
      }

      // Create chat message
      const [message] = await db('chat_messages')
        .insert({
          channel_id: channelId,
          viewer_id: viewerId,
          username: request.username,
          message: filteredMessage
        })
        .returning('*');

      // Award points for chat participation
      await this.awardPoints(channelId, viewerId, 1, 'Chat message');

      // Track engagement event
      await this.trackEngagement(channelId, viewerId, 'CHAT', {
        messageLength: filteredMessage.length
      }, 1);

      return this.mapChatMessageFromDb(message);
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw new Error(`Failed to send chat message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Track engagement event
   */
  async trackEngagement(channelId: string, viewerId: string, eventType: EngagementEvent['eventType'], eventData: Record<string, any>, points: number): Promise<void> {
    try {
      await db('engagement_events').insert({
        channel_id: channelId,
        viewer_id: viewerId,
        event_type: eventType,
        event_data: JSON.stringify(eventData),
        points
      });
    } catch (error) {
      console.error('Error tracking engagement:', error);
      // Don't throw error for tracking failures
    }
  }

  /**
   * Award points to viewer
   */
  async awardPoints(channelId: string, viewerId: string, points: number, _reason: string): Promise<void> {
    try {
      const existingPoints = await db('viewer_points')
        .where({ channel_id: channelId, viewer_id: viewerId })
        .first();

      if (existingPoints) {
        await db('viewer_points')
          .where('id', existingPoints.id)
          .update({
            points: existingPoints.points + points,
            total_earned: existingPoints.total_earned + points,
            last_activity: new Date()
          });
      } else {
        await db('viewer_points').insert({
          channel_id: channelId,
          viewer_id: viewerId,
          points,
          total_earned: points,
          total_spent: 0
        });
      }

      // Check for badge achievements
      await this.checkBadgeAchievements(channelId, viewerId);
    } catch (error) {
      console.error('Error awarding points:', error);
      // Don't throw error for point awarding failures
    }
  }

  /**
   * Spend points
   */
  async spendPoints(channelId: string, viewerId: string, points: number, _reason: string): Promise<void> {
    try {
      const viewerPoints = await db('viewer_points')
        .where({ channel_id: channelId, viewer_id: viewerId })
        .first();

      if (!viewerPoints || viewerPoints.points < points) {
        throw new Error('Insufficient points');
      }

      await db('viewer_points')
        .where('id', viewerPoints.id)
        .update({
          points: viewerPoints.points - points,
          total_spent: viewerPoints.total_spent + points,
          last_activity: new Date()
        });
    } catch (error) {
      console.error('Error spending points:', error);
      throw error;
    }
  }

  /**
   * Get viewer points
   */
  async getViewerPoints(channelId: string, viewerId: string): Promise<ViewerPoints> {
    try {
      const points = await db('viewer_points')
        .where({ channel_id: channelId, viewer_id: viewerId })
        .first();

      if (!points) {
        // Create initial points record
        const [newPoints] = await db('viewer_points')
          .insert({
            channel_id: channelId,
            viewer_id: viewerId,
            points: 0,
            total_earned: 0,
            total_spent: 0
          })
          .returning('*');
        
        return this.mapViewerPointsFromDb(newPoints);
      }

      return this.mapViewerPointsFromDb(points);
    } catch (error) {
      console.error('Error getting viewer points:', error);
      throw new Error(`Failed to get viewer points: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check and award badge achievements
   */
  async checkBadgeAchievements(channelId: string, viewerId: string): Promise<void> {
    try {
      // Get all badges
      const badges = await db('badges').select('*');
      
      // Get viewer's current badges
      const earnedBadges = await db('viewer_badges')
        .where({ viewer_id: viewerId, channel_id: channelId })
        .pluck('badge_id');

      // Get viewer stats
      const viewerPoints = await this.getViewerPoints(channelId, viewerId);
      const chatMessages = await db('chat_messages')
        .where({ channel_id: channelId, viewer_id: viewerId })
        .count('* as count')
        .first();

      for (const badge of badges) {
        if (earnedBadges.includes(badge.id)) {
          continue; // Already earned
        }

        const requirements = JSON.parse(badge.requirements);
        let qualifies = true;

        for (const requirement of requirements) {
          switch (requirement.type) {
            case 'POINTS_EARNED':
              if (viewerPoints.totalEarned < requirement.value) {
                qualifies = false;
              }
              break;
            case 'CHAT_MESSAGES':
              if ((chatMessages?.count || 0) < requirement.value) {
                qualifies = false;
              }
              break;
            // Add more requirement types as needed
          }

          if (!qualifies) break;
        }

        if (qualifies) {
          // Award badge
          await db('viewer_badges').insert({
            viewer_id: viewerId,
            badge_id: badge.id,
            channel_id: channelId
          });

          // Track engagement event
          await this.trackEngagement(channelId, viewerId, 'BADGE_EARNED', {
            badgeId: badge.id,
            badgeName: badge.name
          }, 0);
        }
      }
    } catch (error) {
      console.error('Error checking badge achievements:', error);
      // Don't throw error for badge checking failures
    }
  }

  /**
   * Get interaction configuration for a channel
   */
  async getInteractionConfig(channelId: string): Promise<InteractionConfig> {
    try {
      const channel = await db('channels').where('id', channelId).first();
      if (!channel) {
        throw new Error('Channel not found');
      }

      if (channel.interaction_config) {
        return JSON.parse(channel.interaction_config);
      }

      // Return default config
      return {
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
      };
    } catch (error) {
      console.error('Error getting interaction config:', error);
      throw new Error(`Failed to get interaction config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update interaction configuration
   */
  async updateInteractionConfig(channelId: string, updates: UpdateInteractionConfigRequest): Promise<InteractionConfig> {
    try {
      const currentConfig = await this.getInteractionConfig(channelId);
      const updatedConfig: InteractionConfig = {
        ...currentConfig,
        ...updates,
        chatConfig: updates.chatConfig ? { ...currentConfig.chatConfig, ...updates.chatConfig } : currentConfig.chatConfig
      };

      await db('channels')
        .where('id', channelId)
        .update({
          interaction_config: JSON.stringify(updatedConfig),
          updated_at: new Date()
        });

      return updatedConfig;
    } catch (error) {
      console.error('Error updating interaction config:', error);
      throw new Error(`Failed to update interaction config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get interaction metrics for a channel
   */
  async getInteractionMetrics(channelId: string, startTime?: Date, endTime?: Date): Promise<InteractionMetrics[]> {
    try {
      let query = db('interaction_metrics').where('channel_id', channelId);
      
      if (startTime) {
        query = query.where('timestamp', '>=', startTime);
      }
      
      if (endTime) {
        query = query.where('timestamp', '<=', endTime);
      }

      const metrics = await query.orderBy('timestamp', 'desc');
      return metrics.map(this.mapInteractionMetricsFromDb);
    } catch (error) {
      console.error('Error getting interaction metrics:', error);
      throw new Error(`Failed to get interaction metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply profanity filter to message
   */
  private applyProfanityFilter(message: string): string {
    // Simple profanity filter - in production, use a proper library
    const profanityWords = ['badword1', 'badword2']; // Add actual profanity words
    let filtered = message;
    
    profanityWords.forEach(word => {
      const regex = new RegExp(word, 'gi');
      filtered = filtered.replace(regex, '*'.repeat(word.length));
    });
    
    return filtered;
  }

  // Mapping functions
  private mapPollFromDb(row: any): Poll {
    return {
      id: row.id,
      channelId: row.channel_id,
      question: row.question,
      options: JSON.parse(row.options),
      duration: row.duration,
      displayOverlay: row.display_overlay,
      status: row.status,
      createdAt: new Date(row.created_at),
      endTime: new Date(row.end_time),
      totalVotes: row.total_votes
    };
  }

  private mapSocialFeedItemFromDb(row: any): SocialFeedItem {
    return {
      id: row.id,
      channelId: row.channel_id,
      platform: row.platform,
      content: row.content,
      author: row.author,
      authorAvatar: row.author_avatar,
      timestamp: new Date(row.timestamp),
      likes: row.likes,
      shares: row.shares,
      url: row.url
    };
  }

  private mapChatMessageFromDb(row: any): ChatMessage {
    return {
      id: row.id,
      channelId: row.channel_id,
      viewerId: row.viewer_id,
      username: row.username,
      message: row.message,
      timestamp: new Date(row.timestamp),
      moderated: row.moderated,
      deleted: row.deleted
    };
  }

  private mapViewerPointsFromDb(row: any): ViewerPoints {
    return {
      id: row.id,
      channelId: row.channel_id,
      viewerId: row.viewer_id,
      points: row.points,
      totalEarned: row.total_earned,
      totalSpent: row.total_spent,
      lastActivity: new Date(row.last_activity)
    };
  }

  private mapInteractionMetricsFromDb(row: any): InteractionMetrics {
    return {
      channelId: row.channel_id,
      timestamp: new Date(row.timestamp),
      activeChatUsers: row.active_chat_users,
      totalChatMessages: row.total_chat_messages,
      activePolls: row.active_polls,
      totalPollVotes: row.total_poll_votes,
      contentVotes: row.content_votes,
      effectsTriggered: row.effects_triggered,
      pointsDistributed: row.points_distributed,
      badgesEarned: row.badges_earned,
      socialFeedItems: row.social_feed_items
    };
  }
}