import { ConcurrentOperationsManager } from '../../services/ConcurrentOperationsManager';
import { BulkOperationRequest } from '../../types/channel';

// Mock the ClientSubscriptionModel
jest.mock('../../models/SubscriptionPlan', () => ({
  ClientSubscriptionModel: {
    getSubscriptionWithPlan: jest.fn(),
  },
}));

describe('ConcurrentOperationsManager', () => {
  let concurrentOpsManager: ConcurrentOperationsManager;

  beforeEach(() => {
    concurrentOpsManager = new ConcurrentOperationsManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queueBulkOperation', () => {
    it('should queue a bulk operation successfully', async () => {
      const { ClientSubscriptionModel } = require('../../models/SubscriptionPlan');
      
      // Mock subscription data
      ClientSubscriptionModel.getSubscriptionWithPlan.mockResolvedValue({
        subscription: {
          id: 'sub-id',
          clientId: 'client-123',
          planId: 'plan-id',
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          trialEndDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        plan: {
          id: 'plan-id',
          name: 'Premium Plan',
          monthlyPrice: 99.99,
          channelLimit: 10,
          maxResolution: 'FHD' as const,
          outputTypes: ['HLS' as const, 'RTMP' as const],
          storageLimit: 500,
          concurrentChannels: 5,
          trialAllowed: true,
          tier: 'PREMIUM' as const,
          priority: 8,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const request: BulkOperationRequest = {
        channelIds: ['channel-1', 'channel-2', 'channel-3'],
        operation: 'START',
        priority: 5
      };

      const operationId = await concurrentOpsManager.queueBulkOperation('client-123', request);

      expect(operationId).toBeDefined();
      expect(typeof operationId).toBe('string');
      expect(ClientSubscriptionModel.getSubscriptionWithPlan).toHaveBeenCalledWith('client-123');
    });
  });

  describe('checkResourceAvailability', () => {
    it('should check resource availability', async () => {
      const { ClientSubscriptionModel } = require('../../models/SubscriptionPlan');
      
      // Mock subscription data
      ClientSubscriptionModel.getSubscriptionWithPlan.mockResolvedValue({
        subscription: {
          id: 'sub-id',
          clientId: 'client-123',
          planId: 'plan-id',
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          trialEndDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        plan: {
          id: 'plan-id',
          name: 'Premium Plan',
          monthlyPrice: 99.99,
          channelLimit: 10,
          maxResolution: 'FHD' as const,
          outputTypes: ['HLS' as const, 'RTMP' as const],
          storageLimit: 500,
          concurrentChannels: 5,
          trialAllowed: true,
          tier: 'PREMIUM' as const,
          priority: 8,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const available = await concurrentOpsManager.checkResourceAvailability('client-123', 'BULK_START');

      expect(available).toBe(true);
      expect(ClientSubscriptionModel.getSubscriptionWithPlan).toHaveBeenCalledWith('client-123');
    });
  });

  describe('getResourceConstraints', () => {
    it('should return current resource constraints', () => {
      const constraints = concurrentOpsManager.getResourceConstraints();

      expect(constraints).toHaveProperty('maxConcurrentOperations');
      expect(constraints).toHaveProperty('maxFFmpegProcesses');
      expect(constraints).toHaveProperty('cpuThreshold');
      expect(constraints).toHaveProperty('memoryThreshold');
      expect(typeof constraints.maxConcurrentOperations).toBe('number');
      expect(typeof constraints.maxFFmpegProcesses).toBe('number');
      expect(typeof constraints.cpuThreshold).toBe('number');
      expect(typeof constraints.memoryThreshold).toBe('number');
    });
  });
});