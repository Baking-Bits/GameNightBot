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

async function createAchievementsTable() {
    const pool = mariadb.createPool(config);
    let conn;
    
    try {
        conn = await pool.getConnection();
        console.log('🔗 Connected to MariaDB');
        
        // Read and execute the SQL file
        const fs = require('fs');
        const sqlFile = path.join(__dirname, 'create-achievements-table.sql');
        const sqlContent = fs.readFileSync(sqlFile, 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = sqlContent.split(';').filter(stmt => stmt.trim().length > 0);
        
        for (const statement of statements) {
            if (statement.trim()) {
                await conn.query(statement);
                console.log('✅ Executed SQL statement');
            }
        }
        
        console.log('🎉 Achievements table created successfully!');
        
        // Verify table was created
        const tables = await conn.query("SHOW TABLES LIKE 'achievements'");
        if (tables.length > 0) {
            console.log('✅ Table verification: achievements table exists');
            
            // Show table structure
            const structure = await conn.query("DESCRIBE achievements");
            console.log('\n📋 Table structure:');
            console.table(structure);
        }
        
    } catch (error) {
        console.error('❌ Error creating achievements table:', error);
        throw error;
    } finally {
        if (conn) conn.release();
        pool.end();
    }
}

async function populateVoiceHoursAchievements() {
    const pool = mariadb.createPool(config);
    let conn;
    
    try {
        conn = await pool.getConnection();
        console.log('\n🔗 Connected to populate voice hours achievements');
        
        // Get total voice hours for all users across all guilds
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
        
        console.log(`\n📊 Found voice data for ${voiceData.length} user-guild combinations`);
        
        // Insert achievements for each user
        let insertedCount = 0;
        let updatedCount = 0;
        
        for (const record of voiceData) {
            try {
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
                    insertedCount++;
                } else if (result.affectedRows === 2) {
                    updatedCount++;
                }
                
                console.log(`✅ User ${record.user_id}: ${record.total_hours} hours`);
                
            } catch (error) {
                console.error(`❌ Error processing user ${record.user_id}:`, error.message);
            }
        }
        
        console.log(`\n🎉 Achievements populated successfully!`);
        console.log(`📈 Inserted: ${insertedCount} new achievements`);
        console.log(`🔄 Updated: ${updatedCount} existing achievements`);
        
        // Show top achievements
        const topAchievements = await conn.query(`
            SELECT 
                user_id,
                value as hours,
                earned_at,
                updated_at
            FROM achievements 
            WHERE achievement_type = 'voice_hours_total'
            ORDER BY value DESC 
            LIMIT 10
        `);
        
        console.log('\n🏆 Top 10 Voice Hours Achievements:');
        console.table(topAchievements);
        
    } catch (error) {
        console.error('❌ Error populating voice hours achievements:', error);
        throw error;
    } finally {
        if (conn) conn.release();
        pool.end();
    }
}

async function main() {
    try {
        console.log('🚀 Starting achievements table setup...\n');
        
        // Step 1: Create the table
        await createAchievementsTable();
        
        // Step 2: Populate with voice hours data
        await populateVoiceHoursAchievements();
        
        console.log('\n✅ All done! Achievements table is ready for the website project.');
        
    } catch (error) {
        console.error('💥 Setup failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    createAchievementsTable,
    populateVoiceHoursAchievements
};