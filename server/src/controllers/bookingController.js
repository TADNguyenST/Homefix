// ============================================================
// HOMEFIX AI — Booking Controller
// Luồng đặt lịch, xem, hủy, đổi lịch cho Customer
// ============================================================

const prisma = require('../utils/prisma');
const { success, error, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const {
  BOOKING_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  CUSTOMER_CANCELLABLE_STATUSES,
  BUSINESS_RULES,
  ROLES,
  NOTIFICATION_TYPE,
} = require('../config/constants');
const { notifyBookingCreated, notifyBookingRescheduled } = require('../services/notificationService');
const { calculateVoucherDiscount } = require('../utils/pricing');

const getTodayDateOnly = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const isValidBookingSlot = (timeSlotStart, timeSlotEnd) =>
  BUSINESS_RULES.BOOKING_TIME_SLOTS.some(
    (slot) => slot.start === timeSlotStart && slot.end === timeSlotEnd
  );

// ========================
// CREATE BOOKING — Khách hàng đặt lịch sửa chữa
// ========================
const createBooking = async (req, res) => {
  try {
    const {
      service_id,
      device_type_id,
      description,
      customer_address_id,
      district_id,
      ward_id,
      address_detail,
      booking_date,
      time_slot_start,
      time_slot_end,
      payment_method,
      voucher_code,
      ai_diagnosis,
      image_urls = [],
    } = req.body;

    const ownedImagePrefix = `/uploads/${req.user.id}-`;
    if (image_urls.some((imageUrl) => !imageUrl.startsWith(ownedImagePrefix))) {
      return error(res, 'Anh dat lich khong hop le hoac khong thuoc tai khoan cua ban', 400);
    }

    // 1. Validate service tồn tại và đang active
    const service = await prisma.service.findUnique({ where: { id: service_id } });
    if (!service || !service.is_active) {
      return error(res, 'Dịch vụ không tồn tại hoặc đã ngừng cung cấp', 400);
    }

    let resolvedDistrictId = district_id;
    let resolvedWardId = ward_id;
    let resolvedAddressDetail = address_detail;

    if (customer_address_id) {
      const savedAddress = await prisma.customerAddress.findFirst({
        where: { id: customer_address_id, customer_id: req.user.id },
      });

      if (!savedAddress) {
        return error(res, 'Địa chỉ đã chọn không tồn tại hoặc không thuộc tài khoản của bạn', 400);
      }

      resolvedDistrictId = savedAddress.district_id;
      resolvedWardId = savedAddress.ward_id;
      resolvedAddressDetail = savedAddress.address_detail;
    }

    // 2. Validate device_type nếu có
    if (device_type_id) {
      const deviceType = await prisma.deviceType.findUnique({ where: { id: device_type_id } });
      if (!deviceType || !deviceType.is_active) {
        return error(res, 'Loại thiết bị không hợp lệ', 400);
      }
      if (deviceType.category_id && deviceType.category_id !== service.category_id) {
        return error(res, 'Loại thiết bị không phù hợp với dịch vụ đã chọn', 400);
      }
    }

    // 3. Validate ward thuộc district
    const ward = await prisma.ward.findUnique({
      where: { id: resolvedWardId },
      include: { district: { select: { is_active: true } } },
    });
    if (!ward || ward.district_id !== resolvedDistrictId) {
      return error(res, 'Phường/xã không thuộc khu vực phục vụ đã chọn', 400);
    }
    if (!ward.is_active || !ward.district.is_active) {
      return error(res, 'Khu vực hoặc phường/xã này đang tạm ngừng nhận lịch', 400);
    }

    // 4. Validate ngày đặt lịch (phải trong tương lai, tối thiểu 24h)
    // Thêm timezone +07:00 (Giờ VN) để không bị lệch do múi giờ server
    const bookingDateObj = new Date(booking_date + 'T' + time_slot_start + ':00+07:00');
    const now = new Date();
    const minBookingDate = new Date(now.getTime() + BUSINESS_RULES.MIN_BOOKING_ADVANCE_HOURS * 60 * 60 * 1000);

    if (bookingDateObj < minBookingDate) {
      return error(res, `Vui lòng đặt lịch trước ít nhất ${BUSINESS_RULES.MIN_BOOKING_ADVANCE_HOURS} giờ`, 400);
    }

    // 5. Chỉ nhận các ca chuẩn để tránh giờ lẻ, chồng ca và vượt giờ phục vụ.
    if (!isValidBookingSlot(time_slot_start, time_slot_end)) {
      const validSlots = BUSINESS_RULES.BOOKING_TIME_SLOTS
        .map((slot) => `${slot.start} - ${slot.end}`)
        .join(', ');
      return error(res, `Ca làm việc không hợp lệ. Vui lòng chọn một trong các ca: ${validSlots}`, 400);
    }

    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        customer_id: req.user.id,
        booking_date: new Date(booking_date),
        status: { notIn: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED] },
        time_slot_start: { lt: time_slot_end },
        time_slot_end: { gt: time_slot_start },
      },
      select: { id: true },
    });
    if (conflictingBooking) {
      return error(res, `Bạn đã có đơn #${conflictingBooking.id} trùng ca này`, 409);
    }

    // 6. Xử lý voucher
    let voucher = null;
    let discountAmount = 0;

    if (voucher_code) {
      const normalizedVoucherCode = voucher_code.trim().toUpperCase();
      voucher = await prisma.voucher.findUnique({ where: { code: normalizedVoucherCode } });
      if (!voucher) {
        return error(res, 'Mã giảm giá không tồn tại', 400);
      }
      if (!voucher.is_active) {
        return error(res, 'Mã giảm giá đã ngừng hoạt động', 400);
      }

      const today = getTodayDateOnly();
      if (today < new Date(voucher.start_date) || today > new Date(voucher.end_date)) {
        return error(res, 'Mã giảm giá chưa đến hoặc đã hết hạn sử dụng', 400);
      }

      if (voucher.used_count >= voucher.usage_limit) {
        return error(res, 'Mã giảm giá đã hết lượt sử dụng', 400);
      }

      // Kiểm tra user đã dùng voucher này chưa
      const alreadyUsed = await prisma.voucherUsage.findFirst({
        where: { voucher_id: voucher.id, user_id: req.user.id },
      });
      if (alreadyUsed) {
        return error(res, 'Bạn đã sử dụng mã giảm giá này trước đó', 400);
      }

      // Kiểm tra min_order_amount
      const basePrice = Number(service.base_price);
      if (basePrice < Number(voucher.min_order_amount)) {
        return error(res, `Đơn hàng phải có giá trị tối thiểu ${Number(voucher.min_order_amount).toLocaleString('vi-VN')}đ để áp dụng mã`, 400);
      }

      discountAmount = calculateVoucherDiscount(voucher, basePrice);
    }

    const estimatedPrice = Math.max(0, Number(service.base_price) - discountAmount);

    // 7. Tạo booking + payment + voucher usage trong 1 transaction
    const booking = await prisma.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          customer_id: req.user.id,
          service_id,
          device_type_id: device_type_id || null,
          description,
          customer_address_id: customer_address_id || null,
          district_id: resolvedDistrictId,
          ward_id: resolvedWardId,
          address_detail: resolvedAddressDetail,
          booking_date: new Date(booking_date),
          time_slot_start,
          time_slot_end,
          status: BOOKING_STATUS.PENDING,
          estimated_price: estimatedPrice,
          payment_method,
          voucher_id: voucher?.id || null,
          discount_amount: discountAmount,
          ai_summary: ai_diagnosis || null,
        },
      });

      // Tạo payment record (trạng thái UNPAID)
      await tx.payment.create({
        data: {
          booking_id: newBooking.id,
          amount: estimatedPrice,
          method: payment_method,
          status: PAYMENT_STATUS.UNPAID,
        },
      });

      // Ghi nhận voucher usage nếu có
      if (voucher) {
        const reservation = await tx.voucher.updateMany({
          where: {
            id: voucher.id,
            is_active: true,
            used_count: { lt: voucher.usage_limit },
          },
          data: { used_count: { increment: 1 } },
        });
        if (reservation.count !== 1) {
          const unavailableError = new Error('Mã giảm giá vừa hết lượt sử dụng');
          unavailableError.code = 'VOUCHER_UNAVAILABLE';
          throw unavailableError;
        }
        await tx.voucherUsage.create({
          data: {
            voucher_id: voucher.id,
            user_id: req.user.id,
            booking_id: newBooking.id,
          },
        });
      }

      // Ghi lịch sử trạng thái
      await tx.bookingStatusHistory.create({
        data: {
          booking_id: newBooking.id,
          from_status: null,
          to_status: BOOKING_STATUS.PENDING,
          changed_by: req.user.id,
          note: 'Khách hàng đặt lịch',
        },
      });

      if (image_urls.length > 0) {
        await tx.bookingImage.createMany({
          data: image_urls.map((imageUrl) => ({
            booking_id: newBooking.id,
            image_url: imageUrl,
            uploaded_by: ROLES.CUSTOMER,
          })),
        });
      }

      return newBooking;
    });

    // 8. Gửi thông báo cho tất cả Admin
    const admins = await prisma.user.findMany({
      where: { role: ROLES.ADMIN, is_active: true },
      select: { id: true },
    });
    const adminIds = admins.map(a => a.id);
    const customer = await prisma.user.findUnique({ where: { id: req.user.id }, select: { full_name: true } });
    await notifyBookingCreated(adminIds, booking.id, customer.full_name);

    // 9. Load lại booking đầy đủ quan hệ để trả về
    const fullBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: {
        service: { select: { id: true, name: true, base_price: true } },
        district: { select: { id: true, name: true } },
        ward: { select: { id: true, name: true } },
        voucher: { select: { id: true, code: true, discount_type: true, discount_value: true } },
        images: { orderBy: { uploaded_at: 'desc' } },
        payment: { select: { id: true, amount: true, method: true, status: true } },
      },
    });

    return success(res, fullBooking, 'Đặt lịch thành công! Vui lòng chờ Admin xác nhận.', 201);
  } catch (err) {
    console.error('Create booking error:', err);
    if (err.code === 'VOUCHER_UNAVAILABLE' || err.code === 'P2002') {
      return error(res, 'Mã giảm giá đã hết lượt hoặc bạn vừa sử dụng mã này ở booking khác', 409);
    }
    return error(res, 'Đặt lịch thất bại. Vui lòng thử lại.', 500);
  }
};

