-- S Fashion: Safe schema hardening for cart + checkout readiness
-- IMPORTANT:
-- 1) Backup database dulu sebelum eksekusi.
-- 2) Script ini TIDAK melakukan DROP TABLE.
-- 3) Jalankan bertahap per section, dan cek hasil SHOW CREATE TABLE.

-- =========================
-- 0) PRE-FLIGHT (WAJIB)
-- =========================
SHOW CREATE TABLE users;
SHOW CREATE TABLE products;
SHOW CREATE TABLE product_variants;
SHOW CREATE TABLE addresses;
SHOW CREATE TABLE carts;
SHOW CREATE TABLE orders;
SHOW CREATE TABLE order_items;
SHOW CREATE TABLE payments;
SHOW CREATE TABLE reviews;

-- =========================
-- 1) HARDEN PRODUCT VARIANTS
-- =========================
ALTER TABLE product_variants
  MODIFY stock INT UNSIGNED NOT NULL DEFAULT 0;

ALTER TABLE product_variants
  ADD CONSTRAINT uq_variant_product_size_color UNIQUE (product_id, size, color);

-- =========================
-- 2) HARDEN CARTS (single-table cart style)
-- =========================
ALTER TABLE carts
  MODIFY quantity INT UNSIGNED NOT NULL DEFAULT 1;

ALTER TABLE carts
  ADD CONSTRAINT uq_carts_user_variant UNIQUE (user_id, product_variant_id);

-- =========================
-- 3) ORDERS: compatibility fields untuk kode Node.js aktif
-- =========================
ALTER TABLE orders
  ADD COLUMN customer_id BIGINT UNSIGNED NULL AFTER user_id,
  ADD COLUMN order_code VARCHAR(100) NULL AFTER invoice_number,
  ADD COLUMN status ENUM('pending','processing','shipped','completed','cancelled') NULL AFTER order_status,
  ADD COLUMN ordered_at DATETIME NULL AFTER total_amount;

UPDATE orders
SET
  customer_id = COALESCE(customer_id, user_id),
  order_code = COALESCE(order_code, invoice_number),
  status = CASE COALESCE(status, order_status)
    WHEN 'confirmed' THEN 'processing'
    WHEN 'packed' THEN 'processing'
    ELSE COALESCE(status, order_status)
  END,
  ordered_at = COALESCE(ordered_at, created_at);

ALTER TABLE orders
  MODIFY customer_id BIGINT UNSIGNED NOT NULL,
  MODIFY order_code VARCHAR(100) NOT NULL,
  MODIFY status ENUM('pending','processing','shipped','completed','cancelled') NOT NULL DEFAULT 'pending',
  MODIFY ordered_at DATETIME NOT NULL;

ALTER TABLE orders
  ADD CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES users(id),
  ADD CONSTRAINT uq_orders_order_code UNIQUE (order_code),
  ADD INDEX idx_orders_status (status),
  ADD INDEX idx_orders_ordered_at (ordered_at),
  ADD INDEX idx_orders_payment_status (payment_status);

-- =========================
-- 4) ORDER ITEMS: aliases untuk kompatibilitas dashboard
-- =========================
ALTER TABLE order_items
  ADD COLUMN unit_price DECIMAL(12,2) NULL AFTER price,
  ADD COLUMN subtotal DECIMAL(12,2) NULL AFTER total;

UPDATE order_items
SET
  unit_price = COALESCE(unit_price, price),
  subtotal = COALESCE(subtotal, total);

ALTER TABLE order_items
  MODIFY unit_price DECIMAL(12,2) NOT NULL,
  MODIFY subtotal DECIMAL(12,2) NOT NULL;

ALTER TABLE order_items
  ADD COLUMN variant_sku VARCHAR(120) NULL AFTER color;

-- =========================
-- 5) PAYMENTS: sinkron method + status
-- =========================
ALTER TABLE payments
  ADD COLUMN method VARCHAR(100) NULL AFTER payment_method;

UPDATE payments
SET method = COALESCE(method, payment_method);

UPDATE payments
SET status = CASE status
  WHEN 'pending' THEN 'pending_verification'
  WHEN 'success' THEN 'paid'
  WHEN 'expired' THEN 'failed'
  ELSE status
END;

ALTER TABLE payments
  MODIFY status ENUM('unpaid','pending_verification','paid','failed') NOT NULL DEFAULT 'unpaid',
  MODIFY method VARCHAR(100) NOT NULL,
  ADD CONSTRAINT uq_payments_order UNIQUE (order_id),
  ADD INDEX idx_payments_status (status),
  ADD INDEX idx_payments_paid_at (paid_at);

-- =========================
-- 6) REVIEWS: sinkron kolom dengan kode Node.js
-- =========================
ALTER TABLE reviews
  ADD COLUMN customer_id BIGINT UNSIGNED NULL AFTER user_id,
  ADD COLUMN message TEXT NULL AFTER comment;

UPDATE reviews
SET
  customer_id = COALESCE(customer_id, user_id),
  message = COALESCE(message, comment);

ALTER TABLE reviews
  MODIFY customer_id BIGINT UNSIGNED NOT NULL,
  MODIFY message TEXT,
  ADD CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  ADD INDEX idx_reviews_created_at (created_at);
