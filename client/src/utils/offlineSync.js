/**
 * @file offlineSync.js
 * @description React-side offline invoice sync utility.
 *
 * This module handles the complete offline-first billing workflow:
 *
 * OFFLINE WRITE:
 *   When navigator.onLine === false (or a network request fails),
 *   call `saveInvoiceOffline(invoice)` to persist the invoice in IndexedDB
 *   via localforage. The invoice is tagged with a local timestamp and a
 *   unique offlineRef UUID so it can be deduplicated on the server.
 *
 * ONLINE SYNC:
 *   The module listens for the browser's 'online' event. When the network
 *   returns, `syncPendingInvoices()` is called automatically. It reads all
 *   pending invoices from IndexedDB and POSTs them to POST /api/billing/sync.
 *   Successfully synced invoices are removed from local storage.
 *
 * MANUAL TRIGGER:
 *   You can also call `syncPendingInvoices()` manually (e.g. from a UI button).
 *
 * USAGE (in your React POS component):
 *
 *   import { initOfflineSync, saveInvoiceOffline, getPendingInvoices } from './offlineSync';
 *
 *   // Call once at app startup (e.g. in App.jsx useEffect)
 *   initOfflineSync(authToken);
 *
 *   // When submitting a sale:
 *   const submitSale = async (invoiceData) => {
 *     if (!navigator.onLine) {
 *       await saveInvoiceOffline(invoiceData);
 *       alert('Saved offline. Will sync when online.');
 *     } else {
 *       await api.post('/api/billing/invoices', invoiceData);
 *     }
 *   };
 *
 * DEPENDENCIES:
 *   npm install localforage uuid
 */

import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';

// ─── IndexedDB store configuration ────────────────────────────────────────
const offlineStore = localforage.createInstance({
  name:        'smart_erp_pos',
  storeName:   'offline_invoices',
  description: 'Invoices created while the POS was offline',
});

// ─── State ─────────────────────────────────────────────────────────────────
let _authToken  = null;  // JWT — set via initOfflineSync()
let _isSyncing  = false; // prevent concurrent sync runs
let _apiBaseUrl = '/api'; // override in initOfflineSync if needed

// ─── Key helpers ───────────────────────────────────────────────────────────
const makeKey = (offlineRef) => `invoice_${offlineRef}`;

// ═══════════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Initialise the offline sync module.
 * Call this ONCE at application startup (inside a useEffect in App.jsx).
 *
 * @param {string} authToken   Bearer token for authenticated sync requests
 * @param {string} [apiBaseUrl='/api']  Override API base URL
 */
export const initOfflineSync = (authToken, apiBaseUrl = '/api') => {
  _authToken  = authToken;
  _apiBaseUrl = apiBaseUrl;

  // ── Register online event listener ────────────────────────────────────────
  window.addEventListener('online', () => {
    console.info('[OfflineSync] Network restored — starting sync…');
    syncPendingInvoices();
  });

  // ── Attempt an immediate sync if already online ───────────────────────────
  if (navigator.onLine) {
    syncPendingInvoices();
  }
};

/**
 * Update the auth token (e.g. after a re-login or token refresh).
 * @param {string} newToken
 */
export const updateAuthToken = (newToken) => {
  _authToken = newToken;
};

/**
 * Persist an invoice locally to IndexedDB when the device is offline.
 *
 * @param {object} invoiceData   The invoice payload (same shape as the server expects)
 * @returns {Promise<object>}    The stored invoice (with offlineRef and createdAt added)
 */
export const saveInvoiceOffline = async (invoiceData) => {
  const offlineRef = uuidv4();
  const offlineInvoice = {
    ...invoiceData,
    offlineRef,
    createdAt:   new Date().toISOString(),
    syncStatus:  'pending', // 'pending' | 'synced' | 'failed'
  };

  await offlineStore.setItem(makeKey(offlineRef), offlineInvoice);
  console.info(`[OfflineSync] Invoice saved offline with ref: ${offlineRef}`);
  return offlineInvoice;
};

/**
 * Retrieve all pending (un-synced) invoices from IndexedDB.
 * @returns {Promise<object[]>}
 */
export const getPendingInvoices = async () => {
  const pending = [];
  await offlineStore.iterate((value) => {
    if (value.syncStatus === 'pending') {
      pending.push(value);
    }
  });
  return pending;
};

/**
 * Retrieve ALL offline invoices (pending, synced, or failed).
 * Useful for displaying a sync status table in the UI.
 * @returns {Promise<object[]>}
 */
