/**
 * @file constants.js
 * @description Application-wide constants. Centralise magic strings here so
 *              that changes only need to happen in one place.
 */

// ─── User / Role constants ─────────────────────────────────────────────────
const USER_ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  EMPLOYEE: 'employee',
});

// ─── Payment Method constants ──────────────────────────────────────────────
const PAYMENT_METHODS = Object.freeze({
  CASH: 'cash',
  CARD: 'card',
  MOBILE_PAY: 'mobile_pay',
  BANK_TRANSFER: 'bank_transfer',
  CREDIT: 'credit',
});

// ─── Invoice status constants ──────────────────────────────────────────────
const INVOICE_STATUS = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  PARTIALLY_PAID: 'partially_paid',
  VOIDED: 'voided',
  REFUNDED: 'refunded',
});

// ─── Payroll period constants ──────────────────────────────────────────────
const PAYROLL_PERIOD = Object.freeze({
  WEEKLY: 'weekly',
  BI_WEEKLY: 'bi_weekly',
  MONTHLY: 'monthly',
});

// ─── Attendance status constants ───────────────────────────────────────────
const ATTENDANCE_STATUS = Object.freeze({
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
  HALF_DAY: 'half_day',
  ON_LEAVE: 'on_leave',
});

// ─── AI model / category constants ────────────────────────────────────────
const PREDICTION_TYPE = Object.freeze({
  SALES_FORECAST: 'sales_forecast',
  DEMAND_FORECAST: 'demand_forecast',
  RESTOCK_SUGGESTION: 'restock_suggestion',
});

module.exports = {
  USER_ROLES,
  PAYMENT_METHODS,
  INVOICE_STATUS,
  PAYROLL_PERIOD,
  ATTENDANCE_STATUS,
  PREDICTION_TYPE,
};
