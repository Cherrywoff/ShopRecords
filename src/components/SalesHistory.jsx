import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function SalesHistory() {
  const { sales, saleItems, refundSale, currentUser, currentShop } = useApp();
  
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

  const handleShareBill = () => {
    if (!selectedInvoice) return;
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
      }).catch(err => console.log('Share failed:', err));
    } else {
      navigator.clipboard.writeText(summaryText);
      alert('Invoice summary copied to clipboard! You can now paste and share it.');
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
                  <p style={{ fontSize: '0.85rem' }}>
                    <strong>Payment Method:</strong> <span className="badge badge-primary" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', marginLeft: '0.25rem' }}>{selectedInvoice.payment_method}</span>
                  </p>
                  {selectedInvoice.payment_method === 'Split' && selectedInvoice.payment_details && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      (Cash: ₹{parseFloat(selectedInvoice.payment_details.Cash || selectedInvoice.payment_details.cash || 0).toFixed(2)}, UPI/Card: ₹{parseFloat(selectedInvoice.payment_details.UPI || selectedInvoice.payment_details.upi || selectedInvoice.payment_details.Card || selectedInvoice.payment_details.card || 0).toFixed(2)})
                    </p>
                  )}
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
              {!isCashier && selectedInvoice.status === 'Completed' && (
                <button className="btn btn-danger" onClick={() => handleRefundClick(selectedInvoice.id)}>
                  ↩️ Refund Bill
                </button>
              )}
              <button className="btn btn-primary" onClick={() => window.print()}>
                🖨️ Print Bill
              </button>
              <button className="btn btn-outline" onClick={handleShareBill}>
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
