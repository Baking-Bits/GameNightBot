import { craftyApiKey } from '../../config.json';
let fetch;
(async () => {
    fetch = (await import('node-fetch')).default;
})();

module.exports = {
    data: {
        name: 'serverCommand',
        description: 'Send a command to a specified server',
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
        ],
        default_member_permissions: 8 // ADMINISTRATOR
    },
    async execute(interaction, bot) {
        const serverId = interaction.options.getString('server_id', true);
        const command = interaction.options.getString('command', true);

        try {
            const response = await fetch(`https://mc.gamenight.fun:8443/api/v2/servers/${serverId}/actions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${craftyApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ command })
            });

            if (!response.ok) {
                throw new Error(`Error sending command: ${response.statusText}`);
            }

            await interaction.reply({ content: `Command sent successfully to server ${serverId}`, ephemeral: true });
        } catch (error) {
            console.error('Error sending command:', error);
            await interaction.reply({ content: `There was an error sending the command: ${error.message}`, ephemeral: true });
        }
    },
};