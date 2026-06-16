const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');
const logger = require('../utils/logger');

const PAYU_ENV = process.env.PAYU_ENV || 'test';
const IS_PROD = PAYU_ENV === 'production';

// Hosted Checkout form-post endpoint
const PAYMENT_URL = IS_PROD
  ? 'https://secure.payu.in/_payment'
  : 'https://test.payu.in/_payment';

// Server-to-server postservice (verify / refund) endpoint
const POSTSERVICE_URL = IS_PROD
  ? 'https://info.payu.in/merchant/postservice?form=2'
  : 'https://test.payu.in/merchant/postservice?form=2';

function getKey() {
  const key = process.env.PAYU_MERCHANT_KEY;
  if (!key) throw new Error('PayU merchant key not configured (PAYU_MERCHANT_KEY)');
  return key;
}

function getSalt() {
  const salt = process.env.PAYU_MERCHANT_SALT;
  if (!salt) throw new Error('PayU merchant salt not configured (PAYU_MERCHANT_SALT)');
  return salt;
}

function sha512(str) {
  return crypto.createHash('sha512').update(str).digest('hex');
}

/**
 * Build the parameters (including signature hash) for a PayU Hosted Checkout
 * form POST. The client submits these as a hidden, auto-submitting form to
 * `action`.
 *
 * Request hash formula:
 * sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
 *
 * @returns {{ action: string, params: Object }}
 */
function buildPaymentRequest({ txnid, amount, productinfo, firstname, email, phone, surl, furl, udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = '' }) {
  const key = getKey();
  const salt = getSalt();

  // PayU expects amount with 2 decimal places as a string
  const amountStr = parseFloat(amount).toFixed(2);
  // productinfo must not contain characters that break the hash; keep it simple
  const safeProductInfo = String(productinfo || 'Order').replace(/\|/g, ' ');
  const safeName = String(firstname || 'Customer').replace(/\|/g, ' ');

  const hashSequence = [
    key,
    txnid,
    amountStr,
    safeProductInfo,
    safeName,
    email,
    udf1, udf2, udf3, udf4, udf5,
    '', '', '', '', '',
    salt
  ].join('|');

  const hash = sha512(hashSequence);

  const params = {
    key,
    txnid,
    amount: amountStr,
    productinfo: safeProductInfo,
    firstname: safeName,
    email,
    phone: phone || '9999999999',
    surl,
    furl,
    udf1, udf2, udf3, udf4, udf5,
    hash
  };

  return { action: PAYMENT_URL, params };
}

/**
 * Verify the reverse hash on a PayU response (POST to surl/furl or webhook).
 *
 * Response hash formula:
 * sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 *
 * If PayU added `additionalCharges`, it must be prefixed to the sequence.
 */
function verifyResponseHash(payuResponse) {
  const key = getKey();
  const salt = getSalt();

  const {
    status, txnid, amount, productinfo, firstname, email,
    udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = '',
    hash, additionalCharges
  } = payuResponse;

  if (!hash) return false;

  const baseSequence = [
    salt,
    status,
    '', '', '', '', '',
    udf5, udf4, udf3, udf2, udf1,
    email,
    firstname,
    productinfo,
    amount,
    txnid,
    key
  ].join('|');

  const sequence = additionalCharges
    ? `${additionalCharges}|${baseSequence}`
    : baseSequence;

  const expected = sha512(sequence);
  return expected === String(hash).toLowerCase();
}

/**
 * Verify a payment server-to-server using the verify_payment command.
 * hash = sha512(key|verify_payment|txnid|salt)
 *
 * @param {string} txnid - The merchant txnid used at checkout
 * @returns {Object} normalized { found, status, amount, mihpayid, raw }
 */
async function verifyPayment(txnid) {
  const key = getKey();
  const salt = getSalt();
  const command = 'verify_payment';
  const hash = sha512(`${key}|${command}|${txnid}|${salt}`);

  const body = querystring.stringify({ key, command, var1: txnid, hash });

  const res = await axios.post(POSTSERVICE_URL, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  const data = res.data || {};
  const details = data.transaction_details && data.transaction_details[txnid];

  if (!details) {
    return { found: false, status: 'not_found', amount: 0, mihpayid: '', raw: data };
  }

  return {
    found: true,
    status: (details.status || '').toLowerCase(),
    amount: parseFloat(details.amt || details.amount || 0),
    mihpayid: details.mihpayid || '',
    raw: details
  };
}

/**
 * Create a refund using the cancel_refund_transaction command.
 * hash = sha512(key|cancel_refund_transaction|var1|salt)
 * var1 = mihpayid (PayU payment id), var2 = refundId/token, var3 = amount
 *
 * @returns {Object} { success, status, message, raw }
 */
async function createRefund({ mihpayid, refundAmount, refundId }) {
  const key = getKey();
  const salt = getSalt();
  const command = 'cancel_refund_transaction';
  const amountStr = parseFloat(refundAmount).toFixed(2);
  const hash = sha512(`${key}|${command}|${mihpayid}|${salt}`);

  const body = querystring.stringify({
    key,
    command,
    var1: mihpayid,
    var2: refundId,
    var3: amountStr,
    hash
  });

  try {
    const res = await axios.post(POSTSERVICE_URL, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const data = res.data || {};
    // status === 1 indicates the refund request was accepted by PayU
    const success = data.status === 1 || data.status === '1';
    logger.info(`[PayU] Refund ${refundId} for ${mihpayid}: status=${data.status}, msg=${data.msg || data.message || ''}`);
    return {
      success,
      status: data.status,
      message: data.msg || data.message || '',
      requestId: data.request_id || '',
      raw: data
    };
  } catch (err) {
    const msg = err.response?.data?.msg || err.response?.data?.message || err.message;
    logger.error(`[PayU] Refund ${refundId} for ${mihpayid} failed:`, msg);
    throw new Error(`PayU refund failed: ${msg}`);
  }
}

module.exports = {
  buildPaymentRequest,
  verifyResponseHash,
  verifyPayment,
  createRefund,
  PAYMENT_URL,
  POSTSERVICE_URL,
  PAYU_ENV
};
