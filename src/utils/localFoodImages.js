// ============================================
// FILE: src/utils/localFoodImages.js
// ============================================

const LOCAL_IMAGES = {
  // ── Jamaican ───────────────────────────────
  jerk:        require('../../assets/food/jamaican/jerk_1.jpg'),
  jerk2:       require('../../assets/food/jamaican/jerk_2.jpg'),
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
  burger2:     require('../../assets/food/american/burger_2.jpg'),
  steak:       require('../../assets/food/american/steak_1.jpg'),
  wings:       require('../../assets/food/american/wings_1.jpg'),
  fries:       require('../../assets/food/american/fries_1.jpg'),
  sandwich:    require('../../assets/food/american/sandwich_1.jpg'),
  hotdog:      require('../../assets/food/american/hotdog_1.jpg'),

  // ── Italian ────────────────────────────────
  pizza:       require('../../assets/food/italian/pizza_1.jpg'),
  pizza2:      require('../../assets/food/italian/pizza_2.jpg'),
  pasta:       require('../../assets/food/italian/pasta_1.jpg'),
  pasta2:      require('../../assets/food/italian/pasta_2.jpg'),
  lasagna:     require('../../assets/food/italian/lasagna_1.jpg'),

  // ── Japanese ───────────────────────────────
  sushi:       require('../../assets/food/japanese/sushi_1.jpg'),
  sushi2:      require('../../assets/food/japanese/sushi_2.jpg'),
  ramen:       require('../../assets/food/japanese/ramen_1.jpg'),
  tempura:     require('../../assets/food/japanese/tempura_1.jpg'),

  // ── Mexican ────────────────────────────────
  taco:        require('../../assets/food/mexican/taco_1.jpg'),
  taco2:       require('../../assets/food/mexican/taco_2.jpg'),
  burrito:     require('../../assets/food/mexican/burrito_1.jpg'),
  nachos:      require('../../assets/food/mexican/nachos_1.jpg'),

  // ── Indian ─────────────────────────────────
  curry:       require('../../assets/food/indian/curry_1.jpg'),
  curry2:      require('../../assets/food/indian/curry_2.jpg'),
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
  fish2:       require('../../assets/food/seafood/fish_2.jpg'),
  shrimp:      require('../../assets/food/seafood/shrimp_1.jpg'),

  // ── BBQ ────────────────────────────────────
  bbq:         require('../../assets/food/bbq/bbq_1.jpg'),
  bbq2:        require('../../assets/food/bbq/bbq_2.jpg'),
  ribs:        require('../../assets/food/bbq/ribs_1.jpg'),

  // ── General ────────────────────────────────
  main_course:  require('../../assets/food/general/main_course_1.jpg'),
  main_course2: require('../../assets/food/general/main_course_2.jpg'),
  main_course3: require('../../assets/food/general/main_course_3.jpg'),
  breakfast:    require('../../assets/food/general/breakfast_1.jpg'),
  breakfast2:   require('../../assets/food/general/breakfast_2.jpg'),
  dessert:      require('../../assets/food/general/dessert_1.jpg'),
  dessert2:     require('../../assets/food/general/dessert_2.jpg'),
  beverage:     require('../../assets/food/general/beverage_1.jpg'),
  beverage2:    require('../../assets/food/general/beverage_2.jpg'),
  soup:         require('../../assets/food/general/soup_1.jpg'),
  soup2:        require('../../assets/food/general/soup_2.jpg'),
  salad:        require('../../assets/food/general/salad_1.jpg'),
  salad2:       require('../../assets/food/general/salad_2.jpg'),
  snack:        require('../../assets/food/general/snack_1.jpg'),
  side_dish:    require('../../assets/food/general/side_dish_1.jpg'),
  appetizer:    require('../../assets/food/general/appetizer_1.jpg'),
  combo:        require('../../assets/food/general/combo_1.jpg'),
};

