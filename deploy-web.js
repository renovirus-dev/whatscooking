// deploy-web.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 1/5: Building Expo web project...');
execSync('npx expo export --platform web', { stdio: 'inherit' });

const distDir = path.join(__dirname, 'dist');
const fontsDistDir = path.join(distDir, 'fonts');

// ── 1. Copy Vector Fonts ────────────────────────────
if (!fs.existsSync(fontsDistDir)) {
  fs.mkdirSync(fontsDistDir, { recursive: true });
}

const possibleFontPaths = [
  path.join(__dirname, 'node_modules', '@expo', 'vector-icons', 'build', 'vendor', 'react-native-vector-icons', 'Fonts'),
  path.join(__dirname, 'node_modules', 'react-native-vector-icons', 'Fonts')
];

let sourceFontsDir = possibleFontPaths.find(p => fs.existsSync(p));

if (sourceFontsDir) {
  console.log('📦 2/5: Copying icon fonts directly into dist/fonts/ ...');
  const fontFiles = fs.readdirSync(sourceFontsDir);
  fontFiles.forEach(file => {
    if (file.endsWith('.ttf')) {
      fs.copyFileSync(path.join(sourceFontsDir, file), path.join(fontsDistDir, file));
    }
  });
}

// ── 2. Find and Copy App Icon ────────────────────────
console.log('🎨 3/5: Searching for app icon...');
const possibleIconPaths = [
  path.join(__dirname, 'assets', 'icon.png'),
  path.join(__dirname, 'assets', 'adaptive-icon.png'),
  path.join(__dirname, 'assets', 'images', 'icon.png'),
  path.join(__dirname, 'assets', 'images', 'adaptive-icon.png'),
  path.join(__dirname, 'src', 'assets', 'icon.png'),
];

const sourceIcon = possibleIconPaths.find(p => fs.existsSync(p));

if (sourceIcon) {
  console.log(`✅ Found app icon at: ${sourceIcon}`);
  fs.copyFileSync(sourceIcon, path.join(distDir, 'icon.png'));
  fs.copyFileSync(sourceIcon, path.join(distDir, 'apple-touch-icon.png'));
  fs.copyFileSync(sourceIcon, path.join(distDir, 'apple-touch-icon-precomposed.png'));
  fs.copyFileSync(sourceIcon, path.join(distDir, 'favicon.png'));
  fs.copyFileSync(sourceIcon, path.join(distDir, 'icon-192.png'));
  fs.copyFileSync(sourceIcon, path.join(distDir, 'icon-512.png'));
} else {
  console.error('❌ WARNING: Could not find any icon.png in assets folder!');
}

// ── 3. Create manifest.json ─────────────────────────
const manifestContent = {
  name: "What's Cooking",
  short_name: "What's Cooking",
  start_url: "/",
  display: "standalone",
  background_color: "#FF6B35",
  theme_color: "#FF6B35",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
  ]
};
fs.writeFileSync(path.join(distDir, 'manifest.json'), JSON.stringify(manifestContent, null, 2), 'utf8');

// ── 4. Inject Meta Tags & Safe Area CSS ─────────────
console.log('✍️  4/5: Injecting fonts, PWA metadata, and safe-area styles into dist/index.html...');
const indexPath = path.join(distDir, 'index.html');

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  const pwaAndFontHead = `
    <!-- ✅ PWA & Safe Area Metadata -->
    <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="apple-touch-icon-precomposed" href="/apple-touch-icon-precomposed.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
    <link rel="manifest" href="/manifest.json" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="What's Cooking" />
    <meta name="theme-color" content="#FF6B35" />

    <!-- ✅ Self-Hosted Vector Fonts -->
    <style id="expo-vector-fonts">
      @font-face {
        font-family: 'Ionicons';
        src: url('/fonts/Ionicons.ttf') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'ionicons';
        src: url('/fonts/Ionicons.ttf') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'MaterialCommunityIcons';
        src: url('/fonts/MaterialCommunityIcons.ttf') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'Material Community Icons';
        src: url('/fonts/MaterialCommunityIcons.ttf') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'material-community';
        src: url('/fonts/MaterialCommunityIcons.ttf') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'MaterialIcons';
        src: url('/fonts/MaterialIcons.ttf') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'Material Icons';
        src: url('/fonts/MaterialIcons.ttf') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'FontAwesome';
        src: url('/fonts/FontAwesome.ttf') format('truetype');
        font-display: block;
      }
      @font-face {
        font-family: 'Feather';
        src: url('/fonts/Feather.ttf') format('truetype');
        font-display: block;
      }
    </style>

    <!-- ✅ Safe Area for iPhone Home Indicator & Orientation Support -->
    <style>
      html, body, #root {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
      }
      body {
        padding-bottom: env(safe-area-inset-bottom);
      }
      #root {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        min-height: -webkit-fill-available;
      }
    </style>
  </head>`;

  html = html.replace('</head>', pwaAndFontHead);
  fs.writeFileSync(indexPath, html, 'utf8');
}

// ── 5. Deploy to Firebase ───────────────────────────
console.log('🔥 5/5: Deploying with Safe-Area & Tab Bar updates to Firebase...');
execSync('firebase deploy --only hosting', { stdio: 'inherit' });

console.log('🎉 Done! Tab bar adjusts dynamically based on screen orientation.');