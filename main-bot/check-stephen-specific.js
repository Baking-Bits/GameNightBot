const { pool } = require('./src/database');

async function checkStephenSpecificData() {
    try {
        const stephenUserId = '1225795652924084244';
        console.log(`=== Checking data for Stephen (User ID: ${stephenUserId}) ===`);
        
        // First check table structure
        console.log('\n=== Weather History Table Structure ===');
        const [structure] = await pool.execute('DESCRIBE weather_history');
        console.log('Structure:', structure);
        
        // Check weather_history for this specific user
        console.log('\n=== Weather History ===');
        const weatherResult = await pool.execute(`
            SELECT * FROM weather_history 
            WHERE user_id = ? 
            ORDER BY timestamp DESC 
            LIMIT 5
        `, [stephenUserId]);
        
        const weatherHistory = weatherResult[0];
        console.log(`Query result:`, weatherResult);
        
        if (Array.isArray(weatherHistory)) {
            console.log(`Found ${weatherHistory.length} weather history entries for Stephen:`);
            weatherHistory.forEach((entry, i) => {
                console.log(`${i+1}.`, entry);
            });
        } else {
            console.log('No weather history found or unexpected result format');
        }
        
        // Check recent activity (last 24 hours)
        const [recent24h] = await pool.execute(`
            SELECT COUNT(*) as count, SUM(COALESCE(points, 0)) as total_points
            FROM weather_history 
            WHERE user_id = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `, [stephenUserId]);
        
        console.log(`\n=== Last 24 Hours Summary ===`);
        console.log(`Entries: ${recent24h[0].count}, Total Points: ${recent24h[0].total_points || 0}`);
        
        // Check recent activity (last 7 days)
        const [recent7d] = await pool.execute(`
            SELECT COUNT(*) as count, SUM(COALESCE(points, 0)) as total_points
            FROM weather_history 
            WHERE user_id = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `, [stephenUserId]);
        
        console.log(`\n=== Last 7 Days Summary ===`);
        console.log(`Entries: ${recent7d[0].count}, Total Points: ${recent7d[0].total_points || 0}`);
        
        // Check if points column has null values
        const [nullPoints] = await pool.execute(`
            SELECT COUNT(*) as total_entries,
                   COUNT(points) as entries_with_points,
                   COUNT(*) - COUNT(points) as entries_with_null_points
            FROM weather_history 
            WHERE user_id = ?
        `, [stephenUserId]);
        
        console.log(`\n=== Points Column Analysis ===`);
        console.log(`Total entries: ${nullPoints[0].total_entries}`);
        console.log(`Entries with points: ${nullPoints[0].entries_with_points}`);
        console.log(`Entries with NULL points: ${nullPoints[0].entries_with_null_points}`);
        
    } catch (error) {
        console.error('Error checking Stephen data:', error);
    } finally {
        await pool.end();
    }
}

checkStephenSpecificData();