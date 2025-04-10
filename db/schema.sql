-- Veritabanını oluştur 
CREATE DATABASE IF NOT EXISTS nsfw_api;

USE nsfw_api;

-- API Keys tablosu
CREATE TABLE IF NOT EXISTS api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    api_key VARCHAR(64) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_unlimited BOOLEAN DEFAULT FALSE,
    unlimited_ips TEXT,
    monthly_token_limit INT DEFAULT 10000,
    tokens_used INT DEFAULT 0,
    auto_reset BOOLEAN DEFAULT TRUE,
    last_reset_date DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- IP bazlı kısıtlama takibi için yeni tablo
CREATE TABLE IF NOT EXISTS ip_rate_limits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL UNIQUE,
    monthly_token_limit INT DEFAULT 1000,
    tokens_used INT DEFAULT 0,
    request_count INT DEFAULT 0,
    last_request_time TIMESTAMP,
    last_reset_date DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- API kullanım logları tablosu
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    api_key_id INT,
    request_ip VARCHAR(45),
    endpoint VARCHAR(255),
    url TEXT,
    tokens_used INT,
    is_successful BOOLEAN,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL
); 