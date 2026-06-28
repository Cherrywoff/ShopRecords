import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function SalesHistory() {
  const { sales, saleItems, refundSale, currentUser } = useApp();
  
  // Filters
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  
  // Selected invoice for details popup
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const isCashier = currentUser?.role === 'Cashier';

  // Apply filters
  const filteredSales = sales.filter((sale) => {
    const matchInvoice = sale.invoice_number.toLowerCase().includes(invoiceQuery.toLowerCase());
    const matchDate = dateFilter ? sale.created_at.startsWith(dateFilter) : true;
    const matchPayment = paymentFilter ? sale.payment_method === paymentFilter : true;
    const matchCustomer = sale.customer_name?.toLowerCase().includes(customerQuery.toLowerCase());
    return matchInvoice && matchDate && matchPayment && matchCustomer;
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const handleOpenDetails = (sale) => {
    // Get sale items
    const items = saleItems.filter((i) => i.sale_id === sale.id);
    setSelectedInvoice({
      ...sale,
      items
    });
  };

  const handleRefundClick = async (saleId) => {
    if (isCashier) return alert('Access Denied. Cashiers cannot process refunds.');
    if (window.confirm('Are you sure you want to refund this sale? This will restore stock levels and reverse outstanding udhar balances.')) {
      await refundSale(saleId);
      // Close details if opened
      setSelectedInvoice(null);
    }
  };

  return (
    <div className="flex-column-gap" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      
      <div>
        <h1 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)' }}>Sales & Invoices</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Browse past customer invoices, filter transactions, reprint receipts, or trigger item refunds.
        </p>
      </div>

      {/* Filter Options Panel */}
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', padding: '1.25rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Invoice Number</label>
          <input
            type="text"
            className="input"
            style={{ minHeight: '40px', height: '40px' }}
            placeholder="Search INV-..."
            value={invoiceQuery}
            onChange={(e) => setInvoiceQuery(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Date</label>
          <input
            type="date"
            className="input"
            style={{ minHeight: '40px', height: '40px' }}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Payment Mode</label>
          <select
            className="input"
            style={{ minHeight: '40px', height: '40px' }}
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="">All Payments</option>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Card">Card</option>
            <option value="Udhar">Udhar (Credit)</option>
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Customer Name</label>
          <input
            type="text"
            className="input"
            style={{ minHeight: '40px', height: '40px' }}
            placeholder="Search Customer..."
            value={customerQuery}
            onChange={(e) => setCustomerQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Sales Invoices List */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Total Amount</th>
              <th>Method</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  No invoices matches the search parameters.
                </td>
              </tr>
            ) : (
              filteredSales.map((sale) => (
                <tr key={sale.id}>
                  <td style={{ fontWeight: 600 }}>{sale.invoice_number}</td>
                  <td>{sale.customer_name || 'Walk-in'}</td>
                  <td style={{ fontWeight: 700 }}>₹{parseFloat(sale.total_amount).toFixed(2)}</td>
                  <td>{sale.payment_method}</td>
                  <td>
                    <span className={`badge ${sale.status === 'Refunded' ? 'badge-danger' : 'badge-success'}`}>
                      {sale.status}
                    </span>
                  </td>
                  <td>{new Date(sale.created_at).toLocaleDateString('en-IN')}</td>
                  <td>
                    <button 
                      className="btn btn-outline" 
                      onClick={() => handleOpenDetails(sale)}
                      style={{ minHeight: '32px', height: '32px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                    >
                      👁️ Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice details popup modal */}
      {selectedInvoice && (
        <div className="modal-backdrop">
          <div className="modal-content">
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

            <div className="modal-footer">
              {!isCashier && selectedInvoice.status === 'Completed' && (
                <button className="btn btn-danger" onClick={() => handleRefundClick(selectedInvoice.id)}>
                  ↩️ Process Refund
                </button>
              )}
              <button className="btn btn-outline" onClick={() => window.print()}>
                🖨️ Reprint Receipt
              </button>
              <button className="btn btn-primary" onClick={() => setSelectedInvoice(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
