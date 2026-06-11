import React, { useState, useEffect } from 'react';
import { 
  History, User, Activity, Search, Filter, 
  Download, Eye, XCircle, FileJson, AlertCircle, FileText
} from 'lucide-react';
import { api } from '../api';
import toast from 'react-hot-toast';

const AuditLogsView = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, startDate, endDate]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs({ 
        action: actionFilter, 
        search, 
        startDate, 
        endDate 
      });
      setLogs(data);
    } catch (err) {
      toast.error(`Failed to load audit logs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    if(e.key === 'Enter') fetchLogs();
  };

  const exportToCSV = () => {
    if(logs.length === 0) return toast.error('No data to export');
    
    const headers = ['Timestamp', 'User', 'IP Address', 'Action', 'Entity Type', 'Entity ID', 'Details'];
    const rows = logs.map(l => [
      new Date(l.created_at).toLocaleString(),
      l.full_name || l.username,
      l.ip_address || 'N/A',
      l.action,
      l.entity_type,
      l.entity_id,
      l.new_values ? 'Modified Data' : 'No Data'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `gurmad_audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' };
      case 'UPDATE': return { bg: '#e0f2fe', text: '#075985', border: '#bae6fd' };
      case 'DELETE': return { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' };
      case 'LOGIN': return { bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
      default: return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
    }
  };

  const renderDiff = (oldVals, newVals) => {
    if (!oldVals && !newVals) return <p>No data available</p>;
    const keys = new Set([...Object.keys(oldVals || {}), ...Object.keys(newVals || {})]);
    
    return (
      <div style={{ display: 'grid', gap: '8px', marginTop: '1rem' }}>
        {Array.from(keys).map(key => {
          const oldV = oldVals?.[key] ?? '-';
          const newV = newVals?.[key] ?? '-';
          if (oldV === newV) return null; // Only show changes
          
          return (
            <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
               <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>{key} (Old)</span>
                  <div style={{ color: '#ef4444', textDecoration: 'line-through', fontSize: '0.85rem', fontWeight: 600 }}>{JSON.stringify(oldV)}</div>
               </div>
               <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>{key} (New)</span>
                  <div style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>{JSON.stringify(newV)}</div>
               </div>
            </div>
          )
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '12px', color: '#1e293b' }}>
            <History size={28} color="var(--gurmad-green)" /> System Audit Logs
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Top-tier security tracking and data diffing.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={exportToCSV} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}>
             <Download size={16} /> Export CSV
          </button>
          <button onClick={fetchLogs} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <Activity size={16} /> Refresh
          </button>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end', padding: '1.5rem', borderRadius: '16px', backgroundColor: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        <div style={{ flex: '1 1 300px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Search Logs</label>
          <div style={{ position: 'relative' }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search user, action, or entity..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearchSubmit}
              style={{ width: '100%', padding: '12px 16px 12px 42px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', transition: 'all 0.2s', backgroundColor: '#f8fafc' }}
              onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.backgroundColor = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)' }}
              onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.backgroundColor = '#f8fafc'; e.target.style.boxShadow = 'none' }}
            />
          </div>
        </div>
        
        <div style={{ width: '180px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Action Type</label>
          <select 
            value={actionFilter} 
            onChange={e => setActionFilter(e.target.value)} 
            style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundColor: '#f8fafc', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center', backgroundSize: '16px' }}
            onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.backgroundColor = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)' }}
            onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.backgroundColor = '#f8fafc'; e.target.style.boxShadow = 'none' }}
          >
            <option value="ALL">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>
        </div>

        <div style={{ width: '160px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Start Date</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)} 
            style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', backgroundColor: '#f8fafc' }}
            onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.backgroundColor = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)' }}
            onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.backgroundColor = '#f8fafc'; e.target.style.boxShadow = 'none' }}
          />
        </div>

        <div style={{ width: '160px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>End Date</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)} 
            style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', backgroundColor: '#f8fafc' }}
            onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.backgroundColor = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)' }}
            onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.backgroundColor = '#f8fafc'; e.target.style.boxShadow = 'none' }}
          />
        </div>
      </div>

      <div className="card" style={{ padding: 0, borderRadius: '24px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#f8fafc', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>
              <tr>
                <th style={{ padding: '1.2rem 1.5rem' }}>Timestamp</th>
                <th style={{ padding: '1.2rem 1.5rem' }}>User & IP</th>
                <th style={{ padding: '1.2rem 1.5rem' }}>Action</th>
                <th style={{ padding: '1.2rem 1.5rem' }}>Entity</th>
                <th style={{ padding: '1.2rem 1.5rem', textAlign: 'right' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <AlertCircle size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                     No audit logs found matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const colors = getActionColor(log.action);
                  return (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor='#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'}>
                    <td style={{ padding: '1.2rem 1.5rem', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>{new Date(log.created_at).toLocaleDateString()}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{new Date(log.created_at).toLocaleTimeString()}</div>
                    </td>
                    <td style={{ padding: '1.2rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ backgroundColor: '#f1f5f9', padding: '8px', borderRadius: '10px' }}><User size={16} color="#64748b" /></div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.85rem' }}>{log.full_name || log.username || 'System User'}</div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>IP: {log.ip_address || 'Internal'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1.2rem 1.5rem' }}>
                      <span style={{ 
                        padding: '6px 12px', 
                        borderRadius: '8px', 
                        fontSize: '0.7rem', 
                        fontWeight: 800, 
                        backgroundColor: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                        letterSpacing: '0.5px'
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '1.2rem 1.5rem' }}>
                      <div style={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem', textTransform: 'capitalize' }}>{log.entity_type}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>ID: #{log.entity_id}</div>
                    </td>
                    <td style={{ padding: '1.2rem 1.5rem', textAlign: 'right' }}>
                      {(log.old_values || log.new_values) ? (
                         <button onClick={() => setSelectedLog(log)} style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: '0.2s' }} onMouseEnter={e => {e.currentTarget.style.backgroundColor='#eff6ff'; e.currentTarget.style.borderColor='#bfdbfe'}} onMouseLeave={e => {e.currentTarget.style.backgroundColor='transparent'; e.currentTarget.style.borderColor='#e2e8f0'}}>
                            <Eye size={14} /> View Diff
                         </button>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: '0.75rem', fontWeight: 600 }}>N/A</span>
                      )}
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diff Modal */}
      {selectedLog && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '700px', width: '100%', padding: '0', borderRadius: '24px', backgroundColor: '#fff', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '10px', backgroundColor: '#e0e7ff', borderRadius: '12px', color: '#4f46e5' }}><FileJson size={24} /></div>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.25rem', color: '#0f172a' }}>Data Diff Viewer</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{selectedLog.action} on {selectedLog.entity_type} #{selectedLog.entity_id}</p>
                  </div>
               </div>
               <button onClick={() => setSelectedLog(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><XCircle size={24} /></button>
            </div>
            
            <div style={{ padding: '2rem', maxHeight: '60vh', overflowY: 'auto' }}>
               {selectedLog.action === 'CREATE' && (
                 <div>
                    <h4 style={{ color: '#10b981', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={18} /> New Record Created</h4>
                    <pre style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', fontSize: '0.8rem', border: '1px solid #e2e8f0', color: '#334155', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {JSON.stringify(selectedLog.new_values, null, 2)}
                    </pre>
                 </div>
               )}

               {selectedLog.action === 'DELETE' && (
                 <div>
                    <h4 style={{ color: '#ef4444', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={18} /> Record Deleted</h4>
                    <pre style={{ backgroundColor: '#fef2f2', padding: '1rem', borderRadius: '12px', fontSize: '0.8rem', border: '1px solid #fecaca', color: '#991b1b', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {JSON.stringify(selectedLog.old_values, null, 2)}
                    </pre>
                 </div>
               )}

               {selectedLog.action === 'UPDATE' && (
                 <div>
                    <h4 style={{ color: '#3b82f6', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={18} /> Fields Modified</h4>
                    {renderDiff(selectedLog.old_values, selectedLog.new_values)}
                 </div>
               )}
            </div>

            <div style={{ padding: '1.5rem 2rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
              <button onClick={() => setSelectedLog(null)} className="btn-secondary" style={{ padding: '0.75rem 2rem', borderRadius: '12px', fontWeight: 700 }}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default AuditLogsView;
