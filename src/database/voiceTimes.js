const { pool } = require('./connection');
const { formatHour, getPeriodOfDay } = require('../utils/timeFormatter');

async function updateVoiceTime(userId, guildId, timeSpent) {
    const timestamp = Date.now();
    try {
        await pool.query(`
            INSERT INTO voice_times (user_id, guild_id, total_time, timestamp)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE total_time = total_time + VALUES(total_time)
        `, [userId, guildId, timeSpent, timestamp]);
    } catch (error) {
        console.error('Error updating voice time:', error);
    }
}

async function getUserVoiceTime(userId, guildId, period = 'all') {
    let timeFilter = '';
    let params = [userId, guildId];

    switch(period.toLowerCase()) {
        case 'daily': {
            const now = new Date();
            const midnightCT = new Date(now);
            midnightCT.setHours(5, 0, 0, 0);
            if (now.getUTCHours() < 5) {
                midnightCT.setDate(midnightCT.getDate() - 1);
            }
            timeFilter = 'AND timestamp >= ?';
            params.push(midnightCT.getTime());
            break;
        }
        case 'weekly': {
            const today = new Date();
            const centralToday = getCentralTime(today);
            centralToday.setHours(0, 0, 0, 0);
            centralToday.setDate(centralToday.getDate() - centralToday.getDay());
            const centralWeekStartUTC = new Date(centralToday.getTime() + (5 * 60 * 60 * 1000));
            timeFilter = 'AND timestamp >= ?';
            params.push(centralWeekStartUTC.getTime());
            break;
        }
        case 'monthly': {
            const today = new Date();
            const centralToday = getCentralTime(today);
            const firstOfMonth = new Date(centralToday.getFullYear(), centralToday.getMonth(), 1);
            firstOfMonth.setHours(0, 0, 0, 0);
            timeFilter = 'AND timestamp >= ?';
            params.push(firstOfMonth.getTime());
            break;
        }
        case 'yearly': {
            const today = new Date();
            const centralToday = getCentralTime(today);
            const firstOfYear = new Date(centralToday.getFullYear(), 0, 1);
            firstOfYear.setHours(0, 0, 0, 0);
            timeFilter = 'AND timestamp >= ?';
            params.push(firstOfYear.getTime());
            break;
        }
    }

    const query = `
        SELECT COALESCE(SUM(total_time), 0) as total_time
        FROM voice_times
        WHERE user_id = ?
        AND guild_id = ?
        ${timeFilter}
    `;

    try {
        const result = await pool.query(query, params);
        return Number(result[0].total_time);
    } catch (error) {
        console.error('Error getting user voice time:', error);
        return 0;
    }
}

async function getLeaderboard(guildId, period = 'all') {
    let timeFilter = '';
    let params = [guildId];

    switch(period.toLowerCase()) {
        case 'daily': {
            const today = new Date();
            const centralMidnight = getCentralTime(today);
            centralMidnight.setHours(0, 0, 0, 0);
            timeFilter = 'AND timestamp >= ?';
            params.push(centralMidnight.getTime());
            break;
        }
        case 'weekly': {
            const today = new Date();
            const centralToday = getCentralTime(today);
            const monday = new Date(centralToday);
            monday.setDate(centralToday.getDate() - centralToday.getDay() + (centralToday.getDay() === 0 ? -6 : 1));
            monday.setHours(0, 0, 0, 0);
            timeFilter = 'AND timestamp >= ?';
            params.push(monday.getTime());
            break;
        }
        case 'monthly': {
            const today = new Date();
            const centralToday = getCentralTime(today);
            const firstOfMonth = new Date(centralToday.getFullYear(), centralToday.getMonth(), 1);
            firstOfMonth.setHours(0, 0, 0, 0);
            timeFilter = 'AND timestamp >= ?';
            params.push(firstOfMonth.getTime());
            break;
        }
        case 'yearly': {
            const today = new Date();
            const centralToday = getCentralTime(today);
            const firstOfYear = new Date(centralToday.getFullYear(), 0, 1);
            firstOfYear.setHours(0, 0, 0, 0);
            timeFilter = 'AND timestamp >= ?';
            params.push(firstOfYear.getTime());
            break;
        }
    }

    const query = `
        SELECT user_id, COALESCE(SUM(total_time), 0) as total_time
        FROM voice_times
        WHERE guild_id = ? ${timeFilter}
        GROUP BY user_id
        ORDER BY total_time DESC
        LIMIT 10
    `;

    try {
        const result = await pool.query(query, params);
        return result.map(row => ({
            user_id: row.user_id,
            total_time: Number(row.total_time)
        }));
    } catch (error) {
        console.error('Error getting leaderboard:', error);
        return [];
    }
}

