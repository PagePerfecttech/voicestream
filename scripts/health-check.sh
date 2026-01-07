#!/bin/bash

# Health Check Script for Cloud Playout System
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_PORT=${APP_PORT:-3000}
NGINX_PORT=${NGINX_PORT:-80}
MAX_RETRIES=30
RETRY_DELAY=5

echo -e "${GREEN}🔍 Starting Cloud Playout health check...${NC}"

# Function to check HTTP endpoint
check_endpoint() {
    local url=$1
    local name=$2
    local expected_status=${3:-200}
    
    echo -e "${YELLOW}Checking $name at $url...${NC}"
    
    local retries=0
    while [ $retries -lt $MAX_RETRIES ]; do
        local status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
        
        if [ "$status" = "$expected_status" ]; then
            echo -e "${GREEN}✅ $name is healthy (HTTP $status)${NC}"
            return 0
        fi
        
        retries=$((retries + 1))
        echo "Attempt $retries/$MAX_RETRIES failed (HTTP $status), retrying in ${RETRY_DELAY}s..."
        sleep $RETRY_DELAY
    done
    
    echo -e "${RED}❌ $name health check failed after $MAX_RETRIES attempts${NC}"
    return 1
}

# Function to check JSON response
check_json_endpoint() {
    local url=$1
    local name=$2
    local expected_field=$3
    
    echo -e "${YELLOW}Checking $name JSON response at $url...${NC}"
    
    local response=$(curl -s "$url" 2>/dev/null || echo "{}")
    local field_value=$(echo "$response" | grep -o "\"$expected_field\":[^,}]*" | cut -d':' -f2 | tr -d '"' || echo "")
    
    if [ -n "$field_value" ] && [ "$field_value" != "null" ]; then
        echo -e "${GREEN}✅ $name JSON response is valid ($expected_field: $field_value)${NC}"
        return 0
    else
        echo -e "${RED}❌ $name JSON response is invalid or missing $expected_field${NC}"
        echo "Response: $response"
        return 1
    fi
}

# Function to check Docker container
check_container() {
    local container_name=$1
    local service_name=$2
    
    echo -e "${YELLOW}Checking Docker container $container_name...${NC}"
    
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$container_name.*Up"; then
        echo -e "${GREEN}✅ $service_name container is running${NC}"
        return 0
    else
        echo -e "${RED}❌ $service_name container is not running${NC}"
        return 1
    fi
}

# Function to check database connectivity
check_database() {
    echo -e "${YELLOW}Checking database connectivity...${NC}"
    
    if docker exec cloud-playout-postgres-prod pg_isready -U ${DB_USER:-postgres} >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Database is accessible${NC}"
        return 0
    else
        echo -e "${RED}❌ Database is not accessible${NC}"
        return 1
    fi
}

# Function to check Redis connectivity
check_redis() {
    echo -e "${YELLOW}Checking Redis connectivity...${NC}"
    
    if docker exec cloud-playout-redis-prod redis-cli ping | grep -q "PONG"; then
        echo -e "${GREEN}✅ Redis is accessible${NC}"
        return 0
    else
        echo -e "${RED}❌ Redis is not accessible${NC}"
        return 1
    fi
}

# Main health checks
echo -e "${YELLOW}📋 Running comprehensive health checks...${NC}"
echo ""

# Check Docker containers
echo -e "${YELLOW}🐳 Checking Docker containers...${NC}"
check_container "cloud-playout-app-prod" "Application"
check_container "cloud-playout-nginx-prod" "Nginx"
check_container "cloud-playout-postgres-prod" "PostgreSQL"
check_container "cloud-playout-redis-prod" "Redis"
echo ""

# Check infrastructure services
echo -e "${YELLOW}🗄️ Checking infrastructure services...${NC}"
check_database
check_redis
echo ""

# Check application endpoints
echo -e "${YELLOW}🌐 Checking application endpoints...${NC}"
check_endpoint "http://localhost:$APP_PORT/health" "Application Health"
check_json_endpoint "http://localhost:$APP_PORT/health" "Application Health JSON" "status"
echo ""

# Check system endpoints
echo -e "${YELLOW}⚙️ Checking system endpoints...${NC}"
check_endpoint "http://localhost:$APP_PORT/api/system/health" "System Health API"
check_json_endpoint "http://localhost:$APP_PORT/api/system/health" "System Health JSON" "success"

