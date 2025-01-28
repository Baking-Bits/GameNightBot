const { log } = require('./logging.js');

let voiceActivityIntervals = new Map();

function startVoicePointUpdate(userId, member, client) {
  if (!voiceActivityIntervals.has(userId)) {
    voiceActivityIntervals.set(userId, setInterval(async () => {
      const pointsToEarn = client.config.botSettings.earnRate;
      if (!member.roles.cache.has(client.config.botSettings.excludedRoles[0])) {
        await updatePoints(userId, 'voice', pointsToEarn, client);
      }
    }, 60000)); // Update every minute
    log(`Started voice point update for user ${userId}`);
  }
}

function stopVoicePointUpdate(userId) {
  const intervalId = voiceActivityIntervals.get(userId);
  if (intervalId) {
    clearInterval(intervalId);
    voiceActivityIntervals.delete(userId);
    log(`Stopped voice point update for user ${userId}`);
  }
}

module.exports = { startVoicePointUpdate, stopVoicePointUpdate };
