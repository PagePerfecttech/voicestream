import { logger } from '../utils/logger';

export interface PreviewPlayerConfig {
  channelId: string;
  hlsUrl: string;
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
}

export interface StreamMetrics {
  isLive: boolean;
  currentTime: number;
  duration: number;
  buffered: any | null;
  videoWidth: number;
  videoHeight: number;
  bitrate: number;
  fps: number;
  droppedFrames: number;
  loadedSegments: number;
}

export interface PlayerEvents {
  onLoadStart?: () => void;
  onLoadSuccess?: () => void;
  onLoadError?: (error: any) => void;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onError?: (error: any) => void;
  onMetricsUpdate?: (metrics: StreamMetrics) => void;
}

export class PreviewPlayerService {
  private activeStreams: Map<string, PreviewPlayerConfig> = new Map();
  private streamMetrics: Map<string, StreamMetrics> = new Map();

  /**
   * Register a new HLS stream for preview
   */
  public registerStream(config: PreviewPlayerConfig): void {
    this.activeStreams.set(config.channelId, config);
    logger.info(`Registered preview stream for channel: ${config.channelId}`);
  }

  /**
   * Unregister an HLS stream
   */
  public unregisterStream(channelId: string): void {
    this.activeStreams.delete(channelId);
    this.streamMetrics.delete(channelId);
    logger.info(`Unregistered preview stream for channel: ${channelId}`);
  }

  /**
   * Get stream configuration
   */
  public getStreamConfig(channelId: string): PreviewPlayerConfig | undefined {
    return this.activeStreams.get(channelId);
  }

  /**
   * Update stream metrics (called by client-side player)
   */
  public updateStreamMetrics(channelId: string, metrics: Partial<StreamMetrics>): void {
    const existing = this.streamMetrics.get(channelId) || this.getDefaultMetrics();
    this.streamMetrics.set(channelId, { ...existing, ...metrics });
  }

  /**
   * Get current stream metrics
   */
  public getStreamMetrics(channelId: string): StreamMetrics | undefined {
    return this.streamMetrics.get(channelId);
  }

