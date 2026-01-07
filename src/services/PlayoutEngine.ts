import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { StreamProcessModel } from '../models/StreamProcess';
// import { ChannelModel } from '../models/Channel';
import { ProcessStatus } from '../types/channel';
import { logger } from '../utils/logger';
import { FallbackVideoManager } from '../utils/fallback';
import * as path from 'path';
import * as fs from 'fs';

export interface FFmpegConfig {
  inputSource: string;
  outputTargets: string[];
  resolution: string;
  bitrate: number;
  hlsSegmentDuration: number;
  hlsPlaylistSize: number;
}

export interface StreamHealth {
  status: ProcessStatus;
  uptime: number;
  lastSegmentTime: Date | null;
  restartCount: number;
  currentBitrate: number;
  errorCount: number;
}

export class PlayoutEngine extends EventEmitter {
  private processes: Map<string, ChildProcess> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private restartAttempts: Map<string, number> = new Map();
  private readonly baseRestartDelay = 1000; // 1 second base delay
  private readonly maxRestartDelay = 30000; // 30 seconds max delay
  private readonly heartbeatInterval = 5000; // 5 seconds

  constructor() {
    super();
    this.setupProcessCleanup();
  }

  /**
   * Initialize a stream for a channel
   */
  async initializeStream(channelId: string, config: FFmpegConfig): Promise<void> {
    logger.info(`Initializing stream for channel ${channelId}`, { config });

    try {
      // Get or create stream process record
      let streamProcess = await StreamProcessModel.findByChannelId(channelId);
      
      if (!streamProcess) {
        streamProcess = await StreamProcessModel.create(
          channelId,
          config.inputSource,
          config.outputTargets
        );
      }

      // Update status to STARTING
      await StreamProcessModel.updateStatus(streamProcess.id, 'STARTING');

      // Ensure fallback video exists
      const fallbackPath = await FallbackVideoManager.getFallbackVideoPath(config.inputSource);
      config.inputSource = fallbackPath;

      // Generate FFmpeg command
      const ffmpegCommand = this.generateFFmpegCommand(config);
      
      // Ensure output directories exist
      await this.ensureOutputDirectories(config.outputTargets);

      // Spawn FFmpeg process
      const ffmpegProcess = this.spawnFFmpegProcess(ffmpegCommand, channelId);
      
      // Store process reference
      this.processes.set(channelId, ffmpegProcess);
      
      // Set up process monitoring
      this.setupProcessMonitoring(channelId, streamProcess.id, ffmpegProcess);
      
      // Start heartbeat monitoring
      this.startHeartbeatMonitoring(channelId, streamProcess.id);

      // Update stream process with PID
      await StreamProcessModel.updateStatus(streamProcess.id, 'RUNNING', ffmpegProcess.pid);
      
      logger.info(`Stream initialized successfully for channel ${channelId}`, { 
        processId: streamProcess.id, 
        pid: ffmpegProcess.pid 
      });

    } catch (error: any) {
      logger.error(`Failed to initialize stream for channel ${channelId}`, { error: error.message });
      
      // Update channel status to ERROR
      // await ChannelModel.updateStatus(channelId, 'ERROR');
      
      throw error;
    }
  }

  /**
   * Restart a stream with exponential backoff
   */
  async restartStream(channelId: string): Promise<void> {
    logger.info(`Restarting stream for channel ${channelId}`);

    try {
      // const channel = await ChannelModel.findById(channelId);
      const streamProcess = await StreamProcessModel.findByChannelId(channelId);

      if (!streamProcess) {
        throw new Error('Stream process not found');
      }

      // Increment restart attempts
      const currentAttempts = this.restartAttempts.get(channelId) || 0;
      this.restartAttempts.set(channelId, currentAttempts + 1);

      // Check if we've exceeded max restarts
      if (currentAttempts >= streamProcess.maxRestarts) {
        logger.error(`Max restart attempts exceeded for channel ${channelId}`, { 
          attempts: currentAttempts,
          maxRestarts: streamProcess.maxRestarts 
        });
        
        // await ChannelModel.updateStatus(channelId, 'ERROR');
        await StreamProcessModel.updateStatus(streamProcess.id, 'ERROR');
        
        this.emit('maxRestartsExceeded', channelId);
        return;
      }

      // Calculate exponential backoff delay
      const delay = this.calculateRestartDelay(currentAttempts);
      
      logger.info(`Waiting ${delay}ms before restart attempt ${currentAttempts + 1} for channel ${channelId}`);
      
      // Wait for backoff delay
      await new Promise(resolve => setTimeout(resolve, delay));

      // Terminate existing process if running
      await this.terminateStream(channelId);

      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Reinitialize stream with existing configuration
      const config: FFmpegConfig = {
        inputSource: streamProcess.inputSource,
        outputTargets: streamProcess.outputTargets,
        resolution: '1280x720', // Default HD resolution
        bitrate: 2000, // Default bitrate
        hlsSegmentDuration: 6,
        hlsPlaylistSize: 10
      };

      await this.initializeStream(channelId, config);

      // Increment restart count in database
      // await ChannelModel.incrementRestartCount(channelId);

      logger.info(`Stream restarted successfully for channel ${channelId}`, { 
        attempt: currentAttempts + 1 
      });

    } catch (error: any) {
      logger.error(`Failed to restart stream for channel ${channelId}`, { error: error.message });
      
      // Update status to ERROR
      // await ChannelModel.updateStatus(channelId, 'ERROR');
      
      throw error;
    }
  }

  /**
   * Terminate a stream gracefully
   */
  async terminateStream(channelId: string): Promise<void> {
    logger.info(`Terminating stream for channel ${channelId}`);

    try {
      const streamProcess = await StreamProcessModel.findByChannelId(channelId);
      
      if (streamProcess) {
        await StreamProcessModel.updateStatus(streamProcess.id, 'STOPPING');
      }

      // Stop heartbeat monitoring
      this.stopHeartbeatMonitoring(channelId);

      // Get and terminate FFmpeg process
      const ffmpegProcess = this.processes.get(channelId);
      
      if (ffmpegProcess && !ffmpegProcess.killed) {
        // Send SIGTERM for graceful shutdown
        ffmpegProcess.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            // Force kill if not terminated gracefully
            if (!ffmpegProcess.killed) {
              logger.warn(`Force killing FFmpeg process for channel ${channelId}`);
              ffmpegProcess.kill('SIGKILL');
            }
            resolve(void 0);
          }, 5000);

          ffmpegProcess.on('exit', () => {
            clearTimeout(timeout);
            resolve(void 0);
          });
        });
      }

      // Clean up process reference
      this.processes.delete(channelId);
      this.restartAttempts.delete(channelId);

      // Update stream process status
      if (streamProcess) {
        await StreamProcessModel.updateStatus(streamProcess.id, 'IDLE');
      }

      logger.info(`Stream terminated successfully for channel ${channelId}`);

    } catch (error: any) {
      logger.error(`Failed to terminate stream for channel ${channelId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Get stream health information
   */
  async getStreamHealth(channelId: string): Promise<StreamHealth> {
    const streamProcess = await StreamProcessModel.findByChannelId(channelId);
    
    if (!streamProcess) {
      throw new Error('Stream process not found');
    }

    const uptime = streamProcess.startTime 
      ? Math.floor((Date.now() - streamProcess.startTime.getTime()) / 1000)
      : 0;

    return {
      status: streamProcess.status,
      uptime,
      lastSegmentTime: streamProcess.lastHeartbeat,
      restartCount: this.restartAttempts.get(channelId) || 0,
      currentBitrate: 0, // Would be calculated from actual stream analysis
      errorCount: streamProcess.errorCount
    };
  }

  /**
   * Handle stream failure and attempt recovery
   */
  async handleStreamFailure(channelId: string, error: Error): Promise<void> {
    logger.error(`Stream failure detected for channel ${channelId}`, { error: error.message });

    try {
      const streamProcess = await StreamProcessModel.findByChannelId(channelId);
      
      if (streamProcess) {
        await StreamProcessModel.incrementErrorCount(streamProcess.id);
      }

      // Emit failure event
      this.emit('streamFailure', channelId, error);

      // Attempt automatic restart
      await this.restartStream(channelId);

    } catch (restartError: any) {
      logger.error(`Failed to handle stream failure for channel ${channelId}`, { 
        originalError: error.message,
        restartError: restartError.message 
      });
      
      // Update channel to ERROR state
      // await ChannelModel.updateStatus(channelId, 'ERROR');
    }
  }

  /**
   * Generate FFmpeg command based on configuration
   */
  private generateFFmpegCommand(config: FFmpegConfig): string[] {
    const command = [
      'ffmpeg',
      '-y', // Overwrite output files
      '-re', // Read input at native frame rate
      '-stream_loop', '-1', // Loop input indefinitely
      '-i', config.inputSource,
      
      // Video encoding settings
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-tune', 'zerolatency',
      '-profile:v', 'baseline',
      '-level', '3.0',
      '-pix_fmt', 'yuv420p',
      '-r', '25', // Frame rate
      '-g', '50', // GOP size (2 seconds at 25fps)
      '-keyint_min', '25',
      '-sc_threshold', '0',
      
      // Audio encoding settings
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-ac', '2',
      
      // Video resolution and bitrate
      '-s', config.resolution,
      '-b:v', `${config.bitrate}k`,
      '-maxrate', `${Math.floor(config.bitrate * 1.2)}k`,
      '-bufsize', `${Math.floor(config.bitrate * 2)}k`,
    ];

    // Separate HLS and RTMP outputs for proper handling
    const hlsOutputs = config.outputTargets.filter(target => target.startsWith('hls:'));
    const rtmpOutputs = config.outputTargets.filter(target => target.startsWith('rtmp://') || target.startsWith('rtmps://'));

    // Add HLS outputs
    hlsOutputs.forEach(target => {
      const hlsPath = target.replace('hls:', '');
      command.push(
        '-f', 'hls',
        '-hls_time', config.hlsSegmentDuration.toString(),
        '-hls_list_size', config.hlsPlaylistSize.toString(),
        '-hls_flags', 'delete_segments+append_list',
        '-hls_segment_filename', path.join(path.dirname(hlsPath), 'segment_%03d.ts'),
        hlsPath
      );
    });

    // Add RTMP outputs with enhanced error handling and recovery
    rtmpOutputs.forEach(target => {
      command.push(
        '-f', 'flv',
        '-flvflags', 'no_duration_filesize',
        '-rtmp_live', 'live',
        '-rtmp_conn', 'S:publish',
        '-rtmp_conn', 'S:live',
        '-rtmp_buffer', '1000',
        '-rtmp_flush_interval', '10',
        target
      );
    });

    // Add logging and error handling
    command.push(
      '-loglevel', 'info',
      '-stats',
      '-stats_period', '5'
    );

    return command;
  }

  /**
   * Spawn FFmpeg process with proper error handling
   */
  private spawnFFmpegProcess(command: string[], channelId: string): ChildProcess {
    const [executable, ...args] = command;
    
    logger.info(`Spawning FFmpeg process for channel ${channelId}`, { command: command.join(' ') });

    const process = spawn(executable, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false
    });

    // Handle process errors
    process.on('error', (error) => {
      logger.error(`FFmpeg process error for channel ${channelId}`, { error: error.message });
      this.handleStreamFailure(channelId, error);
    });

    return process;
  }

  /**
   * Set up process monitoring for FFmpeg
   */
  private setupProcessMonitoring(channelId: string, processId: string, ffmpegProcess: ChildProcess): void {
    // Monitor stdout for stream information
    ffmpegProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      logger.debug(`FFmpeg stdout for channel ${channelId}`, { output });
      
      // Parse output for stream health metrics
      this.parseFFmpegOutput(channelId, processId, output);
    });

    // Monitor stderr for errors and statistics
    ffmpegProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      logger.debug(`FFmpeg stderr for channel ${channelId}`, { output });
      
      // Parse output for errors and statistics
      this.parseFFmpegOutput(channelId, processId, output);
    });

    // Handle process exit
    ffmpegProcess.on('exit', (code, signal) => {
      logger.info(`FFmpeg process exited for channel ${channelId}`, { code, signal });
      
      if (code !== 0 && code !== null) {
        const error = new Error(`FFmpeg process exited with code ${code}`);
        this.handleStreamFailure(channelId, error);
      }
    });

    // Handle process close
    ffmpegProcess.on('close', (code, signal) => {
      logger.info(`FFmpeg process closed for channel ${channelId}`, { code, signal });
      this.processes.delete(channelId);
    });
  }

  /**
   * Parse FFmpeg output for health metrics
   */
  private parseFFmpegOutput(channelId: string, processId: string, output: string): void {
    // Parse for bitrate information
    const bitrateMatch = output.match(/bitrate=\s*([0-9.]+)kbits\/s/);
    if (bitrateMatch) {
      const bitrate = parseFloat(bitrateMatch[1]);
      // Update health metrics in database
      StreamProcessModel.updateHealthMetrics(processId, { networkBandwidth: bitrate });
    }

    // Parse for RTMP connection errors
    if (output.includes('RTMP') && (output.includes('error') || output.includes('failed') || output.includes('refused'))) {
      logger.warn(`RTMP connection error detected for channel ${channelId}`, { output });
      this.handleRTMPConnectionFailure(channelId, output);
    }

    // Parse for general errors
    if (output.includes('error') || output.includes('Error') || output.includes('ERROR')) {
      logger.warn(`FFmpeg error detected for channel ${channelId}`, { output });
      StreamProcessModel.incrementErrorCount(processId);
    }

    // Parse for successful segment creation (indicates healthy streaming)
    if (output.includes('.ts') && output.includes('Opening')) {
      // Update last heartbeat when segments are being created
      StreamProcessModel.updateHeartbeat(processId);
    }

    // Parse for RTMP connection success
    if (output.includes('RTMP') && output.includes('connected')) {
      logger.info(`RTMP connection established for channel ${channelId}`, { output });
      this.emit('rtmpConnected', channelId);
    }
  }

  /**
   * Handle RTMP connection failure
   */
  private async handleRTMPConnectionFailure(channelId: string, errorOutput: string): Promise<void> {
    logger.warn(`Handling RTMP connection failure for channel ${channelId}`, { errorOutput });

    try {
      // Emit RTMP failure event
      this.emit('rtmpConnectionFailure', channelId, errorOutput);

      // Check if this is a critical failure that should stop the stream
      const isCriticalFailure = errorOutput.includes('Connection refused') || 
                               errorOutput.includes('Invalid stream key') ||
                               errorOutput.includes('Authentication failed');

      if (isCriticalFailure) {
        logger.error(`Critical RTMP failure for channel ${channelId}, stopping stream`, { errorOutput });
        await this.terminateStream(channelId);
        // await ChannelModel.updateStatus(channelId, 'ERROR');
      } else {
        // For non-critical failures, continue HLS streaming but log RTMP issue
        logger.warn(`Non-critical RTMP failure for channel ${channelId}, continuing HLS stream`, { errorOutput });
      }

    } catch (error: any) {
      logger.error(`Error handling RTMP connection failure for channel ${channelId}`, { error: error.message });
    }
  }

  /**
   * Start heartbeat monitoring for a channel
   */
  private startHeartbeatMonitoring(channelId: string, processId: string): void {
    // Clear any existing interval
    this.stopHeartbeatMonitoring(channelId);

    const interval = setInterval(async () => {
      try {
        const streamProcess = await StreamProcessModel.findById(processId);
        
        if (!streamProcess || streamProcess.status !== 'RUNNING') {
          this.stopHeartbeatMonitoring(channelId);
          return;
        }

        // Check if heartbeat is stale
        const now = new Date();
        const lastHeartbeat = streamProcess.lastHeartbeat;
        
        if (lastHeartbeat) {
          const timeSinceHeartbeat = now.getTime() - lastHeartbeat.getTime();
          
          if (timeSinceHeartbeat > this.heartbeatInterval * 2) {
            logger.warn(`Stale heartbeat detected for channel ${channelId}`, { 
              timeSinceHeartbeat,
              lastHeartbeat 
            });
            
            // Consider this a failure and attempt restart
            const error = new Error('Heartbeat timeout');
            await this.handleStreamFailure(channelId, error);
          }
        }

        // Update heartbeat
        await StreamProcessModel.updateHeartbeat(processId);

      } catch (error: any) {
        logger.error(`Heartbeat monitoring error for channel ${channelId}`, { error: error.message });
      }
    }, this.heartbeatInterval);

    this.heartbeatIntervals.set(channelId, interval);
  }

  /**
   * Stop heartbeat monitoring for a channel
   */
  private stopHeartbeatMonitoring(channelId: string): void {
    const interval = this.heartbeatIntervals.get(channelId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(channelId);
    }
  }

  /**
   * Calculate restart delay with exponential backoff
   */
  private calculateRestartDelay(attempt: number): number {
    const delay = Math.min(
      this.baseRestartDelay * Math.pow(2, attempt),
      this.maxRestartDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    
    return Math.floor(delay + jitter);
  }

  /**
   * Ensure output directories exist
   */
  private async ensureOutputDirectories(outputTargets: string[]): Promise<void> {
    for (const target of outputTargets) {
      if (target.startsWith('hls:')) {
        const hlsPath = target.replace('hls:', '');
        const dir = path.dirname(hlsPath);
        
        try {
          await fs.promises.mkdir(dir, { recursive: true });
        } catch (error: any) {
          logger.error(`Failed to create HLS directory ${dir}`, { error: error.message });
          throw error;
        }
      }
    }
  }

  /**
   * Set up process cleanup on application exit
   */
  private setupProcessCleanup(): void {
    const cleanup = async () => {
      logger.info('Cleaning up FFmpeg processes...');
      
      const channelIds = Array.from(this.processes.keys());
      
      for (const channelId of channelIds) {
        try {
          await this.terminateStream(channelId);
        } catch (error: any) {
          logger.error(`Error cleaning up stream for channel ${channelId}`, { error: error.message });
        }
      }
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  }
}