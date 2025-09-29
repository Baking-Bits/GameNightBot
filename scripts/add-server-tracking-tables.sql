-- Add server tracking tables for GameNight weather monitoring
-- Run this script to add server tracking functionality

-- Main server tracking table
CREATE TABLE tracked_servers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_name VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(2) DEFAULT 'US',
    server_type ENUM('gaming', 'web', 'database', 'cdn', 'other') DEFAULT 'gaming',
    location_description VARCHAR(255),
    alert_temperature_high INT DEFAULT 95, -- °F
    alert_temperature_low INT DEFAULT 32,  -- °F
    alert_wind_speed INT DEFAULT 40,       -- mph
    alert_humidity INT DEFAULT 90,         -- %
    alert_severe_weather BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_alert TIMESTAMP NULL,
    current_temp FLOAT NULL,
    current_conditions VARCHAR(100) NULL,
    last_weather_check TIMESTAMP NULL
);

-- Server weather alerts history
CREATE TABLE server_weather_alerts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_id INT,
    alert_type ENUM('high_temp', 'low_temp', 'high_wind', 'high_humidity', 'severe_weather'),
    alert_message TEXT,
    weather_conditions JSON,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES tracked_servers(id) ON DELETE CASCADE
);

-- Add indexes for better performance
CREATE INDEX idx_servers_active ON tracked_servers(is_active);
CREATE INDEX idx_alerts_server ON server_weather_alerts(server_id, sent_at);

-- Insert some example GameNight servers (optional - remove if not needed)
INSERT INTO tracked_servers (server_name, postal_code, server_type, location_description) VALUES
('GameNight Main Server', '23505', 'gaming', 'Norfolk, Virginia - Primary game hosting'),
('GameNight Database', '23505', 'database', 'Norfolk, Virginia - Database cluster'),
('GameNight Web Portal', '23505', 'web', 'Norfolk, Virginia - Website and dashboard');

SELECT 'Server tracking tables created successfully!' as status;