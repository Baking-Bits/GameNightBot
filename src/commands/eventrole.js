const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eventrole')
    .setDescription('Manage event role associations for RSVPs')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Assign a role to users who RSVP to a specific event')
        .addStringOption(option =>
          option.setName('event_id')
            .setDescription('The ID of the scheduled event to track')
            .setRequired(true))
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('The role to assign to users who RSVP')
            .setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Stop assigning a role for a specific event')
        .addStringOption(option =>
          option.setName('event_id')
            .setDescription('The ID of the scheduled event to stop tracking')
            .setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all tracked event-role associations')
    ),
  async execute(interaction, bot) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.reply({ content: 'You do not have permission to manage event roles.', flags: 64 });
    }
    const sub = interaction.options.getSubcommand();
    if (sub === 'add') {
      const eventId = interaction.options.getString('event_id');
      const role = interaction.options.getRole('role');
      await bot.db.setEventRole(eventId, role.id);
      if (!bot.eventRoleMap) bot.eventRoleMap = new Map();
      bot.eventRoleMap.set(eventId, role.id);
      await interaction.reply({ content: `Tracking event \`${eventId}\` and will assign role <@&${role.id}> to users who RSVP.`, flags: 0 });
      return;
    }
    if (sub === 'remove') {
      const eventId = interaction.options.getString('event_id');
      await bot.db.removeEventRole(eventId);
      if (bot.eventRoleMap) bot.eventRoleMap.delete(eventId);
      await interaction.reply({ content: `Stopped tracking event \`${eventId}\` for role assignment.`, flags: 0 });
      return;
    }
    if (sub === 'list') {
      const rows = await bot.db.getAllEventRoles();
      if (!rows.length) {
        await interaction.reply({ content: 'No event-role associations are currently being tracked.', flags: 64 });
      } else {
        const lines = rows.map(r => `Event ID: \`${r.event_id}\` → Role: <@&${r.role_id}>`);
        await interaction.reply({ content: `Tracked event-role associations:\n${lines.join('\n')}`, flags: 64 });
      }
      return;
    }
  }
};
