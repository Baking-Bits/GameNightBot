module.exports = {
    name: 'interactionCreate',
    async execute(interaction, bot) {
        // Handle slash commands
        if (interaction.isCommand()) {
            const command = bot.commands.get(interaction.commandName);
            if (!command) return;

            try {
                // Special handling for aimealplan command to pass additional context
                if (interaction.commandName === 'aimealplan') {
                    await command.execute(interaction, {
                        aiMealPlan: bot.aiMealPlan,
                        config: bot.config
                    });
                } else {
                    await command.execute(interaction, bot);
                }
            } catch (error) {
                console.error(error);
                await interaction.reply({ 
                    content: 'There was an error executing this command!', 
                    ephemeral: true 
                });
            }
        }
        
        // Handle modal submissions
        else if (interaction.isModalSubmit()) {
            try {
                if (interaction.customId.startsWith('crafty_command_modal_')) {
                    await handleCraftyCommandModal(interaction);
                }
            } catch (error) {
                console.error('Error handling modal:', error);
                await interaction.reply({ 
                    content: 'There was an error processing your request!', 
                    ephemeral: true 
                });
            }
        }
    }
};

async function handleCraftyCommandModal(interaction) {
    const { craftyApiKey, adminRoles } = require('../../config.json');
    
    // Check admin permissions
    const isAdmin = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
    if (!isAdmin) {
        await interaction.reply({ 
            content: '❌ Admin permissions required to send server commands.', 
            ephemeral: true 
        });
        return;
    }
    
    const serverId = interaction.customId.replace('crafty_command_modal_', '');
    const command = interaction.fields.getTextInputValue('command_input');
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const response = await fetch(`https://crafty.gamenight.fun/api/v2/servers/${serverId}/action`, {
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
        
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
            .setTitle('⚡ Command Sent Successfully')
            .setDescription(`Command \`${command}\` has been sent to server \`${serverId}\``)
            .setColor('#4CAF50')
            .setTimestamp()
            .setFooter({ text: 'Command executed via Admin Panel' });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error sending server command:', error);
        await interaction.editReply({ 
            content: `❌ Failed to send command: ${error.message}` 
        });
    }
}
