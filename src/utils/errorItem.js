// Error responses: English text plus a `code` the frontend translates
// (vite-app/src/lib/i18n.ts). See docs/adr/0004-error-codes.md.

/**
 * One item of a response's `errors` list; `error` is the English fallback.
 *
 * @param {string} [label]  what the error is about: a line, a row, an SKU or a serial
 * @param {{code:string, params?:Object, reason:string}} issue
 */
function errorItem(label, { code, params = {}, reason }) {
  return { label, code, params, error: label ? `${label}: ${reason}` : reason };
}

/** A 4xx response body. */
function failure(code, error, params = {}, errors) {
  return { success: false, code, params, error, ...(errors && { errors }) };
}

module.exports = { errorItem, failure };
