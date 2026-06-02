// ============================================================
// HOMEFIX AI — AI Routes
// ============================================================

const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');
const { validate, aiDiagnoseSchema } = require('../middlewares/validators');
const { diagnose, getRecommendedTechnicians, sentiment } = require('../controllers/aiController');

// Customer/All: AI chẩn đoán sự cố (Public)
router.post('/diagnose', validate(aiDiagnoseSchema), diagnose);

// Admin: AI gợi ý thợ cho booking
router.get('/recommend-tech/:bookingId', authMiddleware, roleMiddleware(['ADMIN']), getRecommendedTechnicians);

// Internal: Phân tích cảm xúc (dùng cho review)
router.post('/sentiment', authMiddleware, roleMiddleware(['ADMIN']), sentiment);

module.exports = router;
