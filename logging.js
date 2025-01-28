const fs = require('fs');
const path = require('path');

function log(message, client) {
  const logDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }
  const logFile = path.join(logDir, 'bot.log');
  ensureLogFileExists(logFile);
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // Check and rotate log if necessary
  checkAndRotateLog(logFile, 10 * 1024 * 1024); // 10MB limit
  
  fs.appendFileSync(logFile, logMessage);
  console.log(logMessage);
  
  // Log to botConsoleChannelId if client is defined and fully initialized
  if (client && client.config && client.config.discord && client.config.discord.botConsoleChannelId) {
    logToBotConsoleChannel(logMessage, client);
  }
}

function logError(error, context, additionalInfo = null, client) {
  const logDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }
  const errorFile = path.join(logDir, 'errors.log');
  ensureLogFileExists(errorFile);
  const timestamp = new Date().toISOString();
  let errorMessage = `[${timestamp}] Error in ${context}: ${error.message}\n`;
  if (additionalInfo) {
    errorMessage += `Additional Info: ${JSON.stringify(additionalInfo)}\n`;
  }
  errorMessage += `Stack Trace: ${error.stack}\n`;
  
  // Check and rotate log if necessary
  checkAndRotateLog(errorFile, 10 * 1024 * 1024); // 10MB limit
  
  fs.appendFileSync(errorFile, errorMessage);
  console.error(errorMessage);
  
  // Log to botConsoleChannelId if client is defined and fully initialized
  if (client && client.config && client.config.discord && client.config.discord.botConsoleChannelId) {
    logToBotConsoleChannel(errorMessage, client);
  }
}

function watchLogs(client) {
  const logDir = path.join(__dirname, '../logs');
  const logFile = path.join(logDir, 'bot.log');
  const errorFile = path.join(logDir, 'errors.log');

  fs.watchFile(logFile, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.split('\n');
      const lastLine = lines[lines.length - 2]; // Last line might be empty due to newline
      if (lastLine && client && client.config && client.config.discord && client.config.discord.botConsoleChannelId) {
        client.channels.fetch(client.config.discord.botConsoleChannelId).then(channel => {
          if (channel) {
            channel.send(`\`\`\`\n${lastLine}\n\`\`\``);
          }
        }).catch(error => logError(error, 'Sending Log to Channel', null, client));
      }
    }
  });

  fs.watchFile(errorFile, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      const content = fs.readFileSync(errorFile, 'utf8');
      const lines = content.split('\n');
      const lastLine = lines[lines.length - 2]; // Last line might be empty due to newline
      if (lastLine && client && client.config && client.config.discord && client.config.discord.botConsoleChannelId) {
        client.channels.fetch(client.config.discord.botConsoleChannelId).then(channel => {
          if (channel) {
            channel.send(`\`\`\`\n${lastLine}\n\`\`\``);
          }
        }).catch(error => logError(error, 'Sending Error to Channel', null, client));
      }
    }
  });
}

async function logToBotConsoleChannel(message, client) {
  try {
    if (!client || !client.config || !client.config.discord || !client.config.discord.botConsoleChannelId) {
      console.error('Client or client configuration is not properly initialized');
      return;
    }
    const channel = await client.channels.fetch(client.config.discord.botConsoleChannelId);
    if (channel) {
      await channel.send(`\`\`\`\n${message}\n\`\`\``);
    } else {
      console.error(`Console log channel ${client.config.discord.botConsoleChannelId} not found.`);
    }
  } catch (error) {
    console.error('Error logging to botConsoleChannelId:', error);
  }
}

function checkAndRotateLog(filePath, maxSize) {
  const stats = fs.statSync(filePath);
  if (stats.size > maxSize) {
    const backupPath = filePath + '.bak';
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
    fs.renameSync(filePath, backupPath);
    fs.writeFileSync(filePath, '');
  }
}

function ensureLogFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '');
  }
}

module.exports = { log, logError, watchLogs, checkAndRotateLog };
