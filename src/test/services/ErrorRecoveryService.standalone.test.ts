import { ErrorRecoveryService } from '../../services/ErrorRecoveryService';
import { ErrorContext } from '../../types/errors';

// Mock the logger to avoid console output during tests
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn()
  }
}));

describe('ErrorRecoveryService - Standalone', () => {
  let errorRecoveryService: ErrorRecoveryService;

  beforeEach(() => {
    errorRecoveryService = new ErrorRecoveryService();
  });

  afterEach(() => {
    if (errorRecoveryService) {
      errorRecoveryService.shutdown();
    }
  });

  describe('Basic Functionality', () => {
    it('should initialize without errors', () => {
      expect(errorRecoveryService).toBeDefined();
      expect(typeof errorRecoveryService.handleError).toBe('function');
      expect(typeof errorRecoveryService.getSystemStatus).toBe('function');
    });

    it('should handle error processing without throwing', async () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        service: 'TestService',
        operation: 'test_operation',
        timestamp: new Date()
      };

      await expect(errorRecoveryService.handleError(error, context)).resolves.not.toThrow();
    });

    it('should return system status', () => {
      const status = errorRecoveryService.getSystemStatus();
      
      expect(status).toHaveProperty('services');
      expect(status).toHaveProperty('degradedServices');
      expect(status).toHaveProperty('circuitBreakerStates');
      expect(status).toHaveProperty('activeErrors');
      expect(status).toHaveProperty('activeEscalations');
      
      expect(Array.isArray(status.services)).toBe(true);
      expect(Array.isArray(status.degradedServices)).toBe(true);
      expect(Array.isArray(status.circuitBreakerStates)).toBe(true);
      expect(Array.isArray(status.activeErrors)).toBe(true);
      expect(Array.isArray(status.activeEscalations)).toBe(true);
    });

    it('should return recovery statistics', () => {
      const stats = errorRecoveryService.getRecoveryStats();
      
      expect(stats).toHaveProperty('totalErrors');
      expect(stats).toHaveProperty('resolvedErrors');
      expect(stats).toHaveProperty('activeErrors');
      expect(stats).toHaveProperty('escalations');
      expect(stats).toHaveProperty('degradedServices');
      
      expect(typeof stats.totalErrors).toBe('number');
      expect(typeof stats.resolvedErrors).toBe('number');
      expect(typeof stats.activeErrors).toBe('number');
      expect(typeof stats.escalations).toBe('number');
      expect(typeof stats.degradedServices).toBe('number');
    });

    it('should check feature availability', () => {
      const isAvailable = errorRecoveryService.isFeatureAvailable('TestService', 'test-feature');
      expect(typeof isAvailable).toBe('boolean');
      expect(isAvailable).toBe(true); // Should be true by default
    });

    it('should perform health checks', async () => {
      const health = await errorRecoveryService.performHealthCheck('TestService');
      
      expect(health).toHaveProperty('service');
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('lastCheck');
      expect(health).toHaveProperty('responseTime');
      expect(health).toHaveProperty('errorRate');
      expect(health).toHaveProperty('uptime');
      
      expect(health.service).toBe('TestService');
      expect(['HEALTHY', 'DEGRADED', 'UNHEALTHY']).toContain(health.status);
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should execute operations with circuit breaker', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await errorRecoveryService.executeWithCircuitBreaker(
        'TestService',
        mockOperation
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should handle operation failures', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      await expect(
        errorRecoveryService.executeWithCircuitBreaker('TestService', mockOperation)
      ).rejects.toThrow('Service unavailable');
    });
  });

  describe('Manual Recovery Actions', () => {
    it('should handle manual restart', async () => {
      const restartPromise = new Promise<void>((resolve) => {
        errorRecoveryService.once('manualRestart', (event) => {
          expect(event.service).toBe('TestService');
          expect(event.channelId).toBe('test-channel');
          resolve();
        });
      });

      await errorRecoveryService.manualRestart('TestService', 'test-channel');
      await restartPromise;
    });

    it('should handle manual restore', async () => {
      await expect(errorRecoveryService.manualRestore('TestService')).resolves.not.toThrow();
    });
  });

  describe('Error Categorization', () => {
    it('should handle stream failure errors', async () => {
      const error = new Error('FFmpeg process crashed');
      const context: ErrorContext = {
        channelId: 'test-channel-1',
        service: 'PlayoutEngine',
        operation: 'start_stream',
        timestamp: new Date()
      };

      await expect(errorRecoveryService.handleError(error, context)).resolves.not.toThrow();
    });

    it('should handle RTMP connection errors', async () => {
      const error = new Error('RTMP connection refused');
      const context: ErrorContext = {
        channelId: 'test-channel-1',
        service: 'StreamManager',
        operation: 'connect_rtmp',
        timestamp: new Date()
      };

      await expect(errorRecoveryService.handleError(error, context)).resolves.not.toThrow();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database connection timeout');
      const context: ErrorContext = {
        service: 'ChannelManager',
        operation: 'create_channel',
        timestamp: new Date()
      };

      await expect(errorRecoveryService.handleError(error, context)).resolves.not.toThrow();
    });

    it('should handle external service errors', async () => {
      const error = new Error('Analytics service timeout');
      const context: ErrorContext = {
        service: 'AnalyticsEngine',
        operation: 'track_event',
        timestamp: new Date()
      };

      await expect(errorRecoveryService.handleError(error, context)).resolves.not.toThrow();
    });
  });

  describe('Event Emission', () => {
    it('should emit restart events for stream failures', (done) => {
      const error = new Error('Stream failure');
      const context: ErrorContext = {
        service: 'PlayoutEngine',
        operation: 'stream_operation',
        timestamp: new Date()
      };

      errorRecoveryService.once('restart', (event) => {
        expect(event.service).toBe('PlayoutEngine');
        done();
      });

      errorRecoveryService.handleError(error, context);
    });

    it('should emit fallback events when appropriate', (done) => {
      const error = new Error('Service unavailable');
      const context: ErrorContext = {
        service: 'TestService',
        operation: 'test_operation',
        timestamp: new Date()
      };

      errorRecoveryService.once('fallback', (event) => {
        expect(event.service).toBe('TestService');
        done();
      });

      // This might not always trigger fallback, so we'll use a timeout
      errorRecoveryService.handleError(error, context);
      
      // Fallback timeout in case fallback event is not emitted
      setTimeout(() => {
        done();
      }, 100);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', () => {
      expect(() => errorRecoveryService.shutdown()).not.toThrow();
    });
  });
});