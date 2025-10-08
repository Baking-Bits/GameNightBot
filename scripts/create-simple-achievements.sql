-- Simplified achievements table for website consumption
-- Website handles all presentation, formatting, and achievement logic

DROP TABLE IF EXISTS achievements;

CREATE TABLE achievements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    guild_id VARCHAR(255) NOT NULL,
    achievement_type VARCHAR(100) NOT NULL,
    value DECIMAL(15,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for fast website queries
    INDEX idx_user_guild (user_id, guild_id),
    INDEX idx_type (achievement_type),
    INDEX idx_value (value),
    
    -- Prevent duplicate achievement types per user
    UNIQUE KEY unique_user_achievement (user_id, guild_id, achievement_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Simple comment
ALTER TABLE achievements COMMENT = 'Raw achievement values for website consumption';