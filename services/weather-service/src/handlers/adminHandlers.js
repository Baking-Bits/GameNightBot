// Admin handler functions for weather service
// We'll get the weather system instance from the server

// Get weather system instance (we'll need to pass this from server.js)
let weatherSystem;

function setWeatherSystem(ws) {
    weatherSystem = ws;
}

async function handleAddUser(userId, postalCode, countryCode, adminUserId, displayName = null) {
    try {
        const validation = validatePostalCode(postalCode);
        if (!validation.valid) {
            return { success: false, message: validation.message };
        }

        // Check if user exists in database
        const existingUser = await weatherSystem.getUser(userId);
        
        // Check if user exists and is active
        if (existingUser && existingUser.is_active) {
            return { success: false, message: 'User is already active in the weather system.' };
        }
        
        // If user exists but is inactive, we'll reactivate them
        const isReactivation = existingUser && !existingUser.is_active;

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
            return { success: false, message: `Could not validate postal code ${postalCode}${countryText}. Please check it's correct.` };
        }

        // Create user data for database
        const userData = {
            userId: userId,
            discordUserId: userId,
            displayName: displayName || `User-${userId.slice(-4)}`,
            postalCode: postalCode,
            city: locationInfo.city,
            country: locationInfo.country,
            countryCode: countryCode,
            region: locationInfo.region,
            adminAdded: true,
            addedBy: adminUserId
        };

        // Add user to database (handles both new and reactivation)
        await weatherSystem.addUser(userData);

        const responseTitle = isReactivation ? '✅ User Reactivated Successfully' : '✅ User Added Successfully';
        const actionText = isReactivation ? 'Reactivated By' : 'Added By';

        return {
            success: true,
            title: responseTitle,
            color: '#4CAF50',
            fields: [
                { name: 'User', value: `<@${userId}>`, inline: true },
                { name: 'Postal Code', value: postalCode, inline: true },
                { name: 'Location', value: `${locationInfo.city}, ${locationInfo.region}`, inline: false },
                { name: 'Status', value: 'Active', inline: true },
                { name: actionText, value: `<@${adminUserId}>`, inline: true }
            ]
        };
    } catch (error) {
        console.error('[WEATHER SERVICE] Error adding user:', error);
        return { success: false, message: 'Failed to add user. Please try again.' };
    }
}

async function handleRemoveUser(userId, adminUserId) {
    try {
        const success = await weatherSystem.removeUserLocation(userId);
        
        if (success) {
            return {
                success: true,
                title: '✅ User Removed Successfully',
                color: '#FF6B6B',
                description: `User <@${userId}> has been removed from the weather tracking system.`
            };
        } else {
            return { success: false, message: 'User was not found in the weather system.' };
        }
    } catch (error) {
        console.error('[WEATHER SERVICE] Error removing user:', error);
        return { success: false, message: 'Failed to remove user. Please try again.' };
    }
}

async function handleListUsers() {
    try {
        const users = await weatherSystem.getAllUsers();
        const userEntries = Object.entries(users);
        
        if (userEntries.length === 0) {
            return {
                success: true,
                title: '📋 Weather System Users',
                color: '#95A5A6',
                description: 'No users found in the weather system.'
            };
        }

        let description = '';
        const leaderboard = await weatherSystem.getShittyWeatherLeaderboard();
        const scoreMap = {};
        leaderboard.forEach(entry => {
            scoreMap[entry.userId] = entry.totalPoints;
        });

        userEntries.forEach(([userId, userData], index) => {
            const status = userData.isActive ? '✅ Active' : '❌ Inactive';
            const score = scoreMap[userId] || 0;
            description += `${index + 1}. <@${userId}>\n`;
            description += `   ${userData.region} | ${status} | ${score} points\n\n`;
        });

        return {
            success: true,
            title: '📋 Weather System Users',
            color: '#3498DB',
            description: description,
            fields: [
                { name: 'Total Users', value: userEntries.length.toString(), inline: true },
                { name: 'Active Users', value: userEntries.filter(([_, user]) => user.isActive).length.toString(), inline: true }
            ]
        };
    } catch (error) {
        console.error('[WEATHER SERVICE] Error listing users:', error);
        return { success: false, message: 'Failed to get user list. Please try again.' };
    }
}

