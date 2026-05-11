import React, { useState } from 'react';
import { api } from '../api';
import { User, Phone, DollarSign, Camera, FileText, Shield, Save, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const OnboardEmployeeView = () => {
  const [newEmployee, setNewEmployee] = useState({ 
    name: '', phone: '', role: 'Driver', salary: '', status: 'Active',
    guarantor_name: '', guarantor_phone: ''
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [idDocFile, setIdDocFile] = useState(null);
  const [idDocPreview, setIdDocPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (isNaN(newEmployee.salary)) {
      toast.error('Salary must be a valid number');
      return;
    }

    setIsSubmitting(true);
    try {
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
      
      // Reset form
      setNewEmployee({ name: '', phone: '', role: 'Driver', salary: '', status: 'Active', guarantor_name: '', guarantor_phone: '' });
      setPhotoFile(null); setPhotoPreview(null);
      setIdDocFile(null); setIdDocPreview(null);
    } catch (err) {
      toast.error(err.message || 'Failed to save employee data');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="card glass" style={{ borderTop: '4px solid #3b82f6', padding: '2rem' }}>
        <h3 style={{ marginBottom: '2rem', fontWeight: 800, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <User size={28} color="#3b82f6" />
          Onboard New Employee
        </h3>
        
        <form onSubmit={handleAddEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Photo & ID Document Upload Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Employee Photo */}
            <div>
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', fontWeight: 600 }}>Employee Photo</label>
              <label htmlFor="empPhoto" style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: '180px', borderRadius: '16px',
                border: '2px dashed var(--border-color)', cursor: 'pointer',
                backgroundColor: photoPreview ? 'transparent' : '#f8fafc',
                transition: 'all 0.2s',
                overflow: 'hidden', position: 'relative'
              }}>
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <>
                    <Camera size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Click to upload photo</span>
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
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', fontWeight: 600 }}>ID Card / Passport</label>
              <label htmlFor="empIdDoc" style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: '180px', borderRadius: '16px',
                border: '2px dashed var(--border-color)', cursor: 'pointer',
                backgroundColor: idDocPreview ? 'transparent' : '#f8fafc',
                transition: 'all 0.2s',
                overflow: 'hidden', position: 'relative'
              }}>
                {idDocPreview ? (
                  <img src={idDocPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <>
                    <FileText size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Click to upload ID/Passport</span>
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
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Full Name</label>
            <input 
              required 
              placeholder="e.g. Hassan Ahmed" 
              value={newEmployee.name} 
              onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} 
              style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '1rem' }} 
            />
          </div>

          {/* Phone & Role */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Phone Number</label>
              <input 
                required 
                placeholder="063..." 
                value={newEmployee.phone} 
                onChange={e => setNewEmployee({...newEmployee, phone: e.target.value})} 
                style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '1rem' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Role / Title</label>
              <select 
                required 
                value={newEmployee.role} 
                onChange={e => setNewEmployee({...newEmployee, role: e.target.value})} 
                style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '1rem', backgroundColor: 'white' }}
              >
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
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Monthly Salary ($)</label>
            <div style={{ position: 'relative' }}>
               <DollarSign size={20} style={{ position: 'absolute', top: '14px', left: '14px', color: 'var(--text-muted)' }} />
               <input 
                required 
                type="number" 
                step="0.01" 
                min="0" 
                placeholder="250.00" 
                value={newEmployee.salary} 
                onChange={e => setNewEmployee({...newEmployee, salary: e.target.value})} 
                style={{ width: '100%', padding: '0.9rem 0.9rem 0.9rem 2.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '1rem' }} 
              />
            </div>
          </div>

          {/* Guarantor Section */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '2rem', marginTop: '1rem' }}>
            <h4 style={{ fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: '#1e293b' }}>
              <Shield size={22} color="#3b82f6" /> Guarantor / Reference Information
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Guarantor Name</label>
                <input 
                  placeholder="e.g. Abdi Ali" 
                  value={newEmployee.guarantor_name} 
                  onChange={e => setNewEmployee({...newEmployee, guarantor_name: e.target.value})} 
                  style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '1rem' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Guarantor Phone</label>
                <input 
                  placeholder="063..." 
                  value={newEmployee.guarantor_phone} 
                  onChange={e => setNewEmployee({...newEmployee, guarantor_phone: e.target.value})} 
                  style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '1rem' }} 
                />
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
            <button 
              type="button" 
              onClick={() => {
                setNewEmployee({ name: '', phone: '', role: 'Driver', salary: '', status: 'Active', guarantor_name: '', guarantor_phone: '' });
                setPhotoFile(null); setPhotoPreview(null);
                setIdDocFile(null); setIdDocPreview(null);
              }}
              style={{ padding: '0.9rem 2rem', fontWeight: 700, color: 'var(--text-muted)', background: '#f1f5f9', borderRadius: '12px', border: 'none', cursor: 'pointer' }}
            >
              Clear Form
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="btn-primary" 
              style={{ 
                padding: '0.9rem 2.5rem', 
                backgroundColor: '#3b82f6', 
                fontSize: '1rem', 
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <Save size={20} />
              {isSubmitting ? 'Saving...' : 'Save Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OnboardEmployeeView;
