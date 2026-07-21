const express = require('express');
const router = express.Router();
const {
  getPublicBlogs,
  getBlogBySlug,
  getAllBlogsAdmin,
  createBlog,
  updateBlog,
  deleteBlog
} = require('../controllers/blogController');
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');

// Public routes (cho khách)
router.get('/', getPublicBlogs);
router.get('/:slug', getBlogBySlug);

// Admin routes (yêu cầu đăng nhập và có role ADMIN)
router.use('/admin', authMiddleware, roleMiddleware(['ADMIN']));
router.get('/admin/all', getAllBlogsAdmin);
router.post('/admin', createBlog);
router.put('/admin/:id', updateBlog);
router.delete('/admin/:id', deleteBlog);

module.exports = router;
