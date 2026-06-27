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

const SINHALA_TRANSLATIONS = {
  "Bite Rice Chicken": "බයිට් රයිස් චිකන්",
  "Bite Rice Mix": "බයිට් රයිස් මික්ස්",
  "Bite Rice Seafood": "බයිට් රයිස් සීෆුඩ්",
  "Cheese Kottu Chicken": "චීස් කොත්තු චිකන්",
  "Cheese Kottu Egg": "චීස් කොත්තු බිත්තර",
  "Cheese Kottu Vegetable": "චීස් කොත්තු එළවළු",
  "Chicken Dolphin Kottu": "චිකන් ඩොල්ෆින් කොත්තු",
  "Chicken Fried Rice": "චිකන් ෆ්රයිඩ් රයිස්"
}

function getProductName(name) {
  return SINHALA_TRANSLATIONS[name] || name;
}

const GLOBAL_FALLBACK = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80'

function getFallbackImage(name = '', category = '') {
  const n = name.toLowerCase()
  const c = category.toLowerCase()
  
  if (n.includes('kottu') || n.includes('dolphin') || c.includes('kottu') || c.includes('dolphin')) {
    return 'https://images.unsplash.com/photo-1694665103603-6e3e0ef9a37a?w=400&q=80'
  }
  if (n.includes('rice') || n.includes('biryani') || n.includes('chopsuey') || c.includes('rice') || c.includes('biryani') || c.includes('chopsuey')) {
    return 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=80'
  }
  if (n.includes('noodles') || n.includes('pasta') || c.includes('noodles') || c.includes('pasta')) {
    return 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&q=80'
  }
  if (
    n.includes('bakery') || n.includes('bread') || n.includes('bun') || n.includes('roll') || n.includes('pan') ||
    c.includes('bakery') || c.includes('bread') || c.includes('bun') || c.includes('roll') || c.includes('pan')
  ) {
    return 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80'
  }
  if (n.includes('cake') || n.includes('pastry') || n.includes('cupcake') || c.includes('cake') || c.includes('pastry') || c.includes('cupcake')) {
    return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80'
  }
  if (
    n.includes('drinks') || n.includes('bima') || n.includes('juice') || n.includes('coffee') || n.includes('tea') || n.includes('soda') ||
    c.includes('drinks') || c.includes('bima') || c.includes('juice') || c.includes('coffee') || c.includes('tea') || c.includes('soda')
  ) {
    return 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400&q=80'
  }
  return GLOBAL_FALLBACK
}

function ProductCard({ product, onAdd }) {
  const isOutOfStock = product.quantityInStock <= 0
  const isLowStock   = !isOutOfStock && product.quantityInStock <= product.lowStockThreshold
  const gradient     = CARD_GRADIENTS[product.name.charCodeAt(0) % CARD_GRADIENTS.length]
  const placeholderImage = getFallbackImage(product.name, product.category)
  const imageSrc = product.imageUrl || placeholderImage
  const displayName = getProductName(product.name)

  return (
    <button
      onClick={() => !isOutOfStock && onAdd(product)}
      disabled={isOutOfStock}
      className={`
        group relative flex flex-col items-stretch rounded-2xl border text-center
        transition-all duration-200 overflow-hidden h-full
        focus:outline-none focus:ring-2 focus:ring-violet-500/50
        ${isOutOfStock
          ? 'opacity-40 cursor-not-allowed border-slate-800 bg-slate-900/40'
          : 'border-slate-700/40 bg-slate-900/60 hover:border-violet-500/40 hover:bg-slate-900 hover:-translate-y-1 active:translate-y-0 cursor-pointer shadow-sm hover:shadow-violet-900/20 hover:shadow-lg'}
      `}
    >
      {/* Product Image Header */}
      <div className="relative w-full h-24 sm:h-28 overflow-hidden bg-slate-950 flex-shrink-0">
        <img
          src={imageSrc}
          alt={displayName}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = GLOBAL_FALLBACK;
          }}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {/* Stock overlays */}
        {isLowStock && (
          <span className="absolute top-1.5 left-1.5 badge-amber text-[8px] px-1 py-0.5 shadow-md">Low</span>
        )}
        {isOutOfStock && (
          <span className="absolute top-1.5 left-1.5 badge-red text-[8px] px-1 py-0.5 shadow-md">Out</span>
        )}
      </div>

      {/* Dark high-contrast footer pad */}
      <div className="relative z-10 flex flex-col justify-between items-center flex-1 gap-1 p-2 bg-slate-950/90 border-t border-slate-800 w-full min-h-[4.5rem]">
        {/* Gradient overlay inside footer on hover */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />

        {/* Product name (supports Sinhala Unicode cleanly with break-words) */}
        <p className="relative z-10 font-bold text-slate-100 text-xs sm:text-sm leading-snug line-clamp-2 w-full break-words">
          {displayName}
        </p>

        {/* Price */}
        <p className="relative z-10 text-sm sm:text-base font-black text-violet-400 mt-auto w-full">
          Rs. {product.sellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    </button>
  )
}

