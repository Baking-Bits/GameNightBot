const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aimealplan')
        .setDescription('AI-powered meal planning and workout system')
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
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('history')
                .setDescription('View recent meal plan and workout history')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Type of history to view')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Meals', value: 'meals' },
                            { name: 'Snacks', value: 'snacks' },
                            { name: 'Workouts', value: 'workouts' }
                        )
                )
                .addIntegerOption(option =>
                    option
                        .setName('count')
                        .setDescription('Number of items to show (default: 5)')
                        .setMinValue(1)
                        .setMaxValue(20)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Toggle the automatic meal plan and workout schedule')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('schedule')
                .setDescription('View the current schedule for meals, snacks, and workouts')
        ),

    async execute(interaction, { aiMealPlan, config }) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'generate':
                    await handleGenerate(interaction, aiMealPlan);
                    break;
                case 'history':
                    await handleHistory(interaction, aiMealPlan);
                    break;
                case 'toggle':
                    await handleToggle(interaction, aiMealPlan);
                    break;
                case 'schedule':
                    await handleSchedule(interaction, config);
                    break;
                default:
                    await interaction.reply({
                        content: 'Unknown subcommand. Please use one of: generate, history, toggle, or schedule.',
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error('Error in aimealplan command:', error);
            
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

async function handleGenerate(interaction, aiMealPlan) {
    const type = interaction.options.getString('type');
    const requirements = interaction.options.getString('requirements');
    
    await interaction.deferReply();
    
    try {
        let result;
        switch (type) {
            case 'meal':
                result = await aiMealPlan.generateMeal(requirements);
                break;
            case 'snack':
                result = await aiMealPlan.generateSnack(requirements);
                break;
            case 'workout':
                result = await aiMealPlan.generateWorkout(requirements);
                break;
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

async function handleHistory(interaction, aiMealPlan) {
    const type = interaction.options.getString('type');
    const count = interaction.options.getInteger('count') || 5;
    
    try {
        const history = aiMealPlan.getHistory(type, count);
        
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

async function handleToggle(interaction, aiMealPlan) {
    try {
        const isEnabled = aiMealPlan.toggleSchedule();
        
        const embed = new EmbedBuilder()
            .setTitle('Schedule Status Updated')
            .setDescription(`Automatic meal plan and workout schedule is now **${isEnabled ? 'ENABLED' : 'DISABLED'}**`)
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
        const schedule = config.mealPlanSchedule;
        
        if (!schedule) {
            await interaction.reply({
                content: 'No meal plan schedule configured.',
                ephemeral: true
            });
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('Current Meal Plan & Workout Schedule')
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
            value: config.mealPlanChannelId ? `<#${config.mealPlanChannelId}>` : 'Not configured',
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
