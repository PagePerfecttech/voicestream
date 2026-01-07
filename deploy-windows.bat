@echo off
echo Deploying to server...

echo Pulling latest changes on server...
ssh root@109.199.120.192 "cd /opt/cloud-playout && git pull origin main && ./scripts/deploy-neon.sh"

echo Deployment completed!
pause