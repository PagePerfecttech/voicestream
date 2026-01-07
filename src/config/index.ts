import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server Configuration
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || '/api/v1',

  // Database Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'cloud_playout',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2'),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10'),
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // FFmpeg Configuration
  ffmpeg: {
    path: process.env.FFMPEG_PATH || '/usr/bin/ffmpeg',
    probePath: process.env.FFPROBE_PATH || '/usr/bin/ffprobe',
    outputDir: process.env.STREAM_OUTPUT_DIR || '/tmp/hls',
    fallbackVideoPath: process.env.FALLBACK_VIDEO_PATH || '/app/assets/fallback.mp4',
  },

  // HLS Configuration
  hls: {
    segmentDuration: parseInt(process.env.HLS_SEGMENT_DURATION || '6'),
    playlistSize: parseInt(process.env.HLS_PLAYLIST_SIZE || '5'),
    baseUrl: process.env.HLS_BASE_URL || 'http://localhost:8080/hls',
  },

  // Nginx Configuration
  nginx: {
    hlsPath: process.env.NGINX_HLS_PATH || '/var/www/hls',
    port: parseInt(process.env.NGINX_PORT || '8080'),
  },

  // Monitoring Configuration
  monitoring: {
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '5000'),
    maxRestartAttempts: parseInt(process.env.MAX_RESTART_ATTEMPTS || '3'),
    restartDelay: parseInt(process.env.RESTART_DELAY || '5000'),
  },

  // External Services
  external: {
    analyticsApiKey: process.env.ANALYTICS_API_KEY,
    adNetworkApiKey: process.env.AD_NETWORK_API_KEY,
    youtubeApiKey: process.env.YOUTUBE_API_KEY,
    facebookApiKey: process.env.FACEBOOK_API_KEY,
    twitchApiKey: process.env.TWITCH_API_KEY,
  },
};