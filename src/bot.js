const { Client, GatewayIntentBits } = require('discord.js');
const { pool, initializeDatabase, ...dbMethods } = require('./database');
const TimeTracker = require('./services/timeTracker');
const { registerCommands } = require('./utils/commandRegister');
const { loadEvents } = require('./utils/eventLoader');
const { loadCommands } = require('./utils/commandLoader');
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
    }

    async login(token) {
        try {
            // Load commands first
            loadCommands(this);

            // Then load events
            loadEvents(this.client, this);

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

            console.log(`Logged in as ${this.client.user.tag}!`);

            // Cache all members for all guilds the bot is in
            this.client.cachedMembers = new Map();
            for (const guild of this.client.guilds.cache.values()) {
                const members = await guild.members.fetch();
                this.client.cachedMembers = new Map([...this.client.cachedMembers, ...members]);
            }

            console.log('Cached all guild members.');
            console.log(`Cached members: ${this.client.cachedMembers.size}`);

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

    // startServiceStatusUpdates() {
    //     setInterval(() => {
    //         updateServiceStatus(this.client);
    //     }, this.statusUpdateInterval);
    // }
}

module.exports = VoiceTimeTracker;