/* ── Skeleton card ────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden flex flex-col items-stretch animate-pulse">
      {/* Image skeleton */}
      <div className="w-full h-24 sm:h-28 bg-slate-800" />
      {/* Footer skeleton */}
      <div className="p-2 bg-slate-950/95 space-y-2 flex flex-col items-center justify-center min-h-[4.5rem]">
        <div className="skeleton h-3.5 w-3/4 rounded-full" />
        <div className="skeleton h-4 w-1/2 rounded mt-auto" />
      </div>
    </div>
  )
}

/* ── Main Component ────────────────────────────────────────────────────── */
const POS_CATEGORIES = [
  { id: 'All', icon: '🍱', label: 'All Items' },
  { id: 'RICE', icon: '🍚', label: 'Rice' },
  { id: 'KOTTU', icon: '🍛', label: 'Kottu' },
  { id: 'NOODLES', icon: '🍜', label: 'Noodles' },
  { id: 'BAKERY', icon: '🥐', label: 'Bakery' },
  { id: 'BREAD', icon: '🍞', label: 'Bread' },
  { id: 'CAKES', icon: '🍰', label: 'Cakes' },
  { id: 'MEALS', icon: '🥘', label: 'Meals' },
  { id: 'HOT_DRINKS', icon: '☕', label: 'Drinks' }
]

export default function ProductGrid({ onAddToCart }) {
  const [products,       setProducts]       = useState([])
  const [categories,     setCategories]     = useState(POS_CATEGORIES)
  const [activeCategory, setActiveCategory] = useState('All')
  const [search,         setSearch]         = useState('')
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const searchRef = useRef(null)

  // Smart Sorting: Frequency tracking
  const [clickFreq, setClickFreq] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pos_item_freq')) || {}
    } catch {
      return {}
    }
  })

  const handleProductClick = useCallback((product) => {
    onAddToCart(product)
    setClickFreq(prev => {
      const newFreq = { ...prev, [product._id]: (prev[product._id] || 0) + 1 }
      localStorage.setItem('pos_item_freq', JSON.stringify(newFreq))
      return newFreq
    })
  }, [onAddToCart])

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
        handleProductClick(match)
        setSearch('')
        return
      }
      // Try exact SKU
      match = await db.products.where('sku').equals(query.toUpperCase()).first()
      if (match) {
        handleProductClick(match)
        setSearch('')
      }
      return
    }

    // Try exact barcode lookup first
    try {
      const { data } = await api.get(`/inventory/products/barcode/${encodeURIComponent(query)}`)
      handleProductClick(data.data)
      setSearch('')
      return
    } catch { /* not found by barcode, fall through */ }

    // Try exact SKU lookup
    try {
      const { data } = await api.get(`/inventory/products/sku/${encodeURIComponent(query.toUpperCase())}`)
      handleProductClick(data.data)
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

      {/* ── Category Tiles ────────────────────────────────────────── */}
      <div className="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-none flex-shrink-0 snap-x">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`
              flex-shrink-0 w-[96px] h-[96px] flex flex-col items-center justify-center gap-2 rounded-3xl
              border transition-all duration-200 snap-center
              focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer
              ${activeCategory === cat.id
                ? 'bg-gradient-to-b from-violet-500 to-violet-700 border-violet-400/50 text-white shadow-lg shadow-violet-900/40 scale-105'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white hover:border-violet-500/30 hover:bg-slate-800'}
            `}
          >
            <span className={`text-3xl drop-shadow-md transition-transform duration-200 ${activeCategory === cat.id ? 'scale-110' : 'grayscale-[20%]'}`}>
              {cat.icon}
            </span>
            <span className="text-xs font-bold tracking-wide uppercase">
              {cat.label}
            </span>
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
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-10 gap-2">
            {Array.from({ length: 20 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-2">
            <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-10 gap-2 pb-4">
            {[...products].sort((a, b) => {
              const freqA = clickFreq[a._id] || 0;
              const freqB = clickFreq[b._id] || 0;
              if (freqA !== freqB) return freqB - freqA;
              return a.name.localeCompare(b.name);
            }).map((p) => (
              <ProductCard key={p._id} product={p} onAdd={handleProductClick} />
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
