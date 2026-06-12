const auditLogModel = require('../models/auditLog.model');

const AUDIT_LIMIT = 15;

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

function getFilters(query) {
  return {
    q: String(query.q || '').trim(),
    action: String(query.action || '').trim(),
    entityType: String(query.entityType || query.entity_type || '').trim(),
    userId: String(query.userId || query.user_id || '').trim(),
    page: normalizePage(query.page),
  };
}

async function index(req, res, next) {
  try {
    const filters = getFilters(req.query);
    const [logs, total, actions, entityTypes] = await Promise.all([
      auditLogModel.listAuditLogs({ ...filters, limit: AUDIT_LIMIT }),
      auditLogModel.countAuditLogs(filters),
      auditLogModel.getAuditActions(),
      auditLogModel.getAuditEntityTypes(),
    ]);

    return res.render('admin/audit-logs/index', {
      layout: 'layouts/dashboard',
      pageTitle: 'Audit Logs',
      activeMenu: 'audit-logs',
      pageStyles: ['/css/admin/pages/audit-logs.css'],
      currentDateWib: getWibDateLabel(),
      filters,
      logs,
      actions,
      entityTypes,
      pagination: {
        page: filters.page,
        limit: AUDIT_LIMIT,
        total,
        totalPages: Math.max(1, Math.ceil(total / AUDIT_LIMIT)),
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index,
};
