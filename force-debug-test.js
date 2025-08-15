// Force debug mode and test content search
// Run this in browser console after loading the extension

console.log('🔧 Force Debug Mode Test');

// Step 1: Force enable debug mode
if (window.goFasterPalette) {
    console.log('✅ GoFaster found, enabling debug mode...');
    window.goFasterPalette.debugMode = true;
    window.goFasterPalette.log('🐛 Debug mode force-enabled');
    
    // Step 2: Test search mode detection
    console.log('\n=== Testing Search Mode Detection ===');
    
    const testQuery = 'error handling test';
    window.goFasterPalette.searchQuery = testQuery;
    
    // Manually trigger the search mode logic
    if (window.goFasterPalette.searchQuery.length >= 3 && window.goFasterPalette.searchQuery.includes(' ')) {
        window.goFasterPalette.searchMode = 'content';
        console.log('✅ Search mode set to: content');
    } else {
        window.goFasterPalette.searchMode = 'tabs';
        console.log('❌ Search mode set to: tabs');
    }
    
    // Step 3: Test content search directly
    console.log('\n=== Testing Content Search ===');
    
    window.goFasterPalette.performContentSearch().then(() => {
        console.log('✅ Content search completed');
        console.log('   Results found:', window.goFasterPalette.contentResults.length);
        console.log('   Content results:', window.goFasterPalette.contentResults);
    }).catch(error => {
        console.log('❌ Content search failed:', error);
    });
    
} else {
    console.log('❌ GoFaster not found');
    console.log('Available objects:', Object.keys(window).filter(key => key.includes('goFaster')));
}

// Step 4: Test background script debug mode
console.log('\n=== Testing Background Script Debug ===');

if (chrome && chrome.storage) {
    chrome.storage.sync.set({ debugMode: true }, () => {
        console.log('✅ Debug mode enabled in extension storage');
    });
} else {
    console.log('❌ Chrome storage not available');
}

// Step 5: Test direct message to background
if (chrome && chrome.runtime) {
    console.log('\n=== Testing Direct Message ===');
    
    chrome.runtime.sendMessage({
        action: 'searchContent',
        query: 'test content search'
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.log('❌ Message failed:', chrome.runtime.lastError.message);
        } else {
            console.log('✅ Message sent successfully');
            console.log('   Response:', response);
            if (response && response.results) {
                console.log('   Results found:', response.results.length);
                response.results.forEach((result, index) => {
                    console.log(`   Result ${index + 1}:`, result.tab.title, `(${result.totalMatches} matches)`);
                });
            }
        }
    });
} else {
    console.log('❌ Chrome runtime not available');
}

console.log('\n🎯 Force debug test complete. Check console output above.');
console.log('Now try: Press Ctrl+P and type "error handling"');
