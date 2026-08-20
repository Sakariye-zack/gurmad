import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, Search, CheckCircle2, AlertCircle, History, Calculator, Download, Trash2, Printer, Upload, XCircle, FileCheck2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

const CashoutView = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState('process'); // 'process' or 'history'
  
  const [cashiers, setCashiers] = useState([]);
  const [cashierToCollectors, setCashierToCollectors] = useState({}); // cashier full_name -> [collector names]
  const [cashierToZone, setCashierToZone] = useState({}); // cashier full_name -> zone_group, from Cashier Assignments
  const [invoices, setInvoices] = useState([]);
  const [cashouts, setCashouts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedCashier, setSelectedCashier] = useState('');
  
  // Actual amounts inputs
  const [actualCashUsd, setActualCashUsd] = useState('');
  const [actualZaad, setActualZaad] = useState('');
  const [actualEDahab, setActualEDahab] = useState('');
  const [actualSlsh, setActualSlsh] = useState('');
  
  const [justification, setJustification] = useState('');
  
  // Settings for currency format
  const [settings, setSettings] = useState({});
  const [historySearch, setHistorySearch] = useState('');

  // Signature workflow: print slip -> physical signatures (cashier + Gudoomiye) -> scan/upload ->
  // Gudoomiye approves. uploadTargetId tracks which cashout the hidden file input is for.
  const [uploadTargetId, setUploadTargetId] = useState(null);
  const [isUploadingSigned, setIsUploadingSigned] = useState(false);
  const [rejectModal, setRejectModal] = useState(null); // cashout being rejected
  const [rejectReason, setRejectReason] = useState('');
  const canApprove = currentUser?.role === 'admin' || currentUser?.role === 'gudoomiye';

  const printCashoutSlip = (co) => {
    const win = window.open('', '_blank', 'width=480,height=700');
    if (!win) { toast.error('Please allow pop-ups to print the slip'); return; }
    win.document.write(`
      <html><head><title>Cashout Slip #${co.id}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 2rem; color: #0f172a; }
        h1 { font-size: 1.2rem; margin: 0 0 4px; }
        .sub { color: #64748b; font-size: 0.85rem; margin-bottom: 1.5rem; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; }
        td:first-child { color: #64748b; } td:last-child { text-align: right; font-weight: 700; }
        .sig { margin-top: 3.5rem; display: flex; justify-content: space-between; }
        .sig div { width: 45%; text-align: center; }
        .line { border-top: 1px solid #0f172a; margin-top: 3rem; padding-top: 6px; font-size: 0.85rem; }
      </style></head>
      <body>
        <h1>GURMAD Waste Management — Cashout Slip</h1>
        <div class="sub">Cashout #${co.id} — ${new Date(co.created_at).toLocaleString()}</div>
        <table>
          <tr><td>Cashier</td><td>${co.cashier_name || co.collector_name || '-'}</td></tr>
          <tr><td>Zone</td><td>${co.zone || '-'}</td></tr>
          <tr><td>Expected</td><td>$${parseFloat(co.expected_amount).toFixed(2)}</td></tr>
          <tr><td>Actual</td><td>$${parseFloat(co.actual_amount).toFixed(2)}</td></tr>
          <tr><td>Shortage / Overage</td><td>$${parseFloat(co.shortage || 0).toFixed(2)}</td></tr>
          <tr><td>Cash</td><td>$${parseFloat(co.cash_amount).toFixed(2)}</td></tr>
          <tr><td>ZAAD</td><td>$${parseFloat(co.zaad_amount).toFixed(2)}</td></tr>
          <tr><td>eDahab</td><td>$${parseFloat(co.edahab_amount).toFixed(2)}</td></tr>
          <tr><td>SLSH</td><td>${parseFloat(co.slsh_amount).toLocaleString()}</td></tr>
          ${co.reason ? `<tr><td>Reason</td><td>${co.reason}</td></tr>` : ''}
        </table>
        <div class="sig">
          <div class="line">Cashier Signature</div>
          <div class="line">Gudoomiye Signature</div>
        </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const handleUploadSignedFile = async (e, cashoutId) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingSigned(true);
    try {
      const formData = new FormData();
      formData.append('signed_document', file);
      const updated = await api.uploadSignedCashout(cashoutId, formData);
      setCashouts(prev => prev.map(c => c.id === updated.id ? updated : c));
      toast.success('Signed slip uploaded');
    } catch (err) {
      toast.error(err.message || 'Failed to upload signed slip');
    } finally {
      setIsUploadingSigned(false);
      setUploadTargetId(null);
    }
  };

  const handleApproveCashout = async (id) => {
    try {
      const updated = await api.approveCashout(id);
      setCashouts(prev => prev.map(c => c.id === updated.id ? updated : c));
      toast.success('Cashout approved');
    } catch (err) {
      toast.error(err.message || 'Failed to approve cashout');
    }
  };

  const handleRejectCashout = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) return toast.error('A reason is required');
    try {
      const updated = await api.rejectCashout(rejectModal.id, rejectReason);
      setCashouts(prev => prev.map(c => c.id === updated.id ? updated : c));
      toast.success('Cashout rejected');
      setRejectModal(null);
      setRejectReason('');
    } catch (err) {
      toast.error(err.message || 'Failed to reject cashout');
    }
  };

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

      // Build a cashier -> [paired collector names] map from Cashier Assignments, so selecting
      // a cashier here can pull "expected" straight from the collector(s) they're paired with.
      // Also track the zone_group each cashier is assigned — without this, the cashout record
      // was created with zone: null, which a Gudoomiye's own-zone approval check (zone !==
      // req.user.zone) can never match, silently blocking the entire "Cashier submits, Gudoomiye
      // approves" workflow for anyone but an admin (who has no zone restriction to trip over).
      const cashierMap = {};
      const zoneMap = {};
      (pairingsData || []).forEach(p => {
        if (!p.cashier_name || !p.collector_name) return;
        if (!cashierMap[p.cashier_name]) cashierMap[p.cashier_name] = [];
        cashierMap[p.cashier_name].push(p.collector_name);
        if (p.zone_group && !zoneMap[p.cashier_name]) zoneMap[p.cashier_name] = p.zone_group;
      });
      setCashierToCollectors(cashierMap);
      setCashierToZone(zoneMap);

      let cashierUsers = uData.filter(u => u.role === 'cashier');

      // A cashier only ever cashes out their own collections
      if (currentUser?.role === 'cashier') {
        cashierUsers = cashierUsers.filter(u => u.id === currentUser.id);
      }
      // A gudoomiye only sees cashiers assigned within their own zone
      if (currentUser?.role === 'gudoomiye') {
        const zoneUserIds = new Set((pairingsData || []).filter(p => p.zone_group === currentUser.zone).map(p => p.cashier_id));
        cashierUsers = cashierUsers.filter(u => zoneUserIds.has(u.id));
      }

      setCashiers(cashierUsers);
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

  // The collector(s) this cashier is paired with — that's whose route income they're
  // reconciling. Falls back to matching invoices by cashier_name directly (invoices already
  // record who processed them), in case a pairing hasn't been set up yet.
  const pairedCollectorNames = (cashierToCollectors[selectedCashier] || []).map(n => n.toLowerCase());

  const selectedStats = useMemo(() => {
    if (!selectedCashier) return null;

    const cashierInvs = invoices.filter(i => {
      const byCashier = (i.cashier_name || '').toLowerCase() === selectedCashier.toLowerCase();
      const byCollector = i.collector_name && pairedCollectorNames.includes(i.collector_name.toLowerCase());
      return byCashier || byCollector;
    });

    let cashUsd = 0;
    let zaadUsd = 0;
    let edahabUsd = 0;
    let slshVal = 0;

    cashierInvs.forEach(inv => {
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
      invoiceCount: cashierInvs.length
    };
  }, [selectedCashier, invoices, settings, cashierToCollectors]);

  const totalActualUsd = useMemo(() => {
    const cash = parseFloat(actualCashUsd) || 0;
    const zaad = parseFloat(actualZaad) || 0;
    const edahab = parseFloat(actualEDahab) || 0;
    const slsh = parseFloat(actualSlsh) || 0;
    const rate = parseFloat(settings.exchange_rate) || 8500;
    
    return cash + zaad + edahab + (slsh / rate);
  }, [actualCashUsd, actualZaad, actualEDahab, actualSlsh, settings]);

  const handleCashout = async () => {
    if (!selectedCashier) return toast.error('Please select a cashier');

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
      // 1. Create Cashout Record — collector_name is kept for the zone-security check and
      // historical grouping, cashier_name is who's actually being reconciled.
      const newCashout = await api.addCashout({
        collector_name: (cashierToCollectors[selectedCashier] || [])[0] || '',
        cashier_name: selectedCashier,
        expected_amount: expected,
        actual_amount: actual,
        zaad_amount: parseFloat(actualZaad) || 0,
        edahab_amount: parseFloat(actualEDahab) || 0,
        cash_amount: parseFloat(actualCashUsd) || 0,
        slsh_amount: parseFloat(actualSlsh) || 0,
        shortage: missing > 0.01 ? missing : 0,
        reason: justification,
        processed_by: currentUser?.full_name || 'Cashier',
        zone: cashierToZone[selectedCashier] || null
      });

      // 2. Register Debt if there is a shortage — owed by the cashier who came up short
      if (missing > 0.01) {
        const cashierObj = cashiers.find(c => c.full_name.toLowerCase() === selectedCashier.toLowerCase() || c.username.toLowerCase() === selectedCashier.toLowerCase());

        const debtData = {
          customer_id: null,
          debtor_name: selectedCashier,
          phone: cashierObj?.phone || '',
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
      setSelectedCashier('');
      
    } catch (err) {
      console.error(err);
      toast.error('Failed to process cashout');
    }
  };

  const handleDeleteCashout = async (id) => {
    if (!window.confirm('Delete this cashout record? This cannot be undone.')) return;
    try {
      await api.deleteCashout(id);
      setCashouts(cashouts.filter(c => c.id !== id));
      toast.success('Cashout record deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete cashout');
    }
  };

  const filteredCashouts = cashouts.filter(co => {
    const q = historySearch.toLowerCase();
    return !q || (co.cashier_name || '').toLowerCase().includes(q) || (co.collector_name || '').toLowerCase().includes(q);
  });

  const handleExportCashoutsCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Cashier,Expected,Actual,Shortage,Cash,ZAAD,eDahab,SLSH,Processed By\n";
    filteredCashouts.forEach(co => {
      csvContent += `${new Date(co.created_at).toLocaleDateString()},${co.cashier_name || co.collector_name || ''},${co.expected_amount},${co.actual_amount},${co.shortage},${co.cash_amount},${co.zaad_amount},${co.edahab_amount},${co.slsh_amount},${co.processed_by || ''}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `gurmad_cashouts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            
            {/* Cashier Selection */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Select Cashier</label>
              <select
                className="input-field"
                value={selectedCashier}
                onChange={(e) => {
                  setSelectedCashier(e.target.value);
                  setActualCashUsd('');
                  setActualZaad('');
                  setActualEDahab('');
                  setActualSlsh('');
                  setJustification('');
                }}
                style={inputStyle}
              >
                <option value="">-- Dooro Cashier (Select) --</option>
                {cashiers.map(c => (
                  <option key={c.id} value={c.full_name}>{c.full_name}{cashierToCollectors[c.full_name]?.length ? ` (${cashierToCollectors[c.full_name].join(', ')})` : ''}</option>
                ))}
              </select>
              {cashiers.length === 0 && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#ef4444' }}>
                  No cashiers found. Assign cashiers to a zone/collector first (Cashier Assignments).
                </p>
              )}
            </div>

            {selectedCashier && selectedStats && (
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
            {selectedCashier && (
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
            {selectedCashier && (selectedStats.totalUsd - totalActualUsd > 0.01) && (
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
            {selectedCashier && (totalActualUsd - selectedStats.totalUsd > 0.01) && (
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
              disabled={!selectedCashier}
              style={{ marginTop: '1rem', padding: '1rem', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
            >
              <CheckCircle2 size={24} />
              Process Cashout
            </button>

          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '1rem' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '320px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Search cashier..." style={{ width: '100%', padding: '0.55rem 0.8rem 0.55rem 2rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }} />
              </div>
              <button onClick={handleExportCashoutsCSV} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.55rem 1rem' }}>
                <Download size={16} /> Export CSV
              </button>
            </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Cashier</th>
                  <th style={thStyle}>Breakdown (Actual)</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Expected</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actual</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Shortage / Overage</th>
                  <th style={thStyle}>Processed By</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCashouts.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      No cashout history found.
                    </td>
                  </tr>
                ) : (
                  filteredCashouts.map(co => (
                    <tr key={co.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600 }}>{new Date(co.created_at).toLocaleDateString()}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(co.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{co.cashier_name || co.collector_name || 'N/A'}</td>
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
                      <td style={tdStyle}>
                        {(() => {
                          const sc = { 'Pending Approval': { bg: '#fffbeb', fg: '#b45309' }, 'Approved': { bg: '#f0fdf4', fg: '#15803d' }, 'Rejected': { bg: '#fef2f2', fg: '#dc2626' } }[co.status] || { bg: '#f1f5f9', fg: '#64748b' };
                          return (
                            <div>
                              <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 800, backgroundColor: sc.bg, color: sc.fg, whiteSpace: 'nowrap' }}>
                                {(co.status || 'Pending Approval').toUpperCase()}
                              </span>
                              {co.signed_document && (
                                <div style={{ marginTop: '4px' }}>
                                  <a href={`/api/uploads/${co.signed_document}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: '#0ea5e9', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}>
                                    <FileCheck2 size={11} /> Signed slip
                                  </a>
                                </div>
                              )}
                              {co.status === 'Rejected' && co.rejection_reason && (
                                <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '3px', maxWidth: '160px' }}>{co.rejection_reason}</div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button onClick={() => printCashoutSlip(co)} title="Print Slip" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: '#475569', display: 'inline-flex' }}>
                            <Printer size={14} />
                          </button>
                          {(co.status === 'Pending Approval' || !co.status) && !co.signed_document && (
                            <>
                              <input type="file" accept="image/*,.pdf" id={`sig-upload-${co.id}`} style={{ display: 'none' }} onChange={(e) => handleUploadSignedFile(e, co.id)} disabled={isUploadingSigned} />
                              <label htmlFor={`sig-upload-${co.id}`} title="Upload Signed Slip" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: '#1d4ed8', display: 'inline-flex' }}>
                                <Upload size={14} />
                              </label>
                            </>
                          )}
                          {canApprove && (co.status === 'Pending Approval' || !co.status) && (
                            <>
                              <button
                                onClick={() => handleApproveCashout(co.id)}
                                disabled={!co.signed_document}
                                title={co.signed_document ? 'Approve' : 'Upload the signed slip first'}
                                style={{ background: co.signed_document ? '#f0fdf4' : '#f8fafc', border: `1px solid ${co.signed_document ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: '6px', padding: '5px', cursor: co.signed_document ? 'pointer' : 'not-allowed', color: co.signed_document ? '#15803d' : '#cbd5e1', display: 'inline-flex' }}
                              >
                                <CheckCircle2 size={14} />
                              </button>
                              <button onClick={() => setRejectModal(co)} title="Reject" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: '#dc2626', display: 'inline-flex' }}>
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                          {currentUser?.role === 'admin' && co.status !== 'Approved' && (
                            <button onClick={() => handleDeleteCashout(co.id)} title="Delete" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: '#dc2626', display: 'inline-flex' }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </div>

      {rejectModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card glass" style={{ width: '400px', borderTop: '4px solid #ef4444' }}>
            <h3 style={{ marginBottom: '0.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <XCircle size={20} color="#ef4444" /> Reject Cashout
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.3rem' }}>#{rejectModal.id} — {rejectModal.cashier_name || rejectModal.collector_name}</p>
            <form onSubmit={handleRejectCashout} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Reason for rejection</label>
                <textarea required value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '80px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => { setRejectModal(null); setRejectReason(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600 }}>Cancel</button>
                <button type="submit" style={{ padding: '0.65rem 1.3rem', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Reject</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashoutView;
