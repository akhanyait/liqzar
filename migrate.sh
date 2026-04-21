#!/bin/bash

# LIQZAR Monorepo Migration Script
# This script helps migrate from Capacitor to the new monorepo structure

set -e  # Exit on error

echo "🚀 LIQZAR Monorepo Migration Script"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Function to prompt for confirmation
confirm() {
    read -p "$1 (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Aborted by user.${NC}"
        exit 1
    fi
}

echo "⚠️  WARNING: This script will restructure your project!"
echo "   It's recommended to have a backup or commit all changes."
echo ""
confirm "Do you want to continue?"

# Step 1: Check for uncommitted changes
echo ""
echo "📋 Step 1: Checking for uncommitted changes..."
if ! git diff --quiet 2>/dev/null; then
    echo -e "${YELLOW}You have uncommitted changes.${NC}"
    confirm "Do you want to continue anyway?"
fi
echo -e "${GREEN}✓ Git check complete${NC}"

# Step 2: Create backup
echo ""
echo "💾 Step 2: Creating backup..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="../liqzar-backup-${TIMESTAMP}"

if [ -d "$BACKUP_DIR" ]; then
    echo -e "${YELLOW}Backup directory already exists: $BACKUP_DIR${NC}"
else
    cp -r . "$BACKUP_DIR"
    echo -e "${GREEN}✓ Backup created at: $BACKUP_DIR${NC}"
fi

# Step 3: Create monorepo directories
echo ""
echo "📁 Step 3: Creating monorepo structure..."
mkdir -p apps/web
mkdir -p packages/{api-client,types,auth,utils}/src
echo -e "${GREEN}✓ Directories created${NC}"

# Step 4: Move web files
echo ""
echo "📦 Step 4: Moving web app files to apps/web/..."

# Files to move
if [ -d "src" ]; then
    mv src apps/web/ 2>/dev/null || echo "src already moved"
fi

if [ -d "public" ]; then
    mv public apps/web/ 2>/dev/null || echo "public already moved"
fi

if [ -f "index.html" ]; then
    mv index.html apps/web/ 2>/dev/null || echo "index.html already moved"
fi

if [ -f "vite.config.ts" ]; then
    mv vite.config.ts apps/web/ 2>/dev/null || echo "vite.config.ts already moved"
fi

# Move config files
for file in tsconfig.*.json tailwind.config.ts postcss.config.js components.json eslint.config.js; do
    if [ -f "$file" ]; then
        mv "$file" apps/web/ 2>/dev/null || echo "$file already moved"
    fi
done

echo -e "${GREEN}✓ Web files moved${NC}"

# Step 5: Update package.json files
echo ""
echo "📝 Step 5: Setting up package configurations..."

# Backup and replace root package.json
if [ -f "package.json.new" ]; then
    if [ -f "package.json" ] && [ ! -f "package.json.old" ]; then
        cp package.json package.json.old
    fi
    mv package.json.new package.json 2>/dev/null || echo "package.json already updated"
    echo -e "${GREEN}✓ Root package.json updated${NC}"
else
    echo -e "${YELLOW}⚠ package.json.new not found${NC}"
fi

# Step 6: Remove Capacitor
echo ""
echo "🗑️  Step 6: Removing Capacitor..."
confirm "Remove Capacitor files and dependencies?"

# Remove iOS directory
if [ -d "ios" ]; then
    rm -rf ios
    echo -e "${GREEN}✓ Removed ios/ directory${NC}"
fi

# Remove capacitor config
if [ -f "capacitor.config.ts" ]; then
    rm capacitor.config.ts
    echo -e "${GREEN}✓ Removed capacitor.config.ts${NC}"
fi

echo -e "${GREEN}✓ Capacitor removed${NC}"

# Step 7: Install dependencies
echo ""
echo "📦 Step 7: Installing dependencies..."
confirm "Install Yarn workspace dependencies? (This may take a few minutes)"

# Install yarn if not present
if ! command -v yarn &> /dev/null; then
    echo "Installing Yarn..."
    npm install -g yarn
fi

# Install dependencies
yarn install

echo -e "${GREEN}✓ Dependencies installed${NC}"

# Step 8: Install mobile dependencies
echo ""
echo "📱 Step 8: Setting up mobile app..."

if [ -d "apps/mobile" ]; then
    cd apps/mobile
    
    # Create .env if it doesn't exist
    if [ ! -f ".env" ] && [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠ Created .env from .env.example - please update with your API keys${NC}"
    fi
    
    # Install dependencies
    if [ -f "package.json" ]; then
        yarn install
        echo -e "${GREEN}✓ Mobile dependencies installed${NC}"
    fi
    
    cd ../..
else
    echo -e "${YELLOW}⚠ apps/mobile directory not found${NC}"
fi

# Step 9: Summary
echo ""
echo "✅ Migration Complete!"
echo "===================="
echo ""
echo "Next steps:"
echo ""
echo "1. Update apps/mobile/.env with your API configuration:"
echo "   cd apps/mobile && nano .env"
echo ""
echo "2. Test the web app:"
echo "   cd apps/web && yarn dev"
echo ""
echo "3. Test the mobile app:"
echo "   cd apps/mobile && yarn start"
echo ""
echo "4. Review the migration plan:"
echo "   cat MONOREPO_MIGRATION_PLAN.md"
echo ""
echo "5. Read the setup guide:"
echo "   cat SETUP_GUIDE.md"
echo ""
echo -e "${GREEN}Your backup is located at: $BACKUP_DIR${NC}"
echo ""
echo "If something went wrong, you can restore from backup:"
echo "   rm -rf * && cp -r $BACKUP_DIR/* ."
echo ""
echo "Happy coding! 🎉"
