/**
 * @file product.model.js
 * @module inventory
 * @description Product / Inventory item schema.
 *
 * Key design decisions:
 * - `barcode` and `sku` are indexed for fast POS barcode scans.
 * - `lowStockThreshold` triggers server-side alert logic in the controller.
 * - `expiryDate` enables expiry-based filtering and alerts.
 * - `supplier` is a denormalised snapshot (name, phone, email) stored inline
 *    for offline resilience; `supplierId` links to the canonical Supplier doc.
 * - `priceHistory` keeps an audit trail of price changes.
 */

const mongoose = require('mongoose');

// ─── Sub-schemas ───────────────────────────────────────────────────────────

/** Embedded supplier snapshot (denormalised for offline use) */
const SupplierSnapshotSchema = new mongoose.Schema(
  {
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Supplier',
    },
    name: {
      type:     String,
      required: [true, 'Supplier name is required in product.'],
      trim:     true,
    },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  { _id: false } // no separate _id for this sub-document
);

/** Price history entry — appended on every price change */
const PriceHistorySchema = new mongoose.Schema(
  {
    price:     { type: Number, required: true },
    changedAt: { type: Date,   default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

// ─── Main Schema ───────────────────────────────────────────────────────────
const ProductSchema = new mongoose.Schema(
  {
    // ── Identity & Lookup ────────────────────────────────────────────────────
    name: {
      type:      String,
      required:  [true, 'Product name is required.'],
      trim:      true,
      maxlength: [200, 'Product name cannot exceed 200 characters.'],
    },
    description: {
      type:      String,
      maxlength: [1000, 'Description cannot exceed 1000 characters.'],
    },

    // Barcode (EAN-13, UPC, QR code value, etc.)
    barcode: {
      type:   String,
      unique: true,
      sparse: true, // allow products without a barcode (bulk items)
      trim:   true,
    },

    // Stock Keeping Unit — internal unique product code
    sku: {
      type:     String,
      required: [true, 'SKU is required.'],
      unique:   true,
      trim:     true,
      uppercase: true,
    },

    // ── Categorisation ────────────────────────────────────────────────────────
    category: {
      type:    String,
      trim:    true,
      default: 'Uncategorised',
    },
    brand: { type: String, trim: true },
    unit:  {
      type:    String,
      default: 'pcs', // pcs, kg, litre, box …
      trim:    true,
    },

    // ── Pricing ───────────────────────────────────────────────────────────────
    costPrice: {
      type:    Number,
      required:[true, 'Cost price is required.'],
      min:     [0, 'Cost price cannot be negative.'],
    },
    sellingPrice: {
      type:     Number,
      required: [true, 'Selling price is required.'],
      min:      [0, 'Selling price cannot be negative.'],
    },
    taxRate: {
      type:    Number,
      default: 0,       // percentage, e.g. 15 = 15%
      min:     0,
      max:     100,
    },
    priceHistory: [PriceHistorySchema], // audit trail

    // ── Stock ─────────────────────────────────────────────────────────────────
    quantityInStock: {
      type:    Number,
      default: 0,
      min:     [0, 'Quantity in stock cannot be negative.'],
    },
    lowStockThreshold: {
      type:    Number,
      default: 10, // alert when stock falls at or below this value
      min:     [0, 'Low stock threshold cannot be negative.'],
    },

    // ── Expiry ────────────────────────────────────────────────────────────────
    expiryDate: {
      type: Date,
      // Optional — for perishable goods only
    },

    // ── Supplier (denormalised snapshot + FK) ─────────────────────────────────
    supplier: {
      type:     SupplierSnapshotSchema,
      required: [true, 'Supplier information is required.'],
    },

    // ── Recipes (for composite products) ──────────────────────────────────────
    recipeIngredients: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        quantityRequired: { type: Number, min: [0, 'Required quantity cannot be negative.'] },
      }
    ],

    // ── Flags ─────────────────────────────────────────────────────────────────
    isActive: {
      type:    Boolean,
      default: true,
    },
    isFeatured: {
      type:    Boolean,
      default: false,
    },

    // ── Media ─────────────────────────────────────────────────────────────────
    imageUrl: { type: String, trim: true },

    // ── Multi-tenant ──────────────────────────────────────────────────────────
    storeId: {
      type:    String,
      default: 'store_1',
    },
  },
  {
    timestamps: true,
    // Virtual to quickly check if stock is low
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtuals ──────────────────────────────────────────────────────────────

/** Returns true when quantityInStock ≤ lowStockThreshold */
ProductSchema.virtual('isLowStock').get(function () {
  return this.quantityInStock <= this.lowStockThreshold;
});

/** Returns true when the product is expired (has expiryDate and it is past) */
ProductSchema.virtual('isExpired').get(function () {
  return this.expiryDate ? this.expiryDate < new Date() : false;
});

// ─── Indexes ───────────────────────────────────────────────────────────────
ProductSchema.index({ sku:     1 });
ProductSchema.index({ barcode: 1 });
ProductSchema.index({ storeId: 1 });
ProductSchema.index({ category: 1, isActive: 1 });
ProductSchema.index({ name: 'text', description: 'text', brand: 'text' }); // full-text
ProductSchema.index({ 'supplier.supplierId': 1 });
ProductSchema.index({ expiryDate: 1 }); // for expiry-alert queries

module.exports = mongoose.model('Product', ProductSchema);
