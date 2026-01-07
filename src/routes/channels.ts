import express from 'express';
import { ChannelManager } from '../services/ChannelManager';
import { StreamManager } from '../services/StreamManager';
import { AnalyticsEngine } from '../services/AnalyticsEngine';
import { logger } from '../utils/logger';
import { CreateChannelRequest, UpdateChannelRequest } from '../types/channel';

const router = express.Router();
const channelManager = new ChannelManager();
const streamManager = new StreamManager();
const analyticsEngine = new AnalyticsEngine();

// Get all channels for a client
router.get('/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const channels = await channelManager.getChannelsByClient(clientId);
    res.json({ success: true, data: channels });
  } catch (error) {
    logger.error('Error fetching channels:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch channels' });
  }
});

// Get specific channel details
router.get('/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const channel = await channelManager.getChannel(channelId);
    res.json({ success: true, data: channel });
  } catch (error) {
    logger.error('Error fetching channel:', error);
    res.status(404).json({ success: false, error: 'Channel not found' });
  }
});

// Get channel status and metrics
router.get('/:channelId/status', async (req, res) => {
  try {
    const { channelId } = req.params;
    const status = await channelManager.getChannelStatus(channelId);
    const metrics = await streamManager.getOutputMetrics(channelId);
    const realtimeMetrics = await analyticsEngine.getRealtimeMetrics(channelId);
    
    res.json({ 
      success: true, 
      data: {
        status,
        metrics,
        realtimeMetrics
      }
    });
  } catch (error) {
    logger.error('Error fetching channel status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch channel status' });
  }
});

// Get HLS stream URL
router.get('/:channelId/stream', async (req, res) => {
  try {
    const { channelId } = req.params;
    const channel = await channelManager.getChannel(channelId);
    
    if (channel.status !== 'LIVE') {
      return res.status(400).json({ 
        success: false, 
        error: 'Channel is not live' 
      });
    }

    const streamUrl = `${req.protocol}://${req.get('host')}/hls/${channelId}/playlist.m3u8`;
    return res.json({ 
      success: true, 
      data: { 
        streamUrl,
        status: channel.status,
        hlsEndpoint: channel.hlsEndpoint
      }
    });
  } catch (error) {
    logger.error('Error fetching stream URL:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch stream URL' });
  }
});

// Create new channel
router.post('/', async (req, res) => {
  try {
    const { clientId, ...config } = req.body as CreateChannelRequest & { clientId: string };
    const channel = await channelManager.createChannel(clientId, config);
    res.status(201).json({ success: true, data: channel });
  } catch (error) {
    logger.error('Error creating channel:', error);
    res.status(400).json({ success: false, error: 'Failed to create channel' });
  }
});

// Update channel configuration
router.put('/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const updates = req.body as UpdateChannelRequest;
    const channel = await channelManager.updateChannel(channelId, updates);
    res.json({ success: true, data: channel });
  } catch (error) {
    logger.error('Error updating channel:', error);
    res.status(400).json({ success: false, error: 'Failed to update channel' });
  }
});

// Start channel
router.post('/:channelId/start', async (req, res) => {
  try {
    const { channelId } = req.params;
    await channelManager.startChannel(channelId);
    res.json({ success: true, message: 'Channel start initiated' });
  } catch (error) {
    logger.error('Error starting channel:', error);
    res.status(500).json({ success: false, error: 'Failed to start channel' });
  }
});

// Stop channel
router.post('/:channelId/stop', async (req, res) => {
  try {
    const { channelId } = req.params;
    await channelManager.stopChannel(channelId);
    res.json({ success: true, message: 'Channel stopped' });
  } catch (error) {
    logger.error('Error stopping channel:', error);
    res.status(500).json({ success: false, error: 'Failed to stop channel' });
  }
});

// Restart channel
router.post('/:channelId/restart', async (req, res) => {
  try {
    const { channelId } = req.params;
    await channelManager.restartChannel(channelId);
    res.json({ success: true, message: 'Channel restart initiated' });
  } catch (error) {
    logger.error('Error restarting channel:', error);
    res.status(500).json({ success: false, error: 'Failed to restart channel' });
  }
});

// Delete channel
router.delete('/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    await channelManager.deleteChannel(channelId);
    res.json({ success: true, message: 'Channel deleted' });
  } catch (error) {
    logger.error('Error deleting channel:', error);
    res.status(500).json({ success: false, error: 'Failed to delete channel' });
  }
});

// Test RTMP connectivity
router.post('/:channelId/test-rtmp', async (req, res) => {
  try {
    const { channelId } = req.params;
    const results = await channelManager.testRTMPConnectivity(channelId);
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('Error testing RTMP connectivity:', error);
    res.status(500).json({ success: false, error: 'Failed to test RTMP connectivity' });
  }
});

export default router;