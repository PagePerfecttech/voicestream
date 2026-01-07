# 🚀 Cloud Playout Deployment Checklist

## Server Information
- **IP Address**: 109.199.120.192
- **OS**: Ubuntu 20.04
- **Application**: Cloud Playout SaaS Platform

## Pre-Deployment Checklist

### ✅ Local Machine Preparation
- [ ] Application code is ready and tested
- [ ] All environment variables are configured
- [ ] Docker files are present and tested
- [ ] Database migrations are ready
- [ ] SSL certificates prepared (if using HTTPS)

### ✅ Server Access
- [ ] SSH access to server confirmed
- [ ] Server has sufficient resources (CPU, RAM, Disk)
- [ ] Domain name configured (if applicable)
- [ ] Firewall rules planned

## Deployment Steps

### Step 1: Server Preparation
```bash
# Run this on your server (109.199.120.192)
wget https://raw.githubusercontent.com/your-repo/cloud-playout/main/quick-deploy.sh
chmod +x quick-deploy.sh
./quick-deploy.sh
```

**What this does:**
- [ ] Updates system packages
- [ ] Installs Docker and Docker Compose
- [ ] Configures firewall
- [ ] Creates application directory
- [ ] Generates secure keys
- [ ] Creates production environment file

### Step 2: Upload Application
```bash
# Run this from your local machine
chmod +x upload-to-server.sh
./upload-to-server.sh
```

**What this does:**
- [ ] Uploads all application files to server
- [ ] Excludes unnecessary files (node_modules, logs, etc.)
- [ ] Makes scripts executable

### Step 3: Deploy Application
```bash
# SSH to your server
ssh root@109.199.120.192

# Navigate to application directory
cd /opt/cloud-playout

# Run deployment
./scripts/deploy.sh production
```

**What this does:**
- [ ] Builds Docker images
- [ ] Starts all services (App, Database, Redis, Nginx)
- [ ] Runs database migrations
- [ ] Performs health checks
- [ ] Displays service information

## Post-Deployment Verification

### ✅ Service Health Checks
- [ ] Application: `curl http://109.199.120.192:3000/health`
- [ ] System API: `curl http://109.199.120.192:3000/api/system/health`
- [ ] Database: `docker-compose -f docker-compose.prod.yml exec postgres pg_isready`
- [ ] Redis: `docker-compose -f docker-compose.prod.yml exec redis redis-cli ping`

### ✅ Container Status
```bash
docker-compose -f docker-compose.prod.yml ps
```
All containers should show "Up (healthy)" status.

### ✅ Application Access
- [ ] Main App: http://109.199.120.192:3000
- [ ] Dashboard: http://109.199.120.192:3000/dashboard
- [ ] API Docs: http://109.199.120.192:3000/api
- [ ] HLS Endpoint: http://109.199.120.192/hls

### ✅ Log Verification
```bash
# Check application logs
docker-compose -f docker-compose.prod.yml logs app

# Check all service logs
docker-compose -f docker-compose.prod.yml logs
```

## Security Checklist

### ✅ Firewall Configuration
- [ ] SSH (22) - Restricted to your IP
- [ ] HTTP (80) - Open
- [ ] HTTPS (443) - Open
- [ ] App Port (3000) - Open
- [ ] Database (5432) - Blocked externally
- [ ] Redis (6379) - Blocked externally

### ✅ SSL/TLS (Optional but Recommended)
- [ ] SSL certificate obtained
- [ ] Nginx configured for HTTPS
- [ ] HTTP to HTTPS redirect enabled
- [ ] Certificate auto-renewal configured

### ✅ Environment Security
- [ ] Strong database password set
- [ ] JWT secret is secure (32+ characters)
- [ ] Encryption key is secure (32 characters)
- [ ] Default passwords changed
- [ ] Environment file permissions secured

## Monitoring Setup

### ✅ Basic Monitoring
- [ ] Application health endpoint working
- [ ] System health endpoint working
- [ ] Log rotation configured
- [ ] Disk space monitoring

### ✅ Optional Advanced Monitoring
- [ ] Prometheus metrics collection
- [ ] Grafana dashboards configured
- [ ] Alert notifications setup
- [ ] Performance monitoring active

## Backup Strategy

### ✅ Database Backup
```bash
# Create backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres cloud_playout > backup_$(date +%Y%m%d_%H%M%S).sql

# Schedule daily backups (crontab)
0 2 * * * cd /opt/cloud-playout && docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres cloud_playout > /opt/backups/db_$(date +\%Y\%m\%d_\%H\%M\%S).sql
```

### ✅ Application Backup
- [ ] Code repository is up to date
- [ ] Configuration files backed up
- [ ] Media files backup strategy defined

## Maintenance Tasks

### ✅ Regular Maintenance
- [ ] System updates scheduled
- [ ] Docker image updates planned
- [ ] Log cleanup automated
- [ ] Backup verification scheduled

### ✅ Performance Optimization
- [ ] Resource usage monitored
- [ ] Database performance tuned
- [ ] Caching strategy implemented
- [ ] CDN configured (if needed)

## Troubleshooting Guide

### Common Issues and Solutions

#### Application Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs app

# Check environment variables
docker-compose -f docker-compose.prod.yml exec app env | grep -E "(DB_|REDIS_|NODE_ENV)"

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

#### Database Connection Issues
```bash
# Check database status
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U postgres

# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres

# Reset database (CAUTION: This will delete all data)
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d
```

#### High Resource Usage
```bash
# Check system resources
htop
df -h

# Check container resources
docker stats

# Restart specific service
docker-compose -f docker-compose.prod.yml restart app
```

## Emergency Procedures

### ✅ Service Recovery
```bash
# Stop all services
docker-compose -f docker-compose.prod.yml down

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Check service health
docker-compose -f docker-compose.prod.yml ps
```

### ✅ Database Recovery
```bash
# Restore from backup
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d cloud_playout < backup_file.sql
```

### ✅ Rollback Procedure
```bash
# Pull previous version
git checkout previous-stable-tag

# Redeploy
./scripts/deploy.sh production
```

## Support Contacts

- **System Administrator**: [Your Contact]
- **Development Team**: [Team Contact]
- **Emergency Contact**: [Emergency Contact]

## Documentation Links

- Application Documentation: `/docs`
- API Documentation: `http://109.199.120.192:3000/api`
- System Health: `http://109.199.120.192:3000/api/system/health`

---

**Deployment Date**: ___________
**Deployed By**: ___________
**Version**: ___________
**Notes**: ___________