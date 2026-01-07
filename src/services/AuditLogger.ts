import { logger } from '../utils/logger';
import { ErrorContext } from '../types/errors';

export enum AuditEventType {
  CHANNEL_CREATED = 'CHANNEL_CREATED',
  CHANNEL_STARTED = 'CHANNEL_STARTED',
  CHANNEL_STOPPED = 'CHANNEL_STOPPED',
  CHANNEL_DELETED = 'CHANNEL_DELETED',
  CHANNEL_UPDATED = 'CHANNEL_UPDATED',
  STREAM_FAILURE = 'STREAM_FAILURE',
  STREAM_RECOVERY = 'STREAM_RECOVERY',
  RTMP_CONNECTION_FAILED = 'RTMP_CONNECTION_FAILED',
  RTMP_CONNECTION_RESTORED = 'RTMP_CONNECTION_RESTORED',
  ERROR_ESCALATED = 'ERROR_ESCALATED',
  CIRCUIT_BREAKER_OPENED = 'CIRCUIT_BREAKER_OPENED',
  CIRCUIT_BREAKER_CLOSED = 'CIRCUIT_BREAKER_CLOSED',
  SERVICE_DEGRADED = 'SERVICE_DEGRADED',
  SERVICE_RESTORED = 'SERVICE_RESTORED',
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  SUBSCRIPTION_CHANGED = 'SUBSCRIPTION_CHANGED',
  CONFIGURATION_CHANGED = 'CONFIGURATION_CHANGED',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION'
}

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  timestamp: Date;
  userId?: string;
  channelId?: string;
  clientId?: string;
  service: string;
  action: string;
  resource?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  success: boolean;
  duration?: number;
  errorMessage?: string;
}

export class AuditLogger {
  private events: AuditEvent[] = [];
  private maxEvents: number = 10000;

  constructor(maxEvents: number = 10000) {
    this.maxEvents = maxEvents;
  }

  public logEvent(event: Partial<AuditEvent>): void {
    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      service: 'unknown',
      action: 'unknown',
      details: {},
      severity: 'INFO',
      success: true,
      ...event
    } as AuditEvent;

    // Add to in-memory store
    this.events.push(auditEvent);

