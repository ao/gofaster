// Testable version of GoFaster Content Script
// This is a copy of the main content script but with dependency injection for testing

export class GoFasterCommandPalette {
    constructor(options = {}) {
        this.isOpen = false;
        this.tabs = [];
        this.filteredTabs = [];
        this.selectedIndex = 0;
        this.searchQuery = '';
        this.isLoading = false;
        this.groupByDomain = false; // Add grouping state
        
        // Allow dependency injection for testing
        this.chrome = options.chrome || globalThis.chrome;
        this.document = options.document || globalThis.document;
        this.console = options.console || globalThis.console;
        
        this.console.log('🚀 GoFaster: Initializing command palette');
        
        if (this.document) {
            this.createPalette();
            this.bindEvents();
        }
        
        // Test connection to background script
        this.testConnection();
    }
    
    async testConnection() {
        try {
            this.console.log('🔍 GoFaster: Testing connection to background script');
            const response = await this.sendMessage({ action: 'getTabs' });
            this.console.log('✅ GoFaster: Connection successful, got', response?.tabs?.length || 0, 'tabs');
            return true;
        } catch (error) {
            this.console.error('❌ GoFaster: Connection test failed:', error);
            return false;
        }
    }
    
    sendMessage(message) {
        return new Promise((resolve, reject) => {
            if (!this.chrome?.runtime?.sendMessage) {
                reject(new Error('Chrome runtime not available'));
                return;
            }
            
            this.chrome.runtime.sendMessage(message, (response) => {
                if (this.chrome.runtime.lastError) {
                    reject(new Error(this.chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }
    
    createPalette() {
        this.console.log('🎨 GoFaster: Creating palette DOM elements');
        
        // Remove existing palette if it exists
        const existing = this.document.getElementById('gofaster-overlay');
        if (existing) {
            existing.remove();
        }
        
        // Create overlay container
        this.overlay = this.document.createElement('div');
        this.overlay.id = 'gofaster-overlay';
        this.overlay.className = 'gofaster-hidden';
        
        // Create command palette
        this.palette = this.document.createElement('div');
        this.palette.id = 'gofaster-palette';
        
        // Create search input
        this.searchInput = this.document.createElement('input');
        this.searchInput.id = 'gofaster-search';
        this.searchInput.type = 'text';
        this.searchInput.placeholder = 'Search tabs, commands, or content...';
        this.searchInput.autocomplete = 'off';
        this.searchInput.spellcheck = false;
        
        // Create results container
        this.results = this.document.createElement('div');
        this.results.id = 'gofaster-results';
        
        // Create footer with shortcuts
        this.footer = this.document.createElement('div');
        this.footer.id = 'gofaster-footer';
        this.footer.innerHTML = `
            <div class="shortcuts">
                <span><kbd>↑↓</kbd> Navigate</span>
                <span><kbd>Enter</kbd> Select</span>
                <span><kbd>Ctrl+Shift+P</kbd> Pin</span>
                <span><kbd>Ctrl+M</kbd> Mute</span>
                <span><kbd>Del</kbd> Close</span>
                <span><kbd>Esc</kbd> Exit</span>
            </div>
        `;
        
        // Assemble palette
        this.palette.appendChild(this.searchInput);
        this.palette.appendChild(this.results);
        this.palette.appendChild(this.footer);
        this.overlay.appendChild(this.palette);
        
        // Add to page
        this.document.body.appendChild(this.overlay);
        
        this.console.log('✅ GoFaster: Palette DOM created');
    }
    
    bindEvents() {
        this.console.log('🔗 GoFaster: Binding events');
        
        // Listen for keyboard shortcuts
        this.document.addEventListener('keydown', (e) => {
            // Ctrl+P / Cmd+P to toggle palette
            if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey) {
                e.preventDefault();
                this.console.log('⌨️ GoFaster: Ctrl+P detected');
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
                        if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
                            e.preventDefault();
                            this.togglePinSelected();
                        }
                        break;
                    case 'm':
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            this.toggleMuteSelected();
                        }
                        break;
                    case 'x':
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            this.closeSelected();
                        }
                        break;
                    case 'Delete':
                        e.preventDefault();
                        this.closeSelected();
                        break;
                }
            }
        });
        
        // Search input events
        this.searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.console.log('🔍 GoFaster: Search query changed:', this.searchQuery);
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
        
        // Listen for messages from background script
        if (this.chrome?.runtime?.onMessage) {
            this.chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                this.console.log('📨 GoFaster: Received message:', request.action);
                
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
    }
    
    async toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            await this.open();
        }
    }
    
    async open() {
        if (this.isOpen) return;
        
        this.console.log('🚪 GoFaster: Opening command palette');
        
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
            this.console.log('✅ GoFaster: Tabs loaded successfully');
            
            // Update results after tabs are loaded
            this.updateResults();
            
            // Focus search input after everything is ready
            this.focusSearchInput();
        } catch (error) {
            this.console.error('❌ GoFaster: Failed to load tabs:', error);
            this.results.innerHTML = `
                <div class="no-results">
                    Error loading tabs: ${error.message}<br>
                    <small>Check browser console for details</small>
                </div>
            `;
        }
    }
    
