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
                .setName('shitty')
                .setDescription('View the Shitty Weather Championship leaderboard')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Check a specific user\'s ranking (optional)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('view')
                        .setDescription('Type of view for user ranking')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Summary (default)', value: 'summary' },
                            { name: 'Detailed breakdown', value: 'detailed' }
                        ))),

    async execute(interaction, bot) {
        const subcommand = interaction.options.getSubcommand();

        console.log('[WEATHER COMMAND] Execute called, subcommand:', subcommand);
        console.log('[WEATHER COMMAND] ServiceManager exists:', !!bot.serviceManager);
        console.log('[WEATHER COMMAND] Bot object keys:', Object.keys(bot));

        if (!bot.serviceManager) {
            return await interaction.reply({
                content: '❌ Service manager is not initialized.',
                flags: 64 // MessageFlags.Ephemeral
            });
        }

        try {
            switch (subcommand) {
                case 'join':
                    await this.handleJoin(interaction, bot.serviceManager);
                    break;
                case 'leave':
                    await this.handleLeave(interaction, bot.serviceManager);
                    break;
                case 'current':
                    await this.handleCurrent(interaction, bot.serviceManager);
                    break;

                case 'shitty':
                    const userToCheck = interaction.options.getUser('user');
                    const viewType = interaction.options.getString('view') || 'summary';
                    await this.handleShittyLeaderboard(interaction, bot.serviceManager, userToCheck, viewType);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown weather command. For admin functions, use `/weatheradmin`.',
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

    async handleJoin(interaction, serviceManager) {
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
            const response = await serviceManager.joinWeatherTracking(userId, zipCode, displayName, countryCode);
            
            if (!response.success) {
                throw new Error(response.message || 'Failed to join weather tracking');
            }
            
            const result = response.data;
            
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

    async handleLeave(interaction, serviceManager) {
        const userId = interaction.user.id;
        
        try {
            const response = await serviceManager.leaveWeatherTracking(userId);
            const success = response.success;
        
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
        } catch (error) {
            console.error('Error in handleLeave:', error);
            await interaction.reply({
                content: `❌ Failed to leave weather tracking: ${error.message}`,
                flags: 64 // MessageFlags.Ephemeral
            });
        }
    },

    async handleCurrent(interaction, serviceManager) {
        const userId = interaction.user.id;
        
        await interaction.deferReply();

        try {
            const response = await serviceManager.getCurrentWeatherForUser(userId);
            
            if (!response || !response.success || !response.user) {
                return await interaction.editReply({
                    content: '❌ You are not in the weather tracking system. Use `/weather join` to get started!'
                });
            }

            const weather = response.weather;
            const user = response.user;
            
            // Safely get temperature values with fallbacks
            const temp = weather.temperature !== 'N/A' ? weather.temperature : null;
            const feelsLike = weather.main?.feels_like ? Math.round(weather.main.feels_like) : null;
            const conditions = weather.weather?.[0] || { description: weather.description || 'Unknown', main: 'Unknown' };
            
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
                .setColor(this.getWeatherColor(temp || 70))
                .setTitle(`${weatherEmoji} Current Weather (Live)`)
                .setDescription(`Real-time weather for **${user.displayName}** in ${user.location}`)
                .addFields(
                    { name: '🌡️ Temperature', value: temp ? formatTemperature(temp) : 'N/A', inline: true },
                    { name: '🤚 Feels Like', value: feelsLike ? formatTemperature(feelsLike) : 'N/A', inline: true },
                    { name: '☁️ Conditions', value: conditions.description, inline: true },
                    { name: '💨 Wind Speed', value: `${Math.round(weather.windSpeed || 0)} mph`, inline: true },
                    { name: '💧 Humidity', value: `${weather.humidity || 0}%`, inline: true },
                    { name: '🔍 Visibility', value: `${Math.round((weather.main?.visibility || 10000) / 1609.34)} mi`, inline: true }
                )
                .setFooter({ text: 'Live weather data • Competition tracking updates every 4 hours' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Failed to get weather data: ${error.message}`
            });
        }
    },



    async handleStats(interaction, serviceManager) {
        // Check if user has admin permissions
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return await interaction.reply({
                content: '❌ This command requires administrator permissions.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const stats = await serviceManager.getSystemStats();
            
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

    async handleShittyLeaderboard(interaction, serviceManager, userToCheck = null, viewType = 'summary') {
        await interaction.deferReply();

        // If a specific user is requested, show their ranking (summary or detailed)
        if (userToCheck) {
            try {
                if (viewType === 'detailed') {
                    // Show detailed breakdown
                    return await this.showDetailedUserBreakdown(interaction, serviceManager, userToCheck);
                } else {
                    // Show summary ranking (existing functionality)
                    const [bestSingleDay, topWeeklyAverages] = await Promise.all([
                        serviceManager.getBestSingleDay(),
                        serviceManager.getTopWeeklyAverages()
                    ]);
                    
                    const bestDayData = bestSingleDay?.top5 || [];
                    const weeklyData = topWeeklyAverages || [];
                    
                    const personalRanking = await this.getUserPersonalRanking(serviceManager, userToCheck.id, bestDayData, weeklyData);
                    
                    if (!personalRanking) {
                        return await interaction.editReply({
                            content: `❌ **${userToCheck.displayName}** is not in the weather tracking system.\\n\\nThey can join with \`/weather join <postal_code>\` to start competing!`
                        });
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0x8B4513)
                        .setTitle(`🏆 ${userToCheck.displayName}'s Weather Championship Standing`)
                        .setDescription(personalRanking)
                        .addFields({
                            name: '🎮 Want More Details?',
                            value: `Use \`/weather shitty @${userToCheck.displayName} detailed\` to see hourly point breakdown!\\n\\nOr use \`/weather shitty\` to see the full leaderboard!`,
                            inline: false
                        })
                        .setTimestamp();

                    return await interaction.editReply({ embeds: [embed] });
                }
                
            } catch (error) {
                console.error('Error getting user ranking:', error);
                return await interaction.editReply({
                    content: `❌ Failed to get ranking for **${userToCheck.displayName}**: ${error.message}`
                });
            }
        }

        // Show normal leaderboard if no specific user requested
        try {
            const [bestSingleDay, topWeeklyAverages] = await Promise.all([
                serviceManager.getBestSingleDay(),
                serviceManager.getTopWeeklyAverages()
            ]);
            
            // Handle null/undefined results
            const bestDayData = bestSingleDay?.top5 || [];
            const weeklyData = topWeeklyAverages || [];
            
            if (bestDayData.length === 0 && weeklyData.length === 0) {
                // Fall back to showing existing cumulative points until daily data accumulates
                const regularLeaderboard = await serviceManager.getShittyWeatherLeaderboard();
                
                if (!regularLeaderboard || regularLeaderboard.length === 0) {
                    const embed = new EmbedBuilder()
                        .setColor(0x95A5A6)
                        .setTitle('💩 Shitty Weather Championship')
                        .setDescription('**No champions yet - be the first!**')
                        .addFields(
                            {
                                name: '🎮 Join the Competition!',
                                value: '**Ready to compete for shitty weather points?**\nUse `/weather join <your_postal_code>` to start tracking!\n\n*The worse your weather, the more points you earn!*\n*Your postal code stays private - only your region is shown.*',
                                inline: false
                            },
                            {
                                name: '🏆 How It Works',
                                value: '• Points awarded every 4 hours for bad weather\n• Daily and weekly competitions for fair play\n• Everyone gets a chance to compete\n• New players can win immediately\n• Worst weather wins the most points!',
                                inline: false
                            }
                        )
                        .setTimestamp();

                    return await interaction.editReply({ embeds: [embed] });
                }
                
                // Show current champions with explanation that fair competition is starting
                const embed = new EmbedBuilder()
                    .setColor(0x8B4513)
                    .setTitle('💩 Shitty Weather Championship 🏆')
                    .setDescription('**Current Champions** *(Fair competition system starting)*\n*New daily & weekly competitions will show here as data accumulates*')
                    .setTimestamp();

                let description = '';
                regularLeaderboard.slice(0, 5).forEach((user, index) => {
                    const emoji = index === 0 ? '👑💩' : index === 1 ? '🥈💧' : index === 2 ? '🥉❄️' : '💩';
                    const status = user.isActive ? '' : ' *(inactive)*';
                    const displayName = user.displayName || user.display_name || `User-${(user.userId || user.user_id).slice(-4)}`;
                    const region = user.region || 'Unknown Region';
                    const points = user.totalPoints || user.total_points || 0;
                    description += `${emoji} **${displayName}** - ${region}${status}\n`;
                    description += `   🎖️ **${points}** total points\n\n`;
                });

                embed.addFields(
                    {
                        name: '🏆 Current Standings',
                        value: description,
                        inline: false
                    },
                    {
                        name: '🔄 Fair Competition Active!',
                        value: '*New daily and weekly competition data will appear here as it accumulates*\n*Everyone gets a fair chance - new players can compete immediately!*',
                        inline: false
                    },
                    {
                        name: '🎮 Join the Competition!',
                        value: '**Ready to compete for shitty weather points?**\nUse `/weather join <your_postal_code>` to start tracking!\n\n*The worse your weather, the more points you earn!*\n*Your postal code stays private - only your region is shown.*\n\n*💡 Tip: Use `/weather shitty @username` to check someone\'s ranking!*',
                        inline: false
                    }
                );

                return await interaction.editReply({ embeds: [embed] });
            }

            const embed = new EmbedBuilder()
                .setColor(0x8B4513) // Brown color for shitty weather
                .setTitle('💩 Shitty Weather Championship 🏆')
                .setDescription('**Fair Competition - Everyone Gets a Chance!**\n*New daily and weekly windows for fair play*')
                .setTimestamp();

            // Best Single Day Section (Last 30 days)
            if (bestDayData.length > 0) {
                const winner = bestDayData[0];
                const displayName = winner.display_name || (winner.user_id ? `User-${winner.user_id.slice(-4)}` : 'Unknown User');
                const region = winner.region || 'Unknown Region';
                const date = new Date(winner.date).toLocaleDateString();
                
                let pointsBreakdown = '';
                if (winner.points_breakdown) {
                    try {
                        const breakdown = typeof winner.points_breakdown === 'string' ? JSON.parse(winner.points_breakdown) : winner.points_breakdown;
                        const breakdownItems = [];
                        if (breakdown.temperature) breakdownItems.push(`🌡️ Extreme temps (${breakdown.temperature}pts)`);
                        if (breakdown.precipitation) breakdownItems.push(`🌧️ Rain/snow (${breakdown.precipitation}pts)`);
                        if (breakdown.wind) breakdownItems.push(`💨 High winds (${breakdown.wind}pts)`);
                        if (breakdown.humidity) breakdownItems.push(`💧 Base humidity (${breakdown.humidity}pts)`);
                        if (breakdown.high_humidity) breakdownItems.push(`💧 Extra humid >80% (${breakdown.high_humidity}pts)`);
                        if (breakdown.special && breakdown.special > 0) breakdownItems.push(`⚡ Special weather (${breakdown.special}pts)`);
                        pointsBreakdown = breakdownItems.length > 0 ? breakdownItems.join('\n') : 'Points from various weather conditions';
                    } catch (e) {
                        pointsBreakdown = 'Points from various weather conditions';
                    }
                }

                embed.addFields({
                    name: `🏆 Best Single Day Winner (Last 30 Days)`,
                    value: `👑 **${displayName}** from ${region}\n📅 ${date} - **${winner.total_points} points**\n${pointsBreakdown}`,
                    inline: false
                });
            }

            // Top Weekly Averages Section (Last 7 days)
            if (weeklyData.length > 0) {
                let weeklyDescription = '';
                weeklyData.slice(0, 5).forEach((user, index) => {
                    const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
                    const displayName = user.display_name || `User-${user.user_id.slice(-4)}`;
                    const region = user.region || 'Unknown Region';
                    const average = parseFloat(user.avg_points).toFixed(1);
                    
                    // Analyze their daily details to find most common point sources
                    let topPointSources = '';
                    if (user.daily_details) {
                        const pointTotals = {
                            temperature: 0,
                            precipitation: 0, 
                            wind: 0,
                            humidity: 0,
                            high_humidity: 0,
                            special: 0
                        };
                        
                        try {
                            const dailyDetails = typeof user.daily_details === 'string' ? JSON.parse(user.daily_details) : user.daily_details;
                            dailyDetails.forEach(day => {
                                if (day.breakdown) {
                                    const breakdown = typeof day.breakdown === 'string' ? JSON.parse(day.breakdown) : day.breakdown;
                                    Object.keys(pointTotals).forEach(key => {
                                        if (breakdown[key]) {
                                            pointTotals[key] += breakdown[key];
                                        }
                                    });
                                }
                            });
                            
                            // Find top 2 point sources
                            const sortedSources = Object.entries(pointTotals)
                                .filter(([key, value]) => value > 0)
                                .sort(([,a], [,b]) => b - a)
                                .slice(0, 2);
                            
                            if (sortedSources.length > 0) {
                                const sourceEmojis = {
                                    temperature: '🌡️',
                                    precipitation: '🌧️', 
                                    wind: '💨',
                                    humidity: '💧',
                                    high_humidity: '💧',
                                    special: '⚡'
                                };
                                
                                const sourceNames = {
                                    temperature: 'extreme temps',
                                    precipitation: 'rain/snow',
                                    wind: 'high winds', 
                                    humidity: 'humidity',
                                    high_humidity: 'extra humid',
                                    special: 'special conditions'
                                };
                                
                                topPointSources = sortedSources.map(([source, points]) => 
                                    `${sourceEmojis[source]} ${sourceNames[source]} (${points}pts)`
                                ).join(', ');
                            }
                        } catch (e) {
                            // If parsing fails, show generic message
                            topPointSources = 'various conditions';
                        }
                    }
                    
                    weeklyDescription += `${emoji} **${displayName}** - ${region}\n`;
                    weeklyDescription += `   📊 **${average} points/day** (${user.days_active} days active)\n`;
                    if (topPointSources) {
                        weeklyDescription += `   ${topPointSources}\n`;
                    }
                    weeklyDescription += '\n';
                });

                embed.addFields({
                    name: '📈 Top Weekly Averages (Last 7 Days)',
                    value: weeklyDescription,
                    inline: false
                });
            }

            embed.addFields({
                name: '🎮 Join the Competition!',
                value: '**Ready to compete for shitty weather points?**\nUse `/weather join <your_postal_code>` to start tracking!\n\n*The worse your weather, the more points you earn!*\n*Your postal code stays private - only your region is shown.*\n\n*💡 Tip: Use `/weather shitty @username` to check someone\'s ranking!*',
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in handleShittyLeaderboard:', error);
            await interaction.editReply({
                content: `❌ Failed to get shitty weather leaderboard: ${error.message}`
            });
        }
    },

    async handleManualAward(interaction, serviceManager) {
        // Check if user has admin permissions
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return await interaction.reply({
                content: '❌ This command requires administrator permissions.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            const result = await serviceManager.awardShittyWeatherPoints();
            
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

    async handleTriggerUpdate(interaction, bot) {
        // Check if user is admin
        if (!interaction.member.permissions.has('Administrator')) {
            return await interaction.reply({
                content: '❌ This command requires Administrator permissions.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            // Get channel ID from config
            const channelId = bot?.config?.weatherChannelId;
            if (!channelId) {
                return await interaction.editReply({
                    content: '❌ Weather channel not configured!'
                });
            }
            const channel = interaction.client.channels.cache.get(channelId);
            if (!channel) {
                return await interaction.editReply({
                    content: '❌ Weather channel not found!'
                });
            }

            // Trigger the daily weather update (6 PM message) - Use fair competition data
            const [bestSingleDay, topWeeklyAverages] = await Promise.all([
                bot.serviceManager.getBestSingleDay(),
                bot.serviceManager.getTopWeeklyAverages()
            ]);
            
            const bestDayData = bestSingleDay?.top5 || [];
            const weeklyData = topWeeklyAverages || [];
            
            if (bestDayData.length === 0 && weeklyData.length === 0) {
                return await interaction.editReply({
                    content: '❌ No fair competition data available yet for daily update.'
                });
            }

            let message = `💩 **DAILY SHITTY WEATHER UPDATE** 💩\n\n`;
            
            // Show best single day winner
            if (bestDayData.length > 0) {
                const winner = bestDayData[0];
                const displayName = winner.display_name || `User-${winner.user_id.slice(-4)}`;
                const region = winner.region || 'Unknown Region';
                const date = new Date(winner.date).toLocaleDateString();
                
                message += `🏆 **Best Single Day Winner (Last 30 Days)**\n`;
                message += `👑 **${displayName}** from **${region}** - **${winner.total_points} points**\n`;
                message += `📅 ${date}\n\n`;
            }
            
            // Show top weekly average
            if (weeklyData.length > 0) {
                const topWeekly = weeklyData[0];
                const displayName = topWeekly.display_name || `User-${topWeekly.user_id.slice(-4)}`;
                const region = topWeekly.region || 'Unknown Region';
                const average = parseFloat(topWeekly.avg_points).toFixed(1);
                
                message += `📈 **Top Weekly Average Leader**\n`;
                message += `🥇 **${displayName}** from **${region}** - **${average} points/day**\n`;
                message += `(${topWeekly.days_active} days active)\n\n`;
            }
            
            message += `⏰ *Next shitty weather points awarded in ${4 - (new Date().getHours() % 4)} hours!*\n`;
            message += `📊 *Use \`/weather shitty\` to see the full fair competition leaderboard!*\n`;
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

    async handleTriggerCelebration(interaction, bot) {
        // Check if user is admin
        if (!interaction.member.permissions.has('Administrator')) {
            return await interaction.reply({
                content: '❌ This command requires Administrator permissions.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            // Get channel ID from config
            const channelId = bot?.config?.weatherChannelId;
            if (!channelId) {
                return await interaction.editReply({
                    content: '❌ Weather channel not configured!'
                });
            }
            const channel = interaction.client.channels.cache.get(channelId);
            if (!channel) {
                return await interaction.editReply({
                    content: '❌ Weather channel not found!'
                });
            }

            // Trigger the weekly celebration (Sunday 8 PM message)
            const leaderboard = await bot.serviceManager.getWeatherLeaderboard();
            if (leaderboard.length === 0) {
                return await interaction.editReply({
                    content: '❌ No users in the weather system to create celebration.'
                });
            }

            const shittyLeaderboard = await bot.serviceManager.getShittyWeatherLeaderboard();
            
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

    async handleTriggerAlerts(interaction, bot) {
        // Check if user is admin
        if (!interaction.member.permissions.has('Administrator')) {
            return await interaction.reply({
                content: '❌ This command requires Administrator permissions.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            // Get channel ID from config
            const channelId = bot?.config?.weatherChannelId;
            if (!channelId) {
                return await interaction.editReply({
                    content: '❌ Weather channel not configured!'
                });
            }
            const channel = interaction.client.channels.cache.get(channelId);
            if (!channel) {
                return await interaction.editReply({
                    content: '❌ Weather channel not found!'
                });
            }

            // Trigger weather alerts and shitty weather awards (every 4 hours message)
            console.log('[WEATHER TRIGGER-ALERTS] Checking all users weather...');
            const weatherResult = await bot.serviceManager.checkAllUsersWeather();
            console.log('[WEATHER TRIGGER-ALERTS] Weather check completed:', weatherResult);
            
            // Handle alerts if they exist in the result
            if (weatherResult.alerts && weatherResult.alerts.length > 0) {
                const alertMessage = `🚨 **Weather Alerts** 🚨\n\n${weatherResult.alerts.map(a => a.alert).join('\n\n')}`;
                await channel.send(alertMessage);
            }

            console.log('[WEATHER TRIGGER-ALERTS] Awarding shitty weather points...');
            const shittyWeatherResult = await bot.serviceManager.awardShittyWeatherPoints();
            console.log('[WEATHER TRIGGER-ALERTS] Shitty weather award result:', shittyWeatherResult);
            
            if (shittyWeatherResult && shittyWeatherResult.award) {
                const award = shittyWeatherResult.award;
                const scoreEmojis = ['💩', '🌧️', '❄️', '🌪️', '⛈️'];
                const emoji = scoreEmojis[Math.min(Math.floor(award.score / 2), scoreEmojis.length - 1)] || '💩';
                
                // Check for severe weather (5+ points) - show special message
                if (award.score >= 5) {
                    let message = `🌪️ **SEVERE WEATHER ALERT** ⚡\n\n`;
                    message += `🏆 **${award.displayName}** from **${award.region}** earned **${award.score} points** for severe conditions!\n\n`;
                    message += `🌡️ **Conditions:** ${formatTemperature(award.weather.temp)}, ${award.weather.description}\n`;
                    if (award.weather.wind > 15) message += `💨 **High Winds:** ${award.weather.wind} mph\n`;
                    message += `💧 **Humidity:** ${award.weather.humidity}%\n\n`;
                    
                    // Show what earned the points
                    if (award.weather.description.includes('tornado')) {
                        message += `🌪️ **TORNADO CONDITIONS** - Extreme weather bonus!\n`;
                    } else if (award.weather.description.includes('blizzard')) {
                        message += `❄️ **BLIZZARD CONDITIONS** - Severe snow bonus!\n`;
                    } else if (award.weather.wind > 25) {
                        message += `💨 **HIGH WIND CONDITIONS** - Dangerous wind speeds!\n`;
                    } else if (award.weather.description.includes('thunderstorm')) {
                        message += `⛈️ **SEVERE THUNDERSTORM** - Heavy rain and lightning!\n`;
                    }
                    
                    message += `🎖️ **Total Points:** ${award.totalPoints}\n\n`;
                    message += `*Severe weather = more points! Stay safe out there!*\n`;
                    message += `*Join the competition: \`/weather join <postal_code>\`* 🌪️`;
                    
                    await channel.send(message);
                } else {
                    // Regular shitty weather message
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
            }
            
            let resultMessage = `✅ Weather alerts and shitty weather award process completed!\n\n`;
            resultMessage += `📊 **Results:**\n`;
            resultMessage += `• Weather updates: ${weatherResult.totalUpdates || 0} checked\n`;
            resultMessage += `• Weather alerts: ${weatherResult.totalAlerts || 0} sent\n`;
            resultMessage += `• Shitty weather points: ${shittyWeatherResult.success ? '✅ Awarded' : '❌ Failed'}\n`;
            
            if (shittyWeatherResult && shittyWeatherResult.totalPoints) {
                resultMessage += `• Points awarded: ${shittyWeatherResult.totalPoints} to ${shittyWeatherResult.usersProcessed} users`;
            }
            
            await interaction.editReply({
                content: resultMessage
            });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Failed to trigger weather alerts: ${error.message}`
            });
        }
    },

    // Show detailed point breakdown for a user
    async showDetailedUserBreakdown(interaction, serviceManager, userToCheck) {
        try {
            // Get user's detailed history
            const userHistory = await serviceManager.getUserWeatherHistory(userToCheck.id);
            
            if (!userHistory || !userHistory.success) {
                return await interaction.editReply({
                    content: `❌ **${userToCheck.displayName}** is not in the weather tracking system or has no recent activity.\\n\\nThey can join with \`/weather join <postal_code>\` to start competing!`
                });
            }

            const history = userHistory.data || [];
            
            if (history.length === 0) {
                return await interaction.editReply({
                    content: `📊 **${userToCheck.displayName}** has no recent weather point activity.\\n\\nPoints are awarded hourly when weather conditions are particularly bad!`
                });
            }

            // Group data by time periods
            const now = new Date();
            const last24Hours = [];
            const lastWeek = [];
            const lastMonth = [];

            history.forEach(entry => {
                const entryTime = new Date(entry.timestamp || entry.created_at);
                const hoursAgo = (now - entryTime) / (1000 * 60 * 60);
                const daysAgo = hoursAgo / 24;

                if (hoursAgo <= 24) last24Hours.push(entry);
                if (daysAgo <= 7) lastWeek.push(entry);
                if (daysAgo <= 30) lastMonth.push(entry);
            });

            // Create detailed breakdown
            const embed = new EmbedBuilder()
                .setColor(0x8B4513)
                .setTitle(`📊 ${userToCheck.displayName}'s Detailed Weather Points`)
                .setDescription(`**Hourly breakdown of weather point awards**\\nShowing recent activity with point explanations`)
                .setTimestamp();

            // Last 24 hours breakdown - improved readability
            if (last24Hours.length > 0) {
                const sortedLast24 = last24Hours.sort((a, b) => new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at));
                const total24 = last24Hours.reduce((sum, entry) => sum + (entry.points_awarded || entry.points || 0), 0);
                
                // Only show entries that earned points for cleaner display
                const pointEntries = sortedLast24.filter(entry => (entry.points_awarded || entry.points || 0) > 0);
                
                let last24Text = '';
                if (pointEntries.length > 0) {
                    last24Text = '**🎯 Point-earning weather events:**\n';
                    pointEntries.slice(0, 8).forEach(entry => { // Show max 8 point entries
                        const time = new Date(entry.timestamp || entry.created_at);
                        
                        // Fix timing display - round :59 to next hour for cleaner display
                        const minutes = time.getMinutes();
                        let displayTime = new Date(time);
                        if (minutes >= 55) {
                            displayTime.setHours(time.getHours() + 1, 0, 0, 0);
                        } else if (minutes <= 5) {
                            displayTime.setMinutes(0, 0, 0);
                        }
                        
                        const timeStr = displayTime.toLocaleTimeString([], {
                            hour: 'numeric', 
                            minute: displayTime.getMinutes() === 0 ? undefined : '2-digit',
                            hour12: true
                        });
                        
                        const points = entry.points_awarded || entry.points || 0;
                        
                        let reason = 'bad weather';
                        if (entry.breakdown) {
                            try {
                                const breakdown = typeof entry.breakdown === 'string' ? JSON.parse(entry.breakdown) : entry.breakdown;
                                const reasons = [];
                                if (breakdown.extreme_heat) reasons.push('extreme heat');
                                if (breakdown.extreme_cold) reasons.push('extreme cold');
                                if (breakdown.freezing) reasons.push('freezing temps');
                                if (breakdown.hot) reasons.push('hot weather');
                                if (breakdown.cold) reasons.push('cold weather');
                                if (breakdown.thunderstorm) reasons.push('thunderstorm');
                                if (breakdown.snow) reasons.push('snow');
                                if (breakdown.rain) reasons.push('rain');
                                if (breakdown.drizzle) reasons.push('drizzle');
                                if (breakdown.high_winds) reasons.push('high winds');
                                if (breakdown.moderate_winds) reasons.push('windy');
                                if (breakdown.high_humidity) reasons.push('very humid');
                                if (breakdown.low_humidity) reasons.push('very dry');
                                if (breakdown.poor_visibility) reasons.push('fog/mist');
                                if (breakdown.tornado) reasons.push('🌪️ TORNADO');
                                if (breakdown.hurricane) reasons.push('🌀 HURRICANE');
                                if (breakdown.blizzard) reasons.push('❄️ blizzard');
                                reason = reasons.length > 0 ? reasons.join(', ') : 'bad weather';
                            } catch (e) {
                                reason = entry.weather_summary || 'bad weather conditions';
                            }
                        }
                        
                        last24Text += `💩 **${timeStr}** - ${points} pt${points !== 1 ? 's' : ''} *(${reason})*\n`;
                    });
                    
                    if (pointEntries.length > 8) {
                        last24Text += `\n*...and ${pointEntries.length - 8} more point-earning events*`;
                    }
                    
                    // Add summary of non-point entries
                    const nonPointEntries = sortedLast24.length - pointEntries.length;
                    if (nonPointEntries > 0) {
                        last24Text += `\n\n☀️ **${nonPointEntries} checks with good weather** (0 pts each)`;
                    }
                } else {
                    last24Text = '☀️ **Great weather!** No shitty conditions in the last 24 hours.\n*Points are awarded when weather gets particularly bad.*';
                }
                
                embed.addFields({
                    name: `🕐 Last 24 Hours (${total24} total points)`,
                    value: last24Text,
                    inline: false
                });
            } else {
                embed.addFields({
                    name: '🕐 Last 24 Hours',
                    value: '☀️ No point awards in the last 24 hours\\n*Points are awarded hourly when weather is particularly bad*',
                    inline: false
                });
            }

            // Weekly summary
            if (lastWeek.length > 0) {
                const totalWeek = lastWeek.reduce((sum, entry) => sum + (entry.points_awarded || entry.points || 0), 0);
                const avgPerDay = (totalWeek / 7).toFixed(1);
                const daysWithPoints = new Set(lastWeek.filter(e => (e.points_awarded || e.points || 0) > 0).map(e => {
                    const date = new Date(e.timestamp || e.created_at);
                    return date.toDateString();
                })).size;
                
                embed.addFields({
                    name: `📅 Last 7 Days Summary`,
                    value: `📊 **${totalWeek} total points** (${avgPerDay} avg/day)
💩 **${daysWithPoints} days** with shitty weather points
🎯 **${lastWeek.length} total** weather checks`,
                    inline: false
                });
            }

            // Monthly summary
            if (lastMonth.length > 0) {
                const totalMonth = lastMonth.reduce((sum, entry) => sum + (entry.points_awarded || entry.points || 0), 0);
                const avgPerDay = (totalMonth / 30).toFixed(1);
                const daysWithPoints = new Set(lastMonth.filter(e => (e.points_awarded || e.points || 0) > 0).map(e => {
                    const date = new Date(e.timestamp || e.created_at);
                    return date.toDateString();
                })).size;
                
                embed.addFields({
                    name: `🗓️ Last 30 Days Summary`,
                    value: `📊 **${totalMonth} total points** (${avgPerDay} avg/day)
💩 **${daysWithPoints} days** with shitty weather points
🎯 **${lastMonth.length} total** weather checks`,
                    inline: false
                });
            }

            embed.addFields({
                name: '💡 Understanding Points',
                value: `**Points are awarded for:**
🌡️ Extreme temperatures (hot/cold)
🌧️ Rain, snow, or precipitation
💨 High wind speeds
💧 High humidity levels
⚡ Severe weather conditions

*The worse your weather, the more points you earn!*`,
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error getting detailed breakdown:', error);
            await interaction.editReply({
                content: `❌ Failed to get detailed breakdown for **${userToCheck.displayName}**: ${error.message}`
            });
        }
    },

    // Helper function to get user's personal ranking
    async getUserPersonalRanking(serviceManager, userId, bestDayData, weeklyData) {
        try {
            // Get full leaderboard to find user's position
            const fullLeaderboard = await serviceManager.getShittyWeatherLeaderboard();
            
            if (!fullLeaderboard || fullLeaderboard.length === 0) {
                return null;
            }

            // Find user in the leaderboard
            const userInLeaderboard = fullLeaderboard.find(user => 
                (user.userId === userId || user.user_id === userId)
            );

            if (!userInLeaderboard) {
                return `❌ **Not tracking yet!**\nUse \`/weather join <postal_code>\` to start competing for shitty weather points!`;
            }

            const userPosition = fullLeaderboard.findIndex(user => 
                (user.userId === userId || user.user_id === userId)
            ) + 1;

            const totalUsers = fullLeaderboard.length;
            const userPoints = userInLeaderboard.totalPoints || userInLeaderboard.total_points || 0;
            const userRegion = userInLeaderboard.region || 'Unknown Region';

            let rankingMessage = `🏅 **Rank ${userPosition} of ${totalUsers}** - **${userPoints} total points**\n`;
            rankingMessage += `📍 Competing from: **${userRegion}**\n\n`;

            // Check user's position in daily competition (get full ranking, not just top 5)
            if (bestDayData && bestDayData.length > 0) {
                const userInDaily = bestDayData.find(user => 
                    (user.user_id === userId)
                );
                
                if (userInDaily) {
                    const dailyPosition = bestDayData.findIndex(user => user.user_id === userId) + 1;
                    const dailyEmoji = dailyPosition === 1 ? '👑' : dailyPosition === 2 ? '🥈' : dailyPosition === 3 ? '🥉' : '⭐';
                    rankingMessage += `🏆 **Daily Ranking**: ${dailyEmoji} #${dailyPosition} (${userInDaily.total_points} pts)\n`;
                } else {
                    // User not in top 5, get their actual position from full daily data
                    try {
                        const fullDailyRanking = await serviceManager.getBestSingleDay(30, true); // Get all users
                        if (fullDailyRanking?.allUsers && fullDailyRanking.allUsers.length > 0) {
                            const userInFullDaily = fullDailyRanking.allUsers.find(user => user.user_id === userId);
                            if (userInFullDaily) {
                                const fullDailyPosition = fullDailyRanking.allUsers.findIndex(user => user.user_id === userId) + 1;
                                const totalDailyUsers = fullDailyRanking.allUsers.length;
                                rankingMessage += `🏆 **Daily Ranking**: #${fullDailyPosition} of ${totalDailyUsers} (${userInFullDaily.total_points} pts)\n`;
                            } else {
                                rankingMessage += `🏆 **Daily Ranking**: No recent daily points (last 30 days)\n`;
                            }
                        } else {
                            rankingMessage += `🏆 **Daily Ranking**: Not in recent competition (last 30 days)\n`;
                        }
                    } catch (dailyError) {
                        rankingMessage += `🏆 **Daily Ranking**: Not in top 5 (last 30 days)\n`;
                    }
                }
            }

            // Check user's position in weekly averages (get full ranking, not just top 5)
            if (weeklyData && weeklyData.length > 0) {
                const userInWeekly = weeklyData.find(user => 
                    (user.user_id === userId)
                );
                
                if (userInWeekly) {
                    const weeklyPosition = weeklyData.findIndex(user => user.user_id === userId) + 1;
                    const weeklyEmoji = weeklyPosition === 1 ? '🥇' : weeklyPosition === 2 ? '🥈' : weeklyPosition === 3 ? '🥉' : '🏅';
                    const avgPoints = parseFloat(userInWeekly.avg_points).toFixed(1);
                    rankingMessage += `📈 **Weekly Average**: ${weeklyEmoji} #${weeklyPosition} (${avgPoints} pts/day)`;
                } else {
                    // User not in top 5, get their actual position from full weekly data
                    try {
                        const fullWeeklyRanking = await serviceManager.getTopWeeklyAverages(true); // Get all users
                        if (fullWeeklyRanking && fullWeeklyRanking.length > 0) {
                            const userInFullWeekly = fullWeeklyRanking.find(user => user.user_id === userId);
                            if (userInFullWeekly) {
                                const fullWeeklyPosition = fullWeeklyRanking.findIndex(user => user.user_id === userId) + 1;
                                const totalWeeklyUsers = fullWeeklyRanking.length;
                                const avgPoints = parseFloat(userInFullWeekly.avg_points).toFixed(1);
                                rankingMessage += `📈 **Weekly Average**: #${fullWeeklyPosition} of ${totalWeeklyUsers} (${avgPoints} pts/day)`;
                            } else {
                                rankingMessage += `📈 **Weekly Average**: No recent activity (last 7 days)`;
                            }
                        } else {
                            rankingMessage += `📈 **Weekly Average**: Not in recent competition (last 7 days)`;
                        }
                    } catch (weeklyError) {
                        rankingMessage += `📈 **Weekly Average**: Not in top 5 (last 7 days)`;
                    }
                }
            }

            // Add encouragement based on position
            if (userPosition === 1) {
                rankingMessage += `\n\n👑 **You're the Shitty Weather Champion!** Keep it up!`;
            } else if (userPosition <= 3) {
                rankingMessage += `\n\n🏆 **You're in the top 3!** Almost at the top!`;
            } else if (userPosition <= Math.ceil(totalUsers * 0.5)) {
                rankingMessage += `\n\n📈 **You're in the top half!** Climb higher!`;
            } else {
                rankingMessage += `\n\n💪 **Keep competing!** Hope for worse weather to rise in ranks!`;
            }

            return rankingMessage;

        } catch (error) {
            console.error('Error getting personal ranking:', error);
            return null;
        }
    }
};
