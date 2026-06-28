/**
 * @file CheckoutModal.jsx
 * Full-screen checkout overlay with:
 * - CASH / CARD / QR MOBILE payment method selector
 * - Live change-due calculator for cash payments
 * - Loading state during API submission
 * - Success / error feedback
 */

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import ReceiptPrint from './ReceiptPrint'
import KitchenPrint from './KitchenPrint'

const METHODS = [
  {
    id: 'cash',
    label: 'Cash',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: 'card',
    label: 'Card',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    id: 'mobile_pay',
    label: 'QR Pay',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
    ),
  },
]

const fmt = (n) =>
  'Rs. ' + (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function CheckoutModal({
  isOpen,
  onClose,
  onSuccessReset,
  grandTotal,
  subTotal,
  totalDiscount,
  lineItems,
  onConfirm,
  loading,
  isOnline,
}) {
  const [method,      setMethod]      = useState('cash')
  const [amountPaid,  setAmountPaid]  = useState('')
  const [cardRef,     setCardRef]     = useState('')
  const [success,     setSuccess]     = useState(false)
  const [printView,   setPrintView]   = useState('receipt') // 'receipt' or 'kot'
  const [printSequence, setPrintSequence] = useState('idle') // 'idle' | 'receipt' | 'kot'
  const [error,       setError]       = useState(null)
  const [invoiceId,   setInvoiceId]   = useState('')
  const [orderNo,     setOrderNo]     = useState('')
  const amountRef = useRef(null)
  const { user } = useAuth()

  const selectTimerRef = useRef(null)
  const printTimer1Ref = useRef(null)
  const printTimer2Ref = useRef(null)

  // Reset state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setMethod('cash')
      setAmountPaid((grandTotal || 0).toFixed(2)) // pre-fill exact amount
      setCardRef('')
      setSuccess(false)
      setPrintView('receipt')
      setPrintSequence('idle')
      setError(null)
      
      const today = new Date();
      const datePart = today.getFullYear().toString() + 
                       (today.getMonth() + 1).toString().padStart(2, '0') + 
                       today.getDate().toString().padStart(2, '0');
      const randPart = Math.floor(1000 + Math.random() * 9000);
      setInvoiceId(`REC-${datePart}-${randPart}`);
      setOrderNo(Math.floor(100 + Math.random() * 900).toString());

      selectTimerRef.current = setTimeout(() => amountRef.current?.select(), 50)
    }
    return () => {
      if (selectTimerRef.current) clearTimeout(selectTimerRef.current)
      if (printTimer1Ref.current) clearTimeout(printTimer1Ref.current)
      if (printTimer2Ref.current) clearTimeout(printTimer2Ref.current)
    }
  }, [isOpen, grandTotal])

  const triggerSequentialPrint = () => {
    setPrintSequence('receipt')
    
    // Structured timeout to paint Receipt layout
    printTimer1Ref.current = setTimeout(() => {
      window.print() // Blocks until print dialog is closed
      
      // Once receipt dialog closes, mount KOT
      setPrintSequence('kot')
      
      // Nested double requestAnimationFrame + structured 500ms timeout to guarantee full layout paint
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          printTimer2Ref.current = setTimeout(() => {
            window.print() // Blocks until print dialog is closed
            setPrintSequence('idle')
          }, 500) // 500ms safety buffer
        })
      })
    }, 400)
  }

  // Auto-trigger print when successful
  useEffect(() => {
    if (success) {
      triggerSequentialPrint()
    }
  }, [success])

  const numericPaid = parseFloat(amountPaid) || 0
  const changeDue   = Math.max(0, numericPaid - grandTotal)
  const canSubmit   = method === 'cash'
    ? numericPaid >= grandTotal
    : true

  const handleConfirm = async () => {
    setError(null)
    try {
      await onConfirm({
        paymentMethod: method,
        amountPaid:    method === 'cash' ? numericPaid : grandTotal,
        referenceNumber: method === 'card' ? cardRef : undefined,
      })
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed. Please try again.')
    }
  }

  if (!isOpen) return null

  return (
    /* ── Backdrop ────────────────────────────────────────────────── */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={!loading ? onClose : undefined}
      />

      {/* ── Modal card ────────────────────────────────────────────── */}
      <div className="relative glass-card w-full max-w-md p-0 overflow-hidden animate-scale-in">

        {/* Success overlay */}
        {success && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/95 p-4 animate-fade-in overflow-y-auto">
            <h2 className="text-xl font-bold text-emerald-400 mb-2 print:hidden flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              Payment Complete!
            </h2>
            
            {/* Tab selector for Print Previews */}
            <div className="print:hidden flex gap-2 mb-4 bg-slate-900 border border-slate-800 p-1 rounded-xl">
              <button 
                onClick={() => setPrintView('receipt')} 
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${printView === 'receipt' ? 'bg-violet-600 text-white shadow-md shadow-violet-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              >
                Customer Receipt
              </button>
              <button 
                onClick={() => setPrintView('kot')} 
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${printView === 'kot' ? 'bg-orange-500 text-white shadow-md shadow-orange-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              >
                Kitchen Ticket (KOT)
              </button>
            </div>

            {/* Screen UI - Tab View */}
            <div className="flex-1 w-full flex items-center justify-center overflow-y-auto print:hidden">
              <div className={`w-full max-w-sm flex justify-center ${printView === 'receipt' ? 'block' : 'hidden'}`}>
                <ReceiptPrint 
                  lineItems={lineItems} 
                  grandTotal={grandTotal}
                  subTotal={subTotal}
                  totalDiscount={totalDiscount}
                  paymentMethod={method}
                  amountPaid={method === 'cash' ? numericPaid : grandTotal}
                  changeDue={changeDue}
                  cashierName={user?.name || user?.username || 'kinship27'}
                  isLivePreview={true}
                  invoiceId={invoiceId}
                  orderNo={orderNo}
                />
              </div>
              <div className={`w-full max-w-sm flex justify-center ${printView === 'kot' ? 'block' : 'hidden'}`}>
                <KitchenPrint 
                  invoiceNumber={orderNo}
                  lineItems={(lineItems || [])
                    .filter(item => {
                      const cat = (item?.category || '').toLowerCase()
                      return ['food', 'rice', 'kottu', 'noodles', 'bakery', 'meals', 'hot drinks', 'hot_drinks'].includes(cat) || !cat
                    })
                    .map(item => ({
                      ...item,
                      name: (item?.name || '')
                        .replace(/\(L\)/g, '[FULL]')
                        .replace(/\(M\)/g, '[MEDIUM]')
                        .replace(/\(S\)/g, '[NORMAL]')
                    }))
                  }
                  cashierName={user?.name || user?.username || 'kinship27'}
                  isLivePreview={true}
                />
              </div>
            </div>

            {/* Print Only Container */}
            <div className="hidden print:block w-full max-w-sm mx-auto">
              {(printSequence === 'receipt' || printSequence === 'idle') && (
                <div className="receipt-section">
                  <ReceiptPrint 
                    lineItems={lineItems} 
                    grandTotal={grandTotal}
                    subTotal={subTotal}
                    totalDiscount={totalDiscount}
                    paymentMethod={method}
                    amountPaid={method === 'cash' ? numericPaid : grandTotal}
                    changeDue={changeDue}
                    cashierName={user?.name || user?.username || 'kinship27'}
                    isLivePreview={false}
                    invoiceId={invoiceId}
                    orderNo={orderNo}
                  />
                </div>
              )}
              {printSequence === 'kot' && (
                <div 
                  className="kot-section" 
                  id="print-kot"
                  ref={el => {
                    if (el) {
                      el.style.setProperty('display', 'block', 'important');
                      el.style.setProperty('visibility', 'visible', 'important');
                    }
                  }}
                >
                  <KitchenPrint 
                    invoiceNumber={orderNo}
                    lineItems={(lineItems || [])
                      .filter(item => {
                        const cat = (item?.category || '').toLowerCase()
                        return ['food', 'rice', 'kottu', 'noodles', 'bakery', 'meals', 'hot drinks', 'hot_drinks'].includes(cat) || !cat
                      })
                      .map(item => ({
                        ...item,
                        name: (item?.name || '')
                          .replace(/\(L\)/g, '[FULL]')
                          .replace(/\(M\)/g, '[MEDIUM]')
                          .replace(/\(S\)/g, '[NORMAL]')
                      }))
                    }
                    cashierName={user?.name || user?.username || 'kinship27'}
                    isLivePreview={false}
                  />
                </div>
              )}
            </div>

            <div className="mt-4 shrink-0 print:hidden text-center w-full max-w-sm">
              {!isOnline && <p className="text-xs text-amber-400 mb-3">Saved offline — will sync when connected</p>}
              <div className="flex gap-2">
                <button 
                  onClick={triggerSequentialPrint} 
                  className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl font-bold transition-colors"
                >
                  Print Receipt & KOT
                </button>
                <button 
                  onClick={onSuccessReset} 
                  className="flex-1 btn-primary py-3.5 text-lg font-bold tracking-wide"
                >
                  New Sale
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Checkout</h2>
            {!isOnline && (
              <p className="text-xs text-amber-400 mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                Offline mode — sale will sync later
              </p>
            )}
          </div>
          <button onClick={onClose} disabled={loading} className="btn-icon">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* ── Grand total display ───────────────────────────────── */}
          <div className="bg-gradient-to-br from-violet-900/30 to-violet-950/50 border border-violet-700/30 rounded-2xl p-5 text-center">
            <p className="text-xs font-medium text-violet-400 uppercase tracking-widest mb-2">Grand Total</p>
            <p className="text-4xl font-black text-white tabular-nums">{fmt(grandTotal)}</p>
            <p className="text-xs text-slate-500 mt-1">{lineItems?.length} item{lineItems?.length !== 1 ? 's' : ''}</p>
          </div>

          {/* ── Payment method selector ───────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Payment Method</p>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  id={`pay-method-${m.id}`}
                  className={`
                    flex flex-col items-center gap-1.5 py-3 rounded-xl border font-medium text-sm
                    transition-all duration-150
                    ${method === m.id
                      ? 'bg-violet-600/20 border-violet-500/60 text-violet-300 shadow-md shadow-violet-900/20'
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'}
                  `}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Cash inputs ───────────────────────────────────────── */}
          {method === 'cash' && (
            <div className="space-y-3 animate-fade-up">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1.5">Amount Paid (LKR)</label>
                <input
                  ref={amountRef}
                  type="number"
                  min={0}
                  step={0.01}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="input-field text-xl font-bold text-center tabular-nums"
                  id="amount-paid-input"
                  placeholder="0.00"
                />
              </div>

              {/* Quick-select shortcuts */}
              <div className="flex gap-2">
                {[grandTotal, Math.ceil(grandTotal), Math.ceil(grandTotal / 10) * 10 + (grandTotal % 10 > 0 ? 10 : 0)].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmountPaid(val.toFixed(2))}
                    className="flex-1 py-1.5 rounded-lg bg-slate-800/60 text-xs font-semibold text-slate-300 border border-slate-700/50 hover:border-slate-600 transition-all"
                  >
                    {fmt(val)}
                  </button>
                ))}
              </div>

              {/* Change due */}
              {numericPaid > 0 && (
                <div className={`
                  flex items-center justify-between h-20 px-6 rounded-2xl border
                  ${changeDue > 0 
                    ? 'bg-emerald-600 border-emerald-500 shadow-lg change-due-active text-white' 
                    : 'bg-slate-800/50 border-slate-700/40 text-slate-500'}
                `}>
                  <span className="text-base font-bold" style={{ color: changeDue > 0 ? '#ffffff' : '#64748b', fontWeight: 900, textShadow: changeDue > 0 ? '0 1px 2px rgba(0,0,0,0.2)' : 'none' }}>Change Due</span>
                  <span className="text-2xl font-bold tabular-nums" style={{ color: changeDue > 0 ? '#ffffff' : '#64748b', fontWeight: 900, textShadow: changeDue > 0 ? '0 1px 2px rgba(0,0,0,0.2)' : 'none' }}>
                    {fmt(changeDue)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Card reference ────────────────────────────────────── */}
          {method === 'card' && (
            <div className="animate-fade-up">
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Card Auth / Reference No. (optional)</label>
              <input
                type="text"
                value={cardRef}
                onChange={(e) => setCardRef(e.target.value)}
                className="input-field"
                placeholder="e.g. AUTH-123456"
              />
            </div>
          )}

          {/* ── QR/Mobile ─────────────────────────────────────────── */}
          {method === 'mobile_pay' && (
            <div className="flex flex-col items-center gap-3 animate-fade-up">
              {/* Mock QR pattern */}
              <div className="w-36 h-36 bg-white rounded-xl p-3 grid grid-cols-7 gap-0.5">
                {Array.from({ length: 49 }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-[1px] ${Math.random() > 0.5 ? 'bg-slate-900' : 'bg-white'}`}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-500">Customer scans to pay {fmt(grandTotal)}</p>
            </div>
          )}

          {/* ── Error ────────────────────────────────────────────── */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-400 text-sm animate-fade-up">
              {error}
            </div>
          )}

          {/* ── Confirm button ────────────────────────────────────── */}
          <button
            onClick={handleConfirm}
            disabled={!canSubmit || loading}
            id="confirm-payment-btn"
            className="btn-success w-full h-20 text-xl font-bold flex items-center justify-center gap-2.5 rounded-2xl"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 rounded-full border-2 border-emerald-300 border-t-transparent animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Confirm Payment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
