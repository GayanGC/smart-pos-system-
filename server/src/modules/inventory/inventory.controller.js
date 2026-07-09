/**
 * @file inventory.controller.js
 * @module inventory
 * @description CRUD controllers for Products and Suppliers, plus
 *              built-in low-stock and expiry alert aggregations.
 *
 * Routes handled:
 *  Products:
 *    GET    /api/inventory/products             – list (paginated + filtered)
 *    POST   /api/inventory/products             – create
 *    GET    /api/inventory/products/:id         – get by id
 *    GET    /api/inventory/products/sku/:sku    – get by SKU (POS barcode scan)
 *    GET    /api/inventory/products/barcode/:bc – get by barcode
 *    PUT    /api/inventory/products/:id         – update
 *    DELETE /api/inventory/products/:id         – soft-delete (isActive = false)
 *
 *  Alerts:
 *    GET    /api/inventory/alerts/low-stock     – items at or below threshold
 *    GET    /api/inventory/alerts/expiring      – items expiring within N days
 *
 *  Suppliers:
 *    GET    /api/inventory/suppliers            – list
 *    POST   /api/inventory/suppliers            – create
 *    GET    /api/inventory/suppliers/:id        – get by id
 *    PUT    /api/inventory/suppliers/:id        – update
 *    DELETE /api/inventory/suppliers/:id        – soft-delete
 */

const Product   = require('./product.model');
const Supplier  = require('./supplier.model');
const asyncHandler      = require('../../utils/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/responseFormatter');
const { GoogleGenAI } = require('@google/genai');

// ═══════════════════════════════════════════════════════════════════════════
//  PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @desc  List all active products (paginated, filterable)
 * @query page, limit, category, search, lowStock, sortBy, order
 */
const getProducts = asyncHandler(async (req, res) => {
  const {
    page     = 1,
    limit    = 20,
    category,
    search,
    lowStock,
    sortBy   = 'name',
    order    = 'asc',
  } = req.query;

  // ── Build filter ───────────────────────────────────────────────────────
  // Safely default to 'store_1' if storeId is missing (for local testing)
  const userStoreId = req.user.storeId || 'store_1';
  const filter = { isActive: true, storeId: userStoreId };
  if (category) filter.category = category;
  if (search)   filter.$text    = { $search: search };

  // Aggregate low-stock filter using MongoDB's $expr
  if (lowStock === 'true') {
    filter.$expr = { $lte: ['$quantityInStock', '$lowStockThreshold'] };
  }

  const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const sort  = { [sortBy]: order === 'desc' ? -1 : 1 };
  const total = await Product.countDocuments(filter);

  const products = await Product.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit, 10));

  return sendSuccess(res, {
    data: products,
    meta: {
      total,
      page:       parseInt(page, 10),
      limit:      parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    },
    message: 'Products retrieved successfully.',
  });
});

/**
 * @desc  Create a new product
 */
const createProduct = asyncHandler(async (req, res) => {
  const safeData = {
    name: req.body.name,
    description: req.body.description,
    sku: req.body.sku,
    barcode: req.body.barcode,
    category: req.body.category,
    brand: req.body.brand,
    costPrice: req.body.costPrice,
    sellingPrice: req.body.sellingPrice,
    taxRate: req.body.taxRate,
    quantityInStock: req.body.quantityInStock,
    lowStockThreshold: req.body.lowStockThreshold,
    expiryDate: req.body.expiryDate,
    imageUrl: req.body.imageUrl,
    storeId: req.user.storeId || 'store_1',
  };

  // If a supplierId is provided, sync the supplier snapshot
  if (req.body.supplier?.supplierId) {
    const supplierDoc = await Supplier.findById(req.body.supplier.supplierId);
    if (!supplierDoc) {
      return sendError(res, { statusCode: 404, message: 'Supplier not found.' });
    }
    // Always sync the snapshot from the canonical document
    safeData.supplier = {
      supplierId: supplierDoc._id,
      name:       supplierDoc.name,
      phone:      supplierDoc.phone,
      email:      supplierDoc.email,
    };
  }

  const product = await Product.create(safeData);
  return sendSuccess(res, { statusCode: 201, data: product, message: 'Product created successfully.' });
});

/**
 * @desc  Get a single product by MongoDB ID
 */
const getProductById = asyncHandler(async (req, res) => {
  const userStoreId = req.user.storeId || 'store_1';
  const product = await Product.findOne({ _id: req.params.id, storeId: userStoreId });
  if (!product || !product.isActive) {
    return sendError(res, { statusCode: 404, message: 'Product not found.' });
  }
  return sendSuccess(res, { data: product, message: 'Product retrieved successfully.' });
});

/**
 * @desc  Get a product by SKU (used by POS system)
 */
