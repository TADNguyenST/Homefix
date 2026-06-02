// ============================================================
// HOMEFIX AI — Notification Service
// Helper tạo thông báo cho mọi module trong hệ thống
// ============================================================

const prisma = require('../utils/prisma');
const { NOTIFICATION_TYPE } = require('../config/constants');

/**
 * Tạo 1 thông báo cho 1 user
 * @param {number} userId - ID người nhận
 * @param {string} title - Tiêu đề thông báo
 * @param {string} message - Nội dung chi tiết
 * @param {string} type - NOTIFICATION_TYPE (BOOKING, PAYMENT, QUOTATION, REVIEW, COMPLAINT, SYSTEM)
 * @param {number|null} referenceId - ID của đơn hàng/báo giá/khiếu nại liên quan (để nhảy link)
 */
const createNotification = async (userId, title, message, type = NOTIFICATION_TYPE.SYSTEM, referenceId = null) => {
  try {
    await prisma.notification.create({
      data: {
        user_id: userId,
        title,
        message,
        type,
        reference_id: referenceId,
      },
    });
  } catch (err) {
    // Ghi log nhưng không throw lỗi (thông báo thất bại không nên crash luồng chính)
    console.error('Failed to create notification:', err.message);
  }
};

/**
 * Tạo thông báo cho nhiều user cùng lúc
 * @param {number[]} userIds - Mảng ID người nhận
 * @param {string} title
 * @param {string} message
 * @param {string} type
 * @param {number|null} referenceId
 */
const createBulkNotifications = async (userIds, title, message, type = NOTIFICATION_TYPE.SYSTEM, referenceId = null) => {
  try {
    const data = userIds.map(userId => ({
      user_id: userId,
      title,
      message,
      type,
      reference_id: referenceId,
    }));

    await prisma.notification.createMany({ data });
  } catch (err) {
    console.error('Failed to create bulk notifications:', err.message);
  }
};

// ========================
// Các template thông báo phổ biến
// ========================

const notifyBookingCreated = async (adminIds, bookingId, customerName) => {
  await createBulkNotifications(
    adminIds,
    'Đơn đặt lịch mới',
    `Khách hàng ${customerName} vừa đặt lịch sửa chữa mới. Vui lòng kiểm tra và phân công thợ.`,
    NOTIFICATION_TYPE.BOOKING,
    bookingId
  );
};

const notifyTechAssigned = async (techUserId, bookingId) => {
  await createNotification(
    techUserId,
    'Bạn được phân công đơn mới',
    `Bạn vừa được phân công cho đơn sửa chữa #${bookingId}. Vui lòng xem chi tiết và xác nhận.`,
    NOTIFICATION_TYPE.BOOKING,
    bookingId
  );
};

const notifyQuotationSent = async (customerId, bookingId) => {
  await createNotification(
    customerId,
    'Báo giá mới từ Kỹ thuật viên',
    `Kỹ thuật viên vừa gửi báo giá cho đơn #${bookingId}. Vui lòng xem xét và phản hồi.`,
    NOTIFICATION_TYPE.QUOTATION,
    bookingId
  );
};

const notifyQuotationResponse = async (techUserId, bookingId, accepted) => {
  const status = accepted ? 'Đồng ý' : 'Từ chối';
  await createNotification(
    techUserId,
    `Khách hàng đã ${status} báo giá`,
    `Khách hàng đã ${status.toLowerCase()} báo giá cho đơn #${bookingId}.`,
    NOTIFICATION_TYPE.QUOTATION,
    bookingId
  );
};

const notifyPaymentSuccess = async (userId, bookingId, amount) => {
  await createNotification(
    userId,
    'Thanh toán thành công',
    `Thanh toán ${Number(amount).toLocaleString('vi-VN')}đ cho đơn #${bookingId} đã hoàn tất.`,
    NOTIFICATION_TYPE.PAYMENT,
    bookingId
  );
};

const notifyBookingCompleted = async (customerId, bookingId) => {
  await createNotification(
    customerId,
    'Sửa chữa hoàn thành',
    `Đơn sửa chữa #${bookingId} đã hoàn thành. Vui lòng đánh giá dịch vụ!`,
    NOTIFICATION_TYPE.BOOKING,
    bookingId
  );
};

const notifyNewReview = async (techUserId, bookingId, rating) => {
  await createNotification(
    techUserId,
    `Đánh giá mới: ${rating}⭐`,
    `Bạn vừa nhận được đánh giá ${rating} sao cho đơn #${bookingId}.`,
    NOTIFICATION_TYPE.REVIEW,
    bookingId
  );
};

const notifyNewComplaint = async (adminIds, complaintId, customerName) => {
  await createBulkNotifications(
    adminIds,
    'Khiếu nại mới',
    `Khách hàng ${customerName} vừa gửi khiếu nại. Vui lòng xử lý.`,
    NOTIFICATION_TYPE.COMPLAINT,
    complaintId
  );
};

const notifyComplaintResolved = async (customerId, complaintId, status) => {
  const label = status === 'RESOLVED' ? 'đã được giải quyết' : 'đã bị từ chối';
  await createNotification(
    customerId,
    `Khiếu nại ${label}`,
    `Khiếu nại #${complaintId} của bạn ${label}. Vui lòng xem phản hồi chi tiết.`,
    NOTIFICATION_TYPE.COMPLAINT,
    complaintId
  );
};

const notifyBookingRescheduled = async (techUserId, bookingId) => {
  await createNotification(
    techUserId,
    'Đơn hàng bị đổi lịch',
    `Đơn hàng #${bookingId} đã được khách hàng đổi sang lịch mới. Bạn đã được tự động gỡ khỏi đơn hàng này, Admin sẽ phân công lại sau.`,
    NOTIFICATION_TYPE.BOOKING,
    bookingId
  );
};

module.exports = {
  createNotification,
  createBulkNotifications,
  notifyBookingCreated,
  notifyTechAssigned,
  notifyQuotationSent,
  notifyQuotationResponse,
  notifyPaymentSuccess,
  notifyBookingCompleted,
  notifyNewReview,
  notifyNewComplaint,
  notifyComplaintResolved,
  notifyBookingRescheduled,
};
