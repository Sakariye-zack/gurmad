import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, Save, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

// Super Admin-only page: create custom roles and toggle any role's permissions, without a
// developer — the data model backing this (roles/permissions/role_permissions) is additive and
// does not change how any existing route enforces access (see server/index.js checkRole calls).
const RolesView = () => {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [checkedPerms, setCheckedPerms] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newRoleLabel, setNewRoleLabel] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [rolesData, permsData] = await Promise.all([
        api.getRoles(),
        api.getPermissions()
      ]);
      setRoles(rolesData);
      setPermissions(permsData);
      if (rolesData.length > 0) selectRole(rolesData[0]);
    } catch (err) {
      toast.error('Failed to load roles');
    } finally {
      setIsLoading(false);
    }
  };

  const selectRole = (role) => {
    setSelectedRoleId(role.id);
    setCheckedPerms(new Set(role.permissions));
  };

  const togglePerm = (key) => {
    setCheckedPerms(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleModule = (mod, modPerms, allChecked) => {
    setCheckedPerms(prev => {
      const next = new Set(prev);
      modPerms.forEach(p => {
        const key = `${p.module}.${p.action}`;
        if (allChecked) next.delete(key);
        else next.add(key);
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedRoleId) return;
    setIsSaving(true);
    try {
      await api.updateRolePermissions(selectedRoleId, [...checkedPerms]);
      toast.success('Permissions saved');
      setRoles(prev => prev.map(r => r.id === selectedRoleId ? { ...r, permissions: [...checkedPerms] } : r));
    } catch (err) {
      toast.error(err.message || 'Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newRoleLabel.trim()) return;
    try {
      const role = await api.createRole(newRoleLabel.trim());
      setRoles(prev => [...prev, role]);
      setNewRoleLabel('');
      setShowCreate(false);
      selectRole(role);
      toast.success(`Role "${role.label}" created — set its permissions and save`);
    } catch (err) {
      toast.error(err.message || 'Failed to create role');
    }
  };

  const handleDelete = async (role) => {
    if (role.is_system) return;
    if (!window.confirm(`Delete the role "${role.label}"? This cannot be undone.`)) return;
    try {
      await api.deleteRole(role.id);
      setRoles(prev => prev.filter(r => r.id !== role.id));
      if (selectedRoleId === role.id) {
        const remaining = roles.filter(r => r.id !== role.id);
        if (remaining.length > 0) selectRole(remaining[0]);
        else setSelectedRoleId(null);
      }
      toast.success('Role deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete role');
    }
  };

  const modules = [...new Set(permissions.map(p => p.module))];
  const selectedRole = roles.find(r => r.id === selectedRoleId);

  if (isLoading) return <div className="card glass">Loading roles...</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', backgroundColor: 'var(--gurmad-green-light)', borderRadius: '12px', color: 'var(--gurmad-green)' }}>
          <Shield size={24} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Roles & Permissions</h1>
          <p style={{ color: '#64748b', margin: 0 }}>Create roles and control exactly what each one can see and do</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Roles list */}
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {roles.map(role => (
              <div
                key={role.id}
                onClick={() => selectRole(role)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
                  backgroundColor: selectedRoleId === role.id ? 'var(--gurmad-green-light)' : 'transparent',
                  color: selectedRoleId === role.id ? 'var(--gurmad-green)' : '#334155',
                  fontWeight: selectedRoleId === role.id ? 700 : 500
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {role.is_system && <Lock size={13} color="#94a3b8" />}
                  {role.label}
                </span>
                {!role.is_system && (
                  <Trash2
                    size={15}
                    color="#ef4444"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); handleDelete(role); }}
                  />
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowCreate(v => !v)}
            className="btn-secondary"
            style={{ width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px' }}
          >
            <Plus size={16} /> Create New Role
          </button>
          {showCreate && (
            <form onSubmit={handleCreate} style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                autoFocus
                value={newRoleLabel}
                onChange={e => setNewRoleLabel(e.target.value)}
                placeholder="e.g. Fleet Supervisor"
                className="card"
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
              <button type="submit" className="btn-primary" style={{ padding: '10px' }}>Create</button>
            </form>
          )}
        </div>

        {/* Permission grid */}
        <div className="card" style={{ padding: '1.5rem' }}>
          {!selectedRole ? (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>Select a role to edit its permissions</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontWeight: 700 }}>{selectedRole.label}</h3>
                <button onClick={handleSave} disabled={isSaving} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px' }}>
                  <Save size={16} /> {isSaving ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {modules.map(mod => {
                  const modPerms = permissions.filter(p => p.module === mod);
                  const allChecked = modPerms.every(p => checkedPerms.has(`${p.module}.${p.action}`));
                  return (
                    <div key={mod} style={{ border: '1px solid #f1f5f9', borderRadius: '12px', padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <input type="checkbox" checked={allChecked} onChange={() => toggleModule(mod, modPerms, allChecked)} />
                        <span style={{ fontWeight: 700, textTransform: 'capitalize', color: '#1e293b' }}>{mod}</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', paddingLeft: '24px' }}>
                        {modPerms.map(p => {
                          const key = `${p.module}.${p.action}`;
                          return (
                            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#475569', cursor: 'pointer' }}>
                              <input type="checkbox" checked={checkedPerms.has(key)} onChange={() => togglePerm(key)} />
                              {p.action}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RolesView;
