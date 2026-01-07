import { ChannelManager } from '../../services/ChannelManager';
import { ChannelModel } from '../../models/Channel';
import { StreamProcessModel } from '../../models/StreamProcess';
import { ClientSubscriptionModel } from '../../models/SubscriptionPlan';
import { CreateChannelRequest, ChannelStatus } from '../../types/channel';

// Mock the models to avoid database dependencies in unit tests
jest.mock('../../models/Channel');
jest.mock('../../models/StreamProcess');
jest.mock('../../models/SubscriptionPlan');

const MockedChannelModel = ChannelModel as jest.Mocked<typeof ChannelModel>;
const MockedStreamProcessModel = StreamProcessModel as jest.Mocked<typeof StreamProcessModel>;
const MockedClientSubscriptionModel = ClientSubscriptionModel as jest.Mocked<typeof ClientSubscriptionModel>;

describe('ChannelManager', () => {
  let channelManager: ChannelManager;
  
  beforeEach(() => {
    channelManager = new ChannelManager();
    jest.clearAllMocks();
  });
  
  describe('createChannel', () => {
    it('should create a channel successfully', async () => {
      const clientId = 'test-client-id';
      const channelConfig: CreateChannelRequest = {
        name: 'Test Channel',
        resolution: 'HD',
        bitrate: 2000,
        fallbackVideo: 'fallback.mp4',
        hlsEnabled: true,
        rtmpDestinations: [],
        analyticsEnabled: true,
      };
      
      const mockChannel = {
        id: 'test-channel-id',
        clientId,
        name: 'Test Channel',
        status: 'STOPPED' as ChannelStatus,
        config: channelConfig,
        createdAt: new Date(),
        updatedAt: new Date(),
        hlsEndpoint: 'https://stream.example.com/hls/test-channel-id/playlist.m3u8',
        totalUptime: 0,
        restartCount: 0,
        lastStartTime: null,
        lastStopTime: null,
      };
      
      MockedChannelModel.create.mockResolvedValue(mockChannel);
      
      const result = await channelManager.createChannel(clientId, channelConfig);
      
      expect(MockedChannelModel.create).toHaveBeenCalledWith(clientId, channelConfig);
      expect(result).toEqual(mockChannel);
    });
    
    it('should throw error when channel creation fails', async () => {
      const clientId = 'test-client-id';
      const channelConfig: CreateChannelRequest = {
        name: 'Test Channel',
        resolution: 'HD',
      };
      
      MockedChannelModel.create.mockRejectedValue(new Error('Channel name already exists'));
      
      await expect(channelManager.createChannel(clientId, channelConfig))
        .rejects.toThrow('Channel name already exists');
    });
  });
  
  describe('startChannel', () => {
    it('should start a channel successfully', async () => {
      const channelId = 'test-channel-id';
      const mockChannel = {
        id: channelId,
        clientId: 'test-client-id',
        name: 'Test Channel',
        status: 'STOPPED' as ChannelStatus,
        config: {
          name: 'Test Channel',
          resolution: 'HD' as const,
          bitrate: 2000,
          fallbackVideo: 'fallback.mp4',
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
        hlsEndpoint: 'https://stream.example.com/hls/test-channel-id/playlist.m3u8',
        totalUptime: 0,
        restartCount: 0,
        lastStartTime: null,
        lastStopTime: null,
      };
      
      const mockStreamProcess = {
        id: 'test-process-id',
        channelId,
        ffmpegPid: null,
        status: 'IDLE' as const,
        startTime: null,
        lastHeartbeat: null,
        inputSource: 'fallback.mp4',
        outputTargets: ['hls:/tmp/hls/test-channel-id/playlist.m3u8'],
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
      
      const mockSubscriptionData = {
        subscription: {
          id: 'sub-id',
          clientId: 'test-client-id',
          planId: 'plan-id',
          status: 'ACTIVE' as const,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          trialEndDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        plan: {
          id: 'plan-id',
          name: 'Basic Plan',
          monthlyPrice: 29.99,
          channelLimit: 5,
          maxResolution: 'HD' as const,
          outputTypes: ['HLS' as const, 'RTMP' as const],
          storageLimit: 100,
          concurrentChannels: 2,
          trialAllowed: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
      
      MockedChannelModel.findById.mockResolvedValue(mockChannel);
      MockedChannelModel.findByClientId.mockResolvedValue([mockChannel]);
      MockedClientSubscriptionModel.getSubscriptionWithPlan.mockResolvedValue(mockSubscriptionData);
      MockedStreamProcessModel.findByChannelId.mockResolvedValue(null);
      MockedStreamProcessModel.create.mockResolvedValue(mockStreamProcess);
      MockedChannelModel.updateStatus.mockResolvedValue();
      MockedStreamProcessModel.updateStatus.mockResolvedValue();
      MockedStreamProcessModel.updateHeartbeat.mockResolvedValue();
      
      await channelManager.startChannel(channelId);
      
      expect(MockedChannelModel.findById).toHaveBeenCalledWith(channelId);
      expect(MockedChannelModel.updateStatus).toHaveBeenCalledWith(channelId, 'STARTING');
      expect(MockedChannelModel.updateStatus).toHaveBeenCalledWith(channelId, 'LIVE');
      expect(MockedStreamProcessModel.create).toHaveBeenCalled();
    });
    
    it('should throw error when channel is already live', async () => {
      const channelId = 'test-channel-id';
      const mockChannel = {
        id: channelId,
        clientId: 'test-client-id',
        name: 'Test Channel',
        status: 'LIVE' as ChannelStatus,
        config: {
          name: 'Test Channel',
          resolution: 'HD' as const,
          bitrate: 2000,
          fallbackVideo: 'fallback.mp4',
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
        hlsEndpoint: 'https://stream.example.com/hls/test-channel-id/playlist.m3u8',
        totalUptime: 0,
        restartCount: 0,
        lastStartTime: null,
        lastStopTime: null,
      };
      
      MockedChannelModel.findById.mockResolvedValue(mockChannel);
      
      await expect(channelManager.startChannel(channelId))
        .rejects.toThrow('Channel is already live');
    });
  });
  
  describe('stopChannel', () => {
    it('should stop a channel successfully', async () => {
      const channelId = 'test-channel-id';
      const mockChannel = {
        id: channelId,
        clientId: 'test-client-id',
        name: 'Test Channel',
        status: 'LIVE' as ChannelStatus,
        config: {
          name: 'Test Channel',
          resolution: 'HD' as const,
          bitrate: 2000,
          fallbackVideo: 'fallback.mp4',
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
        hlsEndpoint: 'https://stream.example.com/hls/test-channel-id/playlist.m3u8',
        totalUptime: 0,
        restartCount: 0,
        lastStartTime: new Date(Date.now() - 60000), // 1 minute ago
        lastStopTime: null,
      };
      
      const mockStreamProcess = {
        id: 'test-process-id',
        channelId,
        ffmpegPid: 1234,
        status: 'RUNNING' as const,
        startTime: new Date(),
        lastHeartbeat: new Date(),
        inputSource: 'fallback.mp4',
        outputTargets: ['hls:/tmp/hls/test-channel-id/playlist.m3u8'],
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
      
      MockedChannelModel.findById.mockResolvedValue(mockChannel);
      MockedStreamProcessModel.findByChannelId.mockResolvedValue(mockStreamProcess);
      MockedChannelModel.updateStatus.mockResolvedValue();
      MockedChannelModel.updateUptime.mockResolvedValue();
      MockedStreamProcessModel.updateStatus.mockResolvedValue();
      
      await channelManager.stopChannel(channelId);
      
      expect(MockedChannelModel.findById).toHaveBeenCalledWith(channelId);
      expect(MockedStreamProcessModel.updateStatus).toHaveBeenCalledWith(mockStreamProcess.id, 'IDLE');
      expect(MockedChannelModel.updateStatus).toHaveBeenCalledWith(channelId, 'STOPPED');
      expect(MockedChannelModel.updateUptime).toHaveBeenCalled();
    });
    
    it('should handle stopping already stopped channel', async () => {
      const channelId = 'test-channel-id';
      const mockChannel = {
        id: channelId,
        clientId: 'test-client-id',
        name: 'Test Channel',
        status: 'STOPPED' as ChannelStatus,
        config: {
          name: 'Test Channel',
          resolution: 'HD' as const,
          bitrate: 2000,
          fallbackVideo: 'fallback.mp4',
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
        hlsEndpoint: 'https://stream.example.com/hls/test-channel-id/playlist.m3u8',
        totalUptime: 0,
        restartCount: 0,
        lastStartTime: null,
        lastStopTime: null,
      };
      
      MockedChannelModel.findById.mockResolvedValue(mockChannel);
      
      await channelManager.stopChannel(channelId);
      
      expect(MockedChannelModel.findById).toHaveBeenCalledWith(channelId);
      // Should not call updateStatus since channel is already stopped
      expect(MockedChannelModel.updateStatus).not.toHaveBeenCalled();
    });
  });
  
  describe('restartChannel', () => {
    it('should restart a live channel successfully', async () => {
      const channelId = 'test-channel-id';
      const mockChannel = {
        id: channelId,
        clientId: 'test-client-id',
        name: 'Test Channel',
        status: 'LIVE' as ChannelStatus,
        config: {
          name: 'Test Channel',
          resolution: 'HD' as const,
          bitrate: 2000,
          fallbackVideo: 'fallback.mp4',
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
        hlsEndpoint: 'https://stream.example.com/hls/test-channel-id/playlist.m3u8',
        totalUptime: 0,
        restartCount: 0,
        lastStartTime: new Date(),
        lastStopTime: null,
      };
      
      // Mock the channel manager methods
      const stopChannelSpy = jest.spyOn(channelManager, 'stopChannel').mockResolvedValue();
      const startChannelSpy = jest.spyOn(channelManager, 'startChannel').mockResolvedValue();
      
      MockedChannelModel.findById.mockResolvedValue(mockChannel);
      MockedChannelModel.incrementRestartCount.mockResolvedValue();
      
      await channelManager.restartChannel(channelId);
      
      expect(stopChannelSpy).toHaveBeenCalledWith(channelId);
      expect(startChannelSpy).toHaveBeenCalledWith(channelId);
      expect(MockedChannelModel.incrementRestartCount).toHaveBeenCalledWith(channelId);
    });
    
    it('should throw error when trying to restart stopped channel', async () => {
      const channelId = 'test-channel-id';
      const mockChannel = {
        id: channelId,
        clientId: 'test-client-id',
        name: 'Test Channel',
        status: 'STOPPED' as ChannelStatus,
        config: {
          name: 'Test Channel',
          resolution: 'HD' as const,
          bitrate: 2000,
          fallbackVideo: 'fallback.mp4',
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
        hlsEndpoint: 'https://stream.example.com/hls/test-channel-id/playlist.m3u8',
        totalUptime: 0,
        restartCount: 0,
        lastStartTime: null,
        lastStopTime: null,
      };
      
      MockedChannelModel.findById.mockResolvedValue(mockChannel);
      
      await expect(channelManager.restartChannel(channelId))
        .rejects.toThrow('Cannot restart channel in STOPPED state');
    });
  });
  
  describe('getChannelStatus', () => {
    it('should return channel status', async () => {
      const channelId = 'test-channel-id';
      const mockChannel = {
        id: channelId,
        clientId: 'test-client-id',
        name: 'Test Channel',
        status: 'LIVE' as ChannelStatus,
        config: {
          name: 'Test Channel',
          resolution: 'HD' as const,
          bitrate: 2000,
          fallbackVideo: 'fallback.mp4',
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
        hlsEndpoint: 'https://stream.example.com/hls/test-channel-id/playlist.m3u8',
        totalUptime: 0,
        restartCount: 0,
        lastStartTime: new Date(),
        lastStopTime: null,
      };
      
      MockedChannelModel.findById.mockResolvedValue(mockChannel);
      
      const status = await channelManager.getChannelStatus(channelId);
      
      expect(status).toBe('LIVE');
      expect(MockedChannelModel.findById).toHaveBeenCalledWith(channelId);
    });
  });
  
  describe('enforceSubscriptionLimits', () => {
    it('should enforce channel creation limits', async () => {
      const clientId = 'test-client-id';
      const mockSubscriptionData = {
        subscription: {
          id: 'sub-id',
          clientId,
          planId: 'plan-id',
          status: 'ACTIVE' as const,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          trialEndDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        plan: {
          id: 'plan-id',
          name: 'Basic Plan',
          monthlyPrice: 29.99,
          channelLimit: 5,
          maxResolution: 'HD' as const,
          outputTypes: ['HLS' as const, 'RTMP' as const],
          storageLimit: 100,
          concurrentChannels: 2,
          trialAllowed: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
      
      MockedClientSubscriptionModel.getSubscriptionWithPlan.mockResolvedValue(mockSubscriptionData);
      MockedChannelModel.findByClientId.mockResolvedValue([]);
      
      const result = await channelManager.enforceSubscriptionLimits(clientId, 'CREATE_CHANNEL');
      
      expect(result).toBe(true);
      expect(MockedClientSubscriptionModel.getSubscriptionWithPlan).toHaveBeenCalledWith(clientId);
    });
    
    it('should throw error when no active subscription', async () => {
      const clientId = 'test-client-id';
      
      MockedClientSubscriptionModel.getSubscriptionWithPlan.mockResolvedValue(null);
      
      await expect(channelManager.enforceSubscriptionLimits(clientId, 'CREATE_CHANNEL'))
        .rejects.toThrow('No active subscription found for client');
    });
  });
});