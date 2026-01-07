# Server Deployment Commands

## Current Situation
You're on the server at `/opt/cloud-playout` but the files are in the wrong location and some are missing.

## Quick Fix - Run These Commands on the Server

### 1. Download and run the complete setup script
```bash
# Navigate to the correct directory
cd /opt/cloud-playout

# Download the complete setup script
curl -o server-setup-complete.sh https://raw.githubusercontent.com/PagePerfecttech/voicestream/main/server-setup-complete.sh

# Make it executable
chmod +x server-setup-complete.sh

# Run the complete setup (this will fix everything)
./server-setup-complete.sh
```

### 2. Deploy the application
```bash
# After the setup script completes, deploy the application
./scripts/deploy-neon.sh
```

## Alternative: Manual Steps

If the download doesn't work, here are the manual steps:

### 1. Fix directory structure
```bash
cd /opt/cloud-playout

# If there's a voicestream subdirectory, move files up
if [ -d "voicestream" ]; then
    mv voicestream/* .
    mv voicestream/.* . 2>/dev/null || true
    rmdir voicestream
fi
```

### 2. Create missing .env.production file
```bash
cat > .env.production << 'EOF'
# Neon Database Configuration
DATABASE_URL=postgresql://neondb_owner:npg_08QpAtifOnXI@ep-steep-darkness-adouuupb-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
DB_HOST=ep-steep-darkness-adouuupb-pooler.c-2.us-east-1.aws.neon.tech
DB_PORT=5432
DB_NAME=neondb
DB_USER=neondb_owner
DB_PASSWORD=npg_08QpAtifOnXI
DB_SSL=true

# Redis Configuration (local container)
REDIS_HOST=redis
REDIS_PORT=6379

# Application Configuration
NODE_ENV=production
APP_PORT=3000
LOG_LEVEL=info

# Security (Generated secure keys)
JWT_SECRET=K8mN2pQ7vX9zB4cF6hJ8kL1mP3rS5tU7wY0zA2bD4eG6iH8jK0mN2pQ5rS7tU9wX
ENCRYPTION_KEY=a1b2c3d4e5f6789012345678901234ab

# Streaming Configuration
STREAM_OUTPUT_DIR=/app/hls
HLS_BASE_URL=http://109.199.120.192/hls

# Nginx Configuration
NGINX_PORT=80
NGINX_SSL_PORT=443

# Monitoring
GRAFANA_PASSWORD=admin123
EOF
```

### 3. Install Docker (if needed)
```bash
# Update system
apt update

# Install prerequisites
apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Add Docker GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update and install Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Start Docker
systemctl start docker
systemctl enable docker
```

### 4. Install PostgreSQL client
```bash
apt install -y postgresql-client
```

### 5. Make scripts executable
```bash
chmod +x scripts/*.sh
```

### 6. Deploy the application
```bash
./scripts/deploy-neon.sh
```

## Verification Commands

After deployment, verify everything is working:

```bash
# Check Docker containers
docker-compose -f docker-compose.neon.yml ps

# Check application health
curl http://localhost:3000/health

# Check system health
curl http://localhost:3000/api/system/health

# View logs
docker-compose -f docker-compose.neon.yml logs -f
```

## Access URLs

Once deployed, you can access:

- **Application**: http://109.199.120.192:3000
- **Dashboard**: http://109.199.120.192:3000/dashboard
- **API**: http://109.199.120.192:3000/api
- **HLS Streams**: http://109.199.120.192/hls
- **System Health**: http://109.199.120.192:3000/api/system/health

## Troubleshooting

If you encounter issues:

1. **Check Docker status**: `systemctl status docker`
2. **Check container logs**: `docker-compose -f docker-compose.neon.yml logs`
3. **Restart services**: `docker-compose -f docker-compose.neon.yml restart`
4. **Stop and rebuild**: `docker-compose -f docker-compose.neon.yml down && docker-compose -f docker-compose.neon.yml up -d --build`