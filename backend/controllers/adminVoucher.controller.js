const adminVoucherModel = require('../models/adminVoucher.model');

const VOUCHER_LIMIT = 10;

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
    type: String(query.type || '').trim(),
    page: normalizePage(query.page),
  };
}

function getBaseRenderData() {
  return {
    layout: 'layouts/dashboard',
    activeMenu: 'coupons',
    pageStyles: ['/css/admin/pages/coupons.css'],
    currentDateWib: getWibDateLabel(),
  };
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}

function toNullableNumber(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return Number(value);
}

function toNullableDate(value) {
  const text = String(value || '').trim();
  return text ? text.replace('T', ' ') : null;
}

function toDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getVoucherPayload(body) {
  return {
    code: normalizeCode(body.code),
    type: String(body.type || '').trim().toLowerCase(),
    value: toNullableNumber(body.value),
    max_discount: toNullableNumber(body.max_discount),
    min_purchase: toNullableNumber(body.min_purchase) ?? 0,
    usage_limit: toNullableNumber(body.usage_limit),
    start_date: toNullableDate(body.start_date),
    end_date: toNullableDate(body.end_date),
    status: String(body.status || 'active').trim().toLowerCase(),
  };
}

function validateVoucherPayload(payload) {
  const errors = {};

  if (!payload.code) {
    errors.code = 'Kode voucher wajib diisi.';
  } else if (/\s/.test(payload.code)) {
    errors.code = 'Kode voucher tidak boleh mengandung spasi.';
  } else if (payload.code.length > 50) {
    errors.code = 'Kode voucher maksimal 50 karakter.';
  }

  if (!adminVoucherModel.ALLOWED_VOUCHER_TYPES.has(payload.type)) {
    errors.type = 'Tipe voucher tidak valid.';
  }

  if (!Number.isFinite(payload.value) || payload.value <= 0) {
    errors.value = 'Value wajib berupa angka lebih dari 0.';
  } else if (payload.type === 'percentage' && payload.value > 100) {
    errors.value = 'Voucher percentage maksimal 100%.';
  }

  if (payload.type === 'percentage') {
    if (!Number.isFinite(payload.max_discount) || payload.max_discount <= 0) {
      errors.max_discount = 'Max discount wajib diisi untuk voucher percentage.';
    }
  } else if (payload.max_discount !== null && (!Number.isFinite(payload.max_discount) || payload.max_discount < 0)) {
    errors.max_discount = 'Max discount harus minimal 0 atau dikosongkan.';
  }

  if (!Number.isFinite(payload.min_purchase) || payload.min_purchase < 0) {
    errors.min_purchase = 'Min purchase minimal 0.';
  }

  if (payload.usage_limit !== null && (!Number.isInteger(payload.usage_limit) || payload.usage_limit <= 0)) {
    errors.usage_limit = 'Usage limit harus angka bulat lebih dari 0 atau dikosongkan.';
  }

  if (!adminVoucherModel.ALLOWED_VOUCHER_STATUSES.has(payload.status)) {
    errors.status = 'Status voucher tidak valid.';
  }

  const startDate = payload.start_date ? new Date(payload.start_date) : null;
  const endDate = payload.end_date ? new Date(payload.end_date) : null;

  if (payload.start_date && Number.isNaN(startDate.getTime())) {
    errors.start_date = 'Start date tidak valid.';
  }

  if (payload.end_date && Number.isNaN(endDate.getTime())) {
    errors.end_date = 'End date tidak valid.';
  }

  if (startDate && endDate && endDate < startDate) {
    errors.end_date = 'End date tidak boleh lebih awal dari start date.';
  }

  return errors;
}

function prepareViewVoucher(voucher = {}) {
  return {
    ...voucher,
    start_date: toDateInputValue(voucher.start_date),
    end_date: toDateInputValue(voucher.end_date),
  };
}

function renderForm(res, view, data = {}) {
  return res.render(view, {
    ...getBaseRenderData(),
    pageTitle: data.pageTitle,
    voucher: data.voucher || { status: 'active', type: 'fixed', min_purchase: 0 },
    formErrors: data.formErrors || {},
    typeOptions: Array.from(adminVoucherModel.ALLOWED_VOUCHER_TYPES),
    statusOptions: Array.from(adminVoucherModel.ALLOWED_VOUCHER_STATUSES),
  });
}

