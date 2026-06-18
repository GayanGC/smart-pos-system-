/**
 * @file responseFormatter.js
 * @description Provides a unified JSON response shape across every API endpoint.
 *              Keeps the client contract consistent and easy to parse.
 *
 * Response envelope:
 * {
 *   success : boolean,
 *   message : string,
 *   data    : any | null,
 *   meta    : object | null   (pagination, counts, etc.)
 * }
 */

/**
 * Send a successful response.
 *
 * @param {import('express').Response} res
 * @param {object}  options
 * @param {number}  [options.statusCode=200]
 * @param {string}  [options.message='Success']
 * @param {*}       [options.data=null]
 * @param {object}  [options.meta=null]
 */
const sendSuccess = (res, { statusCode = 200, message = 'Success', data = null, meta = null } = {}) => {
  const payload = { success: true, message, data };
  if (meta) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

/**
 * Send an error response.
 *
 * @param {import('express').Response} res
 * @param {object}  options
 * @param {number}  [options.statusCode=500]
 * @param {string}  [options.message='Internal Server Error']
 * @param {*}       [options.errors=null]
 */
const sendError = (res, { statusCode = 500, message = 'Internal Server Error', errors = null } = {}) => {
  const payload = { success: false, message };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
};

module.exports = { sendSuccess, sendError };
