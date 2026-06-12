const mysql = require('mysql2/promise');

module.exports = async function globalSetup() {
  process.env.NODE_ENV = 'test';
  process.env.DB_NAME = 'toko_test';

  if (process.env.DB_NAME !== 'toko_test') {
    throw new Error(`Refusing to run tests against DB_NAME=${process.env.DB_NAME}. Use toko_test only.`);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    const [rows] = await connection.execute(
      `SELECT SCHEMA_NAME
       FROM INFORMATION_SCHEMA.SCHEMATA
       WHERE SCHEMA_NAME = ?`,
      [process.env.DB_NAME]
    );

    if (rows.length === 0) {
      throw new Error(
        'Test database toko_test does not exist. Create it and load schema/seed before running npm test.'
      );
    }
  } finally {
    await connection.end();
  }
};
