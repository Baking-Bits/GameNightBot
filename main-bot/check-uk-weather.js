const { pool } = require('./src/database');

async function checkStephenUKData() {
    try {
        const stephenUserId = '1225795652924084244';
        console.log(`=== Checking Stephen's UK Weather Data ===`);
        
        // Check Stephen's registration details
        console.log('\n=== Stephen\'s Registration ===');
        const stephenReg = await pool.execute('SELECT * FROM weather_users WHERE user_id = ?', [stephenUserId]);
        if (stephenReg[0] && stephenReg[0].length > 0) {
            console.log('Stephen registration:', stephenReg[0][0]);
        } else {
            console.log('Stephen not found in weather_users');
        }
        
        // Check all UK users to see if any have data
        console.log('\n=== All UK Users ===');
        const ukUsers = await pool.execute(`
            SELECT wu.user_id, wu.postal_code, wu.country, wu.weather_enabled,
                   COUNT(wh.id) as weather_entries,
                   MAX(wh.timestamp) as last_weather_check
            FROM weather_users wu 
            LEFT JOIN weather_history wh ON wu.user_id = wh.user_id
            WHERE wu.country = 'GB' OR wu.country = 'UK' OR wu.country = 'United Kingdom'
            GROUP BY wu.user_id
        `);
        
        if (ukUsers[0] && ukUsers[0].length > 0) {
            console.log('UK users:');
            ukUsers[0].forEach(user => {
                console.log(`User ${user.user_id}: ${user.postal_code} (${user.country}) - ${user.weather_entries} entries, last: ${user.last_weather_check}`);
            });
        } else {
            console.log('No UK users found');
        }
        
        // Check recent weather API calls or errors
        console.log('\n=== Recent Weather Activity ===');
        const recentActivity = await pool.execute(`
            SELECT user_id, timestamp, temperature, humidity, wind_speed, points
            FROM weather_history 
            WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY timestamp DESC 
            LIMIT 10
        `);
        
        if (recentActivity[0] && recentActivity[0].length > 0) {
            console.log('Recent weather activity:');
            recentActivity[0].forEach(entry => {
                console.log(`User ${entry.user_id}: ${entry.timestamp} - ${entry.temperature}°F, ${entry.points || 0} pts`);
            });
        } else {
            console.log('No recent weather activity');
        }
        
        // Check if there are any API usage logs
        console.log('\n=== Weather API Usage ===');
        const apiUsage = await pool.execute(`
            SELECT * FROM weather_api_usage 
            ORDER BY timestamp DESC 
            LIMIT 5
        `);
        
        if (apiUsage[0] && apiUsage[0].length > 0) {
            console.log('Recent API usage:');
            apiUsage[0].forEach(usage => {
                console.log(`${usage.timestamp}: ${usage.endpoint || 'unknown'} - ${usage.status || 'unknown'}`);
            });
        } else {
            console.log('No API usage logs found');
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkStephenUKData();