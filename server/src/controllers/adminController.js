const bcrypt = require('bcrypt');
const prisma = require('../utils/prisma');
const { success, error, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const activeSessions = require('../utils/sessionStore');
const {
  BOOKING_STATUS,
  ADMIN_CANCELLABLE_STATUSES,
  NOTIFICATION_TYPE,
  BUSINESS_RULES,
  ROLES,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PAYMENT_SETTLEMENT_STATUS,
} = require('../config/constants');
const { sendTechnicianAccountEmail } = require('../utils/mailer');
const { loadProvinces, loadProvinceWards } = require('./administrativeController');

const summarizePaidPayments = (payments) => payments.reduce((summary, payment) => {
  const amount = Number(payment.amount || 0);
  summary.total_revenue += amount;

  if (payment.method === PAYMENT_METHOD.VNPAY) {
    summary.vnpay_received += amount;
    summary.homefix_received += amount;
  } else if (payment.method === PAYMENT_METHOD.CASH) {
    summary.cash_collected += amount;
    if (payment.settlement_status === PAYMENT_SETTLEMENT_STATUS.SETTLED) {
      summary.cash_settled += amount;
      summary.homefix_received += amount;
    } else {
      summary.cash_pending += amount;
    }
  }

  return summary;
}, {
  total_revenue: 0,
  homefix_received: 0,
  vnpay_received: 0,
  cash_collected: 0,
  cash_pending: 0,
  cash_settled: 0,
});

// ========================
// BOOKING DISPATCH
// ========================

/**
 * GET /admin/bookings
 * Lấy danh sách tất cả bookings. Filter: status, district_id, date_from, date_to, search.
 */
const getBookings = async (req, res) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query);
    const { status, district_id, date_from, date_to, search } = req.query;

    // Xây dựng điều kiện filter
    const where = {};
    if (status) where.status = status;
    if (district_id) where.district_id = parseInt(district_id);
    if (date_from || date_to) {
      where.booking_date = {};
      if (date_from) where.booking_date.gte = new Date(date_from);
      if (date_to) where.booking_date.lte = new Date(date_to);
    }
    // Tìm kiếm theo tên khách hàng
    if (search) {
      where.customer = {
        full_name: { contains: search, mode: 'insensitive' },
      };
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          customer: { select: { id: true, full_name: true, email: true, phone: true, avatar_url: true } },
          technicianProfile: {
            include: { user: { select: { id: true, full_name: true, phone: true } } },
          },
          service: { select: { id: true, name: true, base_price: true } },
          payment: true,
          district: { select: { id: true, name: true } },
          ward: { select: { id: true, name: true } },
        },
      }),
      prisma.booking.count({ where }),
    ]);

    return paginated(res, bookings, total, page, limit);
  } catch (err) {
    console.error('getBookings error:', err);
    return error(res, 'Không thể lấy danh sách đơn hàng', 500);
  }
};

/**
 * GET /admin/bookings/:id
 * Chi tiết booking với tất cả relations
 */
const getBookingDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: { select: { id: true, full_name: true, email: true, phone: true, avatar_url: true } },
        technicianProfile: {
          include: {
            user: { select: { id: true, full_name: true, phone: true, email: true } },
            skills: { include: { service: { select: { id: true, name: true } } } },
          },
        },
        service: { include: { category: { select: { id: true, name: true } } } },
        deviceType: true,
        district: true,
        ward: true,
        voucher: true,
        images: true,
        statusHistories: {
          orderBy: { created_at: 'desc' },
          include: { user: { select: { id: true, full_name: true, role: true } } },
        },
        quotations: {
          include: { items: true },
          orderBy: { created_at: 'desc' },
        },
        payment: true,
        review: true,
        complaints: { orderBy: { created_at: 'desc' } },
        aiAnalyses: { orderBy: { created_at: 'desc' } },
      },
    });

    if (!booking) return error(res, 'Không tìm thấy đơn hàng', 404);
    return success(res, booking);
  } catch (err) {
    console.error('getBookingDetail error:', err);
    return error(res, 'Không thể lấy chi tiết đơn hàng', 500);
  }
};

/**
 * PUT /admin/bookings/:id/confirm
 * Admin xác nhận booking mới trước khi phân công kỹ thuật viên.
 */
const confirmBooking = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id, 10);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: { select: { id: true } } },
    });
    if (!booking) return error(res, 'Không tìm thấy đơn hàng', 404);

    if (booking.status !== BOOKING_STATUS.PENDING) {
      return error(res, 'Chỉ có thể xác nhận đơn đang chờ xử lý', 400);
    }

    const updatedBooking = await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BOOKING_STATUS.CONFIRMED },
      });

      await tx.bookingStatusHistory.create({
        data: {
          booking_id: bookingId,
          from_status: BOOKING_STATUS.PENDING,
          to_status: BOOKING_STATUS.CONFIRMED,
          changed_by: req.user.id,
          note: 'Admin xác nhận đơn hàng',
        },
      });

      await tx.notification.create({
        data: {
          user_id: booking.customer.id,
          title: 'Đơn hàng đã được xác nhận',
          message: `Đơn #${bookingId} đã được Admin xác nhận và đang chờ phân công kỹ thuật viên.`,
          type: NOTIFICATION_TYPE.BOOKING,
          reference_id: bookingId,
        },
      });

      return updated;
    });

    return success(res, updatedBooking, 'Xác nhận đơn hàng thành công');
  } catch (err) {
    console.error('confirmBooking error:', err);
    return error(res, 'Không thể xác nhận đơn hàng', 500);
  }
};

const getConflictingTechnicianBooking = async (technicianProfileId, booking, excludeBookingId) => {
  return prisma.booking.findFirst({
    where: {
      id: { not: excludeBookingId },
      technician_profile_id: technicianProfileId,
      booking_date: booking.booking_date,
      status: {
        in: [
          BOOKING_STATUS.ASSIGNED,
          BOOKING_STATUS.IN_PROGRESS,
          BOOKING_STATUS.INSPECTING,
          BOOKING_STATUS.QUOTED,
          BOOKING_STATUS.COMPLETING,
        ],
      },
      time_slot_start: { lt: booking.time_slot_end },
      time_slot_end: { gt: booking.time_slot_start },
    },
    select: { id: true, time_slot_start: true, time_slot_end: true },
  });
};

/**
 * PUT /admin/bookings/:id/assign
 * Gán kỹ thuật viên cho booking.
 * Validate: tech tồn tại, có skill phù hợp, is_available, lịch trùng ngày/giờ.
 * Chuyển trạng thái CONFIRMED → ASSIGNED.
 */
const assignTechnician = async (req, res) => {
  try {
    const { id } = req.params;
    const { technician_profile_id } = req.body;

    // Lấy booking hiện tại
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: { service: true },
    });
    if (!booking) return error(res, 'Không tìm thấy đơn hàng', 404);

    // Chỉ cho phép assign sau khi Admin đã xác nhận đơn.
    if (booking.status !== BOOKING_STATUS.CONFIRMED) {
      return error(res, `Không thể gán thợ khi đơn ở trạng thái ${booking.status}. Hãy xác nhận đơn trước.`, 400);
    }

    // Validate kỹ thuật viên tồn tại và available
    const techProfile = await prisma.technicianProfile.findUnique({
      where: { id: technician_profile_id },
      include: {
        user: { select: { id: true, full_name: true, is_active: true, is_locked: true } },
        skills: true,
        schedules: true,
      },
    });
    if (!techProfile) return error(res, 'Kỹ thuật viên không tồn tại', 404);
    if (!techProfile.user.is_active || techProfile.user.is_locked) {
      return error(res, 'Tài khoản kỹ thuật viên chưa kích hoạt hoặc đã bị khóa', 400);
    }
    if (!techProfile.is_available) return error(res, 'Kỹ thuật viên hiện không khả dụng', 400);

    if (techProfile.district_id && techProfile.district_id !== booking.district_id) {
      return error(res, 'Kỹ thuật viên không phụ trách khu vực của đơn hàng này', 400);
    }

    // Kiểm tra skill phù hợp với service
    const hasMatchingSkill = techProfile.skills.some(
      (skill) => skill.service_id === booking.service_id
    );
    if (!hasMatchingSkill) {
      return error(res, 'Kỹ thuật viên không có kỹ năng phù hợp cho dịch vụ này', 400);
    }

    // Kiểm tra lịch làm việc: day_of_week phải trùng ngày booking
    const bookingDate = new Date(booking.booking_date);
    const dayOfWeek = bookingDate.getDay(); // 0=CN, 1=T2, ..., 6=T7
    const matchingSchedule = techProfile.schedules.find((schedule) => {
      if (schedule.day_of_week !== dayOfWeek) return false;
      // Kiểm tra giờ booking nằm trong ca làm việc
      return schedule.start_time <= booking.time_slot_start && schedule.end_time >= booking.time_slot_end;
    });
    if (!matchingSchedule) {
      return error(res, 'Kỹ thuật viên không có lịch làm việc vào ngày/giờ này', 400);
    }

    const conflictingBooking = await getConflictingTechnicianBooking(technician_profile_id, booking, parseInt(id));
    if (conflictingBooking) {
      return error(
        res,
        `Kỹ thuật viên đã có đơn #${conflictingBooking.id} trong khung ${conflictingBooking.time_slot_start} - ${conflictingBooking.time_slot_end}`,
        400
      );
    }

    // Cập nhật booking, ghi lịch sử và thông báo trong 1 transaction
    const updatedBooking = await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: parseInt(id) },
        data: {
          technician_profile_id,
          status: BOOKING_STATUS.ASSIGNED,
        },
      });

      // Ghi lịch sử trạng thái
      await tx.bookingStatusHistory.create({
        data: {
          booking_id: updated.id,
          from_status: booking.status,
          to_status: BOOKING_STATUS.ASSIGNED,
          changed_by: req.user.id,
          note: `Admin gán kỹ thuật viên ${techProfile.user.full_name}`,
        },
      });

      // Thông báo cho kỹ thuật viên
      await tx.notification.create({
        data: {
          user_id: techProfile.user.id,
          title: 'Đơn hàng mới',
          message: `Bạn được gán vào đơn hàng #${updated.id}. Vui lòng kiểm tra và xác nhận.`,
          type: NOTIFICATION_TYPE.BOOKING,
          reference_id: updated.id,
        },
      });

      return updated;
    });

    return success(res, updatedBooking, 'Gán kỹ thuật viên thành công');
  } catch (err) {
    console.error('assignTechnician error:', err);
    return error(res, 'Không thể gán kỹ thuật viên', 500);
  }
};

