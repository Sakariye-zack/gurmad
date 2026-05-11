import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Wallet, Fuel, Users, Wrench, Plus, ArrowDown, ArrowUp, XCircle, Save, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';

const categoryMap = {
  'Fuel': { icon: Fuel, color: '#f59e0b' },
  'Salaries': { icon: Users, color: '#3b82f6' },
  'Maintenance': { icon: Wrench, color: '#ef4444' },
  'Other': { icon: Wallet, color: '#8b5cf6' },
};

const BUDGET_MONTHLY = 5000;

const ExpenseView = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  
  // Form state
  const [newExpense, setNewExpense] = useState({
    category: 'Fuel',
    description: '',
    amount: '',
    reference_no: '',
    imageFile: null,
    imagePreview: null
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = () => {
    api.getExpenses().then(data => {
      const mapped = data.map(exp => ({
        ...exp,
        icon: categoryMap[exp.category]?.icon || Wallet,
        color: categoryMap[exp.category]?.color || '#8b5cf6',
        date: new Date(exp.expense_date).toLocaleDateString()
      }));
      setExpenses(mapped);
      setLoading(false);
    });
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.amount || !newExpense.description) {
      toast.error('Please provide description and amount');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('category', newExpense.category);
      formData.append('description', newExpense.description);
      formData.append('amount', parseFloat(newExpense.amount));
      formData.append('reference_no', newExpense.reference_no);
      if (newExpense.imageFile) {
        formData.append('invoice_image', newExpense.imageFile);
      }

      const resp = await fetch('http://localhost:5000/api/expenses', {
        method: 'POST',
        body: formData
      });

      if (!resp.ok) throw new Error('Failed to add expense');
      
      toast.success('Expense recorded successfully!');
      setShowAddModal(false);
      setNewExpense({ category: 'Fuel', description: '', amount: '', reference_no: '', imageFile: null, imagePreview: null });
      fetchExpenses();
    } catch (err) {
      toast.error('Error saving expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewExpense({
        ...newExpense,
        imageFile: file,
        imagePreview: URL.createObjectURL(file)
      });
    }
  };

  // Calculations
  const totalSpent = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
  const budgetConsumed = Math.min((totalSpent / BUDGET_MONTHLY) * 100, 100).toFixed(1);
  const remainingBudget = Math.max(BUDGET_MONTHLY - totalSpent, 0);

  // Group by Category
  const categoryTotals = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + parseFloat(exp.amount);
    return acc;
  }, {});

  const dynamicCategories = Object.keys(categoryMap).map(cat => {
    const amount = categoryTotals[cat] || 0;
    const percent = totalSpent > 0 ? ((amount / totalSpent) * 100).toFixed(1) : 0;
    return {
      label: cat,
      amount: `$${amount.toLocaleString()}`,
      percent: percent,
      color: categoryMap[cat].color
    };
  }).sort((a, b) => parseFloat(b.percent) - parseFloat(a.percent));

  if (loading) return <div className="card glass">Loading expenses...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Expense Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, var(--gurmad-green), var(--gurmad-green-dark))', color: 'white' }}>
          <p style={{ opacity: 0.9, fontSize: '0.9rem', marginBottom: '4px' }}>Monthly Budget Remaining</p>
          <h2 style={{ fontSize: '2rem', fontWeight: 700 }}>${remainingBudget.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          <div style={{ marginTop: '1rem', height: '4px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '2px' }}>
             <div style={{ width: `${budgetConsumed}%`, height: '100%', backgroundColor: 'white', borderRadius: '2px' }}></div>
          </div>
          <p style={{ fontSize: '0.8rem', marginTop: '8px', opacity: 0.8 }}>{budgetConsumed}% of $5,000 budget consumed</p>
        </div>
        
        <div className="card" style={{ borderLeft: '4px solid var(--gurmad-orange)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total Spent (All Time)</p>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: '4px 0' }}>${totalSpent.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowUp size={14} /> Live Tracking
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        {/* List */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: 700 }}>Expense History</h3>
            <button onClick={() => setShowAddModal(true)} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={16} /> Add Expense
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {expenses.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No expenses recorded yet.</div>
            ) : expenses.map((exp) => (
              <div 
                key={exp.id} 
                onClick={() => setSelectedExpense(exp)}
                style={{ 
                  padding: '1.25rem 1.5rem', 
                  borderBottom: '1px solid var(--border-color)', 
                  display: 'flex', 
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '10px', 
                    backgroundColor: `${exp.color}15`, 
                    color: exp.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <exp.icon size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{exp.description}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{exp.category} • {exp.date}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: '#ef4444' }}>-${parseFloat(exp.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Categories breakdown */}
        <div className="card" style={{ height: 'fit-content' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '1.5rem' }}>By Category</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {dynamicCategories.map((cat, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{cat.label}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{cat.amount}</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${cat.percent}%`, height: '100%', backgroundColor: cat.color, borderRadius: '3px', transition: 'width 1s ease' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Expense Details Modal */}
      {selectedExpense && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, 
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
        }}>
          <div className="card glass" style={{ width: '450px', padding: '2rem', position: 'relative', borderTop: `4px solid ${selectedExpense.color}` }}>
            <button 
              onClick={() => setSelectedExpense(null)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <XCircle size={24} />
            </button>
            
            <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText color={selectedExpense.color} />
              Expense Details
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 2fr', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                 <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Expense ID</div>
                 <div style={{ fontWeight: 700 }}>#{selectedExpense.id}</div>
               </div>
               <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 2fr', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                 <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Category</div>
                 <div style={{ fontWeight: 600 }}>{selectedExpense.category}</div>
               </div>
               <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 2fr', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                 <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Description</div>
                 <div style={{ fontWeight: 600 }}>{selectedExpense.description}</div>
               </div>
               <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 2fr', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                 <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Amount</div>
                 <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#ef4444' }}>
                   -${parseFloat(selectedExpense.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                 </div>
               </div>
               <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 2fr', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                 <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Ref / Invoice No.</div>
                 <div style={{ fontWeight: 600 }}>{selectedExpense.reference_no || 'N/A'}</div>
               </div>
               <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 2fr' }}>
                 <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Date Logged</div>
                 <div>{new Date(selectedExpense.created_at).toLocaleString()}</div>
               </div>
               
               {selectedExpense.invoice_image && (
                 <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                   <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>Attached Invoice / Receipt</div>
                   <img 
                     src={`http://localhost:5000/uploads/${selectedExpense.invoice_image}`} 
                     alt="Invoice receipt" 
                     style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }} 
                   />
                 </div>
               )}
            </div>
            
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddModal && (
        <div style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
          }}>
            <div className="card glass" style={{ width: '400px', padding: '2rem', position: 'relative', borderTop: '4px solid var(--gurmad-orange)' }}>
              <button 
                onClick={() => setShowAddModal(false)}
                style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <XCircle size={24} />
              </button>
              
              <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet color="var(--gurmad-orange)" />
                Record New Expense
              </h3>
  
              <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Category</label>
                  <select 
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none' }}
                  >
                    {Object.keys(categoryMap).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Description</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Fuel for Truck 03"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Ref / Invoice No (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. INV-1094 / Receipt Number"
                    value={newExpense.reference_no}
                    onChange={(e) => setNewExpense({...newExpense, reference_no: e.target.value})}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Amount (USD)</label>
                  <input 
                    type="number" 
                    placeholder="150"
                    step="0.01"
                    min="0"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Invoice Image (Optional)</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                  />
                  {newExpense.imagePreview && (
                    <img 
                      src={newExpense.imagePreview} 
                      alt="Preview" 
                      style={{ marginTop: '10px', width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color)' }} 
                    />
                  )}
                </div>
  
                <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                  <Save size={18} />
                  {isSubmitting ? 'Saving...' : 'Save Expense'}
                </button>
              </form>
            </div>
        </div>
      )}

    </div>
  );
};

export default ExpenseView;
