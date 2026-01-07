import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { CategorizedError, ErrorSeverity } from '../types/errors';

export interface EscalationRule {
  level: number;
  severity: ErrorSeverity[];
  categories: string[];
  threshold: number;
  timeWindow: number; // in milliseconds
  actions: EscalationAction[];
}

export interface EscalationAction {
  type: 'EMAIL' | 'SMS' | 'WEBHOOK' | 'SLACK' | 'PAGERDUTY' | 'LOG';
  target: string;
  template?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface EscalationEvent {
  id: string;
  level: number;
  errors: CategorizedError[];
  triggeredAt: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
  actions: EscalationAction[];
}

export class EscalationManager extends EventEmitter {
  private rules: EscalationRule[] = [];
  private events: Map<string, EscalationEvent> = new Map();
  private errorCounts: Map<string, { count: number; firstSeen: Date }> = new Map();

  constructor() {
    super();
    this.initializeDefaultRules();
    this.startCleanupTimer();
  }

  private initializeDefaultRules(): void {
    // Level 1: Low severity errors
    this.rules.push({
      level: 1,
      severity: [ErrorSeverity.LOW, ErrorSeverity.MEDIUM],
      categories: ['VALIDATION_ERROR', 'AUTHENTICATION'],
      threshold: 10,
      timeWindow: 300000, // 5 minutes
      actions: [
        {
          type: 'LOG',
          target: 'escalation.log',
          priority: 'LOW'
        }
      ]
    });

    // Level 2: High severity errors
    this.rules.push({
      level: 2,
      severity: [ErrorSeverity.HIGH],
      categories: ['RTMP_CONNECTION', 'RESOURCE_LIMIT'],
      threshold: 3,
      timeWindow: 180000, // 3 minutes
      actions: [
        {
          type: 'EMAIL',
          target: 'support@cloudplayout.com',
          priority: 'MEDIUM',
          template: 'high_severity_alert'
        },
        {
          type: 'WEBHOOK',
          target: process.env.ALERT_WEBHOOK_URL || '',
          priority: 'MEDIUM'
        }
      ]
    });

    // Level 3: Critical errors
    this.rules.push({
      level: 3,
      severity: [ErrorSeverity.CRITICAL],
      categories: ['STREAM_FAILURE', 'DATABASE_ERROR', 'SYSTEM_ERROR'],
      threshold: 1,
      timeWindow: 60000, // 1 minute
      actions: [
        {
          type: 'EMAIL',
          target: 'critical@cloudplayout.com',
          priority: 'CRITICAL',
          template: 'critical_alert'
        },
        {
          type: 'SMS',
          target: process.env.EMERGENCY_PHONE || '',
          priority: 'CRITICAL'
        },
        {
          type: 'WEBHOOK',
          target: process.env.CRITICAL_WEBHOOK_URL || '',
          priority: 'CRITICAL'
        }
      ]
    });
  }

  public processError(error: CategorizedError): void {
    const key = `${error.category}_${error.severity}`;
    const now = new Date();

    // Update error count
    if (!this.errorCounts.has(key)) {
      this.errorCounts.set(key, { count: 1, firstSeen: now });
    } else {
      const errorCount = this.errorCounts.get(key)!;
      errorCount.count++;
    }

    // Check escalation rules
    for (const rule of this.rules) {
      if (this.shouldEscalate(error, rule)) {
        this.triggerEscalation(error, rule);
      }
    }
  }

  private shouldEscalate(error: CategorizedError, rule: EscalationRule): boolean {
    // Check severity match
    if (!rule.severity.includes(error.severity)) {
      return false;
    }

    // Check category match
    if (!rule.categories.includes(error.category)) {
      return false;
    }

    // Check threshold
    const key = `${error.category}_${error.severity}`;
    const errorCount = this.errorCounts.get(key);
    
    if (!errorCount || errorCount.count < rule.threshold) {
      return false;
    }

    // Check time window
    const timeSinceFirst = Date.now() - errorCount.firstSeen.getTime();
    if (timeSinceFirst > rule.timeWindow) {
      // Reset counter if outside time window
      this.errorCounts.set(key, { count: 1, firstSeen: new Date() });
      return false;
    }

    return true;
  }

