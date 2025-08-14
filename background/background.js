// GoFaster Background Service Worker - Fixed Version

console.log('🚀 GoFaster: Background script starting');

// Initialize extension
chrome.runtime.onInstalled.addListener((details) => {
    console.log('🔧 GoFaster: Extension installed/updated');
    
    if (details.reason === 'install') {
        // Set default settings on first install
        chrome.storage.sync.set({
            commandPaletteEnabled: true,
            keyboardShortcuts: true,
            showTabCount: true,
            theme: 'auto'
        });
        
        console.log('✅ GoFaster: Default settings saved');
    }
    
    // Create context menus after installation
    createContextMenus();
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
    console.log('⌨️ GoFaster: Command triggered:', command);
    
    switch (command) {
        case 'open-command-palette':
            console.log('🎯 GoFaster: Opening command palette via keyboard shortcut');
            await openCommandPalette();
            break;
        case 'quick-switch':
            console.log('🔄 GoFaster: Quick switch triggered');
            await quickSwitch();
            break;
        default:
            console.log('⚠️ GoFaster: Unknown command:', command);
    }
});

async function openCommandPalette() {
    console.log('🚪 GoFaster: Opening command palette');
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            console.error('❌ GoFaster: No active tab found');
            return;
        }
        
        console.log('📤 GoFaster: Sending message to tab:', tab.id, tab.url);
        
        // Check if we can inject into this page
        if (tab.url.startsWith('chrome://') || 
            tab.url.startsWith('chrome-extension://') || 
            tab.url.startsWith('moz-extension://') ||
            tab.url.startsWith('edge://') ||
            tab.url.startsWith('about:')) {
            console.log('⚠️ GoFaster: Cannot inject into system page, opening popup instead');
            chrome.action.openPopup();
            return;
        }
        
        // First try to send message to existing content script
        try {
            await chrome.tabs.sendMessage(tab.id, { 
                action: 'openCommandPalette' 
            });
            console.log('✅ GoFaster: Message sent successfully to existing content script');
        } catch (error) {
            console.log('⚠️ GoFaster: Content script not ready, error:', error.message);
            console.log('🔧 GoFaster: Attempting to inject content script...');
            
            // If content script isn't loaded, inject it
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content/content.js']
                });
                
                await chrome.scripting.insertCSS({
                    target: { tabId: tab.id },
                    files: ['content/content.css']
                });
                
                console.log('✅ GoFaster: Content script injected successfully');
                
                // Wait for script to initialize, then try again
                setTimeout(async () => {
                    try {
                        await chrome.tabs.sendMessage(tab.id, { 
                            action: 'openCommandPalette' 
                        });
                        console.log('✅ GoFaster: Message sent after injection');
                    } catch (retryError) {
                        console.error('❌ GoFaster: Failed to open command palette after injection:', retryError);
                        console.log('🔄 GoFaster: Falling back to popup');
                        chrome.action.openPopup();
                    }
                }, 300);
                
            } catch (injectionError) {
                console.error('❌ GoFaster: Failed to inject content script:', injectionError);
                console.log('🔄 GoFaster: Falling back to popup');
                chrome.action.openPopup();
            }
        }
    } catch (error) {
        console.error('❌ GoFaster: Error opening command palette:', error);
        console.log('🔄 GoFaster: Falling back to popup');
        chrome.action.openPopup();
    }
}

async function quickSwitch() {
    console.log('🔄 GoFaster: Quick switching tabs');
    
    try {
        const tabs = await chrome.tabs.query({});
        const recentTabs = tabs
            .filter(tab => !tab.active)
            .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))
            .slice(0, 1);
        
        if (recentTabs.length > 0) {
            await chrome.tabs.update(recentTabs[0].id, { active: true });
            await chrome.windows.update(recentTabs[0].windowId, { focused: true });
            console.log('✅ GoFaster: Switched to tab:', recentTabs[0].title);
        } else {
            console.log('⚠️ GoFaster: No recent tabs to switch to');
        }
    } catch (error) {
        console.error('❌ GoFaster: Error in quick switch:', error);
    }
}

// Listen for tab updates to keep command palette in sync
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' || changeInfo.title || changeInfo.url) {
        await broadcastTabUpdate();
    }
});

chrome.tabs.onCreated.addListener(broadcastTabUpdate);
chrome.tabs.onRemoved.addListener(broadcastTabUpdate);
chrome.tabs.onMoved.addListener(broadcastTabUpdate);
chrome.tabs.onActivated.addListener(broadcastTabUpdate);

async function broadcastTabUpdate() {
    try {
        const tabs = await chrome.tabs.query({});
        const activeTabs = await chrome.tabs.query({ active: true });
        
        // Send updated tabs to all active tabs
        for (const tab of activeTabs) {
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'updateTabs',
                    tabs: tabs
                });
            } catch (error) {
                // Tab might not have content script loaded - this is normal
            }
        }
    } catch (error) {
        console.error('❌ GoFaster: Error broadcasting tab update:', error);
    }
}

