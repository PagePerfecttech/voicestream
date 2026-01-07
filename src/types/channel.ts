export type ChannelStatus = 'STOPPED' | 'STARTING' | 'LIVE' | 'ERROR';
export type Resolution = 'SD' | 'HD' | 'FHD';
export type OutputType = 'HLS' | 'RTMP' | 'SRT';
export type ProcessStatus = 'IDLE' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'ERROR';
export type ClientTier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
export type BulkOperationType = 'START' | 'STOP' | 'RESTART' | 'DELETE';
export type OperationStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface RTMPDestination {
  id: string;
  serverUrl: string;
  streamKey: string;
  platform: 'youtube' | 'facebook' | 'twitch' | 'custom';
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelConfig {
  name: string;
  resolution: Resolution;
  bitrate: number;
  fallbackVideo: string;
  hlsEnabled: boolean;
  rtmpDestinations: RTMPDestination[];
  
  // Feature flags
  analyticsEnabled: boolean;
  monetizationEnabled: boolean;
  aiOptimizationEnabled: boolean;
  multiPlatformEnabled: boolean;
  interactionEnabled: boolean;
}

export interface Channel {
  id: string;
  clientId: string;
  name: string;
  status: ChannelStatus;
  config: ChannelConfig;
  createdAt: Date;
  updatedAt: Date;
  
  // Output Configuration
  hlsEndpoint: string;
  
  // Metrics
  totalUptime: number;
  restartCount: number;
  lastStartTime: Date | null;
  lastStopTime: Date | null;
}

export interface StreamProcess {
  id: string;
  channelId: string;
  ffmpegPid: number | null;
  status: ProcessStatus;
  startTime: Date | null;
  lastHeartbeat: Date | null;
  
  // Configuration
  inputSource: string;
  outputTargets: string[];
  
  // Health Metrics
  cpuUsage: number;
  memoryUsage: number;
  networkBandwidth: number;
  errorCount: number;
  
  // Recovery Configuration
  maxRestarts: number;
  restartDelay: number;
  healthCheckInterval: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  channelLimit: number;
  maxResolution: Resolution;
  outputTypes: OutputType[];
  storageLimit: number; // in GB
  concurrentChannels: number;
  trialAllowed: boolean;
  tier: ClientTier;
  priority: number; // Higher number = higher priority
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientSubscription {
  id: string;
  clientId: string;
  planId: string;
  status: 'TRIAL' | 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'CANCELLED';
  startDate: Date;
  endDate: Date;
  trialEndDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Validation interfaces
export interface CreateChannelRequest {
  name: string;
  resolution: Resolution;
  bitrate?: number;
  fallbackVideo?: string;
  hlsEnabled?: boolean;
  rtmpDestinations?: Omit<RTMPDestination, 'id' | 'createdAt' | 'updatedAt'>[];
  analyticsEnabled?: boolean;
  monetizationEnabled?: boolean;
  aiOptimizationEnabled?: boolean;
  multiPlatformEnabled?: boolean;
  interactionEnabled?: boolean;
}

export interface UpdateChannelRequest {
  name?: string;
  resolution?: Resolution;
  bitrate?: number;
  fallbackVideo?: string;
  hlsEnabled?: boolean;
  rtmpDestinations?: Omit<RTMPDestination, 'id' | 'createdAt' | 'updatedAt'>[];
  analyticsEnabled?: boolean;
  monetizationEnabled?: boolean;
  aiOptimizationEnabled?: boolean;
  multiPlatformEnabled?: boolean;
  interactionEnabled?: boolean;
}

// Concurrent operations interfaces
export interface BulkOperationRequest {
  channelIds: string[];
  operation: BulkOperationType;
  priority?: number;
}

export interface BulkOperationResult {
  operationId: string;
  totalChannels: number;
  successCount: number;
  failureCount: number;
  results: ChannelOperationResult[];
  status: OperationStatus;
  startedAt: Date;
  completedAt?: Date;
}

export interface ChannelOperationResult {
  channelId: string;
  channelName: string;
  status: OperationStatus;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface ResourceConstraints {
  maxConcurrentOperations: number;
  maxFFmpegProcesses: number;
  cpuThreshold: number;
  memoryThreshold: number;
}

export interface OperationQueue {
  id: string;
  clientId: string;
  operation: BulkOperationType;
  channelIds: string[];
  priority: number;
  status: OperationStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}