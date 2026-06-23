// ============================================================
// HOMEFIX AI — Axios Client
// Base URL, JWT interceptor, error handler
// ============================================================

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — Attach JWT token
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('homefix_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — Handle errors globally
axiosClient.interceptors.response.use(
  (response) => response.data, // Unwrap: return data directly
  (error) => {
    const { response } = error;

    if (response) {
      // 401 Unauthorized → logout
      if (response.status === 401) {
        localStorage.removeItem('homefix_token');
        localStorage.removeItem('homefix_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }

      // Return API error message
      const message = response.data?.message || response.data?.error || 'Đã xảy ra lỗi';
      const err = new Error(message);
      err.status = response.status;
      err.errors = response.data?.errors || [];
      return Promise.reject(err);
    }

    // Network error
    return Promise.reject(new Error('Không thể kết nối đến server'));
  }
);

export default axiosClient;
