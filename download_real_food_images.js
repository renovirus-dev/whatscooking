// download_real_food_images.js
// Run: node download_real_food_images.js
const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const PROJECT_ROOT = __dirname;

// ✅ Paste your FREE Pexels API key here
// Get one free at: https://www.pexels.com/api/
const PEXELS_API_KEY = 'AcHGkp91DKUMLWIhprXmCW89LjXxo76DVsNVOKJqS73a41tairiQLeJG';

// ✅ Search terms for each image file
// Pexels will find the best real food photo
const IMAGE_SEARCHES = [
  // ── Jamaican ─────────────────────────────
  { search: 'jerk chicken caribbean',         out: 'assets/food/jamaican/jerk_1.jpg'        },
  { search: 'oxtail stew caribbean',          out: 'assets/food/jamaican/oxtail_1.jpg'      },
  { search: 'ackee saltfish jamaican',        out: 'assets/food/jamaican/ackee_1.jpg'       },
  { search: 'fried plantain caribbean',       out: 'assets/food/jamaican/plantain_1.jpg'    },
  { search: 'fried dumpling caribbean bread', out: 'assets/food/jamaican/dumpling_1.jpg'    },
  { search: 'meat pastry patty caribbean',    out: 'assets/food/jamaican/patty_1.jpg'       },
  { search: 'green spinach callaloo dish',    out: 'assets/food/jamaican/callaloo_1.jpg'    },
  { search: 'fried fish caribbean escovitch', out: 'assets/food/jamaican/escovitch_1.jpg'   },
  { search: 'red hibiscus drink sorrel',      out: 'assets/food/jamaican/sorrel_1.jpg'      },
  { search: 'rice beans peas caribbean',      out: 'assets/food/jamaican/rice_peas_1.jpg'   },
  { search: 'flatbread cassava bammy',        out: 'assets/food/jamaican/bammy_1.jpg'       },

  // ── American ─────────────────────────────
  { search: 'beef hamburger burger',          out: 'assets/food/american/burger_1.jpg'      },
  { search: 'grilled ribeye steak',           out: 'assets/food/american/steak_1.jpg'       },
  { search: 'chicken wings bbq',              out: 'assets/food/american/wings_1.jpg'       },
  { search: 'french fries potato',            out: 'assets/food/american/fries_1.jpg'       },
  { search: 'sandwich sub bread',             out: 'assets/food/american/sandwich_1.jpg'    },
  { search: 'hot dog sausage',                out: 'assets/food/american/hotdog_1.jpg'      },

  // ── Italian ──────────────────────────────
  { search: 'pizza italian margherita',       out: 'assets/food/italian/pizza_1.jpg'        },
  { search: 'pasta spaghetti italian',        out: 'assets/food/italian/pasta_1.jpg'        },
  { search: 'lasagna italian baked',          out: 'assets/food/italian/lasagna_1.jpg'      },

  // ── Japanese ─────────────────────────────
  { search: 'sushi rolls japanese',           out: 'assets/food/japanese/sushi_1.jpg'       },
  { search: 'ramen noodle soup japanese',     out: 'assets/food/japanese/ramen_1.jpg'       },
  { search: 'tempura japanese fried',         out: 'assets/food/japanese/tempura_1.jpg'     },

  // ── Mexican ──────────────────────────────
  { search: 'taco mexican street food',       out: 'assets/food/mexican/taco_1.jpg'         },
  { search: 'burrito mexican wrap',           out: 'assets/food/mexican/burrito_1.jpg'      },
  { search: 'nachos cheese chips',            out: 'assets/food/mexican/nachos_1.jpg'       },

  // ── Indian ───────────────────────────────
  { search: 'chicken curry indian spices',    out: 'assets/food/indian/curry_1.jpg'         },
  { search: 'biryani rice indian',            out: 'assets/food/indian/biryani_1.jpg'       },
  { search: 'naan bread indian flatbread',    out: 'assets/food/indian/naan_1.jpg'          },

  // ── Chinese ──────────────────────────────
  { search: 'dim sum dumplings chinese',      out: 'assets/food/chinese/dimsum_1.jpg'       },
  { search: 'noodles chinese stir fry',       out: 'assets/food/chinese/noodles_1.jpg'      },
  { search: 'fried rice chinese',             out: 'assets/food/chinese/friedrice_1.jpg'    },
  { search: 'wonton soup chinese',            out: 'assets/food/chinese/wonton_1.jpg'       },

  // ── Thai ─────────────────────────────────
  { search: 'pad thai noodles thai food',     out: 'assets/food/thai/padthai_1.jpg'         },
  { search: 'green curry thai coconut',       out: 'assets/food/thai/thaicurry_1.jpg'       },

  // ── Mediterranean ────────────────────────
  { search: 'hummus dip chickpea',            out: 'assets/food/mediterranean/hummus_1.jpg'    },
  { search: 'shawarma wrap meat',             out: 'assets/food/mediterranean/shawarma_1.jpg'  },
  { search: 'kebab skewer grilled meat',      out: 'assets/food/mediterranean/kebab_1.jpg'     },
  { search: 'gyro greek wrap pita',           out: 'assets/food/mediterranean/gyro_1.jpg'      },

  // ── Seafood ──────────────────────────────
  { search: 'grilled fish fillet seafood',    out: 'assets/food/seafood/fish_1.jpg'         },
  { search: 'shrimp prawn seafood',           out: 'assets/food/seafood/shrimp_1.jpg'       },

  // ── BBQ ──────────────────────────────────
  { search: 'bbq grilled meat barbecue',      out: 'assets/food/bbq/bbq_1.jpg'              },
  { search: 'bbq ribs pork smoked',           out: 'assets/food/bbq/ribs_1.jpg'             },

  // ── General ──────────────────────────────
  { search: 'delicious food plate meal',      out: 'assets/food/general/main_course_1.jpg'  },
  { search: 'breakfast eggs toast plate',     out: 'assets/food/general/breakfast_1.jpg'    },
  { search: 'chocolate cake dessert sweet',   out: 'assets/food/general/dessert_1.jpg'      },
  { search: 'fresh juice drink beverage',     out: 'assets/food/general/beverage_1.jpg'     },
  { search: 'soup bowl hot food',             out: 'assets/food/general/soup_1.jpg'         },
  { search: 'fresh green salad bowl',         out: 'assets/food/general/salad_1.jpg'        },
  { search: 'snack appetizer food',           out: 'assets/food/general/snack_1.jpg'        },
  { search: 'vegetables side dish food',      out: 'assets/food/general/side_dish_1.jpg'    },
  { search: 'appetizer starter plate',        out: 'assets/food/general/appetizer_1.jpg'    },
  { search: 'combo meal food plate',          out: 'assets/food/general/combo_1.jpg'        },
];

