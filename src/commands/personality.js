const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getPersonalityChoices, getPersonalityDescription, getAllPersonalities } = require('../utils/personalities');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('personality')
        .setDescription('Manage AI personality settings')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Change the AI personality level')
                .addStringOption(option => {
                    const choices = getPersonalityChoices();
                    const optionBuilder = option.setName('level')
                        .setDescription('Choose personality level')
                        .setRequired(true);
                    
                    // Add all personality choices dynamically
                    choices.forEach(choice => {
                        optionBuilder.addChoices(choice);
                    });
                    
                    return optionBuilder;
                }))
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Show current AI personality setting'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, bot) {
        const subcommand = interaction.options.getSubcommand();
        
        try {
            // Read current config
            const configPath = path.join(__dirname, '../../config.json');
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            
            // Get all personalities from centralized definitions
            const personalities = getAllPersonalities();
            
            if (subcommand === 'show') {
                const currentPersonality = config.aiSelfFiltering?.personalityLevel || 'professional';
                const currentPersonalityInfo = personalities[currentPersonality] || personalities.professional;
                
                // Build available options dynamically
                const availableOptions = Object.keys(personalities).map(key => {
                    const personality = personalities[key];
                    return `• ${personality.icon} **${personality.name}** - ${personality.description}`;
                }).join('\n');
                
                const embed = {
                    color: 0x0099ff,
                    title: '🎭 Current AI Personality',
                    fields: [
                        {
                            name: 'Active Setting',
                            value: `${currentPersonalityInfo.icon} **${currentPersonalityInfo.name}**\n${currentPersonalityInfo.description}`,
                            inline: false
                        },
                        {
                            name: 'Available Options',
                            value: availableOptions,
                            inline: false
                        }
                    ],
                    footer: {
                        text: 'Use /personality set <level> to change the setting'
                    },
                    timestamp: new Date().toISOString()
                };
                
                await interaction.reply({ embeds: [embed], ephemeral: true });
                
            } else if (subcommand === 'set') {
                const newPersonality = interaction.options.getString('level');
                
                // Validate that the personality exists
                if (!personalities[newPersonality]) {
                    await interaction.reply({ 
                        content: 'Invalid personality level specified.', 
                        ephemeral: true 
                    });
                    return;
                }
                
                // Update personality level
                if (!config.aiSelfFiltering) {
                    config.aiSelfFiltering = {};
                }
                
                const oldPersonality = config.aiSelfFiltering.personalityLevel || 'professional';
                config.aiSelfFiltering.personalityLevel = newPersonality;
                
                // Write updated config back to file
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                
                // Get personality info for display
                const oldPersonalityInfo = personalities[oldPersonality] || personalities.professional;
                const newPersonalityInfo = personalities[newPersonality];
                
                // Create response message
                const embed = {
                    color: 0x00ff00,
                    title: '🎭 AI Personality Updated',
                    fields: [
                        {
                            name: 'Previous Setting',
                            value: `${oldPersonalityInfo.icon} ${oldPersonalityInfo.name} - ${oldPersonalityInfo.description}`,
                            inline: false
                        },
                        {
                            name: 'New Setting',
                            value: `${newPersonalityInfo.icon} ${newPersonalityInfo.name} - ${newPersonalityInfo.description}`,
                            inline: false
                        }
                    ],
                    footer: {
                        text: 'Changes take effect immediately for new AI responses'
                    },
                    timestamp: new Date().toISOString()
                };
                
                await interaction.reply({ embeds: [embed], ephemeral: true });
                
                // Log the change
                console.log(`AI personality changed from ${oldPersonality} to ${newPersonality} by ${interaction.user.tag}`);
            }
            
        } catch (error) {
            console.error('Error managing AI personality:', error);
            await interaction.reply({ 
                content: 'There was an error managing the AI personality. Please check the logs.', 
                ephemeral: true 
            });
        }
    },
};
