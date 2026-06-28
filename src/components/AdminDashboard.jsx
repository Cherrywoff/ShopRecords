import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dbOps, STORES } from '../db/db';
import { queueSyncAction } from '../db/sync';
import { supabase, isSupabaseConfigured } from '../supabase';

export default function AdminDashboard() {
  const { startSupportSession, currentUser, isOnline } = useApp();
  const [allShops, setAllShops] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedShop, setSelectedShop] = useState(null);

  // Form Fields for creating shop
  const [name, setName] = useState('');
  const [plan, setPlan] = useState('Basic');
  const [daysLimit, setDaysLimit] = useState(30);
  const [employeeLimit, setEmployeeLimit] = useState(2);
  const [deviceLimit, setDeviceLimit] = useState(1);

  // Form Fields for editing shop
  const [editPlan, setEditPlan] = useState('Basic');
  const [editEmployeeLimit, setEditEmployeeLimit] = useState(2);
  const [editDeviceLimit, setEditDeviceLimit] = useState(1);
  const [editExpiryDate, setEditExpiryDate] = useState('');

  // Support mode preferences
  const [supportRole, setSupportRole] = useState('Owner');

  const loadShops = async () => {
    try {
      if (isSupabaseConfigured && isOnline) {
        const { data } = await supabase.from('shops').select('*').order('created_at', { ascending: false });
        if (data) {
          setAllShops(data);
          await dbOps.putBatch(STORES.SHOPS, data);
        }
      } else {
        const data = await dbOps.getAll(STORES.SHOPS);
        setAllShops(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadShops();
  }, [isOnline]);

  const handleCreateShop = async (e) => {
    e.preventDefault();
    if (!name) return alert('Name is required.');

    const shopId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });

    const newShop = {
      id: shopId,
      name,
      plan,
      expiry_date: new Date(Date.now() + daysLimit * 24 * 60 * 60 * 1000).toISOString(),
      employee_limit: parseInt(employeeLimit) || 2,
      device_limit: parseInt(deviceLimit) || 1,
      created_at: new Date().toISOString()
    };

    await dbOps.put(STORES.SHOPS, newShop);
    await queueSyncAction(STORES.SHOPS, shopId, 'INSERT', newShop);
    
    setName('');
    setShowAddModal(false);
    loadShops();
    alert('Shop created successfully!');
  };

  const handleOpenDetails = (shop) => {
    setSelectedShop(shop);
    setEditPlan(shop.plan);
    setEditEmployeeLimit(shop.employee_limit);
    setEditDeviceLimit(shop.device_limit);
    setEditExpiryDate(shop.expiry_date.slice(0, 10)); // YYYY-MM-DD
    setShowDetailsModal(true);
  };

  const handleUpdateShop = async (e) => {
    e.preventDefault();
    if (!selectedShop) return;

    const updatedShop = {
      ...selectedShop,
      plan: editPlan,
      employee_limit: parseInt(editEmployeeLimit),
      device_limit: parseInt(editDeviceLimit),
      expiry_date: new Date(editExpiryDate).toISOString()
    };

    await dbOps.put(STORES.SHOPS, updatedShop);
    await queueSyncAction(STORES.SHOPS, selectedShop.id, 'UPDATE', updatedShop);

    setShowDetailsModal(false);
    setSelectedShop(null);
    loadShops();
    alert('Shop specifications updated successfully!');
  };

  const handleSupportModeStart = () => {
    if (!selectedShop) return;
    setShowDetailsModal(false);
    startSupportSession(selectedShop.id, supportRole);
  };

  return (
    <div className="flex-column-gap" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      
      <div className="flex-row-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)' }}>Admin Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            SaaS Administration terminal. Monitor shops, manage subscription plans, and log in to support sessions.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          🛡️ Provision New Shop
        </button>
      </div>

      {/* Shops stats counter */}
      <div className="stats-grid">
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-icon" style={{ backgroundColor: 'var(--primary)' }}>🏬</div>
          <div>
            <span className="text-secondary-label">Total Shop Tenants</span>
            <h3>{allShops.length}</h3>
          </div>
        </div>
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--secondary)' }}>
          <div className="stat-icon" style={{ backgroundColor: 'var(--secondary)' }}>👑</div>
          <div>
            <span className="text-secondary-label">Admin Role</span>
            <h3>Superuser Mode</h3>
          </div>
        </div>
      </div>

      {/* Shops Tenants Table */}
      <div className="card flex-column-gap">
        <h3 style={{ fontSize: '1.15rem' }}>Active Shop Tenants</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Shop Name</th>
                <th>Plan Type</th>
                <th>Expiry Date</th>
                <th>Employee Limit</th>
                <th>Device Limit</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allShops.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>No registered shop tenants found.</td>
                </tr>
              ) : (
                allShops.map((shop) => {
                  const isExpired = new Date(shop.expiry_date) < new Date();
                  return (
                    <tr key={shop.id}>
                      <td style={{ fontWeight: 600 }}>{shop.name}</td>
                      <td>
                        <span className="badge badge-success" style={{ backgroundColor: shop.plan === 'Premium' ? 'var(--secondary-light)' : 'var(--bg-accent)', color: shop.plan === 'Premium' ? 'var(--secondary)' : 'var(--text-primary)' }}>
                          {shop.plan}
                        </span>
                      </td>
                      <td style={{ color: isExpired ? 'var(--accent-error)' : 'var(--text-primary)', fontWeight: isExpired ? 700 : 500 }}>
                        {new Date(shop.expiry_date).toLocaleDateString('en-IN')} {isExpired ? '(Expired)' : ''}
                      </td>
                      <td>{shop.employee_limit} Max</td>
                      <td>{shop.device_limit} Max</td>
                      <td>
                        <span className={`badge ${isExpired ? 'badge-danger' : 'badge-success'}`}>
                          {isExpired ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn btn-outline" 
                          onClick={() => handleOpenDetails(shop)}
                          style={{ minHeight: '32px', height: '32px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        >
                          ⚙️ Manage & Support
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. Add Shop Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>🏬 Provision New Shop Tenant</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>×</button>
            </div>
            <form onSubmit={handleCreateShop}>
              <div className="modal-body flex-column-gap">
                <div className="form-group">
                  <label className="form-label">Shop Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Balaji Supermarket"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Subscription Plan</label>
                    <select className="input" value={plan} onChange={(e) => setPlan(e.target.value)}>
                      <option value="Basic">Basic</option>
                      <option value="Premium">Premium</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Validity (Days)</label>
                    <input
                      type="number"
                      className="input"
                      value={daysLimit}
                      onChange={(e) => setDaysLimit(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Employee limit</label>
                    <input
                      type="number"
                      className="input"
                      value={employeeLimit}
                      onChange={(e) => setEmployeeLimit(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Device Limit</label>
                    <input
                      type="number"
                      className="input"
                      value={deviceLimit}
                      onChange={(e) => setDeviceLimit(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Shop</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Shop Details & Edit Modal (Support trigger interface) */}
      {showDetailsModal && selectedShop && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Shop Control: {selectedShop.name}</h3>
              <button onClick={() => setShowDetailsModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>×</button>
            </div>
            
            <div className="modal-body flex-column-gap">
              
              {/* Impersonation / Support entry wrapper */}
              <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} className="flex-column-gap">
                <h4 style={{ fontSize: '0.95rem', color: 'var(--accent-warning)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  ⚠️ Start Support Session (Support Mode)
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Sign in to this tenant shop without changing passwords. Actions will audit as <strong>Support</strong>.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select 
                    className="input" 
                    style={{ minHeight: '36px', height: '36px', padding: '0 0.5rem', flexGrow: 1 }}
                    value={supportRole}
                    onChange={(e) => setSupportRole(e.target.value)}
                  >
                    <option value="Owner">View as Owner</option>
                    <option value="Manager">View as Manager</option>
                    <option value="Cashier">View as Cashier</option>
                  </select>
                  <button className="btn btn-secondary" onClick={handleSupportModeStart} style={{ minHeight: '36px', height: '36px', padding: '0 1rem' }}>
                    Enter Shop
                  </button>
                </div>
              </div>

              <hr style={{ borderColor: 'var(--border-color)' }} />

              {/* Edit shop metrics */}
              <form onSubmit={handleUpdateShop} className="flex-column-gap">
                <div className="form-group">
                  <label className="form-label">Subscription Plan</label>
                  <select className="input" value={editPlan} onChange={(e) => setEditPlan(e.target.value)}>
                    <option value="Basic">Basic</option>
                    <option value="Premium">Premium</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Expiry Date</label>
                  <input
                    type="date"
                    className="input"
                    value={editExpiryDate}
                    onChange={(e) => setEditExpiryDate(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Employee Limit</label>
                    <input
                      type="number"
                      className="input"
                      value={editEmployeeLimit}
                      onChange={(e) => setEditEmployeeLimit(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Device Limit</label>
                    <input
                      type="number"
                      className="input"
                      value={editDeviceLimit}
                      onChange={(e) => setEditDeviceLimit(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  Save Specifications
                </button>
              </form>
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowDetailsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
