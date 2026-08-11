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
  
  // Actual amounts inputs
  const [actualCashUsd, setActualCashUsd] = useState('');
  const [actualZaad, setActualZaad] = useState('');
  const [actualEDahab, setActualEDahab] = useState('');
  const [actualSlsh, setActualSlsh] = useState('');
  
  const [justification, setJustification] = useState('');
  
  // Settings for currency format
  const [settings, setSettings] = useState({});

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [uData, invData, cashoutsData, setRes, pairingsData] = await Promise.all([
        api.getUsers(),
        api.getInvoices(),
        api.getCashouts().catch(() => []), // fallback empty array if error
        fetch('/api/settings').then(res => res.json()),
        api.getCashierAssignments().catch(() => [])
      ]);

      let collectorUsers = uData.filter(u => u.role === 'collector');

      // A cashier paired to specific collector(s) can only cash out for those collectors
      if (currentUser?.role === 'cashier') {
        const myPairings = (pairingsData || []).filter(p => p.cashier_id === currentUser.id && p.collector_name);
        if (myPairings.length > 0) {
          const pairedNames = myPairings.map(p => p.collector_name.toLowerCase());
          collectorUsers = collectorUsers.filter(u => pairedNames.includes((u.full_name || '').toLowerCase()));
        }
      }

      setCollectors(collectorUsers);
      setCashouts(cashoutsData || []);

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
    
    let cashUsd = 0;
    let zaadUsd = 0;
    let edahabUsd = 0;
    let slshVal = 0;
    
    collectorInvs.forEach(inv => {
      cashUsd += parseFloat(inv.cash_amount) || 0;
      zaadUsd += parseFloat(inv.zaad_amount) || 0;
      edahabUsd += parseFloat(inv.edahab_amount) || 0;
      slshVal += parseFloat(inv.slsh_amount) || 0;
    });
    
    const rate = parseFloat(settings.exchange_rate) || 8500;
    const totalUsd = cashUsd + zaadUsd + edahabUsd + (slshVal / rate);
    
    return {
      cashUsd,
      zaadUsd,
      edahabUsd,
      slshVal,
      totalUsd,
      invoiceCount: collectorInvs.length
    };
  }, [selectedCollector, invoices, settings]);

  const totalActualUsd = useMemo(() => {
    const cash = parseFloat(actualCashUsd) || 0;
    const zaad = parseFloat(actualZaad) || 0;
    const edahab = parseFloat(actualEDahab) || 0;
    const slsh = parseFloat(actualSlsh) || 0;
    const rate = parseFloat(settings.exchange_rate) || 8500;
    
    return cash + zaad + edahab + (slsh / rate);
  }, [actualCashUsd, actualZaad, actualEDahab, actualSlsh, settings]);

  const handleCashout = async () => {
    if (!selectedCollector) return toast.error('Please select a collector');
    
    // Check if at least one input is provided
    if (actualCashUsd === '' && actualZaad === '' && actualEDahab === '' && actualSlsh === '') {
      return toast.error('Please enter at least one actual amount');
    }

    const expected = selectedStats?.totalUsd || 0;
    const actual = totalActualUsd;
    const missing = expected - actual;

    if (missing > 0.01 && !justification.trim()) { // 0.01 for floating point safety
      return toast.error('Fadlan qor sababta / caddaynta lacagta dhiman (Reason for shortage is required)');
    }

    try {
      // 1. Create Cashout Record
      const newCashout = await api.addCashout({
        collector_name: selectedCollector,
        expected_amount: expected,
        actual_amount: actual,
        zaad_amount: parseFloat(actualZaad) || 0,
        edahab_amount: parseFloat(actualEDahab) || 0,
        cash_amount: parseFloat(actualCashUsd) || 0,
        slsh_amount: parseFloat(actualSlsh) || 0,
        shortage: missing > 0.01 ? missing : 0,
        reason: justification,
        processed_by: currentUser?.full_name || 'Cashier'
      });

      // 2. Register Debt if there is a shortage
      if (missing > 0.01) {
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
      } else if (actual - expected > 0.01) {
        toast.success(`Cashout processed! Lacag dheeraad ah: $${(actual - expected).toFixed(2)} (Overage)`);
      } else {
        toast.success('Cashout is successfully processed! (No shortage)');
      }
      
      // Update local history state
      setCashouts([newCashout, ...cashouts]);
      
      // Reset form
      setActualCashUsd('');
      setActualZaad('');
      setActualEDahab('');
      setActualSlsh('');
      setJustification('');
      setSelectedCollector('');
      
    } catch (err) {
      console.error(err);
      toast.error('Failed to process cashout');
    }
  };

  const thStyle = {
    padding: '0.75rem 0.6rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    whiteSpace: 'nowrap'
  };

  const tdStyle = {
    padding: '0.75rem 0.6rem',
    verticalAlign: 'top'
  };

  const chipStyle = {
    backgroundColor: '#f1f5f9',
    borderRadius: '6px',
    padding: '0.15rem 0.45rem',
    whiteSpace: 'nowrap'
  };

  const inputStyle = {
    width: '100%', 
    padding: '0.75rem 1rem', 
    borderRadius: '8px', 
    border: '1px solid #cbd5e1', 
    fontSize: '1rem', 
    backgroundColor: '#ffffff', 
    color: '#334155',
    outline: 'none',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', backgroundColor: 'var(--gurmad-green-light)', borderRadius: '12px', color: 'var(--gurmad-green)' }}>
          <Wallet size={24} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Cashier Cashout</h1>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            
            {/* Collector Selection */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Select Collector</label>
              <select 
                className="input-field" 
                value={selectedCollector}
                onChange={(e) => {
                  setSelectedCollector(e.target.value);
                  setActualCashUsd('');
                  setActualZaad('');
                  setActualEDahab('');
                  setActualSlsh('');
                  setJustification('');
                }}
                style={inputStyle}
              >
                <option value="">-- Dooro Collector (Select) --</option>
                {collectors.map(c => (
                  <option key={c.id} value={c.full_name}>{c.full_name}</option>
                ))}
              </select>
            </div>

            {selectedCollector && selectedStats && (
              <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f1f5f9' }}>
                  <h3 style={{ margin: 0, color: '#334155', fontWeight: 700 }}>Expected Collections (La filayo)</h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Today's Invoices: {selectedStats.invoiceCount}</p>
                </div>
                
                <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Cash (USD):</span>
                    <span style={{ fontWeight: 600 }}>${selectedStats.cashUsd.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Zaad:</span>
                    <span style={{ fontWeight: 600 }}>${selectedStats.zaadUsd.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>eDahab:</span>
                    <span style={{ fontWeight: 600 }}>${selectedStats.edahabUsd.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>SLSH:</span>
                    <span style={{ fontWeight: 600 }}>Slsh {selectedStats.slshVal.toLocaleString()}</span>
                  </div>
                </div>
                
                <div style={{ padding: '1.5rem', backgroundColor: '#e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#334155', fontWeight: 700, fontSize: '1.1rem' }}>Total Expected (USD):</span>
                  <span style={{ fontWeight: 800, fontSize: '1.5rem', color: '#1e293b' }}>
                    ${selectedStats.totalUsd.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Actual Amounts Inputs */}
            {selectedCollector && (
              <div>
                <h3 style={{ marginBottom: '1rem', color: '#334155', fontWeight: 700 }}>Actual Amounts Brought (Lacagta la keenay)</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#475569' }}>Cash Brought (USD)</label>
                    <input 
                      type="number" step="0.01" value={actualCashUsd}
                      onChange={(e) => setActualCashUsd(e.target.value)}
                      placeholder="0.00" style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#475569' }}>Zaad Brought (USD)</label>
                    <input 
                      type="number" step="0.01" value={actualZaad}
                      onChange={(e) => setActualZaad(e.target.value)}
                      placeholder="0.00" style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#475569' }}>eDahab Brought (USD)</label>
                    <input 
                      type="number" step="0.01" value={actualEDahab}
                      onChange={(e) => setActualEDahab(e.target.value)}
                      placeholder="0.00" style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#475569' }}>SLSH Brought</label>
                    <input 
                      type="number" value={actualSlsh}
                      onChange={(e) => setActualSlsh(e.target.value)}
                      placeholder="0" style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ padding: '1.5rem', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#166534', fontWeight: 700, fontSize: '1.1rem' }}>Total Actual (USD Equivalent):</span>
                  <span style={{ fontWeight: 800, fontSize: '1.5rem', color: '#15803d' }}>
                    ${totalActualUsd.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Shortage Warning and Justification */}
            {selectedCollector && (selectedStats.totalUsd - totalActualUsd > 0.01) && (
              <div style={{ padding: '1.5rem', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', marginBottom: '1rem', fontWeight: 600 }}>
                  <AlertCircle size={24} />
                  <span style={{ fontSize: '1.1rem' }}>Shortage Detected: ${(selectedStats.totalUsd - totalActualUsd).toFixed(2)} is missing!</span>
                </div>
                
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#991b1b' }}>
                  Sababta (Reason/Justification) <span style={{color: 'red'}}>*</span>
                </label>
                <textarea 
                  rows={3}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Fadlan cadee sababta lacagtu u dhiman tahay..."
                  style={{...inputStyle, border: '1px solid #fca5a5', resize: 'vertical'}}
                />
              </div>
            )}

            {/* Overage Notice */}
            {selectedCollector && (totalActualUsd - selectedStats.totalUsd > 0.01) && (
              <div style={{ padding: '1.5rem', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#15803d', fontWeight: 600 }}>
                  <AlertCircle size={24} />
                  <span style={{ fontSize: '1.1rem' }}>Overage Detected: ${(totalActualUsd - selectedStats.totalUsd).toFixed(2)} is extra!</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button 
              className="btn btn-primary" 
              onClick={handleCashout}
              disabled={!selectedCollector}
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
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Collector</th>
                  <th style={thStyle}>Breakdown (Actual)</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Expected</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actual</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Shortage / Overage</th>
                  <th style={thStyle}>Processed By</th>
                </tr>
              </thead>
              <tbody>
                {cashouts.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      No cashout history found.
                    </td>
                  </tr>
                ) : (
                  cashouts.map(co => (
                    <tr key={co.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600 }}>{new Date(co.created_at).toLocaleDateString()}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(co.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{co.collector_name}</td>
                      <td style={{ ...tdStyle, fontSize: '0.8rem', color: '#475569' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.5rem', maxWidth: '260px' }}>
                          <span style={chipStyle}>Cash ${parseFloat(co.cash_amount).toFixed(2)}</span>
                          <span style={chipStyle}>Zaad ${parseFloat(co.zaad_amount).toFixed(2)}</span>
                          <span style={chipStyle}>eDahab ${parseFloat(co.edahab_amount).toFixed(2)}</span>
                          <span style={chipStyle}>SLSH {parseFloat(co.slsh_amount).toLocaleString()}</span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>${parseFloat(co.expected_amount).toFixed(2)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--gurmad-green)', fontWeight: 600 }}>${parseFloat(co.actual_amount).toFixed(2)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {(() => {
                          const overage = parseFloat(co.actual_amount) - parseFloat(co.expected_amount);
                          if (parseFloat(co.shortage) > 0) {
                            return <span style={{ color: '#ef4444', fontWeight: 600 }}>-${parseFloat(co.shortage).toFixed(2)}</span>;
                          }
                          if (overage > 0.01) {
                            return <span style={{ color: 'var(--gurmad-green)', fontWeight: 600 }}>+${overage.toFixed(2)}</span>;
                          }
                          return <span style={{ color: '#94a3b8' }}>$0.00</span>;
                        })()}
                        {co.reason && (
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', maxWidth: '180px', marginLeft: 'auto' }}>
                            {co.reason}
                          </div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{co.processed_by}</td>
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
