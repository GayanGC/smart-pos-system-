/**
 * @file supplier.model.js
 * @module inventory
 * @description Standalone Supplier schema.
 *
 * Suppliers are stored as their own collection so they can be managed
 * independently (CRUD) and referenced by multiple products. Products
 * also embed a snapshot of the supplier for offline/archival resilience
 * (denormalised nested object on the Product schema).
 */

const mongoose = require('mongoose');

// ─── Schema Definition ─────────────────────────────────────────────────────
const SupplierSchema = new mongoose.Schema(
  {
    // ── Identity ────────────────────────────────────────────────────────────
    name: {
      type:      String,
      required:  [true, 'Supplier name is required.'],
      trim:      true,
      maxlength: [150, 'Supplier name cannot exceed 150 characters.'],
    },
    contactPerson: {
      type: String,
      trim: true,
    },

    // ── Contact details ──────────────────────────────────────────────────────
    phone: {
      type:  String,
      trim:  true,
      match: [/^\+?[\d\s\-()]{7,20}$/, 'Please provide a valid phone number.'],
    },
    email: {
      type:      String,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, 'Please provide a valid email address.'],
    },

    // ── Address ──────────────────────────────────────────────────────────────
    address: {
      street:  { type: String, trim: true },
      city:    { type: String, trim: true },
      state:   { type: String, trim: true },
      country: { type: String, trim: true, default: 'Sri Lanka' },
      zip:     { type: String, trim: true },
    },

    // ── Business details ─────────────────────────────────────────────────────
    taxId: {
      type: String,
      trim: true,
    },
    paymentTerms: {
      type:    String,
      trim:    true,
      default: 'Net 30', // e.g. "Net 30", "COD", "Prepaid"
    },

    // ── Status ───────────────────────────────────────────────────────────────
    isActive: {
      type:    Boolean,
      default: true,
    },
    notes: {
      type:      String,
      maxlength: [500, 'Notes cannot exceed 500 characters.'],
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────
SupplierSchema.index({ name: 'text', email: 'text' }); // full-text search
SupplierSchema.index({ isActive: 1 });

module.exports = mongoose.model('Supplier', SupplierSchema);
