const { log, logError } = require('./logging.js');

async function checkRecentRestartAttempts(client) {
  try {
    if (!client || !client.channels || !client.users || !client.guilds) {
      throw new Error('Client or client properties are not properly initialized');
    }

    const channel = await client.channels.fetch(client.config.discord.botLogChannelId);
    if (!channel) {
      throw new Error(`Log channel with ID ${client.config.discord.botLogChannelId} not found.`);
    }
    
    const [rows] = await client.dbPool.execute('SELECT * FROM restart_attempts WHERE timestamp > NOW() - INTERVAL 1 HOUR');
    if (rows.length > 0) {
      log(`Found ${rows.length} recent restart attempts within the last hour.`);
      const lastAttempt = rows[rows.length - 1];
      const userId = lastAttempt.user_id;
      const user = await client.users.fetch(userId);
      if (user) {
        const restartChannel = await client.channels.fetch(lastAttempt.channel_id);
        if (restartChannel) {
          await restartChannel.send(`<@${userId}>, the bot has been restarted successfully.`);
        }
      }
    } else {
      log('No recent restart attempts found within the last hour.');
    }

  } catch (error) {
    logError(error, 'Checking Recent Restart Attempts');
    throw error;
  }
}

async function restartBot(isWorking, client) {
  try {
    log(`Bot is ${isWorking ? 'working' : 'broken'} before restart.`);

    log('Preparing to signal systemd for restart...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    const { exec } = require('child_process');
    exec('sudo systemctl restart discordbot.service', (error, stdout, stderr) => {
      if (error) {
        logError(error, 'Restarting Service');
        return;
      }
      log('Service restart command issued.');
      if (stderr) {
        log(`stderr from restart command: ${stderr}`);
      }
      if (stdout) {
        log(`stdout from restart command: ${stdout}`);
      }
    });

    // Log the restart attempt
    await client.dbPool.execute('INSERT INTO restart_attempts (user_id, channel_id, timestamp) VALUES (?, ?, NOW())', [client.user.id, client.config.discord.botLogChannelId]);

  } catch (error) {
    logError(error, 'Restarting Bot');
  }
}

module.exports = { checkRecentRestartAttempts, restartBot };
