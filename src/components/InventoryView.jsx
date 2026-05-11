import React, { useState, useEffect } from 'react';
import { Package, Plus, TrendingUp, AlertCircle, CheckCircle2, Edit3, X, Trash2, BarChart3, Boxes } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

const InventoryView = ({ searchQuery = '' }) => {
  const [inventory, setInventory] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [newItem, setNewItem] = useState({
    item_name: '', quantity: '', unit: 'Pcs', price_per_unit: '', status: 'In Stock'
  });

  useEffect(() => { fetchInventory(); }, []);

  const fetchInventory = async () => {
    try {
      setIsLoading(true);
      const data = await api.getInventory();
      setInventory(data);
    } catch (err) {
      toast.error('Failed to load inventory');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusForQuantity = (qty) => {
    const q = parseInt(qty);
    if (isNaN(q) || q <= 0) return 'Out of Stock';
    if (q < 10) return 'Low Stock';
    return 'In Stock';
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      const itemToSave = { ...newItem, status: getStatusForQuantity(newItem.quantity) };
      if (isEditMode && editingItemId) {
        const data = await api.updateInventory(editingItemId, itemToSave);
        setInventory(inventory.map(item => item.id === editingItemId ? data : item));
        toast.success('Item updated successfully');
      } else {
        const data = await api.addInventory(itemToSave);
        setInventory([data, ...inventory]);
        toast.success('Item added to inventory');
      }
      setIsAddModalOpen(false);
      setIsEditMode(false);
      setEditingItemId(null);
      setNewItem({ item_name: '', quantity: '', unit: 'Pcs', price_per_unit: '', status: 'In Stock' });
    } catch (err) {
      toast.error('Failed to save item');
    }
  };

  const startEdit = (item) => {
    setEditingItemId(item.id);
    setNewItem({ item_name: item.item_name, quantity: item.quantity, unit: item.unit, price_per_unit: item.price_per_unit, status: item.status });
    setIsEditMode(true);
    setIsAddModalOpen(true);
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setEditingItemId(null);
    setNewItem({ item_name: '', quantity: '', unit: 'Pcs', price_per_unit: '', status: 'In Stock' });
    setIsAddModalOpen(true);
  };

  const handleQuickQuantity = async (item, delta) => {
    const newQty = Math.max(0, parseInt(item.quantity) + delta);
    const newStatus = getStatusForQuantity(newQty);
    try {
      const data = await api.updateInventory(item.id, { ...item, quantity: newQty, status: newStatus });
      setInventory(inventory.map(i => i.id === item.id ? data : i));
      toast.success(`${item.item_name}: ${newQty} ${item.unit}`);
    } catch (err) {
      toast.error('Failed to update quantity');
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Delete this item from inventory?')) return;
    try {
      await api.deleteInventory(id);
      setInventory(inventory.filter(i => i.id !== id));
      toast.success('Item removed');
    } catch (err) {
      toast.error('Failed to delete item');
    }
  };

  const filteredInventory = inventory.filter(item => {
    const search = searchQuery.toLowerCase();
    return item.item_name.toLowerCase().includes(search) ||
           item.status.toLowerCase().includes(search);
  });

  const getStatusConfig = (status) => {
    switch (status) {
      case 'In Stock':    return { bg: '#dcfce7', text: '#15803d', border: '#86efac', dot: '#22c55e', icon: <CheckCircle2 size={13} /> };
      case 'Low Stock':   return { bg: '#fef3c7', text: '#b45309', border: '#fcd34d', dot: '#f59e0b', icon: <AlertCircle size={13} /> };
      case 'Out of Stock':return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5', dot: '#ef4444', icon: <AlertCircle size={13} /> };
      default:            return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', dot: '#94a3b8', icon: <Package size={13} /> };
    }
  };

  const totalValue = inventory.reduce((acc, curr) => acc + (parseFloat(curr.quantity||0) * parseFloat(curr.price_per_unit||0)), 0);
  const totalUnits = inventory.reduce((acc, curr) => acc + parseInt(curr.quantity||0), 0);
  const lowStockCount = inventory.filter(i => i.status === 'Low Stock' || i.status === 'Out of Stock').length;
  const inStockCount = inventory.filter(i => i.status === 'In Stock').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* ===== STATS CARDS ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        {[
          {
            label: 'Total Stock Value',
            value: `$${totalValue.toFixed(2)}`,
            icon: <TrendingUp size={22} />,
            gradient: 'linear-gradient(135deg, #3FAE2A 0%, #2d8c1e 100%)',
            bg: 'rgba(63,174,42,0.08)',
            color: '#3FAE2A',
            sub: `${inventory.length} distinct items`
          },
          {
            label: 'Total Units',
            value: totalUnits,
            icon: <Boxes size={22} />,
            gradient: 'linear-gradient(135deg, #1e3d59 0%, #2e6b9e 100%)',
            bg: 'rgba(30,61,89,0.08)',
            color: '#1e3d59',
            sub: 'across all categories'
          },
          {
            label: 'Items In Stock',
            value: inStockCount,
            icon: <CheckCircle2 size={22} />,
            gradient: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)',
            bg: 'rgba(14,165,233,0.08)',
            color: '#0ea5e9',
            sub: 'fully stocked items'
          },
          {
            label: 'Alerts',
            value: lowStockCount,
            icon: <AlertCircle size={22} />,
            gradient: 'linear-gradient(135deg, #f07321 0%, #ef4444 100%)',
            bg: 'rgba(240,115,33,0.09)',
            color: '#f07321',
            sub: 'low / out of stock'
          },
        ].map((card, i) => (
          <div key={i} style={{
            background: 'white',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 20px rgba(0,0,0,0.04)',
            border: '1px solid #f1f5f9',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.10)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.07), 0 4px 20px rgba(0,0,0,0.04)'; }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: card.gradient, borderRadius: '16px 16px 0 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px 0' }}>{card.label}</p>
                <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1 }}>{card.value}</h3>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '6px 0 0 0' }}>{card.sub}</p>
              </div>
              <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color, flexShrink: 0 }}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ===== MAIN TABLE CARD ===== */}
      <div style={{
        background: 'white',
        borderRadius: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 20px rgba(0,0,0,0.04)',
        border: '1px solid #f1f5f9',
        overflow: 'hidden'
      }}>
        {/* Table Header */}
        <div style={{ padding: '1.5rem 1.75rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BarChart3 size={20} color="#3FAE2A" />
              Stock Register
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.83rem', margin: '3px 0 0 0' }}>{filteredInventory.length} items tracked in real-time</p>
          </div>
          <button
            onClick={openAddModal}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '0.65rem 1.3rem',
              background: 'linear-gradient(135deg, #3FAE2A, #2d8c1e)',
              color: 'white', border: 'none', borderRadius: '12px',
              fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(63,174,42,0.35)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 20px rgba(63,174,42,0.5)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 14px rgba(63,174,42,0.35)'}
          >
            <Plus size={18} /> Add Item
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                {['ITEM NAME', 'QUANTITY', 'UNIT PRICE', 'TOTAL VALUE', 'STATUS', 'ACTIONS'].map(h => (
                  <th key={h} style={{ padding: '0.9rem 1.25rem', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.6px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                    <div style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTopColor: '#3FAE2A', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
                    Loading inventory...
                  </td>
                </tr>
              ) : filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '5rem 2rem', color: '#94a3b8' }}>
                    <Package size={52} style={{ opacity: 0.15, display: 'block', margin: '0 auto 1rem' }} />
                    <p style={{ fontWeight: 600, fontSize: '1rem', color: '#64748b', margin: '0 0 6px' }}>No inventory items yet</p>
                    <p style={{ fontSize: '0.85rem', margin: 0 }}>Click "Add Item" to start tracking your stock</p>
                  </td>
                </tr>
              ) : filteredInventory.map((item, idx) => {
                const sc = getStatusConfig(item.status);
                const val = parseFloat(item.quantity||0) * parseFloat(item.price_per_unit||0);
                const isLow = item.status !== 'In Stock';
                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid #f8fafc',
                      backgroundColor: isLow ? (item.status === 'Out of Stock' ? '#fff8f8' : '#fffdf0') : 'white',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = isLow ? (item.status === 'Out of Stock' ? '#fff8f8' : '#fffdf0') : 'white'}
                  >
                    {/* Item Name */}
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '38px', height: '38px', borderRadius: '10px',
                          background: `linear-gradient(135deg, ${sc.dot}22, ${sc.dot}44)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: sc.dot, flexShrink: 0
                        }}>
                          <Package size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>{item.item_name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>SKU-{String(item.id).padStart(4, '0')}</div>
                        </div>
                      </div>
                    </td>

                    {/* Quantity with quick adjust */}
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => handleQuickQuantity(item, -1)}
                          style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontWeight: 700, color: '#64748b', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >−</button>
                        <span style={{ fontWeight: 800, fontSize: '1rem', color: isLow ? sc.text : '#0f172a', minWidth: '28px', textAlign: 'center' }}>{item.quantity}</span>
                        <button
                          onClick={() => handleQuickQuantity(item, 1)}
                          style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontWeight: 700, color: '#64748b', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >+</button>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{item.unit}</span>
                      </div>
                    </td>

                    {/* Unit Price */}
                    <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: '#475569' }}>
                      ${parseFloat(item.price_per_unit||0).toFixed(2)}
                    </td>

                    {/* Total Value */}
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <span style={{ fontWeight: 800, color: '#3FAE2A', fontSize: '0.95rem' }}>${val.toFixed(2)}</span>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '5px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700,
                        backgroundColor: sc.bg, color: sc.text,
                        border: `1px solid ${sc.border}`
                      }}>
                        {sc.icon} {item.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => startEdit(item)}
                          title="Edit"
                          style={{ width: '34px', height: '34px', borderRadius: '9px', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.style.borderColor = '#93c5fd'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          title="Delete"
                          style={{ width: '34px', height: '34px', borderRadius: '9px', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fef2f2'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== MODAL ===== */}
      {isAddModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(6px)', padding: '20px' }}
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '480px', boxShadow: '0 25px 60px rgba(0,0,0,0.2)', overflow: 'hidden', animation: 'slideUp 0.25s ease-out' }}
          >
            {/* Modal Header */}
            <div style={{ background: isEditMode ? 'linear-gradient(135deg, #f07321, #ef4444)' : 'linear-gradient(135deg, #3FAE2A, #2d8c1e)', padding: '1.5rem 1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  {isEditMode ? <Edit3 size={20} /> : <Package size={20} />}
                </div>
                <div>
                  <h3 style={{ color: 'white', fontWeight: 800, margin: 0, fontSize: '1.1rem' }}>{isEditMode ? 'Edit Inventory Item' : 'Add New Item'}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.75)', margin: 0, fontSize: '0.8rem' }}>{isEditMode ? 'Update stock details' : 'Register new stock item'}</p>
                </div>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAddItem} style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Item Name *</label>
                <input
                  type="text"
                  value={newItem.item_name}
                  onChange={e => setNewItem({ ...newItem, item_name: e.target.value })}
                  required
                  placeholder="e.g. Engine Oil, Truck Tyres..."
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#3FAE2A'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Quantity *</label>
                  <input
                    type="number"
                    value={newItem.quantity}
                    onChange={e => setNewItem({ ...newItem, quantity: e.target.value })}
                    required min="0"
                    placeholder="0"
                    style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = '#3FAE2A'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Unit</label>
                  <select
                    value={newItem.unit}
                    onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
                    style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="Pcs">Pcs (Pieces)</option>
                    <option value="Liters">Liters</option>
                    <option value="Boxes">Boxes</option>
                    <option value="Sets">Sets</option>
                    <option value="Kg">Kg</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Unit Price ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={newItem.price_per_unit}
                  onChange={e => setNewItem({ ...newItem, price_per_unit: e.target.value })}
                  required
                  placeholder="0.00"
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#3FAE2A'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              {/* Auto Status Info */}
              {newItem.quantity !== '' && (
                <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', backgroundColor: getStatusConfig(getStatusForQuantity(newItem.quantity)).bg, border: `1px solid ${getStatusConfig(getStatusForQuantity(newItem.quantity)).border}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {getStatusConfig(getStatusForQuantity(newItem.quantity)).icon}
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: getStatusConfig(getStatusForQuantity(newItem.quantity)).text }}>
                    Auto Status: {getStatusForQuantity(newItem.quantity)}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ flex: 1, padding: '0.85rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" style={{
                  flex: 2, padding: '0.85rem', borderRadius: '12px', border: 'none',
                  background: isEditMode ? 'linear-gradient(135deg, #f07321, #ef4444)' : 'linear-gradient(135deg, #3FAE2A, #2d8c1e)',
                  color: 'white', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer',
                  boxShadow: isEditMode ? '0 4px 12px rgba(240,115,33,0.35)' : '0 4px 12px rgba(63,174,42,0.35)'
                }}>
                  {isEditMode ? '✓ Update Item' : '+ Save to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default InventoryView;
