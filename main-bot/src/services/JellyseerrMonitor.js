const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

class JellyseerrMonitor {
    constructor(bot, config) {
        this.bot = bot;
        this.client = bot.client;
        this.config = config;
        this.statusMessage = null;
        this.updateInterval = null;
        this.buttonHandlerRegistered = false;

        const rawUrl = config.services?.find(s => s.name === 'Jellyseer')?.url ||
            config.services?.find(s => s.name === 'Jellyseerr')?.url || '';
        this.jellyseerrUrl = rawUrl.replace(/\/+$/, '');

        this.apiKey = config.jellyseerrApiKey;
        this.channelId = config.jellyseerrStatusChannelId;
        this.intervalMs = config.jellyseerrMonitorInterval || 60 * 1000;

        this.unraidDocker = config.unraidDocker || {};
        this.containerName = this.unraidDocker.jellyseerrContainerName || 'jellyseerr';
    }

    get headers() {
        return {
            'X-Api-Key': this.apiKey,
            'Content-Type': 'application/json'
        };
    }

    _isAdmin(interaction) {
        return this.config.adminRoles?.some(roleId =>
            interaction.member?.roles.cache.has(roleId)
        );
    }

    isDockerControlConfigured() {
        return !!(this.unraidDocker.host && this.unraidDocker.username &&
            (this.unraidDocker.password || this.unraidDocker.privateKeyPath));
    }

    formatIntervalText() {
        if (this.intervalMs < 60000) {
            return `${Math.round(this.intervalMs / 1000)} sec`;
        }
        return `${Math.round(this.intervalMs / 60000)} min`;
    }

    resolvePrivateKeyPath(rawPath) {
        const keyPath = path.isAbsolute(rawPath)
            ? rawPath
            : path.join(__dirname, '../../../', rawPath);

        if (!fs.existsSync(keyPath)) {
            throw new Error(`SSH private key not found: ${keyPath}`);
        }

        return keyPath;
    }

    async runDockerCommand(command) {
        if (!this.isDockerControlConfigured()) {
            throw new Error('Unraid Docker SSH is not configured');
        }

        const keyPath = this.unraidDocker.privateKeyPath
            ? this.resolvePrivateKeyPath(this.unraidDocker.privateKeyPath)
            : null;

        try {
            return await this.runDockerCommandWithNodeSsh(command, keyPath);
        } catch (error) {
            const isKeyFormatError = String(error.message || '').includes('Cannot parse privateKey: Unsupported key format');

            if (isKeyFormatError && keyPath) {
                console.warn('[JELLYSEERR MONITOR] node-ssh could not parse key format; falling back to system ssh client');
                return await this.runDockerCommandWithCliSsh(command, keyPath);
            }

            throw error;
        }
    }

    async runDockerCommandWithNodeSsh(command, keyPath) {
        const ssh = new NodeSSH();
        const connectOptions = {
            host: this.unraidDocker.host,
            username: this.unraidDocker.username,
            port: this.unraidDocker.port || 22,
            readyTimeout: 10000
        };

        if (keyPath) {
            connectOptions.privateKey = keyPath;
            if (this.unraidDocker.passphrase) {
                connectOptions.passphrase = this.unraidDocker.passphrase;
            }
        } else {
            connectOptions.password = this.unraidDocker.password;
        }

        try {
            await ssh.connect(connectOptions);
            const result = await ssh.execCommand(command);
            if (result.code !== 0) {
                throw new Error((result.stderr || result.stdout || 'Unknown docker command error').trim());
            }
            return (result.stdout || '').trim();
        } finally {
            ssh.dispose();
        }
    }

