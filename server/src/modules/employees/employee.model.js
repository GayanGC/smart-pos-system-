/**
 * @file employee.model.js
 * @module employees
 * @description Mongoose schema for Employee master records.
 *
 * Employees are different from Users (who are system login accounts).
 * An Employee record stores HR data: department, designation, salary, documents.
 * An employee may also have a linked User account (for login) via `userId`.
 */

const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema(
  {
    // ── Link to system User (optional — some employees may not log in) ────────
    userId: {
      type:   mongoose.Schema.Types.ObjectId,
      ref:    'User',
      sparse: true,
      unique: true,
    },

    // ── Personal identity ────────────────────────────────────────────────────
    employeeId: {
      type:      String,
      required:  [true, 'Employee ID is required.'],
      unique:    true,
      trim:      true,
      uppercase: true,
    },
    firstName: {
      type:     String,
      required: [true, 'First name is required.'],
      trim:     true,
    },
    lastName: {
      type:     String,
      required: [true, 'Last name is required.'],
      trim:     true,
    },
    dateOfBirth: { type: Date },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    },
    nationalId:  { type: String, trim: true },
    photo:       { type: String, trim: true }, // URL to profile image

    // ── Contact ───────────────────────────────────────────────────────────────
    email: {
      type:      String,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, 'Provide a valid email.'],
    },
    phone:   { type: String, trim: true },
    address: {
      street:  { type: String },
      city:    { type: String },
      state:   { type: String },
      country: { type: String, default: 'Sri Lanka' },
      zip:     { type: String },
    },

    // ── HR ────────────────────────────────────────────────────────────────────
    department:   { type: String, trim: true },
    designation:  { type: String, trim: true },
    dateJoined:   { type: Date,   default: Date.now },
    dateLeft:     { type: Date }, // null = still employed

    // ── QR Code for attendance clock-in / clock-out ──────────────────────────
    // The QR code value is the employee's unique `employeeId`.
    // Scanning it calls the attendance endpoint.
    qrCodeValue:  { type: String, trim: true },

    // ── Payroll ───────────────────────────────────────────────────────────────
    baseSalary: {
      type:    Number,
      default: 0,
      min:     0,
    },
    bankAccount: {
      bankName:      { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      branchCode:    { type: String, trim: true },
    },

    // ── Status ────────────────────────────────────────────────────────────────
    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtuals ──────────────────────────────────────────────────────────────
EmployeeSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// ─── Indexes ───────────────────────────────────────────────────────────────
EmployeeSchema.index({ employeeId: 1 });
EmployeeSchema.index({ department: 1, isActive: 1 });
EmployeeSchema.index({ firstName: 'text', lastName: 'text' }); // full-text search

module.exports = mongoose.model('Employee', EmployeeSchema);
