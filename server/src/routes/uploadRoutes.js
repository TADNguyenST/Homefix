const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');
const prisma = require('../utils/prisma');
const {
  storeImage,
  getOwnedStorageKey,
  deleteStoredImage,
} = require('../services/imageStorageService');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) return cb(null, true);
  const error = new Error('Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc GIF');
  error.code = 'INVALID_IMAGE_TYPE';
  return cb(error, false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post('/', authMiddleware, roleMiddleware(['ADMIN', 'CUSTOMER', 'TECHNICIAN']), upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Không có ảnh nào được tải lên' });
  }

  try {
    const storedImage = await storeImage({
      buffer: req.file.buffer,
      ownerId: req.user.id,
      mimetype: req.file.mimetype,
    });
    return res.status(200).json({
      success: true,
      data: { url: storedImage.url, provider: storedImage.provider },
      message: storedImage.provider === 'cloudinary'
        ? 'Tải ảnh lên Cloudinary thành công'
        : 'Tải ảnh lên máy chủ thành công',
    });
  } catch (error) {
    console.error('uploadImage error:', error);
    return res.status(502).json({
      success: false,
      message: 'Không thể lưu ảnh. Vui lòng kiểm tra cấu hình Cloudinary hoặc thử lại sau.',
    });
  }
});

router.delete('/', authMiddleware, roleMiddleware(['ADMIN', 'CUSTOMER', 'TECHNICIAN']), async (req, res) => {
  const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  const storageKey = getOwnedStorageKey(rawUrl, req.user.id);
  if (!storageKey) {
    return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa ảnh này' });
  }

  const [bookingReference, serviceReference, blogReference] = await Promise.all([
    prisma.bookingImage.findFirst({ where: { image_url: rawUrl }, select: { id: true } }),
    prisma.service.findFirst({ where: { image_url: rawUrl }, select: { id: true } }),
    prisma.blog.findFirst({ where: { image_urls: { has: rawUrl } }, select: { id: true } }),
  ]);

  if (bookingReference || serviceReference || blogReference) {
    return res.status(409).json({ success: false, message: 'Ảnh đã được sử dụng nên không thể xóa' });
  }

  try {
    await deleteStoredImage(storageKey);
    return res.json({ success: true, message: 'Đã xóa ảnh chưa sử dụng' });
  } catch (error) {
    console.error('deleteUploadedImage error:', error);
    return res.status(502).json({ success: false, message: 'Không thể xóa ảnh khỏi kho lưu trữ' });
  }
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'Ảnh tải lên không được vượt quá 5 MB' });
  }
  if (error?.code === 'INVALID_IMAGE_TYPE') {
    return res.status(400).json({ success: false, message: error.message });
  }
  return next(error);
});

module.exports = router;
