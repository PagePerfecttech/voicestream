import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { StreamProcess, ProcessStatus } from '../types/channel';

export class StreamProcessModel {
  /**
   * Create a new stream process
   */
  static async create(channelId: string, inputSource: string, outputTargets: string[]): Promise<StreamProcess> {
    const processId = uuidv4();
    
    const processData = {
      id: processId,
      channel_id: channelId,
      ffmpeg_pid: null,
      status: 'IDLE' as ProcessStatus,
      start_time: null,
      last_heartbeat: null,
      input_source: inputSource,
      output_targets: outputTargets,
      cpu_usage: 0,
      memory_usage: 0,
      network_bandwidth: 0,
      error_count: 0,
      max_restarts: 3,
      restart_delay: 5000,
      health_check_interval: 5000,
    };
    
    await db('stream_processes').insert(processData);
    
    return await this.findById(processId);
  }
  
  /**
   * Find stream process by ID
   */
  static async findById(processId: string): Promise<StreamProcess> {
    const row = await db('stream_processes')
      .where('id', processId)
      .first();
      
    if (!row) {
      throw new Error('Stream process not found');
    }
    
    return this.mapDbRowToStreamProcess(row);
  }
  
  /**
   * Find stream process by channel ID
   */
  static async findByChannelId(channelId: string): Promise<StreamProcess | null> {
    const row = await db('stream_processes')
      .where('channel_id', channelId)
      .first();
      
    if (!row) {
      return null;
    }
    
    return this.mapDbRowToStreamProcess(row);
  }
  
  /**
   * Update stream process
   */
  static async update(processId: string, updates: Partial<StreamProcess>): Promise<StreamProcess> {
    const updateData: any = {};
    
    if (updates.ffmpegPid !== undefined) updateData.ffmpeg_pid = updates.ffmpegPid;
    if (updates.status) updateData.status = updates.status;
    if (updates.startTime !== undefined) updateData.start_time = updates.startTime;
    if (updates.lastHeartbeat !== undefined) updateData.last_heartbeat = updates.lastHeartbeat;
    if (updates.inputSource) updateData.input_source = updates.inputSource;
    if (updates.outputTargets) updateData.output_targets = updates.outputTargets;
    if (updates.cpuUsage !== undefined) updateData.cpu_usage = updates.cpuUsage;
    if (updates.memoryUsage !== undefined) updateData.memory_usage = updates.memoryUsage;
    if (updates.networkBandwidth !== undefined) updateData.network_bandwidth = updates.networkBandwidth;
    if (updates.errorCount !== undefined) updateData.error_count = updates.errorCount;
    if (updates.maxRestarts !== undefined) updateData.max_restarts = updates.maxRestarts;
    if (updates.restartDelay !== undefined) updateData.restart_delay = updates.restartDelay;
    if (updates.healthCheckInterval !== undefined) updateData.health_check_interval = updates.healthCheckInterval;
    
    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date();
      await db('stream_processes').where('id', processId).update(updateData);
    }
    
    return await this.findById(processId);
  }
  
  /**
   * Update process status
   */
  static async updateStatus(processId: string, status: ProcessStatus, ffmpegPid?: number): Promise<void> {
    const updateData: any = { 
      status, 
      updated_at: new Date() 
    };
    
    if (status === 'RUNNING') {
      updateData.start_time = new Date();
      updateData.last_heartbeat = new Date();
    }
    
    if (ffmpegPid !== undefined) {
      updateData.ffmpeg_pid = ffmpegPid;
    }
    
    await db('stream_processes').where('id', processId).update(updateData);
  }
  
  /**
   * Update heartbeat
   */
  static async updateHeartbeat(processId: string): Promise<void> {
    await db('stream_processes')
      .where('id', processId)
      .update({
        last_heartbeat: new Date(),
        updated_at: new Date(),
      });
  }
  
  /**
   * Update health metrics
   */
  static async updateHealthMetrics(
    processId: string, 
    metrics: {
      cpuUsage?: number;
      memoryUsage?: number;
      networkBandwidth?: number;
    }
  ): Promise<void> {
    const updateData: any = { updated_at: new Date() };
    
    if (metrics.cpuUsage !== undefined) updateData.cpu_usage = metrics.cpuUsage;
    if (metrics.memoryUsage !== undefined) updateData.memory_usage = metrics.memoryUsage;
    if (metrics.networkBandwidth !== undefined) updateData.network_bandwidth = metrics.networkBandwidth;
    
    await db('stream_processes').where('id', processId).update(updateData);
  }
  
  /**
   * Increment error count
   */
  static async incrementErrorCount(processId: string): Promise<void> {
    await db('stream_processes')
      .where('id', processId)
      .increment('error_count', 1)
      .update('updated_at', new Date());
  }
  
  /**
   * Reset error count
   */
  static async resetErrorCount(processId: string): Promise<void> {
    await db('stream_processes')
      .where('id', processId)
      .update({
        error_count: 0,
        updated_at: new Date(),
      });
  }
  
  /**
   * Delete stream process
   */
  static async delete(processId: string): Promise<void> {
    const result = await db('stream_processes').where('id', processId).del();
    
    if (result === 0) {
      throw new Error('Stream process not found');
    }
  }
  
  /**
   * Delete stream process by channel ID
   */
  static async deleteByChannelId(channelId: string): Promise<void> {
    await db('stream_processes').where('channel_id', channelId).del();
  }
  
  /**
   * Find processes that haven't sent heartbeat recently
   */
  static async findStaleProcesses(timeoutMs: number = 30000): Promise<StreamProcess[]> {
    const cutoffTime = new Date(Date.now() - timeoutMs);
    
    const rows = await db('stream_processes')
      .where('status', 'RUNNING')
      .where('last_heartbeat', '<', cutoffTime)
      .select('*');
      
    return rows.map(row => this.mapDbRowToStreamProcess(row));
  }
  
  /**
   * Get all running processes
   */
  static async getRunningProcesses(): Promise<StreamProcess[]> {
    const rows = await db('stream_processes')
      .where('status', 'RUNNING')
      .select('*');
      
    return rows.map(row => this.mapDbRowToStreamProcess(row));
  }
  
  /**
   * Map database row to StreamProcess object
   */
  private static mapDbRowToStreamProcess(row: any): StreamProcess {
    return {
      id: row.id,
      channelId: row.channel_id,
      ffmpegPid: row.ffmpeg_pid,
      status: row.status,
      startTime: row.start_time,
      lastHeartbeat: row.last_heartbeat,
      inputSource: row.input_source,
      outputTargets: row.output_targets,
      cpuUsage: parseFloat(row.cpu_usage) || 0,
      memoryUsage: parseInt(row.memory_usage) || 0,
      networkBandwidth: parseInt(row.network_bandwidth) || 0,
      errorCount: row.error_count,
      maxRestarts: row.max_restarts,
      restartDelay: row.restart_delay,
      healthCheckInterval: row.health_check_interval,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}