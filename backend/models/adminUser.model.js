const db = require('../config/database');

const ALLOWED_USER_STATUSES = new Set(['active', 'inactive', 'blocked']);
const CUSTOMER_ROLE = 'customer';
const STAFF_ROLE = 'staff';

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
  return ALLOWED_USER_STATUSES.has(status) ? status : '';
}

function assertAllowedStatus(status) {
  if (!ALLOWED_USER_STATUSES.has(status)) {
    const error = new Error('Status user tidak valid.');
    error.code = 'INVALID_USER_STATUS';
    throw error;
  }
}

function assertAllowedRole(role) {
  if (![CUSTOMER_ROLE, STAFF_ROLE].includes(role)) {
    const error = new Error('Role user tidak valid untuk modul ini.');
    error.code = 'INVALID_USER_ROLE';
    throw error;
  }
}

function buildUserFilters({ q = '', status = '' } = {}) {
  const where = [];
  const params = [];
  const keyword = String(q || '').trim();
  const safeStatus = normalizeStatus(status);

  if (keyword) {
    where.push('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  if (safeStatus) {
    where.push('u.status = ?');
    params.push(safeStatus);
  }

  return {
    whereSql: where.length ? `AND ${where.join(' AND ')}` : '',
    params,
  };
}

async function listCustomers({ q = '', status = '', page = 1, limit = 10 } = {}) {
  const safePage = normalizePage(page);
  const safeLimit = normalizeLimit(limit);
  const offset = (safePage - 1) * safeLimit;
  const { whereSql, params } = buildUserFilters({ q, status });

  return db.query(
    `SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at, u.updated_at,
            COUNT(o.id) AS total_orders,
            COUNT(CASE WHEN o.payment_status = 'paid' THEN 1 END) AS paid_orders,
            COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_amount ELSE 0 END), 0) AS total_spent,
            MAX(o.created_at) AS last_order_at
     FROM users u
     LEFT JOIN orders o ON o.customer_id = u.id
     WHERE u.role = ?
     ${whereSql}
     GROUP BY u.id, u.name, u.email, u.phone, u.status, u.created_at, u.updated_at
     ORDER BY u.created_at DESC, u.id DESC
     LIMIT ? OFFSET ?`,
    [CUSTOMER_ROLE, ...params, safeLimit, offset]
  );
}

async function countCustomers({ q = '', status = '' } = {}) {
  const { whereSql, params } = buildUserFilters({ q, status });
  const rows = await db.query(
    `SELECT COUNT(u.id) AS total
     FROM users u
     WHERE u.role = ?
     ${whereSql}`,
    [CUSTOMER_ROLE, ...params]
  );

  return Number(rows[0]?.total || 0);
}

async function getCustomerDetail(customerId) {
  const rows = await db.query(
    `SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at, u.updated_at,
            COUNT(o.id) AS total_orders,
            COUNT(CASE WHEN o.payment_status = 'paid' THEN 1 END) AS paid_orders,
            COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_amount ELSE 0 END), 0) AS total_spent,
            MAX(o.created_at) AS last_order_at
     FROM users u
     LEFT JOIN orders o ON o.customer_id = u.id
     WHERE u.id = ?
       AND u.role = ?
     GROUP BY u.id, u.name, u.email, u.phone, u.status, u.created_at, u.updated_at
     LIMIT 1`,
    [customerId, CUSTOMER_ROLE]
  );

  return rows[0] || null;
}

async function getCustomerAddresses(customerId) {
  return db.query(
    `SELECT a.id, a.recipient_name, a.phone, a.province, a.city, a.district,
            a.postal_code, a.full_address, a.is_default, a.created_at
     FROM addresses a
     INNER JOIN users u ON u.id = a.user_id
     WHERE a.user_id = ?
       AND u.role = ?
     ORDER BY a.is_default DESC, a.created_at DESC, a.id DESC`,
    [customerId, CUSTOMER_ROLE]
  );
}

async function getCustomerRecentOrders(customerId, limit = 5) {
  const safeLimit = normalizeLimit(limit, 5);
  return db.query(
    `SELECT o.id, o.invoice_number, o.order_code, o.total_amount, o.status,
            o.order_status, o.payment_status, o.created_at, o.updated_at
     FROM orders o
     INNER JOIN users u ON u.id = o.customer_id
     WHERE o.customer_id = ?
       AND u.role = ?
     ORDER BY o.created_at DESC, o.id DESC
     LIMIT ?`,
    [customerId, CUSTOMER_ROLE, safeLimit]
  );
}

async function updateUserStatus(userId, status, expectedRole) {
  const safeStatus = normalizeStatus(status);
  assertAllowedStatus(safeStatus);
  assertAllowedRole(expectedRole);

  const result = await db.query(
    `UPDATE users u
     SET u.status = ?,
         u.updated_at = NOW()
     WHERE u.id = ?
       AND u.role = ?`,
    [safeStatus, userId, expectedRole]
  );

  return result.affectedRows || 0;
}

async function listStaff({ q = '', status = '', page = 1, limit = 10 } = {}) {
  const safePage = normalizePage(page);
  const safeLimit = normalizeLimit(limit);
  const offset = (safePage - 1) * safeLimit;
  const { whereSql, params } = buildUserFilters({ q, status });

  return db.query(
    `SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at, u.updated_at
     FROM users u
     WHERE u.role = ?
     ${whereSql}
     ORDER BY u.created_at DESC, u.id DESC
     LIMIT ? OFFSET ?`,
    [STAFF_ROLE, ...params, safeLimit, offset]
  );
}

async function countStaff({ q = '', status = '' } = {}) {
  const { whereSql, params } = buildUserFilters({ q, status });
  const rows = await db.query(
    `SELECT COUNT(u.id) AS total
     FROM users u
     WHERE u.role = ?
     ${whereSql}`,
    [STAFF_ROLE, ...params]
  );

  return Number(rows[0]?.total || 0);
}

async function getStaffById(staffId) {
  const rows = await db.query(
    `SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at, u.updated_at
     FROM users u
     WHERE u.id = ?
       AND u.role = ?
     LIMIT 1`,
    [staffId, STAFF_ROLE]
  );

  return rows[0] || null;
}

async function isEmailTaken(email, excludeId = null) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const params = [normalizedEmail];
  let excludeSql = '';

  if (excludeId) {
    excludeSql = 'AND u.id <> ?';
    params.push(excludeId);
  }

  const rows = await db.query(
    `SELECT u.id
     FROM users u
     WHERE LOWER(u.email) = ?
     ${excludeSql}
     LIMIT 1`,
    params
  );

  return Boolean(rows[0]);
}

