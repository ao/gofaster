# Chrome Web Store Publishing Setup

This document explains how to set up automated publishing to the Chrome Web Store using GitHub Actions.

## Prerequisites

1. **Chrome Web Store Developer Account**
   - Sign up at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Pay the one-time $5 registration fee

2. **Extension Published Manually First**
   - You need to publish your extension manually at least once
   - This creates the extension ID that you'll need for automation

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Chrome Web Store API:
   - Go to "APIs & Services" > "Library"
   - Search for "Chrome Web Store API"
   - Click "Enable"

### 2. Create OAuth 2.0 Credentials

1. In Google Cloud Console, go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Desktop application" as the application type
4. Name it something like "GoFaster Chrome Extension CI"
5. Download the JSON file with your credentials

### 3. Generate Refresh Token

You need to generate a refresh token for automated publishing. Run this script locally:

```bash
# Create a temporary script to get refresh token
cat > get_refresh_token.js << 'EOF'
const https = require('https');
const querystring = require('querystring');

// Replace these with your OAuth credentials
const CLIENT_ID = 'your-client-id';
const CLIENT_SECRET = 'your-client-secret';

console.log('1. Go to this URL in your browser:');
console.log(`https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&client_id=${CLIENT_ID}&redirect_uri=urn:ietf:wg:oauth:2.0:oob`);
console.log('\n2. Authorize the application and copy the authorization code');
console.log('3. Run: node get_refresh_token.js <authorization_code>');

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
        console.log('\n✅ Success! Your refresh token is:');
        console.log(response.refresh_token);
        console.log('\nAdd this to your GitHub repository secrets as CHROME_REFRESH_TOKEN');
      } else {
        console.error('Error:', response);
      }
    });
  });

  req.write(postData);
  req.end();
}
EOF

node get_refresh_token.js
```

### 4. Get Extension ID

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Find your extension
3. Copy the Extension ID from the URL or extension details

### 5. Configure GitHub Secrets

In your GitHub repository, go to Settings > Secrets and variables > Actions, and add these secrets:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `CHROME_EXTENSION_ID` | Your extension ID from Chrome Web Store | `abcdefghijklmnopqrstuvwxyz123456` |
| `CHROME_CLIENT_ID` | OAuth 2.0 Client ID | `123456789-abc.apps.googleusercontent.com` |
| `CHROME_CLIENT_SECRET` | OAuth 2.0 Client Secret | `GOCSPX-abcdefghijklmnopqrstuvwxyz` |
| `CHROME_REFRESH_TOKEN` | Refresh token from step 3 | `1//04abcdefghijklmnopqrstuvwxyz` |

## Usage

### Automatic Publishing (Recommended)

1. **Create a release tag:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **The workflow will automatically:**
   - Run tests
   - Update the version in manifest.json
   - Create a zip package
   - Upload to Chrome Web Store
   - Create a GitHub release

### Manual Publishing

1. Go to your repository's Actions tab
2. Select "Chrome Web Store Deployment"
3. Click "Run workflow"
4. Enter the version number (e.g., "1.0.1")
5. Click "Run workflow"

### Beta Releases

Beta releases are automatically created when you push to the `develop` branch:

1. **Push to develop:**
   ```bash
   git checkout develop
   git push origin develop
   ```

2. **The workflow will:**
   - Create a beta version with timestamp
   - Package the extension
   - Create a pre-release on GitHub

## Workflow Files

The setup includes three workflow files:

1. **`.github/workflows/chrome-webstore.yml`** - Main publishing workflow
2. **`.github/workflows/ci.yml`** - Continuous integration and testing
3. **`.github/workflows/beta-release.yml`** - Beta release automation

## Troubleshooting

### Common Issues

1. **"Invalid refresh token"**
   - Regenerate the refresh token following step 3
   - Make sure the token hasn't expired

2. **"Extension not found"**
   - Verify the extension ID is correct
   - Ensure the extension exists in Chrome Web Store

3. **"Insufficient permissions"**
   - Check that the Chrome Web Store API is enabled
   - Verify OAuth scopes include `https://www.googleapis.com/auth/chromewebstore`

4. **"Package validation failed"**
   - Ensure all required files are included in the build
   - Check that manifest.json is valid
   - Verify the extension follows Chrome Web Store policies

### Testing the Setup

Before creating a real release, test with a beta version:

1. Push to the `develop` branch
2. Check that the beta workflow runs successfully
3. Download the generated package and test it manually
4. Once confirmed working, create a real release tag

## Security Notes

- Never commit OAuth credentials to your repository
- Use GitHub Secrets for all sensitive information
- Regularly rotate your OAuth credentials
- Monitor the Chrome Web Store API usage in Google Cloud Console

## Support

If you encounter issues:

1. Check the GitHub Actions logs for detailed error messages
2. Verify all secrets are correctly set
3. Test the Chrome Web Store API manually using curl or Postman
4. Consult the [Chrome Web Store API documentation](https://developer.chrome.com/docs/webstore/api/)
