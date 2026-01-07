import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { ServiceContainer } from '../container/ServiceContainer';
import { knex } from '../config/database';
import { redis } from '../config/redis';
import os from 'os';
import fs from 'fs/promises';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details?: any;
  error?: string;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  services: HealthCheckResult[];
  system: {
    cpu: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    disk: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

export class SystemHealthMonitor extends EventEmitter {
  private static instance: SystemHealthMonitor;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs = 30000; // 30 seconds
  private readonly serviceContainer: ServiceContainer;

  private constructor() {
    super();
    this.serviceContainer = ServiceContainer.getInstance();
  }

  public static getInstance(): SystemHealthMonitor {
    if (!SystemHealthMonitor.instance) {
      SystemHealthMonitor.instance = new SystemHealthMonitor();
    }
    return SystemHealthMonitor.instance;
  }

  public start(): void {
    if (this.healthCheckInterval) {
      logger.warn('Health monitor already running');
      return;
    }

    logger.info('Starting system health monitor...');
    
    // Run initial health check
    this.performHealthCheck().catch(error => {
      logger.error('Initial health check failed:', error);
    });

    // Schedule periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch(error => {
        logger.error('Periodic health check failed:', error);
      });
    }, this.checkIntervalMs);

    logger.info(`Health monitor started with ${this.checkIntervalMs}ms interval`);
  }

  public stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Health monitor stopped');
    }
  }

  public async getSystemHealth(): Promise<SystemHealth> {
    const startTime = Date.now();
    
    try {
      // Run all health checks in parallel
      const [
        databaseHealth,
        redisHealth,
        servicesHealth,
        systemMetrics
      ] = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkRedisHealth(),
        this.checkServicesHealth(),
        this.getSystemMetrics()
      ]);

      const allServices = [databaseHealth, redisHealth, ...servicesHealth];
      const overallStatus = this.determineOverallHealth(allServices);

      const health: SystemHealth = {
        overall: overallStatus,
        timestamp: new Date(),
        uptime: process.uptime(),
        services: allServices,
        system: systemMetrics
      };

      const responseTime = Date.now() - startTime;
      logger.debug(`Health check completed in ${responseTime}ms`, { status: overallStatus });

      return health;

    } catch (error) {
      logger.error('Failed to get system health:', error);
      
      return {
        overall: 'unhealthy',
        timestamp: new Date(),
        uptime: process.uptime(),
        services: [{
          service: 'health-monitor',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        }],
        system: await this.getSystemMetrics()
      };
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const health = await this.getSystemHealth();
      
      // Emit health status events
      this.emit('healthCheck', health);
      
      if (health.overall === 'unhealthy') {
        this.emit('systemUnhealthy', health);
        logger.error('System health check failed', { health });
      } else if (health.overall === 'degraded') {
        this.emit('systemDegraded', health);
        logger.warn('System health degraded', { health });
      } else {
        logger.debug('System health check passed', { status: health.overall });
      }

    } catch (error) {
      logger.error('Health check performance failed:', error);
      this.emit('healthCheckError', error);
    }
  }

  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Test database connection with a simple query
      await knex.raw('SELECT 1 as health_check');
      
      return {
        service: 'database',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: { type: 'postgresql' }
      };

    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Database connection failed'
      };
    }
  }

  private async checkRedisHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Test Redis connection with ping
      const result = await redis.ping();
      
      return {
        service: 'redis',
        status: result === 'PONG' ? 'healthy' : 'degraded',
        responseTime: Date.now() - startTime,
        details: { response: result }
      };

    } catch (error) {
      return {
        service: 'redis',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Redis connection failed'
      };
    }
  }

  private async checkServicesHealth(): Promise<HealthCheckResult[]> {
    const services = this.serviceContainer.getAllServices();
    const healthChecks: Promise<HealthCheckResult>[] = [];

    // Check each service that has a health check method
    Object.entries(services).forEach(([serviceName, service]) => {
      if (service && typeof service.getHealth === 'function') {
        healthChecks.push(this.checkServiceHealth(serviceName, service));
      }
    });

    return Promise.all(healthChecks);
  }

  private async checkServiceHealth(serviceName: string, service: any): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const health = await service.getHealth();
      
      return {
        service: serviceName,
        status: health.status || 'healthy',
        responseTime: Date.now() - startTime,
        details: health.details
      };

    } catch (error) {
      return {
        service: serviceName,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Service health check failed'
      };
    }
  }

  private async getSystemMetrics(): Promise<SystemHealth['system']> {
    try {
      // CPU usage (approximate)
      const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;

      // Memory usage
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryPercentage = (usedMemory / totalMemory) * 100;

      // Disk usage (for current directory)
      let diskUsage = { used: 0, total: 0, percentage: 0 };
      try {
        const stats = await fs.stat(process.cwd());
        // Note: This is a simplified disk check. In production, you'd want to check actual disk usage
        diskUsage = {
          used: stats.size || 0,
          total: 1000000000, // 1GB placeholder
          percentage: 0
        };
      } catch (error) {
        logger.debug('Could not get disk usage:', error);
      }

      return {
        cpu: Math.round(cpuUsage * 100) / 100,
        memory: {
          used: usedMemory,
          total: totalMemory,
          percentage: Math.round(memoryPercentage * 100) / 100
        },
        disk: diskUsage
      };

    } catch (error) {
      logger.error('Failed to get system metrics:', error);
      return {
        cpu: 0,
        memory: { used: 0, total: 0, percentage: 0 },
        disk: { used: 0, total: 0, percentage: 0 }
      };
    }
  }

  private determineOverallHealth(services: HealthCheckResult[]): 'healthy' | 'degraded' | 'unhealthy' {
    const unhealthyServices = services.filter(s => s.status === 'unhealthy');
    const degradedServices = services.filter(s => s.status === 'degraded');

    if (unhealthyServices.length > 0) {
      return 'unhealthy';
    }

    if (degradedServices.length > 0) {
      return 'degraded';
    }

    return 'healthy';
  }
}