import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Users, Phone, MapPin, CheckCircle2, Wallet, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

const TodaysCollectionsView = ({ searchQuery = '', onCollectPayment, currentUser }) => {
  const [customers, setCustomers] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    api.getMyCollectorCustomers()
      .then(data => {
        setCustomers(data.customers || []);
        setCollectors(data.collectors || []);
      })
      .catch(() => toast.error("Failed to load today's collections"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q);
  });

  const collectedCount = customers.filter(c => c.collected).length;

  if (loading) return <div className="card glass">Loading today's collections...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Today's Collections</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            {collectors.length > 0
              ? `Customers your paired collector${collectors.length > 1 ? 's' : ''} (${collectors.map(c => c.collector_name).join(', ')}) are working on today.`
              : 'No collector paired to you yet - ask an admin to pair you in Cashier Assignments.'}
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
          <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '12px', color: '#3b82f6' }}><Users size={20} /></div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Total Customers</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900 }}>{customers.length}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '1.25rem 1.5rem', borderRadius: '20px', border: '1px solid #f1f5f9', borderLeftWidth: '4px', borderLeftColor: 'var(--gurmad-green)', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '12px', color: 'var(--gurmad-green)' }}><CheckCircle2 size={20} /></div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Serviced Today</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--gurmad-green)' }}>{collectedCount}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>CUSTOMER</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>PHONE</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>HOUSE / ZONE</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>COLLECTOR</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>CASHIER</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', textAlign: 'center' }}>SERVICED</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>DATE / TIME</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No customers found for today's route.
                  </td>
                </tr>
              ) : filteredCustomers.map((c, idx) => (
                <tr key={`${c.task_id}-${c.id}`} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: idx % 2 === 1 ? '#f8fafc' : 'white' }}>
                  <td style={{ padding: '1rem', fontWeight: 700 }}>{c.name}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={14} /> {c.phone}</div>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={14} /> {[c.house_no, c.area].filter(Boolean).join(', ') || c.zone || 'N/A'}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 600, color: '#0ea5e9' }}>{c.collector_name}</td>
                  <td style={{ padding: '1rem', fontWeight: 600, color: '#059669' }}>{currentUser?.full_name || currentUser?.username || 'You'}</td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    {c.collected ? (
                      <span style={{ color: 'var(--gurmad-green)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={16} /> Yes</span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontWeight: 600 }}>Not yet</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {c.collected_at ? new Date(c.collected_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button
                      onClick={() => onCollectPayment && onCollectPayment(c.phone)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--gurmad-green)', color: 'white', fontWeight: 700, cursor: 'pointer' }}
                    >
                      <Wallet size={16} /> Collect Payment
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

export default TodaysCollectionsView;