async function getUserAverageTime(userId, guildId, period = 'all') {
    let timeFilter = '';
    let params = [userId, guildId];
    let periodStart;

    switch(period.toLowerCase()) {
        case 'daily': {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            timeFilter = 'AND timestamp >= ?';
            periodStart = startOfDay.getTime();
            params.push(periodStart);
            break;
        }
        case 'weekly': {
            const startOfWeek = new Date();
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            timeFilter = 'AND timestamp >= ?';
            periodStart = startOfWeek.getTime();
            params.push(periodStart);
            break;
        }
        case 'monthly': {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            timeFilter = 'AND timestamp >= ?';
            periodStart = startOfMonth.getTime();
            params.push(periodStart);
            break;
        }
        case 'yearly': {
            const startOfYear = new Date();
            startOfYear.setMonth(0, 1);
            startOfYear.setHours(0, 0, 0, 0);
            timeFilter = 'AND timestamp >= ?';
            periodStart = startOfYear.getTime();
            params.push(periodStart);
            break;
        }
    }

    const query = `
        SELECT
            COALESCE(SUM(total_time), 0) as total_time,
            MIN(timestamp) as first_record
        FROM voice_times
        WHERE user_id = ?
        AND guild_id = ?
        ${timeFilter}
    `;

    try {
        const result = await pool.query(query, params);
        console.log('Query result:', result);

        const totalTimeBigInt = result[0].total_time;
        console.log('Total time (BigInt):', totalTimeBigInt);

        const totalTime = Number(totalTimeBigInt) || 0;
        console.log('Total time (Number):', totalTime);

        const firstRecordBigInt = result[0].first_record || BigInt(Date.now());
        console.log('First record timestamp (BigInt):', firstRecordBigInt);

        const firstRecord = Number(firstRecordBigInt);
        console.log('First record timestamp (Number):', firstRecord);

        let numberOfPeriods = 1;

        switch(period.toLowerCase()) {
            case 'daily':
                numberOfPeriods = Math.max(1, Math.ceil((Date.now() - firstRecord) / (24 * 60 * 60 * 1000)));
                break;
            case 'weekly':
                numberOfPeriods = Math.max(1, Math.ceil((Date.now() - firstRecord) / (7 * 24 * 60 * 60 * 1000)));
                break;
            case 'monthly':
                const firstDate = new Date(firstRecord);
                const currentDate = new Date(Date.now());
                numberOfPeriods = Math.max(1,
                    (currentDate.getFullYear() - firstDate.getFullYear()) * 12 +
                    (currentDate.getMonth() - firstDate.getMonth()) + 1);
                break;
            case 'yearly':
                const firstYear = new Date(firstRecord);
                const currentYear = new Date(Date.now());
                numberOfPeriods = Math.max(1, currentYear.getFullYear() - firstYear.getFullYear() + 1);
                break;
        }

        console.log('Number of periods:', numberOfPeriods);

        return totalTime / numberOfPeriods;
    } catch (error) {
        console.error('Error getting user average time:', error);
        return 0;
    }
}

async function getActivitySchedule(userId, guildId) {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    const dayQuery = `
        SELECT
            CAST(DAYOFWEEK(FROM_UNIXTIME((timestamp/1000) - (5 * 3600))) AS INTEGER) - 1 as day_of_week,
            SUM(total_time) as total_time
        FROM voice_times
        WHERE user_id = ?
        AND guild_id = ?
        AND timestamp >= ?
        GROUP BY day_of_week
        ORDER BY total_time DESC
    `;
    const hourQuery = `
        SELECT
            CAST(HOUR(FROM_UNIXTIME((timestamp/1000) - (5 * 3600))) AS INTEGER) as hour,
            SUM(total_time) as total_time
        FROM voice_times
        WHERE user_id = ?
        AND guild_id = ?
        AND timestamp >= ?
        GROUP BY hour
        ORDER BY hour ASC
    `;

    try {
        const dayResults = await pool.query(dayQuery, [userId, guildId, thirtyDaysAgo]);
        const hourResults = await pool.query(hourQuery, [userId, guildId, thirtyDaysAgo]);

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const mostActiveDay = days[dayResults[0]?.day_of_week || 0];
        const isWeekendActive = dayResults.some(d => (d.day_of_week === 0 || d.day_of_week === 6) && d.total_time > 0);

        let peakStart = hourResults.reduce((max, curr) =>
            curr.total_time > (hourResults[max]?.total_time || 0) ? curr.hour : max,
            0
        );
        let peakEnd = (peakStart + 1) % 24;

        return {
            mostActive: isWeekendActive ? "Weekends" : "Weekdays",
            peakHours: `${formatHour(peakStart)}-${formatHour(peakEnd)} CT`,
            leastActive: getPeriodOfDay(hourResults.slice(-3).map(h => h.hour)),
            hourlyData: hourResults,
            dailyData: dayResults
        };
    } catch (error) {
        console.error('Error getting activity schedule:', error);
        return {
            mostActive: "Unknown",
            peakHours: "Unknown",
            leastActive: "Unknown",
            hourlyData: [],
            dailyData: []
        };
    }
}

