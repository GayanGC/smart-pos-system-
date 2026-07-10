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
      autoIndex: false, // prevent auto-index building on boot in prod
    });

    logger.info(`✅  MongoDB connected: ${conn.connection.host}`);
    
    // ─── Programmatic Auto-Seed Admin User ──────────────────────────────
    try {
      const User = require('../modules/auth/auth.model');
      const { USER_ROLES } = require('./constants');
      
      // Primary admin: admin@smartpos.com / admin123
      const primaryEmail = 'admin@smartpos.com';
      let primaryAdmin = await User.findOne({ email: primaryEmail });
      if (!primaryAdmin) {
        await User.create({
          name: 'Admin Owner',
          email: primaryEmail,
          password: 'admin123',
          role: USER_ROLES.SUPER_ADMIN || 'super_admin',
          storeId: 'store_1',
        });
        logger.info(`🌱 [AUTO-SEED] Created primary admin: ${primaryEmail}`);
      } else {
        // Ensure storeId is set
        if (!primaryAdmin.storeId) {
          primaryAdmin.storeId = 'store_1';
          await primaryAdmin.save({ validateBeforeSave: false });
        }
        logger.info(`✅ [AUTO-SEED] Primary admin exists: ${primaryEmail}`);
      }

      // Legacy admin: admin@example.com / admin1234 (backward compat)
      const legacyEmail = 'admin@example.com';
      let legacyAdmin = await User.findOne({ email: legacyEmail });
      if (!legacyAdmin) {
        await User.create({
          name: 'Admin Legacy',
          email: legacyEmail,
          password: 'admin1234',
          role: USER_ROLES.SUPER_ADMIN || 'super_admin',
          storeId: 'store_1',
        });
        logger.info(`🌱 [AUTO-SEED] Created legacy admin: ${legacyEmail}`);
      } else {
        if (!legacyAdmin.storeId) {
          legacyAdmin.storeId = 'store_1';
          await legacyAdmin.save({ validateBeforeSave: false });
        }
      }
    } catch (seedErr) {
      logger.error(`🔴 [AUTO-SEED] Programmatic seed error: ${seedErr.message}`);
    }

    // ─── Programmatic Auto-Seed Default StoreConfig ─────────────────────
    try {
      const StoreConfig = require('../modules/billing/storeConfig.model');
      const User = require('../modules/auth/auth.model');

      const existing = await StoreConfig.findOne({ storeId: 'store_1' });
      if (!existing) {
        await StoreConfig.create({
          storeId:       'store_1',
          storeName:     'My Smart POS Store',
          address:       '123 Main Street, City',
          phone:         '0787327640',
          receiptFooter: 'Thank you for your purchase!',
          logoUrl:       '',
        });
        logger.info('🌱 [AUTO-SEED] Created default StoreConfig (store_1)');
      }

      // Ensure all existing users without storeId are assigned store_1
      const usersFixed = await User.updateMany(
        { storeId: { $exists: false } },
        { $set: { storeId: 'store_1' } }
      );
      if (usersFixed.modifiedCount > 0) {
        logger.info(`🔧 [AUTO-FIX] Assigned store_1 to ${usersFixed.modifiedCount} legacy user(s) without storeId`);
      }
    } catch (configErr) {
      logger.error(`🔴 [AUTO-SEED] StoreConfig seed error: ${configErr.message}`);
    }

    // ─── Auto-migrate legacy data without storeId ─────────────────────────
    try {
      const Product = require('../modules/inventory/product.model');
      const Invoice = require('../modules/billing/invoice.model');
      const Payment = require('../modules/billing/payment.model');

      const [pFix, iFix, payFix] = await Promise.all([
        Product.updateMany({ storeId: { $exists: false } }, { $set: { storeId: 'store_1' } }),
        Invoice.updateMany({ storeId: { $exists: false } }, { $set: { storeId: 'store_1' } }),
        Payment.updateMany({ storeId: { $exists: false } }, { $set: { storeId: 'store_1' } }),
      ]);
      const anyFixed = pFix.modifiedCount + iFix.modifiedCount + payFix.modifiedCount;
      if (anyFixed > 0) {
        logger.info(`🔧 [AUTO-MIGRATE] Products: ${pFix.modifiedCount}, Invoices: ${iFix.modifiedCount}, Payments: ${payFix.modifiedCount} → assigned storeId=store_1`);
      }
    } catch (migrateErr) {
      logger.error(`🔴 [AUTO-MIGRATE] Legacy data migration error: ${migrateErr.message}`);
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
