/**
 * @file CartPanel.jsx
 * Right panel of the POS screen — displays cart items, order summary,
 * and the Checkout button. Delegates actual checkout flow to CheckoutModal.
 */

import { useState } from 'react'
import CartItem from './CartItem'

const fmt = (n) =>
  'Rs. ' + (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function CartPanel({
  items,
  subTotal,
  totalDiscount,
  totalTax,
  grandTotal,
  promoDiscount,
  onQtyChange,
  onDiscountChange,
  onItemOverrideChange,
  onPromoDiscountChange,
  onRemove,
  onClear,
  onCheckout,
  isOnline,
  heldCartsList = {},
  activeCustomer,
  setActiveCustomer,
  onHold,
  onRecall,
}) {
  const [showSlots, setShowSlots] = useState(false)
  const isEmpty = items.length === 0

  return (
    <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800/80">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-slate-800/80 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="font-semibold text-slate-200">Current Order</span>
          {items.length > 0 && (
            <span className="badge-violet text-[10px] ml-1">{items.length}</span>
          )}
        </div>
        {!isEmpty && (
          <button onClick={onClear} className="btn-ghost text-xs py-1 px-2">Clear</button>
        )}
      </div>

      {/* ── Cart items ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
            <svg className="w-16 h-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-sm font-medium">Cart is empty</p>
            <p className="text-xs">Tap a product or scan a barcode</p>
          </div>
        ) : (
          items.map((item) => (
            <CartItem
              key={`${item.productId}-${item.isKotPrinted}`}
              item={item}
              onQtyChange={onQtyChange}
              onDiscountChange={onDiscountChange}
              onItemOverrideChange={onItemOverrideChange}
              onRemove={onRemove}
            />
          ))
        )}
      </div>

      {/* ── Promo Discount Inputs ──────────────────────────────────── */}
      {!isEmpty && (
        <div className="px-5 py-3 border-t border-slate-800/80 flex-shrink-0 space-y-2 bg-slate-900/10">
          <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Apply Promo / Discount</label>
          <div className="flex gap-2">
            <select
              value={promoDiscount?.type || 'percentage'}
              onChange={(e) => onPromoDiscountChange(e.target.value, promoDiscount?.value || 0)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none cursor-pointer"
            >
              <option value="percentage">% Off</option>
              <option value="flat">LKR Off</option>
            </select>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={promoDiscount?.value ?? ''}
              onChange={(e) => onPromoDiscountChange(promoDiscount?.type || 'percentage', e.target.value !== '' ? Number(e.target.value) : 0)}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-100 font-mono outline-none focus:border-violet-500/50"
            />
          </div>
        </div>
      )}

      {/* ── Order summary ─────────────────────────────────────────── */}
      {!isEmpty && (
        <div className="border-t border-slate-800/80 px-5 py-4 flex-shrink-0 space-y-2">
          <div className="flex justify-between text-sm text-slate-400">
            <span>Subtotal</span>
            <span className="tabular-nums">{fmt(subTotal)}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between text-sm text-amber-400">
              <span>Discount</span>
              <span className="tabular-nums">− {fmt(totalDiscount)}</span>
            </div>
          )}
          {totalTax > 0 && (
            <div className="flex justify-between text-sm text-slate-400">
              <span>Tax</span>
              <span className="tabular-nums">+ {fmt(totalTax)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-slate-100 pt-2 border-t border-slate-800">
            <span>Grand Total</span>
            <span className="tabular-nums text-violet-300">{fmt(grandTotal)}</span>
          </div>
        </div>
      )}

      {/* ── Customer reference input for Hold/Recall ── */}
      {!isEmpty && (
        <div className="px-4 pb-2 flex-shrink-0">
          <input
            type="text"
            value={activeCustomer || ''}
            onChange={(e) => setActiveCustomer(e.target.value)}
            placeholder="Hold Customer Name / Ref..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all font-medium"
          />
        </div>
      )}

      {/* ── Checkout button ──────────────────────────────────────── */}
      <div className="px-4 pb-3 flex-shrink-0">
        <button
          onClick={onCheckout}
          disabled={isEmpty}
          className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2"
          id="pos-checkout-btn"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Proceed to Checkout
          {!isOnline && (
            <span className="badge-amber text-[9px] ml-1">Offline</span>
          )}
        </button>
      </div>

      {/* ── Hold / Recall Bill ── */}
      <div className="px-4 pb-5 flex-shrink-0">
        {!isEmpty && (
          <div className="mb-2">
            <button
              onClick={() => setShowSlots(!showSlots)}
              className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all duration-150 flex items-center justify-center gap-1.5 active:scale-95 shadow-lg shadow-amber-950/20 cursor-pointer"
            >
              ⏸ HOLD TO SLOT / ටේබල් එකට දාන්න {showSlots ? '▼' : '▶'}
            </button>
            {showSlots && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Uber/Delivery Slot'].map(slot => (
                  <button
                    key={slot}
                    onClick={() => { onHold(slot); setShowSlots(false); }}
                    disabled={!!heldCartsList[slot]}
                    className={`py-2 px-2 rounded-lg text-[10px] font-bold border transition-colors ${
                      heldCartsList[slot] 
                        ? 'bg-slate-800 border-slate-700 text-slate-500 opacity-50 cursor-not-allowed' 
                        : 'bg-slate-800/80 hover:bg-amber-500/20 hover:border-amber-500/50 text-slate-300 border-slate-700'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        {Object.keys(heldCartsList).length > 0 && (
          <div className="mt-3">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Recall Bill (පරණ බිල ගන්න)</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(heldCartsList).map(([slot, data]) => (
                <button
                  key={slot}
                  onClick={() => onRecall(slot)}
                  className="py-2 px-2 rounded-lg text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 transition-all duration-150 flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-950/40 animate-pulse cursor-pointer relative"
                  title={data.customer}
                >
                  <span className="text-[11px] truncate w-full text-center">{slot}</span>
                  <span className="inline-flex items-center justify-center bg-white text-emerald-700 font-black px-1.5 py-0.5 rounded-full text-[9px] shadow-sm">
                    {data.items.length} item{data.items.length !== 1 ? 's' : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
