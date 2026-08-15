import React, { useState, useEffect } from 'react';
import { 
  Settings,
  User,
  Bell,
  ShieldCheck, 
  Database,
  RefreshCcw,
  Save,
  DollarSign,
  AlertCircle,
  Upload,
  Lock,
  Users,
  Globe,
  Truck,
  MessageCircle,
  Monitor,
  Clock,
  Palette,
  CloudLightning
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../api';

const SettingsView = ({ currentUser = {}, onProfileUpdate }) => {
  const [activeTab, setActiveTab] = useState('pro');
  const [exchangeRate, setExchangeRate] = useState('8,500');
  const [preferences, setPreferences] = useState({
    autoInvoice: true,
    ussdConfirm: true,
    smsNotify: false,
    gpsTracking: true,
    emailAlerts: true,
    inventoryAlerts: true,
    debtReminders: false,
    maintenanceMode: false,
    whatsappNotify: true,
    timezone: 'UTC+3 (EAT)',
    dateFormat: 'DD/MM/YYYY',
    primaryColor: '#3FAE2A',
    dashboardLayout: 'Standard'
  });
  const [generalSettings, setGeneralSettings] = useState({
    companyName: 'Gurmad Waste Management',
    systemTitle: 'Gurmad Admin Portal',
    supportEmail: 'support@gurmad.so',
    contactPhone: '+252 63 4444444',
    systemLogo: '',
    alertPhone: ''
  });
  const [isSendingDigest, setIsSendingDigest] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [securitySettings, setSecuritySettings] = useState({
    passwordHistory: '3',
    sessionTimeout: '30',
    twoFactor: false
  });
  
  const [landingContent, setLandingContent] = useState({
    landing_hero_title: '',
    landing_hero_subtitle: '',
    landing_about_text: '',
    landing_contact_email: '',
    landing_contact_phone: '',
    landing_contact_address: '',
    landing_services: '[]'
  });
  
  // 2FA Setup State
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFAData, setTwoFAData] = useState({ qrCode: '', secret: '', token: '' });
  
  // User Management State
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]); // dynamic roles list (Roles & Permissions page)
  const [editingUser, setEditingUser] = useState(null);
  const [newPass, setNewPass] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUserData, setNewUserData] = useState({ username: '', full_name: '', password: '', role: 'collector', zone: '' });
  
  // User Profile States
  const [profUsername, setProfUsername] = useState(currentUser.username || '');
  const [profFullName, setProfFullName] = useState(currentUser.full_name || '');
  const [profPassword, setProfPassword] = useState('');
  const [profImage, setProfImage] = useState(null);
  const [profPreview, setProfPreview] = useState(
    currentUser.profile_image 
      ? `/api/uploads/${currentUser.profile_image}` 
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.full_name || currentUser.username)}&background=3FAE2A&color=fff&size=128`
  );

  const [isUpdating, setIsUpdating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.exchange_rate) setExchangeRate(data.exchange_rate);
        if (data.landing_hero_title) {
          setLandingContent({
            landing_hero_title: data.landing_hero_title || '',
            landing_hero_subtitle: data.landing_hero_subtitle || '',
            landing_about_text: data.landing_about_text || '',
            landing_contact_email: data.landing_contact_email || '',
            landing_contact_phone: data.landing_contact_phone || '',
            landing_contact_address: data.landing_contact_address || '',
            landing_services: data.landing_services || '[]'
          });
        }
        if (data.autoInvoice !== undefined) {
          setPreferences({
            autoInvoice: data.autoInvoice === 'true',
            ussdConfirm: data.ussdConfirm === 'true',
            smsNotify: data.smsNotify === 'true',
            gpsTracking: data.gpsTracking === 'true',
            maintenanceMode: data.maintenanceMode === 'true',
            whatsappNotify: data.whatsappNotify === 'true',
            timezone: data.timezone || 'UTC+3 (EAT)',
            dateFormat: data.dateFormat || 'DD/MM/YYYY',
            primaryColor: data.primaryColor || '#3FAE2A',
            dashboardLayout: data.dashboardLayout || 'Standard'
          });
          if (data.primaryColor) {
            document.documentElement.style.setProperty('--gurmad-green', data.primaryColor);
          }
          if (data.dashboardLayout) {
            document.documentElement.setAttribute('data-layout', data.dashboardLayout.toLowerCase());
          }
        }
        if (data.company_name || data.system_logo) {
          setGeneralSettings(prev => ({
            ...prev,
            companyName: data.company_name || prev.companyName,
            systemTitle: data.system_title || prev.systemTitle,
            supportEmail: data.support_email || prev.supportEmail,
            contactPhone: data.contact_phone || prev.contactPhone,
            systemLogo: data.system_logo || '',
            alertPhone: data.alert_phone || ''
          }));
          if (data.system_logo) {
            setLogoPreview(`/api/uploads/${data.system_logo}`);
          }
        }
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = (key) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsUpdating(true);
    const payload = {
      exchange_rate: exchangeRate,
      autoInvoice: preferences.autoInvoice,
      ussdConfirm: preferences.ussdConfirm,
      smsNotify: preferences.smsNotify,
      gpsTracking: preferences.gpsTracking,
      maintenanceMode: preferences.maintenanceMode,
      whatsappNotify: preferences.whatsappNotify,
      timezone: preferences.timezone,
      dateFormat: preferences.dateFormat,
      primaryColor: preferences.primaryColor,
      dashboardLayout: preferences.dashboardLayout,
      company_name: generalSettings.companyName,
      system_logo: generalSettings.systemLogo,
      system_title: generalSettings.systemTitle,
      support_email: generalSettings.supportEmail,
      contact_phone: generalSettings.contactPhone,
      alert_phone: generalSettings.alertPhone
    };
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      toast.success('All settings saved to database!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save settings');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const formData = new FormData();
      formData.append('id', currentUser.id);
      formData.append('username', profUsername);
      formData.append('full_name', profFullName);
      if (profPassword) formData.append('password', profPassword);
      if (profImage) formData.append('profile_image', profImage);

      const res = await api.updateProfile(formData);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success('Profile updated successfully!', { icon: '👤' });
        onProfileUpdate(res.user);
        setProfPassword(''); // Clear password field after save
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfImage(file);
      setProfPreview(URL.createObjectURL(file));
    }
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      setIsUpdating(true);
      const res = await api.generalUpload(formData);
      if (res.filename) {
        setGeneralSettings(prev => ({ ...prev, systemLogo: res.filename }));
        setLogoPreview(URL.createObjectURL(file));
        toast.success('System logo uploaded successfully!');
      } else {
        toast.error('Failed to upload logo');
      }
    } catch (err) {
      toast.error('Upload error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handle2FAToggle = async () => {
    if (!securitySettings.twoFactor) {
      // Enabling
      setLoading(true);
      try {
        const res = await api.setup2FA(currentUser.id);
        setTwoFAData({ ...twoFAData, qrCode: res.qrCode, secret: res.secret });
        setShow2FAModal(true);
      } catch (err) {
        toast.error('Failed to initialize 2FA');
      } finally {
        setLoading(false);
      }
    } else {
      // Disabling
      if (confirm('Are you sure you want to disable 2FA? This will reduce your account security.')) {
        try {
          await api.disable2FA(currentUser.id);
          setSecuritySettings({ ...securitySettings, twoFactor: false });
          toast.success('2FA disabled');
        } catch (err) {
          toast.error('Failed to disable 2FA');
        }
      }
    }
  };

  const verifyAndEnable2FA = async () => {
    try {
      const cleanToken = twoFAData.token.replace(/\s/g, '');
      const res = await api.enable2FA({ userId: currentUser.id, token: cleanToken });
      if (res.success) {
        setSecuritySettings({ ...securitySettings, twoFactor: true });
        setShow2FAModal(false);
        toast.success('2FA successfully enabled!');
      } else {
        toast.error(res.error || 'Invalid code');
      }
    } catch (err) {
      toast.error('Verification failed');
    }
  };

  useEffect(() => {
    if (activeTab === 'usr' && currentUser.role === 'admin') {
      api.getUsers().then(setUsers);
      api.getRoles().then(setRoles).catch(() => {});
    }
  }, [activeTab]);

  const handleResetPassword = async (userId) => {
    if (!newPass) return toast.error('Enter a new password');
    try {
      await api.resetUserPassword(userId, newPass);
      toast.success('Password reset successful');
      setEditingUser(null);
      setNewPass('');
    } catch (err) {
      toast.error('Failed to reset password');
    }
  };

  const handleReset2FA = async (userId) => {
    if (confirm('Reset 2FA for this user? They will be able to login with just a password.')) {
      try {
        await api.resetUser2FA(userId);
        toast.success('2FA reset for user');
        api.getUsers().then(setUsers); // Refresh
      } catch (err) {
        toast.error('Failed to reset 2FA');
      }
    }
  };

  const handleFullReset = async (userId) => {
    if (!newPass) return toast.error('Enter or generate a new password');
    if (confirm('FULL RESET: This will change the password AND disable 2FA. Continue?')) {
      try {
        await api.fullUserReset(userId, newPass);
        toast.success('Full Account Reset Successful');
        setEditingUser(null);
        setNewPass('');
        api.getUsers().then(setUsers);
      } catch (err) {
        toast.error('Failed to perform full reset');
      }
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    if (confirm(`Are you sure you want to ${currentStatus ? 'disable' : 'enable'} this user?`)) {
      try {
        await api.toggleUserStatus(userId);
        toast.success(`User ${currentStatus ? 'disabled' : 'enabled'} successfully`);
        api.getUsers().then(setUsers);
      } catch (err) {
        toast.error('Failed to change user status');
      }
    }
  };

  const handleDeleteUser = async (userId) => {
    if (confirm('Are you sure you want to DELETE this user permanently? This action cannot be undone!')) {
      try {
        await api.deleteUser(userId);
        toast.success('User deleted successfully');
        api.getUsers().then(setUsers);
      } catch (err) {
        toast.error('Failed to delete user');
      }
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserData.username || !newUserData.password) return toast.error('Username and password are required');
    try {
      setIsUpdating(true);
      await api.createUser(newUserData);
      toast.success('User created successfully!');
      setShowCreateModal(false);
      setNewUserData({ username: '', full_name: '', password: '', role: 'collector', zone: '' });
      api.getUsers().then(setUsers);
    } catch (err) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setIsUpdating(false);
    }
  };

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPass(password);
    toast.success('Secure password generated!');
  };

  const prefItems = [
    { key: 'autoInvoice', label: 'Automatic Invoice Generation', desc: 'Create invoices at the start of every month.' },
    { key: 'ussdConfirm', label: 'ZAAD USSD Confirmation', desc: 'Enable PIN verification for all ZAAD payments.' },
    { key: 'smsNotify', label: 'SMS Notification', desc: 'Send receipts to customers via SMS.' },
    { key: 'gpsTracking', label: 'Real-time GPS Tracking', desc: 'Track vehicle locations every 10 seconds.' },
  ];

  const sideMenu = [
    { id: 'gen', label: 'General Settings', icon: Settings },
    { id: 'cur', label: 'Currency & Exchange', icon: DollarSign },
    { id: 'app', label: 'Appearance', icon: Palette },
    { id: 'aut', label: 'Automation & API', icon: CloudLightning },
    { id: 'pro', label: 'User Profile', icon: User },
    { id: 'not', label: 'Notifications', icon: Bell },
    { id: 'sec', label: 'Security & Access', icon: ShieldCheck },
    { id: 'bac', label: 'Data Backup', icon: Database },
    ...(currentUser.role === 'admin' ? [
      { id: 'usr', label: 'User Management', icon: Users }
    ] : [])
  ];

  if (loading) return <div className="card glass">Loading system settings...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem' }}>
      {/* Settings Navigation */}
      <div className="card glass" style={{ height: 'fit-content', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {sideMenu.map((item) => (
          <button 
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: 500,
              color: activeTab === item.id ? 'var(--gurmad-green)' : 'var(--text-muted)',
              backgroundColor: activeTab === item.id ? '#dcfce7' : 'transparent',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
          >
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* --- GENERAL SETTINGS TAB --- */}
        {activeTab === 'gen' && (
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings color="var(--gurmad-green)" /> General Configuration (v2)
            </h3>

            {/* System Logo Section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: '80px', height: '80px', borderRadius: '12px', overflow: 'hidden', 
                  border: '3px solid white', boxShadow: 'var(--shadow-sm)', backgroundColor: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <Truck size={32} color="var(--gurmad-green)" />
                  )}
                </div>
                <label 
                  htmlFor="logoUpload"
                  style={{
                    position: 'absolute', bottom: '-8px', right: '-8px', backgroundColor: 'var(--gurmad-green)', 
                    color: 'white', padding: '6px', borderRadius: '50%', cursor: 'pointer',
                    border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                  <Upload size={14} />
                </label>
                <input 
                  type="file" 
                  id="logoUpload" 
                  accept="image/*" 
                  onChange={handleLogoChange}
                  style={{ display: 'none' }} 
                />
              </div>
              <div>
                <h4 style={{ fontWeight: 700, margin: '0 0 5px 0' }}>System Logo</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                  This logo will appear in the Sidebar and Landing Page.<br/>
                  Best as a <strong>Square Rounded</strong> image.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>COMPANY NAME</label>
                <input 
                  type="text" 
                  value={generalSettings.companyName}
                  onChange={e => setGeneralSettings({...generalSettings, companyName: e.target.value})}
                  className="card" style={{ width: '100%', padding: '0.85rem', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>SYSTEM TITLE</label>
                <input 
                  type="text" 
                  value={generalSettings.systemTitle}
                  onChange={e => setGeneralSettings({...generalSettings, systemTitle: e.target.value})}
                  className="card" style={{ width: '100%', padding: '0.85rem', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>SUPPORT EMAIL</label>
                <input 
                  type="email" 
                  value={generalSettings.supportEmail}
                  onChange={e => setGeneralSettings({...generalSettings, supportEmail: e.target.value})}
                  className="card" style={{ width: '100%', padding: '0.85rem', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>CONTACT PHONE</label>
                <input
                  type="text"
                  value={generalSettings.contactPhone}
                  onChange={e => setGeneralSettings({...generalSettings, contactPhone: e.target.value})}
                  className="card" style={{ width: '100%', padding: '0.85rem', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                  DAILY ALERT PHONE (WhatsApp)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 0634444444"
                  value={generalSettings.alertPhone}
                  onChange={e => setGeneralSettings({...generalSettings, alertPhone: e.target.value})}
                  className="card" style={{ width: '100%', padding: '0.85rem', border: '1px solid var(--border-color)' }}
                />
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Every day at 6 PM, this number gets one WhatsApp message covering zones with $0 collected today, low stock, debts unpaid 60+ days, and pending complaints — so you don't have to open the app to know something's wrong.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
              <button
                onClick={async () => {
                  setIsSendingDigest(true);
                  try {
                    const result = await api.sendDigestNow();
                    if (result.sent) toast.success('Digest sent to WhatsApp');
                    else toast.error(result.reason || 'No alert phone configured — save it first');
                  } catch (err) {
                    toast.error(err.message || 'Failed to send digest');
                  } finally {
                    setIsSendingDigest(false);
                  }
                }}
                disabled={isSendingDigest}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: isSendingDigest ? 0.7 : 1 }}
              >
                {isSendingDigest ? 'Sending...' : 'Send Test Digest Now'}
              </button>
              <button
                onClick={handleSave}
                disabled={isUpdating}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: isUpdating ? 0.7 : 1 }}
              >
                {isUpdating ? <RefreshCcw size={18} className="spin" /> : <Save size={18} />}
                {isUpdating ? 'Saving...' : 'Update General Info'}
              </button>
            </div>
          </div>
        )}

        {/* --- CURRENCY & EXCHANGE TAB --- */}
        {activeTab === 'cur' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ fontWeight: 700 }}>Exchange Rate & Currency</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Daily rate for conversion.</p>
                </div>
                <button onClick={() => toast.success('Rates synced with Central Bank')} style={{ padding: '0.5rem', backgroundColor: '#f1f5f9', borderRadius: '8px', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
                  <RefreshCcw size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end' }}>
                 <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>BASE CURRENCY</label>
                    <div className="card glass" style={{ backgroundColor: '#f8fafc', padding: '0.75rem', fontWeight: 700 }}>1 USD</div>
                 </div>
                 <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>TARGET EXCHANGE</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontWeight: 700 }} 
                      />
                      <span style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>SLSH</span>
                    </div>
                 </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '1.5rem' }}>System Preferences</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {prefItems.map((pref) => (
                  <div key={pref.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{pref.label}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{pref.desc}</div>
                    </div>
                    <div 
                      onClick={() => handleToggle(pref.key)}
                      style={{ 
                        width: '44px', 
                        height: '24px', 
                        backgroundColor: preferences[pref.key] ? 'var(--gurmad-green)' : '#cbd5e1',
                        borderRadius: '12px',
                        padding: '2px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}>
                      <div style={{ 
                        width: '20px', 
                        height: '20px', 
                        backgroundColor: 'white', 
                        borderRadius: '50%',
                        transform: preferences[pref.key] ? 'translateX(20px)' : 'translateX(0)',
                        transition: 'all 0.2s'
                      }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button 
                onClick={handleSave}
                disabled={isUpdating}
                className="btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: isUpdating ? 0.7 : 1 }}
              >
                {isUpdating ? <RefreshCcw size={18} className="spin" /> : <Save size={18} />}
                {isUpdating ? 'Saving...' : 'Save Exchange Settings'}
              </button>
            </div>
          </div>
        )}

        {/* --- APPEARANCE TAB --- */}
        {activeTab === 'app' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Palette color="var(--gurmad-green)" /> Branding & Appearance
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>PRIMARY COLOR THEME</label>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {['#3FAE2A', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0f172a'].map(color => (
                      <div 
                        key={color}
                        onClick={() => {
                          setPreferences({...preferences, primaryColor: color});
                          document.documentElement.style.setProperty('--gurmad-green', color);
                        }}
                        style={{ 
                          width: '40px', height: '40px', borderRadius: '10px', backgroundColor: color, 
                          cursor: 'pointer', border: preferences.primaryColor === color ? '3px solid #cbd5e1' : 'none',
                          boxShadow: preferences.primaryColor === color ? '0 0 0 2px ' + color : 'var(--shadow-sm)',
                          transition: 'all 0.2s'
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>DASHBOARD LAYOUT</label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div 
                      onClick={() => {
                        setPreferences({...preferences, dashboardLayout: 'Standard'});
                        document.documentElement.setAttribute('data-layout', 'standard');
                      }}
                      style={{ 
                        flex: 1, padding: '1rem', borderRadius: '12px', textAlign: 'center', cursor: 'pointer',
                        border: preferences.dashboardLayout === 'Standard' ? '2px solid var(--gurmad-green)' : '1px solid var(--border-color)',
                        backgroundColor: preferences.dashboardLayout === 'Standard' ? '#f0fdf4' : 'transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Monitor size={24} style={{ marginBottom: '8px', color: preferences.dashboardLayout === 'Standard' ? 'var(--gurmad-green)' : 'var(--text-muted)' }} />
                      <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Standard</div>
                    </div>
                    <div 
                      onClick={() => {
                        setPreferences({...preferences, dashboardLayout: 'Compact'});
                        document.documentElement.setAttribute('data-layout', 'compact');
                      }}
                      style={{ 
                        flex: 1, padding: '1rem', borderRadius: '12px', textAlign: 'center', cursor: 'pointer',
                        border: preferences.dashboardLayout === 'Compact' ? '2px solid var(--gurmad-green)' : '1px solid var(--border-color)',
                        backgroundColor: preferences.dashboardLayout === 'Compact' ? '#f0fdf4' : 'transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Monitor size={24} style={{ marginBottom: '8px', color: preferences.dashboardLayout === 'Compact' ? 'var(--gurmad-green)' : 'var(--text-muted)' }} />
                      <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Compact</div>
                    </div>
                    <div 
                      onClick={() => {
                        setPreferences({...preferences, dashboardLayout: 'Boxed'});
                        document.documentElement.setAttribute('data-layout', 'boxed');
                      }}
                      style={{ 
                        flex: 1, padding: '1rem', borderRadius: '12px', textAlign: 'center', cursor: 'pointer',
                        border: preferences.dashboardLayout === 'Boxed' ? '2px solid var(--gurmad-green)' : '1px solid var(--border-color)',
                        backgroundColor: preferences.dashboardLayout === 'Boxed' ? '#f0fdf4' : 'transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Monitor size={24} style={{ marginBottom: '8px', color: preferences.dashboardLayout === 'Boxed' ? 'var(--gurmad-green)' : 'var(--text-muted)' }} />
                      <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Boxed</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '1.5rem' }}>Regional Settings</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>TIMEZONE</label>
                  <select 
                    value={preferences.timezone}
                    onChange={e => setPreferences({...preferences, timezone: e.target.value})}
                    className="card" style={{ width: '100%', padding: '0.85rem', border: '1px solid var(--border-color)' }}
                  >
                    <option>UTC+3 (EAT) - Hargeisa/Burao</option>
                    <option>UTC+0 (GMT)</option>
                    <option>UTC+1 (CET)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>DATE FORMAT</label>
                  <select 
                    value={preferences.dateFormat}
                    onChange={e => setPreferences({...preferences, dateFormat: e.target.value})}
                    className="card" style={{ width: '100%', padding: '0.85rem', border: '1px solid var(--border-color)' }}
                  >
                    <option>DD/MM/YYYY</option>
                    <option>MM/DD/YYYY</option>
                    <option>YYYY-MM-DD</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button 
                onClick={handleSave}
                disabled={isUpdating}
                className="btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: isUpdating ? 0.7 : 1 }}
              >
                {isUpdating ? <RefreshCcw size={18} className="spin" /> : <Save size={18} />}
                {isUpdating ? 'Saving...' : 'Save Appearance Settings'}
              </button>
            </div>
          </div>
        )}

        {/* --- AUTOMATION & API TAB --- */}
        {activeTab === 'aut' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CloudLightning color="var(--gurmad-green)" /> Automation Engines
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '16px', border: '1px solid #dcfce7' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ backgroundColor: '#25D366', padding: '10px', borderRadius: '12px', color: 'white' }}><MessageCircle size={24} /></div>
                      <div>
                        <div style={{ fontWeight: 800 }}>WhatsApp Automation</div>
                        <div style={{ fontSize: '0.85rem', color: '#166534' }}>Send automatic receipts and collection reminders via WhatsApp.</div>
                      </div>
                   </div>
                   <div 
                    onClick={() => handleToggle('whatsappNotify')}
                    style={{ 
                      width: '50px', height: '28px', 
                      backgroundColor: preferences.whatsappNotify ? '#25D366' : '#cbd5e1',
                      borderRadius: '15px', padding: '3px', cursor: 'pointer', transition: '0.2s'
                    }}>
                    <div style={{ 
                      width: '22px', height: '22px', backgroundColor: 'white', borderRadius: '50%',
                      transform: preferences.whatsappNotify ? 'translateX(22px)' : 'translateX(0)',
                      transition: '0.2s'
                    }}></div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: '#fff7ed', borderRadius: '16px', border: '1px solid #ffedd5' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ backgroundColor: '#ea580c', padding: '10px', borderRadius: '12px', color: 'white' }}><AlertCircle size={24} /></div>
                      <div>
                        <div style={{ fontWeight: 800 }}>System Maintenance Mode</div>
                        <div style={{ fontSize: '0.85rem', color: '#9a3412' }}>Restrict system access to Administrators only during updates.</div>
                      </div>
                   </div>
                   <div 
                    onClick={() => handleToggle('maintenanceMode')}
                    style={{ 
                      width: '50px', height: '28px', 
                      backgroundColor: preferences.maintenanceMode ? '#ea580c' : '#cbd5e1',
                      borderRadius: '15px', padding: '3px', cursor: 'pointer', transition: '0.2s'
                    }}>
                    <div style={{ 
                      width: '22px', height: '22px', backgroundColor: 'white', borderRadius: '50%',
                      transform: preferences.maintenanceMode ? 'translateX(22px)' : 'translateX(0)',
                      transition: '0.2s'
                    }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '1.5rem' }}>API Gateway (Developer)</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Connect external mobile apps or third-party accounting systems.</p>
              <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '16px', position: 'relative' }}>
                 <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, marginBottom: '8px' }}>X-GURMAD-API-KEY</div>
                 <div style={{ color: '#38bdf8', fontFamily: 'monospace', fontWeight: 700, fontSize: '1.1rem' }}>gur_live_7x8k2p9m1n0v5r4w3q</div>
                 <button style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', color: 'white', backgroundColor: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700 }}>REGENERATE</button>
              </div>
            </div>
          </div>
        )}

        {/* --- USER PROFILE TAB --- */}
        {activeTab === 'pro' && (
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User color="var(--gurmad-green)" /> Profile Settings
            </h3>
            
            <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: '100px', height: '100px', borderRadius: '50%', overflow: 'hidden', 
                    border: '4px solid white', boxShadow: 'var(--shadow-md)', backgroundColor: '#cbd5e1'
                  }}>
                    <img src={profPreview} alt="Profile Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <label 
                    htmlFor="profileUpload"
                    style={{
                      position: 'absolute', bottom: '0', right: '0', backgroundColor: 'var(--gurmad-green)', 
                      color: 'white', padding: '6px', borderRadius: '50%', cursor: 'pointer',
                      border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Upload size={16} />
                  </label>
                  <input 
                    type="file" 
                    id="profileUpload" 
                    accept="image/*" 
                    onChange={handleImageChange}
                    style={{ display: 'none' }} 
                  />
                </div>
                <div>
                  <h4 style={{ fontWeight: 700, margin: '0 0 5px 0' }}>Profile Photo</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                    Upload a high resolution avatar. Supported formats: JPG, PNG.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>FULL NAME</label>
                  <div style={{ position: 'relative' }}>
                    <User size={18} style={{ position: 'absolute', top: '14px', left: '14px', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Abu Usamah"
                      value={profFullName}
                      onChange={e => setProfFullName(e.target.value)}
                      style={{ 
                        width: '100%', padding: '0.85rem 1rem 0.85rem 2.5rem', 
                        borderRadius: '10px', border: '1px solid var(--border-color)', outline: 'none'
                      }} 
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>USERNAME</label>
                  <div style={{ position: 'relative' }}>
                    <User size={18} style={{ position: 'absolute', top: '14px', left: '14px', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      required
                      value={profUsername}
                      onChange={e => setProfUsername(e.target.value)}
                      style={{ 
                        width: '100%', padding: '0.85rem 1rem 0.85rem 2.5rem', 
                        borderRadius: '10px', border: '1px solid var(--border-color)', outline: 'none'
                      }} 
                    />
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>NEW PASSWORD (Optional)</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} style={{ position: 'absolute', top: '14px', left: '14px', color: 'var(--text-muted)' }} />
                    <input 
                      type="password" 
                      placeholder="Leave blank to keep current"
                      value={profPassword}
                      onChange={e => setProfPassword(e.target.value)}
                      style={{ 
                        width: '100%', padding: '0.85rem 1rem 0.85rem 2.5rem', 
                        borderRadius: '10px', border: '1px solid var(--border-color)', outline: 'none'
                      }} 
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button 
                  type="submit" 
                  disabled={isUpdating}
                  className="btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: isUpdating ? 0.7 : 1 }}
                >
                  {isUpdating ? <RefreshCcw size={18} className="spin" /> : <Save size={18} />}
                  {isUpdating ? 'Saving Profile...' : 'Save Profile Changes'}
                </button>
              </div>

            </form>
          </div>
        )}

        {/* --- NOTIFICATIONS TAB --- */}
        {activeTab === 'not' && (
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell color="var(--gurmad-green)" /> Notification Preferences
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {[
                { key: 'emailAlerts', label: 'Email Notifications', desc: 'Receive daily system summaries via email.' },
                { key: 'inventoryAlerts', label: 'Low Stock Alerts', desc: 'Notify when inventory items drop below threshold.' },
                { key: 'debtReminders', label: 'Debt Payment Reminders', desc: 'Automatically alert collectors about pending debts.' },
              ].map((pref) => (
                <div key={pref.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{pref.label}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{pref.desc}</div>
                  </div>
                  <div 
                    onClick={() => handleToggle(pref.key)}
                    style={{ 
                      width: '44px', height: '24px', 
                      backgroundColor: preferences[pref.key] ? 'var(--gurmad-green)' : '#cbd5e1',
                      borderRadius: '12px', padding: '2px', cursor: 'pointer', transition: 'all 0.2s'
                    }}>
                    <div style={{ 
                      width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%',
                      transform: preferences[pref.key] ? 'translateX(20px)' : 'translateX(0)',
                      transition: 'all 0.2s'
                    }}></div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button onClick={handleSave} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={18} /> Save Notification Settings
              </button>
            </div>
          </div>
        )}

        {/* --- SECURITY & ACCESS TAB --- */}
        {activeTab === 'sec' && (
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck color="var(--gurmad-green)" /> Security & Session Policy
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>SESSION TIMEOUT (MINUTES)</label>
                  <select 
                    value={securitySettings.sessionTimeout}
                    onChange={e => setSecuritySettings({...securitySettings, sessionTimeout: e.target.value})}
                    className="card" style={{ width: '100%', padding: '0.8rem', border: '1px solid var(--border-color)' }}
                  >
                    <option value="15">15 Minutes</option>
                    <option value="30">30 Minutes</option>
                    <option value="60">1 Hour</option>
                    <option value="0">Never</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>PASSWORD HISTORY</label>
                  <select 
                     value={securitySettings.passwordHistory}
                     onChange={e => setSecuritySettings({...securitySettings, passwordHistory: e.target.value})}
                     className="card" style={{ width: '100%', padding: '0.8rem', border: '1px solid var(--border-color)' }}
                  >
                    <option value="0">None</option>
                    <option value="3">Last 3 passwords</option>
                    <option value="5">Last 5 passwords</option>
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Two-Factor Authentication (2FA)</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Add an extra layer of security to your account.</div>
                </div>
                <div 
                  onClick={handle2FAToggle}
                  style={{ 
                    width: '44px', height: '24px', 
                    backgroundColor: securitySettings.twoFactor ? 'var(--gurmad-green)' : '#cbd5e1',
                    borderRadius: '12px', padding: '2px', cursor: 'pointer', transition: 'all 0.2s'
                }}>
                  <div style={{ 
                    width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%',
                    transform: securitySettings.twoFactor ? 'translateX(20px)' : 'translateX(0)',
                    transition: 'all 0.2s'
                  }}></div>
                </div>
              </div>
            </div>
            
            {/* 2FA SETUP MODAL */}
            {show2FAModal && (
              <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                   <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                      <ShieldCheck size={48} color="var(--gurmad-green)" style={{ marginBottom: '1rem' }} />
                      <h3 style={{ fontWeight: 700 }}>Enable 2FA</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Scan this QR code with your Authenticator app.</p>
                   </div>
                   
                   <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', margin: '0 auto 1.5rem', width: '200px' }}>
                      <img src={twoFAData.qrCode} alt="2FA QR Code" style={{ width: '100%', height: 'auto' }} />
                   </div>

                   <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>ENTER 6-DIGIT CODE</label>
                      <input 
                        type="text" 
                        placeholder="000000"
                        maxLength={6}
                        value={twoFAData.token}
                        onChange={e => setTwoFAData({...twoFAData, token: e.target.value})}
                        style={{ width: '100%', padding: '0.85rem', borderRadius: '10px', border: '2px solid var(--gurmad-green)', textAlign: 'center', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '4px' }}
                      />
                   </div>

                   <div style={{ display: 'flex', gap: '1rem' }}>
                      <button onClick={() => setShow2FAModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                      <button onClick={verifyAndEnable2FA} className="btn-primary" style={{ flex: 2 }}>Verify & Enable</button>
                   </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- USER MANAGEMENT TAB --- */}
        {activeTab === 'usr' && currentUser.role === 'admin' && (
          <div className="card">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
               <h3 style={{ fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users color="var(--gurmad-green)" /> User Management
               </h3>
               <button onClick={() => setShowCreateModal(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <User size={18} /> Create New User
               </button>
             </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  <th style={{ padding: '1rem' }}>USERNAME</th>
                  <th style={{ padding: '1rem' }}>FULL NAME</th>
                  <th style={{ padding: '1rem' }}>ROLE</th>
                  <th style={{ padding: '1rem' }}>STATUS</th>
                  <th style={{ padding: '1rem' }}>2FA</th>
                  <th style={{ padding: '1rem' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem', opacity: user.is_active === false ? 0.6 : 1 }}>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{user.username}</td>
                    <td style={{ padding: '1rem' }}>{user.full_name}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: '#f1f5f9', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {user.is_active === false ? (
                        <span style={{ color: '#ef4444', fontWeight: 600 }}>Inactive</span>
                      ) : (
                        <span style={{ color: 'var(--gurmad-green)', fontWeight: 600 }}>Active</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {user.two_factor_enabled ? (
                        <span style={{ color: 'var(--gurmad-green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ShieldCheck size={14} /> Enabled
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Disabled</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button 
                          onClick={() => setEditingUser(user)}
                          className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        >
                          Reset Pass
                        </button>
                        <button 
                          onClick={() => handleReset2FA(user.id)}
                          className="btn-secondary" style={{ 
                            padding: '0.4rem 0.8rem', 
                            fontSize: '0.8rem', 
                            color: user.two_factor_enabled ? '#ef4444' : 'var(--text-muted)',
                            opacity: user.two_factor_enabled ? 1 : 0.6
                          }}
                        >
                          {user.two_factor_enabled ? 'Reset 2FA' : 'Clear Sec'}
                        </button>
                        <button 
                          onClick={() => handleToggleStatus(user.id, user.is_active !== false)}
                          className="btn-secondary" style={{ 
                            padding: '0.4rem 0.8rem', 
                            fontSize: '0.8rem', 
                            color: user.is_active !== false ? '#f59e0b' : 'var(--gurmad-green)'
                          }}
                        >
                          {user.is_active !== false ? 'Deactivate' : 'Activate'}
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user.id)}
                          className="btn-secondary" style={{ 
                            padding: '0.4rem 0.8rem', 
                            fontSize: '0.8rem', 
                            color: '#ef4444',
                            borderColor: '#ef4444'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* RESET PASSWORD MODAL */}
            {editingUser && (
              <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                   <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Reset Password for {editingUser.username}</h3>
                   <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>NEW PASSWORD</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          type="text" 
                          value={newPass}
                          onChange={e => setNewPass(e.target.value)}
                          className="card" style={{ flex: 1, padding: '0.85rem', borderRadius: '8px' }}
                          placeholder="Password"
                        />
                        <button 
                          onClick={generatePassword}
                          className="btn-secondary" style={{ padding: '0.85rem', borderRadius: '8px' }}
                          title="Generate Random Password"
                        >
                          <RefreshCcw size={18} />
                        </button>
                      </div>
                   </div>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <button onClick={() => setEditingUser(null)} className="btn-secondary">Cancel</button>
                      <button onClick={() => handleResetPassword(editingUser.id)} className="btn-primary">Update Pass</button>
                   </div>
                   <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                      <button 
                        onClick={() => handleFullReset(editingUser.id)} 
                        className="btn-primary" 
                        style={{ width: '100%', backgroundColor: '#ef4444', borderColor: '#ef4444' }}
                      >
                        Full Reset (Pass + 2FA)
                      </button>
                   </div>
                </div>
              </div>
            )}

            {/* CREATE USER MODAL */}
            {showCreateModal && (
              <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                <div className="card" style={{ width: '100%', maxWidth: '450px' }}>
                   <h3 style={{ fontWeight: 700, marginBottom: '1.5rem' }}>Create New System User</h3>
                   <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>FULL NAME</label>
                        <input 
                          type="text" 
                          required
                          value={newUserData.full_name}
                          onChange={e => setNewUserData({...newUserData, full_name: e.target.value})}
                          className="card" style={{ width: '100%', padding: '0.85rem', borderRadius: '8px' }}
                          placeholder="e.g. Faarax Jaamac"
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>USERNAME</label>
                          <input 
                            type="text" 
                            required
                            value={newUserData.username}
                            onChange={e => setNewUserData({...newUserData, username: e.target.value})}
                            className="card" style={{ width: '100%', padding: '0.85rem', borderRadius: '8px' }}
                            placeholder="username"
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>PASSWORD</label>
                          <input 
                            type="password" 
                            required
                            value={newUserData.password}
                            onChange={e => setNewUserData({...newUserData, password: e.target.value})}
                            className="card" style={{ width: '100%', padding: '0.85rem', borderRadius: '8px' }}
                            placeholder="********"
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>SYSTEM ROLE</label>
                        <select
                          value={newUserData.role}
                          onChange={e => setNewUserData({...newUserData, role: e.target.value})}
                          className="card" style={{ width: '100%', padding: '0.85rem', borderRadius: '8px' }}
                        >
                          {roles.length > 0 ? roles.map(r => (
                            <option key={r.id} value={r.key}>{r.label}</option>
                          )) : (
                            // Fallback while /api/roles hasn't loaded yet, so the form still works
                            <>
                              <option value="admin">System Administrator</option>
                              <option value="gudoomiye">Gudoomiye (Chairman)</option>
                              <option value="collector">Collector (Field App)</option>
                              <option value="cashier">Cashier (Accounting)</option>
                            </>
                          )}
                        </select>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Need a role that isn't listed? Create it first under <strong>Roles & Permissions</strong>.
                        </p>
                      </div>
                      {(newUserData.role === 'gudoomiye' || newUserData.role === 'zone_accountant') && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>ZONE / GROUP (their office)</label>
                          <input
                            type="text"
                            required
                            value={newUserData.zone || ''}
                            onChange={e => setNewUserData({...newUserData, zone: e.target.value})}
                            className="card" style={{ width: '100%', padding: '0.85rem', borderRadius: '8px' }}
                            placeholder="e.g. Group1"
                          />
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Must exactly match the Zone/Group name used elsewhere (e.g. collector assignments).</p>
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                        <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">Cancel</button>
                        <button type="submit" disabled={isUpdating} className="btn-primary">
                          {isUpdating ? 'Creating...' : 'Create Account'}
                        </button>
                      </div>
                   </form>
                </div>
              </div>
            )}
          </div>
        )}


        {/* --- BACKUP TAB --- */}
        {activeTab === 'bac' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card" style={{ borderLeft: '6px solid var(--gurmad-green)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={20} color="var(--gurmad-green)" /> Database Cloud Backup
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Export all your system data to a secure JSON file.</p>
                </div>
                <button 
                  onClick={async () => {
                    setIsUpdating(true);
                    try {
                      const backupData = await api.generateBackup();
                      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
                      const blobUrl = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = blobUrl;
                      link.download = `gurmad-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(blobUrl);
                      toast.success('Backup generated successfully!');
                    } catch (err) {
                      toast.error('Backup failed: Admin access required');
                    } finally {
                      setIsUpdating(false);
                    }
                  }} 
                  className="btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.8rem 1.5rem' }}
                >
                  {isUpdating ? <RefreshCcw size={18} className="spin" /> : <Database size={18} />} 
                  {isUpdating ? 'Generating...' : 'Generate Full Backup'}
                </button>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '1.5rem' }}>Backup Settings</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>Automatic Daily Backup</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>The system will automatically create a backup every 24 hours.</div>
                  </div>
                  <div style={{ width: '44px', height: '24px', backgroundColor: 'var(--gurmad-green)', borderRadius: '12px', padding: '2px' }}>
                    <div style={{ width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%', transform: 'translateX(20px)' }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
               <h3 style={{ fontWeight: 700, color: '#991b1b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <AlertCircle size={20} /> Danger Zone
               </h3>
               <p style={{ fontSize: '0.85rem', color: '#991b1b', marginBottom: '1.5rem' }}>Restoring a backup will overwrite all current system data. This action is irreversible.</p>
               <button className="btn-secondary" style={{ backgroundColor: 'white', color: '#991b1b', borderColor: '#fecaca', fontWeight: 700 }}>Restore from File...</button>
            </div>
          </div>
        )}

        {/* --- PLACEHOLDER FOR NO-MATCH TAB (Fallthrough) --- */}
        {(activeTab !== 'gen' && activeTab !== 'cur' && activeTab !== 'app' && activeTab !== 'aut' && activeTab !== 'pro' && activeTab !== 'not' && activeTab !== 'sec' && activeTab !== 'bac' && activeTab !== 'usr') && (
           <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <AlertCircle size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                {sideMenu.find(m => m.id === activeTab)?.label}
              </h3>
              <p style={{ maxWidth: '400px' }}>
                Options for this section are coming soon. Customise other preferences for now.
              </p>
           </div>
        )}

      </div>
      
      <style>{`
        .spin { animation: rotate 1s linear infinite; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default SettingsView;
