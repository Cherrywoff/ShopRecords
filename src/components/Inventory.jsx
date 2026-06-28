import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { generateUUID } from '../db/db';

export default function Inventory() {
  const { products, saveProduct, deleteProduct, currentUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  // Form fields
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [hsnCode, setHSNCode] = useState('');
  const [gstRate, setGstRate] = useState('0');
  const [currentStock, setCurrentStock] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('0');
  const [isUnlisted, setIsUnlisted] = useState(false);

  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockProduct, setRestockProduct] = useState(null);
  const [restockQuantity, setRestockQuantity] = useState('');

  const isCashier = currentUser?.role === 'Cashier';

  // Search filter
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchTerm))
  );

  const openAddModal = () => {
    if (isCashier) return;
    setEditingProduct(null);
    setName('');
    setBarcode('');
    setCostPrice('');
    setSellingPrice('');
    setHSNCode('');
    setGstRate('0');
    setCurrentStock('0');
    setLowStockThreshold('0');
    setIsUnlisted(false);
    setShowModal(true);
  };

  const openEditModal = (p) => {
    if (isCashier) return;
    setEditingProduct(p);
    setName(p.name);
    setBarcode(p.barcode || '');
    setCostPrice(p.cost_price.toString());
    setSellingPrice(p.selling_price.toString());
    setHSNCode(p.hsn_code || '');
    setGstRate(p.gst_rate.toString());
    setCurrentStock(p.current_stock.toString());
    setLowStockThreshold(p.low_stock_threshold.toString());
    setIsUnlisted(p.is_unlisted || false);
    setShowModal(true);
  };

  const openRestockModal = (p) => {
    if (isCashier) return;
    setRestockProduct(p);
    setRestockQuantity('');
    setShowRestockModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isCashier) return;

    const prodData = {
      id: editingProduct?.id || null,
      name,
      barcode: barcode.trim() || null,
      cost_price: parseFloat(costPrice) || 0,
      selling_price: parseFloat(sellingPrice) || 0,
      hsn_code: hsnCode.trim() || null,
      gst_rate: parseFloat(gstRate) || 0,
      current_stock: parseFloat(currentStock) || 0,
      low_stock_threshold: parseFloat(lowStockThreshold) || 0,
      is_unlisted: isUnlisted
    };

    await saveProduct(prodData);
    setShowModal(false);
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (isCashier || !restockProduct) return;
    const qty = parseFloat(restockQuantity);
    if (isNaN(qty) || qty <= 0) return alert('Enter a valid quantity.');

    const updated = {
      ...restockProduct,
      current_stock: parseFloat(restockProduct.current_stock) + qty
    };

    await saveProduct(updated);
    setShowRestockModal(false);
  };

  const handleDelete = async (id) => {
    if (isCashier) return;
    if (window.confirm('Are you sure you want to delete this product?')) {
      await deleteProduct(id);
    }
  };

  const handleExportExcel = async () => {
    try {
      const { utils, writeFile } = await import('xlsx');
      const headers = ['Name', 'Barcode', 'Cost Price', 'Selling Price', 'HSN Code', 'GST Rate', 'Current Stock', 'Low Stock Threshold'];
      const rows = products.map(p => [
        p.name,
        p.barcode || '',
        p.cost_price,
        p.selling_price,
        p.hsn_code || '',
        p.gst_rate,
        p.current_stock,
        p.low_stock_threshold
      ]);

      const ws = utils.aoa_to_sheet([headers, ...rows]);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Inventory');
      writeFile(wb, `ShopRecords_Inventory_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
      alert('Error exporting Excel file: ' + err.message);
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const { read, utils } = await import('xlsx');
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = utils.sheet_to_json(sheet, { header: 1 });

          if (rows.length <= 1) return alert('Excel file is empty.');

          const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
          const nameIdx = headers.indexOf('name');
          const barcodeIdx = headers.indexOf('barcode');
          const costIdx = headers.indexOf('cost price');
          const sellIdx = headers.indexOf('selling price');
          const hsnIdx = headers.indexOf('hsn code');
          const gstIdx = headers.indexOf('gst rate');
          const stockIdx = headers.indexOf('current stock');
          const lowIdx = headers.indexOf('low stock threshold');

          if (nameIdx === -1 || sellIdx === -1) {
            return alert('Excel must contain "Name" and "Selling Price" columns.');
          }

          const { dbOps, STORES } = await import('../db/db');
          const { queueSyncAction } = await import('../db/sync');

          // Load current inventory list to compare and prevent duplicate records
          const currentProducts = await dbOps.getAll(STORES.PRODUCTS);

          let importedCount = 0;
          let updatedCount = 0;

          for (let i = 1; i < rows.length; i++) {
            const cols = rows[i];
            if (!cols || cols.length === 0) continue;

            const excelName = cols[nameIdx];
            if (!excelName) continue;

            const nameStr = String(excelName).trim();
            const excelSellingPrice = parseFloat(cols[sellIdx]) || 0;
            const excelStock = stockIdx !== -1 && cols[stockIdx] ? parseFloat(cols[stockIdx]) || 0 : 0;
            const excelBarcode = barcodeIdx !== -1 && cols[barcodeIdx] ? String(cols[barcodeIdx]).trim() : null;
            const excelCostPrice = costIdx !== -1 && cols[costIdx] ? parseFloat(cols[costIdx]) || 0 : 0;
            const excelHsnCode = hsnIdx !== -1 && cols[hsnIdx] ? String(cols[hsnIdx]).trim() : '';
            const excelGstRate = gstIdx !== -1 && cols[gstIdx] ? parseFloat(cols[gstIdx]) || 0 : 0;
            const excelLowThreshold = lowIdx !== -1 && cols[lowIdx] ? parseFloat(cols[lowIdx]) || 0 : 0;

            // Check if product with same name already exists (case-insensitive)
            const existing = currentProducts.find(p => 
              p.name.trim().toLowerCase() === nameStr.toLowerCase() &&
              (!p.shop_id || p.shop_id === currentUser.shop_id)
            );

            if (existing) {
              // Reconcile and add stock
              const oldStock = parseFloat(existing.current_stock || 0);
              existing.current_stock = oldStock + excelStock;
              
              // Selling price preference goes to Excel file
              existing.selling_price = excelSellingPrice;

              // Reconcile other details
              if (barcodeIdx !== -1 && excelBarcode) existing.barcode = excelBarcode;
              if (costIdx !== -1) existing.cost_price = excelCostPrice;
              if (hsnIdx !== -1) existing.hsn_code = excelHsnCode;
              if (gstIdx !== -1) existing.gst_rate = excelGstRate;
              if (lowIdx !== -1) existing.low_stock_threshold = excelLowThreshold;

              const productRecord = {
                ...existing,
                performed_by_user_id: currentUser.id,
                performed_by_name: currentUser.name,
                performed_by_role: currentUser.role,
                updated_at: new Date().toISOString()
              };

              await dbOps.put(STORES.PRODUCTS, productRecord);
              await queueSyncAction(STORES.PRODUCTS, existing.id, 'UPDATE', productRecord);
              updatedCount++;
            } else {
              // Create new product
              const newProd = {
                id: generateUUID(),
                name: nameStr,
                barcode: excelBarcode,
                cost_price: excelCostPrice,
                selling_price: excelSellingPrice,
                hsn_code: excelHsnCode,
                gst_rate: excelGstRate,
                current_stock: excelStock,
                low_stock_threshold: excelLowThreshold,
                is_unlisted: false,
                shop_id: currentUser.shop_id,
                performed_by_user_id: currentUser.id,
                performed_by_name: currentUser.name,
                performed_by_role: currentUser.role,
                updated_at: new Date().toISOString()
              };

              await dbOps.put(STORES.PRODUCTS, newProd);
              await queueSyncAction(STORES.PRODUCTS, newProd.id, 'INSERT', newProd);
              importedCount++;
            }
          }

          alert(`Bulk Import Complete!\n- Added ${importedCount} new products\n- Updated stock/price for ${updatedCount} existing products.`);
          window.location.reload();
        } catch (err) {
          alert('Error parsing Excel file: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      alert('Error loading sheet parser: ' + err.message);
    }
  };

  return (
    <div className="flex-column-gap" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* Search Header Bar */}
      <div className="flex-row-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)' }}>Product Catalog</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Manage store inventory, prices, tax levels, and restock alerts.
          </p>
        </div>

        {!isCashier && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input 
              type="file" 
              id="excel-file-input" 
              accept=".xlsx, .xls" 
              style={{ display: 'none' }} 
              onChange={handleImportExcel} 
            />
            <button className="btn btn-outline" onClick={() => document.getElementById('excel-file-input').click()}>
              📤 Import Excel
            </button>
            <button className="btn btn-outline" onClick={handleExportExcel}>
              📥 Export Excel
            </button>
            <button className="btn btn-primary" onClick={openAddModal}>
              📦 Add New Product
            </button>
          </div>
        )}
      </div>

      {/* Filter panel */}
      <div className="card" style={{ padding: '1rem' }}>
        <input
          type="text"
          className="input"
          placeholder="Filter catalog by product name or barcode..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Catalog Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Barcode</th>
              <th>Cost (₹)</th>
              <th>MRP (₹)</th>
              <th>GST (%)</th>
              <th>Stock Level</th>
              {!isCashier && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={isCashier ? 6 : 7} style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  No products found in catalog.
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => {
                const isLow = parseFloat(p.current_stock) <= parseFloat(p.low_stock_threshold);
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      {p.hsn_code && <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>HSN: {p.hsn_code}</div>}
                    </td>
                    <td>{p.barcode || '—'}</td>
                    <td>₹{parseFloat(p.cost_price).toFixed(2)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{parseFloat(p.selling_price).toFixed(2)}</td>
                    <td>{parseFloat(p.gst_rate)}%</td>
                    <td>
                      <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`}>
                        {parseFloat(p.current_stock)}
                      </span>
                    </td>
                    {!isCashier && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-outline" 
                            onClick={() => openRestockModal(p)}
                            style={{ minHeight: '32px', height: '32px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          >
                            📈 Restock
                          </button>
                          <button 
                            className="btn btn-outline" 
                            onClick={() => openEditModal(p)}
                            style={{ minHeight: '32px', height: '32px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            className="btn btn-danger" 
                            onClick={() => handleDelete(p.id)}
                            style={{ minHeight: '32px', height: '32px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 1. Add/Edit product Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingProduct ? '✏️ Edit Product Details' : '📦 Create Product'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body flex-column-gap">
                <div className="form-group">
                  <label className="form-label">Product Name</label>
                  <input
                    type="text"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Barcode digits (optional)</label>
                  <input
                    type="text"
                    className="input"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Cost Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Selling Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">HSN Code</label>
                    <input
                      type="text"
                      className="input"
                      value={hsnCode}
                      onChange={(e) => setHSNCode(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GST Tax Rate (%)</label>
                    <select className="input" value={gstRate} onChange={(e) => setGstRate(e.target.value)}>
                      <option value="0">0% (Exempt)</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Initial Stock Level</label>
                    <input
                      type="number"
                      className="input"
                      value={currentStock}
                      onChange={(e) => setCurrentStock(e.target.value)}
                      disabled={!!editingProduct} // Disable for edits, restock must be handled via restock trigger
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Low Stock Threshold</label>
                    <input
                      type="number"
                      className="input"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="isUnlisted"
                    checked={isUnlisted}
                    onChange={(e) => setIsUnlisted(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <label htmlFor="isUnlisted" className="form-label" style={{ marginBottom: 0 }}>
                    Hide from search results (unlisted item)
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Restock product Modal */}
      {showRestockModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>📈 Restock Product</h3>
              <button onClick={() => setShowRestockModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>×</button>
            </div>
            <form onSubmit={handleRestockSubmit}>
              <div className="modal-body flex-column-gap">
                <p style={{ fontWeight: 600 }}>Product: {restockProduct?.name}</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Current Stock: {parseFloat(restockProduct?.current_stock)}</p>
                <div className="form-group">
                  <label className="form-label">Restock Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="e.g. 50"
                    value={restockQuantity}
                    onChange={(e) => setRestockQuantity(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowRestockModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
