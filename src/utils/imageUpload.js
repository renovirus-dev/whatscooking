// ============================================
// FILE: src/utils/imageUpload.js
// ============================================
// ✅ CLEANED UP - Cloudinary handles all uploads now
// This file kept only for:
// 1. getAutoFoodImage() - local fallback images
// 2. Legacy compatibility
// Firebase Storage imports removed

// ─── All image pools ──────────────────────────
export const IMAGE_POOLS = {

  breakfast: [
    'photo-1533089860892-a7c6f0a88666',
    'photo-1484723091739-30a097e8f929',
    'photo-1525351484163-7529414344d8',
    'photo-1567620905732-2d1ec7ab7445',
    'photo-1482049016688-2d3e1b311543',
    'photo-1540189549336-e6e99c3679fe',
    'photo-1555507036-ab1f4038808a',
    'photo-1528975604071-b4dc52a2d18c',
    'photo-1604908176997-125f25cc6f3d',
    'photo-1565299585323-38d6b0865b47',
  ],

  main_course: [
    'photo-1504674900247-0877df9cc836',
    'photo-1555939594-58d7cb561ad1',
    'photo-1544025162-d76694265947',
    'photo-1546069901-ba9599a7e63c',
    'photo-1565299624946-b28f40a0ae38',
    'photo-1574484284002-952d92456975',
    'photo-1565557623262-b51c2513a641',
    'photo-1512058564366-18510be2db19',
    'photo-1527477396000-e27163b481c2',
    'photo-1579584425555-c3ce17fd4351',
    'photo-1585937421612-70a008356fbe',
    'photo-1562565652-a0d8f0c59eb4',
    'photo-1529059997568-3d847b1154f0',
    'photo-1519708227418-c8fd9a32b7a2',
    'photo-1568901346375-23c9450c58cd',
  ],

  lunch_special: [
    'photo-1546069901-ba9599a7e63c',
    'photo-1567620905732-2d1ec7ab7445',
    'photo-1565299624946-b28f40a0ae38',
    'photo-1540189549336-e6e99c3679fe',
    'photo-1504674900247-0877df9cc836',
  ],

  dinner_special: [
    'photo-1544025162-d76694265947',
    'photo-1504674900247-0877df9cc836',
    'photo-1555939594-58d7cb561ad1',
    'photo-1529193591184-b1d58069ecdd',
    'photo-1558030006-450675393462',
  ],

  appetizer: [
    'photo-1541014741259-de529411b96a',
    'photo-1572441713132-c542a4354a9e',
    'photo-1476224203421-9ac39bcb3df1',
    'photo-1548943487-a2e4e43b4853',
    'photo-1565557623262-b51c2513a641',
    'photo-1604908176997-125f25cc6f3d',
    'photo-1555507036-ab1f4038808a',
    'photo-1563245372-f21724e3856d',
    'photo-1585937421612-70a008356fbe',
    'photo-1566478989037-eec170784d0b',
  ],

  soup: [
    'photo-1547592180-85f173990554',
    'photo-1603105037880-880cd4edfb0d',
    'photo-1570560258879-af7f8e1447ac',
    'photo-1548943487-a2e4e43b4853',
    'photo-1476224203421-9ac39bcb3df1',
  ],

  salad: [
    'photo-1512621776951-a57141f2eefd',
    'photo-1540189549336-e6e99c3679fe',
    'photo-1546793665-c74683f339c1',
    'photo-1543352634-99a5d50ae78e',
    'photo-1505253716362-afaea1d3d1af',
  ],

  side_dish: [
    'photo-1541014741259-de529411b96a',
    'photo-1565557623262-b51c2513a641',
    'photo-1476224203421-9ac39bcb3df1',
    'photo-1548943487-a2e4e43b4853',
    'photo-1512058564366-18510be2db19',
  ],

  dessert: [
    'photo-1488477181946-6428a0291777',
    'photo-1578985545062-69928b1d9587',
    'photo-1551024601-bec78aea704b',
    'photo-1563805042-7684c019e1cb',
    'photo-1464219551459-ac14ae4854bc',
  ],

  beverage: [
    'photo-1544145945-f90425340c7e',
    'photo-1497534446932-c925b458314e',
    'photo-1556679343-c7306c1976bc',
    'photo-1495474472287-4d71bcdd2085',
    'photo-1509042239860-f550ce710b93',
  ],

  snack: [
    'photo-1566478989037-eec170784d0b',
    'photo-1576618148400-f54bed99fcfd',
    'photo-1528712306091-ed0763094c98',
    'photo-1567620905732-2d1ec7ab7445',
    'photo-1565299624946-b28f40a0ae38',
  ],

  combo_meal: [
    'photo-1504674900247-0877df9cc836',
    'photo-1565299624946-b28f40a0ae38',
    'photo-1546069901-ba9599a7e63c',
    'photo-1555939594-58d7cb561ad1',
    'photo-1544025162-d76694265947',
  ],

  kids_menu: [
    'photo-1567620905732-2d1ec7ab7445',
    'photo-1565299624946-b28f40a0ae38',
    'photo-1546069901-ba9599a7e63c',
    'photo-1504674900247-0877df9cc836',
    'photo-1482049016688-2d3e1b311543',
  ],

  // ── Jamaican ──────────────────────────────
  jerk:      ['photo-1544025162-d76694265947', 'photo-1527477396000-e27163b481c2', 'photo-1562967914-608f82629710', 'photo-1529193591184-b1d58069ecdd', 'photo-1558030006-450675393462'],
  oxtail:    ['photo-1574484284002-952d92456975', 'photo-1555939594-58d7cb561ad1', 'photo-1527477396000-e27163b481c2', 'photo-1504674900247-0877df9cc836', 'photo-1544025162-d76694265947'],
  ackee:     ['photo-1540189549336-e6e99c3679fe', 'photo-1567620905732-2d1ec7ab7445', 'photo-1533089860892-a7c6f0a88666', 'photo-1484723091739-30a097e8f929', 'photo-1482049016688-2d3e1b311543'],
  plantain:  ['photo-1528975604071-b4dc52a2d18c', 'photo-1512058564366-18510be2db19', 'photo-1540189549336-e6e99c3679fe', 'photo-1567620905732-2d1ec7ab7445', 'photo-1565557623262-b51c2513a641'],
  dumpling:  ['photo-1555507036-ab1f4038808a', 'photo-1604908176997-125f25cc6f3d', 'photo-1541014741259-de529411b96a', 'photo-1476224203421-9ac39bcb3df1', 'photo-1548943487-a2e4e43b4853'],
  patty:     ['photo-1604908176997-125f25cc6f3d', 'photo-1555507036-ab1f4038808a', 'photo-1541014741259-de529411b96a', 'photo-1566478989037-eec170784d0b', 'photo-1576618148400-f54bed99fcfd'],
  callaloo:  ['photo-1567620905732-2d1ec7ab7445', 'photo-1540189549336-e6e99c3679fe', 'photo-1512621776951-a57141f2eefd', 'photo-1546793665-c74683f339c1', 'photo-1505253716362-afaea1d3d1af'],
  porridge:  ['photo-1517673400267-0251440c45dc', 'photo-1533089860892-a7c6f0a88666', 'photo-1484723091739-30a097e8f929', 'photo-1525351484163-7529414344d8', 'photo-1482049016688-2d3e1b311543'],
  bammy:     ['photo-1555507036-ab1f4038808a', 'photo-1604908176997-125f25cc6f3d', 'photo-1541014741259-de529411b96a', 'photo-1476224203421-9ac39bcb3df1', 'photo-1548943487-a2e4e43b4853'],
  escovitch: ['photo-1519708227418-c8fd9a32b7a2', 'photo-1559847844-5315695dadae', 'photo-1534482421-64566f976cfa', 'photo-1504675099198-7023dd85f5a3', 'photo-1565565434363-1dd90b43e14e'],
  stew_peas: ['photo-1574484284002-952d92456975', 'photo-1547592180-85f173990554', 'photo-1603105037880-880cd4edfb0d', 'photo-1555939594-58d7cb561ad1', 'photo-1544025162-d76694265947'],
  sorrel:    ['photo-1559181567-c3190ca9be46', 'photo-1570696516188-ade861b84a49', 'photo-1546173159-315724a31696', 'photo-1600271886742-f049cd451bba', 'photo-1621506289937-a8e4df240d0b'],

  // ── Other cuisines ────────────────────────
  burger:        ['photo-1568901346375-23c9450c58cd', 'photo-1553979459-d2229ba7433b', 'photo-1586816001966-79b736744398', 'photo-1571091718767-18b5b1457add', 'photo-1565299507177-b0ac66763828'],
  pizza:         ['photo-1565299624946-b28f40a0ae38', 'photo-1574071318508-1cdbab80d002', 'photo-1513104890138-7c749659a591', 'photo-1601924582970-9238bcb495d6', 'photo-1604382354936-07c5d9983bd3'],
  pasta:         ['photo-1621996346565-e3dbc353d2e5', 'photo-1555949258-eb67b1ef0ceb', 'photo-1473093295043-cdd812d0e601', 'photo-1598866594230-a7c12756260f', 'photo-1551183053-bf91798d2d66'],
  sushi:         ['photo-1579584425555-c3ce17fd4351', 'photo-1617196034183-421b4040ed20', 'photo-1562802378-063ec186a863', 'photo-1617196034099-5b90b0e29e6a', 'photo-1553621042-f6e147245754'],
  ramen:         ['photo-1569718212165-3a8278d5f624', 'photo-1569050467447-ce54b3bbc37d', 'photo-1591814468924-caf88d1232e1', 'photo-1585032226651-759b368d7246', 'photo-1555126634-323283e090fa'],
  taco:          ['photo-1565299585323-38d6b0865b47', 'photo-1604467794349-0b74285de7e7', 'photo-1552332386-f8dd00dc2f85', 'photo-1600891964092-4316c288032e', 'photo-1543339308-43e59d6b73a6'],
  curry:         ['photo-1585937421612-70a008356fbe', 'photo-1596797038530-2c107229654b', 'photo-1455619452474-d2be8b1e70cd', 'photo-1631452180519-c014fe946bc7', 'photo-1565557623262-b51c2513a641'],
  seafood:       ['photo-1565680018434-b513d5e5fd47', 'photo-1559847844-5315695dadae', 'photo-1519708227418-c8fd9a32b7a2', 'photo-1534482421-64566f976cfa', 'photo-1580822184713-fc5400e7fe10'],
  chicken:       ['photo-1598103442097-8b74394b95c4', 'photo-1527477396000-e27163b481c2', 'photo-1604908176997-125f25cc6f3d', 'photo-1569058242567-93de6f36f8eb', 'photo-1626645738196-c2a7c87a8f58'],
  bbq:           ['photo-1529193591184-b1d58069ecdd', 'photo-1544025162-d76694265947', 'photo-1558030006-450675393462', 'photo-1555939594-58d7cb561ad1', 'photo-1504674900247-0877df9cc836'],
  vegetarian:    ['photo-1512621776951-a57141f2eefd', 'photo-1540189549336-e6e99c3679fe', 'photo-1546793665-c74683f339c1', 'photo-1490474418585-ba9bad8fd0ea', 'photo-1529059997568-3d847b1154f0'],
  bakery:        ['photo-1509440159596-0249088772ff', 'photo-1464195244916-405fa0a82545', 'photo-1586444248902-2f64eddc13df', 'photo-1549931319-a545dcf3bc73', 'photo-1555507036-ab1f4038808a'],
  wings:         ['photo-1527477396000-e27163b481c2', 'photo-1598103442097-8b74394b95c4', 'photo-1604908176997-125f25cc6f3d', 'photo-1626645738196-c2a7c87a8f58', 'photo-1569058242567-93de6f36f8eb'],
  sandwich:      ['photo-1528735602780-2552fd46c7af', 'photo-1553909489-cd47e0907980', 'photo-1619096252214-ef06c45683e3', 'photo-1481070414801-51fd732d7184', 'photo-1521390188324-f1572c72cf1a'],
  fries:         ['photo-1576107232684-1279f2f81098', 'photo-1541592106381-b31e9677c0e5', 'photo-1518013431117-eb1465fa5463', 'photo-1565299507177-b0ac66763828', 'photo-1630384060421-cb20d0e0649d'],
  steak:         ['photo-1558030006-450675393462', 'photo-1529193591184-b1d58069ecdd', 'photo-1544025162-d76694265947', 'photo-1555939594-58d7cb561ad1', 'photo-1432139555190-58524dae6a55'],
  noodles:       ['photo-1569718212165-3a8278d5f624', 'photo-1585032226651-759b368d7246', 'photo-1555126634-323283e090fa', 'photo-1569058242567-93de6f36f8eb', 'photo-1525755662778-989d0524087e'],
  rice:          ['photo-1586201375761-83865001e31c', 'photo-1563245372-f21724e3856d', 'photo-1536304993881-ff86e0c9b5f1', 'photo-1512058556646-c4da40fba323', 'photo-1455619452474-d2be8b1e70cd'],
  cake:          ['photo-1578985545062-69928b1d9587', 'photo-1464219551459-ac14ae4854bc', 'photo-1563805042-7684c019e1cb', 'photo-1488477181946-6428a0291777', 'photo-1551024601-bec78aea704b'],
  ice_cream:     ['photo-1587613991119-fbbe8e90531d', 'photo-1568702846914-96b305d2aaeb', 'photo-1501443762994-82bd5dace89a', 'photo-1570197788417-0e82375c9371', 'photo-1497034825429-c343d7c6a68f'],
  juice:         ['photo-1546173159-315724a31696', 'photo-1600271886742-f049cd451bba', 'photo-1621506289937-a8e4df240d0b', 'photo-1559181567-c3190ca9be46', 'photo-1570696516188-ade861b84a49'],
  fish:          ['photo-1565565434363-1dd90b43e14e', 'photo-1559847844-5315695dadae', 'photo-1519708227418-c8fd9a32b7a2', 'photo-1534482421-64566f976cfa', 'photo-1580822184713-fc5400e7fe10'],
  hummus:        ['photo-1529059997568-3d847b1154f0', 'photo-1551248429-40975aa4de74', 'photo-1540189549336-e6e99c3679fe', 'photo-1490474418585-ba9bad8fd0ea', 'photo-1512621776951-a57141f2eefd'],
  mediterranean: ['photo-1529059997568-3d847b1154f0', 'photo-1551248429-40975aa4de74', 'photo-1540189549336-e6e99c3679fe', 'photo-1512621776951-a57141f2eefd', 'photo-1490474418585-ba9bad8fd0ea'],

  // ── Default fallback ──────────────────────
  default: [
    'photo-1546069901-ba9599a7e63c',
    'photo-1504674900247-0877df9cc836',
    'photo-1544025162-d76694265947',
    'photo-1574484284002-952d92456975',
    'photo-1512058564366-18510be2db19',
    'photo-1565299624946-b28f40a0ae38',
    'photo-1568901346375-23c9450c58cd',
    'photo-1579584425555-c3ce17fd4351',
    'photo-1585937421612-70a008356fbe',
    'photo-1562565652-a0d8f0c59eb4',
  ],
};