// ========================
// GET MY BOOKINGS — Khách xem danh sách đơn hàng của mình
// ========================
const getMyBookings = async (req, res) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query);
    const { status } = req.query;
    const includeSummary = req.query.include_summary === 'true';

    const where = { customer_id: req.user.id };
    if (status) where.status = status;

    const activeStatuses = [
      BOOKING_STATUS.PENDING,
      BOOKING_STATUS.CONFIRMED,
      BOOKING_STATUS.ASSIGNED,
      BOOKING_STATUS.IN_PROGRESS,
      BOOKING_STATUS.INSPECTING,
      BOOKING_STATUS.QUOTED,
      BOOKING_STATUS.COMPLETING,
      BOOKING_STATUS.AWAITING_PAYMENT,
    ];

    const summaryPromise = includeSummary
      ? Promise.all([
        prisma.booking.count({
          where: { customer_id: req.user.id, status: { in: activeStatuses } },
        }),
        prisma.booking.count({
          where: { customer_id: req.user.id, status: BOOKING_STATUS.COMPLETED },
        }),
        prisma.payment.aggregate({
          where: {
            status: PAYMENT_STATUS.PAID,
            booking: {
              customer_id: req.user.id,
              status: BOOKING_STATUS.COMPLETED,
            },
          },
          _sum: { amount: true },
        }),
      ])
      : Promise.resolve(null);

    const [bookings, total, summaryData] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          service: { select: { id: true, name: true, base_price: true, image_url: true } },
          technicianProfile: {
            select: {
              id: true,
              avg_rating: true,
              user: { select: { full_name: true, phone: true, avatar_url: true } },
            },
          },
          district: { select: { name: true } },
          ward: { select: { name: true } },
          payment: { select: { status: true, method: true, amount: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
      prisma.booking.count({ where }),
      summaryPromise,
    ]);

    const metadata = summaryData
      ? {
        summary: {
          active_bookings: summaryData[0],
          completed_bookings: summaryData[1],
          total_spent: Number(summaryData[2]._sum.amount || 0),
        },
      }
      : {};

    return paginated(res, bookings, total, page, limit, metadata);
  } catch (err) {
    console.error('Get my bookings error:', err);
    return error(res, 'Không thể tải danh sách đơn hàng', 500);
  }
};

