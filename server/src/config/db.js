/**
 * @file db.js
 * @description Mongoose connection factory.
 *
 * Features:
 * - Single connection instance (Mongoose manages the internal pool).
 * - Graceful shutdown: closes the connection when the process receives
 *   SIGINT / SIGTERM so in-flight operations can complete cleanly.
 * - Logs connection events at the appropriate log level.
 */

const mongoose = require('mongoose');
const logger   = require('../utils/logger');

/**
 * Connects to MongoDB using the URI stored in MONGO_URI env variable.
 * Call this once at application startup (in server.js).
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options are the defaults in Mongoose 7+ but are listed
      // explicitly for clarity and forward compatibility.
      autoIndex: process.env.NODE_ENV !== 'production', // disable in prod for perf
    });

    logger.info(`✅  MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`❌  MongoDB connection error: ${error.message}`);
    // Exit the process so the orchestrator (PM2 / Docker) can restart it.
    process.exit(1);
  }
};

// ─── Graceful shutdown handlers ────────────────────────────────────────────
const gracefulShutdown = async (signal) => {
  logger.warn(`⚠️   ${signal} received — closing MongoDB connection…`);
  await mongoose.connection.close();
  logger.info('🔌  MongoDB connection closed.');
  process.exit(0);
};

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ─── Connection-event logging ──────────────────────────────────────────────
mongoose.connection.on('disconnected', () => logger.warn('⚠️   MongoDB disconnected.'));
mongoose.connection.on('reconnected',  () => logger.info('🔄  MongoDB reconnected.'));

module.exports = connectDB;
