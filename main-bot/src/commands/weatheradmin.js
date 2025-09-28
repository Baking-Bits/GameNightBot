const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weatheradmin')
        .setDescription('Weather system administration panel (Admin only)'),

    async execute(interaction, bot) {
        console.log('[WEATHERADMIN] Execute called - showing GUI interface');

        // Check if user has admin permissions
        const isAdmin = bot.config.adminRoles?.some(roleId => 
            interaction.member?.roles.cache.has(roleId)
        );

        if (!isAdmin) {
            await interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true
            });
            return;
        }

        if (!bot.serviceManager) {
            await interaction.reply({
                content: '❌ Service manager is not initialized.',
                ephemeral: true
            });
            return;
        }

        // Check if weather service is healthy before proceeding
        if (!bot.serviceManager.isServiceHealthy('weather')) {
            await interaction.reply({
                content: '🔧 **Weather Service Temporarily Unavailable**\n\n' +
                        '⚠️ The weather service is starting up or needs to restart.\n' +
                        '⏱️ Please wait a moment and try again.\n\n' +
                        '**If this persists:**\n' +
                        '• The weather service may need to be restarted\n' +
                        '• Check if port 3001 is available\n' +
                        '• Contact an administrator',
                ephemeral: true
            });
            return;
        }

        // Create the admin interface
        await showWeatherAdminPanel(interaction, bot);
    }
};

async function handleAddUser(interaction, serviceManager) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user');
    const postalCode = interaction.options.getString('postalcode');
    const countryCode = interaction.options.getString('country');
    const displayName = user.displayName || user.username;

    try {
        // Validate postal code format using comprehensive validation
        const validation = validatePostalCode(postalCode);
        if (!validation.valid) {
            await interaction.editReply(`❌ ${validation.message}`);
            return;
        }

        // Use the ServiceManager's addWeatherUser method
        const response = await serviceManager.addWeatherUser(user.id, postalCode, countryCode, interaction.user.id);
        
        if (!response.success) {
            await interaction.editReply(`❌ ${response.message || 'Failed to add user to weather system.'}`);
            return;
        }

        // Use the response format from the API
        const embed = new EmbedBuilder()
            .setTitle(response.title || '✅ User Added Successfully')
            .setColor(response.color || '#4CAF50')
            .setTimestamp();

        // Add fields if they exist
        if (response.fields && response.fields.length > 0) {
            embed.addFields(response.fields);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error adding user:', error);
        await interaction.editReply('❌ Failed to add user. Please try again.');
    }
}

async function handleRemoveUser(interaction, serviceManager) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user');

    try {
        const response = await serviceManager.removeWeatherUser(user.id, interaction.user.id);
        
        if (!response.success) {
            await interaction.editReply(`❌ ${response.message || 'Failed to remove user from weather system.'}`);
            return;
        }

        // Use the response format from the API
        const embed = new EmbedBuilder()
            .setTitle(response.title || '✅ User Removed Successfully')
            .setColor(response.color || '#F44336')
            .setTimestamp();

        // Add description if it exists
        if (response.description) {
            embed.setDescription(response.description);
        }

        // Add fields if they exist
        if (response.fields && response.fields.length > 0) {
            embed.addFields(response.fields);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error removing user:', error);
        await interaction.editReply('❌ Failed to remove user. Please try again.');
    }
}

