/**
 * @file rateLimiter.middleware.js
 * @description Configures express-rate-limit instances to protect the API
 *              against brute-force and denial-of-service attacks.
 *
 * Two limiters are exported:
 *  - `globalLimiter`  — applied to all routes (generous window)
 *  - `authLimiter`    — stricter limit on auth endpoints (login, register)
 */

const rateLimit = require('express-rate-limit');

// ─── Global rate limiter ───────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 200,
  standardHeaders: true,  // Return rate limit info in `RateLimit-*` headers
  legacyHeaders:   false, // Disable deprecated `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests from this IP — please try again later.',
  },
});

// ─── Auth-specific rate limiter (stricter) ────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // Allow 20 login attempts per window per IP
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Too many authentication attempts — please wait 15 minutes and try again.',
  },
});

module.exports = { globalLimiter, authLimiter };
