import express from 'express';
import { ChannelManager } from '../services/ChannelManager';
import { logger } from '../utils/logger';

const router = express.Router();
const channelManager = new ChannelManager();

// Serve main dashboard
router.get('/', async (_req, res) => {
  try {
    const html = generateDashboardHTML();
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logger.error('Error serving dashboard:', error);
    res.status(500).send('Internal server error');
  }
});

// Get dashboard data (channels list)
router.get('/data/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const channels = await channelManager.getChannelsByClient(clientId);
    
    // Get status for each channel
    const channelsWithStatus = await Promise.all(
      channels.map(async (channel) => {
        try {
          const status = await channelManager.getChannelStatus(channel.id);
          return { ...channel, currentStatus: status };
        } catch (error) {
          return { ...channel, currentStatus: { status: 'ERROR', error: (error as Error).message } };
        }
      })
    );

    res.json({ success: true, data: channelsWithStatus });
  } catch (error) {
    logger.error('Error fetching dashboard data:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
});

function generateDashboardHTML(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Channel Management Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #f5f7fa;
            color: #333;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem 0;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .container {
            max-width: 1200px;
            margin: 2rem auto;
            padding: 0 1rem;
        }
        
        .controls {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }
        
        .controls h2 {
            margin-bottom: 1rem;
            color: #4a5568;
        }
        
        .form-group {
            display: flex;
            gap: 1rem;
            align-items: center;
            margin-bottom: 1rem;
        }
        
        .form-group label {
            font-weight: 600;
            min-width: 100px;
        }
        
        .form-group input, .form-group select {
            padding: 0.5rem;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            font-size: 1rem;
        }
        
        .btn {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s ease;
        }
        
        .btn-primary {
            background: #4299e1;
            color: white;
        }
        
        .btn-primary:hover {
            background: #3182ce;
        }
        
        .btn-success {
            background: #48bb78;
            color: white;
        }
        
        .btn-success:hover {
            background: #38a169;
        }
        
        .btn-warning {
            background: #ed8936;
            color: white;
        }
        
        .btn-warning:hover {
            background: #dd6b20;
        }
        
        .btn-danger {
            background: #f56565;
            color: white;
        }
        
        .btn-danger:hover {
            background: #e53e3e;
        }
        
        .btn-small {
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
        }
        
        .channels-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 1.5rem;
        }
        
        .channel-card {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
            transition: transform 0.3s ease;
        }
        
        .channel-card:hover {
            transform: translateY(-2px);
        }
        
        .channel-header {
            padding: 1.5rem;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .channel-name {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
            color: #2d3748;
        }
        
        .channel-id {
            font-size: 0.875rem;
            color: #718096;
            font-family: monospace;
        }
        
        .channel-status {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-top: 1rem;
        }
        
        .status-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }
        
        .status-indicator.live {
            background: #48bb78;
            animation: pulse 2s infinite;
        }
        
        .status-indicator.starting {
            background: #ed8936;
        }
        
        .status-indicator.stopped {
            background: #a0aec0;
        }
        
        .status-indicator.error {
            background: #f56565;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        .channel-actions {
            padding: 1rem 1.5rem;
            background: #f7fafc;
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }
        
        .loading {
            text-align: center;
            padding: 3rem;
            color: #718096;
        }
        
        .error {
            background: #fed7d7;
            color: #c53030;
            padding: 1rem;
            border-radius: 4px;
            margin-bottom: 1rem;
        }
        
        .connection-status {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 0.75rem 1rem;
            border-radius: 4px;
            font-weight: 600;
            z-index: 1000;
        }
        
        .connection-status.connected {
            background: #48bb78;
            color: white;
        }
        
        .connection-status.disconnected {
            background: #f56565;
            color: white;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Channel Management Dashboard</h1>
        <p>Monitor and control your 24×7 streaming channels</p>
    </div>
    
    <div class="container">
        <div class="controls">
            <h2>Client Selection</h2>
            <div class="form-group">
                <label for="clientId">Client ID:</label>
                <input type="text" id="clientId" placeholder="Enter client ID" value="demo-client">
                <button class="btn btn-primary" onclick="loadChannels()">Load Channels</button>
                <button class="btn btn-success" onclick="connectWebSocket()">Connect Real-time</button>
            </div>
        </div>
        
        <div id="error-container"></div>
        
        <div id="channels-container">
            <div class="loading">
                <p>Enter a client ID and click "Load Channels" to view channels</p>
            </div>
        </div>
    </div>
    
    <div id="connection-status" class="connection-status disconnected">Disconnected</div>

    <script>
        let websocket = null;
        let currentClientId = null;
        let channels = [];

        // Load channels for a client
        async function loadChannels() {
            const clientId = document.getElementById('clientId').value.trim();
            if (!clientId) {
                showError('Please enter a client ID');
                return;
            }

            currentClientId = clientId;
            showLoading();
            clearError();

            try {
                const response = await fetch(\`/dashboard/data/\${clientId}\`);
                const result = await response.json();

                if (result.success) {
                    channels = result.data;
                    renderChannels(channels);
                } else {
                    showError(result.error || 'Failed to load channels');
                }
            } catch (error) {
                console.error('Error loading channels:', error);
                showError('Failed to connect to server');
            }
        }

        // Render channels grid
        function renderChannels(channelList) {
            const container = document.getElementById('channels-container');
            
            if (channelList.length === 0) {
                container.innerHTML = '<div class="loading"><p>No channels found for this client</p></div>';
                return;
            }

            const html = \`
                <div class="channels-grid">
                    \${channelList.map(channel => \`
                        <div class="channel-card" id="channel-\${channel.id}">
                            <div class="channel-header">
                                <div class="channel-name">\${channel.name}</div>
                                <div class="channel-id">\${channel.id}</div>
                                <div class="channel-status">
                                    <div class="status-indicator \${(channel.currentStatus?.status || 'stopped').toLowerCase()}" 
                                         id="status-\${channel.id}"></div>
                                    <span id="status-text-\${channel.id}">\${channel.currentStatus?.status || 'STOPPED'}</span>
                                </div>
                            </div>
                            <div class="channel-actions">
                                <button class="btn btn-primary btn-small" onclick="openPreview('\${channel.id}')">
                                    Preview
                                </button>
                                <button class="btn btn-success btn-small" onclick="startChannel('\${channel.id}')">
                                    Start
                                </button>
                                <button class="btn btn-warning btn-small" onclick="restartChannel('\${channel.id}')">
                                    Restart
                                </button>
                                <button class="btn btn-danger btn-small" onclick="stopChannel('\${channel.id}')">
                                    Stop
                                </button>
                            </div>
                        </div>
                    \`).join('')}
                </div>
            \`;
            
            container.innerHTML = html;
        }

        // WebSocket connection
        function connectWebSocket() {
            if (websocket) {
                websocket.close();
            }

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = \`\${protocol}//\${window.location.host}/ws\`;
            
            websocket = new WebSocket(wsUrl);

            websocket.onopen = () => {
                console.log('WebSocket connected');
                updateConnectionStatus(true);
                
                // Subscribe to all current channels
                channels.forEach(channel => {
                    websocket.send(JSON.stringify({
                        type: 'subscribe',
                        channelId: channel.id,
                        clientId: currentClientId
                    }));
                });
            };

            websocket.onmessage = (event) => {
                const message = JSON.parse(event.data);
                handleWebSocketMessage(message);
            };

            websocket.onclose = () => {
                console.log('WebSocket disconnected');
                updateConnectionStatus(false);
                // Attempt reconnection after 3 seconds
                setTimeout(connectWebSocket, 3000);
            };

            websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                updateConnectionStatus(false);
            };
        }

        // Handle WebSocket messages
        function handleWebSocketMessage(message) {
            switch (message.type) {
                case 'status_update':
                case 'metrics_update':
                    updateChannelStatus(message.channelId, message.data);
                    break;
                case 'stream_restart':
                    console.log(\`Stream restarted: \${message.channelId}\`);
                    break;
                case 'error':
                    console.error('Server error:', message.data.error);
                    break;
            }
        }

        // Update channel status in UI
        function updateChannelStatus(channelId, data) {
            const statusIndicator = document.getElementById(\`status-\${channelId}\`);
            const statusText = document.getElementById(\`status-text-\${channelId}\`);
            
            if (statusIndicator && statusText && data.status) {
                const status = data.status.status || data.status;
                statusIndicator.className = \`status-indicator \${status.toLowerCase()}\`;
                statusText.textContent = status;
            }
        }

        // Channel control functions
        async function startChannel(channelId) {
            try {
                const response = await fetch(\`/api/channels/\${channelId}/start\`, { method: 'POST' });
                const result = await response.json();
                if (!result.success) {
                    showError(\`Failed to start channel: \${result.error}\`);
                }
            } catch (error) {
                showError('Failed to start channel');
            }
        }

        async function stopChannel(channelId) {
            try {
                const response = await fetch(\`/api/channels/\${channelId}/stop\`, { method: 'POST' });
                const result = await response.json();
                if (!result.success) {
                    showError(\`Failed to stop channel: \${result.error}\`);
                }
            } catch (error) {
                showError('Failed to stop channel');
            }
        }

        async function restartChannel(channelId) {
            try {
                const response = await fetch(\`/api/channels/\${channelId}/restart\`, { method: 'POST' });
                const result = await response.json();
                if (!result.success) {
                    showError(\`Failed to restart channel: \${result.error}\`);
                }
            } catch (error) {
                showError('Failed to restart channel');
            }
        }

        function openPreview(channelId) {
            window.open(\`/preview/channel/\${channelId}\`, '_blank');
        }

        // Utility functions
        function showLoading() {
            document.getElementById('channels-container').innerHTML = 
                '<div class="loading"><p>Loading channels...</p></div>';
        }

        function showError(message) {
            document.getElementById('error-container').innerHTML = 
                \`<div class="error">\${message}</div>\`;
        }

        function clearError() {
            document.getElementById('error-container').innerHTML = '';
        }

        function updateConnectionStatus(connected) {
            const statusElement = document.getElementById('connection-status');
            statusElement.textContent = connected ? 'Connected' : 'Disconnected';
            statusElement.className = \`connection-status \${connected ? 'connected' : 'disconnected'}\`;
        }

        // Auto-connect WebSocket on page load
        document.addEventListener('DOMContentLoaded', () => {
            connectWebSocket();
        });
    </script>
</body>
</html>`;
}

export default router;