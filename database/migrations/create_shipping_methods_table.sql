CREATE TABLE IF NOT EXISTS shipping_methods (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  estimated_days VARCHAR(50) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_shipping_methods_status (status),
  INDEX idx_shipping_methods_sort (sort_order)
);

INSERT INTO shipping_methods
  (code, name, description, cost, estimated_days, status, sort_order)
VALUES
  ('regular', 'Reguler', 'Pengiriman standar untuk pesanan S Fashion.', 15000, '2-4 hari', 'active', 10),
  ('express', 'Express', 'Pengiriman lebih cepat untuk area yang tersedia.', 30000, '1-2 hari', 'active', 20)
ON DUPLICATE KEY UPDATE
  code = VALUES(code);
