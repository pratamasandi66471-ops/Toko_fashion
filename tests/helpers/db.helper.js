const db = require('../../backend/config/database');

const TEST_CUSTOMER_EMAIL = 'dinda.permata@email.com';

function assertTestDatabase() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`Unsafe NODE_ENV: ${process.env.NODE_ENV}. Expected test.`);
  }

  if (process.env.DB_NAME !== 'toko_test') {
    throw new Error(`Unsafe test database: ${process.env.DB_NAME}. Expected toko_test.`);
  }
}

async function query(sql, params = []) {
  assertTestDatabase();
  return db.query(sql, params);
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function getActiveProductSlug() {
  const row = await queryOne(
    `SELECT p.slug
     FROM products p
     INNER JOIN product_variants pv ON pv.product_id = p.id
     WHERE p.status = 'active'
       AND pv.status = 'active'
       AND pv.stock > 0
     GROUP BY p.id, p.slug
     ORDER BY p.id ASC
     LIMIT 1`
  );

  return row?.slug || null;
}

async function ensureTestShippingMethods() {
  assertTestDatabase();

  await query(
    `CREATE TABLE IF NOT EXISTS shipping_methods (
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
    )`
  );

  await query(
    `INSERT INTO shipping_methods
      (code, name, description, cost, estimated_days, status, sort_order)
     VALUES
      ('regular', 'Reguler', 'Pengiriman standar untuk pesanan S Fashion.', 15000, '2-4 hari', 'active', 10),
      ('express', 'Express', 'Pengiriman lebih cepat untuk area yang tersedia.', 30000, '1-2 hari', 'active', 20)
     ON DUPLICATE KEY UPDATE
      code = VALUES(code)`
  );
}

async function ensureTestReturnRequestsTable() {
  assertTestDatabase();

  await query(
    `CREATE TABLE IF NOT EXISTS return_requests (
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
    )`
  );
}

async function getActiveVariantWithStock() {
  return queryOne(
    `SELECT pv.id, pv.stock, pv.product_id, pv.status, pv.variant_sku
     FROM product_variants pv
     INNER JOIN products p ON p.id = pv.product_id
     WHERE p.status = 'active'
       AND pv.status = 'active'
       AND pv.stock > 0
     ORDER BY pv.stock DESC, pv.id ASC
     LIMIT 1`
  );
}

async function getCustomerByEmail(email) {
  return queryOne(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.status
     FROM users u
     WHERE u.email = ?
     LIMIT 1`,
    [email]
  );
}

async function getTestCustomer() {
  return getCustomerByEmail(TEST_CUSTOMER_EMAIL);
}

async function getCustomerAddress(customerId) {
  return queryOne(
    `SELECT a.id, a.user_id, a.recipient_name, a.phone, a.province, a.city,
            a.district, a.postal_code, a.full_address, a.is_default
     FROM addresses a
     WHERE a.user_id = ?
     ORDER BY a.is_default DESC, a.id ASC
     LIMIT 1`,
    [customerId]
  );
}

async function ensureTestAddress(customerId) {
  assertTestDatabase();

  const existingAddress = await getCustomerAddress(customerId);
  if (existingAddress) return existingAddress;

  await query(
    `INSERT INTO addresses
       (user_id, recipient_name, phone, province, city, district, postal_code, full_address, is_default)
     VALUES
       (?, 'Dinda Permata', '081234567890', 'DKI Jakarta', 'Jakarta Selatan',
        'Kebayoran Baru', '12110', 'Alamat test otomatis S Fashion', 1)`,
    [customerId]
  );

  return getCustomerAddress(customerId);
}

async function cleanupCustomerCart(customerId) {
  assertTestDatabase();

  await query(
    `DELETE c
     FROM carts c
     WHERE c.user_id = ?`,
    [customerId]
  );
}

async function cleanupCustomerCartByEmail(email) {
  assertTestDatabase();
  const customer = await getCustomerByEmail(email);
  if (!customer) return;

  await cleanupCustomerCart(customer.id);
}

async function getCartItemByCustomerEmail(email) {
  const customer = await getCustomerByEmail(email);
  if (!customer) return null;

  return queryOne(
    `SELECT c.id, c.quantity, c.product_variant_id
     FROM carts c
     WHERE c.user_id = ?
     ORDER BY c.id DESC
     LIMIT 1`,
    [customer.id]
  );
}

async function getVariantById(variantId) {
  return queryOne(
    `SELECT pv.id, pv.product_id, pv.size, pv.color, pv.stock, pv.status, pv.variant_sku
     FROM product_variants pv
     WHERE pv.id = ?
     LIMIT 1`,
    [variantId]
  );
}

function normalizeStock(stock) {
  const parsedStock = Number(stock);
  if (!Number.isInteger(parsedStock) || parsedStock < 0) {
    throw new Error(`Invalid stock value: ${stock}. Expected integer >= 0.`);
  }

  return parsedStock;
}

async function setVariantStock(variantId, stock) {
  assertTestDatabase();
  const safeStock = normalizeStock(stock);

  await query(
    `UPDATE product_variants pv
     SET pv.stock = ?
     WHERE pv.id = ?`,
    [safeStock, variantId]
  );
}

async function restoreVariantStock(variantId, originalStock) {
  await setVariantStock(variantId, originalStock);
}

function createTestMarker(prefix = 'AUTO_TEST') {
  const safePrefix = String(prefix || 'AUTO_TEST')
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 40);
  return `${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function getOrderByMarker(marker) {
  if (!marker) return null;

  return queryOne(
    `SELECT o.id, o.customer_id, o.address_id, o.order_code, o.invoice_number,
            o.subtotal, o.shipping_cost, o.discount_amount, o.total_amount,
            o.status, o.order_status, o.payment_status, o.notes
     FROM orders o
     WHERE o.notes = ?
     ORDER BY o.id DESC
     LIMIT 1`,
    [marker]
  );
}

async function cleanupOrdersByMarker(marker) {
  assertTestDatabase();

  if (!marker || typeof marker !== 'string' || !marker.trim()) {
    throw new Error('cleanupOrdersByMarker requires a non-empty marker.');
  }

  const orders = await query(
    `SELECT o.id
     FROM orders o
     WHERE o.notes = ?`,
    [marker]
  );

  if (!orders.length) return;

  const orderIds = orders.map((order) => order.id);
  const placeholders = orderIds.map(() => '?').join(', ');

  await query(`DELETE pay FROM payments pay WHERE pay.order_id IN (${placeholders})`, orderIds);
  await query(`DELETE oi FROM order_items oi WHERE oi.order_id IN (${placeholders})`, orderIds);
  await query(`DELETE o FROM orders o WHERE o.id IN (${placeholders}) AND o.notes = ?`, [
    ...orderIds,
    marker,
  ]);
}

function normalizeVoucherCode(code) {
  return String(code || '').trim().toUpperCase();
}

async function createTestVoucher({
  code,
  type = 'fixed',
  value = 10000,
  maxDiscount = null,
  minPurchase = 0,
  usageLimit = null,
  status = 'active',
} = {}) {
  assertTestDatabase();

  const normalizedCode = normalizeVoucherCode(code);
  if (!normalizedCode) {
    throw new Error('createTestVoucher requires a voucher code.');
  }

  await query(
    `INSERT INTO vouchers
       (code, type, value, max_discount, min_purchase, usage_limit, used_count, start_date, end_date, status)
     VALUES
       (?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?)`,
    [normalizedCode, type, value, maxDiscount, minPurchase, usageLimit, status]
  );

  return getVoucherByCode(normalizedCode);
}

async function getVoucherByCode(code) {
  const normalizedCode = normalizeVoucherCode(code);
  if (!normalizedCode) return null;

  return queryOne(
    `SELECT v.id, v.code, v.type, v.value, v.max_discount, v.min_purchase,
            v.usage_limit, v.used_count, v.start_date, v.end_date, v.status
     FROM vouchers v
     WHERE v.code = ?
     LIMIT 1`,
    [normalizedCode]
  );
}

async function cleanupVoucherByCode(code) {
  assertTestDatabase();

  const normalizedCode = normalizeVoucherCode(code);
  if (!normalizedCode) {
    throw new Error('cleanupVoucherByCode requires a voucher code.');
  }

  await query(
    `DELETE v
     FROM vouchers v
     WHERE v.code = ?`,
    [normalizedCode]
  );
}

async function getShippingMethodByCode(code) {
  return queryOne(
    `SELECT sm.id, sm.code, sm.name, sm.description, sm.cost, sm.estimated_days,
            sm.status, sm.sort_order
     FROM shipping_methods sm
     WHERE sm.code = ?
     LIMIT 1`,
    [String(code || '').trim()]
  );
}

async function cleanupShippingMethodByCode(code) {
  assertTestDatabase();

  const safeCode = String(code || '').trim();
  if (!safeCode) {
    throw new Error('cleanupShippingMethodByCode requires a shipping code.');
  }

  await query(
    `DELETE sm
     FROM shipping_methods sm
     WHERE sm.code = ?`,
    [safeCode]
  );
}

async function getReturnByCode(code) {
  return queryOne(
    `SELECT rr.id, rr.return_code, rr.order_id, rr.customer_id, rr.reason,
            rr.admin_note, rr.refund_amount, rr.status
     FROM return_requests rr
     WHERE rr.return_code = ?
     LIMIT 1`,
    [String(code || '').trim()]
  );
}

async function getReturnByOrderId(orderId) {
  return queryOne(
    `SELECT rr.id, rr.return_code, rr.order_id, rr.customer_id, rr.reason,
            rr.admin_note, rr.refund_amount, rr.status
     FROM return_requests rr
     WHERE rr.order_id = ?
     ORDER BY rr.id DESC
     LIMIT 1`,
    [orderId]
  );
}

async function cleanupReturnsByOrderId(orderId) {
  assertTestDatabase();

  await query(
    `DELETE rr
     FROM return_requests rr
     WHERE rr.order_id = ?`,
    [orderId]
  );
}

async function getPaymentByOrderId(orderId) {
  return queryOne(
    `SELECT pay.id, pay.order_id, pay.method, pay.payment_method, pay.amount,
            pay.status, pay.paid_at
     FROM payments pay
     WHERE pay.order_id = ?
     LIMIT 1`,
    [orderId]
  );
}

async function getOrderItems(orderId) {
  return query(
    `SELECT oi.id, oi.order_id, oi.product_id, oi.product_variant_id,
            oi.product_name, oi.size, oi.color, oi.variant_sku,
            oi.price, oi.quantity, oi.total, oi.unit_price, oi.subtotal
     FROM order_items oi
     WHERE oi.order_id = ?
     ORDER BY oi.id ASC`,
    [orderId]
  );
}

async function getLatestAuditLog({ action, entityType, entityId }) {
  return queryOne(
    `SELECT al.id, al.user_id, al.role, al.action, al.entity_type, al.entity_id,
            al.old_values, al.new_values, al.ip_address, al.user_agent, al.created_at
     FROM audit_logs al
     WHERE al.action = ?
       AND al.entity_type = ?
       AND al.entity_id = ?
     ORDER BY al.id DESC
     LIMIT 1`,
    [action, entityType, entityId]
  );
}

async function cleanupAuditLogById(auditLogId) {
  assertTestDatabase();

  if (!auditLogId || !Number.isInteger(Number(auditLogId))) {
    throw new Error('cleanupAuditLogById requires a numeric audit log id.');
  }

  await query(
    `DELETE al
     FROM audit_logs al
     WHERE al.id = ?`,
    [auditLogId]
  );
}

async function closePool() {
  await db.pool.end();
}

module.exports = {
  assertTestDatabase,
  query,
  queryOne,
  ensureTestShippingMethods,
  ensureTestReturnRequestsTable,
  getActiveProductSlug,
  getActiveVariantWithStock,
  getCustomerByEmail,
  getTestCustomer,
  ensureTestAddress,
  getCustomerAddress,
  cleanupCustomerCart,
  cleanupCustomerCartByEmail,
  getCartItemByCustomerEmail,
  getVariantById,
  setVariantStock,
  restoreVariantStock,
  createTestMarker,
  getOrderByMarker,
  cleanupOrdersByMarker,
  createTestVoucher,
  getVoucherByCode,
  cleanupVoucherByCode,
  getShippingMethodByCode,
  cleanupShippingMethodByCode,
  getReturnByCode,
  getReturnByOrderId,
  cleanupReturnsByOrderId,
  getPaymentByOrderId,
  getOrderItems,
  getLatestAuditLog,
  cleanupAuditLogById,
  closePool,
};
