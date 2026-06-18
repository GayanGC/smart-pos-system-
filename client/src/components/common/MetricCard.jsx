/**
 * @file MetricCard.jsx
 * Dashboard KPI card with gradient icon container, trend indicator, and shimmer skeleton.
 */

import LoadingSpinner from './LoadingSpinner'

/**
 * @param {object}   props
 * @param {string}   props.title
 * @param {string}   props.value
 * @param {string}   [props.subtitle]       Optional secondary line (e.g. "vs yesterday")
 * @param {number}   [props.changePercent]  Signed number, e.g. 12.5 or -3.2
 * @param {string}   props.iconBg           Tailwind gradient classes for icon background
 * @param {React.ReactNode} props.icon       Icon element
 * @param {boolean}  [props.loading]
 */
export default function MetricCard({
  title,
  value,
  subtitle,
  changePercent,
  iconBg = 'from-violet-600 to-violet-800',
  icon,
  loading = false,
}) {
  const isPositive = changePercent >= 0
  const hasChange  = changePercent !== undefined && changePercent !== null

  if (loading) {
    return (
      <div className="glass-card p-6 flex gap-4 animate-pulse">
        <div className="skeleton w-14 h-14 rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-3 pt-1">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-7 w-32 rounded" />
          <div className="skeleton h-3 w-16 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-5 flex gap-4 group hover:border-slate-600/60 transition-all duration-300 animate-fade-up">
      {/* ── Icon container ──────────────────────────────────────────────── */}
      <div
        className={`
          flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br ${iconBg}
          flex items-center justify-center shadow-lg
          group-hover:scale-105 transition-transform duration-300
        `}
      >
        {icon}
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-1 truncate">
          {title}
        </p>
        <p className="text-2xl font-bold text-slate-100 leading-tight tabular-nums">
          {value}
        </p>

        {/* Change indicator */}
        {hasChange && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <span
              className={`
                text-xs font-semibold
                ${isPositive ? 'text-emerald-400' : 'text-rose-400'}
              `}
            >
              {isPositive ? '▲' : '▼'}{' '}
              {Math.abs(changePercent).toFixed(1)}%
            </span>
            {subtitle && (
              <span className="text-xs text-slate-600">{subtitle}</span>
            )}
          </div>
        )}
        {!hasChange && subtitle && (
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
