import axiosClient from './axiosClient';

export const paymentApi = {
  createVnpay: (bookingId) => axiosClient.post(`/payments/booking/${bookingId}/vnpay`),
  verifyVnpayReturn: (params) => axiosClient.get('/payments/vnpay-return', { params }),
  getHistory: (params) => axiosClient.get('/payments/history', { params }),
};
