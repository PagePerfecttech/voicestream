import { ErrorRecoveryService } from '../../services/ErrorRecoveryService';
import { ErrorContext } from '../../types/errors';

describe('ErrorRecoveryService', () => {
  let errorRecoveryService: ErrorRecoveryService;

  beforeEach(() => {
    errorRecoveryService = new ErrorRecoveryService();
  });

  afterEach(() => {
    errorRecoveryService.shutdown();
  });

  describe('Error Handling', () => {
    it('should handle stream failure errors', async () => {
      const error = new Error('FFmpeg process crashed');
      const context: ErrorContext = {
        channelId: 'test-channel-1',
        service: 'PlayoutEngine',
        operation: 'start_stream',
        timestamp: new Date()
      };

      // Should not throw
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

    it('should use fallback when circuit breaker is open', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      const mockFallback = jest.fn().mockResolvedValue('fallback-result');

      // Force multiple failures to open circuit
      for (let i = 0; i < 6; i++) {
        try {
          await errorRecoveryService.executeWithCircuitBreaker('TestService', mockOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      // Now it should use fallback
      const result = await errorRecoveryService.executeWithCircuitBreaker(
        'TestService',
        mockOperation,
        mockFallback
      );

      expect(result).toBe('fallback-result');
      expect(mockFallback).toHaveBeenCalled();
    });
  });

  describe('Health Checks', () => {
    it('should perform health check for unknown service', async () => {
      const health = await errorRecoveryService.performHealthCheck('UnknownService');
      
      expect(health).toMatchObject({
        service: 'UnknownService',
        status: 'HEALTHY',
        responseTime: 100,
        errorRate: 0,
        uptime: 100
      });
    });
  });

  describe('Feature Availability', () => {
    it('should return true for available features by default', () => {
      const isAvailable = errorRecoveryService.isFeatureAvailable('TestService', 'test-feature');
      expect(isAvailable).toBe(true);
    });
  });

  describe('System Status', () => {
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

  describe('Event Emission', () => {
    it('should emit restart events', (done) => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        service: 'PlayoutEngine',
        operation: 'test_operation',
        timestamp: new Date()
      };

      errorRecoveryService.once('restart', (event) => {
        expect(event.service).toBe('PlayoutEngine');
        done();
      });

      errorRecoveryService.handleError(error, context);
    });
  });
});