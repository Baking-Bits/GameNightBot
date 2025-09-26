// Data validation and analysis utility
const fs = require('fs').promises;
const path = require('path');

async function analyzeWeatherData() {
    try {
        const dataPath = path.join(__dirname, '../../data/weatherData.json');
        const data = JSON.parse(await fs.readFile(dataPath, 'utf8'));
        
        console.log('=== WEATHER DATA ANALYSIS ===');
        
        const users = data.users || {};
        const scores = data.shittyWeatherScores || {};
        const history = data.shittyWeatherHistory || [];
        
        // Analyze users
        const totalUsers = Object.keys(users).length;
        const activeUsers = Object.values(users).filter(u => u.isActive).length;
        
        // Identify real vs test users
        const realUsers = {};
        const testUsers = {};
        
        Object.entries(users).forEach(([id, user]) => {
            const isTestUser = 
                id.includes('test') || 
                id.includes('debug') || 
                id.includes('mock') ||
                user.displayName?.toLowerCase().includes('test') ||
                user.displayName?.toLowerCase().includes('debug');
                
            if (isTestUser) {
                testUsers[id] = user;
            } else {
                realUsers[id] = user;
            }
        });
        
        console.log(`Total users: ${totalUsers}`);
        console.log(`Active users: ${activeUsers}`);
        console.log(`Real users: ${Object.keys(realUsers).length}`);
        console.log(`Test users: ${Object.keys(testUsers).length}`);
        
        if (Object.keys(realUsers).length > 0) {
            console.log('\n=== REAL USERS DETECTED ===');
            Object.entries(realUsers).forEach(([id, user]) => {
                console.log(`  ${user.displayName}: ${user.region} (${user.postalCode})`);
                console.log(`    Active: ${user.isActive}, Joined: ${user.joinedAt || 'unknown'}`);
                console.log(`    Score: ${scores[id] || 0} points`);
            });
            
            console.log('\n🚨 WARNING: Real user data detected!');
            console.log('   - Do not clear this data without backing up first');
            console.log('   - Use /databackup create before making changes');
            console.log('   - Consider the impact on active users');
        }
        
        if (Object.keys(testUsers).length > 0) {
            console.log('\n=== TEST USERS DETECTED ===');
            Object.entries(testUsers).forEach(([id, user]) => {
                console.log(`  ${user.displayName}: ${user.region || 'unknown'}`);
            });
            
            console.log('\n💡 Test users can be safely removed if needed');
        }
        
        // Analyze data value
        const hasHistory = history.length > 0;
        const hasScores = Object.keys(scores).length > 0;
        const hasLightning = (data.lightningHistory || []).length > 0;
        
        console.log('\n=== DATA VALUE ASSESSMENT ===');
        console.log(`Weather history entries: ${history.length}`);
        console.log(`Users with scores: ${Object.keys(scores).length}`);
        console.log(`Lightning events: ${(data.lightningHistory || []).length}`);
        
        const isValuableData = 
            Object.keys(realUsers).length > 0 || 
            hasHistory || 
            hasScores || 
            hasLightning;
            
        if (isValuableData) {
            console.log('🔒 STATUS: VALUABLE DATA - PROTECT FROM DELETION');
        } else {
            console.log('✅ STATUS: Safe to reset (no valuable data detected)');
        }
        
    } catch (error) {
        console.error('Error analyzing weather data:', error);
    }
}

async function validateAllData() {
    console.log('=== COMPREHENSIVE DATA VALIDATION ===\n');
    
    const dataFiles = [
        'weatherData.json',
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
            
            if (filename === 'weatherData.json') {
                const users = Object.keys(data.users || {}).length;
                const scores = Object.keys(data.shittyWeatherScores || {}).length;
                console.log(`   Users: ${users}, Scores: ${scores}`);
            } else {
                const entries = data.meals || data.workouts || data.snacks || [];
                console.log(`   Entries: ${entries.length}`);
            }
            
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