/**
 * PUT /admin/bookings/:id/reassign
 * Chuyển đổi kỹ thuật viên. Thông báo cả thợ cũ và thợ mới.
 */
const reassignTechnician = async (req, res) => {
  try {
    const { id } = req.params;
    const { technician_profile_id } = req.body;
    const bookingId = parseInt(id);

    // Lấy booking hiện tại kèm thông tin thợ cũ
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        technicianProfile: { include: { user: { select: { id: true, full_name: true } } } },
      },
    });
    if (!booking) return error(res, 'Không tìm thấy đơn hàng', 404);

    // Reassign chỉ dùng cho đơn đã có kỹ thuật viên.
    if (booking.status !== BOOKING_STATUS.ASSIGNED || !booking.technician_profile_id) {
      return error(res, `Không thể chuyển thợ khi đơn ở trạng thái ${booking.status}`, 400);
    }

    // Validate kỹ thuật viên mới (giống logic assign)
    const newTechProfile = await prisma.technicianProfile.findUnique({
      where: { id: technician_profile_id },
      include: {
        user: { select: { id: true, full_name: true, is_active: true, is_locked: true } },
        skills: true,
        schedules: true,
      },
    });
    if (!newTechProfile) return error(res, 'Kỹ thuật viên không tồn tại', 404);
    if (!newTechProfile.user.is_active || newTechProfile.user.is_locked) {
      return error(res, 'Tài khoản kỹ thuật viên chưa kích hoạt hoặc đã bị khóa', 400);
    }
    if (!newTechProfile.is_available) return error(res, 'Kỹ thuật viên hiện không khả dụng', 400);

    if (newTechProfile.district_id && newTechProfile.district_id !== booking.district_id) {
      return error(res, 'Kỹ thuật viên không phụ trách khu vực của đơn hàng này', 400);
    }

    const hasMatchingSkill = newTechProfile.skills.some(
      (skill) => skill.service_id === booking.service_id
    );
    if (!hasMatchingSkill) {
      return error(res, 'Kỹ thuật viên không có kỹ năng phù hợp cho dịch vụ này', 400);
    }

    const bookingDate = new Date(booking.booking_date);
    const dayOfWeek = bookingDate.getDay();
    const matchingSchedule = newTechProfile.schedules.find((schedule) => {
      if (schedule.day_of_week !== dayOfWeek) return false;
      return schedule.start_time <= booking.time_slot_start && schedule.end_time >= booking.time_slot_end;
    });
    if (!matchingSchedule) {
      return error(res, 'Kỹ thuật viên không có lịch làm việc vào ngày/giờ này', 400);
    }

    const conflictingBooking = await getConflictingTechnicianBooking(technician_profile_id, booking, bookingId);
    if (conflictingBooking) {
      return error(
        res,
        `Kỹ thuật viên đã có đơn #${conflictingBooking.id} trong khung ${conflictingBooking.time_slot_start} - ${conflictingBooking.time_slot_end}`,
        400
      );
    }

    const oldTechProfile = booking.technicianProfile;

    // Cập nhật booking trong transaction
    const updatedBooking = await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          technician_profile_id,
          status: BOOKING_STATUS.ASSIGNED,
        },
      });

      // Ghi lịch sử
      await tx.bookingStatusHistory.create({
        data: {
          booking_id: bookingId,
          from_status: booking.status,
          to_status: BOOKING_STATUS.ASSIGNED,
          changed_by: req.user.id,
          note: `Admin chuyển thợ từ ${oldTechProfile?.user?.full_name || 'N/A'} sang ${newTechProfile.user.full_name}`,
        },
      });

      // Thông báo thợ cũ (nếu có)
      if (oldTechProfile) {
        await tx.notification.create({
          data: {
            user_id: oldTechProfile.user.id,
            title: 'Bạn đã bị gỡ khỏi đơn hàng',
            message: `Bạn đã bị gỡ khỏi đơn #${bookingId}`,
            type: NOTIFICATION_TYPE.BOOKING,
            reference_id: bookingId,
          },
        });
      }

      // Thông báo thợ mới
      await tx.notification.create({
        data: {
          user_id: newTechProfile.user.id,
          title: 'Đơn hàng mới',
          message: `Bạn được gán vào đơn hàng #${bookingId}. Vui lòng kiểm tra và xác nhận.`,
          type: NOTIFICATION_TYPE.BOOKING,
          reference_id: bookingId,
        },
      });

      return updated;
    });

    return success(res, updatedBooking, 'Chuyển kỹ thuật viên thành công');
  } catch (err) {
    console.error('reassignTechnician error:', err);
    return error(res, 'Không thể chuyển kỹ thuật viên', 500);
  }
};

/**
 * PUT /admin/bookings/:id/cancel
 * Admin hủy đơn. Chặn nếu COMPLETED. Refund voucher nếu có.
 */
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const bookingId = parseInt(id);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        technicianProfile: { include: { user: { select: { id: true } } } },
        customer: { select: { id: true } },
      },
    });
    if (!booking) return error(res, 'Không tìm thấy đơn hàng', 404);

    // Kiểm tra trạng thái có thể hủy
    if (!ADMIN_CANCELLABLE_STATUSES.includes(booking.status)) {
      return error(res, `Không thể hủy đơn ở trạng thái ${booking.status}`, 400);
    }

    // Cập nhật booking → CANCELLED và thực hiện các thay đổi liên quan trong transaction
    const updatedBooking = await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BOOKING_STATUS.CANCELLED },
      });

      // Ghi lịch sử trạng thái
      await tx.bookingStatusHistory.create({
        data: {
          booking_id: bookingId,
          from_status: booking.status,
          to_status: BOOKING_STATUS.CANCELLED,
          changed_by: req.user.id,
          note: reason || 'Admin hủy đơn',
        },
      });

      // Refund voucher: giảm used_count nếu booking có voucher
      if (booking.voucher_id) {
        await tx.voucher.update({
          where: { id: booking.voucher_id },
          data: { used_count: { decrement: 1 } },
        });
        // Xóa bản ghi sử dụng voucher
        await tx.voucherUsage.deleteMany({
          where: { voucher_id: booking.voucher_id, booking_id: bookingId },
        });
      }

      // Thông báo khách hàng
      await tx.notification.create({
        data: {
          user_id: booking.customer.id,
          title: 'Đơn hàng đã bị hủy',
          message: `Đơn hàng #${bookingId} đã bị hủy bởi Admin. Lý do: ${reason || 'Không rõ'}`,
          type: NOTIFICATION_TYPE.BOOKING,
          reference_id: bookingId,
        },
      });

      // Thông báo thợ (nếu đã gán)
      if (booking.technicianProfile) {
        await tx.notification.create({
          data: {
            user_id: booking.technicianProfile.user.id,
            title: 'Đơn hàng đã bị hủy',
            message: `Đơn hàng #${bookingId} đã bị hủy. Lý do: ${reason || 'Không rõ'}`,
            type: NOTIFICATION_TYPE.BOOKING,
            reference_id: bookingId,
          },
        });
      }

      return updated;
    });

    return success(res, updatedBooking, 'Hủy đơn hàng thành công');
  } catch (err) {
    console.error('cancelBooking error:', err);
    return error(res, 'Không thể hủy đơn hàng', 500);
  }
};

// ========================
// USER MANAGEMENT
// ========================

/**
 * GET /admin/users
 * Danh sách users. Filter: role, is_active, search(name/email).
 */
const getUsers = async (req, res) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query);
    const { role, is_active, is_locked, search } = req.query;

    const where = {};
    if (role) where.role = role;
    if (is_active !== undefined) where.is_active = is_active === 'true';
    if (is_locked !== undefined) where.is_locked = is_locked === 'true';
    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        select: {
          id: true, email: true, full_name: true, role: true,
          phone: true, avatar_url: true, is_active: true, is_locked: true,
          created_at: true, updated_at: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return paginated(res, users, total, page, limit);
  } catch (err) {
    console.error('getUsers error:', err);
    return error(res, 'Không thể lấy danh sách người dùng', 500);
  }
};

/**
 * PUT /admin/users/:id/lock — Khóa tài khoản
 */
const lockUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return error(res, 'Mã tài khoản không hợp lệ', 400);
    }
    if (userId === req.user.id) {
      return error(res, 'Admin không thể tự khóa tài khoản của mình', 400);
    }

    const userToLock = await prisma.user.findUnique({ where: { id: userId } });
    if (!userToLock) return error(res, 'Không tìm thấy tài khoản', 404);
    if (userToLock.role === ROLES.ADMIN) {
      return error(res, 'Không thể khóa tài khoản Admin bằng chức năng này', 403);
    }
    if (userToLock.is_locked) {
      return error(res, 'Tài khoản đã bị khóa trước đó', 409);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { is_locked: true },
      select: { id: true, email: true, full_name: true, is_active: true, is_locked: true },
    });
    activeSessions.delete(userId);
    return success(res, user, 'Khóa tài khoản thành công');
  } catch (err) {
    console.error('lockUser error:', err);
    return error(res, 'Không thể khóa tài khoản', 500);
  }
};

/**
 * PUT /admin/users/:id/unlock — Mở khóa tài khoản
 */
const unlockUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return error(res, 'Mã tài khoản không hợp lệ', 400);
    }

    const userToUnlock = await prisma.user.findUnique({ where: { id: userId } });
    if (!userToUnlock) return error(res, 'Không tìm thấy tài khoản', 404);
    if (userToUnlock.role === ROLES.ADMIN) {
      return error(res, 'Không thể thay đổi trạng thái khóa của Admin bằng chức năng này', 403);
    }
    if (!userToUnlock.is_locked) {
      return error(res, 'Tài khoản hiện không bị khóa', 409);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { is_locked: false },
      select: { id: true, email: true, full_name: true, is_active: true, is_locked: true },
    });
    return success(res, user, 'Mở khóa tài khoản thành công');
  } catch (err) {
    console.error('unlockUser error:', err);
    return error(res, 'Không thể mở khóa tài khoản', 500);
  }
};

// ========================
// TECHNICIAN MANAGEMENT
// ========================

/**
 * GET /admin/technicians (UC-67: View Technicians)
 * Danh sách kỹ thuật viên với profile, skills, rating.
 * Filter: search (tên/email/sđt), district_id, is_available
 */
const getTechnicians = async (req, res) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query);
    const { search, district_id, is_available } = req.query;

    // [UC-67] Xây dựng điều kiện filter
    const where = {};
    if (district_id) where.district_id = parseInt(district_id);
    if (is_available !== undefined) where.is_available = is_available === 'true';
    if (search) {
      where.user = {
        OR: [
          { full_name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [technicians, total] = await Promise.all([
      prisma.technicianProfile.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              full_name: true,
              phone: true,
              avatar_url: true,
              is_active: true,
              is_locked: true,
            },
          },
          district: { select: { id: true, name: true } },
          skills: { include: { service: { select: { id: true, name: true } } } },
          schedules: true,
          _count: {
            select: {
              bookings: {
                where: { status: { notIn: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED] } },
              },
            },
          },
        },
      }),
      prisma.technicianProfile.count({ where }),
    ]);

    return paginated(res, technicians, total, page, limit);
  } catch (err) {
    console.error('getTechnicians error:', err);
    return error(res, 'Không thể lấy danh sách kỹ thuật viên', 500);
  }
};

/**
 * POST /admin/technicians
 * Tạo tài khoản kỹ thuật viên. Password mặc định: HomeFix@2026
 */
const createTechnician = async (req, res) => {
  try {
    const { email, full_name, phone, district_id, years_of_experience, bio } = req.body;

    // Kiểm tra email đã tồn tại
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return error(res, 'Email đã tồn tại trong hệ thống', 400);

    const password_hash = await bcrypt.hash(BUSINESS_RULES.DEFAULT_TECH_PASSWORD, BUSINESS_RULES.SALT_ROUNDS);

    // Tạo User + TechnicianProfile trong transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password_hash,
          full_name,
          phone,
          role: ROLES.TECHNICIAN,
        },
      });

      const profile = await tx.technicianProfile.create({
        data: {
          user_id: user.id,
          district_id: district_id || null,
          years_of_experience: years_of_experience || 0,
          bio: bio || null,
        },
      });

      return { user, profile };
    });

    // Gửi email thông báo tài khoản cho thợ (Chạy ngầm không dùng await để không block API)
    sendTechnicianAccountEmail(email, full_name, BUSINESS_RULES.DEFAULT_TECH_PASSWORD).catch(err => console.error("Lỗi gửi email thợ:", err));

    return success(res, {
      id: result.user.id,
      email: result.user.email,
      full_name: result.user.full_name,
      phone: result.user.phone,
      role: result.user.role,
      profile: result.profile,
    }, 'Tạo tài khoản kỹ thuật viên thành công', 201);
  } catch (err) {
    console.error('createTechnician error:', err);
    return error(res, 'Không thể tạo tài khoản kỹ thuật viên', 500);
  }
};

/**
 * PUT /admin/technicians/:id
 * Cập nhật profile kỹ thuật viên (years_of_experience, bio, district_id, is_available)
 */
const updateTechnician = async (req, res) => {
  try {
    const { id } = req.params;
    const { years_of_experience, bio, district_id, is_available } = req.body;

    const profile = await prisma.technicianProfile.findUnique({ where: { id: parseInt(id) } });
    if (!profile) return error(res, 'Kỹ thuật viên không tồn tại', 404);

    const updatedProfile = await prisma.technicianProfile.update({
      where: { id: parseInt(id) },
      data: {
        ...(years_of_experience !== undefined && { years_of_experience }),
        ...(bio !== undefined && { bio }),
        ...(district_id !== undefined && { district_id }),
        ...(is_available !== undefined && { is_available }),
      },
      include: {
        user: { select: { id: true, email: true, full_name: true } },
        district: { select: { id: true, name: true } },
      },
    });

    return success(res, updatedProfile, 'Cập nhật thông tin kỹ thuật viên thành công');
  } catch (err) {
    console.error('updateTechnician error:', err);
    return error(res, 'Không thể cập nhật kỹ thuật viên', 500);
  }
};

/**
 * PUT /admin/technicians/:id/deactivate
 * Đánh dấu kỹ thuật viên không khả dụng
 */
const deactivateTechnician = async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await prisma.technicianProfile.update({
      where: { id: parseInt(id) },
      data: { is_available: false },
      include: { user: { select: { id: true, full_name: true } } },
    });
    return success(res, profile, 'Kỹ thuật viên đã được đánh dấu không khả dụng');
  } catch (err) {
    console.error('deactivateTechnician error:', err);
    return error(res, 'Không thể cập nhật trạng thái kỹ thuật viên', 500);
  }
};

/**
 * PUT /admin/technicians/:id/skills
 * Thay thế toàn bộ skills. Xóa cũ, tạo mới từ body.skills
 */
const updateTechnicianSkills = async (req, res) => {
  try {
    const { id } = req.params;
    const { skills } = req.body; // [{service_id, skill_level}]
    const profileId = parseInt(id);

    const profile = await prisma.technicianProfile.findUnique({ where: { id: profileId } });
    if (!profile) return error(res, 'Kỹ thuật viên không tồn tại', 404);

    // Transaction: xóa cũ → tạo mới
    await prisma.$transaction(async (tx) => {
      await tx.technicianSkill.deleteMany({ where: { technician_profile_id: profileId } });
      if (skills && skills.length > 0) {
        await tx.technicianSkill.createMany({
          data: skills.map((s) => ({
            technician_profile_id: profileId,
            service_id: s.service_id,
            skill_level: s.skill_level,
          })),
        });
      }
    });

    // Trả về profile cập nhật kèm skills mới
    const updatedProfile = await prisma.technicianProfile.findUnique({
      where: { id: profileId },
      include: {
        user: { select: { id: true, full_name: true } },
        skills: { include: { service: { select: { id: true, name: true } } } },
      },
    });

    return success(res, updatedProfile, 'Cập nhật kỹ năng thành công');
  } catch (err) {
    console.error('updateTechnicianSkills error:', err);
    return error(res, 'Không thể cập nhật kỹ năng', 500);
  }
};

/**
 * PUT /admin/technicians/:id/schedule
 * Thay thế toàn bộ lịch làm việc.
 */
const updateTechnicianSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { schedules } = req.body; // [{day_of_week, start_time, end_time}]
    const profileId = parseInt(id);

    const profile = await prisma.technicianProfile.findUnique({ where: { id: profileId } });
    if (!profile) return error(res, 'Kỹ thuật viên không tồn tại', 404);

    // Transaction: xóa cũ → tạo mới
    await prisma.$transaction(async (tx) => {
      await tx.technicianSchedule.deleteMany({ where: { technician_profile_id: profileId } });
      if (schedules && schedules.length > 0) {
        await tx.technicianSchedule.createMany({
          data: schedules.map((s) => ({
            technician_profile_id: profileId,
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
          })),
        });
      }
    });

    const updatedProfile = await prisma.technicianProfile.findUnique({
      where: { id: profileId },
      include: {
        user: { select: { id: true, full_name: true } },
        schedules: { orderBy: { day_of_week: 'asc' } },
      },
    });

    return success(res, updatedProfile, 'Cập nhật lịch làm việc thành công');
  } catch (err) {
    console.error('updateTechnicianSchedule error:', err);
    return error(res, 'Không thể cập nhật lịch làm việc', 500);
  }
};

// ========================
// CATEGORY CRUD
// ========================

/**
 * GET /admin/categories (UC-73: View Categories)
 * Tất cả categories (bao gồm inactive), kèm số lượng service.
 * Filter: search (tên), is_active
 */
