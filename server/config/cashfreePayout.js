const axios = require('axios');
const logger = require('../utils/logger');

const PAYOUT_ENV = process.env.CASHFREE_PAYOUT_ENV || 'test';
const BASE_URL = PAYOUT_ENV === 'production'
  ? 'https://api.cashfree.com/payout'
  : 'https://sandbox.cashfree.com/payout';

const API_VERSION = '2024-01-01';

/**
 * Build auth headers for Cashfree Payouts V2.
 * V2 uses x-client-id + x-client-secret directly on every request (no token step).
 */
function getHeaders() {
  const clientId = process.env.CASHFREE_PAYOUT_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_PAYOUT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Cashfree Payout credentials not configured (CASHFREE_PAYOUT_CLIENT_ID / CASHFREE_PAYOUT_CLIENT_SECRET)');
  }

  return {
    'x-client-id': clientId,
    'x-client-secret': clientSecret,
    'x-api-version': API_VERSION,
    'Content-Type': 'application/json'
  };
}

/**
 * Standard Transfer V2 -- send money to a beneficiary without pre-registration.
 * Uses POST /transfers with inline beneficiary_instrument_details.
 *
 * @param {Object} params
 * @param {number} params.amount - Amount in INR (min 1.00, bank transfer practical min 100)
 * @param {string} params.transferId - Unique ID for this transfer (max 40 chars, alphanumeric + underscore)
 * @param {string} params.bankAccount - Beneficiary bank account number
 * @param {string} params.ifsc - IFSC code
 * @param {string} params.name - Account holder name
 * @param {string} params.phone - Phone number
 * @param {string} params.email - Email address
 * @param {string} [params.remarks] - Optional remarks
 * @returns {Object} { status, subCode, message, referenceId, utr, acknowledged }
 */
async function directTransfer({ amount, transferId, bankAccount, ifsc, name, phone, email, remarks }) {
  try {
    const res = await axios.post(`${BASE_URL}/transfers`, {
      transfer_id: transferId,
      transfer_amount: parseFloat(amount),
      transfer_mode: 'banktransfer',
      beneficiary_details: {
        beneficiary_name: name || 'Seller',
        beneficiary_instrument_details: {
          bank_account_number: bankAccount,
          bank_ifsc: ifsc
        },
        beneficiary_contact_details: {
          beneficiary_phone: phone || '9999999999',
          beneficiary_email: email || 'seller@giftsity.com'
        }
      },
      transfer_remarks: (remarks || `Giftsity payout ${transferId}`).substring(0, 70)
    }, { headers: getHeaders() });

    const data = res.data;
    const isCompleted = data.status === 'SUCCESS' && data.status_code === 'COMPLETED';

    logger.info(`[CashfreePayout] Transfer ${transferId}: status=${data.status}, status_code=${data.status_code || ''}`);

    return {
      status: data.status,
      subCode: data.status_code || data.status,
      message: data.status_description || '',
      referenceId: data.cf_transfer_id || '',
      utr: data.transfer_utr || '',
      acknowledged: isCompleted ? 1 : 0
    };
  } catch (err) {
    const errData = err.response?.data;
    const msg = errData?.message || err.message;
    logger.error(`[CashfreePayout] Transfer ${transferId} failed:`, msg);

    return {
      status: errData?.status || 'ERROR',
      subCode: errData?.code || '500',
      message: msg,
      referenceId: '',
      utr: '',
      acknowledged: 0
    };
  }
}

/**
 * Get Transfer Status V2 -- check the status of a previously initiated transfer.
 * Uses GET /transfers/{transferId}/status
 *
 * @param {string} transferId - The transfer_id used when initiating the transfer
 * @returns {Object} Transfer details including status, utr, acknowledged, reason
 */
async function getTransferStatus(transferId) {
  try {
    const res = await axios.get(`${BASE_URL}/transfers/${encodeURIComponent(transferId)}/status`, {
      headers: getHeaders()
    });

    const data = res.data;
    const isCompleted = data.status === 'SUCCESS' && data.status_code === 'COMPLETED';
    const isFailed = ['FAILED', 'REVERSED', 'REJECTED'].includes(data.status);

    logger.info(`[CashfreePayout] Status ${transferId}: status=${data.status}, code=${data.status_code || ''}`);

    return {
      status: data.status || 'UNKNOWN',
      utr: data.transfer_utr || '',
      acknowledged: isCompleted ? 1 : 0,
      reason: isFailed ? (data.status_code || data.status_description || '') : '',
      processedOn: data.updated_on || '',
      transferMode: data.transfer_mode || ''
    };
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    logger.error(`[CashfreePayout] GetStatus ${transferId} failed:`, msg);
    throw new Error(`Failed to get transfer status: ${msg}`);
  }
}

module.exports = { directTransfer, getTransferStatus, BASE_URL };
