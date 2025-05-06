const config = require('../../config.json'); // Import the config file

module.exports = {
    data: {
        name: 'raffle',
        description: 'Manage raffle tickets',
        options: [
            {
                name: 'grant',
                description: 'Grant raffle tickets to a user or role',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'tickets',
                        description: 'The number of tickets to grant',
                        type: 4, // INTEGER
                        required: true
                    },
                    {
                        name: 'user',
                        description: 'The user to grant tickets to',
                        type: 6, // USER
                        required: false
                    },
                    {
                        name: 'role',
                        description: 'The role to grant tickets to',
                        type: 8, // ROLE
                        required: false
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
            },
            {
                name: 'run',
                description: 'Run the raffle and pick a winner',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'delay',
                        description: 'Time in seconds to delay the raffle (default: 60)',
                        type: 4, // INTEGER
                        required: false
                    }
                ]
            }
        ]
    },
    async execute(interaction, bot) {
        const subcommand = interaction.options.getSubcommand();

        // Helper function to check admin permissions
        const isAdmin = interaction.member.roles.cache.some(role => config.adminRoles.includes(role.id));

        if (['grant', 'remove', 'run'].includes(subcommand) && !isAdmin) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        if (subcommand === 'grant') {
            const user = interaction.options.getUser('user');
            const role = interaction.options.getRole('role');
            const tickets = interaction.options.getInteger('tickets');

            if (tickets <= 0) {
                return interaction.reply({ content: 'The number of tickets must be greater than 0.', ephemeral: true });
            }

            if (!user && !role) {
                return interaction.reply({ content: 'You must specify either a user or a role.', ephemeral: true });
            }

            try {
                await bot.db.ensureRaffleTable();

                if (user) {
                    // Grant tickets to a single user
                    await bot.db.grantTickets(user.id, interaction.guildId, tickets);
                    await interaction.reply({ content: `Granted ${tickets} tickets to <@${user.id}>.`, ephemeral: false });
                } else if (role) {
                    // Grant tickets to all members of the role using cached members
                    const grantedUsers = [];
                    for (const [memberId, member] of bot.client.cachedMembers.entries()) {
                        if (member.roles.cache.has(role.id)) {
                            await bot.db.grantTickets(member.user.id, interaction.guildId, tickets);
                            grantedUsers.push(`<@${member.user.id}>`);
                        }
                    }

                    // Split the granted users list into chunks
                    const chunkSize = 1900;
                    let currentMessage = `Granted ${tickets} tickets to the following members of the role ${role.name}:\n`;
                    for (const user of grantedUsers) {
                        if (currentMessage.length + user.length + 1 > chunkSize) {
                            await interaction.channel.send({ content: currentMessage, allowedMentions: { parse: ['users'] } });
                            currentMessage = '';
                        }
                        currentMessage += `${user}\n`;
                    }
                    if (currentMessage.trim()) {
                        await interaction.channel.send({ content: currentMessage, allowedMentions: { parse: ['users'] } });
                    }
                }
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
                await bot.db.ensureRaffleTable();

                const result = await bot.db.removeTickets(user.id, interaction.guildId, tickets);

                if (result.affectedRows === 0) {
                    return interaction.reply({ content: `<@${user.id}> does not have enough tickets to remove.`, ephemeral: true });
                }

                await interaction.reply({ content: `Removed ${tickets} tickets from <@${user.id}>.`, ephemeral: false });
            } catch (error) {
                console.error('Error removing tickets:', error);
                await interaction.reply({ content: `There was an error removing tickets: ${error.message}`, ephemeral: true });
            }
        } else if (subcommand === 'check') {
            const user = interaction.options.getUser('user');

            try {
                await interaction.deferReply({ ephemeral: true }); // Defer the interaction response

                await bot.db.ensureRaffleTable();

                if (user) {
                    // Check tickets for a specific user
                    const tickets = await bot.db.getUserTickets(user.id, interaction.guildId);
                    const embed = {
                        color: 0x0099ff, // Embed color
                        title: `🎟️ Raffle Tickets for ${user.username}`,
                        description: tickets
                            ? `<@${user.id}> has **${tickets}** ticket${tickets === 1 ? '' : 's'}.`
                            : `<@${user.id}> has no tickets.`,
                        timestamp: new Date(),
                        footer: { text: 'Raffle Bot' }
                    };

                    return interaction.editReply({ embeds: [embed] }); // Edit the deferred response
                } else {
                    // Check tickets for all users
                    const allTickets = await bot.db.getAllTickets(interaction.guildId);
                    if (!allTickets || Object.keys(allTickets).length === 0) {
                        return interaction.editReply({ content: 'No users have tickets.' }); // Edit the deferred response
                    }

                    const ticketList = Object.entries(allTickets)
                        .map(([userId, tickets]) => `<@${userId}> - ${tickets} ticket${tickets === 1 ? '' : 's'}`);

                    // Split the ticket list into chunks
                    const chunkSize = 1900;
                    let currentMessage = 'Raffle Tickets Leaderboard:\n';
                    for (const entry of ticketList) {
                        if (currentMessage.length + entry.length + 1 > chunkSize) {
                            await interaction.channel.send({ content: currentMessage, allowedMentions: { parse: ['users'] } });
                            currentMessage = '';
                        }
                        currentMessage += `${entry}\n`;
                    }
                    if (currentMessage.trim()) {
                        await interaction.channel.send({ content: currentMessage, allowedMentions: { parse: ['users'] } });
                    }

                    return interaction.editReply({ content: 'Raffle tickets leaderboard sent to the channel.' }); // Edit the deferred response
                }
            } catch (error) {
                console.error('Error checking tickets:', error);
                await interaction.editReply({ content: `There was an error checking tickets: ${error.message}` }); // Edit the deferred response
            }
        } else if (subcommand === 'run') {
            const delay = interaction.options.getInteger('delay') || 60;

            if (delay < 0) {
                return interaction.reply({ content: 'Delay must be a positive number.', ephemeral: true });
            }

            try {
                await bot.db.ensureRaffleTable();

                const allTickets = await bot.db.getAllTickets(interaction.guildId);
                if (!allTickets || Object.keys(allTickets).length === 0) {
                    return interaction.reply({ content: 'No users have tickets. Cannot run the raffle.', ephemeral: false });
                }

                const ticketPool = Object.entries(allTickets).flatMap(([userId, tickets]) =>
                    Array(tickets).fill(userId)
                );

                const winnerId = ticketPool[Math.floor(Math.random() * ticketPool.length)];
                const winnerMention = `<@${winnerId}>`;

                const endTime = Math.floor(Date.now() / 1000) + delay; // Calculate the end time in seconds

                const usersWithTickets = Object.entries(allTickets)
                    .map(([userId, tickets]) => `<@${userId}> (${tickets} ticket${tickets === 1 ? '' : 's'})`);

                // Split the participants list into chunks to avoid exceeding the Discord message length limit
                const chunkSize = 1900; // Leave room for "Participants:\n" and formatting
                let currentMessage = 'Participants:\n';
                for (const user of usersWithTickets) {
                    if (currentMessage.length + user.length + 1 > chunkSize) { // +1 for newline
                        await interaction.channel.send({
                            content: currentMessage,
                            allowedMentions: { parse: ['users'] }
                        });
                        currentMessage = 'Participants:\n';
                    }
                    currentMessage += `${user}\n`;
                }
                if (currentMessage.trim() !== 'Participants:') {
                    await interaction.channel.send({
                        content: currentMessage,
                        allowedMentions: { parse: ['users'] }
                    });
                }

                // Wait 1 second before displaying the countdown message
                setTimeout(async () => {
                    const embed = {
                        color: 0x0099ff, // Embed color
                        title: '🎟️ Raffle Countdown',
                        description: `The raffle will run <t:${endTime}:R>!`,
                        timestamp: new Date(),
                        footer: {
                            text: 'Raffle Bot'
                        }
                    };

                    const countdownMessage = await interaction.channel.send({
                        embeds: [embed]
                    });

                    // Wait for the countdown to finish
                    setTimeout(async () => {
                        const winnerEmbed = {
                            color: 0x00ff00, // Embed color
                            title: '🎟️ Raffle Winner!',
                            description: `Congratulations ${winnerMention}! You have won the raffle! 🎉`,
                            timestamp: new Date(),
                            footer: {
                                text: 'Raffle Bot'
                            }
                        };

                        await bot.db.clearAllTickets(interaction.guildId); // Wipe all tickets from the database
                        await interaction.channel.send({ embeds: [winnerEmbed] });
                    }, delay * 1000);
                }, 1000);
            } catch (error) {
                console.error('Error running the raffle:', error);
                await interaction.reply({ content: `There was an error running the raffle: ${error.message}`, ephemeral: true });
            }
        } else {
            await interaction.reply({ content: 'Invalid subcommand.', ephemeral: true });
        }
    }
};