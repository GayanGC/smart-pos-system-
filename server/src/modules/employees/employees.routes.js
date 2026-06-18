/**
 * @file employees.routes.js
 * @module employees
 * @description Express router for employee management, attendance, and payroll.
 *
 * Base path (mounted in app.js): /api/employees
 *
 * | Method | Path                         | Access          |
 * |--------|------------------------------|-----------------|
 * | GET    | /                            | Admin/Manager   |
 * | POST   | /                            | Admin           |
 * | GET    | /:id                         | Admin/Manager   |
 * | PUT    | /:id                         | Admin/Manager   |
 * | DELETE | /:id                         | Admin           |
 * | POST   | /attendance/scan             | Authenticated   |
 * | GET    | /attendance                  | Admin/Manager   |
 * | POST   | /payroll/generate            | Admin/Manager   |
 * | GET    | /payroll                     | Admin/Manager   |
 * | PATCH  | /payroll/:id/pay             | Admin           |
 */

const router = require('express').Router();
const {
  getEmployees, createEmployee, getEmployeeById, updateEmployee, deleteEmployee,
  clockIn, clockOut, getAttendance,
  generatePayroll, getPayroll, markPayrollAsPaid,
} = require('./employees.controller');
const { protect, authorize } = require('../../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

// ── Attendance (before /:id to avoid conflicts) ───────────────────────────
// QR clock-in/out endpoints accessible to any authenticated user (terminal kiosk)
router.post('/attendance/clock-in', clockIn);
router.post('/attendance/clock-out', clockOut);
router.get(
  '/attendance',
  authorize('super_admin', 'admin', 'manager'),
  getAttendance
);

// ── Payroll ───────────────────────────────────────────────────────────────
router.post(
  '/payroll/generate',
  authorize('super_admin', 'admin', 'manager'),
  generatePayroll
);
router.get(
  '/payroll',
  authorize('super_admin', 'admin', 'manager'),
  getPayroll
);
router.patch(
  '/payroll/:id/pay',
  authorize('super_admin', 'admin'),
  markPayrollAsPaid
);

// ── Employee CRUD ─────────────────────────────────────────────────────────
router.route('/')
  .get(authorize('super_admin', 'admin', 'manager'), getEmployees)
  .post(authorize('super_admin', 'admin'), createEmployee);

router.route('/:id')
  .get(authorize('super_admin', 'admin', 'manager'), getEmployeeById)
  .put(authorize('super_admin', 'admin', 'manager'), updateEmployee)
  .delete(authorize('super_admin', 'admin'), deleteEmployee);

module.exports = router;
