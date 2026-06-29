import React from 'react'

const fmt = (n) => (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ReceiptPrint({ 
  lineItems, 
  grandTotal, 
  subTotal,
  totalDiscount,
  paymentMethod,
  amountPaid,
  changeDue,
  cashierName = 'kinship27',
  isLivePreview = false,
  invoiceId,
  orderNo: propOrderNo,
  customerName,
  referenceNumber,
  splitCashAmount,
  splitCardAmount,
}) {
  const dateStr = new Date().toLocaleDateString()
  const timeStr = new Date().toLocaleTimeString()

  const receiptNo = React.useMemo(() => {
    const today = new Date();
    const datePart = today.getFullYear().toString() + 
                     (today.getMonth() + 1).toString().padStart(2, '0') + 
                     today.getDate().toString().padStart(2, '0');
    const randPart = Math.floor(1000 + Math.random() * 9000);
    return `REC-${datePart}-${randPart}`;
  }, []);

  const orderNoGenerated = React.useMemo(() => {
    return Math.floor(100 + Math.random() * 900);
  }, []);

  const finalInvoiceId = invoiceId || receiptNo;
  const finalOrderNo = propOrderNo || orderNoGenerated;

  return (
    <div 
      className={`print:block font-mono text-black bg-white w-[80mm] max-w-full mx-auto px-4 py-2 relative ${isLivePreview ? 'block rounded-xl shadow-2xl' : 'hidden'}`} 
      id="print-receipt"
    >
      <style dangerouslySetInnerHTML={{ __html: `
        * {
          font-family: 'Noto Sans Sinhala', -apple-system, sans-serif !important;
          text-rendering: optimizeLegibility !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
          font-variant-ligatures: common-ligatures !important;
        }
        @media print {
          * {
            font-family: 'Noto Sans Sinhala', -apple-system, sans-serif !important;
            text-rendering: optimizeLegibility !important;
            -webkit-font-smoothing: antialiased !important;
            -moz-osx-font-smoothing: grayscale !important;
            font-variant-ligatures: common-ligatures !important;
          }
          html, body, div, svg, img, table, tr, td, th {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}} />
      {/* Doodle Border Background Frame */}
      <div className="absolute inset-0 z-0 opacity-15 pointer-events-none">
        {/* Top Doodle Border */}
        <div 
          className="absolute top-1.5 left-3 right-3 h-3 bg-repeat-x" 
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='12' viewBox='0 0 48 12'%3E%3Cg stroke='%231a1a1a' fill='none' stroke-width='0.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 3h5v3.5a2.5 2.5 0 0 1-5 0V3z M8 4.2h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1' transform='rotate(-90 5 5)'/%3E%3Cpath d='M15 6.5c0-1.5 5-1.5 5 0h-5z M15 7.5h5 M15 8.5c0 0.8 5 0.8 5 0h-5z'/%3E%3Cpath d='M27.5 5.5h4l0.4 3h-4.8z M29.5 5.5v-2.5 M28.5 3l2-0.5'/%3E%3Cpath d='M39 3h5l-2.5 4.5z'/%3E%3C/g%3E%3C/svg%3E")` }} 
        />
        {/* Bottom Doodle Border */}
        <div 
          className="absolute bottom-1.5 left-3 right-3 h-3 bg-repeat-x" 
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='12' viewBox='0 0 48 12'%3E%3Cg stroke='%231a1a1a' fill='none' stroke-width='0.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 3h5v3.5a2.5 2.5 0 0 1-5 0V3z M8 4.2h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1' transform='rotate(-90 5 5)'/%3E%3Cpath d='M15 6.5c0-1.5 5-1.5 5 0h-5z M15 7.5h5 M15 8.5c0 0.8 5 0.8 5 0h-5z'/%3E%3Cpath d='M27.5 5.5h4l0.4 3h-4.8z M29.5 5.5v-2.5 M28.5 3l2-0.5'/%3E%3Cpath d='M39 3h5l-2.5 4.5z'/%3E%3C/g%3E%3C/svg%3E")` }} 
        />
        {/* Left Doodle Border */}
        <div 
          className="absolute top-3 bottom-3 left-1.5 w-3 bg-repeat-y" 
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='48' viewBox='0 0 12 48'%3E%3Cg stroke='%231a1a1a' fill='none' stroke-width='0.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 3h5v3.5a2.5 2.5 0 0 1-5 0V3z M8 4.2h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1'/%3E%3Cpath d='M3 13.5c0-1.5 5-1.5 5 0h-5z M3 14.5h5 M3 15.5c0 0.8 5 0.8 5 0h-5z'/%3E%3Cpath d='M3.5 23.5h4l0.4 3h-4.8z M5.5 23.5v-2.5 M4.5 21l2-0.5'/%3E%3Cpath d='M3 33h5l-2.5 4.5z'/%3E%3Cpath d='M4 42.5h3 M3.5 44.5h4 M3 42.5c0-2.5 5-2.5 5 0z'/%3E%3C/g%3E%3C/svg%3E")` }} 
        />
        {/* Right Doodle Border */}
        <div 
          className="absolute top-3 bottom-3 right-1.5 w-3 bg-repeat-y" 
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='48' viewBox='0 0 12 48'%3E%3Cg stroke='%231a1a1a' fill='none' stroke-width='0.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 3h5v3.5a2.5 2.5 0 0 1-5 0V3z M8 4.2h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1'/%3E%3Cpath d='M3 13.5c0-1.5 5-1.5 5 0h-5z M3 14.5h5 M3 15.5c0 0.8 5 0.8 5 0h-5z'/%3E%3Cpath d='M3.5 23.5h4l0.4 3h-4.8z M5.5 23.5v-2.5 M4.5 21l2-0.5'/%3E%3Cpath d='M3 33h5l-2.5 4.5z'/%3E%3Cpath d='M4 42.5h3 M3.5 44.5h4 M3 42.5c0-2.5 5-2.5 5 0z'/%3E%3C/g%3E%3C/svg%3E")` }} 
        />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        {/* ── Header ── */}
        <div className="flex flex-col items-center text-center mb-1 mt-0.5">
          {/* Brand Logo */}
          <img 
            src="/logo.png" 
            alt="C Cafe Logo"
            width="64px"
            height="64px"
            className="mx-auto block mb-1 rounded-full object-cover flex-shrink-0 shadow-md print:contrast-125 print:brightness-95"
            style={{ imageRendering: 'pixelated' }}
          />
          <h1 className="text-lg font-black tracking-widest mb-0.5">C CAFE</h1>
          <p className="text-[10px] font-bold text-gray-700">No 650, Airport Road, Anuradhapura</p>
          <p className="text-[10px] font-bold text-gray-700">Tel: 025 70 29 500</p>
          
          {/* Bold Order ID at top header */}
          <div className="text-xs font-black tracking-wider uppercase mt-1 px-2 py-0.5 bg-black text-white rounded">
            ORDER NO: #{finalOrderNo}
          </div>
          
          {/* Metadata Details with Clean Dividers */}
          <div className="border-b-2 border-dashed border-gray-400 w-full my-1"></div>
          <div className="flex flex-col gap-0.5 text-[10px] text-left w-full">
            <div className="flex justify-between">
              <span className="text-gray-650 font-bold">RECEIPT NO:</span>
              <span className="font-extrabold">{finalInvoiceId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-650 font-bold">ORDER NO:</span>
              <span className="font-extrabold">#{finalOrderNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-650 font-bold">DATE & TIME:</span>
              <span>{dateStr} {timeStr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-650 font-bold">CASHIER:</span>
              <span>{cashierName}</span>
            </div>
          </div>
          <div className="border-b-2 border-dashed border-gray-400 w-full my-1"></div>
        </div>

        {/* ── Item Table ── */}
        <table className="w-full text-[10px] mb-1">
          <thead>
            <tr className="border-b border-black">
              <th className="text-left py-0.5 w-1/2 font-bold">Item</th>
              <th className="text-center py-0.5 w-1/6 font-bold">Qty</th>
              <th className="text-right py-0.5 w-1/3 font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(lineItems || []).map((item, i) => (
              <tr key={i} className="border-b border-gray-100 last:border-0">
                <td className="py-1 pr-2 font-medium">
                  {item?.name || 'Unknown Item'}
                  {(item?.discount > 0 || item?.flatDiscount > 0) && (
                    <div className="text-[8px] text-gray-500 italic leading-none">Discounted</div>
                  )}
                </td>
                <td className="py-1 text-center align-top">{item?.quantity || 1}</td>
                <td className="py-1 text-right align-top">Rs. {fmt(item?.lineTotal || ((item?.unitPrice || 0) * (item?.quantity || 1)))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Summary ── */}
        <div className="border-t border-dashed border-gray-450 pt-1 mb-1 space-y-0.5 text-[10px]">
          <div className="flex justify-between font-bold">
            <span>Subtotal:</span>
            <span>Rs. {fmt(subTotal)}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between">
              <span>Discount:</span>
              <span>- Rs. {fmt(totalDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-xs mt-0.5 pt-0.5 border-t border-black">
            <span>GRAND TOTAL:</span>
            <span>Rs. {fmt(grandTotal)}</span>
          </div>
        </div>

        {/* ── Payment Details ── */}
        <div className="border-t border-dashed border-gray-450 pt-1 mb-1 space-y-0.5 text-[10px]">
          <div className="flex justify-between font-bold">
            <span>Payment Mode:</span>
            <span className="uppercase font-black">
              {paymentMethod === 'mobile_pay' ? 'QR PAY' : (paymentMethod === 'credit' ? 'CREDIT (ණය)' : (paymentMethod === 'split' ? 'SPLIT (මිශ්‍ර)' : paymentMethod))}
            </span>
          </div>
          {paymentMethod === 'card' && referenceNumber && (
            <div className="flex justify-between font-bold text-gray-750">
              <span>Auth Ref:</span>
              <span>{referenceNumber}</span>
            </div>
          )}
          {paymentMethod === 'split' && (
            <>
              <div className="flex justify-between">
                <span>Cash Portion (මුදලින්):</span>
                <span>Rs. {fmt(splitCashAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Card Portion (කාඩ්පතින්):</span>
                <span>Rs. {fmt(splitCardAmount)}</span>
              </div>
              {changeDue > 0 && (
                <div className="flex justify-between font-bold">
                  <span>Change Due:</span>
                  <span>Rs. {fmt(changeDue)}</span>
                </div>
              )}
            </>
          )}
          {paymentMethod === 'cash' && (
            <>
              <div className="flex justify-between">
                <span>Amount Paid:</span>
                <span>Rs. {fmt(amountPaid)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Change Due:</span>
                <span>Rs. {fmt(changeDue)}</span>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="text-center mt-2 flex flex-col items-center">
          <p className="font-bold text-[10px]">Thank You for Dining with Us!</p>
          <p className="italic text-[9px] mt-0.5">Please Come Again</p>
          
          <div className="border-b border-dashed border-gray-300 w-full my-1"></div>
          
          <p className="text-[8px] font-bold text-gray-750 uppercase tracking-tight leading-normal">
            POS System Developed by: kinship27
          </p>
          <p className="text-[8px] font-bold text-gray-750 tracking-tight leading-normal mt-0.5">
            Tel: 0760126663
          </p>

          {/* Bottom Right AI Manager Logo */}
          <div className="w-full flex justify-end mt-1">
            <div className="flex items-center gap-1">
              <div className="bg-black text-white p-0.5 rounded flex items-center justify-center">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8L6 21" />
                </svg>
              </div>
              <div className="flex flex-col items-start leading-none">
                <span className="text-[5px] text-gray-500 font-sans tracking-widest font-black">OFFICIAL ENGINE</span>
                <span className="text-[8px] font-black font-sans tracking-wide">AI MANAGER</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
