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
const { completeBookingPayment } = require('../services/paymentCompletionService');
const { calculatePayableAmount } = require('../utils/pricing');

// ========================
// VNPAY CONFIG
// ========================
const VNPAY_CONFIG = {
  enabled: process.env.VNPAY_ENABLE_REAL === 'true',
  vnp_TmnCode: process.env.VNPAY_TMN_CODE || '',
  vnp_HashSecret: process.env.VNPAY_SECRET_KEY || '',
  vnp_Url: process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  vnp_ReturnUrl: process.env.VNPAY_RETURN_URL || 'http://localhost:5173/payment-result',
};

const isVnpayReady = () =>
  VNPAY_CONFIG.enabled && VNPAY_CONFIG.vnp_TmnCode && VNPAY_CONFIG.vnp_HashSecret;

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
    if (booking.status !== BOOKING_STATUS.AWAITING_PAYMENT) {
      return error(res, `Chỉ thanh toán khi đơn đang chờ thanh toán. Trạng thái hiện tại: "${booking.status}"`, 400);
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
    let finalPrice = 0;
    if (!finalPrice) {
      const acceptedQuotation = await prisma.quotation.findFirst({
        where: { booking_id: bookingId, status: QUOTATION_STATUS.ACCEPTED },
      });
      finalPrice = acceptedQuotation
        ? calculatePayableAmount(acceptedQuotation.total_extra_price, booking.discount_amount)
        : Number(booking.final_price || booking.estimated_price || 0);
    }

    // Cập nhật final_price vào booking
    await prisma.booking.update({
      where: { id: bookingId },
      data: { final_price: finalPrice },
    });

    // 4. Demo/dev mac dinh thanh toan mo phong. Chi redirect VNPAY khi bat co VNPAY_ENABLE_REAL=true.
    if (!isVnpayReady()) {
      // === SIMULATE MODE: Không có key VNPAY → giả lập thanh toán thành công ===
      const vnpayTxnRef = `SIM_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const transactionCode = `TXN_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

      await completeBookingPayment({
        bookingId,
        amount: finalPrice,
        changedBy: customerId,
        transactionCode,
        vnpayTxnRef,
        vnpayResponseCode: '00',
      });

      return success(res, {
        mode: 'SIMULATE',
        vnpay_txn_ref: vnpayTxnRef,
        transaction_code: transactionCode,
        amount: finalPrice,
        message: 'VNPAY đang ở chế độ mô phỏng. Thanh toán đã được ghi nhận thành công.',
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
    const paidAmount = Number(vnp_Params['vnp_Amount']) / 100;

    // Tìm payment theo vnpay_txn_ref
    const payment = await prisma.payment.findFirst({
      where: { vnpay_txn_ref: vnpTxnRef },
      include: { booking: true },
    });

    if (!payment) {
      return error(res, 'Không tìm thấy giao dịch', 404);
    }
    if (paidAmount !== Number(payment.amount)) {
      return error(res, 'Số tiền thanh toán không khớp với đơn hàng', 400);
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
      await completeBookingPayment({
        bookingId: payment.booking_id,
        amount: paidAmount,
        changedBy: payment.booking.customer_id,
        transactionCode: vnpTransactionNo,
        vnpayTxnRef: vnpTxnRef,
        vnpayResponseCode: vnpResponseCode,
      });

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
    const paidAmount = Number(vnp_Params['vnp_Amount']) / 100;

    const payment = await prisma.payment.findFirst({
      where: { vnpay_txn_ref: vnpTxnRef },
      include: { booking: { select: { customer_id: true } } },
    });

    if (!payment) {
      return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
    }
    if (paidAmount !== Number(payment.amount)) {
      return res.status(200).json({ RspCode: '04', Message: 'Invalid amount' });
    }

    if (payment.status === PAYMENT_STATUS.PAID) {
      return res.status(200).json({ RspCode: '02', Message: 'Already confirmed' });
    }

    if (vnpResponseCode === '00') {
      await completeBookingPayment({
        bookingId: payment.booking_id,
        amount: paidAmount,
        changedBy: payment.booking.customer_id,
        transactionCode: vnpTransactionNo,
        vnpayTxnRef: vnpTxnRef,
        vnpayResponseCode: vnpResponseCode,
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
