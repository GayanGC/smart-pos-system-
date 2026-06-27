import React, { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api/axios'
import { Html5Qrcode } from 'html5-qrcode'

// Categories list helper
const DEFAULT_CATEGORIES = ['Bakery', 'Pastry', 'Beverages', 'Dairy', 'Pantry', 'Snacks', 'Household']

export default function InventoryPage() {
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // OCR Upload State
  const fileInputRef = useRef(null)
  const [ocrUploading, setOcrUploading] = useState(false)
  
  // Filtering & Search
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [deletingProduct, setDeletingProduct] = useState(null)
  const [adjustingProduct, setAdjustingProduct] = useState(null)

  // Fetch all active products
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Query with a high limit to get all products for stats and directory
      const { data } = await api.get('/inventory/products', { params: { limit: 1000 } })
      setProducts(data.data || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load inventory products.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch active suppliers for dropdown selection
  const fetchSuppliers = useCallback(async () => {
    try {
      const { data } = await api.get('/inventory/suppliers')
      setSuppliers(data.data || [])
    } catch (err) {
      console.error('Failed to load suppliers:', err)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchSuppliers()
  }, [fetchProducts, fetchSuppliers])

  // Summary Card calculations
  const totalItems = products?.length || 0
  const outOfStockCount = products.filter(p => (p?.quantityInStock || 0) <= 0).length
  const lowStockCount = products.filter(p => (p?.quantityInStock || 0) <= (p?.lowStockThreshold || 0) && (p?.quantityInStock || 0) > 0).length

  // Filtered Products
  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      (product?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (product?.sku && product.sku.toLowerCase().includes(search.toLowerCase())) ||
      (product?.barcode && product.barcode.includes(search))
      
    const matchesCategory = categoryFilter === 'All' || product?.category === categoryFilter
    
    return matchesSearch && matchesCategory
  })

  // Sort by updatedAt desc so newest additions appear first
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    return new Date(b?.updatedAt || 0) - new Date(a?.updatedAt || 0)
  })

  // Pagination bounds
  const totalFiltered = sortedProducts.length
  const totalPages = Math.ceil(totalFiltered / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedProducts = sortedProducts.slice(startIndex, startIndex + itemsPerPage)

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
    }
  }

  // Adjust page number if filtered count changes
  useEffect(() => {
    setCurrentPage(1)
  }, [search, categoryFilter])

  // Soft Delete handler
  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return
    try {
      await api.delete(`/inventory/products/${deletingProduct._id}`)
      setDeletingProduct(null)
      fetchProducts()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete product.')
    }
  }

  // OCR Upload handler
  const handleOCRUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrUploading(true);
    const formData = new FormData();
    formData.append('invoice', file);

    try {
      const { data } = await api.post('/inventory/supplier-ocr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(`OCR Complete!\nMatched & Updated: ${data.data.matched.length}\nNot Found: ${data.data.notFound.length}`);
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to process invoice OCR.');
    } finally {
      setOcrUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-6 text-slate-200">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Inventory Directory</h1>
          <p className="text-slate-400 text-sm">Monitor stock counts, manage alert thresholds, and process product details.</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={handleOCRUpload} 
            className="hidden" 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={ocrUploading}
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm px-5 py-3 transition-all duration-200 border border-slate-700 flex items-center gap-2"
          >
            {ocrUploading ? '⏳ Analyzing...' : '🧾 AI OCR Upload'}
          </button>
          
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl text-sm px-5 py-3 transition-all duration-200 shadow-lg shadow-violet-600/10 flex items-center gap-2 hover:scale-[1.02]"
          >
            <span>➕</span> Add Product
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Total Items */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Items</p>
            <p className="text-3xl font-extrabold text-white">{totalItems}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-xl">
            📦
          </div>
        </div>

        {/* Card 2: Low Stock Alerts */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Low Stock Alerts</p>
            <p className="text-3xl font-extrabold text-amber-400">{lowStockCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl">
            ⚠️
          </div>
        </div>

        {/* Card 3: Out of Stock */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Out of Stock</p>
            <p className="text-3xl font-extrabold text-rose-500">{outOfStockCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-xl">
            🛑
          </div>
        </div>
      </div>

      {/* FILTER & TABLE SECTION */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden p-6 space-y-6">
        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="flex-1 max-w-md relative">
            <input
              type="text"
              placeholder="Search by product name, SKU, or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all"
            />
            <span className="absolute left-3.5 top-3.5 text-slate-500 text-sm">🔍</span>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {/* Category selection */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none transition-all cursor-pointer min-w-[150px]"
            >
              <option value="All">All Categories</option>
              {DEFAULT_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {(search || categoryFilter !== 'All') && (
              <button
                onClick={() => { setSearch(''); setCategoryFilter('All') }}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/60 rounded-xl px-4 py-3 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-900">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wide">Product</th>
                <th className="px-6 py-4 font-semibold tracking-wide">Category</th>
                <th className="px-6 py-4 font-semibold tracking-wide text-right">Cost (LKR)</th>
                <th className="px-6 py-4 font-semibold tracking-wide text-right">Selling (LKR)</th>
                <th className="px-6 py-4 font-semibold tracking-wide text-center">Stock Level</th>
                <th className="px-6 py-4 font-semibold tracking-wide text-center">Status</th>
                <th className="px-6 py-4 font-semibold tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500 font-medium">
                    Loading inventory...
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500 font-medium">
                    No matching products found.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const isOut = (p?.quantityInStock || 0) <= 0
                  const isLow = !isOut && (p?.quantityInStock || 0) <= (p?.lowStockThreshold || 0)
                  
                  return (
                    <tr key={p?._id} className="hover:bg-slate-900/20 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-200">{p?.name || 'Unnamed'}</span>
                          <span className="text-[11px] font-mono text-slate-500">SKU: {p?.sku || 'N/A'} | BC: {p?.barcode || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-400 font-medium">{p?.category || 'Uncategorized'}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-300">
                        Rs. {(p?.costPrice || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-100 font-semibold">
                        Rs. {(p?.sellingPrice || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center font-mono">
                        <span className={`font-bold ${isOut ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-slate-300'}`}>
                          {p?.quantityInStock || 0}
                        </span>
                        <span className="text-[10px] text-slate-600"> / {p?.lowStockThreshold || 0} min</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          isOut 
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                            : isLow 
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setAdjustingProduct(p)}
                            className="bg-slate-900 border border-slate-800 hover:border-emerald-500/30 hover:bg-emerald-600/10 text-slate-400 hover:text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                          >
                            Adjust Stock
                          </button>
                          <button
                            onClick={() => setEditingProduct(p)}
                            className="bg-slate-900 border border-slate-800 hover:border-violet-500/30 hover:bg-violet-600/10 text-slate-400 hover:text-violet-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeletingProduct(p)}
                            className="bg-slate-900 border border-slate-800 hover:border-rose-500/30 hover:bg-rose-600/10 text-slate-500 hover:text-rose-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-900">
            <span className="text-xs text-slate-500 font-medium">
              Showing <span className="text-slate-300">{startIndex + 1}</span> to{' '}
              <span className="text-slate-300">{Math.min(startIndex + itemsPerPage, totalFiltered)}</span> of{' '}
              <span className="text-slate-300">{totalFiltered}</span> items
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-slate-300 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs text-slate-400 font-mono px-3">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-slate-300 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ADD MODAL */}
      {isAddModalOpen && (
        <ProductFormModal 
          suppliers={suppliers} 
          onClose={() => setIsAddModalOpen(false)} 
          onSuccess={() => { setIsAddModalOpen(false); fetchProducts() }} 
        />
      )}

      {/* EDIT MODAL */}
      {editingProduct && (
        <ProductFormModal 
          product={editingProduct} 
          suppliers={suppliers} 
          onClose={() => setEditingProduct(null)} 
          onSuccess={() => { setEditingProduct(null); fetchProducts() }} 
        />
      )}

      {/* ADJUSTMENT MODAL */}
      {adjustingProduct && (
        <StockAdjustmentModal 
          product={adjustingProduct} 
          onClose={() => setAdjustingProduct(null)} 
          onSuccess={() => { setAdjustingProduct(null); fetchProducts() }} 
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col text-center">
            <div className="mx-auto w-12 h-12 bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center rounded-2xl text-2xl mb-4">
              ⚠️
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Delete Product?</h3>
            <p className="text-slate-400 text-sm mb-6">
              Are you sure you want to deactivate <span className="text-slate-200 font-semibold">"{deletingProduct.name}"</span>? 
              This product will be soft-deleted and hidden from both the Inventory Directory and the active POS list.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingProduct(null)}
                className="flex-1 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold border border-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-600/10 transition-colors"
              >
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── ADD / EDIT PRODUCT FORM MODAL ─────────────────────────────────────── */
function ProductFormModal({ product = null, suppliers, onClose, onSuccess }) {
  const isEdit = !!product
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isScanning, setIsScanning] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category: 'Bakery',
    customCategory: '',
    costPrice: '',
    sellingPrice: '',
    quantityInStock: '',
    lowStockThreshold: '10',
    expiryDate: '',
    supplierId: ''
  })

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, ctx.currentTime)
      osc.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.1)
    } catch (e) {
      // Ignore
    }
  }

  useEffect(() => {
    if (!isScanning) return

    let isMounted = true
    let html5Qrcode = null

    const timer = setTimeout(() => {
      if (!isMounted) return
      
      try {
        html5Qrcode = new Html5Qrcode("modal-reader")
        html5Qrcode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (width, height) => { return { w: width * 0.7, h: height * 0.7 } }
          },
          (decodedText) => {
            if (!isMounted) return
            playBeep()
            setFormData(prev => ({ ...prev, barcode: decodedText }))
            setIsScanning(false)
          },
          () => { /* Ignore */ }
        ).then(() => {
          if (!isMounted && html5Qrcode?.isScanning) {
            html5Qrcode.stop().catch(err => console.error(err))
          }
        }).catch(err => {
          console.error("Modal scanner start error", err)
        })
      } catch (err) {
        console.error("Failed to initialize Html5Qrcode", err)
      }
    }, 100)

    return () => {
      isMounted = false
      clearTimeout(timer)
      if (html5Qrcode && html5Qrcode.isScanning) {
        html5Qrcode.stop().catch(err => console.error(err))
      }
    }
  }, [isScanning])

  // Load existing product details if editing
  useEffect(() => {
    if (product) {
      const isCustomCat = !DEFAULT_CATEGORIES.includes(product?.category || '')
      setFormData({
        name: product?.name || '',
        sku: product?.sku || '',
        barcode: product?.barcode || '',
        category: isCustomCat ? 'Custom' : (product?.category || 'Bakery'),
        customCategory: isCustomCat ? (product?.category || '') : '',
        costPrice: product?.costPrice ? String(product.costPrice) : '',
        sellingPrice: product?.sellingPrice ? String(product.sellingPrice) : '',
        quantityInStock: product?.quantityInStock !== undefined ? String(product.quantityInStock) : '',
        lowStockThreshold: product?.lowStockThreshold !== undefined ? String(product.lowStockThreshold) : '10',
        expiryDate: product?.expiryDate ? new Date(product.expiryDate).toISOString().split('T')[0] : '',
        supplierId: product?.supplier?.supplierId || ''
      })
    } else {
      // Default to first supplier if available for new products
      if (suppliers && suppliers.length > 0) {
        setFormData(prev => ({ ...prev, supplierId: suppliers[0]._id }))
      }
    }
  }, [product, suppliers])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Formations
    const activeCategory = formData.category === 'Custom' ? formData.customCategory.trim() : formData.category
    
    // Auto-generate clean SKU if empty
    let activeSku = formData.sku.trim().toUpperCase()
    if (!activeSku) {
      const categoryAbbr = activeCategory.substring(0, 3).toUpperCase()
      const randomPart = Math.floor(1000 + Math.random() * 9000)
      activeSku = `${categoryAbbr}-${randomPart}`
    }

    const payload = {
      name: formData.name.trim(),
      sku: activeSku,
      barcode: formData.barcode.trim() || undefined,
      category: activeCategory || 'Uncategorised',
      costPrice: Number(formData.costPrice),
      sellingPrice: Number(formData.sellingPrice),
      quantityInStock: Number(formData.quantityInStock),
      lowStockThreshold: Number(formData.lowStockThreshold),
      expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : undefined,
      supplier: {
        supplierId: formData.supplierId
      }
    }

    try {
      if (isEdit) {
        await api.put(`/inventory/products/${product._id}`, payload)
      } else {
        await api.post('/inventory/products', payload)
      }
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit product details.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl flex flex-col my-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">{isEdit ? 'Edit Product' : 'Add New Product'}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg transition-colors cursor-pointer p-1">
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-xl text-xs font-semibold mb-6 flex items-center gap-2">
            <span>⚠️</span>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
          {/* Product Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-400 font-semibold">Product Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Premium Chocolate Cake 1kg"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* SKU */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 font-semibold">SKU (Auto-Generated if blank)</label>
              <input
                type="text"
                placeholder="e.g. CAK-001"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 outline-none transition-colors uppercase font-mono"
              />
            </div>
            {/* Barcode */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 font-semibold">Barcode (Optional)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 5449000000099"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="flex-1 bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 outline-none transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setIsScanning(!isScanning)}
                  className={`px-3 py-2.5 text-xs font-semibold rounded-xl border transition-colors ${
                    isScanning 
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20' 
                      : 'bg-slate-900 border-slate-800 text-violet-400 hover:border-violet-500/20 hover:bg-violet-600/10'
                  }`}
                >
                  {isScanning ? 'Stop' : 'Scan'}
                </button>
              </div>
            </div>
          </div>

          {/* Barcode Scanner Cam Feed */}
          {isScanning && (
            <div className="flex flex-col items-center gap-2 p-3 bg-slate-900 border border-slate-800/80 rounded-2xl relative overflow-hidden">
              <p className="text-[10px] text-slate-500">Align the barcode inside the scanning box</p>
              <div id="modal-reader" className="w-full max-w-[250px] aspect-square rounded-xl overflow-hidden bg-slate-950 border border-slate-800"></div>
              
              <style>{`
                #modal-reader video { object-fit: cover; width: 100% !important; height: 100% !important; }
              `}</style>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Category selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 font-semibold">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-slate-200 outline-none transition-colors cursor-pointer"
              >
                {DEFAULT_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="Custom">Custom...</option>
              </select>
            </div>
            
            {/* Supplier selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 font-semibold">Supplier *</label>
              <select
                value={formData.supplierId}
                required
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                className="bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-slate-200 outline-none transition-colors cursor-pointer"
              >
                {suppliers.length === 0 ? (
                  <option value="" disabled>No suppliers found</option>
                ) : (
                  suppliers.map(s => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Custom category input */}
          {formData.category === 'Custom' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 font-semibold">Enter Custom Category *</label>
              <input
                type="text"
                required
                placeholder="e.g. Special Pastries"
                value={formData.customCategory}
                onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                className="bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 outline-none transition-colors"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Cost Price */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 font-semibold">Cost Price (LKR) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="Cost price"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                className="bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 outline-none transition-colors"
              />
            </div>
            {/* Selling Price */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 font-semibold">Selling Price (LKR) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="Selling price"
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                className="bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 outline-none transition-colors font-semibold text-violet-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Current Stock */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 font-semibold">Current Stock Count *</label>
              <input
                type="number"
                required
                placeholder="Stock quantity"
                value={formData.quantityInStock}
                onChange={(e) => setFormData({ ...formData, quantityInStock: e.target.value })}
                className="bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 outline-none transition-colors"
              />
            </div>
            {/* Low Stock Threshold */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 font-semibold">Low Stock Threshold *</label>
              <input
                type="number"
                required
                placeholder="Alert threshold"
                value={formData.lowStockThreshold}
                onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                className="bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 outline-none transition-colors font-mono"
              />
            </div>
          </div>

          {/* Expiry Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-400 font-semibold">Expiry Date (Optional — for perishable items)</label>
            <input
              type="date"
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              className="bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-slate-200 outline-none transition-colors"
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-900">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold border border-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-violet-600/10 transition-colors"
            >
              {loading ? 'Submitting...' : isEdit ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── STOCK ADJUSTMENT MODAL ────────────────────────────────────────────── */
function StockAdjustmentModal({ product, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const [formData, setFormData] = useState({
    type: 'add',
    quantity: '',
    reason: ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      await api.post(`/inventory/products/${product._id}/adjust-stock`, formData)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to adjust stock.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Adjust Stock</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg transition-colors cursor-pointer p-1">
            ✕
          </button>
        </div>
        
        <p className="text-slate-300 text-sm mb-4">
          Adjusting stock for: <span className="font-semibold text-slate-100">{product.name}</span>
          <br/>
          <span className="text-xs text-slate-500">Current Stock: {product.quantityInStock}</span>
        </p>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-xl text-xs font-semibold mb-6 flex items-center gap-2">
            <span>⚠️</span>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-400 font-semibold">Adjustment Type *</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-slate-200 outline-none transition-colors cursor-pointer"
            >
              <option value="add">Add Stock (Restock/New Batch)</option>
              <option value="reduce">Reduce Stock (Wastage/Damaged/Expired)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-slate-400 font-semibold">Quantity *</label>
            <input
              type="number"
              min="1"
              required
              placeholder="Number of units"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-slate-400 font-semibold">Reason / Notes *</label>
            <input
              type="text"
              required
              placeholder="e.g. Baked fresh batch"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 outline-none transition-colors"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-900">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold border border-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/10 transition-colors"
            >
              {loading ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
