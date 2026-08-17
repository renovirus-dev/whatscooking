// ============================================
// FILE: src/utils/localFoodImages.js
// ============================================
// ✅ Local images for instant offline display
// ✅ TheMealDB for better online food photos
// ✅ Falls back to local if TheMealDB fails

const LOCAL_IMAGES = {
  // ── Jamaican ───────────────────────────────
  jerk:        require('../../assets/food/jamaican/jerk_1.jpg'),
  oxtail:      require('../../assets/food/jamaican/oxtail_1.jpg'),
  ackee:       require('../../assets/food/jamaican/ackee_1.jpg'),
  plantain:    require('../../assets/food/jamaican/plantain_1.jpg'),
  dumpling:    require('../../assets/food/jamaican/dumpling_1.jpg'),
  patty:       require('../../assets/food/jamaican/patty_1.jpg'),
  callaloo:    require('../../assets/food/jamaican/callaloo_1.jpg'),
  escovitch:   require('../../assets/food/jamaican/escovitch_1.jpg'),
  sorrel:      require('../../assets/food/jamaican/sorrel_1.jpg'),
  rice_peas:   require('../../assets/food/jamaican/rice_peas_1.jpg'),
  bammy:       require('../../assets/food/jamaican/bammy_1.jpg'),

  // ── American ───────────────────────────────
  burger:      require('../../assets/food/american/burger_1.jpg'),
  steak:       require('../../assets/food/american/steak_1.jpg'),
  wings:       require('../../assets/food/american/wings_1.jpg'),
  fries:       require('../../assets/food/american/fries_1.jpg'),
  sandwich:    require('../../assets/food/american/sandwich_1.jpg'),
  hotdog:      require('../../assets/food/american/hotdog_1.jpg'),

  // ── Italian ────────────────────────────────
  pizza:       require('../../assets/food/italian/pizza_1.jpg'),
  pasta:       require('../../assets/food/italian/pasta_1.jpg'),
  lasagna:     require('../../assets/food/italian/lasagna_1.jpg'),

  // ── Japanese ───────────────────────────────
  sushi:       require('../../assets/food/japanese/sushi_1.jpg'),
  ramen:       require('../../assets/food/japanese/ramen_1.jpg'),
  tempura:     require('../../assets/food/japanese/tempura_1.jpg'),

  // ── Mexican ────────────────────────────────
  taco:        require('../../assets/food/mexican/taco_1.jpg'),
  burrito:     require('../../assets/food/mexican/burrito_1.jpg'),
  nachos:      require('../../assets/food/mexican/nachos_1.jpg'),

  // ── Indian ─────────────────────────────────
  curry:       require('../../assets/food/indian/curry_1.jpg'),
  biryani:     require('../../assets/food/indian/biryani_1.jpg'),
  naan:        require('../../assets/food/indian/naan_1.jpg'),

  // ── Chinese ────────────────────────────────
  dimsum:      require('../../assets/food/chinese/dimsum_1.jpg'),
  noodles:     require('../../assets/food/chinese/noodles_1.jpg'),
  friedrice:   require('../../assets/food/chinese/friedrice_1.jpg'),
  wonton:      require('../../assets/food/chinese/wonton_1.jpg'),

  // ── Thai ───────────────────────────────────
  padthai:     require('../../assets/food/thai/padthai_1.jpg'),
  thaicurry:   require('../../assets/food/thai/thaicurry_1.jpg'),

  // ── Mediterranean ──────────────────────────
  hummus:      require('../../assets/food/mediterranean/hummus_1.jpg'),
  shawarma:    require('../../assets/food/mediterranean/shawarma_1.jpg'),
  kebab:       require('../../assets/food/mediterranean/kebab_1.jpg'),
  gyro:        require('../../assets/food/mediterranean/gyro_1.jpg'),

  // ── Seafood ────────────────────────────────
  fish:        require('../../assets/food/seafood/fish_1.jpg'),
  shrimp:      require('../../assets/food/seafood/shrimp_1.jpg'),

  // ── BBQ ────────────────────────────────────
  bbq:         require('../../assets/food/bbq/bbq_1.jpg'),
  ribs:        require('../../assets/food/bbq/ribs_1.jpg'),

  // ── General ────────────────────────────────
  main_course: require('../../assets/food/general/main_course_1.jpg'),
  breakfast:   require('../../assets/food/general/breakfast_1.jpg'),
  dessert:     require('../../assets/food/general/dessert_1.jpg'),
  beverage:    require('../../assets/food/general/beverage_1.jpg'),
  soup:        require('../../assets/food/general/soup_1.jpg'),
  salad:       require('../../assets/food/general/salad_1.jpg'),
  snack:       require('../../assets/food/general/snack_1.jpg'),
  side_dish:   require('../../assets/food/general/side_dish_1.jpg'),
  appetizer:   require('../../assets/food/general/appetizer_1.jpg'),
  combo:       require('../../assets/food/general/combo_1.jpg'),
};

