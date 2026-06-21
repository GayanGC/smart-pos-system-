/**
 * @file auth.routes.js
 * @module auth
 * @description Express router for authentication endpoints.
 *
 * Base path (mounted in app.js): /api/auth
 *
 * | Method | Path               | Controller       | Access         |
 * |--------|--------------------|------------------|----------------|
 * | POST   | /register          | register         | Public*        |
 * | POST   | /login             | login            | Public         |
 * | POST   | /qr/generate       | generateQrToken  | Admin/Manager  |
 * | POST   | /qr/login          | loginWithQr      | Public (POS)   |
 * | GET    | /me                | getMe            | Authenticated  |
 * | POST   | /logout            | logout           | Authenticated  |
 *
 * * In production, /register should be protected by an admin token.
 */

const router  = require('express').Router();
const {
  register, login, generateQrToken, loginWithQr, getMe, logout,
} = require('./auth.controller');
const { protect, authorize }   = require('../../middleware/auth.middleware');
const { authLimiter }          = require('../../middleware/rateLimiter.middleware');

// ── Public routes (rate-limited) ────────────────────────────────────────────
router.post('/login',    authLimiter, login);
router.post('/qr/login', authLimiter, loginWithQr);

// ── Admin routes ────────────────────────────────────────────────────────────
router.post('/register', protect, authorize('super_admin', 'admin'), authLimiter, register);

// ── QR generation (admin/manager only) ──────────────────────────────────────
router.post(
  '/qr/generate',
  protect,
  authorize('super_admin', 'admin', 'manager'),
  generateQrToken
);

// ── Authenticated routes ─────────────────────────────────────────────────────
router.get('/me',    protect, getMe);
router.post('/logout', protect, logout);

module.exports = router;
