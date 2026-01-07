import { Server } from 'http';
import { WebSocket } from 'ws';
import { RealtimeWebSocketServer } from '../../services/WebSocketServer';

describe('WebSocketServer', () => {
  let server: Server;
  let wsServer: RealtimeWebSocketServer;

  beforeEach(() => {
    server = new Server();
    wsServer = new RealtimeWebSocketServer(server);
  });

  afterEach(() => {
    if (wsServer) {
      wsServer.close();
    }
    if (server) {
      server.close();
    }
  });

  it('should initialize WebSocket server', () => {
    expect(wsServer).toBeDefined();
  });

  it('should broadcast channel status changes', () => {
    const channelId = 'test-channel-123';
    const status = { status: 'LIVE', timestamp: new Date().toISOString() };
    
    // This should not throw an error
    expect(() => {
      wsServer.broadcastChannelStatusChange(channelId, status);
    }).not.toThrow();
  });

  it('should broadcast stream restart notifications', () => {
    const channelId = 'test-channel-123';
    
    // This should not throw an error
    expect(() => {
      wsServer.broadcastStreamRestart(channelId);
    }).not.toThrow();
  });
});