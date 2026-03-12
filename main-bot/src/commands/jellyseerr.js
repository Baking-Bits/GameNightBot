const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jellyseerr')
        .setDescription('Jellyseerr request server management')
        .addSubcommand(sub =>
            sub
                .setName('status')
                .setDescription('Check current Jellyseerr status and pending request counts'))
        .addSubcommand(sub =>
            sub
                .setName('restart')
                .setDescription('Restart Jellyseerr (Admin only)'))
        .addSubcommand(sub =>
            sub
                .setName('start')
                .setDescription('Start Jellyseerr (Admin only)')),

    async execute(interaction, bot) {
        const sub = interaction.options.getSubcommand();
        const config = bot.config;

        const isAdmin = config.adminRoles?.some(roleId =>
            interaction.member?.roles.cache.has(roleId)
        );

        const monitor = bot.jellyseerrMonitor;
        if (!monitor) {
            return interaction.reply({
                content: '❌ Jellyseerr monitor is not configured. Set `jellyseerrApiKey`, `jellyseerrStatusChannelId`, and Jellyseer/Jellyseerr service URL in config.json.',
                ephemeral: true
            });
        }

        if (sub === 'status') {
            await interaction.deferReply({ ephemeral: true });

            try {
                const server = await monitor.getServerInfo();
                const summary = await monitor.getPendingSummary();

                const online = !!server.online;

                const embed = new EmbedBuilder()
                    .setTitle('🎞️ Jellyseerr Status')
                    .setColor(online ? '#00C851' : '#FF4444')
                    .setTimestamp()
                    .addFields(
                        { name: 'Status', value: online ? '🟢 Online' : '🔴 Offline', inline: true },
                        { name: 'Version', value: server.info?.version || 'N/A', inline: true },
                        {
                            name: 'Movies',
                            value: monitor.formatCompactTypeBreakdown(summary.summary.movies),
                            inline: true
                        },
                        {
                            name: 'TV',
                            value: monitor.formatCompactTypeBreakdown(summary.summary.tv),
                            inline: true
                        }
                    );

                if (server.error) {
                    embed.addFields({ name: 'Server Error', value: `\`${server.error.slice(0, 512)}\``, inline: false });
                }

                if (summary.error) {
                    embed.addFields({ name: 'Request API Warning', value: `\`${summary.error.slice(0, 512)}\``, inline: false });
                }

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error('[JELLYSEERR CMD] Status check failed:', error);
                await interaction.editReply(`❌ Could not check Jellyseerr: \`${error.message}\``);
            }

            return;
        }

        if (!isAdmin) {
            return interaction.reply({
                content: `❌ You need admin permissions to ${sub} Jellyseerr.`,
                ephemeral: true
            });
        }

        if (sub === 'start') {
            if (!monitor.isDockerControlConfigured()) {
                return interaction.reply({
                    content: '❌ Start is not configured. Add `unraidDocker` settings in config.json.',
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                await monitor.startFromCrash();
                await interaction.editReply('✅ Start command sent to the Jellyseerr Docker container.');
                setTimeout(() => monitor.updateStatusMessage(), 8000);
                setTimeout(() => monitor.updateStatusMessage(), 20000);
            } catch (error) {
                console.error('[JELLYSEERR CMD] Start failed:', error);
                await interaction.editReply(`❌ Failed to start Jellyseerr: \`${error.message}\``);
            }

            return;
        }

        if (sub === 'restart') {
            await interaction.deferReply({ ephemeral: true });

            try {
                if (!monitor.isDockerControlConfigured()) {
                    const { online } = await monitor.getServerInfo();
                    if (!online) {
                        throw new Error('Jellyseerr is offline and Unraid Docker control is not configured');
                    }
                } else {
                    await monitor.restartFromDocker();
                }

                await interaction.editReply('✅ Restart command sent to Jellyseerr. Status will auto-refresh shortly.');
                setTimeout(() => monitor.updateStatusMessage(), 15000);
                setTimeout(() => monitor.updateStatusMessage(), 35000);
            } catch (error) {
                console.error('[JELLYSEERR CMD] Restart failed:', error);
                await interaction.editReply(`❌ Failed to restart Jellyseerr: \`${error.message}\``);
            }
        }
    }
};
