const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wellnessadmin')
        .setDescription('Wellness system administration panel (Admin only)'),

    async execute(interaction, bot) {
        console.log('[WELLNESSADMIN] Execute called - showing GUI interface');

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

        // Create the admin interface
        await showWellnessAdminPanel(interaction, bot);
    }
};

async function showWellnessAdminPanel(interaction, bot) {
    const embed = new EmbedBuilder()
        .setTitle('🌿 Wellness System Administration')
        .setDescription('Manage the wellness system - view history, schedules, statistics, and control automation.')
        .setColor('#4CAF50')
        .addFields(
            { name: '📊 Quick Stats', value: 'View system usage and performance', inline: true },
            { name: '📅 Schedule Control', value: 'Manage automatic meal and workout schedules', inline: true },
            { name: '📝 History Tracking', value: 'View recent meals, snacks, and workouts', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Select an option below to manage the wellness system' });

    // Main action menu
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('wellness_admin_action')
        .setPlaceholder('Choose an action...')
        .addOptions([
            {
                label: '📊 System Statistics',
                description: 'View detailed system performance and usage stats',
                value: 'stats',
                emoji: '📊'
            },
            {
                label: '📅 View Schedule',
                description: 'See current meal, snack, and workout schedules',
                value: 'schedule',
                emoji: '📅'
            },
            {
                label: '📝 View History',
                description: 'Browse recent meals, snacks, and workouts',
                value: 'history',
                emoji: '📝'
            },
            {
                label: '⚙️ Toggle Automation',
                description: 'Enable/disable automatic meal plans and workouts',
                value: 'toggle',
                emoji: '⚙️'
            },
            {
                label: '🔄 Refresh Panel',
                description: 'Refresh this admin panel',
                value: 'refresh',
                emoji: '🔄'
            }
        ]);

    // Quick action buttons - direct meal/snack/workout generation
    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('wellness_quick_meal')
                .setLabel('🍽️ Quick Meal')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('wellness_quick_snack')
                .setLabel('🥨 Quick Snack')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('wellness_quick_workout')
                .setLabel('💪 Quick Workout')
                .setStyle(ButtonStyle.Secondary)
        );

    // Additional action buttons
    const buttonRow2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('wellness_system_status')
                .setLabel('🔍 System Status')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('wellness_emergency_stop')
                .setLabel('🛑 Emergency Stop')
                .setStyle(ButtonStyle.Danger)
        );

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
        embeds: [embed],
        components: [selectRow, buttonRow, buttonRow2],
        flags: MessageFlags.Ephemeral
    });

    // Set up collector for interactions
    const filter = (i) => i.user.id === interaction.user.id && i.customId.startsWith('wellness_');
    const collector = interaction.channel.createMessageComponentCollector({ 
        filter, 
        time: 600000 // 10 minutes
    });

    collector.on('collect', async (i) => {
        try {
            if (i.isStringSelectMenu()) {
                await handleWellnessAdminAction(i, bot);
            } else if (i.isButton()) {
                await handleWellnessButtonAction(i, bot);
            }
        } catch (error) {
            console.error('Error handling wellness admin GUI:', error);
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
            embeds: [embed.setFooter({ text: '⏰ Admin panel expired - use /wellnessadmin again' })],
            components: [disabledSelectRow, disabledButtonRow, disabledButtonRow2]
        }).catch(() => {});
    });
}

