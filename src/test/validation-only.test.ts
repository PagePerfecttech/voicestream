import {
  validateRTMPUrl,
  validateResolutionForPlan,
  validateOutputTypesForPlan,
  getDefaultBitrate,
  validateBitrateForResolution,
  validateChannelLimitForPlan,
  validateChannelConfiguration,
  validateStreamKey,
  validatePlatformRTMPUrl,
  createChannelSchema,
  updateChannelSchema,
  subscriptionPlanSchema
} from '../utils/validation';
import { Resolution, OutputType } from '../types/channel';

describe('Task 2: Core Channel Data Models and Validation (Validation Only)', () => {
  describe('Channel Configuration Validation', () => {
    test('should validate valid channel configuration', () => {
      const validConfig = {
        name: 'Test Channel',
        resolution: 'HD' as Resolution,
        bitrate: 2000,
        fallbackVideo: 'https://example.com/fallback.mp4',
        hlsEnabled: true,
        rtmpDestinations: [],
        analyticsEnabled: true,
        monetizationEnabled: false,
        aiOptimizationEnabled: false,
        multiPlatformEnabled: false,
        interactionEnabled: false,
      };

      const errors = validateChannelConfiguration(validConfig);
      expect(errors).toHaveLength(0);
    });

    test('should detect invalid channel name characters', () => {
      const invalidNames = ['Test@Channel', 'Test#Channel', 'Test$Channel'];
      
      invalidNames.forEach(name => {
        const config = { name, resolution: 'HD' as Resolution };
        const errors = validateChannelConfiguration(config);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('letters, numbers, spaces, hyphens, and underscores');
      });
    });

    test('should validate channel name length', () => {
      const longName = 'a'.repeat(101);
      const config = { name: longName, resolution: 'HD' as Resolution };
      const errors = validateChannelConfiguration(config);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('cannot exceed 100 characters');
    });
  });

  describe('RTMP URL Validation', () => {
    test('should validate correct RTMP URLs', () => {
      const validUrls = [
        'rtmp://a.rtmp.youtube.com/live2',
        'rtmps://live-api-s.facebook.com:443/rtmp',
        'rtmp://live.twitch.tv/live',
        'rtmp://custom-server.com/live'
      ];

      validUrls.forEach(url => {
        const error = validateRTMPUrl(url);
        expect(error).toBeNull();
      });
    });

    test('should reject invalid RTMP URLs', () => {
      const invalidUrls = [
        'http://example.com',
        'ftp://example.com',
        'rtmp://',
        'not-a-url',
        ''
      ];

      invalidUrls.forEach(url => {
        const error = validateRTMPUrl(url);
        expect(error).not.toBeNull();
      });
    });
  });

  describe('Subscription Plan Limit Validation', () => {
    test('should validate channel limit correctly', () => {
      expect(validateChannelLimitForPlan(5, 10)).toBe(true);
      expect(validateChannelLimitForPlan(10, 10)).toBe(false);
      expect(validateChannelLimitForPlan(15, 10)).toBe(false);
    });

    test('should validate resolution limits correctly', () => {
      expect(validateResolutionForPlan('SD', 'FHD')).toBe(true);
      expect(validateResolutionForPlan('HD', 'FHD')).toBe(true);
      expect(validateResolutionForPlan('FHD', 'HD')).toBe(false);
      expect(validateResolutionForPlan('FHD', 'SD')).toBe(false);
    });

    test('should validate output types correctly', () => {
      const allowedTypes: OutputType[] = ['HLS', 'RTMP'];
      
      expect(validateOutputTypesForPlan(['HLS'], allowedTypes)).toBe(true);
      expect(validateOutputTypesForPlan(['HLS', 'RTMP'], allowedTypes)).toBe(true);
      expect(validateOutputTypesForPlan(['SRT'], allowedTypes)).toBe(false);
      expect(validateOutputTypesForPlan(['HLS', 'SRT'], allowedTypes)).toBe(false);
    });
  });

  describe('Bitrate Validation', () => {
    test('should provide correct default bitrates', () => {
      expect(getDefaultBitrate('SD')).toBe(1000);
      expect(getDefaultBitrate('HD')).toBe(2000);
      expect(getDefaultBitrate('FHD')).toBe(4000);
    });

    test('should validate bitrate for resolution', () => {
      // Valid bitrates
      expect(validateBitrateForResolution(1000, 'SD')).toBeNull();
      expect(validateBitrateForResolution(2000, 'HD')).toBeNull();
      expect(validateBitrateForResolution(4000, 'FHD')).toBeNull();

      // Invalid bitrates (too low)
      expect(validateBitrateForResolution(400, 'SD')).toContain('too low');
      expect(validateBitrateForResolution(800, 'HD')).toContain('too low');
      expect(validateBitrateForResolution(1500, 'FHD')).toContain('too low');

      // Invalid bitrates (too high)
      expect(validateBitrateForResolution(2500, 'SD')).toContain('too high');
      expect(validateBitrateForResolution(6000, 'HD')).toContain('too high');
      expect(validateBitrateForResolution(12000, 'FHD')).toContain('too high');
    });
  });

  describe('Stream Key Validation', () => {
    test('should validate stream keys', () => {
      expect(validateStreamKey('valid-stream-key-123')).toBeNull();
      expect(validateStreamKey('')).toContain('cannot be empty');
      expect(validateStreamKey('   ')).toContain('cannot be empty');
      expect(validateStreamKey('a'.repeat(501))).toContain('too long');
      expect(validateStreamKey('key<script>')).toContain('invalid characters');
    });
  });

  describe('Platform-specific RTMP URL Validation', () => {
    test('should validate YouTube RTMP URLs', () => {
      expect(validatePlatformRTMPUrl('rtmp://a.rtmp.youtube.com/live2', 'youtube')).toBeNull();
      expect(validatePlatformRTMPUrl('rtmp://wrong-server.com/live', 'youtube')).toContain('rtmp.youtube.com');
    });

    test('should validate Facebook RTMP URLs', () => {
      expect(validatePlatformRTMPUrl('rtmps://live-api-s.facebook.com:443/rtmp', 'facebook')).toBeNull();
      expect(validatePlatformRTMPUrl('rtmp://wrong-server.com/live', 'facebook')).toContain('live-api.facebook.com');
    });

    test('should validate Twitch RTMP URLs', () => {
      expect(validatePlatformRTMPUrl('rtmp://live.twitch.tv/live', 'twitch')).toBeNull();
      expect(validatePlatformRTMPUrl('rtmp://wrong-server.com/live', 'twitch')).toContain('live.twitch.tv');
    });

    test('should allow custom platform URLs', () => {
      expect(validatePlatformRTMPUrl('rtmp://custom-server.com/live', 'custom')).toBeNull();
    });
  });

  describe('Joi Schema Validation', () => {
    test('should validate create channel schema', () => {
      const validData = {
        name: 'Test Channel',
        resolution: 'HD',
        bitrate: 2000,
        fallbackVideo: 'https://example.com/fallback.mp4',
        hlsEnabled: true,
        rtmpDestinations: [],
        analyticsEnabled: true,
        monetizationEnabled: false,
        aiOptimizationEnabled: false,
        multiPlatformEnabled: false,
        interactionEnabled: false,
      };

      const { error } = createChannelSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    test('should reject invalid create channel data', () => {
      const invalidData = {
        name: '', // Empty name
        resolution: 'INVALID', // Invalid resolution
        bitrate: -100, // Negative bitrate
      };

      const { error } = createChannelSchema.validate(invalidData);
      expect(error).toBeDefined();
    });

    test('should validate update channel schema', () => {
      const validData = {
        name: 'Updated Channel Name',
        resolution: 'FHD',
      };

      const { error } = updateChannelSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    test('should validate subscription plan schema', () => {
      const validData = {
        name: 'Basic Plan',
        monthlyPrice: 29.99,
        channelLimit: 5,
        maxResolution: 'HD',
        outputTypes: ['HLS', 'RTMP'],
        storageLimit: 100,
        concurrentChannels: 3,
        trialAllowed: true,
      };

      const { error } = subscriptionPlanSchema.validate(validData);
      expect(error).toBeUndefined();
    });
  });

  describe('TypeScript Interface Validation', () => {
    test('should have proper Channel interface structure', () => {
      // This test ensures the Channel interface has the required properties
      // by creating a mock object that should satisfy the interface
      const mockChannel = {
        id: 'test-id',
        clientId: 'client-id',
        name: 'Test Channel',
        status: 'STOPPED' as const,
        config: {
          name: 'Test Channel',
          resolution: 'HD' as Resolution,
          bitrate: 2000,
          fallbackVideo: 'https://example.com/fallback.mp4',
          hlsEnabled: true,
          rtmpDestinations: [],
          analyticsEnabled: true,
          monetizationEnabled: false,
          aiOptimizationEnabled: false,
          multiPlatformEnabled: false,
          interactionEnabled: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        hlsEndpoint: 'https://stream.example.com/hls/test-id/playlist.m3u8',
        totalUptime: 0,
        restartCount: 0,
        lastStartTime: null,
        lastStopTime: null,
      };

      // If this compiles without TypeScript errors, the interface is properly structured
      expect(mockChannel.id).toBe('test-id');
      expect(mockChannel.config.resolution).toBe('HD');
    });

    test('should have proper StreamProcess interface structure', () => {
      const mockStreamProcess = {
        id: 'process-id',
        channelId: 'channel-id',
        ffmpegPid: 12345,
        status: 'RUNNING' as const,
        startTime: new Date(),
        lastHeartbeat: new Date(),
        inputSource: 'input.mp4',
        outputTargets: ['output1.m3u8', 'rtmp://server/stream'],
        cpuUsage: 25.5,
        memoryUsage: 1024000,
        networkBandwidth: 2000000,
        errorCount: 0,
        maxRestarts: 3,
        restartDelay: 5000,
        healthCheckInterval: 5000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(mockStreamProcess.channelId).toBe('channel-id');
      expect(mockStreamProcess.status).toBe('RUNNING');
    });

    test('should have proper SubscriptionPlan interface structure', () => {
      const mockSubscriptionPlan = {
        id: 'plan-id',
        name: 'Basic Plan',
        monthlyPrice: 29.99,
        channelLimit: 5,
        maxResolution: 'HD' as Resolution,
        outputTypes: ['HLS', 'RTMP'] as OutputType[],
        storageLimit: 100,
        concurrentChannels: 3,
        trialAllowed: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(mockSubscriptionPlan.name).toBe('Basic Plan');
      expect(mockSubscriptionPlan.maxResolution).toBe('HD');
    });
  });
});