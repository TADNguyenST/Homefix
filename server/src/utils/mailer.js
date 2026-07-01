// ============================================================
// HOMEFIX AI — Email Sender (Nodemailer)
// ============================================================

const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Lazy-init transporter để đảm bảo env vars đã được load bởi dotenv
let _transporter = null;

const getTransporter = () => {
  if (!_transporter) {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASSWORD;

    if (!user || !pass) {
      console.error('[MAILER] ❌ EMAIL_USER hoặc EMAIL_PASSWORD chưa được cấu hình trong .env');
      console.error('[MAILER] EMAIL_USER =', user ? `"${user}"` : '(trống)');
      console.error('[MAILER] EMAIL_PASSWORD =', pass ? '***đã cấu hình***' : '(trống)');
      return null;
    }

    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });

    // console.log(`[MAILER] ✅ Transporter khởi tạo với email: ${user}`);
  }
  return _transporter;
};

/**
 * Kiểm tra kết nối SMTP — gọi khi server khởi động để phát hiện lỗi sớm
 */
const verifyMailConnection = async () => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[MAILER] ⚠️  Bỏ qua verify — transporter chưa sẵn sàng (thiếu cấu hình)');
    return false;
  }

  try {
    await transporter.verify();
    // console.log('[MAILER] ✅ Kết nối SMTP thành công — sẵn sàng gửi email');
    return true;
  } catch (err) {
    console.error('[MAILER] ❌ Kết nối SMTP thất bại:', err.message);
    console.error('[MAILER] 💡 Kiểm tra lại EMAIL_USER và EMAIL_PASSWORD trong .env');
    console.error('[MAILER] 💡 Đảm bảo đã bật 2FA trên Gmail và dùng App Password (16 ký tự)');
    return false;
  }
};

/**
 * Gửi OTP qua email
 * @param {string} to - Email người nhận
 * @param {string} otpCode - Mã OTP 6 số
 * @param {string} purpose - 'register' | 'reset_password'
 */
const sendOtpEmail = async (to, otpCode, purpose = 'register') => {
  const subjects = {
    register: 'HomeFix — Xác thực tài khoản',
    reset_password: 'HomeFix — Đặt lại mật khẩu',
  };

  const messages = {
    register: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">🔧 HomeFix</h2>
        <p>Xin chào! Mã xác thực tài khoản của bạn là:</p>
        <div style="background: #f1f5f9; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e40af;">${otpCode}</span>
        </div>
        <p style="color: #64748b; font-size: 14px;">Mã có hiệu lực trong 5 phút. Không chia sẻ mã này với ai.</p>
      </div>
    `,
    reset_password: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">🔧 HomeFix</h2>
        <p>Bạn đã yêu cầu đặt lại mật khẩu. Mã OTP của bạn:</p>
        <div style="background: #fef2f2; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #dc2626;">${otpCode}</span>
        </div>
        <p style="color: #64748b; font-size: 14px;">Mã có hiệu lực trong 5 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
      </div>
    `,
  };

  const transporter = getTransporter();

  if (!transporter) {
    console.error(`[MAILER] ❌ Không thể gửi email — transporter chưa sẵn sàng`);
    console.log(`[MAILER-FALLBACK] OTP CODE FOR ${to} IS: ${otpCode}`);
    throw new Error('Email service chưa được cấu hình. Vui lòng liên hệ admin.');
  }

  try {
    const info = await transporter.sendMail({
      from: `"HomeFix" <${process.env.EMAIL_USER}>`,
      to,
      subject: subjects[purpose] || 'HomeFix — Thông báo',
      html: messages[purpose] || `<p>Mã OTP của bạn: <b>${otpCode}</b></p>`,
    });
    console.log(`[MAILER] ✅ Đã gửi OTP đến ${to} (messageId: ${info.messageId})`);
  } catch (err) {
    console.error(`[MAILER] ❌ Lỗi gửi email đến ${to}:`, err.message);
    console.log(`[MAILER-FALLBACK] OTP CODE FOR ${to} IS: ${otpCode}`);

    // Reset transporter để lần gửi tiếp sẽ tạo lại kết nối mới
    _transporter = null;

    throw new Error('Gửi email OTP thất bại. Vui lòng thử lại sau.');
  }
};

