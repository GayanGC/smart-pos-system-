/**
 * @file employees.controller.js
 * @module employees
 * @description Handles Employee HR management, QR-based attendance clock-in/out,
 *              and Payroll generation.
 *
 * Routes:
 *  Employees:
 *    GET    /api/employees                   – list
 *    POST   /api/employees                   – create
 *    GET    /api/employees/:id               – get by id
 *    PUT    /api/employees/:id               – update
 *    DELETE /api/employees/:id               – soft-delete
 *
 *  Attendance:
 *    POST   /api/employees/attendance/scan   – QR scan clock-in / clock-out
 *    GET    /api/employees/attendance        – list (filterable by date, employee)
 *    GET    /api/employees/attendance/:id    – single record
 *
 *  Payroll:
 *    GET    /api/employees/payroll           – list
 *    POST   /api/employees/payroll/generate  – generate payroll for a period
 *    PATCH  /api/employees/payroll/:id/pay   – mark payroll as paid
 */

const Employee   = require('./employee.model');
const Attendance = require('./attendance.model');
const Payroll    = require('./payroll.model');
const asyncHandler       = require('../../utils/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/responseFormatter');
const { ATTENDANCE_STATUS } = require('../../config/constants');

// ═══════════════════════════════════════════════════════════════════════════
//  EMPLOYEE CRUD
// ═══════════════════════════════════════════════════════════════════════════

const getEmployees = asyncHandler(async (req, res) => {
  const { department, search, page = 1, limit = 20 } = req.query;
  const filter = { isActive: true };
  if (department) filter.department = department;
  if (search)     filter.$text      = { $search: search };

  const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const total = await Employee.countDocuments(filter);
  const employees = await Employee.find(filter).sort({ firstName: 1 }).skip(skip).limit(parseInt(limit, 10));

  return sendSuccess(res, {
    data: employees,
    meta: { total, page: parseInt(page, 10), totalPages: Math.ceil(total / parseInt(limit, 10)) },
    message: 'Employees retrieved successfully.',
  });
});

const createEmployee = asyncHandler(async (req, res) => {
  // Auto-generate a QR code value equal to the employee's unique ID
  if (!req.body.qrCodeToken && req.body.employeeId) {
    req.body.qrCodeToken = req.body.employeeId;
  }
  const employee = await Employee.create(req.body);
  return sendSuccess(res, { statusCode: 201, data: employee, message: 'Employee created successfully.' });
});

const getEmployeeById = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee || !employee.isActive) {
    return sendError(res, { statusCode: 404, message: 'Employee not found.' });
  }
  return sendSuccess(res, { data: employee, message: 'Employee retrieved successfully.' });
});

const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, {
    new: true, runValidators: true,
  });
  if (!employee) {
    return sendError(res, { statusCode: 404, message: 'Employee not found.' });
  }
  return sendSuccess(res, { data: employee, message: 'Employee updated successfully.' });
});

const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findByIdAndUpdate(
    req.params.id,
    { isActive: false, dateLeft: new Date() },
    { new: true }
  );
  if (!employee) {
    return sendError(res, { statusCode: 404, message: 'Employee not found.' });
  }
  return sendSuccess(res, { message: 'Employee record deactivated successfully.' });
});

// ═══════════════════════════════════════════════════════════════════════════
//  ATTENDANCE — QR CLOCK-IN / CLOCK-OUT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @desc  Process a QR scan to CLOCK IN
 * @route POST /api/employees/attendance/clock-in
 * @body  { qrCodeToken: string, terminal?: string }
 */
const clockIn = asyncHandler(async (req, res) => {
  const { qrCodeToken, terminal } = req.body;

  if (!qrCodeToken) {
    return sendError(res, { statusCode: 400, message: 'qrCodeToken is required.' });
  }

  const employee = await Employee.findOne({ qrCodeToken, isActive: true });
  if (!employee) {
    return sendError(res, { statusCode: 404, message: 'No active employee found for this QR code.' });
  }

  const now       = new Date();
  const startOfDay= new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const existingRecord = await Attendance.findOne({
    employeeId: employee._id,
    date:       startOfDay,
  });

  if (existingRecord) {
    return sendError(res, {
      statusCode: 409,
      message: `${employee.fullName} is already clocked in today.`,
    });
  }

  const record = await Attendance.create({
    employeeId: employee._id,
    date:       startOfDay,
    clockIn:    now,
    terminal:   terminal || 'Terminal-01',
    status:     ATTENDANCE_STATUS.PRESENT,
  });

  return sendSuccess(res, {
    statusCode: 201,
    data: { action: 'clock_in', record, employee: { id: employee._id, name: employee.fullName } },
    message: `✅ Clock-in recorded for ${employee.fullName} at ${now.toLocaleTimeString()}.`,
  });
});

/**
 * @desc  Process a QR scan to CLOCK OUT
 * @route POST /api/employees/attendance/clock-out
 * @body  { qrCodeToken: string }
 */
const clockOut = asyncHandler(async (req, res) => {
  const { qrCodeToken } = req.body;

  if (!qrCodeToken) {
    return sendError(res, { statusCode: 400, message: 'qrCodeToken is required.' });
  }

  const employee = await Employee.findOne({ qrCodeToken, isActive: true });
  if (!employee) {
    return sendError(res, { statusCode: 404, message: 'No active employee found for this QR code.' });
  }

  const now       = new Date();
  const startOfDay= new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const existingRecord = await Attendance.findOne({
    employeeId: employee._id,
    date:       startOfDay,
  });

  if (!existingRecord) {
    return sendError(res, {
      statusCode: 404,
      message: `${employee.fullName} has not clocked in today.`,
    });
  }

  if (existingRecord.clockOut) {
    return sendError(res, {
      statusCode: 409,
      message: `${employee.fullName} has already clocked out today.`,
    });
  }

  existingRecord.clockOut = now;
  existingRecord.computeHours();
  await existingRecord.save();

  return sendSuccess(res, {
    data: {
      action:   'clock_out',
      record:   existingRecord,
      employee: { id: employee._id, name: employee.fullName },
    },
    message: `🕐 Clock-out recorded for ${employee.fullName}. Hours worked: ${existingRecord.totalHoursWorked}h.`,
  });
});

