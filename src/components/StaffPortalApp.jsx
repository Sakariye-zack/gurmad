import React, { useState } from 'react';
import { LogOut, Truck, Wallet, Users, Receipt, Sparkles } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import MyRouteTodayView from './MyRouteTodayView';
import TodaysCollectionsView from './TodaysCollectionsView';
import BillingView from './BillingView';
import CashoutView from './CashoutView';

// Staff Portal — a lightweight, mobile-first landing spot for Collector and Cashier accounts,
// separate from the full desktop admin SPA (which is now reserved for admin/gudoomiye/
// zone_accountant). Rather than rebuilding collection/payment logic from scratch, this wraps the
// same battle-tested views the desktop app already used for these roles (MyRouteTodayView,
// TodaysCollectionsView, BillingView, CashoutView) in a phone-width shell that mirrors the
// Customer Portal's look — gradient hero, white overlapping sheet, bottom tabs, generous touch
// targets — since these staff are using it out in the field on their own phones, not at a desk.
// The reused views themselves are left untouched (they're shared with admin's own use of them
// elsewhere in the desktop app) — all the polish here lives in the shell around them.
const GREEN = '#3FAE2A';
const GREEN_DARK = '#2d8c1e';
const PHONE_WIDTH = '480px';

const TAB_META = {
  route: { label: 'My Route', icon: Truck, title: "Today's Route", subtitle: 'Every stop on your route today, in order.' },
  collections: { label: 'Collections', icon: Users, title: "Today's Collections", subtitle: "Customers your paired collector is working on today." },
  billing: { label: 'Collect Payment', icon: Receipt, title: 'Collect Payment', subtitle: 'Record cash, ZAAD, eDahab or split payments.' },
  cashout: { label: 'Cashout', icon: Wallet, title: 'Cashout', subtitle: 'Reconcile the day’s collections.' },
};

const StaffPortalApp = ({ currentUser, onLogout }) => {
  const isCollector = currentUser?.role === 'collector';
  const tabs = isCollector
    ? ['route']
    : ['collections', 'billing', 'cashout'];
  const [tab, setTab] = useState(tabs[0]);
  const [billingPrefillPhone, setBillingPrefillPhone] = useState(null);
  const [isMobileViewport] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 480);
  const meta = TAB_META[tab];
  const name = currentUser?.full_name || currentUser?.username || '';
  const initial = name[0]?.toUpperCase() || (isCollector ? 'C' : '$');

  const renderContent = () => {
    if (isCollector) return <MyRouteTodayView />;
    if (tab === 'collections') {
      return (
        <TodaysCollectionsView
          currentUser={currentUser}
          onCollectPayment={(phone) => { setBillingPrefillPhone(phone); setTab('billing'); }}
        />
      );
    }
    // BillingView and CashoutView are desktop-oriented (tables, multi-column forms) — rather than
    // rebuild payment/cashout logic (real money handling, too risky to reimplement here), they're
    // reused as-is inside a horizontally-scrollable container so nothing overflows the phone
    // screen, while every existing validation/audit-log path stays exactly as tested.
    if (tab === 'billing') {
      return (
        <div style={{ overflowX: 'auto' }}>
          <BillingView currentUser={currentUser} prefillCustomerPhone={billingPrefillPhone} onPrefillHandled={() => setBillingPrefillPhone(null)} />
        </div>
      );
    }
    if (tab === 'cashout') {
      return (
        <div style={{ overflowX: 'auto' }}>
          <CashoutView currentUser={currentUser} />
        </div>
      );
    }
    return null;
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '15px', background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '1.15rem', flexShrink: 0 }}>
                {initial}
              </div>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '100px', padding: '3px 10px', color: 'white', fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>
                  <Sparkles size={10} /> {isCollector ? 'Collector' : 'Cashier'}
                </div>
                <div style={{ color: 'white', fontSize: '1.1rem', fontWeight: 900, lineHeight: 1.15 }}>{name}</div>
              </div>
            </div>
            <button className="sp-btn" onClick={onLogout} title="Logout" style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', flexShrink: 0 }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* White sheet overlapping the hero, rounded top corners — mirrors Customer Portal */}
        <div style={{ background: '#f8fafc', borderRadius: '26px 26px 0 0', marginTop: '-18px', position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '1.4rem 1.4rem 0.2rem', flexShrink: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>{meta.title}</h2>
            <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>{meta.subtitle}</p>
          </div>

          <div key={tab} className="sp-content" style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.4rem 1.4rem' }}>
            {renderContent()}
          </div>

          {/* Bottom tab bar — only shown when there's more than one destination (cashier) */}
          {tabs.length > 1 && (
            <div style={{ display: 'flex', background: 'white', borderTop: '1px solid #f1f5f9', padding: '0.6rem 0.5rem calc(0.6rem + env(safe-area-inset-bottom, 0px))', boxShadow: '0 -4px 16px rgba(15,23,42,0.04)', flexShrink: 0 }}>
              {tabs.map(id => {
                const t = TAB_META[id];
                const active = tab === id;
                return (
                  <button key={id} className="sp-btn" onClick={() => setTab(id)} style={{
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
