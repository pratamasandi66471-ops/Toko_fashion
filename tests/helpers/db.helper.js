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
  getPaymentByOrderId,
  getOrderItems,
  getLatestAuditLog,
  cleanupAuditLogById,
  closePool,
};
