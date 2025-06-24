const { SlashCommandBuilder, ChannelType, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createevent')
    .setDescription('Create a Discord scheduled event')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('The name of the event')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('A description of the event')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('start')
        .setDescription('Start date and time (YYYY-MM-DD HH:mm, 24h UTC)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('end')
        .setDescription('End date and time (YYYY-MM-DD HH:mm, 24h UTC)')
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Voice channel for the event')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageEvents)) {
      return interaction.reply({ content: 'You do not have permission to create events.', ephemeral: true });
    }
    const name = interaction.options.getString('name');
    const description = interaction.options.getString('description');
    const start = interaction.options.getString('start');
    const end = interaction.options.getString('end');
    const channel = interaction.options.getChannel('channel');

    // Parse dates
    const startTime = new Date(start.replace(' ', 'T') + ':00Z');
    const endTime = new Date(end.replace(' ', 'T') + ':00Z');
    if (isNaN(startTime) || isNaN(endTime) || startTime >= endTime) {
      return interaction.reply({ content: 'Invalid start or end time. Please use YYYY-MM-DD HH:mm format and ensure start is before end.', ephemeral: true });
    }

    try {
      const event = await interaction.guild.scheduledEvents.create({
        name,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        privacyLevel: 2, // GUILD_ONLY
        entityType: 2, // VOICE
        channel: channel.id,
        description
      });
      await interaction.reply({ content: `Event created: ${event.name}\n<${event.url}>`, ephemeral: false });
    } catch (error) {
      console.error('Error creating event:', error);
      await interaction.reply({ content: 'There was an error creating the event.', ephemeral: true });
    }
  },
};