  private async triggerEscalation(error: CategorizedError, rule: EscalationRule): Promise<void> {
    const escalationId = `escalation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const escalationEvent: EscalationEvent = {
      id: escalationId,
      level: rule.level,
      errors: [error],
      triggeredAt: new Date(),
      acknowledged: false,
      actions: rule.actions
    };

    this.events.set(escalationId, escalationEvent);

    logger.error(`Escalation triggered: Level ${rule.level}`, {
      escalationId,
      errorCategory: error.category,
      errorSeverity: error.severity,
      threshold: rule.threshold,
      actions: rule.actions.map(a => a.type)
    });

    // Execute escalation actions
    for (const action of rule.actions) {
      try {
        await this.executeAction(action, error, escalationEvent);
      } catch (actionError) {
        logger.error(`Failed to execute escalation action: ${action.type}`, {
          escalationId,
          error: actionError,
          action
        });
      }
    }

    // Emit escalation event
    this.emit('escalation', escalationEvent);

    // Reset error count after escalation
    const key = `${error.category}_${error.severity}`;
    this.errorCounts.delete(key);
  }

  private async executeAction(
    action: EscalationAction, 
    error: CategorizedError, 
    escalation: EscalationEvent
  ): Promise<void> {
    switch (action.type) {
      case 'LOG':
        this.executeLogAction(action, error, escalation);
        break;
      
      case 'EMAIL':
        await this.executeEmailAction(action, error, escalation);
        break;
      
      case 'SMS':
        await this.executeSMSAction(action, error, escalation);
        break;
      
      case 'WEBHOOK':
        await this.executeWebhookAction(action, error, escalation);
        break;
      
      case 'SLACK':
        await this.executeSlackAction(action, error, escalation);
        break;
      
      case 'PAGERDUTY':
        await this.executePagerDutyAction(action, error, escalation);
        break;
      
      default:
        logger.warn(`Unknown escalation action type: ${action.type}`);
    }
  }

  private executeLogAction(
    action: EscalationAction, 
    error: CategorizedError, 
    escalation: EscalationEvent
  ): void {
    logger.error(`ESCALATION ALERT - Level ${escalation.level}`, {
      escalationId: escalation.id,
      errorId: error.id,
      category: error.category,
      severity: error.severity,
      message: error.message,
      context: error.context,
      priority: action.priority
    });
  }

  private async executeEmailAction(
    action: EscalationAction, 
    error: CategorizedError, 
    escalation: EscalationEvent
  ): Promise<void> {
    // In a real implementation, this would integrate with an email service
    logger.info(`Email alert sent to ${action.target}`, {
      escalationId: escalation.id,
      priority: action.priority,
      template: action.template
    });

    // Emit email event for external email service integration
    this.emit('sendEmail', {
      to: action.target,
      subject: `[${action.priority}] Cloud Playout Alert - ${error.category}`,
      template: action.template,
      data: {
        escalation,
        error,
        timestamp: new Date().toISOString()
      }
    });
  }

  private async executeSMSAction(
    action: EscalationAction, 
    error: CategorizedError, 
    escalation: EscalationEvent
  ): Promise<void> {
    // In a real implementation, this would integrate with an SMS service
    logger.info(`SMS alert sent to ${action.target}`, {
      escalationId: escalation.id,
      priority: action.priority
    });

    // Emit SMS event for external SMS service integration
    this.emit('sendSMS', {
      to: action.target,
      message: `[${action.priority}] Cloud Playout Alert: ${error.category} - ${error.message}`,
      escalationId: escalation.id
    });
  }

  private async executeWebhookAction(
    action: EscalationAction, 
    error: CategorizedError, 
    escalation: EscalationEvent
  ): Promise<void> {
    if (!action.target) {
      logger.warn('Webhook action has no target URL');
      return;
    }

    try {
      // In a real implementation, this would make an HTTP request
      logger.info(`Webhook alert sent to ${action.target}`, {
        escalationId: escalation.id,
        priority: action.priority
      });

      // Emit webhook event for external webhook service integration
      this.emit('sendWebhook', {
        url: action.target,
        payload: {
          escalationId: escalation.id,
          level: escalation.level,
          error: {
            id: error.id,
            category: error.category,
            severity: error.severity,
            message: error.message,
            context: error.context
          },
          timestamp: escalation.triggeredAt.toISOString()
        }
      });
    } catch (webhookError) {
      logger.error(`Webhook execution failed`, {
        url: action.target,
        error: webhookError
      });
    }
  }

  private async executeSlackAction(
    action: EscalationAction, 
    error: CategorizedError, 
    escalation: EscalationEvent
  ): Promise<void> {
    // Emit Slack event for external Slack integration
    this.emit('sendSlack', {
      channel: action.target,
      message: {
        text: `🚨 *${action.priority} Alert* - ${error.category}`,
        attachments: [
          {
            color: this.getPriorityColor(action.priority),
            fields: [
              { title: 'Error ID', value: error.id, short: true },
              { title: 'Category', value: error.category, short: true },
              { title: 'Severity', value: error.severity, short: true },
              { title: 'Service', value: error.context.service, short: true },
              { title: 'Message', value: error.message, short: false }
            ],
            ts: Math.floor(escalation.triggeredAt.getTime() / 1000)
          }
        ]
      }
    });
  }

  private async executePagerDutyAction(
    action: EscalationAction, 
    error: CategorizedError, 
    escalation: EscalationEvent
  ): Promise<void> {
    // Emit PagerDuty event for external PagerDuty integration
    this.emit('sendPagerDuty', {
      routingKey: action.target,
      eventAction: 'trigger',
      payload: {
        summary: `${error.category}: ${error.message}`,
        source: error.context.service,
        severity: action.priority.toLowerCase(),
        component: error.context.channelId || 'system',
        group: error.category,
        class: error.severity,
        customDetails: {
          escalationId: escalation.id,
          errorId: error.id,
          context: error.context
        }
      }
    });
  }

  private getPriorityColor(priority: string): string {
    switch (priority) {
      case 'CRITICAL': return 'danger';
      case 'HIGH': return 'warning';
      case 'MEDIUM': return 'good';
      case 'LOW': return '#439FE0';
      default: return 'good';
    }
  }

  public acknowledgeEscalation(escalationId: string): boolean {
    const escalation = this.events.get(escalationId);
    if (escalation) {
      escalation.acknowledged = true;
      logger.info(`Escalation acknowledged: ${escalationId}`);
      this.emit('acknowledged', escalation);
      return true;
    }
    return false;
  }

  public resolveEscalation(escalationId: string): boolean {
    const escalation = this.events.get(escalationId);
    if (escalation) {
      escalation.resolvedAt = new Date();
      logger.info(`Escalation resolved: ${escalationId}`);
      this.emit('resolved', escalation);
      return true;
    }
    return false;
  }

  public getActiveEscalations(): EscalationEvent[] {
    return Array.from(this.events.values()).filter(e => !e.resolvedAt);
  }

  public getEscalationHistory(limit: number = 50): EscalationEvent[] {
    return Array.from(this.events.values())
      .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())
      .slice(0, limit);
  }

  private startCleanupTimer(): void {
    // Clean up old error counts every 10 minutes
    setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];
      
      this.errorCounts.forEach((errorCount, key) => {
        if (now - errorCount.firstSeen.getTime() > 600000) { // 10 minutes
          keysToDelete.push(key);
        }
      });
      
      keysToDelete.forEach(key => {
        this.errorCounts.delete(key);
      });
    }, 600000);
  }

  public addRule(rule: EscalationRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => a.level - b.level);
  }

  public removeRule(level: number): boolean {
    const index = this.rules.findIndex(r => r.level === level);
    if (index >= 0) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  public getRules(): EscalationRule[] {
    return [...this.rules];
  }
}