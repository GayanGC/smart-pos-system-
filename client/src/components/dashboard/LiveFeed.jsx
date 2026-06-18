/**
 * @file LiveFeed.jsx
 * Two-column live feed widget showing:
 *  - Recent Transactions (last 6 invoices)
 *  - Today's Attendance (employee clock-in/out status)
 * Auto-refreshes every 30 seconds.
 */

import { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60)       return `${Math.floor(diff)}s ago`
  if (diff < 3600)     return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)    return `${Math.floor(diff / 3600)}h ago`
  return new Date(dateStr).toLocaleDateString()
}

/* ── Transaction row ────────────────────────────────────────────────── */
function TxRow({ invoice }) {
  const statusColors = {
    paid:     'badge-green',
    voided:   'badge-red',
    pending:  'badge-amber',
    partially_paid: 'badge-amber',
  }
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-800/60 last:border-0 group">
      <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center flex-shrink-0 text-violet-400">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-200 truncate">{invoice.invoiceNumber}</p>
        <p className="text-[10px] text-slate-500">{invoice.cashierId?.name || 'Cashier'} · {timeAgo(invoice.createdAt)}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-slate-100 tabular-nums">{fmt(invoice.grandTotal)}</p>
        <span className={`${statusColors[invoice.status] || 'badge-slate'} text-[9px]`}>
          {invoice.status?.replace('_', ' ')}
        </span>
      </div>
    </div>
  )
}

/* ── Attendance row ─────────────────────────────────────────────────── */
function AttendRow({ record }) {
  const isClockedIn  = record.clockIn && !record.clockOut
  const isCompleted  = record.clockIn && record.clockOut
  const fmt12 = (d) => d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-800/60 last:border-0">
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs">
          {record.employeeId?.firstName?.charAt(0)}{record.employeeId?.lastName?.charAt(0)}
        </div>
        {isClockedIn && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-900 animate-pulse" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-200 truncate">
          {record.employeeId?.firstName} {record.employeeId?.lastName}
        </p>
        <p className="text-[10px] text-slate-500">
          IN {fmt12(record.clockIn)} {record.clockOut ? `· OUT ${fmt12(record.clockOut)}` : ''}
        </p>
      </div>
      <div className="flex-shrink-0">
        {isClockedIn  && <span className="badge-green text-[9px]">On Duty</span>}
        {isCompleted  && <span className="badge-slate text-[9px]">{record.totalHoursWorked}h</span>}
      </div>
    </div>
  )
}

/* ── Main Component ─────────────────────────────────────────────────── */
export default function LiveFeed() {
  const [transactions, setTransactions] = useState([])
  const [attendance,   setAttendance]   = useState([])
  const [loading,      setLoading]      = useState(true)

  const load = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const [txRes, attRes] = await Promise.allSettled([
        api.get('/billing/invoices', { params: { limit: 6, page: 1 } }),
        api.get('/employees/attendance', { params: { date: today, limit: 8 } }),
      ])
      if (txRes.status  === 'fulfilled') setTransactions(txRes.value.data.data  || [])
      if (attRes.status === 'fulfilled') setAttendance(attRes.value.data.data   || [])
    } catch { /* non-fatal */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  const skeletonRows = (n) =>
    Array.from({ length: n }, (_, i) => (
      <div key={i} className="flex items-center gap-3 py-2.5 border-b border-slate-800/60 last:border-0 animate-pulse">
        <div className="skeleton w-8 h-8 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <div className="skeleton h-2.5 w-24 rounded" />
          <div className="skeleton h-2 w-16 rounded" />
        </div>
        <div className="skeleton h-4 w-14 rounded" />
      </div>
    ))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

      {/* ── Recent Transactions ──────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-100 text-sm">Recent Transactions</h3>
          <span className="badge-violet text-[10px]">Live</span>
        </div>
        <div>
          {loading
            ? skeletonRows(4)
            : transactions.length === 0
              ? <p className="text-slate-500 text-xs text-center py-6">No transactions yet today</p>
              : transactions.map((tx) => <TxRow key={tx._id} invoice={tx} />)
          }
        </div>
      </div>

      {/* ── Today's Attendance ───────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-100 text-sm">Today's Attendance</h3>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-slate-500">
              {attendance.filter((a) => !a.clockOut).length} on duty
            </span>
          </div>
        </div>
        <div>
          {loading
            ? skeletonRows(4)
            : attendance.length === 0
              ? <p className="text-slate-500 text-xs text-center py-6">No attendance records today</p>
              : attendance.map((r) => <AttendRow key={r._id} record={r} />)
          }
        </div>
      </div>
    </div>
  )
}
