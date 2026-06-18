/**
 * @file attendance.model.js
 * @module employees
 * @description Attendance tracking schema using QR-code-based clock-in/out.
 *
 * Workflow:
 * 1. Employee scans their QR code at the POS terminal.
 * 2. If no attendance record exists for today → clock IN (creates document).
 * 3. If a record exists with clockIn but no clockOut → clock OUT (updates document).
 * 4. `totalHoursWorked` is computed and stored on clock-out for fast payroll queries.
 */

const mongoose = require('mongoose');
const { ATTENDANCE_STATUS } = require('../../config/constants');

const AttendanceSchema = new mongoose.Schema(
  {
    // ── Employee reference ───────────────────────────────────────────────────
    employeeId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Employee',
      required: [true, 'Employee reference is required.'],
      index:    true,
    },

    // ── Date (date-only, stored as start of day UTC for easy grouping) ────────
    date: {
      type:     Date,
      required: [true, 'Attendance date is required.'],
    },

    // ── Time tracking ─────────────────────────────────────────────────────────
    clockIn: {
      type:     Date,
      required: [true, 'Clock-in time is required.'],
    },
    clockOut: {
      type: Date,
      // null = employee has clocked in but not yet out
    },

    /**
     * Stored in decimal hours for easy payroll calculation.
     * e.g. 7.5 = 7 hours 30 minutes
     * Computed on clock-out.
     */
    totalHoursWorked: {
      type:    Number,
      default: 0,
      min:     0,
    },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    Object.values(ATTENDANCE_STATUS),
      default: ATTENDANCE_STATUS.PRESENT,
    },

    // ── Location / terminal ───────────────────────────────────────────────────
    terminal: {
      type: String,
      trim: true,
    },

    // ── Overtime ──────────────────────────────────────────────────────────────
    overtimeHours: {
      type:    Number,
      default: 0,
      min:     0,
    },
    regularHours: {
      type:    Number,
      default: 0,
      min:     0,
    },

    notes: { type: String, maxlength: 300 },
  },
  {
    timestamps: true,
  }
);

// ─── Instance method: compute and store hours worked ──────────────────────
/**
 * Call after setting clockOut before saving.
 * Computes totalHoursWorked, regularHours, and overtimeHours (> 8 hours).
 *
 * @param {number} [standardHours=8]  Threshold for overtime calculation
 */
AttendanceSchema.methods.computeHours = function (standardHours = 8) {
  if (!this.clockIn || !this.clockOut) return;
  const diffMs   = this.clockOut.getTime() - this.clockIn.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  this.totalHoursWorked = parseFloat(diffHours.toFixed(2));
  this.regularHours     = parseFloat(Math.min(diffHours, standardHours).toFixed(2));
  this.overtimeHours    = parseFloat(Math.max(0, diffHours - standardHours).toFixed(2));
};

// ─── Compound index: one record per employee per day ─────────────────────
AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ date: -1 }); // for daily attendance reports

module.exports = mongoose.model('Attendance', AttendanceSchema);
