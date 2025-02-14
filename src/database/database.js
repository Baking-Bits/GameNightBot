const mariadb = require('mariadb');
const { mariadb: config } = require('../../config.json');
const { formatHour, getPeriodOfDay } = require('../utils/timeFormatter');

class VoiceDatabase {
    constructor() {
        this.pool = mariadb.createPool({
            host: config.host,
            user: config.user,
            password: config.password,
            database: config.database,
            connectionLimit: 5
        });
        this.initializeDatabase();
    }

    async initializeDatabase() {
        try {
            await this.pool.query(`
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

    async updateVoiceTime(userId, guildId, timeSpent) {
        const timestamp = Date.now();
        try {
            await this.pool.query(`
                INSERT INTO voice_times (user_id, guild_id, total_time, timestamp)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE total_time = total_time + VALUES(total_time)
            `, [userId, guildId, timeSpent, timestamp]);
        } catch (error) {
            console.error('Error updating voice time:', error);
        }
    }

    async getUserVoiceTime(userId, guildId, period = 'all') {
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
                const centralToday = this.getCentralTime(today);
                centralToday.setHours(0, 0, 0, 0);
                centralToday.setDate(centralToday.getDate() - centralToday.getDay());
                const centralWeekStartUTC = new Date(centralToday.getTime() + (5 * 60 * 60 * 1000));
                timeFilter = 'AND timestamp >= ?';
                params.push(centralWeekStartUTC.getTime());
                break;
            }
            case 'monthly': {
                const today = new Date();
                const centralToday = this.getCentralTime(today);
                const firstOfMonth = new Date(centralToday.getFullYear(), centralToday.getMonth(), 1);
                firstOfMonth.setHours(0, 0, 0, 0);
                timeFilter = 'AND timestamp >= ?';
                params.push(firstOfMonth.getTime());
                break;
            }
            case 'yearly': {
                const today = new Date();
                const centralToday = this.getCentralTime(today);
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
            const result = await this.pool.query(query, params);
            return result[0].total_time;
        } catch (error) {
            console.error('Error getting user voice time:', error);
            return 0;
        }
    }

    async getLeaderboard(guildId, period = 'all') {
        let timeFilter = '';
        let params = [guildId];
        
        switch(period.toLowerCase()) {
            case 'daily': {
                const today = new Date();
                const centralMidnight = this.getCentralTime(today);
                centralMidnight.setHours(0, 0, 0, 0);
                timeFilter = 'AND timestamp >= ?';
                params.push(centralMidnight.getTime());
                break;
            }
            case 'weekly': {
                const today = new Date();
                const centralToday = this.getCentralTime(today);
                const monday = new Date(centralToday);
                monday.setDate(centralToday.getDate() - centralToday.getDay() + (centralToday.getDay() === 0 ? -6 : 1));
                monday.setHours(0, 0, 0, 0);
                timeFilter = 'AND timestamp >= ?';
                params.push(monday.getTime());
                break;
            }
            case 'monthly': {
                const today = new Date();
                const centralToday = this.getCentralTime(today);
                const firstOfMonth = new Date(centralToday.getFullYear(), centralToday.getMonth(), 1);
                firstOfMonth.setHours(0, 0, 0, 0);
                timeFilter = 'AND timestamp >= ?';
                params.push(firstOfMonth.getTime());
                break;
            }
            case 'yearly': {
                const today = new Date();
                const centralToday = this.getCentralTime(today);
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
            return await this.pool.query(query, params);
        } catch (error) {
            console.error('Error getting leaderboard:', error);
            return [];
        }
    }

    async getUserAverageTime(userId, guildId, period = 'all') {
        let timeFilter = '';
        let params = [userId, guildId];
        let periodStart;
        
        switch(period.toLowerCase()) {
            case 'daily': {
                const startOfYear = new Date();
                startOfYear.setMonth(0, 1);
                startOfYear.setHours(0, 0, 0, 0);
                timeFilter = 'AND timestamp >= ?';
                periodStart = startOfYear.getTime();
                params.push(periodStart);
                break;
            }
            case 'weekly': {
                const startOfYear = new Date();
                startOfYear.setMonth(0, 1);
                startOfYear.setHours(0, 0, 0, 0);
                timeFilter = 'AND timestamp >= ?';
                periodStart = startOfYear.getTime();
                params.push(periodStart);
                break;
            }
            case 'monthly': {
                const startOfYear = new Date();
                startOfYear.setMonth(0, 1);
                startOfYear.setHours(0, 0, 0, 0);
                timeFilter = 'AND timestamp >= ?';
                periodStart = startOfYear.getTime();
                params.push(periodStart);
                break;
            }
            case 'yearly': {
                const startOfData = new Date(2020, 0, 1);
                startOfData.setHours(0, 0, 0, 0);
                timeFilter = 'AND timestamp >= ?';
                periodStart = startOfData.getTime();
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
            const result = await this.pool.query(query, params);
            const totalTime = result[0].total_time || 0;
            const firstRecord = result[0].first_record || Date.now();
            
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
            
            return Math.floor(totalTime / numberOfPeriods);
        } catch (error) {
            console.error('Error getting user average time:', error);
            return 0;
        }
    }

    async getActivitySchedule(userId, guildId) {
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
            const dayResults = await this.pool.query(dayQuery, [userId, guildId, thirtyDaysAgo]);
            const hourResults = await this.pool.query(hourQuery, [userId, guildId, thirtyDaysAgo]);
            
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

    async getOptimalTime(guildId) {
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
            return await this.pool.query(query, [guildId]);
        } catch (error) {
            console.error('Error getting optimal time:', error);
            return [];
        }
    }

    async getServerActivitySchedule(guildId) {
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
            const hourResults = await this.pool.query(hourQuery, [guildId, thirtyDaysAgo]);
            const dayResults = await this.pool.query(dayQuery, [guildId, thirtyDaysAgo]);
            const stats = await this.pool.query(statsQuery, [guildId, thirtyDaysAgo]);
            const dailyUsers = await this.pool.query(avgDailyQuery, [guildId, thirtyDaysAgo]);
            
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
                totalTime: stats[0].total_time || 0,
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

    getCentralTime(date) {
        const utcDate = new Date(date);
        utcDate.setHours(utcDate.getHours() + 5);
        return utcDate;
    }
}

module.exports = VoiceDatabase;
