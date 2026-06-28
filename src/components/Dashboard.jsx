import React from 'react';
import { useApp } from '../context/AppContext';

export default function Dashboard({ setCurrentTab }) {
  const { 
    products, 
    customers, 
    sales, 
    expenses, 
    currentShop, 
    currentUser, 
    isOnline,
    syncState
  } = useApp();

  // Get Indian Standard Time Date string (YYYY-MM-DD)
  const getISTDateString = (dateObj = new Date()) => {
    return dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  };

  const getLocalDateString = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    } catch (e) {
      return isoString.slice(0, 10);
    }
  };

  const todayStr = getISTDateString();

  // 1. Daily Sales Metrics
  const todaySales = sales.filter(s => getLocalDateString(s.created_at) === todayStr && s.status === 'Completed');
  const todaySalesCount = todaySales.length;
  const todaySalesTotal = todaySales.reduce((acc, curr) => acc + parseFloat(curr.total_amount), 0);

  const salesByMethod = todaySales.reduce((acc, curr) => {
    acc[curr.payment_method] = (acc[curr.payment_method] || 0) + parseFloat(curr.total_amount);
    return acc;
  }, { Cash: 0, UPI: 0, Card: 0, Udhar: 0 });

  // 2. Outstanding Udhar (Balance receivable)
  const totalUdharReceivable = customers.reduce((acc, curr) => acc + parseFloat(curr.outstanding_balance || 0), 0);

  // 3. Low Stock Check
  const lowStockItems = products.filter(p => !p.is_unlisted && parseFloat(p.current_stock) <= parseFloat(p.low_stock_threshold));

  // 4. Expenses Today
  const todayExpensesTotal = expenses
    .filter(e => e.expense_date === todayStr)
    .reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

  // Format money inside Indian format
  const formatINR = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="flex-column-gap" style={{ animation: 'fadeIn 0.4s ease-out' }}>
      {/* Header bar */}
      <div className="flex-row-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)' }}>
            Welcome, {currentUser?.name}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Store: <strong>{currentShop?.name}</strong> • Role: <strong>{currentUser?.role}</strong>
          </p>
        </div>

        {/* Sync and Connection Badge */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span className={`badge ${isOnline ? 'badge-success' : 'badge-warning'}`}>
            {isOnline ? '🌐 Online' : '🔌 Offline'}
          </span>
          <span className="text-secondary-label" style={{ fontSize: '0.75rem' }}>
            {syncState.message}
          </span>
        </div>
      </div>

      {/* Subscription Warnings */}
      {currentShop && (
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Plan Status</span>
            <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              Subscription Plan: <span style={{ color: 'var(--primary)' }}>{currentShop.plan}</span>
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Expiry Date</span>
            <p style={{ fontWeight: 700, fontSize: '0.95rem', color: new Date(currentShop.expiry_date) < new Date() ? 'var(--accent-error)' : 'var(--text-primary)' }}>
              {new Date(currentShop.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
      )}

      {/* Low Stock Warning Banner */}
      {lowStockItems.length > 0 && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--accent-error)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          animation: 'pulseGlow 2s infinite'
        }}>
          <div>
            <h4 style={{ color: 'var(--accent-error)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ⚠️ Low Stock Alert
            </h4>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              There are <strong>{lowStockItems.length}</strong> products running below their threshold stock level.
            </p>
          </div>
          <button 
            className="btn btn-danger" 
            onClick={() => setCurrentTab('inventory')}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', minHeight: '32px', height: '32px' }}
          >
            Manage Inventory
          </button>
        </div>
      )}

      {/* Main KPI Stats Grid */}
      <div className="stats-grid">
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-icon" style={{ backgroundColor: 'var(--primary)' }}>💰</div>
          <div>
            <span className="text-secondary-label">Sales Today</span>
            <h3 style={{ fontSize: '1.35rem' }}>{formatINR(todaySalesTotal)}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{todaySalesCount} Invoices</span>
          </div>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid var(--accent-warning)' }}>
          <div className="stat-icon" style={{ backgroundColor: 'var(--accent-warning)' }}>👥</div>
          <div>
            <span className="text-secondary-label">Total Udhar</span>
            <h3 style={{ fontSize: '1.35rem' }}>{formatINR(totalUdharReceivable)}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Receivable Balance</span>
          </div>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid var(--accent-error)' }}>
          <div className="stat-icon" style={{ backgroundColor: 'var(--accent-error)' }}>💸</div>
          <div>
            <span className="text-secondary-label">Expenses Today</span>
            <h3 style={{ fontSize: '1.35rem' }}>{formatINR(todayExpensesTotal)}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Daily Expenditures</span>
          </div>
        </div>

        <div className="card stat-card" style={{ borderLeft: `4px solid ${lowStockItems.length > 0 ? 'var(--accent-error)' : 'var(--primary)'}` }}>
          <div className="stat-icon" style={{ backgroundColor: lowStockItems.length > 0 ? 'var(--accent-error)' : 'var(--primary)' }}>📦</div>
          <div>
            <span className="text-secondary-label">Low Stock</span>
            <h3 style={{ fontSize: '1.35rem' }}>{lowStockItems.length}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Items below limit</span>
          </div>
        </div>
      </div>

      <div className="responsive-grid-2">
        {/* Sales by Mode Breakdown */}
        <div className="card flex-column-gap" style={{ justifyContent: 'center' }}>
          <h3 style={{ fontSize: '1.1rem' }}>Today's Sales Breakdown</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
            <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <span className="text-secondary-label">💵 Cash Sales</span>
              <h4 style={{ fontSize: '1.15rem', marginTop: '0.25rem' }}>{formatINR(salesByMethod.Cash)}</h4>
            </div>
            <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <span className="text-secondary-label">📱 UPI Payments</span>
              <h4 style={{ fontSize: '1.15rem', marginTop: '0.25rem' }}>{formatINR(salesByMethod.UPI)}</h4>
            </div>
            <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <span className="text-secondary-label">💳 Card Sales</span>
              <h4 style={{ fontSize: '1.15rem', marginTop: '0.25rem' }}>{formatINR(salesByMethod.Card)}</h4>
            </div>
            <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <span className="text-secondary-label">🤝 Udhar Sales</span>
              <h4 style={{ fontSize: '1.15rem', marginTop: '0.25rem' }}>{formatINR(salesByMethod.Udhar)}</h4>
            </div>
          </div>
        </div>

        {/* Quick actions Panel */}
        <div className="card flex-column-gap">
          <h3 style={{ fontSize: '1.1rem' }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => setCurrentTab('pos')} style={{ width: '100%' }}>
              🛒 Start New Bill
            </button>
            <button className="btn btn-secondary" onClick={() => setCurrentTab('inventory')} style={{ width: '100%' }}>
              📦 Manage Stock
            </button>
            {currentUser?.role === 'Owner' && (
              <button className="btn btn-outline" onClick={() => setCurrentTab('closing')} style={{ width: '100%' }}>
                🏦 Daily Cash Register
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Low Stock Checklist Drawer */}
      {lowStockItems.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--accent-error-light)' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-error)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            ⚠️ Low Stock Alert Checklist
          </h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Barcode</th>
                  <th>Threshold</th>
                  <th>Current Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td>{item.barcode || '—'}</td>
                    <td>{parseFloat(item.low_stock_threshold)}</td>
                    <td style={{ color: 'var(--accent-error)', fontWeight: 700 }}>
                      {parseFloat(item.current_stock)}
                    </td>
                    <td>
                      <button 
                        className="btn btn-outline" 
                        onClick={() => setCurrentTab('inventory')}
                        style={{ minHeight: '32px', height: '32px', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        Restock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