// ─── Keyword → image key ──────────────────────
const KEYWORD_MAP = [
  // Jamaican — FIRST
  { keywords: ['jerk chicken', 'jerk pork', 'jerk fish', 'jerk'],             key: 'jerk'        },
  { keywords: ['oxtail', 'ox tail'],                                            key: 'oxtail'      },
  { keywords: ['ackee and saltfish', 'ackee & saltfish', 'ackee'],            key: 'ackee'       },
  { keywords: ['fried plantain', 'ripe plantain', 'plantain'],                key: 'plantain'    },
  { keywords: ['fried dumpling', 'boiled dumpling', 'festival', 'dumpling'],  key: 'dumpling'    },
  { keywords: ['beef patty', 'chicken patty', 'coco bread', 'patty'],        key: 'patty'       },
  { keywords: ['callaloo', 'calaloo'],                                          key: 'callaloo'    },
  { keywords: ['escovitch', 'escoveitch'],                                      key: 'escovitch'   },
  { keywords: ['stew peas', 'stew chicken', 'brown stew'],                    key: 'oxtail'      },
  { keywords: ['sorrel'],                                                        key: 'sorrel'      },
  { keywords: ['rice and peas', 'rice & peas', 'cook up rice', 'pelau'],     key: 'rice_peas'   },
  { keywords: ['bammy', 'bami'],                                                key: 'bammy'       },
  { keywords: ['curry goat', 'curry chicken', 'curried'],                     key: 'curry'       },
  // Japanese
  { keywords: ['sushi', 'sashimi', 'maki', 'nigiri'],                         key: 'sushi'       },
  { keywords: ['ramen', 'udon', 'soba'],                                        key: 'ramen'       },
  { keywords: ['tempura'],                                                       key: 'tempura'     },
  { keywords: ['teriyaki'],                                                      key: 'thaicurry'   },
  { keywords: ['miso'],                                                          key: 'soup'        },
  // Mexican
  { keywords: ['taco', 'tacos'],                                                key: 'taco'        },
  { keywords: ['burrito'],                                                       key: 'burrito'     },
  { keywords: ['nacho', 'nachos'],                                               key: 'nachos'      },
  { keywords: ['quesadilla'],                                                    key: 'taco'        },
  { keywords: ['guacamole'],                                                     key: 'nachos'      },
  // Thai
  { keywords: ['pad thai', 'padthai'],                                           key: 'padthai'     },
  { keywords: ['thai curry', 'green curry', 'red curry'],                       key: 'thaicurry'   },
  { keywords: ['spring roll', 'springroll'],                                     key: 'dimsum'      },
  { keywords: ['thai'],                                                           key: 'padthai'     },
  // Chinese
  { keywords: ['dim sum', 'dimsum'],                                             key: 'dimsum'      },
  { keywords: ['wonton'],                                                        key: 'wonton'      },
  { keywords: ['chow mein', 'lo mein', 'mei fun', 'noodle'],                   key: 'noodles'     },
  { keywords: ['fried rice', 'egg fried rice'],                                 key: 'friedrice'   },
  { keywords: ['chinese'],                                                        key: 'dimsum'      },
  // Mediterranean
  { keywords: ['hummus'],                                                        key: 'hummus'      },
  { keywords: ['falafel'],                                                       key: 'hummus'      },
  { keywords: ['shawarma'],                                                      key: 'shawarma'    },
  { keywords: ['kebab', 'kabob', 'shish'],                                      key: 'kebab'       },
  { keywords: ['gyro'],                                                          key: 'gyro'        },
  // Indian
  { keywords: ['biryani'],                                                       key: 'biryani'     },
  { keywords: ['samosa'],                                                        key: 'appetizer'   },
  { keywords: ['tandoori'],                                                      key: 'curry'       },
  { keywords: ['naan', 'roti', 'paratha'],                                       key: 'naan'        },
  { keywords: ['curry', 'masala', 'tikka', 'korma'],                           key: 'curry'       },
  // Italian
  { keywords: ['pizza', 'pepperoni', 'margherita'],                             key: 'pizza'       },
  { keywords: ['pasta', 'spaghetti', 'fettuccine', 'penne'],                   key: 'pasta'       },
  { keywords: ['lasagna', 'lasagne'],                                            key: 'lasagna'     },
  { keywords: ['risotto'],                                                       key: 'pasta'       },
  // American
  { keywords: ['burger', 'beef burger', 'chicken burger'],                      key: 'burger'      },
  { keywords: ['hot dog', 'hotdog'],                                             key: 'hotdog'      },
  { keywords: ['buffalo wings', 'chicken wings', 'wings'],                     key: 'wings'       },
  { keywords: ['sandwich', 'sub', 'wrap', 'panini'],                            key: 'sandwich'    },
  { keywords: ['french fries', 'fries', 'chips'],                               key: 'fries'       },
  { keywords: ['steak', 'ribeye', 'sirloin'],                                   key: 'steak'       },
  // BBQ
  { keywords: ['bbq', 'barbeque', 'barbecue'],                                  key: 'bbq'         },
  { keywords: ['ribs'],                                                          key: 'ribs'        },
  // General
  { keywords: ['fried chicken', 'grilled chicken', 'chicken'],                 key: 'wings'       },
  { keywords: ['snapper', 'salmon', 'tilapia', 'cod', 'tuna', 'fish'],        key: 'fish'        },
  { keywords: ['shrimp', 'prawn', 'lobster', 'crab', 'seafood'],              key: 'shrimp'      },
  { keywords: ['rice and peas', 'rice'],                                         key: 'friedrice'   },
  { keywords: ['soup', 'broth', 'chowder', 'bisque'],                          key: 'soup'        },
  { keywords: ['salad', 'caesar', 'coleslaw'],                                  key: 'salad'       },
  { keywords: ['ice cream', 'gelato', 'sorbet', 'sundae'],                     key: 'dessert'     },
  { keywords: ['smoothie', 'milkshake', 'lemonade', 'juice'],                  key: 'beverage'    },
  { keywords: ['pancake', 'waffle', 'omelette', 'eggs', 'breakfast'],         key: 'breakfast'   },
  { keywords: ['cake', 'brownie', 'cookie', 'pastry', 'muffin', 'donut'],     key: 'dessert'     },
  { keywords: ['bread', 'loaf', 'croissant'],                                   key: 'appetizer'   },
  { keywords: ['combo', 'meal deal', 'set meal'],                               key: 'combo'       },
];

