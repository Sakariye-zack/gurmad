import React, { useState, useEffect } from 'react';
import { Truck, Plus, Package2, Edit3, Trash2, FileText, ShoppingCart, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

// Phase 4: Suppliers, Assets, and the full procurement chain — Purchase Request -> Purchase
// Order -> Goods Receipt (which automatically updates Inventory and logs a Stock Movement).
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

  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [isPRModalOpen, setIsPRModalOpen] = useState(false);
  const [newPR, setNewPR] = useState({ department: '', item_name: '', quantity: '', estimated_price: '', reason: '' });

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [newPO, setNewPO] = useState({ purchase_request_id: '', supplier_id: '', item_name: '', quantity: '', unit_price: '' });

  const [stockMovements, setStockMovements] = useState([]);

  useEffect(() => {
    fetchSuppliers();
    fetchAssets();
    fetchPurchaseRequests();
    fetchPurchaseOrders();
    fetchStockMovements();
    api.getEmployees().then(setEmployees).catch(() => {});
  }, []);

  const fetchSuppliers = () => api.getSuppliers().then(setSuppliers).catch(err => console.error(err));
  const fetchAssets = () => api.getAssets().then(setAssets).catch(err => console.error(err));
  const fetchPurchaseRequests = () => api.getPurchaseRequests().then(setPurchaseRequests).catch(err => console.error(err));
  const fetchPurchaseOrders = () => api.getPurchaseOrders().then(setPurchaseOrders).catch(err => console.error(err));
  const fetchStockMovements = () => api.getStockMovements().then(setStockMovements).catch(err => console.error(err));

  const handlePRSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.addPurchaseRequest(newPR);
      toast.success('Purchase request submitted');
      setIsPRModalOpen(false);
      setNewPR({ department: '', item_name: '', quantity: '', estimated_price: '', reason: '' });
      fetchPurchaseRequests();
    } catch (err) {
      toast.error('Failed to submit purchase request');
    }
  };

  const handleUpdatePRStatus = async (id, status) => {
    try {
      await api.updatePurchaseRequestStatus(id, status);
      toast.success(`Request ${status.toLowerCase()}`);
      fetchPurchaseRequests();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handlePOSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.addPurchaseOrder(newPO);
      toast.success('Purchase order created');
      setIsPOModalOpen(false);
      setNewPO({ purchase_request_id: '', supplier_id: '', item_name: '', quantity: '', unit_price: '' });
      fetchPurchaseOrders();
    } catch (err) {
      toast.error('Failed to create purchase order');
    }
  };

  const handleReceivePO = async (id) => {
    if (!window.confirm('Mark this purchase order as received? This will add the ordered quantity into Inventory.')) return;
    try {
      await api.receivePurchaseOrder(id);
      toast.success('Received — inventory updated');
      fetchPurchaseOrders();
      fetchStockMovements();
    } catch (err) {
      toast.error(err.message || 'Failed to receive purchase order');
    }
  };

  const handleCancelPO = async (id) => {
    if (!window.confirm('Cancel this purchase order?')) return;
    try {
      await api.cancelPurchaseOrder(id);
      toast.success('Purchase order cancelled');
      fetchPurchaseOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to cancel purchase order');
    }
  };

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
        {['Suppliers', 'Assets', 'Purchase Requests', 'Purchase Orders', 'Stock Movements'].map(tab => (
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

      {activeTab === 'Purchase Requests' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 700 }}>Purchase Requests</h3>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Request an item — once approved, create a Purchase Order for it</p>
            </div>
            <button onClick={() => setIsPRModalOpen(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} /> New Request
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>ITEM</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>DEPARTMENT</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>QTY</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>EST. PRICE</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>REQUESTED BY</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>STATUS</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {purchaseRequests.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>No purchase requests found.</td></tr>
              ) : purchaseRequests.map(pr => (
                <tr key={pr.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem', fontWeight: 700 }}>{pr.item_name}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{pr.department || '—'}</td>
                  <td style={{ padding: '1rem' }}>{pr.quantity}</td>
                  <td style={{ padding: '1rem' }}>${parseFloat(pr.estimated_price || 0).toFixed(2)}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{pr.requested_by_name || '—'}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800,
                      backgroundColor: pr.status === 'Approved' ? '#ecfdf5' : pr.status === 'Rejected' ? '#fef2f2' : '#fffbeb',
                      color: pr.status === 'Approved' ? '#10b981' : pr.status === 'Rejected' ? '#ef4444' : '#f59e0b'
                    }}>{pr.status.toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    {pr.status === 'Pending' && (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => handleUpdatePRStatus(pr.id, 'Approved')} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Approve</button>
                        <button onClick={() => handleUpdatePRStatus(pr.id, 'Rejected')} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Reject</button>
                      </div>
                    )}
                    {pr.status === 'Approved' && (
                      <button onClick={() => { setNewPO({ purchase_request_id: pr.id, supplier_id: '', item_name: pr.item_name, quantity: pr.quantity, unit_price: '' }); setActiveTab('Purchase Orders'); setIsPOModalOpen(true); }} style={{ backgroundColor: '#0ea5e9', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Create PO</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'Purchase Orders' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 700 }}>Purchase Orders</h3>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Marking an order "Received" automatically adds the stock into Inventory</p>
            </div>
            <button onClick={() => setIsPOModalOpen(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} /> New Order
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>ITEM</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>SUPPLIER</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>QTY</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>TOTAL</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>STATUS</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>No purchase orders found.</td></tr>
              ) : purchaseOrders.map(po => (
                <tr key={po.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem', fontWeight: 700 }}>{po.item_name}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{po.supplier_name || 'Unspecified'}</td>
                  <td style={{ padding: '1rem' }}>{po.quantity}</td>
                  <td style={{ padding: '1rem', fontWeight: 700 }}>${parseFloat(po.total_amount || 0).toFixed(2)}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800,
                      backgroundColor: po.status === 'Received' ? '#ecfdf5' : po.status === 'Cancelled' ? '#fef2f2' : '#e0f2fe',
                      color: po.status === 'Received' ? '#10b981' : po.status === 'Cancelled' ? '#ef4444' : '#0284c7'
                    }}>{po.status.toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    {po.status === 'Ordered' && (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => handleReceivePO(po.id)} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Mark Received</button>
                        <button onClick={() => handleCancelPO(po.id)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Cancel</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'Stock Movements' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ margin: 0, fontWeight: 700 }}>Stock Movements</h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Read-only ledger of every inventory quantity change — stock in from received purchase orders, stock out issued to departments</p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>ITEM</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>TYPE</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>QTY</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>REFERENCE</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>BY</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>DATE</th>
              </tr>
            </thead>
            <tbody>
              {stockMovements.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>No stock movements found.</td></tr>
              ) : stockMovements.map(sm => (
                <tr key={sm.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem', fontWeight: 700 }}>{sm.item_name}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: sm.type === 'in' ? '#dcfce7' : '#fee2e2', color: sm.type === 'in' ? '#15803d' : '#b91c1c' }}>
                      {sm.type === 'in' ? 'STOCK IN' : 'STOCK OUT'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 700 }}>{sm.type === 'in' ? '+' : '-'}{sm.quantity}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{sm.reference || '—'}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{sm.created_by_name || '—'}</td>
                  <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>{new Date(sm.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isPRModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card glass" style={{ width: '420px', borderTop: '4px solid var(--gurmad-green)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontWeight: 800 }}>New Purchase Request</h3>
            <form onSubmit={handlePRSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Item</label>
                <input required value={newPR.item_name} onChange={e => setNewPR({...newPR, item_name: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Quantity</label>
                  <input type="number" required value={newPR.quantity} onChange={e => setNewPR({...newPR, quantity: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Est. Price ($)</label>
                  <input type="number" step="0.01" value={newPR.estimated_price} onChange={e => setNewPR({...newPR, estimated_price: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Department</label>
                <input value={newPR.department} onChange={e => setNewPR({...newPR, department: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Reason</label>
                <textarea value={newPR.reason} onChange={e => setNewPR({...newPR, reason: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '70px', resize: 'vertical' }}></textarea>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setIsPRModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600 }}>Cancel</button>
                <button type="submit" className="btn-primary">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPOModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card glass" style={{ width: '420px', borderTop: '4px solid var(--gurmad-green)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontWeight: 800 }}>New Purchase Order</h3>
            <form onSubmit={handlePOSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Item</label>
                <input required value={newPO.item_name} onChange={e => setNewPO({...newPO, item_name: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Supplier</label>
                <select value={newPO.supplier_id} onChange={e => setNewPO({...newPO, supplier_id: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <option value="">-- Unspecified --</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Quantity</label>
                  <input type="number" required value={newPO.quantity} onChange={e => setNewPO({...newPO, quantity: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Unit Price ($)</label>
                  <input type="number" step="0.01" required value={newPO.unit_price} onChange={e => setNewPO({...newPO, unit_price: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setIsPOModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600 }}>Cancel</button>
                <button type="submit" className="btn-primary">Create Order</button>
              </div>
            </form>
          </div>
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
