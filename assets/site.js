// SIKAR DROP — Shared Storefront Client Engine
// Real-time synchronization with SQLite backend, Theme Engine, Cart & Multi-page routing
// Strict Zero Emojis Policy

let cart = JSON.parse(localStorage.getItem('sikar_cart') || '{}');
let appliedCoupon = JSON.parse(sessionStorage.getItem('sikar_applied_coupon') || 'null');
let wishlist = JSON.parse(localStorage.getItem('sikar_wishlist') || '[]');
let currentUser = JSON.parse(localStorage.getItem('sikar_user') || 'null');
let currentTheme = localStorage.getItem('sikar_theme') || 'default';
let PRODUCTS = [];
let CATEGORIES = [];

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getCategoryDisplayName(catId) {
  const found = (CATEGORIES || []).find(c => c.id === catId);
  if (found && found.name) return found.name;
  const map = {
    water: 'Drinking Water Bottles',
    cases: 'Packaged Water (Cases)',
    cola: 'Soft Drinks & Beverages',
    juice: 'Fruit Juices & Tetra',
    can: 'Chilled Cans & Soda',
    wedding: 'Wedding & Event Supply'
  };
  return map[catId] || String(catId || 'Beverages').toUpperCase();
}

function showToast(msg) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'app-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

// 1. LIVE FESTIVAL THEME ENGINE
async function initStorefrontTheme() {
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data = await res.json();
      if (data) {
        applyActiveFestivalTheme(data);
        return;
      }
    }
  } catch (err) {
    console.warn('Failed to load active theme:', err);
  }
  applyActiveFestivalTheme({ active_theme: currentTheme });
}

