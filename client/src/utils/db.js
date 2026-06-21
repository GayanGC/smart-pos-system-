import Dexie from 'dexie';

export const db = new Dexie('smart_erp_pos');

db.version(1).stores({
  products: '_id, name, sku, category, barcode, isActive', // Indexed fields
  offlineInvoices: 'offlineRef, syncStatus, createdAt',
  offlineAttendance: 'id, qrToken, timestamp, syncStatus'
});
