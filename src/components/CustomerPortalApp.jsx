import React, { useState, useEffect } from 'react';
import { User, Lock, LogOut, Home, DollarSign, Truck, MessageSquare, Plus, Inbox, CheckCircle2, Clock, CreditCard, MapPin, Repeat, Tag, ShieldCheck, ChevronRight, Bell, ArrowLeft } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { api } from '../api';

// Phase 8: Customer Portal — a completely separate, lightweight app served at /portal, with its
// own login (customer phone + password, granted by an admin via "Enable Portal Access" in
// Customers) and its own token type. Not part of the staff SPA in App.jsx at all.
//
// Redesign: mobile-app layout — phone-width column even on desktop, fixed bottom tab bar,
// big hero balance card, generous rounded corners and touch targets.
const GREEN = '#3FAE2A';
const GREEN_DARK = '#2d8c1e';
const PHONE_WIDTH = '430px';

const statusPalette = (variant) => ({
  good: { bg: '#dcfce7', fg: '#15803d', dot: '#22c55e' },
  bad: { bg: '#fef2f2', fg: '#b91c1c', dot: '#ef4444' },
  warn: { bg: '#fffbeb', fg: '#b45309', dot: '#f59e0b' },
  info: { bg: '#dbeafe', fg: '#1d4ed8', dot: '#3b82f6' },
}[variant]);

const Badge = ({ children, variant = 'info' }) => {
  const p = statusPalette(variant);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 11px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800, background: p.bg, color: p.fg, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.dot }} />
      {children}
    </span>
  );
};

const EmptyState = ({ icon: Icon, text }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '3rem 1rem', color: '#94a3b8' }}>
    <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={26} color="#cbd5e1" />
    </div>
    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{text}</div>
  </div>
);

