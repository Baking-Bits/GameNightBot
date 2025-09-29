const {
    addWeatherUser,
    getWeatherUser,
    getAllActiveWeatherUsers,
    removeWeatherUser,
    addWeatherHistory,
    getShittyWeatherLeaderboard,
    updateShittyWeatherScore,
    addShittyWeatherAward,
    updateApiUsage,
    getApiUsage,
    addDailyPoints,
    getBestSingleDay,
    getTopWeeklyAverages,
    getWeeklyResults
} = require('../../../main-bot/src/database/weather');

class DatabaseWeatherSystem {
    constructor() {
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            // Database connection is handled by the pool
            this.initialized = true;
            console.log('[WEATHER DB] Database weather system initialized');
        } catch (error) {
            console.error('[WEATHER DB] Failed to initialize:', error);
            throw error;
        }
    }

    async addUser(userData) {
        await this.initialize();
        
        try {
            const dbUserData = {
                user_id: userData.userId,
                discord_user_id: userData.discordUserId || userData.userId,
                display_name: userData.displayName,
                postal_code: userData.postalCode,
                city: userData.city,
                country: userData.country,
                region: userData.region,
                admin_added: userData.adminAdded || false,
                added_by: userData.addedBy || null,
                country_code: userData.countryCode || null
            };
            
            await addWeatherUser(dbUserData);
            return { success: true, message: 'User added successfully' };
        } catch (error) {
            console.error('[WEATHER DB] Error adding user:', error);
            throw error;
        }
    }

    async getUser(userId) {
        await this.initialize();
        return await getWeatherUser(userId);
    }

    async getAllUsers() {
        await this.initialize();
        const users = await getAllActiveWeatherUsers();
        
        // Convert database format to expected format
        const formattedUsers = {};
        for (const user of users) {
            formattedUsers[user.user_id] = {
                displayName: user.display_name,
                postalCode: user.postal_code,
                city: user.city,
                country: user.country,
                region: user.region,
                adminAdded: user.admin_added,
                addedBy: user.added_by,
                countryCode: user.country_code,
                joinedAt: user.joined_at,
                lastWeatherCheck: user.last_weather_check,
                isActive: user.is_active
            };
        }
        
        return formattedUsers;
    }

    async removeUser(userId) {
        await this.initialize();
        const success = await removeWeatherUser(userId);
        return { success, message: success ? 'User removed successfully' : 'User not found' };
    }

    async addWeatherDataToHistory(userId, weatherData) {
        await this.initialize();
        
        try {
            // Import the point calculator
            const { calculateWeatherPoints } = require('../utils/weatherPointCalculator');
            
            // Calculate points for this weather check
            const pointData = calculateWeatherPoints(weatherData);
            
            // Prepare weather history data
            const historyData = {
                temperature: weatherData.main?.temp,
                feels_like: weatherData.main?.feels_like,
                humidity: weatherData.main?.humidity,
                wind_speed: weatherData.wind?.speed,
                weather_main: weatherData.weather?.[0]?.main,
                weather_description: weatherData.weather?.[0]?.description,
                city: weatherData.name,
                country: weatherData.sys?.country
            };
            
            // Use the enhanced function to store both weather data and points
            const { addWeatherHistoryWithPoints } = require('../../../main-bot/src/database/weather');
            await addWeatherHistoryWithPoints(userId, historyData, pointData);
            
            // If points were earned, also update the total score
            if (pointData.points > 0) {
                console.log(`[WEATHER DB] User ${userId} earned ${pointData.points} points: ${pointData.summary}`);
                await this.updateShittyWeatherScore(userId, pointData.points, {
                    weather: pointData.summary,
                    temperature: weatherData.main?.temp,
                    windSpeed: weatherData.wind?.speed,
                    humidity: weatherData.main?.humidity,
                    breakdown: pointData.breakdown,
                    timestamp: new Date()
                });
            }
            
            return { success: true, pointsEarned: pointData.points, breakdown: pointData.breakdown };
        } catch (error) {
            console.error('[WEATHER DB] Error adding weather history:', error);
            throw error;
        }
    }

    async getShittyWeatherLeaderboard(limit = 50) {
        await this.initialize();
        
        try {
            console.log('[WEATHER DB] Getting leaderboard...');
            const { pool } = require('../../../main-bot/src/database/connection');
            
            // Get all active users with their shitty weather scores
            const leaderboard = await pool.query(`
                SELECT 
                    wu.user_id,
                    wu.display_name,
                    wu.region,
                    wu.joined_at,
                    COALESCE(sws.total_points, 0) as total_points,
                    wu.is_active
                FROM weather_users wu
                LEFT JOIN shitty_weather_scores sws ON wu.user_id = sws.user_id
                WHERE wu.is_active = TRUE
                ORDER BY total_points DESC, wu.display_name ASC
                LIMIT ?
            `, [limit]);
            
            console.log(`[WEATHER DB] Leaderboard query returned ${leaderboard.length} results`);
            
            // Convert to expected format with better null handling
            return leaderboard.map(entry => {
                console.log(`[WEATHER DB] Processing entry:`, entry);
                return {
                    userId: entry.user_id,
                    displayName: entry.display_name || `User-${String(entry.user_id).slice(-4)}`,
                    region: entry.region || 'Unknown Region',
                    joinedAt: entry.joined_at,
                    totalPoints: parseInt(entry.total_points) || 0,
                    isActive: Boolean(entry.is_active)
                };
            });
        } catch (error) {
            console.error('[WEATHER DB] Error getting leaderboard:', error);
            return []; // Return empty array instead of throwing
        }
    }

    async updateShittyWeatherScore(userId, pointsToAdd, awardData = null) {
        await this.initialize();
        
        try {
            // Update the score
            await updateShittyWeatherScore(userId, pointsToAdd);
            
            // Add award record if provided
            if (awardData) {
                const dbAwardData = {
                    user_id: userId,
                    score: awardData.score || 0,
                    points_awarded: pointsToAdd,
                    temperature: awardData.temperature,
                    weather_description: awardData.weatherDescription,
                    wind_speed: awardData.windSpeed,
                    humidity: awardData.humidity,
                    breakdown: awardData.breakdown || {}
                };
                
                await addShittyWeatherAward(dbAwardData);
            }
            
            return { success: true };
        } catch (error) {
            console.error('[WEATHER DB] Error updating shitty weather score:', error);
            throw error;
        }
    }

    async updateApiUsage() {
        await this.initialize();
        await updateApiUsage();
    }

    async getApiUsage(date = new Date()) {
        await this.initialize();
        return await getApiUsage(date);
    }

    // Utility method to check if user exists
    async userExists(userId) {
        await this.initialize();
        const user = await getWeatherUser(userId);
        return user !== null;
    }

    // Get user count
    async getUserCount() {
        await this.initialize();
        const users = await getAllActiveWeatherUsers();
        return users.length;
    }

    // Method to get recent weather history for a user
    async getUserWeatherHistory(userId, limit = 10) {
        await this.initialize();
        
        try {
            const { pool } = require('../../../main-bot/src/database/connection');
            const result = await pool.query(`
                SELECT * FROM weather_history 
                WHERE user_id = ? 
                ORDER BY timestamp DESC 
                LIMIT ?
            `, [userId, limit]);
            
            return result;
        } catch (error) {
            console.error('[WEATHER DB] Error getting user weather history:', error);
            throw error;
        }
    }

    // Check all users weather and update database
    async checkAllUsersWeather() {
        await this.initialize();
        
        try {
            const users = await getAllActiveWeatherUsers();
            console.log(`[WEATHER DB] Checking weather for ${users.length} users...`);
            
            let totalUpdates = 0;
            let totalAlerts = 0;
            
            for (const user of users) {
                try {
                    // Import weather adapter to fetch weather
                    const WeatherSystemAdapter = require('./weatherSystemAdapter');
                    
                    console.log(`[WEATHER DB] Checking weather for ${user.display_name} (${user.postal_code})`);
                    
                    const weatherData = await WeatherSystemAdapter.fetchWeatherByPostalCode(
                        user.postal_code, 
                        user.country_code || 'US'
                    );
                    
                    if (weatherData) {
                        // Add to history
                        await this.addWeatherDataToHistory(user.user_id, weatherData);
                        totalUpdates++;
                        
                        console.log(`[WEATHER DB] Weather updated for ${user.display_name}: ${Math.round(weatherData.main.temp)}°F`);
                        
                        // Update API usage
                        await this.updateApiUsage();
                        
                        // Update last check time
                        const { pool } = require('../../../main-bot/src/database/connection');
                        await pool.query(`
                            UPDATE weather_users 
                            SET last_weather_check = CURRENT_TIMESTAMP 
                            WHERE user_id = ?
                        `, [user.user_id]);
                    } else {
                        console.warn(`[WEATHER DB] No weather data received for ${user.display_name}`);
                    }
                } catch (error) {
                    console.error(`[WEATHER DB] Error checking weather for ${user.user_id}:`, error);
                }
            }
            
            console.log(`[WEATHER DB] Weather check completed: ${totalUpdates} updates, ${totalAlerts} alerts`);
            
            return {
                totalUpdates,
                totalAlerts,
                summary: `Checked ${users.length} users, ${totalUpdates} successful updates`
            };
        } catch (error) {
            console.error('[WEATHER DB] Error in checkAllUsersWeather:', error);
            throw error;
        }
    }

    // Award shitty weather points
    async awardShittyWeatherPoints() {
        await this.initialize();
        
        try {
            console.log('[WEATHER DB] Awarding shitty weather points...');
            
            // Get all active users
            const users = await getAllActiveWeatherUsers();
            let totalPointsAwarded = 0;
            let usersProcessed = 0;
            
            for (const user of users) {
                try {
                    // Import weather adapter to fetch current weather
                    const WeatherSystemAdapter = require('./weatherSystemAdapter');
                    const weatherData = await WeatherSystemAdapter.fetchWeatherByPostalCode(
                        user.postal_code, 
                        user.country_code || 'US'
                    );
                    
                    if (weatherData) {
                        // Calculate shitty weather points based on conditions
                        let points = 0;
                        const temp = weatherData.main?.temp || 70;
                        const humidity = weatherData.main?.humidity || 50;
                        const windSpeed = weatherData.wind?.speed || 0;
                        const condition = weatherData.weather?.[0]?.main?.toLowerCase() || '';
                        const description = weatherData.weather?.[0]?.description || '';
                        
                        // Temperature-based points
                        if (temp > 95) points += 3; // Very hot
                        else if (temp > 85) points += 1; // Hot
                        else if (temp < 20) points += 3; // Very cold
                        else if (temp < 32) points += 2; // Freezing
                        else if (temp < 40) points += 1; // Cold
                        
                        // Precipitation-based points
                        if (condition.includes('thunderstorm')) points += 4;
                        else if (condition.includes('snow')) points += 3;
                        else if (condition.includes('rain')) points += 2;
                        else if (condition.includes('drizzle')) points += 1;
                        
                        // Wind-based points
                        if (windSpeed > 25) points += 3; // High winds
                        else if (windSpeed > 15) points += 1; // Moderate winds
                        
                        // Humidity-based points (very high or very low)
                        if (humidity > 85) points += 1; // Muggy
                        else if (humidity < 20) points += 1; // Dry
                        
                        // Special conditions
                        if (description.includes('fog') || description.includes('mist')) points += 1;
                        if (description.includes('tornado')) points += 10; // Extreme
                        if (description.includes('hurricane')) points += 8; // Very extreme
                        if (description.includes('blizzard')) points += 5; // Severe snow
                        
                        // Create detailed breakdown of points
                        const pointsBreakdown = {};
                        let weatherSummary = description;
                        
                        // Temperature breakdown
                        if (temp > 95) { pointsBreakdown.extreme_heat = 3; weatherSummary += ` (${Math.round(temp)}°F)`; }
                        else if (temp > 85) { pointsBreakdown.hot = 1; weatherSummary += ` (${Math.round(temp)}°F)`; }
                        else if (temp < 20) { pointsBreakdown.extreme_cold = 3; weatherSummary += ` (${Math.round(temp)}°F)`; }
                        else if (temp < 32) { pointsBreakdown.freezing = 2; weatherSummary += ` (${Math.round(temp)}°F)`; }
                        else if (temp < 40) { pointsBreakdown.cold = 1; weatherSummary += ` (${Math.round(temp)}°F)`; }
                        
                        // Weather condition breakdown
                        if (condition.includes('thunderstorm')) pointsBreakdown.thunderstorm = 4;
                        else if (condition.includes('snow')) pointsBreakdown.snow = 3;
                        else if (condition.includes('rain')) pointsBreakdown.rain = 2;
                        else if (condition.includes('drizzle')) pointsBreakdown.drizzle = 1;
                        
                        // Wind breakdown
                        if (windSpeed > 25) { pointsBreakdown.high_winds = 3; weatherSummary += ` (${Math.round(windSpeed)}mph winds)`; }
                        else if (windSpeed > 15) { pointsBreakdown.moderate_winds = 1; }
                        
                        // Humidity breakdown
                        if (humidity > 85) { pointsBreakdown.high_humidity = 1; weatherSummary += ` (${humidity}% humidity)`; }
                        else if (humidity < 20) { pointsBreakdown.low_humidity = 1; weatherSummary += ` (${humidity}% humidity)`; }
                        
                        // Special conditions
                        if (description.includes('fog') || description.includes('mist')) pointsBreakdown.poor_visibility = 1;
                        if (description.includes('tornado')) pointsBreakdown.tornado = 10;
                        if (description.includes('hurricane')) pointsBreakdown.hurricane = 8;
                        if (description.includes('blizzard')) pointsBreakdown.blizzard = 5;
                        
                        // Award points if any earned
                        if (points > 0) {
                            console.log(`[WEATHER DB] Awarding ${points} points to ${user.display_name} for conditions: ${description}`);
                            
                            // Update total score
                            await this.updateShittyWeatherScore(user.user_id, points, {
                                weather: description,
                                temperature: temp,
                                windSpeed: windSpeed,
                                humidity: humidity,
                                timestamp: new Date()
                            });
                            
                            // Track daily breakdown
                            await addDailyPoints(user.user_id, points, pointsBreakdown, weatherSummary);
                            
                            totalPointsAwarded += points;
                        }
                        
                        usersProcessed++;
                    }
                } catch (userError) {
                    console.error(`[WEATHER DB] Error processing user ${user.user_id}:`, userError);
                }
            }
            
            console.log(`[WEATHER DB] Shitty weather points awarded: ${totalPointsAwarded} total points to ${usersProcessed}/${users.length} users`);
            
            return {
                success: true,
                summary: `Awarded ${totalPointsAwarded} shitty weather points to ${usersProcessed} users`,
                totalPoints: totalPointsAwarded,
                usersProcessed: usersProcessed,
                totalUsers: users.length
            };
        } catch (error) {
            console.error('[WEATHER DB] Error awarding shitty weather points:', error);
            throw error;
        }
    }

    // Fixed unknown user display names method for database
    async fixUnknownUserDisplayNames(discordClient) {
        await this.initialize();
        
        try {
            const { pool } = require('../../../main-bot/src/database/connection');
            
            // Get all users with 'Unknown User' display names
            const unknownUsers = await pool.query(`
                SELECT user_id, discord_user_id, display_name 
                FROM weather_users 
                WHERE display_name LIKE '%Unknown User%' OR display_name LIKE '%User-%'
                AND is_active = TRUE
            `);
            
            let fixedCount = 0;
            
            for (const user of unknownUsers) {
                try {
                    // Try to fetch the Discord user
                    const discordUser = await discordClient.users.fetch(user.discord_user_id);
                    
                    if (discordUser && discordUser.displayName !== user.display_name) {
                        // Update the display name in database
                        await pool.query(`
                            UPDATE weather_users 
                            SET display_name = ?, updated_at = CURRENT_TIMESTAMP 
                            WHERE user_id = ?
                        `, [discordUser.displayName, user.user_id]);
                        
                        console.log(`[WEATHER DB] Fixed display name for ${user.user_id}: "${user.display_name}" -> "${discordUser.displayName}"`);
                        fixedCount++;
                    }
                } catch (fetchError) {
                    console.log(`[WEATHER DB] Could not fetch Discord user ${user.discord_user_id}, keeping current name: ${user.display_name}`);
                }
            }
            
            console.log(`[WEATHER DB] Fixed ${fixedCount} unknown user display names`);
            return fixedCount;
        } catch (error) {
            console.error('[WEATHER DB] Error fixing unknown user display names:', error);
            throw error;
        }
    }

    /**
     * Get best single day performance in last 30 days
     */
    async getBestSingleDay() {
        try {
            const result = await getBestSingleDay();
            return result;
        } catch (error) {
            console.error('[WEATHER DB] Error getting best single day:', error);
            throw error;
        }
    }

    /**
     * Get top 5 weekly averages for last 7 days
     */
    async getTopWeeklyAverages() {
        try {
            const result = await getTopWeeklyAverages();
            return result;
        } catch (error) {
            console.error('[WEATHER DB] Error getting top weekly averages:', error);
            throw error;
        }
    }
}

module.exports = new DatabaseWeatherSystem();
