const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wellness')
        .setDescription('Generate meals, snacks, and workouts on demand')
        .addSubcommand(subcommand =>
            subcommand
                .setName('generate')
                .setDescription('Generate a meal, snack, or workout on demand')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('What to generate')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Meal', value: 'meal' },
                            { name: 'Snack', value: 'snack' },
                            { name: 'Workout', value: 'workout' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('requirements')
                        .setDescription('Specific ingredients or workout type (e.g., "apple snack", "chicken dinner", "cardio legs")')
                        .setRequired(false)
                )
        ),

    async execute(interaction, { wellnessSystem, config }) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'generate':
                    await handleGenerate(interaction, wellnessSystem);
                    break;
                default:
                    await interaction.reply({
                        content: 'Unknown subcommand. Please use: generate.',
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error('Error in wellness command:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'An error occurred while processing your request. Please try again.',
                    ephemeral: true
                });
            } else if (interaction.deferred) {
                await interaction.editReply({
                    content: 'An error occurred while processing your request. Please try again.'
                });
            }
        }
    }
};

async function handleGenerate(interaction, wellnessSystem) {
    const type = interaction.options.getString('type');
    const requirements = interaction.options.getString('requirements');
    
    await interaction.deferReply();

    try {
        let result;
        switch (type) {
            case 'meal':
                result = await wellnessSystem.generateMeal(requirements);
                break;
            case 'snack':
                result = await wellnessSystem.generateSnack(requirements);
                break;
            case 'workout':
                result = await wellnessSystem.generateWorkout(requirements);
                break;
            default:
                await interaction.editReply({
                    content: 'Invalid type specified. Please choose meal, snack, or workout.'
                });
                return;
        }
        
        if (result && result.embed) {
            await interaction.editReply({ embeds: [result.embed] });
        } else {
            await interaction.editReply({
                content: `Failed to generate ${type}. Please try again later.`
            });
        }
    } catch (error) {
        console.error(`Error generating ${type}:`, error);
        await interaction.editReply({
            content: `An error occurred while generating the ${type}. Please try again.`
        });
    }
}

// Helper functions
function getColorForType(type) {
    switch (type) {
        case 'meal':
            return '#ff6b6b';
        case 'snack':
            return '#feca57';
        case 'workout':
            return '#45b7d1';
        default:
            return '#ffa500';
    }
}

function getEmojiForType(type) {
    switch (type) {
        case 'meal':
            return '🍽️';
        case 'snack':
            return '🥨';
        case 'workout':
            return '💪';
        default:
            return '🌿';
    }
}

async function handleHistory(interaction, wellnessSystem, type) {
    try {
        let history;
        switch (type) {
            case 'meals':
                history = wellnessSystem.getHistory('meals');
                break;
            case 'snacks':
                history = wellnessSystem.getHistory('snacks');
                break;
            case 'workouts':
                history = wellnessSystem.getHistory('workouts');
                break;
            default:
                await interaction.reply({
                    content: '❌ Invalid history type specified.',
                    ephemeral: true
                });
                return;
        }
        
        if (!history || history.length === 0) {
            await interaction.reply({
                content: `No ${type} history found.`,
                ephemeral: true
            });
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`Recent ${type.charAt(0).toUpperCase() + type.slice(1)} History`)
            .setColor(getColorForType(type))
            .setTimestamp();
        
        history.forEach((item, index) => {
            const date = new Date(item.timestamp).toLocaleDateString();
            let value = '';
            
            if (type === 'workouts') {
                value = `${item.difficulty} • ${item.duration} min • ${item.category}`;
            } else {
                value = `${item.prepTime || item.duration || 'N/A'} min • ${item.calories} cal`;
            }
            
            embed.addFields({
                name: `${index + 1}. ${item.name} (${date})`,
                value: value,
                inline: false
            });
        });
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('Error retrieving history:', error);
        await interaction.reply({
            content: 'Failed to retrieve history. Please try again.',
            ephemeral: true
        });
    }
}

async function handleToggle(interaction, wellnessSystem) {
    try {
        const isEnabled = wellnessSystem.toggleSchedule();
        
        const embed = new EmbedBuilder()
            .setTitle('Schedule Status Updated')
            .setDescription(`Automatic wellness schedule is now **${isEnabled ? 'ENABLED' : 'DISABLED'}**`)
            .setColor(isEnabled ? '#00ff00' : '#ff0000')
            .setTimestamp();
        
        if (isEnabled) {
            embed.addFields({
                name: 'Next Scheduled Items',
                value: 'The schedule will resume with the next configured time slots.',
                inline: false
            });
        }
        
        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Error toggling schedule:', error);
        await interaction.reply({
            content: 'Failed to toggle schedule. Please try again.',
            ephemeral: true
        });
    }
}

