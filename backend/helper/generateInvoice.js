const ALLOWED_ORDER_FIELDS = new Set(['order_code', 'invoice_number']);

function formatDatePart(date = new Date()) {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getDate()).padStart(2, '0');

  return `${year}${month}${day}`;
}

function randomDigits(length = 4) {
  const safeLength = Number.isInteger(length) && length > 0 ? length : 4;
  return String(Math.floor(Math.random() * (10 ** safeLength))).padStart(safeLength, '0');
}

function generateCode(prefix, options = {}) {
  const safePrefix = String(prefix || '').trim().toUpperCase();
  if (!safePrefix) {
    throw new Error('Code prefix is required.');
  }

  const datePart = formatDatePart(options.date);
  const digits = randomDigits(options.digitLength || 4);

  return `${safePrefix}-${datePart}-${digits}`;
}

function generateOrderCode(options = {}) {
  return generateCode('ORD', options);
}

function generateInvoiceNumber(options = {}) {
  return generateCode('INV', options);
}

async function generateUniqueOrderField(connection, { field, prefix, attempts = 8 } = {}) {
  if (!connection || typeof connection.execute !== 'function') {
    throw new Error('A MySQL connection with execute() is required.');
  }

  if (!ALLOWED_ORDER_FIELDS.has(field)) {
    throw new Error('Invalid unique order field target.');
  }

  const safeAttempts = Number.isInteger(attempts) && attempts > 0 ? attempts : 8;
  const lookupSql = `SELECT 1 FROM orders WHERE ${field} = ? LIMIT 1`;

  for (let attempt = 0; attempt < safeAttempts; attempt += 1) {
    const code = generateCode(prefix, { digitLength: 4 });
    const [rows] = await connection.execute(lookupSql, [code]);

    if (rows.length === 0) {
      return code;
    }
  }

  throw new Error(`Failed to generate unique ${field}.`);
}

module.exports = generateInvoiceNumber;
module.exports.formatDatePart = formatDatePart;
module.exports.randomDigits = randomDigits;
module.exports.generateCode = generateCode;
module.exports.generateOrderCode = generateOrderCode;
module.exports.generateInvoiceNumber = generateInvoiceNumber;
module.exports.generateUniqueOrderField = generateUniqueOrderField;
