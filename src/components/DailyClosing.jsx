import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export default function DailyClosing() {
  const { sales, expenses, dailyClosings, saveDailyClosing, customers } = useApp();
  const [closingDate, setClosingDate] = useState(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD IST
  });

  const [openingCash, setOpeningCash] = useState('');
  const [physicalCash, setPhysicalCash] = useState('');
  const [calculatedCash, setCalculatedCash] = useState(0);
  const [difference, setDifference] = useState(0);

  // Dynamic calculations metrics
  const [cashSales, setCashSales] = useState(0);
  const [udharReceived, setUdharReceived] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);

  // Fetch customer payments on selected date
  const loadStatsForDate = async () => {
    try {
      // 1. Cash Sales (including Cash components of Split payments)
      const daySales = sales.filter(s => s.created_at.startsWith(closingDate) && s.status === 'Completed');
      const sumSales = daySales.reduce((acc, curr) => {
        if (curr.payment_method === 'Cash') {
          return acc + parseFloat(curr.total_amount || 0);
        } else if (curr.payment_method === 'Split' && curr.payment_details) {
          const splitCashComponent = parseFloat(curr.payment_details.Cash || curr.payment_details.cash || 0);
          return acc + splitCashComponent;
        }
        return acc;
      }, 0);
      setCashSales(sumSales);

      // 2. Expenses (Only count Cash expenses for Cash closing reconciliation)
      const dayExpenses = expenses.filter(e => e.expense_date === closingDate && (e.payment_method === 'Cash' || !e.payment_method));
      const sumExpenses = dayExpenses.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
      setExpenseTotal(sumExpenses);

      // 3. Udhar Payments received
      // In context, customer transactions have type = 'Payment' and created_at date
      // Let's load customer transactions from IndexedDB
      const { dbOps, STORES } = await import('../db/db');
      const txs = await dbOps.getAll(STORES.CUSTOMER_TRANSACTIONS);
      const dayPayments = txs.filter(t => t.created_at.startsWith(closingDate) && t.type === 'Payment');
      const sumPayments = dayPayments.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
      setUdharReceived(sumPayments);

    } catch (e) {
      console.error('Error compiling daily closing stats:', e);
    }
  };

  useEffect(() => {
    loadStatsForDate();
  }, [closingDate, sales, expenses]);

  // Recalculate difference whenever cash fields or cash components changes
  useEffect(() => {
    const open = parseFloat(openingCash) || 0;
    const calc = open + cashSales + udharReceived - expenseTotal;
    setCalculatedCash(calc);

    const physical = parseFloat(physicalCash) || 0;
    setDifference(physical - calc);
  }, [openingCash, physicalCash, cashSales, udharReceived, expenseTotal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (openingCash === '' || physicalCash === '') {
      return alert('Opening cash and Physical closing cash details are required.');
    }

    // Check if record already exists for date
    const exists = dailyClosings.find(c => c.closing_date === closingDate);
    if (exists) {
      if (!window.confirm(`A closing record already exists for ${closingDate}. Overwrite?`)) return;
    }

    await saveDailyClosing({
      closing_date: closingDate,
      opening_cash: parseFloat(openingCash),
      physical_cash: parseFloat(physicalCash),
      calculated_cash: calculatedCash,
      difference,
      cash_sales: cashSales,
      udhar_payments_received: udharReceived,
      expenses: expenseTotal
    });

    alert('Daily Cash Register closed and saved successfully!');
    setPhysicalCash('');
  };

  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(val);
  };

  return (
    <div className="flex-column-gap" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      
      <div>
        <h1 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)' }}>Daily Closing Cash Register</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Reconcile physical cash drawer amounts with cash sales, credit payments, and expenses.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Verification Form */}
        <form onSubmit={handleSubmit} className="card flex-column-gap">
          <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Close Register Shift</h3>

          <div className="form-group">
            <label className="form-label">Closing Date (IST)</label>
            <input
              type="date"
              className="input"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Opening Cash Balance (₹)</label>
            <input
              type="number"
              step="0.01"
              className="input"
              placeholder="e.g. 2000"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Physical Cash in Drawer (₹)</label>
            <input
              type="number"
              step="0.01"
              className="input"
              placeholder="e.g. 5450"
              value={physicalCash}
              onChange={(e) => setPhysicalCash(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
            🏦 Lock & Save Closing
          </button>
        </form>

        {/* Live Calculation Sheet */}
        <div className="card flex-column-gap" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>System Calculations</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="flex-row-between">
              <span className="text-secondary-label">Opening Cash:</span>
              <span style={{ fontWeight: 600 }}>{formatINR(parseFloat(openingCash) || 0)}</span>
            </div>
            
            <div className="flex-row-between">
              <span className="text-secondary-label">➕ Cash Sales:</span>
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>+{formatINR(cashSales)}</span>
            </div>

            <div className="flex-row-between">
              <span className="text-secondary-label">➕ Udhar Recv Today:</span>
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>+{formatINR(udharReceived)}</span>
            </div>

            <div className="flex-row-between">
              <span className="text-secondary-label">➖ Expenses Logged:</span>
              <span style={{ color: 'var(--accent-error)', fontWeight: 600 }}>-{formatINR(expenseTotal)}</span>
            </div>

            <hr style={{ borderColor: 'var(--border-color)' }} />

            <div className="flex-row-between" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
              <span>Calculated Closing Cash:</span>
              <span>{formatINR(calculatedCash)}</span>
            </div>

            <div className="flex-row-between" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
              <span>Actual Physical Cash:</span>
              <span>{formatINR(parseFloat(physicalCash) || 0)}</span>
            </div>

            <div className="flex-row-between" style={{ 
              fontSize: '1.15rem', 
              fontWeight: 800, 
              padding: '0.75rem', 
              borderRadius: 'var(--radius-sm)',
              backgroundColor: difference === 0 ? 'var(--primary-light)' : difference > 0 ? 'var(--primary-light)' : 'var(--accent-error-light)',
              color: difference === 0 ? 'var(--primary)' : difference > 0 ? 'var(--primary)' : 'var(--accent-error)'
            }}>
              <span>Discrepancy (Diff):</span>
              <span>{difference >= 0 ? '+' : ''}{formatINR(difference)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* History Log list */}
      <div className="card flex-column-gap">
        <h3 style={{ fontSize: '1.15rem' }}>Past Closing Entries</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Closing Date</th>
                <th>Opening Cash</th>
                <th>Sales (Cash)</th>
                <th>Udhar Received</th>
                <th>Expenses</th>
                <th>Physical Closed</th>
                <th>Difference</th>
                <th>Verified By</th>
              </tr>
            </thead>
            <tbody>
              {dailyClosings.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>No closing shifts locked.</td>
                </tr>
              ) : (
                dailyClosings.sort((a,b) => new Date(b.closing_date) - new Date(a.closing_date)).map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{new Date(c.closing_date).toLocaleDateString('en-IN')}</td>
                    <td>₹{parseFloat(c.opening_cash).toFixed(2)}</td>
                    <td>₹{parseFloat(c.cash_sales).toFixed(2)}</td>
                    <td>₹{parseFloat(c.udhar_payments_received).toFixed(2)}</td>
                    <td>₹{parseFloat(c.expenses).toFixed(2)}</td>
                    <td style={{ fontWeight: 700 }}>₹{parseFloat(c.physical_cash).toFixed(2)}</td>
                    <td style={{ fontWeight: 700, color: parseFloat(c.difference) >= 0 ? 'var(--primary)' : 'var(--accent-error)' }}>
                      ₹{parseFloat(c.difference).toFixed(2)}
                    </td>
                    <td>{c.performed_by_name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
