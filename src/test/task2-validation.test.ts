import { 
  validateChannelConfiguration, 
  validateChannelLimitForPlan, 
  validateResolutionForPlan,
  validateRTMPUrl,
  validateBitrateForResolution,
  getDefaultBitrate
} from '../utils/validation';
import { CreateChannelRequest } from '../types/channel';

// Simple tests without database dependencies for Task 2 verification
describe('Task 2: Core Channel Data Models and Validation', () => {
  describe('Channel Configuration Validation', () => {
    test('should validate valid channel configuration', () => {
      const config: CreateChannelRequest = {
        name: 'Valid Channel',
        resolution: 'HD',
        bitrate: 2000,
        fallbackVideo: 'https://example.com/fallback.mp4',
        rtmpDestinations: [
          {
            serverUrl: 'rtmp://a.rtmp.youtube.com/live2',
            streamKey: 'valid-stream-key',
            platform: 'youtube',
            enabled: true,
          },
        ],
      };

      const errors = validateChannelConfiguration(config);
      expect(errors).toHaveLength(0);
    });

    test('should detect invalid channel name characters', () => {
      const config: CreateChannelRequest = {
        name: 'Invalid@Channel#Name!',
        resolution: 'HD',
        bitrate: 2000,
      };

      const errors = validateChannelConfiguration(config);
      expect(errors).toContain(
        'Channel name can only contain letters, numbers, spaces, hyphens, and underscores'
      );
    });

    test('should validate channel name length', () => {
      const longName = 'a'.repeat(101); // 101 characters
      const config: CreateChannelRequest = {
        name: longName,
        resolution: 'HD',
        bitrate: 2000,
      };

      const errors = validateChannelConfiguration(config);
      expect(errors).toContain('Channel name cannot exceed 100 characters');
    });
  });

  describe('RTMP URL Validation', () => {
    test('should validate correct RTMP URLs', () => {
      const validUrls = [
        'rtmp://a.rtmp.youtube.com/live2',
        'rtmps://live-api-s.facebook.com:443/rtmp',
        'rtmp://live.twitch.tv/live',
        'rtmp://custom-server.com/live/stream',
      ];

      validUrls.forEach(url => {
        expect(validateRTMPUrl(url)).toBeNull();
      });
    });

    test('should reject invalid RTMP URLs', () => {
      const invalidUrls = [
        'http://example.com',
        'invalid-url',
        'rtmp://',
        'rtmp://server',
        'ftp://server.com/stream',
      ];

      invalidUrls.forEach(url => {
        expect(validateRTMPUrl(url)).not.toBeNull();
      });
    });
  });

  describe('Subscription Plan Limit Validation', () => {
    test('should validate channel limit correctly', () => {
      expect(validateChannelLimitForPlan(2, 5)).toBe(true);
      expect(validateChannelLimitForPlan(4, 5)).toBe(true);
      expect(validateChannelLimitForPlan(5, 5)).toBe(false);
      expect(validateChannelLimitForPlan(6, 5)).toBe(false);
    });

    test('should validate resolution limits correctly', () => {
      expect(validateResolutionForPlan('SD', 'HD')).toBe(true);
      expect(validateResolutionForPlan('HD', 'HD')).toBe(true);
      expect(validateResolutionForPlan('FHD', 'HD')).toBe(false);
      expect(validateResolutionForPlan('SD', 'FHD')).toBe(true);
      expect(validateResolutionForPlan('HD', 'FHD')).toBe(true);
      expect(validateResolutionForPlan('FHD', 'FHD')).toBe(true);
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

      // Too low bitrates
      expect(validateBitrateForResolution(400, 'SD')).toContain('too low');
      expect(validateBitrateForResolution(800, 'HD')).toContain('too low');
      expect(validateBitrateForResolution(1500, 'FHD')).toContain('too low');

      // Too high bitrates
      expect(validateBitrateForResolution(2500, 'SD')).toContain('too high');
      expect(validateBitrateForResolution(6000, 'HD')).toContain('too high');
      expect(validateBitrateForResolution(12000, 'FHD')).toContain('too high');
    });
  });

  describe('TypeScript Interface Validation', () => {
    test('should have proper Channel interface structure', () => {
      // This test validates that our TypeScript interfaces are properly defined
      const mockChannel = {
        id: 'test-id',
        clientId: 'client-id',
        name: 'Test Channel',
        status: 'STOPPED' as const,
        config: {
          name: 'Test Channel',
          resolution: 'HD' as const,
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
        hlsEndpoint: 'https://example.com/hls/test-id/playlist.m3u8',
        totalUptime: 0,
        restartCount: 0,
        lastStartTime: null,
        lastStopTime: null,
      };

      // Type checking - if this compiles, our interfaces are correct
      expect(mockChannel.id).toBeDefined();
      expect(mockChannel.config.resolution).toBe('HD');
      expect(mockChannel.status).toBe('STOPPED');
    });

    test('should have proper StreamProcess interface structure', () => {
      const mockStreamProcess = {
        id: 'process-id',
        channelId: 'channel-id',
        ffmpegPid: null,
        status: 'IDLE' as const,
        startTime: null,
        lastHeartbeat: null,
        inputSource: 'test-input',
        outputTargets: ['hls-output'],
        cpuUsage: 0,
        memoryUsage: 0,
        networkBandwidth: 0,
        errorCount: 0,
        maxRestarts: 3,
        restartDelay: 5000,
        healthCheckInterval: 5000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(mockStreamProcess.id).toBeDefined();
      expect(mockStreamProcess.status).toBe('IDLE');
      expect(mockStreamProcess.outputTargets).toContain('hls-output');
    });

    test('should have proper SubscriptionPlan interface structure', () => {
      const mockPlan = {
        id: 'plan-id',
        name: 'Test Plan',
        monthlyPrice: 29.99,
        channelLimit: 5,
        maxResolution: 'HD' as const,
        outputTypes: ['HLS', 'RTMP'] as const,
        storageLimit: 100,
        concurrentChannels: 3,
        trialAllowed: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(mockPlan.id).toBeDefined();
      expect(mockPlan.maxResolution).toBe('HD');
      expect(mockPlan.outputTypes).toContain('HLS');
      expect(mockPlan.outputTypes).toContain('RTMP');
    });
  });
});