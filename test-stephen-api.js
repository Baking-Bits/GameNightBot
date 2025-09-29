// Test Stephen's weather API calls specifically
const https = require('https');

async function testStephenWeatherAPI() {
    try {
        console.log('=== Testing Stephen\'s Weather API Calls ===');
        
        // Test a UK postal code similar to what Stephen might have
        const testPostalCodes = [
            'SW1A 1AA',  // Westminster - common test case
            'M1 1AA',    // Manchester - another common one
            'E1 6AN'     // London East - another format
        ];
        
        const apiKey = 'a1afa3d523672a255ebd39a126e7ac3e'; // Same as in the code
        
        for (const postalCode of testPostalCodes) {
            console.log(`\n=== Testing: "${postalCode}" ===`);
            
            // Test the exact same URL construction as the fixed code
            const encodedPostalCode = encodeURIComponent(postalCode);
            const url = `https://api.openweathermap.org/data/2.5/weather?zip=${encodedPostalCode},GB&appid=${apiKey}&units=imperial`;
            
            console.log(`URL: ${url}`);
            
            try {
                const result = await makeAPICall(url);
                console.log(`✅ SUCCESS: ${result.name}, Temp: ${result.main.temp}°F, Weather: ${result.weather[0].description}`);
            } catch (error) {
                console.log(`❌ FAILED: ${error.message}`);
            }
        }
        
        // Also test if the geocoding API works better for UK
        console.log('\n=== Testing Geocoding API Alternative ===');
        const geocodingUrl = `https://api.openweathermap.org/geo/1.0/zip?zip=SW1A 1AA,GB&appid=${apiKey}`;
        console.log(`Geocoding URL: ${geocodingUrl}`);
        
        try {
            const geoResult = await makeAPICall(geocodingUrl);
            console.log(`✅ Geocoding SUCCESS:`, geoResult);
            
            // If geocoding works, try getting weather by coordinates
            if (geoResult.lat && geoResult.lon) {
                const weatherByCoordUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${geoResult.lat}&lon=${geoResult.lon}&appid=${apiKey}&units=imperial`;
                const weatherResult = await makeAPICall(weatherByCoordUrl);
                console.log(`✅ Weather by coordinates: ${weatherResult.name}, ${weatherResult.main.temp}°F`);
            }
        } catch (error) {
            console.log(`❌ Geocoding FAILED: ${error.message}`);
        }
        
    } catch (error) {
        console.error('Test error:', error);
    }
}

function makeAPICall(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (response.statusCode === 200) {
                        resolve(result);
                    } else {
                        reject(new Error(`API Error ${response.statusCode}: ${result.message || 'Unknown error'}`));
                    }
                } catch (error) {
                    reject(new Error(`Parse error: ${error.message}`));
                }
            });
        }).on('error', (error) => {
            reject(new Error(`Request error: ${error.message}`));
        });
    });
}

testStephenWeatherAPI();