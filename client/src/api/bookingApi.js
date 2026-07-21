import axiosClient from './axiosClient';

export const bookingApi = {
  create: (data) => axiosClient.post('/bookings', data),
  getMyBookings: (params) => axiosClient.get('/bookings/my', { params }),
  getById: (id) => axiosClient.get(`/bookings/${id}`),
  cancel: (id, data) => axiosClient.put(`/bookings/${id}/cancel`, data),
  reschedule: (id, data) => axiosClient.put(`/bookings/${id}/reschedule`, data),
  getAvailableVouchers: () => axiosClient.get('/bookings/vouchers/available'),
  validateVoucher: (data) => axiosClient.post('/bookings/validate-voucher', data),
};

export const uploadApi = {
  image: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return axiosClient.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  remove: (url) => axiosClient.delete('/upload', { data: { url } }),
};

export const quotationApi = {
  getById: (id) => axiosClient.get(`/quotations/${id}`),
  getByBooking: (bookingId) => axiosClient.get(`/quotations/booking/${bookingId}`),
  accept: (id) => axiosClient.put(`/quotations/${id}/accept`),
  reject: (id) => axiosClient.put(`/quotations/${id}/reject`),
};

export const reviewApi = {
  create: (bookingId, data) => axiosClient.post(`/reviews/booking/${bookingId}`, data),
  getByTechnician: (techProfileId) => axiosClient.get(`/reviews/technician/${techProfileId}`),
};

export const complaintApi = {
  create: (bookingId, data) => axiosClient.post(`/complaints/booking/${bookingId}`, data),
  getMy: () => axiosClient.get('/complaints/my'),
};

export const addressApi = {
  getAll: () => axiosClient.get('/addresses'),
  create: (data) => axiosClient.post('/addresses', data),
  update: (id, data) => axiosClient.put(`/addresses/${id}`, data),
  remove: (id) => axiosClient.delete(`/addresses/${id}`),
  setDefault: (id) => axiosClient.put(`/addresses/${id}/default`),
  getDistricts: () => axiosClient.get('/addresses/districts'),
  getWards: (districtId) => axiosClient.get(`/addresses/wards/${districtId}`),
};

export const notificationApi = {
  getAll: (params) => axiosClient.get('/notifications', { params }),
  readAll: () => axiosClient.put('/notifications/read-all'),
  read: (id) => axiosClient.put(`/notifications/${id}/read`),
};
