require('dotenv').config({ path: __dirname + '/../../.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = require('./db');

const User = require('../modules/auth/auth.model');
const Employee = require('../modules/employees/employee.model');
const Product = require('../modules/inventory/product.model');
const Supplier = require('../modules/inventory/supplier.model');
const Invoice = require('../modules/billing/invoice.model');
const Attendance = require('../modules/employees/attendance.model');

const { USER_ROLES, PAYMENT_METHODS, INVOICE_STATUS, ATTENDANCE_STATUS } = require('./constants');

const seedDB = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB for seeding');

    console.log('🗑️ Dropping existing collections...');
    await Promise.all([
      User.deleteMany({}),
      Employee.deleteMany({}),
      Product.deleteMany({}),
      Supplier.deleteMany({}),
      Invoice.deleteMany({}),
      Attendance.deleteMany({}),
    ]);
    console.log('✅ Collections dropped');

    // ─── 1. Users & Employees ──────────────────────────────────────────────
    console.log('🌱 Seeding Users and Employees...');

    const adminUser = await User.create({
      name: 'Admin Owner',
      email: 'admin@example.com',
      password: 'password123',
      role: USER_ROLES.SUPER_ADMIN,
    });

    const cashier1 = await User.create({
      name: 'Alice Smith',
      email: 'alice@example.com',
      password: 'password123',
      role: USER_ROLES.CASHIER,
    });

    const cashier2 = await User.create({
      name: 'Bob Jones',
      email: 'bob@example.com',
      password: 'password123',
      role: USER_ROLES.CASHIER,
    });

    const emp1 = await Employee.create({
      userId: cashier1._id,
      employeeId: 'EMP001',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      phone: '555-0101',
      dateOfBirth: new Date('1990-05-14'),
      gender: 'female',
    });

    const emp2 = await Employee.create({
      userId: cashier2._id,
      employeeId: 'EMP002',
      firstName: 'Bob',
      lastName: 'Jones',
      email: 'bob@example.com',
      phone: '555-0102',
      dateOfBirth: new Date('1992-08-22'),
      gender: 'male',
    });

    // ─── 2. Suppliers & Products ───────────────────────────────────────────
    console.log('🌱 Seeding Suppliers and Products...');
    const supplier1 = await Supplier.create({
      name: 'Global Wholesale Co.',
      contactPerson: 'John Doe',
      phone: '555-1000',
      email: 'john@globalwholesale.com',
    });

    const supplier2 = await Supplier.create({
      name: 'Fresh Farms Produce',
      contactPerson: 'Jane Farm',
      phone: '555-2000',
      email: 'orders@freshfarms.com',
    });

    const today = new Date();
    const expirySoon = new Date();
    expirySoon.setDate(today.getDate() + 5);

    const expiryLater = new Date();
    expiryLater.setDate(today.getDate() + 180);

    const productsData = [
      { name: 'Organic Bananas (Bunch)', sku: 'BAN-01', barcode: '1000000001', costPrice: 150.0, sellingPrice: 300.0, qty: 50, category: 'Produce', supp: supplier2 },
      { name: 'Whole Milk 1 Gallon', sku: 'MLK-01', barcode: '1000000002', costPrice: 200.0, sellingPrice: 350.0, qty: 4, lowThreshold: 5, category: 'Dairy', supp: supplier2, expiry: expirySoon }, // Low stock & expiring soon
      { name: 'Artisan Sourdough Bread', sku: 'BRD-01', barcode: '1000000003', costPrice: 250.0, sellingPrice: 500.0, qty: 2, lowThreshold: 10, category: 'Bakery', supp: supplier2, expiry: expirySoon }, // Low stock & expiring soon
      { name: 'Premium Coffee Beans 1lb', sku: 'COF-01', barcode: '1000000004', costPrice: 800.0, sellingPrice: 1500.0, qty: 30, category: 'Pantry', supp: supplier1 },
      { name: 'Olive Oil Extra Virgin 500ml', sku: 'OIL-01', barcode: '1000000005', costPrice: 450.0, sellingPrice: 1000.0, qty: 40, category: 'Pantry', supp: supplier1 },
      { name: 'Sea Salt 1lb', sku: 'SLT-01', barcode: '1000000006', costPrice: 100.0, sellingPrice: 250.0, qty: 100, category: 'Pantry', supp: supplier1 },
      { name: 'Dark Chocolate Bar 70%', sku: 'CHO-01', barcode: '1000000007', costPrice: 150.0, sellingPrice: 300.0, qty: 60, category: 'Snacks', supp: supplier1 },
      { name: 'Mixed Nuts 16oz', sku: 'NUT-01', barcode: '1000000008', costPrice: 500.0, sellingPrice: 900.0, qty: 25, category: 'Snacks', supp: supplier1 },
      { name: 'Sparkling Water 12-Pack', sku: 'WAT-01', barcode: '1000000009', costPrice: 300.0, sellingPrice: 600.0, qty: 50, category: 'Beverages', supp: supplier1 },
      { name: 'Green Tea Bags 50ct', sku: 'TEA-01', barcode: '1000000010', costPrice: 250.0, sellingPrice: 450.0, qty: 40, category: 'Beverages', supp: supplier1 },
      { name: 'Paper Towels 6-Roll', sku: 'PTW-01', barcode: '1000000011', costPrice: 400.0, sellingPrice: 800.0, qty: 15, category: 'Household', supp: supplier1 },
      { name: 'Dish Soap 24oz', sku: 'DSP-01', barcode: '1000000012', costPrice: 180.0, sellingPrice: 350.0, qty: 35, category: 'Household', supp: supplier1 },
      { name: 'Laundry Detergent 64oz', sku: 'DET-01', barcode: '1000000013', costPrice: 600.0, sellingPrice: 1200.0, qty: 20, category: 'Household', supp: supplier1 },
      { name: 'Avocados (Bag of 4)', sku: 'AVO-01', barcode: '1000000014', costPrice: 300.0, sellingPrice: 550.0, qty: 12, category: 'Produce', supp: supplier2 },
      { name: 'Free-Range Eggs 1 Dozen', sku: 'EGG-01', barcode: '1000000015', costPrice: 250.0, sellingPrice: 500.0, qty: 30, category: 'Dairy', supp: supplier2, expiry: expiryLater },
      { name: 'Cigarette 105', sku: 'CIG-105', barcode: '2000000105', costPrice: 105.0 * 0.7, sellingPrice: 105.0, qty: 500, category: 'CIGARETTES', supp: supplier1 },
      { name: 'Cigarette 160', sku: 'CIG-160', barcode: '2000000160', costPrice: 160.0 * 0.7, sellingPrice: 160.0, qty: 500, category: 'CIGARETTES', supp: supplier1 },
      { name: 'Dunhill 170', sku: 'DUN-170', barcode: '2000000170', costPrice: 170.0 * 0.7, sellingPrice: 170.0, qty: 500, category: 'CIGARETTES', supp: supplier1 },
    ];

    const products = [];
    for (const p of productsData) {
      const product = await Product.create({
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        quantityInStock: p.qty,
        lowStockThreshold: p.lowThreshold || 10,
        category: p.category,
        expiryDate: p.expiry,
        supplier: {
          supplierId: p.supp._id,
          name: p.supp.name,
          phone: p.supp.phone,
          email: p.supp.email,
        },
      });
      products.push(product);
    }

    // ─── 3. Invoices / Sales ───────────────────────────────────────────────
    console.log('🌱 Seeding Invoices...');
    const invoicesToCreate = 25;
    const paymentMethods = [PAYMENT_METHODS.CASH, PAYMENT_METHODS.CARD, PAYMENT_METHODS.MOBILE_PAY];
    
    for (let i = 1; i <= invoicesToCreate; i++) {
      // Random past date within last 7 days
      const daysAgo = Math.floor(Math.random() * 7);
      const invoiceDate = new Date();
      invoiceDate.setDate(invoiceDate.getDate() - daysAgo);
      invoiceDate.setHours(Math.floor(Math.random() * 10) + 8); // between 8 AM and 6 PM

      // Pick 1 to 4 random products
      const numItems = Math.floor(Math.random() * 4) + 1;
      const lineItems = [];
      let subTotal = 0;
      let totalTax = 0;

      for (let j = 0; j < numItems; j++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const qty = Math.floor(Math.random() * 3) + 1;
        const lineTotal = product.sellingPrice * qty;
        
        // Avoid duplicate products in the same invoice
        if (!lineItems.find(item => item.productId.toString() === product._id.toString())) {
          lineItems.push({
            productId: product._id,
            sku: product.sku,
            name: product.name,
            barcode: product.barcode,
            quantity: qty,
            unitPrice: product.sellingPrice,
            taxRate: 0,
            discount: 0,
            lineTotal: lineTotal
          });
          subTotal += lineTotal;
        }
      }

      const grandTotal = subTotal + totalTax;
      const isVoided = i % 12 === 0; // approximately 2 voided invoices
      const pMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
      
      await Invoice.create({
        invoiceNumber: `INV-${1000 + i}`,
        cashierId: (i % 2 === 0) ? cashier1._id : cashier2._id,
        lineItems,
        subTotal,
        totalDiscount: 0,
        totalTax,
        grandTotal,
        amountPaid: grandTotal,
        changeDue: 0,
        paymentMethod: pMethod,
        status: isVoided ? INVOICE_STATUS.VOIDED : INVOICE_STATUS.PAID,
        isVoided: isVoided,
        voidReason: isVoided ? 'Customer changed mind' : undefined,
        voidedBy: isVoided ? adminUser._id : undefined,
        voidedAt: isVoided ? new Date() : undefined,
        createdAt: invoiceDate,
      });
    }

    // ─── 4. Attendance ─────────────────────────────────────────────────────
    console.log('🌱 Seeding Attendance...');
    // Seed attendance for the last 3 days for both cashiers
    for (let daysAgo = 3; daysAgo >= 0; daysAgo--) {
      const attDate = new Date();
      attDate.setDate(attDate.getDate() - daysAgo);
      attDate.setHours(0, 0, 0, 0); // start of day

      // Cashier 1 (EMP001)
      const clockIn1 = new Date(attDate);
      clockIn1.setHours(8, 55, 0); // 8:55 AM
      const clockOut1 = new Date(attDate);
      clockOut1.setHours(17, 5, 0); // 5:05 PM

      await Attendance.create({
        employeeId: emp1._id,
        date: attDate,
        clockIn: clockIn1,
        clockOut: daysAgo === 0 ? null : clockOut1, // Today they are still clocked in
        totalHoursWorked: daysAgo === 0 ? 0 : 8.16,
        status: ATTENDANCE_STATUS.PRESENT,
      });

      // Cashier 2 (EMP002) - works afternoon shift
      const clockIn2 = new Date(attDate);
      clockIn2.setHours(12, 0, 0); // 12:00 PM
      const clockOut2 = new Date(attDate);
      clockOut2.setHours(20, 0, 0); // 8:00 PM

      await Attendance.create({
        employeeId: emp2._id,
        date: attDate,
        clockIn: clockIn2,
        clockOut: daysAgo === 0 ? null : clockOut2, // Today they are still clocked in
        totalHoursWorked: daysAgo === 0 ? 0 : 8.0,
        status: ATTENDANCE_STATUS.PRESENT,
      });
    }

    console.log('✅ Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
};

seedDB();
