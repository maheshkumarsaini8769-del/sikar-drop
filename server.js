const fs = require('fs');
const path = require('path');

let express, cors, bodyParser;
try {
  express = require('express');
} catch (e) {
  express = require('/home/mahesh/Documents/Hotel-Software/node_modules/express');
}
try {
  cors = require('cors');
} catch (e) {
  cors = require('/home/mahesh/Documents/Hotel-Software/node_modules/cors');
}
try {
  bodyParser = require('body-parser');
} catch (e) {
  bodyParser = require('/home/mahesh/Documents/Hotel-Software/node_modules/body-parser');
}

const {
  db,
  recordManualSaleTransaction,
  recordKhataPaymentTransaction,
  receivePurchaseTransaction,
  createOnlineOrderTransaction,
  updateOrderStatusTransaction
} = require('./db.js');

const app = express();
const PORT = process.env.PORT || 8080;
const IS_DEV = process.env.NODE_ENV !== 'production';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '25mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '25mb' }));

// Logging & Audit Middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (req.method !== 'GET') {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
      }
    });
  }
  next();
});

// ==========================================
// 1. DYNAMIC SEO: SITEMAP & ROBOTS.TXT
// ==========================================
app.get('/sitemap.xml', (req, res) => {
  const host = req.get('host') || 'localhost:8080';
  const protocol = req.protocol || 'http';
  const baseUrl = `${protocol}://${host}`;
  const now = new Date().toISOString().split('T')[0];

  const products = db.prepare('SELECT id, updated_at FROM products WHERE active = 1').all();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/products</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.95</priority>
  </url>
  <url>
    <loc>${baseUrl}/categories</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/bulk</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/track</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
  </url>
  <url>
    <loc>${baseUrl}/about</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/why</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/faq</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/contact</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;

  products.forEach(p => {
    xml += `
  <url>
    <loc>${baseUrl}/products#product-${p.id}</loc>
    <lastmod>${p.updated_at ? p.updated_at.split('T')[0] : now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>`;
  });

  xml += '\n</urlset>';
  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

app.get('/robots.txt', (req, res) => {
  const host = req.get('host') || 'localhost:8080';
  const protocol = req.protocol || 'http';
  res.header('Content-Type', 'text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Sitemap: ${protocol}://${host}/sitemap.xml
`);
});

// ==========================================
// 2. AUTHENTICATION & SUB-ADMIN RBAC
// ==========================================
app.post('/api/auth/login', (req, res) => {
  try {
    const { pin, username } = req.body;
    if (!pin) return res.status(400).json({ error: 'PIN is required' });

    let admin = null;
    if (username) {
      admin = db.prepare('SELECT * FROM admin_users WHERE username = ? AND pin = ? AND active = 1').get(username, pin);
    } else {
      admin = db.prepare('SELECT * FROM admin_users WHERE pin = ? AND active = 1').get(pin);
    }

    if (!admin) {
      return res.status(401).json({ error: 'Invalid master PIN or user credentials' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE admin_users SET last_login = ? WHERE id = ?').run(now, admin.id);

    db.prepare(`
      INSERT INTO audit_logs (id, actor, action, module, details, created_at)
      VALUES (?, ?, 'LOGIN_SUCCESS', 'auth', ?, ?)
    `).run('AUD-' + Math.floor(100000 + Math.random() * 900000), admin.name, `Successful login as ${admin.role}`, now);

    res.json({
      success: true,
      user: {
        id: admin.id,
        name: admin.name,
        username: admin.username,
        role: admin.role,
        permissions: JSON.parse(admin.permissions_json)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/subadmins', (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, name, role, permissions_json, active, created_at, last_login FROM admin_users').all();
    const formatted = users.map(u => ({
      ...u,
      permissions: JSON.parse(u.permissions_json)
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/subadmins', (req, res) => {
  try {
    const { username, email, name, role, pin, password, permissions } = req.body;
    const finalUsername = username || email || (name ? name.toLowerCase().replace(/\s+/g, '_') : '');
    const finalPin = pin || password || '1234';
    if (!finalUsername || !name) return res.status(400).json({ error: 'Username/email and name are required' });

    const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(finalUsername);
    if (existing) return res.status(400).json({ error: 'Username already exists' });

    const id = 'ADM-' + Math.floor(100 + Math.random() * 900);
    const now = new Date().toISOString();
    const permsJson = JSON.stringify(permissions || ['dashboard']);

    db.prepare(`
      INSERT INTO admin_users (id, username, name, role, pin, permissions_json, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(id, finalUsername, name, role || 'Staff', finalPin, permsJson, now);

    db.prepare(`
      INSERT INTO audit_logs (id, actor, action, module, details, created_at)
      VALUES (?, 'Super Admin', 'SUBADMIN_CREATED', 'subadmin', ?, ?)
    `).run('AUD-' + Math.floor(100000 + Math.random() * 900000), `Created sub-admin account ${finalUsername} (${name}) with role ${role}`, now);

    res.status(201).json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/auth/subadmins/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'ADM-01') return res.status(400).json({ error: 'Cannot delete primary super admin account' });
    db.prepare('DELETE FROM admin_users WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/audit-logs', (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. DASHBOARD METRICS & SPEEDOMETERS
// ==========================================
app.get('/api/dashboard/stats', (req, res) => {
  try {
    const period = req.query.period || 'all'; // today, 7days, this_month, all
    let dateFilterOrders = '1=1';
    let dateFilterSales = '1=1';
    const now = new Date();

    if (period === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      dateFilterOrders = `order_date = '${todayStr}'`;
      dateFilterSales = `sale_date = '${todayStr}'`;
    } else if (period === '7days') {
      const past7 = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
      dateFilterOrders = `order_date >= '${past7}'`;
      dateFilterSales = `sale_date >= '${past7}'`;
    } else if (period === 'this_month') {
      const monthPrefix = now.toISOString().substring(0, 7);
      dateFilterOrders = `order_date LIKE '${monthPrefix}%'`;
      dateFilterSales = `sale_date LIKE '${monthPrefix}%'`;
    }

    // Orders Stats
    const totalOrdersCount = db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE ${dateFilterOrders}`).get().c;
    const pendingOrders = db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE status = 'pending' AND ${dateFilterOrders}`).get().c;
    const confirmedOrders = db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE status = 'confirmed' AND ${dateFilterOrders}`).get().c;
    const completedOrders = db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE status = 'completed' AND ${dateFilterOrders}`).get().c;
    const cancelledOrders = db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE status = 'cancelled' AND ${dateFilterOrders}`).get().c;
    const onlineRevenue = db.prepare(`SELECT COALESCE(SUM(total), 0) AS rev FROM orders WHERE status != 'cancelled' AND ${dateFilterOrders}`).get().rev;

    // Manual Sales Stats
    const manualSalesCount = db.prepare(`SELECT COUNT(*) AS c FROM manual_sales WHERE ${dateFilterSales}`).get().c;
    const manualSalesRevenue = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) AS rev FROM manual_sales WHERE ${dateFilterSales}`).get().rev;

    // Total Combined Sales Revenue
    const totalSalesRevenue = onlineRevenue + manualSalesRevenue;

    // Purchases Expenses
    const purchaseExpenses = db.prepare("SELECT COALESCE(SUM(total_cost), 0) AS exp FROM purchases WHERE status = 'received'").get().exp;

    // Product & Inventory Metrics
    const totalProducts = db.prepare('SELECT COUNT(*) AS c FROM products WHERE active = 1').get().c;
    const totalInventoryQty = db.prepare('SELECT COALESCE(SUM(stock), 0) AS s FROM products WHERE active = 1').get().s;
    const lowStockCount = db.prepare('SELECT COUNT(*) AS c FROM products WHERE active = 1 AND stock <= low_stock_threshold').get().c;
    const stockValuation = db.prepare('SELECT COALESCE(SUM(stock * cost), 0) AS val FROM products WHERE active = 1').get().val;

    // Customer & Outstanding Dues
    const totalCustomers = db.prepare('SELECT COUNT(*) AS c FROM customers').get().c;
    const outstandingDues = db.prepare("SELECT COALESCE(SUM(remaining_amount), 0) AS dues FROM khata_entries WHERE status != 'settled'").get().dues;

    // Estimated Gross Profit calculation: Total Revenue - COGS
    // We estimate average gross margin ~ 22% of revenue
    const estimatedCOGS = totalSalesRevenue * 0.76;
    const grossProfit = Math.round(totalSalesRevenue - estimatedCOGS);
    const estimatedNetProfit = Math.max(0, grossProfit - 12400); // minus operating overheads

    // Meter percentages
    const orderCompletionRate = totalOrdersCount > 0 ? Math.round((completedOrders / totalOrdersCount) * 100) : 92;
    const inventoryAvailabilityPct = totalProducts > 0 ? Math.round(((totalProducts - lowStockCount) / totalProducts) * 100) : 85;
    const lowStockPercentage = totalProducts > 0 ? Math.round((lowStockCount / totalProducts) * 100) : 15;
    const salesVsExpenseRatio = purchaseExpenses > 0 ? Math.min(100, Math.round((totalSalesRevenue / purchaseExpenses) * 100)) : 100;

    // Visitors count (simulated baseline + real analytics events)
    const socialClicks = db.prepare('SELECT COUNT(*) AS c FROM social_analytics').get().c;
    const totalVisitors = 3840 + socialClicks * 4 + totalOrdersCount * 3;

    res.json({
      period,
      totalVisitors,
      totalOrders: totalOrdersCount + manualSalesCount,
      onlineOrdersCount: totalOrdersCount,
      manualSalesCount,
      pendingOrders,
      confirmedOrders,
      completedOrders,
      cancelledOrders,
      totalSalesRevenue,
      onlineRevenue,
      manualSalesRevenue,
      purchaseExpenses,
      grossProfit,
      estimatedNetProfit,
      totalProducts,
      totalInventoryQty,
      lowStockCount,
      stockValuation,
      outstandingPayments: outstandingDues,
      totalRegisteredCustomers: totalCustomers,
      meters: {
        orderCompletionRate,
        inventoryAvailabilityPct,
        lowStockPercentage,
        salesVsExpenseRatio,
        revenueScore: Math.min(100, Math.round((totalSalesRevenue / 150000) * 100))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Global Dashboard Search
app.get('/api/dashboard/search', (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ customers: [], orders: [], products: [], khata: [] });

    const searchStr = `%${q}%`;
    const customers = db.prepare('SELECT id, name, phone, outstanding_balance FROM customers WHERE name LIKE ? OR phone LIKE ? LIMIT 5').all(searchStr, searchStr);
    const orders = db.prepare('SELECT id, customer_name, customer_phone, login_phone, delivery_phone, total, status FROM orders WHERE id LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR login_phone LIKE ? OR delivery_phone LIKE ? LIMIT 5').all(searchStr, searchStr, searchStr, searchStr, searchStr);
    const products = db.prepare('SELECT id, title, stock, price FROM products WHERE title LIKE ? OR sku LIKE ? LIMIT 5').all(searchStr, searchStr);
    const khata = db.prepare('SELECT id, customer_name, customer_phone, remaining_amount, due_date FROM khata_entries WHERE customer_name LIKE ? OR customer_phone LIKE ? LIMIT 5').all(searchStr, searchStr);

    res.json({ customers, orders, products, khata });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. ORDERS MANAGEMENT (ONLINE ORDERS)
// ==========================================
app.get('/api/orders', (req, res) => {
  try {
    const { status, phone } = req.query;
    let query = 'SELECT * FROM orders';
    const params = [];

    if (status && status !== 'all') {
      query += ' WHERE status = ?';
      params.push(status);
    } else if (phone) {
      query += ' WHERE customer_phone = ? OR login_phone = ? OR delivery_phone = ?';
      params.push(phone, phone, phone);
    }

    query += ' ORDER BY created_at DESC';
    const orders = db.prepare(query).all(...params);

    const formatted = orders.map(o => {
      const loginPh = (o.login_phone || o.customer_phone || '').trim();
      const delivPh = (o.delivery_phone || o.customer_phone || '').trim();
      return {
        ...o,
        login_phone: loginPh,
        delivery_phone: delivPh,
        loginPhone: loginPh,
        deliveryPhone: delivPh,
        items: JSON.parse(o.items_json || '[]'),
        activityLog: JSON.parse(o.activity_log_json || '[]')
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/:id', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const parsedItems = JSON.parse(order.items_json || '[]');
    const parsedActivity = JSON.parse(order.activity_log_json || '[]');
    const loginPh = (order.login_phone || order.customer_phone || '').trim();
    const delivPh = (order.delivery_phone || order.customer_phone || '').trim();
    const enrichedOrder = {
      ...order,
      login_phone: loginPh,
      delivery_phone: delivPh,
      loginPhone: loginPh,
      deliveryPhone: delivPh,
      items: parsedItems,
      activityLog: parsedActivity
    };
    res.json({
      ...enrichedOrder,
      order: enrichedOrder
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders', (req, res) => {
  try {
    const { orderId, customerName, customerPhone, loginPhone, deliveryPhone, addressPhone, login_phone, delivery_phone, corridor, address, deliveryAddress, items, subtotal, discount, total, paymentMethod, notes } = req.body;
    const effectiveLoginPhone = (loginPhone || login_phone || customerPhone || deliveryPhone || delivery_phone || '').trim();
    const effectiveDeliveryPhone = (deliveryPhone || delivery_phone || addressPhone || customerPhone || effectiveLoginPhone).trim();
    const effectivePrimaryPhone = effectiveLoginPhone || effectiveDeliveryPhone;

    if (!customerName || !effectivePrimaryPhone || !items || items.length === 0) {
      return res.status(400).json({ error: 'Customer name, phone, and items are required' });
    }

    // Validate delivery area/address against Admin's serviceable delivery zones
    const combinedLoc = `${address || ''} ${deliveryAddress || ''} ${corridor || ''}`.trim();
    if (combinedLoc) {
      const zoneCheck = evaluateDeliveryZoneMatch(combinedLoc);
      if (zoneCheck.activeZones && zoneCheck.activeZones.length > 0 && !zoneCheck.available) {
        return res.status(400).json({
          error: zoneCheck.message || 'Delivery is not available in this area. Please select an Admin-approved Sikar delivery location.',
          serviceable: false,
          activeZones: zoneCheck.activeZones
        });
      }
    }

    const result = createOnlineOrderTransaction({
      orderId,
      customerName,
      customerPhone: effectivePrimaryPhone,
      loginPhone: effectiveLoginPhone,
      deliveryPhone: effectiveDeliveryPhone,
      corridor,
      address: address || deliveryAddress,
      deliveryAddress,
      items,
      subtotal,
      discount: discount || 0,
      total,
      paymentMethod: paymentMethod || 'COD',
      notes
    });

    res.status(201).json({ success: true, order: result, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/orders/:id/status', (req, res) => {
  try {
    const { status, vehicle, note, actor } = req.body;
    if (!status) return res.status(400).json({ error: 'New status is required' });

    const result = updateOrderStatusTransaction({
      orderId: req.params.id,
      newStatus: status,
      vehicle,
      note,
      actor: actor || 'Admin'
    });

    res.json({ success: true, order: result, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 5. MANUAL CASH SALES (POS)
// ==========================================
app.get('/api/manual-sales', (req, res) => {
  try {
    const sales = db.prepare('SELECT * FROM manual_sales ORDER BY created_at DESC').all();
    const formatted = sales.map(s => ({
      ...s,
      items: JSON.parse(s.items_json || '[]')
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/manual-sales', (req, res) => {
  try {
    const { idempotencyToken, customerId, customerName, customerPhone, items, subtotal, discount, totalAmount, amountReceived, outstandingAmount, paymentMethod, saleDate, notes, actor } = req.body;

    if (!customerName || !customerPhone || !items || items.length === 0) {
      return res.status(400).json({ error: 'Customer name, phone, and at least one item are required' });
    }

    if (idempotencyToken) {
      const existing = db.prepare('SELECT * FROM manual_sales WHERE idempotency_token = ?').get(idempotencyToken);
      if (existing) {
        return res.status(200).json({
          success: true,
          saleId: existing.id,
          totalAmount: existing.total_amount,
          amountReceived: existing.amount_received,
          balanceDue: existing.outstanding_amount,
          outstandingAmount: existing.outstanding_amount,
          isDuplicate: true
        });
      }
    }

    const result = recordManualSaleTransaction({
      idempotencyToken,
      customerId,
      customerName,
      customerPhone,
      items,
      subtotal,
      discount: discount || 0,
      totalAmount,
      amountReceived,
      outstandingAmount,
      paymentMethod: paymentMethod || 'Cash',
      saleDate,
      notes,
      actor: actor || 'Admin'
    });

    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 6. CUSTOMERS & UNIFIED HISTORY
// ==========================================
app.get('/api/customers', (req, res) => {
  try {
    const q = (req.query.search || '').trim();
    const limit = parseInt(req.query.limit, 10);
    const offset = parseInt(req.query.offset, 10) || 0;
    let query = 'SELECT * FROM customers';
    const params = [];
    if (q) {
      query += ' WHERE name LIKE ? OR phone LIKE ?';
      params.push(`%${q}%`, `%${q}%`);
    }
    query += ' ORDER BY last_activity DESC';
    if (limit && limit > 0) {
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    }
    const customers = db.prepare(query).all(...params);
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/customers/:id', (req, res) => {
  try {
    const rawId = req.params.id;
    const cleanPhone = rawId.replace(/[^0-9]/g, '');
    let customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(rawId);
    if (!customer && cleanPhone) {
      customer = db.prepare("SELECT * FROM customers WHERE REPLACE(phone, ' ', '') = ? OR phone LIKE ?").get(cleanPhone, `%${cleanPhone.slice(-10)}`);
    }
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const custPhoneClean = (customer.phone || '').replace(/[^0-9]/g, '');

    // Retrieve Online Orders
    const onlineOrders = db.prepare("SELECT * FROM orders WHERE customer_id = ? OR REPLACE(customer_phone, ' ', '') = ? OR customer_phone LIKE ? ORDER BY created_at DESC").all(customer.id, custPhoneClean, `%${custPhoneClean.slice(-10)}`);
    const formattedOrders = onlineOrders.map(o => ({
      ...o,
      items: JSON.parse(o.items_json || '[]')
    }));

    // Retrieve Manual POS Sales
    const manualSales = db.prepare("SELECT * FROM manual_sales WHERE customer_id = ? OR REPLACE(customer_phone, ' ', '') = ? OR customer_phone LIKE ? ORDER BY created_at DESC").all(customer.id, custPhoneClean, `%${custPhoneClean.slice(-10)}`);
    const formattedSales = manualSales.map(s => ({
      ...s,
      items: JSON.parse(s.items_json || '[]')
    }));

    // Retrieve Payments
    const payments = db.prepare("SELECT * FROM payments WHERE customer_id = ? OR REPLACE(customer_phone, ' ', '') = ? OR customer_phone LIKE ? ORDER BY created_at DESC").all(customer.id, custPhoneClean, `%${custPhoneClean.slice(-10)}`);

    // Retrieve Khata dues
    const khata = db.prepare("SELECT * FROM khata_entries WHERE customer_id = ? OR REPLACE(customer_phone, ' ', '') = ? OR customer_phone LIKE ? ORDER BY created_at DESC").all(customer.id, custPhoneClean, `%${custPhoneClean.slice(-10)}`);

    res.json({
      customer,
      onlineOrders: formattedOrders,
      manualSales: formattedSales,
      payments,
      khataEntries: khata
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers', (req, res) => {
  try {
    const { name, phone, email, corridor, address } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });

    const id = 'CUST-' + Math.floor(1000 + Math.random() * 9000);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO customers (id, name, phone, email, corridor, address, verified, total_orders, lifetime_spend, outstanding_balance, created_at, last_activity)
      VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, 0, ?, ?)
    `).run(id, name, phone, email || '', corridor || '', address || '', now, now);

    res.status(201).json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. KHATA & CUSTOMER DUES (OUTSTANDING PAYMENTS)
// ==========================================
app.get('/api/khata', (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM khata_entries';
    const params = [];
    if (status && status !== 'all') {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY due_date ASC, created_at DESC';
    const entries = db.prepare(query).all(...params);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/khata', (req, res) => {
  try {
    const { customerId, customerName, customerPhone, amount, reason, dueDate, reminderDate, notes } = req.body;
    if (!customerName || !customerPhone || !amount) return res.status(400).json({ error: 'Customer name, phone, and amount are required' });

    const id = 'KH-' + Math.floor(100000 + Math.random() * 900000);
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(`
        INSERT INTO khata_entries (id, customer_id, customer_name, customer_phone, amount, paid_amount, remaining_amount, reason, due_date, reminder_date, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'pending', ?, ?, ?)
      `).run(id, customerId || 'WALK-IN', customerName, customerPhone, amount, amount, reason || 'Credit Supply', dueDate || '', reminderDate || '', notes || '', now, now);

      // Update customer balance
      let cust = customerId ? db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId) : null;
      if (!cust) cust = db.prepare('SELECT id FROM customers WHERE phone = ?').get(customerPhone);
      if (cust) {
        db.prepare('UPDATE customers SET outstanding_balance = outstanding_balance + ?, last_activity = ? WHERE id = ?').run(amount, now, cust.id);
      }
    })();

    res.status(201).json({ success: true, id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/khata/pay', (req, res) => {
  try {
    const { khataId, amountPaid, paymentMethod, notes, actor } = req.body;
    if (!khataId || !amountPaid) return res.status(400).json({ error: 'Khata ID and amount are required' });

    const result = recordKhataPaymentTransaction({
      khataId,
      amountPaid: Number(amountPaid),
      paymentMethod: paymentMethod || 'Cash',
      notes,
      actor: actor || 'Admin'
    });

    res.json({ 
      success: true, 
      ...result, 
      remainingDue: result.remaining, 
      settled: result.newStatus === 'settled' 
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/khata/:id/remind', (req, res) => {
  try {
    const { id } = req.params;
    const entry = db.prepare('SELECT * FROM khata_entries WHERE id = ?').get(id);
    if (!entry) return res.status(404).json({ error: 'Khata entry not found' });

    const now = new Date().toISOString();
    db.prepare('UPDATE khata_entries SET whatsapp_reminded_at = ?, updated_at = ? WHERE id = ?').run(now, now, id);

    // Build WhatsApp Message Payload
    const cleanPhone = entry.customer_phone.replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : ('91' + cleanPhone);
    const msg = `Namaste ${entry.customer_name} ji, Sikar Drop Depot se reminder: Aapka pending bill amount Rs.${entry.remaining_amount} (${entry.reason || 'Water & Drinks Supply'}) due date ${entry.due_date || 'jaldi'} tak pay karein. UPI / Cash delivery accept ki jaati hai. Helpline: +91 98290 XXXXX. Dhanyawad!`;
    const waLink = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;

    res.json({ success: true, whatsappUrl: waLink, message: msg, remindedAt: now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8. INVENTORY MANAGEMENT & MOVEMENTS
// ==========================================
app.get('/api/inventory', (req, res) => {
  try {
    const items = db.prepare(`
      SELECT p.id, p.sku, p.title, p.category, p.stock, p.low_stock_threshold, p.cost, p.price, p.mrp,
             (p.stock * p.cost) AS stock_valuation,
             CASE WHEN p.stock <= p.low_stock_threshold THEN 1 ELSE 0 END AS is_low_stock
      FROM products p
      WHERE p.active = 1
      ORDER BY is_low_stock DESC, p.stock ASC
    `).all();

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/inventory/movements', (req, res) => {
  try {
    const { productId, limit } = req.query;
    let query = 'SELECT m.*, p.title AS product_title FROM inventory_movements m JOIN products p ON m.product_id = p.id';
    const params = [];
    if (productId) {
      query += ' WHERE m.product_id = ?';
      params.push(productId);
    }
    query += ' ORDER BY m.created_at DESC LIMIT ?';
    params.push(Number(limit) || 50);

    const movements = db.prepare(query).all(...params);
    res.json(movements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventory/adjust', (req, res) => {
  try {
    const { productId, adjustmentQty, newStock, reason, movementType, actor } = req.body;
    if (!productId || (adjustmentQty === undefined && newStock === undefined)) {
      return res.status(400).json({ error: 'Product ID and adjustment quantity or new stock are required' });
    }

    const prod = db.prepare('SELECT stock, title FROM products WHERE id = ?').get(productId);
    if (!prod) return res.status(404).json({ error: 'Product not found' });

    const beforeStock = prod.stock;
    const qty = (adjustmentQty !== undefined) ? Number(adjustmentQty) : (Number(newStock) - beforeStock);
    const afterStock = Math.max(0, (newStock !== undefined) ? Number(newStock) : (beforeStock + qty));
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?').run(afterStock, now, productId);

      db.prepare(`
        INSERT INTO inventory_movements (id, product_id, movement_type, quantity, before_stock, after_stock, reference_id, reason, actor, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('MOV-' + Math.floor(100000 + Math.random() * 900000), productId, movementType || 'adjustment', qty, beforeStock, afterStock, 'MANUAL-ADJ', reason || 'Stock correction', actor || 'Admin', now);

      db.prepare(`
        INSERT INTO audit_logs (id, actor, action, module, details, created_at)
        VALUES (?, ?, 'STOCK_ADJUSTED', 'inventory', ?, ?)
      `).run('AUD-' + Math.floor(100000 + Math.random() * 900000), actor || 'Admin', `Adjusted stock for ${prod.title}: ${beforeStock} -> ${afterStock} (Qty: ${qty > 0 ? '+' + qty : qty}, Reason: ${reason})`, now);
    })();

    res.json({ success: true, productId, beforeStock, afterStock, adjustment: qty });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 9. PURCHASES (SUPPLIER INWARD STOCK)
// ==========================================
app.get('/api/purchases', (req, res) => {
  try {
    const purchases = db.prepare('SELECT * FROM purchases ORDER BY created_at DESC').all();
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchases', (req, res) => {
  try {
    const { supplierName, supplierPhone, productId, qty, unitCost, billNo, invoiceDate, paymentMethod, notes, status, autoReceive } = req.body;
    if (!supplierName || !productId || !qty || !unitCost) {
      return res.status(400).json({ error: 'Supplier name, product, quantity, and unit cost are required' });
    }

    const prod = db.prepare('SELECT title FROM products WHERE id = ?').get(productId);
    if (!prod) return res.status(404).json({ error: 'Product not found' });

    const id = 'PUR-' + Math.floor(100 + Math.random() * 900);
    const now = new Date().toISOString();
    const totalCost = Number(qty) * Number(unitCost);

    db.prepare(`
      INSERT INTO purchases (id, supplier_name, supplier_phone, product_id, product_title, qty, unit_cost, total_cost, bill_no, invoice_date, payment_method, payment_status, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Paid', ?, ?, ?)
    `).run(id, supplierName, supplierPhone || '', productId, prod.title, qty, unitCost, totalCost, billNo || '', invoiceDate || now.split('T')[0], paymentMethod || 'Bank Transfer', autoReceive ? 'draft' : (status || 'draft'), notes || '', now);

    // If autoReceive is true, immediately receive and increment inventory
    if (autoReceive || status === 'received') {
      receivePurchaseTransaction({ purchaseId: id, actor: 'Admin' });
    }

    res.status(201).json({ success: true, id, totalCost });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/purchases/:id/receive', (req, res) => {
  try {
    const result = receivePurchaseTransaction({ purchaseId: req.params.id, actor: req.body.actor || 'Admin' });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/suppliers', (req, res) => {
  try {
    const suppliers = db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all();
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/suppliers', (req, res) => {
  try {
    const { name, phone, address, contactPerson } = req.body;
    if (!name) return res.status(400).json({ error: 'Supplier name is required' });
    const id = 'SUP-' + Math.floor(10 + Math.random() * 90);
    const now = new Date().toISOString();
    db.prepare('INSERT INTO suppliers (id, name, phone, address, contact_person, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, name, phone || '', address || '', contactPerson || '', now);
    res.status(201).json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 10. PRODUCTS & BULK PRICE MANAGEMENT
// ==========================================
app.get('/api/products', (req, res) => {
  try {
    const { category, active } = req.query;
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (active === 'all') {
      // return both active and inactive
    } else if (active !== undefined) {
      query += ' AND active = ?';
      params.push(Number(active));
    } else {
      query += ' AND active = 1';
    }

    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    query += ' ORDER BY display_order ASC, created_at DESC, id DESC';
    const products = db.prepare(query).all(...params);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', (req, res) => {
  try {
    const { id, title, sku, category, price, mrp, cost, stock, lowStockThreshold, spec, image, description, displayOrder } = req.body;
    if (!title || !price || !category) return res.status(400).json({ error: 'Title, price, and category are required' });

    const finalId = id || ('p_' + Date.now());
    const now = new Date().toISOString();
    const finalSku = sku || ('SKR-' + Math.floor(1000 + Math.random() * 9000));
    const finalOrder = displayOrder !== undefined ? Number(displayOrder) : 0;

    db.prepare(`
      INSERT INTO products (id, sku, title, category, price, mrp, cost, stock, low_stock_threshold, spec, image, description, active, display_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(finalId, finalSku, title, category, Number(price), Number(mrp || price), Number(cost || (price * 0.75)), parseInt(stock, 10) || 0, parseInt(lowStockThreshold, 10) || 10, spec || '', image || 'assets/prod_bisleri_1l.jpg', description || '', finalOrder, now, now);

    res.status(201).json({ success: true, id: finalId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/products/:id', (req, res) => {
  try {
    const { title, category, price, mrp, cost, stock, lowStockThreshold, spec, image, description, active } = req.body;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE products SET
        title = COALESCE(?, title),
        category = COALESCE(?, category),
        price = COALESCE(?, price),
        mrp = COALESCE(?, mrp),
        cost = COALESCE(?, cost),
        stock = COALESCE(?, stock),
        low_stock_threshold = COALESCE(?, low_stock_threshold),
        spec = COALESCE(?, spec),
        image = COALESCE(?, image),
        description = COALESCE(?, description),
        active = COALESCE(?, active),
        updated_at = ?
      WHERE id = ?
    `).run(title, category, price !== undefined ? Number(price) : null, mrp !== undefined ? Number(mrp) : null, cost !== undefined ? Number(cost) : null, stock !== undefined ? parseInt(stock, 10) : null, lowStockThreshold !== undefined ? parseInt(lowStockThreshold, 10) : null, spec, image, description, active !== undefined ? Number(active) : null, now, req.params.id);

    res.json({ success: true, id: req.params.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date().toISOString();

    // Cleanly delete inventory movements and product record
    db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);

    db.prepare(`
      INSERT INTO audit_logs (id, actor, action, module, details, created_at)
      VALUES (?, 'Admin', 'PRODUCT_DELETED', 'products', ?, ?)
    `).run('AUD-' + Math.floor(100000 + Math.random() * 900000), `Deleted product ID ${id}`, now);

    res.json({ success: true, message: `Product ${id} deleted successfully` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/products/bulk-price', (req, res) => {
  try {
    const { mode, value, category, apply = false } = req.body; // mode: pct_increase, pct_decrease, fixed_increase, fixed_discount
    if (!mode || value === undefined) return res.status(400).json({ error: 'Mode and value are required' });

    let query = 'SELECT id, title, price, mrp, cost, category FROM products WHERE active = 1';
    const params = [];
    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    const eligible = db.prepare(query).all(...params);

    const val = Number(value);
    const previews = eligible.map(p => {
      let newPrice = p.price;
      if (mode === 'pct_increase') newPrice = Math.round(p.price * (1 + val / 100));
      else if (mode === 'pct_decrease') newPrice = Math.round(p.price * (1 - val / 100));
      else if (mode === 'fixed_increase') newPrice = Math.round(p.price + val);
      else if (mode === 'fixed_discount') newPrice = Math.max(1, Math.round(p.price - val));

      const margin = newPrice - p.cost;
      const marginPct = newPrice > 0 ? Math.round((margin / newPrice) * 100) : 0;
      const warning = newPrice <= p.cost ? 'PRICE BELOW COST!' : (marginPct < 8 ? 'Low margin warning (<8%)' : null);

      return {
        id: p.id,
        title: p.title,
        oldPrice: p.price,
        newPrice,
        cost: p.cost,
        margin,
        marginPct,
        warning
      };
    });

    if (apply) {
      const now = new Date().toISOString();
      db.transaction(() => {
        previews.forEach(item => {
          db.prepare('UPDATE products SET price = ?, updated_at = ? WHERE id = ?').run(item.newPrice, now, item.id);
        });
        db.prepare(`
          INSERT INTO audit_logs (id, actor, action, module, details, created_at)
          VALUES (?, 'Admin', 'BULK_PRICE_UPDATE', 'products', ?, ?)
        `).run('AUD-' + Math.floor(100000 + Math.random() * 900000), `Applied bulk price update (${mode} of ${value}) to ${previews.length} products`, now);
      })();
    }

    res.json({ success: true, count: previews.length, applied: apply, previews });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 11. CATEGORIES MANAGEMENT
// ==========================================
app.get('/api/categories', (req, res) => {
  try {
    const { active } = req.query;
    let query = 'SELECT * FROM categories';
    if (active !== 'all') {
      query += ' WHERE active = 1';
    }
    query += ' ORDER BY display_order ASC';
    const cats = db.prepare(query).all();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', (req, res) => {
  try {
    const { id, name, tagline, image } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });
    const catId = (id || name.toLowerCase().replace(/[^a-z0-9]/g, '_')).trim();
    const order = db.prepare('SELECT COUNT(*) AS c FROM categories').get().c + 1;
    db.prepare(`
      INSERT INTO categories (id, name, tagline, image, display_order, active)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        tagline = excluded.tagline,
        image = excluded.image,
        active = 1
    `).run(catId, name, tagline || '', image || 'assets/cat_water_bottles.jpg', order);
    res.status(201).json({ success: true, id: catId, message: `Category '${name}' saved` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/categories/:id', (req, res) => {
  try {
    const catId = req.params.id;
    const { name, tagline, image, active, displayOrder } = req.body;
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId);
    if (!existing) return res.status(404).json({ error: `Category '${catId}' not found` });

    db.prepare(`
      UPDATE categories SET
        name = COALESCE(?, name),
        tagline = COALESCE(?, tagline),
        image = COALESCE(?, image),
        active = COALESCE(?, active),
        display_order = COALESCE(?, display_order)
      WHERE id = ?
    `).run(name, tagline, image, active !== undefined ? Number(active) : null, displayOrder !== undefined ? Number(displayOrder) : null, catId);

    res.json({ success: true, id: catId, message: `Category '${catId}' updated` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', (req, res) => {
  try {
    const catId = req.params.id;
    const { reassignTo } = { ...req.query, ...req.body };

    // Find fallback category for any existing products
    const fallbackCat = reassignTo || 'water';
    const prodCount = db.prepare('SELECT COUNT(*) AS c FROM products WHERE category = ?').get(catId).c;
    if (prodCount > 0) {
      db.prepare('UPDATE products SET category = ? WHERE category = ?').run(fallbackCat, catId);
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(catId);
    res.json({ success: true, message: `Category '${catId}' deleted and products reassigned to '${fallbackCat}'` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 12. COUPONS & PROMOTIONS
// ==========================================
app.get('/api/coupons', (req, res) => {
  try {
    const coupons = db.prepare('SELECT * FROM coupons ORDER BY active DESC, created_at DESC').all();
    res.json(coupons);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/coupons', (req, res) => {
  try {
    const code = req.body.code;
    const discountVal = req.body.discountVal !== undefined ? req.body.discountVal : req.body.discount_val;
    const discountType = req.body.discountType || req.body.discount_type || 'percentage';
    const minOrder = req.body.minOrder !== undefined ? req.body.minOrder : (req.body.min_order || 0);
    const maxDiscount = req.body.maxDiscount !== undefined ? req.body.maxDiscount : (req.body.max_discount || 0);
    const expiryDate = req.body.expiryDate || req.body.expiry_date || '';
    const desc = req.body.desc || '';

    if (!code || discountVal === undefined) return res.status(400).json({ error: 'Code and discount value are required' });

    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO coupons (code, discount_type, discount_val, min_order, max_discount, usage_limit, per_user_limit, used_count, expiry_date, active, desc, created_at)
      VALUES (?, ?, ?, ?, ?, 100, 1, 0, ?, 1, ?, ?)
    `).run(code.toUpperCase(), discountType, discountVal, minOrder, maxDiscount, expiryDate, desc, now);

    res.status(201).json({ success: true, code: code.toUpperCase() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/coupons/validate', (req, res) => {
  try {
    const { code, orderTotal, orderAmount } = req.body;
    if (!code) return res.status(400).json({ valid: false, error: 'Please enter a coupon code' });

    const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(code.trim().toUpperCase());
    if (!coupon) return res.json({ valid: false, error: 'Invalid coupon code' });

    if (coupon.expiry_date) {
      const today = new Date().toISOString().split('T')[0];
      if (today > coupon.expiry_date) return res.json({ valid: false, error: 'Coupon code has expired' });
    }

    const totalVal = Number(orderTotal !== undefined ? orderTotal : (orderAmount || 0));

    if (totalVal < coupon.min_order) {
      return res.json({ valid: false, error: `Minimum order value for this coupon is Rs.${coupon.min_order}` });
    }

    let discount = 0;
    if (coupon.discount_type === 'percentage') {
      discount = Math.round((totalVal * coupon.discount_val) / 100);
      if (coupon.max_discount > 0) discount = Math.min(discount, coupon.max_discount);
    } else {
      discount = coupon.discount_val;
    }

    res.json({
      valid: true,
      code: coupon.code,
      discount,
      finalTotal: Math.max(0, totalVal - discount),
      desc: coupon.desc
    });
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

app.delete('/api/coupons/:code', (req, res) => {
  try {
    const { code } = req.params;
    db.prepare('DELETE FROM coupons WHERE code = ?').run(code.toUpperCase());
    res.json({ success: true, message: `Coupon ${code} deleted` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 13. CUSTOMER REVIEWS MODERATION
// ==========================================
app.get('/api/reviews', (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM reviews';
    const params = [];
    if (status && status !== 'all') {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY created_at DESC';
    const reviews = db.prepare(query).all(...params);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reviews', (req, res) => {
  try {
    const customerName = req.body.customerName || req.body.customer_name || req.body.name;
    const quote = req.body.quote || req.body.text || req.body.comment;
    const role = req.body.role || 'Customer';
    const location = req.body.location || 'Sikar';
    const rating = req.body.rating || 5;

    if (!customerName || !quote) return res.status(400).json({ error: 'Name and review text are required' });

    const id = req.body.id || ('REV-' + Math.floor(100 + Math.random() * 900));
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO reviews (id, customer_name, role, location, rating, quote, reply, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, '', 'approved', ?)
    `).run(id, customerName, role, location, rating, quote, now);

    res.status(201).json({ success: true, id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/reviews/:id/reply', (req, res) => {
  try {
    const { reply } = req.body;
    const now = new Date().toISOString().split('T')[0];
    db.prepare('UPDATE reviews SET reply = ?, reply_date = ? WHERE id = ?').run(reply, now, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/reviews/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 14. CMS & WEBSITE CONTENT
// ==========================================
app.get('/api/cms', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM website_content').all();
    const content = {};
    rows.forEach(r => content[r.key] = r.value);
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cms', (req, res) => {
  try {
    const updates = req.body;
    const now = new Date().toISOString();
    db.transaction(() => {
      for (const [key, value] of Object.entries(updates)) {
        db.prepare('INSERT OR REPLACE INTO website_content (key, value, updated_at) VALUES (?, ?, ?)')
          .run(key, String(value), now);
      }
    })();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 15. CONTACT ENQUIRIES
// ==========================================
app.get('/api/enquiries', (req, res) => {
  try {
    const enquiries = db.prepare('SELECT * FROM contact_enquiries ORDER BY created_at DESC').all();
    res.json(enquiries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/enquiries', (req, res) => {
  try {
    const { name, phone, subject, message } = req.body;
    if (!name || !phone || !message) return res.status(400).json({ error: 'Name, phone, and message are required' });

    const id = 'ENQ-' + Math.floor(1000 + Math.random() * 9000);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO contact_enquiries (id, name, phone, subject, message, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'unread', ?)
    `).run(id, name, phone, subject || 'General Query', message, now);

    res.status(201).json({ success: true, id, message: 'Enquiry submitted successfully. Depot support will contact you shortly.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 16. SOCIAL ANALYTICS
// ==========================================
app.post('/api/analytics/track', (req, res) => {
  try {
    const { platform, sourcePage, actionType } = req.body;
    const id = 'SOC-' + Math.floor(100000 + Math.random() * 900000);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO social_analytics (id, platform, source_page, action_type, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, platform || 'whatsapp', sourcePage || 'home', actionType || 'click_button', now);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/stats', (req, res) => {
  try {
    const platformCounts = db.prepare(`
      SELECT platform, COUNT(*) AS clicks, MAX(created_at) AS last_click
      FROM social_analytics
      GROUP BY platform
    `).all();

    const recentEvents = db.prepare('SELECT * FROM social_analytics ORDER BY created_at DESC LIMIT 20').all();

    res.json({ platforms: platformCounts, recentEvents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 17. OTP VERIFICATION (DEV & PROD SECURE FLOW)
// ==========================================
app.post('/api/otp/send', (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 5 * 60000).toISOString(); // 5 min expiry

    // Generate real 4-digit OTP or test 9999 in dev mode
    const generatedOtp = IS_DEV ? '9999' : String(Math.floor(1000 + Math.random() * 9000));

    db.prepare(`
      INSERT OR REPLACE INTO otp_codes (phone, otp_code, expires_at, attempts, verified, last_sent)
      VALUES (?, ?, ?, 0, 0, ?)
    `).run(cleanPhone, generatedOtp, expiresAt, now);

    console.log(`[AUTH-OTP] Sent OTP to ${cleanPhone} (DEV Mode: ${IS_DEV ? 'Enabled, OTP: 9999' : 'Active'})`);

    res.json({
      success: true,
      phone: cleanPhone,
      message: 'OTP sent successfully to your phone.',
      isDev: IS_DEV,
      testOtp: IS_DEV ? '9999' : undefined
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/otp/verify', (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP are required' });

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const record = db.prepare('SELECT * FROM otp_codes WHERE phone = ?').get(cleanPhone);

    if (!record) return res.status(400).json({ error: 'No OTP requested for this phone number' });

    // In dev mode allow 9999
    const isTestValid = IS_DEV && otp === '9999';
    const isActualValid = record.otp_code === otp && new Date().toISOString() <= record.expires_at;

    if (!isTestValid && !isActualValid) {
      db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ?').run(cleanPhone);
      return res.status(400).json({ error: 'Invalid or expired OTP. Please try again.' });
    }

    db.prepare('UPDATE otp_codes SET verified = 1 WHERE phone = ?').run(cleanPhone);

    // Fetch or create customer record
    let cust = db.prepare('SELECT * FROM customers WHERE phone = ?').get(cleanPhone);
    if (!cust) {
      const custId = 'CUST-' + Math.floor(1000 + Math.random() * 9000);
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO customers (id, name, phone, verified, total_orders, lifetime_spend, outstanding_balance, created_at, last_activity)
        VALUES (?, 'Verified User', ?, 1, 0, 0, 0, ?, ?)
      `).run(custId, cleanPhone, now, now);
      cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(custId);
    }

    res.json({
      success: true,
      verified: true,
      customer: cust
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 18. BACKUP & SYSTEM RECOVERY
// ==========================================
app.get('/api/backup/export', (req, res) => {
  try {
    const data = {
      timestamp: new Date().toISOString(),
      products: db.prepare('SELECT * FROM products').all(),
      categories: db.prepare('SELECT * FROM categories').all(),
      customers: db.prepare('SELECT * FROM customers').all(),
      orders: db.prepare('SELECT * FROM orders').all(),
      manual_sales: db.prepare('SELECT * FROM manual_sales').all(),
      khata_entries: db.prepare('SELECT * FROM khata_entries').all(),
      purchases: db.prepare('SELECT * FROM purchases').all(),
      coupons: db.prepare('SELECT * FROM coupons').all(),
      reviews: db.prepare('SELECT * FROM reviews').all(),
      website_content: db.prepare('SELECT * FROM website_content').all()
    };
    res.header('Content-Disposition', 'attachment; filename="sikar_drop_backup_' + Date.now() + '.json"');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 18.5 WEBSITE SETTINGS & FESTIVAL THEMES
// ==========================================
app.get('/api/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM website_settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    if (!settings.active_theme) settings.active_theme = 'default';
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/theme', (req, res) => {
  try {
    const { theme } = req.body;
    if (!theme) return res.status(400).json({ error: 'Theme name is required' });
    const now = new Date().toISOString();
    const tName = theme.toLowerCase();
    const presetColors = {
      normal: '#0284C7',
      default: '#0284C7',
      diwali: '#D97706',
      holi: '#E11D48',
      navratri: '#DC2626',
      newyear: '#06B6D4',
      national: '#EA580C',
      custom: '#7C3AED'
    };

    db.prepare(`
      INSERT INTO website_settings (key, value, updated_at)
      VALUES ('active_theme', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(tName, now);

    if (presetColors[tName]) {
      db.prepare(`
        INSERT INTO website_settings (key, value, updated_at)
        VALUES ('theme_accent_color', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(presetColors[tName], now);
    }

    db.prepare(`
      INSERT INTO audit_logs (id, actor, action, module, details, created_at)
      VALUES (?, 'Admin', 'THEME_UPDATED', 'settings', ?, ?)
    `).run('AUD-' + Math.floor(100000 + Math.random() * 900000), `Changed active website festival theme to '${theme}'`, now);

    res.json({ success: true, theme: tName, message: `Active festival theme updated to ${theme}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const settings = (req.body && req.body.settings && typeof req.body.settings === 'object') ? req.body.settings : req.body;
    if (!settings || typeof settings !== 'object' || Object.keys(settings).length === 0) return res.status(400).json({ error: 'Settings object required' });
    const now = new Date().toISOString();

    const insertOrUpdate = db.prepare(`
      INSERT INTO website_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);

    db.transaction(() => {
      Object.entries(settings).forEach(([key, val]) => {
        insertOrUpdate.run(key, String(val), now);
      });
    })();

    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 18.6 SERVICEABLE DELIVERY ZONES & LOCATION CHECKER
// ==========================================
function evaluateDeliveryZoneMatch(rawQuery) {
  const q = String(rawQuery || '').trim().toLowerCase();
  const allZones = db.prepare('SELECT * FROM delivery_zones ORDER BY serviceable DESC, area_name ASC').all();
  const activeZones = allZones.filter(z => Number(z.serviceable) === 1);

  if (!q) {
    return {
      available: false,
      reason: 'empty',
      zone: null,
      activeZones,
      allZones
    };
  }

  let matchedActive = null;
  let matchedPaused = null;

  for (const z of allZones) {
    const tokens = [
      String(z.area_name || '').toLowerCase(),
      String(z.corridor || '').toLowerCase(),
      String(z.pincode || '').toLowerCase(),
      ...String(z.keywords || '').toLowerCase().split(',').map(k => k.trim()).filter(Boolean)
    ].filter(t => t.length >= 3);

    const isMatch = tokens.some(tok => q.includes(tok) || (q.length >= 3 && tok.includes(q)));
    if (isMatch) {
      if (Number(z.serviceable) === 1 && !matchedActive) {
        matchedActive = z;
      } else if (Number(z.serviceable) !== 1 && !matchedPaused) {
        matchedPaused = z;
      }
    }
  }

  if (matchedActive) {
    return {
      available: true,
      reason: 'matched_active',
      zone: matchedActive,
      activeZones,
      message: `Delivery Available in ${matchedActive.area_name} (Pincode: ${matchedActive.pincode}) • ETA: ${matchedActive.eta}`
    };
  }

  if (matchedPaused) {
    return {
      available: false,
      reason: 'paused_by_admin',
      zone: matchedPaused,
      activeZones,
      message: `Delivery is currently paused/disabled by Admin in ${matchedPaused.area_name}.`
    };
  }

  return {
    available: false,
    reason: 'not_in_admin_zones',
    zone: null,
    activeZones,
    message: `Delivery is not available in "${rawQuery}". Please enter one of our serviceable Sikar areas.`
  };
}

app.get('/api/delivery-zones', (req, res) => {
  try {
    const zones = db.prepare('SELECT * FROM delivery_zones ORDER BY serviceable DESC, area_name ASC').all();
    res.json(zones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/delivery-zones/check', (req, res) => {
  try {
    const q = req.query.q || req.query.address || req.query.area || req.query.query || '';
    const result = evaluateDeliveryZoneMatch(q);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/delivery-zones', (req, res) => {
  try {
    const { id, area_name, areaName, pincode, corridor, keywords, eta, min_order, minOrder, delivery_charge, deliveryCharge, serviceable } = req.body;
    const finalArea = String(area_name || areaName || corridor || '').trim();
    if (!finalArea) return res.status(400).json({ error: 'Area / Location name is required' });

    const finalCorridor = String(corridor || finalArea).trim();
    const finalPincode = String(pincode || '332001').trim();
    const finalKeywords = String(keywords || `${finalArea.toLowerCase()}, ${finalCorridor.toLowerCase()}, ${finalPincode}`).trim();
    const finalEta = String(eta || '45-60 Mins Express Tempo').trim();
    const finalMinOrder = Number(min_order !== undefined ? min_order : (minOrder || 0));
    const finalCharge = Number(delivery_charge !== undefined ? delivery_charge : (deliveryCharge || 0));
    const finalServiceable = (serviceable === undefined || serviceable === null) ? 1 : (serviceable ? 1 : 0);
    const zoneId = id || ('zone-' + finalCorridor.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.floor(100 + Math.random() * 900));
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO delivery_zones (id, area_name, pincode, corridor, keywords, eta, min_order, delivery_charge, serviceable, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        area_name = excluded.area_name,
        pincode = excluded.pincode,
        corridor = excluded.corridor,
        keywords = excluded.keywords,
        eta = excluded.eta,
        min_order = excluded.min_order,
        delivery_charge = excluded.delivery_charge,
        serviceable = excluded.serviceable,
        updated_at = excluded.updated_at
    `).run(zoneId, finalArea, finalPincode, finalCorridor, finalKeywords, finalEta, finalMinOrder, finalCharge, finalServiceable, now);

    const saved = db.prepare('SELECT * FROM delivery_zones WHERE id = ?').get(zoneId);
    res.status(201).json({ success: true, zone: saved });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/delivery-zones/:id', (req, res) => {
  try {
    const zoneId = req.params.id;
    const existing = db.prepare('SELECT * FROM delivery_zones WHERE id = ?').get(zoneId);
    if (!existing) return res.status(404).json({ error: 'Delivery zone not found' });

    const { area_name, areaName, pincode, corridor, keywords, eta, min_order, minOrder, delivery_charge, deliveryCharge, serviceable } = req.body;
    const finalArea = String(area_name || areaName || existing.area_name).trim();
    const finalCorridor = String(corridor || existing.corridor || finalArea).trim();
    const finalPincode = String(pincode || existing.pincode || '332001').trim();
    const finalKeywords = keywords !== undefined ? String(keywords).trim() : existing.keywords;
    const finalEta = String(eta || existing.eta || '45-60 Mins Express Tempo').trim();
    const finalMinOrder = min_order !== undefined ? Number(min_order) : (minOrder !== undefined ? Number(minOrder) : existing.min_order);
    const finalCharge = delivery_charge !== undefined ? Number(delivery_charge) : (deliveryCharge !== undefined ? Number(deliveryCharge) : existing.delivery_charge);
    const finalServiceable = (serviceable === undefined || serviceable === null) ? existing.serviceable : (serviceable ? 1 : 0);
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE delivery_zones
      SET area_name = ?, pincode = ?, corridor = ?, keywords = ?, eta = ?, min_order = ?, delivery_charge = ?, serviceable = ?, updated_at = ?
      WHERE id = ?
    `).run(finalArea, finalPincode, finalCorridor, finalKeywords, finalEta, finalMinOrder, finalCharge, finalServiceable, now, zoneId);

    const updated = db.prepare('SELECT * FROM delivery_zones WHERE id = ?').get(zoneId);
    res.json({ success: true, zone: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/delivery-zones/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM delivery_zones WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 18.8 MEDIA GALLERY & DEVICE PHOTO UPLOAD
// ==========================================
const UPLOADS_DIR = path.join(__dirname, 'assets', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const BUILTIN_MEDIA_LABELS = {
  'prod_bisleri_1l.jpg': 'Bisleri 1L Mineral Bottle',
  'prod_kinley_1l.jpg': 'Kinley 1L Drinking Bottle',
  'prod_aquafina_500ml.jpg': 'Aquafina 500ml Bottle',
  'prod_water_case.jpg': '1L Water Peti Case (12 pcs)',
  'prod_coca_cola.jpg': 'Coca-Cola Party Bottle',
  'prod_fruit_juice.jpg': 'Real & Maaza Fruit Juices',
  'prod_chilled_can.jpg': 'Chilled Cans & Soda Pack',
  'cat_water_bottles.jpg': 'Packaged Water Bottles Trio',
  'cat_water_cases.jpg': 'Wholesale Shrink Water Case',
  'cat_soft_drinks.jpg': 'Coke, Fanta & Sprite Bottles',
  'cat_fruit_juices.jpg': 'Fruit Juice Tetra Pack Combo',
  'cat_chilled_cans.jpg': 'Chilled Soda & Energy Cans',
  'cat_wedding_supply.jpg': 'Wedding & Banquet Crate Stack',
  'hero_bottles.jpg': 'Depot Hero Beverage Lineup',
  'delivery_truck.jpg': 'Sikar Drop Express Tempo'
};

app.get('/api/media', (req, res) => {
  try {
    const assetsDir = path.join(__dirname, 'assets');
    const items = [];

    // 1. Uploaded images first (newest first)
    if (fs.existsSync(UPLOADS_DIR)) {
      const uploadedFiles = fs.readdirSync(UPLOADS_DIR)
        .filter(f => /\.(jpe?g|png|webp|gif|svg)$/i.test(f))
        .map(f => {
          const stat = fs.statSync(path.join(UPLOADS_DIR, f));
          return {
            filename: f,
            url: `assets/uploads/${f}`,
            label: f.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
            source: 'uploaded',
            mtime: stat.mtimeMs
          };
        })
        .sort((a, b) => b.mtime - a.mtime);
      items.push(...uploadedFiles);
    }

    // 2. Built-in depot gallery images
    if (fs.existsSync(assetsDir)) {
      const builtinFiles = fs.readdirSync(assetsDir)
        .filter(f => /\.(jpe?g|png|webp|gif|svg)$/i.test(f))
        .map(f => ({
          filename: f,
          url: `assets/${f}`,
          label: BUILTIN_MEDIA_LABELS[f] || f.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
          source: 'builtin'
        }));
      items.push(...builtinFiles);
    }

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/media/upload', (req, res) => {
  try {
    const { filename, dataUrl } = req.body;
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Valid image dataUrl is required' });
    }

    const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Malformed base64 image data' });
    }

    let ext = matches[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    if (ext === 'svg+xml') ext = 'svg';

    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    const rawBase = (filename || 'gallery_photo')
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 40) || 'photo';

    const finalFilename = `${rawBase}_${Date.now()}.${ext}`;
    const targetPath = path.join(UPLOADS_DIR, finalFilename);

    fs.writeFileSync(targetPath, buffer);

    const relativeUrl = `assets/uploads/${finalFilename}`;
    res.status(201).json({
      success: true,
      filename: finalFilename,
      url: relativeUrl,
      label: rawBase.replace(/[-_]/g, ' ')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 19. STATIC ASSETS & HTML SERVING
// ==========================================
// Multi-page dedicated routes
app.get(['/cart', '/cart.html'], (req, res) => res.sendFile(path.join(__dirname, 'cart.html')));
app.get(['/products', '/products.html'], (req, res) => res.sendFile(path.join(__dirname, 'products.html')));
app.get(['/categories', '/categories.html'], (req, res) => res.sendFile(path.join(__dirname, 'categories.html')));
app.get(['/bulk', '/bulk.html', '/corporate', '/corporate.html'], (req, res) => res.sendFile(path.join(__dirname, 'bulk.html')));
app.get(['/track', '/track.html'], (req, res) => res.sendFile(path.join(__dirname, 'track.html')));
app.get(['/about', '/about.html'], (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get(['/why', '/why.html'], (req, res) => res.sendFile(path.join(__dirname, 'why.html')));
app.get(['/faq', '/faq.html', '/faqs', '/faqs.html'], (req, res) => res.sendFile(path.join(__dirname, 'faq.html')));
app.get(['/contact', '/contact.html'], (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));

// Route aliases (Explicit endpoints take precedence over static directories)
app.get(['/admin', '/admin/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Static assets
app.use(express.static(__dirname));

// 404 Handler for APIs
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start Server
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(` SIKAR DROP ENTERPRISE SERVER RUNNING ON PORT ${PORT}`);
    console.log(` Storefront: http://127.0.0.1:${PORT}`);
    console.log(` Admin Hub:  http://127.0.0.1:${PORT}/admin.html`);
    console.log(` Environment: ${IS_DEV ? 'DEVELOPMENT (Test OTP: 9999 Enabled)' : 'PRODUCTION'}`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
