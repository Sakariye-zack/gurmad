import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  ClipboardList, 
  Receipt, 
  Wallet, 
  BarChart3, 
  Settings,
  Bell,
  Search,
  Menu,
  ChevronRight,
  ChevronDown,
  LogOut,
  Map as MapIcon,
  MapPin,
  Truck,
  Briefcase,
  Fingerprint,
  Package,
  FolderOpen,
  MessageSquare,
  Sun,
  Moon,
  X,
  Shield
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { api } from './api';
import DashboardView from './components/DashboardView';
import CustomerView from './components/CustomerView';
import BillingView from './components/BillingView';
import ExpenseView from './components/ExpenseView';
import TaskView from './components/TaskView';
import MapView from './components/MapView';
import ReportsView from './components/ReportsView';
import SettingsView from './components/SettingsView';
import RolesView from './components/RolesView';
import HRMView from './components/HRMView';
import OnboardEmployeeView from './components/OnboardEmployeeView';
import AttendanceView from './components/AttendanceView';
import InventoryView from './components/InventoryView';
import SuppliersAssetsView from './components/SuppliersAssetsView';
import DocumentsView from './components/DocumentsView';
import DebtView from './components/DebtView';
import LoginView from './components/LoginView';
import FleetView from './components/FleetView';
import LandingView from './components/LandingView';
import ChatWidget from './components/ChatWidget';
import LandingManagementView from './components/LandingManagementView';
import ArchiveView from './components/ArchiveView';
import PayrollView from './components/PayrollView';
import AuditLogsView from './components/AuditLogsView';
import ComplaintsView from './components/ComplaintsView';
import CollectorAssignmentsView from './components/CollectorAssignmentsView';
import TodaysCollectionsView from './components/TodaysCollectionsView';
import MyRouteTodayView from './components/MyRouteTodayView';
import CashoutView from './components/CashoutView';
import CustomerPortalApp from './components/CustomerPortalApp';
import StaffPortalApp from './components/StaffPortalApp';
import StaffPortalGate from './components/StaffPortalGate';
import { Globe } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';

