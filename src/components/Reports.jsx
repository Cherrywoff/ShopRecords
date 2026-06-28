import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export default function Reports() {
  const { 
    products, 
    sales, 
    saleItems, 
    expenses, 
    currentShop 
  } = useApp();

  const [activeTab, setActiveTab] = useState('gst');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activePrintReport, setActivePrintReport] = useState(null);

  useEffect(() => {
    if (activePrintReport) {
      setTimeout(() => {
        window.print();
        setActivePrintReport(null);
      }, 500);
    }
  }, [activePrintReport]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Helper to export CSV
  const exportToCSV = (headers, rows, filename) => {
    const csvString = [
      headers.join(','),
      ...rows.map(r => r.map(val => {
        const text = val === null || val === undefined ? '' : String(val);
        return `"${text.replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- GST REPORT COMPUTATIONS ---
  const getGstData = () => {
    const monthlySales = sales.filter(sale => {
      const date = new Date(sale.created_at);
      return date.getMonth() === selectedMonth && 
             date.getFullYear() === selectedYear &&
             sale.status === 'Completed';
    });

    // Group items by rate
    const gstGroups = {
      '0%': { taxable: 0, tax: 0, cgst: 0, sgst: 0, total: 0 },
      '5%': { taxable: 0, tax: 0, cgst: 0, sgst: 0, total: 0 },
      '12%': { taxable: 0, tax: 0, cgst: 0, sgst: 0, total: 0 },
      '18%': { taxable: 0, tax: 0, cgst: 0, sgst: 0, total: 0 },
      '28%': { taxable: 0, tax: 0, cgst: 0, sgst: 0, total: 0 },
    };

    let totalGstCollected = 0;
    let totalTaxableValue = 0;
    let grandTotalSales = 0;

    monthlySales.forEach(sale => {
      // Find sale items for this sale
      const items = saleItems.filter(item => item.sale_id === sale.id);
      
      items.forEach(item => {
        const rate = parseFloat(item.gst_rate || 0);
        const rateKey = `${Math.round(rate)}%`;
        
        const total = parseFloat(item.price) * parseFloat(item.quantity);
        const base = total / (1 + (rate / 100));
        const tax = total - base;

        if (gstGroups[rateKey]) {
          gstGroups[rateKey].taxable += base;
          gstGroups[rateKey].tax += tax;
          gstGroups[rateKey].cgst += tax / 2;
          gstGroups[rateKey].sgst += tax / 2;
          gstGroups[rateKey].total += total;

          totalGstCollected += tax;
          totalTaxableValue += base;
          grandTotalSales += total;
        } else {
          // Fallback group for other rates
          if (!gstGroups[`${rateKey}`]) {
            gstGroups[`${rateKey}`] = { taxable: 0, tax: 0, cgst: 0, sgst: 0, total: 0 };
          }
          gstGroups[`${rateKey}`].taxable += base;
          gstGroups[`${rateKey}`].tax += tax;
          gstGroups[`${rateKey}`].cgst += tax / 2;
          gstGroups[`${rateKey}`].sgst += tax / 2;
          gstGroups[`${rateKey}`].total += total;

          totalGstCollected += tax;
          totalTaxableValue += base;
          grandTotalSales += total;
        }
      });
    });

    return { gstGroups, totalGstCollected, totalTaxableValue, grandTotalSales, saleCount: monthlySales.length };
  };

  const handleDownloadGstReport = () => {
    const { gstGroups } = getGstData();
    const headers = ['GST Rate', 'Taxable Value (Base)', 'CGST', 'SGST', 'IGST', 'Total GST Collected', 'Gross Total (MRP)'];
    
    const rows = Object.entries(gstGroups).map(([rate, vals]) => [
      rate,
      vals.taxable.toFixed(2),
      vals.cgst.toFixed(2),
      vals.sgst.toFixed(2),
      '0.00',
      vals.tax.toFixed(2),
      vals.total.toFixed(2)
    ]);

    // Add totals row
    const totalTaxable = Object.values(gstGroups).reduce((acc, curr) => acc + curr.taxable, 0);
    const totalCgst = Object.values(gstGroups).reduce((acc, curr) => acc + curr.cgst, 0);
    const totalSgst = Object.values(gstGroups).reduce((acc, curr) => acc + curr.sgst, 0);
    const totalTax = Object.values(gstGroups).reduce((acc, curr) => acc + curr.tax, 0);
    const totalGross = Object.values(gstGroups).reduce((acc, curr) => acc + curr.total, 0);

    rows.push([
      'TOTAL',
      totalTaxable.toFixed(2),
      totalCgst.toFixed(2),
      totalSgst.toFixed(2),
      '0.00',
      totalTax.toFixed(2),
      totalGross.toFixed(2)
    ]);

    exportToCSV(
      headers, 
      rows, 
      `GST_Report_${months[selectedMonth]}_${selectedYear}.csv`
    );
  };

  // --- AUDIT TRAIL REPORT ---
  const getAuditLogs = () => {
    const logs = [];

    // Sales Audit
    sales.forEach(sale => {
      logs.push({
        date: new Date(sale.created_at),
        type: 'SALE',
        action: `Billed Invoice #${sale.invoice_number} (Amount: ₹${sale.total_amount.toFixed(2)})`,
        performedBy: `${sale.performed_by_name || 'System'} (${sale.performed_by_role || 'Staff'})`
      });
      if (sale.status === 'Refunded') {
        logs.push({
          date: new Date(sale.updated_at || sale.created_at),
          type: 'REFUND',
          action: `Refunded Invoice #${sale.invoice_number}`,
          performedBy: `${sale.performed_by_name || 'System'} (${sale.performed_by_role || 'Staff'})`
        });
      }
    });

    // Expenses Audit
    expenses.forEach(exp => {
      logs.push({
        date: new Date(exp.created_at),
        type: 'EXPENSE',
        action: `Logged ${exp.category} Expense of ₹${parseFloat(exp.amount).toFixed(2)} (${exp.description || 'No notes'})`,
        performedBy: `${exp.performed_by_name || 'System'} (${exp.performed_by_role || 'Staff'})`
      });
    });

    // Products Audit
    products.forEach(prod => {
      logs.push({
        date: new Date(prod.updated_at || prod.created_at),
        type: 'PRODUCT',
        action: `Modified product: ${prod.name} (Barcode: ${prod.barcode || 'N/A'}, Price: ₹${prod.selling_price.toFixed(2)})`,
        performedBy: `${prod.performed_by_name || 'System'} (${prod.performed_by_role || 'Staff'})`
      });
    });

    // Sort logs descending (newest first)
    return logs.sort((a, b) => b.date - a.date);
  };

  const handleDownloadAuditReport = () => {
    const logs = getAuditLogs();
    const headers = ['Timestamp', 'Activity Group', 'Activity Detail', 'Executed By'];
    const rows = logs.map(l => [
      l.date.toLocaleString('en-IN'),
      l.type,
      l.action,
      l.performedBy
    ]);

    exportToCSV(headers, rows, `Audit_Trail_Report_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // --- INVENTORY VALUATION ---
  const getInventoryValuation = () => {
    let totalItems = 0;
    let costValue = 0;
    let mrpValue = 0;
    const negativeStockItems = [];

    products.forEach(prod => {
      const stock = parseFloat(prod.current_stock || 0);
      totalItems++;

      if (stock < 0) {
        negativeStockItems.push(prod);
      }

      // Multiply price by stock (for valuation, treat negative stock as zero or actual liability)
      const positiveStock = Math.max(0, stock);
      costValue += parseFloat(prod.cost_price || 0) * positiveStock;
      mrpValue += parseFloat(prod.selling_price || 0) * positiveStock;
    });

    return {
      totalItems,
      costValue,
      mrpValue,
      projectedProfit: mrpValue - costValue,
      negativeStockCount: negativeStockItems.length,
      negativeStockItems
    };
  };

  const handleDownloadInventoryReport = () => {
    const headers = ['Product Name', 'Barcode', 'HSN Code', 'GST Rate %', 'Cost Price', 'Selling Price (MRP)', 'Current Stock', 'Low Stock Trigger', 'Total Cost Value', 'Total MRP Value'];
    
    const rows = products.map(p => {
      const stock = parseFloat(p.current_stock || 0);
      const totalCost = parseFloat(p.cost_price || 0) * Math.max(0, stock);
      const totalMrp = parseFloat(p.selling_price || 0) * Math.max(0, stock);
      return [
        p.name,
        p.barcode || 'N/A',
        p.hsn_code || 'N/A',
        `${p.gst_rate || 0}%`,
        p.cost_price.toFixed(2),
        p.selling_price.toFixed(2),
        stock.toFixed(3),
        p.low_stock_threshold.toFixed(3),
        totalCost.toFixed(2),
        totalMrp.toFixed(2)
      ];
    });

    exportToCSV(headers, rows, `Inventory_Valuation_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const gstReport = getGstData();
  const inventoryReport = getInventoryValuation();
  const auditTrailLogs = getAuditLogs().slice(0, 30); // show top 30 logs in UI

  return (
    <div className="flex-column-gap">
      <div className="flex-row-between">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', margin: 0 }}>Reports & Taxes</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
            GST breakdown reports, auditor logs, and inventory valuations
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1rem' }}>
        <button
          onClick={() => setActiveTab('gst')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 1rem',
            color: activeTab === 'gst' ? 'var(--primary)' : 'var(--text-tertiary)',
            fontWeight: 600,
            borderBottom: activeTab === 'gst' ? '2px solid var(--primary)' : '2px solid transparent',
            cursor: 'pointer'
          }}
        >
          📁 GST (CA Tax Report)
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 1rem',
            color: activeTab === 'audit' ? 'var(--primary)' : 'var(--text-tertiary)',
            fontWeight: 600,
            borderBottom: activeTab === 'audit' ? '2px solid var(--primary)' : '2px solid transparent',
            cursor: 'pointer'
          }}
        >
          📜 Audit Trail Log
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 1rem',
            color: activeTab === 'inventory' ? 'var(--primary)' : 'var(--text-tertiary)',
            fontWeight: 600,
            borderBottom: activeTab === 'inventory' ? '2px solid var(--primary)' : '2px solid transparent',
            cursor: 'pointer'
          }}
        >
          📦 Inventory valuation
        </button>
      </div>

      {/* Content */}
      <div className="card">
        {activeTab === 'gst' && (
          <div className="flex-column-gap">
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span className="text-secondary-label">Select Month</span>
                <select 
                  className="input" 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  style={{ minWidth: '150px', minHeight: '38px', padding: '0.25rem 0.75rem' }}
                >
                  {months.map((m, idx) => <option key={m} value={idx}>{m}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span className="text-secondary-label">Select Year</span>
                <select 
                  className="input" 
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  style={{ minWidth: '100px', minHeight: '38px', padding: '0.25rem 0.75rem' }}
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => setActivePrintReport({ type: 'gst', title: 'GST CA Report Statement', data: getGstData() })}
                  style={{ minHeight: '38px' }}
                >
                  🖨️ Export PDF Report
                </button>
                <button 
                  className="btn btn-outline" 
                  onClick={handleDownloadGstReport}
                  style={{ minHeight: '38px' }}
                >
                  📥 Download CSV
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', margin: '1rem 0' }}>
              <div className="card" style={{ flex: 1, minWidth: '180px', padding: '1rem', textAlign: 'center', backgroundColor: 'var(--bg-tertiary)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Total Sales Billed</span>
                <h3 style={{ fontSize: '1.5rem', margin: '0.25rem 0' }}>{gstReport.saleCount}</h3>
              </div>
              <div className="card" style={{ flex: 1, minWidth: '180px', padding: '1rem', textAlign: 'center', backgroundColor: 'var(--bg-tertiary)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Taxable value (Base)</span>
                <h3 style={{ fontSize: '1.5rem', margin: '0.25rem 0', color: 'var(--primary)' }}>₹{gstReport.totalTaxableValue.toFixed(2)}</h3>
              </div>
              <div className="card" style={{ flex: 1, minWidth: '180px', padding: '1rem', textAlign: 'center', backgroundColor: 'var(--bg-tertiary)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Included GST Tax</span>
                <h3 style={{ fontSize: '1.5rem', margin: '0.25rem 0', color: 'var(--accent-warning)' }}>₹{gstReport.totalGstCollected.toFixed(2)}</h3>
              </div>
            </div>

            <h2 style={{ fontSize: '1.1rem', margin: '0.5rem 0 0 0' }}>GST Rate Breakdown Table</h2>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>GST Rate</th>
                    <th>Taxable Value</th>
                    <th>CGST (Central)</th>
                    <th>SGST (State)</th>
                    <th>Total Tax Included</th>
                    <th>Total Sales Billed</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(gstReport.gstGroups).map(([rate, vals]) => (
                    <tr key={rate}>
                      <td><strong>{rate}</strong></td>
                      <td>₹{vals.taxable.toFixed(2)}</td>
                      <td>₹{vals.cgst.toFixed(2)}</td>
                      <td>₹{vals.sgst.toFixed(2)}</td>
                      <td>₹{vals.tax.toFixed(2)}</td>
                      <td>₹{vals.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="flex-column-gap">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>System Logs (Auditor Trail)</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" onClick={() => setActivePrintReport({ type: 'audit', title: 'System Activity Logs', data: getAuditLogs() })}>
                  🖨️ Export PDF Report
                </button>
                <button className="btn btn-outline" onClick={handleDownloadAuditReport}>
                  📥 Download CSV
                </button>
              </div>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Module</th>
                    <th>Action Detail</th>
                    <th>Performed By</th>
                  </tr>
                </thead>
                <tbody>
                  {auditTrailLogs.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>No activities logged yet.</td>
                    </tr>
                  ) : (
                    auditTrailLogs.map((log, idx) => (
                      <tr key={idx}>
                        <td style={{ fontSize: '0.8rem' }}>{log.date.toLocaleString('en-IN')}</td>
                        <td>
                          <span 
                            className="badge" 
                            style={{ 
                              backgroundColor: log.type === 'SALE' ? 'var(--primary-light)' : 
                                               log.type === 'REFUND' ? 'var(--accent-error-light)' : 
                                               log.type === 'EXPENSE' ? '#fef3c7' : '#e2e8f0',
                              color: log.type === 'SALE' ? 'var(--primary)' : 
                                     log.type === 'REFUND' ? 'var(--accent-error)' : 
                                     log.type === 'EXPENSE' ? '#d97706' : '#475569'
                            }}
                          >
                            {log.type}
                          </span>
                        </td>
                        <td>{log.action}</td>
                        <td style={{ fontSize: '0.85rem' }}>{log.performedBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="flex-column-gap">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Inventory Valuation & Liability</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" onClick={() => setActivePrintReport({ type: 'inventory', title: 'Inventory Valuation Report', data: getInventoryValuation() })}>
                  🖨️ Export PDF Report
                </button>
                <button className="btn btn-outline" onClick={handleDownloadInventoryReport}>
                  📥 Download CSV
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="card" style={{ flex: 1, minWidth: '150px', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Total Products</span>
                <h3 style={{ fontSize: '1.5rem', margin: '0.25rem 0' }}>{inventoryReport.totalItems}</h3>
              </div>
              <div className="card" style={{ flex: 1, minWidth: '180px', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Cost Valuation</span>
                <h3 style={{ fontSize: '1.5rem', margin: '0.25rem 0' }}>₹{inventoryReport.costValue.toFixed(2)}</h3>
              </div>
              <div className="card" style={{ flex: 1, minWidth: '180px', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>MRP/Retail Valuation</span>
                <h3 style={{ fontSize: '1.5rem', margin: '0.25rem 0', color: 'var(--primary)' }}>₹{inventoryReport.mrpValue.toFixed(2)}</h3>
              </div>
              <div className="card" style={{ flex: 1, minWidth: '180px', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Projected Gross Profit</span>
                <h3 style={{ fontSize: '1.5rem', margin: '0.25rem 0', color: 'var(--text-success)' }}>₹{inventoryReport.projectedProfit.toFixed(2)}</h3>
              </div>
            </div>

            <h2 style={{ fontSize: '1.1rem', margin: '0.5rem 0 0 0', color: 'var(--accent-error)' }}>
              Negative Stock / Out-of-Stock Sales ({inventoryReport.negativeStockCount})
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
              Items sold beyond the quantity present in the inventory (unlisted or oversold items)
            </p>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Barcode</th>
                    <th>Current Stock</th>
                    <th>MRP Price</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryReport.negativeStockItems.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>No negative stock items.</td>
                    </tr>
                  ) : (
                    inventoryReport.negativeStockItems.map((prod) => (
                      <tr key={prod.id} style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                        <td style={{ color: 'var(--accent-error)', fontWeight: 'bold' }}>{prod.name}</td>
                        <td>{prod.barcode || 'N/A'}</td>
                        <td style={{ color: 'var(--accent-error)' }}>{parseFloat(prod.current_stock).toFixed(3)}</td>
                        <td>₹{parseFloat(prod.selling_price).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Full-Page PDF Report Print Template (hidden from screen, shown on print layout) */}
      {activePrintReport && (
        <div className="print-report-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '20px' }}>
            <div>
              <h1 style={{ fontSize: '24px', margin: 0, fontWeight: 'bold' }}>{currentShop?.name || 'ShopRecords Store'}</h1>
              <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#555' }}>Shop Business Report</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ fontSize: '18px', margin: 0, color: '#333' }}>{activePrintReport.title}</h2>
              <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>
                Timeline: {activePrintReport.type === 'gst' ? `${months[selectedMonth]} ${selectedYear}` : `As of ${new Date().toLocaleDateString('en-IN')}`}
              </p>
            </div>
          </div>

          {/* GST PDF REPORT */}
          {activePrintReport.type === 'gst' && (
            <div>
              <p style={{ fontSize: '14px', marginBottom: '15px' }}>
                Monthly Tax Breakdown Summary for the period of <strong>{months[selectedMonth]} {selectedYear}</strong>.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>GST Rate</th>
                    <th>Taxable Value (Base)</th>
                    <th>CGST (Central)</th>
                    <th>SGST (State)</th>
                    <th>IGST (Inter-state)</th>
                    <th>Total Tax Collected</th>
                    <th>Gross Total Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(activePrintReport.data.gstGroups).map(([rate, vals]) => (
                    <tr key={rate}>
                      <td>{rate}</td>
                      <td>₹{vals.taxable.toFixed(2)}</td>
                      <td>₹{vals.cgst.toFixed(2)}</td>
                      <td>₹{vals.sgst.toFixed(2)}</td>
                      <td>₹0.00</td>
                      <td>₹{vals.tax.toFixed(2)}</td>
                      <td>₹{vals.total.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 'bold', borderTop: '2px solid #000' }}>
                    <td>TOTAL</td>
                    <td>₹{activePrintReport.data.totalTaxableValue.toFixed(2)}</td>
                    <td>₹{(activePrintReport.data.totalGstCollected / 2).toFixed(2)}</td>
                    <td>₹{(activePrintReport.data.totalGstCollected / 2).toFixed(2)}</td>
                    <td>₹0.00</td>
                    <td>₹{activePrintReport.data.totalGstCollected.toFixed(2)}</td>
                    <td>₹{activePrintReport.data.grandTotalSales.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: '30px', fontSize: '12px', color: '#555', borderTop: '1px dashed #ccc', paddingTop: '15px' }}>
                * This CA Report statement reflects completed POS transactions recorded in the local IndexedDB and Supabase cloud ledger.
              </div>
            </div>
          )}

          {/* AUDIT LOG PDF REPORT */}
          {activePrintReport.type === 'audit' && (
            <div>
              <p style={{ fontSize: '14px', marginBottom: '15px' }}>
                Audited System Activity Trails statement.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Module</th>
                    <th>Action Detail</th>
                    <th>Performed By</th>
                  </tr>
                </thead>
                <tbody>
                  {activePrintReport.data.slice(0, 100).map((log, idx) => (
                    <tr key={idx}>
                      <td>{log.date.toLocaleString('en-IN')}</td>
                      <td>{log.type}</td>
                      <td>{log.action}</td>
                      <td>{log.performedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* INVENTORY VALUATION PDF REPORT */}
          {activePrintReport.type === 'inventory' && (
            <div>
              <p style={{ fontSize: '14px', marginBottom: '15px' }}>
                Stock inventory valuation, projected margins, and negative stock records.
              </p>
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '4px', backgroundColor: '#fafafa' }}>
                <div style={{ flex: 1 }}>
                  <strong>Total Products Cataloged:</strong> {activePrintReport.data.totalItems}
                </div>
                <div style={{ flex: 1 }}>
                  <strong>Total Cost Value:</strong> ₹{activePrintReport.data.costValue.toFixed(2)}
                </div>
                <div style={{ flex: 1 }}>
                  <strong>Total MRP Retail Value:</strong> ₹{activePrintReport.data.mrpValue.toFixed(2)}
                </div>
                <div style={{ flex: 1 }}>
                  <strong>Projected Gross Profit:</strong> ₹{activePrintReport.data.projectedProfit.toFixed(2)}
                </div>
              </div>

              <h3 style={{ fontSize: '16px', margin: '20px 0 10px 0', color: '#c00' }}>Negative / Out-of-Stock Sales Items ({activePrintReport.data.negativeStockCount})</h3>
              <table>
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Barcode</th>
                    <th>Current Stock</th>
                    <th>MRP Price</th>
                  </tr>
                </thead>
                <tbody>
                  {activePrintReport.data.negativeStockItems.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center' }}>No negative stock items.</td>
                    </tr>
                  ) : (
                    activePrintReport.data.negativeStockItems.map((prod) => (
                      <tr key={prod.id}>
                        <td>{prod.name}</td>
                        <td>{prod.barcode || 'N/A'}</td>
                        <td>{parseFloat(prod.current_stock).toFixed(3)}</td>
                        <td>₹{parseFloat(prod.selling_price).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ position: 'fixed', bottom: '10mm', left: '10mm', right: '10mm', textAlign: 'center', fontSize: '10px', color: '#888', borderTop: '1px solid #ddd', paddingTop: '10px' }}>
            Report generated via ShopRecords Business Management POS Suite on {new Date().toLocaleString('en-IN')}. Page 1 of 1.
          </div>
        </div>
      )}
    </div>
  );
}
