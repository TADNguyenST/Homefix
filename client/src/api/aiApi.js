import axiosClient from './axiosClient';

export const aiApi = {
  // Image analysis can legitimately take longer than the global 15 second timeout.
  diagnose: (data) => axiosClient.post('/ai/diagnose', data, { timeout: 60000 }),
};
