const WeatherSystem = require('./src/features/weatherSystem.js');

async function testDailyWeatherSummary() {
    console.log('🌦️ Testing Daily Weather Summary System...\n');
    
    // Create a mock weather system
    const weatherSystem = new WeatherSystem(null, 'test-channel');
    
    // Simulate weather events throughout the day
    console.log('Simulating weather events...');
    
    // User 1: Extreme heat day
    for (let i = 0; i < 10; i++) {
        weatherSystem.trackWeatherEvents('user1', {
            temp: 105,
            description: 'Clear sky',
            wind: 5,
            humidity: 30
        }, {
            displayName: 'HeatWarrior',
            region: 'Phoenix, AZ'
        });
    }
    
    // User 2: Rainy day
    for (let i = 0; i < 12; i++) {
        weatherSystem.trackWeatherEvents('user2', {
            temp: 65,
            description: 'Heavy rain',
            wind: 8,
            humidity: 85
        }, {
            displayName: 'RainDancer',
            region: 'Seattle, WA'
        });
    }
    
    // User 3: Cold snap
    for (let i = 0; i < 8; i++) {
        weatherSystem.trackWeatherEvents('user3', {
            temp: 5,
            description: 'Snow',
            wind: 20,
            humidity: 70
        }, {
            displayName: 'IceKing',
            region: 'Anchorage, AK'
        });
    }
    
    // User 4: Temperature swing
    const temps = [20, 25, 35, 45, 55, 65, 75, 85, 90, 75, 60, 45];
    temps.forEach(temp => {
        weatherSystem.trackWeatherEvents('user4', {
            temp: temp,
            description: 'Partly cloudy',
            wind: 10,
            humidity: 50
        }, {
            displayName: 'SwingMaster',
            region: 'Denver, CO'
        });
    });
    
    // User 5: Storm warrior
    for (let i = 0; i < 6; i++) {
        weatherSystem.trackWeatherEvents('user5', {
            temp: 78,
            description: 'Thunderstorm',
            wind: 25,
            humidity: 90
        }, {
            displayName: 'StormChaser',
            region: 'Oklahoma City, OK'
        });
    }
    
    console.log('Generating daily weather summary...\n');
    
    // Generate the summary
    const summary = await weatherSystem.generateDailyWeatherSummary();
    
    if (summary.hasNotableEvents) {
        console.log('📊 DAILY WEATHER SUMMARY GENERATED:\n');
        console.log(summary.message);
        console.log(`\n✅ Summary generated with ${summary.eventCount} notable events!`);
    } else {
        console.log('❌ No notable events detected.');
    }
    
    console.log('\n🎯 Test completed!');
}

// Run the test
testDailyWeatherSummary().catch(console.error);
