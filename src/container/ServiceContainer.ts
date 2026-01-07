import { ChannelManager } from '../services/ChannelManager';
import { StreamManager } from '../services/StreamManager';
import { PlayoutEngine } from '../services/PlayoutEngine';
import { AnalyticsEngine } from '../services/AnalyticsEngine';
import { MonetizationEngine } from '../services/MonetizationEngine';
import { AIEngine } from '../services/AIEngine';
import { DistributionEngine } from '../services/DistributionEngine';
import { InteractionEngine } from '../services/InteractionEngine';
import { ConcurrentOperationsManager } from '../services/ConcurrentOperationsManager';
import { PreviewPlayer } from '../services/PreviewPlayer';
import { RealtimeNotificationService } from '../services/RealtimeNotificationService';
import { ErrorRecoveryService } from '../services/ErrorRecoveryService';
import { CircuitBreaker } from '../services/CircuitBreaker';
import { EscalationManager } from '../services/EscalationManager';
import { AuditLogger } from '../services/AuditLogger';
import { GracefulDegradationManager } from '../services/GracefulDegradationManager';
import { SystemHealthMonitor } from '../services/SystemHealthMonitor';
import { PerformanceMonitor } from '../services/PerformanceMonitor';
import { AlertingService } from '../services/AlertingService';
import { knex } from '../config/database';
import { logger } from '../utils/logger';

export interface ServiceDependencies {
  channelManager: ChannelManager;
  streamManager: StreamManager;
  playoutEngine: PlayoutEngine;
  analyticsEngine: AnalyticsEngine;
  monetizationEngine: MonetizationEngine;
  aiEngine: AIEngine;
  distributionEngine: DistributionEngine;
  interactionEngine: InteractionEngine;
  concurrentOperationsManager: ConcurrentOperationsManager;
  previewPlayer: PreviewPlayer;
  realtimeNotificationService: RealtimeNotificationService;
  errorRecoveryService: ErrorRecoveryService;
  circuitBreaker: CircuitBreaker;
  escalationManager: EscalationManager;
  auditLogger: AuditLogger;
  gracefulDegradationManager: GracefulDegradationManager;
  systemHealthMonitor: SystemHealthMonitor;
  performanceMonitor: PerformanceMonitor;
  alertingService: AlertingService;
}

export class ServiceContainer {
  private static instance: ServiceContainer;
  private services: Partial<ServiceDependencies> = {};
  private initialized = false;

  private constructor() {}

