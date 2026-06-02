import axiosClient from './axiosClient';

export const paymentApi = {
  createVnpay: (bookingId) => axiosClient.post(`/payments/booking/${bookingId}/vnpay`),
  getHistory: (params) => axiosClient.get('/payments/history', { params }),
};

