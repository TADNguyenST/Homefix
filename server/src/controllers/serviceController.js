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

module.exports = {
  getCategories,
  getServices,
  getServiceById,
  getDeviceTypes,
};
