const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer Storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'homefix', // The folder name in Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'],
    // format: async (req, file) => 'png', // Optional: force format
    // public_id: (req, file) => 'computed-filename-using-request',
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// POST /api/upload — Upload single image
router.post('/', authMiddleware, roleMiddleware(['ADMIN', 'CUSTOMER', 'TECHNICIAN']), upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Không có file nào được upload' });
  }

  // req.file.path contains the URL to the uploaded image in Cloudinary
  const imageUrl = req.file.path;
  
  return res.status(200).json({
    success: true,
    data: { url: imageUrl },
    message: 'Upload ảnh thành công',
  });
});

module.exports = router;
