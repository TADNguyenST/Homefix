// ============================================================
// HOMEFIX AI — Payment Controller
// VNPAY Sandbox (tích hợp thật) + Lịch sử thanh toán
// ============================================================

const crypto = require('crypto');
const querystring = require('querystring');
const prisma = require('../utils/prisma');
const { success, error, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const { BOOKING_STATUS, PAYMENT_STATUS, QUOTATION_STATUS } = require('../config/constants');
const { notifyPaymentSuccess } = require('../services/notificationService');

// ========================
// VNPAY CONFIG
// ========================
const VNPAY_CONFIG = {
  vnp_TmnCode: process.env.VNPAY_TMN_CODE || '',
  vnp_HashSecret: process.env.VNPAY_SECRET_KEY || '',
  vnp_Url: process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  vnp_ReturnUrl: process.env.VNPAY_RETURN_URL || 'http://localhost:5173/payment/result',
};

/**
 * Sắp xếp object theo thứ tự alphabet của key (VNPAY yêu cầu)
 */
const sortObject = (obj) => {
  const sorted = {};
  const str = [];
  let key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
  }
  return sorted;
};

// ============================================================
// POST /payments/booking/:bookingId/vnpay — Tạo URL thanh toán VNPAY
// ============================================================
const createVnpayUrl = async (req, res) => {
  try {
    const customerId = req.user.id;
    const bookingId = parseInt(req.params.bookingId);

    // 1. Validate booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });

    if (!booking) {
      return error(res, 'Đơn đặt lịch không tồn tại', 404);
    }
    if (booking.customer_id !== customerId) {
      return error(res, 'Bạn không có quyền thanh toán đơn này', 403);
    }
    if (booking.status !== BOOKING_STATUS.COMPLETED) {
      return error(res, `Chỉ thanh toán khi đơn đã hoàn thành. Trạng thái hiện tại: "${booking.status}"`, 400);
    }
    if (booking.payment_method !== 'VNPAY') {
      return error(res, 'Đơn này không sử dụng phương thức VNPAY', 400);
    }

    // 2. Validate payment record
    const payment = booking.payment;
    if (!payment) {
      return error(res, 'Không tìm thấy thông tin thanh toán', 404);
    }
    if (payment.status === PAYMENT_STATUS.PAID) {
      return error(res, 'Đơn này đã được thanh toán', 400);
    }

    // 3. Tính final_price
    let finalPrice = booking.final_price ? Number(booking.final_price) : 0;
    if (!finalPrice) {
      const acceptedQuotation = await prisma.quotation.findFirst({
        where: { booking_id: bookingId, status: QUOTATION_STATUS.ACCEPTED },
      });
      finalPrice = acceptedQuotation ? Number(acceptedQuotation.total_extra_price) : Number(booking.estimated_price);
    }

    // Cập nhật final_price vào booking
    await prisma.booking.update({
      where: { id: bookingId },
      data: { final_price: finalPrice },
    });

    // 4. Kiểm tra VNPAY đã cấu hình chưa
    if (!VNPAY_CONFIG.vnp_TmnCode || !VNPAY_CONFIG.vnp_HashSecret) {
      // === SIMULATE MODE: Không có key VNPAY → giả lập thanh toán thành công ===
      const vnpayTxnRef = `SIM_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const transactionCode = `TXN_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

      await prisma.payment.update({
        where: { booking_id: bookingId },
        data: {
          status: PAYMENT_STATUS.PAID,
          amount: finalPrice,
          paid_at: new Date(),
          transaction_code: transactionCode,
          vnpay_txn_ref: vnpayTxnRef,
          vnpay_response_code: '00',
        },
      });

      await notifyPaymentSuccess(customerId, bookingId, finalPrice);

      if (booking.technician_profile_id) {
        const techProfile = await prisma.technicianProfile.findUnique({
          where: { id: booking.technician_profile_id },
          select: { user_id: true },
        });
        if (techProfile) {
          await notifyPaymentSuccess(techProfile.user_id, bookingId, finalPrice);
        }
      }

      return success(res, {
        mode: 'SIMULATE',
        vnpay_txn_ref: vnpayTxnRef,
        transaction_code: transactionCode,
        amount: finalPrice,
        message: 'VNPAY chưa cấu hình → Thanh toán mô phỏng thành công.',
      }, 'Thanh toán thành công (mô phỏng)');
    }

    // === REAL VNPAY SANDBOX MODE ===
    // 5. Tạo mã giao dịch duy nhất
    const vnpTxnRef = `HF${bookingId}_${Date.now()}`;

    // Cập nhật payment với txn_ref để callback đối chiếu
    await prisma.payment.update({
      where: { booking_id: bookingId },
      data: {
        status: PAYMENT_STATUS.PENDING,
        amount: finalPrice,
        vnpay_txn_ref: vnpTxnRef,
      },
    });

    // 6. Tạo VNPAY Payment URL
    const date = new Date();
    const createDate = date.toISOString().replace(/[-T:\.Z]/g, '').slice(0, 14); // YYYYMMDDHHmmss

    let vnp_Params = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: VNPAY_CONFIG.vnp_TmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: vnpTxnRef,
      vnp_OrderInfo: `Thanh toan don hang HomeFix #${bookingId}`,
      vnp_OrderType: 'other',
      vnp_Amount: Math.round(finalPrice * 100), // VNPAY yêu cầu nhân 100 (đơn vị: đồng * 100)
      vnp_ReturnUrl: VNPAY_CONFIG.vnp_ReturnUrl,
      vnp_IpAddr: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
      vnp_CreateDate: createDate,
    };

    // Sắp xếp alphabet
    vnp_Params = sortObject(vnp_Params);

    // Tạo chữ ký (Secure Hash)
    const signData = querystring.stringify(vnp_Params, '&', '=', { encodeURIComponent: (str) => str });
    const hmac = crypto.createHmac('sha512', VNPAY_CONFIG.vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    vnp_Params['vnp_SecureHash'] = signed;

    // Tạo full URL
    const paymentUrl = `${VNPAY_CONFIG.vnp_Url}?${querystring.stringify(vnp_Params)}`;

    return success(res, {
      mode: 'VNPAY_SANDBOX',
      payment_url: paymentUrl,
      vnpay_txn_ref: vnpTxnRef,
      amount: finalPrice,
    }, 'Tạo link thanh toán VNPAY thành công. Vui lòng redirect người dùng đến payment_url.');
  } catch (err) {
    console.error('createVnpayUrl error:', err);
    return error(res, 'Lỗi khi tạo link thanh toán VNPAY', 500);
  }
};

