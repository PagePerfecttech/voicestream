import { Router, Request, Response } from 'express';
import { AnalyticsEngine } from '../services/AnalyticsEngine';
import { AnalyticsQuery, ViewerTrackingEvent } from '../types/analytics';

const router = Router();
const analyticsEngine = AnalyticsEngine.getInstance();

/**
 * Track a viewer event
 * POST /api/analytics/events
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const event: ViewerTrackingEvent = req.body;
    
    // Validate required fields
    if (!event.channelId || !event.viewerId || !event.eventType) {
      return res.status(400).json({
        error: 'Missing required fields: channelId, viewerId, eventType'
      });
    }
    
    await analyticsEngine.trackViewerEvent(event);
    
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error tracking viewer event:', error);
    res.status(500).json({ 
      error: 'Failed to track viewer event',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get real-time metrics for a channel
 * GET /api/analytics/channels/:channelId/realtime
 */
router.get('/channels/:channelId/realtime', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    
    const metrics = await analyticsEngine.getRealtimeMetrics(channelId);
    
    res.json(metrics);
  } catch (error) {
    console.error('Error getting realtime metrics:', error);
    res.status(500).json({ 
      error: 'Failed to get realtime metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate analytics report
 * POST /api/analytics/channels/:channelId/reports
 */
router.post('/channels/:channelId/reports', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const { reportType, reportDate } = req.body;
    
    // Validate report type
    if (!['daily', 'weekly', 'monthly'].includes(reportType)) {
      return res.status(400).json({
        error: 'Invalid report type. Must be daily, weekly, or monthly'
      });
    }
    
    // Parse report date
    const date = reportDate ? new Date(reportDate) : new Date();
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        error: 'Invalid report date format'
      });
    }
    
    const report = await analyticsEngine.generateReport(channelId, reportType, date);
    
    res.json(report);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ 
      error: 'Failed to generate report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get analytics report
 * GET /api/analytics/channels/:channelId/reports/:reportType/:reportDate
 */
router.get('/channels/:channelId/reports/:reportType/:reportDate', async (req: Request, res: Response) => {
  try {
    const { channelId, reportType, reportDate } = req.params;
    
    // Validate report type
    if (!['daily', 'weekly', 'monthly'].includes(reportType)) {
      return res.status(400).json({
        error: 'Invalid report type. Must be daily, weekly, or monthly'
      });
    }
    
    // Parse report date
    const date = new Date(reportDate);
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        error: 'Invalid report date format'
      });
    }
    
    const report = await analyticsEngine.generateReport(channelId, reportType as any, date);
    
    res.json(report);
  } catch (error) {
    console.error('Error getting report:', error);
    res.status(500).json({ 
      error: 'Failed to get report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Query analytics data with flexible parameters
 * POST /api/analytics/query
 */
router.post('/query', async (req: Request, res: Response) => {
  try {
    const query: AnalyticsQuery = req.body;
    
    // Validate required fields
    if (!query.channelId) {
      return res.status(400).json({
        error: 'Missing required field: channelId'
      });
    }
    
    // Parse dates if provided
    if (query.startDate) {
      query.startDate = new Date(query.startDate);
      if (isNaN(query.startDate.getTime())) {
        return res.status(400).json({
          error: 'Invalid startDate format'
        });
      }
    }
    
    if (query.endDate) {
      query.endDate = new Date(query.endDate);
      if (isNaN(query.endDate.getTime())) {
        return res.status(400).json({
          error: 'Invalid endDate format'
        });
      }
    }
    
    const results = await analyticsEngine.queryAnalytics(query);
    
    res.json(results);
  } catch (error) {
    console.error('Error querying analytics:', error);
    res.status(500).json({ 
      error: 'Failed to query analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update channel metrics (manual trigger)
 * POST /api/analytics/channels/:channelId/metrics/:periodType
 */
router.post('/channels/:channelId/metrics/:periodType', async (req: Request, res: Response) => {
  try {
    const { channelId, periodType } = req.params;
    
    // Validate period type
    if (!['minute', 'hour', 'day'].includes(periodType)) {
      return res.status(400).json({
        error: 'Invalid period type. Must be minute, hour, or day'
      });
    }
    
    await analyticsEngine.updateChannelMetrics(channelId, periodType as any);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating channel metrics:', error);
    res.status(500).json({ 
      error: 'Failed to update channel metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Clean up old analytics data
 * DELETE /api/analytics/cleanup
 */
router.delete('/cleanup', async (req: Request, res: Response) => {
  try {
    const { retentionDays } = req.query;
    const days = retentionDays ? parseInt(retentionDays as string) : 90;
    
    if (isNaN(days) || days < 1) {
      return res.status(400).json({
        error: 'Invalid retentionDays. Must be a positive number'
      });
    }
    
    await analyticsEngine.cleanupOldData(days);
    
    res.json({ 
      success: true, 
      message: `Cleaned up analytics data older than ${days} days` 
    });
  } catch (error) {
    console.error('Error cleaning up analytics data:', error);
    res.status(500).json({ 
      error: 'Failed to clean up analytics data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;