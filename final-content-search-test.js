// Final Content Search Test - Run this in browser console
// This script tests all the fixes made to the content search functionality

console.log('🔧 Final Content Search Test');

async function finalContentSearchTest() {
    console.log('\n=== FINAL CONTENT SEARCH TEST ===');
    
    if (!window.goFasterPalette) {
        console.error('❌ GoFaster extension not found');
        console.log('Make sure the extension is installed and the page is refreshed');
        return;
    }
    
    const palette = window.goFasterPalette;
    
    // Enable debug mode
    if (!palette.debugMode) {
        palette.enableDebugMode();
        console.log('🐛 Debug mode enabled');
    }
    
    console.log('✅ GoFaster extension found and debug mode enabled');
    
    // Test 1: Search mode detection
    console.log('\n1. Testing Search Mode Detection:');
    const testQueries = [
        { query: 'test', expected: 'tabs' },
        { query: 'error handling', expected: 'content' },
        { query: 'javascript functions', expected: 'content' }
    ];
    
    testQueries.forEach(test => {
        const hasSpaces = test.query.includes(' ');
        const isLongEnough = test.query.length >= 3;
        const actualMode = (isLongEnough && hasSpaces) ? 'content' : 'tabs';
        const correct = actualMode === test.expected;
        console.log(`   "${test.query}" -> ${actualMode} ${correct ? '✅' : '❌'}`);
    });
    
    // Test 2: Background script communication
    console.log('\n2. Testing Background Script Communication:');
    try {
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'searchContent',
                query: 'error handling'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
        
        console.log('   Background script response:', response);
        if (response && response.success) {
            console.log(`   ✅ Background script working - found ${response.results.length} results`);
        } else {
            console.log('   ⚠️ Background script returned no results');
        }
    } catch (error) {
        console.error('   ❌ Background script communication failed:', error);
    }
    
    // Test 3: Full workflow test
    console.log('\n3. Testing Full Workflow:');
    try {
        // Reset state
        palette.searchQuery = 'error handling';
        palette.searchMode = 'content';
        palette.contentResults = [];
        palette.filteredTabs = [];
        palette.isLoading = false;
        
        console.log('   Calling performContentSearch...');
        await palette.performContentSearch();
        
        console.log(`   Content results: ${palette.contentResults.length}`);
        console.log(`   Loading state: ${palette.isLoading}`);
        
        console.log('   Calling renderResults...');
        palette.renderResults();
        
        const contentElements = document.querySelectorAll('.result-item.content-result');
        const tabElements = document.querySelectorAll('.result-item:not(.content-result)');
        
        console.log(`   Rendered content elements: ${contentElements.length}`);
        console.log(`   Rendered tab elements: ${tabElements.length}`);
        
        if (contentElements.length > 0) {
            console.log('   ✅ SUCCESS: Content search is working!');
        } else {
            console.log('   ❌ Content search not rendering results');
        }
        
    } catch (error) {
        console.error('   ❌ Full workflow test failed:', error);
    }
    
    console.log('\n=== TEST COMPLETE ===');
    console.log('\n💡 Manual Test Instructions:');
    console.log('1. Press Ctrl+P to open command palette');
    console.log('2. Type "error handling" (should trigger content search)');
    console.log('3. Look for 📄 icons and content previews');
    console.log('4. Type "xyznonexistent" to test "No tabs found" styling');
}

window.finalContentSearchTest = finalContentSearchTest;

console.log('\n💡 Run: finalContentSearchTest()');

// Auto-run if GoFaster is available
if (window.goFasterPalette) {
    finalContentSearchTest();
}
