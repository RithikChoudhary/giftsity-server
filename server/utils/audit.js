const OtpLog = require('../models/OtpLog');
const AuthAuditLog = require('../models/AuthAuditLog');
const ActivityLog = require('../models/ActivityLog');
const NotificationLog = require('../models/NotificationLog');
const { getAuthMeta } = require('./identity');

async function logOtpEvent(req, { email, role = 'unknown', event, metadata = {} }) {
  try {
    const meta = getAuthMeta(req);
    await OtpLog.create({
      email,
      role,
      event,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata
    });
  } catch (_err) {
    // Best-effort
  }
}

async function logAuthEvent(req, { action, role = 'unknown', userId = null, email = '', reason = '', metadata = {} }) {
  try {
    const meta = getAuthMeta(req);
    await AuthAuditLog.create({
      action,
      role,
      userId,
      email,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      reason,
      metadata
    });
  } catch (_err) {
    // Best-effort
  }
}

async function logActivity({ domain, action, actorRole = 'system', actorId = null, actorEmail = '', targetType = '', targetId = null, message = '', metadata = {} }) {
  try {
    await ActivityLog.create({
      domain,
      action,
      actorRole,
      actorId,
      actorEmail,
      targetType,
      targetId,
      message,
      metadata
    });
  } catch (_err) {
    // Best-effort
  }
}

async function logNotification({ channel, recipient, recipientRole = 'unknown', template = '', subject = '', status = 'queued', provider = '', providerMessageId = '', errorMessage = '', metadata = {} }) {
  try {
    await NotificationLog.create({
      channel,
      recipient,
      recipientRole,
      template,
      subject,
      status,
      provider,
      providerMessageId,
      errorMessage,
      metadata
    });
  } catch (_err) {
    // Best-effort
  }
}

module.exports = {
  logOtpEvent,
  logAuthEvent,
  logActivity,
  logNotification
};
