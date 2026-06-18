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
  const filter = { isActive: true };
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
  // If a supplierId is provided, sync the supplier snapshot
  if (req.body.supplier?.supplierId) {
    const supplierDoc = await Supplier.findById(req.body.supplier.supplierId);
    if (!supplierDoc) {
      return sendError(res, { statusCode: 404, message: 'Supplier not found.' });
    }
    // Always sync the snapshot from the canonical document
    req.body.supplier = {
      supplierId: supplierDoc._id,
      name:       supplierDoc.name,
      phone:      supplierDoc.phone,
      email:      supplierDoc.email,
    };
  }

  const product = await Product.create(req.body);
  return sendSuccess(res, { statusCode: 201, data: product, message: 'Product created successfully.' });
});

/**
 * @desc  Get a single product by MongoDB ID
 */
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product || !product.isActive) {
    return sendError(res, { statusCode: 404, message: 'Product not found.' });
  }
  return sendSuccess(res, { data: product, message: 'Product retrieved successfully.' });
});

/**
 * @desc  Get a product by SKU (used by POS system)
 */
const getProductBySku = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ sku: req.params.sku.toUpperCase(), isActive: true });
  if (!product) {
    return sendError(res, { statusCode: 404, message: `No product found with SKU '${req.params.sku}'.` });
  }
  return sendSuccess(res, { data: product, message: 'Product retrieved successfully.' });
});

/**
 * @desc  Get a product by barcode (fastest path for POS barcode scanner)
 */
const getProductByBarcode = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ barcode: req.params.barcode, isActive: true });
  if (!product) {
    return sendError(res, { statusCode: 404, message: `No product found with barcode '${req.params.barcode}'.` });
  }
  return sendSuccess(res, { data: product, message: 'Product retrieved successfully.' });
});

/**
 * @desc  Update a product
 */
const updateProduct = asyncHandler(async (req, res) => {
  // If price changes, push to priceHistory audit trail
  const existing = await Product.findById(req.params.id);
  if (!existing) {
    return sendError(res, { statusCode: 404, message: 'Product not found.' });
  }

  if (req.body.sellingPrice && req.body.sellingPrice !== existing.sellingPrice) {
    req.body.$push = {
      priceHistory: {
        price:     existing.sellingPrice,
        changedAt: new Date(),
        changedBy: req.user._id,
      },
    };
  }

  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new:            true,
    runValidators:  true,
  });

  return sendSuccess(res, { data: product, message: 'Product updated successfully.' });
});

/**
 * @desc  Soft-delete a product (sets isActive = false)
 */
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  if (!product) {
    return sendError(res, { statusCode: 404, message: 'Product not found.' });
  }
  return sendSuccess(res, { message: 'Product deactivated successfully.' });
});

// ═══════════════════════════════════════════════════════════════════════════
//  STOCK ALERTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @desc  List products where quantityInStock ≤ lowStockThreshold
 */
const getLowStockAlerts = asyncHandler(async (req, res) => {
  const lowStockItems = await Product.find({
    isActive: true,
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

  const expiring = await Product.find({
    isActive:   true,
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

module.exports = {
  // Products
  getProducts, createProduct, getProductById,
  getProductBySku, getProductByBarcode,
  updateProduct, deleteProduct,
  // Alerts
  getLowStockAlerts, getExpiringProducts,
  // Suppliers
  getSuppliers, createSupplier, getSupplierById,
  updateSupplier, deleteSupplier,
};
