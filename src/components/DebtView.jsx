import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Filter, AlertCircle, CheckCircle2, Copy, Trash2, MessageSquare, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

const DebtView = ({ searchQuery = '' }) => {
  const [debts, setDebts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [systemInfo, setSystemInfo] = useState({ logo: '', name: 'GURMAD' });
  const [collectors, setCollectors] = useState([]);
  const [zones, setZones] = useState([]);
  const [paymentModal, setPaymentModal] = useState({ isOpen: false, debt: null, debtId: null, method: 'Cash', phone: '' });
  const [isRemindModalOpen, setIsRemindModalOpen] = useState(false);
  const [remindForm, setRemindForm] = useState({ to: '', message: '', method: 'sms' });

  // Form State
  const [newDebt, setNewDebt] = useState({
    customer_id: '',
    debtor_name: '',
    phone: '',
    amount: '',
    currency: 'USD',
    description: '',
    collector_name: '',
    zone: '',
    house_no: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [debtsData, customersData, usersData, zonesData] = await Promise.all([
        api.getDebts(),
        api.getCustomers(),
        api.getUsers(),
        api.getZones()
      ]);
      setDebts(debtsData);
      setCustomers(customersData);
      setCollectors(usersData.filter(u => u.role === 'collector' || u.role === 'admin'));
      setZones(zonesData);
      
      // Fetch system info for receipt
      const res = await fetch('/api/settings');
      const settings = await res.json();
      setSystemInfo({
        logo: settings.system_logo || '',
        name: settings.company_name || 'GURMAD WASTE MANAGEMENT',
        phone: settings.landing_contact_phone || '063-4444444',
        email: settings.landing_contact_email || 'info@gurmad.so',
        address: settings.landing_contact_address || 'Main Office, Burao'
      });
    } catch (err) {
      toast.error('Failed to load details');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomerSelect = (e) => {
    const selectedId = e.target.value;
    if (selectedId) {
      const customer = customers.find(c => c.id.toString() === selectedId);
      if (customer) {
        setNewDebt({
          ...newDebt,
          customer_id: customer.id,
          debtor_name: customer.name,
          phone: customer.phone,
          zone: customer.zone || '',
          house_no: customer.house_no || ''
        });
      }
    } else {
      setNewDebt({
        ...newDebt,
        customer_id: '',
        debtor_name: '',
        phone: '',
        zone: '',
        house_no: ''
      });
    }
  };

  const handleAddDebt = async (e) => {
    e.preventDefault();
    try {
      const debtData = { ...newDebt };
      if (debtData.zone === 'Manual' && debtData.manual_zone) {
        debtData.zone = debtData.manual_zone;
      }
      delete debtData.manual_zone;

      const data = await api.addDebt(debtData);
      setDebts([data, ...debts]);
      setIsAddModalOpen(false);
      setNewDebt({ customer_id: '', debtor_name: '', phone: '', amount: '', currency: 'USD', description: '', collector_name: '', zone: '', house_no: '', manual_zone: '' });
      toast.success('Debt recorded successfully');
    } catch (err) {
      toast.error('Failed to add debt');
    }
  };

  const handleStatusUpdate = async (id, status, method = null) => {
    try {
      if (status === 'Paid' && method === 'Zaad') {
        if (!paymentModal.phone || paymentModal.phone.length < 9) {
          toast.error('Fadlan geli nambarka Zaad sax ah');
          return;
        }
        const loadingToast = toast.loading('Fadlan sug... Macmiilka ayaa la weydiinayaa PIN-ka');
        try {
          const payRes = await api.processZaadPayment({
            amount: paymentModal.debt.amount,
            phone: paymentModal.phone,
            currency: paymentModal.debt.currency,
            reference: paymentModal.debtId
          });
          toast.dismiss(loadingToast);
          if (!payRes.success) {
            toast.error('Lacag bixinta waa la diiday ama waa fashilantay');
            return; // Stop update if payment failed
          }
          toast.success('Lacag bixinta Zaad way guulaysatay!');
        } catch (err) {
          toast.dismiss(loadingToast);
          toast.error(err.message || 'Cilad ayaa ka dhacday Zaad API');
          return; // Stop update if error
        }
      }

      const data = await api.updateDebtStatus(id, status, method);
      setDebts(debts.map(debt => debt.id === id ? { ...debt, status: data.status } : debt));
      toast.success('Status updated');
      if (paymentModal.isOpen) {
        setPaymentModal({ isOpen: false, debt: null, debtId: null, method: 'Cash', phone: '' });
      }
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteDebt = async (id) => {
    if (!window.confirm('Are you sure you want to delete this debt record?')) return;
    try {
      await api.deleteDebt(id);
      setDebts(debts.filter(d => d.id !== id));
      toast.success('Debt record deleted');
    } catch (err) {
      toast.error('Failed to delete debt record');
    }
  };

  const handleSendReminder = async (e) => {
    e.preventDefault();
    try {
      const loadingToast = toast.loading('Sending reminder...');
      await api.sendCustomerMessage(remindForm);
      toast.dismiss(loadingToast);
      toast.success('Reminder sent successfully!', { icon: '🚀' });
      setIsRemindModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'Failed to send reminder');
    }
  };

  const filteredDebts = debts.filter(debt => {
    const search = searchQuery.toLowerCase();
    return debt.debtor_name.toLowerCase().includes(search) ||
           (debt.phone && debt.phone.toLowerCase().includes(search)) ||
           debt.status.toLowerCase().includes(search);
  });

  const totalOwedUSD = debts.filter(d => d.status === 'Unpaid' && d.currency === 'USD').reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
  const totalOwedSLSH = debts.filter(d => d.status === 'Unpaid' && d.currency === 'SLSH').reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
  
  const totalPaidUSD = debts.filter(d => d.status === 'Paid' && d.currency === 'USD').reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
  const totalPaidSLSH = debts.filter(d => d.status === 'Paid' && d.currency === 'SLSH').reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

  return (
    <div className="view-container slide-up">
      {/* Header Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card glass-effect" style={{ borderLeft: '4px solid var(--gurmad-orange)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>Total Unpaid Debts (Owed)</p>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '5px' }}>
                ${totalOwedUSD.toFixed(2)}
                {totalOwedSLSH > 0 && <span style={{ fontSize: '0.9rem', marginLeft: '8px', color: 'var(--text-muted)' }}>+ {totalOwedSLSH.toLocaleString()} SLSH</span>}
              </h3>
            </div>
            <div style={{ padding: '12px', backgroundColor: 'rgba(240, 115, 33, 0.1)', borderRadius: '12px', color: 'var(--gurmad-orange)' }}>
              <AlertCircle size={24} />
            </div>
          </div>
        </div>

        <div className="card glass-effect" style={{ borderLeft: '4px solid var(--gurmad-green)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>Total Debts Paid</p>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '5px' }}>
                ${totalPaidUSD.toFixed(2)}
                {totalPaidSLSH > 0 && <span style={{ fontSize: '0.9rem', marginLeft: '8px', color: 'var(--text-muted)' }}>+ {totalPaidSLSH.toLocaleString()} SLSH</span>}
              </h3>
            </div>
            <div style={{ padding: '12px', backgroundColor: 'rgba(63, 174, 42, 0.1)', borderRadius: '12px', color: 'var(--gurmad-green)' }}>
              <CheckCircle2 size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="card glass-effect" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
              <UserPlus size={18} />
              <span>Record Debt</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="table-container" style={{ flex: 1 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Date</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Debtor Name</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Zone / Area</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Location</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Amount</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Collector</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Reason/Desc</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
                    Loading debts...
                  </td>
                </tr>
              ) : filteredDebts.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No debts recorded yet.
                  </td>
                </tr>
              ) : (
                filteredDebts.map(debt => (
                  <tr 
                    key={debt.id} 
                    className="fade-in" 
                    style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s', cursor: 'pointer' }}
                    onClick={() => setSelectedDebt(debt)}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '1.25rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      {new Date(debt.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '1.25rem 1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{debt.debtor_name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {debt.phone || '-'}
                        {debt.phone && (
                          <button onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(debt.phone);
                            toast.success('Phone copied');
                          }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
                            <Copy size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1rem' }}>
                       <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{debt.zone || <span style={{ opacity: 0.5 }}>-</span>}</div>
                    </td>
                    <td style={{ padding: '1.25rem 1rem' }}>
                       <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                         {debt.house_no ? `H: ${debt.house_no}` : ''}
                         {debt.neighborhood ? ` ${debt.neighborhood}` : ''}
                         {!debt.house_no && !debt.neighborhood && '-'}
                       </div>
                    </td>
                    <td style={{ padding: '1.25rem 1rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                        {debt.currency === 'USD' ? '$' : ''}{parseFloat(debt.amount).toLocaleString()}
                        {debt.currency === 'SLSH' ? <span style={{ fontSize: '0.75rem', fontWeight: 500, marginLeft: '4px' }}>SLSH</span> : ''}
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
                        {debt.collector_name || <span style={{ fontStyle: 'italic', opacity: 0.7 }}>Admin / System</span>}
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1rem' }}>
                      <div style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {debt.description || '-'}
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1rem' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: debt.status === 'Paid' ? '#ecfdf5' : '#fff1f2',
                        color: debt.status === 'Paid' ? '#059669' : '#e11d48',
                        border: `1px solid ${debt.status === 'Paid' ? '#a7f3d0' : '#fecaca'}`
                      }}>
                        {debt.status === 'Paid' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        {debt.status.toUpperCase()}
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                        {debt.status === 'Unpaid' ? (
                          <>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setPaymentModal({ isOpen: true, debt: debt, debtId: debt.id, method: 'Cash', phone: debt.phone || '' }); }}
                              className="glass"
                              style={{ 
                                backgroundColor: 'var(--gurmad-green)', 
                                color: 'white', 
                                padding: '6px 16px', 
                                fontSize: '0.8rem', 
                                fontWeight: 600,
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgba(63, 174, 42, 0.2)'
                              }}
                            >
                              Mark Paid
                            </button>
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setRemindForm({ 
                                  to: debt.phone, 
                                  message: `Asc ${debt.debtor_name}, waxaan ku xasuusinaynaa in lagugu leeyahay lacag dhan $${debt.amount} oo ah bixinta xashiishka. Fadlan iska soo bixi.`,
                                  method: 'sms' 
                                });
                                setIsRemindModalOpen(true);
                              }}
                              style={{ 
                                backgroundColor: '#fef3c7', 
                                color: '#d97706', 
                                padding: '6px 12px', 
                                fontSize: '0.8rem', 
                                fontWeight: 600,
                                borderRadius: '8px',
                                border: '1px solid #fde68a',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <MessageSquare size={14} /> Remind
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleStatusUpdate(debt.id, 'Unpaid'); }}
                            style={{ 
                              color: 'var(--text-muted)', 
                              padding: '6px 12px', 
                              fontSize: '0.8rem', 
                              fontWeight: 500,
                              textDecoration: 'underline'
                            }}
                          >
                            Undo
                          </button>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteDebt(debt.id); }}
                          style={{
                            padding: '6px',
                            borderRadius: '8px',
                            border: '1px solid #fee2e2',
                            backgroundColor: 'transparent',
                            color: '#ef4444',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Delete Debt"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Debt Modal */}
      {isAddModalOpen && (
        <div 
          className="modal-overlay" 
          onClick={() => setIsAddModalOpen(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
        >
          <div 
            className="card scale-in" 
            onClick={e => e.stopPropagation()}
            style={{ width: '95%', maxWidth: '550px', padding: '2rem', animation: 'slideUp 0.3s ease-out' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontWeight: 700, margin: 0 }}>Record New Debt (Dayn)</h2>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                style={{ padding: '8px', color: 'var(--text-muted)', background: '#f1f5f9', borderRadius: '50%', display: 'flex' }}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAddDebt} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Select Existing Customer (Optional)</label>
                <select 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'white' }} 
                  onChange={handleCustomerSelect} 
                  value={newDebt.customer_id || ''}
                >
                  <option value="">-- No, enter manual details --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>Selecting a customer auto-fills their name and phone.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Debtor Name *</label>
                  <input 
                    type="text" 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
                    value={newDebt.debtor_name} 
                    onChange={(e) => setNewDebt({...newDebt, debtor_name: e.target.value})} 
                    required 
                    placeholder="Enter name"
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Phone Number *</label>
                  <input 
                    type="text" 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
                    value={newDebt.phone} 
                    onChange={(e) => setNewDebt({...newDebt, phone: e.target.value})} 
                    required 
                    placeholder="e.g. 063..."
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Amount *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
                    value={newDebt.amount} 
                    onChange={(e) => setNewDebt({...newDebt, amount: e.target.value})} 
                    required 
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Currency</label>
                  <select 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'white' }}
                    value={newDebt.currency} 
                    onChange={(e) => setNewDebt({...newDebt, currency: e.target.value})}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="SLSH">SLSH</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Collector Name *</label>
                  <select 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'white' }}
                    value={newDebt.collector_name}
                    onChange={(e) => setNewDebt({...newDebt, collector_name: e.target.value})}
                    required
                  >
                    <option value="">-- Select Collector --</option>
                    {collectors.map(u => (
                      <option key={u.id} value={u.full_name || u.username}>{u.full_name || u.username} ({u.role})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>House Number</label>
                  <input 
                    type="text" 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
                    value={newDebt.house_no} 
                    onChange={(e) => setNewDebt({...newDebt, house_no: e.target.value})} 
                    placeholder="e.g. H-201"
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Zone / Area</label>
                <select 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'white' }}
                  value={newDebt.zone}
                  onChange={(e) => setNewDebt({...newDebt, zone: e.target.value})}
                >
                  <option value="">-- Select Zone --</option>
                  {zones.map(z => (
                    <option key={z.id} value={z.name}>{z.name}</option>
                  ))}
                  <option value="Manual">-- Other / Manual Entry --</option>
                </select>
                {newDebt.zone === 'Manual' && (
                  <input 
                    type="text" 
                    placeholder="Enter manual zone/area name"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', marginTop: '10px' }}
                    onChange={(e) => setNewDebt({...newDebt, manual_zone: e.target.value})}
                  />
                )}
              </div>

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Description / Reason</label>
                <textarea 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', minHeight: '80px', fontFamily: 'inherit' }}
                  value={newDebt.description} 
                  onChange={(e) => setNewDebt({...newDebt, description: e.target.value})} 
                  placeholder="e.g. Borrowed cash, unpaid service..."
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  style={{ padding: '0.75rem 1.5rem', fontWeight: 600, color: 'var(--text-muted)' }} 
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '0.75rem 2rem' }}>
                  Save Debt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Debt Details & Receipt Modal */}
      {selectedDebt && (
        <div 
          className="modal-overlay" 
          onClick={() => setSelectedDebt(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}
        >
          <div 
            className="card scale-in" 
            onClick={e => e.stopPropagation()}
            style={{ 
              width: '95%', 
              maxWidth: '450px', 
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0, 
              overflow: 'hidden', 
              border: 'none', 
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' 
            }}
          >
            <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', backgroundColor: 'white' }} id="receipt-content">
              {/* Receipt Header */}
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{ marginBottom: '10px' }}>
                  {systemInfo.logo ? (
                    <img src={`/api/uploads/${systemInfo.logo}`} alt="Logo" style={{ height: '50px', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'var(--gurmad-green)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: '1.5rem', fontWeight: 700 }}>G</div>
                  )}
                </div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{systemInfo.name}</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                  <p style={{ margin: 2 }}>{systemInfo.address}</p>
                  <p style={{ margin: 2 }}>Tel: {systemInfo.phone} | Email: {systemInfo.email}</p>
                </div>
                <div style={{ marginTop: '15px', fontWeight: 700, letterSpacing: '1px', color: 'var(--gurmad-green)', fontSize: '0.8rem' }}>OFFICIAL PAYMENT RECEIPT / DAYN</div>
              </div>

              {/* Receipt Info Body */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '2px dashed #e2e8f0', borderBottom: '2px dashed #e2e8f0', padding: '1.5rem 0', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Receipt ID:</span>
                  <span style={{ fontWeight: 700 }}>#DBT-{selectedDebt.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Date:</span>
                  <span>{new Date(selectedDebt.created_at).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Debtor:</span>
                  <span style={{ fontWeight: 600 }}>{selectedDebt.debtor_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
                  <span>{selectedDebt.phone || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Collector:</span>
                  <span style={{ fontWeight: 600 }}>{selectedDebt.collector_name || 'System Admin'}</span>
                </div>
                {selectedDebt.house_no && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>House No:</span>
                    <span style={{ fontWeight: 600 }}>{selectedDebt.house_no}</span>
                  </div>
                )}
                {selectedDebt.street && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Street:</span>
                    <span style={{ fontWeight: 600 }}>{selectedDebt.street}</span>
                  </div>
                )}
                {selectedDebt.neighborhood && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Neighborhood:</span>
                    <span style={{ fontWeight: 600 }}>{selectedDebt.neighborhood}</span>
                  </div>
                )}
                {selectedDebt.zone && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Zone:</span>
                    <span style={{ fontWeight: 600 }}>{selectedDebt.zone}</span>
                  </div>
                )}
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                   <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Reason/Description:</p>
                   <p style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>{selectedDebt.description || 'No description provided.'}</p>
                </div>
              </div>

              {/* Amount & Status */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>TOTAL AMOUNT</p>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                   {selectedDebt.currency === 'USD' ? '$' : ''}{parseFloat(selectedDebt.amount).toLocaleString()}
                </h1>
                {selectedDebt.currency === 'SLSH' && <p style={{ fontSize: '1rem', fontWeight: 600, marginTop: '-5px' }}>SLSH</p>}
                
                <div style={{ 
                  marginTop: '1.5rem', 
                  padding: '8px 16px', 
                  borderRadius: '30px', 
                  fontSize: '0.9rem', 
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: selectedDebt.status === 'Paid' ? '#dcfce7' : '#fee2e2',
                  color: selectedDebt.status === 'Paid' ? '#166534' : '#991b1b',
                  border: `1px solid ${selectedDebt.status === 'Paid' ? '#86efac' : '#fecaca'}`
                 }}>
                  {selectedDebt.status === 'Paid' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  {selectedDebt.status.toUpperCase()}
                </div>
              </div>

              {/* Signatures */}
              <div style={{ marginTop: '3rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderBottom: '1px solid #cbd5e1', marginBottom: '8px' }}></div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Collector's Signature</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderBottom: '1px solid #cbd5e1', marginBottom: '8px' }}></div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Customer's Signature</p>
                </div>
              </div>

              {/* Legal Note */}
              <div style={{ marginTop: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                  Tani waa cadayn rasmi ah oo ay soo saartay {systemInfo.name}. 
                  Wixii cabasho ah la xidhiidh xafiiska.
                </p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', gap: '1px', backgroundColor: '#e2e8f0' }}>
              <button 
                onClick={() => setSelectedDebt(null)}
                style={{ flex: 1, padding: '1.25rem', backgroundColor: 'white', fontWeight: 600, color: 'var(--text-muted)', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
              >
                Close
              </button>
              <button 
                onClick={() => {
                  window.print();
                }}
                className="btn-primary"
                style={{ flex: 1, padding: '1.25rem', borderRadius: 0, backgroundColor: 'var(--gurmad-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Copy size={18} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Method Modal */}
      {paymentModal.isOpen && (
        <div 
          className="modal-overlay" 
          onClick={() => setPaymentModal({ isOpen: false, debt: null, debtId: null, method: 'Cash', phone: '' })}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
        >
          <div 
            className="card scale-in" 
            onClick={e => e.stopPropagation()}
            style={{ width: '90%', maxWidth: '400px', padding: '2rem', animation: 'slideUp 0.3s ease-out' }}
          >
            <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', marginTop: 0 }}>Select Payment Method</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Qaabka Lacagta lagu Bixinayo</label>
                <select 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'white' }}
                  value={paymentModal.method}
                  onChange={(e) => setPaymentModal({...paymentModal, method: e.target.value})}
                >
                  <option value="Cash">Cash (Caddaan)</option>
                  <option value="Zaad">Zaad Service (Automatic)</option>
                  <option value="eDahab">eDahab</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              {paymentModal.method === 'Zaad' && (
                <div className="fade-in">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Nambarka Zaad ee Macmiilka *</label>
                  <input 
                    type="text" 
                    placeholder="Tusaale: 25263..." 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gurmad-green)', outline: 'none', backgroundColor: '#f0fdf4' }}
                    value={paymentModal.phone}
                    onChange={(e) => setPaymentModal({...paymentModal, phone: e.target.value})}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>Nambarkan ayaa si toos ah fariin "USSD PIN" ah loogu dirayaa.</p>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  onClick={() => setPaymentModal({ isOpen: false, debt: null, debtId: null, method: 'Cash', phone: '' })}
                  style={{ padding: '0.75rem 1.5rem', fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary" 
                  onClick={() => handleStatusUpdate(paymentModal.debtId, 'Paid', paymentModal.method)}
                  style={{ padding: '0.75rem 2rem' }}
                >
                  {paymentModal.method === 'Zaad' ? 'Pay with Zaad' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remind Modal */}
      {isRemindModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div className="card" style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>
                  <MessageSquare size={24} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#1e293b' }}>Send Reminder</h3>
              </div>
              <button onClick={() => setIsRemindModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><AlertCircle size={24} color="#94a3b8" /></button>
            </div>

            <form onSubmit={handleSendReminder}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, color: '#475569', fontSize: '0.9rem' }}>Phone Number:</label>
                <input 
                  required
                  value={remindForm.to}
                  onChange={(e) => setRemindForm({...remindForm, to: e.target.value})}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '1rem', fontWeight: 600, outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, color: '#475569', fontSize: '0.9rem' }}>Nooca Fariinta (Method):</label>
                <select 
                  value={remindForm.method}
                  onChange={(e) => setRemindForm({...remindForm, method: e.target.value})}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '1rem', fontWeight: 600, outline: 'none' }}
                >
                  <option value="sms">SMS Message</option>
                  <option value="whatsapp">WhatsApp Message</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, color: '#475569', fontSize: '0.9rem' }}>Fariinta (Message):</label>
                <textarea 
                  required
                  value={remindForm.message}
                  onChange={(e) => setRemindForm({...remindForm, message: e.target.value})}
                  rows="4"
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '1rem', fontWeight: 500, outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setIsRemindModalOpen(false)} style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: 'none', backgroundColor: '#f1f5f9', color: '#64748b', fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: 'none', backgroundColor: '#ea580c', color: 'white', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Send size={18} /> Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebtView;