// ─── Keyword → pool mapping ───────────────────
export const NAME_KEYWORDS = [
  // Jamaican — FIRST
  { keywords: ['jerk chicken', 'jerk pork', 'jerk fish', 'jerk'],            pool: 'jerk'       },
  { keywords: ['oxtail', 'ox tail'],                                           pool: 'oxtail'     },
  { keywords: ['ackee and saltfish', 'ackee & saltfish', 'ackee'],           pool: 'ackee'      },
  { keywords: ['fried plantain', 'ripe plantain', 'plantain'],               pool: 'plantain'   },
  { keywords: ['fried dumpling', 'boiled dumpling', 'festival', 'dumpling'], pool: 'dumpling'   },
  { keywords: ['beef patty', 'chicken patty', 'coco bread', 'patty'],       pool: 'patty'      },
  { keywords: ['callaloo', 'calaloo'],                                         pool: 'callaloo'   },
  { keywords: ['cornmeal porridge', 'peanut porridge', 'porridge'],          pool: 'porridge'   },
  { keywords: ['bammy', 'bami'],                                               pool: 'bammy'      },
  { keywords: ['escovitch', 'escoveitch'],                                     pool: 'escovitch'  },
  { keywords: ['stew peas', 'stew chicken', 'brown stew'],                   pool: 'stew_peas'  },
  { keywords: ['sorrel'],                                                       pool: 'sorrel'     },
  { keywords: ['rice and peas', 'rice & peas', 'cook up rice', 'pelau'],    pool: 'rice'       },
  { keywords: ['curry goat', 'curry chicken', 'curried'],                    pool: 'curry'      },
  // Japanese
  { keywords: ['sushi', 'sashimi', 'maki', 'nigiri'],                        pool: 'sushi'      },
  { keywords: ['ramen', 'udon', 'soba'],                                       pool: 'ramen'      },
  // Mexican
  { keywords: ['taco', 'tacos'],                                               pool: 'taco'       },
  { keywords: ['burrito'],                                                      pool: 'taco'       },
  { keywords: ['nacho', 'nachos'],                                              pool: 'taco'       },
  // Italian
  { keywords: ['pizza', 'pepperoni', 'margherita'],                            pool: 'pizza'      },
  { keywords: ['pasta', 'spaghetti', 'fettuccine', 'penne'],                  pool: 'pasta'      },
  // American
  { keywords: ['burger', 'beef burger', 'chicken burger'],                     pool: 'burger'     },
  { keywords: ['buffalo wings', 'chicken wings', 'wings'],                    pool: 'wings'      },
  { keywords: ['sandwich', 'sub', 'wrap', 'panini'],                           pool: 'sandwich'   },
  { keywords: ['french fries', 'fries', 'chips'],                              pool: 'fries'      },
  { keywords: ['steak', 'ribeye', 'sirloin'],                                  pool: 'steak'      },
  // BBQ
  { keywords: ['bbq', 'barbeque', 'barbecue', 'ribs'],                        pool: 'bbq'        },
  // Indian
  { keywords: ['curry', 'masala', 'tikka', 'korma'],                          pool: 'curry'      },
  { keywords: ['naan', 'roti', 'paratha'],                                      pool: 'bakery'     },
  // General
  { keywords: ['fried chicken', 'grilled chicken', 'chicken'],                pool: 'chicken'    },
  { keywords: ['snapper', 'salmon', 'tilapia', 'cod', 'tuna', 'fish'],       pool: 'fish'       },
  { keywords: ['shrimp', 'prawn', 'lobster', 'crab', 'seafood'],             pool: 'seafood'    },
  { keywords: ['fried rice', 'rice'],                                           pool: 'rice'       },
  { keywords: ['soup', 'broth', 'chowder', 'bisque'],                         pool: 'soup'       },
  { keywords: ['salad', 'caesar', 'coleslaw'],                                 pool: 'salad'      },
  { keywords: ['ice cream', 'gelato', 'sorbet', 'sundae'],                    pool: 'ice_cream'  },
  { keywords: ['smoothie', 'milkshake', 'lemonade', 'juice'],                 pool: 'juice'      },
  { keywords: ['pancake', 'waffle', 'omelette', 'eggs', 'breakfast'],        pool: 'breakfast'  },
  { keywords: ['cake', 'brownie', 'cookie', 'pastry', 'muffin', 'bread'],   pool: 'bakery'     },
  { keywords: ['vegetarian', 'veggie', 'vegan'],                               pool: 'vegetarian' },
];

