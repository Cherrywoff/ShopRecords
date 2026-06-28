import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { dbOps, STORES } from '../db/db';

export default function Suppliers() {
  const { suppliers, saveSupplier, logSupplierTransaction, currentUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierTxList, setSupplierTxList] = useState([]);

  // Create Supplier Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Log transaction Form
  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState('Purchase'); // 'Purchase' | 'Payment'
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  const isOwner = currentUser?.role === 'Owner';

  // Search Filter
  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.phone && s.phone.includes(searchTerm))
  );

  const loadSupplierTransactions = async (supplierId) => {
    try {
      const txs = await dbOps.getAll(STORES.SUPPLIER_TRANSACTIONS);
      const filtered = txs.filter(t => t.supplier_id === supplierId)
                         .sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      setSupplierTxList(filtered);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenDetails = (s) => {
    setSelectedSupplier(s);
    loadSupplierTransactions(s.id);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!name) return alert('Name is required.');
    
    await saveSupplier({
      name,
      phone,
      outstanding_amount: 0
    });

    setName('');
    setPhone('');
    setShowAddModal(false);
  };

  const handleTxSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    const amt = parseFloat(txAmount);
    if (isNaN(amt) || amt <= 0) return alert('Enter a valid amount.');

    await logSupplierTransaction(selectedSupplier.id, txType, amt, txDesc, paymentMethod);
    
    setShowTxModal(false);
    setTxAmount('');
    setTxDesc('');
    setPaymentMethod('Cash');

    // Re-load supplier details
    const updated = await dbOps.get(STORES.SUPPLIERS, selectedSupplier.id);
    setSelectedSupplier(updated);
    loadSupplierTransactions(updated.id);
  };

  return (
    <div className="flex-column-gap" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      
      <div className="flex-row-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)' }}>Supplier Ledger</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Manage wholesale supplier balances, record catalog purchases, and track cash disbursements.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          🚚 Add Supplier
        </button>
      </div>

      {/* Filter panel */}
      <div className="card" style={{ padding: '1rem' }}>
        <input
          type="text"
          className="input"
          placeholder="Filter wholesale suppliers by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Suppliers outstanding table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Supplier Name</th>
              <th>Phone Number</th>
              <th>Outstanding Balance (Payable)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  No supplier profiles registered.
                </td>
              </tr>
            ) : (
              filteredSuppliers.map((s) => {
                const bal = parseFloat(s.outstanding_amount || 0);
                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.phone || '—'}</td>
                    <td style={{ color: bal > 0 ? 'var(--accent-error)' : 'var(--primary)', fontWeight: 700 }}>
                      ₹{bal.toFixed(2)}
                    </td>
                    <td>
                      <button 
                        className="btn btn-outline" 
                        onClick={() => handleOpenDetails(s)}
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

      {/* 1. Register Supplier Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>🚚 Add Wholesale Supplier</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>×</button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body flex-column-gap">
                <div className="form-group">
                  <label className="form-label">Supplier Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Balaji Distributors"
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
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Supplier Credit Ledger Details Modal */}
      {selectedSupplier && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>B2B Ledger: {selectedSupplier.name}</h3>
              <button onClick={() => setSelectedSupplier(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>×</button>
            </div>
            <div className="modal-body flex-column-gap">
              
              {/* Account summary banner */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', alignItems: 'center' }}>
                <div>
                  <span className="text-secondary-label">Total Amount Payable</span>
                  <h2 style={{ color: 'var(--accent-error)', fontSize: '1.5rem', marginTop: '0.25rem' }}>
                    ₹{parseFloat(selectedSupplier.outstanding_amount || 0).toFixed(2)}
                  </h2>
                </div>
                <button className="btn btn-primary" onClick={() => { setTxType('Purchase'); setShowTxModal(true); }}>
                  📦 Log Purchase / Payout
                </button>
              </div>

              {/* Transactions log list */}
              <div>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Purchase & Payment History</h4>
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
                      {supplierTxList.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>No transactions logged.</td>
                        </tr>
                      ) : (
                        supplierTxList.map((tx) => (
                          <tr key={tx.id}>
                            <td>{new Date(tx.created_at).toLocaleDateString('en-IN')}</td>
                            <td>
                              <span className={`badge ${tx.type === 'Purchase' ? 'badge-danger' : 'badge-success'}`}>
                                {tx.type === 'Purchase' ? 'Purchase' : 'Paid Out'}
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
              <button className="btn btn-outline" onClick={() => setSelectedSupplier(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Log Supplier Transaction Modal */}
      {showTxModal && (
        <div className="modal-backdrop" style={{ zIndex: 600 }}>
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>📦 Record B2B Transaction</h3>
              <button onClick={() => setShowTxModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>×</button>
            </div>
            <form onSubmit={handleTxSubmit}>
              <div className="modal-body flex-column-gap">
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Supplier: <strong>{selectedSupplier?.name}</strong>
                </p>

                <div className="form-group">
                  <label className="form-label">Transaction Type</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className={`btn ${txType === 'Purchase' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setTxType('Purchase')}
                      style={{ flexGrow: 1, minHeight: '40px' }}
                    >
                      Inventory Purchase
                    </button>
                    <button
                      type="button"
                      className={`btn ${txType === 'Payment' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setTxType('Payment')}
                      style={{ flexGrow: 1, minHeight: '40px' }}
                    >
                      Disburse Payment
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="e.g. 2500"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select
                    className="select"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  >
                    <option value="Cash">💵 Cash</option>
                    <option value="UPI">📱 UPI</option>
                    <option value="Card">💳 Card</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Description / Bill Number</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Bill #1024, Biscuits stock"
                    value={txDesc}
                    onChange={(e) => setTxDesc(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowTxModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
