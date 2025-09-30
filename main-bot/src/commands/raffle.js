const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('raffle')
        .setDescription('Unified raffle system with GUI interface'),

    async execute(interaction, bot) {
        const isAdmin = interaction.member.roles.cache.some(role => config.adminRoles.includes(role.id));

        const embed = new EmbedBuilder()
            .setTitle(' Unified Raffle System')
            .setDescription('All raffle functions in one place!')
            .setColor('#FF6B35')
            .addFields(
                { name: ' Check', value: 'View tickets', inline: true },
                { name: ' Run', value: isAdmin ? 'Draw winner' : ' Admin only', inline: true },
                { name: ' Manage', value: isAdmin ? 'Grant/Remove' : ' Admin only', inline: true }
            )
            .setFooter({ text: 'Replaces: /raffle check, /raffle grant, /raffle remove, /raffle run' });

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('check_my')
                    .setLabel('My Tickets')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('check_all')
                    .setLabel('All Participants')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.reply({ embeds: [embed], components: [buttons], flags: MessageFlags.Ephemeral });
    }
};
