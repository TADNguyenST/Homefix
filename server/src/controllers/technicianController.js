const prisma = require('../utils/prisma');
const { success, error, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const {
  BOOKING_STATUS,
  BOOKING_STATUS_TRANSITIONS,
  QUOTATION_STATUS,
  PAYMENT_STATUS,
} = require('../config/constants');
const {
  notifyQuotationSent,
  notifyAwaitingPayment,
} = require('../services/notificationService');
const { completeBookingPayment } = require('../services/paymentCompletionService');
const { calculatePayableAmount } = require('../utils/pricing');

const getMyProfile = async (userId, include = {}) => {
  return prisma.technicianProfile.findUnique({
    where: { user_id: userId },
    include,
  });
};

const getAssignedJobs = async (req, res) => {
  try {
    const profile = await getMyProfile(req.user.id);
    if (!profile) return error(res, 'Khong tim thay ho so ky thuat vien', 404);

    const { skip, take, page, limit } = getPagination(req.query);
    const { status } = req.query;
    const where = { technician_profile_id: profile.id };
    if (status) where.status = status;

    const [jobs, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          customer: { select: { full_name: true, phone: true, avatar_url: true } },
          service: { select: { name: true, base_price: true, image_url: true } },
          district: { select: { name: true } },
          ward: { select: { name: true } },
          payment: { select: { status: true, method: true } },
        },
        orderBy: { booking_date: 'asc' },
        skip,
        take,
      }),
      prisma.booking.count({ where }),
    ]);

    return paginated(res, jobs, total, page, limit);
  } catch (err) {
    console.error('Get assigned jobs error:', err);
    return error(res, 'Khong the tai danh sach cong viec', 500);
  }
};

const getJobDetail = async (req, res) => {
  try {
    const profile = await getMyProfile(req.user.id);
    if (!profile) return error(res, 'Khong tim thay ho so ky thuat vien', 404);

    const bookingId = parseInt(req.params.id, 10);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: { select: { id: true, full_name: true, phone: true, email: true, avatar_url: true } },
        service: { select: { name: true, base_price: true, estimated_duration: true, category: { select: { name: true } } } },
        deviceType: { select: { name: true } },
        district: { select: { name: true } },
        ward: { select: { name: true } },
        images: { orderBy: { uploaded_at: 'desc' } },
        statusHistories: { orderBy: { created_at: 'desc' } },
        quotations: { include: { items: true }, orderBy: { created_at: 'desc' } },
        payment: true,
        aiAnalyses: { orderBy: { created_at: 'desc' }, take: 1 },
      },
    });

    if (!booking || booking.technician_profile_id !== profile.id) {
      return error(res, 'Don hang khong ton tai hoac khong thuoc ve ban', 404);
    }

    return success(res, booking);
  } catch (err) {
    console.error('Get job detail error:', err);
    return error(res, 'Khong the tai chi tiet don hang', 500);
  }
};

const acceptJob = async (req, res) => {
  try {
    const profile = await getMyProfile(req.user.id);
    if (!profile) return error(res, 'Khong tim thay ho so ky thuat vien', 404);

    const bookingId = parseInt(req.params.id, 10);
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.technician_profile_id !== profile.id) {
      return error(res, 'Don hang khong ton tai hoac khong thuoc ve ban', 404);
    }
    if (booking.status !== BOOKING_STATUS.ASSIGNED) {
      return error(res, 'Chi co the nhan don o trang thai ASSIGNED', 400);
    }

    await prisma.$transaction([
      prisma.booking.update({ where: { id: bookingId }, data: { status: BOOKING_STATUS.IN_PROGRESS } }),
      prisma.bookingStatusHistory.create({
        data: {
          booking_id: bookingId,
          from_status: BOOKING_STATUS.ASSIGNED,
          to_status: BOOKING_STATUS.IN_PROGRESS,
          changed_by: req.user.id,
          note: 'Ky thuat vien da nhan don',
        },
      }),
    ]);

    return success(res, null, 'Nhan don thanh cong');
  } catch (err) {
    console.error('Accept job error:', err);
    return error(res, 'Nhan don that bai', 500);
  }
};

