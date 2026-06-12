const db = require('../config/database');
const paymentService = require('../services/payment.service');

const SUCCESS_PAYMENT_STATUS = paymentService.SUCCESS_PAYMENT_STATUS;
const FAILED_PAYMENT_STATUS = paymentService.FAILED_PAYMENT_STATUS;
const ALLOWED_PAYMENT_STATUSES = paymentService.ALLOWED_PAYMENT_STATUSES;
const ORDER_PAYMENT_STATUSES = paymentService.ORDER_PAYMENT_STATUSES;

function normalizePage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return fallback;
  return parsed;
}

function buildPaymentFilters({ q = '', status = '', method = '' } = {}) {
  const where = [];
  const params = [];
  const search = String(q || '').trim();
  const statusFilter = String(status || '').trim().toLowerCase();
  const methodFilter = String(method || '').trim();

  if (search) {
    where.push('(o.order_code LIKE ? OR o.invoice_number LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (ALLOWED_PAYMENT_STATUSES.has(statusFilter)) {
    where.push('pay.status = ?');
    params.push(statusFilter);
  }

  if (methodFilter) {
    where.push('COALESCE(pay.payment_method, pay.method) = ?');
    params.push(methodFilter);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

async function listPayments({ q = '', status = '', method = '', page = 1, limit = 10 } = {}) {
  const safePage = normalizePage(page);
  const safeLimit = normalizeLimit(limit);
  const offset = (safePage - 1) * safeLimit;
  const { whereSql, params } = buildPaymentFilters({ q, status, method });

  return db.query(
    `SELECT pay.id, pay.order_id, pay.method, pay.payment_method, pay.payment_provider,
            pay.transaction_id, pay.amount, pay.status AS payment_status,
            pay.paid_at, pay.created_at,
            COALESCE(pay.payment_method, pay.method) AS display_method,
            o.order_code, o.invoice_number, o.total_amount,
            o.status AS order_status, o.order_status AS legacy_order_status,
            o.payment_status AS order_payment_status,
            u.name AS customer_name, u.email AS customer_email
     FROM payments pay
     INNER JOIN orders o ON o.id = pay.order_id
     LEFT JOIN users u ON u.id = o.customer_id
     ${whereSql}
     ORDER BY pay.created_at DESC, pay.id DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
}

async function countPayments({ q = '', status = '', method = '' } = {}) {
  const { whereSql, params } = buildPaymentFilters({ q, status, method });
  const rows = await db.query(
    `SELECT COUNT(DISTINCT pay.id) AS total
     FROM payments pay
     INNER JOIN orders o ON o.id = pay.order_id
     LEFT JOIN users u ON u.id = o.customer_id
     ${whereSql}`,
    params
  );

  return Number(rows[0]?.total || 0);
}

async function getPaymentSummary() {
  const rows = await db.query(
    `SELECT COUNT(pay.id) AS totalPayments,
            COUNT(CASE WHEN pay.status IN ('unpaid', 'pending_verification') THEN 1 END) AS pendingPayments,
            COUNT(CASE WHEN pay.status = 'paid' THEN 1 END) AS paidPayments,
            COUNT(CASE WHEN pay.status = 'failed' THEN 1 END) AS failedPayments
     FROM payments pay`
  );

  const summary = rows[0] || {};
  return {
    totalPayments: Number(summary.totalPayments || 0),
    pendingPayments: Number(summary.pendingPayments || 0),
    paidPayments: Number(summary.paidPayments || 0),
    failedPayments: Number(summary.failedPayments || 0),
  };
}

async function getPaymentMethods() {
  return db.query(
    `SELECT COALESCE(pay.payment_method, pay.method) AS method, COUNT(pay.id) AS total
     FROM payments pay
     GROUP BY COALESCE(pay.payment_method, pay.method)
     HAVING method IS NOT NULL AND method <> ''
     ORDER BY method ASC`
  );
}

async function getPaymentDetail(paymentId) {
  const rows = await db.query(
    `SELECT pay.id, pay.order_id, pay.method, pay.payment_method, pay.payment_provider,
            pay.transaction_id, pay.amount, pay.status AS payment_status,
            pay.paid_at, pay.created_at,
            COALESCE(pay.payment_method, pay.method) AS display_method,
            o.order_code, o.invoice_number, o.subtotal, o.shipping_cost,
            o.discount_amount, o.total_amount, o.status AS order_status,
            o.order_status AS legacy_order_status, o.payment_status AS order_payment_status,
            o.ordered_at, o.created_at AS order_created_at,
            u.id AS customer_id, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone
     FROM payments pay
     INNER JOIN orders o ON o.id = pay.order_id
     LEFT JOIN users u ON u.id = o.customer_id
     WHERE pay.id = ?
     LIMIT 1`,
    [paymentId]
  );

  return rows[0] || null;
}

async function verifyPayment(paymentId) {
  const conn = await db.pool.getConnection();

  try {
    await conn.beginTransaction();
    const result = await paymentService.verifyPaymentTransaction(conn, paymentId);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function rejectPayment(paymentId) {
  const conn = await db.pool.getConnection();

  try {
    await conn.beginTransaction();
    const result = await paymentService.rejectPaymentTransaction(conn, paymentId);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = {
  SUCCESS_PAYMENT_STATUS,
  FAILED_PAYMENT_STATUS,
  ALLOWED_PAYMENT_STATUSES,
  ORDER_PAYMENT_STATUSES,
  listPayments,
  countPayments,
  getPaymentSummary,
  getPaymentMethods,
  getPaymentDetail,
  verifyPayment,
  rejectPayment,
};
