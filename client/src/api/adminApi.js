import axiosClient from './axiosClient';

export const adminApi = {
  // Dashboard
  getDashboard: () => axiosClient.get('/admin/dashboard'),

  // Bookings
  getBookings: (params) => axiosClient.get('/admin/bookings', { params }),
  getBookingById: (id) => axiosClient.get(`/admin/bookings/${id}`),
  confirmBooking: (id) => axiosClient.put(`/admin/bookings/${id}/confirm`),
  assignTech: (id, data) => axiosClient.put(`/admin/bookings/${id}/assign`, data),
  reassignTech: (id, data) => axiosClient.put(`/admin/bookings/${id}/reassign`, data),
  cancelBooking: (id, data) => axiosClient.put(`/admin/bookings/${id}/cancel`, data),

  // Users
  getUsers: (params) => axiosClient.get('/admin/users', { params }),
  lockUser: (id) => axiosClient.put(`/admin/users/${id}/lock`),
  unlockUser: (id) => axiosClient.put(`/admin/users/${id}/unlock`),

  // Technicians
  getTechnicians: (params) => axiosClient.get('/admin/technicians', { params }),
  createTechnician: (data) => axiosClient.post('/admin/technicians', data),
  updateTechnician: (id, data) => axiosClient.put(`/admin/technicians/${id}`, data),
  deactivateTech: (id) => axiosClient.put(`/admin/technicians/${id}/deactivate`),
  updateTechSkills: (id, data) => axiosClient.put(`/admin/technicians/${id}/skills`, data),
  updateTechSchedule: (id, data) => axiosClient.put(`/admin/technicians/${id}/schedule`, data),

  // Categories
  getCategories: (params) => axiosClient.get('/admin/categories', { params }),
  createCategory: (data) => axiosClient.post('/admin/categories', data),
  updateCategory: (id, data) => axiosClient.put(`/admin/categories/${id}`, data),
  deleteCategory: (id) => axiosClient.delete(`/admin/categories/${id}`),

  // Services
  getServices: (params) => axiosClient.get('/admin/services', { params }),
  createService: (data) => axiosClient.post('/admin/services', data),
  updateService: (id, data) => axiosClient.put(`/admin/services/${id}`, data),
  deleteService: (id) => axiosClient.delete(`/admin/services/${id}`),

  // Device Types
  getDeviceTypes: (params) => axiosClient.get('/admin/device-types', { params }),
  createDeviceType: (data) => axiosClient.post('/admin/device-types', data),
  updateDeviceType: (id, data) => axiosClient.put(`/admin/device-types/${id}`, data),
  deleteDeviceType: (id) => axiosClient.delete(`/admin/device-types/${id}`),

  // Districts & Wards
  getDistricts: (params) => axiosClient.get('/admin/districts', { params }),
  createDistrict: (data) => axiosClient.post('/admin/districts', data),
  updateDistrict: (id, data) => axiosClient.put(`/admin/districts/${id}`, data),
  deleteDistrict: (id) => axiosClient.delete(`/admin/districts/${id}`),
  createWard: (districtId, data) => axiosClient.post(`/admin/districts/${districtId}/wards`, data),
  updateWard: (id, data) => axiosClient.put(`/admin/wards/${id}`, data),
  deleteWard: (id) => axiosClient.delete(`/admin/wards/${id}`),

  // Vouchers
  getVouchers: () => axiosClient.get('/admin/vouchers'),
  createVoucher: (data) => axiosClient.post('/admin/vouchers', data),
  updateVoucher: (id, data) => axiosClient.put(`/admin/vouchers/${id}`, data),
  toggleVoucher: (id) => axiosClient.put(`/admin/vouchers/${id}/toggle`),
  getVoucherUsages: (id, params) => axiosClient.get(`/admin/vouchers/${id}/usages`, { params }),

  // Payments
  getPayments: (params) => axiosClient.get('/admin/payments', { params }),
  getPaymentById: (id) => axiosClient.get(`/admin/payments/${id}`),
  confirmCashSettlement: (id, data = {}) => axiosClient.put(`/admin/payments/${id}/confirm-cash-settlement`, data),

  // Complaints
  getComplaints: (params) => axiosClient.get('/admin/complaints', { params }),
  resolveComplaint: (id, data) => axiosClient.put(`/admin/complaints/${id}/resolve`, data),

  // AI
  recommendTech: (bookingId) => axiosClient.get(`/ai/recommend-tech/${bookingId}?_t=${Date.now()}`),
};

