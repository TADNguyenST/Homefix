// ============================================================
// HOMEFIX AI — Payment Routes
// ============================================================

const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');
const {
  createVnpayUrl,
  vnpayReturn,
  vnpayIpn,
  getPaymentHistory,
} = require('../controllers/paymentController');

// Public: VNPAY gọi ngược về (không cần auth)
router.get('/vnpay-return', vnpayReturn);      // VNPAY redirect khách về đây
router.get('/vnpay-ipn', vnpayIpn);            // VNPAY gọi server-to-server

// Customer: Tạo link thanh toán VNPAY
router.post('/booking/:bookingId/vnpay', authMiddleware, roleMiddleware(['CUSTOMER']), createVnpayUrl);

// Customer: Xem lịch sử thanh toán
router.get('/history', authMiddleware, roleMiddleware(['CUSTOMER']), getPaymentHistory);

module.exports = router;
