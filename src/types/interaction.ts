export interface ChatConfig {
  enabled: boolean;
  moderationEnabled: boolean;
  profanityFilter: boolean;
  slowMode: number; // seconds between messages
  subscriberOnly: boolean;
  emoteOnly: boolean;
}

export interface Poll {
  id: string;
  channelId: string;
  question: string;
  options: string[];
  duration: number; // in seconds
  displayOverlay: boolean;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  createdAt: Date;
  endTime: Date;
  totalVotes: number;
}

export interface PollVote {
  id: string;
  pollId: string;
  viewerId: string;
  optionIndex: number;
  timestamp: Date;
}

export interface ContentVote {
  id: string;
  channelId: string;
  viewerId: string;
  contentId: string;
  voteType: 'UPVOTE' | 'DOWNVOTE';
  timestamp: Date;
}

export interface SocialPlatform {
  id: string;
  name: 'twitter' | 'instagram' | 'facebook' | 'tiktok';
  enabled: boolean;
  hashtags: string[];
  refreshInterval: number; // in seconds
}

export interface SocialFeedItem {
  id: string;
  channelId: string;
  platform: string;
  content: string;
  author: string;
  authorAvatar?: string;
  timestamp: Date;
  likes: number;
  shares: number;
  url: string;
}

export interface ViewerEffect {
  id: string;
  name: string;
  type: 'SOUND' | 'ANIMATION' | 'OVERLAY';
  cost: number; // in points
  duration: number; // in seconds
  enabled: boolean;
}

export interface TriggeredEffect {
  id: string;
  channelId: string;
  viewerId: string;
  effectId: string;
  timestamp: Date;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
}

export interface ViewerPoints {
  id: string;
  channelId: string;
  viewerId: string;
  points: number;
  totalEarned: number;
  totalSpent: number;
  lastActivity: Date;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirements: BadgeRequirement[];
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
}

export interface BadgeRequirement {
  type: 'WATCH_TIME' | 'CHAT_MESSAGES' | 'POINTS_EARNED' | 'CONSECUTIVE_DAYS' | 'SPECIAL_EVENT';
  value: number;
  description: string;
}

export interface ViewerBadge {
  id: string;
  viewerId: string;
  badgeId: string;
  earnedAt: Date;
  channelId: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  viewerId: string;
  username: string;
  message: string;
  timestamp: Date;
  moderated: boolean;
  deleted: boolean;
}

export interface EngagementEvent {
  id: string;
  channelId: string;
  viewerId: string;
  eventType: 'CHAT' | 'POLL_VOTE' | 'CONTENT_VOTE' | 'EFFECT_TRIGGER' | 'BADGE_EARNED' | 'POINTS_EARNED';
  eventData: Record<string, any>;
  timestamp: Date;
  points: number;
}

export interface InteractionConfig {
  chatConfig: ChatConfig;
  pollsEnabled: boolean;
  votingEnabled: boolean;
  socialFeedEnabled: boolean;
  effectsEnabled: boolean;
  gamificationEnabled: boolean;
  socialPlatforms: SocialPlatform[];
  enabledEffects: string[];
}

export interface InteractionMetrics {
  channelId: string;
  timestamp: Date;
  activeChatUsers: number;
  totalChatMessages: number;
  activePolls: number;
  totalPollVotes: number;
  contentVotes: number;
  effectsTriggered: number;
  pointsDistributed: number;
  badgesEarned: number;
  socialFeedItems: number;
}

// API Request/Response types
export interface CreatePollRequest {
  question: string;
  options: string[];
  duration: number;
  displayOverlay?: boolean;
}

export interface CreateChatMessageRequest {
  message: string;
  username: string;
}

export interface TriggerEffectRequest {
  effectId: string;
  viewerId: string;
}

export interface VoteContentRequest {
  contentId: string;
  voteType: 'UPVOTE' | 'DOWNVOTE';
}

export interface UpdateInteractionConfigRequest {
  chatConfig?: Partial<ChatConfig>;
  pollsEnabled?: boolean;
  votingEnabled?: boolean;
  socialFeedEnabled?: boolean;
  effectsEnabled?: boolean;
  gamificationEnabled?: boolean;
  socialPlatforms?: SocialPlatform[];
  enabledEffects?: string[];
}