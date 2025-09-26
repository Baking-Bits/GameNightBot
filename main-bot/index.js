const VoiceTimeTracker = require('./src/bot');
const { token, statusUpdateInterval } = require('../config.json');

const bot = new VoiceTimeTracker();
if (statusUpdateInterval) {
    bot.statusUpdateInterval = statusUpdateInterval;
}
bot.login(token);
