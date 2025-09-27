const VoiceTimeTracker = require('./src/bot');
const { token, statusUpdateInterval } = require('../config.json');

const bot = new VoiceTimeTracker();
if (statusUpdateInterval) {
    bot.statusUpdateInterval = statusUpdateInterval;
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
    console.log('\n[MAIN] Received SIGINT, shutting down gracefully...');
    await bot.shutdown();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n[MAIN] Received SIGTERM, shutting down gracefully...');
    await bot.shutdown();
    process.exit(0);
});

bot.login(token);
