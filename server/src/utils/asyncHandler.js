/**
 * @file asyncHandler.js
 * @description Higher-order function that wraps async Express route handlers,
 *              automatically forwarding any rejected promises to Express's
 *              next(err) error pipeline — eliminating repetitive try/catch blocks.
 *
 * @param {Function} fn  Async controller function (req, res, next)
 * @returns {Function}   Express-compatible middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
