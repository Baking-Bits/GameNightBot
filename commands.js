const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getTotal } = require('./pointsManagement.js');
const { restartBot } = require('./restart.js');

module.exports = {
  pointsCommand: {
    data: new SlashCommandBuilder()
      .setName('points')
      .setDescription('Check your current points'),
    
    async execute(interaction, client) {
      try {
        const userId = interaction.user.id;
        const userPoints = await getTotal(userId, client);
        
        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle('Your Points')
          .setDescription(`Your current points: ${userPoints.toFixed(2)}`);
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        console.error('Error in points command:', error);
        await interaction.reply({ content: 'There was an error checking your points.', ephemeral: true });
      }
    }
  },

  restartCommand: {
    data: new SlashCommandBuilder()
      .setName('restart')
      .setDescription('Restart the bot (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction, client) {
      try {
        await interaction.reply({ content: 'Restarting the bot...', ephemeral: true });
        
        const isWorking = true; // Assume the bot is working before restart
        await restartBot(isWorking, client);
        
        const channel = await client.channels.fetch(client.config.discord.botLogChannelId);
        if (channel) {
          await channel.send('Bot has been restarted by an admin.');
        }
      } catch (error) {
        console.error('Error in restart command:', error);
        await interaction.reply({ content: 'There was an error restarting the bot.', ephemeral: true });
      }
    }
  },

  leaderboardCommand: {
    data: new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Show the top 10 users by points'),
    
    async execute(interaction, client) {
      try {
        const [rows] = await client.dbPool.execute('SELECT user_id, points FROM user_points ORDER BY points DESC LIMIT 10');
        const leaderboard = rows.map((row, index) => `${index + 1}. <@${row.user_id}>: ${(Number(row.points) || 0).toFixed(2)} points`);
        
        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle('Leaderboard')
          .setDescription(leaderboard.join('\n'));
        
        await interaction.reply({ embeds: [embed], ephemeral: false });
      } catch (error) {
        console.error('Error in leaderboard command:', error);
        await interaction.reply({ content: 'There was an error fetching the leaderboard.', ephemeral: true });
      }
    }
  },

  broadcastCommand: {
    data: new SlashCommandBuilder()
      .setName('broadcast')
      .setDescription('Send a message to a specified channel (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(option =>
        option.setName('message')
          .setDescription('The message to broadcast')
          .setRequired(true))
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('The channel to send the message to')
          .setRequired(true)),
    
    async execute(interaction, client) {
      try {
        const message = interaction.options.getString('message');
        const channel = interaction.options.getChannel('channel');
        
        await channel.send(message);
        await interaction.reply({ content: 'Message broadcasted successfully.', ephemeral: true });
      } catch (error) {
        console.error('Error in broadcast command:', error);
        await interaction.reply({ content: 'There was an error broadcasting the message.', ephemeral: true });
      }
    }
  }
};