// ========================
// GET BOOKING DETAIL — Xem chi tiết 1 đơn
// ========================
const getBookingDetail = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: { select: { id: true, full_name: true, email: true, phone: true, avatar_url: true } },
        service: { select: { id: true, name: true, base_price: true, estimated_duration: true, image_url: true, category: { select: { name: true } } } },
        technicianProfile: {
          select: {
            id: true,
            avg_rating: true,
            total_completed_jobs: true,
            user: { select: { id: true, full_name: true, phone: true, avatar_url: true } },
          },
        },
        deviceType: { select: { name: true } },
        district: { select: { name: true } },
        ward: { select: { name: true } },
        voucher: { select: { code: true, discount_type: true, discount_value: true } },
        images: { orderBy: { uploaded_at: 'desc' } },
        statusHistories: { orderBy: { created_at: 'desc' } },
        quotations: {
          include: { items: true },
          orderBy: { created_at: 'desc' },
        },
        payment: true,
        review: true,
        complaints: { orderBy: { created_at: 'desc' } },
        aiAnalyses: { orderBy: { created_at: 'desc' }, take: 1 },
      },
    });

    if (!booking) {
      return error(res, 'Không tìm thấy đơn hàng', 404);
    }

    // Chỉ cho phép xem nếu là chủ đơn, thợ được gán, hoặc Admin
    const isOwner = booking.customer_id === req.user.id;
    const isAssignedTech = booking.technicianProfile?.user?.id === req.user.id;
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isOwner && !isAssignedTech && !isAdmin) {
      return error(res, 'Bạn không có quyền xem đơn này', 403);
    }

    return success(res, booking);
  } catch (err) {
    console.error('Get booking detail error:', err);
    return error(res, 'Không thể tải chi tiết đơn hàng', 500);
  }
};