const rejectJob = async (req, res) => {
  try {
    const profile = await getMyProfile(req.user.id);
    if (!profile) return error(res, 'Khong tim thay ho so ky thuat vien', 404);

    const bookingId = parseInt(req.params.id, 10);
    const { reason } = req.body;
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.technician_profile_id !== profile.id) {
      return error(res, 'Don hang khong ton tai hoac khong thuoc ve ban', 404);
    }
    if (booking.status !== BOOKING_STATUS.ASSIGNED) {
      return error(res, 'Chi co the tu choi don o trang thai ASSIGNED', 400);
    }

    await prisma.$transaction([
      prisma.booking.update({
        where: { id: bookingId },
        data: { technician_profile_id: null, status: BOOKING_STATUS.CONFIRMED },
      }),
      prisma.bookingStatusHistory.create({
        data: {
          booking_id: bookingId,
          from_status: BOOKING_STATUS.ASSIGNED,
          to_status: BOOKING_STATUS.CONFIRMED,
          changed_by: req.user.id,
          note: `Tho tu choi don. Ly do: ${reason || 'Khong ro'}`,
        },
      }),
    ]);

    return success(res, null, 'Da tu choi don. Admin se phan cong lai.');
  } catch (err) {
    console.error('Reject job error:', err);
    return error(res, 'Tu choi don that bai', 500);
  }
};

const updateJobStatus = async (req, res) => {
  try {
    const profile = await getMyProfile(req.user.id);
    if (!profile) return error(res, 'Khong tim thay ho so ky thuat vien', 404);

    const bookingId = parseInt(req.params.id, 10);
    const { new_status, note } = req.body;
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.technician_profile_id !== profile.id) {
      return error(res, 'Don hang khong ton tai hoac khong thuoc ve ban', 404);
    }

    const allowedTransitions = BOOKING_STATUS_TRANSITIONS[booking.status] || [];
    const technicianAllowedStatuses = [
      BOOKING_STATUS.INSPECTING,
      BOOKING_STATUS.COMPLETING,
      BOOKING_STATUS.AWAITING_PAYMENT,
    ];
    if (!allowedTransitions.includes(new_status) || !technicianAllowedStatuses.includes(new_status)) {
      return error(res, `Khong the chuyen tu ${booking.status} sang ${new_status}`, 400);
    }

    await prisma.$transaction([
      prisma.booking.update({ where: { id: bookingId }, data: { status: new_status } }),
      prisma.bookingStatusHistory.create({
        data: {
          booking_id: bookingId,
          from_status: booking.status,
          to_status: new_status,
          changed_by: req.user.id,
          note: note || `Tho cap nhat trang thai sang ${new_status}`,
        },
      }),
    ]);
    if (new_status === BOOKING_STATUS.AWAITING_PAYMENT) {
      await notifyAwaitingPayment(booking.customer_id, bookingId, booking.payment_method);
    }

    return success(res, null, `Cap nhat trang thai thanh ${new_status} thanh cong`);
  } catch (err) {
    console.error('Update job status error:', err);
    return error(res, 'Cap nhat trang thai that bai', 500);
  }
};

const createQuotation = async (req, res) => {
  try {
    const profile = await getMyProfile(req.user.id);
    if (!profile) return error(res, 'Khong tim thay ho so ky thuat vien', 404);

    const bookingId = parseInt(req.params.id, 10);
    const { note, items } = req.body;
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.technician_profile_id !== profile.id) {
      return error(res, 'Don hang khong ton tai hoac khong thuoc ve ban', 404);
    }
    if (booking.status !== BOOKING_STATUS.INSPECTING) {
      return error(res, 'Chi co the tao bao gia khi don dang khao sat', 400);
    }

    const totalExtraPrice = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const quotation = await prisma.$transaction(async (tx) => {
      const newQuotation = await tx.quotation.create({
        data: {
          booking_id: bookingId,
          total_extra_price: totalExtraPrice,
          note: note || null,
          status: QUOTATION_STATUS.PENDING,
          created_by: req.user.id,
          items: {
            create: items.map((item) => ({
              item_name: item.item_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
            })),
          },
        },
        include: { items: true },
      });

      await tx.booking.update({ where: { id: bookingId }, data: { status: BOOKING_STATUS.QUOTED } });
      await tx.bookingStatusHistory.create({
        data: {
          booking_id: bookingId,
          from_status: BOOKING_STATUS.INSPECTING,
          to_status: BOOKING_STATUS.QUOTED,
          changed_by: req.user.id,
          note: `Tho gui bao gia: ${totalExtraPrice.toLocaleString('vi-VN')}d`,
        },
      });

      return newQuotation;
    });

    await notifyQuotationSent(booking.customer_id, bookingId);
    return success(res, quotation, 'Gui bao gia thanh cong', 201);
  } catch (err) {
    console.error('Create quotation error:', err);
    return error(res, 'Tao bao gia that bai', 500);
  }
};

