#!/bin/bash

# Fix Server Directory Structure
# This script fixes the issue where files are in /opt/cloud-playout/voicestream/ instead of /opt/cloud-playout/

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Fixing server directory structure...${NC}"

# Check current directory
CURRENT_DIR=$(pwd)
echo "Current directory: $CURRENT_DIR"

# Check if we're in /opt/cloud-playout and voicestream subdirectory exists
if [ "$CURRENT_DIR" = "/opt/cloud-playout" ] && [ -d "voicestream" ]; then
    echo -e "${YELLOW}📁 Found voicestream subdirectory, moving files to parent directory...${NC}"
    
    # Move all files from voicestream/ to current directory
    mv voicestream/* . 2>/dev/null
    mv voicestream/.* . 2>/dev/null || true  # Move hidden files, ignore errors
    
    # Remove empty voicestream directory
    rmdir voicestream 2>/dev/null || true
    
    echo -e "${GREEN}✅ Files moved successfully!${NC}"
    
elif [ -f "package.json" ] && [ -f "scripts/deploy-neon.sh" ]; then
    echo -e "${GREEN}✅ Files are already in the correct location!${NC}"
    
else
    echo -e "${RED}❌ Cannot determine directory structure. Please check manually.${NC}"
    echo "Expected files: package.json, scripts/deploy-neon.sh"
    echo "Current directory contents:"
    ls -la
    exit 1
fi

# Make scripts executable
echo -e "${YELLOW}🔧 Making scripts executable...${NC}"
chmod +x scripts/*.sh 2>/dev/null || true
chmod +x *.sh 2>/dev/null || true

# Verify required files exist
echo -e "${YELLOW}🔍 Verifying required files...${NC}"
required_files=("package.json" "scripts/deploy-neon.sh" "docker-compose.neon.yml" ".env.production")

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ $file (missing)${NC}"
    fi
done

echo ""
echo -e "${GREEN}🎉 Directory structure fixed!${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Install Docker: ./scripts/install-docker.sh"
echo "2. Deploy application: ./scripts/deploy-neon.sh"
echo ""
echo -e "${YELLOW}🔍 Current directory contents:${NC}"
ls -la