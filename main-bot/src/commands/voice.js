const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatTime } = require('../utils/timeFormatter');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voice')
        .setDescription('Voice activity tracking and statistics')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check stats for (leave empty for yourself)')
                .setRequired(false))
        .addUserOption(option =>
            option.setName('compare_with')
                .setDescription('Compare with another user (creates comparison)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('view')
                .setDescription('What to display')
                .setRequired(false)
                .addChoices(
                    { name: '📊 Personal Stats (with charts)', value: 'stats' },
                    { name: '🏆 Leaderboard', value: 'leaderboard' },
                    { name: '📈 Averages', value: 'average' },
                    { name: '⏰ Time Only', value: 'time' }
                ))
        .addStringOption(option =>
            option.setName('period')
                .setDescription('Time period to check')
                .setRequired(false)
                .addChoices(
                    { name: 'All Time', value: 'all' },
                    { name: 'Today', value: 'today' },
                    { name: 'This Week', value: 'week' },
                    { name: 'This Month', value: 'month' }
                ))
        .addStringOption(option =>
            option.setName('average_period')
                .setDescription('Average calculation period (for averages view)')
                .setRequired(false)
                .addChoices(
                    { name: 'Daily Average', value: 'daily' },
                    { name: 'Weekly Average', value: 'weekly' },
                    { name: 'Monthly Average', value: 'monthly' }
                )),

    async execute(interaction, bot) {
        const user = interaction.options.getUser('user');
        const compareWith = interaction.options.getUser('compare_with');
        const view = interaction.options.getString('view') || 'stats';
        const period = interaction.options.getString('period') || 'all';
        const averagePeriod = interaction.options.getString('average_period') || 'daily';
        
        try {
            // Determine what type of command to execute based on parameters
            if (compareWith) {
                // Two users provided = comparison
                await handleComparison(interaction, bot, user || interaction.user, compareWith);
            } else if (view === 'leaderboard') {
                // Leaderboard view
                await handleLeaderboard(interaction, bot, period);
            } else if (view === 'average') {
                // Average view
                await handleAverage(interaction, bot, user || interaction.user, averagePeriod);
            } else if (view === 'time') {
                // Simple time view (no charts)
                await handleTimeOnly(interaction, bot, user || interaction.user, period);
            } else {
                // Default: Personal stats with charts
                await handlePersonalStats(interaction, bot, user || interaction.user);
            }
        } catch (error) {
            console.error(`Error in voice command:`, error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred while processing your request.',
                    ephemeral: true
                });
            }
        }
    }
};

