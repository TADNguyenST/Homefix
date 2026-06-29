// ============================================================
// HOMEFIX AI — Admin Controller
// Quản lý toàn bộ nghiệp vụ Admin: Booking dispatch, User,
// Technician, Category, Service, DeviceType, District, Ward,
// Voucher, Payment, Complaint, Dashboard
// ============================================================

const bcrypt = require('bcrypt');
const prisma = require('../utils/prisma');
const { success, error, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const {
  BOOKING_STATUS,
  ADMIN_CANCELLABLE_STATUSES,
  NOTIFICATION_TYPE,
  BUSINESS_RULES,
  ROLES,
} = require('../config/constants');

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
        user: { select: { id: true, full_name: true } },
        skills: true,
        schedules: true,
      },
    });
    if (!techProfile) return error(res, 'Kỹ thuật viên không tồn tại', 404);
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
        user: { select: { id: true, full_name: true } },
        skills: true,
        schedules: true,
      },
    });
    if (!newTechProfile) return error(res, 'Kỹ thuật viên không tồn tại', 404);
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
    const { role, is_active, search } = req.query;

    const where = {};
    if (role) where.role = role;
    if (is_active !== undefined) where.is_active = is_active === 'true';
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
          phone: true, avatar_url: true, is_active: true,
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
    const { id } = req.params;
    
    const userToLock = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!userToLock) return error(res, 'Không tìm thấy tài khoản', 404);

    const newHash = userToLock.password_hash.startsWith('BANNED:') 
      ? userToLock.password_hash 
      : `BANNED:${userToLock.password_hash}`;

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { is_active: false, password_hash: newHash },
      select: { id: true, email: true, full_name: true, is_active: true },
    });
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
    const { id } = req.params;

    const userToUnlock = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!userToUnlock) return error(res, 'Không tìm thấy tài khoản', 404);

    const newHash = userToUnlock.password_hash.startsWith('BANNED:') 
      ? userToUnlock.password_hash.replace('BANNED:', '') 
      : userToUnlock.password_hash;

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { is_active: true, password_hash: newHash },
      select: { id: true, email: true, full_name: true, is_active: true },
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
          user: { select: { id: true, email: true, full_name: true, phone: true, avatar_url: true, is_active: true } },
          district: { select: { id: true, name: true } },
          skills: { include: { service: { select: { id: true, name: true } } } },
          schedules: true,
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
    const { search, is_active } = req.query;

    // [UC-73] Xây dựng điều kiện filter
    const where = {};
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
    const { name, description, icon_url, is_active } = req.body;

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

    await prisma.serviceCategory.delete({ where: { id: categoryId } });
    return success(res, null, 'Xóa danh mục thành công');
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
    const { search, category_id, is_active } = req.query;

    // [UC-77] Xây dựng điều kiện filter
    const where = {};
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
    const { category_id, name, description, base_price, estimated_duration, image_url, is_active } = req.body;

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
      data: { is_active: false },
    });

    return success(res, service, 'Dịch vụ đã được ẩn');
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
    const { search, category_id } = req.query;

    // [UC-81] Xây dựng điều kiện filter
    const where = {};
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
    const { name, description, is_active, category_id } = req.body;
    const deviceType = await prisma.deviceType.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(is_active !== undefined && { is_active }),
        ...(category_id !== undefined && { category_id: category_id || null }),
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

    await prisma.deviceType.delete({ where: { id: deviceTypeId } });
    return success(res, null, 'Xóa loại thiết bị thành công');
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
    const { search, type } = req.query;

    // [UC-85] Xây dựng điều kiện filter
    const where = {};
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (type) where.type = type;

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
    const { name, type } = req.body;
    const district = await prisma.district.create({ data: { name, type } });
    return success(res, district, 'Tạo khu vực phục vụ thành công', 201);
  } catch (err) {
    console.error('createDistrict error:', err);
    return error(res, 'Không thể tạo khu vực phục vụ', 500);
  }
};

/**
 * PUT /admin/districts/:id
 */
const updateDistrict = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type } = req.body;
    const district = await prisma.district.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
      },
    });
    return success(res, district, 'Cập nhật khu vực phục vụ thành công');
  } catch (err) {
    console.error('updateDistrict error:', err);
    return error(res, 'Không thể cập nhật khu vực phục vụ', 500);
  }
};

/**
 * POST /admin/districts/:districtId/wards
 */
const createWard = async (req, res) => {
  try {
    const { districtId } = req.params;
    const { name, type } = req.body;

    // Kiểm tra district tồn tại
    const district = await prisma.district.findUnique({ where: { id: parseInt(districtId) } });
    if (!district) return error(res, 'Khu vực phục vụ không tồn tại', 404);

    const ward = await prisma.ward.create({
      data: { district_id: parseInt(districtId), name, type },
    });
    return success(res, ward, 'Tạo phường/xã thành công', 201);
  } catch (err) {
    console.error('createWard error:', err);
    return error(res, 'Không thể tạo phường/xã', 500);
  }
};

/**
 * PUT /admin/wards/:id
 */
const updateWard = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type } = req.body;
    const ward = await prisma.ward.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
      },
    });
    return success(res, ward, 'Cập nhật phường/xã thành công');
  } catch (err) {
    console.error('updateWard error:', err);
    return error(res, 'Không thể cập nhật phường/xã', 500);
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
      return error(res, 'Không thể xóa khu vực đang có phường/xã, địa chỉ, đơn hàng hoặc kỹ thuật viên liên quan', 400);
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
    const { method, status: paymentStatus, date_from, date_to } = req.query;

    const where = {};
    if (method) where.method = method;
    if (paymentStatus) where.status = paymentStatus;
    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) where.created_at.gte = new Date(date_from);
      if (date_to) where.created_at.lte = new Date(date_to);
    }

    const [payments, total] = await Promise.all([
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
    ]);

    return paginated(res, payments, total, page, limit);
  } catch (err) {
    console.error('getPayments error:', err);
    return error(res, 'Không thể lấy danh sách thanh toán', 500);
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
      select: { amount: true, paid_at: true },
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
  getDistricts, createDistrict, updateDistrict, deleteDistrict, createWard, updateWard, deleteWard,
  // Voucher CRUD
  getVouchers, createVoucher, updateVoucher, toggleVoucher,
  // Payment & Complaint
  getPayments, getComplaints, resolveComplaint,
  // Dashboard
  getDashboard,
};
