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
import { usePos } from '../context/PosContext'
import CashDrawerModal from '../components/pos/CashDrawerModal'
import CreditLedgerModal from '../components/pos/CreditLedgerModal'

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
    case 'RECALL': {
      return computeTotals(action.payload.items, action.payload.promoDiscount)
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
  const { 
    openingFloat, 
    totalCashSalesToday, 
    totalCreditSalesToday,
    totalCashInToday,
    totalCashOutToday,
    showFloatModal, 
    recordOpeningFloatAndBakery,
    bakeryProducts,
    bakeryTracking,
    fetchCashSummary,
    heldCartsList,
    activeCustomer,
    setActiveCustomer,
    holdCurrentCart,
    recallHeldCart
  } = usePos()

  const [cart, dispatch] = useReducer(cartReducer, INITIAL_CART)
  const [isCheckoutOpen,  setIsCheckoutOpen]  = useState(false)
  const [showCreditLedger, setShowCreditLedger] = useState(false)
  const [isCashDrawerOpen, setIsCashDrawerOpen] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [gridResetKey, setGridResetKey] = useState(0)

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [floatVal, setFloatVal] = useState('5000.00')
  const [floatSubmitLoading, setFloatSubmitLoading] = useState(false)
  const [floatSubmitError, setFloatSubmitError] = useState(null)
  const [initBakeryQtys, setInitBakeryQtys] = useState({})


  // Micro flow ledger states
  const [microFlowType, setMicroFlowType] = useState(null) // 'payin' or 'payout'
  const [microAmount, setMicroAmount] = useState('')
  const [microReason, setMicroReason] = useState('')
  const [microSubmitting, setMicroSubmitting] = useState(false)
  const [microError, setMicroError] = useState(null)

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
    if (!product) return
    dispatch({
      type: 'ADD',
      payload: {
        productId: product?._id,
        name:      product?.name || 'Unnamed Item',
        sku:       product?.sku || 'N/A',
        barcode:   product?.barcode || '',
        unitPrice: product?.sellingPrice || 0,
        taxRate:   product?.taxRate || 0,
        quantityInStock: product?.quantityInStock || 0,
        category:  product?.category || '',
      },
    })
  }, [])

  const handleQtyChange     = useCallback((pid, qty) => dispatch({ type: 'SET_QTY',     productId: pid, qty }),     [])
  const handleDiscountChange = useCallback((pid, d)  => dispatch({ type: 'SET_DISCOUNT', productId: pid, discount: d }), [])
  const handleRemove        = useCallback((pid)       => dispatch({ type: 'REMOVE',      productId: pid }),          [])
  const handleClear         = useCallback(()          => dispatch({ type: 'CLEAR' }),                                [])

  // ── Checkout ───────────────────────────────────────────────────────────
  const handleCheckout = async ({ paymentMethod, amountPaid, referenceNumber, customerName, invoiceId, orderNo, splitCashAmount, splitCardAmount, orderChannel }) => {
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
        customerName: customerName || undefined,
        promoDiscount: cart.promoDiscount,
        offlineRef: invoiceId || uuidv4(),
        orderNo: orderNo,
        splitCashAmount: splitCashAmount || undefined,
        splitCardAmount: splitCardAmount || undefined,
        orderChannel: orderChannel || 'TAKE AWAY',
      }

      try {
        if (isOnline) {
          // ── Online path: POST to API ──────────────────────────────────
          await api.post('/billing/invoices', invoicePayload)
        } else {
          throw new Error('Offline mode active')
        }
      } catch (err) {
        console.warn('[PosPage] Network request failed. Falling back to c_cafe_local_db offline_sales_queue...', err)
        const { writeToStore } = await import('../utils/localDb')
        await writeToStore('offline_sales_queue', {
          ...invoicePayload,
          createdAt: new Date().toISOString(),
          syncStatus: 'pending'
        })
      }

      // DO NOT clear cart here. Wait for onSuccessReset to clear the cart
      // so the success modal can display the correct receipt payload.
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: Product catalog ────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-5 gap-4">

        {/* Page header */}
        <div className="flex items-center justify-between flex-shrink-0 relative py-1 border-b border-slate-800/40 pb-3">
          {/* Left: greeting */}
          <div className="flex-shrink-0">
            <h1 className="text-xl font-bold text-slate-100">POS Terminal</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              Hi, {(() => {
                const name = user?.name || user?.username || 'kinship27';
                return (name.toLowerCase().includes('gayan') || name.toLowerCase().includes('chanuka') || name.toLowerCase().includes('chiran')) ? 'kinship27' : name.split(' ')[0];
              })()}
            </p>
          </div>
          
          {/* Right: Actions (strictly holds only Drawer Cash, Expected Cash, and Network Status) */}
          <div className="flex items-center gap-3">
            {/* Live Drawer Cash Widget */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800/80 px-3.5 py-1.5 rounded-full shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Drawer Cash:</span>
              <span className="text-xs font-black text-emerald-400 tabular-nums">
                Rs. {(openingFloat + totalCashSalesToday + totalCashInToday - totalCashOutToday).toFixed(2)}
              </span>
              
              {/* Micro-actions */}
              <div className="flex items-center gap-1 ml-2.5 border-l border-slate-800 pl-2">
                <button
                  onClick={() => setMicroFlowType('payin')}
                  title="Cash In (Deposit)"
                  className="w-5 h-5 flex items-center justify-center bg-emerald-500/10 text-emerald-450 hover:bg-emerald-500 hover:text-white rounded transition-all text-xs font-bold active:scale-90"
                >
                  +
                </button>
                <button
                  onClick={() => setMicroFlowType('payout')}
                  title="Cash Out (Expense)"
                  className="w-5 h-5 flex items-center justify-center bg-rose-500/10 text-rose-450 hover:bg-rose-500 hover:text-white rounded transition-all text-xs font-bold active:scale-90"
                >
                  -
                </button>
              </div>
            </div>

            {/* Expected Cash Drawer */}
            <div className="relative">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-750 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Cash Drawer</span>
                <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 font-black">
                  Expected: Rs. {(openingFloat + totalCashSalesToday).toFixed(2)}
                </span>
              </button>

              {isDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 z-50 animate-fade-in">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                      <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wide">Cash Drawer Breakdown</h4>
                      <button 
                        onClick={() => {
                          setIsDropdownOpen(false);
                          setIsCashDrawerOpen(true);
                        }}
                        className="text-[10px] text-violet-400 hover:text-violet-300 font-bold hover:underline"
                      >
                        Manage Drawer →
                      </button>
                    </div>
                    <div className="space-y-2.5 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Opening Float:</span>
                        <span className="font-bold text-slate-200">Rs. {openingFloat.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Cash Sales (Today):</span>
                        <span className="font-bold text-emerald-400 font-black">Rs. {totalCashSalesToday.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Credit Sales (ණය):</span>
                        <span className="font-bold text-violet-400 font-black">Rs. {totalCreditSalesToday.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-slate-100">
                        <span>Total Expected Cash:</span>
                        <span className="text-emerald-300 font-black">Rs. {(openingFloat + totalCashSalesToday).toFixed(2)}</span>
                      </div>
                      
                      {/* Bakery Leftover tracking statistics */}
                      {(() => {
                        const openingBakeryValue = (bakeryTracking || []).reduce((sum, item) => sum + (Number(item?.openingQty || 0) * Number(item?.price || 0)), 0);
                        const bakerySalesValue = (bakeryTracking || []).reduce((sum, item) => sum + (Number(item?.salesQty || 0) * Number(item?.price || 0)), 0);
                        const remainingBakeryValue = Math.max(0, openingBakeryValue - bakerySalesValue);
                        const remainingBakeryItems = (bakeryTracking || []).filter(item => Number(item?.openingQty || 0) > 0);

                        return (
                          <>
                            <div className="border-t border-slate-805 my-2 pt-2 space-y-2">
                              <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Opening Bakery Value:</span>
                                <span className="font-bold text-slate-200">Rs. {openingBakeryValue.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Bakery Sales (Today):</span>
                                <span className="font-bold text-emerald-400 font-black">Rs. {bakerySalesValue.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-bold text-slate-100">
                                <span>Bakery Leftover Value:</span>
                                <span className="text-amber-400 font-black">Rs. {remainingBakeryValue.toFixed(2)}</span>
                              </div>
                            </div>
                            
                            <div className="border-t border-slate-800 pt-2">
                              <span className="font-bold text-[10px] text-slate-400 uppercase tracking-wide">Bakery Remaining Stock</span>
                              <div className="max-h-24 overflow-y-auto mt-1.5 space-y-1 pr-1 scrollbar-none">
                                {remainingBakeryItems.length === 0 ? (
                                  <p className="text-[10px] text-slate-500 italic">No bakery items initialized.</p>
                                ) : (
                                  remainingBakeryItems.map(item => {
                                    const remaining = Math.max(0, Number(item?.openingQty || 0) - Number(item?.salesQty || 0));
                                    return (
                                      <div key={item?.productId} className="flex justify-between items-center text-[10px] text-slate-400">
                                        <span className="truncate max-w-[180px]">{item?.name || 'Unnamed Item'}</span>
                                        <span className={`font-bold ${remaining === 0 ? 'text-rose-400' : 'text-slate-350'}`}>{remaining} left</span>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button 
              onClick={() => setShowCreditLedger(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              📘 ණය පොත (Ledger)
            </button>

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
          <ProductGrid key={gridResetKey} onAddToCart={handleAddToCart} />
        </div>
      </div>

      {/* ── Right: Cart panel ────────────────────────────────────────── */}
      <div className="w-72 xl:w-80 flex-shrink-0 overflow-hidden">
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
          heldCartsList={heldCartsList}
          activeCustomer={activeCustomer}
          setActiveCustomer={setActiveCustomer}
          onHold={(slot) => {
            const success = holdCurrentCart(slot, cart.items, cart.promoDiscount, activeCustomer)
            if (success !== false) {
              dispatch({ type: 'CLEAR' })
            }
          }}
          onRecall={(slot) => {
            const recalled = recallHeldCart(slot)
            if (recalled) {
              dispatch({
                type: 'RECALL',
                payload: {
                  items: recalled.items,
                  promoDiscount: recalled.promoDiscount
                }
              })
            }
          }}
        />
      </div>

      {/* ── Checkout Modal ───────────────────────────────────────────── */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onSuccessReset={() => {
          handleClear();
          setIsCheckoutOpen(false);
          setGridResetKey(prev => prev + 1);
        }}
        grandTotal={cart.grandTotal}
        subTotal={cart.subTotal}
        totalDiscount={cart.totalDiscount}
        lineItems={cart.items}
        onConfirm={handleCheckout}
        loading={checkoutLoading}
        isOnline={isOnline}
      />

      {/* Cash Drawer Modal */}
      <CashDrawerModal 
        isOpen={isCashDrawerOpen} 
        onClose={() => setIsCashDrawerOpen(false)} 
      />

      {showCreditLedger && (
        <CreditLedgerModal 
          onClose={() => setShowCreditLedger(false)} 
          onSettleSuccess={fetchCashSummary} 
        />
      )}

      {/* Opening Float & Bakery Stock Overlay Modal */}
      {showFloatModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" />
          <div className="relative bg-slate-900 border border-slate-700 w-full max-w-md p-6 rounded-2xl shadow-2xl animate-scale-in z-10">
            <h3 className="text-lg font-bold text-slate-100 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Shift Initialization
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Please record today's opening cash float and bakery stock levels to initialize the POS terminal.
            </p>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              setFloatSubmitLoading(true);
              setFloatSubmitError(null);
              try {
                await recordOpeningFloatAndBakery(floatVal, initBakeryQtys);
              } catch (err) {
                setFloatSubmitError(err.response?.data?.message || 'Failed to record initialization data.');
              } finally {
                setFloatSubmitLoading(false);
              }
            }}>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Opening Float Amount (Rs.)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={floatVal}
                  onChange={(e) => setFloatVal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-lg font-bold text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                  placeholder="5000.00"
                  autoFocus
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Daily Bakery Opening Stock</label>
                <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 p-2 space-y-2">
                  {bakeryProducts.length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic p-2">Loading bakery products...</p>
                  ) : (
                    bakeryProducts.map(p => (
                      <div key={p._id} className="flex items-center justify-between gap-2 p-1.5 bg-slate-900/50 rounded-lg border border-slate-800/40">
                        <span className="text-xs text-slate-300 truncate max-w-[200px]" title={p.name}>
                          {p.name}
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={initBakeryQtys[p._id] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInitBakeryQtys(prev => ({ ...prev, [p._id]: val }));
                          }}
                          placeholder="0"
                          className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-right font-bold text-slate-200 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {floatSubmitError && (
                <p className="text-xs text-rose-400 font-medium mb-3">{floatSubmitError}</p>
              )}

              <button
                type="submit"
                disabled={floatSubmitLoading}
                className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-violet-900/30 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {floatSubmitLoading ? 'Saving...' : 'Start Shift'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Dynamic Impromptu Petty Cash Modal Ledger */}
      {microFlowType && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" onClick={() => setMicroFlowType(null)} />
          <div className="relative bg-slate-900 border border-slate-750 w-full max-w-sm p-5 rounded-2xl shadow-2xl animate-scale-in z-10">
            <h3 className="text-sm font-bold text-slate-100 mb-3 uppercase tracking-wider flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${microFlowType === 'payin' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              Record Cash {microFlowType === 'payin' ? 'In (Pay-in)' : 'Out (Payout)'}
            </h3>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!microAmount || !microReason) return;
              setMicroSubmitting(true);
              setMicroError(null);
              try {
                await api.post('/billing/cash', {
                  amount: Number(microAmount),
                  reason: microReason,
                  type: microFlowType
                });
                await fetchCashSummary(); // Refresh the context values automatically
                setMicroAmount('');
                setMicroReason('');
                setMicroFlowType(null);
              } catch (err) {
                setMicroError(err.response?.data?.message || 'Failed to record transaction.');
              } finally {
                setMicroSubmitting(false);
              }
            }}>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Amount (Rs.)</label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={microAmount}
                    onChange={(e) => setMicroAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-bold text-slate-200 focus:outline-none focus:border-violet-500"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Reason / Description</label>
                  <input
                    type="text"
                    required
                    value={microReason}
                    onChange={(e) => setMicroReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
                    placeholder={microFlowType === 'payin' ? 'e.g. Added extra loose coins' : 'e.g. Bought raw ingredients'}
                  />
                </div>
              </div>

              {microError && <p className="text-xs text-rose-400 mb-3">{microError}</p>}

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setMicroFlowType(null)}
                  disabled={microSubmitting}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-350 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={microSubmitting || !microAmount || !microReason}
                  className={`flex-1 py-2 text-white font-bold rounded-xl text-xs transition-colors shadow-lg ${microFlowType === 'payin' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/20' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/20'}`}
                >
                  {microSubmitting ? 'Logging...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
