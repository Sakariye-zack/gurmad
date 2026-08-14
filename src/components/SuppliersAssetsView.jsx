import React, { useState, useEffect } from 'react';
import { Truck, Plus, Package2, Edit3, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

// Phase 4 (first slice): Suppliers and Assets, admin-managed. Purchase Requests/Orders/Goods
// Receipts (the full procurement approval chain) are deliberately deferred — that's a multi-step
// workflow that deserves its own pass rather than being rushed in alongside this.
const SuppliersAssetsView = ({ searchQuery = '' }) => {
  const [activeTab, setActiveTab] = useState('Suppliers');

  const [suppliers, setSuppliers] = useState([]);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState(null);
  const [newSupplier, setNewSupplier] = useState({ name: '', contact: '', category: '', status: 'Active' });

  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState(null);
  const [newAsset, setNewAsset] = useState({ name: '', category: '', serial_number: '', value: '', location: '', assigned_employee_id: '', condition: 'Good', status: 'Active' });

  useEffect(() => {
    fetchSuppliers();
    fetchAssets();
    api.getEmployees().then(setEmployees).catch(() => {});
  }, []);

  const fetchSuppliers = () => api.getSuppliers().then(setSuppliers).catch(err => console.error(err));
  const fetchAssets = () => api.getAssets().then(setAssets).catch(err => console.error(err));

  const handleSupplierSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSupplierId) {
        const data = await api.updateSupplier(editingSupplierId, newSupplier);
        setSuppliers(prev => prev.map(s => s.id === editingSupplierId ? data : s));
        toast.success('Supplier updated');
      } else {
        const data = await api.addSupplier(newSupplier);
        setSuppliers(prev => [data, ...prev]);
        toast.success('Supplier added');
      }
      closeSupplierModal();
    } catch (err) {
      toast.error('Failed to save supplier');
    }
  };

  const openSupplierModal = (supplier = null) => {
    if (supplier) {
      setEditingSupplierId(supplier.id);
      setNewSupplier({ name: supplier.name, contact: supplier.contact || '', category: supplier.category || '', status: supplier.status });
    } else {
      setEditingSupplierId(null);
      setNewSupplier({ name: '', contact: '', category: '', status: 'Active' });
    }
    setIsSupplierModalOpen(true);
  };
  const closeSupplierModal = () => { setIsSupplierModalOpen(false); setEditingSupplierId(null); };

  const handleDeleteSupplier = async (id) => {
    if (!window.confirm('Delete this supplier?')) return;
    try {
      await api.deleteSupplier(id);
      setSuppliers(prev => prev.filter(s => s.id !== id));
      toast.success('Supplier removed');
    } catch (err) {
      toast.error('Failed to delete supplier');
    }
  };

  const handleAssetSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...newAsset, assigned_employee_id: newAsset.assigned_employee_id || null };
      if (editingAssetId) {
        const data = await api.updateAsset(editingAssetId, payload);
        setAssets(prev => prev.map(a => a.id === editingAssetId ? data : a));
        toast.success('Asset updated');
      } else {
        const data = await api.addAsset(payload);
        setAssets(prev => [data, ...prev]);
        toast.success('Asset added');
      }
      closeAssetModal();
    } catch (err) {
      toast.error('Failed to save asset');
    }
  };

  const openAssetModal = (asset = null) => {
    if (asset) {
      setEditingAssetId(asset.id);
      setNewAsset({
        name: asset.name, category: asset.category || '', serial_number: asset.serial_number || '',
        value: asset.value || '', location: asset.location || '', assigned_employee_id: asset.assigned_employee_id || '',
        condition: asset.condition || 'Good', status: asset.status || 'Active'
      });
    } else {
      setEditingAssetId(null);
      setNewAsset({ name: '', category: '', serial_number: '', value: '', location: '', assigned_employee_id: '', condition: 'Good', status: 'Active' });
    }
    setIsAssetModalOpen(true);
  };
  const closeAssetModal = () => { setIsAssetModalOpen(false); setEditingAssetId(null); };

  const handleDeleteAsset = async (id) => {
    if (!window.confirm('Delete this asset?')) return;
    try {
      await api.deleteAsset(id);
      setAssets(prev => prev.filter(a => a.id !== id));
      toast.success('Asset removed');
    } catch (err) {
      toast.error('Failed to delete asset');
    }
  };

  const q = searchQuery.toLowerCase();
  const filteredSuppliers = suppliers.filter(s => s.name.toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q));
  const filteredAssets = assets.filter(a => a.name.toLowerCase().includes(q) || (a.category || '').toLowerCase().includes(q));

  const statusBadge = (status) => (
    <span style={{
      padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
      backgroundColor: status === 'Active' ? '#dcfce7' : '#fee2e2',
      color: status === 'Active' ? '#15803d' : '#b91c1c'
    }}>{status}</span>
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', backgroundColor: 'var(--gurmad-green-light)', borderRadius: '12px', color: 'var(--gurmad-green)' }}>
          <Truck size={24} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Suppliers & Assets</h1>
          <p style={{ color: '#64748b', margin: 0 }}>Manage vendor relationships and company-owned equipment</p>
        </div>
      </div>

      <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '12px', width: 'fit-content', marginBottom: '1.5rem' }}>
        {['Suppliers', 'Assets'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
              backgroundColor: activeTab === tab ? 'white' : 'transparent',
              fontWeight: 600, boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              color: activeTab === tab ? '#1e293b' : '#64748b'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Suppliers' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ margin: 0, fontWeight: 700 }}>Suppliers</h3>
            <button onClick={() => openSupplierModal()} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} /> Add Supplier
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>NAME</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>CONTACT</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>CATEGORY</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>STATUS</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.length === 0 ? (
                <tr><td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>No suppliers found.</td></tr>
              ) : filteredSuppliers.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem', fontWeight: 700 }}>{s.name}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{s.contact || '—'}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{s.category || '—'}</td>
                  <td style={{ padding: '1rem' }}>{statusBadge(s.status)}</td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => openSupplierModal(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><Edit3 size={16} /></button>
                      <button onClick={() => handleDeleteSupplier(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'Assets' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ margin: 0, fontWeight: 700 }}>Assets</h3>
            <button onClick={() => openAssetModal()} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} /> Add Asset
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>NAME</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>CATEGORY</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>VALUE</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>ASSIGNED TO</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>CONDITION</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>STATUS</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>No assets found.</td></tr>
              ) : filteredAssets.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem', fontWeight: 700 }}>
                    {a.name}
                    {a.serial_number && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>SN: {a.serial_number}</div>}
                  </td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{a.category || '—'}</td>
                  <td style={{ padding: '1rem', fontWeight: 700 }}>${parseFloat(a.value || 0).toFixed(2)}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{a.assigned_employee_name || 'Unassigned'}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{a.condition}</td>
                  <td style={{ padding: '1rem' }}>{statusBadge(a.status)}</td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => openAssetModal(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><Edit3 size={16} /></button>
                      <button onClick={() => handleDeleteAsset(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isSupplierModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card glass" style={{ width: '420px', borderTop: '4px solid var(--gurmad-green)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontWeight: 800 }}>{editingSupplierId ? 'Edit' : 'Add'} Supplier</h3>
            <form onSubmit={handleSupplierSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Name</label>
                <input required value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Contact (phone/email)</label>
                <input value={newSupplier.contact} onChange={e => setNewSupplier({...newSupplier, contact: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Category</label>
                <input placeholder="e.g. Fuel, Spare Parts, Uniforms" value={newSupplier.category} onChange={e => setNewSupplier({...newSupplier, category: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Status</label>
                <select value={newSupplier.status} onChange={e => setNewSupplier({...newSupplier, status: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={closeSupplierModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600 }}>Cancel</button>
                <button type="submit" className="btn-primary">{editingSupplierId ? 'Save Changes' : 'Add Supplier'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAssetModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card glass" style={{ width: '460px', borderTop: '4px solid var(--gurmad-green)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontWeight: 800 }}>{editingAssetId ? 'Edit' : 'Add'} Asset</h3>
            <form onSubmit={handleAssetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Name</label>
                <input required value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Category</label>
                  <input placeholder="e.g. Equipment, Container" value={newAsset.category} onChange={e => setNewAsset({...newAsset, category: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Serial Number</label>
                  <input value={newAsset.serial_number} onChange={e => setNewAsset({...newAsset, serial_number: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Value ($)</label>
                  <input type="number" step="0.01" value={newAsset.value} onChange={e => setNewAsset({...newAsset, value: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Location</label>
                  <input value={newAsset.location} onChange={e => setNewAsset({...newAsset, location: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Assigned To</label>
                <select value={newAsset.assigned_employee_id} onChange={e => setNewAsset({...newAsset, assigned_employee_id: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <option value="">-- Unassigned --</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Condition</label>
                  <select value={newAsset.condition} onChange={e => setNewAsset({...newAsset, condition: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <option>Good</option>
                    <option>Fair</option>
                    <option>Needs Repair</option>
                    <option>Lost/Damaged</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Status</label>
                  <select value={newAsset.status} onChange={e => setNewAsset({...newAsset, status: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={closeAssetModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600 }}>Cancel</button>
                <button type="submit" className="btn-primary">{editingAssetId ? 'Save Changes' : 'Add Asset'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersAssetsView;
