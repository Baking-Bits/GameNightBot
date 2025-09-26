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
                    timeout: 5000
                });
                
                serviceConfig.healthy = response.status === 200;
                serviceConfig.lastHealthCheck = new Date();
                
                if (serviceConfig.healthy && response.data.status === 'healthy') {
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
