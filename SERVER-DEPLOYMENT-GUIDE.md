# 🚀 Cloud Playout Server Deployment Guide

## Server Information
- **IP Address**: 109.199.120.192
- **OS**: Ubuntu 20.04
- **Application**: Cloud Playout SaaS Platform

## 🔧 **Issues Fixed**

### 1. **Environment Configuration**
- ✅ Fixed database connection string format
- ✅ Added proper SSL configuration for Neon database
- ✅ Improved environment variable validation

### 2. **Database Configuration**
- ✅ Enhanced Knex configuration with better connection pooling
- ✅ Added connection timeouts and retry logic
- ✅ Improved error handling for database initialization

### 3. **Redis Configuration**
- ✅ Added reconnection strategy
- ✅ Improved error handling and timeout configuration
- ✅ Better graceful degradation when Redis is unavailable

### 4. **Docker Configuration**
- ✅ Enhanced health checks with proper timeouts
- ✅ Added resource limits to prevent memory issues
- ✅ Improved service dependencies and startup order

### 5. **Deployment Scripts**
- ✅ Created comprehensive deployment script with better error handling
- ✅ Added server setup script for initial configuration
- ✅ Improved logging and monitoring

## 📋 **Deployment Steps**

### **Step 1: Initial Server Setup**

Connect to your server and run the setup script:

```bash
# SSH to your server
ssh root@109.199.120.192

# Download and run the server setup script
wget https://raw.githubusercontent.com/your-repo/voicestream/main/scripts/server-setup.sh
chmod +x server-setup.sh
./server-setup.sh
```

This will:
- Install Docker and Docker Compose
- Configure firewall
- Create necessary directories
- Set up monitoring and backup scripts
- Optimize system for production

### **Step 2: Upload Application Files**

From your local machine, upload the application:

```bash
# Make the upload script executable
chmod +x upload-to-server.sh

# Upload files to server
./upload-to-server.sh
```

### **Step 3: Configure Environment**

On the server, configure your production environment:

```bash
cd /opt/cloud-playout

# Copy and edit the production environment file
cp .env.production.example .env.production
nano .env.production
```

Ensure these variables are properly set:
```bash
# Database (Neon)
DATABASE_URL=postgresql://neondb_owner:npg_08QpAtifOnXI@ep-steep-darkness-adouuupb-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
NEON_DATABASE_URL=postgresql://neondb_owner:npg_08QpAtifOnXI@ep-steep-darkness-adouuupb-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require

# Security (Generate new keys)
JWT_SECRET=your_secure_jwt_secret_32_characters_minimum
ENCRYPTION_KEY=your_32_character_encryption_key_here

# Application
NODE_ENV=production
APP_PORT=3000
HLS_BASE_URL=http://109.199.120.192/hls
```

### **Step 4: Deploy Application**

Run the enhanced deployment script:

```bash
# Make deployment script executable
chmod +x scripts/deploy-production.sh

# Deploy the application
./scripts/deploy-production.sh production
```

## 🔍 **Verification Steps**

### **1. Check Container Status**
```bash
docker-compose -f docker-compose.neon.yml ps
```
All containers should show "Up (healthy)" status.

### **2. Test Application Endpoints**
```bash
# Application health
curl http://109.199.120.192:3000/health

# System health
curl http://109.199.120.192:3000/api/system/health

# Dashboard
curl -I http://109.199.120.192:3000/dashboard
```

### **3. Check Logs**
```bash
# Application logs
docker-compose -f docker-compose.neon.yml logs app

# All service logs
docker-compose -f docker-compose.neon.yml logs
```

## 🛠️ **Troubleshooting Common Issues**

### **Issue 1: High Memory Usage**
**Symptoms**: Memory warnings in logs, containers being killed
**Solution**:
```bash
# Check system resources
free -h
docker stats

# Restart services to clear memory
docker-compose -f docker-compose.neon.yml restart

# If persistent, increase server memory or optimize application
```