// ========================
// CANCEL BOOKING — Khách hủy đơn
// ========================
const cancelBooking = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const { reason } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return error(res, 'Không tìm thấy đơn hàng', 404);
    }

    if (booking.customer_id !== req.user.id) {
      return error(res, 'Bạn không có quyền hủy đơn này', 403);
    }

    // Chỉ được hủy khi đơn ở trạng thái cho phép
    if (!CUSTOMER_CANCELLABLE_STATUSES.includes(booking.status)) {
      return error(res, `Không thể hủy đơn ở trạng thái "${booking.status}". Vui lòng liên hệ hỗ trợ.`, 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: BOOKING_STATUS.CANCELLED },
      });
      await tx.payment.updateMany({
        where: { booking_id: bookingId, status: PAYMENT_STATUS.UNPAID },
        data: { status: PAYMENT_STATUS.FAILED },
      });
      await tx.bookingStatusHistory.create({
        data: {
          booking_id: bookingId,
          from_status: booking.status,
          to_status: BOOKING_STATUS.CANCELLED,
          changed_by: req.user.id,
          note: reason || 'Khách hàng tự hủy đơn',
        },
      });

      // Refund voucher: giảm used_count nếu booking có voucher
      if (booking.voucher_id) {
        const releasedUsage = await tx.voucherUsage.deleteMany({
          where: { voucher_id: booking.voucher_id, booking_id: bookingId },
        });
        if (releasedUsage.count > 0) {
          await tx.voucher.updateMany({
            where: { id: booking.voucher_id, used_count: { gt: 0 } },
            data: { used_count: { decrement: 1 } },
          });
        }
      }
    });

    return success(res, null, 'Hủy đơn thành công');
  } catch (err) {
    console.error('Cancel booking error:', err);
    return error(res, 'Hủy đơn thất bại', 500);
  }
};

