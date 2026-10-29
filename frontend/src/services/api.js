import axios from 'axios';

export const API_BASE_URL = 'https://ai-attendance-pro-9tyd.onrender.com';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Authorization header if token exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gss_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercept responses to handle 401s
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token if expired or unauthorized
      const path = window.location.pathname;
      if (!path.includes('/login') && !path.includes('/kiosk')) {
        localStorage.removeItem('gss_token');
        localStorage.removeItem('gss_user');
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const loginApi = async (email, password) => {
  const res = await api.post('/api/auth/login', { email, password });
  return res.data;
};

export const getMeApi = async () => {
  const res = await api.get('/api/auth/me');
  return res.data;
};

export const changePasswordApi = async (current_password, new_password, confirm_password) => {
  const res = await api.post('/api/auth/change-password', {
    current_password,
    new_password,
    confirm_password,
  });
  return res.data;
};

// Department APIs (Dynamic)
export const getDepartmentsApi = async () => {
  const res = await api.get('/api/departments');
  return res.data;
};

export const createDepartmentApi = async (data) => {
  const res = await api.post('/api/departments', data);
  return res.data;
};

export const updateDepartmentApi = async (id, data) => {
  const res = await api.put(`/api/departments/${id}`, data);
  return res.data;
};

export const deleteDepartmentApi = async (id) => {
  const res = await api.delete(`/api/departments/${id}`);
  return res.data;
};

// Employee APIs
export const getEmployeesApi = async (params = {}) => {
  const res = await api.get('/api/employees', { params });
  return res.data;
};

export const getEmployeeApi = async (id) => {
  const res = await api.get(`/api/employees/${id}`);
  return res.data;
};

export const createEmployeeApi = async (data) => {
  const res = await api.post('/api/employees', data);
  return res.data;
};

export const updateEmployeeApi = async (id, data) => {
  const res = await api.put(`/api/employees/${id}`, data);
  return res.data;
};

export const deleteEmployeeApi = async (id) => {
  const res = await api.delete(`/api/employees/${id}`);
  return res.data;
};

export const registerFaceApi = async (id, imageBase64, consent = true) => {
  const res = await api.post(`/api/employees/${id}/register-face`, {
    image_base64: imageBase64,
    consent,
  });
  return res.data;
};

export const removeFaceApi = async (id) => {
  const res = await api.delete(`/api/employees/${id}/face`);
  return res.data;
};

// Attendance & Face Recognition APIs
export const recognizeFrameApi = async (imageBase64) => {
  const res = await api.post('/api/attendance/recognize-frame', {
    image_base64: imageBase64,
  });
  return res.data;
};

export const checkInApi = async (payload) => {
  const res = await api.post('/api/attendance/check-in', payload);
  return res.data;
};

export const checkOutApi = async (payload) => {
  const res = await api.post('/api/attendance/check-out', payload);
  return res.data;
};

export const getTodayAttendanceApi = async () => {
  const res = await api.get('/api/attendance/today');
  return res.data;
};

export const getAttendanceHistoryApi = async (params = {}) => {
  const res = await api.get('/api/attendance/history', { params });
  return res.data;
};

export const getLateArrivalsApi = async (params = {}) => {
  const res = await api.get('/api/attendance/late-arrivals', { params });
  return res.data;
};

export const getAbsentEmployeesApi = async (params = {}) => {
  const res = await api.get('/api/attendance/absent-employees', { params });
  return res.data;
};

export const getCurrentlyWorkingApi = async (params = {}) => {
  const res = await api.get('/api/attendance/currently-working', { params });
  return res.data;
};

export const getDashboardStatsApi = async () => {
  const res = await api.get('/api/dashboard/stats');
  return res.data;
};

export const getAuditLogsApi = async (limit = 50) => {
  const res = await api.get('/api/audit-logs', { params: { limit } });
  return res.data;
};

export const getExportCsvUrl = (params = {}) => {
  const token = localStorage.getItem('gss_token');
  const allParams = { ...params };
  if (token) {
    allParams.token = token;
  }
  const searchParams = new URLSearchParams(allParams).toString();
  return `${API_BASE_URL}/api/attendance/export?${searchParams}`;
};

export const downloadAttendanceCsvApi = async (params = {}) => {
  const token = localStorage.getItem('gss_token');
  const res = await api.get('/api/attendance/export', {
    params,
    headers: {
      Authorization: `Bearer ${token}`
    },
    responseType: 'blob',
  });

  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  link.setAttribute('download', `Gateway_Attendance_Report_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export default api;
