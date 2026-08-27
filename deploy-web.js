// deploy-web.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 1/4: Building Expo web project...');
execSync('npx expo export --platform web', { stdio: 'inherit' });

const distDir = path.join(__dirname, 'dist');
const fontsDistDir = path.join(distDir, 'fonts');

// 1. Ensure dist/fonts directory exists
if (!fs.existsSync(fontsDistDir)) {
  fs.mkdirSync(fontsDistDir, { recursive: true });
}

// 2. Find vector icon fonts in node_modules
const possiblePaths = [
  path.join(__dirname, 'node_modules', '@expo', 'vector-icons', 'build', 'vendor', 'react-native-vector-icons', 'Fonts'),
  path.join(__dirname, 'node_modules', 'react-native-vector-icons', 'Fonts')
];

let sourceFontsDir = possiblePaths.find(p => fs.existsSync(p));

if (sourceFontsDir) {
  console.log('📦 2/4: Copying icon fonts directly into dist/fonts/ ...');
  const fontFiles = fs.readdirSync(sourceFontsDir);
  fontFiles.forEach(file => {
    if (file.endsWith('.ttf')) {
      fs.copyFileSync(path.join(sourceFontsDir, file), path.join(fontsDistDir, file));
    }
  });
} else {
  console.warn('⚠️ Could not locate local font files in node_modules.');
}

// 3. Inject Local Font Styles into dist/index.html
console.log('✍️  3/4: Injecting local font styles into dist/index.html...');
const indexPath = path.join(distDir, 'index.html');

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  const localFontStyles = `
    <!-- ✅ Local Self-Hosted Vector Fonts -->
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
  </head>`;

  html = html.replace('</head>', localFontStyles);
  fs.writeFileSync(indexPath, html, 'utf8');
}

// 4. Deploy directly to Firebase Hosting
console.log('🔥 4/4: Deploying self-hosted site to Firebase...');
execSync('firebase deploy --only hosting', { stdio: 'inherit' });

console.log('🎉 Done! All fonts are self-hosted and live.');