module.exports = {
    name: 'interactionCreate',
    async execute(interaction, bot) {
        if (!interaction.isCommand()) return;

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
};
