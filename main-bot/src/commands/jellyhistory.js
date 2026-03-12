const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const JellyActionHistoryStore = require('../services/JellyActionHistoryStore');

function isAdmin(interaction, config) {
    return config.adminRoles?.some(roleId =>
        interaction.member?.roles.cache.has(roleId)
    );
}

function toServiceLabel(service) {
    return service === 'jellyfin' ? 'Jellyfin' : 'Jellyseerr';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jellyhistory')
        .setDescription('View Jellyfin/Jellyseerr button action history (Admin only)')
        .addStringOption(option =>
            option
                .setName('service')
                .setDescription('Choose which service history to view')
                .addChoices(
                    { name: 'All', value: 'all' },
                    { name: 'Jellyfin', value: 'jellyfin' },
                    { name: 'Jellyseerr', value: 'jellyseerr' }
                )
        )
        .addIntegerOption(option =>
            option
                .setName('days')
                .setDescription('How many days back to include (max 30)')
                .setMinValue(1)
                .setMaxValue(30)
        )
        .addIntegerOption(option =>
            option
                .setName('limit')
                .setDescription('Maximum entries to display')
                .setMinValue(1)
                .setMaxValue(50)
        ),

    async execute(interaction, bot) {
        if (!isAdmin(interaction, bot.config)) {
            return interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true
            });
        }

        const serviceFilter = interaction.options.getString('service') || 'all';
        const days = interaction.options.getInteger('days') || 30;
        const limit = interaction.options.getInteger('limit') || 25;

        await interaction.deferReply({ ephemeral: true });

        try {
            const jellyfinStore = new JellyActionHistoryStore('jellyfin', 'jellyfinActionHistory.json');
            const jellyseerrStore = new JellyActionHistoryStore('jellyseerr', 'jellyseerrActionHistory.json');

            await Promise.all([
                jellyfinStore.initialize(),
                jellyseerrStore.initialize()
            ]);

            const jellyfinHistory = jellyfinStore.getHistory({ days, limit: 500 });
            const jellyseerrHistory = jellyseerrStore.getHistory({ days, limit: 500 });

            let combined = [
                ...jellyfinHistory.map(item => ({ ...item, service: 'jellyfin' })),
                ...jellyseerrHistory.map(item => ({ ...item, service: 'jellyseerr' }))
            ];

            if (serviceFilter !== 'all') {
                combined = combined.filter(item => item.service === serviceFilter);
            }

            combined.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
            const shown = combined.slice(0, limit);

            const titleScope = serviceFilter === 'all'
                ? 'Jellyfin + Jellyseerr'
                : toServiceLabel(serviceFilter);

            const embed = new EmbedBuilder()
                .setTitle('🧾 Jelly Action History')
                .setColor('#5865F2')
                .setDescription(`Showing **${shown.length}** of **${combined.length}** actions from the last **${days}** day(s) for **${titleScope}**.`)
                .setTimestamp();

            if (shown.length === 0) {
                embed.addFields({
                    name: 'No Actions Found',
                    value: 'No button actions were recorded in the selected time range.',
                    inline: false
                });

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            const lines = shown.map(item => {
                const serviceLabel = toServiceLabel(item.service);
                const actionLabel = item.action === 'restart' ? 'Restart' : 'Start';
                return `• <t:${item.timestamp}:R> — <@${item.userId}> used **${actionLabel}** on **${serviceLabel}**`;
            });

            embed.addFields({
                name: 'Recent Actions',
                value: lines.join('\n').slice(0, 1024),
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[JELLYHISTORY CMD] Failed to load history:', error);
            await interaction.editReply(`❌ Failed to load action history: \`${error.message}\``);
        }
    }
};
