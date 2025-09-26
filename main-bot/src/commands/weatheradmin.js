const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weatheradmin')
        .setDescription('Weather system administration (Admin only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('adduser')
                .setDescription('Manually add a user to the weather system')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Discord user to add')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('postalcode')
                        .setDescription('Postal/ZIP code for the user')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('country')
                        .setDescription('Country code (optional, helps with ambiguous postal codes)')
                        .setRequired(false)
                        .addChoices(
                            { name: 'United States', value: 'US' },
                            { name: 'United Kingdom', value: 'GB' },
                            { name: 'Canada', value: 'CA' },
                            { name: 'Australia', value: 'AU' },
                            { name: 'Denmark', value: 'DK' },
                            { name: 'Germany', value: 'DE' },
                            { name: 'France', value: 'FR' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('removeuser')
                .setDescription('Remove a user from the weather system')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Discord user to remove')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('listusers')
                .setDescription('List all users in the weather system')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('setactive')
                .setDescription('Set user active/inactive status')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Discord user to modify')
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option
                        .setName('active')
                        .setDescription('Set active status')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('setscore')
                .setDescription('Set user weather score points')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Discord user to modify')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName('points')
                        .setDescription('Points to set (0 or higher)')
                        .setRequired(true)
                        .setMinValue(0)
                )
        ),

    async execute(interaction, bot) {
        console.log('[WEATHERADMIN] Execute called, subcommand:', interaction.options.getSubcommand());
        console.log('[WEATHERADMIN] ServiceManager exists:', !!bot.serviceManager);
        console.log('[WEATHERADMIN] Bot object keys:', Object.keys(bot));

        // Check if user has admin permissions
        const isAdmin = bot.config.adminRoles?.some(roleId => 
            interaction.member?.roles.cache.has(roleId)
        );

        if (!isAdmin) {
            await interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        if (!bot.serviceManager) {
            await interaction.reply({
                content: '❌ Service manager is not initialized.',
                ephemeral: true
            });
            return;
        }

        try {
            switch (subcommand) {
                case 'adduser':
                    await handleAddUser(interaction, bot.serviceManager);
                    break;
                case 'removeuser':
                    await handleRemoveUser(interaction, bot.serviceManager);
                    break;
                case 'listusers':
                    await handleListUsers(interaction, bot.serviceManager);
                    break;
                case 'setactive':
                    await handleSetActive(interaction, bot.serviceManager);
                    break;
                case 'setscore':
                    await handleSetScore(interaction, bot.serviceManager);
                    break;
            }
        } catch (error) {
            console.error('Error in weatheradmin command:', error);
            const errorMessage = error.replied || error.deferred ? 
                'An error occurred while processing the command.' : 
                '❌ An error occurred while processing the command.';
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: errorMessage,
                    ephemeral: true
                });
            } else if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            }
        }
    }
};

async function handleAddUser(interaction, serviceManager) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user');
    const postalCode = interaction.options.getString('postalcode');
    const countryCode = interaction.options.getString('country');
    const displayName = user.displayName || user.username;

    try {
        // Validate postal code format using comprehensive validation
        const validation = validatePostalCode(postalCode);
        if (!validation.valid) {
            await interaction.editReply(`❌ ${validation.message}`);
            return;
        }

        // Use the ServiceManager's addWeatherUser method
        const response = await serviceManager.addWeatherUser(user.id, postalCode, countryCode, interaction.user.id);
        
        if (!response.success) {
            await interaction.editReply(`❌ ${response.message || 'Failed to add user to weather system.'}`);
            return;
        }

        // Use the response format from the API
        const embed = new EmbedBuilder()
            .setTitle(response.title || '✅ User Added Successfully')
            .setColor(response.color || '#4CAF50')
            .setTimestamp();

        // Add fields if they exist
        if (response.fields && response.fields.length > 0) {
            embed.addFields(response.fields);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error adding user:', error);
        await interaction.editReply('❌ Failed to add user. Please try again.');
    }
}

async function handleRemoveUser(interaction, serviceManager) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user');

    try {
        const response = await serviceManager.removeWeatherUser(user.id, interaction.user.id);
        
        if (!response.success) {
            await interaction.editReply(`❌ ${response.message || 'Failed to remove user from weather system.'}`);
            return;
        }

        // Use the response format from the API
        const embed = new EmbedBuilder()
            .setTitle(response.title || '✅ User Removed Successfully')
            .setColor(response.color || '#F44336')
            .setTimestamp();

        // Add description if it exists
        if (response.description) {
            embed.setDescription(response.description);
        }

        // Add fields if they exist
        if (response.fields && response.fields.length > 0) {
            embed.addFields(response.fields);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error removing user:', error);
        await interaction.editReply('❌ Failed to remove user. Please try again.');
    }
}

