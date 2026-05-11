const API_BASE_URL = '/api';

const handleResponse = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),

  getTaskHistory: (id) => fetch(`${API_BASE_URL}/tasks/${id}/history`).then(handleResponse),

  updateCustomerLocation: (id, data) => fetch(`${API_BASE_URL}/customers/${id}/location`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),

  verify2FA: (data) => fetch(`${API_BASE_URL}/auth/login/verify-2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),

  setup2FA: (userId) => fetch(`${API_BASE_URL}/auth/2fa/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  }).then(handleResponse),

  enable2FA: (data) => fetch(`${API_BASE_URL}/auth/2fa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),

  disable2FA: (userId) => fetch(`${API_BASE_URL}/auth/2fa/disable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  }).then(handleResponse),
  
  updateProfile: (formData) => fetch(`${API_BASE_URL}/auth/update_profile`, {
    method: 'POST',
    body: formData // Note: no headers sent so browser can set boundary for multipart
  }).then(handleResponse),

  generalUpload: (formData) => fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData
  }).then(handleResponse),

  getHealth: () => fetch(`${API_BASE_URL}/health`).then(handleResponse),
  
  // Stats
  getStats: () => fetch(`${API_BASE_URL}/stats`).then(handleResponse),
  getStatsHistory: () => fetch(`${API_BASE_URL}/stats/history`).then(handleResponse),
  getCollectorReports: () => fetch(`${API_BASE_URL}/reports/collectors`).then(handleResponse),

  // Trucks & Zones
  getTrucks: () => fetch(`${API_BASE_URL}/trucks`).then(handleResponse),
  addTruck: (data) => fetch(`${API_BASE_URL}/trucks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateTruck: (id, data) => fetch(`${API_BASE_URL}/trucks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  deleteTruck: (id) => fetch(`${API_BASE_URL}/trucks/${id}`, { method: 'DELETE' }).then(handleResponse),
  
  getZones: () => fetch(`${API_BASE_URL}/zones`).then(handleResponse),
  addZone: (data) => fetch(`${API_BASE_URL}/zones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateZone: (id, data) => fetch(`${API_BASE_URL}/zones/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateZoneCoordinates: (id, coordinates) => fetch(`${API_BASE_URL}/zones/${id}/coordinates`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinates })
  }).then(handleResponse),
  deleteZone: (id) => fetch(`${API_BASE_URL}/zones/${id}`, { method: 'DELETE' }).then(handleResponse),
  
  // Customers
  getCustomers: () => fetch(`${API_BASE_URL}/customers`).then(handleResponse),
  addCustomer: (data) => fetch(`${API_BASE_URL}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateCustomer: (id, data) => fetch(`${API_BASE_URL}/customers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  deleteCustomer: (id) => fetch(`${API_BASE_URL}/customers/${id}`, { method: 'DELETE' }).then(handleResponse),
  
  // Invoices
  getInvoices: () => fetch(`${API_BASE_URL}/invoices`).then(handleResponse),
  getInvoiceStats: () => fetch(`${API_BASE_URL}/invoices/stats`).then(handleResponse),
  addInvoice: (data) => fetch(`${API_BASE_URL}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  
  // Expenses
  getExpenses: () => fetch(`${API_BASE_URL}/expenses`).then(handleResponse),
  addExpense: (data) => fetch(`${API_BASE_URL}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  
  // HRM / Employees
  getEmployees: () => fetch(`${API_BASE_URL}/employees`).then(handleResponse),
  addEmployee: (formData) => fetch(`${API_BASE_URL}/employees`, {
    method: 'POST',
    body: formData
  }).then(handleResponse),
  updateEmployee: (id, data) => fetch(`${API_BASE_URL}/employees/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  deleteEmployee: (id) => fetch(`${API_BASE_URL}/employees/${id}`, { method: 'DELETE' }).then(handleResponse),
  
  // Attendance
  getAttendance: () => fetch(`${API_BASE_URL}/attendance`).then(handleResponse),
  getAttendanceToday: () => fetch(`${API_BASE_URL}/attendance/today`).then(handleResponse),
  clockIn: (formData) => fetch(`${API_BASE_URL}/attendance/clock-in`, {
    method: 'POST',
    body: formData
  }).then(handleResponse),
  clockOut: (formData) => fetch(`${API_BASE_URL}/attendance/clock-out`, {
    method: 'POST',
    body: formData
  }).then(handleResponse),

  // Tasks
  getTasks: () => fetch(`${API_BASE_URL}/tasks`).then(handleResponse),
  addTask: (data) => fetch(`${API_BASE_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateTaskStatus: (id, status) => fetch(`${API_BASE_URL}/tasks/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  }).then(handleResponse),
  getTaskCustomers: (id) => fetch(`${API_BASE_URL}/tasks/${id}/customers`).then(handleResponse),
  markCustomerCollected: (taskId, customerId, collected) => fetch(`${API_BASE_URL}/tasks/${taskId}/customers/${customerId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collected })
  }).then(handleResponse),
  deleteTask: (id) => fetch(`${API_BASE_URL}/tasks/${id}`, { method: 'DELETE' }).then(handleResponse),

  // Inventory
  getInventory: () => fetch(`${API_BASE_URL}/inventory`).then(handleResponse),
  addInventory: (data) => fetch(`${API_BASE_URL}/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateInventory: (id, data) => fetch(`${API_BASE_URL}/inventory/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  deleteInventory: (id) => fetch(`${API_BASE_URL}/inventory/${id}`, { method: 'DELETE' }).then(handleResponse),

  // Debts
  getDebts: () => fetch(`${API_BASE_URL}/debts`).then(handleResponse),
  addDebt: (data) => fetch(`${API_BASE_URL}/debts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateDebtStatus: (id, status) => fetch(`${API_BASE_URL}/debts/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  }).then(handleResponse),
  deleteDebt: (id) => fetch(`${API_BASE_URL}/debts/${id}`, { method: 'DELETE' }).then(handleResponse),

  // User Management
  getUsers: () => fetch(`${API_BASE_URL}/users`).then(handleResponse),
  createUser: (data) => fetch(`${API_BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  resetUserPassword: (id, newPassword) => fetch(`${API_BASE_URL}/users/${id}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword })
  }).then(handleResponse),
  resetUser2FA: (id) => fetch(`${API_BASE_URL}/users/${id}/reset-2fa`, {
    method: 'POST'
  }).then(handleResponse),
  fullUserReset: (id, newPassword) => fetch(`${API_BASE_URL}/users/${id}/full-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword })
  }).then(handleResponse),
  
  // Settings
  getSettings: () => fetch(`${API_BASE_URL}/settings`).then(handleResponse),
  updateSettings: (data) => fetch(`${API_BASE_URL}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),

  // Notifications
  getNotifications: (userId) => fetch(`${API_BASE_URL}/users/${userId}/notifications`).then(handleResponse),
  markNotificationRead: (id) => fetch(`${API_BASE_URL}/notifications/${id}/read`, { method: 'PUT' }).then(handleResponse),
  markAllNotificationsRead: (userId) => fetch(`${API_BASE_URL}/users/${userId}/notifications/read-all`, { method: 'PUT' }).then(handleResponse),
  
  // Archive
  getArchives: () => fetch(`${API_BASE_URL}/archives`).then(handleResponse),
  uploadArchive: (formData) => fetch(`${API_BASE_URL}/archives`, {
    method: 'POST',
    body: formData
  }).then(handleResponse),
  deleteArchive: (id) => fetch(`${API_BASE_URL}/archives/${id}`, { method: 'DELETE' }).then(handleResponse),
  
  globalSearch: (q) => fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(q)}`).then(handleResponse),

  // Chat
  getMessages: (userId) => fetch(`${API_BASE_URL}/messages?userId=${userId}`).then(handleResponse),
  sendMessage: (data) => fetch(`${API_BASE_URL}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),

  sendWhatsAppNotification: (data) => fetch(`${API_BASE_URL}/whatsapp/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
};
