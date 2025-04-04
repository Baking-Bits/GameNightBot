const { pool } = require('./connection');

async function ensureRaffleTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS raffle_tickets (
                user_id VARCHAR(255),
                guild_id VARCHAR(255),
                tickets INT DEFAULT 0,
                PRIMARY KEY (user_id, guild_id)
            )
        `);
    } catch (error) {
        console.error('Error ensuring raffle table exists:', error);
    }
}

async function grantTickets(userId, guildId, tickets) {
    try {
        await pool.query(`
            INSERT INTO raffle_tickets (user_id, guild_id, tickets)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE tickets = tickets + VALUES(tickets)
        `, [userId, guildId, tickets]);
    } catch (error) {
        console.error('Error granting tickets:', error);
    }
}

async function getUserTickets(userId, guildId) {
    try {
        const rows = await pool.query(`
            SELECT tickets
            FROM raffle_tickets
            WHERE user_id = ? AND guild_id = ?
        `, [userId, guildId]);
console.dir(rows); // Debug log
        return rows[0] ? rows[0].tickets : 0; // Return 0 if no tickets found
    } catch (error) {
        console.error('Error fetching user tickets:', error);
        throw error;
    }
}

async function getAllTickets(guildId) {
    try {
        const rows = await pool.query(`
            SELECT user_id, tickets
            FROM raffle_tickets
            WHERE guild_id = ?
            ORDER BY tickets DESC
        `, [guildId]);

        const ticketsMap = {};
        console.dir(rows); // Debug log
        rows.forEach(row => {
            ticketsMap[row.user_id] = row.tickets;
        });

        return ticketsMap;
    } catch (error) {
        console.error('Error fetching all tickets:', error);
        return {}; // Return an empty object on error
    }
}

async function removeTickets(userId, guildId, tickets) {
    try {
        const result = await pool.query(`
            UPDATE raffle_tickets
            SET tickets = tickets - ?
            WHERE user_id = ? AND guild_id = ? AND tickets >= ?
        `, [tickets, userId, guildId, tickets]);

        return result;
    } catch (error) {
        console.error('Error removing tickets:', error);
        throw error;
    }
}

module.exports = {
    ensureRaffleTable,
    grantTickets,
    getUserTickets,
    getAllTickets,
    removeTickets,
};