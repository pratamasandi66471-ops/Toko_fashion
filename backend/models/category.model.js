const db = require('../config/database');

async function listCategories({ search = '', status = '' } = {}) {
  const where = [];
  const params = [];

if (search) {
  where.push("(c.name LIKE ? OR c.slug LIKE ?)");
  params.push(`%${search}%`, `%${search}%`);
}

if (["active", "inactive"].includes(status)) {
  where.push("c.status = ?");
  params.push(status);
}

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  return db.query(
    `SELECT c.id, c.name, c.slug, c.description, c.image, c.status, c.created_at, c.updated_at,
            COUNT(p.id) AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
     ${whereSql}
     GROUP BY c.id, c.name, c.slug, c.description, c.image, c.status, c.created_at, c.updated_at
     ORDER BY c.created_at DESC, c.name ASC`,
    params
  );
}

async function listActiveCategories() {
  return db.query(
    `SELECT id, name, slug, description, image, status
     FROM categories
     WHERE status = 'active'
     ORDER BY name ASC`
  );
}

async function findById(id) {
  const rows = await db.query(
    `SELECT id, name, slug, description, image, status, created_at, updated_at
     FROM categories
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function findBySlug(slug) {
  const rows = await db.query(
    `SELECT id, name, slug, description, image, status
     FROM categories
     WHERE slug = ?
     LIMIT 1`,
    [slug]
  );

  return rows[0] || null;
}

async function isSlugTaken(slug, excludeId = null) {
  const params = [slug];
  let sql = 'SELECT id FROM categories WHERE slug = ?';

  if (excludeId) {
    sql += ' AND id <> ?';
    params.push(excludeId);
  }

  sql += ' LIMIT 1';
  const rows = await db.query(sql, params);
  return rows.length > 0;
}

async function createCategory({ name, slug, description, image, status }) {
  const result = await db.query(
    `INSERT INTO categories (name, slug, description, image, status)
     VALUES (?, ?, ?, ?, ?)`,
    [name, slug, description || null, image || null, status]
  );

  return result.insertId;
}

async function updateCategory(id, { name, slug, description, image, status }) {
  const result = await db.query(
    `UPDATE categories
     SET name = ?, slug = ?, description = ?, image = ?, status = ?, updated_at = NOW()
     WHERE id = ?`,
    [name, slug, description || null, image || null, status, id]
  );

  return result.affectedRows > 0;
}

async function toggleStatus(id) {
  const result = await db.query(
    `UPDATE categories
     SET status = CASE WHEN status = 'active' THEN 'inactive' ELSE 'active' END,
         updated_at = NOW()
     WHERE id = ?`,
    [id]
  );

  return result.affectedRows > 0;
}

module.exports = {
  listCategories,
  listActiveCategories,
  findById,
  findBySlug,
  isSlugTaken,
  createCategory,
  updateCategory,
  toggleStatus,
};
