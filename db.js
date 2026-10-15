const fs = require('fs');
const path = require('path');

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  try {
    Database = require('/usr/lib/node_modules/better-sqlite3');
  } catch (e2) {
    Database = require('/home/mahesh/Documents/Hotel-Software/node_modules/better-sqlite3');
  }
}

const candidatePaths = [
  path.join(__dirname, 'data', 'sikar_drop.db'),
  path.join(process.cwd(), 'data', 'sikar_drop.db'),
  path.join(__dirname, '..', 'data', 'sikar_drop.db')
];
let sourceDbPath = candidatePaths.find(p => fs.existsSync(p)) || candidatePaths[0];

let DB_PATH = sourceDbPath;
if (process.env.VERCEL) {
  const tmpDbPath = '/tmp/sikar_drop.db';
  if (!fs.existsSync(tmpDbPath) && fs.existsSync(sourceDbPath)) {
    try {
      fs.copyFileSync(sourceDbPath, tmpDbPath);
    } catch (e) {
      console.warn('Failed to copy DB to /tmp, using source path:', e.message);
    }
  }
  if (fs.existsSync(tmpDbPath)) {
    DB_PATH = tmpDbPath;
  }
} else {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}


const db = new Database(DB_PATH);

// Journal mode configuration: DELETE mode for Vercel serverless to avoid mmap/shm locks, WAL for local daemon
if (process.env.VERCEL) {
  try { db.pragma('journal_mode = DELETE'); } catch (e) {}
} else {
  try { db.pragma('journal_mode = WAL'); } catch (e) {}
}
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    -- 1. PRODUCTS TABLE
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      mrp REAL NOT NULL,
      cost REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 10,
      spec TEXT,
      image TEXT,
      description TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      seo_title TEXT,
      seo_desc TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);

    -- 2. CATEGORIES TABLE
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tagline TEXT,
      image TEXT,
      display_order INTEGER DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    -- 3. CUSTOMERS TABLE
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      corridor TEXT,
      address TEXT,
      verified INTEGER DEFAULT 0,
      total_orders INTEGER DEFAULT 0,
      lifetime_spend REAL DEFAULT 0.0,
      outstanding_balance REAL DEFAULT 0.0,
      created_at TEXT NOT NULL,
      last_activity TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

    -- 4. INVENTORY MOVEMENTS (CENTRAL AUDIT LEDGER - SINGLE SOURCE OF TRUTH)
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      movement_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      before_stock INTEGER NOT NULL,
      after_stock INTEGER NOT NULL,
      reference_id TEXT,
      reason TEXT,
      actor TEXT DEFAULT 'Admin',
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_movements_prod ON inventory_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_movements_date ON inventory_movements(created_at);

    -- 5. ORDERS TABLE (ONLINE STOREFRONT ORDERS)
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      login_phone TEXT DEFAULT '',
      delivery_phone TEXT DEFAULT '',
      corridor TEXT,
      delivery_address TEXT,
      items_json TEXT NOT NULL,
      items_count INTEGER DEFAULT 0,
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0.0,
      total REAL NOT NULL,
      payment_method TEXT DEFAULT 'COD',
      payment_status TEXT DEFAULT 'Pending',
      status TEXT DEFAULT 'pending',
      vehicle TEXT,
      order_date TEXT NOT NULL,
      delivery_time TEXT,
      notes TEXT,
      activity_log_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone);

    -- 6. MANUAL CASH SALES (POS DIRECT SALES)
    CREATE TABLE IF NOT EXISTS manual_sales (
      id TEXT PRIMARY KEY,
      idempotency_token TEXT UNIQUE,
      customer_id TEXT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      items_json TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0.0,
      total_amount REAL NOT NULL,
      amount_received REAL NOT NULL,
      outstanding_amount REAL NOT NULL DEFAULT 0.0,
      payment_method TEXT DEFAULT 'Cash',
      sale_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sales_phone ON manual_sales(customer_phone);

    -- 7. PAYMENTS LEDGER (CROSS-CHANNEL CENTRAL PAYMENTS RECORD)
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      reference_type TEXT NOT NULL,
      reference_id TEXT,
      amount REAL NOT NULL,
      previous_balance REAL DEFAULT 0.0,
      new_balance REAL DEFAULT 0.0,
      payment_method TEXT DEFAULT 'Cash',
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_payments_cust ON payments(customer_id);

    -- 8. KHATA DUES & REMINDERS TABLE
    CREATE TABLE IF NOT EXISTS khata_entries (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0.0,
      remaining_amount REAL NOT NULL,
      reason TEXT,
      due_date TEXT,
      reminder_date TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      whatsapp_reminded_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_khata_due ON khata_entries(due_date);
    CREATE INDEX IF NOT EXISTS idx_khata_status ON khata_entries(status);

    -- 9. PURCHASES (SUPPLIER INWARD INVOICES)
    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      supplier_name TEXT NOT NULL,
      supplier_phone TEXT,
      product_id TEXT NOT NULL,
      product_title TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit_cost REAL NOT NULL,
      total_cost REAL NOT NULL,
      bill_no TEXT,
      invoice_date TEXT NOT NULL,
      payment_method TEXT DEFAULT 'Bank Transfer',
      payment_status TEXT DEFAULT 'Paid',
      status TEXT DEFAULT 'received',
      notes TEXT,
      created_at TEXT NOT NULL
    );

    -- 10. SUPPLIERS TABLE
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      contact_person TEXT,
      created_at TEXT NOT NULL
    );

    -- 11. COUPONS TABLE
    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      discount_type TEXT DEFAULT 'percentage',
      discount_val REAL NOT NULL,
      min_order REAL DEFAULT 0.0,
      max_discount REAL DEFAULT 0.0,
      usage_limit INTEGER DEFAULT 100,
      per_user_limit INTEGER DEFAULT 1,
      used_count INTEGER DEFAULT 0,
      expiry_date TEXT,
      active INTEGER DEFAULT 1,
      desc TEXT,
      created_at TEXT NOT NULL
    );

    -- 12. REVIEWS TABLE
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      role TEXT,
      location TEXT,
      product_id TEXT,
      rating INTEGER NOT NULL DEFAULT 5,
      quote TEXT NOT NULL,
      reply TEXT,
      reply_date TEXT,
      status TEXT DEFAULT 'approved',
      created_at TEXT NOT NULL
    );

    -- 13. WEBSITE CONTENT CMS
    CREATE TABLE IF NOT EXISTS website_content (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 14. FESTIVAL THEMES
    CREATE TABLE IF NOT EXISTS festival_themes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      banner_img TEXT,
      promo_text TEXT,
      primary_color TEXT,
      accent_color TEXT,
      start_date TEXT,
      end_date TEXT,
      active INTEGER DEFAULT 0
    );

    -- 15. WEBSITE SETTINGS
    CREATE TABLE IF NOT EXISTS website_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 16. ADMIN USERS & RBAC PERMISSIONS
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      pin TEXT NOT NULL,
      password_hash TEXT,
      permissions_json TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      last_login TEXT
    );

    -- 17. AUDIT LOGS
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );

    -- 18. CONTACT ENQUIRIES
    CREATE TABLE IF NOT EXISTS contact_enquiries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'unread',
      created_at TEXT NOT NULL
    );

    -- 19. SOCIAL ANALYTICS
    CREATE TABLE IF NOT EXISTS social_analytics (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      source_page TEXT,
      action_type TEXT,
      created_at TEXT NOT NULL
    );

    -- 20. OTP CODES & RATE LIMITING
    CREATE TABLE IF NOT EXISTS otp_codes (
      phone TEXT PRIMARY KEY,
      otp_code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      verified INTEGER DEFAULT 0,
      last_sent TEXT NOT NULL
    );

    -- 21. SERVICEABLE DELIVERY ZONES & PINCODES (ADMIN CONFIGURABLE)
    CREATE TABLE IF NOT EXISTS delivery_zones (
      id TEXT PRIMARY KEY,
      area_name TEXT NOT NULL,
      pincode TEXT NOT NULL DEFAULT '332001',
      corridor TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '',
      eta TEXT NOT NULL DEFAULT '45-60 Mins Express Tempo',
      min_order REAL DEFAULT 0.0,
      delivery_charge REAL DEFAULT 0.0,
      serviceable INTEGER DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    -- 22. WHOLESALE EVENT BUNDLES & COMMERCIAL PACKAGES (ADMIN MANAGED)
    CREATE TABLE IF NOT EXISTS event_bundles (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL DEFAULT 'wedding',
      title TEXT NOT NULL,
      desc TEXT,
      price REAL NOT NULL DEFAULT 0,
      mrp REAL NOT NULL DEFAULT 0,
      save_amt REAL DEFAULT 0,
      save_pct INTEGER DEFAULT 0,
      badge TEXT DEFAULT '',
      badge_class TEXT DEFAULT 'deal',
      image TEXT DEFAULT '',
      specs_json TEXT DEFAULT '[]',
      items_json TEXT DEFAULT '[]',
      active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);

  // Seed default Sikar delivery zones if table is empty
  try {
    const zoneCount = db.prepare('SELECT COUNT(*) as c FROM delivery_zones').get().c;
    if (zoneCount === 0) {
      const nowIso = new Date().toISOString();
      const defaultZones = [
        {
          id: 'zone-piprali',
          area_name: 'Piprali Road (Coaching Hub & Marriage Gardens)',
          pincode: '332001',
          corridor: 'Piprali Road',
          keywords: 'piprali road, piprali, clc, allen, matrix, prince school, gokulpura, surya nagar, nh52, 332001',
          eta: '45-60 Mins Express Tempo',
          min_order: 0,
          delivery_charge: 0,
          serviceable: 1
        },
        {
          id: 'zone-nawalgarh',
          area_name: 'Nawalgarh Road & Pullia Market',
          pincode: '332001',
          corridor: 'Nawalgarh Road',
          keywords: 'nawalgarh road, nawalgarh, pullia, pulia, bajor, vrindavan city, housing board, 332001',
          eta: '45-60 Mins Express Tempo',
          min_order: 0,
          delivery_charge: 0,
          serviceable: 1
        },
        {
          id: 'zone-station',
          area_name: 'Station Road, Subhash Chowk & Krishi Mandi',
          pincode: '332001',
          corridor: 'Station Road & Krishi Mandi',
          keywords: 'station road, krishi mandi, mandi, subhash chowk, jaat bazar, clock tower, kalyan circle, railway station, 332001',
          eta: '45-60 Mins Direct Tempo',
          min_order: 0,
          delivery_charge: 0,
          serviceable: 1
        },
        {
          id: 'zone-fatehpur',
          area_name: 'Fatehpur Road & Sabalpura Corridor',
          pincode: '332001',
          corridor: 'Fatehpur Road',
          keywords: 'fatehpur road, fatehpur, sabalpura, eidgah, radhakishanpura, nh11, 332001',
          eta: '60-90 Mins Tempo Dispatch',
          min_order: 0,
          delivery_charge: 0,
          serviceable: 1
        },
        {
          id: 'zone-ranisati',
          area_name: 'Rani Sati Road, Silver Jubilee & Collectorate',
          pincode: '332001',
          corridor: 'Rani Sati & Silver Jubilee Road',
          keywords: 'rani sati, silver jubilee, collectorate, police line, maru school, dhod road, civil lines, 332001',
          eta: '60-75 Mins Tempo Dispatch',
          min_order: 0,
          delivery_charge: 0,
          serviceable: 1
        },
        {
          id: 'zone-salasar',
          area_name: 'Salasar Stand, Jaipur Road & Industrial Area',
          pincode: '332001',
          corridor: 'Jaipur Road & RIICO',
          keywords: 'salasar road, salasar stand, jaipur road, riico, industrial area, kudli, palwas road, 332001',
          eta: '60-90 Mins Tempo Dispatch',
          min_order: 0,
          delivery_charge: 0,
          serviceable: 1
        }
      ];
      const insZone = db.prepare(`
        INSERT INTO delivery_zones (id, area_name, pincode, corridor, keywords, eta, min_order, delivery_charge, serviceable, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      db.transaction(() => {
        defaultZones.forEach(z => insZone.run(z.id, z.area_name, z.pincode, z.corridor, z.keywords, z.eta, z.min_order, z.delivery_charge, z.serviceable, nowIso));
      })();
    }
  } catch (zErr) {
    console.warn('Delivery zones seed notice:', zErr.message);
  }

  // Seed default Wholesale Event Bundles if table is empty
  try {
    const bundleCount = db.prepare('SELECT COUNT(*) as c FROM event_bundles').get().c;
    if (bundleCount === 0) {
      const nowIso = new Date().toISOString();
      const insertBundle = db.prepare(`
        INSERT INTO event_bundles (id, category, title, desc, price, mrp, save_amt, save_pct, badge, badge_class, image, specs_json, items_json, active, sort_order, updated_at)
        VALUES (@id, @category, @title, @desc, @price, @mrp, @save_amt, @save_pct, @badge, @badge_class, @image, @specs_json, @items_json, @active, @sort_order, @updated_at)
      `);
      const defaultBundles = [
        {
          id: 'b1',
          category: 'wedding',
          title: 'Shaadi & Banquet VIP Hydration Pack',
          desc: 'Complete water & banquet setup for marriages, ring ceremonies, and family gatherings of 200–500 guests in Sikar.',
          price: 4699,
          mrp: 5860,
          save_amt: 1161,
          save_pct: 20,
          badge: 'Wedding Favorite',
          badge_class: 'popular',
          image: 'assets/bundle_wedding_vip.jpg',
          specs_json: JSON.stringify([
            '10x Shaadi Mini Water Petis (48x 250ml Sealed)',
            '5x Bailey / Kinley 1L Packaged Cases (60 Bottles)',
            '2x Real Fruit Power Mixed Juices (24x 1L Packs)',
            'Strict Zero 20L Campers • 100% Tamper-Proof'
          ]),
          items_json: JSON.stringify([{ id: 'p7', qty: 10 }, { id: 'p3', qty: 5 }, { id: 'p6', qty: 2 }]),
          active: 1,
          sort_order: 1,
          updated_at: nowIso
        },
        {
          id: 'b2',
          category: 'hostel',
          title: 'Coaching Hostel & PG Hydration Deal',
          desc: 'Scheduled recurring cases for students and staff. Pure certified mineral water with doorstep tempo unloading.',
          price: 3250,
          mrp: 3960,
          save_amt: 710,
          save_pct: 18,
          badge: 'Piprali / Nawalgarh Rd',
          badge_class: 'deal',
          image: 'assets/bundle_hostel_hydration.jpg',
          specs_json: JSON.stringify([
            '15x Bailey 1L Packaged Cases (180 Bottles)',
            '4x Aquafina 500ml Compact Petis (96 Bottles)',
            'Daily Morning Scheduled Tempo Delivery',
            'Official Bilty & GST Tax Invoice Included'
          ]),
          items_json: JSON.stringify([{ id: 'p3', qty: 15 }, { id: 'p4', qty: 4 }]),
          active: 1,
          sort_order: 2,
          updated_at: nowIso
        },
        {
          id: 'b3',
          category: 'party',
          title: 'Summer Party & Soft Drinks Mega Crate',
          desc: 'Chilled party mix for celebrations, birthdays, catering, and festive get-togethers in Sikar.',
          price: 2999,
          mrp: 3620,
          save_amt: 621,
          save_pct: 17,
          badge: 'Instant Dispatch',
          badge_class: 'hot',
          image: 'assets/bundle_summer_party.jpg',
          specs_json: JSON.stringify([
            '2x Coca-Cola 750ml Party Crates (48 Bottles)',
            '2x Thums Up 250ml PET Crates (48 Bottles)',
            '1x Chilled Soda & Soft Drink Cans Tray (24 Cans)',
            'Mandi Depot Cold Stash Priority Option'
          ]),
          items_json: JSON.stringify([{ id: 'p5', qty: 2 }, { id: 'p8', qty: 2 }, { id: 'p11', qty: 1 }]),
          active: 1,
          sort_order: 3,
          updated_at: nowIso
        },
        {
          id: 'b4',
          category: 'kirana',
          title: 'Kirana Retailer High-Margin Starter Pack',
          desc: 'Top 3 fastest-selling packaged beverages in Sikar for local provision and general stores.',
          price: 1980,
          mrp: 2380,
          save_amt: 400,
          save_pct: 17,
          badge: 'Kirana Restock',
          badge_class: 'deal',
          image: 'assets/bundle_kirana_starter.jpg',
          specs_json: JSON.stringify([
            '40x Bisleri 1L Mineral Water Bottles',
            '2x Frooti & Maaza Mango Juice Trays (60 Packs)',
            '2x Thums Up 250ml PET Crates (48 Bottles)',
            'Same-Day Depot Re-Stocking Guarantee'
          ]),
          items_json: JSON.stringify([{ id: 'p1', qty: 40 }, { id: 'p9', qty: 2 }, { id: 'p8', qty: 2 }]),
          active: 1,
          sort_order: 4,
          updated_at: nowIso
        }
      ];
      db.transaction(() => {
        defaultBundles.forEach(b => insertBundle.run(b));
      })();
      console.log('Seeded default event bundles into event_bundles table');
    }
  } catch (bErr) {
    console.warn('Event bundles seed notice:', bErr.message);
  }

  // Ensure login_phone and delivery_phone columns exist on orders table
  try {
    const orderCols = db.prepare("PRAGMA table_info(orders)").all().map(c => c.name);
    if (!orderCols.includes('login_phone')) {
      db.exec("ALTER TABLE orders ADD COLUMN login_phone TEXT DEFAULT ''");
    }
    if (!orderCols.includes('delivery_phone')) {
      db.exec("ALTER TABLE orders ADD COLUMN delivery_phone TEXT DEFAULT ''");
    }
    // Backfill login_phone and delivery_phone where empty
    db.exec("UPDATE orders SET login_phone = customer_phone WHERE login_phone IS NULL OR login_phone = ''");
    db.exec("UPDATE orders SET delivery_phone = customer_phone WHERE delivery_phone IS NULL OR delivery_phone = ''");
    // Ensure sample orders demonstrate both cases:
    // SKR-8421 & SKR-5539 have distinct Login Phone vs Address/Delivery Phone (so 2 numbers show)
    // SKR-7612 & SKR-3204 have identical Login Phone & Address Phone (so 1 single number shows)
    db.prepare("UPDATE orders SET login_phone = '9829012345', delivery_phone = '9414088990' WHERE id = 'SKR-8421'").run();
    db.prepare("UPDATE orders SET login_phone = '9829044556', delivery_phone = '9829077112' WHERE id = 'SKR-5539'").run();
    db.prepare("UPDATE orders SET login_phone = '9829067890', delivery_phone = '9829067890' WHERE id = 'SKR-7612'").run();
    db.prepare("UPDATE orders SET login_phone = '9829099887', delivery_phone = '9829099887' WHERE id = 'SKR-3204'").run();
  } catch (migErr) {
    console.warn('Orders phone columns migration notice:', migErr.message);
  }

  // Ensure UTM and attribution columns exist on orders table
  try {
    const orderCols = db.prepare("PRAGMA table_info(orders)").all().map(c => c.name);
    const neededOrderCols = [
      ['utm_source', "TEXT DEFAULT ''"],
      ['utm_medium', "TEXT DEFAULT ''"],
      ['utm_campaign', "TEXT DEFAULT ''"],
      ['utm_content', "TEXT DEFAULT ''"],
      ['utm_term', "TEXT DEFAULT ''"],
      ['attribution_platform', "TEXT DEFAULT ''"],
      ['session_id', "TEXT DEFAULT ''"]
    ];
    for (const [col, colType] of neededOrderCols) {
      if (!orderCols.includes(col)) {
        db.exec(`ALTER TABLE orders ADD COLUMN ${col} ${colType}`);
      }
    }
    // Backfill historical orders with representative attribution if empty
    db.prepare("UPDATE orders SET utm_source = 'instagram', utm_medium = 'stories', utm_campaign = 'wedding_season_2026', utm_content = 'wedding_pack_video', attribution_platform = 'instagram' WHERE id = 'SKR-8421' AND (utm_campaign IS NULL OR utm_campaign = '')").run();
    db.prepare("UPDATE orders SET utm_source = 'facebook', utm_medium = 'feed', utm_campaign = 'diwali_bulk_mandi', utm_content = 'coke_crate_ad', attribution_platform = 'facebook' WHERE id = 'SKR-5539' AND (utm_campaign IS NULL OR utm_campaign = '')").run();
    db.prepare("UPDATE orders SET utm_source = 'whatsapp', utm_medium = 'broadcast', utm_campaign = 'mandi_vip_broadcast', utm_content = 'whatsapp_catalog_link', attribution_platform = 'whatsapp' WHERE id = 'SKR-3204' AND (utm_campaign IS NULL OR utm_campaign = '')").run();
    db.prepare("UPDATE orders SET utm_source = 'google', utm_medium = 'cpc', utm_campaign = 'sikar_water_search', utm_content = 'mineral_water_sikar', attribution_platform = 'google' WHERE id = 'SKR-7612' AND (utm_campaign IS NULL OR utm_campaign = '')").run();
  } catch (err) {
    console.warn('Orders attribution columns migration notice:', err.message);
  }

  // Ensure extended tracking columns exist on social_analytics table
  try {
    const socCols = db.prepare("PRAGMA table_info(social_analytics)").all().map(c => c.name);
    const neededSocCols = [
      ['session_id', "TEXT DEFAULT ''"],
      ['visitor_id', "TEXT DEFAULT ''"],
      ['utm_source', "TEXT DEFAULT ''"],
      ['utm_medium', "TEXT DEFAULT ''"],
      ['utm_campaign', "TEXT DEFAULT ''"],
      ['utm_content', "TEXT DEFAULT ''"],
      ['utm_term', "TEXT DEFAULT ''"],
      ['referrer', "TEXT DEFAULT ''"],
      ['order_id', "TEXT DEFAULT ''"],
      ['order_value', "REAL DEFAULT 0.0"],
      ['metadata_json', "TEXT DEFAULT '{}'"],
      ['ip_hash', "TEXT DEFAULT ''"]
    ];
    for (const [col, colType] of neededSocCols) {
      if (!socCols.includes(col)) {
        db.exec(`ALTER TABLE social_analytics ADD COLUMN ${col} ${colType}`);
      }
    }

    // Seed representative campaign funnel events if table has only legacy click records
    const eventCount = db.prepare("SELECT COUNT(*) as c FROM social_analytics WHERE action_type != 'click_button'").get().c;
    if (eventCount === 0) {
      const nowIso = new Date().toISOString();
      const sampleEvents = [
        // Instagram Campaign: wedding_season_2026
        { sid: 'sess_ig_101', vid: 'vis_ig_1', plat: 'instagram', src: 'instagram', med: 'stories', cmp: 'wedding_season_2026', cnt: 'wedding_pack_video', act: 'page_view', page: '/index.html', ord: '', val: 0 },
        { sid: 'sess_ig_101', vid: 'vis_ig_1', plat: 'instagram', src: 'instagram', med: 'stories', cmp: 'wedding_season_2026', cnt: 'wedding_pack_video', act: 'product_view', page: '/products.html', ord: '', val: 0 },
        { sid: 'sess_ig_101', vid: 'vis_ig_1', plat: 'instagram', src: 'instagram', med: 'stories', cmp: 'wedding_season_2026', cnt: 'wedding_pack_video', act: 'add_to_cart', page: '/products.html', ord: '', val: 0 },
        { sid: 'sess_ig_101', vid: 'vis_ig_1', plat: 'instagram', src: 'instagram', med: 'stories', cmp: 'wedding_season_2026', cnt: 'wedding_pack_video', act: 'checkout_start', page: '/cart.html', ord: '', val: 0 },
        { sid: 'sess_ig_101', vid: 'vis_ig_1', plat: 'instagram', src: 'instagram', med: 'stories', cmp: 'wedding_season_2026', cnt: 'wedding_pack_video', act: 'purchase_complete', page: '/cart.html', ord: 'SKR-8421', val: 23200 },

        // Facebook Campaign: diwali_bulk_mandi
        { sid: 'sess_fb_201', vid: 'vis_fb_1', plat: 'facebook', src: 'facebook', med: 'feed', cmp: 'diwali_bulk_mandi', cnt: 'coke_crate_ad', act: 'page_view', page: '/index.html', ord: '', val: 0 },
        { sid: 'sess_fb_201', vid: 'vis_fb_1', plat: 'facebook', src: 'facebook', med: 'feed', cmp: 'diwali_bulk_mandi', cnt: 'coke_crate_ad', act: 'product_view', page: '/products.html', ord: '', val: 0 },
        { sid: 'sess_fb_201', vid: 'vis_fb_1', plat: 'facebook', src: 'facebook', med: 'feed', cmp: 'diwali_bulk_mandi', cnt: 'coke_crate_ad', act: 'add_to_cart', page: '/products.html', ord: '', val: 0 },
        { sid: 'sess_fb_201', vid: 'vis_fb_1', plat: 'facebook', src: 'facebook', med: 'feed', cmp: 'diwali_bulk_mandi', cnt: 'coke_crate_ad', act: 'checkout_start', page: '/cart.html', ord: '', val: 0 },
        { sid: 'sess_fb_201', vid: 'vis_fb_1', plat: 'facebook', src: 'facebook', med: 'feed', cmp: 'diwali_bulk_mandi', cnt: 'coke_crate_ad', act: 'purchase_complete', page: '/cart.html', ord: 'SKR-5539', val: 8900 },

        // WhatsApp Broadcast: mandi_vip_broadcast
        { sid: 'sess_wa_301', vid: 'vis_wa_1', plat: 'whatsapp', src: 'whatsapp', med: 'broadcast', cmp: 'mandi_vip_broadcast', cnt: 'whatsapp_catalog_link', act: 'page_view', page: '/index.html', ord: '', val: 0 },
        { sid: 'sess_wa_301', vid: 'vis_wa_1', plat: 'whatsapp', src: 'whatsapp', med: 'broadcast', cmp: 'mandi_vip_broadcast', cnt: 'whatsapp_catalog_link', act: 'product_view', page: '/products.html', ord: '', val: 0 },
        { sid: 'sess_wa_301', vid: 'vis_wa_1', plat: 'whatsapp', src: 'whatsapp', med: 'broadcast', cmp: 'mandi_vip_broadcast', cnt: 'whatsapp_catalog_link', act: 'add_to_cart', page: '/products.html', ord: '', val: 0 },
        { sid: 'sess_wa_301', vid: 'vis_wa_1', plat: 'whatsapp', src: 'whatsapp', med: 'broadcast', cmp: 'mandi_vip_broadcast', cnt: 'whatsapp_catalog_link', act: 'checkout_start', page: '/cart.html', ord: '', val: 0 },
        { sid: 'sess_wa_301', vid: 'vis_wa_1', plat: 'whatsapp', src: 'whatsapp', med: 'broadcast', cmp: 'mandi_vip_broadcast', cnt: 'whatsapp_catalog_link', act: 'purchase_complete', page: '/cart.html', ord: 'SKR-3204', val: 10150 },

        // Google CPC: sikar_water_search
        { sid: 'sess_gg_401', vid: 'vis_gg_1', plat: 'google', src: 'google', med: 'cpc', cmp: 'sikar_water_search', cnt: 'mineral_water_sikar', act: 'page_view', page: '/index.html', ord: '', val: 0 },
        { sid: 'sess_gg_401', vid: 'vis_gg_1', plat: 'google', src: 'google', med: 'cpc', cmp: 'sikar_water_search', cnt: 'mineral_water_sikar', act: 'product_view', page: '/products.html', ord: '', val: 0 },
        { sid: 'sess_gg_401', vid: 'vis_gg_1', plat: 'google', src: 'google', med: 'cpc', cmp: 'sikar_water_search', cnt: 'mineral_water_sikar', act: 'add_to_cart', page: '/products.html', ord: '', val: 0 },
        { sid: 'sess_gg_401', vid: 'vis_gg_1', plat: 'google', src: 'google', med: 'cpc', cmp: 'sikar_water_search', cnt: 'mineral_water_sikar', act: 'checkout_start', page: '/cart.html', ord: '', val: 0 },
        { sid: 'sess_gg_401', vid: 'vis_gg_1', plat: 'google', src: 'google', med: 'cpc', cmp: 'sikar_water_search', cnt: 'mineral_water_sikar', act: 'purchase_complete', page: '/cart.html', ord: 'SKR-7612', val: 3600 },

        // Direct organic sessions
        { sid: 'sess_dir_501', vid: 'vis_dir_1', plat: 'direct', src: 'direct', med: 'organic', cmp: '', cnt: '', act: 'page_view', page: '/index.html', ord: '', val: 0 },
        { sid: 'sess_dir_501', vid: 'vis_dir_1', plat: 'direct', src: 'direct', med: 'organic', cmp: '', cnt: '', act: 'product_view', page: '/products.html', ord: '', val: 0 }
      ];

      const insertStmt = db.prepare(`
        INSERT INTO social_analytics (id, session_id, visitor_id, platform, source_page, action_type, utm_source, utm_medium, utm_campaign, utm_content, utm_term, order_id, order_value, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, '{}', ?)
      `);
      for (const ev of sampleEvents) {
        insertStmt.run('EVT-' + Math.floor(100000 + Math.random() * 900000), ev.sid, ev.vid, ev.plat, ev.page, ev.act, ev.src, ev.med, ev.cmp, ev.cnt, ev.ord, ev.val, nowIso);
      }
    }
  } catch (err) {
    console.warn('Social analytics columns migration notice:', err.message);
  }

  console.log('Database tables initialized successfully');
  seedDefaultData();
}

function seedDefaultData() {
  const now = new Date().toISOString();

  const initialProducts = [
    { id: 'p1', sku: 'SKR-WAT-001', title: 'Bisleri 1L Mineral Water Peti (12 Bottles Box)', category: 'water', price: 195, mrp: 240, cost: 158, stock: 120, low: 15, spec: '12 Sealed 1L Bottles Box • ₹16.25/btl', image: 'assets/prod_bisleri_1l.jpg', desc: '100% Genuine factory-sealed Bisleri mineral water 12-bottle peti with tamper-proof seal.', order: 1 },
    { id: 'p2', sku: 'SKR-WAT-002', title: 'Kinley 1L Packaged Water Peti (12 Bottles Box)', category: 'water', price: 190, mrp: 240, cost: 154, stock: 95, low: 15, spec: '12 Sealed 1L Bottles Box • ₹15.8/btl', image: 'assets/prod_kinley_1l.jpg', desc: 'Reverse osmosis purified sealed Kinley water 12-bottle shrink box.', order: 2 },
    { id: 'p3', sku: 'SKR-CAS-001', title: 'Bailey 1L Packaged Water (12 pcs Case)', category: 'cases', price: 180, mrp: 240, cost: 145, stock: 45, low: 10, spec: '12 Bottles Shrink Pack • ₹15/pc', image: 'assets/prod_water_case.jpg', desc: 'Full case of 12 Bailey 1L bottles for events and shops.', order: 3 },
    { id: 'p4', sku: 'SKR-CAS-002', title: 'Aquafina 500ml Compact Water (24 pcs Case)', category: 'cases', price: 240, mrp: 290, cost: 190, stock: 30, low: 8, spec: '24 Bottles Peti • ₹10/pc', image: 'assets/prod_aquafina_500ml.jpg', desc: '24 compact sealed Aquafina bottles for seminars & journeys.', order: 4 },
    { id: 'p5', sku: 'SKR-COL-001', title: 'Coca-Cola 750ml Party Crate (24 bottles)', category: 'cola', price: 890, mrp: 960, cost: 720, stock: 18, low: 5, spec: '24 Chilled Bottles Crate • ₹37/pc', image: 'assets/prod_coca_cola.jpg', desc: 'Chilled crate for marriage parties and canteens.', order: 5 },
    { id: 'p6', sku: 'SKR-JUI-001', title: 'Real Fruit Power Mixed Juice (12x 1L)', category: 'juice', price: 1180, mrp: 1320, cost: 950, stock: 12, low: 4, spec: '12 Tetra Packs Carton • ₹98/L', image: 'assets/prod_fruit_juice.jpg', desc: '100% pure real fruit power juice carton load.', order: 6 },
    { id: 'p7', sku: 'SKR-CAN-001', title: 'Red Bull & Sting Energy Cans Tray (24 pcs)', category: 'can', price: 1440, mrp: 1680, cost: 1160, stock: 8, low: 5, spec: '24 Cans Chilled Tray • Energy Pack', image: 'assets/prod_chilled_can.jpg', desc: 'Chilled energy drink tray for kiosks and events.', order: 7 },
    { id: 'p8', sku: 'SKR-CAS-003', title: '250ml Shaadi Water Peti (48 pcs Mini Pack)', category: 'cases', price: 290, mrp: 350, cost: 230, stock: 65, low: 15, spec: '48 Mini Sealed Bottles • Wedding Special', image: 'assets/cat_water_bottles.jpg', desc: 'Essential wedding dinner table mini sealed water bottles.', order: 8 },
    { id: 'p9', sku: 'SKR-COL-002', title: 'Thums Up 2L Jumbo Bottle Case (9 pcs)', category: 'cola', price: 780, mrp: 855, cost: 640, stock: 15, low: 5, spec: '9 Jumbo Bottles Case • High Fizz', image: 'assets/cat_soft_drinks.jpg', desc: 'Jumbo bottles case for catering loads.', order: 9 },
    { id: 'p10', sku: 'SKR-COL-003', title: 'Sprite 750ml Lime Chilled Crate (24 pcs)', category: 'cola', price: 890, mrp: 960, cost: 720, stock: 14, low: 5, spec: '24 Chilled Glass Bottles', image: 'assets/cat_soft_drinks.jpg', desc: 'Refreshing lime flavor chilled crates.', order: 10 },
    { id: 'p11', sku: 'SKR-JUI-002', title: 'Frooti & Maaza Mango Juice Tray (30 pcs)', category: 'juice', price: 290, mrp: 330, cost: 220, stock: 25, low: 8, spec: '30 Tetra Packs Tray • ₹9.6/pc', image: 'assets/cat_fruit_juices.jpg', desc: 'Kids and wedding buffet mango juice tray.', order: 11 },
    { id: 'p12', sku: 'SKR-CAS-004', title: 'Shaadi & Function Drinks Mega Combo Load', category: 'cases', price: 8800, mrp: 9900, cost: 7100, stock: 8, low: 3, spec: '15 Total Cases Load • Free Sikar Delivery', image: 'assets/cat_wedding_supply.jpg', desc: 'Complete wedding hall combo: 10 water petis + 5 cold drink crates.', order: 12 },
    { id: 'p13', sku: 'SKR-WAT-003', title: 'Aquafina 1L Pure Water Peti (12 Bottles Box)', category: 'water', price: 190, mrp: 240, cost: 154, stock: 110, low: 15, spec: '12 Sealed 1L Bottles Box • ₹15.8/btl', image: 'assets/prod_aquafina_500ml.jpg', desc: 'PepsiCo Hydro-7 purified 1L factory-sealed 12-bottle water peti.', order: 13 },
    { id: 'p14', sku: 'SKR-WAT-004', title: 'Bailey 1L Mineral Water Peti (12 Bottles Box)', category: 'water', price: 180, mrp: 240, cost: 148, stock: 140, low: 15, spec: '12 Sealed 1L Bottles Box • ₹15.0/btl', image: 'assets/prod_bisleri_1l.jpg', desc: 'Parle Agro Bailey 1L factory-sealed 12-bottle water case.', order: 14 },
    { id: 'p15', sku: 'SKR-WAT-005', title: 'Bisleri 500ml Pocket Peti (24 Bottles Box)', category: 'water', price: 210, mrp: 240, cost: 170, stock: 200, low: 25, spec: '24 Sealed 500ml Bottles Box • ₹8.75/btl', image: 'assets/prod_bisleri_1l.jpg', desc: 'Compact 500ml Bisleri mineral water 24-bottle peti for travel and coaching students.', order: 15 },
    { id: 'p16', sku: 'SKR-WAT-006', title: 'Kinley 500ml Compact Peti (24 Bottles Box)', category: 'water', price: 205, mrp: 240, cost: 165, stock: 180, low: 25, spec: '24 Sealed 500ml Bottles Box • ₹8.5/btl', image: 'assets/prod_kinley_1l.jpg', desc: 'Coca-Cola Kinley 500ml hygienic sealed 24-bottle pocket water peti.', order: 16 },
    { id: 'p17', sku: 'SKR-WAT-007', title: 'Bisleri 2L Jumbo Family Case (9 Bottles Box)', category: 'water', price: 245, mrp: 315, cost: 198, stock: 85, low: 12, spec: '9 Sealed 2L Bottles Box • ₹27.2/btl', image: 'assets/prod_bisleri_1l.jpg', desc: '2 Litre sealed Bisleri family size 9-bottle case for dining & travel.', order: 17 },
    { id: 'p18', sku: 'SKR-WAT-008', title: 'Bisleri 5L Dispenser Case (4 Bottles Box)', category: 'water', price: 250, mrp: 300, cost: 205, stock: 50, low: 10, spec: '4 Sealed 5L Dispenser Bottles Box', image: 'assets/cat_water_bottles.jpg', desc: '100% factory-sealed 5L Bisleri bottles case with carry handles (No 20L jars).', order: 18 },
    { id: 'p19', sku: 'SKR-WAT-009', title: 'Himalayan Natural Mineral Water Case (12x 1L Box)', category: 'water', price: 620, mrp: 780, cost: 510, stock: 40, low: 8, spec: '12 Sealed 1L Bottles Box • ₹51.6/btl', image: 'assets/prod_aquafina_500ml.jpg', desc: 'Premium Shivalik foothills natural mineral water 12-bottle case for VIP guests.', order: 19 },
    { id: 'p20', sku: 'SKR-WAT-010', title: 'Bisleri Vedica Spring Water Peti (24x 500ml Box)', category: 'water', price: 760, mrp: 960, cost: 620, stock: 60, low: 10, spec: '24 Sealed 500ml Bottles Box • ₹31.6/btl', image: 'assets/prod_bisleri_1l.jpg', desc: 'Luxury Himalayan mountain water 24-bottle peti for corporate boardrooms and hotels.', order: 20 },
    { id: 'p21', sku: 'SKR-CAS-005', title: 'Bisleri 1L Wholesale Peti (12 Bottles Case)', category: 'cases', price: 195, mrp: 240, cost: 158, stock: 90, low: 15, spec: '12 Bottles Carton • ₹16.25/pc', image: 'assets/prod_water_case.jpg', desc: 'Standard Sikar Mandi wholesale peti of 12 Bisleri 1L sealed bottles.', order: 21 },
    { id: 'p22', sku: 'SKR-CAS-006', title: 'Kinley 1L Wholesale Peti (12 Bottles Case)', category: 'cases', price: 190, mrp: 240, cost: 154, stock: 80, low: 15, spec: '12 Bottles Shrink Case • ₹15.8/pc', image: 'assets/cat_water_cases.jpg', desc: 'Full 12-bottle wholesale shrink pack of Kinley 1L drinking water.', order: 22 },
    { id: 'p23', sku: 'SKR-CAS-007', title: 'Bisleri 500ml Wholesale Peti (24 Bottles Case)', category: 'cases', price: 210, mrp: 240, cost: 170, stock: 75, low: 12, spec: '24 Bottles Peti • ₹8.75/pc', image: 'assets/prod_water_case.jpg', desc: '24 bottles carton of Bisleri 500ml for coaching institutes and seminars.', order: 23 },
    { id: 'p24', sku: 'SKR-CAS-008', title: 'Kinley 500ml Wholesale Peti (24 Bottles Case)', category: 'cases', price: 205, mrp: 240, cost: 165, stock: 70, low: 12, spec: '24 Bottles Shrink Peti • ₹8.5/pc', image: 'assets/cat_water_cases.jpg', desc: 'High-demand 500ml Kinley 24-bottle peti for shops and events.', order: 24 },
    { id: 'p25', sku: 'SKR-CAS-009', title: 'Bailey 500ml Economy Peti (24 Bottles Case)', category: 'cases', price: 195, mrp: 240, cost: 155, stock: 65, low: 10, spec: '24 Bottles Peti • ₹8.1/pc', image: 'assets/prod_water_case.jpg', desc: 'Best-margin wholesale 500ml Bailey 24-piece case for retailers.', order: 25 },
    { id: 'p26', sku: 'SKR-CAS-010', title: 'Bisleri 2L Jumbo Peti (9 Bottles Case)', category: 'cases', price: 245, mrp: 315, cost: 198, stock: 40, low: 8, spec: '9 Jumbo 2L Bottles Case • ₹27.2/pc', image: 'assets/cat_water_cases.jpg', desc: 'Heavy-duty carton of 9 Bisleri 2-Litre bottles for hostels & dhabas.', order: 26 },
    { id: 'p27', sku: 'SKR-CAS-011', title: 'Bisleri 200ml Rockstar Mini Peti (48 pcs)', category: 'cases', price: 275, mrp: 336, cost: 220, stock: 110, low: 20, spec: '48 Mini 200ml Bottles • Banquet Special', image: 'assets/cat_water_bottles.jpg', desc: 'Zero-wastage 200ml sealed Bisleri mini peti for marriage welcome trays.', order: 27 },
    { id: 'p28', sku: 'SKR-CAS-012', title: 'Tata Copper+ Water 500ml Peti (24 pcs Case)', category: 'cases', price: 320, mrp: 480, cost: 255, stock: 30, low: 6, spec: '24 Copper Enriched Bottles • ₹13.3/pc', image: 'assets/prod_aquafina_500ml.jpg', desc: 'Copper-enriched packaged drinking water case for health-conscious offices.', order: 28 },
    { id: 'p29', sku: 'SKR-COL-004', title: 'Fanta Orange 750ml Party Crate (24 Bottles)', category: 'cola', price: 890, mrp: 960, cost: 720, stock: 22, low: 5, spec: '24 Chilled PET Bottles • ₹37/pc', image: 'assets/cat_soft_drinks.jpg', desc: 'Tangy orange Fanta 750ml 24-bottle crate for marriage buffets.', order: 29 },
    { id: 'p30', sku: 'SKR-COL-005', title: 'Limca Lime & Lemoni 750ml Crate (24 pcs)', category: 'cola', price: 890, mrp: 960, cost: 720, stock: 20, low: 5, spec: '24 Chilled Bottles Crate • Fresh Lime', image: 'assets/cat_soft_drinks.jpg', desc: 'Refreshing Limca 750ml wholesale crate for summer & highway eateries.', order: 30 },
    { id: 'p31', sku: 'SKR-COL-006', title: 'Pepsi 750ml Wholesale Crate (24 Bottles)', category: 'cola', price: 870, mrp: 960, cost: 700, stock: 25, low: 5, spec: '24 Chilled PET Bottles • ₹36.25/pc', image: 'assets/prod_coca_cola.jpg', desc: 'Pepsi 750ml 24-bottle shrink crate at direct Sikar depot rate.', order: 31 },
    { id: 'p32', sku: 'SKR-COL-007', title: 'Mountain Dew 750ml High-Energy Crate (24 pcs)', category: 'cola', price: 880, mrp: 960, cost: 710, stock: 28, low: 6, spec: '24 Bottles Crate • Coaching Hub Favorite', image: 'assets/cat_soft_drinks.jpg', desc: 'Top-selling Mountain Dew 750ml crate across Piprali Road hostels.', order: 32 },
    { id: 'p33', sku: 'SKR-COL-008', title: 'Mirinda Orange 2L Jumbo Case (9 Bottles)', category: 'cola', price: 760, mrp: 855, cost: 620, stock: 16, low: 4, spec: '9 Jumbo 2L Bottles • Party Serving', image: 'assets/cat_soft_drinks.jpg', desc: 'Bulk 2-Litre Mirinda case for catering counters and halwai stalls.', order: 33 },
    { id: 'p34', sku: 'SKR-COL-009', title: '7Up Nimbooz Masala Soda Peti (24x 250ml)', category: 'cola', price: 420, mrp: 480, cost: 340, stock: 35, low: 8, spec: '24 Mini Bottles Peti • ₹17.5/pc', image: 'assets/cat_soft_drinks.jpg', desc: 'Chatpata lemon & masala soda 250ml peti for post-dinner wedding counters.', order: 34 },
    { id: 'p35', sku: 'SKR-COL-010', title: 'Coca-Cola 250ml Mini PET Peti (28 Bottles)', category: 'cola', price: 510, mrp: 560, cost: 415, stock: 42, low: 10, spec: '28 Mini 250ml Bottles • ₹18.2/pc', image: 'assets/prod_coca_cola.jpg', desc: 'Fast-moving ₹20 MRP Coca-Cola 250ml 28-bottle wholesale peti.', order: 35 },
    { id: 'p36', sku: 'SKR-COL-011', title: 'Thums Up 250ml Mini Strong Peti (28 Bottles)', category: 'cola', price: 510, mrp: 560, cost: 415, stock: 45, low: 10, spec: '28 Mini 250ml Bottles • Strong Toofan', image: 'assets/cat_soft_drinks.jpg', desc: 'Sikar kirana bestseller: 28-bottle Thums Up 250ml shrink pack.', order: 36 },
    { id: 'p37', sku: 'SKR-JUI-003', title: 'Maaza Mango 1.2L Family Case (12 Bottles)', category: 'juice', price: 780, mrp: 900, cost: 630, stock: 20, low: 5, spec: '12 Thick Mango Bottles • ₹65/pc', image: 'assets/prod_fruit_juice.jpg', desc: 'Rich Alphonso mango drink 1.2L 12-bottle case for family functions.', order: 37 },
    { id: 'p38', sku: 'SKR-JUI-004', title: 'Slice Thick Mango 600ml Peti (24 Bottles)', category: 'juice', price: 840, mrp: 960, cost: 680, stock: 18, low: 5, spec: '24 PET Bottles Crate • ₹35/pc', image: 'assets/cat_fruit_juices.jpg', desc: 'Chilled Slice 600ml 24-bottle crate for bakeries and juice corners.', order: 38 },
    { id: 'p39', sku: 'SKR-JUI-005', title: 'Tropicana 100% Apple & Orange Carton (12x 1L)', category: 'juice', price: 1220, mrp: 1440, cost: 990, stock: 14, low: 4, spec: '12x 1L Tetra Packs • No Added Sugar', image: 'assets/prod_fruit_juice.jpg', desc: '100% pure pressed fruit juice 1L tetra pack wholesale carton.', order: 39 },
    { id: 'p40', sku: 'SKR-JUI-006', title: 'Real Pomegranate (Anar) Nectar Carton (12x 1L)', category: 'juice', price: 1240, mrp: 1440, cost: 1010, stock: 15, low: 4, spec: '12x 1L Tetra Packs • Breakfast Grade', image: 'assets/cat_fruit_juices.jpg', desc: 'Rich ruby pomegranate juice carton for hotels, hospitals & gifting.', order: 40 },
    { id: 'p41', sku: 'SKR-JUI-007', title: 'Paper Boat Aamras & Anar Pouches Tray (24 pcs)', category: 'juice', price: 430, mrp: 480, cost: 345, stock: 30, low: 6, spec: '24 Traditional Drink Pouches • 200ml', image: 'assets/prod_fruit_juice.jpg', desc: 'Authentic ethnic fruit drinks in signature Doypack pouches.', order: 41 },
    { id: 'p42', sku: 'SKR-CAN-002', title: 'Sting Energy Red 250ml PET Crate (30 Bottles)', category: 'can', price: 540, mrp: 600, cost: 440, stock: 55, low: 10, spec: '30 Energy Bottles Pack • ₹18/pc', image: 'assets/prod_chilled_can.jpg', desc: 'Highest selling student energy drink across Sikar coaching corridors.', order: 42 },
    { id: 'p43', sku: 'SKR-CAN-003', title: 'Coca-Cola & Thums Up 300ml Sleek Can Tray (24 pcs)', category: 'can', price: 840, mrp: 960, cost: 685, stock: 20, low: 5, spec: '24 Aluminum Sleek Cans • ₹35/can', image: 'assets/cat_chilled_cans.jpg', desc: 'Premium chilled 300ml sleek aluminum cans tray for VIP lounges.', order: 43 },
    { id: 'p44', sku: 'SKR-CAN-004', title: 'Kinley Club Soda Extra Punch Peti (12x 750ml)', category: 'can', price: 210, mrp: 240, cost: 168, stock: 50, low: 10, spec: '12 Extra-Fizz Soda Bottles • ₹17.5/pc', image: 'assets/cat_chilled_cans.jpg', desc: 'High-carbonation Kinley Club Soda 750ml case for mocktail bars.', order: 44 },
    { id: 'p45', sku: 'SKR-CAN-005', title: 'Bisleri Club Soda 750ml Wholesale Peti (12 pcs)', category: 'can', price: 205, mrp: 240, cost: 162, stock: 45, low: 10, spec: '12 Sealed Soda Bottles • Strong Fizz', image: 'assets/prod_chilled_can.jpg', desc: 'Crisp Bisleri Club Soda 750ml 12-bottle carton for shikanji & mocktails.', order: 45 },
    { id: 'p46', sku: 'SKR-CAN-006', title: 'Lahori Zeera & Nimboo Deshi Drink Peti (24x 160ml)', category: 'can', price: 215, mrp: 240, cost: 172, stock: 60, low: 12, spec: '24 Spiced Zeera Bottles • ₹8.9/pc', image: 'assets/cat_chilled_cans.jpg', desc: 'Roasted cumin and rock-salt digestive drink peti for eateries.', order: 46 },
    { id: 'p47', sku: 'SKR-WED-001', title: 'Royal Marriage Garden 50-Peti Barat Combo Load', category: 'wedding', price: 14500, mrp: 17500, cost: 11800, stock: 10, low: 2, spec: '35 Mini Water Petis + 15 Cold Drink Crates', image: 'assets/cat_wedding_supply.jpg', desc: 'Full tempo load for 500-800 guest wedding reception with free unloading.', order: 47 },
    { id: 'p48', sku: 'SKR-WED-002', title: 'SawaMani & Bhandara 25-Peti Mini Water Load', category: 'wedding', price: 6600, mrp: 8400, cost: 5300, stock: 12, low: 3, spec: '25 Petis (1,200 Mini 250ml Sealed Bottles)', image: 'assets/cat_wedding_supply.jpg', desc: 'Special Khatu Shyam Ji / Jeen Mata SawaMani & Bhandara bulk water load.', order: 48 },
    { id: 'p49', sku: 'SKR-WED-003', title: 'Coaching Hostel Monthly 30-Peti 1L Water Pack', category: 'wedding', price: 5400, mrp: 7200, cost: 4350, stock: 15, low: 3, spec: '30 Cases (360 Sealed 1L Bottles) • Monthly', image: 'assets/cat_water_cases.jpg', desc: 'Piprali Road & Nawalgarh Road hostel mess bulk 1L sealed bottle package.', order: 49 },
    { id: 'p50', sku: 'SKR-WED-004', title: 'Haldi & Mehndi Welcome Mocktail + Soda Combo', category: 'wedding', price: 4200, mrp: 4950, cost: 3400, stock: 14, low: 3, spec: '4 Juice Cartons + 4 Soda Petis + 6 Mini Water', image: 'assets/cat_wedding_supply.jpg', desc: 'Curated daytime wedding ceremony refreshment combo delivered chilled.', order: 50 }
  ];

  const insertProductIgnore = db.prepare(`
    INSERT OR IGNORE INTO products (id, sku, title, category, price, mrp, cost, stock, low_stock_threshold, spec, image, description, active, display_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `);

  const insertMovementIgnore = db.prepare(`
    INSERT OR IGNORE INTO inventory_movements (id, product_id, movement_type, quantity, before_stock, after_stock, reference_id, reason, actor, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const existingCount = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;

  db.transaction(() => {
    initialProducts.forEach(p => {
      const info = insertProductIgnore.run(p.id, p.sku, p.title, p.category, p.price, p.mrp, p.cost, p.stock, p.low, p.spec, p.image, p.desc, p.order, now, now);
      if (info.changes > 0) {
        insertMovementIgnore.run('INIT-' + p.id, p.id, 'adjustment', p.stock, 0, p.stock, 'SYSTEM-BOOT', 'Initial stock calibration', 'System', now);
      }
    });
  })();

  if (existingCount > 0) {
    return; // Other default tables already seeded
  }

  // 2. SEED DEFAULT CATEGORIES
  const insertCategory = db.prepare(`
    INSERT INTO categories (id, name, tagline, image, display_order, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  const initialCategories = [
    { id: 'water', name: 'Packaged Water', tagline: '100% Factory Sealed Bottles', image: 'assets/cat_water_bottles.jpg', order: 1 },
    { id: 'cases', name: 'Wholesale Petis & Cases', tagline: 'Bulk Mandi Rates', image: 'assets/cat_water_cases.jpg', order: 2 },
    { id: 'cola', name: 'Soft Drinks & Crates', tagline: 'Chilled Crate Supplies', image: 'assets/cat_soft_drinks.jpg', order: 3 },
    { id: 'juice', name: 'Fruit Juices & Tetra', tagline: 'Real & Maaza Packs', image: 'assets/cat_fruit_juices.jpg', order: 4 },
    { id: 'can', name: 'Chilled Cans & Soda', tagline: 'Aluminum Cans Tray', image: 'assets/cat_chilled_cans.jpg', order: 5 },
    { id: 'wedding', name: 'Wedding & Event Supply', tagline: '200ml Mini Bottles & Combos', image: 'assets/cat_wedding_supply.jpg', order: 6 }
  ];

  db.transaction(() => {
    initialCategories.forEach(c => insertCategory.run(c.id, c.name, c.tagline, c.image, c.order));
  })();

  // 3. SEED DEFAULT CUSTOMERS
  const insertCustomer = db.prepare(`
    INSERT INTO customers (id, name, phone, email, corridor, address, verified, total_orders, lifetime_spend, outstanding_balance, created_at, last_activity)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
  `);

  const initialCustomers = [
    { id: 'CUST-1001', name: 'Rajendra Shekhawat', phone: '9829012345', email: 'rajendra.royal@gmail.com', corridor: 'Piprali Road', address: 'Royal Green Marriage Garden, Piprali Road, Sikar', orders: 4, spend: 46400, bal: 0, date: '2026-10-01' },
    { id: 'CUST-1002', name: 'Mahesh Sharma', phone: '9829011223', email: 'mahesh.sharma@yahoo.com', corridor: 'Piprali Road Mandi', address: 'Shree Shyam Marriage Hall, Piprali Road, Sikar', orders: 3, spend: 18400, bal: 1500, date: '2026-10-02' },
    { id: 'CUST-1003', name: 'Ashok Sharma', phone: '9829067890', email: 'ashok.matrix@gmail.com', corridor: 'Piprali Road Corridor', address: 'Matrix Coaching Boys Hostel 3, Piprali Road, Sikar', orders: 2, spend: 7200, bal: 0, date: '2026-10-03' },
    { id: 'CUST-1004', name: 'Suresh Kumar Pareek', phone: '9829044556', email: 'pareek.kirana@gmail.com', corridor: 'Station Road Mandi', address: 'Pareek Kirana Store, Near Krishi Mandi Gate, Sikar', orders: 2, spend: 17800, bal: 800, date: '2026-10-04' },
    { id: 'CUST-1005', name: 'Vikram Singh', phone: '9829099887', email: 'vikram.singh@gmail.com', corridor: 'Fatehpur Road Corridor', address: 'Rajputana Garden, Fatehpur Road Bypass, Sikar', orders: 1, spend: 10150, bal: 0, date: '2026-10-05' },
    { id: 'CUST-1006', name: 'Mahesh Verma', phone: '9829055678', email: 'mahesh.verma@gmail.com', corridor: 'Nawalgarh Road', address: 'Pooja Sweet Home, Nawalgarh Road, Sikar', orders: 1, spend: 4200, bal: 500, date: '2026-10-06' }
  ];

  db.transaction(() => {
    initialCustomers.forEach(c => insertCustomer.run(c.id, c.name, c.phone, c.email, c.corridor, c.address, c.orders, c.spend, c.bal, c.date, c.date));
  })();

  // 4. SEED INITIAL ORDERS
  const insertOrder = db.prepare(`
    INSERT INTO orders (id, customer_id, customer_name, customer_phone, corridor, delivery_address, items_json, items_count, subtotal, discount, total, payment_method, payment_status, status, vehicle, order_date, delivery_time, notes, activity_log_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialOrders = [
    {
      id: 'SKR-8421',
      cid: 'CUST-1001',
      name: 'Rajendra Shekhawat',
      phone: '9829012345',
      corridor: 'Piprali Road',
      addr: 'Royal Green Marriage Garden, Piprali Road',
      items: [{ id: 'p8', title: '250ml Shaadi Water Peti', qty: 60, price: 290, total: 17400 }, { id: 'p5', title: 'Coca-Cola 750ml Party Crate', qty: 10, price: 890, total: 8900 }],
      itemsCount: 70,
      subtotal: 26300,
      disc: 3100,
      total: 23200,
      payMethod: 'UPI',
      payStatus: 'Paid',
      status: 'confirmed',
      vehicle: 'RJ-23-GA-4821',
      date: '2026-10-10',
      time: '10:45 AM',
      notes: 'Unload near wedding stage gate 1'
    },
    {
      id: 'SKR-7612',
      cid: 'CUST-1003',
      name: 'Ashok Sharma',
      phone: '9829067890',
      corridor: 'Piprali Road Corridor',
      addr: 'Matrix Coaching Hostel 3, Piprali Road',
      items: [{ id: 'p2', title: 'Kinley 1L Drinking Water Bottle', qty: 200, price: 18, total: 3600 }],
      itemsCount: 200,
      subtotal: 3600,
      disc: 0,
      total: 3600,
      payMethod: 'Bank Transfer',
      payStatus: 'Paid',
      status: 'completed',
      vehicle: 'RJ-23-GB-1104',
      date: '2026-10-09',
      time: '09:15 AM',
      notes: 'Weekly hostel supply delivered'
    },
    {
      id: 'SKR-5539',
      cid: 'CUST-1004',
      name: 'Suresh Kumar Pareek',
      phone: '9829044556',
      corridor: 'Station Road Mandi',
      addr: 'Pareek Kirana Store, Station Road',
      items: [{ id: 'p5', title: 'Coca-Cola 750ml Party Crate', qty: 10, price: 890, total: 8900 }],
      itemsCount: 10,
      subtotal: 8900,
      disc: 0,
      total: 8900,
      payMethod: 'COD',
      payStatus: 'Pending',
      status: 'pending',
      vehicle: 'RJ-23-GA-9922',
      date: '2026-10-11',
      time: '11:20 AM',
      notes: 'Deliver before noon mandi rush'
    },
    {
      id: 'SKR-3204',
      cid: 'CUST-1005',
      name: 'Vikram Singh',
      phone: '9829099887',
      corridor: 'Fatehpur Road Corridor',
      addr: 'Rajputana Garden, Fatehpur Road',
      items: [{ id: 'p8', title: '250ml Shaadi Water Peti', qty: 35, price: 290, total: 10150 }],
      itemsCount: 35,
      subtotal: 10150,
      disc: 0,
      total: 10150,
      payMethod: 'Cash',
      payStatus: 'Paid',
      status: 'confirmed',
      vehicle: 'RJ-23-GA-4821',
      date: '2026-10-11',
      time: '11:55 AM',
      notes: 'Evening function load'
    }
  ];

  db.transaction(() => {
    initialOrders.forEach(o => {
      const log = JSON.stringify([{ status: o.status, timestamp: now, actor: 'System', note: 'Order registered' }]);
      insertOrder.run(o.id, o.cid, o.name, o.phone, o.corridor, o.addr, JSON.stringify(o.items), o.itemsCount, o.subtotal, o.disc, o.total, o.payMethod, o.payStatus, o.status, o.vehicle, o.date, o.time, o.notes, log, now, now);
    });
  })();

  // 5. SEED INITIAL KHATA DUES
  const insertKhata = db.prepare(`
    INSERT INTO khata_entries (id, customer_id, customer_name, customer_phone, amount, paid_amount, remaining_amount, reason, due_date, reminder_date, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    insertKhata.run('KH-1001', 'CUST-1002', 'Mahesh Sharma', '9829011223', 1500, 0, 1500, 'Shaadi Water Case Balance', '2026-10-15', '2026-10-14', 'pending', 'Bilty payment pending', now, now);
    insertKhata.run('KH-1002', 'CUST-1004', 'Suresh Kumar Pareek', '9829044556', 800, 0, 800, 'Bailey 1L Cases (Overdue)', '2026-10-05', '2026-10-04', 'overdue', 'Overdue kirana supply balance', now, now);
    insertKhata.run('KH-1003', 'CUST-1006', 'Mahesh Verma', '9829055678', 500, 0, 500, 'Cold Drink Crate Balance', '2026-10-18', '2026-10-17', 'pending', 'Sweet shop balance', now, now);
  })();

  // 6. SEED INITIAL PURCHASES
  const insertPurchase = db.prepare(`
    INSERT INTO purchases (id, supplier_name, supplier_phone, product_id, product_title, qty, unit_cost, total_cost, bill_no, invoice_date, payment_method, payment_status, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    insertPurchase.run('PUR-101', 'Bisleri Plant Jaipur', '0141-284910', 'p1', 'Bisleri 1L Mineral Water Bottle', 100, 14, 1400, 'INV-BIS-8821', '2026-10-08', 'Bank Transfer', 'Paid', 'received', 'Full truck load received', now);
    insertPurchase.run('PUR-102', 'Moon Beverages Coke Depot', '0141-399120', 'p5', 'Coca-Cola 750ml Party Crate', 40, 720, 28800, 'INV-COK-4412', '2026-10-09', 'Cheque', 'Paid', 'received', 'Chilled chiller delivery', now);
    insertPurchase.run('PUR-103', 'Parle Agro Jaipur', '0141-551209', 'p11', 'Frooti & Maaza Mango Juice Tray', 50, 220, 11000, 'INV-PAR-3312', '2026-10-09', 'Bank Transfer', 'Paid', 'received', 'Fresh stock batch', now);
  })();

  // 7. SEED INITIAL SUPPLIERS
  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (id, name, phone, address, contact_person, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    insertSupplier.run('SUP-01', 'Bisleri Plant Jaipur', '+91 141 284910', 'RIICO Industrial Area, Mansarovar, Jaipur', 'Mr. Dinesh Sharma', now);
    insertSupplier.run('SUP-02', 'Moon Beverages Coke Depot', '+91 141 399120', 'Transport Nagar, Agra Road, Jaipur', 'Mr. Vikas Jain', now);
    insertSupplier.run('SUP-03', 'Parle Agro Jaipur', '+91 141 551209', 'VKI Area, Road No. 9, Jaipur', 'Mr. Kailash Rawat', now);
    insertSupplier.run('SUP-04', 'Dhariwal Industries (Oxyrich)', '+91 141 400122', 'Sitapura Industrial Area, Jaipur', 'Mr. Amit Agarwal', now);
  })();

  // 8. SEED INITIAL COUPONS
  const insertCoupon = db.prepare(`
    INSERT INTO coupons (code, discount_type, discount_val, min_order, max_discount, usage_limit, per_user_limit, used_count, expiry_date, active, desc, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    insertCoupon.run('DIWALI10', 'percentage', 10, 1000, 500, 200, 1, 14, '2026-11-15', 1, '10% Off Festival Special', now);
    insertCoupon.run('SIKAR5', 'percentage', 5, 500, 200, 500, 2, 48, '2026-12-31', 1, '5% Mandi Wholesale Discount', now);
    insertCoupon.run('SHAADI15', 'percentage', 15, 3000, 1000, 100, 1, 8, '2026-11-30', 1, '15% Marriage Garden Bulk Combo', now);
    insertCoupon.run('FLAT100', 'fixed', 100, 800, 100, 150, 1, 23, '2026-12-31', 1, 'Flat ₹100 Off on First Delivery', now);
  })();

  // 9. SEED INITIAL REVIEWS
  const insertReview = db.prepare(`
    INSERT INTO reviews (id, customer_name, role, location, product_id, rating, quote, reply, reply_date, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    insertReview.run('REV-1', 'Rajendra Shekhawat', 'Manager, Royal Green Marriage Garden', 'Piprali Road', 'p8', 5, 'We ordered 80 cases of factory-sealed water bottles and 25 cold drink crates for a wedding function. Unloading by tempo happened right on time at the venue. Every bottle had a genuine factory seal with zero camper hassle.', 'Thank you Rajendra! Sikar Drop always supplies 100% factory-sealed bottles.', '2026-10-10', 'approved', now);
    insertReview.run('REV-2', 'Ashok Sharma', 'Warden, Matrix Coaching Hostel', 'Piprali Road Corridor', 'p2', 5, 'For our students\' health, we stopped using camper water and scheduled weekly orders of 1L sealed mineral water cases from Sikar Drop. Weekly tempo delivery is always punctual.', 'Thank you Ashok! Factory-sealed water is always the safest choice for student health.', '2026-10-09', 'approved', now);
    insertReview.run('REV-3', 'Suresh Kumar Pareek', 'Owner, Pareek Kirana Store', 'Station Road Mandi', 'p1', 5, 'Wholesale case rates for our shop are the most competitive in Sikar Mandi. We get direct depot rates with convenient cash or UPI on delivery.', 'Thank you Suresh! Providing wholesale rates better than the mandi to retail shopkeepers is our top priority.', '2026-10-08', 'approved', now);
    insertReview.run('REV-4', 'Anita Choudhary', 'Resident & Family Head', 'Radhakishanpura Colony', 'p11', 5, 'We ordered mini water bottles and juice boxes for a birthday function at home. They were delivered right to our doorstep within 40 minutes. Excellent service!', 'Thank you Anita! We look forward to serving you again.', '2026-10-07', 'approved', now);
  })();

  // 10. SEED WEBSITE CONTENT CMS
  const insertContent = db.prepare(`
    INSERT OR REPLACE INTO website_content (key, value, updated_at) VALUES (?, ?, ?)
  `);

  const initialContent = {
    website_name: 'Sikar Drop Wholesale Beverage Depot',
    helpline: '+91 98290 XXXXX',
    top_policy: '100% Factory-Sealed Bottles & Cases Only • We Do Not Supply 20L Water Jars (Campers)',
    hero_title: 'Pure Water For A Healthier Tomorrow',
    hero_subtitle: 'Quality drinking water and beverages delivered to your home, office and business across Sikar.',
    hero_badge: 'Trusted by 10,000+ Families in Sikar',
    truck_title: 'Free Delivery in Sikar',
    truck_sub: 'On orders above 5 Petis / Marriage Garden Bookings',
    bulk_title: 'Need Bulk Supply?',
    bulk_sub: 'For Offices, Hotels, Schools & Marriage Gardens',
    about_text: 'Sikar Drop is Sikar\'s dedicated wholesale water and beverage supply depot located near Krishi Upaj Mandi. We supply 100% genuine factory-sealed water petis, cold drinks, juices, and cans across Piprali Road, Nawalgarh Road, Fatehpur Road, and Station Road.',
    business_address: 'Depot Plot 14-B, Near Krishi Upaj Mandi, Station Road Bypass, Sikar (Raj.) 332001',
    business_hours: 'Mon - Sun: 7:00 AM - 10:00 PM',
    camper_ban_text: 'We do not supply 20L plastic water jars (campers) in Sikar. Only 100% factory-sealed bottles are supplied.'
  };

  db.transaction(() => {
    for (const [k, v] of Object.entries(initialContent)) {
      insertContent.run(k, v, now);
    }
  })();

  // 11. SEED DEFAULT ADMIN USERS & GUARANTEE AUTHORIZED CREDENTIALS
  const upsertAdmin = db.prepare(`
    INSERT INTO admin_users (id, username, name, role, pin, permissions_json, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      name = excluded.name,
      role = excluded.role,
      pin = excluded.pin,
      permissions_json = excluded.permissions_json,
      active = 1
  `);

  const initialAdmins = [
    { id: 'ADM-01', username: 'maheshkumarsaini8769@gmail.com', name: 'Mahesh Kumar Saini', role: 'Super Admin', pin: 'mahesh99830', perms: ['all'] },
    { id: 'ADM-02', username: 'ramesh', name: 'Ramesh Kumawat', role: 'Logistics Operator', pin: '4321', perms: ['dashboard', 'orders', 'pos', 'inventory'] },
    { id: 'ADM-03', username: 'dinesh', name: 'Dinesh Accountant', role: 'Accountant', pin: '5678', perms: ['dashboard', 'orders', 'pos', 'khata', 'reports', 'purchases'] }
  ];

  db.transaction(() => {
    initialAdmins.forEach(a => upsertAdmin.run(a.id, a.username, a.name, a.role, a.pin, JSON.stringify(a.perms), now));
    // Explicitly guarantee ADM-01 credentials regardless of prior database state
    db.prepare(`
      UPDATE admin_users SET
        username = 'maheshkumarsaini8769@gmail.com',
        pin = 'mahesh99830',
        name = 'Mahesh Kumar Saini',
        role = 'Super Admin',
        permissions_json = '["all"]',
        active = 1
      WHERE id = 'ADM-01' OR username = 'admin' OR username = 'maheshkumarsaini8769@gmail.com'
    `).run();
  })();

  // 12. SEED INITIAL AUDIT LOG
  // 13. SEED DEFAULT SETTINGS
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO website_settings (key, value, updated_at)
    VALUES (?, ?, ?)
  `);

  db.transaction(() => {
    insertSetting.run('active_theme', 'default', now);
    insertSetting.run('brand_name', 'Sikar Drop Wholesale Hub', now);
    insertSetting.run('brand_tagline', 'Pure Water. Healthy Life. Factory-Sealed Petis Only.', now);
    insertSetting.run('helpline_phone', '+91 98290 00000', now);
    insertSetting.run('depot_address', 'Piprali & Nawalgarh Road Junction, Sikar, Rajasthan 332001', now);

    const defaultSiteTexts = {
      heroPill: 'Trusted by 10,000+ Families in Sikar',
      heroTitle: 'Pure Water\nFor A Healthier\nTomorrow',
      heroDesc: 'Quality drinking water and beverages delivered to your home, office and business across Sikar.',
      heroImg: 'assets/hero_bottles_blended.png',
      slide1Image: 'assets/hero_bottles.jpg',
      slide1Tag: 'SIKAR MANDI WHOLESALE PETI DEPOT',
      slide1Title: '100% Factory-Sealed Mineral Water Petis',
      slide1Sub: 'Bisleri & Kinley Direct Factory Wholesale Rates • Free Tempo Delivery on 5+ Boxes • Zero Camper Policy',
      slide1BtnText: 'Order Sealed Water',
      slide1BtnLink: 'products',
      slide2Image: 'assets/cat_wedding_supply.jpg',
      slide2Tag: 'WEDDING & FUNCTION SPECIAL',
      slide2Title: 'Shaadi & Bulk Function Drinks & Water Combo',
      slide2Sub: 'Save up to 20% on Marriage Bulk Orders • 200ml Mini Water Bottles + Chilled Cold Drink Crates',
      slide2BtnText: 'Book Marriage Bulk',
      slide2BtnLink: 'bulk',
      slide3Image: 'assets/cat_soft_drinks.jpg',
      slide3Tag: 'EXPRESS CHILLED LOGISTICS',
      slide3Title: 'Chilled Soft Drinks & Energy Soda Cans',
      slide3Sub: 'Coca-Cola, Thums Up, Sprite & Sting • 40-Min Express Unloading Across All Sikar Corridors',
      slide3BtnText: 'Explore Cold Drinks',
      slide3BtnLink: 'products',
      topPolicy: '100% Factory-Sealed Bottles & Cases Only • We Do Not Supply 20L Water Jars (Campers)',
      helpline: '+91 98290 00000',
      brandTagline: 'Pure Water. Healthy Life.',
      truckTitle: 'Free Delivery in Sikar',
      truckSub: 'On orders above 5 Petis / Marriage Garden Bookings',
      bulkTitle: 'Need Bulk Supply?',
      bulkSub: 'For Offices, Hotels, Schools & Marriage Gardens',
      aboutStory: 'Sikar Drop was established in 2024 with a singular objective: eliminating contaminated 20L camper jars completely and providing 100% genuine factory-sealed bottled water and chilled beverages across Sikar Mandi.',
      contactAddress: 'Plot 14-B, Near Krishi Upaj Mandi, Station Road Bypass, Sikar (Raj.) 332001',
      contactPhone: '+91 98290 00000 / +91 98290 84210',
      footerCamper: 'We do not supply 20L plastic water jars (campers) in Sikar. Only 100% factory-sealed branded bottles and crates are supplied.',
      footerAbout: 'Sikar\'s premier wholesale beverage depot. Providing 100% factory-sealed mineral water bottle cases, chilled cold drink crates, fruit juices, and soda can trays directly to wedding gardens, kirana stores, coaching canteens, and residences.'
    };
    insertSetting.run('site_texts', JSON.stringify(defaultSiteTexts), now);

    const defaultBulkRates = {
      w250: 290,
      w1000: 180,
      cold: 890,
      juice: 1180,
      disc10: 5,
      disc20: 10
    };
    insertSetting.run('bulk_mandi_rates', JSON.stringify(defaultBulkRates), now);

    const defaultSeoSettings = {
      brandName: 'Sikar Drop',
      tagline: 'Pure Water. Healthy Life.',
      title: 'Sikar Drop - 100% Factory-Sealed Water Petis & Wholesale Beverages',
      desc: 'Sikar wholesale packaged drinking water and cold drink crates delivery.',
      keywords: 'sikar water delivery, factory-sealed petis, mandi rates'
    };
    insertSetting.run('seo_settings', JSON.stringify(defaultSeoSettings), now);
  })();

  console.log('Default enterprise data seeded successfully');
}

// TRANSACTIONAL HELPERS

// 1. ATOMIC MANUAL CASH SALE
function recordManualSaleTransaction({ idempotencyToken, customerId, customerName, customerPhone, items = [], subtotal, discount = 0, totalAmount, amountReceived, outstandingAmount, paymentMethod = 'Cash', saleDate, dueDate = '', notes = '', actor = 'Admin' }) {
  const runTx = db.transaction(() => {
    // Check idempotency token to strictly prevent double submission
    if (idempotencyToken) {
      const existing = db.prepare('SELECT * FROM manual_sales WHERE idempotency_token = ?').get(idempotencyToken);
      if (existing) {
        return {
          saleId: existing.id,
          totalAmount: existing.total_amount,
          amountReceived: existing.amount_received,
          balanceDue: existing.outstanding_amount,
          outstandingAmount: existing.outstanding_amount,
          isDuplicate: true
        };
      }
    }

    // Compute totals if not provided
    let computedTotal = 0;
    for (const it of items) {
      const pqty = Number(it.quantity || it.qty || 1);
      const prate = Number(it.price || it.rate || 0);
      computedTotal += (it.total !== undefined ? Number(it.total) : (prate * pqty));
    }
    const finalTotal = totalAmount !== undefined ? Number(totalAmount) : computedTotal;
    const finalSubtotal = subtotal !== undefined ? Number(subtotal) : finalTotal;
    const finalDiscount = Number(discount || 0);
    const finalReceived = amountReceived !== undefined ? Number(amountReceived) : finalTotal;
    const finalOutstanding = outstandingAmount !== undefined ? Number(outstandingAmount) : Math.max(0, finalTotal - finalReceived);

    // Verify stock availability for each item
    for (const item of items) {
      const pid = item.id || item.productId;
      const pqty = Number(item.qty || item.quantity || 1);
      const product = db.prepare('SELECT id, title, stock FROM products WHERE id = ?').get(pid);
      if (!product) {
        throw new Error(`Product not found: ${pid}`);
      }
      if (product.stock < pqty) {
        throw new Error(`Insufficient stock for "${product.title}". Requested: ${pqty}, Available: ${product.stock}`);
      }
    }

    const saleId = 'CS-' + Math.floor(100000 + Math.random() * 900000);
    const now = new Date().toISOString();

    // Deduct stock and record inventory movement for each item
    for (const item of items) {
      const pid = item.id || item.productId;
      const pqty = Number(item.qty || item.quantity || 1);
      const currentProd = db.prepare('SELECT stock FROM products WHERE id = ?').get(pid);
      const beforeStock = currentProd.stock;
      const afterStock = beforeStock - pqty;

      db.prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?').run(afterStock, now, pid);

      db.prepare(`
        INSERT INTO inventory_movements (id, product_id, movement_type, quantity, before_stock, after_stock, reference_id, reason, actor, created_at)
        VALUES (?, ?, 'manual_sale', ?, ?, ?, ?, ?, ?, ?)
      `).run('MOV-' + Math.floor(100000 + Math.random() * 900000), pid, -pqty, beforeStock, afterStock, saleId, `Manual Cash Sale ${saleId}`, actor, now);
    }

    // Insert Manual Sale record
    db.prepare(`
      INSERT INTO manual_sales (id, idempotency_token, customer_id, customer_name, customer_phone, items_json, subtotal, discount, total_amount, amount_received, outstanding_amount, payment_method, sale_date, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(saleId, idempotencyToken || null, customerId || null, customerName, customerPhone, JSON.stringify(items), finalSubtotal, finalDiscount, finalTotal, finalReceived, finalOutstanding, paymentMethod, saleDate || now.split('T')[0], notes || '', now);

    // Update or Create Customer
    let cust = null;
    if (customerId) {
      cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    } else if (customerPhone) {
      cust = db.prepare('SELECT * FROM customers WHERE phone = ?').get(customerPhone);
    }

    let custId = cust ? cust.id : ('CUST-' + Math.floor(1000 + Math.random() * 9000));
    if (cust) {
      const newOrders = cust.total_orders + 1;
      const newSpend = cust.lifetime_spend + finalTotal;
      const newBalance = cust.outstanding_balance + finalOutstanding;
      db.prepare('UPDATE customers SET total_orders = ?, lifetime_spend = ?, outstanding_balance = ?, last_activity = ? WHERE id = ?')
        .run(newOrders, newSpend, newBalance, now, cust.id);
    } else {
      db.prepare(`
        INSERT INTO customers (id, name, phone, verified, total_orders, lifetime_spend, outstanding_balance, created_at, last_activity)
        VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?)
      `).run(custId, customerName, customerPhone, finalTotal, finalOutstanding, now, now);
    }

    // Record Payment transaction if amount received > 0
    if (finalReceived > 0) {
      db.prepare(`
        INSERT INTO payments (id, customer_id, customer_name, customer_phone, reference_type, reference_id, amount, previous_balance, new_balance, payment_method, notes, created_at)
        VALUES (?, ?, ?, ?, 'manual_sale', ?, ?, ?, ?, ?, ?, ?)
      `).run('PAY-' + Math.floor(100000 + Math.random() * 900000), custId, customerName, customerPhone, saleId, finalReceived, cust ? cust.outstanding_balance : 0, (cust ? cust.outstanding_balance : 0) + finalOutstanding, paymentMethod, `Payment for ${saleId}`, now);
    }

    // If outstanding balance > 0, record in Khata Ledger
    if (finalOutstanding > 0) {
      const khataId = 'KH-' + Math.floor(100000 + Math.random() * 900000);
      db.prepare(`
        INSERT INTO khata_entries (id, customer_id, customer_name, customer_phone, amount, paid_amount, remaining_amount, reason, due_date, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 'pending', ?, ?, ?)
      `).run(khataId, custId, customerName, customerPhone, finalOutstanding, finalOutstanding, `Manual Sale Balance: ${saleId}`, dueDate || '', notes || 'Credit sale balance', now, now);
    }

    // Log Audit Trail
    db.prepare(`
      INSERT INTO audit_logs (id, actor, action, module, details, created_at)
      VALUES (?, ?, 'MANUAL_SALE_CREATED', 'pos', ?, ?)
    `).run('AUD-' + Math.floor(100000 + Math.random() * 900000), actor, `Recorded manual sale ${saleId} for Rs.${finalTotal} (Received: Rs.${finalReceived}, Due: Rs.${finalOutstanding}) to ${customerName}`, now);

    return { saleId, totalAmount: finalTotal, amountReceived: finalReceived, balanceDue: finalOutstanding, outstandingAmount: finalOutstanding };
  });

  return runTx();
}

// 2. ATOMIC KHATA PAYMENT SETTLEMENT
function recordKhataPaymentTransaction({ khataId, customerId, amountPaid, paymentMethod = 'Cash', notes = '', actor = 'Admin' }) {
  const runTx = db.transaction(() => {
    const khata = db.prepare('SELECT * FROM khata_entries WHERE id = ?').get(khataId);
    if (!khata) throw new Error('Khata entry not found');

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(khata.customer_id);
    const now = new Date().toISOString();

    const newPaid = khata.paid_amount + amountPaid;
    const remaining = Math.max(0, khata.amount - newPaid);
    const newStatus = remaining <= 0 ? 'settled' : 'partially_paid';

    db.prepare('UPDATE khata_entries SET paid_amount = ?, remaining_amount = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(newPaid, remaining, newStatus, now, khataId);

    if (customer) {
      const newCustBal = Math.max(0, customer.outstanding_balance - amountPaid);
      db.prepare('UPDATE customers SET outstanding_balance = ?, last_activity = ? WHERE id = ?')
        .run(newCustBal, now, customer.id);
    }

    const payId = 'PAY-' + Math.floor(100000 + Math.random() * 900000);
    db.prepare(`
      INSERT INTO payments (id, customer_id, customer_name, customer_phone, reference_type, reference_id, amount, previous_balance, new_balance, payment_method, notes, created_at)
      VALUES (?, ?, ?, ?, 'khata_repayment', ?, ?, ?, ?, ?, ?, ?)
    `).run(payId, khata.customer_id, khata.customer_name, khata.customer_phone, khataId, amountPaid, customer ? customer.outstanding_balance : 0, customer ? Math.max(0, customer.outstanding_balance - amountPaid) : 0, paymentMethod, notes || `Repayment for ${khata.reason}`, now);

    db.prepare(`
      INSERT INTO audit_logs (id, actor, action, module, details, created_at)
      VALUES (?, ?, 'KHATA_PAYMENT_RECORDED', 'khata', ?, ?)
    `).run('AUD-' + Math.floor(100000 + Math.random() * 900000), actor, `Recorded repayment of ₹${amountPaid} for khata ${khataId} from ${khata.customer_name}. Remaining due: ₹${remaining}`, now);

    return { khataId, amountPaid, remaining, newStatus };
  });

  return runTx();
}

// 3. ATOMIC PURCHASE RECEIPT (STOCK INCREMENT)
function receivePurchaseTransaction({ purchaseId, actor = 'Admin' }) {
  const runTx = db.transaction(() => {
    const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
    if (!purchase) throw new Error('Purchase record not found');
    if (purchase.status === 'received') throw new Error('Purchase is already received and stock is added');

    const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(purchase.product_id);
    const now = new Date().toISOString();
    let beforeStock = 0;
    let afterStock = purchase.qty;

    if (product) {
      beforeStock = product.stock;
      afterStock = beforeStock + purchase.qty;

      // Update product stock and purchase cost
      db.prepare('UPDATE products SET stock = ?, cost = ?, updated_at = ? WHERE id = ?')
        .run(afterStock, purchase.unit_cost, now, purchase.product_id);

      // Record movement
      db.prepare(`
        INSERT INTO inventory_movements (id, product_id, movement_type, quantity, before_stock, after_stock, reference_id, reason, actor, created_at)
        VALUES (?, ?, 'purchase_received', ?, ?, ?, ?, ?, ?, ?)
      `).run('MOV-' + Math.floor(100000 + Math.random() * 900000), purchase.product_id, purchase.qty, beforeStock, afterStock, purchaseId, `Received Inward Stock from ${purchase.supplier_name}`, actor, now);
    }

    // Update purchase status
    db.prepare("UPDATE purchases SET status = 'received' WHERE id = ?").run(purchaseId);

    db.prepare(`
      INSERT INTO audit_logs (id, actor, action, module, details, created_at)
      VALUES (?, ?, 'PURCHASE_STOCK_RECEIVED', 'purchases', ?, ?)
    `).run('AUD-' + Math.floor(100000 + Math.random() * 900000), actor, `Received purchase ${purchaseId}: Added ${purchase.qty} units to product ${purchase.product_title}`, now);

    return { purchaseId, addedQty: purchase.qty, beforeStock, afterStock };
  });

  return runTx();
}

// 4. ATOMIC ORDER CREATION (ONLINE STOREFRONT)
function createOnlineOrderTransaction({ orderId: customOrderId, customerName, customerPhone, loginPhone = '', deliveryPhone = '', addressPhone = '', corridor, address = '', deliveryAddress = '', items = [], subtotal, discount = 0, total, paymentMethod = 'COD', paymentStatus = '', notes = '', attribution = {} }) {
  const runTx = db.transaction(() => {
    const orderId = customOrderId || ('SKR-' + Math.floor(1000 + Math.random() * 9000));
    const finalAddress = address || deliveryAddress || corridor || 'Sikar';
    const finalLoginPhone = String(loginPhone || customerPhone || '').trim();
    const finalDeliveryPhone = String(deliveryPhone || addressPhone || customerPhone || finalLoginPhone).trim();
    const primaryPhone = finalLoginPhone || finalDeliveryPhone;
    const now = new Date().toISOString();

    // Attribution parameters
    const utmSource = String(attribution.utm_source || attribution.utmSource || '').trim().toLowerCase();
    const utmMedium = String(attribution.utm_medium || attribution.utmMedium || '').trim().toLowerCase();
    const utmCampaign = String(attribution.utm_campaign || attribution.utmCampaign || '').trim();
    const utmContent = String(attribution.utm_content || attribution.utmContent || '').trim();
    const utmTerm = String(attribution.utm_term || attribution.utmTerm || '').trim();
    const attributionPlatform = String(attribution.platform || attribution.attributionPlatform || utmSource || 'direct').trim().toLowerCase();
    const sessionId = String(attribution.sessionId || attribution.session_id || '').trim();
    const visitorId = String(attribution.visitorId || attribution.visitor_id || '').trim();

    // Check stock for all items
    for (const item of items) {
      const pid = item.id || item.productId;
      const pqty = Number(item.qty || item.quantity || 1);
      const prod = db.prepare('SELECT id, title, stock FROM products WHERE id = ?').get(pid);
      if (prod && prod.stock < pqty) {
        throw new Error(`Insufficient stock for "${prod.title}". Requested: ${pqty}, In Stock: ${prod.stock}`);
      }
    }

    // Deduct stock and log movement
    let totalItemsCount = 0;
    let computedTotal = 0;
    for (const item of items) {
      const pid = item.id || item.productId;
      const pqty = Number(item.qty || item.quantity || 1);
      const price = Number(item.price || 0);
      totalItemsCount += pqty;
      computedTotal += price * pqty;

      const current = db.prepare('SELECT stock FROM products WHERE id = ?').get(pid);
      if (current) {
        const beforeStock = current.stock;
        const afterStock = Math.max(0, beforeStock - pqty);
        db.prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?').run(afterStock, now, pid);

        db.prepare(`
          INSERT INTO inventory_movements (id, product_id, movement_type, quantity, before_stock, after_stock, reference_id, reason, actor, created_at)
          VALUES (?, ?, 'online_order', ?, ?, ?, ?, ?, 'Storefront Customer', ?)
        `).run('MOV-' + Math.floor(100000 + Math.random() * 900000), pid, -pqty, beforeStock, afterStock, orderId, `Online Order ${orderId}`, now);
      }
    }

    const finalSubtotal = subtotal !== undefined ? Number(subtotal) : computedTotal;
    const finalDiscount = Number(discount || 0);
    const finalTotal = total !== undefined ? Number(total) : Math.max(0, finalSubtotal - finalDiscount);

    // Customer record
    let cust = db.prepare('SELECT * FROM customers WHERE phone = ?').get(primaryPhone);
    let custId = cust ? cust.id : ('CUST-' + Math.floor(1000 + Math.random() * 9000));
    if (!cust) {
      db.prepare(`
        INSERT INTO customers (id, name, phone, address, corridor, verified, total_orders, lifetime_spend, outstanding_balance, created_at, last_activity)
        VALUES (?, ?, ?, ?, ?, 1, 1, ?, 0, ?, ?)
      `).run(custId, customerName, primaryPhone, finalAddress, corridor || 'Sikar', finalTotal, now, now);
    } else {
      db.prepare('UPDATE customers SET total_orders = total_orders + 1, lifetime_spend = lifetime_spend + ?, last_activity = ? WHERE id = ?')
        .run(finalTotal, now, cust.id);
    }

    const activityLog = JSON.stringify([
      { status: 'pending', timestamp: now, actor: 'Customer', note: 'Order placed on website' }
    ]);

    const finalPaymentStatus = paymentStatus || (paymentMethod === 'UPI' ? 'Paid' : 'Pending');

    db.prepare(`
      INSERT INTO orders (
        id, customer_id, customer_name, customer_phone, login_phone, delivery_phone,
        corridor, delivery_address, items_json, items_count, subtotal, discount, total,
        payment_method, payment_status, status, vehicle, order_date, delivery_time,
        notes, activity_log_json, created_at, updated_at,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term, attribution_platform, session_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', ?, 'Within 40 Mins', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId, custId, customerName, primaryPhone, finalLoginPhone, finalDeliveryPhone,
      corridor || 'Sikar', finalAddress, JSON.stringify(items), totalItemsCount,
      finalSubtotal, finalDiscount, finalTotal, paymentMethod, finalPaymentStatus,
      now.split('T')[0], notes, activityLog, now, now,
      utmSource, utmMedium, utmCampaign, utmContent, utmTerm, attributionPlatform, sessionId
    );

    // Record purchase conversion event in social_analytics (deduplicated by order_id)
    const existingEvt = db.prepare('SELECT id FROM social_analytics WHERE order_id = ? AND action_type = ?').get(orderId, 'purchase_complete');
    if (!existingEvt) {
      db.prepare(`
        INSERT INTO social_analytics (
          id, session_id, visitor_id, platform, source_page, action_type,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          order_id, order_value, metadata_json, created_at
        )
        VALUES (?, ?, ?, ?, '/cart.html', 'purchase_complete', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'EVT-' + Math.floor(100000 + Math.random() * 900000),
        sessionId,
        visitorId,
        attributionPlatform,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        orderId,
        finalTotal,
        JSON.stringify({ itemsCount: totalItemsCount, paymentMethod }),
        now
      );
    }

    return { orderId, total: finalTotal, itemsCount: totalItemsCount, status: 'pending', loginPhone: finalLoginPhone, deliveryPhone: finalDeliveryPhone, customerPhone: primaryPhone, customerName, items };
  });

  return runTx();
}

// 5. ATOMIC ORDER STATUS UPDATE
function updateOrderStatusTransaction({ orderId, newStatus, paymentStatus, vehicle, note = '', actor = 'Admin' }) {
  const runTx = db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new Error('Order not found: ' + orderId);

    const validStatuses = ['pending', 'confirmed', 'processing', 'in_transit', 'shipped', 'delivered', 'completed', 'cancelled'];
    if (newStatus && !validStatuses.includes(newStatus)) {
      throw new Error(`Invalid order status: ${newStatus}`);
    }

    // Terminal state protection
    if (order.status === 'cancelled' && newStatus && newStatus !== 'cancelled') {
      throw new Error('Order is already cancelled and cannot be modified. Cancelled status is terminal.');
    }
    if ((order.status === 'completed' || order.status === 'delivered') && newStatus === 'pending') {
      throw new Error('Delivered orders cannot be moved back to pending status.');
    }

    // Cancellation requires a recorded reason
    if (newStatus === 'cancelled' && order.status !== 'cancelled' && (!note || !note.trim())) {
      throw new Error('A cancellation reason is required to cancel an order.');
    }

    const effectiveStatus = newStatus || order.status;
    let effectivePayStatus = paymentStatus !== undefined && paymentStatus !== null && paymentStatus !== ''
      ? paymentStatus
      : order.payment_status;

    // Automatic payment status inference if not explicitly specified
    if ((effectiveStatus === 'completed' || effectiveStatus === 'delivered') && effectivePayStatus === 'Pending') {
      effectivePayStatus = 'Paid';
    }

    const effectiveVehicle = (vehicle !== undefined && vehicle !== null) ? String(vehicle).trim() : (order.vehicle || '');

    const now = new Date().toISOString();
    let activityLog = [];
    try {
      activityLog = JSON.parse(order.activity_log_json || '[]');
    } catch (e) {
      activityLog = [];
    }

    activityLog.push({
      status: effectiveStatus,
      paymentStatus: effectivePayStatus,
      timestamp: now,
      actor: actor,
      note: note || `Status updated to ${effectiveStatus} (Payment: ${effectivePayStatus})`
    });

    // If order is transitioning to cancelled for the first time, restock inventory safely
    if (effectiveStatus === 'cancelled' && order.status !== 'cancelled') {
      try {
        let items = [];
        try {
          items = typeof order.items_json === 'string' ? JSON.parse(order.items_json) : (order.items_json || []);
        } catch (e) {
          items = [];
        }

        for (const item of items) {
          const pid = item.id || item.productId;
          const pqty = Number(item.qty || item.quantity || 1);
          if (pid && pqty > 0) {
            const prod = db.prepare('SELECT stock, title FROM products WHERE id = ?').get(pid);
            if (prod) {
              const beforeStock = prod.stock;
              const afterStock = beforeStock + pqty;
              db.prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?').run(afterStock, now, pid);

              db.prepare(`
                INSERT INTO inventory_movements (id, product_id, movement_type, quantity, before_stock, after_stock, reference_id, reason, actor, created_at)
                VALUES (?, ?, 'cancellation_restock', ?, ?, ?, ?, ?, ?, ?)
              `).run(
                'MOV-' + Math.floor(100000 + Math.random() * 900000),
                pid,
                pqty,
                beforeStock,
                afterStock,
                orderId,
                `Restocked due to Order Cancellation ${orderId}: ${note || 'Admin cancelled'}`,
                actor,
                now
              );
            }
          }
        }
      } catch (err) {
        console.error('Error parsing items for cancellation restock:', err);
      }
    }

    db.prepare("UPDATE orders SET status = ?, payment_status = ?, vehicle = ?, activity_log_json = ?, updated_at = ? WHERE id = ?")
      .run(effectiveStatus, effectivePayStatus, effectiveVehicle, JSON.stringify(activityLog), now, orderId);

    db.prepare(`
      INSERT INTO audit_logs (id, actor, action, module, details, created_at)
      VALUES (?, ?, 'ORDER_STATUS_UPDATED', 'orders', ?, ?)
    `).run('AUD-' + Math.floor(100000 + Math.random() * 900000), actor, `Updated order ${orderId} status from ${order.status} to ${effectiveStatus} (payment: ${effectivePayStatus})`, now);

    return {
      orderId,
      oldStatus: order.status,
      newStatus: effectiveStatus,
      status: effectiveStatus,
      oldPaymentStatus: order.payment_status,
      paymentStatus: effectivePayStatus,
      payment_status: effectivePayStatus,
      vehicle: effectiveVehicle,
      activityLog
    };
  });

  return runTx();
}

// Initialize on module load
initDatabase();

module.exports = {
  db,
  recordManualSaleTransaction,
  recordKhataPaymentTransaction,
  receivePurchaseTransaction,
  createOnlineOrderTransaction,
  updateOrderStatusTransaction
};
