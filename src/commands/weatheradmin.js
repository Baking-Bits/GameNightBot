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

        if (!bot.weatherSystem) {
            await interaction.reply({
                content: '❌ Weather system is not initialized.',
                ephemeral: true
            });
            return;
        }

        try {
            switch (subcommand) {
                case 'adduser':
                    await handleAddUser(interaction, bot.weatherSystem);
                    break;
                case 'removeuser':
                    await handleRemoveUser(interaction, bot.weatherSystem);
                    break;
                case 'listusers':
                    await handleListUsers(interaction, bot.weatherSystem);
                    break;
                case 'setactive':
                    await handleSetActive(interaction, bot.weatherSystem);
                    break;
                case 'setscore':
                    await handleSetScore(interaction, bot.weatherSystem);
                    break;
            }
        } catch (error) {
            console.error('Error in weatheradmin command:', error);
            await interaction.reply({
                content: '❌ An error occurred while processing the command.',
                ephemeral: true
            });
        }
    }
};

async function handleAddUser(interaction, weatherSystem) {
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

        // Get weather data to check for existing user
        const data = await weatherSystem.getWeatherData();
        
        if (data.users[user.id]) {
            await interaction.editReply(`❌ User ${displayName} is already in the weather system.`);
            return;
        }

        // Test the postal code by fetching weather data
        let locationInfo;
        try {
            const testWeather = await weatherSystem.fetchWeatherByPostalCode(postalCode, countryCode);
            locationInfo = {
                city: testWeather.name || 'Unknown City',
                country: testWeather.sys?.country || 'Unknown',
                region: weatherSystem.getPrivacyFriendlyLocation(testWeather) || 'Unknown Region'
            };
        } catch (error) {
            const countryText = countryCode ? ` (${countryCode})` : '';
            await interaction.editReply(`❌ Could not validate postal code ${postalCode}${countryText}. Please check it's correct.`);
            return;
        }

        // Add the user
        const now = new Date().toISOString();
        data.users[user.id] = {
            postalCode: postalCode,
            zipCode: postalCode, // For compatibility
            displayName: displayName, // Discord username/display name
            discordUserId: user.id,
            city: locationInfo.city,
            country: locationInfo.country,
            region: locationInfo.region,
            joinedAt: now,
            lastWeatherCheck: now,
            isActive: true,
            updatedAt: now,
            adminAdded: true, // Flag to indicate admin addition
            addedBy: interaction.user.id
        };

        // Save the data
        await weatherSystem.saveWeatherData(data);

        const embed = new EmbedBuilder()
            .setTitle('✅ User Added Successfully')
            .setColor('#4CAF50')
            .addFields(
                { name: 'User', value: `<@${user.id}>`, inline: true },
                { name: 'Postal Code', value: postalCode, inline: true },
                { name: 'Location', value: `${locationInfo.city}, ${locationInfo.region}`, inline: false },
                { name: 'Status', value: 'Active', inline: true },
                { name: 'Added By', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error adding user:', error);
        await interaction.editReply('❌ Failed to add user. Please try again.');
    }
}

async function handleRemoveUser(interaction, weatherSystem) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user');

    try {
        const data = await weatherSystem.getWeatherData();
        
        if (!data.users[user.id]) {
            await interaction.editReply(`❌ User <@${user.id}> is not in the weather system.`);
            return;
        }

        const userData = data.users[user.id];
        
        // Remove user data
        delete data.users[user.id];
        
        // Remove from scores if present
        if (data.shittyWeatherScores && data.shittyWeatherScores[user.id]) {
            delete data.shittyWeatherScores[user.id];
        }

        // Note: We keep history entries but mark them as removed users
        
        await weatherSystem.saveWeatherData(data);

        const embed = new EmbedBuilder()
            .setTitle('✅ User Removed Successfully')
            .setColor('#F44336')
            .addFields(
                { name: 'User', value: `<@${user.id}>`, inline: true },
                { name: 'Removed By', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error removing user:', error);
        await interaction.editReply('❌ Failed to remove user. Please try again.');
    }
}

async function handleListUsers(interaction, weatherSystem) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const data = await weatherSystem.getWeatherData();
        const users = Object.entries(data.users || {});

        if (users.length === 0) {
            await interaction.editReply('No users found in the weather system.');
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('🌤️ Weather System Users')
            .setColor('#2196F3')
            .setTimestamp();

        let description = '';
        users.forEach(([userId, userData], index) => {
            const status = userData.isActive ? '✅ Active' : '❌ Inactive';
            const score = data.shittyWeatherScores?.[userId] || 0;
            const adminAdded = userData.adminAdded ? ' 👑' : '';
            
            description += `**${index + 1}.** <@${userId}>${adminAdded}\n`;
            description += `   ${userData.region} | ${status} | ${score} points\n`;
            description += `   Postal: ${userData.postalCode}\n\n`;
        });

        embed.setDescription(description);
        embed.addFields(
            { name: 'Total Users', value: users.length.toString(), inline: true },
            { name: 'Active Users', value: users.filter(([_, u]) => u.isActive).length.toString(), inline: true }
        );

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error listing users:', error);
        await interaction.editReply('❌ Failed to list users. Please try again.');
    }
}

async function handleSetActive(interaction, weatherSystem) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user');
    const active = interaction.options.getBoolean('active');

    try {
        const data = await weatherSystem.getWeatherData();
        
        if (!data.users[user.id]) {
            await interaction.editReply(`❌ User <@${user.id}> is not in the weather system.`);
            return;
        }

        data.users[user.id].isActive = active;
        data.users[user.id].updatedAt = new Date().toISOString();

        await weatherSystem.saveWeatherData(data);

        const embed = new EmbedBuilder()
            .setTitle('✅ User Status Updated')
            .setColor(active ? '#4CAF50' : '#FF9800')
            .addFields(
                { name: 'User', value: `<@${user.id}>`, inline: true },
                { name: 'Status', value: active ? '✅ Active' : '❌ Inactive', inline: true },
                { name: 'Updated By', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error setting user status:', error);
        await interaction.editReply('❌ Failed to update user status. Please try again.');
    }
}

async function handleSetScore(interaction, weatherSystem) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user');
    const points = interaction.options.getInteger('points');

    try {
        const data = await weatherSystem.getWeatherData();
        
        if (!data.users[user.id]) {
            await interaction.editReply(`❌ User <@${user.id}> is not in the weather system.`);
            return;
        }

        // Initialize scores object if it doesn't exist
        if (!data.shittyWeatherScores) {
            data.shittyWeatherScores = {};
        }

        const oldScore = data.shittyWeatherScores[user.id] || 0;
        data.shittyWeatherScores[user.id] = points;

        await weatherSystem.saveWeatherData(data);

        const embed = new EmbedBuilder()
            .setTitle('✅ User Score Updated')
            .setColor('#4CAF50')
            .addFields(
                { name: 'User', value: `<@${user.id}>`, inline: true },
                { name: 'Old Score', value: oldScore.toString(), inline: true },
                { name: 'New Score', value: points.toString(), inline: true },
                { name: 'Updated By', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setTimestamp();

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
