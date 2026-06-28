import React, { useState, useEffect } from 'react';
import { useApp } from './context/AppContext';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';

// Pages/Views
import Dashboard from './components/Dashboard';
import POS from './components/POS';
import Inventory from './components/Inventory';
import SalesHistory from './components/SalesHistory';
import Udhar from './components/Udhar';
import Expenses from './components/Expenses';
import Suppliers from './components/Suppliers';
import DailyClosing from './components/DailyClosing';
import Settings from './components/Settings';
import Reports from './components/Reports';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const { currentUser, loadingAuth, isSubscriptionActive, currentShop } = useApp();
  const [currentTab, setCurrentTab] = useState('dashboard');

  // Handle routing redirects on authentication role differences
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'Admin') {
        setCurrentTab('admin');
      } else {
        setCurrentTab('dashboard');
      }
    }
  }, [currentUser]);

  if (loadingAuth) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#090d16',
        color: '#fff',
        gap: '1rem',
        fontFamily: 'var(--font-sans)'
      }}>
        <div className="spinner" style={{
          width: '50px',
          height: '50px',
          border: '5px solid var(--bg-accent)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ fontWeight: 600, fontSize: '0.95rem', letterSpacing: '0.05em' }}>
          Initializing ShopRecords...
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Not logged in: Show auth gate
  if (!currentUser) {
    return <Auth />;
  }

  const isExpired = !isSubscriptionActive();

  return (
    <div className="app-wrapper">
      
      {/* 1. Desktop Sidebar */}
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* 2. Main content viewport */}
      <main className="main-content">
        
        {/* Subscription Expired Warning Banner */}
        {isExpired && (
          <div style={{
            backgroundColor: 'var(--accent-error-light)',
            borderLeft: '4px solid var(--accent-error)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <strong style={{ color: 'var(--accent-error)' }}>⚠️ Subscription Expired!</strong>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Your shop subscription expired on {currentShop ? new Date(currentShop.expiry_date).toLocaleDateString() : ''}. 
                New billing invoices, stock restocks, and profile modifications are locked.
              </p>
            </div>
            {currentUser.role === 'Owner' && (
              <button 
                className="btn btn-outline" 
                onClick={() => setCurrentTab('settings')}
                style={{ borderColor: 'var(--accent-error)', color: 'var(--accent-error)', minHeight: '36px', height: '36px', padding: '0 0.75rem' }}
              >
                Go to Backups Settings
              </button>
            )}
          </div>
        )}

        {/* View Router */}
        {currentTab === 'dashboard' && <Dashboard setCurrentTab={setCurrentTab} />}
        {currentTab === 'pos' && <POS />}
        {currentTab === 'inventory' && <Inventory />}
        {currentTab === 'sales' && <SalesHistory />}
        {currentTab === 'udhar' && <Udhar />}
        {currentTab === 'expenses' && <Expenses />}
        {currentTab === 'suppliers' && <Suppliers />}
        {currentTab === 'closing' && <DailyClosing />}
        {currentTab === 'settings' && <Settings />}
        {currentTab === 'reports' && <Reports />}
        {currentTab === 'admin' && <AdminDashboard />}
      </main>

      {/* 3. Mobile Bottom navigation */}
      <BottomNav currentTab={currentTab} setCurrentTab={setCurrentTab} />

    </div>
  );
}
