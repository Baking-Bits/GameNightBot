const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const config = require('../../config.json'); // Load configuration file
let fetch;
(async () => {
    fetch = (await import('node-fetch')).default;
})();

module.exports = {
    data: {
        name: 'servicestatus',
        description: 'Check the status of various services',
        defaultPermission: false,
        permissions: [PermissionFlagsBits.Administrator]
    },
    async execute(interaction) {
        const statusChannel = interaction.guild.channels.cache.find(channel => channel.name === 'bot' && channel.type === ChannelType.GuildText);
        if (!statusChannel) {
            return interaction.reply({ content: 'Service status channel (#bot) not found.', ephemeral: true });
        }

        const statusEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Service Status')
            .setTimestamp();

        for (const service of config.services) { // Use services from config
            try {
                const response = await fetch(service.url);
                const status = response.ok ? 'Online' : `Offline (Status: ${response.status})`;
                statusEmbed.addFields({ name: service.name, value: status, inline: true });
            } catch (error) {
                statusEmbed.addFields({ name: service.name, value: `Error: ${error.message}`, inline: true });
            }
        }

        const messages = await statusChannel.messages.fetch({ limit: 10 });
        const botMessage = messages.find(msg => msg.author.id === interaction.client.user.id);

        if (botMessage) {
            await botMessage.edit({ embeds: [statusEmbed] });
        } else {
            await statusChannel.send({ embeds: [statusEmbed] });
        }

        await interaction.reply({ content: 'Service status updated.', ephemeral: true });
    }
};
