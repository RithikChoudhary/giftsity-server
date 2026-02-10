const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const sendOTP = async (email, otp) => {
  console.log(`[Email] Sending OTP ${otp} to: ${email}`);
  await transporter.sendMail({
    from: `"Giftsity" <${process.env.SMTP_USER}>`,
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
};

const sendOrderConfirmation = async (email, order, type = 'customer') => {
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

  await transporter.sendMail({
    from: `"Giftsity" <${process.env.SMTP_USER}>`,
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
};

const sendPayoutNotification = async (email, payout) => {
  await transporter.sendMail({
    from: `"Giftsity" <${process.env.SMTP_USER}>`,
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
};

const sendCommissionChangeNotification = async (email, sellerName, oldRate, newRate) => {
  await transporter.sendMail({
    from: `"Giftsity" <${process.env.SMTP_USER}>`,
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
};

const sendB2BInquiryNotification = async (inquiry) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;

  await transporter.sendMail({
    from: `"Giftsity" <${process.env.SMTP_USER}>`,
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
};

module.exports = {
  sendOTP,
  sendOrderConfirmation,
  sendPayoutNotification,
  sendCommissionChangeNotification,
  sendB2BInquiryNotification
};
