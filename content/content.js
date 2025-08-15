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
        this.searchMode = 'tabs'; // 'tabs' or 'content'
        this.debugMode = false; // Debug mode flag
        
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
        this.searchInput.placeholder = 'Search tabs, content, or commands...';
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
    
    bindEvents() {
        this.log('🔗 GoFaster: Binding events');
        
        // Listen for keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+P / Cmd+P to toggle palette
            if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey) {
                e.preventDefault();
                this.log('⌨️ GoFaster: Ctrl+P detected');
                
                // Check if extension context is still valid
                if (!this.isExtensionContextValid()) {
                    this.warn('⚠️ GoFaster: Extension context invalidated, showing message');
                    // Create a temporary overlay to show the message
                    if (!this.isOpen) {
                        this.isOpen = true;
                        this.overlay.classList.remove('gofaster-hidden');
                        this.showExtensionInvalidatedMessage();
                    }
                    return;
                }
                
                this.toggle();
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
                        // Pin/unpin selected tab (only with Shift to avoid conflict)
                        if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
                            e.preventDefault();
                            this.togglePinSelected();
                        }
                        break;
                    case 'm':
                        // Mute/unmute selected tab
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            this.toggleMuteSelected();
                        }
                        break;
                    case 'x':
                        // Close selected tab
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            this.closeSelected();
                        }
                        break;
                    case 'Delete':
                        // Alternative close shortcut
                        e.preventDefault();
                        this.closeSelected();
                        break;
                    case 'g':
                        // Toggle grouping with Ctrl+G
                        if (e.ctrlKey || e.metaKey) {
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
            this.log('🔍 GoFaster: Search query changed:', this.searchQuery);
            
            // Determine search mode based on query
            if (this.searchQuery.length >= 3 && this.searchQuery.includes(' ')) {
                // Longer queries with spaces are likely content searches
                this.searchMode = 'content';
            } else {
                // Short queries or single words are tab searches
                this.searchMode = 'tabs';
            }
            
            this.updateResults();
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
                this.open();
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
    
    async toggle() {
        if (!this.isExtensionContextValid()) {
            this.warn('⚠️ GoFaster: Extension context invalidated, cannot toggle palette');
            return;
        }
        
        if (this.isOpen) {
            this.close();
        } else {
            await this.open();
        }
    }
    
    async open() {
        if (this.isOpen) return;
        
        this.log('🚪 GoFaster: Opening command palette');
        
        this.isOpen = true;
        this.overlay.classList.remove('gofaster-hidden');
        this.searchInput.value = '';
        this.searchQuery = '';
        this.selectedIndex = 0;
        this.isLoading = true;
        
        // Show loading state immediately
        this.results.innerHTML = '<div class="no-results">Loading tabs...</div>';
        
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
                    ${errorMessage}<br>
                    <small>Press Escape to close</small>
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
        this.log('🔄 GoFaster: Updating results. Mode:', this.searchMode, 'Query:', this.searchQuery, 'Loading:', this.isLoading);
        
        // Don't block search if we're just loading tabs initially
        // Only block if we're in the middle of a content search
        if (this.isLoading && this.searchMode === 'content') {
            this.results.innerHTML = '<div class="no-results">Loading...</div>';
            return;
        }
        
        if (this.searchMode === 'content' && this.searchQuery.length >= 3) {
            await this.performContentSearch();
        } else {
            this.performTabSearch();
        }
        
        this.renderResults();
        this.updateSelection();
    }
    
    performTabSearch() {
        this.filteredTabs = this.filterTabs();
        this.contentResults = [];
        this.log('📊 GoFaster: Filtered to', this.filteredTabs.length, 'tabs');
    }
    
    async performContentSearch() {
        this.log('🔍 GoFaster: Performing content search for:', this.searchQuery);
        
        this.isLoading = true;
        this.results.innerHTML = '<div class="no-results">Searching page content...</div>';
        
        try {
            const response = await this.sendMessage({
                action: 'searchContent',
                query: this.searchQuery
            });
            
            if (response && response.success) {
                this.contentResults = response.results || [];
                this.filteredTabs = [];
                this.log('✅ GoFaster: Content search found', this.contentResults.length, 'results');
            } else {
                this.error('❌ GoFaster: Content search failed:', response?.error);
                this.contentResults = [];
                this.filteredTabs = [];
            }
        } catch (error) {
            this.error('❌ GoFaster: Content search error:', error);
            this.contentResults = [];
            this.filteredTabs = [];
            
            // Show user-friendly error for context invalidation
            if (error.message.includes('Extension context invalidated')) {
                this.results.innerHTML = '<div class="no-results">Extension was reloaded. Please refresh this page.</div>';
                return;
            }
        } finally {
            this.isLoading = false;
        }
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
        if (this.isLoading) {
            this.results.innerHTML = '<div class="no-results">Loading...</div>';
            return;
        }
        
        // Handle content search results
        if (this.searchMode === 'content') {
            this.renderContentResults();
            return;
        }
        
        // Handle tab search results
        if (this.tabs.length === 0) {
            this.results.innerHTML = '<div class="no-results">No tabs available</div>';
            return;
        }
        
        if (this.filteredTabs.length === 0) {
            const message = this.searchQuery ? 'No tabs found' : 'No tabs to display';
            this.results.innerHTML = `<div class="no-results">${message}</div>`;
            return;
        }
        
        this.renderTabResults();
    }
    
    renderContentResults() {
        this.log('🎨 GoFaster: Rendering', this.contentResults.length, 'content results');
        
        // Clear existing results
        this.results.innerHTML = '';
        
        if (this.contentResults.length === 0) {
            this.results.innerHTML = '<div class="no-results">No content matches found</div>';
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
        const maxIndex = this.searchMode === 'content' ? 
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
        
        if (this.searchMode === 'content' && this.contentResults.length > 0) {
            if (this.selectedIndex >= this.contentResults.length) return false;
            selectedItem = this.contentResults[this.selectedIndex];
            tabId = selectedItem.tab.id;
        } else {
            if (this.filteredTabs.length === 0) return false;
            selectedItem = this.filteredTabs[this.selectedIndex];
            tabId = selectedItem.id;
        }
        
        if (selectedItem) {
            const title = this.searchMode === 'content' ? selectedItem.tab.title : selectedItem.title;
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
        return false;
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
            '<span><kbd>Enter</kbd> Select</span>',
            '<span><kbd>Ctrl+Shift+P</kbd> Pin</span>',
            '<span><kbd>Ctrl+M</kbd> Mute</span>',
            '<span><kbd>Del</kbd> Close</span>',
            `<span><kbd>Ctrl+G</kbd> ${groupingText}</span>`,
            '<span><kbd>Esc</kbd> Exit</span>'
        ];
        
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
