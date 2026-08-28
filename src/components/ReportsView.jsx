import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
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
  Clock,
  XCircle,
  Trophy,
  FileDown
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
  const [fuelLogs, setFuelLogs] = useState([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [zonePerformance, setZonePerformance] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [settings, setSettings] = useState({ exchange_rate: '8500' });
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  // P0-2: invoices with no recoverable historical exchange rate are excluded from the SLSH
  // totals rather than guessed — this count drives a visible "Needs Reconciliation" notice.
  const [needsReconciliationCount, setNeedsReconciliationCount] = useState(0);
  
  // Custom Date Range State
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [showPicker, setShowPicker] = useState(false);

  // Collector <-> Cashier daily reconciliation modal
  const [dailyModalOpen, setDailyModalOpen] = useState(false);
  const [dailyModalCollector, setDailyModalCollector] = useState('');
  const [dailyModalDate, setDailyModalDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyModalLoading, setDailyModalLoading] = useState(false);
  const [dailyServiced, setDailyServiced] = useState([]);
  const [dailyCollected, setDailyCollected] = useState([]);

  const fetchDailyReport = async (collector, date) => {
    setDailyModalLoading(true);
    try {
      const data = await api.getCollectorDailyReport(collector, date);
      setDailyServiced(data.serviced || []);
      setDailyCollected(data.collected || []);
    } catch (err) {
      console.error(err);
      setDailyServiced([]);
      setDailyCollected([]);
    } finally {
      setDailyModalLoading(false);
    }
  };

  const openDailyModal = (collector) => {
    setDailyModalCollector(collector);
    const today = new Date().toISOString().split('T')[0];
    setDailyModalDate(today);
    setDailyModalOpen(true);
    fetchDailyReport(collector, today);
  };

  const handleDailyDateChange = (newDate) => {
    setDailyModalDate(newDate);
    fetchDailyReport(dailyModalCollector, newDate);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [stats, invs, exps, colStats, dbt, attn, inv, zns, sData, fuel, maint, trks, zonePerf, comps] = await Promise.all([
        api.getStats(),
        api.getInvoices(),
        api.getExpenses(),
        api.getCollectorReports(),
        api.getDebts(),
        api.getAttendanceToday(),
        api.getInventory(),
        api.getZones(),
        api.getSettings(),
        api.getFuelLogs().catch(() => []),
        api.getMaintenanceLogs().catch(() => []),
        api.getTrucks().catch(() => []),
        api.getZonePerformance().catch(() => []),
        api.getComplaints().catch(() => [])
      ]);

      setReportData(stats);
      setInvoices(invs);
      setExpenses(exps);
      setCollectorStats(colStats);
      setDebts(dbt);
      setAttendanceToday(attn);
      setInventory(inv);
      setSettings(sData);
      setFuelLogs(fuel);
      setMaintenanceLogs(maint);
      setTrucks(trks);
      setZonePerformance(zonePerf);
      setComplaints(comps);

      // Process Zone Data
      const zoneMap = {};
      let reconciliationCount = 0;
      invs.filter(i => i.status === 'Paid').forEach(inv => {
        const converted = convertInvoice(inv);
        if (converted === null) { reconciliationCount++; return; } // excluded, not guessed — see convertInvoice
        const zone = inv.zone || 'Unassigned';
        if (!zoneMap[zone]) zoneMap[zone] = 0;
        zoneMap[zone] += converted;
      });
      setZoneData(Object.entries(zoneMap).map(([name, amount]) => ({ name, amount })));
      setNeedsReconciliationCount(reconciliationCount);

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

  // P0-2 (corrected): an invoice's own recorded rate (transaction_time when it was actually
  // written, or reconstructed for older rows) is the ONLY rate ever used for its historical
  // SLSH value. There is NO fallback to today's settings.exchange_rate — that fallback was
  // exactly the bug P0-2 exists to remove, because it silently re-prices old transactions
  // every time the current rate changes. An invoice with no recoverable rate at all
  // (exchange_rate_source = 'reconciliation_required', or genuinely missing) returns null —
  // callers must exclude it from converted totals and surface it as "Needs Reconciliation",
  // never guess a value for it.
  const convertInvoice = (inv) => {
    if (currency !== 'SLSH') return parseFloat(inv.amount || 0);
    if (inv.exchange_rate == null) return null; // Needs Reconciliation — excluded, not guessed
    return parseFloat(inv.amount || 0) * parseFloat(inv.exchange_rate);
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
        // Revenue rows are invoices — use each invoice's own historical rate, not today's.
        // Expense rows have no per-record exchange rate, so they still use the current rate.
        let amt = type === 'revenue' ? convertInvoice(item) : convert(item.amount || 0);
        if (amt === null) return; // Needs Reconciliation — excluded from the report, never guessed
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

  // The Total Income/Expenses/Net Profit summary cards used to always show reportData (the
  // unfiltered, all-time company total from /api/stats) no matter which period tab was
  // selected — switching to "Daily" only changed the chart underneath while the headline
  // numbers stayed exactly the same as "Yearly", silently misleading anyone reading just the
  // top cards. Now derived from the same period-scoped chartData the chart itself already
  // computes correctly for every tab (Daily/Weekly/Monthly/.../Custom Range).
  const periodRevenue = chartData.reduce((sum, d) => sum + (d.revenue || 0), 0);
  const periodExpenses = chartData.reduce((sum, d) => sum + (d.expenses || 0), 0);

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

  // Executive Summary — a single company-snapshot PDF (revenue/expenses/profit, zone-by-zone
  // performance, debt aging, top debtors, pending complaints, collector leaderboard) generated
  // entirely client-side with jsPDF from data already loaded on this page. Meant to be the thing
  // an owner can download and read (or forward on WhatsApp) without logging into the dashboard.
  const urlToDataURLReport = (url) => fetch(url)
    .then(res => res.blob())
    .then(blob => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }));

  const handleDownloadExecutiveSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const green = [63, 174, 42];
      const gray = [100, 116, 139];
      const dark = [15, 23, 42];
      const marginX = 40;
      let y = 50;

      const ensureSpace = (needed) => {
        if (y + needed > pageHeight - 40) { doc.addPage(); y = 50; }
      };

      // Header
      if (settings.system_logo) {
        try {
          const dataUrl = await urlToDataURLReport(`/api/uploads/${settings.system_logo}`);
          const fmt = dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(dataUrl, fmt, marginX, y - 12, 40, 40);
        } catch (e) { /* logo optional */ }
      }
      const textX = settings.system_logo ? marginX + 52 : marginX;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...green);
      doc.text(settings.company_name || 'Gurmad Waste Management', textX, y + 4);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...gray);
      doc.text('Executive Summary', textX, y + 20);
      doc.text(new Date().toLocaleString(), pageWidth - marginX, y + 4, { align: 'right' });
      y += 55;
      doc.setDrawColor(230, 230, 230); doc.line(marginX, y, pageWidth - marginX, y);
      y += 28;

      // Financial snapshot
      const netProfit = periodRevenue - periodExpenses;
      const snapshot = [
        ['Total Revenue', formatValue(periodRevenue)],
        ['Total Expenses', formatValue(periodExpenses)],
        ['Net Profit', formatValue(netProfit)],
        ['Active Customers', String(reportData.customerCount)],
      ];
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...dark);
      doc.text('Financial Snapshot', marginX, y);
      y += 20;
      const colW = (pageWidth - marginX * 2) / 4;
      snapshot.forEach(([label, val], i) => {
        const x = marginX + i * colW;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...gray);
        doc.text(label.toUpperCase(), x, y);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...(label === 'Net Profit' ? green : dark));
        doc.text(String(val), x, y + 18);
      });
      y += 45;

      // Zone Performance
      if (zonePerformance.length > 0) {
        ensureSpace(30 + zonePerformance.length * 20);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...dark);
        doc.text('Zone Performance', marginX, y);
        y += 18;
        doc.setFillColor(248, 250, 252); doc.rect(marginX, y, pageWidth - marginX * 2, 20, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...gray);
        doc.text('ZONE', marginX + 8, y + 13);
        doc.text('CUSTOMERS', marginX + 180, y + 13);
        doc.text('SERVED TODAY', marginX + 300, y + 13);
        doc.text('REVENUE TODAY', pageWidth - marginX - 8, y + 13, { align: 'right' });
        y += 20;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...dark);
        zonePerformance.forEach(z => {
          ensureSpace(20);
          doc.text(z.name, marginX + 8, y + 14);
          doc.text(String(z.customer_count), marginX + 180, y + 14);
          doc.text(`${z.served_today} / ${z.customer_count}`, marginX + 300, y + 14);
          doc.text(formatValue(z.revenue_today), pageWidth - marginX - 8, y + 14, { align: 'right' });
          doc.setDrawColor(245, 245, 245); doc.line(marginX, y + 20, pageWidth - marginX, y + 20);
          y += 20;
        });
        y += 20;
      }

      // Debt Aging
      const agingBuckets = ['0-30', '31-60', '61-90', '90+'].map(bucket => {
        const inBucket = debts.filter(d => {
          if (d.status !== 'Unpaid') return false;
          const days = Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000);
          if (bucket === '0-30') return days <= 30;
          if (bucket === '31-60') return days > 30 && days <= 60;
          if (bucket === '61-90') return days > 60 && days <= 90;
          return days > 90;
        });
        return { bucket, count: inBucket.length, total: inBucket.filter(d => d.currency === 'USD').reduce((s, d) => s + parseFloat(d.amount), 0) };
      });
      ensureSpace(80);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...dark);
      doc.text('Debt Aging', marginX, y);
      y += 20;
      const bucketW = (pageWidth - marginX * 2) / 4;
      agingBuckets.forEach((b, i) => {
        const x = marginX + i * bucketW;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...gray);
        doc.text(`${b.bucket} DAYS`, x, y);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...(b.bucket === '90+' ? [185, 28, 28] : dark));
        doc.text(`$${b.total.toFixed(2)}`, x, y + 16);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...gray);
        doc.text(`${b.count} debt${b.count !== 1 ? 's' : ''}`, x, y + 28);
      });
      y += 50;

      // Top Debtors
      const topDebtors = debts.filter(d => d.status === 'Unpaid' && d.currency === 'USD')
        .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount)).slice(0, 5);
      if (topDebtors.length > 0) {
        ensureSpace(30 + topDebtors.length * 16);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...dark);
        doc.text('Top 5 Debtors', marginX, y);
        y += 18;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        topDebtors.forEach(d => {
          doc.setTextColor(...dark);
          doc.text(d.debtor_name, marginX + 8, y + 12);
          doc.setTextColor(185, 28, 28);
          doc.text(`$${parseFloat(d.amount).toFixed(2)}`, pageWidth - marginX - 8, y + 12, { align: 'right' });
          y += 18;
        });
        y += 15;
      }

      // Collector Leaderboard (top 5)
      const topCollectors = collectorStats.slice().sort((a, b) => parseFloat(b.total_collected || 0) - parseFloat(a.total_collected || 0)).slice(0, 5);
      if (topCollectors.length > 0) {
        ensureSpace(30 + topCollectors.length * 16);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...dark);
        doc.text('Top Collectors', marginX, y);
        y += 18;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        topCollectors.forEach((c, i) => {
          doc.setTextColor(...dark);
          doc.text(`${i + 1}. ${c.collector}`, marginX + 8, y + 12);
          doc.setTextColor(...green);
          doc.text(formatValue(c.total_collected), pageWidth - marginX - 8, y + 12, { align: 'right' });
          y += 18;
        });
        y += 15;
      }

      // Pending Complaints
      const pendingComplaints = complaints.filter(c => c.status !== 'Resolved').length;
      ensureSpace(30);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...dark);
      doc.text('Customer Complaints', marginX, y);
      y += 18;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(pendingComplaints > 0 ? 185 : 21, pendingComplaints > 0 ? 28 : 128, pendingComplaints > 0 ? 28 : 61);
      doc.text(`${pendingComplaints} pending complaint${pendingComplaints !== 1 ? 's' : ''}`, marginX, y);

      doc.save(`Gurmad-Executive-Summary-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('Executive Summary downloaded');
    } catch (err) {
      toast.error('Failed to generate summary');
    } finally {
      setIsGeneratingSummary(false);
    }
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
          <button onClick={handleDownloadExecutiveSummary} disabled={isGeneratingSummary} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileDown size={18} />
            {isGeneratingSummary ? 'Generating...' : 'Executive Summary (PDF)'}
          </button>
        </div>
      </div>

      {/* P0-2: invoices with no recoverable historical exchange rate are excluded from SLSH
          totals rather than guessed — surface that explicitly so the number isn't mistaken
          for "complete". */}
      {currency === 'SLSH' && needsReconciliationCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '0.85rem 1.1rem', borderRadius: 'var(--radius-md)',
          backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#92400e'
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
            {needsReconciliationCount} invoice{needsReconciliationCount > 1 ? 's have' : ' has'} no recorded historical exchange rate and {needsReconciliationCount > 1 ? 'are' : 'is'} excluded from the SLSH totals below (Needs Reconciliation). An admin can resolve {needsReconciliationCount > 1 ? 'these' : 'this'} from the invoice's reconciliation option.
          </span>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        <div className="card" style={{ borderBottom: '4px solid var(--gurmad-green)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total Income</span>
            <TrendingUp size={18} color="var(--gurmad-green)" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>{formatValue(periodRevenue)}</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--gurmad-green)', fontWeight: 600, marginTop: '4px' }}>
            <ArrowUpRight size={14} style={{ verticalAlign: 'middle' }} /> Real-time active
          </p>
        </div>
        <div className="card" style={{ borderBottom: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total Expenses</span>
            <ArrowDownRight size={18} color="#ef4444" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>{formatValue(periodExpenses)}</h2>
          <p style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600, marginTop: '4px' }}>
             Tracking operational costs
          </p>
        </div>
        <div className="card" style={{ borderBottom: '4px solid var(--gurmad-orange)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Net Profit</span>
            <DollarSign size={18} color="var(--gurmad-orange)" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>{formatValue(periodRevenue - periodExpenses)}</h2>
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
              { m: 'Total Collections', current: formatValue(periodRevenue), src: 'Finance DB' },
              { m: 'Operational Costs', current: formatValue(periodExpenses), src: 'Expense DB' },
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

      {/* Collector Leaderboard — same data the old "Collections Received per Collector" table
          showed, now ranked highest-to-lowest with medal styling for the top 3 so it actually
          reads as a leaderboard instead of an unordered list. */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={18} color="#f59e0b" /> Collector Leaderboard
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>All Time Revenue Data</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ backgroundColor: 'var(--bg-secondary)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <tr>
              <th style={{ padding: '1rem' }}>RANK</th>
              <th style={{ padding: '1rem' }}>COLLECTOR / ASSIGNED PERSONNEL</th>
              <th style={{ padding: '1rem' }}>COLLECTIONS COUNT</th>
              <th style={{ padding: '1rem' }}>TOTAL REVENUE</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {collectorStats
              .filter(c => (c.collector || '').toLowerCase().includes(searchQuery.toLowerCase()))
              .slice()
              .sort((a, b) => parseFloat(b.total_collected || 0) - parseFloat(a.total_collected || 0))
              .map((row, i) => {
                const medal = [{ bg: '#fef3c7', fg: '#b45309', label: '🥇' }, { bg: '#f1f5f9', fg: '#64748b', label: '🥈' }, { bg: '#fff7ed', fg: '#c2410c', label: '🥉' }][i];
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '1rem' }}>
                      {medal ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', fontWeight: 800, fontSize: '0.8rem', backgroundColor: medal.bg, color: medal.fg }}>
                          {medal.label} #{i + 1}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontWeight: 700, paddingLeft: '6px' }}>#{i + 1}</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{row.collector}</td>
                    <td style={{ padding: '1rem' }}>{row.transaction_count} deposits</td>
                    <td style={{ padding: '1rem', fontWeight: 700, color: 'var(--gurmad-green)' }}>{formatValue(row.total_collected)}</td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => openDailyModal(row.collector)}
                        style={{ padding: '0.4rem 0.9rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        View List
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Fleet Report (Phase 7) — rolls up Phase 5's fuel/maintenance logging into one cost view */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontWeight: 700 }}>Fleet Costs — Fuel & Maintenance</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>All Time</span>
        </div>
        {(() => {
          const totalFuel = fuelLogs.reduce((sum, f) => sum + (parseFloat(f.cost) || 0), 0);
          const totalMaintenance = maintenanceLogs.reduce((sum, m) => sum + (parseFloat(m.cost) || 0), 0);
          const perTruck = trucks.map(t => {
            const fCost = fuelLogs.filter(f => f.truck_id === t.id).reduce((s, f) => s + (parseFloat(f.cost) || 0), 0);
            const mCost = maintenanceLogs.filter(m => m.truck_id === t.id).reduce((s, m) => s + (parseFloat(m.cost) || 0), 0);
            return { ...t, fCost, mCost, total: fCost + mCost };
          }).filter(t => t.total > 0).sort((a, b) => b.total - a.total);
          return (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', padding: '1.5rem' }}>
                <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: '#fef3c7' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>Total Fuel Cost</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#92400e' }}>{formatValue(totalFuel)}</div>
                </div>
                <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: '#dbeafe' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' }}>Total Maintenance Cost</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e3a8a' }}>{formatValue(totalMaintenance)}</div>
                </div>
                <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: '#dcfce7' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>Combined Fleet Cost</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#14532d' }}>{formatValue(totalFuel + totalMaintenance)}</div>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: 'var(--bg-secondary)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <tr>
                    <th style={{ padding: '1rem' }}>TRUCK</th>
                    <th style={{ padding: '1rem' }}>FUEL COST</th>
                    <th style={{ padding: '1rem' }}>MAINTENANCE COST</th>
                    <th style={{ padding: '1rem' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {perTruck.length === 0 ? (
                    <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No fuel or maintenance records yet.</td></tr>
                  ) : perTruck.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{t.plate_number}</td>
                      <td style={{ padding: '1rem' }}>{formatValue(t.fCost)}</td>
                      <td style={{ padding: '1rem' }}>{formatValue(t.mCost)}</td>
                      <td style={{ padding: '1rem', fontWeight: 700 }}>{formatValue(t.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          );
        })()}
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

      {/* Collector <-> Cashier Daily Reconciliation Modal */}
      {dailyModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
          <div className="card glass" style={{ width: '900px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', borderTop: '4px solid var(--gurmad-green)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontWeight: 800, margin: 0 }}>{dailyModalCollector}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Customers serviced vs. money actually collected</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="date"
                  value={dailyModalDate}
                  onChange={e => handleDailyDateChange(e.target.value)}
                  style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
                />
                <button onClick={() => setDailyModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <XCircle size={24} />
                </button>
              </div>
            </div>

            {dailyModalLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                {/* Serviced by collector */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Customers Serviced (Collector)</h4>
                    <span style={{ fontWeight: 700, color: '#f59e0b' }}>{dailyServiced.length}</span>
                  </div>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                    {dailyServiced.length === 0 ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No houses serviced this day.</div>
                    ) : dailyServiced.map((c, i) => (
                      <div key={`${c.id}-${i}`} style={{ padding: '0.75rem 1rem', borderBottom: i < dailyServiced.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {[c.house_no, c.street, c.area].filter(Boolean).join(', ') || c.phone}
                        </div>
                        {c.collected_at && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {new Date(c.collected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Collected by cashier */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Money Collected (Cashier)</h4>
                    <span style={{ fontWeight: 700, color: 'var(--gurmad-green)' }}>{dailyCollected.length}</span>
                  </div>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                    {dailyCollected.length === 0 ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No payments recorded this day.</div>
                    ) : dailyCollected.map((inv, i) => (
                      <div key={inv.id} style={{ padding: '0.75rem 1rem', borderBottom: i < dailyCollected.length - 1 ? '1px solid var(--border-color)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{inv.name || 'Walk-in Customer'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{inv.payment_method || '-'} &middot; {new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        <div style={{ fontWeight: 700, color: 'var(--gurmad-green)' }}>{inv.currency === 'SLSH' ? 'Slsh ' : '$'}{parseFloat(inv.amount).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsView;
