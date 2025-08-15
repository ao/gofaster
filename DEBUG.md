# GoFaster Debug Mode

GoFaster includes a comprehensive debug mode system that allows developers and power users to troubleshoot issues and understand the extension's behavior.

## Enabling Debug Mode

### Method 1: Browser Console
```javascript
// Enable debug mode
goFasterDebug.enable()

// Disable debug mode
goFasterDebug.disable()

// Toggle debug mode
goFasterDebug.toggle()

// Check debug status
goFasterDebug.status()
```

### Method 2: Keyboard Shortcut
- Open the command palette with `Ctrl+P` (or `Cmd+P` on Mac)
- Press `Ctrl+Shift+D` (or `Cmd+Shift+D` on Mac) to toggle debug mode

### Method 3: URL Parameter
Add `?gofaster_debug=true` to any URL to enable debug mode for that page:
```
https://example.com?gofaster_debug=true
```

### Method 4: localStorage
```javascript
// Enable
localStorage.setItem('gofaster_debug', 'true')

// Disable
localStorage.setItem('gofaster_debug', 'false')
```

## What Debug Mode Shows

When debug mode is enabled, you'll see detailed logging for:

### Content Script
- 🚀 Initialization messages
- 🎨 DOM creation and manipulation
- 🔍 Tab loading and connection testing
- 📋 Search operations and filtering
- 🎯 Tab switching and actions
- ⌨️ Keyboard event handling
- 🔄 State changes and updates

### Background Script
- 🚀 Service worker startup
- 📨 Message passing between scripts
- 🔧 Extension installation and updates
- 📌 Tab management operations (pin, mute, close)
- 🔍 Content search operations
- 🎯 Tab switching and focus management

### Popup Script
- 🚀 Popup initialization
- 📋 Tab list rendering
- 🔍 Search and filtering operations
- 🎯 User interactions and selections

## Debug Mode Indicators

- **Footer**: Shows "Debug ON" in green when enabled
- **Notification**: Temporary notification when toggling debug mode
- **Console**: Welcome message with available commands

## Performance Impact

Debug mode has minimal performance impact:
- ✅ Logging is conditionally executed (no string concatenation when disabled)
- ✅ Debug checks are lightweight boolean operations
- ✅ No network requests or heavy operations added
- ✅ Production builds can easily strip debug code if needed

## Troubleshooting Common Issues

### Extension Context Invalidated
```
GoFaster: Extension context invalidated - please reload the page
```
**Solution**: Refresh the page after extension reload/update

### No Tabs Loading
```
GoFaster: Connection test failed: Chrome runtime not available
```
**Solution**: Check if extension is properly loaded and enabled

### Content Search Not Working
```
GoFaster: Content search failed: Permission denied
```
**Solution**: Ensure extension has `<all_urls>` host permissions

## Debug Mode Storage

Debug mode settings are stored in:
1. **Extension Storage**: `chrome.storage.sync` (synced across devices)
2. **localStorage**: `gofaster_debug` key (per-page)
3. **URL Parameters**: `gofaster_debug=true` (temporary)

Priority order: URL Parameter > localStorage > Extension Storage

## Disabling Debug Mode in Production

For production deployments, you can disable debug mode entirely by:

1. **Build-time stripping**: Remove debug code during build
2. **Environment variables**: Set `NODE_ENV=production`
3. **Manual removal**: Comment out debug initialization

## Security Considerations

- Debug mode only shows internal extension state
- No sensitive user data is logged
- No external network requests for debugging
- All debug data stays local to the browser

## Contributing

When reporting issues, please:
1. Enable debug mode
2. Reproduce the issue
3. Copy relevant console output
4. Include browser and extension version info

Debug mode makes it much easier to diagnose and fix issues!
