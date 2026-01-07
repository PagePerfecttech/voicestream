#!/bin/bash

# Complete Server Setup Script for Voicestream Deployment
# This script fixes directory structure, installs Docker, and deploys the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Voicestream Complete Server Setup${NC}"
echo -e "${BLUE}====================================${NC}"
echo ""

# Step 1: Fix directory structure
echo -e "${GREEN}Step 1: Fixing directory structure...${NC}"

# Check current directory
CURRENT_DIR=$(pwd)
echo "Current directory: $CURRENT_DIR"

# Navigate to /opt/cloud-playout
cd /opt/cloud-playout

# Check if voicestream subdirectory exists
if [ -d "voicestream" ]; then
    echo -e "${YELLOW}📁 Found voicestream subdirectory, moving files to parent directory...${NC}"
    
    # Move all files from voicestream/ to current directory
    mv voicestream/* . 2>/dev/null || true
    mv voicestream/.* . 2>/dev/null || true  # Move hidden files, ignore errors
    
    # Remove empty voicestream directory
    rmdir voicestream 2>/dev/null || true
    
    echo -e "${GREEN}✅ Files moved successfully!${NC}"
elif [ -f "package.json" ]; then
    echo -e "${GREEN}✅ Files are already in the correct location!${NC}"
else
    echo -e "${RED}❌ Cannot find application files. Please check the directory structure.${NC}"
    exit 1
fi

# Step 2: Make scripts executable
echo -e "${GREEN}Step 2: Making scripts executable...${NC}"
chmod +x scripts/*.sh 2>/dev/null || true
chmod +x *.sh 2>/dev/null || true

# Step 3: Create missing .env.production file
echo -e "${GREEN}Step 3: Creating .env.production file...${NC}"
if [ ! -f ".env.production" ]; then
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

# External Services (configure as needed)
# YOUTUBE_API_KEY=your_youtube_api_key
# FACEBOOK_APP_ID=your_facebook_app_id
# FACEBOOK_APP_SECRET=your_facebook_app_secret
# TWITCH_CLIENT_ID=your_twitch_client_id
# TWITCH_CLIENT_SECRET=your_twitch_client_secret

# Email Configuration (for alerts)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your_email@gmail.com
# SMTP_PASS=your_app_password
EOF
    echo -e "${GREEN}✅ .env.production file created!${NC}"
else
    echo -e "${GREEN}✅ .env.production file already exists!${NC}"
fi

# Step 4: Create missing docker-compose.neon.yml file
echo -e "${GREEN}Step 4: Creating docker-compose.neon.yml file...${NC}"
if [ ! -f "docker-compose.neon.yml" ]; then
    cat > docker-compose.neon.yml << 'EOF'
version: '3.8'

services:
  # Redis Cache (still needed locally)
  redis:
    image: redis:7-alpine
    container_name: voicestream-redis-prod
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - voicestream-network
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru

  # Nginx for HLS serving and load balancing
  nginx:
    image: nginx:alpine
    container_name: voicestream-nginx-prod
    ports:
      - "${NGINX_PORT:-80}:80"
      - "${NGINX_SSL_PORT:-443}:443"
    volumes:
      - ./nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - hls_data:/var/www/hls
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped
    networks:
      - voicestream-network

  # Main Application
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: voicestream-app-prod
    ports:
      - "${APP_PORT:-3000}:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - DB_HOST=${DB_HOST}
      - DB_PORT=${DB_PORT}
      - DB_NAME=${DB_NAME}
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_SSL=${DB_SSL:-true}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - STREAM_OUTPUT_DIR=/app/hls
      - HLS_BASE_URL=${HLS_BASE_URL:-http://localhost/hls}
      - LOG_LEVEL=${LOG_LEVEL:-info}
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    volumes:
      - hls_data:/app/hls
      - ./logs:/app/logs
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
    networks:
      - voicestream-network
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M

  # Monitoring - Prometheus (optional)
  prometheus:
    image: prom/prometheus:latest
    container_name: voicestream-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    restart: unless-stopped
    networks:
      - voicestream-network
    profiles:
      - monitoring

  # Monitoring - Grafana (optional)
  grafana:
    image: grafana/grafana:latest
    container_name: voicestream-grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-admin}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
    restart: unless-stopped
    networks:
      - voicestream-network
    profiles:
      - monitoring

volumes:
  redis_data:
    driver: local
  hls_data:
    driver: local
  prometheus_data:
    driver: local
  grafana_data:
    driver: local

networks:
  voicestream-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
EOF
    echo -e "${GREEN}✅ docker-compose.neon.yml file created!${NC}"
else
    echo -e "${GREEN}✅ docker-compose.neon.yml file already exists!${NC}"
fi

# Step 5: Create missing scripts/deploy-neon.sh file
echo -e "${GREEN}Step 5: Creating scripts/deploy-neon.sh file...${NC}"
mkdir -p scripts
if [ ! -f "scripts/deploy-neon.sh" ]; then
    cat > scripts/deploy-neon.sh << 'EOF'
#!/bin/bash

# Voicestream Deployment Script for Neon Database
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
COMPOSE_FILE="docker-compose.neon.yml"
ENV_FILE=".env.production"

echo -e "${GREEN}🚀 Starting Voicestream deployment with Neon database for ${ENVIRONMENT}...${NC}"

# Check if required files exist
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Environment file $ENV_FILE not found!${NC}"
    echo "Please create $ENV_FILE with required environment variables."
    exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}❌ Docker Compose file $COMPOSE_FILE not found!${NC}"
    exit 1
fi

# Load environment variables
echo -e "${YELLOW}📋 Loading environment variables...${NC}"
export $(cat $ENV_FILE | grep -v '^#' | xargs)

# Validate required environment variables
required_vars=("DATABASE_URL" "JWT_SECRET" "ENCRYPTION_KEY")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}❌ Required environment variable $var is not set!${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ Environment variables validated${NC}"

# Create necessary directories
echo -e "${YELLOW}📁 Creating necessary directories...${NC}"
mkdir -p logs ssl monitoring/grafana/provisioning

# Test Neon database connection
echo -e "${YELLOW}🔍 Testing Neon database connection...${NC}"
if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
        echo -e "${GREEN}✅ Neon database connection successful${NC}"
    else
        echo -e "${RED}❌ Cannot connect to Neon database${NC}"
        echo "Please check your DATABASE_URL and network connectivity"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  psql not available, skipping database connection test${NC}"
fi

# Build and start services
echo -e "${YELLOW}🔨 Building and starting services...${NC}"
docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE build --no-cache
docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
timeout=300
counter=0

while [ $counter -lt $timeout ]; do
    if docker-compose -f $COMPOSE_FILE ps | grep -q "Up (healthy)"; then
        echo -e "${GREEN}✅ Services are healthy!${NC}"
        break
    fi
    
    if [ $counter -eq $timeout ]; then
        echo -e "${RED}❌ Timeout waiting for services to be healthy${NC}"
        docker-compose -f $COMPOSE_FILE logs
        exit 1
    fi
    
    echo "Waiting for services... ($counter/$timeout)"
    sleep 5
    counter=$((counter + 5))
done

# Run database migrations on Neon database
echo -e "${YELLOW}🗄️ Running database migrations on Neon...${NC}"
docker-compose -f $COMPOSE_FILE exec app npm run migrate:latest

# Run database seeds (if needed)
echo -e "${YELLOW}🌱 Running database seeds...${NC}"
docker-compose -f $COMPOSE_FILE exec app npm run seed:run

# Verify deployment
echo -e "${YELLOW}🔍 Verifying deployment...${NC}"

# Check application health
APP_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${APP_PORT:-3000}/health || echo "000")
if [ "$APP_HEALTH" = "200" ]; then
    echo -e "${GREEN}✅ Application health check passed${NC}"
else
    echo -e "${RED}❌ Application health check failed (HTTP $APP_HEALTH)${NC}"
    exit 1
fi

# Check system health
SYSTEM_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${APP_PORT:-3000}/api/system/health || echo "000")
if [ "$SYSTEM_HEALTH" = "200" ]; then
    echo -e "${GREEN}✅ System health check passed${NC}"
else
    echo -e "${RED}❌ System health check failed (HTTP $SYSTEM_HEALTH)${NC}"
    exit 1
fi

# Check HLS endpoint
HLS_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${NGINX_PORT:-80}/health || echo "000")
if [ "$HLS_HEALTH" = "200" ]; then
    echo -e "${GREEN}✅ HLS endpoint health check passed${NC}"
else
    echo -e "${RED}❌ HLS endpoint health check failed (HTTP $HLS_HEALTH)${NC}"
    exit 1
fi

# Display deployment information
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${YELLOW}📊 Service Information:${NC}"
echo "Application: http://109.199.120.192:${APP_PORT:-3000}"
echo "Dashboard: http://109.199.120.192:${APP_PORT:-3000}/dashboard"
echo "API: http://109.199.120.192:${APP_PORT:-3000}/api"
echo "HLS Streams: http://109.199.120.192:${NGINX_PORT:-80}/hls"
echo "System Health: http://109.199.120.192:${APP_PORT:-3000}/api/system/health"

if docker-compose -f $COMPOSE_FILE --profile monitoring ps | grep -q "Up"; then
    echo "Prometheus: http://109.199.120.192:9090"
    echo "Grafana: http://109.199.120.192:3001 (admin/${GRAFANA_PASSWORD:-admin})"
fi

echo ""
echo -e "${YELLOW}📋 Database Information:${NC}"
echo "Database: Neon PostgreSQL (Cloud)"
echo "Database Name: neondb"
echo "Connection: SSL Enabled"

echo ""
echo -e "${YELLOW}📋 Useful Commands:${NC}"
echo "View logs: docker-compose -f $COMPOSE_FILE logs -f"
echo "Stop services: docker-compose -f $COMPOSE_FILE down"
echo "Restart services: docker-compose -f $COMPOSE_FILE restart"
echo "Update services: ./scripts/deploy-neon.sh $ENVIRONMENT"

echo ""
echo -e "${GREEN}✅ Voicestream is now running in $ENVIRONMENT mode with Neon database!${NC}"
EOF
    chmod +x scripts/deploy-neon.sh
    echo -e "${GREEN}✅ scripts/deploy-neon.sh file created!${NC}"
else
    echo -e "${GREEN}✅ scripts/deploy-neon.sh file already exists!${NC}"
fi

# Step 6: Verify required files exist
echo -e "${GREEN}Step 6: Verifying required files...${NC}"
required_files=("package.json" "scripts/deploy-neon.sh" "docker-compose.neon.yml" ".env.production")

all_files_exist=true
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ $file (missing)${NC}"
        all_files_exist=false
    fi
done

if [ "$all_files_exist" = false ]; then
    echo -e "${RED}❌ Some required files are missing. Please check the file structure.${NC}"
    exit 1
fi

# Step 7: Install Docker if not already installed
echo -e "${GREEN}Step 7: Checking Docker installation...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}🐳 Docker not found. Installing Docker...${NC}"
    
    # Update package index
    apt update
    
    # Install prerequisites
    apt install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Remove old Docker GPG key if it exists
    rm -f /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Update package index again
    apt update
    
    # Install Docker
    apt install -y docker-ce docker-ce-cli containerd.io
    
    # Install Docker Compose
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    echo -e "${GREEN}✅ Docker installed successfully!${NC}"
else
    echo -e "${GREEN}✅ Docker is already installed!${NC}"
fi

# Step 8: Install PostgreSQL client for database testing
echo -e "${GREEN}Step 8: Installing PostgreSQL client...${NC}"
if ! command -v psql &> /dev/null; then
    apt install -y postgresql-client
    echo -e "${GREEN}✅ PostgreSQL client installed!${NC}"
else
    echo -e "${GREEN}✅ PostgreSQL client is already installed!${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Server setup completed successfully!${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Deploy the application: ./scripts/deploy-neon.sh"
echo "2. Check application status: docker-compose -f docker-compose.neon.yml ps"
echo "3. View logs: docker-compose -f docker-compose.neon.yml logs -f"
echo ""
echo -e "${YELLOW}🔍 Current directory contents:${NC}"
ls -la