const getCategories = async (req, res) => {
  try {
    const { search, is_active, is_deleted } = req.query;

    // [UC-73] Xây dựng điều kiện filter
    const where = { is_deleted: is_deleted === 'true' };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (is_active !== undefined) where.is_active = is_active === 'true';

    const categories = await prisma.serviceCategory.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        _count: { select: { services: true, deviceTypes: true } },
      },
    });
    return success(res, categories);
  } catch (err) {
    console.error('getCategories error:', err);
    return error(res, 'Không thể lấy danh sách danh mục', 500);
  }
};

/**
 * POST /admin/categories
 * Tạo category mới. Validate tên unique.
 */
const createCategory = async (req, res) => {
  try {
    const { name, description, icon_url, is_active } = req.body;

    // Kiểm tra tên unique
    const existing = await prisma.serviceCategory.findFirst({ where: { name } });
    if (existing) return error(res, 'Tên danh mục đã tồn tại', 400);

    const category = await prisma.serviceCategory.create({
      data: { name, description, icon_url, is_active },
    });
    return success(res, category, 'Tạo danh mục thành công', 201);
  } catch (err) {
    console.error('createCategory error:', err);
    return error(res, 'Không thể tạo danh mục', 500);
  }
};

/**
 * PUT /admin/categories/:id
 */
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon_url, is_active, is_deleted } = req.body;

    // Nếu đổi tên, kiểm tra trùng
    if (name) {
      const existing = await prisma.serviceCategory.findFirst({
        where: { name, id: { not: parseInt(id) } },
      });
      if (existing) return error(res, 'Tên danh mục đã tồn tại', 400);
    }

    const category = await prisma.serviceCategory.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(icon_url !== undefined && { icon_url }),
        ...(is_active !== undefined && { is_active }),
        ...(is_deleted !== undefined && { is_deleted }),
      },
    });
    return success(res, category, 'Cập nhật danh mục thành công');
  } catch (err) {
    console.error('updateCategory error:', err);
    return error(res, 'Không thể cập nhật danh mục', 500);
  }
};

/**
 * DELETE /admin/categories/:id
 * Chặn xóa nếu category có services.
 */
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const categoryId = parseInt(id);

    // Kiểm tra có service nào thuộc category không
    const serviceCount = await prisma.service.count({ where: { category_id: categoryId } });
    if (serviceCount > 0) {
      return error(res, 'Không thể xóa danh mục có dịch vụ', 400);
    }

    await prisma.serviceCategory.update({ where: { id: categoryId }, data: { is_deleted: true } });
    return success(res, null, 'Đã chuyển danh mục vào thùng rác');
  } catch (err) {
    console.error('deleteCategory error:', err);
    return error(res, 'Không thể xóa danh mục', 500);
  }
};

// ========================
// SERVICE CRUD
// ========================

/**
 * GET /admin/services (UC-77: View Services)
 * Tất cả services (bao gồm inactive), kèm tên category. Pagination.
 * Filter: search (tên), category_id, is_active
 */
const getServices = async (req, res) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query);
    const { search, category_id, is_active, is_deleted } = req.query;

    // [UC-77] Xây dựng điều kiện filter
    const where = { is_deleted: is_deleted === 'true' };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (category_id) where.category_id = parseInt(category_id);
    if (is_active !== undefined) where.is_active = is_active === 'true';

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          category: { select: { id: true, name: true } },
        },
      }),
      prisma.service.count({ where }),
    ]);

    return paginated(res, services, total, page, limit);
  } catch (err) {
    console.error('getServices error:', err);
    return error(res, 'Không thể lấy danh sách dịch vụ', 500);
  }
};

/**
 * POST /admin/services
 */
const createService = async (req, res) => {
  try {
    const { category_id, name, description, base_price, estimated_duration, image_url, is_active } = req.body;

    const service = await prisma.service.create({
      data: { category_id, name, description, base_price, estimated_duration, image_url, is_active },
      include: { category: { select: { id: true, name: true } } },
    });
    return success(res, service, 'Tạo dịch vụ thành công', 201);
  } catch (err) {
    console.error('createService error:', err);
    return error(res, 'Không thể tạo dịch vụ', 500);
  }
};

/**
 * PUT /admin/services/:id
 */
const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, name, description, base_price, estimated_duration, image_url, is_active, is_deleted } = req.body;

    const service = await prisma.service.update({
      where: { id: parseInt(id) },
      data: {
        ...(category_id !== undefined && { category_id }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(base_price !== undefined && { base_price }),
        ...(estimated_duration !== undefined && { estimated_duration }),
        ...(image_url !== undefined && { image_url }),
        ...(is_active !== undefined && { is_active }),
        ...(is_deleted !== undefined && { is_deleted }),
      },
      include: { category: { select: { id: true, name: true } } },
    });
    return success(res, service, 'Cập nhật dịch vụ thành công');
  } catch (err) {
    console.error('updateService error:', err);
    return error(res, 'Không thể cập nhật dịch vụ', 500);
  }
};

/**
 * DELETE /admin/services/:id
 * Soft delete: ẩn dịch vụ để giữ nguyên lịch sử booking và báo cáo.
 */
const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const serviceId = parseInt(id);

    // Kiểm tra có booking đang hoạt động (không phải COMPLETED/CANCELLED)
    const activeBookingCount = await prisma.booking.count({
      where: {
        service_id: serviceId,
        status: { notIn: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED] },
      },
    });
    if (activeBookingCount > 0) {
      return error(res, 'Không thể xóa dịch vụ đang có đơn hàng hoạt động', 400);
    }

    const service = await prisma.service.update({
      where: { id: serviceId },
      data: { is_deleted: true },
    });

    return success(res, service, 'Đã chuyển dịch vụ vào thùng rác');
  } catch (err) {
    console.error('deleteService error:', err);
    return error(res, 'Không thể xóa dịch vụ', 500);
  }
};

// ========================
// DEVICE TYPE CRUD
// ========================

/**
 * GET /admin/device-types (UC-81: View Device Types)
 * Filter: search (tên), category_id
 */
const getDeviceTypes = async (req, res) => {
  try {
    const { search, category_id, is_deleted } = req.query;

    // [UC-81] Xây dựng điều kiện filter
    const where = { is_deleted: is_deleted === 'true' };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (category_id) where.category_id = parseInt(category_id);

    const deviceTypes = await prisma.deviceType.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        category: { select: { id: true, name: true } },
      },
    });
    return success(res, deviceTypes);
  } catch (err) {
    console.error('getDeviceTypes error:', err);
    return error(res, 'Không thể lấy danh sách loại thiết bị', 500);
  }
};

/**
 * POST /admin/device-types
 */
const createDeviceType = async (req, res) => {
  try {
    const { name, description, is_active, category_id } = req.body;
    const deviceType = await prisma.deviceType.create({
      data: { name, description, is_active, category_id: category_id || null },
      include: { category: { select: { id: true, name: true } } },
    });
    return success(res, deviceType, 'Tạo loại thiết bị thành công', 201);
  } catch (err) {
    console.error('createDeviceType error:', err);
    return error(res, 'Không thể tạo loại thiết bị', 500);
  }
};

/**
 * PUT /admin/device-types/:id
 */
const updateDeviceType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_active, category_id, is_deleted } = req.body;
    const deviceType = await prisma.deviceType.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(is_active !== undefined && { is_active }),
        ...(category_id !== undefined && { category_id: category_id || null }),
        ...(is_deleted !== undefined && { is_deleted }),
      },
      include: { category: { select: { id: true, name: true } } },
    });
    return success(res, deviceType, 'Cập nhật loại thiết bị thành công');
  } catch (err) {
    console.error('updateDeviceType error:', err);
    return error(res, 'Không thể cập nhật loại thiết bị', 500);
  }
};

/**
 * DELETE /admin/device-types/:id
 * Chặn nếu có booking liên kết.
 */
const deleteDeviceType = async (req, res) => {
  try {
    const { id } = req.params;
    const deviceTypeId = parseInt(id);

    const bookingCount = await prisma.booking.count({ where: { device_type_id: deviceTypeId } });
    if (bookingCount > 0) {
      return error(res, 'Không thể xóa loại thiết bị đang được sử dụng trong đơn hàng', 400);
    }

    await prisma.deviceType.update({ where: { id: deviceTypeId }, data: { is_deleted: true } });
    return success(res, null, 'Đã chuyển loại thiết bị vào thùng rác');
  } catch (err) {
    console.error('deleteDeviceType error:', err);
    return error(res, 'Không thể xóa loại thiết bị', 500);
  }
};

// ========================
// DISTRICT & WARD
// ========================

/**
 * GET /admin/districts (UC-85: View Districts & Wards)
 * Tất cả districts với ward count và danh sách wards.
 * Filter: search (tên), type
 */
const getDistricts = async (req, res) => {
  try {
    const { search, is_active, province_code } = req.query;

    // [UC-85] Xây dựng điều kiện filter
    const where = {};
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (is_active !== undefined) where.is_active = is_active === 'true';
    if (province_code) where.province_code = parseInt(province_code, 10);

    const districts = await prisma.district.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        wards: { orderBy: { name: 'asc' } },
        _count: { select: { wards: true } },
      },
    });
    return success(res, districts);
  } catch (err) {
    console.error('getDistricts error:', err);
    return error(res, 'Không thể lấy danh sách khu vực phục vụ', 500);
  }
};