// ─────────────────────────────────────────────
// THEMEALDB SEARCH TERM MAP
// Maps dish names to better TheMealDB queries
// TheMealDB has 300+ real food photos — free
// ─────────────────────────────────────────────
const MEALDB_SEARCH_MAP = {
  // ── Jamaican → closest TheMealDB match ────
  'jerk chicken':        'Jerk chicken',
  'jerk pork':           'Jerk chicken',
  'jerk fish':           'Jerk chicken',
  'jerk':                'Jerk chicken',
  'oxtail':              'Beef stew',
  'brown stew chicken':  'Chicken stew',
  'stew peas':           'Red beans',
  'ackee':               'Saltfish',
  'ackee and saltfish':  'Saltfish',
  'curry goat':          'Lamb curry',
  'curry chicken':       'Chicken curry',
  'curry shrimp':        'Prawn curry',
  'curry':               'Chicken curry',
  'escovitch fish':      'Grilled fish',
  'steam fish':          'Steamed fish',
  'pepper shrimp':       'Shrimp',
  'callaloo':            'Spinach',
  'fried plantain':      'Plantain',
  'plantain':            'Plantain',
  'fried dumpling':      'Doughnut',
  'boiled dumpling':     'Dumpling',
  'festival':            'Doughnut',
  'dumpling':            'Dumpling',
  'beef patty':          'Beef pasty',
  'patty':               'Beef pasty',
  'rice and peas':       'Rice',
  'rice':                'Rice',
  'bammy':               'Flatbread',
  'breadfruit':          'Bread',
  'rundown':             'Mackerel',
  'mackerel':            'Mackerel',
  'saltfish':            'Saltfish',
  'porridge':            'Oatmeal',
  'soup':                'Chicken soup',
  'sorrel':              'Punch',

  // ── International ─────────────────────────
  'burger':              'Beef burger',
  'cheeseburger':        'Cheeseburger',
  'pizza':               'Pizza',
  'pasta':               'Spaghetti',
  'spaghetti':           'Spaghetti bolognese',
  'carbonara':           'Spaghetti carbonara',
  'lasagna':             'Lasagne',
  'risotto':             'Risotto',
  'salad':               'Caesar salad',
  'sandwich':            'Club sandwich',
  'wrap':                'Wrap',
  'steak':               'Beef steak',
  'salmon':              'Salmon',
  'lobster':             'Lobster',
  'shrimp':              'Prawns',
  'prawn':               'Prawn',
  'chicken':             'Chicken',
  'fish':                'Fish',
  'wings':               'Chicken wings',
  'ribs':                'Pork ribs',
  'taco':                'Tacos',
  'tacos':               'Tacos',
  'burrito':             'Burrito',
  'nachos':              'Nachos',
  'sushi':               'Sushi',
  'ramen':               'Ramen',
  'noodles':             'Noodles',
  'fried rice':          'Fried rice',
  'pad thai':            'Pad Thai',
  'curry':               'Chicken curry',
  'biryani':             'Chicken biryani',
  'kebab':               'Kebab',
  'hummus':              'Hummus',
  'shawarma':            'Shawarma',
  'gyro':                'Gyros',
  'hot dog':             'Hot dog',
  'hotdog':              'Hot dog',
  'stir fry':            'Stir fry',
  'fried chicken':       'Fried chicken',
  'bbq':                 'BBQ',
  'pork chop':           'Pork chop',
  'lamb chop':           'Lamb chops',

  // ── Breakfast ─────────────────────────────
  'pancakes':            'Pancakes',
  'pancake':             'Pancakes',
  'waffles':             'Waffles',
  'waffle':              'Waffles',
  'eggs':                'Eggs',
  'omelette':            'Omelette',
  'french toast':        'French toast',
  'cereal':              'Cereal',
  'bacon':               'Bacon',
  'granola':             'Granola',

  // ── Desserts ──────────────────────────────
  'cake':                'Chocolate cake',
  'cheesecake':          'Cheesecake',
  'ice cream':           'Ice cream',
  'brownie':             'Brownies',
  'cookie':              'Cookies',
  'donut':               'Donuts',
  'tiramisu':            'Tiramisu',
  'mousse':              'Chocolate mousse',
  'pudding':             'Bread pudding',
  'tart':                'Fruit tart',
  'crepe':               'Crepes',
  'banana bread':        'Banana bread',

  // ── Beverages ─────────────────────────────
  'juice':               'Orange juice',
  'smoothie':            'Smoothie',
  'coffee':              'Coffee',
  'lemonade':            'Lemonade',
  'milkshake':           'Milkshake',
};

