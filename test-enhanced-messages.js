// Test script to manually trigger weather system scheduled messages with enhanced breakdowns
const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config.json');
const WeatherSystem = require('./src/features/weatherSystem');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

async function testEnhancedWeatherMessages() {
    console.log('🔧 Testing Enhanced Weather System Messages with Point Breakdowns...\n');
    
    try {
        await client.login(config.token);
        console.log('✅ Bot connected successfully');
        
        // Initialize weather system
        const weatherSystem = new WeatherSystem(client, config);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for initialization
        
        const channel = client.channels.cache.get(config.weatherChannelId);
        if (!channel) {
            console.error('❌ Weather channel not found!');
            return;
        }
        
        console.log(`📍 Found weather channel: #${channel.name}\n`);
        
        // Test the enhanced shitty weather championship message
        console.log('🔄 Testing: Enhanced Shitty Weather Championship (with detailed breakdowns)');
        try {
            const shittyWeatherResult = await weatherSystem.awardShittyWeatherPoints();
            
            if (shittyWeatherResult && shittyWeatherResult.award) {
                const award = shittyWeatherResult.award;
                const scoreEmojis = ['💩', '🌧️', '❄️', '🌪️', '⛈️'];
                const emoji = scoreEmojis[Math.min(Math.floor(award.score / 2), scoreEmojis.length - 1)] || '💩';
                
                let message = `${emoji} **SHITTY WEATHER CHAMPION** ${emoji}\n\n`;
                message += `🏆 **${award.displayName}** from **${award.region}** wins this round!\n`;
                message += `**Weather Score:** ${award.score} points\n`;
                message += `**Conditions:** ${Math.round(award.weather.temp)}°F (${Math.round((award.weather.temp - 32) * 5/9)}°C), ${award.weather.description}\n`;
                if (award.weather.wind > 0) message += `**Wind:** ${award.weather.wind} mph\n`;
                message += `**Humidity:** ${award.weather.humidity}%\n\n`;
                
                // Add detailed breakdown
                if (award.breakdown && award.breakdown.length > 0) {
                    message += `📊 **Point Breakdown:**\n`;
                    message += award.breakdown.join('\n') + '\n\n';
                }
                
                message += `🎖️ **Total Shitty Weather Points:** ${award.totalPoints}\n\n`;
                message += `*The worse your weather, the more points you get!*\n`;
                message += `*Want to join the competition? Use \`/weather join <postal_code>\`!* 💩`;

                await channel.send(message);
                console.log('✅ Enhanced Shitty Weather Championship message sent with detailed breakdown!');
                
                // Log the breakdown to console for reference
                if (award.breakdown && award.breakdown.length > 0) {
                    console.log(`📊 Point breakdown for ${award.displayName}:`);
                    award.breakdown.forEach(item => console.log(`   ${item}`));
                }
            } else {
                console.log('ℹ️  No shitty weather award this round');
            }
        } catch (error) {
            console.error('❌ Error in enhanced championship message test:', error.message);
        }
        
        console.log('\n🎉 Enhanced weather message test completed!');
        console.log('Check your Discord weather channel to see the detailed point breakdown!');
        
    } catch (error) {
        console.error('❌ Error during testing:', error);
    } finally {
        console.log('\n🔌 Disconnecting...');
        client.destroy();
        process.exit(0);
    }
}

testEnhancedWeatherMessages();
