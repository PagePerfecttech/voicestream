#!/bin/bash

# Upload Cloud Playout Application to Server
# Run this script from your local machine where the application code is located

SERVER_IP="109.199.120.192"
SERVER_USER="root"  # Change this to your username if not root
SERVER_PATH="/opt/cloud-playout"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📤 Uploading Cloud Playout Application to Server${NC}"
echo -e "${BLUE}Server: ${SERVER_IP}${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "docker-compose.prod.yml" ]; then
    echo -e "${RED}❌ Error: This script must be run from the root directory of your Cloud Playout project${NC}"
    echo "Make sure you're in the directory that contains package.json and docker-compose.prod.yml"
    exit 1
fi

# Create list of files to exclude
cat > .upload-exclude << EOF
node_modules/
.git/
dist/
coverage/
logs/
*.log
.env
.env.local
.env.development
.DS_Store
Thumbs.db
*.tmp
*.temp
.upload-exclude
EOF

echo -e "${YELLOW}📋 Files to upload:${NC}"
echo "- Source code (src/)"
echo "- Configuration files"
echo "- Docker files"
echo "- Scripts"
echo "- Documentation"
echo ""

# Ask for confirmation
read -p "Do you want to proceed with the upload? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Upload cancelled."
    rm -f .upload-exclude
    exit 0
fi

# Test SSH connection
echo -e "${YELLOW}🔗 Testing SSH connection...${NC}"
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes ${SERVER_USER}@${SERVER_IP} exit 2>/dev/null; then
    echo -e "${RED}❌ Cannot connect to server. Please check:${NC}"
    echo "1. Server IP address: ${SERVER_IP}"
    echo "2. Username: ${SERVER_USER}"
    echo "3. SSH key or password authentication"
    echo "4. Server is running and accessible"
    rm -f .upload-exclude
    exit 1
fi

echo -e "${GREEN}✅ SSH connection successful${NC}"

# Create directory on server
echo -e "${YELLOW}📁 Creating directory on server...${NC}"
ssh ${SERVER_USER}@${SERVER_IP} "mkdir -p ${SERVER_PATH}"

# Upload files using rsync
echo -e "${YELLOW}📤 Uploading files...${NC}"
rsync -avz --progress \
    --exclude-from=.upload-exclude \
    --delete \
    ./ ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Files uploaded successfully!${NC}"
else
    echo -e "${RED}❌ Upload failed!${NC}"
    rm -f .upload-exclude
    exit 1
fi

# Make scripts executable
echo -e "${YELLOW}🔧 Making scripts executable...${NC}"
ssh ${SERVER_USER}@${SERVER_IP} "chmod +x ${SERVER_PATH}/scripts/*.sh"

# Clean up
rm -f .upload-exclude

echo ""
echo -e "${GREEN}🎉 Upload completed successfully!${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. SSH to your server: ssh ${SERVER_USER}@${SERVER_IP}"
echo "2. Navigate to app directory: cd ${SERVER_PATH}"
echo "3. Run deployment: ./scripts/deploy.sh production"
echo ""
echo -e "${YELLOW}🔗 SSH Command:${NC}"
echo "ssh ${SERVER_USER}@${SERVER_IP}"
echo ""
echo -e "${YELLOW}🚀 Deployment Command (run on server):${NC}"
echo "cd ${SERVER_PATH} && ./scripts/deploy.sh production"