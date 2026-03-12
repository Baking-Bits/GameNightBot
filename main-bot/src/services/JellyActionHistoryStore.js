const fs = require('fs');
const path = require('path');

class JellyActionHistoryStore {
    constructor(serviceName, fileName) {
        this.serviceName = serviceName;
        this.filePath = path.join(__dirname, '../../data', fileName);
        this.history = [];
    }

    async initialize() {
        await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
        await this.load();
    }

    async load() {
        try {
            const raw = await fs.promises.readFile(this.filePath, 'utf8');
            const parsed = JSON.parse(raw);
            this.history = Array.isArray(parsed?.history) ? parsed.history : [];
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`[${this.serviceName.toUpperCase()} HISTORY] Failed to load history:`, error);
            }
            this.history = [];
        }
    }

    async save() {
        const payload = {
            service: this.serviceName,
            updatedAt: new Date().toISOString(),
            history: this.history
        };

        await fs.promises.writeFile(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
    }

    pruneOlderThanDays(days = 30) {
        const threshold = Date.now() - (days * 24 * 60 * 60 * 1000);
        this.history = this.history.filter(item => {
            const createdAt = Number(item?.timestamp || 0) * 1000;
            return createdAt >= threshold;
        });
    }

    async recordAction({ action, userId, source = 'button' }) {
        const timestamp = Math.floor(Date.now() / 1000);

        this.history.push({
            service: this.serviceName,
            action,
            userId,
            source,
            timestamp
        });

        this.pruneOlderThanDays(30);
        await this.save();

        return timestamp;
    }

    getHistory({ days = 30, limit = 200 } = {}) {
        const threshold = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);

        return this.history
            .filter(item => Number(item?.timestamp || 0) >= threshold)
            .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
            .slice(0, limit);
    }
}

module.exports = JellyActionHistoryStore;