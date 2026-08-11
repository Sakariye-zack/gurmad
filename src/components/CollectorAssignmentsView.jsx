import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { Search, Plus, Map, User, Truck, Edit3, Trash2, XCircle, Save, Filter, Wallet, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';

const CollectorAssignmentsView = ({ searchQuery = '', initialTab = 'collector' }) => {
  const [activeTab, setActiveTab] = useState(initialTab); // 'collector' or 'cashier'

  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  // Guided "New Truck Team" onboarding: hire driver -> assign truck -> hire collector -> assign same truck -> assign to zone
  const [isTeamWizardOpen, setIsTeamWizardOpen] = useState(false);
  const [isTeamSubmitting, setIsTeamSubmitting] = useState(false);
  const [teamForm, setTeamForm] = useState({
    truck_plate: '', truck_model: '',
    driver_name: '', driver_phone: '',
    collector_name: '', collector_phone: '',
    zone_group: '', collector_code: '', zone_id_str: ''
  });

  const [formData, setFormData] = useState({
    zone_group: '',
    collector_id: '',
    collector_code: '',
    zone_id_str: '',
    truck_id: ''
  });

  // Cashier assignments
  const [cashierAssignments, setCashierAssignments] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [isCashierModalOpen, setIsCashierModalOpen] = useState(false);
  const [isCashierEditMode, setIsCashierEditMode] = useState(false);
  const [selectedCashierAssignment, setSelectedCashierAssignment] = useState(null);
  const [cashierFormData, setCashierFormData] = useState({
    zone_group: '',
    cashier_id: '',
    collector_id: '',
    zone_id_str: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assignmentsData, employeesData, trucksData, cashierAssignmentsData, usersData] = await Promise.all([
        api.getCollectorAssignments(),
        api.getEmployees(),
        api.getTrucks(),
        api.getCashierAssignments().catch(() => []),
        api.getUsers().catch(() => [])
      ]);
      setAssignments(assignmentsData);
      setEmployees(employeesData.filter(e => e.role === 'Collector' || e.role === 'Driver'));
      setTrucks(trucksData);
      setCashierAssignments(cashierAssignmentsData || []);
      setCashiers((usersData || []).filter(u => u.role === 'cashier'));
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

  const openTeamWizard = () => {
    setTeamForm({
      truck_plate: '', truck_model: '',
      driver_name: '', driver_phone: '',
      collector_name: '', collector_phone: '',
      zone_group: '', collector_code: '', zone_id_str: ''
    });
    setIsTeamWizardOpen(true);
  };

  const handleTeamWizardSubmit = async (e) => {
    e.preventDefault();
    setIsTeamSubmitting(true);
    try {
      // Step 1: register the truck
      const truck = await api.addTruck({ plate_number: teamForm.truck_plate, model: teamForm.truck_model });

      // Step 2: hire the driver, linked to this truck (no login - just a staff record)
      const driverFd = new FormData();
      driverFd.append('name', teamForm.driver_name);
      driverFd.append('role', 'Driver');
      driverFd.append('phone', teamForm.driver_phone);
      await api.addEmployee(driverFd);

      // Step 3: hire the collector, linked to the same truck
      const collectorFd = new FormData();
      collectorFd.append('name', teamForm.collector_name);
      collectorFd.append('role', 'Collector');
      collectorFd.append('phone', teamForm.collector_phone);
      const collector = await api.addEmployee(collectorFd);

      // Step 4: assign the truck (with its driver+collector) to a zone/group
      await api.addCollectorAssignment({
        zone_group: teamForm.zone_group,
        collector_id: collector.id,
        collector_code: teamForm.collector_code,
        zone_id_str: teamForm.zone_id_str || teamForm.zone_group,
        truck_id: truck.id
      });

      toast.success('Truck team onboarded: truck, driver, collector, and zone assignment all created!');
      setIsTeamWizardOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to complete truck-team onboarding');
    } finally {
      setIsTeamSubmitting(false);
    }
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

  // Cashier assignment handlers
  const handleCashierSave = async (e) => {
    e.preventDefault();
    try {
      if (isCashierEditMode && selectedCashierAssignment) {
        await api.updateCashierAssignment(selectedCashierAssignment.id, cashierFormData);
        toast.success('Cashier assignment updated!');
      } else {
        await api.addCashierAssignment(cashierFormData);
        toast.success('Cashier assigned to zone!');
      }
      setIsCashierModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to save cashier assignment');
    }
  };

  const openAddCashierModal = () => {
    setIsCashierEditMode(false);
    setCashierFormData({ zone_group: '', cashier_id: '', collector_id: '', zone_id_str: '' });
    setSelectedCashierAssignment(null);
    setIsCashierModalOpen(true);
  };

  const startEditCashier = (assignment) => {
    setIsCashierEditMode(true);
    setSelectedCashierAssignment(assignment);
    setCashierFormData({
      zone_group: assignment.zone_group || '',
      cashier_id: assignment.cashier_id || '',
      collector_id: assignment.collector_id || '',
      zone_id_str: assignment.zone_id_str || ''
    });
    setIsCashierModalOpen(true);
  };

  const handleDeleteCashier = async (id) => {
    if (!window.confirm('Are you sure you want to delete this cashier assignment?')) return;
    try {
      await api.deleteCashierAssignment(id);
      toast.success('Cashier assignment deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete cashier assignment');
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

  const filteredCashierAssignments = useMemo(() => {
    if (!searchQuery) return cashierAssignments;
    const lowerQ = searchQuery.toLowerCase();
    return cashierAssignments.filter(a =>
      (a.zone_group && a.zone_group.toLowerCase().includes(lowerQ)) ||
      (a.cashier_name && a.cashier_name.toLowerCase().includes(lowerQ)) ||
      (a.zone_id_str && a.zone_id_str.toLowerCase().includes(lowerQ))
    );
  }, [cashierAssignments, searchQuery]);

  if (loading) return <div className="card glass">Loading assignments...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
            {activeTab === 'collector' ? 'Collector Assignments' : 'Cashier Assignments'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            {activeTab === 'collector'
              ? 'Manage zone groups, collector IDs, and auto-calculated performance stats.'
              : 'Assign each cashier to the zone/group they collect money for.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {activeTab === 'collector' ? (
            <>
              <button
                onClick={openTeamWizard}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--gurmad-green)', background: 'white', color: 'var(--gurmad-green)', fontWeight: 700 }}
              >
                <Sparkles size={18} /> New Truck Team
              </button>
              <button
                onClick={openAddModal}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.25rem' }}
              >
                <Plus size={18} /> Assign Collector
              </button>
            </>
          ) : (
            <button
              onClick={openAddCashierModal}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.25rem' }}
            >
              <Plus size={18} /> Assign Cashier
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <button
          onClick={() => setActiveTab('collector')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'collector' ? '2px solid var(--gurmad-green)' : '2px solid transparent',
            color: activeTab === 'collector' ? 'var(--gurmad-green)' : 'var(--text-muted)',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <Map size={18} /> Collectors
        </button>
        <button
          onClick={() => setActiveTab('cashier')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'cashier' ? '2px solid var(--gurmad-green)' : '2px solid transparent',
            color: activeTab === 'cashier' ? 'var(--gurmad-green)' : 'var(--text-muted)',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <Wallet size={18} /> Cashiers
        </button>
      </div>

      {activeTab === 'collector' ? (
      <>
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

      {/* ====== Guided "New Truck Team" Onboarding Wizard ====== */}
      {isTeamWizardOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
          <div className="card glass" style={{ width: '560px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', borderTop: '4px solid var(--gurmad-green)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles color="var(--gurmad-green)" /> New Truck Team
              </h3>
              <button onClick={() => setIsTeamWizardOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <XCircle size={24} />
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              One guided sequence: register the truck, hire the driver, hire the collector, then dispatch that truck team to a zone.
            </p>

            <form onSubmit={handleTeamWizardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--gurmad-green)', marginBottom: '0.75rem' }}>STEP 1 &middot; Register the Truck</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <input required placeholder="Plate number" value={teamForm.truck_plate} onChange={e => setTeamForm({...teamForm, truck_plate: e.target.value})} style={{ padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                  <input placeholder="Model (optional)" value={teamForm.truck_model} onChange={e => setTeamForm({...teamForm, truck_model: e.target.value})} style={{ padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--gurmad-green)', marginBottom: '0.75rem' }}>STEP 2 &middot; Hire the Driver (no login needed)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <input required placeholder="Driver full name" value={teamForm.driver_name} onChange={e => setTeamForm({...teamForm, driver_name: e.target.value})} style={{ padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                  <input required placeholder="Driver phone" value={teamForm.driver_phone} onChange={e => setTeamForm({...teamForm, driver_phone: e.target.value})} style={{ padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--gurmad-green)', marginBottom: '0.75rem' }}>STEP 3 &middot; Hire the Collector (same truck)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <input required placeholder="Collector full name" value={teamForm.collector_name} onChange={e => setTeamForm({...teamForm, collector_name: e.target.value})} style={{ padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                  <input required placeholder="Collector phone" value={teamForm.collector_phone} onChange={e => setTeamForm({...teamForm, collector_phone: e.target.value})} style={{ padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Create their system login separately from Settings → Users once this wizard finishes.</p>
              </div>

              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--gurmad-green)', marginBottom: '0.75rem' }}>STEP 4 &middot; Assign the Truck Team to a Zone</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <input required placeholder="Zone / Group (e.g. Group1)" value={teamForm.zone_group} onChange={e => setTeamForm({...teamForm, zone_group: e.target.value})} style={{ padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                  <input required placeholder="Collector ID/code" value={teamForm.collector_code} onChange={e => setTeamForm({...teamForm, collector_code: e.target.value})} style={{ padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setIsTeamWizardOpen(false)} style={{ padding: '0.75rem 1.5rem', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isTeamSubmitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Save size={18} /> {isTeamSubmitting ? 'Creating team...' : 'Create Truck Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>
      ) : (
      <>
      {/* Cashier Directory Table */}
      <div className="card" style={{ padding: 0, overflow: 'x-auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>ZONE (GROUP)</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>CASHIER</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>PAIRED COLLECTOR</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>ZONE ID</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', textAlign: 'center' }}>TOTAL CUSTOMER</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', textAlign: 'center' }}>TOTAL PAID</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredCashierAssignments.length === 0 ? (
                <tr>
                    <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No cashier assignments found.
                    </td>
                </tr>
            ) : filteredCashierAssignments.map((a, idx) => (
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
                <td style={{ padding: '1rem', fontWeight: 600, color: '#3b82f6' }}>{a.cashier_name || 'N/A'}</td>
                <td style={{ padding: '1rem', fontWeight: 600, color: '#8b5cf6' }}>{a.collector_name || 'N/A'}</td>
                <td style={{ padding: '1rem', fontWeight: 500 }}>{a.zone_id_str}</td>
                <td style={{ padding: '1rem', fontWeight: 700, textAlign: 'center', color: '#f59e0b' }}>
                  {a.total_customers || 0}
                </td>
                <td style={{ padding: '1rem', fontWeight: 700, textAlign: 'center', color: 'var(--gurmad-green)' }}>
                  {a.total_paid || 0}
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => startEditCashier(a)}
                      style={{ color: '#3b82f6', background: '#eff6ff', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                      title="Edit"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteCashier(a.id)}
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

      {/* ====== Cashier Add/Edit Modal ====== */}
      {isCashierModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
          <div className="card glass" style={{ width: '500px', maxHeight: '90vh', overflowY: 'auto', animation: 'slideIn 0.3s ease-out', borderTop: '4px solid var(--gurmad-green)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet color="var(--gurmad-green)" />
                {isCashierEditMode ? 'Edit Cashier Assignment' : 'Assign Cashier to Zone'}
              </h3>
              <button onClick={() => setIsCashierModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleCashierSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Zone Group */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Zone / Group</label>
                <input required placeholder="e.g. Group 1" value={cashierFormData.zone_group} onChange={e => setCashierFormData({...cashierFormData, zone_group: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
              </div>

              {/* Cashier */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Assign Cashier</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
                  <select required value={cashierFormData.cashier_id} onChange={e => setCashierFormData({...cashierFormData, cashier_id: e.target.value})} style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}>
                    <option value="">-- Select Cashier --</option>
                    {cashiers.map(c => <option key={c.id} value={c.id}>{c.full_name || c.username}</option>)}
                  </select>
                </div>
              </div>

              {/* Paired Collector */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Paired Collector</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
                  <select required value={cashierFormData.collector_id} onChange={e => setCashierFormData({...cashierFormData, collector_id: e.target.value})} style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}>
                    <option value="">-- Select Collector --</option>
                    {employees.filter(e => e.role === 'Collector').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>This cashier will only collect money for this collector's customers.</p>
              </div>

              {/* Zone ID String */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Full Zone ID (Optional)</label>
                <input placeholder="e.g. ZONE B - 11 - A" value={cashierFormData.zone_id_str} onChange={e => setCashierFormData({...cashierFormData, zone_id_str: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setIsCashierModalOpen(false)} style={{ padding: '0.75rem 1.5rem', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Save size={18} /> {isCashierEditMode ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>
      )}

    </div>
  );
};

export default CollectorAssignmentsView;