async function handleSetActive(userId, active, adminUserId) {
    try {
        const user = await weatherSystem.getUser(userId);
        
        if (!user) {
            return { success: false, message: 'User not found in the weather system.' };
        }

        if (active) {
            // Reactivate user - use addUser which handles reactivation
            const userData = {
                userId: userId,
                discordUserId: userId,
                displayName: user.display_name,
                postalCode: user.postal_code,
                city: user.city,
                country: user.country,
                countryCode: user.country_code,
                region: user.region,
                adminAdded: user.admin_added,
                addedBy: adminUserId
            };
            await weatherSystem.addUser(userData);
        } else {
            // Deactivate user
            await weatherSystem.removeUser(userId);
        }

        const statusText = active ? 'Active' : 'Inactive';
        const emoji = active ? '✅' : '❌';

        return {
            success: true,
            title: `${emoji} User Status Updated`,
            color: active ? '#4CAF50' : '#FF6B6B',
            description: `<@${userId}> is now **${statusText}** in the weather system.`
        };
    } catch (error) {
        console.error('[WEATHER SERVICE] Error setting user status:', error);
        return { success: false, message: 'Failed to update user status. Please try again.' };
    }
}

async function handleSetScore(userId, points, adminUserId) {
    try {
        const user = await weatherSystem.getUser(userId);
        
        if (!user) {
            return { success: false, message: 'User not found in the weather system.' };
        }

        // Get current score from leaderboard
        const leaderboard = await weatherSystem.getShittyWeatherLeaderboard();
        const userScore = leaderboard.find(entry => entry.userId === userId);
        const oldScore = userScore ? userScore.totalPoints : 0;

        // Set new score (this will need to be implemented in the database system)
        await weatherSystem.updateShittyWeatherScore(userId, points - oldScore);

        return {
            success: true,
            title: '🏆 Weather Score Updated',
            color: '#FFA500',
            fields: [
                { name: 'User', value: `<@${userId}>`, inline: true },
                { name: 'Previous Score', value: oldScore.toString(), inline: true },
                { name: 'New Score', value: points.toString(), inline: true },
                { name: 'Updated By', value: `<@${adminUserId}>`, inline: true }
            ]
        };
    } catch (error) {
        console.error('[WEATHER SERVICE] Error setting user score:', error);
        return { success: false, message: 'Failed to update user score. Please try again.' };
    }
}

// Validation function (copied from weatheradmin.js)
function validatePostalCode(code) {
    const cleanCode = code.replace(/\s+/g, '').toUpperCase();
    
    if (/^\d{5}(-?\d{4})?$/.test(cleanCode)) {
        return { valid: true, country: 'US', format: 'zip' };
    }
    
    const ukPostcodeRegex = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}$/i;
    if (ukPostcodeRegex.test(code)) {
        return { valid: true, country: 'GB', format: 'postcode' };
    }
    
    if (/^[A-Z]\d[A-Z]\s*\d[A-Z]\d$/.test(cleanCode)) {
        return { valid: true, country: 'CA', format: 'postal' };
    }
    
    if (/^\d{5}$/.test(cleanCode)) {
        return { valid: true, country: 'DE', format: 'postcode' };
    }
    
    if (/^\d{4}$/.test(cleanCode)) {
        return { valid: true, country: 'AMBIGUOUS', format: 'postcode' };
    }
    
    if (/^[A-Z0-9\s-]{3,10}$/i.test(code)) {
        return { valid: true, country: 'UNKNOWN', format: 'generic' };
    }
    
    return { 
        valid: false, 
        message: 'Please provide a valid postal/zip code.\n\nExamples:\n• US: 12345 or 12345-6789\n• UK: SW1A 1AA or M1 1AA\n• Canada: A1A 1A1\n• Denmark/Australia: 2000\n• Germany: 10115' 
    };
}

module.exports = {
    setWeatherSystem,
    handleAddUser,
    handleRemoveUser,
    handleListUsers,
    handleSetActive,
    handleSetScore
};