// ─── Search Pexels and get best photo ────────
function searchPexels(query) {
  return new Promise((resolve, reject) => {
    const searchQuery = encodeURIComponent(query);
    const options = {
      hostname: 'api.pexels.com',
      path:     `/v1/search?query=${searchQuery}&per_page=5&orientation=landscape`,
      headers:  {
        'Authorization': PEXELS_API_KEY,
      },
    };

    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.photos && json.photos.length > 0) {
            // ✅ Get medium size image URL
            const photo = json.photos[0];
            const url   = photo.src.medium ||
                          photo.src.small  ||
                          photo.src.original;
            resolve(url);
          } else {
            reject(new Error('No photos found'));
          }
        } catch (e) {
          reject(new Error('Parse error: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// ─── Download image from URL ──────────────────
function downloadUrl(url, dest, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 10) return reject(new Error('Too many redirects'));

    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
    }

    const file      = fs.createWriteStream(dest);
    const isHttps   = url.startsWith('https');
    const lib       = isHttps ? require('https') : require('http');

    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        file.close();
        try { fs.unlinkSync(dest); } catch(e) {}
        return downloadUrl(res.headers.location, dest, depth + 1)
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
        if (size < 5000) {
          try { fs.unlinkSync(dest); } catch(e) {}
          reject(new Error(`Too small: ${size}B`));
        } else {
          resolve();
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

// ─── Main ─────────────────────────────────────
async function main() {
  if (PEXELS_API_KEY === 'YOUR_PEXELS_API_KEY_HERE') {
    console.log('❌ Please add your Pexels API key!');
    console.log('   Get one free at: https://www.pexels.com/api/');
    console.log('   Then edit this script and replace YOUR_PEXELS_API_KEY_HERE');
    return;
  }

  console.log(`\n📥 Downloading ${IMAGE_SEARCHES.length} REAL food images from Pexels...\n`);

  let success = 0;
  let failed  = 0;
  const errors = [];

  for (let i = 0; i < IMAGE_SEARCHES.length; i++) {
    const item = IMAGE_SEARCHES[i];
    const dest = path.join(PROJECT_ROOT, item.out);
    const name = item.out.split('/').slice(-2).join('/');

    process.stdout.write(`[${i+1}/${IMAGE_SEARCHES.length}] ${name}... `);

    try {
      // Step 1: Search Pexels for the photo
      const imageUrl = await searchPexels(item.search);

      // Step 2: Download the photo
      await downloadUrl(imageUrl, dest);

      const size = fs.statSync(dest).size;
      console.log(`✅ ${Math.round(size/1024)}KB`);
      success++;

    } catch (err) {
      console.log(`❌ ${err.message}`);
      failed++;
      errors.push({ file: item.out, search: item.search, error: err.message });
    }

    // ✅ Rate limit — Pexels allows 200 requests/hour
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\n📊 Results: ${success} success, ${failed} failed`);

  if (errors.length > 0) {
    console.log('\n❌ Failed:');
    errors.forEach(e => console.log(`  ${e.file} (search: "${e.search}"): ${e.error}`));
    console.log('\n💡 Run again to retry');
  }

  if (success > 0) {
    console.log('\n✅ Next steps:');
    console.log('  git add -f assets/food/');
    console.log('  git commit -m "feat: real food photos from Pexels"');
    console.log('  git push');
    console.log('  eas build --platform android --profile preview');
  }
}

main().catch(console.error);