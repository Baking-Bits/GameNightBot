const express = require('express');
const cors = require('cors');
const path = require('path');

// Import the existing weather system
const weatherSystemAdapter = require('../shared/features/weatherSystemAdapter');

const app = express();
const PORT = process.env.WEATHER_SERVICE_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize weather system with config
let weatherSystem = weatherSystemAdapter;

async function initializeWeatherService() {
    try {
        await weatherSystem.initialize();
        console.log(`[WEATHER SERVICE] Weather system initialized (${weatherSystem.getCurrentSystemName()})`);
    } catch (error) {
        console.error('[WEATHER SERVICE] Failed to initialize weather system:', error);
        process.exit(1);
    }
}

// Middleware to verify service token
const authenticateService = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const expectedToken = process.env.SERVICE_TOKEN || 'dev-token';
    
    if (token !== expectedToken) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    next();
};

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'weather', 
        timestamp: new Date().toISOString(),
        version: require('./package.json').version
    });
});

// Admin endpoint (handles all admin operations)
app.post('/admin', authenticateService, async (req, res) => {
    try {
        const { subcommand, user, postalcode, country, active, points, adminUser, guildId, displayName } = req.body;

        let result;
        switch (subcommand) {
            case 'adduser':
                result = await handleAddUser(user, postalcode, country, adminUser, displayName);
                break;
            case 'removeuser':
                result = await handleRemoveUser(user, adminUser);
                break;
            case 'listusers':
                result = await handleListUsers();
                break;
            case 'setactive':
                result = await handleSetActive(user, active, adminUser);
                break;
            case 'setscore':
                result = await handleSetScore(user, points, adminUser);
                break;
            default:
                result = { success: false, message: 'Unknown subcommand' };
        }

        res.json(result);
    } catch (error) {
        console.error('[WEATHER SERVICE] Error in admin endpoint:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Weather data endpoints
app.get('/weather/:userId', authenticateService, async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await weatherSystem.getUser(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Convert database format to expected format
        const userFormatted = {
            displayName: user.display_name,
            postalCode: user.postal_code,
            city: user.city,
            country: user.country,
            region: user.region,
            countryCode: user.country_code
        };

        const weather = await weatherSystem.fetchWeatherByPostalCode(user.postal_code, user.country_code);
        res.json({ user: userFormatted, weather });
    } catch (error) {
        console.error('[WEATHER SERVICE] Error fetching weather:', error);
        res.status(500).json({ error: 'Failed to fetch weather data' });
    }
});

app.get('/leaderboard', authenticateService, async (req, res) => {
    try {
        const leaderboard = await weatherSystem.getShittyWeatherLeaderboard();
        res.json(leaderboard);
    } catch (error) {
        console.error('[WEATHER SERVICE] Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

app.post('/join', authenticateService, async (req, res) => {
    try {
        const { userId, zipCode, displayName, countryCode } = req.body;
        
        // Fetch location data from OpenWeatherMap API using the postal code
        const locationData = await weatherSystem.fetchWeatherByPostalCode(zipCode, countryCode);
        
        if (!locationData) {
            return res.status(400).json({ success: false, message: 'Invalid postal code or location not found' });
        }
        
        // Create user data for database
        const userData = {
            userId: userId,
            discordUserId: userId,
            displayName: displayName,
            postalCode: zipCode,
            city: locationData.name,
            country: locationData.sys?.country || countryCode,
            region: locationData.sys?.country || 'Unknown',
            countryCode: locationData.sys?.country || countryCode,
            adminAdded: false,
            addedBy: null
        };
        
        const result = await weatherSystem.addUser(userData);
        
        // Return the format expected by the weather command
        const responseData = {
            weather: locationData,
            location: `${locationData.name}, ${locationData.sys?.country || countryCode}`,
            user: userData,
            addResult: result
        };
        
        res.json({ success: true, data: responseData });
    } catch (error) {
        console.error('[WEATHER SERVICE] Error joining weather system:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/leave/:userId', authenticateService, async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await weatherSystem.removeUser(userId);
        res.json({ success: result.success, message: result.message });
    } catch (error) {
        console.error('[WEATHER SERVICE] Error leaving weather system:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Shitty weather leaderboard endpoint
app.get('/shitty-leaderboard', authenticateService, async (req, res) => {
    try {
        const leaderboard = await weatherSystem.getShittyWeatherLeaderboard();
        res.json(leaderboard);
    } catch (error) {
        console.error('[WEATHER SERVICE] Error fetching shitty weather leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch shitty weather leaderboard' });
    }
});

// Check all users weather and return alerts
app.post('/check-weather', authenticateService, async (req, res) => {
    try {
        const result = await weatherSystem.checkAllUsersWeather();
        res.json(result);
    } catch (error) {
        console.error('[WEATHER SERVICE] Error checking weather:', error);
        res.status(500).json({ error: 'Failed to check weather' });
    }
});

// Award shitty weather points
app.post('/award-points', authenticateService, async (req, res) => {
    try {
        const result = await weatherSystem.awardShittyWeatherPoints();
        res.json(result);
    } catch (error) {
        console.error('[WEATHER SERVICE] Error awarding points:', error);
        res.status(500).json({ error: 'Failed to award points' });
    }
});

// Get system statistics
app.get('/stats', authenticateService, async (req, res) => {
    try {
        const userCount = await weatherSystem.getUserCount();
        const leaderboard = await weatherSystem.getShittyWeatherLeaderboard(5);
        
        const stats = {
            totalUsers: userCount,
            activeUsers: userCount, // All returned users are active
            topPlayers: leaderboard.length,
            systemStatus: 'operational'
        };
        
        res.json(stats);
    } catch (error) {
        console.error('[WEATHER SERVICE] Error getting stats:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

// Get last shitty weather award
app.get('/shitty/last-award', authenticateService, async (req, res) => {
    try {
        // This would need to be implemented in the database system
        // For now, return null indicating no recent award
        res.json(null);
    } catch (error) {
        console.error('[WEATHER SERVICE] Error getting last award:', error);
        res.status(500).json({ error: 'Failed to get last award' });
    }
});

// Import admin handlers from separate file
const {
    setWeatherSystem,
    handleAddUser,
    handleRemoveUser,
    handleListUsers,
    handleSetActive,
    handleSetScore
} = require('./src/handlers/adminHandlers');

// Set the weather system instance for admin handlers
setWeatherSystem(weatherSystem);

// Start server
async function startServer() {
    await initializeWeatherService();
    
    app.listen(PORT, () => {
        console.log(`[WEATHER SERVICE] Server running on port ${PORT}`);
        console.log(`[WEATHER SERVICE] Health check: http://localhost:${PORT}/health`);
    });
}

startServer().catch(error => {
    console.error('[WEATHER SERVICE] Failed to start server:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[WEATHER SERVICE] Received SIGTERM, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[WEATHER SERVICE] Received SIGINT, shutting down gracefully');
    process.exit(0);
});
