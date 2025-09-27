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
    getApiUsage
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
            
            await addWeatherHistory(userId, historyData);
        } catch (error) {
            console.error('[WEATHER DB] Error adding weather history:', error);
            throw error;
        }
    }

    async getShittyWeatherLeaderboard(limit = 50) {
        await this.initialize();
        const leaderboard = await getShittyWeatherLeaderboard(limit);
        
        // Convert to expected format
        return leaderboard.map(entry => ({
            userId: entry.user_id,
            displayName: entry.display_name,
            region: entry.region,
            totalPoints: entry.total_points,
            isActive: entry.is_active
        }));
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
            
            const weatherUpdates = [];
            const alerts = [];
            
            for (const user of users) {
                try {
                    // This would need OpenWeatherMap API integration
                    // For now, just update the last check time
                    const { pool } = require('../../../main-bot/src/database/connection');
                    await pool.query(`
                        UPDATE weather_users 
                        SET last_weather_check = CURRENT_TIMESTAMP 
                        WHERE user_id = ?
                    `, [user.user_id]);
                    
                    weatherUpdates.push(`Updated ${user.display_name}`);
                } catch (error) {
                    console.error(`[WEATHER DB] Error checking weather for ${user.user_id}:`, error);
                }
            }
            
            return {
                success: true,
                weatherUpdates,
                alerts,
                summary: `Checked ${weatherUpdates.length} users`
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
            // This would need the scoring logic from the original system
            // For now, just return success
            return {
                success: true,
                summary: 'Shitty weather points system ready'
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
}

module.exports = new DatabaseWeatherSystem();