    // Maintain max events limit
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Log to winston logger
    this.logToWinston(auditEvent);
  }

  private logToWinston(event: AuditEvent): void {
    const logLevel = this.getLogLevel(event.severity);
    
    logger.log(logLevel, `AUDIT: ${event.type} - ${event.action}`, {
      auditId: event.id,
      type: event.type,
      userId: event.userId,
      channelId: event.channelId,
      clientId: event.clientId,
      service: event.service,
      action: event.action,
      resource: event.resource,
      success: event.success,
      duration: event.duration,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      sessionId: event.sessionId,
      details: event.details,
      errorMessage: event.errorMessage,
      timestamp: event.timestamp.toISOString()
    });
  }

  private getLogLevel(severity: string): string {
    switch (severity) {
      case 'CRITICAL': return 'error';
      case 'ERROR': return 'error';
      case 'WARN': return 'warn';
      case 'INFO': return 'info';
      default: return 'info';
    }
  }

  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Channel lifecycle events
  public logChannelCreated(channelId: string, clientId: string, userId?: string, details: any = {}): void {
    this.logEvent({
      type: AuditEventType.CHANNEL_CREATED,
      channelId,
      clientId,
      ...(userId && { userId }),
      service: 'ChannelManager',
      action: 'create_channel',
      resource: `channel:${channelId}`,
      details,
      severity: 'INFO',
      success: true
    });
  }

  public logChannelStarted(channelId: string, clientId: string, userId?: string, details: any = {}): void {
    this.logEvent({
      type: AuditEventType.CHANNEL_STARTED,
      channelId,
      clientId,
      ...(userId && { userId }),
      service: 'PlayoutEngine',
      action: 'start_channel',
      resource: `channel:${channelId}`,
      details,
      severity: 'INFO',
      success: true
    });
  }

  public logChannelStopped(channelId: string, clientId: string, userId?: string, details: any = {}): void {
    this.logEvent({
      type: AuditEventType.CHANNEL_STOPPED,
      channelId,
      clientId,
      ...(userId && { userId }),
      service: 'PlayoutEngine',
      action: 'stop_channel',
      resource: `channel:${channelId}`,
      details,
      severity: 'INFO',
      success: true
    });
  }

  public logChannelDeleted(channelId: string, clientId: string, userId?: string, details: any = {}): void {
    this.logEvent({
      type: AuditEventType.CHANNEL_DELETED,
      channelId,
      clientId,
      ...(userId && { userId }),
      service: 'ChannelManager',
      action: 'delete_channel',
      resource: `channel:${channelId}`,
      details,
      severity: 'WARN',
      success: true
    });
  }

  public logChannelUpdated(channelId: string, clientId: string, userId?: string, changes: any = {}): void {
    this.logEvent({
      type: AuditEventType.CHANNEL_UPDATED,
      channelId,
      clientId,
      ...(userId && { userId }),
      service: 'ChannelManager',
      action: 'update_channel',
      resource: `channel:${channelId}`,
      details: { changes },
      severity: 'INFO',
      success: true
    });
  }

  // Error and recovery events
  public logStreamFailure(channelId: string, error: Error, context: ErrorContext): void {
    this.logEvent({
      type: AuditEventType.STREAM_FAILURE,
      channelId,
      ...(context.clientId && { clientId: context.clientId }),
      service: context.service,
      action: 'stream_failure',
      resource: `channel:${channelId}`,
      details: {
        error: error.message,
        operation: context.operation,
        metadata: context.metadata
      },
      severity: 'ERROR',
      success: false,
      errorMessage: error.message
    });
  }

  public logStreamRecovery(channelId: string, recoveryAction: string, details: any = {}): void {
    this.logEvent({
      type: AuditEventType.STREAM_RECOVERY,
      channelId,
      service: 'ErrorHandler',
      action: 'stream_recovery',
      resource: `channel:${channelId}`,
      details: { recoveryAction, ...details },
      severity: 'INFO',
      success: true
    });
  }

  public logRTMPConnectionFailed(channelId: string, destination: string, error: Error): void {
    this.logEvent({
      type: AuditEventType.RTMP_CONNECTION_FAILED,
      channelId,
      service: 'StreamManager',
      action: 'rtmp_connection_failed',
      resource: `rtmp:${destination}`,
      details: { destination, error: error.message },
      severity: 'ERROR',
      success: false,
      errorMessage: error.message
    });
  }

  public logRTMPConnectionRestored(channelId: string, destination: string): void {
    this.logEvent({
      type: AuditEventType.RTMP_CONNECTION_RESTORED,
      channelId,
      service: 'StreamManager',
      action: 'rtmp_connection_restored',
      resource: `rtmp:${destination}`,
      details: { destination },
      severity: 'INFO',
      success: true
    });
  }

  // System events
  public logErrorEscalated(errorId: string, level: number, _service: string, details: any = {}): void {
    this.logEvent({
      type: AuditEventType.ERROR_ESCALATED,
      service: 'EscalationManager',
      action: 'error_escalated',
      resource: `error:${errorId}`,
      details: { errorId, level, ...details },
      severity: level >= 3 ? 'CRITICAL' : 'ERROR',
      success: true
    });
  }

  public logCircuitBreakerOpened(service: string, failureCount: number): void {
    this.logEvent({
      type: AuditEventType.CIRCUIT_BREAKER_OPENED,
      service: 'CircuitBreaker',
      action: 'circuit_opened',
      resource: `service:${service}`,
      details: { targetService: service, failureCount },
      severity: 'WARN',
      success: true
    });
  }

  public logCircuitBreakerClosed(service: string): void {
    this.logEvent({
      type: AuditEventType.CIRCUIT_BREAKER_CLOSED,
      service: 'CircuitBreaker',
      action: 'circuit_closed',
      resource: `service:${service}`,
      details: { targetService: service },
      severity: 'INFO',
      success: true
    });
  }

  public logServiceDegraded(service: string, features: string[], reason: string): void {
    this.logEvent({
      type: AuditEventType.SERVICE_DEGRADED,
      service: 'ErrorHandler',
      action: 'service_degraded',
      resource: `service:${service}`,
      details: { targetService: service, degradedFeatures: features, reason },
      severity: 'WARN',
      success: true
    });
  }

  public logServiceRestored(service: string, features: string[]): void {
    this.logEvent({
      type: AuditEventType.SERVICE_RESTORED,
      service: 'ErrorHandler',
      action: 'service_restored',
      resource: `service:${service}`,
      details: { targetService: service, restoredFeatures: features },
      severity: 'INFO',
      success: true
    });
  }

  // User events
  public logUserLogin(userId: string, ipAddress?: string, userAgent?: string, sessionId?: string): void {
    this.logEvent({
      type: AuditEventType.USER_LOGIN,
      userId,
      service: 'Authentication',
      action: 'user_login',
      resource: `user:${userId}`,
      details: {},
      ...(ipAddress && { ipAddress }),
      ...(userAgent && { userAgent }),
      ...(sessionId && { sessionId }),
      severity: 'INFO',
      success: true
    });
  }

  public logUserLogout(userId: string, sessionId?: string): void {
    this.logEvent({
      type: AuditEventType.USER_LOGOUT,
      userId,
      service: 'Authentication',
      action: 'user_logout',
      resource: `user:${userId}`,
      details: {},
      ...(sessionId && { sessionId }),
      severity: 'INFO',
      success: true
    });
  }

  public logSecurityViolation(userId: string, violation: string, ipAddress?: string, details: any = {}): void {
    this.logEvent({
      type: AuditEventType.SECURITY_VIOLATION,
      userId,
      service: 'Security',
      action: 'security_violation',
      resource: `user:${userId}`,
      details: { violation, ...details },
      ...(ipAddress && { ipAddress }),
      severity: 'CRITICAL',
      success: false
    });
  }

  // Configuration events
  public logConfigurationChanged(service: string, changes: any, userId?: string): void {
    this.logEvent({
      type: AuditEventType.CONFIGURATION_CHANGED,
      ...(userId && { userId }),
      service,
      action: 'configuration_changed',
      resource: `config:${service}`,
      details: { changes },
      severity: 'WARN',
      success: true
    });
  }

  // Query methods
  public getEvents(filter: Partial<AuditEvent> = {}, limit: number = 100): AuditEvent[] {
    let filteredEvents = this.events;

    // Apply filters
    if (filter.type) {
      filteredEvents = filteredEvents.filter(e => e.type === filter.type);
    }
    if (filter.userId) {
      filteredEvents = filteredEvents.filter(e => e.userId === filter.userId);
    }
    if (filter.channelId) {
      filteredEvents = filteredEvents.filter(e => e.channelId === filter.channelId);
    }
    if (filter.service) {
      filteredEvents = filteredEvents.filter(e => e.service === filter.service);
    }
    if (filter.severity) {
      filteredEvents = filteredEvents.filter(e => e.severity === filter.severity);
    }

    // Sort by timestamp (newest first) and limit
    return filteredEvents
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  public getEventsByTimeRange(startTime: Date, endTime: Date, limit: number = 100): AuditEvent[] {
    return this.events
      .filter(e => e.timestamp >= startTime && e.timestamp <= endTime)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  public getEventsByChannel(channelId: string, limit: number = 50): AuditEvent[] {
    return this.events
      .filter(e => e.channelId === channelId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  public getSecurityEvents(limit: number = 50): AuditEvent[] {
    return this.events
      .filter(e => e.type === AuditEventType.SECURITY_VIOLATION || 
                   e.type === AuditEventType.USER_LOGIN || 
                   e.type === AuditEventType.USER_LOGOUT)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  public getErrorEvents(limit: number = 50): AuditEvent[] {
    return this.events
      .filter(e => e.severity === 'ERROR' || e.severity === 'CRITICAL' || !e.success)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  public getEventStats(): { total: number; byType: Record<string, number>; bySeverity: Record<string, number> } {
    const stats = {
      total: this.events.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>
    };

    for (const event of this.events) {
      stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
      stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;
    }

    return stats;
  }
}