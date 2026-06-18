/**
 * @file PosPage.jsx
 * The cashier's primary working screen.
 *
 * Layout (full-height split):
 *   LEFT  65% — ProductGrid (search + catalog)
 *   RIGHT 35% — CartPanel (items + totals + checkout)
 *
 * Cart state managed with useReducer.
 * Checkout path:
 *   - Online  → POST /api/billing/invoices
 *   - Offline → saveInvoiceOffline() (IndexedDB via offlineSync.js)
 */

import { useReducer, useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import ProductGrid    from '../components/pos/ProductGrid'
import CartPanel      from '../components/pos/CartPanel'
import CheckoutModal  from '../components/pos/CheckoutModal'
import api            from '../api/axios'
import { saveInvoiceOffline } from '../utils/offlineSync'
import { useAuth } from '../context/AuthContext'

/* ══════════════════════════════════════════════════════════════════════════
   Cart Reducer
══════════════════════════════════════════════════════════════════════════ */

/** Re-compute subTotal, totalDiscount, totalTax, grandTotal from current items */
function computeTotals(items) {
  let subTotal = 0, totalDiscount = 0, totalTax = 0
  const processed = items.map((item) => {
    const lineBase   = item.unitPrice * item.quantity
    const discAmt    = lineBase * (item.discount / 100)
    const taxAmt     = (lineBase - discAmt) * ((item.taxRate || 0) / 100)
    const lineTotal  = lineBase - discAmt + taxAmt
    subTotal      += lineBase
    totalDiscount += discAmt
    totalTax      += taxAmt
    return { ...item, lineTotal }
  })
  const grandTotal = subTotal - totalDiscount + totalTax
  return { items: processed, subTotal, totalDiscount, totalTax, grandTotal }
}

const INITIAL_CART = {
  items: [], subTotal: 0, totalDiscount: 0, totalTax: 0, grandTotal: 0,
}

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const existing = state.items.find((i) => i.productId === action.payload.productId)
      let items
      if (existing) {
        items = state.items.map((i) =>
          i.productId === action.payload.productId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      } else {
        items = [...state.items, { ...action.payload, quantity: 1, discount: 0 }]
      }
      return computeTotals(items)
    }
    case 'REMOVE': {
      const items = state.items.filter((i) => i.productId !== action.productId)
      return computeTotals(items)
    }
    case 'SET_QTY': {
      const qty = Math.max(1, action.qty)
      const items = state.items.map((i) =>
        i.productId === action.productId ? { ...i, quantity: qty } : i
      )
      return computeTotals(items)
    }
    case 'SET_DISCOUNT': {
      const discount = Math.min(100, Math.max(0, action.discount))
      const items = state.items.map((i) =>
        i.productId === action.productId ? { ...i, discount } : i
      )
      return computeTotals(items)
    }
    case 'CLEAR':
      return INITIAL_CART
    default:
      return state
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Component
══════════════════════════════════════════════════════════════════════════ */

export default function PosPage() {
  const { user } = useAuth()
  const [cart, dispatch] = useReducer(cartReducer, INITIAL_CART)
  const [isCheckoutOpen,  setIsCheckoutOpen]  = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  // Track network status
  useEffect(() => {
    const up   = () => setIsOnline(true)
    const down = () => setIsOnline(false)
    window.addEventListener('online',  up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  // ── Cart operations ────────────────────────────────────────────────────
  const handleAddToCart = useCallback((product) => {
    dispatch({
      type: 'ADD',
      payload: {
        productId: product._id,
        name:      product.name,
        sku:       product.sku,
        barcode:   product.barcode,
        unitPrice: product.sellingPrice,
        taxRate:   product.taxRate || 0,
      },
    })
  }, [])

  const handleQtyChange     = useCallback((pid, qty) => dispatch({ type: 'SET_QTY',     productId: pid, qty }),     [])
  const handleDiscountChange = useCallback((pid, d)  => dispatch({ type: 'SET_DISCOUNT', productId: pid, discount: d }), [])
  const handleRemove        = useCallback((pid)       => dispatch({ type: 'REMOVE',      productId: pid }),          [])
  const handleClear         = useCallback(()          => dispatch({ type: 'CLEAR' }),                                [])

  // ── Checkout ───────────────────────────────────────────────────────────
  const handleCheckout = async ({ paymentMethod, amountPaid, referenceNumber }) => {
    setCheckoutLoading(true)
    try {
      const lineItems = cart.items.map((item) => ({
        productId: item.productId,
        name:      item.name,
        sku:       item.sku,
        quantity:  item.quantity,
        unitPrice: item.unitPrice,
        taxRate:   item.taxRate,
        discount:  item.lineTotal - (item.unitPrice * item.quantity),
      }))

      const invoicePayload = {
        lineItems,
        paymentMethod,
        amountPaid,
        referenceNumber,
        offlineRef: uuidv4(), // always generated; used by /sync if later needed
      }

      if (isOnline) {
        // ── Online path: POST to API ──────────────────────────────────
        await api.post('/billing/invoices', invoicePayload)
      } else {
        // ── Offline path: save to IndexedDB ──────────────────────────
        await saveInvoiceOffline({
          ...invoicePayload,
          createdAt: new Date().toISOString(),
        })
      }

      dispatch({ type: 'CLEAR' })
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: Product catalog ────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-5 gap-4">

        {/* Page header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-100">POS Terminal</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Hi, {user?.name?.split(' ')[0]} — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Network indicator */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border
                ${isOnline
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              {isOnline ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>

        {/* Product grid — fills remaining space */}
        <div className="flex-1 overflow-hidden">
          <ProductGrid onAddToCart={handleAddToCart} />
        </div>
      </div>

      {/* ── Right: Cart panel ────────────────────────────────────────── */}
      <div className="w-80 xl:w-96 flex-shrink-0 overflow-hidden">
        <CartPanel
          items={cart.items}
          subTotal={cart.subTotal}
          totalDiscount={cart.totalDiscount}
          totalTax={cart.totalTax}
          grandTotal={cart.grandTotal}
          onQtyChange={handleQtyChange}
          onDiscountChange={handleDiscountChange}
          onRemove={handleRemove}
          onClear={handleClear}
          onCheckout={() => setIsCheckoutOpen(true)}
          isOnline={isOnline}
        />
      </div>

      {/* ── Checkout Modal ───────────────────────────────────────────── */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        grandTotal={cart.grandTotal}
        lineItems={cart.items}
        onConfirm={handleCheckout}
        loading={checkoutLoading}
        isOnline={isOnline}
      />
    </div>
  )
}
