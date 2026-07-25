// ============================================
// FILE: src/config/cloudinary.js
// ============================================

export const CLOUDINARY_CONFIG = {
  cloudName:    'qczbnklk',
  uploadPreset: 'whats_cooking',
  apiKey:       '112633817476829',

  // ── Folder paths ──────────────────────────
  folders: {
    restaurants: 'whats_cooking/restaurants',
    menuItems:   'whats_cooking/menu_items',
    profiles:    'whats_cooking/profiles',
    menus:       'whats_cooking/menus',
  },

  // ── Base URL for transformations ──────────
  baseUrl: 'https://res.cloudinary.com/qczbnklk/image/upload',
};