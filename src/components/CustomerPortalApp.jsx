import React, { useState, useEffect } from 'react';
import { User, Lock, LogOut, Home, DollarSign, Truck, MessageSquare, Plus, Inbox, CheckCircle2, Clock, CreditCard, MapPin, Repeat, Tag, ShieldCheck, ChevronRight, Bell, ArrowLeft, Download, KeyRound, X, Camera, Eye, EyeOff, Globe, HelpCircle, Leaf, ArrowRight, Phone as PhoneIcon, MessageCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import jsPDF from 'jspdf';
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
  const [phone, setPhone] = useState(() => localStorage.getItem('gurmadCustomerPhone') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('gurmadCustomerPhone'));
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [tab, setTab] = useState('dashboard');

  const [payments, setPayments] = useState([]);
  const [collections, setCollections] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [newComplaint, setNewComplaint] = useState({ title: '', description: '' });
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [isChangingPw, setIsChangingPw] = useState(false);
  const [companyLogo, setCompanyLogo] = useState('');
  const [logoError, setLogoError] = useState(false);
  const [company, setCompany] = useState({ name: 'Gurmad Waste Management', phone: '', email: '' });
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = React.useRef(null);

  useEffect(() => {
    if (customer) fetchAll();
  }, [customer?.id]);

  // Company logo/name/contact — same /api/settings + /api/uploads pattern the staff sidebar
  // uses (App.jsx), fetched without auth (public route) for both the login screen and the
  // in-app receipt PDF, which needs the real company details, not placeholders.
  useEffect(() => {
    api.getSettings().then(data => {
      setCompanyLogo(data.system_logo || '');
      setCompany({ name: data.company_name || 'Gurmad Waste Management', phone: data.contact_phone || '', email: data.support_email || '' });
    }).catch(() => {});
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [me, pay, col, comp, notifs] = await Promise.all([
        api.customerPortal.getMe(),
        api.customerPortal.getPayments(),
        api.customerPortal.getCollections(),
        api.customerPortal.getComplaints(),
        api.customerPortal.getNotifications().catch(() => []),
      ]);
      const updated = { ...customer, ...me };
      setCustomer(updated);
      localStorage.setItem('gurmadCustomer', JSON.stringify(updated));
      setPayments(pay);
      setCollections(col);
      setComplaints(comp);
      setNotifications(notifs);
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('access denied')) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const openNotifications = async () => {
    setShowNotifications(true);
    if (unreadCount > 0) {
      try {
        await api.customerPortal.markAllNotificationsRead();
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      } catch (err) { /* non-critical */ }
    }
  };

  // Fetches an image URL and returns it as a data: URL, so it can be embedded in the PDF
  // (jsPDF's addImage needs a data URL or raw bytes, not a plain <img src>).
  const urlToDataURL = (url) => fetch(url)
    .then(res => res.blob())
    .then(blob => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }));

  // Real invoice/receipt PDF, generated entirely client-side with jsPDF and saved directly via
  // doc.save() — a genuine file download triggered by the click, not a new window, so it can't
  // be blocked by a pop-up blocker the way window.open()-based printing was.
  const downloadReceipt = async (p) => {
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const green = [63, 174, 42];
      const gray = [100, 116, 139];
      const dark = [15, 23, 42];
      let y = 50;

      // Logo
      if (companyLogo) {
        try {
          const dataUrl = await urlToDataURL(`/api/uploads/${companyLogo}`);
          const fmt = dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(dataUrl, fmt, 40, y - 10, 44, 44);
        } catch (e) { /* logo optional — fall through without it */ }
      }

      const textX = companyLogo ? 96 : 40;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...green);
      doc.text(company.name, textX, y + 8);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...gray);
      const contactLine = [company.phone, company.email].filter(Boolean).join('  ·  ');
      if (contactLine) doc.text(contactLine, textX, y + 24);

      y += 60;
      doc.setDrawColor(230, 230, 230); doc.line(40, y, pageWidth - 40, y);
      y += 30;

      doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...dark);
      doc.text('RECEIPT', 40, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...gray);
      doc.text(`Receipt #${p.id}`, pageWidth - 40, y - 12, { align: 'right' });
      doc.text(new Date(p.created_at).toLocaleString(), pageWidth - 40, y + 2, { align: 'right' });

      y += 30;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...gray);
      doc.text('BILL TO', 40, y);
      y += 16;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...dark);
      doc.text(customer.name || '-', 40, y);
      y += 16;
      doc.setFontSize(9); doc.setTextColor(...gray);
      doc.text(customer.phone || '-', 40, y);
      if (customer.area || customer.house_no) {
        y += 14;
        doc.text(`House ${customer.house_no || '-'}, ${customer.area || '-'}`, 40, y);
      }

      y += 34;
      doc.setDrawColor(240, 240, 240); doc.setFillColor(248, 250, 252);
      doc.rect(40, y, pageWidth - 80, 22, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...gray);
      doc.text('DESCRIPTION', 48, y + 15);
      doc.text('AMOUNT', pageWidth - 48, y + 15, { align: 'right' });
      y += 22;

      // Breakdown by payment method — only rows with a non-zero amount are printed.
      const rows = [
        ['Cash', p.cash_amount],
        ['ZAAD', p.zaad_amount],
        ['eDahab', p.edahab_amount],
        ['SLSH', p.slsh_amount],
        ['Debt (unpaid)', p.debt_amount],
      ].filter(([, amt]) => parseFloat(amt) > 0);
      if (rows.length === 0) rows.push([p.payment_method || 'Payment', p.amount]);

      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...dark);
      for (const [label, amt] of rows) {
        y += 22;
        doc.text(label, 48, y);
        doc.text(`$${parseFloat(amt).toFixed(2)}`, pageWidth - 48, y, { align: 'right' });
        doc.setDrawColor(245, 245, 245); doc.line(40, y + 8, pageWidth - 40, y + 8);
      }
      if (parseFloat(p.discount_amount) > 0) {
        y += 22;
        doc.setTextColor(...gray);
        doc.text('Discount', 48, y);
        doc.text(`-$${parseFloat(p.discount_amount).toFixed(2)}`, pageWidth - 48, y, { align: 'right' });
        doc.setDrawColor(245, 245, 245); doc.line(40, y + 8, pageWidth - 40, y + 8);
      }

      y += 34;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...gray);
      doc.text('TOTAL', 48, y);
      doc.setFontSize(18); doc.setTextColor(...green);
      doc.text(`$${parseFloat(p.amount).toFixed(2)}`, pageWidth - 48, y, { align: 'right' });

      y += 16;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(p.status === 'Paid' ? green[0] : 200, p.status === 'Paid' ? green[1] : 80, p.status === 'Paid' ? green[2] : 80);
      doc.text(`Status: ${p.status}`, pageWidth - 48, y, { align: 'right' });

      y += 60;
      doc.setDrawColor(230, 230, 230); doc.line(40, y, pageWidth - 40, y);
      y += 20;
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...gray);
      doc.text('Waan ku mahadsanahay adeegga aad naga heshay. / Thank you for your business.', 40, y);

      doc.save(`Receipt-${p.id}.pdf`);
    } catch (err) {
      toast.error('Failed to generate receipt');
    }
  };

  // Customer profile photo upload — reuses the file input pattern, no crop/preview step, just
  // pick a photo and it uploads immediately.
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const result = await api.customerPortal.uploadPhoto(formData);
      const updated = { ...customer, photo: result.photo };
      setCustomer(updated);
      localStorage.setItem('gurmadCustomer', JSON.stringify(updated));
      toast.success('Sawirkaaga waa la beddelay');
    } catch (err) {
      toast.error(err.message || 'Failed to upload photo');
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const timeAgo = (dateStr) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Hadda';
    if (mins < 60) return `${mins}m ka hor`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ka hor`;
    return `${Math.floor(hrs / 24)}d ka hor`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const data = await api.customerPortal.login(phone, password);
      localStorage.setItem('gurmadCustomer', JSON.stringify(data));
      if (rememberMe) localStorage.setItem('gurmadCustomerPhone', phone);
      else localStorage.removeItem('gurmadCustomerPhone');
      setCustomer(data);
      toast.success(`Ku soo dhawoow, ${data.name}!`);
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error('Password-yadu isku mid ma aha');
      return;
    }
    setIsChangingPw(true);
    try {
      await api.customerPortal.changePassword(pwForm.currentPassword, pwForm.newPassword);
      toast.success('Password-kaaga waa la beddelay');
      setShowChangePassword(false);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setIsChangingPw(false);
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
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>

            {/* Hero */}
            <div style={{ background: `linear-gradient(160deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`, padding: '1.3rem 1.5rem 3.2rem', textAlign: 'center', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ position: 'absolute', bottom: '20px', left: '-50px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

              {/* top bar: language + help */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1, marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '100px', padding: '6px 12px', color: 'white', fontSize: '0.78rem', fontWeight: 800 }}>
                  <Globe size={13} /> SO
                </div>
                <button
                  onClick={() => toast(company.phone || company.email ? `Caawimo: ${[company.phone, company.email].filter(Boolean).join(' · ')}` : 'La xiriir shirkadda Gurmad si aad u hesho caawimo.', { icon: '💬' })}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '100px', padding: '6px 12px', color: 'white', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  <HelpCircle size={13} /> Caawin
                </button>
              </div>

              <div style={{ width: '88px', height: '88px', borderRadius: '24px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.6rem auto 1rem', boxShadow: '0 10px 26px rgba(0,0,0,0.18)', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
                {companyLogo && !logoError ? (
                  <img src={`/api/uploads/${companyLogo}`} alt="Gurmad" onError={() => setLogoError(true)} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '10px', boxSizing: 'border-box' }} />
                ) : (
                  <Home size={36} color={GREEN} />
                )}
              </div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0, color: 'white', letterSpacing: '-0.02em', position: 'relative', zIndex: 1 }}>GURMAD</h1>
              <p style={{ color: '#d9f7cf', fontSize: '1.05rem', margin: '2px 0 0 0', fontWeight: 800, position: 'relative', zIndex: 1 }}>Customer Portal</p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', margin: '14px 0', position: 'relative', zIndex: 1 }}>
                <span style={{ width: '30px', height: '1px', background: 'rgba(255,255,255,0.4)' }} />
                <Leaf size={14} color="rgba(255,255,255,0.7)" />
                <span style={{ width: '30px', height: '1px', background: 'rgba(255,255,255,0.4)' }} />
              </div>
              <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.88rem', margin: 0, lineHeight: 1.5, position: 'relative', zIndex: 1, maxWidth: '280px', marginLeft: 'auto', marginRight: 'auto' }}>
                Ku soo dhaweow nidaamka casriga ah ee maamulka qashinka Gurmad
              </p>
            </div>

            {/* White sheet overlapping the hero, rounded top corners */}
            <div style={{ background: 'white', borderRadius: '28px 28px 0 0', marginTop: '-22px', position: 'relative', zIndex: 2, padding: '2rem 1.6rem 1.8rem', flex: 1 }}>
              <div style={{ width: '58px', height: '58px', borderRadius: '18px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <ShieldCheck size={26} color={GREEN} />
              </div>
              <h2 style={{ textAlign: 'center', fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>Ku soo dhawoow!</h2>
              <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1.6rem', lineHeight: 1.5 }}>Fadlan geli akoonkaaga si aad u adeegato portal-ka.</p>

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: GREEN_DARK, marginBottom: '8px', letterSpacing: '0.3px' }}>LAMBARKA TELEFOONKA</label>
                  <div style={{ position: 'relative' }}>
                    <PhoneIcon size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: GREEN }} />
                    <input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="0634xxxxxx"
                      onFocus={e => { e.target.style.borderColor = GREEN; e.target.style.background = 'white'; }}
                      onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                      style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: GREEN_DARK, marginBottom: '8px', letterSpacing: '0.3px' }}>PASSWORD</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: GREEN }} />
                    <input required type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="********"
                      onFocus={e => { e.target.style.borderColor = GREEN; e.target.style.background = 'white'; }}
                      onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                      style={{ ...inputStyle, paddingRight: '2.6rem' }} />
                    <button type="button" onClick={() => setShowPassword(s => !s)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}>
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '-0.3rem 0 0.1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>
                    <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                      style={{ width: '17px', height: '17px', accentColor: GREEN, cursor: 'pointer' }} />
                    Xusuusnow akoonkayga
                  </label>
                  <button type="button" onClick={() => toast('Fadlan la xiriir shirkadda Gurmad si loo dib-u-deeqo password-kaaga.', { icon: '🔑' })} style={{ background: 'none', border: 'none', color: GREEN_DARK, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                    Ihlaaw Password-ka?
                  </button>
                </div>

                <button type="submit" disabled={isLoggingIn} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                  padding: '1.05rem', borderRadius: '18px', border: 'none',
                  background: isLoggingIn ? '#86c976' : `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`,
                  color: 'white', fontWeight: 800, fontSize: '1rem', cursor: isLoggingIn ? 'default' : 'pointer', marginTop: '0.3rem',
                  boxShadow: '0 10px 24px rgba(63,174,42,0.32)'
                }}>
                  {isLoggingIn ? 'Logging in...' : (<><Lock size={16} /> Login <ArrowRight size={16} /></>)}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '0.3rem 0' }}>
                  <span style={{ flex: 1, height: '1px', background: '#f1f5f9' }} />
                  <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 800 }}>AMA</span>
                  <span style={{ flex: 1, height: '1px', background: '#f1f5f9' }} />
                </div>

                <button type="button" onClick={() => toast('SMS Code login weli lama hirgeliyay — fadlan isticmaal password-kaaga.', { icon: 'ℹ️' })} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                  padding: '1rem', borderRadius: '18px', border: '1.5px solid #e2e8f0', background: 'white',
                  color: GREEN_DARK, fontWeight: 800, fontSize: '0.92rem', cursor: 'pointer'
                }}>
                  <MessageCircle size={17} /> Login with SMS Code
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#f0fdf4', borderRadius: '16px', padding: '0.9rem 1rem', marginTop: '1.4rem' }}>
                <ShieldCheck size={18} color={GREEN} style={{ flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#15803d' }}>Nidaam ammaan ah oo lagu kalsoon yahay</div>
                  <div style={{ fontSize: '0.76rem', color: '#4d7c0f', marginTop: '2px' }}>Data-gaaga waa mid ammaan ah oo qarsoon.</div>
                </div>
              </div>
            </div>
          </div>
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
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '13px', background: customer.photo ? '#f1f5f9' : `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.1rem', fontWeight: 900, overflow: 'hidden' }}>
                {customer.photo ? (
                  <img src={`/api/uploads/${customer.photo}`} alt={customer.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (customer.name?.[0]?.toUpperCase() || 'G')}
              </div>
              <button onClick={() => photoInputRef.current?.click()} disabled={isUploadingPhoto} title="Beddel sawirka" style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', border: '2px solid #f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                <Camera size={9} color={GREEN} />
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </div>
            <button onClick={() => setShowChangePassword(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>Ku soo dhawoow</div>
              <div style={{ fontSize: '1.02rem', fontWeight: 800, color: '#0f172a' }}>{customer.name}</div>
            </button>
          </div>
          <div style={{ display: 'flex', gap: '9px' }}>
            <button onClick={openNotifications} style={{ position: 'relative', width: '38px', height: '38px', borderRadius: '12px', background: 'white', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
              <Bell size={16} color="#64748b" />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', minWidth: '17px', height: '17px', borderRadius: '9px', background: '#ef4444', color: 'white', fontSize: '0.62rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid #f8fafc' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button onClick={handleLogout} style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'white', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
              <LogOut size={16} color="#64748b" />
            </button>
          </div>
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

              {customer.next_pickup && (
                <Card style={{ padding: '1.2rem 1.3rem', display: 'flex', alignItems: 'center', gap: '13px', background: customer.next_pickup.isToday ? '#f0fdf4' : 'white', border: customer.next_pickup.isToday ? '1px solid #bbf7d0' : '1px solid #f1f5f9' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: customer.next_pickup.isToday ? GREEN : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Truck size={19} color={customer.next_pickup.isToday ? 'white' : GREEN} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Booqashada Xigta</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                      {customer.next_pickup.isToday ? 'Maanta' : new Date(customer.next_pickup.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                      {customer.next_pickup.time && <span style={{ color: '#94a3b8', fontWeight: 600 }}> · {customer.next_pickup.time}</span>}
                    </div>
                  </div>
                </Card>
              )}

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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Badge variant={p.status === 'Paid' ? 'good' : 'bad'}>{p.status}</Badge>
                        {p.status === 'Paid' && (
                          <button onClick={() => downloadReceipt(p)} title="Download Receipt" style={{ width: '30px', height: '30px', borderRadius: '10px', border: '1px solid #f1f5f9', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Download size={13} color="#64748b" />
                          </button>
                        )}
                      </div>
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
                        {c.admin_reply && (
                          <div style={{ marginTop: '10px', padding: '0.8rem', borderRadius: '13px', background: '#eff6ff', border: '1px solid #dbeafe' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1d4ed8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Jawaabta Gurmad</div>
                            <div style={{ fontSize: '0.83rem', color: '#1e3a5f', lineHeight: 1.5 }}>{c.admin_reply}</div>
                          </div>
                        )}
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

        {/* Notifications panel */}
        {showNotifications && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => setShowNotifications(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#f8fafc', borderRadius: '26px 26px 0 0', maxHeight: '78%', display: 'flex', flexDirection: 'column', boxShadow: '0 -10px 40px rgba(15,23,42,0.2)' }}>
              <div style={{ padding: '1.2rem 1.3rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={18} color={GREEN} /> Ogeysiisyada
                </div>
                <button onClick={() => setShowNotifications(false)} style={{ width: '30px', height: '30px', borderRadius: '10px', border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b', fontWeight: 700 }}>✕</button>
              </div>
              <div style={{ overflowY: 'auto', padding: '0.8rem 1.3rem 1.6rem' }}>
                {notifications.length === 0 ? (
                  <EmptyState icon={Bell} text="Ogeysiis kuma jiro weli" />
                ) : notifications.map(n => (
                  <div key={n.id} style={{ display: 'flex', gap: '11px', padding: '0.9rem 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '11px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Bell size={16} color={GREEN} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{n.title}</div>
                      {n.message && <div style={{ fontSize: '0.82rem', color: '#64748b', margin: '3px 0 0 0' }}>{n.message}</div>}
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '5px', fontWeight: 600 }}>{timeAgo(n.created_at)}</div>
                    </div>
                    {!n.is_read && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: GREEN, flexShrink: 0, marginTop: '5px' }} />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Change Password panel */}
        {showChangePassword && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => setShowChangePassword(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '26px 26px 0 0', boxShadow: '0 -10px 40px rgba(15,23,42,0.2)' }}>
              <div style={{ padding: '1.2rem 1.3rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <KeyRound size={18} color={GREEN} /> Beddel Password
                </div>
                <button onClick={() => setShowChangePassword(false)} style={{ width: '30px', height: '30px', borderRadius: '10px', border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b' }}><X size={15} /></button>
              </div>
              <form onSubmit={handleChangePassword} style={{ padding: '1.3rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#64748b', marginBottom: '7px' }}>Password-ka hadda</label>
                  <input required type="password" value={pwForm.currentPassword} onChange={e => setPwForm({...pwForm, currentPassword: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '13px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '0.9rem', background: '#f8fafc' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#64748b', marginBottom: '7px' }}>Password cusub (ugu yaraan 6 xaraf)</label>
                  <input required minLength={6} type="password" value={pwForm.newPassword} onChange={e => setPwForm({...pwForm, newPassword: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '13px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '0.9rem', background: '#f8fafc' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#64748b', marginBottom: '7px' }}>Ku celi password-ka cusub</label>
                  <input required minLength={6} type="password" value={pwForm.confirmPassword} onChange={e => setPwForm({...pwForm, confirmPassword: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '13px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '0.9rem', background: '#f8fafc' }} />
                </div>
                <button type="submit" disabled={isChangingPw} style={{ padding: '0.9rem', borderRadius: '16px', border: 'none', background: isChangingPw ? '#86c976' : GREEN, color: 'white', fontWeight: 800, fontSize: '0.95rem', cursor: isChangingPw ? 'default' : 'pointer', marginTop: '0.3rem' }}>
                  {isChangingPw ? 'Beddelaya...' : 'Beddel Password'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerPortalApp;
