#!/bin/bash

# Install Docker on Ubuntu 20.04
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🐳 Installing Docker on Ubuntu 20.04...${NC}"

# Update package index
echo -e "${YELLOW}📦 Updating package index...${NC}"
apt update

# Install prerequisites
echo -e "${YELLOW}📦 Installing prerequisites...${NC}"
apt install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Remove old Docker GPG key if it exists
echo -e "${YELLOW}🔑 Cleaning up old Docker GPG keys...${NC}"
rm -f /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker's official GPG key with the correct method
echo -e "${YELLOW}🔑 Adding Docker's official GPG key...${NC}"
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo -e "${YELLOW}📦 Adding Docker repository...${NC}"
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package index again
echo -e "${YELLOW}📦 Updating package index with Docker repository...${NC}"
apt update

# Install Docker
echo -e "${YELLOW}🐳 Installing Docker...${NC}"
apt install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
echo -e "${YELLOW}🐙 Installing Docker Compose...${NC}"
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Start and enable Docker
echo -e "${YELLOW}🚀 Starting Docker service...${NC}"
systemctl start docker
systemctl enable docker

# Verify installation
echo -e "${YELLOW}🔍 Verifying Docker installation...${NC}"
docker --version
docker-compose --version

# Test Docker
echo -e "${YELLOW}🧪 Testing Docker...${NC}"
docker run --rm hello-world

echo -e "${GREEN}✅ Docker installation completed successfully!${NC}"
echo ""
echo -e "${YELLOW}📋 Docker Information:${NC}"
echo "Docker version: $(docker --version)"
echo "Docker Compose version: $(docker-compose --version)"
echo "Docker service status: $(systemctl is-active docker)"