/**
 * @file error.middleware.js
 * @description Centralised Express error-handling middleware.
 *
 * This must be registered LAST in app.js (after all routes) so Express
 * recognises it as an error handler (4-argument signature).
 *
 * Handles:
 * - Mongoose CastError    → 400 Bad Request
 * - Mongoose Validation   → 422 Unprocessable Entity
 * - MongoDB duplicate key → 409 Conflict
 * - JWT errors            → 401 Unauthorised
 * - Generic errors        → 500 Internal Server Error
 */

const logger = require('../utils/logger');

// ─── Error normaliser helpers ──────────────────────────────────────────────

/** Mongoose CastError (e.g. invalid ObjectId) */
const handleCastError = (err) => ({
  statusCode: 400,
  message: `Invalid value '${err.value}' for field '${err.path}'.`,
});

/** Mongoose ValidationError */
const handleValidationError = (err) => {
  const messages = Object.values(err.errors).map((e) => e.message);
  return {
    statusCode: 422,
    message: 'Validation failed.',
    errors: messages,
  };
};

/** MongoDB duplicate key (code 11000) */
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  return {
    statusCode: 409,
    message: `Duplicate value: '${value}' already exists for field '${field}'.`,
  };
};

/** JWT errors */
const handleJwtError      = () => ({ statusCode: 401, message: 'Invalid token. Please log in again.' });
const handleJwtExpired    = () => ({ statusCode: 401, message: 'Token expired. Please log in again.' });

// ─── Main error handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Log the full error (stack in dev, message in prod)
  if (process.env.NODE_ENV === 'development') {
    logger.error(err.stack || err.message);
  } else {
    logger.error(err.message);
  }

  // Default error shape
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Internal Server Error';
  let errors     = null;

  // ── Mongoose errors ──────────────────────────────────────────────────────
  if (err.name === 'CastError') {
    ({ statusCode, message } = handleCastError(err));
  } else if (err.name === 'ValidationError') {
    ({ statusCode, message, errors } = handleValidationError(err));
  } else if (err.code === 11000) {
    ({ statusCode, message } = handleDuplicateKeyError(err));
  }
  // ── JWT errors ────────────────────────────────────────────────────────────
  else if (err.name === 'JsonWebTokenError') {
    ({ statusCode, message } = handleJwtError());
  } else if (err.name === 'TokenExpiredError') {
    ({ statusCode, message } = handleJwtExpired());
  }

  // ── Send response ─────────────────────────────────────────────────────────
  const payload = { success: false, message };
  if (errors) payload.errors = errors;

  // In development, expose the stack trace in the response body for easier debugging
  if (process.env.NODE_ENV === 'development') {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
};

module.exports = errorHandler;
