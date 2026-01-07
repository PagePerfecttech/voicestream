import { Router, Request, Response } from 'express';
import { MonetizationEngine } from '../services/MonetizationEngine';
import { body, param, query, validationResult } from 'express-validator';

const router = Router();
const monetizationEngine = MonetizationEngine.getInstance();

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * GET /api/monetization/:channelId/config
 * Get monetization configuration for a channel
 */
router.get('/:channelId/config',
  param('channelId').isUUID(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { channelId } = req.params;
      const config = await monetizationEngine.getMonetizationConfig(channelId);
      res.json(config);
    } catch (error) {
      console.error('Error getting monetization config:', error);
      res.status(500).json({ error: 'Failed to get monetization configuration' });
    }
  }
);

/**
 * PUT /api/monetization/:channelId/config
 * Update monetization configuration for a channel
 */
router.put('/:channelId/config',
  param('channelId').isUUID(),
  body('adInsertionEnabled').optional().isBoolean(),
  body('adBreakFrequency').optional().isInt({ min: 1, max: 60 }),
  body('maxAdDuration').optional().isInt({ min: 15, max: 300 }),
  body('allowedAdTypes').optional().isArray(),
  body('subscriptionRequired').optional().isBoolean(),
  body('allowedSubscriptionTiers').optional().isArray(),
  body('freeTrialDuration').optional().isInt({ min: 0 }),
  body('ppvEnabled').optional().isBoolean(),
  body('defaultEventPrice').optional().isFloat({ min: 0 }),
  body('currency').optional().isLength({ min: 3, max: 3 }),
  body('revenueSharePercentage').optional().isFloat({ min: 0, max: 100 }),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { channelId } = req.params;
      const updates = req.body;
      const config = await monetizationEngine.updateMonetizationConfig(channelId, updates);
      res.json(config);
    } catch (error) {
      console.error('Error updating monetization config:', error);
      res.status(500).json({ error: 'Failed to update monetization configuration' });
    }
  }
);

/**
 * POST /api/monetization/:channelId/ad-breaks
 * Schedule an ad break
 */
router.post('/:channelId/ad-breaks',
  param('channelId').isUUID(),
  body('type').isIn(['pre-roll', 'mid-roll', 'post-roll']),
  body('scheduledTime').isISO8601(),
  body('duration').isInt({ min: 15, max: 300 }),
  body('targetingCriteria').optional().isObject(),
  body('adContent').optional().isArray(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { channelId } = req.params;
      const adBreakData = {
        ...req.body,
        channelId,
        status: 'scheduled' as const,
        scheduledTime: new Date(req.body.scheduledTime),
        adContent: req.body.adContent || []
      };
      
      const adBreak = await monetizationEngine.scheduleAdBreak(channelId, adBreakData);
      res.status(201).json(adBreak);
    } catch (error) {
      console.error('Error scheduling ad break:', error);
      res.status(500).json({ error: 'Failed to schedule ad break' });
    }
  }
);

/**
 * POST /api/monetization/ad-networks
 * Integrate with an ad network
 */
router.post('/ad-networks',
  body('name').notEmpty(),
  body('type').isIn(['google_ad_manager', 'spotx', 'freewheel', 'custom']),
  body('apiEndpoint').isURL(),
  body('credentials').isObject(),
  body('supportedAdTypes').isArray(),
  body('minimumBid').optional().isFloat({ min: 0 }),
  body('currency').optional().isLength({ min: 3, max: 3 }),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { credentials, ...networkData } = req.body;
      const network = await monetizationEngine.integrateAdNetwork({
        ...networkData,
        isActive: true,
        fillRate: 0,
        averageCPM: 0
      }, credentials);
      
      res.status(201).json(network);
    } catch (error) {
      console.error('Error integrating ad network:', error);
      res.status(500).json({ error: 'Failed to integrate ad network' });
    }
  }
);

