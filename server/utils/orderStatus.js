/**
 * Centralized order status transition validator.
 * Prevents invalid backward transitions (e.g. delivered -> pending).
 */

const VALID_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],    // terminal state
  cancelled: [],    // terminal state
  refunded: []      // terminal state
};

/**
 * Check if a status transition is allowed.
 * @param {string} from - Current order status
 * @param {string} to - Desired new status
 * @returns {boolean}
 */
function isValidTransition(from, to) {
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

module.exports = { VALID_TRANSITIONS, isValidTransition };
