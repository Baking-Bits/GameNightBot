const { initializeDatabase } = require('./src/database/connection');

async function initializeDbOnly() {
    try {
        console.log('[DB INIT] Starting database initialization...');
        await initializeDatabase();
        console.log('[DB INIT] Database initialization completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('[DB INIT] Database initialization failed:', error);
        process.exit(1);
    }
}

initializeDbOnly();