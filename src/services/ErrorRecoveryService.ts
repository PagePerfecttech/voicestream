import { EventEmitter } from 'events';
import { ErrorHandler } from './ErrorHandler';
import { CircuitBreaker } from './CircuitBreaker';
import { EscalationManager } from './EscalationManager';
import { AuditLogger } from './AuditLogger';
import { GracefulDegradationManager } from './GracefulDegradationManager';
import { logger } from '../utils/logger';
import { 
  ErrorContext, 
  CategorizedError, 
  RecoveryActionType,
  ServiceHealth 
} from '../types/errors';

export class ErrorRecoveryService extends EventEmitter {
  private errorHandler: ErrorHandler;
  private circuitBreaker: CircuitBreaker;
  private escalationManager: EscalationManager;
  private auditLogger: AuditLogger;
  private degradationManager: GracefulDegradationManager;
  private recoveryAttempts: Map<string, number> = new Map();

  constructor() {
    super();
    
    this.errorHandler = new ErrorHandler();
    this.circuitBreaker = new CircuitBreaker();
    this.escalationManager = new EscalationManager();
    this.auditLogger = new AuditLogger();
    this.degradationManager = new GracefulDegradationManager();

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Error handler events
    this.errorHandler.on('error', (error: CategorizedError) => {
      this.escalationManager.processError(error);
    });

    this.errorHandler.on('restart', (event) => {
      this.auditLogger.logStreamRecovery(event.channelId, 'restart', event);
    });

    this.errorHandler.on('fallback', (event) => {
      this.auditLogger.logStreamRecovery(event.channelId, 'fallback', event);
    });

    this.errorHandler.on('circuitBreak', (event) => {
      this.circuitBreaker.forceOpen(event.service);
      this.auditLogger.logCircuitBreakerOpened(event.service, 0);
    });

    this.errorHandler.on('gracefulDegrade', (event) => {
      this.degradationManager.forceDegrade(event.service, event.features, 'Error handler triggered');
      this.auditLogger.logServiceDegraded(event.service, event.features, 'Error handler triggered');
    });

    // Circuit breaker events
    this.circuitBreaker.on('stateChange', (event) => {
      if (event.state === 'OPEN') {
        this.auditLogger.logCircuitBreakerOpened(event.service, 0);
      } else if (event.state === 'CLOSED') {
        this.auditLogger.logCircuitBreakerClosed(event.service);
      }
    });

    // Escalation manager events
    this.escalationManager.on('escalation', (escalation) => {
      this.auditLogger.logErrorEscalated(
        escalation.errors[0]?.id || 'unknown',
        escalation.level,
        escalation.errors[0]?.context.service || 'unknown',
        { escalationId: escalation.id }
      );
    });

    // Degradation manager events
    this.degradationManager.on('serviceDegrade', (event) => {
      this.auditLogger.logServiceDegraded(event.service, event.features, event.reason);
    });

    this.degradationManager.on('serviceRestore', (event) => {
      this.auditLogger.logServiceRestored(event.service, event.features);
    });
  }

  public async handleError(error: Error, context: ErrorContext): Promise<void> {
    try {
      logger.info(`Processing error for service: ${context.service}`, {
        operation: context.operation,
        channelId: context.channelId,
        error: error.message
      });

      // Update service health based on error
      this.updateServiceHealthFromError(context.service, error);

      // Process error through error handler
      const recoveryAction = await this.errorHandler.handleError(error, context);

      // Execute recovery action
      await this.executeRecoveryAction(recoveryAction, error, context);

    } catch (recoveryError) {
      logger.error('Error in error recovery process', {
        originalError: error.message,
        recoveryError: recoveryError,
        context
      });

      // Log the recovery failure
      this.auditLogger.logEvent({
        type: 'ERROR_RECOVERY_FAILED' as any,
        service: 'ErrorRecoveryService',
        action: 'handle_error',
        success: false,
        errorMessage: `Recovery failed: ${recoveryError}`,
        details: { originalError: error.message, context },
        severity: 'CRITICAL'
      });
    }
  }

