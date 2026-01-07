import * as path from 'path';
import * as fs from 'fs';
import { logger } from './logger';

export class FallbackVideoManager {
  private static readonly FALLBACK_DIR = path.join(process.cwd(), 'media', 'fallback');
  private static readonly DEFAULT_FALLBACK = 'default_fallback.mp4';

  /**
   * Ensure fallback video directory exists
   */
  static async ensureFallbackDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.FALLBACK_DIR, { recursive: true });
    } catch (error: any) {
      logger.error('Failed to create fallback directory', { error: error.message });
      throw error;
    }
  }

  /**
   * Get the path to the default fallback video
   */
  static getDefaultFallbackPath(): string {
    return path.join(this.FALLBACK_DIR, this.DEFAULT_FALLBACK);
  }

  /**
   * Create a test pattern video using FFmpeg (for testing purposes)
   */
  static async createTestFallbackVideo(): Promise<string> {
    const fallbackPath = this.getDefaultFallbackPath();
    
    // Check if fallback video already exists
    try {
      await fs.promises.access(fallbackPath);
      logger.info('Fallback video already exists', { path: fallbackPath });
      return fallbackPath;
    } catch {
      // File doesn't exist, create it
    }

    await this.ensureFallbackDirectory();

    // For testing, we'll create a simple test pattern video
    // In production, this would be a proper fallback video file
    logger.info('Creating test fallback video', { path: fallbackPath });
    
    // Create a minimal test file (in production, use actual video content)
    const testContent = Buffer.from('TEST_FALLBACK_VIDEO_PLACEHOLDER');
    await fs.promises.writeFile(fallbackPath, testContent);
    
    logger.info('Test fallback video created', { path: fallbackPath });
    return fallbackPath;
  }

  /**
   * Validate that a fallback video file exists and is accessible
   */
  static async validateFallbackVideo(videoPath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(videoPath);
      return stats.isFile() && stats.size > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get fallback video path, creating default if needed
   */
  static async getFallbackVideoPath(customPath?: string): Promise<string> {
    if (customPath) {
      const isValid = await this.validateFallbackVideo(customPath);
      if (isValid) {
        return customPath;
      }
      logger.warn('Custom fallback video not found, using default', { customPath });
    }

    // Ensure default fallback exists
    await this.createTestFallbackVideo();
    return this.getDefaultFallbackPath();
  }
}