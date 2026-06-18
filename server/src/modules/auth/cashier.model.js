/**
 * @file cashier.model.js
 * @module auth
 * @description Extended profile schema for Cashier users.
 *
 * A Cashier profile is linked 1-to-1 with a User document (via `userId`).
 * It stores POS-specific information such as the assigned terminal,
 * shift schedule, and a running performance summary.
 */

const mongoose = require('mongoose');

// ─── Schema Definition ─────────────────────────────────────────────────────
const CashierSchema = new mongoose.Schema(
  {
    // ── Link to the parent User ──────────────────────────────────────────────
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Cashier must be linked to a User account.'],
      unique:   true, // one profile per user
    },

    // ── POS Terminal assignment ──────────────────────────────────────────────
    assignedTerminal: {
      type:    String,
      trim:    true,
      default: 'Terminal-01',
    },

    // ── Shift schedule ───────────────────────────────────────────────────────
    shiftStart: {
      type: String, // "HH:MM" 24-hour format, e.g. "08:00"
      trim: true,
    },
    shiftEnd: {
      type: String,
      trim: true,
    },

    // ── Performance metrics (denormalised for fast dashboard reads) ──────────
    totalTransactions: {
      type:    Number,
      default: 0,
      min:     0,
    },
    totalSalesAmount: {
      type:    Number,
      default: 0,
      min:     0,
    },

    // ── Employee code / badge number ─────────────────────────────────────────
    employeeCode: {
      type:   String,
      unique: true,
      sparse: true, // allow null/undefined without uniqueness collision
      trim:   true,
      uppercase: true,
    },

    // ── Active / on-duty flag ────────────────────────────────────────────────
    isOnDuty: {
      type:    Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────
CashierSchema.index({ userId: 1 });
CashierSchema.index({ employeeCode: 1 });

module.exports = mongoose.model('Cashier', CashierSchema);
