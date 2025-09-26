const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting GameNight Bot with microservices...');

// Start weather service
console.log('📡 Starting Weather Service...');
const weatherService = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '../services/weather-service'),
    stdio: 'inherit'
});

// Wait a moment for weather service to start
setTimeout(() => {
    // Start main bot
    console.log('🤖 Starting Main Bot...');
    const mainBot = spawn('node', ['index.js'], {
        cwd: path.join(__dirname, '../main-bot'),
        stdio: 'inherit'
    });

    // Handle shutdown gracefully
    const shutdown = () => {
        console.log('🛑 Shutting down services...');
        weatherService.kill('SIGTERM');
        mainBot.kill('SIGTERM');
        process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Handle service exits
    weatherService.on('exit', (code) => {
        console.log(`Weather service exited with code ${code}`);
        if (code !== 0) {
            console.log('🔄 Restarting weather service...');
            // Could add restart logic here
        }
    });

    mainBot.on('exit', (code) => {
        console.log(`Main bot exited with code ${code}`);
        process.exit(code);
    });

}, 2000);
