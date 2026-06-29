import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function Auth() {
  const { handleLogin, isOnline } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return alert('Fill in all fields');

    setLoading(true);
    try {
      await handleLogin(email, password);
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
        <div style={{ textAlign: 'center', marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <img src="/icon.jpg" alt="ShopRecords Logo" style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-md)', objectFit: 'cover', boxShadow: 'var(--shadow-md)' }} />
          <h1 style={{ fontSize: '1.75rem', marginTop: '0.25rem', fontFamily: 'var(--font-display)' }}>ShopRecords</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            POS Terminal & Shop Management
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
          <div className="form-group">
            <label className="form-label">User ID / Email</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. owner1 or admin"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type={showPassword ? "text" : "password"}
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', marginTop: '0.35rem', cursor: 'pointer', userSelect: 'none', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                style={{ width: '15px', height: '15px', cursor: 'pointer' }}
              />
              Show Password
            </label>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Logging you in...' : 'Access POS Terminal'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
          Account credentials must be provisioned by the Administrator.
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
