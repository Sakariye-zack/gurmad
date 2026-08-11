import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { MapPin, Phone, CheckCircle2, RefreshCw, Truck } from 'lucide-react';
import { toast } from 'react-hot-toast';

const MyRouteTodayView = ({ searchQuery = '' }) => {
  const [customers, setCustomers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState(null);

  const fetchData = () => {
    setLoading(true);
    api.getMyTodayRoute()
      .then(data => {
        setCustomers(data.customers || []);
        setTasks(data.tasks || []);
      })
      .catch(() => toast.error("Failed to load today's route"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const getCurrentLocation = () => new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({}), // no location available/denied - still allow marking as collected
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 5000 }
    );
  });

  const handleMarkServiced = async (c) => {
    setMarkingId(c.id);
    try {
      const location = await getCurrentLocation();
      await api.markCustomerServiced(c.task_id, c.id, location);
      toast.success(`${c.name} marked as collected!`);
      fetchData();
    } catch (err) {
      toast.error('Failed to mark as collected');
    } finally {
      setMarkingId(null);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q);
  });

  const collectedCount = customers.filter(c => c.collected).length;

  if (loading) return <div className="card glass">Loading today's route...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>My Route Today</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            {tasks.length > 0
              ? `Route: ${tasks.map(t => t.route_name).filter(Boolean).join(', ') || 'Assigned task'}`
              : 'No route assigned to you today.'}
          </p>
        </div>
        <button
          onClick={fetchData}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'white', fontWeight: 600, cursor: 'pointer' }}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
        <div className="card" style={{ padding: '1.25rem 1.5rem', borderRadius: '20px', border: '1px solid #f1f5f9', borderLeftWidth: '4px', borderLeftColor: '#3b82f6', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '12px', color: '#3b82f6' }}><Truck size={20} /></div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Total Stops</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900 }}>{customers.length}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '1.25rem 1.5rem', borderRadius: '20px', border: '1px solid #f1f5f9', borderLeftWidth: '4px', borderLeftColor: 'var(--gurmad-green)', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '12px', color: 'var(--gurmad-green)' }}><CheckCircle2 size={20} /></div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Collected</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--gurmad-green)' }}>{collectedCount}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '1.25rem 1.5rem', borderRadius: '20px', border: '1px solid #f1f5f9', borderLeftWidth: '4px', borderLeftColor: '#f97316', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ backgroundColor: '#ffedd5', padding: '10px', borderRadius: '12px', color: '#f97316' }}><MapPin size={20} /></div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Remaining</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f97316' }}>{customers.length - collectedCount}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '650px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>CUSTOMER</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>PHONE</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>ADDRESS</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>ZONE / GROUP</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', textAlign: 'center' }}>STATUS</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>LOCATION COLLECTED</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No route assigned to you today.
                  </td>
                </tr>
              ) : filteredCustomers.map((c, idx) => (
                <tr key={`${c.task_id}-${c.id}`} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: idx % 2 === 1 ? '#f8fafc' : 'white', opacity: c.collected ? 0.7 : 1 }}>
                  <td style={{ padding: '1rem', fontWeight: 700 }}>{c.name}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={14} /> {c.phone}</div>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                    {[c.house_no, c.street, c.area].filter(Boolean).join(', ') || 'N/A'}
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 600, color: '#0ea5e9' }}>{c.zone || 'N/A'}</td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    {c.collected ? (
                      <span style={{ color: 'var(--gurmad-green)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={16} /> Collected</span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontWeight: 600 }}>Pending</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {c.collected_lat && c.collected_lng ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${c.collected_lat},${c.collected_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--gurmad-green)', fontWeight: 600, fontSize: '0.85rem' }}
                      >
                        <MapPin size={14} /> View on Map
                      </a>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{c.collected ? 'No GPS captured' : '-'}</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button
                      onClick={() => handleMarkServiced(c)}
                      disabled={c.collected || markingId === c.id}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none',
                        backgroundColor: c.collected ? '#f0fdf4' : 'var(--gurmad-green)', color: c.collected ? 'var(--gurmad-green)' : 'white',
                        fontWeight: 700, cursor: c.collected ? 'default' : 'pointer'
                      }}
                    >
                      <CheckCircle2 size={16} /> {c.collected ? 'Done' : (markingId === c.id ? 'Saving...' : 'Mark Collected')}
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

export default MyRouteTodayView;
