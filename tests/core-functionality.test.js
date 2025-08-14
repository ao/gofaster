import { describe, test, expect, beforeEach } from 'bun:test';
import { GoFasterCommandPalette } from './testable/content-script.js';
import { setupDOM, createMockChrome, createKeyboardEvent, sleep } from './utils/test-utils.js';

describe('GoFaster Core Functionality Tests', () => {
    let dom, mockChrome, mockTabs, palette;

    beforeEach(() => {
        dom = setupDOM();
        const chromeSetup = createMockChrome();
        mockChrome = chromeSetup.mockChrome;
        mockTabs = chromeSetup.mockTabs;
        
        palette = new GoFasterCommandPalette({
            chrome: mockChrome,
            document: global.document,
            console: { log: () => {}, error: () => {}, warn: () => {} }
        });
    });

    describe('Essential Functionality', () => {
        test('should initialize correctly', () => {
            expect(palette).toBeDefined();
            expect(palette.isOpen).toBe(false);
            expect(palette.tabs).toEqual([]);
            expect(palette.selectedIndex).toBe(0);
        });

        test('should create DOM elements', () => {
            const overlay = document.getElementById('gofaster-overlay');
            const searchInput = document.getElementById('gofaster-search');
            const results = document.getElementById('gofaster-results');

            expect(overlay).toBeDefined();
            expect(searchInput).toBeDefined();
            expect(results).toBeDefined();
        });

        test('should load tabs from background script', async () => {
            await palette.loadTabs();
            
            expect(palette.tabs.length).toBe(4);
            expect(palette.isLoading).toBe(false);
        });

        test('should open and close palette', async () => {
            expect(palette.isOpen).toBe(false);
            
            await palette.open();
            expect(palette.isOpen).toBe(true);
            
            palette.close();
            expect(palette.isOpen).toBe(false);
        });

        test('should filter tabs by search query', async () => {
            await palette.loadTabs();
            
            // No search - should show all tabs
            palette.searchQuery = '';
            let filtered = palette.filterTabs();
            expect(filtered.length).toBe(4);
            
            // Search for GitHub
            palette.searchQuery = 'GitHub';
            filtered = palette.filterTabs();
            expect(filtered.length).toBe(1);
            expect(filtered[0].title).toContain('GitHub');
            
            // Search for non-existent
            palette.searchQuery = 'nonexistent';
            filtered = palette.filterTabs();
            expect(filtered.length).toBe(0);
        });

        test('should handle navigation', async () => {
            await palette.loadTabs();
            palette.updateResults();
            
            expect(palette.selectedIndex).toBe(0);
            
            palette.selectNext();
            expect(palette.selectedIndex).toBe(1);
            
            palette.selectPrevious();
            expect(palette.selectedIndex).toBe(0);
            
            // Should not go below 0
            palette.selectPrevious();
            expect(palette.selectedIndex).toBe(0);
        });

        test('should execute tab switching', async () => {
            await palette.loadTabs();
            palette.updateResults();
            
            palette.selectedIndex = 1; // Select second tab
            const result = await palette.executeSelected();
            
            expect(result).toBe(true);
            expect(palette.isOpen).toBe(false);
            
            // Check that the tab was activated
            expect(mockTabs[1].active).toBe(true);
        });

        test('should handle keyboard events for basic navigation', async () => {
            await palette.open();
            
            // Test Escape to close
            const escapeEvent = createKeyboardEvent('Escape');
            document.dispatchEvent(escapeEvent);
            expect(palette.isOpen).toBe(false);
            
            // Test Ctrl+P to open
            const ctrlPEvent = createKeyboardEvent('p', { ctrl: true });
            document.dispatchEvent(ctrlPEvent);
            await sleep(50);
            expect(palette.isOpen).toBe(true);
        });

        test('should handle search input changes', async () => {
            await palette.open();
            
            palette.searchInput.value = 'test search';
            const inputEvent = new Event('input', { bubbles: true });
            palette.searchInput.dispatchEvent(inputEvent);
            
            expect(palette.searchQuery).toBe('test search');
        });

        test('should render results correctly', async () => {
            await palette.open();
            
            // Should have rendered result items
            const resultItems = palette.results.querySelectorAll('.result-item');
            expect(resultItems.length).toBe(4);
            
            // Each item should have proper structure
            resultItems.forEach(item => {
                expect(item.querySelector('.result-title')).toBeDefined();
                expect(item.querySelector('.result-url')).toBeDefined();
                expect(item.dataset.index).toBeDefined();
                expect(item.dataset.tabId).toBeDefined();
            });
        });

        test('should show all tabs without limits', async () => {
            // Create many tabs to test the limit removal
            const manyTabs = [];
            for (let i = 0; i < 25; i++) {
                manyTabs.push({
                    id: i + 100,
                    title: `Tab ${i}`,
                    url: `https://example${i}.com`,
                    active: false,
                    pinned: false,
                    audible: false,
                    lastAccessed: Date.now() - i * 1000,
                    mutedInfo: { muted: false }
                });
            }
            
            // Mock the response to return many tabs
            palette.sendMessage = () => Promise.resolve({ tabs: manyTabs });
            
            await palette.loadTabs();
            palette.updateResults();
            
            // Should show all tabs, not just 10
            expect(palette.filteredTabs.length).toBe(25);
        });

        test('should handle grouping functionality', async () => {
            await palette.loadTabs();
            
            // Initially not grouped
            expect(palette.groupByDomain).toBe(false);
            
            // Toggle grouping
            palette.toggleGrouping();
            expect(palette.groupByDomain).toBe(true);
            
            // Should still have same tabs, just grouped
            expect(palette.filteredTabs.length).toBe(4);
            
            // Toggle back
            palette.toggleGrouping();
            expect(palette.groupByDomain).toBe(false);
        });

        test('should handle utility functions correctly', () => {
            // Test domain extraction
            expect(palette.extractDomain('https://github.com/user/repo')).toBe('github.com');
            expect(palette.extractDomain('invalid-url')).toBe('Unknown');
            
            // Test HTML escaping
            const escaped = palette.escapeHtml('<script>alert("test")</script>');
            expect(escaped).toBe('&lt;script&gt;alert("test")&lt;/script&gt;');
            
            // Test regex escaping
            const regexEscaped = palette.escapeRegex('test.regex*chars+');
            expect(regexEscaped).toBe('test\\.regex\\*chars\\+');
            
            // Test highlighting
            palette.searchQuery = 'test';
            const highlighted = palette.highlightMatch('This is a test string');
            expect(highlighted).toBe('This is a <mark>test</mark> string');
        });
    });

    describe('Error Handling', () => {
        test('should handle missing Chrome APIs', () => {
            const paletteWithoutChrome = new GoFasterCommandPalette({
                chrome: null,
                document: global.document,
                console: { log: () => {}, error: () => {}, warn: () => {} }
            });
            
            expect(paletteWithoutChrome).toBeDefined();
        });

        test('should handle tab loading errors', async () => {
            palette.sendMessage = () => Promise.reject(new Error('Network error'));
            
            try {
                await palette.loadTabs();
                expect(false).toBe(true); // Should not reach here
            } catch (error) {
                expect(error.message).toBe('Network error');
                expect(palette.tabs).toEqual([]);
                expect(palette.isLoading).toBe(false);
            }
        });

        test('should handle empty tabs gracefully', async () => {
            palette.sendMessage = () => Promise.resolve({ tabs: [] });
            
            await palette.loadTabs();
            expect(palette.tabs.length).toBe(0);
            
            const filtered = palette.filterTabs();
            expect(filtered.length).toBe(0);
        });
    });

    describe('Complete User Workflow', () => {
        test('should complete basic tab switching workflow', async () => {
            // 1. Open palette
            const ctrlPEvent = createKeyboardEvent('p', { ctrl: true });
            document.dispatchEvent(ctrlPEvent);
            await sleep(100);
            
            expect(palette.isOpen).toBe(true);
            expect(palette.tabs.length).toBe(4);
            
            // 2. Search for a tab
            palette.searchInput.value = 'Stack';
            const inputEvent = new Event('input', { bubbles: true });
            palette.searchInput.dispatchEvent(inputEvent);
            
            expect(palette.filteredTabs.length).toBe(1);
            expect(palette.filteredTabs[0].title).toContain('Stack Overflow');
            
            // 3. Select the tab
            const enterEvent = createKeyboardEvent('Enter');
            document.dispatchEvent(enterEvent);
            await sleep(50);
            
            expect(palette.isOpen).toBe(false);
            
            // Verify tab was activated
            const stackOverflowTab = mockTabs.find(tab => tab.title.includes('Stack Overflow'));
            expect(stackOverflowTab.active).toBe(true);
        });
    });
});
