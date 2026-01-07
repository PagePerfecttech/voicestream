import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { knex } from '../config/database';
import { redis } from '../config/redis';

export interface PerformanceMetrics {
  timestamp: Date;
  requestMetrics: {
    totalRequests: number;
    averageResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  };
  systemMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    activeConnections: number;
    databaseConnections: number;
  };
  streamingMetrics: {
    activeChannels: number;
    totalViewers: number;
    averageBitrate: number;
    streamErrors: number;
  };
  thresholds: {
    responseTimeWarning: number;
    responseTimeCritical: number;
    errorRateWarning: number;
    errorRateCritical: number;
    cpuWarning: number;
    cpuCritical: number;
    memoryWarning: number;
    memoryCritical: number;
  };
}

export interface RequestMetric {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
}

export class PerformanceMonitor extends EventEmitter {
  private static instance: PerformanceMonitor;
  private requestMetrics: RequestMetric[] = [];
  private metricsRetentionMs = 5 * 60 * 1000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;
  private alertCooldowns = new Map<string, number>();
  private readonly cooldownMs = 60000; // 1 minute cooldown for alerts

  private readonly thresholds = {
    responseTimeWarning: 1000, // 1 second
    responseTimeCritical: 5000, // 5 seconds
    errorRateWarning: 0.05, // 5%
    errorRateCritical: 0.15, // 15%
    cpuWarning: 70, // 70%
    cpuCritical: 90, // 90%
    memoryWarning: 80, // 80%
    memoryCritical: 95, // 95%
  };

  private constructor() {
    super();
    this.startCleanupInterval();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  public recordRequest(metric: RequestMetric): void {
    this.requestMetrics.push(metric);
    
    // Check for performance issues
    this.checkPerformanceThresholds(metric);
  }

  public async getMetrics(): Promise<PerformanceMetrics> {
    const now = new Date();
    const recentMetrics = this.getRecentMetrics();

    // Calculate request metrics
    const requestMetrics = this.calculateRequestMetrics(recentMetrics);
    
    // Get system metrics
    const systemMetrics = await this.getSystemMetrics();
    
    // Get streaming metrics
    const streamingMetrics = await this.getStreamingMetrics();

    return {
      timestamp: now,
      requestMetrics,
      systemMetrics,
      streamingMetrics,
      thresholds: this.thresholds
    };
  }

  private getRecentMetrics(): RequestMetric[] {
    const cutoff = Date.now() - this.metricsRetentionMs;
    return this.requestMetrics.filter(metric => metric.timestamp.getTime() > cutoff);
  }

  private calculateRequestMetrics(metrics: RequestMetric[]): PerformanceMetrics['requestMetrics'] {
    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        requestsPerSecond: 0,
        errorRate: 0
      };
    }

    const totalRequests = metrics.length;
    const totalResponseTime = metrics.reduce((sum, metric) => sum + metric.responseTime, 0);
    const averageResponseTime = totalResponseTime / totalRequests;
    
    const errorRequests = metrics.filter(metric => metric.statusCode >= 400).length;
    const errorRate = errorRequests / totalRequests;
    
