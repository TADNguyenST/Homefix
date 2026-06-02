// ============================================================
// HOMEFIX AI — Review Controller
// Khách đánh giá sao cho đơn đã hoàn thành
// ============================================================

const prisma = require('../utils/prisma');
const { success, error } = require('../utils/response');
const { BOOKING_STATUS, PAYMENT_STATUS } = require('../config/constants');
const { notifyNewReview } = require('../services/notificationService');
const { analyzeSentiment } = require('../services/aiService');

// ========================
// CREATE REVIEW — Khách đánh giá sau khi hoàn thành & thanh toán
// ========================
const createReview = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    const { rating, comment } = req.body;

    // Lấy booking kèm thông tin cần thiết
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payment: { select: { status: true } },
        review: { select: { id: true } },
        technicianProfile: { select: { id: true, user_id: true } },
      },
    });

    if (!booking) {
      return error(res, 'Không tìm thấy đơn hàng', 404);
    }

    if (booking.customer_id !== req.user.id) {
      return error(res, 'Bạn không có quyền đánh giá đơn này', 403);
    }

    if (booking.status !== BOOKING_STATUS.COMPLETED) {
      return error(res, 'Chỉ có thể đánh giá khi đơn đã hoàn thành', 400);
    }

    if (booking.payment?.status !== PAYMENT_STATUS.PAID) {
      return error(res, 'Vui lòng thanh toán trước khi đánh giá', 400);
    }

    if (booking.review) {
      return error(res, 'Bạn đã đánh giá đơn này rồi', 400);
    }

    if (!booking.technicianProfile) {
      return error(res, 'Đơn hàng chưa có thợ phụ trách, không thể đánh giá', 400);
    }

    // Phân tích cảm xúc bằng AI (nếu có comment)
    let ai_sentiment = 'NEUTRAL';
    if (comment) {
      ai_sentiment = await analyzeSentiment(comment);
    }

    // Tạo review và cập nhật avg_rating trong 1 transaction
    const review = await prisma.$transaction(async (tx) => {
      const newReview = await tx.review.create({
        data: {
          booking_id: bookingId,
          customer_id: req.user.id,
          technician_profile_id: booking.technicianProfile.id,
          rating,
          comment: comment || null,
          ai_sentiment,
        },
      });

      // Lấy tất cả đánh giá (đã bao gồm cái mới vì trong cùng transaction)
      const allReviews = await tx.review.findMany({
        where: { technician_profile_id: booking.technicianProfile.id },
        select: { rating: true },
      });

      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

      await tx.technicianProfile.update({
        where: { id: booking.technicianProfile.id },
        data: { avg_rating: Math.round(avgRating * 10) / 10 }, // Làm tròn 1 chữ số
      });

      return newReview;
    });

    // Gửi thông báo cho thợ
    await notifyNewReview(booking.technicianProfile.user_id, bookingId, rating);

    return success(res, review, 'Đánh giá thành công! Cảm ơn bạn đã phản hồi.', 201);
  } catch (err) {
    console.error('Create review error:', err);
    return error(res, 'Đánh giá thất bại', 500);
  }
};

// ========================
// GET TECH REVIEWS — Xem đánh giá công khai của 1 thợ
// ========================
const getTechReviews = async (req, res) => {
  try {
    const techProfileId = parseInt(req.params.techProfileId);

    const reviews = await prisma.review.findMany({
      where: { technician_profile_id: techProfileId },
      include: {
        customer: { select: { full_name: true, avatar_url: true } },
        booking: { select: { service: { select: { name: true } } } },
      },
      orderBy: { created_at: 'desc' },
    });

    const profile = await prisma.technicianProfile.findUnique({
      where: { id: techProfileId },
      select: { avg_rating: true, total_completed_jobs: true },
    });

    return success(res, { profile, reviews });
  } catch (err) {
    console.error('Get tech reviews error:', err);
    return error(res, 'Không thể tải đánh giá', 500);
  }
};

module.exports = { createReview, getTechReviews };
