const { pool } = require('../main-bot/src/database/connection');

async function checkDailyPointsData() {
    try {
        console.log('[CHECK] Checking daily_weather_points table...');
        
        // Check if table exists and has data
        const result = await pool.query('SELECT * FROM daily_weather_points ORDER BY date DESC, total_points DESC LIMIT 10');
        console.log(`[CHECK] Found ${result.length} entries in daily_weather_points table`);
        
        if (result.length > 0) {
            console.log('\n[CHECK] Recent entries:');
            for (const row of result) {
                console.log(`  ${row.user_id}: ${row.total_points} points on ${row.date}`);
                if (row.points_breakdown) {
                    console.log(`    Breakdown: ${row.points_breakdown}`);
                }
            }
        }
        
        // Check regular shitty weather scores for comparison
        const scoresResult = await pool.query(`
            SELECT sws.user_id, wu.display_name, sws.total_points, sws.last_award_date 
            FROM shitty_weather_scores sws 
            JOIN weather_users wu ON sws.user_id = wu.user_id 
            WHERE wu.is_active = TRUE 
            ORDER BY sws.total_points DESC 
            LIMIT 10
        `);
        
        console.log(`\n[CHECK] Regular shitty weather scores (${scoresResult.length} entries):`);
        for (const row of scoresResult) {
            console.log(`  ${row.display_name}: ${row.total_points} points (last: ${row.last_award_date})`);
        }
        
    } catch (error) {
        console.error('[CHECK] Error:', error);
        console.error(error.stack);
    }
    
    process.exit(0);
}

checkDailyPointsData();