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

async function enhanceWeatherHistoryTable() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('🔧 Enhancing weather_history table for hourly point tracking...\n');
        
        // Add new columns to weather_history table
        console.log('📊 Adding points column...');
        try {
            await conn.query(`
                ALTER TABLE weather_history 
                ADD COLUMN points INT DEFAULT 0 AFTER wind_speed
            `);
            console.log('✅ Added points column');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️  Points column already exists');
            } else {
                throw error;
            }
        }
        
        console.log('📋 Adding points_breakdown column...');
        try {
            await conn.query(`
                ALTER TABLE weather_history 
                ADD COLUMN points_breakdown JSON AFTER points
            `);
            console.log('✅ Added points_breakdown column');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️  Points_breakdown column already exists');
            } else {
                throw error;
            }
        }
        
        console.log('🔄 Adding calculated_at column for tracking point calculations...');
        try {
            await conn.query(`
                ALTER TABLE weather_history 
                ADD COLUMN calculated_at TIMESTAMP NULL AFTER points_breakdown
            `);
            console.log('✅ Added calculated_at column');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️  Calculated_at column already exists');
            } else {
                throw error;
            }
        }
        
        // Add index for efficient point queries
        console.log('📈 Adding performance indexes...');
        try {
            await conn.query(`
                ALTER TABLE weather_history 
                ADD INDEX idx_user_points (user_id, points),
                ADD INDEX idx_calculated_at (calculated_at)
            `);
            console.log('✅ Added performance indexes');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  Indexes already exist');
            } else {
                throw error;
            }
        }
        
        // Check the updated table structure
        console.log('\n📋 Updated weather_history table structure:');
        const tableSchema = await conn.query(`DESCRIBE weather_history`);
        console.table(tableSchema);
        
        console.log('\n✅ Weather history table enhancement completed!');
        console.log('🎯 The table now supports hourly point tracking with:');
        console.log('   • points: Calculated points for each weather check');
        console.log('   • points_breakdown: Detailed JSON of how points were earned');
        console.log('   • calculated_at: Timestamp when points were calculated');
        console.log('   • Performance indexes for efficient queries');
        
    } catch (error) {
        console.error('❌ Error enhancing weather_history table:', error);
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

enhanceWeatherHistoryTable();