// ─── TheMealDB Memory Cache ───────────────────
const mealDBCache = new Map();

// ─────────────────────────────────────────────
// SEARCH THEMEALDB
// ✅ Android safe — AbortController timeout
// ✅ Explicit headers for Android fetch
// ✅ Falls back gracefully on any error
// ─────────────────────────────────────────────
const searchTheMealDB = async (dishName) => {
  if (!dishName?.trim()) return null;

  const lower    = dishName.toLowerCase().trim();
  const cacheKey = lower;

  // ✅ Return cached result — avoids repeat fetches
  if (mealDBCache.has(cacheKey)) {
    return mealDBCache.get(cacheKey);
  }

  // ✅ Map dish name to best MealDB search term
  let searchTerm = null;

  // Exact match first
  if (MEALDB_SEARCH_MAP[lower]) {
    searchTerm = MEALDB_SEARCH_MAP[lower];
  }

  // Partial match — name contains a key
  if (!searchTerm) {
    for (const [key, term] of Object.entries(MEALDB_SEARCH_MAP)) {
      if (lower.includes(key)) {
        searchTerm = term;
        break;
      }
    }
  }

  // Fall back to raw dish name
  if (!searchTerm) searchTerm = dishName.trim();

  // ✅ Helper: fetch with timeout (Android needs this)
  const fetchWithTimeout = async (url, timeoutMs = 8000) => {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method:  'GET',
        headers: {
          'Accept':     'application/json',
          'Connection': 'keep-alive',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  try {
    // ── Attempt 1: mapped search term ──────────
    const response = await fetchWithTimeout(
      `https://www.themealdb.com/api/json/v1/1/search.php` +
      `?s=${encodeURIComponent(searchTerm)}`
    );

    if (!response.ok) {
      mealDBCache.set(cacheKey, null);
      return null;
    }

    const data = await response.json();

    if (data?.meals?.length > 0) {
      const url = data.meals[0].strMealThumb;
      mealDBCache.set(cacheKey, url);
      return url;
    }

    // ── Attempt 2: first word of dish name ─────
    const firstWord = lower.split(' ')[0];
    if (firstWord && firstWord.length > 3 && firstWord !== searchTerm.toLowerCase()) {
      try {
        const response2 = await fetchWithTimeout(
          `https://www.themealdb.com/api/json/v1/1/search.php` +
          `?s=${encodeURIComponent(firstWord)}`
        );

        if (response2.ok) {
          const data2 = await response2.json();
          if (data2?.meals?.length > 0) {
            const url = data2.meals[0].strMealThumb;
            mealDBCache.set(cacheKey, url);
            return url;
          }
        }
      } catch {
        // Silent — keep going to null
      }
    }

    mealDBCache.set(cacheKey, null);
    return null;

  } catch (err) {
    if (err.name === 'AbortError') {
      console.log(`⏰ MealDB timed out: "${dishName}"`);
    } else {
      console.log(`❌ MealDB fetch error: "${dishName}":`, err.message);
    }
    // ✅ Cache null so we don't retry same failed query
    mealDBCache.set(cacheKey, null);
    return null;
  }
};

// ─────────────────────────────────────────────
// GET MULTIPLE MEALDB IMAGES
// Returns array — used in image picker modal
// ─────────────────────────────────────────────
export const getMealDBImages = async (dishName, count = 6) => {
  if (!dishName?.trim()) return [];

  const lower      = dishName.toLowerCase().trim();
  const searchTerm = MEALDB_SEARCH_MAP[lower] || dishName.trim();

  try {
    const response = await fetch(
      `https://www.themealdb.com/api/json/v1/1/search.php` +
      `?s=${encodeURIComponent(searchTerm)}`
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (!data.meals) return [];

    return data.meals.slice(0, count).map(meal => ({
      id:          `mealdb_${meal.idMeal}`,
      url:         meal.strMealThumb,
      thumbUrl:    meal.strMealThumb + '/preview',
      description: meal.strMeal,
      source:      'TheMealDB',
      credit:      'TheMealDB',
    }));
  } catch (err) {
    console.log('getMealDBImages error:', err.message);
    return [];
  }
};

// ─────────────────────────────────────────────
// CLEAR MEALDB CACHE
// ─────────────────────────────────────────────
export const clearMealDBCache = () => {
  mealDBCache.clear();
  console.log('🗑️ MealDB cache cleared');
};

// ─── Keyword → local image key ───────────────
const KEYWORD_MAP = [
  // Jamaican — FIRST priority
  { keywords: ['jerk chicken', 'jerk pork', 'jerk fish', 'jerk'],            key: 'jerk'       },
  { keywords: ['oxtail', 'ox tail'],                                           key: 'oxtail'     },
  { keywords: ['ackee and saltfish', 'ackee & saltfish', 'ackee'],           key: 'ackee'      },
  { keywords: ['fried plantain', 'ripe plantain', 'plantain'],               key: 'plantain'   },
  { keywords: ['fried dumpling', 'boiled dumpling', 'festival', 'dumpling'], key: 'dumpling'   },
  { keywords: ['beef patty', 'chicken patty', 'coco bread', 'patty'],       key: 'patty'      },
  { keywords: ['callaloo', 'calaloo'],                                         key: 'callaloo'   },
  { keywords: ['escovitch', 'escoveitch'],                                     key: 'escovitch'  },
  { keywords: ['stew peas', 'stew chicken', 'brown stew'],                   key: 'oxtail'     },
  { keywords: ['sorrel'],                                                       key: 'sorrel'     },
  { keywords: ['rice and peas', 'rice & peas', 'cook up rice', 'pelau'],    key: 'rice_peas'  },
  { keywords: ['bammy', 'bami'],                                               key: 'bammy'      },
  { keywords: ['curry goat', 'curry chicken', 'curried'],                    key: 'curry'      },
  // Japanese
  { keywords: ['sushi', 'sashimi', 'maki', 'nigiri'],                        key: 'sushi'      },
  { keywords: ['ramen', 'udon', 'soba'],                                       key: 'ramen'      },
  { keywords: ['tempura'],                                                      key: 'tempura'    },
  { keywords: ['teriyaki'],                                                     key: 'thaicurry'  },
  { keywords: ['miso'],                                                         key: 'soup'       },
  // Mexican
  { keywords: ['taco', 'tacos'],                                               key: 'taco'       },
  { keywords: ['burrito'],                                                      key: 'burrito'    },
  { keywords: ['nacho', 'nachos'],                                              key: 'nachos'     },
  { keywords: ['quesadilla'],                                                   key: 'taco'       },
  { keywords: ['guacamole'],                                                    key: 'nachos'     },
  // Thai
  { keywords: ['pad thai', 'padthai'],                                          key: 'padthai'    },
  { keywords: ['thai curry', 'green curry', 'red curry'],                      key: 'thaicurry'  },
  { keywords: ['spring roll', 'springroll'],                                    key: 'dimsum'     },
  { keywords: ['thai'],                                                          key: 'padthai'    },
  // Chinese
  { keywords: ['dim sum', 'dimsum'],                                            key: 'dimsum'     },
  { keywords: ['wonton'],                                                       key: 'wonton'     },
  { keywords: ['chow mein', 'lo mein', 'mei fun', 'noodle'],                  key: 'noodles'    },
  { keywords: ['fried rice', 'egg fried rice'],                                key: 'friedrice'  },
  { keywords: ['chinese'],                                                       key: 'dimsum'     },
  // Mediterranean
  { keywords: ['hummus'],                                                       key: 'hummus'     },
  { keywords: ['falafel'],                                                      key: 'hummus'     },
  { keywords: ['shawarma'],                                                     key: 'shawarma'   },
  { keywords: ['kebab', 'kabob', 'shish'],                                     key: 'kebab'      },
  { keywords: ['gyro'],                                                         key: 'gyro'       },
  // Indian
  { keywords: ['biryani'],                                                      key: 'biryani'    },
  { keywords: ['samosa'],                                                       key: 'appetizer'  },
  { keywords: ['tandoori'],                                                     key: 'curry'      },
  { keywords: ['naan', 'roti', 'paratha'],                                      key: 'naan'       },
  { keywords: ['curry', 'masala', 'tikka', 'korma'],                          key: 'curry'      },
  // Italian
  { keywords: ['pizza', 'pepperoni', 'margherita'],                            key: 'pizza'      },
  { keywords: ['pasta', 'spaghetti', 'fettuccine', 'penne'],                  key: 'pasta'      },
  { keywords: ['lasagna', 'lasagne'],                                           key: 'lasagna'    },
  { keywords: ['risotto'],                                                      key: 'pasta'      },
  // American
  { keywords: ['burger', 'beef burger', 'chicken burger'],                     key: 'burger'     },
  { keywords: ['hot dog', 'hotdog'],                                            key: 'hotdog'     },
  { keywords: ['buffalo wings', 'chicken wings', 'wings'],                    key: 'wings'      },
  { keywords: ['sandwich', 'sub', 'wrap', 'panini'],                           key: 'sandwich'   },
  { keywords: ['french fries', 'fries', 'chips'],                              key: 'fries'      },
  { keywords: ['steak', 'ribeye', 'sirloin'],                                  key: 'steak'      },
  // BBQ
  { keywords: ['bbq', 'barbeque', 'barbecue'],                                 key: 'bbq'        },
  { keywords: ['ribs'],                                                         key: 'ribs'       },
  // General
  { keywords: ['fried chicken', 'grilled chicken', 'chicken'],                key: 'wings'      },
  { keywords: ['snapper', 'salmon', 'tilapia', 'cod', 'tuna', 'fish'],       key: 'fish'       },
  { keywords: ['shrimp', 'prawn', 'lobster', 'crab', 'seafood'],             key: 'shrimp'     },
  { keywords: ['soup', 'broth', 'chowder', 'bisque'],                         key: 'soup'       },
  { keywords: ['salad', 'caesar', 'coleslaw'],                                 key: 'salad'      },
  { keywords: ['ice cream', 'gelato', 'sorbet', 'sundae'],                    key: 'dessert'    },
  { keywords: ['smoothie', 'milkshake', 'lemonade', 'juice'],                 key: 'beverage'   },
  { keywords: ['pancake', 'waffle', 'omelette', 'eggs', 'breakfast'],        key: 'breakfast'  },
  { keywords: ['cake', 'brownie', 'cookie', 'pastry', 'muffin', 'donut'],    key: 'dessert'    },
  { keywords: ['bread', 'loaf', 'croissant'],                                  key: 'appetizer'  },
  { keywords: ['combo', 'meal deal'],                                           key: 'combo'      },
];

// ─── Category → local image key ──────────────
const CATEGORY_TO_KEY = {
  appetizer:      'appetizer',
  soup:           'soup',
  salad:          'salad',
  main_course:    'main_course',
  side_dish:      'side_dish',
  dessert:        'dessert',
  beverage:       'beverage',
  breakfast:      'breakfast',
  combo_meal:     'combo',
  snack:          'snack',
  kids_menu:      'main_course',
  lunch_special:  'main_course',
  dinner_special: 'main_course',
};

// ─────────────────────────────────────────────
// GET LOCAL FOOD IMAGE (sync — instant)
// Used as placeholder while MealDB loads
// ─────────────────────────────────────────────
export function getLocalFoodImage(
  itemName = '',
  category = '',
) {
  const nameLower = (itemName || '').toLowerCase().trim();
  const catLower  = (category  || '').toLowerCase().trim();

  // No name — show category image
  if (!nameLower) {
    const key = CATEGORY_TO_KEY[catLower] || 'main_course';
    return LOCAL_IMAGES[key] || LOCAL_IMAGES['main_course'];
  }

  // Keyword match
  for (const entry of KEYWORD_MAP) {
    if (entry.keywords.some(k => nameLower.includes(k))) {
      const image = LOCAL_IMAGES[entry.key];
      if (image) return image;
    }
  }

  // Category fallback
  const catKey = CATEGORY_TO_KEY[catLower] || 'main_course';
  return LOCAL_IMAGES[catKey] || LOCAL_IMAGES['main_course'];
}

// ─────────────────────────────────────────────
// GET IMAGE SOURCE (sync — for MenuItemCard)
// Used everywhere a menu item image is shown
// ─────────────────────────────────────────────
export function getImageSource(item) {
  const url = item?.imageUrl || item?.autoImageUrl || '';

  // ✅ Cloudinary URL — user uploaded photo
  if (url?.includes('cloudinary')) {
    return { uri: url };
  }

  // ✅ Firebase Storage URL — legacy
  if (
    url &&
    (
      url.startsWith('https://firebasestorage') ||
      url.startsWith('https://storage.googleapis')
    )
  ) {
    return { uri: url };
  }

  // ✅ Any other valid URL
  if (url && url.startsWith('http')) {
    return { uri: url };
  }

  // ✅ Local bundled image fallback
  return getLocalFoodImage(
    item?.name     || '',
    item?.category || 'main_course'
  );
}

// ─────────────────────────────────────────────
// GET BEST IMAGE SOURCE (async — with MealDB)
// ✅ Shows local image instantly
// ✅ Tries TheMealDB for better photo
// ✅ Returns { source, fromMealDB }
//    source   — pass directly to <Image source={} />
//    fromMealDB — true if MealDB found a better image
// ─────────────────────────────────────────────
export async function getBestImageSource(item) {
  // ✅ If item already has a Cloudinary or custom URL
  //    use it — don't fetch from MealDB
  const url = item?.imageUrl    ||
              item?.cloudinaryUrl ||
              item?.autoImageUrl  || '';

  if (
    url && (
      url.includes('cloudinary') ||
      url.startsWith('https://firebasestorage') ||
      url.startsWith('https://storage.googleapis') ||
      (url.startsWith('http') && !url.includes('themealdb'))
    )
  ) {
    return { source: { uri: url }, fromMealDB: false };
  }

  // ✅ Try TheMealDB for a better photo
  const mealDBUrl = await searchTheMealDB(
    item?.name     || '',
    item?.category || ''
  );

  if (mealDBUrl) {
    return { source: { uri: mealDBUrl }, fromMealDB: true };
  }

  // ✅ Fall back to local image
  return {
    source:      getLocalFoodImage(item?.name || '', item?.category || ''),
    fromMealDB:  false,
  };
}

export default LOCAL_IMAGES;