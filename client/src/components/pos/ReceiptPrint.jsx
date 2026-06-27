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
}) {
  const dateStr = new Date().toLocaleDateString()
  const timeStr = new Date().toLocaleTimeString()

  return (
    <div className="hidden print:block font-mono text-black bg-white w-[80mm] max-w-full mx-auto p-4 text-sm" id="print-receipt">
      {/* ── Header ── */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-widest mb-1">C CAFE</h1>
        <p className="text-xs text-gray-600">123 Culinary Street, Food City</p>
        <p className="text-xs text-gray-600">Tel: +94 77 123 4567</p>
        <div className="border-b-2 border-dashed border-gray-400 my-3"></div>
        <div className="flex justify-between text-xs">
          <span>{dateStr} {timeStr}</span>
          <span>Cashier: {cashierName}</span>
        </div>
        <div className="border-b-2 border-dashed border-gray-400 my-3"></div>
      </div>

      {/* ── Item Table ── */}
      <table className="w-full text-xs mb-4">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="text-left py-1 w-1/2">Item</th>
            <th className="text-center py-1 w-1/6">Qty</th>
            <th className="text-right py-1 w-1/3">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lineItems?.map((item, i) => (
            <tr key={i} className="border-b border-gray-100 last:border-0">
              <td className="py-2 pr-2 font-medium">
                {item.name}
                {(item.discount > 0 || item.flatDiscount > 0) && (
                  <div className="text-[10px] text-gray-500 italic">Discounted</div>
                )}
              </td>
              <td className="py-2 text-center align-top">{item.quantity}</td>
              <td className="py-2 text-right align-top">Rs. {fmt(item.lineTotal || (item.unitPrice * item.quantity))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Summary ── */}
      <div className="border-t-2 border-dashed border-gray-400 pt-3 mb-4 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>Rs. {fmt(subTotal)}</span>
        </div>
        {totalDiscount > 0 && (
          <div className="flex justify-between">
            <span>Discount:</span>
            <span>- Rs. {fmt(totalDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm mt-1 pt-1 border-t border-gray-300">
          <span>GRAND TOTAL:</span>
          <span>Rs. {fmt(grandTotal)}</span>
        </div>
      </div>

      {/* ── Payment Details ── */}
      <div className="border-t-2 border-dashed border-gray-400 pt-3 mb-6 space-y-1 text-xs">
        <div className="flex justify-between">
          <span>Payment Mode:</span>
          <span className="uppercase">{paymentMethod === 'mobile_pay' ? 'QR PAY' : paymentMethod}</span>
        </div>
        {paymentMethod === 'cash' && (
          <>
            <div className="flex justify-between">
              <span>Amount Paid:</span>
              <span>Rs. {fmt(amountPaid)}</span>
            </div>
            <div className="flex justify-between">
              <span>Change Due:</span>
              <span>Rs. {fmt(changeDue)}</span>
            </div>
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="text-center mt-6">
        <p className="font-bold">Thank You for Dining with Us!</p>
        <p className="italic text-xs mt-1">Please Come Again</p>
      </div>
    </div>
  )
}
