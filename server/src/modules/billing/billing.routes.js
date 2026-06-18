/**
 * @file billing.routes.js
 * @module billing
 * @description Express router for billing and invoicing.
 *
 * Base path (mounted in app.js): /api/billing
 *
 * | Method | Path                       | Access               |
 * |--------|----------------------------|----------------------|
 * | POST   | /invoices                  | Cashier / Admin      |
 * | GET    | /invoices                  | Admin / Manager      |
 * | GET    | /invoices/:id              | Authenticated        |
 * | PATCH  | /invoices/:id/void         | Admin / Manager      |
 * | POST   | /sync                      | Cashier / Admin      |
 * | GET    | /dashboard                 | Admin / Manager      |
 */

const router = require('express').Router();
const {
  createInvoice, getInvoices, getInvoiceById,
  voidInvoice, syncOfflineInvoices, getDashboard,
} = require('./billing.controller');
const { protect, authorize } = require('../../middleware/auth.middleware');

// All billing routes require authentication
router.use(protect);

// ── Dashboard ─────────────────────────────────────────────────────────────
router.get(
  '/dashboard',
  authorize('super_admin', 'admin', 'manager'),
  getDashboard
);

// ── Offline Sync (most important endpoint for the offline-first POS) ───────
router.post(
  '/sync',
  authorize('super_admin', 'admin', 'cashier'),
  syncOfflineInvoices
);

// ── Invoices ──────────────────────────────────────────────────────────────
router.route('/invoices')
  .post(authorize('super_admin', 'admin', 'cashier'), createInvoice)
  .get(authorize('super_admin', 'admin', 'manager'), getInvoices);

router.get('/invoices/:id', getInvoiceById);

router.patch(
  '/invoices/:id/void',
  authorize('super_admin', 'admin', 'manager'),
  voidInvoice
);

module.exports = router;
