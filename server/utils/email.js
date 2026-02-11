// ============================================================
// EMAIL SERVICE - Using Resend (HTTP API, works on Render free tier)
// To switch back to Gmail SMTP, uncomment the nodemailer section
// below and comment out the Resend section.
// ============================================================

const { Resend } = require('resend');
const { logNotification } = require('./audit');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Giftsity <no-reply@no-reply.giftsity.com>';

// ============================================================
// GMAIL SMTP (commented out - Render free tier blocks SMTP ports)
// ============================================================
// const nodemailer = require('nodemailer');
// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST,
//   port: parseInt(process.env.SMTP_PORT || '587'),
//   secure: false,
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS
//   }
// });
// ============================================================

// CRITICAL: OTP must throw on failure so caller knows email wasn't sent
const sendOTP = async (email, otp) => {
  console.log(`[Email] Sending OTP to: ${email}`);
  if (!resend) {
    console.log(`[Email] RESEND_API_KEY not set -- OTP for ${email}: ${otp}`);
    logNotification({ channel: 'email', recipient: email, template: 'otp', subject: 'Login Code', status: 'sent', provider: 'console' });
    return;
  }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Your Giftsity Login Code: ${otp}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a2e;border-radius:16px;">
          <h1 style="color:#f5c518;margin:0 0 8px;font-size:28px;">Giftsity</h1>
          <p style="color:#999;margin:0 0 24px;font-size:14px;">The Gift Marketplace</p>
          <p style="color:#eee;font-size:16px;margin:0 0 16px;">Your login code is:</p>
          <div style="background:#2a2a4a;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
            <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#f5c518;">${otp}</span>
          </div>
          <p style="color:#888;font-size:13px;margin:0;">This code expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes. Don't share it with anyone.</p>
        </div>
      `
    });
    console.log(`[Email] OTP sent successfully to: ${email}`);
    logNotification({ channel: 'email', recipient: email, template: 'otp', subject: 'Login Code', status: 'sent', provider: 'resend' });
  } catch (err) {
    console.error(`[Email] Failed to send OTP to ${email}:`, err.message);
    logNotification({ channel: 'email', recipient: email, template: 'otp', subject: 'Login Code', status: 'failed', provider: 'resend', errorMessage: err.message });
    throw new Error('Failed to send OTP email');
  }
};

// NON-CRITICAL: Notifications log errors but don't throw (don't break order flow)
const sendOrderConfirmation = async (email, order, type = 'customer') => {
  if (!resend) { console.log(`[Email] Skipping order confirmation to ${email} (no API key)`); return; }
  try {
    const subject = type === 'seller'
      ? `New Order #${order.orderNumber} - ₹${order.sellerAmount} earning`
      : `Order Confirmed #${order.orderNumber}`;

    const itemsList = order.items.map(i => `<li>${i.title} × ${i.quantity} — ₹${(i.price * i.quantity).toLocaleString()}</li>`).join('');

    const sellerBreakdown = type === 'seller' ? `
      <div style="background:#1a2e1a;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="color:#8f8;margin:0 0 8px;font-weight:bold;">Your Earnings</p>
        <p style="color:#ccc;margin:4px 0;">Sale Amount: ₹${order.totalAmount.toLocaleString()}</p>
        <p style="color:#ccc;margin:4px 0;">Platform Fee (${order.commissionRate}%): -₹${order.commissionAmount.toLocaleString()}</p>
        <p style="color:#ccc;margin:4px 0;">Gateway Fee: -₹${order.paymentGatewayFee.toLocaleString()}</p>
        <p style="color:#8f8;margin:8px 0 0;font-size:18px;font-weight:bold;">You Receive: ₹${order.sellerAmount.toLocaleString()}</p>
      </div>
    ` : '';

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#1a1a2e;border-radius:16px;">
          <h1 style="color:#f5c518;margin:0 0 8px;font-size:24px;">Giftsity</h1>
          <h2 style="color:#eee;margin:0 0 20px;">${subject}</h2>
          <ul style="color:#ccc;padding-left:20px;">${itemsList}</ul>
          <p style="color:#eee;font-size:18px;font-weight:bold;margin:16px 0;">Total: ₹${order.totalAmount.toLocaleString()}</p>
          ${sellerBreakdown}
          <p style="color:#888;font-size:13px;margin:20px 0 0;">Thank you for using Giftsity!</p>
        </div>
      `
    });
    logNotification({ channel: 'email', recipient: email, recipientRole: type, template: 'order_confirmation', subject, status: 'sent', provider: 'resend', metadata: { orderNumber: order.orderNumber } });
  } catch (err) {
    console.error(`[Email] Failed to send order confirmation to ${email}:`, err.message);
    logNotification({ channel: 'email', recipient: email, recipientRole: type, template: 'order_confirmation', subject: `Order Confirmation`, status: 'failed', provider: 'resend', errorMessage: err.message });
  }
};

const sendPayoutNotification = async (email, payout) => {
  if (!resend) { console.log(`[Email] Skipping payout notification to ${email} (no API key)`); return; }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Payout Processed - ₹${payout.netPayout.toLocaleString()}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a2e;border-radius:16px;">
          <h1 style="color:#f5c518;margin:0 0 20px;font-size:24px;">Giftsity</h1>
          <h2 style="color:#eee;margin:0 0 16px;">Payout Processed!</h2>
          <div style="background:#1a2e1a;border-radius:8px;padding:16px;">
            <p style="color:#ccc;margin:4px 0;">Period: ${payout.periodLabel}</p>
            <p style="color:#ccc;margin:4px 0;">Orders: ${payout.orderCount}</p>
            <p style="color:#ccc;margin:4px 0;">Total Sales: ₹${payout.totalSales.toLocaleString()}</p>
            <p style="color:#8f8;font-size:20px;font-weight:bold;margin:12px 0 0;">Payout: ₹${payout.netPayout.toLocaleString()}</p>
          </div>
          ${payout.transactionId ? `<p style="color:#888;margin:16px 0 0;">Transaction Ref: ${payout.transactionId}</p>` : ''}
        </div>
      `
    });
    logNotification({ channel: 'email', recipient: email, recipientRole: 'seller', template: 'payout', subject: `Payout Processed`, status: 'sent', provider: 'resend', metadata: { amount: payout.netPayout } });
  } catch (err) {
    console.error(`[Email] Failed to send payout notification to ${email}:`, err.message);
    logNotification({ channel: 'email', recipient: email, recipientRole: 'seller', template: 'payout', subject: `Payout Processed`, status: 'failed', provider: 'resend', errorMessage: err.message });
  }
};

