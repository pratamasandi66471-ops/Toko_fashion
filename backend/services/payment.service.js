const SUCCESS_PAYMENT_STATUS = 'paid';
const FAILED_PAYMENT_STATUS = 'failed';
const ALLOWED_PAYMENT_STATUSES = new Set(['unpaid', 'pending_verification', 'paid', 'failed']);
const ORDER_PAYMENT_STATUSES = new Set(['unpaid', 'paid', 'failed', 'refunded']);

function createPaymentError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getPaymentSuccessStatus() {
  return SUCCESS_PAYMENT_STATUS;
}

function getPaymentFailedStatus() {
  return FAILED_PAYMENT_STATUS;
}

function assertConnection(connection) {
  if (!connection || typeof connection.execute !== 'function') {
    throw new Error('A MySQL transaction connection is required.');
  }
}

async function getPaymentForUpdate(connection, paymentId) {
  assertConnection(connection);

  const [rows] = await connection.execute(
    `SELECT pay.id, pay.order_id, pay.status AS payment_status,
            o.id AS locked_order_id, o.status AS order_status,
            o.order_status AS legacy_order_status, o.payment_status AS order_payment_status
     FROM payments pay
     INNER JOIN orders o ON o.id = pay.order_id
     WHERE pay.id = ?
     LIMIT 1
     FOR UPDATE`,
    [paymentId]
  );

  return rows[0] || null;
}

function assertPaymentExists(payment) {
  if (!payment) {
    throw createPaymentError('PAYMENT_NOT_FOUND', 'Payment tidak ditemukan.');
  }
}

function assertOrderCanBeVerified(payment) {
  if (['cancelled', 'completed'].includes(payment.order_status)) {
    throw createPaymentError('ORDER_NOT_VERIFIABLE', 'Payment tidak bisa diverifikasi untuk order cancelled/completed.');
  }
}

function assertPaymentCanBeRejected(payment) {
  if (payment.payment_status === SUCCESS_PAYMENT_STATUS) {
    throw createPaymentError('PAYMENT_ALREADY_PAID', 'Payment yang sudah paid tidak bisa ditolak.');
  }
}

async function verifyPaymentTransaction(connection, paymentId) {
  assertConnection(connection);

  const payment = await getPaymentForUpdate(connection, paymentId);
  assertPaymentExists(payment);

  if (payment.payment_status === SUCCESS_PAYMENT_STATUS) {
    return {
      paymentId,
      orderId: payment.locked_order_id,
      status: SUCCESS_PAYMENT_STATUS,
      alreadyProcessed: true,
    };
  }

  assertOrderCanBeVerified(payment);

  await connection.execute(
    `UPDATE payments pay
     SET pay.status = ?,
         pay.paid_at = COALESCE(pay.paid_at, NOW())
     WHERE pay.id = ?`,
    [SUCCESS_PAYMENT_STATUS, paymentId]
  );

  const shouldMoveOrder = payment.order_status === 'pending';
  await connection.execute(
    `UPDATE orders o
     SET o.payment_status = ?,
         o.status = CASE WHEN ? THEN 'processing' ELSE o.status END,
         o.order_status = CASE WHEN ? THEN 'confirmed' ELSE o.order_status END,
         o.updated_at = NOW()
     WHERE o.id = ?`,
    [SUCCESS_PAYMENT_STATUS, shouldMoveOrder ? 1 : 0, shouldMoveOrder ? 1 : 0, payment.locked_order_id]
  );

  return {
    paymentId,
    orderId: payment.locked_order_id,
    status: SUCCESS_PAYMENT_STATUS,
    alreadyProcessed: false,
  };
}

async function rejectPaymentTransaction(connection, paymentId) {
  assertConnection(connection);

  const payment = await getPaymentForUpdate(connection, paymentId);
  assertPaymentExists(payment);
  assertPaymentCanBeRejected(payment);

  if (payment.payment_status === FAILED_PAYMENT_STATUS) {
    return {
      paymentId,
      orderId: payment.locked_order_id,
      status: FAILED_PAYMENT_STATUS,
      alreadyProcessed: true,
    };
  }

  await connection.execute(
    `UPDATE payments pay
     SET pay.status = ?
     WHERE pay.id = ?`,
    [FAILED_PAYMENT_STATUS, paymentId]
  );

  await connection.execute(
    `UPDATE orders o
     SET o.payment_status = ?,
         o.updated_at = NOW()
     WHERE o.id = ?`,
    [FAILED_PAYMENT_STATUS, payment.locked_order_id]
  );

  return {
    paymentId,
    orderId: payment.locked_order_id,
    status: FAILED_PAYMENT_STATUS,
    alreadyProcessed: false,
  };
}

module.exports = {
  SUCCESS_PAYMENT_STATUS,
  FAILED_PAYMENT_STATUS,
  ALLOWED_PAYMENT_STATUSES,
  ORDER_PAYMENT_STATUSES,
  getPaymentSuccessStatus,
  getPaymentFailedStatus,
  getPaymentForUpdate,
  verifyPaymentTransaction,
  rejectPaymentTransaction,
};
