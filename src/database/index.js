const { pool, initializeDatabase } = require('./connection');
const voiceTimes = require('./voiceTimes');

module.exports = {
    pool,
    initializeDatabase,
    ...voiceTimes
};