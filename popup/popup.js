class TabManager {
    constructor() {
        this.tabs = [];
        this.selectedTabs = new Set();
        this.groupByDomain = false;
        this.searchQuery = '';
        
        this.initializeElements();
        this.bindEvents();
        this.loadTabs();
    }
    
    initializeElements() {
        this.searchInput = document.getElementById('searchInput');
        this.tabList = document.getElementById('tabList');
        this.tabCount = document.getElementById('tabCount');
        this.selectedCount = document.getElementById('selectedCount');
        this.closeSelectedBtn = document.getElementById('closeSelected');
        this.selectAllBtn = document.getElementById('selectAll');
        this.groupByDomainBtn = document.getElementById('groupByDomain');
        this.refreshBtn = document.getElementById('refreshTabs');
    }
    
    bindEvents() {
        this.searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderTabs();
        });
        
        this.closeSelectedBtn.addEventListener('click', () => {
            this.closeSelectedTabs();
        });
        
        this.selectAllBtn.addEventListener('click', () => {
            this.toggleSelectAll();
        });
        
        this.groupByDomainBtn.addEventListener('click', () => {
            this.toggleGroupByDomain();
        });
        
        this.refreshBtn.addEventListener('click', () => {
            this.loadTabs();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && this.selectedTabs.size > 0) {
                this.closeSelectedTabs();
            }
        });
    }
    
    async loadTabs() {
        try {
            this.tabs = await chrome.tabs.query({});
            this.selectedTabs.clear();
            this.renderTabs();
            this.updateStats();
            
            // Focus the search input when tabs are loaded
            this.focusSearchInput();
        } catch (error) {
            console.error('Error loading tabs:', error);
        }
    }
    
    focusSearchInput() {
        // Focus search input with multiple attempts for reliability
        if (this.searchInput) {
            this.searchInput.focus();
            
            // Backup focus attempts
            setTimeout(() => {
                if (document.activeElement !== this.searchInput) {
                    this.searchInput.focus();
                }
            }, 50);
            
            setTimeout(() => {
                if (document.activeElement !== this.searchInput) {
                    this.searchInput.focus();
                    this.searchInput.select();
                }
            }, 150);
        }
    }
    
    renderTabs() {
        const filteredTabs = this.filterTabs();
        
        if (filteredTabs.length === 0) {
            this.tabList.innerHTML = '<div class="no-tabs">No tabs found</div>';
            return;
        }
        
        if (this.groupByDomain) {
            this.renderGroupedTabs(filteredTabs);
        } else {
            this.renderFlatTabs(filteredTabs);
        }
        
        this.updateStats();
    }
    
    filterTabs() {
        if (!this.searchQuery) return this.tabs;
        
        return this.tabs.filter(tab => 
            tab.title.toLowerCase().includes(this.searchQuery) ||
            tab.url.toLowerCase().includes(this.searchQuery)
        );
    }
    
    renderFlatTabs(tabs) {
        this.tabList.innerHTML = tabs.map(tab => this.createTabElement(tab)).join('');
        this.bindTabEvents();
    }
    
    renderGroupedTabs(tabs) {
        const grouped = this.groupTabsByDomain(tabs);
        let html = '';
        
        for (const [domain, domainTabs] of Object.entries(grouped)) {
            html += `<div class="domain-group">${domain} (${domainTabs.length})</div>`;
            html += domainTabs.map(tab => this.createTabElement(tab)).join('');
        }
        
        this.tabList.innerHTML = html;
        this.bindTabEvents();
    }
    
    groupTabsByDomain(tabs) {
        const grouped = {};
        
        tabs.forEach(tab => {
            const domain = this.extractDomain(tab.url);
            if (!grouped[domain]) {
                grouped[domain] = [];
            }
            grouped[domain].push(tab);
        });
        
        return grouped;
    }
    
    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname || 'Unknown';
        } catch {
            return 'Unknown';
        }
    }
    
    createTabElement(tab) {
        const isSelected = this.selectedTabs.has(tab.id);
        const favicon = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23f1f3f4"/></svg>';
        
        return `
            <div class="tab-item ${tab.active ? 'active' : ''}" data-tab-id="${tab.id}">
                <input type="checkbox" class="tab-checkbox" ${isSelected ? 'checked' : ''}>
                <img class="tab-favicon" src="${favicon}" alt="">
                <div class="tab-info">
                    <div class="tab-title">${this.escapeHtml(tab.title)}</div>
                    <div class="tab-url">${this.escapeHtml(tab.url)}</div>
                </div>
                <div class="tab-actions">
                    ${tab.pinned ? '<button class="tab-action-btn tab-pinned" title="Unpin">📌</button>' : '<button class="tab-action-btn" title="Pin">📌</button>'}
                    ${tab.audible ? '<button class="tab-action-btn tab-audible" title="Mute">🔊</button>' : ''}
                    <button class="tab-action-btn" title="Close">✕</button>
                </div>
            </div>
        `;
    }
    
    bindTabEvents() {
        // Tab click to switch
        document.querySelectorAll('.tab-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.type === 'checkbox' || e.target.classList.contains('tab-action-btn')) {
                    return;
                }
                
                const tabId = parseInt(item.dataset.tabId);
                this.switchToTab(tabId);
            });
        });
        
        // Checkbox events
        document.querySelectorAll('.tab-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const tabId = parseInt(e.target.closest('.tab-item').dataset.tabId);
                
                if (e.target.checked) {
                    this.selectedTabs.add(tabId);
                } else {
                    this.selectedTabs.delete(tabId);
                }
                
                this.updateSelectedState();
            });
        });
        
        // Action button events
        document.querySelectorAll('.tab-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tabId = parseInt(e.target.closest('.tab-item').dataset.tabId);
                const title = e.target.title;
                
                switch (title) {
                    case 'Pin':
                    case 'Unpin':
                        this.togglePinTab(tabId);
                        break;
                    case 'Mute':
                        this.muteTab(tabId);
                        break;
                    case 'Close':
                        this.closeTab(tabId);
                        break;
                }
            });
        });
    }
    
    async switchToTab(tabId) {
        try {
            await chrome.tabs.update(tabId, { active: true });
            const tab = await chrome.tabs.get(tabId);
            await chrome.windows.update(tab.windowId, { focused: true });
            window.close();
        } catch (error) {
            console.error('Error switching to tab:', error);
        }
    }
    
    async closeTab(tabId) {
        try {
            await chrome.tabs.remove(tabId);
            this.selectedTabs.delete(tabId);
            this.loadTabs();
        } catch (error) {
            console.error('Error closing tab:', error);
        }
    }
    
    async closeSelectedTabs() {
        if (this.selectedTabs.size === 0) return;
        
        try {
            await chrome.tabs.remove([...this.selectedTabs]);
            this.selectedTabs.clear();
            this.loadTabs();
        } catch (error) {
            console.error('Error closing selected tabs:', error);
        }
    }
    
    async togglePinTab(tabId) {
        try {
            const tab = await chrome.tabs.get(tabId);
            await chrome.tabs.update(tabId, { pinned: !tab.pinned });
            this.loadTabs();
        } catch (error) {
            console.error('Error toggling pin state:', error);
        }
    }
    
    async muteTab(tabId) {
        try {
            const tab = await chrome.tabs.get(tabId);
            await chrome.tabs.update(tabId, { muted: !tab.mutedInfo.muted });
            this.loadTabs();
        } catch (error) {
            console.error('Error muting tab:', error);
        }
    }
    
    toggleSelectAll() {
        const filteredTabs = this.filterTabs();
        const allSelected = filteredTabs.every(tab => this.selectedTabs.has(tab.id));
        
        if (allSelected) {
            filteredTabs.forEach(tab => this.selectedTabs.delete(tab.id));
        } else {
            filteredTabs.forEach(tab => this.selectedTabs.add(tab.id));
        }
        
        this.renderTabs();
    }
    
    toggleGroupByDomain() {
        this.groupByDomain = !this.groupByDomain;
        this.groupByDomainBtn.style.background = this.groupByDomain ? '#e8f0fe' : '#f1f3f4';
        this.renderTabs();
    }
    
    updateSelectedState() {
        this.closeSelectedBtn.disabled = this.selectedTabs.size === 0;
        this.updateStats();
    }
    
    updateStats() {
        const filteredTabs = this.filterTabs();
        this.tabCount.textContent = `${filteredTabs.length} tab${filteredTabs.length !== 1 ? 's' : ''}`;
        this.selectedCount.textContent = `${this.selectedTabs.size} selected`;
        this.closeSelectedBtn.disabled = this.selectedTabs.size === 0;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the Tab Manager when the popup loads
document.addEventListener('DOMContentLoaded', () => {
    const tabManager = new TabManager();
    
    // Also focus immediately when popup opens
    setTimeout(() => {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.focus();
        }
    }, 100);
});
