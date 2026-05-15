const { EmbedBuilder } = require('discord.js');

function isHexColor(value) {
  return /^#?[0-9a-fA-F]{6}$/.test(value);
}

function parseEmbedUpdateInput(raw) {
  const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
  const keyed = {};
  let foundKey = false;

  for (const line of lines) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (['title', 'description', 'footer', 'color', 'content'].includes(key)) {
      keyed[key] = value;
      foundKey = true;
    }
  }

  if (!foundKey) {
    return {
      title: null,
      description: raw,
      footer: null,
      color: null,
      content: null,
      structured: false
    };
  }

  return {
    title: keyed.title ?? null,
    description: keyed.description ?? null,
    footer: keyed.footer ?? null,
    color: keyed.color ?? null,
    content: keyed.content ?? null,
    structured: true
  };
}

module.exports = {
  data: {
    name: 'editbroadcast',
    description: 'Edits a previously broadcasted message',
    options: [
      {
        name: 'new_message',
        description: 'New content or embed keys: title:, description:, footer:, color:, content:',
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

      if (message.embeds && message.embeds.length > 0) {
        const embedEdit = parseEmbedUpdateInput(newMessage);
        const updatedEmbed = EmbedBuilder.from(message.embeds[0]);

        if (embedEdit.title !== null) {
          if (embedEdit.title) {
            updatedEmbed.setTitle(embedEdit.title);
          }
        }

        if (embedEdit.description !== null) {
          if (embedEdit.description) {
            updatedEmbed.setDescription(embedEdit.description);
          }
        }

        if (embedEdit.footer !== null) {
          if (embedEdit.footer) {
            updatedEmbed.setFooter({ text: embedEdit.footer });
          }
        }

        if (embedEdit.color !== null) {
          if (embedEdit.color) {
            if (!isHexColor(embedEdit.color)) {
              throw new Error('Color must be a valid 6-digit hex value, e.g. #5865F2');
            }

            const normalizedColor = embedEdit.color.startsWith('#') ? embedEdit.color : `#${embedEdit.color}`;
            updatedEmbed.setColor(normalizedColor);
          }
        }

        const updatedContent = embedEdit.structured
          ? (embedEdit.content !== null ? (embedEdit.content || null) : (message.content || null))
          : (message.content || null);

        await message.edit({
          content: updatedContent,
          embeds: [updatedEmbed]
        });
      } else {
        await message.edit({ content: newMessage });
      }

      await interaction.reply({ content: 'Message edited successfully!', ephemeral: true });
    } catch (error) {
      console.error('Error editing message:', error);
      await interaction.reply({ content: `There was an error editing the message: ${error.message}`, ephemeral: true });
    }
  },
};