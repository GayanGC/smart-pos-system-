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
  cashierName = 'Admin',
  isLivePreview = false,
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

  const orderNo = React.useMemo(() => {
    return Math.floor(100 + Math.random() * 900);
  }, []);

  return (
    <div 
      className={`print:block font-mono text-black bg-white w-[80mm] max-w-full mx-auto px-8 py-6 relative ${isLivePreview ? 'block rounded-xl shadow-2xl' : 'hidden'}`} 
      id="print-receipt"
    >
      {/* Decorative Illustrative Zig-Zag Borders */}
      <div 
        className="absolute top-0 bottom-0 left-1.5 w-2 bg-repeat-y" 
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='16' viewBox='0 0 8 16'%3E%3Cpath d='M8 0 L0 8 L8 16' fill='none' stroke='%23000000' stroke-width='2'/%3E%3C/svg%3E")` }} 
      />
      <div 
        className="absolute top-0 bottom-0 right-1.5 w-2 bg-repeat-y" 
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='16' viewBox='0 0 8 16'%3E%3Cpath d='M0 0 L8 8 L0 16' fill='none' stroke='%23000000' stroke-width='2'/%3E%3C/svg%3E")` }} 
      />

      {/* ── Header ── */}
      <div className="flex flex-col items-center text-center mb-4">
        {/* Solid Black Logo */}
        <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mb-2 shadow-md">
          <span className="font-black text-3xl text-white font-sans">C</span>
        </div>
        <h1 className="text-2xl font-black tracking-widest mb-0.5">C CAFE</h1>
        <p className="text-[10px] font-bold text-gray-700">No 650, Airport Road, Anuradhapura</p>
        <p className="text-[10px] font-bold text-gray-700">Tel: 025 70 29 500</p>
        
        {/* Metadata Details with Clean Dividers */}
        <div className="border-b-2 border-dashed border-gray-400 w-full my-3"></div>
        <div className="flex flex-col gap-1 text-[11px] text-left w-full">
          <div className="flex justify-between">
            <span className="text-gray-650 font-bold">RECEIPT NO:</span>
            <span className="font-extrabold">{receiptNo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-650 font-bold">ORDER NO:</span>
            <span className="font-extrabold">#{orderNo}</span>
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
        <div className="border-b-2 border-dashed border-gray-400 w-full my-3"></div>
      </div>

      {/* ── Item Table ── */}
      <table className="w-full text-[11px] mb-4">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="text-left py-1 w-1/2 font-bold">Item</th>
            <th className="text-center py-1 w-1/6 font-bold">Qty</th>
            <th className="text-right py-1 w-1/3 font-bold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(lineItems || []).map((item, i) => (
            <tr key={i} className="border-b border-gray-200 last:border-0">
              <td className="py-2 pr-2 font-medium">
                {item?.name || 'Unknown Item'}
                {(item?.discount > 0 || item?.flatDiscount > 0) && (
                  <div className="text-[9px] text-gray-500 italic">Discounted</div>
                )}
              </td>
              <td className="py-2 text-center align-top">{item?.quantity || 1}</td>
              <td className="py-2 text-right align-top">Rs. {fmt(item?.lineTotal || ((item?.unitPrice || 0) * (item?.quantity || 1)))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Summary ── */}
      <div className="border-t-2 border-dashed border-gray-400 pt-3 mb-4 space-y-1.5 text-[11px]">
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
        <div className="flex justify-between font-black text-sm mt-1 pt-1.5 border-t-2 border-black">
          <span>GRAND TOTAL:</span>
          <span>Rs. {fmt(grandTotal)}</span>
        </div>
      </div>

      {/* ── Payment Details ── */}
      <div className="border-t-2 border-dashed border-gray-400 pt-3 mb-6 space-y-1.5 text-[11px]">
        <div className="flex justify-between font-bold">
          <span>Payment Mode:</span>
          <span className="uppercase font-black">{paymentMethod === 'mobile_pay' ? 'QR PAY' : paymentMethod}</span>
        </div>
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
      <div className="text-center mt-6 flex flex-col items-center">
        <p className="font-bold text-xs">Thank You for Dining with Us!</p>
        <p className="italic text-[10px] mt-0.5">Please Come Again</p>
        
        <div className="border-b border-dashed border-gray-300 w-full my-3"></div>
        
        <p className="text-[9px] font-bold text-gray-700 uppercase tracking-tight leading-normal">
          POS System Developed by: CHANUKA CHIRAN 078-7327640
        </p>

        {/* Bottom Right AI Manager Logo */}
        <div className="w-full flex justify-end mt-4">
          <div className="flex items-center gap-1.5">
            <div className="bg-black text-white p-1 rounded flex items-center justify-center">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8L6 21" />
              </svg>
            </div>
            <div className="flex flex-col items-start leading-none">
              <span className="text-[6px] text-gray-500 font-sans tracking-widest font-black">OFFICIAL ENGINE</span>
              <span className="text-[9px] font-black font-sans tracking-wide">AI MANAGER</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
