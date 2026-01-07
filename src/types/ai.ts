export interface MediaItem {
  id: string;
  title: string;
  description?: string;
  duration: number; // in seconds
  filePath: string;
  fileSize: number;
  format: string;
  resolution?: string;
  bitrate?: number;
  
  // AI-generated metadata
  categories?: string[];
  tags?: string[];
  contentType?: 'entertainment' | 'news' | 'sports' | 'educational' | 'music' | 'documentary' | 'commercial';
  mood?: 'upbeat' | 'calm' | 'dramatic' | 'informative' | 'energetic';
  targetAudience?: string[];
  
  // Performance metrics
  averageViewTime?: number;
  engagementScore?: number;
  retentionRate?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ViewerPattern {
  channelId: string;
  timeSlot: string; // "HH:MM" format
  dayOfWeek: number; // 0-6, Sunday = 0
  averageViewers: number;
  peakViewers: number;
  averageWatchTime: number;
  engagementRate: number;
  preferredContentTypes: string[];
  deviceDistribution: Record<string, number>;
  geographicDistribution: Record<string, number>;
}

export interface OptimizedSchedule {
  channelId: string;
  timeSlots: TimeSlot[];
  expectedViewership: number;
  revenueProjection: number;
  confidenceScore: number; // 0-100
  optimizationStrategy: 'viewership' | 'engagement' | 'revenue' | 'balanced';
  generatedAt: Date;
}

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
  mediaItem: MediaItem;
  expectedViewers: number;
  expectedEngagement: number;
  expectedRevenue: number;
  reasonForSelection: string;
  alternativeOptions?: MediaItem[];
}

export interface ChurnPrediction {
  channelId: string;
  riskLevel: 'low' | 'medium' | 'high';
  churnProbability: number; // 0-100
  riskFactors: ChurnRiskFactor[];
  recommendations: ChurnPreventionRecommendation[];
  affectedViewerSegments: ViewerSegment[];
  predictedChurnDate?: Date;
  confidenceScore: number;
  generatedAt: Date;
}

export interface ChurnRiskFactor {
  factor: string;
  impact: 'low' | 'medium' | 'high';
  description: string;
  currentValue: number;
  thresholdValue: number;
}

export interface ChurnPreventionRecommendation {
  type: 'content' | 'scheduling' | 'engagement' | 'monetization';
  priority: 'low' | 'medium' | 'high';
  action: string;
  description: string;
  expectedImpact: number; // percentage improvement
  implementationEffort: 'low' | 'medium' | 'high';
  timeframe: string;
}

export interface ViewerSegment {
  id: string;
  name: string;
  description: string;
  size: number;
  characteristics: Record<string, any>;
  behaviorPatterns: string[];
  churnRisk: number;
  valueScore: number; // revenue potential
}

export interface ContentCategories {
  primary: string;
  secondary: string[];
  confidence: number; // 0-100
  tags: string[];
  mood: string;
  targetAudience: string[];
  contentRating?: string;
  language?: string;
  topics: string[];
}

export interface Recommendation {
  id: string;
  type: 'content' | 'scheduling' | 'monetization' | 'engagement' | 'technical';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  rationale: string;
  expectedImpact: {
    metric: string;
    improvement: number; // percentage
    confidence: number; // 0-100
  };
  implementation: {
    effort: 'low' | 'medium' | 'high';
    timeframe: string;
    steps: string[];
    resources?: string[];
  };
  createdAt: Date;
  expiresAt?: Date;
}

export interface AdPlacementOptimization {
  channelId: string;
  contentId: string;
  optimalPlacements: AdPlacement[];
  expectedRevenue: number;
  expectedViewerImpact: number; // negative percentage for viewer drop
  optimizationStrategy: 'revenue' | 'engagement' | 'balanced';
  confidenceScore: number;
  generatedAt: Date;
}

export interface AdPlacement {
  timestamp: number; // seconds from content start
  type: 'pre-roll' | 'mid-roll' | 'post-roll';
  duration: number; // seconds
  expectedViewers: number;
  expectedRevenue: number;
  viewerDropProbability: number; // 0-100
  reasonForPlacement: string;
  alternativeTimestamps?: number[];
}

export interface AIAnalysisResult {
  analysisType: string;
  channelId: string;
  confidence: number;
  results: Record<string, any>;
  recommendations: string[];
  generatedAt: Date;
  validUntil?: Date;
}

export interface ContentAnalysisRequest {
  mediaItem: MediaItem;
  analysisTypes: ('categorization' | 'mood' | 'audience' | 'engagement_prediction')[];
  includeVisualAnalysis?: boolean;
  includeAudioAnalysis?: boolean;
  includeTextAnalysis?: boolean;
}

export interface ScheduleOptimizationRequest {
  channelId: string;
  content: MediaItem[];
  timeRange: {
    start: Date;
    end: Date;
  };
  strategy: 'viewership' | 'engagement' | 'revenue' | 'balanced';
  constraints?: {
    minContentDuration?: number;
    maxContentDuration?: number;
    requiredContentTypes?: string[];
    blackoutPeriods?: { start: Date; end: Date }[];
  };
}

export interface ViewerBehaviorAnalysis {
  channelId: string;
  analysisDate: Date;
  totalViewers: number;
  segments: ViewerSegment[];
  patterns: ViewerPattern[];
  trends: {
    viewership: 'increasing' | 'decreasing' | 'stable';
    engagement: 'increasing' | 'decreasing' | 'stable';
    retention: 'increasing' | 'decreasing' | 'stable';
  };
  seasonality: {
    daily: Record<string, number>; // hour -> multiplier
    weekly: Record<string, number>; // day -> multiplier
    monthly: Record<string, number>; // month -> multiplier
  };
}

export interface AIEngineConfig {
  enableContentAnalysis: boolean;
  enableScheduleOptimization: boolean;
  enableChurnPrediction: boolean;
  enableAdOptimization: boolean;
  enableRecommendations: boolean;
  
  // Analysis intervals
  contentAnalysisInterval: number; // hours
  scheduleOptimizationInterval: number; // hours
  churnAnalysisInterval: number; // hours
  
  // Confidence thresholds
  minConfidenceForRecommendations: number; // 0-100
  minConfidenceForAutomation: number; // 0-100
  
  // Data retention
  analysisRetentionDays: number;
  recommendationRetentionDays: number;
}