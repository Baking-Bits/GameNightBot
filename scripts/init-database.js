const { initializeWeatherDatabase } = require('../main-bot/src/database/weather');

async function initializeTables() {
    try {
        console.log('[INIT] Initializing weather database tables...');
        
        await initializeWeatherDatabase();
        
        console.log('[INIT] Database tables initialized successfully!');
        
    } catch (error) {
        console.error('[INIT] Database initialization failed:', error);
        console.error(error.stack);
    }
    
    process.exit(0);
}

initializeTables();