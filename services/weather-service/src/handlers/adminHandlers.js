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

        const data = await weatherSystem.getWeatherData();
        
        // Check if user exists and is active
        if (data.users[userId] && data.users[userId].isActive) {
            return { success: false, message: 'User is already active in the weather system.' };
        }
        
        // If user exists but is inactive, we'll reactivate them
        const isReactivation = data.users[userId] && !data.users[userId].isActive;

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

        const now = new Date().toISOString();
        
        if (isReactivation) {
            // Reactivate existing user - preserve original joinedAt but update other fields
            data.users[userId].postalCode = postalCode;
            data.users[userId].zipCode = postalCode;
            data.users[userId].displayName = displayName || data.users[userId].displayName || `User-${userId.slice(-4)}`;
            data.users[userId].city = locationInfo.city;
            data.users[userId].country = locationInfo.country;
            data.users[userId].region = locationInfo.region;
            data.users[userId].lastWeatherCheck = now;
            data.users[userId].isActive = true;
            data.users[userId].updatedAt = now;
            data.users[userId].reactivatedAt = now;
            data.users[userId].reactivatedBy = adminUserId;
            data.users[userId].countryCode = countryCode;
            // Remove removedAt timestamp
            delete data.users[userId].removedAt;
        } else {
            // Create new user
            data.users[userId] = {
                postalCode: postalCode,
                zipCode: postalCode,
                discordUserId: userId,
                displayName: displayName || `User-${userId.slice(-4)}`, // Store the display name
                city: locationInfo.city,
                country: locationInfo.country,
                region: locationInfo.region,
                joinedAt: now,
                lastWeatherCheck: now,
                isActive: true,
                updatedAt: now,
                adminAdded: true,
                addedBy: adminUserId,
                countryCode: countryCode
            };
        }

        await weatherSystem.saveWeatherData(data);

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
        const data = await weatherSystem.getWeatherData();
        const users = Object.entries(data.users);
        
        if (users.length === 0) {
            return {
                success: true,
                title: '📋 Weather System Users',
                color: '#95A5A6',
                description: 'No users found in the weather system.'
            };
        }

        let description = '';
        users.forEach(([userId, userData], index) => {
            const status = userData.isActive ? '✅ Active' : '❌ Inactive';
            const score = data.shittyWeatherScores?.[userId] || 0;
            description += `${index + 1}. <@${userId}>\n`;
            description += `   ${userData.region} | ${status} | ${score} points\n\n`;
        });

        return {
            success: true,
            title: '📋 Weather System Users',
            color: '#3498DB',
            description: description,
            fields: [
                { name: 'Total Users', value: users.length.toString(), inline: true },
                { name: 'Active Users', value: users.filter(([_, user]) => user.isActive).length.toString(), inline: true }
            ]
        };
    } catch (error) {
        console.error('[WEATHER SERVICE] Error listing users:', error);
        return { success: false, message: 'Failed to get user list. Please try again.' };
    }
}

async function handleSetActive(userId, active, adminUserId) {
    try {
        const data = await weatherSystem.getWeatherData();
        
        if (!data.users[userId]) {
            return { success: false, message: 'User not found in the weather system.' };
        }

        data.users[userId].isActive = active;
        data.users[userId].updatedAt = new Date().toISOString();
        data.users[userId].lastModifiedBy = adminUserId;

        await weatherSystem.saveWeatherData(data);

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
        const data = await weatherSystem.getWeatherData();
        
        if (!data.users[userId]) {
            return { success: false, message: 'User not found in the weather system.' };
        }

        // Initialize shittyWeatherScores if it doesn't exist
        if (!data.shittyWeatherScores) {
            data.shittyWeatherScores = {};
        }

        const oldScore = data.shittyWeatherScores[userId] || 0;
        data.shittyWeatherScores[userId] = points;

        await weatherSystem.saveWeatherData(data);

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
