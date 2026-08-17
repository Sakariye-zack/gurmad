import React, { useState, useEffect, useRef } from 'react';
import { LogOut, Truck, Wallet, Users, Receipt, Sparkles, LayoutDashboard, Map as MapIcon, MessageSquare, ClipboardList, Fingerprint, Grid3x3, ArrowLeft, ChevronRight, Bell, Camera, X, KeyRound, User as UserIcon, Phone as PhoneIcon, Globe } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { api } from '../api';
import { useLanguage } from '../contexts/LanguageContext';
import DashboardView from './DashboardView';
import MyRouteTodayView from './MyRouteTodayView';
import TodaysCollectionsView from './TodaysCollectionsView';
import BillingView from './BillingView';
import CashoutView from './CashoutView';
import MapView from './MapView';
import CustomerView from './CustomerView';
import ComplaintsView from './ComplaintsView';
import DebtView from './DebtView';
import ExpenseView from './ExpenseView';
import AttendanceView from './AttendanceView';

// Staff Portal — a lightweight, mobile-first landing spot for Collector and Cashier accounts,
// separate from the full desktop admin SPA (which is now reserved for admin/gudoomiye/
// zone_accountant). Rather than rebuilding collection/payment logic from scratch, this wraps the
// same battle-tested views the desktop app already used for these roles in a phone-width shell
// that mirrors the Customer Portal's look — gradient hero, white overlapping sheet, bottom tabs,
// generous touch targets — since these staff are using it out in the field on their own phones,
// not at a desk. The reused views themselves are left untouched (they're shared with admin's own
// use of them elsewhere in the desktop app) — all the polish here lives in the shell around them.
//
// Every destination here mirrors a menu item the desktop sidebar already granted this role
// (see App.jsx's menuGroups roles arrays) — nothing new is exposed. One deliberate exception:
// Payroll (also granted to 'cashier' in the desktop menu) is left out of this mobile portal —
// salary data/payroll processing is sensitive enough that it stays behind the full Admin Portal
// rather than a field-facing phone screen, even though the role technically has the permission.
const GREEN = '#3FAE2A';
const GREEN_DARK = '#2d8c1e';
const PHONE_WIDTH = '480px';

// Built from the shared translations.js dictionary (staff_* keys) via useLanguage()'s t(), so
// switching language updates every tab label/title/subtitle in this shell at once — and, as a
// bonus, every reused desktop view (DashboardView, BillingView, CustomerView, ...) that already
// calls the same t() internally picks up the switch too, since LanguageProvider wraps the whole
// app from main.jsx down.
const getTabMeta = (t) => ({
  home: { label: t('staff_home'), icon: LayoutDashboard, title: t('staff_overview'), subtitle: t('staff_overview_sub') },
  route: { label: t('staff_my_route'), icon: Truck, title: t('staff_todays_route'), subtitle: t('staff_todays_route_sub') },
  collections: { label: t('staff_collections'), icon: Users, title: t('staff_todays_collections'), subtitle: t('staff_todays_collections_sub') },
  billing: { label: t('staff_collect_payment'), icon: Receipt, title: t('staff_collect_payment'), subtitle: t('staff_collect_payment_sub') },
  cashout: { label: t('staff_cashout'), icon: Wallet, title: t('staff_cashout'), subtitle: t('staff_cashout_sub') },
  map: { label: t('staff_map'), icon: MapIcon, title: t('staff_map'), subtitle: t('staff_map_sub') },
  customers: { label: t('staff_customers'), icon: Users, title: t('staff_customers'), subtitle: t('staff_customers_sub') },
  attendance: { label: t('staff_attendance'), icon: Fingerprint, title: t('staff_attendance'), subtitle: t('staff_attendance_sub') },
  complaints: { label: t('staff_complaints'), icon: MessageSquare, title: t('staff_complaints'), subtitle: t('staff_complaints_sub') },
  debts: { label: t('staff_debts'), icon: ClipboardList, title: t('staff_debts'), subtitle: t('staff_debts_sub') },
  expenses: { label: t('staff_expenses'), icon: Wallet, title: t('staff_expenses'), subtitle: t('staff_expenses_sub') },
  transactions: { label: t('staff_transactions'), icon: Receipt, title: t('staff_transactions'), subtitle: t('staff_transactions_sub') },
  more: { label: t('staff_more'), icon: Grid3x3, title: t('staff_more'), subtitle: t('staff_more_sub') },
});

