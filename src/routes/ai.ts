import { Router, Request, Response } from 'express';
import { AIEngine } from '../services/AIEngine';
import { body, param, query, validationResult } from 'express-validator';

const router = Router();
const aiEngine = AIEngine.getInstance();

/**
 * @route POST /api/ai/optimize-schedule
 * @desc Optimize content scheduling for a channel
 */
router.post('/optimize-schedule',
  [
    body('channelId').isUUID().withMessage('Valid channel ID is required'),
    body('content').isArray().withMessage('Content array is required'),
    body('timeRange.start').isISO8601().withMessage('Valid start date is required'),
    body('timeRange.end').isISO8601().withMessage('Valid end date is required'),
    body('strategy').optional().isIn(['viewership', 'engagement', 'revenue', 'balanced']).withMessage('Invalid strategy')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { channelId, content, timeRange, strategy, constraints } = req.body;
      
      const request = {
        channelId,
        content,
        timeRange: {
          start: new Date(timeRange.start),
          end: new Date(timeRange.end)
        },
        strategy: strategy || 'balanced',
        constraints
      };

      const optimizedSchedule = await aiEngine.optimizeSchedule(channelId, content, request);
      
      res.json({
        success: true,
        data: optimizedSchedule
      });
    } catch (error) {
      console.error('Schedule optimization error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to optimize schedule'
      });
    }
  }
);

/**
 * @route GET /api/ai/churn-prediction/:channelId
 * @desc Get churn prediction for a channel
 */
router.get('/churn-prediction/:channelId',
  [
    param('channelId').isUUID().withMessage('Valid channel ID is required')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { channelId } = req.params;
      
      const churnPrediction = await aiEngine.predictViewerChurn(channelId);
      
      res.json({
        success: true,
        data: churnPrediction
      });
    } catch (error) {
      console.error('Churn prediction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to predict viewer churn'
      });
    }
  }
);

/**
 * @route POST /api/ai/categorize-content
 * @desc Categorize and analyze content
 */
router.post('/categorize-content',
  [
    body('mediaItem').isObject().withMessage('Media item object is required'),
    body('mediaItem.id').isUUID().withMessage('Valid media item ID is required'),
    body('mediaItem.title').notEmpty().withMessage('Media item title is required'),
    body('mediaItem.duration').isInt({ min: 1 }).withMessage('Valid duration is required'),
    body('mediaItem.filePath').notEmpty().withMessage('File path is required')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { mediaItem } = req.body;
      
      const categories = await aiEngine.categorizeContent(mediaItem);
      
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Content categorization error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to categorize content'
      });
    }
  }
);

/**
 * @route GET /api/ai/recommendations/:channelId
 * @desc Get AI recommendations for a channel
 */
router.get('/recommendations/:channelId',
  [
    param('channelId').isUUID().withMessage('Valid channel ID is required'),
    query('type').optional().isIn(['content', 'scheduling', 'monetization', 'engagement', 'technical']).withMessage('Invalid recommendation type'),
    query('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority level')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { channelId } = req.params;
      const { type, priority } = req.query;
      
      let recommendations = await aiEngine.generateRecommendations(channelId);
      
      // Filter by type if specified
      if (type) {
        recommendations = recommendations.filter(rec => rec.type === type);
      }
      
      // Filter by priority if specified
      if (priority) {
        recommendations = recommendations.filter(rec => rec.priority === priority);
      }
      
      res.json({
        success: true,
        data: recommendations
      });
    } catch (error) {
      console.error('Recommendations error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate recommendations'
      });
    }
  }
);

/**
 * @route POST /api/ai/optimize-ad-placement
 * @desc Optimize ad placement for content
 */
router.post('/optimize-ad-placement',
  [
    body('channelId').isUUID().withMessage('Valid channel ID is required'),
    body('contentId').isUUID().withMessage('Valid content ID is required')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { channelId, contentId } = req.body;
      
      const optimization = await aiEngine.optimizeAdPlacement(channelId, contentId);
      
      res.json({
        success: true,
        data: optimization
      });
    } catch (error) {
      console.error('Ad placement optimization error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to optimize ad placement'
      });
    }
  }
);

/**
 * @route GET /api/ai/viewer-behavior/:channelId
 * @desc Analyze viewer behavior patterns
 */
router.get('/viewer-behavior/:channelId',
  [
    param('channelId').isUUID().withMessage('Valid channel ID is required')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { channelId } = req.params;
      
      const analysis = await aiEngine.analyzeViewerBehavior(channelId);
      
      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      console.error('Viewer behavior analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze viewer behavior'
      });
    }
  }
);

