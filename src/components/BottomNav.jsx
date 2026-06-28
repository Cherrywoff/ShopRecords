import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function BottomNav({ currentTab, setCurrentTab }) {
  const { currentUser, handleLogout, supportMode, stopSupportSession } = useApp();
  const [showMenu, setShowMenu] = useState(false);

  if (!currentUser) return null;

  const role = currentUser.role;

  const handleTabClick = (tabId) => {
    setCurrentTab(tabId);
    setShowMenu(false);
  };

  if (role === 'Admin') {
    return (
      <nav className="bottom-nav">
        <button onClick={() => handleTabClick('admin')} style={getTabStyle(currentTab === 'admin')}>
          🛡️ <span style={{ fontSize: '0.65rem' }}>Admin</span>
        </button>
        <button onClick={handleLogout} style={getTabStyle(false)}>
          🔌 <span style={{ fontSize: '0.65rem' }}>Sign Out</span>
        </button>
      </nav>
    );
  }

  return (
    <>
      <nav className="bottom-nav">
        <button onClick={() => handleTabClick('dashboard')} style={getTabStyle(currentTab === 'dashboard')}>
          🏠 <span style={{ fontSize: '0.65rem' }}>Home</span>
        </button>
        <button onClick={() => handleTabClick('pos')} style={getTabStyle(currentTab === 'pos')}>
          🛒 <span style={{ fontSize: '0.65rem' }}>Billing</span>
        </button>
        <button onClick={() => handleTabClick('inventory')} style={getTabStyle(currentTab === 'inventory')}>
          📦 <span style={{ fontSize: '0.65rem' }}>Stock</span>
        </button>
        
        {role === 'Owner' || role === 'Manager' ? (
          <button onClick={() => handleTabClick('udhar')} style={getTabStyle(currentTab === 'udhar')}>
            👥 <span style={{ fontSize: '0.65rem' }}>Udhar</span>
          </button>
        ) : (
          <button onClick={() => handleTabClick('sales')} style={getTabStyle(currentTab === 'sales')}>
            📜 <span style={{ fontSize: '0.65rem' }}>Sales</span>
          </button>
        )}

        <button onClick={() => setShowMenu(true)} style={getTabStyle(showMenu)}>
          ☰ <span style={{ fontSize: '0.65rem' }}>Menu</span>
        </button>
      </nav>

      {/* Mobile Drawer Menu Modal */}
      {showMenu && (
        <div className="modal-backdrop" onClick={() => setShowMenu(false)} style={{ alignItems: 'flex-end', padding: 0 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, animation: 'slideUp 0.3s ease-out' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem' }}>Store Menu Options</h3>
              <button onClick={() => setShowMenu(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1.5rem' }}>
              <button onClick={() => handleTabClick('sales')} style={getGridItemStyle()}>
                📜 <span style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Sales History</span>
              </button>
              
              {role === 'Owner' && (
                <>
                  <button onClick={() => handleTabClick('expenses')} style={getGridItemStyle()}>
                    💸 <span style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Expenses</span>
                  </button>
                  <button onClick={() => handleTabClick('suppliers')} style={getGridItemStyle()}>
                    🚚 <span style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Suppliers</span>
                  </button>
                  <button onClick={() => handleTabClick('closing')} style={getGridItemStyle()}>
                    🏦 <span style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Daily Closing</span>
                  </button>
                  <button onClick={() => handleTabClick('settings')} style={getGridItemStyle()}>
                    ⚙️ <span style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Settings</span>
                  </button>
                </>
              )}

              {supportMode.isActive && (
                <button onClick={() => { stopSupportSession(); setShowMenu(false); }} style={{ ...getGridItemStyle(), backgroundColor: 'var(--accent-warning)', color: 'black' }}>
                  ⚠️ <span style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Exit Support</span>
                </button>
              )}

              <button onClick={() => { handleLogout(); setShowMenu(false); }} style={{ ...getGridItemStyle(), color: 'var(--accent-error)' }}>
                🔌 <span style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

function getTabStyle(isActive) {
  return {
    background: 'none',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
    fontWeight: isActive ? '700' : '500',
    fontSize: '1.2rem',
    cursor: 'pointer',
    flexGrow: 1,
    height: '100%'
  };
}

function getGridItemStyle() {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontWeight: 600,
    aspectRatio: '1'
  };
}
