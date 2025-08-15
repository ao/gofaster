// Content Search Tests - Test the new content search functionality

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { GoFasterCommandPalette } from './testable/content-script.js';
import { setupDOM, createMockChrome, createKeyboardEvent, sleep } from './utils/test-utils.js';

describe('Content Search Functionality', () => {
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

    afterEach(() => {
        if (palette && palette.overlay && palette.overlay.parentNode) {
            palette.overlay.parentNode.removeChild(palette.overlay);
        }
    });

    describe('Search Mode Detection', () => {
        test('should use tab search for short queries', () => {
            palette.searchQuery = 'test';
            palette.searchInput.value = 'test';
            
            // Trigger input event
            const event = new Event('input');
            palette.searchInput.dispatchEvent(event);
            
            expect(palette.searchMode).toBe('tabs');
        });

        test('should use content search for longer queries with spaces', () => {
            palette.searchQuery = 'error handling code';
            palette.searchInput.value = 'error handling code';
            
            // Trigger input event
            const event = new Event('input');
            palette.searchInput.dispatchEvent(event);
            
            expect(palette.searchMode).toBe('content');
        });

        test('should use tab search for single words even if long', () => {
            palette.searchQuery = 'verylongsinglewordinput';
            palette.searchInput.value = 'verylongsinglewordinput';
            
            // Trigger input event
            const event = new Event('input');
            palette.searchInput.dispatchEvent(event);
            
            expect(palette.searchMode).toBe('tabs');
        });
    });

    describe('Content Search API', () => {
        test('should send searchContent message to background script', async () => {
            const query = 'test content search';
            palette.searchQuery = query;
            
            // Mock the response
            let capturedMessage = null;
            mockChrome.runtime.sendMessage = (message, callback) => {
                capturedMessage = message;
                if (message.action === 'searchContent') {
                    callback({
                        success: true,
                        results: [
                            {
                                tab: { id: 1, title: 'Test Page', url: 'https://example.com' },
                                matches: [
                                    {
                                        context: 'This is a test content search example',
                                        matchIndex: 10
                                    }
                                ],
                                totalMatches: 1
                            }
                        ]
                    });
                }
            };
            
            await palette.performContentSearch();
            
            expect(capturedMessage).toBeDefined();
            expect(capturedMessage.action).toBe('searchContent');
            expect(capturedMessage.query).toBe(query);
        });

        test('should handle content search errors gracefully', async () => {
            palette.searchQuery = 'test error';
            
            // Mock error response
            mockChrome.runtime.sendMessage = (message, callback) => {
                if (message.action === 'searchContent') {
                    callback({
                        success: false,
                        error: 'Search failed'
                    });
                }
            };
            
            await palette.performContentSearch();
            
            expect(palette.contentResults).toEqual([]);
            expect(palette.isLoading).toBe(false);
        });
    });

    describe('Content Results Rendering', () => {
        beforeEach(() => {
            palette.searchMode = 'content';
            palette.contentResults = [
                {
                    tab: { id: 1, title: 'Test Page 1', url: 'https://example.com/page1' },
                    matches: [
                        {
                            context: 'This is a test content with search terms',
                            matchIndex: 15
                        }
                    ],
                    totalMatches: 2
                },
                {
                    tab: { id: 2, title: 'Test Page 2', url: 'https://example.com/page2' },
                    matches: [
                        {
                            context: 'Another example of search content here',
                            matchIndex: 20
                        }
                    ],
                    totalMatches: 1
                }
            ];
        });

        test('should render content search results', () => {
            palette.renderResults();
            
            const resultItems = palette.results.querySelectorAll('.result-item.content-result');
            expect(resultItems.length).toBe(2);
        });

        test('should show match count in content results', () => {
            palette.renderResults();
            
            const matchCounts = palette.results.querySelectorAll('.match-count');
            expect(matchCounts.length).toBe(2);
            expect(matchCounts[0].textContent).toBe('(2 matches)');
            expect(matchCounts[1].textContent).toBe('(1 matches)');
        });

        test('should show content preview with context', () => {
            palette.renderResults();
            
            const previews = palette.results.querySelectorAll('.content-preview');
            expect(previews.length).toBe(2);
            expect(previews[0].textContent).toContain('This is a test content');
            expect(previews[1].textContent).toContain('Another example of search');
        });

        test('should show content indicator icon', () => {
            palette.renderResults();
            
            const indicators = palette.results.querySelectorAll('.content-indicator');
            expect(indicators.length).toBe(2);
            expect(indicators[0].textContent).toBe('📄');
        });
    });

    describe('Content Search Navigation', () => {
        beforeEach(() => {
            palette.searchMode = 'content';
            palette.contentResults = [
                {
                    tab: { id: 1, title: 'Page 1', url: 'https://example.com/1' },
                    matches: [{ context: 'test content', matchIndex: 0 }],
                    totalMatches: 1
                },
                {
                    tab: { id: 2, title: 'Page 2', url: 'https://example.com/2' },
                    matches: [{ context: 'more content', matchIndex: 0 }],
                    totalMatches: 1
                }
            ];
            palette.selectedIndex = 0;
        });

        test('should navigate through content results', () => {
            palette.selectNext();
            expect(palette.selectedIndex).toBe(1);
            
            palette.selectNext();
            expect(palette.selectedIndex).toBe(1); // Should not exceed bounds
            
            palette.selectPrevious();
            expect(palette.selectedIndex).toBe(0);
        });

        test('should execute selected content result', async () => {
            let capturedMessage = null;
            mockChrome.runtime.sendMessage = (message, callback) => {
                capturedMessage = message;
                if (message.action === 'switchToTab') {
                    callback({ success: true });
                }
            };
            
            const result = await palette.executeSelected();
            
            expect(result).toBe(true);
            expect(capturedMessage.action).toBe('switchToTab');
            expect(capturedMessage.tabId).toBe(1);
        });
    });

    describe('Mixed Search Results', () => {
        test('should clear content results when switching to tab search', () => {
            // Start with content results
            palette.searchMode = 'content';
            palette.contentResults = [
                {
                    tab: { id: 1, title: 'Page 1', url: 'https://example.com' },
                    matches: [{ context: 'test', matchIndex: 0 }],
                    totalMatches: 1
                }
            ];
            
            // Switch to tab search
            palette.searchMode = 'tabs';
            palette.performTabSearch();
            
            expect(palette.contentResults).toEqual([]);
        });

        test('should clear tab results when switching to content search', async () => {
            // Start with tab results
            palette.searchMode = 'tabs';
            palette.filteredTabs = [{ id: 1, title: 'Test Tab', url: 'https://example.com' }];
            
            // Mock content search
            mockChrome.runtime.sendMessage = (message, callback) => {
                if (message.action === 'searchContent') {
                    callback({
                        success: true,
                        results: []
                    });
                }
            };
            
            // Switch to content search
            palette.searchMode = 'content';
            palette.searchQuery = 'test search';
            await palette.performContentSearch();
            
            expect(palette.filteredTabs).toEqual([]);
        });
    });

    describe('Error Handling', () => {
        test('should handle chrome.runtime.sendMessage errors', async () => {
            palette.searchQuery = 'test search';
            
            // Mock sendMessage to throw error
            mockChrome.runtime.sendMessage = () => {
                throw new Error('Runtime error');
            };
            
            await palette.performContentSearch();
            
            expect(palette.contentResults).toEqual([]);
            expect(palette.isLoading).toBe(false);
        });

        test('should handle empty search results', async () => {
            palette.searchQuery = 'nonexistent content';
            palette.searchMode = 'content';
            palette.tabs = mockTabs; // Ensure tabs are loaded
            
            mockChrome.runtime.sendMessage = (message, callback) => {
                if (message.action === 'searchContent') {
                    callback({
                        success: true,
                        results: []
                    });
                }
            };
            
            await palette.performContentSearch();
            
            expect(palette.contentResults).toEqual([]);
            palette.renderResults();
            
            const noResults = palette.results.querySelector('.no-results');
            expect(noResults).toBeTruthy();
            expect(noResults.textContent).toBe('No content matches found');
        });
    });

    describe('Performance Considerations', () => {
        test('should only trigger content search for queries >= 3 characters', async () => {
            // Short query should not trigger content search
            palette.searchQuery = 'ab';
            palette.searchMode = 'content';
            
            let searchCalled = false;
            mockChrome.runtime.sendMessage = () => {
                searchCalled = true;
            };
            
            await palette.updateResults();
            
            expect(searchCalled).toBe(false);
        });

        test('should show loading state during content search', async () => {
            palette.searchQuery = 'test content search';
            palette.searchMode = 'content';
            
            // Mock slow response
            let resolveCallback;
            mockChrome.runtime.sendMessage = (message, callback) => {
                resolveCallback = () => callback({ success: true, results: [] });
            };
            
            const searchPromise = palette.performContentSearch();
            
            // Check loading state
            expect(palette.isLoading).toBe(true);
            
            // Resolve the mock
            if (resolveCallback) resolveCallback();
            await searchPromise;
            
            expect(palette.isLoading).toBe(false);
        });
    });
});