// ========================
// RESCHEDULE BOOKING — Đổi lịch hẹn
// ========================
const rescheduleBooking = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const { booking_date, time_slot_start, time_slot_end } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return error(res, 'Không tìm thấy đơn hàng', 404);
    }

    if (booking.customer_id !== req.user.id) {
      return error(res, 'Bạn không có quyền đổi lịch đơn này', 403);
    }

    // Chỉ đổi lịch khi đơn chưa có thợ đang làm
    const reschedulableStatuses = [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.ASSIGNED];
    if (!reschedulableStatuses.includes(booking.status)) {
      return error(res, 'Không thể đổi lịch khi đơn hàng đang được sửa chữa', 400);
    }

    // Validate ngày mới (thêm timezone +07:00)
    const newDate = new Date(booking_date + 'T' + time_slot_start + ':00+07:00');
    const minDate = new Date(Date.now() + BUSINESS_RULES.MIN_BOOKING_ADVANCE_HOURS * 60 * 60 * 1000);
    if (newDate < minDate) {
      return error(res, `Vui lòng đặt lịch trước ít nhất ${BUSINESS_RULES.MIN_BOOKING_ADVANCE_HOURS} giờ`, 400);
    }

    if (!isValidBookingSlot(time_slot_start, time_slot_end)) {
      const validSlots = BUSINESS_RULES.BOOKING_TIME_SLOTS
        .map((slot) => `${slot.start} - ${slot.end}`)
        .join(', ');
      return error(res, `Ca làm việc không hợp lệ. Vui lòng chọn một trong các ca: ${validSlots}`, 400);
    }

    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        id: { not: bookingId },
        customer_id: req.user.id,
        booking_date: new Date(booking_date),
        status: { notIn: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED] },
        time_slot_start: { lt: time_slot_end },
        time_slot_end: { gt: time_slot_start },
      },
      select: { id: true },
    });
    if (conflictingBooking) {
      return error(res, `Bạn đã có đơn #${conflictingBooking.id} trùng ca này`, 409);
    }

    // Nếu đơn hàng đã được gán thợ, chúng ta cần gỡ thợ ra và đưa về trạng thái chờ phân công (CONFIRMED)
    // để Admin xếp lại lịch phù hợp cho thợ khác.
    const isAssigned = booking.status === BOOKING_STATUS.ASSIGNED;
    const newStatus = isAssigned ? BOOKING_STATUS.CONFIRMED : booking.status;
    const previousTechProfileId = booking.technician_profile_id;

    await prisma.$transaction([
      prisma.booking.update({
        where: { id: bookingId },
        data: {
          booking_date: new Date(booking_date),
          time_slot_start,
          time_slot_end,
          status: newStatus,
          technician_profile_id: isAssigned ? null : previousTechProfileId,
        },
      }),
      prisma.bookingStatusHistory.create({
        data: {
          booking_id: bookingId,
          from_status: booking.status,
          to_status: newStatus,
          changed_by: req.user.id,
          note: `Đổi lịch sang ${booking_date} (${time_slot_start} - ${time_slot_end})${isAssigned ? '. Đã gỡ Kỹ thuật viên cũ.' : ''}`,
        },
      }),
    ]);

    // Gửi thông báo cho Kỹ thuật viên cũ (nếu có)
    if (isAssigned && previousTechProfileId) {
      const techProfile = await prisma.technicianProfile.findUnique({
        where: { id: previousTechProfileId },
        select: { user_id: true }
      });
      if (techProfile) {
        await notifyBookingRescheduled(techProfile.user_id, bookingId);
      }
    }

    return success(res, null, 'Đổi lịch thành công');
  } catch (err) {
    console.error('Reschedule booking error:', err);
    return error(res, 'Đổi lịch thất bại', 500);
  }
};