const sendCommissionChangeNotification = async (email, sellerName, oldRate, newRate) => {
  if (!resend) { console.log(`[Email] Skipping commission change to ${email} (no API key)`); return; }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Platform Fee Update - Giftsity`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a2e;border-radius:16px;">
          <h1 style="color:#f5c518;margin:0 0 20px;font-size:24px;">Giftsity</h1>
          <p style="color:#eee;font-size:16px;">Hi ${sellerName},</p>
          <p style="color:#ccc;">Our platform fee has been updated:</p>
          <div style="background:#2a2a4a;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="color:#888;margin:4px 0;">Previous rate: ${oldRate}%</p>
            <p style="color:#f5c518;margin:4px 0;font-size:18px;font-weight:bold;">New rate: ${newRate}%</p>
          </div>
          <p style="color:#888;font-size:13px;">This applies to new orders only. Existing orders are unaffected.</p>
        </div>
      `
    });
    logNotification({ channel: 'email', recipient: email, recipientRole: 'seller', template: 'commission_change', subject: 'Platform Fee Update', status: 'sent', provider: 'resend', metadata: { oldRate, newRate } });
  } catch (err) {
    console.error(`[Email] Failed to send commission change notification to ${email}:`, err.message);
    logNotification({ channel: 'email', recipient: email, recipientRole: 'seller', template: 'commission_change', subject: 'Platform Fee Update', status: 'failed', provider: 'resend', errorMessage: err.message });
  }
};

