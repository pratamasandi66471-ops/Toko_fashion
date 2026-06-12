const db = require('../config/database');

const ALLOWED_VOUCHER_TYPES = new Set(['fixed', 'percentage']);
const ALLOWED_VOUCHER_STATUSES = new Set(['active', 'inactive']);

function normalizePage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return fallback;
  return parsed;
}

function normalizeType(value) {
  const type = String(value || '').trim().toLowerCase();
  return ALLOWED_VOUCHER_TYPES.has(type) ? type : '';
}

function normalizeStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return ALLOWED_VOUCHER_STATUSES.has(status) ? status : '';
}

function buildVoucherFilters({ q = '', status = '', type = '' } = {}) {
  const where = [];
  const params = [];
  const keyword = String(q || '').trim();
  const safeStatus = normalizeStatus(status);
  const safeType = normalizeType(type);

  if (keyword) {
    where.push('v.code LIKE ?');
    params.push(`%${keyword.toUpperCase()}%`);
  }

  if (safeStatus) {
    where.push('v.status = ?');
    params.push(safeStatus);
  }

  if (safeType) {
    where.push('v.type = ?');
    params.push(safeType);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

async function listVouchers({ q = '', status = '', type = '', page = 1, limit = 10 } = {}) {
  const safePage = normalizePage(page);
  const safeLimit = normalizeLimit(limit);
  const offset = (safePage - 1) * safeLimit;
  const { whereSql, params } = buildVoucherFilters({ q, status, type });

  return db.query(
    `SELECT v.id, v.code, v.type, v.value, v.max_discount, v.min_purchase,
            v.usage_limit, v.used_count, v.start_date, v.end_date, v.status, v.created_at
     FROM vouchers v
     ${whereSql}
     ORDER BY v.created_at DESC, v.id DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
}

async function countVouchers({ q = '', status = '', type = '' } = {}) {
  const { whereSql, params } = buildVoucherFilters({ q, status, type });
  const rows = await db.query(
    `SELECT COUNT(v.id) AS total
     FROM vouchers v
     ${whereSql}`,
    params
  );

  return Number(rows[0]?.total || 0);
}

async function findById(id) {
  const rows = await db.query(
    `SELECT v.id, v.code, v.type, v.value, v.max_discount, v.min_purchase,
            v.usage_limit, v.used_count, v.start_date, v.end_date, v.status, v.created_at
     FROM vouchers v
     WHERE v.id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function findByCode(code) {
  const rows = await db.query(
    `SELECT v.id, v.code, v.type, v.value, v.max_discount, v.min_purchase,
            v.usage_limit, v.used_count, v.start_date, v.end_date, v.status, v.created_at
     FROM vouchers v
     WHERE v.code = ?
     LIMIT 1`,
    [String(code || '').trim().toUpperCase()]
  );

  return rows[0] || null;
}

async function isCodeTaken(code, excludeId = null) {
  const params = [String(code || '').trim().toUpperCase()];
  let excludeSql = '';

  if (excludeId) {
    excludeSql = 'AND v.id <> ?';
    params.push(excludeId);
  }

  const rows = await db.query(
    `SELECT v.id
     FROM vouchers v
     WHERE v.code = ?
     ${excludeSql}
     LIMIT 1`,
    params
  );

  return Boolean(rows[0]);
}

async function createVoucher(data) {
  const result = await db.query(
    `INSERT INTO vouchers
       (code, type, value, max_discount, min_purchase, usage_limit, start_date, end_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.code,
      data.type,
      data.value,
      data.max_discount,
      data.min_purchase,
      data.usage_limit,
      data.start_date,
      data.end_date,
      data.status,
    ]
  );

  return result.insertId;
}

async function updateVoucher(id, data) {
  const result = await db.query(
    `UPDATE vouchers v
     SET v.code = ?,
         v.type = ?,
         v.value = ?,
         v.max_discount = ?,
         v.min_purchase = ?,
         v.usage_limit = ?,
         v.start_date = ?,
         v.end_date = ?,
         v.status = ?
     WHERE v.id = ?`,
    [
      data.code,
      data.type,
      data.value,
      data.max_discount,
      data.min_purchase,
      data.usage_limit,
      data.start_date,
      data.end_date,
      data.status,
      id,
    ]
  );

  return result.affectedRows || 0;
}

async function toggleStatus(id) {
  const result = await db.query(
    `UPDATE vouchers v
     SET v.status = CASE WHEN v.status = 'active' THEN 'inactive' ELSE 'active' END
     WHERE v.id = ?`,
    [id]
  );

  return result.affectedRows || 0;
}

module.exports = {
  ALLOWED_VOUCHER_TYPES,
  ALLOWED_VOUCHER_STATUSES,
  listVouchers,
  countVouchers,
  findById,
  findByCode,
  isCodeTaken,
  createVoucher,
  updateVoucher,
  toggleStatus,
};
