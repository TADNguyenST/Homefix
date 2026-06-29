// ============================================================
// HOMEFIX AI — Zod Validation Schemas
// Tất cả validation rules cho request body
// ============================================================

const { z } = require('zod');

const TEMP_EMAIL_DOMAINS = [
  'yopmail.com', '10minutemail.com', 'mailinator.com', 
  'tempmail.com', 'guerrillamail.com', 'dropmail.me', 
  'dispostable.com', 'temp-mail.org'
];

const numericInput = (schema) => z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    return normalized === '' ? undefined : Number(normalized);
  }
  return value;
}, schema);

// ========================
// AUTH
// ========================

const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ').refine(email => {
    const domain = email.split('@')[1];
    return !TEMP_EMAIL_DOMAINS.includes(domain.toLowerCase());
  }, { message: 'Hệ thống không chấp nhận địa chỉ email tạm thời' }),
  password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/, 'Mật khẩu phải từ 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt').max(100),
  confirm_password: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
  full_name: z.string().min(2, 'Họ tên tối thiểu 2 ký tự').max(100),
  phone: z.string().regex(/^(0[3-9])\d{8}$/, 'Số điện thoại không hợp lệ (VD: 0901234567)').optional(),
}).refine((data) => data.password === data.confirm_password, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirm_password"],
});

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

const verifyOtpSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  otp_code: z.string().length(6, 'Mã OTP phải đúng 6 số'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
});

const resetPasswordSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  otp_code: z.string().length(6, 'Mã OTP phải đúng 6 số'),
  new_password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/, 'Mật khẩu mới phải từ 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt').max(100),
  confirm_password: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirm_password"],
});

const updateProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^(0[3-9])\d{8}$/, 'Số điện thoại không hợp lệ').optional().nullable(),
  avatar_url: z.string().url('URL ảnh không hợp lệ').optional().nullable(),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  new_password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/, 'Mật khẩu mới phải từ 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt').max(100),
});

// ========================
// ADDRESS
// ========================

const createAddressSchema = z.object({
  district_id: z.number().int().positive('Vui lòng chọn khu vực phục vụ'),
  ward_id: z.number().int().positive('Vui lòng chọn phường/xã'),
  address_detail: z.string().min(5, 'Địa chỉ chi tiết tối thiểu 5 ký tự').max(500),
  label: z.string().max(50).optional().default('Nhà'),
  is_default: z.boolean().optional().default(false),
});

const updateAddressSchema = z.object({
  district_id: z.number().int().positive().optional(),
  ward_id: z.number().int().positive().optional(),
  address_detail: z.string().min(5).max(500).optional(),
  label: z.string().max(50).optional(),
  is_default: z.boolean().optional(),
});

// ========================
// BOOKING
// ========================

const createBookingSchema = z.object({
  service_id: z.number().int().positive('Vui lòng chọn dịch vụ'),
  device_type_id: z.number().int().positive().optional().nullable(),
  description: z.string().min(10, 'Mô tả sự cố tối thiểu 10 ký tự').max(2000),
  customer_address_id: z.number().int().positive().optional().nullable(),
  district_id: z.number().int().positive('Vui lòng chọn khu vực phục vụ'),
  ward_id: z.number().int().positive('Vui lòng chọn phường/xã'),
  address_detail: z.string().min(5, 'Địa chỉ chi tiết tối thiểu 5 ký tự').max(500),
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo format YYYY-MM-DD'),
  time_slot_start: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ bắt đầu format HH:mm'),
  time_slot_end: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ kết thúc format HH:mm'),
  payment_method: z.enum(['VNPAY', 'CASH'], { errorMap: () => ({ message: 'Phương thức: VNPAY hoặc CASH' }) }),
  voucher_code: z.string().optional().nullable(),
  ai_diagnosis: z.string().max(2000).optional().nullable(),
  image_urls: z.array(z.string().min(1).max(500)).max(3, 'Tối đa 3 ảnh cho mỗi booking').optional().default([]),
});

const rescheduleBookingSchema = z.object({
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo format YYYY-MM-DD'),
  time_slot_start: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ bắt đầu format HH:mm'),
  time_slot_end: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ kết thúc format HH:mm'),
});

const updateJobStatusSchema = z.object({
  new_status: z.enum(['INSPECTING', 'COMPLETING', 'AWAITING_PAYMENT'], {
    errorMap: () => ({ message: 'Trạng thái hợp lệ: INSPECTING, COMPLETING, AWAITING_PAYMENT' }),
  }),
  note: z.string().max(1000).optional().nullable(),
});

// ========================
// QUOTATION
// ========================

const createQuotationSchema = z.object({
  note: z.string().max(2000).optional().nullable(),
  items: z.array(z.object({
    item_name: z.string().min(1, 'Tên hạng mục không được trống').max(200),
    quantity: numericInput(z.number().int().min(1, 'Số lượng tối thiểu 1').default(1)),
    unit_price: numericInput(z.number().min(0, 'Đơn giá không được âm')),
  })).min(1, 'Phải có ít nhất 1 hạng mục báo giá'),
});

// ========================
// REVIEW
// ========================

const createReviewSchema = z.object({
  rating: z.number().int().min(1, 'Rating tối thiểu 1').max(5, 'Rating tối đa 5'),
  comment: z.string().max(2000).optional().nullable(),
});

// ========================
// COMPLAINT
// ========================