const getProductBySku = asyncHandler(async (req, res) => {
  const userStoreId = req.user.storeId || 'store_1';
  const product = await Product.findOne({ sku: req.params.sku.toUpperCase(), isActive: true, storeId: userStoreId });
  if (!product) {
    return sendError(res, { statusCode: 404, message: `No product found with SKU '${req.params.sku}'.` });
  }
  return sendSuccess(res, { data: product, message: 'Product retrieved successfully.' });
});

/**
 * @desc  Get a product by barcode (fastest path for POS barcode scanner)
 */
const getProductByBarcode = asyncHandler(async (req, res) => {
  const userStoreId = req.user.storeId || 'store_1';
  const product = await Product.findOne({ barcode: req.params.barcode, isActive: true, storeId: userStoreId });
  if (!product) {
    return sendError(res, { statusCode: 404, message: `No product found with barcode '${req.params.barcode}'.` });
  }
  return sendSuccess(res, { data: product, message: 'Product retrieved successfully.' });
});

/**
 * @desc  Update a product
 */
const updateProduct = asyncHandler(async (req, res) => {
  const userStoreId = req.user.storeId || 'store_1';
  const existing = await Product.findOne({ _id: req.params.id, storeId: userStoreId });
  if (!existing) {
    return sendError(res, { statusCode: 404, message: 'Product not found.' });
  }

  const safeData = {};
  const allowedFields = ['name', 'description', 'sku', 'barcode', 'category', 'brand', 'costPrice', 'sellingPrice', 'taxRate', 'quantityInStock', 'lowStockThreshold', 'expiryDate', 'imageUrl'];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) safeData[field] = req.body[field];
  }

  // If a supplierId is provided, sync the supplier snapshot
  if (req.body.supplier?.supplierId) {
    const supplierDoc = await Supplier.findById(req.body.supplier.supplierId);
    if (!supplierDoc) {
      return sendError(res, { statusCode: 404, message: 'Supplier not found.' });
    }
    safeData.supplier = {
      supplierId: supplierDoc._id,
      name:       supplierDoc.name,
      phone:      supplierDoc.phone,
      email:      supplierDoc.email,
    };
  }

  const updateOp = { $set: safeData };

  // If price changes, push to priceHistory audit trail
  if (req.body.sellingPrice && req.body.sellingPrice !== existing.sellingPrice) {
    updateOp.$push = {
      priceHistory: {
        price:     existing.sellingPrice,
        changedAt: new Date(),
        changedBy: req.user._id,
      },
    };
  }

  const product = await Product.findOneAndUpdate({ _id: req.params.id, storeId: userStoreId }, updateOp, {
    new:            true,
    runValidators:  true,
  });

  return sendSuccess(res, { data: product, message: 'Product updated successfully.' });
});

/**
 * @desc  Soft-delete a product (sets isActive = false)
 */
const deleteProduct = asyncHandler(async (req, res) => {
  const userStoreId = req.user.storeId || 'store_1';
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, storeId: userStoreId },
    { isActive: false },
    { new: true }
  );
  if (!product) {
    return sendError(res, { statusCode: 404, message: 'Product not found.' });
  }
  return sendSuccess(res, { message: 'Product deactivated successfully.' });
});

/**
 * @desc  Manually adjust stock for a product (atomic $inc)
 */
const adjustProductStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type, quantity, reason } = req.body;

  if (!['add', 'reduce'].includes(type) || !quantity || !reason) {
    return sendError(res, { statusCode: 400, message: 'Invalid adjustment parameters.' });
  }

  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) {
    return sendError(res, { statusCode: 400, message: 'Quantity must be a positive number.' });
  }

  const incValue = type === 'add' ? qty : -qty;

  // Use $inc for atomic updates, ensure quantity doesn't drop below 0 if reducing
  const userStoreId = req.user.storeId || 'store_1';
  const query = { _id: id, storeId: userStoreId };
  if (type === 'reduce') {
    query.quantityInStock = { $gte: qty };
  }

  const product = await Product.findOneAndUpdate(
    query,
    { $inc: { quantityInStock: incValue } },
    { new: true, runValidators: true }
  );

  if (!product) {
    return sendError(res, { statusCode: 400, message: 'Product not found or insufficient stock to reduce.' });
  }

  console.log(`[STOCK ADJUSTMENT] Product ${product.sku} | Type: ${type} | Qty: ${qty} | Reason: ${reason} | New Stock: ${product.quantityInStock}`);

  return sendSuccess(res, { data: product, message: 'Stock adjusted successfully.' });
});

// ═══════════════════════════════════════════════════════════════════════════
//  STOCK ALERTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @desc  List products where quantityInStock ≤ lowStockThreshold
 */
const getLowStockAlerts = asyncHandler(async (req, res) => {
  const userStoreId = req.user.storeId || 'store_1';
  const lowStockItems = await Product.find({
    isActive: true,
    storeId: userStoreId,
    $expr: { $lte: ['$quantityInStock', '$lowStockThreshold'] },
  }).sort({ quantityInStock: 1 }); // most critical first

  return sendSuccess(res, {
    data:    lowStockItems,
    meta:    { count: lowStockItems.length },
    message: `${lowStockItems.length} low-stock item(s) found.`,
  });
});

