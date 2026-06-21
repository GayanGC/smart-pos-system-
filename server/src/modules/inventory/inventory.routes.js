/**
 * @file inventory.routes.js
 * @module inventory
 * @description Express router for inventory management.
 *
 * Base path (mounted in app.js): /api/inventory
 *
 * | Method | Path                        | Access          |
 * |--------|-----------------------------|-----------------|
 * | GET    | /products                   | Authenticated   |
 * | POST   | /products                   | Admin/Manager   |
 * | GET    | /products/:id               | Authenticated   |
 * | GET    | /products/sku/:sku          | Authenticated   |
 * | GET    | /products/barcode/:barcode  | Authenticated   |
 * | PUT    | /products/:id               | Admin/Manager   |
 * | DELETE | /products/:id               | Admin           |
 * | GET    | /alerts/low-stock           | Authenticated   |
 * | GET    | /alerts/expiring            | Authenticated   |
 * | GET    | /suppliers                  | Authenticated   |
 * | POST   | /suppliers                  | Admin/Manager   |
 * | GET    | /suppliers/:id              | Authenticated   |
 * | PUT    | /suppliers/:id              | Admin/Manager   |
 * | DELETE | /suppliers/:id              | Admin           |
 */

const router = require('express').Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const {
  getProducts, createProduct, getProductById,
  getProductBySku, getProductByBarcode,
  updateProduct, deleteProduct,
  getLowStockAlerts, getExpiringProducts,
  getSuppliers, createSupplier, getSupplierById,
  updateSupplier, deleteSupplier, processSupplierInvoiceOCR,
} = require('./inventory.controller');
const { protect, authorize } = require('../../middleware/auth.middleware');

// All inventory routes require authentication
router.use(protect);

// ── Stock alerts (before /:id to avoid route conflicts) ────────────────────
router.get('/alerts/low-stock', getLowStockAlerts);
router.get('/alerts/expiring',  getExpiringProducts);

// ── Supplier OCR ────────────────────────────────────────────────────────────
router.post('/supplier-ocr', authorize('super_admin', 'admin', 'manager'), upload.single('invoice'), processSupplierInvoiceOCR);

// ── Product lookup by SKU / barcode ─────────────────────────────────────────
router.get('/products/sku/:sku',          getProductBySku);
router.get('/products/barcode/:barcode',  getProductByBarcode);

// ── Products CRUD ────────────────────────────────────────────────────────────
router.route('/products')
  .get(getProducts)
  .post(authorize('super_admin', 'admin', 'manager'), createProduct);

router.route('/products/:id')
  .get(getProductById)
  .put(authorize('super_admin', 'admin', 'manager'), updateProduct)
  .delete(authorize('super_admin', 'admin'), deleteProduct);

// ── Suppliers CRUD ───────────────────────────────────────────────────────────
router.route('/suppliers')
  .get(getSuppliers)
  .post(authorize('super_admin', 'admin', 'manager'), createSupplier);

router.route('/suppliers/:id')
  .get(getSupplierById)
  .put(authorize('super_admin', 'admin', 'manager'), updateSupplier)
  .delete(authorize('super_admin', 'admin'), deleteSupplier);

module.exports = router;
