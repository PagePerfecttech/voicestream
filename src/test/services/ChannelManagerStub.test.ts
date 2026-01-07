import { ChannelManagerStub } from '../../services/ChannelManagerStub';
import { CreateChannelRequest } from '../../types/channel';

describe('ChannelManagerStub', () => {
  let channelManager: ChannelManagerStub;
  
  beforeEach(() => {
    channelManager = new ChannelManagerStub();
  });
  
  describe('Channel Lifecycle Operations', () => {
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
      
      const channel = await channelManager.createChannel(clientId, channelConfig);
      
      expect(channel.id).toBeDefined();
      expect(channel.clientId).toBe(clientId);
      expect(channel.name).toBe('Test Channel');
      expect(channel.status).toBe('STOPPED');
      expect(channel.config.resolution).toBe('HD');
      expect(channel.config.bitrate).toBe(2000);
      expect(channel.hlsEndpoint).toContain(channel.id);
    });
    
    it('should start a channel successfully', async () => {
      const clientId = 'test-client-id';
      const channelConfig: CreateChannelRequest = {
        name: 'Test Channel',
        resolution: 'HD',
      };
      
      const channel = await channelManager.createChannel(clientId, channelConfig);
      
      await channelManager.startChannel(channel.id);
      
      const status = await channelManager.getChannelStatus(channel.id);
      expect(status).toBe('LIVE');
      
      const updatedChannel = await channelManager.getChannel(channel.id);
      expect(updatedChannel.lastStartTime).toBeDefined();
    });
    
    it('should stop a channel successfully', async () => {
      const clientId = 'test-client-id';
      const channelConfig: CreateChannelRequest = {
        name: 'Test Channel',
        resolution: 'HD',
      };
      
      const channel = await channelManager.createChannel(clientId, channelConfig);
      await channelManager.startChannel(channel.id);
      
      await channelManager.stopChannel(channel.id);
      
      const status = await channelManager.getChannelStatus(channel.id);
      expect(status).toBe('STOPPED');
      
      const updatedChannel = await channelManager.getChannel(channel.id);
      expect(updatedChannel.lastStopTime).toBeDefined();
      expect(updatedChannel.totalUptime).toBeGreaterThanOrEqual(0);
    });
    
    it('should restart a channel successfully', async () => {
      const clientId = 'test-client-id';
      const channelConfig: CreateChannelRequest = {
        name: 'Test Channel',
        resolution: 'HD',
      };
      
      const channel = await channelManager.createChannel(clientId, channelConfig);
      await channelManager.startChannel(channel.id);
      
      const initialRestartCount = channel.restartCount;
      
      await channelManager.restartChannel(channel.id);
      
      const status = await channelManager.getChannelStatus(channel.id);
      expect(status).toBe('LIVE');
      
      const updatedChannel = await channelManager.getChannel(channel.id);
      expect(updatedChannel.restartCount).toBe(initialRestartCount + 1);
    });
    
    it('should update channel configuration', async () => {
      const clientId = 'test-client-id';
      const channelConfig: CreateChannelRequest = {
        name: 'Test Channel',
        resolution: 'HD',
        bitrate: 2000,
      };
      
      const channel = await channelManager.createChannel(clientId, channelConfig);
      
      const updates = {
        name: 'Updated Channel',
        resolution: 'FHD' as const,
        bitrate: 4000,
        analyticsEnabled: false,
      };
      
      const updatedChannel = await channelManager.updateChannel(channel.id, updates);
      
      expect(updatedChannel.config.name).toBe('Updated Channel');
      expect(updatedChannel.config.resolution).toBe('FHD');
      expect(updatedChannel.config.bitrate).toBe(4000);
      expect(updatedChannel.config.analyticsEnabled).toBe(false);
    });
    
    it('should get channels by client', async () => {
      const clientId = 'test-client-id';
      const otherClientId = 'other-client-id';
      
      const channel1Config: CreateChannelRequest = {
        name: 'Channel 1',
        resolution: 'HD',
      };
      
      const channel2Config: CreateChannelRequest = {
        name: 'Channel 2',
        resolution: 'SD',
      };
      
      const otherChannelConfig: CreateChannelRequest = {
        name: 'Other Channel',
        resolution: 'HD',
      };
      
      await channelManager.createChannel(clientId, channel1Config);
      await channelManager.createChannel(clientId, channel2Config);
      await channelManager.createChannel(otherClientId, otherChannelConfig);
      
      const clientChannels = await channelManager.getChannelsByClient(clientId);
      const otherClientChannels = await channelManager.getChannelsByClient(otherClientId);
      
      expect(clientChannels).toHaveLength(2);
      expect(otherClientChannels).toHaveLength(1);
      
      expect(clientChannels[0].clientId).toBe(clientId);
      expect(clientChannels[1].clientId).toBe(clientId);
      expect(otherClientChannels[0].clientId).toBe(otherClientId);
    });
    
    it('should delete a channel successfully', async () => {
      const clientId = 'test-client-id';
      const channelConfig: CreateChannelRequest = {
        name: 'Test Channel',
        resolution: 'HD',
      };
      
      const channel = await channelManager.createChannel(clientId, channelConfig);
      await channelManager.startChannel(channel.id);
      
      await channelManager.deleteChannel(channel.id);
      
      await expect(channelManager.getChannel(channel.id))
        .rejects.toThrow('Channel not found');
    });
  });
  
  describe('Error Handling', () => {
    it('should throw error when starting already live channel', async () => {
      const clientId = 'test-client-id';
      const channelConfig: CreateChannelRequest = {
        name: 'Test Channel',
        resolution: 'HD',
      };
      
      const channel = await channelManager.createChannel(clientId, channelConfig);
      await channelManager.startChannel(channel.id);
      
      await expect(channelManager.startChannel(channel.id))
        .rejects.toThrow('Channel is already live');
    });
    
    it('should throw error when restarting stopped channel', async () => {
      const clientId = 'test-client-id';
      const channelConfig: CreateChannelRequest = {
        name: 'Test Channel',
        resolution: 'HD',
      };
      
      const channel = await channelManager.createChannel(clientId, channelConfig);
      
      await expect(channelManager.restartChannel(channel.id))
        .rejects.toThrow('Cannot restart channel in STOPPED state');
    });
    
    it('should throw error when operating on non-existent channel', async () => {
      const nonExistentId = 'non-existent-channel';
      
      await expect(channelManager.getChannel(nonExistentId))
        .rejects.toThrow('Channel not found');
        
      await expect(channelManager.startChannel(nonExistentId))
        .rejects.toThrow('Channel not found');
        
      await expect(channelManager.stopChannel(nonExistentId))
        .rejects.toThrow('Channel not found');
        
      await expect(channelManager.deleteChannel(nonExistentId))
        .rejects.toThrow('Channel not found');
    });
  });
  
  describe('Subscription Limits', () => {
    it('should enforce subscription limits', async () => {
      const clientId = 'test-client-id';
      
      const result = await channelManager.enforceSubscriptionLimits(clientId, 'CREATE_CHANNEL');
      
      expect(result).toBe(true);
    });
  });
});