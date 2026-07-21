const prisma = require('../utils/prisma');
const { success, error, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const {
  BOOKING_STATUS,
  BOOKING_STATUS_TRANSITIONS,
  QUOTATION_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  PAYMENT_SETTLEMENT_STATUS,
} = require('../config/constants');
const {
  notifyQuotationSent,
  notifyAwaitingPayment,
  notifyJobAcceptedByTech,
  notifyJobRejectedByTech,
  notifyJobInspecting,
} = require('../services/notificationService');
const { completeBookingPayment } = require('../services/paymentCompletionService');
const { calculatePayableAmount, calculateVoucherDiscount } = require('../utils/pricing');
const { getOwnedStorageKey } = require('../services/imageStorageService');

const getMyProfile = async (userId, include = {}) => {
  return prisma.technicianProfile.findUnique({
    where: { user_id: userId },
    include,
  });
};

const getAvailableTechnicians = async (req, res) => {
  try {
    const serviceId = parseInt(req.query.service_id, 10);
    const districtId = parseInt(req.query.district_id, 10);

    if (!serviceId || !districtId) {
      return error(res, 'Thiếu dịch vụ hoặc khu vực để quét thợ', 400);
    }

    const technicians = await prisma.technicianProfile.findMany({
      where: {
        is_available: true,
        user: {
          is_active: true,
          is_locked: false,
        },
        OR: [{ district_id: districtId }, { district_id: null }],
        skills: {
          some: { service_id: serviceId },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            phone: true,
            avatar_url: true,
          },
        },
        district: { select: { id: true, name: true } },
        skills: {
          where: { service_id: serviceId },
          include: { service: { select: { id: true, name: true } } },
        },
        _count: {
          select: {
            bookings: {
              where: {
                status: {
                  notIn: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED],
                },
              },
            },
          },
        },
      },
      orderBy: [{ avg_rating: 'desc' }, { total_jobs: 'desc' }],
      take: 10,
    });

    const result = technicians.map((tech, index) => ({
      id: tech.id,
      name: tech.user?.full_name || `Kỹ thuật viên ${tech.id}`,
      phone: tech.user?.phone || null,
      district_id: tech.district_id,
      district_name: tech.district?.name || 'Toàn TP',
      skill: tech.skills?.[0]?.service?.name || 'Dịch vụ phù hợp',
      service_ids: tech.skills?.map((skill) => skill.service_id) || [],
      rating: Number(tech.avg_rating || 0),
      jobs: tech.total_jobs || 0,
      active_jobs: tech._count?.bookings || 0,
      distance_km: tech.district_id === districtId ? 1.2 + index * 0.7 : 4.5 + index,
      eta_minutes: tech.district_id === districtId ? 7 + index * 3 : 18 + index * 4,
      available: tech.is_available,
    }));

    return success(res, result);
  } catch (err) {
    console.error('getAvailableTechnicians error:', err);
    return error(res, 'Không thể quét kỹ thuật viên khả dụng', 500);
  }
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
    const profile = await getMyProfile(req.user.id, { user: true });
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

    try {
      await notifyJobAcceptedByTech(booking.customer_id, bookingId, profile.user.full_name);
    } catch (notifErr) {
      console.error('Failed to send job accepted notification:', notifErr.message);
    }

    return success(res, null, 'Nhan don thanh cong');
  } catch (err) {
    console.error('Accept job error:', err);
    return error(res, 'Nhan don that bai', 500);
  }
};

