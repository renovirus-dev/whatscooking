// fix_failed_images.js
const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const PROJECT_ROOT = __dirname;

// ✅ Different photo IDs for the 4 failed images
const IMAGES = [
  {
    url: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=400&h=300&fit=crop&q=80',
    out: 'assets/food/jamaican/sorrel_1.jpg',
    name: 'sorrel (red drink)'
  },
  {
    url: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=400&h=300&fit=crop&q=80',
    out: 'assets/food/american/fries_1.jpg',
    name: 'fries'
  },
  {
    url: 'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=400&h=300&fit=crop&q=80',
    out: 'assets/food/italian/pasta_1.jpg',
    name: 'pasta'
  },
  {
    url: 'https://images.unsplash.com/photo-1562802378-063ec186a863?w=400&h=300&fit=crop&q=80',
    out: 'assets/food/japanese/tempura_1.jpg',
    name: 'tempura/japanese'
  },
];

function download(url, relPath, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 10) return reject(new Error('Too many redirects'));

    const dest = path.join(PROJECT_ROOT, relPath);
    const dir  = path.dirname(dest);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // ✅ Delete existing file first to force fresh download
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
    }

    const file = fs.createWriteStream(dest);

    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':     'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer':    'https://unsplash.com/',
      },
    }, (res) => {
      console.log(`   Status: ${res.statusCode}`);

      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        file.close();
        try { fs.unlinkSync(dest); } catch(e) {}
        return download(res.headers.location, relPath, depth + 1)
          .then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(dest); } catch(e) {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      res.pipe(file);
      file.on('finish', () => {
        file.close();
        const size = fs.existsSync(dest) ? fs.statSync(dest).size : 0;
        if (size < 1000) {
          try { fs.unlinkSync(dest); } catch(e) {}
          reject(new Error(`Too small: ${size} bytes`));
        } else {
          resolve(dest);
        }
      });
    });

    req.on('error', (err) => {
      file.close();
      try { fs.unlinkSync(dest); } catch(e) {}
      reject(err);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function main() {
  console.log('📥 Fixing 4 failed images with new URLs...\n');

  for (const img of IMAGES) {
    console.log(`\n🔄 ${img.name}`);
    console.log(`   URL: ${img.url}`);
    console.log(`   Dest: ${img.out}`);

    try {
      const savedTo = await download(img.url, img.out);
      const size    = fs.statSync(savedTo).size;
      console.log(`   ✅ Saved! ${Math.round(size/1024)}KB`);
    } catch (err) {
      console.log(`   ❌ Failed: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  // ✅ Verify all 4 now exist
  console.log('\n📋 Verification:');
  const files = [
    'assets/food/jamaican/sorrel_1.jpg',
    'assets/food/american/fries_1.jpg',
    'assets/food/italian/pasta_1.jpg',
    'assets/food/japanese/tempura_1.jpg',
  ];

  let allGood = true;
  files.forEach(f => {
    const fullPath = path.join(PROJECT_ROOT, f);
    const exists   = fs.existsSync(fullPath);
    const size     = exists ? fs.statSync(fullPath).size : 0;
    const ok       = exists && size > 1000;
    console.log(`  ${ok ? '✅' : '❌'} ${f} ${ok ? `(${Math.round(size/1024)}KB)` : 'MISSING'}`);
    if (!ok) allGood = false;
  });

  if (allGood) {
    console.log('\n🎉 All 4 images fixed!');
    console.log('\nRun these commands:');
    console.log('  git add -f assets/food/');
    console.log('  git commit -m "fix: replace 4 failed food images"');
    console.log('  git push');
    console.log('  eas build --platform android --profile preview');
  } else {
    console.log('\n⚠️ Some still failed — trying alternative approach below...');
    console.log('Copy any working jpg from your assets folder to replace the missing ones:');
    files.forEach(f => {
      const fullPath = path.join(PROJECT_ROOT, f);
      if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size < 1000) {
        console.log(`  Missing: ${f}`);
      }
    });
  }
}

main().catch(console.error);