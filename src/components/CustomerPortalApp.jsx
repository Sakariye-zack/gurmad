import React, { useState, useEffect } from 'react';
import { User, Lock, LogOut, Home, DollarSign, Truck, MessageSquare, Plus, ChevronLeft } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { api } from '../api';

// Phase 8: Customer Portal — a completely separate, lightweight app served at /portal, with its
// own login (customer phone + password, granted by an admin via "Enable Portal Access" in
// Customers) and its own token type. Not part of the staff SPA in App.jsx at all.
const CustomerPortalApp = () => {
  const [customer, setCustomer] = useState(() => {
    const saved = localStorage.getItem('gurmadCustomer');
    return saved ? JSON.parse(saved) : null;
  });
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [tab, setTab] = useState('dashboard');

  const [payments, setPayments] = useState([]);
  const [collections, setCollections] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [newComplaint, setNewComplaint] = useState({ title: '', description: '' });

  useEffect(() => {
    if (customer) fetchAll();
  }, [customer?.id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [me, pay, col, comp] = await Promise.all([
        api.customerPortal.getMe(),
        api.customerPortal.getPayments(),
        api.customerPortal.getCollections(),
        api.customerPortal.getComplaints(),
      ]);
      const updated = { ...customer, ...me };
      setCustomer(updated);
      localStorage.setItem('gurmadCustomer', JSON.stringify(updated));
      setPayments(pay);
      setCollections(col);
      setComplaints(comp);
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('access denied')) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const data = await api.customerPortal.login(phone, password);
      localStorage.setItem('gurmadCustomer', JSON.stringify(data));
      setCustomer(data);
      toast.success(`Ku soo dhawoow, ${data.name}!`);
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gurmadCustomer');
    setCustomer(null);
    setTab('dashboard');
  };

  const handleComplaintSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.customerPortal.addComplaint(newComplaint);
      toast.success('Waa la diray cabashadaada / Complaint submitted');
      setShowComplaintForm(false);
      setNewComplaint({ title: '', description: '' });
      const comp = await api.customerPortal.getComplaints();
      setComplaints(comp);
    } catch (err) {
      toast.error('Failed to submit complaint');
    }
  };

  const outstandingBalance = payments.filter(p => p.status === 'Unpaid').reduce((sum, p) => sum + (parseFloat(p.debt_amount) || parseFloat(p.amount) || 0), 0);
  const lastCollection = collections.find(c => c.collected && c.collected_at);

  if (!customer) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)', padding: '1rem' }}>
        <Toaster />
        <div style={{ width: '100%', maxWidth: '380px', background: 'white', borderRadius: '20px', padding: '2.5rem', boxShadow: '0 20px 50px rgba(0,0,0,0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Home size={28} color="#3FAE2A" />
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#1e293b' }}>GURMAD</h1>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Customer Portal</p>
          </div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>PHONE NUMBER</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="0634xxxxxx" style={{ width: '100%', padding: '0.85rem 0.85rem 0.85rem 2.4rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="********" style={{ width: '100%', padding: '0.85rem 0.85rem 0.85rem 2.4rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }} />
              </div>
            </div>
            <button type="submit" disabled={isLoggingIn} style={{ padding: '0.9rem', borderRadius: '12px', border: 'none', background: '#3FAE2A', color: 'white', fontWeight: 800, cursor: 'pointer', marginTop: '0.5rem' }}>
              {isLoggingIn ? 'Logging in...' : 'Login'}
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
              Login-kan waxaa kuu siiya shirkadda Gurmad marka lagu diiwaan geliyo. La xidhiidh haddii aadan haysan.
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Toaster />
      <div style={{ background: 'linear-gradient(135deg, #3FAE2A 0%, #2d8c1e 100%)', color: 'white', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.75rem', opacity: 0.85, fontWeight: 600 }}>GURMAD CUSTOMER PORTAL</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{customer.name}</div>
        </div>
        <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '10px', padding: '0.6rem 1rem', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
          <LogOut size={16} /> Logout
        </button>
      </div>

      <div style={{ display: 'flex', gap: '4px', padding: '1rem 1.5rem 0', overflowX: 'auto' }}>
        {[
          { id: 'dashboard', label: 'Dashboard', icon: Home },
          { id: 'payments', label: 'Payments', icon: DollarSign },
          { id: 'collections', label: 'Collections', icon: Truck },
          { id: 'complaints', label: 'Complaints', icon: MessageSquare },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '0.7rem 1.1rem', borderRadius: '10px 10px 0 0',
            border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            background: tab === t.id ? 'white' : 'transparent',
            color: tab === t.id ? '#1e293b' : '#64748b',
            fontWeight: tab === t.id ? 800 : 600, fontSize: '0.85rem'
          }}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      <div style={{ background: 'white', minHeight: 'calc(100vh - 140px)', padding: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading...</div>
        ) : tab === 'dashboard' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1.2rem', borderRadius: '14px', background: customer.status === 'Paid' ? '#dcfce7' : '#fef2f2' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: customer.status === 'Paid' ? '#15803d' : '#b91c1c', textTransform: 'uppercase' }}>Payment Status</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b' }}>{customer.status || 'Unpaid'}</div>
              </div>
              <div style={{ padding: '1.2rem', borderRadius: '14px', background: '#fef3c7' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>Outstanding</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b' }}>${outstandingBalance.toFixed(2)}</div>
              </div>
              <div style={{ padding: '1.2rem', borderRadius: '14px', background: '#dbeafe' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' }}>Monthly Fee</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b' }}>${parseFloat(customer.fee || 0).toFixed(2)}</div>
              </div>
              <div style={{ padding: '1.2rem', borderRadius: '14px', background: '#f3e8ff' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>Collector</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>{customer.collector_name || 'Unassigned'}</div>
              </div>
            </div>

            <div style={{ padding: '1.2rem', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontWeight: 800, marginBottom: '8px' }}>My Service</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', fontSize: '0.85rem', color: '#475569' }}>
                <div><strong>Category:</strong> {customer.category || '—'}</div>
                <div><strong>Frequency:</strong> {customer.collection_frequency || '—'}</div>
                <div><strong>Zone:</strong> {customer.zone || '—'}</div>
                <div><strong>Address:</strong> House {customer.house_no || '—'}, {customer.area || '—'}</div>
              </div>
            </div>

            {lastCollection && (
              <div style={{ padding: '1.2rem', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 800, marginBottom: '8px' }}>Last Collection</div>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                  {new Date(lastCollection.collected_at).toLocaleDateString()} — collected by {lastCollection.collector_name || 'N/A'}
                </div>
              </div>
            )}
          </div>
        ) : tab === 'payments' ? (
          <div>
            <h3 style={{ fontWeight: 800, marginBottom: '1rem' }}>Payment History</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '0.85rem', fontSize: '0.78rem', color: '#64748b' }}>DATE</th>
                    <th style={{ padding: '0.85rem', fontSize: '0.78rem', color: '#64748b' }}>AMOUNT</th>
                    <th style={{ padding: '0.85rem', fontSize: '0.78rem', color: '#64748b' }}>METHOD</th>
                    <th style={{ padding: '0.85rem', fontSize: '0.78rem', color: '#64748b' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No payment history yet.</td></tr>
                  ) : payments.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem', fontSize: '0.85rem' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '0.85rem', fontWeight: 700 }}>${parseFloat(p.amount).toFixed(2)}</td>
                      <td style={{ padding: '0.85rem', fontSize: '0.85rem' }}>{p.payment_method}</td>
                      <td style={{ padding: '0.85rem' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700, background: p.status === 'Paid' ? '#dcfce7' : '#fef2f2', color: p.status === 'Paid' ? '#15803d' : '#b91c1c' }}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'collections' ? (
          <div>
            <h3 style={{ fontWeight: 800, marginBottom: '1rem' }}>Collection History</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '0.85rem', fontSize: '0.78rem', color: '#64748b' }}>DATE</th>
                    <th style={{ padding: '0.85rem', fontSize: '0.78rem', color: '#64748b' }}>COLLECTOR</th>
                    <th style={{ padding: '0.85rem', fontSize: '0.78rem', color: '#64748b' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.length === 0 ? (
                    <tr><td colSpan="3" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No collection history yet.</td></tr>
                  ) : collections.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem', fontSize: '0.85rem' }}>{c.collected_at ? new Date(c.collected_at).toLocaleDateString() : '—'}</td>
                      <td style={{ padding: '0.85rem', fontSize: '0.85rem' }}>{c.collector_name || c.driver_name || '—'}</td>
                      <td style={{ padding: '0.85rem' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700, background: c.collected ? '#dcfce7' : '#fef3c7', color: c.collected ? '#15803d' : '#b45309' }}>
                          {c.collected ? 'Collected' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 800, margin: 0 }}>Complaints</h3>
              <button onClick={() => setShowComplaintForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.6rem 1rem', borderRadius: '10px', border: 'none', background: '#3FAE2A', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                <Plus size={16} /> New Complaint
              </button>
            </div>

            {showComplaintForm && (
              <form onSubmit={handleComplaintSubmit} style={{ padding: '1.2rem', borderRadius: '14px', border: '1px solid #f1f5f9', marginBottom: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Title</label>
                  <input required value={newComplaint.title} onChange={e => setNewComplaint({...newComplaint, title: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Description</label>
                  <textarea value={newComplaint.description} onChange={e => setNewComplaint({...newComplaint, description: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '80px', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowComplaintForm(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" style={{ padding: '0.65rem 1.2rem', borderRadius: '8px', border: 'none', background: '#3FAE2A', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Submit</button>
                </div>
              </form>
            )}

            {complaints.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No complaints submitted yet.</div>
            ) : complaints.map(c => (
              <div key={c.id} style={{ padding: '1rem', borderRadius: '12px', border: '1px solid #f1f5f9', marginBottom: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 700 }}>{c.title}</div>
                  <span style={{ padding: '4px 10px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700, background: c.status === 'Resolved' ? '#dcfce7' : c.status === 'In Progress' ? '#dbeafe' : '#fffbeb', color: c.status === 'Resolved' ? '#15803d' : c.status === 'In Progress' ? '#1d4ed8' : '#b45309' }}>{c.status}</span>
                </div>
                {c.description && <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '6px' }}>{c.description}</div>}
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>{new Date(c.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerPortalApp;
