import { StreamManager } from '../../services/StreamManager';
import { RTMPDestination, Resolution } from '../../types/channel';
import * as fs from 'fs';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock child_process
jest.mock('child_process');

describe('StreamManager', () => {
  let streamManager: StreamManager;
  const testChannelId = 'test-channel-123';

  beforeEach(() => {
    streamManager = new StreamManager();
    jest.clearAllMocks();
    
    // Mock fs.promises methods
    mockFs.promises = {
      mkdir: jest.fn().mockResolvedValue(undefined),
      readdir: jest.fn().mockResolvedValue([]),
      stat: jest.fn().mockResolvedValue({ size: 1024 }),
      unlink: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock fs.watch
    mockFs.watch = jest.fn().mockReturnValue({
      close: jest.fn()
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('setupHLSOutput', () => {
    it('should create HLS endpoint with unique URL', async () => {
      const hlsEndpoint = await streamManager.setupHLSOutput(testChannelId);

      expect(hlsEndpoint).toBeDefined();
      expect(hlsEndpoint.channelId).toBe(testChannelId);
      expect(hlsEndpoint.playlistUrl).toContain(testChannelId);
      expect(hlsEndpoint.playlistUrl).toContain('playlist.m3u8');
      expect(hlsEndpoint.isActive).toBe(false);
      expect(hlsEndpoint.id).toBeDefined();
      expect(hlsEndpoint.createdAt).toBeInstanceOf(Date);
    });

    it('should create channel directory', async () => {
      await streamManager.setupHLSOutput(testChannelId);

      expect(mockFs.promises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(testChannelId),
        { recursive: true }
      );
    });

    it('should set up segment monitoring', async () => {
      await streamManager.setupHLSOutput(testChannelId);

      expect(mockFs.watch).toHaveBeenCalledWith(
        expect.stringContaining(testChannelId),
        expect.any(Function)
      );
    });
  });

  describe('setupRTMPOutput', () => {
    const mockRTMPDestinations: RTMPDestination[] = [
      {
        id: 'rtmp-1',
        serverUrl: 'rtmp://live.twitch.tv/live',
        streamKey: 'test-stream-key',
        platform: 'twitch',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'rtmp-2',
        serverUrl: 'rtmp://a.rtmp.youtube.com/live2',
        streamKey: 'youtube-stream-key',
        platform: 'youtube',
        enabled: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    it('should setup RTMP output for enabled destinations', async () => {
      await streamManager.setupRTMPOutput(testChannelId, mockRTMPDestinations);

      // Should only process enabled destinations
      const metrics = await streamManager.getOutputMetrics(testChannelId);
      expect(metrics.rtmpConnections).toHaveLength(1);
      expect(metrics.rtmpConnections[0].destinationId).toBe('rtmp-1');
      expect(metrics.rtmpConnections[0].platform).toBe('twitch');
    });

    it('should skip disabled RTMP destinations', async () => {
      const disabledDestinations = mockRTMPDestinations.map(dest => ({
        ...dest,
        enabled: false
      }));

      await streamManager.setupRTMPOutput(testChannelId, disabledDestinations);

      const metrics = await streamManager.getOutputMetrics(testChannelId);
      expect(metrics.rtmpConnections).toHaveLength(0);
    });
  });

  describe('validateRTMPConnection', () => {
    const validRTMPDestination: RTMPDestination = {
      id: 'rtmp-test',
      serverUrl: 'rtmp://live.twitch.tv/live',
      streamKey: 'valid-stream-key',
      platform: 'twitch',
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should validate RTMP URL format first', async () => {
      const invalidDestination = {
        ...validRTMPDestination,
        serverUrl: 'invalid-url'
      };

      const isValid = await streamManager.validateRTMPConnection(invalidDestination);
      expect(isValid).toBe(false);
    });

    it('should return true for valid RTMP destination', async () => {
      // Mock spawn to simulate successful connection test
      const { spawn } = require('child_process');
      const mockProcess = {
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'exit') {
            setTimeout(() => callback(0), 100);
          }
        }),
        kill: jest.fn()
      };
      spawn.mockReturnValue(mockProcess);

      const isValid = await streamManager.validateRTMPConnection(validRTMPDestination);
      expect(isValid).toBe(true);
    });
  });

  describe('generateUniqueHLSUrl', () => {
    it('should generate unique URLs for same channel', () => {
      const url1 = streamManager.generateUniqueHLSUrl(testChannelId);
      const url2 = streamManager.generateUniqueHLSUrl(testChannelId);

      expect(url1).toContain(testChannelId);
      expect(url2).toContain(testChannelId);
      expect(url1).not.toBe(url2);
      expect(url1).toContain('playlist.m3u8');
      expect(url2).toContain('playlist.m3u8');
    });

    it('should include timestamp and unique ID parameters', () => {
      const url = streamManager.generateUniqueHLSUrl(testChannelId);
      
      expect(url).toMatch(/[?&]t=\d+/);
      expect(url).toMatch(/[?&]id=[a-f0-9-]+/);
    });
  });

  describe('enforceSingleBitrate', () => {
    it('should enforce minimum bitrate for SD resolution', () => {
      const config = {
        channelId: testChannelId,
        resolution: 'SD' as Resolution,
        bitrate: 200, // Below minimum
        hlsSegmentDuration: 6,
        hlsPlaylistSize: 10,
        outputPath: '/test/path'
      };

      const enforcedConfig = streamManager.enforceSingleBitrate(config);
      expect(enforcedConfig.bitrate).toBe(500); // Minimum for SD
    });

    it('should enforce maximum bitrate for HD resolution', () => {
      const config = {
        channelId: testChannelId,
        resolution: 'HD' as Resolution,
        bitrate: 5000, // Above maximum
        hlsSegmentDuration: 6,
        hlsPlaylistSize: 10,
        outputPath: '/test/path'
      };

      const enforcedConfig = streamManager.enforceSingleBitrate(config);
      expect(enforcedConfig.bitrate).toBe(3000); // Maximum for HD
    });

    it('should keep valid bitrate unchanged', () => {
      const config = {
        channelId: testChannelId,
        resolution: 'FHD' as Resolution,
        bitrate: 4000, // Within range
        hlsSegmentDuration: 6,
        hlsPlaylistSize: 10,
        outputPath: '/test/path'
      };

      const enforcedConfig = streamManager.enforceSingleBitrate(config);
      expect(enforcedConfig.bitrate).toBe(4000); // Unchanged
    });
  });

  describe('getOutputMetrics', () => {
    it('should throw error for non-existent channel', async () => {
      await expect(streamManager.getOutputMetrics('non-existent'))
        .rejects.toThrow('No output metrics found for channel non-existent');
    });

    it('should return metrics after HLS setup', async () => {
      await streamManager.setupHLSOutput(testChannelId);
      
      const metrics = await streamManager.getOutputMetrics(testChannelId);
      
      expect(metrics.channelId).toBe(testChannelId);
      expect(metrics.hlsSegmentCount).toBe(0);
      expect(metrics.lastSegmentTime).toBeNull();
      expect(metrics.averageBitrate).toBe(0);
      expect(metrics.rtmpConnections).toEqual([]);
      expect(metrics.totalBytesServed).toBe(0);
      expect(metrics.viewerCount).toBe(0);
      expect(metrics.uptime).toBe(0);
    });
  });

  describe('startStreaming and stopStreaming', () => {
    beforeEach(async () => {
      await streamManager.setupHLSOutput(testChannelId);
    });

    it('should activate HLS endpoint when starting streaming', async () => {
      await streamManager.startStreaming(testChannelId);
      
      const metrics = await streamManager.getOutputMetrics(testChannelId);
      expect(metrics.uptime).toBe(0); // Just started
    });

    it('should deactivate HLS endpoint when stopping streaming', async () => {
      await streamManager.startStreaming(testChannelId);
      await streamManager.stopStreaming(testChannelId);
      
      // Should clean up segments
      expect(mockFs.promises.readdir).toHaveBeenCalled();
    });

    it('should emit events when starting and stopping', async () => {
      const startSpy = jest.fn();
      const stopSpy = jest.fn();
      
      streamManager.on('streamingStarted', startSpy);
      streamManager.on('streamingStopped', stopSpy);
      
      await streamManager.startStreaming(testChannelId);
      expect(startSpy).toHaveBeenCalledWith(testChannelId);
      
      await streamManager.stopStreaming(testChannelId);
      expect(stopSpy).toHaveBeenCalledWith(testChannelId);
    });
  });

  describe('getStreamHealth', () => {
    beforeEach(async () => {
      await streamManager.setupHLSOutput(testChannelId);
    });

    it('should return health status for inactive stream', async () => {
      const health = await streamManager.getStreamHealth(testChannelId);
      
      expect(health.hlsActive).toBe(false);
      expect(health.rtmpActive).toBe(false);
      expect(health.segmentCount).toBe(0);
      expect(health.lastActivity).toBeNull();
      expect(health.errors).toContain('HLS endpoint not active');
    });

    it('should return health status for active stream', async () => {
      await streamManager.startStreaming(testChannelId);
      
      const health = await streamManager.getStreamHealth(testChannelId);
      
      expect(health.hlsActive).toBe(true);
      expect(health.rtmpActive).toBe(false);
      expect(health.segmentCount).toBe(0);
      expect(health.lastActivity).toBeNull();
      expect(health.errors).not.toContain('HLS endpoint not active');
    });
  });
});