const sendB2BInquiryNotification = async (inquiry) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !resend) return;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject: `New B2B Inquiry from ${inquiry.companyName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a2e;border-radius:16px;">
          <h1 style="color:#f5c518;margin:0 0 20px;font-size:24px;">New B2B Inquiry</h1>
          <div style="background:#2a2a4a;border-radius:8px;padding:16px;margin:0 0 16px;">
            <p style="color:#eee;margin:4px 0;font-weight:bold;">${inquiry.companyName}</p>
            <p style="color:#ccc;margin:4px 0;">Contact: ${inquiry.contactPerson}</p>
            <p style="color:#ccc;margin:4px 0;">Email: ${inquiry.email}</p>
            <p style="color:#ccc;margin:4px 0;">Phone: ${inquiry.phone}</p>
            ${inquiry.numberOfEmployees ? `<p style="color:#888;margin:4px 0;">Employees: ${inquiry.numberOfEmployees}</p>` : ''}
            ${inquiry.budgetPerGift ? `<p style="color:#888;margin:4px 0;">Budget/Gift: ${inquiry.budgetPerGift}</p>` : ''}
            ${inquiry.quantityNeeded ? `<p style="color:#888;margin:4px 0;">Quantity: ${inquiry.quantityNeeded}</p>` : ''}
            ${inquiry.occasion ? `<p style="color:#888;margin:4px 0;">Occasion: ${inquiry.occasion}</p>` : ''}
          </div>
          ${inquiry.specialRequirements ? `<p style="color:#aaa;font-size:13px;">"${inquiry.specialRequirements}"</p>` : ''}
          <p style="color:#888;font-size:12px;margin-top:16px;">Log in to the admin dashboard to manage this inquiry.</p>
        </div>
      `
    });
    logNotification({ channel: 'email', recipient: adminEmail, recipientRole: 'admin', template: 'b2b_inquiry', subject: `New B2B Inquiry from ${inquiry.companyName}`, status: 'sent', provider: 'resend', metadata: { companyName: inquiry.companyName } });
  } catch (err) {
    console.error(`[Email] Failed to send B2B inquiry notification:`, err.message);
    logNotification({ channel: 'email', recipient: adminEmail, recipientRole: 'admin', template: 'b2b_inquiry', subject: `New B2B Inquiry`, status: 'failed', provider: 'resend', errorMessage: err.message });
  }
};

const sendShippedEmail = async (email, order) => {
  if (!resend) { console.log(`[Email] Skipping shipped email to ${email} (no API key)`); return; }
  try {
    const tracking = order.trackingInfo || {};
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Your Order #${order.orderNumber} Has Been Shipped!`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a2e;border-radius:16px;">
          <h1 style="color:#f5c518;margin:0 0 8px;font-size:24px;">Giftsity</h1>
          <h2 style="color:#eee;margin:0 0 20px;">Your order is on its way!</h2>
          <div style="background:#2a2a4a;border-radius:8px;padding:16px;margin:0 0 16px;">
            <p style="color:#ccc;margin:4px 0;">Order: <strong style="color:#eee;">#${order.orderNumber}</strong></p>
            ${tracking.courierName ? `<p style="color:#ccc;margin:4px 0;">Courier: ${tracking.courierName}</p>` : ''}
            ${tracking.trackingNumber ? `<p style="color:#ccc;margin:4px 0;">Tracking: <strong style="color:#f5c518;">${tracking.trackingNumber}</strong></p>` : ''}
            ${tracking.estimatedDelivery ? `<p style="color:#ccc;margin:4px 0;">Expected by: ${new Date(tracking.estimatedDelivery).toLocaleDateString()}</p>` : ''}
          </div>
          <p style="color:#888;font-size:13px;">You can track your order from your Giftsity account.</p>
        </div>
      `
    });
    logNotification({ channel: 'email', recipient: email, recipientRole: 'customer', template: 'shipped', subject: `Order #${order.orderNumber} Shipped`, status: 'sent', provider: 'resend', metadata: { orderNumber: order.orderNumber } });
  } catch (err) {
    console.error(`[Email] Failed to send shipped email to ${email}:`, err.message);
    logNotification({ channel: 'email', recipient: email, recipientRole: 'customer', template: 'shipped', subject: `Order Shipped`, status: 'failed', provider: 'resend', errorMessage: err.message });
  }
};