const createComplaintSchema = z.object({
  subject: z.string().min(5, 'Tiêu đề tối thiểu 5 ký tự').max(200),
  description: z.string().min(10, 'Mô tả tối thiểu 10 ký tự').max(2000),
});

const resolveComplaintSchema = z.object({
  admin_response: z.string().min(5, 'Phản hồi tối thiểu 5 ký tự').max(2000),
  status: z.enum(['RESOLVED', 'REJECTED'], { errorMap: () => ({ message: 'Status: RESOLVED hoặc REJECTED' }) }),
});

// ========================
// ADMIN — CRUD
// ========================

const createCategorySchema = z.object({
  name: z.string().min(2, 'Tên danh mục tối thiểu 2 ký tự').max(100),
  description: z.string().max(2000).optional().nullable(),
  icon_url: z.string().url().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

const createServiceSchema = z.object({
  category_id: z.number().int().positive('Vui lòng chọn danh mục'),
  name: z.string().min(2, 'Tên dịch vụ tối thiểu 2 ký tự').max(200),
  description: z.string().max(2000).optional().nullable(),
  base_price: z.number().min(1000, 'Giá tối thiểu 1,000 VND'),
  estimated_duration: z.number().int().min(15, 'Thời gian tối thiểu 15 phút'),
  image_url: z.string().url().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

const createDeviceTypeSchema = z.object({
  name: z.string().min(2, 'Tên loại thiết bị tối thiểu 2 ký tự').max(100),
  description: z.string().max(2000).optional().nullable(),
  is_active: z.boolean().optional().default(true),
  category_id: z.number().int().positive().optional().nullable(),
});

const createDistrictSchema = z.object({
  name: z.string().min(2).max(100),
  type: z.enum(['QUAN', 'HUYEN']),
});

const createWardSchema = z.object({
  name: z.string().min(2).max(100),
  type: z.enum(['PHUONG', 'XA', 'THI_TRAN']),
});

const createVoucherSchema = z.object({
  code: z.string().min(3, 'Mã voucher tối thiểu 3 ký tự').max(50).toUpperCase(),
  discount_type: z.enum(['PERCENTAGE', 'FIXED']),
  discount_value: z.number().min(1, 'Giá trị giảm phải > 0'),
  min_order_amount: z.number().min(0).optional().default(0),
  max_discount: z.number().min(0).optional().nullable(),
  usage_limit: z.number().int().min(1, 'Giới hạn sử dụng tối thiểu 1'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_active: z.boolean().optional().default(true),
}).superRefine((data, ctx) => {
  if (data.discount_type === 'PERCENTAGE' && data.discount_value > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discount_value'],
      message: 'Phần trăm giảm không được vượt quá 100%',
    });
  }
  if (new Date(data.start_date) >= new Date(data.end_date)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['end_date'],
      message: 'Ngày kết thúc phải sau ngày bắt đầu',
    });
  }
});

const createTechnicianSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  full_name: z.string().min(2).max(100),
  phone: z.string().regex(/^(0[3-9])\d{8}$/, 'Số điện thoại không hợp lệ'),
  district_id: z.number().int().positive().optional().nullable(),
  years_of_experience: z.number().int().min(0).optional().default(0),
  bio: z.string().max(2000).optional().nullable(),
});

const updateTechSkillsSchema = z.object({
  skills: z.array(z.object({
    service_id: z.number().int().positive(),
    skill_level: z.enum(['BEGINNER', 'INTERMEDIATE', 'EXPERT']),
  })),
});

const updateTechScheduleSchema = z.object({
  schedules: z.array(z.object({
    day_of_week: z.number().int().min(0).max(6), // 0=CN, 1=T2, ..., 6=T7
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    end_time: z.string().regex(/^\d{2}:\d{2}$/),
  })),
});

const assignTechSchema = z.object({
  technician_profile_id: z.number().int().positive('Vui lòng chọn kỹ thuật viên'),
});

// ========================
// AI
// ========================

const aiDiagnoseSchema = z.object({
  description: z.string().min(10, 'Mô tả sự cố tối thiểu 10 ký tự').max(2000),
  base64_image: z.string().optional().nullable(),
  booking_id: z.number().int().positive().optional().nullable(),
  image_urls: z.array(z.string().url()).optional().default([]),
});

// ========================
// Middleware: validate request body
// ========================

/**
 * Middleware factory — validate req.body bằng Zod schema
 * @param {z.ZodSchema} schema
 */
const validate = (schema) => {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors = (err.issues || err.errors || []).map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        const errorMessage = errors.map(e => e.message).join('. ');
        return res.status(400).json({
          success: false,
          message: errorMessage,
          errors,
        });
      }
      next(err);
    }
  };
};

module.exports = {
  // Auth
  registerSchema, loginSchema, verifyOtpSchema,
  forgotPasswordSchema, resetPasswordSchema,
  updateProfileSchema, changePasswordSchema,
  // Address
  createAddressSchema, updateAddressSchema,
  // Booking
  createBookingSchema, rescheduleBookingSchema, updateJobStatusSchema,
  // Quotation
  createQuotationSchema,
  // Review
  createReviewSchema,
  // Complaint
  createComplaintSchema, resolveComplaintSchema,
  // Admin CRUD
  createCategorySchema, createServiceSchema, createDeviceTypeSchema,
  createDistrictSchema, createWardSchema, createVoucherSchema,
  createTechnicianSchema, updateTechSkillsSchema, updateTechScheduleSchema,
  assignTechSchema,
  // AI
  aiDiagnoseSchema,
  // Middleware
  validate,
};
