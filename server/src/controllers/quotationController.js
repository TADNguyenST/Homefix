// ============================================================
// HOMEFIX AI — Quotation Controller
// Khách xem, đồng ý, từ chối báo giá
// ============================================================

const prisma = require('../utils/prisma');
const { success, error } = require('../utils/response');
const { QUOTATION_STATUS, BOOKING_STATUS } = require('../config/constants');
const { notifyQuotationResponse } = require('../services/notificationService');
const { calculatePayableAmount, calculateVoucherDiscount } = require('../utils/pricing');

// ========================
// VIEW QUOTATION DETAIL — Xem chi tiết 1 báo giá
// ========================
const getQuotationById = async (req, res) => {
  try {
    const quotationId = parseInt(req.params.id);

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        items: true,
        creator: { select: { id: true, full_name: true } },
        booking: {
          select: {
            id: true,
            customer_id: true,
            status: true,
            estimated_price: true,
            discount_amount: true,
            voucher: true,
            service: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!quotation) {
      return error(res, 'Không tìm thấy báo giá', 404);
    }

    if (quotation.booking.customer_id !== req.user.id && req.user.role !== 'ADMIN') {
      return error(res, 'Bạn không có quyền xem báo giá này', 403);
    }

    return success(res, quotation);
  } catch (err) {
    console.error('Get quotation detail error:', err);
    return error(res, 'Không thể tải chi tiết báo giá', 500);
  }
};

// ========================
// VIEW QUOTATION — Xem báo giá của 1 đơn hàng
// ========================
const getQuotation = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { customer_id: true, technician_profile_id: true },
    });

    if (!booking) {
      return error(res, 'Không tìm thấy đơn hàng', 404);
    }

    // Cho phép chủ đơn hoặc Admin xem
    if (booking.customer_id !== req.user.id && req.user.role !== 'ADMIN') {
      return error(res, 'Bạn không có quyền xem báo giá này', 403);
    }

    const quotations = await prisma.quotation.findMany({
      where: { booking_id: bookingId },
      include: {
        items: true,
        creator: { select: { full_name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return success(res, quotations);
  } catch (err) {
    console.error('Get quotation error:', err);
    return error(res, 'Không thể tải báo giá', 500);
  }
};

// ========================
// ACCEPT QUOTATION — Khách đồng ý báo giá → Thợ bắt đầu sửa
// ========================
const acceptQuotation = async (req, res) => {
  try {
    const quotationId = parseInt(req.params.id);

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        booking: {
          select: {
            id: true,
            customer_id: true,
            status: true,
            technician_profile_id: true,
            estimated_price: true,
            discount_amount: true,
            voucher: true,
          },
        },
      },
    });

    if (!quotation) {
      return error(res, 'Không tìm thấy báo giá', 404);
    }

    if (quotation.booking.customer_id !== req.user.id) {
      return error(res, 'Bạn không có quyền phản hồi báo giá này', 403);
    }

    if (quotation.status !== QUOTATION_STATUS.PENDING) {
      return error(res, 'Báo giá này đã được phản hồi trước đó', 400);
    }

    if (quotation.booking.status !== BOOKING_STATUS.QUOTED) {
      return error(res, 'Đơn hàng không ở trạng thái chờ phản hồi báo giá', 400);
    }

    // total_extra_price là tạm tính báo giá; voucher của booking được trừ một lần vào số cuối.
    const discountAmount = calculateVoucherDiscount(quotation.booking.voucher, quotation.total_extra_price);
    const finalPrice = calculatePayableAmount(quotation.total_extra_price, discountAmount);

    await prisma.$transaction([
      prisma.quotation.update({
        where: { id: quotationId },
        data: {
          status: QUOTATION_STATUS.ACCEPTED,
          responded_by: req.user.id,
          responded_at: new Date(),
        },
      }),
      prisma.booking.update({
        where: { id: quotation.booking.id },
        data: {
          status: BOOKING_STATUS.COMPLETING,
          final_price: finalPrice,
          discount_amount: discountAmount,
        },
      }),
      prisma.payment.update({
        where: { booking_id: quotation.booking.id },
        data: { amount: finalPrice },
      }),
      prisma.bookingStatusHistory.create({
        data: {
          booking_id: quotation.booking.id,
          from_status: BOOKING_STATUS.QUOTED,
          to_status: BOOKING_STATUS.COMPLETING,
          changed_by: req.user.id,
          note: `Khách đồng ý báo giá ${Number(quotation.total_extra_price).toLocaleString('vi-VN')}đ. Tổng: ${finalPrice.toLocaleString('vi-VN')}đ`,
        },
      }),
    ]);

    // Lấy tech user_id để gửi thông báo
    const techProfile = await prisma.technicianProfile.findUnique({
      where: { id: quotation.booking.technician_profile_id },
      select: { user_id: true },
    });
    if (techProfile) {
      await notifyQuotationResponse(techProfile.user_id, quotation.booking.id, true);
    }

    return success(res, null, 'Đồng ý báo giá thành công. Thợ sẽ bắt đầu sửa chữa!');
  } catch (err) {
    console.error('Accept quotation error:', err);
    return error(res, 'Phản hồi báo giá thất bại', 500);
  }
};

