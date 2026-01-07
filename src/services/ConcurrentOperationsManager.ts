import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  BulkOperationRequest, 
  BulkOperationResult, 
  ChannelOperationResult,
  OperationQueue,
  ResourceConstraints
} from '../types/channel';
import { ClientSubscriptionModel } from '../models/SubscriptionPlan';
import { logger } from '../utils/logger';
import * as os from 'os';

export class ConcurrentOperationsManager extends EventEmitter {
  private operationQueue: Map<string, OperationQueue> = new Map();
  private activeOperations: Map<string, BulkOperationResult> = new Map();
  private operationLocks: Map<string, boolean> = new Map(); // channelId -> locked
  private maxConcurrentOperations: number = 10;
  private maxFFmpegProcesses: number = 50;
  private currentOperationCount: number = 0;

  constructor() {
    super();
    this.setupResourceMonitoring();
  }

  /**
   * Queue a bulk operation with priority handling
   */
  async queueBulkOperation(
    clientId: string, 
    request: BulkOperationRequest
  ): Promise<string> {
    const operationId = uuidv4();
    
    // Get client subscription to determine priority
    const subscriptionData = await ClientSubscriptionModel.getSubscriptionWithPlan(clientId);
    const priority = request.priority || subscriptionData?.plan.priority || 1;

    const queueItem: OperationQueue = {
      id: operationId,
      clientId,
      operation: request.operation,
      channelIds: request.channelIds,
      priority,
      status: 'PENDING',
      createdAt: new Date()
    };

    this.operationQueue.set(operationId, queueItem);
    
    logger.info(`Queued bulk operation ${request.operation}`, {
      operationId,
      clientId,
      channelCount: request.channelIds.length,
      priority
    });

    // Process queue
    this.processQueue();

    return operationId;
  }

  /**
   * Execute a bulk operation
   */
  async executeBulkOperation(
    operationId: string,
    operationHandler: (channelId: string) => Promise<void>
  ): Promise<BulkOperationResult> {
    const queueItem = this.operationQueue.get(operationId);
    if (!queueItem) {
      throw new Error('Operation not found in queue');
    }

    // Initialize operation result
    const result: BulkOperationResult = {
      operationId,
      totalChannels: queueItem.channelIds.length,
      successCount: 0,
      failureCount: 0,
      results: [],
      status: 'IN_PROGRESS',
      startedAt: new Date()
    };

    this.activeOperations.set(operationId, result);
    this.currentOperationCount++;

    logger.info(`Starting bulk operation execution`, {
      operationId,
      operation: queueItem.operation,
      channelCount: queueItem.channelIds.length
    });

    try {
      // Check for conflicts and acquire locks
      const conflicts = await this.checkAndAcquireLocks(queueItem.channelIds);
      if (conflicts.length > 0) {
        throw new Error(`Channels are locked by other operations: ${conflicts.join(', ')}`);
      }

      // Execute operations with concurrency control
      const concurrencyLimit = this.calculateConcurrencyLimit(queueItem.priority);
      await this.executeWithConcurrencyLimit(
        queueItem.channelIds,
        operationHandler,
        concurrencyLimit,
        result
      );

      result.status = 'COMPLETED';
      result.completedAt = new Date();

      logger.info(`Bulk operation completed`, {
        operationId,
        successCount: result.successCount,
        failureCount: result.failureCount
      });

    } catch (error: any) {
      result.status = 'FAILED';
      result.completedAt = new Date();
      
      logger.error(`Bulk operation failed`, {
        operationId,
        error: error.message
      });

      throw error;
    } finally {
      // Release locks
      this.releaseLocks(queueItem.channelIds);
      this.currentOperationCount--;
      this.operationQueue.delete(operationId);
      
      // Process next items in queue
      this.processQueue();
    }

    return result;
  }

  /**
   * Get operation status
   */
  getOperationStatus(operationId: string): BulkOperationResult | null {
    return this.activeOperations.get(operationId) || null;
  }

  /**
   * Check resource availability for operations
   */
  async checkResourceAvailability(clientId: string, _operationType: string): Promise<boolean> {
    try {
      // Check system resources
      const systemLoad = os.loadavg()[0];
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const memoryUsage = (totalMemory - freeMemory) / totalMemory;

      // System resource thresholds
      if (systemLoad > os.cpus().length * 0.8) {
        logger.warn('High CPU load detected', { systemLoad, cpuCount: os.cpus().length });
        return false;
      }

      if (memoryUsage > 0.85) {
        logger.warn('High memory usage detected', { memoryUsage });
        return false;
      }

      // Check concurrent operation limits
      if (this.currentOperationCount >= this.maxConcurrentOperations) {
        logger.warn('Maximum concurrent operations reached', { 
          current: this.currentOperationCount,
          max: this.maxConcurrentOperations 
        });
        return false;
      }

      // Check client-specific limits
      const subscriptionData = await ClientSubscriptionModel.getSubscriptionWithPlan(clientId);
      if (!subscriptionData) {
        return false;
      }

      // For high-priority clients, allow more operations
      const clientPriority = subscriptionData.plan.priority || 1;
      const allowedOperations = Math.min(
        this.maxConcurrentOperations,
        Math.max(1, Math.floor(this.maxConcurrentOperations * (clientPriority / 10)))
      );

      const clientActiveOperations = Array.from(this.activeOperations.values())
        .filter(op => {
          const queueItem = Array.from(this.operationQueue.values())
            .find(q => q.id === op.operationId);
          return queueItem?.clientId === clientId;
        }).length;

      return clientActiveOperations < allowedOperations;

    } catch (error: any) {
      logger.error('Error checking resource availability', { error: error.message });
      return false;
    }
  }

