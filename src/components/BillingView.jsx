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

const BillingView = ({ searchQuery = '' }) => {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState({ total_usd: 0, total_slsh: 0, total_debt: 0, total_discount: 0, active_trucks: 0 });
  const [loading, setLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [collectorName, setCollectorName] = useState('');
  const [splitPayments, setSplitPayments] = useState({ cash: '', zaad: '', edahab: '', debt: '' });
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

  const totalAmount = (
    currencyMode === 'USD' 
    ? (
        (parseFloat(splitPayments.cash) || 0) + 
        (parseFloat(splitPayments.zaad) || 0) + 
        (parseFloat(splitPayments.edahab) || 0) + 
        (parseFloat(splitPayments.debt) || 0)
      )
    : (
        ((parseFloat(splitPayments.cash) || 0) + 
        (parseFloat(splitPayments.zaad) || 0) + 
        (parseFloat(splitPayments.edahab) || 0) + 
        (parseFloat(splitPayments.debt) || 0)) / exchangeRate
      )
  ) - (parseFloat(discount) || 0);

  const filteredInvoices = invoices.filter(inv => {
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

  const handlePaymentRequest = async (e) => {
    e.preventDefault();
    if (!phoneNumber || totalAmount <= 0) {
      toast.error('Gali lambarka taleefanka iyo ugu yaraan hal qiimo lacageed');
      return;
    }
    
    setIsProcessing(true);
    toast.loading('Diiwaangelinta lacag bixinta...', { id: 'payment-request' });
    
    try {
      const result = await api.addInvoice({
          phone: phoneNumber,
          splitPayments: {
            cash: currencyMode === 'USD' ? (parseFloat(splitPayments.cash) || 0) : 0,
            zaad: currencyMode === 'USD' ? (parseFloat(splitPayments.zaad) || 0) : 0,
            edahab: currencyMode === 'USD' ? (parseFloat(splitPayments.edahab) || 0) : 0,
            debt: currencyMode === 'USD' ? (parseFloat(splitPayments.debt) || 0) : 0,
            slsh: currencyMode === 'SLSH' ? (
                (parseFloat(splitPayments.cash) || 0) + 
                (parseFloat(splitPayments.zaad) || 0) + 
                (parseFloat(splitPayments.edahab) || 0) + 
                (parseFloat(splitPayments.debt) || 0)
            ) : 0
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
                      setCustomerName(c.name);
                      setPhoneNumber(c.phone);
                      setDistrictZone(c.zone || '');
                      setHouseNo(c.house_no || '');
                      setSearchCustomer(c.name);
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
              <label style={{ display: 'block', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>Cadadka Lacagta (Breakdown)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ backgroundColor: '#fff', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ color: '#10b981', fontWeight: 700, fontSize: '0.7rem', marginBottom: '4px' }}>CASH ({currencyMode})</div>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    value={splitPayments.cash}
                    onChange={(e) => setSplitPayments({...splitPayments, cash: e.target.value})}
                    style={{ background: 'transparent', border: 'none', width: '100%', fontSize: '1.1rem', fontWeight: 800, outline: 'none' }}
                  />
                  {splitPayments.cash > 0 && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    ≈ {currencyMode === 'USD' ? `SLSH ${ (parseFloat(splitPayments.cash) * exchangeRate).toLocaleString() }` : `$${(parseFloat(splitPayments.cash) / exchangeRate).toFixed(2)}`}
                  </div>}
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
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#fdf2f8', borderRadius: '12px', border: '1px solid #fce7f3' }}>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ maxWidth: '500px', width: '95%', padding: '0', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
             <div style={{ backgroundColor: 'var(--gurmad-green)', color: '#fff', padding: '2rem', textAlign: 'center', position: 'relative' }}>
                <button onClick={() => setSelectedInvoice(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>×</button>
                <div style={{ display: 'inline-flex', padding: '12px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '16px', marginBottom: '1rem' }}>
                   <Receipt size={32} />
                </div>
                <h2 style={{ margin: 0, fontWeight: 900 }}>Invois Qabasho</h2>
                <p style={{ margin: '4px 0 0 0', opacity: 0.8, fontSize: '0.9rem' }}>Invoice ID: #{selectedInvoice.id}</p>
             </div>

             <div style={{ padding: '2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                   <div>
                      <h4 style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Macaamiilka</h4>
                      <p style={{ fontWeight: 800, margin: '0 0 4px 0' }}>{selectedInvoice.customer_name}</p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>{selectedInvoice.customer_phone}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--gurmad-green)', fontWeight: 700, marginTop: '8px' }}>
                         <MapPin size={12} /> {selectedInvoice.invoice_zone || selectedInvoice.zone || 'N/A'}, H-{selectedInvoice.invoice_house_no || '---'}
                      </div>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                      <h4 style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Taariikhda</h4>
                      <p style={{ fontWeight: 700, margin: 0 }}>{new Date(selectedInvoice.created_at).toLocaleDateString()}</p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>{new Date(selectedInvoice.created_at).toLocaleTimeString()}</p>
                      <p style={{ fontSize: '0.75rem', fontWeight: 600, marginTop: '8px', color: '#3b82f6' }}>Truck: {selectedInvoice.truck_name || 'N/A'}</p>
                   </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
                   <h4 style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '12px' }}>Payment Breakdown</h4>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {parseFloat(selectedInvoice.zaad_amount) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}><span>ZAAD</span><span style={{ fontWeight: 700 }}>${parseFloat(selectedInvoice.zaad_amount).toFixed(2)}</span></div>}
                      {parseFloat(selectedInvoice.edahab_amount) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}><span>eDahab</span><span style={{ fontWeight: 700 }}>${parseFloat(selectedInvoice.edahab_amount).toFixed(2)}</span></div>}
                      {parseFloat(selectedInvoice.cash_amount) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}><span>Cash (USD)</span><span style={{ fontWeight: 700 }}>${parseFloat(selectedInvoice.cash_amount).toFixed(2)}</span></div>}
                      {parseFloat(selectedInvoice.slsh_amount) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}><span>Cash (SLSH)</span><span style={{ fontWeight: 700 }}>{parseFloat(selectedInvoice.slsh_amount).toLocaleString()}</span></div>}
                      {parseFloat(selectedInvoice.debt_amount) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#f59e0b' }}><span>Debt</span><span style={{ fontWeight: 700 }}>${parseFloat(selectedInvoice.debt_amount).toFixed(2)}</span></div>}
                      {parseFloat(selectedInvoice.discount_amount) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#be185d' }}><span>Discount Given</span><span style={{ fontWeight: 700 }}>-${parseFloat(selectedInvoice.discount_amount).toFixed(2)}</span></div>}
                   </div>
                   <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '2px solid #fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: '1rem' }}>Total Amount</span>
                      <span style={{ fontWeight: 900, fontSize: '1.5rem', color: 'var(--gurmad-green)' }}>${parseFloat(selectedInvoice.amount).toFixed(2)}</span>
                   </div>
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '10px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                       <img 
                         src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`GURMAD-INV-${selectedInvoice.id}-${selectedInvoice.amount}`)}`} 
                         alt="Payment QR"
                         style={{ width: '120px', height: '120px' }}
                       />
                    </div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Scan to Verify Payment</p>
                 </div>

                <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                   <button onClick={() => window.print()} className="btn-secondary" style={{ flex: 1, padding: '1rem', borderRadius: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <Printer size={18} /> Print
                   </button>
                   <button onClick={() => setSelectedInvoice(null)} className="btn-primary" style={{ flex: 1, padding: '1rem', borderRadius: '14px', fontWeight: 700 }}>
                      Done
                   </button>
                </div>
                <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '1.5rem' }}>Collector: {selectedInvoice.collector_name || 'System Auto'}</p>
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