/**
 * @desc  List products expiring within N days (default: 30)
 * @query days
 */
const getExpiringProducts = asyncHandler(async (req, res) => {
  const days    = parseInt(req.query.days, 10) || 30;
  const cutoff  = new Date();
  cutoff.setDate(cutoff.getDate() + days);

  const userStoreId = req.user.storeId || 'store_1';
  const expiring = await Product.find({
    isActive:   true,
    storeId: userStoreId,
    expiryDate: { $lte: cutoff, $gte: new Date() }, // between now and cutoff
  }).sort({ expiryDate: 1 }); // soonest expiry first

  return sendSuccess(res, {
    data:    expiring,
    meta:    { count: expiring.length, withinDays: days },
    message: `${expiring.length} product(s) expiring within ${days} days.`,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  SUPPLIERS
// ═══════════════════════════════════════════════════════════════════════════

const getSuppliers = asyncHandler(async (req, res) => {
  const suppliers = await Supplier.find({ isActive: true }).sort({ name: 1 });
  return sendSuccess(res, { data: suppliers, message: 'Suppliers retrieved successfully.' });
});

const createSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.create(req.body);
  return sendSuccess(res, { statusCode: 201, data: supplier, message: 'Supplier created successfully.' });
});

const getSupplierById = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier || !supplier.isActive) {
    return sendError(res, { statusCode: 404, message: 'Supplier not found.' });
  }
  return sendSuccess(res, { data: supplier, message: 'Supplier retrieved successfully.' });
});

const updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, {
    new: true, runValidators: true,
  });
  if (!supplier) {
    return sendError(res, { statusCode: 404, message: 'Supplier not found.' });
  }
  return sendSuccess(res, { data: supplier, message: 'Supplier updated successfully.' });
});

const deleteSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  if (!supplier) {
    return sendError(res, { statusCode: 404, message: 'Supplier not found.' });
  }
  return sendSuccess(res, { message: 'Supplier deactivated successfully.' });
});

// ═══════════════════════════════════════════════════════════════════════════
//  AI SUPPLIER BILL OCR
// ═══════════════════════════════════════════════════════════════════════════

const processSupplierInvoiceOCR = asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, { statusCode: 400, message: 'No invoice image uploaded.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return sendError(res, { statusCode: 500, message: 'GEMINI_API_KEY is not configured on the server.' });
  }

  const ai = new GoogleGenAI({ apiKey });
  const base64Image = req.file.buffer.toString('base64');
  const mimeType = req.file.mimetype;

  const prompt = `You are an inventory management assistant.
Analyze this supplier invoice/bill image. It may contain English or handwritten/printed Sinhala text.
Extract all raw material line items (e.g., Rice, Sugar, Chicken, Vegetables).
Return a JSON array containing only these extracted items.
Each object in the array MUST exactly match this schema:
{
  "name": "string (the translated english name of the item)",
  "quantityToAdd": "number (the quantity found on the invoice)",
  "unit": "string (the unit of measurement, e.g. kg, g, l, pcs)"
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Image,
                mimeType,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    const responseText = response.text;
    let items = [];
    try {
      items = JSON.parse(responseText);
    } catch (e) {
      const cleaned = responseText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
      items = JSON.parse(cleaned);
    }

    if (!Array.isArray(items)) {
      throw new Error('Gemini did not return a valid array.');
    }

    const results = { matched: [], notFound: [] };
    const mongoose = require('mongoose');
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      for (const item of items) {
        const safeName = escapeRegex(item.name || '');
        const product = await Product.findOne({
          name: { $regex: new RegExp(safeName, 'i') },
          isActive: true
        }).session(session);

        if (product) {
          product.quantityInStock += Number(item.quantityToAdd) || 0;
          await product.save({ session });
          results.matched.push({
            name: product.name,
            added: item.quantityToAdd,
            newStock: product.quantityInStock
          });
        } else {
          results.notFound.push(item);
        }
      }

      await session.commitTransaction();
      session.endSession();

      return sendSuccess(res, {
        data: results,
        message: 'Supplier bill processed and inventory updated successfully.'
      });
    } catch (dbErr) {
      await session.abortTransaction();
      session.endSession();
      throw dbErr;
    }
  } catch (error) {
    console.error('Gemini OCR Error:', error);
    return sendError(res, { statusCode: 500, message: 'Failed to process invoice via Gemini: ' + error.message });
  }
});

module.exports = {
  // Products
  getProducts, createProduct, getProductById,
  getProductBySku, getProductByBarcode,
  updateProduct, deleteProduct, adjustProductStock,
  // Alerts
  getLowStockAlerts, getExpiringProducts,
  // Suppliers
  getSuppliers, createSupplier, getSupplierById,
  updateSupplier, deleteSupplier,
  // OCR
  processSupplierInvoiceOCR
};
