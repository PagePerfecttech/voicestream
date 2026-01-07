import { 
  Channel, 
  ChannelStatus, 
  CreateChannelRequest, 
  UpdateChannelRequest,
  BulkOperationRequest,
  BulkOperationResult,
  ResourceConstraints
} from '../types/channel';

/**
 * Interface for Channel Manager service
 * Defines the contract for channel lifecycle operations
 */
export interface ChannelManagerInterface {
  createChannel(clientId: string, config: CreateChannelRequest): Promise<Channel>;
  startChannel(channelId: string): Promise<void>;
  stopChannel(channelId: string): Promise<void>;
  restartChannel(channelId: string): Promise<void>;
  updateChannel(channelId: string, updates: UpdateChannelRequest): Promise<Channel>;
  getChannelStatus(channelId: string): Promise<ChannelStatus>;
  getChannel(channelId: string): Promise<Channel>;
  getChannelsByClient(clientId: string): Promise<Channel[]>;
  deleteChannel(channelId: string): Promise<void>;
  enforceSubscriptionLimits(clientId: string, operation: string): Promise<boolean>;
  
  // Concurrent operations
  bulkStartChannels(clientId: string, request: BulkOperationRequest): Promise<BulkOperationResult>;
  bulkStopChannels(clientId: string, request: BulkOperationRequest): Promise<BulkOperationResult>;
  bulkRestartChannels(clientId: string, request: BulkOperationRequest): Promise<BulkOperationResult>;
  bulkDeleteChannels(clientId: string, request: BulkOperationRequest): Promise<BulkOperationResult>;
  getBulkOperationStatus(operationId: string): Promise<BulkOperationResult>;
  getResourceConstraints(): Promise<ResourceConstraints>;
  checkResourceAvailability(clientId: string, operationType: string): Promise<boolean>;
}