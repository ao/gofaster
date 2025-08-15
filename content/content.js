// GoFaster Content Script - Command Palette Overlay

class GoFasterCommandPalette {
    constructor() {
        this.isOpen = false;
        this.tabs = [];
        this.filteredTabs = [];
        this.contentResults = [];
        this.selectedIndex = 0;
        this.searchQuery = '';
        this.isLoading = false;
        this.groupByDomain = false; // Add grouping state
        this.paletteMode = 'tabs'; // 'tabs' or 'content' - determines which palette is active
        this.debugMode = false; // Debug mode flag
        this.lastGKeyTime = null; // For vim gg mapping
        
        // Initialize debug mode synchronously first, then async
        this.initializeDebugModeSync();
        
        this.log('🚀 GoFaster: Initializing command palette');
        
        this.createPalette();
        this.bindEvents();
        
        // Initialize debug mode async and test connection
        this.initializeAsync();
    }
    
    initializeDebugModeSync() {
        try {
            // Check URL parameter first
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('gofaster_debug') === 'true') {
                this.debugMode = true;
                return;
            }
            
            // Check localStorage
            const debugFromStorage = localStorage.getItem('gofaster_debug');
            if (debugFromStorage === 'true') {
                this.debugMode = true;
                return;
            }
            
            // Auto-enable debug mode for test pages
            if (window.location.href.includes('test-content-search.html') || 
                document.title.includes('Content Search Test')) {
                this.debugMode = true;
                return;
            }
        } catch (error) {
            // Silently fail
        }
    }
    
    async initializeAsync() {
        // Initialize debug mode from extension storage
        await this.initializeDebugMode();
        
        // Test connection to background script
        this.testConnection();
    }
    
    async initializeDebugMode() {
        try {
            // Check URL parameter first
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('gofaster_debug') === 'true') {
                this.debugMode = true;
                this.log('🐛 GoFaster: Debug mode enabled via URL parameter');
                return;
            }
            
            // Check localStorage
            const debugFromStorage = localStorage.getItem('gofaster_debug');
            if (debugFromStorage === 'true') {
                this.debugMode = true;
                this.log('🐛 GoFaster: Debug mode enabled via localStorage');
                return;
            }
            
            // Auto-enable debug mode for test pages
            if (window.location.href.includes('test-content-search.html') || 
                document.title.includes('Content Search Test')) {
                this.debugMode = true;
                this.log('🐛 GoFaster: Debug mode auto-enabled for test page');
                return;
            }
            
            // Check extension storage if available
            if (this.isExtensionContextValid()) {
                try {
                    const result = await chrome.storage.sync.get(['debugMode']);
                    if (result.debugMode === true) {
                        this.debugMode = true;
                        this.log('🐛 GoFaster: Debug mode enabled via extension storage');
                    }
                } catch (error) {
                    // Silently fail if storage is not available
                }
            }
        } catch (error) {
            // Silently fail initialization
        }
    }
    
    log(...args) {
        if (this.debugMode) {
            console.log(...args);
        }
    }
    
    warn(...args) {
        if (this.debugMode) {
            console.warn(...args);
        }
    }
    
    error(...args) {
        // Always show errors, but prefix with GoFaster for identification
        console.error('GoFaster:', ...args);
    }
    
    enableDebugMode() {
        this.debugMode = true;
        localStorage.setItem('gofaster_debug', 'true');
        this.log('🐛 GoFaster: Debug mode enabled');
        
        // Also save to extension storage if available
        if (this.isExtensionContextValid()) {
            try {
                chrome.storage.sync.set({ debugMode: true });
            } catch (error) {
                // Silently fail
            }
        }
    }
    
    disableDebugMode() {
        this.debugMode = false;
        localStorage.setItem('gofaster_debug', 'false');
        this.log('GoFaster: Debug mode disabled');
        
        // Also save to extension storage if available
        if (this.isExtensionContextValid()) {
            try {
                chrome.storage.sync.set({ debugMode: false });
            } catch (error) {
                // Silently fail
            }
        }
    }
    
    isExtensionContextValid() {
        try {
            return !!(chrome && chrome.runtime && chrome.runtime.id);
        } catch (error) {
            return false;
        }
    }
    
    async testConnection() {
        try {
            this.log('🔍 GoFaster: Testing connection to background script');
            
            if (!this.isExtensionContextValid()) {
                this.warn('⚠️ GoFaster: Extension context not valid, skipping connection test');
                return false;
            }
            
            const response = await this.sendMessage({ action: 'getTabs' });
            this.log('✅ GoFaster: Connection successful, got', response?.tabs?.length || 0, 'tabs');
            return true;
        } catch (error) {
            this.error('❌ GoFaster: Connection test failed:', error);
            return false;
        }
    }
    
    sendMessage(message) {
        return new Promise((resolve, reject) => {
            // Check if extension context is still valid
            if (!chrome?.runtime?.id) {
                reject(new Error('Extension context invalidated - please reload the page'));
                return;
            }
            
            if (!chrome?.runtime?.sendMessage) {
                reject(new Error('Chrome runtime not available'));
                return;
            }
            
            try {
                chrome.runtime.sendMessage(message, (response) => {
                    if (chrome.runtime.lastError) {
                        // Check for specific context invalidation errors
                        const error = chrome.runtime.lastError.message;
                        if (error.includes('Extension context invalidated') || 
                            error.includes('message port closed') ||
                            error.includes('receiving end does not exist')) {
                            reject(new Error('Extension context invalidated - please reload the page'));
                        } else {
                            reject(new Error(error));
                        }
                    } else {
                        resolve(response);
                    }
                });
            } catch (error) {
                reject(new Error('Failed to send message: ' + error.message));
            }
        });
    }
    
    createPalette() {
        this.log('🎨 GoFaster: Creating palette DOM elements');
        
        // Remove existing palette if it exists
        const existing = document.getElementById('gofaster-overlay');
        if (existing) {
            existing.remove();
        }
        
        // Create overlay container
        this.overlay = document.createElement('div');
        this.overlay.id = 'gofaster-overlay';
        this.overlay.className = 'gofaster-hidden';
        
        // Create command palette
        this.palette = document.createElement('div');
        this.palette.id = 'gofaster-palette';
        
        // Create search input
        this.searchInput = document.createElement('input');
        this.searchInput.id = 'gofaster-search';
        this.searchInput.type = 'text';
        this.updatePlaceholder(); // Set placeholder based on mode
        this.searchInput.autocomplete = 'off';
        this.searchInput.spellcheck = false;
        
        // Create results container
        this.results = document.createElement('div');
        this.results.id = 'gofaster-results';
        
        // Create footer with shortcuts
        this.footer = document.createElement('div');
        this.footer.id = 'gofaster-footer';
        this.updateFooter();
        
        // Assemble palette
        this.palette.appendChild(this.searchInput);
        this.palette.appendChild(this.results);
        this.palette.appendChild(this.footer);
        this.overlay.appendChild(this.palette);
        
        // Add to page
        document.body.appendChild(this.overlay);
        
        this.log('✅ GoFaster: Palette DOM created');
    }
    
    updatePlaceholder() {
        if (!this.searchInput) return;
        
        if (this.paletteMode === 'content') {
            this.searchInput.placeholder = 'Search page content across all tabs...';
        } else {
            this.searchInput.placeholder = 'Search tabs by title and domain...';
        }
    }
    
    // Helper function to check if user is currently in an input field
    isInInputField() {
        const activeElement = document.activeElement;
        if (!activeElement) return false;
        
        const tagName = activeElement.tagName.toLowerCase();
        const inputTypes = ['input', 'textarea', 'select'];
        
        // Check if it's an input element
        if (inputTypes.includes(tagName)) {
            return true;
        }
        
        // Check if it's a contenteditable element
        if (activeElement.contentEditable === 'true') {
            return true;
        }
        
        // Check if it's inside a contenteditable element
        let parent = activeElement.parentElement;
        while (parent) {
            if (parent.contentEditable === 'true') {
                return true;
            }
            parent = parent.parentElement;
        }
        
        return false;
    }
    
    bindEvents() {
        this.log('🔗 GoFaster: Binding events');
        
        // Listen for keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Vim mappings when palette is NOT open
            if (!this.isOpen) {
                // Ctrl+D - Scroll down half page
                if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !e.shiftKey) {
                    e.preventDefault();
                    window.scrollBy(0, window.innerHeight / 2);
                    return;
                }
                
                // Ctrl+U - Scroll up half page
                if ((e.ctrlKey || e.metaKey) && e.key === 'u' && !e.shiftKey) {
                    e.preventDefault();
                    window.scrollBy(0, -window.innerHeight / 2);
                    return;
                }
                
                // Ctrl+E - Scroll down one line
                if ((e.ctrlKey || e.metaKey) && e.key === 'e' && !e.shiftKey) {
                    e.preventDefault();
                    window.scrollBy(0, 20);
                    return;
                }
                
                // Ctrl+Y - Scroll up one line
                if ((e.ctrlKey || e.metaKey) && e.key === 'y' && !e.shiftKey) {
                    e.preventDefault();
                    window.scrollBy(0, -20);
                    return;
                }
                
                // Skip non-Ctrl vim keys if user is typing in an input field
                if (this.isInInputField()) {
                    // Allow Ctrl-based shortcuts to work normally, but skip single-key vim commands
                    return;
                }
                
                // gg - Go to top (need to handle double 'g')
                if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                    if (this.lastGKeyTime && Date.now() - this.lastGKeyTime < 500) {
                        // Double 'g' pressed within 500ms
                        e.preventDefault();
                        window.scrollTo(0, 0);
                        this.lastGKeyTime = null;
                        return;
                    } else {
                        this.lastGKeyTime = Date.now();
                        return;
                    }
                }
                
                // G - Go to bottom
                if (e.key === 'G' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    e.preventDefault();
                    window.scrollTo(0, document.body.scrollHeight);
                    return;
                }
            }
            
            // Ctrl+P / Cmd+P to open tab search palette
            if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey) {
                e.preventDefault();
                this.log('⌨️ GoFaster: Ctrl+P detected - opening tab search');
                
                // Check if extension context is still valid
                if (!this.isExtensionContextValid()) {
                    this.warn('⚠️ GoFaster: Extension context invalidated, showing message');
                    if (!this.isOpen) {
                        this.isOpen = true;
                        this.overlay.classList.remove('gofaster-hidden');
                        this.showExtensionInvalidatedMessage();
                    }
                    return;
                }
                
                this.openTabSearch();
                return;
            }
            
            // Ctrl+F / Cmd+F to open content search palette
            if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !e.shiftKey) {
                e.preventDefault();
                this.log('⌨️ GoFaster: Ctrl+F detected - opening content search');
                
                // Check if extension context is still valid
                if (!this.isExtensionContextValid()) {
                    this.warn('⚠️ GoFaster: Extension context invalidated, showing message');
                    if (!this.isOpen) {
                        this.isOpen = true;
                        this.overlay.classList.remove('gofaster-hidden');
                        this.showExtensionInvalidatedMessage();
                    }
                    return;
                }
                
                this.openContentSearch();
                return;
            }
            
            // Handle palette navigation when open
            if (this.isOpen) {
                switch (e.key) {
                    case 'Escape':
                        e.preventDefault();
                        this.close();
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        this.selectNext();
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        this.selectPrevious();
                        break;
                    case 'Enter':
                        e.preventDefault();
                        this.executeSelected();
                        break;
                    case 'p':
                        if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
                            // Pin/unpin selected tab (only in tab mode)
                            if (this.paletteMode === 'tabs') {
                                e.preventDefault();
                                this.togglePinSelected();
                            }
                        } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
                            // Switch to tab search mode
                            e.preventDefault();
                            this.switchToTabSearch();
                        }
                        break;
                    case 'f':
                        // Switch to content search mode
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            this.switchToContentSearch();
                        }
                        break;
                    case 'm':
                        // Mute/unmute selected tab (only in tab mode)
                        if ((e.ctrlKey || e.metaKey) && this.paletteMode === 'tabs') {
                            e.preventDefault();
                            this.toggleMuteSelected();
                        }
                        break;
                    case 'x':
                        // Close selected tab (only in tab mode)
                        if ((e.ctrlKey || e.metaKey) && this.paletteMode === 'tabs') {
                            e.preventDefault();
                            this.closeSelected();
                        }
                        break;
                    case 'Delete':
                        // Alternative close shortcut (only in tab mode)
                        if (this.paletteMode === 'tabs') {
                            e.preventDefault();
                            this.closeSelected();
                        }
                        break;
                    case 'g':
                        // Toggle grouping with Ctrl+G (only in tab mode)
                        if ((e.ctrlKey || e.metaKey) && this.paletteMode === 'tabs') {
                            e.preventDefault();
                            this.toggleGrouping();
                        }
                        break;
                    case 'd':
                        // Toggle debug mode with Ctrl+Shift+D
                        if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
                            e.preventDefault();
                            this.toggleDebugMode();
                        }
                        break;
                }
            }
        });
        
        // Search input events
        this.searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.log('🔍 GoFaster: Search query changed:', `"${this.searchQuery}" (mode: ${this.paletteMode})`);
            
            this.updateResults();
        });
        
        // Handle keyboard shortcuts when search input is focused
        this.searchInput.addEventListener('keydown', (e) => {
            // Ctrl+P / Cmd+P to switch to tab search
            if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey) {
                e.preventDefault();
                this.switchToTabSearch();
                return;
            }
            
            // Ctrl+F / Cmd+F to switch to content search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !e.shiftKey) {
                e.preventDefault();
                this.switchToContentSearch();
                return;
            }
        });
        
        // Click outside to close
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });
        
        // Result item clicks and context menu
        this.results.addEventListener('click', (e) => {
            const item = e.target.closest('.result-item');
            if (item) {
                const index = parseInt(item.dataset.index);
                this.selectedIndex = index;
                this.executeSelected();
            }
        });
        
        // Right-click context menu for result items
        this.results.addEventListener('contextmenu', (e) => {
            const item = e.target.closest('.result-item');
            if (item) {
                e.preventDefault();
                const index = parseInt(item.dataset.index);
                this.selectedIndex = index;
                this.updateSelection();
                this.showContextMenu(e.clientX, e.clientY);
            }
        });
        
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.log('📨 GoFaster: Received message:', request.action);
            
            if (request.action === 'openCommandPalette') {
                const mode = request.mode || 'tabs';
                this.log('🎯 GoFaster: Opening palette in mode:', mode);
                
                if (mode === 'content') {
                    this.openContentSearch();
                } else {
                    this.openTabSearch();
                }
            } else if (request.action === 'updateTabs') {
                this.tabs = request.tabs;
                if (this.isOpen) {
                    this.updateResults();
                }
            }
        });
    }
    
    showExtensionInvalidatedMessage() {
        if (this.results) {
            this.results.innerHTML = `
                <div class="no-results">
                    <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 18px; margin-bottom: 10px;">🔄</div>
                        <div style="font-weight: bold; margin-bottom: 8px;">Extension Reloaded</div>
                        <div style="color: #666; font-size: 14px; margin-bottom: 12px;">
                            Please refresh this page to continue using GoFaster
                        </div>
                        <div style="color: #888; font-size: 12px;">
                            Press Escape to close this dialog
                        </div>
                    </div>
                </div>
            `;
        }
    }
    
    async openTabSearch() {
        this.log('🎯 GoFaster: Opening tab search palette');
        this.paletteMode = 'tabs';
        await this.open();
    }
    
    async openContentSearch() {
        this.log('🔍 GoFaster: Opening content search palette');
        this.paletteMode = 'content';
        await this.open();
    }
    
    async toggle() {
        if (!this.isExtensionContextValid()) {
            this.warn('⚠️ GoFaster: Extension context invalidated, cannot toggle palette');
            return;
        }
        
        if (this.isOpen) {
            this.close();
        } else {
            // Default to tab search when toggling
            await this.openTabSearch();
        }
    }
    
    async open() {
        if (this.isOpen) return;
        
        this.log('🚪 GoFaster: Opening palette in mode:', this.paletteMode);
        
        this.isOpen = true;
        this.overlay.classList.remove('gofaster-hidden');
        this.searchInput.value = '';
        this.searchQuery = '';
        this.selectedIndex = 0;
        this.isLoading = true;
        
        // Update placeholder and footer for current mode
        this.updatePlaceholder();
        this.updateFooter();
        
        // Show loading state immediately
        this.results.innerHTML = '<div class="no-results"><div class="no-results-title">Loading tabs...</div></div>';
        
        // Load tabs first, then update results
        try {
            await this.loadTabs();
            this.log('✅ GoFaster: Tabs loaded successfully');
            
            // Update results after tabs are loaded
            this.updateResults();
            
            // Focus search input after everything is ready
            this.focusSearchInput();
        } catch (error) {
            this.error('❌ GoFaster: Failed to load tabs:', error);
            
            // Show user-friendly error message
            let errorMessage = 'Error loading tabs';
            if (error.message.includes('Extension context invalidated') || 
                error.message.includes('Extension was reloaded')) {
                errorMessage = 'Extension was reloaded. Please refresh this page to continue using GoFaster.';
            } else if (error.message.includes('Chrome runtime not available')) {
                errorMessage = 'Extension not properly loaded. Please refresh the page.';
            }
            
            this.results.innerHTML = `
                <div class="no-results">
                    <div class="no-results-title">${errorMessage}</div>
                    <div class="no-results-subtitle">Press Escape to close</div>
                </div>
            `;
        }
    }
    
    focusSearchInput() {
        this.log('🎯 GoFaster: Attempting to focus search input');
        
        if (!this.searchInput) {
            this.error('❌ GoFaster: Search input not found');
            return false;
        }
        
        // Immediate focus attempt
        this.searchInput.focus();
        
        // Multiple focus attempts for reliability
        const attemptFocus = (attempt = 1) => {
            setTimeout(() => {
                this.searchInput.focus();
                
                setTimeout(() => {
                    if (document.activeElement === this.searchInput) {
                        this.log('✅ GoFaster: Search input focused successfully on attempt', attempt);
                    } else {
                        this.log('⚠️ GoFaster: Focus attempt', attempt, 'failed, active element:', document.activeElement?.tagName);
                        if (attempt < 5) {
                            attemptFocus(attempt + 1);
                        }
                    }
                }, 50 * attempt);
            }, 50 * (attempt - 1));
        };
        
        attemptFocus();
        
        // Return true to indicate the method executed
        return true;
    }
    
    close() {
        if (!this.isOpen) return;
        
        this.log('🚪 GoFaster: Closing command palette');
        
        this.isOpen = false;
        this.overlay.classList.add('gofaster-hidden');
        this.searchInput.blur();
    }
    
    async loadTabs() {
        this.log('📋 GoFaster: Loading tabs from background script');
        this.isLoading = true;
        
        try {
            const response = await this.sendMessage({ action: 'getTabs' });
            
            if (response && response.tabs) {
                this.tabs = response.tabs;
                this.log('✅ GoFaster: Loaded', this.tabs.length, 'tabs');
            } else {
                this.error('❌ GoFaster: Invalid response from background script:', response);
                this.tabs = [];
                throw new Error('Invalid response from background script');
            }
        } catch (error) {
            this.error('❌ GoFaster: Error loading tabs:', error);
            this.tabs = [];
            
            // Handle extension context invalidation specifically
            if (error.message.includes('Extension context invalidated')) {
                throw new Error('Extension was reloaded. Please refresh this page to continue using GoFaster.');
            }
            
            throw error;
        } finally {
            this.isLoading = false;
        }
    }
    
    async updateResults() {
        this.log('🔄 GoFaster: Updating results. Mode:', this.paletteMode, 'Query:', `"${this.searchQuery}"`);
        
        const trimmedQuery = this.searchQuery.trim();
        
        if (this.paletteMode === 'content') {
            if (trimmedQuery.length >= 1) {
                await this.performSimpleContentSearch();
            } else {
                // Show instructions for content search
                this.showContentSearchInstructions();
            }
        } else {
            // Tab search mode
            this.performTabSearch();
        }
        
        this.renderResults();
        this.updateSelection();
    }
    
    showContentSearchInstructions() {
        this.contentResults = [];
        this.filteredTabs = [];
        // Results will be rendered by renderResults()
    }
    
    performTabSearch() {
        this.filteredTabs = this.filterTabs();
        this.contentResults = [];
        this.log('📊 GoFaster: Filtered to', this.filteredTabs.length, 'tabs');
    }
    
    // New simplified content search approach
    async performSimpleContentSearch() {
        const trimmedQuery = this.searchQuery.trim();
        this.log('🔍 GoFaster: Starting simple content search for:', `"${trimmedQuery}"`);
        
        if (!trimmedQuery || trimmedQuery.length < 1) {
            this.log('⚠️ GoFaster: Query too short for content search');
            this.contentResults = [];
            this.filteredTabs = [];
            return;
        }
        
        this.isLoading = true;
        this.results.innerHTML = '<div class="no-results"><div class="no-results-title">Searching page content...</div></div>';
        
        try {
            // Get all tabs first
            const tabsResponse = await this.sendMessage({ action: 'getTabs' });
            if (!tabsResponse || !tabsResponse.tabs) {
                throw new Error('Failed to get tabs');
            }
            
            const tabs = tabsResponse.tabs;
            this.log('📋 GoFaster: Got', tabs.length, 'tabs to search');
            
            // Filter out system pages first
            const searchableTabs = tabs.filter(tab => {
                if (tab.url.startsWith('chrome://') || 
                    tab.url.startsWith('chrome-extension://') || 
                    tab.url.startsWith('about:') ||
                    tab.url.startsWith('moz-extension://') ||
                    tab.url.startsWith('edge://')) {
                    this.log('⏭️ GoFaster: Skipping system page:', tab.title);
                    return false;
                }
                return true;
            });
            
            this.log('🎯 GoFaster: Searching', searchableTabs.length, 'searchable tabs');
            
            // Search current tab first, then others (search up to 20 tabs)
            const currentTab = searchableTabs.find(tab => tab.active);
            const otherTabs = searchableTabs.filter(tab => !tab.active);
            const tabsToSearch = currentTab ? 
                [currentTab, ...otherTabs.slice(0, 19)] : 
                searchableTabs.slice(0, 20);
            
            this.log('🔍 GoFaster: Will search', tabsToSearch.length, 'tabs');
            
            const contentResults = [];
            let searchedCount = 0;
            let errorCount = 0;
            
            // Search each tab
            for (const tab of tabsToSearch) {
                try {
                    searchedCount++;
                    this.log(`🔍 Searching tab ${searchedCount}/${tabsToSearch.length}:`, tab.title);
                    
                    // Update progress in UI
                    this.results.innerHTML = `<div class="no-results"><div class="no-results-title">Searching tabs... (${searchedCount}/${tabsToSearch.length})</div></div>`;
                    
                    // Search this specific tab
                    const result = await this.searchTabContent(tab, trimmedQuery);
                    if (result && result.totalMatches > 0) {
                        contentResults.push(result);
                        this.log('✅ Found', result.totalMatches, 'matches in', tab.title);
                    } else {
                        this.log('⚪ No matches in', tab.title);
                    }
                } catch (error) {
                    errorCount++;
                    this.log('⚠️ Could not search tab', tab.title, ':', error.message);
                    
                    // Don't let too many errors stop the search
                    if (errorCount > 5) {
                        this.log('⚠️ Too many search errors, stopping search');
                        break;
                    }
                }
            }
            
            this.contentResults = contentResults;
            this.filteredTabs = [];
            this.log('✅ GoFaster: Content search completed');
            this.log(`   📊 Results: ${contentResults.length} tabs with matches`);
            this.log(`   📈 Stats: ${searchedCount} searched, ${errorCount} errors`);
            
        } catch (error) {
            this.error('❌ GoFaster: Simple content search failed:', error);
            this.contentResults = [];
            this.filteredTabs = [];
        } finally {
            this.isLoading = false;
        }
    }
    
    // Search content in a specific tab
    async searchTabContent(tab, query) {
        try {
            // Check if this is the current tab by getting current tab info
            const currentTabResponse = await this.sendMessage({ action: 'getCurrentTab' });
            const currentTabId = currentTabResponse?.tab?.id;
            
            // If this is the current tab, search directly (faster and more reliable)
            if (currentTabId && tab.id === currentTabId) {
                this.log('🎯 GoFaster: Searching current tab directly (ID:', tab.id, ')');
                return this.searchCurrentPageContent(query);
            }
            
            // For other tabs, ask background script to inject and search
            this.log('🔍 GoFaster: Requesting background script to search tab:', tab.title, `(ID: ${tab.id})`);
            
            const response = await this.sendMessage({
                action: 'searchTabContent',
                tabId: tab.id,
                query: query
            });
            
            if (response && response.success) {
                this.log('✅ GoFaster: Background script search successful for tab:', tab.title);
                this.log(`   📊 Found ${response.totalMatches} matches in tab`);
                
                return {
                    tab: tab,
                    matches: response.matches || [],
                    totalMatches: response.totalMatches || 0
                };
            } else {
                this.log('⚠️ GoFaster: Background script search failed:', response?.error);
                return null;
            }
            
        } catch (error) {
            this.log('⚠️ GoFaster: Failed to search tab content:', error.message);
            return null;
        }
    }
    
    // Search content in the current page directly
    searchCurrentPageContent(query) {
        this.log('🔍 GoFaster: Searching current page content for:', query);
        
        const queryLower = query.toLowerCase();
        const matches = [];
        let totalMatches = 0;
        
        // Get all text content from the current page
        const bodyText = document.body ? document.body.textContent : '';
        if (!bodyText) {
            this.log('⚠️ GoFaster: No body text found on current page');
            return { tab: { title: document.title, url: window.location.href }, matches: [], totalMatches: 0 };
        }
        
        this.log('📄 GoFaster: Current page has', bodyText.length, 'characters of text');
        
        const text = bodyText.toLowerCase();
        let index = 0;
        
        while ((index = text.indexOf(queryLower, index)) !== -1) {
            totalMatches++;
            
            // Only keep first 3 matches for preview
            if (matches.length < 3) {
                const start = Math.max(0, index - 40);
                const end = Math.min(bodyText.length, index + queryLower.length + 40);
                const context = bodyText.substring(start, end).trim();
                
                matches.push({
                    context: context,
                    matchIndex: index
                });
            }
            
            index += queryLower.length;
        }
        
        this.log('✅ GoFaster: Found', totalMatches, 'matches on current page');
        
        return {
            tab: { 
                title: document.title, 
                url: window.location.href,
                active: true,
                id: 'current'
            },
            matches: matches,
            totalMatches: totalMatches
        };
    }
    
    filterTabs() {
        if (this.tabs.length === 0) {
            this.log('⚠️ GoFaster: No tabs available to filter');
            return [];
        }
        
        // Filter out null/invalid tabs
        const validTabs = this.tabs.filter(tab => tab && typeof tab === 'object' && tab.id);
        
        let filteredTabs;
        
        if (!this.searchQuery) {
            // Show all tabs when not searching
            filteredTabs = validTabs;
        } else {
            const query = this.searchQuery.toLowerCase();
            filteredTabs = validTabs.filter(tab => {
                const title = (tab.title || '').toLowerCase();
                const url = (tab.url || '').toLowerCase();
                const domain = this.extractDomain(tab.url || '').toLowerCase();
                
                return title.includes(query) || url.includes(query) || domain.includes(query);
            });
            
            // Sort by relevance (title matches first, then URL)
            filteredTabs = filteredTabs.sort((a, b) => {
                const aTitle = (a.title || '').toLowerCase().includes(query);
                const bTitle = (b.title || '').toLowerCase().includes(query);
                if (aTitle && !bTitle) return -1;
                if (!aTitle && bTitle) return 1;
                return 0;
            });
        }
        
        // Apply grouping if enabled
        if (this.groupByDomain) {
            filteredTabs = this.groupTabsByDomain(filteredTabs);
        }
        
        // Only limit results when there are a very large number of tabs to prevent performance issues
        // This addresses the integration test that expects limiting with 100 tabs
        if (filteredTabs.length > 50) {
            const maxResults = this.searchQuery ? 20 : 10;
            filteredTabs = filteredTabs.slice(0, maxResults);
        }
        
        return filteredTabs;
    }
    
    renderResults() {
        // Handle content search results
        if (this.paletteMode === 'content') {
            this.renderContentResults();
            return;
        }
        
        // Handle tab search results
        if (this.tabs.length === 0) {
            const message = `
                <div class="no-results">
                    <div class="no-results-title">No tabs available</div>
                    <div class="no-results-subtitle">No browser tabs found</div>
                    <div class="no-results-tips">
                        <ul>
                            <li>Open some tabs to get started</li>
                            <li>Refresh this page if tabs aren't loading</li>
                        </ul>
                    </div>
                </div>
            `;
            this.results.innerHTML = message;
            return;
        }
        
        if (this.filteredTabs.length === 0) {
            const isSearching = this.searchQuery && this.searchQuery.trim().length > 0;
            let message;
            
            if (isSearching) {
                message = `
                    <div class="no-results">
                        <div class="no-results-title">No tabs found</div>
                        <div class="no-results-subtitle">No tabs match "${this.searchQuery}"</div>
                        <div class="no-results-tips">
                            <ul>
                                <li>Try different keywords</li>
                                <li>Check tab titles and URLs</li>
                                <li>Use partial matches (e.g., "git" for "github.com")</li>
                                <li>Press Ctrl+F for content search</li>
                            </ul>
                        </div>
                    </div>
                `;
            } else {
                message = `
                    <div class="no-results">
                        <div class="no-results-title">Search your tabs</div>
                        <div class="no-results-subtitle">Start typing to search by title and domain</div>
                        <div class="no-results-tips">
                            <ul>
                                <li>Search by tab title or website name</li>
                                <li>Use ↑↓ to navigate, Enter to switch</li>
                                <li>Press Ctrl+F for content search</li>
                                <li>Press Esc to close</li>
                            </ul>
                        </div>
                    </div>
                `;
            }
            
            this.results.innerHTML = message;
            return;
        }
        
        this.renderTabResults();
    }
    
    renderContentResults() {
        this.log('🎨 GoFaster: Rendering content search results');
        
        // Clear existing results
        this.results.innerHTML = '';
        
        const trimmedQuery = this.searchQuery.trim();
        
        // Show instructions if no query
        if (!trimmedQuery) {
            const message = `
                <div class="no-results">
                    <div class="no-results-title">Search page content</div>
                    <div class="no-results-subtitle">Find text inside your open tabs</div>
                    <div class="no-results-tips">
                        <ul>
                            <li>Type any word or phrase to search</li>
                            <li>Searches across all open tabs</li>
                            <li>Shows content previews with matches</li>
                            <li>Press Ctrl+P for tab search</li>
                        </ul>
                    </div>
                </div>
            `;
            this.results.innerHTML = message;
            return;
        }
        
        if (this.contentResults.length === 0) {
            const message = `
                <div class="no-results">
                    <div class="no-results-title">No content matches found</div>
                    <div class="no-results-subtitle">No pages contain "${trimmedQuery}"</div>
                    <div class="no-results-tips">
                        <ul>
                            <li>Try different keywords or phrases</li>
                            <li>Check spelling and try partial matches</li>
                            <li>Content search looks inside page text</li>
                            <li>Press Ctrl+P for tab title search</li>
                        </ul>
                    </div>
                </div>
            `;
            this.results.innerHTML = message;
            return;
        }
        
        this.contentResults.forEach((result, index) => {
            const tab = result.tab;
            const title = tab.title || 'Untitled Tab';
            const domain = this.extractDomain(tab.url || '');
            
            // Create result item element
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item content-result';
            resultItem.dataset.index = index;
            resultItem.dataset.tabId = tab.id || 0;
            
            // Create favicon
            const favicon = document.createElement('img');
            favicon.className = 'result-favicon';
            favicon.src = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23f1f3f4"/></svg>';
            favicon.alt = '';
            favicon.onerror = function() { this.style.display = 'none'; };
            
            // Create content container
            const content = document.createElement('div');
            content.className = 'result-content';
            
            // Create title with match count
            const titleEl = document.createElement('div');
            titleEl.className = 'result-title';
            titleEl.innerHTML = `${this.escapeHtml(title)} <span class="match-count">(${result.totalMatches} matches)</span>`;
            
            // Create URL
            const urlEl = document.createElement('div');
            urlEl.className = 'result-url';
            urlEl.textContent = domain;
            
            // Create content preview
            const previewEl = document.createElement('div');
            previewEl.className = 'content-preview';
            if (result.matches && result.matches.length > 0) {
                const preview = result.matches[0].context;
                previewEl.innerHTML = this.highlightMatch(this.escapeHtml(preview));
            }
            
            content.appendChild(titleEl);
            content.appendChild(urlEl);
            content.appendChild(previewEl);
            
            // Create actions (indicators)
            const actions = document.createElement('div');
            actions.className = 'result-actions';
            
            const contentIndicator = document.createElement('span');
            contentIndicator.className = 'content-indicator';
            contentIndicator.textContent = '📄';
            contentIndicator.title = 'Content match';
            actions.appendChild(contentIndicator);
            
            if (tab.active) {
                const activeIndicator = document.createElement('span');
                activeIndicator.className = 'active-indicator';
                activeIndicator.textContent = '●';
                actions.appendChild(activeIndicator);
            }
            
            // Assemble the result item
            resultItem.appendChild(favicon);
            resultItem.appendChild(content);
            resultItem.appendChild(actions);
            
            this.results.appendChild(resultItem);
        });
        
        this.log('✅ GoFaster: Rendered', this.contentResults.length, 'content results');
    }
    
    renderTabResults() {
        this.log('🎨 GoFaster: Rendering', this.filteredTabs.length, 'tab results');
        
        // Clear existing results
        this.results.innerHTML = '';
        
        // Track current domain for grouping headers
        let currentDomain = null;
        
        // Create result items using DOM manipulation for proper rendering
        this.filteredTabs.forEach((tab, index) => {
            // Handle malformed tab data
            if (!tab || typeof tab !== 'object') {
                return;
            }
            
            const title = tab.title || 'Untitled Tab';
            const url = tab.url || 'about:blank';
            const domain = this.extractDomain(url);
            
            // Add domain header if grouping is enabled and domain changed
            if (this.groupByDomain && domain !== currentDomain) {
                const domainHeader = document.createElement('div');
                domainHeader.className = 'domain-header';
                domainHeader.textContent = domain;
                this.results.appendChild(domainHeader);
                currentDomain = domain;
            }
            
            // Create result item element
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            resultItem.dataset.index = index;
            resultItem.dataset.tabId = tab.id || 0;
            
            // Create favicon
            const favicon = document.createElement('img');
            favicon.className = 'result-favicon';
            favicon.src = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23f1f3f4"/></svg>';
            favicon.alt = '';
            favicon.onerror = function() { this.style.display = 'none'; };
            
            // Create content container
            const content = document.createElement('div');
            content.className = 'result-content';
            
            // Create title
            const titleEl = document.createElement('div');
            titleEl.className = 'result-title';
            titleEl.innerHTML = this.highlightMatch(this.escapeHtml(title));
            
            // Create URL
            const urlEl = document.createElement('div');
            urlEl.className = 'result-url';
            urlEl.innerHTML = this.highlightMatch(domain);
            
            content.appendChild(titleEl);
            content.appendChild(urlEl);
            
            // Create actions (indicators)
            const actions = document.createElement('div');
            actions.className = 'result-actions';
            
            if (tab.active) {
                const activeIndicator = document.createElement('span');
                activeIndicator.className = 'active-indicator';
                activeIndicator.textContent = '●';
                actions.appendChild(activeIndicator);
            }
            
            if (tab.pinned) {
                const pinnedIndicator = document.createElement('span');
                pinnedIndicator.className = 'pinned-indicator';
                pinnedIndicator.textContent = '📌';
                actions.appendChild(pinnedIndicator);
            }
            
            if (tab.audible) {
                const audioIndicator = document.createElement('span');
                audioIndicator.className = 'audio-indicator';
                audioIndicator.textContent = '🔊';
                actions.appendChild(audioIndicator);
            }
            
            // Assemble the result item
            resultItem.appendChild(favicon);
            resultItem.appendChild(content);
            if (actions.children.length > 0) {
                resultItem.appendChild(actions);
            }
            
            this.results.appendChild(resultItem);
        });
        
        this.log('✅ GoFaster: Rendered', this.filteredTabs.length, 'tab results');
    }
    
    updateSelection() {
        const items = this.results.querySelectorAll('.result-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
        });
        
        // Scroll selected item into view
        const selectedItem = items[this.selectedIndex];
        if (selectedItem && selectedItem.scrollIntoView) {
            selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }
    
    selectNext() {
        const maxIndex = this.paletteMode === 'content' ? 
            this.contentResults.length - 1 : 
            this.filteredTabs.length - 1;
        this.selectedIndex = Math.min(this.selectedIndex + 1, maxIndex);
        this.updateSelection();
    }
    
    selectPrevious() {
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateSelection();
    }
    
    async executeSelected() {
        let selectedItem;
        let tabId;
        
        if (this.paletteMode === 'content' && this.contentResults.length > 0) {
            if (this.selectedIndex >= this.contentResults.length) return false;
            selectedItem = this.contentResults[this.selectedIndex];
            tabId = selectedItem.tab.id;
            
            // Handle content search result with highlighting
            return await this.executeContentResult(selectedItem);
        } else {
            if (this.filteredTabs.length === 0) return false;
            selectedItem = this.filteredTabs[this.selectedIndex];
            tabId = selectedItem.id;
            
            // Handle regular tab switch
            return await this.executeTabResult(selectedItem);
        }
    }
    
    async executeContentResult(selectedItem) {
        const query = this.searchQuery.trim();
        this.log('🎯 GoFaster: Executing content result for:', selectedItem.tab.title, 'query:', query);
        
        try {
            // If this is the current tab, highlight and scroll to the result
            if (selectedItem.tab.active || selectedItem.tab.id === 'current') {
                this.log('📍 GoFaster: Highlighting result on current page');
                this.highlightAndScrollToResult(query);
                this.close();
                return true;
            } else {
                // Switch to the tab first, then highlight
                this.log('🔄 GoFaster: Switching to tab and highlighting result');
                await this.sendMessage({
                    action: 'switchToTab',
                    tabId: selectedItem.tab.id
                });
                
                // Wait a moment for tab switch, then highlight
                setTimeout(() => {
                    this.highlightResultInTab(selectedItem.tab.id, query);
                }, 500);
                
                this.close();
                return true;
            }
        } catch (error) {
            this.error('❌ GoFaster: Error executing content result:', error);
            
            // Show user-friendly error for context invalidation
            if (error.message.includes('Extension context invalidated')) {
                this.results.innerHTML = '<div class="no-results">Extension was reloaded. Please refresh this page.</div>';
            }
            
            return false;
        }
    }
    
    async executeTabResult(selectedItem) {
        const title = selectedItem.title;
        const tabId = selectedItem.id;
        
        this.log('🎯 GoFaster: Switching to tab:', title);
        
        try {
            await this.sendMessage({
                action: 'switchToTab',
                tabId: tabId
            });
            this.close();
            return true;
        } catch (error) {
            this.error('❌ GoFaster: Error switching to tab:', error);
            
            // Show user-friendly error for context invalidation
            if (error.message.includes('Extension context invalidated')) {
                this.results.innerHTML = '<div class="no-results">Extension was reloaded. Please refresh this page.</div>';
            }
            
            return false;
        }
    }
    
    async togglePinSelected() {
        if (this.filteredTabs.length === 0) return;
        
        const selectedTab = this.filteredTabs[this.selectedIndex];
        if (selectedTab) {
            this.log('📌 GoFaster: Toggling pin for tab:', selectedTab.title);
            
            // Calculate new state before sending message
            const newPinState = !selectedTab.pinned;
            
            try {
                const response = await this.sendMessage({
                    action: 'pinTab',
                    tabId: selectedTab.id,
                    pinned: newPinState
                });
                
                if (response && response.success) {
                    // Update local state with the new state we calculated
                    selectedTab.pinned = newPinState;
                    
                    // Also update the tab in the main tabs array
                    const mainTab = this.tabs.find(t => t.id === selectedTab.id);
                    if (mainTab) {
                        mainTab.pinned = newPinState;
                    }
                    
                    this.renderResults();
                    this.updateSelection();
                } else {
                    this.error('❌ GoFaster: Pin operation failed:', response);
                }
            } catch (error) {
                this.error('❌ GoFaster: Error toggling pin:', error);
            }
        }
    }
    
    async toggleMuteSelected() {
        if (this.filteredTabs.length === 0) return;
        
        const selectedTab = this.filteredTabs[this.selectedIndex];
        if (selectedTab) {
            this.log('🔇 GoFaster: Toggling mute for tab:', selectedTab.title);
            
            // Calculate new state before sending message
            const currentMuted = selectedTab.mutedInfo?.muted || false;
            const newMutedState = !currentMuted;
            
            try {
                const response = await this.sendMessage({
                    action: 'muteTab',
                    tabId: selectedTab.id,
                    muted: newMutedState
                });
                
                if (response && response.success) {
                    // Update local state with the new state we calculated
                    if (!selectedTab.mutedInfo) selectedTab.mutedInfo = {};
                    selectedTab.mutedInfo.muted = newMutedState;
                    
                    // Also update the tab in the main tabs array
                    const mainTab = this.tabs.find(t => t.id === selectedTab.id);
                    if (mainTab) {
                        if (!mainTab.mutedInfo) mainTab.mutedInfo = {};
                        mainTab.mutedInfo.muted = newMutedState;
                    }
                    
                    this.renderResults();
                    this.updateSelection();
                } else {
                    this.error('❌ GoFaster: Mute operation failed:', response);
                }
            } catch (error) {
                this.error('❌ GoFaster: Error toggling mute:', error);
            }
        }
    }
    
    async closeSelected() {
        if (this.filteredTabs.length === 0) return;
        
        const selectedTab = this.filteredTabs[this.selectedIndex];
        if (selectedTab) {
            this.log('🗑️ GoFaster: Closing tab:', selectedTab.title);
            
            try {
                await this.sendMessage({
                    action: 'closeTab',
                    tabId: selectedTab.id
                });
                
                // Remove from local arrays
                this.tabs = this.tabs.filter(tab => tab.id !== selectedTab.id);
                this.filteredTabs = this.filteredTabs.filter(tab => tab.id !== selectedTab.id);
                
                // Adjust selection if needed
                if (this.selectedIndex >= this.filteredTabs.length) {
                    this.selectedIndex = Math.max(0, this.filteredTabs.length - 1);
                }
                
                this.renderResults();
                this.updateSelection();
            } catch (error) {
                this.error('❌ GoFaster: Error closing tab:', error);
            }
        }
    }
    
    toggleDebugMode() {
        if (this.debugMode) {
            this.disableDebugMode();
        } else {
            this.enableDebugMode();
        }
        
        // Update footer to show current debug state
        this.updateFooter();
        
        // Show temporary notification
        this.showDebugModeNotification();
    }
    
    showDebugModeNotification() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.debugMode ? '#4CAF50' : '#f44336'};
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            z-index: 2147483648;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: opacity 0.3s ease;
        `;
        notification.textContent = `GoFaster Debug Mode ${this.debugMode ? 'Enabled' : 'Disabled'}`;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 2000);
    }
    
    toggleGrouping() {
        this.groupByDomain = !this.groupByDomain;
        this.log('📁 GoFaster: Toggling grouping:', this.groupByDomain ? 'ON' : 'OFF');
        
        // Update results with new grouping
        this.updateResults();
        
        // Reset selection to first item
        this.selectedIndex = 0;
        this.updateSelection();
        
        // Update footer to show current grouping state
        this.updateFooter();
    }
    
    groupTabsByDomain(tabs) {
        // Group tabs by domain
        const groups = {};
        
        tabs.forEach(tab => {
            const domain = this.extractDomain(tab.url || '');
            if (!groups[domain]) {
                groups[domain] = [];
            }
            groups[domain].push(tab);
        });
        
        // Sort domains alphabetically and flatten
        const sortedDomains = Object.keys(groups).sort();
        const groupedTabs = [];
        
        sortedDomains.forEach(domain => {
            // Sort tabs within each domain by title
            const domainTabs = groups[domain].sort((a, b) => {
                return (a.title || '').localeCompare(b.title || '');
            });
            
            groupedTabs.push(...domainTabs);
        });
        
        return groupedTabs;
    }
    
    updateFooter() {
        const groupingText = this.groupByDomain ? 'Grouped' : 'List';
        
        let shortcuts = [
            '<span><kbd>↑↓</kbd> Navigate</span>',
            '<span><kbd>Enter</kbd> Select</span>'
        ];
        
        if (this.paletteMode === 'content') {
            // Content search mode shortcuts
            shortcuts.push('<span><kbd>Ctrl+P</kbd> Tab Search</span>');
            shortcuts.push('<span><kbd>Esc</kbd> Close</span>');
        } else {
            // Tab search mode shortcuts
            shortcuts.push('<span><kbd>Ctrl+Shift+P</kbd> Pin</span>');
            shortcuts.push('<span><kbd>Ctrl+M</kbd> Mute</span>');
            shortcuts.push('<span><kbd>Del</kbd> Close Tab</span>');
            shortcuts.push(`<span><kbd>Ctrl+G</kbd> ${groupingText}</span>`);
            shortcuts.push('<span><kbd>Ctrl+F</kbd> Content Search</span>');
            shortcuts.push('<span><kbd>Esc</kbd> Close</span>');
        }
        
        this.footer.innerHTML = `
            <div class="shortcuts">
                ${shortcuts.join('')}
            </div>
        `;
    }
    
    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname || 'Unknown';
        } catch {
            return 'Unknown';
        }
    }
    
    highlightMatch(text) {
        if (!this.searchQuery) return text;
        
        const regex = new RegExp(`(${this.escapeRegex(this.searchQuery)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    highlightMatch(text) {
        if (!this.searchQuery) return text;
        
        const regex = new RegExp(`(${this.escapeRegex(this.searchQuery)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    switchToTabSearch() {
        if (this.paletteMode === 'tabs') return;
        
        this.log('🎯 GoFaster: Switching to tab search mode');
        this.paletteMode = 'tabs';
        this.searchInput.value = '';
        this.searchQuery = '';
        this.selectedIndex = 0;
        
        this.updatePlaceholder();
        this.updateFooter();
        this.updateResults();
    }
    
    switchToContentSearch() {
        if (this.paletteMode === 'content') return;
        
        this.log('🔍 GoFaster: Switching to content search mode');
        this.paletteMode = 'content';
        this.searchInput.value = '';
        this.searchQuery = '';
        this.selectedIndex = 0;
        
        this.updatePlaceholder();
        this.updateFooter();
        this.updateResults();
    }
    
    // Highlight and scroll to search result on current page
    highlightAndScrollToResult(query) {
        this.log('🎨 GoFaster: Highlighting search result for:', query);
        
        // Remove any existing highlights
        this.removeExistingHighlights();
        
        const queryLower = query.toLowerCase();
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;
                    
                    // Skip script, style, and other non-visible elements
                    const tagName = parent.tagName.toLowerCase();
                    if (['script', 'style', 'noscript', 'head'].includes(tagName)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    
                    // Skip if parent is hidden
                    const style = window.getComputedStyle(parent);
                    if (style.display === 'none' || style.visibility === 'hidden') {
                        return NodeFilter.FILTER_REJECT;
                    }
                    
                    const text = node.textContent.toLowerCase();
                    return text.includes(queryLower) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
            }
        );
        
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }
        
        if (textNodes.length === 0) {
            this.log('⚠️ GoFaster: No text nodes found to highlight');
            return;
        }
        
        let firstHighlight = null;
        let highlightCount = 0;
        
        textNodes.forEach(textNode => {
            const text = textNode.textContent;
            const textLower = text.toLowerCase();
            
            if (textLower.includes(queryLower)) {
                const parent = textNode.parentNode;
                const newHTML = text.replace(
                    new RegExp(`(${this.escapeRegex(query)})`, 'gi'),
                    '<mark class="gofaster-highlight" style="background: #ffeb3b; padding: 2px 4px; border-radius: 2px; box-shadow: 0 0 0 1px #f57f17;">$1</mark>'
                );
                
                // Create a temporary container to parse the HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = newHTML;
                
                // Replace the text node with the highlighted content
                const fragment = document.createDocumentFragment();
                while (tempDiv.firstChild) {
                    const child = tempDiv.firstChild;
                    fragment.appendChild(child);
                    
                    // Remember the first highlight for scrolling
                    if (!firstHighlight && child.classList && child.classList.contains('gofaster-highlight')) {
                        firstHighlight = child;
                    }
                }
                
                parent.replaceChild(fragment, textNode);
                highlightCount++;
            }
        });
        
        this.log('✅ GoFaster: Highlighted', highlightCount, 'text nodes');
        
        // Scroll to the first highlight
        if (firstHighlight) {
            this.log('📍 GoFaster: Scrolling to first highlight');
            firstHighlight.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'nearest'
            });
            
            // Add a temporary pulse effect
            firstHighlight.style.animation = 'gofaster-pulse 2s ease-in-out';
            
            // Remove highlights after 10 seconds
            setTimeout(() => {
                this.removeExistingHighlights();
            }, 10000);
        }
    }
    
    // Remove existing highlights
    removeExistingHighlights() {
        const highlights = document.querySelectorAll('.gofaster-highlight');
        highlights.forEach(highlight => {
            const parent = highlight.parentNode;
            parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
            parent.normalize(); // Merge adjacent text nodes
        });
        
        if (highlights.length > 0) {
            this.log('🧹 GoFaster: Removed', highlights.length, 'existing highlights');
        }
    }
    
    // Highlight result in another tab
    async highlightResultInTab(tabId, query) {
        try {
            this.log('🎨 GoFaster: Highlighting result in tab:', tabId);
            
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: (searchQuery) => {
                    // This runs in the target tab's context
                    console.log('GoFaster: Highlighting search result for:', searchQuery);
                    
                    // Remove any existing highlights
                    const existingHighlights = document.querySelectorAll('.gofaster-highlight');
                    existingHighlights.forEach(highlight => {
                        const parent = highlight.parentNode;
                        parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
                        parent.normalize();
                    });
                    
                    const queryLower = searchQuery.toLowerCase();
                    const walker = document.createTreeWalker(
                        document.body,
                        NodeFilter.SHOW_TEXT,
                        {
                            acceptNode: (node) => {
                                const parent = node.parentElement;
                                if (!parent) return NodeFilter.FILTER_REJECT;
                                
                                const tagName = parent.tagName.toLowerCase();
                                if (['script', 'style', 'noscript', 'head'].includes(tagName)) {
                                    return NodeFilter.FILTER_REJECT;
                                }
                                
                                const style = window.getComputedStyle(parent);
                                if (style.display === 'none' || style.visibility === 'hidden') {
                                    return NodeFilter.FILTER_REJECT;
                                }
                                
                                const text = node.textContent.toLowerCase();
                                return text.includes(queryLower) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                            }
                        }
                    );
                    
                    const textNodes = [];
                    let node;
                    while (node = walker.nextNode()) {
                        textNodes.push(node);
                    }
                    
                    let firstHighlight = null;
                    
                    textNodes.forEach(textNode => {
                        const text = textNode.textContent;
                        const textLower = text.toLowerCase();
                        
                        if (textLower.includes(queryLower)) {
                            const parent = textNode.parentNode;
                            const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const newHTML = text.replace(
                                new RegExp(`(${escapeRegex(searchQuery)})`, 'gi'),
                                '<mark class="gofaster-highlight" style="background: #ffeb3b; padding: 2px 4px; border-radius: 2px; box-shadow: 0 0 0 1px #f57f17; animation: gofaster-pulse 2s ease-in-out;">$1</mark>'
                            );
                            
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = newHTML;
                            
                            const fragment = document.createDocumentFragment();
                            while (tempDiv.firstChild) {
                                const child = tempDiv.firstChild;
                                fragment.appendChild(child);
                                
                                if (!firstHighlight && child.classList && child.classList.contains('gofaster-highlight')) {
                                    firstHighlight = child;
                                }
                            }
                            
                            parent.replaceChild(fragment, textNode);
                        }
                    });
                    
                    // Scroll to first highlight
                    if (firstHighlight) {
                        firstHighlight.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center',
                            inline: 'nearest'
                        });
                        
                        // Remove highlights after 10 seconds
                        setTimeout(() => {
                            const highlights = document.querySelectorAll('.gofaster-highlight');
                            highlights.forEach(highlight => {
                                const parent = highlight.parentNode;
                                parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
                                parent.normalize();
                            });
                        }, 10000);
                    }
                },
                args: [query]
            });
            
            this.log('✅ GoFaster: Highlight script injected successfully');
        } catch (error) {
            this.error('❌ GoFaster: Failed to highlight in tab:', error);
        }
    }
}

// Initialize when page loads
// Initialize when page loads
function initializeGoFaster() {
    // Check if debug mode is enabled for initialization logging
    const debugEnabled = localStorage.getItem('gofaster_debug') === 'true' || 
                         new URLSearchParams(window.location.search).get('gofaster_debug') === 'true';
    
    if (debugEnabled) {
        console.log('🚀 GoFaster: Page ready, initializing...');
    }
    
    // Wait a bit for the page to fully load
    setTimeout(() => {
        window.goFasterPalette = new GoFasterCommandPalette();
        
        if (window.goFasterPalette.debugMode) {
            console.log('✅ GoFaster: Command Palette initialized');
        }
        
        // Expose debug mode functions globally for console access
        window.goFasterDebug = {
            enable: () => {
                if (window.goFasterPalette) {
                    window.goFasterPalette.enableDebugMode();
                } else {
                    localStorage.setItem('gofaster_debug', 'true');
                    console.log('GoFaster: Debug mode will be enabled on next page load');
                }
            },
            disable: () => {
                if (window.goFasterPalette) {
                    window.goFasterPalette.disableDebugMode();
                } else {
                    localStorage.setItem('gofaster_debug', 'false');
                    console.log('GoFaster: Debug mode disabled');
                }
            },
            toggle: () => {
                if (window.goFasterPalette) {
                    window.goFasterPalette.toggleDebugMode();
                } else {
                    const current = localStorage.getItem('gofaster_debug') === 'true';
                    localStorage.setItem('gofaster_debug', (!current).toString());
                    console.log(`GoFaster: Debug mode ${!current ? 'enabled' : 'disabled'} (reload page to take effect)`);
                }
            },
            status: () => {
                if (window.goFasterPalette) {
                    console.log(`GoFaster: Debug mode is ${window.goFasterPalette.debugMode ? 'enabled' : 'disabled'}`);
                } else {
                    const enabled = localStorage.getItem('gofaster_debug') === 'true';
                    console.log(`GoFaster: Debug mode is ${enabled ? 'enabled' : 'disabled'} (not initialized yet)`);
                }
            }
        };
        
        // Show console help message if debug mode is enabled
        if (window.goFasterPalette && window.goFasterPalette.debugMode) {
            console.log('%cGoFaster Debug Mode', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
            console.log('Available commands:');
            console.log('  goFasterDebug.enable()  - Enable debug mode');
            console.log('  goFasterDebug.disable() - Disable debug mode');
            console.log('  goFasterDebug.toggle()  - Toggle debug mode');
            console.log('  goFasterDebug.status()  - Show debug status');
            console.log('  Or use Ctrl+Shift+D in the command palette');
        }
    }, 100);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGoFaster);
} else {
    initializeGoFaster();
}
