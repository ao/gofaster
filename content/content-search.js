// Content search script - injected into tabs to search their text content

function searchPageContent(query) {
    if (!query || query.length < 2) {
        return { matches: [], totalMatches: 0 };
    }
    
    const searchQuery = query.toLowerCase();
    const matches = [];
    let totalMatches = 0;
    
    // Get all text content from the page
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                // Skip script and style elements
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                
                const tagName = parent.tagName.toLowerCase();
                if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
                    return NodeFilter.FILTER_REJECT;
                }
                
                // Skip empty or whitespace-only text
                const text = node.textContent.trim();
                if (!text) return NodeFilter.FILTER_REJECT;
                
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        textNodes.push(node);
    }
    
    // Search through text nodes
    textNodes.forEach(textNode => {
        const text = textNode.textContent.toLowerCase();
        const originalText = textNode.textContent;
        
        let index = 0;
        while ((index = text.indexOf(searchQuery, index)) !== -1) {
            totalMatches++;
            
            // Get context around the match (50 chars before and after)
            const start = Math.max(0, index - 50);
            const end = Math.min(originalText.length, index + searchQuery.length + 50);
            const context = originalText.substring(start, end);
            
            // Only add first few matches per page to avoid overwhelming results
            if (matches.length < 5) {
                matches.push({
                    context: context,
                    matchIndex: index,
                    beforeMatch: originalText.substring(start, index),
                    match: originalText.substring(index, index + searchQuery.length),
                    afterMatch: originalText.substring(index + searchQuery.length, end)
                });
            }
            
            index += searchQuery.length;
        }
    });
    
    return {
        matches: matches,
        totalMatches: totalMatches,
        url: window.location.href,
        title: document.title
    };
}

// Return the search function result
searchPageContent;
