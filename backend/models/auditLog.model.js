const db = require('../config/database');

function normalizePage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value, fallback = 15) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return fallback;
  return parsed;
}

function stringifyAuditValue(value) {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return JSON.stringify({ value: String(value) });
  }
}

function buildFilters({ q = '', action = '', entityType = '', userId = '' } = {}) {
  const where = [];
  const params = [];
  const keyword = String(q || '').trim();
  const actionFilter = String(action || '').trim();
  const entityTypeFilter = String(entityType || '').trim();
  const safeUserId = Number(userId);

  if (keyword) {
    where.push('(al.action LIKE ? OR al.entity_type LIKE ? OR al.role LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  if (actionFilter) {
    where.push('al.action = ?');
    params.push(actionFilter);
  }

  if (entityTypeFilter) {
    where.push('al.entity_type = ?');
    params.push(entityTypeFilter);
  }

  if (Number.isInteger(safeUserId) && safeUserId > 0) {
    where.push('al.user_id = ?');
    params.push(safeUserId);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

async function createAuditLog({
  userId = null,
  role = null,
  action,
  entityType,
  entityId = null,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null,
}) {
  const result = await db.query(
    `INSERT INTO audit_logs
      (user_id, role, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId || null,
      role || null,
      action,
      entityType,
      entityId || null,
      stringifyAuditValue(oldValues),
      stringifyAuditValue(newValues),
      ipAddress || null,
      userAgent || null,
    ]
  );

  return result.insertId;
}

async function listAuditLogs({ q = '', action = '', entityType = '', userId = '', page = 1, limit = 15 } = {}) {
  const safePage = normalizePage(page);
  const safeLimit = normalizeLimit(limit);
  const offset = (safePage - 1) * safeLimit;
  const { whereSql, params } = buildFilters({ q, action, entityType, userId });

  return db.query(
    `SELECT al.id, al.user_id, al.role, al.action, al.entity_type, al.entity_id,
            al.old_values, al.new_values, al.ip_address, al.user_agent, al.created_at,
            u.name AS user_name, u.email AS user_email
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ${whereSql}
     ORDER BY al.created_at DESC, al.id DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
}

async function countAuditLogs(filters = {}) {
  const { whereSql, params } = buildFilters(filters);
  const rows = await db.query(
    `SELECT COUNT(al.id) AS total
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ${whereSql}`,
    params
  );

  return Number(rows[0]?.total || 0);
}

async function getAuditActions() {
  return db.query(
    `SELECT DISTINCT al.action
     FROM audit_logs al
     ORDER BY al.action ASC`
  );
}

async function getAuditEntityTypes() {
  return db.query(
    `SELECT DISTINCT al.entity_type
     FROM audit_logs al
     ORDER BY al.entity_type ASC`
  );
}

module.exports = {
  createAuditLog,
  listAuditLogs,
  countAuditLogs,
  getAuditActions,
  getAuditEntityTypes,
};
