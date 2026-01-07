import { ChannelModel } from '../models/Channel';
import { StreamProcessModel } from '../models/StreamProcess';
import { ClientSubscriptionModel } from '../models/SubscriptionPlan';
import { PlayoutEngine, FFmpegConfig } from './PlayoutEngine';
import { StreamManager } from './StreamManager';
import { ConcurrentOperationsManager } from './ConcurrentOperationsManager';
import { FallbackVideoManager } from '../utils/fallback';
import { 
  Channel, 
  ChannelStatus, 
  CreateChannelRequest, 
  UpdateChannelRequest,
  BulkOperationRequest,
  BulkOperationResult,
  ResourceConstraints
} from '../types/channel';
import { logger } from '../utils/logger';

export interface ChannelManagerInterface {
  createChannel(clientId: string, config: CreateChannelRequest): Promise<Channel>;
  startChannel(channelId: string): Promise<void>;
  stopChannel(channelId: string): Promise<void>;
  restartChannel(channelId: string): Promise<void>;
  updateChannel(channelId: string, updates: UpdateChannelRequest): Promise<Channel>;
  getChannelStatus(channelId: string): Promise<ChannelStatus>;
  getChannel(channelId: string): Promise<Channel>;
  getChannelsByClient(clientId: string): Promise<Channel[]>;
  deleteChannel(channelId: string): Promise<void>;
  enforceSubscriptionLimits(clientId: string, operation: string): Promise<boolean>;
  testRTMPConnectivity(channelId: string): Promise<{
    destinationId: string;
    platform: string;
    connected: boolean;
    error?: string | undefined;
  }[]>;
  
  // Concurrent operations
  bulkStartChannels(clientId: string, request: BulkOperationRequest): Promise<BulkOperationResult>;
  bulkStopChannels(clientId: string, request: BulkOperationRequest): Promise<BulkOperationResult>;
  bulkRestartChannels(clientId: string, request: BulkOperationRequest): Promise<BulkOperationResult>;
  bulkDeleteChannels(clientId: string, request: BulkOperationRequest): Promise<BulkOperationResult>;
  getBulkOperationStatus(operationId: string): Promise<BulkOperationResult>;
  getResourceConstraints(): Promise<ResourceConstraints>;
  checkResourceAvailability(clientId: string, operationType: string): Promise<boolean>;
}

export class ChannelManager implements ChannelManagerInterface {
  private playoutEngine: PlayoutEngine;
  private streamManager: StreamManager;
  private concurrentOpsManager: ConcurrentOperationsManager;

  constructor() {
    this.playoutEngine = new PlayoutEngine();
    this.streamManager = new StreamManager();
    this.concurrentOpsManager = new ConcurrentOperationsManager();
    this.setupEventHandlers();
  }
  /**
   * Create a new channel with validation and subscription enforcement
   */
  async createChannel(clientId: string, config: CreateChannelRequest): Promise<Channel> {
    logger.info(`Creating channel for client ${clientId}`, { config });
    
    try {
      // Enforce subscription limits before creation
      await this.enforceSubscriptionLimits(clientId, 'CREATE_CHANNEL');
      
      // Create channel using the model (which handles all validation)
      const channel = await ChannelModel.create(clientId, config);
      
      logger.info(`Channel created successfully`, { channelId: channel.id, clientId });
      
      return channel;
    } catch (error: any) {
      logger.error(`Failed to create channel for client ${clientId}`, { error: error.message, config });
      throw error;
    }
  }
  
