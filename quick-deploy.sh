#!/bin/bash

# Quick Deployment Script for Cloud Playout on Ubuntu 20.04
# Server: 109.199.120.192

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Cloud Playout Quick Deployment Script${NC}"
echo -e "${BLUE}Server: 109.199.120.192${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_warning "This script should not be run as root. Please run as a regular user with sudo privileges."
   exit 1
fi

# Update system
echo -e "${YELLOW}📦 Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y
print_status "System updated"

# Install required packages
echo -e "${YELLOW}📦 Installing required packages...${NC}"
sudo apt install -y \
    curl \
    wget \
    git \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    ufw \
    htop \
    nano
print_status "Required packages installed"

# Install Docker
echo -e "${YELLOW}🐳 Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io
    sudo usermod -aG docker $USER
    sudo systemctl start docker
    sudo systemctl enable docker
    print_status "Docker installed"
else
    print_status "Docker already installed"
fi

# Install Docker Compose
echo -e "${YELLOW}🐳 Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    print_status "Docker Compose installed"
else
    print_status "Docker Compose already installed"
fi

# Setup firewall
echo -e "${YELLOW}🔥 Configuring firewall...${NC}"
sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 8080/tcp
print_status "Firewall configured"

# Create application directory
echo -e "${YELLOW}📁 Setting up application directory...${NC}"
sudo mkdir -p /opt/cloud-playout
sudo chown $USER:$USER /opt/cloud-playout
print_status "Application directory created"

# Generate secure keys
echo -e "${YELLOW}🔐 Generating secure keys...${NC}"
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)
DB_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)

print_status "Secure keys generated"

# Create environment file
echo -e "${YELLOW}⚙️  Creating production environment file...${NC}"
cat > /opt/cloud-playout/.env.production << EOF
# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=cloud_playout
DB_USER=postgres
DB_PASSWORD=${DB_PASSWORD}

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# Application Configuration
NODE_ENV=production
APP_PORT=3000
LOG_LEVEL=info

# Security
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Streaming Configuration
STREAM_OUTPUT_DIR=/app/hls
HLS_BASE_URL=http://109.199.120.192/hls

# Nginx Configuration
NGINX_PORT=80
NGINX_SSL_PORT=443

# Monitoring
GRAFANA_PASSWORD=admin123
EOF

print_status "Environment file created"

echo ""
echo -e "${GREEN}🎉 Server setup completed!${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Upload your application files to: /opt/cloud-playout/"
echo "2. Navigate to the directory: cd /opt/cloud-playout"
echo "3. Run the deployment: ./scripts/deploy.sh production"
echo ""
echo -e "${YELLOW}📊 Generated Credentials:${NC}"
echo "Database Password: ${DB_PASSWORD}"
echo "JWT Secret: ${JWT_SECRET}"
echo "Encryption Key: ${ENCRYPTION_KEY}"
echo ""
echo -e "${YELLOW}🔗 Access URLs (after deployment):${NC}"
echo "Application: http://109.199.120.192:3000"
echo "Dashboard: http://109.199.120.192:3000/dashboard"
echo "API: http://109.199.120.192:3000/api"
echo "Health Check: http://109.199.120.192:3000/health"
echo ""
echo -e "${BLUE}💡 Note: You may need to log out and log back in for Docker group changes to take effect.${NC}"