/**
 * POST /api/monetization/:channelId/ppv-events
 * Create a pay-per-view event
 */
router.post('/:channelId/ppv-events',
  param('channelId').isUUID(),
  body('eventName').notEmpty(),
  body('description').optional(),
  body('startTime').isISO8601(),
  body('endTime').isISO8601(),
  body('timezone').notEmpty(),
  body('price').isFloat({ min: 0 }),
  body('currency').isLength({ min: 3, max: 3 }),
  body('purchaseDeadline').isISO8601(),
  body('accessDuration').isInt({ min: 1 }),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { channelId } = req.params;
      const eventData = {
        ...req.body,
        channelId,
        startTime: new Date(req.body.startTime),
        endTime: new Date(req.body.endTime),
        purchaseDeadline: new Date(req.body.purchaseDeadline),
        status: 'upcoming' as const
      };
      
      const ppvEvent = await monetizationEngine.createPPVEvent(eventData);
      res.status(201).json(ppvEvent);
    } catch (error) {
      console.error('Error creating PPV event:', error);
      res.status(500).json({ error: 'Failed to create PPV event' });
    }
  }
);

/**
 * POST /api/monetization/ppv-events/:eventId/purchase
 * Purchase a pay-per-view event
 */
router.post('/ppv-events/:eventId/purchase',
  param('eventId').isUUID(),
  body('viewerId').notEmpty(),
  body('paymentMethodId').notEmpty(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const { viewerId, paymentMethodId } = req.body;
      
      const purchase = await monetizationEngine.purchasePPVEvent(viewerId, eventId, paymentMethodId);
      res.status(201).json(purchase);
    } catch (error) {
      console.error('Error purchasing PPV event:', error);
      res.status(400).json({ error: error.message || 'Failed to purchase PPV event' });
    }
  }
);

/**
 * GET /api/monetization/:channelId/access-control/:viewerId
 * Check viewer access for a channel
 */
router.get('/:channelId/access-control/:viewerId',
  param('channelId').isUUID(),
  param('viewerId').notEmpty(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { channelId, viewerId } = req.params;
      const accessResult = await monetizationEngine.enforceSubscriptionAccess(channelId, viewerId);
      res.json(accessResult);
    } catch (error) {
      console.error('Error checking access control:', error);
      res.status(500).json({ error: 'Failed to check access control' });
    }
  }
);

/**
 * GET /api/monetization/:channelId/revenue-report
 * Generate revenue report for a channel
 */
router.get('/:channelId/revenue-report',
  param('channelId').isUUID(),
  query('startDate').isISO8601(),
  query('endDate').isISO8601(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { channelId } = req.params;
      const { startDate, endDate } = req.query;
      
      const report = await monetizationEngine.generateRevenueReport(
        channelId,
        new Date(startDate as string),
        new Date(endDate as string)
      );
      
      res.json(report);
    } catch (error) {
      console.error('Error generating revenue report:', error);
      res.status(500).json({ error: 'Failed to generate revenue report' });
    }
  }
);

/**
 * POST /api/monetization/:channelId/revenue
 * Track revenue manually (for testing or external integrations)
 */
router.post('/:channelId/revenue',
  param('channelId').isUUID(),
  body('source').isIn(['advertising', 'subscription', 'ppv', 'donation', 'merchandise']),
  body('amount').isFloat({ min: 0 }),
  body('currency').optional().isLength({ min: 3, max: 3 }),
  body('sourceId').optional(),
  body('viewerId').optional(),
  body('contentId').optional(),
  body('metadata').optional().isObject(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { channelId } = req.params;
      const { source, amount, ...metadata } = req.body;
      
      const revenueRecord = await monetizationEngine.trackRevenue(channelId, source, amount, metadata);
      res.status(201).json(revenueRecord);
    } catch (error) {
      console.error('Error tracking revenue:', error);
      res.status(500).json({ error: 'Failed to track revenue' });
    }
  }
);

export default router;