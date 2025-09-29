const path = require('path');
const fs = require('fs');

// Load config
const configPath = path.join(__dirname, '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize database connection
const mariadb = require('mariadb');
const pool = mariadb.createPool({
    host: config.mariadb.host,
    user: config.mariadb.user,
    password: config.mariadb.password,
    database: config.mariadb.database,
    connectionLimit: 5
});

async function checkPAWeatherData() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('🔍 Checking P@\'s weather data...\n');
        
        // P@'s user ID
        const userId = '97133775074390016';
        
        // Check basic user info
        console.log('=== USER INFO ===');
        const userInfo = await conn.query(`
            SELECT user_id, display_name, region, joined_at, is_active
            FROM weather_users 
            WHERE user_id = ?
        `, [userId]);
        console.log('User Info:', userInfo[0]);
        
        // Check total points from daily_weather_points
        console.log('\n=== DAILY POINTS SUMMARY ===');
        const dailyPointsSummary = await conn.query(`
            SELECT 
                COUNT(*) as total_days,
                SUM(total_points) as total_points,
                AVG(total_points) as avg_points_per_day,
                MIN(date) as first_day,
                MAX(date) as last_day
            FROM daily_weather_points 
            WHERE user_id = ?
        `, [userId]);
        console.log('Daily Points Summary:', dailyPointsSummary[0]);
        
        // Check last 24 hours from weather_history
        console.log('\n=== LAST 24 HOURS (weather_history) ===');
        const last24Hours = await conn.query(`
            SELECT 
                timestamp as recorded_at,
                weather_main,
                weather_description,
                temperature,
                humidity,
                wind_speed
            FROM weather_history 
            WHERE user_id = ? 
                AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY timestamp DESC
        `, [userId]);
        
        if (last24Hours.length === 0) {
            console.log('❌ NO weather_history records found for last 24 hours');
        } else {
            console.log(`✅ Found ${last24Hours.length} weather_history records:`);
            last24Hours.forEach(record => {
                console.log(`  ${record.recorded_at}: ${record.weather_description} (${record.temperature}°C, ${record.humidity}% humidity, ${record.wind_speed} m/s wind)`);
            });
        }
        
        // Check last 7 days from daily_weather_points
        console.log('\n=== LAST 7 DAYS (daily_weather_points) ===');
        const last7Days = await conn.query(`
            SELECT 
                date,
                total_points,
                points_breakdown,
                weather_summary
            FROM daily_weather_points 
            WHERE user_id = ? 
                AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            ORDER BY date DESC
        `, [userId]);
        
        if (last7Days.length === 0) {
            console.log('❌ NO daily_weather_points records found for last 7 days');
        } else {
            console.log(`✅ Found ${last7Days.length} daily records:`);
            let totalPoints = 0;
            last7Days.forEach(record => {
                totalPoints += record.total_points;
                console.log(`  ${record.date}: ${record.total_points} pts - ${record.weather_summary || 'No summary'}`);
                if (record.points_breakdown) {
                    console.log(`    Breakdown: ${record.points_breakdown}`);
                }
            });
            console.log(`  TOTAL: ${totalPoints} points`);
        }
        
        // Check last 30 days from daily_weather_points
        console.log('\n=== LAST 30 DAYS (daily_weather_points) ===');
        const last30Days = await conn.query(`
            SELECT 
                COUNT(*) as days_with_data,
                SUM(total_points) as total_points,
                AVG(total_points) as avg_points_per_day,
                MIN(date) as first_date,
                MAX(date) as last_date
            FROM daily_weather_points 
            WHERE user_id = ? 
                AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        `, [userId]);
        console.log('Last 30 Days Summary:', last30Days[0]);
        
        // Check all weather_history records
        console.log('\n=== ALL WEATHER HISTORY RECORDS ===');
        const allHistory = await conn.query(`
            SELECT 
                COUNT(*) as total_records,
                MIN(timestamp) as first_record,
                MAX(timestamp) as last_record
            FROM weather_history 
            WHERE user_id = ?
        `, [userId]);
        console.log('All History Summary:', allHistory[0]);
        
        // Check recent weather_history records
        console.log('\n=== RECENT WEATHER HISTORY (last 10) ===');
        const recentHistory = await conn.query(`
            SELECT 
                timestamp,
                weather_main,
                weather_description,
                temperature,
                humidity,
                wind_speed
            FROM weather_history 
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT 10
        `, [userId]);
        
        if (recentHistory.length === 0) {
            console.log('❌ NO weather_history records found at all');
        } else {
            console.log(`✅ Found ${recentHistory.length} recent records:`);
            recentHistory.forEach(record => {
                console.log(`  ${record.timestamp}: ${record.weather_description} (${record.temperature}°C, ${record.humidity}% humidity, ${record.wind_speed} m/s wind)`);
            });
        }
        
    } catch (error) {
        console.error('Error checking weather data:', error);
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

checkPAWeatherData();