  public static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('ServiceContainer already initialized');
      return;
    }

    try {
      logger.info('Initializing service container...');

      // Initialize core infrastructure services first
      this.services.auditLogger = new AuditLogger();
      this.services.circuitBreaker = new CircuitBreaker();
      this.services.escalationManager = new EscalationManager();
      this.services.gracefulDegradationManager = new GracefulDegradationManager();
      this.services.errorRecoveryService = new ErrorRecoveryService();

      // Initialize monitoring services (singletons)
      this.services.systemHealthMonitor = SystemHealthMonitor.getInstance();
      this.services.performanceMonitor = PerformanceMonitor.getInstance();
      this.services.realtimeNotificationService = RealtimeNotificationService.getInstance();
      this.services.alertingService = AlertingService.getInstance();

      // Initialize engines with dependencies
      this.services.playoutEngine = new PlayoutEngine();
      this.services.streamManager = new StreamManager();
      this.services.analyticsEngine = new AnalyticsEngine();
      this.services.monetizationEngine = new MonetizationEngine();
      this.services.aiEngine = new AIEngine();
      this.services.distributionEngine = new DistributionEngine(knex);
      this.services.interactionEngine = new InteractionEngine();
      this.services.previewPlayer = new PreviewPlayer();

      // Initialize managers that depend on engines
      this.services.channelManager = new ChannelManager();
      this.services.concurrentOperationsManager = new ConcurrentOperationsManager();

      // Wire up service dependencies
      await this.wireServiceDependencies();

      this.initialized = true;
      logger.info('Service container initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize service container:', error);
      throw error;
    }
  }

  public getService<K extends keyof ServiceDependencies>(serviceName: K): ServiceDependencies[K] {
    if (!this.initialized) {
      throw new Error('ServiceContainer not initialized. Call initialize() first.');
    }

    const service = this.services[serviceName];
    if (!service) {
      throw new Error(`Service ${serviceName} not found in container`);
    }

    return service as ServiceDependencies[K];
  }

  public getAllServices(): ServiceDependencies {
    if (!this.initialized) {
      throw new Error('ServiceContainer not initialized. Call initialize() first.');
    }

    return this.services as ServiceDependencies;
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down service container...');

    try {
      // Shutdown services in reverse order
      if (this.services.alertingService) {
        this.services.alertingService.stop();
      }
      
      if (this.services.systemHealthMonitor) {
        this.services.systemHealthMonitor.stop();
      }
      
      if (this.services.performanceMonitor) {
        this.services.performanceMonitor.shutdown();
      }

      // Shutdown other services that have cleanup methods
      const servicesToShutdown = [
        'channelManager',
        'streamManager',
        'playoutEngine',
        'analyticsEngine',
        'monetizationEngine',
        'aiEngine',
        'distributionEngine',
        'interactionEngine',
        'concurrentOperationsManager',
        'previewPlayer'
      ];

      for (const serviceName of servicesToShutdown) {
        const service = this.services[serviceName as keyof ServiceDependencies];
        if (service && typeof (service as any).shutdown === 'function') {
          try {
            await (service as any).shutdown();
            logger.debug(`Service ${serviceName} shutdown completed`);
          } catch (error) {
            logger.error(`Error shutting down service ${serviceName}:`, error);
          }
        }
      }

      // Clear the services
      this.services = {};
      this.initialized = false;

      logger.info('Service container shutdown completed');

    } catch (error) {
      logger.error('Error during service container shutdown:', error);
      throw error;
    }
  }

  private async wireServiceDependencies(): Promise<void> {
    logger.info('Wiring service dependencies...');

    try {
      // Wire ChannelManager dependencies
      if (this.services.channelManager && typeof (this.services.channelManager as any).setDependencies === 'function') {
        (this.services.channelManager as any).setDependencies({
          playoutEngine: this.services.playoutEngine,
          streamManager: this.services.streamManager,
          analyticsEngine: this.services.analyticsEngine,
          monetizationEngine: this.services.monetizationEngine,
          aiEngine: this.services.aiEngine,
          distributionEngine: this.services.distributionEngine,
          interactionEngine: this.services.interactionEngine,
          auditLogger: this.services.auditLogger,
          errorRecoveryService: this.services.errorRecoveryService
        });
      }

      // Wire PlayoutEngine dependencies
      if (this.services.playoutEngine && typeof (this.services.playoutEngine as any).setDependencies === 'function') {
        (this.services.playoutEngine as any).setDependencies({
          streamManager: this.services.streamManager,
          errorRecoveryService: this.services.errorRecoveryService,
          auditLogger: this.services.auditLogger
        });
      }

      // Wire StreamManager dependencies
      if (this.services.streamManager && typeof (this.services.streamManager as any).setDependencies === 'function') {
        (this.services.streamManager as any).setDependencies({
          errorRecoveryService: this.services.errorRecoveryService,
          auditLogger: this.services.auditLogger
        });
      }

      // Wire AnalyticsEngine dependencies
      if (this.services.analyticsEngine && typeof (this.services.analyticsEngine as any).setDependencies === 'function') {
        (this.services.analyticsEngine as any).setDependencies({
          realtimeNotificationService: this.services.realtimeNotificationService,
          auditLogger: this.services.auditLogger
        });
      }

      // Wire MonetizationEngine dependencies
      if (this.services.monetizationEngine && typeof (this.services.monetizationEngine as any).setDependencies === 'function') {
        (this.services.monetizationEngine as any).setDependencies({
          analyticsEngine: this.services.analyticsEngine,
          auditLogger: this.services.auditLogger
        });
      }

      // Wire AIEngine dependencies
      if (this.services.aiEngine && typeof (this.services.aiEngine as any).setDependencies === 'function') {
        (this.services.aiEngine as any).setDependencies({
          analyticsEngine: this.services.analyticsEngine,
          auditLogger: this.services.auditLogger
        });
      }

      // Wire DistributionEngine dependencies
      if (this.services.distributionEngine && typeof (this.services.distributionEngine as any).setDependencies === 'function') {
        (this.services.distributionEngine as any).setDependencies({
          streamManager: this.services.streamManager,
          analyticsEngine: this.services.analyticsEngine,
          auditLogger: this.services.auditLogger
        });
      }

      // Wire InteractionEngine dependencies
      if (this.services.interactionEngine && typeof (this.services.interactionEngine as any).setDependencies === 'function') {
        (this.services.interactionEngine as any).setDependencies({
          realtimeNotificationService: this.services.realtimeNotificationService,
          analyticsEngine: this.services.analyticsEngine,
          auditLogger: this.services.auditLogger
        });
      }

      // Wire ConcurrentOperationsManager dependencies
      if (this.services.concurrentOperationsManager && typeof (this.services.concurrentOperationsManager as any).setDependencies === 'function') {
        (this.services.concurrentOperationsManager as any).setDependencies({
          channelManager: this.services.channelManager,
          errorRecoveryService: this.services.errorRecoveryService,
          auditLogger: this.services.auditLogger
        });
      }

      // Wire PreviewPlayer dependencies
      if (this.services.previewPlayer && typeof (this.services.previewPlayer as any).setDependencies === 'function') {
        (this.services.previewPlayer as any).setDependencies({
          streamManager: this.services.streamManager,
          realtimeNotificationService: this.services.realtimeNotificationService
        });
      }

      logger.info('Service dependencies wired successfully');

    } catch (error) {
      logger.error('Failed to wire service dependencies:', error);
      throw error;
    }
  }
}