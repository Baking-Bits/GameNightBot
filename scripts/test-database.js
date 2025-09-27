const { getAllActiveWeatherUsers, getShittyWeatherLeaderboard } = require('../main-bot/src/database/weather');

async function testDatabase() {
    try {
        console.log('[TEST] Testing database weather system...');
        
        // Test getting users
        const users = await getAllActiveWeatherUsers();
        console.log(`[TEST] Found ${users.length} active users:`);
        
        for (const user of users) {
            console.log(`  - ${user.display_name} (${user.user_id}) - ${user.city}, ${user.country}`);
        }
        
        // Test leaderboard
        const leaderboard = await getShittyWeatherLeaderboard(10);
        console.log(`\n[TEST] Shitty weather leaderboard (${leaderboard.length} entries):`);
        
        for (const entry of leaderboard) {
            console.log(`  ${entry.display_name}: ${entry.total_points} points`);
        }
        
        console.log('\n[TEST] Database test completed successfully!');
        
    } catch (error) {
        console.error('[TEST] Database test failed:', error);
    }
    
    process.exit(0);
}

testDatabase();