// Handler functions that implement voice command logic directly
async function handlePersonalStats(interaction, bot, targetUser) {
    
    try {
        await interaction.deferReply();
        
        const totalTime = await bot.db.getUserVoiceTime(targetUser.id, interaction.guildId);
        const dailyTime = await bot.db.getUserVoiceTime(targetUser.id, interaction.guildId, 'daily');
        const weeklyTime = await bot.db.getUserVoiceTime(targetUser.id, interaction.guildId, 'weekly');
        const monthlyTime = await bot.db.getUserVoiceTime(targetUser.id, interaction.guildId, 'monthly');
        
        // Get activity schedule for charts
        const schedule = await bot.db.getActivitySchedule(targetUser.id, interaction.guildId);
        const { formatHour, formatTimeCompact } = require('../utils/timeFormatter');
        
        // Create hourly activity chart
        const maxValue = Math.max(...schedule.hourlyData.map(h => h.total_time));
        const barLength = 15;
        
        let activityGraph = '```\nHourly Activity (past 30 days):\n';
        for (let i = 0; i < 24; i++) {
            const hour = schedule.hourlyData.find(h => h.hour === i);
            const value = hour ? hour.total_time : 0;
            const bars = Math.round((value / maxValue) * barLength) || 0;
            const timeStr = formatTimeCompact(value).padEnd(12);
            activityGraph += `${formatHour(i).padStart(5)} |${'█'.repeat(bars)}${' '.repeat(barLength - bars)}| ${timeStr}\n`;
        }
        activityGraph += '```';
        
        // Create daily activity chart
        let dailyGraph = '```\nDaily Activity:\n';
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const maxDayValue = Math.max(...schedule.dailyData.map(d => d.total_time));
        
        for (let i = 0; i < 7; i++) {
            const day = schedule.dailyData.find(d => d.day_of_week === i);
            const value = day ? day.total_time : 0;
            const bars = Math.round((value / maxDayValue) * barLength) || 0;
            const timeStr = formatTimeCompact(value).padEnd(12);
            dailyGraph += `${days[i].padStart(3)} |${'█'.repeat(bars)}${' '.repeat(barLength - bars)}| ${timeStr}\n`;
        }
        dailyGraph += '```';
        
        const embed = new EmbedBuilder()
            .setTitle(`🎙️ Voice Stats for ${targetUser.username}`)
            .setColor('#5865F2')
            .addFields(
                { name: '📊 All Time', value: formatTime(totalTime), inline: true },
                { name: '📅 Today', value: formatTime(dailyTime), inline: true },
                { name: '📈 This Week', value: formatTime(weeklyTime), inline: true },
                { name: '🗓️ This Month', value: formatTime(monthlyTime), inline: true },
                { name: 'Most Active', value: schedule.mostActive, inline: true },
                { name: 'Peak Hours', value: schedule.peakHours, inline: true }
            )
            .setDescription(`${activityGraph}\n${dailyGraph}`)
            .setThumbnail(targetUser.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in handlePersonalStats:', error);
        await interaction.editReply({ content: 'An error occurred while fetching voice statistics.' });
    }
}

async function handleTimeSpent(interaction, bot) {
    const period = interaction.options.getString('period') || 'all';
    const targetUser = interaction.user;
    
    try {
        await interaction.deferReply();
        
        const voiceTime = await bot.db.getUserVoiceTime(targetUser.id, interaction.guildId, period);
        
        const periodNames = {
            'all': 'All Time',
            'today': 'Today',
            'week': 'This Week',
            'month': 'This Month'
        };
        
        const embed = new EmbedBuilder()
            .setTitle(`🎙️ Your Voice Time - ${periodNames[period]}`)
            .setDescription(`You have spent **${formatTime(voiceTime)}** in voice channels ${period === 'all' ? 'total' : periodNames[period].toLowerCase()}.`)
            .setColor('#5865F2')
            .setThumbnail(targetUser.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in handleTimeSpent:', error);
        await interaction.editReply({ content: 'An error occurred while fetching your voice time.' });
    }
}

async function handleCompare(interaction, bot) {
    const user1 = interaction.options.getUser('user1');
    const user2 = interaction.options.getUser('user2');
    
    try {
        await interaction.deferReply();
        
        const time1 = await bot.db.getUserVoiceTime(user1.id, interaction.guildId);
        const time2 = await bot.db.getUserVoiceTime(user2.id, interaction.guildId);
        
        let description;
        const difference = Math.abs(time1 - time2);
        
        if (time1 > time2) {
            description = `${user1.username} has spent ${formatTime(difference)} more time in voice channels than ${user2.username}`;
        } else if (time2 > time1) {
            description = `${user2.username} has spent ${formatTime(difference)} more time in voice channels than ${user1.username}`;
        } else {
            description = `Both users have spent the same amount of time in voice channels: ${formatTime(time1)}`;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🆚 Voice Time Comparison')
            .setDescription(description)
            .setColor('#5865F2')
            .addFields(
                { name: `🎙️ ${user1.username}`, value: formatTime(time1), inline: true },
                { name: '⚡', value: '**VS**', inline: true },
                { name: `🎙️ ${user2.username}`, value: formatTime(time2), inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in handleCompare:', error);
        await interaction.editReply({ content: 'An error occurred while comparing voice times.' });
    }
}

async function handleLeaderboard(interaction, bot, period) {
    try {
        await interaction.deferReply();
        
        const leaderboard = await bot.db.getLeaderboard(interaction.guildId, period);
        
        if (leaderboard.length === 0) {
            await interaction.editReply({ content: 'No voice activity found for this period.' });
            return;
        }
        
        const periodNames = {
            'all': 'All Time',
            'today': 'Today',
            'week': 'This Week',
            'month': 'This Month'
        };
        
        let leaderboardText = '';
        for (let i = 0; i < Math.min(leaderboard.length, 10); i++) {
            const entry = leaderboard[i];
            try {
                const user = await interaction.client.users.fetch(entry.user_id);
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                leaderboardText += `${medal} **${user.username}** - ${formatTime(entry.total_time)}\n`;
            } catch (error) {
                console.log(`Could not fetch user ${entry.user_id}:`, error.message);
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                leaderboardText += `${medal} **Unknown User** - ${formatTime(entry.total_time)}\n`;
            }
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`🏆 ${periodNames[period]} Voice Time Leaderboard`)
            .setDescription(leaderboardText)
            .setColor('#FFD700')
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in handleLeaderboard:', error);
        await interaction.editReply({ content: 'An error occurred while fetching the leaderboard.' });
    }
}

async function handleAverage(interaction, bot, targetUser, period) {
    try {
        await interaction.deferReply();
        
        const averageTime = await bot.db.getUserAverageTime(targetUser.id, interaction.guildId, period);
        
        const periodNames = {
            'daily': 'Daily Average',
            'weekly': 'Weekly Average',
            'monthly': 'Monthly Average'
        };
        
        const embed = new EmbedBuilder()
            .setTitle(`📊 Average Voice Time`)
            .setDescription(`${targetUser.username === interaction.user.username ? 'You spend' : `${targetUser.username} spends`} an average of **${formatTime(Math.round(averageTime))}** per ${period} in voice channels.`)
            .setColor('#5865F2')
            .setThumbnail(targetUser.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in handleAverage:', error);
        await interaction.editReply({ content: 'An error occurred while calculating average voice time.' });
    }
}

async function handleTimeOnly(interaction, bot, targetUser, period) {
    try {
        await interaction.deferReply();
        
        const voiceTime = await bot.db.getUserVoiceTime(targetUser.id, interaction.guildId, period);
        
        const periodNames = {
            'all': 'All Time',
            'today': 'Today',
            'week': 'This Week',
            'month': 'This Month'
        };
        
        const embed = new EmbedBuilder()
            .setTitle(`🎙️ Voice Time - ${periodNames[period]}`)
            .setDescription(`${targetUser.username === interaction.user.username ? 'You have' : `${targetUser.username} has`} spent **${formatTime(voiceTime)}** in voice channels ${period === 'all' ? 'total' : periodNames[period].toLowerCase()}.`)
            .setColor('#5865F2')
            .setThumbnail(targetUser.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in handleTimeOnly:', error);
        await interaction.editReply({ content: 'An error occurred while fetching voice time.' });
    }
}

async function handleComparison(interaction, bot, user1, user2) {
    try {
        await interaction.deferReply();
        
        const time1 = await bot.db.getUserVoiceTime(user1.id, interaction.guildId);
        const time2 = await bot.db.getUserVoiceTime(user2.id, interaction.guildId);
        
        let description;
        const difference = Math.abs(time1 - time2);
        
        if (time1 > time2) {
            description = `${user1.username} has spent ${formatTime(difference)} more time in voice channels than ${user2.username}`;
        } else if (time2 > time1) {
            description = `${user2.username} has spent ${formatTime(difference)} more time in voice channels than ${user1.username}`;
        } else {
            description = `Both users have spent the same amount of time in voice channels: ${formatTime(time1)}`;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🆚 Voice Time Comparison')
            .setDescription(description)
            .setColor('#5865F2')
            .addFields(
                { name: `🎙️ ${user1.username}`, value: formatTime(time1), inline: true },
                { name: '⚡', value: '**VS**', inline: true },
                { name: `🎙️ ${user2.username}`, value: formatTime(time2), inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in handleComparison:', error);
        await interaction.editReply({ content: 'An error occurred while comparing voice times.' });
    }
}