import React, { useState, useEffect } from 'react';
import { User, Lock, LogOut, Home, DollarSign, Truck, MessageSquare, Plus, Inbox, CheckCircle2, Clock, CreditCard, MapPin, Repeat, Tag, ShieldCheck } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { api } from '../api';

// Phase 8: Customer Portal — a completely separate, lightweight app served at /portal, with its
// own login (customer phone + password, granted by an admin via "Enable Portal Access" in
// Customers) and its own token type. Not part of the staff SPA in App.jsx at all.
const GREEN = '#3FAE2A';
const GREEN_DARK = '#2d8c1e';

const statusPalette = (variant) => ({
  good: { bg: '#dcfce7', fg: '#15803d', dot: '#22c55e' },
  bad: { bg: '#fef2f2', fg: '#b91c1c', dot: '#ef4444' },
  warn: { bg: '#fffbeb', fg: '#b45309', dot: '#f59e0b' },
  info: { bg: '#dbeafe', fg: '#1d4ed8', dot: '#3b82f6' },
}[variant]);

const Badge = ({ children, variant = 'info' }) => {
  const p = statusPalette(variant);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 11px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 800, background: p.bg, color: p.fg, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.dot }} />
      {children}
    </span>
  );
};

const EmptyState = ({ icon: Icon, text }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '3.5rem 1rem', color: '#94a3b8' }}>
    <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={24} color="#cbd5e1" />
    </div>
    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{text}</div>
  </div>
);

