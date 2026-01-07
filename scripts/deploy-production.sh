#!/bin/bash

# Enhanced Production Deployment Script for Cloud Playout SaaS
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
COMPOSE_FILE="docker-compose.neon.yml"
ENV_FILE=".env.production"
APP_DIR="/opt/cloud-playout"
BACKUP_DIR="/opt/backups"

echo -e "${GREEN}🚀 Starting Cloud Playout deployment for ${ENVIRONMENT}...${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for service health
wait_for_health() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}⏳ Waiting for $service to be healthy...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $service is healthy!${NC}"
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts - $service not ready yet..."
        sleep 10
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ $service failed to become healthy after $max_attempts attempts${NC}"
    return 1
}

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ This script must be run as root or with sudo${NC}"
    exit 1
fi

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

# Check if Docker is installed
if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed!${NC}"
    echo "Please install Docker first."
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}❌ Docker Compose is not installed!${NC}"
    echo "Please install Docker Compose first."
    exit 1
fi

# Load environment variables
echo -e "${YELLOW}📋 Loading environment variables...${NC}"
export $(cat $ENV_FILE | grep -v '^#' | grep -v '^$' | xargs)

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
mkdir -p logs ssl monitoring/grafana/provisioning $BACKUP_DIR
chmod 755 logs ssl monitoring $BACKUP_DIR

# Stop existing services gracefully
echo -e "${YELLOW}🛑 Stopping existing services...${NC}"
if docker-compose -f $COMPOSE_FILE ps | grep -q "Up"; then
    docker-compose -f $COMPOSE_FILE down --timeout 30
fi

# Clean up old containers and images
echo -e "${YELLOW}🧹 Cleaning up old containers and images...${NC}"
docker system prune -f --volumes

# Build and start services
echo -e "${YELLOW}🔨 Building and starting services...${NC}"
docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE build --no-cache --parallel
docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d

# Wait for Redis to be ready
echo -e "${YELLOW}⏳ Waiting for Redis to be ready...${NC}"
timeout=60
counter=0
while [ $counter -lt $timeout ]; do
    if docker-compose -f $COMPOSE_FILE exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo -e "${GREEN}✅ Redis is ready!${NC}"
        break
    fi
    
    if [ $counter -eq $timeout ]; then
        echo -e "${RED}❌ Timeout waiting for Redis${NC}"
        docker-compose -f $COMPOSE_FILE logs redis
        exit 1
    fi
    
    echo "Waiting for Redis... ($counter/$timeout)"
    sleep 2
    counter=$((counter + 2))
done

# Wait for application to be ready
echo -e "${YELLOW}⏳ Waiting for application to be ready...${NC}"
timeout=120
counter=0
while [ $counter -lt $timeout ]; do
    if docker-compose -f $COMPOSE_FILE ps | grep -q "Up (healthy)"; then
        echo -e "${GREEN}✅ Application is ready!${NC}"
        break
    fi
    
    if [ $counter -eq $timeout ]; then
        echo -e "${RED}❌ Timeout waiting for application to be healthy${NC}"
        docker-compose -f $COMPOSE_FILE logs app
        exit 1
    fi
    
    echo "Waiting for application... ($counter/$timeout)"
    sleep 5
    counter=$((counter + 5))
done

# Run database migrations
echo -e "${YELLOW}🗄️ Running database migrations...${NC}"
if docker-compose -f $COMPOSE_FILE exec -T app npm run migrate:latest; then
    echo -e "${GREEN}✅ Database migrations completed${NC}"
else
    echo -e "${RED}❌ Database migrations failed${NC}"
    docker-compose -f $COMPOSE_FILE logs app
    exit 1
fi

# Run database seeds (optional)
if [ "$RUN_SEEDS" = "true" ]; then
    echo -e "${YELLOW}🌱 Running database seeds...${NC}"
    if docker-compose -f $COMPOSE_FILE exec -T app npm run seed:run; then
        echo -e "${GREEN}✅ Database seeds completed${NC}"
    else
        echo -e "${YELLOW}⚠️ Database seeds failed (continuing anyway)${NC}"
    fi
fi

# Verify deployment
echo -e "${YELLOW}🔍 Verifying deployment...${NC}"

# Check application health
if wait_for_health "Application" "http://localhost:${APP_PORT:-3000}/health"; then
    echo -e "${GREEN}✅ Application health check passed${NC}"
else
    echo -e "${RED}❌ Application health check failed${NC}"
    docker-compose -f $COMPOSE_FILE logs app
    exit 1
fi

# Check system health
if wait_for_health "System API" "http://localhost:${APP_PORT:-3000}/api/system/health"; then
    echo -e "${GREEN}✅ System health check passed${NC}"
else
    echo -e "${YELLOW}⚠️ System health check failed (continuing anyway)${NC}"
fi

# Check HLS endpoint
if wait_for_health "HLS Endpoint" "http://localhost:${NGINX_PORT:-80}/health"; then
    echo -e "${GREEN}✅ HLS endpoint health check passed${NC}"
else
    echo -e "${YELLOW}⚠️ HLS endpoint health check failed (continuing anyway)${NC}"
fi

# Display deployment information
echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📊 Service Information:${NC}"
echo "Application: http://109.199.120.192:${APP_PORT:-3000}"
echo "Dashboard: http://109.199.120.192:${APP_PORT:-3000}/dashboard"
echo "API: http://109.199.120.192:${APP_PORT:-3000}/api"
echo "HLS Streams: http://109.199.120.192:${NGINX_PORT:-80}/hls"
echo "System Health: http://109.199.120.192:${APP_PORT:-3000}/api/system/health"

if docker-compose -f $COMPOSE_FILE --profile monitoring ps 2>/dev/null | grep -q "Up"; then
    echo "Prometheus: http://109.199.120.192:9090"
    echo "Grafana: http://109.199.120.192:3001 (admin/${GRAFANA_PASSWORD:-admin})"
fi

echo ""
echo -e "${BLUE}📋 Container Status:${NC}"
docker-compose -f $COMPOSE_FILE ps

echo ""
echo -e "${BLUE}📋 System Resources:${NC}"
echo "Memory Usage: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
echo "Disk Usage: $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')"

echo ""
echo -e "${BLUE}📋 Useful Commands:${NC}"
echo "View logs: docker-compose -f $COMPOSE_FILE logs -f"
echo "Stop services: docker-compose -f $COMPOSE_FILE down"
echo "Restart services: docker-compose -f $COMPOSE_FILE restart"
echo "Update services: $0 $ENVIRONMENT"

# Create backup
echo -e "${YELLOW}💾 Creating deployment backup...${NC}"
BACKUP_FILE="$BACKUP_DIR/deployment_$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czf "$BACKUP_FILE" --exclude='node_modules' --exclude='logs' --exclude='dist' . 2>/dev/null || true
echo -e "${GREEN}✅ Backup created: $BACKUP_FILE${NC}"

echo ""
echo -e "${GREEN}✅ Cloud Playout is now running in $ENVIRONMENT mode!${NC}"
echo -e "${YELLOW}📝 Deployment completed at: $(date)${NC}"