function hexToRgbValues(hex) {
  let c = (hex || '#D97706').replace('#', '').trim();
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return { r: 217, g: 119, b: 6 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function applyFestiveBackgroundAndColorMix(themeName, accentColor, settings) {
  let styleEl = document.getElementById('festive-theme-dynamic-styles');
  let ambientEl = document.getElementById('festive-ambient-layer');

  if (!themeName || themeName === 'normal' || themeName === 'default') {
    if (styleEl) styleEl.remove();
    if (ambientEl) ambientEl.remove();
    return;
  }

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'festive-theme-dynamic-styles';
    document.head.appendChild(styleEl);
  }

  const { r, g, b } = hexToRgbValues(accentColor);

  let pageBgGradient = `linear-gradient(180deg, rgba(${r}, ${g}, ${b}, 0.16) 0%, rgba(${r}, ${g}, ${b}, 0.08) 40%, rgba(${r}, ${g}, ${b}, 0.14) 80%, rgba(${r}, ${g}, ${b}, 0.06) 100%)`;
  let heroBgGradient = `radial-gradient(ellipse at 75% 20%, rgba(${r}, ${g}, ${b}, 0.34) 0%, rgba(${r}, ${g}, ${b}, 0.16) 50%, rgba(${r}, ${g}, ${b}, 0.06) 90%)`;
  let cardBg = `linear-gradient(145deg, #FFFFFF 0%, rgba(${r}, ${g}, ${b}, 0.07) 100%)`;
  let sectionAltBg = `rgba(${r}, ${g}, ${b}, 0.10)`;
  let navBg = `linear-gradient(90deg, rgba(255, 255, 255, 0.94) 0%, rgba(${r}, ${g}, ${b}, 0.14) 50%, rgba(255, 255, 255, 0.94) 100%)`;

  if (themeName === 'diwali') {
    pageBgGradient = `linear-gradient(180deg, #FEF3C7 0%, #FFFBEB 30%, #FFEDD5 65%, #FEF3C7 100%)`;
    heroBgGradient = `radial-gradient(circle at 80% 20%, rgba(245, 158, 11, 0.40) 0%, rgba(217, 119, 6, 0.20) 48%, #FFFBEB 90%)`;
    cardBg = `linear-gradient(145deg, #FFFFFF 0%, #FFFBEB 100%)`;
    sectionAltBg = `rgba(245, 158, 11, 0.13)`;
  } else if (themeName === 'holi') {
    pageBgGradient = `linear-gradient(135deg, #FCE7F3 0%, #F3E8FF 35%, #FEF9C3 70%, #FFE4E6 100%)`;
    heroBgGradient = `radial-gradient(circle at 75% 25%, rgba(225, 29, 72, 0.32) 0%, rgba(124, 58, 237, 0.22) 50%, #FFF1F2 90%)`;
    cardBg = `linear-gradient(145deg, #FFFFFF 0%, #FFF1F2 100%)`;
    sectionAltBg = `rgba(225, 29, 72, 0.10)`;
  } else if (themeName === 'navratri') {
    pageBgGradient = `linear-gradient(180deg, #FEE2E2 0%, #FFF7ED 45%, #FFEDD5 100%)`;
    heroBgGradient = `radial-gradient(circle at 80% 20%, rgba(220, 38, 38, 0.32) 0%, rgba(234, 88, 12, 0.18) 50%, #FEF2F2 90%)`;
    cardBg = `linear-gradient(145deg, #FFFFFF 0%, #FEF2F2 100%)`;
    sectionAltBg = `rgba(220, 38, 38, 0.10)`;
  } else if (themeName === 'newyear') {
    pageBgGradient = `linear-gradient(180deg, #CFFAFE 0%, #F0FDFA 45%, #E0F2FE 100%)`;
    heroBgGradient = `radial-gradient(circle at 80% 20%, rgba(6, 182, 212, 0.34) 0%, rgba(2, 132, 199, 0.18) 50%, #ECFEFF 90%)`;
    cardBg = `linear-gradient(145deg, #FFFFFF 0%, #ECFEFF 100%)`;
    sectionAltBg = `rgba(6, 182, 212, 0.11)`;
  } else if (themeName === 'national') {
    pageBgGradient = `linear-gradient(180deg, #FFEDD5 0%, #FFFFFF 50%, #DCFCE7 100%)`;
    heroBgGradient = `linear-gradient(135deg, rgba(234, 88, 12, 0.28) 0%, rgba(255, 255, 255, 0.92) 50%, rgba(22, 163, 74, 0.26) 100%)`;
    cardBg = `linear-gradient(145deg, #FFFFFF 0%, #FFF7ED 100%)`;
    sectionAltBg = `rgba(234, 88, 12, 0.10)`;
  }

  styleEl.textContent = `
    :root, html[data-theme] {
      --primary: ${accentColor} !important;
      --primary-hover: ${accentColor} !important;
      --primary-soft: rgba(${r}, ${g}, ${b}, 0.16) !important;
      --primary-gradient: linear-gradient(135deg, ${accentColor} 0%, rgba(${r}, ${g}, ${b}, 0.82) 100%) !important;
      --navy-btn: ${accentColor} !important;
      --navy-btn-hover: rgba(${r}, ${g}, ${b}, 0.88) !important;
      --bg-page: transparent !important;
      --bg-subtle: ${sectionAltBg} !important;
      --bg-surface: #FFFFFF !important;
      --bg-hero: ${heroBgGradient} !important;
      --border-subtle: rgba(${r}, ${g}, ${b}, 0.28) !important;
      --border-light: rgba(${r}, ${g}, ${b}, 0.36) !important;
    }

    html[data-theme], html[data-theme] body {
      background: ${pageBgGradient} !important;
      background-attachment: fixed !important;
    }

    html[data-theme] main {
      background: ${pageBgGradient} !important;
    }

    html[data-theme] .site-navbar {
      background: ${navBg} !important;
      border-bottom: 2px solid rgba(${r}, ${g}, ${b}, 0.48) !important;
      box-shadow: 0 4px 20px rgba(${r}, ${g}, ${b}, 0.14) !important;
    }

    html[data-theme] .hero-banner-section,
    html[data-theme] .hero-water-section,
    html[data-theme] .hero-slider-wrapper,
    html[data-theme] .hero-slide {
      background: ${heroBgGradient} !important;
    }

    html[data-theme] section {
      background: transparent !important;
    }

    html[data-theme] .section-categories,
    html[data-theme] .section-soft-drinks,
    html[data-theme] .section-bulk-calc,
    html[data-theme] .section-faq,
    html[data-theme] .trust-footer-strip {
      background: ${sectionAltBg} !important;
      border-top: 1px solid rgba(${r}, ${g}, ${b}, 0.18) !important;
      border-bottom: 1px solid rgba(${r}, ${g}, ${b}, 0.18) !important;
    }

    html[data-theme] .clean-product-card,
    html[data-theme] .cat-card-clean,
    html[data-theme] .portal-card,
    html[data-theme] .cat-pill-card,
    html[data-theme] .soft-cat-card,
    html[data-theme] .review-card-box,
    html[data-theme] .why-feature-card {
      background: ${cardBg} !important;
      border: 1.5px solid rgba(${r}, ${g}, ${b}, 0.28) !important;
      box-shadow: 0 6px 18px rgba(${r}, ${g}, ${b}, 0.08) !important;
    }

    html[data-theme] .clean-product-card:hover,
    html[data-theme] .cat-card-clean:hover,
    html[data-theme] .portal-card:hover,
    html[data-theme] .cat-pill-card:hover {
      border-color: ${accentColor} !important;
      box-shadow: 0 10px 26px rgba(${r}, ${g}, ${b}, 0.22) !important;
    }

    html[data-theme] .chip-filter-btn.active,
    html[data-theme] .cat-top-badge,
    html[data-theme] .btn-add-initial,
    html[data-theme] .btn-add-navy,
    html[data-theme] .btn-hero-shop,
    html[data-theme] .btn-get-quote,
    html[data-theme] .btn-portal-primary,
    html[data-theme] .btn-hero-primary,
    html[data-theme] .nav-cart-btn,
    html[data-theme] .btn-nav-cart,
    html[data-theme] .cart-badge-counter {
      background: ${accentColor} !important;
      border-color: ${accentColor} !important;
      color: #FFFFFF !important;
      box-shadow: 0 4px 14px rgba(${r}, ${g}, ${b}, 0.34) !important;
    }

    html[data-theme] .btn-hero-bulk,
    html[data-theme] .nav-item-link.active,
    html[data-theme] .feature-icon-circle,
    html[data-theme] .trust-pillar-icon,
    html[data-theme] .bulk-building-icon,
    html[data-theme] .cat-section-top-pill,
    html[data-theme] .cat-card-top-header,
    html[data-theme] .card-top-cat-pill {
      background: rgba(${r}, ${g}, ${b}, 0.14) !important;
      color: ${accentColor} !important;
      border-color: rgba(${r}, ${g}, ${b}, 0.35) !important;
    }

    html[data-theme] .cat-filter-label-bar {
      color: ${accentColor} !important;
    }

    html[data-theme] .banner-light-bulk {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.92) 0%, rgba(${r}, ${g}, ${b}, 0.16) 100%) !important;
      border-color: rgba(${r}, ${g}, ${b}, 0.36) !important;
    }

    html[data-theme] .card-price-main,
    html[data-theme] .brand-highlight,
    html[data-theme] .hero-main-title span.blue-highlight,
    html[data-theme] .brand-icon-drop,
    html[data-theme] .brand-title span.accent-blue,
    html[data-theme] .cat-arrow-link,
    html[data-theme] .view-all-link,
    html[data-theme] .hero-trust-pill,
    html[data-theme] .hero-trust-pill svg,
    html[data-theme] .nav-item-link:hover {
      color: ${accentColor} !important;
    }

    html[data-theme] .hero-trust-pill {
      border-color: rgba(${r}, ${g}, ${b}, 0.38) !important;
      background: rgba(255, 255, 255, 0.94) !important;
    }

    html[data-theme] .floating-quality-tag {
      background: linear-gradient(135deg, ${accentColor} 0%, rgba(15, 23, 42, 0.92) 100%) !important;
    }

    @keyframes festiveFloatUp {
      0% { transform: translateY(105vh) rotate(0deg); opacity: 0; }
      15% { opacity: 0.45; }
      85% { opacity: 0.45; }
      100% { transform: translateY(-10vh) rotate(360deg); opacity: 0; }
    }
  `;

  const ambientOn = typeof settings === 'object' ? (settings.ambient_effects_enabled === '1' || settings.ambient_effects_enabled === undefined) : true;
  if (ambientOn) {
    if (!ambientEl) {
      ambientEl = document.createElement('div');
      ambientEl.id = 'festive-ambient-layer';
      ambientEl.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; pointer-events:none; z-index:5; overflow:hidden;';
      document.body.appendChild(ambientEl);
    }
    let shapesHtml = '';
    for (let i = 0; i < 14; i++) {
      const left = Math.round((i / 14) * 96 + (Math.random() * 4));
      const size = 12 + (i % 4) * 6;
      const dur = 11 + (i % 6) * 3;
      const delay = (i * 1.1).toFixed(1);
      shapesHtml += `
        <div style="position:absolute; left:${left}%; bottom:-40px; width:${size}px; height:${size}px; color:${accentColor}; animation:festiveFloatUp ${dur}s linear ${delay}s infinite; opacity:0;">
          <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
            <polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9"/>
          </svg>
        </div>
      `;
    }
    ambientEl.innerHTML = shapesHtml;
  } else if (ambientEl) {
    ambientEl.remove();
  }
}

function applyActiveFestivalTheme(settings) {
  const themeName = (typeof settings === 'string' ? settings : (settings.active_theme || 'normal')).toLowerCase();
  currentTheme = themeName;
  localStorage.setItem('sikar_theme', themeName);

  let ribbon = document.getElementById('store-festival-ribbon');

  const presetColors = {
    diwali: '#D97706',
    holi: '#E11D48',
    navratri: '#DC2626',
    newyear: '#06B6D4',
    national: '#EA580C',
    custom: '#7C3AED'
  };
  const accentColor = (typeof settings === 'object' && settings.theme_accent_color)
    ? settings.theme_accent_color
    : (presetColors[themeName] || '#D97706');

  if (themeName === 'normal' || themeName === 'default') {
    document.documentElement.removeAttribute('data-theme');
    applyFestiveBackgroundAndColorMix('normal', '#0284C7', settings);
    if (ribbon) ribbon.style.display = 'none';
    const fw = document.getElementById('festive-floating-widget');
    if (fw) fw.remove();
    return;
  }

  document.documentElement.setAttribute('data-theme', themeName);
  applyFestiveBackgroundAndColorMix(themeName, accentColor, settings);

  if (!ribbon) {
    ribbon = document.createElement('aside');
    ribbon.id = 'store-festival-ribbon';
    ribbon.className = 'store-festival-ribbon';
    const navbar = document.querySelector('.site-navbar');
    if (navbar && navbar.parentNode) {
      navbar.parentNode.insertBefore(ribbon, navbar);
    }
  }

  const badgeText = (typeof settings === 'object' && settings.top_ribbon_badge) ? settings.top_ribbon_badge : 'FESTIVAL SPECIAL';
  const msgText = (typeof settings === 'object' && settings.banner_message) ? settings.banner_message : 'Wholesale packaged water & beverage cases delivered in Sikar.';
  const isCountdown = typeof settings === 'object' && settings.countdown_timer_enabled === '1';

  ribbon.style.display = 'block';
  ribbon.style.background = `linear-gradient(90deg, #0B192C 0%, ${accentColor} 50%, #0B192C 100%)`;
  ribbon.style.color = '#FFFFFF';
  ribbon.style.padding = '8px 14px';
  ribbon.style.fontSize = '0.82rem';
  ribbon.style.fontWeight = '700';
  ribbon.style.textAlign = 'center';

  ribbon.innerHTML = `
    <div class="container" style="display:flex; align-items:center; justify-content:center; gap:10px; flex-wrap:wrap;">
      <span style="background:rgba(255,255,255,0.22); padding:2px 10px; border-radius:4px; font-size:0.72rem; letter-spacing:0.05em; text-transform:uppercase; font-weight:800;">${escapeHTML(badgeText)}</span>
      <span>${escapeHTML(msgText)}</span>
      ${isCountdown ? `<span id="ribbon-countdown-badge" style="background:#0F172A; color:#FDE047; padding:2px 8px; border-radius:4px; font-family:monospace; font-size:0.75rem;">Ends In: 02d 08h 45m</span>` : ''}
    </div>
  `;

  // 1. Welcome Greeting Modal if enabled
  if (typeof settings === 'object' && settings.welcome_modal_enabled === '1') {
    initFestiveWelcomeModal(settings);
  }

  // 2. Floating Gift / Diya Widget if enabled
  if (typeof settings === 'object' && settings.floating_widget_enabled === '1') {
    initFestiveFloatingWidget(settings);
  }

  // 3. Sparkler Trail if enabled
  if (typeof settings === 'object' && settings.sparkler_trail_enabled === '1') {
    initSparklerTrail(accentColor);
  }
}

function initFestiveWelcomeModal(settings) {
  if (sessionStorage.getItem('sikar_greeting_shown')) return;
  sessionStorage.setItem('sikar_greeting_shown', 'true');

  const title = settings.welcome_greeting_title || 'Welcome to Sikar Drop';
  const sub = settings.welcome_greeting_subtitle || 'Rajasthan\'s premier wholesale beverage depot.';
  const code = settings.promo_coupon_code || 'DIWALI2026';
  const pct = settings.discount_percentage || '15';
  const color = settings.theme_accent_color || '#B45309';

  const modal = document.createElement('div');
  modal.id = 'festive-welcome-modal';
  modal.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.7); backdrop-filter:blur(4px); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px; animation:fadeInModal 0.25s ease-out;';

  modal.innerHTML = `
    <div style="background:#FFFFFF; border-radius:16px; padding:32px 28px; max-width:440px; width:100%; text-align:center; position:relative; box-shadow:0 20px 40px rgba(0,0,0,0.3); border:2px solid ${color};">
      <button type="button" onclick="document.getElementById('festive-welcome-modal').remove()" style="position:absolute; top:12px; right:12px; background:none; border:none; color:#64748B; cursor:pointer;" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div style="width:48px; height:48px; border-radius:50%; background:${color}22; color:${color}; margin:0 auto 14px; display:flex; align-items:center; justify-content:center;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="24" height="24"><polyline points="20 12 20 22 4 22 4 12"/><rect width="20" height="5" x="2" y="7"/><line x1="12" x2="12" y1="22" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
      </div>
      <h3 style="font-family:var(--font-heading); font-size:1.35rem; color:#0B192C; margin-bottom:6px;">${escapeHTML(title)}</h3>
      <p style="font-size:0.86rem; color:#64748B; line-height:1.5; margin-bottom:18px;">${escapeHTML(sub)}</p>
      
      <div style="background:#F8FAFC; border:1.5px dashed ${color}; border-radius:10px; padding:14px; margin-bottom:20px;">
        <div style="font-size:0.75rem; font-weight:800; color:#64748B; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">Festive Promo Voucher</div>
        <div style="font-size:1.3rem; font-weight:900; color:${color}; font-family:monospace; letter-spacing:0.08em;">${escapeHTML(code)}</div>
        <div style="font-size:0.8rem; color:#16A34A; font-weight:700; margin-top:2px;">Flat ${pct}% Discount on Bulk Petis</div>
      </div>

      <button type="button" class="btn-checkout-gate" onclick="navigator.clipboard && navigator.clipboard.writeText('${escapeHTML(code)}'); showToast('Coupon ${escapeHTML(code)} Copied!'); document.getElementById('festive-welcome-modal').remove();" style="width:100%; background:${color};">
        <span>COPY COUPON &amp; SHOP NOW</span>
      </button>
    </div>
  `;

  document.body.appendChild(modal);
}

