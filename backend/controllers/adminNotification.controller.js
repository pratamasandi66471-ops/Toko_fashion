const notificationModel = require('../models/adminNotification.model');
const auditService = require('../services/audit.service');

const NOTIFICATION_LIMIT = 10;

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
    activeMenu: 'notifications',
    currentDateWib: getWibDateLabel(),
    pageStyles: ['/css/admin/pages/notifications.css'],
    typeOptions: notificationModel.NOTIFICATION_TYPES,
    audienceOptions: notificationModel.NOTIFICATION_AUDIENCES,
    statusOptions: notificationModel.NOTIFICATION_STATUSES,
    ...extra,
  };
}

function isValidId(value) {
  return Number.isInteger(value) && value > 0;
}

function isValidActionUrl(value) {
  const url = String(value || '').trim();
  if (!url) return true;
  if (url.startsWith('/') && !url.startsWith('//')) return true;

  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (_error) {
    return false;
  }
}

function payloadFromBody(body, userId = null) {
  return {
    title: String(body.title || '').trim(),
    message: String(body.message || '').trim(),
    type: String(body.type || 'info').trim().toLowerCase(),
    audience: String(body.audience || 'admin').trim().toLowerCase(),
    status: String(body.status || 'draft').trim().toLowerCase(),
    action_label: String(body.action_label || '').trim(),
    action_url: String(body.action_url || '').trim(),
    is_pinned: body.is_pinned === 'on' || body.is_pinned === '1' || body.is_pinned === true,
    created_by: userId,
  };
}

function validatePayload(payload) {
  const errors = {};

  if (!payload.title) {
    errors.title = 'Title wajib diisi.';
  } else if (payload.title.length > 150) {
    errors.title = 'Title maksimal 150 karakter.';
  }

  if (!payload.message) {
    errors.message = 'Message wajib diisi.';
  } else if (payload.message.length > 2000) {
    errors.message = 'Message maksimal 2000 karakter.';
  }

  if (!notificationModel.NOTIFICATION_TYPES.includes(payload.type)) {
    errors.type = 'Tipe notifikasi tidak valid.';
  }

  if (!notificationModel.NOTIFICATION_AUDIENCES.includes(payload.audience)) {
    errors.audience = 'Audience notifikasi tidak valid.';
  }

  if (!notificationModel.NOTIFICATION_STATUSES.includes(payload.status)) {
    errors.status = 'Status notifikasi tidak valid.';
  }

  if (payload.action_label.length > 80) {
    errors.action_label = 'Action label maksimal 80 karakter.';
  }

  if (!isValidActionUrl(payload.action_url)) {
    errors.action_url = 'Action URL harus berupa path internal /... atau URL http:// / https://.';
  }

  return errors;
}

function getFilters(query) {
  return {
    q: String(query.q || '').trim(),
    type: String(query.type || '').trim(),
    audience: String(query.audience || '').trim(),
    status: String(query.status || '').trim(),
    page: normalizePage(query.page),
  };
}

async function index(req, res, next) {
  try {
    const filters = getFilters(req.query);
    const [notifications, total] = await Promise.all([
      notificationModel.listNotifications({ ...filters, limit: NOTIFICATION_LIMIT }),
      notificationModel.countNotifications(filters),
    ]);

    return res.render('admin/notifications/index', getBaseRenderData({
      pageTitle: 'Notifications',
      notifications,
      filters,
      pagination: {
        page: filters.page,
        limit: NOTIFICATION_LIMIT,
        total,
        totalPages: Math.max(1, Math.ceil(total / NOTIFICATION_LIMIT)),
      },
    }));
  } catch (error) {
    return next(error);
  }
}

function showCreate(req, res) {
  return res.render('admin/notifications/create', getBaseRenderData({
    pageTitle: 'Create Notification',
    old: {
      type: 'info',
      audience: 'admin',
      status: 'draft',
      is_pinned: false,
    },
    formErrors: {},
  }));
}

async function create(req, res, next) {
  try {
    const payload = payloadFromBody(req.body, req.session?.user?.id || null);
    const formErrors = validatePayload(payload);

    if (Object.keys(formErrors).length > 0) {
      res.status(422);
      return res.render('admin/notifications/create', getBaseRenderData({
        pageTitle: 'Create Notification',
        old: payload,
        formErrors,
      }));
    }

    const notificationId = await notificationModel.createNotification(payload);
    await auditService.logActivity(req, {
      action: 'NOTIFICATION_CREATED',
      entityType: 'notification',
      entityId: notificationId,
      newValues: payload,
    });

    req.flash('success', 'Notifikasi berhasil dibuat.');
    return res.redirect('/admin/notifications');
  } catch (error) {
    return next(error);
  }
}

async function showEdit(req, res, next) {
  try {
    const notification = await notificationModel.findById(Number(req.params.id));
    if (!notification) {
      req.flash('error', 'Notifikasi tidak ditemukan.');
      return res.redirect('/admin/notifications');
    }

    return res.render('admin/notifications/edit', getBaseRenderData({
      pageTitle: 'Edit Notification',
      notification,
      old: notification,
      formErrors: {},
    }));
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const notificationId = Number(req.params.id);
    const notification = await notificationModel.findById(notificationId);
    if (!notification) {
      req.flash('error', 'Notifikasi tidak ditemukan.');
      return res.redirect('/admin/notifications');
    }

    const payload = payloadFromBody(req.body, notification.created_by || req.session?.user?.id || null);
    const formErrors = validatePayload(payload);

    if (Object.keys(formErrors).length > 0) {
      res.status(422);
      return res.render('admin/notifications/edit', getBaseRenderData({
        pageTitle: 'Edit Notification',
        notification,
        old: payload,
        formErrors,
      }));
    }

    await notificationModel.updateNotification(notificationId, payload);
    const updated = await notificationModel.findById(notificationId);
    await auditService.logActivity(req, {
      action: 'NOTIFICATION_UPDATED',
      entityType: 'notification',
      entityId: notificationId,
      oldValues: notification,
      newValues: updated || payload,
    });

    req.flash('success', 'Notifikasi berhasil diperbarui.');
    return res.redirect('/admin/notifications');
  } catch (error) {
    return next(error);
  }
}

async function publish(req, res, next) {
  return setStatus(req, res, next, 'published', 'Notifikasi berhasil dipublish.');
}

async function archive(req, res, next) {
  return setStatus(req, res, next, 'archived', 'Notifikasi berhasil diarsipkan.');
}

async function setStatus(req, res, next, status, message) {
  try {
    const notificationId = Number(req.params.id);
    if (!isValidId(notificationId)) {
      req.flash('error', 'Notifikasi tidak valid.');
      return res.redirect('/admin/notifications');
    }

    const notification = await notificationModel.findById(notificationId);
    const affectedRows = notification ? await notificationModel.setStatus(notificationId, status) : 0;

    if (!affectedRows) {
      req.flash('error', 'Notifikasi tidak ditemukan.');
      return res.redirect('/admin/notifications');
    }

    const updated = await notificationModel.findById(notificationId);
    await auditService.logActivity(req, {
      action: 'NOTIFICATION_STATUS_UPDATED',
      entityType: 'notification',
      entityId: notificationId,
      oldValues: notification ? { status: notification.status } : null,
      newValues: updated ? { status: updated.status } : { status },
    });

    req.flash('success', message);
    return res.redirect('/admin/notifications');
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
  publish,
  archive,
};
