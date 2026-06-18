/**
 * @file CartItem.jsx
 * A single row in the POS cart.
 * Shows product name, quantity controls, per-item discount %, and line total.
 */

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export default function CartItem({ item, onQtyChange, onDiscountChange, onRemove }) {
  const { productId, name, sku, unitPrice, quantity, discount, lineTotal } = item

  return (
    <div className="group flex flex-col gap-2 p-3 rounded-xl border border-slate-800/80 bg-slate-900/50 hover:border-slate-700/60 transition-all duration-150 animate-fade-up">

      {/* ── Top row: name + remove ──────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-100 leading-snug line-clamp-1">{name}</p>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{sku} · {fmt(unitPrice)} ea.</p>
        </div>
        <button
          onClick={() => onRemove(productId)}
          className="flex-shrink-0 w-6 h-6 rounded-md text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-all duration-150 mt-0.5"
          title="Remove item"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Bottom row: qty controls + discount + total ─────────────── */}
      <div className="flex items-center gap-2">
        {/* Quantity stepper */}
        <div className="flex items-center bg-slate-800/80 rounded-lg border border-slate-700/50 overflow-hidden">
          <button
            onClick={() => onQtyChange(productId, quantity - 1)}
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
            onClick={() => onQtyChange(productId, quantity + 1)}
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
            aria-label="Increase quantity"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Discount input */}
        <div className="flex items-center bg-slate-800/80 rounded-lg border border-slate-700/50 overflow-hidden">
          <span className="text-[10px] text-slate-500 pl-2 font-medium">Disc.</span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={discount}
            onChange={(e) => onDiscountChange(productId, Number(e.target.value))}
            className="w-12 bg-transparent text-center text-xs font-semibold text-amber-400 py-1.5 px-1 focus:outline-none"
            aria-label="Discount percentage"
          />
          <span className="text-[10px] text-slate-500 pr-2">%</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Line total */}
        <p className="text-sm font-bold text-slate-100 tabular-nums">{fmt(lineTotal)}</p>
      </div>
    </div>
  )
}
