require('dotenv').config({ quiet: true });

const app = require('./app');
const db = require('./config/database');

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  try {
    await db.query('SELECT 1 AS ok');
    console.log('Database connection: OK');
  } catch (error) {
    console.error('Database connection: FAILED');
    console.error(error.code || error.message || error);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`S Fashion server running on http://localhost:${PORT}`);
  });
}

startServer();
