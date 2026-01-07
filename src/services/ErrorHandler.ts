import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { 
  ErrorCategory, 
  ErrorSeverity, 
  RecoveryActionType, 
  CategorizedError, 
  ErrorContext, 
  RecoveryAction 
} from '../types/errors';
import { v4 as uuidv4 } from 'uuid';

export class ErrorHandler extends EventEmitter {
  private errors: Map<string, CategorizedError> = new Map();
  private recoveryStrategies: Map<ErrorCategory, RecoveryAction> = new Map();

  constructor() {
    super();
    this.initializeRecoveryStrategies();
  }

  private initializeRecoveryStrategies(): void {
    // Stream failure recovery
    this.recoveryStrategies.set(ErrorCategory.STREAM_FAILURE, {
      type: RecoveryActionType.RESTART,
      delay: 5000,
      maxAttempts: 3,
      fallbackStrategy: 'fallback_video',
      escalationLevel: 2
    });

    // RTMP connection recovery
    this.recoveryStrategies.set(ErrorCategory.RTMP_CONNECTION, {
      type: RecoveryActionType.RESTART,
      delay: 10000,
      maxAttempts: 5,
      fallbackStrategy: 'disable_rtmp',
      escalationLevel: 1
    });

    // Database error recovery
    this.recoveryStrategies.set(ErrorCategory.DATABASE_ERROR, {
      type: RecoveryActionType.ESCALATE,
      delay: 1000,
      maxAttempts: 3,
      escalationLevel: 3
    });

    // External service recovery
    this.recoveryStrategies.set(ErrorCategory.EXTERNAL_SERVICE, {
      type: RecoveryActionType.CIRCUIT_BREAK,
      delay: 30000,
      maxAttempts: 3,
      fallbackStrategy: 'graceful_degradation',
      escalationLevel: 1
    });

    // Validation error recovery
    this.recoveryStrategies.set(ErrorCategory.VALIDATION_ERROR, {
      type: RecoveryActionType.IGNORE,
      delay: 0,
      maxAttempts: 1,
      escalationLevel: 0
    });

    // Resource limit recovery
    this.recoveryStrategies.set(ErrorCategory.RESOURCE_LIMIT, {
      type: RecoveryActionType.GRACEFUL_DEGRADE,
      delay: 5000,
      maxAttempts: 1,
      escalationLevel: 2
    });
  }

  public categorizeError(error: Error, context: ErrorContext): CategorizedError {
    const category = this.determineCategory(error, context);
    const severity = this.determineSeverity(category, context);
    const recoveryAction = this.recoveryStrategies.get(category) || {
      type: RecoveryActionType.ESCALATE,
      delay: 5000,
      maxAttempts: 1,
      escalationLevel: 3
    };

    const categorizedError: CategorizedError = {
      id: uuidv4(),
      category,
      severity,
      message: error.message,
      originalError: error,
      context,
      recoveryAction,
      attemptCount: 0,
      createdAt: new Date()
    };

    this.errors.set(categorizedError.id, categorizedError);
    return categorizedError;
  }

  private determineCategory(error: Error, context: ErrorContext): ErrorCategory {
    const message = error.message.toLowerCase();
    const service = context.service.toLowerCase();

    // Stream-related errors
    if (service.includes('playout') || service.includes('ffmpeg') || message.includes('stream')) {
      return ErrorCategory.STREAM_FAILURE;
    }

    // RTMP-related errors
    if (service.includes('rtmp') || message.includes('rtmp') || message.includes('connection refused')) {
      return ErrorCategory.RTMP_CONNECTION;
    }

    // Database-related errors
    if (service.includes('database') || message.includes('connection') && message.includes('database')) {
      return ErrorCategory.DATABASE_ERROR;
    }

    // External service errors
    if (service.includes('analytics') || service.includes('monetization') || 
        service.includes('distribution') || message.includes('timeout')) {
      return ErrorCategory.EXTERNAL_SERVICE;
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid') || error.name === 'ValidationError') {
      return ErrorCategory.VALIDATION_ERROR;
    }

    // Resource limit errors
    if (message.includes('limit') || message.includes('quota') || message.includes('exceeded')) {
      return ErrorCategory.RESOURCE_LIMIT;
    }

    return ErrorCategory.SYSTEM_ERROR;
  }

  private determineSeverity(category: ErrorCategory, _context: ErrorContext): ErrorSeverity {
    // Critical errors that affect core streaming
    if (category === ErrorCategory.STREAM_FAILURE || category === ErrorCategory.DATABASE_ERROR) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity for RTMP and resource limits
    if (category === ErrorCategory.RTMP_CONNECTION || category === ErrorCategory.RESOURCE_LIMIT) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity for external services
    if (category === ErrorCategory.EXTERNAL_SERVICE) {
      return ErrorSeverity.MEDIUM;
    }

    // Low severity for validation and auth errors
    return ErrorSeverity.LOW;
  }

