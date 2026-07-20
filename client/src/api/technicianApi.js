import axiosClient from './axiosClient';

export const technicianApi = {
  getJobs: (params) => axiosClient.get('/technician/jobs', { params }),
  getJobHistory: (params) => axiosClient.get('/technician/jobs/history', { params }),
  getJobById: (id) => axiosClient.get(`/technician/jobs/${id}`),
  acceptJob: (id) => axiosClient.put(`/technician/jobs/${id}/accept`),
  rejectJob: (id, data) => axiosClient.put(`/technician/jobs/${id}/reject`, data),
  updateJobStatus: (id, data) => axiosClient.put(`/technician/jobs/${id}/status`, data),
  createQuotation: (id, data) => axiosClient.post(`/technician/jobs/${id}/quotation`, data),
  confirmCash: (id) => axiosClient.put(`/technician/jobs/${id}/confirm-cash`),
  getSchedule: () => axiosClient.get('/technician/schedule'),
  getRating: () => axiosClient.get('/technician/rating'),
  getMyCashWallet: () => axiosClient.get('/technician/cash-wallet'),
};
