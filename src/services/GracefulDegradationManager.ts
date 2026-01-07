import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { ServiceHealth } from '../types/errors';

export interface DegradationRule {
  service: string;
  features: string[];
  condition: DegradationCondition;
  priority: number;
  autoRestore: boolean;
  restoreThreshold?: DegradationCondition;
}

export interface DegradationCondition {
  errorRate?: number;
  responseTime?: number;
  availability?: number;
  consecutiveFailures?: number;
}

export interface DegradedService {
  service: string;
  degradedFeatures: string[];
  degradedAt: Date;
  reason: string;
  autoRestore: boolean;
  restoreCondition?: DegradationCondition | undefined;
}

export class GracefulDegradationManager extends EventEmitter {
  private degradationRules: Map<string, DegradationRule> = new Map();
  private degradedServices: Map<string, DegradedService> = new Map();
  private serviceHealth: Map<string, ServiceHealth> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeDefaultRules();
    this.startHealthMonitoring();
  }

  private initializeDefaultRules(): void {
    // Analytics service degradation
    this.addRule({
      service: 'AnalyticsEngine',
      features: ['real_time_metrics', 'detailed_reports', 'third_party_integration'],
      condition: {
        errorRate: 0.3, // 30% error rate
        responseTime: 5000, // 5 seconds
        consecutiveFailures: 5
      },
      priority: 1,
      autoRestore: true,
      restoreThreshold: {
        errorRate: 0.1,
        responseTime: 2000,
        consecutiveFailures: 0
      }
    });

    // Monetization service degradation
    this.addRule({
      service: 'MonetizationEngine',
      features: ['ad_insertion', 'revenue_tracking', 'subscription_enforcement'],
      condition: {
        errorRate: 0.2,
        responseTime: 3000,
        consecutiveFailures: 3
      },
      priority: 2,
      autoRestore: true,
      restoreThreshold: {
        errorRate: 0.05,
        responseTime: 1500
      }
    });

    // AI service degradation
    this.addRule({
      service: 'AIEngine',
      features: ['content_optimization', 'scheduling_recommendations', 'auto_categorization'],
      condition: {
        errorRate: 0.4,
        responseTime: 10000,
        consecutiveFailures: 3
      },
      priority: 3,
      autoRestore: true,
      restoreThreshold: {
        errorRate: 0.15,
        responseTime: 5000
      }
    });

    // Distribution service degradation
    this.addRule({
      service: 'DistributionEngine',
      features: ['multi_platform_streaming', 'platform_analytics', 'social_integration'],
      condition: {
        errorRate: 0.25,
        responseTime: 8000,
        consecutiveFailures: 4
      },
      priority: 2,
      autoRestore: true,
      restoreThreshold: {
        errorRate: 0.1,
        responseTime: 3000
      }
    });

    // Interaction service degradation
    this.addRule({
      service: 'InteractionEngine',
      features: ['live_chat', 'polls', 'social_feeds', 'gamification'],
      condition: {
        errorRate: 0.35,
        responseTime: 4000,
        consecutiveFailures: 5
      },
      priority: 4,
      autoRestore: true,
      restoreThreshold: {
        errorRate: 0.1,
        responseTime: 2000
      }
    });
  }

  public addRule(rule: DegradationRule): void {
    this.degradationRules.set(rule.service, rule);
    logger.info(`Degradation rule added for service: ${rule.service}`, {
      features: rule.features,
      condition: rule.condition,
      priority: rule.priority
    });
  }

  public removeRule(service: string): boolean {
    const removed = this.degradationRules.delete(service);
    if (removed) {
      logger.info(`Degradation rule removed for service: ${service}`);
    }
    return removed;
  }

  public updateServiceHealth(service: string, health: Partial<ServiceHealth>): void {
    const currentHealth = this.serviceHealth.get(service) || {
      service,
      status: 'HEALTHY',
      lastCheck: new Date(),
      responseTime: 0,
      errorRate: 0,
      uptime: 100
    };

    const updatedHealth: ServiceHealth = {
      ...currentHealth,
      ...health,
      lastCheck: new Date()
    };

    this.serviceHealth.set(service, updatedHealth);

    // Check if degradation is needed
    this.checkDegradationConditions(service, updatedHealth);
  }

  private checkDegradationConditions(service: string, health: ServiceHealth): void {
    const rule = this.degradationRules.get(service);
    if (!rule) return;

    const isDegraded = this.degradedServices.has(service);

    if (!isDegraded && this.shouldDegrade(health, rule.condition)) {
      this.degradeService(service, rule, health);
    } else if (isDegraded && rule.autoRestore && rule.restoreThreshold && 
               this.shouldRestore(health, rule.restoreThreshold)) {
      this.restoreService(service);
    }
  }

  private shouldDegrade(health: ServiceHealth, condition: DegradationCondition): boolean {
    if (condition.errorRate && health.errorRate >= condition.errorRate) {
      return true;
    }
    if (condition.responseTime && health.responseTime >= condition.responseTime) {
      return true;
    }
    if (condition.availability && health.uptime <= condition.availability) {
      return true;
    }
    // Note: consecutiveFailures would need to be tracked separately
    return false;
  }

  private shouldRestore(health: ServiceHealth, condition: DegradationCondition): boolean {
    if (condition.errorRate && health.errorRate > condition.errorRate) {
      return false;
    }
    if (condition.responseTime && health.responseTime > condition.responseTime) {
      return false;
    }
    if (condition.availability && health.uptime < condition.availability) {
      return false;
    }
    return true;
  }

  public degradeService(service: string, rule: DegradationRule, health: ServiceHealth): void {
    if (this.degradedServices.has(service)) {
      logger.warn(`Service ${service} is already degraded`);
      return;
    }

    const degradedService: DegradedService = {
      service,
      degradedFeatures: [...rule.features],
      degradedAt: new Date(),
      reason: this.buildDegradationReason(health, rule.condition),
      autoRestore: rule.autoRestore,
      restoreCondition: rule.restoreThreshold
    };

    this.degradedServices.set(service, degradedService);

    logger.warn(`Service degraded: ${service}`, {
      features: degradedService.degradedFeatures,
      reason: degradedService.reason,
      health: {
        errorRate: health.errorRate,
        responseTime: health.responseTime,
        uptime: health.uptime
      }
    });

    // Emit degradation event
    this.emit('serviceDegrade', {
      service,
      features: degradedService.degradedFeatures,
      reason: degradedService.reason,
      health
    });

    // Update service status
    const updatedHealth = this.serviceHealth.get(service);
    if (updatedHealth) {
      updatedHealth.status = 'DEGRADED';
      this.serviceHealth.set(service, updatedHealth);
    }
  }

  public restoreService(service: string): void {
    const degradedService = this.degradedServices.get(service);
    if (!degradedService) {
      logger.warn(`Service ${service} is not currently degraded`);
      return;
    }

    this.degradedServices.delete(service);

    logger.info(`Service restored: ${service}`, {
      features: degradedService.degradedFeatures,
      degradationDuration: Date.now() - degradedService.degradedAt.getTime()
    });

    // Emit restoration event
    this.emit('serviceRestore', {
      service,
      features: degradedService.degradedFeatures,
      degradationDuration: Date.now() - degradedService.degradedAt.getTime()
    });

    // Update service status
    const health = this.serviceHealth.get(service);
    if (health) {
      health.status = 'HEALTHY';
      this.serviceHealth.set(service, health);
    }
  }

  private buildDegradationReason(health: ServiceHealth, condition: DegradationCondition): string {
    const reasons: string[] = [];

    if (condition.errorRate && health.errorRate >= condition.errorRate) {
      reasons.push(`High error rate: ${(health.errorRate * 100).toFixed(1)}%`);
    }
    if (condition.responseTime && health.responseTime >= condition.responseTime) {
      reasons.push(`Slow response time: ${health.responseTime}ms`);
    }
    if (condition.availability && health.uptime <= condition.availability) {
      reasons.push(`Low availability: ${health.uptime.toFixed(1)}%`);
    }

    return reasons.join(', ') || 'Service health degraded';
  }

  public isFeatureAvailable(service: string, feature: string): boolean {
    const degradedService = this.degradedServices.get(service);
    if (!degradedService) {
      return true; // Service not degraded, all features available
    }

    return !degradedService.degradedFeatures.includes(feature);
  }

  public getAvailableFeatures(service: string): string[] {
    const rule = this.degradationRules.get(service);
    if (!rule) {
      return []; // No rule defined, assume all features available
    }

    const degradedService = this.degradedServices.get(service);
    if (!degradedService) {
      return [...rule.features]; // Service not degraded, all features available
    }

    return rule.features.filter(feature => !degradedService.degradedFeatures.includes(feature));
  }

  public getDegradedFeatures(service: string): string[] {
    const degradedService = this.degradedServices.get(service);
    return degradedService ? [...degradedService.degradedFeatures] : [];
  }

  public getDegradedServices(): DegradedService[] {
    return Array.from(this.degradedServices.values());
  }

  public getServiceHealth(service: string): ServiceHealth | undefined {
    return this.serviceHealth.get(service);
  }

  public getAllServiceHealth(): ServiceHealth[] {
    return Array.from(this.serviceHealth.values());
  }

  public getSystemHealthSummary(): {
    healthy: number;
    degraded: number;
    unhealthy: number;
    totalServices: number;
  } {
    const services = Array.from(this.serviceHealth.values());
    return {
      healthy: services.filter(s => s.status === 'HEALTHY').length,
      degraded: services.filter(s => s.status === 'DEGRADED').length,
      unhealthy: services.filter(s => s.status === 'UNHEALTHY').length,
      totalServices: services.length
    };
  }

  private startHealthMonitoring(): void {
    // Monitor service health every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.performHealthChecks();
    }, 30000);
  }

  private performHealthChecks(): void {
    // This would typically make health check requests to each service
    // For now, we'll just emit a health check event that services can respond to
    this.emit('healthCheck', {
      timestamp: new Date(),
      services: Array.from(this.degradationRules.keys())
    });
  }

  public forceDegrade(service: string, features: string[], _reason: string): void {
    const rule = this.degradationRules.get(service);
    if (!rule) {
      logger.error(`Cannot force degrade service ${service}: no rule defined`);
      return;
    }

    const mockRule: DegradationRule = {
      ...rule,
      features
    };

    const mockHealth: ServiceHealth = {
      service,
      status: 'DEGRADED',
      lastCheck: new Date(),
      responseTime: 0,
      errorRate: 1,
      uptime: 0
    };

    this.degradeService(service, mockRule, mockHealth);
  }

  public forceRestore(service: string): void {
    this.restoreService(service);
  }

  public shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    logger.info('Graceful degradation manager shutdown');
  }
}