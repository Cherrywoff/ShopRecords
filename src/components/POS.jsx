import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import BarcodeScanner from './BarcodeScanner';

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
    currentUser
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [discountVal, setDiscountVal] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
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

  // Quick add Carry Bag
  const handleQuickAddCarryBag = async () => {
    let carryBag = products.find(p => p.name === 'Carry Bag' || p.barcode === 'CARRYBAG');
    if (!carryBag) {
      // Create one
      const newBag = {
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
      setQuickCreateName('');
      setQuickCreatePrice('');
      setShowQuickCreate(true);
    }
  };

  // Handle Quick Create Save
  const handleQuickCreateSave = async (e) => {
    e.preventDefault();
    if (!quickCreateName || !quickCreatePrice) return alert('Name and Price are required.');

    const newProd = {
      name: quickCreateName,
      barcode: quickCreateBarcode || `QUICK-${Date.now()}`,
      cost_price: parseFloat(quickCreatePrice) * 0.7, // Assume 30% profit margin
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

    const sale = await checkout({
      paymentMethod,
      customerId: selectedCustomerId,
      discountAmount: parseFloat(discountVal || 0)
    });

    if (sale) {
      // Save for printing receipt
      setActiveReceipt({
        ...sale,
        items: [...cart]
      });
      // Clear inputs
      setSelectedCustomerId('');
      setDiscountVal(0);
    }
  };

  // Auto print receipt trigger
  useEffect(() => {
    if (activeReceipt) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [activeReceipt]);

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
                className="input"
                placeholder="Search products by name or barcode..."
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
        <div className="form-group">
          <label className="form-label">Select Customer</label>
          <select 
            className="input" 
            value={selectedCustomerId} 
            onChange={(e) => setSelectedCustomerId(e.target.value)}
          >
            <option value="">Walk-in Customer</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phone || 'No phone'})
              </option>
            ))}
          </select>
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
            {['Cash', 'UPI', 'Card', 'Udhar'].map((method) => {
              // Cashier is blocked from Udhar
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
                  {method}
                </button>
              );
            })}
          </div>
        </div>

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
        <div className="print-receipt-section" style={{ display: 'none' }}>
          <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
            <h3 style={{ margin: 0, fontSize: '14px' }}>{activeReceipt.customer_name === 'Walk-in Customer' ? 'ShopRecords Store' : 'Receipt'}</h3>
            <p style={{ margin: 0 }}>Invoice: {activeReceipt.invoice_number}</p>
            <p style={{ margin: 0 }}>Date: {new Date(activeReceipt.created_at).toLocaleString('en-IN')}</p>
          </div>
          <hr style={{ borderStyle: 'dashed', borderColor: '#000', margin: '2mm 0' }} />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px dashed #000' }}>
                <th style={{ textAlign: 'left' }}>Item</th>
                <th style={{ textAlign: 'center' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Price</th>
              </tr>
            </thead>
            <tbody>
              {activeReceipt.items.map((item) => (
                <tr key={item.product.id}>
                  <td>{item.product.name}</td>
                  <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right' }}>₹{(item.customPrice * item.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr style={{ borderStyle: 'dashed', borderColor: '#000', margin: '2mm 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span>Subtotal:</span>
            <span>₹{(activeReceipt.total_amount + activeReceipt.discount_amount).toFixed(2)}</span>
          </div>
          {activeReceipt.discount_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Discount:</span>
              <span>-₹{activeReceipt.discount_amount.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px', marginTop: '1mm' }}>
            <span>Net Total ({activeReceipt.payment_method}):</span>
            <span>₹{activeReceipt.total_amount.toFixed(2)}</span>
          </div>
          <hr style={{ borderStyle: 'dashed', borderColor: '#000', margin: '2mm 0' }} />
          <div style={{ textAlign: 'center', marginTop: '4mm', fontSize: '10px' }}>
            <p style={{ margin: 0 }}>Thank You! Visit Again.</p>
            <p style={{ margin: 0 }}>Powered by ShopRecords POS</p>
          </div>
          <button className="btn btn-outline" onClick={() => setActiveReceipt(null)} style={{ display: 'block', margin: '10px auto 0 auto', width: '100%', minHeight: '36px' }}>
            Done Printing
          </button>
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
