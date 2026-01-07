import Joi from 'joi';
import { CreateChannelRequest, UpdateChannelRequest, Resolution, OutputType } from '../types/channel';

// Base schemas
const resolutionSchema = Joi.string().valid('SD', 'HD', 'FHD');
const outputTypeSchema = Joi.string().valid('HLS', 'RTMP', 'SRT');
const platformSchema = Joi.string().valid('youtube', 'facebook', 'twitch', 'custom');

// RTMP destination schema
const rtmpDestinationSchema = Joi.object({
  serverUrl: Joi.string().uri({ scheme: ['rtmp', 'rtmps'] }).required(),
  streamKey: Joi.string().min(1).max(500).required(),
  platform: platformSchema.required(),
  enabled: Joi.boolean().default(true),
});

// Channel validation schemas
export const createChannelSchema = Joi.object<CreateChannelRequest>({
  name: Joi.string().min(1).max(100).pattern(/^[a-zA-Z0-9\s\-_]+$/).required(),
  resolution: resolutionSchema.required(),
  bitrate: Joi.number().integer().min(500).max(10000).default(2000), // kbps
  fallbackVideo: Joi.string().uri().optional(),
  hlsEnabled: Joi.boolean().default(true),
  rtmpDestinations: Joi.array().items(rtmpDestinationSchema).max(10).default([]),
  analyticsEnabled: Joi.boolean().default(true),
  monetizationEnabled: Joi.boolean().default(false),
  aiOptimizationEnabled: Joi.boolean().default(false),
  multiPlatformEnabled: Joi.boolean().default(false),
  interactionEnabled: Joi.boolean().default(false),
});

export const updateChannelSchema = Joi.object<UpdateChannelRequest>({
  name: Joi.string().min(1).max(100).pattern(/^[a-zA-Z0-9\s\-_]+$/).optional(),
  resolution: resolutionSchema.optional(),
  bitrate: Joi.number().integer().min(500).max(10000).optional(),
  fallbackVideo: Joi.string().uri().optional(),
  hlsEnabled: Joi.boolean().optional(),
  rtmpDestinations: Joi.array().items(rtmpDestinationSchema).max(10).optional(),
  analyticsEnabled: Joi.boolean().optional(),
  monetizationEnabled: Joi.boolean().optional(),
  aiOptimizationEnabled: Joi.boolean().optional(),
  multiPlatformEnabled: Joi.boolean().optional(),
  interactionEnabled: Joi.boolean().optional(),
});

// Subscription plan validation
export const subscriptionPlanSchema = Joi.object({
  name: Joi.string().min(1).max(50).required(),
  monthlyPrice: Joi.number().precision(2).min(0).required(),
  channelLimit: Joi.number().integer().min(1).max(1000).required(),
  maxResolution: resolutionSchema.required(),
  outputTypes: Joi.array().items(outputTypeSchema).min(1).required(),
  storageLimit: Joi.number().integer().min(1).max(10000).required(), // GB
  concurrentChannels: Joi.number().integer().min(1).max(100).required(),
  trialAllowed: Joi.boolean().default(true),
});

// Validation helper functions
export function validateChannelId(channelId: string): boolean {
  // Check if it's a valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(channelId);
}

export function validateChannelName(name: string, existingNames: string[]): string | null {
  // Check basic format
  const { error } = Joi.string().min(1).max(100).pattern(/^[a-zA-Z0-9\s\-_]+$/).validate(name);
  if (error) {
    return 'Channel name must be 1-100 characters and contain only letters, numbers, spaces, hyphens, and underscores';
  }

  // Check uniqueness
  if (existingNames.includes(name.toLowerCase())) {
    return 'Channel name already exists for this client';
  }

  return null;
}

