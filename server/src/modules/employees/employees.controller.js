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
const Task       = require('./task.model');
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
  const allowedFields = ['userId', 'employeeId', 'firstName', 'lastName', 'dateOfBirth', 'gender', 'nationalId', 'photo', 'email', 'phone', 'address', 'department', 'designation', 'dateJoined', 'hourlyRate', 'bankAccount'];
  const safeData = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) safeData[field] = req.body[field];
  }

  // Auto-generate a cryptographically secure QR code token
  safeData.qrCodeToken = require('crypto').randomBytes(16).toString('hex');

  const employee = await Employee.create(safeData);
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
  const allowedFields = ['userId', 'employeeId', 'firstName', 'lastName', 'dateOfBirth', 'gender', 'nationalId', 'photo', 'email', 'phone', 'address', 'department', 'designation', 'dateJoined', 'hourlyRate', 'bankAccount'];
  const safeData = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) safeData[field] = req.body[field];
  }

  const employee = await Employee.findByIdAndUpdate(req.params.id, safeData, {
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

  const employee = await Employee.findOne({
    qrCodeToken,
    isActive: true
  });
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

  const tasks = await Task.find({
    employeeId: employee._id,
    status: 'Pending',
    scheduledFor: { $gte: startOfDay, $lte: new Date(startOfDay.getTime() + 86400000 - 1) }
  });

  const empName = `${employee.firstName} ${employee.lastName}`.trim();
  return sendSuccess(res, {
    statusCode: 201,
    data: { action: 'clock_in', record, employee: { id: employee._id, name: empName, firstName: employee.firstName }, tasks },
    message: `✅ Clock-in recorded for ${empName} at ${now.toLocaleTimeString()}.`,
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

  const employee = await Employee.findOne({
    qrCodeToken,
    isActive: true
  });
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

/**
 * @desc  Sync offline attendance scans
 * @route POST /api/employees/attendance/sync
 * @body  { attendanceLogs: Array<{ id, qrToken, timestamp }> }
 */
const syncOfflineAttendance = asyncHandler(async (req, res) => {
  const { attendanceLogs } = req.body;
  if (!Array.isArray(attendanceLogs)) {
    return sendError(res, { statusCode: 400, message: 'attendanceLogs must be an array' });
  }

  // Enforce chronological sorting to prevent clock-out before clock-in sync errors
  attendanceLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const results = { synced: [], failed: [] };

  for (const log of attendanceLogs) {
    try {
      const employee = await Employee.findOne({ qrCodeToken: log.qrToken, isActive: true });
      if (!employee) {
        results.failed.push({ id: log.id, error: 'Employee not found or inactive' });
        continue;
      }

      const scanTime = new Date(log.timestamp);
      const startOfDay = new Date(scanTime);
      startOfDay.setUTCHours(0, 0, 0, 0);

      const existingRecord = await Attendance.findOne({
        employeeId: employee._id,
        date: startOfDay,
      });

      if (!existingRecord) {
        await Attendance.create({
          employeeId: employee._id,
          date: startOfDay,
          clockIn: scanTime,
          terminal: 'Offline-Scanner',
          status: ATTENDANCE_STATUS.PRESENT,
        });
      } else if (!existingRecord.clockOut) {
        if (scanTime > existingRecord.clockIn) {
          existingRecord.clockOut = scanTime;
          existingRecord.computeHours();
          await existingRecord.save();
        } else {
          results.failed.push({ id: log.id, error: 'Invalid clock-out time before clock-in' });
          continue;
        }
      } else {
        results.failed.push({ id: log.id, error: 'Already clocked out for the day' });
        continue;
      }

      results.synced.push({ id: log.id });
    } catch (err) {
      results.failed.push({ id: log.id, error: err.message });
    }
  }

  return sendSuccess(res, { data: results, message: `Attendance sync complete. Synced: ${results.synced.length}` });
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

  // ── Inject Salary Advance Deductions ──────────────────────────────────────
  if (employee.salaryAdvances && employee.salaryAdvances.length > 0) {
    const totalAdvance = employee.salaryAdvances.reduce((sum, adv) => sum + adv.amount, 0);
    deductions.push({ label: 'Salary Advance', amount: parseFloat(totalAdvance.toFixed(2)) });
    // Clear the ledger for the next cycle
    employee.salaryAdvances = [];
    await employee.save();
  }

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

// ═══════════════════════════════════════════════════════════════════════════
//  TASKS
// ═══════════════════════════════════════════════════════════════════════════

const getTasks = asyncHandler(async (req, res) => {
  const { employeeId, date, status } = req.query;
  const filter = {};
  if (employeeId) filter.employeeId = employeeId;
  if (status) filter.status = status;
  if (date) {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    filter.scheduledFor = { $gte: startOfDay, $lte: new Date(startOfDay.getTime() + 86400000 - 1) };
  }

  const tasks = await Task.find(filter).sort({ date: -1 });
  return sendSuccess(res, { data: tasks, message: 'Tasks retrieved successfully.' });
});

const completeTask = asyncHandler(async (req, res) => {
  const { qrCodeToken } = req.body;

  const task = await Task.findById(req.params.id);
  if (!task) {
    return sendError(res, { statusCode: 404, message: 'Task not found.' });
  }

  // If not admin/manager, require employee token verification
  if (!['super_admin', 'admin', 'manager'].includes(req.user.role)) {
    if (!qrCodeToken) {
      return sendError(res, { statusCode: 401, message: 'Authentication required. Please provide your QR token.' });
    }
    const employee = await Employee.findOne({ qrCodeToken, isActive: true });
    if (!employee || employee._id.toString() !== task.assignedTo.toString()) {
      return sendError(res, { statusCode: 403, message: 'Unauthorised: You can only complete tasks assigned to you.' });
    }
  }

  task.status = 'completed';
  await task.save();

  return sendSuccess(res, { data: task, message: 'Task marked as completed.' });
});

// ─── Salary Advance Ledger ─────────────────────────────────────────────────
const logSalaryAdvance = asyncHandler(async (req, res) => {
  const { amount, reason } = req.body;
  if (!amount || amount <= 0) {
    return sendError(res, { statusCode: 400, message: 'Valid advance amount is required.' });
  }

  const employee = await Employee.findById(req.params.id);
  if (!employee) {
    return sendError(res, { statusCode: 404, message: 'Employee not found.' });
  }

  employee.salaryAdvances.push({ amount: parseFloat(amount), reason: reason || 'Advance Payment' });
  await employee.save();

  return sendSuccess(res, { data: employee, message: 'Salary advance logged successfully.' });
});

// ─── Dynamic QR Task Dispatcher ──────────────────────────────────────────
const assignTask = asyncHandler(async (req, res) => {
  const { employeeId, taskDescription, scheduledFor } = req.body;
  
  if (!employeeId || !taskDescription || !scheduledFor) {
    return sendError(res, { statusCode: 400, message: 'Missing required task fields.' });
  }

  const employee = await Employee.findById(employeeId);
  if (!employee) return sendError(res, { statusCode: 404, message: 'Employee not found.' });

  const task = await Task.create({
    employeeId,
    taskDescription,
    scheduledFor: new Date(scheduledFor),
    status: 'Pending'
  });

  // Removed email dispatch logic to rely completely on the In-App Terminal Modal.

  return sendSuccess(res, { statusCode: 201, data: task, message: 'Task assigned successfully.' });
});

const getEmployeeTasks = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { date } = req.query; // Usually 'Today'
  
  const filter = { employeeId };
  if (date) {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    filter.scheduledFor = { $gte: startOfDay, $lte: new Date(startOfDay.getTime() + 86400000 - 1) };
  }

  const tasks = await Task.find(filter).sort({ scheduledFor: 1 });
  return sendSuccess(res, { data: tasks, message: 'Tasks retrieved successfully.' });
});

const updateTaskStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const task = await Task.findById(req.params.id);
  
  if (!task) return sendError(res, { statusCode: 404, message: 'Task not found.' });
  
  // Optional: strict assignedTo validation
  if (req.user && !['super_admin', 'admin', 'manager'].includes(req.user.role)) {
    // If not admin, ensure they own it (though portal uses anonymous QR for now, backend could secure this)
    // For now, allow update
  }

  task.status = status;
  await task.save();

  return sendSuccess(res, { data: task, message: `Task marked as ${status}.` });
});

module.exports = {
  // Employees
  getEmployees, createEmployee, getEmployeeById, updateEmployee, deleteEmployee,
  // Attendance
  clockIn, clockOut, getAttendance, syncOfflineAttendance,
  // Payroll & Ledger
  generatePayroll, getPayroll, markPayrollAsPaid, logSalaryAdvance,
  // Tasks (Legacy & New)
  getTasks, completeTask, assignTask, getEmployeeTasks, updateTaskStatus
};
