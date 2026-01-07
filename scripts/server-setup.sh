#!/bin/bash

# Server Setup Script for Cloud Playout SaaS on Ubuntu 20.04
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SERVER_IP="109.199.120.192"
APP_DIR="/opt/cloud-playout"
BACKUP_DIR="/opt/backups"

echo -e "${GREEN}🚀 Setting up Cloud Playout server on Ubuntu 20.04...${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ This script must be run as root${NC}"
    echo "Please run: sudo $0"
    exit 1
fi

# Update system packages
echo -e "${YELLOW}📦 Updating system packages...${NC}"
apt update && apt upgrade -y

# Install required system packages
echo -e "${YELLOW}📦 Installing required packages...${NC}"
apt install -y \
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
    nano \
    vim \
    tree \
    jq \
    postgresql-client \
    redis-tools

# Install Docker
echo -e "${YELLOW}🐳 Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io

    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    echo -e "${GREEN}✅ Docker installed successfully${NC}"
else
    echo -e "${GREEN}✅ Docker already installed${NC}"
fi

# Install Docker Compose
echo -e "${YELLOW}🐳 Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    # Download Docker Compose
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

    # Make it executable
    chmod +x /usr/local/bin/docker-compose
    
    echo -e "${GREEN}✅ Docker Compose installed successfully${NC}"
else
    echo -e "${GREEN}✅ Docker Compose already installed${NC}"
fi

# Verify Docker installation
echo -e "${YELLOW}🔍 Verifying Docker installation...${NC}"
docker --version
docker-compose --version

# Setup firewall
echo -e "${YELLOW}🔥 Configuring firewall...${NC}"
ufw --force enable

# Allow SSH
ufw allow ssh

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow application port
ufw allow 3000/tcp

# Optional: Allow monitoring ports
ufw allow 9090/tcp  # Prometheus
ufw allow 3001/tcp  # Grafana

# Show firewall status
ufw status

echo -e "${GREEN}✅ Firewall configured${NC}"

# Create application directory
echo -e "${YELLOW}📁 Creating application directories...${NC}"
mkdir -p $APP_DIR
mkdir -p $BACKUP_DIR
mkdir -p /var/log/cloud-playout

# Set proper permissions
chmod 755 $APP_DIR
chmod 755 $BACKUP_DIR
chmod 755 /var/log/cloud-playout

echo -e "${GREEN}✅ Directories created${NC}"

# Create a non-root user for the application (optional)
if ! id "cloudplayout" &>/dev/null; then
    echo -e "${YELLOW}👤 Creating application user...${NC}"
    useradd -r -s /bin/false -d $APP_DIR cloudplayout
    usermod -aG docker cloudplayout
    chown -R cloudplayout:cloudplayout $APP_DIR
    echo -e "${GREEN}✅ Application user created${NC}"
fi

# Setup log rotation
echo -e "${YELLOW}📝 Setting up log rotation...${NC}"
cat > /etc/logrotate.d/cloud-playout << EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
    su cloudplayout cloudplayout
}

/var/log/cloud-playout/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

echo -e "${GREEN}✅ Log rotation configured${NC}"

# Optimize system for Docker
echo -e "${YELLOW}⚙️ Optimizing system for Docker...${NC}"

# Increase file descriptor limits
cat >> /etc/security/limits.conf << EOF
* soft nofile 65536
* hard nofile 65536
root soft nofile 65536
root hard nofile 65536
EOF

# Configure Docker daemon
cat > /etc/docker/daemon.json << EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "live-restore": true,
  "userland-proxy": false,
  "experimental": false
}
EOF

# Restart Docker to apply configuration
systemctl restart docker

echo -e "${GREEN}✅ System optimization completed${NC}"

# Create systemd service for the application (optional)
echo -e "${YELLOW}🔧 Creating systemd service...${NC}"
cat > /etc/systemd/system/cloud-playout.service << EOF
[Unit]
Description=Cloud Playout SaaS Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
ExecStart=/usr/local/bin/docker-compose -f docker-compose.neon.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.neon.yml down
TimeoutStartSec=0
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable cloud-playout.service

echo -e "${GREEN}✅ Systemd service created${NC}"

# Setup monitoring (basic)
echo -e "${YELLOW}📊 Setting up basic monitoring...${NC}"

# Create a simple health check script
cat > /usr/local/bin/cloud-playout-health.sh << 'EOF'
#!/bin/bash

APP_URL="http://localhost:3000/health"
LOG_FILE="/var/log/cloud-playout/health-check.log"

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Check application health
if curl -f -s "$APP_URL" > /dev/null 2>&1; then
    echo "$(date): Application is healthy" >> "$LOG_FILE"
    exit 0
else
    echo "$(date): Application health check failed" >> "$LOG_FILE"
    # Optionally restart the service
    # systemctl restart cloud-playout
    exit 1
fi
EOF

chmod +x /usr/local/bin/cloud-playout-health.sh

# Add health check to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/cloud-playout-health.sh") | crontab -

echo -e "${GREEN}✅ Basic monitoring setup completed${NC}"

# Setup backup script
echo -e "${YELLOW}💾 Setting up backup script...${NC}"
cat > /usr/local/bin/cloud-playout-backup.sh << EOF
#!/bin/bash

BACKUP_DIR="$BACKUP_DIR"
APP_DIR="$APP_DIR"
DATE=\$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p "\$BACKUP_DIR"

# Backup application files
tar -czf "\$BACKUP_DIR/app_backup_\$DATE.tar.gz" -C "\$APP_DIR" --exclude='node_modules' --exclude='logs' --exclude='dist' .

# Backup database (if using local PostgreSQL)
# docker-compose -f \$APP_DIR/docker-compose.neon.yml exec postgres pg_dump -U postgres cloud_playout > "\$BACKUP_DIR/db_backup_\$DATE.sql"

# Keep only last 7 days of backups
find "\$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
find "\$BACKUP_DIR" -name "*.sql" -mtime +7 -delete

echo "\$(date): Backup completed - \$BACKUP_DIR/app_backup_\$DATE.tar.gz"
EOF

chmod +x /usr/local/bin/cloud-playout-backup.sh

# Add backup to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/cloud-playout-backup.sh") | crontab -

echo -e "${GREEN}✅ Backup script setup completed${NC}"

# Display system information
echo ""
echo -e "${GREEN}🎉 Server setup completed successfully!${NC}"
echo ""
echo -e "${BLUE}📊 System Information:${NC}"
echo "Server IP: $SERVER_IP"
echo "Application Directory: $APP_DIR"
echo "Backup Directory: $BACKUP_DIR"
echo "Docker Version: $(docker --version)"
echo "Docker Compose Version: $(docker-compose --version)"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Upload your application files to $APP_DIR"
echo "2. Configure your .env.production file"
echo "3. Run the deployment script: ./scripts/deploy-production.sh"
echo ""
echo -e "${BLUE}📋 Useful Commands:${NC}"
echo "Check system status: systemctl status cloud-playout"
echo "View logs: journalctl -u cloud-playout -f"
echo "Manual backup: /usr/local/bin/cloud-playout-backup.sh"
echo "Health check: /usr/local/bin/cloud-playout-health.sh"
echo ""
echo -e "${YELLOW}📝 Server setup completed at: $(date)${NC}"