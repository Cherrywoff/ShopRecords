import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dbOps, STORES, generateUUID } from '../db/db';
import { queueSyncAction } from '../db/sync';

export default function Settings() {
  const { 
    theme, 
    setTheme, 
    exportBackup, 
    importBackup, 
    currentShop, 
    currentUser,
    isSubscriptionActive,
    retryQuarantinedItems,
    quarantineQueue
  } = useApp();

  const [importMode, setImportMode] = useState('merge');
  const [employees, setEmployees] = useState([]);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);

  // Employee Form
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empRole, setEmpRole] = useState('Cashier');
  const [empPassword, setEmpPassword] = useState('');

  const loadEmployees = async () => {
    try {
      const allProfiles = await dbOps.getAll(STORES.USERS);
      const shopEmployees = allProfiles.filter(p => p.shop_id === currentUser.shop_id && p.role !== 'Owner');
      setEmployees(shopEmployees);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const handleImportSubmit = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (window.confirm(`Are you sure you want to perform a ${importMode} import? This will edit your store data.`)) {
      importBackup(file, importMode);
    }
    // Reset file input
    e.target.value = '';
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!empName || !empEmail || !empPassword) return alert('All fields are required.');
    
    // Check limit
    if (employees.length >= (currentShop?.employee_limit || 2)) {
      return alert(`Employee creation limit reached. Your plan allows max ${currentShop?.employee_limit || 2} employees. Contact software owner to upgrade.`);
    }

    const employeeId = generateUUID();
    const newProfile = {
      id: employeeId,
      shop_id: currentUser.shop_id,
      role: empRole,
      name: empName,
      email: empEmail,
      password: empPassword, // Stored for custom login lookup
      status: 'Active',
      created_at: new Date().toISOString()
    };

    // Save locally
    await dbOps.put(STORES.USERS, newProfile);
    
    // Cache in offline auth so they can log in offline
    await dbOps.put(STORES.OFFLINE_AUTH_CACHE, {
      id: employeeId,
      email: empEmail,
      name: empName,
      role: empRole,
      shop_id: currentUser.shop_id,
      shopName: currentShop?.name || ''
    });

    // Queue sync
    await queueSyncAction(STORES.USERS, employeeId, 'INSERT', newProfile);

    // Reset Form
    setEmpName('');
    setEmpEmail('');
    setEmpPassword('');
    setShowEmployeeModal(false);
    loadEmployees();
    alert(`Employee ${empName} profile registered successfully!`);
  };

  return (
    <div className="flex-column-gap" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      
      <div>
        <h1 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)' }}>Store Configurations</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Configure app appearance, register store employees, and manage JSON recovery backups.
        </p>
      </div>

      <div className="responsive-grid-2">
        
        {/* Left Column: UI Preference & Backups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Appearance setting */}
          <div className="card flex-column-gap">
            <h3 style={{ fontSize: '1.15rem' }}>Theme Settings</h3>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-outline'}`} 
                onClick={() => setTheme('light')}
                style={{ flexGrow: 1, minHeight: '40px' }}
              >
                ☀️ Light Mode
              </button>
              <button 
                className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-outline'}`} 
                onClick={() => setTheme('dark')}
                style={{ flexGrow: 1, minHeight: '40px' }}
              >
                🌙 Dark Mode
              </button>
            </div>
          </div>

          {/* Backup & Restore systems */}
          <div className="card flex-column-gap">
            <h3 style={{ fontSize: '1.15rem' }}>Database Backup & Restore</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Export your store records to a file for safe keeping, or restore previous sessions.
            </p>

            <button className="btn btn-primary" onClick={exportBackup} style={{ width: '100%' }}>
              📥 Download Backup File
            </button>

            <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

            <div className="form-group">
              <label className="form-label">Restore Import Mode</label>
              <select className="input" value={importMode} onChange={(e) => setImportMode(e.target.value)}>
                <option value="merge">Merge (Combine with local data)</option>
                <option value="replace">Replace (Overwrite and delete local database)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Select Backup JSON File</label>
              <input
                type="file"
                accept=".json"
                className="input"
                style={{ padding: '0.5rem' }}
                onChange={handleImportSubmit}
              />
            </div>
          </div>

          {/* Sync Troubleshooter */}
          <div className="card flex-column-gap">
            <h3 style={{ fontSize: '1.15rem' }}>Sync Troubleshooter</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              If you had missing tables on Supabase and just created them, click below to replay all failed transactions.
            </p>

            <button 
              className="btn btn-outline" 
              onClick={async () => {
                const count = await retryQuarantinedItems();
                alert(`Re-queued ${count} failed sync operations. Check the dashboard sync bar!`);
              }}
              style={{ width: '100%' }}
            >
              🔄 Retry failed transactions ({quarantineQueue?.length || 0} errors)
            </button>
          </div>

        </div>

        {/* Right Column: Employee configuration list */}
        <div className="card flex-column-gap">
          <div className="flex-row-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1.15rem' }}>Staff Management</h3>
            <button className="btn btn-primary" onClick={() => setShowEmployeeModal(true)} style={{ minHeight: '36px', height: '36px', padding: '0 0.75rem' }}>
              ➕ Create Staff
            </button>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Quota Used: <strong>{employees.length}</strong> of <strong>{currentShop?.employee_limit || 2}</strong> employees.
          </p>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>No registered employees.</td>
                  </tr>
                ) : (
                  employees.map(emp => (
                    <tr key={emp.id}>
                      <td style={{ fontWeight: 600 }}>{emp.name}</td>
                      <td>{emp.role}</td>
                      <td>
                        <span className="badge badge-success">{emp.status || 'Active'}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Employee creation Modal */}
      {showEmployeeModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>➕ Register Staff Employee</h3>
              <button onClick={() => setShowEmployeeModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>×</button>
            </div>
            <form onSubmit={handleAddEmployee}>
              <div className="modal-body flex-column-gap">
                <div className="form-group">
                  <label className="form-label">Employee Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Sunil Kumar"
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="sunil@shop.com"
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Access Role</label>
                  <select className="input" value={empRole} onChange={(e) => setEmpRole(e.target.value)}>
                    <option value="Manager">Manager (Full POS, Udhar, Catalog)</option>
                    <option value="Cashier">Cashier (POS Checkout only)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Initial Password</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    value={empPassword}
                    onChange={(e) => setEmpPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEmployeeModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