  public async handleError(error: Error, context: ErrorContext): Promise<RecoveryAction> {
    const categorizedError = this.categorizeError(error, context);
    
    // Log the error with full context
    this.logError(categorizedError);

    // Emit error event for monitoring
    this.emit('error', categorizedError);

    // Determine and execute recovery action
    const recoveryAction = await this.executeRecoveryAction(categorizedError);

    return recoveryAction;
  }

  private async executeRecoveryAction(error: CategorizedError): Promise<RecoveryAction> {
    error.attemptCount++;

    // Check if max attempts exceeded
    if (error.attemptCount > error.recoveryAction.maxAttempts) {
      return this.escalateError(error);
    }

    switch (error.recoveryAction.type) {
      case RecoveryActionType.RESTART:
        return this.handleRestart(error);
      
      case RecoveryActionType.FALLBACK:
        return this.handleFallback(error);
      
      case RecoveryActionType.CIRCUIT_BREAK:
        return this.handleCircuitBreak(error);
      
      case RecoveryActionType.GRACEFUL_DEGRADE:
        return this.handleGracefulDegradation(error);
      
      case RecoveryActionType.ESCALATE:
        return this.escalateError(error);
      
      default:
        return error.recoveryAction;
    }
  }

  private async handleRestart(error: CategorizedError): Promise<RecoveryAction> {
    logger.info(`Attempting restart recovery for error ${error.id}`, {
      category: error.category,
      attempt: error.attemptCount,
      context: error.context
    });

    // Emit restart event
    this.emit('restart', {
      errorId: error.id,
      channelId: error.context.channelId,
      service: error.context.service,
      attempt: error.attemptCount
    });

    return error.recoveryAction;
  }

  private async handleFallback(error: CategorizedError): Promise<RecoveryAction> {
    logger.info(`Attempting fallback recovery for error ${error.id}`, {
      category: error.category,
      fallbackStrategy: error.recoveryAction.fallbackStrategy,
      context: error.context
    });

    // Emit fallback event
    this.emit('fallback', {
      errorId: error.id,
      channelId: error.context.channelId,
      strategy: error.recoveryAction.fallbackStrategy
    });

    return error.recoveryAction;
  }

  private async handleCircuitBreak(error: CategorizedError): Promise<RecoveryAction> {
    logger.warn(`Circuit breaker activated for service ${error.context.service}`, {
      errorId: error.id,
      context: error.context
    });

    // Emit circuit breaker event
    this.emit('circuitBreak', {
      errorId: error.id,
      service: error.context.service,
      duration: error.recoveryAction.delay
    });

    return error.recoveryAction;
  }

  private async handleGracefulDegradation(error: CategorizedError): Promise<RecoveryAction> {
    logger.warn(`Graceful degradation activated for error ${error.id}`, {
      category: error.category,
      context: error.context
    });

    // Emit degradation event
    this.emit('gracefulDegrade', {
      errorId: error.id,
      service: error.context.service,
      features: this.getFeaturesToDegrade(error.category)
    });

    return error.recoveryAction;
  }

  private async escalateError(error: CategorizedError): Promise<RecoveryAction> {
    logger.error(`Escalating error ${error.id} - max attempts exceeded`, {
      category: error.category,
      severity: error.severity,
      attempts: error.attemptCount,
      context: error.context
    });

    // Emit escalation event
    this.emit('escalate', {
      errorId: error.id,
      category: error.category,
      severity: error.severity,
      context: error.context,
      escalationLevel: error.recoveryAction.escalationLevel
    });

    return {
      type: RecoveryActionType.ESCALATE,
      delay: 0,
      maxAttempts: 0,
      escalationLevel: error.recoveryAction.escalationLevel || 3
    };
  }

  private getFeaturesToDegrade(category: ErrorCategory): string[] {
    switch (category) {
      case ErrorCategory.EXTERNAL_SERVICE:
        return ['analytics', 'monetization', 'social_features'];
      case ErrorCategory.RESOURCE_LIMIT:
        return ['concurrent_channels', 'high_resolution'];
      default:
        return [];
    }
  }

  private logError(error: CategorizedError): void {
    const logLevel = this.getLogLevel(error.severity);
    
    logger.log(logLevel, `Error categorized: ${error.category}`, {
      errorId: error.id,
      category: error.category,
      severity: error.severity,
      message: error.message,
      context: error.context,
      recoveryAction: error.recoveryAction,
      attemptCount: error.attemptCount,
      stack: error.originalError.stack
    });
  }

  private getLogLevel(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'error';
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.LOW:
        return 'info';
      default:
        return 'error';
    }
  }

  public resolveError(errorId: string): void {
    const error = this.errors.get(errorId);
    if (error) {
      error.resolvedAt = new Date();
      logger.info(`Error resolved: ${errorId}`, {
        category: error.category,
        duration: error.resolvedAt.getTime() - error.createdAt.getTime()
      });
      
      this.emit('resolved', { errorId, error });
    }
  }

  public getActiveErrors(): CategorizedError[] {
    return Array.from(this.errors.values()).filter(error => !error.resolvedAt);
  }

  public getErrorHistory(limit: number = 100): CategorizedError[] {
    return Array.from(this.errors.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}