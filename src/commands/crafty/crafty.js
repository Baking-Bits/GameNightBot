const { craftyApiKey } = require('../../../config.json');
const { MessageEmbed } = require('discord.js');
let fetch;
(async () => {
    fetch = (await import('node-fetch')).default;
})();

module.exports = {
    data: {
        name: 'crafty',
        description: 'CraftyControl commands',
        options: [
            {
                name: 'getservers',
                description: 'Fetches all servers from CraftyControl',
                type: 1 // SUB_COMMAND
            },
            {
                name: 'getserverlogs',
                description: 'Get logs of a specified server',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'server_id',
                        description: 'The ID of the server',
                        type: 3, // STRING
                        required: true
                    }
                ]
            },
            {
                name: 'servercommand',
                description: 'Send a command to a specified server',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'server_id',
                        description: 'The ID of the server',
                        type: 3, // STRING
                        required: true
                    },
                    {
                        name: 'command',
                        description: 'The command to send',
                        type: 3, // STRING
                        required: true
                    }
                ]
            }
        ]
    },
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const serverId = interaction.options.getString('server_id');
        const command = interaction.options.getString('command');

        try {
            let response;
            switch (subcommand) {
                case 'getservers':
                    response = await fetch('https://mc.gamenight.fun:8443/api/v2/servers', {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${craftyApiKey}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    if (!response.ok) throw new Error(`Error fetching servers: ${response.statusText}`);
                    const servers = await response.json();
                    const serverList = servers.map(server => `${server.name} (ID: ${server.id})`).join('\n');
                    await interaction.reply({ content: `Servers:\n${serverList}`, ephemeral: true });
                    break;

                case 'getserverlogs':
                    response = await fetch(`https://mc.gamenight.fun:8443/api/v2/servers/${serverId}/logs`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${craftyApiKey}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    if (!response.ok) throw new Error(`Error fetching server logs: ${response.statusText}`);
                    const logs = await response.json();
                    const embed = new MessageEmbed()
                        .setTitle(`Server Logs for ${serverId}`)
                        .setDescription(`\`\`\`${logs.logs.join('\n')}\`\`\``)
                        .setColor('#00FF00');
                    await interaction.reply({ embeds: [embed], ephemeral: true });
                    break;

                case 'servercommand':
                    response = await fetch(`https://mc.gamenight.fun:8443/api/v2/servers/${serverId}/actions`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${craftyApiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ command })
                    });
                    if (!response.ok) throw new Error(`Error sending command: ${response.statusText}`);
                    await interaction.reply({ content: `Command sent successfully to server ${serverId}`, ephemeral: true });
                    break;

                default:
                    await interaction.reply({ content: 'Unknown subcommand', ephemeral: true });
            }
        } catch (error) {
            console.error(`Error executing subcommand ${subcommand}:`, error);
            await interaction.reply({ content: `There was an error executing the command: ${error.message}`, ephemeral: true });
        }
    },
};