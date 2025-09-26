const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'editbroadcast',
    description: 'Edits a previously broadcasted message',
    options: [
      {
        name: 'new_message',
        description: 'The new message content',
        type: 3, // STRING
        required: true
      },
      {
        name: 'channel',
        description: 'The channel where the message was broadcasted',
        type: 7, // CHANNEL
        required: false,
        channel_types: [0] // GUILD_TEXT
      },
      {
        name: 'message_id',
        description: 'The ID of the message to edit',
        type: 3, // STRING
        required: false
      }
    ],
    default_member_permissions: 8 // ADMINISTRATOR
  },
  async execute(interaction, bot) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const messageId = interaction.options.getString('message_id');
    const newMessage = interaction.options.getString('new_message');

    try {
      let message;
      if (messageId) {
        message = await channel.messages.fetch(messageId);
      } else {
        const messages = await channel.messages.fetch({ limit: 10 });
        message = messages.find(msg => msg.author.id === interaction.client.user.id);
        if (!message) throw new Error('No recent bot message found in this channel.');
      }
      await message.edit(newMessage);
      await interaction.reply({ content: 'Message edited successfully!', ephemeral: true });
    } catch (error) {
      console.error('Error editing message:', error);
      await interaction.reply({ content: `There was an error editing the message: ${error.message}`, ephemeral: true });
    }
  },
};