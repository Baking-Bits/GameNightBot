const { pool } = require('../main-bot/src/database/connection');

async function debugDateQuery() {
    try {
        console.log('[DEBUG] Testing date queries...');
        
        // Check what CURDATE() returns
        const currentDate = await pool.query('SELECT CURDATE() as db_date');
        console.log('Database current date:', currentDate[0]);
        
        // Check what the actual query returns
        const result = await pool.query(`
            SELECT 
                dp.user_id,
                wu.display_name,
                wu.region,
                dp.date,
                dp.total_points,
                dp.points_breakdown,
                dp.weather_summary,
                CURDATE() as query_date,
                DATE_SUB(CURDATE(), INTERVAL 30 DAY) as cutoff_date
            FROM daily_weather_points dp
            JOIN weather_users wu ON dp.user_id = wu.user_id
            WHERE dp.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                AND wu.is_active = TRUE
            ORDER BY dp.total_points DESC
            LIMIT 5
        `);
        
        console.log(`\n[DEBUG] Query results: ${result.length} entries`);
        for (const row of result) {
            console.log(`  ${row.display_name}: ${row.total_points} points on ${row.date}`);
            console.log(`    Query date: ${row.query_date}, Cutoff: ${row.cutoff_date}`);
        }
        
        // Check all dates in the table
        const allDates = await pool.query('SELECT DISTINCT date FROM daily_weather_points ORDER BY date');
        console.log('\n[DEBUG] All dates in table:', allDates.map(r => r.date));
        
    } catch (error) {
        console.error('[DEBUG] Error:', error);
        console.error(error.stack);
    }
    
    process.exit(0);
}

debugDateQuery();