import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, Search, CheckCircle2, AlertCircle, History, Calculator } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

const CashoutView = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState('process'); // 'process' or 'history'
  
  const [collectors, setCollectors] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [cashouts, setCashouts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedCollector, setSelectedCollector] = useState('');
  const [actualAmountStr, setActualAmountStr] = useState('');
  const [justification, setJustification] = useState('');
  
  // Settings for currency format
  const [settings, setSettings] = useState({});

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [uData, invData, cashoutsData, setRes] = await Promise.all([
        api.getUsers(),
        api.getInvoices(),
        api.getCashouts().catch(() => []), // fallback empty array if error
        fetch('/api/settings').then(res => res.json())
      ]);
      
      const collectorUsers = uData.filter(u => u.role === 'collector');
      setCollectors(collectorUsers);
      setCashouts(cashoutsData || []);
      
      // Filter invoices for today only
      const today = new Date().toISOString().split('T')[0];
      const todayInvoices = invData.filter(inv => inv.created_at.startsWith(today));
      
      // To properly "clear" them, ideally we'd filter out ones already cashed out.
      // But for simplicity, we just look at all of today's invoices.
      setInvoices(todayInvoices);
      
      setSettings(setRes || {});
    } catch (err) {
      toast.error('Failed to load data for cashout');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedStats = useMemo(() => {
    if (!selectedCollector) return null;
    
    const collectorInvs = invoices.filter(i => 
      i.collector_name && 
      i.collector_name.toLowerCase() === selectedCollector.toLowerCase()
    );
    
    let totalUsd = 0;
    
    collectorInvs.forEach(inv => {
      const cash = parseFloat(inv.cash_amount) || 0;
      const zaad = parseFloat(inv.zaad_amount) || 0;
      const edahab = parseFloat(inv.edahab_amount) || 0;
      const rate = parseFloat(settings.exchange_rate) || 8500;
      const slsh = parseFloat(inv.slsh_amount) || 0;
      
      const convertedSlsh = slsh / rate;
      totalUsd += (cash + zaad + edahab + convertedSlsh);
    });
    
    return {
      totalUsd,
      invoiceCount: collectorInvs.length
    };
  }, [selectedCollector, invoices, settings]);

  const handleCashout = async () => {
    if (!selectedCollector) return toast.error('Please select a collector');
    if (actualAmountStr === '') return toast.error('Please enter the actual amount received');

    const expected = selectedStats?.totalUsd || 0;
    const actual = parseFloat(actualAmountStr) || 0;
    const missing = expected - actual;

    if (missing > 0 && !justification.trim()) {
      return toast.error('Fadlan qor sababta / caddaynta lacagta dhiman (Reason for shortage is required)');
    }

    try {
      // 1. Create Cashout Record
      const newCashout = await api.addCashout({
        collector_name: selectedCollector,
        expected_amount: expected,
        actual_amount: actual,
        shortage: missing > 0 ? missing : 0,
        reason: justification,
        processed_by: currentUser?.full_name || 'Cashier'
      });

      // 2. Register Debt if there is a shortage
      if (missing > 0) {
        const collectorObj = collectors.find(c => c.full_name.toLowerCase() === selectedCollector.toLowerCase() || c.username.toLowerCase() === selectedCollector.toLowerCase());
        
        const debtData = {
          customer_id: null,
          debtor_name: selectedCollector,
          phone: collectorObj?.phone || '',
          amount: missing,
          currency: 'USD',
          description: `Cashout Shortage - Reason: ${justification}`,
          collector_name: currentUser?.full_name || 'Cashier',
          zone: 'Office Cashout',
          house_no: '-'
        };
        
        await api.addDebt(debtData);
        toast.success('Deyntii (Shortage) waa la diiwaangeliyay!');
      } else {
        toast.success('Cashout is successfully processed! (No shortage)');
      }
      
      // Update local history state
      setCashouts([newCashout, ...cashouts]);
      
      // Reset form
      setActualAmountStr('');
      setJustification('');
      setSelectedCollector('');
      
    } catch (err) {
      console.error(err);
      toast.error('Failed to process cashout');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', backgroundColor: 'var(--gurmad-green-light)', borderRadius: '12px', color: 'var(--gurmad-green)' }}>
          <Wallet size={24} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Collector Cashout</h1>
          <p style={{ color: '#64748b', margin: 0 }}>Reconcile collections and view history</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('process')}
          style={{
            padding: '0.5rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'process' ? '3px solid var(--gurmad-green)' : '3px solid transparent',
            color: activeTab === 'process' ? 'var(--gurmad-green)' : '#64748b',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '1.05rem'
          }}
        >
          <Calculator size={20} />
          Process Cashout
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          style={{
            padding: '0.5rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'history' ? '3px solid var(--gurmad-green)' : '3px solid transparent',
            color: activeTab === 'history' ? 'var(--gurmad-green)' : '#64748b',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '1.05rem'
          }}
        >
          <History size={20} />
          Cashout History
        </button>
      </div>

      <div className="card" style={{ padding: '2rem' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Loading data...</div>
        ) : activeTab === 'process' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
            
            {/* Collector Selection */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Select Collector</label>
              <select 
                className="input-field" 
                value={selectedCollector}
                onChange={(e) => {
                  setSelectedCollector(e.target.value);
                  setActualAmountStr('');
                  setJustification('');
                }}
                style={{ 
                  width: '100%', 
                  padding: '0.75rem 1rem', 
                  borderRadius: '8px', 
                  border: '1px solid #cbd5e1', 
                  fontSize: '1rem', 
                  backgroundColor: '#ffffff', 
                  color: '#334155',
                  outline: 'none',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
              >
                <option value="">-- Dooro Collector (Select) --</option>
                {collectors.map(c => (
                  <option key={c.id} value={c.full_name}>{c.full_name}</option>
                ))}
              </select>
            </div>

            {selectedCollector && selectedStats && (
              <div style={{ padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Invoices Today:</span>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{selectedStats.invoiceCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Expected Collections (USD):</span>
                  <span style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--gurmad-green)' }}>
                    ${selectedStats.totalUsd.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Actual Amount Input */}
            {selectedCollector && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Actual Amount Brought (USD)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="input-field" 
                  value={actualAmountStr}
                  onChange={(e) => setActualAmountStr(e.target.value)}
                  placeholder="Enter total USD received..."
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem 1rem', 
                    borderRadius: '8px', 
                    border: '1px solid #cbd5e1', 
                    fontSize: '1rem', 
                    backgroundColor: '#ffffff', 
                    color: '#334155',
                    outline: 'none',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                  }}
                />
              </div>
            )}

            {/* Shortage Warning and Justification */}
            {selectedCollector && actualAmountStr !== '' && (selectedStats.totalUsd - parseFloat(actualAmountStr) > 0) && (
              <div style={{ padding: '1rem', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', marginBottom: '1rem', fontWeight: 600 }}>
                  <AlertCircle size={20} />
                  <span>Shortage Detected: ${(selectedStats.totalUsd - parseFloat(actualAmountStr)).toFixed(2)} is missing!</span>
                </div>
                
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#991b1b' }}>
                  Sababta (Reason/Justification) <span style={{color: 'red'}}>*</span>
                </label>
                <textarea 
                  className="input-field"
                  rows={3}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Fadlan cadee sababta lacagtu u dhiman tahay..."
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem 1rem', 
                    borderRadius: '8px', 
                    border: '1px solid #fca5a5', 
                    fontSize: '1rem', 
                    backgroundColor: '#ffffff', 
                    color: '#334155',
                    outline: 'none',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    resize: 'vertical'
                  }}
                />
              </div>
            )}

            {/* Submit Button */}
            <button 
              className="btn btn-primary" 
              onClick={handleCashout}
              disabled={!selectedCollector || actualAmountStr === ''}
              style={{ marginTop: '1rem', padding: '1rem', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
            >
              <CheckCircle2 size={24} />
              Process Cashout
            </button>

          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '1rem' }}>Date</th>
                  <th style={{ padding: '1rem' }}>Collector</th>
                  <th style={{ padding: '1rem' }}>Expected</th>
                  <th style={{ padding: '1rem' }}>Actual</th>
                  <th style={{ padding: '1rem' }}>Shortage</th>
                  <th style={{ padding: '1rem' }}>Processed By</th>
                </tr>
              </thead>
              <tbody>
                {cashouts.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      No cashout history found.
                    </td>
                  </tr>
                ) : (
                  cashouts.map(co => (
                    <tr key={co.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem' }}>{new Date(co.created_at).toLocaleDateString()} {new Date(co.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{co.collector_name}</td>
                      <td style={{ padding: '1rem' }}>${parseFloat(co.expected_amount).toFixed(2)}</td>
                      <td style={{ padding: '1rem', color: 'var(--gurmad-green)', fontWeight: 600 }}>${parseFloat(co.actual_amount).toFixed(2)}</td>
                      <td style={{ padding: '1rem' }}>
                        {parseFloat(co.shortage) > 0 ? (
                          <span style={{ color: '#ef4444', fontWeight: 600 }}>${parseFloat(co.shortage).toFixed(2)}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>$0.00</span>
                        )}
                        {co.reason && (
                          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem', maxWidth: '200px' }}>
                            {co.reason}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>{co.processed_by}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CashoutView;
