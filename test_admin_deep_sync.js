const puppeteer = require('puppeteer');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8090';

// Colors for clean output
const PASS = '\x1b[32m[PASS]\x1b[0m';
const FAIL = '\x1b[31m[FAIL]\x1b[0m';
const INFO = '\x1b[36m[INFO]\x1b[0m';

let failedTests = 0;
let passedTests = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`${PASS} ${msg}`);
    passedTests++;
  } else {
    console.error(`${FAIL} ${msg}`);
    failedTests++;
  }
}

async function runAudit() {
  console.log('===============================================================');
  console.log(' SIKAR DROP: COMPREHENSIVE ADMIN-STOREFRONT SYNC DEEP AUDIT');
  console.log(' Zero Emojis • Zero 404s • Zero Console Errors • Full Round-Trip');
  console.log('===============================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Track errors and 404s
  const consoleErrors = [];
  const network404s = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ url: page.url(), text: msg.text() });
    }
  });

  page.on('response', res => {
    if (res.status() === 404) {
      network404s.push(res.url());
    }
  });

  try {
    // -------------------------------------------------------------
    // TEST 1: SITE TEXTS CMS REAL-TIME PROPAGATION
    // -------------------------------------------------------------
    console.log(`${INFO} TEST 1: Site Texts CMS - Word-by-Word Live Verification...`);

    // Fetch current texts
    const origTextsRes = await fetch(`${BASE_URL}/api/site-texts`);
    const origTexts = await origTextsRes.json();

    const uniqueWord = 'MANDI_ROYAL_TEST_' + Date.now().toString().slice(-4);
    const updatedHeroTitle = `Direct Sikar Mandi Delivery\nChilled Beverages & ${uniqueWord}`;
    const updatedHelpline = '+91 98290 99888';
    const updatedAddress = `Hub Alpha, Opposite Market Yard, Sikar ${uniqueWord}`;

    // 1a. Update via Admin API
    const postRes = await fetch(`${BASE_URL}/api/site-texts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...origTexts,
        heroTitle: updatedHeroTitle,
        contactAddress: updatedAddress,
        helpline: updatedHelpline,
        contactPhone: updatedHelpline
      })
    });
    assert(postRes.ok, 'Site Texts updated via Admin API successfully');

    // 1b. Load Home Storefront & verify updated word in DOM
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    const renderedHeroTitle = await page.$eval('#live-hero-main-title', el => el.innerText);
    assert(renderedHeroTitle.includes(uniqueWord), `Home hero title rendered exact CMS word: "${uniqueWord}"`);

    // 1c. Load Contact page & verify updated address and phone in DOM
    await page.goto(`${BASE_URL}/contact`, { waitUntil: 'networkidle2' });
    const renderedContactAddr = await page.$eval('#live-contact-address', el => el.innerText);
    const renderedContactPhone = await page.$eval('#live-contact-phone', el => el.innerText);
    assert(renderedContactAddr.includes(uniqueWord), `Contact page rendered exact updated address: "${uniqueWord}"`);
    assert(renderedContactPhone.includes('99888'), `Contact page rendered exact updated phone: "99888"`);

    // 1d. Restore original texts
    await fetch(`${BASE_URL}/api/site-texts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(origTexts)
    });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    const restoredHeroTitle = await page.$eval('#live-hero-main-title', el => el.innerText);
    assert(!restoredHeroTitle.includes(uniqueWord), 'Site texts cleanly restored to original production values');

    // -------------------------------------------------------------
    // TEST 2: PRODUCT LIFECYCLE (ADD, READ, UPDATE, DELETE)
    // -------------------------------------------------------------
    console.log(`\n${INFO} TEST 2: Product Lifecycle - Add, Edit, and Zero-Resurrection Delete...`);

    const testProdId = 'TEST_BEV_' + Date.now().toString().slice(-4);
    const testProdTitle = 'Special Test Lemon Soda Peti ' + testProdId;
    const testProdPrice = 345;
    const testProdMrp = 420;

    // 2a. Create product in Admin API (using verified existing image)
    const addProdRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: testProdId,
        title: testProdTitle,
        category: 'can',
        price: testProdPrice,
        mrp: testProdMrp,
        pieces: '24 Cans',
        unit: 'Peti',
        rating: 4.8,
        reviews_count: 14,
        image: 'assets/cat_chilled_cans.webp',
        badge: 'Fresh Batch',
        badge_class: 'new',
        active: 1
      })
    });
    assert(addProdRes.ok, `Product created via Admin API with ID: ${testProdId}`);

    // 2b. Verify on Storefront Products page
    await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle2' });
    let productTitles = await page.$$eval('.card-title-text', els => els.map(e => e.innerText));
    assert(productTitles.some(t => t.includes(testProdTitle)), `Product "${testProdTitle}" is immediately live on /products`);

    // 2c. Update Product Title & Price
    const updatedProdTitle = testProdTitle + ' (SUPER CHILLED)';
    const updatedProdPrice = 360;
    const putProdRes = await fetch(`${BASE_URL}/api/products/${testProdId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: testProdId,
        title: updatedProdTitle,
        category: 'can',
        price: updatedProdPrice,
        mrp: testProdMrp,
        pieces: '24 Cans',
        unit: 'Peti',
        image: 'assets/cat_chilled_cans.webp'
      })
    });
    assert(putProdRes.ok, `Product updated via Admin API`);

    // Reload Products page & verify updated title & price
    await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle2' });
    productTitles = await page.$$eval('.card-title-text', els => els.map(e => e.innerText));
    assert(productTitles.some(t => t.includes('(SUPER CHILLED)')), `Updated product title "(SUPER CHILLED)" rendered live`);

    // 2d. Delete Product and verify Zero Resurrection
    const delProdRes = await fetch(`${BASE_URL}/api/products/${testProdId}`, {
      method: 'DELETE'
    });
    assert(delProdRes.ok, `Product deleted via Admin API`);

    // Reload Products page
    await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle2' });
    productTitles = await page.$$eval('.card-title-text', els => els.map(e => e.innerText));
    assert(!productTitles.some(t => t.includes(testProdId)), `Deleted product is completely absent from /products (Zero Resurrection confirmed)`);

    // -------------------------------------------------------------
    // TEST 3: CATEGORY LIFECYCLE (ADD & VERIFY ON STOREFRONT)
    // -------------------------------------------------------------
    console.log(`\n${INFO} TEST 3: Category Lifecycle - Creation, Storefront Render, and Clean Removal...`);

    const testCatId = 'cat_energy_' + Date.now().toString().slice(-4);
    const testCatName = 'Energy Cans Mandi Special';

    const addCatRes = await fetch(`${BASE_URL}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: testCatId,
        name: testCatName,
        tagline: 'Fast Delivery in Sikar',
        image: 'assets/cat_chilled_cans.webp',
        display_order: 99
      })
    });
    assert(addCatRes.ok, `Category created via Admin API with ID: ${testCatId}`);

    // Verify on Categories page
    await page.goto(`${BASE_URL}/categories`, { waitUntil: 'networkidle2' });
    const renderedCatNames = await page.$$eval('#categories-cards-grid h2', els => els.map(e => e.innerText));
    assert(renderedCatNames.some(n => n.includes(testCatName)), `Category "${testCatName}" renders on /categories`);

    // Delete test category
    const delCatRes = await fetch(`${BASE_URL}/api/categories/${testCatId}?reassignTo=water`, {
      method: 'DELETE'
    });
    assert(delCatRes.ok, `Category deleted cleanly`);

    // -------------------------------------------------------------
    // TEST 4: BULK RATES DYNAMIC CALCULATION ON STOREFRONT
    // -------------------------------------------------------------
    console.log(`\n${INFO} TEST 4: Bulk Mandi Rates - Admin Update & Storefront Dynamic Calculator...`);

    const origRatesRes = await fetch(`${BASE_URL}/api/bulk-rates`);
    const origRates = await origRatesRes.json();

    // Set custom rate for 250ml water peti (e.g. 350)
    await fetch(`${BASE_URL}/api/bulk-rates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...origRates,
        w250: 350,
        cold: 450
      })
    });

    await page.goto(`${BASE_URL}/bulk`, { waitUntil: 'networkidle2' });
    
    // Check calculated total for 500 guests
    const calcTotal = await page.$eval('#calc-total-output', el => el.innerText);
    assert(calcTotal.includes('₹') && calcTotal !== '₹0', `Bulk calculator dynamically computed quote: ${calcTotal}`);

    // Restore original bulk rates
    await fetch(`${BASE_URL}/api/bulk-rates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(origRates)
    });

    // -------------------------------------------------------------
    // TEST 5: DELIVERY ZONE CHECKER ON STOREFRONT
    // -------------------------------------------------------------
    console.log(`\n${INFO} TEST 5: Delivery Zones - Corridor Lookup Verification...`);

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    
    // Type Piprali in the delivery checker input
    await page.type('#site-delivery-check-input', 'Piprali');
    await page.click('#site-delivery-check-btn');
    await new Promise(r => setTimeout(r, 600));

    const checkResultText = await page.$eval('#site-delivery-check-result', el => el.innerText);
    assert(
      checkResultText.toLowerCase().includes('serviceable') || checkResultText.toLowerCase().includes('delivery available'),
      `Delivery checker returned active corridor result: "${checkResultText.slice(0, 60)}..."`
    );

    // -------------------------------------------------------------
    // TEST 6: CART & PROMO COUPON ENGINE
    // -------------------------------------------------------------
    console.log(`\n${INFO} TEST 6: Cart & Coupon Engine - DIWALI10 Live Validation...`);

    // Validate coupon directly via GET and POST
    const couponGet = await fetch(`${BASE_URL}/api/coupons/validate?code=DIWALI10&subtotal=1500`);
    const couponGetData = await couponGet.json();
    assert(couponGetData.valid === true, `GET /api/coupons/validate returns valid:true with discount ₹${couponGetData.discount}`);

    const couponPost = await fetch(`${BASE_URL}/api/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'DIWALI10', orderTotal: 2000 })
    });
    const couponPostData = await couponPost.json();
    assert(couponPostData.valid === true, `POST /api/coupons/validate returns valid:true with discount ₹${couponPostData.discount}`);

    // Test coupon on cart page with order subtotal >= min_order (10 boxes @ ₹195 = ₹1950)
    await page.goto(`${BASE_URL}/cart`, { waitUntil: 'networkidle2' });
    
    await page.evaluate(() => {
      localStorage.setItem('sikar_cart', JSON.stringify({ p1: 10 }));
    });
    await page.reload({ waitUntil: 'networkidle2' });

    // Apply coupon using page input
    await page.type('#page-coupon-input', 'DIWALI10');
    const applyBtn = await page.$('button[onclick="applyPageCoupon()"]');
    if (applyBtn) await applyBtn.click();
    await new Promise(r => setTimeout(r, 800));

    const couponFeedback = await page.$eval('#page-coupon-status', el => el.innerText).catch(() => '');
    assert(
      couponFeedback.toLowerCase().includes('applied') || couponFeedback.toLowerCase().includes('discount') || couponFeedback.toLowerCase().includes('wholesale'),
      `Cart page applied coupon successfully: "${couponFeedback}"`
    );

    // Clean up cart
    await page.evaluate(() => localStorage.removeItem('sikar_cart'));

    // -------------------------------------------------------------
    // TEST 7: ORDER STATUS TRACKING (Bilty & Dispatch Live Updates)
    // -------------------------------------------------------------
    console.log(`\n${INFO} TEST 7: Order Bilty Tracking - Status Sync Verification...`);

    // Update SKR-8421 to in_transit
    await fetch(`${BASE_URL}/api/orders/SKR-8421/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_transit' })
    });

    await page.goto(`${BASE_URL}/track?order=SKR-8421`, { waitUntil: 'networkidle2' });
    const trackingBadge = await page.$eval('#track-order-status-badge', el => el.innerText).catch(() => '');
    assert(
      trackingBadge.toLowerCase().includes('transit') || trackingBadge.toLowerCase().includes('in_transit'),
      `Track page loaded order SKR-8421 with live status badge: "${trackingBadge}"`
    );

    // -------------------------------------------------------------
    // TEST 8: ZERO EMOJI POLICY AUDIT
    // -------------------------------------------------------------
    console.log(`\n${INFO} TEST 8: Strict Zero-Emoji Policy Verification...`);

    const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}\u{1FA00}-\u{1FAFF}]/u;

    const pagesToCheck = ['/', '/products', '/categories', '/bulk', '/cart', '/track', '/about', '/contact'];
    let emojiFound = false;

    for (const p of pagesToCheck) {
      await page.goto(`${BASE_URL}${p}`, { waitUntil: 'networkidle2' });
      const text = await page.evaluate(() => document.body.innerText);
      if (emojiRegex.test(text)) {
        console.warn(`[WARN] Emoji detected in text on page ${p}`);
        emojiFound = true;
      }
    }
    assert(!emojiFound, 'Zero Emojis detected across all main storefront pages');

    // -------------------------------------------------------------
    // TEST 9: CONSOLE ERRORS & 404 AUDIT
    // -------------------------------------------------------------
    console.log(`\n${INFO} TEST 9: Console Errors & 404 Network Audit...`);

    // Benign logs filtering
    const fatalErrors = consoleErrors.filter(e => !e.text.includes('favicon') && !e.text.includes('chrome-error'));
    const fatal404s = network404s.filter(u => !u.includes('favicon.ico'));

    assert(fatalErrors.length === 0, `Storefront executed with 0 fatal console errors (Errors: ${fatalErrors.length})`);
    assert(fatal404s.length === 0, `Storefront loaded with 0 broken 404 assets (404s: ${fatal404s.length})`);

    if (fatalErrors.length > 0) {
      console.log('Console Errors found:', fatalErrors);
    }
    if (fatal404s.length > 0) {
      console.log('404 URLs found:', fatal404s);
    }

  } catch (err) {
    console.error('Fatal audit execution exception:', err);
    failedTests++;
  } finally {
    await browser.close();
  }

  console.log('\n===============================================================');
  console.log(` AUDIT RESULTS SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('===============================================================');

  if (failedTests === 0) {
    console.log('\x1b[32m[SUCCESS] ALL ADMIN-STOREFRONT SYNC TESTS PASSED WITH 100% INTEGRITY!\x1b[0m\n');
    process.exit(0);
  } else {
    console.error('\x1b[31m[ERROR] SOME SYNC TESTS FAILED!\x1b[0m\n');
    process.exit(1);
  }
}

runAudit();
