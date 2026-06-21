import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import api from '../api/axios';

let _authToken  = null;
let _isSyncingInvoices  = false;
let _isSyncingAttendance = false;
let _apiBaseUrl = '/api';

export const initOfflineSync = (authToken, apiBaseUrl = '/api') => {
  _authToken  = authToken;
  _apiBaseUrl = apiBaseUrl;

  window.addEventListener('online', () => {
    console.info('[OfflineSync] Network restored — starting sync…');
    syncPendingInvoices();
    syncPendingAttendance();
  });

  if (navigator.onLine) {
    syncPendingInvoices();
    syncPendingAttendance();
    cacheAllProducts();
  }
};

export const updateAuthToken = (newToken) => {
  _authToken = newToken;
};

// --- Products ---

export const cacheAllProducts = async () => {
  try {
    const { data } = await api.get('/inventory/products', { params: { limit: 10000 } });
    if (data && data.data) {
      await db.products.clear();
      await db.products.bulkPut(data.data);
      console.info(`[OfflineSync] Cached ${data.data.length} products to Dexie.`);
    }
  } catch (err) {
    console.error('[OfflineSync] Failed to cache products:', err);
  }
};

// --- Invoices ---

export const saveInvoiceOffline = async (invoiceData) => {
  const offlineRef = uuidv4();
  const offlineInvoice = {
    ...invoiceData,
    offlineRef,
    createdAt: new Date().toISOString(),
    syncStatus: 'pending',
  };

  await db.offlineInvoices.add(offlineInvoice);
  console.info(`[OfflineSync] Invoice saved offline with ref: ${offlineRef}`);
  return offlineInvoice;
};

export const getPendingInvoices = async () => {
  return await db.offlineInvoices.where('syncStatus').equals('pending').toArray();
};

export const syncPendingInvoices = async () => {
  if (!navigator.onLine || _isSyncingInvoices || !_authToken) return null;

  const pending = await db.offlineInvoices.where('syncStatus').equals('pending').toArray();
  if (pending.length === 0) return { synced: [], skipped: [], failed: [] };

  _isSyncingInvoices = true;
  let results = { synced: [], skipped: [], failed: [] };

  try {
    const response = await fetch(`${_apiBaseUrl}/billing/sync`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${_authToken}`,
      },
      body: JSON.stringify({ invoices: pending }),
    });

    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
    const { data } = await response.json();
    results = data;

    const syncedRefs = new Set((results.synced || []).map((s) => s.offlineRef).filter(Boolean));

    for (const invoice of pending) {
      if (syncedRefs.has(invoice.offlineRef) || !results.failed.find((f) => f.offlineRef === invoice.offlineRef)) {
        await db.offlineInvoices.delete(invoice.offlineRef);
      } else {
        await db.offlineInvoices.update(invoice.offlineRef, { syncStatus: 'failed' });
      }
    }
  } catch (error) {
    console.error('[OfflineSync] Sync request failed:', error.message);
    for (const invoice of pending) {
      await db.offlineInvoices.update(invoice.offlineRef, { syncStatus: 'failed', syncError: error.message });
    }
  } finally {
    _isSyncingInvoices = false;
  }
  return results;
};

// --- Attendance ---

export const saveAttendanceOffline = async (qrToken) => {
  const offlineScan = {
    id: uuidv4(),
    qrToken,
    timestamp: new Date().toISOString(),
    syncStatus: 'pending',
  };

  await db.offlineAttendance.add(offlineScan);
  console.info(`[OfflineSync] Attendance scan saved offline for token: ${qrToken}`);
  return offlineScan;
};

export const syncPendingAttendance = async () => {
  if (!navigator.onLine || _isSyncingAttendance || !_authToken) return null;

  const pending = await db.offlineAttendance.where('syncStatus').equals('pending').toArray();
  if (pending.length === 0) return { synced: [], failed: [] };

  _isSyncingAttendance = true;
  let results = { synced: [], failed: [] };

  try {
    const response = await fetch(`${_apiBaseUrl}/employees/attendance/sync`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${_authToken}`,
      },
      body: JSON.stringify({ attendanceLogs: pending }),
    });

    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
    const { data } = await response.json();
    results = data;

    const syncedIds = new Set((results.synced || []).map((s) => s.id));

    for (const scan of pending) {
      if (syncedIds.has(scan.id)) {
        await db.offlineAttendance.delete(scan.id);
      } else {
        await db.offlineAttendance.update(scan.id, { syncStatus: 'failed' });
      }
    }
  } catch (error) {
    console.error('[OfflineSync] Attendance sync failed:', error.message);
    for (const scan of pending) {
      await db.offlineAttendance.update(scan.id, { syncStatus: 'failed', syncError: error.message });
    }
  } finally {
    _isSyncingAttendance = false;
  }
  return results;
};
