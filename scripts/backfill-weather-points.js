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

async function backfillWeatherHistoryPoints() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('🔄 Backfilling weather history with point calculations...\n');
        
        const { calculateWeatherPoints } = require('../services/shared/utils/weatherPointCalculator');
        
        // Get all weather history entries that don't have points calculated yet
        console.log('📊 Finding weather history entries without point calculations...');
        const uncalculatedEntries = await conn.query(`
            SELECT id, user_id, temperature, humidity, wind_speed, weather_main, weather_description, timestamp
            FROM weather_history 
            WHERE calculated_at IS NULL 
            ORDER BY timestamp DESC
            LIMIT 1000
        `);
        
        console.log(`Found ${uncalculatedEntries.length} entries to process.`);
        
        if (uncalculatedEntries.length === 0) {
            console.log('✅ No entries need point calculation.');
            return;
        }
        
        let processed = 0;
        let totalPointsCalculated = 0;
        
        console.log('🔄 Processing entries...\n');
        
        for (const entry of uncalculatedEntries) {
            try {
                // Reconstruct weather data format for point calculation
                const weatherData = {
                    main: {
                        temp: entry.temperature || 70,
                        humidity: entry.humidity || 50
                    },
                    wind: {
                        speed: (entry.wind_speed || 0) / 2.237 // Convert mph back to m/s
                    },
                    weather: [{
                        main: entry.weather_main || 'Clear',
                        description: entry.weather_description || 'unknown'
                    }]
                };
                
                // Calculate points for this historical entry
                const pointData = calculateWeatherPoints(weatherData);
                
                // Update the database entry with calculated points
                await conn.query(`
                    UPDATE weather_history 
                    SET points = ?, 
                        points_breakdown = ?, 
                        calculated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `, [
                    pointData.points,
                    JSON.stringify(pointData.breakdown),
                    entry.id
                ]);
                
                totalPointsCalculated += pointData.points;
                processed++;
                
                // Log progress every 50 entries
                if (processed % 50 === 0) {
                    console.log(`   Processed ${processed}/${uncalculatedEntries.length} entries...`);
                }
                
                // Log interesting weather events
                if (pointData.points > 5) {
                    const timestamp = new Date(entry.timestamp).toLocaleString();
                    console.log(`   🌪️  High point entry: ${pointData.points} pts at ${timestamp} (${pointData.summary})`);
                }
                
            } catch (entryError) {
                console.error(`Error processing entry ${entry.id}:`, entryError.message);
            }
        }
        
        console.log(`\n✅ Backfill completed!`);
        console.log(`📊 Summary:`);
        console.log(`   • Entries processed: ${processed}`);
        console.log(`   • Total points calculated: ${totalPointsCalculated}`);
        console.log(`   • Average points per entry: ${(totalPointsCalculated / processed).toFixed(2)}`);
        
        // Show some statistics
        console.log('\n📈 Point distribution:');
        const pointStats = await conn.query(`
            SELECT 
                COUNT(*) as total_entries,
                SUM(points) as total_points,
                AVG(points) as avg_points,
                MAX(points) as max_points,
                COUNT(CASE WHEN points > 0 THEN 1 END) as entries_with_points,
                COUNT(CASE WHEN points >= 5 THEN 1 END) as high_point_entries
            FROM weather_history 
            WHERE calculated_at IS NOT NULL
        `);
        
        if (pointStats.length > 0) {
            const stats = pointStats[0];
            console.log(`   • Total entries with calculations: ${Number(stats.total_entries)}`);
            console.log(`   • Total points in system: ${Number(stats.total_points)}`);
            console.log(`   • Average points per entry: ${parseFloat(stats.avg_points).toFixed(2)}`);
            console.log(`   • Highest single entry: ${Number(stats.max_points)} points`);
            console.log(`   • Entries earning points: ${Number(stats.entries_with_points)} (${(Number(stats.entries_with_points) / Number(stats.total_entries) * 100).toFixed(1)}%)`);
            console.log(`   • High-value entries (5+ pts): ${Number(stats.high_point_entries)}`);
        }
        
        console.log('\n🎯 Historical weather data now has hourly point breakdowns!');
        console.log('   Users can now see detailed point histories with /weather shitty @user detailed');
        
    } catch (error) {
        console.error('❌ Error during backfill:', error);
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

backfillWeatherHistoryPoints();