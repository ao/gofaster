import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { GoFasterCommandPalette } from './testable/content-script.js';
import { setupDOM, createMockChrome, createKeyboardEvent, sleep } from './utils/test-utils.js';

describe('GoFasterCommandPalette', () => {
    let dom, mockChrome, mockTabs, palette, mockConsole;

    beforeEach(() => {
        // Setup DOM environment
        dom = setupDOM();
        
        // Setup Chrome API mocks
        const chromeSetup = createMockChrome();
        mockChrome = chromeSetup.mockChrome;
        mockTabs = chromeSetup.mockTabs;
        
        // Mock console to capture logs
        mockConsole = {
            log: () => {},
            error: () => {},
            warn: () => {}
        };
        
        // Create palette instance with mocked dependencies
        palette = new GoFasterCommandPalette({
            chrome: mockChrome,
            document: global.document,
            console: mockConsole
        });
    });

    afterEach(() => {
        // Clean up
        if (palette && palette.overlay) {
            palette.overlay.remove();
        }
    });

    describe('Initialization', () => {
        test('should create palette instance', () => {
            expect(palette).toBeDefined();
            expect(palette.isOpen).toBe(false);
            expect(palette.tabs).toEqual([]);
            expect(palette.filteredTabs).toEqual([]);
            expect(palette.selectedIndex).toBe(0);
            expect(palette.searchQuery).toBe('');
        });

        test('should create DOM elements', () => {
            const overlay = document.getElementById('gofaster-overlay');
            const searchInput = document.getElementById('gofaster-search');
            const results = document.getElementById('gofaster-results');
            const footer = document.getElementById('gofaster-footer');

            expect(overlay).toBeDefined();
            expect(searchInput).toBeDefined();
            expect(results).toBeDefined();
            expect(footer).toBeDefined();
            
            expect(overlay.classList.contains('gofaster-hidden')).toBe(true);
            expect(searchInput.placeholder).toBe('Search tabs, commands, or content...');
        });

        test('should test connection to background script', async () => {
            const connectionResult = await palette.testConnection();
            expect(connectionResult).toBe(true);
        });
    });

    describe('Message Passing', () => {
        test('should send message to background script', async () => {
            const response = await palette.sendMessage({ action: 'getTabs' });
            expect(response).toBeDefined();
            expect(response.tabs).toBeDefined();
            expect(Array.isArray(response.tabs)).toBe(true);
        });

        test('should handle message errors', async () => {
            // Mock error condition
            mockChrome.runtime.lastError = { message: 'Test error' };
            
            try {
                await palette.sendMessage({ action: 'getTabs' });
                expect(false).toBe(true); // Should not reach here
            } catch (error) {
                expect(error.message).toBe('Test error');
            }
            
            // Reset error
            mockChrome.runtime.lastError = null;
        });
    });

    describe('Tab Loading', () => {
        test('should load tabs from background script', async () => {
            await palette.loadTabs();
            
            expect(palette.tabs).toBeDefined();
            expect(palette.tabs.length).toBe(4); // From mock data
            expect(palette.isLoading).toBe(false);
        });

        test('should handle tab loading errors', async () => {
            // Mock error in sendMessage
            const originalSendMessage = palette.sendMessage;
            palette.sendMessage = () => Promise.reject(new Error('Network error'));
            
            try {
                await palette.loadTabs();
                expect(false).toBe(true); // Should not reach here
            } catch (error) {
                expect(error.message).toBe('Network error');
                expect(palette.tabs).toEqual([]);
                expect(palette.isLoading).toBe(false);
            }
            
            // Restore original method
            palette.sendMessage = originalSendMessage;
        });
    });

    describe('Palette Opening and Closing', () => {
        test('should open palette', async () => {
            expect(palette.isOpen).toBe(false);
            
            await palette.open();
            
            expect(palette.isOpen).toBe(true);
            expect(palette.overlay.classList.contains('gofaster-hidden')).toBe(false);
            expect(palette.searchInput.value).toBe('');
            expect(palette.searchQuery).toBe('');
            expect(palette.selectedIndex).toBe(0);
        });

        test('should close palette', () => {
            palette.isOpen = true;
            palette.overlay.classList.remove('gofaster-hidden');
            
            palette.close();
            
            expect(palette.isOpen).toBe(false);
            expect(palette.overlay.classList.contains('gofaster-hidden')).toBe(true);
        });

        test('should toggle palette', async () => {
            expect(palette.isOpen).toBe(false);
            
            await palette.toggle();
            expect(palette.isOpen).toBe(true);
            
            await palette.toggle();
            expect(palette.isOpen).toBe(false);
        });
    });

    describe('Focus Management', () => {
        test('should attempt to focus search input', () => {
            const focusResult = palette.focusSearchInput();
            expect(focusResult).toBe(true);
        });

        test('should handle missing search input', () => {
            palette.searchInput = null;
            const focusResult = palette.focusSearchInput();
            expect(focusResult).toBe(false);
        });
    });

    describe('Tab Filtering', () => {
        beforeEach(async () => {
            await palette.loadTabs();
        });

        test('should show all tabs when no search query', () => {
            palette.searchQuery = '';
            const filtered = palette.filterTabs();
            
            expect(filtered.length).toBe(4); // All mock tabs
        });

        test('should filter tabs by title', () => {
            palette.searchQuery = 'GitHub';
            const filtered = palette.filterTabs();
            
            expect(filtered.length).toBe(1);
            expect(filtered[0].title).toContain('GitHub');
        });

        test('should filter tabs by URL', () => {
            palette.searchQuery = 'stackoverflow';
            const filtered = palette.filterTabs();
            
            expect(filtered.length).toBe(1);
            expect(filtered[0].url).toContain('stackoverflow.com');
        });

        test('should filter tabs by domain', () => {
            palette.searchQuery = 'google';
            const filtered = palette.filterTabs();
            
            expect(filtered.length).toBe(1);
            expect(filtered[0].url).toContain('google.com');
        });

        test('should return empty array when no tabs match', () => {
            palette.searchQuery = 'nonexistent';
            const filtered = palette.filterTabs();
            
            expect(filtered.length).toBe(0);
        });

        test('should handle empty tabs array', () => {
            palette.tabs = [];
            palette.searchQuery = 'test';
            const filtered = palette.filterTabs();
            
            expect(filtered.length).toBe(0);
        });
    });

    describe('Tab Actions', () => {
        beforeEach(async () => {
            await palette.loadTabs();
            palette.updateResults();
        });

        test('should execute selected tab', async () => {
            palette.selectedIndex = 1; // Select second tab
            
            const result = await palette.executeSelected();
            
            expect(result).toBe(true);
            expect(palette.isOpen).toBe(false); // Should close after execution
        });

        test('should toggle pin selected tab', async () => {
            palette.selectedIndex = 0; // Select first tab (not pinned)
            const selectedTab = palette.filteredTabs[0];
            const initialPinState = selectedTab.pinned;
            
            // Call the method directly to test the functionality
            await palette.togglePinSelected();
            
            expect(selectedTab.pinned).toBe(!initialPinState);
        });

        test('should toggle mute selected tab', async () => {
            palette.selectedIndex = 0; // Select first tab
            const selectedTab = palette.filteredTabs[0];
            const initialMuteState = selectedTab.mutedInfo?.muted || false;
            
            // Call the method directly to test the functionality
            await palette.toggleMuteSelected();
            
            expect(selectedTab.mutedInfo.muted).toBe(!initialMuteState);
        });

        test('should close selected tab', async () => {
            palette.selectedIndex = 1; // Select second tab
            const initialTabCount = palette.filteredTabs.length;
            
            await palette.closeSelected();
            
            expect(palette.filteredTabs.length).toBe(initialTabCount - 1);
        });
    });

    describe('Keyboard Events', () => {
        test('should handle Ctrl+P to toggle palette', async () => {
            expect(palette.isOpen).toBe(false);
            
            const event = createKeyboardEvent('p', { ctrl: true });
            document.dispatchEvent(event);
            
            await sleep(50);
            
            expect(palette.isOpen).toBe(true);
        });

        test('should handle Escape to close palette', () => {
            palette.isOpen = true;
            palette.overlay.classList.remove('gofaster-hidden');
            
            const event = createKeyboardEvent('Escape');
            document.dispatchEvent(event);
            
            expect(palette.isOpen).toBe(false);
        });

        test('should handle arrow keys for navigation', async () => {
            await palette.open();
            await palette.loadTabs();
            palette.updateResults();
            
            expect(palette.selectedIndex).toBe(0);
            
            // Arrow down
            const downEvent = createKeyboardEvent('ArrowDown');
            document.dispatchEvent(downEvent);
            expect(palette.selectedIndex).toBe(1);
            
            // Arrow up
            const upEvent = createKeyboardEvent('ArrowUp');
            document.dispatchEvent(upEvent);
            expect(palette.selectedIndex).toBe(0);
        });

        test('should handle Ctrl+Shift+P for pin toggle', async () => {
            await palette.open();
            await palette.loadTabs();
            palette.updateResults();
            
            const selectedTab = palette.filteredTabs[0];
            const initialPinState = selectedTab.pinned;
            
            // Ensure palette is open and has focus context
            expect(palette.isOpen).toBe(true);
            
            const event = createKeyboardEvent('p', { ctrl: true, shift: true });
            document.dispatchEvent(event);
            
            await sleep(100); // Longer wait for async operations
            
            expect(selectedTab.pinned).toBe(!initialPinState);
        });

        test('should handle Ctrl+M for mute toggle', async () => {
            await palette.open();
            await palette.loadTabs();
            palette.updateResults();
            
            const selectedTab = palette.filteredTabs[0];
            const initialMuteState = selectedTab.mutedInfo?.muted || false;
            
            // Ensure palette is open and has focus context
            expect(palette.isOpen).toBe(true);
            
            const event = createKeyboardEvent('m', { ctrl: true });
            document.dispatchEvent(event);
            
            await sleep(100); // Longer wait for async operations
            
            expect(selectedTab.mutedInfo.muted).toBe(!initialMuteState);
        });

        test('should handle Delete for close tab', async () => {
            await palette.open();
            await palette.loadTabs();
            palette.updateResults();
            
            const initialTabCount = palette.filteredTabs.length;
            
            const event = createKeyboardEvent('Delete');
            document.dispatchEvent(event);
            
            await sleep(50);
            
            expect(palette.filteredTabs.length).toBe(initialTabCount - 1);
        });
    });

    describe('Search Input', () => {
        test('should update search query on input', async () => {
            await palette.open();
            
            palette.searchInput.value = 'test query';
            const inputEvent = new Event('input', { bubbles: true });
            palette.searchInput.dispatchEvent(inputEvent);
            
            expect(palette.searchQuery).toBe('test query');
        });

        test('should update results when search query changes', async () => {
            await palette.loadTabs();
            await palette.open();
            
            // Initial state - should show all tabs
            expect(palette.filteredTabs.length).toBe(4);
            
            // Change search query
            palette.searchInput.value = 'GitHub';
            const inputEvent = new Event('input', { bubbles: true });
            palette.searchInput.dispatchEvent(inputEvent);
            
            // Should filter to only GitHub tab
            expect(palette.filteredTabs.length).toBe(1);
            expect(palette.filteredTabs[0].title).toContain('GitHub');
        });
    });

    describe('Utility Functions', () => {
        test('should extract domain from URL', () => {
            expect(palette.extractDomain('https://github.com/user/repo')).toBe('github.com');
            expect(palette.extractDomain('http://localhost:3000')).toBe('localhost');
            expect(palette.extractDomain('invalid-url')).toBe('Unknown');
        });

        test('should escape HTML', () => {
            const escaped = palette.escapeHtml('<script>alert("xss")</script>');
            expect(escaped).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
        });

        test('should escape regex characters', () => {
            const escaped = palette.escapeRegex('test.regex*chars+');
            expect(escaped).toBe('test\\.regex\\*chars\\+');
        });

        test('should highlight matches in text', () => {
            palette.searchQuery = 'test';
            const highlighted = palette.highlightMatch('This is a test string');
            expect(highlighted).toBe('This is a <mark>test</mark> string');
        });
    });
});