const sendDeliveredEmail = async (email, order) => {
  if (!resend) { console.log(`[Email] Skipping delivered email to ${email} (no API key)`); return; }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Order #${order.orderNumber} Delivered!`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a2e;border-radius:16px;">
          <h1 style="color:#f5c518;margin:0 0 8px;font-size:24px;">Giftsity</h1>
          <h2 style="color:#eee;margin:0 0 20px;">Your order has been delivered!</h2>
          <div style="background:#1a2e1a;border-radius:8px;padding:16px;margin:0 0 16px;">
            <p style="color:#8f8;margin:4px 0;font-weight:bold;">Order #${order.orderNumber} - Delivered</p>
            <p style="color:#ccc;margin:4px 0;">Total: ₹${(order.totalAmount || 0).toLocaleString()}</p>
          </div>
          <p style="color:#ccc;font-size:14px;margin:16px 0;">Loved your purchase? Leave a review to help other shoppers!</p>
          <p style="color:#888;font-size:13px;">Thank you for shopping with Giftsity!</p>
        </div>
      `
    });
    logNotification({ channel: 'email', recipient: email, recipientRole: 'customer', template: 'delivered', subject: `Order #${order.orderNumber} Delivered`, status: 'sent', provider: 'resend', metadata: { orderNumber: order.orderNumber } });
  } catch (err) {
    console.error(`[Email] Failed to send delivered email to ${email}:`, err.message);
    logNotification({ channel: 'email', recipient: email, recipientRole: 'customer', template: 'delivered', subject: `Order Delivered`, status: 'failed', provider: 'resend', errorMessage: err.message });
  }
};

const sendReviewRequestEmail = async (email, order) => {
  if (!resend) { console.log(`[Email] Skipping review request to ${email} (no API key)`); return; }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `How was your gift? Review Order #${order.orderNumber}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a2e;border-radius:16px;">
          <h1 style="color:#f5c518;margin:0 0 8px;font-size:24px;">Giftsity</h1>
          <h2 style="color:#eee;margin:0 0 20px;">Tell us about your purchase!</h2>
          <p style="color:#ccc;font-size:14px;">Your order #${order.orderNumber} was delivered recently. We'd love to hear your feedback!</p>
          <div style="background:#2a2a4a;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
            <p style="color:#f5c518;font-size:28px;margin:0;">⭐ ⭐ ⭐ ⭐ ⭐</p>
            <p style="color:#ccc;margin:8px 0 0;font-size:14px;">Rate your experience</p>
          </div>
          <p style="color:#888;font-size:13px;">Log in to your Giftsity account to leave a review.</p>
        </div>
      `
    });
    logNotification({ channel: 'email', recipient: email, recipientRole: 'customer', template: 'review_request', subject: `Review Order #${order.orderNumber}`, status: 'sent', provider: 'resend', metadata: { orderNumber: order.orderNumber } });
  } catch (err) {
    console.error(`[Email] Failed to send review request to ${email}:`, err.message);
    logNotification({ channel: 'email', recipient: email, recipientRole: 'customer', template: 'review_request', subject: `Review Request`, status: 'failed', provider: 'resend', errorMessage: err.message });
  }
};