async function handleListUsers(interaction, serviceManager) {
    try {
        const response = await serviceManager.listWeatherUsers();
        
        if (!response.success) {
            await interaction.editReply(`❌ ${response.message || 'Failed to list users.'}`);
            return;
        }

        // The API returns a ready-to-use response with title, description, fields, etc.
        const embed = new EmbedBuilder()
            .setTitle(response.title || '🌤️ Weather System Users')
            .setColor(response.color || '#2196F3')
            .setDescription(response.description || 'No users found.')
            .setTimestamp();

        // Add fields if they exist
        if (response.fields && response.fields.length > 0) {
            embed.addFields(response.fields);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error listing users:', error);
        await interaction.editReply('❌ Failed to list users. Please try again.');
    }
}

async function handleSetActive(interaction, serviceManager) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user');
    const active = interaction.options.getBoolean('active');

    try {
        const response = await serviceManager.setWeatherUserActive(user.id, active, interaction.user.id);
        
        if (!response.success) {
            await interaction.editReply(`❌ ${response.message || 'Failed to update user status.'}`);
            return;
        }

        // Use the response format from the API
        const embed = new EmbedBuilder()
            .setTitle(response.title || '✅ User Status Updated')
            .setColor(response.color || (active ? '#4CAF50' : '#FF9800'))
            .setTimestamp();

        // Add description if it exists
        if (response.description) {
            embed.setDescription(response.description);
        }

        // Add fields if they exist
        if (response.fields && response.fields.length > 0) {
            embed.addFields(response.fields);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error setting user status:', error);
        await interaction.editReply('❌ Failed to update user status. Please try again.');
    }
}

async function handleSetScore(interaction, serviceManager) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user');
    const points = interaction.options.getInteger('points');

    try {
        const response = await serviceManager.setWeatherUserScore(user.id, points, interaction.user.id);
        
        if (!response.success) {
            await interaction.editReply(`❌ ${response.message || 'Failed to update user score.'}`);
            return;
        }

        // Use the response format from the API
        const embed = new EmbedBuilder()
            .setTitle(response.title || '✅ User Score Updated')
            .setColor(response.color || '#4CAF50')
            .setTimestamp();

        // Add description if it exists
        if (response.description) {
            embed.setDescription(response.description);
        }

        // Add fields if they exist
        if (response.fields && response.fields.length > 0) {
            embed.addFields(response.fields);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error setting user score:', error);
        await interaction.editReply('❌ Failed to update user score. Please try again.');
    }
}

// Main GUI interface function
async function showWeatherAdminPanel(interaction, bot) {
    try {
        // Get basic stats for the overview
        let leaderboard = [];
        let statsError = false;
        
        try {
            leaderboard = await bot.serviceManager.getShittyWeatherLeaderboard();
        } catch (error) {
            console.error('[WEATHERADMIN] Failed to get leaderboard for panel:', error);
            statsError = true;
            leaderboard = []; // Fallback to empty array
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🌤️ Weather System Admin Panel')
            .setDescription(statsError ? 
                '**⚠️ Service Temporarily Unavailable**\n🔄 Weather service is restarting...\n🔧 Admin functions available below\n\n*Some features may be limited until service is restored*' :
                `**Current System Status**\n👥 **Active Users:** ${leaderboard.length}\n🕐 **Points Awarded:** Every hour\n📊 **Fair Competition:** Active\n\n*Select an action below to manage the weather system*`)
            .setColor(statsError ? '#FF9800' : '#2196F3')
            .setTimestamp();

        // Create select menu for admin actions
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('weatheradmin_action')
            .setPlaceholder('Choose an admin action...')
            .addOptions([
                {
                    label: '👥 List All Users',
                    description: 'View all registered weather system users',
                    value: 'listusers',
                    emoji: '👥'
                },
                {
                    label: '📊 System Statistics',
                    description: 'View detailed weather system stats',
                    value: 'stats', 
                    emoji: '📊'
                },
                {
                    label: '💩 Award Points Manually',
                    description: 'Trigger manual shitty weather point awarding',
                    value: 'award',
                    emoji: '💩'
                },
                {
                    label: '📢 Send Daily Update',
                    description: 'Trigger daily weather update message',
                    value: 'trigger-update',
                    emoji: '📢'
                },
                {
                    label: '🎉 Send Weekly Celebration',
                    description: 'Trigger weekly celebration message',
                    value: 'trigger-celebration', 
                    emoji: '🎉'
                },
                {
                    label: '⚡ Trigger Weather Alerts',
                    description: 'Check weather & award points now',
                    value: 'trigger-alerts',
                    emoji: '⚡'
                }
            ]);

        // Create buttons for user management (requires additional input)
        const userManagementRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('weatheradmin_adduser')
                    .setLabel('Add User')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('➕'),
                new ButtonBuilder()
                    .setCustomId('weatheradmin_removeuser')
                    .setLabel('Remove User')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('➖'),
                new ButtonBuilder()
                    .setCustomId('weatheradmin_setactive')
                    .setLabel('Toggle Status')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄'),
                new ButtonBuilder()
                    .setCustomId('weatheradmin_setscore')
                    .setLabel('Set Score')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🎯')
            );

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            embeds: [embed],
            components: [selectRow, userManagementRow],
            ephemeral: true
        });

        // Set up interaction collector for the menu
        const filter = (i) => i.user.id === interaction.user.id && i.customId.startsWith('weatheradmin_');
        const collector = interaction.channel.createMessageComponentCollector({ 
            filter, 
            time: 300000 // 5 minutes
        });

        collector.on('collect', async (i) => {
            try {
                if (i.isStringSelectMenu()) {
                    const action = i.values[0];
                    await handleGuiAction(i, bot, action);
                } else if (i.isButton()) {
                    const action = i.customId.replace('weatheradmin_', '');
                    await handleUserManagementAction(i, bot, action);
                }
            } catch (error) {
                console.error('Error handling weatheradmin GUI interaction:', error);
                if (!i.replied && !i.deferred) {
                    await i.reply({
                        content: '❌ An error occurred while processing your request.',
                        ephemeral: true
                    });
                }
            }
        });

        collector.on('end', () => {
            // Disable components when collector expires
            const disabledSelectMenu = StringSelectMenuBuilder.from(selectMenu).setDisabled(true);
            const disabledButtons = userManagementRow.components.map(button => 
                ButtonBuilder.from(button).setDisabled(true)
            );
            const disabledUserRow = new ActionRowBuilder().addComponents(disabledButtons);
            const disabledSelectRow = new ActionRowBuilder().addComponents(disabledSelectMenu);

            interaction.editReply({
                embeds: [embed.setFooter({ text: '⏰ Admin panel expired - run /weatheradmin again' })],
                components: [disabledSelectRow, disabledUserRow]
            }).catch(() => {}); // Ignore errors if already deleted
        });

    } catch (error) {
        console.error('Error showing weather admin panel:', error);
        await interaction.reply({
            content: '❌ Failed to load weather admin panel.',
            ephemeral: true
        });
    }
}