// ============================================================
// GET /payments/vnpay-return — VNPAY redirect về sau khi thanh toán
// Đây là URL mà VNPAY redirect khách hàng về (vnp_ReturnUrl)
// ============================================================
const vnpayReturn = async (req, res) => {
  try {
    let vnp_Params = { ...req.query };
    const secureHash = vnp_Params['vnp_SecureHash'];

    // Xóa hash ra để verify
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);

    // Verify chữ ký
    const signData = querystring.stringify(vnp_Params, '&', '=', { encodeURIComponent: (str) => str });
    const hmac = crypto.createHmac('sha512', VNPAY_CONFIG.vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash !== signed) {
      return error(res, 'Chữ ký không hợp lệ. Giao dịch có thể bị giả mạo.', 400);
    }

    const vnpTxnRef = vnp_Params['vnp_TxnRef'];
    const vnpResponseCode = vnp_Params['vnp_ResponseCode'];
    const vnpTransactionNo = vnp_Params['vnp_TransactionNo'];

    // Tìm payment theo vnpay_txn_ref
    const payment = await prisma.payment.findFirst({
      where: { vnpay_txn_ref: vnpTxnRef },
      include: { booking: true },
    });

    if (!payment) {
      return error(res, 'Không tìm thấy giao dịch', 404);
    }

    // Đã xử lý rồi thì bỏ qua
    if (payment.status === PAYMENT_STATUS.PAID) {
      return success(res, {
        booking_id: payment.booking_id,
        status: 'ALREADY_PAID',
      }, 'Giao dịch đã được xử lý trước đó');
    }

    if (vnpResponseCode === '00') {
      // === THANH TOÁN THÀNH CÔNG ===
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PAYMENT_STATUS.PAID,
          paid_at: new Date(),
          transaction_code: vnpTransactionNo,
          vnpay_response_code: vnpResponseCode,
        },
      });

      // Gửi thông báo
      await notifyPaymentSuccess(payment.booking.customer_id, payment.booking_id, Number(payment.amount));

      if (payment.booking.technician_profile_id) {
        const techProfile = await prisma.technicianProfile.findUnique({
          where: { id: payment.booking.technician_profile_id },
          select: { user_id: true },
        });
        if (techProfile) {
          await notifyPaymentSuccess(techProfile.user_id, payment.booking_id, Number(payment.amount));
        }
      }

      return success(res, {
        booking_id: payment.booking_id,
        status: 'SUCCESS',
        amount: Number(payment.amount),
        transaction_code: vnpTransactionNo,
      }, 'Thanh toán VNPAY thành công!');
    } else {
      // === THANH TOÁN THẤT BẠI ===
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PAYMENT_STATUS.FAILED,
          vnpay_response_code: vnpResponseCode,
          failed_reason: `VNPAY response code: ${vnpResponseCode}`,
        },
      });

      return error(res, `Thanh toán thất bại. Mã lỗi VNPAY: ${vnpResponseCode}`, 400);
    }
  } catch (err) {
    console.error('vnpayReturn error:', err);
    return error(res, 'Lỗi khi xử lý kết quả thanh toán VNPAY', 500);
  }
};

