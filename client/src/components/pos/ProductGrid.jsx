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

import { useState, useEffect, useRef, useCallback, memo } from 'react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { usePos } from '../../context/PosContext'

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
  
  if (
    n.includes('kottu') || n.includes('dolphin') || n.includes('srilankan-food') || n.includes('fried-rice-chicken') ||
    c.includes('kottu') || c.includes('dolphin') || c.includes('srilankan-food') || c.includes('fried-rice-chicken')
  ) {
    return 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&q=80'
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
  if (
    n.includes('buffet') || n.includes('curry') || n.includes('feast') || n.includes('meal') ||
    c.includes('meals') || c.includes('buffet') || c.includes('curry') || c.includes('feast')
  ) {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80'
  }
  if (
    n.includes('cigarette') || n.includes('dunhill') ||
    c.includes('cigarettes') || c.includes('cigarette')
  ) {
    return 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=400&q=80'
  }
  return GLOBAL_FALLBACK
}

const ProductCard = memo(function ProductCard({ product, onAdd }) {
  const stockVal = product?.stock !== undefined 
    ? product.stock 
    : (product?.quantityInStock !== undefined 
        ? product.quantityInStock 
        : (product?.quantity !== undefined ? product.quantity : 0));
        
  const isOutOfStock = stockVal <= 0
  const isLowStock   = stockVal > 0 && stockVal <= 5
  const nameCode = product?.name ? product.name.charCodeAt(0) : 0
  const gradient     = CARD_GRADIENTS[nameCode % CARD_GRADIENTS.length]
  const displayName = getProductName(product?.name || '')

  return (
    <button
      onClick={() => !isOutOfStock && onAdd(product)}
      disabled={isOutOfStock}
      className={`
        group relative flex flex-col justify-center items-center rounded-2xl border px-3 py-4 h-24 text-center
        transition-all duration-200 overflow-hidden
        focus:outline-none focus:ring-2 focus:ring-violet-500/50
        ${isOutOfStock
          ? 'opacity-60 cursor-not-allowed border-slate-900 bg-slate-950'
          : 'border-slate-700/40 bg-slate-900/60 hover:border-violet-500/40 hover:bg-slate-900 hover:-translate-y-1 active:translate-y-0 cursor-pointer shadow-sm hover:shadow-violet-900/20 hover:shadow-lg'}
      `}
    >
      {/* Gradient overlay inside button on hover */}
      {!isOutOfStock && (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
      )}

      {/* Pulsing Low Stock badge */}
      {isLowStock && (
        <span className="absolute top-1 right-1 bg-red-600 text-white font-black text-[7px] px-1 py-0.5 rounded shadow-lg animate-pulse z-20 uppercase tracking-tighter">
          LOW STOCK: {stockVal} LEFT
        </span>
      )}

      {/* Out of Stock overlay */}
      {isOutOfStock && (
        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center z-20 text-center p-1 rounded-2xl">
          <span className="text-red-500 font-extrabold text-[10px] tracking-wide uppercase">OUT OF STOCK</span>
          <span className="text-red-400 font-bold text-[8px] mt-0.5">අවසන් වී ඇත</span>
        </div>
      )}

      {/* Product name (supports Sinhala Unicode cleanly) */}
      <p className="relative z-10 text-base font-bold text-slate-100 dark:text-slate-100 leading-snug line-clamp-1 w-full break-words">
        {displayName}
      </p>

      {/* Price */}
      <p className="relative z-10 text-sm font-black text-violet-400 mt-1 w-full">
        Rs. {(product?.sellingPrice || 0).toFixed(2)}
      </p>
    </button>
  )
})

