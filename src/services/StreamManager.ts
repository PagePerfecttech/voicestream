import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { RTMPDestination, Resolution } from '../types/channel';
import { validateRTMPUrl } from '../utils/validation';
import { spawn } from 'child_process';

export interface HLSEndpoint {
  id: string;
  channelId: string;
  playlistUrl: string;
  segmentPath: string;
  isActive: boolean;
  createdAt: Date;
}

export interface OutputMetrics {
  channelId: string;
  hlsSegmentCount: number;
  lastSegmentTime: Date | null;
  averageBitrate: number;
  rtmpConnections: RTMPConnectionStatus[];
  totalBytesServed: number;
  viewerCount: number;
  uptime: number;
}

export interface RTMPConnectionStatus {
  destinationId: string;
  platform: string;
  connected: boolean;
  lastConnectTime: Date | null;
  errorCount: number;
  bytesTransferred: number;
}

export interface StreamConfig {
  channelId: string;
  resolution: Resolution;
  bitrate: number;
  hlsSegmentDuration: number;
  hlsPlaylistSize: number;
  outputPath: string;
}

export class StreamManager extends EventEmitter {
  private hlsEndpoints: Map<string, HLSEndpoint> = new Map();
  private rtmpConnections: Map<string, RTMPConnectionStatus[]> = new Map();
  private outputMetrics: Map<string, OutputMetrics> = new Map();
  private segmentWatchers: Map<string, fs.FSWatcher> = new Map();
  private readonly hlsBasePath = '/var/www/hls';
  private readonly nginxBaseUrl = process.env.NGINX_BASE_URL || 'http://localhost';

  constructor() {
    super();
    this.ensureHLSDirectory();
  }

