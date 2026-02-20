// ============================================================
// EMAIL TEMPLATES - Centralized HTML templates for all emails
// ============================================================

const CLIENT_URL = () => (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();

/**
 * Base wrapper: standard Giftsity dark-themed container.
 */
const baseTemplate = (content, { title = 'Giftsity', subtitle = '' } = {}) => `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#1a1a2e;border-radius:16px;">
  <h1 style="color:#f5c518;margin:0 0 ${subtitle ? '4px' : '20px'};font-size:24px;">${title}</h1>
  ${subtitle ? `<p style="color:#999;margin:0 0 24px;font-size:13px;">${subtitle}</p>` : ''}
  ${content}
  <div style="border-top:1px solid #2a2a4a;margin-top:24px;padding-top:16px;">
    <p style="color:#666;font-size:11px;margin:0;text-align:center;">Giftsity - The Gift Marketplace</p>
  </div>
</div>`;

/**
 * Reusable info box.
 */
const infoBox = (content, { bg = '#2a2a4a' } = {}) =>
  `<div style="background:${bg};border-radius:8px;padding:16px;margin:0 0 16px;">${content}</div>`;

/**
 * Reusable CTA button.
 */
const ctaButton = (text, url) =>
  `<a href="${url}" style="display:block;background:#f5c518;color:#1a1a2e;text-align:center;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;margin:16px 0;">${text}</a>`;

// ============================================================
// TEMPLATES
// ============================================================

const otpTemplate = (otp) => baseTemplate(`
  <p style="color:#eee;font-size:16px;margin:0 0 16px;">Your login code is:</p>
  ${infoBox(`<div style="text-align:center;"><span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#f5c518;">${otp}</span></div>`)}
  <p style="color:#888;font-size:13px;margin:0;">This code expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes. Don't share it with anyone.</p>
`, { subtitle: 'The Gift Marketplace' });

const orderConfirmationTemplate = (order, type = 'customer') => {
  const subject = type === 'seller'
    ? `New Order #${order.orderNumber} - ₹${order.sellerAmount} earning`
    : `Order Confirmed #${order.orderNumber}`;

  const itemsList = order.items.map(i =>
    `<li style="color:#ccc;margin:4px 0;">${i.title} x ${i.quantity} — ₹${(i.price * i.quantity).toLocaleString()}</li>`
  ).join('');

  const sellerBreakdown = type === 'seller' ? infoBox(`
    <p style="color:#8f8;margin:0 0 8px;font-weight:bold;">Your Earnings</p>
    <p style="color:#ccc;margin:4px 0;">Sale Amount: ₹${order.totalAmount.toLocaleString()}</p>
    <p style="color:#ccc;margin:4px 0;">Platform Fee (${order.commissionRate}%): -₹${order.commissionAmount.toLocaleString()}</p>
    <p style="color:#ccc;margin:4px 0;">Gateway Fee: -₹${order.paymentGatewayFee.toLocaleString()}</p>
    <p style="color:#8f8;margin:8px 0 0;font-size:18px;font-weight:bold;">You Receive: ₹${order.sellerAmount.toLocaleString()}</p>
  `, { bg: '#1a2e1a' }) : '';

  const html = baseTemplate(`
    <h2 style="color:#eee;margin:0 0 20px;">${subject}</h2>
    <ul style="color:#ccc;padding-left:20px;">${itemsList}</ul>
    <p style="color:#eee;font-size:18px;font-weight:bold;margin:16px 0;">Total: ₹${order.totalAmount.toLocaleString()}</p>
    ${sellerBreakdown}
    <p style="color:#888;font-size:13px;margin:20px 0 0;">Thank you for using Giftsity!</p>
  `);

  return { subject, html };
};

const payoutTemplate = (payout) => baseTemplate(`
  <h2 style="color:#eee;margin:0 0 16px;">Payout Processed!</h2>
  ${infoBox(`
    <p style="color:#ccc;margin:4px 0;">Period: ${payout.periodLabel}</p>
    <p style="color:#ccc;margin:4px 0;">Orders: ${payout.orderCount}</p>
    <p style="color:#ccc;margin:4px 0;">Total Sales: ₹${payout.totalSales.toLocaleString()}</p>
    <p style="color:#8f8;font-size:20px;font-weight:bold;margin:12px 0 0;">Payout: ₹${payout.netPayout.toLocaleString()}</p>
  `, { bg: '#1a2e1a' })}
  ${payout.transactionId ? `<p style="color:#888;margin:16px 0 0;">Transaction Ref: ${payout.transactionId}</p>` : ''}
`);

const commissionChangeTemplate = (sellerName, oldRate, newRate) => baseTemplate(`
  <p style="color:#eee;font-size:16px;">Hi ${sellerName},</p>
  <p style="color:#ccc;">Our platform fee has been updated:</p>
  ${infoBox(`
    <p style="color:#888;margin:4px 0;">Previous rate: ${oldRate}%</p>
    <p style="color:#f5c518;margin:4px 0;font-size:18px;font-weight:bold;">New rate: ${newRate}%</p>
  `)}
  <p style="color:#888;font-size:13px;">This applies to new orders only. Existing orders are unaffected.</p>
`);

const b2bInquiryTemplate = (inquiry) => baseTemplate(`
  ${infoBox(`
    <p style="color:#eee;margin:4px 0;font-weight:bold;">${inquiry.companyName}</p>
    <p style="color:#ccc;margin:4px 0;">Contact: ${inquiry.contactPerson}</p>
    <p style="color:#ccc;margin:4px 0;">Email: ${inquiry.email}</p>
    <p style="color:#ccc;margin:4px 0;">Phone: ${inquiry.phone}</p>
    ${inquiry.numberOfEmployees ? `<p style="color:#888;margin:4px 0;">Employees: ${inquiry.numberOfEmployees}</p>` : ''}
    ${inquiry.budgetPerGift ? `<p style="color:#888;margin:4px 0;">Budget/Gift: ${inquiry.budgetPerGift}</p>` : ''}
    ${inquiry.quantityNeeded ? `<p style="color:#888;margin:4px 0;">Quantity: ${inquiry.quantityNeeded}</p>` : ''}
    ${inquiry.occasion ? `<p style="color:#888;margin:4px 0;">Occasion: ${inquiry.occasion}</p>` : ''}
  `)}
  ${inquiry.specialRequirements ? `<p style="color:#aaa;font-size:13px;">"${inquiry.specialRequirements}"</p>` : ''}
  <p style="color:#888;font-size:12px;margin-top:16px;">Log in to the admin dashboard to manage this inquiry.</p>
`, { title: 'New B2B Inquiry' });

const shippedTemplate = (order) => {
  const tracking = order.trackingInfo || {};
  return baseTemplate(`
    <h2 style="color:#eee;margin:0 0 20px;">Your order is on its way!</h2>
    ${infoBox(`
      <p style="color:#ccc;margin:4px 0;">Order: <strong style="color:#eee;">#${order.orderNumber}</strong></p>
      ${tracking.courierName ? `<p style="color:#ccc;margin:4px 0;">Courier: ${tracking.courierName}</p>` : ''}
      ${tracking.trackingNumber ? `<p style="color:#ccc;margin:4px 0;">Tracking: <strong style="color:#f5c518;">${tracking.trackingNumber}</strong></p>` : ''}
      ${tracking.estimatedDelivery ? `<p style="color:#ccc;margin:4px 0;">Expected by: ${new Date(tracking.estimatedDelivery).toLocaleDateString()}</p>` : ''}
    `)}
    <p style="color:#888;font-size:13px;">You can track your order from your Giftsity account.</p>
  `);
};

const deliveredTemplate = (order) => baseTemplate(`
  <h2 style="color:#eee;margin:0 0 20px;">Your order has been delivered!</h2>
  ${infoBox(`
    <p style="color:#8f8;margin:4px 0;font-weight:bold;">Order #${order.orderNumber} - Delivered</p>
    <p style="color:#ccc;margin:4px 0;">Total: ₹${(order.totalAmount || 0).toLocaleString()}</p>
  `, { bg: '#1a2e1a' })}
  <p style="color:#ccc;font-size:14px;margin:16px 0;">Loved your purchase? Leave a review to help other shoppers!</p>
  <p style="color:#888;font-size:13px;">Thank you for shopping with Giftsity!</p>
`);

const reviewRequestTemplate = (order) => baseTemplate(`
  <h2 style="color:#eee;margin:0 0 20px;">Tell us about your purchase!</h2>
  <p style="color:#ccc;font-size:14px;">Your order #${order.orderNumber} was delivered recently. We'd love to hear your feedback!</p>
  ${infoBox(`
    <div style="text-align:center;">
      <p style="color:#f5c518;font-size:28px;margin:0;">⭐ ⭐ ⭐ ⭐ ⭐</p>
      <p style="color:#ccc;margin:8px 0 0;font-size:14px;">Rate your experience</p>
    </div>
  `)}
  <p style="color:#888;font-size:13px;">Log in to your Giftsity account to leave a review.</p>
`);

const corporateWelcomeTemplate = (email, companyName, contactPerson) => {
  const portalUrl = CLIENT_URL() + '/corporate/login';
  return baseTemplate(`
    <h2 style="color:#eee;margin:0 0 20px;">Welcome to Giftsity Corporate!</h2>
    <p style="color:#ccc;font-size:14px;">Hi ${contactPerson || 'there'},</p>
    <p style="color:#ccc;font-size:14px;">Great news! Your corporate gifting account for <strong style="color:#f5c518;">${companyName}</strong> has been created and approved.</p>
    ${infoBox(`
      <p style="color:#eee;font-size:16px;margin:0 0 8px;font-weight:bold;text-align:center;">How to log in</p>
      <p style="color:#ccc;font-size:14px;margin:0;text-align:center;">1. Visit the corporate portal</p>
      <p style="color:#ccc;font-size:14px;margin:0;text-align:center;">2. Enter your email: <strong style="color:#f5c518;">${email}</strong></p>
      <p style="color:#ccc;font-size:14px;margin:0;text-align:center;">3. You'll receive a one-time code (OTP) to verify</p>
    `)}
    ${ctaButton('Go to Corporate Portal', portalUrl)}
    <p style="color:#888;font-size:13px;margin-top:20px;">Browse our curated corporate catalog, request custom quotes, and place bulk orders -- all from your dedicated portal.</p>
    <p style="color:#888;font-size:13px;">Need help? Reply to this email or contact us at ${process.env.ADMIN_EMAIL || 'support@giftsity.com'}.</p>
  `);
};

const corporateOrderStatusTemplate = (order, newStatus) => {
  const statusLabels = {
    shipped: { label: 'Shipped', color: '#4da6ff', icon: '📦' },
    delivered: { label: 'Delivered', color: '#66cc66', icon: '✅' },
    cancelled: { label: 'Cancelled', color: '#ff6666', icon: '❌' }
  };
  const s = statusLabels[newStatus] || { label: newStatus, color: '#f5c518', icon: '📋' };

  return baseTemplate(`
    <h2 style="color:#eee;margin:0 0 20px;">Order Status Update</h2>
    ${infoBox(`
      <div style="text-align:center;">
        <p style="font-size:36px;margin:0 0 8px;">${s.icon}</p>
        <p style="color:${s.color};font-size:20px;font-weight:bold;margin:0;">Order ${s.label}</p>
      </div>
    `)}
    ${infoBox(`
      <p style="color:#ccc;margin:4px 0;">Order: <strong style="color:#eee;">#${order.orderNumber}</strong></p>
      <p style="color:#ccc;margin:4px 0;">Amount: <strong style="color:#eee;">₹${(order.totalAmount || 0).toLocaleString()}</strong></p>
      <p style="color:#ccc;margin:4px 0;">Items: ${(order.items || []).length} product(s)</p>
    `)}
    ${newStatus === 'shipped' && order.trackingInfo?.trackingNumber ? infoBox(`
      <p style="color:#4da6ff;margin:0 0 4px;font-weight:bold;">Tracking Info</p>
      ${order.trackingInfo.courierName ? `<p style="color:#ccc;margin:4px 0;">Courier: ${order.trackingInfo.courierName}</p>` : ''}
      <p style="color:#ccc;margin:4px 0;">Tracking: <strong style="color:#f5c518;">${order.trackingInfo.trackingNumber}</strong></p>
    `, { bg: '#1a2e3a' }) : ''}
    <p style="color:#888;font-size:13px;margin-top:16px;">Log in to your corporate portal to view full order details.</p>
  `, { title: 'Giftsity Corporate' });
};

const corporateQuoteTemplate = (quote, action = 'created') => {
  const isNew = action === 'created';
  const itemsList = (quote.items || []).map(i =>
    `<li style="color:#ccc;margin:4px 0;">${i.title} x ${i.quantity} — ₹${((i.unitPrice || 0) * (i.quantity || 1)).toLocaleString()}</li>`
  ).join('');

  return baseTemplate(`
    <h2 style="color:#eee;margin:0 0 20px;">${isNew ? 'You Have a New Quote!' : 'Your Quote Has Been Updated'}</h2>
    ${infoBox(`
      <p style="color:#ccc;margin:4px 0;">Quote: <strong style="color:#eee;">#${quote.quoteNumber}</strong></p>
      ${quote.validUntil ? `<p style="color:#ccc;margin:4px 0;">Valid Until: <strong style="color:#f5c518;">${new Date(quote.validUntil).toLocaleDateString('en-IN')}</strong></p>` : ''}
    `)}
    <div style="margin:0 0 16px;">
      <p style="color:#eee;font-weight:bold;margin:0 0 8px;">Items:</p>
      <ul style="padding-left:20px;margin:0;">${itemsList}</ul>
    </div>
    ${infoBox(`
      ${quote.discountPercent ? `<p style="color:#ccc;margin:4px 0;">Discount: ${quote.discountPercent}%</p>` : ''}
      <p style="color:#8f8;font-size:18px;font-weight:bold;margin:8px 0 0;">Total: ₹${(quote.finalAmount || quote.totalAmount || 0).toLocaleString()}</p>
    `, { bg: '#1a2e1a' })}
    ${quote.adminNotes ? `<p style="color:#aaa;font-size:13px;margin:0 0 16px;">Note: "${quote.adminNotes}"</p>` : ''}
    ${ctaButton('View Quote', CLIENT_URL() + '/corporate/quotes')}
    <p style="color:#888;font-size:13px;">Log in to approve or discuss this quote.</p>
  `, { title: 'Giftsity Corporate' });
};

const cancellationTemplate = (order) => {
  const refundStatus = order.paymentStatus === 'refunded' ? 'Refund initiated' : order.paymentStatus === 'refund_pending' ? 'Refund pending' : 'No payment was charged';
  const itemsList = (order.items || []).map(i =>
    `<li style="color:#ccc;margin:4px 0;">${i.title} x ${i.quantity} — ₹${(i.price * i.quantity).toLocaleString()}</li>`
  ).join('');

  return baseTemplate(`
    <h2 style="color:#eee;margin:0 0 20px;">Order Cancelled</h2>
    ${infoBox(`
      <p style="color:#ff6666;margin:4px 0;font-weight:bold;">Order #${order.orderNumber} has been cancelled</p>
      <p style="color:#ccc;margin:4px 0;">Amount: ₹${(order.totalAmount || 0).toLocaleString()}</p>
    `, { bg: '#2e1a1a' })}
    <ul style="color:#ccc;padding-left:20px;margin:0 0 16px;">${itemsList}</ul>
    ${infoBox(`
      <p style="color:#ccc;margin:0;">Refund Status: <strong style="color:#f5c518;">${refundStatus}</strong></p>
      ${order.paymentStatus === 'refunded' ? '<p style="color:#888;margin:8px 0 0;font-size:12px;">The refund will reflect in your account within 5-7 business days.</p>' : ''}
    `)}
    ${ctaButton('View Order Details', CLIENT_URL() + `/orders/${order._id}`)}
    <p style="color:#888;font-size:13px;">If you have questions, contact us at ${process.env.ADMIN_EMAIL || 'support@giftsity.com'}.</p>
  `);
};

module.exports = {
  baseTemplate,
  otpTemplate,
  orderConfirmationTemplate,
  payoutTemplate,
  commissionChangeTemplate,
  b2bInquiryTemplate,
  shippedTemplate,
  deliveredTemplate,
  reviewRequestTemplate,
  corporateWelcomeTemplate,
  corporateOrderStatusTemplate,
  corporateQuoteTemplate,
  cancellationTemplate
};
