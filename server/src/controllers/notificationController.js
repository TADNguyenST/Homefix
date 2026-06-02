// ============================================================
// HOMEFIX AI — Notification Controller
// Xem danh sách thông báo, đánh dấu đã đọc
// ============================================================

const prisma = require('../utils/prisma');
const { success, error, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');

// ========================
// GET NOTIFICATIONS — Xem danh sách thông báo của user đang đăng nhập
// ========================
const getNotifications = async (req, res) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query);
    const { is_read } = req.query;

    const where = { user_id: req.user.id };
    if (is_read === 'true') where.is_read = true;
    if (is_read === 'false') where.is_read = false;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
      prisma.notification.count({ where }),
    ]);

    // Đếm số chưa đọc
    const unreadCount = await prisma.notification.count({
      where: { user_id: req.user.id, is_read: false },
    });

    return res.status(200).json({
      success: true,
      data: notifications,
      unread_count: unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    return error(res, 'Không thể tải thông báo', 500);
  }
};

// ========================
// MARK AS READ — Đánh dấu 1 thông báo đã đọc
// ========================
const markAsRead = async (req, res) => {
  try {
    const notifId = parseInt(req.params.id);

    const notif = await prisma.notification.findUnique({
      where: { id: notifId },
    });

    if (!notif || notif.user_id !== req.user.id) {
      return error(res, 'Không tìm thấy thông báo', 404);
    }

    if (notif.is_read) {
      return success(res, null, 'Thông báo đã được đọc trước đó');
    }

    await prisma.notification.update({
      where: { id: notifId },
      data: { is_read: true },
    });

    return success(res, null, 'Đánh dấu đã đọc');
  } catch (err) {
    console.error('Mark as read error:', err);
    return error(res, 'Thao tác thất bại', 500);
  }
};

// ========================
// MARK ALL AS READ — Đánh dấu tất cả đã đọc
// ========================
const markAllAsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { user_id: req.user.id, is_read: false },
      data: { is_read: true },
    });

    return success(res, null, 'Đã đánh dấu tất cả thông báo là đã đọc');
  } catch (err) {
    console.error('Mark all as read error:', err);
    return error(res, 'Thao tác thất bại', 500);
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead };

// ========================
// GET UNREAD COUNT — Đếm số thông báo chưa đọc
// ========================
const getUnreadCount = async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { user_id: req.user.id, is_read: false },
    });
    return success(res, { unread_count: count });
  } catch (err) {
    console.error('Get unread count error:', err);
    return error(res, 'Không thể đếm thông báo', 500);
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, getUnreadCount };
