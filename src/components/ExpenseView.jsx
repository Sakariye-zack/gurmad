import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Wallet, Fuel, Users, Wrench, Plus, ArrowDown, ArrowUp, XCircle, Save, FileText, Edit3, Trash2, CheckCircle2, Clock, Download, Settings, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const categoryMap = {
  'Fuel': { icon: Fuel, color: '#f59e0b' },
  'Salaries': { icon: Users, color: '#3b82f6' },
  'Maintenance': { icon: Wrench, color: '#ef4444' },
  'Other': { icon: Wallet, color: '#8b5cf6' },
};

const ExpenseView = ({ currentUser }) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetForm, setBudgetForm] = useState({});
  const [isSavingBudgets, setIsSavingBudgets] = useState(false);

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

  const fetchBudgets = () => {
    api.getBudgetStatus().then(setBudgets).catch(() => {});
  };

  useEffect(() => { fetchBudgets(); }, []);

  const openBudgetModal = () => {
    const form = {};
    Object.keys(categoryMap).forEach(cat => {
      const existing = budgets.find(b => b.category === cat);
      form[cat] = existing ? existing.monthly_limit : '';
    });
    setBudgetForm(form);
    setShowBudgetModal(true);
  };

  const handleSaveBudgets = async (e) => {
    e.preventDefault();
    setIsSavingBudgets(true);
    try {
      await Promise.all(Object.entries(budgetForm).map(([category, limit]) => api.setBudget(category, parseFloat(limit) || 0)));
      toast.success('Budgets updated');
      setShowBudgetModal(false);
      fetchBudgets();
    } catch (err) {
      toast.error('Failed to save budgets');
    } finally {
      setIsSavingBudgets(false);
    }
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

      if (isEditMode && editingId) {
        await api.updateExpense(editingId, formData);
        toast.success('Expense updated successfully!');
      } else {
        await api.addExpense(formData);
        toast.success('Expense recorded successfully!');
      }
      setShowAddModal(false);
      setIsEditMode(false);
      setEditingId(null);
      setNewExpense({ category: 'Fuel', description: '', amount: '', reference_no: '', imageFile: null, imagePreview: null });
      fetchExpenses();
    } catch (err) {
      toast.error(err.message || 'Error saving expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (exp) => {
    setIsEditMode(true);
    setEditingId(exp.id);
    setNewExpense({
      category: exp.category, description: exp.description, amount: exp.amount,
      reference_no: exp.reference_no || '', imageFile: null, imagePreview: null
    });
    setShowAddModal(true);
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setNewExpense({ category: 'Fuel', description: '', amount: '', reference_no: '', imageFile: null, imagePreview: null });
    setShowAddModal(true);
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Delete this expense record? This cannot be undone.')) return;
    try {
      await api.deleteExpense(id);
      toast.success('Expense deleted');
      setSelectedExpense(null);
      fetchExpenses();
    } catch (err) {
      toast.error(err.message || 'Failed to delete expense');
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await api.updateExpenseStatus(id, status);
      toast.success(`Marked as ${status}`);
      fetchExpenses();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Category,Description,Reference,Amount,Status\n";
    expenses.forEach(exp => {
      csvContent += `${exp.date},${exp.category},"${(exp.description || '').replace(/"/g, '""')}",${exp.reference_no || ''},${exp.amount},${exp.status || 'Approved'}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `gurmad_expenses_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
  const totalBudgetLimit = budgets.reduce((sum, b) => sum + parseFloat(b.monthly_limit || 0), 0);
  const totalBudgetUsed = budgets.reduce((sum, b) => sum + parseFloat(b.used || 0), 0);
  const budgetConsumed = totalBudgetLimit > 0 ? Math.min((totalBudgetUsed / totalBudgetLimit) * 100, 100).toFixed(1) : 0;
  const remainingBudget = Math.max(totalBudgetLimit - totalBudgetUsed, 0);

  // Group by Category
  const categoryTotals = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + parseFloat(exp.amount);
    return acc;
  }, {});

  const dynamicCategories = Object.keys(categoryMap).map(cat => {
    const amount = categoryTotals[cat] || 0;
    const percent = totalSpent > 0 ? ((amount / totalSpent) * 100).toFixed(1) : 0;
    const budget = budgets.find(b => b.category === cat);
    const limit = budget ? parseFloat(budget.monthly_limit) : 0;
    const budgetPercent = limit > 0 ? Math.min((parseFloat(budget.used || 0) / limit) * 100, 100) : null;
    return {
      label: cat,
      amount: `$${amount.toLocaleString()}`,
      percent: percent,
      color: categoryMap[cat].color,
      limit,
      budgetPercent
    };
  }).sort((a, b) => parseFloat(b.percent) - parseFloat(a.percent));

  if (loading) return <div className="card glass">Loading expenses...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Expense Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, var(--gurmad-green), var(--gurmad-green-dark))', color: 'white', position: 'relative' }}>
          {currentUser?.role === 'admin' && (
            <button onClick={openBudgetModal} title="Manage Budgets" style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'white', display: 'flex' }}>
              <Settings size={16} />
            </button>
          )}
          <p style={{ opacity: 0.9, fontSize: '0.9rem', marginBottom: '4px' }}>Monthly Budget Remaining</p>
          {totalBudgetLimit > 0 ? (
            <>
              <h2 style={{ fontSize: '2rem', fontWeight: 700 }}>${remainingBudget.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
              <div style={{ marginTop: '1rem', height: '4px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '2px' }}>
                 <div style={{ width: `${budgetConsumed}%`, height: '100%', backgroundColor: 'white', borderRadius: '2px' }}></div>
              </div>
              <p style={{ fontSize: '0.8rem', marginTop: '8px', opacity: 0.8 }}>{budgetConsumed}% of ${totalBudgetLimit.toLocaleString()} budget consumed</p>
            </>
          ) : (
            <p style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '8px' }}>No budgets set yet. {currentUser?.role === 'admin' ? 'Click the gear icon to set one.' : 'Ask an admin to set one.'}</p>
          )}
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--gurmad-orange)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total Spent (All Time)</p>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: '4px 0' }}>${totalSpent.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowUp size={14} /> Live Tracking
          </div>
        </div>
      </div>

      {budgets.some(b => parseFloat(b.monthly_limit) > 0 && parseFloat(b.used || 0) / parseFloat(b.monthly_limit) >= 0.9) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '1rem', borderRadius: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
          <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.85rem', color: '#991b1b' }}>
            <strong>Budget alert:</strong> {budgets.filter(b => parseFloat(b.monthly_limit) > 0 && parseFloat(b.used || 0) / parseFloat(b.monthly_limit) >= 0.9).map(b => b.category).join(', ')} {budgets.filter(b => parseFloat(b.monthly_limit) > 0 && parseFloat(b.used || 0) / parseFloat(b.monthly_limit) >= 0.9).length > 1 ? 'are' : 'is'} at 90%+ of this month's budget.
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        {/* List */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ fontWeight: 700 }}>Expense History</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleExportCSV} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Download size={16} /> Export CSV
              </button>
              <button onClick={openAddModal} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={16} /> Add Expense
              </button>
            </div>
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
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {exp.description}
                      {exp.status === 'Pending' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 8px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: 800, backgroundColor: '#fffbeb', color: '#b45309' }}>
                          <Clock size={10} /> PENDING
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{exp.category} • {exp.date}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ fontWeight: 700, color: '#ef4444' }}>-${parseFloat(exp.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                  <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                    {exp.status === 'Pending' && (
                      <button onClick={() => handleStatusUpdate(exp.id, 'Approved')} title="Approve" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: '#15803d', display: 'flex' }}>
                        <CheckCircle2 size={14} />
                      </button>
                    )}
                    <button onClick={() => openEditModal(exp)} title="Edit" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: '#1d4ed8', display: 'flex' }}>
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => handleDeleteExpense(exp.id)} title="Delete" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: '#dc2626', display: 'flex' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
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
                {cat.limit > 0 && (
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ flex: 1, height: '4px', backgroundColor: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${cat.budgetPercent}%`, height: '100%', backgroundColor: cat.budgetPercent >= 90 ? '#ef4444' : cat.budgetPercent >= 70 ? '#f59e0b' : '#10b981', borderRadius: '2px' }}></div>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>${cat.limit.toLocaleString()} budget</span>
                  </div>
                )}
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
                     src={`/api/uploads/${selectedExpense.invoice_image}`} 
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
                onClick={() => { setShowAddModal(false); setIsEditMode(false); setEditingId(null); }}
                style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <XCircle size={24} />
              </button>

              <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet color="var(--gurmad-orange)" />
                {isEditMode ? 'Edit Expense' : 'Record New Expense'}
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
                  {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Expense' : 'Save Expense')}
                </button>
              </form>
            </div>
        </div>
      )}

      {showBudgetModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card glass" style={{ width: '380px', padding: '2rem', position: 'relative', borderTop: '4px solid var(--gurmad-green)' }}>
            <button onClick={() => setShowBudgetModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <XCircle size={24} />
            </button>
            <h3 style={{ fontWeight: 700, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings color="var(--gurmad-green)" size={20} /> Manage Budgets
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.3rem' }}>Set a monthly limit per category. Leave blank / $0 for no limit.</p>
            <form onSubmit={handleSaveBudgets} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {Object.keys(categoryMap).map(cat => (
                <div key={cat}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>{cat}</label>
                  <input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={budgetForm[cat] ?? ''}
                    onChange={e => setBudgetForm({ ...budgetForm, [cat]: e.target.value })}
                    style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <button type="submit" disabled={isSavingBudgets} className="btn-primary" style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <Save size={18} /> {isSavingBudgets ? 'Saving...' : 'Save Budgets'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ExpenseView;
