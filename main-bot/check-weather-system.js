const { pool } = require('./src/database');

async function checkWeatherSystem() {
    try {
        console.log('=== Checking Weather System Status ===');
        
        // Check total weather_history entries
        const [totalEntries] = await pool.execute('SELECT COUNT(*) as total FROM weather_history');
        console.log(`Total weather history entries in database: ${totalEntries[0].total}`);
        
        // Check recent entries (last 24 hours)
        const [recentEntries] = await pool.execute(`
            SELECT COUNT(*) as count, 
                   COUNT(DISTINCT user_id) as unique_users
            FROM weather_history 
            WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `);
        console.log(`Recent entries (24h): ${recentEntries[0].count} entries from ${recentEntries[0].unique_users} users`);
        
        // Check if Stephen has any entries at all
        const stephenUserId = '1225795652924084244';
        const [stephenEntries] = await pool.execute(`
            SELECT COUNT(*) as count FROM weather_history WHERE user_id = ?
        `, [stephenUserId]);
        console.log(`Stephen's total entries: ${stephenEntries[0].count}`);
        
        // Get sample entries to see structure
        const [sampleEntries] = await pool.execute(`
            SELECT user_id, timestamp, temperature, humidity, points 
            FROM weather_history 
            ORDER BY timestamp DESC 
            LIMIT 5
        `);
        console.log('\nSample weather entries:');
        sampleEntries.forEach((entry, i) => {
            console.log(`${i+1}. User: ${entry.user_id}, Time: ${entry.timestamp}, Temp: ${entry.temperature}, Points: ${entry.points || 0}`);
        });
        
        // Check if there are any users with Stephen in the name in any table
        console.log('\n=== Looking for Stephen in any related tables ===');
        
        // Try discord_users if it exists
        try {
            const [discordUsers] = await pool.execute(`
                SELECT user_id, username, global_name 
                FROM discord_users 
                WHERE username LIKE '%Stephen%' OR global_name LIKE '%Stephen%'
                LIMIT 5
            `);
            console.log('Stephen in discord_users:', discordUsers);
        } catch (e) {
            console.log('discord_users table not accessible');
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkWeatherSystem();