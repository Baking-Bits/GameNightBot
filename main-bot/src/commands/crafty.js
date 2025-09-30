const { craftyApiKey, adminRoles } = require('../../../config.json');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

let fetch;
const API_BASE_URL = 'https://crafty.gamenight.fun/api/v2';

module.exports = {
    data: {
        name: 'crafty',
        description: 'CraftyControl server management interface'
    },
    async execute(interaction) {
        try {
            // Import fetch dynamically
            if (!fetch) {
                fetch = (await import('node-fetch')).default;
            }

            const isAdmin = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
            await showServerDashboard(interaction, isAdmin);
        } catch (error) {
            console.error('Error in crafty command:', error);
            await interaction.reply({ 
                content: '❌ Failed to load Crafty interface. Please try again.', 
                ephemeral: true 
            });
        }
    },
};

async function fetchServers() {
    try {
        const response = await fetch(`${API_BASE_URL}/servers`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${craftyApiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid response format from Crafty API');
        }
        
        return data.data || [];
    } catch (error) {
        console.error('Crafty API Error:', error);
        throw new Error(`Failed to connect to Crafty API: ${error.message}`);
    }
}

async function showServerDashboard(interaction, isAdmin) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const servers = await fetchServers();
        
        if (servers.length === 0) {
            await interaction.editReply({ content: '❌ No servers found.' });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('🖥️ CraftyControl Server Dashboard')
            .setColor('#4CAF50')
            .setTimestamp();

        // Show server summary
        const onlineServers = servers.filter(s => s.show_status).length;
        const totalServers = servers.length;
        
        embed.setDescription(
            `**${onlineServers}/${totalServers} servers online**\n\n` +
            (isAdmin ? '**Admin Access:** Select a server below for management options' : '**View-Only Access:** Contact an admin for server management')
        );

        // Create compact server list with names and status
        const serverItems = servers.map(server => {
            const statusIcon = server.show_status ? '🟢' : '🔴';
            return `${statusIcon} **${server.server_name}** (${server.server_ip}:${server.server_port})`;
        });

        // Split servers into multiple fields to avoid Discord's 1024 character limit per field
        const chunkSize = 5; // Max 5 servers per field to stay under character limit
        const serverChunks = [];
        for (let i = 0; i < serverItems.length; i += chunkSize) {
            serverChunks.push(serverItems.slice(i, i + chunkSize));
        }

        // Add server fields
        serverChunks.forEach((chunk, index) => {
            const fieldName = serverChunks.length > 1 ? 
                `🖥️ Servers (${index * chunkSize + 1}-${Math.min((index + 1) * chunkSize, servers.length)})` : 
                '🖥️ All Servers';
            
            embed.addFields({
                name: fieldName,
                value: chunk.join('\n'),
                inline: false
            });
        });

        const components = [];
        
        // Always show refresh button
        const refreshRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('crafty_refresh')
                    .setLabel('🔄 Refresh Status')
                    .setStyle(ButtonStyle.Secondary)
            );
        components.push(refreshRow);

        // Admin-only server selection for management
        if (isAdmin && servers.length > 0) {
            // Limit to 25 servers due to Discord select menu limitations
            const serverOptions = servers.slice(0, 25).map(server => ({
                label: server.server_name.length > 100 ? server.server_name.substring(0, 97) + '...' : server.server_name,
                description: `${server.server_ip}:${server.server_port} - ${server.show_status ? 'Online' : 'Offline'}`,
                value: server.server_id,
                emoji: server.show_status ? '🟢' : '🔴'
            }));

            const serverSelect = new StringSelectMenuBuilder()
                .setCustomId('crafty_server_select')
                .setPlaceholder('🔧 Select server for management...')
                .addOptions(serverOptions);

            const selectRow = new ActionRowBuilder().addComponents(serverSelect);
            components.push(selectRow);
        }

        await interaction.editReply({
            embeds: [embed],
            components: components
        });

        // Single collector to handle all interactions
        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 300000 // 5 minutes
        });

        collector.on('collect', async (i) => {
            try {
                if (i.customId === 'crafty_refresh') {
                    await i.deferUpdate();
                    collector.stop();
                    await showServerDashboard(interaction, isAdmin);
                    return;
                }
                
                if (i.customId === 'crafty_server_select' && isAdmin) {
                    const serverId = i.values[0];
                    const server = servers.find(s => s.server_id === serverId);
                    await showServerManagement(i, server);
                    return;
                }
                
            } catch (error) {
                console.error('Crafty collector error:', error);
                if (!i.replied && !i.deferred) {
                    try {
                        await i.reply({ content: '❌ Error processing request', ephemeral: true });
                    } catch (e) {
                        console.error('Failed to send error reply:', e);
                    }
                }
            }
        });

        collector.on('end', () => {
            // Disable components when collector expires
            const disabledComponents = components.map(row => {
                const newRow = ActionRowBuilder.from(row);
                newRow.components.forEach(component => component.setDisabled(true));
                return newRow;
            });
            
            interaction.editReply({
                components: disabledComponents
            }).catch(() => {});
        });

    } catch (error) {
        await interaction.editReply({ 
            content: `❌ Failed to load server dashboard: ${error.message}` 
        });
    }
}

async function showServerManagement(interaction, server) {
    if (!server) {
        await interaction.reply({ content: '❌ Server not found', ephemeral: true });
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(`🛠️ ${server.server_name}`)
        .setDescription(`**Server Management Panel**\nChoose an action for this server`)
        .setColor(server.show_status ? '#4CAF50' : '#F44336')
        .addFields(
            { name: '📋 Details', value: `**ID:** \`${server.server_id}\`\n**Address:** ${server.server_ip}:${server.server_port}\n**Type:** ${server.type}`, inline: true },
            { name: '📊 Status', value: server.show_status ? '🟢 Online' : '🔴 Offline', inline: true },
            { name: '🚀 Auto-start', value: server.auto_start ? '✅ Enabled' : '❌ Disabled', inline: true }
        )
        .setTimestamp();

    // Management action buttons
    const actionRow1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`server_logs_${server.server_id}`)
                .setLabel('📝 View Logs')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`server_stats_${server.server_id}`)
                .setLabel('📊 Statistics')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`server_command_${server.server_id}`)
                .setLabel('⚡ Send Command')
                .setStyle(ButtonStyle.Secondary)
        );

    const actionRow2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`server_start_${server.server_id}`)
                .setLabel('▶️ Start')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`server_stop_${server.server_id}`)
                .setLabel('⏹️ Stop')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`server_restart_${server.server_id}`)
                .setLabel('🔄 Restart')
                .setStyle(ButtonStyle.Primary)
        );

    await interaction.reply({
        embeds: [embed],
        components: [actionRow1, actionRow2],
        ephemeral: true
    });

    // Handle management actions with a dedicated collector
    const managementCollector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && i.customId.includes(server.server_id),
        time: 300000 // 5 minutes
    });

    managementCollector.on('collect', async (i) => {
        const action = i.customId.split('_')[1]; // Extract action from customId
        
        try {
            switch (action) {
                case 'logs':
                    await handleServerLogs(i, server);
                    break;
                case 'stats':
                    await handleServerStats(i, server);
                    break;
                case 'command':
                    await handleSendCommand(i, server);
                    break;
                case 'start':
                case 'stop':
                case 'restart':
                    await handleServerAction(i, server, action);
                    break;
                default:
                    await i.reply({ content: '❌ Unknown action', ephemeral: true });
            }
        } catch (error) {
            console.error(`Error handling ${action} for server ${server.server_id}:`, error);
            if (!i.replied && !i.deferred) {
                await i.reply({ content: `❌ Error performing ${action}`, ephemeral: true });
            }
        }
    });

    managementCollector.on('end', () => {
        // Disable buttons when collector expires
        const disabledRow1 = ActionRowBuilder.from(actionRow1);
        disabledRow1.components.forEach(btn => btn.setDisabled(true));
        
        const disabledRow2 = ActionRowBuilder.from(actionRow2);
        disabledRow2.components.forEach(btn => btn.setDisabled(true));
        
        interaction.editReply({
            components: [disabledRow1, disabledRow2]
        }).catch(() => {});
    });
}

async function handleServerLogs(interaction, server) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const response = await fetch(`${API_BASE_URL}/servers/${server.server_id}/logs`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${craftyApiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error fetching logs: ${response.statusText}`);
        }
        
        const logs = await response.json();
        const logLines = logs.data || [];
        const recentLogs = logLines.slice(-20); // Last 20 lines
        const logText = recentLogs.join('\n');
        
        const embed = new EmbedBuilder()
            .setTitle(`📝 ${server.server_name} - Server Logs`)
            .setColor('#FF9800')
            .setTimestamp();

        if (logText.length > 4000) {
            embed.setDescription(`\`\`\`\n${logText.substring(0, 4000)}...\n\`\`\``);
        } else if (logText.length > 0) {
            embed.setDescription(`\`\`\`\n${logText}\n\`\`\``);
        } else {
            embed.setDescription('No recent logs available.');
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply({ content: `❌ Failed to fetch logs: ${error.message}` });
    }
}