const confirmCashPayment = async (req, res) => {
  try {
    const profile = await getMyProfile(req.user.id);
    if (!profile) return error(res, 'Khong tim thay ho so ky thuat vien', 404);

    const bookingId = parseInt(req.params.id, 10);
    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { payment: true } });
    if (!booking || booking.technician_profile_id !== profile.id) {
      return error(res, 'Don hang khong ton tai hoac khong thuoc ve ban', 404);
    }
    if (booking.status !== BOOKING_STATUS.AWAITING_PAYMENT) {
      return error(res, 'Chỉ có thể xác nhận thu tiền khi đơn đang chờ thanh toán', 400);
    }
    if (booking.payment_method !== 'CASH') {
      return error(res, 'Don nay khong su dung phuong thuc tien mat', 400);
    }
    if (booking.payment?.status === PAYMENT_STATUS.PAID) {
      return error(res, 'Don nay da duoc xac nhan thanh toan', 400);
    }

    const quotation = await prisma.quotation.findFirst({
      where: { booking_id: bookingId, status: QUOTATION_STATUS.ACCEPTED },
    });
    const finalPrice = quotation
      ? calculatePayableAmount(quotation.total_extra_price, booking.discount_amount)
      : Number(booking.final_price || booking.estimated_price || 0);

    await completeBookingPayment({
      bookingId,
      amount: finalPrice,
      changedBy: req.user.id,
      confirmedBy: req.user.id,
      transactionCode: `CASH_HF${bookingId}_${Date.now()}`,
    });
    return success(res, null, `Xac nhan thu tien mat ${finalPrice.toLocaleString('vi-VN')}d thanh cong`);
  } catch (err) {
    console.error('Confirm cash payment error:', err);
    return error(res, 'Xac nhan thu tien that bai', 500);
  }
};

const getMySchedule = async (req, res) => {
  try {
    const profile = await getMyProfile(req.user.id);
    if (!profile) return error(res, 'Khong tim thay ho so ky thuat vien', 404);

    const schedules = await prisma.technicianSchedule.findMany({
      where: { technician_profile_id: profile.id },
      orderBy: { day_of_week: 'asc' },
    });

    return success(res, schedules);
  } catch (err) {
    console.error('Get schedule error:', err);
    return error(res, 'Khong the tai lich lam viec', 500);
  }
};

const getJobHistory = async (req, res) => {
  try {
    const profile = await getMyProfile(req.user.id);
    if (!profile) return error(res, 'Khong tim thay ho so ky thuat vien', 404);

    const { skip, take, page, limit } = getPagination(req.query);
    const where = {
      technician_profile_id: profile.id,
      status: { in: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED] },
    };

    const [jobs, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          customer: { select: { full_name: true } },
          service: { select: { name: true } },
          payment: { select: { amount: true, status: true, method: true } },
          review: { select: { rating: true, comment: true } },
        },
        orderBy: { updated_at: 'desc' },
        skip,
        take,
      }),
      prisma.booking.count({ where }),
    ]);

    return paginated(res, jobs, total, page, limit);
  } catch (err) {
    console.error('Get job history error:', err);
    return error(res, 'Khong the tai lich su cong viec', 500);
  }
};

const getMyRating = async (req, res) => {
  try {
    const profile = await getMyProfile(req.user.id);
    if (!profile) return error(res, 'Khong tim thay ho so ky thuat vien', 404);

    const fullProfile = await prisma.technicianProfile.findUnique({
      where: { id: profile.id },
      select: { avg_rating: true, total_completed_jobs: true },
    });

    const reviewRecords = await prisma.review.findMany({
      where: { technician_profile_id: profile.id },
      orderBy: { created_at: 'desc' },
      include: {
        customer: { select: { id: true, full_name: true, avatar_url: true } },
        booking: {
          select: {
            id: true,
            booking_date: true,
            service: { select: { id: true, name: true } },
          },
        },
      },
    });

    const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviewRecords.forEach((review) => { ratingBreakdown[review.rating] += 1; });

    return success(res, {
      avg_rating: fullProfile.avg_rating,
      total_completed_jobs: fullProfile.total_completed_jobs,
      total_reviews: reviewRecords.length,
      rating_breakdown: ratingBreakdown,
      reviews: reviewRecords,
    });
  } catch (err) {
    console.error('Get my rating error:', err);
    return error(res, 'Khong the tai thong ke danh gia', 500);
  }
};

module.exports = {
  getAssignedJobs,
  getJobDetail,
  acceptJob,
  rejectJob,
  updateJobStatus,
  createQuotation,
  confirmCashPayment,
  getMySchedule,
  getJobHistory,
  getMyRating,
};
