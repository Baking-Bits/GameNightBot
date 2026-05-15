const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
} = require('discord.js');

const MODAL_TIMEOUT_MS = 300000;
const PREVIEW_TIMEOUT_MS = 600000;

function isHexColor(value) {
  return /^#?[0-9a-fA-F]{6}$/.test(value);
}

function normalizeHexColor(value) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

function buildBroadcastModal(mode, sessionId, existingDraft = null) {
  const modal = new ModalBuilder()
    .setCustomId(`broadcast_modal_${mode}_${sessionId}`)
    .setTitle(mode === 'embed' ? 'Build Embed Broadcast' : 'Build Text Broadcast');

  if (mode === 'embed') {
    const titleInput = new TextInputBuilder()
      .setCustomId('embed_title')
      .setLabel('Embed title (optional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(256)
      .setValue(existingDraft?.title || '');

    const descriptionInput = new TextInputBuilder()
      .setCustomId('embed_description')
      .setLabel('Embed description (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(4000)
      .setValue(existingDraft?.description || '');

    const footerInput = new TextInputBuilder()
      .setCustomId('embed_footer')
      .setLabel('Embed footer (optional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(2048)
      .setValue(existingDraft?.footer || '');

    const colorInput = new TextInputBuilder()
      .setCustomId('embed_color')
      .setLabel('Hex color (optional, e.g. #5865F2)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(7)
      .setValue(existingDraft?.color || '');

    const messageContentInput = new TextInputBuilder()
      .setCustomId('message_content')
      .setLabel('Message content outside embed (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(2000)
      .setValue(existingDraft?.content || '');

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descriptionInput),
      new ActionRowBuilder().addComponents(footerInput),
      new ActionRowBuilder().addComponents(colorInput),
      new ActionRowBuilder().addComponents(messageContentInput)
    );

    return modal;
  }

  const textInput = new TextInputBuilder()
    .setCustomId('plain_content')
    .setLabel('Broadcast message')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(2000)
    .setValue(existingDraft?.content || '');

  modal.addComponents(new ActionRowBuilder().addComponents(textInput));
  return modal;
}

function parseDraftFromModal(mode, modalSubmission) {
  if (mode === 'embed') {
    const title = modalSubmission.fields.getTextInputValue('embed_title').trim();
    const description = modalSubmission.fields.getTextInputValue('embed_description').trim();
    const footer = modalSubmission.fields.getTextInputValue('embed_footer').trim();
    const color = normalizeHexColor(modalSubmission.fields.getTextInputValue('embed_color'));
    const content = modalSubmission.fields.getTextInputValue('message_content').trim();

    if (!title && !description && !content) {
      return {
        error: 'Provide at least one of: embed title, embed description, or message content.',
      };
    }

    if (color && !isHexColor(color)) {
      return { error: 'Color must be a valid 6-digit hex value like #5865F2.' };
    }

    return {
      draft: {
        type: 'embed',
        title,
        description,
        footer,
        color,
        content,
      },
    };
  }

  const content = modalSubmission.fields.getTextInputValue('plain_content').trim();
  if (!content) {
    return { error: 'Broadcast message cannot be empty.' };
  }

  return {
    draft: {
      type: 'plain',
      content,
    },
  };
}

function buildEmbedFromDraft(draft) {
  const embed = new EmbedBuilder();

  if (draft.title) {
    embed.setTitle(draft.title);
  }

  if (draft.description) {
    embed.setDescription(draft.description);
  }

  if (draft.footer) {
    embed.setFooter({ text: draft.footer });
  }

  if (draft.color) {
    embed.setColor(draft.color);
  }

  return embed;
}

function buildPreviewPayload(channelId, draft, sessionId) {
  const controls = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`broadcast_send_${sessionId}`)
        .setLabel('Send')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`broadcast_edit_${sessionId}`)
        .setLabel('Edit')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`broadcast_cancel_${sessionId}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];

  if (draft.type === 'plain') {
    return {
      content: `Preview for <#${channelId}>:\n\n${draft.content}`,
      components: controls,
      embeds: [],
      ephemeral: true,
    };
  }

  const embed = buildEmbedFromDraft(draft);
  return {
    content: `Preview for <#${channelId}>:` + (draft.content ? `\n\n${draft.content}` : ''),
    embeds: [embed],
    components: controls,
    ephemeral: true,
  };
}

