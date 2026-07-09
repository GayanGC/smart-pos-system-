import { useState } from 'react'

const fmt = (n) =>
  'Rs. ' + (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function CartItem({ item, onQtyChange, onDiscountChange, onItemOverrideChange, onRemove }) {
  const { productId, isKotPrinted, name, sku, unitPrice, quantity, discount, lineTotal } = item
  const [showOverrides, setShowOverrides] = useState(false)

  return (
    <div className="group flex flex-col gap-2 p-3 rounded-xl border border-slate-800/80 bg-slate-900/50 hover:border-slate-700/60 transition-all duration-150 animate-fade-up">

      {/* ── Top row: name + remove ──────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-slate-100 leading-snug line-clamp-1">{name}</span>
            {isKotPrinted && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                🍳 SENT TO KITCHEN
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            {sku} · {item.customPrice ? `${fmt(item.customPrice)} (orig: ${fmt(unitPrice)})` : fmt(unitPrice)} ea.
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          <button
            onClick={() => setShowOverrides(!showOverrides)}
            className={`w-6 h-6 rounded-md flex items-center justify-center transition-all duration-150 ${
              showOverrides ? 'text-violet-400 bg-violet-500/10' : 'text-slate-600 hover:text-violet-400 hover:bg-violet-500/10'
            }`}
            title="Item Overrides"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onRemove(productId, isKotPrinted)}
            className="flex-shrink-0 w-6 h-6 rounded-md text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-all duration-150"
            title="Remove item"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Bottom row: qty controls + discount + total ─────────────── */}
      <div className="flex items-center gap-2">
        {/* Quantity stepper */}
        <div className="flex items-center bg-slate-800/80 rounded-lg border border-slate-700/50 overflow-hidden">
          <button
            onClick={() => onQtyChange(productId, quantity - 1, isKotPrinted)}
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
            aria-label="Decrease quantity"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>
          <span className="w-8 text-center text-sm font-bold text-slate-100 tabular-nums select-none">
            {quantity}
          </span>
          <button
            onClick={() => onQtyChange(productId, quantity + 1, isKotPrinted)}
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
            aria-label="Increase quantity"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Discount input (Percentage) */}
        {!item.flatDiscount && (
          <div className="flex items-center bg-slate-800/80 rounded-lg border border-slate-700/50 overflow-hidden">
            <span className="text-[10px] text-slate-500 pl-2 font-medium">Disc.</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={discount}
              onChange={(e) => onDiscountChange(productId, Number(e.target.value), isKotPrinted)}
              className="w-12 bg-transparent text-center text-xs font-semibold text-amber-400 py-1.5 px-1 focus:outline-none"
              aria-label="Discount percentage"
            />
            <span className="text-[10px] text-slate-500 pr-2">%</span>
          </div>
        )}

        {/* Flat discount indicator tag if active */}
        {item.flatDiscount && (
          <div className="flex items-center px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold rounded-lg">
            🏷️ Rs. {item.flatDiscount} Off
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Line total */}
        <p className="text-sm font-bold text-slate-100 tabular-nums">{fmt(lineTotal)}</p>
      </div>

      {/* ── Overrides Expandable Section ────────────────────────────── */}
      {showOverrides && (
        <div className="mt-2 pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 animate-fade-up">
          <div>
            <label className="text-[9px] text-slate-500 block mb-0.5">Override Price (Rs.)</label>
            <input
              type="number"
              placeholder={unitPrice.toFixed(2)}
              value={item.customPrice ?? ''}
              onChange={(e) => onItemOverrideChange(productId, e.target.value, item.flatDiscount ?? '', isKotPrinted)}
              className="w-full bg-slate-800/60 border border-slate-700/40 focus:border-violet-500/50 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-semibold font-mono outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-[9px] text-slate-500 block mb-0.5">Flat LKR Disc (Rs.)</label>
            <input
              type="number"
              placeholder="0.00"
              value={item.flatDiscount ?? ''}
              onChange={(e) => onItemOverrideChange(productId, item.customPrice ?? '', e.target.value, isKotPrinted)}
              className="w-full bg-slate-800/60 border border-slate-700/40 focus:border-violet-500/50 rounded-lg px-2.5 py-1 text-xs text-amber-400 font-semibold font-mono outline-none transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  )
}
