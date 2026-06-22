const db = require('../config/database');

const NOTIFICATION_TYPES = Object.freeze(['info', 'success', 'warning', 'danger']);
const NOTIFICATION_AUDIENCES = Object.freeze(['admin', 'staff', 'customer', 'all']);
const NOTIFICATION_STATUSES = Object.freeze(['draft', 'published', 'archived']);

function normalizePage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return fallback;
  return parsed;
}

function normalizeEnum(value, allowed) {
  const text = String(value || '').trim().toLowerCase();
  return allowed.includes(text) ? text : '';
}

function buildFilters({ q = '', type = '', audience = '', status = '' } = {}) {
  const where = [];
  const params = [];
  const keyword = String(q || '').trim();
  const safeType = normalizeEnum(type, NOTIFICATION_TYPES);
  const safeAudience = normalizeEnum(audience, NOTIFICATION_AUDIENCES);
  const safeStatus = normalizeEnum(status, NOTIFICATION_STATUSES);

  if (keyword) {
    where.push('(n.title LIKE ? OR n.message LIKE ? OR n.action_label LIKE ? OR n.action_url LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  if (safeType) {
    where.push('n.type = ?');
    params.push(safeType);
  }

  if (safeAudience) {
    where.push('n.audience = ?');
    params.push(safeAudience);
  }

  if (safeStatus) {
    where.push('n.status = ?');
    params.push(safeStatus);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

async function listNotifications({ q = '', type = '', audience = '', status = '', page = 1, limit = 10 } = {}) {
  const safePage = normalizePage(page);
  const safeLimit = normalizeLimit(limit);
  const offset = (safePage - 1) * safeLimit;
  const { whereSql, params } = buildFilters({ q, type, audience, status });

  return db.query(
    `SELECT n.id, n.title, n.message, n.type, n.audience, n.status,
            n.action_label, n.action_url, n.is_pinned, n.created_by,
            n.published_at, n.created_at, n.updated_at,
            u.name AS created_by_name, u.email AS created_by_email
     FROM notifications n
     LEFT JOIN users u ON u.id = n.created_by
     ${whereSql}
     ORDER BY n.is_pinned DESC, n.created_at DESC, n.id DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
}

async function countNotifications(filters = {}) {
  const { whereSql, params } = buildFilters(filters);
  const rows = await db.query(
    `SELECT COUNT(n.id) AS total
     FROM notifications n
     LEFT JOIN users u ON u.id = n.created_by
     ${whereSql}`,
    params
  );

  return Number(rows[0]?.total || 0);
}

async function findById(notificationId) {
  const rows = await db.query(
    `SELECT n.id, n.title, n.message, n.type, n.audience, n.status,
            n.action_label, n.action_url, n.is_pinned, n.created_by,
            n.published_at, n.created_at, n.updated_at,
            u.name AS created_by_name, u.email AS created_by_email
     FROM notifications n
     LEFT JOIN users u ON u.id = n.created_by
     WHERE n.id = ?
     LIMIT 1`,
    [notificationId]
  );

  return rows[0] || null;
}

async function createNotification(data) {
  const result = await db.query(
    `INSERT INTO notifications
      (title, message, type, audience, status, action_label, action_url, is_pinned, created_by, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.title,
      data.message,
      data.type,
      data.audience,
      data.status,
      data.action_label || null,
      data.action_url || null,
      data.is_pinned ? 1 : 0,
      data.created_by || null,
      data.status === 'published' ? new Date() : null,
    ]
  );

  return result.insertId;
}

async function updateNotification(notificationId, data) {
  const result = await db.query(
    `UPDATE notifications n
     SET n.title = ?,
         n.message = ?,
         n.type = ?,
         n.audience = ?,
         n.status = ?,
         n.action_label = ?,
         n.action_url = ?,
         n.is_pinned = ?,
         n.published_at = CASE
           WHEN n.status <> 'published' AND ? = 'published' THEN NOW()
           WHEN ? <> 'published' THEN NULL
           ELSE n.published_at
         END
     WHERE n.id = ?`,
    [
      data.title,
      data.message,
      data.type,
      data.audience,
      data.status,
      data.action_label || null,
      data.action_url || null,
      data.is_pinned ? 1 : 0,
      data.status,
      data.status,
      notificationId,
    ]
  );

  return result.affectedRows > 0;
}

async function setStatus(notificationId, status) {
  const safeStatus = normalizeEnum(status, NOTIFICATION_STATUSES);
  if (!safeStatus) {
    const error = new Error('Status notifikasi tidak valid.');
    error.code = 'INVALID_NOTIFICATION_STATUS';
    throw error;
  }

  const result = await db.query(
    `UPDATE notifications n
     SET n.status = ?,
         n.published_at = CASE WHEN ? = 'published' THEN COALESCE(n.published_at, NOW()) ELSE NULL END
     WHERE n.id = ?`,
    [safeStatus, safeStatus, notificationId]
  );

  return result.affectedRows > 0;
}

module.exports = {
  NOTIFICATION_TYPES,
  NOTIFICATION_AUDIENCES,
  NOTIFICATION_STATUSES,
  listNotifications,
  countNotifications,
  findById,
  createNotification,
  updateNotification,
  setStatus,
};
