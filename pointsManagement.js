const { log, logError } = require('./logging.js');

async function getTotal(userId, client) {
  try {
    const [rows] = await client.dbPool.execute('SELECT points FROM user_points WHERE user_id = ?', [userId]);
    return rows.length > 0 ? Number(rows[0].points) || 0 : 0;
  } catch (error) {
    logError(error, 'Getting Total Points');
    return 0;
  }
}

async function updatePoints(userId, action, points, client) {
  try {
    await client.dbPool.execute('INSERT INTO user_points (user_id, points) VALUES (?, ?) ON DUPLICATE KEY UPDATE points = points + ?', [userId, points, points]);
    log(`Updated points for user ${userId} by ${points} for ${action}.`);
  } catch (error) {
    logError(error, 'Updating Points');
  }
}

async function decayPoints(userId, channelId, client) {
  try {
    let decayRate = client.config.botSettings.decayRate;
    if (channelId === client.config.botSettings.noPointChannelId) {
      decayRate *= client.config.botSettings.noPointChannelDecayMultiplier;
    }
    await client.dbPool.execute('UPDATE user_points SET points = GREATEST(0, points - ?) WHERE user_id = ?', [decayRate, userId]);
    log(`Decayed points for user ${userId} in channel ${channelId}.`);
  } catch (error) {
    logError(error, 'Decaying Points');
  }
}

async function manageRolesBasedOnPoints(userId, client) {
  try {
    const totalPoints = await getTotal(userId, client);
    const member = await client.guilds.cache.get(client.config.discord.guildIds[0]).members.fetch(userId);
    
    for (const [roleId, threshold] of Object.entries(client.config.thresholds)) {
      if (totalPoints >= threshold && !member.roles.cache.has(roleId)) {
        await member.roles.add(roleId);
        log(`Added role ${roleId} to user ${userId} for reaching ${threshold} points.`);
      } else if (totalPoints < threshold && member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId);
        log(`Removed role ${roleId} from user ${userId} for falling below ${threshold} points.`);
      }
    }
  } catch (error) {
    logError(error, 'Managing Roles Based on Points');
  }
}

async function checkAllVoiceChannelsForUsers(client) {
  try {
    const guild = await client.guilds.fetch(client.config.discord.guildIds[0]);
    const voiceChannels = guild.channels.cache.filter(channel => channel.type === 'GUILD_VOICE');
    
    for (const [, channel] of voiceChannels) {
      const members = channel.members;
      for (const [, member] of members) {
        const userId = member.id;
        if (!voiceActivity.has(userId)) {
          voiceActivity.set(userId, Date.now());
          startVoicePointUpdate(userId, member, client);
          log(`Started point update for user ${userId} in voice channel ${channel.name}.`);
        }
      }
    }
  } catch (error) {
    logError(error, 'Checking Voice Channels for Users');
  }
}

async function applyPointDecayForNotInVoice(client) {
  try {
    const [rows] = await client.dbPool.execute('SELECT user_id FROM user_points');
    const usersInVoice = new Set();
    
    const guild = await client.guilds.fetch(client.config.discord.guildIds[0]);
    const voiceChannels = guild.channels.cache.filter(channel => channel.type === 'GUILD_VOICE');
    
    for (const [, channel] of voiceChannels) {
      for (const [, member] of channel.members) {
        usersInVoice.add(member.id);
      }
    }
    
    for (const row of rows) {
      const userId = row.user_id;
      if (!usersInVoice.has(userId)) {
        await decayPoints(userId, 'not in voice', client);
        log(`Applied point decay for user ${userId} not in voice.`);
      }
    }
  } catch (error) {
    logError(error, 'Applying Point Decay for Users Not in Voice');
  }
}

async function ensureAllMembersInDatabase(guildId, client) {
  try {
    const guild = await client.guilds.fetch(guildId);
    const members = await guild.members.fetch();
    
    for (const [, member] of members) {
      const userId = member.id;
      await client.dbPool.execute('INSERT IGNORE INTO user_points (user_id, points) VALUES (?, 0)', [userId]);
      log(`Ensured user ${userId} is in the database.`);
    }
  } catch (error) {
    logError(error, 'Ensuring All Members in Database');
  }
}

module.exports = {
  getTotal,
  updatePoints,
  decayPoints,
  manageRolesBasedOnPoints,
  checkAllVoiceChannelsForUsers,
  applyPointDecayForNotInVoice,
  ensureAllMembersInDatabase
};
