const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

class StatusMonitor {
    constructor(bot, config) {
        this.bot = bot;
        this.client = bot.client; // Discord client
        this.config = config;
        this.statusMessage = null;
        this.lastUpdateTime = null;
        this.serviceStatuses = new Map();
        this.updateInterval = null;
        this.recruitmentInvite = null;
        this.inviteDataFile = path.join(__dirname, '../../data/recruitmentInvite.json');
        
        // Initialize service statuses
        if (config.statusMonitoring?.services) {
            Object.entries(config.statusMonitoring.services).forEach(([key, service]) => {
                if (service.enabled) {
                    this.serviceStatuses.set(key, {
                        name: service.name,
                        status: 'UNKNOWN',
                        lastCheck: null,
                        details: null
                    });
                }
            });
        }
    }

    async initialize() {
        if (!this.config.statusMonitoring?.enabled || !this.config.botLogsChannelId) {
            console.log('[STATUS MONITOR] Disabled or no bot logs channel configured');
            return;
        }

        try {
            const channel = await this.client.channels.fetch(this.config.botLogsChannelId);
            if (!channel) {
                console.error('[STATUS MONITOR] Bot logs channel not found');
                return;
            }

            // Load existing recruitment invite or generate new one
            await this.loadOrGenerateRecruitmentInvite(channel);

            // Try to find existing status message
            const messages = await channel.messages.fetch({ limit: 50 });
            const existingMessage = messages.find(msg => 
                msg.author.id === this.client.user.id && 
                msg.embeds.length > 0 && 
                msg.embeds[0].title === '🤖 Bot Status Monitor'
            );

            if (existingMessage) {
                this.statusMessage = existingMessage;
                console.log('[STATUS MONITOR] Found existing status message');
            } else {
                // Create new status message
                const embed = this.createStatusEmbed();
                const components = this.createStatusComponents();
                this.statusMessage = await channel.send({ embeds: [embed], components });
                console.log('[STATUS MONITOR] Created new status message');
            }

            // Set up button interaction handler
            this.setupButtonHandler();

            // Start monitoring
            this.startMonitoring();
            console.log('[STATUS MONITOR] Status monitoring initialized');

        } catch (error) {
            console.error('[STATUS MONITOR] Failed to initialize:', error);
        }
    }

    startMonitoring() {
        // Initial status check
        this.checkAllServices();

        // Set up periodic updates
        const intervalMs = this.config.statusMonitoring?.updateInterval || 60000; // Default 1 minute
        this.updateInterval = setInterval(() => {
            this.checkAllServices();
        }, intervalMs);

        console.log(`[STATUS MONITOR] Started monitoring with ${intervalMs}ms interval`);
    }

    async checkAllServices() {
        try {
            // Check Weather Service
            await this.checkWeatherService();
            
            // Check Voice Tracking
            this.checkVoiceTracking();
            
            // Check Raffle System
            this.checkRaffleSystem();
            
            // Check Wellness System
            this.checkWellnessSystem();
            
            // Check AI System
            this.checkAISystem();
            
            // Check Database
            await this.checkDatabase();

            // Update the status message
            await this.updateStatusMessage();

        } catch (error) {
            console.error('[STATUS MONITOR] Error during service check:', error);
        }
    }

    async checkWeatherService() {
        try {
            if (this.bot.serviceManager) {
                // Use the service manager to check weather service health
                try {
                    const healthCheck = await this.bot.serviceManager.makeServiceRequest('weather', '/health', { method: 'GET' });
                    this.updateServiceStatus('weatherService', 'UP', 'Service responding normally');
                } catch (apiError) {
                    this.updateServiceStatus('weatherService', 'DOWN', 'API not responding');
                }
            } else {
                this.updateServiceStatus('weatherService', 'DOWN', 'ServiceManager not available');
            }
        } catch (error) {
            this.updateServiceStatus('weatherService', 'DOWN', 'Connection failed');
        }
    }

    checkVoiceTracking() {
        try {
            if (this.client.voice && this.client.voice.adapters) {
                // Check if voice tracking is active
                const hasVoiceConnections = this.client.voice.adapters.size > 0;
                const voiceChannelsWithUsers = this.client.guilds.cache
                    .map(guild => guild.channels.cache.filter(ch => ch.type === 2 && ch.members.size > 0))
                    .flat().length;

                if (voiceChannelsWithUsers > 0 || this.client.cachedMembers) {
                    this.updateServiceStatus('voiceTracking', 'UP', `Monitoring ${this.client.cachedMembers?.size || 0} members`);
                } else {
                    this.updateServiceStatus('voiceTracking', 'IDLE', 'No active voice channels');
                }
            } else {
                this.updateServiceStatus('voiceTracking', 'DOWN', 'Voice system not initialized');
            }
        } catch (error) {
            this.updateServiceStatus('voiceTracking', 'DOWN', 'Check failed');
        }
    }

    checkRaffleSystem() {
        try {
            // Check if raffle commands are loaded - access commands from the bot instance
            const raffleCommand = this.bot?.commands?.get('raffle');
            if (raffleCommand) {
                this.updateServiceStatus('raffleSystem', 'UP', 'Commands loaded');
            } else {
                this.updateServiceStatus('raffleSystem', 'DOWN', 'Commands not found');
            }
        } catch (error) {
            this.updateServiceStatus('raffleSystem', 'DOWN', 'Check failed');
        }
    }

    checkWellnessSystem() {
        try {
            if (this.bot?.wellnessSystem) {
                this.updateServiceStatus('wellnessSystem', 'UP', 'System active');
            } else {
                this.updateServiceStatus('wellnessSystem', 'DOWN', 'System not initialized');
            }
        } catch (error) {
            this.updateServiceStatus('wellnessSystem', 'DOWN', 'Check failed');
        }
    }

    checkAISystem() {
        try {
            if (this.config.localAIChannelId && this.config.localAIUrl) {
                // Could ping AI endpoint here, but for now just check config
                this.updateServiceStatus('aiSystem', 'UP', 'Configuration active');
            } else {
                this.updateServiceStatus('aiSystem', 'DOWN', 'Not configured');
            }
        } catch (error) {
            this.updateServiceStatus('aiSystem', 'DOWN', 'Check failed');
        }
    }

    async checkDatabase() {
        try {
            if (this.bot.db && this.bot.db.pool) {
                // Test database connection
                const connection = await this.bot.db.pool.getConnection();
                await connection.query('SELECT 1');
                connection.release();
                this.updateServiceStatus('database', 'UP', 'Connection active');
            } else {
                this.updateServiceStatus('database', 'DOWN', 'Pool not available');
            }
        } catch (error) {
            this.updateServiceStatus('database', 'DOWN', 'Connection failed');
        }
    }

    updateServiceStatus(serviceKey, status, details = null) {
        if (this.serviceStatuses.has(serviceKey)) {
            this.serviceStatuses.set(serviceKey, {
                ...this.serviceStatuses.get(serviceKey),
                status,
                details,
                lastCheck: new Date()
            });
        }
    }

