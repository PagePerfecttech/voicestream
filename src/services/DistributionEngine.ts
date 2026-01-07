import { Knex } from 'knex';
import { 
  DistributionEngineInterface,
  StreamingPlatform,
  StreamConfig,
  UnifiedAnalytics,
  PlatformAnalytics,
  PlatformType,
  StreamingStatus,
  AuthStatus,
  PLATFORM_CONFIGS
} from '../types/distribution';
import { AdapterFactory } from './adapters/AdapterFactory';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Distribution Engine
 * Manages multi-platform streaming distribution and analytics aggregation
 */
export class DistributionEngine implements DistributionEngineInterface {
  private db: Knex;

  constructor(database: Knex) {
    this.db = database;
  }

  /**
   * Add a new streaming platform to a channel
   */
  async addPlatform(
    channelId: string, 
    platform: Omit<StreamingPlatform, 'id' | 'channelId' | 'createdAt' | 'updatedAt'>
  ): Promise<StreamingPlatform> {
    try {
      logger.info(`Adding platform ${platform.name} to channel ${channelId}`);

      // Validate platform type
      if (!AdapterFactory.isSupported(platform.name)) {
        throw new Error(`Unsupported platform type: ${platform.name}`);
      }

      // Get platform requirements
      const requirements = PLATFORM_CONFIGS[platform.name as PlatformType];
      
      // Validate credentials using adapter
      const adapter = AdapterFactory.getAdapter(platform.name as PlatformType);
      const credentialsValid = await adapter.validateCredentials(platform.authCredentials);
      
      const authStatus: AuthStatus = credentialsValid ? 'VALID' : 'INVALID';

      // Insert platform into database
      const [insertedPlatform] = await this.db('streaming_platforms')
        .insert({
          id: uuidv4(),
          channel_id: channelId,
          name: platform.name,
          display_name: platform.displayName,
          auth_credentials: JSON.stringify(platform.authCredentials),
          stream_requirements: JSON.stringify(requirements),
          enabled: platform.enabled,
          status: platform.status || 'DISCONNECTED',
          auth_status: authStatus,
          last_connected: platform.lastConnected || null,
          error_message: platform.errorMessage || null
        })
        .returning('*');

      // Log the addition
      await this.logDistributionEvent(channelId, insertedPlatform.id, 'PLATFORM_ADDED', 'SUCCESS', 
        `Platform ${platform.name} added successfully`);

      return this.mapDbPlatformToInterface(insertedPlatform);

    } catch (error) {
      logger.error(`Failed to add platform to channel ${channelId}:`, error);
      await this.logDistributionEvent(channelId, null, 'PLATFORM_ADD_FAILED', 'FAILURE', 
        `Failed to add platform: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Remove a streaming platform from a channel
   */
  async removePlatform(channelId: string, platformId: string): Promise<void> {
    try {
      logger.info(`Removing platform ${platformId} from channel ${channelId}`);

      // Get platform info before deletion
      const platform = await this.db('streaming_platforms')
        .where({ id: platformId, channel_id: channelId })
        .first();

      if (!platform) {
        throw new Error(`Platform ${platformId} not found for channel ${channelId}`);
      }

      // Stop streaming if currently active
      if (platform.status === 'CONNECTED') {
        await this.stopPlatformStream(platformId);
      }

      // Delete platform from database
      await this.db('streaming_platforms')
        .where({ id: platformId, channel_id: channelId })
        .del();

      await this.logDistributionEvent(channelId, platformId, 'PLATFORM_REMOVED', 'SUCCESS', 
        `Platform ${platform.name} removed successfully`);

    } catch (error) {
      logger.error(`Failed to remove platform ${platformId} from channel ${channelId}:`, error);
      await this.logDistributionEvent(channelId, platformId, 'PLATFORM_REMOVE_FAILED', 'FAILURE', 
        `Failed to remove platform: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Update a streaming platform configuration
   */
  async updatePlatform(
    channelId: string, 
    platformId: string, 
    updates: Partial<StreamingPlatform>
  ): Promise<StreamingPlatform> {
    try {
      logger.info(`Updating platform ${platformId} for channel ${channelId}`);

      // Validate credentials if being updated
      if (updates.authCredentials) {
        const platform = await this.db('streaming_platforms')
          .where({ id: platformId, channel_id: channelId })
          .first();

        if (!platform) {
          throw new Error(`Platform ${platformId} not found for channel ${channelId}`);
        }

        const adapter = AdapterFactory.getAdapter(platform.name as PlatformType);
        const credentialsValid = await adapter.validateCredentials(updates.authCredentials);
        updates.authStatus = credentialsValid ? 'VALID' : 'INVALID';
      }

      // Prepare update data
      const updateData: any = {};
      if (updates.displayName) updateData.display_name = updates.displayName;
      if (updates.authCredentials) updateData.auth_credentials = JSON.stringify(updates.authCredentials);
      if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
      if (updates.status) updateData.status = updates.status;
      if (updates.authStatus) updateData.auth_status = updates.authStatus;
      if (updates.errorMessage !== undefined) updateData.error_message = updates.errorMessage;

      // Update platform in database
      const [updatedPlatform] = await this.db('streaming_platforms')
        .where({ id: platformId, channel_id: channelId })
        .update(updateData)
        .returning('*');

      if (!updatedPlatform) {
        throw new Error(`Platform ${platformId} not found for channel ${channelId}`);
      }

      await this.logDistributionEvent(channelId, platformId, 'PLATFORM_UPDATED', 'SUCCESS', 
        'Platform configuration updated successfully');

      return this.mapDbPlatformToInterface(updatedPlatform);

    } catch (error) {
      logger.error(`Failed to update platform ${platformId} for channel ${channelId}:`, error);
      await this.logDistributionEvent(channelId, platformId, 'PLATFORM_UPDATE_FAILED', 'FAILURE', 
        `Failed to update platform: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get all platforms for a channel
   */
  async getPlatforms(channelId: string): Promise<StreamingPlatform[]> {
    try {
      const platforms = await this.db('streaming_platforms')
        .where({ channel_id: channelId })
        .orderBy('created_at', 'asc');

      return platforms.map(platform => this.mapDbPlatformToInterface(platform));

    } catch (error) {
      logger.error(`Failed to get platforms for channel ${channelId}:`, error);
      throw error;
    }
  }

  /**
   * Start distribution to all enabled platforms for a channel
   */
  async startDistribution(channelId: string, streamConfig: StreamConfig): Promise<void> {
    try {
      logger.info(`Starting distribution for channel ${channelId}`);

      const platforms = await this.getPlatforms(channelId);
      const enabledPlatforms = platforms.filter(p => p.enabled && p.authStatus === 'VALID');

      if (enabledPlatforms.length === 0) {
        logger.warn(`No enabled platforms found for channel ${channelId}`);
        return;
      }

      // Start streaming to each platform
      const startPromises = enabledPlatforms.map(async (platform) => {
        try {
          await this.startPlatformStream(platform, streamConfig);
        } catch (error) {
          logger.error(`Failed to start stream for platform ${platform.id}:`, error);
          await this.handlePlatformFailure(channelId, platform.id, error as Error);
        }
      });

      await Promise.allSettled(startPromises);

      await this.logDistributionEvent(channelId, null, 'DISTRIBUTION_STARTED', 'SUCCESS', 
        `Distribution started for ${enabledPlatforms.length} platforms`);

    } catch (error) {
      logger.error(`Failed to start distribution for channel ${channelId}:`, error);
      await this.logDistributionEvent(channelId, null, 'DISTRIBUTION_START_FAILED', 'FAILURE', 
        `Failed to start distribution: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Stop distribution to all platforms for a channel
   */
  async stopDistribution(channelId: string): Promise<void> {
    try {
      logger.info(`Stopping distribution for channel ${channelId}`);

      const platforms = await this.getPlatforms(channelId);
      const activePlatforms = platforms.filter(p => p.status === 'CONNECTED');

      // Stop streaming to each active platform
      const stopPromises = activePlatforms.map(async (platform) => {
        try {
          await this.stopPlatformStream(platform.id);
        } catch (error) {
          logger.error(`Failed to stop stream for platform ${platform.id}:`, error);
        }
      });

      await Promise.allSettled(stopPromises);

      await this.logDistributionEvent(channelId, null, 'DISTRIBUTION_STOPPED', 'SUCCESS', 
        `Distribution stopped for ${activePlatforms.length} platforms`);

    } catch (error) {
      logger.error(`Failed to stop distribution for channel ${channelId}:`, error);
      await this.logDistributionEvent(channelId, null, 'DISTRIBUTION_STOP_FAILED', 'FAILURE', 
        `Failed to stop distribution: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Adapt stream configuration for a specific platform
   */
  async adaptStreamForPlatform(channelId: string, platformId: string, baseConfig: StreamConfig): Promise<StreamConfig> {
    try {
      const platform = await this.db('streaming_platforms')
        .where({ id: platformId, channel_id: channelId })
        .first();

      if (!platform) {
        throw new Error(`Platform ${platformId} not found for channel ${channelId}`);
      }

      const adapter = AdapterFactory.getAdapter(platform.name as PlatformType);
      const requirements = JSON.parse(platform.stream_requirements);
      
      return adapter.adaptStreamConfig(baseConfig, requirements);

    } catch (error) {
      logger.error(`Failed to adapt stream config for platform ${platformId}:`, error);
      throw error;
    }
  }

  /**
   * Validate platform credentials
   */
  async validatePlatformCredentials(channelId: string, platformId: string): Promise<boolean> {
    try {
      const platform = await this.db('streaming_platforms')
        .where({ id: platformId, channel_id: channelId })
        .first();

      if (!platform) {
        throw new Error(`Platform ${platformId} not found for channel ${channelId}`);
      }

      const adapter = AdapterFactory.getAdapter(platform.name as PlatformType);
      const credentials = JSON.parse(platform.auth_credentials);
      
      const isValid = await adapter.validateCredentials(credentials);
      
      // Update auth status in database
      await this.db('streaming_platforms')
        .where({ id: platformId })
        .update({ auth_status: isValid ? 'VALID' : 'INVALID' });

      return isValid;

    } catch (error) {
      logger.error(`Failed to validate credentials for platform ${platformId}:`, error);
      return false;
    }
  }

  /**
   * Get unified analytics across all platforms for a channel
   */
  async getUnifiedAnalytics(channelId: string, startTime?: Date, endTime?: Date): Promise<UnifiedAnalytics> {
    try {
      const platforms = await this.getPlatforms(channelId);
      const now = new Date();
      const start = startTime || new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
      const end = endTime || now;

      // Get analytics from each platform
      const analyticsPromises = platforms.map(async (platform) => {
        try {
          const adapter = AdapterFactory.getAdapter(platform.name as PlatformType);
          return await adapter.getAnalytics(platform, start, end);
        } catch (error) {
          logger.error(`Failed to get analytics for platform ${platform.id}:`, error);
          return null;
        }
      });

      const platformAnalytics = (await Promise.allSettled(analyticsPromises))
        .map(result => result.status === 'fulfilled' ? result.value : null)
        .filter(analytics => analytics !== null) as PlatformAnalytics[];

      // Aggregate analytics
      const unified: UnifiedAnalytics = {
        channelId,
        timestamp: now,
        totalViewers: 0,
        totalPeakViewers: 0,
        totalViews: 0,
        totalWatchTime: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalSubscribers: 0,
        platformBreakdown: {},
        averageStreamQuality: 0,
        totalBufferingEvents: 0,
        totalDisconnections: 0,
        platformSuccessRate: 0
      };

      let qualitySum = 0;
      let qualityCount = 0;

      platformAnalytics.forEach(analytics => {
        unified.totalViewers += analytics.viewers;
        unified.totalPeakViewers += analytics.peakViewers;
        unified.totalViews += analytics.totalViews;
        unified.totalWatchTime += analytics.watchTime;
        unified.totalLikes += analytics.likes;
        unified.totalComments += analytics.comments;
        unified.totalShares += analytics.shares;
        unified.totalSubscribers += analytics.subscribers;
        unified.totalBufferingEvents += analytics.bufferingEvents;
        unified.totalDisconnections += analytics.disconnections;

        if (analytics.streamQuality > 0) {
          qualitySum += analytics.streamQuality;
          qualityCount++;
        }

        unified.platformBreakdown[analytics.platformId] = analytics;
      });

      unified.averageStreamQuality = qualityCount > 0 ? qualitySum / qualityCount : 0;
      unified.platformSuccessRate = platforms.length > 0 ? 
        (platforms.filter(p => p.status === 'CONNECTED').length / platforms.length) * 100 : 0;

      return unified;

    } catch (error) {
      logger.error(`Failed to get unified analytics for channel ${channelId}:`, error);
      throw error;
    }
  }

  /**
   * Get analytics for a specific platform
   */
  async getPlatformAnalytics(channelId: string, platformId: string, startTime?: Date, endTime?: Date): Promise<PlatformAnalytics> {
    try {
      const platform = await this.db('streaming_platforms')
        .where({ id: platformId, channel_id: channelId })
        .first();

      if (!platform) {
        throw new Error(`Platform ${platformId} not found for channel ${channelId}`);
      }

      const adapter = AdapterFactory.getAdapter(platform.name as PlatformType);
      const mappedPlatform = this.mapDbPlatformToInterface(platform);
      
      const now = new Date();
      const start = startTime || new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const end = endTime || now;

      return await adapter.getAnalytics(mappedPlatform, start, end);

    } catch (error) {
      logger.error(`Failed to get analytics for platform ${platformId}:`, error);
      throw error;
    }
  }

  /**
   * Handle platform failure with retry logic
   */
  async handlePlatformFailure(channelId: string, platformId: string, error: Error): Promise<void> {
    try {
      logger.error(`Platform ${platformId} failed for channel ${channelId}:`, error);

      // Update platform status to ERROR
      await this.db('streaming_platforms')
        .where({ id: platformId })
        .update({ 
          status: 'ERROR',
          error_message: error.message
        });

      // Log the failure
      await this.logDistributionEvent(channelId, platformId, 'PLATFORM_FAILURE', 'FAILURE', error.message);

      // In a real implementation, this could implement retry logic
      // For now, we'll just log and update status

    } catch (dbError) {
      logger.error(`Failed to handle platform failure for ${platformId}:`, dbError);
    }
  }

  /**
   * Refresh authentication for a platform
   */
  async refreshPlatformAuth(channelId: string, platformId: string): Promise<void> {
    try {
      const platform = await this.db('streaming_platforms')
        .where({ id: platformId, channel_id: channelId })
        .first();

      if (!platform) {
        throw new Error(`Platform ${platformId} not found for channel ${channelId}`);
      }

      const adapter = AdapterFactory.getAdapter(platform.name as PlatformType);
      const mappedPlatform = this.mapDbPlatformToInterface(platform);
      
      const newCredentials = await adapter.refreshAuth(mappedPlatform);

      // Update credentials in database
      await this.db('streaming_platforms')
        .where({ id: platformId })
        .update({ 
          auth_credentials: JSON.stringify(newCredentials),
          auth_status: 'VALID'
        });

      await this.logDistributionEvent(channelId, platformId, 'AUTH_REFRESHED', 'SUCCESS', 
        'Platform authentication refreshed successfully');

    } catch (error) {
      logger.error(`Failed to refresh auth for platform ${platformId}:`, error);
      await this.logDistributionEvent(channelId, platformId, 'AUTH_REFRESH_FAILED', 'FAILURE', 
        `Failed to refresh auth: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Start streaming to a specific platform
   */
  private async startPlatformStream(platform: StreamingPlatform, streamConfig: StreamConfig): Promise<void> {
    try {
      // Update status to CONNECTING
      await this.db('streaming_platforms')
        .where({ id: platform.id })
        .update({ status: 'CONNECTING' });

      const adapter = AdapterFactory.getAdapter(platform.name as PlatformType);
      const adaptedConfig = await this.adaptStreamForPlatform(platform.channelId, platform.id, streamConfig);
      
      await adapter.startStream(platform, adaptedConfig);

      // Update status to CONNECTED
      await this.db('streaming_platforms')
        .where({ id: platform.id })
        .update({ 
          status: 'CONNECTED',
          last_connected: new Date(),
          error_message: null
        });

      await this.logDistributionEvent(platform.channelId, platform.id, 'STREAM_STARTED', 'SUCCESS', 
        'Platform stream started successfully');

    } catch (error) {
      await this.handlePlatformFailure(platform.channelId, platform.id, error as Error);
      throw error;
    }
  }

  /**
   * Stop streaming to a specific platform
   */
  private async stopPlatformStream(platformId: string): Promise<void> {
    try {
      const platform = await this.db('streaming_platforms')
        .where({ id: platformId })
        .first();

      if (!platform) {
        throw new Error(`Platform ${platformId} not found`);
      }

      const adapter = AdapterFactory.getAdapter(platform.name as PlatformType);
      const mappedPlatform = this.mapDbPlatformToInterface(platform);
      
      await adapter.stopStream(mappedPlatform);

      // Update status to DISCONNECTED
      await this.db('streaming_platforms')
        .where({ id: platformId })
        .update({ 
          status: 'DISCONNECTED',
          error_message: null
        });

      await this.logDistributionEvent(platform.channel_id, platformId, 'STREAM_STOPPED', 'SUCCESS', 
        'Platform stream stopped successfully');

    } catch (error) {
      logger.error(`Failed to stop platform stream ${platformId}:`, error);
      throw error;
    }
  }

  /**
   * Log distribution events
   */
  private async logDistributionEvent(
    channelId: string, 
    platformId: string | null, 
    eventType: string, 
    status: string, 
    message: string
  ): Promise<void> {
    try {
      await this.db('distribution_logs').insert({
        id: uuidv4(),
        channel_id: channelId,
        platform_id: platformId,
        event_type: eventType,
        status: status,
        message: message,
        metadata: JSON.stringify({}),
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to log distribution event:', error);
    }
  }

  /**
   * Map database platform record to interface
   */
  private mapDbPlatformToInterface(dbPlatform: any): StreamingPlatform {
    return {
      id: dbPlatform.id,
      channelId: dbPlatform.channel_id,
      name: dbPlatform.name as PlatformType,
      displayName: dbPlatform.display_name,
      authCredentials: JSON.parse(dbPlatform.auth_credentials),
      streamRequirements: JSON.parse(dbPlatform.stream_requirements),
      enabled: dbPlatform.enabled,
      status: dbPlatform.status as StreamingStatus,
      authStatus: dbPlatform.auth_status as AuthStatus,
      lastConnected: dbPlatform.last_connected,
      errorMessage: dbPlatform.error_message,
      createdAt: dbPlatform.created_at,
      updatedAt: dbPlatform.updated_at
    };
  }
}