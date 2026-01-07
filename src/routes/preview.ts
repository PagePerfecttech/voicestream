import express from 'express';
import { PreviewPlayerService } from '../services/PreviewPlayer';
import { ChannelManager } from '../services/ChannelManager';
import { logger } from '../utils/logger';

const router = express.Router();
const previewService = new PreviewPlayerService();
const channelManager = new ChannelManager();

// Serve preview interface for a specific channel
router.get('/channel/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    
    // Verify channel exists
    const channel = await channelManager.getChannel(channelId);
    if (!channel) {
      return res.status(404).send('Channel not found');
    }

    // Register stream with preview service
    const hlsUrl = `${req.protocol}://${req.get('host')}/hls/${channelId}/playlist.m3u8`;
    previewService.registerStream({
      channelId,
      hlsUrl,
      autoplay: false,
      muted: true,
      controls: true
    });

    // Generate and serve HTML
    const html = previewService.generatePreviewHTML(channelId);
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (error) {
    logger.error('Error serving preview interface:', error);
    return res.status(500).send('Internal server error');
  }
});

// Get preview configuration for a channel
router.get('/config/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const config = previewService.getStreamConfig(channelId);
    
    if (!config) {
      return res.status(404).json({ 
        success: false, 
        error: 'Preview not configured for this channel' 
      });
    }

    return res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Error fetching preview config:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch preview config' });
  }
});

// Update stream metrics (called by client-side player)
router.post('/metrics/:channelId', (req, res) => {
  try {
    const { channelId } = req.params;
    const metrics = req.body;
    
    previewService.updateStreamMetrics(channelId, metrics);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating stream metrics:', error);
    res.status(500).json({ success: false, error: 'Failed to update metrics' });
  }
});

// Get current stream metrics
router.get('/metrics/:channelId', (req, res) => {
  try {
    const { channelId } = req.params;
    const metrics = previewService.getStreamMetrics(channelId);
    
    res.json({ success: true, data: metrics || null });
  } catch (error) {
    logger.error('Error fetching stream metrics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch metrics' });
  }
});

// Unregister preview stream
router.delete('/channel/:channelId', (req, res) => {
  try {
    const { channelId } = req.params;
    previewService.unregisterStream(channelId);
    res.json({ success: true, message: 'Preview stream unregistered' });
  } catch (error) {
    logger.error('Error unregistering preview stream:', error);
    res.status(500).json({ success: false, error: 'Failed to unregister stream' });
  }
});

export default router;