const bcrypt = require('bcrypt');
const adminUserModel = require('../models/adminUser.model');
const auditService = require('../services/audit.service');

const STAFF_LIMIT = 10;
const PASSWORD_MIN_LENGTH = 8;

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
    page: normalizePage(query.page),
  };
}

function getBaseRenderData() {
  return {
    layout: 'layouts/dashboard',
    activeMenu: 'staff',
    pageStyles: ['/css/admin/pages/staff-management.css'],
    currentDateWib: getWibDateLabel(),
  };
}

function getStaffPayload(body) {
  return {
    name: String(body.name || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    phone: String(body.phone || '').trim(),
    status: String(body.status || 'active').trim().toLowerCase(),
    password: String(body.password || ''),
  };
}

function validateStaffPayload(payload, { requirePassword = false } = {}) {
  const errors = {};

  if (!payload.name) errors.name = 'Nama staff wajib diisi.';
  if (!payload.email) {
    errors.email = 'Email staff wajib diisi.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    errors.email = 'Format email tidak valid.';
  }

  if (!adminUserModel.ALLOWED_USER_STATUSES.has(payload.status)) {
    errors.status = 'Status user tidak valid.';
  }

  if (requirePassword && payload.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Password minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  }

  if (!requirePassword && payload.password && payload.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Password baru minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  }

  return errors;
}

function renderCreate(res, data = {}) {
  return res.render('admin/staff/create', {
    ...getBaseRenderData(),
    pageTitle: 'Create Staff',
    staff: data.staff || {},
    errors: data.errors || {},
    allowedStatuses: Array.from(adminUserModel.ALLOWED_USER_STATUSES),
  });
}

function renderEdit(res, staff, data = {}) {
  return res.render('admin/staff/edit', {
    ...getBaseRenderData(),
    pageTitle: `Edit ${staff.name || 'Staff'}`,
    staff,
    errors: data.errors || {},
    allowedStatuses: Array.from(adminUserModel.ALLOWED_USER_STATUSES),
  });
}

async function index(req, res, next) {
  try {
    const filters = getFilters(req.query);
    const [staff, total] = await Promise.all([
      adminUserModel.listStaff({ ...filters, limit: STAFF_LIMIT }),
      adminUserModel.countStaff(filters),
    ]);

    return res.render('admin/staff/index', {
      ...getBaseRenderData(),
      pageTitle: 'Staff Management',
      filters,
      staff,
      allowedStatuses: Array.from(adminUserModel.ALLOWED_USER_STATUSES),
      pagination: {
        page: filters.page,
        limit: STAFF_LIMIT,
        total,
        totalPages: Math.max(1, Math.ceil(total / STAFF_LIMIT)),
      },
    });
  } catch (error) {
    return next(error);
  }
}

function showCreate(req, res) {
  return renderCreate(res);
}

async function create(req, res, next) {
  const payload = getStaffPayload(req.body);
  const errors = validateStaffPayload(payload, { requirePassword: true });

  try {
    if (!errors.email && await adminUserModel.isEmailTaken(payload.email)) {
      errors.email = 'Email sudah digunakan.';
    }

    if (Object.keys(errors).length > 0) {
      req.flash('error', 'Periksa kembali data staff.');
      return renderCreate(res, { staff: payload, errors });
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const staffId = await adminUserModel.createStaff({ ...payload, passwordHash });
    await auditService.logActivity(req, {
      action: 'STAFF_CREATED',
      entityType: 'user',
      entityId: staffId,
      newValues: {
        name: payload.name,
        email: payload.email,
        phone: payload.phone || null,
        status: payload.status,
        role: adminUserModel.STAFF_ROLE,
      },
    });

    req.flash('success', 'Staff berhasil dibuat.');
    return res.redirect(`/admin/staff/${staffId}/edit`);
  } catch (error) {
    return next(error);
  }
}

async function showEdit(req, res, next) {
  const staffId = Number(req.params.id);
  if (!isValidId(staffId)) {
    req.flash('error', 'Staff tidak valid.');
    return res.redirect('/admin/staff');
  }

  try {
    const staff = await adminUserModel.getStaffById(staffId);

    if (!staff) {
      req.flash('error', 'Staff tidak ditemukan.');
      return res.redirect('/admin/staff');
    }

    return renderEdit(res, staff);
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  const staffId = Number(req.params.id);
  if (!isValidId(staffId)) {
    req.flash('error', 'Staff tidak valid.');
    return res.redirect('/admin/staff');
  }

  try {
    const existingStaff = await adminUserModel.getStaffById(staffId);

    if (!existingStaff) {
      req.flash('error', 'Staff tidak ditemukan.');
      return res.redirect('/admin/staff');
    }

    const payload = getStaffPayload(req.body);
    const errors = validateStaffPayload(payload, { requirePassword: false });

    if (!errors.email && await adminUserModel.isEmailTaken(payload.email, staffId)) {
      errors.email = 'Email sudah digunakan.';
    }

    if (Object.keys(errors).length > 0) {
      req.flash('error', 'Periksa kembali data staff.');
      return renderEdit(res, { ...existingStaff, ...payload }, { errors });
    }

    const affectedRows = await adminUserModel.updateStaff(staffId, payload);
    if (!affectedRows) {
      req.flash('error', 'Staff tidak ditemukan atau data tidak berubah.');
      return res.redirect('/admin/staff');
    }

    if (payload.password) {
      const passwordHash = await bcrypt.hash(payload.password, 10);
      await adminUserModel.updateStaffPassword(staffId, passwordHash);
    }

    const updatedStaff = await adminUserModel.getStaffById(staffId);
    await auditService.logActivity(req, {
      action: 'STAFF_UPDATED',
      entityType: 'user',
      entityId: staffId,
      oldValues: existingStaff,
      newValues: {
        ...(updatedStaff || {
          name: payload.name,
          email: payload.email,
          phone: payload.phone || null,
          status: payload.status,
        }),
        password_changed: Boolean(payload.password),
      },
    });

    req.flash('success', 'Data staff berhasil diperbarui.');
    return res.redirect(`/admin/staff/${staffId}/edit`);
  } catch (error) {
    return next(error);
  }
}

async function updateStatus(req, res, next) {
  const staffId = Number(req.params.id);
  if (!isValidId(staffId)) {
    req.flash('error', 'Staff tidak valid.');
    return res.redirect('/admin/staff');
  }

  try {
    const staff = await adminUserModel.getStaffById(staffId);
    const affectedRows = await adminUserModel.updateUserStatus(
      staffId,
      req.body.status,
      adminUserModel.STAFF_ROLE
    );

    if (!affectedRows) {
      req.flash('error', 'Staff tidak ditemukan atau status tidak berubah.');
      return res.redirect('/admin/staff');
    }

    const updatedStaff = await adminUserModel.getStaffById(staffId);
    await auditService.logActivity(req, {
      action: 'STAFF_STATUS_UPDATED',
      entityType: 'user',
      entityId: staffId,
      oldValues: staff ? { status: staff.status, name: staff.name, email: staff.email, role: adminUserModel.STAFF_ROLE } : null,
      newValues: updatedStaff ? { status: updatedStaff.status, name: updatedStaff.name, email: updatedStaff.email, role: adminUserModel.STAFF_ROLE } : {
        status: req.body.status,
        role: adminUserModel.STAFF_ROLE,
      },
    });

    req.flash('success', 'Status staff berhasil diperbarui.');
    return res.redirect(req.get('Referer') || '/admin/staff');
  } catch (error) {
    if (error.code === 'INVALID_USER_STATUS') {
      req.flash('error', error.message);
      return res.redirect(req.get('Referer') || '/admin/staff');
    }

    return next(error);
  }
}

module.exports = {
  index,
  showCreate,
  create,
  showEdit,
  update,
  updateStatus,
};
