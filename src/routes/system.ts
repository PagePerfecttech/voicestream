import { Router, Request, Response } from 'express';
import { getErrorRecoveryService } from '../middleware/errorHandler';
import { asyncHandler } from '../middleware/errorHandler';
import { SystemHealthMonitor } from '../services/SystemHealthMonitor';
import { PerformanceMonitor } from '../services/PerformanceMonitor';
import { AlertingService } from '../services/AlertingService';
import { ServiceContainer } from '../container/ServiceContainer';
import { logger } from '../utils/logger';

const router = Router();
const healthMonitor = SystemHealthMonitor.getInstance();
const performanceMonitor = PerformanceMonitor.getInstance();
const alertingService = AlertingService.getInstance();
const serviceContainer = ServiceContainer.getInstance();

// Get comprehensive system health status
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const errorRecoveryService = getErrorRecoveryService();
  
  if (!errorRecoveryService) {
    return res.status(503).json({
      success: false,
      error: 'Error recovery service not initialized',
      timestamp: new Date().toISOString()
    });
  }

  // Get both error recovery status and comprehensive health
  const systemStatus = errorRecoveryService.getSystemStatus();
  const recoveryStats = errorRecoveryService.getRecoveryStats();
  const comprehensiveHealth = await healthMonitor.getSystemHealth();

  res.json({
    success: true,
    data: {
      status: 'operational',
      timestamp: new Date().toISOString(),
      overall: comprehensiveHealth.overall,
      uptime: comprehensiveHealth.uptime,
      services: systemStatus.services,
      degradedServices: systemStatus.degradedServices,
      circuitBreakers: systemStatus.circuitBreakerStates,
      errors: {
        active: systemStatus.activeErrors.length,
        total: recoveryStats.totalErrors,
        resolved: recoveryStats.resolvedErrors
      },
      escalations: {
        active: systemStatus.activeEscalations.length
      },
      recovery: recoveryStats,
      systemMetrics: comprehensiveHealth.system,
      healthChecks: comprehensiveHealth.services
    }
  });
}));

// Get performance metrics
router.get('/performance', asyncHandler(async (_req: Request, res: Response) => {
  const metrics = await performanceMonitor.getMetrics();
  
  res.json({
    success: true,
    data: metrics
  });
}));

// Get service container status
router.get('/services', asyncHandler(async (_req: Request, res: Response) => {
  const services = serviceContainer.getAllServices();
  const serviceStatus: Record<string, any> = {};
  
  // Check each service status
  for (const [serviceName, service] of Object.entries(services)) {
    try {
      if (service && typeof service.getHealth === 'function') {
        const health = await service.getHealth();
        serviceStatus[serviceName] = {
          status: health.status || 'unknown',
          details: health.details
        };
      } else {
        serviceStatus[serviceName] = {
          status: 'initialized',
          details: { hasHealthCheck: false }
        };
      }
    } catch (error) {
      serviceStatus[serviceName] = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  res.json({
    success: true,
    data: {
      initialized: true,
      services: serviceStatus
    }
  });
}));

// Start health monitoring
router.post('/monitoring/start', asyncHandler(async (_req: Request, res: Response) => {
  healthMonitor.start();
  
  res.json({
    success: true,
    message: 'Health monitoring started'
  });
}));

// Stop health monitoring
router.post('/monitoring/stop', asyncHandler(async (_req: Request, res: Response) => {
  healthMonitor.stop();
  
  res.json({
    success: true,
    message: 'Health monitoring stopped'
  });
}));

// Get detailed system status
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const errorRecoveryService = getErrorRecoveryService();
  
  if (!errorRecoveryService) {
    return res.status(503).json({
      success: false,
      error: 'Error recovery service not initialized'
    });
  }

  const systemStatus = errorRecoveryService.getSystemStatus();

  res.json({
    success: true,
    data: systemStatus
  });
}));

// Get recovery statistics
router.get('/recovery/stats', asyncHandler(async (req: Request, res: Response) => {
  const errorRecoveryService = getErrorRecoveryService();
  
  if (!errorRecoveryService) {
    return res.status(503).json({
      success: false,
      error: 'Error recovery service not initialized'
    });
  }

  const stats = errorRecoveryService.getRecoveryStats();

  res.json({
    success: true,
    data: stats
  });
}));

// Check if a feature is available for a service
router.get('/features/:service/:feature', asyncHandler(async (req: Request, res: Response) => {
  const { service, feature } = req.params;
  const errorRecoveryService = getErrorRecoveryService();
  
  if (!errorRecoveryService) {
    return res.status(503).json({
      success: false,
      error: 'Error recovery service not initialized'
    });
  }

  const isAvailable = errorRecoveryService.isFeatureAvailable(service, feature);

  res.json({
    success: true,
    data: {
      service,
      feature,
      available: isAvailable
    }
  });
}));

// Perform health check for a specific service
router.post('/health/:service', asyncHandler(async (req: Request, res: Response) => {
  const { service } = req.params;
  const errorRecoveryService = getErrorRecoveryService();
  
  if (!errorRecoveryService) {
    return res.status(503).json({
      success: false,
      error: 'Error recovery service not initialized'
    });
  }

  const health = await errorRecoveryService.performHealthCheck(service);

  res.json({
    success: true,
    data: health
  });
}));

