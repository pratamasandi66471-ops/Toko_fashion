const db = require('../config/database');

async function findByEmail(email) {
  const rows = await db.query(
    `SELECT id, name, email, phone, password, role, status, created_at, updated_at
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );

  return rows[0] || null;
}

async function findById(id) {
  const rows = await db.query(
    `SELECT id, name, email, phone, role, status, created_at, updated_at
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function emailExists(email) {
  const rows = await db.query(
    `SELECT 1
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );

  return rows.length > 0;
}

async function createCustomer({ name, email, phone, passwordHash }) {
  const result = await db.query(
    `INSERT INTO users (name, email, phone, password, role, status)
     VALUES (?, ?, ?, ?, 'customer', 'active')`,
    [name, email, phone || null, passwordHash]
  );

  return findById(result.insertId);
}

async function listByRole(role) {
  return db.query(
    `SELECT id, name, email, phone, role, status, created_at, updated_at
     FROM users
     WHERE role = ?
     ORDER BY created_at DESC`,
    [role]
  );
}

async function createUser({ name, email, passwordHash, role = 'customer', phone = null }) {
  if (role === 'customer') {
    return createCustomer({ name, email, phone, passwordHash });
  }

  const result = await db.query(
    `INSERT INTO users (name, email, phone, password, role, status)
     VALUES (?, ?, ?, ?, ?, 'active')`,
    [name, email, phone, passwordHash, role]
  );

  return findById(result.insertId);
}

module.exports = {
  findByEmail,
  findById,
  emailExists,
  createCustomer,
  createUser,
  listByRole,
};
