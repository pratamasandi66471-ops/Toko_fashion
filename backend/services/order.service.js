const {
  generateOrderCode,
  generateInvoiceNumber,
  generateUniqueOrderField,
} = require('../helper/generateInvoice');

const ALLOWED_MAIN_STATUSES = new Set(['pending', 'processing', 'shipped', 'completed', 'cancelled']);

const MAIN_TO_ORDER_STATUS = {
  pending: 'pending',
  processing: 'confirmed',
  shipped: 'shipped',
  completed: 'completed',
  cancelled: 'cancelled',
};

const FORWARD_TRANSITIONS = {
  pending: new Set(['processing', 'cancelled']),
  processing: new Set(['shipped', 'cancelled']),
  shipped: new Set(['completed']),
  completed: new Set([]),
  cancelled: new Set([]),
};

// Statuses eligible for returns/refunds
const RETURN_ELIGIBLE_STATUSES = new Set(['shipped', 'completed']);

// Staff-restricted transitions (more limited than admin)
const STAFF_ALLOWED_TRANSITIONS = {
  pending: new Set(['processing']),
  processing: new Set(['shipped']),
  shipped: new Set(['completed']),
  completed: new Set([]),
  cancelled: new Set([]),
};

function normalizeOrderStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  return ALLOWED_MAIN_STATUSES.has(normalized) ? normalized : '';
}

function createOrderError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertAllowedOrderStatus(status) {
  const normalized = normalizeOrderStatus(status);
  if (!normalized) {
    throw createOrderError('INVALID_ORDER_STATUS', 'Status order tidak valid.');
  }

  return normalized;
}

function mapMainStatusToOrderStatus(status) {
  const normalized = assertAllowedOrderStatus(status);
  return MAIN_TO_ORDER_STATUS[normalized];
}

function validateOrderStatusTransition(currentStatus, nextStatus, options = {}) {
  const current = assertAllowedOrderStatus(currentStatus);
  const next = assertAllowedOrderStatus(nextStatus);

  if (current === next) {
    return {
      valid: true,
      currentStatus: current,
      nextStatus: next,
      orderStatus: mapMainStatusToOrderStatus(next),
    };
  }

  if (options.allowAnyValid === true) {
    return {
      valid: true,
      currentStatus: current,
      nextStatus: next,
      orderStatus: mapMainStatusToOrderStatus(next),
    };
  }

  const allowedNext = FORWARD_TRANSITIONS[current] || new Set();
  if (!allowedNext.has(next)) {
    throw createOrderError(
      'INVALID_ORDER_STATUS_TRANSITION',
      `Transisi status ${current} ke ${next} tidak diizinkan.`
    );
  }

  return {
    valid: true,
    currentStatus: current,
    nextStatus: next,
    orderStatus: mapMainStatusToOrderStatus(next),
  };
}

async function generateUniqueOrderCode(connection) {
  return generateUniqueOrderField(connection, {
    field: 'order_code',
    prefix: 'ORD',
  });
}

async function generateUniqueInvoiceNumber(connection) {
  return generateUniqueOrderField(connection, {
    field: 'invoice_number',
    prefix: 'INV',
  });
}

function isStatusEligibleForReturn(status) {
  const normalized = normalizeOrderStatus(status);
  return RETURN_ELIGIBLE_STATUSES.has(normalized);
}

function validateStaffOrderStatusTransition(currentStatus, nextStatus) {
  const current = assertAllowedOrderStatus(currentStatus);
  const next = assertAllowedOrderStatus(nextStatus);

  if (current === next) {
    return {
      valid: true,
      currentStatus: current,
      nextStatus: next,
      orderStatus: mapMainStatusToOrderStatus(next),
    };
  }

  const allowedNext = STAFF_ALLOWED_TRANSITIONS[current] || new Set();
  if (!allowedNext.has(next)) {
    throw createOrderError(
      'INVALID_ORDER_STATUS_TRANSITION',
      `Staf tidak bisa mengubah status dari ${current} ke ${next}.`
    );
  }

  return {
    valid: true,
    currentStatus: current,
    nextStatus: next,
    orderStatus: mapMainStatusToOrderStatus(next),
  };
}

function canCancelOrder(currentStatus) {
  const normalized = normalizeOrderStatus(currentStatus);
  if (!normalized) return false;
  // Can cancel from pending or processing, but not from shipped or completed
  return FORWARD_TRANSITIONS[normalized].has('cancelled');
}

function getInitialOrderStatus() {
  return {
    status: 'pending',
    orderStatus: mapMainStatusToOrderStatus('pending'),
  };
}

module.exports = {
  ALLOWED_MAIN_STATUSES,
  MAIN_TO_ORDER_STATUS,
  FORWARD_TRANSITIONS,
  RETURN_ELIGIBLE_STATUSES,
  STAFF_ALLOWED_TRANSITIONS,
  createOrderError,
  normalizeOrderStatus,
  assertAllowedOrderStatus,
  mapMainStatusToOrderStatus,
  validateOrderStatusTransition,
  validateStaffOrderStatusTransition,
  isStatusEligibleForReturn,
  canCancelOrder,
  getInitialOrderStatus,
  generateOrderCode,
  generateInvoiceNumber,
  generateUniqueOrderCode,
  generateUniqueInvoiceNumber,
};
