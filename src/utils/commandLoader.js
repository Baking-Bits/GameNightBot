const fs = require('fs');
const path = require('path');

function loadCommands(bot) {
    const commands = new Map();
    const commandsPath = path.join(__dirname, '..', 'commands');

    function readCommands(directory) {
        const files = fs.readdirSync(directory);
        for (const file of files) {
            const filePath = path.join(directory, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                readCommands(filePath);
            } else if (file.endsWith('.js')) {
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    commands.set(command.data.name, command);
                } else {
                    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
                }
            }
        }
    }

    readCommands(commandsPath);
    bot.commands = commands;
    return commands;
}

module.exports = { loadCommands };