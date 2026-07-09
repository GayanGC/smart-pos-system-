/**
 * @file analytics.routes.js
 * @module ai-analytics
 * @description Express router for AI analytics and chatbot logging.
 *
 * Base path (mounted in app.js): /api/analytics
 *
 * | Method | Path                             | Access        |
 * |--------|----------------------------------|---------------|
 * | GET    | /predictions                     | Admin/Manager |
 * | POST   | /predictions                     | Admin/Manager |
 * | GET    | /predictions/:id                 | Admin/Manager |
 * | GET    | /summary                         | Admin/Manager |
 * | POST   | /chatbot/sessions                | Authenticated |
 * | POST   | /chatbot/sessions/:id/message    | Authenticated |
 * | GET    | /chatbot/sessions                | Admin/Manager |
 * | GET    | /chatbot/sessions/:id            | Authenticated |
 * | PATCH  | /chatbot/sessions/:id/end        | Authenticated |
 */

const router = require('express').Router();
const {
  getPredictions, createPrediction, getPredictionById,
  getAnalyticsSummary,
  startChatSession, appendMessage, processChat, getChatSessions, getChatSessionById, endChatSession,
  getSuperAdminDashboard,
} = require('./analytics.controller');
const { protect, authorize } = require('../../middleware/auth.middleware');

// All analytics routes require authentication
router.use(protect);

// ── Super Admin Dashboard ──────────────────────────────────────────────────
router.get(
  '/super-admin/dashboard',
  authorize('super_admin'),
  getSuperAdminDashboard
);

// ── Summary dashboard ──────────────────────────────────────────────────────
router.get(
  '/summary',
  authorize('super_admin', 'admin', 'manager'),
  getAnalyticsSummary
);

// ── Predictions ────────────────────────────────────────────────────────────
router.route('/predictions')
  .get(authorize('super_admin', 'admin', 'manager'), getPredictions)
  .post(authorize('super_admin', 'admin', 'manager'), createPrediction);

router.get(
  '/predictions/:id',
  authorize('super_admin', 'admin', 'manager'),
  getPredictionById
);

// ── Chatbot sessions ───────────────────────────────────────────────────────
router.post('/chat', processChat);
router.post('/chatbot/sessions', startChatSession);
router.post('/chatbot/sessions/:id/message', appendMessage);

router.get(
  '/chatbot/sessions',
  authorize('super_admin', 'admin', 'manager'),
  getChatSessions
);

router.get('/chatbot/sessions/:id', getChatSessionById);
router.patch('/chatbot/sessions/:id/end', endChatSession);

module.exports = router;
