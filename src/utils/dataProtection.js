// Data Protection Utilities - Prevents accidental data loss
const fs = require('fs').promises;
const path = require('path');

class DataProtection {
    constructor(dataDir = './data') {
        this.dataDir = dataDir;
        this.backupDir = path.join(dataDir, 'backups');
        this.protectedFiles = [
            'weatherData.json',
            'mealHistory.json',
            'workoutHistory.json',
            'snackHistory.json'
        ];
    }

    async initialize() {
        try {
            // Ensure backups directory exists
            await fs.mkdir(this.backupDir, { recursive: true });
            console.log('[DATA PROTECTION] Backup system initialized');
        } catch (error) {
            console.error('[DATA PROTECTION] Failed to initialize:', error);
        }
    }

    /**
     * Create timestamped backup of a data file
     */
    async createBackup(filename, reason = 'auto') {
        try {
            const sourceFile = path.join(this.dataDir, filename);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(this.backupDir, `${filename.replace('.json', '')}_${timestamp}_${reason}.json`);

            // Check if source file exists
            try {
                await fs.access(sourceFile);
            } catch {
                console.log(`[DATA PROTECTION] Source file ${filename} doesn't exist, skipping backup`);
                return null;
            }

            // Read and validate source data
            const data = await fs.readFile(sourceFile, 'utf8');
            const parsedData = JSON.parse(data); // Validate JSON

            // Only backup if file has real data
            if (this.hasRealUserData(parsedData, filename)) {
                await fs.writeFile(backupFile, data);
                console.log(`[DATA PROTECTION] Created backup: ${backupFile}`);
                
                // Clean old backups (keep last 10 for each file)
                await this.cleanOldBackups(filename);
                
                return backupFile;
            } else {
                console.log(`[DATA PROTECTION] Skipping backup of ${filename} - no real user data detected`);
                return null;
            }
        } catch (error) {
            console.error(`[DATA PROTECTION] Failed to backup ${filename}:`, error);
            return null;
        }
    }

    /**
     * Check if data contains real user information (not just test data)
     */
    hasRealUserData(data, filename) {
        if (filename === 'weatherData.json') {
            const users = data.users || {};
            const userIds = Object.keys(users);
            
            // Check for real users (not test users)
            const realUsers = userIds.filter(id => 
                !id.includes('test') && 
                !id.includes('debug') && 
                !id.includes('mock') &&
                !users[id].displayName?.toLowerCase().includes('test') &&
                !users[id].displayName?.toLowerCase().includes('debug')
            );

            const hasScores = Object.keys(data.shittyWeatherScores || {}).length > 0;
            const hasHistory = (data.shittyWeatherHistory || []).length > 0;

            return realUsers.length > 0 || hasScores || hasHistory;
        }

        // For meal/workout data, check if there are actual entries
        if (filename.includes('History.json')) {
            return (data.meals || data.workouts || data.snacks || []).length > 0;
        }

        return Object.keys(data).length > 0;
    }

    /**
     * Clean old backups, keeping only the most recent ones
     */
    async cleanOldBackups(filename, keepCount = 10) {
        try {
            const files = await fs.readdir(this.backupDir);
            const prefix = filename.replace('.json', '');
            const backupFiles = files
                .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
                .map(f => ({
                    name: f,
                    path: path.join(this.backupDir, f),
                    stat: null
                }));

            // Get file stats for sorting by creation time
            for (const file of backupFiles) {
                try {
                    file.stat = await fs.stat(file.path);
                } catch (error) {
                    console.warn(`[DATA PROTECTION] Could not stat ${file.name}:`, error);
                }
            }

            // Sort by creation time (newest first) and remove old ones
            const sortedFiles = backupFiles
                .filter(f => f.stat)
                .sort((a, b) => b.stat.mtime - a.stat.mtime);

            if (sortedFiles.length > keepCount) {
                const filesToDelete = sortedFiles.slice(keepCount);
                for (const file of filesToDelete) {
                    await fs.unlink(file.path);
                    console.log(`[DATA PROTECTION] Removed old backup: ${file.name}`);
                }
            }

        } catch (error) {
            console.error(`[DATA PROTECTION] Failed to clean old backups for ${filename}:`, error);
        }
    }

    /**
     * Backup all protected files
     */
    async backupAll(reason = 'manual') {
        console.log(`[DATA PROTECTION] Creating backups (reason: ${reason})`);
        const results = {};

        for (const filename of this.protectedFiles) {
            results[filename] = await this.createBackup(filename, reason);
        }

        return results;
    }

    /**
     * Restore from backup
     */
    async restoreFromBackup(filename, backupTimestamp) {
        try {
            const backupPattern = `${filename.replace('.json', '')}_${backupTimestamp}`;
            const files = await fs.readdir(this.backupDir);
            const backupFile = files.find(f => f.includes(backupPattern));

            if (!backupFile) {
                throw new Error(`Backup file matching ${backupPattern} not found`);
            }

            const backupPath = path.join(this.backupDir, backupFile);
            const targetPath = path.join(this.dataDir, filename);

            // Create backup of current file before restoring
            await this.createBackup(filename, 'pre-restore');

            // Restore from backup
            const backupData = await fs.readFile(backupPath, 'utf8');
            await fs.writeFile(targetPath, backupData);

            console.log(`[DATA PROTECTION] Restored ${filename} from ${backupFile}`);
            return true;

        } catch (error) {
            console.error(`[DATA PROTECTION] Failed to restore ${filename}:`, error);
            return false;
        }
    }

    /**
     * List available backups for a file
     */
    async listBackups(filename) {
        try {
            const files = await fs.readdir(this.backupDir);
            const prefix = filename.replace('.json', '');
            const backupFiles = files
                .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
                .map(f => {
                    const match = f.match(/_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)_(.+)\.json$/);
                    return {
                        filename: f,
                        timestamp: match ? match[1] : 'unknown',
                        reason: match ? match[2] : 'unknown',
                        path: path.join(this.backupDir, f)
                    };
                })
                .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

            return backupFiles;
        } catch (error) {
            console.error(`[DATA PROTECTION] Failed to list backups for ${filename}:`, error);
            return [];
        }
    }

    /**
     * Safe write operation with automatic backup
     */
    async safeWrite(filename, data, reason = 'update') {
        try {
            // Create backup before writing
            await this.createBackup(filename, `pre-${reason}`);

            // Write new data
            const filePath = path.join(this.dataDir, filename);
            const jsonData = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
            await fs.writeFile(filePath, jsonData);

            console.log(`[DATA PROTECTION] Safely wrote ${filename} (reason: ${reason})`);
            return true;

        } catch (error) {
            console.error(`[DATA PROTECTION] Failed to safely write ${filename}:`, error);
            return false;
        }
    }
}

module.exports = DataProtection;
