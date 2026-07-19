import axiosClient from './axiosClient';

export const serviceApi = {
  getAll: (params) => axiosClient.get('/services', { params }),
  getPopular: () => axiosClient.get('/services/popular'),
  getById: (id) => axiosClient.get(`/services/${id}`),
  getCategories: () => axiosClient.get('/services/categories'),
  getDeviceTypes: () => axiosClient.get('/services/device-types'),
  getReviews: (id, params) => axiosClient.get(`/services/${id}/reviews`, { params }),
};