  /**
   * Generate client-side HLS.js integration code
   */
  public generateClientCode(channelId: string): string {
    const config = this.activeStreams.get(channelId);
    if (!config) {
      throw new Error(`No stream configuration found for channel: ${channelId}`);
    }

    return `
// HLS.js Preview Player Integration for Channel: ${channelId}
class ChannelPreviewPlayer {
  constructor(videoElementId, websocketUrl) {
    this.videoElement = document.getElementById(videoElementId);
    this.channelId = '${channelId}';
    this.hlsUrl = '${config.hlsUrl}';
    this.websocket = null;
    this.hls = null;
    this.metrics = {};
    this.isConnected = false;
    
    this.init();
  }

  init() {
    this.setupWebSocket();
    this.setupHLS();
    this.setupEventListeners();
  }

  setupWebSocket() {
    this.websocket = new WebSocket(websocketUrl || 'ws://localhost:3000/ws');
    
    this.websocket.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.subscribeToChannel();
    };

    this.websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleWebSocketMessage(message);
    };

    this.websocket.onclose = () => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
      // Attempt reconnection after 3 seconds
      setTimeout(() => this.setupWebSocket(), 3000);
    };

    this.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  setupHLS() {
    if (Hls.isSupported()) {
      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });

      this.hls.loadSource(this.hlsUrl);
      this.hls.attachMedia(this.videoElement);

      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed');
        if (${config.autoplay || false}) {
          this.videoElement.play().catch(console.error);
        }
      });

      this.hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', data);
        if (data.fatal) {
          this.handleFatalError(data);
        }
      });

      this.hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
        this.updateMetrics();
      });

    } else if (this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      this.videoElement.src = this.hlsUrl;
    } else {
      console.error('HLS not supported in this browser');
    }
  }

  setupEventListeners() {
    this.videoElement.addEventListener('loadstart', () => {
      this.updateStatus('loading');
    });

    this.videoElement.addEventListener('canplay', () => {
      this.updateStatus('ready');
    });

    this.videoElement.addEventListener('playing', () => {
      this.updateStatus('playing');
    });

    this.videoElement.addEventListener('pause', () => {
      this.updateStatus('paused');
    });

    this.videoElement.addEventListener('error', (e) => {
      console.error('Video error:', e);
      this.updateStatus('error');
    });

    // Update metrics every second
    setInterval(() => this.updateMetrics(), 1000);
  }

  subscribeToChannel() {
    if (this.websocket && this.isConnected) {
      this.websocket.send(JSON.stringify({
        type: 'subscribe',
        channelId: this.channelId
      }));
    }
  }

  handleWebSocketMessage(message) {
    switch (message.type) {
      case 'status_update':
        this.handleStatusUpdate(message.data);
        break;
      case 'metrics_update':
        this.handleMetricsUpdate(message.data);
        break;
      case 'stream_restart':
        this.handleStreamRestart();
        break;
      case 'error':
        console.error('Server error:', message.data.error);
        break;
    }
  }

  handleStatusUpdate(data) {
    const statusElement = document.getElementById('channel-status');
    if (statusElement) {
      statusElement.textContent = data.status?.status || 'Unknown';
      statusElement.className = \`status \${(data.status?.status || '').toLowerCase()}\`;
    }

    // Update metrics display
    this.displayMetrics(data.realtimeMetrics);
  }

  handleMetricsUpdate(data) {
    this.displayMetrics(data.realtimeMetrics);
  }

  handleStreamRestart() {
    console.log('Stream restarted, refreshing player...');
    this.refreshStream();
  }

  handleFatalError(data) {
    console.error('Fatal HLS error, attempting recovery:', data);
    
    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        this.hls.startLoad();
        break;
      case Hls.ErrorTypes.MEDIA_ERROR:
        this.hls.recoverMediaError();
        break;
      default:
        // Try to refresh the stream
        setTimeout(() => this.refreshStream(), 2000);
        break;
    }
  }

  refreshStream() {
    if (this.hls) {
      this.hls.destroy();
    }
    setTimeout(() => this.setupHLS(), 1000);
  }

  updateMetrics() {
    if (!this.videoElement) return;

    this.metrics = {
      isLive: !this.videoElement.paused && this.videoElement.currentTime > 0,
      currentTime: this.videoElement.currentTime,
      duration: this.videoElement.duration || 0,
      buffered: this.videoElement.buffered,
      videoWidth: this.videoElement.videoWidth,
      videoHeight: this.videoElement.videoHeight,
      bitrate: this.hls ? this.hls.levels[this.hls.currentLevel]?.bitrate || 0 : 0,
      fps: 0, // Would need additional calculation
      droppedFrames: this.videoElement.webkitDroppedFrameCount || 0,
      loadedSegments: this.hls ? this.hls.media?.buffered?.length || 0 : 0
    };
  }

  displayMetrics(realtimeMetrics) {
    const metricsElement = document.getElementById('stream-metrics');
    if (metricsElement && realtimeMetrics) {
      metricsElement.innerHTML = \`
        <div class="metric">
          <span class="label">Viewers:</span>
          <span class="value">\${realtimeMetrics.currentViewers || 0}</span>
        </div>
        <div class="metric">
          <span class="label">Peak Viewers:</span>
          <span class="value">\${realtimeMetrics.peakViewers || 0}</span>
        </div>
        <div class="metric">
          <span class="label">Avg Watch Time:</span>
          <span class="value">\${Math.round(realtimeMetrics.averageWatchTime || 0)}s</span>
        </div>
        <div class="metric">
          <span class="label">Resolution:</span>
          <span class="value">\${this.metrics.videoWidth}x\${this.metrics.videoHeight}</span>
        </div>
        <div class="metric">
          <span class="label">Bitrate:</span>
          <span class="value">\${Math.round(this.metrics.bitrate / 1000)}kbps</span>
        </div>
      \`;
    }
  }

  updateStatus(status) {
    const statusElement = document.getElementById('player-status');
    if (statusElement) {
      statusElement.textContent = status;
      statusElement.className = \`player-status \${status}\`;
    }
  }

  // Control methods
  play() {
    return this.videoElement.play();
  }

  pause() {
    this.videoElement.pause();
  }

  restart() {
    this.refreshStream();
  }

  destroy() {
    if (this.hls) {
      this.hls.destroy();
    }
    if (this.websocket) {
      this.websocket.close();
    }
  }
}

// Auto-initialize if elements exist
document.addEventListener('DOMContentLoaded', () => {
  const videoElement = document.getElementById('preview-video');
  if (videoElement) {
    window.channelPlayer = new ChannelPreviewPlayer('preview-video', 'ws://localhost:3000/ws');
  }
});
`;
  }

