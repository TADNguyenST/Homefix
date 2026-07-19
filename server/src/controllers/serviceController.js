const prisma = require('../utils/prisma');
const { success, error, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');

/**
 * GET /categories
 * Public: Lấy danh sách danh mục dịch vụ đang hoạt động.
 * Bao gồm số lượng dịch vụ active trong mỗi danh mục.
 */
const getCategories = async (req, res) => {
  try {
    const categories = await prisma.serviceCategory.findMany({
      where: { is_active: true },
      include: {
        _count: {
          select: { services: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Format response: đổi _count thành service_count cho dễ đọc
    const formattedCategories = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      icon_url: cat.icon_url,
      is_active: cat.is_active,
      service_count: cat._count.services,
    }));

    return success(res, { categories: formattedCategories });
  } catch (err) {
    console.error('Get categories error:', err);
    return error(res, 'Đã xảy ra lỗi khi lấy danh sách danh mục', 500);
  }
};

/**
 * GET /
 * Public: Lấy danh sách dịch vụ có phân trang.
 * Filter: category_id (optional), search (tìm theo tên, LIKE).
 * Chỉ trả về dịch vụ is_active=true. Bao gồm tên danh mục.
 */
const getServices = async (req, res) => {
  try {
    const { category_id, search } = req.query;
    const { skip, take, page, limit } = getPagination(req.query);

    // Xây dựng điều kiện lọc
    const where = { is_active: true };

    if (category_id) {
      where.category_id = parseInt(category_id);
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    // Đếm tổng và lấy dữ liệu song song
    const [total, services] = await Promise.all([
      prisma.service.count({ where }),
      prisma.service.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
        },
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
    ]);

    return paginated(res, services, total, page, limit);
  } catch (err) {
    console.error('Get services error:', err);
    return error(res, 'Đã xảy ra lỗi khi lấy danh sách dịch vụ', 500);
  }
};

/**
 * GET /:id
 * Public: Lấy chi tiết dịch vụ theo ID.
 * Chỉ trả về nếu is_active=true. Bao gồm thông tin danh mục.
 */
const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await prisma.service.findUnique({
      where: { id: parseInt(id) },
      include: {
        category: { select: { id: true, name: true, description: true } },
      },
    });

    if (!service) {
      return error(res, 'Dịch vụ không tồn tại', 404);
    }

    // Không trả về dịch vụ đã bị ẩn cho public
    if (!service.is_active) {
      return error(res, 'Dịch vụ không tồn tại', 404);
    }

    return success(res, { service });
  } catch (err) {
    console.error('Get service by ID error:', err);
    return error(res, 'Đã xảy ra lỗi khi lấy chi tiết dịch vụ', 500);
  }
};

/**
 * GET /device-types
 * Public: Lấy danh sách loại thiết bị đang hoạt động.
 */
const getDeviceTypes = async (req, res) => {
  try {
    const deviceTypes = await prisma.deviceType.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    return success(res, { device_types: deviceTypes });
  } catch (err) {
    console.error('Get device types error:', err);
    return error(res, 'Đã xảy ra lỗi khi lấy danh sách loại thiết bị', 500);
  }
};

/**
 * GET /popular
 * Public: Lấy danh sách 4 dịch vụ nổi bật dựa trên lượt đặt.
 */
const getPopularServices = async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      where: { is_active: true },
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: { bookings: { _count: 'desc' } },
      take: 4,
    });
    return success(res, { services });
  } catch (err) {
    console.error('Get popular services error:', err);
    return error(res, 'Đã xảy ra lỗi khi lấy danh sách dịch vụ nổi bật', 500);
  }
};

/**
 * GET /:id/reviews
 * Public: Lấy danh sách đánh giá của dịch vụ.
 */
const getServiceReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const { skip, take, page, limit } = getPagination(req.query);

    const where = {
      booking: {
        service_id: parseInt(id),
      },
    };

    const [total, reviews, stats] = await Promise.all([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        include: {
          customer: { select: { full_name: true, avatar_url: true } },
          technicianProfile: {
            include: { user: { select: { full_name: true } } }
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
      prisma.review.aggregate({
        where,
        _avg: { rating: true },
      })
    ]);

    const averageRating = stats._avg.rating ? parseFloat(stats._avg.rating.toFixed(1)) : 0;

    const formattedReviews = reviews.map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      customer_name: r.customer?.full_name || 'Khách hàng',
      customer_avatar: r.customer?.avatar_url,
      technician_name: r.technicianProfile?.user?.full_name || 'Kỹ thuật viên',
    }));

    return res.status(200).json({
      success: true,
      data: {
        reviews: formattedReviews,
        stats: {
          average_rating: averageRating,
          total_reviews: total,
        }
      },
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get service reviews error:', err);
    return error(res, 'Đã xảy ra lỗi khi lấy danh giá', 500);
  }
};

module.exports = {
  getCategories,
  getServices,
  getServiceById,
  getDeviceTypes,
  getPopularServices,
  getServiceReviews,
};
