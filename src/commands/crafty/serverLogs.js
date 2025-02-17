import { craftyApiKey } from '../../config.json';
import { MessageEmbed } from 'discord.js';
let fetch;
(async () => {
    fetch = (await import('node-fetch')).default;
})();

module.exports = {
    data: {
        name: 'getServerLogs',
        description: 'Get logs of a specified server',
        options: [
            {
                name: 'server_id',
                description: 'The ID of the server',
                type: 3, // STRING
                required: true
            }
        ],
        default_member_permissions: 8 // ADMINISTRATOR
    },
    async execute(interaction, bot) {
        const serverId = interaction.options.getString('server_id', true);

        try {
            const response = await fetch(`https://mc.gamenight.fun:8443/api/v2/servers/${serverId}/logs`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${craftyApiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error fetching server logs: ${response.statusText}`);
            }

            const logs = await response.json();
            const embed = new MessageEmbed()
                .setTitle(`Server Logs for ${serverId}`)
                .setDescription(`\`\`\`${logs.logs.join('\n')}\`\`\``)
                .setColor('#00FF00');

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error fetching server logs:', error);
            await interaction.reply({ content: `There was an error fetching the server logs: ${error.message}`, ephemeral: true });
        }
    },
};