/* ── Skeleton card ────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-3 py-4 h-24 flex flex-col justify-center items-center animate-pulse">
      <div className="skeleton h-3 w-3/4 rounded" />
      <div className="skeleton h-3.5 w-1/2 rounded mt-2" />
    </div>
  )
}

const CATEGORY_IMAGES = {
  All: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80',
  RICE: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=80',
  KOTTU: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&q=80',
  NOODLES: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&q=80',
  BAKERY: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80',
  BREAD: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80',
  CAKES: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80',
  MEALS: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80',
  HOT_DRINKS: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400&q=80',
  CIGARETTES: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=400&q=80'
}

const CATEGORY_SINHALA = {
  All: 'සියලුම අයිතම',
  RICE: 'සහල්',
  KOTTU: 'කොත්තු',
  NOODLES: 'නූඩ්ල්ස්',
  BAKERY: 'බේකරි',
  BREAD: 'පාන්',
  CAKES: 'කේක්',
  MEALS: 'ආහාර',
  HOT_DRINKS: 'බීම',
  CIGARETTES: 'සිගරට්'
}

const CATEGORY_BG_COLORS = {
  All: 'bg-[#f4f2ee]',
  RICE: 'bg-[#f9f5eb]',
  KOTTU: 'bg-[#f3ebf9]',
  NOODLES: 'bg-[#f1f6eb]',
  BAKERY: 'bg-[#fbf2eb]',
  BREAD: 'bg-[#f7ece1]',
  CAKES: 'bg-[#f9ebec]',
  MEALS: 'bg-[#ebf5ee]',
  HOT_DRINKS: 'bg-[#ebf4f6]',
  CIGARETTES: 'bg-[#f1f3f5]'
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
  { id: 'HOT_DRINKS', icon: '☕', label: 'Drinks' },
  { id: 'CIGARETTES', icon: '🚬', label: 'Cigarettes' }
]

export default function ProductGrid({ onAddToCart }) {
  const { user } = useAuth()
  const { setShowFloatModal, setOpeningFloat } = usePos()
  const [viewLevel, setViewLevel] = useState('categories')
  const [products,       setProducts]       = useState([])
  const [categories,     setCategories]     = useState(POS_CATEGORIES)
  const [activeCategory, setActiveCategory] = useState('All')
  const [search,         setSearch]         = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const searchRef = useRef(null)

  const handleProductClick = useCallback((product) => {
    onAddToCart(product)
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
        const { readFromStore } = await import('../../utils/localDb')
        let allItems = await readFromStore('products_cache')
        if (category && category !== 'All') {
          allItems = allItems.filter(p => p.category?.toLowerCase() === category.toLowerCase())
        }
        if (q) {
          const lowerQ = q.toLowerCase()
          allItems = allItems.filter(p => 
            (p.name || '').toLowerCase().includes(lowerQ) || 
            (p.sku && p.sku.toLowerCase().includes(lowerQ)) ||
            (p.barcode && p.barcode.includes(q))
          )
        }
        items = allItems.slice(0, 60)
      } else {
        try {
          const params = { limit: 100 } // increase to 100 to show more grid items
          if (q)        params.search   = q
          if (category && category !== 'All') params.category = category
          const { data } = await api.get('/inventory/products', { params })
          items = data.data || []
        } catch (netErr) {
          console.warn('[ProductGrid] Network fetch failed, falling back to products_cache', netErr)
          const { readFromStore } = await import('../../utils/localDb')
          let allItems = await readFromStore('products_cache')
          if (category && category !== 'All') {
            allItems = allItems.filter(p => p.category?.toLowerCase() === category.toLowerCase())
          }
          if (q) {
            const lowerQ = q.toLowerCase()
            allItems = allItems.filter(p => 
              (p.name || '').toLowerCase().includes(lowerQ) || 
              (p.sku && p.sku.toLowerCase().includes(lowerQ)) ||
              (p.barcode && p.barcode.includes(q))
            )
          }
          items = allItems.slice(0, 60)
        }
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

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
    }, 200)
    return () => clearTimeout(handler)
  }, [search])

  useEffect(() => {
    fetchProducts(debouncedSearch, activeCategory)
  }, [debouncedSearch, activeCategory, fetchProducts])

  // Handle barcode / SKU scan: lookup exact match, add to cart immediately
  const handleSearchKeyDown = async (e) => {
    if (e.key !== 'Enter') return
    const query = search.trim()
    if (!query) return

    if (!navigator.onLine) {
      try {
        const { readFromStore } = await import('../../utils/localDb')
        const allItems = await readFromStore('products_cache')
        let match = allItems.find(p => p.barcode === query)
        if (match) {
          handleProductClick(match)
          setSearch('')
          return
        }
        match = allItems.find(p => p.sku && p.sku.toUpperCase() === query.toUpperCase())
        if (match) {
          handleProductClick(match)
          setSearch('')
        }
      } catch (dbErr) {
        console.error('[ProductGrid] Offline barcode/SKU search failed:', dbErr)
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
          onChange={(e) => {
            setSearch(e.target.value)
            if (e.target.value) {
              setViewLevel('products')
            }
          }}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search name, SKU, or scan barcode — press Enter to add"
          className="input-field pl-10 pr-4 text-sm h-11"
          autoComplete="off"
          spellCheck={false}
          id="pos-search"
        />
        {search && (
          <button
            onClick={() => {
              setSearch('')
              setViewLevel('categories')
              searchRef.current?.focus()
            }}
            className="absolute inset-y-0 right-3.5 flex items-center text-slate-500 hover:text-slate-300"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Category Tiles ────────────────────────────────────────── */}
      {viewLevel === 'products' && (
        <div className="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-none flex-shrink-0 snap-x">
          {categories.map((cat) => (
            <button
              key={cat?.id}
              onClick={() => setActiveCategory(cat?.id)}
              className={`
                flex-shrink-0 w-[96px] h-[96px] flex flex-col items-center justify-center gap-2 rounded-3xl
                border transition-all duration-200 snap-center
                focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer
                ${activeCategory === cat?.id
                  ? 'bg-gradient-to-b from-violet-500 to-violet-700 border-violet-400/50 text-white shadow-lg shadow-violet-900/40 scale-105'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white hover:border-violet-500/30 hover:bg-slate-800'}
              `}
            >
              <span className={`text-3xl drop-shadow-md transition-transform duration-200 ${activeCategory === cat?.id ? 'scale-110' : 'grayscale-[20%]'}`}>
                {cat?.icon}
              </span>
              <span className="text-xs font-bold tracking-wide uppercase">
                {cat?.label}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Grid Area ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pr-1">
        {viewLevel === 'categories' ? (
          /* Level 1: Visual Category Directory */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-4 animate-fade-up">
            {categories.map((cat) => (
              <button
                key={cat?.id}
                onClick={() => {
                  setActiveCategory(cat?.id)
                  setViewLevel('products')
                }}
                className={`
                  group relative flex flex-col items-stretch rounded-2xl text-center
                  overflow-hidden h-full cursor-pointer
                  shadow-sm hover:shadow-md transition-shadow duration-200 hover:-translate-y-1 active:translate-y-0
                  ${CATEGORY_BG_COLORS[cat?.id] || 'bg-[#f4f2ee]'}
                `}
              >
                {/* Category Image */}
                <div className="relative w-full h-36 overflow-hidden rounded-t-2xl flex-shrink-0">
                  <img
                    src={CATEGORY_IMAGES[cat?.id]}
                    alt={cat?.label}
                    className="w-full h-36 object-cover rounded-t-2xl transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                {/* Category Text (Sinhala & English) */}
                <div className="relative z-10 flex flex-col justify-center items-center flex-1 gap-1 py-4 px-2 text-center w-full">
                  <p className="font-bold text-slate-900 text-sm leading-snug w-full">
                    {CATEGORY_SINHALA[cat?.id]}
                  </p>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    {cat?.label}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* Level 2: Sub-items grid */
          <>
            {error && (
              <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-2">
                <p className="text-sm">{error}</p>
                <button onClick={() => fetchProducts()} className="btn-secondary text-xs py-1.5 px-3">Retry</button>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-2 flex flex-col items-center justify-center h-24 animate-pulse">
                  <div className="text-xl mb-0.5">⬅️</div>
                  <div className="skeleton h-2 w-3/4 rounded" />
                </div>
                {Array.from({ length: 19 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 pt-10">
                <button
                  onClick={() => setViewLevel('categories')}
                  className="btn-secondary py-3 px-6 text-sm font-bold rounded-xl border border-slate-700/60 hover:bg-slate-800 text-slate-200 flex items-center gap-2"
                >
                  ⬅️ Back to Categories
                </button>
                <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-2">
                  <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-sm">No products found</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-2 pb-4">
                {/* Back button chip inside product grid */}
                <button
                  onClick={() => setViewLevel('categories')}
                  className="group relative flex flex-col items-center justify-center rounded-2xl border p-2 text-center transition-all duration-200 h-24 border-violet-500/40 bg-violet-600/10 hover:bg-violet-600 text-violet-400 hover:text-white cursor-pointer shadow-sm"
                >
                  <div className="text-xl mb-0.5 group-hover:scale-110 transition-transform">⬅️</div>
                  <span className="text-[10px] font-bold leading-none">Back to Categories</span>
                </button>
                
                {[...products].sort((a, b) => (a?.name || '').localeCompare(b?.name || '')).map((p) => (
                  <ProductCard key={p?._id} product={p} onAdd={handleProductClick} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Product count & Master Reset ──────────────────────────── */}
      {!loading && !error && (
        <div className="flex items-center justify-between mt-1 flex-shrink-0">
          <div /> {/* Spacer */}
          <div className="flex items-center gap-3">
            <p className="text-[10px] text-slate-600 font-medium select-none">
              {products.length} product{products.length !== 1 ? 's' : ''}
              {activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
            </p>
            {(user?.role === 'admin' || user?.role === 'super_admin' || user?.role?.toLowerCase().includes('admin')) && (
              <button
                onClick={async () => {
                  const firstConfirm = window.confirm("Are you absolutely sure you want to delete all test data and reset charts for tomorrow's live launch?");
                  if (!firstConfirm) return;
                  const secondConfirm = window.confirm("WARNING: This will permanently wipe all sales history, transactions, and cash ledger records from the database. Proceed?");
                  if (!secondConfirm) return;
                  
                  try {
                    await api.post('/billing/master-reset');
                    localStorage.removeItem('isSessionInitialized');
                    localStorage.removeItem('hasSetOpeningCash');
                    localStorage.removeItem('pos_shift_bakery_tracking');
                    sessionStorage.clear();
                    setShowFloatModal(true);
                    setOpeningFloat(0);
                    alert("Master system reset completed successfully.");
                    window.location.reload(true);
                  } catch (err) {
                    alert(err?.response?.data?.message || err?.message || "An unexpected error occurred during reset.");
                  }
                }}
                className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-600/10 border border-rose-500/30 text-rose-450 hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Master Reset</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