const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{ background: 'white', borderRadius: '22px', border: '1px solid #f1f5f9', boxShadow: '0 2px 10px rgba(15,23,42,0.04)', ...style }}>
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

  const inputStyle = { width: '100%', padding: '0.9rem 0.9rem 0.9rem 2.7rem', borderRadius: '16px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '1rem', outline: 'none', transition: 'border-color 0.15s', background: '#f8fafc' };

  // ============ LOGIN SCREEN ============
  if (!customer) {
    return (
      <div style={{ minHeight: '100vh', background: '#eef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <Toaster />
        <div style={{ width: '100%', maxWidth: PHONE_WIDTH, minHeight: '100vh', maxHeight: '900px', background: 'white', borderRadius: '32px', boxShadow: '0 30px 70px -15px rgba(15,23,42,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: `linear-gradient(160deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`, padding: '3.5rem 2rem 3rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ position: 'absolute', bottom: '-80px', left: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.2rem', position: 'relative', zIndex: 1 }}>
              <Home size={34} color="white" />
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, color: 'white', letterSpacing: '-0.02em', position: 'relative', zIndex: 1 }}>GURMAD</h1>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', margin: '4px 0 0 0', fontWeight: 600, position: 'relative', zIndex: 1 }}>Customer Portal</p>
          </div>

          <form onSubmit={handleLogin} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.3rem', padding: '2.2rem 1.8rem', justifyContent: 'center' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', letterSpacing: '0.3px' }}>PHONE NUMBER</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="0634xxxxxx"
                  onFocus={e => { e.target.style.borderColor = GREEN; e.target.style.background = 'white'; }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                  style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', letterSpacing: '0.3px' }}>PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="********"
                  onFocus={e => { e.target.style.borderColor = GREEN; e.target.style.background = 'white'; }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                  style={inputStyle} />
              </div>
            </div>
            <button type="submit" disabled={isLoggingIn} style={{
              padding: '1.05rem', borderRadius: '18px', border: 'none',
              background: isLoggingIn ? '#86c976' : GREEN,
              color: 'white', fontWeight: 800, fontSize: '1rem', cursor: isLoggingIn ? 'default' : 'pointer', marginTop: '0.5rem',
              boxShadow: '0 10px 24px rgba(63,174,42,0.32)'
            }}>
              {isLoggingIn ? 'Logging in...' : 'Login'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', color: '#94a3b8', fontSize: '0.78rem', marginTop: '0.4rem' }}>
              <ShieldCheck size={14} />
              <span style={{ textAlign: 'center' }}>Login-kan waxaa kuu siiya shirkadda Gurmad marka lagu diiwaan geliyo.</span>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ============ APP SHELL ============
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'payments', label: 'Payments', icon: DollarSign },
    { id: 'collections', label: 'Pickups', icon: Truck },
    { id: 'complaints', label: 'Support', icon: MessageSquare },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#eef2f2', display: 'flex', justifyContent: 'center' }}>
      <Toaster />
      <div style={{ width: '100%', maxWidth: PHONE_WIDTH, minHeight: '100vh', background: '#f8fafc', boxShadow: '0 0 60px rgba(15,23,42,0.08)', display: 'flex', flexDirection: 'column', position: 'relative' }}>

        {/* Status-bar style header */}
        <div style={{ padding: '1.4rem 1.3rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '13px', background: `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.1rem', fontWeight: 900, flexShrink: 0 }}>
              {customer.name?.[0]?.toUpperCase() || 'G'}
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>Ku soo dhawoow</div>
              <div style={{ fontSize: '1.02rem', fontWeight: 800, color: '#0f172a' }}>{customer.name}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'white', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
            <LogOut size={16} color="#64748b" />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.3rem 1.3rem 1rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontWeight: 600 }}>Loading...</div>
          ) : tab === 'dashboard' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {/* Hero balance card */}
              <div style={{ background: `linear-gradient(160deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`, borderRadius: '26px', padding: '1.8rem', color: 'white', position: 'relative', overflow: 'hidden', boxShadow: '0 15px 35px -8px rgba(63,174,42,0.4)' }}>
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.85, fontWeight: 700, marginBottom: '6px' }}>OUTSTANDING BALANCE</div>
                    <div style={{ fontSize: '2.1rem', fontWeight: 900, letterSpacing: '-0.02em' }}>${outstandingBalance.toFixed(2)}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '12px', padding: '6px 12px', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {isPaid ? <CheckCircle2 size={13} /> : <Clock size={13} />} {customer.status || 'Unpaid'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.3rem', position: 'relative', zIndex: 1 }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', opacity: 0.8, fontWeight: 700 }}>MONTHLY FEE</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800 }}>${parseFloat(customer.fee || 0).toFixed(2)}</div>
                  </div>
                  <div style={{ width: '1px', background: 'rgba(255,255,255,0.25)' }} />
                  <div>
                    <div style={{ fontSize: '0.68rem', opacity: 0.8, fontWeight: 700 }}>COLLECTOR</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800 }}>{customer.collector_name || 'Unassigned'}</div>
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem' }}>
                {[
                  { label: 'Payments', icon: DollarSign, action: () => setTab('payments') },
                  { label: 'Pickups', icon: Truck, action: () => setTab('collections') },
                  { label: 'Support', icon: MessageSquare, action: () => setTab('complaints') },
                  { label: 'New Issue', icon: Plus, action: () => { setTab('complaints'); setShowComplaintForm(true); } },
                ].map((qa, i) => (
                  <button key={i} onClick={qa.action} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', background: 'white', border: '1px solid #f1f5f9', borderRadius: '18px', padding: '0.9rem 0.4rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <qa.icon size={17} color={GREEN} />
                    </div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', textAlign: 'center' }}>{qa.label}</span>
                  </button>
                ))}
              </div>

              <Card style={{ padding: '1.3rem' }}>
                <div style={{ fontWeight: 800, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontSize: '0.95rem' }}>
                  <Tag size={16} color={GREEN} /> My Service
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                  {[
                    { label: 'Category', value: customer.category, icon: Tag },
                    { label: 'Frequency', value: customer.collection_frequency, icon: Repeat },
                    { label: 'Zone', value: customer.zone, icon: MapPin },
                    { label: 'Address', value: `House ${customer.house_no || '—'}, ${customer.area || '—'}`, icon: Home },
                  ].map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: '11px', alignItems: 'center' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <f.icon size={14} color="#94a3b8" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{f.label}</div>
                        <div style={{ fontSize: '0.88rem', color: '#334155', fontWeight: 700 }}>{f.value || '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {lastCollection && (
                <Card style={{ padding: '1.3rem' }}>
                  <div style={{ fontWeight: 800, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontSize: '0.95rem' }}>
                    <Truck size={16} color={GREEN} /> Last Collection
                  </div>
                  <div style={{ fontSize: '0.88rem', color: '#475569' }}>
                    {new Date(lastCollection.collected_at).toLocaleDateString()} — collected by <strong>{lastCollection.collector_name || 'N/A'}</strong>
                  </div>
                </Card>
              )}
            </div>
          ) : tab === 'payments' ? (
            <div>
              <h3 style={{ fontWeight: 900, marginBottom: '1rem', color: '#0f172a', fontSize: '1.15rem' }}>Payment History</h3>
              {payments.length === 0 ? (
                <Card><EmptyState icon={Inbox} text="No payment history yet." /></Card>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                  {payments.map(p => (
                    <Card key={p.id} style={{ padding: '1rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: p.status === 'Paid' ? '#f0fdf4' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <DollarSign size={16} color={p.status === 'Paid' ? GREEN : '#ef4444'} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>${parseFloat(p.amount).toFixed(2)}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>{p.payment_method} • {new Date(p.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <Badge variant={p.status === 'Paid' ? 'good' : 'bad'}>{p.status}</Badge>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : tab === 'collections' ? (
            <div>
              <h3 style={{ fontWeight: 900, marginBottom: '1rem', color: '#0f172a', fontSize: '1.15rem' }}>Collection History</h3>
              {collections.length === 0 ? (
                <Card><EmptyState icon={Truck} text="No collection history yet." /></Card>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                  {collections.map((c, i) => (
                    <Card key={i} style={{ padding: '1rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: c.collected ? '#f0fdf4' : '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Truck size={16} color={c.collected ? GREEN : '#f59e0b'} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>{c.collector_name || c.driver_name || 'Unassigned'}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>{c.collected_at ? new Date(c.collected_at).toLocaleDateString() : 'Not yet scheduled'}</div>
                        </div>
                      </div>
                      <Badge variant={c.collected ? 'good' : 'warn'}>{c.collected ? 'Collected' : 'Pending'}</Badge>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
                <h3 style={{ fontWeight: 900, margin: 0, color: '#0f172a', fontSize: '1.15rem' }}>Support</h3>
                <button onClick={() => setShowComplaintForm(true)} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '0.6rem 1rem', borderRadius: '14px', border: 'none',
                  background: GREEN, color: 'white', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer',
                  boxShadow: '0 6px 16px rgba(63,174,42,0.28)'
                }}>
                  <Plus size={15} /> New
                </button>
              </div>

              {showComplaintForm && (
                <Card style={{ padding: '1.3rem', marginBottom: '1.1rem' }}>
                  <form onSubmit={handleComplaintSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#64748b', marginBottom: '7px' }}>Title</label>
                      <input required value={newComplaint.title} onChange={e => setNewComplaint({...newComplaint, title: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '13px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '0.9rem', background: '#f8fafc' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#64748b', marginBottom: '7px' }}>Description</label>
                      <textarea value={newComplaint.description} onChange={e => setNewComplaint({...newComplaint, description: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '13px', border: '1.5px solid #e2e8f0', minHeight: '85px', resize: 'vertical', boxSizing: 'border-box', fontSize: '0.9rem', fontFamily: 'inherit', background: '#f8fafc' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => setShowComplaintForm(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                      <button type="submit" style={{ padding: '0.7rem 1.4rem', borderRadius: '13px', border: 'none', background: GREEN, color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}>Submit</button>
                    </div>
                  </form>
                </Card>
              )}

              {complaints.length === 0 ? (
                <Card><EmptyState icon={MessageSquare} text="No complaints submitted yet." /></Card>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                  {complaints.map(c => {
                    const variant = c.status === 'Resolved' ? 'good' : c.status === 'In Progress' ? 'info' : 'warn';
                    return (
                      <Card key={c.id} style={{ padding: '1.1rem 1.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>{c.title}</div>
                          <Badge variant={variant}>{c.status}</Badge>
                        </div>
                        {c.description && <div style={{ fontSize: '0.83rem', color: '#64748b', marginTop: '7px', lineHeight: 1.5 }}>{c.description}</div>}
                        <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '9px', fontWeight: 600 }}>{new Date(c.created_at).toLocaleDateString()}</div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed bottom tab bar */}
        <div style={{ display: 'flex', background: 'white', borderTop: '1px solid #f1f5f9', padding: '0.6rem 0.5rem calc(0.6rem + env(safe-area-inset-bottom, 0px))', boxShadow: '0 -4px 16px rgba(15,23,42,0.04)' }}>
          {tabs.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => { setTab(t.id); setShowComplaintForm(false); }} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 0.2rem', borderRadius: '14px'
              }}>
                <div style={{ width: '38px', height: '30px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? '#f0fdf4' : 'transparent', transition: 'background 0.15s' }}>
                  <t.icon size={19} color={active ? GREEN : '#94a3b8'} strokeWidth={active ? 2.4 : 2} />
                </div>
                <span style={{ fontSize: '0.65rem', fontWeight: active ? 800 : 600, color: active ? GREEN : '#94a3b8' }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CustomerPortalApp;