    async runDockerCommandWithCliSsh(command, keyPath) {
        const sshArgs = [
            '-i', keyPath,
            '-o', 'BatchMode=yes',
            '-o', 'StrictHostKeyChecking=accept-new',
            '-o', 'ConnectTimeout=10',
            '-p', String(this.unraidDocker.port || 22),
            `${this.unraidDocker.username}@${this.unraidDocker.host}`,
            command
        ];

        try {
            const { stdout } = await execFileAsync('ssh', sshArgs, {
                timeout: 20000,
                maxBuffer: 1024 * 1024
            });
            return (stdout || '').trim();
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error('System ssh client is not available in this runtime environment');
            }

            const detail = (error.stderr || error.stdout || error.message || 'Unknown SSH CLI error').trim();
            throw new Error(detail);
        }
    }

    async getDockerContainerState() {
        if (!this.isDockerControlConfigured()) {
            return null;
        }

        try {
            const state = await this.runDockerCommand(`docker inspect -f "{{.State.Status}}" ${this.containerName}`);
            return state || 'unknown';
        } catch (error) {
            return `unavailable (${error.message.slice(0, 120)})`;
        }
    }

    async startFromCrash() {
        await this.runDockerCommand(`docker start ${this.containerName}`);
    }

    async restartFromDocker() {
        await this.runDockerCommand(`docker restart ${this.containerName}`);
    }

    async getServerInfo() {
        try {
            const statusRes = await axios.get(`${this.jellyseerrUrl}/api/v1/status`, {
                headers: this.headers,
                timeout: 8000
            });

            return { online: statusRes.status === 200, info: statusRes.data || {}, error: null };
        } catch (error) {
            return { online: false, info: null, error: error.message };
        }
    }

    getRequestMediaType(request) {
        const requestType = String(request?.type || '').toLowerCase();
        const mediaType = String(request?.media?.mediaType || request?.mediaType || '').toLowerCase();

        if (requestType === 'movie' || mediaType === 'movie') return 'movie';
        if (requestType === 'tv' || requestType === 'show' || mediaType === 'tv' || mediaType === 'show') return 'tv';
        return null;
    }

    getMovieTvCounts(requests) {
        let movies = 0;
        let tv = 0;

        for (const request of requests) {
            const mediaType = this.getRequestMediaType(request);
            if (mediaType === 'movie') movies += 1;
            else if (mediaType === 'tv') tv += 1;
        }

        return { movies, tv, total: movies + tv };
    }

    formatMovieTvCounts(counts) {
        return `🎬 Movies: **${counts.movies}**\n📺 TV: **${counts.tv}**\n📦 Total: **${counts.total}**`;
    }

    formatCompactTypeBreakdown(typeCounts) {
        return `Pending **${typeCounts.pendingApproval}**\nQueue **${typeCounts.pendingDownload}**\nDone **${typeCounts.totalDownloaded}**`;
    }

    async getPendingSummary() {
        try {
            const requestRes = await axios.get(`${this.jellyseerrUrl}/api/v1/request`, {
                headers: this.headers,
                timeout: 10000,
                params: {
                    take: 200,
                    skip: 0,
                    sort: 'added'
                }
            });

            const requests = Array.isArray(requestRes.data?.results)
                ? requestRes.data.results
                : [];

            const summary = {
                movies: { pendingApproval: 0, pendingDownload: 0, totalDownloaded: 0 },
                tv: { pendingApproval: 0, pendingDownload: 0, totalDownloaded: 0 }
            };

            for (const request of requests) {
                const mediaType = this.getRequestMediaType(request);
                if (!mediaType || !summary[mediaType]) continue;

                if (request.status === 1) {
                    summary[mediaType].pendingApproval += 1;
                }

                if (request.status === 2 && request?.media?.status !== 5) {
                    summary[mediaType].pendingDownload += 1;
                }

                if (request?.media?.status === 5) {
                    summary[mediaType].totalDownloaded += 1;
                }
            }

            return {
                summary,
                error: null
            };
        } catch (error) {
            return {
                summary: {
                    movies: { pendingApproval: 0, pendingDownload: 0, totalDownloaded: 0 },
                    tv: { pendingApproval: 0, pendingDownload: 0, totalDownloaded: 0 }
                },
                error: error.message
            };
        }
    }

    async buildEmbed() {
        const { online, info, error } = await this.getServerInfo();
        const summary = await this.getPendingSummary();
        const dockerState = await this.getDockerContainerState();

        const color = online ? '#00C851' : '#FF4444';
        const statusText = online ? '🟢 **Online**' : '🔴 **Offline**';

        const embed = new EmbedBuilder()
            .setTitle('🎞️ Jellyseerr')
            .setColor(color)
            .setTimestamp()
            .setFooter({ text: `Auto re-poll: ${this.formatIntervalText()} • Last checked` });

        if (online) {
            embed.addFields(
                { name: 'Status', value: statusText, inline: true },
                { name: 'Version', value: info?.version || 'Unknown', inline: true },
                {
                    name: 'Movies',
                    value: this.formatCompactTypeBreakdown(summary.summary.movies),
                    inline: true
                },
                {
                    name: 'TV',
                    value: this.formatCompactTypeBreakdown(summary.summary.tv),
                    inline: true
                }
            );
        } else {
            embed.addFields(
                { name: 'Status', value: statusText, inline: true },
                { name: 'URL', value: `[${this.jellyseerrUrl}](${this.jellyseerrUrl})`, inline: true }
            );

            if (error) {
                embed.addFields({ name: 'Last Error', value: `\`${error.slice(0, 512)}\``, inline: false });
            }
        }

        if (summary.error) {
            embed.addFields({
                name: 'Request API Warning',
                value: `\`${summary.error.slice(0, 512)}\``,
                inline: false
            });
        }

        const canStart = !!dockerState && (dockerState === 'exited' || dockerState === 'dead' || dockerState === 'created');

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('jellyseerr_start')
                .setLabel('Start')
                .setStyle(canStart ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji('🚀')
                .setDisabled(!canStart),
            new ButtonBuilder()
                .setCustomId('jellyseerr_restart')
                .setLabel('Restart Jellyseerr')
                .setStyle(online ? ButtonStyle.Danger : ButtonStyle.Secondary)
                .setEmoji('🔄')
                .setDisabled(!online && !this.isDockerControlConfigured())
        );

        return { embed, components: [buttons] };
    }

    async updateStatusMessage() {
        try {
            if (!this.statusMessage) return;
            const { embed, components } = await this.buildEmbed();
            await this.statusMessage.edit({ embeds: [embed], components });
        } catch (error) {
            console.error('[JELLYSEERR MONITOR] Failed to update status message:', error);
            if (error.code === 10008) {
                this.statusMessage = null;
                await this.initialize();
            }
        }
    }

    setupButtonHandler() {
        if (this.buttonHandlerRegistered) {
            return;
        }

        this.buttonHandlerRegistered = true;
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isButton()) return;

            if (interaction.customId === 'jellyseerr_start') {
                if (!this._isAdmin(interaction)) {
                    await interaction.reply({ content: '❌ You need admin permissions to start Jellyseerr.', ephemeral: true });
                    return;
                }

                await interaction.deferReply({ ephemeral: true });
                try {
                    await this.startFromCrash();
                    await interaction.editReply('✅ Start command sent to the Jellyseerr Docker container. Checking status shortly...');
                    setTimeout(() => this.updateStatusMessage(), 8000);
                    setTimeout(() => this.updateStatusMessage(), 20000);
                } catch (error) {
                    await interaction.editReply(`❌ Failed to start Jellyseerr container: \`${error.message}\``);
                }
            } else if (interaction.customId === 'jellyseerr_restart') {
                if (!this._isAdmin(interaction)) {
                    await interaction.reply({ content: '❌ You need admin permissions to restart Jellyseerr.', ephemeral: true });
                    return;
                }

                await interaction.deferReply({ ephemeral: true });
                try {
                    const { online } = await this.getServerInfo();
                    if (online) {
                        await axios.post(`${this.jellyseerrUrl}/api/v1/settings/main/regenerate`, {}, {
                            headers: this.headers,
                            timeout: 10000
                        }).catch(() => null);
                    }

                    if (this.isDockerControlConfigured()) {
                        await this.restartFromDocker();
                    } else if (!online) {
                        throw new Error('Jellyseerr is offline and Unraid Docker control is not configured');
                    }

                    await interaction.editReply('✅ Restart command sent to Jellyseerr. Status will auto-refresh shortly.');
                    setTimeout(() => this.updateStatusMessage(), 15000);
                    setTimeout(() => this.updateStatusMessage(), 35000);
                } catch (error) {
                    await interaction.editReply(`❌ Failed to restart Jellyseerr: \`${error.message}\``);
                }
            }
        });
    }

    startMonitoring() {
        this.updateStatusMessage();
        this.updateInterval = setInterval(() => {
            this.updateStatusMessage();
        }, this.intervalMs);

        console.log(`[JELLYSEERR MONITOR] Auto-refresh every ${this.intervalMs / 1000}s`);
    }

    async initialize() {
        if (!this.channelId || !this.apiKey || !this.jellyseerrUrl) {
            console.log('[JELLYSEERR MONITOR] Skipping — jellyseerrStatusChannelId, jellyseerrApiKey, or Jellyseer service URL not set');
            return;
        }

        try {
            const channel = await this.client.channels.fetch(this.channelId);
            if (!channel) {
                console.error('[JELLYSEERR MONITOR] Channel not found:', this.channelId);
                return;
            }

            const messages = await channel.messages.fetch({ limit: 30 });
            const existing = messages.find(msg =>
                msg.author.id === this.client.user.id &&
                msg.embeds.length > 0 &&
                msg.embeds[0].title === '🎞️ Jellyseerr Requests'
            );

            if (existing) {
                this.statusMessage = existing;
            } else {
                const { embed, components } = await this.buildEmbed();
                this.statusMessage = await channel.send({ embeds: [embed], components });
            }

            this.setupButtonHandler();
            this.startMonitoring();
            console.log('[JELLYSEERR MONITOR] Initialized successfully');
        } catch (error) {
            console.error('[JELLYSEERR MONITOR] Failed to initialize:', error);
        }
    }

    async shutdown() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        console.log('[JELLYSEERR MONITOR] Shut down');
    }
}

module.exports = JellyseerrMonitor;