  /**
   * Get current resource constraints
   */
  getResourceConstraints(): ResourceConstraints {
    const systemLoad = os.loadavg()[0];
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = (totalMemory - freeMemory) / totalMemory;

    return {
      maxConcurrentOperations: this.maxConcurrentOperations,
      maxFFmpegProcesses: this.maxFFmpegProcesses,
      cpuThreshold: systemLoad / os.cpus().length,
      memoryThreshold: memoryUsage
    };
  }

  /**
   * Process the operation queue based on priority
   */
  private processQueue(): void {
    if (this.currentOperationCount >= this.maxConcurrentOperations) {
      return;
    }

    // Sort queue by priority (higher priority first) and creation time
    const sortedQueue = Array.from(this.operationQueue.values())
      .filter(item => item.status === 'PENDING')
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.createdAt.getTime() - b.createdAt.getTime(); // Earlier first
      });

    // Process next item if available
    if (sortedQueue.length > 0) {
      const nextItem = sortedQueue[0];
      nextItem.status = 'IN_PROGRESS';
      nextItem.startedAt = new Date();
      
      this.emit('operationReady', nextItem.id);
    }
  }

  /**
   * Check for conflicts and acquire locks on channels
   */
  private async checkAndAcquireLocks(channelIds: string[]): Promise<string[]> {
    const conflicts: string[] = [];

    for (const channelId of channelIds) {
      if (this.operationLocks.get(channelId)) {
        conflicts.push(channelId);
      }
    }

    if (conflicts.length === 0) {
      // Acquire locks
      for (const channelId of channelIds) {
        this.operationLocks.set(channelId, true);
      }
    }

    return conflicts;
  }

  /**
   * Release locks on channels
   */
  private releaseLocks(channelIds: string[]): void {
    for (const channelId of channelIds) {
      this.operationLocks.delete(channelId);
    }
  }

  /**
   * Calculate concurrency limit based on priority
   */
  private calculateConcurrencyLimit(priority: number): number {
    // Higher priority gets more concurrent operations
    const baseConcurrency = 3;
    const priorityMultiplier = Math.max(1, priority / 5);
    return Math.min(10, Math.floor(baseConcurrency * priorityMultiplier));
  }

  /**
   * Execute operations with concurrency control
   */
  private async executeWithConcurrencyLimit(
    channelIds: string[],
    operationHandler: (channelId: string) => Promise<void>,
    concurrencyLimit: number,
    result: BulkOperationResult
  ): Promise<void> {
    const semaphore = new Semaphore(concurrencyLimit);
    
    const promises = channelIds.map(async (channelId) => {
      await semaphore.acquire();
      
      const channelResult: ChannelOperationResult = {
        channelId,
        channelName: '', // Will be filled by the handler
        status: 'IN_PROGRESS',
        startedAt: new Date()
      };
      
      result.results.push(channelResult);

      try {
        await operationHandler(channelId);
        channelResult.status = 'COMPLETED';
        channelResult.completedAt = new Date();
        result.successCount++;
        
        logger.debug(`Channel operation completed`, { channelId });
        
      } catch (error: any) {
        channelResult.status = 'FAILED';
        channelResult.error = error.message;
        channelResult.completedAt = new Date();
        result.failureCount++;
        
        logger.error(`Channel operation failed`, { channelId, error: error.message });
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(promises);
  }

  /**
   * Setup resource monitoring
   */
  private setupResourceMonitoring(): void {
    // Monitor system resources every 30 seconds
    setInterval(() => {
      const constraints = this.getResourceConstraints();
      
      // Adjust limits based on system load
      if (constraints.cpuThreshold > 0.8 || constraints.memoryThreshold > 0.85) {
        this.maxConcurrentOperations = Math.max(1, Math.floor(this.maxConcurrentOperations * 0.8));
        logger.warn('Reducing concurrent operations due to high system load', {
          newLimit: this.maxConcurrentOperations,
          cpuThreshold: constraints.cpuThreshold,
          memoryThreshold: constraints.memoryThreshold
        });
      } else if (constraints.cpuThreshold < 0.5 && constraints.memoryThreshold < 0.6) {
        this.maxConcurrentOperations = Math.min(10, this.maxConcurrentOperations + 1);
      }
    }, 30000);
  }
}

/**
 * Simple semaphore implementation for concurrency control
 */
class Semaphore {
  private permits: number;
  private waitQueue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()!;
      resolve();
    } else {
      this.permits++;
    }
  }
}