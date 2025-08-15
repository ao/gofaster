// GoFaster Popup - Settings and Help Interface
class GoFasterPopup {
    constructor() {
        this.extensionEnabled = true;
        this.init();
    }
    
    async init() {
        console.log('🚀 GoFaster Popup: Initializing settings interface');
        
        // Load current settings
        await this.loadSettings();
        
        // Bind events
        this.bindEvents();
        
        // Update version info
        this.updateVersionInfo();
        
        console.log('✅ GoFaster Popup: Initialized successfully');
    }
    
    async loadSettings() {
        try {
            // Load extension enabled state from storage
            const result = await chrome.storage.sync.get(['extensionEnabled']);
            this.extensionEnabled = result.extensionEnabled !== false; // Default to true
            
            // Update toggle state
            const toggle = document.getElementById('extensionEnabled');
            if (toggle) {
                toggle.checked = this.extensionEnabled;
            }
            
            console.log('📋 GoFaster Popup: Settings loaded', { extensionEnabled: this.extensionEnabled });
        } catch (error) {
            console.error('❌ GoFaster Popup: Failed to load settings:', error);
            // Default to enabled if there's an error
            this.extensionEnabled = true;
        }
    }
    
    async saveSettings() {
        try {
            await chrome.storage.sync.set({
                extensionEnabled: this.extensionEnabled
            });
            
            // Notify content scripts of the change
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        type: 'EXTENSION_TOGGLE',
                        enabled: this.extensionEnabled
                    });
                } catch (error) {
                    // Ignore errors for tabs that don't have content script
                }
            }
            
            console.log('💾 GoFaster Popup: Settings saved', { extensionEnabled: this.extensionEnabled });
        } catch (error) {
            console.error('❌ GoFaster Popup: Failed to save settings:', error);
        }
    }
    
    bindEvents() {
        // Extension enable/disable toggle
        const toggle = document.getElementById('extensionEnabled');
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                this.extensionEnabled = e.target.checked;
                this.saveSettings();
                
                console.log('🔄 GoFaster Popup: Extension toggled', { enabled: this.extensionEnabled });
                
                // Show visual feedback
                this.showToggleFeedback(this.extensionEnabled);
            });
        }
        
        // Help link click tracking (optional analytics)
        const helpLink = document.querySelector('.help-link');
        if (helpLink) {
            helpLink.addEventListener('click', () => {
                console.log('📖 GoFaster Popup: Help link clicked');
            });
        }
    }
    
    showToggleFeedback(enabled) {
        // Create a temporary feedback message
        const feedback = document.createElement('div');
        feedback.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: ${enabled ? '#34a853' : '#ea4335'};
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            z-index: 1000;
            animation: fadeInOut 2s ease-in-out;
        `;
        feedback.textContent = enabled ? '✅ GoFaster Enabled' : '❌ GoFaster Disabled';
        
        // Add fade animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                20% { opacity: 1; transform: translateX(-50%) translateY(0); }
                80% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(feedback);
        
        // Remove after animation
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        }, 2000);
    }
    
    updateVersionInfo() {
        const versionElement = document.getElementById('versionInfo');
        if (versionElement) {
            // Get version from manifest
            const manifestData = chrome.runtime.getManifest();
            versionElement.textContent = `v${manifestData.version}`;
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GoFasterPopup();
});

// Handle popup visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // Popup became visible, refresh settings
        const popup = new GoFasterPopup();
    }
});
