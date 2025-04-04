module.exports = {
    data: {
        name: 'raffle',
        description: 'Manage raffle tickets',
        options: [
            {
                name: 'grant',
                description: 'Grant raffle tickets to a user',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'user',
                        description: 'The user to grant tickets to',
                        type: 6, // USER
                        required: true
                    },
                    {
                        name: 'tickets',
                        description: 'The number of tickets to grant',
                        type: 4, // INTEGER
                        required: true
                    }
                ]
            },
            {
                name: 'remove',
                description: 'Remove raffle tickets from a user',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'user',
                        description: 'The user to remove tickets from',
                        type: 6, // USER
                        required: true
                    },
                    {
                        name: 'tickets',
                        description: 'The number of tickets to remove',
                        type: 4, // INTEGER
                        required: true
                    }
                ]
            },
            {
                name: 'check',
                description: 'Check raffle tickets for all users or a specific user',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'user',
                        description: 'The user to check tickets for (optional)',
                        type: 6, // USER
                        required: false
                    }
                ]
            }
        ]
    },
    async execute(interaction, bot) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'grant') {
            const user = interaction.options.getUser('user');
            const tickets = interaction.options.getInteger('tickets');

            if (tickets <= 0) {
                return interaction.reply({ content: 'The number of tickets must be greater than 0.', ephemeral: true });
            }

            try {
                // Ensure the database table exists
                await bot.db.ensureRaffleTable();

                // Update the user's ticket count in the database
                await bot.db.grantTickets(user.id, interaction.guildId, tickets);

                // Mention the user in the response
                await interaction.reply({ content: `Granted ${tickets} tickets to <@${user.id}>.`, ephemeral: false });
            } catch (error) {
                console.error('Error granting tickets:', error);
                await interaction.reply({ content: `There was an error granting tickets: ${error.message}`, ephemeral: true });
            }
        } else if (subcommand === 'remove') {
            const user = interaction.options.getUser('user');
            const tickets = interaction.options.getInteger('tickets');

            if (tickets <= 0) {
                return interaction.reply({ content: 'The number of tickets must be greater than 0.', ephemeral: true });
            }

            try {
                // Ensure the database table exists
                await bot.db.ensureRaffleTable();

                // Deduct the user's ticket count in the database
                const result = await bot.db.removeTickets(user.id, interaction.guildId, tickets);

                if (result.affectedRows === 0) {
                    return interaction.reply({ content: `<@${user.id}> does not have enough tickets to remove.`, ephemeral: true });
                }

                // Mention the user in the response
                await interaction.reply({ content: `Removed ${tickets} tickets from <@${user.id}>.`, ephemeral: false });
            } catch (error) {
                console.error('Error removing tickets:', error);
                await interaction.reply({ content: `There was an error removing tickets: ${error.message}`, ephemeral: true });
            }
        } else if (subcommand === 'check') {
            const user = interaction.options.getUser('user');

            try {
                await bot.db.ensureRaffleTable();

                if (user) {
                    // Check tickets for a specific user
                    const tickets = await bot.db.getUserTickets(user.id, interaction.guildId);
                    console.log(`Tickets for user ${user.id}:`, tickets); // Debug log
                    const embed = {
                        color: 0x0099ff, // Embed color
                        title: `🎟️ Raffle Tickets for ${user.username}`,
                        description: tickets
                            ? `<@${user.id}> has **${tickets}** ticket${tickets === 1 ? '' : 's'}.`
                            : `<@${user.id}> has no tickets.`,
                        timestamp: new Date(),
                        footer: {
                            text: 'Raffle Bot'
                        }
                    };

                    return interaction.reply({ embeds: [embed], ephemeral: false });
                } else {
                    // Check tickets for all users
                    const allTickets = await bot.db.getAllTickets(interaction.guildId);
                    console.log('All tickets:', allTickets); // Debug log
                    if (!allTickets || Object.keys(allTickets).length === 0) { // Ensure the object is empty
                        return interaction.reply({ content: 'No users have tickets.', ephemeral: false });
                    }

                    // Create a leaderboard-style embed
                    const ticketList = Object.entries(allTickets)
                        .map(([userId, tickets]) => ({
                            user: `<@${userId}>`,
                            tickets
                        }))
                        .sort((a, b) => b.tickets - a.tickets) // Sort by ticket count descending
                        .map((entry, index) => `**${index + 1}.** ${entry.user} - ${entry.tickets} ticket${entry.tickets === 1 ? '' : 's'}`)
                        .join('\n');

                    const embed = {
                        color: 0x0099ff, // Embed color
                        title: '🎟️ Raffle Tickets Leaderboard',
                        description: ticketList,
                        timestamp: new Date(),
                        footer: {
                            text: 'Raffle Bot'
                        }
                    };

                    return interaction.reply({ embeds: [embed], ephemeral: false });
                }
            } catch (error) {
                console.error('Error checking tickets:', error);
                await interaction.reply({ content: `There was an error checking tickets: ${error.message}`, ephemeral: true });
            }
        } else {
            await interaction.reply({ content: 'Invalid subcommand.', ephemeral: true });
        }
    }
};