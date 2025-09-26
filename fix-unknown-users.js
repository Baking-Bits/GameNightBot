const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const config = require('./config.json');

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

async function fixUnknownUsers() {
    try {
        console.log('🔍 Loading weather data...');
        const weatherDataPath = path.join(__dirname, 'services/data/weatherData.json');
        const weatherData = JSON.parse(await fs.readFile(weatherDataPath, 'utf8'));
        
        let fixedCount = 0;
        
        for (const [userId, userData] of Object.entries(weatherData.users)) {
            if (userData.displayName === 'Unknown User') {
                console.log(`🔧 Fixing display name for user ${userId}...`);
                
                try {
                    // Try to fetch the user from Discord
                    const discordUser = await client.users.fetch(userId);
                    if (discordUser) {
                        const newDisplayName = discordUser.displayName || discordUser.username;
                        console.log(`✅ Updated "${userData.displayName}" → "${newDisplayName}"`);
                        userData.displayName = newDisplayName;
                        userData.displayNameFixedAt = new Date().toISOString();
                        fixedCount++;
                    }
                } catch (error) {
                    // If we can't fetch the user, use a fallback
                    const fallbackName = `User-${userId.slice(-4)}`;
                    console.log(`⚠️ Could not fetch Discord user ${userId}, using fallback: ${fallbackName}`);
                    userData.displayName = fallbackName;
                    userData.displayNameFixedAt = new Date().toISOString();
                    fixedCount++;
                }
            }
        }
        
        if (fixedCount > 0) {
            weatherData.lastUpdated = new Date().toISOString();
            await fs.writeFile(weatherDataPath, JSON.stringify(weatherData, null, 2));
            console.log(`✅ Fixed ${fixedCount} unknown user display names!`);
        } else {
            console.log('ℹ️ No unknown users found to fix.');
        }
        
    } catch (error) {
        console.error('❌ Error fixing unknown users:', error);
    }
    
    process.exit(0);
}

// Login and run the fix
client.once('ready', () => {
    console.log(`🤖 Bot logged in as ${client.user.tag}`);
    fixUnknownUsers();
});

client.login(config.token);
