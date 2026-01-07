import { Router } from 'express';
import { ChannelManager } from '../services/ChannelManager';
import { BulkOperationRequest } from '../types/channel';
import { logger } from '../utils/logger';

const router = Router();
const channelManager = new ChannelManager();

/**
 * Bulk start channels
 */
router.post('/bulk/start', async (req, res) => {
  try {
    const clientId = req.headers['x-client-id'] as string;
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    const request: BulkOperationRequest = req.body;
    
    // Validate request
    if (!request.channelIds || !Array.isArray(request.channelIds) || request.channelIds.length === 0) {
      return res.status(400).json({ error: 'Channel IDs array is required' });
    }

    if (request.channelIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 channels per bulk operation' });
    }

    const result = await channelManager.bulkStartChannels(clientId, request);
    
    return res.status(202).json({
      message: 'Bulk start operation initiated',
      operationId: result.operationId,
      result
    });

  } catch (error: any) {
    logger.error('Bulk start channels failed', { error: error.message });
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Bulk stop channels
 */
router.post('/bulk/stop', async (req, res) => {
  try {
    const clientId = req.headers['x-client-id'] as string;
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    const request: BulkOperationRequest = req.body;
    
    // Validate request
    if (!request.channelIds || !Array.isArray(request.channelIds) || request.channelIds.length === 0) {
      return res.status(400).json({ error: 'Channel IDs array is required' });
    }

    if (request.channelIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 channels per bulk operation' });
    }

    const result = await channelManager.bulkStopChannels(clientId, request);
    
    return res.status(202).json({
      message: 'Bulk stop operation initiated',
      operationId: result.operationId,
      result
    });

  } catch (error: any) {
    logger.error('Bulk stop channels failed', { error: error.message });
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Bulk restart channels
 */
router.post('/bulk/restart', async (req, res) => {
  try {
    const clientId = req.headers['x-client-id'] as string;
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    const request: BulkOperationRequest = req.body;
    
    // Validate request
    if (!request.channelIds || !Array.isArray(request.channelIds) || request.channelIds.length === 0) {
      return res.status(400).json({ error: 'Channel IDs array is required' });
    }

    if (request.channelIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 channels per bulk operation' });
    }

    const result = await channelManager.bulkRestartChannels(clientId, request);
    
    return res.status(202).json({
      message: 'Bulk restart operation initiated',
      operationId: result.operationId,
      result
    });

  } catch (error: any) {
    logger.error('Bulk restart channels failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Bulk delete channels
 */
router.post('/bulk/delete', async (req, res) => {
  try {
    const clientId = req.headers['x-client-id'] as string;
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    const request: BulkOperationRequest = req.body;
    
    // Validate request
    if (!request.channelIds || !Array.isArray(request.channelIds) || request.channelIds.length === 0) {
      return res.status(400).json({ error: 'Channel IDs array is required' });
    }

    if (request.channelIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 channels per bulk operation' });
    }

    const result = await channelManager.bulkDeleteChannels(clientId, request);
    
    res.status(202).json({
      message: 'Bulk delete operation initiated',
      operationId: result.operationId,
      result
    });

  } catch (error: any) {
    logger.error('Bulk delete channels failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get bulk operation status
 */
router.get('/bulk/status/:operationId', async (req, res) => {
  try {
    const { operationId } = req.params;
    
    const result = await channelManager.getBulkOperationStatus(operationId);
    
    return res.json(result);

  } catch (error: any) {
    logger.error('Get bulk operation status failed', { error: error.message });
    res.status(404).json({ error: error.message });
  }
});

/**
 * Get resource constraints
 */
router.get('/resources/constraints', async (_req, res) => {
  try {
    const constraints = await channelManager.getResourceConstraints();
    
    return res.json(constraints);

  } catch (error: any) {
    logger.error('Get resource constraints failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check resource availability
 */
router.get('/resources/availability', async (req, res) => {
  try {
    const clientId = req.headers['x-client-id'] as string;
    const operationType = req.query.operation as string;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    if (!operationType) {
      return res.status(400).json({ error: 'Operation type is required' });
    }

    const available = await channelManager.checkResourceAvailability(clientId, operationType);
    
    return res.json({ available });

  } catch (error: any) {
    logger.error('Check resource availability failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;