    createStatusEmbed() {
        const embed = new EmbedBuilder()
            .setTitle('🤖 Bot Status Monitor')
            .setColor('#2B2D31')
            .setTimestamp();

        let description = '';
        let allUp = true;

        this.serviceStatuses.forEach((service, key) => {
            const statusEmoji = this.getStatusEmoji(service.status);
            const statusText = service.status === 'UP' ? '**UP**' : 
                              service.status === 'DOWN' ? '**DOWN**' : 
                              service.status === 'IDLE' ? '**IDLE**' : 
                              '**UNKNOWN**';
            
            description += `${statusEmoji} ${service.name}: ${statusText}`;
            
            if (service.details) {
                description += ` - ${service.details}`;
            }
            
            description += '\n';

            if (service.status === 'DOWN') {
                allUp = false;
            }
        });

        embed.setDescription(description);
        embed.setColor(allUp ? '#57F287' : '#ED4245'); // Green if all up, red if any down

        // Add recruitment invite section
        if (this.recruitmentInvite) {
            embed.addFields({
                name: '👥 Recruitment Invite',
                value: `Share this link to invite new members:\n${this.recruitmentInvite.url}`,
                inline: false
            });
        }

        // Add last update timestamp
        const now = new Date();
        embed.addFields({
            name: '🕐 Last Updated',
            value: `<t:${Math.floor(now.getTime() / 1000)}:R> • <t:${Math.floor(now.getTime() / 1000)}:f>`,
            inline: false
        });

        this.lastUpdateTime = now;
        return embed;
    }

    getStatusEmoji(status) {
        switch (status) {
            case 'UP': return '🟢';
            case 'DOWN': return '🔴';
            case 'IDLE': return '🟡';
            default: return '⚪';
        }
    }

    async updateStatusMessage() {
        if (!this.statusMessage) return;

        try {
            const embed = this.createStatusEmbed();
            const components = this.createStatusComponents();
            await this.statusMessage.edit({ embeds: [embed], components });
        } catch (error) {
            console.error('[STATUS MONITOR] Failed to update status message:', error);
        }
    }

    async shutdown() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        // Mark all services as down
        this.serviceStatuses.forEach((service, key) => {
            this.updateServiceStatus(key, 'DOWN', 'Bot shutting down');
        });

        // Final update
        await this.updateStatusMessage();
        
