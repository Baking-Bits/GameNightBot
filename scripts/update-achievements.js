const mariadb = require('mariadb');

// Database configuration
const config = {
    host: 'homelab-p',
    user: 'GNMC', 
    password: 'MCGamenight!',
    database: 'GameNightDB',
    acquireTimeout: 60000,
    timeout: 60000
};

/**
 * Updates voice hours achievements for all users
 * This can be run periodically to keep achievements up to date
 */
async function updateVoiceHoursAchievements() {
    const pool = mariadb.createPool(config);
    let conn;
    
    try {
        conn = await pool.getConnection();
        console.log('🔗 Connected to database for voice hours update');
        
        // Get current total voice hours for all users
        const voiceData = await conn.query(`
            SELECT 
                user_id,
                guild_id,
                SUM(total_time) as total_seconds,
                ROUND(SUM(total_time) / 3600, 2) as total_hours,
                COUNT(*) as total_records,
                MIN(timestamp) as first_record,
                MAX(timestamp) as last_record
            FROM voice_times 
            GROUP BY user_id, guild_id
            HAVING total_seconds > 0
            ORDER BY total_hours DESC
        `);
        
        console.log(`📊 Processing ${voiceData.length} user-guild combinations...`);
        
        let updatedCount = 0;
        let newCount = 0;
        
        for (const record of voiceData) {
            const result = await conn.query(`
                INSERT INTO achievements (
                    user_id, 
                    guild_id, 
                    achievement_type, 
                    achievement_name,
                    achievement_description,
                    value,
                    value_type,
                    metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    value = VALUES(value),
                    updated_at = CURRENT_TIMESTAMP,
                    metadata = VALUES(metadata)
            `, [
                record.user_id,
                record.guild_id,
                'voice_hours_total',
                'Total Voice Hours',
                `Total time spent in voice channels: ${record.total_hours} hours`,
                record.total_hours,
                'hours',
                JSON.stringify({
                    total_seconds: Number(record.total_seconds),
                    total_records: Number(record.total_records),
                    first_record: Number(record.first_record),
                    last_record: Number(record.last_record),
                    calculated_at: new Date().toISOString()
                })
            ]);
            
            if (result.affectedRows === 1) {
                newCount++;
            } else if (result.affectedRows === 2) {
                updatedCount++;
            }
        }
        
        console.log(`✅ Voice hours achievements updated!`);
        console.log(`📈 New achievements: ${newCount}`);
        console.log(`🔄 Updated achievements: ${updatedCount}`);
        
        // Show current top 5
        const topAchievements = await conn.query(`
            SELECT 
                user_id,
                value as hours,
                updated_at
            FROM achievements 
            WHERE achievement_type = 'voice_hours_total'
            ORDER BY value DESC 
            LIMIT 5
        `);
        
        console.log('\n🏆 Top 5 Voice Hours:');
        topAchievements.forEach((ach, index) => {
            console.log(`${index + 1}. User ${ach.user_id}: ${ach.hours} hours`);
        });
        
    } catch (error) {
        console.error('❌ Error updating voice hours achievements:', error);
        throw error;
    } finally {
        if (conn) conn.release();
        pool.end();
    }
}

/**
 * Gets achievement data for the website
 */
async function getAchievementsForWebsite(achievementType = null, guildId = null) {
    const pool = mariadb.createPool(config);
    let conn;
    
    try {
        conn = await pool.getConnection();
        
        let query = 'SELECT * FROM achievements';
        let params = [];
        let conditions = [];
        
        if (achievementType) {
            conditions.push('achievement_type = ?');
            params.push(achievementType);
        }
        
        if (guildId) {
            conditions.push('guild_id = ?');
            params.push(guildId);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY value DESC';
        
        const results = await conn.query(query, params);
        return results;
        
    } catch (error) {
        console.error('❌ Error getting achievements:', error);
        throw error;
    } finally {
        if (conn) conn.release();
        pool.end();
    }
}

/**
 * Example queries for the website project
 */
async function showExampleQueries() {
    console.log(`
📋 Example SQL queries for your website project:

1. Get all voice hours achievements:
   SELECT * FROM achievements WHERE achievement_type = 'voice_hours_total' ORDER BY value DESC;

2. Get top 10 voice hours for a specific guild:
   SELECT user_id, value as hours, earned_at, updated_at 
   FROM achievements 
   WHERE achievement_type = 'voice_hours_total' AND guild_id = 'YOUR_GUILD_ID' 
   ORDER BY value DESC LIMIT 10;

3. Get all achievements for a specific user:
   SELECT * FROM achievements WHERE user_id = 'USER_ID' ORDER BY value DESC;

4. Get achievement statistics:
   SELECT 
       achievement_type,
       COUNT(*) as total_users,
       MAX(value) as highest_value,
       AVG(value) as average_value,
       MIN(value) as lowest_value
   FROM achievements 
   GROUP BY achievement_type;

5. Get recent achievements (last 24 hours):
   SELECT * FROM achievements 
   WHERE earned_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) 
   ORDER BY earned_at DESC;
    `);
}

// Command line interface
async function main() {
    const command = process.argv[2];
    
    switch (command) {
        case 'update':
            await updateVoiceHoursAchievements();
            break;
        case 'show':
            const type = process.argv[3] || 'voice_hours_total';
            const data = await getAchievementsForWebsite(type);
            console.table(data);
            break;
        case 'examples':
            await showExampleQueries();
            break;
        default:
            console.log(`
🎮 GameNight Bot - Achievements Manager

Usage:
  node update-achievements.js update     - Update all voice hours achievements
  node update-achievements.js show       - Show all achievements  
  node update-achievements.js examples   - Show example SQL queries for website

Examples:
  node update-achievements.js update
  node update-achievements.js show voice_hours_total
            `);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    updateVoiceHoursAchievements,
    getAchievementsForWebsite,
    showExampleQueries
};