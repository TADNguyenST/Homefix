const prisma = require('../utils/prisma');
const {
  BOOKING_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PAYMENT_SETTLEMENT_STATUS,
} = require('../config/constants');
const {
  notifyPaymentSuccess,
  notifyBookingCompleted,
} = require('./notificationService');

const completeBookingPayment = async ({
  bookingId,
  amount,
  changedBy,
  confirmedBy = null,
  transactionCode = null,
  vnpayTxnRef,
  vnpayResponseCode,
}) => {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { booking_id: bookingId },
    });
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
    });

    if (!payment || !booking) {
      throw new Error('Không tìm thấy thông tin thanh toán hoặc đơn hàng');
    }

    if (payment.status === PAYMENT_STATUS.PAID) {
      return { alreadyPaid: true, booking, amount: Number(payment.amount) };
    }

    if (booking.status !== BOOKING_STATUS.AWAITING_PAYMENT) {
      throw new Error(`Đơn hàng chưa ở trạng thái chờ thanh toán: ${booking.status}`);
    }

    const paidAmount = Number(amount ?? booking.final_price ?? payment.amount);

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PAYMENT_STATUS.PAID,
        amount: paidAmount,
        paid_at: new Date(),
        confirmed_by: confirmedBy,
        transaction_code: transactionCode,
        settlement_status: payment.method === PAYMENT_METHOD.CASH
          ? PAYMENT_SETTLEMENT_STATUS.PENDING
          : PAYMENT_SETTLEMENT_STATUS.NOT_REQUIRED,
        settled_at: null,
        settled_by: null,
        settlement_note: null,
        ...(vnpayTxnRef !== undefined && { vnpay_txn_ref: vnpayTxnRef }),
        ...(vnpayResponseCode !== undefined && { vnpay_response_code: vnpayResponseCode }),
        failed_reason: null,
      },
    });

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: BOOKING_STATUS.COMPLETED,
        final_price: paidAmount,
      },
    });

    await tx.bookingStatusHistory.create({
      data: {
        booking_id: bookingId,
        from_status: BOOKING_STATUS.AWAITING_PAYMENT,
        to_status: BOOKING_STATUS.COMPLETED,
        changed_by: changedBy,
        note: 'Thanh toán thành công, đơn hàng đã hoàn tất',
      },
    });

    if (booking.technician_profile_id) {
      await tx.technicianProfile.update({
        where: { id: booking.technician_profile_id },
        data: { total_completed_jobs: { increment: 1 } },
      });
    }

    return { alreadyPaid: false, booking, amount: paidAmount };
  });

  if (!result.alreadyPaid) {
    await notifyPaymentSuccess(result.booking.customer_id, bookingId, result.amount);
    await notifyBookingCompleted(result.booking.customer_id, bookingId);

    if (result.booking.technician_profile_id) {
      const techProfile = await prisma.technicianProfile.findUnique({
        where: { id: result.booking.technician_profile_id },
        select: { user_id: true },
      });
      if (techProfile) {
        await notifyPaymentSuccess(techProfile.user_id, bookingId, result.amount);
      }
    }
  }

  return result;
};

module.exports = { completeBookingPayment };
