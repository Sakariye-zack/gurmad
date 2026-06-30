import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { 
  Receipt, 
  Smartphone, 
  CreditCard, 
  Send, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Banknote, 
  Users, 
  Search,
  Wallet,
  Printer,
  DollarSign,
  MapPin,
  Truck,
  Tag,
  Clock,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { exportToCSV } from '../utils/exportUtils';
import { useLanguage } from '../contexts/LanguageContext';

const BillingView = ({ searchQuery = '', currentUser }) => {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState({ total_usd: 0, total_slsh: 0, total_debt: 0, total_discount: 0, active_trucks: 0 });
  const [loading, setLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [collectorName, setCollectorName] = useState('');
  const [splitPayments, setSplitPayments] = useState({ cash: '', zaad: '', edahab: '', debt: '' });
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [singleAmount, setSingleAmount] = useState('');
  const [currencyMode, setCurrencyMode] = useState('USD');
  const [discount, setDiscount] = useState('');
  const [selectedTruck, setSelectedTruck] = useState('');
  const [districtZone, setDistrictZone] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [trucks, setTrucks] = useState([]);
  const [zones, setZones] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(11000);
  const [customerName, setCustomerName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const refreshInterval = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchAllData();
    refreshInterval.current = setInterval(fetchAllData, 30000); // Auto-refresh every 30s
    return () => clearInterval(refreshInterval.current);
  }, []);

  const fetchAllData = async () => {
    try {
      const [invData, statsData, tData, zData, settingsData, custData, empData] = await Promise.all([
        api.getInvoices(),
        api.getInvoiceStats(),
        api.getTrucks(),
        api.getZones(),
        api.getSettings(),
        api.getCustomers(),
        api.getEmployees()
      ]);
      
      setInvoices(invData);
      setStats(statsData);
      setTrucks(tData);
      setZones(zData);
      setCustomers(custData);
      setEmployees(empData.filter(e => e.role === 'Collector' || e.role === 'Waste Collector'));
      
      if (settingsData.exchange_rate) {
        const rate = parseFloat(settingsData.exchange_rate.toString().replace(/,/g, '')) || 11000;
        setExchangeRate(rate);
      }
      
      setLastRefreshed(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch billing data', err);
    }
  };

  const calculateRawTotal = () => {
    if (paymentMethod === 'Split') {
      return (parseFloat(splitPayments.cash) || 0) + 
             (parseFloat(splitPayments.zaad) || 0) + 
             (parseFloat(splitPayments.edahab) || 0) + 
             (parseFloat(splitPayments.debt) || 0);
    }
    return parseFloat(singleAmount) || 0;
  };

  const rawTotal = calculateRawTotal();

  const totalAmount = (
    currencyMode === 'USD' 
    ? rawTotal
    : (rawTotal / exchangeRate)
  ) - (parseFloat(discount) || 0);

  const filteredInvoices = invoices.filter(inv => {
    // Role-based filtering for collectors
    if (currentUser?.role === 'collector') {
      const invCollector = (inv.collector_name || '').toLowerCase().trim();
      const currName1 = (currentUser.full_name || '').toLowerCase().trim();
      const currName2 = (currentUser.username || '').toLowerCase().trim();
      if (invCollector !== currName1 && invCollector !== currName2) {
         return false; // Skip if it doesn't belong to them
      }
    }

    const query = searchQuery.toLowerCase();
    return (
      inv.id.toString().includes(query) ||
      (inv.customer_name && inv.customer_name.toLowerCase().includes(query)) ||
      (inv.customer_phone && inv.customer_phone.includes(query)) ||
      (inv.invoice_zone && inv.invoice_zone.toLowerCase().includes(query)) ||
      (inv.invoice_house_no && inv.invoice_house_no.toLowerCase().includes(query)) ||
      (inv.truck_name && inv.truck_name.toLowerCase().includes(query))
    );
  });

  const collectorStatsToday = React.useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const statsMap = {};
    
    invoices.forEach(inv => {
      // Check if invoice is today
      if (!inv.created_at) return;
      const invDate = new Date(inv.created_at).toISOString().split('T')[0];
      if (invDate !== today) return;

      const collName = inv.collector_name || 'Unassigned / Office';
      if (!statsMap[collName]) {
        statsMap[collName] = { collected_usd: 0, collected_slsh: 0, debt: 0, customers_worked: 0 };
      }
      
      statsMap[collName].customers_worked += 1;

      // Add payments
      if (inv.is_split) {
         const cash = parseFloat(inv.cash_amount) || 0;
         const zaad = parseFloat(inv.zaad_amount) || 0;
         const edahab = parseFloat(inv.edahab_amount) || 0;
         const slsh = parseFloat(inv.slsh_amount) || 0;
         const debt = parseFloat(inv.debt_amount) || 0;

         if (inv.currency === 'USD') {
             statsMap[collName].collected_usd += (cash + zaad + edahab);
         } else {
             statsMap[collName].collected_slsh += (slsh); 
         }
         statsMap[collName].debt += debt;
      } else {
         const amount = parseFloat(inv.amount) || 0;
         if (inv.payment_method === 'Debt') {
             statsMap[collName].debt += amount;
         } else {
             if (inv.currency === 'USD') statsMap[collName].collected_usd += amount;
             else statsMap[collName].collected_slsh += amount;
         }
      }
    });

    return Object.keys(statsMap).map(k => ({
      name: k,
      ...statsMap[k]
    })).sort((a, b) => b.collected_usd - a.collected_usd);
  }, [invoices]);

  const handlePaymentRequest = async (e) => {
    e.preventDefault();
    if (!phoneNumber || totalAmount <= 0) {
      toast.error('Gali lambarka taleefanka iyo ugu yaraan hal qiimo lacageed');
      return;
    }
    
    setIsProcessing(true);

    let cash = 0, zaad = 0, edahab = 0, debt = 0;
    const amountVal = parseFloat(singleAmount) || 0;

    if (paymentMethod === 'Split') {
      cash = parseFloat(splitPayments.cash) || 0;
      zaad = parseFloat(splitPayments.zaad) || 0;
      edahab = parseFloat(splitPayments.edahab) || 0;
      debt = parseFloat(splitPayments.debt) || 0;
    } else if (paymentMethod === 'Cash') {
      cash = amountVal;
    } else if (paymentMethod === 'Zaad') {
      zaad = amountVal;
    } else if (paymentMethod === 'eDahab') {
      edahab = amountVal;
    } else if (paymentMethod === 'Debt') {
      debt = amountVal;
    }

    const zaadAmount = currencyMode === 'USD' ? zaad : 0; // Slsh not directly supported for zaad Waafi here unless converted, assuming USD for Zaad

    // Process Zaad payment if there's a zaad amount
    if (zaadAmount > 0) {
       const loadingZaad = toast.loading('Fadlan sug... Macmiilka ayaa ZAAD PIN weydiinayaa', { id: 'zaad-process' });
       try {
         const payRes = await api.processZaadPayment({
           amount: zaadAmount,
           phone: phoneNumber,
           currency: currencyMode,
           reference: `BILL-${Date.now()}`
         });
         toast.dismiss(loadingZaad);
         if (!payRes.success) {
           toast.error('Lacag bixinta Zaad waa la diiday ama fashilantay', { id: 'zaad-process' });
           setIsProcessing(false);
           return;
         }
         toast.success('Lacag bixinta Zaad way guulaysatay!', { id: 'zaad-process' });
       } catch (err) {
         toast.dismiss(loadingZaad);
         toast.error(err.message || 'Cilad ayaa ka dhacday Zaad API', { id: 'zaad-process' });
         setIsProcessing(false);
         return;
       }
    }

    toast.loading('Diiwaangelinta lacag bixinta...', { id: 'payment-request' });
    
    try {
      const result = await api.addInvoice({
          customer_id: selectedCustomerId || null,
          phone: phoneNumber,
          splitPayments: {
            cash: currencyMode === 'USD' ? cash : 0,
            zaad: currencyMode === 'USD' ? zaad : 0,
            edahab: currencyMode === 'USD' ? edahab : 0,
            debt: currencyMode === 'USD' ? debt : 0,
            slsh: currencyMode === 'SLSH' ? (cash + zaad + edahab + debt) : 0
          },
          currency: currencyMode,
          customer_name: customerName,
          collector_name: collectorName,
          truck_name: selectedTruck,
          zone: districtZone,
          house_no: houseNo,
          discount_amount: parseFloat(discount) || 0
      });
      
      setIsProcessing(false);
      if (result.error) {
         toast.error(result.error, { id: 'payment-request' });
      } else {
         toast.success(`Guul! Lacag bixinta #${result?.id} waa la diiwaan geliyey.`, { id: 'payment-request', duration: 5000 });
          setPhoneNumber('');
          setCustomerName('');
          setCollectorName('');
          setSingleAmount('');
          setPaymentMethod('Cash');
          setSplitPayments({ cash: '', zaad: '', edahab: '', debt: '' });
          setDiscount('');
          setHouseNo('');
          setSelectedTruck('');
          setDistrictZone('');
          setSearchCustomer('');
          fetchAllData();
      }
    } catch (err) {
      setIsProcessing(false);
      toast.error('Cillad ayaa dhacday', { id: 'payment-request' });
    }
  };

  const getFriendlyTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMethodIcon = (inv) => {
    if (inv.is_split) {
       let icons = [];
       if (parseFloat(inv.zaad_amount) > 0) icons.push(<Smartphone key="z" size={14} color="#3b82f6" />);
       if (parseFloat(inv.edahab_amount) > 0) icons.push(<CreditCard key="e" size={14} color="#8b5cf6" />);
       if (parseFloat(inv.cash_amount) > 0) icons.push(<Wallet key="c" size={14} color="#10b981" />);
       if (parseFloat(inv.slsh_amount) > 0) icons.push(<Banknote key="s" size={14} color="#f97316" />);
       if (parseFloat(inv.debt_amount) > 0) icons.push(<Users key="d" size={14} color="#f59e0b" />);
       return <div style={{ display: 'flex', gap: '4px' }}>{icons}</div>;
    }
    return <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{inv.payment_method}</span>;
  };

  if (loading) return <div className="card glass">Soo dejinta billing-ka...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Stats Header */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '1.25rem' }}>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', gap: '8px' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>MAANTA (USD)</span>
              <TrendingUp size={16} />
           </div>
           <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>${(parseFloat(stats.total_usd) || 0).toLocaleString()}</div>
           <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>+ Today's collection</div>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f97316', display: 'flex', flexDirection: 'column', gap: '8px' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>MAANTA (SLSH)</span>
              <Banknote size={16} />
           </div>
           <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{ (parseFloat(stats.total_slsh) || 0).toLocaleString() }</div>
           <div style={{ fontSize: '0.75rem', color: '#f97316', fontWeight: 600 }}>Collected in Cash</div>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #ef4444', display: 'flex', flexDirection: 'column', gap: '8px' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>AMAAH (DEBT)</span>
              <AlertCircle size={16} />
           </div>
           <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444' }}>${ (parseFloat(stats.total_debt) || 0).toLocaleString() }</div>
           <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>From split payments</div>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #3b82f6', display: 'flex', flexDirection: 'column', gap: '8px' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>TRUCKS ACTIVE</span>
              <Truck size={16} />
           </div>
           <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#3b82f6' }}>{ stats.active_trucks || 0 }</div>
           <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reporting today</div>
        </div>
      </div>

      {/* Collector Performance Today (Admins Only) */}
      {currentUser?.role === 'admin' && (
        <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
             <Users size={18} color="var(--gurmad-green)" />
             Xisaabta Collectors-ka Maanta
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.8rem', color: '#64748b' }}>Magaca (Collector)</th>
                  <th style={{ textAlign: 'right', padding: '12px', fontSize: '0.8rem', color: '#64748b' }}>Lashaqeeyay (Tirada)</th>
                  <th style={{ textAlign: 'right', padding: '12px', fontSize: '0.8rem', color: '#64748b' }}>La Qabtay (USD)</th>
                  <th style={{ textAlign: 'right', padding: '12px', fontSize: '0.8rem', color: '#64748b' }}>La Qabtay (SLSH)</th>
                  <th style={{ textAlign: 'right', padding: '12px', fontSize: '0.8rem', color: '#64748b' }}>Dayn (Debt)</th>
                </tr>
              </thead>
              <tbody>
                {collectorStatsToday.length > 0 ? collectorStatsToday.map((stat, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{stat.name}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#3b82f6' }}>{stat.customers_worked}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>${stat.collected_usd.toFixed(2)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#f97316' }}>{stat.collected_slsh.toLocaleString()} SLSH</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>${stat.debt.toFixed(2)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>Maanta wax xisaab ah weli lama diiwaangelin.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '2rem' }}>
        {/* Left Form */}
        <div className="card" style={{ flex: isMobile ? '1' : '0 0 420px', display: 'flex', flexDirection: 'column', gap: '1.5rem', height: 'fit-content', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
              <div style={{ padding: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px' }}>
                <DollarSign color="var(--gurmad-green)" size={20} />
              </div>
              Diwaangeli Lacag
            </h3>
          </div>
          
          <form onSubmit={handlePaymentRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
              <div className="input-group">
                <label style={{ display: 'flex', gap: '6px', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                   <Users size={14} /> DOORO MACMIILKA
                </label>
                <select 
                  onChange={(e) => {
                    const c = customers.find(cust => cust.id === parseInt(e.target.value));
                    if (c) {
                      setSelectedCustomerId(c.id);
                      setCustomerName(c.name);
                      setPhoneNumber(c.phone);
                      setDistrictZone(c.zone || '');
                      setHouseNo(c.house_no || '');
                      setSearchCustomer(c.name);
                    } else {
                      setSelectedCustomerId(null);
                    }
                  }}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '0.95rem', fontWeight: 600, backgroundColor: '#f8fafc' }}
                >
                  <option value="">-- Ka dooro liiska --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ position: 'relative' }}>
                <label style={{ display: 'flex', gap: '6px', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                   <Search size={14} /> AMA MACMIILKA BAADH
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    placeholder="Magaca ama Taleefanka..." 
                    value={searchCustomer}
                    onChange={(e) => {
                      setSearchCustomer(e.target.value);
                      setShowCustomerDropdown(true);
                      setSelectedCustomerId(null); // Reset when typing manually
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', borderRadius: '12px', border: '2px solid var(--border-color)', fontWeight: 700, fontSize: '1rem', outline: 'none' }}
                  />
                </div>
                
                {showCustomerDropdown && searchCustomer.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: 'var(--shadow-lg)', zIndex: 100, maxHeight: '200px', overflowY: 'auto', marginTop: '4px' }}>
                    {customers.filter(c => c.name.toLowerCase().includes(searchCustomer.toLowerCase()) || c.phone.includes(searchCustomer)).map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => {
                          setSelectedCustomerId(c.id);
                          setCustomerName(c.name);
                          setPhoneNumber(c.phone);
                          setDistrictZone(c.zone || '');
                          setHouseNo(c.house_no || '');
                          setSearchCustomer(c.name);
                          setShowCustomerDropdown(false);
                        }}
                        style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid var(--bg-secondary)', transition: 'background 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.phone} • {c.zone}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="input-group">
                <label style={{ display: 'flex', gap: '6px', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                   <Smartphone size={14} /> TALEEFANKA
                </label>
                <input 
                  type="text" 
                  placeholder="063xxxxxx" 
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '2px solid var(--border-color)', fontWeight: 700, fontSize: '1rem' }}
                />
              </div>
              <div className="input-group">
                <label style={{ display: 'flex', gap: '6px', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                   <Users size={14} /> QABAHA
                </label>
                <select 
                  value={collectorName}
                  onChange={(e) => setCollectorName(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '0.9rem', fontWeight: 600 }}
                >
                  <option value="">-- Dooro Collector --</option>
                  {employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
               <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>LACAGTA</label>
                  <select 
                    value={currencyMode}
                    onChange={(e) => {
                        setCurrencyMode(e.target.value);
                        setSplitPayments({ cash: '', zaad: '', edahab: '', debt: '' });
                    }}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '2px solid var(--gurmad-green)', fontSize: '0.8rem', fontWeight: 800 }}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="SLSH">SLSH</option>
                  </select>
               </div>
               <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>ZONE</label>
                  <select 
                    value={districtZone}
                    onChange={(e) => setDistrictZone(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
                  >
                    <option value="">Choose</option>
                    {zones.map(z => <option key={z.id} value={z.name}>{z.name}</option>)}
                  </select>
               </div>
               <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>HOUSE</label>
                  <input 
                    type="text"
                    placeholder="H-"
                    value={houseNo}
                    onChange={(e) => setHouseNo(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
                  />
               </div>
               <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TRUCK</label>
                  <select 
                    value={selectedTruck}
                    onChange={(e) => setSelectedTruck(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
                  >
                    <option value="">Truck</option>
                    {trucks.map(t => <option key={t.id} value={t.plate_number}>{t.plate_number}</option>)}
                  </select>
               </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Lacag Bixinta (Payment)</label>
                <select 
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value);
                    if (e.target.value !== 'Split') setSplitPayments({ cash: '', zaad: '', edahab: '', debt: '' });
                  }}
                  style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 700, backgroundColor: '#fff' }}
                >
                  <option value="Cash">Cash (Caddaan)</option>
                  <option value="Zaad">Zaad Service</option>
                  <option value="eDahab">eDahab</option>
                  <option value="Debt">Amaah (Debt)</option>
                  <option value="Split">Split (Isku-jir)</option>
                </select>
              </div>

              {paymentMethod !== 'Split' ? (
                <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '12px', border: '2px solid var(--gurmad-green)', display: 'flex', alignItems: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-muted)', marginRight: '8px' }}>
                    {currencyMode === 'USD' ? '$' : 'SLSH'}
                  </div>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    value={singleAmount}
                    onChange={(e) => setSingleAmount(e.target.value)}
                    style={{ background: 'transparent', border: 'none', width: '100%', fontSize: '1.75rem', fontWeight: 900, outline: 'none', color: 'var(--text-primary)' }}
                  />
                </div>
              ) : (
                <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ backgroundColor: '#fff', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ color: '#10b981', fontWeight: 700, fontSize: '0.7rem', marginBottom: '4px' }}>CASH ({currencyMode})</div>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      value={splitPayments.cash}
                      onChange={(e) => setSplitPayments({...splitPayments, cash: e.target.value})}
                      style={{ background: 'transparent', border: 'none', width: '100%', fontSize: '1.1rem', fontWeight: 800, outline: 'none' }}
                    />
                  </div>
                  <div style={{ backgroundColor: '#fff', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ color: '#3b82f6', fontWeight: 700, fontSize: '0.7rem', marginBottom: '4px' }}>ZAAD ({currencyMode})</div>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      value={splitPayments.zaad}
                      onChange={(e) => setSplitPayments({...splitPayments, zaad: e.target.value})}
                      style={{ background: 'transparent', border: 'none', width: '100%', fontSize: '1.1rem', fontWeight: 800, outline: 'none' }}
                    />
                  </div>
                  <div style={{ backgroundColor: '#fff', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ color: '#8b5cf6', fontWeight: 700, fontSize: '0.7rem', marginBottom: '4px' }}>EDAHAB ({currencyMode})</div>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      value={splitPayments.edahab}
                      onChange={(e) => setSplitPayments({...splitPayments, edahab: e.target.value})}
                      style={{ background: 'transparent', border: 'none', width: '100%', fontSize: '1.1rem', fontWeight: 800, outline: 'none' }}
                    />
                  </div>
                  <div style={{ backgroundColor: '#fff', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.7rem', marginBottom: '4px' }}>AMAAH ({currencyMode})</div>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      value={splitPayments.debt}
                      onChange={(e) => setSplitPayments({...splitPayments, debt: e.target.value})}
                      style={{ background: 'transparent', border: 'none', width: '100%', fontSize: '1.1rem', fontWeight: 800, outline: 'none' }}
                    />
                  </div>
                </div>
              )}

              <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fdf2f8', borderRadius: '12px', border: '1px solid #fce7f3' }}>
                <div style={{ color: '#ec4899', fontWeight: 700, fontSize: '0.7rem', marginBottom: '4px' }}><Tag size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> DISCOUNT ($)</div>
                <input 
                  type="number" 
                  placeholder="0.00"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  style={{ background: 'transparent', border: 'none', width: '100%', fontSize: '1rem', fontWeight: 800, outline: 'none', color: '#be185d' }}
                />
              </div>
            </div>

            <div style={{ 
              padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '20px', border: '2px solid var(--gurmad-green)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1 }}><Receipt size={80} color="var(--gurmad-green)" /></div>
              <div style={{ zIndex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>TOTAL COLLECTION</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Rate: ${exchangeRate.toLocaleString()}</div>
              </div>
              <div style={{ textAlign: 'right', zIndex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: '2rem', color: 'var(--gurmad-green)', lineHeight: 1 }}>
                  ${totalAmount.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f97316', marginTop: '6px' }}>
                   { (totalAmount * exchangeRate).toLocaleString() } SLSH
                </div>
              </div>
            </div>

            <button type="submit" disabled={isProcessing} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '10px', padding: '1.25rem', borderRadius: '16px', fontSize: '1.1rem', fontWeight: 800, transition: 'all 0.2s' }}>
              <Send size={20} />
              {isProcessing ? 'Diiwaangelin...' : 'Diiwaangeli Lacagta'}
            </button>
          </form>
        </div>

        {/* Right Table */}
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa' }}>
            <div>
              <h3 style={{ fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                 Live Transactions
                 <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', animation: 'pulse 2s infinite' }}></div>
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Last updated: {lastRefreshed.toLocaleTimeString()}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => exportToCSV(filteredInvoices, 'Gurmad_Invoices')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  backgroundColor: '#dcfce7',
                  color: '#15803d',
                  border: '1px solid #86efac',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <FileSpreadsheet size={16} /> {t('export_excel')}
              </button>
              <button onClick={fetchAllData} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                 <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>
          
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left' }}>
              <thead style={{ backgroundColor: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={{ padding: '1rem', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ID / Time</th>
                  <th style={{ padding: '1rem', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer Details</th>
                  <th style={{ padding: '1rem', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Location & Collector</th>
                  <th style={{ padding: '1rem', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Method</th>
                  <th style={{ padding: '1rem', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '1rem', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '0.9rem' }}>
                {filteredInvoices.length > 0 ? filteredInvoices.map((inv) => (
                  <tr 
                    key={inv.id} 
                    onClick={() => setSelectedInvoice(inv)} 
                    style={{ 
                      borderBottom: '1px solid var(--border-color)', 
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '1.2rem 1rem' }}>
                       <div style={{ fontWeight: 800, color: 'var(--gurmad-green)', fontSize: '1rem' }}>#{inv.id}</div>
                       <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                          <Clock size={12} /> {getFriendlyTime(inv.created_at)}
                       </div>
                    </td>
                    <td style={{ padding: '1.2rem 1rem' }}>
                       <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>{inv.customer_name}</div>
                       <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{inv.customer_phone}</div>
                    </td>
                    <td style={{ padding: '1.2rem 1rem' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
                          <MapPin size={14} color="var(--gurmad-green)" />
                          {inv.invoice_zone || inv.zone || 'N/A'}
                       </div>
                       <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>H-{inv.invoice_house_no || '---'}</span>
                          <span style={{ color: '#0ea5e9', fontWeight: 600 }}>By: {inv.collector_name || 'System'}</span>
                       </div>
                    </td>
                    <td style={{ padding: '1.2rem 1rem' }}>
                       <div style={{ transform: 'scale(1.2)', display: 'inline-block' }}>
                          {getMethodIcon(inv)}
                       </div>
                    </td>
                    <td style={{ padding: '1.2rem 1rem', textAlign: 'right' }}>
                       <div style={{ fontWeight: 900, color: 'var(--gurmad-green)', fontSize: '1.1rem' }}>
                          ${parseFloat(inv.amount).toFixed(2)}
                       </div>
                       {parseFloat(inv.slsh_amount) > 0 && (
                          <div style={{ fontSize: '0.75rem', color: '#f97316', fontWeight: 700 }}>
                             {(parseFloat(inv.slsh_amount)).toLocaleString()} SLSH
                          </div>
                       )}
                    </td>
                    <td style={{ padding: '1.2rem 1rem', textAlign: 'center' }}>
                      <span className={`badge badge-${inv.status.toLowerCase()}`} style={{ fontSize: '0.75rem', padding: '6px 14px', borderRadius: '100px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" style={{ padding: '4rem', textAlign: 'center' }}>
                    <Search size={40} color="var(--border-color)" style={{ marginBottom: '1rem' }} />
                    <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Ma jiro wax natiijo ah...</div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Expanded Receipt Modal */}
      {selectedInvoice && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', padding: '1rem' }}>
          <div className="card receipt-modal" style={{ maxWidth: '450px', width: '100%', padding: '0', borderRadius: '24px', backgroundColor: '#f8fafc', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', position: 'relative' }}>
             
             {/* Header */}
             <div style={{ backgroundColor: 'white', padding: '2rem 2rem 1.5rem', borderBottom: '2px dashed #e2e8f0', position: 'relative' }}>
                <button onClick={() => setSelectedInvoice(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: '#f1f5f9', border: 'none', color: '#64748b', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.background='#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background='#f1f5f9'}><XCircle size={20} /></button>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                   <div style={{ width: '50px', height: '50px', backgroundColor: '#f0fdf4', color: 'var(--gurmad-green)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #dcfce7' }}>
                      <Receipt size={24} />
                   </div>
                   <div>
                      <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.5rem', color: '#0f172a' }}>Payment Receipt</h2>
                      <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem', fontWeight: 700 }}>Invoice <span style={{ color: 'var(--gurmad-green)' }}>#GUR-{selectedInvoice.id}</span></p>
                   </div>
                </div>
             </div>

             {/* Body */}
             <div style={{ padding: '2rem', backgroundColor: 'white', position: 'relative' }}>
                {/* Watermark */}
                {selectedInvoice.status === 'Paid' && (
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-30deg)', fontSize: '5rem', fontWeight: 900, color: 'rgba(16, 185, 129, 0.05)', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 0 }}>
                    PAID
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', position: 'relative', zIndex: 1 }}>
                   <div>
                      <h4 style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Billed To</h4>
                      <p style={{ fontWeight: 800, color: '#1e293b', margin: '0 0 4px 0', fontSize: '1.1rem' }}>{selectedInvoice.customer_name}</p>
                      <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>{selectedInvoice.customer_phone}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#475569', fontWeight: 700, marginTop: '8px' }}>
                         <MapPin size={14} color="var(--gurmad-green)" /> {selectedInvoice.invoice_zone || selectedInvoice.zone || 'N/A'}, H-{selectedInvoice.invoice_house_no || '---'}
                      </div>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                      <h4 style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Date Issued</h4>
                      <p style={{ fontWeight: 800, color: '#1e293b', margin: '0 0 4px 0' }}>{new Date(selectedInvoice.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>{new Date(selectedInvoice.created_at).toLocaleTimeString()}</p>
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, marginTop: '8px', color: '#3b82f6', backgroundColor: '#eff6ff', padding: '4px 8px', borderRadius: '8px', display: 'inline-block' }}><Truck size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}/> {selectedInvoice.truck_name || 'N/A'}</p>
                   </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', position: 'relative', zIndex: 1 }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                      <Wallet size={16} color="#64748b" />
                      <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', margin: 0, textTransform: 'uppercase' }}>Payment Breakdown</h4>
                   </div>
                   
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {parseFloat(selectedInvoice.zaad_amount) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}><span style={{ color: '#64748b', fontWeight: 600 }}>ZAAD Service</span><span style={{ fontWeight: 800, color: '#0f172a' }}>${parseFloat(selectedInvoice.zaad_amount).toFixed(2)}</span></div>}
                      {parseFloat(selectedInvoice.edahab_amount) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}><span style={{ color: '#64748b', fontWeight: 600 }}>eDahab</span><span style={{ fontWeight: 800, color: '#0f172a' }}>${parseFloat(selectedInvoice.edahab_amount).toFixed(2)}</span></div>}
                      {parseFloat(selectedInvoice.cash_amount) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}><span style={{ color: '#64748b', fontWeight: 600 }}>Cash (USD)</span><span style={{ fontWeight: 800, color: '#0f172a' }}>${parseFloat(selectedInvoice.cash_amount).toFixed(2)}</span></div>}
                      {parseFloat(selectedInvoice.slsh_amount) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}><span style={{ color: '#64748b', fontWeight: 600 }}>Cash (SLSH)</span><span style={{ fontWeight: 800, color: '#0f172a' }}>{parseFloat(selectedInvoice.slsh_amount).toLocaleString()}</span></div>}
                      {parseFloat(selectedInvoice.debt_amount) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}><span style={{ color: '#64748b', fontWeight: 600 }}>Debt Logged</span><span style={{ fontWeight: 800, color: '#e11d48' }}>${parseFloat(selectedInvoice.debt_amount).toFixed(2)}</span></div>}
                      {parseFloat(selectedInvoice.discount_amount) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}><span style={{ color: '#64748b', fontWeight: 600 }}>Discount Applied</span><span style={{ fontWeight: 800, color: '#10b981' }}>-${parseFloat(selectedInvoice.discount_amount).toFixed(2)}</span></div>}
                   </div>

                   <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '2px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: '1rem', color: '#475569' }}>Total Paid</span>
                      <span style={{ fontWeight: 900, fontSize: '1.75rem', color: 'var(--gurmad-green)' }}>${parseFloat(selectedInvoice.amount).toFixed(2)}</span>
                   </div>
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '6px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                           <img 
                             src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`GURMAD-INV-${selectedInvoice.id}-${selectedInvoice.amount}`)}`} 
                             alt="QR"
                             style={{ width: '60px', height: '60px', display: 'block' }}
                           />
                        </div>
                        <div>
                           <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', margin: '0 0 2px 0' }}>Verify Online</p>
                           <p style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, margin: 0 }}>Scan QR code</p>
                        </div>
                    </div>
                    
                    <div style={{ textAlign: 'right' }}>
                       <span className={`badge badge-${selectedInvoice.status.toLowerCase()}`} style={{ fontSize: '0.75rem', padding: '6px 12px', borderRadius: '8px', fontWeight: 800, textTransform: 'uppercase' }}>
                         {selectedInvoice.status}
                       </span>
                    </div>
                 </div>
             </div>

             {/* Footer Actions */}
             <div style={{ padding: '1.5rem 2rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                 <button onClick={() => window.print()} style={{ flex: 1, padding: '1rem', borderRadius: '14px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#475569', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
                    <Printer size={18} /> Print Receipt
                 </button>
                 <button onClick={() => setSelectedInvoice(null)} style={{ flex: 1, padding: '1rem', borderRadius: '14px', border: 'none', backgroundColor: 'var(--gurmad-green)', color: 'white', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    Done
                 </button>
             </div>
             
             <div style={{ textAlign: 'center', padding: '0 0 1rem 0', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>
                Processed by: {selectedInvoice.collector_name || 'System Auto'}
             </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.9; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.9; }
        }
        @media print {
          body * { visibility: hidden; }
          .modal-overlay, .modal-overlay * { visibility: visible; }
          .modal-overlay { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; box-shadow: none; border: none; }
          button { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default BillingView;
