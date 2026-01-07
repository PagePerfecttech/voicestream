import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { CircuitBreakerState } from '../types/errors';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  successThreshold: number;
}

export class CircuitBreaker extends EventEmitter {
  private states: Map<string, CircuitBreakerState> = new Map();
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    super();
    this.options = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      successThreshold: 3,
      ...options
    };
  }

  public async execute<T>(
    service: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const state = this.getOrCreateState(service);

    // Check circuit state
    if (state.state === 'OPEN') {
      if (this.shouldAttemptReset(state)) {
        state.state = 'HALF_OPEN';
        state.successCount = 0;
        logger.info(`Circuit breaker for ${service} moved to HALF_OPEN state`);
        this.emit('stateChange', { service, state: 'HALF_OPEN' });
      } else {
        logger.warn(`Circuit breaker for ${service} is OPEN, using fallback`);
        if (fallback) {
          return await fallback();
        }
        throw new Error(`Service ${service} is currently unavailable (circuit breaker OPEN)`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess(service);
      return result;
    } catch (error) {
      this.onFailure(service, error as Error);
      
      // If circuit is now open and we have a fallback, use it
      const currentState = this.states.get(service);
      if (currentState?.state === 'OPEN' && fallback) {
        logger.info(`Using fallback for ${service} after circuit opened`);
        return await fallback();
      }
      
      throw error;
    }
  }

  private getOrCreateState(service: string): CircuitBreakerState {
    if (!this.states.has(service)) {
      this.states.set(service, {
        service,
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0
      });
    }
    return this.states.get(service)!;
  }

  private onSuccess(service: string): void {
    const state = this.getOrCreateState(service);
    
    if (state.state === 'HALF_OPEN') {
      state.successCount++;
      
      if (state.successCount >= this.options.successThreshold) {
        state.state = 'CLOSED';
        state.failureCount = 0;
        state.successCount = 0;
        state.lastFailureTime = undefined;
        state.nextAttemptTime = undefined;
        
        logger.info(`Circuit breaker for ${service} reset to CLOSED state`);
        this.emit('stateChange', { service, state: 'CLOSED' });
      }
    } else if (state.state === 'CLOSED') {
      // Reset failure count on success
      if (state.failureCount > 0) {
        state.failureCount = Math.max(0, state.failureCount - 1);
      }
    }
  }

  private onFailure(service: string, error: Error): void {
    const state = this.getOrCreateState(service);
    state.failureCount++;
    state.lastFailureTime = new Date();

    logger.warn(`Circuit breaker failure for ${service}`, {
      failureCount: state.failureCount,
      threshold: this.options.failureThreshold,
      error: error.message
    });

    if (state.failureCount >= this.options.failureThreshold) {
      state.state = 'OPEN';
      state.nextAttemptTime = new Date(Date.now() + this.options.resetTimeout);
      
      logger.error(`Circuit breaker for ${service} opened due to failures`, {
        failureCount: state.failureCount,
        nextAttemptTime: state.nextAttemptTime
      });
      
      this.emit('stateChange', { service, state: 'OPEN' });
      this.emit('circuitOpen', { service, failureCount: state.failureCount });
    }
  }

  private shouldAttemptReset(state: CircuitBreakerState): boolean {
    return state.nextAttemptTime ? new Date() >= state.nextAttemptTime : false;
  }

  public getState(service: string): CircuitBreakerState | undefined {
    return this.states.get(service);
  }

  public getAllStates(): CircuitBreakerState[] {
    return Array.from(this.states.values());
  }

  public forceOpen(service: string): void {
    const state = this.getOrCreateState(service);
    state.state = 'OPEN';
    state.nextAttemptTime = new Date(Date.now() + this.options.resetTimeout);
    
    logger.warn(`Circuit breaker for ${service} manually opened`);
    this.emit('stateChange', { service, state: 'OPEN' });
  }

  public forceClose(service: string): void {
    const state = this.getOrCreateState(service);
    state.state = 'CLOSED';
    state.failureCount = 0;
    state.successCount = 0;
    state.lastFailureTime = undefined;
    state.nextAttemptTime = undefined;
    
    logger.info(`Circuit breaker for ${service} manually closed`);
    this.emit('stateChange', { service, state: 'CLOSED' });
  }

  public reset(service: string): void {
    this.states.delete(service);
    logger.info(`Circuit breaker for ${service} reset`);
  }

  public getHealthStatus(): { healthy: number; degraded: number; unhealthy: number } {
    const states = Array.from(this.states.values());
    return {
      healthy: states.filter(s => s.state === 'CLOSED').length,
      degraded: states.filter(s => s.state === 'HALF_OPEN').length,
      unhealthy: states.filter(s => s.state === 'OPEN').length
    };
  }
}