import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dbOps, STORES } from '../db/db';

export default function Udhar() {
  const { customers, saveCustomer, logCustomerPayment, currentShop } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerTxList, setCustomerTxList] = useState([]);
  const [activePaymentReceipt, setActivePaymentReceipt] = useState(null);

  useEffect(() => {
    if (activePaymentReceipt) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [activePaymentReceipt]);
  
  // Create Customer Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Payment log Form
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDesc, setPaymentDesc] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Search Filter
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone && c.phone.includes(searchTerm))
  );

  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const handleShareLedger = () => {
    if (!selectedCustomer) return;
    
    let summaryText = `📋 *Credit Ledger: ${selectedCustomer.name}*\n` +
      `-------------------------\n` +
      `Outstanding Balance: ₹${parseFloat(selectedCustomer.outstanding_balance || 0).toFixed(2)}\n` +
      `Phone: ${selectedCustomer.phone || 'N/A'}\n` +
      `-------------------------\n` +
      `Recent Logs:\n`;
      
    customerTxList.slice(0, 10).forEach(tx => {
      const dateStr = new Date(tx.created_at).toLocaleDateString('en-IN');
      const typeStr = tx.type === 'Udhar' ? 'Credit' : 'Payment';
      summaryText += `• ${dateStr} | ${typeStr} | ₹${parseFloat(tx.amount).toFixed(2)} | ${tx.description}\n`;
    });
    
    summaryText += `-------------------------\n` +
      `ShopRecords POS`;

    if (navigator.share) {
      navigator.share({
        title: `Ledger: ${selectedCustomer.name}`,
        text: summaryText
      }).catch(err => console.log(err));
    } else {
      navigator.clipboard.writeText(summaryText);
      alert('Ledger history summary copied to clipboard!');
    }
  };

  const handleShareSingleTx = (tx) => {
    if (!selectedCustomer) return;
    const dateStr = new Date(tx.created_at).toLocaleDateString('en-IN');
    const typeStr = tx.type === 'Udhar' ? 'Credit' : 'Payment';
    const summaryText = `🛒 *Transaction Log Detail*\n` +
      `-------------------------\n` +
      `Customer: ${selectedCustomer.name}\n` +
      `Date: ${dateStr}\n` +
      `Type: ${typeStr}\n` +
      `Amount: ₹${parseFloat(tx.amount).toFixed(2)}\n` +
      `Detail: ${tx.description}\n` +
      `-------------------------\n` +
      `ShopRecords POS`;

    if (navigator.share) {
      navigator.share({
        title: `Transaction: ${selectedCustomer.name}`,
        text: summaryText
      }).catch(err => console.log(err));
    } else {
      navigator.clipboard.writeText(summaryText);
      alert('Transaction detail copied to clipboard!');
    }
  };

  const handleViewInvoice = async (saleId) => {
    try {
      const sale = await dbOps.get(STORES.SALES, saleId);
      if (!sale) return alert('Invoice record not found.');
      const allItems = await dbOps.getAll(STORES.SALE_ITEMS);
      const items = allItems.filter(i => i.sale_id === saleId);
      setSelectedInvoice({
        ...sale,
        items
      });
    } catch (e) {
      console.error(e);
      alert('Failed to load invoice details.');
    }
  };

  // Load selected customer transaction history
  const loadCustomerTransactions = async (customerId) => {
    try {
      const txs = await dbOps.getAll(STORES.CUSTOMER_TRANSACTIONS);
      const filtered = txs.filter(t => t.customer_id === customerId)
                         .sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      setCustomerTxList(filtered);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenDetails = (c) => {
    setSelectedCustomer(c);
    loadCustomerTransactions(c.id);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!name) return alert('Name is required.');
    
    await saveCustomer({
      name,
      phone,
      address,
      outstanding_balance: 0
    });

    setName('');
    setPhone('');
    setAddress('');
    setShowAddModal(false);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) return alert('Enter a valid payment amount.');
    if (amt > parseFloat(selectedCustomer.outstanding_balance)) {
      if (!window.confirm('The amount entered is greater than the outstanding balance. Proceed?')) return;
    }

    const tx = await logCustomerPayment(selectedCustomer.id, amt, paymentDesc || 'Udhar Payment Recv');
    
    // Close payment modal and refresh states
    setShowPaymentModal(false);
    setPaymentAmount('');
    setPaymentDesc('');

    // Re-load customer details
    const updatedCustomer = await dbOps.get(STORES.CUSTOMERS, selectedCustomer.id);
    setSelectedCustomer(updatedCustomer);
    loadCustomerTransactions(updatedCustomer.id);

    if (tx && window.confirm('Would you like to print a payment receipt voucher?')) {
      setActivePaymentReceipt(tx);
    }
  };

  return (
    <div className="flex-column-gap" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      
      <div className="flex-row-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)' }}>Udhar Credit Ledger</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Track credit accounts for customers, accept payments, and review outstanding accounts.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          👤 Register Customer
        </button>
      </div>

      {/* Filter panel */}
      <div className="card" style={{ padding: '1rem' }}>
        <input
          type="text"
          className="input"
          placeholder="Filter customers by name or phone number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Customer Credit List */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Phone Number</th>
              <th>Address</th>
              <th>Outstanding Credit (Udhar)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  No customer records found.
                </td>
              </tr>
            ) : (
              filteredCustomers.map((c) => {
                const bal = parseFloat(c.outstanding_balance || 0);
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>{c.phone || '—'}</td>
                    <td>{c.address || '—'}</td>
                    <td style={{ color: bal > 0 ? 'var(--accent-warning)' : 'var(--primary)', fontWeight: 700 }}>
                      ₹{bal.toFixed(2)}
                    </td>
                    <td>
                      <button 
                        className="btn btn-outline" 
                        onClick={() => handleOpenDetails(c)}
                        style={{ minHeight: '32px', height: '32px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                      >
                        📖 Open Ledger
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 1. Register Customer Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>👤 Register New Customer</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>×</button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body flex-column-gap">
                <div className="form-group">
                  <label className="form-label">Customer Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Anand Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Sector-4, Dwarka"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Customer Credit Ledger Details Modal */}
      {selectedCustomer && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Udhar Ledger: {selectedCustomer.name}</h3>
              <button onClick={() => setSelectedCustomer(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>×</button>
            </div>
            <div className="modal-body flex-column-gap">
              
              {/* Account summary banner */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', alignItems: 'center' }}>
                <div>
                  <span className="text-secondary-label">Total Outstanding Balance</span>
                  <h2 style={{ color: 'var(--accent-warning)', fontSize: '1.5rem', marginTop: '0.25rem' }}>
                    ₹{parseFloat(selectedCustomer.outstanding_balance || 0).toFixed(2)}
                  </h2>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-outline" onClick={handleShareLedger}>
                    🔗 Share Ledger
                  </button>
                  <button className="btn btn-primary" onClick={() => setShowPaymentModal(true)}>
                    💳 Receive Payment
                  </button>
                </div>
              </div>

              {/* Transactions log list */}
              <div>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Account History Log</h4>
                <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table className="table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerTxList.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>No transactions logged.</td>
                        </tr>
                      ) : (
                        customerTxList.map((tx) => (
                          <tr key={tx.id}>
                            <td>{new Date(tx.created_at).toLocaleDateString('en-IN')}</td>
                            <td>
                              <span className={`badge ${tx.type === 'Udhar' ? 'badge-danger' : 'badge-success'}`}>
                                {tx.type === 'Udhar' ? 'Credit' : 'Payment'}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700 }}>₹{parseFloat(tx.amount).toFixed(2)}</td>
                            <td>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{tx.description}</span>
                                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                  {tx.sale_id && (
                                    <button
                                      className="btn btn-outline"
                                      onClick={() => handleViewInvoice(tx.sale_id)}
                                      style={{ minHeight: '24px', height: '24px', padding: '0.1rem 0.4rem', fontSize: '0.7rem', color: 'var(--primary)', borderColor: 'var(--primary)' }}
                                    >
                                      📄 View Bill
                                    </button>
                                  )}
                                  {tx.type === 'Payment' && (
                                    <button
                                      className="btn btn-outline"
                                      onClick={() => setActivePaymentReceipt(tx)}
                                      style={{ minHeight: '24px', height: '24px', padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}
                                    >
                                      🖨️ Print
                                    </button>
                                  )}
                                  <button
                                    className="btn btn-outline"
                                    onClick={() => handleShareSingleTx(tx)}
                                    style={{ minHeight: '24px', height: '24px', padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}
                                  >
                                    🔗 Share
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedCustomer(null)}>Close Ledger</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Log Payment Modal */}
      {showPaymentModal && (
        <div className="modal-backdrop" style={{ zIndex: 600 }}>
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>💳 Receive Udhar Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>×</button>
            </div>
            <form onSubmit={handlePaymentSubmit}>
              <div className="modal-body flex-column-gap">
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Customer: <strong>{selectedCustomer?.name}</strong>
                </p>
                <div className="form-group">
                  <label className="form-label">Payment Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="e.g. 500"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description / Remarks</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Cash received by Owner"
                    value={paymentDesc}
                    onChange={(e) => setPaymentDesc(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Receive Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Udhar Payment Receipt print template (hidden from screen, displayed in print layout) */}
      {activePaymentReceipt && (
        <div className="print-receipt-section">
          <div style={{ textAlign: 'center', marginBottom: '2mm' }}>
            <h3 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{currentShop?.name || 'ShopRecords Store'}</h3>
            <p style={{ margin: '1px 0', fontSize: '9px' }}>Udhar Ledger Payment Receipt</p>
            <p style={{ margin: '1px 0', fontSize: '9px' }}>Receipt: REC-{activePaymentReceipt.id.slice(-6).toUpperCase()}</p>
            <p style={{ margin: '1px 0', fontSize: '9px' }}>Date: {new Date(activePaymentReceipt.created_at).toLocaleString('en-IN')}</p>
          </div>
          
          <hr style={{ borderTop: '1px dashed #000', margin: '1mm 0' }} />
          
          <div style={{ fontSize: '9px', lineHeight: '1.5' }}>
            <strong>Customer:</strong> {selectedCustomer?.name}<br />
            {selectedCustomer?.phone && <><strong>Phone:</strong> {selectedCustomer.phone}<br /></>}
            <strong>Received Amount:</strong> ₹{parseFloat(activePaymentReceipt.amount).toFixed(2)}<br />
            <strong>Description:</strong> {activePaymentReceipt.description || 'Udhar Payment'}<br />
            <strong>Remaining Outstanding Bal:</strong> ₹{parseFloat(selectedCustomer?.outstanding_balance || 0).toFixed(2)}<br />
            <br />
            <strong>Received By:</strong> {activePaymentReceipt.performed_by_name || 'Owner'}<br />
          </div>

          <hr style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />
          <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '2mm' }}>
            <p style={{ margin: 0 }}>Thank You for your payment!</p>
            <p style={{ margin: 0, fontSize: '7px', color: '#666' }}>Powered by ShopRecords POS</p>
          </div>
        </div>
      )}

      {/* 4. Invoice details popup modal (when clicking View Bill from Ledger) */}
      {selectedInvoice && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Receipt Detail: {selectedInvoice.invoice_number}</h3>
              <button onClick={() => setSelectedInvoice(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>×</button>
            </div>
            
            <div className="modal-body flex-column-gap">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <span className="text-secondary-label">Customer:</span>
                  <p style={{ fontWeight: 700 }}>{selectedInvoice.customer_name}</p>
                  {selectedInvoice.customer_phone && <p style={{ fontSize: '0.8rem' }}>Phone: {selectedInvoice.customer_phone}</p>}
                </div>
                <div>
                  <span className="text-secondary-label">Invoice Meta:</span>
                  <p style={{ fontSize: '0.85rem' }}><strong>Date:</strong> {new Date(selectedInvoice.created_at).toLocaleString()}</p>
                  <p style={{ fontSize: '0.85rem' }}><strong>Billed By:</strong> {selectedInvoice.performed_by_name} ({selectedInvoice.performed_by_role})</p>
                </div>
              </div>

              {/* Items checklist */}
              <div className="flex-column-gap">
                <h4 style={{ fontSize: '0.95rem' }}>Billed Items</h4>
                <div className="table-container">
                  <table className="table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.items?.map((item) => (
                        <tr key={item.id}>
                          <td>{item.product_name}</td>
                          <td>{parseFloat(item.quantity)}</td>
                          <td>₹{parseFloat(item.price).toFixed(2)}</td>
                          <td>₹{(parseFloat(item.price) * parseFloat(item.quantity)).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)', alignSelf: 'flex-end', width: '220px' }}>
                <div className="flex-row-between" style={{ fontSize: '0.85rem' }}>
                  <span>Subtotal:</span>
                  <span>₹{(selectedInvoice.total_amount + selectedInvoice.discount_amount).toFixed(2)}</span>
                </div>
                {selectedInvoice.discount_amount > 0 && (
                  <div className="flex-row-between" style={{ fontSize: '0.85rem', color: 'var(--accent-error)' }}>
                    <span>Discount:</span>
                    <span>-₹{parseFloat(selectedInvoice.discount_amount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex-row-between" style={{ fontSize: '0.85rem' }}>
                  <span>GST Taxes:</span>
                  <span>₹{parseFloat(selectedInvoice.gst_amount).toFixed(2)}</span>
                </div>
                <hr style={{ borderColor: 'var(--border-color)' }} />
                <div className="flex-row-between" style={{ fontWeight: 700 }}>
                  <span>Net:</span>
                  <span style={{ color: 'var(--primary)' }}>₹{parseFloat(selectedInvoice.total_amount).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', width: '100%', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => window.print()}>
                🖨️ Print Bill
              </button>
              <button className="btn btn-outline" onClick={() => {
                const summaryText = `🛒 *ShopRecords Invoice* \n` +
                  `-------------------------\n` +
                  `Store: ${currentShop?.name || 'ShopRecords'}\n` +
                  `Invoice: ${selectedInvoice.invoice_number}\n` +
                  `Date: ${new Date(selectedInvoice.created_at).toLocaleString('en-IN')}\n` +
                  `-------------------------\n` +
                  `Total Amount: ₹${parseFloat(selectedInvoice.total_amount).toFixed(2)}\n` +
                  `Payment Mode: ${selectedInvoice.payment_method}\n` +
                  `Thank you for shopping with us!`;

                if (navigator.share) {
                  navigator.share({
                    title: `Invoice ${selectedInvoice.invoice_number}`,
                    text: summaryText
                  }).catch(err => console.log(err));
                } else {
                  navigator.clipboard.writeText(summaryText);
                  alert('Invoice summary copied to clipboard!');
                }
              }}>
                🔗 Share Bill
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedInvoice(null)}>
                ✕ Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reprint Receipt print template (hidden from screen, displayed in print layout) */}
      {selectedInvoice && (
        <div className="print-receipt-section">
          <div style={{ textAlign: 'center', marginBottom: '2mm' }}>
            <h3 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{currentShop?.name || 'ShopRecords Store'}</h3>
            <p style={{ margin: '1px 0', fontSize: '9px' }}>Retail GST Invoice</p>
            <p style={{ margin: '1px 0', fontSize: '9px' }}>Invoice: {selectedInvoice.invoice_number}</p>
            <p style={{ margin: '1px 0', fontSize: '9px' }}>Date: {new Date(selectedInvoice.created_at).toLocaleString('en-IN')}</p>
            <p style={{ margin: '1px 0', fontSize: '9px', fontWeight: 'bold' }}>Billed By: {selectedInvoice.performed_by_name || 'Staff'}</p>
          </div>
          
          <hr style={{ borderTop: '1px dashed #000', margin: '1mm 0' }} />
          
          <div style={{ fontSize: '9px', marginBottom: '2mm' }}>
            <strong>Bill To:</strong> {selectedInvoice.customer_name}<br />
            {selectedInvoice.customer_phone && <><strong>Phone:</strong> {selectedInvoice.customer_phone}</>}
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
              {selectedInvoice.items?.map((item) => {
                const qty = parseFloat(item.quantity || 0);
                const rate = parseFloat(item.price || 0);
                const gstRate = parseFloat(item.gst_rate || 0);
                const total = rate * qty;
                return (
                  <tr key={item.id} style={{ borderBottom: '0.5px dotted #ccc' }}>
                    <td style={{ paddingTop: '2px', paddingBottom: '2px' }}>
                      {item.product_name}
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
              <span>₹{(selectedInvoice.total_amount + selectedInvoice.discount_amount).toFixed(2)}</span>
            </div>
            {selectedInvoice.discount_amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Discount:</span>
                <span>-₹{parseFloat(selectedInvoice.discount_amount).toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '10px', marginTop: '1px' }}>
              <span>Net Payable ({selectedInvoice.payment_method}):</span>
              <span>₹{parseFloat(selectedInvoice.total_amount).toFixed(2)}</span>
            </div>
          </div>

          <hr style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />

          {/* GST Breakdown Table */}
          {selectedInvoice.gst_amount > 0 && (
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
                    const taxGroups = {};
                    selectedInvoice.items?.forEach(item => {
                      const rate = parseFloat(item.gst_rate || 0);
                      if (rate > 0) {
                        const totalItemPrice = (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0);
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
            </div>
          )}
          
          <div style={{ textAlign: 'center', marginTop: '4mm', fontSize: '9px', fontWeight: 'bold' }}>
            *** DUPLICATE COPY / REPRINT ***
          </div>
        </div>
      )}
    </div>
  );
}
