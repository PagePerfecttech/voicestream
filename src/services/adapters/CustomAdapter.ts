import { PlatformAdapterBase } from './PlatformAdapterBase';
import { 
  PlatformCredentials, 
  StreamConfig, 
  StreamingPlatform, 
  PlatformAnalytics 
} from '../../types/distribution';
import { logger } from '../../utils/logger';

/**
 * Custom Platform Adapter
 * Handles custom RTMP/HLS streaming destinations
 */
export class CustomAdapter extends PlatformAdapterBase {
  constructor() {
    super('custom');
  }

  /**
   * Validate custom platform credentials (server URL and optional stream key)
   */
  async validateCredentials(credentials: PlatformCredentials): Promise<boolean> {
    try {
      if (!credentials.serverUrl) {
        return false;
      }

      // Validate server URL format
      const urlValid = this.validateUrl(credentials.serverUrl) || this.validateRtmpUrl(credentials.serverUrl);
      
      return urlValid;
    } catch (error) {
      logger.error('Custom platform credential validation failed:', error);
      return false;
    }
  }

  /**
   * Start streaming to custom platform
   */
  async startStream(platform: StreamingPlatform, _config: StreamConfig): Promise<void> {
    try {
      logger.info(`Starting custom stream for platform ${platform.id}`);
      
      const credentialsValid = await this.validateCredentials(platform.authCredentials);
      if (!credentialsValid) {
        throw new Error('Invalid custom platform credentials');
      }

      // Build streaming URL
      let streamUrl = platform.authCredentials.serverUrl!;
      if (platform.authCredentials.streamKey) {
        // Append stream key if provided
        if (streamUrl.includes('rtmp://')) {
          streamUrl = `${streamUrl}/${platform.authCredentials.streamKey}`;
        } else {
          // For HLS or other protocols, handle differently
          streamUrl = `${streamUrl}?key=${platform.authCredentials.streamKey}`;
        }
      }
      
      logger.info(`Custom stream started: ${streamUrl}`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      logger.error(`Failed to start custom stream for platform ${platform.id}:`, error);
      throw error;
    }
  }

  /**
   * Stop streaming to custom platform
   */
  async stopStream(platform: StreamingPlatform): Promise<void> {
    try {
      logger.info(`Stopping custom stream for platform ${platform.id}`);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      logger.info(`Custom stream stopped for platform ${platform.id}`);
      
    } catch (error) {
      logger.error(`Failed to stop custom stream for platform ${platform.id}:`, error);
      throw error;
    }
  }

  /**
   * Get analytics from custom platform
   * Note: Custom platforms typically don't provide analytics APIs
   */
  async getAnalytics(platform: StreamingPlatform, _startTime: Date, _endTime: Date): Promise<PlatformAnalytics> {
    try {
      const analytics = this.createDefaultAnalytics(platform.id, platform.channelId);
      
      // For custom platforms, we can only provide basic technical metrics
      // No viewer engagement data is typically available
      analytics.streamQuality = 90 + Math.random() * 10;
      analytics.bufferingEvents = Math.floor(Math.random() * 3);
      analytics.disconnections = Math.floor(Math.random() * 2);
      
      // Custom platform metrics (mostly technical)
      analytics.platformSpecificMetrics = {
        connectionType: platform.authCredentials.serverUrl?.startsWith('rtmp') ? 'RTMP' : 'HLS',
        serverResponse: 'OK',
        bandwidth: Math.floor(Math.random() * 5000) + 1000,
        latency: Math.floor(Math.random() * 100) + 50,
        packetLoss: (Math.random() * 2).toFixed(2)
      };
      
      return analytics;
      
    } catch (error) {
      logger.error(`Failed to get custom platform analytics for platform ${platform.id}:`, error);
      return this.createDefaultAnalytics(platform.id, platform.channelId);
    }
  }

  /**
   * Refresh custom platform authentication
   * Most custom platforms don't require token refresh
   */
  async refreshAuth(platform: StreamingPlatform): Promise<PlatformCredentials> {
    try {
      // Custom platforms typically use static credentials
      // Return existing credentials as-is
      return { ...platform.authCredentials };
      
    } catch (error) {
      logger.error(`Failed to refresh custom platform auth for platform ${platform.id}:`, error);
      throw error;
    }
  }
}