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

# Generate secure keys if they are still placeholder values
if [[ "$JWT_SECRET" == *"replace_this"* ]]; then
    echo -e "${YELLOW}🔐 Generating new JWT secret...${NC}"
    NEW_JWT_SECRET=$(openssl rand -base64 32)
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=${NEW_JWT_SECRET}/" $ENV_FILE
    export JWT_SECRET=$NEW_JWT_SECRET
fi

if [[ "$ENCRYPTION_KEY" == *"replace_this"* ]]; then
    echo -e "${YELLOW}🔐 Generating new encryption key...${NC}"
    NEW_ENCRYPTION_KEY=$(openssl rand -hex 16)
    sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=${NEW_ENCRYPTION_KEY}/" $ENV_FILE
    export ENCRYPTION_KEY=$NEW_ENCRYPTION_KEY
fi

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