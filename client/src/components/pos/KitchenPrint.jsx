import React from 'react'

export default function KitchenPrint({
  invoiceNumber,
  lineItems,
  cashierName,
  isLivePreview = false
}) {
  const dateStr = new Date().toLocaleDateString()
  const timeStr = new Date().toLocaleTimeString()

  // In a real system, you might filter items by a 'category' or 'requiresPrep' flag.
  // For now, we print all items sent to the kitchen slip.
  const kotItems = lineItems || []

  if (kotItems.length === 0) return null

  return (
    <div className={`
      bg-white text-black text-sm p-4 w-full mx-auto
      ${isLivePreview ? 'rounded-lg shadow-xl max-w-[320px]' : 'max-w-[80mm]'}
    `}>
      {/* ── KOT Header ────────────────────────────────────────────── */}
      <div className="text-center mb-4 border-b-2 border-black pb-2">
        <h2 className="text-xl font-black uppercase tracking-widest">KOT</h2>
        <p className="text-xs font-bold uppercase tracking-wider mt-1">Kitchen Order Ticket</p>
      </div>

      {/* ── Meta ────────────────────────────────────────────────── */}
      <div className="text-xs space-y-1 mb-4">
        <div className="flex justify-between">
          <span className="font-semibold text-gray-600">Order ID:</span>
          <span className="font-bold">{invoiceNumber || 'NEW'}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-gray-600">Date:</span>
          <span>{dateStr} {timeStr}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-gray-600">Cashier:</span>
          <span className="uppercase">{cashierName}</span>
        </div>
      </div>

      {/* ── Items Matrix ────────────────────────────────────────── */}
      <div className="border-t border-b border-black py-3 mb-4">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-black text-xs">
              <th className="pb-1 font-bold">ITEM</th>
              <th className="pb-1 text-center font-bold w-12">QTY</th>
            </tr>
          </thead>
          <tbody>
            {kotItems.map((item, i) => (
              <tr key={i} className="border-b border-gray-200 border-dashed last:border-0">
                <td className="py-2 pr-2 font-bold text-sm uppercase">
                  {item?.name || 'Unknown Item'}
                </td>
                <td className="py-2 text-center align-top font-black text-lg">
                  {item?.quantity || 1}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div className="text-center text-xs font-semibold italic text-gray-500">
        End of Ticket
      </div>
    </div>
  )
}
