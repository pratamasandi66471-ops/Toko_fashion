const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadRoot = path.join(__dirname, '..', '..', 'public', 'uploads', 'products');
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

fs.mkdirSync(uploadRoot, { recursive: true });

function sanitizeBaseName(filename) {
  const parsed = path.parse(filename || 'product-image');
  const safeBase = parsed.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return safeBase || 'product-image';
}

function extensionFromMime(mimetype) {
  if (mimetype === 'image/png') return '.png';
  if (mimetype === 'image/webp') return '.webp';
  return '.jpg';
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadRoot);
  },
  filename(_req, file, cb) {
    const basename = sanitizeBaseName(file.originalname);
    const extension = extensionFromMime(file.mimetype);
    cb(null, `${Date.now()}-${basename}${extension}`);
  },
});

function imageFileFilter(_req, file, cb) {
  if (!allowedMimeTypes.has(file.mimetype)) {
    const error = new Error('Format gambar harus JPG, PNG, atau WEBP.');
    error.code = 'INVALID_PRODUCT_IMAGE_TYPE';
    cb(error);
    return;
  }

  cb(null, true);
}

const uploadProductImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

module.exports = {
  uploadProductImage,
};
