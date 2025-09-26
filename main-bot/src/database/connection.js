const mariadb = require('mariadb');
const { mariadb: config } = require('../../../config.json');

const pool = mariadb.createPool({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: 5
});

async function initializeDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS voice_times (
                user_id VARCHAR(255),
                guild_id VARCHAR(255),
                total_time BIGINT DEFAULT 0,
                timestamp BIGINT,
                PRIMARY KEY (user_id, guild_id, timestamp)
            )
        `);
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

module.exports = { pool, initializeDatabase };