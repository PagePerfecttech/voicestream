import { Router, Request, Response } from 'express';
import { DistributionEngine } from '../services/DistributionEngine';
import { db } from '../config/database';
import { logger } from '../utils/logger';
import { StreamConfig } from '../types/distribution';

const router = Router();
const distributionEngine = new DistributionEngine(db);

/**
 * Add a platform to a channel
 * POST /api/distribution/:channelId/platforms
 */
router.post('/:channelId/platforms', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const platformData = req.body;

    // Validate required fields
    if (!platformData.name || !platformData.displayName || !platformData.authCredentials) {
      return res.status(400).json({
        error: 'Missing required fields: name, displayName, authCredentials'
      });
    }

    const platform = await distributionEngine.addPlatform(channelId, platformData);
    
    return res.status(201).json({
      success: true,
      data: platform
    });

  } catch (error) {
    logger.error('Failed to add platform:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to add platform'
    });
  }
});

/**
 * Get all platforms for a channel
 * GET /api/distribution/:channelId/platforms
 */
router.get('/:channelId/platforms', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    
    const platforms = await distributionEngine.getPlatforms(channelId);
    
    return res.json({
      success: true,
      data: platforms
    });

  } catch (error) {
    logger.error('Failed to get platforms:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get platforms'
    });
  }
});

/**
 * Update a platform
 * PUT /api/distribution/:channelId/platforms/:platformId
 */
router.put('/:channelId/platforms/:platformId', async (req: Request, res: Response) => {
  try {
    const { channelId, platformId } = req.params;
    const updates = req.body;

    const platform = await distributionEngine.updatePlatform(channelId, platformId, updates);
    
    res.json({
      success: true,
      data: platform
    });

  } catch (error) {
    logger.error('Failed to update platform:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to update platform'
    });
  }
});

/**
 * Remove a platform from a channel
 * DELETE /api/distribution/:channelId/platforms/:platformId
 */
router.delete('/:channelId/platforms/:platformId', async (req: Request, res: Response) => {
  try {
    const { channelId, platformId } = req.params;

    await distributionEngine.removePlatform(channelId, platformId);
    
    res.json({
      success: true,
      message: 'Platform removed successfully'
    });

  } catch (error) {
    logger.error('Failed to remove platform:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to remove platform'
    });
  }
});

/**
 * Start distribution for a channel
 * POST /api/distribution/:channelId/start
 */
router.post('/:channelId/start', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const streamConfig: StreamConfig = req.body.streamConfig || {
      bitrate: 2000,
      resolution: '1280x720',
      codec: 'h264',
      framerate: 30,
      keyframeInterval: 2,
      audioCodec: 'aac',
      audioBitrate: 128
    };

    await distributionEngine.startDistribution(channelId, streamConfig);
    
    res.json({
      success: true,
      message: 'Distribution started successfully'
    });

  } catch (error) {
    logger.error('Failed to start distribution:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to start distribution'
    });
  }
});

/**
 * Stop distribution for a channel
 * POST /api/distribution/:channelId/stop
 */
router.post('/:channelId/stop', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;

    await distributionEngine.stopDistribution(channelId);
    
    res.json({
      success: true,
      message: 'Distribution stopped successfully'
    });

  } catch (error) {
    logger.error('Failed to stop distribution:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to stop distribution'
    });
  }
});

/**
 * Validate platform credentials
 * POST /api/distribution/:channelId/platforms/:platformId/validate
 */
router.post('/:channelId/platforms/:platformId/validate', async (req: Request, res: Response) => {
  try {
    const { channelId, platformId } = req.params;

    const isValid = await distributionEngine.validatePlatformCredentials(channelId, platformId);
    
    res.json({
      success: true,
      data: {
        valid: isValid
      }
    });

  } catch (error) {
    logger.error('Failed to validate platform credentials:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to validate credentials'
    });
  }
});

/**
 * Refresh platform authentication
 * POST /api/distribution/:channelId/platforms/:platformId/refresh-auth
 */
router.post('/:channelId/platforms/:platformId/refresh-auth', async (req: Request, res: Response) => {
  try {
    const { channelId, platformId } = req.params;

    await distributionEngine.refreshPlatformAuth(channelId, platformId);
    
    res.json({
      success: true,
      message: 'Platform authentication refreshed successfully'
    });

  } catch (error) {
    logger.error('Failed to refresh platform auth:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to refresh authentication'
    });
  }
});

/**
 * Get unified analytics for a channel
 * GET /api/distribution/:channelId/analytics
 */
router.get('/:channelId/analytics', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const { startTime, endTime } = req.query;

    const start = startTime ? new Date(startTime as string) : undefined;
    const end = endTime ? new Date(endTime as string) : undefined;

    const analytics = await distributionEngine.getUnifiedAnalytics(channelId, start, end);
    
    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    logger.error('Failed to get unified analytics:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get analytics'
    });
  }
});

/**
 * Get analytics for a specific platform
 * GET /api/distribution/:channelId/platforms/:platformId/analytics
 */
router.get('/:channelId/platforms/:platformId/analytics', async (req: Request, res: Response) => {
  try {
    const { channelId, platformId } = req.params;
    const { startTime, endTime } = req.query;

    const start = startTime ? new Date(startTime as string) : undefined;
    const end = endTime ? new Date(endTime as string) : undefined;

    const analytics = await distributionEngine.getPlatformAnalytics(channelId, platformId, start, end);
    
    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    logger.error('Failed to get platform analytics:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get platform analytics'
    });
  }
});

/**
 * Adapt stream configuration for a platform
 * POST /api/distribution/:channelId/platforms/:platformId/adapt-config
 */
router.post('/:channelId/platforms/:platformId/adapt-config', async (req: Request, res: Response) => {
  try {
    const { channelId, platformId } = req.params;
    const baseConfig: StreamConfig = req.body;

    if (!baseConfig) {
      return res.status(400).json({
        error: 'Stream configuration is required'
      });
    }

    const adaptedConfig = await distributionEngine.adaptStreamForPlatform(channelId, platformId, baseConfig);
    
    return res.json({
      success: true,
      data: adaptedConfig
    });

  } catch (error) {
    logger.error('Failed to adapt stream config:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to adapt stream configuration'
    });
  }
});

export default router;