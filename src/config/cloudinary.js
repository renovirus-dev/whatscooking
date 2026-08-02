// FILE: src/config/cloudinary.js
// Update to use env vars too:

export const CLOUDINARY_CONFIG = {
  cloudName:    process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME    || 'qczbnklk',
  uploadPreset: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'whats_cooking',
  apiKey:       process.env.EXPO_PUBLIC_CLOUDINARY_API_KEY       || '112633817476829',

  folders: {
    restaurants: 'whats_cooking/restaurants',
    menuItems:   'whats_cooking/menu_items',
    profiles:    'whats_cooking/profiles',
    menus:       'whats_cooking/menus',
  },

  baseUrl: `https://res.cloudinary.com/${
    process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'qczbnklk'
  }/image/upload`,
};