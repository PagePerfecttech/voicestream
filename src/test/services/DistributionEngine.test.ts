import { DistributionEngine } from '../../services/DistributionEngine';
import { AdapterFactory } from '../../services/adapters/AdapterFactory';
import { PlatformType, StreamingPlatform, StreamConfig } from '../../types/distribution';

// Mock database
const mockDb = jest.fn();
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockWhere = jest.fn();
const mockUpdate = jest.fn();
const mockDel = jest.fn();
const mockReturning = jest.fn();
const mockFirst = jest.fn();
const mockOrderBy = jest.fn();

// Setup mock chain
mockDb.mockReturnValue({
  insert: mockInsert,
  select: mockSelect,
  where: mockWhere,
  update: mockUpdate,
  del: mockDel,
  returning: mockReturning,
  first: mockFirst,
  orderBy: mockOrderBy
});

mockInsert.mockReturnValue({
  returning: mockReturning
});

mockWhere.mockReturnValue({
  first: mockFirst,
  update: mockUpdate,
  del: mockDel,
  returning: mockReturning,
  orderBy: mockOrderBy
});

mockUpdate.mockReturnValue({
  returning: mockReturning
});

mockOrderBy.mockReturnValue({
  first: mockFirst
});

mockReturning.mockResolvedValue([{
  id: 'test-platform-id',
  channel_id: 'test-channel-id',
  name: 'youtube',
  display_name: 'YouTube Live',
  auth_credentials: '{"apiKey":"test-key","streamKey":"test-stream-key"}',
  stream_requirements: '{"maxBitrate":9000,"maxResolution":"1920x1080"}',
  enabled: true,
  status: 'DISCONNECTED',
  auth_status: 'VALID',
  last_connected: null,
  error_message: null,
  created_at: new Date(),
  updated_at: new Date()
}]);

mockFirst.mockResolvedValue({
  id: 'test-platform-id',
  channel_id: 'test-channel-id',
  name: 'youtube',
  display_name: 'YouTube Live',
  auth_credentials: '{"apiKey":"test-key","streamKey":"test-stream-key"}',
  stream_requirements: '{"maxBitrate":9000,"maxResolution":"1920x1080"}',
  enabled: true,
  status: 'DISCONNECTED',
  auth_status: 'VALID',
  last_connected: null,
  error_message: null,
  created_at: new Date(),
  updated_at: new Date()
});

