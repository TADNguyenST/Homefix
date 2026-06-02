// ============================================================
// HOMEFIX AI — Review Routes
// ============================================================

const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');
const { validate, createReviewSchema } = require('../middlewares/validators');
const { createReview, getTechReviews } = require('../controllers/reviewController');

// Public: Xem đánh giá của 1 thợ
router.get('/technician/:techProfileId', getTechReviews);

// Protected: Khách đánh giá
router.post('/booking/:bookingId', authMiddleware, roleMiddleware(['CUSTOMER']), validate(createReviewSchema), createReview);

module.exports = router;
