#!/bin/bash

# Deploy to Ubuntu server
SERVER_IP="109.199.120.192"
SERVER_USER="root"
SERVER_PATH="/opt/cloud-playout"

echo "🚀 Deploying to server $SERVER_IP..."

# Upload files using rsync
echo "📁 Uploading files..."
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude 'logs' ./ $SERVER_USER@$SERVER_IP:$SERVER_PATH/

# Run deployment script on server
echo "🔨 Running deployment script on server..."
ssh $SERVER_USER@$SERVER_IP "cd $SERVER_PATH && ./scripts/deploy-neon.sh"

echo "✅ Deployment completed!"