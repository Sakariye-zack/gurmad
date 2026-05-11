import React, { useState, useEffect } from 'react';
import { Truck, Shield, Lock, User } from 'lucide-react';
import { api } from '../api';
import { toast } from 'react-hot-toast';

const LoginView = ({ onLogin, onBack }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [require2FA, setRequire2FA] = useState(false);
  const [token, setToken] = useState('');
  const [pendingUserId, setPendingUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [systemSettings, setSystemSettings] = useState({ logo: '', companyName: 'GURMAD' });

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setSystemSettings({
          logo: data.system_logo || '',
          companyName: (data.company_name || 'GURMAD').toUpperCase()
        });
      })
      .catch(console.error);
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
        toast.success('Password accepted. Please enter 2FA code.');
      } else {
        toast.success(`Welcome back, ${response.username}!`);
        onLogin(response);
      }
    } catch (err) {
      toast.error('Network or server error connecting to login endpoint.');
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
        toast.success(`Authentication successful!`);
        onLogin(response);
      }
    } catch (err) {
      toast.error('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-primary)',
      backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(63, 174, 42, 0.05) 0%, rgba(63, 174, 42, 0) 50%)',
    }}>
      <div className="card glass" style={{ 
          width: '100%', 
          maxWidth: '420px', 
          padding: '2.5rem', 
          borderTop: '5px solid var(--gurmad-green)',
          boxShadow: 'var(--shadow-lg)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            backgroundColor: systemSettings.logo ? 'white' : 'var(--gurmad-green)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            margin: '0 auto 1.5rem auto',
            boxShadow: '0 10px 20px -5px rgba(63, 174, 42, 0.4)',
            overflow: 'hidden',
            border: systemSettings.logo ? '1px solid var(--border-color)' : 'none'
          }}>
            {require2FA ? (
              <Shield size={36} color={systemSettings.logo ? 'var(--gurmad-green)' : 'white'} />
            ) : (
              systemSettings.logo ? (
                <img src={`/uploads/${systemSettings.logo}`} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <Truck size={36} />
              )
            )}
          </div>
          <h1 style={{ fontWeight: 800, fontSize: '1.75rem', margin: 0, color: 'var(--text-primary)' }}>
            {require2FA ? 'SECURE AUTH' : systemSettings.companyName.split(' ')[0]}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '2px', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            {require2FA ? 'TWO-FACTOR VERIFICATION' : (systemSettings.companyName.split(' ').slice(1).join(' ') || 'MANAGEMENT SYSTEM')}
          </p>
        </div>

        {!require2FA ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>USERNAME</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', top: '14px', left: '14px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username" 
                  style={{ 
                    width: '100%', padding: '0.85rem 1rem 0.85rem 2.5rem', 
                    borderRadius: '10px', border: '1px solid var(--border-color)', 
                    outline: 'none', fontSize: '0.95rem' 
                  }} 
                />
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', top: '14px', left: '14px', color: 'var(--text-muted)' }} />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  style={{ 
                    width: '100%', padding: '0.85rem 1rem 0.85rem 2.5rem', 
                    borderRadius: '10px', border: '1px solid var(--border-color)', 
                    outline: 'none', fontSize: '0.95rem' 
                  }} 
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>AUTHENTICATOR CODE (IF ENABLED)</label>
              <div style={{ position: 'relative' }}>
                <Shield size={18} style={{ position: 'absolute', top: '14px', left: '14px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  maxLength={6}
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="000 000" 
                  style={{ 
                    width: '100%', padding: '0.85rem 1rem 0.85rem 2.5rem', 
                    borderRadius: '10px', border: '1px solid var(--border-color)', 
                    outline: 'none', fontSize: '0.95rem', letterSpacing: '2px'
                  }} 
                />
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="btn-primary" 
              style={{ 
                marginTop: '1rem', 
                padding: '0.85rem', 
                fontSize: '1rem', 
                fontWeight: 600, 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '8px',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Authenticating...' : (
                <>
                  <Shield size={18} /> Secure Login
                </>
              )}
            </button>
            <button 
              type="button"
              onClick={onBack}
              style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', marginTop: '0.5rem' }}
            >
              ← Back to Website
            </button>
          </form>
        ) : (
          <form onSubmit={handle2FAVerify} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Please enter the 6-digit code from your authenticator app to complete login.
              </p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textAlign: 'center' }}>CODE</label>
              <input 
                type="text" 
                required
                maxLength={6}
                autoFocus
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="000 000" 
                style={{ 
                  width: '100%', padding: '1rem', 
                  borderRadius: '12px', border: '2px solid var(--gurmad-green)', 
                  outline: 'none', fontSize: '1.5rem', textAlign: 'center', fontWeight: 800, letterSpacing: '8px'
                }} 
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="btn-primary" 
              style={{ 
                marginTop: '1rem', 
                padding: '0.85rem', 
                fontSize: '1rem', 
                fontWeight: 600, 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '8px',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Verifying...' : 'Confirm Code'}
            </button>
            <button 
              type="button"
              onClick={() => setRequire2FA(false)}
              style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', marginTop: '0.5rem' }}
            >
              ← Back to password
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginView;
