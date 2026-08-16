import React, { useState, useEffect } from 'react';
import { User, Lock, LogOut, Home, DollarSign, Truck, MessageSquare, Plus, Inbox, CheckCircle2, Clock, CreditCard, MapPin, Repeat, Tag, ShieldCheck, ChevronRight, Bell, ArrowLeft, Download, KeyRound, X, Camera, Eye, EyeOff, Globe, HelpCircle, Leaf, ArrowRight, Phone as PhoneIcon, MessageCircle, Wallet, Star, AlertTriangle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import jsPDF from 'jspdf';
import { api } from '../api';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Phase 8: Customer Portal — a completely separate, lightweight app served at /portal, with its
// own login (customer phone + password, granted by an admin via "Enable Portal Access" in
// Customers) and its own token type. Not part of the staff SPA in App.jsx at all.
//
// Redesign: mobile-app layout — phone-width column even on desktop, fixed bottom tab bar,
// big hero balance card, generous rounded corners and touch targets.
const GREEN = '#3FAE2A';
const GREEN_DARK = '#2d8c1e';
const PHONE_WIDTH = '430px';

// Full bilingual dictionary for the portal — 'so' (default, since most customers are Somali
// speakers) and 'en'. The SO/EN pill on the login screen was purely decorative before; it now
// actually drives every string below via the t() helper.
const STRINGS = {
  help: { so: 'Caawin', en: 'Help' },
  help_toast_contact: { so: 'Caawimo', en: 'Help' },
  help_toast_default: { so: "La xiriir shirkadda Gurmad si aad u hesho caawimo.", en: 'Contact Gurmad for assistance.' },
  welcome_tagline: { so: 'Ku soo dhaweow nidaamka casriga ah ee maamulka qashinka Gurmad', en: "Welcome to Gurmad's modern waste management system" },
  customer_portal: { so: 'Customer Portal', en: 'Customer Portal' },
  welcome_title: { so: 'Ku soo dhawoow!', en: 'Welcome!' },
  welcome_subtitle: { so: 'Fadlan geli akoonkaaga si aad u adeegato portal-ka.', en: 'Please log in to access your account.' },
  phone_label: { so: 'LAMBARKA TELEFOONKA', en: 'PHONE NUMBER' },
  password_label: { so: 'PASSWORD-KA', en: 'PASSWORD' },
  remember_me: { so: 'Xusuusnow akoonkayga', en: 'Remember me' },
  forgot_password: { so: 'Ihlaaw Password-ka?', en: 'Forgot Password?' },
  forgot_password_toast: { so: 'Fadlan la xiriir shirkadda Gurmad si loo dib-u-deeqo password-kaaga.', en: 'Please contact Gurmad to have your password reset.' },
  login: { so: 'Gal', en: 'Login' },
  logging_in: { so: 'Waa la gelayaa...', en: 'Logging in...' },
  or: { so: 'AMA', en: 'OR' },
  sms_login: { so: 'Ku gal Code SMS ah', en: 'Login with SMS Code' },
  sms_not_implemented: { so: 'SMS Code login weli lama hirgeliyay — fadlan isticmaal password-kaaga.', en: "SMS Code login isn't available yet — please use your password." },
  security_title: { so: 'Nidaam ammaan ah oo lagu kalsoon yahay', en: 'A secure system you can trust' },
  security_subtitle: { so: 'Xogtaada waa mid ammaan ah oo qarsoon.', en: 'Your data is safe and private.' },
  welcome_back: { so: 'Ku soo dhawoow', en: 'Welcome back' },
  login_success: { so: 'Ku soo dhawoow', en: 'Welcome' },
  change_photo: { so: 'Beddel sawirka', en: 'Change photo' },
  photo_updated: { so: 'Sawirkaaga waa la beddelay', en: 'Your photo has been updated' },
  outstanding_balance: { so: 'LACAGTA HARSAN', en: 'OUTSTANDING BALANCE' },
  monthly_fee: { so: 'KHARASHKA BISHII', en: 'MONTHLY FEE' },
  collector_label: { so: 'QAADAHA', en: 'COLLECTOR' },
  unassigned: { so: 'Aan la qoondayn', en: 'Unassigned' },
  tab_home: { so: 'Guriga', en: 'Home' },
  tab_payments: { so: 'Lacagaha', en: 'Payments' },
  tab_pickups: { so: 'Qaadista', en: 'Pickups' },
  tab_support: { so: 'Taageero', en: 'Support' },
  new_issue: { so: 'Dhibaato Cusub', en: 'New Issue' },
  next_pickup: { so: 'BOOQASHADA XIGTA', en: 'NEXT PICKUP' },
  today: { so: 'Maanta', en: 'Today' },
  my_service: { so: 'Adeegayga', en: 'My Service' },
  category: { so: 'Nooca', en: 'Category' },
  frequency: { so: 'Inta jeer', en: 'Frequency' },
  zone: { so: 'Aagga', en: 'Zone' },
  address: { so: 'Cinwaanka', en: 'Address' },
  house: { so: 'Guri', en: 'House' },
  last_collection: { so: 'Qaadistii u Dambeysay', en: 'Last Collection' },
  collected_by: { so: 'waxaa qaaday', en: 'collected by' },
  na: { so: 'N/A', en: 'N/A' },
  payment_history: { so: 'Taariikhda Lacagaha', en: 'Payment History' },
  no_payment_history: { so: 'Weli lacag lama bixin.', en: 'No payment history yet.' },
  collection_history: { so: 'Taariikhda Qaadista', en: 'Collection History' },
  no_collection_history: { so: 'Weli qaadis ma jirto.', en: 'No collection history yet.' },
  not_scheduled: { so: 'Weli lama qorsheynin', en: 'Not yet scheduled' },
  collected: { so: 'La qaaday', en: 'Collected' },
  pending: { so: 'Sugaya', en: 'Pending' },
  unpaid: { so: 'Aan la bixin', en: 'Unpaid' },
  download_receipt: { so: 'Soo Deji Rasiidka', en: 'Download Receipt' },
  receipt_failed: { so: 'Rasiidka lama samayn karin', en: 'Failed to generate receipt' },
  support: { so: 'Taageero', en: 'Support' },
  new_button: { so: 'Cusub', en: 'New' },
  complaint_title_label: { so: 'Cinwaanka', en: 'Title' },
  complaint_description_label: { so: 'Sharraxaad', en: 'Description' },
  complaint_photo_label: { so: 'Sawir (Ikhtiyaari)', en: 'Photo (Optional)' },
  cancel: { so: 'Jooji', en: 'Cancel' },
  submit: { so: 'Dir', en: 'Submit' },
  no_complaints: { so: 'Weli cabasho ma dirin.', en: 'No complaints submitted yet.' },
  view_photo: { so: '📷 Sawirka eeg', en: '📷 View Photo' },
  gurmad_reply: { so: 'Jawaabta Gurmad', en: "Gurmad's Reply" },
  complaint_submitted: { so: 'Waa la diray cabashadaada', en: 'Your complaint has been submitted' },
  complaint_failed: { so: 'Cabashada lama dirin karin', en: 'Failed to submit complaint' },
  notifications_title: { so: 'Ogeysiisyada', en: 'Notifications' },
  no_notifications: { so: 'Ogeysiis kuma jiro weli', en: 'No notifications yet' },
  change_password_title: { so: 'Beddel Password', en: 'Change Password' },
  current_password: { so: 'Password-ka hadda', en: 'Current Password' },
  new_password: { so: 'Password Cusub (ugu yaraan 6 xaraf)', en: 'New Password (min 6 characters)' },
  confirm_password: { so: 'Ku celi Password-ka Cusub', en: 'Confirm New Password' },
  changing: { so: 'Waa la beddelayaa...', en: 'Changing...' },
  passwords_mismatch: { so: 'Password-yadu isku mid ma aha', en: 'Passwords do not match' },
  password_changed: { so: 'Password-kaaga waa la beddelay', en: 'Your password has been changed' },
  password_change_failed: { so: 'Password-ka lama beddeli karin', en: 'Failed to change password' },
  photo_upload_failed: { so: 'Sawirka lama soo geli karin', en: 'Failed to upload photo' },
  loading: { so: 'Waa soo shubmayaa...', en: 'Loading...' },
  login_failed: { so: 'Gelitaanka wuu fashilmay', en: 'Login failed' },
  time_now: { so: 'Hadda', en: 'Now' },
  time_min_ago: { so: 'daq ka hor', en: 'm ago' },
  time_hr_ago: { so: 'saac ka hor', en: 'h ago' },
  time_day_ago: { so: 'maalin ka hor', en: 'd ago' },
  how_to_pay: { so: 'Sida Loo Bixiyo', en: 'How to Pay' },
  how_to_pay_desc: { so: 'Waxaad ku bixin kartaa qaadaha marka uu yimaado (Cash), ama ka wac shirkadda si aad u hesho lambarrada ZAAD/eDahab.', en: 'Pay in cash when your collector arrives, or contact us for ZAAD/eDahab payment numbers.' },
  call_us: { so: 'Nala soo Wac', en: 'Call Us' },
  whatsapp_us: { so: 'WhatsApp', en: 'WhatsApp' },
  my_collector: { so: 'Qaadahayga', en: 'My Collector' },
  call_collector: { so: 'Wac Qaadaha', en: 'Call Collector' },
  no_phone_on_file: { so: 'Lambarka taleefanka lama diiwaan gelin', en: 'No phone number on file' },
  account: { so: 'Akoonka', en: 'Account' },
  account_info: { so: 'Xogta Akoonka', en: 'Account Info' },
  change_password: { so: 'Beddel Password', en: 'Change Password' },
  request_change: { so: 'Codso Isbeddel Xog', en: 'Request Profile Change' },
  help_faq: { so: 'Caawimo / Su’aalo Badanaa La Weydiiyo', en: 'Help / FAQ' },
  filter_all: { so: 'Dhammaan', en: 'All' },
  filter_paid: { so: 'La Bixiyay', en: 'Paid' },
  filter_unpaid: { so: 'Aan La Bixin', en: 'Unpaid' },
  download_statement: { so: 'Soo Deji Xisaabta (CSV)', en: 'Download Statement (CSV)' },
  no_records_filter: { so: 'Wax diiwaan ah lagama helin.', en: 'No records match this filter.' },
  edit_request_desc: { so: 'Haddii cinwaankaaga ama lambarka telefoonkaaga uu beddelmay, halkan ka codso — shirkaddu way eegi doontaa waana ay hubin doontaa ka hor inta aysan wax beddelin.', en: "If your address or phone number has changed, request it here — we'll review and confirm before updating anything." },
  new_phone: { so: 'Lambarka Telefoonka Cusub', en: 'New Phone Number' },
  new_area: { so: 'Aagga Cusub', en: 'New Area' },
  new_house: { so: 'Guriga Cusub (Lambarka)', en: 'New House Number' },
  note_optional: { so: 'Faahfaahin Dheeraad ah (Ikhtiyaari)', en: 'Additional Notes (Optional)' },
  submit_request: { so: 'Dir Codsiga', en: 'Submit Request' },
  edit_request_sent: { so: 'Codsigaaga waa la diray. Shirkaddu way la soo xiriiri doontaa.', en: "Your request has been sent. We'll follow up with you." },
  edit_request_failed: { so: 'Codsiga lama diri karin', en: 'Failed to submit request' },
  faq_q1: { so: 'Sideen u bixiyaa lacagta?', en: 'How do I pay my bill?' },
  faq_a1: { so: 'Waxaad ku bixin kartaa qaadaha marka uu yimaado (Cash), ama nala soo wac si aad u hesho lambarrada ZAAD/eDahab.', en: "Pay your collector in cash when they arrive, or call us for ZAAD/eDahab payment numbers." },
  faq_q2: { so: 'Goorma ayaa qashinkayga la qaadi doonaa?', en: 'When will my trash be collected?' },
  faq_a2: { so: 'Booqashada xigta waxaad ka arki kartaa bogga hore ee “Guriga”, ee ku salaysan jadwalka aagga (route) aad ku nooshahay.', en: "Check the 'Home' tab for your Next Pickup — it's based on your zone's route schedule." },
  faq_q3: { so: 'Sideen u soo wariyaa dhibaato?', en: 'How do I report a problem?' },
  faq_a3: { so: 'Aad u tab-ka “Taageero” oo riix “Cusub” si aad u soo dirto cabasho, sawir haddii loo baahdo.', en: "Go to the 'Support' tab and tap 'New' to submit a complaint, with a photo if needed." },
  faq_q4: { so: 'Sideen u beddelaa cinwaankayga ama lambarkayga?', en: 'How do I update my address or phone number?' },
  faq_a4: { so: 'Ka riix Akoonka (magacaaga kore) kadibna “Codso Isbeddel Xog”.', en: "Tap Account (your name up top) then 'Request Profile Change'." },
  report_missed: { so: 'Lama Qaadin — Sheeg', en: 'Report Missed Pickup' },
  missed_confirm_title: { so: 'Ma xaqiijineysaa?', en: 'Confirm report' },
  missed_confirm_desc: { so: 'Waxaad sheegeysaa in qashinkaaga aan la qaadin maanta, in kasta oo la filayay. Shirkadda ayaa la soo xiriiri doonta.', en: "You're reporting that your trash wasn't collected today, even though it was scheduled. Staff will follow up." },
  confirm: { so: 'Xaqiiji', en: 'Confirm' },
  missed_reported: { so: 'Waa la soo sheegay in aan la qaadin — waan la soo xiriiri doonaa.', en: "Reported — we'll follow up with you." },
  missed_report_failed: { so: 'Lama soo sheegi karin', en: 'Failed to submit report' },
  truck_tracking: { so: 'Halka Uu Joogo Gaadhiga', en: 'Truck Location' },
  truck_en_route: { so: 'Wuu socdaa xaggaaga', en: 'On its way to your area' },
};
// t(key, lang) looks up STRINGS[key][lang]; falls back to the key itself if missing so a typo
// shows up as visible mismatched text instead of silently rendering blank.
const translate = (key, lang) => STRINGS[key]?.[lang] || key;

const statusPalette = (variant) => ({
  good: { bg: '#dcfce7', fg: '#15803d', dot: '#22c55e' },
  bad: { bg: '#fef2f2', fg: '#b91c1c', dot: '#ef4444' },
  warn: { bg: '#fffbeb', fg: '#b45309', dot: '#f59e0b' },
  info: { bg: '#dbeafe', fg: '#1d4ed8', dot: '#3b82f6' },
}[variant]);

const Badge = ({ children, variant = 'info' }) => {
  const p = statusPalette(variant);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 11px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800, background: p.bg, color: p.fg, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.dot }} />
      {children}
    </span>
  );
};

