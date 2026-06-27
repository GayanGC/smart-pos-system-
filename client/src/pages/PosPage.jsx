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
function computeTotals(items, promoDiscount = { type: 'percentage', value: 0 }) {
  let subTotal = 0, totalDiscount = 0, totalTax = 0
  const processed = items.map((item) => {
    let priceToUse = item.customPrice !== undefined && item.customPrice !== null && item.customPrice !== ''
      ? Number(item.customPrice)
      : item.unitPrice
      
    if (isNaN(priceToUse) || priceToUse < 0) {
      priceToUse = item.unitPrice
    }
      
    const lineBase = priceToUse * item.quantity
    
    let discAmt = 0
    if (item.flatDiscount !== undefined && item.flatDiscount !== null && item.flatDiscount !== '') {
      discAmt = Number(item.flatDiscount)
      if (isNaN(discAmt) || discAmt < 0) {
        discAmt = 0
      }
    } else {
      let discPercent = Number(item.discount) || 0
      if (isNaN(discPercent) || discPercent < 0) {
        discPercent = 0
      } else if (discPercent > 100) {
        discPercent = 100
      }
      discAmt = lineBase * (discPercent / 100)
    }
    
    // Clamp line-level discount to line total
    discAmt = Math.min(lineBase, discAmt)
    
    const taxAmt = Math.max(0, lineBase - discAmt) * ((item.taxRate || 0) / 100)
    const lineTotal = Math.max(0, lineBase - discAmt + taxAmt)
    
    subTotal      += lineBase
    totalDiscount += discAmt
    totalTax      += taxAmt
    
    return { ...item, lineTotal: parseFloat(lineTotal.toFixed(2)) }
  })

  // Calculate cart-wide discount
  let cartPromoDiscount = 0
  if (promoDiscount && promoDiscount.value > 0) {
    let val = Number(promoDiscount.value) || 0
    if (isNaN(val) || val < 0) {
      val = 0
    }
    if (promoDiscount.type === 'percentage') {
      if (val > 100) val = 100
      cartPromoDiscount = subTotal * (val / 100)
    } else if (promoDiscount.type === 'flat') {
      cartPromoDiscount = val
    }
  }

  // Clamp promo discount to remaining subTotal
  const remainingSub = Math.max(0, subTotal - totalDiscount)
  cartPromoDiscount = Math.min(remainingSub, cartPromoDiscount)

  totalDiscount += cartPromoDiscount

  subTotal      = parseFloat(subTotal.toFixed(2))
  totalDiscount = parseFloat(totalDiscount.toFixed(2))
  totalTax      = parseFloat(totalTax.toFixed(2))
  const grandTotal = Math.max(0, parseFloat((subTotal - totalDiscount + totalTax).toFixed(2)))

  return { items: processed, subTotal, totalDiscount, totalTax, grandTotal, promoDiscount }
}

const INITIAL_CART = {
  items: [], subTotal: 0, totalDiscount: 0, totalTax: 0, grandTotal: 0,
  promoDiscount: { type: 'percentage', value: 0 }
}

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const existing = state.items.find((i) => i.productId === action.payload.productId)
      let items
      if (existing) {
        const nextQty = existing.quantity + 1
        if (nextQty > action.payload.quantityInStock) {
          alert(`Cannot add more. Only ${action.payload.quantityInStock} unit(s) of "${action.payload.name}" are in stock.`)
          return state
        }
        items = state.items.map((i) =>
          i.productId === action.payload.productId
            ? { ...i, quantity: nextQty }
            : i
        )
      } else {
        if (action.payload.quantityInStock <= 0) {
          alert(`"${action.payload.name}" is out of stock.`)
          return state
        }
        items = [...state.items, { ...action.payload, quantity: 1, discount: 0 }]
      }
      return computeTotals(items, state.promoDiscount)
    }
    case 'REMOVE': {
      const items = state.items.filter((i) => i.productId !== action.productId)
      return computeTotals(items, state.promoDiscount)
    }
    case 'SET_QTY': {
      const existing = state.items.find((i) => i.productId === action.productId)
      const maxQty = existing ? existing.quantityInStock : 9999
      const qty = Math.max(1, Math.min(maxQty, action.qty))
      
      if (existing && action.qty > maxQty) {
        alert(`Cannot increase quantity. Only ${maxQty} unit(s) of "${existing.name}" are in stock.`)
      }

      const items = state.items.map((i) =>
        i.productId === action.productId ? { ...i, quantity: qty } : i
      )
      return computeTotals(items, state.promoDiscount)
    }
    case 'SET_DISCOUNT': {
      const discount = Math.min(100, Math.max(0, action.discount))
      const items = state.items.map((i) =>
        i.productId === action.productId ? { ...i, discount } : i
      )
      return computeTotals(items, state.promoDiscount)
    }
    case 'SET_ITEM_OVERRIDE': {
      const items = state.items.map((i) =>
        i.productId === action.productId
          ? { 
              ...i, 
              customPrice: action.customPrice !== '' ? Number(action.customPrice) : undefined, 
              flatDiscount: action.flatDiscount !== '' ? Number(action.flatDiscount) : undefined 
            }
          : i
      )
      return computeTotals(items, state.promoDiscount)
    }
    case 'SET_PROMO_DISCOUNT': {
      const promoDiscount = { type: action.promoType, value: action.promoValue }
      return computeTotals(state.items, promoDiscount)
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
        quantityInStock: product.quantityInStock,
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
      const lineItems = cart.items.map((item) => {
        const priceToUse = item.customPrice !== undefined && item.customPrice !== null && item.customPrice !== ''
          ? Number(item.customPrice)
          : item.unitPrice
          
        let discAmt = 0
        if (item.flatDiscount !== undefined && item.flatDiscount !== null && item.flatDiscount !== '') {
          discAmt = Number(item.flatDiscount)
        } else {
          discAmt = (priceToUse * item.quantity) * (item.discount / 100)
        }

        return {
          productId: item.productId,
          name:      item.name,
          sku:       item.sku,
          quantity:  item.quantity,
          unitPrice: priceToUse,
          taxRate:   item.taxRate,
          discount:  parseFloat(discAmt.toFixed(2)),
        }
      })

      const invoicePayload = {
        lineItems,
        paymentMethod,
        amountPaid,
        referenceNumber,
        promoDiscount: cart.promoDiscount,
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
          promoDiscount={cart.promoDiscount}
          onQtyChange={handleQtyChange}
          onDiscountChange={handleDiscountChange}
          onItemOverrideChange={(pid, customPrice, flatDiscount) => dispatch({ type: 'SET_ITEM_OVERRIDE', productId: pid, customPrice, flatDiscount })}
          onPromoDiscountChange={(promoType, promoValue) => dispatch({ type: 'SET_PROMO_DISCOUNT', promoType, promoValue })}
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
        onSuccessReset={() => {
          handleClear();
          setIsCheckoutOpen(false);
        }}
        grandTotal={cart.grandTotal}
        subTotal={cart.subTotal}
        totalDiscount={cart.totalDiscount}
        lineItems={cart.items}
        onConfirm={handleCheckout}
        loading={checkoutLoading}
        isOnline={isOnline}
      />
    </div>
  )
}
