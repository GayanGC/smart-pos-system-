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
  const ops = lineItems.map((item) => ({
    updateOne: {
      filter: { _id: item.productId },
      update: { $inc: { quantityInStock: -item.quantity } },
    },
  }));
  if (ops.length > 0) {
    await Product.bulkWrite(ops, session ? { session } : {});
  }
};

// ═══════════════════════════════════════════════════════════════════════════
//  @desc    Create a new invoice (online path)
//  @route   POST /api/billing/invoices
//  @access  Private (cashier / admin)
// ═══════════════════════════════════════════════════════════════════════════
const createInvoice = asyncHandler(async (req, res) => {
  const { lineItems, paymentMethod, amountPaid, ...rest } = req.body;

  if (!lineItems || lineItems.length === 0) {
    return sendError(res, { statusCode: 400, message: 'At least one line item is required.' });
  }

  // ── Generate invoice number ──────────────────────────────────────────────
  const count = await Invoice.countDocuments();
  const invoiceNumber = generateInvoiceNumber(count);

  // ── Compute totals from line items ────────────────────────────────────────
  let subTotal = 0, totalTax = 0, totalDiscount = 0;
  const processedItems = lineItems.map((item) => {
    const taxAmount  = (item.unitPrice * item.quantity) * ((item.taxRate || 0) / 100);
    const discount   = item.discount || 0;
    const lineTotal  = (item.unitPrice * item.quantity) + taxAmount - discount;
    subTotal      += item.unitPrice * item.quantity;
    totalTax      += taxAmount;
    totalDiscount += discount;
    return { ...item, taxAmount, lineTotal };
  });

  const grandTotal = subTotal + totalTax - totalDiscount;
  const changeDue  = amountPaid > grandTotal ? amountPaid - grandTotal : 0;

  // ── Create invoice document ───────────────────────────────────────────────
  const invoice = await Invoice.create({
    ...rest,
    invoiceNumber,
    cashierId: req.user._id,
    lineItems: processedItems,
    subTotal,
    totalTax,
    totalDiscount,
    grandTotal,
    amountPaid,
    changeDue,
    paymentMethod,
    status:           amountPaid >= grandTotal ? INVOICE_STATUS.PAID : INVOICE_STATUS.PARTIALLY_PAID,
    isOfflineCreated: false,
  });

  // ── Create payment record ─────────────────────────────────────────────────
  const payment = await Payment.create({
    invoiceId:     invoice._id,
    amount:        amountPaid,
    paymentMethod,
    processedBy:   req.user._id,
  });

  // ── Link payment to invoice ───────────────────────────────────────────────
  invoice.payments.push(payment._id);
  await invoice.save();

  // ── Deduct inventory stock ────────────────────────────────────────────────
  await deductStock(processedItems);

  return sendSuccess(res, { statusCode: 201, data: invoice, message: 'Invoice created successfully.' });
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
      let subTotal = 0, totalTax = 0, totalDiscount = 0;
      const processedItems = (offlineInvoice.lineItems || []).map((item) => {
        const taxAmount  = (item.unitPrice * item.quantity) * ((item.taxRate || 0) / 100);
        const discount   = item.discount || 0;
        const lineTotal  = (item.unitPrice * item.quantity) + taxAmount - discount;
        subTotal      += item.unitPrice * item.quantity;
        totalTax      += taxAmount;
        totalDiscount += discount;
        return { ...item, taxAmount, lineTotal };
      });

      const grandTotal = subTotal + totalTax - totalDiscount;

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
        isOfflineCreated: true,
        offlineCreatedAt: offlineInvoice.createdAt
          ? new Date(offlineInvoice.createdAt)
          : new Date(),
        status: INVOICE_STATUS.PAID, // offline sales are recorded as paid at time of sale
      });

      // ── Deduct stock ─────────────────────────────────────────────────────
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

module.exports = {
  createInvoice, getInvoices, getInvoiceById,
  voidInvoice, syncOfflineInvoices, getDashboard,
};