check_endpoint "http://localhost:$APP_PORT/api/system/performance" "Performance Metrics API"
check_json_endpoint "http://localhost:$APP_PORT/api/system/performance" "Performance JSON" "success"

check_endpoint "http://localhost:$APP_PORT/api/system/services" "Services Status API"
check_json_endpoint "http://localhost:$APP_PORT/api/system/services" "Services JSON" "success"
echo ""

# Check Nginx and HLS serving
echo -e "${YELLOW}📡 Checking Nginx and HLS serving...${NC}"
check_endpoint "http://localhost:$NGINX_PORT/health" "Nginx Health"
echo ""

# Check dashboard and preview interfaces
echo -e "${YELLOW}🖥️ Checking web interfaces...${NC}"
check_endpoint "http://localhost:$APP_PORT/dashboard" "Dashboard Interface"
echo ""

# Check API routes
echo -e "${YELLOW}🔌 Checking API routes...${NC}"
api_routes=(
    "/api/channels"
    "/api/analytics"
    "/api/monetization"
    "/api/ai"
    "/api/distribution"
    "/api/interaction"
    "/api/concurrent"
)

for route in "${api_routes[@]}"; do
    # Most API routes return 400 for GET without parameters, which is expected
    check_endpoint "http://localhost:$APP_PORT$route" "API Route $route" "400"
done
echo ""

# Advanced health checks
echo -e "${YELLOW}🔬 Running advanced health checks...${NC}"

# Check system health details
echo -e "${YELLOW}Checking system health details...${NC}"
health_response=$(curl -s "http://localhost:$APP_PORT/api/system/health" 2>/dev/null || echo "{}")
overall_health=$(echo "$health_response" | grep -o '"overall":"[^"]*"' | cut -d':' -f2 | tr -d '"' || echo "unknown")

if [ "$overall_health" = "healthy" ]; then
    echo -e "${GREEN}✅ Overall system health: $overall_health${NC}"
elif [ "$overall_health" = "degraded" ]; then
    echo -e "${YELLOW}⚠️ Overall system health: $overall_health${NC}"
else
    echo -e "${RED}❌ Overall system health: $overall_health${NC}"
fi

# Check service container status
echo -e "${YELLOW}Checking service container status...${NC}"
services_response=$(curl -s "http://localhost:$APP_PORT/api/system/services" 2>/dev/null || echo "{}")
services_initialized=$(echo "$services_response" | grep -o '"initialized":[^,}]*' | cut -d':' -f2 | tr -d '"' || echo "false")

if [ "$services_initialized" = "true" ]; then
    echo -e "${GREEN}✅ Service container is initialized${NC}"
else
    echo -e "${RED}❌ Service container is not initialized${NC}"
fi

# Check performance metrics
echo -e "${YELLOW}Checking performance metrics...${NC}"
perf_response=$(curl -s "http://localhost:$APP_PORT/api/system/performance" 2>/dev/null || echo "{}")
total_requests=$(echo "$perf_response" | grep -o '"totalRequests":[^,}]*' | cut -d':' -f2 | tr -d '"' || echo "0")

if [ "$total_requests" -gt 0 ]; then
    echo -e "${GREEN}✅ Performance monitoring is active (${total_requests} requests tracked)${NC}"
else
    echo -e "${YELLOW}⚠️ Performance monitoring shows no requests yet${NC}"
fi

echo ""

# Summary
echo -e "${GREEN}📊 Health Check Summary${NC}"
echo "=================================="
echo "Application URL: http://localhost:$APP_PORT"
echo "Dashboard: http://localhost:$APP_PORT/dashboard"
echo "System Health: http://localhost:$APP_PORT/api/system/health"
echo "HLS Endpoint: http://localhost:$NGINX_PORT/hls"
echo ""
echo "Overall System Health: $overall_health"
echo "Service Container: $services_initialized"
echo "Total Requests Tracked: $total_requests"
echo ""

if [ "$overall_health" = "healthy" ] && [ "$services_initialized" = "true" ]; then
    echo -e "${GREEN}🎉 All health checks passed! System is operational.${NC}"
    exit 0
else
    echo -e "${RED}⚠️ Some health checks failed. Please review the system.${NC}"
    exit 1
fi