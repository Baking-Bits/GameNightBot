const fs = require('fs').promises;
const path = require('path');

async function cleanupBackupSystem() {
    console.log('[CLEANUP] Starting backup system cleanup...');
    
    try {
        const dataDir = path.join(__dirname, '..', 'services', 'data');
        const backupsDir = path.join(dataDir, 'backups');
        
        // List backup files
        try {
            const backupFiles = await fs.readdir(backupsDir);
            console.log(`[CLEANUP] Found ${backupFiles.length} backup files to remove:`);
            
            for (const file of backupFiles) {
                console.log(`  - ${file}`);
            }
            
            // Remove backup directory
            await fs.rmdir(backupsDir, { recursive: true });
            console.log('[CLEANUP] ✅ Removed backups directory');
        } catch (error) {
            console.log('[CLEANUP] No backups directory found or already cleaned');
        }
        
        // List remaining data files
        const dataFiles = await fs.readdir(dataDir);
        console.log(`\n[CLEANUP] Remaining data files:`);
        
        for (const file of dataFiles) {
            console.log(`  - ${file}`);
        }
        
        console.log('\n[CLEANUP] Backup system cleanup completed!');
        console.log('[CLEANUP] Note: You can now safely remove the following files if desired:');
        console.log('  - services/data/weatherData.json (now using database)');
        console.log('  - services/data/weatherData.json.pre-migration-backup');
        console.log('  - Any remaining .template files');
        
    } catch (error) {
        console.error('[CLEANUP] Error during cleanup:', error);
    }
}

// Run cleanup if this file is executed directly
if (require.main === module) {
    cleanupBackupSystem()
        .then(() => {
            console.log('[CLEANUP] Cleanup completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('[CLEANUP] Cleanup failed:', error);
            process.exit(1);
        });
}

module.exports = { cleanupBackupSystem };
