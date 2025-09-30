const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');

async function registerCommands(client, bot, token) {
    // Use the already loaded commands from the bot instance
    if (!bot.commands || bot.commands.size === 0) {
        console.error('No commands found in bot instance. Make sure loadCommands() is called first.');
        return;
    }

    // Extract command data from the loaded commands
    const commands = Array.from(bot.commands.values()).map(command => command.data);
    
    console.log(`Registering ${commands.length} commands...`);
    commands.forEach(cmd => console.log(`- ${cmd.name}`));

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log('Started refreshing application (/) commands.');

        // Register commands globally
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

module.exports = { registerCommands };