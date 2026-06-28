import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

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
          <button className="btn btn-primary" onClick={openAddModal}>
            📦 Add New Product
          </button>
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
