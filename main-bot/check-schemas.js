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

async function checkTableSchemas() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('🔍 Checking weather database table schemas...\n');
        
        // Check weather_users table
        console.log('=== WEATHER_USERS TABLE SCHEMA ===');
        const weatherUsersSchema = await conn.query(`DESCRIBE weather_users`);
        console.table(weatherUsersSchema);
        
        // Check daily_weather_points table
        console.log('\n=== DAILY_WEATHER_POINTS TABLE SCHEMA ===');
        const dailyPointsSchema = await conn.query(`DESCRIBE daily_weather_points`);
        console.table(dailyPointsSchema);
        
        // Check weather_history table
        console.log('\n=== WEATHER_HISTORY TABLE SCHEMA ===');
        const weatherHistorySchema = await conn.query(`DESCRIBE weather_history`);
        console.table(weatherHistorySchema);
        
        // Check if there are any weather tables
        console.log('\n=== ALL WEATHER RELATED TABLES ===');
        const weatherTables = await conn.query(`
            SHOW TABLES LIKE '%weather%'
        `);
        console.table(weatherTables);
        
    } catch (error) {
        console.error('Error checking schemas:', error);
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

checkTableSchemas();