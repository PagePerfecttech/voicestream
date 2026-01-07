import { PreviewPlayerService } from '../../services/PreviewPlayer';

describe('PreviewPlayerService', () => {
  let previewService: PreviewPlayerService;

  beforeEach(() => {
    previewService = new PreviewPlayerService();
  });

  it('should register and retrieve stream configuration', () => {
    const config = {
      channelId: 'test-channel-123',
      hlsUrl: 'http://localhost:3000/hls/test-channel-123/playlist.m3u8',
      autoplay: false,
      muted: true,
      controls: true
    };

    previewService.registerStream(config);
    const retrievedConfig = previewService.getStreamConfig('test-channel-123');
    
    expect(retrievedConfig).toEqual(config);
  });

  it('should unregister stream configuration', () => {
    const config = {
      channelId: 'test-channel-123',
      hlsUrl: 'http://localhost:3000/hls/test-channel-123/playlist.m3u8'
    };

    previewService.registerStream(config);
    previewService.unregisterStream('test-channel-123');
    
    const retrievedConfig = previewService.getStreamConfig('test-channel-123');
    expect(retrievedConfig).toBeUndefined();
  });

  it('should update and retrieve stream metrics', () => {
    const channelId = 'test-channel-123';
    const metrics = {
      isLive: true,
      currentTime: 120,
      bitrate: 2000000
    };

    previewService.updateStreamMetrics(channelId, metrics);
    const retrievedMetrics = previewService.getStreamMetrics(channelId);
    
    expect(retrievedMetrics).toMatchObject(metrics);
  });

  it('should generate client-side HLS.js code', () => {
    const config = {
      channelId: 'test-channel-123',
      hlsUrl: 'http://localhost:3000/hls/test-channel-123/playlist.m3u8',
      autoplay: true
    };

    previewService.registerStream(config);
    const clientCode = previewService.generateClientCode('test-channel-123');
    
    expect(clientCode).toContain('ChannelPreviewPlayer');
    expect(clientCode).toContain('test-channel-123');
    expect(clientCode).toContain('setupHLS');
    expect(clientCode).toContain('setupWebSocket');
  });

  it('should generate preview HTML template', () => {
    const channelId = 'test-channel-123';
    const html = previewService.generatePreviewHTML(channelId);
    
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Channel Preview');
    expect(html).toContain('preview-video');
    expect(html).toContain('hls.js');
    expect(html).toContain(channelId);
  });
});