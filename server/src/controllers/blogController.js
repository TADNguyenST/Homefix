const prisma = require('../utils/prisma');
const { success, error, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');

const normalizeBlogInput = (body) => {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const slug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  const imageUrls = Array.isArray(body?.image_urls)
    ? [...new Set(body.image_urls.filter((url) => typeof url === 'string').map((url) => url.trim()).filter(Boolean))]
    : [];

  if (title.length < 5 || title.length > 255) return { message: 'Tieu de phai co tu 5 den 255 ky tu' };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 255) {
    return { message: 'Slug chi gom chu thuong, so va dau gach ngang' };
  }
  if (content.length < 20 || content.length > 100000) {
    return { message: 'Noi dung phai co tu 20 den 100000 ky tu' };
  }
  if (imageUrls.length > 3) return { message: 'Moi bai viet chi duoc toi da 3 anh' };
  if (imageUrls.some((url) => !url.startsWith('/uploads/') && !/^https:\/\//i.test(url))) {
    return { message: 'Duong dan anh khong hop le' };
  }

  return {
    data: {
      title,
      slug,
      content,
      image_urls: imageUrls,
      is_published: body?.is_published !== false,
    },
  };
};

const getPublicBlogs = async (req, res) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query);
    const where = { is_published: true };
    const [total, blogs] = await Promise.all([
      prisma.blog.count({ where }),
      prisma.blog.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          content: true,
          image_urls: true,
          is_published: true,
          created_at: true,
          author: { select: { id: true, full_name: true, avatar_url: true } },
        },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
    ]);

    return paginated(res, blogs, total, page, limit);
  } catch (err) {
    console.error('getPublicBlogs error:', err);
    return error(res, 'Khong the tai danh sach bai viet', 500);
  }
};

const getBlogBySlug = async (req, res) => {
  try {
    const slug = typeof req.params.slug === 'string' ? req.params.slug.trim().toLowerCase() : '';
    const blog = await prisma.blog.findFirst({
      where: { slug, is_published: true },
      include: { author: { select: { id: true, full_name: true, avatar_url: true } } },
    });

    if (!blog) return error(res, 'Bai viet khong ton tai hoac da bi an', 404);
    return success(res, blog);
  } catch (err) {
    console.error('getBlogBySlug error:', err);
    return error(res, 'Khong the tai chi tiet bai viet', 500);
  }
};

const getAllBlogsAdmin = async (req, res) => {
  try {
    const blogs = await prisma.blog.findMany({
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      include: { author: { select: { id: true, full_name: true } } },
    });
    return success(res, blogs);
  } catch (err) {
    console.error('getAllBlogsAdmin error:', err);
    return error(res, 'Khong the tai danh sach bai viet', 500);
  }
};

const createBlog = async (req, res) => {
  try {
    const normalized = normalizeBlogInput(req.body);
    if (!normalized.data) return error(res, normalized.message, 400);

    const existingSlug = await prisma.blog.findUnique({ where: { slug: normalized.data.slug } });
    if (existingSlug) return error(res, 'Slug da ton tai', 409);

    const blog = await prisma.blog.create({
      data: { ...normalized.data, author_id: req.user.id },
    });
    return success(res, blog, 'Tao bai viet thanh cong', 201);
  } catch (err) {
    if (err.code === 'P2002') return error(res, 'Slug da ton tai', 409);
    console.error('createBlog error:', err);
    return error(res, 'Khong the tao bai viet', 500);
  }
};

const updateBlog = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return error(res, 'Ma bai viet khong hop le', 400);

    const normalized = normalizeBlogInput(req.body);
    if (!normalized.data) return error(res, normalized.message, 400);

    const duplicate = await prisma.blog.findFirst({
      where: { slug: normalized.data.slug, NOT: { id } },
      select: { id: true },
    });
    if (duplicate) return error(res, 'Slug da ton tai', 409);

    const blog = await prisma.blog.update({ where: { id }, data: normalized.data });
    return success(res, blog, 'Cap nhat bai viet thanh cong');
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Bai viet khong ton tai', 404);
    if (err.code === 'P2002') return error(res, 'Slug da ton tai', 409);
    console.error('updateBlog error:', err);
    return error(res, 'Khong the cap nhat bai viet', 500);
  }
};

const deleteBlog = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return error(res, 'Ma bai viet khong hop le', 400);
    await prisma.blog.delete({ where: { id } });
    return success(res, null, 'Xoa bai viet thanh cong');
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Bai viet khong ton tai', 404);
    console.error('deleteBlog error:', err);
    return error(res, 'Khong the xoa bai viet', 500);
  }
};

module.exports = {
  getPublicBlogs,
  getBlogBySlug,
  getAllBlogsAdmin,
  createBlog,
  updateBlog,
  deleteBlog,
};
