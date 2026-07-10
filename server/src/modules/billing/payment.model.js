/**
 * @file payment.model.js
 * @module billing
 * @description Records individual payment transactions.
 *
 * An Invoice may have multiple Payment documents (e.g. split tender:
 * partial cash + partial card). The Payment references back to its Invoice.
 */

const mongoose = require('mongoose');
const { PAYMENT_METHODS } = require('../../config/constants');

const PaymentSchema = new mongoose.Schema(
  {
    // ── Link to invoice ──────────────────────────────────────────────────────
    invoiceId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Invoice',
      required: [true, 'Payment must be linked to an Invoice.'],
      index:    true,
    },

    // ── Amount ───────────────────────────────────────────────────────────────
    amount: {
      type:     Number,
      required: [true, 'Payment amount is required.'],
      min:      [0.01, 'Payment amount must be greater than zero.'],
    },

    // ── Method ───────────────────────────────────────────────────────────────
    paymentMethod: {
      type:     String,
      required: [true, 'Payment method is required.'],
      enum:     Object.values(PAYMENT_METHODS),
    },

    // ── Reference (card auth code, bank ref, mobile transaction ID, etc.) ────
    referenceNumber: {
      type: String,
      trim: true,
    },

    // ── Who processed this payment ───────────────────────────────────────────
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
    },

    // ── Status ───────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ['completed', 'pending', 'failed', 'refunded'],
      default: 'completed',
    },

    notes: { type: String, maxlength: 300 },

    // ── Multi-tenant ──────────────────────────────────────────────────────────
    storeId: {
      type:    String,
      default: 'store_1',
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────
PaymentSchema.index({ invoiceId: 1 });
PaymentSchema.index({ storeId:   1 });
PaymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', PaymentSchema);