// Send corporate welcome email after admin creates account from inquiry
const sendCorporateWelcomeEmail = async (email, companyName, contactPerson) => {
  if (!resend) {
    console.log(`[Email] Skipping corporate welcome to ${email} (no API key)`);
    logNotification({ channel: 'email', recipient: email, recipientRole: 'corporate', template: 'corporate_welcome', subject: 'Corporate Account Ready', status: 'skipped', provider: 'resend', errorMessage: 'No API key' });
    return;
  }

  const portalUrl = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim() + '/corporate/login';

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Your Giftsity Corporate Account is Ready',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a2e;border-radius:16px;">
          <h1 style="color:#f5c518;margin:0 0 8px;font-size:24px;">Giftsity</h1>
          <h2 style="color:#eee;margin:0 0 20px;">Welcome to Giftsity Corporate!</h2>
          <p style="color:#ccc;font-size:14px;">Hi ${contactPerson || 'there'},</p>
          <p style="color:#ccc;font-size:14px;">Great news! Your corporate gifting account for <strong style="color:#f5c518;">${companyName}</strong> has been created and approved.</p>
          <div style="background:#2a2a4a;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
            <p style="color:#eee;font-size:16px;margin:0 0 8px;font-weight:bold;">How to log in</p>
            <p style="color:#ccc;font-size:14px;margin:0;">1. Visit the corporate portal</p>
            <p style="color:#ccc;font-size:14px;margin:0;">2. Enter your email: <strong style="color:#f5c518;">${email}</strong></p>
            <p style="color:#ccc;font-size:14px;margin:0;">3. You'll receive a one-time code (OTP) to verify</p>
          </div>
          <a href="${portalUrl}" style="display:block;background:#f5c518;color:#1a1a2e;text-align:center;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;margin:16px 0;">Go to Corporate Portal</a>
          <p style="color:#888;font-size:13px;margin-top:20px;">Browse our curated corporate catalog, request custom quotes, and place bulk orders -- all from your dedicated portal.</p>
          <p style="color:#888;font-size:13px;">Need help? Reply to this email or contact us at ${process.env.ADMIN_EMAIL || 'support@giftsity.com'}.</p>
        </div>
      `
    });
    logNotification({ channel: 'email', recipient: email, recipientRole: 'corporate', template: 'corporate_welcome', subject: 'Corporate Account Ready', status: 'sent', provider: 'resend' });
  } catch (err) {
    console.error(`[Email] Failed to send corporate welcome to ${email}:`, err.message);
    logNotification({ channel: 'email', recipient: email, recipientRole: 'corporate', template: 'corporate_welcome', subject: 'Corporate Account Ready', status: 'failed', provider: 'resend', errorMessage: err.message });
  }
};

// Corporate order status change notification
const sendCorporateOrderStatusEmail = async (email, order, newStatus) => {
  if (!resend) { console.log(`[Email] Skipping corporate order status email to ${email} (no API key)`); return; }

  const statusLabels = {
    shipped: { label: 'Shipped', color: '#4da6ff', icon: '📦' },
    delivered: { label: 'Delivered', color: '#66cc66', icon: '✅' },
    cancelled: { label: 'Cancelled', color: '#ff6666', icon: '❌' }
  };
  const s = statusLabels[newStatus] || { label: newStatus, color: '#f5c518', icon: '📋' };

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Order #${order.orderNumber} Status: ${s.label}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a2e;border-radius:16px;">
          <h1 style="color:#f5c518;margin:0 0 8px;font-size:24px;">Giftsity Corporate</h1>
          <h2 style="color:#eee;margin:0 0 20px;">Order Status Update</h2>
          <div style="background:#2a2a4a;border-radius:8px;padding:20px;margin:0 0 16px;text-align:center;">
            <p style="font-size:36px;margin:0 0 8px;">${s.icon}</p>
            <p style="color:${s.color};font-size:20px;font-weight:bold;margin:0;">Order ${s.label}</p>
          </div>
          <div style="background:#2a2a4a;border-radius:8px;padding:16px;margin:0 0 16px;">
            <p style="color:#ccc;margin:4px 0;">Order: <strong style="color:#eee;">#${order.orderNumber}</strong></p>
            <p style="color:#ccc;margin:4px 0;">Amount: <strong style="color:#eee;">₹${(order.totalAmount || 0).toLocaleString()}</strong></p>
            <p style="color:#ccc;margin:4px 0;">Items: ${(order.items || []).length} product(s)</p>
          </div>
          ${newStatus === 'shipped' && order.trackingInfo?.trackingNumber ? `
            <div style="background:#1a2e3a;border-radius:8px;padding:16px;margin:0 0 16px;">
              <p style="color:#4da6ff;margin:0 0 4px;font-weight:bold;">Tracking Info</p>
              ${order.trackingInfo.courierName ? `<p style="color:#ccc;margin:4px 0;">Courier: ${order.trackingInfo.courierName}</p>` : ''}
              <p style="color:#ccc;margin:4px 0;">Tracking: <strong style="color:#f5c518;">${order.trackingInfo.trackingNumber}</strong></p>
            </div>
          ` : ''}
          <p style="color:#888;font-size:13px;margin-top:16px;">Log in to your corporate portal to view full order details.</p>
        </div>
      `
    });
    logNotification({ channel: 'email', recipient: email, recipientRole: 'corporate', template: 'corporate_order_status', subject: `Order #${order.orderNumber} ${s.label}`, status: 'sent', provider: 'resend', metadata: { orderNumber: order.orderNumber, newStatus } });
  } catch (err) {
    console.error(`[Email] Failed to send corporate order status to ${email}:`, err.message);
    logNotification({ channel: 'email', recipient: email, recipientRole: 'corporate', template: 'corporate_order_status', subject: `Order Status Update`, status: 'failed', provider: 'resend', errorMessage: err.message });
  }
};