// Manual restart for a service
router.post('/recovery/restart/:service', asyncHandler(async (req: Request, res: Response) => {
  const { service } = req.params;
  const { channelId } = req.body;
  const errorRecoveryService = getErrorRecoveryService();
  
  if (!errorRecoveryService) {
    return res.status(503).json({
      success: false,
      error: 'Error recovery service not initialized'
    });
  }

  await errorRecoveryService.manualRestart(service, channelId);

  logger.info(`Manual restart initiated for service: ${service}`, {
    channelId,
    initiatedBy: req.ip
  });

  res.json({
    success: true,
    message: `Manual restart initiated for ${service}`,
    timestamp: new Date().toISOString()
  });
}));

// Manual restore for a service
router.post('/recovery/restore/:service', asyncHandler(async (req: Request, res: Response) => {
  const { service } = req.params;
  const errorRecoveryService = getErrorRecoveryService();
  
  if (!errorRecoveryService) {
    return res.status(503).json({
      success: false,
      error: 'Error recovery service not initialized'
    });
  }

  await errorRecoveryService.manualRestore(service);

  logger.info(`Manual restore initiated for service: ${service}`, {
    initiatedBy: req.ip
  });

  res.json({
    success: true,
    message: `Manual restore initiated for ${service}`,
    timestamp: new Date().toISOString()
  });
}));

// Get circuit breaker states
router.get('/circuit-breakers', asyncHandler(async (req: Request, res: Response) => {
  const errorRecoveryService = getErrorRecoveryService();
  
  if (!errorRecoveryService) {
    return res.status(503).json({
      success: false,
      error: 'Error recovery service not initialized'
    });
  }

  const systemStatus = errorRecoveryService.getSystemStatus();

  res.json({
    success: true,
    data: {
      circuitBreakers: systemStatus.circuitBreakerStates,
      timestamp: new Date().toISOString()
    }
  });
}));

// Get degraded services
router.get('/degraded-services', asyncHandler(async (req: Request, res: Response) => {
  const errorRecoveryService = getErrorRecoveryService();
  
  if (!errorRecoveryService) {
    return res.status(503).json({
      success: false,
      error: 'Error recovery service not initialized'
    });
  }

  const systemStatus = errorRecoveryService.getSystemStatus();

  res.json({
    success: true,
    data: {
      degradedServices: systemStatus.degradedServices,
      timestamp: new Date().toISOString()
    }
  });
}));

// Get active errors
router.get('/errors/active', asyncHandler(async (req: Request, res: Response) => {
  const errorRecoveryService = getErrorRecoveryService();
  
  if (!errorRecoveryService) {
    return res.status(503).json({
      success: false,
      error: 'Error recovery service not initialized'
    });
  }

  const systemStatus = errorRecoveryService.getSystemStatus();

  res.json({
    success: true,
    data: {
      activeErrors: systemStatus.activeErrors,
      count: systemStatus.activeErrors.length,
      timestamp: new Date().toISOString()
    }
  });
}));

// Get active escalations
router.get('/escalations/active', asyncHandler(async (req: Request, res: Response) => {
  const errorRecoveryService = getErrorRecoveryService();
  
  if (!errorRecoveryService) {
    return res.status(503).json({
      success: false,
      error: 'Error recovery service not initialized'
    });
  }

  const systemStatus = errorRecoveryService.getSystemStatus();

  res.json({
    success: true,
    data: {
      activeEscalations: systemStatus.activeEscalations,
      count: systemStatus.activeEscalations.length,
      timestamp: new Date().toISOString()
    }
  });
}));

// Alerting endpoints
router.get('/alerts', asyncHandler(async (req: Request, res: Response) => {
  const { active, limit } = req.query;
  
  let alerts;
  if (active === 'true') {
    alerts = alertingService.getActiveAlerts();
  } else {
    alerts = alertingService.getAlertHistory(limit ? parseInt(limit as string) : 100);
  }

  res.json({
    success: true,
    data: {
      alerts,
      count: alerts.length,
      timestamp: new Date().toISOString()
    }
  });
}));

router.post('/alerts/:alertId/acknowledge', asyncHandler(async (req: Request, res: Response) => {
  const { alertId } = req.params;
  const { acknowledgedBy } = req.body;

  const success = alertingService.acknowledgeAlert(alertId, acknowledgedBy || 'system');

  if (success) {
    res.json({
      success: true,
      message: 'Alert acknowledged successfully'
    });
  } else {
    res.status(404).json({
      success: false,
      error: 'Alert not found'
    });
  }
}));

router.post('/alerts/:alertId/resolve', asyncHandler(async (req: Request, res: Response) => {
  const { alertId } = req.params;
  const { resolvedBy } = req.body;

  const success = await alertingService.resolveAlert(alertId, resolvedBy || 'system');

  if (success) {
    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });
  } else {
    res.status(404).json({
      success: false,
      error: 'Alert not found'
    });
  }
}));

router.get('/alerts/stats', asyncHandler(async (req: Request, res: Response) => {
  const stats = alertingService.getStats();

  res.json({
    success: true,
    data: stats
  });
}));

router.post('/alerts/test', asyncHandler(async (req: Request, res: Response) => {
  const { type, severity, title, message } = req.body;

  const alert = await alertingService.createAlert({
    type: type || 'business',
    severity: severity || 'low',
    title: title || 'Test Alert',
    message: message || 'This is a test alert generated from the API',
    source: 'api-test'
  });

  res.json({
    success: true,
    data: alert,
    message: 'Test alert created successfully'
  });
}));

export default router;