const App = () => {
  // Phase 8: Customer Portal is a completely separate, lightweight app — different auth
  // (customer phone+password, not staff username+password), different token type, different
  // data surface. Branching here (before any staff-app hooks/state) keeps it fully isolated
  // from the staff SPA below rather than threading customer state through it.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/portal')) {
    return <CustomerPortalApp />;
  }

  // Staff Portal gets its own dedicated URL too, mirroring /portal — Collector and Cashier
  // accounts sign in through a phone-friendly login screen here instead of the desktop
  // "Admin Portal" card, then land straight on their job dashboard (StaffPortalGate handles the
  // login/logged-in split and the same 'gurmadUser' localStorage key the main app uses, so a
  // session started at either URL is recognized at the other).
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/staff')) {
    return <StaffPortalGate />;
  }

  const { t, setLanguage, currentLanguage } = useLanguage();
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('gurmadUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState(['operations', 'accounting', 'staff']);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [systemSettings, setSystemSettings] = useState({
    logo: '',
    companyName: 'GURMAD',
    systemTitle: 'MANAGEMENT'
  });
  const [collectorTodayStats, setCollectorTodayStats] = useState([]);
  const [billingPrefillPhone, setBillingPrefillPhone] = useState(null);
  const [myTodayRoute, setMyTodayRoute] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('gurmadTheme') || 'light');
  const [logoError, setLogoError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  useEffect(() => { setLogoError(false); }, [systemSettings.logo]);
  useEffect(() => { setAvatarError(false); }, [currentUser?.profile_image]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('gurmadTheme', theme);
  }, [theme]);

  useEffect(() => {
    const handleClearSearch = () => setGlobalSearch('');
    const handleSwitchTab = (e) => setActiveTab(e.detail);
    
    const handleTokenExpired = () => {
      setCurrentUser(null);
      localStorage.removeItem('gurmadUser');
      toast.error('Session expired. Please log in again.');
      setShowLogin(true);
    };

    window.addEventListener('clearSearch', handleClearSearch);
    window.addEventListener('switchTab', handleSwitchTab);
    window.addEventListener('token_expired', handleTokenExpired);
    
    return () => {
      window.removeEventListener('clearSearch', handleClearSearch);
      window.removeEventListener('switchTab', handleSwitchTab);
      window.removeEventListener('token_expired', handleTokenExpired);
    };
  }, []);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setSystemSettings({
          logo: data.system_logo || '',
          companyName: (data.company_name || 'GURMAD').split(' ')[0].toUpperCase(),
          systemTitle: (data.company_name || 'GURMAD MANAGEMENT').split(' ').slice(1).join(' ').toUpperCase() || 'MANAGEMENT'
        });
        if (data.primaryColor) {
          document.documentElement.style.setProperty('--gurmad-green', data.primaryColor);
        }
        if (data.dashboardLayout) {
          document.documentElement.setAttribute('data-layout', data.dashboardLayout.toLowerCase());
        }
      })
      .catch(console.error);
  }, []);

  // Notifications polling
  useEffect(() => {
    if (!currentUser) return;
    
    const fetchNotifications = async () => {
      try {
         const data = await api.getNotifications(currentUser.id);
         setNotifications(data);
      } catch (err) {
         console.error('Failed to fetch notifications');
      }
    };

    fetchNotifications(); 
    const interval = setInterval(fetchNotifications, 20000); // 20s poller
    return () => clearInterval(interval);
  }, [currentUser]);

  // Collector Today Stats polling
  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'cashier')) return;

    const fetchCollectorStats = async () => {
      try {
        const stats = await api.getCollectorsTodayStats();
        setCollectorTodayStats(stats);
      } catch (err) {
        console.error("Failed to fetch collector today stats");
      }
    };

    fetchCollectorStats();
    const interval = setInterval(fetchCollectorStats, 60000); // 60s poller
    return () => clearInterval(interval);
  }, [currentUser]);

  // A collector's own today's route - every customer on their assigned task, so they can go collect one by one
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'collector') return;

    const fetchMyTodayRoute = async () => {
      try {
        const data = await api.getMyTodayRoute();
        setMyTodayRoute(data.customers || []);
      } catch (err) {
        console.error("Failed to fetch today's route");
      }
    };

    fetchMyTodayRoute();
    const interval = setInterval(fetchMyTodayRoute, 60000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Debounced Global Search
  useEffect(() => {
    if (!globalSearch || globalSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.globalSearch(globalSearch);
        setSearchResults(results);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [globalSearch]);

  const handleResultClick = (result) => {
    setActiveTab(result.tab);
    setSearchResults([]);
    setGlobalSearch(''); // Clear search on click
  };

  // Close search on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.search-container')) {
        setSearchResults([]);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Responsive logic (Restored)
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Define Menu Groups
  const menuGroups = [
    { 
      type: 'item',
      id: 'dashboard',
      label: t('dashboard'),
      icon: LayoutDashboard,
      roles: ['admin', 'cashier', 'collector', 'gudoomiye', 'zone_accountant']
    },
    {
      type: 'item',
      id: 'customers',
      label: t('customers'),
      icon: Users,
      roles: ['admin', 'cashier', 'collector', 'gudoomiye', 'zone_accountant']
    },
    {
      type: 'item',
      id: 'complaints',
      label: t('complaints'),
      icon: MessageSquare,
      roles: ['admin', 'cashier', 'gudoomiye']
    },
    {
      type: 'group',
      id: 'operations',
      label: t('operations'),
      icon: Truck,
      roles: ['admin', 'collector', 'cashier', 'gudoomiye', 'zone_accountant'],
      items: [
        { id: 'zones', label: t('manage_zones'), icon: MapIcon, roles: ['admin'] },
        { id: 'fleet', label: t('register_trucks'), icon: Truck, roles: ['admin'] },
        { id: 'collector_assignments', label: 'Collector Assignments', icon: MapIcon, roles: ['admin', 'gudoomiye'] },
        { id: 'cashier_assignments', label: 'Cashier Assignments', icon: Wallet, roles: ['admin', 'gudoomiye', 'zone_accountant'] },
        { id: 'tasks', label: 'Collector Tasks', icon: ClipboardList, roles: ['admin', 'collector', 'gudoomiye'] },
        { id: 'todays_collections', label: "Today's Collections", icon: Users, roles: ['cashier'] },
        { id: 'my_route_today', label: 'My Route Today', icon: MapIcon, roles: ['collector'] },
        { id: 'map', label: 'Operations Map', icon: MapIcon, roles: ['admin', 'collector', 'cashier', 'gudoomiye', 'zone_accountant'] }
      ]
    },

    {
      type: 'group',
      id: 'accounting',
      label: t('accounting'),
      icon: Receipt,
      roles: ['admin', 'cashier', 'collector', 'gudoomiye', 'zone_accountant'],
      items: [
        { id: 'billing', label: t('billing_invoices'), icon: Receipt, roles: ['admin', 'cashier', 'gudoomiye', 'zone_accountant'] },
        { id: 'payroll', label: 'Employee Payroll', icon: Wallet, roles: ['admin', 'cashier'] },
        { id: 'expenses', label: t('expense_tracker'), icon: Wallet, roles: ['admin', 'cashier'] },
        { id: 'debts', label: t('debts'), icon: ClipboardList, roles: ['admin', 'cashier', 'gudoomiye', 'zone_accountant'] },
        { id: 'cashout', label: 'Cashier Cashout', icon: Wallet, roles: ['admin', 'cashier', 'gudoomiye', 'zone_accountant'] },
        { id: 'reports', label: t('financial_reports'), icon: BarChart3, roles: ['admin'] },
      ]
    },
    {
      type: 'group',
      id: 'staff',
      label: t('staff_settings'),
      icon: Briefcase,
      roles: ['admin', 'collector'],
      items: [
        { id: 'hrm', label: t('hr_management'), icon: Briefcase, roles: ['admin'] },
        { id: 'onboard_staff', label: 'Onboard Staff', icon: Users, roles: ['admin'] },
        { id: 'attendance', label: t('attendance'), icon: Fingerprint, roles: ['admin', 'collector'] },
      ]
    },
    {
      type: 'item',
      id: 'inventory',
      label: t('inventory'),
      icon: Package,
      roles: ['admin']
    },
    {
      type: 'item',
      id: 'suppliers_assets',
      label: 'Suppliers & Assets',
      icon: Truck,
      roles: ['admin']
    },
    {
      type: 'item',
      id: 'documents',
      label: 'Documents',
      icon: FolderOpen,
      roles: ['admin']
    },
    {
      type: 'item',
      id: 'landing_mgmt',
      label: t('landing_page'), 
      icon: Globe, 
      roles: ['admin'] 
    },
    { 
      type: 'item',
      id: 'archive', 
      label: t('archive'), 
      icon: FolderOpen, 
      roles: ['admin'] 
    },
    {
      type: 'item',
      id: 'settings',
      label: t('system_settings'),
      icon: Settings,
      roles: ['admin', 'cashier']
    },
    {
      type: 'item',
      id: 'roles',
      label: 'Roles & Permissions',
      icon: Shield,
      roles: ['admin']
    },
    { 
      type: 'item',
      id: 'audit_logs', 
      label: 'Security Logs', 
      icon: FolderOpen, 
      roles: ['admin'] 
    },
  ];

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId) 
        : [...prev, groupId]
    );
  };

  const isGroupExpanded = (groupId) => expandedGroups.includes(groupId);

  const filteredMenuData = menuGroups
    .filter(group => group.roles.includes(currentUser?.role))
    .map(group => {
      if (group.type === 'group') {
        const filteredItems = group.items.filter(item => item.roles.includes(currentUser.role));
        if (filteredItems.length === 0) return null;
        return { ...group, items: filteredItems };
      }
      return group;
    }).filter(Boolean);

  const menuItemsForContent = menuGroups.reduce((acc, curr) => {
    if (curr.type === 'group') return [...acc, ...curr.items];
    return [...acc, curr];
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardView searchQuery={globalSearch} currentUser={currentUser} myTodayRoute={myTodayRoute} />;
      case 'zones': return <FleetView searchQuery={globalSearch} initialTab="zones" />;
      case 'fleet': return <FleetView searchQuery={globalSearch} initialTab="trucks" />;
      case 'customers': return <CustomerView searchQuery={globalSearch} currentUser={currentUser} />;
      case 'tasks': return <TaskView searchQuery={globalSearch} currentUser={currentUser} />;
      case 'map': return <MapView searchQuery={globalSearch} currentUser={currentUser} />;
      case 'todays_collections': return <TodaysCollectionsView searchQuery={globalSearch} currentUser={currentUser} onCollectPayment={(phone) => { setActiveTab('billing'); setBillingPrefillPhone(phone); }} />;
      case 'my_route_today': return <MyRouteTodayView searchQuery={globalSearch} />;
      case 'collector_assignments': return <CollectorAssignmentsView key="collector_assignments" searchQuery={globalSearch} />;
      case 'cashier_assignments': return <CollectorAssignmentsView key="cashier_assignments" searchQuery={globalSearch} initialTab="cashier" />;
      case 'billing': return <BillingView searchQuery={globalSearch} currentUser={currentUser} collectorTodayStats={collectorTodayStats} prefillCustomerPhone={billingPrefillPhone} onPrefillHandled={() => setBillingPrefillPhone(null)} />;
      case 'payroll': return <PayrollView />;
      case 'expenses': return <ExpenseView searchQuery={globalSearch} currentUser={currentUser} />;
      case 'inventory': return <InventoryView searchQuery={globalSearch} />;
      case 'suppliers_assets': return <SuppliersAssetsView searchQuery={globalSearch} />;
      case 'documents': return <DocumentsView searchQuery={globalSearch} />;
      case 'debts': return <DebtView searchQuery={globalSearch} />;
      case 'cashout': return <CashoutView currentUser={currentUser} />;
      case 'reports': return <ReportsView searchQuery={globalSearch} />;
      case 'hrm': return <HRMView searchQuery={globalSearch} />;
      case 'collectors': return <HRMView searchQuery={globalSearch} initialTab="Collectors" />;
      case 'onboard_staff': return <OnboardEmployeeView />;
      case 'attendance': return <AttendanceView searchQuery={globalSearch} currentUser={currentUser} />;
      case 'settings': return <SettingsView
         searchQuery={globalSearch}
         currentUser={currentUser} 
         onProfileUpdate={(updatedUser) => {
           setCurrentUser(updatedUser);
           localStorage.setItem('gurmadUser', JSON.stringify(updatedUser));
         }} 
      />;
      case 'roles': return <RolesView />;
      case 'landing_mgmt': return <LandingManagementView />;
      case 'archive': return <ArchiveView searchQuery={globalSearch} />;
      case 'complaints': return <ComplaintsView searchQuery={globalSearch} />;
      case 'audit_logs': return <AuditLogsView />;
      default: return <DashboardView currentUser={currentUser} collectorTodayStats={collectorTodayStats} />;
    }
  };

  if (!currentUser) {
    if (showLogin) {
      return (
        <LoginView 
          onLogin={(user) => {
            setCurrentUser(user);
            localStorage.setItem('gurmadUser', JSON.stringify(user));
          }} 
          onBack={() => setShowLogin(false)}
        />
      );
    }
    return <LandingView onLoginClick={() => setShowLogin(true)} />;
  }

  // Collector and Cashier accounts no longer land in the full desktop admin SPA — they get their
  // own lightweight mobile portal built around the exact same job they had a sidebar item for
  // (My Route Today / Today's Collections + Collect Payment + Cashout). The full app (sidebar,
  // every module) is now reserved for admin, gudoomiye (chairman), and zone_accountant.
  if (currentUser.role === 'collector' || currentUser.role === 'cashier') {
    return (
      <StaffPortalApp
        currentUser={currentUser}
        onLogout={() => { setCurrentUser(null); localStorage.removeItem('gurmadUser'); }}
      />
    );
  }

  return (
    <div className="app-container">
      <Toaster position="top-right" />
      
      {/* Mobile Sidebar Overlay */}
      {isMobile && isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            backdropFilter: 'blur(2px)'
          }}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`} style={{
        width: isSidebarOpen ? 'var(--sidebar-width)' : '80px',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative'
      }}>
        <div className="sidebar-header" style={{
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            backgroundColor: systemSettings.logo && !logoError ? 'white' : 'var(--gurmad-green)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            overflow: 'hidden',
            boxShadow: systemSettings.logo && !logoError ? 'var(--shadow-sm)' : 'none'
          }}>
            {systemSettings.logo && !logoError ? (
              <img src={`/api/uploads/${systemSettings.logo}`} alt="Logo" onError={() => setLogoError(true)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <Truck size={24} />
            )}
          </div>
          {isSidebarOpen && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#1e293b', lineHeight: 1 }}>{systemSettings.companyName}</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--gurmad-green)', letterSpacing: '1px' }}>{systemSettings.systemTitle}</span>
            </div>
          )}
        </div>

        <nav className="sidebar-nav" style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredMenuData.map((node) => (
              <li key={node.id}>
                {node.type === 'item' ? (
                  <button
                    onClick={() => {
                      setActiveTab(node.id);
                      if (isMobile) setIsSidebarOpen(false);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: isSidebarOpen ? '12px' : '0',
                      justifyContent: isSidebarOpen ? 'flex-start' : 'center',
                      padding: '0.75rem',
                      borderRadius: '10px',
                      color: activeTab === node.id ? 'white' : 'var(--text-muted)',
                      backgroundColor: activeTab === node.id ? 'var(--gurmad-green)' : 'transparent',
                      transition: 'all 0.2s ease',
                      marginBottom: '2px'
                    }}
                    className="sidebar-item"
                  >
                    <node.icon size={20} />
                    {isSidebarOpen && <span style={{ fontWeight: 500 }}>{node.label}</span>}
                  </button>
                ) : (
                  <div>
                    <button
                      onClick={() => toggleGroup(node.id)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: isSidebarOpen ? '12px' : '0',
                        justifyContent: isSidebarOpen ? 'space-between' : 'center',
                        padding: '0.75rem',
                        borderRadius: '10px',
                        color: node.items.some(i => i.id === activeTab) ? 'var(--gurmad-green)' : 'var(--text-muted)',
                        backgroundColor: 'transparent',
                        transition: 'all 0.2s ease',
                        marginBottom: '2px'
                      }}
                      className="sidebar-group-btn"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <node.icon size={20} />
                        {isSidebarOpen && <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{node.label}</span>}
                      </div>
                      {isSidebarOpen && (
                        <ChevronRight 
                          size={14} 
                          style={{ 
                            transform: isGroupExpanded(node.id) ? 'rotate(90deg)' : 'rotate(0)',
                            transition: 'transform 0.2s ease'
                          }} 
                        />
                      )}
                    </button>
                    
                    {isGroupExpanded(node.id) && isSidebarOpen && (
                      <ul style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px', marginBottom: '8px' }}>
                        {node.items.map(subItem => (
                          <li key={subItem.id}>
                            <button
                              onClick={() => {
                                setActiveTab(subItem.id);
                                if (isMobile) setIsSidebarOpen(false);
                              }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '0.6rem 1rem',
                                borderRadius: '8px',
                                color: activeTab === subItem.id ? 'var(--gurmad-green)' : 'var(--text-muted)',
                                backgroundColor: activeTab === subItem.id ? '#f0fdf4' : 'transparent',
                                fontSize: '0.85rem',
                                transition: 'all 0.2s ease'
                              }}
                              className="sidebar-sub-item"
                            >
                              <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: activeTab === subItem.id ? 'var(--gurmad-green)' : 'currentColor' }} />
                              <span style={{ fontWeight: activeTab === subItem.id ? 600 : 400 }}>{subItem.label}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          
          {/* Today's Collector Performance Widget (Admin only) */}
          {isSidebarOpen && currentUser?.role === 'admin' && (
            <div
              onClick={() => {
                setActiveTab('tasks');
                if (isMobile) setIsSidebarOpen(false);
              }}
              style={{
                marginTop: '2rem',
                padding: '1rem',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
              title="Guji si aad u aragto shaqooyinka Collector-ka"
            >
               <h4 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                 <BarChart3 size={12} /> Today's Performance
               </h4>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                 {collectorTodayStats && collectorTodayStats.length > 0 ? (
                   collectorTodayStats.map(c => (
                      <div key={c.collector} style={{ padding: '8px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #f1f5f9', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                         <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--gurmad-green)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.collector}</div>
                         <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', fontWeight: 500 }}>
                            <span>💰 ${c.total_collected.toFixed(2)}</span>
                            <span>🏠 {c.houses_collected} done</span>
                         </div>
                      </div>
                   ))
                 ) : (
                   <div style={{ padding: '8px', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', fontStyle: 'italic' }}>
                     No collections today yet.
                   </div>
                 )}
               </div>
            </div>
          )}

          {/* Cashier's Paired-Collector Customer List - who to go collect money from */}
        </nav>

        <div className="sidebar-footer" style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => {
              setCurrentUser(null);
              localStorage.removeItem('gurmadUser');
              toast.success('Logged out successfully');
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '0.75rem',
              color: '#ef4444',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer'
          }}>
            <LogOut size={22} />
            {isSidebarOpen && <span style={{ fontWeight: 500 }}>{t('logout')}</span>}
          </button>
        </div>
        
        {/* Toggle Button (Desktop Only) */}
        {!isMobile && (
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              position: 'absolute',
              right: '-12px',
              top: '80px',
              backgroundColor: 'white',
              border: '1px solid var(--border-color)',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)',
              zIndex: 10,
              cursor: 'pointer'
            }}
          >
            <ChevronRight size={14} style={{ transform: isSidebarOpen ? 'rotate(180deg)' : 'rotate(0)' }} />
          </button>
        )}
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {isMobile && (
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                style={{
                  padding: '8px',
                  backgroundColor: 'white',
                  borderRadius: '10px',
                  boxShadow: 'var(--shadow-sm)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <Menu size={24} />
              </button>
            )}
            <div className={isMobile ? 'hide-mobile' : ''}>
              <h1 style={{ fontSize: isMobile ? '1.25rem' : '1.75rem', fontWeight: 700 }}>
                {menuItemsForContent.find(i => i.id === activeTab)?.label}
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'capitalize' }}>
                {t('welcome')}, {currentUser?.role}.
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {!isMobile && (
              <div className="search-container" style={{ position: 'relative' }}>
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  width: '300px'
                }}>
                  <Search size={18} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
                  <input 
                    type="text" 
                    placeholder={t('search_placeholder')}
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.9rem' }} 
                  />
                  {isSearching && <div className="spin" style={{ width: '14px', height: '14px', border: '2px solid #e2e8f0', borderTopColor: 'var(--gurmad-green)', borderRadius: '50%' }}></div>}
                </div>

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <div className="search-dropdown">
                    {/* Customers */}
                    {searchResults.filter(r => r.type === 'customer').length > 0 && (
                      <>
                        <div className="search-category-label">Customers</div>
                        {searchResults.filter(r => r.type === 'customer').map(r => (
                          <div key={`c-${r.id}`} className="search-result-item" onClick={() => handleResultClick(r)}>
                            <Users size={16} color="var(--gurmad-green)" />
                            <div>
                               <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.name}</div>
                               <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.phone}</div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    
                    {/* Employees */}
                    {searchResults.filter(r => r.type === 'employee').length > 0 && (
                      <>
                        <div className="search-category-label">Staff / Employees</div>
                        {searchResults.filter(r => r.type === 'employee').map(r => (
                          <div key={`e-${r.id}`} className="search-result-item" onClick={() => handleResultClick(r)}>
                            <Briefcase size={16} color="#3b82f6" />
                            <div>
                               <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.name}</div>
                               <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.subtitle}</div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Invoices */}
                    {searchResults.filter(r => r.type === 'invoice').length > 0 && (
                      <>
                        <div className="search-category-label">Invoices</div>
                        {searchResults.filter(r => r.type === 'invoice').map(r => (
                          <div key={`i-${r.id}`} className="search-result-item" onClick={() => handleResultClick(r)}>
                            <Receipt size={16} color="var(--gurmad-green)" />
                            <div>
                               <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.name}</div>
                               <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.subtitle}</div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Tasks */}
                    {searchResults.filter(r => r.type === 'task').length > 0 && (
                      <>
                        <div className="search-category-label">Tasks / Routes</div>
                        {searchResults.filter(r => r.type === 'task').map(r => (
                          <div key={`t-${r.id}`} className="search-result-item" onClick={() => handleResultClick(r)}>
                            <Truck size={16} color="#f59e0b" />
                            <div>
                               <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.name}</div>
                               <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.subtitle}</div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Theme Toggle */}
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="glass" 
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'pointer',
                color: theme === 'light' ? '#64748b' : '#fbbf24'
              }}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            {/* Language Switcher */}
            <div style={{ display: 'flex', gap: '8px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
              <button 
                onClick={() => setLanguage('so')}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  backgroundColor: currentLanguage === 'so' ? 'white' : 'transparent',
                  boxShadow: currentLanguage === 'so' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.2s'
                }}
                title="Somali"
              >
                🇸🇴
              </button>
              <button 
                onClick={() => setLanguage('en')}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  backgroundColor: currentLanguage === 'en' ? 'white' : 'transparent',
                  boxShadow: currentLanguage === 'en' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.2s'
                }}
                title="English"
              >
                🇺🇸
              </button>
            </div>
            
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="glass" 
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <Bell size={20} />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '10px',
                    height: '10px',
                    backgroundColor: '#ef4444',
                    borderRadius: '50%',
                    border: '2px solid white'
                  }}></span>
                )}
              </button>
              
              {showNotifications && (
                <div style={{
                  position: 'absolute',
                  top: '55px',
                  right: 0,
                  width: '320px',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-lg)',
                  border: '1px solid var(--border-color)',
                  zIndex: 50,
                  maxHeight: '400px',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', fontWeight: 700, backgroundColor: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {t('notifications')}
                    {notifications.filter(n => !n.is_read).length > 0 && (
                       <button onClick={async () => {
                         await api.markAllNotificationsRead(currentUser.id);
                         setNotifications(notifications.map(n => ({...n, is_read: true})));
                       }} style={{ fontSize: '0.75rem', color: 'var(--gurmad-green)', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600 }}>{t('mark_all_read')}</button>
                    )}
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        {t('no_notifications')}
                      </div>
                    ) : notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={async () => {
                          if (!n.is_read) {
                            await api.markNotificationRead(n.id);
                            setNotifications(notifications.map(xn => xn.id === n.id ? {...xn, is_read: true} : xn));
                          }
                          setSelectedNotification(n);
                          setShowNotifications(false);
                        }}
                        style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: n.is_read ? 'white' : '#f0fdf4', cursor: 'pointer', transition: 'background 0.2s' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <strong style={{ fontSize: '0.85rem', color: n.is_read ? 'var(--text-muted)' : '#1e293b' }}>{n.title}</strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>{n.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div style={{ position: 'relative' }}>
              <div onClick={() => setShowProfileMenu(!showProfileMenu)} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{currentUser.full_name || currentUser.username}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{currentUser.role}</div>
                </div>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: '#cbd5e1',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-color)'
                }}>
                  <img
                    src={currentUser.profile_image && !avatarError ? `/api/uploads/${currentUser.profile_image}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.full_name || currentUser.username)}&background=3FAE2A&color=fff&size=128`}
                    alt="User"
                    onError={() => setAvatarError(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              </div>
              
              {showProfileMenu && (
                <div style={{
                  position: 'absolute',
                  top: '55px',
                  right: 0,
                  width: '200px',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-lg)',
                  border: '1px solid var(--border-color)',
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '8px'
                }}>
                  <button 
                    onClick={() => {
                      setActiveTab('settings');
                      setShowProfileMenu(false);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
                      border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                      borderRadius: '8px', color: '#1e293b', fontWeight: 500, textAlign: 'left'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Settings size={18} /> My Profile & Settings
                  </button>
                  <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }}></div>
                  <button 
                    onClick={() => {
                      setCurrentUser(null);
                      localStorage.removeItem('gurmadUser');
                      // Reset the tab so the next login (possibly a different role) always
                      // lands on Dashboard, instead of whatever page the previous user was on —
                      // that page might not even be in the new user's sidebar/permissions.
                      setActiveTab('dashboard');
                      toast.success('Logged out successfully');
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
                      border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                      borderRadius: '8px', color: '#ef4444', fontWeight: 500, textAlign: 'left'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <LogOut size={18} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {renderContent()}
      </main>
      
      {/* Notification Modal */}
      {selectedNotification && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'white', width: '90%', maxWidth: '500px',
            borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                  <Bell size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>{selectedNotification.title}</h3>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{new Date(selectedNotification.created_at).toLocaleString()}</span>
                </div>
              </div>
              <button onClick={() => setSelectedNotification(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', borderRadius: '50%' }} onMouseEnter={e => e.currentTarget.style.backgroundColor='#f1f5f9'} onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'}>
                <X size={24} color="#94a3b8" />
              </button>
            </div>
            
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', color: '#334155', fontSize: '1rem', lineHeight: '1.6', marginBottom: '24px' }}>
              {selectedNotification.message}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setSelectedNotification(null)}
                style={{ padding: '10px 20px', backgroundColor: 'var(--gurmad-green)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
              >
                Close / Xidh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Chat Floating Button */}
      <ChatWidget currentUser={currentUser} />
    </div>
  );
};

export default App;
