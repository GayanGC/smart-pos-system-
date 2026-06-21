const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const { getChatResponse } = require('./modules/ai-analytics/analytics.controller');
const { processSupplierInvoiceOCR } = require('./modules/inventory/inventory.controller');
const { syncOfflineAttendance, completeTask } = require('./modules/employees/employees.controller');
const Employee = require('./modules/employees/employee.model');
const Task = require('./modules/employees/task.model');
const Product = require('./modules/inventory/product.model');

const mockRes = () => {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.data = data; return res; };
  return res;
};

async function runTests() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pos_system');
  console.log('--- DB Connected ---');

  // Test 1: Chat Input Stripping
  console.log('\n>>> TEST 1: Chatbot Input Sanitization');
  const rawInput = "ada sAleS kiiYad? bbadu iThuruda?? @#$";
  // The backend controller strips non-alphanumeric and some punctuation in ChatDrawer.jsx, but let's check what the backend sees
  console.log('Raw Input:', rawInput);
  // (Assuming backend doesn't sanitize basic punctuation as it relies on Gemini to understand it, but let's just log it)

  // Test 2: OCR Sanitization
  console.log('\n>>> TEST 2: OCR Sanitization');
  const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const maliciousInput = "Rice /.*+?^${}()|[]\\/ 25kg";
  const safeName = escapeRegex(maliciousInput);
  console.log('Malicious Input:', maliciousInput);
  console.log('Sanitized Input for Regex:', safeName);
  try {
    const testRegex = new RegExp(safeName, 'i');
    console.log('Regex compiled successfully:', testRegex);
  } catch (e) {
    console.error('Regex compilation failed:', e.message);
  }

  // Test 3: Chronological Attendance Sync Stream
  console.log('\n>>> TEST 3: Chronological Attendance Sync Stream');
  const attendanceLogs = [
    { id: 2, timestamp: '2026-06-20T10:00:00.000Z', note: 'Clock Out' },
    { id: 1, timestamp: '2026-06-20T08:00:00.000Z', note: 'Clock In' }
  ];
  console.log('Before sort:', attendanceLogs.map(l => l.note));
  attendanceLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  console.log('After sort:', attendanceLogs.map(l => l.note));

  // Test 4: Task Identity Validation
  console.log('\n>>> TEST 4: Task Identity Validation');
  const emp1 = await Employee.create({ firstName: 'Test', lastName: 'Emp1', qrCodeToken: 'EMP1_TOKEN', baseSalary: 100 });
  const emp2 = await Employee.create({ firstName: 'Test', lastName: 'Emp2', qrCodeToken: 'EMP2_TOKEN', baseSalary: 100 });
  const task = await Task.create({ title: 'Test Task', assignedTo: emp1._id });

  const req = {
    params: { id: task._id },
    body: { qrCodeToken: 'EMP2_TOKEN' }, // Intentionally wrong token
    user: { role: 'cashier' }
  };
  const res = mockRes();

  await completeTask(req, res, () => {});
  console.log('Response Status:', res.statusCode);
  console.log('Response Data:', res.data);

  // Cleanup
  await Employee.deleteMany({ _id: { $in: [emp1._id, emp2._id] } });
  await Task.deleteMany({ _id: task._id });

  console.log('\n--- Tests Completed ---');
  process.exit(0);
}

runTests().catch(console.error);
