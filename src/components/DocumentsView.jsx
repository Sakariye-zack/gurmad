import React, { useState, useEffect } from 'react';
import { FileText, Plus, Upload, Download, Trash2, CheckCircle2, Clock, PenTool, Archive, History, AlertTriangle, Search, ScrollText } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

// Document & Financial Documents module: one generic categorized/versioned document record
// (see server/index.js migration comment) covering the proposal's Invoices/Receipts/Contracts/
// Licenses/etc. page-types. Workflow: Draft -> Pending Review -> Approved -> Pending Signature ->
// Signed -> Archived. "Sign" is a recorded attestation, not a real e-signature — see module note.
const CATEGORIES = ['Customer', 'Employee', 'Supplier', 'Fleet', 'Company'];
const DOC_TYPES_BY_CATEGORY = {
  Customer: ['Customer Contract', 'Service Agreement', 'Invoice', 'Receipt', 'Payment Proof', 'Complaint Document'],
  Employee: ['Employment Contract', 'ID/Document', 'Salary Agreement', 'Leave Document', 'Warning Letter', 'Training Certificate'],
  Supplier: ['Supplier Agreement', 'Purchase Order', 'Quotation', 'Supplier Invoice', 'Delivery Note', 'Payment Proof'],
  Fleet: ['Truck Registration', 'Insurance', 'Inspection', 'Maintenance Document', 'Fuel Document'],
  Company: ['Business License', 'Government Document', 'Lease Agreement', 'Partnership Agreement', 'Policy', 'Official Letter'],
};
const STATUS_FLOW = ['Draft', 'Pending Review', 'Approved', 'Pending Signature', 'Signed', 'Archived'];

const statusColor = (status) => ({
  'Draft': { bg: '#f1f5f9', fg: '#475569' },
  'Pending Review': { bg: '#fffbeb', fg: '#b45309' },
  'Approved': { bg: '#dbeafe', fg: '#1d4ed8' },
  'Pending Signature': { bg: '#fef3c7', fg: '#92400e' },
  'Signed': { bg: '#dcfce7', fg: '#15803d' },
  'Archived': { bg: '#f1f5f9', fg: '#94a3b8' },
}[status] || { bg: '#f1f5f9', fg: '#475569' });

