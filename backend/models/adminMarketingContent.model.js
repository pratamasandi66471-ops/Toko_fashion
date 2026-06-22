const db = require('../config/database');

const CONTENT_TYPES = Object.freeze(['promotion', 'banner', 'announcement']);
const CONTENT_STATUSES = Object.freeze(['active', 'inactive']);
const CONTENT_PLACEMENTS = Object.freeze(['homepage', 'shop', 'product_detail', 'global']);

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
  return CONTENT_TYPES.includes(type) ? type : '';
}

function normalizeStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return CONTENT_STATUSES.includes(status) ? status : '';
}

function buildFilters({ q = '', type = '', status = '', placement = '' } = {}) {
  const where = [];
  const params = [];
  const keyword = String(q || '').trim();
  const safeType = normalizeType(type);
  const safeStatus = normalizeStatus(status);
  const safePlacement = String(placement || '').trim().toLowerCase();

  if (keyword) {
    where.push('(mc.title LIKE ? OR mc.subtitle LIKE ? OR mc.body LIKE ? OR mc.placement LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  if (safeType) {
    where.push('mc.content_type = ?');
    params.push(safeType);
  }

  if (safeStatus) {
    where.push('mc.status = ?');
    params.push(safeStatus);
  }

  if (safePlacement) {
    where.push('mc.placement = ?');
    params.push(safePlacement);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

async function listContents({ q = '', type = '', status = '', placement = '', page = 1, limit = 10 } = {}) {
  const safePage = normalizePage(page);
  const safeLimit = normalizeLimit(limit);
  const offset = (safePage - 1) * safeLimit;
  const { whereSql, params } = buildFilters({ q, type, status, placement });

  return db.query(
    `SELECT mc.id, mc.content_type, mc.title, mc.subtitle, mc.body, mc.image_url,
            mc.cta_label, mc.cta_url, mc.placement, mc.status, mc.sort_order,
            mc.starts_at, mc.ends_at, mc.created_at, mc.updated_at
     FROM marketing_contents mc
     ${whereSql}
     ORDER BY mc.sort_order ASC, mc.created_at DESC, mc.id DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
}

async function countContents(filters = {}) {
  const { whereSql, params } = buildFilters(filters);
  const rows = await db.query(
    `SELECT COUNT(mc.id) AS total
     FROM marketing_contents mc
     ${whereSql}`,
    params
  );

  return Number(rows[0]?.total || 0);
}

async function findById(contentId) {
  const rows = await db.query(
    `SELECT mc.id, mc.content_type, mc.title, mc.subtitle, mc.body, mc.image_url,
            mc.cta_label, mc.cta_url, mc.placement, mc.status, mc.sort_order,
            mc.starts_at, mc.ends_at, mc.created_at, mc.updated_at
     FROM marketing_contents mc
     WHERE mc.id = ?
     LIMIT 1`,
    [contentId]
  );

  return rows[0] || null;
}

async function createContent(data) {
  const result = await db.query(
    `INSERT INTO marketing_contents
      (content_type, title, subtitle, body, image_url, cta_label, cta_url, placement, status, sort_order, starts_at, ends_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.content_type,
      data.title,
      data.subtitle || null,
      data.body || null,
      data.image_url || null,
      data.cta_label || null,
      data.cta_url || null,
      data.placement,
      data.status,
      data.sort_order,
      data.starts_at || null,
      data.ends_at || null,
    ]
  );

  return result.insertId;
}

async function updateContent(contentId, data) {
  const result = await db.query(
    `UPDATE marketing_contents mc
     SET mc.content_type = ?,
         mc.title = ?,
         mc.subtitle = ?,
         mc.body = ?,
         mc.image_url = ?,
         mc.cta_label = ?,
         mc.cta_url = ?,
         mc.placement = ?,
         mc.status = ?,
         mc.sort_order = ?,
         mc.starts_at = ?,
         mc.ends_at = ?
     WHERE mc.id = ?`,
    [
      data.content_type,
      data.title,
      data.subtitle || null,
      data.body || null,
      data.image_url || null,
      data.cta_label || null,
      data.cta_url || null,
      data.placement,
      data.status,
      data.sort_order,
      data.starts_at || null,
      data.ends_at || null,
      contentId,
    ]
  );

  return result.affectedRows > 0;
}

async function toggleStatus(contentId) {
  const result = await db.query(
    `UPDATE marketing_contents mc
     SET mc.status = CASE WHEN mc.status = 'active' THEN 'inactive' ELSE 'active' END
     WHERE mc.id = ?`,
    [contentId]
  );

  return result.affectedRows > 0;
}

module.exports = {
  CONTENT_TYPES,
  CONTENT_STATUSES,
  CONTENT_PLACEMENTS,
  listContents,
  countContents,
  findById,
  createContent,
  updateContent,
  toggleStatus,
};