// Integration test for full content search workflow
describe('Content Search Integration', () => {
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

    afterEach(() => {
        if (palette && palette.overlay && palette.overlay.parentNode) {
            palette.overlay.parentNode.removeChild(palette.overlay);
        }
    });

    test('should perform complete content search workflow', async () => {
        // Mock background script response
        mockChrome.runtime.sendMessage = (message, callback) => {
            if (message.action === 'getTabs') {
                callback({ tabs: mockTabs });
            } else if (message.action === 'searchContent') {
                callback({
                    success: true,
                    results: [
                        {
                            tab: { id: 1, title: 'Documentation Page', url: 'https://docs.example.com' },
                            matches: [
                                {
                                    context: 'This function handles error cases gracefully',
                                    matchIndex: 18
                                }
                            ],
                            totalMatches: 3
                        }
                    ]
                });
            }
        };

        // Open palette
        await palette.open();
        
        // Type content search query
        palette.searchInput.value = 'error handling';
        palette.searchQuery = 'error handling';
        const inputEvent = new Event('input');
        palette.searchInput.dispatchEvent(inputEvent);
        
        // Wait for search to complete
        await sleep(100);
        
        // Verify results
        expect(palette.searchMode).toBe('content');
        expect(palette.contentResults.length).toBe(1);
        
        // Verify rendering
        const contentResults = palette.results.querySelectorAll('.result-item.content-result');
        expect(contentResults.length).toBe(1);
        
        // Verify content
        const preview = palette.results.querySelector('.content-preview');
        expect(preview.textContent).toContain('error cases gracefully');
        
        const matchCount = palette.results.querySelector('.match-count');
        expect(matchCount.textContent).toBe('(3 matches)');
    });
});
