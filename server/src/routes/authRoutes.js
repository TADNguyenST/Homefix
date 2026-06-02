// ============================================================
// HOMEFIX AI — Auth Routes
// ============================================================

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const { validate, registerSchema, loginSchema, verifyOtpSchema, forgotPasswordSchema, resetPasswordSchema, updateProfileSchema, changePasswordSchema } = require('../middlewares/validators');
const {
  register,
  verifyOtp,
  resendOtp,
  login,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  changePassword,
} = require('../controllers/authController');

// Public routes (không cần đăng nhập)
router.post('/register', validate(registerSchema), register);
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtp);
router.post('/resend-otp', validate(forgotPasswordSchema), resendOtp); // Dùng chung schema (chỉ cần email)
router.post('/login', validate(loginSchema), login);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

// Protected routes (cần đăng nhập)
router.get('/me', authMiddleware, getMe);
router.put('/profile', authMiddleware, validate(updateProfileSchema), updateProfile);
router.put('/change-password', authMiddleware, validate(changePasswordSchema), changePassword);

module.exports = router;
