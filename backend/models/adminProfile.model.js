const db = require('../config/database');

let cachedUserColumns = null;

async function getUserColumns() {
  if (cachedUserColumns) return cachedUserColumns;

  const rows = await db.query('SHOW COLUMNS FROM users');
  cachedUserColumns = new Set(rows.map((row) => row.Field));
  return cachedUserColumns;
}

async function hasUserColumn(columnName) {
  const columns = await getUserColumns();
  return columns.has(columnName);
}

async function getAdminProfile(adminId) {
  const columns = await getUserColumns();
  const optionalFields = [];

  if (columns.has('updated_at')) {
    optionalFields.push('u.updated_at');
  }

  if (columns.has('last_login_at')) {
    optionalFields.push('u.last_login_at');
  }

  const selectFields = [
    'u.id',
    'u.name',
    'u.email',
    'u.phone',
    'u.password',
    'u.role',
    'u.status',
    'u.created_at',
    ...optionalFields,
  ].join(', ');

  const rows = await db.query(
    `SELECT ${selectFields}
     FROM users u
     WHERE u.id = ?
       AND u.role = 'admin'
     LIMIT 1`,
    [adminId]
  );

  return rows[0] || null;
}

async function updateAdminProfile(adminId, { name, phone }) {
  const useUpdatedAt = await hasUserColumn('updated_at');
  const setUpdatedAt = useUpdatedAt ? ', u.updated_at = NOW()' : '';

  const result = await db.query(
    `UPDATE users u
     SET u.name = ?,
         u.phone = ?
         ${setUpdatedAt}
     WHERE u.id = ?
       AND u.role = 'admin'`,
    [name, phone || null, adminId]
  );

  return result.affectedRows > 0;
}

async function updateAdminPassword(adminId, passwordHash) {
  const useUpdatedAt = await hasUserColumn('updated_at');
  const setUpdatedAt = useUpdatedAt ? ', u.updated_at = NOW()' : '';

  const result = await db.query(
    `UPDATE users u
     SET u.password = ?
         ${setUpdatedAt}
     WHERE u.id = ?
       AND u.role = 'admin'`,
    [passwordHash, adminId]
  );

  return result.affectedRows > 0;
}

module.exports = {
  getAdminProfile,
  updateAdminProfile,
  updateAdminPassword,
};