export function validateRTMPUrl(url: string): string | null {
  const rtmpUrlPattern = /^rtmps?:\/\/[^\s\/$.?#].[^\s]*$/i;
  
  if (!rtmpUrlPattern.test(url)) {
    return 'RTMP URL must be in format: rtmp://server/app or rtmps://server/app';
  }

  // Additional validation for common RTMP servers
  const commonServers = [
    'rtmp://a.rtmp.youtube.com/live2',
    'rtmps://live-api-s.facebook.com:443/rtmp',
    'rtmp://live.twitch.tv/live',
  ];

  // Check if it's a known server format
  const isKnownFormat = commonServers.some(server => url.startsWith(server.split('/').slice(0, 3).join('/')));
  
  if (!isKnownFormat && !url.includes('/live') && !url.includes('/stream')) {
    return 'RTMP URL should typically include /live or /stream path';
  }

  return null;
}

export function validateResolutionForPlan(resolution: Resolution, maxResolution: Resolution): boolean {
  const resolutionOrder = { 'SD': 1, 'HD': 2, 'FHD': 3 };
  return resolutionOrder[resolution] <= resolutionOrder[maxResolution];
}

export function validateOutputTypesForPlan(requestedTypes: OutputType[], allowedTypes: OutputType[]): boolean {
  return requestedTypes.every(type => allowedTypes.includes(type));
}

// Bitrate validation based on resolution
export function getDefaultBitrate(resolution: Resolution): number {
  switch (resolution) {
    case 'SD': return 1000; // 1 Mbps
    case 'HD': return 2000; // 2 Mbps
    case 'FHD': return 4000; // 4 Mbps
    default: return 2000;
  }
}

export function validateBitrateForResolution(bitrate: number, resolution: Resolution): string | null {
  const minBitrates = { 'SD': 500, 'HD': 1000, 'FHD': 2000 };
  const maxBitrates = { 'SD': 2000, 'HD': 5000, 'FHD': 10000 };

  if (bitrate < minBitrates[resolution]) {
    return `Bitrate too low for ${resolution}. Minimum: ${minBitrates[resolution]} kbps`;
  }

  if (bitrate > maxBitrates[resolution]) {
    return `Bitrate too high for ${resolution}. Maximum: ${maxBitrates[resolution]} kbps`;
  }

  return null;
}

// Subscription plan validation functions
export function validateChannelLimitForPlan(currentChannelCount: number, planChannelLimit: number): boolean {
  return currentChannelCount < planChannelLimit;
}

export function validateConcurrentChannelsForPlan(runningChannelCount: number, planConcurrentLimit: number): boolean {
  return runningChannelCount < planConcurrentLimit;
}

export function validateStorageUsageForPlan(currentStorageGB: number, planStorageLimit: number): boolean {
  return currentStorageGB <= planStorageLimit;
}

// Channel configuration validation
export function validateChannelConfiguration(config: CreateChannelRequest | UpdateChannelRequest): string[] {
  const errors: string[] = [];
  
  // Validate name format
  if ('name' in config && config.name) {
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(config.name)) {
      errors.push('Channel name can only contain letters, numbers, spaces, hyphens, and underscores');
    }
    
    if (config.name.length > 100) {
      errors.push('Channel name cannot exceed 100 characters');
    }
  }
  
  // Validate resolution and bitrate combination
  if ('resolution' in config && 'bitrate' in config && config.resolution && config.bitrate) {
    const bitrateError = validateBitrateForResolution(config.bitrate, config.resolution);
    if (bitrateError) {
      errors.push(bitrateError);
    }
  }
  
  // Validate RTMP destinations
  if ('rtmpDestinations' in config && config.rtmpDestinations) {
    config.rtmpDestinations.forEach((dest, index) => {
      const urlError = validateRTMPUrl(dest.serverUrl);
      if (urlError) {
        errors.push(`RTMP destination ${index + 1}: ${urlError}`);
      }
      
      if (!dest.streamKey || dest.streamKey.trim().length === 0) {
        errors.push(`RTMP destination ${index + 1}: Stream key is required`);
      }
      
      if (dest.streamKey && dest.streamKey.length > 500) {
        errors.push(`RTMP destination ${index + 1}: Stream key too long (max 500 characters)`);
      }
    });
    
    if (config.rtmpDestinations.length > 10) {
      errors.push('Maximum 10 RTMP destinations allowed per channel');
    }
  }
  
  // Validate fallback video URL if provided
  if ('fallbackVideo' in config && config.fallbackVideo) {
    try {
      new URL(config.fallbackVideo);
    } catch {
      errors.push('Fallback video must be a valid URL');
    }
  }
  
  return errors;
}

// Stream key validation
export function validateStreamKey(streamKey: string): string | null {
  if (!streamKey || streamKey.trim().length === 0) {
    return 'Stream key cannot be empty';
  }
  
  if (streamKey.length > 500) {
    return 'Stream key too long (maximum 500 characters)';
  }
  
  // Check for potentially unsafe characters
  if (/[<>\"'&]/.test(streamKey)) {
    return 'Stream key contains invalid characters';
  }
  
  return null;
}

// Platform-specific RTMP URL validation
export function validatePlatformRTMPUrl(url: string, platform: string): string | null {
  const baseError = validateRTMPUrl(url);
  if (baseError) {
    return baseError;
  }
  
  switch (platform) {
    case 'youtube':
      if (!url.includes('rtmp.youtube.com') && !url.includes('a.rtmp.youtube.com')) {
        return 'YouTube RTMP URL should use rtmp.youtube.com or a.rtmp.youtube.com';
      }
      if (!url.includes('live2')) {
        return 'YouTube RTMP URL should include live2 in the path';
      }
      break;
      
    case 'facebook':
      if (!url.includes('live-api') || !url.includes('facebook.com')) {
        return 'Facebook RTMP URL should use live-api.facebook.com';
      }
      if (!url.includes('rtmp')) {
        return 'Facebook RTMP URL should include rtmp in the path';
      }
      break;
      
    case 'twitch':
      if (!url.includes('live.twitch.tv')) {
        return 'Twitch RTMP URL should use live.twitch.tv';
      }
      if (!url.includes('live')) {
        return 'Twitch RTMP URL should include live in the path';
      }
      break;
      
    case 'custom':
      // No specific validation for custom platforms
      break;
      
    default:
      return `Unknown platform: ${platform}`;
  }
  
  return null;
}

// Enhanced RTMP stream key validation
export function validateStreamKeyForPlatform(streamKey: string, platform: string): string | null {
  const baseError = validateStreamKey(streamKey);
  if (baseError) {
    return baseError;
  }
  
  switch (platform) {
    case 'youtube':
      // YouTube stream keys are typically 20-40 characters
      if (streamKey.length < 20 || streamKey.length > 40) {
        return 'YouTube stream keys are typically 20-40 characters long';
      }
      if (!/^[a-zA-Z0-9\-_\.]+$/.test(streamKey)) {
        return 'YouTube stream keys should only contain alphanumeric characters, hyphens, underscores, and dots';
      }
      break;
      
    case 'facebook':
      // Facebook stream keys are typically longer
      if (streamKey.length < 30) {
        return 'Facebook stream keys are typically at least 30 characters long';
      }
      break;
      
    case 'twitch':
      // Twitch stream keys have specific format
      if (streamKey.length < 20) {
        return 'Twitch stream keys are typically at least 20 characters long';
      }
      if (!/^[a-zA-Z0-9_]+$/.test(streamKey)) {
        return 'Twitch stream keys should only contain alphanumeric characters and underscores';
      }
      break;
      
    case 'custom':
      // No specific validation for custom platforms
      break;
  }
  
  return null;
}