// Message handling for communication with content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 GoFaster: Background received message:', request.action, 'from tab:', sender.tab?.id);
    
    switch (request.action) {
        case 'getTabs':
            console.log('📋 GoFaster: Getting tabs list');
            chrome.tabs.query({}, (tabs) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ GoFaster: Error querying tabs:', chrome.runtime.lastError);
                    sendResponse({ tabs: [], error: chrome.runtime.lastError.message });
                    return;
                }
                
                // Sort tabs by last accessed (most recent first)
                const sortedTabs = tabs.sort((a, b) => {
                    if (a.active) return -1;
                    if (b.active) return 1;
                    return (b.lastAccessed || 0) - (a.lastAccessed || 0);
                });
                
                console.log('✅ GoFaster: Sending', sortedTabs.length, 'tabs to content script');
                sendResponse({ tabs: sortedTabs });
            });
            return true;
            
        case 'switchToTab':
            console.log('🎯 GoFaster: Switching to tab:', request.tabId);
            chrome.tabs.update(request.tabId, { active: true }, (tab) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ GoFaster: Error switching to tab:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    chrome.windows.update(tab.windowId, { focused: true });
                    console.log('✅ GoFaster: Switched to tab successfully');
                    sendResponse({ success: true });
                }
            });
            return true;
            
        case 'pinTab':
            console.log('📌 GoFaster: Pinning/unpinning tab:', request.tabId);
            chrome.tabs.update(request.tabId, { pinned: request.pinned }, () => {
                if (chrome.runtime.lastError) {
                    console.error('❌ GoFaster: Error pinning tab:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    console.log('✅ GoFaster: Tab pin status updated');
                    sendResponse({ success: true });
                }
            });
            return true;
            
        case 'muteTab':
            console.log('🔇 GoFaster: Muting/unmuting tab:', request.tabId);
            chrome.tabs.update(request.tabId, { muted: request.muted }, () => {
                if (chrome.runtime.lastError) {
                    console.error('❌ GoFaster: Error muting tab:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    console.log('✅ GoFaster: Tab mute status updated');
                    sendResponse({ success: true });
                }
            });
            return true;
            
        case 'closeTab':
            console.log('🗑️ GoFaster: Closing tab:', request.tabId);
            chrome.tabs.remove(request.tabId, () => {
                if (chrome.runtime.lastError) {
                    console.error('❌ GoFaster: Error closing tab:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    console.log('✅ GoFaster: Tab closed successfully');
                    sendResponse({ success: true });
                }
            });
            return true;
            
        default:
            console.log('⚠️ GoFaster: Unknown action:', request.action);
            sendResponse({ error: 'Unknown action: ' + request.action });
    }
});

// Context menu setup - Fixed to handle API availability and prevent duplicates
function createContextMenus() {
    try {
        // Check if contextMenus API is available
        if (chrome.contextMenus && chrome.contextMenus.create) {
            // Clear existing context menus first to prevent duplicates
            chrome.contextMenus.removeAll(() => {
                // Create new context menus
                chrome.contextMenus.create({
                    id: 'openGoFaster',
                    title: 'Open GoFaster Command Palette',
                    contexts: ['page', 'action']
                });
                
                chrome.contextMenus.create({
                    id: 'quickSwitch',
                    title: 'Quick Switch to Last Tab',
                    contexts: ['page', 'action']
                });
                
                console.log('✅ GoFaster: Context menus created');
            });
            
            // Set up context menu click handler (only once)
            if (chrome.contextMenus.onClicked && !chrome.contextMenus.onClicked.hasListener) {
                chrome.contextMenus.onClicked.addListener(async (info, tab) => {
                    console.log('🖱️ GoFaster: Context menu clicked:', info.menuItemId);
                    
                    switch (info.menuItemId) {
                        case 'openGoFaster':
                            await openCommandPalette();
                            break;
                        case 'quickSwitch':
                            await quickSwitch();
                            break;
                    }
                });
                chrome.contextMenus.onClicked.hasListener = true;
            }
        } else {
            console.log('⚠️ GoFaster: Context menus API not available');
        }
    } catch (error) {
        console.error('❌ GoFaster: Error creating context menus:', error);
    }
}

// Badge text to show tab count
function updateBadge() {
    try {
        chrome.tabs.query({}, (tabs) => {
            if (chrome.runtime.lastError) {
                console.error('❌ GoFaster: Error querying tabs for badge:', chrome.runtime.lastError);
                return;
            }
            
            const count = tabs.length;
            chrome.action.setBadgeText({
                text: count > 99 ? '99+' : count.toString()
            });
            chrome.action.setBadgeBackgroundColor({ color: '#1a73e8' });
        });
    } catch (error) {
        console.error('❌ GoFaster: Error updating badge:', error);
    }
}

// Update badge on tab changes
chrome.tabs.onCreated.addListener(updateBadge);
chrome.tabs.onRemoved.addListener(updateBadge);

// Initialize badge
updateBadge();

console.log('✅ GoFaster: Background script initialized');
