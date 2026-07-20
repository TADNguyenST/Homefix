const prisma = require('../utils/prisma');
const { success, error, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');

// 1. Lấy danh sách Blog cho khách (chỉ lấy bài đã xuất bản)
const getPublicBlogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { skip, take } = getPagination(page, limit);

    const [total, blogs] = await Promise.all([
      prisma.blog.count({ where: { is_published: true } }),
      prisma.blog.findMany({
        where: { is_published: true },
        select: {
          id: true,
          title: true,
          slug: true,
          image_urls: true,
          is_published: true,
          created_at: true,
          author: {
            select: { id: true, full_name: true }
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
    ]);

    return paginated(res, blogs, total, page, limit);
  } catch (err) {
    console.error('getPublicBlogs error:', err);
    return error(res, 'Không thể tải danh sách bài viết', 500);
  }
};

// 2. Lấy chi tiết Blog theo Slug (cho khách)
const getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const blog = await prisma.blog.findUnique({
      where: { slug },
      include: {
        author: {
          select: { id: true, full_name: true, avatar_url: true }
        }
      }
    });

    if (!blog || !blog.is_published) {
      return error(res, 'Bài viết không tồn tại hoặc đã bị ẩn', 404);
    }

    return success(res, blog);
  } catch (err) {
    console.error('getBlogBySlug error:', err);
    return error(res, 'Lỗi khi tải chi tiết bài viết', 500);
  }
};

// 3. Lấy toàn bộ Blog (cho Admin - kể cả chưa xuất bản)
const getAllBlogsAdmin = async (req, res) => {
  try {
    const blogs = await prisma.blog.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        author: {
          select: { id: true, full_name: true }
        }
      }
    });

    return success(res, blogs);
  } catch (err) {
    console.error('getAllBlogsAdmin error:', err);
    return error(res, 'Không thể tải danh sách bài viết', 500);
  }
};

// 4. Admin tạo mới Blog
const createBlog = async (req, res) => {
  try {
    const { title, slug, content, image_urls, is_published } = req.body;

    const existingSlug = await prisma.blog.findUnique({ where: { slug } });
    if (existingSlug) {
      return error(res, 'Đường dẫn (slug) đã tồn tại, vui lòng chọn đường dẫn khác', 400);
    }

    const blog = await prisma.blog.create({
      data: {
        title,
        slug,
        content,
        image_urls,
        is_published: is_published !== undefined ? is_published : true,
        author_id: req.user.id
      },
    });

    return success(res, blog, 'Tạo bài viết thành công', 201);
  } catch (err) {
    console.error('createBlog error:', err);
    return error(res, 'Lỗi khi tạo bài viết', 500);
  }
};

// 5. Admin cập nhật Blog
const updateBlog = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, slug, content, image_urls, is_published } = req.body;

    // Kiểm tra trùng slug nếu có đổi slug
    if (slug) {
      const existingSlug = await prisma.blog.findFirst({
        where: { slug, NOT: { id } }
      });
      if (existingSlug) {
        return error(res, 'Đường dẫn (slug) đã tồn tại', 400);
      }
    }

    const updatedBlog = await prisma.blog.update({
      where: { id },
      data: {
        title,
        slug,
        content,
        image_urls,
        is_published
      },
    });

    return success(res, updatedBlog, 'Cập nhật bài viết thành công');
  } catch (err) {
    console.error('updateBlog error:', err);
    return error(res, 'Lỗi khi cập nhật bài viết', 500);
  }
};

// 6. Admin xóa Blog
const deleteBlog = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    await prisma.blog.delete({ where: { id } });

    return success(res, null, 'Đã xóa bài viết thành công');
  } catch (err) {
    console.error('deleteBlog error:', err);
    return error(res, 'Lỗi khi xóa bài viết', 500);
  }
};

module.exports = {
  getPublicBlogs,
  getBlogBySlug,
  getAllBlogsAdmin,
  createBlog,
  updateBlog,
  deleteBlog
};
