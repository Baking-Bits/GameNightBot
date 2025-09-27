const { pool } = require('./connection');

async function initializeWeatherDatabase() {
    try {
        // Weather users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS weather_users (
                user_id VARCHAR(255) PRIMARY KEY,
                discord_user_id VARCHAR(255) NOT NULL,
                display_name VARCHAR(255) NOT NULL,
                postal_code VARCHAR(20) NOT NULL,
                city VARCHAR(255),
                country VARCHAR(10),
                region VARCHAR(255),
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_weather_check TIMESTAMP NULL,
                is_active BOOLEAN DEFAULT TRUE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                admin_added BOOLEAN DEFAULT FALSE,
                added_by VARCHAR(255) NULL,
                reactivated_at TIMESTAMP NULL,
                reactivated_by VARCHAR(255) NULL,
                removed_at TIMESTAMP NULL,
                country_code VARCHAR(10) NULL,
                INDEX idx_active (is_active),
                INDEX idx_last_check (last_weather_check),
                INDEX idx_region (region)
            )
        `);

        // Weather history table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS weather_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                temperature DECIMAL(5,2),
                feels_like DECIMAL(5,2),
                humidity INT,
                wind_speed DECIMAL(5,2),
                weather_main VARCHAR(100),
                weather_description VARCHAR(255),
                city VARCHAR(255),
                country VARCHAR(10),
                INDEX idx_user_timestamp (user_id, timestamp),
                INDEX idx_timestamp (timestamp),
                FOREIGN KEY (user_id) REFERENCES weather_users(user_id) ON DELETE CASCADE
            )
        `);

        // Shitty weather scores table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS shitty_weather_scores (
                user_id VARCHAR(255) PRIMARY KEY,
                total_points INT DEFAULT 0,
                last_award_date TIMESTAMP NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES weather_users(user_id) ON DELETE CASCADE
            )
        `);

        // Shitty weather awards history
        await pool.query(`
            CREATE TABLE IF NOT EXISTS shitty_weather_awards (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                score INT NOT NULL,
                points_awarded INT NOT NULL,
                temperature DECIMAL(5,2),
                weather_description VARCHAR(255),
                wind_speed DECIMAL(5,2),
                humidity INT,
                breakdown JSON,
                INDEX idx_user_timestamp (user_id, timestamp),
                INDEX idx_timestamp (timestamp),
                FOREIGN KEY (user_id) REFERENCES weather_users(user_id) ON DELETE CASCADE
            )
        `);

        // Weather alerts table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS weather_alerts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                alert_type VARCHAR(100) NOT NULL,
                alert_message TEXT,
                severity VARCHAR(50),
                INDEX idx_user_timestamp (user_id, timestamp),
                INDEX idx_timestamp (timestamp),
                FOREIGN KEY (user_id) REFERENCES weather_users(user_id) ON DELETE CASCADE
            )
        `);

        // Lightning events table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS lightning_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                intensity VARCHAR(50),
                points INT,
                description VARCHAR(255),
                INDEX idx_user_timestamp (user_id, timestamp),
                INDEX idx_timestamp (timestamp),
                FOREIGN KEY (user_id) REFERENCES weather_users(user_id) ON DELETE CASCADE
            )
        `);

        // API usage tracking table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS weather_api_usage (
                id INT AUTO_INCREMENT PRIMARY KEY,
                date DATE NOT NULL,
                calls_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_date (date)
            )
        `);

        console.log('[WEATHER DB] Weather database tables initialized successfully');
    } catch (error) {
        console.error('[WEATHER DB] Error initializing weather database:', error);
        throw error;
    }
}

// Weather User Management Functions
async function addWeatherUser(userData) {
    try {
        const result = await pool.query(`
            INSERT INTO weather_users (
                user_id, discord_user_id, display_name, postal_code, 
                city, country, region, admin_added, added_by, country_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                display_name = VALUES(display_name),
                postal_code = VALUES(postal_code),
                city = VALUES(city),
                country = VALUES(country),
                region = VALUES(region),
                is_active = TRUE,
                updated_at = CURRENT_TIMESTAMP,
                reactivated_at = IF(is_active = FALSE, CURRENT_TIMESTAMP, reactivated_at),
                reactivated_by = IF(is_active = FALSE, VALUES(added_by), reactivated_by),
                removed_at = NULL
        `, [
            userData.user_id,
            userData.discord_user_id,
            userData.display_name,
            userData.postal_code,
            userData.city,
            userData.country,
            userData.region,
            userData.admin_added || false,
            userData.added_by || null,
            userData.country_code || null
        ]);
        
        return result;
    } catch (error) {
        console.error('[WEATHER DB] Error adding weather user:', error);
        throw error;
    }
}