/**
 * POST /admin/districts
 */
const createDistrict = async (req, res) => {
  try {
    const { province_code, is_active, wards = [] } = req.body;
    const provinces = await loadProvinces();
    const province = provinces.find((item) => item.code === province_code);
    if (!province) return error(res, 'Tỉnh/thành không tồn tại trong API hành chính', 400);

    const existingProvince = await prisma.district.findFirst({ where: { province_code } });
    if (existingProvince) return error(res, 'Tỉnh/thành này đã được thêm vào khu vực phục vụ', 409);

    const apiWards = await loadProvinceWards(province_code);
    const apiWardByCode = new Map(apiWards.map((ward) => [ward.code, ward]));
    const wardCodes = wards.map((ward) => ward.external_code);
    if (new Set(wardCodes).size !== wardCodes.length) {
      return error(res, 'Danh sách phường/xã có mã hành chính bị trùng', 400);
    }
    if (wardCodes.some((code) => !apiWardByCode.has(code))) {
      return error(res, 'Danh sách có phường/xã không thuộc tỉnh/thành đã chọn', 400);
    }

    const district = await prisma.district.create({
      data: {
        name: province.name.replace(/^(Tỉnh|Thành phố)\s+/i, ''),
        province_code,
        province_name: province.name,
        is_active,
        wards: {
          create: wardCodes.map((code) => {
            const ward = apiWardByCode.get(code);
            return {
              external_code: ward.code,
              name: ward.name,
              type: ward.type,
              is_active,
            };
          }),
        },
      },
      include: { wards: true },
    });
    return success(res, district, 'Tạo khu vực phục vụ thành công', 201);
  } catch (err) {
    console.error('createDistrict error:', err);
    if (err.code === 'P2002') return error(res, 'Tên khu vực hoặc phường/xã đã tồn tại', 409);
    return error(res, 'Không thể tạo khu vực phục vụ', 500);
  }
};

/**
 * PUT /admin/districts/:id
 */
const updateDistrict = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.district.findUnique({ where: { id } });
    if (!existing) return error(res, 'Khu vực phục vụ không tồn tại', 404);

    const district = await prisma.$transaction(async (tx) => {
      const updated = await tx.district.update({
        where: { id },
        data: { is_active: req.body.is_active },
      });

      if (req.body.is_active === false) {
        await tx.ward.updateMany({ where: { district_id: id }, data: { is_active: false } });
      }
      return updated;
    });
    return success(res, district, 'Cập nhật khu vực phục vụ thành công');
  } catch (err) {
    console.error('updateDistrict error:', err);
    if (err.code === 'P2002') return error(res, 'Tên khu vực phục vụ đã tồn tại', 409);
    return error(res, 'Không thể cập nhật khu vực phục vụ', 500);
  }
};

/**
 * PUT /admin/districts/:id/toggle
 */
const toggleDistrict = async (req, res) => {
  try {
    const { id } = req.params;
    const district = await prisma.district.findUnique({ where: { id: parseInt(id) } });
    if (!district) return error(res, 'Khu vực phục vụ không tồn tại', 404);

    const updated = await prisma.district.update({
      where: { id: parseInt(id) },
      data: { is_active: !district.is_active },
    });
    return success(res, updated, `Khu vực phục vụ đã được ${updated.is_active ? 'kích hoạt' : 'vô hiệu hóa'}`);
  } catch (err) {
    console.error('toggleDistrict error:', err);
    return error(res, 'Không thể thay đổi trạng thái khu vực phục vụ', 500);
  }
};

/**
 * POST /admin/districts/:districtId/wards
 */
const createWard = async (req, res) => {
  try {
    const { districtId } = req.params;
    const { external_code } = req.body;

    // Kiểm tra district tồn tại
    const district = await prisma.district.findUnique({ where: { id: parseInt(districtId) } });
    if (!district) return error(res, 'Khu vực phục vụ không tồn tại', 404);
    if (!district.province_code) return error(res, 'Khu vực chưa có mã tỉnh/thành từ API', 400);

    const apiWards = await loadProvinceWards(district.province_code);
    const selectedWard = apiWards.find((ward) => ward.code === external_code);
    if (!selectedWard) return error(res, 'Phường/xã không thuộc tỉnh/thành của khu vực này', 400);

    const existing = await prisma.ward.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, district_id: parseInt(districtId) } });
    if (existing) return error(res, 'Tên phường/xã đã tồn tại trong khu vực này', 400);

    const ward = await prisma.ward.create({
      data: {
        district_id: parseInt(districtId),
        external_code: selectedWard.code,
        name: selectedWard.name,
        type: selectedWard.type,
        is_active: district.is_active,
      },
    });
    return success(res, ward, 'Tạo phường/xã thành công', 201);
  } catch (err) {
    console.error('createWard error:', err);
    if (err.code === 'P2002') return error(res, 'Phường/xã đã tồn tại hoặc đã thuộc khu vực khác', 409);
    return error(res, 'Không thể tạo phường/xã', 500);
  }
};

/**
 * PUT /admin/wards/:id
 */
const updateWard = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { is_active } = req.body;
    const existing = await prisma.ward.findUnique({
      where: { id },
      include: { district: { select: { is_active: true } } },
    });
    if (!existing) return error(res, 'Phường/xã không tồn tại', 404);
    if (is_active === true && !existing.district.is_active) {
      return error(res, 'Không thể kích hoạt phường/xã khi khu vực phục vụ đang tắt', 400);
    }
    const ward = await prisma.ward.update({
      where: { id },
      data: { is_active },
    });
    return success(res, ward, 'Cập nhật phường/xã thành công');
  } catch (err) {
    console.error('updateWard error:', err);
    if (err.code === 'P2002') return error(res, 'Phường/xã đã tồn tại hoặc đã thuộc khu vực khác', 409);
    return error(res, 'Không thể cập nhật phường/xã', 500);
  }
};

/**
 * PUT /admin/wards/:id/toggle
 */
const toggleWard = async (req, res) => {
  try {
    const { id } = req.params;
    const ward = await prisma.ward.findUnique({ where: { id: parseInt(id) } });
    if (!ward) return error(res, 'Phường/xã không tồn tại', 404);

    const updated = await prisma.ward.update({
      where: { id: parseInt(id) },
      data: { is_active: !ward.is_active },
    });
    return success(res, updated, `Phường/xã đã được ${updated.is_active ? 'kích hoạt' : 'vô hiệu hóa'}`);
  } catch (err) {
    console.error('toggleWard error:', err);
    return error(res, 'Không thể thay đổi trạng thái phường/xã', 500);
  }
};

/**
 * DELETE /admin/districts/:id
 * Chặn xóa nếu khu vực đã có phường/xã hoặc dữ liệu nghiệp vụ liên quan.
 */
const deleteDistrict = async (req, res) => {
  try {
    const districtId = parseInt(req.params.id);

    const [wardCount, bookingCount, addressCount, technicianCount] = await Promise.all([
      prisma.ward.count({ where: { district_id: districtId } }),
      prisma.booking.count({ where: { district_id: districtId } }),
      prisma.customerAddress.count({ where: { district_id: districtId } }),
      prisma.technicianProfile.count({ where: { district_id: districtId } }),
    ]);

    if (wardCount > 0 || bookingCount > 0 || addressCount > 0 || technicianCount > 0) {
      return error(res, 'Không thể xóa tỉnh/thành đang có phường/xã, địa chỉ, đơn hàng hoặc kỹ thuật viên liên quan', 400);
    }

    await prisma.district.delete({ where: { id: districtId } });
    return success(res, null, 'Xóa khu vực phục vụ thành công');
  } catch (err) {
    console.error('deleteDistrict error:', err);
    return error(res, 'Không thể xóa khu vực phục vụ', 500);
  }
};

/**
 * DELETE /admin/wards/:id
 * Chặn xóa nếu phường/xã đã phát sinh địa chỉ hoặc đơn hàng.
 */
const deleteWard = async (req, res) => {
  try {
    const wardId = parseInt(req.params.id);

    const [bookingCount, addressCount] = await Promise.all([
      prisma.booking.count({ where: { ward_id: wardId } }),
      prisma.customerAddress.count({ where: { ward_id: wardId } }),
    ]);

    if (bookingCount > 0 || addressCount > 0) {
      return error(res, 'Không thể xóa phường/xã đang có địa chỉ hoặc đơn hàng liên quan', 400);
    }

    await prisma.ward.delete({ where: { id: wardId } });
    return success(res, null, 'Xóa phường/xã thành công');
  } catch (err) {
    console.error('deleteWard error:', err);
    return error(res, 'Không thể xóa phường/xã', 500);
  }
};

// ========================
// VOUCHER CRUD
// ========================

/**
 * GET /admin/vouchers
 * Tất cả vouchers, kèm usage stats.
 */
const getVouchers = async (req, res) => {
  try {
    const vouchers = await prisma.voucher.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        _count: { select: { usages: true } },
      },
    });
    return success(res, vouchers);
  } catch (err) {
    console.error('getVouchers error:', err);
    return error(res, 'Không thể lấy danh sách voucher', 500);
  }
};

/**
 * POST /admin/vouchers
 * Validate code unique, start_date < end_date.
 */