function buildSendPayload(draft) {
  if (draft.type === 'plain') {
    return { content: draft.content };
  }

  const payload = {
    embeds: [buildEmbedFromDraft(draft)],
  };

  if (draft.content) {
    payload.content = draft.content;
  }

  return payload;
}

async function collectDraftFromModal(sourceInteraction, mode, sessionId, existingDraft = null) {
  const modal = buildBroadcastModal(mode, sessionId, existingDraft);
  await sourceInteraction.showModal(modal);

  try {
    const modalSubmission = await sourceInteraction.awaitModalSubmit({
      filter: i => i.customId === `broadcast_modal_${mode}_${sessionId}` && i.user.id === sourceInteraction.user.id,
      time: MODAL_TIMEOUT_MS,
    });

    const parsed = parseDraftFromModal(mode, modalSubmission);
    return {
      modalSubmission,
      draft: parsed.draft,
      error: parsed.error,
    };
  } catch (error) {
    if (String(error?.message || '').includes('time')) {
      return null;
    }

    throw error;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('broadcast')
    .setDescription('Broadcast a message with quick or guided formatting')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to send the message to')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText))
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Use plain text or embed builder')
        .setRequired(false)
        .addChoices(
          { name: 'Plain text', value: 'plain' },
          { name: 'Embed', value: 'embed' }
        ))
    .addStringOption(option =>
      option.setName('quick_message')
        .setDescription('Optional: quick send plain text without opening builder')
        .setRequired(false)
        .setMaxLength(2000))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const mode = interaction.options.getString('mode') || 'plain';
    const quickMessage = interaction.options.getString('quick_message');
    const sessionId = interaction.id;

    try {
      if (quickMessage && mode === 'plain') {
        await channel.send({ content: quickMessage });
        await interaction.reply({ content: `Message broadcasted to <#${channel.id}> successfully!`, ephemeral: true });
        return;
      }

      if (quickMessage && mode === 'embed') {
        await interaction.reply({
          content: 'Quick message is only available in plain mode. For embeds, run the guided builder without quick_message.',
          ephemeral: true,
        });
        return;
      }

      const initialResult = await collectDraftFromModal(interaction, mode, sessionId);
      if (!initialResult) {
        return;
      }

      if (initialResult.error) {
        await initialResult.modalSubmission.reply({ content: initialResult.error, ephemeral: true });
        return;
      }

      let draft = initialResult.draft;
      const initialPreview = buildPreviewPayload(channel.id, draft, sessionId);
      const previewMessage = await initialResult.modalSubmission.reply({
        ...initialPreview,
        fetchReply: true,
      });

      let isDone = false;
      while (!isDone) {
        let buttonInteraction;

        try {
          buttonInteraction = await previewMessage.awaitMessageComponent({
            componentType: ComponentType.Button,
            filter: i => i.user.id === interaction.user.id,
            time: PREVIEW_TIMEOUT_MS,
          });
        } catch (error) {
          await initialResult.modalSubmission.editReply({
            content: 'Broadcast builder timed out. Run /broadcast again when ready.',
            embeds: [],
            components: [],
          });
          return;
        }

        if (buttonInteraction.customId === `broadcast_send_${sessionId}`) {
          const payload = buildSendPayload(draft);
          await channel.send(payload);

          await buttonInteraction.update({
            content: `Message broadcasted to <#${channel.id}> successfully!`,
            embeds: [],
            components: [],
          });
          isDone = true;
          continue;
        }

        if (buttonInteraction.customId === `broadcast_cancel_${sessionId}`) {
          await buttonInteraction.update({
            content: 'Broadcast canceled. No message was sent.',
            embeds: [],
            components: [],
          });
          isDone = true;
          continue;
        }

        if (buttonInteraction.customId === `broadcast_edit_${sessionId}`) {
          const editResult = await collectDraftFromModal(buttonInteraction, mode, sessionId, draft);

          if (!editResult) {
            await buttonInteraction.followUp({
              content: 'Edit modal timed out. Draft was not changed.',
              ephemeral: true,
            });
            continue;
          }

          if (editResult.error) {
            await editResult.modalSubmission.reply({ content: editResult.error, ephemeral: true });
            continue;
          }

          draft = editResult.draft;
          const refreshedPreview = buildPreviewPayload(channel.id, draft, sessionId);
          await editResult.modalSubmission.update(refreshedPreview);
        }
      }
    } catch (error) {
      console.error('Error broadcasting message:', error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'There was an error broadcasting the message.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error broadcasting the message.', ephemeral: true });
      }
    }
  },
};
