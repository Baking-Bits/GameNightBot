// Data validation and analysis utility
const fs = require('fs').promises;
const path = require('path');

async function analyzeWeatherData() {
    console.log('=== WEATHER DATA ANALYSIS ===');
    console.log('Weather system now uses database - use database queries for analysis');
    console.log('Weather data is stored in MariaDB tables: weather_users, weather_history, shitty_weather_scores');
    return;
}

async function validateAllData() {
    console.log('=== COMPREHENSIVE DATA VALIDATION ===\n');
    
    const dataFiles = [
        'mealHistory.json', 
        'workoutHistory.json',
        'snackHistory.json'
    ];
    
    for (const filename of dataFiles) {
        try {
            const filePath = path.join(__dirname, '../../data', filename);
            await fs.access(filePath);
            
            const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
            console.log(`📁 ${filename}:`);
            
            const entries = data.meals || data.workouts || data.snacks || [];
            console.log(`   Entries: ${entries.length}`);
            
        } catch (error) {
            console.log(`❌ ${filename}: Not found or invalid`);
        }
    }
}

// Export functions for use in other modules
module.exports = {
    analyzeWeatherData,
    validateAllData
};

// Run analysis if called directly
if (require.main === module) {
    analyzeWeatherData().then(() => {
        console.log('\n');
        return validateAllData();
    });
}
