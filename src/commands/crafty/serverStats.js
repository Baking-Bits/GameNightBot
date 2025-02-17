import { craftyApiKey } from '../../config.json';
import { MessageEmbed } from 'discord.js';
let fetch;
(async () => {
    fetch = (await import('node-fetch')).default;
})();

module.exports = {
    data: {
        name: 'serverStats',
        description: 'Get statistics of a specified server',
        options: [
            {
                name: 'server_id',
                description: 'The ID of the server',
                type: 3, // STRING
                required: true
            }
        ]
    },
    async execute(interaction, bot) {
        const serverId = interaction.options.getString('server_id', true);

        try {
            const response = await fetch(`https://mc.gamenight.fun:8443/api/v2/servers/${serverId}/statistics`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${craftyApiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error fetching server statistics: ${response.statusText}`);
            }

            const statistics = await response.json();
            const embed = new MessageEmbed()
                .setTitle(`Server Statistics for ${serverId}`)
                .addField('CPU Usage', `${statistics.cpuUsage}%`, true)
                .addField('Memory Usage', `${statistics.memoryUsage} MB`, true)
                .addField('Disk Usage', `${statistics.diskUsage} GB`, true)
                .addField('Players Online', `${statistics.playersOnline}`, true)
                .addField('Uptime', `${statistics.uptime} hours`, true)
                .setColor('#00FF00');

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error fetching server statistics:', error);
            await interaction.reply({ content: `There was an error fetching the server statistics: ${error.message}`, ephemeral: true });
        }
    },
};