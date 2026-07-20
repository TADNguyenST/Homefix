import axiosClient from './axiosClient';

export const uploadApi = {
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);

    return axiosClient.post('/upload', formData);
  },
};
