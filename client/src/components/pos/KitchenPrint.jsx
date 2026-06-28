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
    <div 
      id="kot-print-root"
      className={`
        kot-print-container font-mono bg-white text-black text-sm px-8 pt-6 pb-2 relative w-full mx-auto
        ${isLivePreview ? 'rounded-lg shadow-xl max-w-[320px] pb-6' : 'max-w-[80mm] pb-0'}
      `}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: auto;
            margin: 0mm;
          }
          html, body, #kot-print-root, #print-kot, .kot-print-container {
            height: auto !important;
            min-height: 0 !important;
            overflow: hidden !important;
            padding-bottom: 0mm !important;
            margin-bottom: 0mm !important;
          }
        }
      `}} />
      {/* Illustrative Food Doodle Borders */}
      {/* Top Doodle Border */}
      <div 
        className="absolute top-1.5 left-3 right-3 h-3 bg-repeat-x opacity-80" 
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='12' viewBox='0 0 48 12'%3E%3Cg stroke='%231a1a1a' fill='none' stroke-width='0.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 3h5v3.5a2.5 2.5 0 0 1-5 0V3z M8 4.2h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1' transform='rotate(-90 5 5)'/%3E%3Cpath d='M15 6.5c0-1.5 5-1.5 5 0h-5z M15 7.5h5 M15 8.5c0 0.8 5 0.8 5 0h-5z'/%3E%3Cpath d='M27.5 5.5h4l0.4 3h-4.8z M29.5 5.5v-2.5 M28.5 3l2-0.5'/%3E%3Cpath d='M39 3h5l-2.5 4.5z'/%3E%3C/g%3E%3C/svg%3E")` }} 
      />
      {/* Bottom Doodle Border */}
      <div 
        className="absolute bottom-1.5 left-3 right-3 h-3 bg-repeat-x opacity-80" 
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='12' viewBox='0 0 48 12'%3E%3Cg stroke='%231a1a1a' fill='none' stroke-width='0.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 3h5v3.5a2.5 2.5 0 0 1-5 0V3z M8 4.2h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1' transform='rotate(-90 5 5)'/%3E%3Cpath d='M15 6.5c0-1.5 5-1.5 5 0h-5z M15 7.5h5 M15 8.5c0 0.8 5 0.8 5 0h-5z'/%3E%3Cpath d='M27.5 5.5h4l0.4 3h-4.8z M29.5 5.5v-2.5 M28.5 3l2-0.5'/%3E%3Cpath d='M39 3h5l-2.5 4.5z'/%3E%3C/g%3E%3C/svg%3E")` }} 
      />
      {/* Left Doodle Border */}
      <div 
        className="absolute top-3 bottom-3 left-1.5 w-3 bg-repeat-y opacity-80" 
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='48' viewBox='0 0 12 48'%3E%3Cg stroke='%231a1a1a' fill='none' stroke-width='0.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 3h5v3.5a2.5 2.5 0 0 1-5 0V3z M8 4.2h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1'/%3E%3Cpath d='M3 13.5c0-1.5 5-1.5 5 0h-5z M3 14.5h5 M3 15.5c0 0.8 5 0.8 5 0h-5z'/%3E%3Cpath d='M3.5 23.5h4l0.4 3h-4.8z M5.5 23.5v-2.5 M4.5 21l2-0.5'/%3E%3Cpath d='M3 33h5l-2.5 4.5z'/%3E%3Cpath d='M4 42.5h3 M3.5 44.5h4 M3 42.5c0-2.5 5-2.5 5 0z'/%3E%3C/g%3E%3C/svg%3E")` }} 
      />
      {/* Right Doodle Border */}
      <div 
        className="absolute top-3 bottom-3 right-1.5 w-3 bg-repeat-y opacity-80" 
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='48' viewBox='0 0 12 48'%3E%3Cg stroke='%231a1a1a' fill='none' stroke-width='0.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 3h5v3.5a2.5 2.5 0 0 1-5 0V3z M8 4.2h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1'/%3E%3Cpath d='M3 13.5c0-1.5 5-1.5 5 0h-5z M3 14.5h5 M3 15.5c0 0.8 5 0.8 5 0h-5z'/%3E%3Cpath d='M3.5 23.5h4l0.4 3h-4.8z M5.5 23.5v-2.5 M4.5 21l2-0.5'/%3E%3Cpath d='M3 33h5l-2.5 4.5z'/%3E%3Cpath d='M4 42.5h3 M3.5 44.5h4 M3 42.5c0-2.5 5-2.5 5 0z'/%3E%3C/g%3E%3C/svg%3E")` }} 
      />
      {/* ── KOT Header ────────────────────────────────────────────── */}
      <div className="text-center mb-4 border-b-2 border-black pb-2 flex flex-col items-center">
        <h2 className="text-xl font-black uppercase tracking-widest">KOT</h2>
        <p className="text-xs font-bold uppercase tracking-wider mt-0.5">Kitchen Order Ticket</p>
        <div className="text-base font-black tracking-wider uppercase mt-2 px-4 py-1.5 bg-black text-white rounded">
          ORDER NO: #{invoiceNumber || 'NEW'}
        </div>
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
