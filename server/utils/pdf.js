/**
 * PDF Generation for Corporate Invoices and Quotes
 * Uses PDFKit -- lightweight, no headless browser needed.
 */

const PDFDocument = require('pdfkit');

// ─── Shared helpers ──────────────────────────────────────────────

function formatCurrency(n) {
  return 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function drawHr(doc, y) {
  doc.strokeColor('#cccccc').lineWidth(0.5).moveTo(50, y).lineTo(545, y).stroke();
}

function drawTableHeader(doc, y, columns) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#555555');
  columns.forEach(col => {
    doc.text(col.label, col.x, y, { width: col.width, align: col.align || 'left' });
  });
  drawHr(doc, y + 15);
  return y + 20;
}

function drawTableRow(doc, y, columns, values) {
  doc.font('Helvetica').fontSize(9).fillColor('#333333');
  columns.forEach((col, i) => {
    doc.text(values[i] || '', col.x, y, { width: col.width, align: col.align || 'left' });
  });
  return y + 16;
}

// ─── Order Invoice ───────────────────────────────────────────────

function generateOrderInvoice(order, corporateUser) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];
      doc.on('data', b => buffers.push(b));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Header
      const isCorporate = corporateUser && corporateUser.companyName;
      doc.font('Helvetica-Bold').fontSize(22).fillColor('#f5c518').text('Giftsity', 50, 40);
      doc.font('Helvetica').fontSize(10).fillColor('#888888').text(isCorporate ? 'Corporate Gifting Platform' : 'Gift Marketplace', 50, 65);

      doc.font('Helvetica-Bold').fontSize(16).fillColor('#333333').text('INVOICE', 400, 40, { align: 'right' });
      doc.font('Helvetica').fontSize(9).fillColor('#666666');
      doc.text(`Invoice #: ${order.orderNumber}`, 400, 62, { align: 'right' });
      doc.text(`Date: ${formatDate(order.createdAt)}`, 400, 74, { align: 'right' });
      doc.text(`Status: ${(order.paymentStatus || '').toUpperCase()}`, 400, 86, { align: 'right' });

      drawHr(doc, 105);

      // Bill To
      let y = 118;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#333333').text('Bill To:', 50, y);
      y += 15;
      doc.font('Helvetica').fontSize(9).fillColor('#555555');
      if (isCorporate) {
        doc.text(corporateUser.companyName || '', 50, y); y += 12;
        doc.text(corporateUser.contactPerson || '', 50, y); y += 12;
        doc.text(corporateUser.email || '', 50, y); y += 12;
        if (corporateUser.phone) { doc.text(`Phone: ${corporateUser.phone}`, 50, y); y += 12; }
        if (corporateUser.gstNumber) { doc.text(`GST: ${corporateUser.gstNumber}`, 50, y); y += 12; }
      } else {
        // B2C customer: use shipping address name and order email
        const addr = order.shippingAddress || {};
        doc.text(addr.name || corporateUser?.name || '', 50, y); y += 12;
        const email = order.customerEmail || corporateUser?.email || '';
        if (email) { doc.text(email, 50, y); y += 12; }
        const phone = addr.phone || order.customerPhone || corporateUser?.phone || '';
        if (phone) { doc.text(`Phone: ${phone}`, 50, y); y += 12; }
      }

      // Ship To
      const shipY = 118;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#333333').text('Ship To:', 320, shipY);
      const addr = order.shippingAddress || {};
      doc.font('Helvetica').fontSize(9).fillColor('#555555');
      let sy = shipY + 15;
      if (addr.name) { doc.text(addr.name, 320, sy); sy += 12; }
      if (addr.street) { doc.text(addr.street, 320, sy); sy += 12; }
      const cityLine = [addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
      if (cityLine) { doc.text(cityLine, 320, sy); sy += 12; }
      if (addr.phone) { doc.text(`Phone: ${addr.phone}`, 320, sy); sy += 12; }

      y = Math.max(y, sy) + 10;
      drawHr(doc, y);
      y += 10;

      // Items table
      const cols = [
        { label: '#', x: 50, width: 25, align: 'left' },
        { label: 'Item', x: 75, width: 220, align: 'left' },
        { label: 'Qty', x: 295, width: 50, align: 'center' },
        { label: 'Unit Price', x: 345, width: 90, align: 'right' },
        { label: 'Amount', x: 435, width: 110, align: 'right' },
      ];
      y = drawTableHeader(doc, y, cols);

      (order.items || []).forEach((item, idx) => {
        if (y > 700) { doc.addPage(); y = 50; }
        const subtotal = (item.price || 0) * (item.quantity || 1);
        y = drawTableRow(doc, y, cols, [
          String(idx + 1),
          item.title || 'Product',
          String(item.quantity || 1),
          formatCurrency(item.price),
          formatCurrency(subtotal)
        ]);
      });

      drawHr(doc, y + 4);
      y += 16;

      // Totals
      const totalsX = 380;
      const totalsW = 165;
      doc.font('Helvetica').fontSize(9).fillColor('#555555');
      doc.text('Subtotal:', totalsX, y, { width: 80, align: 'left' });
      doc.text(formatCurrency(order.itemTotal || order.totalAmount), totalsX + 80, y, { width: totalsW - 80, align: 'right' });
      y += 14;

      if (order.discountAmount) {
        doc.text('Discount:', totalsX, y, { width: 80, align: 'left' });
        doc.text(`-${formatCurrency(order.discountAmount)}`, totalsX + 80, y, { width: totalsW - 80, align: 'right' });
        y += 14;
      }
      if (order.shippingCost) {
        doc.text('Shipping:', totalsX, y, { width: 80, align: 'left' });
        doc.text(formatCurrency(order.shippingCost), totalsX + 80, y, { width: totalsW - 80, align: 'right' });
        y += 14;
      }

      drawHr(doc, y);
      y += 6;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#333333');
      doc.text('Total:', totalsX, y, { width: 80, align: 'left' });
      doc.text(formatCurrency(order.totalAmount), totalsX + 80, y, { width: totalsW - 80, align: 'right' });
      y += 24;

      // Footer
      if (y > 720) { doc.addPage(); y = 50; }
      doc.font('Helvetica').fontSize(8).fillColor('#aaaaaa');
      doc.text('This is a computer-generated invoice and does not require a signature.', 50, y, { align: 'center', width: 495 });
      doc.text('Giftsity - Gift Marketplace | support@giftsity.com', 50, y + 12, { align: 'center', width: 495 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ─── Quote Document ──────────────────────────────────────────────

function generateQuoteDocument(quote) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];
      doc.on('data', b => buffers.push(b));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Header
      doc.font('Helvetica-Bold').fontSize(22).fillColor('#f5c518').text('Giftsity', 50, 40);
      doc.font('Helvetica').fontSize(10).fillColor('#888888').text('Corporate Gifting Platform', 50, 65);

      doc.font('Helvetica-Bold').fontSize(16).fillColor('#333333').text('QUOTE', 400, 40, { align: 'right' });
      doc.font('Helvetica').fontSize(9).fillColor('#666666');
      doc.text(`Quote #: ${quote.quoteNumber}`, 400, 62, { align: 'right' });
      doc.text(`Date: ${formatDate(quote.createdAt)}`, 400, 74, { align: 'right' });
      doc.text(`Status: ${(quote.status || '').toUpperCase()}`, 400, 86, { align: 'right' });
      if (quote.validUntil) {
        doc.text(`Valid Until: ${formatDate(quote.validUntil)}`, 400, 98, { align: 'right' });
      }

      drawHr(doc, 115);

      // Client info
      let y = 128;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#333333').text('Prepared For:', 50, y);
      y += 15;
      doc.font('Helvetica').fontSize(9).fillColor('#555555');
      doc.text(quote.companyName || '', 50, y); y += 12;
      doc.text(quote.contactEmail || '', 50, y); y += 12;
      if (quote.contactPhone) { doc.text(`Phone: ${quote.contactPhone}`, 50, y); y += 12; }
      y += 8;

      drawHr(doc, y);
      y += 10;

      // Items table
      const cols = [
        { label: '#', x: 50, width: 25, align: 'left' },
        { label: 'Item', x: 75, width: 200, align: 'left' },
        { label: 'Qty', x: 275, width: 50, align: 'center' },
        { label: 'Unit Price', x: 325, width: 80, align: 'right' },
        { label: 'Subtotal', x: 405, width: 140, align: 'right' },
      ];
      y = drawTableHeader(doc, y, cols);

      (quote.items || []).forEach((item, idx) => {
        if (y > 700) { doc.addPage(); y = 50; }
        y = drawTableRow(doc, y, cols, [
          String(idx + 1),
          item.title || 'Product',
          String(item.quantity || 1),
          formatCurrency(item.unitPrice),
          formatCurrency(item.subtotal || (item.unitPrice * item.quantity))
        ]);
      });

      drawHr(doc, y + 4);
      y += 16;

      // Totals
      const totalsX = 380;
      const totalsW = 165;
      doc.font('Helvetica').fontSize(9).fillColor('#555555');
      doc.text('Subtotal:', totalsX, y, { width: 80, align: 'left' });
      doc.text(formatCurrency(quote.totalAmount), totalsX + 80, y, { width: totalsW - 80, align: 'right' });
      y += 14;

      if (quote.discountPercent) {
        doc.text(`Discount (${quote.discountPercent}%):`, totalsX, y, { width: 80, align: 'left' });
        const discountAmt = (quote.totalAmount || 0) - (quote.finalAmount || 0);
        doc.text(`-${formatCurrency(discountAmt)}`, totalsX + 80, y, { width: totalsW - 80, align: 'right' });
        y += 14;
      }

      drawHr(doc, y);
      y += 6;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#333333');
      doc.text('Total:', totalsX, y, { width: 80, align: 'left' });
      doc.text(formatCurrency(quote.finalAmount || quote.totalAmount), totalsX + 80, y, { width: totalsW - 80, align: 'right' });
      y += 24;

      // Admin notes
      if (quote.adminNotes) {
        if (y > 680) { doc.addPage(); y = 50; }
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333').text('Notes:', 50, y);
        y += 14;
        doc.font('Helvetica').fontSize(9).fillColor('#555555').text(quote.adminNotes, 50, y, { width: 495 });
        y += doc.heightOfString(quote.adminNotes, { width: 495 }) + 10;
      }

      // Footer
      if (y > 720) { doc.addPage(); y = 50; }
      doc.font('Helvetica').fontSize(8).fillColor('#aaaaaa');
      doc.text('This quote is valid until the date specified above. Prices are subject to availability.', 50, y, { align: 'center', width: 495 });
      doc.text('Giftsity - Corporate Gifting Platform | support@giftsity.com', 50, y + 12, { align: 'center', width: 495 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateOrderInvoice, generateQuoteDocument };