  /**
   * Generate HTML template for preview interface
   */
  public generatePreviewHTML(channelId: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Channel Preview - ${channelId}</title>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .preview-container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .video-container {
            position: relative;
            background: #000;
        }
        #preview-video {
            width: 100%;
            height: auto;
            display: block;
        }
        .controls-panel {
            padding: 20px;
            border-bottom: 1px solid #eee;
        }
        .status-panel {
            display: flex;
            gap: 20px;
            align-items: center;
            margin-bottom: 15px;
        }
        .status {
            padding: 5px 12px;
            border-radius: 20px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 12px;
        }
        .status.live { background: #4CAF50; color: white; }
        .status.starting { background: #FF9800; color: white; }
        .status.stopped { background: #f44336; color: white; }
        .status.error { background: #f44336; color: white; }
        .metrics-panel {
            padding: 20px;
            background: #f9f9f9;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            padding: 10px;
            background: white;
            border-radius: 4px;
            border-left: 4px solid #2196F3;
        }
        .metric .label {
            font-weight: bold;
            color: #666;
        }
        .metric .value {
            color: #333;
        }
        .control-buttons {
            display: flex;
            gap: 10px;
        }
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            transition: background-color 0.3s;
        }
        .btn-primary { background: #2196F3; color: white; }
        .btn-primary:hover { background: #1976D2; }
        .btn-success { background: #4CAF50; color: white; }
        .btn-success:hover { background: #45a049; }
        .btn-warning { background: #FF9800; color: white; }
        .btn-warning:hover { background: #F57C00; }
        .btn-danger { background: #f44336; color: white; }
        .btn-danger:hover { background: #d32f2f; }
        .connection-status {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px;
            border-radius: 4px;
            font-weight: bold;
        }
        .connection-status.connected { background: #4CAF50; color: white; }
        .connection-status.disconnected { background: #f44336; color: white; }
    </style>
</head>
<body>
    <div class="preview-container">
        <div class="video-container">
            <video id="preview-video" controls muted></video>
        </div>
        
        <div class="controls-panel">
            <div class="status-panel">
                <div>Channel Status: <span id="channel-status" class="status">Loading...</span></div>
                <div>Player Status: <span id="player-status" class="player-status">Initializing...</span></div>
            </div>
            
            <div class="control-buttons">
                <button class="btn btn-success" onclick="startChannel()">Start Channel</button>
                <button class="btn btn-danger" onclick="stopChannel()">Stop Channel</button>
                <button class="btn btn-warning" onclick="restartChannel()">Restart Channel</button>
                <button class="btn btn-primary" onclick="refreshPlayer()">Refresh Player</button>
            </div>
        </div>
        
        <div class="metrics-panel">
            <h3>Real-time Metrics</h3>
            <div id="stream-metrics" class="metrics-grid">
                <div class="metric">
                    <span class="label">Loading...</span>
                    <span class="value">Please wait</span>
                </div>
            </div>
        </div>
    </div>
    
    <div id="connection-status" class="connection-status disconnected">Connecting...</div>

    <script>
        ${this.generateClientCode(channelId)}
        
        // Control functions
        async function startChannel() {
            try {
                const response = await fetch('/api/channels/${channelId}/start', { method: 'POST' });
                const result = await response.json();
                if (result.success) {
                    console.log('Channel start initiated');
                } else {
                    console.error('Failed to start channel:', result.error);
                }
            } catch (error) {
                console.error('Error starting channel:', error);
            }
        }
        
        async function stopChannel() {
            try {
                const response = await fetch('/api/channels/${channelId}/stop', { method: 'POST' });
                const result = await response.json();
                if (result.success) {
                    console.log('Channel stopped');
                } else {
                    console.error('Failed to stop channel:', result.error);
                }
            } catch (error) {
                console.error('Error stopping channel:', error);
            }
        }
        
        async function restartChannel() {
            try {
                const response = await fetch('/api/channels/${channelId}/restart', { method: 'POST' });
                const result = await response.json();
                if (result.success) {
                    console.log('Channel restart initiated');
                } else {
                    console.error('Failed to restart channel:', result.error);
                }
            } catch (error) {
                console.error('Error restarting channel:', error);
            }
        }
        
        function refreshPlayer() {
            if (window.channelPlayer) {
                window.channelPlayer.restart();
            }
        }
        
        // Update connection status
        function updateConnectionStatus(connected) {
            const statusElement = document.getElementById('connection-status');
            if (statusElement) {
                statusElement.textContent = connected ? 'Connected' : 'Disconnected';
                statusElement.className = \`connection-status \${connected ? 'connected' : 'disconnected'}\`;
            }
        }
    </script>
</body>
</html>`;
  }

  private getDefaultMetrics(): StreamMetrics {
    return {
      isLive: false,
      currentTime: 0,
      duration: 0,
      buffered: null,
      videoWidth: 0,
      videoHeight: 0,
      bitrate: 0,
      fps: 0,
      droppedFrames: 0,
      loadedSegments: 0
    };
  }
}