const createVoucher = async (req, res) => {
  try {
    const {
      code, discount_type, discount_value, min_order_amount,
      max_discount, usage_limit, start_date, end_date, is_active,
    } = req.body;

    // Validate code unique
    const existing = await prisma.voucher.findUnique({ where: { code } });
    if (existing) return error(res, 'Mã voucher đã tồn tại', 400);

    // Validate start_date < end_date
    if (new Date(start_date) >= new Date(end_date)) {
      return error(res, 'Ngày bắt đầu phải trước ngày kết thúc', 400);
    }

    const voucher = await prisma.voucher.create({
      data: {
        code,
        discount_type,
        discount_value,
        min_order_amount: min_order_amount || 0,
        max_discount,
        usage_limit,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        is_active: is_active !== undefined ? is_active : true,
      },
    });
    return success(res, voucher, 'Tạo voucher thành công', 201);
  } catch (err) {
    console.error('createVoucher error:', err);
    return error(res, 'Không thể tạo voucher', 500);
  }
};

/**
 * PUT /admin/vouchers/:id
 */
const updateVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code, discount_type, discount_value, min_order_amount,
      max_discount, usage_limit, start_date, end_date, is_active,
    } = req.body;

    // Nếu đổi code, kiểm tra trùng
    if (code) {
      const existing = await prisma.voucher.findFirst({
        where: { code, id: { not: parseInt(id) } },
      });
      if (existing) return error(res, 'Mã voucher đã tồn tại', 400);
    }

    const voucher = await prisma.voucher.update({
      where: { id: parseInt(id) },
      data: {
        ...(code !== undefined && { code }),
        ...(discount_type !== undefined && { discount_type }),
        ...(discount_value !== undefined && { discount_value }),
        ...(min_order_amount !== undefined && { min_order_amount }),
        ...(max_discount !== undefined && { max_discount }),
        ...(usage_limit !== undefined && { usage_limit }),
        ...(start_date !== undefined && { start_date: new Date(start_date) }),
        ...(end_date !== undefined && { end_date: new Date(end_date) }),
        ...(is_active !== undefined && { is_active }),
      },
    });
    return success(res, voucher, 'Cập nhật voucher thành công');
  } catch (err) {
    console.error('updateVoucher error:', err);
    return error(res, 'Không thể cập nhật voucher', 500);
  }
};

/**
 * PUT /admin/vouchers/:id/toggle
 * Bật/tắt trạng thái is_active
 */
const toggleVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const voucher = await prisma.voucher.findUnique({ where: { id: parseInt(id) } });
    if (!voucher) return error(res, 'Voucher không tồn tại', 404);

    const updated = await prisma.voucher.update({
      where: { id: parseInt(id) },
      data: { is_active: !voucher.is_active },
    });
    return success(res, updated, `Voucher đã được ${updated.is_active ? 'kích hoạt' : 'vô hiệu hóa'}`);
  } catch (err) {
    console.error('toggleVoucher error:', err);
    return error(res, 'Không thể thay đổi trạng thái voucher', 500);
  }
};

// ========================
// PAYMENT & COMPLAINT
// ========================

/**
 * GET /admin/payments
 * Tất cả payments. Filter: method, status, date range.
 */
const getPayments = async (req, res) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query);
    const { method, status: paymentStatus, settlement_status, date_from, date_to } = req.query;

    if (method && !Object.values(PAYMENT_METHOD).includes(method)) {
      return error(res, 'Phương thức thanh toán không hợp lệ', 400);
    }
    if (paymentStatus && !Object.values(PAYMENT_STATUS).includes(paymentStatus)) {
      return error(res, 'Trạng thái thanh toán không hợp lệ', 400);
    }
    if (settlement_status && !Object.values(PAYMENT_SETTLEMENT_STATUS).includes(settlement_status)) {
      return error(res, 'Trạng thái đối soát không hợp lệ', 400);
    }

    const where = {};
    if (method) where.method = method;
    if (paymentStatus) where.status = paymentStatus;
    if (settlement_status) where.settlement_status = settlement_status;
    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) where.created_at.gte = new Date(date_from);
      if (date_to) where.created_at.lte = new Date(date_to);
    }

    const [payments, total, paidPayments] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          booking: {
            select: {
              id: true, status: true, booking_date: true,
              customer: { select: { id: true, full_name: true, email: true, phone: true } },
              service: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where: { status: PAYMENT_STATUS.PAID },
        select: { amount: true, method: true, settlement_status: true },
      }),
    ]);

    return paginated(res, payments, total, page, limit, {
      summary: summarizePaidPayments(paidPayments),
    });
  } catch (err) {
    console.error('getPayments error:', err);
    return error(res, 'Không thể lấy danh sách thanh toán', 500);
  }
};

/**
 * PUT /admin/payments/:id/confirm-cash-settlement
 * Admin xác nhận đã nhận đủ khoản tiền mặt mà kỹ thuật viên thu hộ.
 */
const confirmCashSettlement = async (req, res) => {
  try {
    const paymentId = parseInt(req.params.id, 10);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return error(res, 'Mã giao dịch không hợp lệ', 400);
    }

    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (note.length > 500) {
      return error(res, 'Ghi chú đối soát không được vượt quá 500 ký tự', 400);
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          select: {
            id: true,
            technicianProfile: { select: { user_id: true } },
          },
        },
      },
    });

    if (!payment) return error(res, 'Không tìm thấy giao dịch', 404);
    if (payment.method !== PAYMENT_METHOD.CASH) {
      return error(res, 'Chỉ đối soát bàn giao đối với thanh toán tiền mặt', 400);
    }
    if (payment.status !== PAYMENT_STATUS.PAID) {
      return error(res, 'Khách hàng chưa thanh toán nên chưa thể đối soát', 400);
    }
    if (payment.settlement_status === PAYMENT_SETTLEMENT_STATUS.SETTLED) {
      return error(res, 'Khoản tiền mặt này đã được đối soát trước đó', 409);
    }
    if (payment.settlement_status !== PAYMENT_SETTLEMENT_STATUS.PENDING) {
      return error(res, 'Khoản tiền mặt chưa ở trạng thái chờ bàn giao', 400);
    }

    const settledAt = new Date();
    const updateResult = await prisma.payment.updateMany({
      where: {
        id: paymentId,
        method: PAYMENT_METHOD.CASH,
        status: PAYMENT_STATUS.PAID,
        settlement_status: PAYMENT_SETTLEMENT_STATUS.PENDING,
      },
      data: {
        settlement_status: PAYMENT_SETTLEMENT_STATUS.SETTLED,
        settled_at: settledAt,
        settled_by: req.user.id,
        settlement_note: note || 'Admin xác nhận đã nhận đủ tiền mặt từ kỹ thuật viên',
      },
    });

    if (updateResult.count !== 1) {
      return error(res, 'Giao dịch vừa được đối soát bởi một Admin khác', 409);
    }

    const technicianUserId = payment.booking?.technicianProfile?.user_id;
    if (technicianUserId) {
      try {
        await prisma.notification.create({
          data: {
            user_id: technicianUserId,
            title: 'Đã đối soát tiền mặt',
            message: `HomeFix đã xác nhận nhận đủ ${Number(payment.amount).toLocaleString('vi-VN')}đ của đơn #${payment.booking_id}.`,
            type: NOTIFICATION_TYPE.PAYMENT,
            reference_id: payment.booking_id,
          },
        });
      } catch (notificationError) {
        console.error('Cash settlement notification error:', notificationError);
      }
    }

    const updatedPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        confirmer: { select: { id: true, full_name: true } },
        settler: { select: { id: true, full_name: true } },
      },
    });

    return success(res, updatedPayment, 'Xác nhận bàn giao tiền mặt thành công');
  } catch (err) {
    console.error('confirmCashSettlement error:', err);
    return error(res, 'Không thể xác nhận bàn giao tiền mặt', 500);
  }
};

