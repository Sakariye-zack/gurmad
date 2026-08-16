import React, { useState } from 'react';
import { Home, LogOut, Truck, Wallet, Users, Receipt, Menu, X } from 'lucide-react';
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
// Customer Portal's look — bottom tabs, gradient header, generous touch targets — since these
// staff are using it out in the field on their own phones, not at a desk.
const GREEN = '#3FAE2A';
const GREEN_DARK = '#2d8c1e';
const PHONE_WIDTH = '480px';

const StaffPortalApp = ({ currentUser, onLogout }) => {
  const isCollector = currentUser?.role === 'collector';
  const tabs = isCollector
    ? [{ id: 'route', label: 'My Route', icon: Truck }]
    : [
        { id: 'collections', label: 'Collections', icon: Users },
        { id: 'billing', label: 'Collect Payment', icon: Receipt },
        { id: 'cashout', label: 'Cashout', icon: Wallet },
      ];
  const [tab, setTab] = useState(tabs[0].id);
  const [billingPrefillPhone, setBillingPrefillPhone] = useState(null);
  const [isMobileViewport] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 480);

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
      <div style={{
        width: '100%', maxWidth: isMobileViewport ? '100%' : PHONE_WIDTH,
        minHeight: '100dvh', background: '#f8fafc',
        boxShadow: isMobileViewport ? 'none' : '0 0 60px rgba(15,23,42,0.08)',
        display: 'flex', flexDirection: 'column', position: 'relative'
      }}>
        {/* Header */}
        <div style={{ background: `linear-gradient(160deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`, padding: '1.4rem 1.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              {isCollector ? 'Collector' : 'Cashier'} Portal
            </div>
            <div style={{ color: 'white', fontSize: '1.15rem', fontWeight: 900 }}>{currentUser?.full_name || currentUser?.username}</div>
          </div>
          <button onClick={onLogout} title="Logout" style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', flexShrink: 0 }}>
            <LogOut size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.2rem' }}>
          {renderContent()}
        </div>

        {/* Bottom tab bar — only shown when there's more than one destination (cashier) */}
        {tabs.length > 1 && (
          <div style={{ display: 'flex', background: 'white', borderTop: '1px solid #f1f5f9', padding: '0.6rem 0.5rem calc(0.6rem + env(safe-area-inset-bottom, 0px))', boxShadow: '0 -4px 16px rgba(15,23,42,0.04)', flexShrink: 0 }}>
            {tabs.map(tb => {
              const active = tab === tb.id;
              return (
                <button key={tb.id} onClick={() => setTab(tb.id)} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 0.2rem', borderRadius: '14px'
                }}>
                  <div style={{ width: '38px', height: '30px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? '#f0fdf4' : 'transparent' }}>
                    <tb.icon size={19} color={active ? GREEN : '#94a3b8'} strokeWidth={active ? 2.4 : 2} />
                  </div>
                  <span style={{ fontSize: '0.65rem', fontWeight: active ? 800 : 600, color: active ? GREEN : '#94a3b8' }}>{tb.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffPortalApp;