async function handleServerStats(interaction, server) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const response = await fetch(`${API_BASE_URL}/servers/${server.server_id}/stats`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${craftyApiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error fetching stats: ${response.statusText}`);
        }
        
        const statsResponse = await response.json();
        const stats = statsResponse.data; // The actual data is in the 'data' field
        
        // Format memory value
        const memoryValue = stats.mem || 'Unknown';
        const memoryPercent = stats.mem_percent ? ` (${stats.mem_percent}%)` : '';
        
        // Format uptime from started date
        let uptimeValue = 'Unknown';
        if (stats.started) {
            const startDate = new Date(stats.started);
            const now = new Date();
            const uptimeMs = now - startDate;
            const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
            
            if (days > 0) {
                uptimeValue = `${days}d ${hours}h ${minutes}m`;
            } else if (hours > 0) {
                uptimeValue = `${hours}h ${minutes}m`;
            } else {
                uptimeValue = `${minutes}m`;
            }
        }
        
        // Parse players array
        let playersArray = [];
        try {
            playersArray = JSON.parse(stats.players || '[]');
        } catch (e) {
            playersArray = [];
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`📊 ${server.server_name} - Statistics`)
            .setColor(stats.running ? '#4CAF50' : '#f44336')
            .addFields(
                { name: '🏃 Status', value: stats.running ? '🟢 Running' : '🔴 Stopped', inline: true },
                { name: '🏷️ Version', value: stats.version || 'Unknown', inline: true },
                { name: '🌐 Address', value: `${stats.server_id?.server_ip || server.server_ip}:${stats.server_port || server.server_port}`, inline: true },
                { name: '👥 Players', value: `${stats.online || 0}/${stats.max || 0}`, inline: true },
                { name: '💾 Memory', value: `${memoryValue}${memoryPercent}`, inline: true },
                { name: '⏱️ Uptime', value: uptimeValue, inline: true },
                { name: '⚡ CPU Usage', value: `${stats.cpu || 0}%`, inline: true },
                { name: '🌍 World', value: stats.world_name || 'Unknown', inline: true },
                { name: '💾 World Size', value: stats.world_size || 'Unknown', inline: true }
            )
            .setTimestamp();

        // Add player list if there are players online
        if (playersArray.length > 0) {
            const playerNames = playersArray.map(p => p.name || p).join(', ');
            embed.addFields([
                { name: '👤 Online Players', value: playerNames.length > 1024 ? playerNames.substring(0, 1021) + '...' : playerNames, inline: false }
            ]);
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply({ content: `❌ Failed to fetch statistics: ${error.message}` });
    }
}

async function handleSendCommand(interaction, server) {
    const modal = new ModalBuilder()
        .setCustomId(`command_modal_${server.server_id}`)
        .setTitle(`Send Command to ${server.server_name}`);

    const commandInput = new TextInputBuilder()
        .setCustomId('command_text')
        .setLabel('Command to execute')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter command (e.g., say Hello World!)')
        .setRequired(true)
        .setMaxLength(500);

    const row = new ActionRowBuilder().addComponents(commandInput);
    modal.addComponents(row);

    await interaction.showModal(modal);

    // Handle the modal submission
    try {
        const modalSubmission = await interaction.awaitModalSubmit({
            filter: i => i.customId === `command_modal_${server.server_id}` && i.user.id === interaction.user.id,
            time: 120000 // 2 minutes
        });

        const command = modalSubmission.fields.getTextInputValue('command_text');
        await executeServerCommand(modalSubmission, server, command);
    } catch (error) {
        console.error('Modal submission timeout or error:', error);
    }
}

async function executeServerCommand(interaction, server, command) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const response = await fetch(`${API_BASE_URL}/servers/${server.server_id}/action`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${craftyApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'send_command', command: command })
        });
        
        if (!response.ok) {
            throw new Error(`Error sending command: ${response.statusText}`);
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`⚡ Command Sent to ${server.server_name}`)
            .setDescription(`✅ Successfully sent command: \`${command}\``)
            .setColor('#4CAF50')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply({ 
            content: `❌ Failed to send command: ${error.message}` 
        });
    }
}

async function handleServerAction(interaction, server, action) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const response = await fetch(`${API_BASE_URL}/servers/${server.server_id}/action`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${craftyApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: `${action}_server` })
        });
        
        if (!response.ok) {
            throw new Error(`Error performing ${action}: ${response.statusText}`);
        }
        
        const actionEmojis = { 'start': '▶️', 'stop': '⏹️', 'restart': '🔄' };
        
        const embed = new EmbedBuilder()
            .setTitle(`${actionEmojis[action]} ${server.server_name}`)
            .setDescription(`✅ Successfully initiated **${action.toUpperCase()}** action`)
            .setColor('#4CAF50')
            .addFields(
                { name: '🖥️ Server', value: server.server_name, inline: true },
                { name: '⚡ Action', value: action.toUpperCase(), inline: true },
                { name: '⏱️ Status', value: 'In Progress...', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Action may take a few moments to complete' });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply({ 
            content: `❌ Failed to ${action} **${server.server_name}**: ${error.message}` 
        });
    }
}