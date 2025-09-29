const { Client, GatewayIntentBits } = require('discord.js');
const { pool, initializeDatabase, ...dbMethods } = require('./database');
const TimeTracker = require('../../services/shared/services/timeTracker');
const { registerCommands } = require('./utils/commandRegister');
const { loadEvents } = require('./utils/eventLoader');
const { loadCommands } = require('./utils/commandLoader');
const localaiRelay = require('../../services/shared/ai/localaiRelay');
const WellnessSystem = require('../../services/shared/features/wellnessSystem');
// WeatherSystem import removed - now using database system via ServiceManager
const ServiceManager = require('./services/ServiceManager');
const StatusMonitor = require('./services/StatusMonitor');
const config = require('../../config.json');
// const { updateServiceStatus } = require('./events/serviceStatus');

class VoiceTimeTracker {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMembers
            ]
        });

        this.db = { pool, initializeDatabase, ...dbMethods };
        this.timeTracker = new TimeTracker(this.client, this.db);
        this.statusUpdateInterval = 5 * 60 * 1000; // Default to 5 minutes
        this.config = config;
        this.wellnessSystem = null; // Will be initialized after client is ready
        // Weather system now handled by ServiceManager and database
        this.serviceManager = new ServiceManager(); // Initialize service manager
        this.statusMonitor = new StatusMonitor(this, this.config); // Pass bot instance instead of client
        console.log('[BOT] ServiceManager attached to bot instance:', !!this.serviceManager);
    }

    async login(token) {
        try {
            // Load commands first
            loadCommands(this);

            // Then load events
            loadEvents(this.client, this);

            // Initialize AI relay
            localaiRelay(this.client);

            // Login
            await this.client.login(token);

            // Wait for client to be ready
            await new Promise(resolve => {
                if (this.client.isReady()) resolve();
                else this.client.once('ready', () => resolve());
            });

            // Register commands on startup
            await registerCommands(this.client, this, token);

            this.timeTracker.startPeriodicUpdates();

            // Initialize Wellness system
            if (this.config.wellnessChannelId && this.config.wellnessChannelId !== "CHANNEL_ID_HERE") {
                try {
                    this.wellnessSystem = new WellnessSystem(this.client, this.config);
                    await this.wellnessSystem.initialize();
                    console.log('[ADMIN] Wellness system initialized successfully');
                } catch (error) {
                    console.error('[ADMIN] Failed to initialize Wellness system:', error);
                }
            } else {
                console.log('[ADMIN] Wellness system not initialized - channel ID not configured in config.json');
            }

            // Initialize Weather system scheduling (using ServiceManager + Database)
            if (this.config.weatherChannelId && this.config.weatherApiKey && 
                this.config.weatherChannelId !== "CHANNEL_ID_HERE" && 
                this.config.weatherApiKey !== "YOUR_API_KEY_HERE") {
                try {
                    // Initialize database-aware weather scheduling
                    this.initializeWeatherScheduling();
                    console.log('[WEATHER] Weather system initialized successfully');
                } catch (error) {
                    console.error('[WEATHER] Failed to initialize Weather system:', error);
                }
            } else {
                console.log('[WEATHER] Weather system not initialized - channel ID or API key not configured in config.json');
            }

            console.log(`Logged in as ${this.client.user.tag}!`);

            // Cache all members for all guilds the bot is in
            this.client.cachedMembers = new Map();
            for (const guild of this.client.guilds.cache.values()) {
                const members = await guild.members.fetch();
                this.client.cachedMembers = new Map([...this.client.cachedMembers, ...members]);
            }

            console.log('Cached all guild members.');
            console.log(`Cached members: ${this.client.cachedMembers.size}`);

            // Initialize Status Monitor
            if (this.config.statusMonitoring?.enabled) {
                try {
                    await this.statusMonitor.initialize();
                    console.log('[STATUS MONITOR] Status monitoring initialized successfully');
                } catch (error) {
                    console.error('[STATUS MONITOR] Failed to initialize status monitoring:', error);
                }
            }

            // Load event-role associations from DB and set up eventRoleMap
            const eventRoles = await this.db.getAllEventRoles();
            this.eventRoleMap = new Map();
            for (const row of eventRoles) {
                this.eventRoleMap.set(row.event_id, row.role_id);
            }
            // Register event listeners if any event roles exist
            if (eventRoles.length && !this._eventRoleListenerRegistered) {
                this.client.on('guildScheduledEventUserAdd', async (event, user) => {
                    const trackedRoleId = this.eventRoleMap && this.eventRoleMap.get(event.id);
                    if (trackedRoleId) {
                        try {
                            const member = await event.guild.members.fetch(user.id);
                            if (!member.roles.cache.has(trackedRoleId)) {
                                await member.roles.add(trackedRoleId, 'RSVPed to event');
                            }
                        } catch (err) {
                            console.error('Error assigning event role:', err);
                        }
                    }
                });
                this.client.on('guildScheduledEventUserRemove', async (event, user) => {
                    const trackedRoleId = this.eventRoleMap && this.eventRoleMap.get(event.id);
                    if (trackedRoleId) {
                        try {
                            const member = await event.guild.members.fetch(user.id);
                            if (member.roles.cache.has(trackedRoleId)) {
                                await member.roles.remove(trackedRoleId, 'Un-RSVPed from event');
                            }
                        } catch (err) {
                            console.error('Error removing event role:', err);
                        }
                    }
                });
                this._eventRoleListenerRegistered = true;
            }
        } catch (error) {
            console.error('Error during login:', error);
        }
    }

    initializeWeatherScheduling() {
        const cron = require('node-cron');
        
        // Hourly weather check and point awarding (every hour)
        cron.schedule('0 * * * *', async () => {
            console.log('[WEATHER SCHEDULE] Running hourly weather check and point awarding...');
            try {
                if (this.serviceManager) {
                    // Check all users weather first
                    const weatherResult = await this.serviceManager.checkAllUsersWeather();
                    console.log('[WEATHER SCHEDULE] Weather check completed:', weatherResult.summary || 'OK');
                    
                    // Award shitty weather points based on current conditions
                    const pointsResult = await this.serviceManager.awardShittyWeatherPoints();
                    console.log('[WEATHER SCHEDULE] Points awarded:', pointsResult.summary || 'OK');
                    
                    // Send alert messages to channel if severe weather points awarded
                    if (pointsResult && pointsResult.award && pointsResult.award.score >= 5 && this.config?.weatherChannelId) {
                        const channel = this.client.channels.cache.get(this.config.weatherChannelId);
                        if (channel) {
                            await this.sendSevereWeatherAlert(channel, pointsResult.award);
                        }
                    }
                }
            } catch (error) {
                console.error('[WEATHER SCHEDULE] Error in hourly weather check:', error);
            }
        });

        // Daily weather update message (6 PM)
        cron.schedule('0 18 * * *', async () => {
            console.log('[WEATHER SCHEDULE] Sending daily weather update message...');
            try {
                if (this.serviceManager && this.config?.weatherChannelId) {
                    const channel = this.client.channels.cache.get(this.config.weatherChannelId);
                    if (channel) {
                        await this.sendDailyWeatherUpdate(channel);
                        console.log('[WEATHER SCHEDULE] Daily update message sent');
                    }
                }
            } catch (error) {
                console.error('[WEATHER SCHEDULE] Error sending daily update:', error);
            }
        });

        // Note: Shitty weather points are now awarded every hour with weather checks

        console.log('[WEATHER SCHEDULE] Weather system scheduled tasks initialized');
    }

    async sendDailyWeatherUpdate(channel) {
        try {
            const [bestSingleDay, topWeeklyAverages] = await Promise.all([
                this.serviceManager.getBestSingleDay(),
                this.serviceManager.getTopWeeklyAverages()
            ]);
            
            const bestDayData = bestSingleDay?.top5 || [];
            const weeklyData = topWeeklyAverages || [];
            
            if (bestDayData.length === 0 && weeklyData.length === 0) {
                return; // Skip if no fair competition data
            }

            let message = `💩 **DAILY SHITTY WEATHER UPDATE** 💩\n\n`;
            
            // Show top 5 best single day performers
            if (bestDayData.length > 0) {
                message += `🏆 **Top Single Day Performers (Last 30 Days)**\n`;
                
                bestDayData.forEach((performer, index) => {
                    const displayName = performer.display_name || `User-${performer.user_id.slice(-4)}`;
                    const region = performer.region || 'Unknown Region';
                    const date = new Date(performer.date).toLocaleDateString();
                    const emoji = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '⭐';
                    
                    message += `${emoji} **${displayName}** from **${region}** - **${performer.total_points} points** (${date})\n`;
                });
                
                message += `\n`;
            }
            
            // Show top weekly average
            if (weeklyData.length > 0) {
                const topWeekly = weeklyData[0];
                const displayName = topWeekly.display_name || `User-${topWeekly.user_id.slice(-4)}`;
                const region = topWeekly.region || 'Unknown Region';
                const average = parseFloat(topWeekly.avg_points).toFixed(1);
                
                message += `📈 **Top Weekly Average Leader**\n`;
                message += `🥇 **${displayName}** from **${region}** - **${average} points/day**\n`;
                message += `(${topWeekly.days_active} days active)\n\n`;
            }
            
            message += `⏰ *Shitty weather points awarded every hour!*\n`;
            message += `📊 *Use \`/weather shitty\` to see the full fair competition leaderboard!*\n`;
            message += `🎮 *New to the game? Join with \`/weather join <postal_code>\` and compete!*`;

            await channel.send(message);
        } catch (error) {
            console.error('[WEATHER SCHEDULE] Error sending daily update:', error);
        }
    }

    async sendSevereWeatherAlert(channel, award) {
        try {
            // Helper function to format temperature 
            const formatTemperature = (fahrenheit) => {
                const celsius = ((fahrenheit - 32) * 5/9);
                return `${Math.round(fahrenheit)}°F (${Math.round(celsius)}°C)`;
            };

            let message = `🌪️ **SEVERE WEATHER ALERT** ⚡\n\n`;
            message += `🏆 **${award.displayName}** from **${award.region}** earned **${award.score} points** for severe conditions!\n\n`;
            message += `🌡️ **Conditions:** ${formatTemperature(award.weather.temp)}, ${award.weather.description}\n`;
            if (award.weather.wind > 15) message += `💨 **High Winds:** ${award.weather.wind} mph\n`;
            message += `💧 **Humidity:** ${award.weather.humidity}%\n\n`;
            
            // Show what earned the points
            if (award.weather.description.includes('tornado')) {
                message += `🌪️ **TORNADO CONDITIONS** - Extreme weather bonus!\n`;
            } else if (award.weather.description.includes('blizzard')) {
                message += `❄️ **BLIZZARD CONDITIONS** - Severe snow bonus!\n`;
            } else if (award.weather.wind > 25) {
                message += `💨 **HIGH WIND CONDITIONS** - Dangerous wind speeds!\n`;
            } else if (award.weather.description.includes('thunderstorm')) {
                message += `⛈️ **SEVERE THUNDERSTORM** - Heavy rain and lightning!\n`;
            }
            
            message += `🎖️ **Total Points:** ${award.totalPoints}\n\n`;
            message += `*Severe weather = more points! Stay safe out there!*\n`;
            message += `*Join the competition: \`/weather join <postal_code>\`* 🌪️`;
            
            await channel.send(message);
        } catch (error) {
            console.error('[WEATHER SCHEDULE] Error sending severe weather alert:', error);
        }
    }

    async shutdown() {
        console.log('[BOT] Shutting down...');
        
        // Shutdown status monitor first to update final status
        if (this.statusMonitor) {
            await this.statusMonitor.shutdown();
        }
        
        // Destroy Discord client
        if (this.client) {
            this.client.destroy();
        }
        
        console.log('[BOT] Shutdown complete');
    }

    // startServiceStatusUpdates() {
    //     setInterval(() => {
    //         updateServiceStatus(this.client);
    //     }, this.statusUpdateInterval);
    // }
}

module.exports = VoiceTimeTracker;
