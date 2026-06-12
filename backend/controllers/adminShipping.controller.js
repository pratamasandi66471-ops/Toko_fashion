const shippingModel = require('../models/shipping.model');
const auditService = require('../services/audit.service');

function getWibDateLabel() {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
}

function viewData(extra = {}) {
  return {
    layout: 'layouts/dashboard',
    activeMenu: 'shipping',
    currentDateWib: getWibDateLabel(),
    pageStyles: ['/css/admin/pages/shipping.css'],
    ...extra,
  };
}

function normalizeCode(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function toMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function toSortOrder(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : 0;
}

async function validatePayload(body, excludeId = null) {
  const old = {
    code: normalizeCode(body.code),
    name: String(body.name || '').trim(),
    description: String(body.description || '').trim(),
    cost: toMoney(body.cost),
    estimated_days: String(body.estimated_days || '').trim(),
    status: String(body.status || 'active').trim().toLowerCase(),
    sort_order: toSortOrder(body.sort_order),
  };

  const formErrors = {};

  if (!old.code) formErrors.code = 'Kode shipping wajib diisi.';
  if (old.code && !/^[a-z0-9_-]{2,50}$/.test(old.code)) {
    formErrors.code = 'Kode shipping harus 2-50 karakter, huruf kecil, angka, -, atau _.';
  }
  if (!old.name) formErrors.name = 'Nama shipping wajib diisi.';
  if (old.name.length > 100) formErrors.name = 'Nama shipping maksimal 100 karakter.';
  if (old.description.length > 500) formErrors.description = 'Deskripsi maksimal 500 karakter.';
  if (!Number.isFinite(old.cost) || old.cost < 0) formErrors.cost = 'Biaya shipping harus angka minimal 0.';
  if (old.estimated_days.length > 50) formErrors.estimated_days = 'Estimasi maksimal 50 karakter.';
  if (!['active', 'inactive'].includes(old.status)) formErrors.status = 'Status shipping tidak valid.';

  if (old.code && await shippingModel.isCodeTaken(old.code, excludeId)) {
    formErrors.code = 'Kode shipping sudah dipakai.';
  }

  return { old, formErrors };
}

async function index(req, res, next) {
  try {
    const filters = {
      q: String(req.query.q || '').trim(),
      status: String(req.query.status || '').trim(),
    };
    const methods = await shippingModel.listShippingMethods(filters);

    return res.render('admin/shipping/index', viewData({
      pageTitle: 'Shipping Management',
      methods,
      filters,
    }));
  } catch (error) {
    return next(error);
  }
}

function showCreate(req, res) {
  return res.render('admin/shipping/create', viewData({
    pageTitle: 'Create Shipping Method',
    old: { status: 'active', sort_order: 0, cost: 0 },
    formErrors: {},
  }));
}

async function create(req, res, next) {
  try {
    const { old, formErrors } = await validatePayload(req.body);

    if (Object.keys(formErrors).length > 0) {
      res.status(422);
      return res.render('admin/shipping/create', viewData({
        pageTitle: 'Create Shipping Method',
        old,
        formErrors,
      }));
    }

    const shippingId = await shippingModel.createShippingMethod(old);
    await auditService.logActivity(req, {
      action: 'SHIPPING_METHOD_CREATED',
      entityType: 'shipping_method',
      entityId: shippingId,
      newValues: old,
    });
    req.flash('success', 'Metode shipping berhasil dibuat.');
    return res.redirect('/admin/shipping');
  } catch (error) {
    return next(error);
  }
}

async function showEdit(req, res, next) {
  try {
    const method = await shippingModel.findById(Number(req.params.id));
    if (!method) {
      req.flash('error', 'Metode shipping tidak ditemukan.');
      return res.redirect('/admin/shipping');
    }

    return res.render('admin/shipping/edit', viewData({
      pageTitle: 'Edit Shipping Method',
      method,
      old: method,
      formErrors: {},
    }));
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const shippingId = Number(req.params.id);
    const method = await shippingModel.findById(shippingId);

    if (!method) {
      req.flash('error', 'Metode shipping tidak ditemukan.');
      return res.redirect('/admin/shipping');
    }

    const { old, formErrors } = await validatePayload(req.body, shippingId);

    if (Object.keys(formErrors).length > 0) {
      res.status(422);
      return res.render('admin/shipping/edit', viewData({
        pageTitle: 'Edit Shipping Method',
        method,
        old: { ...method, ...old },
        formErrors,
      }));
    }

    await shippingModel.updateShippingMethod(shippingId, old);
    const updated = await shippingModel.findById(shippingId);
    await auditService.logActivity(req, {
      action: 'SHIPPING_METHOD_UPDATED',
      entityType: 'shipping_method',
      entityId: shippingId,
      oldValues: method,
      newValues: updated || old,
    });
    req.flash('success', 'Metode shipping berhasil diperbarui.');
    return res.redirect('/admin/shipping');
  } catch (error) {
    return next(error);
  }
}

async function toggleStatus(req, res, next) {
  try {
    const shippingId = Number(req.params.id);
    const method = await shippingModel.findById(shippingId);
    const updated = method ? await shippingModel.toggleStatus(shippingId) : false;
    const updatedMethod = updated ? await shippingModel.findById(shippingId) : null;

    if (updated) {
      await auditService.logActivity(req, {
        action: 'SHIPPING_METHOD_STATUS_TOGGLED',
        entityType: 'shipping_method',
        entityId: shippingId,
        oldValues: method ? { code: method.code, status: method.status } : null,
        newValues: updatedMethod ? { code: updatedMethod.code, status: updatedMethod.status } : null,
      });
    }

    req.flash(updated ? 'success' : 'error', updated ? 'Status shipping berhasil diperbarui.' : 'Metode shipping tidak ditemukan.');
    return res.redirect('/admin/shipping');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index,
  showCreate,
  create,
  showEdit,
  update,
  toggleStatus,
};
