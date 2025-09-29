// Quick test of personal ranking enhancement
const weatherCommand = require('./src/commands/weather.js');

async function testPersonalRanking() {
    console.log('=== TESTING PERSONAL RANKING ENHANCEMENT ===\n');
    
    // Mock serviceManager with sample data
    const mockServiceManager = {
        getShittyWeatherLeaderboard: async () => [
            { userId: '123456789', displayName: 'TestUser1', region: 'US', totalPoints: 100 },
            { userId: '987654321', displayName: 'TestUser2', region: 'UK', totalPoints: 85 },
            { userId: '555666777', displayName: 'CurrentUser', region: 'Denmark', totalPoints: 70 },
            { userId: '111222333', displayName: 'TestUser4', region: 'Canada', totalPoints: 50 },
            { userId: '444555666', displayName: 'TestUser5', region: 'Australia', totalPoints: 30 }
        ]
    };

    try {
        // Test with a user in 3rd place
        const ranking = await weatherCommand.getUserPersonalRanking(
            mockServiceManager, 
            '555666777',  // Current user ID
            [],  // No daily data
            []   // No weekly data
        );
        
        console.log('✅ Personal ranking result:');
        console.log(ranking);
        console.log('\n=== TEST COMPLETE ===');
        
    } catch (error) {
        console.error('❌ Error testing personal ranking:', error);
    }
    
    process.exit(0);
}

testPersonalRanking();