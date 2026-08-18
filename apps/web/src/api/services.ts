import api, { ApiResponse } from './client';

// ==================== AUTH ====================
export const authApi = {
  login: (data: { email: string; password: string }) =>
    api.post<ApiResponse<{ user: object; accessToken: string; refreshToken: string }>>('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: object) => api.put('/auth/profile', data),
  changePassword: (data: object) => api.put('/auth/change-password', data),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data: { token: string; newPassword: string }) => api.post('/auth/reset-password', data),
};

// ==================== USERS ====================
export const usersApi = {
  list: (params?: object) => api.get('/users', { params }),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: object) => api.post('/users', data),
  update: (id: string, data: object) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  hardDelete: (id: string) => api.delete(`/users/${id}/permanent`),
  resetPassword: (id: string, data: object) => api.post(`/users/${id}/reset-password`, data),
};

// ==================== PROJECTS ====================
export const projectsApi = {
  list: (params?: object) => api.get('/projects', { params }),
  get: (id: string) => api.get(`/projects/${id}`),
  getDashboard: (id: string) => api.get(`/projects/${id}/dashboard`),
  create: (data: object) => api.post('/projects', data),
  update: (id: string, data: object) => api.put(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  addMember: (id: string, data: object) => api.post(`/projects/${id}/members`, data),
  removeMember: (id: string, userId: string) => api.delete(`/projects/${id}/members/${userId}`),
};

// ==================== EXPENSES ====================
export const expensesApi = {
  list: (params?: object) => api.get('/expenses', { params }),
  get: (id: string) => api.get(`/expenses/${id}`),
  create: (data: object) => api.post('/expenses', data),
  update: (id: string, data: object) => api.put(`/expenses/${id}`, data),
  approve: (id: string, data: object) => api.post(`/expenses/${id}/approve`, data),
  delete: (id: string) => api.delete(`/expenses/${id}`),
  getSummary: (params?: object) => api.get('/expenses/summary', { params }),
};

// ==================== DAILY REPORTS ====================
export const dailyReportsApi = {
  list: (params?: object) => api.get('/daily-reports', { params }),
  get: (id: string) => api.get(`/daily-reports/${id}`),
  create: (data: object) => api.post('/daily-reports', data),
  update: (id: string, data: object) => api.put(`/daily-reports/${id}`, data),
  delete: (id: string) => api.delete(`/daily-reports/${id}`),
  getWorkerOptions: (params: { projectId: string; taskId?: string }) =>
    api.get('/daily-reports/worker-options', { params }),
  uploadPhoto: (id: string, file: File, caption?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (caption) formData.append('caption', caption);
    return api.post(`/daily-reports/${id}/photos`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  sync: (reports: object[]) => api.post('/daily-reports/sync', { reports }),
};

// ==================== INVENTORY ====================
export const inventoryApi = {
  getMaterials: (params?: object) => api.get('/inventory/materials', { params }),
  createMaterial: (data: object) => api.post('/inventory/materials', data),
  updateMaterial: (id: string, data: object) => api.put(`/inventory/materials/${id}`, data),
  getCategories: () => api.get('/inventory/categories'),
  createCategory: (data: object) => api.post('/inventory/categories', data),
  getAllInventory: (params?: object) => api.get('/inventory', { params }),
  getProjectInventory: (projectId: string, params?: object) => api.get(`/inventory/project/${projectId}`, { params }),
  stockIn: (data: object) => api.post('/inventory/stock-in', data),
  stockOut: (data: object) => api.post('/inventory/stock-out', data),
  getMovements: (params?: object) => api.get('/inventory/movements', { params }),
};

// ==================== TRUCK ENTRIES ====================
export const truckEntriesApi = {
  list: (params?: object) => api.get('/truck-entries', { params }),
  create: (data: object) => api.post('/truck-entries', data),
  update: (id: string, data: object) => api.put(`/truck-entries/${id}`, data),
  delete: (id: string) => api.delete(`/truck-entries/${id}`),
  getSummary: (params?: object) => api.get('/truck-entries/summary', { params }),
  transferToExpense: (data: { projectId: string; amount: number; date?: string }) => api.post('/truck-entries/transfer', data),
};

// ==================== MACHINERY ====================
export const machineryApi = {
  getLogs: (params?: object) => api.get('/machinery/logs', { params }),
  createLog: (data: object) => api.post('/machinery/logs', data),
  updateLog: (id: string, data: object) => api.put(`/machinery/logs/${id}`, data),
  deleteLog: (id: string) => api.delete(`/machinery/logs/${id}`),
  getSummary: (params?: { projectId?: string }) => api.get('/machinery/summary', { params }),
  transferToExpense: (data: { projectId: string; amount: number; date?: string }) => api.post('/machinery/transfer', data),
};

// ==================== VENDORS ====================
export const vendorsApi = {
  list: (params?: object) => api.get('/vendors', { params }),
  get: (id: string) => api.get(`/vendors/${id}`),
  create: (data: object) => api.post('/vendors', data),
  update: (id: string, data: object) => api.put(`/vendors/${id}`, data),
  delete: (id: string) => api.delete(`/vendors/${id}`),
};

// ==================== PURCHASE ORDERS ====================
export const purchaseOrdersApi = {
  list: (params?: object) => api.get('/purchase-orders', { params }),
  get: (id: string) => api.get(`/purchase-orders/${id}`),
  create: (data: object) => api.post('/purchase-orders', data),
  submit: (id: string) => api.post(`/purchase-orders/${id}/submit`),
  approve: (id: string, data: object) => api.post(`/purchase-orders/${id}/approve`, data),
  goodsReceipt: (id: string, data: object) => api.post(`/purchase-orders/${id}/goods-receipt`, data),
};

// ==================== TASKS ====================
export const tasksApi = {
  list: (params?: object) => api.get('/tasks', { params }),
  getByProject: (projectId: string) => api.get(`/tasks/project/${projectId}`),
  get: (id: string) => api.get(`/tasks/${id}`),
  create: (data: object) => api.post('/tasks', data),
  update: (id: string, data: object) => api.put(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  addComment: (id: string, content: string) => api.post(`/tasks/${id}/comments`, { content }),
  getEstimate: (data: { taskTypeId: string; components: any[] }) =>
  api.post('/tasks/estimate', data),
  getMaterialCheck: (id: string, percent: number) => api.get(`/tasks/${id}/material-check`, { params: { percent } }),
};

// ==================== TASK TYPES (Standards Library) ====================
export const taskTypesApi = {
  list: (params?: { trade?: string }) => api.get('/task-types', { params }),
  get: (id: string) => api.get(`/task-types/${id}`),
  create: (data: object) => api.post('/task-types', data),
  update: (id: string, data: object) => api.put(`/task-types/${id}`, data),
  upsertMaterial: (id: string, data: { materialId: string; qtyPerUnit: number }) =>
    api.post(`/task-types/${id}/materials`, data),
  deleteMaterial: (id: string, coefficientId: string) =>
    api.delete(`/task-types/${id}/materials/${coefficientId}`),
};

export const taskDailyLogsApi = {
  list: (taskId: string) => api.get(`/tasks/${taskId}/daily-logs`),
  create: (taskId: string, data: object) => api.post(`/tasks/${taskId}/daily-logs`, data),
  review: (taskId: string, decision: 'APPROVE' | 'REVERT') =>
    api.post(`/tasks/${taskId}/daily-logs/review`, { decision }),
};

// ==================== ANALYTICS ====================
export const analyticsApi = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getExpenses: (params?: object) => api.get('/analytics/expenses', { params }),
  getInventory: (params?: object) => api.get('/analytics/inventory', { params }),
  getBudget: () => api.get('/analytics/budget'),
  getMachinery: (params?: object) => api.get('/analytics/machinery', { params }),
};

// ==================== DOCUMENTS (legacy — superseded by uploadsApi) ====================
export const documentsApi = {
  list: (params?: object) => api.get('/documents', { params }),
  upload: (data: FormData) => api.post('/documents', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getUrl: (id: string) => api.get(`/documents/${id}/url`),
  delete: (id: string) => api.delete(`/documents/${id}`),
};

// ==================== NOTIFICATIONS ====================
export const notificationsApi = {
  list: (params?: object) => api.get('/notifications', { params }),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

// ==================== CLIENTS ====================
export const clientsApi = {
  list: (params?: object) => api.get('/clients', { params }),
  create: (data: object) => api.post('/clients', data),
  update: (id: string, data: object) => api.put(`/clients/${id}`, data),
};

// ==================== LABOUR ====================
export const labourApi = {
  list: (params?: object) => api.get('/labour', { params }),
  create: (data: object) => api.post('/labour', data),
  recordAttendance: (data: object) => api.post('/labour/attendance', data),
  getContractors: () => api.get('/labour/contractors'),
  createContractor: (data: object) => api.post('/labour/contractors', data),
  assignToProject: (workerId: string, projectId: string) => api.post(`/labour/${workerId}/projects`, { projectId }),
  unassignFromProject: (workerId: string, projectId: string) => api.delete(`/labour/${workerId}/projects/${projectId}`),
};

// ==================== SALARY ====================
export const salaryApi = {
  list: (params?: object) => api.get('/salary', { params }),
  generate: (data: object) => api.post('/salary/generate', data),
  processPayment: (id: string, data: object) => api.post(`/salary/${id}/pay`, data),
  getWorkerSummary: (params?: { projectId?: string }) => api.get('/salary/workers/summary', { params }),
  payWorker: (data: { workerId: string; projectId: string; amount: number; date?: string }) =>
  api.post('/salary/workers/pay', data),
  getTempWorkerSummary: (params?: { projectId?: string }) => api.get('/salary/workers/temp-summary', { params }),
  payTempWorker: (data: { workerName: string; projectId: string; amount: number; date?: string }) =>
  api.post('/salary/workers/temp-pay', data),
};

// ==================== AUDIT LOGS ====================
export const auditLogsApi = {
  list: (params?: object) => api.get('/audit-logs', { params }),
};

// ==================== QUOTATIONS ====================
export const quotationsApi = {
  list: (params?: object) => api.get('/quotations', { params }),
  create: (data: object) => api.post('/quotations', data),
};

// ==================== DOCUMENT CATEGORIES ====================
export const documentCategoriesApi = {
  list: (params?: { module?: string }) => api.get('/document-categories', { params }),
  create: (data: { module: string; name: string }) => api.post('/document-categories', data),
};

// ==================== UPLOADS (generic — receipts, slips, documents, etc.) ====================
export const uploadsApi = {
  upload: (formData: FormData, onProgress?: (pct: number) => void) =>
    api.post('/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    }),
  list: (params?: { projectId?: string; module?: string; category?: string }) =>
    api.get('/uploads', { params }),
  getModules: () => api.get('/uploads/modules'),
  delete: (id: string) => api.delete(`/uploads/${id}`),
};

export const getFileViewUrl = (uploadId: string) =>
  `${api.defaults.baseURL}/uploads/file/${uploadId}`;

// Fetches a protected file through the authenticated axios instance (so the
// auth token actually gets attached, unlike a plain <a href> link), then
// opens it in a new tab from an in-memory blob URL.
export const viewSecureFile = async (fileUrl: string): Promise<void> => {
  const relativePath = fileUrl.replace(api.defaults.baseURL || '', '');
  const res = await api.get(relativePath, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(res.data);
  window.open(blobUrl, '_blank');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
};