// ─── Category → image key ─────────────────────
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

// ─── getLocalFoodImage ────────────────────────
// Returns a require() image — bundled in APK
// Works with NO internet connection
// Use: <Image source={getLocalFoodImage(name, category)} />
export function getLocalFoodImage(
  itemName = '',
  category = '',
  counter  = 0
) {
  const nameLower = (itemName || '').toLowerCase().trim();
  const catLower  = (category  || '').toLowerCase().trim();

  // ✅ No name typed — show category image
  if (!nameLower) {
    const key   = CATEGORY_TO_KEY[catLower] || 'main_course';
    const image = LOCAL_IMAGES[key]         || LOCAL_IMAGES['main_course'];
    return image;
  }

  // Step 1: Keyword match
  for (const entry of KEYWORD_MAP) {
    if (entry.keywords.some(k => nameLower.includes(k))) {
      const image = LOCAL_IMAGES[entry.key];
      if (image) return image;
    }
  }

  // Step 2: Category fallback
  const catKey = CATEGORY_TO_KEY[catLower] || 'main_course';
  return LOCAL_IMAGES[catKey] || LOCAL_IMAGES['main_course'];
}

// ─── getImageSource ───────────────────────────
// Smart helper — use in ALL screens that show menu items
//
// Priority:
// 1. Firebase Storage URL (user uploaded custom photo)
// 2. Local bundled image (by dish name)
//
export function getImageSource(item) {
  const url = item?.imageUrl || item?.autoImageUrl || '';

  // ✅ User uploaded a real photo — load from Firebase
  if (
    url &&
    (url.startsWith('https://firebasestorage') ||
     url.startsWith('https://storage.googleapis'))
  ) {
    return { uri: url };
  }

  // ✅ Use local bundled image — no internet needed
  return getLocalFoodImage(
    item?.name     || '',
    item?.category || 'main_course'
  );
}

export default LOCAL_IMAGES;