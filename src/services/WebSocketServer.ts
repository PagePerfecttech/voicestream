import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { logger } from '../utils/logger';
import { ChannelManager } from './ChannelManager';
import { StreamManager } from './StreamManager';
import { AnalyticsEngine } from './AnalyticsEngine';

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'status_update' | 'metrics_update' | 'stream_restart' | 'error';
  channelId?: string;
  clientId?: string;
  data?: any;
}

export interface ClientConnection {
  ws: WebSocket;
  channelId?: string;
  clientId?: string;
  subscriptions: Set<string>;
}

export class RealtimeWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, ClientConnection> = new Map();
  private channelSubscriptions: Map<string, Set<WebSocket>> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  
  private channelManager: ChannelManager;
  private streamManager: StreamManager;
  private analyticsEngine: AnalyticsEngine;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.channelManager = new ChannelManager();
    this.streamManager = new StreamManager();
    this.analyticsEngine = new AnalyticsEngine();
    
    this.setupWebSocketServer();
    this.startPeriodicUpdates();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('New WebSocket connection established');
      
      const clientConnection: ClientConnection = {
        ws,
        subscriptions: new Set()
      };
      
      this.clients.set(ws, clientConnection);

      ws.on('message', async (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          logger.error('Error parsing WebSocket message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
        this.handleDisconnection(ws);
      });

      // Send initial connection confirmation
      this.sendMessage(ws, {
        type: 'status_update',
        data: { connected: true, timestamp: new Date().toISOString() }
      });
    });
  }

  private async handleMessage(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (message.type) {
      case 'subscribe':
        if (message.channelId) {
          await this.subscribeToChannel(ws, message.channelId);
          client.channelId = message.channelId;
          if (message.clientId) {
            client.clientId = message.clientId;
          }
        }
        break;

      case 'unsubscribe':
        if (message.channelId) {
          this.unsubscribeFromChannel(ws, message.channelId);
        }
        break;

      default:
        logger.warn('Unknown WebSocket message type:', message.type);
    }
  }

  private async subscribeToChannel(ws: WebSocket, channelId: string): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) return;

    // Add to channel subscriptions
    if (!this.channelSubscriptions.has(channelId)) {
      this.channelSubscriptions.set(channelId, new Set());
    }
    this.channelSubscriptions.get(channelId)!.add(ws);
    client.subscriptions.add(channelId);

    logger.info(`Client subscribed to channel: ${channelId}`);

    // Send initial channel status
    try {
      const status = await this.channelManager.getChannelStatus(channelId);
      const metrics = await this.streamManager.getOutputMetrics(channelId);
      const realtimeMetrics = await this.analyticsEngine.getRealtimeMetrics(channelId);

      this.sendMessage(ws, {
        type: 'status_update',
        channelId,
        data: {
          status,
          metrics,
          realtimeMetrics,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error(`Error fetching initial status for channel ${channelId}:`, error);
      this.sendError(ws, `Failed to fetch channel status: ${channelId}`);
    }
  }

  private unsubscribeFromChannel(ws: WebSocket, channelId: string): void {
    const client = this.clients.get(ws);
    if (!client) return;

    const channelSubs = this.channelSubscriptions.get(channelId);
    if (channelSubs) {
      channelSubs.delete(ws);
      if (channelSubs.size === 0) {
        this.channelSubscriptions.delete(channelId);
      }
    }
    
    client.subscriptions.delete(channelId);
    logger.info(`Client unsubscribed from channel: ${channelId}`);
  }

  private handleDisconnection(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (client) {
      // Remove from all channel subscriptions
      for (const channelId of client.subscriptions) {
        this.unsubscribeFromChannel(ws, channelId);
      }
      this.clients.delete(ws);
      logger.info('WebSocket client disconnected');
    }
  }

  private startPeriodicUpdates(): void {
    // Update every 2 seconds for real-time feel
    this.updateInterval = setInterval(async () => {
      await this.broadcastUpdates();
    }, 2000);
  }

  private async broadcastUpdates(): Promise<void> {
    for (const [channelId, subscribers] of this.channelSubscriptions) {
      if (subscribers.size === 0) continue;

      try {
        const status = await this.channelManager.getChannelStatus(channelId);
        const metrics = await this.streamManager.getOutputMetrics(channelId);
        const realtimeMetrics = await this.analyticsEngine.getRealtimeMetrics(channelId);

        const updateMessage: WebSocketMessage = {
          type: 'metrics_update',
          channelId,
          data: {
            status,
            metrics,
            realtimeMetrics,
            timestamp: new Date().toISOString()
          }
        };

        // Broadcast to all subscribers of this channel
        for (const ws of subscribers) {
          if (ws.readyState === WebSocket.OPEN) {
            this.sendMessage(ws, updateMessage);
          }
        }
      } catch (error) {
        logger.error(`Error broadcasting updates for channel ${channelId}:`, error);
      }
    }
  }

  // Public methods for external services to trigger updates
  public broadcastChannelStatusChange(channelId: string, status: any): void {
    const subscribers = this.channelSubscriptions.get(channelId);
    if (!subscribers) return;

    const message: WebSocketMessage = {
      type: 'status_update',
      channelId,
      data: {
        status,
        timestamp: new Date().toISOString()
      }
    };

    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, message);
      }
    }
  }

  public broadcastStreamRestart(channelId: string): void {
    const subscribers = this.channelSubscriptions.get(channelId);
    if (!subscribers) return;

    const message: WebSocketMessage = {
      type: 'stream_restart',
      channelId,
      data: {
        restarted: true,
        timestamp: new Date().toISOString()
      }
    };

    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, message);
      }
    }
  }

  private sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      data: { error, timestamp: new Date().toISOString() }
    });
  }

  public close(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.wss.close();
  }
}