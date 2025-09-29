const { pool } = require('./src/database');

async function checkStephenRegistration() {
    try {
        const stephenUserId = '1225795652924084244';
        console.log(`=== Checking Stephen's Registration Status ===`);
        
        // Check if we can execute basic queries
        console.log('Testing basic query...');
        const result = await pool.execute('SELECT 1 as test');
        console.log('Basic query works:', result);
        
        // Check what tables exist
        console.log('\n=== Available Tables ===');
        const tables = await pool.execute('SHOW TABLES');
        console.log('Tables query result:', tables);
        
        // If we can see the weather_history table structure
        console.log('\n=== Weather History Table ===');
        const structure = await pool.execute('DESCRIBE weather_history');
        console.log('Weather table structure:', structure[0]);
        
        // Count total weather entries
        console.log('\n=== Total Weather Entries ===');
        const countResult = await pool.execute('SELECT COUNT(*) as total FROM weather_history');
        console.log('Total entries:', countResult[0]);
        
        // Check for any weather entries for Stephen
        console.log('\n=== Stephen Weather Check ===');
        const stephenResult = await pool.execute('SELECT COUNT(*) as count FROM weather_history WHERE user_id = ?', [stephenUserId]);
        console.log('Stephen entries:', stephenResult[0]);
        
        // Get sample of recent weather data
        console.log('\n=== Sample Weather Data ===');
        const sampleResult = await pool.execute('SELECT user_id, timestamp, temperature FROM weather_history ORDER BY timestamp DESC LIMIT 3');
        console.log('Sample entries:', sampleResult[0]);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkStephenRegistration();