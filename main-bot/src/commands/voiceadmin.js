const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voiceadmin')
        .setDescription('Voice tracking administration panel (Admin only)'),

    async execute(interaction, bot) {
        console.log('[VOICEADMIN] Execute called - showing GUI interface');

        // Check if user has admin permissions
        const isAdmin = bot.config.adminRoles?.some(roleId => 
            interaction.member?.roles.cache.has(roleId)
        );

        if (!isAdmin) {
            await interaction.reply({
                content: '❌ You do not have permission to use this command.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        await showVoiceAdminPanel(interaction, bot);
    }
};

async function showVoiceAdminPanel(interaction, bot) {
    const embed = new EmbedBuilder()
        .setTitle('🎙️ Voice Tracking Administration')
        .setDescription('Manage the voice tracking system - view analytics, manage settings, and control tracking.')
        .setColor('#9C27B0')
        .addFields(
            { name: '📊 Server Analytics', value: 'Comprehensive voice activity analytics', inline: true },
            { name: '📈 Detailed Statistics', value: 'Advanced voice tracking metrics', inline: true },
            { name: '🔧 System Controls', value: 'Voice tracking configuration', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Select an option below to manage voice tracking • Today at ' + new Date().toLocaleTimeString() });

    // Main action menu
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('voice_admin_action')
        .setPlaceholder('Choose an action...')
        .addOptions([
            {
                label: '📊 Server Analytics',
                description: 'View comprehensive server voice analytics (replaces /allstats)',
                value: 'analytics',
                emoji: '📊'
            },
            {
                label: '📈 Detailed Statistics',
                description: 'Advanced voice tracking metrics and trends',
                value: 'detailed_stats',
                emoji: '📈'
            },
            {
                label: '📅 Historical Data', 
                description: 'Long-term voice activity trends',
                value: 'historical',
                emoji: '📅'
            },
            {
                label: '👥 User Management',
                description: 'Manage individual user voice tracking',
                value: 'user_management',
                emoji: '👥'
            },
            {
                label: '⚙️ System Configuration',
                description: 'Voice tracking settings and controls',
                value: 'config',
                emoji: '⚙️'
            },
            {
                label: '🔄 Refresh Panel',
                description: 'Refresh this admin panel',
                value: 'refresh',
                emoji: '🔄'
            }
        ]);

    // Quick action buttons
    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('voice_quick_leaderboard')
                .setLabel('🏆 Quick Leaderboard')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('voice_reset_data')
                .setLabel('🗑️ Reset Data')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('voice_export_data')
                .setLabel('📤 Export Data')
                .setStyle(ButtonStyle.Primary)
        );

    // System control buttons
    const buttonRow2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('voice_system_status')
                .setLabel('🔍 System Status')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('voice_toggle_tracking')
                .setLabel('⏸️ Toggle Tracking')
                .setStyle(ButtonStyle.Secondary)
        );

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
        embeds: [embed],
        components: [selectRow, buttonRow, buttonRow2],
        flags: MessageFlags.Ephemeral
    });

    // Set up collector for interactions
    const filter = (i) => i.user.id === interaction.user.id && i.customId.startsWith('voice_');
    const collector = interaction.channel.createMessageComponentCollector({ 
        filter, 
        time: 600000 // 10 minutes
    });

    collector.on('collect', async (i) => {
        try {
            if (i.isStringSelectMenu()) {
                await handleVoiceAdminAction(i, bot);
            } else if (i.isButton()) {
                await handleVoiceButtonAction(i, bot);
            }
        } catch (error) {
            console.error('Error handling voice admin GUI:', error);
            if (!i.replied && !i.deferred) {
                try {
                    await i.reply({
                        content: '❌ An error occurred while processing your request.',
                        flags: MessageFlags.Ephemeral
                    });
                } catch (replyError) {
                    console.error('Failed to send error message:', replyError);
                }
            }
        }
    });

    collector.on('end', () => {
        // Disable components when collector expires
        const disabledSelectMenu = StringSelectMenuBuilder.from(selectMenu).setDisabled(true);
        const disabledButtons = buttonRow.components.map(button => 
            ButtonBuilder.from(button).setDisabled(true)
        );
        const disabledButtons2 = buttonRow2.components.map(button => 
            ButtonBuilder.from(button).setDisabled(true)
        );
        const disabledSelectRow = new ActionRowBuilder().addComponents(disabledSelectMenu);
        const disabledButtonRow = new ActionRowBuilder().addComponents(disabledButtons);
        const disabledButtonRow2 = new ActionRowBuilder().addComponents(disabledButtons2);

        interaction.editReply({
            embeds: [embed.setFooter({ text: '⏰ Admin panel expired - use /voiceadmin again' })],
            components: [disabledSelectRow, disabledButtonRow, disabledButtonRow2]
        }).catch(() => {});
    });
}

// Handle select menu actions
async function handleVoiceAdminAction(interaction, bot) {
    const action = interaction.values[0];
    
    switch (action) {
        case 'analytics':
            await handleServerAnalytics(interaction, bot);
            break;
        case 'detailed_stats':
            await handleDetailedStats(interaction, bot);
            break;
        case 'historical':
            await handleHistoricalData(interaction, bot);
            break;
        case 'user_management':
            await handleUserManagement(interaction, bot);
            break;
        case 'config':
            await handleSystemConfig(interaction, bot);
            break;
        case 'refresh':
            await showVoiceAdminPanel(interaction, bot);
            break;
        default:
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Unknown action selected.',
                    flags: MessageFlags.Ephemeral
                });
            }
    }
}

// Handle button actions
async function handleVoiceButtonAction(interaction, bot) {
    const action = interaction.customId.replace('voice_', '');
    
    switch (action) {
        case 'quick_leaderboard':
            await handleQuickLeaderboard(interaction, bot);
            break;
        case 'reset_data':
            await handleResetData(interaction, bot);
            break;
        case 'export_data':
            await handleExportData(interaction, bot);
            break;
        case 'system_status':
            await handleSystemStatus(interaction, bot);
            break;
        case 'toggle_tracking':
            await handleToggleTracking(interaction, bot);
            break;
        default:
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Unknown button action.',
                    flags: MessageFlags.Ephemeral
                });
            }
    }
}

// Server Analytics (replaces /allstats)
async function handleServerAnalytics(interaction, bot) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    try {
        const { formatTime, formatTimeCompact, formatHour } = require('../utils/timeFormatter');
        const schedule = await bot.db.getServerActivitySchedule(interaction.guildId);
        
        // Create server hourly activity chart
        const maxValue = Math.max(...schedule.hourlyData.map(h => h.total_time));
        const barLength = 15;
        
        let activityGraph = '```\nServer Hourly Activity (past 30 days):\n';
        for (let i = 0; i < 24; i++) {
            const hour = schedule.hourlyData.find(h => h.hour === i);
            const value = hour ? hour.total_time : 0;
            const users = hour ? hour.unique_users : 0;
            const bars = Math.round((value / maxValue) * barLength) || 0;
            const timeStr = formatTimeCompact(value).padEnd(12);
            activityGraph += `${formatHour(i).padStart(5)} |${'█'.repeat(bars)}${' '.repeat(barLength - bars)}| ${timeStr} (${users} users)\n`;
        }
        activityGraph += '```';
        
        // Create server daily activity chart
        let dailyGraph = '```\nServer Daily Activity:\n';
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const maxDayValue = Math.max(...schedule.dailyData.map(d => d.total_time));
        
        for (let i = 0; i < 7; i++) {
            const day = schedule.dailyData.find(d => d.day_of_week === i);
            const value = day ? day.total_time : 0;
            const users = day ? day.unique_users : 0;
            const bars = Math.round((value / maxDayValue) * barLength) || 0;
            const timeStr = formatTimeCompact(value).padEnd(12);
            dailyGraph += `${days[i].padStart(3)} |${'█'.repeat(bars)}${' '.repeat(barLength - bars)}| ${timeStr} (${users} users)\n`;
        }
        dailyGraph += '```';
        
        const embed = new EmbedBuilder()
            .setTitle(`🎙️ Voice Activity Stats for ${interaction.guild.name}`)
            .setColor('#5865F2')
            .addFields(
                { name: '📊 Total Users', value: `${schedule.totalUsers}`, inline: true },
                { name: '⏰ Total Time', value: formatTime(schedule.totalTime), inline: true },
                { name: '👥 Avg Daily Users', value: `${schedule.avgDailyUsers}`, inline: true },
                { name: '🕒 Peak Hours', value: schedule.peakHours, inline: true },
                { name: '📅 Most Active Day', value: schedule.mostActive, inline: true },
                { name: '📈 Period', value: 'Last 30 Days', inline: true }
            )
            .setDescription(`${activityGraph}\n${dailyGraph}`)
            .setTimestamp()
            .setFooter({ text: 'Server Analytics', iconURL: interaction.guild.iconURL() });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in server analytics:', error);
        await interaction.editReply({
            content: '❌ Failed to load server analytics.'
        });
    }
}

