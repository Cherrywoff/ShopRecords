// ==========================================
// BACKGROUND SYNC ENGINE WITH RETRY & QUARANTINE
// ==========================================

import { dbOps, STORES } from './db';
import { supabase } from '../supabase';

let isSyncing = false;
let backoffIndex = 0;
const backoffIntervals = [5000, 10000, 20000, 40000, 60000];
let statusCallback = null;

// Registry of Supabase-supported tables that require synchronization
const SYNCHRONIZED_TABLES = [
  STORES.SHOPS,
  STORES.PROFILES,
  STORES.PRODUCTS,
  STORES.CUSTOMERS,
  STORES.SALES,
  STORES.SALE_ITEMS,
  STORES.EXPENSES,
  STORES.SUPPLIERS,
  STORES.SUPPLIER_TRANSACTIONS,
  STORES.CUSTOMER_TRANSACTIONS,
  STORES.DAILY_CLOSINGS
];

// Start the sync engine watcher
export function startSyncEngine(onSyncStatusChange) {
  statusCallback = onSyncStatusChange;

  // Listen to network status triggers
  window.addEventListener('online', () => {
    console.log('App is online. Triggering sync...');
    triggerSync();
  });

  window.addEventListener('offline', () => {
    console.log('App is offline.');
    if (statusCallback) {
      statusCallback({ status: 'offline', message: 'Offline mode. Changes saved locally.' });
    }
  });

  // Initial scan
  triggerSync();
}

// Trigger a sync pass immediately if online
export function triggerSync() {
  if (!navigator.onLine) {
    if (statusCallback) {
      statusCallback({ status: 'offline', message: 'Offline mode. Changes saved locally.' });
    }
    return;
  }
  
  runSyncLoop();
}

// Push local change to sync queue table
export async function queueSyncAction(tableName, recordId, action, recordData = null) {
  if (!SYNCHRONIZED_TABLES.includes(tableName)) return;

  // If action is INSERT/UPDATE, we load the record's current state from IndexedDB to sync it.
  let syncData = recordData;
  if ((action === 'INSERT' || action === 'UPDATE') && !syncData) {
    syncData = await dbOps.get(tableName, recordId);
  }

  // Remove local fields not present in Supabase table
  if (syncData) {
    const { sync_status, last_sync_error, ...cleanData } = syncData;
    syncData = cleanData;
  }

  const queueItem = {
    tableName,
    recordId,
    action,
    data: syncData,
    attempts: 0,
    created_at: new Date().toISOString()
  };

  await dbOps.put(STORES.SYNC_QUEUE, queueItem);
  
  // Set sync status to pending on original record
  if (action !== 'DELETE') {
    const originalRecord = await dbOps.get(tableName, recordId);
    if (originalRecord) {
      originalRecord.sync_status = 'pending';
      delete originalRecord.last_sync_error;
      await dbOps.put(tableName, originalRecord);
    }
  }

  triggerSync();
}

// Main processing loop
async function runSyncLoop() {
  if (isSyncing) return;
  isSyncing = true;

  if (statusCallback) {
    statusCallback({ status: 'syncing', message: 'Syncing with Supabase...' });
  }

  try {
    while (navigator.onLine) {
      const queue = await dbOps.getAll(STORES.SYNC_QUEUE);
      if (queue.length === 0) {
        backoffIndex = 0;
        if (statusCallback) {
          statusCallback({ status: 'synced', message: 'All records synced.' });
        }
        break;
      }

      // Sort by creation date (FIFO)
      queue.sort((a, b) => a.id - b.id);
      const item = queue[0];

      const result = await processQueueItem(item);

      if (result.success) {
        // Delete item from queue
        await dbOps.delete(STORES.SYNC_QUEUE, item.id);
        backoffIndex = 0;

        // Mark local record as synced
        if (item.action !== 'DELETE') {
          const originalRecord = await dbOps.get(item.tableName, item.recordId);
          if (originalRecord) {
            originalRecord.sync_status = 'synced';
            delete originalRecord.last_sync_error;
            await dbOps.put(item.tableName, originalRecord);
          }
        }
      } else if (result.retry) {
        // Network error: stop sync loop and trigger backoff wait
        const delay = backoffIntervals[backoffIndex] || 60000;
        backoffIndex = Math.min(backoffIndex + 1, backoffIntervals.length - 1);
        
        if (statusCallback) {
          statusCallback({ 
            status: 'offline', 
            message: `Network error. Retrying sync in ${delay / 1000}s...` 
          });
        }
        
        setTimeout(() => {
          isSyncing = false;
          runSyncLoop();
        }, delay);
        return; // Terminate execution, timeout will restart it
      } else {
        // Data/Policy violation error: Quarantine this item to prevent blockages
        console.warn(`Quarantining sync item ${item.id} due to permanent error:`, result.error);
        
        await dbOps.delete(STORES.SYNC_QUEUE, item.id);
        
        const quarantineItem = {
          ...item,
          error: result.error,
          quarantined_at: new Date().toISOString()
        };
        await dbOps.put(STORES.QUARANTINE_QUEUE, quarantineItem);

        // Mark local record as failed
        if (item.action !== 'DELETE') {
          const originalRecord = await dbOps.get(item.tableName, item.recordId);
          if (originalRecord) {
            originalRecord.sync_status = 'failed';
            originalRecord.last_sync_error = result.error;
            await dbOps.put(item.tableName, originalRecord);
          }
        }
      }
    }
  } catch (err) {
    console.error('Fatal error in sync loop:', err);
  } finally {
    isSyncing = false;
  }
}

// Sync process details
async function processQueueItem(item) {
  const { tableName, recordId, action, data } = item;

  try {
    // 1. Check if server reachable
    if (!navigator.onLine) {
      return { success: false, retry: true, error: 'Offline' };
    }

    // 2. Perform database actions on Supabase
    if (action === 'DELETE') {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', recordId);
      
      if (error) throw error;
    } else {
      // Upsert covers INSERT and UPDATE actions
      const { error } = await supabase
        .from(tableName)
        .upsert(data);
      
      if (error) throw error;
    }

    return { success: true };
  } catch (err) {
    console.error(`Sync error on table ${tableName}, id ${recordId}:`, err);
    
    // Categorize error (Network vs Database Validation)
    const isNetworkError = 
      err.message?.toLowerCase().includes('failed to fetch') ||
      err.message?.toLowerCase().includes('network error') ||
      err.message?.toLowerCase().includes('load failed') ||
      err.status === 0 ||
      err.status === 502 ||
      err.status === 503 ||
      err.status === 504;

    if (isNetworkError) {
      return { success: false, retry: true, error: err.message };
    } else {
      // RLS error, data type validation error, foreign key failure, etc.
      return { success: false, retry: false, error: err.message || JSON.stringify(err) };
    }
  }
}
