// Test the enhanced UK postcode system
const WeatherSystem = require('./src/features/weatherSystem');

async function testEnhancedUK() {
    // Mock client and config for testing
    const mockClient = null;
    const mockConfig = {
        weatherApiKey: 'a1afa3d523672a255ebd39a126e7ac3e',
        weatherChannelId: '1420809023988437163'
    };
    const weatherSystem = new WeatherSystem(mockClient, mockConfig);
    const postcodes = ['CR2 7AR', 'SW1A 1AA', 'M1 1AA', 'B1 1AA'];
    
    console.log('Testing enhanced UK postcode system...\n');
    
    for (const postcode of postcodes) {
        console.log(`Testing: ${postcode}`);
        try {
            const weather = await weatherSystem.fetchWeatherByPostalCode(postcode);
            console.log(`✅ SUCCESS: ${weather.name}, ${weather.sys.country}`);
            console.log(`   Weather: ${weather.weather[0].description}`);
            console.log(`   Coordinates: ${weather.coord.lat}, ${weather.coord.lon}`);
        } catch (error) {
            console.log(`❌ FAILED: ${error.message}`);
        }
        console.log('---');
    }
}

testEnhancedUK();