async function createStaff({ name, email, phone, passwordHash, status = 'active' }) {
  const safeStatus = normalizeStatus(status) || 'active';
  assertAllowedStatus(safeStatus);

  const result = await db.query(
    `INSERT INTO users (name, email, phone, password, role, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      String(name || '').trim(),
      String(email || '').trim().toLowerCase(),
      String(phone || '').trim() || null,
      passwordHash,
      STAFF_ROLE,
      safeStatus,
    ]
  );

  return result.insertId;
}

async function updateStaff(staffId, { name, email, phone, status = 'active' }) {
  const safeStatus = normalizeStatus(status);
  assertAllowedStatus(safeStatus);

  const result = await db.query(
    `UPDATE users u
     SET u.name = ?,
         u.email = ?,
         u.phone = ?,
         u.status = ?,
         u.updated_at = NOW()
     WHERE u.id = ?
       AND u.role = ?`,
    [
      String(name || '').trim(),
      String(email || '').trim().toLowerCase(),
      String(phone || '').trim() || null,
      safeStatus,
      staffId,
      STAFF_ROLE,
    ]
  );

  return result.affectedRows || 0;
}

async function updateStaffPassword(staffId, passwordHash) {
  const result = await db.query(
    `UPDATE users u
     SET u.password = ?,
         u.updated_at = NOW()
     WHERE u.id = ?
       AND u.role = ?`,
    [passwordHash, staffId, STAFF_ROLE]
  );

  return result.affectedRows || 0;
}

module.exports = {
  ALLOWED_USER_STATUSES,
  CUSTOMER_ROLE,
  STAFF_ROLE,
  listCustomers,
  countCustomers,
  getCustomerDetail,
  getCustomerAddresses,
  getCustomerRecentOrders,
  updateUserStatus,
  listStaff,
  countStaff,
  getStaffById,
  isEmailTaken,
  createStaff,
  updateStaff,
  updateStaffPassword,
};
