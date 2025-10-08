-- Create achievements table for storing user achievement data
-- This table will be used by the website project to display user accomplishments

CREATE TABLE IF NOT EXISTS achievements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    guild_id VARCHAR(255) NOT NULL,
    achievement_type ENUM(
        'voice_hours_total',
        'voice_hours_daily', 
        'voice_hours_weekly',
        'voice_hours_monthly',
        'weather_points_total',
        'weather_points_daily',
        'weather_streak',
        'wellness_streak',
        'event_participation',
        'crafty_server_uptime',
        'custom'
    ) NOT NULL,
    achievement_name VARCHAR(255) NOT NULL,
    achievement_description TEXT,
    value DECIMAL(15,2) NOT NULL DEFAULT 0,
    value_type ENUM('hours', 'points', 'days', 'count', 'percentage') NOT NULL DEFAULT 'count',
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    metadata JSON DEFAULT NULL,
    
    -- Indexes for performance
    INDEX idx_user_guild (user_id, guild_id),
    INDEX idx_achievement_type (achievement_type),
    INDEX idx_earned_at (earned_at),
    
    -- Unique constraint to prevent duplicate achievements of same type per user
    UNIQUE KEY unique_user_achievement (user_id, guild_id, achievement_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add comment to table
ALTER TABLE achievements COMMENT = 'Stores user achievements for display on website and bot commands';