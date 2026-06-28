import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function Expenses() {
  const { expenses, saveExpense } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  
  // Form fields
  const [category, setCategory] = useState('Tea');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => {
    // Current local IST date YYYY-MM-DD
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  });

  const getISTMonthString = (dateObj = new Date()) => {
    return dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7); // YYYY-MM
  };

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const currentMonthStr = getISTMonthString();

  // Summary Metrics
  const todayTotal = expenses
    .filter(e => e.expense_date === todayStr)
    .reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

  const monthTotal = expenses
    .filter(e => e.expense_date.startsWith(currentMonthStr))
    .reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

  const totalAllTime = expenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

  // Filters apply
  const filteredExpenses = expenses
    .filter(e => categoryFilter ? e.category === categoryFilter : true)
    .sort((a,b) => new Date(b.expense_date) - new Date(a.expense_date));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return alert('Enter a valid amount.');

    await saveExpense({
      category,
      amount: amt,
      description,
      expense_date: expenseDate
    });

    setAmount('');
    setDescription('');
    setShowAddModal(false);
  };

  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(val);
  };

  return (
    <div className="flex-column-gap" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      
      <div className="flex-row-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)' }}>Store Expense Module</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Record operational expenses like rent, tea, salaries, utilities, and miscellaneous items.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          💸 Log Expense
        </button>
      </div>

      {/* KPI Cards Panel */}
      <div className="stats-grid">
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--accent-error)' }}>
          <div className="stat-icon" style={{ backgroundColor: 'var(--accent-error)' }}>📅</div>
          <div>
            <span className="text-secondary-label">Spent Today</span>
            <h3>{formatINR(todayTotal)}</h3>
          </div>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid var(--accent-warning)' }}>
          <div className="stat-icon" style={{ backgroundColor: 'var(--accent-warning)' }}>🗓️</div>
          <div>
            <span className="text-secondary-label">Spent This Month</span>
            <h3>{formatINR(monthTotal)}</h3>
          </div>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-icon" style={{ backgroundColor: 'var(--primary)' }}>♾️</div>
          <div>
            <span className="text-secondary-label">All-Time Expenses</span>
            <h3>{formatINR(totalAllTime)}</h3>
          </div>
        </div>
      </div>

      {/* Category filter */}
      <div className="card" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <span className="form-label" style={{ marginBottom: 0 }}>Category Filter:</span>
        <select 
          className="input" 
          style={{ width: '200px', minHeight: '36px', height: '36px', padding: '0 0.5rem' }}
          value={categoryFilter} 
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          <option value="Rent">Rent</option>
          <option value="Electricity">Electricity</option>
          <option value="Salary">Salary</option>
          <option value="Tea">Tea / Refreshments</option>
          <option value="Miscellaneous">Miscellaneous</option>
        </select>
      </div>

      {/* Expenses Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Amount (₹)</th>
              <th>Description</th>
              <th>Recorded By</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  No expense records logged.
                </td>
              </tr>
            ) : (
              filteredExpenses.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.expense_date).toLocaleDateString('en-IN')}</td>
                  <td>
                    <span className="badge badge-warning" style={{ backgroundColor: 'var(--bg-accent)', color: 'var(--text-primary)' }}>
                      {e.category}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--accent-error)' }}>₹{parseFloat(e.amount).toFixed(2)}</td>
                  <td>{e.description || '—'}</td>
                  <td>{e.performed_by_name}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>💸 Record Expense</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body flex-column-gap">
                <div className="form-group">
                  <label className="form-label">Expense Category</label>
                  <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="Tea">Tea & Snacks</option>
                    <option value="Electricity">Electricity Bill</option>
                    <option value="Rent">Shop Rent</option>
                    <option value="Salary">Staff Salary</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="e.g. 50"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Expense Date</label>
                  <input
                    type="date"
                    className="input"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Remarks / Description</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Tea for visitors"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
