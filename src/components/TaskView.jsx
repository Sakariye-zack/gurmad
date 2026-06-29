import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Truck, MapPin, Plus, ChevronRight, CheckCircle2, Clock, PlayCircle, XCircle, Navigation, Users, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';

const TaskView = ({ searchQuery = '', currentUser }) => {
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [dbZones, setDbZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskCustomers, setTaskCustomers] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [modalCustomers, setModalCustomers] = useState([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [collectionModal, setCollectionModal] = useState(null);
  const [payForm, setPayForm] = useState({ isPaid: true, amount: '15.00', currency: 'USD', method: 'Cash' });
  const [newTask, setNewTask] = useState({ driver_name: '', collector_name: '', vehicle_plate: '', route_name: '', zone_id: '', truck_id: '' });
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [isNotifying, setIsNotifying] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'details'

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const safeFetch = (promise) => promise.catch(err => { console.error(err); return []; });
      const [t, e, z, c, u, tr] = await Promise.all([
        safeFetch(api.getTasks()),
        safeFetch(api.getEmployees()),
        safeFetch(api.getZones()),
        safeFetch(api.getCustomers()),
        safeFetch(api.getUsers()),
        safeFetch(api.getTrucks())
      ]);
      setTasks(t);
      setEmployees(e);
      setDbZones(z);
      setAllCustomers(c);
      setSystemUsers(u);
      setTrucks(tr);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    try {
      const task = await api.addTask({...newTask, customer_ids: selectedCustomerIds});
      toast.success(`Task assigned to ${newTask.collector_name || newTask.driver_name}!`, { icon: '🚛' });
      
      if (sendWhatsApp && selectedCustomerIds.length > 0) {
        await handleSendWhatsApp(task.id, newTask.route_name, selectedCustomerIds);
      }

      setShowAssignModal(false);
      setNewTask({ driver_name: '', collector_name: '', vehicle_plate: '', route_name: '', zone_id: '', truck_id: '' });
      setModalCustomers([]);
      setSelectedCustomerIds([]);
      loadData();
    } catch (err) {
      toast.error('Failed to assign task');
    }
  };

  const handleSendWhatsApp = async (taskId, routeName, customerIds, collectorName = null) => {
    setIsNotifying(true);
    const toastId = toast.loading('Sending WhatsApp reminders...', { icon: '💬' });
    try {
      const finalCollector = collectorName || newTask.collector_name || 'Gurmad Team';
      const message = `GURMAD: Maalmo qashinka! Maanta waa maalintii qashin ururinta ee ${routeName}. Fadlan qashinka diyaariya. Ururiyaha: ${finalCollector}.`;
      await api.sendWhatsAppNotification({ taskId, message, customerIds });
      toast.success('WhatsApp reminders sent automatically!', { id: toastId });
    } catch (err) {
      toast.error('WhatsApp service unavailable', { id: toastId });
    } finally {
      setIsNotifying(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await api.updateTaskStatus(taskId, newStatus);
      toast.success(`Task status updated to ${newStatus}`, { icon: newStatus === 'Completed' ? '✅' : '🔄' });
      await loadData();
      if (selectedTask && selectedTask.id === taskId) {
        const updatedTasks = await api.getTasks();
        const updated = updatedTasks.find(t => t.id === taskId);
        if (updated) setSelectedTask(updated);
      }
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.deleteTask(id);
      toast.success('Task deleted successfully');
      loadData();
    } catch (err) {
      toast.error('Failed to delete task');
    }
  };

  useEffect(() => {
    if (selectedTask) {
      loadTaskCustomers(selectedTask.id);
    }
  }, [selectedTask]);

  const captureGPS = async (customerId) => {
    if (!navigator.geolocation) return toast.error('Geolocation not supported');
    
    toast.loading('Capturing coordinates...', { id: 'gps' });
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        await api.updateCustomerLocation(customerId, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        toast.success('Customer location updated!', { id: 'gps' });
        if (selectedTask) loadTaskCustomers(selectedTask.id);
      } catch (err) {
        toast.error('Failed to save location', { id: 'gps' });
      }
    }, () => {
      toast.error('Location access denied', { id: 'gps' });
    });
  };

  const loadTaskCustomers = async (taskId) => {
    try {
      const customers = await api.getTaskCustomers(taskId);
      setTaskCustomers(customers);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleCustomerCollection = async (customerId, currentStatus) => {
    if (!selectedTask) return;
    if (!currentStatus) {
       const cust = taskCustomers.find(c => c.id === customerId);
       setCollectionModal(cust);
       setPayForm({ isPaid: true, amount: '15.00', currency: 'USD', method: 'Cash' });
       return;
    }
    // Unchecking
    try {
      await api.markCustomerCollected(selectedTask.id, customerId, false);
      loadTaskCustomers(selectedTask.id);
    } catch (err) {
      toast.error('Failed to update collection status');
    }
  };

  const handleCollectionSubmit = async (e) => {
    e.preventDefault();
    if (!collectionModal || !selectedTask) return;
    
    try {
      await api.addInvoice({
        phone: collectionModal.phone,
        amount: parseFloat(payForm.amount),
        currency: payForm.currency,
        method: payForm.isPaid ? payForm.method : 'Debt',
        collector_name: selectedTask.collector_name || selectedTask.driver_name
      });
      await api.markCustomerCollected(selectedTask.id, collectionModal.id, true);
      toast.success(payForm.isPaid ? 'Payment recorded & Collected!' : 'Debt recorded & Collected!', { icon: '💰' });
      setCollectionModal(null);
      loadTaskCustomers(selectedTask.id);
    } catch (err) {
      toast.error('Failed to save collection detail');
    }
  };
  // Simulated active tracking for "In Progress" tasks
  useEffect(() => {
    const activeTasks = tasks.filter(t => t.status === 'In Progress');
    if (activeTasks.length === 0) return;

    const interval = setInterval(() => {
      activeTasks.forEach(task => {
        // Simulate a small movement near Burao center
        const lat = 9.524 + (Math.random() - 0.5) * 0.01;
        const lng = 45.535 + (Math.random() - 0.5) * 0.01;
        api.pingTaskLocation(task.id, { lat, lng });
      });
    }, 10000); // Ping every 10 seconds

    return () => clearInterval(interval);
  }, [tasks]);

  const filteredTasks = tasks.filter(t => {
    const search = searchQuery.toLowerCase();
    
    // Admin sees all, collector sees only their tasks
    const isAssigned = currentUser?.role === 'collector' 
      ? (
          (t.collector_name || '').toLowerCase().trim() === (currentUser.full_name || '').toLowerCase().trim() || 
          (t.collector_name || '').toLowerCase().trim() === (currentUser.username || '').toLowerCase().trim() || 
          (t.driver_name || '').toLowerCase().trim() === (currentUser.full_name || '').toLowerCase().trim()
        )
      : true;

    return isAssigned && (
           (t.driver_name || '').toLowerCase().includes(search) ||
           (t.collector_name || '').toLowerCase().includes(search) ||
           (t.route_name || '').toLowerCase().includes(search) ||
           (t.status || '').toLowerCase().includes(search)
    );
  });

  const getStatusColor = (status) => {
    switch(status) {
      case 'Completed': return '#22c55e';
      case 'In Progress': return '#f59e0b';
      case 'Pending': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'Completed': return <CheckCircle2 size={16} />;
      case 'In Progress': return <PlayCircle size={16} />;
      case 'Pending': return <Clock size={16} />;
      default: return <Clock size={16} />;
    }
  };

  if (loading) return <div className="card glass">Loading collector tasks...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Stats + Assign */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
           <div className="card glass" style={{ padding: '0.75rem 1.25rem', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pending</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{filteredTasks.filter(t => t.status === 'Pending').length}</div>
           </div>
           <div className="card glass" style={{ padding: '0.75rem 1.25rem', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>In Progress</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{filteredTasks.filter(t => t.status === 'In Progress').length}</div>
           </div>
           <div className="card glass" style={{ padding: '0.75rem 1.25rem', borderLeft: '4px solid var(--gurmad-green)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Completed</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{filteredTasks.filter(t => t.status === 'Completed').length}</div>
           </div>
        </div>
        {currentUser?.role !== 'collector' && (
          <button 
            onClick={() => setShowAssignModal(true)}
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={18} /> Assign New Task
          </button>
        )}
      </div>

      {/* Assign Task Modal */}
      {showAssignModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
          <div className="card glass" style={{ width: '450px', animation: 'slideIn 0.3s ease-out', borderTop: '4px solid var(--gurmad-green)' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck color="var(--gurmad-green)" /> Assign Collection Task
              <span style={{ fontSize: '0.7rem', color: 'red' }}>(Debug: {employees.length} emps loaded)</span>
            </h3>
            <form onSubmit={handleAssign} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Zone / Route</label>
                <select 
                  required 
                  value={newTask.route_name} 
                  onChange={e => {
                    const selZoneName = e.target.value;
                    const selZone = dbZones.find(z => z.name === selZoneName);
                    if (selZone) {
                      setNewTask({ 
                        ...newTask, 
                        route_name: selZone.name,
                        zone_id: selZone.id,
                        truck_id: selZone.truck_id,
                        driver_name: selZone.driver_name || '',
                        collector_name: selZone.collector_name || '',
                        vehicle_plate: selZone.truck_plate || ''
                      });
                    } else {
                      setNewTask({...newTask, route_name: selZoneName, zone_id: '', truck_id: ''});
                    }

                    if (selZoneName) {
                      const matched = allCustomers.filter(c => {
                         const zName = selZoneName.toLowerCase();
                         return (c.zone && zName.includes(c.zone.toLowerCase())) || 
                                (c.area && zName.includes(c.area.toLowerCase())) ||
                                (c.zone === selZoneName || c.area === selZoneName);
                      });
                      setModalCustomers(matched);
                      setSelectedCustomerIds(matched.map(c => c.id));
                    } else {
                      setModalCustomers([]);
                      setSelectedCustomerIds([]);
                    }
                  }}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: '#f0fdf4' }}
                >
                  <option value="">— Select Zone —</option>
                  {dbZones.map(z => <option key={z.id} value={z.name}>{z.name}</option>)}
                </select>
                <p style={{ fontSize: '0.75rem', color: 'var(--gurmad-green)', marginTop: '4px' }}>Selecting a Zone auto-fills assigned team and customers.</p>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Collector Name</label>
                <select
                  required
                  value={newTask.collector_name} 
                  onChange={e => setNewTask({...newTask, collector_name: e.target.value})}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: '#fff' }}
                >
                  <option value="">— Select Collector —</option>
                  {/* Main Collector List */}
                  {employees.filter(emp => emp.role?.trim().toLowerCase() === 'collector').map(emp => (
                    <option key={emp.id} value={emp.name}>{emp.name}</option>
                  ))}
                  
                  {/* Fallback: If no collectors found, show everyone else */}
                  {employees.filter(emp => emp.role?.trim().toLowerCase() !== 'collector').length > 0 && (
                    <>
                      <option disabled>──────────</option>
                      {employees.filter(emp => emp.role?.trim().toLowerCase() !== 'collector').map(emp => (
                        <option key={`f-${emp.id}`} value={emp.name}>{emp.name} ({emp.role})</option>
                      ))}
                    </>
                  )}

                  {/* Fallback to system users if needed */}
                  {systemUsers.filter(u => u.role?.trim().toLowerCase() === 'collector').map(u => (
                    <option key={`u-${u.id}`} value={u.full_name || u.username}>{u.full_name || u.username}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                 <div>
                   <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Driver Name (Optional)</label>
                   <select
                     value={newTask.driver_name}
                     onChange={e => setNewTask({...newTask, driver_name: e.target.value})}
                     style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: '#fff' }}
                   >
                     <option value="">— Select Driver —</option>
                      {employees.filter(emp => emp.role?.trim().toLowerCase() === 'driver').map(emp => (
                        <option key={emp.id} value={emp.name}>{emp.name}</option>
                      ))}
                   </select>
                 </div>
                 <div>
                   <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Vehicle Plate (Optional)</label>
                   <select
                     value={newTask.vehicle_plate}
                     onChange={e => setNewTask({...newTask, vehicle_plate: e.target.value})}
                     style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: '#fff' }}
                   >
                     <option value="">— Select Vehicle —</option>
                     {trucks.map(truck => (
                       <option key={truck.id} value={truck.plate_number}>{truck.plate_number} ({truck.model})</option>
                     ))}
                   </select>
                  </div>
               </div>
               {modalCustomers.length > 0 && (
                 <div style={{ marginTop: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', maxHeight: '180px', overflowY: 'auto', backgroundColor: '#f8fafc' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Select Customers ({selectedCustomerIds.length}/{modalCustomers.length})</label>
                      <button type="button" onClick={() => setSelectedCustomerIds(selectedCustomerIds.length === modalCustomers.length ? [] : modalCustomers.map(c => c.id))} style={{ fontSize: '0.75rem', color: 'var(--gurmad-green)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                        {selectedCustomerIds.length === modalCustomers.length ? 'Deselect All' : 'Select All'}
                      </button>
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                     {modalCustomers.map(c => (
                       <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', cursor: 'pointer', padding: '4px' }}>
                         <input 
                           type="checkbox" 
                           checked={selectedCustomerIds.includes(c.id)}
                           onChange={(e) => {
                             if (e.target.checked) setSelectedCustomerIds([...selectedCustomerIds, c.id]);
                             else setSelectedCustomerIds(selectedCustomerIds.filter(id => id !== c.id));
                           }}
                         />
                         {c.name} <span style={{ color: 'var(--text-muted)' }}>({c.phone})</span>
                       </label>
                     ))}
                   </div>
                 </div>
               )}
                <div style={{ padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '12px', border: '1px solid #dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                     <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                        <Navigation size={20} />
                     </div>
                     <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af' }}>WhatsApp Automation</div>
                        <div style={{ fontSize: '0.75rem', color: '#60a5fa' }}>Notify {selectedCustomerIds.length} customers via AI</div>
                     </div>
                  </div>
                  <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                    <input 
                      type="checkbox" 
                      checked={sendWhatsApp}
                      onChange={(e) => setSendWhatsApp(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{ 
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                      backgroundColor: sendWhatsApp ? '#25D366' : '#cbd5e1', 
                      transition: '.4s', borderRadius: '34px' 
                    }}>
                      <span style={{ 
                        position: 'absolute', height: '18px', width: '18px', left: '3px', bottom: '3px', 
                        backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                        transform: sendWhatsApp ? 'translateX(22px)' : 'translateX(0)'
                      }}></span>
                    </span>
                  </label>
                </div>

              <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAssignModal(false)} style={{ padding: '0.75rem 1.5rem', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isNotifying}>
                  {isNotifying ? 'Sending Notifications...' : 'Assign & Notify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Detail Full Page */}
      {viewMode === 'details' && selectedTask && (
        <div style={{ animation: 'fadeIn 0.3s ease-out', maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '2.5rem' }}>
            <button 
              onClick={() => { setViewMode('list'); setSelectedTask(null); }}
              style={{ 
                width: '48px', height: '48px', borderRadius: '16px', border: '1px solid #e2e8f0', 
                backgroundColor: 'white', color: '#475569', cursor: 'pointer', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', transition: '0.2s'
              }}
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.75rem', color: '#1e293b' }}>Task Operations Center</h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem', fontWeight: 600 }}>Real-time monitoring and task execution</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth <= 1024 ? '1fr' : '1.8fr 1fr', gap: '2rem' }}>
            
            {/* Left Column: Team & Customers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
               
               {/* Team Info Card */}
               <div className="card" style={{ padding: '2rem', borderRadius: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ 
                      width: '72px', height: '72px', borderRadius: '22px', 
                      backgroundColor: 'var(--bg-secondary)', color: 'var(--gurmad-green)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)'
                    }}>
                      <Truck size={36} />
                    </div>
                    <div>
                       <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Assigned Collector</div>
                       <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e293b', margin: 0 }}>{selectedTask.collector_name || selectedTask.driver_name}</h3>
                       <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                         {selectedTask.driver_name && (
                           <span style={{ fontSize: '0.8rem', fontWeight: 800, backgroundColor: '#f1f5f9', padding: '4px 12px', borderRadius: '8px', color: '#475569' }}>Driver: {selectedTask.driver_name}</span>
                         )}
                         {selectedTask.vehicle_plate && (
                           <span style={{ fontSize: '0.8rem', fontWeight: 800, backgroundColor: '#f0fdf4', padding: '4px 12px', borderRadius: '8px', color: '#166534' }}>Plate: {selectedTask.vehicle_plate}</span>
                         )}
                       </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                     <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Zone / Route</div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b', fontWeight: 900, fontSize: '1.1rem' }}>
                        <MapPin size={20} color="#3FAE2A" /> {selectedTask.route_name}
                     </div>
                  </div>
               </div>

               {/* Customers List Card */}
               <div className="card" style={{ padding: '2rem', borderRadius: '32px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                      <Users size={24} color="#64748b" /> 
                      Route Customers
                      <span style={{ fontSize: '0.9rem', backgroundColor: '#f1f5f9', padding: '4px 12px', borderRadius: '20px', color: '#64748b', fontWeight: 700 }}>{taskCustomers.length} Total</span>
                    </h4>
                    <button 
                      onClick={() => handleSendWhatsApp(selectedTask.id, selectedTask.route_name, taskCustomers.map(c => c.id), selectedTask.collector_name)}
                      style={{ padding: '0.75rem 1.25rem', borderRadius: '14px', border: '1px solid #25D366', color: '#25D366', fontWeight: 800, backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Navigation size={18} /> Notify All
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                    {taskCustomers.length === 0 ? (
                      <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8', backgroundColor: '#f8fafc', borderRadius: '24px' }}>
                        <Users size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                        <p style={{ fontWeight: 600 }}>No customers assigned to this zone yet.</p>
                      </div>
                    ) : taskCustomers.map(c => (
                      <div key={c.id} style={{ 
                        padding: '1.5rem', backgroundColor: c.collected ? '#f0fdf4' : 'white', 
                        borderRadius: '24px', border: `2px solid ${c.collected ? '#3FAE2A' : '#f1f5f9'}`, 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.3s'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                           <div style={{ 
                             width: '48px', height: '48px', borderRadius: '14px', 
                             backgroundColor: c.collected ? '#3FAE2A' : '#f1f5f9', 
                             color: c.collected ? 'white' : '#94a3b8',
                             display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.1rem'
                           }}>
                             {c.collected ? <CheckCircle2 size={24} /> : c.name[0]}
                           </div>
                           <div>
                              <div style={{ fontWeight: 900, fontSize: '1.1rem', color: c.collected ? '#166534' : '#1e293b' }}>{c.name}</div>
                              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>House {c.house_no} • {c.neighborhood || c.area}</div>
                           </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                           {c.phone && (
                              <a 
                                href={`https://wa.me/${c.phone.replace(/\D/g,'') || c.whatsapp?.replace(/\D/g,'')}?text=${encodeURIComponent(`GURMAD: Maanta waa maalintii qashin ururinta. Fadlan qashinka diyaariya.`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ width: '44px', height: '44px', borderRadius: '14px', border: '1px solid #25D366', color: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', transition: '0.2s' }}
                              >
                                <Navigation size={20} />
                              </a>
                           )}
                           <button 
                             onClick={() => toggleCustomerCollection(c.id, c.collected)}
                             style={{ 
                               padding: '0 1.5rem', height: '44px', borderRadius: '14px', border: 'none', 
                               backgroundColor: c.collected ? '#3FAE2A' : '#64748b', color: 'white',
                               fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', transition: '0.2s',
                               display: 'flex', alignItems: 'center', gap: '10px'
                             }}
                           >
                             {c.collected ? 'Collected' : 'Collect Fee'}
                           </button>
                           <button 
                             onClick={() => captureGPS(c.id)}
                             style={{ width: '44px', height: '44px', borderRadius: '14px', border: '1px solid #e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', transition: '0.2s' }}
                           >
                             <MapPin size={20} />
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>

            {/* Right Column: Status & Control */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
               
               {/* Status Card */}
               <div className="card" style={{ padding: '2rem', borderRadius: '32px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2rem' }}>Live Task Status</div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ 
                          width: '56px', height: '56px', borderRadius: '16px', 
                          backgroundColor: getStatusColor(selectedTask.status) + '20', 
                          color: getStatusColor(selectedTask.status),
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {getStatusIcon(selectedTask.status)}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94a3b8' }}>CURRENT STATE</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 950, color: getStatusColor(selectedTask.status), textTransform: 'uppercase', letterSpacing: '1px' }}>{selectedTask.status}</div>
                        </div>
                     </div>

                     <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <span style={{ fontWeight: 800, color: '#64748b', fontSize: '0.9rem' }}>Assigned On</span>
                          <span style={{ fontWeight: 900, color: '#1e293b' }}>{new Date(selectedTask.scheduled_at).toLocaleDateString()}</span>
                        </div>
                        {selectedTask.completed_at && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 800, color: '#166534', fontSize: '0.9rem' }}>Completed At</span>
                            <span style={{ fontWeight: 900, color: '#166534' }}>{new Date(selectedTask.completed_at).toLocaleTimeString()}</span>
                          </div>
                        )}
                     </div>
                  </div>

                  <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedTask.status === 'Pending' && (
                      <button 
                        onClick={() => handleStatusChange(selectedTask.id, 'In Progress')}
                        className="btn-primary" 
                        style={{ width: '100%', padding: '1.4rem', fontSize: '1.1rem', backgroundColor: '#f59e0b', boxShadow: '0 10px 15px -3px rgba(245, 158, 11, 0.3)' }}
                      >
                        ACTIVATE TASK
                      </button>
                    )}
                    {selectedTask.status === 'In Progress' && (
                      <button 
                        onClick={() => handleStatusChange(selectedTask.id, 'Completed')}
                        className="btn-primary" 
                        style={{ width: '100%', padding: '1.4rem', fontSize: '1.1rem', boxShadow: '0 10px 15px -3px rgba(63, 174, 42, 0.3)' }}
                      >
                        FINISH & CLOSE TASK
                      </button>
                    )}
                    {currentUser?.role !== 'collector' && (
                      <button 
                        onClick={() => { if(window.confirm('Delete this task?')) { handleDeleteTask(selectedTask.id); setViewMode('list'); } }}
                        style={{ width: '100%', padding: '1.2rem', borderRadius: '20px', border: 'none', backgroundColor: '#fef2f2', color: '#ef4444', fontWeight: 900, fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s' }}
                      >
                        DELETE TASK RECORD
                      </button>
                    )}
                  </div>
               </div>

               {/* Stats Card */}
               <div className="card" style={{ padding: '2rem', borderRadius: '32px', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Collection Rate</div>
                        <div style={{ fontSize: '2rem', fontWeight: 950, color: '#1e293b' }}>
                          {taskCustomers.length > 0 ? Math.round((taskCustomers.filter(c => c.collected).length / taskCustomers.length) * 100) : 0}%
                        </div>
                     </div>
                     <div style={{ width: '60px', height: '60px' }}>
                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '8px solid #e2e8f0', borderTopColor: '#3FAE2A', transform: 'rotate(45deg)' }}></div>
                     </div>
                  </div>
               </div>

            </div>
          </div>
        </div>
      )}

      {/* Main List View (Stats + Table) */}
      {viewMode === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>

      {/* Task Cards Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>COLLECTOR</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>ZONE / ROUTE</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>DATE</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>STATUS</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No tasks assigned yet.</td></tr>
            ) : filteredTasks.map(task => (
              <tr 
                key={task.id}
                onClick={() => { setSelectedTask(task); setViewMode('details'); }}
                style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ 
                      width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gurmad-green)'
                    }}>
                      <Truck size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {task.collector_name || task.driver_name}
                        {employees.find(e => e.name === (task.collector_name || task.driver_name))?.phone && (
                           <a 
                             href={`https://wa.me/${employees.find(e => e.name === (task.collector_name || task.driver_name)).phone.replace(/\D/g,'')}`} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             onClick={(e) => e.stopPropagation()}
                             style={{ color: '#25D366', display: 'flex', alignItems: 'center' }}
                           >
                             <Navigation size={14} />
                           </a>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {task.driver_name && `Driver: ${task.driver_name}`}
                        {task.vehicle_plate && ` • ${task.vehicle_plate}`}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                    <MapPin size={14} style={{ color: 'var(--text-muted)' }} /> {task.route_name}
                  </div>
                </td>
                <td style={{ padding: '1rem', fontSize: '0.9rem', fontWeight: 500 }}>
                  {new Date(task.scheduled_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ 
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600,
                    backgroundColor: getStatusColor(task.status) + '15', color: getStatusColor(task.status)
                  }}>
                    {getStatusIcon(task.status)} {task.status}
                  </span>
                </td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                    {task.status === 'Pending' && (
                      <button onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'In Progress'); }} style={{
                        padding: '4px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                        backgroundColor: '#f59e0b', color: 'white', fontWeight: 600, fontSize: '0.8rem',
                        display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}>
                        <PlayCircle size={14} /> Start
                      </button>
                    )}
                    {task.status === 'In Progress' && (
                      <button onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'Completed'); }} style={{
                        padding: '4px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                        backgroundColor: '#22c55e', color: 'white', fontWeight: 600, fontSize: '0.8rem',
                        display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}>
                        <CheckCircle2 size={14} /> Complete
                      </button>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleSendWhatsApp(task.id, task.route_name, allCustomers.filter(c => c.zone === task.route_name).map(c => c.id), task.collector_name); }}
                      style={{
                        padding: '4px 12px', borderRadius: '6px', border: '1px solid #25D366', cursor: 'pointer',
                        backgroundColor: 'transparent', color: '#25D366', fontWeight: 600, fontSize: '0.8rem',
                        display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}
                      title="Send WhatsApp Reminders"
                    >
                      <Navigation size={14} /> Notify
                    </button>
                    {currentUser?.role !== 'collector' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                        style={{
                          padding: '4px', borderRadius: '6px', border: '1px solid #fee2e2', cursor: 'pointer',
                          backgroundColor: 'transparent', color: '#ef4444',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        title="Delete Task"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    {task.status === 'Completed' && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Done ✓</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </div>
      )}
      {collectionModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
          <div className="card glass" style={{ width: '400px', animation: 'slideIn 0.3s ease-out' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '1.5rem' }}>House: {collectionModal.name}</h3>
            <form onSubmit={handleCollectionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div style={{ display: 'flex', gap: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                  <input type="radio" checked={payForm.isPaid} onChange={() => setPayForm({...payForm, isPaid: true})} />
                  Paid Now
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                  <input type="radio" checked={!payForm.isPaid} onChange={() => setPayForm({...payForm, isPaid: false})} />
                  Did NOT Pay (Add Debt)
                </label>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Amount</label>
                <input required type="number" step="0.01" value={payForm.amount} onChange={e => setPayForm({...payForm, amount: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
              </div>

              {payForm.isPaid && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Payment Method</label>
                  <select value={payForm.method} onChange={e => setPayForm({...payForm, method: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: '#fff' }}>
                    <option value="Cash">Cash</option>
                    <option value="ZAAD">ZAAD</option>
                    <option value="eDahab">eDahab</option>
                  </select>
                </div>
              )}

              <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setCollectionModal(null)} style={{ padding: '0.75rem.5rem', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ backgroundColor: payForm.isPaid ? 'var(--gurmad-green)' : 'var(--gurmad-orange)' }}>
                  {payForm.isPaid ? 'Record Payment & Collect' : 'Record Debt & Collect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskView;
