# Cloud Playout Deployment Guide for Ubuntu 20.04

## Server Information
- **Server IP**: 109.199.120.192
- **OS**: Ubuntu 20.04
- **Application**: Cloud Playout SaaS Platform

## 1. Initial Server Setup

### Connect to your server:
```bash
ssh root@109.199.120.192
# or if you have a specific user:
ssh username@109.199.120.192
```

### Update system packages:
```bash
sudo apt update && sudo apt upgrade -y
```

### Install required system packages:
```bash
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
    nano \
    vim
```

## 2. Install Docker and Docker Compose

### Install Docker:
```bash
# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Add current user to docker group
sudo usermod -aG docker $USER

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker
```

### Install Docker Compose:
```bash
# Download Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make it executable
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

## 3. Setup Firewall

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow application port
sudo ufw allow 3000/tcp

# Allow HLS streaming port
sudo ufw allow 8080/tcp

# Optional: Allow monitoring ports
sudo ufw allow 9090/tcp  # Prometheus
sudo ufw allow 3001/tcp  # Grafana

# Check status
sudo ufw status
```

## 4. Clone and Setup Application

### Create application directory:
```bash
sudo mkdir -p /opt/cloud-playout
sudo chown $USER:$USER /opt/cloud-playout
cd /opt/cloud-playout
```

### Clone your repository:
```bash
# If using Git (replace with your repository URL)
git clone https://github.com/your-username/cloud-playout.git .

# Or upload your files using SCP from your local machine:
# scp -r /path/to/your/project/* username@109.199.120.192:/opt/cloud-playout/
```

## 5. Configure Environment

### Create production environment file:
```bash
cp .env.production.example .env.production
nano .env.production
```

### Update the environment variables:
```bash
# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=cloud_playout
DB_USER=postgres
DB_PASSWORD=your_secure_password_123!

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# Application Configuration
NODE_ENV=production
APP_PORT=3000
LOG_LEVEL=info

# Security (Generate strong keys)
JWT_SECRET=your_jwt_secret_key_minimum_32_characters_long
ENCRYPTION_KEY=your_32_character_encryption_key_here

# Streaming Configuration
STREAM_OUTPUT_DIR=/app/hls
HLS_BASE_URL=http://109.199.120.192/hls

# Nginx Configuration
NGINX_PORT=80
NGINX_SSL_PORT=443

# Monitoring
GRAFANA_PASSWORD=admin123
```

### Generate secure keys:
```bash
# Generate JWT Secret (32+ characters)
openssl rand -base64 32

# Generate Encryption Key (32 characters)
openssl rand -hex 16
```

## 6. Deploy the Application

### Make deployment script executable:
```bash
chmod +x scripts/deploy.sh
```

### Run the deployment:
```bash
./scripts/deploy.sh production
```

## 7. Verify Deployment

### Check running containers:
```bash
docker-compose -f docker-compose.prod.yml ps
```

### Check application health:
```bash
curl http://109.199.120.192:3000/health
curl http://109.199.120.192:3000/api/system/health
```

### Check logs:
```bash
docker-compose -f docker-compose.prod.yml logs -f app
```

## 8. Access Your Application

- **Main Application**: http://109.199.120.192:3000
- **Dashboard**: http://109.199.120.192:3000/dashboard
- **API**: http://109.199.120.192:3000/api
- **HLS Streams**: http://109.199.120.192/hls
- **System Health**: http://109.199.120.192:3000/api/system/health

## 9. Optional: Setup SSL Certificate

### Install Certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Get SSL certificate (if you have a domain):
```bash
sudo certbot --nginx -d your-domain.com
```

## 10. Monitoring and Maintenance

### View logs:
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

### Restart services:
```bash
docker-compose -f docker-compose.prod.yml restart
```

### Update application:
```bash
git pull origin main
./scripts/deploy.sh production
```

### Backup database:
```bash
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres cloud_playout > backup_$(date +%Y%m%d_%H%M%S).sql
```

## 11. Troubleshooting

### If containers fail to start:
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Check system resources
htop
df -h

# Restart Docker
sudo systemctl restart docker
```

### If database connection fails:
```bash
# Check PostgreSQL container
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d cloud_playout -c "SELECT 1;"
```

### If application is not accessible:
```bash
# Check if ports are open
sudo netstat -tlnp | grep :3000
sudo netstat -tlnp | grep :80

# Check firewall
sudo ufw status
```

## 12. Performance Optimization

### For production use, consider:
1. **Increase system limits**:
```bash
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf
```

2. **Optimize Docker**:
```bash
# Create Docker daemon configuration
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
EOF

sudo systemctl restart docker
```

3. **Setup log rotation**:
```bash
sudo tee /etc/logrotate.d/cloud-playout > /dev/null <<EOF
/opt/cloud-playout/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF
```

## Support

If you encounter any issues during deployment, check:
1. Container logs: `docker-compose -f docker-compose.prod.yml logs`
2. System resources: `htop` and `df -h`
3. Network connectivity: `curl http://localhost:3000/health`
4. Firewall settings: `sudo ufw status`