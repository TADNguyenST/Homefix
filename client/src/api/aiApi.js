import axiosClient from './axiosClient';

export const aiApi = {
  diagnose: (data) => axiosClient.post('/ai/diagnose', data),
};