describe('DistributionEngine', () => {
  let distributionEngine: DistributionEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    distributionEngine = new DistributionEngine(mockDb as any);
  });

  afterEach(() => {
    AdapterFactory.clearCache();
  });

  describe('addPlatform', () => {
    it('should add a platform successfully', async () => {
      const channelId = 'test-channel-id';
      const platformData = {
        name: 'youtube' as PlatformType,
        displayName: 'YouTube Live',
        authCredentials: {
          apiKey: 'test-key',
          streamKey: 'test-stream-key'
        },
        streamRequirements: {
          maxBitrate: 9000,
          maxResolution: '1920x1080',
          supportedCodecs: ['h264'],
          requiresAuth: true,
          supportsRTMP: true,
          supportsHLS: false
        },
        enabled: true,
        status: 'DISCONNECTED' as const,
        authStatus: 'VALID' as const
      };

      const result = await distributionEngine.addPlatform(channelId, platformData);

      expect(result).toBeDefined();
      expect(result.name).toBe('youtube');
      expect(result.channelId).toBe(channelId);
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should throw error for unsupported platform type', async () => {
      const channelId = 'test-channel-id';
      const platformData = {
        name: 'unsupported' as any,
        displayName: 'Unsupported Platform',
        authCredentials: {},
        streamRequirements: {
          maxBitrate: 1000,
          maxResolution: '720x480',
          supportedCodecs: ['h264'],
          requiresAuth: false,
          supportsRTMP: true,
          supportsHLS: false
        },
        enabled: true,
        status: 'DISCONNECTED' as const,
        authStatus: 'VALID' as const
      };

      await expect(distributionEngine.addPlatform(channelId, platformData))
        .rejects.toThrow('Unsupported platform type: unsupported');
    });
  });

  describe('getPlatforms', () => {
    it('should return platforms for a channel', async () => {
      const channelId = 'test-channel-id';
      
      mockDb.mockReturnValue({
        where: mockWhere,
        orderBy: mockOrderBy
      });
      
      mockWhere.mockReturnValue({
        orderBy: mockOrderBy
      });
      
      mockOrderBy.mockResolvedValue([{
        id: 'test-platform-id',
        channel_id: channelId,
        name: 'youtube',
        display_name: 'YouTube Live',
        auth_credentials: '{"apiKey":"test-key"}',
        stream_requirements: '{"maxBitrate":9000}',
        enabled: true,
        status: 'DISCONNECTED',
        auth_status: 'VALID',
        last_connected: null,
        error_message: null,
        created_at: new Date(),
        updated_at: new Date()
      }]);

      const result = await distributionEngine.getPlatforms(channelId);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('youtube');
      expect(result[0].channelId).toBe(channelId);
    });
  });

  describe('adaptStreamForPlatform', () => {
    it('should adapt stream configuration for platform requirements', async () => {
      const channelId = 'test-channel-id';
      const platformId = 'test-platform-id';
      const baseConfig: StreamConfig = {
        bitrate: 10000,
        resolution: '1920x1080',
        codec: 'h264',
        framerate: 30,
        keyframeInterval: 2,
        audioCodec: 'aac',
        audioBitrate: 128
      };

      const result = await distributionEngine.adaptStreamForPlatform(channelId, platformId, baseConfig);

      expect(result).toBeDefined();
      expect(result.bitrate).toBeLessThanOrEqual(9000); // YouTube max bitrate
      expect(result.codec).toBe('h264');
    });
  });

  describe('validatePlatformCredentials', () => {
    it('should validate platform credentials', async () => {
      const channelId = 'test-channel-id';
      const platformId = 'test-platform-id';

      mockUpdate.mockResolvedValue(1);

      const result = await distributionEngine.validatePlatformCredentials(channelId, platformId);

      expect(typeof result).toBe('boolean');
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('startDistribution', () => {
    it('should start distribution for enabled platforms', async () => {
      const channelId = 'test-channel-id';
      const streamConfig: StreamConfig = {
        bitrate: 2000,
        resolution: '1280x720',
        codec: 'h264',
        framerate: 30,
        keyframeInterval: 2,
        audioCodec: 'aac',
        audioBitrate: 128
      };

      // Mock getPlatforms to return enabled platforms
      jest.spyOn(distributionEngine, 'getPlatforms').mockResolvedValue([
        {
          id: 'test-platform-id',
          channelId: channelId,
          name: 'youtube',
          displayName: 'YouTube Live',
          authCredentials: { apiKey: 'test-key', streamKey: 'test-stream-key' },
          streamRequirements: {
            maxBitrate: 9000,
            maxResolution: '1920x1080',
            supportedCodecs: ['h264'],
            requiresAuth: true,
            supportsRTMP: true,
            supportsHLS: false
          },
          enabled: true,
          status: 'DISCONNECTED',
          authStatus: 'VALID',
          createdAt: new Date(),
          updatedAt: new Date()
        } as StreamingPlatform
      ]);

      await expect(distributionEngine.startDistribution(channelId, streamConfig))
        .resolves.not.toThrow();
    });
  });

  describe('stopDistribution', () => {
    it('should stop distribution for active platforms', async () => {
      const channelId = 'test-channel-id';

      // Mock getPlatforms to return active platforms
      jest.spyOn(distributionEngine, 'getPlatforms').mockResolvedValue([
        {
          id: 'test-platform-id',
          channelId: channelId,
          name: 'youtube',
          displayName: 'YouTube Live',
          authCredentials: { apiKey: 'test-key', streamKey: 'test-stream-key' },
          streamRequirements: {
            maxBitrate: 9000,
            maxResolution: '1920x1080',
            supportedCodecs: ['h264'],
            requiresAuth: true,
            supportsRTMP: true,
            supportsHLS: false
          },
          enabled: true,
          status: 'CONNECTED',
          authStatus: 'VALID',
          createdAt: new Date(),
          updatedAt: new Date()
        } as StreamingPlatform
      ]);

      await expect(distributionEngine.stopDistribution(channelId))
        .resolves.not.toThrow();
    });
  });
});