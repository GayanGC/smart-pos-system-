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
import { usePos } from '../../context/PosContext'
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
  {
    id: 'credit',
    label: 'CREDIT (ණය)',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    id: 'split',
    label: 'SPLIT (මිශ්‍ර)',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
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
  const [localSubmitting, setLocalSubmitting] = useState(false)
  const [cardStatus,  setCardStatus]  = useState('idle') // 'idle' | 'processing' | 'approved'
  const [printView,   setPrintView]   = useState('receipt') // 'receipt' or 'kot'
  const [printSequence, setPrintSequence] = useState('idle') // 'idle' | 'receipt' | 'kot'
  const [error,       setError]       = useState(null)
  const [invoiceId,   setInvoiceId]   = useState('')
  const [orderNo,     setOrderNo]     = useState('')
  const amountRef = useRef(null)
  const { user } = useAuth()
  const { addCashSale, addCreditSale, addDigitalSale, recordBakerySales, activeCustomer, setActiveCustomer } = usePos()

  // Credit Customer states
  const [customerSearch, setCustomerSearch] = useState('Regular Customer')
  const [selectedCustomer, setSelectedCustomer] = useState('Regular Customer')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [creditCustomerName, setCreditCustomerName] = useState('')
  const [kotToast, setKotToast] = useState(false)
  const [splitCashAmount, setSplitCashAmount] = useState('')
  const [splitCardAmount, setSplitCardAmount] = useState('')
  const [orderChannel, setOrderChannel] = useState('TAKE AWAY')

  const selectTimerRef = useRef(null)
  const printTimer1Ref = useRef(null)
  const printTimer2Ref = useRef(null)
  const afterPrintReceiptHandlerRef = useRef(null)
  const afterPrintKotHandlerRef = useRef(null)

  // Filter KOT items to print/preview only kitchen items that haven't been printed yet
  const unprintedKotItems = (lineItems || []).filter(item => {
    const cat = (item?.category || '').toLowerCase()
    const isKitchenCategory = ['food', 'rice', 'kottu', 'noodles', 'bakery', 'meals', 'hot drinks', 'hot_drinks'].includes(cat) || !cat
    return isKitchenCategory && !item.isKotPrinted
  })
  const hasKot = unprintedKotItems.length > 0

  // Sync selectedCustomer to activeCustomer in context
  useEffect(() => {
    setActiveCustomer(selectedCustomer)
  }, [selectedCustomer, setActiveCustomer])

  // Adjust states dynamically when payment method changes to credit
  useEffect(() => {
    if (method === 'credit') {
      const initialCust = activeCustomer && activeCustomer !== 'Regular Customer' ? activeCustomer : 'Regular Credit Profile'
      setCustomerSearch(initialCust)
      setSelectedCustomer(initialCust)
      setAmountPaid(grandTotal.toFixed(2))
    }
  }, [method, grandTotal, activeCustomer])

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
      setSplitCashAmount('')
      setSplitCardAmount('')
      setOrderChannel('TAKE AWAY')
      const initialCust = activeCustomer && activeCustomer !== 'Regular Customer' ? activeCustomer : 'Regular Credit Profile'
      setCustomerSearch(initialCust)
      setSelectedCustomer(initialCust)
      setDropdownOpen(false)
      setCreditCustomerName('')
      setCardStatus('idle')
      setKotToast(false)
      
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
      if (afterPrintReceiptHandlerRef.current) {
        window.removeEventListener('afterprint', afterPrintReceiptHandlerRef.current)
      }
      if (afterPrintKotHandlerRef.current) {
        window.removeEventListener('afterprint', afterPrintKotHandlerRef.current)
      }
    }
  }, [isOpen, grandTotal, activeCustomer])

  const triggerSequentialPrint = () => {
    setPrintSequence('receipt')
    
    if (afterPrintReceiptHandlerRef.current) {
      window.removeEventListener('afterprint', afterPrintReceiptHandlerRef.current)
    }
    if (afterPrintKotHandlerRef.current) {
      window.removeEventListener('afterprint', afterPrintKotHandlerRef.current)
    }

    printTimer1Ref.current = setTimeout(() => {
      const handleAfterReceiptPrint = () => {
        window.removeEventListener('afterprint', handleAfterReceiptPrint)
        afterPrintReceiptHandlerRef.current = null
        
        if (hasKot) {
          setPrintSequence('kot')
          printTimer2Ref.current = setTimeout(() => {
            const handleAfterKotPrint = () => {
              window.removeEventListener('afterprint', handleAfterKotPrint)
              afterPrintKotHandlerRef.current = null
              setPrintSequence('idle')
            }
            afterPrintKotHandlerRef.current = handleAfterKotPrint
            window.addEventListener('afterprint', handleAfterKotPrint)
            window.print()
          }, 400)
        } else {
          setPrintSequence('idle')
        }
      }
      
      afterPrintReceiptHandlerRef.current = handleAfterReceiptPrint
      window.addEventListener('afterprint', handleAfterReceiptPrint)
      window.print()
    }, 400)
  }

  // Auto-trigger print when successful
  useEffect(() => {
    if (success) {
      triggerSequentialPrint()
    }
  }, [success])

  const numericPaid = parseFloat(amountPaid) || 0
  const numSplitCash = parseFloat(splitCashAmount) || 0
  const numSplitCard = parseFloat(splitCardAmount) || 0
  const splitTotal = numSplitCash + numSplitCard

  const changeDue   = method === 'credit' 
    ? 0 
    : (method === 'split' ? Math.max(0, splitTotal - grandTotal) : Math.max(0, numericPaid - grandTotal))

  const canSubmit = method === 'cash'
    ? numericPaid >= grandTotal
    : (method === 'credit' ? !!creditCustomerName.trim() : (method === 'split' ? splitTotal >= grandTotal : true))

  const handleConfirm = async () => {
    if (localSubmitting || loading) return
    
    if (method === 'credit' && !creditCustomerName.trim()) {
      setError("Please type a customer name for this credit record.")
      return
    }

    setError(null)
    
    let finalRef = cardRef
    
    // Auto-approve and populate reference context instantly if Card/QR/Split
    if (method === 'card' || method === 'mobile_pay' || method === 'split') {
      setCardStatus('processing')
      const today = new Date()
      const datePart = today.getFullYear().toString() + 
                       (today.getMonth() + 1).toString().padStart(2, '0') + 
                       today.getDate().toString().padStart(2, '0')
      const randPart = Math.floor(1000 + Math.random() * 9000)
      finalRef = `TXN-SMP-${datePart}-${randPart}`
      
      setCardRef(finalRef)
      setCardStatus('approved')
    }

    setLocalSubmitting(true)
    try {
      await onConfirm({
        paymentMethod: method,
        amountPaid:    method === 'cash' ? numericPaid : (method === 'credit' ? 0 : (method === 'split' ? splitTotal : grandTotal)),
        referenceNumber: (method === 'card' || method === 'mobile_pay' || method === 'split') ? finalRef : undefined,
        customerName:  method === 'credit' ? (creditCustomerName.trim() || selectedCustomer) : undefined,
        invoiceId:     invoiceId,
        orderNo:       orderNo,
        splitCashAmount: method === 'split' ? numSplitCash : undefined,
        splitCardAmount: method === 'split' ? numSplitCard : undefined,
        orderChannel:  orderChannel,
      })
      if (method === 'cash') {
        addCashSale(grandTotal)
      } else if (method === 'credit') {
        addCreditSale(grandTotal)
      } else if (method === 'split') {
        addCashSale(numSplitCash)
        addDigitalSale(numSplitCard)
      } else {
        addDigitalSale(grandTotal)
      }
      recordBakerySales(lineItems)
      setSuccess(true)
      setKotToast(true)
      setTimeout(() => {
        setKotToast(false)
      }, 5000)
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed. Please try again.')
    } finally {
      setLocalSubmitting(false)
    }
  }

  const handleSuccessReset = () => {
    setMethod('cash')
    setAmountPaid('')
    setCardRef('')
    setSuccess(false)
    setPrintView('receipt')
    setPrintSequence('idle')
    setError(null)
    setLocalSubmitting(false)
    setCustomerSearch('Regular Customer')
    setSelectedCustomer('Regular Customer')
    setCreditCustomerName('')
    setDropdownOpen(false)
    setCardStatus('idle')
    setSplitCashAmount('')
    setSplitCardAmount('')
    setOrderChannel('TAKE AWAY')
    if (onSuccessReset) {
      onSuccessReset()
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
            
            {/* KOT success banner/toast */}
            {kotToast && (
              <div className="absolute top-4 left-4 right-4 z-20 bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-pulse">
                <span className="text-lg bg-emerald-500/25 w-8 h-8 rounded-full flex items-center justify-center">👍</span>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-xs">KOT Sent to Kitchen Successfully!</p>
                  <p className="text-[10px] text-emerald-400/80 font-medium">කුස්සියේ ඕඩර් එක තහවුරුයි</p>
                </div>
                <button 
                  onClick={() => setKotToast(false)}
                  className="text-emerald-400/60 hover:text-emerald-400 font-bold text-sm"
                >
                  ✕
                </button>
              </div>
            )}

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
              {hasKot && (
                <button 
                  onClick={() => setPrintView('kot')} 
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${printView === 'kot' ? 'bg-orange-500 text-white shadow-md shadow-orange-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                  Kitchen Ticket (KOT)
                </button>
              )}
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
                  amountPaid={method === 'cash' ? numericPaid : (method === 'split' ? splitTotal : (method === 'credit' ? 0 : grandTotal))}
                  changeDue={changeDue}
                  cashierName={user?.name || user?.username || 'kinship27'}
                  isLivePreview={true}
                  invoiceId={invoiceId}
                  orderNo={orderNo}
                  customerName={creditCustomerName.trim() || selectedCustomer}
                  splitCashAmount={splitCashAmount}
                  splitCardAmount={splitCardAmount}
                  orderChannel={orderChannel}
                />
              </div>
              <div className={`w-full max-w-sm flex justify-center ${printView === 'kot' ? 'block' : 'hidden'}`}>
                <KitchenPrint 
                  invoiceNumber={orderNo}
                  lineItems={unprintedKotItems.map(item => ({
                    ...item,
                    name: (item?.name || '')
                      .replace(/\(L\)/g, '[FULL]')
                      .replace(/\(M\)/g, '[MEDIUM]')
                      .replace(/\(S\)/g, '[NORMAL]')
                  }))}
                  cashierName={user?.name || user?.username || 'kinship27'}
                  isLivePreview={true}
                  paymentMethod={method}
                  customerName={creditCustomerName.trim() || selectedCustomer}
                  orderChannel={orderChannel}
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
                    amountPaid={method === 'cash' ? numericPaid : (method === 'split' ? splitTotal : (method === 'credit' ? 0 : grandTotal))}
                    changeDue={changeDue}
                    cashierName={user?.name || user?.username || 'kinship27'}
                    isLivePreview={false}
                    invoiceId={invoiceId}
                    orderNo={orderNo}
                    customerName={creditCustomerName.trim() || selectedCustomer}
                    splitCashAmount={splitCashAmount}
                    splitCardAmount={splitCardAmount}
                    orderChannel={orderChannel}
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
                    lineItems={unprintedKotItems.map(item => ({
                      ...item,
                      name: (item?.name || '')
                        .replace(/\(L\)/g, '[FULL]')
                        .replace(/\(M\)/g, '[MEDIUM]')
                        .replace(/\(S\)/g, '[NORMAL]')
                    }))}
                    cashierName={user?.name || user?.username || 'kinship27'}
                    isLivePreview={false}
                    paymentMethod={method}
                    customerName={creditCustomerName.trim() || selectedCustomer}
                    orderChannel={orderChannel}
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
                  Print Receipt
                </button>
                <button 
                  onClick={handleSuccessReset} 
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
            <div className="grid grid-cols-5 gap-1.5">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  id={`pay-method-${m.id}`}
                  className={`
                    flex flex-col items-center gap-1.5 py-3 rounded-xl border font-medium text-xs
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
          
          {/* ── Order Channel selector ───────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 mt-4">ORDER CHANNEL (ඕඩර් වර්ගය)</p>
            <div className="grid grid-cols-4 gap-1.5">
              {['DINING', 'TAKE AWAY', 'UBER', 'PICKME'].map((ch) => (
                <button
                  key={ch}
                  onClick={() => setOrderChannel(ch)}
                  className={`
                    flex items-center justify-center py-2.5 rounded-xl border font-bold text-[10px]
                    transition-all duration-150
                    ${orderChannel === ch
                      ? 'bg-blue-600/20 border-blue-500/60 text-blue-400 shadow-md shadow-blue-900/20'
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'}
                  `}
                >
                  {ch === 'DINING' ? '🍽️ DINING (කෑමෙන්)' : ch === 'TAKE AWAY' ? '🛍️ TAKE AWAY' : ch}
                </button>
              ))}
            </div>
          </div>

          {/* ── Credit inputs ─────────────────────────────────────── */}
          {method === 'credit' && (
            <div className="space-y-3 animate-fade-up">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">CREDIT CUSTOMER LEDGER (ණය පොත)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value)
                      setSelectedCustomer(e.target.value) // allows custom/new names too
                      setDropdownOpen(true)
                    }}
                    onFocus={() => setDropdownOpen(true)}
                    placeholder="Search or type customer name..."
                    className="input-field text-left font-bold text-slate-250 focus:outline-none focus:border-violet-500"
                  />
                  {dropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                      <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-20">
                        {['Regular Credit Profile', 'Staff Ledger', 'Suresh (Book #12)', 'Kamal (Book #04)']
                          .filter(c => c.toLowerCase().includes(customerSearch.toLowerCase()))
                          .map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(c)
                                setCustomerSearch(c)
                                setDropdownOpen(false)
                              }}
                              className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-violet-600 hover:text-white transition-colors border-b border-slate-800/40 last:border-0"
                            >
                              {c}
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="mt-3">
                <label className="text-xs text-slate-400 block mb-1 font-bold uppercase">CUSTOMER NAME / කස්ටමර්ගේ නම</label>
                <input 
                  type="text"
                  placeholder="Enter customer name..."
                  value={creditCustomerName}
                  onChange={(e) => setCreditCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 text-white border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-violet-500 font-bold"
                />
              </div>
            </div>
          )}
          {/* ── Split Payment inputs ────────────────────────────────── */}
          {method === 'split' && (
            <div className="space-y-4 animate-fade-up bg-slate-900/60 p-4 border border-slate-800 rounded-2xl">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">SPLIT PAYMENT BREAKDOWN</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase">Cash Amount (මුදලින්)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={splitCashAmount}
                    onChange={(e) => setSplitCashAmount(e.target.value)}
                    placeholder="LKR 0.00"
                    className="input-field text-left font-black focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase">Card Amount (කාඩ්පතින්)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={splitCardAmount}
                    onChange={(e) => setSplitCardAmount(e.target.value)}
                    placeholder="LKR 0.00"
                    className="input-field text-left font-black focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>
              
              <div className="bg-slate-950/60 p-3 border border-slate-800 rounded-xl flex items-center justify-between text-xs font-bold font-mono">
                <span className="text-slate-400">Total Entered:</span>
                <span className={splitTotal >= grandTotal ? "text-emerald-400 text-sm font-black" : "text-amber-400 text-sm font-black animate-pulse"}>
                  {fmt(splitTotal)} / {fmt(grandTotal)}
                </span>
              </div>
            </div>
          )}

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

          {/* ── Card Terminal Simulator ───────────────────────────── */}
          {method === 'card' && (
            <div className="space-y-4 animate-fade-up bg-slate-950/60 p-4 border border-slate-800 rounded-2xl">
              <div className="bg-slate-900 border border-slate-750 p-4 rounded-xl text-center font-mono">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Bank Terminal Simulator</p>
                <div className="my-3 h-10 flex items-center justify-center">
                  {cardStatus === 'idle' && (
                    <span className="text-amber-400 font-bold text-sm animate-pulse">INSERT / SWIPE / TAP CARD</span>
                  )}
                  {cardStatus === 'processing' && (
                    <div className="flex items-center gap-2 text-violet-400 text-sm">
                      <div className="w-4 h-4 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                      <span>PROCESSING TRANSACTION...</span>
                    </div>
                  )}
                  {cardStatus === 'approved' && (
                    <div className="flex flex-col items-center text-emerald-400">
                      <span className="font-bold text-sm">✓ TRANSACTION APPROVED</span>
                      <span className="text-[10px] text-slate-400 mt-1">Ref: {cardRef}</span>
                    </div>
                  )}
                </div>
                <div className="text-lg font-black text-slate-100">{fmt(grandTotal)}</div>
              </div>

              {cardStatus !== 'approved' ? (
                <button
                  type="button"
                  onClick={async () => {
                    setCardStatus('processing')
                    await new Promise(resolve => setTimeout(resolve, 1500))
                    const mockCode = `TXN-SMP-${Math.floor(100000 + Math.random() * 900000)}`
                    setCardRef(mockCode)
                    setCardStatus('approved')
                  }}
                  disabled={cardStatus === 'processing'}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-all text-xs active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-950/30"
                >
                  {cardStatus === 'processing' ? 'Communicating with IPG...' : 'Simulate Card Tap'}
                </button>
              ) : (
                <div className="text-center text-[10px] text-slate-500 italic">
                  Simulator approved. Click Confirm Payment below to complete.
                </div>
              )}
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
            disabled={!canSubmit || loading || localSubmitting}
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
