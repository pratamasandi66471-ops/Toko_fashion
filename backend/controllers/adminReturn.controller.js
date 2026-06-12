const adminReturnModel = require('../models/adminReturn.model');
const auditService = require('../services/audit.service');

const RETURN_LIMIT = 10;

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

function getBaseRenderData(extra = {}) {
  return {
    layout: 'layouts/dashboard',
    activeMenu: 'returns',
    currentDateWib: getWibDateLabel(),
    pageStyles: ['/css/admin/pages/returns.css'],
    ...extra,
  };
}

function isValidId(value) {
  return Number.isInteger(value) && value > 0;
}

function normalizeMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : NaN;
}

function validateCreatePayload(body) {
  const old = {
    order_lookup: String(body.order_lookup || '').trim(),
    reason: String(body.reason || '').trim(),
    admin_note: String(body.admin_note || '').trim(),
    refund_amount: String(body.refund_amount ?? '0').trim(),
    status: String(body.status || 'requested').trim().toLowerCase(),
  };
  const formErrors = {};
  const refundAmount = normalizeMoney(old.refund_amount);

  if (!old.order_lookup) formErrors.order_lookup = 'Order code, invoice, atau ID order wajib diisi.';
  if (!old.reason) formErrors.reason = 'Alasan return wajib diisi.';
  if (old.reason.length > 1000) formErrors.reason = 'Alasan return maksimal 1000 karakter.';
  if (old.admin_note.length > 1000) formErrors.admin_note = 'Catatan admin maksimal 1000 karakter.';
  if (!Number.isFinite(refundAmount)) formErrors.refund_amount = 'Nominal refund harus angka minimal 0.';
  if (!adminReturnModel.RETURN_STATUSES.includes(old.status)) formErrors.status = 'Status return tidak valid.';

  return {
    old,
    formErrors,
    refundAmount: Number.isFinite(refundAmount) ? refundAmount : 0,
  };
}

async function index(req, res, next) {
  try {
    const filters = {
      q: String(req.query.q || '').trim(),
      status: String(req.query.status || '').trim(),
      page: normalizePage(req.query.page),
    };
    const [returns, total] = await Promise.all([
      adminReturnModel.listReturns({ ...filters, limit: RETURN_LIMIT }),
      adminReturnModel.countReturns(filters),
    ]);

    return res.render('admin/returns/index', getBaseRenderData({
      pageTitle: 'Returns / Refunds',
      returns,
      filters,
      returnStatuses: adminReturnModel.RETURN_STATUSES,
      pagination: {
        page: filters.page,
        limit: RETURN_LIMIT,
        total,
        totalPages: Math.max(1, Math.ceil(total / RETURN_LIMIT)),
      },
    }));
  } catch (error) {
    return next(error);
  }
}

function showCreate(req, res) {
  return res.render('admin/returns/create', getBaseRenderData({
    pageTitle: 'Create Return',
    old: { status: 'requested', refund_amount: 0 },
    formErrors: {},
    returnStatuses: adminReturnModel.RETURN_STATUSES,
  }));
}

async function create(req, res, next) {
  try {
    const { old, formErrors, refundAmount } = validateCreatePayload(req.body);

    if (Object.keys(formErrors).length > 0) {
      res.status(422);
      return res.render('admin/returns/create', getBaseRenderData({
        pageTitle: 'Create Return',
        old,
        formErrors,
        returnStatuses: adminReturnModel.RETURN_STATUSES,
      }));
    }

    const order = await adminReturnModel.findOrderForReturn(old.order_lookup);
    if (!order) {
      res.status(422);
      return res.render('admin/returns/create', getBaseRenderData({
        pageTitle: 'Create Return',
        old,
        formErrors: { order_lookup: 'Order tidak ditemukan.' },
        returnStatuses: adminReturnModel.RETURN_STATUSES,
      }));
    }

    if (!adminReturnModel.ELIGIBLE_ORDER_STATUSES.includes(order.status)) {
      res.status(422);
      return res.render('admin/returns/create', getBaseRenderData({
        pageTitle: 'Create Return',
        old,
        formErrors: { order_lookup: 'Return hanya bisa dibuat untuk order shipped atau completed.' },
        returnStatuses: adminReturnModel.RETURN_STATUSES,
      }));
    }

    if (await adminReturnModel.hasReturnForOrder(order.id)) {
      res.status(422);
      return res.render('admin/returns/create', getBaseRenderData({
        pageTitle: 'Create Return',
        old,
        formErrors: { order_lookup: 'Order ini sudah memiliki return request.' },
        returnStatuses: adminReturnModel.RETURN_STATUSES,
      }));
    }

    const created = await adminReturnModel.createReturnRequest({
      orderId: order.id,
      customerId: order.customer_id,
      reason: old.reason,
      adminNote: old.admin_note,
      refundAmount,
      status: old.status,
    });

    await auditService.logActivity(req, {
      action: 'RETURN_REQUEST_CREATED',
      entityType: 'return_request',
      entityId: created.id,
      newValues: {
        return_code: created.returnCode,
        order_id: order.id,
        status: old.status,
        refund_amount: refundAmount,
      },
    });

    req.flash('success', 'Return request berhasil dibuat.');
    return res.redirect(`/admin/returns/${created.id}`);
  } catch (error) {
    return next(error);
  }
}

