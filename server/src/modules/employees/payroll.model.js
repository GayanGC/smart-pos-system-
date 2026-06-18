/**
 * @file payroll.model.js
 * @module employees
 * @description Payroll record schema for a single pay period.
 *
 * One Payroll document is created per employee per pay period run.
 * Gross pay is derived from attendance data (totalHoursWorked × hourlyRate
 * or baseSalary for salaried employees), then deductions are applied.
 */

const mongoose = require('mongoose');
const { PAYROLL_PERIOD } = require('../../config/constants');

// ─── Deduction sub-schema ──────────────────────────────────────────────────
const DeductionSchema = new mongoose.Schema(
  {
    label:  { type: String, required: true, trim: true }, // e.g. "EPF", "Tax", "Loan"
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

// ─── Allowance sub-schema ──────────────────────────────────────────────────
const AllowanceSchema = new mongoose.Schema(
  {
    label:  { type: String, required: true, trim: true }, // e.g. "Transport", "Meal"
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

// ─── Main Schema ───────────────────────────────────────────────────────────
const PayrollSchema = new mongoose.Schema(
  {
    // ── Employee reference ───────────────────────────────────────────────────
    employeeId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Employee',
      required: [true, 'Employee reference is required.'],
      index:    true,
    },

    // ── Pay period ────────────────────────────────────────────────────────────
    period: {
      type:     String,
      enum:     Object.values(PAYROLL_PERIOD),
      required: [true, 'Pay period type is required.'],
    },
    periodStart: { type: Date, required: [true, 'Period start date is required.'] },
    periodEnd:   { type: Date, required: [true, 'Period end date is required.'] },

    // ── Working hours (pulled from Attendance records) ────────────────────────
    totalDaysWorked:  { type: Number, default: 0, min: 0 },
    totalHoursWorked: { type: Number, default: 0, min: 0 },
    overtimeHours:    { type: Number, default: 0, min: 0 },

    // ── Earnings ──────────────────────────────────────────────────────────────
    baseSalary:     { type: Number, default: 0, min: 0 },
    overtimePay:    { type: Number, default: 0, min: 0 },
    allowances:     [AllowanceSchema],
    grossPay:       { type: Number, required: true, min: 0 },

    // ── Deductions ────────────────────────────────────────────────────────────
    deductions:     [DeductionSchema],
    totalDeductions:{ type: Number, default: 0, min: 0 },

    // ── Net pay ───────────────────────────────────────────────────────────────
    netPay: { type: Number, required: true, min: 0 },

    // ── Payment ───────────────────────────────────────────────────────────────
    isPaid:    { type: Boolean, default: false },
    paidAt:    { type: Date },
    paidBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paymentRef:{ type: String, trim: true },

    notes: { type: String, maxlength: 500 },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────
PayrollSchema.index({ employeeId: 1, periodStart: -1 });
PayrollSchema.index({ isPaid: 1, period: 1 });

module.exports = mongoose.model('Payroll', PayrollSchema);
