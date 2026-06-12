const db = require('../config/database');

const RETURN_STATUSES = Object.freeze([
  'requested',
  'approved',
  'rejected',
  'received',
  'refunded',
  'cancelled',
]);

const ELIGIBLE_ORDER_STATUSES = Object.freeze(['shipped', 'completed']);

function normalizePage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return fallback;
  return parsed;
}

function normalizeStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return RETURN_STATUSES.includes(status) ? status : '';
}

function buildFilters({ q = '', status = '' } = {}) {
  const where = [];
  const params = [];
  const keyword = String(q || '').trim();
  const safeStatus = normalizeStatus(status);

  if (keyword) {
    where.push('(rr.return_code LIKE ? OR o.order_code LIKE ? OR o.invoice_number LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  if (safeStatus) {
    where.push('rr.status = ?');
    params.push(safeStatus);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

async function listReturns({ q = '', status = '', page = 1, limit = 10 } = {}) {
  const safePage = normalizePage(page);
  const safeLimit = normalizeLimit(limit);
  const offset = (safePage - 1) * safeLimit;
  const { whereSql, params } = buildFilters({ q, status });

  return db.query(
    `SELECT rr.id, rr.return_code, rr.order_id, rr.customer_id, rr.reason,
            rr.refund_amount, rr.status, rr.created_at, rr.updated_at,
            o.order_code, o.invoice_number, o.total_amount, o.status AS order_status,
            o.payment_status AS order_payment_status,
            u.name AS customer_name, u.email AS customer_email
     FROM return_requests rr
     INNER JOIN orders o ON o.id = rr.order_id
     LEFT JOIN users u ON u.id = rr.customer_id
     ${whereSql}
     ORDER BY rr.created_at DESC, rr.id DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
}

async function countReturns(filters = {}) {
  const { whereSql, params } = buildFilters(filters);
  const rows = await db.query(
    `SELECT COUNT(rr.id) AS total
     FROM return_requests rr
     INNER JOIN orders o ON o.id = rr.order_id
     LEFT JOIN users u ON u.id = rr.customer_id
     ${whereSql}`,
    params
  );

  return Number(rows[0]?.total || 0);
}

async function getReturnDetail(returnId) {
  const rows = await db.query(
    `SELECT rr.id, rr.return_code, rr.order_id, rr.customer_id, rr.reason,
            rr.admin_note, rr.refund_amount, rr.status, rr.created_at, rr.updated_at,
            o.order_code, o.invoice_number, o.subtotal, o.shipping_cost,
            o.discount_amount, o.total_amount, o.status AS order_status,
            o.order_status AS legacy_order_status, o.payment_status AS order_payment_status,
            o.courier, o.tracking_number, o.ordered_at,
            u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
            pay.id AS payment_id, pay.status AS payment_status, pay.amount AS payment_amount,
            COALESCE(pay.payment_method, pay.method) AS payment_method
     FROM return_requests rr
     INNER JOIN orders o ON o.id = rr.order_id
     LEFT JOIN users u ON u.id = rr.customer_id
     LEFT JOIN payments pay ON pay.order_id = o.id
     WHERE rr.id = ?
     LIMIT 1`,
    [returnId]
  );

  return rows[0] || null;
}

async function getReturnItems(returnId) {
  return db.query(
    `SELECT oi.id, oi.product_name, oi.variant_sku, oi.size, oi.color,
            COALESCE(oi.unit_price, oi.price, 0) AS display_price,
            oi.quantity,
            COALESCE(oi.total, oi.subtotal, oi.unit_price * oi.quantity, oi.price * oi.quantity, 0) AS display_total
     FROM return_requests rr
     INNER JOIN order_items oi ON oi.order_id = rr.order_id
     WHERE rr.id = ?
     ORDER BY oi.id ASC`,
    [returnId]
  );
}

async function findOrderForReturn(orderLookup) {
  const keyword = String(orderLookup || '').trim();
  if (!keyword) return null;

  const rows = await db.query(
    `SELECT o.id, o.customer_id, o.order_code, o.invoice_number, o.total_amount,
            o.status, o.payment_status, u.name AS customer_name, u.email AS customer_email
     FROM orders o
     LEFT JOIN users u ON u.id = o.customer_id
     WHERE o.order_code = ?
        OR o.invoice_number = ?
        OR o.id = ?
     LIMIT 1`,
    [keyword, keyword, Number(keyword) || 0]
  );

  return rows[0] || null;
}

async function hasReturnForOrder(orderId) {
  const rows = await db.query(
    `SELECT rr.id
     FROM return_requests rr
     WHERE rr.order_id = ?
     LIMIT 1`,
    [orderId]
  );

  return rows.length > 0;
}

async function generateReturnCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `RET-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const rows = await db.query(
      `SELECT rr.id
       FROM return_requests rr
       WHERE rr.return_code = ?
       LIMIT 1`,
      [code]
    );

    if (rows.length === 0) return code;
  }

  throw new Error('Gagal membuat kode return unik.');
}

async function createReturnRequest({ orderId, customerId, reason, refundAmount = 0, status = 'requested', adminNote = '' }) {
  const returnCode = await generateReturnCode();
  const result = await db.query(
    `INSERT INTO return_requests
      (return_code, order_id, customer_id, reason, admin_note, refund_amount, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      returnCode,
      orderId,
      customerId,
      String(reason || '').trim(),
      String(adminNote || '').trim() || null,
      Number(refundAmount || 0),
      normalizeStatus(status) || 'requested',
    ]
  );

  return {
    id: result.insertId,
    returnCode,
  };
}

async function updateReturnStatus(returnId, status) {
  const safeStatus = normalizeStatus(status);
  if (!safeStatus) {
    const error = new Error('Status return tidak valid.');
    error.code = 'INVALID_RETURN_STATUS';
    throw error;
  }

  const result = await db.query(
    `UPDATE return_requests rr
     SET rr.status = ?,
         rr.updated_at = NOW()
     WHERE rr.id = ?`,
    [safeStatus, returnId]
  );

  return result.affectedRows || 0;
}

async function updateAdminNote(returnId, { adminNote, refundAmount }) {
  const result = await db.query(
    `UPDATE return_requests rr
     SET rr.admin_note = ?,
         rr.refund_amount = ?,
         rr.updated_at = NOW()
     WHERE rr.id = ?`,
    [
      String(adminNote || '').trim() || null,
      Number(refundAmount || 0),
      returnId,
    ]
  );

  return result.affectedRows || 0;
}

module.exports = {
  RETURN_STATUSES,
  ELIGIBLE_ORDER_STATUSES,
  listReturns,
  countReturns,
  getReturnDetail,
  getReturnItems,
  findOrderForReturn,
  hasReturnForOrder,
  createReturnRequest,
  updateReturnStatus,
  updateAdminNote,
};
