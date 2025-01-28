const { Client, GatewayIntentBits, Collection, Events, SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { log, logError, watchLogs, checkAndRotateLog } = require('./logging.js');
const { getDbConnectionPool } = require('./database.js');
const { backupCode } = require('./backup.js');
const { getTotal, updatePoints, decayPoints, manageRolesBasedOnPoints, checkAllVoiceChannelsForUsers, applyPointDecayForNotInVoice, ensureAllMembersInDatabase } = require('./pointsManagement.js');
const commands = require('./commands.js');
const { syncUserData } = require('./syncUserPoints.js');
const { startVoicePointUpdate, stopVoicePointUpdate } = require('./voiceActivity.js');

const config = require('./config/config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers
  ]
});

client.commands = new Collection();
client.userPoints = new Map();
client.dbFunctions = { getTotal };

const reactedMessages = new Map();
const voiceActivity = new Map();

// Event listener for message creation
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  const userId = message.author.id;
  
  if (message.member.roles.cache.has(config.botSettings.excludedRoles[0])) return;

  if (message.channel.id === config.botSettings.noPointChannelId) {
    await decayPoints(userId, message.channel.id);
    log(`User ${message.author.tag} lost points for sending a message in no-point channel.`, client);
    logToBotLogChannel(`User ${message.author.tag} lost points for sending a message in no-point channel.`, client);
  } else {
    await updatePoints(userId, 'message', config.botSettings.pointsPerMessage);
    log(`User ${message.author.tag} earned ${config.botSettings.pointsPerMessage} points for sending a message.`, client);
    logToBotLogChannel(`User ${message.author.tag} earned ${config.botSettings.pointsPerMessage} points for sending a message.`, client);
  }
});

// Event listener for message reaction addition
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  const userId = reaction.message.author.id;
  const reactorId = user.id;
  
  if (userId !== reactorId) {
    const messageId = reaction.message.id;
    
    if (!reactedMessages.has(messageId)) {
      reactedMessages.set(messageId, new Set());
    }
    if (!reactedMessages.get(messageId).has(reactorId)) {
      if (!reaction.message.member.roles.cache.has(config.botSettings.excludedRoles[0])) {
        await updatePoints(userId, 'reaction', config.botSettings.pointsPerReaction);
        reactedMessages.get(messageId).add(reactorId);
        log(`User ${reaction.message.author.tag} earned ${config.botSettings.pointsPerReaction} points for reaction from ${user.tag}.`, client);
        logToBotLogChannel(`User ${reaction.message.author.tag} earned ${config.botSettings.pointsPerReaction} points for reaction from ${user.tag}.`, client);
      }
    }
  }
});

// Event listener for voice state updates
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const userId = newState.member.id;
  const userName = newState.member.user.tag;
  
  if (oldState.channelId === null && newState.channelId !== null) {
    voiceActivity.set(userId, Date.now());
    log(`${userName} joined voice channel: ${newState.channel.name}. Current points: ${await getTotal(userId)}`, client);
    logToBotLogChannel(`${userName} joined voice channel: ${newState.channel.name}. Current points: ${await getTotal(userId)}`, client);
    startVoicePointUpdate(userId, newState.member);
  }
  
  if (oldState.channelId !== null && newState.channelId === null) {
    const startTime = voiceActivity.get(userId);
    if (startTime) {
      const endTime = Date.now();
      const durationInMinutes = (endTime - startTime) / 60000;
      const pointsToEarn = Math.floor(durationInMinutes * config.botSettings.earnRate * 100) / 100;
      
      if (!newState.member.roles.cache.has(config.botSettings.excludedRoles[0])) {
        await updatePoints(userId, 'voice', pointsToEarn);
      }
      
      voiceActivity.delete(userId);
      stopVoicePointUpdate(userId);
      log(`${userName} left voice channel: ${oldState.channel.name}. Earned ${pointsToEarn.toFixed(2)} points. Current points: ${await getTotal(userId)}`, client);
      logToBotLogChannel(`${userName} left voice channel: ${oldState.channel.name}. Earned ${pointsToEarn.toFixed(2)} points. Current points: ${await getTotal(userId)}`, client);
    }
  }
  
  if (oldState.channelId !== null && newState.channelId !== null && oldState.channelId !== newState.channelId) {
    log(`${userName} changed from voice channel: ${oldState.channel.name} to ${newState.channel.name}. Current points: ${await getTotal(userId)}`, client);
    logToBotLogChannel(`${userName} changed from voice channel: ${oldState.channel.name} to ${newState.channel.name}. Current points: ${await getTotal(userId)}`, client);
  }
});

