/**
 * @file server.js
 * @description Application entry point.
 *
 * Responsibilities:
 * 1. Load environment variables from .env
 * 2. Connect to MongoDB
 * 3. Start the HTTP server
 * 4. Handle unhandled promise rejections and uncaught exceptions gracefully
 *
 * To start the server:
 *   Development:  npm run dev     (nodemon with hot-reload)
 *   Production:   npm start       (node directly / PM2)
 */

'use strict';

// ── Load .env BEFORE any other imports that might read process.env ──────────
require('dotenv').config();

const app       = require('./src/app');
const connectDB = require('./src/config/db');
const logger    = require('./src/utils/logger');

// ─── Boot sequence ─────────────────────────────────────────────────────────
const startServer = async () => {
  // 1. Connect to MongoDB
  await connectDB();

  // 2. Start the HTTP server
  const PORT   = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    logger.info(`🚀  Server running in [${process.env.NODE_ENV}] mode on port ${PORT}`);
    logger.info(`📡  API base URL : http://localhost:${PORT}/api`);
    logger.info(`❤️   Health check : http://localhost:${PORT}/health`);
    
    // Start EOD report email scheduler
    try {
      const { startReportScheduler } = require('./src/utils/emailReportService');
      startReportScheduler();
      logger.info('⏰  EOD Email Report Scheduler started.');
    } catch (err) {
      logger.error('🔴  Failed to start EOD Email Report Scheduler:', err);
    }
  });

  // ── Graceful HTTP server shutdown ────────────────────────────────────────
  const shutdown = (signal) => {
    logger.warn(`⚠️   ${signal} received — shutting down HTTP server…`);
    server.close(() => {
      logger.info('💤  HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

// ─── Global error guards ───────────────────────────────────────────────────

/**
 * Unhandled promise rejections (e.g. failed DB query with no .catch())
 * Log the reason and crash intentionally so the orchestrator can restart.
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('🔴  Unhandled Promise Rejection:');
  logger.error(reason);
  process.exit(1);
});

/**
 * Truly unexpected synchronous exceptions.
 * These are bugs — log and exit.
 */
process.on('uncaughtException', (err) => {
  logger.error('🔴  Uncaught Exception:');
  logger.error(err.stack || err.message);
  process.exit(1);
});

// ─── Run ───────────────────────────────────────────────────────────────────
startServer();
