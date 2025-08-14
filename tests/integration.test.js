import { describe, test, expect, beforeEach } from 'bun:test';
import { GoFasterCommandPalette } from './testable/content-script.js';
import { setupDOM, createMockChrome, createKeyboardEvent, sleep } from './utils/test-utils.js';

describe('GoFaster Integration Tests', () => {
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

    describe('Complete User Workflows', () => {
        test('should complete full tab switching workflow', async () => {
            // 1. User presses Ctrl+P
            expect(palette.isOpen).toBe(false);
            
            const ctrlPEvent = createKeyboardEvent('p', { ctrl: true });
            document.dispatchEvent(ctrlPEvent);
            
            await sleep(100); // Wait for async operations
            
            // 2. Palette should open and load tabs
            expect(palette.isOpen).toBe(true);
            expect(palette.tabs.length).toBe(4);
            expect(palette.filteredTabs.length).toBe(4);
            
            // 3. User types search query
            palette.searchInput.value = 'Stack';
            const inputEvent = new Event('input', { bubbles: true });
            palette.searchInput.dispatchEvent(inputEvent);
            
            // 4. Results should be filtered
            expect(palette.searchQuery).toBe('Stack');
            expect(palette.filteredTabs.length).toBe(1);
            expect(palette.filteredTabs[0].title).toContain('Stack Overflow');
            
            // 5. User presses Enter to select
            const enterEvent = createKeyboardEvent('Enter');
            document.dispatchEvent(enterEvent);
            
            await sleep(50);
            
            // 6. Should switch to selected tab and close palette
            expect(palette.isOpen).toBe(false);
            
            // Verify the tab was activated in mock
            const stackOverflowTab = mockTabs.find(tab => tab.title.includes('Stack Overflow'));
            expect(stackOverflowTab.active).toBe(true);
        });

        test('should handle complete pin workflow', async () => {
            // Open palette and load tabs
            await palette.open();
            expect(palette.tabs.length).toBe(4);
            
            // Navigate to a non-pinned tab
            const unpinnedTab = palette.filteredTabs.find(tab => !tab.pinned);
            const unpinnedIndex = palette.filteredTabs.indexOf(unpinnedTab);
            palette.selectedIndex = unpinnedIndex;
            
            expect(unpinnedTab.pinned).toBe(false);
            
            // Pin the tab using direct method call (more reliable than keyboard events in tests)
            await palette.togglePinSelected();
            
            // Should be pinned now
            expect(unpinnedTab.pinned).toBe(true);
            
            // Unpin it
            await palette.togglePinSelected();
            
            expect(unpinnedTab.pinned).toBe(false);
        });

        test('should handle complete mute workflow', async () => {
            await palette.open();
            
            // Select a tab
            palette.selectedIndex = 0;
            const selectedTab = palette.filteredTabs[0];
            const initialMuteState = selectedTab.mutedInfo?.muted || false;
            
            // Mute the tab using direct method call
            await palette.toggleMuteSelected();
            
            expect(selectedTab.mutedInfo.muted).toBe(!initialMuteState);
        });

        test('should handle complete close workflow', async () => {
            await palette.open();
            
            const initialTabCount = palette.filteredTabs.length;
            palette.selectedIndex = 1; // Select second tab
            
            // Close the tab
            const deleteEvent = createKeyboardEvent('Delete');
            document.dispatchEvent(deleteEvent);
            
            await sleep(50);
            
            // Should have one less tab
            expect(palette.filteredTabs.length).toBe(initialTabCount - 1);
            expect(palette.tabs.length).toBe(initialTabCount - 1);
        });

        test('should handle navigation with arrow keys', async () => {
            await palette.open();
            expect(palette.selectedIndex).toBe(0);
            
            // Navigate down
            const downEvent = createKeyboardEvent('ArrowDown');
            document.dispatchEvent(downEvent);
            expect(palette.selectedIndex).toBe(1);
            
            document.dispatchEvent(downEvent);
            expect(palette.selectedIndex).toBe(2);
            
            // Navigate up
            const upEvent = createKeyboardEvent('ArrowUp');
            document.dispatchEvent(upEvent);
            expect(palette.selectedIndex).toBe(1);
            
            // Execute selection
            const enterEvent = createKeyboardEvent('Enter');
            document.dispatchEvent(enterEvent);
            
            await sleep(50);
            
            // Should have switched to the second tab (index 1)
            expect(mockTabs[1].active).toBe(true);
            expect(palette.isOpen).toBe(false);
        });

        test('should handle search and clear workflow', async () => {
            await palette.open();
            
            // Initial state - all tabs visible
            expect(palette.filteredTabs.length).toBe(4);
            
            // Search for specific tab
            palette.searchInput.value = 'YouTube';
            let inputEvent = new Event('input', { bubbles: true });
            palette.searchInput.dispatchEvent(inputEvent);
            
            expect(palette.filteredTabs.length).toBe(1);
            expect(palette.filteredTabs[0].title).toContain('YouTube');
            
            // Clear search
            palette.searchInput.value = '';
            inputEvent = new Event('input', { bubbles: true });
            palette.searchInput.dispatchEvent(inputEvent);
            
            // Should show all tabs again
            expect(palette.filteredTabs.length).toBe(4);
        });

        test('should handle escape to close', async () => {
            await palette.open();
            expect(palette.isOpen).toBe(true);
            
            const escapeEvent = createKeyboardEvent('Escape');
            document.dispatchEvent(escapeEvent);
            
            expect(palette.isOpen).toBe(false);
        });

        test('should handle click outside to close', async () => {
            await palette.open();
            expect(palette.isOpen).toBe(true);
            
            // Click on overlay (outside palette)
            const clickEvent = new Event('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: palette.overlay });
            palette.overlay.dispatchEvent(clickEvent);
            
            expect(palette.isOpen).toBe(false);
        });

        test('should handle result item clicks', async () => {
            await palette.open();
            
            // Create a result item and simulate click
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            resultItem.dataset.index = '2';
            resultItem.dataset.tabId = '3';
            palette.results.appendChild(resultItem);
            
            const clickEvent = new Event('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: resultItem });
            palette.results.dispatchEvent(clickEvent);
            
            await sleep(50);
            
            // Should have switched to the clicked tab
            expect(mockTabs[2].active).toBe(true);
            expect(palette.isOpen).toBe(false);
        });
    });

    describe('Error Handling Workflows', () => {
        test('should handle tab loading failure gracefully', async () => {
            // Mock sendMessage to fail
            palette.sendMessage = () => Promise.reject(new Error('Network error'));
            
            await palette.open();
            
            // Should still open but show error state
            expect(palette.isOpen).toBe(true);
            expect(palette.tabs.length).toBe(0);
            expect(palette.results.innerHTML).toContain('Error loading tabs');
        });

        test('should handle tab switching failure', async () => {
            await palette.open();
            
            // Mock sendMessage to fail for switchToTab
            const originalSendMessage = palette.sendMessage;
            palette.sendMessage = (message) => {
                if (message.action === 'switchToTab') {
                    return Promise.reject(new Error('Switch failed'));
                }
                return originalSendMessage.call(palette, message);
            };
            
            const result = await palette.executeSelected();
            expect(result).toBe(false);
            
            // Palette should remain open on error
            expect(palette.isOpen).toBe(true);
        });

        test('should handle missing Chrome APIs', () => {
            const paletteWithoutChrome = new GoFasterCommandPalette({
                chrome: null,
                document: global.document,
                console: { log: () => {}, error: () => {}, warn: () => {} }
            });
            
            expect(paletteWithoutChrome).toBeDefined();
            // Should not crash, but functionality will be limited
        });
    });

    describe('Performance and Edge Cases', () => {
        test('should handle rapid key presses', async () => {
            // Rapidly toggle palette
            for (let i = 0; i < 5; i++) {
                const event = createKeyboardEvent('p', { ctrl: true });
                document.dispatchEvent(event);
                await sleep(10);
            }
            
            // Should end up in a consistent state
            expect(typeof palette.isOpen).toBe('boolean');
        });

        test('should handle large number of tabs', async () => {
            // Add many more tabs to mock
            const largeMockTabs = [];
            for (let i = 0; i < 100; i++) {
                largeMockTabs.push({
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
            
            // Mock the response to return large tab set
            palette.sendMessage = () => Promise.resolve({ tabs: largeMockTabs });
            
            await palette.loadTabs();
            expect(palette.tabs.length).toBe(100);
            
            // Should still filter correctly and limit results
            palette.searchQuery = '';
            const filtered = palette.filterTabs();
            expect(filtered.length).toBe(10); // Should limit to 10
        });

        test('should handle special characters in search', async () => {
            await palette.open();
            
            // Test various special characters
            const specialQueries = ['test.com', 'test+query', 'test[brackets]', 'test(parens)'];
            
            for (const query of specialQueries) {
                palette.searchInput.value = query;
                const inputEvent = new Event('input', { bubbles: true });
                palette.searchInput.dispatchEvent(inputEvent);
                
                // Should not crash
                expect(palette.searchQuery).toBe(query);
                expect(Array.isArray(palette.filteredTabs)).toBe(true);
            }
        });

        test('should handle empty or malformed tab data', async () => {
            // Mock response with malformed data
            palette.sendMessage = () => Promise.resolve({ 
                tabs: [
                    { id: 1, title: null, url: null, mutedInfo: { muted: false } },
                    { id: 2, mutedInfo: { muted: false } }, // Missing properties
                    null, // Null tab
                    { id: 3, title: 'Valid Tab', url: 'https://example.com', mutedInfo: { muted: false } }
                ]
            });
            
            await palette.loadTabs();
            
            // Should handle gracefully
            expect(palette.tabs.length).toBe(4);
            palette.updateResults();
            
            // Should not crash when rendering
            expect(palette.results.innerHTML).toBeDefined();
        });
    });
});
