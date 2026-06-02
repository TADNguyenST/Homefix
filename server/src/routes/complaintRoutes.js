// ============================================================
// HOMEFIX AI — Complaint Routes
// ============================================================

const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');
const { validate, createComplaintSchema, resolveComplaintSchema } = require('../middlewares/validators');
const { createComplaint, getMyComplaints, resolveComplaint } = require('../controllers/complaintController');

router.use(authMiddleware);

// Customer routes
router.post('/booking/:bookingId', roleMiddleware(['CUSTOMER']), validate(createComplaintSchema), createComplaint);
router.get('/my', roleMiddleware(['CUSTOMER']), getMyComplaints);

// Admin routes
router.put('/:id/resolve', roleMiddleware(['ADMIN']), validate(resolveComplaintSchema), resolveComplaint);

module.exports = router;
