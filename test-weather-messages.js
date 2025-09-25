// Test script to manually trigger weather system sche                let message = `${emoji} **SHITTY WEATHER CHAMPION** ${emoji}\n\n`;
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
                message += `*Want to join the competition? Use \`/weather join <postal_code>\`!* 💩`;sages
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

async function testWeatherMessages() {
    console.log('🔧 Testing Weather System Scheduled Messages...\n');
    
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
        
        // Test 1: Every 4 hours message (Weather alerts & Shitty Weather Championship)
        console.log('🔄 Testing: Every 4 Hours Message (Weather Alerts & Championship)');
        try {
            const { weatherUpdates, alerts } = await weatherSystem.checkAllUsersWeather();
            
            if (alerts.length > 0) {
                const alertMessage = `🚨 **Weather Alerts** 🚨\n\n${alerts.map(a => a.alert).join('\n\n')}`;
                await channel.send(alertMessage);
                console.log('✅ Weather alerts sent');
            } else {
                console.log('ℹ️  No weather alerts to send');
            }

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
                message += `🎖️ **Total Shitty Weather Points:** ${award.totalPoints}\n\n`;
                message += `*The worse your weather, the more points you get!*\n`;
                message += `*Want to join the competition? Use \`/weather join <postal_code>\`!* 💩`;

                await channel.send(message);
                console.log('✅ Shitty Weather Championship message sent');
            } else {
                console.log('ℹ️  No shitty weather award this round');
            }
        } catch (error) {
            console.error('❌ Error in 4-hour message test:', error.message);
        }
        
        console.log('\n---\n');
        
        // Test 2: Daily 6 PM message (Daily leaderboard update)
        console.log('🔄 Testing: Daily 6 PM Message (Leaderboard Update)');
        try {
            const leaderboard = await weatherSystem.getShittyWeatherLeaderboard();
            if (leaderboard.length === 0) {
                console.log('ℹ️  No users in system for daily update');
            } else {
                const topUser = leaderboard[0];
                let message = `💩 **DAILY SHITTY WEATHER UPDATE** 💩\n\n`;
                message += `🏆 Current Shitty Weather Champion: **${topUser.displayName}** from **${topUser.region}**\n`;
                message += `🎖️ Total Points: **${topUser.points}**\n\n`;
                
                if (leaderboard.length > 1) {
                    message += `🥈 Top Contenders:\n`;
                    leaderboard.slice(1, 4).forEach((user, index) => {
                        message += `${index + 2}. ${user.displayName} (${user.points} pts)\n`;
                    });
                    message += '\n';
                }
                
                message += `⏰ *Next shitty weather points awarded in ${4 - (new Date().getHours() % 4)} hours!*\n`;
                message += `📊 *Use \`/weather shitty\` to see the full leaderboard!*\n`;
                message += `🎮 *New to the game? Join with \`/weather join <postal_code>\` and compete!*`;

                await channel.send(message);
                console.log('✅ Daily leaderboard update sent');
            }
        } catch (error) {
            console.error('❌ Error in daily message test:', error.message);
        }
        
        console.log('\n---\n');
        
        // Test 3: Weekly Sunday 8 PM message (Weekly celebration)
        console.log('🔄 Testing: Weekly Sunday 8 PM Message (Celebration)');
        try {
            const leaderboard = await weatherSystem.getWeatherLeaderboard();
            if (leaderboard.length === 0) {
                console.log('ℹ️  No users in system for weekly celebration');
            } else {
                const shittyLeaderboard = await weatherSystem.getShittyWeatherLeaderboard();
                
                let message = '🌤️ **WEEKLY WEATHER TRACKER CELEBRATION** 🌤️\n\n';
                message += '**Active Weather Trackers:**\n';
                
                leaderboard.forEach((user, index) => {
                    const emoji = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📍';
                    message += `${emoji} ${user.displayName} - ${user.location}\n`;
                });

                message += `\n📊 Total active trackers: **${leaderboard.length}**\n\n`;
                
                if (shittyLeaderboard.length > 0) {
                    message += `💩 **SHITTY WEATHER CHAMPIONS** 💩\n`;
                    shittyLeaderboard.slice(0, 3).forEach((user, index) => {
                        const emoji = index === 0 ? '👑💩' : index === 1 ? '🥈💧' : '🥉❄️';
                        message += `${emoji} <@${user.userId}> - ${user.points} shitty points!\n`;
                    });
                    message += '\n';
                }
                
                message += '*Want to join the fun?*\n';
                message += '🌤️ *Use `/weather join <postal_code>` to start tracking!*\n';
                message += '💩 *Compete in the Shitty Weather Championship!*';

                await channel.send(message);
                console.log('✅ Weekly celebration message sent');
            }
        } catch (error) {
            console.error('❌ Error in weekly message test:', error.message);
        }
        
        console.log('\n🎉 All weather message tests completed!');
        console.log('Check your Discord weather channel to see the results.');
        
    } catch (error) {
        console.error('❌ Error during testing:', error);
    } finally {
        console.log('\n🔌 Disconnecting...');
        client.destroy();
        process.exit(0);
    }
}

testWeatherMessages();
