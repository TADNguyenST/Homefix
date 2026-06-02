// ============================================================
// HOMEFIX AI — Complaint Controller
// Khách gửi khiếu nại, Admin xử lý khiếu nại
// ============================================================

const prisma = require('../utils/prisma');
const { success, error, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const { BOOKING_STATUS, COMPLAINT_STATUS, ROLES } = require('../config/constants');
const { notifyNewComplaint, notifyComplaintResolved } = require('../services/notificationService');
const { analyzeSentiment } = require('../services/aiService');

// ========================
// CREATE COMPLAINT — Khách gửi khiếu nại
// ========================
const createComplaint = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    const { subject, description } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return error(res, 'Không tìm thấy đơn hàng', 404);
    }

    if (booking.customer_id !== req.user.id) {
      return error(res, 'Bạn không có quyền khiếu nại đơn này', 403);
    }

    // Chỉ cho phép khiếu nại đơn đã hoàn thành hoặc bị hủy
    const allowedStatuses = [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED];
    if (!allowedStatuses.includes(booking.status)) {
      return error(res, 'Chỉ có thể khiếu nại đơn đã hoàn thành hoặc bị hủy', 400);
    }

    const aiSentiment = await analyzeSentiment(`${subject}. ${description}`);

    const complaint = await prisma.complaint.create({
      data: {
        booking_id: bookingId,
        customer_id: req.user.id,
        subject,
        description,
        ai_sentiment: aiSentiment,
        status: COMPLAINT_STATUS.OPEN,
      },
    });

    // Gửi thông báo cho tất cả Admin
    const admins = await prisma.user.findMany({
      where: { role: ROLES.ADMIN, is_active: true },
      select: { id: true },
    });
    const customer = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { full_name: true },
    });
    await notifyNewComplaint(admins.map(a => a.id), complaint.id, customer.full_name);

    return success(res, complaint, 'Gửi khiếu nại thành công. Chúng tôi sẽ xử lý trong thời gian sớm nhất.', 201);
  } catch (err) {
    console.error('Create complaint error:', err);
    return error(res, 'Gửi khiếu nại thất bại', 500);
  }
};

// ========================
// GET MY COMPLAINTS — Khách xem danh sách khiếu nại của mình
// ========================
const getMyComplaints = async (req, res) => {
  try {
    const complaints = await prisma.complaint.findMany({
      where: { customer_id: req.user.id },
      include: {
        booking: { select: { id: true, service: { select: { name: true } } } },
      },
      orderBy: { created_at: 'desc' },
    });

    return success(res, complaints);
  } catch (err) {
    console.error('Get my complaints error:', err);
    return error(res, 'Không thể tải danh sách khiếu nại', 500);
  }
};

// ========================
// RESOLVE COMPLAINT — Admin xử lý khiếu nại (Giải quyết hoặc Từ chối)
// ========================
const resolveComplaint = async (req, res) => {
  try {
    const complaintId = parseInt(req.params.id);
    const { admin_response, status } = req.body; // status: 'RESOLVED' hoặc 'REJECTED'

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
    });

    if (!complaint) {
      return error(res, 'Không tìm thấy khiếu nại', 404);
    }

    if (complaint.status === COMPLAINT_STATUS.RESOLVED || complaint.status === COMPLAINT_STATUS.REJECTED) {
      return error(res, 'Khiếu nại này đã được xử lý trước đó', 400);
    }

    const updated = await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        admin_response,
        status,
        resolved_at: new Date(),
      },
    });

    // Gửi thông báo cho khách
    await notifyComplaintResolved(complaint.customer_id, complaintId, status);

    const label = status === 'RESOLVED' ? 'giải quyết' : 'từ chối';
    return success(res, updated, `Đã ${label} khiếu nại thành công`);
  } catch (err) {
    console.error('Resolve complaint error:', err);
    return error(res, 'Xử lý khiếu nại thất bại', 500);
  }
};

module.exports = { createComplaint, getMyComplaints, resolveComplaint };
