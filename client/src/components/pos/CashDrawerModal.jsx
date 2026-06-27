import { useState, useEffect } from 'react'
import api from '../../api/axios'

export default function CashDrawerModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('log') // 'log' or 'summary'
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [type, setType] = useState('payout')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  // Fetch summary when switching to summary tab
  useEffect(() => {
    if (isOpen && activeTab === 'summary') {
      fetchSummary()
    }
  }, [isOpen, activeTab])

  const fetchSummary = async () => {
    setSummaryLoading(true)
    try {
      const res = await api.get('/billing/cash/summary')
      setSummary(res.data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setSummaryLoading(false)
    }
  }

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      await api.post('/billing/cash', { amount: Number(amount), reason, type })
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setAmount('')
        setReason('')
        onClose()
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to log cash transaction')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!loading ? onClose : undefined} />
      
      <div className="relative bg-slate-900 border border-slate-700 w-full max-w-lg p-6 rounded-2xl shadow-2xl animate-scale-in z-10 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Cash Drawer Management
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex gap-2 mb-4 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
          <button 
            onClick={() => setActiveTab('log')}
            className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${activeTab === 'log' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            Log Transaction
          </button>
          <button 
            onClick={() => setActiveTab('summary')}
            className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${activeTab === 'summary' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            Shift Summary
          </button>
        </div>
        
        <div className="overflow-y-auto pr-1 flex-1">
        {activeTab === 'log' ? (
          success ? (
            <div className="text-center p-4 border border-emerald-500/30 bg-emerald-500/10 rounded-xl mb-4 text-emerald-400 animate-fade-in">
              Transaction logged successfully!
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Transaction Type</label>
              <select 
                value={type} 
                onChange={(e) => setType(e.target.value)}
                className="input-field"
              >
                <option value="payout">Cash Payout (Expense/Withdrawal)</option>
                <option value="payin">Cash Pay-in (Deposit/Change)</option>
                <option value="starting_drawer">Starting Drawer (Shift Start)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Amount (Rs.)</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-field text-xl font-bold tabular-nums"
                placeholder="0.00"
                disabled={loading}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Reason / Description</label>
              <input
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input-field"
                placeholder="e.g., Bought Rice & Meat, Fuel"
                disabled={loading}
              />
            </div>

            {error && <p className="text-sm text-rose-400 font-medium">{error}</p>}

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors border border-slate-700"
              >
                Cancel
              </button>
                <button
                  type="submit"
                  disabled={loading || !amount || !reason}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-emerald-900/30 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Log Cash'}
                </button>
              </div>
            </form>
          )
        ) : (
          <div className="space-y-4 animate-fade-in">
            {summaryLoading ? (
              <p className="text-center text-slate-400">Loading shift summary...</p>
            ) : summary ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Starting Drawer Cash</p>
                    <p className="text-lg font-black text-slate-200">Rs. {summary.startingCash.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                  <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Cash Sales Total</p>
                    <p className="text-lg font-black text-emerald-400">Rs. {summary.cashSalesTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                  <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Petty Cash Payouts</p>
                    <p className="text-lg font-black text-rose-400">Rs. {summary.totalPayouts.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                  <div className="p-3 bg-violet-900/40 rounded-xl border border-violet-500/50">
                    <p className="text-[10px] text-violet-300 font-bold uppercase tracking-wide">Final Expected Cash</p>
                    <p className="text-lg font-black text-white">Rs. {summary.finalExpectedCash.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-bold text-slate-300 mb-2 border-b border-slate-700 pb-2">Audit Log (Today)</h3>
                  <div className="space-y-2">
                    {summary.transactions.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No petty cash transactions logged today.</p>
                    ) : (
                      summary.transactions.map(tx => (
                        <div key={tx._id} className="flex justify-between items-center p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                          <div>
                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${tx.type === 'payout' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                              {tx.type}
                            </span>
                            <p className="text-xs text-slate-300 mt-1">{tx.reason}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{new Date(tx.createdAt).toLocaleTimeString()}</p>
                          </div>
                          <span className={`font-black tabular-nums text-sm ${tx.type === 'payout' ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {tx.type === 'payout' ? '-' : '+'}Rs. {tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-center text-slate-400 flex items-center justify-center">Failed to load summary</p>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
