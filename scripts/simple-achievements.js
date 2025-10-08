const mariadb = require('mariadb');

const config = {
    host: 'homelab-p',
    user: 'GNMC', 
    password: 'MCGamenight!',
    database: 'GameNightDB',
    acquireTimeout: 60000,
    timeout: 60000
};

/**
 * Simple updater for achievement values
 * Just calculates and stores the raw numbers
 */
async function updateAchievementValues() {
    const pool = mariadb.createPool(config);
    let conn;
    
    try {
        conn = await pool.getConnection();
        console.log('🔗 Updating achievement values...');
        
        // Update voice hours
        console.log('📊 Calculating voice hours...');
        const voiceData = await conn.query(`
            SELECT 
                user_id,
                guild_id,
                ROUND(SUM(total_time) / 3600, 2) as total_hours
            FROM voice_times 
            GROUP BY user_id, guild_id
            HAVING total_hours > 0
        `);
        
        for (const record of voiceData) {
            await conn.query(`
                INSERT INTO achievements (user_id, guild_id, achievement_type, value)
                VALUES (?, ?, 'voice_hours_total', ?)
                ON DUPLICATE KEY UPDATE 
                    value = VALUES(value),
                    updated_at = CURRENT_TIMESTAMP
            `, [record.user_id, record.guild_id, record.total_hours]);
        }
        console.log(`✅ Updated ${voiceData.length} voice hour records`);
        
        // Update weather points
        console.log('🌤️ Calculating weather points...');
        const weatherData = await conn.query(`
            SELECT 
                user_id,
                '1083955208360562740' as guild_id,
                SUM(total_points) as total_points
            FROM daily_weather_points 
            GROUP BY user_id
            HAVING total_points > 0
        `);
        
        for (const record of weatherData) {
            await conn.query(`
                INSERT INTO achievements (user_id, guild_id, achievement_type, value)
                VALUES (?, ?, 'weather_points_total', ?)
                ON DUPLICATE KEY UPDATE 
                    value = VALUES(value),
                    updated_at = CURRENT_TIMESTAMP
            `, [record.user_id, record.guild_id, record.total_points]);
        }
        console.log(`✅ Updated ${weatherData.length} weather point records`);
        
        console.log('\n🎉 All achievement values updated!');
        
    } catch (error) {
        console.error('❌ Error updating achievements:', error);
        throw error;
    } finally {
        if (conn) conn.release();
        pool.end();
    }
}

/**
 * Get simple data for website
 */
async function getAchievementData(achievementType, guildId = null) {
    const pool = mariadb.createPool(config);
    let conn;
    
    try {
        conn = await pool.getConnection();
        
        let query = 'SELECT user_id, value FROM achievements WHERE achievement_type = ?';
        let params = [achievementType];
        
        if (guildId) {
            query += ' AND guild_id = ?';
            params.push(guildId);
        }
        
        query += ' ORDER BY value DESC';
        
        const results = await conn.query(query, params);
        return results;
        
    } catch (error) {
        console.error('❌ Error getting achievement data:', error);
        throw error;
    } finally {
        if (conn) conn.release();
        pool.end();
    }
}

// Command line interface
async function main() {
    const command = process.argv[2];
    
    switch (command) {
        case 'update':
            await updateAchievementValues();
            break;
        case 'get':
            const type = process.argv[3] || 'voice_hours_total';
            const data = await getAchievementData(type);
            console.table(data.slice(0, 10)); // Show top 10
            break;
        default:
            console.log(`
🎮 Simple Achievements Manager

Usage:
  node simple-achievements.js update              - Update all achievement values
  node simple-achievements.js get [type]          - Get achievement data

Achievement Types:
  - voice_hours_total
  - weather_points_total

Example Website Queries:
  SELECT user_id, value FROM achievements WHERE achievement_type = 'voice_hours_total' ORDER BY value DESC;
  SELECT user_id, value FROM achievements WHERE achievement_type = 'weather_points_total' ORDER BY value DESC;
            `);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { updateAchievementValues, getAchievementData };