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

async function checkEnhancedWeatherData() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('🔍 Checking Enhanced Weather Data for P@...\n');
        
        // P@'s user ID
        const userId = '97133775074390016';
        
        // Check weather_history with new point data
        console.log('=== ENHANCED WEATHER HISTORY (with points) ===');
        const enhancedHistory = await conn.query(`
            SELECT 
                timestamp,
                temperature,
                humidity,
                wind_speed,
                weather_description,
                points,
                points_breakdown,
                calculated_at
            FROM weather_history 
            WHERE user_id = ? 
                AND timestamp >= DATE_SUB(NOW(), INTERVAL 48 HOUR)
            ORDER BY timestamp DESC
            LIMIT 20
        `, [userId]);
        
        if (enhancedHistory.length === 0) {
            console.log('❌ NO weather history found with point calculations');
        } else {
            console.log(`✅ Found ${enhancedHistory.length} enhanced weather records:`);
            enhancedHistory.forEach(record => {
                let breakdown = '';
                try {
                    if (record.points_breakdown) {
                        const breakdownObj = JSON.parse(record.points_breakdown);
                        const reasons = Object.keys(breakdownObj).filter(key => breakdownObj[key] > 0);
                        breakdown = reasons.length > 0 ? ` - ${reasons.join(', ')}` : '';
                    }
                } catch (e) {
                    breakdown = '';
                }
                
                const calculatedStatus = record.calculated_at ? '✅' : '❌';
                console.log(`  ${calculatedStatus} ${record.timestamp}: ${record.points || 0} pts${breakdown}`);
                console.log(`      Weather: ${record.weather_description} (${Math.round(record.temperature)}°F, ${record.humidity}% humidity, ${Math.round(record.wind_speed || 0)}mph wind)`);
            });
        }
        
        // Check point totals
        console.log('\n=== POINT TOTALS COMPARISON ===');
        
        // From weather_history (hourly points)
        const hourlyTotal = await conn.query(`
            SELECT 
                COUNT(*) as total_entries,
                SUM(points) as total_hourly_points,
                COUNT(CASE WHEN points > 0 THEN 1 END) as entries_with_points
            FROM weather_history 
            WHERE user_id = ? 
                AND calculated_at IS NOT NULL
        `, [userId]);
        
        // From daily_weather_points (daily summaries)
        const dailyTotal = await conn.query(`
            SELECT 
                COUNT(*) as total_days,
                SUM(total_points) as total_daily_points
            FROM daily_weather_points 
            WHERE user_id = ?
        `, [userId]);
        
        // From shitty_weather_scores (overall total)
        const overallTotal = await conn.query(`
            SELECT total_points as overall_total
            FROM shitty_weather_scores 
            WHERE user_id = ?
        `, [userId]);
        
        console.log('📊 Point Comparison:');
        if (hourlyTotal.length > 0) {
            const hourly = hourlyTotal[0];
            console.log(`   Hourly System: ${Number(hourly.total_hourly_points || 0)} points from ${Number(hourly.total_entries)} entries`);
            console.log(`                  ${Number(hourly.entries_with_points)} entries earned points`);
        }
        
        if (dailyTotal.length > 0) {
            const daily = dailyTotal[0];
            console.log(`   Daily System:  ${Number(daily.total_daily_points || 0)} points from ${Number(daily.total_days)} days`);
        }
        
        if (overallTotal.length > 0) {
            const overall = overallTotal[0];
            console.log(`   Overall Total: ${Number(overall.overall_total || 0)} points`);
        }
        
        // Test the new getUserWeatherHistory function
        console.log('\n=== TESTING ENHANCED getUserWeatherHistory ===');
        const { getUserWeatherHistory } = require('./src/database/weather');
        const userHistory = await getUserWeatherHistory(userId, 7);
        
        console.log(`Found ${userHistory.length} combined history entries:`);
        userHistory.slice(0, 10).forEach(entry => {
            const points = entry.points || entry.points_awarded || 0;
            const timestamp = new Date(entry.timestamp).toLocaleString();
            console.log(`  ${points} pts at ${timestamp} (${entry.source})`);
            if (entry.breakdown && typeof entry.breakdown === 'object') {
                const reasons = Object.keys(entry.breakdown).filter(key => entry.breakdown[key] > 0);
                if (reasons.length > 0) {
                    console.log(`    Reasons: ${reasons.join(', ')}`);
                }
            }
        });
        
        console.log('\n✅ Enhanced weather data check completed!');
        
    } catch (error) {
        console.error('❌ Error checking enhanced weather data:', error);
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

checkEnhancedWeatherData();