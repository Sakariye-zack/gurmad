import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { Search, Plus, MapPin, Phone, MoreHorizontal, Filter, Home, Map as MapIcon, User, XCircle, Edit3, Trash2, Calendar, MessageSquare, Wallet, CheckCircle2, AlertCircle, Navigation, CreditCard, FileSpreadsheet } from 'lucide-react';
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
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
      color: '#f1f5f9', 
      padding: '1.25rem', 
      borderRadius: '16px', 
      width: '100%', 
      fontFamily: 'Outfit, Inter, sans-serif', 
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
      border: '1px solid rgba(255,255,255,0.1)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.01em' }}>{monthNames[month]} {year}</span>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collection Schedule</span>
        </div>
        {collectionTime && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            backgroundColor: 'rgba(2, 132, 199, 0.2)', 
            padding: '6px 12px', 
            borderRadius: '12px', 
            color: '#38bdf8',
            fontSize: '0.8rem',
            fontWeight: 600,
            border: '1px solid rgba(56, 189, 248, 0.2)'
          }}>
             <Calendar size={14} />
             {collectionTime}
          </div>
        )}
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '10px' }}>
        {daysOfWeekNames.map(d => <div key={d}>{d.substring(0, 3).toUpperCase()}</div>)}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {grid.map((week, wIdx) => (
          <div key={wIdx} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center' }}>
            {week.map((day, dIdx) => {
              if (!day) return <div key={dIdx} style={{ padding: '8px 0' }}></div>;
              const isToday = day === today.getDate();
              const isCol = isCollectionDay(day);
              
              let bg = 'rgba(255,255,255,0.03)';
              let color = '#94a3b8';
              let fw = 500;
              let border = '1px solid rgba(255,255,255,0.05)';
              let shadow = 'none';
              
              if (isCol) {
                 bg = 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)';
                 color = 'white';
                 fw = 700;
                 border = 'none';
                 shadow = '0 4px 10px rgba(2, 132, 199, 0.4)';
              } else if (isToday) {
                 bg = 'rgba(255,255,255,0.1)';
                 color = 'white';
                 fw = 700;
                 border = '1px solid rgba(255,255,255,0.2)';
              }
              
              return (
                <div key={dIdx} style={{ 
                  position: 'relative',
                  padding: '8px 0', 
                  background: bg, 
                  color: color,
                  fontWeight: fw,
                  borderRadius: '10px',
                  width: '100%',
                  aspectRatio: '1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  border: border,
                  boxShadow: shadow,
                  transition: 'all 0.2s ease'
                }}>
                  {day}
                  {isCol && (
                    <div style={{ 
                      position: 'absolute', 
                      bottom: '4px', 
                      width: '4px', 
                      height: '4px', 
                      backgroundColor: 'white', 
                      borderRadius: '50%',
                      opacity: 0.6
                    }} />
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


const CustomerView = ({ searchQuery = '' }) => {
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
  const [viewMode, setViewMode] = useState('list'); // 'list', 'details', or 'register'
  const [employees, setEmployees] = useState([]);
  const [localSearch, setLocalSearch] = useState('');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
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

  if (viewMode === 'details' && selectedCustomer) {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease-out', maxWidth: '1000px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <button 
            onClick={() => setViewMode('list')}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', padding: '0.85rem 1.75rem', 
              borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(15, 23, 42, 0.8)', 
              color: 'white', fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 10px 20px -5px rgba(0, 0, 0, 0.2)',
              backdropFilter: 'blur(12px)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(-6px)'; e.currentTarget.style.backgroundColor = '#1e293b'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.8)'; }}
          >
            <XCircle size={22} color="#94a3b8" /> Back to Dashboard
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', backgroundColor: '#0f172a', padding: '10px 24px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.05)' }}>
             <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: (selectedCustomer.status === 'Paid' ? '#10b981' : '#f43f5e'), animation: 'pulse 1.5s infinite' }}></div>
             <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>System Status:</span>
             <span style={{ 
                color: selectedCustomer.status === 'Paid' ? '#10b981' : '#f43f5e', 
                fontSize: '0.9rem', textTransform: 'uppercase', fontWeight: 900,
                letterSpacing: '0.5px'
             }}>
                {selectedCustomer.status || 'Unpaid'}
             </span>
          </div>
        </div>

        {/* NEW STRUCTURE: TOP BANNER PROFILE */}
        <div className="card glass" style={{ 
          padding: '2.5rem', 
          borderRadius: '40px', 
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.3)',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '2rem',
          position: 'relative',
          overflow: 'hidden'
        }}>
           <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '250px', height: '250px', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)', zIndex: 0 }}></div>
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem', position: 'relative', zIndex: 1 }}>
              <div style={{ 
                 width: '120px', height: '120px', borderRadius: '40px', 
                 background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                 display: 'flex', alignItems: 'center', justifyContent: 'center', 
                 color: 'white', fontSize: '3.5rem', fontWeight: 900,
                 boxShadow: '0 20px 40px rgba(16, 185, 129, 0.3)',
                 border: '4px solid rgba(255,255,255,0.1)'
               }}>
                 {selectedCustomer.name[0].toUpperCase()}
              </div>
              <div>
                 <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white', marginBottom: '0.25rem', letterSpacing: '-0.03em' }}>{selectedCustomer.name}</h2>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: '6px 18px', borderRadius: '100px', fontSize: '0.9rem', fontWeight: 900, color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.2)' }}>#GUR-{selectedCustomer.id}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontWeight: 700 }}>
                       <MapPin size={18} /> {selectedCustomer.area}
                    </div>
                 </div>
              </div>
           </div>

           <div style={{ display: 'flex', gap: '15px', position: 'relative', zIndex: 1 }}>
              <a href={`tel:${selectedCustomer.phone}`} style={{ width: '56px', height: '56px', borderRadius: '20px', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', border: '1px solid rgba(255,255,255,0.1)', transition: '0.3s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}>
                 <Phone size={24} />
              </a>
              {selectedCustomer.whatsapp && (
                <a href={`https://wa.me/${selectedCustomer.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent('Asc ' + selectedCustomer.name + ', Gurmad Waste Management ayaa kula soo xidhiidhaya.')}`} target="_blank" rel="noopener noreferrer" style={{ width: '56px', height: '56px', borderRadius: '20px', backgroundColor: 'rgba(37, 211, 102, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#25D366', border: '1px solid rgba(37, 211, 102, 0.2)', transition: '0.3s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(37, 211, 102, 0.25)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(37, 211, 102, 0.15)'}>
                   <MessageSquare size={24} />
                </a>
              )}
              <div style={{ width: '1px', height: '56px', backgroundColor: 'rgba(255,255,255,0.05)', margin: '0 10px' }}></div>
              <button onClick={() => startEdit(selectedCustomer)} style={{ padding: '0 24px', height: '56px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                 <Edit3 size={20} color="#34d399" /> Edit
              </button>
              <button onClick={() => handleDelete(selectedCustomer.id)} style={{ width: '56px', height: '56px', borderRadius: '20px', border: 'none', backgroundColor: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <Trash2 size={24} />
              </button>
           </div>
        </div>

        {/* TOP ROW: QUICK STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
           <div className="card glass" style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: '1.5rem', borderRadius: '28px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>Category</div>
              <div style={{ color: 'white', fontSize: '1.3rem', fontWeight: 900 }}>{selectedCustomer.category || 'Guri'}</div>
           </div>
           <div className="card glass" style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: '1.5rem', borderRadius: '28px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>Monthly Rate</div>
              <div style={{ color: '#10b981', fontSize: '1.3rem', fontWeight: 900 }}>${parseFloat(selectedCustomer.fee || 0).toFixed(2)}</div>
           </div>
           <div className="card glass" style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: '1.5rem', borderRadius: '28px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>Billing Mode</div>
              <div style={{ color: 'white', fontSize: '1.3rem', fontWeight: 900 }}>{selectedCustomer.collection_mode || 'Daily'}</div>
           </div>
           <div className="card glass" style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: '1.5rem', borderRadius: '28px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>Collector</div>
              <div style={{ color: '#f59e0b', fontSize: '1.1rem', fontWeight: 900 }}>{selectedCustomer.collector_id || 'NONE'}</div>
           </div>
        </div>

        {/* MAIN GRID: 2 COLUMNS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
           
           <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Location Card */}
              <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', padding: '2.5rem', borderRadius: '40px', border: '1px solid rgba(255, 255, 255, 0.05)', boxShadow: '0 40px 80px rgba(0,0,0,0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '2rem' }}>
                    <div style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', padding: '12px', borderRadius: '16px', color: '#3b82f6' }}><MapPin size={24} /></div>
                    <span style={{ fontSize: '1.3rem', fontWeight: 900, color: 'white' }}>Service Location</span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Physical Address</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'white', lineHeight: '1.4' }}>
                        House {selectedCustomer.house_no}<br />
                        {selectedCustomer.neighborhood || selectedCustomer.street}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '12px' }}>
                       <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '5px' }}>Zone ID</div>
                          <div style={{ fontWeight: 900, color: '#10b981' }}>{selectedCustomer.zone || 'N/A'}</div>
                       </div>
                       <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '5px' }}>Radar Status</div>
                          <div style={{ fontWeight: 900, color: selectedCustomer.lat ? '#10b981' : '#f43f5e' }}>{selectedCustomer.lat ? 'ACTIVE' : 'OFFLINE'}</div>
                       </div>
                    </div>

                    {selectedCustomer.lat && (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${selectedCustomer.lat},${selectedCustomer.lng}`} target="_blank" rel="noopener noreferrer" style={{ padding: '1.25rem', borderRadius: '24px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontWeight: 900, transition: '0.3s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}>
                         <Navigation size={22} /> OPEN IN SATELLITE MAP
                      </a>
                    )}
                  </div>
              </div>

              {/* Finance Card */}
              <div style={{ backgroundColor: '#020617', padding: '2.5rem', borderRadius: '40px', color: 'white', border: '1px solid rgba(255, 255, 255, 0.05)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
                      <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: '12px', borderRadius: '16px', color: '#38bdf8' }}><Wallet size={24} /></div>
                      <span style={{ fontSize: '1.3rem', fontWeight: 900 }}>Billing & Collections</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button 
                          onClick={handleMarkAsPaid}
                          disabled={selectedCustomer.status === 'Paid'}
                          style={{ 
                            width: '100%', padding: '1.25rem', borderRadius: '24px', border: 'none', 
                            backgroundColor: selectedCustomer.status === 'Paid' ? 'rgba(16, 185, 129, 0.15)' : '#10b981', 
                            color: selectedCustomer.status === 'Paid' ? '#34d399' : 'white', fontWeight: 900, cursor: selectedCustomer.status === 'Paid' ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '1.1rem', transition: '0.3s'
                          }}
                        >
                          {selectedCustomer.status === 'Paid' ? <CheckCircle2 size={24} /> : <Wallet size={24} />} 
                          {selectedCustomer.status === 'Paid' ? 'PAID & SETTLED' : 'RECORD PAYMENT NOW'}
                        </button>
                        <button 
                          onClick={() => {
                            setDebtForm({ amount: selectedCustomer.fee || '', description: `Unpaid collection fee for ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`, currency: 'USD' });
                            setIsDebtModalOpen(true);
                          }}
                          style={{ 
                            width: '100%', padding: '1.25rem', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.05)', 
                            backgroundColor: 'rgba(255, 255, 255, 0.03)', color: 'white', fontWeight: 800, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px'
                          }}
                        >
                          <AlertCircle size={22} color="#94a3b8" /> LOG REVENUE DEBT
                        </button>
                  </div>
              </div>
           </div>

           <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Timeline Card - Full Height */}
              {selectedCustomer.zone && (() => {
                  const z = zones.find(zone => zone.name === selectedCustomer.zone);
                  if (z) {
                    return (
                      <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', padding: '2.5rem', borderRadius: '40px', border: '1px solid rgba(255, 255, 255, 0.05)', boxShadow: '0 40px 80px rgba(0,0,0,0.3)', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '2rem' }}>
                          <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '16px', color: '#10b981' }}><Calendar size={24} /></div>
                          <span style={{ fontSize: '1.3rem', fontWeight: 900, color: 'white' }}>Collection Timeline</span>
                        </div>
                        <MonthlyCalendar collectionDaysString={z.collection_days} collectionTime={z.collection_time} />
                      </div>
                    );
                  }
                  return null;
              })()}
           </div>

        </div>

        <div style={{ textAlign: 'center', marginTop: '3rem', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
          Customer record created on {new Date(selectedCustomer.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Full Name</label>
                  <input required placeholder="e.g. Jama Ali" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1rem', fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>WhatsApp (Optional)</label>
                  <input placeholder="e.g. 063-4455667" value={newCustomer.whatsapp} onChange={e => setNewCustomer({...newCustomer, whatsapp: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1rem', fontWeight: 600 }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>House No</label>
                  <input required placeholder="H-102" value={newCustomer.house_no} onChange={e => setNewCustomer({...newCustomer, house_no: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1rem', fontWeight: 600 }} />
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
                  <select value={newCustomer.payment_status} onChange={e => setNewCustomer({...newCustomer, payment_status: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1rem', fontWeight: 600, color: newCustomer.payment_status === 'Paid' ? '#10b981' : '#f43f5e' }}>
                    <option value="Paid">Paid</option>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Pending">Pending</option>
                  </select>
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
      {isDebtModalOpen && (
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
