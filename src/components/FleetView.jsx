import React, { useState, useEffect, useMemo } from 'react';
import { 
  Truck, 
  MapPin, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Tag, 
  Edit3, 
  X, 
  ChevronRight, 
  LayoutGrid, 
  List, 
  Search, 
  Filter, 
  User, 
  Calendar, 
  Clock, 
  Eye,
  Fuel,
  Wrench,
  AlertTriangle,
  CheckCircle,
  TrendingDown
} from 'lucide-react';
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
  const [trucks, setTrucks] = useState([]);
  const [zones, setZones] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const [showMap, setShowMap] = useState(false);

  // Form States
  const [newTruck, setNewTruck] = useState({ plate_number: '', model: '', insurance_expiry: '', registration_expiry: '' });
  const [newFuel, setNewFuel] = useState({ truck_id: '', liters: '', cost: '', odometer_reading: '' });
  const [newMaintenance, setNewMaintenance] = useState({ truck_id: '', description: '', cost: '', next_service_date: '' });
  const [newZone, setNewZone] = useState({ name: '', truck_id: '', collection_days: '', collection_time: '', area: '', neighborhood: '' });
  const [editingZone, setEditingZone] = useState(null);

  const currentUser = JSON.parse(localStorage.getItem('gurmadUser'));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tRes, zRes, eRes, cRes, fRes, mRes] = await Promise.all([
        api.getTrucks(),
        api.getZones(),
        api.getEmployees(),
        api.getCustomers(),
        api.getFuelLogs(),
        api.getMaintenanceLogs()
      ]);
      setTrucks(tRes);
      setZones(zRes);
      setEmployees(eRes);
      setCustomers(cRes);
      setFuelLogs(fRes);
      setMaintenanceLogs(mRes);
    } catch (err) {
      toast.error('Failed to load fleet data');
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handleAddFuel = async (e) => {
    e.preventDefault();
    try {
      await api.addFuelLog({ ...newFuel, recorded_by: currentUser.id });
      toast.success('Fuel log added');
      setNewFuel({ truck_id: '', liters: '', cost: '', odometer_reading: '' });
      fetchData();
    } catch (err) {
      toast.error('Failed to add fuel log');
    }
  };

  const handleAddMaintenance = async (e) => {
    e.preventDefault();
    try {
      await api.addMaintenanceLog({ ...newMaintenance, recorded_by: currentUser.id });
      toast.success('Maintenance record saved');
      setNewMaintenance({ truck_id: '', description: '', cost: '', next_service_date: '' });
      fetchData();
    } catch (err) {
      toast.error('Failed to save record');
    }
  };

  const handleAddZone = async (e) => {
    e.preventDefault();
    try {
      if (editingZone) {
        await api.updateZone(editingZone.id, newZone);
        toast.success('Zone updated');
      } else {
        await api.addZone(newZone);
        toast.success('Zone created');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to save zone');
    }
  };

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* Header & Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '12px', color: '#1e293b' }}>
           <Truck size={28} color="var(--gurmad-green)" /> Fleet & Operations
        </h2>

        <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '14px' }}>
          {['zones', 'trucks', 'fuel', 'maintenance'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '0.85rem',
                backgroundColor: activeTab === tab ? 'white' : 'transparent',
                color: activeTab === tab ? 'var(--gurmad-green)' : '#64748b',
                boxShadow: activeTab === tab ? 'var(--shadow-sm)' : 'none',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              {tab === 'fuel' ? <Fuel size={14} style={{ marginRight: '6px' }} /> : 
               tab === 'maintenance' ? <Wrench size={14} style={{ marginRight: '6px' }} /> : null}
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'zones' && (
        <div className="card" style={{ padding: 0, borderRadius: '24px', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: 800, margin: 0 }}>Operational Zones</h3>
            <button onClick={() => { setEditingZone(null); setNewZone({ name: '', truck_id: '', area: '', neighborhood: '', collection_days: '', collection_time: '' }); setIsModalOpen(true); }} className="btn-primary" style={{ padding: '0.6rem 1.2rem', borderRadius: '10px' }}>+ New Zone</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#f8fafc', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>
              <tr>
                <th style={{ padding: '1.2rem 1.5rem' }}>Zone</th>
                <th style={{ padding: '1.2rem 1.5rem' }}>Location</th>
                <th style={{ padding: '1.2rem 1.5rem' }}>Assigned Truck</th>
                <th style={{ padding: '1.2rem 1.5rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredZones.map(z => (
                <tr key={z.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1.2rem 1.5rem', fontWeight: 700 }}>{z.name}</td>
                  <td style={{ padding: '1.2rem 1.5rem', color: '#64748b' }}>{z.area} / {z.neighborhood}</td>
                  <td style={{ padding: '1.2rem 1.5rem' }}>
                    <span style={{ backgroundColor: '#eff6ff', color: '#3b82f6', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700 }}>{z.truck_plate || z.assigned_truck || 'None'}</span>
                  </td>
                  <td style={{ padding: '1.2rem 1.5rem', textAlign: 'right' }}>
                    <button onClick={() => { setEditingZone(z); setNewZone(z); setIsModalOpen(true); }} style={{ color: '#64748b', background: '#f1f5f9', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}><Edit3 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'trucks' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
          {/* Add Truck */}
          <div className="card" style={{ height: 'fit-content' }}>
            <h3 style={{ fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Truck size={20} color="var(--gurmad-green)" /> Add Truck
            </h3>
            <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.addTruck(newTruck);
                  toast.success('Truck added');
                  setNewTruck({ plate_number: '', model: '', insurance_expiry: '', registration_expiry: '' });
                  fetchData();
                } catch(err) {
                  toast.error('Failed to add truck');
                }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>Plate Number</label>
                <input required value={newTruck.plate_number} onChange={e => setNewTruck({...newTruck, plate_number: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} placeholder="e.g. SOM-1234" />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>Model</label>
                <input required value={newTruck.model} onChange={e => setNewTruck({...newTruck, model: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} placeholder="e.g. Isuzu NQR" />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>Insurance Expiry</label>
                <input type="date" value={newTruck.insurance_expiry} onChange={e => setNewTruck({...newTruck, insurance_expiry: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>Registration Expiry</label>
                <input type="date" value={newTruck.registration_expiry} onChange={e => setNewTruck({...newTruck, registration_expiry: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
              </div>
              <button type="submit" className="btn-primary" style={{ padding: '1rem', borderRadius: '12px', fontWeight: 800 }}>Save Truck</button>
            </form>
          </div>

          {/* Truck List */}
          <div className="card" style={{ padding: 0, borderRadius: '24px', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ fontWeight: 800, margin: 0 }}>Registered Trucks</h3>
            </div>
            {(() => {
              const today = new Date();
              const in30Days = new Date(today.getTime() + 30 * 86400000);
              const expiringDocs = trucks.filter(t =>
                (t.insurance_expiry && new Date(t.insurance_expiry) <= in30Days) ||
                (t.registration_expiry && new Date(t.registration_expiry) <= in30Days)
              );
              const overdueMaintenance = trucks.filter(t =>
                maintenanceLogs.some(m => m.truck_id === t.id && m.next_service_date && new Date(m.next_service_date) <= today)
              );
              if (expiringDocs.length === 0 && overdueMaintenance.length === 0) return null;
              return (
                <div style={{ margin: '1rem 1.5rem', padding: '1rem', borderRadius: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: '0.85rem', color: '#991b1b' }}>
                    {expiringDocs.length > 0 && <div><strong>{expiringDocs.length} truck(s)</strong> have insurance/registration expiring within 30 days (or already expired): {expiringDocs.map(t => t.plate_number).join(', ')}</div>}
                    {overdueMaintenance.length > 0 && <div style={{ marginTop: expiringDocs.length > 0 ? '4px' : 0 }}><strong>{overdueMaintenance.length} truck(s)</strong> are overdue for scheduled maintenance: {overdueMaintenance.map(t => t.plate_number).join(', ')}</div>}
                  </div>
                </div>
              );
            })()}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: '#f8fafc', fontSize: '0.75rem', color: '#64748b' }}>
                  <tr>
                    <th style={{ padding: '1.2rem 1.5rem' }}>Plate Number</th>
                    <th style={{ padding: '1.2rem 1.5rem' }}>Model</th>
                    <th style={{ padding: '1.2rem 1.5rem' }}>Documents</th>
                    <th style={{ padding: '1.2rem 1.5rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trucks.map(t => {
                    const today = new Date();
                    const in30Days = new Date(today.getTime() + 30 * 86400000);
                    const docBadge = (label, date) => {
                      if (!date) return null;
                      const d = new Date(date);
                      const expired = d <= today;
                      const soon = !expired && d <= in30Days;
                      const color = expired ? '#ef4444' : soon ? '#f59e0b' : '#10b981';
                      const bg = expired ? '#fef2f2' : soon ? '#fffbeb' : '#f0fdf4';
                      return (
                        <div key={label} style={{ fontSize: '0.7rem', fontWeight: 700, color, backgroundColor: bg, padding: '2px 8px', borderRadius: '8px', display: 'inline-block', marginRight: '4px', marginBottom: '2px' }}>
                          {label}: {d.toLocaleDateString()}
                        </div>
                      );
                    };
                    return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 700 }}>{t.plate_number}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>{t.model}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        {!t.insurance_expiry && !t.registration_expiry ? (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Not on file</span>
                        ) : (
                          <>
                            {docBadge('Insurance', t.insurance_expiry)}
                            {docBadge('Registration', t.registration_expiry)}
                          </>
                        )}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        <button onClick={async () => {
                          if(!window.confirm('Delete this truck?')) return;
                          try { await api.deleteTruck(t.id); toast.success('Deleted'); fetchData(); } catch(err) { toast.error('Error'); }
                        }} style={{ color: '#ef4444', background: '#fef2f2', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );})}
                  {trucks.length === 0 && (
                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No trucks found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'fuel' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
          {/* Add Fuel Log */}
          <div className="card" style={{ height: 'fit-content' }}>
            <h3 style={{ fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Fuel size={20} color="var(--gurmad-green)" /> Record Fuel
            </h3>
            <form onSubmit={handleAddFuel} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>Select Truck</label>
                <select required value={newFuel.truck_id} onChange={e => setNewFuel({...newFuel, truck_id: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <option value="">Choose...</option>
                  {trucks.map(t => <option key={t.id} value={t.id}>{t.plate_number} ({t.model})</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>Liters</label>
                  <input required type="number" step="0.01" value={newFuel.liters} onChange={e => setNewFuel({...newFuel, liters: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>Total Cost ($)</label>
                  <input required type="number" step="0.01" value={newFuel.cost} onChange={e => setNewFuel({...newFuel, cost: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>Odometer Reading (KM)</label>
                <input type="number" value={newFuel.odometer_reading} onChange={e => setNewFuel({...newFuel, odometer_reading: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
              </div>
              <button type="submit" className="btn-primary" style={{ padding: '1rem', borderRadius: '12px', fontWeight: 800 }}>Save Fuel Log</button>
            </form>
          </div>

          {/* Fuel History */}
          <div className="card" style={{ padding: 0, borderRadius: '24px', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ fontWeight: 800, margin: 0 }}>Recent Fuel Logs</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: '#f8fafc', fontSize: '0.75rem', color: '#64748b' }}>
                  <tr>
                    <th style={{ padding: '1.2rem 1.5rem' }}>Date</th>
                    <th style={{ padding: '1.2rem 1.5rem' }}>Truck</th>
                    <th style={{ padding: '1.2rem 1.5rem' }}>Liters</th>
                    <th style={{ padding: '1.2rem 1.5rem' }}>Cost</th>
                    <th style={{ padding: '1.2rem 1.5rem' }}>Efficiency</th>
                  </tr>
                </thead>
                <tbody>
                  {fuelLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem 1.5rem' }}>{new Date(log.date).toLocaleDateString()}</td>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 700 }}>{log.plate_number}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>{log.liters} L</td>
                      <td style={{ padding: '1rem 1.5rem', color: '#10b981', fontWeight: 700 }}>${log.cost}</td>
                      <td style={{ padding: '1rem 1.5rem', color: '#64748b', fontSize: '0.8rem' }}>{log.odometer_reading} KM</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
          {/* Add Maintenance record */}
          <div className="card" style={{ height: 'fit-content' }}>
            <h3 style={{ fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Wrench size={20} color="#3b82f6" /> Maintenance Log
            </h3>
            <form onSubmit={handleAddMaintenance} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>Select Truck</label>
                <select required value={newMaintenance.truck_id} onChange={e => setNewMaintenance({...newMaintenance, truck_id: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <option value="">Choose...</option>
                  {trucks.map(t => <option key={t.id} value={t.id}>{t.plate_number}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>Service Description</label>
                <textarea required value={newMaintenance.description} onChange={e => setNewMaintenance({...newMaintenance, description: e.target.value})} placeholder="e.g. Oil change, Brake repair" style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0', minHeight: '80px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>Cost ($)</label>
                  <input required type="number" step="0.01" value={newMaintenance.cost} onChange={e => setNewMaintenance({...newMaintenance, cost: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>Next Service</label>
                  <input type="date" value={newMaintenance.next_service_date} onChange={e => setNewMaintenance({...newMaintenance, next_service_date: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                </div>
              </div>
              <button type="submit" className="btn-primary" style={{ padding: '1rem', borderRadius: '12px', fontWeight: 800, backgroundColor: '#3b82f6', borderColor: '#3b82f6' }}>Record Service</button>
            </form>
          </div>

          {/* Maintenance History */}
          <div className="card" style={{ padding: 0, borderRadius: '24px', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ fontWeight: 800, margin: 0 }}>Maintenance History</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: '#f8fafc', fontSize: '0.75rem', color: '#64748b' }}>
                  <tr>
                    <th style={{ padding: '1.2rem 1.5rem' }}>Date</th>
                    <th style={{ padding: '1.2rem 1.5rem' }}>Truck</th>
                    <th style={{ padding: '1.2rem 1.5rem' }}>Work Done</th>
                    <th style={{ padding: '1.2rem 1.5rem' }}>Cost</th>
                    <th style={{ padding: '1.2rem 1.5rem' }}>Next Due</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenanceLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem 1.5rem' }}>{new Date(log.date).toLocaleDateString()}</td>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 700 }}>{log.plate_number}</td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{log.description}</td>
                      <td style={{ padding: '1rem 1.5rem', color: '#ef4444', fontWeight: 700 }}>${log.cost}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                         <span style={{ backgroundColor: '#fef3c7', color: '#d97706', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                            {log.next_service_date ? new Date(log.next_service_date).toLocaleDateString() : 'N/A'}
                         </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Existing Zone Modal logic preserved... */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
           <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem', borderRadius: '24px' }}>
              <h2 style={{ fontWeight: 900, marginBottom: '1.5rem' }}>{editingZone ? 'Edit Zone' : 'New Zone'}</h2>
              <form onSubmit={handleAddZone} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <input required placeholder="Zone Name" value={newZone.name} onChange={e => setNewZone({...newZone, name: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <input placeholder="Area" value={newZone.area} onChange={e => setNewZone({...newZone, area: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                  <input placeholder="Neighborhood" value={newZone.neighborhood} onChange={e => setNewZone({...newZone, neighborhood: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                </div>
                <select value={newZone.truck_id} onChange={e => setNewZone({...newZone, truck_id: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <option value="">Assign Truck...</option>
                  {trucks.map(t => <option key={t.id} value={t.id}>{t.plate_number}</option>)}
                </select>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>Collection Days</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => {
                      const selectedDays = (newZone.collection_days || '').split(',').map(d => d.trim()).filter(Boolean);
                      const isSelected = selectedDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            const next = isSelected ? selectedDays.filter(d => d !== day) : [...selectedDays, day];
                            setNewZone({ ...newZone, collection_days: next.join(',') });
                          }}
                          style={{
                            padding: '0.5rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                            border: isSelected ? '1px solid var(--gurmad-green)' : '1px solid #e2e8f0',
                            backgroundColor: isSelected ? 'var(--gurmad-green)' : 'white',
                            color: isSelected ? 'white' : '#475569'
                          }}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <input placeholder="Collection Time (e.g. 8:00 AM)" value={newZone.collection_time || ''} onChange={e => setNewZone({...newZone, collection_time: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', border: 'none', background: '#f1f5f9' }}>Cancel</button>
                  <button type="submit" className="btn-primary" style={{ flex: 1, padding: '0.8rem', borderRadius: '10px' }}>Save Zone</button>
                </div>
              </form>
           </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default FleetView;
