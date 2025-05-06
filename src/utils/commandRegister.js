const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const fs = require('fs');

async function registerCommands(client, bot, token) {
    const commands = [];
    const commandFiles = fs.readdirSync('./src/commands').filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(`../commands/${file}`);
        commands.push(command.data);
    }

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
