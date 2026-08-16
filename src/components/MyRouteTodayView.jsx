import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { MapPin, Phone, CheckCircle2, RefreshCw, Truck, AlertTriangle, X, Camera } from 'lucide-react';
import { toast } from 'react-hot-toast';

const MISSED_REASONS = ['Customer Not Available', 'Gate/House Locked', 'No Waste to Collect', 'Access Blocked', 'Refused Service', 'Other'];

const MyRouteTodayView = ({ searchQuery = '' }) => {
  const [customers, setCustomers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState(null);
  const [missedModal, setMissedModal] = useState(null); // customer being marked missed
  const [missedForm, setMissedForm] = useState({ reason: MISSED_REASONS[0], note: '', photo: null });
  const [isSubmittingMissed, setIsSubmittingMissed] = useState(false);

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

  const openMissedModal = (c) => {
    setMissedModal(c);
    setMissedForm({ reason: MISSED_REASONS[0], note: '', photo: null });
  };

  const handleSubmitMissed = async (e) => {
    e.preventDefault();
    setIsSubmittingMissed(true);
    try {
      const location = await getCurrentLocation();
      const formData = new FormData();
      formData.append('reason', missedForm.reason);
      formData.append('note', missedForm.note);
      if (location.lat) formData.append('lat', location.lat);
      if (location.lng) formData.append('lng', location.lng);
      if (missedForm.photo) formData.append('photo', missedForm.photo);
      await api.markCustomerMissed(missedModal.task_id, missedModal.id, formData);
      toast.success(`${missedModal.name} marked as missed`);
      setMissedModal(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to mark as missed');
    } finally {
      setIsSubmittingMissed(false);
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
                    ) : c.missed ? (
                      <div>
                        <span style={{ color: '#f97316', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={15} /> Missed</span>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>{c.missed_reason}</div>
                      </div>
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
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
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
                      {!c.collected && (
                        <button
                          onClick={() => openMissedModal(c)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid #fed7aa', backgroundColor: '#fff7ed', color: '#c2410c', fontWeight: 700, cursor: 'pointer' }}
                        >
                          <AlertTriangle size={14} /> Missed
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {missedModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card glass" style={{ width: '400px', borderTop: '4px solid #f97316' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <h3 style={{ margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} color="#f97316" /> Mark Missed
              </h3>
              <button onClick={() => setMissedModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.2rem' }}>{missedModal.name}</p>
            <form onSubmit={handleSubmitMissed} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Reason</label>
                <select value={missedForm.reason} onChange={e => setMissedForm({...missedForm, reason: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  {MISSED_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Note (optional)</label>
                <textarea value={missedForm.note} onChange={e => setMissedForm({...missedForm, note: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '70px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}><Camera size={15} /> Photo (optional)</label>
                <input type="file" accept="image/*" capture="environment" onChange={e => setMissedForm({...missedForm, photo: e.target.files[0]})} style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setMissedModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600 }}>Cancel</button>
                <button type="submit" disabled={isSubmittingMissed} style={{ padding: '0.65rem 1.3rem', borderRadius: '8px', border: 'none', background: '#f97316', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                  {isSubmittingMissed ? 'Saving...' : 'Confirm Missed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyRouteTodayView;
