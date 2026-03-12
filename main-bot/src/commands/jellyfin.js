const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jellyfin')
        .setDescription('Jellyfin media server management')
        .addSubcommand(sub =>
            sub
                .setName('status')
                .setDescription('Check current Jellyfin server status'))
        .addSubcommand(sub =>
            sub
                .setName('restart')
                .setDescription('Restart the Jellyfin server (Admin only)'))
        .addSubcommand(sub =>
            sub
                .setName('start')
                .setDescription('Start Jellyfin (Admin only)')),

    async execute(interaction, bot) {
        const sub = interaction.options.getSubcommand();
        const config = bot.config;

        // Strip trailing slash from URL
        const rawUrl = config.services?.find(s => s.name === 'Jellyfin')?.url || '';
        const jellyfinUrl = rawUrl.replace(/\/+$/, '');
        const apiKey = config.jellyfinApiKey;

        if (!apiKey || !jellyfinUrl) {
            return interaction.reply({
                content: '❌ Jellyfin is not configured. Set `jellyfinApiKey` and a Jellyfin entry in `services[]` in config.json.',
                ephemeral: true
            });
        }

        const headers = { 'X-Emby-Token': apiKey, 'Content-Type': 'application/json' };

        // ── /jellyfin status ──────────────────────────────────────────────────
        if (sub === 'status') {
            await interaction.deferReply({ ephemeral: true });

            try {
                const [infoRes, sessionsRes] = await Promise.allSettled([
                    axios.get(`${jellyfinUrl}/System/Info`, { headers, timeout: 8000 }),
                    axios.get(`${jellyfinUrl}/Sessions`, { headers, timeout: 8000 })
                ]);

                const info = infoRes.status === 'fulfilled' ? infoRes.value.data : null;
                const sessions = sessionsRes.status === 'fulfilled' ? sessionsRes.value.data : [];
                const activeSessions = Array.isArray(sessions)
                    ? sessions.filter(s => s.NowPlayingItem).length
                    : 0;
                const online = !!info;

                const embed = new EmbedBuilder()
                    .setTitle('🎬 Jellyfin Status')
                    .setColor(online ? '#00C851' : '#FF4444')
                    .setTimestamp()
                    .addFields(
                        { name: 'Status',         value: online ? '🟢 Online'  : '🔴 Offline', inline: true },
                        { name: 'Version',        value: info?.Version || 'N/A',               inline: true },
                        { name: 'Active Streams', value: `${activeSessions}`,                  inline: true }
                    );

                if (online && info) {
                    embed.addFields(
                        { name: 'OS',          value: info.OperatingSystem || 'Unknown', inline: true }
                    );
                }

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('[JELLYFIN CMD] Status check failed:', error);
                await interaction.editReply(`❌ Could not reach Jellyfin: \`${error.message}\``);
            }
        }

        // ── /jellyfin restart ─────────────────────────────────────────────────
        else if (sub === 'restart') {
            const isAdmin = config.adminRoles?.some(roleId =>
                interaction.member?.roles.cache.has(roleId)
            );

            if (!isAdmin) {
                return interaction.reply({
                    content: '❌ You need admin permissions to restart Jellyfin.',
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                if (bot.jellyfinMonitor) {
                    const { online } = await bot.jellyfinMonitor.getServerInfo();
                    if (online) {
                        await axios.post(`${jellyfinUrl}/System/Restart`, {}, { headers, timeout: 10000 });
                    } else {
                        await bot.jellyfinMonitor.restartFromDocker();
                    }
                } else {
                    await axios.post(`${jellyfinUrl}/System/Restart`, {}, { headers, timeout: 10000 });
                }

                await interaction.editReply(
                    '✅ Restart command sent to Jellyfin.\n' +
                    'The server will briefly go offline and return on its own.\n' +
                    '⏳ The status embed will auto-update in ~20 seconds.'
                );

                // Trigger monitor updates so the embed reflects the outage then recovery
                if (bot.jellyfinMonitor) {
                    setTimeout(() => bot.jellyfinMonitor.updateStatusMessage(), 20000);
                    setTimeout(() => bot.jellyfinMonitor.updateStatusMessage(), 45000);
                }

            } catch (error) {
                console.error('[JELLYFIN CMD] Restart failed:', error);
                await interaction.editReply(`❌ Failed to restart Jellyfin: \`${error.message}\``);
            }
        }

        // ── /jellyfin start ───────────────────────────────────────────────────
        else if (sub === 'start') {
            const isAdmin = config.adminRoles?.some(roleId =>
                interaction.member?.roles.cache.has(roleId)
            );

            if (!isAdmin) {
                return interaction.reply({
                    content: '❌ You need admin permissions to start Jellyfin.',
                    ephemeral: true
                });
            }

            if (!bot.jellyfinMonitor || !bot.jellyfinMonitor.isDockerControlConfigured()) {
                return interaction.reply({
                    content: '❌ Start is not configured. Add `unraidDocker` settings in config.json.',
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                await bot.jellyfinMonitor.startFromCrash();
                await interaction.editReply('✅ Start command sent to the Jellyfin Docker container.');
                setTimeout(() => bot.jellyfinMonitor.updateStatusMessage(), 8000);
                setTimeout(() => bot.jellyfinMonitor.updateStatusMessage(), 20000);
            } catch (error) {
                console.error('[JELLYFIN CMD] Start failed:', error);
                await interaction.editReply(`❌ Failed to start Jellyfin: \`${error.message}\``);
            }
        }
    }
};
