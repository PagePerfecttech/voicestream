import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import {
  ViewerEvent,
  RealtimeMetrics,
  AnalyticsReport,
  GeographicData,
  DeviceData,
  ViewerTrackingEvent,
  AnalyticsQuery
} from '../types/analytics';

export class AnalyticsEngine {
  private static instance: AnalyticsEngine;
  private activeSessions: Map<string, string> = new Map(); // viewerId -> sessionId
  
  public static getInstance(): AnalyticsEngine {
    if (!AnalyticsEngine.instance) {
      AnalyticsEngine.instance = new AnalyticsEngine();
    }
    return AnalyticsEngine.instance;
  }

  /**
   * Track a viewer event (join, leave, interaction, etc.)
   */
  async trackViewerEvent(event: ViewerTrackingEvent): Promise<void> {
    const trx = await db.transaction();
    
    try {
      let sessionId = event.sessionId;
      
      // Handle join events - create or find session
      if (event.eventType === 'join') {
        sessionId = await this.handleViewerJoin(event, trx);
      } else if (event.eventType === 'leave') {
        sessionId = await this.handleViewerLeave(event, trx);
      } else {
        // For other events, use existing session or the provided sessionId
        sessionId = sessionId || this.activeSessions.get(event.viewerId);
        if (!sessionId) {
          throw new Error(`No active session found for viewer ${event.viewerId}`);
        }
      }
      
      // Record the event
      const eventToRecord: {
        sessionId: string;
        channelId: string;
        eventType: ViewerEvent['eventType'];
        timestamp: Date;
        eventData?: Record<string, any>;
      } = {
        sessionId: sessionId!,
        channelId: event.channelId,
        eventType: event.eventType,
        timestamp: event.timestamp || new Date()
      };
      
      if (event.eventData) {
        eventToRecord.eventData = event.eventData;
      }
      
      await this.recordViewerEvent(eventToRecord, trx);
      
      // Update session engagement metrics
      if (event.eventType !== 'join' && event.eventType !== 'leave') {
        await this.updateSessionEngagement(sessionId!, event.eventType, trx);
      }
      
      await trx.commit();
      
      // Update real-time metrics asynchronously
      this.updateRealtimeMetrics(event.channelId).catch(console.error);
      
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Get real-time metrics for a channel
   */
  async getRealtimeMetrics(channelId: string): Promise<RealtimeMetrics> {
    // Get current active sessions
    const activeSessions = await db('viewer_sessions')
      .where('channel_id', channelId)
      .whereNull('end_time')
      .select('*');
    
    const currentViewers = activeSessions.length;
    
    // Get today's peak viewers
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const peakViewersResult = await db('channel_metrics')
      .where('channel_id', channelId)
      .where('timestamp', '>=', today)
      .max('peak_viewers as peak')
      .first();
    
    const peakViewers = Math.max(currentViewers, peakViewersResult?.peak || 0);
    
    // Calculate average watch time for active sessions
    const avgWatchTime = activeSessions.length > 0 
      ? activeSessions.reduce((sum, session) => {
          const watchTime = Math.floor((Date.now() - new Date(session.start_time).getTime()) / 1000);
          return sum + watchTime;
        }, 0) / activeSessions.length
      : 0;
    
    // Get today's total views and unique viewers
    const todayViews = await db('viewer_sessions')
      .where('channel_id', channelId)
      .where('start_time', '>=', today)
      .select(
        db.raw('COUNT(*) as total_views'),
        db.raw('COUNT(DISTINCT viewer_id) as unique_viewers')
      )
      .first();
    
    // Get geographic distribution
    const geoData = await db('viewer_sessions')
      .where('channel_id', channelId)
      .whereNull('end_time')
      .whereNotNull('country')
      .select('country')
      .count('* as count')
      .groupBy('country')
      .orderBy('count', 'desc')
      .limit(10);
    
    const geographicDistribution: GeographicData[] = geoData.map(row => ({
      country: String(row.country),
      viewerCount: parseInt(row.count as string),
      percentage: (parseInt(row.count as string) / currentViewers) * 100
    }));
    
    // Get device breakdown
    const deviceData = await db('viewer_sessions')
      .where('channel_id', channelId)
      .whereNull('end_time')
      .whereNotNull('device_type')
      .select('device_type')
      .count('* as count')
      .groupBy('device_type')
      .orderBy('count', 'desc');
    
    const deviceBreakdown: DeviceData[] = deviceData.map(row => ({
      deviceType: String(row.device_type),
      viewerCount: parseInt(row.count as string),
      percentage: (parseInt(row.count as string) / currentViewers) * 100
    }));
    
    // Get recent events (last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentEvents = await db('viewer_events')
      .where('channel_id', channelId)
      .where('timestamp', '>=', tenMinutesAgo)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .select('*');
    
    const mappedEvents: ViewerEvent[] = recentEvents.map(this.mapDbRowToViewerEvent);
    
    // Get stream health metrics
    const latestMetrics = await db('channel_metrics')
      .where('channel_id', channelId)
      .where('period_type', 'minute')
      .orderBy('timestamp', 'desc')
      .first();
    
    return {
      channelId,
      currentViewers,
      peakViewers,
      averageWatchTime: Math.round(avgWatchTime),
      totalViews: parseInt((todayViews as any)?.total_views || '0'),
      uniqueViewers: parseInt((todayViews as any)?.unique_viewers || '0'),
      geographicDistribution,
      deviceBreakdown,
      recentEvents: mappedEvents,
      streamHealth: {
        quality: latestMetrics?.stream_quality || 0,
        errorRate: latestMetrics?.error_rate || 0,
        bufferingEvents: latestMetrics?.buffering_events || 0
      }
    };
  }

  /**
   * Generate analytics report for a specific period
   */
  async generateReport(channelId: string, reportType: 'daily' | 'weekly' | 'monthly', reportDate: Date): Promise<AnalyticsReport> {
    const { start, end } = this.getReportPeriod(reportType, reportDate);
    
    // Check if report already exists
    const existingReport = await db('analytics_reports')
      .where('channel_id', channelId)
      .where('report_type', reportType)
      .where('report_date', reportDate.toISOString().split('T')[0])
      .first();
    
    if (existingReport) {
      return this.mapDbRowToAnalyticsReport(existingReport);
    }
    
    // Generate new report
    const reportData = await this.calculateReportMetrics(channelId, start, end);
    
    const reportId = uuidv4();
    const report: Partial<AnalyticsReport> = {
      id: reportId,
      channelId,
      reportType,
      reportDate,
      generatedAt: new Date(),
      ...reportData
    };
    
    // Save report to database
    await db('analytics_reports').insert({
      id: reportId,
      channel_id: channelId,
      report_type: reportType,
      report_date: reportDate.toISOString().split('T')[0],
      report_data: JSON.stringify(reportData),
      generated_at: new Date()
    });
    
    return report as AnalyticsReport;
  }

  /**
   * Query analytics data with flexible parameters
   */
  async queryAnalytics(query: AnalyticsQuery): Promise<any> {
    let baseQuery = db('viewer_sessions as vs')
      .where('vs.channel_id', query.channelId);
    
    if (query.startDate) {
      baseQuery = baseQuery.where('vs.start_time', '>=', query.startDate);
    }
    
    if (query.endDate) {
      baseQuery = baseQuery.where('vs.start_time', '<=', query.endDate);
    }
    
    if (query.filters?.country) {
      baseQuery = baseQuery.where('vs.country', query.filters.country);
    }
    
    if (query.filters?.deviceType) {
      baseQuery = baseQuery.where('vs.device_type', query.filters.deviceType);
    }
    
    // Apply grouping and aggregation based on query parameters
    if (query.groupBy) {
      baseQuery = baseQuery
        .select(db.raw(`DATE_TRUNC('${query.groupBy}', vs.start_time) as period`))
        .count('* as total_sessions')
        .sum('vs.watch_time as total_watch_time')
        .countDistinct('vs.viewer_id as unique_viewers')
        .groupBy(db.raw(`DATE_TRUNC('${query.groupBy}', vs.start_time)`))
        .orderBy('period');
    }
    
    return await baseQuery;
  }

  /**
   * Update aggregated metrics for a channel
   */
  async updateChannelMetrics(channelId: string, periodType: 'minute' | 'hour' | 'day'): Promise<void> {
    const now = new Date();
    const period = this.getPeriodStart(now, periodType);
    
    // Calculate metrics for the period
    const metrics = await this.calculatePeriodMetrics(channelId, period, periodType);
    
    // Upsert metrics
    await db('channel_metrics')
      .insert({
        id: uuidv4(),
        channel_id: channelId,
        timestamp: period,
        period_type: periodType,
        ...metrics
      })
      .onConflict(['channel_id', 'timestamp', 'period_type'])
      .merge(metrics);
  }

  /**
   * Clean up old analytics data based on retention policy
   */
  async cleanupOldData(retentionDays: number = 90): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const trx = await db.transaction();
    
    try {
      // Clean up old viewer events
      await trx('viewer_events')
        .where('timestamp', '<', cutoffDate)
        .del();
      
      // Clean up old viewer sessions
      await trx('viewer_sessions')
        .where('start_time', '<', cutoffDate)
        .del();
      
      // Clean up old minute-level metrics (keep only last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      await trx('channel_metrics')
        .where('period_type', 'minute')
        .where('timestamp', '<', weekAgo)
        .del();
      
      await trx.commit();
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Private helper methods

  private async handleViewerJoin(event: ViewerTrackingEvent, trx: any): Promise<string> {
    // End any existing active session for this viewer
    await trx('viewer_sessions')
      .where('channel_id', event.channelId)
      .where('viewer_id', event.viewerId)
      .whereNull('end_time')
      .update({ end_time: new Date() });
    
    // Create new session
    const sessionId = uuidv4();
    const sessionData = {
      id: sessionId,
      channel_id: event.channelId,
      viewer_id: event.viewerId,
      start_time: event.timestamp || new Date(),
      ip_address: event.ipAddress || 'unknown',
      user_agent: event.userAgent || 'unknown',
      country: event.geolocation?.country,
      region: event.geolocation?.region,
      city: event.geolocation?.city,
      latitude: event.geolocation?.latitude,
      longitude: event.geolocation?.longitude,
      device_type: event.deviceInfo?.deviceType,
      browser: event.deviceInfo?.browser,
      os: event.deviceInfo?.os,
      watch_time: 0,
      interaction_count: 0,
      ad_view_count: 0,
      chat_message_count: 0
    };
    
    await trx('viewer_sessions').insert(sessionData);
    
    // Track active session
    this.activeSessions.set(event.viewerId, sessionId);
    
    return sessionId;
  }

  private async handleViewerLeave(event: ViewerTrackingEvent, trx: any): Promise<string> {
    const sessionId = event.sessionId || this.activeSessions.get(event.viewerId);
    
    if (sessionId) {
      // Calculate watch time and end session
      const session = await trx('viewer_sessions')
        .where('id', sessionId)
        .first();
      
      if (session && !session.end_time) {
        const watchTime = Math.floor((Date.now() - new Date(session.start_time).getTime()) / 1000);
        
        await trx('viewer_sessions')
          .where('id', sessionId)
          .update({
            end_time: event.timestamp || new Date(),
            watch_time: watchTime
          });
      }
      
      // Remove from active sessions
      this.activeSessions.delete(event.viewerId);
    }
    
    return sessionId || uuidv4(); // Return dummy ID if session not found
  }

  private async recordViewerEvent(event: {
    sessionId: string;
    channelId: string;
    eventType: ViewerEvent['eventType'];
    timestamp: Date;
    eventData?: Record<string, any>;
  }, trx: any): Promise<void> {
    await trx('viewer_events').insert({
      id: uuidv4(),
      session_id: event.sessionId,
      channel_id: event.channelId,
      event_type: event.eventType,
      timestamp: event.timestamp,
      event_data: event.eventData ? JSON.stringify(event.eventData) : null
    });
  }

  private async updateSessionEngagement(sessionId: string, eventType: ViewerEvent['eventType'], trx: any): Promise<void> {
    const updates: any = {};
    
    switch (eventType) {
      case 'chat':
        updates.chat_message_count = db.raw('chat_message_count + 1');
        updates.interaction_count = db.raw('interaction_count + 1');
        break;
      case 'interaction':
        updates.interaction_count = db.raw('interaction_count + 1');
        break;
      case 'ad_view':
        updates.ad_view_count = db.raw('ad_view_count + 1');
        break;
    }
    
    if (Object.keys(updates).length > 0) {
      await trx('viewer_sessions')
        .where('id', sessionId)
        .update(updates);
    }
  }

  private async updateRealtimeMetrics(channelId: string): Promise<void> {
    // Update minute-level metrics
    await this.updateChannelMetrics(channelId, 'minute');
  }

  private async calculateReportMetrics(channelId: string, start: Date, end: Date): Promise<Partial<AnalyticsReport>> {
    // Get basic session metrics
    const sessionMetrics = await db('viewer_sessions')
      .where('channel_id', channelId)
      .whereBetween('start_time', [start, end])
      .select(
        db.raw('COUNT(*) as total_views'),
        db.raw('COUNT(DISTINCT viewer_id) as unique_viewers'),
        db.raw('SUM(watch_time) as total_watch_time'),
        db.raw('AVG(watch_time) as average_watch_time'),
        db.raw('SUM(interaction_count) as total_interactions'),
        db.raw('SUM(chat_message_count) as chat_messages')
      )
      .first();
    
    // Get peak concurrent viewers from metrics
    const peakViewers = await db('channel_metrics')
      .where('channel_id', channelId)
      .whereBetween('timestamp', [start, end])
      .max('peak_viewers as peak')
      .first();
    
    // Get geographic distribution
    const topCountries = await db('viewer_sessions')
      .where('channel_id', channelId)
      .whereBetween('start_time', [start, end])
      .whereNotNull('country')
      .select('country')
      .count('* as count')
      .groupBy('country')
      .orderBy('count', 'desc')
      .limit(10);
    
    // Get device breakdown
    const deviceBreakdown = await db('viewer_sessions')
      .where('channel_id', channelId)
      .whereBetween('start_time', [start, end])
      .whereNotNull('device_type')
      .select('device_type')
      .count('* as count')
      .groupBy('device_type')
      .orderBy('count', 'desc');
    
    // Get hourly viewership data
    const hourlyData = await db('viewer_sessions')
      .where('channel_id', channelId)
      .whereBetween('start_time', [start, end])
      .select(
        db.raw('EXTRACT(HOUR FROM start_time) as hour'),
        db.raw('COUNT(*) as viewers'),
        db.raw('SUM(watch_time) as watch_time'),
        db.raw('SUM(interaction_count) as interactions')
      )
      .groupBy(db.raw('EXTRACT(HOUR FROM start_time)'))
      .orderBy('hour');
    
    return {
      totalViews: parseInt((sessionMetrics as any)?.total_views || '0'),
      uniqueViewers: parseInt((sessionMetrics as any)?.unique_viewers || '0'),
      totalWatchTime: parseInt((sessionMetrics as any)?.total_watch_time || '0'),
      averageWatchTime: parseFloat((sessionMetrics as any)?.average_watch_time || '0'),
      peakConcurrentViewers: parseInt(peakViewers?.peak || '0'),
      totalInteractions: parseInt((sessionMetrics as any)?.total_interactions || '0'),
      chatMessages: parseInt((sessionMetrics as any)?.chat_messages || '0'),
      socialShares: 0, // TODO: Implement social sharing tracking
      topCountries: topCountries.map(row => ({
        country: String(row.country),
        viewerCount: parseInt(row.count as string),
        percentage: 0 // Will be calculated when total is known
      })),
      deviceBreakdown: deviceBreakdown.map(row => ({
        deviceType: String(row.device_type),
        viewerCount: parseInt(row.count as string),
        percentage: 0 // Will be calculated when total is known
      })),
      viewershipByHour: hourlyData.map((row: any) => ({
        hour: parseInt(row.hour as string),
        viewers: parseInt(row.viewers as string),
        watchTime: parseInt(row.watch_time as string),
        interactions: parseInt(row.interactions as string)
      })),
      totalRevenue: 0, // TODO: Implement revenue tracking
      adRevenue: 0,
      subscriptionRevenue: 0,
      averageStreamQuality: 0, // TODO: Calculate from metrics
      totalBufferingEvents: 0,
      averageErrorRate: 0
    };
  }

  private async calculatePeriodMetrics(channelId: string, period: Date, periodType: string): Promise<any> {
    const nextPeriod = new Date(period);
    switch (periodType) {
      case 'minute':
        nextPeriod.setMinutes(nextPeriod.getMinutes() + 1);
        break;
      case 'hour':
        nextPeriod.setHours(nextPeriod.getHours() + 1);
        break;
      case 'day':
        nextPeriod.setDate(nextPeriod.getDate() + 1);
        break;
    }
    
    // Get concurrent viewers at the end of the period
    const concurrentViewers = await db('viewer_sessions')
      .where('channel_id', channelId)
      .where('start_time', '<=', nextPeriod)
      .where(function() {
        this.whereNull('end_time').orWhere('end_time', '>', nextPeriod);
      })
      .count('* as count')
      .first();
    
    // Get session metrics for the period
    const sessionMetrics = await db('viewer_sessions')
      .where('channel_id', channelId)
      .whereBetween('start_time', [period, nextPeriod])
      .select(
        db.raw('COUNT(*) as total_views'),
        db.raw('COUNT(DISTINCT viewer_id) as unique_viewers'),
        db.raw('AVG(watch_time) as average_watch_time')
      )
      .first();
    
    return {
      concurrent_viewers: parseInt(concurrentViewers?.count as string || '0'),
      total_views: parseInt((sessionMetrics as any)?.total_views || '0'),
      unique_viewers: parseInt((sessionMetrics as any)?.unique_viewers || '0'),
      average_watch_time: parseFloat((sessionMetrics as any)?.average_watch_time || '0'),
      peak_viewers: parseInt(concurrentViewers?.count as string || '0'), // Simplified for now
      chat_messages: 0, // TODO: Calculate from events
      poll_participation: 0,
      social_shares: 0,
      total_interactions: 0,
      stream_quality: 100, // TODO: Calculate actual quality
      buffering_events: 0,
      error_rate: 0,
      restart_count: 0,
      ad_impressions: 0,
      ad_revenue: 0,
      subscription_revenue: 0,
      total_revenue: 0
    };
  }

  private getReportPeriod(reportType: string, reportDate: Date): { start: Date; end: Date } {
    const start = new Date(reportDate);
    const end = new Date(reportDate);
    
    switch (reportType) {
      case 'daily':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'weekly':
        const dayOfWeek = start.getDay();
        start.setDate(start.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        break;
    }
    
    return { start, end };
  }

  private getPeriodStart(date: Date, periodType: string): Date {
    const period = new Date(date);
    
    switch (periodType) {
      case 'minute':
        period.setSeconds(0, 0);
        break;
      case 'hour':
        period.setMinutes(0, 0, 0);
        break;
      case 'day':
        period.setHours(0, 0, 0, 0);
        break;
    }
    
    return period;
  }

  private mapDbRowToViewerEvent(row: any): ViewerEvent {
    return {
      id: row.id,
      sessionId: row.session_id,
      channelId: row.channel_id,
      eventType: row.event_type,
      timestamp: row.timestamp,
      eventData: row.event_data ? JSON.parse(row.event_data) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapDbRowToAnalyticsReport(row: any): AnalyticsReport {
    const reportData = JSON.parse(row.report_data);
    
    return {
      id: row.id,
      channelId: row.channel_id,
      reportType: row.report_type,
      reportDate: row.report_date,
      generatedAt: row.generated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...reportData
    };
  }
}