// Event listener for when the client is ready
client.once(Events.ClientReady, async (c) => {
  log(`Ready! Logged in as ${c.user.tag}`, client);

  try {
    // Check if the configuration is correct
    if (!config.discord || !config.discord.guildIds || config.discord.guildIds.length === 0) {
      throw new Error('Guild ID configuration is missing or incorrect');
    }

    // Clear all existing guild commands
    const rest = new REST({ version: '10' }).setToken(config.discord.token);
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, config.discord.guildIds[0]), 
      { body: [] }
    );
    log('Successfully deleted all guild commands.', client);

    // Clear all existing global commands
    await rest.put(
      Routes.applicationCommands(client.user.id), 
      { body: [] }
    );
    log('Successfully deleted all global commands.', client);

    // Register commands after bot is ready to ensure we have client.user.id
    const commandsArray = Object.values(commands);
    const commandsData = commandsArray.map(command => command.data.toJSON());

    await rest.put(
      Routes.applicationGuildCommands(client.user.id, config.discord.guildIds[0]),
      { body: commandsData }
    );
    log('New guild-specific commands registered for guild.', client);
    
    // Start watching logs
    watchLogs(client);

    // Sync user data initially when the bot starts
    await syncUserData(config.mariadb, client);

    // After initial sync, perform a check for all current guild members
    await ensureAllMembersInDatabase(config.discord.guildIds[0]);

    // Check for recent restart attempts
    const { checkRecentRestartAttempts } = require('./restart.js');
    await checkRecentRestartAttempts(client);

    // Check all voice channels in the guild for users and start updating points
    await checkAllVoiceChannelsForUsers(client);

    // Apply point decay for users not in voice channels
    await applyPointDecayForNotInVoice(client);

    // Notify in the log channel that the bot is online
    const channel = await client.channels.fetch(config.discord.botLogChannelId);
    if (channel) {
      await channel.send(`Bot **${client.user.tag}** is now online and has completed initial operations.`);
      log(`Notified user in bot log channel ${config.discord.botLogChannelId} that the bot is back online and initial operations are complete.`, client);
    } else {
      log(`Log channel ${config.discord.botLogChannelId} not found.`, client);
    }
  } catch (error) {
    logError(error, 'Bot Initialization', null, client);
    // Exit the process if initialization fails
    process.exit(1);
  }
});

// Event listener for interaction creation
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    log(`No command matching ${interaction.commandName} was found.`, client);
    return;
  }

  logToBotLogChannel(`User ${interaction.user.id} attempted to use the /${interaction.commandName} command.`, client);
  try {
    console.log(`Executing command: ${interaction.commandName}`);
    if (interaction.commandName === 'restart') {
      await command.execute(interaction, client);
      // Delay sending the restart notification until after the bot has fully restarted
      setTimeout(() => sendRestartNotification(interaction), 15000);
    } else {
      await command.execute(interaction, client);
    }
    console.log(`Command ${interaction.commandName} executed successfully.`);
  } catch (error) {
    logError(error, `Executing ${interaction.commandName} command for user ${interaction.user.id}`, null, client);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    } else {
      await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
    }
  }
});

// Initialize the bot
async function init() {
  try {
    // Log configuration loading
    log('Configuration loaded successfully.', client);

    // Attach config to client
    client.config = config;

    // Ensure saves directory exists on boot
    const rootDir = path.resolve(__dirname);
    const saveDir = path.join(rootDir, 'saves');
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir);
    }
    log(`Ensured /saves directory exists: ${saveDir}`, client);

    // Create a startup backup
    const startupBackupPath = await backupCode(false);
    log(`Startup backup created at: ${startupBackupPath}`, client);

    // Establish database connection
    try {
      client.dbPool = await getDbConnectionPool(client.config.mariadb);
    } catch (dbError) {
      logError(dbError, 'Failed to establish database connection', null, client);
      process.exit(1);
    }

    // Start the bot with retry mechanism
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 5000; // 5 seconds

    while (retryCount < maxRetries) {
      try {
        await client.login(client.config.discord.token);
        log(`Logged in as ${client.user.tag}!`, client);
        logToBotLogChannel(`Bot **${client.user.tag}** has successfully booted.`, client);
        break; // Exit loop if login is successful
      } catch (loginError) {
        retryCount++;
        logError(loginError, `Failed to log in to Discord (Attempt ${retryCount}/${maxRetries})`, null, client);
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          logError(loginError, 'Max retries reached. Exiting.', null, client);
          process.exit(1);
        }
      }
    }
    
    // Increase the delay to ensure the bot is fully ready
    await new Promise(resolve => setTimeout(resolve, 15000)); // 15-second delay

    // Check for recent restart attempts
    try {
      const { checkRecentRestartAttempts } = require('./restart.js');
      await checkRecentRestartAttempts(client);
      logToBotLogChannel(`Bot **${client.user.tag}** is checking for recent restart attempts.`, client);
    } catch (restartError) {
      logError(restartError, 'Error checking recent restart attempts', null, client);
    }

    // Add commands to the client
    client.commands.set('points', commands.pointsCommand);
    client.commands.set('restart', commands.restartCommand);
    client.commands.set('leaderboard', commands.leaderboardCommand);
    client.commands.set('broadcast', commands.broadcastCommand);

    // Check all voice channels in the guild for users and start updating their points
    try {
      await checkAllVoiceChannelsForUsers(client);
    } catch (voiceError) {
      logError(voiceError, 'Error checking voice channels for users', null, client);
    }

    // Apply point decay for users not in voice channels
    try {
      await applyPointDecayForNotInVoice(client);
    } catch (decayError) {
      logError(decayError, 'Error applying point decay for users not in voice channels', null, client);
    }

    // Sync user data initially when the bot starts
    try {
      await syncUserData(config.mariadb, client);
    } catch (syncError) {
      logError(syncError, 'Error synchronizing user data', null, client);
    }

  } catch (error) {
    logError(error, 'Initialization failed', null, client);
    process.exit(1);
  }
}

// Add global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logError(reason, 'Unhandled Rejection', promise, client);
});

// Function to log to botLogChannelId
async function logToBotLogChannel(message, client) {
  try {
    const channel = await client.channels.fetch(config.discord.botLogChannelId);
    if (channel) {
      await channel.send(message);
    } else {
      log(`Log channel ${config.discord.botLogChannelId} not found.`, client);
    }
  } catch (error) {
    logError(error, 'Error logging to botLogChannelId', null, client);
  }
}

// Start the bot
init();

// New function to send restart notification
async function sendRestartNotification(interaction) {
  try {
    await interaction.followUp({
      content: `GameNightBot is now online and has completed initial operations.`,
      ephemeral: true
    });
  } catch (error) {
    logError(error, 'Error sending restart notification', null, client);
  }
}
