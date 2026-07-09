/**
 * @file auth.model.js
 * @module auth
 * @description Mongoose schema for system Users.
 *
 * Supports:
 * - Role-based access control (RBAC) via the `role` field.
 * - Secure password storage with bcrypt (auto-hashed on save).
 * - QR login flow: a `qrToken` + `qrTokenExpires` pair is generated
 *   server-side and scanned by the cashier's device.
 * - Soft-delete / deactivation via `isActive`.
 * - `lastLogin` timestamp for audit purposes.
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const { USER_ROLES } = require('../../config/constants');

// ─── Schema Definition ─────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema(
  {
    // ── Identity ────────────────────────────────────────────────────────────
    name: {
      type:     String,
      required: [true, 'Full name is required.'],
      trim:     true,
      maxlength: [100, 'Name cannot exceed 100 characters.'],
    },
    email: {
      type:      String,
      required:  [true, 'Email address is required.'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, 'Please provide a valid email address.'],
    },
    password: {
      type:      String,
      required:  [true, 'Password is required.'],
      minlength: [8, 'Password must be at least 8 characters.'],
      select:    false, // never returned in queries by default
    },

    // ── RBAC ────────────────────────────────────────────────────────────────
    role: {
      type:    String,
      enum:    Object.values(USER_ROLES),
      default: USER_ROLES.CASHIER,
    },

    // ── QR Login ─────────────────────────────────────────────────────────────
    // A short-lived token embedded in a QR code for passwordless login
    // on shared POS terminals.
    qrToken: {
      type:   String,
      select: false, // sensitive — exclude from default queries
    },
    qrTokenExpires: {
      type:   Date,
      select: false,
    },

    // ── Account state ────────────────────────────────────────────────────────
    isActive: {
      type:    Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },

    // ── Password reset ───────────────────────────────────────────────────────
    passwordResetToken:   { type: String, select: false },
    passwordResetExpires: { type: Date,   select: false },

    // ── Multi-tenant ──────────────────────────────────────────────────────────
    storeId: {
      type:     String,
      required: [true, 'Store ID is required.'],
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────
UserSchema.index({ email:   1 });
UserSchema.index({ role:    1 });
UserSchema.index({ storeId: 1 });

// ─── Pre-save hook: hash password ─────────────────────────────────────────
UserSchema.pre('save', async function (next) {
  // Only re-hash if the password field was actually changed
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12); // bcrypt cost factor 12
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Instance method: compare plain-text password ─────────────────────────
/**
 * @param {string} candidatePassword  The plain-text password submitted at login
 * @returns {Promise<boolean>}
 */
UserSchema.methods.matchPassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Instance method: check if QR token is still valid ────────────────────
UserSchema.methods.isQrTokenValid = function () {
  return this.qrToken && this.qrTokenExpires && this.qrTokenExpires > Date.now();
};

module.exports = mongoose.model('User', UserSchema);
