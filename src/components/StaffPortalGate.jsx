import React, { useState } from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import StaffLoginView from './StaffLoginView';
import StaffPortalApp from './StaffPortalApp';

// Login/logged-in split for the /staff URL, isolated from the main App component the same way
// CustomerPortalApp is isolated for /portal — its own useState reading the same 'gurmadUser'
// localStorage key the desktop Admin Portal login writes, so a session started at either URL is
// recognized at the other.
const StaffPortalGate = () => {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('gurmadUser');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('gurmadUser');
  };

  if (!currentUser) {
    return (
      <StaffLoginView onLogin={(user) => {
        setCurrentUser(user);
        localStorage.setItem('gurmadUser', JSON.stringify(user));
      }} />
    );
  }

  // An admin/gudoomiye/zone_accountant account logging in at /staff by mistake gets a clear
  // redirect rather than being dropped into a Collector/Cashier-shaped portal that doesn't match
  // their role.
  if (currentUser.role !== 'collector' && currentUser.role !== 'cashier') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eef2f2', padding: '1.5rem' }}>
        <div style={{ background: 'white', borderRadius: '24px', padding: '2rem', maxWidth: '380px', textAlign: 'center', boxShadow: '0 20px 50px rgba(15,23,42,0.12)' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <ShieldAlert size={24} color="#b45309" />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>Wrong Portal</h2>
          <p style={{ margin: '0 0 1.4rem', fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5 }}>
            This Staff Portal is for Collector and Cashier accounts. Your account ({currentUser.role}) should use the main Admin Portal instead.
          </p>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '0.8rem 1.4rem', borderRadius: '14px', background: '#3FAE2A', color: 'white', fontWeight: 800, fontSize: '0.9rem', textDecoration: 'none', marginBottom: '0.7rem', width: '100%', boxSizing: 'border-box' }}>
            Go to Admin Portal
          </a>
          <button onClick={handleLogout} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', background: 'none', border: 'none', color: '#94a3b8', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', width: '100%' }}>
            <LogOut size={13} /> Logout
          </button>
        </div>
      </div>
    );
  }

  return <StaffPortalApp currentUser={currentUser} onLogout={handleLogout} />;
};

export default StaffPortalGate;
