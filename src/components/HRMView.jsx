import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { Search, Plus, User, Phone, MoreHorizontal, Filter, Briefcase, Calendar, DollarSign, XCircle, Edit3, Trash2, Upload, Camera, FileText, Shield, Truck } from 'lucide-react';
import { toast } from 'react-hot-toast';

const HRMView = ({ searchQuery = '', initialTab = 'All' }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  
  const [newEmployee, setNewEmployee] = useState({ 
    name: '', phone: '', role: 'Driver', salary: '', status: 'Active',
    guarantor_name: '', guarantor_phone: ''
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [idDocFile, setIdDocFile] = useState(null);
  const [idDocPreview, setIdDocPreview] = useState(null);

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [newLeave, setNewLeave] = useState({ employee_id: '', leave_type: 'Sick', start_date: '', end_date: '', reason: '' });

  useEffect(() => { 
    fetchEmployees(); 
    fetchLeaveRequests();
  }, []);

  const fetchEmployees = () => {
    api.getEmployees().then(data => {
      setEmployees(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const fetchLeaveRequests = () => {
    api.getLeaveRequests().then(data => {
      setLeaveRequests(data);
    }).catch(err => console.error(err));
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.addLeaveRequest(newLeave);
      toast.success('Leave request submitted!');
      setIsLeaveModalOpen(false);
      fetchLeaveRequests();
    } catch (err) {
      toast.error('Failed to submit leave request');
    }
  };

  const handleUpdateLeaveStatus = async (id, status) => {
    try {
      await api.updateLeaveStatus(id, status);
      toast.success(`Leave request ${status.toLowerCase()}`);
      fetchLeaveRequests();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (isNaN(newEmployee.salary)) {
      toast.error('Salary must be a valid number');
      return;
    }
    try {
      if (isEditMode && selectedEmployee) {
        // For editing, we update the core details (JSON based in backend right now)
        await api.updateEmployee(selectedEmployee.id, newEmployee);
        toast.success(`${newEmployee.name} updated successfully!`);
      } else {
        const formData = new FormData();
        formData.append('name', newEmployee.name);
        formData.append('phone', newEmployee.phone);
        formData.append('role', newEmployee.role);
        formData.append('salary', newEmployee.salary);
        formData.append('guarantor_name', newEmployee.guarantor_name);
        formData.append('guarantor_phone', newEmployee.guarantor_phone);
        if (photoFile) formData.append('photo', photoFile);
        if (idDocFile) formData.append('id_document', idDocFile);

        await api.addEmployee(formData);
        toast.success(`${newEmployee.name} added to staff directory!`, { icon: '👔' });
      }
      setIsModalOpen(false);
      setIsEditMode(false);
      setNewEmployee({ name: '', phone: '', role: 'Driver', salary: '', status: 'Active', guarantor_name: '', guarantor_phone: '' });
      setPhotoFile(null); setPhotoPreview(null);
      setIdDocFile(null); setIdDocPreview(null);
      fetchEmployees();
    } catch (err) {
      toast.error(err.message || 'Failed to save employee data');
    }
  };

  const startEdit = (emp) => {
    setSelectedEmployee(emp);
    setIsEditMode(true);
    setNewEmployee({
      name: emp.name,
      phone: emp.phone,
      role: emp.role,
      salary: emp.salary,
      status: emp.status,
      guarantor_name: emp.guarantor_name || '',
      guarantor_phone: emp.guarantor_phone || ''
    });
    // For editing photos we would need a different endpoint or multipart PUT 
    // but for now we focus on the text updates requested.
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setNewEmployee({ name: '', phone: '', role: 'Driver', salary: '', status: 'Active', guarantor_name: '', guarantor_phone: '' });
    setPhotoFile(null); setPhotoPreview(null);
    setIdDocFile(null); setIdDocPreview(null);
    setIsModalOpen(true);
  };

  const handleDeleteEmployee = async (id) => {
    if (!window.confirm('Terminate this employee agreement?')) return;
    try {
      await api.deleteEmployee(id);
      toast.success('Employee record archived');
      setSelectedEmployee(null);
      fetchEmployees();
    } catch (err) {
      toast.error('Failed to delete record');
    }
  };

  const filteredEmployees = useMemo(() => {
    const search = searchQuery.toLowerCase();
    return employees.filter(e => {
      const matchesSearch = e.name?.toLowerCase().includes(search) || 
                            e.role?.toLowerCase().includes(search) || 
                            e.phone?.toLowerCase().includes(search) ||
                            (e.id && e.id.toString().includes(search));
      
      const matchesTab = activeTab === 'All' || 
                         (activeTab === 'Management' && ['Manager', 'Cashier'].includes(e.role)) ||
                         (activeTab === 'Drivers' && e.role === 'Driver') ||
                         (activeTab === 'Collectors' && e.role === 'Collector');
      
      return matchesSearch && matchesTab;
    });
  }, [employees, searchQuery, activeTab]);

  const stats = useMemo(() => {
    return {
      total: employees.length,
      management: employees.filter(e => ['Manager', 'Cashier'].includes(e.role)).length,
      drivers: employees.filter(e => e.role === 'Driver').length,
      collectors: employees.filter(e => e.role === 'Collector').length
    };
  }, [employees]);

  if (loading) return <div className="card glass">Loading staff directory...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Panel */}
      {/* Stats Summary Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#3b82f6' }}><User size={20} /></div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Staff</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{stats.total}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#f3e8ff', color: '#8b5cf6' }}><Shield size={20} /></div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Management</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{stats.management}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '4px solid #f97316' }}>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#fff7ed', color: '#f97316' }}><Truck size={20} /></div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Drivers</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{stats.drivers}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '4px solid var(--gurmad-green)' }}>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: 'var(--gurmad-green)' }}><DollarSign size={20} /></div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Collectors</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{stats.collectors}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        {/* Role Tabs */}
        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
          {['All', 'Management', 'Drivers', 'Collectors', 'Leave Requests'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{ 
                padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                backgroundColor: activeTab === tab ? 'white' : 'transparent',
                fontWeight: 600, boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                color: activeTab === tab ? '#1e293b' : '#64748b',
                transition: 'all 0.2s'
              }}
            >
              {tab}
            </button>
          ))}
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
            onClick={() => window.dispatchEvent(new CustomEvent('switchTab', { detail: 'onboard_staff' }))}
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.25rem' }}
          >
            <Plus size={18} /> Recruit Staff
          </button>
        </div>
      </div>

      {/* ====== Selected Employee Detail Modal ====== */}
      {selectedEmployee && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
          <div className="card glass" style={{ width: '520px', maxHeight: '90vh', overflowY: 'auto', animation: 'slideIn 0.3s ease-out', position: 'relative', borderTop: '4px solid #3b82f6' }}>
            <button 
              onClick={() => setSelectedEmployee(null)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <XCircle size={24} />
            </button>

            {/* Profile Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '1.5rem' }}>
               <div style={{ 
                  width: '70px', height: '70px', borderRadius: '50%', overflow: 'hidden',
                  border: '3px solid #dbeafe', backgroundColor: '#eff6ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontSize: '1.5rem', fontWeight: 700
                }}>
                  {selectedEmployee.photo 
                    ? <img src={`/api/uploads/${selectedEmployee.photo}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : selectedEmployee.name[0].toUpperCase()
                  }
               </div>
               <div>
                 <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>{selectedEmployee.name}</h2>
                 <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2px' }}>{selectedEmployee.role} — ID: #EMP-{selectedEmployee.id}</p>
               </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
               <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                 <Phone size={18} style={{ color: 'var(--text-muted)', marginTop: '2px' }} />
                 <div>
                   <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Contact Info</div>
                   <div style={{ fontWeight: 600 }}>{selectedEmployee.phone}</div>
                 </div>
               </div>

               <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                 <DollarSign size={18} style={{ color: 'var(--text-muted)', marginTop: '2px' }} />
                 <div>
                   <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Base Salary</div>
                   <div style={{ fontWeight: 700, color: 'var(--gurmad-green)' }}>${parseFloat(selectedEmployee.salary).toLocaleString()} /mo</div>
                 </div>
               </div>

               {/* Guarantor Section */}
               {selectedEmployee.guarantor_name && (
                 <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '0.25rem' }}>
                   <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                     <Shield size={14} /> Guarantor / Reference
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                     <div>
                       <div style={{ fontWeight: 600 }}>{selectedEmployee.guarantor_name}</div>
                       <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{selectedEmployee.guarantor_phone}</div>
                     </div>
                   </div>
                 </div>
               )}

               {/* ID Document */}
               {selectedEmployee.id_document && (
                 <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '0.25rem' }}>
                   <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                     <FileText size={14} /> ID Card / Passport
                   </div>
                   <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', maxHeight: '180px' }}>
                     <img src={`/api/uploads/${selectedEmployee.id_document}`} alt="ID Document" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                   </div>
                 </div>
               )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '0.5rem', gap: '10px' }}>
                  <button 
                    onClick={() => { const e = selectedEmployee; setSelectedEmployee(null); startEdit(e); }}
                    style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'white', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                  >
                    <Edit3 size={16} /> Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteEmployee(selectedEmployee.id)}
                    style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #fee2e2', backgroundColor: '#fef2f2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== Add Employee Form Modal ====== */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
          <div className="card glass" style={{ width: '560px', maxHeight: '90vh', overflowY: 'auto', animation: 'slideIn 0.3s ease-out', borderTop: '4px solid #3b82f6' }}>
            <h3 style={{ marginBottom: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isEditMode ? <Edit3 color="var(--gurmad-orange)" /> : <User color="#3b82f6" />}
              {isEditMode ? 'Modify Employee' : 'Onboard Employee'}
            </h3>
            <form onSubmit={handleAddEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Photo & ID Document Upload Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Employee Photo */}
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Employee Photo</label>
                  <label htmlFor="empPhoto" style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    width: '100%', height: '130px', borderRadius: '12px',
                    border: '2px dashed var(--border-color)', cursor: 'pointer',
                    backgroundColor: photoPreview ? 'transparent' : '#f8fafc',
                    overflow: 'hidden', position: 'relative'
                  }}>
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <>
                        <Camera size={28} style={{ color: 'var(--text-muted)', marginBottom: '6px' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click to upload</span>
                      </>
                    )}
                  </label>
                  <input type="file" id="empPhoto" accept="image/*" style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files[0];
                      if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); }
                    }}
                  />
                </div>

                {/* ID Card / Passport */}
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>ID Card / Passport</label>
                  <label htmlFor="empIdDoc" style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    width: '100%', height: '130px', borderRadius: '12px',
                    border: '2px dashed var(--border-color)', cursor: 'pointer',
                    backgroundColor: idDocPreview ? 'transparent' : '#f8fafc',
                    overflow: 'hidden', position: 'relative'
                  }}>
                    {idDocPreview ? (
                      <img src={idDocPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <>
                        <FileText size={28} style={{ color: 'var(--text-muted)', marginBottom: '6px' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click to upload</span>
                      </>
                    )}
                  </label>
                  <input type="file" id="empIdDoc" accept="image/*" style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files[0];
                      if (f) { setIdDocFile(f); setIdDocPreview(URL.createObjectURL(f)); }
                    }}
                  />
                </div>
              </div>

              {/* Name */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Full Name</label>
                <input required placeholder="e.g. Hassan Ahmed" value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
              </div>

              {/* Phone & Role */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Phone Number</label>
                  <input required placeholder="063..." value={newEmployee.phone} onChange={e => setNewEmployee({...newEmployee, phone: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Role / Title</label>
                  <select required value={newEmployee.role} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}>
                     <option>Driver</option>
                     <option>Collector</option>
                     <option>Cashier</option>
                     <option>Manager</option>
                     <option>Guard</option>
                  </select>
                </div>
              </div>

              {/* Salary */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Monthly Salary ($)</label>
                <div style={{ position: 'relative' }}>
                   <DollarSign size={16} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
                   <input required type="number" step="0.01" min="0" placeholder="250.00" value={newEmployee.salary} onChange={e => setNewEmployee({...newEmployee, salary: e.target.value})} style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
                </div>
              </div>

              {/* Guarantor Section */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <h4 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem' }}>
                  <Shield size={18} color="#3b82f6" /> Guarantor / Reference
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Guarantor Name</label>
                    <input placeholder="e.g. Abdi Ali" value={newEmployee.guarantor_name} onChange={e => setNewEmployee({...newEmployee, guarantor_name: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Guarantor Phone</label>
                    <input placeholder="063..." value={newEmployee.guarantor_phone} onChange={e => setNewEmployee({...newEmployee, guarantor_phone: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
                  </div>
                </div>
              </div>
              
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setIsModalOpen(false); setPhotoFile(null); setPhotoPreview(null); setIdDocFile(null); setIdDocPreview(null); }} style={{ padding: '0.75rem 1.5rem', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ backgroundColor: isEditMode ? 'var(--gurmad-orange)' : '#3b82f6' }}>
                  {isEditMode ? 'Update Employee' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====== Leave Requests View ====== */}
      {activeTab === 'Leave Requests' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 800 }}>Employee Leave Requests</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>Manage sick leaves, vacations, and emergency time-off</p>
            </div>
            <button onClick={() => setIsLeaveModalOpen(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} /> New Request
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>EMPLOYEE</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>LEAVE TYPE</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>DATES</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>REASON</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>STATUS</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>No leave requests found.</td></tr>
                ) : (
                  leaveRequests.map(lr => (
                    <tr key={lr.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 700 }}>{lr.employee_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lr.employee_role}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                          backgroundColor: lr.leave_type === 'Sick' ? '#fee2e2' : lr.leave_type === 'Vacation' ? '#dcfce7' : '#fef3c7',
                          color: lr.leave_type === 'Sick' ? '#ef4444' : lr.leave_type === 'Vacation' ? '#10b981' : '#f59e0b'
                        }}>
                          {lr.leave_type}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                        <div>{new Date(lr.start_date).toLocaleDateString()}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to {new Date(lr.end_date).toLocaleDateString()}</div>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.85rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lr.reason}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800,
                          backgroundColor: lr.status === 'Approved' ? '#ecfdf5' : lr.status === 'Rejected' ? '#fef2f2' : '#fffbeb',
                          color: lr.status === 'Approved' ? '#10b981' : lr.status === 'Rejected' ? '#ef4444' : '#f59e0b'
                        }}>
                          {lr.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        {lr.status === 'Pending' && (
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button onClick={() => handleUpdateLeaveStatus(lr.id, 'Approved')} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Approve</button>
                            <button onClick={() => handleUpdateLeaveStatus(lr.id, 'Rejected')} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Leave Request Modal */}
          {isLeaveModalOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
              <div className="card glass" style={{ width: '450px', borderTop: '4px solid var(--gurmad-green)' }}>
                <h3 style={{ marginBottom: '1.5rem', fontWeight: 800 }}>Submit Leave Request</h3>
                <form onSubmit={handleLeaveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Select Employee</label>
                    <select required value={newLeave.employee_id} onChange={e => setNewLeave({...newLeave, employee_id: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <option value="">-- Choose Employee --</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Leave Type</label>
                    <select required value={newLeave.leave_type} onChange={e => setNewLeave({...newLeave, leave_type: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <option>Sick</option>
                      <option>Vacation</option>
                      <option>Personal</option>
                      <option>Emergency</option>
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Start Date</label>
                      <input type="date" required value={newLeave.start_date} onChange={e => setNewLeave({...newLeave, start_date: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>End Date</label>
                      <input type="date" required value={newLeave.end_date} onChange={e => setNewLeave({...newLeave, end_date: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Reason / Explanation</label>
                    <textarea placeholder="Briefly explain the reason for leave..." value={newLeave.reason} onChange={e => setNewLeave({...newLeave, reason: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '80px', resize: 'vertical' }}></textarea>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button type="button" onClick={() => setIsLeaveModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600 }}>Cancel</button>
                    <button type="submit" className="btn-primary">Submit Request</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ====== Directory Table ====== */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>EMPLOYEE</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>ROLE</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>CONTACT</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>SALARY</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>GUARANTOR</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>STATUS</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                  <tr>
                      <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No employees found matching your criteria.
                      </td>
                  </tr>
              ) : filteredEmployees.map((e) => (
                <tr key={e.id} 
                    onClick={() => setSelectedEmployee(e)}
                    style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s', cursor: 'pointer' }}
                    onMouseEnter={(ev) => ev.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={(ev) => ev.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#eff6ff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: '#3b82f6',
                        overflow: 'hidden'
                      }}>
                        {e.photo 
                          ? <img src={`/api/uploads/${e.photo}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : (e.name ? e.name[0].toUpperCase() : 'E')
                        }
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{e.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: #EMP-{e.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 500 }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                       <Briefcase size={14} style={{ color: 'var(--text-muted)' }} /> {e.role}
                     </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 500 }}>
                      <Phone size={14} style={{ color: 'var(--text-muted)' }} /> {e.phone}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 600 }}>
                    ${parseFloat(e.salary || 0).toLocaleString()}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {e.guarantor_name ? (
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{e.guarantor_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.guarantor_phone}</div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`badge badge-${e.status?.toLowerCase() === 'active' ? 'paid' : 'unpaid'}`}>
                      {e.status || 'Active'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <button 
                      onClick={(ev) => { ev.stopPropagation(); setSelectedEmployee(e); }}
                      style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }} 
                    >
                        <MoreHorizontal size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HRMView;
