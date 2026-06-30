import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

const CashoutView = ({ currentUser }) => {
  const [collectors, setCollectors] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedCollector, setSelectedCollector] = useState('');
  const [actualAmountStr, setActualAmountStr] = useState('');
  const [justification, setJustification] = useState('');
  
  // Settings for currency format
  const [settings, setSettings] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [uData, invData, setRes] = await Promise.all([
        api.getUsers(),
        api.getInvoices(),
        fetch('/api/settings').then(res => res.json())
      ]);
      
      const collectorUsers = uData.filter(u => u.role === 'collector');
      setCollectors(collectorUsers);
      
      // Filter invoices for today only
      const today = new Date().toISOString().split('T')[0];
      const todayInvoices = invData.filter(inv => inv.created_at.startsWith(today));
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
      if (missing > 0) {
        // Register debt on collector
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
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', backgroundColor: 'var(--gurmad-green-light)', borderRadius: '12px', color: 'var(--gurmad-green)' }}>
          <Wallet size={24} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Collector Cashout</h1>
          <p style={{ color: '#64748b', margin: 0 }}>Reconcile daily collections and register shortages</p>
        </div>
      </div>

      <div className="card" style={{ padding: '2rem' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Loading data...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
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
                  style={{ border: '1px solid #fca5a5' }}
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
        )}
      </div>
    </div>
  );
};

export default CashoutView;
