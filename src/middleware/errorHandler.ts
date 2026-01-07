import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ErrorRecoveryService } from '../services/ErrorRecoveryService';
import { ErrorContext } from '../types/errors';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

// Global error recovery service instance
let errorRecoveryService: ErrorRecoveryService | null = null;

export function initializeErrorRecovery(): ErrorRecoveryService {
  if (!errorRecoveryService) {
    errorRecoveryService = new ErrorRecoveryService();
  }
  return errorRecoveryService;
}

export function getErrorRecoveryService(): ErrorRecoveryService | null {
  return errorRecoveryService;
}

export function errorHandler(
  error: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Create error context for comprehensive error handling
  const context: ErrorContext = {
    service: 'ExpressAPI',
    operation: `${req.method} ${req.path}`,
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] as string,
    metadata: {
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      body: req.body,
      params: req.params,
      query: req.query
    }
  };

  // Log error with full context
  logger.error('API Error occurred:', {
    error: error.message,
    stack: error.stack,
    statusCode,
    context,
    isOperational: error.isOperational
  });

  // Process through comprehensive error handling if available and it's a server error
  if (errorRecoveryService && statusCode >= 500) {
    errorRecoveryService.handleError(error, context).catch(recoveryError => {
      logger.error('Error recovery failed:', {
        originalError: error.message,
        recoveryError: recoveryError.message,
        context
      });
    });
  }

  // Send response to client
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: statusCode,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: error.stack,
        context: context.metadata 
      }),
    },
    timestamp: new Date().toISOString(),
    requestId: context.requestId
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  const message = `Route ${req.originalUrl} not found`;
  
  logger.warn('Route not found:', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    success: false,
    error: {
      message,
      code: 404
    },
    timestamp: new Date().toISOString(),
  });
}

export function createError(message: string, statusCode: number = 500): AppError {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}

// Async error wrapper for route handlers
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Service-specific error handlers
export function handleChannelError(error: Error, channelId: string, operation: string): void {
  if (!errorRecoveryService) return;

  const context: ErrorContext = {
    channelId,
    service: 'ChannelManager',
    operation,
    timestamp: new Date()
  };

  errorRecoveryService.handleError(error, context).catch(recoveryError => {
    logger.error('Channel error recovery failed:', {
      channelId,
      operation,
      originalError: error.message,
      recoveryError: recoveryError.message
    });
  });
}

export function handleStreamError(error: Error, channelId: string, operation: string): void {
  if (!errorRecoveryService) return;

  const context: ErrorContext = {
    channelId,
    service: 'PlayoutEngine',
    operation,
    timestamp: new Date()
  };

  errorRecoveryService.handleError(error, context).catch(recoveryError => {
    logger.error('Stream error recovery failed:', {
      channelId,
      operation,
      originalError: error.message,
      recoveryError: recoveryError.message
    });
  });
}

export function handleServiceError(error: Error, service: string, operation: string, metadata?: any): void {
  if (!errorRecoveryService) return;

  const context: ErrorContext = {
    service,
    operation,
    timestamp: new Date(),
    metadata
  };

  errorRecoveryService.handleError(error, context).catch(recoveryError => {
    logger.error('Service error recovery failed:', {
      service,
      operation,
      originalError: error.message,
      recoveryError: recoveryError.message
    });
  });
}