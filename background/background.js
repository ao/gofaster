// GoFaster Background Service Worker - Fixed Version

// Debug mode system
let debugMode = false;

// Initialize debug mode from storage
chrome.storage.sync.get(['debugMode']).then(result => {
    debugMode = result.debugMode === true;
    if (debugMode) {
        log('🐛 GoFaster: Debug mode enabled in background script');
    }
});

// Debug-aware logging functions
function log(...args) {
    if (debugMode) {
        console.log(...args);
    }
}

function warn(...args) {
    if (debugMode) {
        console.warn(...args);
    }
}

function error(...args) {
    // Always show errors, but prefix with GoFaster
    console.error('GoFaster:', ...args);
}

// Listen for debug mode changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.debugMode) {
        debugMode = changes.debugMode.newValue === true;
        if (debugMode) {
            log('🐛 GoFaster: Debug mode enabled');
        } else {
            log('GoFaster: Debug mode disabled');
        }
    }
});

log('🚀 GoFaster: Background script starting');

// Initialize extension
chrome.runtime.onInstalled.addListener((details) => {
    log('🔧 GoFaster: Extension installed/updated');
    
    if (details.reason === 'install') {
        // Set default settings on first install
        chrome.storage.sync.set({
            commandPaletteEnabled: true,
            keyboardShortcuts: true,
            showTabCount: true,
            theme: 'auto'
        });
        
        log('✅ GoFaster: Default settings saved');
    }
    
    // Create context menus after installation
    createContextMenus();
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
    log('⌨️ GoFaster: Command triggered:', command);
    
    switch (command) {
        case 'open-command-palette':
            log('🎯 GoFaster: Opening command palette via keyboard shortcut');
            await openCommandPalette();
            break;
        case 'quick-switch':
            log('🔄 GoFaster: Quick switch triggered');
            await quickSwitch();
            break;
        default:
            log('⚠️ GoFaster: Unknown command:', command);
    }
});

async function openCommandPalette() {
    log('🚪 GoFaster: Opening command palette');
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            error('❌ GoFaster: No active tab found');
            return;
        }
        
        log('📤 GoFaster: Sending message to tab:', tab.id, tab.url);
        
        // Check if we can inject into this page
        if (tab.url.startsWith('chrome://') || 
            tab.url.startsWith('chrome-extension://') || 
            tab.url.startsWith('moz-extension://') ||
            tab.url.startsWith('edge://') ||
            tab.url.startsWith('about:')) {
            log('⚠️ GoFaster: Cannot inject into system page, opening popup instead');
            chrome.action.openPopup();
            return;
        }
        
        // First try to send message to existing content script
        try {
            await chrome.tabs.sendMessage(tab.id, { 
                action: 'openCommandPalette' 
            });
            log('✅ GoFaster: Message sent successfully to existing content script');
        } catch (error) {
            log('⚠️ GoFaster: Content script not ready, error:', error.message);
            log('🔧 GoFaster: Attempting to inject content script...');
            
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
                
                log('✅ GoFaster: Content script injected successfully');
                
                // Wait for script to initialize, then try again
                setTimeout(async () => {
                    try {
                        await chrome.tabs.sendMessage(tab.id, { 
                            action: 'openCommandPalette' 
                        });
                        log('✅ GoFaster: Message sent after injection');
                    } catch (retryError) {
                        error('❌ GoFaster: Failed to open command palette after injection:', retryError);
                        log('🔄 GoFaster: Falling back to popup');
                        chrome.action.openPopup();
                    }
                }, 300);
                
            } catch (injectionError) {
                error('❌ GoFaster: Failed to inject content script:', injectionError);
                log('🔄 GoFaster: Falling back to popup');
                chrome.action.openPopup();
            }
        }
    } catch (error) {
        error('❌ GoFaster: Error opening command palette:', error);
        log('🔄 GoFaster: Falling back to popup');
        chrome.action.openPopup();
    }
}