const DocumentsView = ({ searchQuery = '' }) => {
  const [documents, setDocuments] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeView, setActiveView] = useState('documents'); // 'documents' | 'audit'
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [localSearch, setLocalSearch] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDoc, setNewDoc] = useState({ title: '', category: 'Customer', document_type: '', related_id: '', expiry_date: '' });
  const [newDocFile, setNewDocFile] = useState(null);

  const [signModalDoc, setSignModalDoc] = useState(null);
  const [signerName, setSignerName] = useState('');

  const [versionsModalDoc, setVersionsModalDoc] = useState(null);
  const [versions, setVersions] = useState([]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [docs, exp, custs, emps, supps, trks, audit] = await Promise.all([
        api.getDocuments(),
        api.getExpiringDocuments(),
        api.getCustomers(),
        api.getEmployees(),
        api.getSuppliers(),
        api.getTrucks(),
        api.getAuditLogs({ search: 'documents' }).catch(() => []),
      ]);
      setDocuments(docs);
      setExpiring(exp);
      setCustomers(custs);
      setEmployees(emps);
      setSuppliers(supps);
      setTrucks(trks);
      setAuditLogs((audit.logs || audit || []).filter(a => a.entity_type === 'documents'));
    } catch (err) {
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const relatedOptions = () => {
    if (newDoc.category === 'Customer') return customers.map(c => ({ id: c.id, label: c.name }));
    if (newDoc.category === 'Employee') return employees.map(e => ({ id: e.id, label: e.name }));
    if (newDoc.category === 'Supplier') return suppliers.map(s => ({ id: s.id, label: s.name }));
    if (newDoc.category === 'Fleet') return trucks.map(t => ({ id: t.id, label: t.plate_number }));
    return [];
  };

  const relatedFieldKey = () => ({
    Customer: 'related_customer_id', Employee: 'related_employee_id',
    Supplier: 'related_supplier_id', Fleet: 'related_truck_id',
  }[newDoc.category]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('title', newDoc.title);
      formData.append('category', newDoc.category);
      formData.append('document_type', newDoc.document_type);
      if (newDoc.related_id && relatedFieldKey()) formData.append(relatedFieldKey(), newDoc.related_id);
      if (newDoc.expiry_date) formData.append('expiry_date', newDoc.expiry_date);
      if (newDocFile) formData.append('file', newDocFile);
      await api.addDocument(formData);
      toast.success('Document created');
      setIsAddModalOpen(false);
      setNewDoc({ title: '', category: 'Customer', document_type: '', related_id: '', expiry_date: '' });
      setNewDocFile(null);
      fetchAll();
    } catch (err) {
      toast.error(err.message || 'Failed to create document');
    }
  };

  const advanceStatus = async (doc) => {
    const idx = STATUS_FLOW.indexOf(doc.status);
    const next = STATUS_FLOW[idx + 1];
    if (!next) return;
    if (next === 'Signed') { setSignModalDoc(doc); return; }
    try {
      await api.updateDocumentStatus(doc.id, next);
      toast.success(`Moved to ${next}`);
      fetchAll();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleSignSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.signDocument(signModalDoc.id, signerName);
      toast.success('Document marked as signed');
      setSignModalDoc(null);
      setSignerName('');
      fetchAll();
    } catch (err) {
      toast.error('Failed to sign document');
    }
  };

  const handleArchive = async (doc) => {
    try {
      await api.updateDocumentStatus(doc.id, 'Archived');
      toast.success('Document archived');
      fetchAll();
    } catch (err) {
      toast.error('Failed to archive');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document permanently?')) return;
    try {
      await api.deleteDocument(id);
      toast.success('Document deleted');
      fetchAll();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const openVersions = async (doc) => {
    setVersionsModalDoc(doc);
    try {
      const v = await api.getDocumentVersions(doc.id);
      setVersions(v);
    } catch (err) {
      setVersions([]);
    }
  };

  const relatedName = (d) => d.customer_name || d.employee_name || d.supplier_name || d.truck_plate || '—';

  const q = (localSearch || searchQuery).toLowerCase();
  const filtered = documents.filter(d =>
    (categoryFilter === 'All' || d.category === categoryFilter) &&
    (statusFilter === 'All' || d.status === statusFilter) &&
    (d.title.toLowerCase().includes(q) || (d.document_type || '').toLowerCase().includes(q))
  );

  if (isLoading) return <div className="card glass" style={{ margin: '2rem' }}>Loading documents...</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '1rem', backgroundColor: 'var(--gurmad-green-light)', borderRadius: '12px', color: 'var(--gurmad-green)' }}>
          <FileText size={24} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Documents</h1>
          <p style={{ color: '#64748b', margin: 0 }}>Contracts, invoices, licenses, receipts, and every company document in one place</p>
        </div>
      </div>

      {expiring.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '1rem', borderRadius: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', marginBottom: '1.2rem' }}>
          <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.85rem', color: '#991b1b' }}>
            <strong>{expiring.length} document(s)</strong> expiring within 30 days (or already expired): {expiring.map(d => d.title).join(', ')}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '12px', width: 'fit-content', marginBottom: '1.5rem' }}>
        {[{ id: 'documents', label: 'Documents', icon: FileText }, { id: 'audit', label: 'Audit Log', icon: ScrollText }].map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1.1rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
            backgroundColor: activeView === v.id ? 'white' : 'transparent',
            fontWeight: 700, boxShadow: activeView === v.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', color: activeView === v.id ? '#1e293b' : '#64748b'
          }}>
            <v.icon size={15} /> {v.label}
          </button>
        ))}
      </div>

      {activeView === 'documents' ? (
        <>
          <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', marginBottom: '1.2rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input value={localSearch} onChange={e => setLocalSearch(e.target.value)} placeholder="Search documents..." style={{ width: '100%', padding: '0.65rem 0.9rem 0.65rem 2.2rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }} />
            </div>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <option value="All">All Statuses</option>
              {STATUS_FLOW.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => setIsAddModalOpen(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
              <Plus size={18} /> Add Document
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>TITLE</th>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>CATEGORY / TYPE</th>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>RELATED TO</th>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>EXPIRY</th>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>VERSION</th>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>STATUS</th>
                    <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>No documents found.</td></tr>
                  ) : filtered.map(d => {
                    const sc = statusColor(d.status);
                    const isExpired = d.expiry_date && new Date(d.expiry_date) <= new Date();
                    return (
                      <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '1rem', fontWeight: 700 }}>
                          {d.title}
                          {d.file_path && (
                            <a href={`/api/uploads/${d.file_path}`} target="_blank" rel="noreferrer" style={{ marginLeft: '8px', color: '#3b82f6' }} title="Download">
                              <Download size={13} style={{ display: 'inline' }} />
                            </a>
                          )}
                        </td>
                        <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>{d.category}{d.document_type ? ` — ${d.document_type}` : ''}</td>
                        <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>{relatedName(d)}</td>
                        <td style={{ padding: '1rem', fontSize: '0.85rem', color: isExpired ? '#ef4444' : '#64748b', fontWeight: isExpired ? 700 : 400 }}>
                          {d.expiry_date ? new Date(d.expiry_date).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <button onClick={() => openVersions(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0ea5e9', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <History size={13} /> v{d.version}
                          </button>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 800, backgroundColor: sc.bg, color: sc.fg }}>{d.status.toUpperCase()}</span>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            {d.status !== 'Archived' && d.status !== 'Signed' && (
                              <button onClick={() => advanceStatus(d)} title={`Advance to ${STATUS_FLOW[STATUS_FLOW.indexOf(d.status) + 1]}`} style={{ padding: '6px 10px', borderRadius: '8px', border: 'none', background: '#3FAE2A', color: 'white', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                                {d.status === 'Pending Signature' ? <PenTool size={13} /> : <CheckCircle2 size={13} />}
                              </button>
                            )}
                            {d.status === 'Signed' && (
                              <button onClick={() => handleArchive(d)} title="Archive" style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer' }}>
                                <Archive size={13} />
                              </button>
                            )}
                            <button onClick={() => handleDelete(d.id)} title="Delete" style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #fecaca', background: 'white', color: '#ef4444', cursor: 'pointer' }}>
                              <Trash2 size={13} />
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
        </>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ margin: 0, fontWeight: 700 }}>Document Audit Log</h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Who created, edited, approved, signed, or deleted each document</p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>ACTION</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>DOCUMENT ID</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>BY</th>
                <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>DATE</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr><td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>No document activity logged yet.</td></tr>
              ) : auditLogs.map((a, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem', fontWeight: 700 }}>{a.action}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>#{a.entity_id}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{a.full_name || a.username || 'System'}</td>
                  <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Document Modal */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card glass" style={{ width: '460px', maxHeight: '90vh', overflowY: 'auto', borderTop: '4px solid var(--gurmad-green)' }}>
            <h3 style={{ marginBottom: '1.3rem', fontWeight: 800 }}>Add Document</h3>
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Title</label>
                <input required value={newDoc.title} onChange={e => setNewDoc({...newDoc, title: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Category</label>
                  <select value={newDoc.category} onChange={e => setNewDoc({...newDoc, category: e.target.value, document_type: '', related_id: ''})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Document Type</label>
                  <input list="doc-types" value={newDoc.document_type} onChange={e => setNewDoc({...newDoc, document_type: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }} />
                  <datalist id="doc-types">
                    {(DOC_TYPES_BY_CATEGORY[newDoc.category] || []).map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
              </div>
              {relatedOptions().length > 0 && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Related {newDoc.category}</label>
                  <select value={newDoc.related_id} onChange={e => setNewDoc({...newDoc, related_id: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <option value="">-- None --</option>
                    {relatedOptions().map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Expiry Date (optional)</label>
                <input type="date" value={newDoc.expiry_date} onChange={e => setNewDoc({...newDoc, expiry_date: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>File (PDF, Word, or image)</label>
                <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={e => setNewDocFile(e.target.files[0])} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600 }}>Cancel</button>
                <button type="submit" className="btn-primary">Create Document</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sign Modal */}
      {signModalDoc && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card glass" style={{ width: '400px', borderTop: '4px solid var(--gurmad-green)' }}>
            <h3 style={{ marginBottom: '0.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PenTool size={20} color="var(--gurmad-green)" /> Mark as Signed
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1.2rem' }}>
              This records that "{signModalDoc.title}" was signed — it's an attestation, not a legally-binding e-signature.
            </p>
            <form onSubmit={handleSignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Signed by (name)</label>
                <input required value={signerName} onChange={e => setSignerName(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setSignModalDoc(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600 }}>Cancel</button>
                <button type="submit" className="btn-primary">Confirm Signed</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Versions Modal */}
      {versionsModalDoc && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={() => setVersionsModalDoc(null)}>
          <div className="card glass" style={{ width: '420px', borderTop: '4px solid #0ea5e9' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem', fontWeight: 800 }}>Version History — {versionsModalDoc.title}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {versions.map(v => (
                <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', backgroundColor: v.id === versionsModalDoc.id ? '#f0fdf4' : '#f8fafc' }}>
                  <span style={{ fontWeight: 700 }}>v{v.version} {v.id === versionsModalDoc.id && '(current view)'}</span>
                  <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{v.status} — {new Date(v.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setVersionsModalDoc(null)} className="btn-secondary" style={{ width: '100%', marginTop: '1.2rem', padding: '0.65rem' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsView;