  private updateServiceHealthFromError(service: string, _error: Error): void {
    const currentHealth = this.degradationManager.getServiceHealth(service) || {
      service,
      status: 'HEALTHY' as const,
      lastCheck: new Date(),
      responseTime: 0,
      errorRate: 0,
      uptime: 100
    };

    // Increase error rate (simple calculation)
    const newErrorRate = Math.min(currentHealth.errorRate + 0.1, 1.0);

    this.degradationManager.updateServiceHealth(service, {
      errorRate: newErrorRate,
      lastCheck: new Date(),
      status: newErrorRate > 0.5 ? 'UNHEALTHY' : newErrorRate > 0.2 ? 'DEGRADED' : 'HEALTHY'
    });
  }

  private async executeRecoveryAction(
    recoveryAction: any,
    error: Error,
    context: ErrorContext
  ): Promise<void> {
    const actionKey = `${context.service}_${context.operation}`;
    const currentAttempts = this.recoveryAttempts.get(actionKey) || 0;

    switch (recoveryAction.type) {
      case RecoveryActionType.RESTART:
        await this.handleRestartAction(error, context, currentAttempts);
        break;

      case RecoveryActionType.FALLBACK:
        await this.handleFallbackAction(error, context);
        break;

      case RecoveryActionType.CIRCUIT_BREAK:
        await this.handleCircuitBreakAction(error, context);
        break;

      case RecoveryActionType.GRACEFUL_DEGRADE:
        await this.handleGracefulDegradeAction(error, context);
        break;

      case RecoveryActionType.ESCALATE:
        await this.handleEscalateAction(error, context);
        break;

      default:
        logger.warn(`Unknown recovery action type: ${recoveryAction.type}`);
    }

    // Update attempt count
    this.recoveryAttempts.set(actionKey, currentAttempts + 1);

    // Clean up old attempt counts
    setTimeout(() => {
      this.recoveryAttempts.delete(actionKey);
    }, 300000); // 5 minutes
  }

  private async handleRestartAction(error: Error, context: ErrorContext, attempts: number): Promise<void> {
    logger.info(`Executing restart action for ${context.service}`, {
      channelId: context.channelId,
      attempts,
      operation: context.operation
    });

    // Emit restart event for the specific service to handle
    this.emit('restart', {
      service: context.service,
      channelId: context.channelId,
      operation: context.operation,
      attempts,
      error: error.message
    });
  }

  private async handleFallbackAction(error: Error, context: ErrorContext): Promise<void> {
    logger.info(`Executing fallback action for ${context.service}`, {
      channelId: context.channelId,
      operation: context.operation
    });

    // Emit fallback event for the specific service to handle
    this.emit('fallback', {
      service: context.service,
      channelId: context.channelId,
      operation: context.operation,
      error: error.message
    });
  }

  private async handleCircuitBreakAction(error: Error, context: ErrorContext): Promise<void> {
    logger.warn(`Opening circuit breaker for ${context.service}`, {
      operation: context.operation,
      error: error.message
    });

    this.circuitBreaker.forceOpen(context.service);
  }

  private async handleGracefulDegradeAction(error: Error, context: ErrorContext): Promise<void> {
    logger.warn(`Initiating graceful degradation for ${context.service}`, {
      operation: context.operation,
      error: error.message
    });

    // Determine features to degrade based on service
    const featuresToDegrade = this.getFeaturesToDegrade(context.service);
    
    this.degradationManager.forceDegrade(
      context.service,
      featuresToDegrade,
      `Service error: ${error.message}`
    );
  }

  private async handleEscalateAction(error: Error, context: ErrorContext): Promise<void> {
    logger.error(`Escalating error for ${context.service}`, {
      channelId: context.channelId,
      operation: context.operation,
      error: error.message
    });

    // The escalation is already handled by the escalation manager
    // through the error handler events
  }

  private getFeaturesToDegrade(service: string): string[] {
    const degradationMap: Record<string, string[]> = {
      'AnalyticsEngine': ['real_time_metrics', 'detailed_reports'],
      'MonetizationEngine': ['ad_insertion', 'revenue_tracking'],
      'AIEngine': ['content_optimization', 'recommendations'],
      'DistributionEngine': ['multi_platform_streaming', 'social_integration'],
      'InteractionEngine': ['live_chat', 'polls', 'gamification']
    };

    return degradationMap[service] || ['non_critical_features'];
  }