async function handleListUsers(interaction, serviceManager) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const response = await serviceManager.listWeatherUsers();
        
        if (!response.success) {
            await interaction.editReply(`❌ ${response.message || 'Failed to list users.'}`);
            return;
        }

        // The API returns a ready-to-use response with title, description, fields, etc.
        const embed = new EmbedBuilder()
            .setTitle(response.title || '🌤️ Weather System Users')
            .setColor(response.color || '#2196F3')
            .setDescription(response.description || 'No users found.')
            .setTimestamp();

        // Add fields if they exist
        if (response.fields && response.fields.length > 0) {
            embed.addFields(response.fields);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error listing users:', error);
        await interaction.editReply('❌ Failed to list users. Please try again.');
    }
}

async function handleSetActive(interaction, serviceManager) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user');
    const active = interaction.options.getBoolean('active');

    try {
        const response = await serviceManager.setWeatherUserActive(user.id, active, interaction.user.id);
        
        if (!response.success) {
            await interaction.editReply(`❌ ${response.message || 'Failed to update user status.'}`);
            return;
        }

        // Use the response format from the API
        const embed = new EmbedBuilder()
            .setTitle(response.title || '✅ User Status Updated')
            .setColor(response.color || (active ? '#4CAF50' : '#FF9800'))
            .setTimestamp();

        // Add description if it exists
        if (response.description) {
            embed.setDescription(response.description);
        }

        // Add fields if they exist
        if (response.fields && response.fields.length > 0) {
            embed.addFields(response.fields);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error setting user status:', error);
        await interaction.editReply('❌ Failed to update user status. Please try again.');
    }
}

async function handleSetScore(interaction, serviceManager) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user');
    const points = interaction.options.getInteger('points');

    try {
        const response = await serviceManager.setWeatherUserScore(user.id, points, interaction.user.id);
        
        if (!response.success) {
            await interaction.editReply(`❌ ${response.message || 'Failed to update user score.'}`);
            return;
        }

        // Use the response format from the API
        const embed = new EmbedBuilder()
            .setTitle(response.title || '✅ User Score Updated')
            .setColor(response.color || '#4CAF50')
            .setTimestamp();

        // Add description if it exists
        if (response.description) {
            embed.setDescription(response.description);
        }

        // Add fields if they exist
        if (response.fields && response.fields.length > 0) {
            embed.addFields(response.fields);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error setting user score:', error);
        await interaction.editReply('❌ Failed to update user score. Please try again.');
    }
}

// Postal code validation function (copied from weather.js for consistency)
function validatePostalCode(code) {
    // Remove spaces and convert to uppercase for validation
    const cleanCode = code.replace(/\s+/g, '').toUpperCase();
    
    // US ZIP codes (5 digits or 5+4 format)
    if (/^\d{5}(-?\d{4})?$/.test(cleanCode)) {
        return { valid: true, country: 'US', format: 'zip' };
    }
    
    // UK postcodes - comprehensive pattern for all valid formats
    // Formats: M1 1AA, M60 1NW, CR0 2YR, DN55 1PT, W1A 0AX, EC1A 1BB, SW1A 1AA
    const ukPostcodeRegex = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}$/i;
    if (ukPostcodeRegex.test(code)) {
        return { valid: true, country: 'GB', format: 'postcode' };
    }
    
    // Canadian postal codes (A1A1A1 or A1A 1A1)
    if (/^[A-Z]\d[A-Z]\s*\d[A-Z]\d$/.test(cleanCode)) {
        return { valid: true, country: 'CA', format: 'postal' };
    }
    
    // German postal codes (5 digits)
    if (/^\d{5}$/.test(cleanCode)) {
        return { valid: true, country: 'DE', format: 'postcode' };
    }
    
    // French postal codes (5 digits)
    if (/^\d{5}$/.test(cleanCode)) {
        return { valid: true, country: 'FR', format: 'postcode' };
    }
    
    // Danish postal codes (4 digits, but we can't distinguish from AU without more context)
    // Note: Both Denmark and Australia use 4-digit codes
    if (/^\d{4}$/.test(cleanCode)) {
        // For 4-digit codes, we'll let the API handle country detection
        // or require users to be more specific in ambiguous cases
        return { valid: true, country: 'AMBIGUOUS', format: 'postcode' };
    }
    
    // For other formats, be more lenient - accept if it's 3-10 characters with letters/numbers
    if (/^[A-Z0-9\s-]{3,10}$/i.test(code)) {
        return { valid: true, country: 'UNKNOWN', format: 'generic' };
    }
    
    return { 
        valid: false, 
        message: 'Please provide a valid postal/zip code.\n\nExamples:\n• US: 12345 or 12345-6789\n• UK: SW1A 1AA or M1 1AA\n• Canada: A1A 1A1\n• Denmark/Australia: 2000\n• Germany: 10115' 
    };
}