async function quickSwitch() {
    log('🔄 GoFaster: Quick switching tabs');
    
    try {
        const tabs = await chrome.tabs.query({});
        const recentTabs = tabs
            .filter(tab => !tab.active)
            .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))
            .slice(0, 1);
        
        if (recentTabs.length > 0) {
            await chrome.tabs.update(recentTabs[0].id, { active: true });
            await chrome.windows.update(recentTabs[0].windowId, { focused: true });
            log('✅ GoFaster: Switched to tab:', recentTabs[0].title);
        } else {
            log('⚠️ GoFaster: No recent tabs to switch to');
        }
    } catch (error) {
        error('❌ GoFaster: Error in quick switch:', error);
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

async function searchContentAcrossTabs(query) {
    if (!query || query.length < 2) {
        return [];
    }
    
    log('🔍 GoFaster: Starting content search for:', query);
    
    try {
        const tabs = await chrome.tabs.query({});
        log('📋 GoFaster: Found', tabs.length, 'tabs to search');
        
        // Separate current tab from others for priority
        const currentTab = tabs.find(tab => tab.active);
        const otherTabs = tabs.filter(tab => !tab.active);
        
        // Prioritize current tab, then other tabs (limit total to prevent overwhelming)
        const tabsToSearch = currentTab ? [currentTab, ...otherTabs.slice(0, 19)] : tabs.slice(0, 20);
        
        log('🎯 GoFaster: Searching', tabsToSearch.length, 'tabs (current tab first)');
        
        const searchResults = [];
        
        // Search tabs sequentially to maintain priority order
        for (const tab of tabsToSearch) {
            try {
                // Skip system pages that can't be scripted
                if (tab.url.startsWith('chrome://') || 
                    tab.url.startsWith('chrome-extension://') || 
                    tab.url.startsWith('moz-extension://') ||
                    tab.url.startsWith('edge://') ||
                    tab.url.startsWith('about:')) {
                    log('⏭️ GoFaster: Skipping system page:', tab.url);
                    continue;
                }
                
                log('🔍 GoFaster: Searching tab:', tab.title, '(' + tab.url + ')');
                
                // Inject and execute content search script
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: function(searchQuery) {
                        // This function runs in the context of the tab
                        if (!searchQuery || searchQuery.length < 2) {
                            return { matches: [], totalMatches: 0 };
                        }
                        
                        const query = searchQuery.toLowerCase();
                        const matches = [];
                        let totalMatches = 0;
                        
                        // Get all text content from the page
                        const walker = document.createTreeWalker(
                            document.body || document.documentElement,
                            NodeFilter.SHOW_TEXT,
                            {
                                acceptNode: function(node) {
                                    const parent = node.parentElement;
                                    if (!parent) return NodeFilter.FILTER_REJECT;
                                    
                                    const tagName = parent.tagName.toLowerCase();
                                    if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
                                        return NodeFilter.FILTER_REJECT;
                                    }
                                    
                                    const text = node.textContent.trim();
                                    if (!text) return NodeFilter.FILTER_REJECT;
                                    
                                    return NodeFilter.FILTER_ACCEPT;
                                }
                            }
                        );
                        
                        const textNodes = [];
                        let node;
                        while (node = walker.nextNode()) {
                            textNodes.push(node);
                        }
                        
                        // Search through text nodes
                        textNodes.forEach(textNode => {
                            const text = textNode.textContent.toLowerCase();
                            const originalText = textNode.textContent;
                            
                            let index = 0;
                            while ((index = text.indexOf(query, index)) !== -1) {
                                totalMatches++;
                                
                                // Only add first few matches per page
                                if (matches.length < 3) {
                                    const start = Math.max(0, index - 40);
                                    const end = Math.min(originalText.length, index + query.length + 40);
                                    const context = originalText.substring(start, end).trim();
                                    
                                    matches.push({
                                        context: context,
                                        matchIndex: index
                                    });
                                }
                                
                                index += query.length;
                            }
                        });
                        
                        return {
                            matches: matches,
                            totalMatches: totalMatches,
                            url: window.location.href,
                            title: document.title
                        };
                    },
                    args: [query]
                });
                
                if (results && results[0] && results[0].result) {
                    const result = results[0].result;
                    if (result.totalMatches > 0) {
                        const searchResult = {
                            tab: tab,
                            ...result
                        };
                        searchResults.push(searchResult);
                        log('✅ GoFaster: Found', result.totalMatches, 'matches in', tab.title);
                    } else {
                        log('⚪ GoFaster: No matches in', tab.title);
                    }
                } else {
                    log('⚠️ GoFaster: No result returned from', tab.title);
                }
                
            } catch (error) {
                log('⚠️ GoFaster: Could not search tab', tab.id, '(' + tab.title + '):', error.message);
            }
        }
        
        log('✅ GoFaster: Content search completed, found', searchResults.length, 'tabs with matches');
        return searchResults;
        
    } catch (error) {
        error('❌ GoFaster: Content search failed:', error);
        throw error;
    }
}

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
        error('❌ GoFaster: Error broadcasting tab update:', error);
    }
}

