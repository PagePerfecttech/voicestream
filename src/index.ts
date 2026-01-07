import { createApp } from './app';
import { config } from './config';
import { initializeDatabase, closeDatabase } from './config/database';
import { initializeRedis, closeRedis } from './config/redis';
import { ServiceContainer } from './container/ServiceContainer';
import { SystemHealthMonitor } from './services/SystemHealthMonitor';
import { PerformanceMonitor } from './services/PerformanceMonitor';
import { AlertingService } from './services/AlertingService';
import { RealtimeWebSocketServer } from './services/WebSocketServer';
import { RealtimeNotificationService } from './services/RealtimeNotificationService';
import { logger } from './utils/logger';

async function startServer(): Promise<void> {
  try {
    // Initialize database
    await initializeDatabase();

    // Initialize Redis
    await initializeRedis();

    // Initialize service container
    const serviceContainer = ServiceContainer.getInstance();
    await serviceContainer.initialize();
    logger.info('Service container initialized');

    // Initialize monitoring services
    const healthMonitor = SystemHealthMonitor.getInstance();
    const performanceMonitor = PerformanceMonitor.getInstance();
    const alertingService = AlertingService.getInstance();
    
    // Start health monitoring
    healthMonitor.start();
    logger.info('Health monitoring started');

    // Start alerting service
    alertingService.start();
    logger.info('Alerting service started');

    // Set up performance monitoring alerts
    performanceMonitor.on('performanceAlert', (alert) => {
      logger.warn('Performance alert triggered', alert);
    });

    // Create Express app
    const app = createApp();

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`📊 Environment: ${config.nodeEnv}`);
      logger.info(`🔗 API Base URL: http://localhost:${config.port}${config.apiPrefix}`);
    });

    // Initialize WebSocket server for real-time updates
    const wsServer = new RealtimeWebSocketServer(server);
    logger.info(`🔌 WebSocket server initialized at ws://localhost:${config.port}/ws`);

    // Register WebSocket server with notification service
    const notificationService = RealtimeNotificationService.getInstance();
    notificationService.setWebSocketServer(wsServer);
    logger.info('📡 Real-time notification service initialized');

    // Set up health monitoring alerts
    healthMonitor.on('systemUnhealthy', (health) => {
      logger.error('System health critical', { health });
      // Could trigger alerts to external monitoring systems here
    });

    healthMonitor.on('systemDegraded', (health) => {
      logger.warn('System health degraded', { health });
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          wsServer.close();
          logger.info('WebSocket server closed');
          
          // Stop monitoring services
          alertingService.stop();
          healthMonitor.stop();
          performanceMonitor.shutdown();
          logger.info('Monitoring services stopped');
          
          // Shutdown service container
          await serviceContainer.shutdown();
          logger.info('Service container shutdown completed');
          
          await closeDatabase();
          await closeRedis();
          logger.info('✅ Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();