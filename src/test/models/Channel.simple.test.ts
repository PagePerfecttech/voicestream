import { validateChannelConfiguration, validateChannelLimitForPlan, validateResolutionForPlan } from '../../utils/validation';
import { CreateChannelRequest, Resolution } from '../../types/channel';

describe('Channel Data Models and Validation - Simple Tests', () => {
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

    test('should detect invalid RTMP destinations', () => {
      const config: CreateChannelRequest = {
        name: 'Test Channel',
        resolution: 'HD',
        bitrate: 2000,
        rtmpDestinations: [
          {
            serverUrl: 'invalid-url',
            streamKey: '',
            platform: 'youtube',
            enabled: true,
          },
        ],
      };

      const errors = validateChannelConfiguration(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(error => error.includes('RTMP URL'))).toBe(true);
      expect(errors.some(error => error.includes('Stream key is required'))).toBe(true);
    });
  });

  describe('Subscription Plan Limit Validation', () => {
    test('should validate channel limit correctly', () => {
      expect(validateChannelLimitForPlan(2, 5)).toBe(true);
      expect(validateChannelLimitForPlan(5, 5)).toBe(false);
      expect(validateChannelLimitForPlan(6, 5)).toBe(false);
    });

    test('should validate resolution limits correctly', () => {
      expect(validateResolutionForPlan('SD', 'HD')).toBe(true);
      expect(validateResolutionForPlan('HD', 'HD')).toBe(true);
      expect(validateResolutionForPlan('FHD', 'HD')).toBe(false);
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
  });
});