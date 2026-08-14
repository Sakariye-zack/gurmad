import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { socket } from '../socket';
import { Search, Plus, MapPin, Phone, MoreHorizontal, Filter, Home, Map as MapIcon, User, XCircle, Edit3, Trash2, Calendar, MessageSquare, Wallet, CheckCircle2, AlertCircle, Navigation, CreditCard, FileSpreadsheet, Tag, Repeat, DollarSign, Lock, Unlock, KeyRound } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { exportToCSV } from '../utils/exportUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const LocationPicker = ({ pos, setPos }) => {
  useMapEvents({
    click(e) {
      setPos(e.latlng.lat, e.latlng.lng);
    },
  });
  return pos ? <Marker position={pos} /> : null;
};

const MonthlyCalendar = ({ collectionDaysString, collectionTime }) => {
  const collectionDays = collectionDaysString ? collectionDaysString.split(',').map(d => d.trim()) : [];
  
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-11
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const startingDayOfWeek = firstDay.getDay(); // 0 is Sun, 1 is Mon...
  const totalDays = lastDay.getDate();
  
  const daysOfWeekNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const isCollectionDay = (dateNum) => {
    const d = new Date(year, month, dateNum);
    const dayName = daysOfWeekNames[d.getDay()];
    return collectionDays.includes(dayName) || collectionDays.includes(dayName.substring(0, 3));
  };

  const grid = [];
  let currentWeek = [];
  for(let i=0; i<startingDayOfWeek; i++) currentWeek.push(null);
  for(let d=1; d<=totalDays; d++) {
     currentWeek.push(d);
     if (currentWeek.length === 7) { grid.push(currentWeek); currentWeek = []; }
  }
  if (currentWeek.length > 0) {
     while(currentWeek.length < 7) currentWeek.push(null);
     grid.push(currentWeek);
  }
  
  return (
    <div style={{ 
      background: 'white', 
      color: '#1e293b', 
      padding: '1.5rem', 
      borderRadius: '24px', 
      width: '100%', 
      fontFamily: 'Outfit, Inter, sans-serif', 
      boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
      border: '1px solid #f1f5f9'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1e293b' }}>{monthNames[month]} {year}</span>
          <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Collection Schedule</span>
        </div>
        {collectionTime && (
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '6px',
            backgroundColor: '#f0fdf4', padding: '6px 12px', borderRadius: '12px', 
            color: 'var(--gurmad-green)', fontSize: '0.8rem', fontWeight: 700,
            border: '1px solid #dcfce7'
          }}>
             <Calendar size={14} /> {collectionTime}
          </div>
        )}
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', marginBottom: '10px' }}>
        {daysOfWeekNames.map(d => <div key={d}>{d.substring(0, 3).toUpperCase()}</div>)}
      </div>
      
      {collectionDays.length === 0 && (
        <div style={{ marginBottom: '10px', padding: '8px 12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>
          No collection days set for this zone yet. Set them in Manage Zones.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {grid.map((week, wIdx) => (
          <div key={wIdx} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center' }}>
            {week.map((day, dIdx) => {
              if (!day) return <div key={dIdx} style={{ padding: '8px 0' }}></div>;
              const isToday = day === today.getDate();
              const isCol = isCollectionDay(day);
              
              let bg = '#f8fafc';
              let color = '#64748b';
              let fw = 600;
              let border = '1px solid #f1f5f9';
              let shadow = 'none';
              
              if (isCol) {
                 bg = 'var(--gurmad-green)';
                 color = 'white';
                 fw = 800;
                 border = 'none';
                 shadow = '0 4px 10px rgba(63, 174, 42, 0.3)';
              } else if (isToday) {
                 bg = 'white';
                 color = '#1e293b';
                 fw = 800;
                 border = '2px solid var(--gurmad-green)';
              }
              
              return (
                <div key={dIdx} style={{ 
                  position: 'relative', padding: '8px 0', background: bg, color: color,
                  fontWeight: fw, borderRadius: '12px', width: '100%', aspectRatio: '1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem',
                  border: border, boxShadow: shadow, transition: 'all 0.2s ease'
                }}>
                  {day}
                  {isCol && (
                    <div style={{ position: 'absolute', bottom: '4px', width: '4px', height: '4px', backgroundColor: 'white', borderRadius: '50%', opacity: 0.8 }} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};


const CustomerView = ({ searchQuery = '', currentUser }) => {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [zones, setZones] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [debtForm, setDebtForm] = useState({ amount: '', description: '', currency: 'USD' });
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ targetType: 'all', targetValue: '', message: '', type: 'sms' });
  const [isPortalModalOpen, setIsPortalModalOpen] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [portalPassword, setPortalPassword] = useState('');

  // Enable and Reset Password both hit the same backend endpoint — it always overwrites the
  // password and sets portal_enabled = TRUE, so "reset" is just calling it again on a customer
  // who already has portal access. isResetMode only changes the modal's text/labels.
  const handleEnablePortal = async (e) => {
    e.preventDefault();
    try {
      await api.enableCustomerPortal(selectedCustomer.id, portalPassword);
      toast.success(isResetMode ? 'Password reset successfully' : 'Customer Portal access enabled');
      setIsPortalModalOpen(false);
      setPortalPassword('');
      setIsResetMode(false);
      setSelectedCustomer({ ...selectedCustomer, portal_enabled: true });
    } catch (err) {
      toast.error(err.message || 'Failed to save password');
    }
  };

  const handleDisablePortal = async () => {
    if (!window.confirm('Revoke this customer\'s portal access?')) return;
    try {
      await api.disableCustomerPortal(selectedCustomer.id);
      toast.success('Customer Portal access revoked');
      setSelectedCustomer({ ...selectedCustomer, portal_enabled: false });
    } catch (err) {
      toast.error('Failed to revoke portal access');
    }
  };
  const [viewMode, setViewMode] = useState('list'); // 'list', 'details', or 'register'
  const [employees, setEmployees] = useState([]);
  const [localSearch, setLocalSearch] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = React.useRef(null);

  const parseCustomerCsv = (text) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const cells = line.split(',').map(c => c.trim());
      const row = {};
      headers.forEach((h, i) => { row[h] = cells[i] || ''; });
      return row;
    });
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsImporting(true);
      const text = await file.text();
      const rows = parseCustomerCsv(text);
      if (rows.length === 0) {
        toast.error('No rows found. Expected a header row: name,phone,house_no,street,area,zone,category');
        return;
      }
      const result = await api.bulkImportCustomers(rows);
      toast.success(`Imported ${result.created} customer(s)${result.failed ? `, ${result.failed} failed` : ''}`);
      if (result.errors?.length) console.warn('Bulk import errors:', result.errors);
      fetchCustomers();
    } catch (err) {
      toast.error(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const handleBroadcastSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.broadcastMessage(broadcastForm);
      toast.success(res.message || 'Fariinta si wadajir ah ayaa loo diray!', { icon: '🚀' });
      setIsBroadcastModalOpen(false);
      setBroadcastForm({ targetType: 'all', targetValue: '', message: '', type: 'sms' });
    } catch (err) {
      toast.error(err.message || 'Waa la diidi waayay fariinta');
    }
  };
  
  // Form State
  const [newCustomer, setNewCustomer] = useState({ 
    name: '', 
    phone: '', 
    house_no: '', 
    street: '', 
    area: 'Burao North',
    whatsapp: '',
    neighborhood: '',
    zone: '',
    category: 'Guri',
    fee: '10.00',
    collection_mode: 'Monthly',
    collector_id: '',
    lat: '',
    lng: '',
    route_order: '',
    collection_frequency: 'Weekly',
    payment_status: 'Unpaid'
  });


  useEffect(() => {
    fetchCustomers();
    fetchZones();
    fetchEmployees();

    socket.on('customer_status_updated', (data) => {
      setCustomers(prev => prev.map(c => 
        c.id === data.customerId ? { ...c, status: data.status, payment_status: data.status } : c
      ));
      setSelectedCustomer(prev => {
        if (prev && prev.id === data.customerId) {
          return { ...prev, status: data.status, payment_status: data.status };
        }
        return prev;
      });
    });

    return () => {
      socket.off('customer_status_updated');
    };
  }, []);

  const fetchEmployees = () => {
    api.getEmployees().then(setEmployees).catch(err => console.error("Failed to fetch employees", err));
  };

  const fetchZones = () => {
    api.getZones().then(setZones);
  };

  const fetchCustomers = () => {
    api.getCustomers().then(data => {
      setCustomers(data);
      if (selectedCustomer) {
        const updated = data.find(c => c.id === selectedCustomer.id);
        if (updated) setSelectedCustomer(updated);
      }
      setLoading(false);
    });
  };

  const handleMarkAsPaid = async () => {
    if (!selectedCustomer) return;
    try {
      toast.loading('Updating status...', { id: 'status' });
      await api.updateCustomer(selectedCustomer.id, { ...selectedCustomer, status: 'Paid' });
      toast.success('Customer status updated to PAID!', { id: 'status' });
      fetchCustomers();
    } catch (err) {
      toast.error('Failed to update status', { id: 'status' });
    }
  };

  const handleRecordDebt = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !debtForm.amount) return;
    try {
      toast.loading('Recording debt...', { id: 'debt' });
      await api.addDebt({
        customer_id: selectedCustomer.id,
        debtor_name: selectedCustomer.name,
        phone: selectedCustomer.phone,
        amount: debtForm.amount,
        currency: debtForm.currency,
        description: debtForm.description || 'Manual debt entry',
        zone: selectedCustomer.zone || '',
        house_no: selectedCustomer.house_no || ''
      });
      
      // Also update customer status to 'Debt'
      await api.updateCustomer(selectedCustomer.id, { ...selectedCustomer, status: 'Debt' });
      
      toast.success('Debt recorded and status updated!', { id: 'debt' });
      setIsDebtModalOpen(false);
      setDebtForm({ amount: '', description: '', currency: 'USD' });
      fetchCustomers();
    } catch (err) {
      toast.error('Failed to record debt', { id: 'debt' });
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    try {
      if (isEditMode && selectedCustomer) {
        await api.updateCustomer(selectedCustomer.id, newCustomer);
        toast.success(`${newCustomer.name} updated successfully!`);
      } else {
        await api.addCustomer(newCustomer);
        toast.success(`${newCustomer.name} has been formally registered!`, { icon: '🤝' });
      }
      setViewMode('list');
      setIsModalOpen(false);
      setIsEditMode(false);
      setNewCustomer({ 
        name: '', phone: '', house_no: '', street: '', area: 'Burao North', 
        whatsapp: '', neighborhood: '', zone: '', category: 'Guri', fee: '10.00', 
        collection_mode: 'Monthly', collector_id: '', lat: '', lng: '', 
        route_order: '', collection_frequency: 'Weekly', payment_status: 'Unpaid' 
      });

      fetchCustomers();
    } catch (err) {
      toast.error('Failed to save customer.');
    }
  };

  const startEdit = (customer) => {
    setSelectedCustomer(customer);
    setIsEditMode(true);
    setNewCustomer({
      name: customer.name,
      phone: customer.phone,
      house_no: customer.house_no,
      street: customer.street,
      area: customer.area,
      whatsapp: customer.whatsapp || '',
      neighborhood: customer.neighborhood || '',
      zone: customer.zone || '',
      category: customer.category || 'Guri',
      fee: customer.fee || (customer.category === 'Meherad' ? '20.00' : '10.00'),
      collection_mode: customer.collection_mode || 'Monthly',
      collector_id: customer.collector_id || '',
      lat: customer.lat || '',
      lng: customer.lng || '',
      route_order: customer.route_order || '',
      collection_frequency: customer.collection_frequency || 'Weekly',
      payment_status: customer.payment_status || customer.status || 'Unpaid'
    });

    setViewMode('register');
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setNewCustomer({ 
      name: '', phone: '', house_no: '', street: '', area: 'Burao North', 
      whatsapp: '', neighborhood: '', zone: '', category: 'Guri', fee: '10.00', 
      collection_mode: 'Monthly', collector_id: '', lat: '', lng: '',
      route_order: '', collection_frequency: 'Weekly', payment_status: 'Unpaid'
    });

    setViewMode('register');
  };
  
  const captureLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    
    setIsCapturing(true);
    toast.loading("Capturing precise location...", { id: 'gps' });
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNewCustomer(prev => ({
          ...prev,
          lat: position.coords.latitude.toFixed(8),
          lng: position.coords.longitude.toFixed(8)
        }));
        setIsCapturing(false);
        toast.success("Home GPS Captured! 📍", { id: 'gps' });
      },
      (error) => {
        console.error(error);
        setIsCapturing(false);
        toast.error("Failed to capture location. Please check permissions.", { id: 'gps' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) return;
    try {
      await api.deleteCustomer(id);
      toast.success('Customer deleted');
      setSelectedCustomer(null);
      fetchCustomers();
    } catch (err) {
      toast.error('Failed to delete customer');
    }
  };

  const filteredCustomers = useMemo(() => {
    const search = (localSearch || searchQuery).toLowerCase();
    return customers.filter(c => {
      const name = c.name?.toLowerCase() || '';
      const phone = c.phone?.toLowerCase() || '';
      const id = c.id?.toString() || '';
      
      return name.includes(search) || phone.includes(search) || id.includes(search);
    });
  }, [customers, searchQuery]);

  if (loading) return <div className="card glass">Loading customers from database...</div>;

  // Shared between both the list view and the details view, so it must not live inside either view's own early return.
  const debtModal = isDebtModalOpen && (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 1100, backdropFilter: 'blur(8px)', padding: '20px'
    }}>
      <div className="card scale-in" style={{ width: '100%', maxWidth: '400px', padding: '2rem', borderRadius: '24px', backgroundColor: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle color="#f97316" size={24} /> Record Debt
          </h3>
          <button onClick={() => setIsDebtModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <XCircle size={24} />
          </button>
        </div>

        <form onSubmit={handleRecordDebt} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>Debt Amount</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#94a3b8' }}>$</span>
              <input
                required
                type="number"
                step="0.01"
                placeholder="0.00"
                value={debtForm.amount}
                onChange={e => setDebtForm({...debtForm, amount: e.target.value})}
                style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2rem', borderRadius: '12px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1.1rem', fontWeight: 700 }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>Reason / Description</label>
            <textarea
              placeholder="e.g. Unpaid April garbage collection"
              value={debtForm.description}
              onChange={e => setDebtForm({...debtForm, description: e.target.value})}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '2px solid #f1f5f9', outline: 'none', minHeight: '80px', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '0.5rem' }}>
            <button type="button" onClick={() => setIsDebtModalOpen(false)} style={{ flex: 1, padding: '0.85rem', borderRadius: '12px', border: 'none', backgroundColor: '#f1f5f9', color: '#64748b', fontWeight: 700 }}>Cancel</button>
            <button type="submit" style={{ flex: 2, padding: '0.85rem', borderRadius: '12px', border: 'none', backgroundColor: '#f97316', color: 'white', fontWeight: 700, boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)' }}>Save Debt</button>
          </div>
        </form>
      </div>
    </div>
  );

  if (viewMode === 'details' && selectedCustomer) {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease-out', maxWidth: '1000px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <button 
            onClick={() => setViewMode('list')}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1.5rem', 
              borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: 'white', 
              color: '#475569', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = '#475569'; }}
          >
            <XCircle size={20} /> Back to Customers
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'white', padding: '10px 20px', borderRadius: '100px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
             <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: (selectedCustomer.status === 'Paid' ? '#10b981' : '#f43f5e'), animation: 'pulse 2s infinite' }}></div>
             <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status:</span>
             <span style={{ 
                color: selectedCustomer.status === 'Paid' ? '#10b981' : '#f43f5e', 
                fontSize: '0.95rem', textTransform: 'uppercase', fontWeight: 900,
                letterSpacing: '0.5px'
             }}>
                {selectedCustomer.status || 'Unpaid'}
             </span>
          </div>

          {(currentUser?.role === 'admin') && (
            selectedCustomer.portal_enabled ? (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => { setIsResetMode(true); setIsPortalModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '100px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', color: '#1d4ed8', fontWeight: 700, cursor: 'pointer' }}>
                  <KeyRound size={16} /> Reset Password
                </button>
                <button onClick={handleDisablePortal} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '100px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#b91c1c', fontWeight: 700, cursor: 'pointer' }}>
                  <Unlock size={16} /> Revoke Portal Access
                </button>
              </div>
            ) : (
              <button onClick={() => { setIsResetMode(false); setIsPortalModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '100px', border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', color: '#15803d', fontWeight: 700, cursor: 'pointer' }}>
                <Lock size={16} /> Enable Portal Access
              </button>
            )
          )}
        </div>

        {isPortalModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <div className="card glass" style={{ width: '400px', borderTop: `4px solid ${isResetMode ? '#3b82f6' : 'var(--gurmad-green)'}` }}>
              <h3 style={{ marginBottom: '0.5rem', fontWeight: 800 }}>{isResetMode ? 'Reset Portal Password' : 'Enable Customer Portal Access'}</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>
                {isResetMode
                  ? `${selectedCustomer.name} will keep logging in with their phone number (${selectedCustomer.phone}) — only the password changes to what you set below.`
                  : `${selectedCustomer.name} will be able to log in at /portal using their phone number (${selectedCustomer.phone}) and the password you set below.`}
              </p>
              <form onSubmit={handleEnablePortal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>{isResetMode ? 'New Password (min 6 characters)' : 'Password (min 6 characters)'}</label>
                  <input required minLength={6} type="text" value={portalPassword} onChange={e => setPortalPassword(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => { setIsPortalModalOpen(false); setPortalPassword(''); setIsResetMode(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontWeight: 600 }}>Cancel</button>
                  <button type="submit" className="btn-primary">{isResetMode ? 'Reset Password' : 'Enable Access'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TOP BANNER PROFILE */}
        <div className="card" style={{ 
          padding: '2.5rem', 
          borderRadius: '24px', 
          backgroundColor: 'white',
          border: '1px solid #f1f5f9',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '2rem',
          position: 'relative',
          overflow: 'hidden'
        }}>
           <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '250px', height: '250px', background: 'radial-gradient(circle, rgba(63, 174, 42, 0.05) 0%, transparent 70%)', zIndex: 0 }}></div>
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', position: 'relative', zIndex: 1 }}>
              <div style={{ 
                 width: '100px', height: '100px', borderRadius: '30px', 
                 background: 'linear-gradient(135deg, var(--gurmad-green) 0%, #34d399 100%)',
                 display: 'flex', alignItems: 'center', justifyContent: 'center', 
                 color: 'white', fontSize: '3rem', fontWeight: 900,
                 boxShadow: '0 10px 25px rgba(63, 174, 42, 0.3)',
                 border: '4px solid #f0fdf4'
               }}>
                 {selectedCustomer.name[0].toUpperCase()}
              </div>
              <div>
                 <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#0f172a', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>{selectedCustomer.name}</h2>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ backgroundColor: '#f0fdf4', padding: '6px 14px', borderRadius: '100px', fontSize: '0.85rem', fontWeight: 800, color: 'var(--gurmad-green)', border: '1px solid #dcfce7' }}>#GUR-{selectedCustomer.id}</div>
                    {selectedCustomer.area && selectedCustomer.area !== '-' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontWeight: 700, fontSize: '0.95rem' }}>
                         <MapPin size={16} /> {selectedCustomer.area}
                      </div>
                    )}
                 </div>
              </div>
           </div>

           <div style={{ display: 'flex', gap: '12px', position: 'relative', zIndex: 1 }}>
              <a href={`tel:${selectedCustomer.phone}`} style={{ width: '48px', height: '48px', borderRadius: '16px', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a', border: '1px solid #e2e8f0', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8fafc'}>
                 <Phone size={20} />
              </a>
              {selectedCustomer.whatsapp && (
                <a href={`https://wa.me/${selectedCustomer.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent('Asc ' + selectedCustomer.name + ', Gurmad Waste Management ayaa kula soo xidhiidhaya.')}`} target="_blank" rel="noopener noreferrer" style={{ width: '48px', height: '48px', borderRadius: '16px', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534', border: '1px solid #bbf7d0', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#bbf7d0'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#dcfce7'}>
                   <MessageSquare size={20} />
                </a>
              )}
              <div style={{ width: '1px', height: '48px', backgroundColor: '#e2e8f0', margin: '0 8px' }}></div>
              <button onClick={() => startEdit(selectedCustomer)} style={{ padding: '0 20px', height: '48px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#0f172a', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
                 <Edit3 size={18} color="var(--gurmad-green)" /> Edit
              </button>
              <button onClick={() => handleDelete(selectedCustomer.id)} style={{ width: '48px', height: '48px', borderRadius: '16px', border: 'none', backgroundColor: '#fff1f2', color: '#e11d48', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ffe4e6'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff1f2'}>
                 <Trash2 size={20} />
              </button>
           </div>
        </div>

        {/* QUICK STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
           <div className="card" style={{ backgroundColor: 'white', padding: '1.25rem 1.5rem', borderRadius: '20px', border: '1px solid #f1f5f9', borderLeftWidth: '4px', borderLeftColor: '#3b82f6', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '12px', color: '#3b82f6', flexShrink: 0 }}><Tag size={20} /></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.5px' }}>Category</div>
                <div style={{ color: '#0f172a', fontSize: '1.15rem', fontWeight: 900 }}>{selectedCustomer.category || 'Guri'}</div>
              </div>
           </div>
           <div className="card" style={{ backgroundColor: 'white', padding: '1.25rem 1.5rem', borderRadius: '20px', border: '1px solid #f1f5f9', borderLeftWidth: '4px', borderLeftColor: 'var(--gurmad-green)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '12px', color: 'var(--gurmad-green)', flexShrink: 0 }}><DollarSign size={20} /></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.5px' }}>Monthly Rate</div>
                <div style={{ color: 'var(--gurmad-green)', fontSize: '1.15rem', fontWeight: 900 }}>${parseFloat(selectedCustomer.fee || 0).toFixed(2)}</div>
              </div>
           </div>
           <div className="card" style={{ backgroundColor: 'white', padding: '1.25rem 1.5rem', borderRadius: '20px', border: '1px solid #f1f5f9', borderLeftWidth: '4px', borderLeftColor: '#9333ea', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ backgroundColor: '#f3e8ff', padding: '10px', borderRadius: '12px', color: '#9333ea', flexShrink: 0 }}><Repeat size={20} /></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.5px' }}>Billing Mode</div>
                <div style={{ color: '#0f172a', fontSize: '1.15rem', fontWeight: 900 }}>{selectedCustomer.collection_mode || 'Daily'}</div>
              </div>
           </div>
           <div className="card" style={{ backgroundColor: 'white', padding: '1.25rem 1.5rem', borderRadius: '20px', border: '1px solid #f1f5f9', borderLeftWidth: '4px', borderLeftColor: '#d97706', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ backgroundColor: '#fef3c7', padding: '10px', borderRadius: '12px', color: '#d97706', flexShrink: 0 }}><User size={20} /></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.5px' }}>Collector</div>
                <div style={{ color: '#d97706', fontSize: '1.05rem', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {employees.find(e => e.id === selectedCustomer.collector_id)?.name || 'Unassigned'}
                </div>
              </div>
           </div>
        </div>

        {/* MAIN GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Location Card */}
              <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                    <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '12px', color: '#3b82f6' }}><MapPin size={20} /></div>
                    <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>Service Location</span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Physical Address</div>
                      {selectedCustomer.house_no || selectedCustomer.neighborhood || selectedCustomer.street ? (
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', lineHeight: '1.5' }}>
                          {selectedCustomer.house_no && <>House {selectedCustomer.house_no}<br /></>}
                          {selectedCustomer.neighborhood || selectedCustomer.street}
                        </div>
                      ) : (
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#94a3b8', fontStyle: 'italic' }}>No address on file</div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '12px' }}>
                       <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Zone ID</div>
                          <div style={{ fontWeight: 900, color: '#0f172a' }}>{selectedCustomer.zone || 'N/A'}</div>
                       </div>
                       <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Location Pin</div>
                          <div style={{ fontWeight: 900, color: selectedCustomer.lat ? 'var(--gurmad-green)' : '#94a3b8' }}>{selectedCustomer.lat ? 'SET' : 'NOT SET'}</div>
                       </div>
                    </div>

                    {selectedCustomer.lat && (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${selectedCustomer.lat},${selectedCustomer.lng}`} target="_blank" rel="noopener noreferrer" style={{ padding: '1rem', borderRadius: '16px', background: '#f0fdf4', border: '1px solid #dcfce7', color: 'var(--gurmad-green)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 800, transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#dcfce7'} onMouseLeave={e => e.currentTarget.style.background = '#f0fdf4'}>
                         <Navigation size={18} /> Open in Maps
                      </a>
                    )}
                  </div>
              </div>

              {/* Finance Card */}
              <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                      <div style={{ backgroundColor: '#fef3c7', padding: '10px', borderRadius: '12px', color: '#d97706' }}><Wallet size={20} /></div>
                      <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>Billing & Collections</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button 
                          onClick={handleMarkAsPaid}
                          disabled={selectedCustomer.status === 'Paid'}
                          style={{ 
                            width: '100%', padding: '1rem', borderRadius: '16px', border: 'none', 
                            backgroundColor: selectedCustomer.status === 'Paid' ? '#f0fdf4' : 'var(--gurmad-green)', 
                            color: selectedCustomer.status === 'Paid' ? 'var(--gurmad-green)' : 'white', fontWeight: 800, cursor: selectedCustomer.status === 'Paid' ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '1rem', transition: '0.2s', boxShadow: selectedCustomer.status === 'Paid' ? 'none' : '0 4px 10px rgba(63, 174, 42, 0.2)'
                          }}
                        >
                          {selectedCustomer.status === 'Paid' ? <CheckCircle2 size={20} /> : <Wallet size={20} />} 
                          {selectedCustomer.status === 'Paid' ? 'PAID & SETTLED' : 'RECORD PAYMENT'}
                        </button>
                        <button 
                          onClick={() => {
                            setDebtForm({ amount: selectedCustomer.fee || '', description: `Unpaid collection fee for ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`, currency: 'USD' });
                            setIsDebtModalOpen(true);
                          }}
                          style={{ 
                            width: '100%', padding: '1rem', borderRadius: '16px', border: '1px solid #e2e8f0', 
                            backgroundColor: '#f8fafc', color: '#475569', fontWeight: 800, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: '0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        >
                          <AlertCircle size={20} color="#64748b" /> LOG REVENUE DEBT
                        </button>
                  </div>
              </div>
           </div>

           <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {(() => {
                  const z = selectedCustomer.zone ? zones.find(zone => zone.name === selectedCustomer.zone) : null;
                  return (
                    <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                        <div style={{ backgroundColor: '#f3e8ff', padding: '10px', borderRadius: '12px', color: '#9333ea' }}><Calendar size={20} /></div>
                        <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>Collection Timeline</span>
                      </div>
                      {z ? (
                        <MonthlyCalendar collectionDaysString={z.collection_days} collectionTime={z.collection_time} />
                      ) : (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600 }}>
                          {selectedCustomer.zone
                            ? `Zone "${selectedCustomer.zone}" not found in Manage Zones.`
                            : 'No zone assigned to this customer yet.'}
                        </div>
                      )}
                    </div>
                  );
              })()}
           </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '3rem', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
          Customer record created on {new Date(selectedCustomer.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>

        {debtModal}
      </div>
    );
  }

  if (viewMode === 'register') {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease-out', maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '2rem' }}>
          <button 
            onClick={() => setViewMode('list')}
            style={{ 
              padding: '0.6rem', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: 'white', 
              color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <XCircle size={24} />
          </button>
          <div>
            <h2 style={{ margin: 0, fontWeight: 900, color: '#1e293b' }}>{isEditMode ? 'Edit Customer' : 'Register New Customer'}</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Fill in the details below to complete registration</p>
          </div>
        </div>

        <div className="card" style={{ padding: '2.5rem', borderRadius: '32px', backgroundColor: 'white', border: '1px solid #f1f5f9', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)' }}>
            <form onSubmit={handleAddCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Full Name</label>
                  <input required placeholder="e.g. Jama Ali" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1rem', fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Phone Number</label>
                  <input required placeholder="e.g. 063-4455667" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1rem', fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>WhatsApp (Optional)</label>
                  <input placeholder="e.g. 063-4455667" value={newCustomer.whatsapp} onChange={e => setNewCustomer({...newCustomer, whatsapp: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1rem', fontWeight: 600 }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>House No</label>
                  <input required placeholder="C-102" value={newCustomer.house_no} onChange={e => setNewCustomer({...newCustomer, house_no: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1rem', fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Xaafada (Neighborhood)</label>
                  <input required placeholder="Sayidka" value={newCustomer.neighborhood} onChange={e => setNewCustomer({...newCustomer, neighborhood: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1rem', fontWeight: 600 }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Area / District</label>
                  <input 
                    placeholder="e.g. Burao North" 
                    value={newCustomer.area} 
                    onChange={e => setNewCustomer({...newCustomer, area: e.target.value})} 
                    style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1rem', fontWeight: 600 }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Collection Zone</label>
                  <select 
                    value={newCustomer.zone} 
                    onChange={e => {
                      const zoneName = e.target.value;
                      const selectedZone = zones.find(z => z.name === zoneName);
                      setNewCustomer(prev => ({
                        ...prev, 
                        zone: zoneName,
                        collector_id: selectedZone?.collector_id || prev.collector_id,
                        // Ensure fee is set to at least 10 if it's empty or 0
                        fee: (prev.fee === '' || prev.fee === '0' || prev.fee === '0.00') ? '10.00' : prev.fee
                      }));
                    }} 
                    style={{ 
                      width: '100%', padding: '1rem', borderRadius: '14px', 
                      border: '2px solid ' + (newCustomer.zone ? '#3FAE2A' : '#f1f5f9'), 
                      outline: 'none', fontSize: '1rem', fontWeight: 700 
                    }}
                  >
                    <option value="">Select Zone</option>
                    {zones.map(z => (
                      <option key={z.id} value={z.name}>{z.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Nooca (Category)</label>
                  <select 
                    value={newCustomer.category} 
                    onChange={e => {
                      const cat = e.target.value;
                      // Only set default fee if user hasn't manually entered one or if it's the default of the previous category
                      setNewCustomer(prev => {
                        const shouldUpdateFee = prev.fee === '' || prev.fee === '10.00' || prev.fee === '20.00';
                        const newFee = shouldUpdateFee ? (cat === 'Meherad' ? '20.00' : '10.00') : prev.fee;
                        return {...prev, category: cat, fee: newFee};
                      });
                    }} 
                    style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1rem', fontWeight: 600 }}
                  >
                    <option value="Guri">Guri (Residential)</option>
                    <option value="Meherad">Meherad (Commercial)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Qiimaha (Monthly Fee $)</label>
                  <input required type="number" step="0.01" placeholder="0.00" value={newCustomer.fee} onChange={e => setNewCustomer({...newCustomer, fee: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1.2rem', fontWeight: 900, color: 'var(--gurmad-green)' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Habka lacag bixinta (Mode)</label>
                  <select value={newCustomer.collection_mode} onChange={e => setNewCustomer({...newCustomer, collection_mode: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1rem', fontWeight: 600 }}>
                    <option value="Monthly">Bishii mar (Monthly)</option>
                    <option value="Daily">Maalinle (Daily)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Collector ID (Assigned)</label>
                  <select 
                    value={newCustomer.collector_id} 
                    onChange={e => setNewCustomer({...newCustomer, collector_id: e.target.value})} 
                    style={{ 
                      width: '100%', padding: '1rem', borderRadius: '14px', 
                      border: '2px solid ' + (newCustomer.collector_id ? '#3FAE2A' : '#f1f5f9'), 
                      outline: 'none', fontSize: '1rem', fontWeight: 800,
                      backgroundColor: newCustomer.collector_id ? '#f0fdf4' : 'white'
                    }}
                  >
                    <option value="">-- Select Collector --</option>
                    {employees.filter(emp => emp.role === 'Waste Collector' || emp.role === 'Collector').map(emp => (
                       <option key={emp.id} value={emp.id}>{emp.id} - {emp.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Route Priority (Order)</label>
                  <input type="number" placeholder="1" value={newCustomer.route_order} onChange={e => setNewCustomer({...newCustomer, route_order: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1rem', fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Collection Freq.</label>
                  <select value={newCustomer.collection_frequency} onChange={e => setNewCustomer({...newCustomer, collection_frequency: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1rem', fontWeight: 600 }}>
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Bi-Weekly">Bi-Weekly</option>
                    <option value="On-Call">On-Call</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Payment Status</label>
                  <div style={{
                    width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9',
                    fontSize: '1rem', fontWeight: 700, backgroundColor: '#f8fafc',
                    color: newCustomer.payment_status === 'Paid' ? '#10b981' : '#f43f5e'
                  }}>
                    {newCustomer.payment_status || 'Unpaid'}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>
                    Set automatically when the cashier records a real payment - not editable here.
                  </p>
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase' }}>
                  <Search size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                  Google Maps Location Search
                </label>
                <input 
                  type="text" 
                  placeholder="Search for a specific place in Burao..." 
                  style={{ 
                    width: '100%', padding: '1.1rem', borderRadius: '16px', 
                    border: '2px solid #3FAE2A', outline: 'none', 
                    fontSize: '1rem', backgroundColor: '#ffffff', fontWeight: 600,
                    boxShadow: '0 4px 6px -1px rgba(63, 174, 42, 0.1)'
                  }}
                  onFocus={(e) => {
                    if (window.google && !e.target.dataset.autocomplete) {
                      const autocomplete = new window.google.maps.places.Autocomplete(e.target, {
                        componentRestrictions: { country: 'so' },
                        fields: ['geometry', 'name']
                      });
                      autocomplete.addListener('place_changed', () => {
                        const place = autocomplete.getPlace();
                        if (place.geometry) {
                          const lat = place.geometry.location.lat();
                          const lng = place.geometry.location.lng();
                          setNewCustomer(prev => ({ ...prev, lat: lat.toFixed(8), lng: lng.toFixed(8) }));
                          toast.success(`Location identified: ${place.name}`);
                        }
                      });
                      e.target.dataset.autocomplete = "true";
                    }
                  }}
                />
              </div>

              <div style={{ backgroundColor: '#f0fdf4', padding: '1.5rem', borderRadius: '24px', border: '1px solid #dcfce7' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>GPS Home Location (Satellite Map)</label>
                  <button 
                    type="button"
                    onClick={captureLocation}
                    disabled={isCapturing}
                    style={{ 
                      padding: '8px 18px', borderRadius: '100px', backgroundColor: '#3FAE2A', color: 'white', 
                      fontSize: '0.85rem', fontWeight: 800, border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(63, 174, 42, 0.3)'
                    }}
                  >
                    <MapPin size={16} /> {isCapturing ? 'Capturing...' : 'Capture GPS'}
                  </button>
                </div>
                
                <div style={{ height: '300px', width: '100%', borderRadius: '20px', overflow: 'hidden', marginBottom: '1.25rem', border: '2px solid white', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
                  <MapContainer 
                    center={[newCustomer.lat || 9.524, newCustomer.lng || 45.535]} 
                    zoom={15} 
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url={`https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBtwC1mQXQls62Q7CzTpnU0qyVJzevPZTs'}`}
                      subdomains={['mt0','mt1','mt2','mt3']}
                      attribution='&copy; Google Maps'
                    />
                    <LocationPicker 
                      pos={newCustomer.lat && newCustomer.lng ? [newCustomer.lat, newCustomer.lng] : null} 
                      setPos={(lat, lng) => setNewCustomer({...newCustomer, lat: lat.toFixed(8), lng: lng.toFixed(8)})} 
                    />
                  </MapContainer>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#166534', marginBottom: '4px' }}>LATITUDE</div>
                    <input readOnly placeholder="Lat" value={newCustomer.lat} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #dcfce7', fontSize: '0.9rem', backgroundColor: '#fff', fontWeight: 600 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#166534', marginBottom: '4px' }}>LONGITUDE</div>
                    <input readOnly placeholder="Lng" value={newCustomer.lng} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #dcfce7', fontSize: '0.9rem', backgroundColor: '#fff', fontWeight: 600 }} />
                  </div>
                </div>
              </div>
              
              <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setViewMode('list')} style={{ padding: '1rem 2rem', fontWeight: 800, color: '#64748b', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '1rem 3rem', borderRadius: '18px', fontSize: '1.1rem', backgroundColor: isEditMode ? 'var(--gurmad-orange)' : 'var(--gurmad-green)' }}>
                  {isEditMode ? 'Update Customer' : 'Confirm Registration'}
                </button>
              </div>
            </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: isMobile ? 'center' : 'space-between', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: isMobile ? '100%' : '400px' }}>
          <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
             type="text" 
             placeholder="Search by name, ID or phone..." 
             value={localSearch}
             onChange={(e) => setLocalSearch(e.target.value)}
             style={{ 
               width: '100%', padding: '0.85rem 1rem 0.85rem 3rem', borderRadius: '16px', 
               border: '1px solid var(--border-color)', outline: 'none', fontSize: '1rem', fontWeight: 600,
               backgroundColor: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
             }} 
          />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setIsBroadcastModalOpen(true)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1rem', 
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
              fontWeight: 600, backgroundColor: 'white', color: '#4f46e5'
            }}
          >
            <MessageSquare size={18} /> Broadcast
          </button>
          <button style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '0.6rem 1rem', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--border-color)',
            fontWeight: 500,
            backgroundColor: 'white'
          }}>
            <Filter size={18} />
            Filter
          </button>
          <button
            onClick={() => exportToCSV(filteredCustomers, 'Gurmad_Customers')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.25rem',
              backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0',
              borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer'
            }}
          >
            <FileSpreadsheet size={18} />
            {t('export_excel')}
          </button>
          {(currentUser?.role === 'admin' || currentUser?.role === 'gudoomiye') && (
            <>
              <input
                type="file"
                accept=".csv"
                ref={importInputRef}
                onChange={handleImportFile}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => importInputRef.current?.click()}
                disabled={isImporting}
                title="CSV columns: name,phone,house_no,street,area,zone,category"
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.25rem',
                  backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer'
                }}
              >
                <FileSpreadsheet size={18} />
                {isImporting ? 'Importing...' : 'Import CSV'}
              </button>
            </>
          )}
          <button
            onClick={openAddModal}
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.25rem' }}
          >
            <Plus size={18} />
            Add Customer
          </button>
        </div>
      </div>

      {/* Customer Modal is now handled by viewMode page */}

      {/* Record Debt Modal */}
      {debtModal}

      {/* Broadcast Modal */}
      {isBroadcastModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div className="card" style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                  <MessageSquare size={24} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#1e293b' }}>Broadcast Message</h3>
              </div>
              <button onClick={() => setIsBroadcastModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><XCircle size={24} color="#94a3b8" /></button>
            </div>

            <form onSubmit={handleBroadcastSubmit}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, color: '#475569', fontSize: '0.9rem' }}>Ku socota (Target):</label>
                <select 
                  value={broadcastForm.targetType}
                  onChange={(e) => setBroadcastForm({...broadcastForm, targetType: e.target.value})}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '1rem', fontWeight: 600, outline: 'none' }}
                >
                  <option value="all">Dhammaan Macaamiisha</option>
                  <option value="unpaid">Macaamiisha Deynka lagu leeyahay</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, color: '#475569', fontSize: '0.9rem' }}>Nooca Fariinta (Type):</label>
                <select 
                  value={broadcastForm.type}
                  onChange={(e) => setBroadcastForm({...broadcastForm, type: e.target.value})}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '1rem', fontWeight: 600, outline: 'none' }}
                >
                  <option value="sms">SMS Message</option>
                  <option value="whatsapp">WhatsApp Message</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, color: '#475569', fontSize: '0.9rem' }}>Fariinta (Message):</label>
                <textarea 
                  required
                  value={broadcastForm.message}
                  onChange={(e) => setBroadcastForm({...broadcastForm, message: e.target.value})}
                  placeholder="Maanta ayaa xashiishka la idiinka qaadayaa saacaddaa ee sii diyaar garooba..."
                  rows="4"
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '1rem', fontWeight: 500, outline: 'none', resize: 'vertical' }}
                />
                <small style={{ color: '#64748b', fontSize: '0.8rem' }}>Waxaad isticmaali kartaa {'{name}'} si loogu badalo magaca macmiilka.</small>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setIsBroadcastModalOpen(false)} style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: 'none', backgroundColor: '#f1f5f9', color: '#64748b', fontWeight: 800, cursor: 'pointer' }}>JOOJI</button>
                <button type="submit" style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: 'none', backgroundColor: '#4f46e5', color: 'white', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <MessageSquare size={18} /> DIR FARIINTA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>CUSTOMER</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>ADDRESS</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>PHONE</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>STATUS</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>PAYMENT</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length === 0 ? (
                <tr>
                    <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No customers found matching your search.
                    </td>
                </tr>
            ) : filteredCustomers.map((c) => (
              <tr key={c.id} 
                  onClick={() => { setSelectedCustomer(c); setViewMode('details'); }}
                  style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s', cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ 
                      width: '36px', 
                      height: '36px', 
                      borderRadius: '50%', 
                      backgroundColor: 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      color: 'var(--gurmad-green)'
                    }}>
                      {c.name ? c.name[0].toUpperCase() : 'C'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{c.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: #GUR-{c.id}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <MapPin size={16} style={{ marginTop: '2px', color: 'var(--text-muted)' }} />
                    <div style={{ fontSize: '0.9rem' }}>
                      <span style={{ fontWeight: 500 }}>{c.house_no}</span> {c.neighborhood || c.street ? `, ${c.neighborhood || c.street}` : ''}<br />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.area} {c.zone ? `(${c.zone})` : ''}</span>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 500 }}>
                      <Phone size={14} style={{ color: 'var(--text-muted)' }} />
                      {c.phone}
                    </div>
                    {c.whatsapp && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#25D366' }}>
                        <MessageSquare size={14} />
                        {c.whatsapp}
                      </div>
                    )}
                  </div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <span className={`badge badge-${c.status?.toLowerCase() || 'unpaid'}`}>
                    {c.status || 'Unpaid'}
                  </span>
                </td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      const event = new CustomEvent('switchTab', { detail: 'billing' });
                      window.dispatchEvent(event);
                      // Set search query in billing (this assumes we have a way to pass it, or we use a custom event)
                      setTimeout(() => {
                        const searchInput = document.querySelector('input[placeholder="Magaca ama Taleefanka..."]');
                        if (searchInput) {
                          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                          nativeInputValueSetter.call(searchInput, c.name);
                          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                      }, 100);
                    }}
                    style={{ 
                      padding: '6px 14px', 
                      borderRadius: '10px', 
                      backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                      color: 'var(--gurmad-green)', 
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      margin: '0 auto'
                    }}
                  >
                    <CreditCard size={14} /> Pay/Debt
                  </button>
                </td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedCustomer(c); setViewMode('details'); }}
                    style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }} 
                    title="View options"
                  >
                      <MoreHorizontal size={20} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
};

export default CustomerView;