  // Circuit breaker wrapper for external service calls
  public async executeWithCircuitBreaker<T>(
    service: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    return this.circuitBreaker.execute(service, operation, fallback);
  }

  // Health check methods
  public async performHealthCheck(service: string): Promise<ServiceHealth> {
    try {
      // This would typically make an actual health check request
      // For now, we'll return the current known health
      const health = this.degradationManager.getServiceHealth(service);
      
      if (health) {
        return health;
      }

      // Default healthy state for unknown services
      const defaultHealth: ServiceHealth = {
        service,
        status: 'HEALTHY',
        lastCheck: new Date(),
        responseTime: 100,
        errorRate: 0,
        uptime: 100
      };

      this.degradationManager.updateServiceHealth(service, defaultHealth);
      return defaultHealth;

    } catch (error) {
      logger.error(`Health check failed for ${service}`, { error });
      
      const unhealthyState: ServiceHealth = {
        service,
        status: 'UNHEALTHY',
        lastCheck: new Date(),
        responseTime: 0,
        errorRate: 1,
        uptime: 0
      };

      this.degradationManager.updateServiceHealth(service, unhealthyState);
      return unhealthyState;
    }
  }

  // Feature availability check
  public isFeatureAvailable(service: string, feature: string): boolean {
    return this.degradationManager.isFeatureAvailable(service, feature);
  }

  // Get system status
  public getSystemStatus(): {
    services: ServiceHealth[];
    degradedServices: any[];
    circuitBreakerStates: any[];
    activeErrors: CategorizedError[];
    activeEscalations: any[];
  } {
    return {
      services: this.degradationManager.getAllServiceHealth(),
      degradedServices: this.degradationManager.getDegradedServices(),
      circuitBreakerStates: this.circuitBreaker.getAllStates(),
      activeErrors: this.errorHandler.getActiveErrors(),
      activeEscalations: this.escalationManager.getActiveEscalations()
    };
  }

  // Recovery statistics
  public getRecoveryStats(): {
    totalErrors: number;
    resolvedErrors: number;
    activeErrors: number;
    escalations: number;
    degradedServices: number;
  } {
    const activeErrors = this.errorHandler.getActiveErrors();
    const errorHistory = this.errorHandler.getErrorHistory();
    const activeEscalations = this.escalationManager.getActiveEscalations();
    const degradedServices = this.degradationManager.getDegradedServices();

    return {
      totalErrors: errorHistory.length,
      resolvedErrors: errorHistory.filter(e => e.resolvedAt).length,
      activeErrors: activeErrors.length,
      escalations: activeEscalations.length,
      degradedServices: degradedServices.length
    };
  }

  // Manual recovery actions
  public async manualRestart(service: string, channelId?: string): Promise<void> {
    logger.info(`Manual restart initiated for ${service}`, { channelId });
    
    this.emit('manualRestart', {
      service,
      channelId,
      timestamp: new Date()
    });

    this.auditLogger.logEvent({
      type: 'MANUAL_RESTART' as any,
      service: 'ErrorRecoveryService',
      action: 'manual_restart',
      ...(channelId && { channelId }),
      resource: `service:${service}`,
      details: { targetService: service },
      severity: 'INFO',
      success: true
    });
  }

  public async manualRestore(service: string): Promise<void> {
    logger.info(`Manual restore initiated for ${service}`);
    
    this.degradationManager.forceRestore(service);
    this.circuitBreaker.forceClose(service);

    this.auditLogger.logEvent({
      type: 'MANUAL_RESTORE' as any,
      service: 'ErrorRecoveryService',
      action: 'manual_restore',
      resource: `service:${service}`,
      details: { targetService: service },
      severity: 'INFO',
      success: true
    });
  }

  // Shutdown gracefully
  public shutdown(): void {
    logger.info('Shutting down error recovery service');
    this.degradationManager.shutdown();
    this.removeAllListeners();
  }
}