// Quick Leaderboard
async function handleQuickLeaderboard(interaction, bot) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    try {
        const { formatTime } = require('../utils/timeFormatter');
        const leaderboard = await bot.db.getLeaderboard(interaction.guildId, 'all');
        
        if (leaderboard.length === 0) {
            await interaction.editReply({ content: 'No voice activity found.' });
            return;
        }
        
        let leaderboardText = '';
        for (let i = 0; i < Math.min(leaderboard.length, 10); i++) {
            const entry = leaderboard[i];
            try {
                const user = await interaction.client.users.fetch(entry.user_id);
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                leaderboardText += `${medal} **${user.username}** - ${formatTime(entry.total_time)}\n`;
            } catch (error) {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                leaderboardText += `${medal} **Unknown User** - ${formatTime(entry.total_time)}\n`;
            }
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`🏆 All Time Voice Leaderboard`)
            .setDescription(leaderboardText)
            .setColor('#FFD700')
            .setTimestamp()
            .setFooter({ text: `Quick Leaderboard • ${interaction.guild.name}`, iconURL: interaction.guild.iconURL() });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in quick leaderboard:', error);
        await interaction.editReply({
            content: '❌ Failed to load leaderboard.'
        });
    }
}

// System Status
async function handleSystemStatus(interaction, bot) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    try {
        const embed = new EmbedBuilder()
            .setTitle('🔍 Voice System Status')
            .setColor('#4CAF50')
            .addFields(
                { name: '🟢 Voice Tracking', value: 'Active', inline: true },
                { name: '📊 Database', value: bot.db ? 'Connected' : 'Disconnected', inline: true },
                { name: '⏰ Uptime', value: process.uptime() > 3600 ? `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m` : `${Math.floor(process.uptime() / 60)}m`, inline: true },
                { name: '🎙️ Voice State Tracking', value: 'Enabled', inline: true },
                { name: '💾 Memory Usage', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`, inline: true },
                { name: '🔄 Last Update', value: '<t:' + Math.floor(Date.now() / 1000) + ':R>', inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error showing voice system status:', error);
        await interaction.editReply({
            content: '❌ Failed to get system status.'
        });
    }
}

// Detailed Statistics
async function handleDetailedStats(interaction, bot) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    try {
        const embed = new EmbedBuilder()
            .setTitle('📈 Detailed Voice Statistics')
            .setDescription('Advanced voice tracking metrics and analysis.')
            .setColor('#9C27B0')
            .addFields(
                { name: '📊 Available Features', value: '• Server-wide activity patterns\n• Peak activity hours\n• User engagement trends\n• Channel popularity metrics', inline: false },
                { name: '🔧 Access Methods', value: 'Use `/voice leaderboard` for rankings\nUse `/voice personal` for individual stats\nUse Server Analytics for comprehensive data', inline: false }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in detailed stats:', error);
        await interaction.editReply({
            content: '❌ Failed to load detailed statistics.'
        });
    }
}

// Historical Data
async function handleHistoricalData(interaction, bot) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
        .setTitle('📅 Historical Voice Data')
        .setDescription('Long-term voice activity trends and historical analysis.')
        .setColor('#9C27B0')
        .addFields(
            { name: '📈 Trending Features', value: '• Weekly activity comparisons\n• Monthly growth patterns\n• Seasonal voice trends\n• User retention metrics', inline: false },
            { name: '🔍 Current Access', value: 'Historical data is accessible through:\n• `/voice time` with period options\n• `/voice average` for trend analysis\n• Server Analytics for comprehensive history', inline: false }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

// User Management
async function handleUserManagement(interaction, bot) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
        .setTitle('👥 User Management')
        .setDescription('Individual user voice tracking management and controls.')
        .setColor('#9C27B0')
        .addFields(
            { name: '🔧 User Operations', value: '• Individual user statistics\n• Voice time comparisons\n• User activity patterns\n• Personal tracking controls', inline: false },
            { name: '📊 Available Commands', value: '`/voice personal @user` - View user stats\n`/voice compare @user1 @user2` - Compare users\n`/voice time` - Check personal time', inline: false }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

// System Configuration
async function handleSystemConfig(interaction, bot) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
        .setTitle('⚙️ System Configuration')
        .setDescription('Voice tracking system settings and configuration options.')
        .setColor('#9C27B0')
        .addFields(
            { name: '🔧 Configuration Options', value: '• Voice tracking toggle\n• Data retention settings\n• Activity thresholds\n• Notification preferences', inline: false },
            { name: '💡 Current Status', value: 'Voice tracking is currently **active**\nAll users are being tracked automatically\nData is stored securely in the database', inline: false },
            { name: '⚠️ Administrative Note', value: 'Advanced configuration options require server administrator permissions and may affect bot performance.', inline: false }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

// Toggle Tracking
async function handleToggleTracking(interaction, bot) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
        .setTitle('⏸️ Toggle Voice Tracking')
        .setDescription('Control voice tracking system state.')
        .setColor('#FF9800')
        .addFields(
            { name: '🔄 Current State', value: 'Voice tracking is currently **ACTIVE**', inline: true },
            { name: '⚠️ Warning', value: 'Disabling tracking will stop data collection', inline: true },
            { name: '💡 Note', value: 'This feature requires additional confirmation mechanisms for safety.', inline: false }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

// Reset Data
async function handleResetData(interaction, bot) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Reset Voice Data')
        .setDescription('⚠️ **DANGER ZONE** - Data reset operations')
        .setColor('#F44336')
        .addFields(
            { name: '🚨 Critical Warning', value: 'This action would permanently delete voice tracking data', inline: false },
            { name: '🔒 Safety Measures', value: '• Requires multiple confirmations\n• Admin-only operation\n• Cannot be undone\n• Backup recommended', inline: false },
            { name: '💡 Alternative', value: 'Consider using data export before any reset operations', inline: false }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

// Export Data
async function handleExportData(interaction, bot) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
        .setTitle('📤 Export Voice Data')
        .setDescription('Export voice tracking data for backup or analysis.')
        .setColor('#2196F3')
        .addFields(
            { name: '📊 Export Options', value: '• CSV format for spreadsheet analysis\n• JSON format for data processing\n• Summary reports\n• Full database export', inline: false },
            { name: '🔧 Available Data', value: '• Individual user statistics\n• Server-wide analytics\n• Historical trends\n• Activity patterns', inline: false },
            { name: '💡 Current Access', value: 'Use existing commands for immediate data:\n`/voice leaderboard` - Rankings\n`/voice personal` - Individual stats', inline: false }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}