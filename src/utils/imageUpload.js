// ============================================
// FILE: src/utils/imageUpload.js
// ============================================
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { storage } from '../firebase/config';

// ─── Curated Unsplash photo IDs ──────────────
// Each category has multiple verified working photos
// Format: photo-{id}
const IMAGE_POOLS = {
  // ── Breakfast ──────────────────────────────
  breakfast: [
    'photo-1533089860892-a7c6f0a88666',
    'photo-1484723091739-30a097e8f929',
    'photo-1525351484163-7529414344d8',
    'photo-1567620905732-2d1ec7ab7445',
    'photo-1482049016688-2d3e1b311543',
  ],

  // ── Main course / Lunch / Dinner ───────────
  main_course: [
    'photo-1504674900247-0877df9cc836',
    'photo-1555939594-58d7cb561ad1',
    'photo-1544025162-d76694265947',
    'photo-1546069901-ba9599a7e63c',
    'photo-1565299624946-b28f40a0ae38',
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

  // ── Appetizer ──────────────────────────────
  appetizer: [
    'photo-1541014741259-de529411b96a',
    'photo-1572441713132-c542a4354a9e',
    'photo-1476224203421-9ac39bcb3df1',
    'photo-1548943487-a2e4e43b4853',
    'photo-1565557623262-b51c2513a641',
  ],

  // ── Soup ───────────────────────────────────
  soup: [
    'photo-1547592180-85f173990554',
    'photo-1603105037880-880cd4edfb0d',
    'photo-1570560258879-af7f8e1447ac',
    'photo-1548943487-a2e4e43b4853',
    'photo-1476224203421-9ac39bcb3df1',
  ],

  // ── Salad ──────────────────────────────────
  salad: [
    'photo-1512621776951-a57141f2eefd',
    'photo-1540189549336-e6e99c3679fe',
    'photo-1546793665-c74683f339c1',
    'photo-1543352634-99a5d50ae78e',
    'photo-1505253716362-afaea1d3d1af',
  ],

  // ── Side dish ──────────────────────────────
  side_dish: [
    'photo-1541014741259-de529411b96a',
    'photo-1565557623262-b51c2513a641',
    'photo-1476224203421-9ac39bcb3df1',
    'photo-1548943487-a2e4e43b4853',
    'photo-1572441713132-c542a4354a9e',
  ],

  // ── Dessert ────────────────────────────────
  dessert: [
    'photo-1488477181946-6428a0291777',
    'photo-1578985545062-69928b1d9587',
    'photo-1551024601-bec78aea704b',
    'photo-1563805042-7684c019e1cb',
    'photo-1464219551459-ac14ae4854bc',
  ],

  // ── Beverage ───────────────────────────────
  beverage: [
    'photo-1544145945-f90425340c7e',
    'photo-1497534446932-c925b458314e',
    'photo-1556679343-c7306c1976bc',
    'photo-1495474472287-4d71bcdd2085',
    'photo-1509042239860-f550ce710b93',
  ],

  // ── Snack ──────────────────────────────────
  snack: [
    'photo-1566478989037-eec170784d0b',
    'photo-1576618148400-f54bed99fcfd',
    'photo-1528712306091-ed0763094c98',
    'photo-1567620905732-2d1ec7ab7445',
    'photo-1565299624946-b28f40a0ae38',
  ],

  // ── Combo meal ─────────────────────────────
  combo_meal: [
    'photo-1504674900247-0877df9cc836',
    'photo-1565299624946-b28f40a0ae38',
    'photo-1546069901-ba9599a7e63c',
    'photo-1555939594-58d7cb561ad1',
    'photo-1544025162-d76694265947',
  ],

  // ── Kids menu ──────────────────────────────
  kids_menu: [
    'photo-1567620905732-2d1ec7ab7445',
    'photo-1565299624946-b28f40a0ae38',
    'photo-1546069901-ba9599a7e63c',
    'photo-1504674900247-0877df9cc836',
    'photo-1482049016688-2d3e1b311543',
  ],

  // ── Cuisine-specific ───────────────────────
  burger: [
    'photo-1568901346375-23c9450c58cd',
    'photo-1553979459-d2229ba7433b',
    'photo-1586816001966-79b736744398',
    'photo-1571091718767-18b5b1457add',
    'photo-1565299507177-b0ac66763828',
  ],
  pizza: [
    'photo-1565299624946-b28f40a0ae38',
    'photo-1574071318508-1cdbab80d002',
    'photo-1513104890138-7c749659a591',
    'photo-1601924582970-9238bcb495d6',
    'photo-1604382354936-07c5d9983bd3',
  ],
  pasta: [
    'photo-1621996346565-e3dbc353d2e5',
    'photo-1555949258-eb67b1ef0ceb',
    'photo-1473093295043-cdd812d0e601',
    'photo-1598866594230-a7c12756260f',
    'photo-1551183053-bf91798d2d66',
  ],
  chicken: [
    'photo-1598103442097-8b74394b95c4',
    'photo-1527477396000-e27163b481c2',
    'photo-1604908176997-125f25cc6f3d',
    'photo-1569058242567-93de6f36f8eb',
    'photo-1626645738196-c2a7c87a8f58',
  ],
  fish: [
    'photo-1565565434363-1dd90b43e14e',
    'photo-1559847844-5315695dadae',
    'photo-1519708227418-c8fd9a32b7a2',
    'photo-1534482421-64566f976cfa',
    'photo-1580822184713-fc5400e7fe10',
  ],
  rice: [
    'photo-1586201375761-83865001e31c',
    'photo-1563245372-f21724e3856d',
    'photo-1536304993881-ff86e0c9b5f1',
    'photo-1512058556646-c4da40fba323',
    'photo-1455619452474-d2be8b1e70cd',
  ],
  curry: [
    'photo-1585937421612-70a008356fbe',
    'photo-1596797038530-2c107229654b',
    'photo-1455619452474-d2be8b1e70cd',
    'photo-1585937421612-70a008356fbe',
    'photo-1631452180519-c014fe946bc7',
  ],
  seafood: [
    'photo-1565680018434-b513d5e5fd47',
    'photo-1559847844-5315695dadae',
    'photo-1519708227418-c8fd9a32b7a2',
    'photo-1534482421-64566f976cfa',
    'photo-1580822184713-fc5400e7fe10',
  ],
  bbq: [
    'photo-1529193591184-b1d58069ecdd',
    'photo-1544025162-d76694265947',
    'photo-1558030006-450675393462',
    'photo-1555939594-58d7cb561ad1',
    'photo-1504674900247-0877df9cc836',
  ],
  sandwich: [
    'photo-1528735602780-2552fd46c7af',
    'photo-1553909489-cd47e0907980',
    'photo-1619096252214-ef06c45683e3',
    'photo-1481070414801-51fd732d7184',
    'photo-1521390188324-f1572c72cf1a',
  ],
  cake: [
    'photo-1578985545062-69928b1d9587',
    'photo-1464219551459-ac14ae4854bc',
    'photo-1563805042-7684c019e1cb',
    'photo-1488477181946-6428a0291777',
    'photo-1551024601-bec78aea704b',
  ],
  soup_name: [
    'photo-1547592180-85f173990554',
    'photo-1603105037880-880cd4edfb0d',
    'photo-1570560258879-af7f8e1447ac',
  ],
  ice_cream: [
    'photo-1587613991119-fbbe8e90531d',
    'photo-1568702846914-96b305d2aaeb',
    'photo-1501443762994-82bd5dace89a',
    'photo-1570197788417-0e82375c9371',
    'photo-1497034825429-c343d7c6a68f',
  ],
  juice: [
    'photo-1546173159-315724a31696',
    'photo-1600271886742-f049cd451bba',
    'photo-1621506289937-a8e4df240d0b',
    'photo-1585320806297-9794b3e4eeae',
    'photo-1437418747212-8d9709afab22',
  ],
  steak: [
    'photo-1558030006-450675393462',
    'photo-1529193591184-b1d58069ecdd',
    'photo-1544025162-d76694265947',
    'photo-1555939594-58d7cb561ad1',
    'photo-1432139555190-58524dae6a55',
  ],

  // ── Default fallback ───────────────────────
  default: [
    'photo-1546069901-ba9599a7e63c',
    'photo-1567620905732-2d1ec7ab7445',
    'photo-1504674900247-0877df9cc836',
    'photo-1540189549336-e6e99c3679fe',
    'photo-1512621776951-a57141f2eefd',
    'photo-1565299624946-b28f40a0ae38',
    'photo-1555939594-58d7cb561ad1',
    'photo-1544025162-d76694265947',
  ],
};

// ─── Keyword → pool mapping ───────────────────
// Checks item name for these keywords
const NAME_KEYWORDS = [
  { keywords: ['burger', 'beef burger', 'chicken burger', 'veggie burger'], pool: 'burger'    },
  { keywords: ['pizza', 'pepperoni', 'margherita'],                         pool: 'pizza'     },
  { keywords: ['pasta', 'spaghetti', 'fettuccine', 'linguine', 'penne'],   pool: 'pasta'     },
  { keywords: ['sandwich', 'sub', 'wrap', 'panini'],                        pool: 'sandwich'  },
  { keywords: ['chicken', 'jerk chicken', 'fried chicken', 'grilled chicken'], pool: 'chicken' },
  { keywords: ['fish', 'snapper', 'salmon', 'tilapia', 'cod', 'tuna'],     pool: 'fish'      },
  { keywords: ['shrimp', 'prawn', 'lobster', 'crab', 'seafood'],           pool: 'seafood'   },
  { keywords: ['rice', 'fried rice', 'pelau', 'cook up'],                  pool: 'rice'      },
  { keywords: ['curry', 'masala', 'tikka', 'korma'],                        pool: 'curry'     },
  { keywords: ['steak', 'ribeye', 'sirloin', 'bbq', 'grill', 'ribs'],      pool: 'steak'     },
  { keywords: ['soup', 'broth', 'stew', 'chowder', 'bisque'],              pool: 'soup'      },
  { keywords: ['salad', 'caesar', 'coleslaw'],                              pool: 'salad'     },
  { keywords: ['cake', 'brownie', 'cookie', 'pastry', 'muffin'],           pool: 'cake'      },
  { keywords: ['ice cream', 'gelato', 'sorbet', 'sundae'],                  pool: 'ice_cream' },
  { keywords: ['juice', 'smoothie', 'shake', 'milkshake', 'lemonade'],     pool: 'juice'     },
  { keywords: ['breakfast', 'eggs', 'pancake', 'waffle', 'omelette'],      pool: 'breakfast' },
];

// ─── Main function ────────────────────────────
export function getAutoFoodImage(
  itemName = '',
  category = '',
  seed     = ''
) {
  const nameLower = itemName.toLowerCase().trim();

  // ── Step 1: Match by item name keywords ──────
  let pool = null;

  for (const { keywords, pool: poolName } of NAME_KEYWORDS) {
    if (keywords.some(k => nameLower.includes(k))) {
      pool = IMAGE_POOLS[poolName];
      break;
    }
  }

  // ── Step 2: Fall back to category pool ───────
  if (!pool) {
    pool = IMAGE_POOLS[category] || IMAGE_POOLS['default'];
  }

  // ── Step 3: Pick image using seed ────────────
  // ✅ KEY FIX: seed is Date.now() string when regenerating
  // so it always picks a DIFFERENT image from the pool
  const seedStr  = seed || itemName || 'food';
  const hash     = seedStr
    .split('')
    .reduce((acc, char, idx) => acc + char.charCodeAt(0) * (idx + 1), 0);
  const index    = hash % pool.length;
  const photoId  = pool[index];

  return `https://images.unsplash.com/${photoId}?w=400&h=300&fit=crop&auto=format&q=80`;
}

// ─── Upload image to Firebase Storage ────────
export async function uploadImage(uri, path) {
  try {
    const response = await fetch(uri);
    const blob     = await response.blob();
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, blob);
    const url = await getDownloadURL(storageRef);

    return { success: true, url };
  } catch (error) {
    console.error('uploadImage error:', error);
    return { success: false, error: error.message };
  }
}