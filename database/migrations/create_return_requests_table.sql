CREATE TABLE IF NOT EXISTS return_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  return_code VARCHAR(100) NOT NULL UNIQUE,
  order_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  reason TEXT NOT NULL,
  admin_note TEXT NULL,
  refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('requested', 'approved', 'rejected', 'received', 'refunded', 'cancelled') NOT NULL DEFAULT 'requested',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_return_requests_order (order_id),
  INDEX idx_return_requests_customer (customer_id),
  INDEX idx_return_requests_status (status),
  INDEX idx_return_requests_created_at (created_at)
);
