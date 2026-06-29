// ==========================================
// APPLICATION STATE MANAGER & CONTEXT PROVIDER
// ==========================================

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { dbOps, STORES, generateUUID } from '../db/db';
import { queueSyncAction, startSyncEngine, retryQuarantinedItems } from '../db/sync';
import { supabase, isSupabaseConfigured } from '../supabase';

const AppContext = createContext(null);

export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  // Theme State
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  // Network & Sync State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncState, setSyncState] = useState({ status: 'synced', message: 'All records synced.' });

  // Auth State
  const [currentUser, setCurrentUser] = useState(null); // { id, name, email, role, shop_id }
  const [currentShop, setCurrentShop] = useState(null); // { id, name, plan, expiry_date, employee_limit, device_limit }
  const [loadingAuth, setLoadingAuth] = useState(true);

  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Impersonation / Support Mode State
  const [supportMode, setSupportMode] = useState({
    isActive: false,
    adminUser: null, // Stores the real admin user details
    adminShop: null, // Stores the admin's original shop
    supportRole: 'Support'
  });

  // Business Operational Data State (Local cache for performance)
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [saleItems, setSaleItems] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [dailyClosings, setDailyClosings] = useState([]);
  const [quarantineQueue, setQuarantineQueue] = useState([]);

  // POS Operational Cart State
  const [cart, setCart] = useState([]);

  // Apply Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Network listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Start background Sync Engine
    startSyncEngine((syncStatus) => {
      setSyncState(syncStatus);
      // Whenever sync status changes to synced, re-load local data to catch updates
      if (syncStatus.status === 'synced') {
        loadDataFromIndexedDB();
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check initial login session
  useEffect(() => {
    const checkSession = async () => {
      setLoadingAuth(true);
      try {
        const cachedSession = localStorage.getItem('offline_session');
        if (cachedSession) {
          const cachedUser = JSON.parse(cachedSession);
          
          if (isSupabaseConfigured && navigator.onLine) {
            const { data: userRecord } = await supabase
              .from('users')
              .select('*')
              .eq('email', cachedUser.email)
              .eq('password', cachedUser.password)
              .single();

            if (userRecord) {
              if (userRecord.status === 'Suspended') {
                localStorage.removeItem('offline_session');
                setCurrentUser(null);
                setCurrentShop(null);
                alert('Your account is suspended. Contact Admin.');
              } else {
                let shop = null;
                if (userRecord.shop_id) {
                  const { data: shopRecord } = await supabase
                    .from('shops')
                    .select('*')
                    .eq('id', userRecord.shop_id)
                    .single();
                  if (shopRecord) shop = shopRecord;
                }

                const cleanProfile = {
                  id: userRecord.id,
                  name: userRecord.name,
                  email: userRecord.email,
                  password: userRecord.password,
                  role: userRecord.role,
                  shop_id: userRecord.shop_id
                };
                setCurrentUser(cleanProfile);
                setCurrentShop(shop);
                
                await dbOps.put(STORES.USERS, cleanProfile);
                if (shop) await dbOps.put(STORES.SHOPS, shop);
              }
            } else {
              localStorage.removeItem('offline_session');
              setCurrentUser(null);
              setCurrentShop(null);
            }
          } else {
            setCurrentUser(cachedUser);
            if (cachedUser.shop_id) {
              const shop = await dbOps.get(STORES.SHOPS, cachedUser.shop_id);
              setCurrentShop(shop);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching session:', err);
      } finally {
        setLoadingAuth(false);
      }
    };
    
    checkSession();
  }, [isOnline]);

  const pullAllTablesFromCloud = async () => {
    const activeUser = currentUserRef.current;
    if (!isSupabaseConfigured || !navigator.onLine || !activeUser) return;
    
    try {
      const isSystemAdmin = activeUser.role === 'Admin';
      const myShopId = activeUser.shop_id;

      // 1. Fetch Shops
      let shopsQuery = supabase.from('shops').select('*');
      if (!isSystemAdmin) {
        if (myShopId) {
          shopsQuery = shopsQuery.eq('id', myShopId);
        } else {
          shopsQuery = null;
        }
      }
      if (shopsQuery) {
        const { data: shopsData } = await shopsQuery;
        if (shopsData) {
          for (const s of shopsData) await dbOps.put(STORES.SHOPS, s);
        }
      }

      // Helper to pull a table
      const pullTable = async (tableName, storeName) => {
        try {
          let query;
          if (tableName === 'sale_items') {
            // Join with sales to filter by shop_id since sale_items has no direct shop_id column
            query = supabase
              .from('sale_items')
              .select('*, sales!inner(shop_id)')
              .eq('sales.shop_id', myShopId);
          } else {
            query = supabase.from(tableName).select('*');
            if (!isSystemAdmin && tableName !== 'shops') {
              query = query.eq('shop_id', myShopId);
            }
          }
          const { data, error } = await query;
          if (error) {
            console.error(`Error pulling ${tableName}:`, error);
            return;
          }
          if (data) {
            for (let row of data) {
              try {
                let cleanRow = row;
                if (tableName === 'sale_items' && row.sales) {
                  // Strip the nested sales object so we store a clean sale_item record locally
                  const { sales, ...rest } = row;
                  cleanRow = rest;
                }
                const local = await dbOps.get(storeName, cleanRow.id);
                if (!local || local.sync_status !== 'pending') {
                  await dbOps.put(storeName, cleanRow);
                }
              } catch (dbErr) {
                console.error(`Database write error on table ${tableName}, id ${row.id}:`, dbErr);
              }
            }
          }
        } catch (pullErr) {
          console.error(`Failed to pull table ${tableName}:`, pullErr);
        }
      };

      // Pull other tables
      await pullTable('users', STORES.USERS);
      await pullTable('products', STORES.PRODUCTS);
      await pullTable('customers', STORES.CUSTOMERS);
      await pullTable('sales', STORES.SALES);
      await pullTable('sale_items', STORES.SALE_ITEMS);
      await pullTable('expenses', STORES.EXPENSES);
      await pullTable('suppliers', STORES.SUPPLIERS);
      await pullTable('supplier_transactions', STORES.SUPPLIER_TRANSACTIONS);
      await pullTable('customer_transactions', STORES.CUSTOMER_TRANSACTIONS);
      await pullTable('daily_closings', STORES.DAILY_CLOSINGS);

      await loadDataFromIndexedDB();
    } catch (e) {
      console.error('Failed to pull remote data:', e);
    }
  };

  // Read data from IndexedDB local stores into React state
  const loadDataFromIndexedDB = async () => {
    try {
      const p = await dbOps.getAll(STORES.PRODUCTS);
      const c = await dbOps.getAll(STORES.CUSTOMERS);
      const s = await dbOps.getAll(STORES.SALES);
      const si = await dbOps.getAll(STORES.SALE_ITEMS);
      const ex = await dbOps.getAll(STORES.EXPENSES);
      const sup = await dbOps.getAll(STORES.SUPPLIERS);
      const dc = await dbOps.getAll(STORES.DAILY_CLOSINGS);
      const q = await dbOps.getAll(STORES.QUARANTINE_QUEUE);

      const activeUser = currentUserRef.current;
      const isAdmin = activeUser?.role === 'Admin';

      setProducts(p.filter(item => isAdmin || !item.shop_id || item.shop_id === activeUser?.shop_id));
      setCustomers(c.filter(item => isAdmin || !item.shop_id || item.shop_id === activeUser?.shop_id));
      setSales(s.filter(item => isAdmin || !item.shop_id || item.shop_id === activeUser?.shop_id));
      setSaleItems(si);
      setExpenses(ex.filter(item => isAdmin || !item.shop_id || item.shop_id === activeUser?.shop_id));
      setSuppliers(sup.filter(item => isAdmin || !item.shop_id || item.shop_id === activeUser?.shop_id));
      setDailyClosings(dc.filter(item => isAdmin || !item.shop_id || item.shop_id === activeUser?.shop_id));
      setQuarantineQueue(q);
    } catch (e) {
      console.error('Error loading data from IndexedDB:', e);
    }
  };

  // Trigger reloading data on active user changes
  useEffect(() => {
    if (currentUser) {
      loadDataFromIndexedDB();
      pullAllTablesFromCloud();
    } else {
      // Clear data state on logout
      setProducts([]);
      setCustomers([]);
      setSales([]);
      setSaleItems([]);
      setExpenses([]);
      setSuppliers([]);
      setDailyClosings([]);
      setQuarantineQueue([]);
    }
  }, [currentUser]);

  // Pull on network return
  useEffect(() => {
    if (isOnline && currentUser) {
      pullAllTablesFromCloud();
    }
  }, [isOnline]);

  // Background sync auto-refresh interval (2 seconds fallback)
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      pullAllTablesFromCloud();
    }, 2000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Setup Supabase Realtime Channels
  useEffect(() => {
    if (!isSupabaseConfigured || !currentUser || !navigator.onLine) return;

    const myShopId = currentUser.shop_id;
    const isSystemAdmin = currentUser.role === 'Admin';

    const channel = supabase
      .channel('db-realtime-channel')
      .on('postgres_changes', { event: '*', schema: 'public' }, async (payload) => {
        const { table, eventType, new: newRecord, old: oldRecord } = payload;
        
        let storeName = null;
        switch (table) {
          case 'shops': storeName = STORES.SHOPS; break;
          case 'users': storeName = STORES.USERS; break;
          case 'products': storeName = STORES.PRODUCTS; break;
          case 'customers': storeName = STORES.CUSTOMERS; break;
          case 'sales': storeName = STORES.SALES; break;
          case 'sale_items': storeName = STORES.SALE_ITEMS; break;
          case 'expenses': storeName = STORES.EXPENSES; break;
          case 'suppliers': storeName = STORES.SUPPLIERS; break;
          case 'supplier_transactions': storeName = STORES.SUPPLIER_TRANSACTIONS; break;
          case 'customer_transactions': storeName = STORES.CUSTOMER_TRANSACTIONS; break;
          case 'daily_closings': storeName = STORES.DAILY_CLOSINGS; break;
          default: break;
        }

        if (!storeName) return;

        if (!isSystemAdmin && table !== 'shops' && newRecord && newRecord.shop_id !== myShopId) {
          return;
        }
        if (!isSystemAdmin && table === 'shops' && newRecord && newRecord.id !== myShopId) {
          return;
        }

        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const localRecord = await dbOps.get(storeName, newRecord.id);
          if (!localRecord || localRecord.sync_status !== 'pending') {
            newRecord.sync_status = 'synced';
            await dbOps.put(storeName, newRecord);
            await loadDataFromIndexedDB();
          }
        } else if (eventType === 'DELETE') {
          await dbOps.delete(storeName, oldRecord.id);
          await loadDataFromIndexedDB();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, isOnline]);

  // --- SYSTEM GUARDS ---
  const isSubscriptionActive = () => {
    if (!currentShop) return true; // Offline sandbox/admin mode
    if (currentUser?.role === 'Admin') return true;
    const expiry = new Date(currentShop.expiry_date);
    return expiry.getTime() > Date.now();
  };

  const getAuditMetadata = () => {
    if (supportMode.isActive) {
      return {
        performed_by_user_id: supportMode.adminUser.id,
        performed_by_name: `Support (${supportMode.adminUser.name})`,
        performed_by_role: 'Support',
        updated_at: new Date().toISOString()
      };
    }
    return {
      performed_by_user_id: currentUser?.id || 'offline-sandbox',
      performed_by_name: currentUser?.name || 'Offline User',
      performed_by_role: currentUser?.role || 'Owner',
      updated_at: new Date().toISOString()
    };
  };

  // --- POS CART CONTROLS ---
  const addToCart = (product, quantity = 1) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.product.id === product.id);
      if (existingItem) {
        return prevCart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prevCart, { product, quantity, customPrice: product.selling_price }];
    });
  };

  const updateCartQty = (productId, qty) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.product.id === productId ? { ...item, quantity: qty } : item
      )
    );
  };

  const updateCartPrice = (productId, price) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.product.id === productId ? { ...item, customPrice: parseFloat(price) || 0 } : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => setCart([]);

  // --- BILLING / SALES TRANSACTIONS ---
  const checkout = async ({ paymentMethod, customerId, discountAmount = 0, paymentDetails = null }) => {
    if (!isSubscriptionActive()) {
      alert('Subscription expired! Active sales billing has been suspended. Please renew.');
      return;
    }
    if (cart.length === 0) return;

    // Generate unique invoice ID and number
    const saleId = generateUUID();
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    // Resolve customer details
    let customerObj = null;
    if (customerId) {
      customerObj = await dbOps.get(STORES.CUSTOMERS, customerId);
    }

    let subTotal = 0;
    let gstTotal = 0;
    const items = [];

    // Compile items and adjust stock levels locally (sequentially to prevent races!)
    for (const cartItem of cart) {
      const price = cartItem.customPrice;
      const qty = cartItem.quantity;
      const basePrice = price / (1 + (cartItem.product.gst_rate / 100));
      const gstAmount = (price - basePrice) * qty;

      subTotal += price * qty;
      gstTotal += gstAmount;

      // Adjust stock levels
      const updatedProduct = { ...cartItem.product };
      updatedProduct.current_stock = parseFloat(updatedProduct.current_stock) - qty;
      
      // Await database write operations to prevent concurrent queue race condition
      await dbOps.put(STORES.PRODUCTS, updatedProduct);
      await queueSyncAction(STORES.PRODUCTS, updatedProduct.id, 'UPDATE', updatedProduct);

      items.push({
        id: generateUUID(),
        sale_id: saleId,
        product_id: cartItem.product.id,
        product_name: cartItem.product.name,
        barcode: cartItem.product.barcode,
        quantity: qty,
        price: price,
        gst_rate: cartItem.product.gst_rate,
        gst_amount: gstAmount
      });
    }

    const netTotal = subTotal - discountAmount;

    // Create Invoice Record
    const saleRecord = {
      id: saleId,
      shop_id: currentUser.shop_id,
      invoice_number: invoiceNumber,
      customer_id: customerId || null,
      customer_name: customerObj?.name || 'Walk-in Customer',
      customer_phone: customerObj?.phone || '',
      total_amount: netTotal,
      discount_amount: discountAmount,
      gst_amount: gstTotal,
      payment_method: paymentMethod,
      payment_details: paymentDetails,
      status: 'Completed',
      created_at: new Date().toISOString(),
      ...getAuditMetadata()
    };

    // Save locally
    await dbOps.put(STORES.SALES, saleRecord);
    await dbOps.putBatch(STORES.SALE_ITEMS, items);

    // Queue Sync
    await queueSyncAction(STORES.SALES, saleId, 'INSERT', saleRecord);
    for (const item of items) {
      await dbOps.put(STORES.SALE_ITEMS, item);
      await queueSyncAction(STORES.SALE_ITEMS, item.id, 'INSERT', item);
    }

    // Handle Udhar balance modifications
    if (paymentMethod === 'Udhar' && customerId && customerObj) {
      customerObj.outstanding_balance = parseFloat(customerObj.outstanding_balance) + netTotal;
      await dbOps.put(STORES.CUSTOMERS, customerObj);
      await queueSyncAction(STORES.CUSTOMERS, customerObj.id, 'UPDATE');

      // Create Udhar record transaction
      const udharTx = {
        id: generateUUID(),
        shop_id: currentUser.shop_id,
        customer_id: customerId,
        type: 'Udhar',
        amount: netTotal,
        description: `Credit invoice ${invoiceNumber}`,
        sale_id: saleId,
        created_at: new Date().toISOString(),
        ...getAuditMetadata()
      };
      await dbOps.put(STORES.CUSTOMER_TRANSACTIONS, udharTx);
      await queueSyncAction(STORES.CUSTOMER_TRANSACTIONS, udharTx.id, 'INSERT', udharTx);
    }

    clearCart();
    await loadDataFromIndexedDB();
    return saleRecord;
  };

  const refundSale = async (saleId) => {
    if (!isSubscriptionActive()) {
      alert('Subscription expired! Write operations locked.');
      return;
    }
    
    const sale = await dbOps.get(STORES.SALES, saleId);
    if (!sale || sale.status === 'Refunded') return;

    // Fetch items
    const items = await dbOps.getAll(STORES.SALE_ITEMS);
    const relatedItems = items.filter((i) => i.sale_id === saleId);

    // Reverse stock deductions
    for (const item of relatedItems) {
      if (item.product_id) {
        const product = await dbOps.get(STORES.PRODUCTS, item.product_id);
        if (product) {
          product.current_stock = parseFloat(product.current_stock) + parseFloat(item.quantity);
          await dbOps.put(STORES.PRODUCTS, product);
          await queueSyncAction(STORES.PRODUCTS, product.id, 'UPDATE');
        }
      }
    }

    // If Udhar payment, deduct balance
    if (sale.payment_method === 'Udhar' && sale.customer_id) {
      const customer = await dbOps.get(STORES.CUSTOMERS, sale.customer_id);
      if (customer) {
        customer.outstanding_balance = parseFloat(customer.outstanding_balance) - sale.total_amount;
        await dbOps.put(STORES.CUSTOMERS, customer);
        await queueSyncAction(STORES.CUSTOMERS, customer.id, 'UPDATE');

        // Log balancing customer transaction
        const udharRefundTx = {
          id: generateUUID(),
          shop_id: currentUser.shop_id,
          customer_id: sale.customer_id,
          type: 'Payment',
          amount: sale.total_amount,
          description: `Reversal of refunded invoice ${sale.invoice_number}`,
          sale_id: saleId,
          created_at: new Date().toISOString(),
          ...getAuditMetadata()
        };
        await dbOps.put(STORES.CUSTOMER_TRANSACTIONS, udharRefundTx);
        await queueSyncAction(STORES.CUSTOMER_TRANSACTIONS, udharRefundTx.id, 'INSERT', udharRefundTx);
      }
    }

    // Set invoice status to Refunded
    sale.status = 'Refunded';
    const audit = getAuditMetadata();
    sale.updated_at = audit.updated_at;
    sale.performed_by_user_id = audit.performed_by_user_id;
    sale.performed_by_name = audit.performed_by_name;
    sale.performed_by_role = audit.performed_by_role;

    await dbOps.put(STORES.SALES, sale);
    await queueSyncAction(STORES.SALES, sale.id, 'UPDATE', sale);
    
    await loadDataFromIndexedDB();
  };

  // --- CRUD UTILITIES (AUTOMATICALLY OFF-LINE QUEUED) ---

  // 1. PRODUCTS
  const saveProduct = async (product) => {
    if (!isSubscriptionActive()) return alert('Subscription expired! Write operations locked.');

    // Case-insensitive duplicate check
    const existingProducts = await dbOps.getAll(STORES.PRODUCTS);
    const existing = existingProducts.find(p => 
      p.id !== product.id && 
      p.name.trim().toLowerCase() === product.name.trim().toLowerCase() &&
      (!p.shop_id || p.shop_id === currentUser.shop_id)
    );

    let productRecord;
    let isNew = !product.id;
    let prodId = product.id || generateUUID();

    if (existing) {
      if (existing.is_unlisted) {
        // Merge the unlisted item into a listed item, accounting for negative stock!
        const inputStock = parseFloat(product.current_stock || 0);
        const existingStock = parseFloat(existing.current_stock || 0);
        
        productRecord = {
          ...existing,
          ...product,
          id: existing.id, // Keep the existing ID so transactions linking to it remain valid
          current_stock: existingStock + inputStock,
          is_unlisted: false,
          shop_id: currentUser.shop_id,
          ...getAuditMetadata()
        };
        prodId = existing.id;
        isNew = false; // It is an UPDATE now
      } else {
        alert(`Error: A product named "${product.name}" already exists in your inventory. Duplicate names are not allowed.`);
        throw new Error('Duplicate product name');
      }
    } else {
      productRecord = {
        ...product,
        id: prodId,
        shop_id: currentUser.shop_id,
        ...getAuditMetadata()
      };
    }

    await dbOps.put(STORES.PRODUCTS, productRecord);
    await queueSyncAction(STORES.PRODUCTS, prodId, isNew ? 'INSERT' : 'UPDATE', productRecord);
    await loadDataFromIndexedDB();
  };

  const deleteProduct = async (productId) => {
    if (!isSubscriptionActive()) return alert('Subscription expired! Write operations locked.');
    await dbOps.delete(STORES.PRODUCTS, productId);
    await queueSyncAction(STORES.PRODUCTS, productId, 'DELETE');
    await loadDataFromIndexedDB();
  };

  // 2. CUSTOMERS
  const saveCustomer = async (customer) => {
    if (!isSubscriptionActive()) return alert('Subscription expired!');
    const isNew = !customer.id;
    const custId = customer.id || generateUUID();
    const custRecord = {
      ...customer,
      id: custId,
      shop_id: currentUser.shop_id,
      outstanding_balance: customer.outstanding_balance || 0,
      ...getAuditMetadata()
    };
    await dbOps.put(STORES.CUSTOMERS, custRecord);
    await queueSyncAction(STORES.CUSTOMERS, custId, isNew ? 'INSERT' : 'UPDATE', custRecord);
    await loadDataFromIndexedDB();
    return custRecord;
  };

  const logCustomerPayment = async (customerId, amount, description, paymentMethod = 'Cash') => {
    if (!isSubscriptionActive()) return alert('Subscription expired!');
    const customer = await dbOps.get(STORES.CUSTOMERS, customerId);
    if (!customer) return;

    customer.outstanding_balance = parseFloat(customer.outstanding_balance) - parseFloat(amount);
    await dbOps.put(STORES.CUSTOMERS, customer);
    await queueSyncAction(STORES.CUSTOMERS, customer.id, 'UPDATE');

    const paymentTx = {
      id: generateUUID(),
      shop_id: currentUser.shop_id,
      customer_id: customerId,
      type: 'Payment',
      amount: parseFloat(amount),
      payment_method: paymentMethod,
      description: description || `${paymentMethod} Payment Received`,
      created_at: new Date().toISOString(),
      ...getAuditMetadata()
    };
    await dbOps.put(STORES.CUSTOMER_TRANSACTIONS, paymentTx);
    await queueSyncAction(STORES.CUSTOMER_TRANSACTIONS, paymentTx.id, 'INSERT', paymentTx);
    await loadDataFromIndexedDB();
    return paymentTx;
  };

  // 3. EXPENSES
  const saveExpense = async (expense) => {
    if (!isSubscriptionActive()) return alert('Subscription expired!');
    const isNew = !expense.id;
    const expId = expense.id || generateUUID();
    const expenseRecord = {
      ...expense,
      id: expId,
      shop_id: currentUser.shop_id,
      ...getAuditMetadata()
    };
    await dbOps.put(STORES.EXPENSES, expenseRecord);
    await queueSyncAction(STORES.EXPENSES, expId, isNew ? 'INSERT' : 'UPDATE', expenseRecord);
    await loadDataFromIndexedDB();
  };

  // 4. SUPPLIERS
  const saveSupplier = async (supplier) => {
    if (!isSubscriptionActive()) return alert('Subscription expired!');
    const isNew = !supplier.id;
    const supId = supplier.id || generateUUID();
    const supplierRecord = {
      ...supplier,
      id: supId,
      shop_id: currentUser.shop_id,
      outstanding_amount: supplier.outstanding_amount || 0,
      ...getAuditMetadata()
    };
    await dbOps.put(STORES.SUPPLIERS, supplierRecord);
    await queueSyncAction(STORES.SUPPLIERS, supId, isNew ? 'INSERT' : 'UPDATE', supplierRecord);
    await loadDataFromIndexedDB();
  };

  const logSupplierTransaction = async (supplierId, type, amount, description, paymentMethod = 'Cash') => {
    if (!isSubscriptionActive()) return alert('Subscription expired!');
    const supplier = await dbOps.get(STORES.SUPPLIERS, supplierId);
    if (!supplier) return;

    if (type === 'Purchase') {
      supplier.outstanding_amount = parseFloat(supplier.outstanding_amount) + parseFloat(amount);
    } else {
      supplier.outstanding_amount = Math.max(0, parseFloat(supplier.outstanding_amount) - parseFloat(amount));
    }

    await dbOps.put(STORES.SUPPLIERS, supplier);
    await queueSyncAction(STORES.SUPPLIERS, supplier.id, 'UPDATE');

    const txRecord = {
      id: generateUUID(),
      shop_id: currentUser.shop_id,
      supplier_id: supplierId,
      type,
      amount: parseFloat(amount),
      payment_method: paymentMethod,
      description: description || (type === 'Purchase' ? 'Inventory Purchase' : `${paymentMethod} Payment Disbursed`),
      created_at: new Date().toISOString(),
      ...getAuditMetadata()
    };
    await dbOps.put(STORES.SUPPLIER_TRANSACTIONS, txRecord);
    await queueSyncAction(STORES.SUPPLIER_TRANSACTIONS, txRecord.id, 'INSERT', txRecord);
    await loadDataFromIndexedDB();
  };

  // 5. DAILY CLOSING
  const saveDailyClosing = async (closingData) => {
    if (!isSubscriptionActive()) return alert('Subscription expired!');
    const closingId = generateUUID();
    const closingRecord = {
      id: closingId,
      shop_id: currentUser.shop_id,
      ...closingData,
      created_at: new Date().toISOString(),
      ...getAuditMetadata()
    };
    await dbOps.put(STORES.DAILY_CLOSINGS, closingRecord);
    await queueSyncAction(STORES.DAILY_CLOSINGS, closingId, 'INSERT', closingRecord);
    await loadDataFromIndexedDB();
  };

  // --- AUTH SERVICES ---
  const handleSignUp = async (email, password, name, shopName, isAdmin = false) => {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (data.user) {
          let shopId = null;
          let newShop = null;

          if (!isAdmin) {
            // 1. Create a Shop
            shopId = generateUUID();
            newShop = {
              id: shopId,
              name: shopName,
              plan: 'Basic',
              expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 Days Trial
              employee_limit: 2,
              device_limit: 1,
              created_at: new Date().toISOString()
            };
            await supabase.from('shops').insert(newShop);
            await dbOps.put(STORES.SHOPS, newShop);
          }

          // 2. Create Profile
          const newProfile = {
            id: data.user.id,
            shop_id: shopId,
            role: isAdmin ? 'Admin' : 'Owner',
            name: name,
            status: 'Active',
            created_at: new Date().toISOString()
          };

          await supabase.from('users').insert(newProfile);
          await dbOps.put(STORES.USERS, newProfile);
          
          alert('Registration successful! Please confirm your login details.');
          return true;
        }
      } catch (err) {
        alert(err.message);
        return false;
      }
    } else {
      // Offline Signup Sandbox Mode
      const shopId = isAdmin ? null : generateUUID();
      const userId = generateUUID();
      let localShop = null;
      if (!isAdmin) {
        localShop = {
          id: shopId,
          name: shopName,
          plan: 'Premium',
          expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          employee_limit: 5,
          device_limit: 3,
          created_at: new Date().toISOString()
        };
        await dbOps.put(STORES.SHOPS, localShop);
      }
      const localProfile = {
        id: userId,
        shop_id: shopId,
        role: isAdmin ? 'Admin' : 'Owner',
        name,
        email,
        status: 'Active',
        created_at: new Date().toISOString()
      };
      await dbOps.put(STORES.USERS, localProfile);
      await dbOps.put(STORES.OFFLINE_AUTH_CACHE, {
        id: userId,
        email,
        name,
        role: isAdmin ? 'Admin' : 'Owner',
        shop_id: shopId,
        shopName: shopName || 'Admin Sandbox'
      });
      alert('Offline signup successful!');
      
      const loggedUser = { id: userId, name, email, role: isAdmin ? 'Admin' : 'Owner', shop_id: shopId };
      setCurrentUser(loggedUser);
      if (localShop) setCurrentShop(localShop);
      localStorage.setItem('offline_session', JSON.stringify(loggedUser));
      return true;
    }
  };

  const handleLogin = async (email, password) => {
    // Helper to perform offline authentication checks
    const tryOfflineLogin = async () => {
      const offlineUsers = await dbOps.getAll(STORES.USERS);
      const matchedUser = offlineUsers.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );

      if (matchedUser) {
        setCurrentUser(matchedUser);
        if (matchedUser.shop_id) {
          const localShop = await dbOps.get(STORES.SHOPS, matchedUser.shop_id);
          setCurrentShop(localShop);
        }
        localStorage.setItem('offline_session', JSON.stringify(matchedUser));
        alert(`Offline login successful! Logged in as ${matchedUser.role}.`);
        return true;
      } else {
        alert('Authentication failed. No offline cache record exists for this account. Log in once online first.');
        return false;
      }
    };

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        const { data: userRecord, error } = await supabase
          .from('users')
          .select('*')
          .ilike('email', email)
          .eq('password', password)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!userRecord) {
          throw new Error('Invalid User ID or password.');
        }

        if (userRecord.status === 'Suspended') {
          alert('Your profile has been suspended by the administrator.');
          return false;
        }

        let shop = null;
        if (userRecord.shop_id) {
          const { data: shopRecord } = await supabase
            .from('shops')
            .select('*')
            .eq('id', userRecord.shop_id)
            .single();
          if (shopRecord) shop = shopRecord;
        }
        const cleanProfile = {
          id: userRecord.id,
          name: userRecord.name,
          email: userRecord.email,
          password: userRecord.password,
          role: userRecord.role,
          shop_id: userRecord.shop_id
        };

        setCurrentUser(cleanProfile);
        setCurrentShop(shop);

        // Save session
        localStorage.setItem('offline_session', JSON.stringify(cleanProfile));

        // Cache in IndexedDB
        await dbOps.put(STORES.USERS, cleanProfile);
        if (shop) await dbOps.put(STORES.SHOPS, shop);
        await dbOps.put(STORES.OFFLINE_AUTH_CACHE, {
          id: cleanProfile.id,
          email: cleanProfile.email,
          name: cleanProfile.name,
          role: cleanProfile.role,
          shop_id: cleanProfile.shop_id,
          shopName: shop?.name || ''
        });

        return true;
      } catch (err) {
        // Check if the error is a connection failure
        const isNetworkFailure = 
          err.message?.toLowerCase().includes('failed to fetch') ||
          err.message?.toLowerCase().includes('network') ||
          err.status === 0 ||
          err.status === 502 ||
          err.status === 503 ||
          err.status === 504;

        if (isNetworkFailure) {
          console.warn('Database connection failed on login, attempting offline login fallback...', err);
          return await tryOfflineLogin();
        }

        alert(err.message);
        return false;
      }
    } else {
      return await tryOfflineLogin();
    }
  };

  const handleLogout = async () => {
    // Clear Session
    setCurrentUser(null);
    setCurrentShop(null);
    localStorage.removeItem('offline_session');
    
    if (supportMode.isActive) {
      setSupportMode({
        isActive: false,
        adminUser: null,
        adminShop: null,
        supportRole: 'Support'
      });
    }
  };

  // --- SUPPORT MODE (ADMIN ACCESS SHIELD) ---
  const startSupportSession = async (targetShopId, viewRole) => {
    if (currentUser?.role !== 'Admin') return alert('Access Denied. Owner validation failed.');

    // Save Admin identity
    const adminUserBackup = { ...currentUser };
    const adminShopBackup = currentShop ? { ...currentShop } : null;

    // Load target shop configuration
    let targetShop = null;
    if (isSupabaseConfigured && navigator.onLine) {
      const { data } = await supabase.from('shops').select('*').eq('id', targetShopId).single();
      targetShop = data;
    } else {
      targetShop = await dbOps.get(STORES.SHOPS, targetShopId);
    }

    if (!targetShop) return alert('Shop not found.');

    setSupportMode({
      isActive: true,
      adminUser: adminUserBackup,
      adminShop: adminShopBackup,
      supportRole: viewRole
    });

    const spoofedUser = {
      id: adminUserBackup.id,
      name: `Support (${adminUserBackup.name})`,
      email: adminUserBackup.email,
      role: viewRole,
      shop_id: targetShopId
    };

    setCurrentUser(spoofedUser);
    setCurrentShop(targetShop);
    alert(`Support Session Initiated: Inside ${targetShop.name} as ${viewRole}`);
  };

  const stopSupportSession = () => {
    if (!supportMode.isActive) return;
    
    const adminUser = supportMode.adminUser;
    const adminShop = supportMode.adminShop;

    setSupportMode({
      isActive: false,
      adminUser: null,
      adminShop: null,
      supportRole: 'Support'
    });

    setCurrentUser(adminUser);
    setCurrentShop(adminShop);
    alert('Support mode ended. Restored Admin Workspace.');
  };

  // --- BACKUP & RESTORE ENGINES ---
  const exportBackup = async () => {
    const p = await dbOps.getAll(STORES.PRODUCTS);
    const c = await dbOps.getAll(STORES.CUSTOMERS);
    const s = await dbOps.getAll(STORES.SALES);
    const si = await dbOps.getAll(STORES.SALE_ITEMS);
    const ex = await dbOps.getAll(STORES.EXPENSES);
    const sup = await dbOps.getAll(STORES.SUPPLIERS);
    const st = await dbOps.getAll(STORES.SUPPLIER_TRANSACTIONS);
    const ct = await dbOps.getAll(STORES.CUSTOMER_TRANSACTIONS);
    const dc = await dbOps.getAll(STORES.DAILY_CLOSINGS);
    const settings = {
      shop: currentShop,
      backup_date: new Date().toISOString(),
      app: 'ShopRecords'
    };

    const backupObject = {
      settings,
      products: p.filter(x => x.shop_id === currentUser.shop_id),
      customers: c.filter(x => x.shop_id === currentUser.shop_id),
      sales: s.filter(x => x.shop_id === currentUser.shop_id),
      sale_items: si.filter(item => s.some(x => x.id === item.sale_id && x.shop_id === currentUser.shop_id)),
      expenses: ex.filter(x => x.shop_id === currentUser.shop_id),
      suppliers: sup.filter(x => x.shop_id === currentUser.shop_id),
      supplier_transactions: st.filter(x => x.shop_id === currentUser.shop_id),
      customer_transactions: ct.filter(x => x.shop_id === currentUser.shop_id),
      daily_closings: dc.filter(x => x.shop_id === currentUser.shop_id)
    };

    const blob = new Blob([JSON.stringify(backupObject, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ShopRecords_Backup_${currentShop?.name || 'Store'}_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file, mergeMode = 'merge') => {
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const backupData = JSON.parse(e.target.result);
        if (backupData.settings?.app !== 'ShopRecords') {
          return alert('Invalid backup file structure. Import aborted.');
        }

        const shopId = currentUser.shop_id;

        if (mergeMode === 'replace') {
          // Delete local records first
          const clearPromises = [
            dbOps.clearStore(STORES.PRODUCTS),
            dbOps.clearStore(STORES.CUSTOMERS),
            dbOps.clearStore(STORES.SALES),
            dbOps.clearStore(STORES.SALE_ITEMS),
            dbOps.clearStore(STORES.EXPENSES),
            dbOps.clearStore(STORES.SUPPLIERS),
            dbOps.clearStore(STORES.SUPPLIER_TRANSACTIONS),
            dbOps.clearStore(STORES.CUSTOMER_TRANSACTIONS),
            dbOps.clearStore(STORES.DAILY_CLOSINGS)
          ];
          await Promise.all(clearPromises);
        }

        // Prepare data with current shop_id
        const mapItems = (arr) => (arr || []).map(item => ({ ...item, shop_id: shopId }));

        const pData = mapItems(backupData.products);
        const cData = mapItems(backupData.customers);
        const sData = mapItems(backupData.sales);
        const siData = backupData.sale_items || [];
        const exData = mapItems(backupData.expenses);
        const supData = mapItems(backupData.suppliers);
        const stData = mapItems(backupData.supplier_transactions);
        const ctData = mapItems(backupData.customer_transactions);
        const dcData = mapItems(backupData.daily_closings);

        // Put items locally
        await dbOps.putBatch(STORES.PRODUCTS, pData);
        await dbOps.putBatch(STORES.CUSTOMERS, cData);
        await dbOps.putBatch(STORES.SALES, sData);
        await dbOps.putBatch(STORES.SALE_ITEMS, siData);
        await dbOps.putBatch(STORES.EXPENSES, exData);
        await dbOps.putBatch(STORES.SUPPLIERS, supData);
        await dbOps.putBatch(STORES.SUPPLIER_TRANSACTIONS, stData);
        await dbOps.putBatch(STORES.CUSTOMER_TRANSACTIONS, ctData);
        await dbOps.putBatch(STORES.DAILY_CLOSINGS, dcData);

        // Queue all imported files to sync database
        pData.forEach(p => queueSyncAction(STORES.PRODUCTS, p.id, 'INSERT', p));
        cData.forEach(c => queueSyncAction(STORES.CUSTOMERS, c.id, 'INSERT', c));
        sData.forEach(s => queueSyncAction(STORES.SALES, s.id, 'INSERT', s));
        siData.forEach(si => queueSyncAction(STORES.SALE_ITEMS, si.id, 'INSERT', si));
        exData.forEach(e => queueSyncAction(STORES.EXPENSES, e.id, 'INSERT', e));
        supData.forEach(s => queueSyncAction(STORES.SUPPLIERS, s.id, 'INSERT', s));
        stData.forEach(st => queueSyncAction(STORES.SUPPLIER_TRANSACTIONS, st.id, 'INSERT', st));
        ctData.forEach(ct => queueSyncAction(STORES.CUSTOMER_TRANSACTIONS, ct.id, 'INSERT', ct));
        dcData.forEach(dc => queueSyncAction(STORES.DAILY_CLOSINGS, dc.id, 'INSERT', dc));

        await loadDataFromIndexedDB();
        alert('Data recovery restore completed successfully!');
      };
      reader.readAsText(file);
    } catch (e) {
      alert('Error parsing JSON backup file: ' + e.message);
    }
  };

  return (
    <AppContext.Provider
      value={{
        theme,
        setTheme,
        isOnline,
        syncState,
        currentUser,
        currentShop,
        setCurrentShop, // For admin controls
        loadingAuth,
        supportMode,
        products,
        customers,
        sales,
        saleItems,
        expenses,
        suppliers,
        dailyClosings,
        quarantineQueue,
        cart,
        addToCart,
        updateCartQty,
        updateCartPrice,
        removeFromCart,
        clearCart,
        checkout,
        refundSale,
        saveProduct,
        deleteProduct,
        saveCustomer,
        logCustomerPayment,
        saveExpense,
        saveSupplier,
        logSupplierTransaction,
        saveDailyClosing,
        handleSignUp,
        handleLogin,
        handleLogout,
        startSupportSession,
        stopSupportSession,
        exportBackup,
        importBackup,
        isSubscriptionActive,
        retryQuarantinedItems
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
