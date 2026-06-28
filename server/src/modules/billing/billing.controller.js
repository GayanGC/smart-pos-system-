/**
 * @file billing.controller.js
 * @module billing
 * @description Handles all billing operations including:
 *  - createInvoice    POST /api/billing/invoices
 *  - getInvoices      GET  /api/billing/invoices
 *  - getInvoiceById   GET  /api/billing/invoices/:id
 *  - voidInvoice      PATCH /api/billing/invoices/:id/void
 *  - syncOffline      POST /api/billing/sync          ← offline batch sync
 *  - getDashboard     GET  /api/billing/dashboard     ← sales summary
 */

const Invoice   = require('./invoice.model');
const Payment   = require('./payment.model');
const Product   = require('../inventory/product.model');
const CashTransaction = require('./cashTransaction.model');
const asyncHandler      = require('../../utils/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/responseFormatter');
const generateInvoiceNumber      = require('../../utils/generateInvoiceNumber');
const { INVOICE_STATUS }         = require('../../config/constants');

// ─── Helper: deduct stock for each line item ──────────────────────────────
/**
 * @param {Array}  lineItems   Line items from the invoice
 * @param {string} [session]   Optional Mongoose session for transactions
 */
const deductStock = async (lineItems, session) => {
  const ops = [];

  for (const item of lineItems) {
    if (!item.productId) continue;
    const product = await Product.findById(item.productId).session(session);
    if (!product) continue;

    if (product.recipeIngredients && product.recipeIngredients.length > 0) {
      for (const ingredient of product.recipeIngredients) {
        const qtyToDeduct = ingredient.quantityRequired * item.quantity;
        ops.push({
          updateOne: {
            filter: { _id: ingredient.productId, quantityInStock: { $gte: qtyToDeduct } },
            update: { $inc: { quantityInStock: -qtyToDeduct } },
          },
        });
      }
    } else {
      ops.push({
        updateOne: {
          filter: { _id: item.productId, quantityInStock: { $gte: item.quantity } },
          update: { $inc: { quantityInStock: -item.quantity } },
        },
      });
    }
  }

  if (ops.length > 0) {
    const result = await Product.bulkWrite(ops, session ? { session } : {});
    if (result.modifiedCount !== ops.length) {
      throw new Error('Insufficient stock during deduction. Check inventory/ingredient levels.');
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
//  @desc    Create a new invoice (online path)
//  @route   POST /api/billing/invoices
//  @access  Private (cashier / admin)
// ═══════════════════════════════════════════════════════════════════════════
const createInvoice = asyncHandler(async (req, res) => {
  const { lineItems, paymentMethod, amountPaid, promoDiscount, customer, notes } = req.body;

  if (!lineItems || lineItems.length === 0) {
    return sendError(res, { statusCode: 400, message: 'At least one line item is required.' });
  }

  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ── Eradicated procedural read-and-save stock check (relying on atomic deductStock) ──

    // ── Generate invoice number ──────────────────────────────────────────────
    const crypto = require('crypto');
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm   = String(now.getMonth() + 1).padStart(2, '0');
    const dd   = String(now.getDate()).padStart(2, '0');
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const invoiceNumber = `INV-${yyyy}${mm}${dd}-${randomSuffix}`;

    // ── Compute totals from line items ────────────────────────────────────────
    let subTotal = 0;
    let totalItemDiscount = 0;
    let totalTax = 0;

    const processedItems = lineItems.map((item) => {
      const unitPrice = Number(item.unitPrice) || 0;
      const quantity = Number(item.quantity) || 0;
      const discount = Number(item.discount) || 0;
      const taxRate = Number(item.taxRate) || 0;

      const itemSubtotal = parseFloat((unitPrice * quantity).toFixed(2));
      const taxAmount = parseFloat(((itemSubtotal - discount) * (taxRate / 100)).toFixed(2));
      const lineTotal = parseFloat((itemSubtotal - discount + taxAmount).toFixed(2));

      subTotal += itemSubtotal;
      totalItemDiscount += discount;
      totalTax += taxAmount;

      return { 
        ...item, 
        unitPrice, 
        quantity, 
        discount, 
        taxRate, 
        taxAmount, 
        lineTotal 
      };
    });

    // Calculate cart-wide promo discount
    let cartPromoDiscount = 0;
    if (promoDiscount && Number(promoDiscount.value) > 0) {
      const val = Number(promoDiscount.value) || 0;
      if (promoDiscount.type === 'percentage') {
        cartPromoDiscount = parseFloat((subTotal * (val / 100)).toFixed(2));
      } else if (promoDiscount.type === 'flat') {
        cartPromoDiscount = val;
      }
    }

    subTotal = parseFloat(subTotal.toFixed(2));
    totalItemDiscount = parseFloat(totalItemDiscount.toFixed(2));
    totalTax = parseFloat(totalTax.toFixed(2));
    cartPromoDiscount = parseFloat(cartPromoDiscount.toFixed(2));

    const totalDiscount = parseFloat((totalItemDiscount + cartPromoDiscount).toFixed(2));
    const grandTotal = Math.max(0, parseFloat((subTotal + totalTax - totalDiscount).toFixed(2)));
    const finalTotal = grandTotal;
    const amountPaidNum = Number(amountPaid) || 0;
    const changeDue  = amountPaidNum > grandTotal ? parseFloat((amountPaidNum - grandTotal).toFixed(2)) : 0;

    // ── Create invoice document ───────────────────────────────────────────────
    const [invoice] = await Invoice.create([{
      customer, notes, promoDiscount,
      invoiceNumber,
      cashierId: req.user._id,
      lineItems: processedItems,
      subTotal,
      totalTax,
      totalDiscount,
      grandTotal,
      finalTotal,
      amountPaid,
      changeDue,
      paymentMethod,
      status:           amountPaidNum >= grandTotal ? INVOICE_STATUS.PAID : INVOICE_STATUS.PARTIALLY_PAID,
      isOfflineCreated: false,
    }], { session });

    // ── Create payment record ─────────────────────────────────────────────────
    const [payment] = await Payment.create([{
      invoiceId:     invoice._id,
      amount:        amountPaidNum,
      paymentMethod,
      processedBy:   req.user._id,
    }], { session });

    // ── Link payment to invoice ───────────────────────────────────────────────
    invoice.payments.push(payment._id);
    await invoice.save({ session });

    // ── Deduct inventory stock ────────────────────────────────────────────────
    await deductStock(processedItems, session);

    await session.commitTransaction();
    session.endSession();

    return sendSuccess(res, { statusCode: 201, data: invoice, message: 'Invoice created successfully.' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return sendError(res, { statusCode: 400, message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  @desc    List invoices (paginated, filterable)
//  @route   GET /api/billing/invoices
//  @access  Private
// ═══════════════════════════════════════════════════════════════════════════
const getInvoices = asyncHandler(async (req, res) => {
  const {
    page       = 1,
    limit      = 20,
    status,
    cashierId,
    startDate,
    endDate,
    search,
    isVoided,
  } = req.query;

  const filter = {};
  if (status)              filter.status       = status;
  if (cashierId)           filter.cashierId    = cashierId;
  if (isVoided !== undefined) filter.isVoided  = isVoided === 'true';
  if (search)              filter.$text        = { $search: search };

  // Date range
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate)   filter.createdAt.$lte = new Date(endDate);
  }

  const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const total = await Invoice.countDocuments(filter);
  const invoices = await Invoice.find(filter)
    .populate('cashierId', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10));

  return sendSuccess(res, {
    data: invoices,
    meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10), totalPages: Math.ceil(total / parseInt(limit, 10)) },
    message: 'Invoices retrieved successfully.',
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  @desc    Get single invoice
//  @route   GET /api/billing/invoices/:id
//  @access  Private
// ═══════════════════════════════════════════════════════════════════════════
const getInvoiceById = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('cashierId', 'name email')
    .populate('payments');

  if (!invoice) {
    return sendError(res, { statusCode: 404, message: 'Invoice not found.' });
  }

  // Ensure cashiers can only view their own invoices
  if (req.user.role === 'cashier' && invoice.cashierId._id.toString() !== req.user._id.toString()) {
    return sendError(res, { statusCode: 403, message: 'Not authorized to access this invoice.' });
  }
  return sendSuccess(res, { data: invoice, message: 'Invoice retrieved successfully.' });
});

// ═══════════════════════════════════════════════════════════════════════════
//  @desc    Void an invoice (fraud prevention — never deleted, only marked)
//  @route   PATCH /api/billing/invoices/:id/void
//  @access  Private (admin / manager only)
// ═══════════════════════════════════════════════════════════════════════════
const voidInvoice = asyncHandler(async (req, res) => {
  const { voidReason } = req.body;

  if (!voidReason || voidReason.trim() === '') {
    return sendError(res, { statusCode: 400, message: 'A void reason is required to void an invoice.' });
  }

  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) {
    return sendError(res, { statusCode: 404, message: 'Invoice not found.' });
  }
  if (invoice.isVoided) {
    return sendError(res, { statusCode: 409, message: 'Invoice has already been voided.' });
  }

  // ── Void the invoice ──────────────────────────────────────────────────────
  invoice.isVoided  = true;
  invoice.voidReason= voidReason.trim();
  invoice.voidedBy  = req.user._id;
  invoice.voidedAt  = new Date();
  invoice.status    = INVOICE_STATUS.VOIDED;
  await invoice.save();

  // ── Restore stock for each voided line item ───────────────────────────────
  const restoreOps = invoice.lineItems.map((item) => ({
    updateOne: {
      filter: { _id: item.productId },
      update: { $inc: { quantityInStock: item.quantity } }, // add back
    },
  }));
  if (restoreOps.length > 0) await Product.bulkWrite(restoreOps);

  return sendSuccess(res, { data: invoice, message: 'Invoice voided successfully.' });
});

// ═══════════════════════════════════════════════════════════════════════════
//  @desc    Batch sync offline-created invoices
//  @route   POST /api/billing/sync
//  @access  Private (cashier / admin)
//
//  The React client calls this endpoint when the network is restored.
//  It sends an array of locally-stored invoices created offline (IndexedDB).
//
//  IDEMPOTENCY STRATEGY
//  ─────────────────────
//  Each offline invoice carries a client-generated `offlineRef` (UUID v4).
//  The server checks this field — not `invoiceNumber` — to detect duplicates.
//  This prevents false positives from sequential countDocuments() calls and
//  is safe for retried sync attempts.
//
//  INVOICE NUMBER UNIQUENESS
//  ──────────────────────────
//  countDocuments() inside a loop creates a race condition: two concurrent
//  sync requests can read the same count and produce the same invoice number.
//  Instead we use a date-prefixed crypto-random hex suffix:
//    Format: INV-YYYYMMDD-<8 random hex chars>   e.g. INV-20260618-3f7a1c04
//  Collision probability is negligible (1 in 4 billion per day) and the
//  unique index on invoiceNumber guarantees a write-level safety net.
// ═══════════════════════════════════════════════════════════════════════════
const crypto = require('crypto');

/**
 * Generates a collision-resistant offline invoice number without reading
 * the current document count.
 *
 * Format: INV-YYYYMMDD-<8 random lowercase hex chars>
 * Example: INV-20260618-3f7a1c04
 *
 * @returns {string}
 */
const generateOfflineInvoiceNumber = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  const randomSuffix = crypto.randomBytes(4).toString('hex'); // 8 hex chars
  return `INV-${yyyy}${mm}${dd}-${randomSuffix}`;
};

const syncOfflineInvoices = asyncHandler(async (req, res) => {
  const { invoices } = req.body; // array of offline invoice payloads

  if (!Array.isArray(invoices) || invoices.length === 0) {
    return sendError(res, { statusCode: 400, message: 'invoices array is required and cannot be empty.' });
  }

  // ── Validate: every entry must carry a client-generated offlineRef ──────
  const missingRef = invoices.find((inv) => !inv.offlineRef);
  if (missingRef) {
    return sendError(res, {
      statusCode: 400,
      message: 'Every invoice in the sync payload must include a unique `offlineRef` (UUID).',
    });
  }

  const results = {
    synced:  [],
    skipped: [],
    failed:  [],
  };

  for (const offlineInvoice of invoices) {
    const { offlineRef } = offlineInvoice;

    try {
      // ── IDEMPOTENCY CHECK — use offlineRef, not invoiceNumber ────────────
      // The client may call /sync multiple times (e.g. flaky connection).
      // We store offlineRef on the Invoice document and query it here so
      // that re-submitted invoices are skipped gracefully, not duplicated.
      const duplicate = await Invoice.findOne({ offlineRef });
      if (duplicate) {
        results.skipped.push({
          offlineRef,
          invoiceNumber: duplicate.invoiceNumber,
          reason: 'Already synced (matched by offlineRef).',
        });
        continue;
      }

      // ── Generate a unique invoice number (no countDocuments race) ────────
      // Retry up to 3 times in the astronomically unlikely event of a
      // collision against the unique index on invoiceNumber.
      let invoiceNumber;
      let attempts = 0;
      while (attempts < 3) {
        invoiceNumber = generateOfflineInvoiceNumber();
        const conflict = await Invoice.exists({ invoiceNumber });
        if (!conflict) break;
        attempts++;
      }

      // ── Compute totals ───────────────────────────────────────────────────
      let subTotal = 0;
      let totalItemDiscount = 0;
      let totalTax = 0;

      const processedItems = (offlineInvoice.lineItems || []).map((item) => {
        const unitPrice = Number(item.unitPrice) || 0;
        const quantity = Number(item.quantity) || 0;
        const discount = Number(item.discount) || 0;
        const taxRate = Number(item.taxRate) || 0;

        const itemSubtotal = parseFloat((unitPrice * quantity).toFixed(2));
        const taxAmount = parseFloat(((itemSubtotal - discount) * (taxRate / 100)).toFixed(2));
        const lineTotal = parseFloat((itemSubtotal - discount + taxAmount).toFixed(2));

        subTotal += itemSubtotal;
        totalItemDiscount += discount;
        totalTax += taxAmount;

        return { 
          ...item, 
          unitPrice, 
          quantity, 
          discount, 
          taxRate, 
          taxAmount, 
          lineTotal 
        };
      });

      // Calculate cart-wide promo discount
      let cartPromoDiscount = 0;
      const promoDiscount = offlineInvoice.promoDiscount;
      if (promoDiscount && Number(promoDiscount.value) > 0) {
        const val = Number(promoDiscount.value) || 0;
        if (promoDiscount.type === 'percentage') {
          cartPromoDiscount = parseFloat((subTotal * (val / 100)).toFixed(2));
        } else if (promoDiscount.type === 'flat') {
          cartPromoDiscount = val;
        }
      }

      subTotal = parseFloat(subTotal.toFixed(2));
      totalItemDiscount = parseFloat(totalItemDiscount.toFixed(2));
      totalTax = parseFloat(totalTax.toFixed(2));
      cartPromoDiscount = parseFloat(cartPromoDiscount.toFixed(2));

      const totalDiscount = parseFloat((totalItemDiscount + cartPromoDiscount).toFixed(2));
      const grandTotal = Math.max(0, parseFloat((subTotal + totalTax - totalDiscount).toFixed(2)));
      const finalTotal = grandTotal;

      // ── Save to DB ───────────────────────────────────────────────────────
      // Destructure out any client-side fields that must not override server values
      // eslint-disable-next-line no-unused-vars
      const { invoiceNumber: _clientNum, cashierId: _cId, ...safeOfflineFields } = offlineInvoice;

      const savedInvoice = await Invoice.create({
        ...safeOfflineFields,           // safe client fields (lineItems, paymentMethod, etc.)
        offlineRef,                     // stored for future idempotency checks
        invoiceNumber,                  // server-assigned, collision-safe
        cashierId:        req.user._id, // always trust the authenticated user, not the client
        lineItems:        processedItems,
        subTotal,
        totalTax,
        totalDiscount,
        grandTotal,
        finalTotal,
        isOfflineCreated: true,
        offlineCreatedAt: offlineInvoice.createdAt
          ? new Date(offlineInvoice.createdAt)
          : new Date(),
        status: INVOICE_STATUS.PAID, // offline sales are recorded as paid at time of sale
      });

      // ── Deduct stock ─────────────────────────────────────────────────────
      for (const item of processedItems) {
        if (!item.productId) continue;
        const product = await Product.findById(item.productId);
        if (!product) continue;
        
        if (product.recipeIngredients && product.recipeIngredients.length > 0) {
          for (const ingredient of product.recipeIngredients) {
            const ingProduct = await Product.findById(ingredient.productId);
            const requiredQty = ingredient.quantityRequired * item.quantity;
            if (ingProduct && ingProduct.quantityInStock < requiredQty) {
              throw new Error(`Insufficient stock for ingredient "${ingProduct.name}". Available: ${ingProduct.quantityInStock}, Requested: ${requiredQty}`);
            }
          }
        } else {
          if (product.quantityInStock < item.quantity) {
            throw new Error(`Insufficient stock for "${product.name}". Available: ${product.quantityInStock}, Requested: ${item.quantity}`);
          }
        }
      }
      await deductStock(processedItems);

      results.synced.push({
        offlineRef,
        invoiceNumber: savedInvoice.invoiceNumber,
        _id:           savedInvoice._id,
      });
    } catch (err) {
      // ── Catch per-invoice errors so one bad record never aborts the batch
      results.failed.push({ offlineRef, error: err.message });
    }
  }

  return sendSuccess(res, {
    data: results,
    message:
      `Sync complete. ` +
      `Synced: ${results.synced.length}, ` +
      `Skipped: ${results.skipped.length}, ` +
      `Failed: ${results.failed.length}.`,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  @desc    Sales dashboard summary for the current day / date range
//  @route   GET /api/billing/dashboard
//  @access  Private (admin / manager)
//
//  NET PROFIT CALCULATION
//  ───────────────────────
//  Net Profit = Total Sales (grandTotal) − Total COGS
//
//  COGS per line item = item.quantity × costPrice (fetched live from Product).
//  We use a $lookup to join the Product collection on each line item's productId
//  so we always use the canonical costPrice, not a stale snapshot.
//
//  If a product has been deleted or its productId is absent (e.g. a manually
//  keyed item), costPrice defaults to 0 so totals remain accurate for the
//  rest of the invoice.
//
//  Pipeline stages:
//   1. $match          — non-voided invoices within the requested date window
//   2. $unwind         — flatten lineItems array (one doc per line item)
//   3. $lookup         — join Product to retrieve costPrice
//   4. $addFields      — compute lineCOGS for each item
//   5. $group (invoice)— re-aggregate per invoice: sum lineCOGS → invoiceCOGS
//   6. $group (total)  — final accumulation across all invoices
//   7. $project        — compute netProfit and round all currency fields
// ═══════════════════════════════════════════════════════════════════════════
const getDashboard = asyncHandler(async (req, res) => {
  // ── Build date window ──────────────────────────────────────────────────
  // Support optional ?startDate=&endDate= query params; default to today.
  const { startDate, endDate } = req.query;

  let windowStart, windowEnd;
  if (startDate || endDate) {
    // Caller supplied an explicit date range
    windowStart = startDate ? new Date(startDate) : new Date(0);
    windowEnd   = endDate   ? new Date(endDate)   : new Date();
    // Ensure endDate covers the full day
    if (!endDate) {
      windowEnd.setHours(23, 59, 59, 999);
    }
  } else {
    // Default: today (server local time)
    const today  = new Date();
    windowStart  = new Date(today);
    windowStart.setHours(0, 0, 0, 0);
    windowEnd    = new Date(today);
    windowEnd.setHours(23, 59, 59, 999);
  }

  const [summary] = await Invoice.aggregate([
    // ── Stage 1: Filter to non-voided invoices within the date window ──────
    {
      $match: {
        isVoided:  false,
        createdAt: { $gte: windowStart, $lte: windowEnd },
      },
    },

    // ── Stage 2: Unwind lineItems so each line item becomes its own document
    //    preserveNullAndEmptyArrays keeps invoices that somehow have no items
    //    (shouldn't happen with our validation, but defensive) ──────────────
    {
      $unwind: {
        path: '$lineItems',
        preserveNullAndEmptyArrays: true,
      },
    },

    // ── Stage 3: Look up the canonical Product to get its current costPrice
    //    We join on lineItems.productId → Product._id ──────────────────────
    {
      $lookup: {
        from:         'products',           // MongoDB collection name
        localField:   'lineItems.productId',
        foreignField: '_id',
        as:           '_productInfo',
      },
    },

    // ── Stage 4: Resolve costPrice from the looked-up product.
    //    Falls back to 0 if the product was deleted or productId is absent.
    //    Then compute lineCOGS = quantity × costPrice ──────────────────────
    {
      $addFields: {
        '_resolvedCostPrice': {
          $ifNull: [
            { $arrayElemAt: ['$_productInfo.costPrice', 0] },
            0, // fallback: no cost data → treat as zero
          ],
        },
      },
    },
    {
      $addFields: {
        'lineItems.lineCOGS': {
          $multiply: [
            { $ifNull: ['$lineItems.quantity', 0] },
            '$_resolvedCostPrice',
          ],
        },
      },
    },

    // ── Stage 5: Re-group at the invoice level to sum per-invoice COGS
    //    and carry forward the invoice-level financial fields ───────────────
    {
      $group: {
        _id:          '$_id',                       // group by invoice _id
        grandTotal:   { $first: '$grandTotal' },
        totalTax:     { $first: '$totalTax' },
        totalDiscount:{ $first: '$totalDiscount' },
        invoiceCOGS:  { $sum: '$lineItems.lineCOGS' }, // COGS for this invoice
      },
    },

    // ── Stage 6: Final aggregation across all invoices in the date window ──
    {
      $group: {
        _id:            null,
        totalSales:     { $sum: '$grandTotal' },
        totalCOGS:      { $sum: '$invoiceCOGS' },
        invoiceCount:   { $sum: 1 },
        avgTransaction: { $avg: '$grandTotal' },
        totalTax:       { $sum: '$totalTax' },
        totalDiscount:  { $sum: '$totalDiscount' },
      },
    },

    // ── Stage 7: Project the final shape with netProfit and rounded values
    //    netProfit = totalSales − totalCOGS
    //    grossMarginPct = (netProfit / totalSales) × 100  (rounded to 2 dp) ─
    {
      $project: {
        _id:             0,
        invoiceCount:    1,
        totalTax:        { $round: ['$totalTax',     2] },
        totalDiscount:   { $round: ['$totalDiscount', 2] },
        avgTransaction:  { $round: ['$avgTransaction', 2] },
        totalSales: {
          $round: ['$totalSales', 2],
        },
        totalCOGS: {
          $round: ['$totalCOGS', 2],
        },
        // Net Profit: revenue kept after paying for the goods sold
        netProfit: {
          $round: [{ $subtract: ['$totalSales', '$totalCOGS'] }, 2],
        },
        // Gross Margin %: how much of each revenue dollar is profit
        grossMarginPct: {
          $round: [
            {
              $cond: [
                { $gt: ['$totalSales', 0] },
                {
                  $multiply: [
                    { $divide: [{ $subtract: ['$totalSales', '$totalCOGS'] }, '$totalSales'] },
                    100,
                  ],
                },
                0, // avoid division-by-zero on a day with no sales
              ],
            },
            2,
          ],
        },
        // ISO date boundaries for the queried window (useful for the UI)
        periodStart: { $literal: windowStart },
        periodEnd:   { $literal: windowEnd },
      },
    },
  ]);

  // ── Default response when no invoices exist for the period ───────────────
  const defaultSummary = {
    invoiceCount:   0,
    totalSales:     0,
    totalCOGS:      0,
    netProfit:      0,
    grossMarginPct: 0,
    avgTransaction: 0,
    totalTax:       0,
    totalDiscount:  0,
    periodStart:    windowStart,
    periodEnd:      windowEnd,
  };

  return sendSuccess(res, {
    data:    summary || defaultSummary,
    message: summary
      ? `Dashboard summary retrieved for ${windowStart.toDateString()}.`
      : 'No invoices found for the requested period.',
  });
});

const { generateDailyReportData, sendDailyReportEmail } = require('../../utils/emailReportService');

/**
 * @desc  Manually trigger daily EOD email report dispatch
 * @route POST /api/billing/reports/daily
 * @access Private (admin/manager)
 */
const triggerDailyReportEmail = asyncHandler(async (req, res) => {
  try {
    const reportData = await generateDailyReportData();
    const result = await sendDailyReportEmail(reportData);
    return sendSuccess(res, {
      data: result,
      message: 'Daily EOD report email dispatched successfully.'
    });
  } catch (err) {
    return sendError(res, {
      statusCode: 500,
      message: `Failed to dispatch EOD report email: ${err.message}`
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  @desc    Create petty cash transaction (payout/payin/starting_drawer)
//  @route   POST /api/billing/cash
//  @access  Private (cashier/admin)
// ═══════════════════════════════════════════════════════════════════════════
const createCashTransaction = asyncHandler(async (req, res) => {
  const { amount, reason, type } = req.body;
  if (!amount || !reason) {
    return sendError(res, { statusCode: 400, message: 'Amount and reason are required.' });
  }

  const tx = await CashTransaction.create({
    cashierId: req.user._id,
    amount: Number(amount),
    reason,
    type: type || 'payout',
  });

  return sendSuccess(res, { statusCode: 201, data: tx, message: 'Cash transaction logged.' });
});

// ═══════════════════════════════════════════════════════════════════════════
//  @desc    Get end-of-day / shift cash summary
//  @route   GET /api/billing/cash/summary
//  @access  Private
// ═══════════════════════════════════════════════════════════════════════════
const getCashSummary = asyncHandler(async (req, res) => {
  const { date, cashierId } = req.query; // date in YYYY-MM-DD
  
  const filterDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(filterDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(filterDate.setHours(23, 59, 59, 999));

  const filter = { createdAt: { $gte: startOfDay, $lte: endOfDay } };
  if (cashierId) filter.cashierId = cashierId;
  
  const aggFilter = { 
    createdAt: { $gte: startOfDay, $lte: endOfDay },
    paymentMethod: 'cash',
    isVoided: false
  };
  if (cashierId) {
    const mongoose = require('mongoose');
    aggFilter.cashierId = new mongoose.Types.ObjectId(cashierId);
  }

  // 1. Get cash sales total from non-voided invoices
  const cashInvoices = await Invoice.aggregate([
    { $match: aggFilter },
    { $group: { _id: null, total: { $sum: '$grandTotal' } } }
  ]);
  const cashSalesTotal = cashInvoices.length > 0 ? cashInvoices[0].total : 0;

  // 1b. Get credit sales total from non-voided invoices today
  const creditFilter = { 
    createdAt: { $gte: startOfDay, $lte: endOfDay },
    paymentMethod: 'credit',
    isVoided: false
  };
  if (cashierId) {
    const mongoose = require('mongoose');
    creditFilter.cashierId = new mongoose.Types.ObjectId(cashierId);
  }
  const creditInvoices = await Invoice.aggregate([
    { $match: creditFilter },
    { $group: { _id: null, total: { $sum: '$grandTotal' } } }
  ]);
  const creditSalesTotal = creditInvoices.length > 0 ? creditInvoices[0].total : 0;

  // 2. Get petty cash payouts and starting cash
  const transactions = await CashTransaction.find(filter).sort({ createdAt: -1 });
  let startingCash = 0;
  let totalPayouts = 0;
  let customerDebtCollections = 0;
  let supplierDebtPayments = 0;
  
  transactions.forEach(t => {
    if (t.type === 'starting_drawer') startingCash += t.amount;
    else if (t.type === 'payout') totalPayouts += t.amount;
    else if (t.type === 'payin') startingCash += t.amount; // Just add generic pay-ins to starting cash for summary
    else if (t.type === 'customer_debt_collection') customerDebtCollections += t.amount;
    else if (t.type === 'supplier_debt_payment') supplierDebtPayments += t.amount;
  });

  const finalExpectedCash = (startingCash + cashSalesTotal + customerDebtCollections) - (totalPayouts + supplierDebtPayments);

  return sendSuccess(res, {
    data: {
      startingCash,
      cashSalesTotal,
      creditSalesTotal,
      totalPayouts,
      customerDebtCollections,
      supplierDebtPayments,
      finalExpectedCash,
      transactions
    },
    message: 'Cash summary retrieved successfully.'
  });
});

const masterReset = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return sendError(res, 'Unauthorized system reset.', 403);
  }

  await Promise.all([
    Invoice.deleteMany({}),
    CashTransaction.deleteMany({}),
    Payment.deleteMany({})
  ]);

  return sendSuccess(res, null, 'Master system reset completed successfully.');
});

module.exports = {
  createInvoice, getInvoices, getInvoiceById,
  voidInvoice, syncOfflineInvoices, getDashboard,
  triggerDailyReportEmail, createCashTransaction, getCashSummary,
  masterReset
};
