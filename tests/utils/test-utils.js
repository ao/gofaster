// Test utilities for mocking Chrome extension APIs
import { JSDOM } from 'jsdom';

export function setupDOM() {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'https://example.com',
        pretendToBeVisual: true,
        resources: 'usable'
    });
    
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
    global.HTMLElement = dom.window.HTMLElement;
    global.Event = dom.window.Event;
    global.KeyboardEvent = dom.window.KeyboardEvent;
    
    return dom;
}

export function createMockChrome() {
    const mockTabs = [
        {
            id: 1,
            title: 'GitHub - Example Repository',
            url: 'https://github.com/example/repo',
            active: true,
            pinned: false,
            audible: false,
            favIconUrl: 'https://github.com/favicon.ico',
            lastAccessed: Date.now(),
            mutedInfo: { muted: false }
        },
        {
            id: 2,
            title: 'Stack Overflow - JavaScript Question',
            url: 'https://stackoverflow.com/questions/12345',
            active: false,
            pinned: false,
            audible: false,
            favIconUrl: 'https://stackoverflow.com/favicon.ico',
            lastAccessed: Date.now() - 1000,
            mutedInfo: { muted: false }
        },
        {
            id: 3,
            title: 'Google Search Results',
            url: 'https://google.com/search?q=test',
            active: false,
            pinned: true,
            audible: false,
            favIconUrl: 'https://google.com/favicon.ico',
            lastAccessed: Date.now() - 2000,
            mutedInfo: { muted: false }
        },
        {
            id: 4,
            title: 'YouTube - Music Video',
            url: 'https://youtube.com/watch?v=abc123',
            active: false,
            pinned: false,
            audible: true,
            favIconUrl: 'https://youtube.com/favicon.ico',
            lastAccessed: Date.now() - 3000,
            mutedInfo: { muted: false }
        }
    ];

    const mockChrome = {
        runtime: {
            id: 'test-extension-id',
            lastError: null,
            sendMessage: null, // Will be set by tests
            onMessage: {
                addListener: () => {}
            }
        },
        tabs: {
            query: null, // Will be set by tests
            update: null,
            remove: null,
            sendMessage: null
        },
        commands: {
            onCommand: {
                addListener: () => {}
            }
        },
        scripting: {
            executeScript: null,
            insertCSS: null
        },
        action: {
            openPopup: () => {}
        }
    };

    // Mock sendMessage function
    mockChrome.runtime.sendMessage = (message, callback) => {
        setTimeout(() => {
            if (message.action === 'getTabs') {
                callback({ tabs: mockTabs });
            } else if (message.action === 'switchToTab') {
                const tab = mockTabs.find(t => t.id === message.tabId);
                if (tab) {
                    mockTabs.forEach(t => t.active = false);
                    tab.active = true;
                    callback({ success: true });
                } else {
                    callback({ success: false, error: 'Tab not found' });
                }
            } else if (message.action === 'pinTab') {
                const tab = mockTabs.find(t => t.id === message.tabId);
                if (tab) {
                    tab.pinned = message.pinned;
                    callback({ success: true });
                } else {
                    callback({ success: false, error: 'Tab not found' });
                }
            } else if (message.action === 'muteTab') {
                const tab = mockTabs.find(t => t.id === message.tabId);
                if (tab) {
                    tab.mutedInfo.muted = message.muted;
                    callback({ success: true });
                } else {
                    callback({ success: false, error: 'Tab not found' });
                }
            } else if (message.action === 'closeTab') {
                const index = mockTabs.findIndex(t => t.id === message.tabId);
                if (index !== -1) {
                    mockTabs.splice(index, 1);
                    callback({ success: true });
                } else {
                    callback({ success: false, error: 'Tab not found' });
                }
            } else if (message.action === 'searchContent') {
                // Mock content search - simulate finding content in tabs
                const query = message.query.toLowerCase();
                const results = [];
                
                // Simulate content matches in some tabs
                if (query.includes('error')) {
                    results.push({
                        tab: mockTabs[0], // GitHub tab
                        matches: [
                            {
                                context: 'This function handles error cases gracefully and returns appropriate error messages',
                                matchIndex: 18
                            }
                        ],
                        totalMatches: 2
                    });
                }
                
                if (query.includes('javascript') || query.includes('js')) {
                    results.push({
                        tab: mockTabs[1], // Stack Overflow tab
                        matches: [
                            {
                                context: 'JavaScript question about async functions and promises in modern development',
                                matchIndex: 0
                            }
                        ],
                        totalMatches: 1
                    });
                }
                
                if (query.includes('search')) {
                    results.push({
                        tab: mockTabs[2], // Google tab
                        matches: [
                            {
                                context: 'Search results for your query with relevant information and links',
                                matchIndex: 0
                            }
                        ],
                        totalMatches: 3
                    });
                }
                
                callback({ success: true, results: results });
            } else {
                callback({ error: 'Unknown action' });
            }
        }, 10); // Simulate async delay
    };

    // Mock tabs.query
    mockChrome.tabs.query = (queryInfo, callback) => {
        setTimeout(() => {
            let results = [...mockTabs];
            
            if (queryInfo.active) {
                results = results.filter(tab => tab.active);
            }
            
            callback(results);
        }, 10);
    };

    // Mock tabs.update
    mockChrome.tabs.update = (tabId, updateInfo, callback) => {
        setTimeout(() => {
            const tab = mockTabs.find(t => t.id === tabId);
            if (tab) {
                Object.assign(tab, updateInfo);
                if (updateInfo.active) {
                    mockTabs.forEach(t => t.active = t.id === tabId);
                }
                callback(tab);
            } else {
                mockChrome.runtime.lastError = { message: 'Tab not found' };
                callback(null);
            }
        }, 10);
    };

    // Mock tabs.sendMessage
    mockChrome.tabs.sendMessage = (tabId, message, callback) => {
        setTimeout(() => {
            if (callback) callback({ success: true });
        }, 10);
    };

    global.chrome = mockChrome;
    return { mockChrome, mockTabs };
}

export function createKeyboardEvent(key, options = {}) {
    return new KeyboardEvent('keydown', {
        key,
        ctrlKey: options.ctrl || false,
        metaKey: options.meta || false,
        shiftKey: options.shift || false,
        bubbles: true,
        cancelable: true,
        ...options
    });
}

export function waitFor(condition, timeout = 1000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        function check() {
            if (condition()) {
                resolve();
            } else if (Date.now() - startTime > timeout) {
                reject(new Error('Timeout waiting for condition'));
            } else {
                setTimeout(check, 10);
            }
        }
        
        check();
    });
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