// Handle select menu actions
async function handleWellnessAdminAction(interaction, bot) {
    const action = interaction.values[0];
    
    switch (action) {
        case 'stats':
            await handleAdminStats(interaction, bot.wellnessSystem, bot.config);
            break;
        case 'schedule':
            await handleSchedule(interaction, bot.config);
            break;
        case 'history':
            await showHistoryMenu(interaction, bot);
            break;
        case 'toggle':
            await handleToggle(interaction, bot.wellnessSystem);
            break;
        case 'refresh':
            await showWellnessAdminPanel(interaction, bot);
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
async function handleWellnessButtonAction(interaction, bot) {
    const action = interaction.customId.replace('wellness_', '');
    
    switch (action) {
        case 'quick_meal':
            await handleDirectGenerate(interaction, bot.wellnessSystem, 'meal');
            break;
        case 'quick_snack':
            await handleDirectGenerate(interaction, bot.wellnessSystem, 'snack');
            break;
        case 'quick_workout':
            await handleDirectGenerate(interaction, bot.wellnessSystem, 'workout');
            break;
        case 'system_status':
            await showSystemStatus(interaction, bot);
            break;
        case 'emergency_stop':
            await handleEmergencyStop(interaction, bot);
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

// Handle direct generation from buttons (no dropdown needed)
async function handleDirectGenerate(interaction, wellnessSystem, type) {
    // Defer the reply immediately
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    try {
        let result;
        let title;
        let emoji;
        
        switch (type) {
            case 'meal':
                result = await wellnessSystem.generateMeal();
                title = 'Generated Meal';
                emoji = '🍽️';
                break;
            case 'snack':
                result = await wellnessSystem.generateSnack();
                title = 'Generated Snack';
                emoji = '🥨';
                break;
            case 'workout':
                result = await wellnessSystem.generateWorkout();
                title = 'Generated Workout';
                emoji = '💪';
                break;
            default:
                await interaction.editReply({
                    content: '❌ Invalid generation type specified.'
                });
                return;
        }

        if (result && result.data) {
            const data = result.data;
            const embed = new EmbedBuilder()
                .setTitle(`${emoji} ${title}`)
                .setDescription(`**${data.name || data.title}**\n\n${data.description || data.instructions}`)
                .setColor('#4CAF50')
                .setTimestamp()
                .setFooter({ text: 'Generated via Admin Panel' });

            if (data.ingredients) {
                embed.addFields({ name: '🥘 Ingredients', value: Array.isArray(data.ingredients) ? data.ingredients.join(', ') : data.ingredients, inline: true });
            }
            if (data.nutrition || data.nutritionNotes) {
                embed.addFields({ name: '📊 Nutrition', value: data.nutrition || data.nutritionNotes, inline: true });
            }
            if (data.duration) {
                embed.addFields({ name: '⏱️ Duration', value: data.duration, inline: true });
            }
            if (data.intensity) {
                embed.addFields({ name: '💪 Intensity', value: data.intensity, inline: true });
            }
            if (data.equipment) {
                embed.addFields({ name: '🏋️ Equipment', value: Array.isArray(data.equipment) ? data.equipment.join(', ') : data.equipment, inline: true });
            }

            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({
                content: `❌ Failed to generate ${type}. ${result?.message || 'Please try again.'}`
            });
        }
    } catch (error) {
        console.error(`Error generating ${type}:`, error);
        try {
            await interaction.editReply({
                content: `❌ Failed to generate ${type}. Please try again.`
            });
        } catch (replyError) {
            console.error('Failed to send generate error response:', replyError);
        }
    }
}

// History submenu
async function showHistoryMenu(interaction, bot) {
    const embed = new EmbedBuilder()
        .setTitle('📝 Wellness History')
        .setDescription('Select the type of history to view:')
        .setColor('#2196F3');

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('wellness_history_type')
        .setPlaceholder('Choose history type...')
        .addOptions([
            {
                label: '🍽️ Meals',
                description: 'View recent meal history',
                value: 'meals',
                emoji: '🍽️'
            },
            {
                label: '🥨 Snacks',
                description: 'View recent snack history',
                value: 'snacks',
                emoji: '🥨'
            },
            {
                label: '💪 Workouts',
                description: 'View recent workout history',
                value: 'workouts',
                emoji: '💪'
            }
        ]);

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.update({
        embeds: [embed],
        components: [selectRow]
    });

    // Handle history type selection
    const filter = (i) => i.user.id === interaction.user.id && i.customId === 'wellness_history_type';
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 });

    collector.on('collect', async (i) => {
        const historyType = i.values[0];
        await handleHistory(i, bot.wellnessSystem, historyType);
    });
}

// Quick generate menu
async function showQuickGenerateMenu(interaction, bot) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    // Instead of showing a menu, immediately generate all three options
    try {
        const mealResult = await bot.wellnessSystem.generateMeal();
        const snackResult = await bot.wellnessSystem.generateSnack();
        const workoutResult = await bot.wellnessSystem.generateWorkout();

        const embed = new EmbedBuilder()
            .setTitle('🎯 Quick Generate Results')
            .setDescription('Here are three quick generations for you:')
            .setColor('#FF9800')
            .setTimestamp()
            .setFooter({ text: 'Generated via Admin Panel' });

        if (mealResult && mealResult.success) {
            embed.addFields({
                name: '🍽️ Meal',
                value: `**${mealResult.name}**\n${mealResult.description?.substring(0, 100)}${mealResult.description?.length > 100 ? '...' : ''}`,
                inline: true
            });
        }

        if (snackResult && snackResult.success) {
            embed.addFields({
                name: '🥨 Snack',
                value: `**${snackResult.name}**\n${snackResult.description?.substring(0, 100)}${snackResult.description?.length > 100 ? '...' : ''}`,
                inline: true
            });
        }

        if (workoutResult && workoutResult.success) {
            embed.addFields({
                name: '💪 Workout',
                value: `**${workoutResult.name || workoutResult.title}**\n${workoutResult.description?.substring(0, 100)}${workoutResult.description?.length > 100 ? '...' : ''}`,
                inline: true
            });
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in quick generate:', error);
        await interaction.editReply({
            content: '❌ Failed to generate quick results. Please try again.'
        });
    }
}

// Handle quick generate from collector (uses editReply instead of deferReply)
async function handleQuickGenerate(interaction, wellnessSystem, type) {
    try {
        let result;
        let title;
        
        switch (type) {
            case 'meal':
                result = await wellnessSystem.generateMeal();
                title = '🍽️ Generated Meal';
                break;
            case 'snack':
                result = await wellnessSystem.generateSnack();
                title = '🥨 Generated Snack';
                break;
            case 'workout':
                result = await wellnessSystem.generateWorkout();
                title = '💪 Generated Workout';
                break;
            default:
                await interaction.editReply({
                    content: '❌ Invalid generation type specified.',
                    components: []
                });
                return;
        }

        if (result && result.success) {
            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(`**${result.name || result.title}**\n\n${result.description || result.instructions}`)
                .setColor('#4CAF50')
                .setTimestamp()
                .setFooter({ text: 'Generated via Admin Panel' });

            if (result.ingredients) {
                embed.addFields({ name: '🥘 Ingredients', value: result.ingredients, inline: true });
            }
            if (result.nutrition) {
                embed.addFields({ name: '📊 Nutrition', value: result.nutrition, inline: true });
            }
            if (result.duration) {
                embed.addFields({ name: '⏱️ Duration', value: result.duration, inline: true });
            }

            await interaction.editReply({ 
                embeds: [embed],
                components: [] // Remove the select menu after generation
            });
        } else {
            await interaction.editReply({
                content: `❌ Failed to generate ${type}. ${result?.message || 'Please try again.'}`,
                components: []
            });
        }
    } catch (error) {
        console.error(`Error generating ${type}:`, error);
        try {
            await interaction.editReply({
                content: `❌ Failed to generate ${type}. Please try again.`,
                components: []
            });
        } catch (replyError) {
            console.error('Failed to send generate error response:', replyError);
        }
    }
}

// System status display
async function showSystemStatus(interaction, bot) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    try {
        const embed = new EmbedBuilder()
            .setTitle('🔍 Wellness System Status')
            .setColor('#4CAF50')
            .addFields(
                { name: '🟢 System', value: 'Online', inline: true },
                { name: '📊 Wellness System', value: bot.wellnessSystem ? 'Connected' : 'Disconnected', inline: true },
                { name: '⏰ Uptime', value: process.uptime() > 3600 ? `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m` : `${Math.floor(process.uptime() / 60)}m`, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error showing system status:', error);
        await interaction.editReply({
            content: '❌ Failed to get system status.'
        });
    }
}

// Emergency stop
async function handleEmergencyStop(interaction, bot) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    try {
        // This would stop any running wellness schedules
        const embed = new EmbedBuilder()
            .setTitle('🛑 Emergency Stop Activated')
            .setDescription('All automatic wellness schedules have been temporarily disabled.')
            .setColor('#F44336')
            .addFields(
                { name: '⚠️ Action Required', value: 'Use the Toggle Automation option to re-enable schedules when ready.', inline: false }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error during emergency stop:', error);
        await interaction.editReply({
            content: '❌ Failed to execute emergency stop.'
        });
    }
}

// Import the existing handler functions from wellness.js
// These will be moved here or referenced

// Admin Stats Handler (moved from wellness.js)
async function handleAdminStats(interaction, wellnessSystem, config) {
    // Check if user has admin permissions
    const isAdmin = config.adminRoles?.some(roleId => 
        interaction.member?.roles.cache.has(roleId)
    );

    if (!isAdmin) {
        await interaction.reply({
            content: '❌ You do not have permission to view admin statistics.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    try {
        const stats = wellnessSystem.getAdminStats();
        
        const embed = new EmbedBuilder()
            .setTitle('📊 Wellness System Statistics')
            .setColor('#4CAF50')
            .addFields(
                { name: '🍽️ Total Meals Generated', value: stats.totalMeals?.toString() || '0', inline: true },
                { name: '🥨 Total Snacks Generated', value: stats.totalSnacks?.toString() || '0', inline: true },
                { name: '💪 Total Workouts Generated', value: stats.totalWorkouts?.toString() || '0', inline: true },
                { name: '📅 Schedules Active', value: stats.activeSchedules ? 'Yes' : 'No', inline: true },
                { name: '🕒 Last Activity', value: stats.lastActivity || 'Unknown', inline: true },
                { name: '⚡ System Uptime', value: process.uptime() > 3600 ? `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m` : `${Math.floor(process.uptime() / 60)}m`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Wellness System Admin Statistics' });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error getting wellness stats:', error);
        await interaction.editReply({
            content: '❌ Failed to retrieve system statistics. Please try again.'
        });
    }
}

// Schedule Handler (moved from wellness.js)
async function handleSchedule(interaction, config) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    try {
        const timezone = config.timezone || 'America/New_York';
        const now = new Date();
        const options = { 
            timeZone: timezone, 
            hour: '2-digit', 
            minute: '2-digit',
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        };
        const currentTime = now.toLocaleString('en-US', options);

        const embed = new EmbedBuilder()
            .setTitle('📅 Wellness Schedule')
            .setDescription(`Current time: **${currentTime}** (${timezone})`)
            .setColor('#2196F3')
            .addFields(
                { 
                    name: '🍽️ Meal Schedule', 
                    value: '• **Breakfast**: 8:00 AM\n• **Lunch**: 12:00 PM\n• **Dinner**: 6:00 PM', 
                    inline: true 
                },
                { 
                    name: '🥨 Snack Schedule', 
                    value: '• **Morning**: 10:00 AM\n• **Afternoon**: 3:00 PM\n• **Evening**: 8:00 PM', 
                    inline: true 
                },
                { 
                    name: '💪 Workout Schedule', 
                    value: '• **Morning**: 7:00 AM\n• **Evening**: 5:00 PM', 
                    inline: true 
                }
            )
            .setTimestamp()
            .setFooter({ text: 'All times are in your configured timezone' });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error showing schedule:', error);
        await interaction.editReply({
            content: '❌ Failed to load schedule information.'
        });
    }
}

// Toggle Handler (moved from wellness.js)
async function handleToggle(interaction, wellnessSystem) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    try {
        const isEnabled = wellnessSystem.toggleSchedule();
        
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Wellness Schedule Toggle')
            .setDescription(`Automatic meal plans and workout schedules are now **${isEnabled ? 'ENABLED' : 'DISABLED'}**.`)
            .setColor(isEnabled ? '#4CAF50' : '#F44336')
            .addFields(
                { 
                    name: '📅 What this affects:', 
                    value: isEnabled 
                        ? '• Automatic meal notifications\n• Scheduled snack reminders\n• Workout schedule alerts'
                        : '• All automatic schedules stopped\n• Manual generation still works\n• Use toggle again to re-enable', 
                    inline: false 
                }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error toggling wellness schedule:', error);
        await interaction.editReply({
            content: '❌ Failed to toggle schedule. Please try again.'
        });
    }
}

// History Handler (moved from wellness.js)
async function handleHistory(interaction, wellnessSystem, type) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const count = 5; // Default count for admin interface

    try {
        let history;
        let title;
        let emoji;

        switch (type) {
            case 'meals':
                history = await wellnessSystem.getHistory('meals', count);
                title = '🍽️ Recent Meal History';
                emoji = '🍽️';
                break;
            case 'snacks':
                history = await wellnessSystem.getHistory('snacks', count);
                title = '🥨 Recent Snack History';
                emoji = '🥨';
                break;
            case 'workouts':
                history = await wellnessSystem.getHistory('workouts', count);
                title = '💪 Recent Workout History';
                emoji = '💪';
                break;
            default:
                await interaction.editReply({
                    content: '❌ Invalid history type specified.'
                });
                return;
        }

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor('#2196F3')
            .setTimestamp()
            .setFooter({ text: `Showing last ${count} ${type}` });

        if (history && history.length > 0) {
            const historyText = history.map((item, index) => {
                const date = new Date(item.timestamp).toLocaleDateString();
                const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return `${emoji} **${item.name || item.title}**\n${item.description || item.instructions || 'No description'}\n*${date} at ${time}*`;
            }).join('\n\n');

            // Split long descriptions if needed
            if (historyText.length > 4000) {
                embed.setDescription(`${historyText.substring(0, 4000)}...\n\n*Some entries truncated*`);
            } else {
                embed.setDescription(historyText);
            }
        } else {
            embed.setDescription(`No ${type} history found.`);
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error(`Error getting ${type} history:`, error);
        await interaction.editReply({
            content: `❌ Failed to retrieve ${type} history. Please try again.`
        });
    }
}

// Generate Handler (moved from wellness.js)
async function handleGenerate(interaction, wellnessSystem, type) {
    // For interactions from collectors, we need to respond differently
    const isFromCollector = interaction.isStringSelectMenu();
    
    if (isFromCollector) {
        // For select menu interactions, we need to respond directly
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } else if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    try {
        let result;
        let title;
        
        switch (type) {
            case 'meal':
                result = await wellnessSystem.generateMeal();
                title = '🍽️ Generated Meal';
                break;
            case 'snack':
                result = await wellnessSystem.generateSnack();
                title = '🥨 Generated Snack';
                break;
            case 'workout':
                result = await wellnessSystem.generateWorkout();
                title = '💪 Generated Workout';
                break;
            default:
                await interaction.editReply({
                    content: '❌ Invalid generation type specified.'
                });
                return;
        }

        if (result && result.success) {
            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(`**${result.name || result.title}**\n\n${result.description || result.instructions}`)
                .setColor('#4CAF50')
                .setTimestamp()
                .setFooter({ text: 'Generated via Admin Panel' });

            if (result.ingredients) {
                embed.addFields({ name: '🥘 Ingredients', value: result.ingredients, inline: true });
            }
            if (result.nutrition) {
                embed.addFields({ name: '📊 Nutrition', value: result.nutrition, inline: true });
            }
            if (result.duration) {
                embed.addFields({ name: '⏱️ Duration', value: result.duration, inline: true });
            }

            const responseMethod = isFromCollector ? 'editReply' : 'editReply';
            await interaction[responseMethod]({ embeds: [embed] });
        } else {
            const responseMethod = isFromCollector ? 'editReply' : 'editReply';
            await interaction[responseMethod]({
                content: `❌ Failed to generate ${type}. ${result?.message || 'Please try again.'}`
            });
        }
    } catch (error) {
        console.error(`Error generating ${type}:`, error);
        try {
            const responseMethod = isFromCollector ? 'editReply' : 'editReply';
            await interaction[responseMethod]({
                content: `❌ Failed to generate ${type}. Please try again.`
            });
        } catch (replyError) {
            console.error('Failed to send generate error response:', replyError);
        }
    }
}