/**
 * QuantityState Module
 *
 * Encapsulates Product quantity state validation and computation.
 * Handles accountable and non_accountable quantities independently.
 *
 * Responsibilities:
 * - Validate that a quantity delta doesn't result in negative balance
 * - Compute new quantity after applying delta
 * - Provide clear error messages for validation failures
 *
 * Not responsible for:
 * - Writing to database (caller/controller handles this)
 * - Webhook firing (kept separate per ADR)
 * - Transaction record creation (controller coordinates)
 */

/**
 * Validate a quantity change against current balance
 *
 * @param {number} currentQuantity - Current quantity in stock
 * @param {number} delta - Signed change: positive=inbound, negative=outbound
 * @param {Object} options - Validation options
 * @param {string} options.quantityType - 'accountable' or 'non_accountable'
 * @returns {Object} {ok: boolean, newQuantity?: number, reason?: string}
 */
function validate(currentQuantity, delta, options = {}) {
  const { quantityType = 'accountable' } = options;

  // Parse inputs
  const current = parseInt(currentQuantity) || 0;
  const change = parseInt(delta) || 0;
  const newQty = current + change;

  // Check non-negative invariant
  if (newQty < 0) {
    const typeName =
      quantityType === 'accountable' ? '有帳' : '無帳';
    return {
      ok: false,
      reason: `無法出庫：${typeName}庫存不足（目前：${current}，要出庫：${Math.abs(change)}）`,
    };
  }

  return {
    ok: true,
    newQuantity: newQty,
  };
}

/**
 * Compute absolute outbound quantity from a signed delta
 *
 * @param {number} delta - Signed quantity_change
 * @returns {number} Absolute outbound quantity (positive number)
 */
function getOutboundQuantity(delta) {
  const change = parseInt(delta) || 0;
  return Math.abs(Math.min(change, 0));
}

/**
 * Compute absolute inbound quantity from a signed delta
 *
 * @param {number} delta - Signed quantity_change
 * @returns {number} Absolute inbound quantity (positive number)
 */
function getInboundQuantity(delta) {
  const change = parseInt(delta) || 0;
  return Math.max(change, 0);
}

module.exports = {
  validate,
  getOutboundQuantity,
  getInboundQuantity,
};