const EmptyState = ({ icon: Icon, text }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '3rem 1rem', color: '#94a3b8' }}>
    <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={26} color="#cbd5e1" />
    </div>
    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{text}</div>
  </div>
);

const Card = ({ children, style, onClick }) => (
  <div className="gp-card" onClick={onClick} style={{ background: 'white', borderRadius: '22px', border: '1px solid #f1f5f9', boxShadow: '0 2px 10px rgba(15,23,42,0.04)', cursor: onClick ? 'pointer' : 'default', ...style }}>
    {children}
  </div>
);

const CustomerPortalApp = () => {
  const [customer, setCustomer] = useState(() => {
    const saved = localStorage.getItem('gurmadCustomer');
    return saved ? JSON.parse(saved) : null;
  });
  const [phone, setPhone] = useState(() => localStorage.getItem('gurmadCustomerPhone') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('gurmadCustomerPhone'));
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [tab, setTab] = useState('dashboard');

  const [payments, setPayments] = useState([]);
  const [collections, setCollections] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [newComplaint, setNewComplaint] = useState({ title: '', description: '' });
  const [newComplaintPhoto, setNewComplaintPhoto] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [isChangingPw, setIsChangingPw] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showEditRequest, setShowEditRequest] = useState(false);
  const [editRequestForm, setEditRequestForm] = useState({ phone: '', area: '', house_no: '', note: '' });
  const [isSubmittingEditRequest, setIsSubmittingEditRequest] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [openFAQIndex, setOpenFAQIndex] = useState(null);
  const [paymentsFilter, setPaymentsFilter] = useState('all');
  const [truckLocation, setTruckLocation] = useState(null);
  const [isSubmittingMissed, setIsSubmittingMissed] = useState(false);
  const [showMissedConfirm, setShowMissedConfirm] = useState(false);
  const [companyLogo, setCompanyLogo] = useState('');
  const [logoError, setLogoError] = useState(false);
  const [company, setCompany] = useState({ name: 'Gurmad Waste Management', phone: '', email: '' });
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = React.useRef(null);
  const [lang, setLang] = useState(() => localStorage.getItem('gurmadPortalLang') || 'so');
  const t = (key) => translate(key, lang);
  const toggleLang = () => {
    const next = lang === 'so' ? 'en' : 'so';
    setLang(next);
    localStorage.setItem('gurmadPortalLang', next);
  };

  // On an actual phone the "phone mockup floating on a gray backdrop" look (fixed max-width,
  // rounded corners, shadow, padding) just eats into an already-small screen — it only makes
  // sense on desktop/tablet where there's spare width around it. Below 480px we go edge-to-edge
  // instead: full width, full height, no card chrome, so the portal opens correctly filling the
  // whole screen on any phone size rather than looking like a shrunk-down app-in-an-app.
  const [isMobileViewport, setIsMobileViewport] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 480);
  useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth <= 480);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (customer) fetchAll();
  }, [customer?.id]);

  // Live truck tracking — only worth polling on the customer's own pickup day, so this stays
  // idle (no location card, no wasted requests) every other day. Polls rather than a socket
  // connection since the portal is a separate lightweight app from the staff SPA that owns the
  // socket.io client.
  useEffect(() => {
    if (!customer || !customer.next_pickup?.isToday) { setTruckLocation(null); return; }
    const poll = () => api.customerPortal.getTruckLocation().then(setTruckLocation).catch(() => {});
    poll();
    const interval = setInterval(poll, 20000);
    return () => clearInterval(interval);
  }, [customer?.id, customer?.next_pickup?.isToday]);

  // Company logo/name/contact — same /api/settings + /api/uploads pattern the staff sidebar
  // uses (App.jsx), fetched without auth (public route) for both the login screen and the
  // in-app receipt PDF, which needs the real company details, not placeholders.
  useEffect(() => {
    api.getSettings().then(data => {
      setCompanyLogo(data.system_logo || '');
      setCompany({ name: data.company_name || 'Gurmad Waste Management', phone: data.contact_phone || '', email: data.support_email || '' });
    }).catch(() => {});
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [me, pay, col, comp, notifs] = await Promise.all([
        api.customerPortal.getMe(),
        api.customerPortal.getPayments(),
        api.customerPortal.getCollections(),
        api.customerPortal.getComplaints(),
        api.customerPortal.getNotifications().catch(() => []),
      ]);
      const updated = { ...customer, ...me };
      setCustomer(updated);
      localStorage.setItem('gurmadCustomer', JSON.stringify(updated));
      setPayments(pay);
      setCollections(col);
      setComplaints(comp);
      setNotifications(notifs);
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('access denied')) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const openNotifications = async () => {
    setShowNotifications(true);
    if (unreadCount > 0) {
      try {
        await api.customerPortal.markAllNotificationsRead();
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      } catch (err) { /* non-critical */ }
    }
  };

  // Fetches an image URL and returns it as a data: URL, so it can be embedded in the PDF
  // (jsPDF's addImage needs a data URL or raw bytes, not a plain <img src>).
  const urlToDataURL = (url) => fetch(url)
    .then(res => res.blob())
    .then(blob => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }));

  // Real invoice/receipt PDF, generated entirely client-side with jsPDF and saved directly via
  // doc.save() — a genuine file download triggered by the click, not a new window, so it can't
  // be blocked by a pop-up blocker the way window.open()-based printing was.
  const downloadReceipt = async (p) => {
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const green = [63, 174, 42];
      const gray = [100, 116, 139];
      const dark = [15, 23, 42];
      let y = 50;

      // Logo
      if (companyLogo) {
        try {
          const dataUrl = await urlToDataURL(`/api/uploads/${companyLogo}`);
          const fmt = dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(dataUrl, fmt, 40, y - 10, 44, 44);
        } catch (e) { /* logo optional — fall through without it */ }
      }

      const textX = companyLogo ? 96 : 40;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...green);
      doc.text(company.name, textX, y + 8);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...gray);
      const contactLine = [company.phone, company.email].filter(Boolean).join('  ·  ');
      if (contactLine) doc.text(contactLine, textX, y + 24);

      y += 60;
      doc.setDrawColor(230, 230, 230); doc.line(40, y, pageWidth - 40, y);
      y += 30;

      doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...dark);
      doc.text('RECEIPT', 40, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...gray);
      doc.text(`Receipt #${p.id}`, pageWidth - 40, y - 12, { align: 'right' });
      doc.text(new Date(p.created_at).toLocaleString(), pageWidth - 40, y + 2, { align: 'right' });

      y += 30;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...gray);
      doc.text('BILL TO', 40, y);
      y += 16;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...dark);
      doc.text(customer.name || '-', 40, y);
      y += 16;
      doc.setFontSize(9); doc.setTextColor(...gray);
      doc.text(customer.phone || '-', 40, y);
      if (customer.area || customer.house_no) {
        y += 14;
        doc.text(`House ${customer.house_no || '-'}, ${customer.area || '-'}`, 40, y);
      }

      y += 34;
      doc.setDrawColor(240, 240, 240); doc.setFillColor(248, 250, 252);
      doc.rect(40, y, pageWidth - 80, 22, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...gray);
      doc.text('DESCRIPTION', 48, y + 15);
      doc.text('AMOUNT', pageWidth - 48, y + 15, { align: 'right' });
      y += 22;

      // Breakdown by payment method — only rows with a non-zero amount are printed.
      const rows = [
        ['Cash', p.cash_amount],
        ['ZAAD', p.zaad_amount],
        ['eDahab', p.edahab_amount],
        ['SLSH', p.slsh_amount],
        ['Debt (unpaid)', p.debt_amount],
      ].filter(([, amt]) => parseFloat(amt) > 0);
      if (rows.length === 0) rows.push([p.payment_method || 'Payment', p.amount]);

      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...dark);
      for (const [label, amt] of rows) {
        y += 22;
        doc.text(label, 48, y);
        doc.text(`$${parseFloat(amt).toFixed(2)}`, pageWidth - 48, y, { align: 'right' });
        doc.setDrawColor(245, 245, 245); doc.line(40, y + 8, pageWidth - 40, y + 8);
      }
      if (parseFloat(p.discount_amount) > 0) {
        y += 22;
        doc.setTextColor(...gray);
        doc.text('Discount', 48, y);
        doc.text(`-$${parseFloat(p.discount_amount).toFixed(2)}`, pageWidth - 48, y, { align: 'right' });
        doc.setDrawColor(245, 245, 245); doc.line(40, y + 8, pageWidth - 40, y + 8);
      }

      y += 34;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...gray);
      doc.text('TOTAL', 48, y);
      doc.setFontSize(18); doc.setTextColor(...green);
      doc.text(`$${parseFloat(p.amount).toFixed(2)}`, pageWidth - 48, y, { align: 'right' });

      y += 16;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(p.status === 'Paid' ? green[0] : 200, p.status === 'Paid' ? green[1] : 80, p.status === 'Paid' ? green[2] : 80);
      doc.text(`Status: ${p.status}`, pageWidth - 48, y, { align: 'right' });

      y += 60;
      doc.setDrawColor(230, 230, 230); doc.line(40, y, pageWidth - 40, y);
      y += 20;
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...gray);
      doc.text('Waan ku mahadsanahay adeegga aad naga heshay. / Thank you for your business.', 40, y);

      doc.save(`Receipt-${p.id}.pdf`);
    } catch (err) {
      toast.error(t('receipt_failed'));
    }
  };

  // Customer profile photo upload — reuses the file input pattern, no crop/preview step, just
  // pick a photo and it uploads immediately.
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const result = await api.customerPortal.uploadPhoto(formData);
      const updated = { ...customer, photo: result.photo };
      setCustomer(updated);
      localStorage.setItem('gurmadCustomer', JSON.stringify(updated));
      toast.success(t('photo_updated'));
    } catch (err) {
      toast.error(err.message || t('photo_upload_failed'));
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const timeAgo = (dateStr) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return t('time_now');
    if (mins < 60) return `${mins}${t('time_min_ago')}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}${t('time_hr_ago')}`;
    return `${Math.floor(hrs / 24)}${t('time_day_ago')}`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const data = await api.customerPortal.login(phone, password);
      localStorage.setItem('gurmadCustomer', JSON.stringify(data));
      if (rememberMe) localStorage.setItem('gurmadCustomerPhone', phone);
      else localStorage.removeItem('gurmadCustomerPhone');
      setCustomer(data);
      toast.success(`${t('login_success')}, ${data.name}!`);
    } catch (err) {
      toast.error(err.message || t('login_failed'));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error(t('passwords_mismatch'));
      return;
    }
    setIsChangingPw(true);
    try {
      await api.customerPortal.changePassword(pwForm.currentPassword, pwForm.newPassword);
      toast.success(t('password_changed'));
      setShowChangePassword(false);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.message || t('password_change_failed'));
    } finally {
      setIsChangingPw(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gurmadCustomer');
    setCustomer(null);
    setTab('dashboard');
  };

  const handleComplaintSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('title', newComplaint.title);
      formData.append('description', newComplaint.description);
      if (newComplaintPhoto) formData.append('photo', newComplaintPhoto);
      await api.customerPortal.addComplaint(formData);
      toast.success(t('complaint_submitted'));
      setShowComplaintForm(false);
      setNewComplaint({ title: '', description: '' });
      setNewComplaintPhoto(null);
      const comp = await api.customerPortal.getComplaints();
      setComplaints(comp);
    } catch (err) {
      toast.error(t('complaint_failed'));
    }
  };

  // Profile-change requests deliberately don't write straight to the customer record — updating
  // address/phone is exactly the kind of change that should go through staff review first (same
  // segregation-of-duties idea used elsewhere in this app). Routed through the existing
  // complaints inbox rather than a new table/route, so it lands wherever staff already handle
  // customer-submitted items, tagged clearly so it doesn't get mistaken for a service complaint.
  const handleEditRequestSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingEditRequest(true);
    try {
      const parts = [];
      if (editRequestForm.phone) parts.push(`New phone: ${editRequestForm.phone}`);
      if (editRequestForm.area) parts.push(`New area: ${editRequestForm.area}`);
      if (editRequestForm.house_no) parts.push(`New house #: ${editRequestForm.house_no}`);
      if (editRequestForm.note) parts.push(`Note: ${editRequestForm.note}`);
      const formData = new FormData();
      formData.append('title', 'Profile Change Request');
      formData.append('description', `Customer requests the following update(s):\n${parts.join('\n')}`);
      await api.customerPortal.addComplaint(formData);
      toast.success(t('edit_request_sent'));
      setShowEditRequest(false);
      setEditRequestForm({ phone: '', area: '', house_no: '', note: '' });
    } catch (err) {
      toast.error(t('edit_request_failed'));
    } finally {
      setIsSubmittingEditRequest(false);
    }
  };

  // Routed through the same complaints inbox as everything else customer-submitted, tagged
  // distinctly ('Missed Pickup') so staff can tell it apart from a general complaint at a glance
  // — deliberately not the same table as the staff-side "mark missed" (task_customers.missed),
  // since this is the customer's own report, not a confirmed collector observation.
  const handleReportMissed = async () => {
    setIsSubmittingMissed(true);
    try {
      const formData = new FormData();
      formData.append('title', 'Missed Pickup');
      formData.append('description', `Customer reports their trash was not collected today (${new Date().toLocaleDateString()}), despite being scheduled.`);
      await api.customerPortal.addComplaint(formData);
      toast.success(t('missed_reported'));
      setShowMissedConfirm(false);
      const comp = await api.customerPortal.getComplaints();
      setComplaints(comp);
    } catch (err) {
      toast.error(t('missed_report_failed'));
    } finally {
      setIsSubmittingMissed(false);
    }
  };

  const paymentsFiltered = payments.filter(p => paymentsFilter === 'all' ? true : paymentsFilter === 'paid' ? p.status === 'Paid' : p.status !== 'Paid');

  // Client-side CSV export of the full billing history (all invoices, paid and unpaid) — a real
  // downloadable file via a Blob + object URL, not a fake button.
  const downloadStatementCSV = () => {
    const header = ['Date', 'Amount', 'Method', 'Status'];
    const rows = payments.map(p => [new Date(p.created_at).toLocaleDateString(), parseFloat(p.amount).toFixed(2), p.payment_method || '', p.status]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Statement-${customer.name || 'customer'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const FAQ_ITEMS = ['faq_q1', 'faq_q2', 'faq_q3', 'faq_q4'];

  const outstandingBalance = payments.filter(p => p.status === 'Unpaid').reduce((sum, p) => sum + (parseFloat(p.debt_amount) || parseFloat(p.amount) || 0), 0);
  const lastCollection = collections.find(c => c.collected && c.collected_at);
  const isPaid = customer?.status === 'Paid';

  const inputStyle = { width: '100%', padding: '0.9rem 0.9rem 0.9rem 2.7rem', borderRadius: '16px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '1rem', outline: 'none', transition: 'border-color 0.15s', background: '#f8fafc' };

  // Zones set their visiting time via a 24h <input type="time"> (e.g. "08:00") in the Route
  // Calendar; older zones may still have a free-text value like "8:00 AM". Format the former
  // nicely for display and pass the latter through unchanged.
  const formatPickupTime = (value) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec((value || '').trim());
    if (!match) return value;
    let [, h, m] = match.map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  // ============ LOGIN SCREEN ============
  if (!customer) {
    return (
      <div style={{ minHeight: '100dvh', background: '#eef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobileViewport ? 0 : '1rem' }}>
        <Toaster />
        <div style={{
          width: '100%', maxWidth: isMobileViewport ? '100%' : PHONE_WIDTH,
          minHeight: '100dvh', maxHeight: isMobileViewport ? 'none' : '900px',
          background: 'white', borderRadius: isMobileViewport ? 0 : '32px',
          boxShadow: isMobileViewport ? 'none' : '0 30px 70px -15px rgba(15,23,42,0.25)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column'
        }}>
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>

            {/* Hero */}
            <div style={{ background: `linear-gradient(160deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`, padding: '1.3rem 1.5rem 3.2rem', textAlign: 'center', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ position: 'absolute', bottom: '20px', left: '-50px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

              {/* top bar: language + help */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1, marginBottom: '1rem' }}>
                <button
                  onClick={toggleLang}
                  title={lang === 'so' ? 'Switch to English' : 'U beddel Soomaali'}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '100px', padding: '6px 12px', color: 'white', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  <Globe size={13} /> {lang.toUpperCase()}
                </button>
                <button
                  onClick={() => toast(company.phone || company.email ? `${t('help_toast_contact')}: ${[company.phone, company.email].filter(Boolean).join(' · ')}` : t('help_toast_default'), { icon: '💬' })}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '100px', padding: '6px 12px', color: 'white', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  <HelpCircle size={13} /> {t('help')}
                </button>
              </div>

              <div style={{ width: '88px', height: '88px', borderRadius: '24px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.6rem auto 1rem', boxShadow: '0 10px 26px rgba(0,0,0,0.18)', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
                {companyLogo && !logoError ? (
                  <img src={`/api/uploads/${companyLogo}`} alt="Gurmad" onError={() => setLogoError(true)} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '10px', boxSizing: 'border-box' }} />
                ) : (
                  <Home size={36} color={GREEN} />
                )}
              </div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0, color: 'white', letterSpacing: '-0.02em', position: 'relative', zIndex: 1 }}>GURMAD</h1>
              <p style={{ color: '#d9f7cf', fontSize: '1.05rem', margin: '2px 0 0 0', fontWeight: 800, position: 'relative', zIndex: 1 }}>{t('customer_portal')}</p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', margin: '14px 0', position: 'relative', zIndex: 1 }}>
                <span style={{ width: '30px', height: '1px', background: 'rgba(255,255,255,0.4)' }} />
                <Leaf size={14} color="rgba(255,255,255,0.7)" />
                <span style={{ width: '30px', height: '1px', background: 'rgba(255,255,255,0.4)' }} />
              </div>
              <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.88rem', margin: 0, lineHeight: 1.5, position: 'relative', zIndex: 1, maxWidth: '280px', marginLeft: 'auto', marginRight: 'auto' }}>
                {t('welcome_tagline')}
              </p>
            </div>

            {/* White sheet overlapping the hero, rounded top corners */}
            <div style={{ background: 'white', borderRadius: '28px 28px 0 0', marginTop: '-22px', position: 'relative', zIndex: 2, padding: '2rem 1.6rem 1.8rem', flex: 1 }}>
              <div style={{ width: '58px', height: '58px', borderRadius: '18px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <ShieldCheck size={26} color={GREEN} />
              </div>
              <h2 style={{ textAlign: 'center', fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>{t('welcome_title')}</h2>
              <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1.6rem', lineHeight: 1.5 }}>{t('welcome_subtitle')}</p>

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: GREEN_DARK, marginBottom: '8px', letterSpacing: '0.3px' }}>{t('phone_label')}</label>
                  <div style={{ position: 'relative' }}>
                    <PhoneIcon size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: GREEN }} />
                    <input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="0634xxxxxx"
                      onFocus={e => { e.target.style.borderColor = GREEN; e.target.style.background = 'white'; }}
                      onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                      style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: GREEN_DARK, marginBottom: '8px', letterSpacing: '0.3px' }}>{t('password_label')}</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: GREEN }} />
                    <input required type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="********"
                      onFocus={e => { e.target.style.borderColor = GREEN; e.target.style.background = 'white'; }}
                      onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                      style={{ ...inputStyle, paddingRight: '2.6rem' }} />
                    <button type="button" onClick={() => setShowPassword(s => !s)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}>
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '-0.3rem 0 0.1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>
                    <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                      style={{ width: '17px', height: '17px', accentColor: GREEN, cursor: 'pointer' }} />
                    {t('remember_me')}
                  </label>
                  <button type="button" onClick={() => toast(t('forgot_password_toast'), { icon: '🔑' })} style={{ background: 'none', border: 'none', color: GREEN_DARK, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                    {t('forgot_password')}
                  </button>
                </div>

                <button type="submit" disabled={isLoggingIn} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                  padding: '1.05rem', borderRadius: '18px', border: 'none',
                  background: isLoggingIn ? '#86c976' : `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`,
                  color: 'white', fontWeight: 800, fontSize: '1rem', cursor: isLoggingIn ? 'default' : 'pointer', marginTop: '0.3rem',
                  boxShadow: '0 10px 24px rgba(63,174,42,0.32)'
                }}>
                  {isLoggingIn ? t('logging_in') : (<><Lock size={16} /> {t('login')} <ArrowRight size={16} /></>)}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '0.3rem 0' }}>
                  <span style={{ flex: 1, height: '1px', background: '#f1f5f9' }} />
                  <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 800 }}>{t('or')}</span>
                  <span style={{ flex: 1, height: '1px', background: '#f1f5f9' }} />
                </div>

                <button type="button" onClick={() => toast(t('sms_not_implemented'), { icon: 'ℹ️' })} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                  padding: '1rem', borderRadius: '18px', border: '1.5px solid #e2e8f0', background: 'white',
                  color: GREEN_DARK, fontWeight: 800, fontSize: '0.92rem', cursor: 'pointer'
                }}>
                  <MessageCircle size={17} /> {t('sms_login')}
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#f0fdf4', borderRadius: '16px', padding: '0.9rem 1rem', marginTop: '1.4rem' }}>
                <ShieldCheck size={18} color={GREEN} style={{ flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#15803d' }}>{t('security_title')}</div>
                  <div style={{ fontSize: '0.76rem', color: '#4d7c0f', marginTop: '2px' }}>{t('security_subtitle')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ APP SHELL ============
  const tabs = [
    { id: 'dashboard', label: t('tab_home'), icon: Home },
    { id: 'payments', label: t('tab_payments'), icon: DollarSign },
    { id: 'collections', label: t('tab_pickups'), icon: Truck },
    { id: 'complaints', label: t('tab_support'), icon: MessageSquare },
  ];

  return (
    <div style={{ minHeight: '100dvh', background: '#eef2f2', display: 'flex', justifyContent: 'center' }}>
      <Toaster />
      <style>{`
        @keyframes gp-spin { to { transform: rotate(360deg); } }
        @keyframes gp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .gp-btn { transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease; }
        .gp-btn:hover { transform: translateY(-1px); }
        .gp-btn:active { transform: translateY(0); }
        .gp-card { transition: box-shadow 0.15s ease, transform 0.15s ease; }
        .gp-card:hover { box-shadow: 0 6px 20px rgba(15,23,42,0.08); }
      `}</style>
      <div style={{
        width: '100%', maxWidth: isMobileViewport ? '100%' : PHONE_WIDTH,
        minHeight: '100dvh', background: '#f8fafc',
        boxShadow: isMobileViewport ? 'none' : '0 0 60px rgba(15,23,42,0.08)',
        display: 'flex', flexDirection: 'column', position: 'relative'
      }}>

        {/* Status-bar style header */}
        <div style={{ padding: '1.4rem 1.3rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '13px', background: customer.photo ? '#f1f5f9' : `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.1rem', fontWeight: 900, overflow: 'hidden' }}>
                {customer.photo ? (
                  <img src={`/api/uploads/${customer.photo}`} alt={customer.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (customer.name?.[0]?.toUpperCase() || 'G')}
              </div>
              <button onClick={() => photoInputRef.current?.click()} disabled={isUploadingPhoto} title={t('change_photo')} style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', border: '2px solid #f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                <Camera size={9} color={GREEN} />
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </div>
            <button onClick={() => setShowAccount(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>{t('welcome_back')}</div>
              <div style={{ fontSize: '1.02rem', fontWeight: 800, color: '#0f172a' }}>{customer.name}</div>
            </button>
          </div>
          <div style={{ display: 'flex', gap: '9px' }}>
            <button onClick={toggleLang} title={lang === 'so' ? 'Switch to English' : 'U beddel Soomaali'} style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'white', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(15,23,42,0.06)', fontSize: '0.68rem', fontWeight: 800, color: GREEN_DARK }}>
              {lang.toUpperCase()}
            </button>
            <button onClick={openNotifications} style={{ position: 'relative', width: '38px', height: '38px', borderRadius: '12px', background: 'white', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
              <Bell size={16} color="#64748b" />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', minWidth: '17px', height: '17px', borderRadius: '9px', background: '#ef4444', color: 'white', fontSize: '0.62rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid #f8fafc' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button onClick={handleLogout} style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'white', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
              <LogOut size={16} color="#64748b" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.3rem 1.3rem 1rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontWeight: 600 }}>
              <div style={{ width: '30px', height: '30px', margin: '0 auto 12px', border: `3px solid #e2e8f0`, borderTopColor: GREEN, borderRadius: '50%', animation: 'gp-spin 0.7s linear infinite' }} />
              {t('loading')}
            </div>
          ) : tab === 'dashboard' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {/* Hero balance card */}
              <div style={{ background: `linear-gradient(160deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`, borderRadius: '26px', padding: '1.8rem', color: 'white', position: 'relative', overflow: 'hidden', boxShadow: '0 15px 35px -8px rgba(63,174,42,0.4)' }}>
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.85, fontWeight: 700, marginBottom: '6px' }}>{t('outstanding_balance')}</div>
                    <div style={{ fontSize: '2.1rem', fontWeight: 900, letterSpacing: '-0.02em' }}>${outstandingBalance.toFixed(2)}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '12px', padding: '6px 12px', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {isPaid ? <CheckCircle2 size={13} /> : <Clock size={13} />} {customer.status === 'Paid' ? t('collected') : (customer.status || t('unpaid'))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.3rem', position: 'relative', zIndex: 1 }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', opacity: 0.8, fontWeight: 700 }}>{t('monthly_fee')}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800 }}>${parseFloat(customer.fee || 0).toFixed(2)}</div>
                  </div>
                  <div style={{ width: '1px', background: 'rgba(255,255,255,0.25)' }} />
                  <div>
                    <div style={{ fontSize: '0.68rem', opacity: 0.8, fontWeight: 700 }}>{t('collector_label')}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800 }}>{customer.collector_name || t('unassigned')}</div>
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem' }}>
                {[
                  { label: t('tab_payments'), icon: DollarSign, action: () => setTab('payments') },
                  { label: t('tab_pickups'), icon: Truck, action: () => setTab('collections') },
                  { label: t('tab_support'), icon: MessageSquare, action: () => setTab('complaints') },
                  { label: t('new_issue'), icon: Plus, action: () => { setTab('complaints'); setShowComplaintForm(true); } },
                ].map((qa, i) => (
                  <button key={i} className="gp-btn" onClick={qa.action} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', background: 'white', border: '1px solid #f1f5f9', borderRadius: '18px', padding: '0.9rem 0.4rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <qa.icon size={17} color={GREEN} />
                    </div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', textAlign: 'center' }}>{qa.label}</span>
                  </button>
                ))}
              </div>

              {/* How to Pay — a real gap: customers could see "Outstanding Balance" with no way
                  to find out how to actually pay it. One tap now calls or WhatsApps the company. */}
              {outstandingBalance > 0 && (company.phone) && (
                <Card style={{ padding: '1.2rem 1.3rem', background: '#fffbeb', border: '1px solid #fde68a' }}>
                  <div style={{ display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Wallet size={17} color="#b45309" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, color: '#92400e', fontSize: '0.9rem' }}>{t('how_to_pay')}</div>
                      <div style={{ fontSize: '0.8rem', color: '#a16207', marginTop: '3px', lineHeight: 1.45 }}>{t('how_to_pay_desc')}</div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <a href={`tel:${company.phone}`} className="gp-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.55rem 0.9rem', borderRadius: '12px', background: '#f59e0b', color: 'white', fontWeight: 800, fontSize: '0.78rem', textDecoration: 'none' }}>
                          <PhoneIcon size={13} /> {t('call_us')}
                        </a>
                        <a href={`https://wa.me/${company.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="gp-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.55rem 0.9rem', borderRadius: '12px', background: 'white', border: '1px solid #fde68a', color: '#92400e', fontWeight: 800, fontSize: '0.78rem', textDecoration: 'none' }}>
                          <MessageCircle size={13} /> {t('whatsapp_us')}
                        </a>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {customer.next_pickup && (
                <Card style={{ padding: '1.2rem 1.3rem', background: customer.next_pickup.isToday ? '#f0fdf4' : 'white', border: customer.next_pickup.isToday ? '1px solid #bbf7d0' : '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: customer.next_pickup.isToday ? GREEN : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Truck size={19} color={customer.next_pickup.isToday ? 'white' : GREEN} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{t('next_pickup')}</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                        {customer.next_pickup.isToday ? t('today') : new Date(customer.next_pickup.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                        {customer.next_pickup.time && <span style={{ color: '#94a3b8', fontWeight: 600 }}> · {formatPickupTime(customer.next_pickup.time)}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Live truck tracking — only rendered when a route is actually 'In Progress'
                      today for this customer's zone and has sent at least one GPS ping. */}
                  {customer.next_pickup.isToday && truckLocation?.lat && truckLocation?.lng && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: GREEN_DARK, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: GREEN, display: 'inline-block', animation: 'gp-pulse 1.4s ease-in-out infinite' }} />
                        {t('truck_en_route')}
                      </div>
                      <div style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid #bbf7d0', height: '160px' }}>
                        <MapContainer center={[truckLocation.lat, truckLocation.lng]} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false} dragging={true} scrollWheelZoom={false}>
                          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          <Marker position={[truckLocation.lat, truckLocation.lng]}>
                            <Popup>{truckLocation.vehicle_plate || t('truck_tracking')}</Popup>
                          </Marker>
                        </MapContainer>
                      </div>
                    </div>
                  )}

                  {customer.next_pickup.isToday && (
                    <button className="gp-btn" onClick={() => setShowMissedConfirm(true)} style={{ marginTop: '12px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '0.7rem', borderRadius: '13px', border: '1px solid #fecaca', background: 'white', color: '#dc2626', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}>
                      <AlertTriangle size={14} /> {t('report_missed')}
                    </button>
                  )}
                </Card>
              )}

              <Card style={{ padding: '1.3rem' }}>
                <div style={{ fontWeight: 800, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontSize: '0.95rem' }}>
                  <Tag size={16} color={GREEN} /> {t('my_service')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                  {[
                    { label: t('category'), value: customer.category, icon: Tag },
                    { label: t('frequency'), value: customer.collection_frequency, icon: Repeat },
                    { label: t('zone'), value: customer.zone, icon: MapPin },
                    { label: t('address'), value: `${t('house')} ${customer.house_no || '—'}, ${customer.area || '—'}`, icon: Home },
                  ].map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: '11px', alignItems: 'center' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <f.icon size={14} color="#94a3b8" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{f.label}</div>
                        <div style={{ fontSize: '0.88rem', color: '#334155', fontWeight: 700 }}>{f.value || '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {customer.collector_name && (
                <Card style={{ padding: '1.2rem 1.3rem', display: 'flex', alignItems: 'center', gap: '13px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 900, color: GREEN, fontSize: '1.05rem' }}>
                    {customer.collector_name[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{t('my_collector')}</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{customer.collector_name}</div>
                  </div>
                  {customer.collector_phone ? (
                    <a href={`tel:${customer.collector_phone}`} className="gp-btn" title={t('call_collector')} style={{ width: '38px', height: '38px', borderRadius: '12px', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white' }}>
                      <PhoneIcon size={15} />
                    </a>
                  ) : (
                    <span style={{ fontSize: '0.68rem', color: '#cbd5e1', fontWeight: 600 }}>{t('no_phone_on_file')}</span>
                  )}
                </Card>
              )}

              {lastCollection && (
                <Card style={{ padding: '1.3rem' }}>
                  <div style={{ fontWeight: 800, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontSize: '0.95rem' }}>
                    <Truck size={16} color={GREEN} /> {t('last_collection')}
                  </div>
                  <div style={{ fontSize: '0.88rem', color: '#475569' }}>
                    {new Date(lastCollection.collected_at).toLocaleDateString()} — {t('collected_by')} <strong>{lastCollection.collector_name || t('na')}</strong>
                  </div>
                </Card>
              )}
            </div>
          ) : tab === 'payments' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
                <h3 style={{ fontWeight: 900, margin: 0, color: '#0f172a', fontSize: '1.15rem' }}>{t('payment_history')}</h3>
                {payments.length > 0 && (
                  <button className="gp-btn" onClick={downloadStatementCSV} title={t('download_statement')} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0.45rem 0.7rem', borderRadius: '10px', border: '1px solid #f1f5f9', background: 'white', color: '#475569', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer' }}>
                    <Download size={12} /> CSV
                  </button>
                )}
              </div>
              {payments.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem' }}>
                  {['all', 'paid', 'unpaid'].map(f => (
                    <button key={f} onClick={() => setPaymentsFilter(f)} style={{
                      padding: '0.45rem 0.9rem', borderRadius: '100px', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer',
                      border: paymentsFilter === f ? `1px solid ${GREEN}` : '1px solid #e2e8f0',
                      background: paymentsFilter === f ? GREEN : 'white',
                      color: paymentsFilter === f ? 'white' : '#64748b'
                    }}>
                      {f === 'all' ? t('filter_all') : f === 'paid' ? t('filter_paid') : t('filter_unpaid')}
                    </button>
                  ))}
                </div>
              )}
              {payments.length === 0 ? (
                <Card><EmptyState icon={Inbox} text={t('no_payment_history')} /></Card>
              ) : paymentsFiltered.length === 0 ? (
                <Card><EmptyState icon={Inbox} text={t('no_records_filter')} /></Card>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                  {paymentsFiltered.map(p => (
                    <Card key={p.id} style={{ padding: '1rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: p.status === 'Paid' ? '#f0fdf4' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <DollarSign size={16} color={p.status === 'Paid' ? GREEN : '#ef4444'} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>${parseFloat(p.amount).toFixed(2)}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>{p.payment_method} • {new Date(p.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Badge variant={p.status === 'Paid' ? 'good' : 'bad'}>{p.status}</Badge>
                        {p.status === 'Paid' && (
                          <button onClick={() => downloadReceipt(p)} title={t('download_receipt')} style={{ width: '30px', height: '30px', borderRadius: '10px', border: '1px solid #f1f5f9', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Download size={13} color="#64748b" />
                          </button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : tab === 'collections' ? (
            <div>
              <h3 style={{ fontWeight: 900, marginBottom: '1rem', color: '#0f172a', fontSize: '1.15rem' }}>{t('collection_history')}</h3>
              {collections.length === 0 ? (
                <Card><EmptyState icon={Truck} text={t('no_collection_history')} /></Card>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                  {collections.map((c, i) => (
                    <Card key={i} style={{ padding: '1rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: c.collected ? '#f0fdf4' : '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Truck size={16} color={c.collected ? GREEN : '#f59e0b'} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>{c.collector_name || c.driver_name || t('unassigned')}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>{c.collected_at ? new Date(c.collected_at).toLocaleDateString() : t('not_scheduled')}</div>
                        </div>
                      </div>
                      <Badge variant={c.collected ? 'good' : 'warn'}>{c.collected ? t('collected') : t('pending')}</Badge>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
                <h3 style={{ fontWeight: 900, margin: 0, color: '#0f172a', fontSize: '1.15rem' }}>{t('support')}</h3>
                <button onClick={() => setShowComplaintForm(true)} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '0.6rem 1rem', borderRadius: '14px', border: 'none',
                  background: GREEN, color: 'white', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer',
                  boxShadow: '0 6px 16px rgba(63,174,42,0.28)'
                }}>
                  <Plus size={15} /> {t('new_button')}
                </button>
              </div>

              {showComplaintForm && (
                <Card style={{ padding: '1.3rem', marginBottom: '1.1rem' }}>
                  <form onSubmit={handleComplaintSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#64748b', marginBottom: '7px' }}>{t('complaint_title_label')}</label>
                      <input required value={newComplaint.title} onChange={e => setNewComplaint({...newComplaint, title: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '13px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '0.9rem', background: '#f8fafc' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#64748b', marginBottom: '7px' }}>{t('complaint_description_label')}</label>
                      <textarea value={newComplaint.description} onChange={e => setNewComplaint({...newComplaint, description: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '13px', border: '1.5px solid #e2e8f0', minHeight: '85px', resize: 'vertical', boxSizing: 'border-box', fontSize: '0.9rem', fontFamily: 'inherit', background: '#f8fafc' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#64748b', marginBottom: '7px' }}>{t('complaint_photo_label')}</label>
                      <input type="file" accept="image/*" onChange={e => setNewComplaintPhoto(e.target.files[0])} style={{ width: '100%', fontSize: '0.85rem' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => setShowComplaintForm(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>{t('cancel')}</button>
                      <button type="submit" style={{ padding: '0.7rem 1.4rem', borderRadius: '13px', border: 'none', background: GREEN, color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}>{t('submit')}</button>
                    </div>
                  </form>
                </Card>
              )}

              {complaints.length === 0 ? (
                <Card><EmptyState icon={MessageSquare} text={t('no_complaints')} /></Card>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                  {complaints.map(c => {
                    const variant = c.status === 'Resolved' ? 'good' : c.status === 'In Progress' ? 'info' : 'warn';
                    return (
                      <Card key={c.id} style={{ padding: '1.1rem 1.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>{c.title}</div>
                          <Badge variant={variant}>{c.status}</Badge>
                        </div>
                        {c.description && <div style={{ fontSize: '0.83rem', color: '#64748b', marginTop: '7px', lineHeight: 1.5 }}>{c.description}</div>}
                        {c.photo && <a href={`/api/uploads/${c.photo}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem', color: GREEN, marginTop: '6px', display: 'inline-block', fontWeight: 700 }}>{t('view_photo')}</a>}
                        {c.admin_reply && (
                          <div style={{ marginTop: '10px', padding: '0.8rem', borderRadius: '13px', background: '#eff6ff', border: '1px solid #dbeafe' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1d4ed8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{t('gurmad_reply')}</div>
                            <div style={{ fontSize: '0.83rem', color: '#1e3a5f', lineHeight: 1.5 }}>{c.admin_reply}</div>
                          </div>
                        )}
                        <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '9px', fontWeight: 600 }}>{new Date(c.created_at).toLocaleDateString()}</div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed bottom tab bar */}
        <div style={{ display: 'flex', background: 'white', borderTop: '1px solid #f1f5f9', padding: '0.6rem 0.5rem calc(0.6rem + env(safe-area-inset-bottom, 0px))', boxShadow: '0 -4px 16px rgba(15,23,42,0.04)' }}>
          {tabs.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => { setTab(t.id); setShowComplaintForm(false); }} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 0.2rem', borderRadius: '14px'
              }}>
                <div style={{ width: '38px', height: '30px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? '#f0fdf4' : 'transparent', transition: 'background 0.15s' }}>
                  <t.icon size={19} color={active ? GREEN : '#94a3b8'} strokeWidth={active ? 2.4 : 2} />
                </div>
                <span style={{ fontSize: '0.65rem', fontWeight: active ? 800 : 600, color: active ? GREEN : '#94a3b8' }}>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Notifications panel */}
        {showNotifications && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => setShowNotifications(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#f8fafc', borderRadius: '26px 26px 0 0', maxHeight: '78%', display: 'flex', flexDirection: 'column', boxShadow: '0 -10px 40px rgba(15,23,42,0.2)' }}>
              <div style={{ padding: '1.2rem 1.3rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={18} color={GREEN} /> {t('notifications_title')}
                </div>
                <button onClick={() => setShowNotifications(false)} style={{ width: '30px', height: '30px', borderRadius: '10px', border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b', fontWeight: 700 }}>✕</button>
              </div>
              <div style={{ overflowY: 'auto', padding: '0.8rem 1.3rem 1.6rem' }}>
                {notifications.length === 0 ? (
                  <EmptyState icon={Bell} text={t('no_notifications')} />
                ) : notifications.map(n => (
                  <div key={n.id} style={{ display: 'flex', gap: '11px', padding: '0.9rem 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '11px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Bell size={16} color={GREEN} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{n.title}</div>
                      {n.message && <div style={{ fontSize: '0.82rem', color: '#64748b', margin: '3px 0 0 0' }}>{n.message}</div>}
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '5px', fontWeight: 600 }}>{timeAgo(n.created_at)}</div>
                    </div>
                    {!n.is_read && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: GREEN, flexShrink: 0, marginTop: '5px' }} />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Change Password panel */}
        {showChangePassword && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => setShowChangePassword(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '26px 26px 0 0', boxShadow: '0 -10px 40px rgba(15,23,42,0.2)' }}>
              <div style={{ padding: '1.2rem 1.3rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <KeyRound size={18} color={GREEN} /> {t('change_password_title')}
                </div>
                <button onClick={() => setShowChangePassword(false)} style={{ width: '30px', height: '30px', borderRadius: '10px', border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b' }}><X size={15} /></button>
              </div>
              <form onSubmit={handleChangePassword} style={{ padding: '1.3rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#64748b', marginBottom: '7px' }}>{t('current_password')}</label>
                  <input required type="password" value={pwForm.currentPassword} onChange={e => setPwForm({...pwForm, currentPassword: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '13px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '0.9rem', background: '#f8fafc' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#64748b', marginBottom: '7px' }}>{t('new_password')}</label>
                  <input required minLength={6} type="password" value={pwForm.newPassword} onChange={e => setPwForm({...pwForm, newPassword: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '13px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '0.9rem', background: '#f8fafc' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#64748b', marginBottom: '7px' }}>{t('confirm_password')}</label>
                  <input required minLength={6} type="password" value={pwForm.confirmPassword} onChange={e => setPwForm({...pwForm, confirmPassword: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '13px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '0.9rem', background: '#f8fafc' }} />
                </div>
                <button type="submit" disabled={isChangingPw} style={{ padding: '0.9rem', borderRadius: '16px', border: 'none', background: isChangingPw ? '#86c976' : GREEN, color: 'white', fontWeight: 800, fontSize: '0.95rem', cursor: isChangingPw ? 'default' : 'pointer', marginTop: '0.3rem' }}>
                  {isChangingPw ? t('changing') : t('change_password_title')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Missed Pickup confirm dialog */}
        {showMissedConfirm && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 25, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }} onClick={() => setShowMissedConfirm(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '22px', padding: '1.5rem', boxShadow: '0 20px 50px rgba(15,23,42,0.25)', maxWidth: '340px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <AlertTriangle size={20} color="#dc2626" />
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.02rem', color: '#0f172a', marginBottom: '6px' }}>{t('missed_confirm_title')}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5, marginBottom: '18px' }}>{t('missed_confirm_desc')}</div>
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <button onClick={() => setShowMissedConfirm(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '13px', border: 'none', background: '#f1f5f9', color: '#475569', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>{t('cancel')}</button>
                <button onClick={handleReportMissed} disabled={isSubmittingMissed} style={{ flex: 1, padding: '0.75rem', borderRadius: '13px', border: 'none', background: isSubmittingMissed ? '#fca5a5' : '#dc2626', color: 'white', fontWeight: 800, cursor: isSubmittingMissed ? 'default' : 'pointer', fontSize: '0.85rem' }}>
                  {isSubmittingMissed ? t('changing') : t('confirm')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Account panel — hub for everything account-related (previously tapping the customer's
            name went straight to Change Password with no other account actions available). */}
        {showAccount && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => setShowAccount(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#f8fafc', borderRadius: '26px 26px 0 0', boxShadow: '0 -10px 40px rgba(15,23,42,0.2)' }}>
              <div style={{ padding: '1.2rem 1.3rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={18} color={GREEN} /> {t('account')}
                </div>
                <button onClick={() => setShowAccount(false)} style={{ width: '30px', height: '30px', borderRadius: '10px', border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b' }}><X size={15} /></button>
              </div>
              <div style={{ padding: '1.3rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                <Card style={{ padding: '1rem 1.1rem' }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>{customer.name}</div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '3px' }}>{customer.phone}</div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>{t('house')} {customer.house_no || '—'}, {customer.area || '—'}</div>
                </Card>
                {[
                  { icon: KeyRound, label: t('change_password'), action: () => { setShowAccount(false); setShowChangePassword(true); } },
                  { icon: Tag, label: t('request_change'), action: () => { setShowAccount(false); setShowEditRequest(true); } },
                  { icon: HelpCircle, label: t('help_faq'), action: () => { setShowAccount(false); setShowFAQ(true); } },
                ].map((item, i) => (
                  <button key={i} className="gp-btn" onClick={item.action} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '1rem 1.1rem', borderRadius: '16px', border: '1px solid #f1f5f9', background: 'white', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <item.icon size={15} color={GREEN} />
                    </div>
                    <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.88rem', flex: 1 }}>{item.label}</span>
                    <ChevronRight size={16} color="#cbd5e1" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Profile-change request panel */}
        {showEditRequest && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => setShowEditRequest(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '26px 26px 0 0', boxShadow: '0 -10px 40px rgba(15,23,42,0.2)' }}>
              <div style={{ padding: '1.2rem 1.3rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Tag size={18} color={GREEN} /> {t('request_change')}
                </div>
                <button onClick={() => setShowEditRequest(false)} style={{ width: '30px', height: '30px', borderRadius: '10px', border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b' }}><X size={15} /></button>
              </div>
              <form onSubmit={handleEditRequestSubmit} style={{ padding: '1.3rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>{t('edit_request_desc')}</div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#64748b', marginBottom: '7px' }}>{t('new_phone')}</label>
                  <input value={editRequestForm.phone} onChange={e => setEditRequestForm({...editRequestForm, phone: e.target.value})} placeholder={customer.phone} style={{ width: '100%', padding: '0.8rem', borderRadius: '13px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '0.9rem', background: '#f8fafc' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#64748b', marginBottom: '7px' }}>{t('new_area')}</label>
                    <input value={editRequestForm.area} onChange={e => setEditRequestForm({...editRequestForm, area: e.target.value})} placeholder={customer.area} style={{ width: '100%', padding: '0.8rem', borderRadius: '13px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '0.9rem', background: '#f8fafc' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#64748b', marginBottom: '7px' }}>{t('new_house')}</label>
                    <input value={editRequestForm.house_no} onChange={e => setEditRequestForm({...editRequestForm, house_no: e.target.value})} placeholder={customer.house_no} style={{ width: '100%', padding: '0.8rem', borderRadius: '13px', border: '1.5px solid #e2e8f0', boxSizing: 'border-box', fontSize: '0.9rem', background: '#f8fafc' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#64748b', marginBottom: '7px' }}>{t('note_optional')}</label>
                  <textarea value={editRequestForm.note} onChange={e => setEditRequestForm({...editRequestForm, note: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '13px', border: '1.5px solid #e2e8f0', minHeight: '70px', resize: 'vertical', boxSizing: 'border-box', fontSize: '0.9rem', fontFamily: 'inherit', background: '#f8fafc' }} />
                </div>
                <button type="submit" disabled={isSubmittingEditRequest} style={{ padding: '0.9rem', borderRadius: '16px', border: 'none', background: isSubmittingEditRequest ? '#86c976' : GREEN, color: 'white', fontWeight: 800, fontSize: '0.95rem', cursor: isSubmittingEditRequest ? 'default' : 'pointer', marginTop: '0.3rem' }}>
                  {isSubmittingEditRequest ? t('changing') : t('submit_request')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* FAQ / Help panel */}
        {showFAQ && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => setShowFAQ(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#f8fafc', borderRadius: '26px 26px 0 0', maxHeight: '82%', display: 'flex', flexDirection: 'column', boxShadow: '0 -10px 40px rgba(15,23,42,0.2)' }}>
              <div style={{ padding: '1.2rem 1.3rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HelpCircle size={18} color={GREEN} /> {t('help_faq')}
                </div>
                <button onClick={() => setShowFAQ(false)} style={{ width: '30px', height: '30px', borderRadius: '10px', border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b' }}><X size={15} /></button>
              </div>
              <div style={{ overflowY: 'auto', padding: '0.8rem 1.3rem 1.6rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {FAQ_ITEMS.map((qKey, i) => {
                  const aKey = qKey.replace('_q', '_a');
                  const isOpen = openFAQIndex === i;
                  return (
                    <Card key={qKey} style={{ padding: '0' }}>
                      <button onClick={() => setOpenFAQIndex(isOpen ? null : i)} style={{ width: '100%', padding: '0.95rem 1.1rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>{t(qKey)}</span>
                        <ChevronRight size={16} color="#94a3b8" style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
                      </button>
                      {isOpen && (
                        <div style={{ padding: '0 1.1rem 1rem', fontSize: '0.83rem', color: '#64748b', lineHeight: 1.55 }}>{t(aKey)}</div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerPortalApp;
