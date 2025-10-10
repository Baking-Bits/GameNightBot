const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AuditLogEvent } = require('discord.js');
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
        this.inviteCache = new Map(); // Cache for tracking all server invites
                this.pendingApprovals = new Map(); // Store pending approval requests
        this.processedMembers = new Set(); // Track members we've already processed
        this.processedMembersFile = path.join(__dirname, '../../data/processedMembers.json');
        
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

            // Load processed members from file
            this.loadProcessedMembers();

            // Load existing recruitment invite or generate new one
            await this.loadOrGenerateRecruitmentInvite(channel);

            // Cache all server invites for tracking
            await this.cacheServerInvites(channel.guild);

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
        // Prevent duplicate event listeners
        if (this.buttonHandlerSetup) {
            return;
        }
        this.buttonHandlerSetup = true;
        
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isButton()) return;
            
            console.log(`[RECRUITMENT] Button interaction received: ${interaction.customId}`);
            
            // Handle recruitment invite reset
            if (interaction.customId === 'reset_recruitment_invite') {
                await this.handleResetInvite(interaction);
                return;
            }
            
            // Handle approval buttons
            if (interaction.customId.startsWith('approve_')) {
                console.log(`[RECRUITMENT] Processing approval button: ${interaction.customId}`);
                await this.handleApprovalButton(interaction);
                return;
            }
        });

        // Also listen for invite create/delete to update cache
        this.client.on('inviteCreate', (invite) => {
            this.inviteCache.set(invite.code, invite.uses || 0);
            console.log(`[STATUS MONITOR] Cached new invite: ${invite.code}`);
        });

        this.client.on('inviteDelete', (invite) => {
            this.inviteCache.delete(invite.code);
            console.log(`[STATUS MONITOR] Removed deleted invite from cache: ${invite.code}`);
        });
    }

    async handleResetInvite(interaction) {
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
    }

    async handleApprovalButton(interaction) {
        console.log(`[RECRUITMENT] Handling approval button: ${interaction.customId} from user: ${interaction.user.tag}`);
        
        // Parse the custom ID: approve_TYPE_approval_MEMBERID_TIMESTAMP
        const parts = interaction.customId.split('_');
        console.log(`[RECRUITMENT] Button ID parts: ${JSON.stringify(parts)}`);
        
        if (parts.length < 5) {
            console.log(`[RECRUITMENT] Invalid button ID format: ${interaction.customId}`);
            await interaction.reply({
                content: '❌ Invalid approval request format.',
                ephemeral: true
            });
            return;
        }
        
        const action = parts[0]; // 'approve'
        const type = parts[1];   // 'hidden' or 'deny'
        const approvalWord = parts[2]; // 'approval'
        const memberId = parts[3]; // member ID
        const timestamp = parts[4]; // timestamp
        
        const approvalId = `approval_${memberId}_${timestamp}`;
        console.log(`[RECRUITMENT] Reconstructed approval ID: ${approvalId}`);
        
        const approvalData = this.pendingApprovals.get(approvalId);
        if (!approvalData) {
            console.log(`[RECRUITMENT] No approval data found for ID: ${approvalId}`);
            
            // Check if this member already has the role (was processed already)
            try {
                const guild = this.client.guilds.cache.first();
                if (guild) {
                    const member = await guild.members.fetch(memberId);
                    if (member.roles.cache.has(this.config.hiddenChannelRoleId)) {
                        await interaction.reply({
                            content: '✅ This member has already been processed and has hidden channel access.',
                            ephemeral: true
                        });
                        return;
                    }
                }
            } catch (memberCheckError) {
                console.log(`[RECRUITMENT] Could not check member status: ${memberCheckError.message}`);
            }
            
            await interaction.reply({
                content: '❌ This approval request has expired or is no longer valid.',
                ephemeral: true
            });
            return;
        }
        
        console.log(`[RECRUITMENT] Found approval data: inviterId=${approvalData.inviterId}, clickerId=${interaction.user.id}`);

        // Verify the user clicking is the inviter
        if (interaction.user.id !== approvalData.inviterId) {
            console.log(`[RECRUITMENT] User mismatch: expected ${approvalData.inviterId}, got ${interaction.user.id}`);
            await interaction.reply({
                content: '❌ Only the person who invited this member can make this decision.',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({ ephemeral: true });
        console.log(`[RECRUITMENT] Processing ${type} approval for member ${approvalData.newMemberId}`);

        try {
            // Get guild from the bot's cache since this is a DM interaction
            const guild = this.client.guilds.cache.first(); // or use a specific guild ID if you have multiple
            if (!guild) {
                throw new Error('Could not find guild');
            }
            
            const newMember = await guild.members.fetch(approvalData.newMemberId);
            
            let resultMessage = '';
            
            if (type === 'hidden') {
                // Assign hidden channel access role
                const hiddenChannelRoleId = this.config.hiddenChannelRoleId;
                
                if (hiddenChannelRoleId) {
                    const hiddenRole = guild.roles.cache.get(hiddenChannelRoleId);
                    if (hiddenRole) {
                        await newMember.roles.add(hiddenRole);
                        resultMessage = `✅ Assigned hidden channel access to ${newMember.user.tag}`;
                        console.log(`[RECRUITMENT] Successfully assigned hidden channel role to ${newMember.user.tag}`);
                    } else {
                        resultMessage = `❌ Hidden channel role not found`;
                        console.log(`[RECRUITMENT] Hidden channel role not found: ${hiddenChannelRoleId}`);
                    }
                } else {
                    resultMessage = `❌ Hidden channel role not configured`;
                    console.log(`[RECRUITMENT] Hidden channel role not configured`);
                }
            } else if (type === 'deny') {
                resultMessage = `✅ No special roles assigned to ${newMember.user.tag}`;
                console.log(`[RECRUITMENT] Denied access for ${newMember.user.tag}`);
            }

            // Log the approval decision
            await this.logApprovalDecision(newMember, interaction.user, type, approvalData);

            // Mark member as processed to prevent future duplicate approvals
            this.markMemberAsProcessed(approvalData.newMemberId);

            await interaction.editReply({ content: resultMessage });
            
            // Remove from pending approvals
            this.pendingApprovals.delete(approvalId);
            console.log(`[RECRUITMENT] Approval process completed for ${newMember.user.tag}`);
            
        } catch (error) {
            await interaction.editReply({
                content: '❌ Failed to process approval. Please try again or contact an admin.'
            });
            console.error('[RECRUITMENT] Failed to process approval:', error);
        }
    }

    async logApprovalDecision(newMember, approver, decision, approvalData) {
        try {
            const channel = await this.client.channels.fetch(this.config.botLogsChannelId);
            if (!channel) return;

            const decisionText = {
                'recruitment': 'Recruitment Role Only',
                'hidden': 'Hidden Channels Access',
                'deny': 'No Special Access'
            };

            const embed = new EmbedBuilder()
                .setTitle('✅ Member Approval Decision')
                .setDescription(`**${approver.tag}** made a decision for **${newMember.user.tag}**`)
                .setColor('#57F287')
                .addFields(
                    { name: '👤 New Member', value: `<@${newMember.id}>`, inline: true },
                    { name: '👨‍💼 Approver', value: `<@${approver.id}>`, inline: true },
                    { name: '🔗 Invite Used', value: approvalData.inviteCode, inline: true },
                    { name: '✅ Decision', value: decisionText[decision] || 'Unknown', inline: false }
                )
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            
        } catch (error) {
            console.error('[RECRUITMENT] Failed to log approval decision:', error);
        }
    }

    trackInviteUsage() {
        // Prevent duplicate event listeners
        if (this.inviteTrackingSetup) {
            return;
        }
        this.inviteTrackingSetup = true;
        
        // Check for any recent members we might have missed on startup
        this.checkRecentMembers();
        
        // Listen for new members and check if they used our recruitment invite
        this.client.on('guildMemberAdd', async (member) => {
            try {
                console.log(`[RECRUITMENT] Member joined: ${member.user.tag}`);
                
                // Try to determine which invite was used (with retry logic)
                let usedInvite = null;
                let inviterMember = null;
                let attempt = 0;
                const maxAttempts = 3;
                
                while (!usedInvite && attempt < maxAttempts) {
                    attempt++;
                    
                    // Wait a moment for Discord to process the join (longer wait on retries)
                    const waitTime = attempt === 1 ? 1000 : 3000 * attempt;
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    
                    console.log(`[RECRUITMENT] Checking invite usage (attempt ${attempt}/${maxAttempts})`);
                    
                    const guild = member.guild;
                    const newInvites = await guild.invites.fetch();
                    
                    // Find which invite was used
                    for (const [code, oldUses] of this.inviteCache.entries()) {
                        const currentInvite = newInvites.find(inv => inv.code === code);
                        if (currentInvite && currentInvite.uses > oldUses) {
                            usedInvite = currentInvite;
                            inviterMember = currentInvite.inviter;
                            // Update cache
                            this.inviteCache.set(code, currentInvite.uses);
                            console.log(`[RECRUITMENT] Invite used: ${code} by inviter: ${inviterMember?.tag || 'Unknown'} (found on attempt ${attempt})`);
                            break;
                        }
                    }
                    
                    if (!usedInvite && attempt < maxAttempts) {
                        console.log(`[RECRUITMENT] Could not determine invite usage on attempt ${attempt}, retrying...`);
                    }
                }
                
                if (usedInvite) {
                    // Check if this was the bot's recruitment invite
                    if (usedInvite.code === this.recruitmentInvite?.code) {
                        // Handle bot recruitment invite (auto-assign role)
                        console.log(`[RECRUITMENT] Bot recruitment invite used`);
                        await this.handleBotRecruitment(member);
                    } else if (inviterMember) {
                        // Check if inviter has authorized role
                        const guildMember = await guild.members.fetch(inviterMember.id);
                        const hasAuthorizedRole = this.config.recruitmentSettings?.authorizedInviterRoles?.some(roleId => 
                            guildMember.roles.cache.has(roleId)
                        );
                        
                        console.log(`[RECRUITMENT] Inviter ${inviterMember.tag} has authorized role: ${hasAuthorizedRole}`);
                        
                        if (hasAuthorizedRole) {
                            // Send approval request to inviter
                            console.log(`[RECRUITMENT] Sending approval request to ${inviterMember.tag}`);
                            await this.sendApprovalRequest(member, guildMember, usedInvite);
                        }
                    }
                    
                    // Log all invite usage
                    await this.logInviteUsage(member, usedInvite, inviterMember);
                } else {
                    console.log(`[RECRUITMENT] Could not determine which invite was used for ${member.user.tag} after ${maxAttempts} attempts`);
                }
            } catch (error) {
                console.error('[RECRUITMENT] Error tracking invite usage:', error);
            }
        });
    }

    async checkRecentMembers() {
        try {
            console.log('[RECRUITMENT] Checking for recent members who might need approval...');
            
            const guild = this.client.guilds.cache.first();
            if (!guild) return;
            
            // Get members who joined in the last 24 hours
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            const recentMembers = guild.members.cache.filter(member => 
                member.joinedTimestamp > oneDayAgo && !member.user.bot
            );
            
            console.log(`[RECRUITMENT] Found ${recentMembers.size} recent members to check`);
            
            for (const [memberId, member] of recentMembers) {
                // Check if we've already processed this member
                if (this.processedMembers.has(memberId)) {
                    console.log(`[RECRUITMENT] Skipping ${member.user.tag} - already processed`);
                    continue;
                }
                
                // Check if this member already has the hidden channel role (already processed)
                if (member.roles.cache.has(this.config.hiddenChannelRoleId)) {
                    console.log(`[RECRUITMENT] Skipping ${member.user.tag} - already has hidden channel role`);
                    this.markMemberAsProcessed(memberId);
                    continue;
                }
                
                // Check if we already have a pending approval for this member
                const existingApproval = Array.from(this.pendingApprovals.values()).find(
                    approval => approval.newMemberId === memberId
                );
                if (existingApproval) {
                    console.log(`[RECRUITMENT] Skipping ${member.user.tag} - has pending approval`);
                    continue;
                }
                
                // Try to determine which invite they used by checking recent invite activity
                await this.retroactivelyCheckInvite(member);
                
                // Small delay between checks to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (error) {
            console.error('[RECRUITMENT] Error checking recent members:', error);
        }
    }

    async retroactivelyCheckInvite(member) {
        try {
            console.log(`[RECRUITMENT] Retroactively checking invite for ${member.user.tag}`);
            
            const guild = member.guild;
            
            // First, try to get the exact invite from audit logs
            try {
                const auditLogs = await guild.fetchAuditLogs({
                    type: AuditLogEvent.MemberAdd,
                    limit: 50
                });
                
                // Find the audit log entry for this specific member
                const memberAuditEntry = auditLogs.entries.find(entry => 
                    entry.target && entry.target.id === member.id
                );
                
                if (memberAuditEntry) {
                    console.log(`[RECRUITMENT] Found audit entry for ${member.user.tag}: ${JSON.stringify(memberAuditEntry.changes)}`);
                    
                    // Try different ways to get the invite code
                    let inviteCode = null;
                    
                    // Method 1: Check if there's an invite code in the changes
                    if (memberAuditEntry.changes) {
                        const inviteChange = memberAuditEntry.changes.find(change => 
                            change.key === 'invite_code' || change.key === '$add'
                        );
                        if (inviteChange && inviteChange.new) {
                            inviteCode = inviteChange.new;
                        }
                    }
                    
                    // Method 2: Check the reason field which sometimes contains invite info
                    if (!inviteCode && memberAuditEntry.reason) {
                        const inviteMatch = memberAuditEntry.reason.match(/invite[:\s]*([a-zA-Z0-9]+)/i);
                        if (inviteMatch) {
                            inviteCode = inviteMatch[1];
                        }
                    }
                    
                    // Method 3: Check extra data
                    if (!inviteCode && memberAuditEntry.extra) {
                        console.log(`[RECRUITMENT] Audit extra data: ${JSON.stringify(memberAuditEntry.extra)}`);
                        if (memberAuditEntry.extra.code) {
                            inviteCode = memberAuditEntry.extra.code;
                        }
                    }
                    
                    if (inviteCode) {
                        console.log(`[RECRUITMENT] Found exact invite from audit log: ${inviteCode}`);
                        
                        // Get the invite details
                        const currentInvites = await guild.invites.fetch();
                        const usedInvite = currentInvites.find(inv => inv.code === inviteCode);
                        
                        if (usedInvite && usedInvite.inviter) {
                            const inviterMember = await guild.members.fetch(usedInvite.inviter.id);
                            const hasAuthorizedRole = this.config.recruitmentSettings?.authorizedInviterRoles?.some(roleId => 
                                inviterMember.roles.cache.has(roleId)
                            );
                            
                            if (hasAuthorizedRole) {
                                console.log(`[RECRUITMENT] Exact match found: ${member.user.tag} used invite ${inviteCode} from authorized user ${usedInvite.inviter.tag}`);
                                await this.sendApprovalRequest(member, inviterMember, usedInvite);
                                await this.logInviteUsage(member, usedInvite, usedInvite.inviter, true);
                                return;
                            } else {
                                console.log(`[RECRUITMENT] ${member.user.tag} used invite ${inviteCode} from ${usedInvite.inviter.tag}, but inviter is not authorized`);
                                return;
                            }
                        }
                    } else {
                        console.log(`[RECRUITMENT] Could not extract invite code from audit log`);
                    }
                }
            } catch (auditError) {
                console.log(`[RECRUITMENT] Could not access audit logs: ${auditError.message}`);
            }
            
            // Fallback to previous logic if audit logs don't work
            console.log(`[RECRUITMENT] Falling back to invite analysis for ${member.user.tag}`);
            
            const currentInvites = await guild.invites.fetch();
            
            // Get all invites from authorized users
            const authorizedInvites = [];
            
            for (const invite of currentInvites.values()) {
                if (!invite.inviter || invite.inviter.bot) continue;
                
                try {
                    const inviterMember = await guild.members.fetch(invite.inviter.id);
                    const hasAuthorizedRole = this.config.recruitmentSettings?.authorizedInviterRoles?.some(roleId => 
                        inviterMember.roles.cache.has(roleId)
                    );
                    
                    if (hasAuthorizedRole && invite.uses > 0) {
                        authorizedInvites.push({
                            invite,
                            inviterMember,
                            inviter: invite.inviter
                        });
                    }
                } catch (fetchError) {
                    // Skip if we can't fetch the inviter
                    continue;
                }
            }
            
            console.log(`[RECRUITMENT] Found ${authorizedInvites.length} authorized invites to check`);
            
            if (authorizedInvites.length === 0) {
                console.log(`[RECRUITMENT] No authorized invites found for ${member.user.tag}`);
                return;
            }
            
            // If there's only one authorized inviter with invites, assume it was them
            if (authorizedInvites.length === 1) {
                const { invite, inviterMember, inviter } = authorizedInvites[0];
                console.log(`[RECRUITMENT] Only one authorized inviter found: ${inviter.tag} - assuming they invited ${member.user.tag}`);
                
                await this.sendApprovalRequest(member, inviterMember, invite);
                await this.logInviteUsage(member, invite, inviter, true);
                return;
            }
            
            // Multiple authorized inviters - try to find the most likely one
            let bestMatch = null;
            let highestUses = 0;
            
            for (const { invite, inviterMember, inviter } of authorizedInvites) {
                if (invite.uses > highestUses) {
                    highestUses = invite.uses;
                    bestMatch = { invite, inviterMember, inviter };
                }
            }
            
            if (bestMatch) {
                console.log(`[RECRUITMENT] Best match for ${member.user.tag}: ${bestMatch.inviter.tag} (invite has ${highestUses} uses)`);
                await this.sendApprovalRequest(member, bestMatch.inviterMember, bestMatch.invite);
                await this.logInviteUsage(member, bestMatch.invite, bestMatch.inviter, true);
                return;
            }
            
            console.log(`[RECRUITMENT] Could not determine best match for ${member.user.tag}`);
        } catch (error) {
            console.error(`[RECRUITMENT] Error retroactively checking invite for ${member.user.tag}:`, error);
        }
    }

    loadProcessedMembers() {
        try {
            if (fs.existsSync(this.processedMembersFile)) {
                const data = JSON.parse(fs.readFileSync(this.processedMembersFile, 'utf8'));
                this.processedMembers = new Set(data.processedMembers || []);
                console.log(`[RECRUITMENT] Loaded ${this.processedMembers.size} processed members from file`);
            } else {
                this.processedMembers = new Set();
                console.log('[RECRUITMENT] No processed members file found, starting fresh');
            }
        } catch (error) {
            console.error('[RECRUITMENT] Error loading processed members:', error);
            this.processedMembers = new Set();
        }
    }

    saveProcessedMembers() {
        try {
            const data = {
                processedMembers: Array.from(this.processedMembers),
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(this.processedMembersFile, JSON.stringify(data, null, 2));
            console.log(`[RECRUITMENT] Saved ${this.processedMembers.size} processed members to file`);
        } catch (error) {
            console.error('[RECRUITMENT] Error saving processed members:', error);
        }
    }

    markMemberAsProcessed(memberId) {
        this.processedMembers.add(memberId);
        this.saveProcessedMembers();
        console.log(`[RECRUITMENT] Marked member ${memberId} as processed`);
    }

    async cacheServerInvites(guild) {
        try {
            const invites = await guild.invites.fetch();
            this.inviteCache.clear();
            invites.forEach(invite => {
                this.inviteCache.set(invite.code, invite.uses || 0);
            });
            console.log(`[STATUS MONITOR] Cached ${invites.size} server invites`);
        } catch (error) {
            console.error('[STATUS MONITOR] Failed to cache server invites:', error);
        }
    }

    async handleBotRecruitment(member) {
        try {
            // Auto-assign hidden channel role for bot invite
            const hiddenChannelRoleId = this.config.hiddenChannelRoleId;
            if (hiddenChannelRoleId) {
                const role = member.guild.roles.cache.get(hiddenChannelRoleId);
                if (role) {
                    await member.roles.add(role);
                    console.log(`[RECRUITMENT] Auto-assigned hidden channel role to ${member.user.tag}`);
                }
            }
            
            // Update stored invite data
            this.recruitmentInvite.uses = (this.recruitmentInvite.uses || 0) + 1;
            await this.saveInviteData();
            
        } catch (error) {
            console.error('[RECRUITMENT] Error handling bot recruitment:', error);
        }
    }

    async sendApprovalRequest(newMember, inviterMember, usedInvite) {
        try {
            const approvalId = `approval_${newMember.id}_${Date.now()}`;
            
            const embed = new EmbedBuilder()
                .setTitle('🎯 Member Access Request')
                .setDescription(`**${newMember.user.tag}** joined the server using your invite!\n\nShould <@${newMember.id}> be granted access to hidden channels?`)
                .setThumbnail(newMember.user.displayAvatarURL())
                .setColor('#FFD700')
                .addFields(
                    { name: '👤 New Member', value: `${newMember.user.tag}`, inline: true },
                    { name: '🔗 Invite Code', value: usedInvite.code, inline: true },
                    { name: '📅 Joined', value: `<t:${Math.floor(newMember.joinedTimestamp / 1000)}:R>`, inline: true }
                )
                .setFooter({ text: 'This approval request will expire in 60 minutes' })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`approve_hidden_${approvalId}`)
                        .setLabel('✅ Yes - Grant Access')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`approve_deny_${approvalId}`)
                        .setLabel('❌ No - Regular Access Only')
                        .setStyle(ButtonStyle.Secondary)
                );

            // Store approval data
            this.pendingApprovals.set(approvalId, {
                newMemberId: newMember.id,
                inviterId: inviterMember.id,
                inviteCode: usedInvite.code,
                timestamp: Date.now()
            });

            // Set timeout to auto-expire
            const timeoutMinutes = this.config.recruitmentSettings?.approvalTimeoutMinutes || 60;
            setTimeout(() => {
                this.pendingApprovals.delete(approvalId);
            }, timeoutMinutes * 60 * 1000);

            await inviterMember.send({ embeds: [embed], components: [row] });
            console.log(`[RECRUITMENT] Sent approval request to ${inviterMember.user.tag} for ${newMember.user.tag}`);
            
        } catch (error) {
            console.error('[RECRUITMENT] Failed to send approval request:', error);
        }
    }

    async logInviteUsage(member, invite, inviter, isRetroactive = false) {
        try {
            // Use different channel for retroactive checks
            const channelId = isRetroactive ? '1333093713412358186' : this.config.botLogsChannelId;
            const channel = await this.client.channels.fetch(channelId);
            if (!channel) return;

            const title = isRetroactive ? '🔍 Member Join (Retroactive Check)' : '👥 Member Joined';
            const description = isRetroactive 
                ? `**${member.user.tag}** - retroactive invite check completed`
                : `**${member.user.tag}** joined the server`;

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(isRetroactive ? '#FFA500' : '#57F287')
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: '👤 User', value: `<@${member.id}>`, inline: true },
                    { name: '🔗 Invite', value: invite.code, inline: true },
                    { name: '👨‍💼 Inviter', value: inviter ? `<@${inviter.id}>` : 'Unknown', inline: true },
                    { name: '📅 Joined', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                    { name: '📊 Invite Uses', value: `${invite.uses || 0}`, inline: true }
                )
                .setTimestamp();

            if (isRetroactive) {
                embed.setFooter({ text: 'This member was processed after initial join detection' });
            }

            await channel.send({ embeds: [embed] });
            console.log(`[RECRUITMENT] Logged invite usage: ${member.user.tag} ${isRetroactive ? '(retroactive)' : ''}`);
            
        } catch (error) {
            console.error('[RECRUITMENT] Failed to log invite usage:', error);
        }
    }

    async logRecruitment(member) {
        // This method is now integrated into logInviteUsage and handleBotRecruitment
        // Keeping for backwards compatibility but functionality moved to new methods
        await this.logInviteUsage(member, this.recruitmentInvite, null);
    }
}

module.exports = StatusMonitor;
