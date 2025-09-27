const path = require('path');
const fs = require('fs').promises;
const { initializeWeatherDatabase, addWeatherUser, updateShittyWeatherScore, addWeatherHistory } = require('../main-bot/src/database/weather');

async function migrateWeatherData() {
    console.log('[MIGRATION] Starting weather data migration from JSON to database...');
    
    try {
        // Initialize the weather database first
        await initializeWeatherDatabase();
        
        // Read existing JSON data
        const weatherDataPath = path.join(__dirname, '..', 'services/data/weatherData.json');
        const weatherDataStr = await fs.readFile(weatherDataPath, 'utf8');
        const weatherData = JSON.parse(weatherDataStr);
        
        console.log(`[MIGRATION] Found ${Object.keys(weatherData.users || {}).length} users to migrate`);
        
        // Migrate users
        if (weatherData.users) {
            for (const [userId, userData] of Object.entries(weatherData.users)) {
                try {
                    // Convert JSON user data to database format
                    const dbUserData = {
                        user_id: userId,
                        discord_user_id: userId, // Same as user_id for existing users
                        display_name: userData.displayName || `User-${userId.slice(-4)}`,
                        postal_code: userData.postalCode || '00000',
                        city: userData.city || 'Unknown',
                        country: userData.country || null,
                        region: userData.region || 'Unknown',
                        admin_added: userData.adminAdded || false,
                        added_by: userData.addedBy || null,
                        country_code: userData.countryCode || null
                    };
                    
                    await addWeatherUser(dbUserData);
                    console.log(`[MIGRATION] Migrated user: ${dbUserData.display_name} (${userId})`);
                } catch (error) {
                    console.error(`[MIGRATION] Error migrating user ${userId}:`, error);
                }
            }
        }
        
        // Migrate shitty weather scores
        if (weatherData.shittyWeatherScores && Array.isArray(weatherData.shittyWeatherScores)) {
            console.log(`[MIGRATION] Migrating ${weatherData.shittyWeatherScores.length} shitty weather scores...`);
            
            for (const scoreEntry of weatherData.shittyWeatherScores) {
                try {
                    if (scoreEntry.userId && typeof scoreEntry.totalPoints === 'number') {
                        // Set the total points directly (not adding to existing)
                        await updateShittyWeatherScore(scoreEntry.userId, scoreEntry.totalPoints);
                        console.log(`[MIGRATION] Migrated score for ${scoreEntry.userId}: ${scoreEntry.totalPoints} points`);
                    }
                } catch (error) {
                    console.error(`[MIGRATION] Error migrating score for ${scoreEntry.userId}:`, error);
                }
            }
        }
        
        // Migrate weather history
        if (weatherData.weatherHistory && Array.isArray(weatherData.weatherHistory)) {
            console.log(`[MIGRATION] Migrating ${weatherData.weatherHistory.length} weather history entries...`);
            
            let migratedHistory = 0;
            for (const historyEntry of weatherData.weatherHistory) {
                try {
                    if (historyEntry.userId && historyEntry.weather) {
                        const weatherHistoryData = {
                            temperature: historyEntry.weather.main?.temp || null,
                            feels_like: historyEntry.weather.main?.feels_like || null,
                            humidity: historyEntry.weather.main?.humidity || null,
                            wind_speed: historyEntry.weather.wind?.speed || null,
                            weather_main: historyEntry.weather.weather?.[0]?.main || null,
                            weather_description: historyEntry.weather.weather?.[0]?.description || null,
                            city: historyEntry.weather.name || null,
                            country: historyEntry.weather.sys?.country || null
                        };
                        
                        await addWeatherHistory(historyEntry.userId, weatherHistoryData);
                        migratedHistory++;
                        
                        if (migratedHistory % 100 === 0) {
                            console.log(`[MIGRATION] Migrated ${migratedHistory} history entries...`);
                        }
                    }
                } catch (error) {
                    console.error(`[MIGRATION] Error migrating history entry:`, error);
                }
            }
            
            console.log(`[MIGRATION] Successfully migrated ${migratedHistory} weather history entries`);
        }
        
        console.log('[MIGRATION] Weather data migration completed successfully!');
        console.log('[MIGRATION] You can now safely remove the JSON backup system');
        
        // Create backup of original JSON file
        const backupPath = path.join(__dirname, '..', 'services/data/weatherData.json.pre-migration-backup');
        await fs.copyFile(weatherDataPath, backupPath);
        console.log(`[MIGRATION] Created backup of original JSON file at: ${backupPath}`);
        
    } catch (error) {
        console.error('[MIGRATION] Error during migration:', error);
        throw error;
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    migrateWeatherData()
        .then(() => {
            console.log('[MIGRATION] Migration completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('[MIGRATION] Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateWeatherData };
