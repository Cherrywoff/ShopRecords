// ==========================================
// OFFLINE ENGINE - INDEXEDDB WRAPPER
// ==========================================

const DB_NAME = 'shoprecords_local_db';
const DB_VERSION = 1;

export const STORES = {
  SHOPS: 'shops',
  USERS: 'users',
  PRODUCTS: 'products',
  CUSTOMERS: 'customers',
  SALES: 'sales',
  SALE_ITEMS: 'sale_items',
  EXPENSES: 'expenses',
  SUPPLIERS: 'suppliers',
  SUPPLIER_TRANSACTIONS: 'supplier_transactions',
  CUSTOMER_TRANSACTIONS: 'customer_transactions',
  DAILY_CLOSINGS: 'daily_closings',
  SYNC_QUEUE: 'sync_queue',
  QUARANTINE_QUEUE: 'quarantine_queue',
  OFFLINE_AUTH_CACHE: 'offline_auth_cache' // Cache role and credentials for offline cashier login
};

// Open connection to IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (e) => {
      console.error('IndexedDB open error:', e);
      reject(e.target.error);
    };

    request.onsuccess = (e) => {
      resolve(e.target.result);
    };

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      
      // Create object stores for each model
      Object.values(STORES).forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          if (storeName === STORES.SYNC_QUEUE || storeName === STORES.QUARANTINE_QUEUE) {
            db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
          } else {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
      });
    };
  });
}

// Generate client-side UUID (v4 equivalent) for offline creation
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Database helper operations
export const dbOps = {
  // Read all records from a store
  async getAll(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  // Read a single record from a store
  async get(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  // Insert or update a record in a store
  async put(storeName, val) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(val);

      request.onsuccess = () => resolve(val);
      request.onerror = () => reject(request.error);
    });
  },

  // Delete a record from a store
  async delete(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve(key);
      request.onerror = () => reject(request.error);
    });
  },

  // Batch insert/update
  async putBatch(storeName, items) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      items.forEach(item => {
        store.put(item);
      });

      transaction.oncomplete = () => resolve(items);
      transaction.onerror = () => reject(transaction.error);
    });
  },

  // Clear all records in a store
  async clearStore(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // Reset entire database (except auth cache if needed, but usually complete reset)
  async resetAll() {
    const db = await openDB();
    db.close();
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};
