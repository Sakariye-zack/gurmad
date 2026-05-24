import React, { useState, useEffect } from 'react';
import { 
  History, 
  User, 
  Clock, 
  Activity, 
  Search, 
  Filter, 
  ChevronRight, 
  Database,
  UserCheck,
  CreditCard,
  AlertCircle
} from 'lucide-react';
import { api } from '../api';
import toast from 'react-hot-toast';

const AuditLogsView = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUser = JSON.parse(localStorage.getItem('gurmadUser'));

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs(currentUser.role);
      setLogs(data);
    } catch (err) {
      toast.error(`Failed to load audit logs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return '#10b981';
      case 'UPDATE': return '#3b82f6';
      case 'DELETE': return '#ef4444';
      case 'LOGIN': return '#f59e0b';
      default: return '#64748b';
    }
  };

  if (loading) return <div className="card glass">Loading history...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.3s ease-out' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '12px', color: '#1e293b' }}>
            <History size={28} color="var(--gurmad-green)" /> System Audit Logs
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Tracking every critical action performed in the system</p>
        </div>
        <button onClick={fetchLogs} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
           <Activity size={18} /> Refresh Logs
        </button>
      </div>

      <div className="card" style={{ padding: 0, borderRadius: '24px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ backgroundColor: '#f8fafc', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <tr>
              <th style={{ padding: '1.2rem 1.5rem' }}>Timestamp</th>
              <th style={{ padding: '1.2rem 1.5rem' }}>User</th>
              <th style={{ padding: '1.2rem 1.5rem' }}>Action</th>
              <th style={{ padding: '1.2rem 1.5rem' }}>Module / ID</th>
              <th style={{ padding: '1.2rem 1.5rem' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                   No audit logs found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1.2rem 1.5rem', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>{new Date(log.created_at).toLocaleDateString()}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{new Date(log.created_at).toLocaleTimeString()}</div>
                  </td>
                  <td style={{ padding: '1.2rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ backgroundColor: '#f1f5f9', padding: '6px', borderRadius: '8px' }}><User size={14} /></div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.85rem' }}>{log.full_name || log.username}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>IP: {log.ip_address || 'Internal'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1.2rem 1.5rem' }}>
                    <span style={{ 
                      padding: '4px 10px', 
                      borderRadius: '8px', 
                      fontSize: '0.7rem', 
                      fontWeight: 800, 
                      backgroundColor: `${getActionColor(log.action)}15`,
                      color: getActionColor(log.action),
                      border: `1px solid ${getActionColor(log.action)}30`
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '1.2rem 1.5rem' }}>
                    <div style={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem', textTransform: 'capitalize' }}>{log.entity_type}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>ID: #{log.entity_id}</div>
                  </td>
                  <td style={{ padding: '1.2rem 1.5rem' }}>
                    {log.new_values ? (
                      <div style={{ fontSize: '0.75rem', color: '#64748b', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Modified fields: {Object.keys(log.new_values).join(', ')}
                      </div>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No specific data</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default AuditLogsView;
