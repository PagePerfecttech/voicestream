export interface AdBreak {
  id: string;
  channelId: string;
  type: 'pre-roll' | 'mid-roll' | 'post-roll';
  scheduledTime: Date;
  duration: number; // in seconds
  status: 'scheduled' | 'playing' | 'completed' | 'failed';
  targetingCriteria: TargetingCriteria;
  adContent: AdContent[];
  
  createdAt: Date;
  updatedAt: Date;
}

export interface AdContent {
  id: string;
  adNetworkId: string;
  adType: 'video' | 'banner' | 'overlay';
  contentUrl: string;
  duration: number;
  clickThroughUrl?: string;
  impressionTrackingUrl?: string;
  
  // Targeting
  targetAudience: string[];
  geographicTargeting?: string[];
  deviceTargeting?: string[];
  
  // Revenue
  bidAmount: number;
  currency: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface TargetingCriteria {
  demographics?: {
    ageRange?: [number, number];
    gender?: 'male' | 'female' | 'all';
    interests?: string[];
  };
  geographic?: {
    countries?: string[];
    regions?: string[];
    cities?: string[];
  };
  behavioral?: {
    viewingHistory?: string[];
    engagementLevel?: 'low' | 'medium' | 'high';
    devicePreference?: string[];
  };
  temporal?: {
    timeOfDay?: [number, number]; // hours 0-23
    daysOfWeek?: number[]; // 0-6, Sunday = 0
    seasonality?: string[];
  };
}

export interface AdNetwork {
  id: string;
  name: string;
  type: 'google_ad_manager' | 'spotx' | 'freewheel' | 'custom';
  apiEndpoint: string;
  credentials: AdNetworkCredentials;
  isActive: boolean;
  
  // Configuration
  supportedAdTypes: ('video' | 'banner' | 'overlay')[];
  minimumBid: number;
  currency: string;
  
  // Performance
  fillRate: number; // percentage
  averageCPM: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface AdNetworkCredentials {
  apiKey?: string;
  secretKey?: string;
  publisherId?: string;
  networkId?: string;
  customFields?: Record<string, string>;
}

export interface SubscriptionTier {
  id: string;
  name: string;
  level: number; // 1 = basic, 2 = premium, 3 = enterprise
  features: string[];
  
  // Access Control
  allowedChannels: string[]; // empty = all channels
  restrictedContent: string[]; // content IDs that require this tier
  
  // Pricing
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  
  // Limits
  maxConcurrentStreams: number;
  maxResolution: string;
  adFreeExperience: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface PayPerViewEvent {
  id: string;
  channelId: string;
  eventName: string;
  description: string;
  
  // Scheduling
  startTime: Date;
  endTime: Date;
  timezone: string;
  
  // Pricing
  price: number;
  currency: string;
  
  // Access Control
  purchaseDeadline: Date;
  accessDuration: number; // hours after event starts
  
  // Status
  status: 'upcoming' | 'live' | 'ended' | 'cancelled';
  totalPurchases: number;
  totalRevenue: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ViewerSubscription {
  id: string;
  viewerId: string;
  subscriptionTierId: string;
  
  // Billing
  status: 'active' | 'cancelled' | 'expired' | 'suspended';
  startDate: Date;
  endDate: Date;
  billingCycle: 'monthly' | 'yearly';
  
  // Payment
  paymentMethodId: string;
  lastPaymentDate?: Date;
  nextPaymentDate?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface PPVPurchase {
  id: string;
  viewerId: string;
  eventId: string;
  
  // Purchase Details
  purchaseDate: Date;
  price: number;
  currency: string;
  
  // Access
  accessGranted: boolean;
  accessStartTime?: Date;
  accessEndTime?: Date;
  
  // Payment
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethodId: string;
  transactionId: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface RevenueRecord {
  id: string;
  channelId: string;
  source: 'advertising' | 'subscription' | 'ppv' | 'donation' | 'merchandise';
  
  // Revenue Details
  amount: number;
  currency: string;
  timestamp: Date;
  
  // Attribution
  sourceId?: string; // ad break ID, subscription ID, etc.
  viewerId?: string;
  contentId?: string;
  
  // Metadata
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface MonetizationConfig {
  channelId: string;
  
  // Ad Configuration
  adInsertionEnabled: boolean;
  adBreakFrequency: number; // minutes between ad breaks
  maxAdDuration: number; // seconds
  allowedAdTypes: ('pre-roll' | 'mid-roll' | 'post-roll')[];
  
  // Subscription Configuration
  subscriptionRequired: boolean;
  allowedSubscriptionTiers: string[];
  freeTrialDuration?: number; // days
  
  // PPV Configuration
  ppvEnabled: boolean;
  defaultEventPrice: number;
  currency: string;
  
  // Revenue Sharing
  revenueSharePercentage: number; // platform's share
  
  createdAt: Date;
  updatedAt: Date;
}

export interface AdInsertionRequest {
  channelId: string;
  adBreakType: 'pre-roll' | 'mid-roll' | 'post-roll';
  duration: number;
  targetingCriteria?: TargetingCriteria;
  viewerContext?: {
    viewerId?: string;
    geolocation?: any;
    deviceInfo?: any;
    viewingHistory?: string[];
  };
}

export interface AdInsertionResponse {
  success: boolean;
  adBreakId?: string;
  adContent: AdContent[];
  totalDuration: number;
  insertionTime: Date;
  error?: string;
}

export interface RevenueReport {
  channelId: string;
  reportPeriod: {
    start: Date;
    end: Date;
  };
  
  // Revenue Breakdown
  totalRevenue: number;
  adRevenue: number;
  subscriptionRevenue: number;
  ppvRevenue: number;
  otherRevenue: number;
  
  // Performance Metrics
  adImpressions: number;
  adClickThroughRate: number;
  averageCPM: number;
  fillRate: number;
  
  // Subscription Metrics
  activeSubscribers: number;
  newSubscribers: number;
  churnRate: number;
  
  // PPV Metrics
  totalPPVEvents: number;
  totalPPVPurchases: number;
  averageEventRevenue: number;
  
  // Attribution
  revenueBySource: Record<string, number>;
  revenueByContent: Record<string, number>;
  revenueByGeography: Record<string, number>;
  
  generatedAt: Date;
}

export interface AccessControlResult {
  hasAccess: boolean;
  reason?: 'subscription_required' | 'tier_insufficient' | 'ppv_required' | 'event_ended' | 'payment_failed';
  requiredAction?: {
    type: 'subscribe' | 'upgrade' | 'purchase_ppv';
    details: any;
  };
  accessLevel?: 'full' | 'limited' | 'preview';
}