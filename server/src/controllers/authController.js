// ============================================================
// HOMEFIX AI — Auth Controller (Full OTP Flow)
// ============================================================

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { success, error } = require('../utils/response');
const { sendOtpEmail, generateOtp, sendWelcomeEmail } = require('../utils/mailer');
const { BUSINESS_RULES, ROLES } = require('../config/constants');

// ========================
// REGISTER — Tạo tài khoản + Gửi OTP qua email
// ========================
const register = async (req, res) => {
  try {
    const { email, password, full_name, phone } = req.body;

    // Kiểm tra email đã tồn tại
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      // Nếu user đã tồn tại nhưng chưa active → cho phép gửi lại OTP
      if (!existingUser.is_active) {
        return error(res, 'Email đã được đăng ký nhưng chưa xác thực. Vui lòng dùng chức năng "Gửi lại OTP".', 409);
      }
      return error(res, 'Email đã được đăng ký', 409);
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, BUSINESS_RULES.SALT_ROUNDS);

    // Tạo user mới (is_active = false, chờ verify OTP)
    const user = await prisma.user.create({
      data: {
        email,
        password_hash,
        full_name,
        phone: phone || null,
        role: ROLES.CUSTOMER,
        is_active: false, // Chờ xác thực OTP mới kích hoạt
      },
      select: { id: true, email: true, full_name: true, role: true },
    });

    // Tạo OTP và lưu vào bảng PasswordResetToken (dùng chung cho register & reset)
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + BUSINESS_RULES.OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        otp_code: otpCode,
        expires_at: expiresAt,
      },
    });

    // Gửi email OTP
    try {
      await sendOtpEmail(email, otpCode, 'register');
    } catch (emailErr) {
      console.error('Register — gửi email thất bại:', emailErr.message);
      // Vẫn trả về thành công vì user đã được tạo, nhưng cảnh báo về email
      return success(res, { user }, 'Đăng ký thành công! Tuy nhiên gửi email OTP bị lỗi. Vui lòng dùng chức năng "Gửi lại OTP".', 201);
    }

    return success(res, { user }, 'Đăng ký thành công! Vui lòng kiểm tra email để lấy mã OTP xác thực.', 201);
  } catch (err) {
    console.error('Register error:', err);
    return error(res, 'Đăng ký thất bại. Vui lòng thử lại.', 500);
  }
};

// ========================
// VERIFY OTP — Xác thực tài khoản (kích hoạt is_active = true)
// ========================
const verifyOtp = async (req, res) => {
  try {
    const { email, otp_code } = req.body;

    // Tìm user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return error(res, 'Email không tồn tại trong hệ thống', 404);
    }

    // Nếu đã active rồi thì không cần verify nữa
    if (user.is_active) {
      return error(res, 'Tài khoản đã được kích hoạt trước đó', 400);
    }

    // Tìm OTP mới nhất chưa sử dụng, còn hạn
    const token = await prisma.passwordResetToken.findFirst({
      where: {
        user_id: user.id,
        otp_code: otp_code,
        used_at: null,
        expires_at: { gte: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!token) {
      return error(res, 'Mã OTP không hợp lệ hoặc đã hết hạn', 400);
    }

    // Đánh dấu OTP đã sử dụng & kích hoạt tài khoản
    await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { used_at: new Date() },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { is_active: true },
      }),
    ]);

    // Gửi email chào mừng (chạy ngầm, không await để không làm chậm API)
    sendWelcomeEmail(user.email, user.full_name).catch(err => console.error(err));

    return success(res, null, 'Xác thực thành công! Tài khoản đã được kích hoạt.');
  } catch (err) {
    console.error('Verify OTP error:', err);
    return error(res, 'Xác thực thất bại. Vui lòng thử lại.', 500);
  }
};

// ========================
// RESEND OTP — Gửi lại mã OTP (cho Register)
// ========================
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return error(res, 'Email không tồn tại trong hệ thống', 404);
    }

    if (user.is_active) {
      return error(res, 'Tài khoản đã được kích hoạt, không cần gửi lại OTP', 400);
    }

    // Kiểm tra cooldown (chống spam gửi liên tục)
    const lastToken = await prisma.passwordResetToken.findFirst({
      where: { user_id: user.id },
      orderBy: { created_at: 'desc' },
    });

    if (lastToken) {
      const secondsSinceLastSend = (Date.now() - new Date(lastToken.created_at).getTime()) / 1000;
      if (secondsSinceLastSend < BUSINESS_RULES.OTP_COOLDOWN_SECONDS) {
        const waitSeconds = Math.ceil(BUSINESS_RULES.OTP_COOLDOWN_SECONDS - secondsSinceLastSend);
        return error(res, `Vui lòng chờ ${waitSeconds} giây trước khi gửi lại OTP`, 429);
      }
    }

    // Tạo OTP mới
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + BUSINESS_RULES.OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        otp_code: otpCode,
        expires_at: expiresAt,
      },
    });

    await sendOtpEmail(email, otpCode, 'register');

    return success(res, null, 'Đã gửi lại mã OTP. Vui lòng kiểm tra email.');
  } catch (err) {
    console.error('Resend OTP error:', err);
    return error(res, 'Gửi lại OTP thất bại. Vui lòng thử lại.', 500);
  }
};

