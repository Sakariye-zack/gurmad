import React, { useState, useEffect, useMemo } from 'react';
import { Truck, MapPin, Plus, Trash2, ShieldCheck, Tag, Edit3, X, ChevronRight, LayoutGrid, List, Search, Filter, User, Calendar, Clock, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});


const FleetView = ({ searchQuery = '', initialTab = 'zones' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  const [trucks, setTrucks] = useState([]);
  const [zones, setZones] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const [expandedXaafadas, setExpandedNeighborhoods] = useState([]);
  const [showMap, setShowMap] = useState(false);

  const MapView = () => (
    <div style={{ height: '450px', borderRadius: '24px', overflow: 'hidden', marginBottom: '2.5rem', border: '4px solid white', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', position: 'relative', zIndex: 1 }}>
      <MapContainer center={[9.56, 44.06]} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        {zones.map(z => (
          z.lat && z.lng && (
            <Marker key={z.id} position={[parseFloat(z.lat), parseFloat(z.lng)]}>
              <Popup>
                <div style={{ padding: '5px' }}>
                  <div style={{ fontWeight: 900, color: 'var(--gurmad-green)', fontSize: '1rem', marginBottom: '4px' }}>{z.name}</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{z.area} • {z.neighborhood}</div>
                  <div style={{ marginTop: '8px', borderTop: '1px solid #eee', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}><User size={12} inline /> Driver: {z.assigned_driver || 'Not Assigned'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}><Truck size={12} inline /> Truck: {z.assigned_truck || 'Not Assigned'}</div>
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  );

  // Forms
  const [newTruck, setNewTruck] = useState({ plate_number: '', model: '', driver_id: '', collector_id: '' });
  const [newDriver, setNewDriver] = useState({ name: '', phone: '', salary: '', role: 'Driver', status: 'Active', assigned_truck_id: '' });
  const [newCollector, setNewCollector] = useState({ name: '', phone: '', salary: '', role: 'Collector', status: 'Active', assigned_truck_id: '' });
  const [newZone, setNewZone] = useState({ name: '', truck_id: '', collection_days: '', collection_time: '', area: '', neighborhood: '' });
  const [editingTruck, setEditingTruck] = useState(null);
  const [editingZone, setEditingZone] = useState(null);


  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tRes, zRes, eRes, cRes] = await Promise.all([
        api.getTrucks(),
        api.getZones(),
        api.getEmployees(),
        api.getCustomers()
      ]);
      setTrucks(tRes);
      setZones(zRes);
      setEmployees(eRes);
      setCustomers(cRes);
    } catch (err) {
      toast.error('Failed to load fleet data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDriver = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', newDriver.name);
      formData.append('phone', newDriver.phone);
      formData.append('salary', newDriver.salary || '0');
      formData.append('role', 'Driver');
      formData.append('status', 'Active');
      if (newDriver.assigned_truck_id) {
        formData.append('assigned_truck_id', newDriver.assigned_truck_id);
      }
      
      const res = await api.addEmployee(formData);
      setEmployees([...employees, res]);
      toast.success('Driver registered successfully in Operations!');
      setNewDriver({ name: '', phone: '', salary: '', role: 'Driver', status: 'Active', assigned_truck_id: '' });
      fetchData(); // refresh to get full data
    } catch (err) {
      toast.error('Failed to register driver');
    }
  };

  const handleAddCollector = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', newCollector.name);
      formData.append('phone', newCollector.phone);
      formData.append('salary', newCollector.salary || '0');
      formData.append('role', 'Collector');
      formData.append('status', 'Active');
      if (newCollector.assigned_truck_id) {
        formData.append('assigned_truck_id', newCollector.assigned_truck_id);
      }
      
      const res = await api.addEmployee(formData);
      setEmployees([...employees, res]);
      toast.success('Collector registered successfully in Operations!');
      setNewCollector({ name: '', phone: '', salary: '', role: 'Collector', status: 'Active', assigned_truck_id: '' });
      fetchData();
    } catch (err) {
      toast.error('Failed to register collector');
    }
  };

  // Zone Handlers
  const handleAddZone = async (e) => {
    if (e) e.preventDefault();
    try {
      if (editingZone) {
        const d = await api.updateZone(editingZone.id, newZone);
        setZones(zones.map(z => z.id === editingZone.id ? d : z));
        toast.success('Zone updated successfully');
      } else {
        const d = await api.addZone(newZone);
        setZones([d, ...zones]);
        toast.success('Zone created successfully');
      }
      closeModal();
    } catch (err) {
      toast.error('Failed to save zone');
    }
  };

  const openModal = (zone = null) => {
    if (zone) {
      setEditingZone(zone);
      setNewZone({ 
        name: zone.name, 
        truck_id: zone.truck_id || '',
        collection_days: zone.collection_days || '',
        collection_time: zone.collection_time || '',
        area: zone.area || '',
        neighborhood: zone.neighborhood || '',
        zone_code: zone.zone_code || '',
        sub_zone: zone.sub_zone || ''
      });

    } else {
      setEditingZone(null);
      setNewZone({ name: '', truck_id: '', collection_days: '', collection_time: '', area: '', neighborhood: '', zone_code: '', sub_zone: '' });

    }
    setIsModalOpen(true);
  };


  const closeModal = () => {
    setIsModalOpen(false);
    setEditingZone(null);
  };

  const openDetails = (zoneInfo, metrics) => {
    setSelectedZone({ ...zoneInfo, metrics });
  };

  const closeDetails = () => {
    setSelectedZone(null);
  };

  const toggleNeighborhood = (nName) => {
    setExpandedNeighborhoods(prev => 
      prev.includes(nName) ? prev.filter(n => n !== nName) : [...prev, nName]
    );
  };

  const handleDeleteZone = async (id) => {
    if (!window.confirm('Are you sure you want to delete this zone?')) return;
    try {
      await api.deleteZone(id);
      setZones(zones.filter(z => z.id !== id));
      toast.success('Zone deleted');
    } catch (err) {
      toast.error('Failed to delete zone');
    }
  };

  // Truck Handlers
  const handleAddTruck = async (e) => {
    e.preventDefault();
    try {
      if (editingTruck) {
        const d = await api.updateTruck(editingTruck.id, newTruck);
        setTrucks(trucks.map(t => t.id === editingTruck.id ? d : t));
        setEditingTruck(null);
        toast.success('Truck updated');
      } else {
        const d = await api.addTruck(newTruck);
        setTrucks([d, ...trucks]);
        toast.success('Truck added to fleet');
      }
      setNewTruck({ plate_number: '', model: '', driver_id: '', collector_id: '' });
    } catch (err) {
      toast.error('Failed to save truck');
    }
  };


  const handleDeleteTruck = async (id) => {
    if(!window.confirm('Delete this truck?')) return;
    try {
      await api.deleteTruck(id);
      setTrucks(trucks.filter(t => t.id !== id));
      toast.success('Truck removed');
    } catch (err) {
      toast.error('Failed to remove truck');
    }
  };

  // Filtering & Metrics
  const areaMetrics = useMemo(() => {
    const metrics = {};
    (zones || []).forEach(z => {
      const area = z.area || 'Other / Unassigned';
      const neighborhood = z.neighborhood || 'General';
      const zoneName = z.name;
      if (!metrics[area]) metrics[area] = { total: 0, guri: 0, meherad: 0, neighborhoods: {} };
      if (!metrics[area].neighborhoods[neighborhood]) metrics[area].neighborhoods[neighborhood] = { total: 0, guri: 0, meherad: 0, zones: {} };
      metrics[area].neighborhoods[neighborhood].zones[zoneName] = { total: 0, guri: 0, meherad: 0, info: z };
    });
    customers.forEach(c => {
      const area = c.area || 'Unknown';
      const neighborhood = c.neighborhood || 'Unknown';
      const zone = c.zone || 'None';
      const cat = (c.category || 'Guri').toLowerCase();
      if (!metrics[area]) metrics[area] = { total: 0, guri: 0, meherad: 0, neighborhoods: {} };
      metrics[area].total++;
      if (cat === 'guri') metrics[area].guri++; else metrics[area].meherad++;
      if (!metrics[area].neighborhoods[neighborhood]) metrics[area].neighborhoods[neighborhood] = { total: 0, guri: 0, meherad: 0, zones: {} };
      metrics[area].neighborhoods[neighborhood].total++;
      if (cat === 'guri') metrics[area].neighborhoods[neighborhood].guri++; else metrics[area].neighborhoods[neighborhood].meherad++;
      if (metrics[area].neighborhoods[neighborhood].zones[zone]) {
        metrics[area].neighborhoods[neighborhood].zones[zone].total++;
        if (cat === 'guri') metrics[area].neighborhoods[neighborhood].zones[zone].guri++; else metrics[area].neighborhoods[neighborhood].zones[zone].meherad++;
      }
    });
    return metrics;
  }, [customers, zones]);

  const filteredZones = useMemo(() => {
    const s = searchQuery.toLowerCase();
    return zones.filter(z => 
      z.name.toLowerCase().includes(s) || 
      (z.area && z.area.toLowerCase().includes(s)) ||
      (z.neighborhood && z.neighborhood.toLowerCase().includes(s))
    );
  }, [zones, searchQuery]);

  if (loading) return <div className="card glass">Loading fleet...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* Tab Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
           {activeTab === 'zones' ? <><MapPin size={24} color="var(--gurmad-green)" /> Zones Management</> : <><Truck size={24} color="var(--gurmad-green)" /> Trucks & Drivers</>}
        </h2>

        {activeTab === 'zones' && (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
             <button 
               onClick={() => setShowMap(!showMap)} 
               style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.8rem 1.5rem', borderRadius: '12px', border: 'none', background: showMap ? 'var(--gurmad-green)' : '#f1f5f9', color: showMap ? 'white' : '#475569', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
             >
                <MapPin size={18} /> {showMap ? 'Hide Map' : 'Show Map'}
             </button>
             <button onClick={() => openModal()} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.8rem 1.5rem', borderRadius: '12px' }}>
                <Plus size={18} /> New Zone
             </button>
          </div>
        )}
      </div>

      {showMap && activeTab === 'zones' && <MapView />}

      {activeTab === 'zones' ? (
            <div className="card" style={{ padding: 0, borderRadius: '20px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: '#f8fafc', fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <tr>
                    <th style={{ padding: '1.5rem' }}>Zone & Location</th>
                    <th style={{ padding: '1.5rem' }}>Staff & Fleet</th>
                    <th style={{ padding: '1.5rem' }}>Schedule</th>
                    <th style={{ padding: '1.5rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredZones.map(z => (
                    <tr key={z.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1.2rem 1.5rem' }}>
                        <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem' }}>{z.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>{z.area} • {z.neighborhood}</div>
                      </td>
                      <td style={{ padding: '1.2rem 1.5rem' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '0.85rem' }}>
                           <span title="Assigned Driver" style={{ backgroundColor: '#f1f5f9', padding: '5px 12px', borderRadius: '8px', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <User size={14} /> {z.driver_name || 'No Driver'}
                           </span>
                           <span title="Assigned Truck" style={{ backgroundColor: '#f1f5f9', padding: '5px 12px', borderRadius: '8px', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Truck size={14} /> {z.truck_plate || 'No Truck'}
                           </span>
                        </div>
                      </td>
                      <td style={{ padding: '1.2rem 1.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} /> {z.collection_days || 'No Days Set'}</div>
                        {z.collection_time && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}><Clock size={14} /> {z.collection_time}</div>}
                      </td>
                      <td style={{ padding: '1.2rem 1.5rem', textAlign: 'right' }}>
                        <button onClick={() => openDetails(z, { total: '?', guri: '?', meherad: '?' })} style={{ marginRight: '8px', color: '#64748b', background: '#f1f5f9', padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}><Eye size={18} /></button>
                        <button onClick={() => openModal(z)} style={{ marginRight: '8px', color: '#64748b', background: '#f1f5f9', padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}><Edit3 size={18} /></button>
                        <button onClick={() => handleDeleteZone(z.id)} style={{ color: '#ef4444', background: '#fef2f2', padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
         {/* Forms Row */}
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem' }}>
            {/* Add Truck Card */}
            <div className="card" style={{ 
               borderTop: '6px solid #3b82f6', 
               borderRadius: '24px', 
               padding: '2.25rem', 
               boxShadow: '0 10px 30px -5px rgba(59, 130, 246, 0.08)',
               background: 'linear-gradient(180deg, #ffffff 0%, #f8faff 100%)',
               position: 'relative',
               overflow: 'hidden'
            }}>
               <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.03 }}>
                  <Truck size={120} />
               </div>
               <h3 style={{ fontWeight: 900, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.4rem', color: '#1e293b' }}>
                  <div style={{ backgroundColor: '#dbeafe', padding: '10px', borderRadius: '14px' }}>
                     <Truck color="#3b82f6" size={24} />
                  </div>
                  Register Vehicle
               </h3>
               <form onSubmit={handleAddTruck} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                     <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plate Number *</label>
                        <input required placeholder="e.g. SL-1025" value={newTruck.plate_number} onChange={e => setNewTruck({...newTruck, plate_number: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #e2e8f0', fontSize: '1rem', fontWeight: 600, transition: 'all 0.2s', outline: 'none' }} />
                     </div>
                     <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Make / Model</label>
                        <input placeholder="e.g. Isuzu NPR" value={newTruck.model} onChange={e => setNewTruck({...newTruck, model: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #e2e8f0', fontSize: '1rem', fontWeight: 600, transition: 'all 0.2s', outline: 'none' }} />
                     </div>
                     <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assign Driver</label>
                        <select value={newTruck.driver_id} onChange={e => setNewTruck({...newTruck, driver_id: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #e2e8f0', fontSize: '1rem', fontWeight: 600, transition: 'all 0.2s', outline: 'none', backgroundColor: 'white' }}>
                           <option value="">No Driver Assigned</option>
                           {employees.filter(emp => emp.role === 'Driver').map(emp => (
                              <option key={emp.id} value={emp.id}>{emp.name}</option>
                           ))}
                        </select>
                     </div>
                     <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assign Collector</label>
                        <select value={newTruck.collector_id} onChange={e => setNewTruck({...newTruck, collector_id: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #e2e8f0', fontSize: '1rem', fontWeight: 600, transition: 'all 0.2s', outline: 'none', backgroundColor: 'white' }}>
                           <option value="">No Collector Assigned</option>
                           {employees.filter(emp => emp.role === 'Collector').map(emp => (
                              <option key={emp.id} value={emp.id}>{emp.name}</option>
                           ))}
                        </select>
                     </div>
                  </div>
                  <button className="btn-primary" style={{ padding: '1.1rem', borderRadius: '14px', fontWeight: 900, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.4)', transition: 'all 0.3s' }}>
                     <Plus size={20} /> Save Truck & Team
                  </button>
               </form>

            </div>

            {/* Add Collector Card */}
            <div className="card" style={{ 
               borderTop: '6px solid #10b981', 
               borderRadius: '24px', 
               padding: '2.25rem', 
               boxShadow: '0 10px 30px -5px rgba(16, 185, 129, 0.08)',
               background: 'linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%)',
               position: 'relative',
               overflow: 'hidden'
            }}>
               <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.03 }}>
                  <ShieldCheck size={120} />
               </div>
               <h3 style={{ fontWeight: 900, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.4rem', color: '#1e293b' }}>
                  <div style={{ backgroundColor: '#dcfce7', padding: '10px', borderRadius: '14px' }}>
                     <ShieldCheck color="#10b981" size={24} />
                  </div>
                  Register Collector
               </h3>
               <form onSubmit={handleAddCollector} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                     <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name *</label>
                        <input required placeholder="e.g. Hassan Ali" value={newCollector.name} onChange={e => setNewCollector({...newCollector, name: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #e2e8f0', fontSize: '1rem', fontWeight: 600, transition: 'all 0.2s', outline: 'none' }} />
                     </div>
                     <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone Number *</label>
                        <input required placeholder="063..." value={newCollector.phone} onChange={e => setNewCollector({...newCollector, phone: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #e2e8f0', fontSize: '1rem', fontWeight: 600, transition: 'all 0.2s', outline: 'none' }} />
                     </div>
                     <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base Salary ($)</label>
                        <input type="number" placeholder="200.00" value={newCollector.salary} onChange={e => setNewCollector({...newCollector, salary: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #e2e8f0', fontSize: '1rem', fontWeight: 600, transition: 'all 0.2s', outline: 'none' }} />
                     </div>
                     <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assign Vehicle (Optional)</label>
                        <select value={newCollector.assigned_truck_id} onChange={e => setNewCollector({...newCollector, assigned_truck_id: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #e2e8f0', fontSize: '1rem', fontWeight: 600, transition: 'all 0.2s', outline: 'none', backgroundColor: 'white' }}>
                           <option value="">No Vehicle Assigned</option>
                           {trucks.map(t => (
                              <option key={t.id} value={t.id}>{t.plate_number} ({t.model})</option>
                           ))}
                        </select>
                     </div>
                  </div>
                  <button className="btn-primary" style={{ padding: '1.1rem', borderRadius: '14px', fontWeight: 900, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', backgroundColor: '#10b981', borderColor: '#10b981', boxShadow: '0 10px 20px -5px rgba(16, 185, 129, 0.4)', transition: 'all 0.3s' }}>
                     <Plus size={20} /> Save New Collector
                  </button>
               </form>
            </div>

            {/* Add Driver Card */}
            <div className="card" style={{ 
               borderTop: '6px solid #f97316', 
               borderRadius: '24px', 
               padding: '2.25rem', 
               boxShadow: '0 10px 30px -5px rgba(249, 115, 22, 0.08)',
               background: 'linear-gradient(180deg, #ffffff 0%, #fffaf5 100%)',
               position: 'relative',
               overflow: 'hidden'
            }}>
               <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.03 }}>
                  <User size={120} />
               </div>
               <h3 style={{ fontWeight: 900, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.4rem', color: '#1e293b' }}>
                  <div style={{ backgroundColor: '#ffedd5', padding: '10px', borderRadius: '14px' }}>
                     <User color="#f97316" size={24} />
                  </div>
                  Register Driver
               </h3>
               <form onSubmit={handleAddDriver} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                     <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name *</label>
                        <input required placeholder="e.g. Abdi Jama" value={newDriver.name} onChange={e => setNewDriver({...newDriver, name: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #e2e8f0', fontSize: '1rem', fontWeight: 600, transition: 'all 0.2s', outline: 'none' }} />
                     </div>
                     <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone Number *</label>
                        <input required placeholder="063..." value={newDriver.phone} onChange={e => setNewDriver({...newDriver, phone: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #e2e8f0', fontSize: '1rem', fontWeight: 600, transition: 'all 0.2s', outline: 'none' }} />
                     </div>
                     <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base Salary ($)</label>
                        <input type="number" placeholder="250.00" value={newDriver.salary} onChange={e => setNewDriver({...newDriver, salary: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #e2e8f0', fontSize: '1rem', fontWeight: 600, transition: 'all 0.2s', outline: 'none' }} />
                     </div>
                     <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assign Vehicle (Optional)</label>
                        <select value={newDriver.assigned_truck_id} onChange={e => setNewDriver({...newDriver, assigned_truck_id: e.target.value})} style={{ width: '100%', padding: '1rem', borderRadius: '14px', border: '2px solid #e2e8f0', fontSize: '1rem', fontWeight: 600, transition: 'all 0.2s', outline: 'none', backgroundColor: 'white' }}>
                           <option value="">No Vehicle Assigned</option>
                           {trucks.map(t => (
                              <option key={t.id} value={t.id}>{t.plate_number} ({t.model})</option>
                           ))}
                        </select>
                     </div>
                  </div>
                  <button className="btn-primary" style={{ padding: '1.1rem', borderRadius: '14px', fontWeight: 900, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', backgroundColor: '#f97316', borderColor: '#f97316', boxShadow: '0 10px 20px -5px rgba(249, 115, 22, 0.4)', transition: 'all 0.3s' }}>
                     <Plus size={20} /> Save New Driver
                  </button>
               </form>
            </div>
         </div>

         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
               <h4 style={{ fontWeight: 800, color: '#64748b', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Truck size={16} /> Registered Vehicles ({trucks.length})
               </h4>
            </div>
            {trucks.map(t => (
               <div key={t.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '20px', padding: '1.5rem', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                     <div style={{ backgroundColor: '#dbeafe', color: '#2563eb', padding: '12px', borderRadius: '15px' }}><Truck size={28} /></div>
                     <div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1e293b' }}>{t.plate_number}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>{t.model || 'No model specified'}</div>
                     </div>
                  </div>
                  <button onClick={() => handleDeleteTruck(t.id)} style={{ color: '#f87171', background: '#fef2f2', padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}><Trash2 size={20} /></button>
               </div>
            ))}

            <div style={{ gridColumn: '1 / -1', marginTop: '2rem' }}>
               <h4 style={{ fontWeight: 800, color: '#64748b', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={16} /> Active Drivers ({employees.filter(e => e.role === 'Driver').length})
               </h4>
            </div>
            {employees.filter(e => e.role === 'Driver').map(d => (
               <div key={d.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '20px', padding: '1.5rem', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                     <div style={{ 
                        width: '52px', height: '52px', borderRadius: '15px', 
                        backgroundColor: '#fff7ed', color: '#f97316', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', border: '1px solid #ffedd5'
                     }}>
                        {d.photo ? (
                           <img src={`/api/uploads/${d.photo}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                           <User size={28} />
                        )}
                     </div>
                     <div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1e293b' }}>{d.name}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                           {d.phone}
                           {d.assigned_truck_id && (
                              <span style={{ color: '#3b82f6', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                                 <Truck size={10} style={{ marginRight: '4px' }} /> 
                                 {trucks.find(t => t.id == d.assigned_truck_id)?.plate_number}
                              </span>
                           )}
                        </div>
                     </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                     <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', backgroundColor: '#ecfdf5', padding: '4px 8px', borderRadius: '6px' }}>ACTIVE</div>
                  </div>
               </div>
            ))}

            <div style={{ gridColumn: '1 / -1', marginTop: '2rem' }}>
               <h4 style={{ fontWeight: 800, color: '#64748b', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} /> Active Collectors ({employees.filter(e => e.role === 'Collector').length})
               </h4>
            </div>
            {employees.filter(e => e.role === 'Collector').map(c => (
               <div key={c.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '20px', padding: '1.5rem', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                     <div style={{ 
                        width: '52px', height: '52px', borderRadius: '15px', 
                        backgroundColor: '#ecfdf5', color: '#10b981', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', border: '1px solid #dcfce7'
                     }}>
                        {c.photo ? (
                           <img src={`/api/uploads/${c.photo}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                           <ShieldCheck size={28} />
                        )}
                     </div>
                     <div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1e293b' }}>{c.name}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                           {c.phone}
                           {c.assigned_truck_id && (
                              <span style={{ color: '#10b981', backgroundColor: '#ecfdf5', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                                 <Truck size={10} style={{ marginRight: '4px' }} /> 
                                 {trucks.find(t => t.id == c.assigned_truck_id)?.plate_number}
                              </span>
                           )}
                        </div>
                     </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                     <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', backgroundColor: '#ecfdf5', padding: '4px 8px', borderRadius: '6px' }}>COLLECTOR</div>
                  </div>
               </div>
            ))}
         </div>
      </div>

      )}

      {/* Zone Management Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
           <div className="card" style={{ width: '100%', maxWidth: '550px', padding: '2.5rem', borderRadius: '24px', animation: 'scaleUp 0.3s ease-out', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                 <h2 style={{ fontWeight: 900, fontSize: '1.5rem', color: '#1e293b' }}>{editingZone ? 'Update Zone Settings' : 'Create New Operational Zone'}</h2>
                 <button onClick={closeModal} style={{ background: '#f1f5f9', padding: '6px', borderRadius: '50%', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
              </div>

              <form onSubmit={handleAddZone} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1.2fr', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Zone Code</label>
                      <input required placeholder="OCT-A" value={newZone.zone_code} onChange={e => setNewZone({...newZone, zone_code: e.target.value.toUpperCase()})} style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem', fontWeight: 800, color: '#3FAE2A' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Zone Name</label>
                      <input required placeholder="October Sub-A" value={newZone.name} onChange={e => setNewZone({...newZone, name: e.target.value})} style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem', fontWeight: 600 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Arrival Time</label>
                      <input type="time" value={newZone.collection_time} onChange={e => setNewZone({...newZone, collection_time: e.target.value})} style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem' }} />
                    </div>
                 </div>
                 
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Area / District</label>
                      <input placeholder="e.g. North Burao" value={newZone.area} onChange={e => setNewZone({...newZone, area: e.target.value})} style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Neighborhood</label>
                      <input placeholder="e.g. Central Park" value={newZone.neighborhood} onChange={e => setNewZone({...newZone, neighborhood: e.target.value})} style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                    </div>
                 </div>

                 <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Assign Operational Truck</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.8rem' }}>
                       <select value={newZone.truck_id} onChange={e => setNewZone({...newZone, truck_id: e.target.value})} style={{ padding: '0.9rem', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer', width: '100%' }}>
                          <option value="">Choose Truck (Auto-assigns Team)</option>
                          {trucks.map(t => <option key={t.id} value={t.id}>{t.plate_number} ({t.driver_name || 'No Driver'} & {t.collector_name || 'No Collector'})</option>)}
                       </select>
                    </div>
                 </div>

                 <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Collection Schedule</label>
                    <input placeholder="e.g. Mon, Wed, Sat" value={newZone.collection_days} onChange={e => setNewZone({...newZone, collection_days: e.target.value})} style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                 </div>

                 <div style={{ display: 'flex', gap: '15px', marginTop: '1rem' }}>
                    <button type="button" onClick={closeModal} className="btn" style={{ flex: 1, backgroundColor: '#f1f5f9', fontWeight: 700, borderRadius: '12px' }}>Cancel</button>
                    <button type="submit" className="btn-primary" style={{ flex: 2, fontWeight: 800, borderRadius: '12px' }}>{editingZone ? 'Save Changes' : 'Confirm & Create'}</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Zone Details Modal */}
      {selectedZone && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
           <div className="card" style={{ width: '100%', maxWidth: '600px', padding: '0', borderRadius: '24px', animation: 'scaleUp 0.3s ease-out', overflow: 'hidden' }}>
              <div style={{ padding: '2rem', background: 'linear-gradient(135deg, var(--gurmad-green), #059669)', color: 'white', position: 'relative' }}>
                 <button onClick={closeDetails} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '50%', border: 'none', cursor: 'pointer', color: 'white' }}><X size={20} /></button>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '15px', borderRadius: '18px' }}><MapPin size={32} /></div>
                    <div>
                       <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.8rem' }}>{selectedZone.name}</h2>
                       <p style={{ margin: '4px 0 0 0', opacity: 0.9, fontSize: '1rem' }}>{selectedZone.area} • {selectedZone.neighborhood}</p>
                    </div>
                 </div>
              </div>

              <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                 {/* Stats Row */}
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '1.2rem', borderRadius: '16px', textAlign: 'center' }}>
                       <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--gurmad-green)' }}>{selectedZone.metrics?.total || 0}</div>
                       <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginTop: '4px' }}>CUSTOMERS</div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '1.2rem', borderRadius: '16px', textAlign: 'center' }}>
                       <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#059669' }}>{selectedZone.metrics?.guri || 0}</div>
                       <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginTop: '4px' }}>GURYA</div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '1.2rem', borderRadius: '16px', textAlign: 'center' }}>
                       <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#d97706' }}>{selectedZone.metrics?.meherad || 0}</div>
                       <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginTop: '4px' }}>MEHERAD</div>
                    </div>
                 </div>

                 {/* Assignments */}
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ color: '#94a3b8' }}><User size={20} /></div>
                          <div>
                             <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>DRIVER</div>
                             <div style={{ fontWeight: 700, color: '#1e293b' }}>{selectedZone.assigned_driver || 'Unassigned'}</div>
                          </div>
                       </div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ color: '#94a3b8' }}><Truck size={20} /></div>
                          <div>
                             <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>VEHICLE</div>
                             <div style={{ fontWeight: 700, color: '#1e293b' }}>{selectedZone.assigned_truck || 'Unassigned'}</div>
                          </div>
                       </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ color: '#94a3b8' }}><Calendar size={20} /></div>
                          <div>
                             <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>SCHEDULE</div>
                             <div style={{ fontWeight: 700, color: '#1e293b' }}>{selectedZone.collection_days || 'No Days Set'}</div>
                          </div>
                       </div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ color: '#94a3b8' }}><Clock size={20} /></div>
                          <div>
                             <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>ARRIVAL TIME</div>
                             <div style={{ fontWeight: 700, color: '#1e293b' }}>{selectedZone.collection_time || 'Not Set'}</div>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Actions */}
                 <div style={{ display: 'flex', gap: '10px', marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '2rem' }}>
                    <button 
                      onClick={() => { closeDetails(); openModal(selectedZone); }} 
                      className="btn-primary" 
                      style={{ flex: 1, backgroundColor: '#3b82f6', borderRadius: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                       <Edit3 size={18} /> Edit Zone
                    </button>
                    <button 
                      onClick={() => { if(window.confirm('Delete this zone?')) { handleDeleteZone(selectedZone.id); closeDetails(); } }} 
                      style={{ flex: 1, backgroundColor: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '12px', fontWeight: 800, padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                       <Trash2 size={18} /> Delete Zone
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleUp { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
};

export default FleetView;
