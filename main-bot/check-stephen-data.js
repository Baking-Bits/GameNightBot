const { pool } = require('./src/database');

async function checkStephenData() {
    try {
        console.log('=== Checking Stephen\'s Data ===');
        
        // Find Stephen's user record
        const [stephenUsers] = await pool.execute(`
            SELECT user_id, username, display_name, postal_code, weather_enabled, created_at
            FROM users 
            WHERE display_name LIKE '%Stephen%' OR username LIKE '%Stephen%'
            ORDER BY created_at DESC
        `);
        
        console.log('Stephen users found:', stephenUsers);
        
        if (stephenUsers.length > 0) {
            for (const user of stephenUsers) {
                console.log(`\n=== User: ${user.display_name} (${user.username}) ===`);
                console.log(`User ID: ${user.user_id}`);
                console.log(`Postal Code: ${user.postal_code}`);
                console.log(`Weather Enabled: ${user.weather_enabled}`);
                
                // Check weather history
                const [weatherHistory] = await pool.execute(`
                    SELECT id, timestamp, temperature, humidity, wind_speed, wind_direction, 
                           description, condition, points, points_breakdown, calculated_at,
                           DATE(timestamp) as date_only,
                           HOUR(timestamp) as hour_only
                    FROM weather_history 
                    WHERE user_id = ? 
                    ORDER BY timestamp DESC 
                    LIMIT 20
                `, [user.user_id]);
                
                console.log(`Weather history entries: ${weatherHistory.length}`);
                
                if (weatherHistory.length > 0) {
                    console.log('Recent entries:');
                    weatherHistory.forEach((entry, i) => {
                        console.log(`${i+1}. ${entry.timestamp} - ${entry.description} - ${entry.points || 0} pts`);
                        if (entry.points_breakdown) {
                            console.log(`   Breakdown: ${entry.points_breakdown}`);
                        }
                    });
                    
                    // Check last 24 hours specifically
                    const [last24h] = await pool.execute(`
                        SELECT COUNT(*) as count, SUM(COALESCE(points, 0)) as total_points
                        FROM weather_history 
                        WHERE user_id = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                    `, [user.user_id]);
                    
                    console.log(`Last 24 hours: ${last24h[0].count} entries, ${last24h[0].total_points || 0} points`);
                }
            }
        }
        
        // Also check if there are any weather history entries without proper user mapping
        const [orphanedEntries] = await pool.execute(`
            SELECT wh.user_id, COUNT(*) as count 
            FROM weather_history wh 
            LEFT JOIN users u ON wh.user_id = u.user_id 
            WHERE u.user_id IS NULL 
            GROUP BY wh.user_id
            LIMIT 10
        `);
        
        if (orphanedEntries.length > 0) {
            console.log('\n=== Orphaned weather entries (no matching user) ===');
            orphanedEntries.forEach(entry => {
                console.log(`User ID ${entry.user_id}: ${entry.count} entries`);
            });
        }
        
    } catch (error) {
        console.error('Error checking Stephen data:', error);
    } finally {
        await pool.end();
    }
}

checkStephenData();