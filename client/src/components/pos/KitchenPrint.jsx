import React from 'react'

export default function KitchenPrint({
  invoiceNumber,
  lineItems,
  cashierName,
  isLivePreview = false,
  paymentMethod,
  customerName,
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
      className={`font-mono bg-white text-black text-xs p-3 w-full mx-auto ${isLivePreview ? 'rounded-lg shadow-md max-w-[300px]' : 'max-w-[80mm]'}`}
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
            background: white !important;
            color: black !important;
          }
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

      {/* ── KOT Header ── */}
      <div className="text-center mb-2">
        <h2 className="text-base font-black tracking-widest uppercase">KOT</h2>
        <div className="text-sm font-black tracking-wider uppercase bg-black text-white px-2 py-0.5 rounded inline-block mt-0.5">
          ORDER NO: #{invoiceNumber || 'NEW'}
        </div>
      </div>

      {/* ── Meta info block ── */}
      <div className="text-[10px] font-bold leading-tight mb-2 border-b border-black pb-1.5 space-y-0.5">
        <div className="flex justify-between">
          <span>DATE & TIME:</span>
          <span>{dateStr} {timeStr}</span>
        </div>
        <div className="flex justify-between">
          <span>CASHIER:</span>
          <span className="uppercase">{cashierName}</span>
        </div>
        {paymentMethod === 'credit' && (
          <div className="flex justify-between text-black">
            <span>MODE:</span>
            <span>CREDIT (ණය) {customerName && `[${customerName}]`}</span>
          </div>
        )}
      </div>

      {/* ── Kitchen Items List ── */}
      <div className="mb-2">
        <table className="w-full text-left border-collapse">
          <tbody>
            {kotItems.map((item, i) => (
              <tr key={i} className="border-b border-gray-300 border-dashed last:border-0">
                <td className="py-1.5 pr-2 font-black text-sm uppercase leading-tight">
                  {item?.name || 'Unknown Item'}
                  {item?.notes && (
                    <div className="text-[10px] font-bold text-gray-800 normal-case italic mt-0.5">
                      * Notes: {item.notes}
                    </div>
                  )}
                </td>
                <td className="py-1.5 text-right align-middle font-black text-xl w-12">
                  {item?.quantity || 1}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Kitchen Footer ── */}
      <div className="text-center text-[10px] font-black tracking-widest border-t border-black pt-1.5">
        * KITCHEN COPY *
      </div>
    </div>
  )
}