// ========================
// REJECT QUOTATION — Khách từ chối báo giá → Hủy đơn (chỉ trả base_price)
// ========================
const rejectQuotation = async (req, res) => {
  try {
    const quotationId = parseInt(req.params.id);

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        booking: {
          select: {
            id: true,
            customer_id: true,
            status: true,
            technician_profile_id: true,
            voucher_id: true,
            estimated_price: true,
          },
        },
      },
    });

    if (!quotation) {
      return error(res, 'Không tìm thấy báo giá', 404);
    }

    if (quotation.booking.customer_id !== req.user.id) {
      return error(res, 'Bạn không có quyền phản hồi báo giá này', 403);
    }

    if (quotation.status !== QUOTATION_STATUS.PENDING) {
      return error(res, 'Báo giá này đã được phản hồi trước đó', 400);
    }

    if (quotation.booking.status !== BOOKING_STATUS.QUOTED) {
      return error(res, 'Đơn hàng không ở trạng thái chờ phản hồi báo giá', 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.quotation.update({
        where: { id: quotationId },
        data: {
          status: QUOTATION_STATUS.REJECTED,
          responded_by: req.user.id,
          responded_at: new Date(),
        },
      });
      await tx.booking.update({
        where: { id: quotation.booking.id },
        data: { 
          status: BOOKING_STATUS.CANCELLED,
          final_price: null
        },
      });
      await tx.payment.update({
        where: { booking_id: quotation.booking.id },
        data: {
          status: 'FAILED',
          amount: quotation.booking.estimated_price,
          failed_reason: 'Khach tu choi bao gia'
        },
      });
      await tx.bookingStatusHistory.create({
        data: {
          booking_id: quotation.booking.id,
          from_status: BOOKING_STATUS.QUOTED,
          to_status: BOOKING_STATUS.CANCELLED,
          changed_by: req.user.id,
          note: 'Khách từ chối báo giá, đơn được hủy và hoàn lượt sử dụng voucher nếu có.',
        },
      });

      // Khách từ chối báo giá nên đơn bị hủy và voucher được hoàn lượt sử dụng.
      if (quotation.booking.voucher_id) {
        const releasedUsage = await tx.voucherUsage.deleteMany({
          where: { voucher_id: quotation.booking.voucher_id, booking_id: quotation.booking.id },
        });
        if (releasedUsage.count > 0) {
          await tx.voucher.updateMany({
            where: { id: quotation.booking.voucher_id, used_count: { gt: 0 } },
            data: { used_count: { decrement: 1 } },
          });
        }
      }
    });

    // Gửi thông báo cho thợ
    const techProfile = await prisma.technicianProfile.findUnique({
      where: { id: quotation.booking.technician_profile_id },
      select: { user_id: true },
    });
    if (techProfile) {
      await notifyQuotationResponse(techProfile.user_id, quotation.booking.id, false);
    }

    return success(res, null, 'Từ chối báo giá thành công. Đơn hàng đã được hủy.');
  } catch (err) {
    console.error('Reject quotation error:', err);
    return error(res, 'Phản hồi báo giá thất bại', 500);
  }
};

module.exports = { getQuotationById, getQuotation, acceptQuotation, rejectQuotation };
