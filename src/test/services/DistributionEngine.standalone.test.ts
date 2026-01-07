import { AdapterFactory } from '../../services/adapters/AdapterFactory';
import { PlatformType } from '../../types/distribution';

// Standalone test without database/Redis dependencies
describe('DistributionEngine Standalone Tests', () => {
  afterEach(() => {
    AdapterFactory.clearCache();
  });

  describe('AdapterFactory', () => {
    it('should support all required platform types', () => {
      const supportedPlatforms = AdapterFactory.getSupportedPlatforms();
      
      expect(supportedPlatforms).toContain('youtube');
      expect(supportedPlatforms).toContain('facebook');
      expect(supportedPlatforms).toContain('twitch');
      expect(supportedPlatforms).toContain('custom');
      expect(supportedPlatforms).toHaveLength(4);
    });

    it('should create adapters for supported platforms', () => {
      const platforms: PlatformType[] = ['youtube', 'facebook', 'twitch', 'custom'];
      
      platforms.forEach(platform => {
        const adapter = AdapterFactory.getAdapter(platform);
        expect(adapter).toBeDefined();
        expect(typeof adapter.validateCredentials).toBe('function');
        expect(typeof adapter.adaptStreamConfig).toBe('function');
        expect(typeof adapter.startStream).toBe('function');
        expect(typeof adapter.stopStream).toBe('function');
        expect(typeof adapter.getAnalytics).toBe('function');
        expect(typeof adapter.refreshAuth).toBe('function');
      });
    });

    it('should throw error for unsupported platform', () => {
      expect(() => {
        AdapterFactory.getAdapter('unsupported' as any);
      }).toThrow('Unsupported platform type: unsupported');
    });

    it('should cache adapters', () => {
      const adapter1 = AdapterFactory.getAdapter('youtube');
      const adapter2 = AdapterFactory.getAdapter('youtube');
      
      expect(adapter1).toBe(adapter2);
    });

    it('should validate platform support correctly', () => {
      expect(AdapterFactory.isSupported('youtube')).toBe(true);
      expect(AdapterFactory.isSupported('facebook')).toBe(true);
      expect(AdapterFactory.isSupported('twitch')).toBe(true);
      expect(AdapterFactory.isSupported('custom')).toBe(true);
      expect(AdapterFactory.isSupported('unsupported')).toBe(false);
    });
  });

  describe('Platform Adapters', () => {
    it('should adapt stream config for YouTube requirements', () => {
      const adapter = AdapterFactory.getAdapter('youtube');
      const baseConfig = {
        bitrate: 15000, // Higher than YouTube max
        resolution: '1920x1080',
        codec: 'h264',
        framerate: 30,
        keyframeInterval: 2,
        audioCodec: 'aac',
        audioBitrate: 128
      };
      
      const requirements = {
        maxBitrate: 9000,
        maxResolution: '1920x1080',
        supportedCodecs: ['h264', 'h265'],
        requiresAuth: true,
        supportsRTMP: true,
        supportsHLS: false
      };

      const adaptedConfig = adapter.adaptStreamConfig(baseConfig, requirements);
      
      expect(adaptedConfig.bitrate).toBeLessThanOrEqual(9000);
      expect(adaptedConfig.codec).toBe('h264');
      expect(adaptedConfig.resolution).toBe('1920x1080');
    });

    it('should adapt stream config for Facebook requirements', () => {
      const adapter = AdapterFactory.getAdapter('facebook');
      const baseConfig = {
        bitrate: 10000, // Higher than Facebook max
        resolution: '1920x1080',
        codec: 'h265', // Not supported by Facebook
        framerate: 30,
        keyframeInterval: 2,
        audioCodec: 'aac',
        audioBitrate: 128
      };
      
      const requirements = {
        maxBitrate: 6000,
        maxResolution: '1920x1080',
        supportedCodecs: ['h264'],
        requiresAuth: true,
        supportsRTMP: true,
        supportsHLS: false
      };

      const adaptedConfig = adapter.adaptStreamConfig(baseConfig, requirements);
      
      expect(adaptedConfig.bitrate).toBeLessThanOrEqual(6000);
      expect(adaptedConfig.codec).toBe('h264'); // Should be adapted to supported codec
    });

    it('should handle resolution adaptation', () => {
      const adapter = AdapterFactory.getAdapter('twitch');
      const baseConfig = {
        bitrate: 5000,
        resolution: '3840x2160', // 4K, higher than max
        codec: 'h264',
        framerate: 30,
        keyframeInterval: 2,
        audioCodec: 'aac',
        audioBitrate: 128
      };
      
      const requirements = {
        maxBitrate: 8000,
        maxResolution: '1920x1080', // Max 1080p
        supportedCodecs: ['h264'],
        requiresAuth: true,
        supportsRTMP: true,
        supportsHLS: false
      };

      const adaptedConfig = adapter.adaptStreamConfig(baseConfig, requirements);
      
      expect(adaptedConfig.resolution).toBe('1920x1080');
    });

    it('should validate YouTube credentials format', async () => {
      const adapter = AdapterFactory.getAdapter('youtube');
      
      // Valid credentials
      const validCredentials = {
        apiKey: 'AIzaSyDummyKeyForTesting123456789',
        streamKey: 'live_stream_key_12345'
      };
      
      const isValid = await adapter.validateCredentials(validCredentials);
      expect(isValid).toBe(true);
      
      // Invalid credentials
      const invalidCredentials = {
        apiKey: 'short',
        streamKey: 'short'
      };
      
      const isInvalid = await adapter.validateCredentials(invalidCredentials);
      expect(isInvalid).toBe(false);
    });

    it('should validate custom platform credentials', async () => {
      const adapter = AdapterFactory.getAdapter('custom');
      
      // Valid RTMP URL
      const validCredentials = {
        serverUrl: 'rtmp://live.example.com/app',
        streamKey: 'optional_key'
      };
      
      const isValid = await adapter.validateCredentials(validCredentials);
      expect(isValid).toBe(true);
      
      // Invalid URL
      const invalidCredentials = {
        serverUrl: 'invalid-url'
      };
      
      const isInvalid = await adapter.validateCredentials(invalidCredentials);
      expect(isInvalid).toBe(false);
    });
  });
});