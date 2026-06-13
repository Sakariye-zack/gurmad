import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Truck, 
  Shield, 
  BarChart, 
  MapPin, 
  Phone, 
  Mail, 
  ArrowRight, 
  CheckCircle2, 
  Users, 
  Activity, 
  Clock,
  ShieldCheck,
  Globe,
  MessageSquare,
  LogIn,
  Share2,
  Play,
  Layout,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { api } from '../api';

const LandingView = ({ onLoginClick }) => {
  const [settings, setSettings] = useState({});
  const [stats, setStats] = useState({ revenue: 0, customerCount: 0, tasksCompleted: 0, totalExpenses: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sData, statsData] = await Promise.all([
          api.getSettings().catch(err => ({})),
          fetch('/api/stats').then(res => res.json()).catch(err => ({ customerCount: 0, tasksCompleted: 0 }))
        ]);
        setSettings(sData || {});
        setStats(statsData || { customerCount: 0, tasksCompleted: 0 });
      } catch (error) {
        console.error('Failed to load landing page data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getServices = () => {
    try {
      if (typeof settings.landing_services === 'string') {
        return JSON.parse(settings.landing_services);
      }
      return settings.landing_services || [];
    } catch (e) {
      console.error('Failed to parse services:', e);
      return [];
    }
  };

  const services = getServices();

  const getNavbarLinks = () => {
    try {
      let links = [];
      if (typeof settings.landing_navbar_links === 'string') {
        links = JSON.parse(settings.landing_navbar_links);
      } else {
        links = settings.landing_navbar_links || [];
      }
      
      if (links && links.length > 0) return links;
      
      // Fallback to defaults
      return [
        { label: 'Home', target: 'home', type: 'scroll' },
        { label: 'Services', target: 'services', type: 'scroll' },
        { label: 'News', target: 'news', type: 'scroll' },
        { label: 'About Us', target: 'about', type: 'scroll' },
        { label: 'Contact', target: 'contact', type: 'scroll' }
      ];
    } catch (e) {
      console.error('Failed to parse navbar links:', e);
      return [
        { label: 'Home', target: 'home', type: 'scroll' },
        { label: 'Services', target: 'services', type: 'scroll' },
        { label: 'News', target: 'news', type: 'scroll' },
        { label: 'About Us', target: 'about', type: 'scroll' },
        { label: 'Contact', target: 'contact', type: 'scroll' }
      ];
    }
  };

  const navbarLinks = getNavbarLinks();

  const getSocialLinks = () => {
    try {
      if (typeof settings.landing_social_links === 'string') {
        return JSON.parse(settings.landing_social_links);
      }
      return settings.landing_social_links || [];
    } catch (e) {
      console.error('Failed to parse social links:', e);
      return [];
    }
  };

  const socialLinks = getSocialLinks();

  const getNews = () => {
    try {
      if (typeof settings.landing_news === 'string') {
        return JSON.parse(settings.landing_news);
      }
      return settings.landing_news || [];
    } catch (e) {
      console.error('Failed to parse news:', e);
      return [];
    }
  };

  const newsItems = getNews();

  const getSocialIcon = (iconName) => {
    const size = 20;
    const name = iconName?.toLowerCase();
    
    switch (name) {
      case 'facebook': 
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
          </svg>
        );
      case 'twitter':
      case 'x':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4l11.733 16h4.267l-11.733 -16z"></path>
            <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"></path>
          </svg>
        );
      case 'instagram':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
          </svg>
        );
      case 'youtube':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.42a2.78 2.78 0 0 0-1.94 2C1 8.11 1 12 1 12s0 3.89.46 5.58a2.78 2.78 0 0 0 1.94 2c1.71.42 8.6.42 8.6.42s6.88 0 8.6-.42a2.78 2.78 0 0 0 1.94-2C23 15.89 23 12 23 12s0-3.89-.46-5.58z"></path>
            <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"></polygon>
          </svg>
        );
      case 'linkedin':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
            <rect x="2" y="9" width="4" height="12"></rect>
            <circle cx="4" cy="4" r="2"></circle>
          </svg>
        );
      case 'tiktok':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path>
          </svg>
        );
      case 'whatsapp':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-10.6 8.38 8.38 0 0 1 3.9 1.1L21 4.5z"></path>
          </svg>
        );
      default: return <Share2 size={size} />;
    }
  };

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 80; // height of navbar
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  };

  const fadeIn = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-100px" },
    transition: { duration: 0.8, ease: "easeOut" }
  };

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
      <motion.div 
        animate={{ rotate: 360 }} 
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        style={{ width: '40px', height: '40px', border: '4px solid #3FAE2A', borderTopColor: 'transparent', borderRadius: '50%' }}
      />
    </div>
  );

  return (
    <div className="landing-container" style={{ 
      backgroundColor: '#ffffff', 
      color: '#0f172a', 
      minHeight: '100vh', 
      overflowX: 'hidden', 
      fontFamily: "'Outfit', sans-serif",
      position: 'relative'
    }}>
      
      {/* Background Orbs - Enhanced for more Green */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none', opacity: 0.8 }}>
        <motion.div 
          animate={{ 
            x: [0, 100, 0], 
            y: [0, 60, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          style={{ 
            position: 'absolute', top: '-15%', right: '-10%', width: '70vw', height: '70vw', 
            background: 'radial-gradient(circle, rgba(63,174,42,0.18) 0%, transparent 70%)', 
            borderRadius: '50%', filter: 'blur(100px)' 
          }} 
        />
        <motion.div 
          animate={{ 
            x: [0, -80, 0], 
            y: [0, 120, 0],
            scale: [1, 1.3, 1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{ 
            position: 'absolute', bottom: '-10%', left: '-15%', width: '60vw', height: '60vw', 
            background: 'radial-gradient(circle, rgba(63,174,42,0.15) 0%, transparent 70%)', 
            borderRadius: '50%', filter: 'blur(80px)' 
          }} 
        />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Modern Navbar - Glassmorphism */}
        <nav style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '90px',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          borderBottom: '1px solid rgba(63, 174, 42, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 6%',
          zIndex: 1000,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div style={{ 
              backgroundColor: '#3FAE2A', 
              width: '48px',
              height: '48px',
              borderRadius: '14px', 
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              boxShadow: '0 8px 16px rgba(63, 174, 42, 0.2)',
            }}>
              {settings.system_logo ? (
                <img src={`/api/uploads/${settings.system_logo}`} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <Truck size={26} />
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 800, fontSize: '1.4rem', color: '#1e293b', lineHeight: 1 }}>
                {(settings.company_name || 'GURMAD').split(' ')[0].toUpperCase()}
              </span>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#3FAE2A', letterSpacing: '2px', marginTop: '2px' }}>
                WASTE MANAGEMENT
              </span>
            </div>
          </div>

          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
              {navbarLinks.map((link, idx) => (
                <button 
                  key={idx}
                  onClick={() => {
                    if (link.type === 'scroll') {
                      if (link.target === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
                      else scrollToSection(link.target);
                    } else {
                      window.open(link.target, '_blank');
                    }
                  }} 
                  style={{
                    background: 'none', border: 'none', fontWeight: 600, color: '#475569',
                    cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.95rem',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#3FAE2A'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#475569'}
                >
                  {link.label}
                </button>
              ))}
              <button 
                onClick={onLoginClick}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '10px', 
                  padding: '0.8rem 1.8rem', backgroundColor: '#3FAE2A', color: 'white',
                  border: 'none', borderRadius: '16px', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 8px 20px -6px rgba(63, 174, 42, 0.4)', transition: '0.3s', fontSize: '0.95rem'
                }}
              >
                <LogIn size={18} /> Admin Portal
              </button>
            </div>
          )}

          {isMobile && (
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} style={{ color: '#3FAE2A' }}>
              {isMobileMenuOpen ? '✕' : <Layout size={28} />}
            </button>
          )}

          {isMobile && isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                position: 'absolute', top: '90px', left: 0, right: 0,
                backgroundColor: 'white', padding: '2rem', borderBottom: '1px solid #f1f5f9',
                display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
              }}
            >
              {navbarLinks.map((link, idx) => (
                <button 
                  key={idx}
                  onClick={() => { setIsMobileMenuOpen(false); if (link.type === 'scroll') scrollToSection(link.target); else window.open(link.target, '_blank'); }} 
                  style={{ textAlign: 'left', fontWeight: 600, color: '#1e293b', fontSize: '1.1rem' }}
                >
                  {link.label}
                </button>
              ))}
              <button 
                onClick={() => { setIsMobileMenuOpen(false); onLoginClick(); }}
                style={{ padding: '1rem', backgroundColor: '#3FAE2A', color: 'white', borderRadius: '16px', fontWeight: 700, textAlign: 'center' }}
              >
                Admin Portal
              </button>
            </motion.div>
          )}
        </nav>

        {/* --- HERO SECTION - Green Gradient Background --- */}
        <section id="home" style={{ 
          padding: isMobile ? '140px 6% 80px' : '200px 8% 120px', 
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'center',
          gap: '60px',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, rgba(63, 174, 42, 0.08) 0%, rgba(255, 255, 255, 1) 50%, rgba(63, 174, 42, 0.05) 100%)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Decorative Green Circles */}
          <div style={{ position: 'absolute', top: '10%', left: '-5%', width: '300px', height: '300px', backgroundColor: 'rgba(63, 174, 42, 0.03)', borderRadius: '50%', zIndex: -1 }}></div>
          <div style={{ position: 'absolute', bottom: '10%', right: '0%', width: '400px', height: '400px', backgroundColor: 'rgba(63, 174, 42, 0.04)', borderRadius: '50%', zIndex: -1 }}></div>

          <div style={{ flex: 1.2 }}>
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div variants={itemVariants} style={{ 
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                backgroundColor: '#3FAE2A', color: 'white', padding: '10px 22px', 
                borderRadius: '99px', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', 
                letterSpacing: '2px', marginBottom: '30px', boxShadow: '0 10px 20px -5px rgba(63, 174, 42, 0.3)'
              }}>
                <Truck size={16} /> Burao's #1 Waste Management Provider
              </motion.div>
              
              <motion.h1 variants={itemVariants} style={{ 
                fontSize: 'clamp(3rem, 9vw, 5.2rem)', fontWeight: 950, lineHeight: 0.95, 
                margin: '0 0 35px 0', color: '#0f172a', letterSpacing: '-3px' 
              }}>
                Smart Solutions <br/>
                <span style={{ 
                  color: '#3FAE2A',
                  background: 'linear-gradient(90deg, #3FAE2A, #2d8220)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>For A Clean City.</span>
              </motion.h1>
              
              <motion.p variants={itemVariants} style={{ 
                fontSize: '1.3rem', color: '#475569', marginBottom: '50px', 
                lineHeight: 1.6, maxWidth: '600px', fontWeight: 500
              }}>
                {settings.landing_hero_subtitle || 'We combine advanced logistics with sustainable practices to ensure Gurmad remains the leader in urban sanitation.'}
              </motion.p>
              
              <motion.div variants={itemVariants} style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => scrollToSection('services')}
                  style={{ 
                    padding: '1.4rem 3.2rem', backgroundColor: '#3FAE2A', color: 'white', border: 'none', 
                    borderRadius: '24px', fontSize: '1.15rem', fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '14px',
                    boxShadow: '0 25px 35px -12px rgba(63, 174, 42, 0.5)', transition: '0.4s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    e.currentTarget.style.backgroundColor = '#2d8220';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.backgroundColor = '#3FAE2A';
                  }}
                >
                  Join Today <ArrowRight size={24} />
                </button>
                <button 
                  onClick={() => scrollToSection('about')}
                  style={{ 
                    padding: '1.4rem 3.2rem', backgroundColor: 'white', color: '#3FAE2A', 
                    border: '2px solid #3FAE2A', borderRadius: '24px', fontSize: '1.15rem', 
                    fontWeight: 800, cursor: 'pointer', transition: '0.4s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f0fdf4';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  Our Vision
                </button>
              </motion.div>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.8, rotate: -2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{ flex: 1, position: 'relative' }}
          >
            <div style={{ position: 'relative', width: '100%', maxWidth: '600px' }}>
              {/* Premium Blob Image */}
              <div style={{
                aspectRatio: '1/1',
                width: '100%',
                background: 'linear-gradient(45deg, #3FAE2A, #dcfce7)',
                borderRadius: '42% 58% 54% 46% / 45% 45% 55% 55%',
                overflow: 'hidden',
                boxShadow: '0 50px 100px -20px rgba(63, 174, 42, 0.4)',
                border: '12px solid white',
                zIndex: 2,
                position: 'relative'
              }}>
                <img 
                  src={settings.landing_hero_image ? `/api/uploads/${settings.landing_hero_image}` : "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&q=80&w=1200"} 
                  alt="Somaliland Sanitation" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'multiply', opacity: 0.9 }} 
                />
                <img 
                  src={settings.landing_hero_image ? `/api/uploads/${settings.landing_hero_image}` : "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&q=80&w=1200"} 
                  alt="Somaliland Sanitation" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} 
                />
              </div>

              {/* Enhanced Floating Stats */}
              <motion.div 
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  position: 'absolute', top: '5%', left: '-15%',
                  backgroundColor: 'white', padding: '1.5rem 2rem', borderRadius: '28px',
                  boxShadow: '0 25px 40px -10px rgba(0,0,0,0.15)', zIndex: 3,
                  display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid rgba(63,174,42,0.1)'
                }}
              >
                <div style={{ backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '16px' }}>
                  <ShieldCheck size={32} color="#3FAE2A" />
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: '1.4rem', color: '#0f172a' }}>100% Secure</div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>ZAAD/eDahab Integrated</div>
                </div>
              </motion.div>

              <motion.div 
                animate={{ x: [0, 15, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                style={{
                  position: 'absolute', bottom: '5%', right: '-10%',
                  backgroundColor: '#3FAE2A', padding: '1.5rem 2rem', borderRadius: '28px',
                  boxShadow: '0 25px 40px -10px rgba(63, 174, 42, 0.3)', zIndex: 3,
                  display: 'flex', alignItems: 'center', gap: '16px', color: 'white'
                }}
              >
                <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '16px' }}>
                  <Truck size={32} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: '1.4rem' }}>Live Tracking</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.9, fontWeight: 600 }}>Real-time Fleet View</div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* --- STATS SECTION - Green Background --- */}
        <section style={{ padding: '0 8%', marginTop: '-60px', position: 'relative', zIndex: 10 }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))', 
            gap: '30px',
            backgroundColor: '#0f172a',
            padding: '4rem',
            borderRadius: '48px',
            boxShadow: '0 40px 80px -20px rgba(15, 23, 42, 0.4)'
          }}>
            {[
              { label: 'Verified Customers', value: (stats.customerCount || 0) +  "+", icon: Users, color: '#3FAE2A' },
              { label: 'Weekly Collection', value: '850+', icon: Activity, color: '#f59e0b' },
              { label: 'Success Rate', value: '99.9%', icon: CheckCircle2, color: '#10b981' },
              { label: 'Fleet Support', value: '24/7', icon: Clock, color: '#3b82f6' }
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
              >
                <div style={{ 
                  width: '60px', height: '60px', borderRadius: '18px', backgroundColor: 'rgba(255,255,255,0.05)', 
                  color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem'
                }}>
                  <stat.icon size={32} />
                </div>
                <div style={{ fontSize: '2.8rem', fontWeight: 900, marginBottom: '6px', color: 'white', letterSpacing: '-1px' }}>{stat.value}</div>
                <div style={{ color: '#94a3b8', fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* --- SERVICES SECTION --- */}
        <section id="services" style={{ padding: isMobile ? '100px 6%' : '160px 8%', backgroundColor: '#ffffff' }}>
          <div style={{ textAlign: 'center', marginBottom: '100px' }}>
            <motion.div {...fadeIn}>
              <div style={{ backgroundColor: '#f0fdf4', color: '#3FAE2A', fontWeight: 900, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '20px', padding: '8px 20px', borderRadius: '99px', display: 'inline-block' }}>What We Offer</div>
              <h2 style={{ fontSize: isMobile ? '2.8rem' : '4rem', fontWeight: 950, color: '#0f172a', letterSpacing: '-2px', lineHeight: 1 }}>Our Premium Services</h2>
              <div style={{ width: '80px', height: '8px', backgroundColor: '#3FAE2A', margin: '30px auto', borderRadius: '10px' }}></div>
            </motion.div>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', 
            gap: '40px' 
          }}>
            {services.map((service, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.7 }}
                style={{ 
                  backgroundColor: '#f8fafc', padding: '4rem 3.5rem', borderRadius: '50px',
                  border: '1px solid rgba(63, 174, 42, 0.05)', transition: '0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)', 
                  cursor: 'pointer', position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-15px)';
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.boxShadow = '0 40px 80px -20px rgba(63, 174, 42, 0.15)';
                  e.currentTarget.style.borderColor = 'rgba(63, 174, 42, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = 'rgba(63, 174, 42, 0.05)';
                }}
              >
                <div style={{ 
                  width: '90px', height: '90px', borderRadius: '28px', backgroundColor: '#3FAE2A', 
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2.5rem',
                  boxShadow: '0 15px 30px -5px rgba(63, 174, 42, 0.3)'
                }}>
                  {service.icon === 'Truck' && <Truck size={45} />}
                  {service.icon === 'Shield' && <Shield size={45} />}
                  {service.icon === 'BarChart' && <BarChart size={45} />}
                </div>
                <h3 style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '20px', color: '#0f172a', letterSpacing: '-1px' }}>{service.title}</h3>
                <p style={{ color: '#475569', lineHeight: 1.8, fontSize: '1.2rem', fontWeight: 400 }}>{service.desc}</p>
                
                <div style={{ marginTop: '3rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#3FAE2A', fontWeight: 800, fontSize: '1.1rem' }}>
                  Learn More <ArrowRight size={22} />
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* --- NEWS SECTION --- */}
        {newsItems.length > 0 && (
          <section id="news" style={{ padding: isMobile ? '100px 6%' : '160px 8%', backgroundColor: '#fcfcfc', position: 'relative' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '80px' }}>
                <div>
                  <div style={{ color: '#3FAE2A', fontWeight: 900, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '4px', marginBottom: '20px' }}>Latest Updates</div>
                  <h2 style={{ fontSize: isMobile ? '2.8rem' : '4rem', fontWeight: 950, color: '#0f172a', letterSpacing: '-2px', lineHeight: 1 }}>News & Insights</h2>
                </div>
                {!isMobile && (
                  <button style={{ 
                    padding: '1rem 2.5rem', backgroundColor: 'white', border: '2px solid #f1f5f9', borderRadius: '18px', 
                    fontWeight: 800, color: '#1e293b', transition: '0.3s', cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3FAE2A'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#f1f5f9'}
                  >View All News</button>
                )}
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '40px' }}>
                {newsItems.slice(0, 3).map((item, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    style={{ 
                      backgroundColor: 'white', borderRadius: '48px', overflow: 'hidden',
                      boxShadow: '0 20px 40px -10px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.02)',
                      transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)', cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-10px)';
                      e.currentTarget.style.boxShadow = '0 40px 80px -20px rgba(63, 174, 42, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 20px 40px -10px rgba(0,0,0,0.05)';
                    }}
                    onClick={() => setSelectedNews(item)}
                  >
                    <div style={{ height: '280px', overflow: 'hidden', position: 'relative' }}>
                      {item.coverImage ? (
                        <img src={`/api/uploads/${item.coverImage}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="News" />
                      ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', color: '#cbd5e1' }}>
                           <Layout size={100} style={{ opacity: 0.1 }} />
                        </div>
                      )}
                      <div style={{ position: 'absolute', top: '25px', left: '25px', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', padding: '8px 18px', borderRadius: '14px', fontWeight: 800, fontSize: '0.85rem', color: '#3FAE2A', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ padding: '3rem' }}>
                      <h3 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '20px', color: '#0f172a', lineHeight: 1.3, letterSpacing: '-0.5px' }}>{item.title}</h3>
                      <p style={{ color: '#475569', lineHeight: 1.7, marginBottom: '30px', fontSize: '1.1rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.excerpt}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#3FAE2A', fontWeight: 900, fontSize: '1rem' }}>
                        Read Article <ArrowRight size={20} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* --- GREEN CALL TO ACTION --- */}
        <section style={{ padding: '100px 8%' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #3FAE2A 0%, #2d8220 100%)',
            borderRadius: '60px',
            padding: isMobile ? '80px 40px' : '100px 80px',
            textAlign: 'center',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 40px 80px -20px rgba(63, 174, 42, 0.4)'
          }}>
            <motion.div {...fadeIn}>
              <h2 style={{ fontSize: isMobile ? '2.5rem' : '4.5rem', fontWeight: 950, marginBottom: '30px', letterSpacing: '-2px', lineHeight: 1 }}>Ready for a <br/> Cleaner Neighborhood?</h2>
              <p style={{ fontSize: '1.4rem', opacity: 0.9, marginBottom: '50px', maxWidth: '700px', margin: '0 auto 50px' }}>Join over 10,000 households in Burao who trust Gurmad for their daily sanitation needs.</p>
              <button style={{ 
                padding: '1.5rem 4rem', backgroundColor: 'white', color: '#3FAE2A', 
                borderRadius: '24px', fontSize: '1.3rem', fontWeight: 900, transition: '0.3s',
                boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
              }}>Get Started Now</button>
            </motion.div>
            {/* Decor Circles */}
            <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', border: '30px solid rgba(255,255,255,0.05)', borderRadius: '50%' }}></div>
            <div style={{ position: 'absolute', bottom: '-80px', left: '-80px', width: '300px', height: '300px', border: '50px solid rgba(255,255,255,0.05)', borderRadius: '50%' }}></div>
          </div>
        </section>

        {/* --- ABOUT SECTION --- */}
        <section id="about" style={{ 
          padding: isMobile ? '100px 6%' : '160px 8%', 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'center', 
          gap: '100px',
        }}>
          <div style={{ flex: 1 }}>
            <motion.div 
              initial={{ opacity: 0, x: -80 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
            >
              <div style={{ color: '#3FAE2A', fontWeight: 900, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '4px', marginBottom: '20px' }}>Our Mission</div>
              <h2 style={{ fontSize: isMobile ? '3rem' : '4.5rem', fontWeight: 950, marginBottom: '40px', color: '#0f172a', letterSpacing: '-2px', lineHeight: 1 }}>Sustainability <br/> Is Our Core.</h2>
              <p style={{ fontSize: '1.4rem', color: '#475569', lineHeight: 1.8, marginBottom: '50px', fontWeight: 400 }}>
                {settings.landing_about_text || 'We are dedicated to building a greener Somaliland by providing the most efficient waste management system in the region. Our technology-first approach ensures no bin is left uncollected.'}
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                {[
                  { title: 'Tech Innovation', icon: Activity },
                  { title: 'Reliability', icon: ShieldCheck },
                  { title: 'Transparency', icon: CheckCircle2 },
                  { title: 'Green Energy', icon: Globe }
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ color: '#3FAE2A', backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '16px' }}><item.icon size={28} /></div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.2rem' }}>{item.title}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
          
          <div style={{ flex: 1, position: 'relative' }}>
            <div style={{ 
              width: '100%', height: '700px', backgroundColor: '#f1f5f9', 
              borderRadius: '80px', overflow: 'hidden', boxShadow: '0 60px 120px -30px rgba(0,0,0,0.15)',
              border: '15px solid white'
            }}>
              <img 
                src={settings.landing_about_image ? `/api/uploads/${settings.landing_about_image}` : "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80"} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                alt="Environmental Excellence" 
              />
            </div>
            {/* Floating Experience Badge - Moved to Top Left for better visibility */}
            <div style={{
              position: 'absolute', top: '40px', left: '-30px',
              backgroundColor: '#0f172a', color: 'white', padding: '2.5rem',
              borderRadius: '35px', boxShadow: '0 30px 60px rgba(0,0,0,0.3)',
              textAlign: 'center', zIndex: 10
            }}>
              <div style={{ fontSize: '3.5rem', fontWeight: 950, color: '#3FAE2A', lineHeight: 1 }}>10+</div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', opacity: 0.8, marginTop: '5px' }}>Years Experience</div>
            </div>
          </div>
        </section>

        {/* --- PREMIUM DEEP GREEN FOOTER --- */}
        <footer id="contact" style={{ 
          padding: '120px 8% 60px', 
          background: 'linear-gradient(180deg, #051101 0%, #0a1f03 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          borderTop: '1px solid rgba(63, 174, 42, 0.2)'
        }}>
          {/* Decorative Glowing Orbs */}
          <div style={{ position: 'absolute', top: '-100px', left: '-100px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(63,174,42,0.15) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }}></div>
          <div style={{ position: 'absolute', bottom: '-150px', right: '-150px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(63,174,42,0.1) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }}></div>

          <div style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile ? '1fr' : '2fr 1.5fr 1.5fr', 
              gap: '80px', 
              marginBottom: '80px' 
            }}>
              {/* Brand Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '30px' }}>
                  <div style={{ 
                    backgroundColor: '#3FAE2A', width: '56px', height: '56px', borderRadius: '16px', 
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 10px 25px rgba(63, 174, 42, 0.4)', overflow: 'hidden'
                  }}>
                    {settings.system_logo ? (
                      <img src={`/api/uploads/${settings.system_logo}`} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <Truck size={30} />
                    )}
                  </div>
                  <span style={{ fontWeight: 950, fontSize: '1.8rem', letterSpacing: '-1px', lineHeight: 1.1 }}>
                    {(settings.company_name || 'GURMAD WASTE MANAGEMENT').toUpperCase().replace(' WASTE MANAGEMENT', '')} <br/>
                    <span style={{ color: '#3FAE2A', fontSize: '1.2rem', letterSpacing: '2px' }}>WASTE MANAGEMENT</span>
                  </span>
                </div>
                <p style={{ color: '#94a3b8', lineHeight: 1.8, marginBottom: '35px', fontSize: '1.1rem', maxWidth: '400px' }}>
                  {settings.landing_footer_text || 'Providing world-class urban sanitation and waste logistics in Somaliland. Empowering communities with a cleaner, greener tomorrow.'}
                </p>
                <div style={{ display: 'flex', gap: '16px' }}>
                  {socialLinks.map((link, idx) => (
                    <motion.a 
                      key={idx} href={link.url} target="_blank" rel="noopener noreferrer"
                      whileHover={{ scale: 1.15, backgroundColor: '#3FAE2A', borderColor: '#3FAE2A', color: 'white' }}
                      style={{ 
                        width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.03)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8',
                        transition: 'all 0.3s ease', border: '1px solid rgba(255,255,255,0.08)'
                      }}
                    >
                      {getSocialIcon(link.icon)}
                    </motion.a>
                  ))}
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h4 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '35px', color: 'white', letterSpacing: '1px' }}>Contact Info</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', color: '#cbd5e1' }}>
                  <motion.div whileHover={{ x: 5 }} style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'rgba(63,174,42,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(63,174,42,0.3)' }}>
                       <Phone size={20} style={{ color: '#3FAE2A' }} />
                    </div>
                    <span style={{ fontSize: '1.1rem', fontWeight: 500, color: '#e2e8f0' }}>{settings.contact_phone || settings.landing_contact_phone || '063-4444444'}</span>
                  </motion.div>
                  <motion.div whileHover={{ x: 5 }} style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(59,130,246,0.3)' }}>
                       <Mail size={20} style={{ color: '#60a5fa' }} />
                    </div>
                    <span style={{ fontSize: '1.1rem', fontWeight: 500, color: '#e2e8f0' }}>{settings.support_email || settings.landing_contact_email || 'info@gurmad.so'}</span>
                  </motion.div>
                  <motion.div whileHover={{ x: 5 }} style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(245,158,11,0.3)' }}>
                       <MapPin size={20} style={{ color: '#fbbf24' }} />
                    </div>
                    <span style={{ fontSize: '1.1rem', fontWeight: 500, color: '#e2e8f0' }}>{settings.landing_contact_address || 'Main St, Burao, Somaliland'}</span>
                  </motion.div>
                </div>
              </div>

              {/* Navigation Links */}
              <div>
                <h4 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '35px', color: 'white', letterSpacing: '1px' }}>Quick Links</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '1.1rem' }}>
                   {[
                     { label: 'Home', id: 'home' }, 
                     { label: 'Services', id: 'services' }, 
                     { label: 'News', id: 'news' }, 
                     { label: 'About Us', id: 'about' }
                   ].map((link, i) => (
                     <motion.div 
                       key={i} 
                       onClick={() => scrollToSection(link.id)}
                       whileHover={{ x: 5, color: '#3FAE2A' }}
                       style={{ color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'color 0.2s' }}
                     >
                       <ChevronRight size={14} style={{ opacity: 0.5 }} /> {link.label}
                     </motion.div>
                   ))}
                   {['Privacy Policy', 'Terms of Use', 'Support Ticket'].map((label, i) => (
                     <motion.div 
                       key={`ext-${i}`}
                       whileHover={{ x: 5, color: '#3FAE2A' }}
                       style={{ color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'color 0.2s' }}
                     >
                       <ChevronRight size={14} style={{ opacity: 0.5 }} /> {label}
                     </motion.div>
                   ))}
                </div>
              </div>
            </div>

            {/* Copyright & Bottom Bar */}
            <div style={{ 
              borderTop: '1px solid rgba(255,255,255,0.08)', 
              paddingTop: '40px', 
              display: 'flex', 
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '20px',
              color: '#64748b', 
              fontSize: '0.95rem', 
              fontWeight: 500 
            }}>
              <div>
                © {new Date().getFullYear()} {settings.company_name ? settings.company_name.replace(' Waste Management', '') : 'GURMAD'} Waste Management. All rights reserved.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {settings.landing_footer_bottom_text || (
                  <>Developed by <span style={{ color: '#3FAE2A', fontWeight: 800 }}>Qaran Digital Solutions Ltd</span></>
                )}
              </div>
            </div>
          </div>
        </footer>

        {/* --- MODALS - Fixed --- */}
        {selectedNews && (
          <div 
            onClick={() => setSelectedNews(null)}
            style={{ 
              position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
              backgroundColor: 'rgba(5, 17, 1, 0.9)', backdropFilter: 'blur(20px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
            }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{ 
                backgroundColor: 'white', width: '100%', maxWidth: '1100px', maxHeight: '90vh', 
                borderRadius: '56px', overflow: 'hidden', boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.5)',
                display: 'flex', flexDirection: 'column', border: '1px solid rgba(63,174,42,0.2)'
              }}
            >
              <div style={{ padding: '5rem', overflowY: 'auto', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1rem', fontWeight: 900, color: '#3FAE2A', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '4px' }}>
                      <CheckCircle2 size={22} /> News Update
                    </div>
                    <h2 style={{ fontSize: '3.5rem', fontWeight: 950, color: '#0f172a', lineHeight: 1, letterSpacing: '-2px' }}>{selectedNews.title}</h2>
                    <div style={{ marginTop: '25px', color: '#64748b', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <span style={{ fontWeight: 700 }}>{new Date(selectedNews.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3FAE2A' }}></span>
                      <span style={{ fontWeight: 600 }}>{selectedNews.category || 'Official'}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedNews(null)} style={{ padding: '20px', backgroundColor: '#f1f5f9', borderRadius: '50%', color: '#0f172a', transition: '0.3s', fontWeight: 900 }}>✕</button>
                </div>

                <div style={{ height: '500px', backgroundColor: '#f8fafc', borderRadius: '48px', overflow: 'hidden', marginBottom: '4rem', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.05)' }}>
                   {selectedNews.coverImage ? (
                     <img src={`/api/uploads/${selectedNews.coverImage}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Cover" />
                   ) : (
                     <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0' }}>
                       <Truck size={150} style={{ opacity: 0.1 }} />
                     </div>
                   )}
                </div>

                <div style={{ 
                  color: '#1e293b', fontSize: '1.4rem', lineHeight: 2,
                  whiteSpace: 'pre-wrap', maxWidth: '850px', margin: '0 auto', fontWeight: 400 
                }}>
                  {selectedNews.content || selectedNews.excerpt}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LandingView;
