const mariadb = require('mariadb');
const path = require('path');

// Database configuration
const config = {
    host: 'homelab-p',
    user: 'GNMC', 
    password: 'MCGamenight!',
    database: 'GameNightDB',
    acquireTimeout: 60000,
    timeout: 60000
};

async function recreateSimpleAchievements() {
    const pool = mariadb.createPool(config);
    let conn;
    
    try {
        conn = await pool.getConnection();
        console.log('🔗 Connected to MariaDB');
        
        // Read and execute the simplified SQL
        const fs = require('fs');
        const sqlFile = path.join(__dirname, 'create-simple-achievements.sql');
        const sqlContent = fs.readFileSync(sqlFile, 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = sqlContent.split(';').filter(stmt => stmt.trim().length > 0);
        
        for (const statement of statements) {
            if (statement.trim()) {
                await conn.query(statement);
                console.log('✅ Executed SQL statement');
            }
        }
        
        console.log('🎉 Simplified achievements table created!');
        
        // Show new structure
        const structure = await conn.query("DESCRIBE achievements");
        console.log('\n📋 Simplified table structure:');
        console.table(structure);
        
    } catch (error) {
        console.error('❌ Error recreating table:', error);
        throw error;
    } finally {
        if (conn) conn.release();
        pool.end();
    }
}

async function populateSimpleAchievements() {
    const pool = mariadb.createPool(config);
    let conn;
    
    try {
        conn = await pool.getConnection();
        console.log('\n🔗 Populating simplified achievements...');
        
        // Get voice hours data
        const voiceData = await conn.query(`
            SELECT 
                user_id,
                guild_id,
                ROUND(SUM(total_time) / 3600, 2) as total_hours
            FROM voice_times 
            GROUP BY user_id, guild_id
            HAVING total_hours > 0
            ORDER BY total_hours DESC
        `);
        
        console.log(`📊 Processing ${voiceData.length} users...`);
        
        // Insert simple voice hours achievements
        for (const record of voiceData) {
            await conn.query(`
                INSERT INTO achievements (user_id, guild_id, achievement_type, value)
                VALUES (?, ?, 'voice_hours_total', ?)
                ON DUPLICATE KEY UPDATE 
                    value = VALUES(value),
                    updated_at = CURRENT_TIMESTAMP
            `, [record.user_id, record.guild_id, record.total_hours]);
        }
        
        console.log('✅ Voice hours populated!');
        
        // Add weather points achievements
        const weatherData = await conn.query(`
            SELECT 
                user_id,
                '1083955208360562740' as guild_id,
                SUM(total_points) as total_points
            FROM daily_weather_points 
            GROUP BY user_id
            HAVING total_points > 0
            ORDER BY total_points DESC
        `);
        
        console.log(`🌤️ Processing ${weatherData.length} weather users...`);
        
        for (const record of weatherData) {
            await conn.query(`
                INSERT INTO achievements (user_id, guild_id, achievement_type, value)
                VALUES (?, ?, 'weather_points_total', ?)
                ON DUPLICATE KEY UPDATE 
                    value = VALUES(value),
                    updated_at = CURRENT_TIMESTAMP
            `, [record.user_id, record.guild_id, record.total_points]);
        }
        
        console.log('✅ Weather points populated!');
        
        // Show summary
        const summary = await conn.query(`
            SELECT 
                achievement_type,
                COUNT(*) as user_count,
                MAX(value) as highest_value,
                AVG(value) as average_value
            FROM achievements 
            GROUP BY achievement_type
        `);
        
        console.log('\n📊 Achievement Summary:');
        console.table(summary);
        
        // Show top achievements
        const top = await conn.query(`
            SELECT user_id, achievement_type, value, updated_at
            FROM achievements 
            ORDER BY value DESC 
            LIMIT 10
        `);
        
        console.log('\n🏆 Top 10 Achievement Values:');
        console.table(top);
        
    } catch (error) {
        console.error('❌ Error populating achievements:', error);
        throw error;
    } finally {
        if (conn) conn.release();
        pool.end();
    }
}

async function main() {
    try {
        console.log('🚀 Creating simplified achievements table...\n');
        
        // Recreate table with simple structure
        await recreateSimpleAchievements();
        
        // Populate with current data
        await populateSimpleAchievements();
        
        console.log('\n✅ Done! Simple achievements table ready for website.');
        console.log('\n📝 Website can now query:');
        console.log('   SELECT user_id, value FROM achievements WHERE achievement_type = "voice_hours_total"');
        console.log('   SELECT user_id, value FROM achievements WHERE achievement_type = "weather_points_total"');
        
    } catch (error) {
        console.error('💥 Setup failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { recreateSimpleAchievements, populateSimpleAchievements };