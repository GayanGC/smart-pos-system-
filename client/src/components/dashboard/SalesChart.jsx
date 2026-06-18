/**
 * @file SalesChart.jsx
 * Recharts area chart showing Sales, COGS, and Net Profit over the last 7 days.
 * Fetches daily dashboard data in parallel for each day and assembles the series.
 */

import { useState, useEffect } from 'react'
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import api from '../../api/axios'
import LoadingSpinner from '../common/LoadingSpinner'

/* ── Custom Tooltip ─────────────────────────────────────────────────────── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const fmt = (v) => `Rs. ${Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return (
    <div className="glass-card p-3 space-y-1 !rounded-xl text-sm shadow-2xl border-slate-700/60">
      <p className="text-slate-400 text-xs font-medium mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.stroke }} />
            <span className="text-slate-300 capitalize">{p.name}</span>
          </div>
          <span className="font-semibold tabular-nums" style={{ color: p.stroke }}>
            {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── Build date range for past N days ─────────────────────────────────────── */
function getPastDays(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (n - 1 - i))
    return d
  })
}

function fmtDay(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/* ── Component ─────────────────────────────────────────────────────────── */
export default function SalesChart({ days = 7 }) {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    const loadChart = async () => {
      setLoading(true)
      setError(null)
      try {
        const dates = getPastDays(days)

        // Fetch all days in parallel
        const results = await Promise.allSettled(
          dates.map(async (date) => {
            const start = new Date(date); start.setHours(0, 0, 0, 0)
            const end   = new Date(date); end.setHours(23, 59, 59, 999)
            const { data: res } = await api.get('/billing/dashboard', {
              params: {
                startDate: start.toISOString(),
                endDate:   end.toISOString(),
              },
            })
            return { date, ...res.data }
          })
        )

        const chartData = results.map((r, i) => ({
          day:       fmtDay(dates[i]),
          Sales:     r.status === 'fulfilled' ? r.value.totalSales   ?? 0 : 0,
          COGS:      r.status === 'fulfilled' ? r.value.totalCOGS    ?? 0 : 0,
          'Net Profit': r.status === 'fulfilled' ? r.value.netProfit ?? 0 : 0,
        }))

        setData(chartData)
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load chart data.')
      } finally {
        setLoading(false)
      }
    }
    loadChart()
  }, [days])

  if (loading) {
    return (
      <div className="glass-card p-6 h-[340px] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-card p-6 h-[340px] flex flex-col items-center justify-center gap-3 text-slate-500">
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-slate-100">Sales vs Profit</h3>
          <p className="text-xs text-slate-500 mt-0.5">Last {days} days performance</p>
        </div>
        <span className="badge-violet text-[10px]">Live</span>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
          <defs>
            {/* Gradient fills */}
            <linearGradient id="grad-sales"  x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}   />
            </linearGradient>
            <linearGradient id="grad-cogs" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}    />
            </linearGradient>
            <linearGradient id="grad-profit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}   />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.5)" />
          <XAxis
            dataKey="day"
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `Rs. ${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '16px' }}
            formatter={(value) => (
              <span style={{ color: '#94a3b8', fontSize: '12px' }}>{value}</span>
            )}
          />

          <Area type="monotone" dataKey="Sales"      stroke="#7c3aed" strokeWidth={2} fill="url(#grad-sales)"  dot={false} />
          <Area type="monotone" dataKey="COGS"       stroke="#f59e0b" strokeWidth={2} fill="url(#grad-cogs)"   dot={false} />
          <Area type="monotone" dataKey="Net Profit" stroke="#10b981" strokeWidth={2} fill="url(#grad-profit)"  dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