const Card = ({ children, style }) => (
  <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #f1f5f9', boxShadow: '0 1px 2px rgba(15,23,42,0.03)', ...style }}>
    {children}
  </div>
);

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
  const isPaid = customer?.status === 'Paid';

  const inputStyle = { width: '100%', padding: '0.85rem 0.85rem 0.85rem 2.6rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.15s' };

  if (!customer) {
    return (
      <div style={{ minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '1.5rem', overflow: 'hidden' }}>
        <Toaster />
        {/* Decorative background blobs */}
        <div style={{ position: 'absolute', top: '-120px', right: '-120px', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(63,174,42,0.14) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-140px', left: '-140px', width: '420px', height: '420px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(63,174,42,0.10) 0%, transparent 70%)' }} />

        <div style={{ width: '100%', maxWidth: '400px', background: 'white', borderRadius: '24px', padding: '2.75rem 2.5rem', boxShadow: '0 25px 60px -12px rgba(15,23,42,0.15)', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '2.2rem' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.1rem', boxShadow: '0 10px 25px rgba(63,174,42,0.3)' }}>
              <Home size={30} color="white" />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>GURMAD</h1>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '4px 0 0 0', fontWeight: 600 }}>Customer Portal</p>
          </div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.3rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '7px', letterSpacing: '0.4px' }}>PHONE NUMBER</label>
              <div style={{ position: 'relative' }}>
                <User size={17} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="0634xxxxxx"
                  onFocus={e => e.target.style.borderColor = GREEN} onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '7px', letterSpacing: '0.4px' }}>PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <Lock size={17} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="********"
                  onFocus={e => e.target.style.borderColor = GREEN} onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  style={inputStyle} />
              </div>
            </div>
            <button type="submit" disabled={isLoggingIn} style={{
              padding: '0.95rem', borderRadius: '14px', border: 'none',
              background: isLoggingIn ? '#86c976' : `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`,
              color: 'white', fontWeight: 800, fontSize: '0.95rem', cursor: isLoggingIn ? 'default' : 'pointer', marginTop: '0.4rem',
              boxShadow: '0 8px 20px rgba(63,174,42,0.3)', transition: 'transform 0.1s'
            }}
              onMouseDown={e => { if (!isLoggingIn) e.currentTarget.style.transform = 'scale(0.98)'; }}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {isLoggingIn ? 'Logging in...' : 'Login'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', color: '#94a3b8', fontSize: '0.78rem', marginTop: '0.3rem' }}>
              <ShieldCheck size={14} />
              <span style={{ textAlign: 'center' }}>Login-kan waxaa kuu siiya shirkadda Gurmad marka lagu diiwaan geliyo.</span>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'payments', label: 'Payments', icon: DollarSign },
    { id: 'collections', label: 'Collections', icon: Truck },
    { id: 'complaints', label: 'Complaints', icon: MessageSquare },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'inherit' }}>
      <Toaster />
      <div style={{ background: `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`, color: 'white' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1.6rem 1.5rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 900, flexShrink: 0 }}>
              {customer.name?.[0]?.toUpperCase() || 'G'}
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', opacity: 0.85, fontWeight: 800, letterSpacing: '0.5px' }}>GURMAD CUSTOMER PORTAL</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.01em' }}>{customer.name}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: '11px', padding: '0.6rem 1.1rem', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 700, fontSize: '0.85rem' }}>
            <LogOut size={15} /> Logout
          </button>
        </div>

        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 1.5rem', display: 'flex', gap: '2px', overflowX: 'auto' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: '7px', padding: '0.75rem 1.15rem', borderRadius: '12px 12px 0 0',
              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', position: 'relative',
              background: tab === t.id ? '#f8fafc' : 'transparent',
              color: tab === t.id ? '#0f172a' : 'rgba(255,255,255,0.85)',
              fontWeight: tab === t.id ? 800 : 600, fontSize: '0.87rem'
            }}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1.75rem 1.5rem 3rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontWeight: 600 }}>Loading...</div>
        ) : tab === 'dashboard' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              {[
                { label: 'Payment Status', value: customer.status || 'Unpaid', icon: isPaid ? CheckCircle2 : Clock, variant: isPaid ? 'good' : 'bad' },
                { label: 'Outstanding', value: `$${outstandingBalance.toFixed(2)}`, icon: DollarSign, variant: outstandingBalance > 0 ? 'warn' : 'good' },
                { label: 'Monthly Fee', value: `$${parseFloat(customer.fee || 0).toFixed(2)}`, icon: CreditCard, variant: 'info' },
                { label: 'Collector', value: customer.collector_name || 'Unassigned', icon: Truck, variant: 'info', small: true },
              ].map((s, i) => {
                const p = statusPalette(s.variant);
                return (
                  <Card key={i} style={{ padding: '1.3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <s.icon size={16} color={p.fg} />
                      </div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</div>
                    </div>
                    <div style={{ fontSize: s.small ? '1.05rem' : '1.35rem', fontWeight: 900, color: '#0f172a' }}>{s.value}</div>
                  </Card>
                );
              })}
            </div>

            <Card style={{ padding: '1.4rem' }}>
              <div style={{ fontWeight: 800, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                <Tag size={16} color={GREEN} /> My Service
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
                {[
                  { label: 'Category', value: customer.category, icon: Tag },
                  { label: 'Frequency', value: customer.collection_frequency, icon: Repeat },
                  { label: 'Zone', value: customer.zone, icon: MapPin },
                  { label: 'Address', value: `House ${customer.house_no || '—'}, ${customer.area || '—'}`, icon: Home },
                ].map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start' }}>
                    <f.icon size={15} color="#94a3b8" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{f.label}</div>
                      <div style={{ fontSize: '0.88rem', color: '#334155', fontWeight: 600 }}>{f.value || '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {lastCollection && (
              <Card style={{ padding: '1.4rem' }}>
                <div style={{ fontWeight: 800, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                  <Truck size={16} color={GREEN} /> Last Collection
                </div>
                <div style={{ fontSize: '0.88rem', color: '#475569' }}>
                  {new Date(lastCollection.collected_at).toLocaleDateString()} — collected by <strong>{lastCollection.collector_name || 'N/A'}</strong>
                </div>
              </Card>
            )}
          </div>
        ) : tab === 'payments' ? (
          <Card style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1.3rem 1.4rem', borderBottom: '1px solid #f1f5f9', fontWeight: 800, color: '#0f172a' }}>Payment History</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '0.85rem 1.2rem', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, letterSpacing: '0.3px' }}>DATE</th>
                    <th style={{ padding: '0.85rem 1.2rem', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, letterSpacing: '0.3px' }}>AMOUNT</th>
                    <th style={{ padding: '0.85rem 1.2rem', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, letterSpacing: '0.3px' }}>METHOD</th>
                    <th style={{ padding: '0.85rem 1.2rem', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, letterSpacing: '0.3px' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr><td colSpan="4"><EmptyState icon={Inbox} text="No payment history yet." /></td></tr>
                  ) : payments.map((p, i) => (
                    <tr key={p.id} style={{ borderTop: '1px solid #f8fafc', background: i % 2 ? '#fcfcfd' : 'white' }}>
                      <td style={{ padding: '0.9rem 1.2rem', fontSize: '0.85rem', color: '#475569' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '0.9rem 1.2rem', fontWeight: 800, color: '#0f172a' }}>${parseFloat(p.amount).toFixed(2)}</td>
                      <td style={{ padding: '0.9rem 1.2rem', fontSize: '0.85rem', color: '#475569' }}>{p.payment_method}</td>
                      <td style={{ padding: '0.9rem 1.2rem' }}><Badge variant={p.status === 'Paid' ? 'good' : 'bad'}>{p.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : tab === 'collections' ? (
          <Card style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1.3rem 1.4rem', borderBottom: '1px solid #f1f5f9', fontWeight: 800, color: '#0f172a' }}>Collection History</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '0.85rem 1.2rem', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, letterSpacing: '0.3px' }}>DATE</th>
                    <th style={{ padding: '0.85rem 1.2rem', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, letterSpacing: '0.3px' }}>COLLECTOR</th>
                    <th style={{ padding: '0.85rem 1.2rem', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, letterSpacing: '0.3px' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.length === 0 ? (
                    <tr><td colSpan="3"><EmptyState icon={Truck} text="No collection history yet." /></td></tr>
                  ) : collections.map((c, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f8fafc', background: i % 2 ? '#fcfcfd' : 'white' }}>
                      <td style={{ padding: '0.9rem 1.2rem', fontSize: '0.85rem', color: '#475569' }}>{c.collected_at ? new Date(c.collected_at).toLocaleDateString() : '—'}</td>
                      <td style={{ padding: '0.9rem 1.2rem', fontSize: '0.85rem', color: '#475569' }}>{c.collector_name || c.driver_name || '—'}</td>
                      <td style={{ padding: '0.9rem 1.2rem' }}><Badge variant={c.collected ? 'good' : 'warn'}>{c.collected ? 'Collected' : 'Pending'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ fontWeight: 800, margin: 0, color: '#0f172a', fontSize: '1.05rem' }}>Complaints</h3>
              <button onClick={() => setShowComplaintForm(true)} style={{
                display: 'flex', alignItems: 'center', gap: '7px', padding: '0.65rem 1.15rem', borderRadius: '12px', border: 'none',
                background: `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`, color: 'white', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(63,174,42,0.28)'
              }}>
                <Plus size={16} /> New Complaint
              </button>
            </div>

            {showComplaintForm && (
              <Card style={{ padding: '1.4rem', marginBottom: '1.3rem' }}>
                <form onSubmit={handleComplaintSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#64748b', marginBottom: '7px' }}>Title</label>
                    <input required value={newComplaint.title} onChange={e => setNewComplaint({...newComplaint, title: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '0.9rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#64748b', marginBottom: '7px' }}>Description</label>
                    <textarea value={newComplaint.description} onChange={e => setNewComplaint({...newComplaint, description: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', minHeight: '90px', resize: 'vertical', boxSizing: 'border-box', fontSize: '0.9rem', fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.9rem', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setShowComplaintForm(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                    <button type="submit" style={{ padding: '0.7rem 1.4rem', borderRadius: '10px', border: 'none', background: GREEN, color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}>Submit</button>
                  </div>
                </form>
              </Card>
            )}

            {complaints.length === 0 ? (
              <Card><EmptyState icon={MessageSquare} text="No complaints submitted yet." /></Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {complaints.map(c => {
                  const variant = c.status === 'Resolved' ? 'good' : c.status === 'In Progress' ? 'info' : 'warn';
                  return (
                    <Card key={c.id} style={{ padding: '1.1rem 1.3rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>{c.title}</div>
                        <Badge variant={variant}>{c.status}</Badge>
                      </div>
                      {c.description && <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '7px', lineHeight: 1.5 }}>{c.description}</div>}
                      <div style={{ fontSize: '0.73rem', color: '#cbd5e1', marginTop: '9px', fontWeight: 600 }}>{new Date(c.created_at).toLocaleDateString()}</div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerPortalApp;