/**
 * Tạo mã OTP ngẫu nhiên 6 chữ số (Cryptographically Secure)
 * @returns {string} OTP 6 số (VD: "482916")
 */
const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Gửi email chào mừng sau khi verify OTP thành công
 * @param {string} to - Email người nhận
 * @param {string} name - Tên người dùng
 */
const sendWelcomeEmail = async (to, name) => {
  const transporter = getTransporter();
  if (!transporter) return;

  try {
    await transporter.sendMail({
      from: `"HomeFix" <${process.env.EMAIL_USER}>`,
      to,
      subject: '🎉 Chào mừng bạn đến với HomeFix!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">🔧 HomeFix</h2>
          <p>Xin chào <b>${name || 'bạn'}</b>,</p>
          <p>Chúc mừng bạn đã xác thực tài khoản thành công tại <b>HomeFix</b> - Ứng dụng gọi thợ sửa chữa thông minh!</p>
          <p>Bây giờ bạn đã có thể trải nghiệm đầy đủ các tính năng như:</p>
          <ul style="color: #334155; line-height: 1.6;">
            <li>🤖 Chẩn đoán sự cố nhà cửa bằng AI</li>
            <li>📅 Đặt lịch sửa chữa nhanh chóng</li>
            <li>💳 Theo dõi trạng thái và thanh toán tiện lợi</li>
          </ul>
          <p style="margin-top: 30px;">Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ của chúng tôi!</p>
          <p style="color: #64748b; font-size: 14px;"><i>Đội ngũ HomeFix</i></p>
        </div>
      `,
    });
  } catch (err) {
    console.error(`[MAILER] ❌ Lỗi gửi welcome email đến ${to}:`, err.message);
  }
};

/**
 * Gửi email thông tin tài khoản cho kỹ thuật viên
 * @param {string} to - Email người nhận
 * @param {string} name - Tên thợ
 * @param {string} password - Mật khẩu mặc định
 */
const sendTechnicianAccountEmail = async (to, name, password) => {
  const transporter = getTransporter();
  if (!transporter) return;

  try {
    await transporter.sendMail({
      from: `"HomeFix" <${process.env.EMAIL_USER}>`,
      to,
      subject: '🔧 Tài khoản Kỹ thuật viên HomeFix đã được tạo',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">🔧 HomeFix - Kỹ thuật viên</h2>
          <p>Xin chào <b>${name}</b>,</p>
          <p>Tài khoản kỹ thuật viên của bạn trên hệ thống HomeFix đã được quản trị viên tạo thành công. Dưới đây là thông tin đăng nhập của bạn:</p>
          <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><b>Email đăng nhập:</b> ${to}</p>
            <p style="margin: 5px 0;"><b>Mật khẩu mặc định:</b> <span style="color: #dc2626;">${password}</span></p>
          </div>
          <p><i>Lưu ý: Bạn nên đăng nhập vào ứng dụng và thay đổi mật khẩu này ngay lập tức để bảo đảm an toàn.</i></p>
          <p style="margin-top: 30px;">Chào mừng bạn gia nhập đội ngũ HomeFix!</p>
          <p style="color: #64748b; font-size: 14px;"><i>Đội ngũ HomeFix</i></p>
        </div>
      `,
    });
    console.log(`[MAILER] ✅ Đã gửi email thông tin tài khoản thợ đến ${to}`);
  } catch (err) {
    console.error(`[MAILER] ❌ Lỗi gửi email tài khoản thợ đến ${to}:`, err.message);
  }
};

module.exports = { sendOtpEmail, generateOtp, verifyMailConnection, sendWelcomeEmail, sendTechnicianAccountEmail };
