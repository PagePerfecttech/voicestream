import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { errorHandler, notFoundHandler, initializeErrorRecovery } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { ServiceContainer } from './container/ServiceContainer';
import { SystemHealthMonitor } from './services/SystemHealthMonitor';
import { PerformanceMonitor } from './services/PerformanceMonitor';
import { AlertingService } from './services/AlertingService';
import analyticsRoutes from './routes/analytics';
import monetizationRoutes from './routes/monetization';
import aiRoutes from './routes/ai';
import distributionRoutes from './routes/distribution';
import interactionRoutes from './routes/interaction';
import concurrentRoutes from './routes/concurrent';
import channelsRoutes from './routes/channels';
import previewRoutes from './routes/preview';
import dashboardRoutes from './routes/dashboard';
import systemRoutes from './routes/system';
import { logger } from './utils/logger';

export function createApp(): express.Application {
  const app = express();

  // Initialize service container
  const serviceContainer = ServiceContainer.getInstance();
  
  // Initialize monitoring services
  const healthMonitor = SystemHealthMonitor.getInstance();
  const performanceMonitor = PerformanceMonitor.getInstance();
  const alertingService = AlertingService.getInstance();

  // Initialize comprehensive error recovery system
  try {
    const errorRecoveryService = initializeErrorRecovery();
    logger.info('Error recovery service initialized successfully');
    
    // Set up error recovery event handlers
    errorRecoveryService.on('restart', (event) => {
      logger.info('Service restart requested', event);
    });
    
    errorRecoveryService.on('fallback', (event) => {
      logger.warn('Service fallback activated', event);
    });
    
    errorRecoveryService.on('manualRestart', (event) => {
      logger.info('Manual service restart requested', event);
    });
    
  } catch (error) {
    logger.error('Failed to initialize error recovery service', { error });
  }

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: config.nodeEnv === 'production' ? false : true,
    credentials: true,
  }));

  // Compression middleware
  app.use(compression());

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging and performance monitoring
  app.use(requestLogger);
  app.use(performanceMonitor.getExpressMiddleware());

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
    });
  });

  // Root route - redirect to dashboard
  app.get('/', (_req, res) => {
    res.redirect('/dashboard');
  });

  // API routes
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/monetization', monetizationRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/distribution', distributionRoutes);
  app.use('/api/interaction', interactionRoutes);
  app.use('/api/concurrent', concurrentRoutes);
  app.use('/api/channels', channelsRoutes);
  app.use('/api/system', systemRoutes);
  app.use('/preview', previewRoutes);
  app.use('/dashboard', dashboardRoutes);

  // Error handling middleware
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Store references for shutdown
  app.locals.serviceContainer = serviceContainer;
  app.locals.healthMonitor = healthMonitor;
  app.locals.performanceMonitor = performanceMonitor;
  app.locals.alertingService = alertingService;

  return app;
}