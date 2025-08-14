# GoFaster Chrome Extension - Deployment Guide

This document provides complete instructions for deploying the GoFaster Chrome extension using our automated GitHub Actions workflows.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Initial Setup](#initial-setup)
- [Deployment Methods](#deployment-methods)
- [Workflow Details](#workflow-details)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

## 🚀 Quick Start

If everything is already set up, here's how to deploy:

### Production Release
```bash
# 1. Ensure you're on main branch with latest changes
git checkout main
git pull origin main

# 2. Create and push a version tag
git tag v1.0.0
git push origin v1.0.0

# 3. GitHub Actions will automatically:
#    - Run tests
#    - Build extension
#    - Publish to Chrome Web Store
#    - Create GitHub release
```

### Beta Release
```bash
# Push to develop branch
git checkout develop
git push origin develop
# Creates automatic beta release with timestamp
```

## 🔧 Initial Setup

### Prerequisites Checklist

- [ ] Chrome Web Store Developer Account ($5 fee paid)
- [ ] Extension manually published once (to get Extension ID)
- [ ] Google Cloud Project with Chrome Web Store API enabled
- [ ] OAuth 2.0 credentials created
- [ ] GitHub repository with admin access

### Step 1: Chrome Web Store Setup

1. **Create Developer Account**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Pay $5 registration fee
   - Verify your identity

2. **Manual First Publish**
   - Build extension locally: `./scripts/build.sh`
   - Upload zip file to Chrome Web Store
   - Fill out store listing (name, description, screenshots)
   - Publish (can be private initially)
   - **Save the Extension ID** from the URL

### Step 2: Google Cloud Setup

1. **Create/Select Project**
   ```bash
   # Go to: https://console.cloud.google.com/
   # Create new project or select existing
   ```

2. **Enable Chrome Web Store API**
   - Navigate to "APIs & Services" > "Library"
   - Search "Chrome Web Store API"
   - Click "Enable"

3. **Create OAuth Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Application type: "Desktop application"
   - Name: "GoFaster Chrome Extension CI"
   - Download JSON credentials

### Step 3: Generate Refresh Token

Run this locally to get your refresh token:

```bash
# Create token generator script
cat > get_refresh_token.js << 'EOF'
const https = require('https');
const querystring = require('querystring');

const CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET_HERE';

console.log('1. Visit this URL:');
console.log(`https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&client_id=${CLIENT_ID}&redirect_uri=urn:ietf:wg:oauth:2.0:oob`);
console.log('\n2. Authorize and copy the code');
console.log('3. Run: node get_refresh_token.js <code>');

if (process.argv[2]) {
  const authCode = process.argv[2];
  const postData = querystring.stringify({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code: authCode,
    grant_type: 'authorization_code',
    redirect_uri: 'urn:ietf:wg:oauth:2.0:oob'
  });

  const req = https.request({
    hostname: 'accounts.google.com',
    path: '/o/oauth2/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const response = JSON.parse(data);
      if (response.refresh_token) {
        console.log('\n✅ Refresh Token:', response.refresh_token);
      } else {
        console.error('Error:', response);
      }
    });
  });

  req.write(postData);
  req.end();
}
EOF

# 1. Edit the script with your CLIENT_ID and CLIENT_SECRET
# 2. Run: node get_refresh_token.js
# 3. Follow the instructions
# 4. Save the refresh token
```

### Step 4: Configure GitHub Secrets

In your GitHub repository: Settings > Secrets and variables > Actions

Add these repository secrets:

| Secret Name | Where to Find | Example Format |
|-------------|---------------|----------------|
| `CHROME_EXTENSION_ID` | Chrome Web Store dashboard URL | `abcdefghijklmnopqrstuvwxyz123456` |
| `CHROME_CLIENT_ID` | Google Cloud OAuth credentials | `123456789-abc.apps.googleusercontent.com` |
| `CHROME_CLIENT_SECRET` | Google Cloud OAuth credentials | `GOCSPX-abcdefghijklmnopqrstuvwxyz` |
| `CHROME_REFRESH_TOKEN` | Generated in Step 3 | `1//04abcdefghijklmnopqrstuvwxyz` |

## 🎯 Deployment Methods

### Method 1: Automatic (Recommended)

**When:** Ready for production release

```bash
# 1. Merge all changes to main
git checkout main
git pull origin main

# 2. Update version in manifest.json (optional - workflow can do this)
# Edit manifest.json: "version": "1.0.1"

# 3. Create version tag
git tag v1.0.1
git push origin v1.0.1

# 4. Monitor GitHub Actions
# Go to: https://github.com/YOUR_USERNAME/gofaster/actions
```

**What happens:**
- ✅ Runs full test suite
- ✅ Updates manifest.json version
- ✅ Creates clean build package
- ✅ Uploads to Chrome Web Store
- ✅ Publishes automatically
- ✅ Creates GitHub release with download

### Method 2: Manual Trigger

**When:** Need to deploy specific version or retry failed deployment

1. Go to GitHub repository
2. Click "Actions" tab
3. Select "Chrome Web Store Deployment"
4. Click "Run workflow"
5. Enter version number (e.g., "1.0.2")
6. Click "Run workflow"

### Method 3: Beta/Testing

**When:** Testing new features before production

```bash
# Option A: Automatic beta from develop
git checkout develop
git push origin develop

# Option B: Manual beta
# Go to Actions > "Beta Release" > "Run workflow"
# Enter beta version like "1.0.0-beta.1"
```

**Beta features:**
- Creates pre-release on GitHub
- Extension name becomes "GoFaster (Beta)"
- Timestamped version numbers
- Not published to Chrome Web Store

### Method 4: Local Build Only

**When:** Testing locally or manual upload

```bash
# Build extension package
./scripts/build.sh

# Output: dist/gofaster-v1.0.0.zip
# Upload manually to Chrome Web Store
```

## 📊 Workflow Details

### Chrome Web Store Deployment Workflow

**File:** `.github/workflows/chrome-webstore.yml`

**Triggers:**
- Git tags matching `v*` (e.g., v1.0.0)
- Manual workflow dispatch

**Steps:**
1. **Test Job**
   - Checkout code
   - Setup Bun
   - Install dependencies
   - Run `bun test`

2. **Build and Deploy Job**
   - Extract version from tag/input
   - Update manifest.json version
   - Create clean build directory
   - Copy extension files (popup, content, background, icons, manifest)
   - Create zip package
   - Upload to Chrome Web Store
   - Create GitHub release

**Artifacts:**
- Extension zip file
- GitHub release with download link

### Continuous Integration Workflow

**File:** `.github/workflows/ci.yml`

**Triggers:**
- Push to main/develop branches
- Pull requests to main/develop

**Features:**
- Multi-version Node.js testing
- Extension structure validation
- Manifest.json validation
- Basic security checks
- Build artifact creation

### Beta Release Workflow

**File:** `.github/workflows/beta-release.yml`

**Triggers:**
- Push to develop branch
- Manual workflow dispatch

**Features:**
- Automatic version generation with timestamp
- Beta naming in manifest
- Pre-release creation on GitHub
- No Chrome Web Store publishing

## 🔍 Monitoring Deployments

### GitHub Actions Dashboard

1. Go to your repository
2. Click "Actions" tab
3. Monitor workflow runs
4. Check logs for any failures

### Chrome Web Store Dashboard

1. Visit [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Check extension status
3. Monitor review process
4. View analytics and user feedback

### Key Metrics to Watch

- **Build Success Rate:** Should be >95%
- **Test Pass Rate:** Should be 100%
- **Deployment Time:** Typically 5-10 minutes
- **Chrome Store Review:** 1-3 business days

## 🚨 Troubleshooting

### Common Issues and Solutions

#### 1. "Invalid refresh token"
```bash
# Solution: Regenerate refresh token
node get_refresh_token.js
# Update CHROME_REFRESH_TOKEN secret
```

#### 2. "Extension not found"
```bash
# Check Extension ID is correct
# Verify extension exists in Chrome Web Store
# Ensure it was published at least once manually
```

#### 3. "Tests failing"
```bash
# Run tests locally first
bun test

# Check specific test failures in GitHub Actions logs
# Fix issues before retrying deployment
```

#### 4. "Build artifacts missing"
```bash
# Verify all required files exist:
ls -la popup/ content/ background/ icons/ manifest.json

# Check build script works locally:
./scripts/build.sh
```

#### 5. "Chrome Web Store API quota exceeded"
```bash
# Wait for quota reset (usually 24 hours)
# Or increase quota in Google Cloud Console
```

### Debug Commands

```bash
# Test build locally
./scripts/build.sh

# Validate manifest
cat manifest.json | jq .

# Check file structure
find . -name "*.js" -o -name "*.html" -o -name "*.css" | grep -E "(popup|content|background)"

# Test extension locally
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Load unpacked: select build/ directory
```

## 🔄 Maintenance

### Regular Tasks

#### Monthly
- [ ] Review Chrome Web Store analytics
- [ ] Check for Chrome API updates
- [ ] Update dependencies if needed
- [ ] Review and rotate OAuth credentials (quarterly)

#### Before Major Releases
- [ ] Run full test suite locally
- [ ] Test extension in multiple Chrome versions
- [ ] Update screenshots and store listing
- [ ] Create beta release for testing
- [ ] Review Chrome Web Store policies

#### After Deployment Issues
- [ ] Check GitHub Actions logs
- [ ] Verify Chrome Web Store status
- [ ] Update documentation if needed
- [ ] Consider rollback if critical issues

### Version Management Strategy

```bash
# Semantic Versioning (MAJOR.MINOR.PATCH)
# MAJOR: Breaking changes or major features
# MINOR: New features, backward compatible
# PATCH: Bug fixes, backward compatible

# Examples:
v1.0.0  # Initial release
v1.0.1  # Bug fix
v1.1.0  # New feature
v2.0.0  # Major rewrite
```

### Backup Strategy

- **Code:** Git repository (GitHub)
- **Releases:** GitHub releases with artifacts
- **Credentials:** Secure password manager
- **Documentation:** This repository

## 📞 Support Contacts

### When Things Go Wrong

1. **GitHub Actions Issues**
   - Check workflow logs
   - Review this documentation
   - Check GitHub Status page

2. **Chrome Web Store Issues**
   - Chrome Web Store Developer Support
   - Chrome Web Store API documentation
   - Google Cloud Console support

3. **Extension Issues**
   - Test locally first
   - Check browser console for errors
   - Review Chrome extension documentation

### Useful Links

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [Chrome Web Store API Documentation](https://developer.chrome.com/docs/webstore/api/)
- [Google Cloud Console](https://console.cloud.google.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)

---

**Last Updated:** August 14, 2025  
**Next Review:** September 14, 2025