### **Issue 2: Database Connection Failures**
**Symptoms**: "Database initialization failed" errors
**Solution**:
```bash
# Test database connection manually
psql "postgresql://neondb_owner:npg_08QpAtifOnXI@ep-steep-darkness-adouuupb-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require" -c "SELECT 1;"

# Check environment variables
docker-compose -f docker-compose.neon.yml exec app env | grep DATABASE

# Restart application
docker-compose -f docker-compose.neon.yml restart app
```

### **Issue 3: Redis Connection Issues**
**Symptoms**: Redis connection errors, caching not working
**Solution**:
```bash
# Check Redis status
docker-compose -f docker-compose.neon.yml exec redis redis-cli ping

# Check Redis logs
docker-compose -f docker-compose.neon.yml logs redis

# Restart Redis
docker-compose -f docker-compose.neon.yml restart redis
```

### **Issue 4: Nginx/HLS Issues**
**Symptoms**: 502 errors, HLS streams not accessible
**Solution**:
```bash
# Check Nginx status
curl http://109.199.120.192/health

# Check Nginx logs
docker-compose -f docker-compose.neon.yml logs nginx

# Test upstream connection
docker-compose -f docker-compose.neon.yml exec nginx wget -qO- http://app:3000/health
```

## 📊 **Monitoring and Maintenance**

### **System Health Monitoring**
The deployment includes automatic health checks:
- Application health: Every 5 minutes
- System resources: Continuous monitoring
- Automatic log rotation: Daily

### **Backup Strategy**
Automated backups are configured:
- Application files: Daily at 2 AM
- Database: Manual (Neon handles backups)
- Retention: 7 days

### **Log Management**
Logs are automatically rotated and managed:
- Application logs: `/opt/cloud-playout/logs/`
- System logs: `/var/log/cloud-playout/`
- Docker logs: Managed by Docker with size limits

## 🔧 **Performance Optimization**

### **Resource Limits**
The deployment includes optimized resource limits:
- **Application**: 2 CPU cores, 2GB RAM
- **Redis**: 0.5 CPU cores, 512MB RAM
- **Nginx**: 0.5 CPU cores, 256MB RAM

### **Caching Strategy**
- Redis for application caching
- Nginx for static content caching
- HLS segment caching optimized for streaming

## 🚨 **Emergency Procedures**

### **Complete Service Restart**
```bash
cd /opt/cloud-playout
docker-compose -f docker-compose.neon.yml down
docker-compose -f docker-compose.neon.yml up -d
```

### **Database Recovery**
```bash
# If using database backups
docker-compose -f docker-compose.neon.yml exec app npm run migrate:latest
```

### **Rollback Deployment**
```bash
# Restore from backup
cd /opt/backups
tar -xzf deployment_YYYYMMDD_HHMMSS.tar.gz -C /opt/cloud-playout
cd /opt/cloud-playout
./scripts/deploy-production.sh production
```

## 📞 **Support Information**

### **Service URLs**
- **Application**: http://109.199.120.192:3000
- **Dashboard**: http://109.199.120.192:3000/dashboard
- **API**: http://109.199.120.192:3000/api
- **HLS Streams**: http://109.199.120.192/hls
- **Health Check**: http://109.199.120.192:3000/health

### **Useful Commands**
```bash
# View all logs
docker-compose -f docker-compose.neon.yml logs -f

# Check container status
docker-compose -f docker-compose.neon.yml ps

# Restart specific service
docker-compose -f docker-compose.neon.yml restart app

# Update deployment
./scripts/deploy-production.sh production

# Manual backup
/usr/local/bin/cloud-playout-backup.sh

# System health check
/usr/local/bin/cloud-playout-health.sh
```

## ✅ **Deployment Checklist**

- [ ] Server setup completed
- [ ] Application files uploaded
- [ ] Environment variables configured
- [ ] Database connection tested
- [ ] Application deployed successfully
- [ ] All health checks passing
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] Firewall configured
- [ ] SSL certificate installed (optional)

---

**Deployment completed successfully! Your Cloud Playout SaaS platform is now running in production.**