async function getOptimalTime(guildId) {
    const query = `
        SELECT
            CAST(HOUR(FROM_UNIXTIME(timestamp/1000)) AS INTEGER) as hour,
            COUNT(DISTINCT user_id) as unique_users,
            SUM(total_time) as total_time
        FROM voice_times
        WHERE guild_id = ?
        GROUP BY hour
        ORDER BY unique_users DESC, total_time DESC
    `;

    try {
        return await pool.query(query, [guildId]);
    } catch (error) {
        console.error('Error getting optimal time:', error);
        return [];
    }
}

async function getServerActivitySchedule(guildId) {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    const hourQuery = `
        SELECT
            CAST(HOUR(FROM_UNIXTIME((timestamp/1000) - (5 * 3600))) AS INTEGER) as hour,
            SUM(total_time) as total_time,
            COUNT(DISTINCT user_id) as unique_users
        FROM voice_times
        WHERE guild_id = ?
        AND timestamp >= ?
        GROUP BY hour
        ORDER BY hour ASC
    `;
    const dayQuery = `
        SELECT
            CAST(DAYOFWEEK(FROM_UNIXTIME((timestamp/1000) - (5 * 3600))) AS INTEGER) - 1 as day_of_week,
            SUM(total_time) as total_time,
            COUNT(DISTINCT user_id) as unique_users
        FROM voice_times
        WHERE guild_id = ?
        AND timestamp >= ?
        GROUP BY day_of_week
        ORDER BY day_of_week ASC
    `;
    const statsQuery = `
        SELECT
            COUNT(DISTINCT user_id) as total_users,
            SUM(total_time) as total_time
        FROM voice_times
        WHERE guild_id = ?
        AND timestamp >= ?
    `;
    const avgDailyQuery = `
        SELECT COUNT(DISTINCT user_id) as users
        FROM voice_times
        WHERE guild_id = ?
        AND timestamp >= ?
        GROUP BY DATE(FROM_UNIXTIME((timestamp/1000) - (5 * 3600)))
    `;

    try {
        const hourResults = await pool.query(hourQuery, [guildId, thirtyDaysAgo]);
        const dayResults = await pool.query(dayQuery, [guildId, thirtyDaysAgo]);
        const stats = await pool.query(statsQuery, [guildId, thirtyDaysAgo]);
        const dailyUsers = await pool.query(avgDailyQuery, [guildId, thirtyDaysAgo]);

        const avgDailyUsers = Math.round(dailyUsers.reduce((sum, day) => sum + day.users, 0) / dailyUsers.length) || 0;
        const peakHour = hourResults.reduce((max, curr) =>
            curr.total_time > max.total_time ? curr : max,
            { total_time: 0 }
        );
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const mostActiveDay = dayResults.reduce((max, curr) =>
            curr.total_time > max.total_time ? curr : max,
            { total_time: 0 }
        );

        return {
            hourlyData: hourResults,
            dailyData: dayResults,
            totalUsers: stats[0].total_users || 0,
            totalTime: Number(stats[0].total_time) || 0,
            avgDailyUsers,
            peakHours: `${formatHour(peakHour.hour)} CT`,
            mostActive: days[mostActiveDay.day_of_week] || 'Unknown',
        };
    } catch (error) {
        console.error('Error getting server activity schedule:', error);
        return {
            hourlyData: [],
            dailyData: [],
            totalUsers: 0,
            totalTime: 0,
            avgDailyUsers: 0,
            peakHours: "Unknown",
            mostActive: "Unknown"
        };
    }
}

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
        const [rows] = await pool.query(`
            SELECT tickets
            FROM raffle_tickets
            WHERE user_id = ? AND guild_id = ?
        `, [userId, guildId]);

        return rows.length > 0 ? rows[0].tickets : null;
    } catch (error) {
        console.error('Error fetching user tickets:', error);
        throw error;
    }
}

async function getAllTickets(guildId) {
    try {
        const [rows] = await pool.query(`
            SELECT user_id, tickets
            FROM raffle_tickets
            WHERE guild_id = ?
            ORDER BY tickets DESC
        `, [guildId]);

        const ticketsMap = {};
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

function getCentralTime(date) {
    const utcDate = new Date(date);
    utcDate.setHours(utcDate.getHours() + 5);
    return utcDate;
}

module.exports = {
    updateVoiceTime,
    getUserVoiceTime,
    getLeaderboard,
    getUserAverageTime,
    getActivitySchedule,
    getOptimalTime,
    getServerActivitySchedule,
    getCentralTime,
    ensureRaffleTable,
    grantTickets,
    getUserTickets,
    getAllTickets,
    removeTickets,
};
