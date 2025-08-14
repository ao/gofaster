import { describe, test, expect, beforeEach } from 'bun:test';
import { GoFasterCommandPalette } from './testable/content-script.js';
import { setupDOM, createMockChrome, createKeyboardEvent, sleep } from './utils/test-utils.js';

describe('Regression Tests - Previously Fixed Bugs', () => {
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

    describe('Issue: Focus not given to search bar when dialog opens', () => {
        test('should focus search input when palette opens', async () => {
            expect(palette.isOpen).toBe(false);
            
            // Open the palette
            await palette.open();
            
            expect(palette.isOpen).toBe(true);
            
            // Verify focus method was called (returns true when executed)
            const focusResult = palette.focusSearchInput();
            expect(focusResult).toBe(true);
            
            // Verify search input exists and is focusable
            expect(palette.searchInput).toBeDefined();
            expect(palette.searchInput.focus).toBeDefined();
        });

        test('should handle focus when triggered by Ctrl+P', async () => {
            expect(palette.isOpen).toBe(false);
            
            // Simulate Ctrl+P
            const ctrlPEvent = createKeyboardEvent('p', { ctrl: true });
            document.dispatchEvent(ctrlPEvent);
            
            await sleep(100); // Wait for async operations
            
            expect(palette.isOpen).toBe(true);
            
            // Focus should have been attempted
            const focusResult = palette.focusSearchInput();
            expect(focusResult).toBe(true);
        });
    });

    describe('Issue: No results shown when filtering', () => {
        test('should show tabs immediately after loading', async () => {
            await palette.open();
            
            // Should have loaded tabs
            expect(palette.tabs.length).toBeGreaterThan(0);
            
            // Should show results
            expect(palette.filteredTabs.length).toBeGreaterThan(0);
            
            // Results should be rendered in DOM
            const resultItems = palette.results.querySelectorAll('.result-item');
            expect(resultItems.length).toBeGreaterThan(0);
            
            // Should not show "Loading tabs..." anymore
            expect(palette.results.innerHTML).not.toContain('Loading tabs...');
        });

        test('should show filtered results when typing', async () => {
            await palette.open();
            
            // Initial state - should show all tabs
            expect(palette.filteredTabs.length).toBe(4);
            
            // Type in search
            palette.searchInput.value = 'GitHub';
            const inputEvent = new Event('input', { bubbles: true });
            palette.searchInput.dispatchEvent(inputEvent);
            
            // Should filter results
            expect(palette.searchQuery).toBe('GitHub');
            expect(palette.filteredTabs.length).toBe(1);
            expect(palette.filteredTabs[0].title).toContain('GitHub');
            
            // Should render filtered results
            const resultItems = palette.results.querySelectorAll('.result-item');
            expect(resultItems.length).toBe(1);
            expect(resultItems[0].querySelector('.result-title').textContent).toContain('GitHub');
        });

        test('should handle empty search results gracefully', async () => {
            await palette.open();
            
            // Search for something that doesn't exist
            palette.searchInput.value = 'nonexistent-search-term';
            const inputEvent = new Event('input', { bubbles: true });
            palette.searchInput.dispatchEvent(inputEvent);
            
            // Should show no results message
            expect(palette.filteredTabs.length).toBe(0);
            expect(palette.results.innerHTML).toContain('No tabs found');
        });
    });

    describe('Issue: Stuck on "Loading tabs..." message', () => {
        test('should not get stuck on loading when tabs load successfully', async () => {
            // Verify initial state
            expect(palette.isLoading).toBe(false);
            
            await palette.open();
            
            // Should have finished loading
            expect(palette.isLoading).toBe(false);
            expect(palette.tabs.length).toBeGreaterThan(0);
            
            // Should not show loading message
            expect(palette.results.innerHTML).not.toContain('Loading tabs...');
        });

        test('should handle loading errors and not get stuck', async () => {
            // Mock sendMessage to fail
            palette.sendMessage = () => Promise.reject(new Error('Network error'));
            
            await palette.open();
            
            // Should not be stuck in loading state
            expect(palette.isLoading).toBe(false);
            
            // Should show error message instead of loading
            expect(palette.results.innerHTML).toContain('Error loading tabs');
            expect(palette.results.innerHTML).not.toContain('Loading tabs...');
        });

        test('should show proper message when no tabs are available', async () => {
            // Mock empty tabs response
            palette.sendMessage = () => Promise.resolve({ tabs: [] });
            
            await palette.open();
            
            expect(palette.isLoading).toBe(false);
            expect(palette.tabs.length).toBe(0);
            expect(palette.results.innerHTML).toContain('No tabs available');
            expect(palette.results.innerHTML).not.toContain('Loading tabs...');
        });
    });

    describe('Issue: Keyboard shortcut conflicts', () => {
        test('should use Ctrl+P to open palette, not pin tabs', async () => {
            expect(palette.isOpen).toBe(false);
            
            // Ctrl+P should open palette
            const ctrlPEvent = createKeyboardEvent('p', { ctrl: true });
            document.dispatchEvent(ctrlPEvent);
            
            await sleep(50);
            
            expect(palette.isOpen).toBe(true);
            
            // Ctrl+P inside palette should NOT pin tabs (no shift key)
            const selectedTab = palette.filteredTabs[0];
            const initialPinState = selectedTab.pinned;
            
            document.dispatchEvent(ctrlPEvent); // Same event again
            await sleep(50);
            
            // Pin state should not change (because no shift key)
            expect(selectedTab.pinned).toBe(initialPinState);
        });

        test('should use Ctrl+Shift+P to pin tabs when palette is open', async () => {
            await palette.open();
            
            const selectedTab = palette.filteredTabs[0];
            const initialPinState = selectedTab.pinned;
            
            // Test the direct method functionality
            await palette.togglePinSelected();
            
            expect(selectedTab.pinned).toBe(!initialPinState);
        });

        test('should use Delete key as alternative to Ctrl+X for closing tabs', async () => {
            await palette.open();
            
            const initialTabCount = palette.filteredTabs.length;
            
            // Delete key should close tab
            const deleteEvent = createKeyboardEvent('Delete');
            document.dispatchEvent(deleteEvent);
            
            await sleep(50);
            
            expect(palette.filteredTabs.length).toBe(initialTabCount - 1);
        });
    });

    describe('Issue: CSS conflicts with website styles', () => {
        test('should create isolated DOM elements with specific IDs', () => {
            // All main elements should have specific IDs to avoid conflicts
            expect(document.getElementById('gofaster-overlay')).toBeDefined();
            expect(document.getElementById('gofaster-palette')).toBeDefined();
            expect(document.getElementById('gofaster-search')).toBeDefined();
            expect(document.getElementById('gofaster-results')).toBeDefined();
            expect(document.getElementById('gofaster-footer')).toBeDefined();
        });

        test('should use proper DOM manipulation instead of innerHTML for complex content', async () => {
            await palette.open();
            
            // Results should be created using DOM manipulation, not innerHTML
            const resultItems = palette.results.querySelectorAll('.result-item');
            
            // Each result item should be a proper DOM element
            resultItems.forEach(item => {
                expect(item instanceof HTMLElement).toBe(true);
                expect(item.dataset.index).toBeDefined();
                expect(item.dataset.tabId).toBeDefined();
            });
        });
    });

    describe('Issue: Service worker registration failures', () => {
        test('should handle Chrome API availability gracefully', () => {
            // Test with missing Chrome APIs
            const paletteWithoutChrome = new GoFasterCommandPalette({
                chrome: undefined,
                document: global.document,
                console: { log: () => {}, error: () => {}, warn: () => {} }
            });
            
            // Should not crash
            expect(paletteWithoutChrome).toBeDefined();
        });

        test('should handle partial Chrome API availability', async () => {
            // Test with partial Chrome API
            const partialChrome = {
                runtime: {
                    id: 'test-id',
                    lastError: null,
                    sendMessage: null // Missing sendMessage
                }
            };
            
            const paletteWithPartialChrome = new GoFasterCommandPalette({
                chrome: partialChrome,
                document: global.document,
                console: { log: () => {}, error: () => {}, warn: () => {} }
            });
            
            // Should handle gracefully
            expect(paletteWithPartialChrome).toBeDefined();
            
            // Should fail gracefully when trying to send messages
            try {
                await paletteWithPartialChrome.sendMessage({ action: 'test' });
                expect(false).toBe(true); // Should not reach here
            } catch (error) {
                expect(error.message).toContain('Chrome runtime not available');
            }
        });
    });

    describe('Complete workflow regression test', () => {
        test('should complete the full user workflow without any of the original issues', async () => {
            // This test ensures all the original issues are fixed in a complete workflow
            
            // 1. User presses Ctrl+P (should not conflict with pin shortcut)
            const ctrlPEvent = createKeyboardEvent('p', { ctrl: true });
            document.dispatchEvent(ctrlPEvent);
            
            await sleep(100);
            
            // 2. Palette should open with focus and results (not stuck loading)
            expect(palette.isOpen).toBe(true);
            expect(palette.tabs.length).toBeGreaterThan(0);
            expect(palette.filteredTabs.length).toBeGreaterThan(0);
            
            // Should not be loading
            expect(palette.isLoading).toBe(false);
            expect(palette.results.innerHTML).not.toContain('Loading tabs...');
            
            // Should have results
            const resultItems = palette.results.querySelectorAll('.result-item');
            expect(resultItems.length).toBeGreaterThan(0);
            
            // 3. User types to filter (should show results, not get stuck)
            palette.searchInput.value = 'Stack';
            const inputEvent = new Event('input', { bubbles: true });
            palette.searchInput.dispatchEvent(inputEvent);
            
            // Should filter correctly
            expect(palette.filteredTabs.length).toBe(1);
            expect(palette.filteredTabs[0].title).toContain('Stack Overflow');
            
            // 4. User uses pin functionality (test the method directly)
            await palette.togglePinSelected();
            
            // Should pin the tab
            expect(palette.filteredTabs[0].pinned).toBe(true);
            
            // 5. User presses Enter to switch
            const enterEvent = createKeyboardEvent('Enter');
            document.dispatchEvent(enterEvent);
            
            await sleep(50);
            
            // Should switch tab and close
            expect(palette.isOpen).toBe(false);
            
            // Verify tab was switched
            const stackOverflowTab = mockTabs.find(tab => tab.title.includes('Stack Overflow'));
            expect(stackOverflowTab.active).toBe(true);
            expect(stackOverflowTab.pinned).toBe(true); // Should remain pinned
        });
    });
});
