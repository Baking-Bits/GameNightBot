const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('broadcast')
    .setDescription('Broadcasts a message to a specified channel')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to send the message to')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('The message to broadcast')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');

    try {
      await channel.send({ content: message });
      await interaction.reply({ content: 'Message broadcasted successfully!', ephemeral: true });
    } catch (error) {
      console.error('Error broadcasting message:', error);
      await interaction.reply({ content: 'There was an error broadcasting the message.', ephemeral: true });
    }
  },
};
