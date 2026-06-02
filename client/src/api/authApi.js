import axiosClient from './axiosClient';

export const authApi = {
  register: (data) => axiosClient.post('/auth/register', data),
  verifyOtp: (data) => axiosClient.post('/auth/verify-otp', data),
  resendOtp: (data) => axiosClient.post('/auth/resend-otp', data),
  login: (data) => axiosClient.post('/auth/login', data),
  forgotPassword: (data) => axiosClient.post('/auth/forgot-password', data),
  resetPassword: (data) => axiosClient.post('/auth/reset-password', data),
  getMe: () => axiosClient.get('/auth/me'),
  updateProfile: (data) => axiosClient.put('/auth/profile', data),
  changePassword: (data) => axiosClient.put('/auth/change-password', data),
};
