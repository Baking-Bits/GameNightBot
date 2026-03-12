const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const JellyActionHistoryStore = require('./JellyActionHistoryStore');

const execFileAsync = promisify(execFile);

/**
 * JellyfinMonitor - Posts and maintains a live Jellyfin status embed in a dedicated channel.
 * Uses the Jellyfin HTTP API (no Docker access required).
 *
 * Buttons:
 *   🔃 Refresh  — manually re-polls the server and edits the embed (anyone)
 *   🔄 Restart  — calls POST /System/Restart via the Jellyfin API (admin only)
 */
class JellyfinMonitor {
    constructor(bot, config) {
        this.bot = bot;
        this.client = bot.client;
        this.config = config;
        this.statusMessage = null;
        this.updateInterval = null;

        // Strip any trailing slash from the Jellyfin URL
        const rawUrl = config.services?.find(s => s.name === 'Jellyfin')?.url || '';
        this.jellyfinUrl = rawUrl.replace(/\/+$/, '');

        this.apiKey = config.jellyfinApiKey;
        this.channelId = config.jellyfinStatusChannelId;
        this.buttonHandlerRegistered = false;

        // How often to auto-refresh the embed (default 1 min)
        this.intervalMs = config.jellyfinMonitorInterval || 60 * 1000;

        // Optional Unraid Docker control for start/restart states
        this.unraidDocker = config.unraidDocker || {};
        this.containerName = this.unraidDocker.jellyfinContainerName || 'jellyfin';
        this.actionHistoryStore = new JellyActionHistoryStore('jellyfin', 'jellyfinActionHistory.json');
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    get headers() {
        return {
            'X-Emby-Token': this.apiKey,
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
                console.warn('[JELLYFIN MONITOR] node-ssh could not parse key format; falling back to system ssh client');
                return await this.runDockerCommandWithCliSsh(command, keyPath);
            }

            throw error;
        }
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

    getActionHistory(options = {}) {
        return this.actionHistoryStore.getHistory(options);
    }

    async recordUserAction(action, userId) {
        return this.actionHistoryStore.recordAction({ action, userId, source: 'button' });
    }

    async sendActionAuditMessage(channel, action, userId, timestamp) {
        if (!channel || typeof channel.send !== 'function') {
            return;
        }

        const actionLabel = action === 'restart' ? 'restarted' : 'started';
        const message = await channel.send({
            content: `🛠️ Jellyfin was ${actionLabel} by <@${userId}> <t:${timestamp}:R>. If another restart is needed, please reach out to an admin first.`
        });

        setTimeout(async () => {
            await message.delete().catch(() => null);
        }, 60 * 60 * 1000);
    }

    // ─── API Calls ────────────────────────────────────────────────────────────

    async getServerInfo() {
        try {
            const [infoRes, sessionsRes] = await Promise.allSettled([
                axios.get(`${this.jellyfinUrl}/System/Info`, { headers: this.headers, timeout: 8000 }),
                axios.get(`${this.jellyfinUrl}/Sessions`, { headers: this.headers, timeout: 8000 })
            ]);

            const info = infoRes.status === 'fulfilled' ? infoRes.value.data : null;
            const sessions = sessionsRes.status === 'fulfilled' ? sessionsRes.value.data : [];
            const activeSessions = Array.isArray(sessions)
                ? sessions.filter(s => s.NowPlayingItem).length
                : 0;
            const totalSessions = Array.isArray(sessions) ? sessions.length : 0;

            return { online: !!info, info, activeSessions, totalSessions, error: null };
        } catch (error) {
            return { online: false, info: null, activeSessions: 0, totalSessions: 0, error: error.message };
        }
    }

    // ─── Embed Builder ────────────────────────────────────────────────────────

    async buildEmbed() {
        const { online, info, activeSessions, totalSessions, error } = await this.getServerInfo();
        const dockerState = await this.getDockerContainerState();
        const checkedAtUnix = Math.floor(Date.now() / 1000);

        const color = online ? '#00C851' : '#FF4444';
        const statusText = online ? '🟢 **Online**' : '🔴 **Offline**';

        const embed = new EmbedBuilder()
            .setTitle('🎬 Jellyfin Media Server')
            .setColor(color)
            .setDescription(`${online ? '🟢 Online' : '🔴 Offline'} • ⏱️ Updated <t:${checkedAtUnix}:R>`);

        if (online && info) {
            embed.addFields(
                { name: '▶️ Active Streams', value: `**${activeSessions}**`, inline: true },
                { name: '👥 Sessions', value: `**${totalSessions}**`, inline: true }
            );
        } else {
            if (error) {
                embed.addFields({ name: 'Last Error', value: `\`${error.slice(0, 512)}\``, inline: false });
            }
        }

        const canStart = !!dockerState && (dockerState === 'exited' || dockerState === 'dead' || dockerState === 'created');

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('jellyfin_start')
                .setLabel('Start')
                .setStyle(canStart ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji('🚀')
                .setDisabled(!canStart),
            new ButtonBuilder()
                .setCustomId('jellyfin_restart')
                .setLabel('Restart Jellyfin')
                .setStyle(online ? ButtonStyle.Danger : ButtonStyle.Secondary)
                .setEmoji('🔄')
                .setDisabled(!online && !this.isDockerControlConfigured())
        );

        return { embed, components: [buttons] };
    }

    // ─── Message Management ───────────────────────────────────────────────────

    async updateStatusMessage() {
        try {
            if (!this.statusMessage) return;
            const { embed, components } = await this.buildEmbed();
            await this.statusMessage.edit({ embeds: [embed], components });
        } catch (error) {
            console.error('[JELLYFIN MONITOR] Failed to update status message:', error);
            // If message was deleted, recreate it
            if (error.code === 10008) {
                console.log('[JELLYFIN MONITOR] Status message deleted — recreating...');
                this.statusMessage = null;
                await this.initialize();
            }
        }
    }

    // ─── Button Handler ───────────────────────────────────────────────────────

    setupButtonHandler() {
        if (this.buttonHandlerRegistered) {
            return;
        }

        this.buttonHandlerRegistered = true;
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isButton()) return;

            if (interaction.customId === 'jellyfin_start') {
                await interaction.deferReply({ ephemeral: true });

                try {
                    await this.startFromCrash();
                    const timestamp = await this.recordUserAction('start', interaction.user.id);
                    await this.sendActionAuditMessage(interaction.channel, 'start', interaction.user.id, timestamp)
                        .catch(err => console.warn('[JELLYFIN MONITOR] Failed to send action audit message:', err.message));
                    await interaction.editReply('✅ Start command sent to the Jellyfin Docker container. Checking status shortly...');
                    setTimeout(() => this.updateStatusMessage(), 8000);
                    setTimeout(() => this.updateStatusMessage(), 20000);
                } catch (error) {
                    await interaction.editReply(`❌ Failed to start Jellyfin container: \`${error.message}\``);
                }

            } else if (interaction.customId === 'jellyfin_restart') {
                await interaction.deferReply({ ephemeral: true });
                try {
                    const { online } = await this.getServerInfo();
                    if (online) {
                        await axios.post(
                            `${this.jellyfinUrl}/System/Restart`,
                            {},
                            { headers: this.headers, timeout: 10000 }
                        );
                    } else if (this.isDockerControlConfigured()) {
                        await this.restartFromDocker();
                    } else {
                        throw new Error('Jellyfin is offline and Unraid Docker control is not configured');
                    }

                    const timestamp = await this.recordUserAction('restart', interaction.user.id);
                    await this.sendActionAuditMessage(interaction.channel, 'restart', interaction.user.id, timestamp)
                        .catch(err => console.warn('[JELLYFIN MONITOR] Failed to send action audit message:', err.message));

                    await interaction.editReply(
                        '✅ Restart command sent to Jellyfin. ' +
                        'The server will go offline briefly and come back up.\n' +
                        '⏳ Status will auto-refresh in ~20 seconds.'
                    );
                    // Give Jellyfin time to go down and come back, then update
                    setTimeout(() => this.updateStatusMessage(), 20000);
                    setTimeout(() => this.updateStatusMessage(), 45000);
                } catch (error) {
                    await interaction.editReply(`❌ Failed to send restart command: \`${error.message}\``);
                }
            }
        });
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    startMonitoring() {
        // Immediate first check
        this.updateStatusMessage();

        // Periodic auto-refresh
        this.updateInterval = setInterval(() => {
            this.updateStatusMessage();
        }, this.intervalMs);

        console.log(`[JELLYFIN MONITOR] Auto-refresh every ${this.intervalMs / 1000}s`);
    }

    async initialize() {
        if (!this.channelId || !this.apiKey) {
            console.log('[JELLYFIN MONITOR] Skipping — jellyfinStatusChannelId or jellyfinApiKey not set in config.json');
            return;
        }

        try {
            await this.actionHistoryStore.initialize();
            const channel = await this.client.channels.fetch(this.channelId);
            if (!channel) {
                console.error('[JELLYFIN MONITOR] Channel not found:', this.channelId);
                return;
            }

            // Find all bot-owned Jellyfin embeds, keep newest, delete duplicates
            const messages = await channel.messages.fetch({ limit: 50 });
            const allOwn = messages.filter(msg =>
                msg.author.id === this.client.user.id &&
                msg.embeds.length > 0 &&
                (msg.embeds[0].title || '').includes('Jellyfin')
            ).sort((a, b) => b.createdTimestamp - a.createdTimestamp);

            const [keep, ...stale] = allOwn.values();

            // Delete any duplicates silently
            for (const dup of stale) {
                await dup.delete().catch(() => null);
            }

            if (keep) {
                this.statusMessage = keep;
                console.log('[JELLYFIN MONITOR] Reusing existing status message');
            } else {
                const { embed, components } = await this.buildEmbed();
                this.statusMessage = await channel.send({ embeds: [embed], components });
                console.log('[JELLYFIN MONITOR] Posted new status message');
            }

            this.setupButtonHandler();
            this.startMonitoring();
            console.log('[JELLYFIN MONITOR] Initialized successfully');

        } catch (error) {
            console.error('[JELLYFIN MONITOR] Failed to initialize:', error);
        }
    }

    async shutdown() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        console.log('[JELLYFIN MONITOR] Shut down');
    }
}

module.exports = JellyfinMonitor;
