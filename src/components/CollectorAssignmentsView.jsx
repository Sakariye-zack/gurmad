import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { Search, Plus, Map, User, Truck, Edit3, Trash2, XCircle, Save, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';

const CollectorAssignmentsView = ({ searchQuery = '' }) => {
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  const [formData, setFormData] = useState({
    zone_group: '',
    collector_id: '',
    collector_code: '',
    zone_id_str: '',
    truck_id: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assignmentsData, employeesData, trucksData] = await Promise.all([
        api.getCollectorAssignments(),
        api.getEmployees(),
        api.getTrucks()
      ]);
      setAssignments(assignmentsData);
      setEmployees(employeesData.filter(e => e.role === 'Collector' || e.role === 'Driver'));
      setTrucks(trucksData);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load collector assignments data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (isEditMode && selectedAssignment) {
        await api.updateCollectorAssignment(selectedAssignment.id, formData);
        toast.success('Assignment updated successfully!');
      } else {
        await api.addCollectorAssignment(formData);
        toast.success('New assignment added!');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to save assignment');
    }
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setFormData({
      zone_group: '',
      collector_id: '',
      collector_code: '',
      zone_id_str: '',
      truck_id: ''
    });
    setSelectedAssignment(null);
    setIsModalOpen(true);
  };

  const startEdit = (assignment) => {
    setIsEditMode(true);
    setSelectedAssignment(assignment);
    setFormData({
      zone_group: assignment.zone_group || '',
      collector_id: assignment.collector_id || '',
      collector_code: assignment.collector_code || '',
      zone_id_str: assignment.zone_id_str || '',
      truck_id: assignment.truck_id || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) return;
    try {
      await api.deleteCollectorAssignment(id);
      toast.success('Assignment deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete assignment');
    }
  };

  const filteredAssignments = useMemo(() => {
    if (!searchQuery) return assignments;
    const lowerQ = searchQuery.toLowerCase();
    return assignments.filter(a => 
      (a.zone_group && a.zone_group.toLowerCase().includes(lowerQ)) ||
      (a.collector_name && a.collector_name.toLowerCase().includes(lowerQ)) ||
      (a.collector_code && a.collector_code.toLowerCase().includes(lowerQ)) ||
      (a.zone_id_str && a.zone_id_str.toLowerCase().includes(lowerQ))
    );
  }, [assignments, searchQuery]);

  if (loading) return <div className="card glass">Loading assignments...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Collector Assignments</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Manage zone groups, collector IDs, and auto-calculated performance stats.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', 
            padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--border-color)', fontWeight: 500, backgroundColor: 'white'
          }}>
            <Filter size={18} /> Filter
          </button>
          <button 
            onClick={openAddModal}
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.25rem' }}
          >
            <Plus size={18} /> Assign Collector
          </button>
        </div>
      </div>

      {/* Directory Table */}
      <div className="card" style={{ padding: 0, overflow: 'x-auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>ZONE (GROUP)</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>NAME</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>COLLECTOR ID</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', textAlign: 'center' }}>TOTAL CUSTOMER</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', textAlign: 'center' }}>TOTAL PAID</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>ZONE ID</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>ASSIGNED TRUCK</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssignments.length === 0 ? (
                <tr>
                    <td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No assignments found.
                    </td>
                </tr>
            ) : filteredAssignments.map((a, idx) => (
              <tr key={a.id} 
                  style={{ 
                    borderBottom: '1px solid var(--border-color)', 
                    transition: 'background-color 0.2s',
                    backgroundColor: idx % 2 === 1 ? '#f8fafc' : 'white'
                  }}
                  onMouseEnter={(ev) => ev.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseLeave={(ev) => ev.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#f8fafc' : 'white'}
              >
                <td style={{ padding: '1rem', fontWeight: 600 }}>{a.zone_group}</td>
                <td style={{ padding: '1rem', fontWeight: 600, color: '#3b82f6' }}>{a.collector_name || 'N/A'}</td>
                <td style={{ padding: '1rem', fontWeight: 500 }}>{a.collector_code}</td>
                <td style={{ padding: '1rem', fontWeight: 700, textAlign: 'center', color: '#f59e0b' }}>
                  {a.total_customers || 0}
                </td>
                <td style={{ padding: '1rem', fontWeight: 700, textAlign: 'center', color: 'var(--gurmad-green)' }}>
                  {a.total_paid || 0}
                </td>
                <td style={{ padding: '1rem', fontWeight: 500 }}>{a.zone_id_str}</td>
                <td style={{ padding: '1rem', fontWeight: 700 }}>{a.assigned_truck || 'N/A'}</td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => startEdit(a)}
                      style={{ color: '#3b82f6', background: '#eff6ff', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                      title="Edit"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(a.id)}
                      style={{ color: '#ef4444', background: '#fef2f2', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ====== Add/Edit Modal ====== */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
          <div className="card glass" style={{ width: '500px', maxHeight: '90vh', overflowY: 'auto', animation: 'slideIn 0.3s ease-out', borderTop: '4px solid var(--gurmad-green)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Map color="var(--gurmad-green)" />
                {isEditMode ? 'Edit Assignment' : 'New Assignment'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Zone Group */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Zone / Group</label>
                <input required placeholder="e.g. Group 1" value={formData.zone_group} onChange={e => setFormData({...formData, zone_group: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
              </div>

              {/* Collector / Employee */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Assign Employee (Collector)</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
                  <select required value={formData.collector_id} onChange={e => setFormData({...formData, collector_id: e.target.value})} style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}>
                    <option value="">-- Select Collector --</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}
                  </select>
                </div>
              </div>

              {/* Collector Code / ID */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Collector ID (Code)</label>
                <input required placeholder="e.g. 11 - A" value={formData.collector_code} onChange={e => setFormData({...formData, collector_code: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
              </div>

              {/* Zone ID String */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Full Zone ID</label>
                <input required placeholder="e.g. ZONE B - 11 - A" value={formData.zone_id_str} onChange={e => setFormData({...formData, zone_id_str: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
              </div>

              {/* Assigned Truck */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Assign Truck</label>
                <div style={{ position: 'relative' }}>
                  <Truck size={16} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
                  <select value={formData.truck_id} onChange={e => setFormData({...formData, truck_id: e.target.value})} style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}>
                    <option value="">-- Select Truck (Optional) --</option>
                    {trucks.map(t => <option key={t.id} value={t.id}>{t.plate_number} {t.model ? `(${t.model})` : ''}</option>)}
                  </select>
                </div>
              </div>
              
              <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '0.75rem 1.5rem', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Save size={18} /> {isEditMode ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CollectorAssignmentsView;
