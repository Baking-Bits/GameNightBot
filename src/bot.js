const { Client, GatewayIntentBits } = require('discord.js');
const { pool, initializeDatabase, ...dbMethods } = require('./database');
const TimeTracker = require('./services/timeTracker');
const { registerCommands } = require('./utils/commandRegister');
const { loadEvents } = require('./utils/eventLoader');
const { loadCommands } = require('./utils/commandLoader');
const { updateServiceStatus } = require('./commands/serviceStatus');

class VoiceTimeTracker {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates
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

            // Register commands
            await registerCommands(this.client, this, token);

            this.timeTracker.startPeriodicUpdates();

            // Start periodic service status updates
            this.startServiceStatusUpdates();

            console.log(`Logged in as ${this.client.user.tag}!`);
        } catch (error) {
            console.error('Error during login:', error);
        }
    }

    startServiceStatusUpdates() {
        setInterval(() => {
            updateServiceStatus(this.client);
        }, this.statusUpdateInterval);
    }
}

module.exports = VoiceTimeTracker;
