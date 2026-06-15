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
  Wallet
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

const data = [
  { name: 'Mon', revenue: 4200, expenses: 2400 },
  { name: 'Tue', revenue: 3800, expenses: 1800 },
  { name: 'Wed', revenue: 5100, expenses: 3100 },
  { name: 'Thu', revenue: 4800, expenses: 2200 },
  { name: 'Fri', revenue: 6200, expenses: 2800 },
  { name: 'Sat', revenue: 5400, expenses: 2000 },
  { name: 'Sun', revenue: 4900, expenses: 1900 },
];

const DashboardView = ({ currentUser }) => {
  const { t } = useLanguage();
  const [dbStats, setDbStats] = useState({ revenue: 0, customerCount: 0, tasksCompleted: 0, totalExpenses: 0 });
  const [chartData, setChartData] = useState([]);
  const [settings, setSettings] = useState({ exchange_rate: '8500' });
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getStats(),
      api.getStatsHistory(),
      api.getSettings()
    ])
      .then(([stats, history, sData]) => {
        setDbStats(stats);
        setChartData(history);
        setSettings(sData);
      })
      .catch(err => {
        console.error("Error fetching stats:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const rate = parseFloat(settings.exchange_rate || '8500');

  const formatValue = (val) => {
    if (currency === 'SLSH') {
      return (val * rate).toLocaleString() + ' SLSH';
    }
    return '$' + val.toLocaleString();
  };

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
      return [
        { label: t('total_revenue'), value: formatValue(dbStats.revenue), sub: '+12.5%', icon: DollarSign, color: 'var(--gurmad-green)', bg: '#dcfce7' },
        { label: t('daily_collections'), value: formatValue(dbStats.revenue / 30), sub: 'Today', icon: Activity, color: '#3b82f6', bg: '#dbeafe' },
        { label: t('total_expenses'), value: formatValue(dbStats.totalExpenses), sub: t('optimal'), icon: Wallet, color: '#ef4444', bg: '#fee2e2' },
        { label: 'Pending Invoices', value: '12', sub: 'Action required', icon: Clock, color: '#f97316', bg: '#ffedd5' },
      ];
    } else { // collector
      return [
        { label: t('tasks_completed'), value: dbStats.tasksCompleted.toString(), sub: 'This month', icon: CheckCircle2, color: 'var(--gurmad-green)', bg: '#dcfce7' },
        { label: 'My Collections', value: '45', sub: 'Today', icon: Activity, color: '#3b82f6', bg: '#dbeafe' },
        { label: 'Active Route', value: 'Zone A', sub: 'In progress', icon: TrendingUp, color: 'var(--gurmad-orange)', bg: '#fef3c7' },
        { label: 'Vehicle Status', value: 'Optimal', sub: 'SL-4555', icon: Activity, color: '#8b5cf6', bg: '#f3e8ff' },
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

      {/* Charts Section - Role Based */}
      {currentUser?.role !== 'collector' ? (
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
    </div>
  );
};

export default DashboardView;