  /**
   * Set up HLS output for a channel
   */
  async setupHLSOutput(channelId: string): Promise<HLSEndpoint> {
    logger.info(`Setting up HLS output for channel ${channelId}`);

    try {
      // Generate unique HLS endpoint
      const endpointId = uuidv4();
      const channelPath = path.join(this.hlsBasePath, channelId);
      const playlistUrl = `${this.nginxBaseUrl}/hls/${channelId}/playlist.m3u8`;

      // Ensure channel directory exists
      await fs.promises.mkdir(channelPath, { recursive: true });

      // Create HLS endpoint
      const hlsEndpoint: HLSEndpoint = {
        id: endpointId,
        channelId,
        playlistUrl,
        segmentPath: channelPath,
        isActive: false,
        createdAt: new Date()
      };

      // Store endpoint
      this.hlsEndpoints.set(channelId, hlsEndpoint);

      // Initialize output metrics
      this.initializeOutputMetrics(channelId);

      // Set up segment monitoring
      await this.setupSegmentMonitoring(channelId, channelPath);

      logger.info(`HLS output setup completed for channel ${channelId}`, {
        playlistUrl,
        segmentPath: channelPath
      });

      return hlsEndpoint;

    } catch (error: any) {
      logger.error(`Failed to setup HLS output for channel ${channelId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Set up RTMP output for multiple destinations
   */
  async setupRTMPOutput(channelId: string, destinations: RTMPDestination[]): Promise<void> {
    logger.info(`Setting up RTMP output for channel ${channelId}`, { 
      destinationCount: destinations.length 
    });

    try {
      const connectionStatuses: RTMPConnectionStatus[] = [];

      for (const destination of destinations) {
        if (!destination.enabled) {
          logger.info(`Skipping disabled RTMP destination ${destination.id}`);
          continue;
        }

        // Validate RTMP connection
        const isValid = await this.validateRTMPConnection(destination);
        
        const connectionStatus: RTMPConnectionStatus = {
          destinationId: destination.id,
          platform: destination.platform,
          connected: isValid,
          lastConnectTime: isValid ? new Date() : null,
          errorCount: 0,
          bytesTransferred: 0
        };

        connectionStatuses.push(connectionStatus);

        if (isValid) {
          logger.info(`RTMP destination validated successfully`, {
            destinationId: destination.id,
            platform: destination.platform
          });
        } else {
          logger.warn(`RTMP destination validation failed`, {
            destinationId: destination.id,
            platform: destination.platform,
            serverUrl: destination.serverUrl
          });
        }
      }

      // Store RTMP connection statuses
      this.rtmpConnections.set(channelId, connectionStatuses);

      // Update output metrics
      this.updateRTMPMetrics(channelId, connectionStatuses);

      logger.info(`RTMP output setup completed for channel ${channelId}`, {
        totalDestinations: destinations.length,
        validDestinations: connectionStatuses.filter(s => s.connected).length
      });

    } catch (error: any) {
      logger.error(`Failed to setup RTMP output for channel ${channelId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Validate RTMP connection to destination
   */
  async validateRTMPConnection(destination: RTMPDestination): Promise<boolean> {
    logger.debug(`Validating RTMP connection`, {
      destinationId: destination.id,
      platform: destination.platform,
      serverUrl: destination.serverUrl
    });

    try {
      // First validate URL format
      const urlError = validateRTMPUrl(destination.serverUrl);
      if (urlError) {
        logger.warn(`RTMP URL validation failed`, { error: urlError });
        return false;
      }

      // Validate platform-specific URL format
      const platformError = this.validatePlatformRTMPUrl(destination.serverUrl, destination.platform);
      if (platformError) {
        logger.warn(`Platform-specific RTMP URL validation failed`, { error: platformError });
        return false;
      }

      // Test connection with a minimal FFmpeg probe
      const fullRtmpUrl = `${destination.serverUrl}/${destination.streamKey}`;
      const testCommand = [
        'ffmpeg',
        '-f', 'lavfi',
        '-i', 'testsrc2=duration=2:size=320x240:rate=1',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-c:a', 'aac',
        '-f', 'flv',
        '-t', '2',
        '-rtmp_live', 'live',
        '-rtmp_conn', 'S:publish',
        '-rtmp_conn', 'S:live',
        fullRtmpUrl
      ];

      return new Promise((resolve) => {
        const testProcess = spawn(testCommand[0], testCommand.slice(1), {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let hasError = false;
        let connectionEstablished = false;

        testProcess.stderr?.on('data', (data) => {
          const output = data.toString();
          
          // Check for connection success indicators
          if (output.includes('Stream mapping:') || 
              output.includes('Press [q] to stop') ||
              output.includes('frame=') ||
              output.includes('connected')) {
            connectionEstablished = true;
          }
          
          // Check for connection failures
          if (output.includes('Connection refused') || 
              output.includes('Invalid data') ||
              output.includes('Server error') ||
              output.includes('Authentication failed') ||
              output.includes('Stream key') ||
              output.includes('403 Forbidden') ||
              output.includes('404 Not Found')) {
            hasError = true;
          }
        });

        testProcess.on('exit', (_code) => {
          // For RTMP test, we expect it to exit after the test duration
          // Success if connection was established and no critical errors
          resolve(connectionEstablished && !hasError);
        });

        testProcess.on('error', (error) => {
          logger.error(`RTMP test process error`, { error: error.message });
          resolve(false);
        });

        // Timeout after 15 seconds
        setTimeout(() => {
          testProcess.kill('SIGKILL');
          resolve(connectionEstablished && !hasError);
        }, 15000);
      });

    } catch (error: any) {
      logger.error(`RTMP connection validation error`, {
        destinationId: destination.id,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Validate platform-specific RTMP URL format
   */
  private validatePlatformRTMPUrl(url: string, platform: string): string | null {
    switch (platform) {
      case 'youtube':
        if (!url.includes('rtmp.youtube.com') && !url.includes('a.rtmp.youtube.com')) {
          return 'YouTube RTMP URL should use rtmp.youtube.com or a.rtmp.youtube.com';
        }
        if (!url.includes('/live2/')) {
          return 'YouTube RTMP URL should include /live2/ path';
        }
        break;
        
      case 'facebook':
        if (!url.includes('live-api') || !url.includes('facebook.com')) {
          return 'Facebook RTMP URL should use live-api.facebook.com';
        }
        if (!url.includes('/rtmp/')) {
          return 'Facebook RTMP URL should include /rtmp/ path';
        }
        break;
        
      case 'twitch':
        if (!url.includes('live.twitch.tv')) {
          return 'Twitch RTMP URL should use live.twitch.tv';
        }
        if (!url.includes('/live/')) {
          return 'Twitch RTMP URL should include /live/ path';
        }
        break;
        
      case 'custom':
        // No specific validation for custom platforms
        break;
        
      default:
        return `Unknown platform: ${platform}`;
    }
    
    return null;
  }

  /**
   * Get output metrics for a channel
   */
  async getOutputMetrics(channelId: string): Promise<OutputMetrics> {
    const metrics = this.outputMetrics.get(channelId);
    
    if (!metrics) {
      throw new Error(`No output metrics found for channel ${channelId}`);
    }

    // Update real-time metrics
    await this.updateHLSMetrics(channelId);

    return this.outputMetrics.get(channelId)!;
  }

  /**
   * Generate unique HLS URL for a channel
   */
  generateUniqueHLSUrl(channelId: string): string {
    const timestamp = Date.now();
    const uniqueId = uuidv4().substring(0, 8);
    return `${this.nginxBaseUrl}/hls/${channelId}/playlist.m3u8?t=${timestamp}&id=${uniqueId}`;
  }

  /**
   * Enforce single bitrate streaming
   */
  enforceSingleBitrate(config: StreamConfig): StreamConfig {
    logger.info(`Enforcing single bitrate for channel ${config.channelId}`, {
      resolution: config.resolution,
      bitrate: config.bitrate
    });

    // Ensure bitrate is within acceptable range for resolution
    const enforcedBitrate = this.getEnforcedBitrate(config.resolution, config.bitrate);
    
    if (enforcedBitrate !== config.bitrate) {
      logger.info(`Bitrate adjusted for single-bitrate enforcement`, {
        channelId: config.channelId,
        originalBitrate: config.bitrate,
        enforcedBitrate
      });
    }

    return {
      ...config,
      bitrate: enforcedBitrate
    };
  }

  /**
   * Start streaming for a channel
   */
  async startStreaming(channelId: string): Promise<void> {
    logger.info(`Starting streaming for channel ${channelId}`);

    const hlsEndpoint = this.hlsEndpoints.get(channelId);
    if (!hlsEndpoint) {
      throw new Error(`HLS endpoint not found for channel ${channelId}`);
    }

    // Mark endpoint as active
    hlsEndpoint.isActive = true;
    this.hlsEndpoints.set(channelId, hlsEndpoint);

    // Initialize metrics tracking
    const metrics = this.outputMetrics.get(channelId);
    if (metrics) {
      metrics.uptime = 0;
      this.outputMetrics.set(channelId, metrics);
    }

    // Start metrics collection
    this.startMetricsCollection(channelId);

    this.emit('streamingStarted', channelId);
  }

  /**
   * Stop streaming for a channel
   */
  async stopStreaming(channelId: string): Promise<void> {
    logger.info(`Stopping streaming for channel ${channelId}`);

    const hlsEndpoint = this.hlsEndpoints.get(channelId);
    if (hlsEndpoint) {
      hlsEndpoint.isActive = false;
      this.hlsEndpoints.set(channelId, hlsEndpoint);
    }

    // Stop segment monitoring
    this.stopSegmentMonitoring(channelId);

    // Clean up HLS segments
    await this.cleanupHLSSegments(channelId);

    // Update RTMP connections to disconnected
    const rtmpConnections = this.rtmpConnections.get(channelId);
    if (rtmpConnections) {
      rtmpConnections.forEach(conn => {
        conn.connected = false;
        conn.lastConnectTime = null;
      });
      this.rtmpConnections.set(channelId, rtmpConnections);
    }

    this.emit('streamingStopped', channelId);
  }

  /**
   * Get stream health status
   */
  async getStreamHealth(channelId: string): Promise<{
    hlsActive: boolean;
    rtmpActive: boolean;
    segmentCount: number;
    lastActivity: Date | null;
    errors: string[];
  }> {
    const hlsEndpoint = this.hlsEndpoints.get(channelId);
    const rtmpConnections = this.rtmpConnections.get(channelId) || [];
    const metrics = this.outputMetrics.get(channelId);

    const errors: string[] = [];

    // Check HLS health
    const hlsActive = hlsEndpoint?.isActive || false;
    if (!hlsActive) {
      errors.push('HLS endpoint not active');
    }

    // Check RTMP health
    const activeRTMPConnections = rtmpConnections.filter(conn => conn.connected);
    const rtmpActive = activeRTMPConnections.length > 0;
    
    // Add RTMP errors
    rtmpConnections.forEach(conn => {
      if (!conn.connected && conn.errorCount > 0) {
        errors.push(`RTMP ${conn.platform} connection failed`);
      }
    });

    return {
      hlsActive,
      rtmpActive,
      segmentCount: metrics?.hlsSegmentCount || 0,
      lastActivity: metrics?.lastSegmentTime || null,
      errors
    };
  }

  /**
   * Initialize output metrics for a channel
   */
  private initializeOutputMetrics(channelId: string): void {
    const metrics: OutputMetrics = {
      channelId,
      hlsSegmentCount: 0,
      lastSegmentTime: null,
      averageBitrate: 0,
      rtmpConnections: [],
      totalBytesServed: 0,
      viewerCount: 0,
      uptime: 0
    };

    this.outputMetrics.set(channelId, metrics);
  }

  /**
   * Set up segment monitoring for HLS
   */
  private async setupSegmentMonitoring(channelId: string, segmentPath: string): Promise<void> {
    try {
      // Stop any existing watcher
      this.stopSegmentMonitoring(channelId);

      const watcher = fs.watch(segmentPath, (_eventType, filename) => {
        if (filename && filename.endsWith('.ts')) {
          this.handleNewSegment(channelId, filename);
        } else if (filename === 'playlist.m3u8') {
          this.handlePlaylistUpdate(channelId);
        }
      });

      this.segmentWatchers.set(channelId, watcher);

      logger.debug(`Segment monitoring started for channel ${channelId}`, { segmentPath });

    } catch (error: any) {
      logger.error(`Failed to setup segment monitoring for channel ${channelId}`, { 
        error: error.message 
      });
    }
  }

  /**
   * Stop segment monitoring for a channel
   */
  private stopSegmentMonitoring(channelId: string): void {
    const watcher = this.segmentWatchers.get(channelId);
    if (watcher) {
      watcher.close();
      this.segmentWatchers.delete(channelId);
      logger.debug(`Segment monitoring stopped for channel ${channelId}`);
    }
  }

  /**
   * Handle new HLS segment creation
   */
  private handleNewSegment(channelId: string, filename: string): void {
    const metrics = this.outputMetrics.get(channelId);
    if (metrics) {
      metrics.hlsSegmentCount++;
      metrics.lastSegmentTime = new Date();
      this.outputMetrics.set(channelId, metrics);
    }

    logger.debug(`New HLS segment created for channel ${channelId}`, { filename });
    this.emit('newSegment', channelId, filename);
  }

  /**
   * Handle HLS playlist update
   */
  private handlePlaylistUpdate(channelId: string): void {
    logger.debug(`HLS playlist updated for channel ${channelId}`);
    this.emit('playlistUpdated', channelId);
  }

  /**
   * Update HLS metrics by analyzing segments
   */
  private async updateHLSMetrics(channelId: string): Promise<void> {
    try {
      const hlsEndpoint = this.hlsEndpoints.get(channelId);
      if (!hlsEndpoint) return;

      const segmentPath = hlsEndpoint.segmentPath;
      const files = await fs.promises.readdir(segmentPath);
      
      const segmentFiles = files.filter(file => file.endsWith('.ts'));
      const metrics = this.outputMetrics.get(channelId);
      
      if (metrics) {
        metrics.hlsSegmentCount = segmentFiles.length;
        
        // Calculate total bytes served
        let totalBytes = 0;
        for (const file of segmentFiles) {
          try {
            const filePath = path.join(segmentPath, file);
            const stats = await fs.promises.stat(filePath);
            totalBytes += stats.size;
          } catch (error) {
            // File might have been deleted, ignore
          }
        }
        
        metrics.totalBytesServed = totalBytes;
        this.outputMetrics.set(channelId, metrics);
      }

    } catch (error: any) {
      logger.error(`Failed to update HLS metrics for channel ${channelId}`, { 
        error: error.message 
      });
    }
  }

  /**
   * Update RTMP metrics
   */
  private updateRTMPMetrics(channelId: string, connections: RTMPConnectionStatus[]): void {
    const metrics = this.outputMetrics.get(channelId);
    if (metrics) {
      metrics.rtmpConnections = connections;
      this.outputMetrics.set(channelId, metrics);
    }
  }

  /**
   * Start metrics collection for a channel
   */
  private startMetricsCollection(channelId: string): void {
    const interval = setInterval(async () => {
      try {
        await this.updateHLSMetrics(channelId);
        
        // Update uptime
        const metrics = this.outputMetrics.get(channelId);
        if (metrics) {
          metrics.uptime += 30; // 30 second intervals
          this.outputMetrics.set(channelId, metrics);
        }

      } catch (error: any) {
        logger.error(`Metrics collection error for channel ${channelId}`, { 
          error: error.message 
        });
      }
    }, 30000); // Every 30 seconds

    // Store interval for cleanup
    setTimeout(() => clearInterval(interval), 0);
  }

  /**
   * Clean up HLS segments for a channel
   */
  private async cleanupHLSSegments(channelId: string): Promise<void> {
    try {
      const hlsEndpoint = this.hlsEndpoints.get(channelId);
      if (!hlsEndpoint) return;

      const segmentPath = hlsEndpoint.segmentPath;
      const files = await fs.promises.readdir(segmentPath);
      
      for (const file of files) {
        if (file.endsWith('.ts') || file.endsWith('.m3u8')) {
          const filePath = path.join(segmentPath, file);
          await fs.promises.unlink(filePath);
        }
      }

      logger.info(`HLS segments cleaned up for channel ${channelId}`);

    } catch (error: any) {
      logger.error(`Failed to cleanup HLS segments for channel ${channelId}`, { 
        error: error.message 
      });
    }
  }

  /**
   * Get enforced bitrate for single-bitrate streaming
   */
  private getEnforcedBitrate(resolution: Resolution, requestedBitrate: number): number {
    // Define bitrate ranges for each resolution
    const bitrateRanges = {
      'SD': { min: 500, max: 1500, default: 1000 },
      'HD': { min: 1000, max: 3000, default: 2000 },
      'FHD': { min: 2000, max: 6000, default: 4000 }
    };

    const range = bitrateRanges[resolution];
    
    // Clamp bitrate to acceptable range
    if (requestedBitrate < range.min) {
      return range.min;
    } else if (requestedBitrate > range.max) {
      return range.max;
    }
    
    return requestedBitrate;
  }

  /**
   * Ensure HLS base directory exists
   */
  private async ensureHLSDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.hlsBasePath, { recursive: true });
      logger.info(`HLS base directory ensured at ${this.hlsBasePath}`);
    } catch (error: any) {
      logger.error(`Failed to create HLS base directory`, { 
        path: this.hlsBasePath,
        error: error.message 
      });
      throw error;
    }
  }
}