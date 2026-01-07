import { PlatformAdapter, PlatformType } from '../../types/distribution';
import { YouTubeAdapter } from './YouTubeAdapter';
import { FacebookAdapter } from './FacebookAdapter';
import { TwitchAdapter } from './TwitchAdapter';
import { CustomAdapter } from './CustomAdapter';

/**
 * Factory class for creating platform adapters
 * Manages the creation and caching of platform-specific adapters
 */
export class AdapterFactory {
  private static adapters: Map<PlatformType, PlatformAdapter> = new Map();

  /**
   * Get adapter for specified platform type
   */
  static getAdapter(platformType: PlatformType): PlatformAdapter {
    if (!this.adapters.has(platformType)) {
      this.adapters.set(platformType, this.createAdapter(platformType));
    }
    
    return this.adapters.get(platformType)!;
  }

  /**
   * Create new adapter instance for platform type
   */
  private static createAdapter(platformType: PlatformType): PlatformAdapter {
    switch (platformType) {
      case 'youtube':
        return new YouTubeAdapter();
      case 'facebook':
        return new FacebookAdapter();
      case 'twitch':
        return new TwitchAdapter();
      case 'custom':
        return new CustomAdapter();
      default:
        throw new Error(`Unsupported platform type: ${platformType}`);
    }
  }

  /**
   * Get all supported platform types
   */
  static getSupportedPlatforms(): PlatformType[] {
    return ['youtube', 'facebook', 'twitch', 'custom'];
  }

  /**
   * Check if platform type is supported
   */
  static isSupported(platformType: string): platformType is PlatformType {
    return this.getSupportedPlatforms().includes(platformType as PlatformType);
  }

  /**
   * Clear adapter cache (useful for testing)
   */
  static clearCache(): void {
    this.adapters.clear();
  }
}