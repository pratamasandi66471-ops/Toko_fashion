const auditLogModel = require('../models/auditLog.model');

async function logActivity(req, {
  action,
  entityType,
  entityId = null,
  oldValues = null,
  newValues = null,
}) {
  if (!action || !entityType) return null;

  try {
    return await auditLogModel.createAuditLog({
      userId: req.session?.user?.id || null,
      role: req.session?.user?.role || null,
      action,
      entityType,
      entityId,
      oldValues,
      newValues,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  } catch (error) {
    console.error('[audit] Failed to create audit log:', error);
    return null;
  }
}

module.exports = {
  logActivity,
};
