// ============================================================
// HOMEFIX AI — Technician Routes
// ============================================================

const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');
const { validate, createQuotationSchema, updateJobStatusSchema } = require('../middlewares/validators');
const {
  getAvailableTechnicians,
  getAssignedJobs,
  getJobDetail,
  acceptJob,
  rejectJob,
  updateJobStatus,
  createQuotation,
  confirmCashPayment,
  getMyCashWallet,
  getMySchedule,
  getJobHistory,
  getMyRating,
} = require('../controllers/technicianController');

router.get('/available', authMiddleware, roleMiddleware(['CUSTOMER']), getAvailableTechnicians);

// Tất cả routes đều yêu cầu TECHNICIAN role
router.use(authMiddleware, roleMiddleware(['TECHNICIAN']));

// Job management
router.get('/jobs', getAssignedJobs);
router.get('/jobs/history', getJobHistory);
router.get('/jobs/:id', getJobDetail);
router.put('/jobs/:id/accept', acceptJob);
router.put('/jobs/:id/reject', rejectJob);
router.put('/jobs/:id/status', validate(updateJobStatusSchema), updateJobStatus);
router.post('/jobs/:id/quotation', validate(createQuotationSchema), createQuotation);
router.put('/jobs/:id/confirm-cash', confirmCashPayment);

// Schedule & Stats
router.get('/cash-wallet', getMyCashWallet);
router.get('/schedule', getMySchedule);
router.get('/rating', getMyRating);

module.exports = router;
