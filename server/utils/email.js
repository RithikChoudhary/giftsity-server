// ============================================================
// EMAIL SERVICE - Using Resend (HTTP API, works on Render free tier)
// ============================================================

const { Resend } = require('resend');
const { logNotification } = require('./audit');
const logger = require('./logger');
const templates = require('./emailTemplates');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Giftsity <no-reply@no-reply.giftsity.com>';

// ============================================================
// Helper: send email via Resend with standardized error handling
// ============================================================
const sendEmail = async (to, subject, html, { template, recipientRole = '', metadata = {}, critical = false } = {}) => {
  if (!resend) {
    console.warn(`[Email] RESEND_API_KEY not set -- skipping "${template}" email to ${to}.`);
    logNotification({ channel: 'email', recipient: to, recipientRole, template, subject, status: 'skipped', provider: 'none' });
    if (critical) throw new Error('Email service not configured');
    return;
  }
  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
    logNotification({ channel: 'email', recipient: to, recipientRole, template, subject, status: 'sent', provider: 'resend', metadata });
  } catch (err) {
    console.error(`[Email] Failed to send "${template}" to ${to}:`, err.message);
    logNotification({ channel: 'email', recipient: to, recipientRole, template, subject, status: 'failed', provider: 'resend', errorMessage: err.message, metadata });
    if (critical) throw new Error('Failed to send email');
  }
};

// ============================================================
// CRITICAL: OTP must throw on failure so caller knows email wasn't sent
// ============================================================
const sendOTP = async (email, otp) => {
  const subject = `Your Giftsity Login Code: ${otp}`;
  const html = templates.otpTemplate(otp);
  await sendEmail(email, subject, html, { template: 'otp', critical: true });
};

// ============================================================
// NON-CRITICAL: Notifications log errors but don't throw
// ============================================================
const sendOrderConfirmation = async (email, order, type = 'customer') => {
  const { subject, html } = templates.orderConfirmationTemplate(order, type);
  await sendEmail(email, subject, html, {
    template: 'order_confirmation', recipientRole: type,
    metadata: { orderNumber: order.orderNumber }
  });
};

const sendPayoutNotification = async (email, payout) => {
  const subject = `Payout Processed - ₹${payout.netPayout.toLocaleString()}`;
  const html = templates.payoutTemplate(payout);
  await sendEmail(email, subject, html, {
    template: 'payout', recipientRole: 'seller',
    metadata: { amount: payout.netPayout }
  });
};

const sendCommissionChangeNotification = async (email, sellerName, oldRate, newRate) => {
  const subject = 'Platform Fee Update - Giftsity';
  const html = templates.commissionChangeTemplate(sellerName, oldRate, newRate);
  await sendEmail(email, subject, html, {
    template: 'commission_change', recipientRole: 'seller',
    metadata: { oldRate, newRate }
  });
};

const sendB2BInquiryNotification = async (inquiry) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;
  const subject = `New B2B Inquiry from ${inquiry.companyName}`;
  const html = templates.b2bInquiryTemplate(inquiry);
  await sendEmail(adminEmail, subject, html, {
    template: 'b2b_inquiry', recipientRole: 'admin',
    metadata: { companyName: inquiry.companyName }
  });
};

const sendShippedEmail = async (email, order) => {
  const subject = `Your Order #${order.orderNumber} Has Been Shipped!`;
  const html = templates.shippedTemplate(order);
  await sendEmail(email, subject, html, {
    template: 'shipped', recipientRole: 'customer',
    metadata: { orderNumber: order.orderNumber }
  });
};

const sendDeliveredEmail = async (email, order) => {
  const subject = `Order #${order.orderNumber} Delivered!`;
  const html = templates.deliveredTemplate(order);
  await sendEmail(email, subject, html, {
    template: 'delivered', recipientRole: 'customer',
    metadata: { orderNumber: order.orderNumber }
  });
};

const sendReviewRequestEmail = async (email, order) => {
  const subject = `How was your gift? Review Order #${order.orderNumber}`;
  const html = templates.reviewRequestTemplate(order);
  await sendEmail(email, subject, html, {
    template: 'review_request', recipientRole: 'customer',
    metadata: { orderNumber: order.orderNumber }
  });
};

const sendCorporateWelcomeEmail = async (email, companyName, contactPerson) => {
  const subject = 'Your Giftsity Corporate Account is Ready';
  const html = templates.corporateWelcomeTemplate(email, companyName, contactPerson);
  await sendEmail(email, subject, html, {
    template: 'corporate_welcome', recipientRole: 'corporate'
  });
};

const sendCorporateOrderStatusEmail = async (email, order, newStatus) => {
  const statusLabels = { shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
  const label = statusLabels[newStatus] || newStatus;
  const subject = `Order #${order.orderNumber} Status: ${label}`;
  const html = templates.corporateOrderStatusTemplate(order, newStatus);
  await sendEmail(email, subject, html, {
    template: 'corporate_order_status', recipientRole: 'corporate',
    metadata: { orderNumber: order.orderNumber, newStatus }
  });
};

const sendCorporateQuoteNotification = async (email, quote, action = 'created') => {
  const subject = action === 'created'
    ? `New Quote #${quote.quoteNumber} from Giftsity`
    : `Quote #${quote.quoteNumber} Updated`;
  const html = templates.corporateQuoteTemplate(quote, action);
  await sendEmail(email, subject, html, {
    template: 'corporate_quote', recipientRole: 'corporate',
    metadata: { quoteNumber: quote.quoteNumber, action }
  });
};

const sendCancellationEmail = async (email, order) => {
  const subject = `Order #${order.orderNumber} Cancelled — Refund ${order.paymentStatus === 'refunded' ? 'Initiated' : 'Pending'}`;
  const html = templates.cancellationTemplate(order);
  await sendEmail(email, subject, html, {
    template: 'cancellation', recipientRole: 'customer',
    metadata: { orderNumber: order.orderNumber }
  });
};

module.exports = {
  sendOTP,
  sendOrderConfirmation,
  sendPayoutNotification,
  sendCommissionChangeNotification,
  sendB2BInquiryNotification,
  sendCorporateWelcomeEmail,
  sendShippedEmail,
  sendDeliveredEmail,
  sendReviewRequestEmail,
  sendCorporateOrderStatusEmail,
  sendCorporateQuoteNotification,
  sendCancellationEmail
};