  /**
   * Start a channel - transition from STOPPED to STARTING to LIVE
   */
  async startChannel(channelId: string): Promise<void> {
    logger.info(`Starting channel ${channelId}`);
    
    try {
      const channel = await ChannelModel.findById(channelId);
      
      // Validate current status allows starting
      if (channel.status === 'LIVE') {
        throw new Error('Channel is already live');
      }
      
      if (channel.status === 'STARTING') {
        throw new Error('Channel is already starting');
      }
      
      // Enforce concurrent channel limits
      await this.enforceSubscriptionLimits(channel.clientId, 'START_CHANNEL');
      
      // Update status to STARTING
      await ChannelModel.updateStatus(channelId, 'STARTING');
      
      // Create or update stream process
      let streamProcess = await StreamProcessModel.findByChannelId(channelId);
      
      if (!streamProcess) {
        // Create new stream process
        const inputSource = await FallbackVideoManager.getFallbackVideoPath(channel.config.fallbackVideo);
        const outputTargets = this.buildOutputTargets(channel);
        
        streamProcess = await StreamProcessModel.create(channelId, inputSource, outputTargets);
        logger.info(`Created stream process for channel ${channelId}`, { processId: streamProcess.id });
      } else {
        // Update existing process
        await StreamProcessModel.updateStatus(streamProcess.id, 'STARTING');
        logger.info(`Updated existing stream process for channel ${channelId}`, { processId: streamProcess.id });
      }
      
      // Initialize FFmpeg process using PlayoutEngine
      const ffmpegConfig: FFmpegConfig = {
        inputSource: streamProcess.inputSource,
        outputTargets: streamProcess.outputTargets,
        resolution: this.getResolutionString(channel.config.resolution),
        bitrate: channel.config.bitrate,
        hlsSegmentDuration: 6,
        hlsPlaylistSize: 10
      };
      
      await this.playoutEngine.initializeStream(channelId, ffmpegConfig);
      
      // Update channel status to LIVE
      await ChannelModel.updateStatus(channelId, 'LIVE');
      
      logger.info(`Channel ${channelId} started successfully`);
      
    } catch (error: any) {
      logger.error(`Failed to start channel ${channelId}`, { error: error.message });
      
      // Update status to ERROR on failure
      try {
        await ChannelModel.updateStatus(channelId, 'ERROR');
      } catch (statusError: any) {
        logger.error(`Failed to update channel status to ERROR`, { channelId, error: statusError.message });
      }
      
      throw error;
    }
  }
  
  /**
   * Stop a channel - transition from LIVE to STOPPED
   */
  async stopChannel(channelId: string): Promise<void> {
    logger.info(`Stopping channel ${channelId}`);
    
    try {
      const channel = await ChannelModel.findById(channelId);
      
      // Validate current status allows stopping
      if (channel.status === 'STOPPED') {
        logger.warn(`Channel ${channelId} is already stopped`);
        return;
      }
      
      // Find and stop stream process
      const streamProcess = await StreamProcessModel.findByChannelId(channelId);
      
      if (streamProcess && streamProcess.status === 'RUNNING') {
        await this.playoutEngine.terminateStream(channelId);
        logger.info(`Stopped stream process for channel ${channelId}`, { processId: streamProcess.id });
      }
      
      // Calculate uptime if channel was live
      if (channel.status === 'LIVE' && channel.lastStartTime) {
        const uptimeSeconds = Math.floor((Date.now() - channel.lastStartTime.getTime()) / 1000);
        await ChannelModel.updateUptime(channelId, uptimeSeconds);
        logger.info(`Updated uptime for channel ${channelId}`, { uptimeSeconds });
      }
      
      // Update channel status to STOPPED
      await ChannelModel.updateStatus(channelId, 'STOPPED');
      
      logger.info(`Channel ${channelId} stopped successfully`);
      
    } catch (error: any) {
      logger.error(`Failed to stop channel ${channelId}`, { error: error.message });
      throw error;
    }
  }
  
  /**
   * Restart a channel - stop then start
   */
  async restartChannel(channelId: string): Promise<void> {
    logger.info(`Restarting channel ${channelId}`);
    
    try {
      const channel = await ChannelModel.findById(channelId);
      
      // Only restart if channel is currently live or in error state
      if (channel.status === 'LIVE' || channel.status === 'ERROR') {
        await this.playoutEngine.restartStream(channelId);
        
        // Increment restart count
        await ChannelModel.incrementRestartCount(channelId);
        
        logger.info(`Channel ${channelId} restarted successfully`);
      } else {
        throw new Error(`Cannot restart channel in ${channel.status} state`);
      }
      
    } catch (error: any) {
      logger.error(`Failed to restart channel ${channelId}`, { error: error.message });
      throw error;
    }
  }
  
  /**
   * Update channel configuration
   */
  async updateChannel(channelId: string, updates: UpdateChannelRequest): Promise<Channel> {
    logger.info(`Updating channel ${channelId}`, { updates });
    
    try {
      const channel = await ChannelModel.update(channelId, updates);
      
      // If channel is live and output configuration changed, restart may be needed
      if (channel.status === 'LIVE' && this.requiresRestart(updates)) {
        logger.info(`Channel ${channelId} requires restart due to configuration changes`);
        await this.restartChannel(channelId);
      }
      
      logger.info(`Channel ${channelId} updated successfully`);
      
      return channel;
    } catch (error: any) {
      logger.error(`Failed to update channel ${channelId}`, { error: error.message, updates });
      throw error;
    }
  }
  
