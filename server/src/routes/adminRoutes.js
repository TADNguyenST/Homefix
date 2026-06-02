// ============================================================
// HOMEFIX AI — Admin Routes
// Tất cả routes yêu cầu authMiddleware + roleMiddleware('ADMIN')
// ============================================================

const express = require('express');
const router = express.Router();

const {
  authMiddleware,
  roleMiddleware,
} = require('../middlewares/authMiddleware');

const {
  validate,
  createCategorySchema,
  createServiceSchema,
  createDeviceTypeSchema,
  createDistrictSchema,
  createWardSchema,
  createVoucherSchema,
  createTechnicianSchema,
  updateTechSkillsSchema,
  updateTechScheduleSchema,
  assignTechSchema,
  resolveComplaintSchema,
} = require('../middlewares/validators');

const admin = require('../controllers/adminController');

// ========================
// Middleware: Tất cả routes đều cần ADMIN
// ========================
router.use(authMiddleware, roleMiddleware(['ADMIN']));

// ========================
// BOOKING DISPATCH
// ========================
router.get('/bookings', admin.getBookings);
router.get('/bookings/:id', admin.getBookingDetail);
router.put('/bookings/:id/confirm', admin.confirmBooking);
router.put('/bookings/:id/assign', validate(assignTechSchema), admin.assignTechnician);
router.put('/bookings/:id/reassign', validate(assignTechSchema), admin.reassignTechnician);
router.put('/bookings/:id/cancel', admin.cancelBooking);

// ========================
// USER MANAGEMENT
// ========================
router.get('/users', admin.getUsers);
router.put('/users/:id/lock', admin.lockUser);
router.put('/users/:id/unlock', admin.unlockUser);

// ========================
// TECHNICIAN MANAGEMENT
// ========================
router.get('/technicians', admin.getTechnicians);
router.post('/technicians', validate(createTechnicianSchema), admin.createTechnician);
router.put('/technicians/:id', admin.updateTechnician);
router.put('/technicians/:id/deactivate', admin.deactivateTechnician);
router.put('/technicians/:id/skills', validate(updateTechSkillsSchema), admin.updateTechnicianSkills);
router.put('/technicians/:id/schedule', validate(updateTechScheduleSchema), admin.updateTechnicianSchedule);

// ========================
// CATEGORY CRUD
// ========================
router.get('/categories', admin.getCategories);
router.post('/categories', validate(createCategorySchema), admin.createCategory);
router.put('/categories/:id', admin.updateCategory);
router.delete('/categories/:id', admin.deleteCategory);

// ========================
// SERVICE CRUD
// ========================
router.get('/services', admin.getServices);
router.post('/services', validate(createServiceSchema), admin.createService);
router.put('/services/:id', admin.updateService);
router.delete('/services/:id', admin.deleteService);

// ========================
// DEVICE TYPE CRUD
// ========================
router.get('/device-types', admin.getDeviceTypes);
router.post('/device-types', validate(createDeviceTypeSchema), admin.createDeviceType);
router.put('/device-types/:id', admin.updateDeviceType);
router.delete('/device-types/:id', admin.deleteDeviceType);

// ========================
// DISTRICT & WARD
// ========================
router.get('/districts', admin.getDistricts);
router.post('/districts', validate(createDistrictSchema), admin.createDistrict);
router.put('/districts/:id', admin.updateDistrict);
router.delete('/districts/:id', admin.deleteDistrict);
router.post('/districts/:districtId/wards', validate(createWardSchema), admin.createWard);
router.put('/wards/:id', admin.updateWard);
router.delete('/wards/:id', admin.deleteWard);

// ========================
// VOUCHER CRUD
// ========================
router.get('/vouchers', admin.getVouchers);
router.post('/vouchers', validate(createVoucherSchema), admin.createVoucher);
router.put('/vouchers/:id', validate(createVoucherSchema), admin.updateVoucher);
router.put('/vouchers/:id/toggle', admin.toggleVoucher);

// ========================
// PAYMENT & COMPLAINT
// ========================
router.get('/payments', admin.getPayments);
router.get('/complaints', admin.getComplaints);
router.put('/complaints/:id/resolve', validate(resolveComplaintSchema), admin.resolveComplaint);

// ========================
// DASHBOARD
// ========================
router.get('/dashboard', admin.getDashboard);

module.exports = router;