// ─── Category placeholders ────────────────────
const CATEGORY_PLACEHOLDERS = {
  appetizer:   'photo-1541014741259-de529411b96a',
  soup:        'photo-1547592180-85f173990554',
  salad:       'photo-1512621776951-a57141f2eefd',
  main_course: 'photo-1504674900247-0877df9cc836',
  side_dish:   'photo-1512058564366-18510be2db19',
  dessert:     'photo-1488477181946-6428a0291777',
  beverage:    'photo-1544145945-f90425340c7e',
  breakfast:   'photo-1533089860892-a7c6f0a88666',
  combo_meal:  'photo-1546069901-ba9599a7e63c',
  snack:       'photo-1604908176997-125f25cc6f3d',
};

// ─────────────────────────────────────────────
// getAutoFoodImage
// ✅ Returns Unsplash URL based on name/category
// No Firestore or Firebase Storage needed
// ─────────────────────────────────────────────
export function getAutoFoodImage(
  itemName = '',
  category = '',
  seed     = ''
) {
  const nameLower = itemName.toLowerCase().trim();
  const catLower  = (category || '').toLowerCase().trim();

  // No name — show category placeholder
  if (!nameLower) {
    const photoId =
      CATEGORY_PLACEHOLDERS[catLower] ||
      CATEGORY_PLACEHOLDERS['main_course'];
    return `https://images.unsplash.com/${photoId}?w=400&h=300&fit=crop&q=80`;
  }

  // Step 1: Match by keyword
  let poolName = null;
  let pool     = null;

  for (const entry of NAME_KEYWORDS) {
    const matched = entry.keywords.some(k => nameLower.includes(k));
    if (matched) {
      const targetPool = IMAGE_POOLS[entry.pool];
      if (targetPool && Array.isArray(targetPool) && targetPool.length > 0) {
        poolName = entry.pool;
        pool     = targetPool;
        break;
      }
    }
  }

  // Step 2: Category fallback
  if (!poolName) {
    if (IMAGE_POOLS[catLower]) {
      poolName = catLower;
      pool     = IMAGE_POOLS[catLower];
    } else {
      poolName = 'main_course';
      pool     = IMAGE_POOLS['main_course'];
    }
  }

  // Step 3: Safety
  if (!pool || pool.length === 0) {
    pool = IMAGE_POOLS['default'];
  }

  // Step 4: djb2 hash for consistent image selection
  let nameHash = 5381;
  for (let i = 0; i < nameLower.length; i++) {
    nameHash = ((nameHash << 5) + nameHash + nameLower.charCodeAt(i)) & 0x7fffffff;
  }

  let counter = 0;
  try {
    const match = seed.match(/-(\d+)$/);
    if (match) counter = parseInt(match[1], 10) || 0;
  } catch { counter = 0; }

  const index   = (nameHash + counter) % pool.length;
  const photoId = pool[index];

  return `https://images.unsplash.com/${photoId}?w=400&h=300&fit=crop&q=80`;
}

// ─────────────────────────────────────────────
// LEGACY STUBS
// ✅ These prevent crashes in files that still
// import from imageUpload.js
// Actual uploads now happen via Cloudinary
// ─────────────────────────────────────────────

export async function loadImageCache() {
  // ✅ No-op - no longer loads from Firestore
  // Cloudinary handles all image storage now
  return null;
}

export async function uploadImage(uri, path) {
  // ✅ Stub - use Cloudinary instead
  console.warn('uploadImage() is deprecated. Use Cloudinary instead.');
  return { success: false, error: 'Use Cloudinary for uploads' };
}

export async function uploadImageFromUrl(url, path) {
  // ✅ Stub - use Cloudinary instead
  console.warn('uploadImageFromUrl() is deprecated. Use Cloudinary instead.');
  return { success: false, error: 'Use Cloudinary for uploads' };
}

export async function downloadAndStoreAllImages() {
  // ✅ No-op
  console.warn('downloadAndStoreAllImages() is deprecated.');
  return { total: 0, success: 0, failed: 0, skipped: 0 };
}

export async function savePoolStructureToFirestore() {
  // ✅ No-op
  return false;
}

export { getAutoFoodImage as getAutoImage };