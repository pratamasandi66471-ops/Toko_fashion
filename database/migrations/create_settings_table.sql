CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NULL,
  setting_group VARCHAR(50) NOT NULL DEFAULT 'general',
  value_type ENUM('string', 'text', 'boolean', 'number', 'json') NOT NULL DEFAULT 'string',
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO settings
  (setting_key, setting_value, setting_group, value_type, is_public)
VALUES
  ('store.name', 'S Fashion', 'store', 'string', 1),
  ('store.email', '', 'store', 'string', 1),
  ('store.phone', '', 'store', 'string', 1),
  ('store.address', '', 'store', 'text', 1),
  ('social.instagram', '', 'social', 'string', 1),
  ('social.facebook', '', 'social', 'string', 1),
  ('social.tiktok', '', 'social', 'string', 1)
ON DUPLICATE KEY UPDATE
  setting_key = VALUES(setting_key);
