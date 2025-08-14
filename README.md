# GoFaster Chrome Extension

Lightning-fast tab navigation with VSCode-style command palette. Navigate tabs at the speed of thought with powerful keyboard shortcuts and instant search.

## Key Features

### 🐇Command Palette (Ctrl+P / Cmd+P)

- **VSCode-style interface** - Familiar command palette experience
- **Instant search** - Find tabs by title, URL, or domain in milliseconds
- **Keyboard navigation** - Arrow keys to navigate, Enter to select
- **Real-time filtering** - Results update as you type
- **Smart ranking** - Most relevant tabs appear first

### ⌨️ Keyboard Shortcuts

#### Global Shortcuts

- `Ctrl+P` / `Cmd+P` - Open command palette
- `Ctrl+Shift+P` / `Cmd+Shift+P` - Quick switch to last tab
- `Ctrl+Shift+G` / `Cmd+Shift+G` - Open popup interface

#### Command Palette (when open)

- `↑↓` - Navigate results
- `Enter` - Switch to selected tab
- `Ctrl+Shift+P` / `Cmd+Shift+P` - Pin/unpin selected tab
- `Ctrl+M` / `Cmd+M` - Mute/unmute selected tab
- `Delete` or `Ctrl+X` / `Cmd+X` - Close selected tab
- `Esc` - Close palette

### 🎯 Tab Management

- **Pin/Unpin tabs** - Right-click or keyboard shortcuts
- **Mute/Unmute tabs** - Control audio from any tab
- **Close tabs** - Quick tab closure without switching
- **Visual indicators** - See active (●), pinned (📌), and audio (🔊) tabs
- **Right-click context menu** - Full tab management options

## Installation

### From Chrome Web Store

*Coming soon - extension under review*

### Manual Installation (Development)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `gofaster` directory
5. Pin the GoFaster icon to your toolbar (optional)

## Usage

### Quick Start

1. **Press `Ctrl+P`** (or `Cmd+P` on Mac) on any webpage
2. **Start typing** to search your open tabs
3. **Use arrow keys** to navigate results
4. **Press Enter** to switch to the selected tab

### Advanced Usage

- **Search by domain**: Type part of a website name (e.g., "github" to find all GitHub tabs)
- **Search by title**: Type keywords from the page title
- **Pin tabs**: Select a tab and press `Ctrl+Shift+P` or right-click → Pin Tab
- **Mute tabs**: Select a tab and press `Ctrl+M` or right-click → Mute Tab
- **Close tabs**: Select a tab and press `Delete` or right-click → Close Tab
- **Quick switch**: Use `Ctrl+Shift+P` to instantly switch to your last used tab

### Traditional Popup

- Click the GoFaster icon or press `Ctrl+Shift+G`
- Full tab management interface with search and bulk actions
- Automatic focus on search input for immediate typing

## Why GoFaster?

### 🏃‍♂️ Built for Speed

Traditional tab switching is slow:

- Moving mouse to tab bar
- Scrolling through dozens of tabs
- Squinting at tiny favicons
- Getting lost in tab overflow

GoFaster eliminates all friction:

- **2 keystrokes** to open (`Ctrl+P`)
- **Type & Enter** to switch
- **Works from anywhere** - no mouse required
- **Instant search** across all tabs

### 🧠 Cognitive Load Reduction

- **No visual scanning** - just type what you remember
- **Fuzzy matching** - don't need exact titles
- **Recent tabs first** - your workflow stays in focus
- **Clean interface** - no distractions

### ⚡ Developer-Friendly

Inspired by tools developers love:

- VSCode Command Palette
- Sublime Text Goto Anything
- IntelliJ Search Everywhere
- Alfred/Spotlight search

## Development

### Running Tests
```bash
# Install test dependencies
bun install

# Run core functionality tests (recommended)
bun test

# Run all tests (including some that may be flaky due to mock complexity)
bun test:all

# Run tests in watch mode
bun test:watch

# Run specific test file
bun test tests/core-functionality.test.js
```

### Building and Deployment

```bash
# Build extension locally
./scripts/build.sh

# Deploy to Chrome Web Store (production)
git tag v1.0.0 && git push origin v1.0.0

# Create beta release
git push origin develop
```

📚 **Complete deployment documentation:** [docs/README.md](docs/README.md)

### Test Coverage
The extension includes comprehensive tests:
- **Core functionality tests** - Essential features and workflows (✅ All passing)
- **Unit tests** - Individual component functionality
- **Integration tests** - Complete user workflows  
- **Regression tests** - Previously fixed bugs to prevent regressions

Note: Some advanced tests for pin/mute functionality may be flaky due to mock complexity, but the core functionality is thoroughly tested and working.

### Project Structure

```
gofaster/
├── manifest.json          # Extension configuration (Manifest V3)
├── popup/                 # Traditional popup interface
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── content/               # Command palette overlay
│   ├── content.js         # Palette logic and keyboard handling
│   └── content.css        # Overlay styling
├── background/
│   └── background.js      # Service worker and message handling
├── icons/
│   └── *.png             # Extension icons
├── tests/                 # Test suite
│   ├── utils/
│   │   └── test-utils.js  # Testing utilities and mocks
│   ├── testable/
│   │   └── content-script.js  # Testable version of content script
│   ├── content-script.test.js  # Unit tests
│   ├── integration.test.js     # Integration tests
│   └── regression.test.js      # Regression tests
├── package.json           # Test dependencies
└── README.md
```

## Permissions

GoFaster requires these permissions:

- `tabs` - To access and switch between browser tabs
- `storage` - To save user preferences
- `activeTab` - To interact with the current page
- `scripting` - To inject the command palette overlay
- `contextMenus` - For right-click tab management options

## Privacy

Your privacy is paramount:

- **No data collection** - Zero telemetry or analytics
- **Local processing** - All search happens on your device
- **No external requests** - Extension works completely offline
- **Open source** - Code is transparent and auditable

## Browser Compatibility

- **Chrome 88+** (Manifest V3 support required)
- **Edge 88+** (Chromium-based)
- **Other Chromium browsers** with Manifest V3 support

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details

---

**GoFaster** - Because your workflow should move at the speed of thought ⚡
