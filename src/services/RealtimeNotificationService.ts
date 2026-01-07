import { RealtimeWebSocketServer } from './WebSocketServer';
import { logger } from '../utils/logger';

/**
 * Service to handle real-time notifications across the system
 * This service acts as a bridge between various engines and the WebSocket server
 */
export class RealtimeNotificationService {
  private static instance: RealtimeNotificationService;
  private wsServer: RealtimeWebSocketServer | null = null;

  private constructor() {}

  public static getInstance(): RealtimeNotificationService {
    if (!RealtimeNotificationService.instance) {
      RealtimeNotificationService.instance = new RealtimeNotificationService();
    }
    return RealtimeNotificationService.instance;
  }

  public setWebSocketServer(wsServer: RealtimeWebSocketServer): void {
    this.wsServer = wsServer;
    logger.info('WebSocket server registered with notification service');
  }

  /**
   * Notify about channel status changes
   */
  public notifyChannelStatusChange(channelId: string, status: any): void {
    if (this.wsServer) {
      this.wsServer.broadcastChannelStatusChange(channelId, status);
      logger.debug(`Broadcasted status change for channel ${channelId}: ${status.status}`);
    }
  }

  /**
   * Notify about stream restarts
   */
  public notifyStreamRestart(channelId: string): void {
    if (this.wsServer) {
      this.wsServer.broadcastStreamRestart(channelId);
      logger.info(`Broadcasted stream restart notification for channel ${channelId}`);
    }
  }

  /**
   * Notify about channel creation
   */
  public notifyChannelCreated(channelId: string, channel: any): void {
    if (this.wsServer) {
      this.wsServer.broadcastChannelStatusChange(channelId, {
        status: channel.status,
        event: 'channel_created',
        channel
      });
      logger.info(`Broadcasted channel creation for channel ${channelId}`);
    }
  }

  /**
   * Notify about channel deletion
   */
  public notifyChannelDeleted(channelId: string): void {
    if (this.wsServer) {
      this.wsServer.broadcastChannelStatusChange(channelId, {
        status: 'DELETED',
        event: 'channel_deleted'
      });
      logger.info(`Broadcasted channel deletion for channel ${channelId}`);
    }
  }

  /**
   * Notify about errors
   */
  public notifyError(channelId: string, error: any): void {
    if (this.wsServer) {
      this.wsServer.broadcastChannelStatusChange(channelId, {
        status: 'ERROR',
        event: 'error',
        error: error.message || error
      });
      logger.error(`Broadcasted error for channel ${channelId}:`, error);
    }
  }

  /**
   * Check if WebSocket server is available
   */
  public isAvailable(): boolean {
    return this.wsServer !== null;
  }
}