/**
 * @file ProductGrid.jsx
 * Left panel of the POS screen.
 * Features:
 * - Auto-focused search bar that accepts barcode / SKU / product name
 * - Category filter chips
 * - Responsive product card grid
 * - Low-stock indicator on product cards
 * - Out-of-stock dimming
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../../api/axios'

/* ── Product Card ─────────────────────────────────────────────────────── */
const CARD_GRADIENTS = [
  'from-violet-600/20 to-violet-900/5',
  'from-sky-600/20 to-sky-900/5',
  'from-emerald-600/20 to-emerald-900/5',
  'from-rose-600/20 to-rose-900/5',
  'from-amber-600/20 to-amber-900/5',
  'from-fuchsia-600/20 to-fuchsia-900/5',
]

function ProductCard({ product, onAdd }) {
  const isOutOfStock = product.quantityInStock <= 0
  const isLowStock   = !isOutOfStock && product.quantityInStock <= product.lowStockThreshold
  const gradient     = CARD_GRADIENTS[product.name.charCodeAt(0) % CARD_GRADIENTS.length]

  return (
    <button
      onClick={() => !isOutOfStock && onAdd(product)}
      disabled={isOutOfStock}
      className={`
        group relative flex flex-col rounded-2xl border p-4 text-left
        transition-all duration-200 overflow-hidden
        focus:outline-none focus:ring-2 focus:ring-violet-500/50
        ${isOutOfStock
          ? 'opacity-40 cursor-not-allowed border-slate-800 bg-slate-900/40'
          : 'border-slate-700/40 bg-slate-900/60 hover:border-violet-500/40 hover:bg-slate-900 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-sm hover:shadow-violet-900/20 hover:shadow-lg'}
      `}
    >
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full gap-2">
        {/* Category chip */}
        <span className="badge-slate self-start text-[10px]">{product.category || 'General'}</span>

        {/* Product name */}
        <p className="font-semibold text-slate-100 text-sm leading-tight line-clamp-2 flex-1">
          {product.name}
        </p>

        {/* SKU */}
        <p className="text-[10px] text-slate-500 font-mono">{product.sku}</p>

        {/* Price + stock */}
        <div className="flex items-end justify-between mt-1">
          <p className="text-base font-bold text-violet-400">
            {'Rs. ' + product.sellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {isLowStock && (
            <span className="badge-amber text-[9px]">Low</span>
          )}
          {isOutOfStock && (
            <span className="badge-red text-[9px]">Out</span>
          )}
        </div>

        {/* Quick-add overlay button */}
        {!isOutOfStock && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shadow-lg">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </button>
  )
}

/* ── Skeleton card ────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3 animate-pulse">
      <div className="skeleton h-3 w-16 rounded-full" />
      <div className="skeleton h-4 w-full rounded" />
      <div className="skeleton h-3 w-20 rounded" />
      <div className="skeleton h-5 w-24 rounded mt-auto" />
    </div>
  )
}

/* ── Main Component ────────────────────────────────────────────────────── */
const POS_CATEGORIES = [
  'All', 'RICE', 'KOTTU', 'NOODLES', 
  'BAKERY', 'BREAD', 'CAKES', 'MEALS', 'HOT_DRINKS'
]

export default function ProductGrid({ onAddToCart }) {
  const [products,       setProducts]       = useState([])
  const [categories,     setCategories]     = useState(POS_CATEGORIES)
  const [activeCategory, setActiveCategory] = useState('All')
  const [search,         setSearch]         = useState('')
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const searchRef = useRef(null)

  // Auto-focus search bar on mount (barcode scanner input target)
  useEffect(() => { searchRef.current?.focus() }, [])

  // Fetch products
  const fetchProducts = useCallback(async (q = '', category = '') => {
    setLoading(true)
    setError(null)
    try {
      let items = []
      if (!navigator.onLine) {
        const { db } = await import('../../utils/db')
        let collection = db.products
        
        if (category && category !== 'All') {
          collection = collection.where('category').equals(category)
        } else {
          collection = collection.toCollection()
        }
        
        let allItems = await collection.toArray()
        if (q) {
          const lowerQ = q.toLowerCase()
          allItems = allItems.filter(p => 
            p.name.toLowerCase().includes(lowerQ) || 
            (p.sku && p.sku.toLowerCase().includes(lowerQ)) ||
            (p.barcode && p.barcode.includes(q))
          )
        }
        items = allItems.slice(0, 60)
      } else {
        const params = { limit: 100 } // increase to 100 to show more grid items
        if (q)        params.search   = q
        if (category && category !== 'All') params.category = category
        const { data } = await api.get('/inventory/products', { params })
        items = data.data || []
      }

      setProducts(items)
      // Removed dynamic category extraction to prevent UI state bug where 
      // active filters wiped out the sibling category pills.
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load products.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProducts(search, activeCategory) }, [search, activeCategory])

  // Handle barcode / SKU scan: lookup exact match, add to cart immediately
  const handleSearchKeyDown = async (e) => {
    if (e.key !== 'Enter') return
    const query = search.trim()
    if (!query) return

    if (!navigator.onLine) {
      const { db } = await import('../../utils/db')
      // Try exact barcode
      let match = await db.products.where('barcode').equals(query).first()
      if (match) {
        onAddToCart(match)
        setSearch('')
        return
      }
      // Try exact SKU
      match = await db.products.where('sku').equals(query.toUpperCase()).first()
      if (match) {
        onAddToCart(match)
        setSearch('')
      }
      return
    }

    // Try exact barcode lookup first
    try {
      const { data } = await api.get(`/inventory/products/barcode/${encodeURIComponent(query)}`)
      onAddToCart(data.data)
      setSearch('')
      return
    } catch { /* not found by barcode, fall through */ }

    // Try exact SKU lookup
    try {
      const { data } = await api.get(`/inventory/products/sku/${encodeURIComponent(query.toUpperCase())}`)
      onAddToCart(data.data)
      setSearch('')
    } catch { /* no exact match — leave search results visible */ }
  }

  return (
    <div className="flex flex-col h-full gap-4">

      {/* ── Search bar ──────────────────────────────────────────────── */}
      <div className="relative">
        <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search name, SKU, or scan barcode — press Enter to add"
          className="input-field pl-10 pr-4 text-sm h-11"
          autoComplete="off"
          spellCheck={false}
          id="pos-search"
        />
        {search && (
          <button
            onClick={() => { setSearch(''); searchRef.current?.focus() }}
            className="absolute inset-y-0 right-3.5 flex items-center text-slate-500 hover:text-slate-300"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Category chips ────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none flex-shrink-0">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`
              flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold
              border transition-all duration-150
              ${activeCategory === cat
                ? 'bg-violet-600 border-violet-500 text-white shadow-md shadow-violet-900/40'
                : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600'}
            `}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Product grid ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pr-1">
        {error && (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-2">
            <p className="text-sm">{error}</p>
            <button onClick={() => fetchProducts()} className="btn-secondary text-xs py-1.5 px-3">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-2">
            <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 pb-4">
            {products.map((p) => (
              <ProductCard key={p._id} product={p} onAdd={onAddToCart} />
            ))}
          </div>
        )}
      </div>

      {/* ── Product count ─────────────────────────────────────────── */}
      {!loading && !error && (
        <p className="text-[10px] text-slate-600 text-right flex-shrink-0">
          {products.length} product{products.length !== 1 ? 's' : ''}
          {activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
        </p>
      )}
    </div>
  )
}
