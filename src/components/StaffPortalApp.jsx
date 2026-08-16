import React, { useState, useEffect } from 'react';
import { LogOut, Truck, Wallet, Users, Receipt, Sparkles, LayoutDashboard, Map as MapIcon, MessageSquare, ClipboardList, Fingerprint, Grid3x3, ArrowLeft, ChevronRight } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { api } from '../api';
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

const TAB_META = {
  home: { label: 'Home', icon: LayoutDashboard, title: 'Overview', subtitle: 'Your performance and stats at a glance.' },
  route: { label: 'My Route', icon: Truck, title: "Today's Route", subtitle: 'Every stop on your route today, in order.' },
  collections: { label: 'Collections', icon: Users, title: "Today's Collections", subtitle: "Customers your paired collector is working on today." },
  billing: { label: 'Collect Payment', icon: Receipt, title: 'Collect Payment', subtitle: 'Record cash, ZAAD, eDahab or split payments.' },
  cashout: { label: 'Cashout', icon: Wallet, title: 'Cashout', subtitle: 'Reconcile the day’s collections.' },
  map: { label: 'Map', icon: MapIcon, title: 'Operations Map', subtitle: 'Trucks, zones and customers on the map.' },
  customers: { label: 'Customers', icon: Users, title: 'Customers', subtitle: 'Everyone in your zone.' },
  attendance: { label: 'Attendance', icon: Fingerprint, title: 'Attendance', subtitle: 'Clock in and out for today.' },
  complaints: { label: 'Complaints', icon: MessageSquare, title: 'Customer Complaints', subtitle: 'Issues reported in your zone.' },
  debts: { label: 'Debts', icon: ClipboardList, title: 'Debts', subtitle: 'Outstanding balances in your zone.' },
  expenses: { label: 'Expenses', icon: Wallet, title: 'Expense Tracker', subtitle: 'Log and review expenses.' },
  more: { label: 'More', icon: Grid3x3, title: 'More', subtitle: 'Everything else you have access to.' },
};

// A cashier's day is dominated by Collections/Payment/Cashout, so those stay on the bottom bar;
// the rest of what they're permitted to see (same roles as the desktop sidebar granted) lives one
// tap away behind "More" rather than crowding a 9-icon bottom bar. A collector only has a handful
// of destinations total, so theirs go straight on the bar.
const CASHIER_MORE = ['customers', 'complaints', 'debts', 'expenses', 'map'];

const StaffPortalApp = ({ currentUser, onLogout }) => {
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

  // Desktop-oriented views (tables, multi-column forms, charts) are reused as-is inside a
  // horizontally-scrollable container rather than redesigned, so nothing overflows the phone
  // screen while every existing validation/audit-log path stays exactly as tested — money-
  // handling and permission-scoped data are exactly the kind of logic that shouldn't be
  // reimplemented casually.
  const scrolled = (node) => <div style={{ overflowX: 'auto' }}>{node}</div>;

  const renderView = (id) => {
    switch (id) {
      case 'home': return scrolled(<DashboardView currentUser={currentUser} myTodayRoute={myTodayRoute} />);
      case 'route': return <MyRouteTodayView />;
      case 'collections': return <TodaysCollectionsView currentUser={currentUser} onCollectPayment={(phone) => { setBillingPrefillPhone(phone); goTab('billing'); }} />;
      case 'billing': return scrolled(<BillingView currentUser={currentUser} prefillCustomerPhone={billingPrefillPhone} onPrefillHandled={() => setBillingPrefillPhone(null)} />);
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
      `}</style>
      <div style={{
        width: '100%', maxWidth: isMobileViewport ? '100%' : PHONE_WIDTH,
        minHeight: '100dvh', maxHeight: isMobileViewport ? 'none' : '900px',
        background: 'white', borderRadius: isMobileViewport ? 0 : '32px',
        boxShadow: isMobileViewport ? 'none' : '0 30px 70px -15px rgba(15,23,42,0.25)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative'
      }}>
        {/* Gradient hero header */}
        <div style={{ background: `linear-gradient(160deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`, padding: '1.5rem 1.4rem 2.6rem', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', bottom: '-40px', left: '-40px', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1, gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '15px', background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '1.15rem', flexShrink: 0 }}>
                {initial}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '100px', padding: '3px 10px', color: 'white', fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>
                  <Sparkles size={10} /> {isCollector ? 'Collector' : 'Cashier'}
                </div>
                <div style={{ color: 'white', fontSize: '1.1rem', fontWeight: 900, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
              </div>
            </div>
            <button className="sp-btn" onClick={onLogout} title="Logout" style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', flexShrink: 0 }}>
              <LogOut size={16} />
            </button>
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
                const t = TAB_META[id];
                const active = tab === id;
                return (
                  <button key={id} className="sp-btn" onClick={() => goTab(id)} style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 0.2rem', borderRadius: '14px'
                  }}>
                    <div style={{ width: '38px', height: '30px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? '#f0fdf4' : 'transparent' }}>
                      <t.icon size={19} color={active ? GREEN : '#94a3b8'} strokeWidth={active ? 2.4 : 2} />
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: active ? 800 : 600, color: active ? GREEN : '#94a3b8' }}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffPortalApp;