    focusSearchInput() {
        this.console.log('🎯 GoFaster: Attempting to focus search input');
        
        if (!this.searchInput) {
            this.console.error('❌ GoFaster: Search input not found');
            return false;
        }
        
        // Immediate focus attempt
        this.searchInput.focus();
        
        // Multiple focus attempts for reliability
        const attemptFocus = (attempt = 1) => {
            setTimeout(() => {
                this.searchInput.focus();
                
                setTimeout(() => {
                    if (this.document.activeElement === this.searchInput) {
                        this.console.log('✅ GoFaster: Search input focused successfully on attempt', attempt);
                    } else {
                        this.console.log('⚠️ GoFaster: Focus attempt', attempt, 'failed, active element:', this.document.activeElement?.tagName);
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
        
        this.console.log('🚪 GoFaster: Closing command palette');
        
        this.isOpen = false;
        this.overlay.classList.add('gofaster-hidden');
        this.searchInput.blur();
    }
    
    async loadTabs() {
        this.console.log('📋 GoFaster: Loading tabs from background script');
        this.isLoading = true;
        
        try {
            const response = await this.sendMessage({ action: 'getTabs' });
            
            if (response && response.tabs) {
                this.tabs = response.tabs;
                this.console.log('✅ GoFaster: Loaded', this.tabs.length, 'tabs');
            } else {
                this.console.error('❌ GoFaster: Invalid response from background script:', response);
                this.tabs = [];
                throw new Error('Invalid response from background script');
            }
        } catch (error) {
            this.console.error('❌ GoFaster: Error loading tabs:', error);
            this.tabs = [];
            throw error; // Re-throw for caller to handle
        } finally {
            this.isLoading = false;
        }
    }
    
    updateResults() {
        this.console.log('🔄 GoFaster: Updating results. Tabs:', this.tabs.length, 'Query:', this.searchQuery, 'Loading:', this.isLoading);
        
        if (this.isLoading) {
            this.results.innerHTML = '<div class="no-results">Loading tabs...</div>';
            return;
        }
        
        this.filteredTabs = this.filterTabs();
        this.console.log('📊 GoFaster: Filtered to', this.filteredTabs.length, 'tabs');
        
        this.renderResults();
        this.updateSelection();
    }
    
    filterTabs() {
        if (this.tabs.length === 0) {
            this.console.log('⚠️ GoFaster: No tabs available to filter');
            return [];
        }
        
        // Filter out null/invalid tabs
        const validTabs = this.tabs.filter(tab => tab && typeof tab === 'object' && tab.id);
        
        let filteredTabs;
        
        if (!this.searchQuery) {
            filteredTabs = validTabs; // Show ALL tabs, not just first 10
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
            return this.groupTabsByDomain(filteredTabs);
        }
        
        return filteredTabs;
    }
    
    renderResults() {
        if (this.isLoading) {
            this.results.innerHTML = '<div class="no-results">Loading tabs...</div>';
            return;
        }
        
        if (this.tabs.length === 0) {
            this.results.innerHTML = '<div class="no-results">No tabs available</div>';
            return;
        }
        
        if (this.filteredTabs.length === 0) {
            const message = this.searchQuery ? 'No tabs found' : 'No tabs to display';
            this.results.innerHTML = `<div class="no-results">${message}</div>`;
            return;
        }
        
        // Clear existing results
        this.results.innerHTML = '';
        
        // Create result items using DOM manipulation for proper rendering
        this.filteredTabs.forEach((tab, index) => {
            // Handle malformed tab data
            if (!tab || typeof tab !== 'object') {
                return;
            }
            
            const title = tab.title || 'Untitled Tab';
            const url = tab.url || 'about:blank';
            const domain = this.extractDomain(url);
            
            // Create result item element
            const resultItem = this.document.createElement('div');
            resultItem.className = 'result-item';
            resultItem.dataset.index = index;
            resultItem.dataset.tabId = tab.id || 0;
            
            // Create favicon
            const favicon = this.document.createElement('img');
            favicon.className = 'result-favicon';
            favicon.src = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23f1f3f4"/></svg>';
            favicon.alt = '';
            favicon.onerror = function() { this.style.display = 'none'; };
            
            // Create content container
            const content = this.document.createElement('div');
            content.className = 'result-content';
            
            // Create title
            const titleEl = this.document.createElement('div');
            titleEl.className = 'result-title';
            titleEl.innerHTML = this.highlightMatch(this.escapeHtml(title));
            
            // Create URL
            const urlEl = this.document.createElement('div');
            urlEl.className = 'result-url';
            urlEl.innerHTML = this.highlightMatch(domain);
            
            content.appendChild(titleEl);
            content.appendChild(urlEl);
            
            // Create actions (indicators)
            const actions = this.document.createElement('div');
            actions.className = 'result-actions';
            
            if (tab.active) {
                const activeIndicator = this.document.createElement('span');
                activeIndicator.className = 'active-indicator';
                activeIndicator.textContent = '●';
                actions.appendChild(activeIndicator);
            }
            
            if (tab.pinned) {
                const pinnedIndicator = this.document.createElement('span');
                pinnedIndicator.className = 'pinned-indicator';
                pinnedIndicator.textContent = '📌';
                actions.appendChild(pinnedIndicator);
            }
            
            if (tab.audible) {
                const audioIndicator = this.document.createElement('span');
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
        
        this.console.log('✅ GoFaster: Rendered', this.filteredTabs.length, 'results');
    }
    
    updateSelection() {
        const items = this.results.querySelectorAll('.result-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
        });
        
        // Scroll selected item into view
        const selectedItem = items[this.selectedIndex];
        if (selectedItem && selectedItem.scrollIntoView) {
            selectedItem.scrollIntoView({ block: 'nearest' });
        }
    }
    
    selectNext() {
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredTabs.length - 1);
        this.updateSelection();
    }
    
    selectPrevious() {
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateSelection();
    }
    
    async executeSelected() {
        if (this.filteredTabs.length === 0) {
            return false;
        }
        
        const selectedTab = this.filteredTabs[this.selectedIndex];
        if (selectedTab) {
            this.console.log('🎯 GoFaster: Switching to tab:', selectedTab.title);
            
            try {
                await this.sendMessage({
                    action: 'switchToTab',
                    tabId: selectedTab.id
                });
                this.close();
                return true;
            } catch (error) {
                this.console.error('❌ GoFaster: Error switching to tab:', error);
                return false;
            }
        }
        return false;
    }
    
    async togglePinSelected() {
        if (this.filteredTabs.length === 0) return;
        
        const selectedTab = this.filteredTabs[this.selectedIndex];
        if (selectedTab) {
            this.console.log('📌 GoFaster: Toggling pin for tab:', selectedTab.title);
            
            try {
                await this.sendMessage({
                    action: 'pinTab',
                    tabId: selectedTab.id,
                    pinned: !selectedTab.pinned
                });
                
                // Update local state
                selectedTab.pinned = !selectedTab.pinned;
                this.renderResults();
                this.updateSelection();
            } catch (error) {
                this.console.error('❌ GoFaster: Error toggling pin:', error);
            }
        }
    }
    
    async toggleMuteSelected() {
        if (this.filteredTabs.length === 0) return;
        
        const selectedTab = this.filteredTabs[this.selectedIndex];
        if (selectedTab) {
            this.console.log('🔇 GoFaster: Toggling mute for tab:', selectedTab.title);
            
            try {
                await this.sendMessage({
                    action: 'muteTab',
                    tabId: selectedTab.id,
                    muted: !selectedTab.mutedInfo?.muted
                });
                
                // Update local state
                if (!selectedTab.mutedInfo) selectedTab.mutedInfo = {};
                selectedTab.mutedInfo.muted = !selectedTab.mutedInfo.muted;
                this.renderResults();
                this.updateSelection();
            } catch (error) {
                this.console.error('❌ GoFaster: Error toggling mute:', error);
            }
        }
    }
    
    async closeSelected() {
        if (this.filteredTabs.length === 0) return;
        
        const selectedTab = this.filteredTabs[this.selectedIndex];
        if (selectedTab) {
            this.console.log('🗑️ GoFaster: Closing tab:', selectedTab.title);
            
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
                this.console.error('❌ GoFaster: Error closing tab:', error);
            }
        }
    }
    
    toggleGrouping() {
        this.groupByDomain = !this.groupByDomain;
        this.console.log('📁 GoFaster: Toggling grouping:', this.groupByDomain ? 'ON' : 'OFF');
        
        // Update results with new grouping
        this.updateResults();
        
        // Reset selection to first item
        this.selectedIndex = 0;
        this.updateSelection();
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
        const div = this.document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
