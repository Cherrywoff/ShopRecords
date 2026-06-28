import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function Auth() {
  const { handleLogin, handleSignUp, isOnline } = useApp();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return alert('Fill in all fields');
    if (isSignUp && !name) return alert('Name is required');
    if (isSignUp && !isAdmin && !shopName) return alert('Shop Name is required');

    setLoading(true);
    try {
      if (isSignUp) {
        await handleSignUp(email, password, name, shopName, isAdmin);
      } else {
        await handleLogin(email, password);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: 'var(--bg-primary)',
      padding: '1.5rem'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '2rem', animation: 'fadeIn 0.5s ease-in-out' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '3rem' }}>📊</span>
          <h1 style={{ fontSize: '1.75rem', marginTop: '0.5rem', fontFamily: 'var(--font-display)' }}>ShopRecords</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Offline-First POS & Shop Manager
          </p>
        </div>

        {!isOnline && (
          <div style={{
            backgroundColor: 'var(--bg-tertiary)',
            borderLeft: '4px solid var(--accent-warning)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '1.5rem',
            fontSize: '0.8rem'
          }}>
            <strong>⚠️ Offline Mode Active:</strong> You can log in using credentials previously authenticated on this device.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-column-gap">
          {isSignUp && (
            <>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Ramesh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.25rem 0' }}>
                <input
                  type="checkbox"
                  id="isAdminCheck"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="isAdminCheck" className="form-label" style={{ marginBottom: 0 }}>
                  Register as System Administrator
                </label>
              </div>

              {!isAdmin && (
                <div className="form-group">
                  <label className="form-label">Shop Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Ramesh Kirana Store"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    required
                  />
                </div>
              )}
            </>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="input"
              placeholder="name@shop.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Please wait...' : isSignUp ? 'Create My Shop' : 'Access POS Terminal'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem'
            }}
          >
            {isSignUp ? 'Already have an account? Sign In' : 'New store? Create account'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
