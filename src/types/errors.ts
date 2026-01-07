export enum ErrorCategory {
  STREAM_FAILURE = 'STREAM_FAILURE',
  RTMP_CONNECTION = 'RTMP_CONNECTION',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION',
  RESOURCE_LIMIT = 'RESOURCE_LIMIT',
  SYSTEM_ERROR = 'SYSTEM_ERROR'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum RecoveryActionType {
  RESTART = 'RESTART',
  FALLBACK = 'FALLBACK',
  ESCALATE = 'ESCALATE',
  IGNORE = 'IGNORE',
  CIRCUIT_BREAK = 'CIRCUIT_BREAK',
  GRACEFUL_DEGRADE = 'GRACEFUL_DEGRADE'
}

export interface ErrorContext {
  channelId?: string;
  clientId?: string;
  service: string;
  operation: string;
  timestamp: Date;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface RecoveryAction {
  type: RecoveryActionType;
  delay: number;
  maxAttempts: number;
  fallbackStrategy?: string;
  escalationLevel?: number;
}

export interface CategorizedError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  originalError: Error;
  context: ErrorContext;
  recoveryAction: RecoveryAction;
  attemptCount: number;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface CircuitBreakerState {
  service: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime?: Date | undefined;
  nextAttemptTime?: Date | undefined;
  successCount: number;
}

export interface ServiceHealth {
  service: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  lastCheck: Date;
  responseTime: number;
  errorRate: number;
  uptime: number;
}