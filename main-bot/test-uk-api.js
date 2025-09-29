// Test UK weather API integration
async function testUKWeatherAPI() {
    try {
        console.log('=== Testing UK Weather API Integration ===');
        
        // Test some UK postal codes
        const ukPostalCodes = [
            'SW1A 1AA',  // Westminster
            'M1 1AA',    // Manchester
            'B1 1AA',    // Birmingham
            'L1 8JQ',    // Liverpool
            'G1 1AA'     // Glasgow
        ];
        
        console.log('\nTesting sample UK postal codes...');
        
        for (const postalCode of ukPostalCodes) {
            console.log(`\nTesting: ${postalCode}`);
            
            // Check if we can make a request to OpenWeatherMap API
            // (You'll need to check the actual weather service code for the API key and endpoint)
            const testUrl = `https://api.openweathermap.org/geo/1.0/zip?zip=${encodeURIComponent(postalCode)},GB&appid=test`;
            console.log(`Test URL would be: ${testUrl}`);
            
            // For now just check the format
            if (postalCode.includes(' ')) {
                console.log(`✅ UK format with space: "${postalCode}"`);
            } else {
                console.log(`⚠️ No space in postal code: "${postalCode}"`);
            }
        }
        
        console.log('\n=== Analysis ===');
        console.log('UK postal codes typically have a space (e.g., "SW1A 1AA")');
        console.log('Some weather APIs may have issues with:');
        console.log('- Spaces in postal codes');
        console.log('- Country code handling (GB vs UK)');
        console.log('- URL encoding of spaces');
        
        console.log('\n=== Recommendations ===');
        console.log('1. Check weather service logs for UK API calls');
        console.log('2. Verify UK postal code handling in weather API');
        console.log('3. Test with Stephen\'s actual postal code');
        console.log('4. Check if weather service is calling API for UK users');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testUKWeatherAPI();