// Fix real user's display name by fetching from Discord
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

const userId = '670110851088384030';

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    try {
        // Try to fetch the user from Discord
        const user = await client.users.fetch(userId);
        console.log('Found Discord user:', {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            tag: user.tag
        });

        // Try to get guild member info if possible
        const guilds = client.guilds.cache;
        let memberDisplayName = null;
        
        for (const [guildId, guild] of guilds) {
            try {
                const member = await guild.members.fetch(userId);
                if (member) {
                    memberDisplayName = member.displayName;
                    console.log(`Found member in guild ${guild.name}:`, {
                        displayName: member.displayName,
                        nickname: member.nickname
                    });
                    break;
                }
            } catch (err) {
                // User not in this guild, continue
            }
        }

        const finalDisplayName = memberDisplayName || user.displayName || user.username;
        console.log('Final display name to use:', finalDisplayName);

        // Update the weather data
        const dataPath = path.join(__dirname, 'services', 'data', 'weatherData.json');
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        
        if (data.users[userId]) {
            // Create backup first
            const backupPath = path.join(__dirname, 'services', 'data', 'backups', `weatherData_${new Date().toISOString().replace(/:/g, '-')}_fix-real-user-displayname.json`);
            fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
            console.log('Created backup:', backupPath);
            
            // Update display name
            const oldDisplayName = data.users[userId].displayName;
            data.users[userId].displayName = finalDisplayName;
            data.users[userId].updatedAt = new Date().toISOString();
            
            // Write updated data
            fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
            console.log(`Updated user display name from "${oldDisplayName}" to "${finalDisplayName}"`);
        } else {
            console.log('User not found in weather data');
        }

    } catch (error) {
        console.error('Error fetching user:', error);
    }
    
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