async function handleSchedule(interaction, config) {
    try {
        const schedule = config.wellnessSchedule;
        
        if (!schedule) {
            await interaction.reply({
                content: 'No wellness schedule configured.',
                ephemeral: true
            });
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('Current Wellness Schedule')
            .setColor('#ffa500')
            .setTimestamp();
        
        if (schedule.meals && schedule.meals.length > 0) {
            embed.addFields({
                name: '🍽️ Meals',
                value: schedule.meals.map(time => `• ${time}`).join('\n'),
                inline: true
            });
        }
        
        if (schedule.snacks && schedule.snacks.length > 0) {
            embed.addFields({
                name: '🍿 Snacks',
                value: schedule.snacks.map(time => `• ${time}`).join('\n'),
                inline: true
            });
        }
        
        if (schedule.workouts && schedule.workouts.length > 0) {
            embed.addFields({
                name: '💪 Workouts',
                value: schedule.workouts.map(time => `• ${time}`).join('\n'),
                inline: true
            });
        }
        
        embed.addFields({
            name: 'Channel',
            value: config.wellnessChannelId ? `<#${config.wellnessChannelId}>` : 'Not configured',
            inline: false
        });
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('Error displaying schedule:', error);
        await interaction.reply({
            content: 'Failed to display schedule. Please try again.',
            ephemeral: true
        });
    }
}

async function handleAdminStats(interaction, wellnessSystem, config) {
    try {
        // Check if user has admin role
        const hasAdminRole = config.adminRoles && config.adminRoles.some(roleId => 
            interaction.member.roles.cache.has(roleId)
        );

        if (!hasAdminRole) {
            await interaction.reply({
                content: 'You do not have permission to view admin statistics.',
                ephemeral: true
            });
            return;
        }

        const stats = wellnessSystem.getAdminStats();
        
        const embed = new EmbedBuilder()
            .setTitle('🔧 Wellness System - Admin Statistics')
            .setColor('#9932cc')
            .setTimestamp();

        // Basic stats
        embed.addFields({
            name: '📊 Request Statistics',
            value: [
                `Total Requests: ${stats.total}`,
                `Successful: ${stats.successful}`,
                `Failed: ${stats.failed}`,
                `Success Rate: ${stats.successRate}%`
            ].join('\n'),
            inline: true
        });

        if (stats.avgResponseTime > 0) {
            embed.addFields({
                name: '⏱️ Response Times (ms)',
                value: [
                    `Average: ${stats.avgResponseTime}ms`,
                    `Minimum: ${stats.minResponseTime}ms`,
                    `Maximum: ${stats.maxResponseTime}ms`
                ].join('\n'),
                inline: true
            });
        }

        // Recent activity with enhanced details
        if (stats.recentRequests && stats.recentRequests.length > 0) {
            const recentActivity = stats.recentRequests.slice(-5).reverse().map(entry => {
                const typeIcon = entry.type === 'meal' ? '🍽️' : entry.type === 'snack' ? '🍿' : '💪';
                const status = entry.success ? '✅' : '❌';
                const time = entry.success ? `${entry.responseTime}ms` : 'Failed';
                
                // Add trigger source icon
                let triggerIcon = '';
                switch (entry.triggerSource) {
                    case 'user_request':
                        triggerIcon = '👤';
                        break;
                    case 'scheduled':
                        triggerIcon = '⏰';
                        break;
                    case 'auto_response':
                        triggerIcon = '🤖';
                        break;
                    case 'fallback':
                        triggerIcon = '📋';
                        break;
                    default:
                        triggerIcon = '❓';
                }
                
                return `${typeIcon} ${triggerIcon} ${entry.type} - ${status} ${time}`;
            }).join('\n');

            if (recentActivity) {
                embed.addFields({
                    name: '📝 Recent Activity (Last 5)',
                    value: recentActivity + '\n\n👤 User Request | ⏰ Scheduled | 🤖 Auto Response | 📋 Fallback',
                    inline: false
                });
            }
        }

        // Add breakdown by trigger source if data available
        if (stats.triggerBreakdown && Object.keys(stats.triggerBreakdown).length > 0) {
            const triggerStats = Object.entries(stats.triggerBreakdown)
                .map(([source, data]) => {
                    const icon = source === 'user_request' ? '👤' : 
                               source === 'scheduled' ? '⏰' : 
                               source === 'auto_response' ? '🤖' : 
                               source === 'fallback' ? '📋' : '❓';
                    const rate = data.total > 0 ? Math.round((data.successful / data.total) * 100) : 0;
                    return `${icon} ${source}: ${data.successful}/${data.total} (${rate}%)`;
                })
                .join('\n');
            
            embed.addFields({
                name: '📈 Breakdown by Trigger Source',
                value: triggerStats,
                inline: true
            });
        }

        // Add breakdown by request type if data available
        if (stats.typeBreakdown && Object.keys(stats.typeBreakdown).length > 0) {
            const typeStats = Object.entries(stats.typeBreakdown)
                .map(([type, data]) => {
                    const icon = type === 'meal' ? '🍽️' : type === 'snack' ? '🍿' : type === 'workout' ? '💪' : '❓';
                    const rate = data.total > 0 ? Math.round((data.successful / data.total) * 100) : 0;
                    return `${icon} ${type}: ${data.successful}/${data.total} (${rate}%)`;
                })
                .join('\n');
            
            embed.addFields({
                name: '📊 Breakdown by Request Type',
                value: typeStats,
                inline: true
            });
        }

        // System info
        embed.addFields({
            name: '🔧 System Configuration',
            value: [
                `Channel: ${config.wellnessChannelId ? `<#${config.wellnessChannelId}>` : 'Not configured'}`,
                `LocalAI URL: ${config.localAIUrl ? 'Configured' : 'Not configured'}`,
                `Model: ${config.localAIModel || 'Not specified'}`
            ].join('\n'),
            inline: false
        });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('[ADMIN] Error displaying admin stats:', error);
        await interaction.reply({
            content: 'Failed to retrieve admin statistics. Please try again.',
            ephemeral: true
        });
    }
}

function getColorForType(type) {
    switch (type) {
        case 'meals':
            return '#ff6b6b';
        case 'snacks':
            return '#4ecdc4';
        case 'workouts':
            return '#45b7d1';
        default:
            return '#ffa500';
    }
}