const getTechnicianWallets = async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: {
        method: PAYMENT_METHOD.CASH,
        status: PAYMENT_STATUS.PAID,
        booking: { technician_profile_id: { not: null } },
      },
      include: {
        booking: {
          select: {
            booking_date: true,
            customer: { select: { full_name: true, phone: true } },
            service: { select: { name: true } },
            technicianProfile: {
              select: {
                id: true,
                user: {
                  select: {
                    id: true,
                    full_name: true,
                    phone: true,
                    email: true,
                    avatar_url: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ paid_at: 'desc' }, { id: 'desc' }],
    });

    const walletsByTechnician = new Map();

    payments.forEach((payment) => {
      const profile = payment.booking.technicianProfile;
      if (!profile) return;

      if (!walletsByTechnician.has(profile.id)) {
        walletsByTechnician.set(profile.id, {
          id: profile.id,
          user_id: profile.user.id,
          full_name: profile.user.full_name,
          phone: profile.user.phone,
          email: profile.user.email,
          avatar_url: profile.user.avatar_url,
          total_collected: 0,
          total_settled: 0,
          total_pending: 0,
          payments: [],
        });
      }

      const wallet = walletsByTechnician.get(profile.id);
      const amount = Number(payment.amount);
      wallet.total_collected += amount;
      if (payment.settlement_status === PAYMENT_SETTLEMENT_STATUS.SETTLED) {
        wallet.total_settled += amount;
      }
      if (payment.settlement_status === PAYMENT_SETTLEMENT_STATUS.PENDING) {
        wallet.total_pending += amount;
      }
      wallet.payments.push({
        id: payment.id,
        booking_id: payment.booking_id,
        service_name: payment.booking.service.name,
        customer_name: payment.booking.customer.full_name,
        customer_phone: payment.booking.customer.phone,
        booking_date: payment.booking.booking_date,
        amount,
        paid_at: payment.paid_at,
        settlement_status: payment.settlement_status,
        settlement_note: payment.settlement_note,
      });
    });

    const wallets = Array.from(walletsByTechnician.values()).sort((left, right) => (
      right.total_pending - left.total_pending
      || left.full_name.localeCompare(right.full_name, 'vi')
    ));

    return success(res, wallets);
  } catch (err) {
    console.error('getTechnicianWallets error:', err);
    return error(res, 'Khong the tai danh sach vi tien mat cua ky thuat vien', 500);
  }
};

const confirmCashSettlementBatch = async (req, res) => {
  try {
    const rawPaymentIds = Array.isArray(req.body?.paymentIds) ? req.body.paymentIds : [];
    const paymentIds = [...new Set(rawPaymentIds.map((id) => Number(id)))];
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

    if (
      paymentIds.length === 0
      || paymentIds.length > 100
      || paymentIds.some((id) => !Number.isInteger(id) || id <= 0)
    ) {
      return error(res, 'Danh sach giao dich khong hop le (toi da 100 giao dich)', 400);
    }
    if (note.length > 500) {
      return error(res, 'Ghi chu doi soat khong duoc vuot qua 500 ky tu', 400);
    }

    const payments = await prisma.payment.findMany({
      where: { id: { in: paymentIds } },
      include: {
        booking: {
          select: {
            id: true,
            technician_profile_id: true,
            technicianProfile: { select: { user_id: true } },
          },
        },
      },
    });

    if (payments.length !== paymentIds.length) {
      return error(res, 'Co giao dich khong ton tai', 404);
    }
    if (payments.some((payment) => (
      payment.method !== PAYMENT_METHOD.CASH
      || payment.status !== PAYMENT_STATUS.PAID
      || payment.settlement_status !== PAYMENT_SETTLEMENT_STATUS.PENDING
    ))) {
      return error(res, 'Chi duoc doi soat tien mat da thu va dang cho ban giao', 409);
    }

    const technicianProfileIds = new Set(
      payments.map((payment) => payment.booking.technician_profile_id).filter(Boolean),
    );
    if (technicianProfileIds.size !== 1 || payments.some((payment) => !payment.booking.technician_profile_id)) {
      return error(res, 'Moi lan doi soat chi duoc chon giao dich cua mot ky thuat vien', 400);
    }

    const settledAt = new Date();
    const settlementNote = note || `Admin xac nhan da nhan du tien mat cua ${paymentIds.length} giao dich`;
    await prisma.$transaction(async (tx) => {
      const updateResult = await tx.payment.updateMany({
        where: {
          id: { in: paymentIds },
          method: PAYMENT_METHOD.CASH,
          status: PAYMENT_STATUS.PAID,
          settlement_status: PAYMENT_SETTLEMENT_STATUS.PENDING,
        },
        data: {
          settlement_status: PAYMENT_SETTLEMENT_STATUS.SETTLED,
          settled_at: settledAt,
          settled_by: req.user.id,
          settlement_note: settlementNote,
        },
      });

      if (updateResult.count !== paymentIds.length) {
        const conflict = new Error('CASH_SETTLEMENT_CONFLICT');
        conflict.code = 'CASH_SETTLEMENT_CONFLICT';
        throw conflict;
      }
    });

    const totalAmount = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const technicianUserId = payments[0].booking.technicianProfile?.user_id;
    if (technicianUserId) {
      try {
        await prisma.notification.create({
          data: {
            user_id: technicianUserId,
            title: 'Da doi soat tien mat',
            message: `HomeFix da xac nhan nhan du ${totalAmount.toLocaleString('vi-VN')}d cua ${paymentIds.length} giao dich.`,
            type: NOTIFICATION_TYPE.PAYMENT,
          },
        });
      } catch (notificationError) {
        console.error('Cash settlement batch notification error:', notificationError);
      }
    }

    return success(res, {
      payment_ids: paymentIds,
      payment_count: paymentIds.length,
      total_amount: totalAmount,
      settled_at: settledAt,
    }, 'Xac nhan doi soat lo tien mat thanh cong');
  } catch (err) {
    if (err.code === 'CASH_SETTLEMENT_CONFLICT') {
      return error(res, 'Mot hoac nhieu giao dich vua duoc Admin khac doi soat', 409);
    }
    console.error('confirmCashSettlementBatch error:', err);
    return error(res, 'Khong the xac nhan doi soat lo tien mat', 500);
  }
};

/**
 * GET /admin/complaints
 * Tất cả complaints. Filter: status.
 */
const getComplaints = async (req, res) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query);
    const { status: complaintStatus } = req.query;

    const where = {};
    if (complaintStatus) where.status = complaintStatus;

    const [complaints, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          customer: { select: { id: true, full_name: true, email: true, phone: true } },
          booking: {
            select: {
              id: true, status: true, booking_date: true,
              service: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.complaint.count({ where }),
    ]);

    return paginated(res, complaints, total, page, limit);
  } catch (err) {
    console.error('getComplaints error:', err);
    return error(res, 'Không thể lấy danh sách khiếu nại', 500);
  }
};

/**
 * PUT /admin/complaints/:id/resolve
 * Xử lý khiếu nại: cập nhật status và admin_response. Thông báo khách hàng.
 */
const resolveComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { status: newStatus, admin_response } = req.body;

    const complaint = await prisma.complaint.findUnique({
      where: { id: parseInt(id) },
      include: { customer: { select: { id: true } } },
    });
    if (!complaint) return error(res, 'Khiếu nại không tồn tại', 404);

    const updated = await prisma.complaint.update({
      where: { id: parseInt(id) },
      data: {
        status: newStatus,
        admin_response,
        resolved_at: new Date(),
      },
    });

    // Thông báo cho khách hàng
    await prisma.notification.create({
      data: {
        user_id: complaint.customer.id,
        title: 'Khiếu nại đã được xử lý',
        message: `Khiếu nại #${complaint.id} đã được ${newStatus === 'RESOLVED' ? 'giải quyết' : 'từ chối'}. Phản hồi: ${admin_response}`,
        type: NOTIFICATION_TYPE.COMPLAINT,
        reference_id: complaint.id,
      },
    });

    return success(res, updated, 'Xử lý khiếu nại thành công');
  } catch (err) {
    console.error('resolveComplaint error:', err);
    return error(res, 'Không thể xử lý khiếu nại', 500);
  }
};

// ========================
// DASHBOARD (UC-89: View Statistical Reports)
// ========================

/**
 * GET /admin/dashboard
 * Trả về các thống kê tổng hợp cho UC-89.
 * Bổ sung: totalCustomers, totalTechnicians, complaintStats,
 *          bookingTrend (30 ngày), revenueByDistrict
 */
