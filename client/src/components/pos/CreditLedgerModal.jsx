import { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'

export default function CreditLedgerModal({ onClose, onSettleSuccess }) {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [settling, setSettling] = useState(false)

  const fetchCreditInvoices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Partially paid status corresponds to unpaid credit invoices
      const res = await api.get('/billing/invoices', {
        params: { status: 'partially_paid', limit: 100 }
      })
      // Filter to keep only those with credit paymentMethod
      const creditInvs = (res.data?.data || []).filter(
        (inv) => inv.paymentMethod === 'credit'
      )
      setInvoices(creditInvs)
    } catch (err) {
      console.error('Failed to fetch credit invoices:', err)
      setError('Failed to load credit records.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCreditInvoices()
  }, [fetchCreditInvoices])

  const handleSettle = async (e) => {
    e.preventDefault()
    if (!selectedInvoice) return

    setSettling(true)
    try {
      await api.patch(`/billing/invoices/${selectedInvoice._id}/settle`, {
        paymentMethod
      })
      alert('Debt payment recorded successfully.')
      setSelectedInvoice(null)
      onSettleSuccess() // Refresh sales numbers in parent POS page
      fetchCreditInvoices() // Refresh local list
    } catch (err) {
      console.error('Failed to settle credit invoice:', err)
      alert(err?.response?.data?.message || err?.message || 'Failed to record payment.')
    } finally {
      setSettling(false)
    }
  }

  // Filter local list based on search term
  const filteredInvoices = invoices.filter((inv) => {
    const custName = (inv.customerName || '').toLowerCase()
    const invNum = (inv.invoiceNumber || '').toLowerCase()
    const term = search.toLowerCase()
    return custName.includes(term) || invNum.includes(term)
  })

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Modal backdrop closer */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh] z-10 animate-fade-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              📖 <span>CREDIT LEDGER (ණය පොත)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Settle outstanding credit debts and balance the cash drawer</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 bg-slate-800 hover:bg-slate-700 rounded-full transition-all"
          >
            ✕
          </button>
        </div>

        {/* List of records */}
        {!selectedInvoice ? (
          <>
            {/* Search Bar */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by customer name or invoice number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-violet-500 font-medium placeholder-slate-600 transition-colors"
              />
            </div>

            {/* Invoices container */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {loading ? (
                <div className="text-center py-10 text-slate-500 text-sm animate-pulse">Loading credit records...</div>
              ) : error ? (
                <div className="text-center py-10 text-rose-500 text-sm">{error}</div>
              ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-10 text-slate-550 text-sm italic">
                  No pending credit ledger records found.
                </div>
              ) : (
                filteredInvoices.map((inv) => (
                  <div
                    key={inv._id}
                    className="flex justify-between items-center bg-slate-950 border border-slate-850 p-4 rounded-2xl hover:border-slate-700 transition-colors group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-200">{inv.customerName || 'Walk-in Customer'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-600/20 text-violet-400 font-bold border border-violet-500/20">
                          {inv.invoiceNumber}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        Owed Since: {new Date(inv.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-xs text-slate-500 block">Amount Due</span>
                        <span className="text-sm font-extrabold text-rose-400">Rs. {(inv.grandTotal).toFixed(2)}</span>
                      </div>
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/20 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      >
                        💵 <span>Settle</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          /* Settle details form */
          <form onSubmit={handleSettle} className="space-y-5 animate-fade-up">
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-slate-200">Settle Transaction Details</h3>
              <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
                <div>
                  <span className="text-slate-500 block">Customer Name</span>
                  <span className="font-bold text-slate-300 text-sm mt-0.5 block">
                    {selectedInvoice.customerName || 'Walk-in Customer'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Invoice Reference</span>
                  <span className="font-mono text-slate-300 mt-0.5 block">{selectedInvoice.invoiceNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Due Amount</span>
                  <span className="font-black text-rose-400 text-base mt-0.5 block">
                    Rs. {(selectedInvoice.grandTotal).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Logged Since</span>
                  <span className="text-slate-300 mt-0.5 block">
                    {new Date(selectedInvoice.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">
                Select Settle Method
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex items-center justify-center gap-2 p-4 border rounded-2xl font-bold text-sm transition-all cursor-pointer ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-600/10 border-emerald-500/50 text-emerald-400 shadow-md shadow-emerald-950/20'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800'
                  }`}
                >
                  💵 <span>Cash Payment</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`flex items-center justify-center gap-2 p-4 border rounded-2xl font-bold text-sm transition-all cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'bg-violet-600/10 border-violet-500/50 text-violet-400 shadow-md shadow-violet-950/20'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800'
                  }`}
                >
                  💳 <span>Card Payment</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 italic">
                * Choosing Cash will automatically log a "Customer Debt Collection" transaction inside the shift ledger to balance the cash drawer.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-350 font-bold text-sm transition-all cursor-pointer text-center"
              >
                Back to List
              </button>
              <button
                type="submit"
                disabled={settling}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/30 transition-all cursor-pointer text-center flex items-center justify-center gap-2"
              >
                {settling ? 'Settling...' : 'Confirm Settle (තහවුරු කරන්න)'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