/**
 * @route PUT /api/ai/recommendations/:recommendationId/status
 * @desc Update recommendation status
 */
router.put('/recommendations/:recommendationId/status',
  [
    param('recommendationId').isUUID().withMessage('Valid recommendation ID is required'),
    body('status').isIn(['pending', 'accepted', 'rejected', 'implemented']).withMessage('Valid status is required')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { recommendationId } = req.params;
      const { status } = req.body;
      
      // Update recommendation status in database
      const { db } = require('../config/database');
      await db('ai_recommendations')
        .where('id', recommendationId)
        .update({
          status,
          updated_at: new Date()
        });
      
      res.json({
        success: true,
        message: 'Recommendation status updated successfully'
      });
    } catch (error) {
      console.error('Recommendation status update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update recommendation status'
      });
    }
  }
);

/**
 * @route GET /api/ai/analytics/:channelId
 * @desc Get AI analytics and insights for a channel
 */
router.get('/analytics/:channelId',
  [
    param('channelId').isUUID().withMessage('Valid channel ID is required'),
    query('startDate').optional().isISO8601().withMessage('Valid start date required'),
    query('endDate').optional().isISO8601().withMessage('Valid end date required')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { channelId } = req.params;
      const { startDate, endDate } = req.query;
      
      const { db } = require('../config/database');
      
      // Get recent AI analyses
      const analyses = await db('ai_analysis_results')
        .where('channel_id', channelId)
        .where('generated_at', '>=', startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .where('generated_at', '<=', endDate || new Date())
        .orderBy('generated_at', 'desc');
      
      // Get recent recommendations
      const recommendations = await db('ai_recommendations')
        .where('channel_id', channelId)
        .where('created_at', '>=', startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .where('created_at', '<=', endDate || new Date())
        .orderBy('created_at', 'desc')
        .limit(10);
      
      // Get latest churn prediction
      const churnPrediction = await db('ai_churn_predictions')
        .where('channel_id', channelId)
        .orderBy('generated_at', 'desc')
        .first();
      
      // Get recent schedule optimizations
      const scheduleOptimizations = await db('ai_optimized_schedules')
        .where('channel_id', channelId)
        .where('generated_at', '>=', startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .where('generated_at', '<=', endDate || new Date())
        .orderBy('generated_at', 'desc')
        .limit(5);
      
      res.json({
        success: true,
        data: {
          analyses: analyses.map(a => ({
            ...a,
            results: JSON.parse(a.results),
            recommendations: a.recommendations ? JSON.parse(a.recommendations) : []
          })),
          recommendations: recommendations.map(r => ({
            ...r,
            recommendation_data: JSON.parse(r.recommendation_data)
          })),
          churnPrediction: churnPrediction ? {
            ...churnPrediction,
            prediction_data: JSON.parse(churnPrediction.prediction_data)
          } : null,
          scheduleOptimizations: scheduleOptimizations.map(s => ({
            ...s,
            schedule_data: JSON.parse(s.schedule_data)
          }))
        }
      });
    } catch (error) {
      console.error('AI analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve AI analytics'
      });
    }
  }
);

/**
 * @route POST /api/ai/bulk-analyze
 * @desc Perform bulk AI analysis for multiple channels
 */
router.post('/bulk-analyze',
  [
    body('channelIds').isArray().withMessage('Channel IDs array is required'),
    body('analysisTypes').isArray().withMessage('Analysis types array is required'),
    body('analysisTypes.*').isIn(['schedule', 'churn', 'content', 'behavior']).withMessage('Invalid analysis type')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { channelIds, analysisTypes } = req.body;
      
      const results = [];
      
      for (const channelId of channelIds) {
        const channelResults: any = { channelId };
        
        try {
          if (analysisTypes.includes('churn')) {
            channelResults.churnPrediction = await aiEngine.predictViewerChurn(channelId);
          }
          
          if (analysisTypes.includes('behavior')) {
            channelResults.viewerBehavior = await aiEngine.analyzeViewerBehavior(channelId);
          }
          
          if (analysisTypes.includes('content')) {
            channelResults.recommendations = await aiEngine.generateRecommendations(channelId);
          }
          
          channelResults.success = true;
        } catch (error) {
          channelResults.success = false;
          channelResults.error = error instanceof Error ? error.message : 'Analysis failed';
        }
        
        results.push(channelResults);
      }
      
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('Bulk analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform bulk analysis'
      });
    }
  }
);

export default router;