        console.log('[STATUS MONITOR] Status monitoring shut down');
    }

    // Method to manually update a service status from external code
    setServiceStatus(serviceKey, status, details = null) {
        this.updateServiceStatus(serviceKey, status, details);
    }

    async generateRecruitmentInvite(channel) {
        try {
            // Delete old invite if it exists
            if (this.recruitmentInvite) {
                try {
                    await this.recruitmentInvite.delete();
                    console.log(`[STATUS MONITOR] Deleted old recruitment invite: ${this.recruitmentInvite.code}`);
                } catch (error) {
                    console.log(`[STATUS MONITOR] Could not delete old invite (may already be deleted): ${error.message}`);
                }
            }

            // Create a never-expiring invite for recruitment
            this.recruitmentInvite = await channel.createInvite({
                maxAge: 0,          // Never expires
                maxUses: 0,         // Unlimited uses
                unique: true,       // Always create new invite
                temporary: false,   // Members stay after disconnecting
                reason: 'Recruitment invite for bot status'
            });
            
            console.log(`[STATUS MONITOR] Created recruitment invite: ${this.recruitmentInvite.url}`);
            
            // Save invite data persistently
            await this.saveInviteData();
            
            // Set up tracking for this invite
            this.trackInviteUsage();
            
        } catch (error) {
            console.error('[STATUS MONITOR] Failed to create recruitment invite:', error);
        }
    }

    async loadOrGenerateRecruitmentInvite(channel) {
        try {
            // Try to load existing invite data
            if (fs.existsSync(this.inviteDataFile)) {
                const savedData = JSON.parse(fs.readFileSync(this.inviteDataFile, 'utf8'));
                
                // Try to fetch the saved invite to see if it still exists
                try {
                    const guild = channel.guild;
                    const invites = await guild.invites.fetch();
                    this.recruitmentInvite = invites.find(invite => invite.code === savedData.code);
                    
                    if (this.recruitmentInvite) {
                        console.log(`[STATUS MONITOR] Loaded existing recruitment invite: ${this.recruitmentInvite.url}`);
                        this.trackInviteUsage();
                        return;
                    }
                } catch (error) {
                    console.log(`[STATUS MONITOR] Saved invite no longer exists, generating new one`);
                }
            }
            
            // Generate new invite if none exists or old one is invalid
            await this.generateRecruitmentInvite(channel);
            
        } catch (error) {
            console.error('[STATUS MONITOR] Failed to load/generate recruitment invite:', error);
        }
    }

    async saveInviteData() {
        try {
            const inviteData = {
                code: this.recruitmentInvite.code,
                url: this.recruitmentInvite.url,
                uses: this.recruitmentInvite.uses,
                createdAt: this.recruitmentInvite.createdAt
            };
            
            // Ensure data directory exists
            const dataDir = path.dirname(this.inviteDataFile);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            
            fs.writeFileSync(this.inviteDataFile, JSON.stringify(inviteData, null, 2));
            console.log('[STATUS MONITOR] Saved recruitment invite data');
        } catch (error) {
            console.error('[STATUS MONITOR] Failed to save invite data:', error);
        }
    }

    createStatusComponents() {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('reset_recruitment_invite')
                    .setLabel('🔄 Reset Invite')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄')
            );
        return [row];
    }

    setupButtonHandler() {
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isButton()) return;
            if (interaction.customId !== 'reset_recruitment_invite') return;

            // Check if user has admin permissions
            const isAdmin = this.config.adminRoles?.some(roleId => 
                interaction.member?.roles.cache.has(roleId)
            );

            if (!isAdmin) {
                await interaction.reply({
                    content: '❌ You do not have permission to reset the recruitment invite.',
                    ephemeral: true
                });
                return;
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                const channel = await this.client.channels.fetch(this.config.botLogsChannelId);
                await this.generateRecruitmentInvite(channel);
                await this.updateStatusMessage();

                await interaction.editReply({
                    content: `✅ Recruitment invite has been reset!\nNew invite: ${this.recruitmentInvite.url}`
                });

                console.log(`[STATUS MONITOR] Recruitment invite reset by ${interaction.user.tag}`);
            } catch (error) {
                await interaction.editReply({
                    content: '❌ Failed to reset recruitment invite. Please try again.'
                });
                console.error('[STATUS MONITOR] Failed to reset recruitment invite:', error);
            }
        });
    }

    trackInviteUsage() {
        // Listen for new members and check if they used our recruitment invite
        this.client.on('guildMemberAdd', async (member) => {
            try {
                // Wait a moment for Discord to process the join
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const guild = member.guild;
                const invites = await guild.invites.fetch();
                const usedInvite = invites.find(invite => invite.code === this.recruitmentInvite?.code);
                
                if (usedInvite && usedInvite.uses > (this.recruitmentInvite.uses || 0)) {
                    // Update our stored invite data
                    this.recruitmentInvite = usedInvite;
                    
                    // Assign recruitment role if configured
                    const recruitmentRoleId = this.config.recruitmentRoleId;
                    if (recruitmentRoleId) {
                        const role = guild.roles.cache.get(recruitmentRoleId);
                        if (role) {
                            await member.roles.add(role);
                            console.log(`[RECRUITMENT] Assigned role ${role.name} to ${member.user.tag}`);
                        }
                    }
                    
                    // Log to bot logs channel
                    await this.logRecruitment(member);
                }
            } catch (error) {
                console.error('[RECRUITMENT] Error tracking invite usage:', error);
            }
        });
    }

    async logRecruitment(member) {
        try {
            const channel = await this.client.channels.fetch(this.config.botLogsChannelId);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setTitle('👥 New Recruitment')
                .setDescription(`**${member.user.tag}** joined using the recruitment invite!`)
                .setColor('#57F287')
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: '👤 User', value: `<@${member.id}>`, inline: true },
                    { name: '📅 Joined', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                    { name: '🔗 Invite Uses', value: `${this.recruitmentInvite.uses || 0}`, inline: true }
                )
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            console.log(`[RECRUITMENT] Logged new member: ${member.user.tag}`);
            
        } catch (error) {
            console.error('[RECRUITMENT] Failed to log recruitment:', error);
        }
    }
}

module.exports = StatusMonitor;
