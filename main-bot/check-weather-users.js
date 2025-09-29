const { pool } = require('./src/database');

async function checkWeatherUsers() {
    try {
        const stephenUserId = '1225795652924084244';
        console.log(`=== Checking Weather Users Table ===`);
        
        // Check weather_users table structure
        console.log('\n=== Weather Users Table Structure ===');
        const structure = await pool.execute('DESCRIBE weather_users');
        console.log('Structure:', structure[0]);
        
        // Count total users in weather system
        const totalUsers = await pool.execute('SELECT COUNT(*) as total FROM weather_users');
        console.log(`\nTotal users in weather system: ${totalUsers[0][0].total}`);
        
        // Check if Stephen is registered
        const stephenCheck = await pool.execute('SELECT * FROM weather_users WHERE user_id = ?', [stephenUserId]);
        console.log(`\nStephen registration:`, stephenCheck[0]);
        
        // Get sample of registered users
        const sampleUsers = await pool.execute('SELECT user_id, postal_code, country, weather_enabled FROM weather_users LIMIT 5');
        console.log(`\nSample registered users:`, sampleUsers[0]);
        
        // Check recent weather history users
        const recentWeatherUsers = await pool.execute(`
            SELECT DISTINCT user_id, COUNT(*) as entries 
            FROM weather_history 
            WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY user_id 
            ORDER BY entries DESC 
            LIMIT 5
        `);
        console.log(`\nUsers with recent weather data:`, recentWeatherUsers[0]);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkWeatherUsers();