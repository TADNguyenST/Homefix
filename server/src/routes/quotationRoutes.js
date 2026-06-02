// ============================================================
// HOMEFIX AI — Quotation Routes (Customer side)
// ============================================================

const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');
const { getQuotation, acceptQuotation, rejectQuotation } = require('../controllers/quotationController');

router.use(authMiddleware);

// Customer/Admin xem báo giá
router.get('/booking/:bookingId', getQuotation);

// Customer phản hồi
router.put('/:id/accept', roleMiddleware(['CUSTOMER']), acceptQuotation);
router.put('/:id/reject', roleMiddleware(['CUSTOMER']), rejectQuotation);

module.exports = router;
