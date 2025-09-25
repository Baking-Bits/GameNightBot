const WeatherSystem = require('./src/features/weatherSystem');
const config = require('./config.json');

// Simple test of the weather system
async function testWeatherSystem() {
    console.log('Testing Weather System...');
    
    // Mock client object
    const mockClient = {
        channels: {
            cache: {
                get: (id) => ({
                    send: (message) => console.log(`Would send to channel ${id}:`, message)
                })
            }
        }
    };

    try {
        const weatherSystem = new WeatherSystem(mockClient, config);
        console.log('✅ Weather system created successfully');
        
        // Test API call with a sample zip code
        console.log('\nTesting API call...');
        const weather = await weatherSystem.fetchWeatherByZip('10001'); // NYC zip code
        console.log('✅ API call successful!');
        console.log(`Weather for ${weather.name}: ${Math.round(weather.main.temp)}°F, ${weather.weather[0].description}`);
        
        // Test severe weather check
        const alert = weatherSystem.checkSevereWeather(weather, { city: weather.name });
        if (alert) {
            console.log('Weather alert:', alert);
        } else {
            console.log('No weather alerts');
        }
        
        console.log('\n✅ All weather system tests passed!');
        
    } catch (error) {
        console.error('❌ Weather system test failed:', error.message);
    }
}

testWeatherSystem();
