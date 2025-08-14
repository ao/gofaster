#!/bin/bash

# GoFaster Chrome Extension Build Script
# This script creates a production-ready zip file for Chrome Web Store submission

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Building GoFaster Chrome Extension${NC}"

# Check if we're in the right directory
if [ ! -f "manifest.json" ]; then
    echo -e "${RED}❌ Error: manifest.json not found. Please run this script from the extension root directory.${NC}"
    exit 1
fi

# Get version from manifest.json
VERSION=$(cat manifest.json | grep '"version"' | sed 's/.*"version": "\([^"]*\)".*/\1/')
echo -e "${BLUE}📦 Building version: ${VERSION}${NC}"

# Create build directory
BUILD_DIR="build"
DIST_DIR="dist"

echo -e "${YELLOW}🧹 Cleaning previous builds...${NC}"
rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$BUILD_DIR" "$DIST_DIR"

# Copy extension files
echo -e "${YELLOW}📁 Copying extension files...${NC}"
cp -r popup "$BUILD_DIR/"
cp -r content "$BUILD_DIR/"
cp -r background "$BUILD_DIR/"
cp -r icons "$BUILD_DIR/"
cp manifest.json "$BUILD_DIR/"

# Validate required files
echo -e "${YELLOW}✅ Validating extension structure...${NC}"
required_files=(
    "manifest.json"
    "popup/popup.html"
    "popup/popup.js"
    "popup/popup.css"
    "content/content.js"
    "content/content.css"
    "background/background.js"
)

for file in "${required_files[@]}"; do
    if [ -f "$BUILD_DIR/$file" ]; then
        echo -e "${GREEN}  ✓ $file${NC}"
    else
        echo -e "${RED}  ❌ $file is missing${NC}"
        exit 1
    fi
done

# Check if icons directory has files
if [ -d "$BUILD_DIR/icons" ] && [ "$(ls -A $BUILD_DIR/icons)" ]; then
    echo -e "${GREEN}  ✓ icons directory${NC}"
else
    echo -e "${YELLOW}  ⚠️  icons directory is empty or missing${NC}"
fi

# Validate manifest.json
echo -e "${YELLOW}🔍 Validating manifest.json...${NC}"
if command -v jq &> /dev/null; then
    if cat "$BUILD_DIR/manifest.json" | jq . > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ manifest.json is valid JSON${NC}"
    else
        echo -e "${RED}  ❌ manifest.json is invalid JSON${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}  ⚠️  jq not found, skipping JSON validation${NC}"
fi

# Create zip file
ZIP_NAME="gofaster-v${VERSION}.zip"
echo -e "${YELLOW}📦 Creating zip package: ${ZIP_NAME}${NC}"

cd "$BUILD_DIR"
zip -r "../$DIST_DIR/$ZIP_NAME" . -x "*.DS_Store" "*/.*"
cd ..

# Calculate file size
FILE_SIZE=$(du -h "$DIST_DIR/$ZIP_NAME" | cut -f1)
echo -e "${GREEN}✅ Package created successfully!${NC}"
echo -e "${BLUE}📊 Package details:${NC}"
echo -e "  📁 File: $DIST_DIR/$ZIP_NAME"
echo -e "  📏 Size: $FILE_SIZE"
echo -e "  🏷️  Version: $VERSION"

# Run tests if available
if [ -f "package.json" ] && command -v bun &> /dev/null; then
    echo -e "${YELLOW}🧪 Running tests...${NC}"
    if bun test; then
        echo -e "${GREEN}  ✅ All tests passed${NC}"
    else
        echo -e "${RED}  ❌ Some tests failed${NC}"
        echo -e "${YELLOW}  ⚠️  Package created but tests failed. Review before publishing.${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠️  Tests not available (missing package.json or bun)${NC}"
fi

echo -e "${GREEN}🎉 Build complete!${NC}"
echo -e "${BLUE}📋 Next steps:${NC}"
echo -e "  1. Test the extension by loading $BUILD_DIR as unpacked extension"
echo -e "  2. Upload $DIST_DIR/$ZIP_NAME to Chrome Web Store"
echo -e "  3. Or create a GitHub release with tag v$VERSION"

# Optional: Open build directory
if command -v open &> /dev/null; then
    echo -e "${BLUE}🔍 Opening build directory...${NC}"
    open "$BUILD_DIR"
elif command -v xdg-open &> /dev/null; then
    echo -e "${BLUE}🔍 Opening build directory...${NC}"
    xdg-open "$BUILD_DIR"
fi
