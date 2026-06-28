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
    const mongoString = process.env.MONGODB_URI || process.env.MONGO_URI;
    const conn = await mongoose.connect(mongoString, {
      // These options are the defaults in Mongoose 7+ but are listed
      // explicitly for clarity and forward compatibility.
      autoIndex: process.env.NODE_ENV !== 'production', // disable in prod for perf
    });

    logger.info(`✅  MongoDB connected: ${conn.connection.host}`);
    
    // ─── Programmatic Auto-Seed Admin User ──────────────────────────────
    try {
      const User = require('../modules/auth/auth.model');
      const { USER_ROLES } = require('./constants');
      const adminEmail = 'admin@example.com';
      
      let admin = await User.findOne({ email: adminEmail });
      if (!admin) {
        await User.create({
          name: 'Admin Owner',
          email: adminEmail,
          password: 'password123',
          role: USER_ROLES.SUPER_ADMIN || 'super_admin',
        });
        logger.info(`🌱 [AUTO-SEED] Created default admin user: ${adminEmail}`);
      } else {
        // Force update to password123 to ensure sync
        admin.password = 'password123';
        await admin.save();
        logger.info(`🌱 [AUTO-SEED] Synchronized admin user password: ${adminEmail}`);
      }
    } catch (seedErr) {
      logger.error(`🔴 [AUTO-SEED] Programmatic seed error: ${seedErr.message}`);
    }

    const uri = mongoString || '';
    if (uri.includes('mongodb+srv') || uri.includes('cluster')) {
      logger.info('🟢 [DATABASE] Successfully connected to MongoDB ATLAS (Cloud Cloud Layer)');
    } else {
      logger.info('💻 [DATABASE] Successfully connected to LOCAL MongoDB (localhost)');
    }
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
