import axiosClient from './axiosClient';

export const blogApi = {
  // Public
  getPublicBlogs: (params) => {
    return axiosClient.get('/blogs', { params });
  },
  getBlogBySlug: (slug) => {
    return axiosClient.get(`/blogs/${slug}`);
  },

  // Admin
  getAllBlogsAdmin: () => {
    return axiosClient.get('/blogs/admin/all');
  },
  createBlog: (data) => {
    return axiosClient.post('/blogs/admin', data);
  },
  updateBlog: (id, data) => {
    return axiosClient.put(`/blogs/admin/${id}`, data);
  },
  deleteBlog: (id) => {
    return axiosClient.delete(`/blogs/admin/${id}`);
  }
};
