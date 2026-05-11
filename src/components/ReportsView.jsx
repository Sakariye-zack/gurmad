import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { 
  Download, 
  Calendar as CalendarIcon, 
  RefreshCw,
  ArrowUpRight, 
  ArrowDownRight,
  TrendingUp,
  DollarSign,
  Users,
  Box,
  AlertCircle,
  Clock
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

const ReportsView = ({ searchQuery = '' }) => {
  const [reportType, setReportType] = useState('weekly');
  const [reportData, setReportData] = useState({ revenue: 0, customerCount: 0, tasksCompleted: 0, totalExpenses: 0 });
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [collectorStats, setCollectorStats] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [zoneData, setZoneData] = useState([]);
  const [debts, setDebts] = useState([]);
  const [attendanceToday, setAttendanceToday] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [settings, setSettings] = useState({ exchange_rate: '8500' });
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  
  // Custom Date Range State
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [showPicker, setShowPicker] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [stats, invs, exps, colStats, dbt, attn, inv, zns, sData] = await Promise.all([
        api.getStats(),
        api.getInvoices(),
        api.getExpenses(),
        api.getCollectorReports(),
        api.getDebts(),
        api.getAttendanceToday(),
        api.getInventory(),
        api.getZones(),
        api.getSettings()
      ]);
      
      setReportData(stats);
      setInvoices(invs);
      setExpenses(exps);
      setCollectorStats(colStats);
      setDebts(dbt);
      setAttendanceToday(attn);
      setInventory(inv);
      setSettings(sData);

      // Process Zone Data
      const zoneMap = {};
      invs.filter(i => i.status === 'Paid').forEach(inv => {
        const zone = inv.zone || 'Unassigned';
        if (!zoneMap[zone]) zoneMap[zone] = 0;
        zoneMap[zone] += convert(inv.amount);
      });
      setZoneData(Object.entries(zoneMap).map(([name, amount]) => ({ name, amount })));

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const rate = parseFloat(settings.exchange_rate || '8500');

  const formatValue = (val) => {
    if (currency === 'SLSH') {
      return (parseFloat(val) * rate).toLocaleString() + ' SLSH';
    }
    return '$' + parseFloat(val).toLocaleString();
  };

  const convert = (val) => {
    return currency === 'SLSH' ? parseFloat(val) * rate : parseFloat(val);
  };
  useEffect(() => {
    fetchData();
  }, []);

  // Process chart data whenever dependencies change
  useEffect(() => {
    if (invoices.length === 0 && expenses.length === 0) return;

    let processedData = [];
    const now = new Date();

    const processRecords = (dataArr, filterCondition, amountKey, dateKey, type) => {
      dataArr.forEach(item => {
        let amt = convert(item.amount || 0);
        let d = new Date(item[dateKey] || item.created_at);
        if (filterCondition(d, item)) {
          amountKey(d, amt, type);
        }
      });
    };

    if (reportType === 'daily') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      processedData = days.map(d => ({ name: d, revenue: 0, expenses: 0 }));
      const lastWeek = new Date();
      lastWeek.setDate(now.getDate() - 7);

      const addAmount = (d, amt, type) => processedData[d.getDay()][type] += amt;
      
      processRecords(invoices, (d, inv) => inv.status === 'Paid' && d >= lastWeek, addAmount, 'created_at', 'revenue');
      processRecords(expenses, (d) => d >= lastWeek, addAmount, 'expense_date', 'expenses');
    } 
    else if (reportType === 'weekly') {
      processedData = [1, 2, 3, 4].map(w => ({ name: `Week ${w}`, revenue: 0, expenses: 0 }));
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(now.getDate() - 28);

      const addAmount = (d, amt, type) => {
        const diffTime = Math.abs(now - d);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const weekIndex = Math.floor(diffDays / 7);
        if (weekIndex < 4) {
          processedData[3 - weekIndex][type] += amt; // Week 4 is the most recent
        }
      };

      processRecords(invoices, (d, inv) => inv.status === 'Paid' && d >= fourWeeksAgo, addAmount, 'created_at', 'revenue');
      processRecords(expenses, (d) => d >= fourWeeksAgo, addAmount, 'expense_date', 'expenses');
    }
    else if (reportType === 'monthly' || reportType === '3 months' || reportType === '6 months') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      let monthsToInclude = 12;
      if (reportType === '3 months') monthsToInclude = 3;
      if (reportType === '6 months') monthsToInclude = 6;
      
      let targetDate = new Date();
      targetDate.setMonth(now.getMonth() - monthsToInclude);

      const monthMap = {};
      const addAmount = (d, amt, type) => {
        const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
        if (!monthMap[key]) monthMap[key] = { name: key, revenue: 0, expenses: 0, timestamp: new Date(d.getFullYear(), d.getMonth(), 1).getTime() };
        monthMap[key][type] += amt;
      };

      processRecords(invoices, (d, inv) => inv.status === 'Paid' && d >= targetDate, addAmount, 'created_at', 'revenue');
      processRecords(expenses, (d) => d >= targetDate, addAmount, 'expense_date', 'expenses');

      processedData = Object.values(monthMap).sort((a, b) => a.timestamp - b.timestamp);
      
      // Fallback empty months if no data found yet
      if (processedData.length === 0 && reportType === 'monthly') {
          processedData = months.map(m => ({ name: m, revenue: 0, expenses: 0 }));
      }
    }
    else if (reportType === 'yearly') {
      const yearsMap = {};
      const addAmount = (d, amt, type) => {
        const y = d.getFullYear();
        if (!yearsMap[y]) yearsMap[y] = { name: y.toString(), revenue: 0, expenses: 0 };
        yearsMap[y][type] += amt;
      };

      processRecords(invoices, (d, inv) => inv.status === 'Paid', addAmount, 'created_at', 'revenue');
      processRecords(expenses, () => true, addAmount, 'expense_date', 'expenses');

      processedData = Object.values(yearsMap).sort((a,b) => parseInt(a.name) - parseInt(b.name));
    }
    else if (reportType === 'custom') {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59);

      processedData = [{ name: 'Selected Period', revenue: 0, expenses: 0 }];
      const addAmount = (d, amt, type) => processedData[0][type] += amt;

      processRecords(invoices, (d, inv) => inv.status === 'Paid' && d >= start && d <= end, addAmount, 'created_at', 'revenue');
      processRecords(expenses, (d) => d >= start && d <= end, addAmount, 'expense_date', 'expenses');
    }
    
    setChartData(processedData);

  }, [reportType, invoices, expenses, startDate, endDate]);

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Period,Income ($),Expenditure ($),Net Profit ($)\n";
    
    chartData.forEach(row => {
      const net = row.revenue - row.expenses;
      csvContent += `${row.name},${row.revenue},${row.expenses},${net}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `gurmad_financial_report_${reportType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="card glass">Generating live reports...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="card glass" style={{ display: 'flex', gap: '8px', padding: '0.5rem' }}>
            {['daily', 'weekly', 'monthly', '3 months', '6 months', 'yearly'].map(t => (
              <button 
                key={t}
                onClick={() => setReportType(t)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  backgroundColor: reportType === t ? 'var(--gurmad-green)' : 'transparent',
                  color: reportType === t ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                  textTransform: 'capitalize'
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Currency Toggle */}
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
            <button 
              onClick={() => setCurrency('USD')}
              style={{ 
                padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                backgroundColor: currency === 'USD' ? 'white' : 'transparent',
                fontWeight: 600, boxShadow: currency === 'USD' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                color: currency === 'USD' ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '0.85rem'
              }}
            >
              USD ($)
            </button>
            <button 
              onClick={() => setCurrency('SLSH')}
              style={{ 
                padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                backgroundColor: currency === 'SLSH' ? 'white' : 'transparent',
                fontWeight: 600, boxShadow: currency === 'SLSH' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                color: currency === 'SLSH' ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '0.85rem'
              }}
            >
              SLSH
            </button>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', position: 'relative' }}>
          <button 
            onClick={() => setShowPicker(!showPicker)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '0.6rem 1rem', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-color)',
              fontWeight: 500,
              backgroundColor: reportType === 'custom' ? 'var(--gurmad-green)' : 'white',
              color: reportType === 'custom' ? 'white' : 'var(--text-main)',
              transition: 'all 0.2s'
            }}
          >
            <CalendarIcon size={18} />
            {reportType === 'custom' ? `${startDate} to ${endDate}` : 'Custom Range'}
          </button>

          {showPicker && (
            <div className="card glass" style={{ 
              position: 'absolute', 
              top: '100%', 
              right: 0, 
              zIndex: 100, 
              marginTop: '10px', 
              padding: '1.5rem',
              width: '300px',
              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>START DATE</label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>END DATE</label>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <button 
                  onClick={() => {
                    setReportType('custom');
                    setShowPicker(false);
                  }}
                  className="btn-primary"
                  style={{ width: '100%' }}
                >
                  Apply Filter
                </button>
              </div>
            </div>
          )}

          <button onClick={handleExportCSV} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        <div className="card" style={{ borderBottom: '4px solid var(--gurmad-green)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total Income</span>
            <TrendingUp size={18} color="var(--gurmad-green)" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>{formatValue(reportData.revenue)}</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--gurmad-green)', fontWeight: 600, marginTop: '4px' }}>
            <ArrowUpRight size={14} style={{ verticalAlign: 'middle' }} /> Real-time active
          </p>
        </div>
        <div className="card" style={{ borderBottom: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total Expenses</span>
            <ArrowDownRight size={18} color="#ef4444" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>{formatValue(reportData.totalExpenses)}</h2>
          <p style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600, marginTop: '4px' }}>
             Tracking operational costs
          </p>
        </div>
        <div className="card" style={{ borderBottom: '4px solid var(--gurmad-orange)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Net Profit</span>
            <DollarSign size={18} color="var(--gurmad-orange)" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>{formatValue(parseFloat(reportData.revenue) - parseFloat(reportData.totalExpenses))}</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Overall health: Positive
          </p>
        </div>
        <div className="card" style={{ borderBottom: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total Debts</span>
            <AlertCircle size={18} color="#8b5cf6" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>
            ${debts.filter(d => d.status === 'Unpaid').reduce((acc, d) => acc + parseFloat(d.amount), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#8b5cf6', fontWeight: 600, marginTop: '4px' }}>
            Awaiting collection
          </p>
        </div>
        <div className="card" style={{ borderBottom: '4px solid #06b6d4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Attendance (Today)</span>
            <Users size={18} color="#06b6d4" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>{attendanceToday.length} Present</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Active personnel on field
          </p>
        </div>
      </div>

      {inventory.filter(i => i.quantity < 10).length > 0 && (
        <div className="card" style={{ backgroundColor: '#fff7ed', borderLeft: '4px solid #f97316', padding: '1rem' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertCircle color="#f97316" size={20} />
              <div>
                <h4 style={{ color: '#9a3412', fontWeight: 700, fontSize: '0.9rem' }}>Inventory Alerts: Low Stock</h4>
                <p style={{ fontSize: '0.8rem', color: '#c2410c' }}>
                  {inventory.filter(i => i.quantity < 10).map(i => `${i.item_name} (${i.quantity} ${i.unit})`).join(', ')} items need restocking.
                </p>
              </div>
           </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>Revenue vs Expense Breakdown ({reportType})</h3>
          <div style={{ height: 300, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-main)' }}
                  formatter={(value) => formatValue(value)}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px' }} />
                <Bar dataKey="revenue" name="Income" fill="var(--gurmad-green)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenditure" fill="var(--gurmad-orange)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>Collection Breakdown by Zone</h3>
          <div style={{ height: 300, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={zoneData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} width={120} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-main)' }}
                  formatter={(value) => formatValue(value)}
                />
                <Bar dataKey="amount" name="Revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontWeight: 700 }}>Metric Performance Recap</h3>
          <button onClick={fetchData} style={{ color: 'var(--gurmad-green)', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <RefreshCw size={14} /> Refresh Data
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ backgroundColor: 'var(--bg-secondary)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <tr>
              <th style={{ padding: '1rem' }}>METRIC</th>
              <th style={{ padding: '1rem' }}>CURRENT STATE</th>
              <th style={{ padding: '1rem' }}>SOURCE</th>
            </tr>
          </thead>
          <tbody>
            {[
              { m: 'Active Customers', current: reportData.customerCount, src: 'Database' },
              { m: 'Tasks Completed', current: reportData.tasksCompleted, src: 'Fleet Logs' },
              { m: 'Total Collections', current: formatValue(reportData.revenue), src: 'Finance DB' },
              { m: 'Operational Costs', current: formatValue(reportData.totalExpenses), src: 'Expense DB' },
            ].map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                <td style={{ padding: '1rem', fontWeight: 500 }}>{row.m}</td>
                <td style={{ padding: '1rem' }}>{row.current}</td>
                <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{row.src}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Collector Real-time Tracking */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontWeight: 700 }}>Collections Received per Collector</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>All Time Revenue Data</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ backgroundColor: 'var(--bg-secondary)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <tr>
              <th style={{ padding: '1rem' }}>COLLECTOR / ASSIGNED PERSONNEL</th>
              <th style={{ padding: '2rem' }}>COLLECTIONS COUNT</th>
              <th style={{ padding: '1rem' }}>TOTAL REVENUE</th>
            </tr>
          </thead>
          <tbody>
            {collectorStats
              .filter(c => (c.collector || '').toLowerCase().includes(searchQuery.toLowerCase()))
              .map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                <td style={{ padding: '1rem', fontWeight: 600 }}>{row.collector}</td>
                <td style={{ padding: '2rem' }}>{row.transaction_count} deposits</td>
                <td style={{ padding: '1rem', fontWeight: 700, color: 'var(--gurmad-green)' }}>{formatValue(row.total_collected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent Activity Section */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontWeight: 700 }}>Recent Activity Logs</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Latest Invoices & Debts</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: 'var(--bg-secondary)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <tr>
                <th style={{ padding: '1rem' }}>TYPE</th>
                <th style={{ padding: '1rem' }}>CUSTOMER</th>
                <th style={{ padding: '1rem' }}>AMOUNT</th>
                <th style={{ padding: '1rem' }}>STATUS</th>
                <th style={{ padding: '1rem' }}>DATE</th>
              </tr>
            </thead>
            <tbody>
              {[...invoices.slice(0, 5), ...debts.slice(0, 5)]
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 8)
                .map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '0.7rem', 
                      fontWeight: 700,
                      backgroundColor: item.payment_method ? '#f0fdf4' : '#fdf2f8',
                      color: item.payment_method ? '#166534' : '#9d174d'
                    }}>
                      {item.payment_method ? 'INVOICE' : 'DEBT'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 500 }}>{item.customer_name || item.debtor_name}</td>
                  <td style={{ padding: '1rem', fontWeight: 600 }}>${parseFloat(item.amount).toLocaleString()}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      color: item.status === 'Paid' ? 'var(--gurmad-green)' : '#ef4444',
                      fontWeight: 600
                    }}>
                      {item.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportsView;
