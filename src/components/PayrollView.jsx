import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Users, 
  Calendar, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Download, 
  Plus, 
  Filter, 
  RefreshCw,
  Edit3,
  CreditCard,
  Save,
  X
} from 'lucide-react';
import { api } from '../api';
import toast from 'react-hot-toast';

const PayrollView = () => {
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [payrollData, setPayrollData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editForm, setEditForm] = useState({
    bonuses: 0,
    deductions: 0,
    status: 'Pending',
    notes: '',
    payment_method: 'Cash'
  });

  const fetchPayroll = async () => {
    setLoading(true);
    try {
      const data = await api.getPayroll(month);
      setPayrollData(data);
    } catch (err) {
      toast.error('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, [month]);

  const handleGenerate = async () => {
    if (!window.confirm(`Generate payroll for ${month}? This will load base salaries for all active employees.`)) return;
    setLoading(true);
    try {
      await api.generatePayroll(month);
      toast.success('Payroll generated successfully');
      fetchPayroll();
    } catch (err) {
      toast.error('Failed to generate payroll');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (entry) => {
    setSelectedEntry(entry);
    setEditForm({
      bonuses: entry.bonuses,
      deductions: entry.deductions,
      status: entry.status,
      notes: entry.notes || '',
      payment_method: entry.payment_method || 'Cash'
    });
    setIsModalOpen(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.updatePayroll(selectedEntry.id, editForm);
      toast.success('Payroll updated');
      setIsModalOpen(false);
      fetchPayroll();
    } catch (err) {
      toast.error('Update failed');
    }
  };

  const handlePrint = (p) => {
    const printWindow = window.open('', '_blank');
    const html = `
      <html>
        <head>
          <title>Payslip - ${p.employee_name}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; }
            .header { text-align: center; border-bottom: 2px solid #3FAE2A; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: 800; color: #3FAE2A; }
            .payslip-title { font-size: 18px; color: #64748b; margin-top: 5px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
            .info-item { border: 1px solid #e2e8f0; padding: 15px; borderRadius: 10px; }
            .label { font-size: 12px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
            .value { font-size: 16px; font-weight: 700; margin-top: 5px; }
            .table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            .table th { background: #f8fafc; text-align: left; padding: 12px; border-bottom: 2px solid #e2e8f0; font-size: 12px; }
            .table td { padding: 12px; border-bottom: 1px solid #f1f5f9; }
            .total-row { background: #f0fdf4; font-weight: 800; font-size: 18px; }
            .footer { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .signature { border-top: 1px solid #cbd5e1; padding-top: 10px; text-align: center; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">GURMAD WASTE MANAGEMENT</div>
            <div class="payslip-title">Official Employee Payslip - ${p.month}</div>
          </div>
          
          <div class="info-grid">
            <div class="info-item">
              <div class="label">Employee Name</div>
              <div class="value">${p.employee_name}</div>
            </div>
            <div class="info-item">
              <div class="label">Job Position</div>
              <div class="value">${p.employee_role}</div>
            </div>
            <div class="info-item">
              <div class="label">Phone Number</div>
              <div class="value">${p.employee_phone}</div>
            </div>
            <div class="info-item">
              <div class="label">Payment Date</div>
              <div class="value">${new Date().toLocaleDateString()}</div>
            </div>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: right">Amount ($)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Base Salary</td>
                <td style="text-align: right">$${parseFloat(p.base_salary).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Bonuses / Allowances</td>
                <td style="text-align: right; color: #10b981;">+$${parseFloat(p.bonuses).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Deductions / Fines</td>
                <td style="text-align: right; color: #ef4444;">-$${parseFloat(p.deductions).toFixed(2)}</td>
              </tr>
              <tr class="total-row">
                <td>NET SALARY PAYABLE</td>
                <td style="text-align: right; color: #3FAE2A;">$${parseFloat(p.net_salary).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-bottom: 20px;">
            <div class="label">Payment Status:</div>
            <div class="value" style="color: ${p.status === 'Paid' ? '#10b981' : '#f59e0b'}">${p.status.toUpperCase()}</div>
          </div>

          <div class="footer">
            <div class="signature">Employee Signature</div>
            <div class="signature">Authorized Officer</div>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const totals = payrollData.reduce((acc, curr) => {
    acc.total += parseFloat(curr.net_salary);
    if (curr.status === 'Paid') acc.paid += parseFloat(curr.net_salary);
    else acc.pending += parseFloat(curr.net_salary);
    return acc;
  }, { total: 0, paid: 0, pending: 0 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '12px', color: '#1e293b' }}>
            <DollarSign size={28} color="var(--gurmad-green)" /> Payroll Management
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Monthly salary processing & management</p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="card glass" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.5rem 1rem', borderRadius: '12px' }}>
            <Calendar size={18} color="var(--text-muted)" />
            <input 
              type="month" 
              value={month} 
              onChange={(e) => setMonth(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontWeight: 700, outline: 'none', color: '#1e293b' }}
            />
          </div>
          <button onClick={handleGenerate} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.8rem 1.5rem', borderRadius: '12px' }}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Generate Payroll
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <div className="card" style={{ borderBottom: '4px solid var(--gurmad-green)', background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Payroll</span>
            <TrendingUp size={20} color="var(--gurmad-green)" />
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b' }}>${totals.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>For the month of {month}</p>
        </div>

        <div className="card" style={{ borderBottom: '4px solid #3b82f6', background: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Already Paid</span>
            <CheckCircle size={20} color="#3b82f6" />
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b' }}>${totals.paid.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          <p style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: 600, marginTop: '8px' }}>{payrollData.filter(p => p.status === 'Paid').length} Employees</p>
        </div>

        <div className="card" style={{ borderBottom: '4px solid #f59e0b', background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Pending Amount</span>
            <Clock size={20} color="#f59e0b" />
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b' }}>${totals.pending.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          <p style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600, marginTop: '8px' }}>{payrollData.filter(p => p.status !== 'Paid').length} Pending Payments</p>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="card" style={{ padding: 0, borderRadius: '24px', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontWeight: 800, color: '#1e293b', margin: 0 }}>Employee Salaries List</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#f8fafc', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>
              <tr>
                <th style={{ padding: '1.2rem 1.5rem' }}>Employee</th>
                <th style={{ padding: '1.2rem 1.5rem' }}>Base Salary</th>
                <th style={{ padding: '1.2rem 1.5rem' }}>Bonus / Ded.</th>
                <th style={{ padding: '1.2rem 1.5rem' }}>Net Salary</th>
                <th style={{ padding: '1.2rem 1.5rem' }}>Status</th>
                <th style={{ padding: '1.2rem 1.5rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payrollData.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <AlertCircle size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <p>No payroll records found for {month}. Click "Generate Payroll" to load salaries.</p>
                  </td>
                </tr>
              ) : (
                payrollData.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1.2rem 1.5rem' }}>
                      <div style={{ fontWeight: 700, color: '#1e293b' }}>{p.employee_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p.employee_role} • {p.employee_phone}</div>
                    </td>
                    <td style={{ padding: '1.2rem 1.5rem', fontWeight: 600 }}>${parseFloat(p.base_salary).toLocaleString()}</td>
                    <td style={{ padding: '1.2rem 1.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {parseFloat(p.bonuses) > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--gurmad-green)', fontWeight: 700 }}>+{parseFloat(p.bonuses)} Bonus</span>}
                        {parseFloat(p.deductions) > 0 && <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700 }}>-{parseFloat(p.deductions)} Fine</span>}
                        {parseFloat(p.bonuses) == 0 && parseFloat(p.deductions) == 0 && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>-</span>}
                      </div>
                    </td>
                    <td style={{ padding: '1.2rem 1.5rem' }}>
                      <div style={{ fontWeight: 800, color: 'var(--gurmad-green)', fontSize: '1.1rem' }}>
                        ${parseFloat(p.net_salary).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </div>
                    </td>
                    <td style={{ padding: '1.2rem 1.5rem' }}>
                      <span style={{ 
                        padding: '6px 12px', 
                        borderRadius: '20px', 
                        fontSize: '0.75rem', 
                        fontWeight: 700,
                        backgroundColor: p.status === 'Paid' ? '#ecfdf5' : '#fffbeb',
                        color: p.status === 'Paid' ? '#10b981' : '#f59e0b',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        {p.status === 'Paid' ? <CheckCircle size={12} /> : <Clock size={12} />}
                        {p.status.toUpperCase()}
                      </span>
                      {p.needs_review && (
                        <div
                          title={p.notes || 'Attendance for this month is incomplete - review before paying'}
                          style={{
                            marginTop: '6px',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            backgroundColor: '#fef2f2',
                            color: '#ef4444',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <AlertCircle size={12} /> Needs Review ({p.total_days_present}d)
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1.2rem 1.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => handlePrint(p)}
                          style={{ color: '#3b82f6', background: '#eff6ff', padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}
                          title="Print Payslip"
                        >
                          <Download size={18} />
                        </button>
                        <button 
                          onClick={() => openEditModal(p)}
                          style={{ color: '#64748b', background: '#f1f5f9', padding: '8px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Edit3 size={16} /> Process
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem', borderRadius: '24px', animation: 'scaleUp 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: '1.5rem', color: '#1e293b', margin: 0 }}>Process Salary</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{selectedEntry.employee_name} ({selectedEntry.month})</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: '#f1f5f9', padding: '8px', borderRadius: '50%', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', display: 'block' }}>BONUS ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={editForm.bonuses} 
                    onChange={e => setEditForm({...editForm, bonuses: e.target.value})}
                    style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontWeight: 700, color: 'var(--gurmad-green)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', display: 'block' }}>DEDUCTIONS / FINES ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={editForm.deductions} 
                    onChange={e => setEditForm({...editForm, deductions: e.target.value})}
                    style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontWeight: 700, color: '#ef4444' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', display: 'block' }}>PAYMENT METHOD</label>
                <select 
                  value={editForm.payment_method} 
                  onChange={e => setEditForm({...editForm, payment_method: e.target.value})}
                  style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '2px solid #e2e8f0', backgroundColor: 'white', fontWeight: 600 }}
                >
                  <option value="Cash">Cash</option>
                  <option value="ZAAD">ZAAD</option>
                  <option value="eDahab">eDahab</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', display: 'block' }}>STATUS</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    type="button"
                    onClick={() => setEditForm({...editForm, status: 'Pending'})}
                    style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: 'pointer', backgroundColor: editForm.status === 'Pending' ? '#fffbeb' : '#f8fafc', color: editForm.status === 'Pending' ? '#f59e0b' : '#94a3b8', border: editForm.status === 'Pending' ? '2px solid #f59e0b' : '2px solid transparent' }}
                  >
                    Pending
                  </button>
                  <button 
                    type="button"
                    onClick={() => setEditForm({...editForm, status: 'Paid'})}
                    style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: 'pointer', backgroundColor: editForm.status === 'Paid' ? '#ecfdf5' : '#f8fafc', color: editForm.status === 'Paid' ? '#10b981' : '#94a3b8', border: editForm.status === 'Paid' ? '2px solid #10b981' : '2px solid transparent' }}
                  >
                    Paid
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', display: 'block' }}>NOTES</label>
                <textarea 
                  value={editForm.notes} 
                  onChange={e => setEditForm({...editForm, notes: e.target.value})}
                  placeholder="Reason for bonus or deduction..."
                  style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '2px solid #e2e8f0', minHeight: '80px', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: 'none', fontWeight: 700, background: '#f1f5f9', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 2, padding: '1rem', borderRadius: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <Save size={18} /> Save & Process
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleUp { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default PayrollView;
