const { pool, initializeDatabase } = require('./connection');
const voiceTimes = require('./voiceTimes');
const raffle = require('./raffle');
const eventRole = require('./eventRole');

module.exports = {
    pool,
    initializeDatabase,
    ...voiceTimes,
    ...raffle,
    ...eventRole,
};