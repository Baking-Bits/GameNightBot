const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Helper function to format temperature in both units
function formatTemperature(fahrenheit) {
    const celsius = ((fahrenheit - 32) * 5/9);
    return `${Math.round(fahrenheit)}°F (${Math.round(celsius)}°C)`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weather')
        .setDescription('Weather tracking system commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('join')
                .setDescription('Join the weather tracking system')
                .addStringOption(option =>
                    option.setName('zipcode')
                        .setDescription('Your postal/zip code (kept private) - US: 12345, UK: SW1A 1AA, etc.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('country')
                        .setDescription('Country (optional, helps with ambiguous codes like 4-digit codes)')
                        .setRequired(false)
                        .addChoices(
                            { name: 'United States', value: 'US' },
                            { name: 'United Kingdom', value: 'GB' },
                            { name: 'Canada', value: 'CA' },
                            { name: 'Australia', value: 'AU' },
                            { name: 'Denmark', value: 'DK' },
                            { name: 'Germany', value: 'DE' },
                            { name: 'France', value: 'FR' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('leave')
                .setDescription('Leave the weather tracking system'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('current')
                .setDescription('Get your current weather'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaderboard')
                .setDescription('View weather tracker leaderboard'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View weather system statistics (Admin only)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('shitty')
                .setDescription('View the Shitty Weather Championship leaderboard'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('award')
                .setDescription('Manually award shitty weather points (Admin only)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('trigger-update')
                .setDescription('Manually trigger daily weather update message (Admin only)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('trigger-celebration')
                .setDescription('Manually trigger weekly celebration message (Admin only)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('trigger-alerts')
                .setDescription('Manually trigger weather alert check (Admin only)')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const weatherSystem = interaction.client.weatherSystem;

        if (!weatherSystem) {
            return await interaction.reply({
                content: '❌ Weather system not initialized.',
                flags: 64 // MessageFlags.Ephemeral
            });
        }

        try {
            switch (subcommand) {
                case 'join':
                    await this.handleJoin(interaction, weatherSystem);
                    break;
                case 'leave':
                    await this.handleLeave(interaction, weatherSystem);
                    break;
                case 'current':
                    await this.handleCurrent(interaction, weatherSystem);
                    break;
                case 'leaderboard':
                    await this.handleLeaderboard(interaction, weatherSystem);
                    break;
                case 'stats':
                    await this.handleStats(interaction, weatherSystem);
                    break;
                case 'shitty':
                    await this.handleShittyLeaderboard(interaction, weatherSystem);
                    break;
                case 'award':
                    await this.handleManualAward(interaction, weatherSystem);
                    break;
                case 'trigger-update':
                    await this.handleTriggerUpdate(interaction, weatherSystem);
                    break;
                case 'trigger-celebration':
                    await this.handleTriggerCelebration(interaction, weatherSystem);
                    break;
                case 'trigger-alerts':
                    await this.handleTriggerAlerts(interaction, weatherSystem);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown weather command.',
                        flags: 64 // MessageFlags.Ephemeral
                    });
            }
        } catch (error) {
            console.error('Error in weather command:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred while processing your weather request.',
                    flags: 64 // MessageFlags.Ephemeral
                });
            }
        }
    },

    async handleJoin(interaction, weatherSystem) {
        const zipCode = interaction.options.getString('zipcode');
        const countryCode = interaction.options.getString('country');
        const userId = interaction.user.id;
        // Use Discord display name (nickname if set, otherwise username)
        const displayName = interaction.member?.displayName || interaction.user.displayName || interaction.user.username;

        // Validate postal code format (supports US zip codes and international formats)
        const isValidPostalCode = this.validatePostalCode(zipCode);
        if (!isValidPostalCode.valid) {
            return await interaction.reply({
                content: `❌ ${isValidPostalCode.message}`,
                flags: 64  // MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({ flags: 64 }); // MessageFlags.Ephemeral

        try {
            const result = await weatherSystem.setUserLocation(userId, zipCode, displayName, countryCode);
            
            // Validate result data before creating embed
            if (!result || !result.weather || !result.location) {
                throw new Error('Invalid weather data received');
            }

            const weather = result.weather;
            const location = result.location || 'Unknown Location';
            const temperature = weather.main?.temp ? formatTemperature(weather.main.temp) : 'N/A';
            const conditions = weather.weather?.[0]?.description || 'Unknown';
            const windSpeed = weather.wind?.speed ? Math.round(weather.wind.speed) : 0;
            const humidity = weather.main?.humidity || 0;
            
            const embed = new EmbedBuilder()
                .setColor(0x00AE86)
                .setTitle('🌤️ Weather Tracking Joined!')
                .setDescription(`Welcome to the weather tracking system, **${displayName}**!`)
                .addFields(
                    { name: '📍 Location', value: location, inline: true },
                    { name: '🌡️ Current Temperature', value: temperature, inline: true },
                    { name: '☁️ Conditions', value: conditions, inline: true },
                    { name: '💨 Wind', value: `${windSpeed} mph`, inline: true },
                    { name: '💧 Humidity', value: `${humidity}%`, inline: true },
                    { name: '👤 Discord Name', value: displayName, inline: true }
                )
                .addFields({
                    name: '🔒 Privacy Note',
                    value: 'Your zip code is stored privately and never shared. Only your city/region and Discord name are visible to others.',
                    inline: false
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in handleJoin:', error);
            await interaction.editReply({
                content: `❌ Failed to join weather tracking: ${error.message}`
            });
        }
    },

    async handleLeave(interaction, weatherSystem) {
        const userId = interaction.user.id;
        
        const success = await weatherSystem.removeUserLocation(userId);
        
        if (success) {
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle('👋 Left Weather Tracking')
                .setDescription('You have been removed from the weather tracking system.')
                .addFields({
                    name: '📝 Note',
                    value: 'Your data has been deactivated. You can rejoin anytime with `/weather join`',
                    inline: false
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: 64 }); // MessageFlags.Ephemeral
        } else {
            await interaction.reply({
                content: '❌ You are not currently in the weather tracking system.',
                flags: 64 // MessageFlags.Ephemeral
            });
        }
    },

    async handleCurrent(interaction, weatherSystem) {
        const userId = interaction.user.id;
        
        await interaction.deferReply();

        try {
            const result = await weatherSystem.getCurrentWeather(userId);
            
            if (!result) {
                return await interaction.editReply({
                    content: '❌ You are not in the weather tracking system. Use `/weather join` to get started!'
                });
            }

            const weather = result.weather;
            const temp = Math.round(weather.main.temp);
            const feelsLike = Math.round(weather.main.feels_like);
            const conditions = weather.weather[0];
            
            // Weather condition emoji mapping
            const weatherEmojis = {
                'clear sky': '☀️',
                'few clouds': '🌤️',
                'scattered clouds': '⛅',
                'broken clouds': '☁️',
                'overcast clouds': '☁️',
                'shower rain': '🌦️',
                'rain': '🌧️',
                'thunderstorm': '⛈️',
                'snow': '🌨️',
                'mist': '🌫️',
                'fog': '🌫️'
            };

            const weatherEmoji = weatherEmojis[conditions.description] || '🌤️';
            
            const embed = new EmbedBuilder()
                .setColor(this.getWeatherColor(temp))
                .setTitle(`${weatherEmoji} Current Weather`)
                .setDescription(`Weather for **${result.displayName}** in ${result.location}`)
                .addFields(
                    { name: '🌡️ Temperature', value: formatTemperature(temp), inline: true },
                    { name: '🤚 Feels Like', value: formatTemperature(feelsLike), inline: true },
                    { name: '☁️ Conditions', value: conditions.description, inline: true },
                    { name: '💨 Wind Speed', value: `${Math.round(weather.wind?.speed || 0)} mph`, inline: true },
                    { name: '💧 Humidity', value: `${weather.main.humidity}%`, inline: true },
                    { name: '🔍 Visibility', value: `${Math.round((weather.visibility || 10000) / 1609.34)} mi`, inline: true }
                )
                .setFooter({ text: 'Weather updates every 4 hours' })
                .setTimestamp();

            // Add weather alerts if conditions are severe
            const alert = weatherSystem.checkSevereWeather(weather, { city: result.location });
            if (alert) {
                embed.addFields({
                    name: '⚠️ Weather Alert',
                    value: alert,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Failed to get weather data: ${error.message}`
            });
        }
    },

    async handleLeaderboard(interaction, weatherSystem) {
        await interaction.deferReply();

        try {
            const leaderboard = await weatherSystem.getWeatherLeaderboard();
            
            if (leaderboard.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0x95A5A6)
                    .setTitle('🌤️ Weather Tracker Leaderboard')
                    .setDescription('No active weather trackers yet!\n\nUse `/weather join` to be the first!')
                    .setTimestamp();

                return await interaction.editReply({ embeds: [embed] });
            }

            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('🌤️ Weather Tracker Leaderboard')
                .setDescription('Active weather trackers in our community')
                .setTimestamp();

            let description = '';
            leaderboard.forEach((user, index) => {
                const emoji = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📍';
                const joinDate = new Date(user.joinedAt).toLocaleDateString();
                description += `${emoji} **${user.displayName}** - ${user.location}\n*Joined: ${joinDate}*\n\n`;
            });

            embed.setDescription(description);
            embed.addFields(
                {
                    name: '📊 Statistics',
                    value: `Total active trackers: **${leaderboard.length}**`,
                    inline: false
                },
                {
                    name: '💩 Want More Fun?',
                    value: 'Check out `/weather shitty` for the Shitty Weather Championship!\n*Compete for who has the worst weather!*\n*Works worldwide - US, UK, Canada, Australia, etc.*',
                    inline: false
                }
            );

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Failed to get leaderboard: ${error.message}`
            });
        }
    },

    async handleStats(interaction, weatherSystem) {
        // Check if user has admin permissions
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return await interaction.reply({
                content: '❌ This command requires administrator permissions.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const stats = await weatherSystem.getSystemStats();
            
            if (!stats) {
                return await interaction.editReply({
                    content: '❌ Failed to retrieve system statistics.'
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle('📊 Weather System Statistics')
                .addFields(
                    { name: '👥 Active Users', value: stats.activeUsers.toString(), inline: true },
                    { name: '📈 Total Users', value: stats.totalUsers.toString(), inline: true },
                    { name: '🔥 API Calls Today', value: `${stats.apiCallsToday}/${stats.dailyLimit}`, inline: true },
                    { name: '🔄 Last Updated', value: new Date(stats.lastUpdated).toLocaleString(), inline: false }
                )
                .setTimestamp();

            // Add recent weather check history
            if (stats.weatherHistory.length > 0) {
                const historyText = stats.weatherHistory
                    .slice(-5)
                    .map(h => `${new Date(h.timestamp).toLocaleString()}: ${h.updates} updates, ${h.alerts} alerts`)
                    .join('\n');
                
                embed.addFields({
                    name: '📋 Recent Weather Checks',
                    value: historyText || 'No recent checks',
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Failed to get system stats: ${error.message}`
            });
        }
    },

    getWeatherColor(temp) {
        if (temp <= 32) return 0x3498DB; // Blue for freezing
        if (temp <= 50) return 0x85C1E9; // Light blue for cold
        if (temp <= 70) return 0x58D68D; // Green for mild
        if (temp <= 85) return 0xF7DC6F; // Yellow for warm
        if (temp <= 95) return 0xF39C12; // Orange for hot
        return 0xE74C3C; // Red for very hot
    },

    validatePostalCode(code) {
        // Remove spaces and convert to uppercase for validation
        const cleanCode = code.replace(/\s+/g, '').toUpperCase();
        
        // US ZIP codes (5 digits or 5+4 format)
        if (/^\d{5}(-?\d{4})?$/.test(cleanCode)) {
            return { valid: true, country: 'US', format: 'zip' };
        }
        
        // UK postcodes - comprehensive pattern for all valid formats
        // Formats: M1 1AA, M60 1NW, CR0 2YR, DN55 1PT, W1A 0AX, EC1A 1BB, SW1A 1AA
        const ukPostcodeRegex = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}$/i;
        if (ukPostcodeRegex.test(code)) {
            return { valid: true, country: 'GB', format: 'postcode' };
        }
        
        // Canadian postal codes (A1A1A1 or A1A 1A1)
        if (/^[A-Z]\d[A-Z]\s*\d[A-Z]\d$/.test(cleanCode)) {
            return { valid: true, country: 'CA', format: 'postal' };
        }
        
        // Australian postcodes (4 digits)
        if (/^\d{4}$/.test(cleanCode)) {
            return { valid: true, country: 'AU', format: 'postcode' };
        }
        
        // German postal codes (5 digits)
        if (/^\d{5}$/.test(cleanCode)) {
            return { valid: true, country: 'DE', format: 'postcode' };
        }
        
        // French postal codes (5 digits)
        if (/^\d{5}$/.test(cleanCode)) {
            return { valid: true, country: 'FR', format: 'postcode' };
        }
        
        // For other formats, be more lenient - accept if it's 3-10 characters with letters/numbers
        if (/^[A-Z0-9\s-]{3,10}$/i.test(code)) {
            return { valid: true, country: 'UNKNOWN', format: 'generic' };
        }
        
        return { 
            valid: false, 
            message: 'Please provide a valid postal/zip code.\n\nExamples:\n• US: 12345 or 12345-6789\n• UK: SW1A 1AA or M1 1AA\n• Canada: A1A 1A1\n• Australia: 2000\n• Germany: 10115' 
        };
    },

    async handleShittyLeaderboard(interaction, weatherSystem) {
        await interaction.deferReply();

        try {
            const leaderboard = await weatherSystem.getShittyWeatherLeaderboard();
            
            if (leaderboard.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0x95A5A6)
                    .setTitle('💩 Shitty Weather Championship')
                    .setDescription('**No champions yet - be the first!**\n\n🎮 **Ready to compete?**\nUse `/weather join <postal_code>` to join the fun!\n\n🏆 **How it works:**\n• Points awarded every 4 hours\n• Worst weather wins points\n• Your postal code stays private\n• Only general region is shown\n• Works worldwide (US, UK, Canada, etc.)\n\n*The shittier your weather, the more points you get!*')
                    .setTimestamp();

                return await interaction.editReply({ embeds: [embed] });
            }

            const embed = new EmbedBuilder()
                .setColor(0x8B4513) // Brown color for shitty weather
                .setTitle('💩 Shitty Weather Championship 🏆')
                .setDescription('**Hall of Shitty Weather Champions**\n*Who can endure the worst conditions?*')
                .setTimestamp();

            let description = '';
            leaderboard.slice(0, 10).forEach((user, index) => {
                const emoji = index === 0 ? '👑💩' : index === 1 ? '🥈💧' : index === 2 ? '🥉❄️' : '💩';
                const status = user.isActive ? '' : ' *(inactive)*';
                description += `${emoji} **${user.displayName}** - ${user.region}${status}\n`;
                description += `   🎖️ **${user.points}** shitty weather points\n\n`;
            });

            embed.setDescription(`**Hall of Shitty Weather Champions**\n*Who can endure the worst conditions?*\n\n${description}`);
            
            // Add recent winner breakdown if available
            const recentAward = await weatherSystem.getLastShittyWeatherAward();
            if (recentAward && recentAward.breakdown && recentAward.breakdown.length > 0) {
                const timeSince = new Date() - new Date(recentAward.timestamp);
                const hoursAgo = Math.floor(timeSince / (1000 * 60 * 60));
                const timeDisplay = hoursAgo < 1 ? 'Just now' : hoursAgo === 1 ? '1 hour ago' : `${hoursAgo} hours ago`;
                
                embed.addFields({
                    name: `🏆 Recent Winner: ${recentAward.displayName} (${timeDisplay})`,
                    value: `${recentAward.score} points from: ${recentAward.breakdown.slice(0, 3).join(', ')}${recentAward.breakdown.length > 3 ? '...' : ''}`,
                    inline: false
                });
            }

            embed.addFields(
                {
                    name: '📊 How It Works',
                    value: 'Points awarded every 4 hours for:\n• Extreme temperatures (hot/cold)\n• Storms, rain, snow\n• High winds & poor visibility\n• Miserable combinations',
                    inline: false
                },
                {
                    name: '🎮 Join the Competition!',
                    value: '*Use `/weather join <postal_code>` to start competing!*\n*The worse your weather, the more points you get!*\n*Your postal code stays private - only general region shown.*',
                    inline: false
                }
            );

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Failed to get shitty weather leaderboard: ${error.message}`
            });
        }
    },

    async handleManualAward(interaction, weatherSystem) {
        // Check if user has admin permissions
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return await interaction.reply({
                content: '❌ This command requires administrator permissions.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            const result = await weatherSystem.awardShittyWeatherPoints();
            
            if (!result || !result.award) {
                return await interaction.editReply({
                    content: '❌ No users with shitty weather found, or no one has bad enough weather to award points.'
                });
            }

            const award = result.award;
            const scoreEmojis = ['💩', '🌧️', '❄️', '🌪️', '⛈️'];
            const emoji = scoreEmojis[Math.min(Math.floor(award.score / 2), scoreEmojis.length - 1)] || '💩';
            
            let description = `🏆 **${award.displayName}** from **${award.region}** wins!\n\n**Weather Score:** ${award.score} points\n**Conditions:** ${formatTemperature(award.weather.temp)}, ${award.weather.description}\n`;
            
            // Add point breakdown if available
            if (award.breakdown && award.breakdown.length > 0) {
                description += `\n📊 **How they earned ${award.score} points:**\n${award.breakdown.join('\n')}\n`;
            }
            
            description += `\n*Join the competition with \`/weather join <zipcode>\`!*`;

            const embed = new EmbedBuilder()
                .setColor(0x8B4513)
                .setTitle(`${emoji} Manual Shitty Weather Award ${emoji}`)
                .setDescription(description)
                .addFields(
                    { name: '💨 Wind', value: `${award.weather.wind} mph`, inline: true },
                    { name: '💧 Humidity', value: `${award.weather.humidity}%`, inline: true },
                    { name: '🎖️ Total Points', value: award.totalPoints.toString(), inline: true }
                )
                .setTimestamp();

            // Show top 3 worst weather for context
            if (result.allScores.length > 1) {
                let allScoresText = '';
                result.allScores.slice(0, 3).forEach((user, index) => {
                    const position = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
                    allScoresText += `${position} ${user.userData.displayName}: ${user.score} pts (${user.weather.weather[0].description})\n`;
                });
                
                embed.addFields({
                    name: '📊 This Round\'s Scores',
                    value: allScoresText,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Failed to award shitty weather points: ${error.message}`
            });
        }
    },

    async handleTriggerUpdate(interaction, weatherSystem) {
        // Check if user is admin
        if (!interaction.member.permissions.has('Administrator')) {
            return await interaction.reply({
                content: '❌ This command requires Administrator permissions.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            const channel = interaction.client.channels.cache.get(weatherSystem.channelId);
            if (!channel) {
                return await interaction.editReply({
                    content: '❌ Weather channel not found!'
                });
            }

            // Trigger the daily weather update (6 PM message)
            const leaderboard = await weatherSystem.getShittyWeatherLeaderboard();
            if (leaderboard.length === 0) {
                return await interaction.editReply({
                    content: '❌ No users in the weather system to create daily update.'
                });
            }

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
            
            await interaction.editReply({
                content: '✅ Daily weather update message has been sent to the weather channel!'
            });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Failed to send daily weather update: ${error.message}`
            });
        }
    },

    async handleTriggerCelebration(interaction, weatherSystem) {
        // Check if user is admin
        if (!interaction.member.permissions.has('Administrator')) {
            return await interaction.reply({
                content: '❌ This command requires Administrator permissions.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            const channel = interaction.client.channels.cache.get(weatherSystem.channelId);
            if (!channel) {
                return await interaction.editReply({
                    content: '❌ Weather channel not found!'
                });
            }

            // Trigger the weekly celebration (Sunday 8 PM message)
            const leaderboard = await weatherSystem.getWeatherLeaderboard();
            if (leaderboard.length === 0) {
                return await interaction.editReply({
                    content: '❌ No users in the weather system to create celebration.'
                });
            }

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
            
            await interaction.editReply({
                content: '✅ Weekly celebration message has been sent to the weather channel!'
            });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Failed to send weekly celebration: ${error.message}`
            });
        }
    },

    async handleTriggerAlerts(interaction, weatherSystem) {
        // Check if user is admin
        if (!interaction.member.permissions.has('Administrator')) {
            return await interaction.reply({
                content: '❌ This command requires Administrator permissions.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            const channel = interaction.client.channels.cache.get(weatherSystem.channelId);
            if (!channel) {
                return await interaction.editReply({
                    content: '❌ Weather channel not found!'
                });
            }

            // Trigger weather alerts and shitty weather awards (every 4 hours message)
            const { weatherUpdates, alerts } = await weatherSystem.checkAllUsersWeather();
            
            if (alerts.length > 0) {
                const alertMessage = `🚨 **Weather Alerts** 🚨\n\n${alerts.map(a => a.alert).join('\n\n')}`;
                await channel.send(alertMessage);
            }

            const shittyWeatherResult = await weatherSystem.awardShittyWeatherPoints();
            
            if (shittyWeatherResult && shittyWeatherResult.award) {
                const award = shittyWeatherResult.award;
                const scoreEmojis = ['💩', '🌧️', '❄️', '🌪️', '⛈️'];
                const emoji = scoreEmojis[Math.min(Math.floor(award.score / 2), scoreEmojis.length - 1)] || '💩';
                
                let message = `${emoji} **SHITTY WEATHER CHAMPION** ${emoji}\n\n`;
                message += `🏆 **${award.displayName}** from **${award.region}** wins this round!\n`;
                message += `**Weather Score:** ${award.score} points\n`;
                message += `**Conditions:** ${formatTemperature(award.weather.temp)}, ${award.weather.description}\n`;
                if (award.weather.wind > 0) message += `**Wind:** ${award.weather.wind} mph\n`;
                message += `**Humidity:** ${award.weather.humidity}%\n\n`;
                message += `🎖️ **Total Shitty Weather Points:** ${award.totalPoints}\n\n`;
                message += `*The worse your weather, the more points you get!*\n`;
                message += `*Want to join the competition? Use \`/weather join <postal_code>\`!* 💩`;

                await channel.send(message);
            }
            
            let resultMessage = `✅ Weather alerts and shitty weather award process completed!\n\n`;
            resultMessage += `📊 **Results:**\n`;
            resultMessage += `• Weather updates checked: ${weatherUpdates.length}\n`;
            resultMessage += `• Weather alerts sent: ${alerts.length}\n`;
            resultMessage += `• Shitty weather award: ${shittyWeatherResult ? '✅ Awarded' : '❌ No winner'}\n`;
            
            if (shittyWeatherResult && shittyWeatherResult.award) {
                resultMessage += `• Winner: ${shittyWeatherResult.award.displayName} (${shittyWeatherResult.award.score} pts)`;
            }
            
            await interaction.editReply({
                content: resultMessage
            });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Failed to trigger weather alerts: ${error.message}`
            });
        }
    }
};
