export interface ViewerSession {
  id: string;
  channelId: string;
  viewerId: string;
  startTime: Date;
  endTime?: Date;
  
  // Viewer Information
  ipAddress: string;
  userAgent: string;
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  
  // Device Information
  deviceType?: 'mobile' | 'desktop' | 'tablet' | 'tv';
  browser?: string;
  os?: string;
  
  // Engagement Metrics
  watchTime: number; // in seconds
  interactionCount: number;
  adViewCount: number;
  chatMessageCount: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ViewerEvent {
  id: string;
  sessionId: string;
  channelId: string;
  eventType: 'join' | 'leave' | 'chat' | 'interaction' | 'ad_view' | 'error' | 'heartbeat';
  timestamp: Date;
  eventData?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelMetrics {
  id: string;
  channelId: string;
  timestamp: Date;
  periodType: 'minute' | 'hour' | 'day';
  
  // Viewership Metrics
  concurrentViewers: number;
  totalViews: number;
  uniqueViewers: number;
  averageWatchTime: number;
  peakViewers: number;
  
  // Engagement Metrics
  chatMessages: number;
  pollParticipation: number;
  socialShares: number;
  totalInteractions: number;
  
  // Technical Metrics
  streamQuality: number; // 0-100 score
  bufferingEvents: number;
  errorRate: number; // percentage
  restartCount: number;
  
  // Revenue Metrics
  adImpressions: number;
  adRevenue: number;
  subscriptionRevenue: number;
  totalRevenue: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface RealtimeMetrics {
  channelId: string;
  currentViewers: number;
  peakViewers: number;
  averageWatchTime: number;
  totalViews: number;
  uniqueViewers: number;
  geographicDistribution: GeographicData[];
  deviceBreakdown: DeviceData[];
  recentEvents: ViewerEvent[];
  streamHealth: {
    quality: number;
    errorRate: number;
    bufferingEvents: number;
  };
}

export interface GeographicData {
  country: string;
  viewerCount: number;
  percentage: number;
}

export interface DeviceData {
  deviceType: string;
  viewerCount: number;
  percentage: number;
}

export interface AnalyticsReport {
  id: string;
  channelId: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  reportDate: Date;
  generatedAt: Date;
  
  // Summary Metrics
  totalViews: number;
  uniqueViewers: number;
  totalWatchTime: number; // in seconds
  averageWatchTime: number;
  peakConcurrentViewers: number;
  
  // Engagement Metrics
  totalInteractions: number;
  chatMessages: number;
  socialShares: number;
  
  // Geographic Distribution
  topCountries: GeographicData[];
  
  // Device Distribution
  deviceBreakdown: DeviceData[];
  
  // Time-based Analytics
  viewershipByHour: HourlyData[];
  
  // Revenue Metrics
  totalRevenue: number;
  adRevenue: number;
  subscriptionRevenue: number;
  
  // Technical Performance
  averageStreamQuality: number;
  totalBufferingEvents: number;
  averageErrorRate: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface HourlyData {
  hour: number; // 0-23
  viewers: number;
  watchTime: number;
  interactions: number;
}

export interface TimePeriod {
  start: Date;
  end: Date;
}

export interface ViewerTrackingEvent {
  channelId: string;
  viewerId: string;
  eventType: ViewerEvent['eventType'];
  timestamp?: Date;
  sessionId?: string;
  eventData?: Record<string, any>;
  
  // Optional viewer info for new sessions
  ipAddress?: string;
  userAgent?: string;
  geolocation?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  deviceInfo?: {
    deviceType?: ViewerSession['deviceType'];
    browser?: string;
    os?: string;
  };
}

export interface AnalyticsConfig {
  enableRealTimeTracking: boolean;
  enableGeolocation: boolean;
  enableDeviceTracking: boolean;
  retentionDays: number;
  aggregationIntervals: ('minute' | 'hour' | 'day')[];
}

export interface AnalyticsQuery {
  channelId: string;
  startDate?: Date;
  endDate?: Date;
  metrics?: string[];
  groupBy?: 'hour' | 'day' | 'week' | 'month';
  filters?: {
    country?: string;
    deviceType?: string;
    eventType?: string;
  };
}