export type PlatformType = 'youtube' | 'facebook' | 'twitch' | 'custom';
export type StreamingStatus = 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR' | 'DISABLED';
export type AuthStatus = 'VALID' | 'EXPIRED' | 'INVALID' | 'PENDING';

export interface PlatformCredentials {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  secretKey?: string;
  streamKey?: string;
  serverUrl?: string;
  expiresAt?: Date;
}

export interface StreamRequirements {
  maxBitrate: number;
  maxResolution: string;
  supportedCodecs: string[];
  requiresAuth: boolean;
  supportsRTMP: boolean;
  supportsHLS: boolean;
  customParameters?: Record<string, any>;
}

export interface StreamingPlatform {
  id: string;
  channelId: string;
  name: PlatformType;
  displayName: string;
  authCredentials: PlatformCredentials;
  streamRequirements: StreamRequirements;
  enabled: boolean;
  status: StreamingStatus;
  authStatus: AuthStatus;
  lastConnected?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamConfig {
  bitrate: number;
  resolution: string;
  codec: string;
  framerate: number;
  keyframeInterval: number;
  audioCodec: string;
  audioBitrate: number;
  customParameters?: Record<string, any>;
}

export interface PlatformAnalytics {
  platformId: string;
  channelId: string;
  timestamp: Date;
  
  // Viewership
  viewers: number;
  peakViewers: number;
  totalViews: number;
  watchTime: number;
  
  // Engagement
  likes: number;
  comments: number;
  shares: number;
  subscribers: number;
  
  // Technical
  streamQuality: number;
  bufferingEvents: number;
  disconnections: number;
  
  // Platform-specific
  platformSpecificMetrics?: Record<string, any>;
}

export interface UnifiedAnalytics {
  channelId: string;
  timestamp: Date;
  
  // Aggregated metrics across all platforms
  totalViewers: number;
  totalPeakViewers: number;
  totalViews: number;
  totalWatchTime: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSubscribers: number;
  
  // Platform breakdown
  platformBreakdown: {
    [platformId: string]: PlatformAnalytics;
  };
  
  // Performance metrics
  averageStreamQuality: number;
  totalBufferingEvents: number;
  totalDisconnections: number;
  platformSuccessRate: number;
}

export interface DistributionConfig {
  channelId: string;
  platforms: StreamingPlatform[];
  globalStreamConfig: StreamConfig;
  failureHandling: {
    maxRetries: number;
    retryDelay: number;
    continueOnPartialFailure: boolean;
  };
  analytics: {
    enabled: boolean;
    aggregationInterval: number;
    retentionDays: number;
  };
}

export interface PlatformAdapter {
  validateCredentials(credentials: PlatformCredentials): Promise<boolean>;
  adaptStreamConfig(baseConfig: StreamConfig, requirements: StreamRequirements): StreamConfig;
  startStream(platform: StreamingPlatform, config: StreamConfig): Promise<void>;
  stopStream(platform: StreamingPlatform): Promise<void>;
  getAnalytics(platform: StreamingPlatform, startTime: Date, endTime: Date): Promise<PlatformAnalytics>;
  refreshAuth(platform: StreamingPlatform): Promise<PlatformCredentials>;
}

export interface DistributionEngineInterface {
  addPlatform(channelId: string, platform: Omit<StreamingPlatform, 'id' | 'channelId' | 'createdAt' | 'updatedAt'>): Promise<StreamingPlatform>;
  removePlatform(channelId: string, platformId: string): Promise<void>;
  updatePlatform(channelId: string, platformId: string, updates: Partial<StreamingPlatform>): Promise<StreamingPlatform>;
  getPlatforms(channelId: string): Promise<StreamingPlatform[]>;
  
  startDistribution(channelId: string, streamConfig: StreamConfig): Promise<void>;
  stopDistribution(channelId: string): Promise<void>;
  
  adaptStreamForPlatform(channelId: string, platformId: string, baseConfig: StreamConfig): Promise<StreamConfig>;
  validatePlatformCredentials(channelId: string, platformId: string): Promise<boolean>;
  
  getUnifiedAnalytics(channelId: string, startTime?: Date, endTime?: Date): Promise<UnifiedAnalytics>;
  getPlatformAnalytics(channelId: string, platformId: string, startTime?: Date, endTime?: Date): Promise<PlatformAnalytics>;
  
  handlePlatformFailure(channelId: string, platformId: string, error: Error): Promise<void>;
  refreshPlatformAuth(channelId: string, platformId: string): Promise<void>;
}

// Platform-specific configurations
export const PLATFORM_CONFIGS: Record<PlatformType, StreamRequirements> = {
  youtube: {
    maxBitrate: 9000,
    maxResolution: '1920x1080',
    supportedCodecs: ['h264', 'h265'],
    requiresAuth: true,
    supportsRTMP: true,
    supportsHLS: false,
    customParameters: {
      keyframeInterval: 2,
      profile: 'main',
      level: '4.1'
    }
  },
  facebook: {
    maxBitrate: 6000,
    maxResolution: '1920x1080',
    supportedCodecs: ['h264'],
    requiresAuth: true,
    supportsRTMP: true,
    supportsHLS: false,
    customParameters: {
      keyframeInterval: 2,
      profile: 'baseline',
      level: '3.1'
    }
  },
  twitch: {
    maxBitrate: 8000,
    maxResolution: '1920x1080',
    supportedCodecs: ['h264'],
    requiresAuth: true,
    supportsRTMP: true,
    supportsHLS: false,
    customParameters: {
      keyframeInterval: 2,
      profile: 'main',
      level: '4.0'
    }
  },
  custom: {
    maxBitrate: 50000,
    maxResolution: '3840x2160',
    supportedCodecs: ['h264', 'h265', 'vp8', 'vp9'],
    requiresAuth: false,
    supportsRTMP: true,
    supportsHLS: true,
    customParameters: {}
  }
};