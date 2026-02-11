const axios = require('axios');

const CASHFREE_ENV = process.env.CASHFREE_ENV || 'sandbox';
const BASE_URL = CASHFREE_ENV === 'production'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';

const API_VERSION = '2025-01-01';

const cashfreeHeaders = () => ({
  'Content-Type': 'application/json',
  'x-api-version': API_VERSION,
  'x-client-id': process.env.CASHFREE_APP_ID,
  'x-client-secret': process.env.CASHFREE_SECRET_KEY
});

// Create order on Cashfree
async function createCashfreeOrder({ orderId, orderAmount, customerDetails, returnUrl, notifyUrl }) {
  const res = await axios.post(`${BASE_URL}/orders`, {
    order_id: orderId,
    order_amount: orderAmount,
    order_currency: 'INR',
    customer_details: {
      customer_id: customerDetails.customerId,
      customer_email: customerDetails.email,
      customer_phone: customerDetails.phone,
      customer_name: customerDetails.name || 'Customer'
    },
    order_meta: {
      return_url: returnUrl || `${process.env.CLIENT_URL}/orders?cf_id={order_id}`,
      notify_url: notifyUrl || ''
    }
  }, { headers: cashfreeHeaders() });

  return res.data;
}

// Get order status from Cashfree
async function getCashfreeOrder(orderId) {
  const res = await axios.get(`${BASE_URL}/orders/${orderId}`, {
    headers: cashfreeHeaders()
  });
  return res.data;
}

// Get payments for an order
async function getCashfreePayments(orderId) {
  const res = await axios.get(`${BASE_URL}/orders/${orderId}/payments`, {
    headers: cashfreeHeaders()
  });
  return res.data;
}

// Create refund for an order
async function createRefund({ orderId, refundAmount, refundId, refundNote }) {
  const res = await axios.post(`${BASE_URL}/orders/${orderId}/refunds`, {
    refund_amount: refundAmount,
    refund_id: refundId,
    refund_note: refundNote || 'Order cancelled by customer'
  }, { headers: cashfreeHeaders() });
  return res.data;
}

module.exports = { createCashfreeOrder, getCashfreeOrder, getCashfreePayments, createRefund, BASE_URL, cashfreeHeaders };
