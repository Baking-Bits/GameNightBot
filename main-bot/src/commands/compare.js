const { EmbedBuilder } = require('discord.js');
const { formatTime } = require('../utils/timeFormatter');

module.exports = {
    data: {
        name: 'compare',
        description: 'Compare voice time between two users',
        options: [
            {
                name: 'user1',
                description: 'First user to compare',
                type: 6, // USER
                required: true
            },
            {
                name: 'user2',
                description: 'Second user to compare',
                type: 6, // USER
                required: true
            }
        ]
    },
    async execute(interaction, bot) {
        await interaction.deferReply();
        
        try {
            console.log('[COMPARE] Starting voice time comparison for users:', {
                user1: interaction.options.getUser('user1')?.username,
                user2: interaction.options.getUser('user2')?.username,
                guild: interaction.guildId
            });
            
            const user1 = interaction.options.getUser('user1');
            const user2 = interaction.options.getUser('user2');
            const time1 = await bot.db.getUserVoiceTime(user1.id, interaction.guildId);
            const time2 = await bot.db.getUserVoiceTime(user2.id, interaction.guildId);
            const difference = Math.abs(time1 - time2);
            
            console.log('[COMPARE] Voice times retrieved:', {
                user1: user1.username,
                time1: time1,
                user2: user2.username,
                time2: time2,
                difference: difference
            });
            
            let description;
            if (time1 > time2) {
                description = `${user1.username} has spent ${formatTime(difference)} more time in voice channels than ${user2.username}`;
            } else if (time2 > time1) {
                description = `${user2.username} has spent ${formatTime(difference)} more time in voice channels than ${user1.username}`;
            } else {
                description = `Both users have spent the same amount of time in voice channels: ${formatTime(time1)}`;
            }

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Voice Time Comparison')
                .addFields(
                    { name: user1.username, value: formatTime(time1), inline: true },
                    { name: user2.username, value: formatTime(time2), inline: true }
                )
                .setDescription(description);

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[COMPARE] Error executing command:', error);
            try {
                await interaction.editReply({ 
                    content: 'An error occurred while comparing voice times. Please try again later.',
                    embeds: []
                });
            } catch (followUpError) {
                console.error('[COMPARE] Error sending error message:', followUpError);
            }
        }
    }
};