  /**
   * Get current channel status
   */
  async getChannelStatus(channelId: string): Promise<ChannelStatus> {
    try {
      const channel = await ChannelModel.findById(channelId);
      return channel.status;
    } catch (error: any) {
      logger.error(`Failed to get channel status for ${channelId}`, { error: error.message });
      throw error;
    }
  }
  
  /**
   * Get channel by ID
   */
  async getChannel(channelId: string): Promise<Channel> {
    try {
      return await ChannelModel.findById(channelId);
    } catch (error: any) {
      logger.error(`Failed to get channel ${channelId}`, { error: error.message });
      throw error;
    }
  }
  
  /**
   * Get all channels for a client
   */
  async getChannelsByClient(clientId: string): Promise<Channel[]> {
    try {
      return await ChannelModel.findByClientId(clientId);
    } catch (error: any) {
      logger.error(`Failed to get channels for client ${clientId}`, { error: error.message });
      throw error;
    }
  }
  
  /**
   * Delete a channel
   */
  async deleteChannel(channelId: string): Promise<void> {
    logger.info(`Deleting channel ${channelId}`);
    
    try {
      const channel = await ChannelModel.findById(channelId);
      
      // Stop channel if it's running
      if (channel.status === 'LIVE' || channel.status === 'STARTING') {
        await this.stopChannel(channelId);
      }
      
      // Clean up stream process
      await StreamProcessModel.deleteByChannelId(channelId);
      
      // Delete channel
      await ChannelModel.delete(channelId);
      
      logger.info(`Channel ${channelId} deleted successfully`);
      
    } catch (error: any) {
      logger.error(`Failed to delete channel ${channelId}`, { error: error.message });
      throw error;
    }
  }
  
