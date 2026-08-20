import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { 
  Users, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  Activity,
  Truck,
  Wallet,
  AlertTriangle,
  FileText,
  MessageSquare,
  Calendar,
  CreditCard,
  PlusCircle,
  FilePlus,
  Briefcase,
  MapPin,
  ChevronDown,
  ChevronUp,
  Phone,
  Home
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

const formatHouseNo = (raw) => {
  if (!raw) return 'C-----';
  const stripped = String(raw).replace(/^[hc]-?/i, '');
  return `C-${stripped}`;
};

const DashboardView = ({ currentUser, collectorTodayStats, myTodayRoute = [] }) => {
  const { t } = useLanguage();
  const [dbStats, setDbStats] = useState({ revenue: 0, customerCount: 0, tasksCompleted: 0, totalExpenses: 0 });
  const [chartData, setChartData] = useState([]);
  const [settings, setSettings] = useState({ exchange_rate: '8500' });
  const [extendedStats, setExtendedStats] = useState(null);
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [zonePerformance, setZonePerformance] = useState([]);
  const [expandedZone, setExpandedZone] = useState(null);

  const canSeeZones = currentUser?.role === 'admin' || currentUser?.role === 'gudoomiye' || currentUser?.role === 'zone_accountant';

  useEffect(() => {
    const needsInvoices = currentUser?.role === 'admin' || currentUser?.role === 'cashier' || currentUser?.role === 'gudoomiye' || currentUser?.role === 'zone_accountant';
    // The backend now restricts /api/dashboard/extended to admin/gudoomiye/zone_accountant (it
    // carries company-/zone-wide financial and debtor detail never rendered for cashier/
    // collector below) — only requesting it for those roles keeps the leaked data from ever
    // reaching a cashier/collector's network tab or React state in the first place, rather than
    // relying solely on the JSX gates further down to hide it.
    const canSeeExtended = currentUser?.role === 'admin' || currentUser?.role === 'gudoomiye' || currentUser?.role === 'zone_accountant';
    Promise.all([
      api.getStats(),
      api.getStatsHistory(),
      api.getSettings(),
      canSeeExtended ? api.getExtendedDashboardStats() : Promise.resolve(null),
      needsInvoices ? api.getInvoices() : Promise.resolve([]),
      canSeeZones ? api.getZonePerformance().catch(() => []) : Promise.resolve([])
    ])
      .then(([stats, history, sData, extended, invs, zonePerf]) => {
        setDbStats(stats);
        setChartData(history);
        setSettings(sData);
        setExtendedStats(extended);
        setInvoices(invs || []);
        setZonePerformance(zonePerf || []);
      })
      .catch(err => {
        console.error("Error fetching stats:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [currentUser]);

  const rate = parseFloat(settings.exchange_rate || '8500');

  const formatValue = (val) => {
    if (currency === 'SLSH') {
      return (val * rate).toLocaleString() + ' SLSH';
    }
    return '$' + val.toLocaleString();
  };

  const todaysTransactions = React.useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    return invoices.filter(inv => {
      if (currentUser?.role === 'collector') {
        const invCollector = (inv.collector_name || '').toLowerCase().trim();
        const currName1 = (currentUser.full_name || '').toLowerCase().trim();
        const currName2 = (currentUser.username || '').toLowerCase().trim();
        if (invCollector !== currName1 && invCollector !== currName2) return false;
      }

      if (selectedGroup) {
        const invGroup = (inv.invoice_zone || '').toLowerCase().trim();
        if (!invGroup.includes(selectedGroup.toLowerCase().trim())) return false;
      }

      if (!inv.created_at) return false;
      const invDate = new Date(inv.created_at).toISOString().split('T')[0];
      return invDate === today;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [invoices, currentUser, selectedGroup]);

  const todaysCollectedTotal = todaysTransactions.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
  const pendingInvoicesCount = invoices.filter(inv => inv.status === 'Unpaid').length;

  // Define stats based on role
  const getStats = () => {
    if (currentUser?.role === 'admin') {
      return [
        { label: t('total_revenue'), value: formatValue(dbStats.revenue), sub: '+12.5%', icon: DollarSign, color: 'var(--gurmad-green)', bg: '#dcfce7' },
        { label: t('active_customers'), value: dbStats.customerCount.toString(), sub: '+3.2%', icon: Users, color: 'var(--gurmad-orange)', bg: '#fef3c7' },
        { label: t('tasks_completed'), value: dbStats.tasksCompleted.toString(), sub: `94% ${t('optimal')}`, icon: CheckCircle2, color: '#3b82f6', bg: '#dbeafe' },
        { label: t('total_expenses'), value: formatValue(dbStats.totalExpenses), sub: t('optimal'), icon: Clock, color: '#f97316', bg: '#ffedd5' },
      ];
    } else if (currentUser?.role === 'cashier') {
      // Zone-scoped: the backend now restricts a cashier's /api/stats to whichever zone(s)/
      // collector(s) they're assigned (Cashier Assignments) — same scoping already applied to
      // their customers/invoices lists — so this is their own zone's picture, not the whole
      // company's. "Total Expenses" is swapped for "Pending Customers" (zonePendingCustomers)
      // since expenses have no per-zone attribution in the schema and would always read $0 here.
      return [
        { label: 'Zone Revenue', value: formatValue(dbStats.revenue), sub: 'Your zone', icon: DollarSign, color: 'var(--gurmad-green)', bg: '#dcfce7' },
        { label: t('daily_collections'), value: formatValue(todaysCollectedTotal), sub: 'Today', icon: Activity, color: '#3b82f6', bg: '#dbeafe' },
        { label: 'Pending Customers', value: (dbStats.zonePendingCustomers || 0).toString(), sub: 'Unpaid in your zone', icon: Wallet, color: '#ef4444', bg: '#fee2e2' },
        { label: 'Pending Invoices', value: pendingInvoicesCount.toString(), sub: pendingInvoicesCount > 0 ? 'Action required' : 'All clear', icon: Clock, color: '#f97316', bg: '#ffedd5' },
      ];
    } else if (currentUser?.role === 'gudoomiye' || currentUser?.role === 'zone_accountant') {
      // Zone Accountant gets the same zone-scoped financial view as Gudoomiye/Chairman — the
      // backend already scopes /api/stats identically for both roles — but the page below
      // renders no action buttons for zone_accountant since it's a view-only role.
      return [
        { label: 'Zone Revenue', value: formatValue(dbStats.revenue), sub: currentUser.zone || '', icon: DollarSign, color: 'var(--gurmad-green)', bg: '#dcfce7' },
        { label: t('active_customers'), value: dbStats.customerCount.toString(), sub: currentUser.zone || '', icon: Users, color: 'var(--gurmad-orange)', bg: '#fef3c7' },
        { label: t('tasks_completed'), value: dbStats.tasksCompleted.toString(), sub: currentUser.zone || '', icon: CheckCircle2, color: '#3b82f6', bg: '#dbeafe' },
        { label: 'Pending Payments', value: (dbStats.zonePendingCustomers || 0).toString(), sub: currentUser.zone || '', icon: Clock, color: '#f97316', bg: '#ffedd5' },
      ];
    } else { // collector
      const collectedToday = myTodayRoute.filter(c => c.collected).length;
      const pendingToday = myTodayRoute.length - collectedToday;
      const routeZone = myTodayRoute[0]?.zone || 'None';
      return [
        { label: t('tasks_completed'), value: dbStats.tasksCompleted.toString(), sub: 'This month', icon: CheckCircle2, color: 'var(--gurmad-green)', bg: '#dcfce7' },
        { label: 'My Collections', value: collectedToday.toString(), sub: 'Today', icon: Activity, color: '#3b82f6', bg: '#dbeafe' },
        { label: 'Active Route', value: myTodayRoute.length > 0 ? routeZone : 'No route today', sub: myTodayRoute.length > 0 ? 'In progress' : '', icon: TrendingUp, color: 'var(--gurmad-orange)', bg: '#fef3c7' },
        { label: 'Pending Stops', value: pendingToday.toString(), sub: 'Today', icon: Clock, color: '#8b5cf6', bg: '#f3e8ff' },
      ];
    }
  };

  const stats = getStats();

  if (loading) return <div className="card glass">{t('loading_stats')}</div>;

  const processedChartData = chartData.map(d => ({
    ...d,
    revenue: currency === 'SLSH' ? d.revenue * rate : d.revenue,
    expenses: currency === 'SLSH' ? d.expenses * rate : d.expenses
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Welcome Header */}
      <div style={{ 
        padding: '2rem', 
        borderRadius: '24px', 
        background: 'linear-gradient(135deg, #3FAE2A 0%, #2D8B1B 100%)', 
        color: 'white',
        boxShadow: '0 10px 25px -5px rgba(63, 174, 42, 0.3)'
      }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          {t('welcome_back')}, {currentUser?.full_name || currentUser?.username}!
        </h1>
        <p style={{ opacity: 0.9, fontSize: '1.1rem' }}>
          {currentUser?.role === 'admin' && 'Here is what\'s happening with the system today.'}
          {currentUser?.role === 'cashier' && 'Manage your financial logs and invoices efficiently.'}
          {currentUser?.role === 'collector' && 'Your routes and collections are waiting. Stay safe!'}
        </p>
      </div>

      {/* Header with Currency Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          {currentUser?.role === 'admin' ? t('system_overview') : 
           currentUser?.role === 'cashier' ? 'Financial Overview' : 'My Performance'}
        </h2>
        {currentUser?.role !== 'collector' && (
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
            <button 
              onClick={() => setCurrency('USD')}
              style={{ 
                padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                backgroundColor: currency === 'USD' ? 'white' : 'transparent',
                fontWeight: 600, boxShadow: currency === 'USD' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                color: currency === 'USD' ? 'var(--text-main)' : 'var(--text-muted)'
              }}
            >
              USD ($)
            </button>
            <button 
              onClick={() => setCurrency('SLSH')}
              style={{ 
                padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                backgroundColor: currency === 'SLSH' ? 'white' : 'transparent',
                fontWeight: 600, boxShadow: currency === 'SLSH' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                color: currency === 'SLSH' ? 'var(--text-main)' : 'var(--text-muted)'
              }}
            >
              SLSH
            </button>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: '1.5rem' 
      }}>
        {stats.map((stat, i) => (
          <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ 
              width: '56px', 
              height: '56px', 
              borderRadius: '16px', 
              backgroundColor: stat.bg, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: stat.color
            }}>
              <stat.icon size={28} />
            </div>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>{stat.label}</p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '2px 0' }}>{stat.value}</h3>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: stat.sub.startsWith('+') ? '#166534' : 'var(--text-muted)' }}>
                {stat.sub} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{t('this_month')}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Cashier Stats Table (money collected, broken down by which collector it was for) */}
      {(currentUser?.role === 'admin' || currentUser?.role === 'cashier' || currentUser?.role === 'gudoomiye' || currentUser?.role === 'zone_accountant') && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
               <Users size={18} color="var(--gurmad-green)" />
               Today's Cashier Transactions
            </h3>
            {currentUser?.role === 'admin' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Filter by Group:</span>
                <input 
                  type="text" 
                  placeholder="E.g. Group 1" 
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem', outline: 'none' }}
                />
              </div>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.8rem', color: '#64748b' }}>Customer</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.8rem', color: '#64748b' }}>Phone</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.8rem', color: '#64748b' }}>House / Zone</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.8rem', color: '#64748b' }}>Collector</th>
                  <th style={{ textAlign: 'right', padding: '12px', fontSize: '0.8rem', color: '#64748b' }}>Amount</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.8rem', color: '#64748b' }}>Method</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.8rem', color: '#64748b' }}>Date / Time</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.8rem', color: '#64748b' }}>Cashier</th>
                </tr>
              </thead>
              <tbody>
                {todaysTransactions.length > 0 ? todaysTransactions.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{inv.customer_name}</td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{inv.customer_phone}</td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{formatHouseNo(inv.invoice_house_no)} &middot; {inv.invoice_zone || inv.zone || 'N/A'}</td>
                    <td style={{ padding: '12px', color: '#0ea5e9', fontWeight: 600 }}>{inv.collector_name || 'Unassigned'}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                      ${parseFloat(inv.amount).toFixed(2)}
                      {parseFloat(inv.slsh_amount) > 0 && <div style={{ fontSize: '0.75rem', color: '#f97316' }}>{parseFloat(inv.slsh_amount).toLocaleString()} SLSH</div>}
                    </td>
                    <td style={{ padding: '12px' }}>{inv.payment_method}</td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(inv.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#059669' }}>{inv.cashier_name || 'System'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="8" style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>No transactions recorded today yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Zone Performance — per-zone customers, who's been served today, and today's revenue,
          with a click-to-expand drill-down into each zone's individual customers. */}
      {canSeeZones && zonePerformance.length > 0 && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
            <MapPin size={18} color="var(--gurmad-green)" /> Zone Performance
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {zonePerformance.map(z => {
              const isOpen = expandedZone === z.id;
              const pct = z.customer_count > 0 ? Math.round((z.served_today / z.customer_count) * 100) : 0;
              return (
                <div key={z.id} style={{ border: '1px solid #f1f5f9', borderRadius: '16px', overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedZone(isOpen ? null : z.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                      padding: '1rem 1.25rem', background: isOpen ? '#f8fafc' : 'white', border: 'none', cursor: 'pointer', textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '160px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <MapPin size={18} color="var(--gurmad-green)" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{z.name}</div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{z.customer_count} customers</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem', flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Served Today</div>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{z.served_today} / {z.customer_count} <span style={{ fontSize: '0.78rem', fontWeight: 700, color: pct >= 50 ? '#15803d' : '#b45309' }}>({pct}%)</span></div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Revenue Today</div>
                        <div style={{ fontWeight: 800, color: 'var(--gurmad-green)' }}>{formatValue(z.revenue_today)}</div>
                      </div>
                      {isOpen ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: '1px solid #f1f5f9', overflowX: 'auto' }}>
                      {z.customers.length === 0 ? (
                        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No customers in this zone yet.</div>
                      ) : (
                        <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8fafc' }}>
                              <th style={{ textAlign: 'left', padding: '10px 1.25rem', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>CUSTOMER</th>
                              <th style={{ textAlign: 'left', padding: '10px', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>PHONE</th>
                              <th style={{ textAlign: 'left', padding: '10px', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>COLLECTOR</th>
                              <th style={{ textAlign: 'left', padding: '10px', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>PAYMENT</th>
                              <th style={{ textAlign: 'left', padding: '10px 1.25rem', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>SERVED TODAY</th>
                            </tr>
                          </thead>
                          <tbody>
                            {z.customers.map(c => (
                              <tr key={c.id} style={{ borderTop: '1px solid #f8fafc' }}>
                                <td style={{ padding: '10px 1.25rem', fontWeight: 700 }}>
                                  {c.name}
                                  {c.house_no && <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>House {c.house_no}</div>}
                                </td>
                                <td style={{ padding: '10px', color: '#64748b' }}>{c.phone || '—'}</td>
                                <td style={{ padding: '10px', color: '#0ea5e9', fontWeight: 600 }}>{c.collector_name || 'Unassigned'}</td>
                                <td style={{ padding: '10px' }}>
                                  <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 800, backgroundColor: c.status === 'Paid' ? '#dcfce7' : '#fef2f2', color: c.status === 'Paid' ? '#15803d' : '#b91c1c' }}>
                                    {c.status || 'Unpaid'}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 1.25rem' }}>
                                  {c.collected_today ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#15803d', fontWeight: 700, fontSize: '0.8rem' }}><CheckCircle2 size={13} /> Yes</span>
                                  ) : (
                                    <span style={{ color: '#cbd5e1', fontWeight: 600, fontSize: '0.8rem' }}>—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions Bar — zone_accountant is view-only, no create/log actions. "Assign Task"
          is admin/gudoomiye-only (task creation) — a cashier's role_permissions only grant them
          tasks.view, so showing it here was offering an action they don't actually have the
          right to do. Each button dispatches a 'switchTab' event — the desktop App.jsx listens
          for it directly; the Staff Portal (cashier/collector's mobile app) listens for the same
          event and maps it onto its own tab state, so these work in both places now instead of
          silently doing nothing in the portal. */}
      {currentUser?.role !== 'collector' && currentUser?.role !== 'zone_accountant' && (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
           <button onClick={() => window.dispatchEvent(new CustomEvent('switchTab', { detail: 'customers' }))} style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#0f172a', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
             <PlusCircle size={18} color="var(--gurmad-green)" /> Add Customer
           </button>
           <button onClick={() => window.dispatchEvent(new CustomEvent('switchTab', { detail: 'billing' }))} style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#0f172a', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
             <FilePlus size={18} color="#3b82f6" /> Create Invoice
           </button>
           {currentUser?.role !== 'cashier' && (
             <button onClick={() => window.dispatchEvent(new CustomEvent('switchTab', { detail: 'tasks' }))} style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#0f172a', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
               <Briefcase size={18} color="#f97316" /> Assign Task
             </button>
           )}
           <button onClick={() => window.dispatchEvent(new CustomEvent('switchTab', { detail: 'expenses' }))} style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#0f172a', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
             <Wallet size={18} color="#ef4444" /> Log Expense
           </button>
        </div>
      )}

      {/* Extended Stats Row — company-wide (today's revenue/expenses, outstanding debts, staff
          present) with no per-zone attribution possible in the schema, so a cashier — scoped to
          only their own zone everywhere else on this page — doesn't get it either. */}
      {currentUser?.role !== 'collector' && currentUser?.role !== 'cashier' && extendedStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
           <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '4px solid var(--gurmad-green)' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>TODAY'S REVENUE</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{formatValue(extendedStats.dailyCashflow.revenue)}</span>
           </div>
           <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '4px solid #ef4444' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>TODAY'S EXPENSES</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{formatValue(extendedStats.dailyCashflow.expenses)}</span>
           </div>
           <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '4px solid #f97316' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>OUTSTANDING DEBTS</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{formatValue(extendedStats.outstandingDebts.total)}</span>
           </div>
           <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '4px solid #3b82f6' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>STAFF PRESENT</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{extendedStats.employeeAttendance.clockedIn} / {extendedStats.employeeAttendance.total}</span>
           </div>
        </div>
      )}

      {/* Charts Section - Role Based. Revenue/expense history has no per-zone attribution in the
          schema (same reason the Extended Stats Row is hidden above), so it's company-wide —
          skipped for cashier for the same reason; their zone-scoped picture is the stat cards
          above and the Today's Cashier Transactions table below, both already correctly scoped. */}
      {currentUser?.role === 'cashier' ? null : currentUser?.role !== 'collector' ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: window.innerWidth <= 1024 ? '1fr' : '2fr 1fr',
          gap: '1.5rem'
        }}>
          <div className="card" style={{ padding: '1.5rem 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 700 }}>{t('revenue_vs_expenses')} ({currency})</h3>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--gurmad-green)' }}></span>
                   <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Revenue</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--gurmad-orange)' }}></span>
                   <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Expenses</span>
                </div>
              </div>
            </div>
            <div style={{ height: 350, width: '100%', position: 'relative' }}>
              {processedChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={processedChartData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--gurmad-green)" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="var(--gurmad-green)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="idExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--gurmad-orange)" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="var(--gurmad-orange)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-main)' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="var(--gurmad-green)" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    <Area type="monotone" dataKey="expenses" stroke="var(--gurmad-orange)" strokeWidth={3} fillOpacity={1} fill="url(#idExp)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  Loading chart data...
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
             <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>Monthly Growth</h3>
             <div style={{ height: 280, width: '100%' }}>
                {processedChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={processedChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <YAxis axisLine={false} tickLine={false} hide />
                        <Tooltip 
                          cursor={{fill: '#f8fafc'}}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-main)' }}
                        />
                        <Bar dataKey="revenue" fill="var(--gurmad-green)" radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="expenses" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    Loading data...
                  </div>
                )}
             </div>
              <div style={{ marginTop: '1.5rem', padding: '1.25rem', backgroundColor: '#f0fdf4', borderRadius: '16px', border: '1px solid #dcfce7' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534' }}>MONTHLY PROFIT</div>
                   <div style={{ padding: '4px 8px', backgroundColor: '#166534', color: '#fff', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>+18.4%</div>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#166534', marginTop: '4px' }}>
                   {formatValue(dbStats.revenue - dbStats.totalExpenses)}
                </div>
             </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
           <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Collection Progress</h3>
              <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <div style={{ position: 'relative', width: '150px', height: '150px' }}>
                    <svg width="150" height="150" viewBox="0 0 150 150">
                       <circle cx="75" cy="75" r="65" fill="none" stroke="#f1f5f9" strokeWidth="15" />
                       <circle cx="75" cy="75" r="65" fill="none" stroke="var(--gurmad-green)" strokeWidth="15" strokeDasharray="408" strokeDashoffset="100" strokeLinecap="round" transform="rotate(-90 75 75)" />
                    </svg>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                       <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>75%</div>
                       <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DONE</div>
                    </div>
                 </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                 You have collected 15 out of 20 houses today.
              </div>
           </div>
           <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontWeight: 700 }}>Quick Actions</h3>
              <button style={{ padding: '1rem', borderRadius: '12px', border: 'none', backgroundColor: '#f0fdf4', color: '#166534', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                 <Truck size={20} /> View Today's Route
              </button>
              <button style={{ padding: '1rem', borderRadius: '12px', border: 'none', backgroundColor: '#eff6ff', color: '#1e40af', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                 <Activity size={20} /> Log Fuel Consumption
              </button>
              <button style={{ padding: '1rem', borderRadius: '12px', border: 'none', backgroundColor: '#fff7ed', color: '#9a3412', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                 <Users size={20} /> View Team Chat
              </button>
           </div>
        </div>
      )}

      {/* Extended Dashboard Widgets — company-wide (recent activities across every zone, top
          debtors company-wide, total pending complaints company-wide), so kept out of the
          cashier's zone-scoped view for the same reason as the Extended Stats Row above. */}
      {currentUser?.role !== 'collector' && currentUser?.role !== 'cashier' && extendedStats && (
        <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth <= 1024 ? '1fr' : '1fr 1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
           
           {/* Recent Activities Panel */}
           <div className="card" style={{ padding: '1.5rem', gridColumn: window.innerWidth <= 1024 ? 'span 1' : 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                 <h3 style={{ fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={20} color="var(--gurmad-green)" /> Recent Activities
                 </h3>
                 <button style={{ fontSize: '0.8rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View All</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                 {extendedStats.recentActivities.length > 0 ? extendedStats.recentActivities.map((act, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                       <div style={{ 
                          width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: act.type === 'invoice' ? '#dcfce7' : act.type === 'customer' ? '#dbeafe' : '#fee2e2',
                          color: act.type === 'invoice' ? '#166534' : act.type === 'customer' ? '#1e40af' : '#991b1b'
                       }}>
                          {act.type === 'invoice' ? <CreditCard size={18} /> : act.type === 'customer' ? <Users size={18} /> : <AlertTriangle size={18} />}
                       </div>
                       <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>{act.description}</p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>{new Date(act.created_at).toLocaleString()}</p>
                       </div>
                    </div>
                 )) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No recent activities found.</div>
                 )}
              </div>
           </div>

           {/* Top Debtors Panel */}
           <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                 <h3 style={{ fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={20} color="#f97316" /> Top Debtors
                 </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                 {extendedStats.outstandingDebts.topDebtors.length > 0 ? extendedStats.outstandingDebts.topDebtors.map((debtor, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: idx !== extendedStats.outstandingDebts.topDebtors.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                       <div>
                          <p style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{debtor.debtor_name}</p>
                          <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>{debtor.phone}</p>
                       </div>
                       <div style={{ fontWeight: 800, color: '#ef4444' }}>
                          {formatValue(debtor.amount)}
                       </div>
                    </div>
                 )) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No outstanding debts!</div>
                 )}
              </div>
              
              {/* Complaints Widget inside this column to save space */}
              <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', backgroundColor: extendedStats.pendingComplaints > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: '12px', border: `1px solid ${extendedStats.pendingComplaints > 0 ? '#fecaca' : '#dcfce7'}` }}>
                    <MessageSquare size={24} color={extendedStats.pendingComplaints > 0 ? '#ef4444' : '#166534'} />
                    <div>
                       <p style={{ margin: 0, fontWeight: 800, color: extendedStats.pendingComplaints > 0 ? '#991b1b' : '#166534' }}>{extendedStats.pendingComplaints} Pending</p>
                       <p style={{ margin: 0, fontSize: '0.8rem', color: extendedStats.pendingComplaints > 0 ? '#b91c1c' : '#15803d' }}>Customer Complaints</p>
                    </div>
                 </div>
              </div>
           </div>

        </div>
      )}
    </div>
  );
};

export default DashboardView;