// A cashier's day is dominated by Collections/Payment/Cashout, so those stay on the bottom bar;
// the rest of what they're permitted to see (same roles as the desktop sidebar granted, plus
// Attendance and a dedicated Transactions shortcut) lives one tap away behind "More" rather than
// crowding a 9-icon bottom bar. A collector only has a handful of destinations total, so theirs
// go straight on the bar.
const CASHIER_MORE = ['transactions', 'customers', 'complaints', 'debts', 'expenses', 'attendance', 'map'];

const StaffPortalApp = ({ currentUser, onLogout, onUpdateUser }) => {
  // Same LanguageContext (and same 'gurmad_language' localStorage key) the desktop Admin app
  // uses — a staff member's language choice here is remembered the same way, on the same shared
  // browser session, as an admin's would be.
  const { currentLanguage, setLanguage, t } = useLanguage();
  const toggleLang = () => setLanguage(currentLanguage === 'so' ? 'en' : 'so');
  const TAB_META = getTabMeta(t);
  const isCollector = currentUser?.role === 'collector';
  const primaryTabs = isCollector
    ? ['home', 'route', 'customers', 'attendance', 'map']
    : ['home', 'collections', 'billing', 'cashout', 'more'];
  const [tab, setTab] = useState(primaryTabs[0]);
  const [moreView, setMoreView] = useState(null);
  const [billingPrefillPhone, setBillingPrefillPhone] = useState(null);
  const [isMobileViewport] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 480);
  const activeId = tab === 'more' && moreView ? moreView : tab;
  const meta = TAB_META[activeId];
  const isMapView = activeId === 'map';
  const name = currentUser?.full_name || currentUser?.username || '';
  const initial = name[0]?.toUpperCase() || (isCollector ? 'C' : '$');

  // Notifications — the desktop app's own bell (GET /api/users/:id/notifications) already works
  // for any authenticated staff account, it just had no UI here. Polled the same way the desktop
  // header does.
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  useEffect(() => {
    if (!currentUser?.id) return;
    const fetchNotifs = () => api.getNotifications(currentUser.id).then(setNotifications).catch(() => {});
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const openNotifications = async () => {
    setShowNotifications(true);
    if (unreadCount > 0) {
      try {
        await api.markAllNotificationsRead(currentUser.id);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      } catch (err) { /* non-critical */ }
    }
  };
  const timeAgo = (dateStr) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'Now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  // Account panel — self-service name/photo/password, all through the same
  // POST /api/auth/update_profile the desktop app's own profile editor uses (self-or-admin
  // guarded server-side, and now audit-logged there too so an admin can see what changed).
  const [showAccount, setShowAccount] = useState(false);
  const [accountName, setAccountName] = useState(name);
  const [accountPhones, setAccountPhones] = useState({ telesom: currentUser?.phone_telesom || '', somtel: currentUser?.phone_somtel || '' });
  const [accountPw, setAccountPw] = useState({ password: '', confirm: '' });
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);
  useEffect(() => { setAccountName(name); }, [name]);
  useEffect(() => { setAccountPhones({ telesom: currentUser?.phone_telesom || '', somtel: currentUser?.phone_somtel || '' }); }, [currentUser?.phone_telesom, currentUser?.phone_somtel]);

  const submitProfile = async (extra = {}) => {
    const formData = new FormData();
    formData.append('id', currentUser.id);
    formData.append('username', currentUser.username);
    formData.append('full_name', accountName);
    formData.append('phone_telesom', accountPhones.telesom);
    formData.append('phone_somtel', accountPhones.somtel);
    if (extra.password) formData.append('password', extra.password);
    if (extra.photo) formData.append('profile_image', extra.photo);
    const res = await api.updateProfile(formData);
    if (res.error) throw new Error(res.error);
    onUpdateUser?.(res.user);
    return res;
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      await submitProfile({ photo: file });
      toast.success('Photo updated');
    } catch (err) {
      toast.error(err.message || 'Failed to upload photo');
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    if (accountPw.password && accountPw.password !== accountPw.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (accountPw.password && accountPw.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setIsSavingAccount(true);
    try {
      await submitProfile(accountPw.password ? { password: accountPw.password } : {});
      toast.success('Account updated');
      setAccountPw({ password: '', confirm: '' });
      setShowAccount(false);
    } catch (err) {
      toast.error(err.message || 'Failed to update account');
    } finally {
      setIsSavingAccount(false);
    }
  };

  // Only DashboardView's collector branch needs this (its 'My Performance' stats are computed
  // from myTodayRoute) — same data MyRouteTodayView fetches for itself, kept as a separate poll
  // here just like the desktop App.jsx used to do for the same reason (DashboardView doesn't fetch
  // it internally, it's always been passed in as a prop).
  const [myTodayRoute, setMyTodayRoute] = useState([]);
  useEffect(() => {
    if (!isCollector) return;
    const fetchRoute = () => api.getMyTodayRoute().then(data => setMyTodayRoute(data.customers || [])).catch(() => {});
    fetchRoute();
    const interval = setInterval(fetchRoute, 60000);
    return () => clearInterval(interval);
  }, [isCollector]);

  const goTab = (id) => { setTab(id); setMoreView(null); };

  // DashboardView's Quick Actions buttons (Add Customer / Create Invoice / Log Expense) dispatch
  // a 'switchTab' window event — the desktop App.jsx listens for it directly, but nothing did in
  // this portal, so those buttons were silently dead here. Maps the same event onto this portal's
  // own tab/more-view state: destinations on the primary bar navigate directly, destinations
  // tucked under "More" (cashier only) open there instead.
  useEffect(() => {
    const handler = (e) => {
      const id = e.detail;
      if (primaryTabs.includes(id)) { goTab(id); return; }
      if (!isCollector && CASHIER_MORE.includes(id)) { setTab('more'); setMoreView(id); }
    };
    window.addEventListener('switchTab', handler);
    return () => window.removeEventListener('switchTab', handler);
  }, [isCollector]);

  // Desktop-oriented views (tables, multi-column forms, charts) are reused as-is inside a
  // horizontally-scrollable container rather than redesigned, so nothing overflows the phone
  // screen while every existing validation/audit-log path stays exactly as tested — money-
  // handling and permission-scoped data are exactly the kind of logic that shouldn't be
  // reimplemented casually. The right-edge fade (sp-hscroll) replaces what was previously an
  // abrupt hard cut mid-card with no hint there was more to scroll to.
  const scrolled = (node) => <div className="sp-hscroll" style={{ overflowX: 'auto' }}>{node}</div>;

  // "Transactions" reuses the exact same BillingView already shown under Collect Payment — it
  // already has a full, zone-scoped, exportable Live Transactions table, just buried below the
  // payment form. Rather than duplicate that table in a new component, this entry point scrolls
  // straight past the form to it on open, so it reads as its own dedicated screen.
  useEffect(() => {
    if (tab !== 'more' || moreView !== 'transactions') return;
    // BillingView fetches its own data on mount, so the Live Transactions heading doesn't exist
    // in the DOM immediately — poll briefly instead of a single fixed-delay guess that could fire
    // before the table (and the page height it adds) has actually rendered.
    let tries = 0;
    const interval = setInterval(() => {
      const heading = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Live Transactions'));
      if (heading) {
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        clearInterval(interval);
      } else if (++tries > 20) {
        clearInterval(interval);
      }
    }, 150);
    return () => clearInterval(interval);
  }, [tab, moreView]);

  const renderView = (id) => {
    switch (id) {
      case 'home': return scrolled(<DashboardView currentUser={currentUser} myTodayRoute={myTodayRoute} />);
      case 'route': return <MyRouteTodayView />;
      case 'collections': return <TodaysCollectionsView currentUser={currentUser} onCollectPayment={(phone) => { setBillingPrefillPhone(phone); goTab('billing'); }} />;
      case 'billing': case 'transactions':
        return scrolled(<BillingView currentUser={currentUser} prefillCustomerPhone={billingPrefillPhone} onPrefillHandled={() => setBillingPrefillPhone(null)} />);
      case 'cashout': return scrolled(<CashoutView currentUser={currentUser} />);
      // MapView sizes itself to `calc(100vh - 120px)` internally (built for the desktop app's
      // fixed top bar) — inside this phone shell that fought the header/tab-bar chrome around it
      // for space. Forced to a predictable 75% of viewport height instead via sp-map-wrap's CSS
      // override below, with the page title floated on top of the map (not pushing it down) so
      // the map itself gets as much room as possible, same as the desktop Operations Map.
      case 'map': return <div className="sp-map-wrap"><MapView currentUser={currentUser} /></div>;
      case 'customers': return scrolled(<CustomerView currentUser={currentUser} />);
      case 'attendance': return scrolled(<AttendanceView currentUser={currentUser} />);
      case 'complaints': return scrolled(<ComplaintsView />);
      case 'debts': return scrolled(<DebtView />);
      case 'expenses': return scrolled(<ExpenseView currentUser={currentUser} />);
      default: return null;
    }
  };

  const renderContent = () => {
    if (tab === 'more') {
      if (moreView) return renderView(moreView);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {CASHIER_MORE.map(id => {
            const m = TAB_META[id];
            return (
              <button key={id} className="sp-btn" onClick={() => setMoreView(id)} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '1rem 1.1rem', borderRadius: '16px', border: '1px solid #f1f5f9', background: 'white', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <m.icon size={17} color={GREEN} />
                </div>
                <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.9rem', flex: 1 }}>{m.label}</span>
                <ChevronRight size={16} color="#cbd5e1" />
              </button>
            );
          })}
        </div>
      );
    }
    return renderView(tab);
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#eef2f2', display: 'flex', justifyContent: 'center' }}>
      <Toaster position="top-center" />
      <style>{`
        @keyframes sp-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .sp-btn { transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease; }
        .sp-btn:hover { transform: translateY(-1px); }
        .sp-btn:active { transform: translateY(0) scale(0.98); }
        .sp-content { animation: sp-fade 0.2s ease; }
        .sp-map-wrap { height: 75vh; border-radius: 22px; overflow: hidden; }
        .sp-map-wrap > div { height: 100% !important; border-radius: 22px; }
        /* BillingView/CashoutView's stat-card row picks 2 vs 4 columns based on their own
           window.innerWidth check, sized for the full desktop app — but this portal is a fixed
           ~480px card that can sit inside a much wider browser window (desktop preview) or a
           real phone whose width doesn't line up with that component's own breakpoint, so the
           4-column grid was rendering here and getting chopped off mid-card at the right edge.
           This portal is always mobile by definition, so its stat-card grids are always forced
           to 2 columns regardless of the real window width. */
        .sp-shell div[style*="grid-template-columns"] { grid-template-columns: repeat(2, 1fr) !important; }
        .sp-hscroll::-webkit-scrollbar { height: 5px; }
        .sp-hscroll::-webkit-scrollbar-thumb { background: #bbf7d0; border-radius: 10px; }
        .sp-hscroll::-webkit-scrollbar-track { background: transparent; }
      `}</style>
      <div className="sp-shell" style={{
        width: '100%', maxWidth: isMobileViewport ? '100%' : PHONE_WIDTH,
        minHeight: '100dvh', maxHeight: isMobileViewport ? 'none' : '900px',
        background: 'white', borderRadius: isMobileViewport ? 0 : '32px',
        boxShadow: isMobileViewport ? 'none' : '0 30px 70px -15px rgba(15,23,42,0.25)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative'
      }}>
        {/* Gradient hero header */}
        <div style={{ background: `linear-gradient(160deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`, padding: '1.6rem 1.4rem 2.6rem', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', bottom: '-40px', left: '-40px', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1, gap: '10px' }}>
            <button onClick={() => setShowAccount(true)} style={{ display: 'flex', alignItems: 'center', gap: '13px', minWidth: 0, flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: currentUser?.profile_image ? '#f1f5f9' : 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.55)', boxShadow: '0 4px 14px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '1.2rem', flexShrink: 0, overflow: 'hidden' }}>
                {currentUser?.profile_image ? (
                  <img src={`/api/uploads/${currentUser.profile_image}`} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : initial}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: 'white', fontSize: '1.12rem', fontWeight: 900, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.8)', fontSize: '0.74rem', fontWeight: 700, marginTop: '2px' }}>
                  <Sparkles size={10} /> {isCollector ? t('staff_collector_role') : t('staff_cashier_role')} <span style={{ opacity: 0.6 }}>· {t('staff_tap_to_edit')}</span>
                </div>
              </div>
            </button>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button className="sp-btn" onClick={toggleLang} title={currentLanguage === 'so' ? 'Switch to English' : 'U beddel Soomaali'} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', fontSize: '0.62rem', fontWeight: 800, flexDirection: 'column', gap: '1px' }}>
                <Globe size={13} />{currentLanguage.toUpperCase()}
              </button>
              <button className="sp-btn" onClick={openNotifications} title={t('staff_notifications')} style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: '-3px', right: '-3px', minWidth: '16px', height: '16px', borderRadius: '9px', background: '#ef4444', color: 'white', fontSize: '0.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: `2px solid ${GREEN_DARK}` }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <button className="sp-btn" onClick={onLogout} title="Logout" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* White sheet overlapping the hero, rounded top corners — mirrors Customer Portal.
            The map tab skips the block header below — instead a small pill floats directly on
            top of the map (see the sp-content block) so the map claims that vertical space instead. */}
        <div style={{ background: '#f8fafc', borderRadius: '26px 26px 0 0', marginTop: '-18px', position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!isMapView && (
            <div style={{ padding: '1.4rem 1.4rem 0.2rem', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              {tab === 'more' && moreView && (
                <button className="sp-btn" onClick={() => setMoreView(null)} style={{ width: '34px', height: '34px', borderRadius: '10px', border: '1px solid #f1f5f9', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <ArrowLeft size={15} color="#475569" />
                </button>
              )}
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>{meta.title}</h2>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>{meta.subtitle}</p>
              </div>
            </div>
          )}

          {/* Map skips the floating title pill too — MapView already renders its own labeled
              filter/search controls at the same top-left corner, so a second title there just
              overlapped them instead of adding anything useful. */}
          <div key={activeId} className="sp-content" style={{ flex: 1, overflowY: 'auto', padding: isMapView ? '0.8rem' : '1rem 1.4rem 1.4rem', position: 'relative' }}>
            {renderContent()}
          </div>

          {/* Bottom tab bar */}
          {primaryTabs.length > 1 && (
            <div style={{ display: 'flex', background: 'white', borderTop: '1px solid #f1f5f9', padding: '0.6rem 0.5rem calc(0.6rem + env(safe-area-inset-bottom, 0px))', boxShadow: '0 -4px 16px rgba(15,23,42,0.04)', flexShrink: 0 }}>
              {primaryTabs.map(id => {
                const tabMeta = TAB_META[id];
                const active = tab === id;
                return (
                  <button key={id} className="sp-btn" onClick={() => goTab(id)} style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 0.2rem', borderRadius: '14px'
                  }}>
                    <div style={{ width: '38px', height: '30px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? '#f0fdf4' : 'transparent' }}>
                      <tabMeta.icon size={19} color={active ? GREEN : '#94a3b8'} strokeWidth={active ? 2.4 : 2} />
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: active ? 800 : 600, color: active ? GREEN : '#94a3b8' }}>{tabMeta.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Notifications panel */}
        {showNotifications && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => setShowNotifications(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#f8fafc', borderRadius: '26px 26px 0 0', maxHeight: '78%', display: 'flex', flexDirection: 'column', boxShadow: '0 -10px 40px rgba(15,23,42,0.2)' }}>
              <div style={{ padding: '1.2rem 1.3rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={18} color={GREEN} /> {t('staff_notifications')}
                </div>
                <button onClick={() => setShowNotifications(false)} style={{ width: '30px', height: '30px', borderRadius: '10px', border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b', fontWeight: 700 }}>✕</button>
              </div>
              <div style={{ overflowY: 'auto', padding: '0.8rem 1.3rem 1.6rem' }}>
                {notifications.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '3rem 1rem', color: '#94a3b8' }}>
                    <Bell size={26} color="#cbd5e1" />
                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{t('staff_no_notifications')}</div>
                  </div>
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

        {/* Account panel — photo, name, password, all self-service via the same
            update_profile endpoint the desktop app's own profile editor uses. */}
        {showAccount && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => setShowAccount(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '26px 26px 0 0', maxHeight: '88%', overflowY: 'auto', boxShadow: '0 -10px 40px rgba(15,23,42,0.2)' }}>
              <div style={{ padding: '1.2rem 1.3rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserIcon size={18} color={GREEN} /> {t('staff_my_account')}
                </div>
                <button onClick={() => setShowAccount(false)} style={{ width: '30px', height: '30px', borderRadius: '10px', border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b' }}><X size={15} /></button>
              </div>

              <div style={{ padding: '1.3rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                {/* Photo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: currentUser?.profile_image ? '#f1f5f9' : `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.4rem', fontWeight: 900, overflow: 'hidden' }}>
                      {currentUser?.profile_image ? (
                        <img src={`/api/uploads/${currentUser.profile_image}`} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : initial}
                    </div>
                    <button onClick={() => photoInputRef.current?.click()} disabled={isUploadingPhoto} title="Change photo" style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '24px', height: '24px', borderRadius: '50%', background: GREEN, border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                      <Camera size={11} color="white" />
                    </button>
                    <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
                    {isUploadingPhoto ? t('staff_uploading') : t('staff_tap_camera_photo')}
                  </div>
                </div>

                <form onSubmit={handleSaveAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#64748b', marginBottom: '7px' }}>{t('staff_full_name')}</label>
                    <div style={{ position: 'relative' }}>
                      <UserIcon size={16} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input required value={accountName} onChange={e => setAccountName(e.target.value)} style={{ width: '100%', padding: '0.8rem 0.8rem 0.8rem 2.4rem', borderRadius: '13px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '0.9rem', background: '#f8fafc' }} />
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.8rem', fontWeight: 800, color: '#64748b' }}>
                      <PhoneIcon size={14} /> {t('staff_contact_numbers')}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '-4px' }}>{t('staff_contact_numbers_sub')}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '6px' }}>TELESOM</label>
                        <input type="tel" placeholder="63xxxxxxx" value={accountPhones.telesom} onChange={e => setAccountPhones({ ...accountPhones, telesom: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '13px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '0.88rem', background: '#f8fafc' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '6px' }}>SOMTEL</label>
                        <input type="tel" placeholder="65xxxxxxx" value={accountPhones.somtel} onChange={e => setAccountPhones({ ...accountPhones, somtel: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '13px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '0.88rem', background: '#f8fafc' }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.8rem', fontWeight: 800, color: '#64748b' }}>
                      <KeyRound size={14} /> {t('staff_change_password_optional')}
                    </div>
                    <input type="password" placeholder={t('staff_new_password_ph')} value={accountPw.password} onChange={e => setAccountPw({ ...accountPw, password: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '13px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '0.9rem', background: '#f8fafc' }} />
                    <input type="password" placeholder={t('staff_confirm_password_ph')} value={accountPw.confirm} onChange={e => setAccountPw({ ...accountPw, confirm: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '13px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '0.9rem', background: '#f8fafc' }} />
                  </div>

                  <button type="submit" disabled={isSavingAccount} style={{ padding: '0.9rem', borderRadius: '16px', border: 'none', background: isSavingAccount ? '#86c976' : GREEN, color: 'white', fontWeight: 800, fontSize: '0.95rem', cursor: isSavingAccount ? 'default' : 'pointer', marginTop: '0.3rem' }}>
                    {isSavingAccount ? t('staff_saving') : t('staff_save_changes')}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffPortalApp;
