const express = require('express');
const router = express.Router();
const {
  getCategories,
  getServices,
  getServiceById,
  getDeviceTypes,
  getPopularServices,
  getServiceReviews,
} = require('../controllers/serviceController');

// ==================== All Routes are Public ====================

// Lấy danh sách danh mục dịch vụ (bao gồm số dịch vụ mỗi danh mục)
router.get('/categories', getCategories);

// Lấy danh sách loại thiết bị
router.get('/device-types', getDeviceTypes);

// Lấy danh sách dịch vụ (có phân trang, lọc theo category_id, tìm kiếm theo tên)
router.get('/', getServices);

// Lấy danh sách 4 dịch vụ nổi bật
router.get('/popular', getPopularServices);

// Lấy chi tiết dịch vụ theo ID
router.get('/:id', getServiceById);

// Lấy đánh giá của dịch vụ theo ID
router.get('/:id/reviews', getServiceReviews);

module.exports = router;