const rejectJob = async (req, res) => {
  try {
    const profile = await getMyProfile(req.user.id, { user: true });
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

    try {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', is_active: true },
        select: { id: true },
      });
      const adminIds = admins.map(a => a.id);
      if (adminIds.length > 0) {
        await notifyJobRejectedByTech(adminIds, bookingId, profile.user.full_name, reason);
      }
    } catch (notifErr) {
      console.error('Failed to send job rejected notification:', notifErr.message);
    }

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
    const { new_status, note, image_urls = [] } = req.body;
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

    const noteText = typeof note === 'string' ? note.trim() : '';
    if (new_status === BOOKING_STATUS.AWAITING_PAYMENT) {
      if (!noteText) {
        return error(res, 'Vui long nhap ghi chu ban giao khi hoan thanh sua chua', 400);
      }

      if (image_urls.some((url) => !getOwnedStorageKey(url, req.user.id))) {
        return error(res, 'Anh sau sua chua khong hop le hoac khong thuoc tai khoan cua ban', 403);
      }
    } else if (image_urls.length > 0) {
      return error(res, 'Chi duoc gui anh khi bao cao hoan thanh sua chua', 400);
    }

    const operations = [
      prisma.booking.update({ where: { id: bookingId }, data: { status: new_status } }),
      prisma.bookingStatusHistory.create({
        data: {
          booking_id: bookingId,
          from_status: booking.status,
          to_status: new_status,
          changed_by: req.user.id,
          note: noteText || `Tho cap nhat trang thai sang ${new_status}`,
        },
      }),
    ];

    if (new_status === BOOKING_STATUS.AWAITING_PAYMENT && image_urls.length > 0) {
      operations.push(
        prisma.bookingImage.createMany({
          data: image_urls.map((url) => ({
            booking_id: bookingId,
            image_url: url,
            uploaded_by: 'TECHNICIAN',
          })),
        })
      );
    }

    await prisma.$transaction(operations);
    try {
      if (new_status === BOOKING_STATUS.AWAITING_PAYMENT) {
        await notifyAwaitingPayment(booking.customer_id, bookingId, booking.payment_method);
      } else if (new_status === BOOKING_STATUS.INSPECTING) {
        const profileWithUser = await getMyProfile(req.user.id, { user: true });
        await notifyJobInspecting(booking.customer_id, bookingId, profileWithUser.user.full_name);
      }
    } catch (notifErr) {
      console.error('Failed to send job status notification:', notifErr.message);
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
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { voucher: true },
    });
    if (!booking || booking.technician_profile_id !== profile.id) {
      return error(res, 'Don hang khong ton tai hoac khong thuoc ve ban', 404);
    }
    if (booking.status !== BOOKING_STATUS.INSPECTING) {
      return error(res, 'Chi co the tao bao gia khi don dang khao sat', 400);
    }

    const totalExtraPrice = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const quotationDiscount = calculateVoucherDiscount(booking.voucher, totalExtraPrice);
    const quotationPayable = calculatePayableAmount(totalExtraPrice, quotationDiscount);
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

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BOOKING_STATUS.QUOTED,
          discount_amount: quotationDiscount,
          final_price: null,
        },
      });
      await tx.payment.update({
        where: { booking_id: bookingId },
        data: { amount: quotationPayable },
      });
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

const getMyCashWallet = async (req, res) => {
  try {
    const profile = await getMyProfile(req.user.id);
    if (!profile) return error(res, 'Khong tim thay ho so ky thuat vien', 404);

    const payments = await prisma.payment.findMany({
      where: {
        method: PAYMENT_METHOD.CASH,
        status: PAYMENT_STATUS.PAID,
        booking: { technician_profile_id: profile.id },
      },
      include: {
        booking: {
          select: {
            booking_date: true,
            customer: { select: { full_name: true, phone: true } },
            service: { select: { name: true } },
          },
        },
      },
      orderBy: [{ paid_at: 'desc' }, { id: 'desc' }],
    });

    const walletPayments = payments.map((payment) => ({
      id: payment.id,
      booking_id: payment.booking_id,
      service_name: payment.booking.service.name,
      customer_name: payment.booking.customer.full_name,
      customer_phone: payment.booking.customer.phone,
      booking_date: payment.booking.booking_date,
      amount: Number(payment.amount),
      paid_at: payment.paid_at,
      settlement_status: payment.settlement_status,
      settlement_note: payment.settlement_note,
    }));

    const totals = walletPayments.reduce((summary, payment) => {
      summary.total_collected += payment.amount;
      if (payment.settlement_status === PAYMENT_SETTLEMENT_STATUS.SETTLED) {
        summary.total_settled += payment.amount;
      }
      if (payment.settlement_status === PAYMENT_SETTLEMENT_STATUS.PENDING) {
        summary.total_pending += payment.amount;
      }
      return summary;
    }, { total_collected: 0, total_settled: 0, total_pending: 0 });

    return success(res, { ...totals, payments: walletPayments });
  } catch (err) {
    console.error('Get cash wallet error:', err);
    return error(res, 'Khong the tai vi tien mat', 500);
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
  getAvailableTechnicians,
  getAssignedJobs,
  getJobDetail,
  acceptJob,
  rejectJob,
  updateJobStatus,
  createQuotation,
  confirmCashPayment,
  getMyCashWallet,
  getMySchedule,
  getJobHistory,
  getMyRating,
};
