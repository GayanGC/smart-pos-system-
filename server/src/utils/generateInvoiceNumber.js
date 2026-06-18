/**
 * @file generateInvoiceNumber.js
 * @description Generates a unique, human-readable invoice number.
 *
 * Format:  INV-YYYYMMDD-XXXXXX
 * Example: INV-20260618-000042
 *
 * The counter portion is derived from the current count of invoices in the
 * database (passed in), padded to 6 digits for consistent sorting.
 *
 * @param {number} count  Current invoice document count from MongoDB
 * @returns {string}      Formatted invoice number string
 */
const generateInvoiceNumber = (count) => {
  // Build the YYYYMMDD date segment
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  const datePart = `${yyyy}${mm}${dd}`;

  // Zero-pad the counter to 6 digits
  const counterPart = String(count + 1).padStart(6, '0');

  return `INV-${datePart}-${counterPart}`;
};

module.exports = generateInvoiceNumber;
