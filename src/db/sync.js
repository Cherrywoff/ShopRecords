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
  STORES.USERS,
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

  // Periodically check/push sync queue every 3 seconds (resilient auto-sync fallback)
  setInterval(() => {
    triggerSync();
  }, 3000);

  // Automatically retry any quarantined items every 15 seconds
  setInterval(async () => {
    try {
      const q = await dbOps.getAll(STORES.QUARANTINE_QUEUE);
      if (q.length > 0) {
        console.log(`Auto-retrying ${q.length} quarantined sync items...`);
        await retryQuarantinedItems();
      }
    } catch (e) {
      console.warn('Auto-retry quarantined failed:', e);
    }
  }, 15000);

  // Initial scan
  triggerSync();
}

// Trigger a sync pass immediately
export function triggerSync() {
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

    // Remove updated_at for tables that do not have this column in Supabase
    const noUpdatedAtTables = [
      STORES.CUSTOMER_TRANSACTIONS,
      STORES.SUPPLIER_TRANSACTIONS,
      STORES.SALE_ITEMS,
      STORES.DAILY_CLOSINGS
    ];
    if (noUpdatedAtTables.includes(tableName)) {
      delete syncData.updated_at;
    }
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
    while (true) {
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
      // Last-Write-Wins timestamp check
      if (data && data.updated_at) {
        try {
          const { data: serverRecord, error: serverError } = await supabase
            .from(tableName)
            .select('updated_at')
            .eq('id', recordId)
            .maybeSingle();
          
          if (!serverError && serverRecord && serverRecord.updated_at) {
            const serverTime = new Date(serverRecord.updated_at).getTime();
            const localTime = new Date(data.updated_at).getTime();
            
            if (serverTime > localTime) {
              console.log(`Sync conflict resolved (LWW): Server record is newer than local update. Skipping upsert for table ${tableName}, id ${recordId}.`);
              return { success: true };
            }
          }
        } catch (e) {
          console.warn(`LWW check skipped for ${tableName} due to error or missing column:`, e);
        }
      }

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

export async function retryQuarantinedItems() {
  try {
    const quarantined = await dbOps.getAll(STORES.QUARANTINE_QUEUE);
    if (quarantined.length === 0) return 0;
    
    for (const item of quarantined) {
      const { error, quarantined_at, id, ...cleanItem } = item;
      await dbOps.put(STORES.SYNC_QUEUE, cleanItem);
      await dbOps.delete(STORES.QUARANTINE_QUEUE, item.id);
    }
    
    triggerSync();
    return quarantined.length;
  } catch (e) {
    console.error('Failed to retry quarantined items:', e);
    return 0;
  }
}