async function index(req, res, next) {
  try {
    const filters = getFilters(req.query);
    const [vouchers, total] = await Promise.all([
      adminVoucherModel.listVouchers({ ...filters, limit: VOUCHER_LIMIT }),
      adminVoucherModel.countVouchers(filters),
    ]);

    return res.render('admin/coupons/index', {
      ...getBaseRenderData(),
      pageTitle: 'Coupons',
      filters,
      vouchers,
      typeOptions: Array.from(adminVoucherModel.ALLOWED_VOUCHER_TYPES),
      statusOptions: Array.from(adminVoucherModel.ALLOWED_VOUCHER_STATUSES),
      pagination: {
        page: filters.page,
        limit: VOUCHER_LIMIT,
        total,
        totalPages: Math.max(1, Math.ceil(total / VOUCHER_LIMIT)),
      },
    });
  } catch (error) {
    return next(error);
  }
}

function showCreate(req, res) {
  return renderForm(res, 'admin/coupons/create', {
    pageTitle: 'Create Coupon',
  });
}

async function create(req, res, next) {
  try {
    const payload = getVoucherPayload(req.body);
    const formErrors = validateVoucherPayload(payload);

    if (!formErrors.code && await adminVoucherModel.isCodeTaken(payload.code)) {
      formErrors.code = 'Kode voucher sudah digunakan.';
    }

    if (Object.keys(formErrors).length > 0) {
      req.flash('error', 'Periksa kembali data coupon.');
      res.status(422);
      return renderForm(res, 'admin/coupons/create', {
        pageTitle: 'Create Coupon',
        voucher: payload,
        formErrors,
      });
    }

    await adminVoucherModel.createVoucher(payload);
    req.flash('success', 'Coupon berhasil dibuat.');
    return res.redirect('/admin/coupons');
  } catch (error) {
    return next(error);
  }
}

async function showEdit(req, res, next) {
  const voucherId = Number(req.params.id);
  if (!isValidId(voucherId)) {
    req.flash('error', 'Coupon tidak valid.');
    return res.redirect('/admin/coupons');
  }

  try {
    const voucher = await adminVoucherModel.findById(voucherId);

    if (!voucher) {
      req.flash('error', 'Coupon tidak ditemukan.');
      return res.redirect('/admin/coupons');
    }

    return renderForm(res, 'admin/coupons/edit', {
      pageTitle: `Edit ${voucher.code}`,
      voucher: prepareViewVoucher(voucher),
    });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  const voucherId = Number(req.params.id);
  if (!isValidId(voucherId)) {
    req.flash('error', 'Coupon tidak valid.');
    return res.redirect('/admin/coupons');
  }

  try {
    const voucher = await adminVoucherModel.findById(voucherId);

    if (!voucher) {
      req.flash('error', 'Coupon tidak ditemukan.');
      return res.redirect('/admin/coupons');
    }

    const payload = getVoucherPayload(req.body);
    const formErrors = validateVoucherPayload(payload);

    if (!formErrors.code && await adminVoucherModel.isCodeTaken(payload.code, voucherId)) {
      formErrors.code = 'Kode voucher sudah digunakan.';
    }

    if (Object.keys(formErrors).length > 0) {
      req.flash('error', 'Periksa kembali data coupon.');
      res.status(422);
      return renderForm(res, 'admin/coupons/edit', {
        pageTitle: `Edit ${voucher.code}`,
        voucher: { ...voucher, ...payload },
        formErrors,
      });
    }

    await adminVoucherModel.updateVoucher(voucherId, payload);
    req.flash('success', 'Coupon berhasil diperbarui.');
    return res.redirect(`/admin/coupons/${voucherId}/edit`);
  } catch (error) {
    return next(error);
  }
}

async function toggleStatus(req, res, next) {
  const voucherId = Number(req.params.id);
  if (!isValidId(voucherId)) {
    req.flash('error', 'Coupon tidak valid.');
    return res.redirect('/admin/coupons');
  }

  try {
    const affectedRows = await adminVoucherModel.toggleStatus(voucherId);
    req.flash(affectedRows ? 'success' : 'error', affectedRows ? 'Status coupon berhasil diperbarui.' : 'Coupon tidak ditemukan.');
    return res.redirect(req.get('Referer') || '/admin/coupons');
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
