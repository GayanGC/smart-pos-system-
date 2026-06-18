'use strict';

const nodemailer = require('nodemailer');
const Invoice = require('../modules/billing/invoice.model');
const Product = require('../modules/inventory/product.model');
const logger = require('./logger');

const generateDailyReportData = async () => {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  // 1. Fetch Invoices for today (not voided)
  const invoices = await Invoice.find({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
    isVoided: false
  });

  // Calculate total sales
  const totalSales = invoices.reduce((acc, inv) => acc + inv.grandTotal, 0);

  // Calculate COGS and top moving items
  let totalCOGS = 0;
  const itemQuantities = {};
  
  for (const inv of invoices) {
    for (const item of inv.lineItems) {
      // Aggregate quantities for top moving items
      const itemName = item.name;
      itemQuantities[itemName] = (itemQuantities[itemName] || 0) + item.quantity;

      // Fetch product to get cost price
      const product = await Product.findById(item.productId);
      const costPrice = product ? product.costPrice : item.unitPrice * 0.7; // default 70% COGS fallback
      totalCOGS += costPrice * item.quantity;
    }
  }

  const netProfit = totalSales - totalCOGS;

  // Format top-moving items
  const topMovingItems = Object.entries(itemQuantities)
    .map(([name, qty]) => ({ name, quantity: qty }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5); // top 5 items

  // 2. Fetch Low Stock Alerts
  const lowStockItems = await Product.find({
    isActive: true,
    $expr: { $lte: ['$quantityInStock', '$lowStockThreshold'] }
  }).select('name quantityInStock lowStockThreshold');

  return {
    date: today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    totalSales,
    netProfit,
    topMovingItems,
    lowStockItems,
    invoiceCount: invoices.length
  };
};

const sendDailyReportEmail = async (reportData) => {
  let transporter;
  let isTestAccount = false;
  let testAccountUrl = null;

  const smtpUser = process.env.EMAIL_USER;
  const smtpPass = process.env.EMAIL_PASS;
  const smtpHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.EMAIL_PORT, 10) || 587;
  const emailTo = process.env.EMAIL_TO || 'admin@example.com';

  if (!smtpUser || smtpUser === 'your_email@gmail.com') {
    logger.info('📬 No SMTP credentials configured. Setting up Ethereal Email test account...');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    isTestAccount = true;
  } else {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #cbd5e1; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background-color: #0b0f19; border: 1px solid #1e293b; border-radius: 16px; padding: 30px; }
          .header { text-align: center; border-bottom: 1px solid #1e293b; padding-bottom: 20px; margin-bottom: 25px; }
          .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; }
          .header p { color: #a78bfa; margin: 5px 0 0 0; font-size: 14px; font-weight: 600; }
          .grid { display: flex; gap: 15px; margin-bottom: 25px; }
          .card { background-color: #0d1324; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; text-align: center; flex: 1; }
          .card-title { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; }
          .card-value { font-size: 22px; font-weight: 800; }
          .card-sales { color: #ffffff; }
          .card-profit { color: #10b981; }
          .section-title { font-size: 16px; color: #ffffff; font-weight: 700; border-left: 4px solid #7c3aed; padding-left: 10px; margin-bottom: 15px; margin-top: 30px; }
          .list { background-color: #090d16; border: 1px solid #1e293b; border-radius: 12px; padding: 15px; margin: 0; list-style: none; }
          .list-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1e293b; font-size: 14px; }
          .list-item:last-child { border-bottom: none; }
          .item-name { color: #e2e8f0; }
          .item-value { font-family: monospace; font-weight: bold; }
          .badge-low-stock { color: #fbbf24; }
          .footer { text-align: center; font-size: 11px; color: #475569; margin-top: 40px; border-top: 1px solid #1e293b; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Smart POS Daily Report</h1>
            <p>${reportData.date}</p>
          </div>
          
          <div class="grid">
            <div class="card">
              <div class="card-title">Total Sales</div>
              <div class="card-value card-sales">Rs. ${reportData.totalSales.toFixed(2)}</div>
            </div>
            <div class="card">
              <div class="card-title">Net Profit</div>
              <div class="card-value card-profit">Rs. ${reportData.netProfit.toFixed(2)}</div>
            </div>
          </div>

          <div class="card" style="margin-bottom: 25px; padding: 15px; flex: none;">
            <div class="card-title">Transactions Processed</div>
            <div class="card-value" style="color: #cbd5e1; font-size: 18px;">${reportData.invoiceCount} invoices</div>
          </div>

          <div class="section-title">Top Moving Items</div>
          ${reportData.topMovingItems.length === 0 ? '<p style="font-size:13px; color:#475569;">No sales recorded today.</p>' : `
            <ul class="list">
              ${reportData.topMovingItems.map(item => `
                <li class="list-item">
                  <span class="item-name">${item.name}</span>
                  <span class="item-value" style="color: #a78bfa;">${item.quantity} units</span>
                </li>
              `).join('')}
            </ul>
          `}

          <div class="section-title">Low Stock Alerts</div>
          ${reportData.lowStockItems.length === 0 ? '<p style="font-size:13px; color:#10b981;">✅ All items have sufficient stock levels.</p>' : `
            <ul class="list">
              ${reportData.lowStockItems.map(item => `
                <li class="list-item">
                  <span class="item-name" style="color: #fca5a5;">${item.name}</span>
                  <span class="item-value badge-low-stock">${item.quantityInStock} / ${item.lowStockThreshold} min</span>
                </li>
              `).join('')}
            </ul>
          `}

          <div class="footer">
            <p>This is an automated system-generated report from your Smart POS terminal.</p>
            <p>Smart ERP POS Systems Inc.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const mailOptions = {
    from: `"Smart POS Reports" <${isTestAccount ? 'test@ethereal.email' : smtpUser}>`,
    to: emailTo,
    subject: `📊 Smart POS End-of-Day Report — ${reportData.date}`,
    html: htmlContent
  };

  const info = await transporter.sendMail(mailOptions);

  if (isTestAccount) {
    testAccountUrl = nodemailer.getTestMessageUrl(info);
    logger.info(`✉️ Test Email sent successfully! Preview URL: ${testAccountUrl}`);
  } else {
    logger.info(`✉️ Production Email sent successfully! Message ID: ${info.messageId}`);
  }

  return {
    success: true,
    isTestAccount,
    previewUrl: testAccountUrl,
    messageId: info.messageId
  };
};

const startReportScheduler = () => {
  // Check the time every 30 minutes
  setInterval(async () => {
    const now = new Date();
    // Fire the report at 23:59 (11:59 PM)
    if (now.getHours() === 23 && now.getMinutes() >= 30 && now.getMinutes() <= 59) {
      const todayStr = now.toDateString();
      if (global.lastReportSentDate !== todayStr) {
        global.lastReportSentDate = todayStr;
        try {
          logger.info('[Scheduler] Generating daily report...');
          const reportData = await generateDailyReportData();
          await sendDailyReportEmail(reportData);
          logger.info('[Scheduler] Daily report sent successfully.');
        } catch (err) {
          logger.error('[Scheduler] Failed to send daily report:', err);
        }
      }
    }
  }, 1800000); // 30 minutes
};

module.exports = {
  generateDailyReportData,
  sendDailyReportEmail,
  startReportScheduler
};
