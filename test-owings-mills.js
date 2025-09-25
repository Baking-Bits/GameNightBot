const WeatherSystem = require('./src/features/weatherSystem.js');

async function testOwingsMills() {
    console.log('🧪 Testing Owings Mills region mapping...\n');
    
    const weatherSystem = new WeatherSystem(null, 'test-channel');
    
    // Test the getPrivacyFriendlyLocation method directly
    const mockWeatherData = {
        name: 'Owings Mills',
        sys: { country: 'US', state: 'MD' }
    };
    
    const region = weatherSystem.getPrivacyFriendlyLocation(mockWeatherData);
    
    console.log(`Input: Owings Mills, MD`);
    console.log(`Output: ${region}`);
    
    if (region === 'Maryland') {
        console.log('✅ SUCCESS: Owings Mills correctly mapped to Maryland!');
    } else {
        console.log(`❌ FAILED: Expected "Maryland", got "${region}"`);
    }
    
    // Test a few other Maryland cities for comparison
    const testCities = [
        { name: 'Baltimore', expected: 'Maryland' },
        { name: 'Cockeysville', expected: 'Maryland' },
        { name: 'Annapolis', expected: 'Maryland' }
    ];
    
    console.log('\n🔍 Testing other Maryland cities for comparison:');
    for (const city of testCities) {
        const testData = {
            name: city.name,
            sys: { country: 'US', state: 'MD' }
        };
        const result = weatherSystem.getPrivacyFriendlyLocation(testData);
        const status = result === city.expected ? '✅' : '❌';
        console.log(`${status} ${city.name}: ${result} (expected: ${city.expected})`);
    }
}

testOwingsMills().catch(console.error);