async function getWeatherUser(userId) {
    try {
        const result = await pool.query(
            'SELECT * FROM weather_users WHERE user_id = ?',
            [userId]
        );
        return result[0] || null;
    } catch (error) {
        console.error('[WEATHER DB] Error getting weather user:', error);
        throw error;
    }
}

async function getAllActiveWeatherUsers() {
    try {
        const result = await pool.query(
            'SELECT * FROM weather_users WHERE is_active = TRUE ORDER BY joined_at'
        );
        return result;
    } catch (error) {
        console.error('[WEATHER DB] Error getting active weather users:', error);
        throw error;
    }
}

async function removeWeatherUser(userId) {
    try {
        const result = await pool.query(`
            UPDATE weather_users 
            SET is_active = FALSE, removed_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        `, [userId]);
        
        return result.affectedRows > 0;
    } catch (error) {
        console.error('[WEATHER DB] Error removing weather user:', error);
        throw error;
    }
}

// Weather History Functions
async function addWeatherHistory(userId, weatherData) {
    try {
        const result = await pool.query(`
            INSERT INTO weather_history (
                user_id, temperature, feels_like, humidity, wind_speed,
                weather_main, weather_description, city, country
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            userId,
            weatherData.temperature,
            weatherData.feels_like,
            weatherData.humidity,
            weatherData.wind_speed,
            weatherData.weather_main,
            weatherData.weather_description,
            weatherData.city,
            weatherData.country
        ]);
        
        return result;
    } catch (error) {
        console.error('[WEATHER DB] Error adding weather history:', error);
        throw error;
    }
}

// Shitty Weather Functions
async function getShittyWeatherLeaderboard(limit = 50) {
    try {
        const result = await pool.query(`
            SELECT 
                sws.user_id,
                wu.display_name,
                wu.region,
                sws.total_points,
                wu.is_active
            FROM shitty_weather_scores sws
            JOIN weather_users wu ON sws.user_id = wu.user_id
            WHERE wu.is_active = TRUE
            ORDER BY sws.total_points DESC
            LIMIT ?
        `, [limit]);
        
        return result;
    } catch (error) {
        console.error('[WEATHER DB] Error getting shitty weather leaderboard:', error);
        throw error;
    }
}

async function updateShittyWeatherScore(userId, pointsToAdd) {
    try {
        const result = await pool.query(`
            INSERT INTO shitty_weather_scores (user_id, total_points, last_award_date)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE
                total_points = total_points + VALUES(total_points),
                last_award_date = CURRENT_TIMESTAMP
        `, [userId, pointsToAdd]);
        
        return result;
    } catch (error) {
        console.error('[WEATHER DB] Error updating shitty weather score:', error);
        throw error;
    }
}

async function addShittyWeatherAward(awardData) {
    try {
        const result = await pool.query(`
            INSERT INTO shitty_weather_awards (
                user_id, score, points_awarded, temperature, weather_description,
                wind_speed, humidity, breakdown
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            awardData.user_id,
            awardData.score,
            awardData.points_awarded,
            awardData.temperature,
            awardData.weather_description,
            awardData.wind_speed,
            awardData.humidity,
            JSON.stringify(awardData.breakdown)
        ]);
        
        return result;
    } catch (error) {
        console.error('[WEATHER DB] Error adding shitty weather award:', error);
        throw error;
    }
}

// API Usage Functions
async function updateApiUsage(date = new Date()) {
    try {
        const dateStr = date.toISOString().split('T')[0];
        const result = await pool.query(`
            INSERT INTO weather_api_usage (date, calls_count)
            VALUES (?, 1)
            ON DUPLICATE KEY UPDATE calls_count = calls_count + 1
        `, [dateStr]);
        
        return result;
    } catch (error) {
        console.error('[WEATHER DB] Error updating API usage:', error);
        throw error;
    }
}

async function getApiUsage(date = new Date()) {
    try {
        const dateStr = date.toISOString().split('T')[0];
        const result = await pool.query(
            'SELECT calls_count FROM weather_api_usage WHERE date = ?',
            [dateStr]
        );
        
        return result[0]?.calls_count || 0;
    } catch (error) {
        console.error('[WEATHER DB] Error getting API usage:', error);
        throw error;
    }
}

module.exports = {
    initializeWeatherDatabase,
    addWeatherUser,
    getWeatherUser,
    getAllActiveWeatherUsers,
    removeWeatherUser,
    addWeatherHistory,
    getShittyWeatherLeaderboard,
    updateShittyWeatherScore,
    addShittyWeatherAward,
    updateApiUsage,
    getApiUsage
};