const getDashboard = async (req, res) => {
  try {
    // === [UC-89] Thống kê booking tổng quan ===
    const [totalBookings, totalCompleted, totalCancelled] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.count({ where: { status: BOOKING_STATUS.COMPLETED } }),
      prisma.booking.count({ where: { status: BOOKING_STATUS.CANCELLED } }),
    ]);

    // === [UC-89] Tổng số khách hàng & kỹ thuật viên ===
    const [totalCustomers, totalTechnicians, totalActiveTechnicians] = await Promise.all([
      prisma.user.count({ where: { role: ROLES.CUSTOMER } }),
      prisma.user.count({ where: { role: ROLES.TECHNICIAN } }),
      prisma.technicianProfile.count({ where: { is_available: true } }),
    ]);

    // === [UC-89] Thống kê khiếu nại ===
    const [totalComplaints, openComplaints, resolvedComplaints] = await Promise.all([
      prisma.complaint.count(),
      prisma.complaint.count({ where: { status: 'OPEN' } }),
      prisma.complaint.count({ where: { status: 'RESOLVED' } }),
    ]);
    const complaintStats = { total: totalComplaints, open: openComplaints, resolved: resolvedComplaints };

    // Tổng doanh thu (sum of PAID payments)
    const revenueResult = await prisma.payment.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true },
    });
    const totalRevenue = revenueResult._sum.amount || 0;

    // Doanh thu theo tháng (6 tháng gần nhất)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const paidPayments = await prisma.payment.findMany({
      where: { status: 'PAID', paid_at: { gte: sixMonthsAgo } },
      select: { amount: true, paid_at: true, method: true, settlement_status: true },
    });
    // Nhóm theo tháng
    const revenueMap = {};
    paidPayments.forEach((p) => {
      if (p.paid_at) {
        const key = `${p.paid_at.getFullYear()}-${String(p.paid_at.getMonth() + 1).padStart(2, '0')}`;
        revenueMap[key] = (revenueMap[key] || 0) + Number(p.amount);
      }
    });

    // Convert object to array for frontend charting (Recharts requires Array)
    const revenueByMonth = Object.keys(revenueMap).sort().map(key => ({
      month: key,
      revenue: revenueMap[key]
    }));

    // === [UC-89] Xu hướng booking 30 ngày gần nhất (daily trend) ===
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentAllBookings = await prisma.booking.findMany({
      where: { created_at: { gte: thirtyDaysAgo } },
      select: { created_at: true },
    });
    const trendMap = {};
    recentAllBookings.forEach((b) => {
      const key = b.created_at.toISOString().slice(0, 10); // YYYY-MM-DD
      trendMap[key] = (trendMap[key] || 0) + 1;
    });
    // Điền đủ 30 ngày kể cả ngày không có đơn
    const bookingTrend = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      bookingTrend.push({ date: key, count: trendMap[key] || 0 });
    }

    // Top 5 services theo số lượng booking
    const topServicesRaw = await prisma.booking.groupBy({
      by: ['service_id'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });
    const topServiceIds = topServicesRaw.map((s) => s.service_id);
    const topServiceNames = await prisma.service.findMany({
      where: { id: { in: topServiceIds } },
      select: { id: true, name: true },
    });
    const topServices = topServicesRaw.map((s) => ({
      service_id: s.service_id,
      service_name: topServiceNames.find((sn) => sn.id === s.service_id)?.name || 'N/A',
      booking_count: s._count.id,
    }));

    // Top 5 technicians theo rating
    const topTechnicians = await prisma.technicianProfile.findMany({
      take: 5,
      orderBy: { avg_rating: 'desc' },
      include: { user: { select: { id: true, full_name: true, avatar_url: true } } },
    });

    // Booking theo status
    const bookingsByStatusRaw = await prisma.booking.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    const bookingsByStatus = {};
    bookingsByStatusRaw.forEach((b) => {
      bookingsByStatus[b.status] = b._count.id;
    });

    // Booking theo district
    const bookingsByDistrictRaw = await prisma.booking.groupBy({
      by: ['district_id'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    const districtIds = bookingsByDistrictRaw.map((b) => b.district_id);
    const districtNames = await prisma.district.findMany({
      where: { id: { in: districtIds } },
      select: { id: true, name: true },
    });
    const bookingsByDistrict = bookingsByDistrictRaw.map((b) => ({
      district_id: b.district_id,
      district_name: districtNames.find((d) => d.id === b.district_id)?.name || 'N/A',
      booking_count: b._count.id,
    }));

    // === [UC-89] Doanh thu theo khu vực ===
    const revenueByDistrictData = await prisma.payment.findMany({
      where: { status: 'PAID' },
      select: { amount: true, booking: { select: { district_id: true } } },
    });
    const districtRevenueMap = {};
    revenueByDistrictData.forEach((p) => {
      const dId = p.booking?.district_id;
      if (dId) {
        districtRevenueMap[dId] = (districtRevenueMap[dId] || 0) + Number(p.amount);
      }
    });
    const revenueByDistrict = Object.entries(districtRevenueMap).map(([dId, revenue]) => ({
      district_id: parseInt(dId),
      district_name: districtNames.find((d) => d.id === parseInt(dId))?.name || 'N/A',
      revenue,
    }));

    // Thống kê phương thức thanh toán
    const paymentMethodStatsRaw = await prisma.payment.groupBy({
      by: ['method'],
      where: { status: PAYMENT_STATUS.PAID },
      _count: { id: true },
      _sum: { amount: true },
    });
    const paymentMethodStats = {};
    paymentMethodStatsRaw.forEach((p) => {
      paymentMethodStats[p.method] = {
        count: p._count.id,
        total_amount: Number(p._sum.amount) || 0,
      };
    });

    // 10 đơn hàng gần nhất
    const recentBookings = await prisma.booking.findMany({
      take: 10,
      orderBy: { created_at: 'desc' },
      include: {
        customer: { select: { id: true, full_name: true } },
        service: { select: { id: true, name: true } },
        district: { select: { id: true, name: true } },
      },
    });

    return success(res, {
      totalBookings,
      totalCompleted,
      totalCancelled,
      totalRevenue: Number(totalRevenue),
      revenueSummary: summarizePaidPayments(await prisma.payment.findMany({
        where: { status: PAYMENT_STATUS.PAID },
        select: { amount: true, method: true, settlement_status: true },
      })),
      // [UC-89] Bổ sung thêm thống kê tổng quan
      totalCustomers,
      totalTechnicians,
      totalActiveTechnicians,
      complaintStats,
      bookingTrend,
      revenueByMonth,
      revenueByDistrict,
      topServices,
      topTechnicians,
      bookingsByStatus,
      bookingsByDistrict,
      paymentMethodStats,
      recentBookings,
    });
  } catch (err) {
    console.error('getDashboard error:', err);
    return error(res, 'Không thể lấy dữ liệu dashboard', 500);
  }
};

/**
 * GET /admin/payments/:id
 * Chi tiết một payment kèm booking, customer, service, technician, quotation items.
 */
const getPaymentDetail = async (req, res) => {
  try {
    const paymentId = parseInt(req.params.id);

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: {
            customer: { select: { id: true, full_name: true, email: true, phone: true, avatar_url: true } },
            technicianProfile: {
              include: {
                user: { select: { id: true, full_name: true, phone: true, email: true } },
              },
            },
            service: { include: { category: { select: { id: true, name: true } } } },
            deviceType: { select: { id: true, name: true } },
            district: { select: { id: true, name: true } },
            ward: { select: { id: true, name: true } },
            voucher: true,
            quotations: {
              where: { status: 'ACCEPTED' },
              include: { items: true },
              take: 1,
            },
            statusHistories: {
              orderBy: { created_at: 'desc' },
              include: { user: { select: { id: true, full_name: true, role: true } } },
            },
          },
        },
        confirmer: { select: { id: true, full_name: true } },
        settler: { select: { id: true, full_name: true } },
      },
    });

    if (!payment) return error(res, 'Không tìm thấy giao dịch', 404);
    return success(res, payment);
  } catch (err) {
    console.error('getPaymentDetail error:', err);
    return error(res, 'Không thể lấy chi tiết giao dịch', 500);
  }
};

/**
 * GET /admin/vouchers/:id/usages
 * Lịch sử sử dụng của một voucher cụ thể.
 */
const getVoucherUsages = async (req, res) => {
  try {
    const voucherId = parseInt(req.params.id);
    const { skip, take, page, limit } = getPagination(req.query);

    const voucher = await prisma.voucher.findUnique({ where: { id: voucherId } });
    if (!voucher) return error(res, 'Voucher không tồn tại', 404);

    const [usages, total] = await Promise.all([
      prisma.voucherUsage.findMany({
        where: { voucher_id: voucherId },
        skip,
        take,
        orderBy: { used_at: 'desc' },
        include: {
          user: { select: { id: true, full_name: true, email: true, phone: true, avatar_url: true } },
          booking: {
            select: {
              id: true,
              status: true,
              booking_date: true,
              estimated_price: true,
              final_price: true,
              service: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.voucherUsage.count({ where: { voucher_id: voucherId } }),
    ]);

    return paginated(res, { voucher, usages }, total, page, limit);
  } catch (err) {
    console.error('getVoucherUsages error:', err);
    return error(res, 'Không thể lấy lịch sử sử dụng voucher', 500);
  }
};
/**
 * GET /admin/reports/revenue
 * Lấy báo cáo doanh thu theo khoảng thời gian
 */
const getRevenueReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {
      status: PAYMENT_STATUS.PAID,
    };

    if (startDate || endDate) {
      where.paid_at = {};
      if (startDate) where.paid_at.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.paid_at.lte = end;
      }
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { paid_at: 'desc' },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            service: { select: { id: true, name: true } },
            customer: { select: { id: true, full_name: true, phone: true } },
            technicianProfile: {
              include: { user: { select: { id: true, full_name: true } } }
            }
          }
        }
      }
    });

    const summary = summarizePaidPayments(payments);

    // Xử lý dữ liệu biểu đồ theo ngày
    const revenueByDayMap = new Map();
    payments.forEach(p => {
      if (!p.paid_at) return;
      const dateKey = p.paid_at.toISOString().split('T')[0];
      if (!revenueByDayMap.has(dateKey)) {
        revenueByDayMap.set(dateKey, { date: dateKey, revenue: 0, vnpay: 0, cash: 0 });
      }
      const dayData = revenueByDayMap.get(dateKey);
      const amount = Number(p.amount || 0);
      dayData.revenue += amount;
      if (p.method === PAYMENT_METHOD.VNPAY) dayData.vnpay += amount;
      else if (p.method === PAYMENT_METHOD.CASH) dayData.cash += amount;
    });

    const revenueByDay = Array.from(revenueByDayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return success(res, {
      summary,
      revenueByDay,
      payments
    });
  } catch (err) {
    console.error('getRevenueReport error:', err);
    return error(res, 'Không thể lấy báo cáo doanh thu', 500);
  }
};

module.exports = {
  // Booking Dispatch
  getBookings, getBookingDetail, confirmBooking, assignTechnician, reassignTechnician, cancelBooking,
  // User Management
  getUsers, lockUser, unlockUser,
  // Technician Management
  getTechnicians, createTechnician, updateTechnician, deactivateTechnician,
  updateTechnicianSkills, updateTechnicianSchedule,
  // Category CRUD
  getCategories, createCategory, updateCategory, deleteCategory,
  // Service CRUD
  getServices, createService, updateService, deleteService,
  // Device Type CRUD
  getDeviceTypes, createDeviceType, updateDeviceType, deleteDeviceType,
  // District & Ward
  getDistricts, createDistrict, updateDistrict, toggleDistrict, deleteDistrict, createWard, updateWard, toggleWard, deleteWard,
  // Voucher CRUD
  getVouchers, createVoucher, updateVoucher, toggleVoucher, getVoucherUsages,
  // Payment & Complaint
  getPayments, getPaymentDetail, confirmCashSettlement, getTechnicianWallets,
  confirmCashSettlementBatch, getComplaints, resolveComplaint,
  // Dashboard
  getDashboard, getRevenueReport,
};
