import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dbOps, STORES } from '../db/db';

export default function Udhar() {
  const { customers, saveCustomer, logCustomerPayment } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerTxList, setCustomerTxList] = useState([]);
  
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

    await logCustomerPayment(selectedCustomer.id, amt, paymentDesc || 'Udhar Payment Recv');
    
    // Close payment modal and refresh states
    setShowPaymentModal(false);
    setPaymentAmount('');
    setPaymentDesc('');

    // Re-load customer details
    const updatedCustomer = await dbOps.get(STORES.CUSTOMERS, selectedCustomer.id);
    setSelectedCustomer(updatedCustomer);
    loadCustomerTransactions(updatedCustomer.id);
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
                <button className="btn btn-primary" onClick={() => setShowPaymentModal(true)}>
                  💳 Receive Payment
                </button>
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
                            <td>{tx.description}</td>
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

    </div>
  );
}