// ========================
// VALIDATE VOUCHER (Preview discount)
// ========================
const validateVoucher = async (req, res) => {
  try {
    const { voucher_code, service_id } = req.body;

    if (!voucher_code || !service_id) {
      return error(res, 'Thiếu thông tin mã giảm giá hoặc dịch vụ', 400);
    }

    const service = await prisma.service.findUnique({ where: { id: service_id } });
    if (!service) return error(res, 'Không tìm thấy dịch vụ', 404);

    const normalizedVoucherCode = voucher_code.trim().toUpperCase();
    const voucher = await prisma.voucher.findUnique({ where: { code: normalizedVoucherCode } });
    if (!voucher) return error(res, 'Mã giảm giá không tồn tại', 404);
    if (!voucher.is_active) return error(res, 'Mã giảm giá đã bị khóa', 400);

    const today = getTodayDateOnly();
    if (today < new Date(voucher.start_date) || today > new Date(voucher.end_date)) {
      return error(res, 'Mã giảm giá đã hết hạn hoặc chưa đến thời gian áp dụng', 400);
    }

    if (voucher.used_count >= voucher.usage_limit) {
      return error(res, 'Mã giảm giá đã hết lượt sử dụng', 400);
    }

    const alreadyUsed = await prisma.voucherUsage.findFirst({
      where: { voucher_id: voucher.id, user_id: req.user.id },
    });
    if (alreadyUsed) return error(res, 'Bạn đã sử dụng mã giảm giá này rồi', 400);

    const basePrice = Number(service.base_price);
    if (basePrice < Number(voucher.min_order_amount)) {
      return error(res, `Đơn hàng phải có giá trị tối thiểu ${Number(voucher.min_order_amount).toLocaleString('vi-VN')}đ để áp dụng mã`, 400);
    }

    const discountAmount = calculateVoucherDiscount(voucher, basePrice);

    return success(res, {
      code: voucher.code,
      discount_amount: discountAmount,
      final_price: Math.max(0, basePrice - discountAmount),
      discount_type: voucher.discount_type,
      discount_value: voucher.discount_value,
    }, 'Mã giảm giá hợp lệ');

  } catch (err) {
    console.error('Validate voucher error:', err);
    return error(res, 'Lỗi khi kiểm tra mã giảm giá', 500);
  }
};

// ========================
// GET AVAILABLE VOUCHERS — Customer xem voucher khả dụng
// ========================
const getAvailableVouchers = async (req, res) => {
  try {
    const today = getTodayDateOnly();
    const usedVoucherIds = await prisma.voucherUsage.findMany({
      where: { user_id: req.user.id },
      select: { voucher_id: true },
    });

    const vouchers = await prisma.voucher.findMany({
      where: {
        is_active: true,
        start_date: { lte: today },
        end_date: { gte: today },
        id: { notIn: usedVoucherIds.map(v => v.voucher_id) },
      },
      orderBy: [
        { end_date: 'asc' },
        { discount_value: 'desc' },
      ],
      select: {
        id: true,
        code: true,
        discount_type: true,
        discount_value: true,
        min_order_amount: true,
        max_discount: true,
        usage_limit: true,
        used_count: true,
        start_date: true,
        end_date: true,
      },
    });

    return success(res, vouchers.filter(v => v.used_count < v.usage_limit));
  } catch (err) {
    console.error('Get available vouchers error:', err);
    return error(res, 'Không thể tải danh sách voucher khả dụng', 500);
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getBookingDetail,
  cancelBooking,
  rescheduleBooking,
  validateVoucher,
  getAvailableVouchers,
};
