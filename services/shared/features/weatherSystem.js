const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');
const axios = require('axios');
const DataProtection = require('../../../main-bot/src/utils/dataProtection');

class WeatherSystem {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.weatherDataPath = path.join(__dirname, '../../data/weatherData.json');
        this.apiUsagePath = path.join(__dirname, '../../data/apiUsage.json');
        this.apiKey = config.weatherApiKey;
        this.channelId = config.weatherChannelId;
        this.apiCallsToday = 0;
        this.dailyLimit = 800; // Conservative limit for free tier (1000 limit)
        this.significantPointThreshold = 3; // Only notify when point changes are >= 3
        this.lastUserScores = new Map(); // Track previous scores for comparison
        this.dailyWeatherEvents = new Map(); // Track weather events for daily summary
        this.isWritingData = false; // Prevent concurrent file writes
        this.dataProtection = new DataProtection(path.join(__dirname, '../../data')); // Data protection system
        
        this.initializeData();
        this.setupScheduledTasks();
    }

    async initializeData() {
        try {
            // Initialize data protection system
            await this.dataProtection.initialize();
            
            // Create backup of existing data before any operations
            await this.dataProtection.createBackup('weatherData.json', 'startup');

            // Initialize weather data file
            try {
                await fs.access(this.weatherDataPath);
                // If file exists, check if we need to migrate existing users to new region format
                await this.migrateExistingUsers();
                // Fix any detailed region names to simplified state/province names
                await this.fixDetailedRegionNames();
                // Fix users showing country instead of state/province
                await this.fixCountryToStateRegions();
                // Fix any users with "Unknown User" display names
                await this.fixUnknownUserDisplayNames();
            } catch {
                const initialData = {
                    users: {},
                    weatherHistory: [],
                    shittyWeatherScores: {},
                    shittyWeatherHistory: [],
                    lastShittyWeatherAward: null,
                    dailyLightningEvents: {},
                    lightningHistory: [],
                    lastUpdated: new Date().toISOString()
                };
                await fs.writeFile(this.weatherDataPath, JSON.stringify(initialData, null, 2));
            }

            // Initialize API usage file
            try {
                await fs.access(this.apiUsagePath);
            } catch {
                const initialUsage = {
                    today: new Date().toDateString(),
                    calls: 0,
                    history: []
                };
                await fs.writeFile(this.apiUsagePath, JSON.stringify(initialUsage, null, 2));
            }

            // Load today's API usage
            await this.loadApiUsage();
            
            // Load lightning data from persistent storage
            await this.loadLightningData();
        } catch (error) {
            console.error('Error initializing weather system data:', error);
        }
    }

    async migrateExistingUsers() {
        try {
            const data = await this.getWeatherData();
            let needsUpdate = false;

            for (const [userId, userData] of Object.entries(data.users)) {
                // Check if user has old region format (just country code or state code)
                if (userData.region === 'US' || userData.region?.length <= 3 || userData.region === 'United States') {
                    // Use the stored city name to determine proper region
                    const cityLower = userData.city?.toLowerCase() || '';
                    
                    // Create mock weather data based on known city
                    let mockWeatherData = {
                        name: userData.city,
                        sys: { country: 'US', state: 'MD' } // Default to MD
                    };
                    
                    // For migration, we'll make a fresh API call to get accurate location data
                    // This ensures we get the correct state/province information
                    try {
                        // Try to get fresh weather data to determine the correct region
                        const freshWeather = await this.fetchWeatherByPostalCode(userData.zipCode || userData.postalCode);
                        mockWeatherData = freshWeather;
                    } catch (error) {
                        console.log(`[WEATHER] Could not fetch fresh data for ${userData.city}, using fallback`);
                        // Keep the default mockWeatherData as fallback
                    }
                    
                    // Update to privacy-friendly region
                    userData.region = this.getPrivacyFriendlyLocation(mockWeatherData);
                    userData.migratedAt = new Date().toISOString();
                    needsUpdate = true;
                    
                    console.log(`[WEATHER] Migrated user ${userData.displayName} from "${userData.city}" to region: "${userData.region}"`);
                }
            }

            if (needsUpdate) {
                await this.saveWeatherData(data);
                console.log('[WEATHER] User region migration completed');
            }
        } catch (error) {
            console.error('Error migrating existing users:', error);
        }
    }

    async fixDetailedRegionNames() {
        try {
            const data = await this.getWeatherData();
            let needsUpdate = false;

            for (const [userId, userData] of Object.entries(data.users)) {
                // Check if user has old detailed region format (e.g., "Northern Maryland", "Central Virginia")
                const region = userData.region;
                if (region && this.shouldSimplifyRegion(region)) {
                    const simplifiedRegion = this.simplifyRegionName(region);
                    if (simplifiedRegion !== region) {
                        console.log(`[WEATHER] Updating ${userData.displayName} from "${region}" to "${simplifiedRegion}"`);
                        userData.region = simplifiedRegion;
                        userData.regionSimplifiedAt = new Date().toISOString();
                        needsUpdate = true;
                    }
                }
            }

            if (needsUpdate) {
                await this.saveWeatherData(data);
                console.log('[WEATHER] Region name simplification completed');
            }
        } catch (error) {
            console.error('Error fixing detailed region names:', error);
        }
    }

    shouldSimplifyRegion(region) {
        // Check if region contains detailed descriptors that should be simplified
        const detailedPatterns = [
            /^(Northern|Southern|Eastern|Western|Central|Northeast|Northwest|Southeast|Southwest)\s+/,
            /^(Upper|Lower|North|South|East|West)\s+/,
            /\s+(Region|Area|Valley|Coast)$/,
            /City Area$/
        ];
        
        return detailedPatterns.some(pattern => pattern.test(region));
    }

    simplifyRegionName(region) {
        // Remove descriptive prefixes and suffixes to get just the state/province name
        let simplified = region;
        
        // Remove directional prefixes
        simplified = simplified.replace(/^(Northern|Southern|Eastern|Western|Central|Northeast|Northwest|Southeast|Southwest)\s+/, '');
        simplified = simplified.replace(/^(Upper|Lower|North|South|East|West)\s+/, '');
        
        // Handle special cases first
        if (simplified.includes('New York City')) {
            return 'New York';
        }
        
        // Remove suffixes
        simplified = simplified.replace(/\s+(Region|Area|Valley|Coast)$/, '');
        simplified = simplified.replace(/\s+City$/, ''); // Remove "City" suffix too
        
        return simplified;
    }

    async fixCountryToStateRegions() {
        try {
            const data = await this.getWeatherData();
            let needsUpdate = false;

            for (const [userId, userData] of Object.entries(data.users)) {
                // Check if user's region is showing as a country instead of state/province
                if (userData.region && this.isCountryName(userData.region)) {
                    console.log(`[WEATHER] Fixing region for ${userData.displayName} from "${userData.region}"`);
                    
                    try {
                        // Try to get fresh weather data to get proper state information
                        const freshWeather = await this.fetchWeatherByPostalCode(userData.postalCode || userData.zipCode);
                        if (freshWeather) {
                            const newRegion = this.getPrivacyFriendlyLocation(freshWeather);
                            if (newRegion && newRegion !== userData.region && !this.isCountryName(newRegion)) {
                                console.log(`[WEATHER] Updated ${userData.displayName} region to "${newRegion}"`);
                                userData.region = newRegion;
                                userData.regionFixedAt = new Date().toISOString();
                                needsUpdate = true;
                            }
                        }
                    } catch (error) {
                        console.log(`[WEATHER] Could not fix region for ${userData.displayName}:`, error.message);
                    }
                }
            }

            if (needsUpdate) {
                await this.saveWeatherData(data);
                console.log('[WEATHER] Country-to-state region fix completed');
            }
        } catch (error) {
            console.error('Error fixing country-to-state regions:', error);
        }
    }

    isCountryName(region) {
        const countryNames = [
            'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France',
            'Italy', 'Spain', 'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Sweden',
            'Norway', 'Denmark', 'Finland', 'Japan', 'South Korea', 'China', 'India',
            'Brazil', 'Mexico', 'Russia'
        ];
        return countryNames.includes(region);
    }

    async fixUnknownUserDisplayNames() {
        try {
            const data = await this.getWeatherData();
            let needsUpdate = false;

            for (const [userId, userData] of Object.entries(data.users)) {
                // Check if user has "Unknown User" as display name
                if (userData.displayName === 'Unknown User' && this.client) {
                    console.log(`[WEATHER] Fixing display name for user ${userId}`);
                    
                    try {
                        // Try to fetch the user from Discord
                        const discordUser = await this.client.users.fetch(userId);
                        if (discordUser) {
                            const newDisplayName = discordUser.displayName || discordUser.username || `User-${userId.slice(-4)}`;
                            console.log(`[WEATHER] Updated display name from "Unknown User" to "${newDisplayName}"`);
                            userData.displayName = newDisplayName;
                            userData.displayNameFixedAt = new Date().toISOString();
                            needsUpdate = true;
                        }
                    } catch (error) {
                        // If we can't fetch the user, at least give them a better fallback name
                        const fallbackName = `User-${userId.slice(-4)}`;
                        console.log(`[WEATHER] Could not fetch Discord user, using fallback: ${fallbackName}`);
                        userData.displayName = fallbackName;
                        userData.displayNameFixedAt = new Date().toISOString();
                        needsUpdate = true;
                    }
                }
            }

            if (needsUpdate) {
                await this.saveWeatherData(data);
                console.log('[WEATHER] Unknown user display name fixes completed');
            }
        } catch (error) {
            console.error('Error fixing unknown user display names:', error);
        }
    }

    detectLightning(weather) {
        const conditions = weather.weather[0].main.toLowerCase();
        const description = weather.weather[0].description.toLowerCase();
        
        // Lightning detection based on weather conditions and descriptions
        if (conditions === 'thunderstorm') {
            // Different types of thunderstorms indicate different lightning intensity
            if (description.includes('severe') || description.includes('heavy')) {
                return {
                    detected: true,
                    intensity: 'severe',
                    points: 3,
                    emoji: '⚡',
                    description: 'Severe Lightning Activity'
                };
            } else if (description.includes('light')) {
                return {
                    detected: true,
                    intensity: 'light',
                    points: 1,
                    emoji: '🌩️',
                    description: 'Light Lightning Activity'
                };
            } else {
                return {
                    detected: true,
                    intensity: 'moderate',
                    points: 2,
                    emoji: '⚡',
                    description: 'Lightning Activity'
                };
            }
        }
        
        // Check for lightning-related terms in description
        if (description.includes('lightning') || description.includes('electric')) {
            return {
                detected: true,
                intensity: 'moderate',
                points: 2,
                emoji: '⚡',
                description: 'Lightning Detected'
            };
        }
        
        return { detected: false };
    }

    async loadApiUsage() {
        try {
            const data = await fs.readFile(this.apiUsagePath, 'utf8');
            const usage = JSON.parse(data);
            const today = new Date().toDateString();
            
            if (usage.today === today) {
                this.apiCallsToday = usage.calls;
            } else {
                // New day, reset counter
                this.apiCallsToday = 0;
                usage.today = today;
                usage.calls = 0;
                usage.history.push({
                    date: usage.today,
                    calls: usage.calls
                });
                // Keep only last 30 days
                if (usage.history.length > 30) {
                    usage.history = usage.history.slice(-30);
                }
                await fs.writeFile(this.apiUsagePath, JSON.stringify(usage, null, 2));
            }
        } catch (error) {
            console.error('Error loading API usage:', error);
            this.apiCallsToday = 0;
        }
    }

    async incrementApiUsage() {
        this.apiCallsToday++;
        try {
            const data = await fs.readFile(this.apiUsagePath, 'utf8');
            const usage = JSON.parse(data);
            usage.calls = this.apiCallsToday;
            await fs.writeFile(this.apiUsagePath, JSON.stringify(usage, null, 2));
        } catch (error) {
            console.error('Error updating API usage:', error);
        }
    }

    async loadLightningData() {
        try {
            const data = await this.getWeatherData();
            const today = new Date().toDateString();
            
            // Initialize dailyWeatherEvents Map from persistent storage
            if (data.dailyLightningEvents && data.dailyLightningEvents[today]) {
                const todayData = data.dailyLightningEvents[today];
                this.dailyWeatherEvents.set(today, new Map());
                const todayEvents = this.dailyWeatherEvents.get(today);
                
                // Restore each user's lightning data
                for (const [userId, userEvents] of Object.entries(todayData)) {
                    todayEvents.set(userId, {
                        displayName: userEvents.displayName,
                        region: userEvents.region,
                        events: userEvents.events,
                        lightningStrikes: userEvents.lightningStrikes
                    });
                }
                
                console.log(`[LIGHTNING] Loaded lightning data for ${todayEvents.size} users`);
            }
        } catch (error) {
            console.error('Error loading lightning data:', error);
        }
    }

    async saveLightningData() {
        try {
            const data = await this.getWeatherData();
            const today = new Date().toDateString();
            
            // Initialize dailyLightningEvents if it doesn't exist
            if (!data.dailyLightningEvents) {
                data.dailyLightningEvents = {};
            }
            
            // Convert today's Map data to plain object for JSON storage
            if (this.dailyWeatherEvents.has(today)) {
                const todayEvents = this.dailyWeatherEvents.get(today);
                data.dailyLightningEvents[today] = {};
                
                for (const [userId, userEvents] of todayEvents) {
                    data.dailyLightningEvents[today][userId] = {
                        displayName: userEvents.displayName,
                        region: userEvents.region,
                        events: userEvents.events,
                        lightningStrikes: userEvents.lightningStrikes
                    };
                }
            }
            
            // Clean up old lightning data (keep only last 7 days)  
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 7);
            const cutoffDateStr = cutoffDate.toDateString();
            
            for (const dateStr in data.dailyLightningEvents) {
                // Compare date strings properly (convert to Date objects for comparison)
                if (new Date(dateStr) < new Date(cutoffDateStr)) {
                    delete data.dailyLightningEvents[dateStr];
                }
            }
            
            await this.saveWeatherData(data);
        } catch (error) {
            console.error('Error saving lightning data:', error);
        }
    }

    async recordLightningEvent(userId, userData, lightningData, weather) {
        try {
            // Only record severe or notable lightning events to avoid spam
            if (lightningData.intensity === 'severe' || 
                (lightningData.intensity === 'moderate' && Math.random() < 0.5)) {
                
                const data = await this.getWeatherData();
                
                // Initialize lightning history if it doesn't exist
                if (!data.lightningHistory) {
                    data.lightningHistory = [];
                }
                
                const lightningEvent = {
                    timestamp: new Date().toISOString(),
                    userId: userId,
                    displayName: userData.displayName,
                    region: userData.region,
                    intensity: lightningData.intensity,
                    points: lightningData.points,
                    description: lightningData.description,
                    weather: {
                        temp: Math.round(weather.main.temp),
                        condition: weather.weather[0].description,
                        wind: Math.round(weather.wind?.speed || 0),
                        humidity: weather.main.humidity
                    }
                };
                
                data.lightningHistory.push(lightningEvent);
                
                // Keep only last 100 lightning events
                if (data.lightningHistory.length > 100) {
                    data.lightningHistory = data.lightningHistory.slice(-100);
                }
                
                await this.saveWeatherData(data);
            }
        } catch (error) {
            console.error('Error recording lightning event:', error);
        }
    }

    canMakeApiCall() {
        return this.apiCallsToday < this.dailyLimit;
    }

    // Calculate dynamic delay based on remaining API calls and time left in day
    calculateApiDelay() {
        const now = new Date();
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        const hoursLeft = (endOfDay - now) / (1000 * 60 * 60);
        
        const remainingCalls = this.dailyLimit - this.apiCallsToday;
        const callsPerHour = remainingCalls / Math.max(hoursLeft, 1);
        
        // If we're running low on calls, space them out more
        if (remainingCalls < 100) {
            return Math.min(5000, (3600 / callsPerHour) * 1000); // Max 5 second delay
        } else if (remainingCalls < 200) {
            return 2000; // 2 second delay
        } else {
            return 100; // Normal delay
        }
    }

    // Check if we should make API calls based on remaining quota
    shouldMakeApiCalls() {
        const remainingCalls = this.dailyLimit - this.apiCallsToday;
        const now = new Date();
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        const hoursLeft = (endOfDay - now) / (1000 * 60 * 60);
        
        // If we have very few calls left, be very selective
        if (remainingCalls < 50) {
            return Math.random() < 0.3; // Only 30% chance of checking
        } else if (remainingCalls < 100) {
            return Math.random() < 0.6; // Only 60% chance of checking
        }
        
        return true; // Normal operation
    }

    async getWeatherData() {
        try {
            const data = await fs.readFile(this.weatherDataPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading weather data:', error);
            return { users: {}, weatherHistory: [], lastUpdated: new Date().toISOString() };
        }
    }

    async saveWeatherData(data) {
        // Wait for any pending writes to complete
        while (this.isWritingData) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.isWritingData = true;
        try {
            data.lastUpdated = new Date().toISOString();
            
            // Use protected write operation
            const success = await this.dataProtection.safeWrite('weatherData.json', data, 'weather-update');
            
            if (!success) {
                // Fallback to direct write if protected write fails
                console.warn('[WEATHER] Protected write failed, using fallback');
                await fs.writeFile(this.weatherDataPath, JSON.stringify(data, null, 2));
            }
        } catch (error) {
            console.error('Error saving weather data:', error);
        } finally {
            this.isWritingData = false;
        }
    }

    async setUserLocation(userId, zipCode, displayName, countryCode = null) {
        try {
            if (!this.canMakeApiCall()) {
                throw new Error('Daily API limit reached. Please try again tomorrow.');
            }

            // Validate postal code by making API call
            const weatherData = await this.fetchWeatherByPostalCode(zipCode, countryCode);
            
            const data = await this.getWeatherData();
            const existingUser = data.users[userId];
            
            data.users[userId] = {
                postalCode: zipCode, // Stored privately (could be zip code, postcode, etc.)
                zipCode: zipCode, // Keep for backward compatibility
                displayName: displayName, // Discord display name
                discordUserId: userId, // Store Discord user ID
                city: weatherData.name, // Stored for internal use only
                country: weatherData.sys.country, // Store country for better region mapping
                countryCode: countryCode, // Store the user-specified country code for future API calls
                region: this.getPrivacyFriendlyLocation(weatherData),
                joinedAt: existingUser?.joinedAt || new Date().toISOString(), // Keep original join date if re-joining
                lastWeatherCheck: new Date().toISOString(),
                isActive: true,
                updatedAt: new Date().toISOString()
            };
            
            await this.saveWeatherData(data);
            await this.incrementApiUsage();
            
            return {
                success: true,
                location: this.getPrivacyFriendlyLocation(weatherData),
                weather: weatherData
            };
        } catch (error) {
            console.error('Error setting user location:', error);
            throw error;
        }
    }

    async removeUserLocation(userId) {
        try {
            const data = await this.getWeatherData();
            if (data.users[userId]) {
                data.users[userId].isActive = false;
                data.users[userId].removedAt = new Date().toISOString();
                await this.saveWeatherData(data);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error removing user location:', error);
            return false;
        }
    }

    // Helper function to format temperature in both units
    formatTemperature(fahrenheit) {
        const celsius = ((fahrenheit - 32) * 5/9);
        return `${Math.round(fahrenheit)}°F (${Math.round(celsius)}°C)`;
    }

    // UK postcode area to city mapping for areas not recognized by OpenWeatherMap
    getUKCityFromPostcode(postcode) {
        const areaCode = postcode.replace(/\s+/g, '').toUpperCase().substring(0, 2);
        const ukPostcodeMap = {
            'CR': 'Croydon', 'BR': 'Bromley', 'TW': 'Twickenham', 'KT': 'Kingston upon Thames',
            'SM': 'Sutton', 'SW': 'London', 'SE': 'London', 'E1': 'London', 'EC': 'London',
            'WC': 'London', 'W1': 'London', 'NW': 'London', 'N1': 'London', 'HA': 'Harrow',
            'UB': 'Uxbridge', 'DA': 'Dartford', 'TN': 'Tonbridge', 'ME': 'Medway',
            'CT': 'Canterbury', 'BN': 'Brighton', 'RH': 'Redhill', 'GU': 'Guildford',
            'SL': 'Slough', 'RG': 'Reading', 'OX': 'Oxford', 'HP': 'High Wycombe',
            'MK': 'Milton Keynes', 'LU': 'Luton', 'AL': 'St Albans', 'WD': 'Watford',
            'EN': 'Enfield', 'SG': 'Stevenage', 'CB': 'Cambridge', 'IP': 'Ipswich',
            'NR': 'Norwich', 'PE': 'Peterborough', 'NG': 'Nottingham', 'LE': 'Leicester',
            'CV': 'Coventry', 'B1': 'Birmingham', 'WS': 'Walsall', 'DY': 'Dudley',
            'WV': 'Wolverhampton', 'ST': 'Stoke-on-Trent', 'DE': 'Derby', 'S1': 'Sheffield',
            'DN': 'Doncaster', 'HD': 'Huddersfield', 'BD': 'Bradford', 'LS': 'Leeds',
            'WF': 'Wakefield', 'YO': 'York', 'HU': 'Hull', 'LN': 'Lincoln',
            'NN': 'Northampton', 'SK': 'Stockport', 'M1': 'Manchester', 'BL': 'Bolton',
            'OL': 'Oldham', 'WN': 'Wigan', 'PR': 'Preston', 'BB': 'Blackburn',
            'FY': 'Blackpool', 'LA': 'Lancaster', 'CA': 'Carlisle', 'DL': 'Darlington',
            'TS': 'Middlesbrough', 'NE': 'Newcastle', 'SR': 'Sunderland', 'DH': 'Durham',
            'EH': 'Edinburgh', 'G1': 'Glasgow', 'ML': 'Motherwell', 'PA': 'Paisley',
            'KA': 'Kilmarnock', 'DD': 'Dundee', 'AB': 'Aberdeen', 'IV': 'Inverness',
            'PH': 'Perth', 'FK': 'Falkirk', 'CF': 'Cardiff', 'SA': 'Swansea',
            'NP': 'Newport', 'LD': 'Llandrindod Wells', 'SY': 'Shrewsbury', 'WR': 'Worcester',
            'LL': 'Llandudno', 'CH': 'Chester', 'CW': 'Crewe', 'WA': 'Warrington',
            'L1': 'Liverpool', 'BT': 'Belfast'
        };
        
        return ukPostcodeMap[areaCode] || null;
    }

    async fetchWeatherByPostalCode(postalCode, countryCode = null) {
        // Determine the best API endpoint based on postal code format and optional country
        let url;
        const cleanCode = postalCode.replace(/\s+/g, '');
        
        // If country is explicitly provided, use it
        if (countryCode) {
            if (/^\d+$/.test(cleanCode)) {
                // Numeric postal codes - use zip format
                url = `http://api.openweathermap.org/data/2.5/weather?zip=${cleanCode},${countryCode}&appid=${this.apiKey}&units=imperial`;
            } else {
                // Alphanumeric postal codes - use q format
                url = `http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(postalCode)},${countryCode}&appid=${this.apiKey}&units=imperial`;
            }
        }
        // Auto-detect based on format (existing logic)
        else if (/^\d{5}(-?\d{4})?$/.test(cleanCode)) {
            // US zip codes
            url = `http://api.openweathermap.org/data/2.5/weather?zip=${cleanCode},US&appid=${this.apiKey}&units=imperial`;
        }
        else if (/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(postalCode)) {
            // UK postcodes
            url = `http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(postalCode)},GB&appid=${this.apiKey}&units=imperial`;
        }
        else if (/^[A-Z]\d[A-Z]\s*\d[A-Z]\d$/i.test(postalCode)) {
            // Canadian postal codes
            url = `http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(postalCode)},CA&appid=${this.apiKey}&units=imperial`;
        }
        else if (/^\d{4}$/.test(cleanCode)) {
            // 4-digit codes (ambiguous - could be AU or DK, default to AU)
            url = `http://api.openweathermap.org/data/2.5/weather?zip=${cleanCode},AU&appid=${this.apiKey}&units=imperial`;
        }
        else if (/^\d{5}$/.test(cleanCode) && cleanCode !== postalCode) {
            // German postcodes (5 digits with spaces originally)
            url = `http://api.openweathermap.org/data/2.5/weather?zip=${cleanCode},DE&appid=${this.apiKey}&units=imperial`;
        }
        else {
            // Generic fallback - try as location search
            url = `http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(postalCode)}&appid=${this.apiKey}&units=imperial`;
        }
        
        try {
            const response = await axios.get(url, { timeout: 10000 });
            const weatherData = response.data;
            
            // Try to get more detailed location info using geocoding API if state is missing
            if (weatherData && !weatherData.sys?.state) {
                try {
                    const geocodingUrl = `http://api.openweathermap.org/geo/1.0/zip?zip=${encodeURIComponent(postalCode)}&appid=${this.apiKey}`;
                    const geoResponse = await axios.get(geocodingUrl, { timeout: 5000 });
                    const geoData = geoResponse.data;
                    
                    // Add state information from geocoding API if available
                    if (geoData && geoData.state) {
                        weatherData.sys = weatherData.sys || {};
                        weatherData.sys.state = geoData.state;
                    }
                } catch (geocodingError) {
                    // Geocoding failed, continue with original weather data
                    console.log('Geocoding API call failed, using basic weather data');
                }
            }
            
            return weatherData;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                // If it's a UK postcode and not found, try using the city name instead
                const ukPattern = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
                if (ukPattern.test(postalCode)) {
                    const cityName = this.getUKCityFromPostcode(postalCode);
                    if (cityName) {
                        console.log(`[WEATHER] UK postcode ${postalCode} not found, trying city: ${cityName}`);
                        const cityUrl = `http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)},GB&appid=${this.apiKey}&units=imperial`;
                        try {
                            const cityResponse = await axios.get(cityUrl, { timeout: 10000 });
                            return cityResponse.data;
                        } catch (cityError) {
                            // If city lookup also fails, fall through to original error
                        }
                    }
                }
            }
            
            if (error.response) {
                switch (error.response.status) {
                    case 404:
                        throw new Error(`Postal code "${postalCode}" not found. Please check and try again.\n\nMake sure to use the correct format for your country:\n• US: 12345\n• UK: SW1A 1AA\n• Canada: A1A 1A1\n\nNote: Some UK postcodes may not be directly supported. Try using a nearby major city instead.`);
                    case 401:
                        throw new Error('Weather service authentication error.');
                    case 429:
                        throw new Error('Weather service rate limit exceeded. Please try again later.');
                    default:
                        throw new Error('Weather service temporarily unavailable.');
                }
            }
            throw new Error('Failed to fetch weather data. Please try again.');
        }
    }

    // Keep the old method for backward compatibility, but redirect to new method
    async fetchWeatherByZip(zipCode) {
        return this.fetchWeatherByPostalCode(zipCode);
    }

    async getCurrentWeather(userId) {
        try {
            const data = await this.getWeatherData();
            const userData = data.users[userId];
            
            if (!userData || !userData.isActive) {
                return null;
            }

            if (!this.canMakeApiCall()) {
                throw new Error('Daily API limit reached. Using cached data.');
            }

            const weather = await this.fetchWeatherByPostalCode(userData.postalCode || userData.zipCode);
            await this.incrementApiUsage();
            
            // Update last check time
            userData.lastWeatherCheck = new Date().toISOString();
            await this.saveWeatherData(data);
            
            return {
                weather,
                location: userData.region, // Use privacy-friendly region
                displayName: userData.displayName
            };
        } catch (error) {
            console.error('Error getting current weather:', error);
            throw error;
        }
    }

    async checkAllUsersWeather() {
        try {
            const data = await this.getWeatherData();
            const activeUsers = Object.entries(data.users).filter(([_, user]) => user.isActive);
            const weatherUpdates = [];
            const alerts = [];

            for (const [userId, userData] of activeUsers) {
                if (!this.canMakeApiCall()) {
                    console.log('API limit reached during bulk weather check');
                    break;
                }

                try {
                    const weather = await this.fetchWeatherByZip(userData.zipCode);
                    await this.incrementApiUsage();
                    
                    userData.lastWeatherCheck = new Date().toISOString();
                    
                    // Check for severe weather
                    const alert = this.checkSevereWeather(weather, { city: userData.region }); // Use region for alerts
                    if (alert) {
                        alerts.push({ userId, alert, userData, weather });
                    }
                    
                    weatherUpdates.push({
                        userId,
                        weather,
                        userData
                    });
                    
                    // Track weather events for daily summary
                    this.trackWeatherEvents(userId, weather, userData);
                    
                    // Use dynamic delay based on API usage
                    const delay = this.calculateApiDelay();
                    await new Promise(resolve => setTimeout(resolve, delay));
                } catch (error) {
                    console.error(`Error fetching weather for user ${userId}:`, error);
                }
            }

            // Save weather history
            data.weatherHistory.push({
                timestamp: new Date().toISOString(),
                updates: weatherUpdates.length,
                alerts: alerts.length
            });

            // Keep only last 100 history entries
            if (data.weatherHistory.length > 100) {
                data.weatherHistory = data.weatherHistory.slice(-100);
            }

            await this.saveWeatherData(data);
            
            return { weatherUpdates, alerts };
        } catch (error) {
            console.error('Error in bulk weather check:', error);
            return { weatherUpdates: [], alerts: [] };
        }
    }

    checkSevereWeather(weather, userData) {
        const conditions = weather.weather[0];
        const main = weather.main;
        const wind = weather.wind;

        // Check for severe conditions
        const severeConditions = ['thunderstorm', 'tornado', 'hurricane'];
        const warnings = [];

        if (severeConditions.some(condition => conditions.main.toLowerCase().includes(condition))) {
            warnings.push(`⚠️ **${conditions.main}** alert in ${userData.city}`);
        }

        if (main.temp <= 32) {
            warnings.push(`🥶 **Freezing temperatures** (${this.formatTemperature(main.temp)}) in ${userData.city}`);
        }

        if (main.temp >= 100) {
            warnings.push(`🔥 **Extreme heat** (${this.formatTemperature(main.temp)}) in ${userData.city}`);
        }

        if (wind && wind.speed >= 25) {
            warnings.push(`💨 **High winds** (${Math.round(wind.speed)} mph) in ${userData.city}`);
        }

        return warnings.length > 0 ? warnings.join('\n') : null;
    }

    async getWeatherLeaderboard() {
        try {
            const data = await this.getWeatherData();
            const activeUsers = Object.entries(data.users)
                .filter(([_, user]) => user.isActive)
                .map(([userId, userData]) => ({
                    userId,
                    displayName: userData.displayName || `<@${userId}>`, // Fallback to Discord mention if no displayName
                    location: this.getDisplayLocation(userData), // Use helper function for better location display
                    joinedAt: userData.joinedAt
                }))
                .sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));

            return activeUsers;
        } catch (error) {
            console.error('Error getting weather leaderboard:', error);
            return [];
        }
    }

    getDisplayLocation(userData) {
        // If region is just a country name, try to get the state from postal code
        if (this.isCountryName(userData.region) && userData.postalCode) {
            const stateFromPostal = this.getStateFromPostalCode(userData.postalCode, userData.country);
            if (stateFromPostal) {
                return stateFromPostal;
            }
        }
        
        // If we have a proper region (not a country name), use it
        if (userData.region && !this.isCountryName(userData.region)) {
            return userData.region;
        }
        
        // Fallback to region or unknown
        return userData.region || 'Unknown Location';
    }

    getStateFromPostalCode(postalCode, country) {
        if (!postalCode) return null;
        
        const cleanCode = postalCode.replace(/\s+/g, '').toUpperCase();
        
        // US ZIP code to state mapping (first 3 digits determine state)
        if (country === 'US' && /^\d{5}/.test(cleanCode)) {
            const zip3 = parseInt(cleanCode.substring(0, 3));
            
            const zipToState = {
                // Alabama: 350-369
                350: 'Alabama', 351: 'Alabama', 352: 'Alabama', 354: 'Alabama', 355: 'Alabama',
                356: 'Alabama', 357: 'Alabama', 358: 'Alabama', 359: 'Alabama', 360: 'Alabama',
                361: 'Alabama', 362: 'Alabama', 363: 'Alabama', 364: 'Alabama', 365: 'Alabama',
                366: 'Alabama', 367: 'Alabama', 368: 'Alabama', 369: 'Alabama',
                // Alaska: 995-999
                995: 'Alaska', 996: 'Alaska', 997: 'Alaska', 998: 'Alaska', 999: 'Alaska',
                // Arizona: 850-865
                850: 'Arizona', 851: 'Arizona', 852: 'Arizona', 853: 'Arizona', 854: 'Arizona',
                855: 'Arizona', 856: 'Arizona', 857: 'Arizona', 858: 'Arizona', 859: 'Arizona',
                860: 'Arizona', 863: 'Arizona', 864: 'Arizona', 865: 'Arizona',
                // Arkansas: 716-729, 755-759
                716: 'Arkansas', 717: 'Arkansas', 718: 'Arkansas', 719: 'Arkansas', 720: 'Arkansas',
                721: 'Arkansas', 722: 'Arkansas', 723: 'Arkansas', 724: 'Arkansas', 725: 'Arkansas',
                726: 'Arkansas', 727: 'Arkansas', 728: 'Arkansas', 729: 'Arkansas',
                755: 'Arkansas', 756: 'Arkansas', 757: 'Arkansas', 758: 'Arkansas', 759: 'Arkansas',
                // California: 900-966
                900: 'California', 901: 'California', 902: 'California', 903: 'California', 904: 'California',
                905: 'California', 906: 'California', 907: 'California', 908: 'California', 910: 'California',
                911: 'California', 912: 'California', 913: 'California', 914: 'California', 915: 'California',
                916: 'California', 917: 'California', 918: 'California', 919: 'California', 920: 'California',
                921: 'California', 922: 'California', 923: 'California', 924: 'California', 925: 'California',
                926: 'California', 927: 'California', 928: 'California', 930: 'California', 931: 'California',
                932: 'California', 933: 'California', 934: 'California', 935: 'California', 936: 'California',
                937: 'California', 938: 'California', 939: 'California', 940: 'California', 941: 'California',
                942: 'California', 943: 'California', 944: 'California', 945: 'California', 946: 'California',
                947: 'California', 948: 'California', 949: 'California', 950: 'California', 951: 'California',
                952: 'California', 953: 'California', 954: 'California', 955: 'California', 956: 'California',
                957: 'California', 958: 'California', 959: 'California', 960: 'California', 961: 'California',
                // Connecticut: 060-069
                60: 'Connecticut', 61: 'Connecticut', 62: 'Connecticut', 63: 'Connecticut', 
                64: 'Connecticut', 65: 'Connecticut', 66: 'Connecticut', 67: 'Connecticut', 
                68: 'Connecticut', 69: 'Connecticut',
                // Maryland: 206-219
                206: 'Maryland', 207: 'Maryland', 208: 'Maryland', 209: 'Maryland', 210: 'Maryland',
                211: 'Maryland', 212: 'Maryland', 214: 'Maryland', 215: 'Maryland', 216: 'Maryland',
                217: 'Maryland', 218: 'Maryland', 219: 'Maryland'
            };
            
            return zipToState[zip3] || null;
        }
        
        // UK postcode to region mapping (simplified)
        if (country === 'GB' && /^[A-Z]{1,2}\d/.test(cleanCode)) {
            const area = cleanCode.substring(0, 2);
            const ukRegions = {
                'CR': 'England', 'BR': 'England', 'SE': 'England', 'SW': 'England',
                'E': 'England', 'EC': 'England', 'N': 'England', 'NW': 'England',
                'W': 'England', 'WC': 'England', 'BT': 'Northern Ireland',
                'G': 'Scotland', 'EH': 'Scotland', 'AB': 'Scotland',
                'CF': 'Wales', 'SA': 'Wales', 'LL': 'Wales'
            };
            return ukRegions[area] || 'United Kingdom';
        }
        
        return null;
    }

    async getSystemStats() {
        try {
            const data = await this.getWeatherData();
            const apiUsage = await fs.readFile(this.apiUsagePath, 'utf8');
            const usage = JSON.parse(apiUsage);

            const activeUsers = Object.values(data.users).filter(user => user.isActive);
            const totalUsers = Object.keys(data.users).length;
            
            return {
                activeUsers: activeUsers.length,
                totalUsers,
                apiCallsToday: this.apiCallsToday,
                dailyLimit: this.dailyLimit,
                lastUpdated: data.lastUpdated,
                weatherHistory: data.weatherHistory.slice(-10) // Last 10 checks
            };
        } catch (error) {
            console.error('Error getting system stats:', error);
            return null;
        }
    }

    setupScheduledTasks() {
        // Check weather every hour, but intelligently manage API usage
        cron.schedule('0 * * * *', async () => {
            console.log('Running scheduled weather check...');
            try {
                const channel = this.client.channels.cache.get(this.channelId);
                if (!channel) {
                    console.error('Weather channel not found');
                    return;
                }

                // Check if we should proceed with API calls
                if (!this.shouldMakeApiCalls()) {
                    console.log('Skipping weather check due to API limit conservation');
                    return;
                }

                // Regular weather alerts
                const { weatherUpdates, alerts } = await this.checkAllUsersWeather();
                
                if (alerts.length > 0) {
                    const alertMessage = `🚨 **Weather Alerts** 🚨\n\n${alerts.map(a => a.alert).join('\n\n')}`;
                    await channel.send(alertMessage);
                }

                // Award shitty weather points and check for significant changes
                const shittyWeatherResult = await this.awardShittyWeatherPoints();
                
                if (shittyWeatherResult && shittyWeatherResult.award) {
                    const award = shittyWeatherResult.award;
                    const previousScore = this.lastUserScores.get(award.userId) || 0;
                    const pointChange = award.score;
                    
                    // Only show update if points changed significantly or it's a new champion
                    const shouldNotify = pointChange >= this.significantPointThreshold || 
                                       !shittyWeatherResult.hadPreviousWinner ||
                                       shittyWeatherResult.newChampion;
                    
                    if (shouldNotify) {
                        const scoreEmojis = ['💩', '🌧️', '❄️', '🌪️', '⛈️'];
                        const emoji = scoreEmojis[Math.min(Math.floor(award.score / 2), scoreEmojis.length - 1)] || '💩';
                        
                        let message = `${emoji} **SHITTY WEATHER CHAMPION** ${emoji}\n\n`;
                        message += `🏆 **${award.displayName}** from **${award.region}** wins this round!\n`;
                        message += `**Weather Score:** ${award.score} points\n`;
                        message += `**Conditions:** ${this.formatTemperature(award.weather.temp)}, ${award.weather.description}\n`;
                        if (award.weather.wind > 0) message += `**Wind:** ${award.weather.wind} mph\n`;
                        message += `**Humidity:** ${award.weather.humidity}%\n\n`;
                        
                        // Add detailed breakdown
                        if (award.breakdown && award.breakdown.length > 0) {
                            message += `📊 **Point Breakdown:**\n`;
                            message += award.breakdown.join('\n') + '\n\n';
                        }
                        
                        message += `🎖️ **Total Shitty Weather Points:** ${award.totalPoints}\n\n`;
                        message += `*The worse your weather, the more points you get!*\n`;
                        message += `*Want to join the competition? Use \`/weather join <postal_code>\`!* 💩`;

                        await channel.send(message);
                        
                        // Update last known score for this user
                        this.lastUserScores.set(award.userId, award.totalPoints);
                    } else {
                        console.log(`Weather check complete but no significant change (${pointChange} points, threshold: ${this.significantPointThreshold})`);
                    }
                } else {
                    console.log('Weather check complete but no award given');
                }
                
                console.log(`Weather check complete: ${weatherUpdates.length} updates, ${alerts.length} alerts, API calls remaining: ${this.dailyLimit - this.apiCallsToday}`);
            } catch (error) {
                console.error('Error in scheduled weather check:', error);
            }
        });

        // Daily weather summary with notable events (8 PM Eastern Time)
        cron.schedule('0 20 * * *', async () => {
            console.log('Running daily weather summary...');
            try {
                const channel = this.client.channels.cache.get(this.channelId);
                if (!channel) return;

                const summary = await this.generateDailyWeatherSummary();
                if (summary && summary.hasNotableEvents) {
                    await channel.send(summary.message);
                }
            } catch (error) {
                console.error('Error in daily weather summary:', error);
            }
        }, {
            timezone: 'America/New_York'
        });

        // Daily shitty weather championship announcement (6 PM Eastern Time)
        cron.schedule('0 18 * * *', async () => {
            console.log('Running daily shitty weather championship...');
            try {
                const channel = this.client.channels.cache.get(this.channelId);
                if (!channel) return;

                const leaderboard = await this.getShittyWeatherLeaderboard();
                if (leaderboard.length === 0) return;

                const topUser = leaderboard[0];
                let message = `💩 **DAILY SHITTY WEATHER UPDATE** 💩\n\n`;
                message += `🏆 Current Shitty Weather Champion: **${topUser.displayName}** from **${topUser.region}**\n`;
                message += `🎖️ Total Points: **${topUser.points}**\n\n`;
                
                if (leaderboard.length > 1) {
                    message += `🥈 Top Contenders:\n`;
                    leaderboard.slice(1, 4).forEach((user, index) => {
                        message += `${index + 2}. ${user.displayName} (${user.points} pts)\n`;
                    });
                    message += '\n';
                }
                
                message += `⏰ *Next shitty weather points awarded every hour!*\n`;
                message += `📊 *Use \`/weather shitty\` to see the full leaderboard!*\n`;
                message += `🎮 *New to the game? Join with \`/weather join <postal_code>\` and compete!*`;

                await channel.send(message);
            } catch (error) {
                console.error('Error in daily shitty weather update:', error);
            }
        }, {
            timezone: 'America/New_York'
        });

        // Weekly weather leaderboard (Sundays at 8 PM)
        cron.schedule('0 20 * * 0', async () => {
            console.log('Running weekly weather leaderboard...');
            try {
                const channel = this.client.channels.cache.get(this.channelId);
                if (!channel) {
                    console.error('Weather channel not found');
                    return;
                }

                const leaderboard = await this.getWeatherLeaderboard();
                if (leaderboard.length === 0) {
                    return;
                }

                // Get shitty weather leaderboard for weekly celebration
                const shittyLeaderboard = await this.getShittyWeatherLeaderboard();
                
                let message = '🌤️ **WEEKLY WEATHER TRACKER CELEBRATION** 🌤️\n\n';
                message += '**Active Weather Trackers:**\n';
                
                leaderboard.forEach((user, index) => {
                    const emoji = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📍';
                    message += `${emoji} ${user.displayName} - ${user.location}\n`;
                });

                message += `\n📊 Total active trackers: **${leaderboard.length}**\n\n`;
                
                // Add shitty weather championship results
                if (shittyLeaderboard.length > 0) {
                    message += `💩 **SHITTY WEATHER CHAMPIONS** 💩\n`;
                    shittyLeaderboard.slice(0, 3).forEach((user, index) => {
                        const emoji = index === 0 ? '👑💩' : index === 1 ? '🥈💧' : '🥉❄️';
                        // Ping weekly winners for celebration
                        message += `${emoji} <@${user.userId}> - ${user.points} shitty points!\n`;
                    });
                    message += '\n';
                }
                
                message += '*Want to join the fun?*\n';
                message += '🌤️ *Use `/weather join <postal_code>` to start tracking!*\n';
                message += '💩 *Compete in the Shitty Weather Championship!*\n';
                message += '🏆 *The worse your weather, the more points you get!*';

                await channel.send(message);
                console.log(`Weather leaderboard sent with ${leaderboard.length} users`);
            } catch (error) {
                console.error('Error in scheduled weather leaderboard:', error);
            }
        }, {
            timezone: 'America/New_York'
        });

        // Daily data backup (2 AM Eastern Time)
        cron.schedule('0 2 * * *', async () => {
            console.log('Running daily data backup...');
            try {
                await this.dataProtection.createBackup('weatherData.json', 'daily-auto');
                console.log('Daily weather data backup completed');
            } catch (error) {
                console.error('Error in daily backup:', error);
            }
        }, {
            timezone: 'America/New_York'
        });

        console.log('Weather system scheduled tasks initialized (America/New_York timezone)');
    }

    getPrivacyFriendlyLocation(weatherData) {
        if (!weatherData || !weatherData.sys) {
            return 'Unknown Location';
        }
        
        const country = weatherData.sys.country;
        
        // Use state/province information from API if available
        if (weatherData.sys.state) {
            const stateCode = weatherData.sys.state;
            
            // Map state codes to full names for privacy
            const stateNames = {
                // US States
                'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
                'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
                'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
                'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
                'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
                'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
                'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
                'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
                'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
                'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
                'DC': 'Washington D.C.',
                
                // Canadian Provinces
                'AB': 'Alberta', 'BC': 'British Columbia', 'MB': 'Manitoba', 'NB': 'New Brunswick',
                'NL': 'Newfoundland and Labrador', 'NS': 'Nova Scotia', 'ON': 'Ontario', 'PE': 'Prince Edward Island',
                'QC': 'Quebec', 'SK': 'Saskatchewan', 'NT': 'Northwest Territories', 'NU': 'Nunavut', 'YT': 'Yukon'
            };
            
            return stateNames[stateCode] || stateCode;
        }
        
        // For countries without state information, return country-based location
        const countryNames = {
            'US': 'United States',
            'CA': 'Canada',
            'GB': 'United Kingdom',
            'AU': 'Australia',
            'DE': 'Germany',
            'FR': 'France',
            'IT': 'Italy',
            'ES': 'Spain',
            'NL': 'Netherlands',
            'BE': 'Belgium',
            'CH': 'Switzerland',
            'AT': 'Austria',
            'SE': 'Sweden',
            'NO': 'Norway',
            'DK': 'Denmark',
            'FI': 'Finland',
            'JP': 'Japan',
            'KR': 'South Korea',
            'CN': 'China',
            'IN': 'India',
            'BR': 'Brazil',
            'MX': 'Mexico',
            'RU': 'Russia'
        };
        
        return countryNames[country] || country || 'Unknown Location';
    }

    // Remove old complex city mapping since we're now using state/province from API
    getOldPrivacyFriendlyLocation_DEPRECATED(weatherData) {
        // This method contains the old complex city-based mapping
        // Keeping it temporarily in case we need to reference it
        if (!weatherData || !weatherData.name || !weatherData.sys) {
            return 'Unknown Location';
        }
        
        const city = weatherData.name.toLowerCase();
        const country = weatherData.sys.country;
        
        // Old complex mapping that we're replacing with simple state-based approach
        const regionMappings = {
            'CA': {
                'los angeles': 'Southern California',
                'san francisco': 'Northern California',
                'san diego': 'Southern California',
                'sacramento': 'Central California',
                'fresno': 'Central California',
                'oakland': 'Northern California',
                'san jose': 'Northern California',
                'long beach': 'Southern California',
                'anaheim': 'Southern California'
            },
            // Texas regions
            'TX': {
                'houston': 'Southeast Texas',
                'dallas': 'North Texas',
                'san antonio': 'South Texas',
                'austin': 'Central Texas',
                'fort worth': 'North Texas',
                'el paso': 'West Texas',
                'corpus christi': 'South Texas'
            },
            // Florida regions
            'FL': {
                'miami': 'South Florida',
                'tampa': 'Central Florida',
                'orlando': 'Central Florida',
                'jacksonville': 'North Florida',
                'tallahassee': 'North Florida',
                'fort lauderdale': 'South Florida',
                'west palm beach': 'South Florida'
            }
        };

        // For US locations, try to match cities to states first
        if (country === 'US') {
            // Check if we have a specific regional mapping for any US state
            for (const [stateCode, cityMappings] of Object.entries(regionMappings)) {
                if (cityMappings && typeof cityMappings === 'object') {
                    for (const [cityPattern, region] of Object.entries(cityMappings)) {
                        if (city.includes(cityPattern) || cityPattern.includes(city)) {
                            return region;
                        }
                    }
                }
            }
        }

        // Fallback to state-based regions for US states
        if (country === 'US') {
            const stateNames = {
                'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
                'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
                'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
                'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
                'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
                'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
                'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
                'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
                'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
                'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
            };
            // For US without specific city match, just return generic US location
            return 'United States';
        }

        // For international locations, provide more detailed regional info
        const internationalMappings = {
            'GB': {
                'london': 'London, United Kingdom',
                'manchester': 'Northern England',
                'birmingham': 'Central England', 
                'glasgow': 'Scotland',
                'edinburgh': 'Scotland',
                'cardiff': 'Wales',
                'liverpool': 'Northern England',
                'bristol': 'Southwest England',
                'leeds': 'Northern England',
                'sheffield': 'Northern England'
            },
            'CA': {
                'toronto': 'Southern Ontario',
                'vancouver': 'British Columbia',
                'montreal': 'Quebec',
                'calgary': 'Alberta',
                'ottawa': 'Eastern Ontario',
                'edmonton': 'Alberta',
                'winnipeg': 'Manitoba',
                'quebec city': 'Quebec',
                'halifax': 'Nova Scotia'
            },
            'AU': {
                'sydney': 'New South Wales',
                'melbourne': 'Victoria',
                'brisbane': 'Queensland',
                'perth': 'Western Australia',
                'adelaide': 'South Australia',
                'darwin': 'Northern Territory',
                'hobart': 'Tasmania',
                'canberra': 'Australian Capital Territory'
            },
            'DE': {
                'berlin': 'Germany',
                'munich': 'Bavaria, Germany',
                'hamburg': 'Northern Germany',
                'cologne': 'Western Germany',
                'frankfurt': 'Central Germany'
            },
            'FR': {
                'paris': 'France',
                'marseille': 'Southern France',
                'lyon': 'Central France',
                'toulouse': 'Southern France',
                'nice': 'French Riviera'
            },
            'IT': {
                'rome': 'Central Italy',
                'milan': 'Northern Italy',
                'naples': 'Southern Italy',
                'turin': 'Northern Italy',
                'florence': 'Central Italy'
            },
            'ES': {
                'madrid': 'Central Spain',
                'barcelona': 'Catalonia, Spain',
                'valencia': 'Eastern Spain',
                'seville': 'Southern Spain'
            },
            'NL': {
                'amsterdam': 'Netherlands',
                'rotterdam': 'Netherlands',
                'the hague': 'Netherlands',
                'utrecht': 'Netherlands'
            },
            'JP': {
                'tokyo': 'Eastern Japan',
                'osaka': 'Western Japan',
                'kyoto': 'Western Japan',
                'yokohama': 'Eastern Japan',
                'nagoya': 'Central Japan'
            }
        };

        // Check for specific international city mappings
        if (internationalMappings[country]) {
            for (const [cityPattern, region] of Object.entries(internationalMappings[country])) {
                if (city.includes(cityPattern) || cityPattern.includes(city)) {
                    return region;
                }
            }
        }

        // Fallback to country name with better formatting
        const countryNames = {
            'GB': 'United Kingdom',
            'CA': 'Canada', 
            'AU': 'Australia',
            'DE': 'Germany',
            'FR': 'France',
            'IT': 'Italy',
            'ES': 'Spain',
            'NL': 'Netherlands',
            'JP': 'Japan',
            'BR': 'Brazil',
            'MX': 'Mexico',
            'IN': 'India',
            'CN': 'China',
            'RU': 'Russia'
        };

        return countryNames[country] || country || 'Unknown Location';
    }

    calculateShittyWeatherScore(weather, returnBreakdown = false) {
        let score = 0;
        const breakdown = [];
        const temp = weather.main.temp;
        const conditions = weather.weather[0].main.toLowerCase();
        const description = weather.weather[0].description.toLowerCase();
        const wind = weather.wind?.speed || 0;
        const humidity = weather.main.humidity;
        const visibility = weather.visibility || 10000;

        // Temperature extremes (worse = more points)
        if (temp <= 10) {
            score += 5;
            breakdown.push('🥶 Extreme Cold (+5)');
        } else if (temp <= 32) {
            score += 3;
            breakdown.push('❄️ Freezing (+3)');
        } else if (temp >= 100) {
            score += 5;
            breakdown.push('🔥 Extreme Heat (+5)');
        } else if (temp >= 95) {
            score += 3;
            breakdown.push('🌡️ Very Hot (+3)');
        }

        // Weather conditions (shittier = more points)
        const shittyConditions = {
            'thunderstorm': { points: 4, emoji: '⛈️', name: 'Thunderstorm' },
            'drizzle': { points: 2, emoji: '🌦️', name: 'Drizzle' },
            'rain': { points: 3, emoji: '🌧️', name: 'Rain' },
            'snow': { points: 4, emoji: '🌨️', name: 'Snow' },
            'mist': { points: 2, emoji: '🌫️', name: 'Mist' },
            'fog': { points: 3, emoji: '🌫️', name: 'Fog' },
            'haze': { points: 2, emoji: '😶‍🌫️', name: 'Haze' },
            'tornado': { points: 10, emoji: '🌪️', name: 'Tornado' },
            'squall': { points: 6, emoji: '💨', name: 'Squall' },
            'ash': { points: 8, emoji: '🌋', name: 'Volcanic Ash' }
        };

        // Lightning detection from thunderstorm conditions
        const hasLightning = this.detectLightning(weather);
        if (hasLightning.detected) {
            score += hasLightning.points;
            breakdown.push(`${hasLightning.emoji} ${hasLightning.description} (+${hasLightning.points})`);
        }

        if (shittyConditions[conditions]) {
            const condition = shittyConditions[conditions];
            score += condition.points;
            breakdown.push(`${condition.emoji} ${condition.name} (+${condition.points})`);
        }

        // Special shitty descriptions get bonus points
        if (description.includes('heavy')) {
            score += 2;
            breakdown.push('💪 Heavy Conditions (+2)');
        }
        if (description.includes('extreme')) {
            score += 3;
            breakdown.push('🚨 Extreme Conditions (+3)');
        }
        if (description.includes('freezing')) {
            score += 2;
            breakdown.push('🧊 Freezing Conditions (+2)');
        }
        if (description.includes('shower')) {
            score += 1;
            breakdown.push('🚿 Showers (+1)');
        }

        // Wind penalties
        if (wind >= 30) {
            score += 3;
            breakdown.push('🌪️ Very Windy (+3)');
        } else if (wind >= 20) {
            score += 2;
            breakdown.push('💨 Windy (+2)');
        } else if (wind >= 15) {
            score += 1;
            breakdown.push('🍃 Breezy (+1)');
        }

        // High humidity in hot weather is miserable
        if (temp >= 80 && humidity >= 80) {
            score += 2;
            breakdown.push('🥵 Hot & Humid (+2)');
        }

        // Poor visibility
        if (visibility < 1000) {
            score += 3;
            breakdown.push('👻 Very Poor Visibility (+3)');
        } else if (visibility < 3000) {
            score += 2;
            breakdown.push('😶‍🌫️ Poor Visibility (+2)');
        } else if (visibility < 5000) {
            score += 1;
            breakdown.push('🌫️ Reduced Visibility (+1)');
        }

        // Bonus for really awful combinations
        if (temp <= 32 && wind >= 15) {
            score += 2;
            breakdown.push('🧊💨 Wind Chill Factor (+2)');
        }
        if (temp >= 90 && humidity >= 70) {
            score += 2;
            breakdown.push('🔥💧 Heat Index Misery (+2)');
        }
        if (conditions === 'rain' && temp <= 40) {
            score += 2;
            breakdown.push('🌧️❄️ Cold Rain (+2)');
        }
        if (conditions === 'snow' && wind >= 20) {
            score += 3;
            breakdown.push('🌨️💨 Blizzard Conditions (+3)');
        }

        if (returnBreakdown) {
            return { score, breakdown };
        }
        return score;
    }

    async awardShittyWeatherPoints() {
        try {
            const data = await this.getWeatherData();
            const activeUsers = Object.entries(data.users).filter(([_, user]) => user.isActive);
            
            if (activeUsers.length === 0) return null;

            let worstWeather = { score: 0, userId: null, userData: null, weather: null };
            const allScores = [];

            // Check all users' current weather
            for (const [userId, userData] of activeUsers) {
                if (!this.canMakeApiCall()) break;

                try {
                    const weather = await this.fetchWeatherByPostalCode(userData.postalCode || userData.zipCode);
                    await this.incrementApiUsage();
                    
                    const shittyScoreResult = this.calculateShittyWeatherScore(weather, true);
                    
                    allScores.push({
                        userId,
                        userData,
                        weather,
                        score: shittyScoreResult.score,
                        breakdown: shittyScoreResult.breakdown
                    });

                    if (shittyScoreResult.score > worstWeather.score) {
                        worstWeather = { 
                            score: shittyScoreResult.score, 
                            userId, 
                            userData, 
                            weather,
                            breakdown: shittyScoreResult.breakdown
                        };
                    }

                    // Use dynamic delay based on API usage
                    const delay = this.calculateApiDelay();
                    await new Promise(resolve => setTimeout(resolve, delay));
                } catch (error) {
                    console.error(`Error getting weather for shitty score calculation (${userId}):`, error);
                }
            }

            // Only award points if someone has a score > 0
            if (worstWeather.score > 0) {
                // Initialize scores if not exists
                if (!data.shittyWeatherScores) data.shittyWeatherScores = {};
                if (!data.shittyWeatherHistory) data.shittyWeatherHistory = [];

                // Award points equal to weather score to worst weather user
                if (!data.shittyWeatherScores[worstWeather.userId]) {
                    data.shittyWeatherScores[worstWeather.userId] = 0;
                }
                data.shittyWeatherScores[worstWeather.userId] += worstWeather.score;

                // Record the award
                const award = {
                    timestamp: new Date().toISOString(),
                    userId: worstWeather.userId,
                    displayName: worstWeather.userData.displayName || `User-${worstWeather.userId.slice(-4)}`,
                    region: worstWeather.userData.region || 'Unknown Region',
                    score: worstWeather.score,
                    breakdown: worstWeather.breakdown,
                    weather: {
                        temp: Math.round(worstWeather.weather.main.temp),
                        description: worstWeather.weather.weather[0].description,
                        wind: Math.round(worstWeather.weather.wind?.speed || 0),
                        humidity: worstWeather.weather.main.humidity
                    },
                    totalPoints: data.shittyWeatherScores[worstWeather.userId]
                };

                data.shittyWeatherHistory.push(award);
                
                // Check if this is a new champion (different from last winner)
                const hadPreviousWinner = data.lastShittyWeatherAward !== null;
                const newChampion = !hadPreviousWinner || data.lastShittyWeatherAward.userId !== worstWeather.userId;
                
                data.lastShittyWeatherAward = award;

                // Keep only last 50 awards
                if (data.shittyWeatherHistory.length > 50) {
                    data.shittyWeatherHistory = data.shittyWeatherHistory.slice(-50);
                }

                await this.saveWeatherData(data);

                return {
                    award,
                    allScores: allScores.sort((a, b) => b.score - a.score),
                    hadPreviousWinner,
                    newChampion
                };
            }

            return null;
        } catch (error) {
            console.error('Error awarding shitty weather points:', error);
            return null;
        }
    }

    async getShittyWeatherLeaderboard() {
        try {
            const data = await this.getWeatherData();
            
            if (!data.shittyWeatherScores) return [];

            const leaderboard = Object.entries(data.shittyWeatherScores)
                .map(([userId, points]) => {
                    const userData = data.users[userId];
                    return {
                        userId,
                        displayName: userData?.displayName || `User-${userId.slice(-4)}`,
                        region: userData?.region || 'Unknown Region',
                        points,
                        isActive: userData?.isActive || false
                    };
                })
                .sort((a, b) => b.points - a.points);

            return leaderboard;
        } catch (error) {
            console.error('Error getting shitty weather leaderboard:', error);
            return [];
        }
    }

    async getLastShittyWeatherAward() {
        try {
            const data = await this.getWeatherData();
            return data.lastShittyWeatherAward || null;
        } catch (error) {
            console.error('Error getting last shitty weather award:', error);
            return null;
        }
    }

    trackWeatherEvents(userId, weather, userData) {
        const today = new Date().toDateString();
        
        if (!this.dailyWeatherEvents.has(today)) {
            this.dailyWeatherEvents.set(today, new Map());
        }
        
        const todayEvents = this.dailyWeatherEvents.get(today);
        
        if (!todayEvents.has(userId)) {
            todayEvents.set(userId, {
                displayName: userData.displayName || `User-${user.slice(-4)}`,
                region: userData.region || 'Unknown Location',
                events: {
                    heatHours: 0,
                    extremeHeatHours: 0,
                    coldHours: 0,
                    extremeColdHours: 0,
                    rainHours: 0,
                    snowHours: 0,
                    windyHours: 0,
                    humidHours: 0,
                    stormHours: 0,
                    lightningHours: 0,
                    severeLightningHours: 0
                },
                lightningStrikes: {
                    total: 0,
                    severe: 0,
                    moderate: 0,
                    light: 0
                },
                tempExtremes: {
                    highest: weather.temp,
                    lowest: weather.temp
                },
                conditions: []
            });
        }
        
        const userEvents = todayEvents.get(userId);
        const temp = weather.main.temp;
        const condition = weather.weather[0].description.toLowerCase();
        
        // Track temperature extremes
        if (temp > userEvents.tempExtremes.highest) {
            userEvents.tempExtremes.highest = temp;
        }
        if (temp < userEvents.tempExtremes.lowest) {
            userEvents.tempExtremes.lowest = temp;
        }
        
        // Track weather events
        if (temp >= 100) userEvents.events.extremeHeatHours++;
        else if (temp >= 85) userEvents.events.heatHours++;
        
        if (temp <= 10) userEvents.events.extremeColdHours++;
        else if (temp <= 32) userEvents.events.coldHours++;
        
        if (condition.includes('rain') || condition.includes('drizzle')) {
            userEvents.events.rainHours++;
        }
        
        if (condition.includes('snow') || condition.includes('sleet')) {
            userEvents.events.snowHours++;
        }
        
        if (weather.wind?.speed >= 15) {
            userEvents.events.windyHours++;
        }
        
        if (weather.main.humidity >= 80) {
            userEvents.events.humidHours++;
        }
        
        if (condition.includes('storm') || condition.includes('thunder')) {
            userEvents.events.stormHours++;
        }
        
        // Track lightning activity
        const lightningData = this.detectLightning(weather);
        if (lightningData.detected) {
            userEvents.events.lightningHours++;
            userEvents.lightningStrikes.total++;
            
            // Track by intensity
            if (lightningData.intensity === 'severe') {
                userEvents.events.severeLightningHours++;
                userEvents.lightningStrikes.severe++;
            } else if (lightningData.intensity === 'moderate') {
                userEvents.lightningStrikes.moderate++;
            } else if (lightningData.intensity === 'light') {
                userEvents.lightningStrikes.light++;
            }
        }
        
        // Store the condition for variety tracking
        userEvents.conditions.push({
            time: new Date().getHours(),
            temp: temp,
            condition: weather.weather[0].description,
            wind: weather.wind?.speed || 0,
            humidity: weather.main.humidity,
            lightning: lightningData.detected ? lightningData.intensity : null
        });
        
        // Save lightning data to persistent storage after any lightning activity
        if (lightningData.detected) {
            // Save lightning data
            this.saveLightningData().catch(error => {
                console.error('Error saving lightning data:', error);
            });
            
            // Record significant lightning events in history
            this.recordLightningEvent(userId, userData, lightningData, weather).catch(error => {
                console.error('Error recording lightning event:', error);
            });
        }
    }

    async generateDailyWeatherSummary() {
        const today = new Date().toDateString();
        const todayEvents = this.dailyWeatherEvents.get(today);
        
        if (!todayEvents || todayEvents.size === 0) {
            return { hasNotableEvents: false };
        }
        
        const notableEvents = [];
        
        for (const [userId, userEvents] of todayEvents) {
            const events = userEvents.events;
            const extremes = userEvents.tempExtremes;
            
            // Heat endurance
            if (events.extremeHeatHours >= 6) {
                notableEvents.push({
                    userId,
                    type: 'extreme_heat',
                    message: `🔥 **${userEvents.displayName}** endured **${events.extremeHeatHours} hours** of extreme heat (100°F+) in **${userEvents.region}**!`,
                    severity: events.extremeHeatHours
                });
            } else if (events.heatHours >= 8) {
                notableEvents.push({
                    userId,
                    type: 'heat',
                    message: `☀️ **${userEvents.displayName}** had a scorching **${events.heatHours} hours** of heat (85°F+) in **${userEvents.region}**!`,
                    severity: events.heatHours
                });
            }
            
            // Cold endurance
            if (events.extremeColdHours >= 6) {
                notableEvents.push({
                    userId,
                    type: 'extreme_cold',
                    message: `🥶 **${userEvents.displayName}** survived **${events.extremeColdHours} hours** of extreme cold (10°F or below) in **${userEvents.region}**!`,
                    severity: events.extremeColdHours
                });
            } else if (events.coldHours >= 8) {
                notableEvents.push({
                    userId,
                    type: 'cold',
                    message: `❄️ **${userEvents.displayName}** braved **${events.coldHours} hours** of freezing weather (32°F or below) in **${userEvents.region}**!`,
                    severity: events.coldHours
                });
            }
            
            // Rain endurance
            if (events.rainHours >= 8) {
                notableEvents.push({
                    userId,
                    type: 'rain',
                    message: `🌧️ **${userEvents.displayName}** got soaked with **${events.rainHours} hours** of rain in **${userEvents.region}**!`,
                    severity: events.rainHours
                });
            }
            
            // Snow endurance
            if (events.snowHours >= 6) {
                notableEvents.push({
                    userId,
                    type: 'snow',
                    message: `❄️ **${userEvents.displayName}** was buried under **${events.snowHours} hours** of snow in **${userEvents.region}**!`,
                    severity: events.snowHours
                });
            }
            
            // Wind endurance
            if (events.windyHours >= 8) {
                notableEvents.push({
                    userId,
                    type: 'wind',
                    message: `💨 **${userEvents.displayName}** battled **${events.windyHours} hours** of strong winds (15+ mph) in **${userEvents.region}**!`,
                    severity: events.windyHours
                });
            }
            
            // Humidity endurance
            if (events.humidHours >= 10) {
                notableEvents.push({
                    userId,
                    type: 'humidity',
                    message: `💧 **${userEvents.displayName}** sweated through **${events.humidHours} hours** of high humidity (80%+) in **${userEvents.region}**!`,
                    severity: events.humidHours
                });
            }
            
            // Storm endurance
            if (events.stormHours >= 4) {
                notableEvents.push({
                    userId,
                    type: 'storm',
                    message: `⛈️ **${userEvents.displayName}** weathered **${events.stormHours} hours** of storms in **${userEvents.region}**!`,
                    severity: events.stormHours
                });
            }
            
            // Lightning activity
            if (events.severeLightningHours >= 3) {
                notableEvents.push({
                    userId,
                    type: 'severe_lightning',
                    message: `⚡ **${userEvents.displayName}** survived **${events.severeLightningHours} hours** of severe lightning strikes in **${userEvents.region}**!`,
                    severity: events.severeLightningHours + 10 // Higher priority for lightning
                });
            } else if (events.lightningHours >= 5) {
                notableEvents.push({
                    userId,
                    type: 'lightning',
                    message: `🌩️ **${userEvents.displayName}** endured **${events.lightningHours} hours** of lightning activity in **${userEvents.region}**!`,
                    severity: events.lightningHours + 5 // Moderate priority boost
                });
            }
            
            // Lightning strike counts
            const strikes = userEvents.lightningStrikes;
            if (strikes.total >= 20) {
                notableEvents.push({
                    userId,
                    type: 'lightning_strikes',
                    message: `⚡ **${userEvents.displayName}** witnessed **${strikes.total} lightning events** (${strikes.severe} severe, ${strikes.moderate} moderate, ${strikes.light} light) in **${userEvents.region}**!`,
                    severity: strikes.total + strikes.severe * 3 // Weighted by severity
                });
            } else if (strikes.total >= 10) {
                notableEvents.push({
                    userId,
                    type: 'moderate_lightning_strikes',
                    message: `🌩️ **${userEvents.displayName}** experienced **${strikes.total} lightning events** in **${userEvents.region}**!`,
                    severity: strikes.total
                });
            }
            
            // Temperature extremes
            const tempRange = extremes.highest - extremes.lowest;
            if (tempRange >= 40) {
                notableEvents.push({
                    userId,
                    type: 'temp_swing',
                    message: `🌡️ **${userEvents.displayName}** experienced a wild temperature swing of **${tempRange}°F** (${this.formatTemperature(extremes.lowest)} to ${this.formatTemperature(extremes.highest)}) in **${userEvents.region}**!`,
                    severity: tempRange
                });
            }
            
            if (extremes.highest >= 110) {
                notableEvents.push({
                    userId,
                    type: 'record_heat',
                    message: `🔥 **${userEvents.displayName}** hit a scorching **${this.formatTemperature(extremes.highest)}** in **${userEvents.region}**!`,
                    severity: extremes.highest
                });
            }
            
            if (extremes.lowest <= -10) {
                notableEvents.push({
                    userId,
                    type: 'record_cold',
                    message: `🥶 **${userEvents.displayName}** froze at **${this.formatTemperature(extremes.lowest)}** in **${userEvents.region}**!`,
                    severity: Math.abs(extremes.lowest)
                });
            }
        }
        
        if (notableEvents.length === 0) {
            return { hasNotableEvents: false };
        }
        
        // Sort by severity (highest first)
        notableEvents.sort((a, b) => b.severity - a.severity);
        
        // Build the message
        let message = `🌦️ **DAILY WEATHER WARRIORS** 🌦️\n\n`;
        message += `*Today's most notable weather survivors:*\n\n`;
        
        // Show top 8 events to avoid too long messages
        const topEvents = notableEvents.slice(0, 8);
        topEvents.forEach((event, index) => {
            message += `${index + 1}. ${event.message}\n`;
        });
        
        if (notableEvents.length > 8) {
            message += `\n*...and ${notableEvents.length - 8} more weather warriors!*\n`;
        }
        
        message += `\n💩 *Want to join tomorrow's weather endurance challenge? Use \`/weather join <postal_code>\`!*`;
        
        // Clear today's events to start fresh tomorrow
        this.dailyWeatherEvents.delete(today);
        
        return {
            hasNotableEvents: true,
            message: message,
            eventCount: notableEvents.length
        };
    }
}

module.exports = WeatherSystem;
