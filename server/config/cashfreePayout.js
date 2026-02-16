const axios = require('axios');
const logger = require('../utils/logger');

const PAYOUT_ENV = process.env.CASHFREE_PAYOUT_ENV || 'test';
const BASE_URL = PAYOUT_ENV === 'production'
  ? 'https://payout-api.cashfree.com'
  : 'https://payout-gamma.cashfree.com';

// Token cache
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Authorize with Cashfree Payouts and get a Bearer token.
 * Token is cached and reused until 1 minute before expiry (6 min total).
 */
async function authorize() {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const clientId = process.env.CASHFREE_PAYOUT_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_PAYOUT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Cashfree Payout credentials not configured (CASHFREE_PAYOUT_CLIENT_ID / CASHFREE_PAYOUT_CLIENT_SECRET)');
  }

  try {
    const res = await axios.post(`${BASE_URL}/payout/v1/authorize`, {}, {
      headers: {
        'X-Client-Id': clientId,
        'X-Client-Secret': clientSecret,
        'Content-Type': 'application/json'
      }
    });

    if (res.data?.status === 'SUCCESS' && res.data?.data?.token) {
      cachedToken = res.data.data.token;
      // Token valid for ~6 minutes; cache for 5 minutes
      tokenExpiresAt = Date.now() + 5 * 60 * 1000;
      logger.info('[CashfreePayout] Authorized successfully');
      return cachedToken;
    }

    throw new Error(res.data?.message || 'Authorization failed');
  } catch (err) {
    cachedToken = null;
    tokenExpiresAt = 0;
    const msg = err.response?.data?.message || err.message;
    logger.error('[CashfreePayout] Auth failed:', msg);
    throw new Error(`Cashfree Payout auth failed: ${msg}`);
  }
}

/**
 * Direct Transfer -- send money to a beneficiary without pre-registration.
 * @param {Object} params
 * @param {number} params.amount - Amount in INR (min 1.00, bank transfer practical min 100)
 * @param {string} params.transferId - Unique ID for this transfer (max 40 chars)
 * @param {string} params.bankAccount - Beneficiary bank account number
 * @param {string} params.ifsc - IFSC code
 * @param {string} params.name - Account holder name
 * @param {string} params.phone - Phone number
 * @param {string} params.email - Email address
 * @param {string} [params.remarks] - Optional remarks
 * @returns {Object} { status, subCode, message, referenceId, utr, acknowledged }
 */
async function directTransfer({ amount, transferId, bankAccount, ifsc, name, phone, email, remarks }) {
  const token = await authorize();

  try {
    const res = await axios.post(`${BASE_URL}/payout/v1/directTransfer`, {
      amount: parseFloat(amount),
      transferId,
      transferMode: 'banktransfer',
      beneDetails: {
        bankAccount,
        ifsc,
        name: name || 'Seller',
        phone: phone || '9999999999',
        email: email || 'seller@giftsity.com',
        address1: 'India'
      },
      remarks: remarks || `Giftsity payout ${transferId}`
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = res.data;
    logger.info(`[CashfreePayout] DirectTransfer ${transferId}: status=${data.status}, subCode=${data.subCode}`);

    return {
      status: data.status,
      subCode: data.subCode,
      message: data.message,
      referenceId: data.data?.referenceId || '',
      utr: data.data?.utr || '',
      acknowledged: data.data?.acknowledged || 0
    };
  } catch (err) {
    const errData = err.response?.data;
    const msg = errData?.message || err.message;
    logger.error(`[CashfreePayout] DirectTransfer ${transferId} failed:`, msg);

    return {
      status: errData?.status || 'ERROR',
      subCode: errData?.subCode || '500',
      message: msg,
      referenceId: '',
      utr: '',
      acknowledged: 0
    };
  }
}

/**
 * Get the status of a previously initiated transfer.
 * @param {string} transferId - The transferId used when initiating the transfer
 * @returns {Object} Transfer details including status, utr, acknowledged, reason
 */
async function getTransferStatus(transferId) {
  const token = await authorize();

  try {
    const res = await axios.get(`${BASE_URL}/payout/v1.1/getTransferStatus`, {
      params: { transferId },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const transfer = res.data?.data?.transfer || {};
    logger.info(`[CashfreePayout] Status ${transferId}: ${transfer.status}, ack=${transfer.acknowledged}`);

    return {
      status: transfer.status || 'UNKNOWN',
      utr: transfer.utr || '',
      acknowledged: transfer.acknowledged || 0,
      reason: transfer.reason || '',
      processedOn: transfer.processedOn || '',
      transferMode: transfer.transferMode || ''
    };
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    logger.error(`[CashfreePayout] GetStatus ${transferId} failed:`, msg);
    throw new Error(`Failed to get transfer status: ${msg}`);
  }
}

module.exports = { authorize, directTransfer, getTransferStatus, BASE_URL };
