const marketingModel = require('../models/adminMarketingContent.model');
const auditService = require('../services/audit.service');

const CONTENT_LIMIT = 10;

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

function getContext(kind) {
  if (kind === 'promotions') {
    return {
      kind,
      activeMenu: 'promotions',
      basePath: '/admin/promotions',
      defaultType: 'promotion',
      heading: 'Promotions',
      description: 'Manage promotional content and campaign blocks.',
      createHeading: 'Create Promotion',
      editHeading: 'Edit Promotion',
      pageTitle: 'Promotions',
      fixedType: 'promotion',
    };
  }

  return {
    kind: 'content',
    activeMenu: 'content',
    basePath: '/admin/content',
    defaultType: 'banner',
    heading: 'Banners / Content',
    description: 'Manage homepage banners, announcement bars, and visual content.',
    createHeading: 'Create Content',
    editHeading: 'Edit Content',
    pageTitle: 'Content',
    fixedType: '',
  };
}

function getBaseRenderData(context, extra = {}) {
  return {
    layout: 'layouts/dashboard',
    activeMenu: context.activeMenu,
    currentDateWib: getWibDateLabel(),
    pageStyles: ['/css/admin/pages/marketing-content.css'],
    context,
    typeOptions: marketingModel.CONTENT_TYPES,
    statusOptions: marketingModel.CONTENT_STATUSES,
    placementOptions: marketingModel.CONTENT_PLACEMENTS,
    ...extra,
  };
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

function normalizeUrl(value) {
  return String(value || '').trim();
}

function isValidOptionalUrl(value) {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (_error) {
    return false;
  }
}

function payloadFromBody(body, context) {
  return {
    content_type: context.fixedType || String(body.content_type || context.defaultType).trim().toLowerCase(),
    title: String(body.title || '').trim(),
    subtitle: String(body.subtitle || '').trim(),
    body: String(body.body || '').trim(),
    image_url: normalizeUrl(body.image_url),
    cta_label: String(body.cta_label || '').trim(),
    cta_url: normalizeUrl(body.cta_url),
    placement: String(body.placement || 'homepage').trim().toLowerCase(),
    status: String(body.status || 'active').trim().toLowerCase(),
    sort_order: Number.parseInt(body.sort_order, 10) || 0,
    starts_at: toNullableDate(body.starts_at),
    ends_at: toNullableDate(body.ends_at),
  };
}

function validatePayload(payload) {
  const errors = {};

  if (!marketingModel.CONTENT_TYPES.includes(payload.content_type)) {
    errors.content_type = 'Tipe content tidak valid.';
  }

  if (!payload.title) {
    errors.title = 'Title wajib diisi.';
  } else if (payload.title.length > 150) {
    errors.title = 'Title maksimal 150 karakter.';
  }

  if (payload.subtitle.length > 255) errors.subtitle = 'Subtitle maksimal 255 karakter.';
  if (payload.body.length > 2000) errors.body = 'Body maksimal 2000 karakter.';
  if (payload.cta_label.length > 80) errors.cta_label = 'CTA label maksimal 80 karakter.';
  if (!marketingModel.CONTENT_STATUSES.includes(payload.status)) errors.status = 'Status tidak valid.';
  if (!payload.placement || payload.placement.length > 80) errors.placement = 'Placement wajib diisi maksimal 80 karakter.';
  if (!Number.isInteger(payload.sort_order)) errors.sort_order = 'Sort order harus angka bulat.';
  if (!isValidOptionalUrl(payload.image_url)) errors.image_url = 'Image URL harus diawali http:// atau https://.';
  if (!isValidOptionalUrl(payload.cta_url)) errors.cta_url = 'CTA URL harus diawali http:// atau https://.';

  const startDate = payload.starts_at ? new Date(payload.starts_at) : null;
  const endDate = payload.ends_at ? new Date(payload.ends_at) : null;
  if (startDate && Number.isNaN(startDate.getTime())) errors.starts_at = 'Start date tidak valid.';
  if (endDate && Number.isNaN(endDate.getTime())) errors.ends_at = 'End date tidak valid.';
  if (startDate && endDate && endDate < startDate) errors.ends_at = 'End date tidak boleh lebih awal dari start date.';

  return errors;
}

function formatOldForForm(content) {
  if (!content) return null;
  return {
    ...content,
    starts_at: toDateInputValue(content.starts_at),
    ends_at: toDateInputValue(content.ends_at),
  };
}

function getFilters(query, context) {
  return {
    q: String(query.q || '').trim(),
    status: String(query.status || '').trim(),
    type: context.fixedType || String(query.type || '').trim(),
    placement: String(query.placement || '').trim(),
    page: normalizePage(query.page),
  };
}

async function renderIndex(req, res, next, kind) {
  const context = getContext(kind);

  try {
    const filters = getFilters(req.query, context);
    const [contents, total] = await Promise.all([
      marketingModel.listContents({ ...filters, limit: CONTENT_LIMIT }),
      marketingModel.countContents(filters),
    ]);

    return res.render('admin/marketing-content/index', getBaseRenderData(context, {
      pageTitle: context.pageTitle,
      contents,
      filters,
      pagination: {
        page: filters.page,
        limit: CONTENT_LIMIT,
        total,
        totalPages: Math.max(1, Math.ceil(total / CONTENT_LIMIT)),
      },
    }));
  } catch (error) {
    return next(error);
  }
}

function renderCreate(req, res, kind) {
  const context = getContext(kind);
  return res.render('admin/marketing-content/create', getBaseRenderData(context, {
    pageTitle: context.createHeading,
    old: {
      content_type: context.defaultType,
      placement: 'homepage',
      status: 'active',
      sort_order: 0,
    },
    formErrors: {},
  }));
}

async function create(req, res, next, kind) {
  const context = getContext(kind);

  try {
    const payload = payloadFromBody(req.body, context);
    const formErrors = validatePayload(payload);

    if (Object.keys(formErrors).length > 0) {
      res.status(422);
      return res.render('admin/marketing-content/create', getBaseRenderData(context, {
        pageTitle: context.createHeading,
        old: payload,
        formErrors,
      }));
    }

    const contentId = await marketingModel.createContent(payload);
    await auditService.logActivity(req, {
      action: 'MARKETING_CONTENT_CREATED',
      entityType: 'marketing_content',
      entityId: contentId,
      newValues: payload,
    });

    req.flash('success', `${context.pageTitle} berhasil dibuat.`);
    return res.redirect(context.basePath);
  } catch (error) {
    return next(error);
  }
}

async function renderEdit(req, res, next, kind) {
  const context = getContext(kind);

  try {
    const content = await marketingModel.findById(Number(req.params.id));
    if (!content || (context.fixedType && content.content_type !== context.fixedType)) {
      req.flash('error', 'Content tidak ditemukan.');
      return res.redirect(context.basePath);
    }

    return res.render('admin/marketing-content/edit', getBaseRenderData(context, {
      pageTitle: context.editHeading,
      content,
      old: formatOldForForm(content),
      formErrors: {},
    }));
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next, kind) {
  const context = getContext(kind);

  try {
    const contentId = Number(req.params.id);
    const content = await marketingModel.findById(contentId);
    if (!content || (context.fixedType && content.content_type !== context.fixedType)) {
      req.flash('error', 'Content tidak ditemukan.');
      return res.redirect(context.basePath);
    }

    const payload = payloadFromBody(req.body, context);
    const formErrors = validatePayload(payload);

    if (Object.keys(formErrors).length > 0) {
      res.status(422);
      return res.render('admin/marketing-content/edit', getBaseRenderData(context, {
        pageTitle: context.editHeading,
        content,
        old: payload,
        formErrors,
      }));
    }

    await marketingModel.updateContent(contentId, payload);
    const updated = await marketingModel.findById(contentId);
    await auditService.logActivity(req, {
      action: 'MARKETING_CONTENT_UPDATED',
      entityType: 'marketing_content',
      entityId: contentId,
      oldValues: content,
      newValues: updated || payload,
    });

    req.flash('success', `${context.pageTitle} berhasil diperbarui.`);
    return res.redirect(context.basePath);
  } catch (error) {
    return next(error);
  }
}

async function toggleStatus(req, res, next, kind) {
  const context = getContext(kind);

  try {
    const contentId = Number(req.params.id);
    const content = await marketingModel.findById(contentId);
    if (!content || (context.fixedType && content.content_type !== context.fixedType)) {
      req.flash('error', 'Content tidak ditemukan.');
      return res.redirect(context.basePath);
    }

    await marketingModel.toggleStatus(contentId);
    const updated = await marketingModel.findById(contentId);
    await auditService.logActivity(req, {
      action: 'MARKETING_CONTENT_STATUS_TOGGLED',
      entityType: 'marketing_content',
      entityId: contentId,
      oldValues: { status: content.status },
      newValues: updated ? { status: updated.status } : null,
    });

    req.flash('success', 'Status content berhasil diperbarui.');
    return res.redirect(context.basePath);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  promotionsIndex: (req, res, next) => renderIndex(req, res, next, 'promotions'),
  promotionsCreate: (req, res) => renderCreate(req, res, 'promotions'),
  promotionsStore: (req, res, next) => create(req, res, next, 'promotions'),
  promotionsEdit: (req, res, next) => renderEdit(req, res, next, 'promotions'),
  promotionsUpdate: (req, res, next) => update(req, res, next, 'promotions'),
  promotionsToggleStatus: (req, res, next) => toggleStatus(req, res, next, 'promotions'),
  contentIndex: (req, res, next) => renderIndex(req, res, next, 'content'),
  contentCreate: (req, res) => renderCreate(req, res, 'content'),
  contentStore: (req, res, next) => create(req, res, next, 'content'),
  contentEdit: (req, res, next) => renderEdit(req, res, next, 'content'),
  contentUpdate: (req, res, next) => update(req, res, next, 'content'),
  contentToggleStatus: (req, res, next) => toggleStatus(req, res, next, 'content'),
};
