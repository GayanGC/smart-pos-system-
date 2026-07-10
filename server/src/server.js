process.on('uncaughtException', (err) => { console.error('CRITICAL UNCAUGHT EXCEPTION:', err); process.exit(1); });
process.on('unhandledRejection', (reason, promise) => { console.error('CRITICAL UNHANDLED REJECTION:', reason); process.exit(1); });

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
// .env is in the root directory, so we look up one folder level
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const app       = require('./app');
const connectDB = require('./config/db');
const logger    = require('./utils/logger');

// ─── Boot sequence ─────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    // 1. Start the HTTP server FIRST so it binds instantly to the port and passes Railway checks
    const PORT   = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      logger.info(`🚀  Server running in [${process.env.NODE_ENV || 'development'}] mode on port ${PORT}`);
      logger.info(`📡  API base URL : http://localhost:${PORT}/api`);
      logger.info(`❤️   Health check : http://localhost:${PORT}/health`);
      
      // Start EOD report email scheduler
      try {
        const { startReportScheduler } = require('./utils/emailReportService');
        startReportScheduler();
        logger.info('⏰  EOD Email Report Scheduler started.');
      } catch (err) {
        logger.error('🔴  Failed to start EOD Email Report Scheduler:', err);
      }
    });

    // 2. Connect to MongoDB in the background so slow connection or Atlas timeouts don't block the boot phase
    connectDB()
      .then(() => logger.info('🔌  Mongoose connection established successfully.'))
      .catch((err) => {
        logger.error('❌  Mongoose connection error during background connect:', err);
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
  } catch (error) {
    logger.error('❌  Fatal error during server boot sequence:');
    logger.error(error.stack || error.message);
    process.exit(1);
  }
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
if (process.env.VERCEL || process.env.VERCEL_ENV) {
  // 1. Connect to MongoDB without blocking so Mongoose buffers queries
  connectDB().catch(err => logger.error('Vercel DB Connect Error:', err));
  
  // 2. Export the app for Vercel serverless environment
  module.exports = app;
} else {
  // Standard local/PM2 execution
  startServer();
}

console.log("Forcing Railway deployment - verified active boot sequence");
