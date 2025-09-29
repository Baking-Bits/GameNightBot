const axios = require('axios');

/**
 * ServiceManager - Handles communication with microservices
 * Provides a centralized way for the main bot to interact with various services
 */
class ServiceManager {
    constructor() {
        console.log('[SERVICE MANAGER] Initializing ServiceManager...');
        this.services = {
            weather: {
                baseUrl: 'http://localhost:3001',
                healthy: false,
                lastHealthCheck: null
            }
        };
        
        // Health check interval (5 minutes)
        this.healthCheckInterval = 5 * 60 * 1000;
        this.startHealthChecks();
        console.log('[SERVICE MANAGER] ServiceManager initialized successfully');
    }

    /**
     * Start periodic health checks for all services
     */
    startHealthChecks() {
        setInterval(() => {
            this.checkAllServicesHealth();
        }, this.healthCheckInterval);
        
        // Initial health check
        setTimeout(() => this.checkAllServicesHealth(), 2000);
    }

    /**
     * Check health of all registered services
     */
    async checkAllServicesHealth() {
        for (const [serviceName, serviceConfig] of Object.entries(this.services)) {
            try {
                const response = await axios.get(`${serviceConfig.baseUrl}/health`, {
                    timeout: 5000,
                    headers: {
                        'Authorization': `Bearer ${process.env.SERVICE_TOKEN || 'dev-token'}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                serviceConfig.healthy = response.status === 200 && response.data.status === 'healthy';
                serviceConfig.lastHealthCheck = new Date();
                
                if (serviceConfig.healthy) {
                    console.log(`[SERVICE MANAGER] ${serviceName} service is healthy`);
                } else {
                    console.warn(`[SERVICE MANAGER] ${serviceName} service responded but status is not healthy:`, response.data);
                }
            } catch (error) {
                serviceConfig.healthy = false;
                serviceConfig.lastHealthCheck = new Date();
                console.error(`[SERVICE MANAGER] ${serviceName} service health check failed:`, error.message);
            }
        }
    }

    /**
     * Check if a specific service is available
     */
    isServiceHealthy(serviceName) {
        const service = this.services[serviceName];
        if (!service) {
            console.error(`[SERVICE MANAGER] Unknown service: ${serviceName}`);
            return false;
        }
        console.log(`[SERVICE MANAGER] Health check for ${serviceName}: ${service.healthy} (last check: ${service.lastHealthCheck})`);
        return service.healthy;
    }

    /**
     * Make a request to a service with error handling and retries
     */
    async makeServiceRequest(serviceName, endpoint, options = {}) {
        const service = this.services[serviceName];
        if (!service) {
            throw new Error(`Unknown service: ${serviceName}`);
        }

        if (!service.healthy) {
            throw new Error(`Service ${serviceName} is not healthy`);
        }

        const url = `${service.baseUrl}${endpoint}`;
        const requestOptions = {
            timeout: 10000,
            headers: {
                'Authorization': `Bearer ${process.env.SERVICE_TOKEN || 'dev-token'}`,
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await axios(url, requestOptions);
            return response.data;
        } catch (error) {
            // Mark service as unhealthy if request fails
            if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                service.healthy = false;
                console.error(`[SERVICE MANAGER] Service ${serviceName} appears to be down, marking as unhealthy`);
            }
            
            throw new Error(`Service request failed: ${error.message}`);
        }
    }

    // Weather Service Methods
    async joinWeatherTracking(userId, zipCode, displayName, countryCode = null) {
        return this.makeServiceRequest('weather', '/join', {
            method: 'POST',
            data: { userId, zipCode, displayName, countryCode }
        });
    }

    async leaveWeatherTracking(userId) {
        return this.makeServiceRequest('weather', `/leave/${userId}`, {
            method: 'DELETE'
        });
    }

    async getCurrentWeatherForUser(userId) {
        return this.makeServiceRequest('weather', `/weather/${userId}`, {
            method: 'GET'
        });
    }

    async getWeatherLeaderboard() {
        return this.makeServiceRequest('weather', '/leaderboard', {
            method: 'GET'
        });
    }

    async getShittyWeatherLeaderboard() {
        return this.makeServiceRequest('weather', '/shitty-leaderboard', {
            method: 'GET'
        });
    }

    async checkAllUsersWeather() {
        return this.makeServiceRequest('weather', '/check-weather', {
            method: 'POST'
        });
    }

    async awardShittyWeatherPoints() {
        return this.makeServiceRequest('weather', '/award-points', {
            method: 'POST'
        });
    }

    /**
     * Get best single day performers (top 5 by default, all if requested)
     */
    async getBestSingleDay(getAllUsers = false) {
        const queryParam = getAllUsers ? '?all=true' : '';
        return this.makeServiceRequest('weather', `/shitty/best-single-day${queryParam}`);
    }

    /**
     * Get top 5 weekly averages for last 7 days (or all if requested)
     */
    async getTopWeeklyAverages(getAllUsers = false) {
        const queryParam = getAllUsers ? '?all=true' : '';
        return this.makeServiceRequest('weather', `/shitty/weekly-averages${queryParam}`);
    }

    /**
     * Get detailed weather history for a user
     */
    async getUserWeatherHistory(userId, days = 30) {
        return this.makeServiceRequest('weather', `/user/${userId}/history?days=${days}`);
    }

    // Admin methods
    async weatherAdminCommand(subcommand, params = {}) {
        return this.makeServiceRequest('weather', '/admin', {
            method: 'POST',
            data: { subcommand, ...params }
        });
    }

    async addWeatherUser(user, postalcode, country, adminUser, displayName = null) {
        return this.weatherAdminCommand('adduser', { user, postalcode, country, adminUser, displayName });
    }

    async removeWeatherUser(user, adminUser) {
        return this.weatherAdminCommand('removeuser', { user, adminUser });
    }

    async listWeatherUsers() {
        return this.weatherAdminCommand('listusers');
    }

    async setWeatherUserActive(user, active, adminUser) {
        return this.weatherAdminCommand('setactive', { user, active, adminUser });
    }

    async setWeatherUserScore(user, points, adminUser) {
        return this.weatherAdminCommand('setscore', { user, points, adminUser });
    }

    /**
     * Get system statistics for weather system
     */
    async getSystemStats() {
        return this.makeServiceRequest('weather', '/stats');
    }

    /**
     * Get last shitty weather award details
     */
    async getLastShittyWeatherAward() {
        return this.makeServiceRequest('weather', '/shitty/last-award');
    }

    /**
     * Get best single day performance in last 30 days
     */
    async getBestSingleDay() {
        return this.makeServiceRequest('weather', '/shitty/best-single-day');
    }

    /**
     * Get top 5 weekly averages for last 7 days
     */
    async getTopWeeklyAverages() {
        return this.makeServiceRequest('weather', '/shitty/weekly-averages');
    }

    /**
     * Get API usage statistics
     */
    async getApiUsage() {
        return this.makeServiceRequest('weather', '/api-usage');
    }

    /**
     * Check severe weather conditions (client-side utility)
     */
    checkSevereWeather(weather, location) {
        // This is a utility function that doesn't need API call
        if (!weather || !weather.weather || !weather.weather[0]) {
            return null;
        }

        const condition = weather.weather[0].main.toLowerCase();
        const description = weather.weather[0].description;
        const windSpeed = weather.wind?.speed || 0;
        const temp = weather.main?.temp || 70;

        // Check for severe conditions
        if (condition.includes('thunderstorm') || condition.includes('storm')) {
            return `⛈️ **Thunderstorm Alert**: ${description}`;
        }
        if (condition.includes('tornado')) {
            return `🌪️ **Tornado Warning**: ${description}`;
        }
        if (windSpeed > 25) { // > 25 mph winds
            return `💨 **High Wind Alert**: ${Math.round(windSpeed)} mph winds`;
        }
        if (temp > 100) {
            return `🔥 **Extreme Heat**: ${Math.round(temp)}°F`;
        }
        if (temp < 0) {
            return `🥶 **Extreme Cold**: ${Math.round(temp)}°F`;
        }
        if (condition.includes('blizzard')) {
            return `🌨️ **Blizzard Warning**: ${description}`;
        }

        return null;
    }

    // Server Tracking Methods
    /**
     * Add a server to weather monitoring
     */
    async addTrackedServer(serverName, postalCode, thresholds = {}) {
        const { addTrackedServer } = require('../database/weather');
        return addTrackedServer(serverName, postalCode, thresholds);
    }

    /**
     * Remove a server from weather monitoring
     */
    async removeTrackedServer(serverId) {
        const { removeTrackedServer } = require('../database/weather');
        return removeTrackedServer(serverId);
    }

    /**
     * Get all tracked servers
     */
    async getAllTrackedServers() {
        const { getAllTrackedServers } = require('../database/weather');
        return getAllTrackedServers();
    }

    /**
     * Update server alert thresholds
     */
    async updateServerThresholds(serverId, thresholds) {
        const { updateServerThresholds } = require('../database/weather');
        return updateServerThresholds(serverId, thresholds);
    }

    /**
     * Get server alert history
     */
    async getServerAlertHistory(serverId, days = 7) {
        const { getServerAlertHistory } = require('../database/weather');
        return getServerAlertHistory(serverId, days);
    }

    /**
     * Check weather for a specific server
     */
    async getServerWeatherStatus(serverId) {
        const { getAllTrackedServers } = require('../database/weather');
        
        try {
            // Get server details
            const servers = await getAllTrackedServers();
            const server = servers.find(s => s.id === serverId);
            
            if (!server) {
                throw new Error('Server not found');
            }

            // Get weather for server location
            const weatherData = await this.makeServiceRequest('weather', '/weather/postal', {
                method: 'POST',
                data: { postalCode: server.postal_code }
            });

            // Check for threshold violations
            const alerts = [];
            if (weatherData.temperature > server.temp_high_threshold) {
                alerts.push({
                    type: 'HIGH_TEMP',
                    message: `Temperature ${weatherData.temperature}°F exceeds threshold ${server.temp_high_threshold}°F`
                });
            }
            if (weatherData.temperature < server.temp_low_threshold) {
                alerts.push({
                    type: 'LOW_TEMP', 
                    message: `Temperature ${weatherData.temperature}°F below threshold ${server.temp_low_threshold}°F`
                });
            }
            if (weatherData.wind_speed > server.wind_threshold) {
                alerts.push({
                    type: 'HIGH_WIND',
                    message: `Wind speed ${weatherData.wind_speed} mph exceeds threshold ${server.wind_threshold} mph`
                });
            }
            if (weatherData.humidity > server.humidity_threshold) {
                alerts.push({
                    type: 'HIGH_HUMIDITY',
                    message: `Humidity ${weatherData.humidity}% exceeds threshold ${server.humidity_threshold}%`
                });
            }

            return {
                server,
                weather: weatherData,
                alerts,
                hasAlerts: alerts.length > 0
            };
        } catch (error) {
            console.error('[SERVICE MANAGER] Error getting server weather status:', error);
            throw error;
        }
    }

    /**
     * Check weather for all tracked servers and create alerts if needed
     */
    async checkAllServerWeather() {
        const { getAllTrackedServers, addServerWeatherAlert } = require('../database/weather');
        
        try {
            const servers = await getAllTrackedServers();
            const results = [];

            for (const server of servers) {
                try {
                    const status = await this.getServerWeatherStatus(server.id);
                    
                    // Create alerts for threshold violations
                    for (const alert of status.alerts) {
                        await addServerWeatherAlert(
                            server.id,
                            server.server_name,
                            alert.type,
                            alert.message,
                            status.weather
                        );
                    }

                    results.push({
                        serverId: server.id,
                        serverName: server.server_name,
                        status: 'checked',
                        alertsCreated: status.alerts.length
                    });
                } catch (error) {
                    console.error(`[SERVICE MANAGER] Error checking weather for server ${server.server_name}:`, error);
                    results.push({
                        serverId: server.id,
                        serverName: server.server_name,
                        status: 'error',
                        error: error.message
                    });
                }
            }

            return {
                success: true,
                serversChecked: servers.length,
                results
            };
        } catch (error) {
            console.error('[SERVICE MANAGER] Error checking all server weather:', error);
            throw error;
        }
    }

    /**
     * Get overall service status for monitoring
     */
    getServicesStatus() {
        const status = {};
        for (const [serviceName, serviceConfig] of Object.entries(this.services)) {
            status[serviceName] = {
                healthy: serviceConfig.healthy,
                lastHealthCheck: serviceConfig.lastHealthCheck,
                baseUrl: serviceConfig.baseUrl
            };
        }
        return status;
    }
}

module.exports = ServiceManager;