// ========================
// LOGIN — Đăng nhập (kiểm tra is_active)
// ========================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return error(res, 'Email hoặc mật khẩu không đúng', 401);
    }

    // Kiểm tra tài khoản đã kích hoạt chưa
    if (!user.is_active) {
      return error(res, 'Tài khoản chưa được xác thực. Vui lòng kiểm tra email để nhập mã OTP.', 403);
    }

    // So sánh password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return error(res, 'Email hoặc mật khẩu không đúng', 401);
    }

    // Tạo JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: BUSINESS_RULES.JWT_EXPIRY }
    );

    return success(res, {
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        avatar_url: user.avatar_url,
      },
    }, 'Đăng nhập thành công');
  } catch (err) {
    console.error('Login error:', err);
    return error(res, 'Đăng nhập thất bại. Vui lòng thử lại.', 500);
  }
};

// ========================
// FORGOT PASSWORD — Gửi OTP để đặt lại mật khẩu
// ========================
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Không tiết lộ email có tồn tại hay không (bảo mật)
      return success(res, null, 'Nếu email tồn tại, chúng tôi đã gửi mã OTP. Vui lòng kiểm tra hộp thư.');
    }

    if (!user.is_active) {
      return error(res, 'Tài khoản chưa được kích hoạt. Vui lòng xác thực email trước.', 403);
    }

    // Kiểm tra cooldown
    const lastToken = await prisma.passwordResetToken.findFirst({
      where: { user_id: user.id },
      orderBy: { created_at: 'desc' },
    });

    if (lastToken) {
      const secondsSinceLastSend = (Date.now() - new Date(lastToken.created_at).getTime()) / 1000;
      if (secondsSinceLastSend < BUSINESS_RULES.OTP_COOLDOWN_SECONDS) {
        return error(res, 'Vui lòng chờ trước khi yêu cầu gửi lại mã', 429);
      }
    }

    // Tạo OTP
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + BUSINESS_RULES.OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        otp_code: otpCode,
        expires_at: expiresAt,
      },
    });

    await sendOtpEmail(email, otpCode, 'reset_password');

    return success(res, null, 'Nếu email tồn tại, chúng tôi đã gửi mã OTP. Vui lòng kiểm tra hộp thư.');
  } catch (err) {
    console.error('Forgot Password error:', err);
    return error(res, 'Yêu cầu thất bại. Vui lòng thử lại.', 500);
  }
};

// ========================
// RESET PASSWORD — Đặt lại mật khẩu bằng OTP
// ========================
const resetPassword = async (req, res) => {
  try {
    const { email, otp_code, new_password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return error(res, 'Thông tin không hợp lệ', 400);
    }

    // Tìm OTP hợp lệ
    const token = await prisma.passwordResetToken.findFirst({
      where: {
        user_id: user.id,
        otp_code: otp_code,
        used_at: null,
        expires_at: { gte: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!token) {
      return error(res, 'Mã OTP không hợp lệ hoặc đã hết hạn', 400);
    }

    // Hash password mới & cập nhật
    const password_hash = await bcrypt.hash(new_password, BUSINESS_RULES.SALT_ROUNDS);

    await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { used_at: new Date() },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { password_hash },
      }),
    ]);

    return success(res, null, 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.');
  } catch (err) {
    console.error('Reset Password error:', err);
    return error(res, 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.', 500);
  }
};

// ========================
// GET ME — Xem thông tin cá nhân
// ========================
const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        phone: true,
        avatar_url: true,
        is_active: true,
        created_at: true,
      },
    });

    if (!user) {
      return error(res, 'Không tìm thấy thông tin người dùng', 404);
    }

    return success(res, user);
  } catch (err) {
    console.error('GetMe error:', err);
    return error(res, 'Lấy thông tin thất bại', 500);
  }
};

// ========================
// UPDATE PROFILE — Cập nhật hồ sơ
// ========================
const updateProfile = async (req, res) => {
  try {
    const { full_name, phone, avatar_url } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(full_name !== undefined && { full_name }),
        ...(phone !== undefined && { phone }),
        ...(avatar_url !== undefined && { avatar_url }),
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        phone: true,
        avatar_url: true,
      },
    });

    return success(res, user, 'Cập nhật hồ sơ thành công');
  } catch (err) {
    console.error('Update Profile error:', err);
    return error(res, 'Cập nhật hồ sơ thất bại', 500);
  }
};

// ========================
// CHANGE PASSWORD — Đổi mật khẩu (đã đăng nhập)
// ========================
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return error(res, 'Không tìm thấy người dùng', 404);
    }

    // Xác minh mật khẩu hiện tại
    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      return error(res, 'Mật khẩu hiện tại không đúng', 400);
    }

    // Hash và cập nhật password mới
    const password_hash = await bcrypt.hash(new_password, BUSINESS_RULES.SALT_ROUNDS);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password_hash },
    });

    return success(res, null, 'Đổi mật khẩu thành công');
  } catch (err) {
    console.error('Change Password error:', err);
    return error(res, 'Đổi mật khẩu thất bại', 500);
  }
};

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  login,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  changePassword,
};