function initFestiveFloatingWidget(settings) {
  if (document.getElementById('festive-floating-widget')) return;
  const color = settings.theme_accent_color || '#B45309';
  const code = settings.promo_coupon_code || 'DIWALI2026';

  const w = document.createElement('div');
  w.id = 'festive-floating-widget';
  w.style.cssText = `position:fixed; bottom:76px; right:18px; z-index:9998; width:48px; height:48px; border-radius:50%; background:${color}; color:#FFFFFF; display:flex; align-items:center; justify-content:center; box-shadow:0 6px 18px rgba(0,0,0,0.25); cursor:pointer; transition:transform 0.2s;`;
  w.title = `Click to reveal festive discount (${code})`;

  w.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="22" height="22"><polyline points="20 12 20 22 4 22 4 12"/><rect width="20" height="5" x="2" y="7"/><line x1="12" x2="12" y1="22" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`;
  
  w.onclick = () => {
    showToast(`Festive Coupon: ${code} (Applied to Cart!)`);
    sessionStorage.setItem('sikar_applied_coupon', JSON.stringify({ code, pct: parseInt(settings.discount_percentage, 10) || 10 }));
    updateCartUI();
  };

  document.body.appendChild(w);
}

function initSparklerTrail(accentColor) {
  if (window._sparklerAttached) return;
  window._sparklerAttached = true;

  const canvas = document.createElement('canvas');
  canvas.id = 'sparkler-canvas';
  canvas.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; pointer-events:none; z-index:99998;';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let particles = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('mousemove', e => {
    for (let i = 0; i < 2; i++) {
      particles.push({
        x: e.clientX,
        y: e.clientY,
        vx: (Math.random() - 0.5) * 2.5,
        vy: (Math.random() - 0.5) * 2.5 - 0.5,
        size: Math.random() * 3 + 1.5,
        alpha: 1,
        color: accentColor
      });
    }
  });

  function anim() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.035;
      if (p.alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    requestAnimationFrame(anim);
  }
  requestAnimationFrame(anim);
}

// 2. LIVE PRODUCTS & CATEGORIES SYNC
async function loadCatalogFromBackend() {
  try {
    const [pRes, cRes] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/categories')
    ]);

    if (pRes.ok) {
      const pData = await pRes.json();
      if (Array.isArray(pData)) {
        // Merge with locally created custom products so newly added products are NEVER wiped out
        const localProds = JSON.parse(localStorage.getItem('sikar_admin_products') || '[]');
        const customProds = localProds.filter(lp => lp && lp.id && !pData.some(sp => sp.id === lp.id));
        const mergedProds = [...customProds, ...pData];
        mergedProds.sort((a, b) => {
          const ordA = a.display_order !== undefined ? a.display_order : 50;
          const ordB = b.display_order !== undefined ? b.display_order : 50;
          if (ordA !== ordB) return ordA - ordB;
          return (b.created_at || '').localeCompare(a.created_at || '');
        });
        PRODUCTS = mergedProds;
        localStorage.setItem('sikar_admin_products', JSON.stringify(mergedProds));
      }
    }

    if (cRes.ok) {
      const cData = await cRes.json();
      if (Array.isArray(cData)) {
        // Merge with locally created categories
        const localCats = JSON.parse(localStorage.getItem('sikar_admin_categories') || '[]');
        const customCats = localCats.filter(lc => lc && lc.id && !cData.some(sc => sc.id === lc.id));
        const mergedCats = [...cData, ...customCats];
        CATEGORIES = mergedCats;
        localStorage.setItem('sikar_admin_categories', JSON.stringify(mergedCats));
      }
    }
  } catch (err) {
    console.warn('Backend catalog sync error, fallback to cache:', err);
    PRODUCTS = JSON.parse(localStorage.getItem('sikar_admin_products') || '[]');
    CATEGORIES = JSON.parse(localStorage.getItem('sikar_admin_categories') || '[]');
  }
}

// 3. CART MANAGEMENT & FLYING ANIMATION
function toggleCartDrawer(open) {
  const drawer = document.getElementById('cart-drawer') || document.getElementById('cart-drawer-panel');
  const backdrop = document.getElementById('cart-backdrop');
  if (drawer) {
    drawer.classList.toggle('open', open);
    if (open) {
      drawer.style.right = '0px';
      document.body.style.overflow = 'hidden';
      if (typeof updateCartUI === 'function') updateCartUI();
    } else {
      drawer.style.right = '';
      document.body.style.overflow = '';
    }
  }
  if (backdrop) backdrop.classList.toggle('active', open);
}

function flyProductToCart(sourceElement) {
  if (!sourceElement) return;
  const targetBadge = (window.innerWidth <= 768)
    ? (document.getElementById('dock-cart-badge') || document.getElementById('cart-badge'))
    : document.getElementById('cart-badge');
  if (!targetBadge) return;

  const srcRect = sourceElement.getBoundingClientRect();
  const tgtRect = targetBadge.getBoundingClientRect();

  const flyingEl = document.createElement('div');
  flyingEl.className = 'flying-cart-item';
  flyingEl.style.left = `${srcRect.left + srcRect.width / 2}px`;
  flyingEl.style.top = `${srcRect.top + srcRect.height / 2}px`;
  document.body.appendChild(flyingEl);

  requestAnimationFrame(() => {
    flyingEl.style.transform = `translate(${tgtRect.left - srcRect.left}px, ${tgtRect.top - srcRect.top}px) scale(0.2)`;
    flyingEl.style.opacity = '0';
  });

  setTimeout(() => {
    flyingEl.remove();
    targetBadge.classList.add('pulse');
    setTimeout(() => targetBadge.classList.remove('pulse'), 300);
  }, 750);
}

function updateCart(id, delta, event) {
  const cur = cart[id] || 0;
  const next = cur + delta;

  if (delta > 0) {
    const srcEl = (event && event.currentTarget) ? event.currentTarget : document.getElementById(`prod-img-${id}`);
    flyProductToCart(srcEl);
  }

  if (next <= 0) {
    delete cart[id];
    showToast('Item removed from cart');
  } else {
    cart[id] = next;
    showToast(delta > 0 ? 'Added to cart' : 'Quantity updated');
  }

  localStorage.setItem('sikar_cart', JSON.stringify(cart));
  updateCartUI();
  if (typeof renderProducts === 'function') renderProducts();
  if (typeof renderProductsPageGrid === 'function') renderProductsPageGrid();
}

function saveCart() {
  localStorage.setItem('sikar_cart', JSON.stringify(cart));
}

function updateCartUI() {
  let count = 0;
  let subtotal = 0;
  const list = document.getElementById('cart-drawer-items-list');
  let html = '';

  for (const [id, qty] of Object.entries(cart)) {
    const prod = PRODUCTS.find(p => p.id === id);
    if (prod && qty > 0) {
      count += qty;
      const lineTotal = prod.price * qty;
      subtotal += lineTotal;
      html += `
        <div class="cart-line-row">
          <img src="${prod.image}" alt="${prod.title}" class="cart-line-thumb">
          <div class="cart-line-info">
            <h4>${escapeHTML(prod.title)}</h4>
            <div class="price-tag tabular">₹${prod.price} x ${qty} = <strong>₹${lineTotal}</strong></div>
          </div>
          <div class="card-stepper-control tabular" style="background:#FFFFFF;">
            <button type="button" class="stepper-btn-pill" onclick="updateCart('${prod.id}', -1, event)">-</button>
            <span class="stepper-qty-num" style="padding:0 6px;">${qty}</span>
            <button type="button" class="stepper-btn-pill" onclick="updateCart('${prod.id}', 1, event)">+</button>
          </div>
        </div>
      `;
    }
  }

  if (list) {
    list.innerHTML = html || '<div style="padding:40px 20px; text-align:center; color:var(--text-light);">Your cart is empty.<br>Browse categories and add chilled petis!</div>';
  }

  let discountAmt = 0;
  if (appliedCoupon && subtotal >= (appliedCoupon.minOrder || 0)) {
    const pctDiscount = Math.round((subtotal * appliedCoupon.pct) / 100);
    discountAmt = Math.min(pctDiscount, appliedCoupon.maxDiscount || 500);
    const discRow = document.getElementById('cart-coupon-discount-row');
    if (discRow) {
      discRow.style.display = 'flex';
      document.getElementById('cart-drawer-discount').textContent = `-₹${discountAmt.toLocaleString('en-IN')}`;
    }
  } else {
    const discRow = document.getElementById('cart-coupon-discount-row');
    if (discRow) discRow.style.display = 'none';
  }

  const finalTotal = Math.max(0, subtotal - discountAmt);

  const badge = document.getElementById('cart-badge');
  const dockBadge = document.getElementById('dock-cart-badge');
  if (badge) badge.textContent = count;
  if (dockBadge) dockBadge.textContent = count;

  const totalCount = document.getElementById('drawer-total-count');
  if (totalCount) totalCount.textContent = count;

  const subtotalDisp = document.getElementById('cart-drawer-subtotal');
  if (subtotalDisp) subtotalDisp.textContent = `₹${finalTotal.toLocaleString('en-IN')}`;
}

async function applyCouponCode() {
  const input = document.getElementById('cart-coupon-input');
  if (!input) return;
  const code = input.value.trim().toUpperCase();
  if (!code) {
    showToast('Please enter coupon code');
    return;
  }

  try {
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, orderTotal: calculateSubtotal() })
    });
    const data = await res.json();
    if (data.valid) {
      appliedCoupon = { code: data.code, pct: data.discount_val || 10, minOrder: data.min_order || 500, maxDiscount: data.max_discount || 500 };
      sessionStorage.setItem('sikar_applied_coupon', JSON.stringify(appliedCoupon));
      showToast(`Coupon '${code}' applied successfully!`);
      updateCartUI();
    } else {
      showToast(data.error || 'Invalid or expired coupon code');
    }
  } catch (e) {
    showToast('Coupon check failed');
  }
}

function calculateSubtotal() {
  let sub = 0;
  for (const [id, qty] of Object.entries(cart)) {
    const p = PRODUCTS.find(item => item.id === id);
    if (p && qty > 0) sub += p.price * qty;
  }
  return sub;
}

function proceedToCheckout() {
  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  if (totalItems === 0) {
    showToast('Cart is empty. Add water petis first.');
    return;
  }

  // Check login
  if (!currentUser) {
    openLoginModal();
    return;
  }

  openOrderConfirmModal();
}

function openLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.add('active');
}

function closeLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.remove('active');
}

async function submitLoginProcess() {
  const phoneInput = document.getElementById('login-phone-input');
  const otpBlock = document.getElementById('otp-group-block');
  const otpInput = document.getElementById('login-otp-input');
  const btn = document.getElementById('btn-login-action');

  const phone = phoneInput ? phoneInput.value.trim() : '';
  if (!phone || phone.length < 10) {
    showToast('Please enter a valid 10-digit mobile number.');
    return;
  }

  if (otpBlock && otpBlock.style.display === 'none') {
    // Step 1: Send OTP
    try {
      btn.disabled = true;
      btn.querySelector('span').textContent = 'REQUESTING OTP...';
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, channel: 'whatsapp' })
      });
      const data = await res.json();
      if (res.ok) {
        otpBlock.style.display = 'block';
        btn.disabled = false;
        btn.querySelector('span').textContent = 'VERIFY & COMPLETE SIGN IN';
        showToast('OTP sent! (Test OTP: 9999)');
      } else {
        btn.disabled = false;
        btn.querySelector('span').textContent = 'CONTINUE / REQUEST OTP';
        showToast(data.error || 'Failed to send OTP');
      }
    } catch (e) {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'CONTINUE / REQUEST OTP';
      showToast('Error requesting OTP: ' + e.message);
    }
  } else {
    // Step 2: Verify OTP
    const otp = otpInput ? otpInput.value.trim() : '';
    if (!otp) {
      showToast('Please enter the 4-digit OTP.');
      return;
    }

    try {
      btn.disabled = true;
      btn.querySelector('span').textContent = 'VERIFYING...';
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp })
      });
      const data = await res.json();
      if (res.ok && data.verified) {
        currentUser = {
          name: document.getElementById('login-name-input')?.value.trim() || 'Valued Customer',
          phone: phone,
          verified: true
        };
        localStorage.setItem('sikar_user', JSON.stringify(currentUser));
        closeLoginModal();
        showToast('Successfully verified! Continuing checkout...');
        openOrderConfirmModal();
      } else {
        btn.disabled = false;
        btn.querySelector('span').textContent = 'VERIFY & COMPLETE SIGN IN';
        showToast(data.error || 'Invalid OTP code');
      }
    } catch (e) {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'VERIFY & COMPLETE SIGN IN';
      showToast('Error verifying OTP: ' + e.message);
    }
  }
}

let SERVICEABLE_DELIVERY_ZONES = JSON.parse(localStorage.getItem('sikar_delivery_zones')) || [
  { id: 'zone-piprali', area_name: 'Piprali Road (Coaching Hub & Marriage Gardens)', pincode: '332001', corridor: 'Piprali Road', keywords: 'piprali road, piprali, clc, allen, matrix, prince school, gokulpura, surya nagar, nh52, 332001', eta: '45-60 Mins Express Tempo', serviceable: 1 },
  { id: 'zone-nawalgarh', area_name: 'Nawalgarh Road & Pullia Market', pincode: '332001', corridor: 'Nawalgarh Road', keywords: 'nawalgarh road, nawalgarh, pullia, pulia, bajor, vrindavan city, housing board, 332001', eta: '45-60 Mins Express Tempo', serviceable: 1 },
  { id: 'zone-station', area_name: 'Station Road, Subhash Chowk & Krishi Mandi', pincode: '332001', corridor: 'Station Road & Krishi Mandi', keywords: 'station road, krishi mandi, mandi, subhash chowk, jaat bazar, clock tower, kalyan circle, railway station, 332001', eta: '45-60 Mins Direct Tempo', serviceable: 1 },
  { id: 'zone-fatehpur', area_name: 'Fatehpur Road & Sabalpura Corridor', pincode: '332001', corridor: 'Fatehpur Road', keywords: 'fatehpur road, fatehpur, sabalpura, eidgah, radhakishanpura, nh11, 332001', eta: '60-90 Mins Tempo Dispatch', serviceable: 1 },
  { id: 'zone-ranisati', area_name: 'Rani Sati Road, Silver Jubilee & Collectorate', pincode: '332001', corridor: 'Rani Sati & Silver Jubilee Road', keywords: 'rani sati, silver jubilee, collectorate, police line, maru school, dhod road, civil lines, 332001', eta: '60-75 Mins Tempo Dispatch', serviceable: 1 },
  { id: 'zone-salasar', area_name: 'Salasar Stand, Jaipur Road & Industrial Area', pincode: '332001', corridor: 'Jaipur Road & RIICO', keywords: 'salasar road, salasar stand, jaipur road, riico, industrial area, kudli, palwas road, 332001', eta: '60-90 Mins Tempo Dispatch', serviceable: 1 }
];

fetch('/api/delivery-zones').then(r => r.ok ? r.json() : null).then(zones => {
  if (Array.isArray(zones) && zones.length > 0) {
    SERVICEABLE_DELIVERY_ZONES = zones;
    localStorage.setItem('sikar_delivery_zones', JSON.stringify(zones));
  }
}).catch(() => {});

function evaluateFrontendDeliveryMatch(rawQuery) {
  const q = String(rawQuery || '').trim().toLowerCase();
  const allZones = Array.isArray(SERVICEABLE_DELIVERY_ZONES) ? SERVICEABLE_DELIVERY_ZONES : [];
  const activeZones = allZones.filter(z => Number(z.serviceable) === 1);

  if (!q) return { available: false, reason: 'empty', zone: null, activeZones };

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
      if (Number(z.serviceable) === 1 && !matchedActive) matchedActive = z;
      else if (Number(z.serviceable) !== 1 && !matchedPaused) matchedPaused = z;
    }
  }
  if (matchedActive) return { available: true, reason: 'matched_active', zone: matchedActive, activeZones };
  if (matchedPaused) return { available: false, reason: 'paused_by_admin', zone: matchedPaused, activeZones };
  return { available: false, reason: 'not_in_admin_zones', zone: null, activeZones };
}

function selectCheckoutQuickArea(fullAreaName, shortCorridor) {
  const sel = document.getElementById('delivery-corridor-select');
  if (sel) sel.value = fullAreaName;
  const noteInput = document.getElementById('delivery-note-input');
  if (noteInput) {
    const cur = noteInput.value.trim();
    if (!cur) noteInput.value = `${shortCorridor}, Sikar (332001)`;
    else if (!cur.toLowerCase().includes(shortCorridor.toLowerCase())) noteInput.value = `${cur}, ${shortCorridor}`;
  }
  validateCheckoutAddressLocation();
}

function validateCheckoutAddressLocation() {
  const sel = document.getElementById('delivery-corridor-select');
  const noteInput = document.getElementById('delivery-note-input');
  const statusBox = document.getElementById('checkout-location-check-status');
  if (!statusBox) return true;

  const selectedArea = sel ? sel.value : '';
  const typedAddress = noteInput ? noteInput.value.trim() : '';

  if (typedAddress.length > 0) {
    const addrCheck = evaluateFrontendDeliveryMatch(typedAddress);
    if (addrCheck.available && addrCheck.zone) {
      if (sel && sel.value !== addrCheck.zone.area_name) sel.value = addrCheck.zone.area_name;
      statusBox.style.background = '#F0FDF4';
      statusBox.style.border = '1px solid #86EFAC';
      statusBox.style.color = '#166534';
      statusBox.innerHTML = `Verified Admin Location: <strong>${escapeHTML(addrCheck.zone.area_name)}</strong> (${escapeHTML(addrCheck.zone.pincode || '332001')}) — Delivery Available (${escapeHTML(addrCheck.zone.eta || '45-60 Mins')})`;
      return true;
    } else {
      statusBox.style.background = '#FEF2F2';
      statusBox.style.border = '1px solid #FECACA';
      statusBox.style.color = '#991B1B';
      const activeNames = (addrCheck.activeZones || []).map(z => z.corridor || z.area_name).join(', ');
      statusBox.innerHTML = `Delivery Not Available: Your address <strong>"${escapeHTML(typedAddress)}"</strong> does not match any active serviceable location! Please include a valid Sikar area (${escapeHTML(activeNames)}).`;
      return false;
    }
  }

  const selCheck = evaluateFrontendDeliveryMatch(selectedArea);
  if (selCheck.available && selCheck.zone) {
    statusBox.style.background = '#F0F9FF';
    statusBox.style.border = '1px solid #BAE6FD';
    statusBox.style.color = '#0369A1';
    statusBox.innerHTML = `Selected Area: <strong>${escapeHTML(selCheck.zone.area_name)}</strong> — Please enter your complete address and area above.`;
    return true;
  }

  statusBox.style.background = '#FEF2F2';
  statusBox.style.border = '1px solid #FECACA';
  statusBox.style.color = '#991B1B';
  statusBox.innerHTML = `Delivery Not Available in this area. Please choose an Admin-approved Sikar location.`;
  return false;
}

function openOrderConfirmModal() {
  const modal = document.getElementById('order-confirm-modal');
  if (!modal) return;

  const totalPetis = Object.values(cart).reduce((a, b) => a + b, 0);
  const totalAmount = calculateSubtotal();

  const elName = document.getElementById('confirm-customer-name');
  const elPhone = document.getElementById('confirm-customer-phone');
  const elPetis = document.getElementById('confirm-total-petis');
  const elAmt = document.getElementById('confirm-total-amount');
  const delivPhoneInput = document.getElementById('delivery-phone-input');

  const loginPhoneVal = (currentUser && currentUser.phone) ? String(currentUser.phone).trim() : '';

  if (elName) elName.textContent = currentUser ? currentUser.name : 'Counter Guest';
  if (elPhone) elPhone.textContent = loginPhoneVal ? `+91 ${loginPhoneVal}` : '+91 98290 XXXXX';
  if (elPetis) elPetis.textContent = `${totalPetis} Petis / Cases`;
  if (elAmt) elAmt.textContent = `₹${totalAmount.toLocaleString('en-IN')}`;
  if (delivPhoneInput) {
    delivPhoneInput.value = loginPhoneVal.replace(/\D/g, '').slice(-10);
  }

  const sel = document.getElementById('delivery-corridor-select');
  const activeZones = (SERVICEABLE_DELIVERY_ZONES || []).filter(z => Number(z.serviceable) === 1);
  if (sel && activeZones.length > 0) {
    sel.innerHTML = activeZones.map(z => `<option value="${escapeHTML(z.area_name)}">${escapeHTML(z.area_name)} (${escapeHTML(z.pincode || '332001')})</option>`).join('');
    sel.onchange = validateCheckoutAddressLocation;
  }

  const noteInput = document.getElementById('delivery-note-input');
  if (noteInput) {
    noteInput.oninput = validateCheckoutAddressLocation;
    if (!document.getElementById('checkout-location-check-status')) {
      const wrap = noteInput.parentElement;
      if (wrap) {
        const tagsDiv = document.createElement('div');
        tagsDiv.id = 'checkout-area-quick-tags';
        tagsDiv.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;';
        tagsDiv.innerHTML = activeZones.map(z => `<button type="button" onclick="selectCheckoutQuickArea('${escapeHTML(z.area_name)}', '${escapeHTML(z.corridor || z.area_name)}')" style="background:#F0F9FF;border:1px solid #BAE6FD;color:#0284C7;border-radius:999px;padding:2px 8px;font-size:0.72rem;font-weight:700;cursor:pointer;">+ ${escapeHTML(z.corridor || z.area_name)}</button>`).join('');
        wrap.appendChild(tagsDiv);

        const statusDiv = document.createElement('div');
        statusDiv.id = 'checkout-location-check-status';
        statusDiv.style.cssText = 'margin-top:8px;padding:9px 12px;border-radius:6px;font-size:0.79rem;font-weight:700;';
        wrap.appendChild(statusDiv);
      }
    }
  }
  validateCheckoutAddressLocation();

  modal.classList.add('active');
}

function closeOrderConfirmModal() {
  const modal = document.getElementById('order-confirm-modal');
  if (modal) modal.classList.remove('active');
}

async function dispatchFinalWhatsAppOrder() {
  const corridor = document.getElementById('delivery-corridor-select')?.value || 'Piprali Road';
  const addressNote = document.getElementById('delivery-note-input')?.value.trim() || '';

  if (addressNote.length > 0 && !validateCheckoutAddressLocation()) {
    showToast('Delivery Not Available: This address is not within our serviceable Sikar delivery areas!');
    return;
  }
  const areaCheck = evaluateFrontendDeliveryMatch(addressNote || corridor);
  if (!areaCheck.available) {
    showToast('Delivery Not Available: The selected area is not in our serviceable delivery locations!');
    return;
  }

  const loginPhoneVal = (currentUser && currentUser.phone) ? String(currentUser.phone).trim() : '9829012345';
  const delivPhoneInput = document.getElementById('delivery-phone-input');
  const deliveryPhoneVal = (delivPhoneInput && delivPhoneInput.value.trim()) ? delivPhoneInput.value.trim() : loginPhoneVal;

  const items = [];
  for (const [id, qty] of Object.entries(cart)) {
    const prod = PRODUCTS.find(p => p.id === id);
    if (prod && qty > 0) {
      items.push({ productId: prod.id, title: prod.title, quantity: qty, price: prod.price });
    }
  }

  if (items.length === 0) {
    showToast('Cart is empty');
    return;
  }

  const orderId = 'SKR-' + Math.floor(1000 + Math.random() * 9000);

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        customerName: currentUser ? currentUser.name : 'Direct Customer',
        customerPhone: loginPhoneVal,
        loginPhone: loginPhoneVal,
        deliveryPhone: deliveryPhoneVal,
        corridor,
        deliveryAddress: addressNote || corridor,
        items,
        notes: addressNote
      })
    });

    if (res.ok) {
      // Clear Cart
      cart = {};
      localStorage.removeItem('sikar_cart');
      updateCartUI();
      closeOrderConfirmModal();
      toggleCartDrawer(false);

      // Open WhatsApp Dispatch
      const depotPhone = '919829000000';
      const itemsList = items.map(i => `• ${i.title} x ${i.quantity} = Rs.${i.price * i.quantity}`).join('\n');
      const total = items.reduce((a, b) => a + (b.price * b.quantity), 0);
      const normL = loginPhoneVal.replace(/\D/g, '').slice(-10);
      const normD = deliveryPhoneVal.replace(/\D/g, '').slice(-10);
      const phoneLines = (normL && normD && normL !== normD)
        ? `Login Phone: ${loginPhoneVal}\nAddress Phone: ${deliveryPhoneVal}`
        : `Phone: ${loginPhoneVal}`;

      const msg = `*NEW SIKAR DROP BILTY DISPATCH*\nOrder ID: ${orderId}\nCustomer: ${currentUser ? currentUser.name : 'Customer'}\n${phoneLines}\nCorridor: ${corridor}\nAddress: ${addressNote || 'Main Road'}\n\n*Items Ordered:*\n${itemsList}\n\n*Total Amount:* Rs.${total}\n*Camper Notice:* 100% Factory Sealed Cases Only.`;
      
      const waUrl = `https://wa.me/${depotPhone}?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, '_blank');
      showToast(`Order #${orderId} booked! Tracking bilty generated.`);
    } else {
      const errData = await res.json().catch(() => ({}));
      showToast(errData.error || 'Delivery not available in this location.');
    }
  } catch (e) {
    console.error('Order creation error:', e);
    showToast('Failed to record order: ' + e.message);
  }
}

// 4. GLOBAL ESCAPE LISTENER
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLoginModal();
    closeOrderConfirmModal();
    toggleCartDrawer(false);
  }
});
