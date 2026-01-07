import { PlayoutEngine, FFmpegConfig } from '../../services/PlayoutEngine';
import { StreamProcessModel } from '../../models/StreamProcess';
// import { ChannelModel } from '../../models/Channel';
import { FallbackVideoManager } from '../../utils/fallback';
import { db } from '../../config/database';

// Mock child_process to avoid spawning actual FFmpeg processes in tests
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    pid: 12345,
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn(),
    kill: jest.fn(),
    killed: false
  }))
}));

describe('PlayoutEngine', () => {
  let playoutEngine: PlayoutEngine;
  let testChannelId: string;
  let testConfig: FFmpegConfig;

  beforeAll(async () => {
    // Ensure fallback video exists for tests
    await FallbackVideoManager.createTestFallbackVideo();
  });

  beforeEach(async () => {
    // Clean up database
    await db('stream_processes').del();
    await db('channels').del();
    
    playoutEngine = new PlayoutEngine();
    testChannelId = 'test-channel-123';
    
    // Create test channel
    await db('channels').insert({
      id: testChannelId,
      client_id: 'test-client',
      name: 'Test Channel',
      status: 'STOPPED',
      config: JSON.stringify({
        name: 'Test Channel',
        resolution: 'HD',
        bitrate: 2000,
        fallbackVideo: 'test-fallback.mp4',
        hlsEnabled: true,
        rtmpDestinations: [],
        analyticsEnabled: false,
        monetizationEnabled: false,
        aiOptimizationEnabled: false,
        multiPlatformEnabled: false,
        interactionEnabled: false
      }),
      hls_endpoint: `https://example.com/hls/${testChannelId}/playlist.m3u8`,
      total_uptime: 0,
      restart_count: 0,
      last_start_time: null,
      last_stop_time: null,
      created_at: new Date(),
      updated_at: new Date()
    });

    testConfig = {
      inputSource: await FallbackVideoManager.getFallbackVideoPath(),
      outputTargets: [`hls:/tmp/hls/${testChannelId}/playlist.m3u8`],
      resolution: '1280x720',
      bitrate: 2000,
      hlsSegmentDuration: 6,
      hlsPlaylistSize: 10
    };
  });

  afterEach(async () => {
    // Clean up any running processes
    try {
      await playoutEngine.terminateStream(testChannelId);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initializeStream', () => {
    it('should initialize a stream successfully', async () => {
      await playoutEngine.initializeStream(testChannelId, testConfig);

      // Verify stream process was created
      const streamProcess = await StreamProcessModel.findByChannelId(testChannelId);
      expect(streamProcess).toBeDefined();
      expect(streamProcess!.status).toBe('RUNNING');
      expect(streamProcess!.ffmpegPid).toBe(12345);
    });

    it('should handle initialization errors gracefully', async () => {
      // Use invalid config to trigger error
      const invalidConfig = {
        ...testConfig,
        inputSource: '/nonexistent/file.mp4'
      };

      await expect(playoutEngine.initializeStream(testChannelId, invalidConfig))
        .rejects.toThrow();

      // Verify channel status was updated to ERROR
      // const channel = await ChannelModel.findById(testChannelId);
      // expect(channel.status).toBe('ERROR');
    });
  });

  describe('terminateStream', () => {
    it('should terminate a stream successfully', async () => {
      // First initialize the stream
      await playoutEngine.initializeStream(testChannelId, testConfig);

      // Then terminate it
      await playoutEngine.terminateStream(testChannelId);

      // Verify stream process status was updated
      const streamProcess = await StreamProcessModel.findByChannelId(testChannelId);
      expect(streamProcess!.status).toBe('IDLE');
    });

    it('should handle termination of non-existent stream', async () => {
      // Should not throw error when terminating non-existent stream
      await expect(playoutEngine.terminateStream('non-existent-channel'))
        .resolves.not.toThrow();
    });
  });

  describe('getStreamHealth', () => {
    it('should return stream health information', async () => {
      // Initialize stream first
      await playoutEngine.initializeStream(testChannelId, testConfig);

      const health = await playoutEngine.getStreamHealth(testChannelId);

      expect(health).toBeDefined();
      expect(health.status).toBe('RUNNING');
      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(health.restartCount).toBe(0);
      expect(health.errorCount).toBe(0);
    });

    it('should throw error for non-existent stream', async () => {
      await expect(playoutEngine.getStreamHealth('non-existent-channel'))
        .rejects.toThrow('Stream process not found');
    });
  });

  describe('handleStreamFailure', () => {
    it('should handle stream failure and attempt restart', async () => {
      // Initialize stream first
      await playoutEngine.initializeStream(testChannelId, testConfig);

      const error = new Error('Test stream failure');
      
      // Handle the failure
      await playoutEngine.handleStreamFailure(testChannelId, error);

      // Verify error count was incremented
      const streamProcess = await StreamProcessModel.findByChannelId(testChannelId);
      expect(streamProcess!.errorCount).toBeGreaterThan(0);
    });
  });

  describe('FFmpeg command generation', () => {
    it('should generate valid FFmpeg command for HLS output', () => {
      const engine = new PlayoutEngine();
      
      // Access private method for testing
      const generateCommand = (engine as any).generateFFmpegCommand.bind(engine);
      const command = generateCommand(testConfig);

      expect(command).toContain('ffmpeg');
      expect(command).toContain('-i');
      expect(command).toContain(testConfig.inputSource);
      expect(command).toContain('-f');
      expect(command).toContain('hls');
      expect(command).toContain('-s');
      expect(command).toContain('1280x720');
      expect(command).toContain('-b:v');
      expect(command).toContain('2000k');
    });

    it('should generate command with RTMP output', () => {
      const configWithRTMP = {
        ...testConfig,
        outputTargets: [
          `hls:/tmp/hls/${testChannelId}/playlist.m3u8`,
          'rtmp://live.twitch.tv/live/stream_key_123'
        ]
      };

      const engine = new PlayoutEngine();
      const generateCommand = (engine as any).generateFFmpegCommand.bind(engine);
      const command = generateCommand(configWithRTMP);

      expect(command).toContain('rtmp://live.twitch.tv/live/stream_key_123');
      expect(command).toContain('-f');
      expect(command).toContain('flv');
    });
  });

  describe('restart logic', () => {
    it('should calculate exponential backoff delay correctly', () => {
      const engine = new PlayoutEngine();
      const calculateDelay = (engine as any).calculateRestartDelay.bind(engine);

      const delay1 = calculateDelay(0);
      const delay2 = calculateDelay(1);
      const delay3 = calculateDelay(2);

      expect(delay1).toBeGreaterThanOrEqual(1000); // Base delay
      expect(delay2).toBeGreaterThanOrEqual(2000); // 2x base delay
      expect(delay3).toBeGreaterThanOrEqual(4000); // 4x base delay
      expect(delay3).toBeLessThanOrEqual(30000); // Max delay cap
    });
  });
});