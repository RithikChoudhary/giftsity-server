const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Upload an image to Cloudinary with automatic optimization
 * @param {string} imageData - base64 data URI or URL
 * @param {object} options - override defaults (folder, transformation, etc.)
 */
const uploadImage = async (imageData, options = {}) => {
  if (!imageData || typeof imageData !== 'string') throw new Error('Invalid image data: expected a base64 string or URL');
  const defaults = {
    folder: 'giftsity',
    resource_type: 'image',
    transformation: [
      { width: 800, height: 800, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' }
    ]
  };
  const result = await cloudinary.uploader.upload(imageData, { ...defaults, ...options });
  return { url: result.secure_url, publicId: result.public_id };
};

/**
 * Upload a video to Cloudinary with video-specific settings
 * @param {string} videoData - base64 data URI or URL
 * @param {object} options - override defaults (folder, etc.)
 */
const uploadVideo = async (videoData, options = {}) => {
  if (!videoData || typeof videoData !== 'string') throw new Error('Invalid video data: expected a base64 string or URL');
  const defaults = {
    folder: 'giftsity',
    resource_type: 'video',
    // Optimize video: max 720p, auto quality, limit to 60MB
    transformation: [
      { width: 1280, height: 720, crop: 'limit', quality: 'auto' }
    ],
    eager: [
      // Generate a thumbnail from the video
      { width: 400, height: 400, crop: 'fill', gravity: 'auto', format: 'jpg' }
    ],
    eager_async: true
  };
  const result = await cloudinary.uploader.upload(videoData, { ...defaults, ...options });
  // Thumbnail URL: replace extension with .jpg and add transformation
  const thumbnailUrl = result.eager?.[0]?.secure_url ||
    result.secure_url.replace(/\.[^.]+$/, '.jpg');
  return {
    url: result.secure_url,
    publicId: result.public_id,
    thumbnailUrl,
    duration: result.duration || 0,
    width: result.width || 0,
    height: result.height || 0
  };
};

/**
 * Delete an image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 */
const deleteImage = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete error:', err.message);
  }
};

/**
 * Delete a video from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 */
const deleteVideo = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
  } catch (err) {
    console.error('Cloudinary video delete error:', err.message);
  }
};

/**
 * Delete any media (auto-detects image vs video by publicId or explicit type)
 * @param {string} publicId - Cloudinary public ID
 * @param {string} mediaType - 'image' or 'video'
 */
const deleteMedia = async (publicId, mediaType = 'image') => {
  if (!publicId) return;
  if (mediaType === 'video') {
    return deleteVideo(publicId);
  }
  return deleteImage(publicId);
};

module.exports = { cloudinary, uploadImage, uploadVideo, deleteImage, deleteVideo, deleteMedia };
