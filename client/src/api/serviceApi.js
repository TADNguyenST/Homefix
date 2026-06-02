import axiosClient from './axiosClient';

export const serviceApi = {
  getAll: (params) => axiosClient.get('/services', { params }),
  getById: (id) => axiosClient.get(`/services/${id}`),
  getCategories: () => axiosClient.get('/services/categories'),
  getDeviceTypes: () => axiosClient.get('/services/device-types'),
};