async function show(req, res, next) {
  try {
    const returnId = Number(req.params.id);
    if (!isValidId(returnId)) {
      req.flash('error', 'Return request tidak valid.');
      return res.redirect('/admin/returns');
    }

    const [returnRequest, items] = await Promise.all([
      adminReturnModel.getReturnDetail(returnId),
      adminReturnModel.getReturnItems(returnId),
    ]);

    if (!returnRequest) {
      req.flash('error', 'Return request tidak ditemukan.');
      return res.redirect('/admin/returns');
    }

    return res.render('admin/returns/detail', getBaseRenderData({
      pageTitle: returnRequest.return_code,
      returnRequest,
      items,
      returnStatuses: adminReturnModel.RETURN_STATUSES,
    }));
  } catch (error) {
    return next(error);
  }
}

async function updateStatus(req, res, next) {
  const returnId = Number(req.params.id);
  if (!isValidId(returnId)) {
    req.flash('error', 'Return request tidak valid.');
    return res.redirect('/admin/returns');
  }

  try {
    const before = await adminReturnModel.getReturnDetail(returnId);
    const affectedRows = before ? await adminReturnModel.updateReturnStatus(returnId, req.body.status) : 0;

    if (!affectedRows) {
      req.flash('error', 'Return request tidak ditemukan atau status tidak berubah.');
      return res.redirect(`/admin/returns/${returnId}`);
    }

    const after = await adminReturnModel.getReturnDetail(returnId);
    await auditService.logActivity(req, {
      action: 'RETURN_STATUS_UPDATED',
      entityType: 'return_request',
      entityId: returnId,
      oldValues: before ? { status: before.status } : null,
      newValues: after ? { status: after.status } : { status: req.body.status },
    });

    req.flash('success', 'Status return berhasil diperbarui.');
    return res.redirect(`/admin/returns/${returnId}`);
  } catch (error) {
    if (error.code === 'INVALID_RETURN_STATUS') {
      req.flash('error', error.message);
      return res.redirect(`/admin/returns/${returnId}`);
    }

    return next(error);
  }
}

async function updateNote(req, res, next) {
  const returnId = Number(req.params.id);
  if (!isValidId(returnId)) {
    req.flash('error', 'Return request tidak valid.');
    return res.redirect('/admin/returns');
  }

  try {
    const refundAmount = normalizeMoney(req.body.refund_amount);
    if (!Number.isFinite(refundAmount)) {
      req.flash('error', 'Nominal refund harus angka minimal 0.');
      return res.redirect(`/admin/returns/${returnId}`);
    }

    const before = await adminReturnModel.getReturnDetail(returnId);
    const affectedRows = before ? await adminReturnModel.updateAdminNote(returnId, {
      adminNote: req.body.admin_note,
      refundAmount,
    }) : 0;

    if (!affectedRows) {
      req.flash('error', 'Return request tidak ditemukan.');
      return res.redirect(`/admin/returns/${returnId}`);
    }

    const after = await adminReturnModel.getReturnDetail(returnId);
    await auditService.logActivity(req, {
      action: 'RETURN_NOTE_UPDATED',
      entityType: 'return_request',
      entityId: returnId,
      oldValues: before ? { admin_note: before.admin_note, refund_amount: before.refund_amount } : null,
      newValues: after ? { admin_note: after.admin_note, refund_amount: after.refund_amount } : null,
    });

    req.flash('success', 'Catatan return berhasil diperbarui.');
    return res.redirect(`/admin/returns/${returnId}`);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index,
  showCreate,
  create,
  show,
  updateStatus,
  updateNote,
};
