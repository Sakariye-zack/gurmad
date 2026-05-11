import React, { useState, useEffect, useRef } from 'react';
import { 
  Globe, 
  Settings, 
  Save, 
  RefreshCcw, 
  Plus, 
  Trash2, 
  Edit2, 
  Link, 
  Layout, 
  FileText, 
  Phone, 
  Mail, 
  MapPin,
  ArrowRight,
  Truck,
  Shield,
  BarChart,
  CheckCircle2,
  Users,
  Activity,
  Image as ImageIcon,
  Upload,
  Share2,
  ExternalLink,
  Play,
  MessageSquare
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../api';

const LandingManagementView = () => {
  const [activeTab, setActiveTab] = useState('hero');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  // Content State
  const [content, setContent] = useState({
    landing_hero_title: '',
    landing_hero_subtitle: '',
    landing_hero_image: '',
    landing_about_text: '',
    landing_about_image: '',
    landing_contact_email: '',
    landing_contact_phone: '',
    landing_contact_address: '',
    landing_services: '[]',
    landing_navbar_links: '[]',
    landing_social_links: '[]',
    landing_news: '[]'
  });

  // Parsed JSON States
  const [services, setServices] = useState([]);
  const [navbarLinks, setNavbarLinks] = useState([]);
  const [socialLinks, setSocialLinks] = useState([]);
  const [newsItems, setNewsItems] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setContent(prev => ({
        ...prev,
        ...data
      }));
      
      // Parse JSON fields
      try {
        setServices(data.landing_services ? JSON.parse(data.landing_services) : []);
      } catch (e) { setServices([]); }
      
      try {
        setNavbarLinks(data.landing_navbar_links ? JSON.parse(data.landing_navbar_links) : [
          { label: 'Home', target: 'home', type: 'scroll' },
          { label: 'Services', target: 'services', type: 'scroll' },
          { label: 'News', target: 'news', type: 'scroll' },
          { label: 'About Us', target: 'about', type: 'scroll' },
          { label: 'Contact', target: 'contact', type: 'scroll' }
        ]);
      } catch (e) { setNavbarLinks([]); }

      try {
        setSocialLinks(data.landing_social_links ? JSON.parse(data.landing_social_links) : [
          { platform: 'Facebook', url: '', icon: 'Share2' },
          { platform: 'WhatsApp', url: '', icon: 'MessageSquare' }
        ]);
      } catch (e) { setSocialLinks([]); }

      try {
        const parsedNews = data.landing_news ? JSON.parse(data.landing_news) : [];
        // Migration: ensure every item has images array and videoUrl
        const migratedNews = parsedNews.map(item => ({
          ...item,
          images: item.images || (item.image ? [item.image] : []),
          coverImage: item.coverImage || item.image || '',
          videoUrl: item.videoUrl || ''
        }));
        setNewsItems(migratedNews);
      } catch (e) { setNewsItems([]); }

    } catch (error) {
      toast.error('Failed to load landing settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (customContent = null) => {
    setIsUpdating(true);
    
    // Always sync the latest JSON states before saving if no customContent provided
    let contentToSave = customContent || {
      ...content,
      landing_services: JSON.stringify(services),
      landing_navbar_links: JSON.stringify(navbarLinks),
      landing_social_links: JSON.stringify(socialLinks),
      landing_news: JSON.stringify(newsItems)
    };

    try {
      await api.updateSettings(contentToSave);
      // Update local content state to match what was saved
      setContent(contentToSave);
      toast.success('Landing page updated successfully!');
    } catch (error) {
      toast.error('Failed to save changes');
    } finally {
      setIsUpdating(false);
    }
  };

  const updateJSONAndSave = async (key, data) => {
    // This now just triggers handleSave which syncs everything
    await handleSave();
  };

  // --- Image Upload ---
  const handleImageUpload = async (e, type = 'hero', index = null) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    setIsUploading(true);
    try {
      const result = await api.generalUpload(formData);
      if (result.success) {
        if (type === 'hero') {
          const newContent = { ...content, landing_hero_image: result.filename };
          setContent(newContent);
          await handleSave(newContent);
          toast.success('Hero image updated!');
        } else if (type === 'about') {
          const newContent = { ...content, landing_about_image: result.filename };
          setContent(newContent);
          await handleSave(newContent);
          toast.success('About section image updated!');
        } else if (type === 'news' && index !== null) {
          const newNews = [...newsItems];
          if (!newNews[index].images) newNews[index].images = [];
          newNews[index].images.push(result.filename);
          // Auto-set as cover if it's the first image
          if (!newNews[index].coverImage) {
            newNews[index].coverImage = result.filename;
          }
          setNewsItems(newNews);
          await updateJSONAndSave('landing_news', newNews);
          toast.success('Sawir cusub ayaa lagu daray!');
        }
      } else {
        toast.error('Upload failed');
      }
    } catch (error) {
      toast.error('Error uploading image');
    } finally {
      setIsUploading(false);
    }
  };

  // --- Services Management ---
  const addService = () => {
    const newServices = [...services, { icon: 'Truck', title: 'New Service', desc: 'Description here...' }];
    setServices(newServices);
    updateJSONAndSave('landing_services', newServices);
  };

  const updateService = (index, field, value) => {
    const newServices = [...services];
    newServices[index][field] = value;
    setServices(newServices);
  };

  const deleteService = (index) => {
    const newServices = services.filter((_, i) => i !== index);
    setServices(newServices);
    updateJSONAndSave('landing_services', newServices);
  };

  // --- Navbar Links Management ---
  const addNavbarLink = () => {
    const newLinks = [...navbarLinks, { label: 'New Link', target: '#', type: 'link' }];
    setNavbarLinks(newLinks);
    updateJSONAndSave('landing_navbar_links', newLinks);
  };

  const updateNavbarLink = (index, field, value) => {
    const newLinks = [...navbarLinks];
    newLinks[index][field] = value;
    setNavbarLinks(newLinks);
  };

  const deleteNavbarLink = (index) => {
    const newLinks = navbarLinks.filter((_, i) => i !== index);
    setNavbarLinks(newLinks);
    updateJSONAndSave('landing_navbar_links', newLinks);
  };

  // --- Social Links Management ---
  const addSocialLink = () => {
    const newLinks = [...socialLinks, { platform: 'Facebook', url: '', icon: 'Share2' }];
    setSocialLinks(newLinks);
    updateJSONAndSave('landing_social_links', newLinks);
  };

  const updateSocialLink = (index, field, value) => {
    const newLinks = [...socialLinks];
    newLinks[index][field] = value;
    setSocialLinks(newLinks);
  };

  const deleteSocialLink = (index) => {
    const newLinks = socialLinks.filter((_, i) => i !== index);
    setSocialLinks(newLinks);
    updateJSONAndSave('landing_social_links', newLinks);
  };

  // --- News Management ---
  const addNewsItem = () => {
    const newItem = {
      id: Date.now(),
      title: 'Cinwaan Cusub',
      date: new Date().toISOString().split('T')[0],
      excerpt: 'Summary kooban halkan ku qor...',
      content: 'Warka oo buuxa halkan ku qor...',
      images: [],
      coverImage: '',
      videoUrl: ''
    };
    const newNews = [newItem, ...newsItems];
    setNewsItems(newNews);
    updateJSONAndSave('landing_news', newNews);
  };

  const updateNewsItem = (index, field, value) => {
    const newNews = [...newsItems];
    newNews[index][field] = value;
    setNewsItems(newNews);
  };

  const deleteNewsItem = (index) => {
    if (!window.confirm('Hubaal ma tahay inaad tirtirto warkan?')) return;
    const newNews = newsItems.filter((_, i) => i !== index);
    setNewsItems(newNews);
    updateJSONAndSave('landing_news', newNews);
  };

  const removeNewsImage = (newsIndex, imageIndex) => {
    const newNews = [...newsItems];
    const removedImage = newNews[newsIndex].images[imageIndex];
    newNews[newsIndex].images = newNews[newsIndex].images.filter((_, i) => i !== imageIndex);
    
    // If we removed the cover image, set a new one or clear it
    if (newNews[newsIndex].coverImage === removedImage) {
      newNews[newsIndex].coverImage = newNews[newsIndex].images[0] || '';
    }
    
    setNewsItems(newNews);
    updateJSONAndSave('landing_news', newNews);
  };

  const setAsCover = (newsIndex, imageUrl) => {
    const newNews = [...newsItems];
    newNews[newsIndex].coverImage = imageUrl;
    setNewsItems(newNews);
    updateJSONAndSave('landing_news', newNews);
    toast.success('Cover image updated!');
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) return <div className="card glass">Loading landing page management...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '2rem' }}>
      {/* Side Tabs */}
      <div className="card glass" style={{ 
        height: 'fit-content', 
        padding: '0.5rem', 
        display: 'flex', 
        flexDirection: isMobile ? 'row' : 'column', 
        gap: '4px',
        overflowX: isMobile ? 'auto' : 'visible',
        whiteSpace: 'nowrap',
        width: isMobile ? '100%' : '250px',
        flexShrink: 0
      }}>
        {[
          { id: 'hero', label: 'Hero', icon: Layout },
          { id: 'about', label: 'About', icon: FileText },
          { id: 'services', label: 'Services', icon: Truck },
          { id: 'news', label: 'News', icon: FileText },
          { id: 'nav', label: 'Links', icon: Link },
          { id: 'social', label: 'Social', icon: Share2 },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              width: isMobile ? 'auto' : '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: activeTab === tab.id ? 'var(--gurmad-green)' : 'var(--text-muted)',
              backgroundColor: activeTab === tab.id ? '#dcfce7' : 'transparent',
              transition: 'all 0.2s',
              textAlign: 'left',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, minWidth: 0 }}>
        {/* --- HERO SECTION --- */}
        {activeTab === 'hero' && (
          <div className="card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
             <div>
              <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layout color="var(--gurmad-green)" /> Hero Branding
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>HERO MAIN TITLE</label>
                  <input 
                    type="text" 
                    value={content.landing_hero_title}
                    onChange={e => setContent({...content, landing_hero_title: e.target.value})}
                    className="card" style={{ width: '100%', padding: '0.85rem', border: '1px solid var(--border-color)' }}
                    placeholder="e.g. Clean Cities, Stronger Communities"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>HERO SUBTITLE / DESCRIPTION</label>
                  <textarea 
                    rows={4}
                    value={content.landing_hero_subtitle}
                    onChange={e => setContent({...content, landing_hero_subtitle: e.target.value})}
                    className="card" style={{ width: '100%', padding: '0.85rem', border: '1px solid var(--border-color)', resize: 'vertical' }}
                    placeholder="Describe your primary service value..."
                  />
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
              <h4 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ImageIcon size={20} color="var(--gurmad-green)" /> Hero Background Image
              </h4>
              <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                <div style={{ width: '240px', height: '150px', borderRadius: '12px', backgroundColor: '#f1f5f9', overflow: 'hidden', border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {content.landing_hero_image ? (
                    <img src={`/uploads/${content.landing_hero_image}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Hero" />
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      <ImageIcon size={32} style={{ opacity: 0.3 }} />
                      <p style={{ fontSize: '0.75rem', margin: '8px 0 0 0' }}>No image selected</p>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Upload a high-quality landscape image (Recommended: 1920x1080px). This will be the main background for your website's hero section.
                  </p>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                    accept="image/*"
                  />
                  <button 
                    onClick={() => fileInputRef.current.click()}
                    disabled={isUploading}
                    className="btn-secondary" 
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    {isUploading ? <RefreshCcw size={18} className="spin" /> : <Upload size={18} />}
                    {content.landing_hero_image ? 'Change Image' : 'Upload Image'}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <button onClick={() => handleSave()} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isUpdating ? <RefreshCcw size={18} className="spin" /> : <Save size={18} />}
                Save Hero Section
              </button>
            </div>
          </div>
        )}

        {/* --- ABOUT & CONTACT --- */}
        {activeTab === 'about' && (
          <div className="card animate-fade-in">
             <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText color="var(--gurmad-green)" /> About & Contact Information
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>ABOUT US TEXT</label>
                <textarea 
                  rows={6}
                  value={content.landing_about_text}
                  onChange={e => setContent({...content, landing_about_text: e.target.value})}
                  className="card" style={{ width: '100%', padding: '0.85rem', border: '1px solid var(--border-color)', resize: 'vertical' }}
                  placeholder="Describe your company mission and values..."
                />
              </div>

              {/* About Us Image Upload */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', backgroundColor: '#f8fafc' }}>
                <h4 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                  <ImageIcon size={18} color="var(--gurmad-green)" /> Mission & Values Section Image
                </h4>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ width: '200px', height: '140px', borderRadius: '12px', backgroundColor: '#fff', overflow: 'hidden', border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
                    {content.landing_about_image ? (
                      <img src={`/uploads/${content.landing_about_image}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="About Mission" />
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        <ImageIcon size={32} style={{ opacity: 0.3 }} />
                        <p style={{ fontSize: '0.7rem', margin: '5px 0 0 0' }}>No image</p>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: '250px' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      This image appears next to the "Our Mission & Value" text on the landing page. Use a high-quality professional image.
                    </p>
                    <input 
                      type="file" 
                      id="aboutImageUpload"
                      onChange={(e) => handleImageUpload(e, 'about')}
                      style={{ display: 'none' }}
                      accept="image/*"
                    />
                    <button 
                      onClick={() => document.getElementById('aboutImageUpload').click()}
                      disabled={isUploading}
                      className="btn-secondary" 
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      {isUploading ? <RefreshCcw size={18} className="spin" /> : <Upload size={18} />}
                      {content.landing_about_image ? 'Change Mission Image' : 'Upload Mission Image'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}><Mail size={14} /> CONTACT EMAIL</label>
                  <input 
                    type="email" 
                    value={content.landing_contact_email}
                    onChange={e => setContent({...content, landing_contact_email: e.target.value})}
                    className="card" style={{ width: '100%', padding: '0.85rem', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}><Phone size={14} /> CONTACT PHONE</label>
                  <input 
                    type="text" 
                    value={content.landing_contact_phone}
                    onChange={e => setContent({...content, landing_contact_phone: e.target.value})}
                    className="card" style={{ width: '100%', padding: '0.85rem', border: '1px solid var(--border-color)' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}><MapPin size={14} /> OFFICE ADDRESS</label>
                <input 
                  type="text" 
                  value={content.landing_contact_address}
                  onChange={e => setContent({...content, landing_contact_address: e.target.value})}
                  className="card" style={{ width: '100%', padding: '0.85rem', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => handleSave()} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Save size={18} /> Update Info
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- SERVICES LIST --- */}
        {activeTab === 'services' && (
          <div className="card animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck color="var(--gurmad-green)" /> Services Offered
              </h3>
              <button onClick={addService} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem' }}>
                <Plus size={16} /> Add Service
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              {services.map((service, index) => (
                <div key={index} className="card glass" style={{ padding: '1.5rem', position: 'relative' }}>
                  <button 
                    onClick={() => deleteService(index)}
                    style={{ position: 'absolute', top: '15px', right: '15px', color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}
                  >
                    <Trash2 size={18} />
                  </button>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>ICON</label>
                      <select 
                        value={service.icon} 
                        onChange={(e) => updateService(index, 'icon', e.target.value)}
                        className="card" style={{ width: '100%', padding: '0.5rem' }}
                      >
                        <option value="Truck">Truck</option>
                        <option value="Shield">Shield</option>
                        <option value="BarChart">BarChart</option>
                        <option value="Activity">Activity</option>
                        <option value="Users">Users</option>
                        <option value="MapPin">MapPin</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>TITLE</label>
                      <input 
                        type="text" 
                        value={service.title} 
                        onChange={(e) => updateService(index, 'title', e.target.value)}
                        className="card" style={{ width: '100%', padding: '0.5rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>DESCRIPTION</label>
                      <input 
                        type="text" 
                        value={service.desc} 
                        onChange={(e) => updateService(index, 'desc', e.target.value)}
                        className="card" style={{ width: '100%', padding: '0.5rem' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {services.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button onClick={() => updateJSONAndSave('landing_services', services)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Save size={18} /> Save All Services
                </button>
              </div>
            )}
          </div>
        )}

        {/* --- NAVBAR LINKS --- */}
        {activeTab === 'nav' && (
          <div className="card animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link color="var(--gurmad-green)" /> Website Navigation Links
              </h3>
              <button onClick={addNavbarLink} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem' }}>
                <Plus size={16} /> Add Link
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {navbarLinks.map((link, index) => (
                <div key={index} className="card glass" style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr auto', gap: '1rem', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>LABEL (e.g. Home)</label>
                    <input 
                      type="text" 
                      value={link.label} 
                      onChange={(e) => updateNavbarLink(index, 'label', e.target.value)}
                      className="card" style={{ width: '100%', padding: '0.5rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>TARGET (Section ID or URL)</label>
                    <input 
                      type="text" 
                      value={link.target} 
                      onChange={(e) => updateNavbarLink(index, 'target', e.target.value)}
                      className="card" style={{ width: '100%', padding: '0.5rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>TYPE</label>
                    <select 
                      value={link.type} 
                      onChange={(e) => updateNavbarLink(index, 'type', e.target.value)}
                      className="card" style={{ width: '100%', padding: '0.5rem' }}
                    >
                      <option value="scroll">Scroll to Section</option>
                      <option value="link">External Link</option>
                    </select>
                  </div>
                  <button 
                    onClick={() => deleteNavbarLink(index)}
                    style={{ padding: '0.6rem', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '8px', backgroundColor: '#fef2f2', cursor: 'pointer' }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            {navbarLinks.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button onClick={() => updateJSONAndSave('landing_navbar_links', navbarLinks)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Save size={18} /> Save Navigation Links
                </button>
              </div>
            )}
          </div>
        )}

        {/* --- SOCIAL MEDIA --- */}
        {activeTab === 'social' && (
          <div className="card animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Share2 color="var(--gurmad-green)" /> Social Media presence
              </h3>
              <button onClick={addSocialLink} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem' }}>
                <Plus size={16} /> Add Platform
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {socialLinks.map((link, index) => (
                <div key={index} className="card glass" style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1.5fr 2fr 1.5fr auto', gap: '1rem', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>PLATFORM</label>
                    <select 
                      value={link.platform} 
                      onChange={(e) => updateSocialLink(index, 'platform', e.target.value)}
                      className="card" style={{ width: '100%', padding: '0.5rem' }}
                    >
                      <option value="Facebook">Facebook</option>
                      <option value="Twitter">Twitter/X</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Instagram">Instagram</option>
                      <option value="YouTube">YouTube</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>PROFILE URL</label>
                    <input 
                      type="text" 
                      value={link.url} 
                      onChange={(e) => updateSocialLink(index, 'url', e.target.value)}
                      className="card" style={{ width: '100%', padding: '0.5rem' }}
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>ICON TYPE</label>
                    <select 
                      value={link.icon} 
                      onChange={(e) => updateSocialLink(index, 'icon', e.target.value)}
                      className="card" style={{ width: '100%', padding: '0.5rem' }}
                    >
                      <option value="Share2">Social/Share Icon</option>
                      <option value="Globe">Web/Twitter Icon</option>
                      <option value="MessageSquare">Chat/WhatsApp Icon</option>
                      <option value="ExternalLink">Link/LinkedIn Icon</option>
                      <option value="Layout">Photo/Instagram Icon</option>
                      <option value="Play">Video/YouTube Icon</option>
                    </select>
                  </div>
                  <button 
                    onClick={() => deleteSocialLink(index)}
                    style={{ padding: '0.6rem', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '8px', backgroundColor: '#fef2f2', cursor: 'pointer' }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            {socialLinks.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button onClick={() => updateJSONAndSave('landing_social_links', socialLinks)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Save size={18} /> Save Social Links
                </button>
              </div>
            )}
          </div>
        )}

        {/* --- COMPANY NEWS --- */}
        {activeTab === 'news' && (
          <div className="card animate-fade-in shadow-xl">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText color="var(--gurmad-green)" /> Manage Company News
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Share updates, events, and news with your visitors</p>
              </div>
              <button onClick={addNewsItem} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.2rem' }}>
                <Plus size={18} /> Add News Article
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {newsItems.map((item, index) => (
                <div key={item.id} className="card glass" style={{ padding: '1.5rem', border: '1px solid var(--border-color)', position: 'relative' }}>
                  <button 
                    onClick={() => deleteNewsItem(index)}
                    style={{ position: 'absolute', top: '15px', right: '15px', color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%' }}
                    className="hover:bg-red-50"
                  >
                    <Trash2 size={18} />
                  </button>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>IMAGES & GALLERY</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px', marginBottom: '8px' }}>
                      {item.images && item.images.map((img, imgIdx) => (
                        <div key={imgIdx} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: item.coverImage === img ? '3px solid var(--gurmad-green)' : '1px solid var(--border-color)' }}>
                          <img src={`/uploads/${img}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Gallery" />
                          <div style={{ position: 'absolute', top: '2px', right: '2px', display: 'flex', gap: '2px' }}>
                            <button 
                              onClick={() => removeNewsImage(index, imgIdx)}
                              style={{ padding: '2px', backgroundColor: 'rgba(239, 68, 68, 0.9)', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                              title="Delete Image"
                            >
                              <Trash2 size={12} />
                            </button>
                            <button 
                              onClick={() => setAsCover(index, img)}
                              style={{ padding: '2px', backgroundColor: item.coverImage === img ? 'var(--gurmad-green)' : 'rgba(100, 116, 139, 0.9)', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                              title="Set as Cover"
                            >
                              <ImageIcon size={12} />
                            </button>
                          </div>
                          {item.coverImage === img && (
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'var(--gurmad-green)', color: 'white', fontSize: '8px', textAlign: 'center', fontWeight: 700, padding: '2px 0' }}>
                              COVER
                            </div>
                          )}
                        </div>
                      ))}
                      <label style={{ 
                        aspectRatio: '1', borderRadius: '8px', border: '2px dashed var(--border-color)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        color: 'var(--text-muted)', transition: '0.2s'
                      }} className="hover:bg-green-50 hover:border-green-300">
                        <Plus size={20} />
                        <input 
                          type="file" 
                          multiple
                          onChange={(e) => handleImageUpload(e, 'news', index)}
                          style={{ display: 'none' }}
                          accept="image/*"
                        />
                      </label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>TITLE</label>
                        <input 
                          type="text" 
                          value={item.title} 
                          onChange={(e) => updateNewsItem(index, 'title', e.target.value)}
                          className="card" style={{ width: '100%', padding: '0.5rem' }}
                          placeholder="Headline..."
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>DATE</label>
                        <input 
                          type="date" 
                          value={item.date} 
                          onChange={(e) => updateNewsItem(index, 'date', e.target.value)}
                          className="card" style={{ width: '100%', padding: '0.5rem' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>EXCERPT (Preview text)</label>
                        <textarea 
                          rows={2}
                          value={item.excerpt} 
                          onChange={(e) => updateNewsItem(index, 'excerpt', e.target.value)}
                          className="card" style={{ width: '100%', padding: '0.5rem', resize: 'vertical' }}
                          placeholder="Brief summary..."
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>FACEBOOK VIDEO URL (Optional)</label>
                        <input 
                          type="text" 
                          value={item.videoUrl || ''} 
                          onChange={(e) => updateNewsItem(index, 'videoUrl', e.target.value)}
                          className="card" style={{ width: '100%', padding: '0.5rem' }}
                          placeholder="https://www.facebook.com/..."
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>FULL CONTENT</label>
                      <textarea 
                        rows={6}
                        value={item.content} 
                        onChange={(e) => updateNewsItem(index, 'content', e.target.value)}
                        className="card" style={{ width: '100%', padding: '0.5rem', resize: 'vertical' }}
                        placeholder="Write the full story here..."
                      />
                    </div>
                  </div>
                </div>
              ))}

              {newsItems.length === 0 && (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--border-color)', borderRadius: '16px' }}>
                  <FileText size={48} style={{ margin: '0 auto 1rem', opacity: 0.1 }} />
                  <p style={{ color: 'var(--text-muted)' }}>Madaadan wax war ah soo gelin. Guji badhanka sare si aad u bilowdo.</p>
                </div>
              )}
            </div>

            {newsItems.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <button onClick={() => updateJSONAndSave('landing_news', newsItems)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Save size={18} /> Save All News
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .spin { animation: rotate 1s linear infinite; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default LandingManagementView;
