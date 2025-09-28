const weatherSystem = require('../services/shared/features/databaseWeatherSystem');

async function triggerWeatherUpdate() {
    try {
        console.log('[TRIGGER] Manually triggering weather points award...');
        
        // Trigger the weather points award system
        await weatherSystem.awardShittyWeatherPoints();
        
        console.log('[TRIGGER] Weather points awarded successfully!');
        
        // Now test the new functions
        console.log('\n[TRIGGER] Testing new fair competition functions...');
        
        const bestSingleDay = await weatherSystem.getBestSingleDay();
        console.log('Best single day results:', bestSingleDay ? bestSingleDay.length : 'null');
        
        const weeklyAverages = await weatherSystem.getTopWeeklyAverages();
        console.log('Weekly averages results:', weeklyAverages ? weeklyAverages.length : 'null');
        
    } catch (error) {
        console.error('[TRIGGER] Error:', error);
        console.error(error.stack);
    }
    
    process.exit(0);
}

triggerWeatherUpdate();