    const timeSpanMs = this.metricsRetentionMs;
    const requestsPerSecond = (totalRequests / timeSpanMs) * 1000;

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
      errorRate: Math.round(errorRate * 10000) / 10000
    };
  }

  private async getSystemMetrics(): Promise<PerformanceMetrics['systemMetrics']> {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Get database connection count
      let databaseConnections = 0;
      try {
        const dbStats = await knex.raw('SELECT count(*) as connections FROM pg_stat_activity WHERE state = ?', ['active']);
        databaseConnections = parseInt(String(dbStats.rows[0]?.connections || '0'));
      } catch (error) {
        logger.debug('Could not get database connection count:', error);
      }

      // Get Redis connection info
      let activeConnections = 0;
      try {
        const redisInfo = await redis.info('clients');
        const match = redisInfo.match(/connected_clients:(\d+)/);
        activeConnections = match ? parseInt(match[1]) : 0;
      } catch (error) {
        logger.debug('Could not get Redis connection count:', error);
      }

      return {
        cpuUsage: Math.round((cpuUsage.user + cpuUsage.system) / 1000000 * 100) / 100, // Convert to percentage
        memoryUsage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 10000) / 100, // Percentage
        activeConnections,
        databaseConnections
      };

    } catch (error) {
      logger.error('Failed to get system metrics:', error);
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        activeConnections: 0,
        databaseConnections: 0
      };
    }
  }

  private async getStreamingMetrics(): Promise<PerformanceMetrics['streamingMetrics']> {
    try {
      // Get active channels count
      const channelsResult = await knex('channels')
        .where('status', 'LIVE')
        .count('* as count');
      const activeChannels = parseInt(String(channelsResult[0]?.count || '0'));

      // Get total viewers (from analytics if available)
      let totalViewers = 0;
      try {
        const viewersResult = await knex('viewer_sessions')
          .whereNull('end_time')
          .count('* as count');
        totalViewers = parseInt(String(viewersResult[0]?.count || '0'));
      } catch (error) {
        logger.debug('Could not get viewer count:', error);
      }

      // Get average bitrate from active streams
      let averageBitrate = 0;
      try {
        const bitrateResult = await knex('stream_processes')
          .where('status', 'LIVE')
          .avg('current_bitrate as avg_bitrate');
        averageBitrate = Math.round(parseFloat(bitrateResult[0]?.avg_bitrate || '0'));
      } catch (error) {
        logger.debug('Could not get average bitrate:', error);
      }

      // Get stream errors in the last hour
      let streamErrors = 0;
      try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const errorsResult = await knex('stream_processes')
          .where('updated_at', '>', oneHourAgo)
          .where('status', 'ERROR')
          .count('* as count');
        streamErrors = parseInt(String(errorsResult[0]?.count || '0'));
      } catch (error) {
        logger.debug('Could not get stream error count:', error);
      }

      return {
        activeChannels,
        totalViewers,
        averageBitrate,
        streamErrors
      };

    } catch (error) {
      logger.error('Failed to get streaming metrics:', error);
      return {
        activeChannels: 0,
        totalViewers: 0,
        averageBitrate: 0,
        streamErrors: 0
      };
    }
  }

  private checkPerformanceThresholds(metric: RequestMetric): void {
    // Check response time
    if (metric.responseTime > this.thresholds.responseTimeCritical) {
      this.emitAlert('response_time_critical', {
        responseTime: metric.responseTime,
        path: metric.path,
        threshold: this.thresholds.responseTimeCritical
      });
    } else if (metric.responseTime > this.thresholds.responseTimeWarning) {
      this.emitAlert('response_time_warning', {
        responseTime: metric.responseTime,
        path: metric.path,
        threshold: this.thresholds.responseTimeWarning
      });
    }

    // Check error rate periodically
    const recentMetrics = this.getRecentMetrics();
    if (recentMetrics.length >= 10) { // Only check if we have enough data
      const errorRate = recentMetrics.filter(m => m.statusCode >= 400).length / recentMetrics.length;
      
      if (errorRate > this.thresholds.errorRateCritical) {
        this.emitAlert('error_rate_critical', {
          errorRate: errorRate * 100,
          threshold: this.thresholds.errorRateCritical * 100
        });
      } else if (errorRate > this.thresholds.errorRateWarning) {
        this.emitAlert('error_rate_warning', {
          errorRate: errorRate * 100,
          threshold: this.thresholds.errorRateWarning * 100
        });
      }
    }
  }

  private emitAlert(alertType: string, data: any): void {
    const now = Date.now();
    const lastAlert = this.alertCooldowns.get(alertType) || 0;
    
    // Check cooldown
    if (now - lastAlert < this.cooldownMs) {
      return;
    }

    this.alertCooldowns.set(alertType, now);
    this.emit('performanceAlert', { type: alertType, data, timestamp: new Date() });
    
    logger.warn(`Performance alert: ${alertType}`, data);
  }

  private startCleanupInterval(): void {
    // Clean up old metrics every minute
    this.cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - this.metricsRetentionMs;
      this.requestMetrics = this.requestMetrics.filter(
        metric => metric.timestamp.getTime() > cutoff
      );
    }, 60000);
  }

  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.requestMetrics = [];
    this.alertCooldowns.clear();
  }

  // Middleware for Express to automatically record request metrics
  public getExpressMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        
        this.recordRequest({
          method: req.method,
          path: req.route?.path || req.path,
          statusCode: res.statusCode,
          responseTime,
          timestamp: new Date(),
          userAgent: req.get('User-Agent'),
          ip: req.ip || req.connection.remoteAddress
        });
      });
      
      next();
    };
  }
}