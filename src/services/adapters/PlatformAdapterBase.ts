import { 
  PlatformAdapter, 
  PlatformCredentials, 
  StreamConfig, 
  StreamRequirements, 
  StreamingPlatform, 
  PlatformAnalytics 
} from '../../types/distribution';

/**
 * Base class for platform adapters
 * Provides common functionality and interface implementation
 */
export abstract class PlatformAdapterBase implements PlatformAdapter {
  protected platformName: string;

  constructor(platformName: string) {
    this.platformName = platformName;
  }

  /**
   * Validate platform credentials
   */
  abstract validateCredentials(credentials: PlatformCredentials): Promise<boolean>;

  /**
   * Adapt stream configuration for platform requirements
   */
  adaptStreamConfig(baseConfig: StreamConfig, requirements: StreamRequirements): StreamConfig {
    const adaptedConfig: StreamConfig = { ...baseConfig };

    // Enforce bitrate limits
    if (adaptedConfig.bitrate > requirements.maxBitrate) {
      adaptedConfig.bitrate = requirements.maxBitrate;
    }

    // Enforce resolution limits
    const [maxWidth, maxHeight] = requirements.maxResolution.split('x').map(Number);
    const [currentWidth, currentHeight] = adaptedConfig.resolution.split('x').map(Number);
    
    if (currentWidth > maxWidth || currentHeight > maxHeight) {
      adaptedConfig.resolution = requirements.maxResolution;
    }

    // Enforce codec requirements
    if (!requirements.supportedCodecs.includes(adaptedConfig.codec)) {
      adaptedConfig.codec = requirements.supportedCodecs[0];
    }

    // Apply custom parameters
    if (requirements.customParameters) {
      adaptedConfig.customParameters = {
        ...adaptedConfig.customParameters,
        ...requirements.customParameters
      };
    }

    return adaptedConfig;
  }

  /**
   * Start streaming to platform
   */
  abstract startStream(platform: StreamingPlatform, config: StreamConfig): Promise<void>;

  /**
   * Stop streaming to platform
   */
  abstract stopStream(platform: StreamingPlatform): Promise<void>;

  /**
   * Get analytics from platform
   */
  abstract getAnalytics(platform: StreamingPlatform, startTime: Date, endTime: Date): Promise<PlatformAnalytics>;

  /**
   * Refresh authentication credentials
   */
  abstract refreshAuth(platform: StreamingPlatform): Promise<PlatformCredentials>;

  /**
   * Helper method to validate URL format
   */
  protected validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper method to validate RTMP URL format
   */
  protected validateRtmpUrl(url: string): boolean {
    return url.startsWith('rtmp://') || url.startsWith('rtmps://');
  }

  /**
   * Helper method to create default analytics object
   */
  protected createDefaultAnalytics(platformId: string, channelId: string): PlatformAnalytics {
    return {
      platformId,
      channelId,
      timestamp: new Date(),
      viewers: 0,
      peakViewers: 0,
      totalViews: 0,
      watchTime: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      subscribers: 0,
      streamQuality: 0,
      bufferingEvents: 0,
      disconnections: 0,
      platformSpecificMetrics: {}
    };
  }
}