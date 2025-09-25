const { WeatherSystem } = require('./src/features/weatherSystem');

// Mock Discord client
const mockClient = {
    channels: {
        cache: {
            get: () => ({
                send: async (message) => {
                    console.log('\n📢 DISCORD MESSAGE:');
                    console.log('─'.repeat(50));
                    console.log(message);
                    console.log('─'.repeat(50));
                }
            })
        }
    }
};

// Mock config
const mockConfig = {
    weatherApiKey: 'test_key',
    weatherChannelId: 'test_channel'
};

async function testOptimizedWeatherSystem() {
    console.log('🧪 Testing Optimized Weather System');
    console.log('=' .repeat(60));
    
    try {
        const weatherSystem = new (require('./src/features/weatherSystem'))(mockClient, mockConfig);
        
        // Test API delay calculation at different usage levels
        console.log('\n📊 Testing Dynamic API Delays:');
        
        // Simulate different API usage scenarios
        const scenarios = [
            { used: 50, remaining: 750, description: 'Normal usage' },
            { used: 600, remaining: 200, description: 'Moderate usage' },
            { used: 720, remaining: 80, description: 'High usage' },
            { used: 770, remaining: 30, description: 'Critical usage' }
        ];
        
        for (const scenario of scenarios) {
            weatherSystem.apiCallsToday = scenario.used;
            const delay = weatherSystem.calculateApiDelay();
            const shouldCall = weatherSystem.shouldMakeApiCalls();
            
            console.log(`\n  ${scenario.description}:`);
            console.log(`    API calls used: ${scenario.used}/${weatherSystem.dailyLimit}`);
            console.log(`    Remaining: ${scenario.remaining}`);
            console.log(`    Calculated delay: ${delay}ms`);
            console.log(`    Should make calls: ${shouldCall ? '✅ Yes' : '❌ No'}`);
        }
        
        // Test significant change threshold
        console.log('\n🎯 Testing Significant Change Detection:');
        
        weatherSystem.significantPointThreshold = 3;
        weatherSystem.lastUserScores.set('user1', 5);
        
        const testChanges = [
            { newScore: 5, change: 0, description: 'No change' },
            { newScore: 7, change: 2, description: 'Small change' },
            { newScore: 9, change: 4, description: 'Significant change' },
            { newScore: 12, change: 7, description: 'Major change' }
        ];
        
        for (const test of testChanges) {
            const isSignificant = test.change >= weatherSystem.significantPointThreshold;
            console.log(`\n  ${test.description}:`);
            console.log(`    Previous: 5 points`);
            console.log(`    New: ${test.newScore} points`);
            console.log(`    Change: ${test.change} points`);
            console.log(`    Threshold: ${weatherSystem.significantPointThreshold} points`);
            console.log(`    Will notify: ${isSignificant ? '✅ Yes' : '❌ No'}`);
        }
        
        // Test API conservation logic
        console.log('\n⚡ Testing API Conservation Logic:');
        
        const conservationTests = [
            { remaining: 300, expected: 'Normal operation' },
            { remaining: 80, expected: '60% chance of checking' },
            { remaining: 30, expected: '30% chance of checking' }
        ];
        
        for (const test of conservationTests) {
            weatherSystem.apiCallsToday = weatherSystem.dailyLimit - test.remaining;
            const shouldCall = weatherSystem.shouldMakeApiCalls();
            console.log(`\n  Remaining calls: ${test.remaining}`);
            console.log(`    Expected: ${test.expected}`);
            console.log(`    Result: ${shouldCall ? 'Proceeding with checks' : 'Skipping checks'}`);
        }
        
        console.log('\n✅ Optimized Weather System Test Complete!');
        console.log('\n🎯 Key Optimizations:');
        console.log('  • Hourly checks instead of every 4 hours');
        console.log('  • Only notify when point changes ≥ 3');
        console.log('  • Dynamic API delays based on usage');
        console.log('  • Probabilistic checking when API calls low');
        console.log('  • Smarter API conservation for free tier');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testOptimizedWeatherSystem();
