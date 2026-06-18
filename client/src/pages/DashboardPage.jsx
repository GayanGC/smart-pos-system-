/**
 * @file DashboardPage.jsx
 * Owner / Manager analytics dashboard.
 *
 * Sections:
 *  1. KPI metric cards (Sales, Net Profit, Low Stock, Voided Invoices)
 *  2. Sales vs Profit area chart (7 days)
 *  3. Live Feed (recent transactions + today's attendance)
 *  4. Floating AI chat button → ChatDrawer
 *
 * Data auto-refreshes every 60 seconds.
 */

import { useState, useEffect, useCallback } from 'react'
import MetricCard from '../components/common/MetricCard'
import SalesChart from '../components/dashboard/SalesChart'
import LiveFeed   from '../components/dashboard/LiveFeed'
import ChatDrawer from '../components/ai/ChatDrawer'
import api        from '../api/axios'

/* ── Metric card icon helper ────────────────────────────────────────── */
const icons = {
  revenue: (
    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  profit: (
    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  alert: (
    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  void: (
    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ),
  ai: (
    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
    </svg>
  ),
}

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)

/* ══════════════════════════════════════════════════════════════════════════
   Component
══════════════════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const [metrics,      setMetrics]      = useState(null)
  const [lowStockCnt,  setLowStockCnt]  = useState(null)
  const [voidedCnt,    setVoidedCnt]    = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [isChatOpen,   setIsChatOpen]   = useState(false)
  const [lastRefresh,  setLastRefresh]  = useState(new Date())

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true)
    try {
      const [dashRes, lowRes, voidRes] = await Promise.allSettled([
        api.get('/billing/dashboard'),
        api.get('/inventory/alerts/low-stock', { params: { limit: 1 } }),
        api.get('/billing/invoices', { params: { isVoided: 'true', limit: 1 } }),
      ])

      if (dashRes.status  === 'fulfilled') setMetrics(dashRes.value.data.data)
      if (lowRes.status   === 'fulfilled') setLowStockCnt(lowRes.value.data.meta?.total ?? 0)
      if (voidRes.status  === 'fulfilled') setVoidedCnt(voidRes.value.data.meta?.total ?? 0)
    } catch { /* non-fatal */ }
    finally {
      setMetricsLoading(false)
      setLastRefresh(new Date())
    }
  }, [])

  useEffect(() => {
    loadMetrics()
    const interval = setInterval(loadMetrics, 60_000)
    return () => clearInterval(interval)
  }, [loadMetrics])

  const grossMargin = metrics?.grossMarginPct ?? 0

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            {' · '}Last refreshed {lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
        <button
          onClick={loadMetrics}
          className="btn-secondary flex items-center gap-2 text-sm py-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* ── Metric cards grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

        {/* Total Sales */}
        <MetricCard
          title="Today's Sales"
          value={metricsLoading ? '—' : fmt(metrics?.totalSales)}
          subtitle={`${metrics?.invoiceCount ?? 0} transactions`}
          iconBg="from-violet-600 to-violet-800"
          icon={icons.revenue}
          loading={metricsLoading}
        />

        {/* Net Profit */}
        <MetricCard
          title="Net Profit"
          value={metricsLoading ? '—' : fmt(metrics?.netProfit)}
          changePercent={metricsLoading ? null : grossMargin}
          subtitle="gross margin"
          iconBg="from-emerald-600 to-emerald-800"
          icon={icons.profit}
          loading={metricsLoading}
        />

        {/* Low Stock Alerts */}
        <MetricCard
          title="Low Stock Alerts"
          value={metricsLoading ? '—' : String(lowStockCnt ?? '—')}
          subtitle="products below threshold"
          iconBg={lowStockCnt > 0 ? 'from-amber-600 to-amber-800' : 'from-slate-600 to-slate-800'}
          icon={icons.alert}
          loading={metricsLoading}
        />

        {/* Voided Invoices */}
        <MetricCard
          title="Voided Invoices"
          value={metricsLoading ? '—' : String(voidedCnt ?? '—')}
          subtitle="audit trail"
          iconBg={voidedCnt > 0 ? 'from-rose-600 to-rose-800' : 'from-slate-600 to-slate-800'}
          icon={icons.void}
          loading={metricsLoading}
        />
      </div>

      {/* ── Secondary metrics row (COGS breakdown) ────────────────────── */}
      {!metricsLoading && metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-up">
          {[
            { label: 'Total COGS',      value: fmt(metrics.totalCOGS),      color: 'text-amber-400' },
            { label: 'Gross Margin %',  value: `${grossMargin.toFixed(1)}%`, color: 'text-emerald-400' },
            { label: 'Avg Transaction', value: fmt(metrics.avgTransaction),  color: 'text-violet-400' },
            { label: 'Total Tax',       value: fmt(metrics.totalTax),        color: 'text-sky-400'    },
          ].map((item) => (
            <div key={item.label} className="glass-panel px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-600 font-medium">{item.label}</p>
              <p className={`text-lg font-bold tabular-nums mt-1 ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Chart + summary block ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <SalesChart days={7} />
        </div>

        {/* Quick stats panel */}
        <div className="glass-card p-5 flex flex-col gap-4">
          <h3 className="font-bold text-slate-100 text-sm">Today's Snapshot</h3>

          {metricsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex justify-between animate-pulse">
                  <div className="skeleton h-3 w-24 rounded" />
                  <div className="skeleton h-3 w-16 rounded" />
                </div>
              ))}
            </div>
          ) : metrics ? (
            <div className="space-y-3 text-sm flex-1">
              {[
                { label: 'Total Revenue',  value: fmt(metrics.totalSales),     color: 'text-violet-300' },
                { label: 'Cost of Goods',  value: fmt(metrics.totalCOGS),      color: 'text-amber-300'  },
                { label: 'Net Profit',     value: fmt(metrics.netProfit),      color: 'text-emerald-300' },
                { label: 'Discounts Given',value: fmt(metrics.totalDiscount),  color: 'text-rose-300'   },
                { label: 'Tax Collected',  value: fmt(metrics.totalTax),       color: 'text-sky-300'    },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
                  <span className="text-slate-400">{label}</span>
                  <span className={`font-semibold tabular-nums ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-xs text-center flex-1 flex items-center justify-center">No data for today</p>
          )}

          {/* Period dates */}
          {metrics?.periodStart && (
            <p className="text-[10px] text-slate-700 border-t border-slate-800 pt-3">
              Period: {new Date(metrics.periodStart).toLocaleString()} → {new Date(metrics.periodEnd).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* ── Live Feed ─────────────────────────────────────────────────── */}
      <LiveFeed />

      {/* ── Floating AI chat button ────────────────────────────────────── */}
      <button
        onClick={() => setIsChatOpen(true)}
        id="open-ai-chat-btn"
        className={`
          fixed bottom-6 right-6 z-30 w-14 h-14 rounded-2xl
          bg-gradient-to-br from-violet-600 to-fuchsia-600
          flex items-center justify-center shadow-2xl shadow-violet-900/60
          hover:scale-110 active:scale-95 transition-transform duration-200
          border border-violet-500/30 animate-pulse-ring
        `}
        title="AI Analytics Assistant"
      >
        {icons.ai}
      </button>

      {/* ── Chat Drawer ───────────────────────────────────────────────── */}
      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  )
}