  /**
   * Enforce subscription limits for various operations
   */
  async enforceSubscriptionLimits(clientId: string, operation: string): Promise<boolean> {
    try {
      const subscriptionData = await ClientSubscriptionModel.getSubscriptionWithPlan(clientId);
      
      if (!subscriptionData) {
        throw new Error('No active subscription found for client');
      }
      
      const { subscription, plan } = subscriptionData;
      
      // Check if subscription is active
      if (subscription.status === 'SUSPENDED' || subscription.status === 'CANCELLED') {
        throw new Error('Subscription is not active');
      }
      
      // Check if subscription has expired
      if (subscription.endDate < new Date()) {
        throw new Error('Subscription has expired');
      }
      
      switch (operation) {
        case 'CREATE_CHANNEL':
          return await this.enforceChannelLimit(clientId, plan.channelLimit);
          
        case 'START_CHANNEL':
          return await this.enforceConcurrentChannelLimit(clientId, plan.concurrentChannels);
          
        default:
          logger.warn(`Unknown operation for subscription limit enforcement: ${operation}`);
          return true;
      }
      
    } catch (error: any) {
      logger.error(`Subscription limit enforcement failed for client ${clientId}`, { 
        operation, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Test RTMP connectivity for all destinations
   */
  async testRTMPConnectivity(channelId: string): Promise<{
    destinationId: string;
    platform: string;
    connected: boolean;
    error?: string | undefined;
  }[]> {
    logger.info(`Testing RTMP connectivity for channel ${channelId}`);

    try {
      const channel = await ChannelModel.findById(channelId);
      const results: {
        destinationId: string;
        platform: string;
        connected: boolean;
        error?: string | undefined;
      }[] = [];

      for (const destination of channel.config.rtmpDestinations) {
        if (!destination.enabled) {
          results.push({
            destinationId: destination.id,
            platform: destination.platform,
            connected: false,
            error: 'Destination disabled'
          });
          continue;
        }

        try {
          const isConnected = await this.streamManager.validateRTMPConnection(destination);
          results.push({
            destinationId: destination.id,
            platform: destination.platform,
            connected: isConnected,
            error: isConnected ? undefined : 'Connection test failed'
          });

          logger.info(`RTMP connectivity test result for ${destination.platform}`, {
            destinationId: destination.id,
            connected: isConnected
          });

        } catch (error: any) {
          results.push({
            destinationId: destination.id,
            platform: destination.platform,
            connected: false,
            error: error.message
          });

          logger.error(`RTMP connectivity test error for ${destination.platform}`, {
            destinationId: destination.id,
            error: error.message
          });
        }
      }

      return results;

    } catch (error: any) {
      logger.error(`Failed to test RTMP connectivity for channel ${channelId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Bulk start multiple channels with priority and resource management
   */
  async bulkStartChannels(clientId: string, request: BulkOperationRequest): Promise<BulkOperationResult> {
    logger.info(`Starting bulk channel start operation for client ${clientId}`, {
      channelCount: request.channelIds.length,
      priority: request.priority
    });

    try {
      // Validate channels belong to client
      await this.validateChannelOwnership(clientId, request.channelIds);

      // Check resource availability
      const resourcesAvailable = await this.checkResourceAvailability(clientId, 'BULK_START');
      if (!resourcesAvailable) {
        throw new Error('Insufficient resources for bulk start operation');
      }

      // Queue the operation
      const operationId = await this.concurrentOpsManager.queueBulkOperation(clientId, request);

      // Execute the operation
      const result = await this.concurrentOpsManager.executeBulkOperation(
        operationId,
        async (channelId: string) => {
          await this.startChannel(channelId);
        }
      );

      logger.info(`Bulk start operation completed`, {
        operationId,
        successCount: result.successCount,
        failureCount: result.failureCount
      });

      return result;

    } catch (error: any) {
      logger.error(`Bulk start operation failed for client ${clientId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Bulk stop multiple channels
   */
  async bulkStopChannels(clientId: string, request: BulkOperationRequest): Promise<BulkOperationResult> {
    logger.info(`Starting bulk channel stop operation for client ${clientId}`, {
      channelCount: request.channelIds.length
    });

    try {
      // Validate channels belong to client
      await this.validateChannelOwnership(clientId, request.channelIds);

      // Queue the operation
      const operationId = await this.concurrentOpsManager.queueBulkOperation(clientId, request);

      // Execute the operation
      const result = await this.concurrentOpsManager.executeBulkOperation(
        operationId,
        async (channelId: string) => {
          await this.stopChannel(channelId);
        }
      );

      logger.info(`Bulk stop operation completed`, {
        operationId,
        successCount: result.successCount,
        failureCount: result.failureCount
      });

      return result;

    } catch (error: any) {
      logger.error(`Bulk stop operation failed for client ${clientId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Bulk restart multiple channels
   */
  async bulkRestartChannels(clientId: string, request: BulkOperationRequest): Promise<BulkOperationResult> {
    logger.info(`Starting bulk channel restart operation for client ${clientId}`, {
      channelCount: request.channelIds.length
    });

    try {
      // Validate channels belong to client
      await this.validateChannelOwnership(clientId, request.channelIds);

      // Check resource availability for restart operations
      const resourcesAvailable = await this.checkResourceAvailability(clientId, 'BULK_RESTART');
      if (!resourcesAvailable) {
        throw new Error('Insufficient resources for bulk restart operation');
      }

      // Queue the operation
      const operationId = await this.concurrentOpsManager.queueBulkOperation(clientId, request);

      // Execute the operation
      const result = await this.concurrentOpsManager.executeBulkOperation(
        operationId,
        async (channelId: string) => {
          await this.restartChannel(channelId);
        }
      );

      logger.info(`Bulk restart operation completed`, {
        operationId,
        successCount: result.successCount,
        failureCount: result.failureCount
      });

      return result;

    } catch (error: any) {
      logger.error(`Bulk restart operation failed for client ${clientId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Bulk delete multiple channels
   */
  async bulkDeleteChannels(clientId: string, request: BulkOperationRequest): Promise<BulkOperationResult> {
    logger.info(`Starting bulk channel delete operation for client ${clientId}`, {
      channelCount: request.channelIds.length
    });

    try {
      // Validate channels belong to client
      await this.validateChannelOwnership(clientId, request.channelIds);

      // Queue the operation
      const operationId = await this.concurrentOpsManager.queueBulkOperation(clientId, request);

      // Execute the operation
      const result = await this.concurrentOpsManager.executeBulkOperation(
        operationId,
        async (channelId: string) => {
          await this.deleteChannel(channelId);
        }
      );

      logger.info(`Bulk delete operation completed`, {
        operationId,
        successCount: result.successCount,
        failureCount: result.failureCount
      });

      return result;

    } catch (error: any) {
      logger.error(`Bulk delete operation failed for client ${clientId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Get bulk operation status
   */
  async getBulkOperationStatus(operationId: string): Promise<BulkOperationResult> {
    const result = this.concurrentOpsManager.getOperationStatus(operationId);
    if (!result) {
      throw new Error('Operation not found');
    }
    return result;
  }

  /**
   * Get current resource constraints
   */
  async getResourceConstraints(): Promise<ResourceConstraints> {
    return this.concurrentOpsManager.getResourceConstraints();
  }

  /**
   * Check resource availability for operations
   */
  async checkResourceAvailability(clientId: string, operationType: string): Promise<boolean> {
    return this.concurrentOpsManager.checkResourceAvailability(clientId, operationType);
  }

  /**
   * Set up event handlers for PlayoutEngine and StreamManager
   */
  private setupEventHandlers(): void {
    // PlayoutEngine events
    this.playoutEngine.on('streamFailure', async (channelId: string, error: Error) => {
      logger.error(`Stream failure event received for channel ${channelId}`, { error: error.message });
      await ChannelModel.updateStatus(channelId, 'ERROR');
    });

    this.playoutEngine.on('maxRestartsExceeded', async (channelId: string) => {
      logger.error(`Max restarts exceeded for channel ${channelId}`);
      await ChannelModel.updateStatus(channelId, 'ERROR');
    });

    this.playoutEngine.on('rtmpConnectionFailure', async (channelId: string, errorOutput: string) => {
      logger.warn(`RTMP connection failure for channel ${channelId}`, { errorOutput });
      // Continue streaming to HLS, but log RTMP failure
    });

    this.playoutEngine.on('rtmpConnected', async (channelId: string) => {
      logger.info(`RTMP connection established for channel ${channelId}`);
    });

    // StreamManager events
    this.streamManager.on('streamingStarted', (channelId: string) => {
      logger.info(`Stream manager confirmed streaming started for channel ${channelId}`);
    });

    this.streamManager.on('streamingStopped', (channelId: string) => {
      logger.info(`Stream manager confirmed streaming stopped for channel ${channelId}`);
    });
  }

  /**
   * Build output targets for FFmpeg based on channel configuration
   */
  private buildOutputTargets(channel: Channel): string[] {
    const targets: string[] = [];
    
    // HLS output
    if (channel.config.hlsEnabled) {
      targets.push(`hls:/tmp/hls/${channel.id}/playlist.m3u8`);
    }
    
    // RTMP outputs - construct full RTMP URLs with stream keys
    for (const rtmp of channel.config.rtmpDestinations) {
      if (rtmp.enabled) {
        // Construct full RTMP URL with stream key
        const fullRtmpUrl = `${rtmp.serverUrl}/${rtmp.streamKey}`;
        targets.push(fullRtmpUrl);
        
        logger.info(`Added RTMP output target for channel ${channel.id}`, {
          platform: rtmp.platform,
          serverUrl: rtmp.serverUrl,
          destinationId: rtmp.id
        });
      }
    }
    
    return targets;
  }

  /**
   * Convert resolution enum to FFmpeg resolution string
   */
  private getResolutionString(resolution: string): string {
    switch (resolution) {
      case 'SD':
        return '720x480';
      case 'HD':
        return '1280x720';
      case 'FHD':
        return '1920x1080';
      default:
        return '1280x720';
    }
  }
  
  /**
   * Check if configuration changes require channel restart
   */
  private requiresRestart(updates: UpdateChannelRequest): boolean {
    // Changes that require restart
    const restartRequiredFields: (keyof UpdateChannelRequest)[] = [
      'resolution',
      'bitrate',
      'rtmpDestinations',
      'hlsEnabled'
    ];
    
    return restartRequiredFields.some(field => updates[field] !== undefined);
  }
  
  /**
   * Enforce channel limit for client
   */
  private async enforceChannelLimit(clientId: string, limit: number): Promise<boolean> {
    const channels = await ChannelModel.findByClientId(clientId);
    
    if (channels.length >= limit) {
      throw new Error(`Channel limit exceeded. Plan allows ${limit} channels, currently have ${channels.length}`);
    }
    
    return true;
  }
  
  /**
   * Enforce concurrent channel limit for client
   */
  private async enforceConcurrentChannelLimit(clientId: string, limit: number): Promise<boolean> {
    const channels = await ChannelModel.findByClientId(clientId);
    const liveChannels = channels.filter((channel: Channel) => channel.status === 'LIVE' || channel.status === 'STARTING');
    
    if (liveChannels.length >= limit) {
      throw new Error(`Concurrent channel limit exceeded. Plan allows ${limit} concurrent channels, currently have ${liveChannels.length} live`);
    }
    
    return true;
  }

  /**
   * Validate that all channels belong to the specified client
   */
  private async validateChannelOwnership(clientId: string, channelIds: string[]): Promise<void> {
    for (const channelId of channelIds) {
      try {
        const channel = await ChannelModel.findById(channelId);
        if (channel.clientId !== clientId) {
          throw new Error(`Channel ${channelId} does not belong to client ${clientId}`);
        }
      } catch (error: any) {
        throw new Error(`Invalid channel ${channelId}: ${error.message}`);
      }
    }
  }
}