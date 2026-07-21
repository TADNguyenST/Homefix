const fs = require('fs');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');

const LOCAL_UPLOAD_DIR = path.join(__dirname, '../../uploads');
const CLOUDINARY_FOLDER = 'homefix/uploads';

const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const isCloudinaryConfigured = () => Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
};

const makeOwnedName = (ownerId, mimetype) => {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const baseName = `${ownerId}-${Date.now()}-${randomPart}`;
  return {
    baseName,
    fileName: `${baseName}${MIME_EXTENSIONS[mimetype] || '.img'}`,
  };
};

const uploadToCloudinary = (buffer, ownerId) => new Promise((resolve, reject) => {
  configureCloudinary();
  const { baseName } = makeOwnedName(ownerId);
  const stream = cloudinary.uploader.upload_stream({
    folder: CLOUDINARY_FOLDER,
    public_id: baseName,
    resource_type: 'image',
    overwrite: false,
    unique_filename: false,
  }, (uploadError, result) => {
    if (uploadError) return reject(uploadError);
    return resolve({
      url: result.secure_url,
      provider: 'cloudinary',
      publicId: result.public_id,
    });
  });

  stream.end(buffer);
});

const uploadToLocal = async (buffer, ownerId, mimetype) => {
  await fs.promises.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  const { fileName } = makeOwnedName(ownerId, mimetype);
  await fs.promises.writeFile(path.join(LOCAL_UPLOAD_DIR, fileName), buffer);
  return {
    url: `/uploads/${fileName}`,
    provider: 'local',
    publicId: null,
  };
};

const storeImage = async ({ buffer, ownerId, mimetype }) => {
  if (isCloudinaryConfigured()) {
    return uploadToCloudinary(buffer, ownerId);
  }
  return uploadToLocal(buffer, ownerId, mimetype);
};

const parseCloudinaryPublicId = (rawUrl) => {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') return null;

    const parts = parsed.pathname.split('/').filter(Boolean);
    const cloudName = parts[0];
    const uploadIndex = parts.indexOf('upload');
    if (cloudName !== process.env.CLOUDINARY_CLOUD_NAME || uploadIndex < 0) return null;

    const afterUpload = parts.slice(uploadIndex + 1);
    const versionIndex = afterUpload.findIndex((part) => /^v\d+$/.test(part));
    const publicIdParts = versionIndex >= 0 ? afterUpload.slice(versionIndex + 1) : afterUpload;
    if (publicIdParts.length === 0) return null;

    const lastIndex = publicIdParts.length - 1;
    publicIdParts[lastIndex] = publicIdParts[lastIndex].replace(/\.[a-z0-9]+$/i, '');
    return decodeURIComponent(publicIdParts.join('/'));
  } catch {
    return null;
  }
};

const getOwnedStorageKey = (rawUrl, ownerId) => {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null;
  const url = rawUrl.trim();
  const publicId = parseCloudinaryPublicId(url);

  if (publicId?.startsWith(`${CLOUDINARY_FOLDER}/${ownerId}-`)) {
    return { provider: 'cloudinary', key: publicId, url };
  }

  if (url.startsWith('/uploads/')) {
    const fileName = path.basename(url);
    if (fileName.startsWith(`${ownerId}-`)) {
      return { provider: 'local', key: fileName, url: `/uploads/${fileName}` };
    }
  }

  return null;
};

const deleteStoredImage = async (storageKey) => {
  if (storageKey.provider === 'cloudinary') {
    if (!isCloudinaryConfigured()) {
      const error = new Error('CLOUDINARY_NOT_CONFIGURED');
      error.code = 'CLOUDINARY_NOT_CONFIGURED';
      throw error;
    }
    configureCloudinary();
    const result = await cloudinary.uploader.destroy(storageKey.key, {
      resource_type: 'image',
      invalidate: true,
    });
    return result.result === 'ok' || result.result === 'not found';
  }

  const filePath = path.join(LOCAL_UPLOAD_DIR, storageKey.key);
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return true;
};

module.exports = {
  storeImage,
  getOwnedStorageKey,
  deleteStoredImage,
  isCloudinaryConfigured,
  _test: {
    parseCloudinaryPublicId,
  },
};