// ============================================================
// GET /payments/vnpay-ipn — VNPAY IPN (Instant Payment Notification)
// VNPAY gọi ngầm server-to-server để xác nhận
// ============================================================
const vnpayIpn = async (req, res) => {
  try {
    let vnp_Params = { ...req.query };
    const secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);

    const signData = querystring.stringify(vnp_Params, '&', '=', { encodeURIComponent: (str) => str });
    const hmac = crypto.createHmac('sha512', VNPAY_CONFIG.vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash !== signed) {
      return res.status(200).json({ RspCode: '97', Message: 'Invalid signature' });
    }

    const vnpTxnRef = vnp_Params['vnp_TxnRef'];
    const vnpResponseCode = vnp_Params['vnp_ResponseCode'];
    const vnpTransactionNo = vnp_Params['vnp_TransactionNo'];

    const payment = await prisma.payment.findFirst({
      where: { vnpay_txn_ref: vnpTxnRef },
    });

    if (!payment) {
      return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
    }

    if (payment.status === PAYMENT_STATUS.PAID) {
      return res.status(200).json({ RspCode: '02', Message: 'Already confirmed' });
    }

    if (vnpResponseCode === '00') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PAYMENT_STATUS.PAID,
          paid_at: new Date(),
          transaction_code: vnpTransactionNo,
          vnpay_response_code: vnpResponseCode,
        },
      });
      return res.status(200).json({ RspCode: '00', Message: 'Confirm success' });
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PAYMENT_STATUS.FAILED,
          vnpay_response_code: vnpResponseCode,
          failed_reason: `VNPAY IPN response: ${vnpResponseCode}`,
        },
      });
      return res.status(200).json({ RspCode: '00', Message: 'Confirm success' });
    }
  } catch (err) {
    console.error('vnpayIpn error:', err);
    return res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
  }
};

// ============================================================
// GET /payments/history — Lịch sử thanh toán (CUSTOMER)
// ============================================================
const getPaymentHistory = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { method, status } = req.query;
    const { skip, take, page, limit } = getPagination(req.query);

    const where = {
      booking: { customer_id: customerId },
    };

    if (method) where.method = method;
    if (status) where.status = status;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          booking: {
            select: {
              id: true,
              booking_date: true,
              status: true,
              estimated_price: true,
              final_price: true,
              service: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return paginated(res, payments, total, page, limit);
  } catch (err) {
    console.error('getPaymentHistory error:', err);
    return error(res, 'Lỗi khi lấy lịch sử thanh toán', 500);
  }
};

module.exports = {
  createVnpayUrl,
  vnpayReturn,
  vnpayIpn,
  getPaymentHistory,
};
