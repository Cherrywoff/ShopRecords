import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import BarcodeScanner from './BarcodeScanner';
import { generateUUID } from '../db/db';

export default function POS() {
  const { 
    products, 
    customers, 
    cart, 
    addToCart, 
    updateCartQty, 
    updateCartPrice,
    removeFromCart, 
    clearCart, 
    checkout,
    saveProduct,
    currentUser,
    currentShop
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [discountVal, setDiscountVal] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [splitCash, setSplitCash] = useState('');
  const [splitUPI, setSplitUPI] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickCreateName, setQuickCreateName] = useState('');
  const [quickCreatePrice, setQuickCreatePrice] = useState('');
  const [quickCreateBarcode, setQuickCreateBarcode] = useState('');
  const [activeReceipt, setActiveReceipt] = useState(null); // Stores printed receipt details
  
  // Search filtering
  const filteredProducts = searchQuery.trim() === ''
    ? []
    : products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (p.barcode && p.barcode.includes(searchQuery))
      ).slice(0, 5); // Return top 5 matches

  // Calculate totals
  const subTotal = cart.reduce((acc, curr) => acc + (curr.customPrice * curr.quantity), 0);
  const totalGst = cart.reduce((acc, curr) => {
    const price = curr.customPrice;
    const qty = curr.quantity;
    const base = price / (1 + (curr.product.gst_rate / 100));
    return acc + ((price - base) * qty);
  }, 0);
  const netTotal = Math.max(0, subTotal - parseFloat(discountVal || 0));
  const splitTotal = (parseFloat(splitCash) || 0) + (parseFloat(splitUPI) || 0) + (parseFloat(splitCard) || 0);
  const splitRemaining = netTotal - splitTotal;

  // Quick add Carry Bag
  const handleQuickAddCarryBag = async () => {
    let carryBag = products.find(p => p.name === 'Carry Bag' || p.barcode === 'CARRYBAG');
    if (!carryBag) {
      // Create one
      const newBag = {
        id: generateUUID(),
        name: 'Carry Bag',
        barcode: 'CARRYBAG',
        cost_price: 1.00,
        selling_price: 5.00,
        hsn_code: '3923',
        gst_rate: 18.00,
        current_stock: 1000,
        low_stock_threshold: 10,
        is_unlisted: true
      };
      await saveProduct(newBag);
      // Retrieve again
      carryBag = newBag;
    }
    addToCart(carryBag, 1);
  };

  // Barcode detected handler
  const handleBarcodeDetected = (barcode) => {
    setShowScanner(false);
    const matchedProduct = products.find(p => p.barcode === barcode);
    if (matchedProduct) {
      addToCart(matchedProduct, 1);
    } else {
      // Trigger Quick Create with pre-filled barcode
      setQuickCreateBarcode(barcode);
      setShowQuickCreate(true);
    }
  };

  // Handle Quick Create Save
  const handleQuickCreateSave = async (e) => {
    e.preventDefault();
    if (!quickCreateName || !quickCreatePrice) return alert('Name and Price are required.');
    
    const newId = generateUUID();
    const newProd = {
      id: newId,
      name: quickCreateName,
      barcode: quickCreateBarcode || `QUICK-${Date.now()}`,
      cost_price: parseFloat(quickCreatePrice) * 0.7, // Assume 30% margin for unlisted
      selling_price: parseFloat(quickCreatePrice),
      hsn_code: '',
      gst_rate: 0,
      current_stock: 0,
      low_stock_threshold: 0,
      is_unlisted: true
    };

    await saveProduct(newProd);
    addToCart(newProd, 1);
    
    setShowQuickCreate(false);
    setQuickCreateName('');
    setQuickCreatePrice('');
    setQuickCreateBarcode('');
  };

  // Trigger billing completion
  const handleCheckoutSubmit = async () => {
    if (cart.length === 0) return alert('Cart is empty.');
    if (paymentMethod === 'Udhar' && !selectedCustomerId) {
      return alert('Customer must be selected for Udhar (credit) transactions.');
    }

    if (paymentMethod === 'Split') {
      if (Math.abs(splitRemaining) >= 0.01) {
        return alert(`Please distribute the split payments to exactly match the net total of ₹${netTotal.toFixed(2)}.`);
      }
    }

    const cartCopy = [...cart];

    const sale = await checkout({
      paymentMethod,
      customerId: selectedCustomerId,
      discountAmount: parseFloat(discountVal || 0),
      paymentDetails: paymentMethod === 'Split' ? {
        Cash: parseFloat(splitCash) || 0,
        UPI: parseFloat(splitUPI) || 0,
        Card: parseFloat(splitCard) || 0
      } : null
    });

    if (sale) {
      // Save for printing receipt
      setActiveReceipt({
        ...sale,
        items: cartCopy
      });
      // Clear inputs
      setSelectedCustomerId('');
      setDiscountVal(0);
      setSplitCash('');
      setSplitUPI('');
      setSplitCard('');
    }
  };

  const handleShareBill = () => {
    if (!activeReceipt) return;

    const summaryText = `🛒 *ShopRecords Invoice* \n` +
      `-------------------------\n` +
      `Store: ${currentShop?.name || 'ShopRecords'}\n` +
      `Invoice: ${activeReceipt.invoice_number}\n` +
      `Date: ${new Date(activeReceipt.created_at).toLocaleString('en-IN')}\n` +
      `-------------------------\n` +
      `Total Amount: ₹${parseFloat(activeReceipt.total_amount).toFixed(2)}\n` +
      `Payment Mode: ${activeReceipt.payment_method}\n` +
      `Thank you for shopping with us!`;

    if (navigator.share) {
      navigator.share({
        title: `Invoice ${activeReceipt.invoice_number}`,
        text: summaryText
      }).catch(err => {
        console.log('Share failed:', err);
      });
    } else {
      navigator.clipboard.writeText(summaryText);
      alert('Invoice summary copied to clipboard! You can now paste and share it via WhatsApp, SMS, or Email.');
    }
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. F2: Focus product search
      if (e.key === 'F2') {
        e.preventDefault();
        const searchInput = document.querySelector('.pos-search-input');
        if (searchInput) searchInput.focus();
      }
      
      // 2. F8: Toggle payment method
      if (e.key === 'F8') {
        e.preventDefault();
        setPaymentMethod(prev => {
          const methods = ['Cash', 'UPI', 'Card', 'Udhar', 'Split'];
          const idx = methods.indexOf(prev);
          const nextIdx = (idx + 1) % (currentUser?.role === 'Cashier' ? 4 : 5); // Cashier cannot use Udhar
          const nextMethod = methods[nextIdx] === 'Udhar' && currentUser?.role === 'Cashier' 
            ? 'Split' 
            : methods[nextIdx];
          return nextMethod;
        });
      }

      // 3. Ctrl+Space: Quick Carry Bag
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        handleQuickAddCarryBag();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, currentUser]);

  return (
    <div className="pos-layout" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* LEFT COLUMN: PRODUCT SEARCH & CART LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Product Search & Barcode Scan Actions */}
        <div className="card flex-column-gap" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ flexGrow: 1, position: 'relative' }}>
              <input
                type="text"
                className="input pos-search-input"
                placeholder="Search products by name or barcode... [F2]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {filteredProducts.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 200,
                  marginTop: '0.25rem'
                }}>
                  {filteredProducts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        addToCart(p, 1);
                        setSearchQuery('');
                      }}
                      style={{
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 600
                      }}
                      className="search-item-row"
                    >
                      <span>{p.name}</span>
                      <span style={{ color: 'var(--primary)' }}>₹{parseFloat(p.selling_price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <button className="btn btn-secondary" onClick={() => setShowScanner(true)}>
              📷 Scan Barcode
            </button>
            <button className="btn btn-outline" onClick={() => {
              setQuickCreateBarcode('');
              setShowQuickCreate(true);
            }}>
              ➕ Quick Create
            </button>
          </div>
        </div>

        {/* Quick Add popular items grid */}
        {products.filter(p => !p.is_unlisted).length > 0 && (
          <div className="card" style={{ padding: '1rem' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>⭐ Quick Tap Products</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.5rem' }}>
              {products
                .filter(p => !p.is_unlisted)
                .slice(0, 10) // Display top 10 items
                .map(p => (
                  <button
                    key={p.id}
                    className="btn btn-outline"
                    onClick={() => addToCart(p, 1)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.5rem',
                      height: '70px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border-color)',
                      textAlign: 'center',
                      lineHeight: '1.2',
                      cursor: 'pointer',
                      transition: 'border-color var(--transition-normal), transform var(--transition-normal)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.transform = 'scale(1.02)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebKitLineClamp: 2, WebKitBoxOrient: 'vertical' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, marginTop: '2px' }}>
                      ₹{parseFloat(p.selling_price).toFixed(2)}
                    </div>
                  </button>
                ))
              }
            </div>
          </div>
        )}

        {/* Cart Item Grid */}
        <div className="pos-cart">
          <div className="flex-row-between" style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Shopping Cart</h3>
            <button className="btn btn-outline" onClick={clearCart} style={{ minHeight: '36px', height: '36px', padding: '0.25rem 0.75rem' }}>
              🗑️ Clear
            </button>
          </div>

          <div style={{ flexGrow: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {cart.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)' }}>
                <span style={{ fontSize: '3rem' }}>🛒</span>
                <p style={{ marginTop: '0.5rem', fontWeight: 500 }}>Cart is empty. Add products to begin.</p>
              </div>
            ) : (
              cart.map((cartItem) => (
                <div key={cartItem.product.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-tertiary)'
                }}>
                  <div style={{ flex: 2 }}>
                    <p style={{ fontWeight: 700 }}>{cartItem.product.name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      Barcode: {cartItem.product.barcode || '—'} | GST: {parseFloat(cartItem.product.gst_rate)}%
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1.5, justifyContent: 'center' }}>
                    <button 
                      className="btn btn-outline" 
                      onClick={() => updateCartQty(cartItem.product.id, cartItem.quantity - 1)}
                      style={{ minHeight: '36px', width: '36px', padding: 0 }}
                    >
                      -
                    </button>
                    <span style={{ fontWeight: 700, minWidth: '24px', textAlign: 'center' }}>{cartItem.quantity}</span>
                    <button 
                      className="btn btn-outline" 
                      onClick={() => updateCartQty(cartItem.product.id, cartItem.quantity + 1)}
                      style={{ minHeight: '36px', width: '36px', padding: 0 }}
                    >
                      +
                    </button>
                  </div>

                  <div style={{ flex: 1.5, textAlign: 'right' }}>
                    <input
                      type="number"
                      className="input"
                      style={{ width: '80px', minHeight: '36px', height: '36px', padding: '0.25rem', textAlign: 'right' }}
                      value={cartItem.customPrice}
                      onChange={(e) => updateCartPrice(cartItem.product.id, e.target.value)}
                    />
                  </div>

                  <button 
                    onClick={() => removeFromCart(cartItem.product.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-error)', fontSize: '1.25rem', cursor: 'pointer', marginLeft: '0.75rem' }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)', display: 'flex', gap: '1rem' }}>
            <button className="btn btn-outline" onClick={handleQuickAddCarryBag} style={{ flexGrow: 1 }}>
              🛍️ + Carry Bag (₹5)
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: CUSTOMER & CHECKOUT DETAIL SHIELD */}
      <div className="card flex-column-gap">
        <h3 style={{ fontSize: '1.2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Checkout Panel</h3>

        {/* Customer mapping */}
        <div className="form-group" style={{ position: 'relative' }}>
          <label className="form-label">Select Customer</label>
          
          {selectedCustomerId ? (
            (() => {
              const cust = customers.find(c => c.id === selectedCustomerId);
              return (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '0.5rem 0.75rem', 
                  backgroundColor: 'var(--bg-tertiary)', 
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.9rem'
                }}>
                  <div>
                    <strong style={{ color: 'var(--primary)' }}>{cust?.name}</strong>
                    {cust?.phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{cust.phone}</div>}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Ledger Bal: <span style={{ fontWeight: 700, color: parseFloat(cust?.outstanding_balance || 0) > 0 ? 'var(--accent-warning)' : 'var(--text-secondary)' }}>₹{parseFloat(cust?.outstanding_balance || 0).toFixed(2)}</span>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-outline" 
                    onClick={() => { setSelectedCustomerId(''); setCustomerSearch(''); }}
                    style={{ minHeight: '28px', height: '28px', padding: '0 0.5rem', fontSize: '0.75rem' }}
                  >
                    Clear (X)
                  </button>
                </div>
              );
            })()
          ) : (
            <>
              <input
                type="text"
                className="input"
                placeholder="Search customer by name or phone..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                style={{ minHeight: '36px', height: '36px' }}
              />
              {customerSearch && (
                <div style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  right: 0, 
                  backgroundColor: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)', 
                  zIndex: 200, 
                  maxHeight: '180px', 
                  overflowY: 'auto',
                  boxShadow: 'var(--shadow-lg)'
                }}>
                  {customers
                    .filter(c => 
                      c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
                      (c.phone && c.phone.includes(customerSearch))
                    )
                    .map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => {
                          setSelectedCustomerId(c.id);
                          setCustomerSearch('');
                        }}
                        style={{ 
                          padding: '0.5rem 0.75rem', 
                          cursor: 'pointer', 
                          borderBottom: '1px solid var(--border-color)',
                          fontSize: '0.85rem'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                      >
                        <strong>{c.name}</strong> ({c.phone || 'No phone'}) - Bal: ₹{parseFloat(c.outstanding_balance || 0).toFixed(2)}
                      </div>
                    ))
                  }
                  {customers.filter(c => 
                      c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
                      (c.phone && c.phone.includes(customerSearch))
                    ).length === 0 && (
                      <div style={{ padding: '0.5rem 0.75rem', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                        No matching customer found.
                      </div>
                    )
                  }
                </div>
              )}
            </>
          )}
        </div>

        {/* Pricing Totals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div className="flex-row-between">
            <span className="text-secondary-label">Subtotal:</span>
            <span style={{ fontWeight: 600 }}>₹{subTotal.toFixed(2)}</span>
          </div>
          <div className="flex-row-between">
            <span className="text-secondary-label">GST Tax:</span>
            <span style={{ fontWeight: 600 }}>₹{totalGst.toFixed(2)}</span>
          </div>

          <div className="form-group" style={{ margin: '0.5rem 0' }}>
            <label className="form-label">Flat Discount (₹)</label>
            <input 
              type="number" 
              className="input" 
              style={{ minHeight: '36px', height: '36px', padding: '0.25rem 0.5rem' }}
              value={discountVal} 
              onChange={(e) => setDiscountVal(parseFloat(e.target.value) || 0)} 
            />
          </div>

          <hr style={{ borderColor: 'var(--border-color)' }} />
          <div className="flex-row-between" style={{ fontSize: '1.25rem', fontWeight: 800 }}>
            <span>Net Total:</span>
            <span style={{ color: 'var(--primary)' }}>₹{netTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="form-group">
          <label className="form-label">Payment Method</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
            {['Cash', 'UPI', 'Card', 'Udhar', 'Split'].map((method) => {
              if (method === 'Udhar' && currentUser?.role === 'Cashier') return null;
              
              return (
                <button
                  key={method}
                  className={`btn ${paymentMethod === method ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setPaymentMethod(method)}
                  style={{ minHeight: '40px' }}
                >
                  {method === 'Cash' && '💵 '}
                  {method === 'UPI' && '📱 '}
                  {method === 'Card' && '💳 '}
                  {method === 'Udhar' && '🤝 '}
                  {method === 'Split' && '🔀 '}
                  {method}
                </button>
              );
            })}
          </div>
        </div>

        {/* Split Details Input */}
        {paymentMethod === 'Split' && (
          <div style={{ 
            backgroundColor: 'var(--bg-tertiary)', 
            padding: '0.75rem', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--border-color)',
            fontSize: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <div style={{ fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>Split Payment Distribution</div>
            <div className="flex-row-between">
              <span>Cash Amount (₹):</span>
              <input 
                type="number" 
                step="0.01" 
                className="input" 
                style={{ width: '100px', minHeight: '28px', height: '28px', padding: '0 0.25rem', textAlign: 'right' }} 
                value={splitCash}
                onChange={(e) => setSplitCash(e.target.value)}
              />
            </div>
            <div className="flex-row-between">
              <span>UPI Amount (₹):</span>
              <input 
                type="number" 
                step="0.01" 
                className="input" 
                style={{ width: '100px', minHeight: '28px', height: '28px', padding: '0 0.25rem', textAlign: 'right' }} 
                value={splitUPI}
                onChange={(e) => setSplitUPI(e.target.value)}
              />
            </div>
            <div className="flex-row-between">
              <span>Card Amount (₹):</span>
              <input 
                type="number" 
                step="0.01" 
                className="input" 
                style={{ width: '100px', minHeight: '28px', height: '28px', padding: '0 0.25rem', textAlign: 'right' }} 
                value={splitCard}
                onChange={(e) => setSplitCard(e.target.value)}
              />
            </div>
            <div className="flex-row-between" style={{ fontWeight: 'bold', borderTop: '1px solid var(--border-color)', paddingTop: '0.25rem', marginTop: '0.25rem' }}>
              <span>Remaining to Settle:</span>
              <span style={{ color: Math.abs(splitRemaining) < 0.01 ? 'var(--primary)' : 'var(--accent-error)' }}>
                ₹{splitRemaining.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        <button className="btn btn-primary" onClick={handleCheckoutSubmit} style={{ width: '100%', fontSize: '1.05rem', fontWeight: 700 }}>
          📦 Complete & Print Bill
        </button>
      </div>

      {/* 1. Barcode scanner overlay screen */}
      {showScanner && (
        <BarcodeScanner 
          onDetected={handleBarcodeDetected} 
          onClose={() => setShowScanner(false)} 
        />
      )}

      {/* 2. Quick Product creation Modal */}
      {showQuickCreate && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Quick Product Creator</h3>
              <button onClick={() => setShowQuickCreate(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>×</button>
            </div>
            <form onSubmit={handleQuickCreateSave}>
              <div className="modal-body flex-column-gap">
                {quickCreateBarcode && (
                  <div style={{ fontSize: '0.85rem', padding: '0.5rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                    <strong>Detected Barcode:</strong> {quickCreateBarcode}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Product Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Kurkure Masala"
                    value={quickCreateName}
                    onChange={(e) => setQuickCreateName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Selling Price (MRP ₹)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="e.g. 20"
                    value={quickCreatePrice}
                    onChange={(e) => setQuickCreatePrice(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowQuickCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add & Add to Cart</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Thermal Receipt print profile (hidden from screen, displayed in print layout) */}
      {activeReceipt && (
        <div className="print-receipt-section">
          <div style={{ textAlign: 'center', marginBottom: '2mm' }}>
            <h3 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{currentShop?.name || 'ShopRecords Store'}</h3>
            <p style={{ margin: '1px 0', fontSize: '9px' }}>Retail GST Invoice</p>
            <p style={{ margin: '1px 0', fontSize: '9px' }}>Invoice: {activeReceipt.invoice_number}</p>
            <p style={{ margin: '1px 0', fontSize: '9px' }}>Date: {new Date(activeReceipt.created_at).toLocaleString('en-IN')}</p>
            <p style={{ margin: '1px 0', fontSize: '9px', fontWeight: 'bold' }}>Billed By: {activeReceipt.performed_by_name || 'Staff'}</p>
          </div>
          
          <hr style={{ borderTop: '1px dashed #000', margin: '1mm 0' }} />
          
          <div style={{ fontSize: '9px', marginBottom: '2mm' }}>
            <strong>Bill To:</strong> {activeReceipt.customer_name}<br />
            {activeReceipt.customer_phone && <><strong>Phone:</strong> {activeReceipt.customer_phone}</>}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
            <thead>
              <tr style={{ borderBottom: '1px dashed #000' }}>
                <th style={{ textAlign: 'left', paddingBottom: '1px' }}>Description (HSN)</th>
                <th style={{ textAlign: 'center', paddingBottom: '1px' }}>Qty</th>
                <th style={{ textAlign: 'right', paddingBottom: '1px' }}>Rate</th>
                <th style={{ textAlign: 'right', paddingBottom: '1px' }}>GST%</th>
                <th style={{ textAlign: 'right', paddingBottom: '1px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {activeReceipt.items.map((item) => {
                if (!item || !item.product) return null;
                const qty = parseFloat(item.quantity || 0);
                const rate = parseFloat(item.customPrice || 0);
                const gstRate = parseFloat(item.product?.gst_rate || 0);
                const total = rate * qty;
                return (
                  <tr key={item.product?.id} style={{ borderBottom: '0.5px dotted #ccc' }}>
                    <td style={{ paddingTop: '2px', paddingBottom: '2px' }}>
                      {item.product?.name} {item.product?.hsn_code ? `(${item.product.hsn_code})` : ''}
                    </td>
                    <td style={{ textAlign: 'center' }}>{qty}</td>
                    <td style={{ textAlign: 'right' }}>₹{rate.toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{gstRate}%</td>
                    <td style={{ textAlign: 'right' }}>₹{total.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <hr style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />

          <div style={{ fontSize: '9px', lineHeight: '1.4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal (Inclusive of GST):</span>
              <span>₹{(activeReceipt.total_amount + activeReceipt.discount_amount).toFixed(2)}</span>
            </div>
            {activeReceipt.discount_amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Discount:</span>
                <span>-₹{activeReceipt.discount_amount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '10px', marginTop: '1px' }}>
              <span>Net Payable ({activeReceipt.payment_method}):</span>
              <span>₹{activeReceipt.total_amount.toFixed(2)}</span>
            </div>
          </div>

          <hr style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />

          {/* GST Breakdown Table */}
          {activeReceipt.gst_amount > 0 && (
            <div style={{ fontSize: '8px' }}>
              <div style={{ fontWeight: 'bold', textAlign: 'center', marginBottom: '1px' }}>GST TAX BREAKDOWN</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px dashed #000' }}>
                    <th style={{ textAlign: 'left' }}>GST%</th>
                    <th>Taxable Val</th>
                    <th>CGST</th>
                    <th>SGST</th>
                    <th>Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Group taxes by rate
                    const taxGroups = {};
                    activeReceipt.items.forEach(item => {
                      if (!item || !item.product) return;
                      const rate = parseFloat(item.product?.gst_rate || 0);
                      if (rate > 0) {
                        const totalItemPrice = (item.customPrice || 0) * (item.quantity || 0);
                        const basePrice = totalItemPrice / (1 + (rate / 100));
                        const tax = totalItemPrice - basePrice;
                        if (!taxGroups[rate]) {
                          taxGroups[rate] = { taxable: 0, tax: 0 };
                        }
                        taxGroups[rate].taxable += basePrice;
                        taxGroups[rate].tax += tax;
                      }
                    });

                    return Object.entries(taxGroups).map(([rate, vals]) => {
                      const cgst = vals.tax / 2;
                      const sgst = vals.tax / 2;
                      return (
                        <tr key={rate}>
                          <td style={{ textAlign: 'left' }}>{rate}%</td>
                          <td>₹{vals.taxable.toFixed(2)}</td>
                          <td>₹{cgst.toFixed(2)}</td>
                          <td>₹{sgst.toFixed(2)}</td>
                          <td>₹{vals.tax.toFixed(2)}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
              <div style={{ marginTop: '2px', textAlign: 'right', fontWeight: 'bold' }}>
                Total Tax Included: ₹{activeReceipt.gst_amount.toFixed(2)}
              </div>
            </div>
          )}

          <hr style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />
          <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '2mm' }}>
            <p style={{ margin: 0 }}>Thank You! Visit Again.</p>
            <p style={{ margin: 0, fontSize: '7px', color: '#666' }}>Powered by ShopRecords POS</p>
          </div>
        </div>
      )}

      {/* On-screen Receipt Dialog Modal */}
      {activeReceipt && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)' }}>Completed Invoice</h2>
              <button 
                className="btn btn-outline" 
                onClick={() => setActiveReceipt(null)}
                style={{ padding: '0.25rem 0.5rem', minHeight: 'auto' }}
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ textAlign: 'center', color: 'var(--primary)', fontSize: '1rem', fontWeight: 600 }}>
                🎉 Sale Completed Successfully!
              </div>

              <div style={{ 
                fontFamily: 'monospace', 
                fontSize: '0.85rem', 
                backgroundColor: 'var(--bg-tertiary)', 
                borderRadius: 'var(--radius-sm)', 
                padding: '1rem', 
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                lineHeight: 1.4
              }}>
                <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                  <strong style={{ fontSize: '1rem' }}>{currentShop?.name || 'Store'}</strong>
                  <div>Invoice: {activeReceipt.invoice_number}</div>
                  <div>{new Date(activeReceipt.created_at).toLocaleString('en-IN')}</div>
                </div>

                <hr style={{ borderTop: '1px dashed var(--border-color)', margin: '0.5rem 0' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {activeReceipt.items.map(item => {
                    if (!item || !item.product) return null;
                    return (
                      <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{item.product.name} x {item.quantity}</span>
                        <span>₹{(item.customPrice * item.quantity).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>

                <hr style={{ borderTop: '1px dashed var(--border-color)', margin: '0.5rem 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>₹{(activeReceipt.total_amount + activeReceipt.discount_amount).toFixed(2)}</span>
                </div>
                {activeReceipt.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-error)' }}>
                    <span>Discount:</span>
                    <span>-₹{activeReceipt.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                {activeReceipt.gst_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                    <span>Includes GST:</span>
                    <span>₹{activeReceipt.gst_amount.toFixed(2)}</span>
                  </div>
                )}
                
                <hr style={{ borderTop: '1px dashed var(--border-color)', margin: '0.5rem 0' }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.95rem' }}>
                  <span>Net Payable ({activeReceipt.payment_method}):</span>
                  <span>₹{activeReceipt.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => window.print()}
                style={{ width: '100%', minHeight: '40px', fontWeight: 'bold' }}
              >
                🖨️ Print Bill
              </button>
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                <button 
                  className="btn btn-outline" 
                  onClick={handleShareBill}
                  style={{ flexGrow: 1, minHeight: '40px' }}
                >
                  🔗 Share Bill
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setActiveReceipt(null)}
                  style={{ flexGrow: 1, minHeight: '40px' }}
                >
                  ✕ Close Bill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .search-item-row:hover {
          background-color: var(--bg-tertiary);
        }
      `}</style>
    </div>
  );
}