// Message handling for communication with content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    log('📨 GoFaster: Background received message:', request.action, 'from tab:', sender.tab?.id);
    
    switch (request.action) {
        case 'getTabs':
            log('📋 GoFaster: Getting tabs list');
            chrome.tabs.query({}, (tabs) => {
                if (chrome.runtime.lastError) {
                    error('❌ GoFaster: Error querying tabs:', chrome.runtime.lastError);
                    sendResponse({ tabs: [], error: chrome.runtime.lastError.message });
                    return;
                }
                
                // Sort tabs by last accessed (most recent first)
                const sortedTabs = tabs.sort((a, b) => {
                    if (a.active) return -1;
                    if (b.active) return 1;
                    return (b.lastAccessed || 0) - (a.lastAccessed || 0);
                });
                
                log('✅ GoFaster: Sending', sortedTabs.length, 'tabs to content script');
                sendResponse({ tabs: sortedTabs });
            });
            return true;
            
        case 'switchToTab':
            log('🎯 GoFaster: Switching to tab:', request.tabId);
            chrome.tabs.update(request.tabId, { active: true }, (tab) => {
                if (chrome.runtime.lastError) {
                    error('❌ GoFaster: Error switching to tab:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    chrome.windows.update(tab.windowId, { focused: true });
                    log('✅ GoFaster: Switched to tab successfully');
                    sendResponse({ success: true });
                }
            });
            return true;
            
        case 'pinTab':
            log('📌 GoFaster: Pinning/unpinning tab:', request.tabId);
            chrome.tabs.update(request.tabId, { pinned: request.pinned }, () => {
                if (chrome.runtime.lastError) {
                    error('❌ GoFaster: Error pinning tab:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    log('✅ GoFaster: Tab pin status updated');
                    sendResponse({ success: true });
                }
            });
            return true;
            
        case 'muteTab':
            log('🔇 GoFaster: Muting/unmuting tab:', request.tabId);
            chrome.tabs.update(request.tabId, { muted: request.muted }, () => {
                if (chrome.runtime.lastError) {
                    error('❌ GoFaster: Error muting tab:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    log('✅ GoFaster: Tab mute status updated');
                    sendResponse({ success: true });
                }
            });
            return true;
            
        case 'closeTab':
            log('🗑️ GoFaster: Closing tab:', request.tabId);
            chrome.tabs.remove(request.tabId, () => {
                if (chrome.runtime.lastError) {
                    error('❌ GoFaster: Error closing tab:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    log('✅ GoFaster: Tab closed successfully');
                    sendResponse({ success: true });
                }
            });
            return true;
            
        case 'searchContent':
            log('🔍 GoFaster: Searching content across tabs for:', request.query);
            searchContentAcrossTabs(request.query).then(results => {
                sendResponse({ success: true, results: results });
            }).catch(error => {
                error('❌ GoFaster: Content search error:', error);
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        default:
            log('⚠️ GoFaster: Unknown action:', request.action);
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
                
                log('✅ GoFaster: Context menus created');
            });
            
            // Set up context menu click handler (only once)
            if (chrome.contextMenus.onClicked && !chrome.contextMenus.onClicked.hasListener) {
                chrome.contextMenus.onClicked.addListener(async (info, tab) => {
                    log('🖱️ GoFaster: Context menu clicked:', info.menuItemId);
                    
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
            log('⚠️ GoFaster: Context menus API not available');
        }
    } catch (error) {
        error('❌ GoFaster: Error creating context menus:', error);
    }
}

// Badge text to show tab count
function updateBadge() {
    try {
        chrome.tabs.query({}, (tabs) => {
            if (chrome.runtime.lastError) {
                error('❌ GoFaster: Error querying tabs for badge:', chrome.runtime.lastError);
                return;
            }
            
            const count = tabs.length;
            chrome.action.setBadgeText({
                text: count > 99 ? '99+' : count.toString()
            });
            chrome.action.setBadgeBackgroundColor({ color: '#1a73e8' });
        });
    } catch (error) {
        error('❌ GoFaster: Error updating badge:', error);
    }
}

// Update badge on tab changes
chrome.tabs.onCreated.addListener(updateBadge);
chrome.tabs.onRemoved.addListener(updateBadge);

// Initialize badge
updateBadge();

log('✅ GoFaster: Background script initialized');
