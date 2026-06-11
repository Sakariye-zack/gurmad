import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, Polyline, FeatureGroup, Tooltip } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import { 
  Truck, 
  Home, 
  Loader2, 
  MapPin, 
  Clock, 
  Navigation, 
  User, 
  Cpu,
  BrainCircuit,
  Radio,
  Activity,
  Zap,
  Shield,
  Search,
  Settings,
  X,
  ChevronRight,
  Layers,
  Map as MapIcon,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { socket } from '../socket';
import { AnimatedTruckMarker } from './AnimatedTruckMarker';

// Fix for default leaflet icon issues in React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// --- CUSTOM ICON DEFINITIONS (DHAWEEYE STYLE) ---

const truckIcon = L.divIcon({
  className: 'dhaweeye-truck-icon',
  html: `
    <div style="position: relative; transition: all 1s linear;">
      <div style="
        width: 52px; height: 52px; background: #3FAE2A; border-radius: 14px; 
        display: flex; align-items: center; justify-content: center; color: white;
        box-shadow: 0 10px 25px rgba(63,174,42,0.4); border: 2px solid white;
        transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      ">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3m0 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0m9 0h3l3-3V7h-6v10m0 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0"/></svg>
      </div>
      <div style="
        position: absolute; top: -4px; right: -4px; width: 14px; height: 14px; 
        background: #4ade80; border: 2px solid white; border-radius: 50%;
        animation: pulse 1.5s infinite;
      "></div>
    </div>
  `,
  iconSize: [52, 52],
  iconAnchor: [26, 26]
});

const pendingTruckIcon = L.divIcon({
  className: 'dhaweeye-truck-icon',
  html: `
    <div style="
      width: 48px; height: 48px; background: #ef4444; border-radius: 14px; 
      display: flex; align-items: center; justify-content: center; color: white;
      box-shadow: 0 8px 20px rgba(239,68,68,0.3); border: 2px solid white;
    ">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3m0 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0m9 0h3l3-3V7h-6v10m0 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0"/></svg>
    </div>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 24]
});

const idleTruckIcon = L.divIcon({
  className: 'dhaweeye-idle-icon',
  html: `
    <div style="
      width: 36px; height: 36px; background: #94a3b8; border-radius: 12px; 
      display: flex; align-items: center; justify-content: center; color: white;
      box-shadow: 0 4px 10px rgba(0,0,0,0.1); border: 2px solid white;
      opacity: 0.8;
    ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3m0 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0m9 0h3l3-3V7h-6v10m0 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0"/></svg>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

const customerHomeIcon = (status) => L.divIcon({
  className: 'dhaweeye-home-icon',
  html: `<div style="
    width: 32px; height: 32px; background: ${status === 'Paid' ? '#3FAE2A' : '#ef4444'}; border-radius: 10px; 
    display: flex; align-items: center; justify-content: center; color: white;
    box-shadow: 0 8px 16px ${status === 'Paid' ? 'rgba(63,174,42,0.3)' : 'rgba(239,68,68,0.3)'}; border: 2px solid white;
    transition: all 0.3s ease;
  ">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});


const MapView = ({ currentUser }) => {
  const [customers, setCustomers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskHistory, setTaskHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [activeSidebarTab, setActiveSidebarTab] = useState('drivers');
  const [activities, setActivities] = useState([]);
  const [mapRef, setMapRef] = useState(null);
  const [mapStyle, setMapStyle] = useState('satellite');
  const [zones, setZones] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [drawnPolygon, setDrawnPolygon] = useState(null);
  const [selectedZoneToAssign, setSelectedZoneToAssign] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedTaskCustomers, setSelectedTaskCustomers] = useState([]);
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [dbTrucks, setDbTrucks] = useState([]);
  const [localSearch, setLocalSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const fetchStats = async () => {
    try {
      const data = await api.getStats();
      setDbTrucks(data.trucks || []);
    } catch(err) {
      console.log('Stats error');
    }
  };

  const handleOptimizeRoute = async (taskId) => {
    try {
      setIsOptimizing(true);
      toast.loading('AI is calculating the optimal route...', { id: 'opt-route' });
      const res = await api.optimizeRoute(taskId);
      if (res.success && res.geometry) {
        setOptimizedRoute(res);
        toast.success('Route optimized successfully!', { id: 'opt-route' });
      }
    } catch(err) {
      toast.error('Failed to optimize route', { id: 'opt-route' });
    } finally {
      setIsOptimizing(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Real-time tracking via Socket.io
    socket.on('truck_location_updated', (data) => {
      setTasks(prev => prev.map(t => {
        if (t.id === data.taskId) {
          return { ...t, lat: data.lat, lng: data.lng };
        }
        return t;
      }));

      setTaskHistory(prev => {
        if (prev[data.taskId]) {
          return { ...prev, [data.taskId]: [...prev[data.taskId], [data.lat, data.lng]] };
        }
        return prev;
      });
    });

    socket.on('customer_status_updated', (data) => {
      setCustomers(prev => prev.map(c => {
        if (c.id === data.customerId) {
          return { ...c, status: data.status, payment_status: data.status };
        }
        return c;
      }));
      toast.success('Customer status updated!', { icon: '🔄', position: 'bottom-right' });
    });

    return () => {
      socket.off('truck_location_updated');
      socket.off('customer_status_updated');
    };
  }, []);

  const handleLocalSearch = (query) => {
    setLocalSearch(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const q = query.toLowerCase();
    
    const matchedTrucks = tasks.filter(t => 
      (t.vehicle_plate && t.vehicle_plate.toLowerCase().includes(q)) ||
      (t.driver_name && t.driver_name.toLowerCase().includes(q))
    ).map(t => ({ ...t, type: 'truck' }));

    const matchedCustomers = customers.filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.phone && c.phone.includes(q))
    ).map(c => ({ ...c, type: 'customer' }));

    setSearchResults([...matchedTrucks, ...matchedCustomers].slice(0, 8));
  };

  const handleResultClick = (item) => {
    let lat, lng;
    if (item.type === 'truck') {
      lat = parseFloat(item.lat);
      lng = parseFloat(item.lng);
      if (isNaN(lat) || isNaN(lng)) {
        const zone = zones.find(z => z.name === item.route_name);
        const center = zone?.coordinates?.[0] || [9.524, 45.535];
        lat = center[0]; lng = center[1];
      }
      toast.success(`Locating Truck: ${item.vehicle_plate || item.driver_name}`, { icon: '🚛' });
    } else {
      lat = parseFloat(item.lat);
      lng = parseFloat(item.lng);
      toast.success(`Locating Customer: ${item.name}`, { icon: '🏠' });
    }
    
    if (!isNaN(lat) && !isNaN(lng)) {
      flyToLocation([lat, lng], 18);
    }
    setLocalSearch('');
    setSearchResults([]);
  };

  const loadData = async () => {
    try {
      const [custData, taskData, zonesData, notificationsData, trucksData] = await Promise.all([
        api.getCustomers(),
        api.getTasks(),
        api.getZones(),
        api.getNotifications(currentUser?.id || 1),
        api.getTrucks()
      ]);
      
      setCustomers(custData.map(c => ({
        ...c,
        isValidPos: !isNaN(parseFloat(c.lat)) && parseFloat(c.lat) !== 0
      })));
      setTasks(taskData);
      setZones(zonesData);
      setDbTrucks(trucksData);
      setActivities(notificationsData.slice(0, 30));
    } catch (err) {
      console.error("Load failed", err);
    } finally {
      setLoading(false);
    }
  };

  const flyToLocation = (pos, zoom = 16) => {
    if (mapRef && pos) mapRef.flyTo(pos, zoom, { duration: 2.5 });
  };

  const handleSelectTask = async (task) => {
    setSelectedTaskId(task.id);
    try {
      const tCusts = await api.getTaskCustomers(task.id);
      setSelectedTaskCustomers(tCusts);
      const h = await api.getTaskHistory(task.id);
      if (h && h.length > 0) {
        const points = h.map(p => [parseFloat(p.lat), parseFloat(p.lng)]);
        setTaskHistory({ ...taskHistory, [task.id]: points });
        flyToLocation(points[points.length - 1], 15);
      }
    } catch (e) { console.error(e); }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Completed': return '#22c55e';
      case 'In Progress': return '#3FAE2A';
      case 'Pending': return '#ef4444';
      default: return '#64748b';
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'active') return t.status === 'In Progress';
    if (selectedFilter === 'pending') return t.status === 'Pending';
    return true;
  });

  const _onCreated = (e) => {
    if (e.layerType === 'polygon') {
      const latlngs = e.layer.getLatLngs()[0].map(ll => [ll.lat, ll.lng]);
      setDrawnPolygon({ layer: e.layer, latlngs });
      setShowAssignModal(true);
    }
  };

  if (loading) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <Loader2 className="spin" size={48} color="#3FAE2A" />
        <div style={{ fontWeight: 800, color: '#64748b', fontSize: '1.2rem', letterSpacing: '1px' }}>SYNCHRONIZING MAP...</div>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 120px)', borderRadius: '36px', overflow: 'hidden', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
      
      {/* --- FLOATING HEADER (TOP LEFT) --- */}
      <div style={{ position: 'absolute', top: '24px', left: '24px', zIndex: 1000, display: 'flex', flexWrap: 'wrap', gap: '12px', pointerEvents: 'none', alignItems: 'center' }}>
        <div className="glass" style={{ display: 'flex', gap: '6px', padding: '8px', borderRadius: '22px', backgroundColor: 'rgba(255,255,255,0.95)', boxShadow: '0 15px 30px rgba(0,0,0,0.1)', pointerEvents: 'auto' }}>
          {['all', 'active', 'pending'].map(f => (
            <button key={f} onClick={() => setSelectedFilter(f)} style={{
              padding: '0.8rem 1.8rem', borderRadius: '16px', fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase',
              backgroundColor: selectedFilter === f ? '#3FAE2A' : 'transparent',
              color: selectedFilter === f ? 'white' : '#64748b',
              border: 'none', cursor: 'pointer', transition: 'all 0.3s'
            }}>
              {f} ({tasks.filter(t => f === 'all' ? true : (f === 'active' ? t.status === 'In Progress' : t.status === 'Pending')).length})
            </button>
          ))}
        </div>

        <div className="glass" style={{ 
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 20px', 
          borderRadius: '22px', backgroundColor: 'rgba(255,255,255,0.95)', 
          boxShadow: '0 15px 30px rgba(0,0,0,0.1)', pointerEvents: 'auto',
          width: '320px', border: '1px solid rgba(63,174,42,0.1)'
        }}>
          <Search size={20} color="#3FAE2A" />
          <input 
            id="google-search-input"
            type="text" 
            placeholder="Search Truck, Customer, Street..." 
            value={localSearch}
            onChange={(e) => handleLocalSearch(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 800, color: '#1e293b', width: '100%', fontSize: '0.9rem' }}
            onFocus={(e) => {
              if (window.google && !e.target.dataset.autocomplete) {
                const autocomplete = new window.google.maps.places.Autocomplete(e.target, {
                  componentRestrictions: { country: 'so' },
                  fields: ['geometry', 'name']
                });
                autocomplete.addListener('place_changed', () => {
                  const place = autocomplete.getPlace();
                  if (place.geometry) {
                    const loc = [place.geometry.location.lat(), place.geometry.location.lng()];
                    flyToLocation(loc, 17);
                    toast.success(`Flying to ${place.name}`);
                  }
                });
                e.target.dataset.autocomplete = "true";
              }
            }}
          />
          {searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px',
              backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden', zIndex: 2000, border: '1px solid #f1f5f9'
            }}>
              {searchResults.map((res, i) => (
                <div 
                  key={i} 
                  onClick={() => handleResultClick(res)}
                  style={{
                    padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
                    cursor: 'pointer', borderBottom: i === searchResults.length - 1 ? 'none' : '1px solid #f1f5f9',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {res.type === 'truck' ? <Truck size={18} color="#3FAE2A" /> : <Home size={18} color="#ef4444" />}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1e293b' }}>{res.type === 'truck' ? (res.vehicle_plate || res.driver_name) : res.name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{res.type === 'truck' ? `Driver: ${res.driver_name}` : `Phone: ${res.phone}`}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass" style={{ padding: '10px 24px', borderRadius: '22px', backgroundColor: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', gap: '16px', pointerEvents: 'auto', boxShadow: '0 15px 30px rgba(0,0,0,0.1)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3FAE2A', animation: 'pulse 1.5s infinite' }}></div>
              <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#1e293b' }}>OPERATIONAL</span>
           </div>
        </div>
      </div>

      {/* --- FLOATING STATUS (TOP RIGHT) --- */}
      <div style={{ position: 'absolute', top: '24px', right: '24px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end', pointerEvents: 'none' }}>
        <div className="glass" style={{ padding: '14px 28px', borderRadius: '100px', backgroundColor: 'rgba(15, 23, 42, 0.95)', color: 'white', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', pointerEvents: 'auto' }}>
           <Radio size={20} color="#4ade80" className="pulse" />
           <span style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px' }}>GURMAD LIVE</span>
        </div>

        <div style={{ display: 'flex', gap: '10px', pointerEvents: 'auto' }}>
           <button onClick={() => setMapStyle(mapStyle === 'satellite' ? 'streets' : 'satellite')} className="glass" style={{ width: '56px', height: '56px', borderRadius: '18px', backgroundColor: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
              {mapStyle === 'satellite' ? <MapIcon size={24} /> : <Layers size={24} />}
           </button>
           <button onClick={() => mapRef?.setView([9.524, 45.535], 14)} className="glass" style={{ width: '56px', height: '56px', borderRadius: '18px', backgroundColor: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
              <Navigation size={24} />
           </button>
        </div>
      </div>

      {/* --- MAIN MAP --- */}
      <MapContainer center={[9.524, 45.535]} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false} ref={setMapRef}>
        <TileLayer
          url={mapStyle === 'streets' 
            ? `https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBtwC1mQXQls62Q7CzTpnU0qyVJzevPZTs'}`
            : `https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBtwC1mQXQls62Q7CzTpnU0qyVJzevPZTs'}`
          }
          subdomains={['mt0','mt1','mt2','mt3']}
          attribution='&copy; Google Maps'
        />

        {/* Operational Zones */}
        {zones.map(z => z.coordinates && (
          <Polygon key={z.id} positions={z.coordinates} pathOptions={{ color: '#3FAE2A', fillColor: '#3FAE2A', fillOpacity: 0.08, weight: 2, dashArray: '8, 12' }} />
        ))}

        {/* Active Driver Markers */}
        {filteredTasks.map(t => {
          let pos = [parseFloat(t.lat), parseFloat(t.lng)];
          if (isNaN(pos[0]) || isNaN(pos[1])) {
            const zone = zones.find(z => z.name === t.route_name);
            const center = zone?.coordinates?.[0] || [9.524, 45.535];
            pos = [center[0] + (Math.random()-0.5)*0.002, center[1] + (Math.random()-0.5)*0.002];
            t.lat = pos[0];
            t.lng = pos[1];
          }
          
          return (
            <AnimatedTruckMarker 
              key={t.id} 
              task={t} 
              isSelected={selectedTaskId === t.id} 
              onSelect={() => handleSelectTask(t)}
              onOptimizeRoute={handleOptimizeRoute}
            />
          );
        })}

        {/* Vehicle Route History */}
        {selectedTaskId && taskHistory[selectedTaskId] && (
          <Polyline 
            positions={taskHistory[selectedTaskId]} 
            pathOptions={{ 
              color: '#3FAE2A', 
              weight: 5, 
              opacity: 0.8, 
              lineCap: 'round', 
              lineJoin: 'round',
              dashArray: '1, 10'
            }} 
          />
        )}

        {/* AI Optimized Route */}
        {optimizedRoute && optimizedRoute.geometry && optimizedRoute.geometry.coordinates && (
          <Polyline 
            positions={optimizedRoute.geometry.coordinates.map(c => [c[1], c[0]])} 
            pathOptions={{ 
              color: '#4f46e5', // Indigo
              weight: 6, 
              opacity: 0.9, 
              lineCap: 'round', 
              lineJoin: 'round'
            }} 
          />
        )}

        {/* Customer Locations */}
        {customers.filter(c => c.isValidPos).map(c => (
          <Marker key={c.id} position={[parseFloat(c.lat), parseFloat(c.lng)]} icon={customerHomeIcon(c.status)}>
            <Tooltip direction="top" offset={[0, -15]} opacity={1}>
              <div style={{ padding: '8px 12px', borderRadius: '12px', backgroundColor: 'white', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
                <div style={{ fontWeight: 900, color: '#1e293b', fontSize: '0.9rem' }}>{c.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>House {c.house_no} • {c.status}</div>
              </div>
            </Tooltip>

            <Popup>
              <div style={{ minWidth: '240px', borderRadius: '24px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: c.status === 'Paid' ? '#3FAE2A' : '#ef4444', padding: '16px', color: 'white' }}>
                  <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{c.name}</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>House #{c.house_no} • {c.area}</div>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Radio size={16} color="#64748b" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>PHONE NUMBER</div>
                      <div style={{ fontWeight: 800, color: '#1e293b' }}>{c.phone}</div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MapPin size={16} color="#64748b" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>NEIGHBORHOOD</div>
                      <div style={{ fontWeight: 800, color: '#1e293b' }}>{c.neighborhood || 'Not Specified'}</div>
                    </div>
                  </div>

                  <div style={{ padding: '12px', borderRadius: '16px', backgroundColor: c.status === 'Paid' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${c.status === 'Paid' ? '#dcfce7' : '#fee2e2'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 900, fontSize: '0.8rem', color: c.status === 'Paid' ? '#166534' : '#991b1b' }}>PAYMENT STATUS</span>
                      <span style={{ fontWeight: 900, fontSize: '0.8rem', color: c.status === 'Paid' ? '#166534' : '#991b1b', textTransform: 'uppercase' }}>{c.status}</span>
                    </div>
                  </div>

                  <button className="btn-primary" style={{ width: '100%', padding: '10px', borderRadius: '12px', fontSize: '0.85rem', marginTop: '4px' }}>
                    VIEW FULL HISTORY
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Idle Gawaadhida */}
        {dbTrucks.filter(trk => !tasks.some(t => t.vehicle_plate === trk.plate_number && t.status !== 'Completed')).map(trk => (
          <Marker key={`idle-${trk.id}`} position={[9.518 + (Math.random()-0.5)*0.003, 45.545 + (Math.random()-0.5)*0.003]} icon={idleTruckIcon}>
            <Tooltip direction="top" offset={[0, -10]}><span style={{ fontWeight: 800, fontSize: '0.75rem' }}>{trk.plate_number} (IDLE)</span></Tooltip>
          </Marker>
        ))}

        <FeatureGroup>
          <EditControl position='topleft' onCreated={_onCreated} draw={{ rectangle: false, circle: false, circlemarker: false, marker: false, polyline: false }} />
        </FeatureGroup>
      </MapContainer>



      {/* --- ASSIGN MODAL --- */}
      {showAssignModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(10px)' }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card" style={{ width: '480px', backgroundColor: 'white', padding: '2.5rem', borderRadius: '40px', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}>
            <h2 style={{ margin: '0 0 1.5rem 0', fontWeight: 900, fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <MapIcon size={32} color="#3FAE2A" /> New Zone Area
            </h2>
            <p style={{ fontSize: '1.1rem', color: '#64748b', marginBottom: '2.5rem', lineHeight: 1.6 }}>
              Waxaad khariidada ka calaamadaysay aag cusub. Fadlan dooro zone-ka uu aaggan ka tirsan yahay si loo badbaadiyo.
            </p>
            <div style={{ marginBottom: '2.5rem' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>DOORO ZONE-KA</label>
              <select value={selectedZoneToAssign} onChange={(e) => setSelectedZoneToAssign(e.target.value)} style={{ width: '100%', padding: '1.2rem', borderRadius: '20px', border: '3px solid #f1f5f9', outline: 'none', fontSize: '1.1rem', fontWeight: 700 }}>
                <option value="">-- Dooro Zone --</option>
                {zones.map(z => <option key={z.id} value={z.name}>{z.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button onClick={() => setShowAssignModal(false)} style={{ flex: 1, padding: '1.2rem', borderRadius: '20px', border: 'none', backgroundColor: '#f1f5f9', color: '#64748b', fontWeight: 900, cursor: 'pointer', fontSize: '1rem' }}>CANCEL</button>
              <button onClick={() => { /* logic */ }} className="btn-primary" style={{ flex: 2, padding: '1.2rem', borderRadius: '20px', fontWeight: 900, fontSize: '1rem' }}>CONFIRM BOUNDARY</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default MapView;
