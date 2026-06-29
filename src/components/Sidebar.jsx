import React from 'react';
import { useApp } from '../context/AppContext';

export default function Sidebar({ currentTab, setCurrentTab }) {
  const { currentUser, handleLogout, supportMode, stopSupportSession } = useApp();

  if (!currentUser) return null;

  const role = currentUser.role;

  // Filter tabs based on roles
  const menuItems = [];

  if (role === 'Admin') {
    menuItems.push({ id: 'admin', label: 'Admin Panel', icon: '🛡️' });
  } else {
    // POS (All roles)
    menuItems.push({ id: 'pos', label: 'POS Billing', icon: '🛒' });
    
    // Inventory (All roles)
    menuItems.push({ id: 'inventory', label: 'Inventory', icon: '📦' });
    
    // Sales History (All roles)
    menuItems.push({ id: 'sales', label: 'Sales History', icon: '📜' });

    // Udhar Ledger (Owner, Manager)
    if (role === 'Owner' || role === 'Manager') {
      menuItems.push({ id: 'udhar', label: 'Udhar (Credit)', icon: '👥' });
    }

    // Expense & Suppliers (Owner only)
    if (role === 'Owner') {
      menuItems.push({ id: 'expenses', label: 'Expenses', icon: '💸' });
      menuItems.push({ id: 'suppliers', label: 'Suppliers', icon: '🚚' });
      menuItems.push({ id: 'closing', label: 'Daily Closing', icon: '🏦' });
    }

    // Reports (Owner and Manager)
    if (role === 'Owner' || role === 'Manager') {
      menuItems.push({ id: 'reports', label: 'Reports & Taxes', icon: '📈' });
    }

    // Settings (Owner and Admin)
    if (role === 'Owner') {
      menuItems.push({ id: 'settings', label: 'Settings', icon: '⚙️' });
    }
  }

  return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.5rem' }}>
      <div>
        <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src="/icon.jpg" alt="ShopRecords Logo" style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>ShopRecords</h2>
        </div>

        {supportMode.isActive && (
          <div style={{ 
            backgroundColor: 'var(--accent-warning)', 
            color: 'black', 
            padding: '0.75rem', 
            borderRadius: 'var(--radius-sm)', 
            marginBottom: '1rem',
            fontSize: '0.8rem',
            fontWeight: 'bold'
          }}>
            ⚠️ SUPPORT ACTIVE ({supportMode.supportRole})
            <button 
              className="btn btn-outline" 
              onClick={stopSupportSession} 
              style={{ marginTop: '0.5rem', width: '100%', minHeight: '30px', padding: '0.25rem', fontSize: '0.75rem', borderColor: 'black', color: 'black' }}
            >
              Exit Support Mode
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {/* Dashboard Tab for normal store users */}
          {role !== 'Admin' && (
            <button
              onClick={() => setCurrentTab('dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '0.75rem 1rem',
                border: 'none',
                background: currentTab === 'dashboard' ? 'var(--primary-light)' : 'transparent',
                color: currentTab === 'dashboard' ? 'var(--primary)' : 'var(--text-primary)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: 600
              }}
            >
              <span>🏠</span> Dashboard
            </button>
          )}

          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '0.75rem 1rem',
                border: 'none',
                background: currentTab === item.id ? 'var(--primary-light)' : 'transparent',
                color: currentTab === item.id ? 'var(--primary)' : 'var(--text-primary)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: 600
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>{item.icon}</span> {item.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '0.9rem'
          }}>
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser.name}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{currentUser.role}</p>
          </div>
        </div>
        
        <button className="btn btn-outline" onClick={handleLogout} style={{ width: '100%', minHeight: '40px', padding: '0.5rem' }}>
          🔌 Sign Out
        </button>
      </div>
    </aside>
  );
}
