# GoFaster Deployment Cheat Sheet

Quick reference for common deployment tasks.

## 🚀 Quick Deploy Commands

### Production Release
```bash
git checkout main && git pull
git tag v1.0.0 && git push origin v1.0.0
# ✅ Auto-deploys to Chrome Web Store
```

### Beta Release
```bash
git checkout develop && git push origin develop
# ✅ Creates GitHub pre-release
```

### Local Build
```bash
./scripts/build.sh
# ✅ Creates dist/gofaster-v*.zip
```

## 🔐 Required GitHub Secrets

| Secret | Where to Get |
|--------|-------------|
| `CHROME_EXTENSION_ID` | Chrome Web Store dashboard URL |
| `CHROME_CLIENT_ID` | Google Cloud OAuth credentials |
| `CHROME_CLIENT_SECRET` | Google Cloud OAuth credentials |
| `CHROME_REFRESH_TOKEN` | Run `node get_refresh_token.js` |

## 📋 Pre-Deploy Checklist

- [ ] Tests passing: `bun test`
- [ ] Version updated in manifest.json
- [ ] Changes merged to main branch
- [ ] Extension tested locally
- [ ] GitHub secrets configured

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| Tests failing | Run `bun test` locally, fix issues |
| Invalid refresh token | Regenerate with `get_refresh_token.js` |
| Extension not found | Check Extension ID in secrets |
| Build failing | Run `./scripts/build.sh` locally |

## 📊 Workflow Status

Check deployment status:
1. Go to GitHub repository
2. Click "Actions" tab
3. Monitor workflow runs

## 🎯 Version Strategy

```
v1.0.0 - Major release
v1.0.1 - Bug fix
v1.1.0 - New feature
v1.0.0-beta.1 - Beta version
```

## 📞 Emergency Contacts

- **Chrome Web Store:** [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- **Google Cloud:** [Console](https://console.cloud.google.com/)
- **GitHub Actions:** Repository > Actions tab

---
💡 **Tip:** Keep this cheat sheet bookmarked for quick reference!
