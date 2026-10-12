import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://eliteresidency-2.onrender.com/api' : '/api')
});

// Request interceptor to add auth token
API.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (user?.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  return config;
});

// Response interceptor for auth errors
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (data) => API.post('/auth/login', data),
  getMe: () => API.get('/auth/me'),
  getUsers: () => API.get('/auth/users'),
  createUser: (data) => API.post('/auth/users', data),
  updateUser: (id, data) => API.put(`/auth/users/${id}`, data),
  resetPassword: (id, password) => API.put(`/auth/users/${id}/password`, { password })
};

// Reports API
export const reportAPI = {
  getAll: (params) => API.get('/reports', { params }),
  getById: (id) => API.get(`/reports/${id}`),
  getStats: () => API.get('/reports/stats'),
  create: (data) => API.post('/reports', data),
  update: (id, data) => API.put(`/reports/${id}`, data),
  lock: (id, lock) => API.put(`/reports/${id}/lock`, { lock }),
  delete: (id) => API.delete(`/reports/${id}`)
};

// Audit Logs API
export const auditAPI = {
  getAll: (params) => API.get('/audit-logs', { params }),
  getByReport: (reportId) => API.get(`/audit-logs/report/${reportId}`),
  getById: (id) => API.get(`/audit-logs/${id}`)
};

export const customerAPI = {
  getAll: (search = '') => API.get('/customers', { params: search ? { search } : {} }),
  save: (data) => API.post('/customers', data)
};

export default API;
