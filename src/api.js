const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const getAuthHeaders = () => {
  const user = JSON.parse(localStorage.getItem('gurmadUser') || '{}');
  const headers = {};
  if (user.role) {
    headers['x-user-role'] = user.role;
  }
  if (user.token) {
    headers['Authorization'] = `Bearer ${user.token}`;
  }
  return headers;
};

const handleResponse = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      if (data.error && data.error.toLowerCase().includes('token')) {
        window.dispatchEvent(new Event('token_expired'));
      }
    }
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
};

export const api = {
  // Auth
  login: async (credentials) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return { error: errorData.error || 'Authentication failed' };
    }
    return res.json();
  },
  
  pingTaskLocation: (id, data) => fetch(`${API_BASE_URL}/tasks/${id}/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),

  getTaskHistory: (id) => fetch(`${API_BASE_URL}/tasks/${id}/history`, { headers: getAuthHeaders() }).then(handleResponse),

  updateCustomerLocation: (id, data) => fetch(`${API_BASE_URL}/customers/${id}/location`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),

  verify2FA: (data) => fetch(`${API_BASE_URL}/auth/login/verify-2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),

  setup2FA: (userId) => fetch(`${API_BASE_URL}/auth/2fa/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ userId })
  }).then(handleResponse),

  enable2FA: (data) => fetch(`${API_BASE_URL}/auth/2fa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),

  disable2FA: (userId) => fetch(`${API_BASE_URL}/auth/2fa/disable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ userId })
  }).then(handleResponse),
  
  updateProfile: (formData) => fetch(`${API_BASE_URL}/auth/update_profile`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData 
  }).then(handleResponse),

  generalUpload: (formData) => fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData
  }).then(handleResponse),

  getHealth: () => fetch(`${API_BASE_URL}/health`).then(handleResponse),
  
  // Stats
  getStats: () => fetch(`${API_BASE_URL}/stats`, { headers: getAuthHeaders() }).then(handleResponse),
  getStatsHistory: () => fetch(`${API_BASE_URL}/stats/history`, { headers: getAuthHeaders() }).then(handleResponse),
  getExtendedDashboardStats: () => fetch(`${API_BASE_URL}/dashboard/extended`, { headers: getAuthHeaders() }).then(handleResponse),
  getCollectorReports: () => fetch(`${API_BASE_URL}/reports/collectors`, { headers: getAuthHeaders() }).then(handleResponse),

  // Trucks & Zones
  getTrucks: () => fetch(`${API_BASE_URL}/trucks`, { headers: getAuthHeaders() }).then(handleResponse),
  addTruck: (data) => fetch(`${API_BASE_URL}/trucks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateTruck: (id, data) => fetch(`${API_BASE_URL}/trucks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  deleteTruck: (id) => fetch(`${API_BASE_URL}/trucks/${id}`, { 
    method: 'DELETE',
    headers: getAuthHeaders()
  }).then(handleResponse),
  
  getZones: () => fetch(`${API_BASE_URL}/zones`, { headers: getAuthHeaders() }).then(handleResponse),
  addZone: (data) => fetch(`${API_BASE_URL}/zones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateZone: (id, data) => fetch(`${API_BASE_URL}/zones/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateZoneCoordinates: (id, coordinates) => fetch(`${API_BASE_URL}/zones/${id}/coordinates`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ coordinates })
  }).then(handleResponse),
  deleteZone: (id) => fetch(`${API_BASE_URL}/zones/${id}`, { 
    method: 'DELETE',
    headers: getAuthHeaders()
  }).then(handleResponse),
  
  // Customers
  getCustomers: () => fetch(`${API_BASE_URL}/customers`, { headers: getAuthHeaders() }).then(handleResponse),
  addCustomer: (data) => fetch(`${API_BASE_URL}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  bulkImportCustomers: (customers) => fetch(`${API_BASE_URL}/customers/bulk-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ customers })
  }).then(handleResponse),
  updateCustomer: (id, data) => fetch(`${API_BASE_URL}/customers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  deleteCustomer: (id) => fetch(`${API_BASE_URL}/customers/${id}`, { 
    method: 'DELETE',
    headers: getAuthHeaders()
  }).then(handleResponse),
  
  // Invoices
  getInvoices: () => fetch(`${API_BASE_URL}/invoices`, { headers: getAuthHeaders() }).then(handleResponse),
  getInvoiceStats: () => fetch(`${API_BASE_URL}/invoices/stats`, { headers: getAuthHeaders() }).then(handleResponse),
  addInvoice: (data) => fetch(`${API_BASE_URL}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  
  // Expenses
  getExpenses: () => fetch(`${API_BASE_URL}/expenses`, { headers: getAuthHeaders() }).then(handleResponse),
  addExpense: (data) => fetch(`${API_BASE_URL}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  
  // HRM / Employees
  getEmployees: () => fetch(`${API_BASE_URL}/employees`, { headers: getAuthHeaders() }).then(handleResponse),
  addEmployee: (formData) => fetch(`${API_BASE_URL}/employees`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData
  }).then(handleResponse),
  updateEmployee: (id, data) => fetch(`${API_BASE_URL}/employees/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  deleteEmployee: (id) => fetch(`${API_BASE_URL}/employees/${id}`, { 
    method: 'DELETE',
    headers: getAuthHeaders()
  }).then(handleResponse),
  
  // Leave Management
  getLeaveRequests: () => fetch(`${API_BASE_URL}/leave-requests`, { headers: getAuthHeaders() }).then(handleResponse),
  addLeaveRequest: (data) => fetch(`${API_BASE_URL}/leave-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateLeaveStatus: (id, status) => fetch(`${API_BASE_URL}/leave-requests/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ status })
  }).then(handleResponse),
  
  // Attendance
  getAttendance: () => fetch(`${API_BASE_URL}/attendance`, { headers: getAuthHeaders() }).then(handleResponse),
  getAttendanceToday: () => fetch(`${API_BASE_URL}/attendance/today`, { headers: getAuthHeaders() }).then(handleResponse),
  clockIn: (formData) => fetch(`${API_BASE_URL}/attendance/clock-in`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData
  }).then(handleResponse),
  clockOut: (formData) => fetch(`${API_BASE_URL}/attendance/clock-out`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData
  }).then(handleResponse),

  // Payroll
  getPayroll: (month) => fetch(`${API_BASE_URL}/payroll${month ? `?month=${month}` : ''}`, { headers: getAuthHeaders() }).then(handleResponse),
  generatePayroll: (month) => fetch(`${API_BASE_URL}/payroll/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ month })
  }).then(handleResponse),
  updatePayroll: (id, data) => fetch(`${API_BASE_URL}/payroll/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),

  // Tasks
  getTasks: () => fetch(`${API_BASE_URL}/tasks`, { headers: getAuthHeaders() }).then(handleResponse),
  addTask: (data) => fetch(`${API_BASE_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateTaskStatus: (id, status) => fetch(`${API_BASE_URL}/tasks/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ status })
  }).then(handleResponse),
  getTaskCustomers: (id) => fetch(`${API_BASE_URL}/tasks/${id}/customers`, { headers: getAuthHeaders() }).then(handleResponse),
  markCustomerCollected: (taskId, customerId, collected) => fetch(`${API_BASE_URL}/tasks/${taskId}/customers/${customerId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ collected })
  }).then(handleResponse),
  deleteTask: (id) => fetch(`${API_BASE_URL}/tasks/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  }).then(handleResponse),
  markCustomerServiced: (taskId, customerId, location = {}) => fetch(`${API_BASE_URL}/tasks/${taskId}/customers/${customerId}/service`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(location)
  }).then(handleResponse),
  getServiceLog: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return fetch(`${API_BASE_URL}/reports/service-log${qs ? `?${qs}` : ''}`, { headers: getAuthHeaders() }).then(handleResponse);
  },

  // Inventory
  getInventory: () => fetch(`${API_BASE_URL}/inventory`, { headers: getAuthHeaders() }).then(handleResponse),
  addInventory: (data) => fetch(`${API_BASE_URL}/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateInventory: (id, data) => fetch(`${API_BASE_URL}/inventory/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  deleteInventory: (id) => fetch(`${API_BASE_URL}/inventory/${id}`, { 
    method: 'DELETE',
    headers: getAuthHeaders()
  }).then(handleResponse),

  // Debts
  getDebts: () => fetch(`${API_BASE_URL}/debts`, { headers: getAuthHeaders() }).then(handleResponse),
  addDebt: (data) => fetch(`${API_BASE_URL}/debts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateDebtStatus: (id, status, method) => fetch(`${API_BASE_URL}/debts/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ status, payment_method: method })
  }).then(handleResponse),
  processZaadPayment: (data) => fetch(`${API_BASE_URL}/payments/zaad`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  deleteDebt: (id) => fetch(`${API_BASE_URL}/debts/${id}`, { 
    method: 'DELETE',
    headers: getAuthHeaders()
  }).then(handleResponse),

  // Cashouts
  getCashouts: () => fetch(`${API_BASE_URL}/cashouts`, { headers: getAuthHeaders() }).then(handleResponse),
  addCashout: (data) => fetch(`${API_BASE_URL}/cashouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),

  // User Management
  getUsers: () => fetch(`${API_BASE_URL}/users`, { headers: getAuthHeaders() }).then(handleResponse),
  createUser: (data) => fetch(`${API_BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateUser: (id, data) => fetch(`${API_BASE_URL}/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  deleteUser: (id) => fetch(`${API_BASE_URL}/users/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  }).then(handleResponse),
  toggleUserStatus: (id) => fetch(`${API_BASE_URL}/users/${id}/toggle-status`, {
    method: 'PUT',
    headers: getAuthHeaders()
  }).then(handleResponse),

  // Roles & Permissions (dynamic RBAC)
  getRoles: () => fetch(`${API_BASE_URL}/roles`, { headers: getAuthHeaders() }).then(handleResponse),
  getPermissions: () => fetch(`${API_BASE_URL}/permissions`, { headers: getAuthHeaders() }).then(handleResponse),
  createRole: (label) => fetch(`${API_BASE_URL}/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ label })
  }).then(handleResponse),
  updateRolePermissions: (id, permissions) => fetch(`${API_BASE_URL}/roles/${id}/permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ permissions })
  }).then(handleResponse),
  deleteRole: (id) => fetch(`${API_BASE_URL}/roles/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  }).then(handleResponse),
  resetUserPassword: (id, newPassword) => fetch(`${API_BASE_URL}/users/${id}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ newPassword })
  }).then(handleResponse),
  resetUser2FA: (id) => fetch(`${API_BASE_URL}/users/${id}/reset-2fa`, {
    method: 'POST',
    headers: getAuthHeaders()
  }).then(handleResponse),
  fullUserReset: (id, newPassword) => fetch(`${API_BASE_URL}/users/${id}/full-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ newPassword })
  }).then(handleResponse),
  
  // Settings
  getSettings: () => fetch(`${API_BASE_URL}/settings`, { headers: getAuthHeaders() }).then(handleResponse),
  updateSettings: (data) => fetch(`${API_BASE_URL}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  
  // Reports
  getCollectorReports: () => fetch(`${API_BASE_URL}/reports/collectors`, { headers: getAuthHeaders() }).then(handleResponse),
  getCollectorsTodayStats: () => fetch(`${API_BASE_URL}/reports/collectors/today`, { headers: getAuthHeaders() }).then(handleResponse),
  getCollectorDailyReport: (collectorName, date) => fetch(`${API_BASE_URL}/reports/collector-daily?collector_name=${encodeURIComponent(collectorName)}&date=${encodeURIComponent(date)}`, { headers: getAuthHeaders() }).then(handleResponse),

  // Archives
  getArchives: () => fetch(`${API_BASE_URL}/archives`, { headers: getAuthHeaders() }).then(handleResponse),
  markAllNotificationsRead: (userId) => fetch(`${API_BASE_URL}/users/${userId}/notifications/read-all`, { 
    method: 'PUT',
    headers: getAuthHeaders()
  }).then(handleResponse),

  // Notifications
  getNotifications: (userId) => fetch(`${API_BASE_URL}/users/${userId}/notifications`, { headers: getAuthHeaders() }).then(handleResponse),
  markNotificationRead: (id) => fetch(`${API_BASE_URL}/notifications/${id}/read`, { 
    method: 'PUT',
    headers: getAuthHeaders()
  }).then(handleResponse),
  
  // Archive
  getArchives: () => fetch(`${API_BASE_URL}/archives`, { headers: getAuthHeaders() }).then(handleResponse),
  uploadArchive: (formData) => fetch(`${API_BASE_URL}/archives`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData
  }).then(handleResponse),
  deleteArchive: (id) => fetch(`${API_BASE_URL}/archives/${id}`, { 
    method: 'DELETE',
    headers: getAuthHeaders()
  }).then(handleResponse),
  
  globalSearch: (q) => fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(q)}`, { headers: getAuthHeaders() }).then(handleResponse),

  // Chat & Messaging
  getMessages: (userId) => fetch(`${API_BASE_URL}/messages?userId=${userId}`, { headers: getAuthHeaders() }).then(handleResponse),
  sendCustomerMessage: (data) => fetch(`${API_BASE_URL}/messages/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  broadcastMessage: (data) => fetch(`${API_BASE_URL}/messages/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  optimizeRoute: (taskId) => fetch(`${API_BASE_URL}/optimize-route?task_id=${taskId}`, { headers: getAuthHeaders() }).then(handleResponse),

  sendWhatsAppNotification: (data) => fetch(`${API_BASE_URL}/whatsapp/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),

  // Fleet Hardening
  getFuelLogs: () => fetch(`${API_BASE_URL}/fleet/fuel`, { headers: getAuthHeaders() }).then(handleResponse),
  addFuelLog: (data) => fetch(`${API_BASE_URL}/fleet/fuel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  getMaintenanceLogs: () => fetch(`${API_BASE_URL}/fleet/maintenance`, { headers: getAuthHeaders() }).then(handleResponse),
  addMaintenanceLog: (data) => fetch(`${API_BASE_URL}/fleet/maintenance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  
  // Admin & Audit
  getAuditLogs: (params) => {
    const query = new URLSearchParams(params).toString();
    return fetch(`${API_BASE_URL}/admin/audit-logs?${query}`, {
      headers: getAuthHeaders()
    }).then(res => res.json());
  },
  generateBackup: () => fetch(`${API_BASE_URL}/admin/backup`, {
    headers: getAuthHeaders()
  }).then(handleResponse),

  // Complaints
  getComplaints: () => fetch(`${API_BASE_URL}/complaints`, { headers: getAuthHeaders() }).then(handleResponse),
  addComplaint: (data) => fetch(`${API_BASE_URL}/complaints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateComplaintStatus: (id, status) => fetch(`${API_BASE_URL}/complaints/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ status })
  }).then(handleResponse),

  // Collector Assignments
  getCollectorAssignments: () => fetch(`${API_BASE_URL}/collector-assignments`, { headers: getAuthHeaders() }).then(handleResponse),
  addCollectorAssignment: (data) => fetch(`${API_BASE_URL}/collector-assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateCollectorAssignment: (id, data) => fetch(`${API_BASE_URL}/collector-assignments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  deleteCollectorAssignment: (id) => fetch(`${API_BASE_URL}/collector-assignments/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  }).then(handleResponse),

  getCashierAssignments: () => fetch(`${API_BASE_URL}/cashier-assignments`, { headers: getAuthHeaders() }).then(handleResponse),
  getMyCollectorCustomers: () => fetch(`${API_BASE_URL}/cashier/my-collector-customers`, { headers: getAuthHeaders() }).then(handleResponse),
  getMyTodayRoute: () => fetch(`${API_BASE_URL}/collector/my-today-route`, { headers: getAuthHeaders() }).then(handleResponse),
  addCashierAssignment: (data) => fetch(`${API_BASE_URL}/cashier-assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateCashierAssignment: (id, data) => fetch(`${API_BASE_URL}/cashier-assignments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  }).then(handleResponse),
  deleteCashierAssignment: (id) => fetch(`${API_BASE_URL}/cashier-assignments/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  }).then(handleResponse),
};
