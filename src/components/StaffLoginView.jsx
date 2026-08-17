import React, { useState, useEffect } from 'react';
import { Truck, Shield, Lock, User, ArrowRight, Leaf, Globe } from 'lucide-react';
import { api } from '../api';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';

// Dedicated login screen for the Staff Portal (/staff) — Collector and Cashier accounts, mirroring
// the Customer Portal's (/portal) mobile-first look (gradient hero, decorative circles, white
// overlapping sheet) rather than the desktop "Admin Portal" login card. Same auth calls as
// LoginView (api.login/api.verify2FA, same 2FA flow) — just a different, phone-friendly presentation
// since staff use this out in the field, not at a desk.
const GREEN = '#3FAE2A';
const GREEN_DARK = '#2d8c1e';
const PHONE_WIDTH = '430px';

const StaffLoginView = ({ onLogin }) => {
  const { currentLanguage, setLanguage, t } = useLanguage();
  const toggleLang = () => setLanguage(currentLanguage === 'so' ? 'en' : 'so');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [require2FA, setRequire2FA] = useState(false);
  const [token, setToken] = useState('');
  const [pendingUserId, setPendingUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState({ logo: '', name: 'GURMAD' });
  const [logoError, setLogoError] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 480);

  useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth <= 480);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    fetch('/api/settings').then(res => res.json()).then(data => {
      setCompany({ logo: data.system_logo || '', name: data.company_name || 'Gurmad Waste Management' });
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.login({ username, password, token });
      if (response.error) {
        toast.error(response.error);
      } else if (response.require2FA && !token) {
        setPendingUserId(response.userId);
        setRequire2FA(true);
        toast.success('Password accepted. Please enter your 2FA code.');
      } else {
        toast.success(`Welcome back, ${response.username}!`);
        onLogin(response);
      }
    } catch (err) {
      toast.error('Network or server error connecting to login.');
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.verify2FA({ userId: pendingUserId, token });
      if (response.error) {
        toast.error(response.error);
      } else {
        toast.success('Authentication successful!');
        onLogin(response);
      }
    } catch (err) {
      toast.error('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width: '100%', padding: '0.9rem 0.9rem 0.9rem 2.7rem', borderRadius: '16px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '1rem', outline: 'none', transition: 'border-color 0.15s', background: '#f8fafc' };

  return (
    <div style={{ minHeight: '100dvh', background: '#eef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobileViewport ? 0 : '1rem' }}>
      <div style={{
        width: '100%', maxWidth: isMobileViewport ? '100%' : PHONE_WIDTH,
        minHeight: '100dvh', maxHeight: isMobileViewport ? 'none' : '900px',
        background: 'white', borderRadius: isMobileViewport ? 0 : '32px',
        boxShadow: isMobileViewport ? 'none' : '0 30px 70px -15px rgba(15,23,42,0.25)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Hero */}
          <div style={{ background: `linear-gradient(160deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`, padding: '2.4rem 1.5rem 3.2rem', textAlign: 'center', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ position: 'absolute', bottom: '20px', left: '-50px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

            <button type="button" onClick={toggleLang} title={currentLanguage === 'so' ? 'Switch to English' : 'U beddel Soomaali'} style={{ position: 'absolute', top: '0.9rem', left: '0.9rem', zIndex: 2, display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '100px', padding: '6px 12px', color: 'white', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>
              <Globe size={13} /> {currentLanguage.toUpperCase()}
            </button>

            <div style={{ width: '88px', height: '88px', borderRadius: '24px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.6rem auto 1rem', boxShadow: '0 10px 26px rgba(0,0,0,0.18)', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
              {require2FA ? (
                <Shield size={36} color={GREEN} />
              ) : company.logo && !logoError ? (
                <img src={`/api/uploads/${company.logo}`} alt="Gurmad" onError={() => setLogoError(true)} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '10px', boxSizing: 'border-box' }} />
              ) : (
                <Truck size={36} color={GREEN} />
              )}
            </div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0, color: 'white', letterSpacing: '-0.02em', position: 'relative', zIndex: 1 }}>GURMAD</h1>
            <p style={{ color: '#d9f7cf', fontSize: '1.05rem', margin: '2px 0 0 0', fontWeight: 800, position: 'relative', zIndex: 1 }}>{t('staff_login_title')}</p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', margin: '14px 0', position: 'relative', zIndex: 1 }}>
              <span style={{ width: '30px', height: '1px', background: 'rgba(255,255,255,0.4)' }} />
              <Leaf size={14} color="rgba(255,255,255,0.7)" />
              <span style={{ width: '30px', height: '1px', background: 'rgba(255,255,255,0.4)' }} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.88rem', margin: 0, lineHeight: 1.5, position: 'relative', zIndex: 1, maxWidth: '280px', marginLeft: 'auto', marginRight: 'auto' }}>
              {t('staff_login_sub')}
            </p>
          </div>

          {/* White sheet overlapping the hero */}
          <div style={{ background: 'white', borderRadius: '28px 28px 0 0', marginTop: '-22px', position: 'relative', zIndex: 2, padding: '2rem 1.6rem 1.8rem', flex: 1 }}>
            <div style={{ width: '58px', height: '58px', borderRadius: '18px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Shield size={26} color={GREEN} />
            </div>
            <h2 style={{ textAlign: 'center', fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>
              {require2FA ? 'Two-Factor Verification' : t('staff_welcome_back')}
            </h2>
            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1.6rem', lineHeight: 1.5 }}>
              {require2FA ? 'Enter the 6-digit code from your authenticator app.' : t('staff_signin_sub')}
            </p>

            {!require2FA ? (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: GREEN_DARK, marginBottom: '8px', letterSpacing: '0.3px' }}>USERNAME</label>
                  <div style={{ position: 'relative' }}>
                    <User size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: GREEN }} />
                    <input required value={username} onChange={e => setUsername(e.target.value)} placeholder="Your username"
                      onFocus={e => { e.target.style.borderColor = GREEN; e.target.style.background = 'white'; }}
                      onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                      style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: GREEN_DARK, marginBottom: '8px', letterSpacing: '0.3px' }}>PASSWORD</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: GREEN }} />
                    <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="********"
                      onFocus={e => { e.target.style.borderColor = GREEN; e.target.style.background = 'white'; }}
                      onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                      style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.3px' }}>AUTHENTICATOR CODE (IF ENABLED)</label>
                  <div style={{ position: 'relative' }}>
                    <Shield size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1' }} />
                    <input maxLength={6} value={token} onChange={e => setToken(e.target.value)} placeholder="000 000"
                      onFocus={e => { e.target.style.borderColor = GREEN; e.target.style.background = 'white'; }}
                      onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                      style={{ ...inputStyle, letterSpacing: '2px' }} />
                  </div>
                </div>

                <button type="submit" disabled={loading} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                  padding: '1.05rem', borderRadius: '18px', border: 'none',
                  background: loading ? '#86c976' : `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`,
                  color: 'white', fontWeight: 800, fontSize: '1rem', cursor: loading ? 'default' : 'pointer', marginTop: '0.3rem',
                  boxShadow: '0 10px 24px rgba(63,174,42,0.32)'
                }}>
                  {loading ? 'Authenticating...' : (<><Shield size={16} /> Secure Login <ArrowRight size={16} /></>)}
                </button>
              </form>
            ) : (
              <form onSubmit={handle2FAVerify} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <input required maxLength={6} autoFocus value={token} onChange={e => setToken(e.target.value)} placeholder="000 000"
                  style={{ width: '100%', padding: '1.1rem', borderRadius: '18px', border: `2px solid ${GREEN}`, outline: 'none', fontSize: '1.6rem', textAlign: 'center', fontWeight: 900, letterSpacing: '8px', boxSizing: 'border-box' }} />
                <button type="submit" disabled={loading} style={{
                  padding: '1.05rem', borderRadius: '18px', border: 'none',
                  background: loading ? '#86c976' : `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`,
                  color: 'white', fontWeight: 800, fontSize: '1rem', cursor: loading ? 'default' : 'pointer',
                  boxShadow: '0 10px 24px rgba(63,174,42,0.32)'
                }}>
                  {loading ? 'Verifying...' : 'Confirm Code'}
                </button>
                <button type="button" onClick={() => setRequire2FA(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                  ← Back to password
                </button>
              </form>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#f0fdf4', borderRadius: '16px', padding: '0.9rem 1rem', marginTop: '1.4rem' }}>
              <Shield size={18} color={GREEN} style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#15803d' }}>Collector & Cashier only</div>
                <div style={{ fontSize: '0.76rem', color: '#4d7c0f', marginTop: '2px' }}>Admin/Chairman accounts should use the main Admin Portal instead.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffLoginView;
