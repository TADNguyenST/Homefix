// ============================================================
// HOMEFIX AI — Booking Routes
// ============================================================

const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');
const { validate, createBookingSchema, rescheduleBookingSchema } = require('../middlewares/validators');
const {
  createBooking,
  getMyBookings,
  getBookingDetail,
  cancelBooking,
  rescheduleBooking,
  validateVoucher,
  getAvailableVouchers,
} = require('../controllers/bookingController');

// Tất cả routes đều yêu cầu đăng nhập
router.use(authMiddleware);

// Customer routes
router.get('/vouchers/available', roleMiddleware(['CUSTOMER']), getAvailableVouchers);
router.post('/validate-voucher', roleMiddleware(['CUSTOMER']), validateVoucher);
router.post('/', roleMiddleware(['CUSTOMER']), validate(createBookingSchema), createBooking);
router.get('/my', roleMiddleware(['CUSTOMER']), getMyBookings);
router.put('/:id/cancel', roleMiddleware(['CUSTOMER']), cancelBooking);
router.put('/:id/reschedule', roleMiddleware(['CUSTOMER']), validate(rescheduleBookingSchema), rescheduleBooking);

// Shared route (Customer, Technician, Admin đều xem được)
router.get('/:id', getBookingDetail);

module.exports = router;
