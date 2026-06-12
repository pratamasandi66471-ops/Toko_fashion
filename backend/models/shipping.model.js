const db = require('../config/database');

const DEFAULT_SHIPPING_METHODS = Object.freeze([
  { key: 'regular', code: 'regular', label: 'Reguler', name: 'Reguler', description: 'Pengiriman standar untuk pesanan S Fashion.', cost: 15000, estimated_days: '2-4 hari', status: 'active', sort_order: 10 },
  { key: 'express', code: 'express', label: 'Express', name: 'Express', description: 'Pengiriman lebih cepat untuk area yang tersedia.', cost: 30000, estimated_days: '1-2 hari', status: 'active', sort_order: 20 },
]);

function isMissingTableError(error) {
  return error?.code === 'ER_NO_SUCH_TABLE' || error?.errno === 1146;
}

function toOption(row) {
  return {
    id: row.id ? Number(row.id) : null,
    key: row.code,
    code: row.code,
    label: row.name,
    name: row.name,
    description: row.description || '',
    cost: Number(row.cost || 0),
    estimated_days: row.estimated_days || '',
    status: row.status || 'active',
    sort_order: Number(row.sort_order || 0),
  };
}

function buildFilters({ q = '', status = '' } = {}) {
  const where = [];
  const params = [];
  const keyword = String(q || '').trim();
  const statusFilter = String(status || '').trim();

  if (keyword) {
    where.push('(sm.code LIKE ? OR sm.name LIKE ? OR sm.description LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  if (['active', 'inactive'].includes(statusFilter)) {
    where.push('sm.status = ?');
    params.push(statusFilter);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

async function listShippingMethods(filters = {}) {
  const { whereSql, params } = buildFilters(filters);

  return db.query(
    `SELECT sm.id, sm.code, sm.name, sm.description, sm.cost, sm.estimated_days,
            sm.status, sm.sort_order, sm.created_at, sm.updated_at
     FROM shipping_methods sm
     ${whereSql}
     ORDER BY sm.sort_order ASC, sm.id ASC`,
    params
  );
}

async function listActiveShippingMethods() {
  try {
    const rows = await db.query(
      `SELECT sm.id, sm.code, sm.name, sm.description, sm.cost, sm.estimated_days,
              sm.status, sm.sort_order
       FROM shipping_methods sm
       WHERE sm.status = 'active'
       ORDER BY sm.sort_order ASC, sm.id ASC`
    );

    return rows.map(toOption);
  } catch (error) {
    if (isMissingTableError(error)) {
      return DEFAULT_SHIPPING_METHODS.map((method) => ({ ...method }));
    }

    throw error;
  }
}

async function findById(id) {
  const rows = await db.query(
    `SELECT sm.id, sm.code, sm.name, sm.description, sm.cost, sm.estimated_days,
            sm.status, sm.sort_order, sm.created_at, sm.updated_at
     FROM shipping_methods sm
     WHERE sm.id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function findByCode(code, conn = null, { activeOnly = false, forUpdate = false } = {}) {
  const runner = conn || db.pool;
  const params = [code];
  const activeSql = activeOnly ? "AND sm.status = 'active'" : '';
  const lockSql = forUpdate ? 'FOR UPDATE' : '';
  const sql = `SELECT sm.id, sm.code, sm.name, sm.description, sm.cost, sm.estimated_days,
                      sm.status, sm.sort_order, sm.created_at, sm.updated_at
               FROM shipping_methods sm
               WHERE sm.code = ?
                 ${activeSql}
               LIMIT 1
               ${lockSql}`;

  try {
    if (conn) {
      const [rows] = await runner.execute(sql, params);
      return rows[0] ? toOption(rows[0]) : null;
    }

    const rows = await db.query(sql, params);
    return rows[0] ? toOption(rows[0]) : null;
  } catch (error) {
    if (isMissingTableError(error)) {
      return DEFAULT_SHIPPING_METHODS.find((method) => method.code === code) || null;
    }

    throw error;
  }
}

async function isCodeTaken(code, excludeId = null) {
  const params = [code];
  let sql = `SELECT sm.id FROM shipping_methods sm WHERE sm.code = ?`;

  if (excludeId) {
    sql += ' AND sm.id <> ?';
    params.push(excludeId);
  }

  sql += ' LIMIT 1';
  const rows = await db.query(sql, params);
  return rows.length > 0;
}

async function createShippingMethod(data) {
  const result = await db.query(
    `INSERT INTO shipping_methods
      (code, name, description, cost, estimated_days, status, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.code,
      data.name,
      data.description || null,
      data.cost,
      data.estimated_days || null,
      data.status,
      data.sort_order,
    ]
  );

  return result.insertId;
}

async function updateShippingMethod(id, data) {
  const result = await db.query(
    `UPDATE shipping_methods sm
     SET sm.code = ?,
         sm.name = ?,
         sm.description = ?,
         sm.cost = ?,
         sm.estimated_days = ?,
         sm.status = ?,
         sm.sort_order = ?
     WHERE sm.id = ?`,
    [
      data.code,
      data.name,
      data.description || null,
      data.cost,
      data.estimated_days || null,
      data.status,
      data.sort_order,
      id,
    ]
  );

  return result.affectedRows > 0;
}

async function toggleStatus(id) {
  const result = await db.query(
    `UPDATE shipping_methods sm
     SET sm.status = CASE WHEN sm.status = 'active' THEN 'inactive' ELSE 'active' END
     WHERE sm.id = ?`,
    [id]
  );

  return result.affectedRows > 0;
}

module.exports = {
  DEFAULT_SHIPPING_METHODS,
  listShippingMethods,
  listActiveShippingMethods,
  findById,
  findByCode,
  isCodeTaken,
  createShippingMethod,
  updateShippingMethod,
  toggleStatus,
};