/**
 * @desc  List attendance records (filterable)
 * @route GET /api/employees/attendance
 */
const getAttendance = asyncHandler(async (req, res) => {
  const { employeeId, date, startDate, endDate, page = 1, limit = 30 } = req.query;
  const filter = {};
  if (employeeId) filter.employeeId = employeeId;
  if (date)       filter.date       = new Date(date);
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate)   filter.date.$lte = new Date(endDate);
  }

  const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const total = await Attendance.countDocuments(filter);
  const records = await Attendance.find(filter)
    .populate('employeeId', 'firstName lastName employeeId')
    .sort({ date: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10));

  return sendSuccess(res, {
    data: records,
    meta: { total, page: parseInt(page, 10), totalPages: Math.ceil(total / parseInt(limit, 10)) },
    message: 'Attendance records retrieved successfully.',
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  PAYROLL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @desc  Generate payroll for a specific employee and date range
 * @route POST /api/employees/payroll/generate
 * @body  { employeeId, periodStart, periodEnd, period, allowances[], deductions[] }
 */
const generatePayroll = asyncHandler(async (req, res) => {
  const { employeeId, periodStart, periodEnd, period, allowances = [], deductions = [] } = req.body;

  const employee = await Employee.findById(employeeId);
  if (!employee) {
    return sendError(res, { statusCode: 404, message: 'Employee not found.' });
  }

  // ── Aggregate attendance for the period ───────────────────────────────────
  const attendanceRecords = await Attendance.find({
    employeeId,
    date: { $gte: new Date(periodStart), $lte: new Date(periodEnd) },
    clockOut: { $ne: null }, // only count completed days
  });

  const totalDaysWorked  = attendanceRecords.length;
  const totalHoursWorked = attendanceRecords.reduce((sum, r) => sum + r.totalHoursWorked, 0);
  const overtimeHours    = attendanceRecords.reduce((sum, r) => sum + r.overtimeHours, 0);

  // ── Calculate pay ─────────────────────────────────────────────────────────
  const hourlyRate    = employee.hourlyRate || 0;
  const regularHours  = totalHoursWorked - overtimeHours;
  const regularPay    = parseFloat((regularHours * hourlyRate).toFixed(2));
  const overtimeRate  = hourlyRate * 1.5; // 1.5x hourly rate for overtime
  const overtimePay   = parseFloat((overtimeHours * overtimeRate).toFixed(2));
  const totalAllowances = allowances.reduce((s, a) => s + a.amount, 0);
  const grossPay      = regularPay + overtimePay + totalAllowances;
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);
  const netPay        = parseFloat((grossPay - totalDeductions).toFixed(2));

  const payroll = await Payroll.create({
    employeeId,
    period,
    periodStart: new Date(periodStart),
    periodEnd:   new Date(periodEnd),
    totalDaysWorked,
    totalHoursWorked: parseFloat(totalHoursWorked.toFixed(2)),
    overtimeHours:    parseFloat(overtimeHours.toFixed(2)),
    baseSalary:       regularPay,
    overtimePay,
    allowances,
    grossPay:     parseFloat(grossPay.toFixed(2)),
    deductions,
    totalDeductions,
    netPay,
  });

  return sendSuccess(res, { statusCode: 201, data: payroll, message: 'Payroll generated successfully.' });
});

const getPayroll = asyncHandler(async (req, res) => {
  const { employeeId, isPaid, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (employeeId)          filter.employeeId = employeeId;
  if (isPaid !== undefined) filter.isPaid     = isPaid === 'true';

  const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const total = await Payroll.countDocuments(filter);
  const records = await Payroll.find(filter)
    .populate('employeeId', 'firstName lastName employeeId')
    .sort({ periodStart: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10));

  return sendSuccess(res, {
    data: records,
    meta: { total, page: parseInt(page, 10), totalPages: Math.ceil(total / parseInt(limit, 10)) },
    message: 'Payroll records retrieved successfully.',
  });
});

/**
 * @desc  Mark a payroll record as paid
 * @route PATCH /api/employees/payroll/:id/pay
 */
const markPayrollAsPaid = asyncHandler(async (req, res) => {
  const payroll = await Payroll.findById(req.params.id);
  if (!payroll) {
    return sendError(res, { statusCode: 404, message: 'Payroll record not found.' });
  }
  if (payroll.isPaid) {
    return sendError(res, { statusCode: 409, message: 'Payroll has already been marked as paid.' });
  }
  payroll.isPaid     = true;
  payroll.paidAt     = new Date();
  payroll.paidBy     = req.user._id;
  payroll.paymentRef = req.body.paymentRef || '';
  await payroll.save();

  return sendSuccess(res, { data: payroll, message: 'Payroll marked as paid successfully.' });
});

module.exports = {
  getEmployees, createEmployee, getEmployeeById, updateEmployee, deleteEmployee,
  clockIn, clockOut, getAttendance,
  generatePayroll, getPayroll, markPayrollAsPaid,
};
