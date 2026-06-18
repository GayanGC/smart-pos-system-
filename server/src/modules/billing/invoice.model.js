/**
 * @file invoice.model.js
 * @module billing
 * @description Mongoose schema for Sales Invoices.
 *
 * Key design decisions:
 * - `invoiceNumber`      — human-readable, auto-generated, indexed for fast lookup.
 * - `paymentMethod`      — enum-constrained to prevent invalid entries.
 * - `isOfflineCreated`   — flag set by the React offline-sync client; the sync
 *                          endpoint sets this to false after reconciliation.
 * - `isVoided` / `voidReason` — soft-delete approach for fraud prevention;
 *                          voided invoices are never deleted, only marked.
 * - `lineItems`          — embedded array of purchased products (denormalised
 *                          snapshot for historical accuracy, as product prices change).
 * - `payments`           — array of Payment references to support split/partial pay.
 */

const mongoose = require('mongoose');
const { PAYMENT_METHODS, INVOICE_STATUS } = require('../../config/constants');

// ─── Sub-schemas ───────────────────────────────────────────────────────────

/** A single line item on the invoice (product snapshot at time of sale) */
const LineItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Product',
    },
    sku:          { type: String, trim: true },
    name:         { type: String, required: true, trim: true },
    barcode:      { type: String, trim: true },
    quantity:     { type: Number, required: true, min: [1, 'Quantity must be at least 1.'] },
    unitPrice:    { type: Number, required: true, min: 0 },
    taxRate:      { type: Number, default: 0, min: 0, max: 100 },
    discount:     { type: Number, default: 0, min: 0 }, // absolute discount in currency
    lineTotal:    { type: Number, required: true },     // (unitPrice * qty) - discount + tax
  },
  { _id: false }
);

// ─── Main Schema ───────────────────────────────────────────────────────────
const InvoiceSchema = new mongoose.Schema(
  {
    // ── Invoice identification ───────────────────────────────────────────────
    invoiceNumber: {
      type:     String,
      required: [true, 'Invoice number is required.'],
      unique:   true,
      trim:     true,
      uppercase: true,
    },

    // ── Parties ───────────────────────────────────────────────────────────────
    cashierId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Cashier reference is required.'],
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Customer', // optional — walk-in sales may not have a customer record
    },
    customerName:  { type: String, trim: true },   // for walk-in / quick capture
    customerPhone: { type: String, trim: true },

    // ── Line items ────────────────────────────────────────────────────────────
    lineItems: {
      type:     [LineItemSchema],
      required: [true, 'Invoice must have at least one line item.'],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message:   'Invoice must contain at least one line item.',
      },
    },

    // ── Totals ────────────────────────────────────────────────────────────────
    subTotal:      { type: Number, required: true, min: 0 }, // before tax & discount
    totalDiscount: { type: Number, default: 0,     min: 0 },
    totalTax:      { type: Number, default: 0,     min: 0 },
    grandTotal:    { type: Number, required: true, min: 0 }, // final payable amount
    amountPaid:    { type: Number, default: 0,     min: 0 },
    changeDue:     { type: Number, default: 0,     min: 0 }, // cash change returned

    // ── Payment ───────────────────────────────────────────────────────────────
    paymentMethod: {
      type:     String,
      required: [true, 'Payment method is required.'],
      enum: {
        values:  Object.values(PAYMENT_METHODS),
        message: `Payment method must be one of: ${Object.values(PAYMENT_METHODS).join(', ')}.`,
      },
    },
    payments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'Payment',
      },
    ],

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    Object.values(INVOICE_STATUS),
      default: INVOICE_STATUS.PENDING,
    },

    // ── Offline sync flags ────────────────────────────────────────────────────
    /**
     * Set to `true` by the React client when the invoice was created
     * while the device was offline (stored in IndexedDB).
     * The /api/billing/sync batch endpoint reconciles these and sets
     * isOfflineCreated back to false after successful server-side save.
     */
    isOfflineCreated: {
      type:    Boolean,
      default: false,
      index:   true, // queried in the sync endpoint
    },
    offlineCreatedAt: {
      type: Date, // the timestamp when the invoice was created offline
    },
    /**
     * Client-generated UUID v4 sent in every offline invoice payload.
     * The sync endpoint queries this field for idempotency — if a document
     * with the same offlineRef already exists, the invoice is skipped.
     * Sparse so that online invoices (which have no offlineRef) are not
     * forced to store a null value or compete for the unique constraint.
     */
    offlineRef: {
      type:   String,
      trim:   true,
      sparse: true, // unique only among documents that have this field
    },

    // ── Void / Fraud prevention ───────────────────────────────────────────────
    /**
     * Invoices are NEVER deleted — they are voided with a reason.
     * This provides a full, immutable audit trail for accounting & fraud detection.
     */
    isVoided: {
      type:    Boolean,
      default: false,
      index:   true,
    },
    voidReason: {
      type:      String,
      maxlength: [500, 'Void reason cannot exceed 500 characters.'],
    },
    voidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
    },
    voidedAt: {
      type: Date,
    },

    // ── Metadata ──────────────────────────────────────────────────────────────
    notes:  { type: String, maxlength: [500] },
    branch: { type: String, trim: true, default: 'Main Branch' },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtuals ──────────────────────────────────────────────────────────────

/** Remaining balance owed on the invoice */
InvoiceSchema.virtual('balanceDue').get(function () {
  return Math.max(0, this.grandTotal - this.amountPaid);
});

// ─── Indexes ───────────────────────────────────────────────────────────────
InvoiceSchema.index({ invoiceNumber:    1 });
InvoiceSchema.index({ cashierId: 1, createdAt: -1 });
InvoiceSchema.index({ status:          1 });
InvoiceSchema.index({ isOfflineCreated: 1 });
InvoiceSchema.index({ isVoided:         1 });
InvoiceSchema.index({ createdAt:        -1 }); // for date-range reports
InvoiceSchema.index({ offlineRef:       1 }, { unique: true, sparse: true }); // idempotency

module.exports = mongoose.model('Invoice', InvoiceSchema);
