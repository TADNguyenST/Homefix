const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');
const prisma = require('../utils/prisma');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.id}-${uniqueSuffix}${ext.toLowerCase()}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file ảnh (JPEG, PNG, WebP, GIF)'), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// POST /api/upload — Upload single image for service images and booking evidence
router.post('/', authMiddleware, roleMiddleware(['ADMIN', 'CUSTOMER', 'TECHNICIAN']), upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Không có file nào được upload' });
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  return res.status(200).json({
    success: true,
    data: { url: imageUrl },
    message: 'Upload ảnh thành công',
  });
});

// Xoa anh tam chua duoc gan vao booking/dich vu. Ten file co user ID de ngan xoa file cua nguoi khac.
router.delete('/', authMiddleware, roleMiddleware(['ADMIN', 'CUSTOMER', 'TECHNICIAN']), async (req, res) => {
  const rawUrl = typeof req.body?.url === 'string' ? req.body.url : '';
  const filename = path.basename(rawUrl);
  const expectedPrefix = `${req.user.id}-`;

  if (!rawUrl.startsWith('/uploads/') || !filename.startsWith(expectedPrefix)) {
    return res.status(403).json({ success: false, message: 'Ban khong co quyen xoa anh nay' });
  }

  const imageUrl = `/uploads/${filename}`;
  const [bookingReference, serviceReference] = await Promise.all([
    prisma.bookingImage.findFirst({ where: { image_url: imageUrl }, select: { id: true } }),
    prisma.service.findFirst({ where: { image_url: { endsWith: imageUrl } }, select: { id: true } }),
  ]);

  if (bookingReference || serviceReference) {
    return res.status(409).json({ success: false, message: 'Anh da duoc su dung nen khong the xoa' });
  }

  const filePath = path.join(uploadDir, filename);
  if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
  return res.json({ success: true, message: 'Da xoa anh tam' });
});

module.exports = router;
