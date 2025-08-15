// Comprehensive Cross-Tab Search Test
// Run this in browser console after opening multiple tabs

console.log('🔍 Comprehensive Cross-Tab Search Test');

async function comprehensiveCrossTabTest() {
    console.log('\n=== COMPREHENSIVE CROSS-TAB SEARCH TEST ===');
    
    if (!window.goFasterPalette) {
        console.error('❌ GoFaster extension not found');
        console.log('💡 Make sure the extension is installed and this page is refreshed');
        return;
    }
    
    const palette = window.goFasterPalette;
    
    // Enable debug mode
    if (!palette.debugMode) {
        palette.enableDebugMode();
        console.log('🐛 Debug mode enabled');
    }
    
    console.log('✅ GoFaster found and debug mode enabled');
    
    // Step 1: Check available tabs
    console.log('\n1️⃣ Checking available tabs:');
    try {
        const tabsResponse = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'getTabs' }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
        
        if (!tabsResponse || !tabsResponse.tabs) {
            console.error('❌ Failed to get tabs');
            return;
        }
        
        const tabs = tabsResponse.tabs;
        console.log(`📋 Found ${tabs.length} total tabs:`);
        
        const searchableTabs = tabs.filter(tab => {
            const isSystem = tab.url.startsWith('chrome://') || 
                           tab.url.startsWith('chrome-extension://') || 
                           tab.url.startsWith('about:');
            return !isSystem;
        });
        
        console.log(`🎯 ${searchableTabs.length} searchable tabs:`);
        searchableTabs.forEach((tab, i) => {
            const isActive = tab.active ? '🟢' : '⚪';
            console.log(`   ${i+1}. ${isActive} ${tab.title}`);
            console.log(`      URL: ${tab.url}`);
        });
        
        if (searchableTabs.length < 2) {
            console.warn('⚠️ Only 1 searchable tab found. Open more tabs for better testing.');
            console.log('💡 Try opening: GitHub, Stack Overflow, MDN, or any documentation site');
        }
        
        // Step 2: Test script injection on each tab
        console.log('\n2️⃣ Testing script injection on each searchable tab:');
        const testQuery = 'the'; // Common word
        let successCount = 0;
        let errorCount = 0;
        
        for (const tab of searchableTabs.slice(0, 5)) { // Test first 5 tabs
            try {
                console.log(`   🔍 Testing: ${tab.title}`);
                
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (searchQuery) => {
                        const query = searchQuery.toLowerCase();
                        const bodyText = document.body ? document.body.textContent : '';
                        
                        if (!bodyText) {
                            return { error: 'No body text', totalMatches: 0 };
                        }
                        
                        const text = bodyText.toLowerCase();
                        let totalMatches = 0;
                        let index = 0;
                        
                        while ((index = text.indexOf(query, index)) !== -1) {
                            totalMatches++;
                            index += query.length;
                        }
                        
                        return {
                            totalMatches: totalMatches,
                            bodyLength: bodyText.length,
                            url: window.location.href,
                            title: document.title
                        };
                    },
                    args: [testQuery]
                });
                
                if (results && results[0] && results[0].result) {
                    const result = results[0].result;
                    if (result.error) {
                        console.log(`      ❌ Error: ${result.error}`);
                        errorCount++;
                    } else {
                        console.log(`      ✅ Success: ${result.totalMatches} matches (${result.bodyLength} chars)`);
                        successCount++;
                    }
                } else {
                    console.log(`      ❌ No result returned`);
                    errorCount++;
                }
                
            } catch (error) {
                console.log(`      ❌ Injection failed: ${error.message}`);
                errorCount++;
            }
        }
        
        console.log(`\n📊 Script injection results: ${successCount} success, ${errorCount} errors`);
        
        if (successCount === 0) {
            console.error('❌ No successful script injections! Cross-tab search will not work.');
            console.log('💡 Possible issues:');
            console.log('   - Extension permissions not granted');
            console.log('   - Tabs are protected/system pages');
            console.log('   - Extension needs to be reloaded');
            return;
        }
        
        // Step 3: Test full content search workflow
        console.log('\n3️⃣ Testing full content search workflow:');
        
        // Set up content search mode
        palette.paletteMode = 'content';
        palette.searchQuery = testQuery;
        
        console.log(`   🚀 Running content search for "${testQuery}"...`);
        
        const startTime = Date.now();
        await palette.performSimpleContentSearch();
        const endTime = Date.now();
        
        console.log(`   ⏱️ Search completed in ${endTime - startTime}ms`);
        console.log(`   📊 Results: ${palette.contentResults.length} tabs with matches`);
        
        if (palette.contentResults.length > 0) {
            console.log('   ✅ Content search results:');
            palette.contentResults.forEach((result, i) => {
                console.log(`      ${i+1}. ${result.tab.title} (${result.totalMatches} matches)`);
                if (result.matches && result.matches.length > 0) {
                    console.log(`         Preview: "${result.matches[0].context.substring(0, 50)}..."`);
                }
            });
        } else {
            console.log('   ❌ No content search results found');
            console.log('   💡 This could mean:');
            console.log('      - Script injection failed on all tabs');
            console.log('      - No tabs contain the search term');
            console.log('      - There\'s a bug in the search logic');
        }
        
        // Step 4: Manual test instructions
        console.log('\n4️⃣ Manual test instructions:');
        console.log('   1. Press Ctrl+F to open content search palette');
        console.log('   2. Type "the" or another common word');
        console.log('   3. You should see multiple tabs in results');
        console.log('   4. Click on different results to test navigation');
        console.log('   5. Check that highlighting works on each tab');
        
        // Step 5: Summary
        console.log('\n📋 Test Summary:');
        console.log(`   Total tabs: ${tabs.length}`);
        console.log(`   Searchable tabs: ${searchableTabs.length}`);
        console.log(`   Script injection success: ${successCount}/${successCount + errorCount}`);
        console.log(`   Content search results: ${palette.contentResults.length}`);
        
        if (palette.contentResults.length > 1) {
            console.log('   ✅ Cross-tab search is working!');
        } else if (palette.contentResults.length === 1) {
            console.log('   ⚠️ Only found results in 1 tab. Try opening more diverse websites.');
        } else {
            console.log('   ❌ Cross-tab search is not working properly.');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
    
    console.log('\n=== TEST COMPLETE ===');
}

// Quick test function
async function quickCrossTabTest() {
    console.log('🚀 Quick Cross-Tab Test');
    
    if (!window.goFasterPalette) {
        console.error('❌ GoFaster not found');
        return;
    }
    
    const palette = window.goFasterPalette;
    palette.enableDebugMode();
    
    // Test with common word
    palette.paletteMode = 'content';
    palette.searchQuery = 'the';
    
    await palette.performSimpleContentSearch();
    
    console.log(`Results: ${palette.contentResults.length} tabs with matches`);
    palette.contentResults.forEach((result, i) => {
        console.log(`  ${i+1}. ${result.tab.title} (${result.totalMatches} matches)`);
    });
}

// Export functions
window.comprehensiveCrossTabTest = comprehensiveCrossTabTest;
window.quickCrossTabTest = quickCrossTabTest;

console.log('\nAvailable test functions:');
console.log('  comprehensiveCrossTabTest() - Full detailed test');
console.log('  quickCrossTabTest() - Quick test');
console.log('\n💡 Recommended: comprehensiveCrossTabTest()');

// Auto-run if GoFaster is available
if (window.goFasterPalette) {
    console.log('\n🎯 Auto-running comprehensive test...');
    setTimeout(comprehensiveCrossTabTest, 1000);
}
