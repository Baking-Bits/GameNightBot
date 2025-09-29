const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// Import database system only - JSON system deprecated
const databaseWeatherSystem = require('./databaseWeatherSystem');

class WeatherSystemAdapter {
    constructor() {
        this.useDatabase = true; // Always use database now
        this.currentSystem = databaseWeatherSystem;
        
        console.log('[WEATHER ADAPTER] Using DATABASE weather system');
    }

    async switchToJson() {
        console.log('[WEATHER ADAPTER] Switching to JSON system...');
        this.useDatabase = false;
        this.currentSystem = jsonWeatherSystem;
        
        // Unset environment variable
        delete process.env.WEATHER_USE_DATABASE;
        
        console.log('[WEATHER ADAPTER] Now using JSON weather system');
    }

    // Proxy all methods to the current system
    async initialize() {
        return await this.currentSystem.initialize();
    }

    async addUser(userData) {
        return await this.currentSystem.addUser(userData);
    }

    async getUser(userId) {
        return await this.currentSystem.getUser(userId);
    }

    async getAllUsers() {
        return await this.currentSystem.getAllUsers();
    }

    async removeUser(userId) {
        return await this.currentSystem.removeUser(userId);
    }

    async addWeatherDataToHistory(userId, weatherData) {
        return await this.currentSystem.addWeatherDataToHistory(userId, weatherData);
    }

    async getShittyWeatherLeaderboard(limit = 50) {
        return await this.currentSystem.getShittyWeatherLeaderboard(limit);
    }

    async updateShittyWeatherScore(userId, pointsToAdd, awardData = null) {
        return await this.currentSystem.updateShittyWeatherScore(userId, pointsToAdd, awardData);
    }

    async getBestSingleDay() {
        return await this.currentSystem.getBestSingleDay();
    }

    async getTopWeeklyAverages() {
        return await this.currentSystem.getTopWeeklyAverages();
    }

    async updateApiUsage() {
        return await this.currentSystem.updateApiUsage();
    }

    async getApiUsage(date = new Date()) {
        return await this.currentSystem.getApiUsage(date);
    }

    async userExists(userId) {
        return await this.currentSystem.userExists(userId);
    }

    async getUserCount() {
        return await this.currentSystem.getUserCount();
    }

    async fixUnknownUserDisplayNames(discordClient) {
        return await this.currentSystem.fixUnknownUserDisplayNames(discordClient);
    }

    async checkAllUsersWeather() {
        return await this.currentSystem.checkAllUsersWeather();
    }

    async awardShittyWeatherPoints() {
        return await this.currentSystem.awardShittyWeatherPoints();
    }

    // Utility methods needed by admin handlers
    async fetchWeatherByPostalCode(postalCode, countryCode = null) {
        // Direct OpenWeatherMap API implementation
        const apiKey = process.env.OPENWEATHER_API_KEY || 'a1afa3d523672a255ebd39a126e7ac3e';
        
        return new Promise((resolve, reject) => {
            let url;
            
            // Properly encode postal code for URL
            const encodedPostalCode = encodeURIComponent(postalCode);
            
            if (countryCode) {
                // For UK and other countries with postal codes that may have issues with the zip endpoint,
                // we still try the zip endpoint first but with proper encoding
                url = `https://api.openweathermap.org/data/2.5/weather?zip=${encodedPostalCode},${countryCode}&appid=${apiKey}&units=imperial`;
            } else {
                url = `https://api.openweathermap.org/data/2.5/weather?zip=${encodedPostalCode}&appid=${apiKey}&units=imperial`;
            }

            console.log(`[WEATHER API] Fetching weather for postal code: ${postalCode} (${countryCode}) - URL: ${url}`);

            https.get(url, (response) => {
                let data = '';

                response.on('data', (chunk) => {
                    data += chunk;
                });

                response.on('end', () => {
                    try {
                        const weatherData = JSON.parse(data);
                        if (response.statusCode === 200) {
                            console.log(`[WEATHER API] Success for ${postalCode}: ${weatherData.name}, ${weatherData.main?.temp}°F`);
                            resolve(weatherData);
                        } else {
                            console.error(`[WEATHER API] Error for ${postalCode}: ${response.statusCode} - ${weatherData.message || 'Unknown error'}`);
                            reject(new Error(`Weather API error: ${response.statusCode} - ${weatherData.message || 'Unknown error'}`));
                        }
                    } catch (error) {
                        console.error(`[WEATHER API] Parse error for ${postalCode}:`, error);
                        reject(new Error(`Failed to parse weather data: ${error.message}`));
                    }
                });
            }).on('error', (error) => {
                console.error(`[WEATHER API] Request error for ${postalCode}:`, error);
                reject(new Error(`Weather API request failed: ${error.message}`));
            });
        });
    }

    getPrivacyFriendlyLocation(weatherData) {
        // Use the JSON system's utility method since it's pure logic
        const jsonWeatherSystem = require('./weatherSystem');
        const tempSystem = new jsonWeatherSystem(null, {});
        return tempSystem.getPrivacyFriendlyLocation(weatherData);
    }

    // Additional methods that might only be available in certain systems
    async getUserWeatherHistory(userId, limit = 10) {
        if (this.currentSystem.getUserWeatherHistory) {
            return await this.currentSystem.getUserWeatherHistory(userId, limit);
        }
        throw new Error('getUserWeatherHistory not available in current weather system');
    }

    // Utility methods
    isUsingDatabase() {
        return this.useDatabase;
    }

    getCurrentSystemName() {
        return this.useDatabase ? 'Database' : 'JSON';
    }

    // Migration helper - compare data between systems
    async compareData() {
        if (this.useDatabase) {
            console.log('[WEATHER ADAPTER] Cannot compare data while using database system');
            return null;
        }

        try {
            // Get JSON data
            const jsonUsers = await jsonWeatherSystem.getAllUsers();
            const jsonLeaderboard = await jsonWeatherSystem.getShittyWeatherLeaderboard();

            // Get database data
            const dbUsers = await databaseWeatherSystem.getAllUsers();
            const dbLeaderboard = await databaseWeatherSystem.getShittyWeatherLeaderboard();

            const comparison = {
                json: {
                    userCount: Object.keys(jsonUsers).length,
                    leaderboardEntries: jsonLeaderboard.length
                },
                database: {
                    userCount: Object.keys(dbUsers).length,
                    leaderboardEntries: dbLeaderboard.length
                }
            };

            console.log('[WEATHER ADAPTER] Data comparison:', comparison);
            return comparison;
        } catch (error) {
            console.error('[WEATHER ADAPTER] Error comparing data:', error);
            throw error;
        }
    }

    // Health check for both systems
    async healthCheck() {
        try {
            const health = {
                adapter: {
                    currentSystem: this.getCurrentSystemName(),
                    usingDatabase: this.isUsingDatabase()
                }
            };

            // Check JSON system
            try {
                const jsonUsers = await jsonWeatherSystem.getAllUsers();
                health.json = {
                    available: true,
                    userCount: Object.keys(jsonUsers).length
                };
            } catch (error) {
                health.json = {
                    available: false,
                    error: error.message
                };
            }

            // Check database system
            try {
                const dbUserCount = await databaseWeatherSystem.getUserCount();
                health.database = {
                    available: true,
                    userCount: dbUserCount
                };
            } catch (error) {
                health.database = {
                    available: false,
                    error: error.message
                };
            }

            return health;
        } catch (error) {
            console.error('[WEATHER ADAPTER] Health check failed:', error);
            throw error;
        }
    }
}

// Export singleton instance
module.exports = new WeatherSystemAdapter();