// Corporate quote notification (new or updated)
const sendCorporateQuoteNotification = async (email, quote, action = 'created') => {
  if (!resend) { console.log(`[Email] Skipping corporate quote notification to ${email} (no API key)`); return; }

  const isNew = action === 'created';
  const subject = isNew
    ? `New Quote #${quote.quoteNumber} from Giftsity`
    : `Quote #${quote.quoteNumber} Updated`;

  try {
    const itemsList = (quote.items || []).map(i =>
      `<li style="color:#ccc;margin:4px 0;">${i.title} × ${i.quantity} — ₹${((i.unitPrice || 0) * (i.quantity || 1)).toLocaleString()}</li>`
    ).join('');

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a2e;border-radius:16px;">
          <h1 style="color:#f5c518;margin:0 0 8px;font-size:24px;">Giftsity Corporate</h1>
          <h2 style="color:#eee;margin:0 0 20px;">${isNew ? 'You Have a New Quote!' : 'Your Quote Has Been Updated'}</h2>
          <div style="background:#2a2a4a;border-radius:8px;padding:16px;margin:0 0 16px;">
            <p style="color:#ccc;margin:4px 0;">Quote: <strong style="color:#eee;">#${quote.quoteNumber}</strong></p>
            ${quote.validUntil ? `<p style="color:#ccc;margin:4px 0;">Valid Until: <strong style="color:#f5c518;">${new Date(quote.validUntil).toLocaleDateString('en-IN')}</strong></p>` : ''}
          </div>
          <div style="margin:0 0 16px;">
            <p style="color:#eee;font-weight:bold;margin:0 0 8px;">Items:</p>
            <ul style="padding-left:20px;margin:0;">${itemsList}</ul>
          </div>
          <div style="background:#1a2e1a;border-radius:8px;padding:16px;margin:0 0 16px;">
            ${quote.discountPercent ? `<p style="color:#ccc;margin:4px 0;">Discount: ${quote.discountPercent}%</p>` : ''}
            <p style="color:#8f8;font-size:18px;font-weight:bold;margin:8px 0 0;">Total: ₹${(quote.finalAmount || quote.totalAmount || 0).toLocaleString()}</p>
          </div>
          ${quote.adminNotes ? `<p style="color:#aaa;font-size:13px;margin:0 0 16px;">Note: "${quote.adminNotes}"</p>` : ''}
          <a href="${(process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim()}/corporate/quotes" style="display:block;background:#f5c518;color:#1a1a2e;text-align:center;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;margin:16px 0;">View Quote</a>
          <p style="color:#888;font-size:13px;">Log in to approve or discuss this quote.</p>
        </div>
      `
    });
    logNotification({ channel: 'email', recipient: email, recipientRole: 'corporate', template: 'corporate_quote', subject, status: 'sent', provider: 'resend', metadata: { quoteNumber: quote.quoteNumber, action } });
  } catch (err) {
    console.error(`[Email] Failed to send corporate quote notification to ${email}:`, err.message);
    logNotification({ channel: 'email', recipient: email, recipientRole: 'corporate', template: 'corporate_quote', subject, status: 'failed', provider: 'resend', errorMessage: err.message });
  }
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
  sendCorporateQuoteNotification
};
