import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  File, 
  Image as ImageIcon, 
  Download, 
  Trash2, 
  Upload, 
  Search, 
  Plus, 
  Filter,
  MoreVertical,
  X,
  FileBadge
} from 'lucide-react';
import { api } from '../api';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';

const ArchiveView = ({ searchQuery = '' }) => {
  const { t } = useLanguage();
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  
  // Form State
  const [title, setTitle] = useState('');
  const [docId, setDocId] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Auth context from localStorage (simplified)
  const user = JSON.parse(localStorage.getItem('gurmadUser') || '{}');

  const categories = ['All', 'Contracts', 'Letters', 'IDs', 'Invoices', 'Reports', 'General'];

  useEffect(() => {
    fetchArchives();
  }, []);

  const fetchArchives = async () => {
    try {
      setLoading(true);
      const data = await api.getArchives();
      setArchives(data);
    } catch (err) {
      toast.error(t('loading_error') || 'Cillad ayaa dhacday');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !title) {
      toast.error('Fadlan horta dhameystir macluumaadka');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('doc_ref', docId);
    formData.append('description', description);
    formData.append('category', category);
    formData.append('file', file);
    formData.append('uploaded_by', user.full_name || user.username);

    try {
      setIsUploading(true);
      await api.uploadArchive(formData);
      toast.success(t('uploaded'));
      setShowUploadModal(false);
      setTitle('');
      setDocId('');
      setDescription('');
      setFile(null);
      fetchArchives();
    } catch (err) {
      toast.error(t('upload_error') || 'Cillad ayaa dhacday');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (user.role !== 'admin') {
      toast.error('Ma haysato awood aad ku tirtirto');
      return;
    }

    if (!window.confirm('Ma huba weeye in aad tirtirto document-gan?')) return;

    try {
      await api.deleteArchive(id);
      toast.success(t('deleted'));
      fetchArchives();
    } catch (err) {
      toast.error('Wuu ku fashilmay tirtirista');
    }
  };

  const getFileIcon = (type) => {
    if (type?.includes('pdf')) return <FileText color="#ef4444" size={32} />;
    if (type?.includes('image')) return <ImageIcon color="#3b82f6" size={32} />;
    return <File color="#94a3b8" size={32} />;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredArchives = archives.filter(doc => {
    const matchesSearch = 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      doc.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.doc_ref && doc.doc_ref.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = activeCategory === 'All' || doc.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading && archives.length === 0) {
    return <div className="card glass">{t('loading_stats')}</div>;
  }

  return (
    <div className="archive-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header & Categories */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                fontSize: '0.85rem',
                fontWeight: 600,
                backgroundColor: activeCategory === cat ? 'var(--gurmad-green)' : 'white',
                color: activeCategory === cat ? 'white' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {t(cat.toLowerCase() === 'all' ? 'all' : cat.toLowerCase())}
            </button>
          ))}
        </div>
        
        <button 
          onClick={() => setShowUploadModal(true)}
          className="btn-primary" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.25rem', borderRadius: '12px' }}
        >
          <Plus size={18} />
          {t('save_document')}
        </button>
      </div>

      {/* Stats Mini Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
         <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', backgroundColor: '#f0fdf4', borderRadius: '12px', color: 'var(--gurmad-green)' }}>
               <FileBadge size={20} />
            </div>
            <div>
               <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('total_documents')}</div>
               <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{archives.length}</div>
            </div>
         </div>
         <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', backgroundColor: '#eff6ff', borderRadius: '12px', color: '#3b82f6' }}>
               <ImageIcon size={20} />
            </div>
            <div>
               <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('images')}</div>
               <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{archives.filter(a => a.file_type?.includes('image')).length}</div>
            </div>
         </div>
         <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', backgroundColor: '#fef2f2', borderRadius: '12px', color: '#ef4444' }}>
               <FileText size={20} />
            </div>
            <div>
               <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('pdfs')}</div>
               <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{archives.filter(a => a.file_type?.includes('pdf')).length}</div>
            </div>
         </div>
      </div>

      {/* Archives Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {filteredArchives.length > 0 ? filteredArchives.map(doc => (
          <div key={doc.id} className="card doc-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', transition: 'all 0.3s ease', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: '16px' }}>
                   {getFileIcon(doc.file_type)}
                </div>
                <div>
                   {doc.doc_ref && (
                     <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>
                       ID: {doc.doc_ref}
                     </div>
                   )}
                   <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1.15rem', color: '#1e293b' }}>{doc.title}</h4>
                   <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gurmad-green)', backgroundColor: '#f0fdf4', padding: '3px 10px', borderRadius: '12px', display: 'inline-block', marginTop: '6px' }}>
                      {doc.category}
                   </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <a href={`/uploads/${doc.file_name}`} download target="_blank" rel="noreferrer" style={{ padding: '6px', color: 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer' }} title="Download">
                  <Download size={18} />
                </a>
                {user.role === 'admin' && (
                  <button onClick={() => handleDelete(doc.id)} style={{ padding: '6px', color: '#ef4444', borderRadius: '8px', border: 'none', background: 'none' }} title="Delete">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #f1f5f9', marginTop: 'auto' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <Plus size={12} />
                  {doc.uploaded_by || 'Unknown'}
               </div>
               <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {new Date(doc.created_at).toLocaleDateString()} • {formatSize(doc.file_size)}
               </div>
            </div>
          </div>
        )) : (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', backgroundColor: '#f8fafc', borderRadius: '24px', border: '2px dashed var(--border-color)' }}>
             <File size={48} color="var(--border-color)" style={{ marginBottom: '1rem' }} />
             <h3 style={{ color: 'var(--text-muted)' }}>{t('no_documents')}</h3>
             <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t('start_adding')}</p>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
           <div className="card" style={{ maxWidth: '600px', width: '95%', padding: '2.5rem', borderRadius: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                 <h3 style={{ fontWeight: 800, margin: 0 }}>{t('upload_new')}</h3>
                 <button onClick={() => setShowUploadModal(false)} style={{ border: 'none', background: 'none', color: 'var(--text-muted)' }}><X /></button>
              </div>

              <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                       <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>{t('doc_title')}</label>
                       <input 
                         type="text" 
                         placeholder="Tusaale: Heshiiska Shaqaalaha" 
                         value={title}
                         onChange={(e) => setTitle(e.target.value)}
                         style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}
                         required
                       />
                    </div>
                    <div className="input-group">
                       <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>{t('doc_id')}</label>
                       <input 
                         type="text" 
                         placeholder="Tusaale: GUR-2024-001" 
                         value={docId}
                         onChange={(e) => setDocId(e.target.value)}
                         style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}
                       />
                    </div>
                 </div>

                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                       <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>{t('category')}</label>
                       <select 
                         value={category}
                         onChange={(e) => setCategory(e.target.value)}
                         style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}
                       >
                         {categories.slice(1).map(c => <option key={c} value={c}>{t(c.toLowerCase() === 'invoices' ? 'invoices_doc' : (c.toLowerCase() === 'reports' ? 'reports_doc' : c.toLowerCase()))}</option>)}
                       </select>
                    </div>
                    <div className="input-group">
                       <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>{t('description_label')}</label>
                       <input 
                         type="text" 
                         placeholder="..." 
                         value={description}
                         onChange={(e) => setDescription(e.target.value)}
                         style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}
                       />
                    </div>
                 </div>

                 <div className="input-group">
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>{t('select_file')}</label>
                    <div style={{ 
                      border: '2px dashed var(--border-color)', 
                      padding: '2rem', 
                      borderRadius: '16px', 
                      textAlign: 'center',
                      backgroundColor: '#f8fafc',
                      cursor: 'pointer'
                    }} onClick={() => document.getElementById('file-upload').click()}>
                       <Upload size={32} color="var(--border-color)" style={{ marginBottom: '0.5rem' }} />
                       <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{file ? file.name : 'Click to select or drag file'}</div>
                       <input 
                        id="file-upload"
                        type="file" 
                        onChange={(e) => setFile(e.target.files[0])}
                        style={{ display: 'none' }}
                        accept=".pdf,.png,.jpg,.jpeg"
                       />
                    </div>
                 </div>

                 <button 
                  type="submit" 
                  disabled={isUploading} 
                  className="btn-primary" 
                  style={{ padding: '1rem', borderRadius: '14px', fontSize: '1rem', fontWeight: 700 }}
                 >
                    {isUploading ? t('saving') : t('save')}
                 </button>
              </form>
           </div>
        </div>
      )}

      <style>{`
        .doc-card:hover { 
          transform: translateY(-5px); 
          box-shadow: var(--shadow-lg);
          border-color: var(--gurmad-green) !important;
        }
      `}</style>
    </div>
  );
};

export default ArchiveView;