// Handle select menu actions (no additional input needed)
async function handleGuiAction(interaction, bot, action) {
    await interaction.deferReply({ ephemeral: true });
    
    switch (action) {
        case 'listusers':
            await handleListUsers(interaction, bot.serviceManager);
            break;
        case 'stats':
            await handleStats(interaction, bot.serviceManager);
            break;
        case 'award':
            await handleManualAward(interaction, bot.serviceManager);
            break;
        case 'trigger-update':
            await handleTriggerUpdate(interaction, bot);
            break;
        case 'trigger-celebration':
            await handleTriggerCelebration(interaction, bot);
            break;
        case 'trigger-alerts':
            await handleTriggerAlerts(interaction, bot);
            break;
    }
}

// Handle user management actions (show user selection dropdowns)
async function handleUserManagementAction(interaction, bot, action) {
    // For actions that need user selection, show dropdown first
    if (['removeuser', 'setactive', 'setscore'].includes(action)) {
        await showUserInputModal(interaction, action);
        return;
    }
    
    // For adduser, show the modal since we need new user info
    let modal;
    
    switch (action) {
        case 'adduser':
            modal = new ModalBuilder()
                .setCustomId('weatheradmin_modal_adduser')
                .setTitle('Add User to Weather System')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('user_mention')
                            .setLabel('Discord User ID')
                            .setPlaceholder('Discord User ID (18-19 digits) - Right-click user → Copy User ID')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('postal_code')
                            .setLabel('Postal/ZIP Code')
                            .setPlaceholder('Enter their postal code (e.g., 12345, SW1A 1AA)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('country_code')
                            .setLabel('Country Code (Optional)')
                            .setPlaceholder('US, GB, CA, AU, DE, FR (leave blank for auto-detect)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                    )
                );
            break;

        // User management actions now use dropdowns instead of modals
        case 'removeuser':
        case 'setactive':
        case 'setscore':
            // These are handled by showUserSelectionPanel
            return;
    }
    
    if (modal) {
        await interaction.showModal(modal);
        
        // Set up modal submit handler
        const filter = (i) => i.customId.startsWith('weatheradmin_modal_') && i.user.id === interaction.user.id;
        
        try {
            const modalSubmission = await interaction.awaitModalSubmit({ filter, time: 300000 }); // 5 minutes
            await handleModalSubmission(modalSubmission, bot);
        } catch (error) {
            console.log('Modal submission timed out or failed:', error.message);
        }
    }
}

// Handle modal form submissions
// Helper function to parse user mention or ID
function parseUserInput(userInput) {
    // Check if it's a mention (<@123456789> or <@!123456789>)
    const mentionMatch = userInput.match(/^<@!?(\d+)>$/);
    if (mentionMatch) {
        return mentionMatch[1];
    }
    
    // Check if it's a raw Discord ID (18-19 digits)
    if (/^\d{17,19}$/.test(userInput.trim())) {
        return userInput.trim();
    }
    
    return null;
}

// Show user selection panel for management actions
async function showUserInputModal(interaction, action) {
    const modal = new ModalBuilder()
        .setCustomId(`weatheradmin_userinput_${action}`)
        .setTitle('Enter Discord User ID');

    let actionTitle = 'User Action';
    let actionDescription = 'Enter the Discord user ID (18-19 digits)';

    switch(action) {
        case 'removeuser':
            actionTitle = 'Remove User from Weather System';
            actionDescription = 'Enter the Discord ID of the user to remove';
            break;
        case 'setactive':
            actionTitle = 'Toggle User Active Status';
            actionDescription = 'Enter the Discord ID of the user to activate/deactivate';
            break;
        case 'setscore':
            actionTitle = 'Set User Weather Score';
            actionDescription = 'Enter the Discord ID of the user to set score for';
            break;
    }

    const userIdInput = new TextInputBuilder()
        .setCustomId('user_id')
        .setLabel('Discord User ID')
        .setPlaceholder('Example: 161637430540238849')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(17)
        .setMaxLength(20);

    const actionRow = new ActionRowBuilder().addComponents(userIdInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
}

// Old dropdown-based functions removed - now using simple modal inputs

// Show active status modal for specific user ID
async function showActiveStatusModalForUser(interaction, bot, userId) {
    const modal = new ModalBuilder()
        .setCustomId(`weatheradmin_activestatus_${userId}`)
        .setTitle('Set User Active Status');

    const statusInput = new TextInputBuilder()
        .setCustomId('active_status')
        .setLabel('Active Status (true/false)')
        .setPlaceholder('Enter: true (to activate) or false (to deactivate)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const actionRow = new ActionRowBuilder().addComponents(statusInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
}

// Show score input modal for specific user ID
async function showScoreInputModalForUser(interaction, bot, userId) {
    const modal = new ModalBuilder()
        .setCustomId(`weatheradmin_setscore_${userId}`)
        .setTitle('Set User Weather Score');

    const scoreInput = new TextInputBuilder()
        .setCustomId('user_score')
        .setLabel('Points to Set')
        .setPlaceholder('Enter the number of points (0 or higher)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const actionRow = new ActionRowBuilder().addComponents(scoreInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
}

async function handleModalSubmission(interaction, bot) {
    const modalId = interaction.customId;
    
    try {
        if (modalId === 'weatheradmin_modal_adduser') {
            const userInput = interaction.fields.getTextInputValue('user_mention');
            const postalCode = interaction.fields.getTextInputValue('postal_code');
            const countryCode = interaction.fields.getTextInputValue('country_code') || null;
            
            await interaction.deferReply({ ephemeral: true });
            
            // Parse user input (mention or ID)
            const userId = parseUserInput(userInput);
            if (!userId) {
                return await interaction.editReply({
                    content: '❌ Invalid user input. Please use @username or a Discord user ID (18-19 digits).\n\n**Examples:**\n• @john (mention the user)\n• 123456789012345678 (Discord ID)'
                });
            }
            
            // Validate user ID
            let user;
            try {
                user = await interaction.client.users.fetch(userId);
            } catch (error) {
                return await interaction.editReply({
                    content: `❌ User not found. Please check that the user ID \`${userId}\` is correct.\n\n**Tips:**\n• Make sure the user is in this server\n• Try copying their Discord ID from their profile\n• Use @mention if they're active in chat`
                });
            }
            
            // Validate postal code
            const validation = validatePostalCode(postalCode);
            if (!validation.valid) {
                return await interaction.editReply({
                    content: `❌ ${validation.message}`
                });
            }
            
            // Add user via service manager
            const response = await bot.serviceManager.addWeatherUser(userId, postalCode, countryCode, interaction.user.id);
            
            if (!response.success) {
                return await interaction.editReply({
                    content: `❌ ${response.message || 'Failed to add user to weather system.'}`
                });
            }
            
            const embed = new EmbedBuilder()
                .setTitle('✅ User Added Successfully')
                .setColor('#4CAF50')
                .addFields(
                    { name: 'User', value: `${user.displayName} (${user.username})`, inline: true },
                    { name: 'Postal Code', value: postalCode, inline: true },
                    { name: 'Country', value: countryCode || 'Auto-detected', inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            
        } else if (modalId.startsWith('weatheradmin_userinput_')) {
            const action = modalId.split('_')[2];
            const userId = interaction.fields.getTextInputValue('user_id');
            
            await interaction.deferReply({ ephemeral: true });
            
            // Validate user ID format
            if (!/^\d{17,20}$/.test(userId)) {
                return await interaction.editReply({
                    content: '❌ Invalid Discord user ID format. Please enter a valid 18-19 digit Discord ID.\n\n**Example:** 161637430540238849'
                });
            }
            
            // Handle the action
            if (action === 'removeuser') {
                const response = await bot.serviceManager.removeWeatherUser(userId, interaction.user.id);
                
                if (!response.success) {
                    return await interaction.editReply({
                        content: `❌ ${response.message || 'Failed to remove user from weather system.'}`
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle('✅ User Removed Successfully')
                    .setColor('#F44336')
                    .addFields(
                        { name: 'User ID', value: userId, inline: true },
                        { name: 'Action', value: 'Removed from weather system', inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                
            } else if (action === 'setactive') {
                await showActiveStatusModalForUser(interaction, bot, userId);
                
            } else if (action === 'setscore') {
                await showScoreInputModalForUser(interaction, bot, userId);
            }
            
        } else if (modalId.startsWith('weatheradmin_activestatus_')) {
            const userId = modalId.split('_')[2];
            const statusInput = interaction.fields.getTextInputValue('active_status').toLowerCase().trim();
            
            await interaction.deferReply({ ephemeral: true });
            
            let active;
            if (statusInput === 'true' || statusInput === '1' || statusInput === 'yes' || statusInput === 'active') {
                active = true;
            } else if (statusInput === 'false' || statusInput === '0' || statusInput === 'no' || statusInput === 'inactive') {
                active = false;
            } else {
                return await interaction.editReply({
                    content: '❌ Invalid status input. Please enter:\n• `true` to activate\n• `false` to deactivate'
                });
            }
            
            const response = await bot.serviceManager.setWeatherUserActive(userId, active, interaction.user.id);
            
            if (!response.success) {
                return await interaction.editReply({
                    content: `❌ ${response.message || 'Failed to update user status.'}`
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ User Status Updated')
                .setColor(active ? '#4CAF50' : '#FF9800')
                .addFields(
                    { name: 'User ID', value: userId, inline: true },
                    { name: 'Status', value: active ? 'Active' : 'Inactive', inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            
        } else if (modalId.startsWith('weatheradmin_setscore_')) {
            const userId = modalId.split('_')[2];
            const scoreInput = interaction.fields.getTextInputValue('user_score');
            
            await interaction.deferReply({ ephemeral: true });
            
            const points = parseInt(scoreInput);
            if (isNaN(points) || points < 0) {
                return await interaction.editReply({
                    content: '❌ Invalid input. Points must be a non-negative number.\n\n**Example:** 15'
                });
            }

            const response = await bot.serviceManager.setWeatherUserScore(userId, points, interaction.user.id);

            if (!response.success) {
                return await interaction.editReply({
                    content: `❌ ${response.message || 'Failed to update user score.'}`
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ User Score Updated')
                .setColor('#4CAF50')
                .addFields(
                    { name: 'User ID', value: userId, inline: true },
                    { name: 'New Score', value: points.toString(), inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            
        }
        
    } catch (error) {
        console.error('Error handling modal submission:', error);
        
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ An error occurred while processing your request.',
                ephemeral: true
            });
        } else if (interaction.deferred) {
            await interaction.editReply({
                content: '❌ An error occurred while processing your request.'
            });
        }
    }
}

// New handler functions for system management and triggers
async function handleStats(interaction, serviceManager) {
    try {
        // Get weather system statistics
        const leaderboard = await serviceManager.getShittyWeatherLeaderboard();
        console.log('[WEATHERADMIN] Statistics leaderboard response:', JSON.stringify(leaderboard, null, 2));
        
        const [bestSingleDay, topWeeklyAverages] = await Promise.all([
            serviceManager.getBestSingleDay(),
            serviceManager.getTopWeeklyAverages()
        ]);
        
        const embed = new EmbedBuilder()
            .setTitle('📊 Weather System Statistics')
            .setColor('#2196F3')
            .addFields(
                { name: '👥 Total Users', value: leaderboard.length.toString(), inline: true },
                { name: '🏆 Competition Active', value: bestSingleDay ? 'Yes' : 'Starting up', inline: true },
                { name: '📈 Weekly Trackers', value: topWeeklyAverages ? topWeeklyAverages.length.toString() : '0', inline: true }
            )
            .setTimestamp();

        if (leaderboard.length > 0) {
            const totalPoints = leaderboard.reduce((sum, user) => {
                console.log('[WEATHERADMIN] Processing user for stats:', user.displayName, 'totalPoints:', user.totalPoints);
                return sum + (user.totalPoints || 0);
            }, 0);
            console.log('[WEATHERADMIN] Final calculated totalPoints:', totalPoints);
            embed.addFields(
                { name: '🎖️ Total Points Awarded', value: totalPoints.toString(), inline: true },
                { name: '⚡ Average Points/User', value: (totalPoints / leaderboard.length).toFixed(1), inline: true }
            );
        }

        // Add API usage statistics
        try {
            const apiUsage = await serviceManager.getApiUsage();
            if (apiUsage && apiUsage.success) {
                embed.addFields(
                    { name: '📡 API Calls Today', value: `${apiUsage.callsToday || 0} / ${apiUsage.dailyLimit || 1000}`, inline: true },
                    { name: '📊 API Usage %', value: `${apiUsage.usagePercentage || 0}%`, inline: true }
                );
            }
        } catch (apiError) {
            console.error('Error getting API usage:', apiError);
            embed.addFields(
                { name: '📡 API Status', value: 'Unable to fetch', inline: true }
            );
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error getting stats:', error);
        await interaction.editReply('❌ Failed to get weather system statistics.');
    }
}

async function handleManualAward(interaction, serviceManager) {
    try {
        const result = await serviceManager.awardShittyWeatherPoints();
        
        if (!result || !result.award) {
            return await interaction.editReply({
                content: '❌ No users with shitty weather found, or no one has bad enough weather to award points.'
            });
        }

        const award = result.award;
        const formatTemperature = (fahrenheit) => {
            const celsius = ((fahrenheit - 32) * 5/9);
            return `${Math.round(fahrenheit)}°F (${Math.round(celsius)}°C)`;
        };
        
        let description = `🏆 **${award.displayName}** from **${award.region}** wins!\n\n**Weather Score:** ${award.score} points\n**Conditions:** ${formatTemperature(award.weather.temp)}, ${award.weather.description}\n`;
        
        if (award.breakdown && award.breakdown.length > 0) {
            description += `\n📊 **How they earned ${award.score} points:**\n${award.breakdown.join('\n')}\n`;
        }
        
        description += `\n*Manually awarded by admin*`;

        const embed = new EmbedBuilder()
            .setColor(0x8B4513)
            .setTitle(`💩 Manual Shitty Weather Award`)
            .setDescription(description)
            .addFields(
                { name: '💨 Wind', value: `${award.weather.wind} mph`, inline: true },
                { name: '💧 Humidity', value: `${award.weather.humidity}%`, inline: true },
                { name: '🎖️ Total Points', value: award.totalPoints.toString(), inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply({
            content: `❌ Failed to award shitty weather points: ${error.message}`
        });
    }
}

async function handleTriggerUpdate(interaction, bot) {
    try {
        const channelId = bot?.config?.weatherChannelId;
        if (!channelId) {
            return await interaction.editReply({
                content: '❌ Weather channel not configured!'
            });
        }
        const channel = interaction.client.channels.cache.get(channelId);
        if (!channel) {
            return await interaction.editReply({
                content: '❌ Weather channel not found!'
            });
        }

        await bot.sendDailyWeatherUpdate(channel);
        
        await interaction.editReply({
            content: '✅ Daily weather update message has been sent to the weather channel!'
        });
    } catch (error) {
        await interaction.editReply({
            content: `❌ Failed to send daily weather update: ${error.message}`
        });
    }
}

async function handleTriggerCelebration(interaction, bot) {
    try {
        const channelId = bot?.config?.weatherChannelId;
        if (!channelId) {
            return await interaction.editReply({
                content: '❌ Weather channel not configured!'
            });
        }
        const channel = interaction.client.channels.cache.get(channelId);
        if (!channel) {
            return await interaction.editReply({
                content: '❌ Weather channel not found!'
            });
        }

        const leaderboard = await bot.serviceManager.getWeatherLeaderboard();
        const shittyLeaderboard = await bot.serviceManager.getShittyWeatherLeaderboard();
        
        let message = '🌤️ **WEEKLY WEATHER TRACKER CELEBRATION** 🌤️\n\n';
        message += '**Active Weather Trackers:**\n';
        
        if (leaderboard.length > 0) {
            leaderboard.forEach((user, index) => {
                const emoji = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📍';
                message += `${emoji} ${user.displayName} - ${user.location}\n`;
            });

            message += `\n📊 Total active trackers: **${leaderboard.length}**\n\n`;
        }
        
        if (shittyLeaderboard.length > 0) {
            message += `💩 **SHITTY WEATHER CHAMPIONS** 💩\n`;
            shittyLeaderboard.slice(0, 3).forEach((user, index) => {
                const emoji = index === 0 ? '👑💩' : index === 1 ? '🥈💧' : '🥉❄️';
                message += `${emoji} <@${user.userId}> - ${user.points} shitty points!\n`;
            });
            message += '\n';
        }
        
        message += '*Want to join the fun?*\n';
        message += '🌤️ *Use `/weather join <postal_code>` to start tracking!*\n';
        message += '💩 *Compete in the Shitty Weather Championship!*';

        await channel.send(message);
        
        await interaction.editReply({
            content: '✅ Weekly celebration message has been sent to the weather channel!'
        });
    } catch (error) {
        await interaction.editReply({
            content: `❌ Failed to send weekly celebration: ${error.message}`
        });
    }
}

async function handleTriggerAlerts(interaction, bot) {
    try {
        const channelId = bot?.config?.weatherChannelId;
        if (!channelId) {
            return await interaction.editReply({
                content: '❌ Weather channel not configured!'
            });
        }
        const channel = interaction.client.channels.cache.get(channelId);
        if (!channel) {
            return await interaction.editReply({
                content: '❌ Weather channel not found!'
            });
        }

        console.log('[WEATHERADMIN TRIGGER-ALERTS] Checking all users weather...');
        const weatherResult = await bot.serviceManager.checkAllUsersWeather();
        console.log('[WEATHERADMIN TRIGGER-ALERTS] Weather check completed:', weatherResult);
        
        if (weatherResult.alerts && weatherResult.alerts.length > 0) {
            const alertMessage = `🚨 **Weather Alerts** 🚨\n\n${weatherResult.alerts.map(a => a.alert).join('\n\n')}`;
            await channel.send(alertMessage);
        }

        console.log('[WEATHERADMIN TRIGGER-ALERTS] Awarding shitty weather points...');
        const shittyWeatherResult = await bot.serviceManager.awardShittyWeatherPoints();
        console.log('[WEATHERADMIN TRIGGER-ALERTS] Shitty weather award result:', shittyWeatherResult);
        
        if (shittyWeatherResult && shittyWeatherResult.award) {
            await bot.sendSevereWeatherAlert(channel, shittyWeatherResult.award);
        }
        
        let resultMessage = `✅ Weather alerts and shitty weather award process completed!\n\n`;
        resultMessage += `📊 **Results:**\n`;
        resultMessage += `• Weather updates: ${weatherResult.totalUpdates || 0} checked\n`;
        resultMessage += `• Weather alerts: ${weatherResult.totalAlerts || 0} sent\n`;
        resultMessage += `• Shitty weather points: ${shittyWeatherResult.success ? '✅ Awarded' : '❌ Failed'}\n`;
        
        if (shittyWeatherResult && shittyWeatherResult.totalPoints) {
            resultMessage += `• Points awarded: ${shittyWeatherResult.totalPoints} to ${shittyWeatherResult.usersProcessed} users`;
        }
        
        await interaction.editReply({
            content: resultMessage
        });
    } catch (error) {
        await interaction.editReply({
            content: `❌ Failed to trigger weather alerts: ${error.message}`
        });
    }
}

// Postal code validation function (copied from weather.js for consistency)
function validatePostalCode(code) {
    // Remove spaces and convert to uppercase for validation
    const cleanCode = code.replace(/\s+/g, '').toUpperCase();
    
    // US ZIP codes (5 digits or 5+4 format)
    if (/^\d{5}(-?\d{4})?$/.test(cleanCode)) {
        return { valid: true, country: 'US', format: 'zip' };
    }
    
    // UK postcodes - comprehensive pattern for all valid formats
    // Formats: M1 1AA, M60 1NW, CR0 2YR, DN55 1PT, W1A 0AX, EC1A 1BB, SW1A 1AA
    const ukPostcodeRegex = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}$/i;
    if (ukPostcodeRegex.test(code)) {
        return { valid: true, country: 'GB', format: 'postcode' };
    }
    
    // Canadian postal codes (A1A1A1 or A1A 1A1)
    if (/^[A-Z]\d[A-Z]\s*\d[A-Z]\d$/.test(cleanCode)) {
        return { valid: true, country: 'CA', format: 'postal' };
    }
    
    // German postal codes (5 digits)
    if (/^\d{5}$/.test(cleanCode)) {
        return { valid: true, country: 'DE', format: 'postcode' };
    }
    
    // French postal codes (5 digits)
    if (/^\d{5}$/.test(cleanCode)) {
        return { valid: true, country: 'FR', format: 'postcode' };
    }
    
    // Danish postal codes (4 digits, but we can't distinguish from AU without more context)
    // Note: Both Denmark and Australia use 4-digit codes
    if (/^\d{4}$/.test(cleanCode)) {
        // For 4-digit codes, we'll let the API handle country detection
        // or require users to be more specific in ambiguous cases
        return { valid: true, country: 'AMBIGUOUS', format: 'postcode' };
    }
    
    // For other formats, be more lenient - accept if it's 3-10 characters with letters/numbers
    if (/^[A-Z0-9\s-]{3,10}$/i.test(code)) {
        return { valid: true, country: 'UNKNOWN', format: 'generic' };
    }
    
    return { 
        valid: false, 
        message: 'Please provide a valid postal/zip code.\n\nExamples:\n• US: 12345 or 12345-6789\n• UK: SW1A 1AA or M1 1AA\n• Canada: A1A 1A1\n• Denmark/Australia: 2000\n• Germany: 10115' 
    };
}
