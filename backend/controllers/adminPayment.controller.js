const adminPaymentModel = require('../models/adminPayment.model');
const auditService = require('../services/audit.service');
const emailService = require('../services/email.service');

const PAYMENT_LIMIT = 10;

function getWibDateLabel() {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
}

function normalizePage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function isValidId(value) {
  return Number.isInteger(value) && value > 0;
}

function getFilters(query) {
  return {
    q: String(query.q || '').trim(),
    status: String(query.status || '').trim(),
    method: String(query.method || '').trim(),
    page: normalizePage(query.page),
  };
}

function getBaseRenderData() {
  return {
    layout: 'layouts/dashboard',
    activeMenu: 'payments',
    pageStyles: ['/css/admin/pages/payments.css'],
    currentDateWib: getWibDateLabel(),
  };
}

function redirectToPayment(paymentId) {
  return isValidId(paymentId) ? `/admin/payments/${paymentId}` : '/admin/payments';
}

async function index(req, res, next) {
  try {
    const filters = getFilters(req.query);
    const [payments, total, summary, methods] = await Promise.all([
      adminPaymentModel.listPayments({ ...filters, limit: PAYMENT_LIMIT }),
      adminPaymentModel.countPayments(filters),
      adminPaymentModel.getPaymentSummary(),
      adminPaymentModel.getPaymentMethods(),
    ]);

    return res.render('admin/payments/index', {
      ...getBaseRenderData(),
      pageTitle: 'Payment Verification',
      filters,
      payments,
      summary,
      methods,
      pagination: {
        page: filters.page,
        limit: PAYMENT_LIMIT,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAYMENT_LIMIT)),
      },
      paymentStatuses: Array.from(adminPaymentModel.ALLOWED_PAYMENT_STATUSES),
    });
  } catch (error) {
    return next(error);
  }
}

async function show(req, res, next) {
  try {
    const paymentId = Number(req.params.id);
    if (!isValidId(paymentId)) {
      req.flash('error', 'Payment tidak valid.');
      return res.redirect('/admin/payments');
    }

    const payment = await adminPaymentModel.getPaymentDetail(paymentId);
    if (!payment) {
      req.flash('error', 'Payment tidak ditemukan.');
      return res.redirect('/admin/payments');
    }

    return res.render('admin/payments/detail', {
      ...getBaseRenderData(),
      pageTitle: payment.invoice_number || payment.order_code || 'Payment Detail',
      payment,
      successPaymentStatus: adminPaymentModel.SUCCESS_PAYMENT_STATUS,
      failedPaymentStatus: adminPaymentModel.FAILED_PAYMENT_STATUS,
    });
  } catch (error) {
    return next(error);
  }
}

async function verify(req, res, next) {
  const paymentId = Number(req.params.id);
  if (!isValidId(paymentId)) {
    req.flash('error', 'Payment tidak valid.');
    return res.redirect('/admin/payments');
  }

  try {
    const oldPayment = await adminPaymentModel.getPaymentDetail(paymentId);
    await adminPaymentModel.verifyPayment(paymentId);

    try {
      const payment = await adminPaymentModel.getPaymentDetail(paymentId);
      if (payment) {
        await auditService.logActivity(req, {
          action: 'PAYMENT_VERIFIED',
          entityType: 'payment',
          entityId: paymentId,
          oldValues: oldPayment ? {
            payment_status: oldPayment.payment_status,
            order_payment_status: oldPayment.order_payment_status,
            order_status: oldPayment.order_status,
          } : null,
          newValues: {
            payment_status: payment.payment_status,
            order_payment_status: payment.order_payment_status,
            order_status: payment.order_status,
          },
        });

        await emailService.sendPaymentVerifiedEmail({
          customer: {
            name: payment.customer_name,
            email: payment.customer_email,
          },
          order: {
            invoice_number: payment.invoice_number,
            order_code: payment.order_code,
            total_amount: payment.total_amount,
          },
        });
      }
    } catch (emailError) {
      console.error('[email] Failed to send payment verified email:', emailError);
    }

    req.flash('success', 'Payment berhasil diverifikasi.');
    return res.redirect(redirectToPayment(paymentId));
  } catch (error) {
    if (['PAYMENT_NOT_FOUND', 'ORDER_NOT_VERIFIABLE'].includes(error.code)) {
      req.flash('error', error.message);
      return res.redirect(redirectToPayment(paymentId));
    }

    return next(error);
  }
}

async function reject(req, res, next) {
  const paymentId = Number(req.params.id);
  if (!isValidId(paymentId)) {
    req.flash('error', 'Payment tidak valid.');
    return res.redirect('/admin/payments');
  }

  try {
    const oldPayment = await adminPaymentModel.getPaymentDetail(paymentId);
    await adminPaymentModel.rejectPayment(paymentId);
    const payment = await adminPaymentModel.getPaymentDetail(paymentId);
    await auditService.logActivity(req, {
      action: 'PAYMENT_REJECTED',
      entityType: 'payment',
      entityId: paymentId,
      oldValues: oldPayment ? {
        payment_status: oldPayment.payment_status,
        order_payment_status: oldPayment.order_payment_status,
      } : null,
      newValues: payment ? {
        payment_status: payment.payment_status,
        order_payment_status: payment.order_payment_status,
      } : { payment_status: adminPaymentModel.FAILED_PAYMENT_STATUS },
    });
    req.flash('success', 'Payment berhasil ditolak.');
    return res.redirect(redirectToPayment(paymentId));
  } catch (error) {
    if (['PAYMENT_NOT_FOUND', 'PAYMENT_ALREADY_PAID'].includes(error.code)) {
      req.flash('error', error.message);
      return res.redirect(redirectToPayment(paymentId));
    }

    return next(error);
  }
}

module.exports = {
  index,
  show,
  verify,
  reject,
};
