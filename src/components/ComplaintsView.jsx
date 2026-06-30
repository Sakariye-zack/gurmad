import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, CheckCircle2, Clock, AlertCircle, User, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

const ComplaintsView = ({ searchQuery = '' }) => {
  const [complaints, setComplaints] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newComplaint, setNewComplaint] = useState({
    customer_id: '', title: '', description: '', priority: 'Medium', assigned_to: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch complaints and customers
      const [cData, custData] = await Promise.all([
        api.getComplaints(),
        api.getCustomers()
      ]);
      setComplaints(cData);
      setCustomers(custData);

      // Fetch users separately and ignore 403 errors (collectors don't have access)
      try {
        const uData = await api.getUsers();
        setUsers(uData);
      } catch (userErr) {
        setUsers([]); // Fallback for collectors
      }
      
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.addComplaint(newComplaint);
      toast.success('Complaint registered successfully');
      setIsModalOpen(false);
      setNewComplaint({ customer_id: '', title: '', description: '', priority: 'Medium', assigned_to: '' });
      loadData();
    } catch (err) {
      toast.error('Failed to register complaint');
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await api.updateComplaintStatus(id, status);
      toast.success(`Status updated to ${status}`);
      loadData();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const filteredComplaints = complaints.filter(c => {
    const search = searchQuery.toLowerCase();
    return (c.title?.toLowerCase().includes(search) || 
            c.customer_name?.toLowerCase().includes(search) ||
            c.description?.toLowerCase().includes(search));
  });

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Resolved': return { bg: '#dcfce7', text: '#15803d', icon: <CheckCircle2 size={14} /> };
      case 'In Progress': return { bg: '#eff6ff', text: '#1d4ed8', icon: <Clock size={14} /> };
      default: return { bg: '#fef3c7', text: '#b45309', icon: <AlertCircle size={14} /> };
    }
  };

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'High': return { color: '#ef4444', bg: '#fef2f2' };
      case 'Medium': return { color: '#f59e0b', bg: '#fffbeb' };
      default: return { color: '#10b981', bg: '#f0fdf4' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header & Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
           <div className="card glass" style={{ padding: '0.75rem 1.25rem', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pending</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{complaints.filter(c => c.status === 'Pending').length}</div>
           </div>
           <div className="card glass" style={{ padding: '0.75rem 1.25rem', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>In Progress</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{complaints.filter(c => c.status === 'In Progress').length}</div>
           </div>
           <div className="card glass" style={{ padding: '0.75rem 1.25rem', borderLeft: '4px solid var(--gurmad-green)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Resolved</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{complaints.filter(c => c.status === 'Resolved').length}</div>
           </div>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> New Complaint
        </button>
      </div>

      {/* Complaints List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>CUSTOMER</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>COMPLAINT</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>PRIORITY</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>ASSIGNED TO</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>STATUS</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="6" style={{ padding: '3rem', textAlign: 'center' }}>Loading complaints...</td></tr>
            ) : filteredComplaints.length === 0 ? (
              <tr><td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No complaints found.</td></tr>
            ) : filteredComplaints.map(c => {
              const ss = getStatusStyle(c.status);
              const ps = getPriorityStyle(c.priority);
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 700 }}>{c.customer_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.customer_phone}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.description}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: ps.bg, color: ps.color }}>
                      {c.priority}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                      <User size={14} style={{ color: 'var(--text-muted)' }} />
                      {c.assigned_to_name || 'Unassigned'}
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800, backgroundColor: ss.bg, color: ss.text }}>
                      {ss.icon} {c.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      {c.status !== 'In Progress' && c.status !== 'Resolved' && (
                        <button onClick={() => handleStatusUpdate(c.id, 'In Progress')} style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Start</button>
                      )}
                      {c.status !== 'Resolved' && (
                        <button onClick={() => handleStatusUpdate(c.id, 'Resolved')} style={{ backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Resolve</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* New Complaint Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card glass" style={{ width: '500px', borderTop: '4px solid #ef4444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontWeight: 800 }}>Register New Complaint</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Customer *</label>
                <select required value={newComplaint.customer_id} onChange={e => setNewComplaint({...newComplaint, customer_id: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <option value="">-- Select Customer --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Complaint Title *</label>
                <input required type="text" placeholder="e.g. Missed Collection, Rude Staff..." value={newComplaint.title} onChange={e => setNewComplaint({...newComplaint, title: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Description</label>
                <textarea required placeholder="Detailed explanation of the issue..." value={newComplaint.description} onChange={e => setNewComplaint({...newComplaint, description: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '100px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Priority</label>
                  <select value={newComplaint.priority} onChange={e => setNewComplaint({...newComplaint, priority: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Assign To</label>
                  <select value={newComplaint.assigned_to} onChange={e => setNewComplaint({...newComplaint, assigned_to: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <option value="">-- Unassigned --</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.username}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn-primary" style={{ backgroundColor: '#ef4444', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}>Submit Complaint</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplaintsView;