export const getAllOfflineInvoices = async () => {
  const all = [];
  await offlineStore.iterate((value) => all.push(value));
  return all;
};

/**
 * Remove a single offline invoice from IndexedDB by its offlineRef.
 * Called automatically after a successful sync.
 * @param {string} offlineRef
 */
export const removeOfflineInvoice = async (offlineRef) => {
  await offlineStore.removeItem(makeKey(offlineRef));
};

/**
 * Clear ALL entries from the offline store.
 * Use with caution — only after a confirmed full sync.
 */
export const clearOfflineStore = async () => {
  await offlineStore.clear();
  console.info('[OfflineSync] Offline store cleared.');
};

/**
 * Sync all pending offline invoices to the server.
 *
 * - Batches all pending invoices and sends them to POST /api/billing/sync
 * - On success: removes synced invoices from IndexedDB
 * - On failure: marks invoices as 'failed' in IndexedDB (for retry / manual review)
 * - Returns the server's sync result object
 *
 * @returns {Promise<{synced: [], skipped: [], failed: []} | null>}
 */
export const syncPendingInvoices = async () => {
  // ── Guard: don't run if offline or already syncing ───────────────────────
  if (!navigator.onLine) {
    console.warn('[OfflineSync] Device is offline — sync aborted.');
    return null;
  }
  if (_isSyncing) {
    console.warn('[OfflineSync] Sync already in progress — skipping.');
    return null;
  }
  if (!_authToken) {
    console.warn('[OfflineSync] No auth token set — sync aborted. Call initOfflineSync() first.');
    return null;
  }

  const pending = await getPendingInvoices();
  if (pending.length === 0) {
    console.info('[OfflineSync] No pending invoices to sync.');
    return { synced: [], skipped: [], failed: [] };
  }

  _isSyncing = true;
  console.info(`[OfflineSync] Syncing ${pending.length} offline invoice(s)…`);

  let results = { synced: [], skipped: [], failed: [] };

  try {
    // ── POST batch to server ─────────────────────────────────────────────────
    const response = await fetch(`${_apiBaseUrl}/billing/sync`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${_authToken}`,
      },
      body: JSON.stringify({ invoices: pending }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.message || `Server responded with ${response.status}`);
    }

    const { data } = await response.json();
    results = data;

    // ── Remove successfully synced invoices from IndexedDB ───────────────────
    // Map server-returned offlineRefs back to our local records
    const syncedRefs = new Set(
      (results.synced || []).map((s) => s.offlineRef).filter(Boolean)
    );

    for (const invoice of pending) {
      if (syncedRefs.has(invoice.offlineRef) || !results.failed.find((f) => f.offlineRef === invoice.offlineRef)) {
        // Remove from IndexedDB if synced (or server accepted it without matching ref)
        await removeOfflineInvoice(invoice.offlineRef);
      } else {
        // Mark as failed for manual review
        const updated = { ...invoice, syncStatus: 'failed' };
        await offlineStore.setItem(makeKey(invoice.offlineRef), updated);
      }
    }

    console.info(
      `[OfflineSync] Sync complete — Synced: ${results.synced.length}, ` +
      `Skipped: ${results.skipped.length}, Failed: ${results.failed.length}`
    );
  } catch (error) {
    console.error('[OfflineSync] Sync request failed:', error.message);
    // Mark all as failed for retry
    for (const invoice of pending) {
      const updated = { ...invoice, syncStatus: 'failed', syncError: error.message };
      await offlineStore.setItem(makeKey(invoice.offlineRef), updated);
    }
    results.failed = pending.map((i) => ({ offlineRef: i.offlineRef, error: error.message }));
  } finally {
    _isSyncing = false;
  }

  return results;
};

/**
 * React hook: returns live counts of pending / failed offline invoices.
 * Import and use in your POS header to show a sync badge.
 *
 * @example
 *   const { pendingCount, failedCount } = useOfflineSyncStatus();
 */
export const useOfflineSyncStatus = () => {
  // This is a lightweight hook scaffold — integrate with your state management
  // (React Query, Zustand, Redux, etc.) for reactivity.
  //
  // Suggested implementation:
  //   - Call getPendingInvoices() in a useEffect with a 5-second polling interval
  //   - Store the result in local state
  //   - Return { pendingCount, failedCount, lastSyncAt }
  console.warn('[OfflineSync] useOfflineSyncStatus is a scaffold — implement with your state library.');
  return { pendingCount: 0, failedCount: 0 };
};
