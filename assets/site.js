// SIKAR DROP — Shared Storefront Client Engine
// Real-time synchronization with SQLite backend, Theme Engine, Cart & Multi-page routing
// Strict Zero Emojis Policy

// Global state attached to window to prevent identifier redeclaration collisions
window.cart = window.cart || JSON.parse(localStorage.getItem('sikar_cart') || '{}');
window.appliedCoupon = window.appliedCoupon || JSON.parse(sessionStorage.getItem('sikar_applied_coupon') || 'null');
window.wishlist = window.wishlist || JSON.parse(localStorage.getItem('sikar_wishlist') || '[]');
window.currentUser = window.currentUser || JSON.parse(localStorage.getItem('sikar_user') || 'null');
window.currentTheme = window.currentTheme || localStorage.getItem('sikar_theme') || 'default';
window.PRODUCTS = window.PRODUCTS || [];
window.CATEGORIES = window.CATEGORIES || [];

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
  // Synchronously load cached settings/theme immediately to avoid visual delay
  try {
    const cachedSettings = JSON.parse(localStorage.getItem('sikar_settings') || 'null');
    const cachedTheme = localStorage.getItem('sikar_theme') || (cachedSettings && cachedSettings.active_theme) || 'normal';
    if (cachedTheme && cachedTheme !== 'normal' && cachedTheme !== 'default') {
      applyActiveFestivalTheme(cachedSettings || cachedTheme);
    }
  } catch (e) {
    console.warn('Fallback loading cached theme in site.js:', e);
  }

  // Cross-tab real-time storage event listener
  if (!window._festiveStorageAttached) {
    window._festiveStorageAttached = true;
    window.addEventListener('storage', (e) => {
      if (!e.key || e.key === 'sikar_theme' || e.key === 'sikar_settings') {
        try {
          const freshSettings = JSON.parse(localStorage.getItem('sikar_settings') || 'null');
          const freshTheme = localStorage.getItem('sikar_theme') || (freshSettings && freshSettings.active_theme) || 'normal';
          applyActiveFestivalTheme(freshSettings || freshTheme);
        } catch (err) {
          console.warn('Storage theme sync err:', err);
        }
      }
    });
  }

  try {
    const res = await fetch('/api/settings?_t=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data) {
        localStorage.setItem('sikar_settings', JSON.stringify(data));
        localStorage.setItem('sikar_theme', data.active_theme || 'normal');
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

window.FESTIVE_STORE_PRESETS = window.FESTIVE_STORE_PRESETS || {
  diwali: {
    badge: 'DIWALI SPECIAL OFFER',
    banner: 'Shubh Deepawali! Save 15% on wholesale water & beverage crates with code DIWALI2026.',
    coupon: 'DIWALI2026',
    discount: '15',
    greetingTitle: 'Shubh Deepawali from Sikar Drop',
    greetingSub: 'Celebrate the festival of lights with pristine mineral water cases at depot prices.',
    accentColor: '#D97706',
    ambient: true,
    welcomeModal: true,
    sparklerTrail: true,
    countdown: true,
    floatingWidget: true
  },
  holi: {
    badge: 'HOLI DHAMAKA',
    banner: 'Holi Ke Rang, Sikar Drop Ke Sang! Instant chilled PET crate deliveries across Sikar.',
    coupon: 'HOLI2026',
    discount: '12',
    greetingTitle: 'Rangotsav Greetings from Sikar Drop',
    greetingSub: 'Keep your guests hydrated with premium packaged drinking water.',
    accentColor: '#E11D48',
    ambient: true,
    welcomeModal: true,
    sparklerTrail: false,
    countdown: true,
    floatingWidget: true
  },
  navratri: {
    badge: 'NAVRATRI SPECIAL',
    banner: 'Purity in every drop. Certified ISI packaged drinking water for auspicious occasions.',
    coupon: 'DURGA10',
    discount: '10',
    greetingTitle: 'Jai Mata Di - Auspicious Navratri Deals',
    greetingSub: 'Fast delivery to marriage gardens, community pandals & homes.',
    accentColor: '#DC2626',
    ambient: true,
    welcomeModal: true,
    sparklerTrail: false,
    countdown: false,
    floatingWidget: true
  },
  newyear: {
    badge: 'NEW YEAR 2027',
    banner: 'Stock up your hotel, cafe, or party with chilled sodas & mineral water petis.',
    coupon: 'NEWYEAR20',
    discount: '20',
    greetingTitle: 'Happy New Year Celebration Deals',
    greetingSub: 'Wholesale beverage & water deliveries 24/7 across Sikar.',
    accentColor: '#06B6D4',
    ambient: true,
    welcomeModal: true,
    sparklerTrail: true,
    countdown: true,
    floatingWidget: true
  },
  national: {
    badge: 'DESH KI SHAN',
    banner: 'Proudly serving Rajasthan with certified pure mineral water depot supply.',
    coupon: 'TIRANGA15',
    discount: '15',
    greetingTitle: 'Saluting the Nation with Pure Water',
    greetingSub: 'Supplying schools, offices, rallies & community gatherings.',
    accentColor: '#EA580C',
    ambient: true,
    welcomeModal: true,
    sparklerTrail: false,
    countdown: false,
    floatingWidget: false
  },
  custom: {
    badge: 'LIMITED CAMPAIGN',
    banner: 'Exclusive limited time wholesale prices on bulk petis and cartons.',
    coupon: 'SPECIAL15',
    discount: '15',
    greetingTitle: 'Special Campaign Deals',
    greetingSub: 'Special depot rates for commercial buyers.',
    accentColor: '#7C3AED',
    ambient: false,
    welcomeModal: true,
    sparklerTrail: false,
    countdown: true,
    floatingWidget: true
  }
};

function applyActiveFestivalTheme(settings) {
  const themeName = (typeof settings === 'string' ? settings : ((settings && settings.active_theme) || 'normal')).toLowerCase();
  currentTheme = themeName;
  window.currentFestivalTheme = themeName;
  document.body.dataset.theme = themeName;
  localStorage.setItem('sikar_theme', themeName);

  let ribbon = document.getElementById('store-festival-ribbon');
  const preset = FESTIVE_STORE_PRESETS[themeName] || {};
  const cfg = (typeof settings === 'object' && settings) ? settings : {};
  const accentColor = cfg.theme_accent_color || preset.accentColor || '#D97706';

  if (themeName === 'normal' || themeName === 'default') {
    document.documentElement.removeAttribute('data-theme');
    document.body.dataset.theme = 'normal';
    window.currentFestivalTheme = 'normal';
    applyFestiveBackgroundAndColorMix('normal', '#0284C7', cfg);
    if (ribbon) ribbon.style.display = 'none';
    const fw = document.getElementById('festive-floating-widget');
    if (fw) fw.remove();
    const sc = document.getElementById('sparkler-canvas');
    if (sc) sc.remove();
    return;
  }

  document.documentElement.setAttribute('data-theme', themeName);
  document.body.dataset.theme = themeName;
  window.currentFestivalTheme = themeName;
  applyFestiveBackgroundAndColorMix(themeName, accentColor, cfg);

  if (sessionStorage.getItem('sikar_ribbon_dismissed') === 'true') {
    if (ribbon) ribbon.remove();
  } else {
    if (!ribbon) {
      ribbon = document.createElement('aside');
      ribbon.id = 'store-festival-ribbon';
      ribbon.className = 'store-festival-ribbon';
      const navbar = document.querySelector('.site-navbar');
      if (navbar && navbar.parentNode) {
        navbar.parentNode.insertBefore(ribbon, navbar);
      } else {
        document.body.prepend(ribbon);
      }
    }

    const badgeText = cfg.top_ribbon_badge || preset.badge || 'FESTIVAL SPECIAL';
    const msgText = cfg.banner_message || preset.banner || 'Wholesale packaged water & beverage cases delivered in Sikar.';
    const isCountdown = (cfg.countdown_timer_enabled === '1' || (cfg.countdown_timer_enabled === undefined && preset.countdown));

    ribbon.style.display = 'block';
    ribbon.style.position = 'relative';
    ribbon.style.background = `linear-gradient(90deg, #0B192C 0%, ${accentColor} 50%, #0B192C 100%)`;
    ribbon.style.color = '#FFFFFF';
    ribbon.style.padding = '4px 34px 4px 10px';
    ribbon.style.fontSize = '0.74rem';
    ribbon.style.fontWeight = '700';
    ribbon.style.lineHeight = '1.25';
    ribbon.style.textAlign = 'center';
    ribbon.style.zIndex = '950';

    ribbon.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; gap:6px; flex-wrap:nowrap; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:calc(100% - 24px); margin:0 auto;">
        <span style="background:rgba(255,255,255,0.22); padding:1px 7px; border-radius:3px; font-size:0.65rem; letter-spacing:0.04em; text-transform:uppercase; font-weight:800; flex-shrink:0;">${escapeHTML(badgeText)}</span>
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.75rem;">${escapeHTML(msgText)}</span>
        ${isCountdown ? `<span id="ribbon-countdown-badge" style="background:#0F172A; color:#FDE047; padding:1px 6px; border-radius:3px; font-family:monospace; font-size:0.68rem; flex-shrink:0;">Ends In: 02d 08h</span>` : ''}
      </div>
      <button type="button" class="btn-ribbon-cut" onclick="dismissFestivalRibbon(event)" aria-label="Close Announcement" title="Cut / Dismiss" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); width:22px; height:22px; border-radius:50%; background:rgba(255,255,255,0.25); border:none; color:#FFFFFF; display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0; line-height:1;">
        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.6" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
  }

  window.dismissFestivalRibbon = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const r = document.getElementById('store-festival-ribbon');
    if (r) {
      r.style.transition = 'all 0.22s ease-out';
      r.style.maxHeight = '0px';
      r.style.padding = '0';
      r.style.opacity = '0';
      r.style.overflow = 'hidden';
      setTimeout(() => r.remove(), 240);
    }
    sessionStorage.setItem('sikar_ribbon_dismissed', 'true');
  };

  const showModal = (cfg.welcome_modal_enabled === '1' || (cfg.welcome_modal_enabled === undefined && preset.welcomeModal));
  if (showModal) {
    initFestiveWelcomeModal(Object.assign({}, preset, cfg));
  }
  const showWidget = (cfg.floating_widget_enabled === '1' || (cfg.floating_widget_enabled === undefined && preset.floatingWidget));
  if (showWidget) {
    initFestiveFloatingWidget(Object.assign({}, preset, cfg));
  }
  const showSparkler = (cfg.sparkler_trail_enabled === '1' || (cfg.sparkler_trail_enabled === undefined && preset.sparklerTrail));
  if (showSparkler) {
    initSparklerTrail(accentColor);
  }
}

function initFestiveWelcomeModal(settings) {
  const path = (window.location.pathname || '').toLowerCase();
  if (path.includes('track') || path.includes('cart') || path.includes('admin') || window.location.search.includes('id=')) return;
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
  w.className = 'festive-floating-widget-fab';
  w.style.cssText = `
    position: fixed;
    bottom: calc(134px + env(safe-area-inset-bottom, 0px));
    right: 14px;
    z-index: 9998;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: ${color};
    color: #FFFFFF;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  `;
  w.title = `Click to reveal festive discount (${code})`;
  w.setAttribute('aria-label', `Festive Gift Offer: ${code}`);

  w.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="22" height="22">
      <polyline points="20 12 20 22 4 22 4 12"/>
      <rect width="20" height="5" x="2" y="7"/>
      <line x1="12" x2="12" y1="22" y2="7"/>
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
    </svg>
    <span style="position:absolute; top:-4px; right:-4px; background:#EF4444; color:#FFFFFF; font-size:0.6rem; font-weight:900; padding:1px 5px; border-radius:9999px; border:1.5px solid #FFFFFF; letter-spacing:0.02em;">OFFER</span>
  `;

  w.onclick = () => {
    openFestiveGiftDialog(settings);
  };

  document.body.appendChild(w);
}

function openFestiveGiftDialog(settings) {
  let existing = document.getElementById('festive-gift-dialog');
  if (existing) existing.remove();

  const color = settings.theme_accent_color || '#D97706';
  const code = settings.promo_coupon_code || 'DIWALI2026';
  const pct = settings.discount_percentage || '15';
  const title = settings.welcome_greeting_title || 'Diwali Dhamaka Exclusive Offer';
  const sub = settings.welcome_greeting_subtitle || 'Direct wholesale supply of pure factory-sealed water and chilled beverages across Sikar.';

  const dlg = document.createElement('div');
  dlg.id = 'festive-gift-dialog';
  dlg.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.72); backdrop-filter:blur(5px); z-index:100000; display:flex; align-items:center; justify-content:center; padding:16px; animation:fadeInModal 0.25s ease-out;';

  dlg.innerHTML = `
    <div style="background:#FFFFFF; border-radius:18px; padding:28px 24px; max-width:420px; width:100%; text-align:center; position:relative; box-shadow:0 24px 48px rgba(0,0,0,0.35); border:2px solid ${color};">
      <button type="button" onclick="document.getElementById('festive-gift-dialog').remove()" style="position:absolute; top:12px; right:12px; background:none; border:none; color:#64748B; cursor:pointer; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%;" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div style="width:52px; height:52px; border-radius:50%; background:${color}22; color:${color}; margin:0 auto 12px; display:flex; align-items:center; justify-content:center;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="28" height="28"><polyline points="20 12 20 22 4 22 4 12"/><rect width="20" height="5" x="2" y="7"/><line x1="12" x2="12" y1="22" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
      </div>
      <h3 style="font-family:var(--font-heading); font-size:1.3rem; font-weight:800; color:#0B192C; margin:0 0 6px 0;">${escapeHTML(title)}</h3>
      <p style="font-size:0.84rem; color:#64748B; line-height:1.45; margin:0 0 16px 0;">${escapeHTML(sub)}</p>
      
      <div style="background:#FFFBEB; border:1.5px dashed ${color}; border-radius:12px; padding:16px 12px; margin-bottom:18px;">
        <div style="font-size:0.72rem; font-weight:800; color:#78350F; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:4px;">Festive Discount Voucher</div>
        <div style="font-size:1.4rem; font-weight:900; color:${color}; font-family:monospace; letter-spacing:0.08em; margin:2px 0;">${escapeHTML(code)}</div>
        <div style="font-size:0.82rem; color:#15803D; font-weight:800;">Flat ${pct}% Discount on Bulk Petis</div>
      </div>

      <div style="display:flex; flex-direction:column; gap:8px;">
        <button type="button" class="btn-primary" onclick="applyAndCopyFestiveVoucher('${escapeHTML(code)}', ${parseInt(pct, 10) || 15})" style="width:100%; padding:13px 18px; font-weight:800; font-size:0.92rem; border-radius:9999px; background:${color}; color:#FFFFFF; border:none; cursor:pointer;">
          <span>COPY CODE &amp; APPLY TO CART</span>
        </button>
        <button type="button" onclick="document.getElementById('festive-gift-dialog').remove()" style="background:none; border:none; color:#64748B; font-size:0.84rem; font-weight:700; cursor:pointer; padding:6px;">
          Continue Shopping
        </button>
      </div>
    </div>
  `;

  dlg.onclick = (e) => {
    if (e.target === dlg) dlg.remove();
  };
  document.body.appendChild(dlg);
}

window.applyAndCopyFestiveVoucher = function(code, pct) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).catch(() => {});
  }
  sessionStorage.setItem('sikar_applied_coupon', JSON.stringify({ code, pct }));
  localStorage.setItem('sikar_applied_coupon', JSON.stringify({ code, pct }));
  if (typeof updateCartUI === 'function') updateCartUI();
  showToast(`Coupon ${code} Copied & Applied! Flat ${pct}% OFF`);
  const dlg = document.getElementById('festive-gift-dialog');
  if (dlg) dlg.remove();
};

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
      fetch('/api/products?_t=' + Date.now(), { cache: 'no-store' }),
      fetch('/api/categories?_t=' + Date.now(), { cache: 'no-store' })
    ]);

    if (pRes.ok) {
      const pData = await pRes.json();
      if (Array.isArray(pData)) {
        pData.sort((a, b) => {
          const ordA = a.display_order !== undefined ? a.display_order : 50;
          const ordB = b.display_order !== undefined ? b.display_order : 50;
          if (ordA !== ordB) return ordA - ordB;
          return (b.created_at || '').localeCompare(a.created_at || '');
        });
        const serverIds = new Set(pData.map(p => p.id));
        const localOnly = (PRODUCTS || []).filter(p => p && p.id && !serverIds.has(p.id));
        PRODUCTS = [...pData, ...localOnly];
        localStorage.setItem('sikar_admin_products', JSON.stringify(PRODUCTS));
      }
    }

    if (cRes.ok) {
      const cData = await cRes.json();
      if (Array.isArray(cData)) {
        const serverIds = new Set(cData.map(c => c.id));
        const localOnly = (CATEGORIES || []).filter(c => c && c.id && !serverIds.has(c.id));
        CATEGORIES = [...cData, ...localOnly];
        localStorage.setItem('sikar_admin_categories', JSON.stringify(CATEGORIES));
      }
    }
  } catch (err) {
    console.warn('Backend catalog sync error, fallback to cache:', err);
    PRODUCTS = JSON.parse(localStorage.getItem('sikar_admin_products') || '[]');
    CATEGORIES = JSON.parse(localStorage.getItem('sikar_admin_categories') || '[]');
  }
}

window.SITE_TEXTS = window.SITE_TEXTS || JSON.parse(localStorage.getItem('sikar_admin_texts') || 'null');

async function loadSiteTextsFromBackend() {
  try {
    const res = await fetch('/api/site-texts?_t=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const t = await res.json();
      if (t && typeof t === 'object') {
        SITE_TEXTS = t;
        localStorage.setItem('sikar_admin_texts', JSON.stringify(t));
        applyStorefrontSiteTexts(t);
      }
    }
  } catch (err) {
    if (SITE_TEXTS) applyStorefrontSiteTexts(SITE_TEXTS);
  }
}

function resolveHeroImageSource(src) {
  const value = String(src || '');
  // The bundled hero has a much smaller WebP twin. Use it by default,
  // while leaving custom admin uploads untouched.
  if (/hero_bottles_blended\.png$/i.test(value)) return value.replace(/\.png$/i, '.webp');
  return value;
}

window.getLiveWhatsAppNumber = function() {
  try {
    const cached = localStorage.getItem('sikar_admin_texts');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && (parsed.whatsappNumber || parsed.whatsapp)) {
        const raw = parsed.whatsappNumber || parsed.whatsapp;
        let clean = String(raw).replace(/\D/g, '');
        if (clean === '919829000000' || clean === '919829012345' || !clean) clean = '919829011223';
        if (clean.length === 10) return '91' + clean;
        if (clean.length >= 10) return clean;
      }
    }
  } catch (e) {}

  const raw = (window.SITE_TEXTS && (window.SITE_TEXTS.whatsappNumber || window.SITE_TEXTS.whatsapp)) ||
              (typeof adminTexts !== 'undefined' && adminTexts && (adminTexts.whatsappNumber || adminTexts.whatsapp)) ||
              '919829011223';
  let clean = String(raw).replace(/\D/g, '');
  if (clean === '919829000000' || clean === '919829012345' || !clean) clean = '919829011223';
  return clean.length === 10 ? ('91' + clean) : clean;
};

window.getLivePhoneNumber = function() {
  try {
    const cached = localStorage.getItem('sikar_admin_texts');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && (parsed.contactPhone || parsed.helpline)) {
        return parsed.contactPhone || parsed.helpline;
      }
    }
  } catch (e) {}

  return (window.SITE_TEXTS && (window.SITE_TEXTS.contactPhone || window.SITE_TEXTS.helpline)) ||
         (typeof adminTexts !== 'undefined' && adminTexts && (adminTexts.contactPhone || adminTexts.helpline)) ||
         '+91 98290 11223';
};

function applyStorefrontSiteTexts(t) {
  if (!t) return;
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.textContent = val;
  };
  const setHtml = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.innerHTML = escapeHTML(val).replace(/\n/g, '<br>');
  };

  setTxt('live-hero-pill-text', t.heroPill || t.hero_pill);
  setHtml('live-hero-main-title', t.heroTitle || t.hero_title);
  setTxt('live-hero-desc-lead', t.heroDesc || t.hero_desc);
  const heroImg = document.getElementById('live-hero-bottles-img');
  if (heroImg && (t.heroImg || t.hero_img)) {
    const heroSrc = resolveHeroImageSource(t.heroImg || t.hero_img);
    heroImg.src = heroSrc;
    if (!heroSrc.includes('hero_bottles_blended')) {
      heroImg.removeAttribute('srcset');
    }
  }

  setTxt('live-top-policy-text', t.topPolicy || t.top_policy);
  const helpline = document.getElementById('live-top-helpline-link');
  const hVal = t.helpline || t.contactPhone || t.contact_phone;
  if (helpline && hVal) {
    helpline.textContent = hVal;
    helpline.href = 'tel:' + String(hVal).replace(/[^0-9]/g, '');
  }
  setTxt('live-brand-tagline', t.brandTagline || t.brand_tagline);
  setTxt('live-truck-banner-title', t.truckTitle || t.truck_title);
  setTxt('live-truck-banner-sub', t.truckSub || t.truck_sub);
  setTxt('live-bulk-banner-title', t.bulkTitle || t.bulk_title);
  setTxt('live-bulk-banner-sub', t.bulkSub || t.bulk_sub);
  setTxt('live-footer-about-text', t.footerAbout || t.footer_about);
  setTxt('live-footer-address', t.contactAddress || t.contact_address);
  setTxt('live-footer-phone', t.contactPhone || t.contact_phone);
  setTxt('live-contact-address', t.contactAddress || t.contact_address);
  
  const cPhone = document.getElementById('live-contact-phone');
  if (cPhone && (t.contactPhone || t.contact_phone)) {
    cPhone.textContent = t.contactPhone || t.contact_phone;
    if (cPhone.tagName === 'A') cPhone.href = 'tel:' + String(t.contactPhone || t.contact_phone).replace(/[^0-9]/g, '');
  }

  setHtml('live-about-story', t.aboutStory || t.about_story);

  const footerHelpline = document.getElementById('live-footer-helpline');
  if (footerHelpline && (t.helpline || t.contactPhone || t.contact_phone)) {
    footerHelpline.textContent = `Helpline: ${t.helpline || t.contactPhone || t.contact_phone}`;
  }

  const notice = document.getElementById('live-footer-camper-notice');
  if (notice && (t.footerCamper || t.footer_camper)) {
    notice.innerHTML = '<strong>Strict Policy Notice:</strong> ' + escapeHTML(t.footerCamper || t.footer_camper);
  }

  // DYNAMIC LIVE WHATSAPP NUMBER BINDING
  const rawWa = t.whatsappNumber || t.whatsapp;
  if (rawWa) {
    const digitsOnly = String(rawWa).replace(/\D/g, '');
    const cleanWa = digitsOnly.length === 10 ? ('91' + digitsOnly) : digitsOnly;
    if (cleanWa.length >= 10) {
      document.querySelectorAll('a[href*="wa.me"]').forEach(a => {
        try {
          const url = new URL(a.href);
          const txt = url.searchParams.get('text');
          a.href = `https://wa.me/${cleanWa}${txt ? `?text=${encodeURIComponent(txt)}` : ''}`;
        } catch (e) {
          a.href = `https://wa.me/${cleanWa}`;
        }
      });
      const floatWa = document.querySelector('.btn-floating-whatsapp');
      if (floatWa) {
        floatWa.href = `https://wa.me/${cleanWa}?text=${encodeURIComponent('Hello Sikar Water Bottle Supply, I want to inquire about wholesale water bottle and beverage cases delivery.')}`;
      }
    }
  }

  // DYNAMIC LIVE DUAL-CONTACT PHONE & WHATSAPP BINDING
  const phone1 = t.phone || t.contactPhone || t.helpline || '+91 98290 11223';
  const wa1 = t.whatsapp || t.whatsappNumber || '919829011223';
  const label1 = t.phone_label_1 || t.phoneLabel1 || 'Mandi Main Depot • Order Booking';

  const phone2 = t.phone_2 || t.contactPhone2 || '+91 96602 91825';
  const wa2 = t.whatsapp_2 || t.whatsappNumber2 || '919660291825';
  const label2 = t.phone_label_2 || t.phoneLabel2 || 'Express Dispatch & Urgent Supply';

  const cleanPh1 = String(phone1).replace(/[^0-9+]/g, '');
  const cleanPh2 = String(phone2).replace(/[^0-9+]/g, '');
  const cleanWa1 = String(wa1).replace(/\D/g, '');
  const finalWa1 = cleanWa1.length === 10 ? ('91' + cleanWa1) : cleanWa1;
  const cleanWa2 = String(wa2).replace(/\D/g, '');
  const finalWa2 = cleanWa2.length === 10 ? ('91' + cleanWa2) : cleanWa2;

  const elLine1Lbl = document.getElementById('live-line1-label');
  if (elLine1Lbl) elLine1Lbl.textContent = label1;
  const elLine1PhTxt = document.getElementById('live-line1-phone-txt');
  if (elLine1PhTxt) elLine1PhTxt.textContent = `Call ${phone1}`;
  const elLine1Call = document.getElementById('live-line1-call');
  if (elLine1Call) elLine1Call.href = `tel:${cleanPh1}`;
  const elLine1Wa = document.getElementById('live-line1-wa');
  if (elLine1Wa) elLine1Wa.href = `https://wa.me/${finalWa1}?text=${encodeURIComponent('Namaste Sikar Drop, I want to order water and cold drinks')}`;

  const elLine2Lbl = document.getElementById('live-line2-label');
  if (elLine2Lbl) elLine2Lbl.textContent = label2;
  const elLine2PhTxt = document.getElementById('live-line2-phone-txt');
  if (elLine2PhTxt) elLine2PhTxt.textContent = `Call ${phone2}`;
  const elLine2Call = document.getElementById('live-line2-call');
  if (elLine2Call) elLine2Call.href = `tel:${cleanPh2}`;
  const elLine2Wa = document.getElementById('live-line2-wa');
  if (elLine2Wa) elLine2Wa.href = `https://wa.me/${finalWa2}?text=${encodeURIComponent('Namaste Sikar Drop, I need urgent tempo delivery')}`;

  document.querySelectorAll('.mobile-menu-call-btn, .btn-vip-call, a[href^="tel:"]').forEach(a => {
    a.href = 'tel:' + cleanPh1;
    const span = a.querySelector('span');
    if (span && (span.textContent.includes('Call Mandi Depot') || span.textContent.includes('+91') || span.textContent.includes('Call'))) {
      span.textContent = `Call ${phone1}`;
    }
  });

  ensureFloatingContactWidget();
}

// =========================================================
// MULTI-CONTACT DUAL-NUMBER ACTION SHEET MODAL
// =========================================================
window.openMultiContactModal = function(e) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
    e.stopPropagation();
  }

  let backdrop = document.getElementById('multi-contact-modal');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'multi-contact-modal';
    backdrop.className = 'multi-contact-modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', 'Sikar Drop Depot Contact Lines');
    backdrop.onclick = (evt) => {
      if (evt.target === backdrop) closeMultiContactModal();
    };
    document.body.appendChild(backdrop);
  }

  // Get active settings or fallbacks
  let s = window.STOREFRONT_SETTINGS || {};
  let t = {};
  try { t = JSON.parse(localStorage.getItem('sikar_admin_texts') || '{}'); } catch(err) {}
  if (!s.phone) {
    try { s = JSON.parse(localStorage.getItem('sikar_settings') || '{}'); } catch(err) {}
  }

  const phone1 = s.phone || s.contactPhone || s.helpline || t.contactPhone || t.phone || '+91 98290 11223';
  const wa1 = s.whatsapp || s.whatsappNumber || t.whatsappNumber || t.whatsapp || '919829011223';
  const label1 = s.phone_label_1 || t.phoneLabel1 || t.phone_label_1 || 'Mandi Main Depot • Order Booking';

  const phone2 = s.phone_2 || s.contactPhone2 || t.contactPhone2 || t.phone_2 || '+91 96602 91825';
  const wa2 = s.whatsapp_2 || s.whatsappNumber2 || t.whatsappNumber2 || t.whatsapp_2 || '919660291825';
  const label2 = s.phone_label_2 || t.phoneLabel2 || t.phone_label_2 || 'Express Dispatch & Urgent Supply';

  const cleanWa1 = String(wa1).replace(/\D/g, '');
  const finalWa1 = cleanWa1.length === 10 ? ('91' + cleanWa1) : cleanWa1;
  const cleanPh1 = String(phone1).replace(/[^0-9+]/g, '');

  const cleanWa2 = String(wa2).replace(/\D/g, '');
  const finalWa2 = cleanWa2.length === 10 ? ('91' + cleanWa2) : cleanWa2;
  const cleanPh2 = String(phone2).replace(/[^0-9+]/g, '');

  const waText = encodeURIComponent('Hello Sikar Drop, I want to inquire about wholesale water bottle and beverage delivery.');

  backdrop.innerHTML = `
    <div class="multi-contact-modal-card">
      <button type="button" onclick="closeMultiContactModal()" style="position:absolute; top:14px; right:14px; background:none; border:none; color:#64748B; cursor:pointer; width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:50%;" aria-label="Close dialog">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
        <div style="width:42px; height:42px; border-radius:50%; background:#EFF6FF; color:#0284C7; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="22" height="22"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        </div>
        <div>
          <h3 style="font-family:var(--font-heading); font-size:1.24rem; font-weight:800; color:#0B192C; margin:0 0 2px 0;">Sikar Drop Depot Support</h3>
          <p style="font-size:0.8rem; color:#64748B; margin:0; line-height:1.3;">Choose any depot contact to Call or WhatsApp directly</p>
        </div>
      </div>

      <!-- LINE 1: MANDI MAIN DEPOT -->
      <div class="multi-contact-line-box" id="contact-choice-line-1">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span class="multi-contact-pill-badge pill-badge-line1">LINE 1 • ORDER DEPOT</span>
          <span style="font-size:0.72rem; color:#16A34A; font-weight:800;">Available Now</span>
        </div>
        <div style="font-size:0.95rem; font-weight:800; color:#0B192C; margin-bottom:2px;">${escapeHTML(label1)}</div>
        <div style="font-size:1.15rem; font-weight:900; color:#0284C7; font-family:monospace; margin-bottom:4px;">${escapeHTML(phone1)}</div>
        <div style="font-size:0.74rem; color:#64748B; margin-bottom:10px;">For Wholesale Petis, Marriage Quotes & Rate Slabs</div>

        <div class="contact-actions-row">
          <a href="https://wa.me/${finalWa1}?text=${waText}" target="_blank" rel="noopener" class="btn-contact-action btn-contact-wa" onclick="trackContactClick('whatsapp', '${finalWa1}')">
            <svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
            <span>WhatsApp</span>
          </a>
          <a href="tel:${cleanPh1}" class="btn-contact-action btn-contact-call" onclick="trackContactClick('call', '${cleanPh1}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="17" height="17"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <span>Call Now</span>
          </a>
        </div>
      </div>

      <!-- LINE 2: EXPRESS DISPATCH & SUPPORT -->
      <div class="multi-contact-line-box" id="contact-choice-line-2">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span class="multi-contact-pill-badge pill-badge-line2">LINE 2 • EXPRESS DISPATCH</span>
          <span style="font-size:0.72rem; color:#0284C7; font-weight:800;">Tempo Hub</span>
        </div>
        <div style="font-size:0.95rem; font-weight:800; color:#0B192C; margin-bottom:2px;">${escapeHTML(label2)}</div>
        <div style="font-size:1.15rem; font-weight:900; color:#15803D; font-family:monospace; margin-bottom:4px;">${escapeHTML(phone2)}</div>
        <div style="font-size:0.74rem; color:#64748B; margin-bottom:10px;">For Tempo Dispatch, Live Driver Tracking & Urgent Unloading</div>

        <div class="contact-actions-row">
          <a href="https://wa.me/${finalWa2}?text=${waText}" target="_blank" rel="noopener" class="btn-contact-action btn-contact-wa" onclick="trackContactClick('whatsapp', '${finalWa2}')">
            <svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
            <span>WhatsApp</span>
          </a>
          <a href="tel:${cleanPh2}" class="btn-contact-action btn-contact-call" onclick="trackContactClick('call', '${cleanPh2}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="17" height="17"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <span>Call Now</span>
          </a>
        </div>
      </div>

      <div style="text-align:center; margin-top:14px; font-size:0.75rem; color:#94A3B8;">
        100% Factory-Sealed Direct Depot Delivery Across Sikar
      </div>
    </div>
  `;

  backdrop.classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.closeMultiContactModal = function() {
  const backdrop = document.getElementById('multi-contact-modal');
  if (backdrop) {
    backdrop.classList.remove('active');
  }
  document.body.style.overflow = '';
};

function trackContactClick(channel, number) {
  try {
    if (window.SikarAnalytics && typeof window.SikarAnalytics.track === 'function') {
      window.SikarAnalytics.track('contact_click', { channel, number });
    }
  } catch(e) {}
}

window.ensureFloatingContactWidget = function() {
  if (typeof document === 'undefined') return;
  let widget = document.querySelector('.floating-whatsapp-widget');
  if (!widget) {
    widget = document.createElement('aside');
    widget.className = 'floating-whatsapp-widget';
    document.body.appendChild(widget);
  }

  let btn = widget.querySelector('.btn-floating-whatsapp');
  if (!btn) {
    btn = document.createElement('a');
    btn.className = 'btn-floating-whatsapp';
    btn.setAttribute('aria-label', 'Contact Sikar Drop Depot');
    btn.href = 'https://wa.me/919829011223';
    btn.innerHTML = `
      <span class="floating-contact-dual-badge">2 LINES</span>
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
      <span>Instant Order</span>
    `;
    widget.appendChild(btn);
  }

  if (!btn.querySelector('.floating-contact-dual-badge')) {
    const badge = document.createElement('span');
    badge.className = 'floating-contact-dual-badge';
    badge.textContent = '2 LINES';
    btn.prepend(badge);
  }

  btn.onclick = (e) => openMultiContactModal(e);

  document.querySelectorAll('.mobile-menu-call-btn, .mobile-menu-wa-btn').forEach(el => {
    el.onclick = (e) => {
      openMultiContactModal(e);
      if (typeof toggleMobileMenu === 'function') toggleMobileMenu(false);
    };
  });
};

document.addEventListener('DOMContentLoaded', () => {
  ensureFloatingContactWidget();
});

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

function ensureMobileMenuElements() {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('mobile-menu-drawer')) {
    const backdrop = document.createElement('div');
    backdrop.className = 'mobile-menu-backdrop';
    backdrop.id = 'mobile-menu-backdrop';
    backdrop.onclick = () => toggleMobileMenu(false);
    document.body.appendChild(backdrop);

    const drawer = document.createElement('aside');
    drawer.className = 'mobile-menu-drawer';
    drawer.id = 'mobile-menu-drawer';
    drawer.setAttribute('aria-label', 'Site Navigation');
    drawer.style.cssText = 'position: fixed; top: 0; left: -340px; width: 320px; max-width: 86vw; height: 100%; height: 100dvh; background: #FFFFFF; z-index: 1001; display: flex; flex-direction: column; overflow-y: auto; transition: left 0.28s ease;';
    drawer.innerHTML = `
      <div class="mobile-menu-header">
        <div class="mobile-menu-brand">
          <img src="/assets/sikar_drop_icon.webp" alt="Sikar Water Bottle Supply" class="mobile-menu-brand-icon">
          <div>
            <div class="mobile-menu-brand-text">SIKAR <span style="color:#38BDF8;">WATER SUPPLY</span></div>
            <span class="mobile-menu-brand-sub">Wholesale Depot Sikar</span>
          </div>
        </div>
        <button type="button" class="mobile-menu-close-btn" onclick="toggleMobileMenu(false)" aria-label="Close menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div id="drawer-profile-slot"></div>
      <nav class="mobile-menu-nav">
        <a href="/" class="mobile-menu-link">
          <svg width="18" height="18" style="width: 18px; height: 18px; max-width: 18px; max-height: 18px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          <span>Home</span>
        </a>
        <a href="/products" class="mobile-menu-link">
          <svg width="18" height="18" style="width: 18px; height: 18px; max-width: 18px; max-height: 18px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
          <span>Products &amp; Water</span>
        </a>
        <a href="/categories" class="mobile-menu-link">
          <svg width="18" height="18" style="width: 18px; height: 18px; max-width: 18px; max-height: 18px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          <span>Categories</span>
        </a>
        <a href="/bulk" class="mobile-menu-link">
          <svg width="18" height="18" style="width: 18px; height: 18px; max-width: 18px; max-height: 18px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
          <span>Corporate &amp; Shaadi Supply</span>
        </a>
        <a href="/orders" class="mobile-menu-link">
          <svg width="18" height="18" style="width: 18px; height: 18px; max-width: 18px; max-height: 18px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M9 14h6"></path><path d="M9 10h6"></path><path d="M9 18h4"></path></svg>
          <span>My Orders</span>
        </a>
        <a href="/track" class="mobile-menu-link">
          <svg width="18" height="18" style="width: 18px; height: 18px; max-width: 18px; max-height: 18px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
          <span>Track Order</span>
          <span class="menu-badge">Live</span>
        </a>
        <a href="/about" class="mobile-menu-link">
          <svg width="18" height="18" style="width: 18px; height: 18px; max-width: 18px; max-height: 18px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          <span>About Us</span>
        </a>
        <a href="/why" class="mobile-menu-link">
          <svg width="18" height="18" style="width: 18px; height: 18px; max-width: 18px; max-height: 18px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          <span>Why Us</span>
        </a>
        <a href="/faq" class="mobile-menu-link">
          <svg width="18" height="18" style="width: 18px; height: 18px; max-width: 18px; max-height: 18px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          <span>FAQs</span>
        </a>
        <a href="/contact" class="mobile-menu-link">
          <svg width="18" height="18" style="width: 18px; height: 18px; max-width: 18px; max-height: 18px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          <span>Contact Support</span>
        </a>
      </nav>
      <div class="mobile-menu-footer">
        <a href="tel:+919829011223" class="mobile-menu-call-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          <span>Call Mandi Depot: +91 98290 11223</span>
        </a>
        <a href="https://wa.me/919829011223" target="_blank" class="mobile-menu-wa-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          <span>Order on WhatsApp</span>
        </a>
      </div>
    `;
    document.body.appendChild(drawer);
    if (typeof applySiteTexts === 'function') applySiteTexts();
    updateDrawerProfile();
  } else {
    const existingDrawer = document.getElementById('mobile-menu-drawer');
    if (existingDrawer && !document.getElementById('drawer-profile-slot')) {
      const slot = document.createElement('div');
      slot.id = 'drawer-profile-slot';
      const header = existingDrawer.querySelector('.mobile-menu-header');
      if (header && header.nextSibling) {
        existingDrawer.insertBefore(slot, header.nextSibling);
      } else {
        existingDrawer.prepend(slot);
      }
    }
    updateDrawerProfile();
  }

  // Also ensure hamburger button exists in navbar if not present
  const navLayout = document.querySelector('.site-navbar .nav-layout');
  if (navLayout && !navLayout.querySelector('.nav-hamburger-btn')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-hamburger-btn';
    btn.onclick = () => toggleMobileMenu(true);
    btn.setAttribute('aria-label', 'Open Navigation Menu');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.3" fill="none"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
      <span>Menu</span>
    `;
    navLayout.prepend(btn);
  }
}

function updateDrawerProfile() {
  const container = document.getElementById('drawer-profile-slot');
  if (!container) return;
  const user = getSignedInUser();
  if (user && user.phone) {
    const name = user.name || 'Valued Customer';
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'C';
    container.innerHTML = `
      <div onclick="toggleMobileMenu(false); openCustomerProfileModal();" style="margin: 12px 14px 4px; background: linear-gradient(135deg, #0284C7, #0369A1); color: #fff; padding: 12px 14px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);">
        <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
          <div style="width: 38px; height: 38px; border-radius: 50%; background: #fff; color: #0284C7; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">${escapeHTML(initials)}</div>
          <div style="overflow: hidden;">
            <div style="font-weight: 800; font-size: 0.92rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(name)}</div>
            <div style="font-size: 0.74rem; color: #E0F2FE;">+91 ${formatPhoneNumber(user.phone)} &bull; Profile &amp; Orders</div>
          </div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink: 0;"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div onclick="toggleMobileMenu(false); openLoginModal('nav');" style="margin: 12px 14px 4px; background: #EFF6FF; border: 1.5px solid #BFDBFE; color: #0284C7; padding: 10px 14px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          <span style="font-weight: 700; font-size: 0.88rem;">Customer Sign In / Register</span>
        </div>
        <span style="background: #0284C7; color: #fff; font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 6px;">1-Tap</span>
      </div>
    `;
  }
}

function toggleMobileMenu(open) {
  if (open) {
    ensureMobileMenuElements();
    updateDrawerProfile();
  }
  const drawer = document.getElementById('mobile-menu-drawer');
  const backdrop = document.getElementById('mobile-menu-backdrop');
  if (drawer) {
    drawer.classList.toggle('open', open);
    if (open) {
      drawer.style.left = '0px';
      document.body.style.overflow = 'hidden';
    } else {
      drawer.style.left = '';
      document.body.style.overflow = '';
    }
  }
  if (backdrop) {
    backdrop.classList.toggle('open', open);
    if (open) {
      backdrop.style.opacity = '1';
      backdrop.style.visibility = 'visible';
      backdrop.style.pointerEvents = 'auto';
    } else {
      backdrop.style.opacity = '0';
      backdrop.style.visibility = 'hidden';
      backdrop.style.pointerEvents = 'none';
    }
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const drawer = document.getElementById('mobile-menu-drawer');
    if (!drawer || !drawer.classList.contains('open')) return;
    const isInsideDrawer = drawer.contains(e.target);
    const isHamburger = e.target && e.target.closest && e.target.closest('.nav-hamburger-btn');
    if (!isInsideDrawer && !isHamburger) {
      toggleMobileMenu(false);
    }
  }, true);

  document.addEventListener('touchstart', (e) => {
    const drawer = document.getElementById('mobile-menu-drawer');
    if (!drawer || !drawer.classList.contains('open')) return;
    const isInsideDrawer = drawer.contains(e.target);
    const isHamburger = e.target && e.target.closest && e.target.closest('.nav-hamburger-btn');
    if (!isInsideDrawer && !isHamburger) {
      toggleMobileMenu(false);
    }
  }, { passive: true });
}

function toggleNavDropdown(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const dropdown = document.getElementById('nav-dropdown-more');
  if (dropdown) dropdown.classList.toggle('is-open');
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('nav-dropdown-more');
    if (dropdown && !dropdown.contains(e.target)) {
      dropdown.classList.remove('is-open');
    }
  });
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
    if (window.SikarAnalytics && typeof window.SikarAnalytics.trackAddToCart === 'function') {
      window.SikarAnalytics.trackAddToCart(id, delta);
    }
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

function getCatalogOrBundleItem(id) {
  if (typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS) && PRODUCTS.length > 0) {
    let prod = PRODUCTS.find(p => String(p.id) === String(id));
    if (prod) return prod;
  }
  if (window.PRODUCTS && Array.isArray(window.PRODUCTS) && window.PRODUCTS.length > 0) {
    let prod = window.PRODUCTS.find(p => String(p.id) === String(id));
    if (prod) return prod;
  }
  const cachedProds = JSON.parse(localStorage.getItem('sikar_admin_products') || '[]');
  let cachedP = cachedProds.find(p => String(p.id) === String(id));
  if (cachedP) return cachedP;

  const bundles = (typeof WHOLESALE_BUNDLES !== 'undefined' && Array.isArray(WHOLESALE_BUNDLES))
    ? WHOLESALE_BUNDLES
    : JSON.parse(localStorage.getItem('sikar_admin_bundles') || '[]');
  const b = bundles.find(item => String(item.id) === String(id));
  if (b) {
    return {
      id: b.id,
      title: b.title,
      spec: (b.specs && b.specs[0]) || 'Wholesale Event Bundle',
      price: Number(b.price) || 0,
      image: b.image || 'assets/cat_wedding_supply.webp'
    };
  }
  return { id: String(id), title: 'Wholesale Beverage Case (' + id + ')', price: 180 };
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
    const prod = getCatalogOrBundleItem(id);
    if (prod && qty > 0) {
      count += qty;
      const lineTotal = prod.price * qty;
      subtotal += lineTotal;
      html += `
        <div class="cart-line-row">
          <img src="${prod.image}" alt="${prod.title}" class="cart-line-thumb" onerror="this.src='assets/cat_wedding_supply.webp'">
          <div class="cart-line-info">
            <h4>${escapeHTML(prod.title)}</h4>
            <div class="price-tag tabular">₹${prod.price}/box x ${qty} Box${qty > 1 ? 'es' : ''} = <strong>₹${lineTotal.toLocaleString('en-IN')}</strong></div>
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
    const p = getCatalogOrBundleItem(id);
    if (p && qty > 0) sub += p.price * qty;
  }
  return sub;
}

// ==========================================
// 3.5 UNIFIED CHECKOUT GATE
// Every storefront page funnels through the same flow:
//   Add to Cart -> Click "Place Order"
//     -> Already logged in  => straight to the order-confirm step
//     -> Not logged in      => login first, then CONTINUE to the order step
// Pages that do not ship their own login / order-confirm markup get the
// shared modals injected automatically by ensureCheckoutModals().
// ==========================================

const SIKAR_LOGIN_MODAL_HTML = `
  <div class="modal-backdrop" id="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-modal-title" data-sikar-injected="1">
    <div class="auth-modal-dialog" style="max-width: 440px; text-align: center; padding: 26px 22px;">
      <button type="button" class="modal-close-icon" onclick="closeLoginModal()" aria-label="Close login dialog" style="position: absolute; right: 14px; top: 14px; background: none; border: none; cursor: pointer; color: #64748B;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
      <div style="margin: 0 auto 12px; width: 58px; height: 58px; border-radius: 50%; background: linear-gradient(135deg, #EBF5FF 0%, #DBEAFE 100%); display: flex; align-items: center; justify-content: center; border: 2px solid #BFDBFE; box-shadow: 0 4px 14px rgba(0, 102, 245, 0.15);">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="#0066F5">
          <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2.1 21.9l4.98-1.28C8.51 21.49 10.2 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm-1 14.5l-3.5-3.5 1.41-1.41L11 13.67l5.59-5.59L18 9.5l-7 7z"></path>
        </svg>
      </div>
      <h3 id="login-modal-title" style="margin: 0 0 4px; font-size: 1.28rem; font-family: var(--font-heading); font-weight: 800; color: #0B192C;">
        Truecaller Mobile Verification
      </h3>
      <p style="font-size: 0.84rem; color: #64748B; margin: 0 0 16px; line-height: 1.4;">
        Verify your mobile number to continue with your order dispatch.
      </p>
      <div style="margin: 0 0 12px; text-align: left;">
        <label for="login-phone-input" style="font-weight: 700; color: #0F172A; font-size: 0.84rem; display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Mobile Number</span>
          <span style="font-size: 0.72rem; color: #0066F5; font-weight: 700;">Zero OTP &bull; 1-Tap SIM Check</span>
        </label>
        <div style="position: relative; display: flex; align-items: center;">
          <span style="position: absolute; left: 14px; font-weight: 800; color: #64748B; font-size: 1rem;">+91</span>
          <input type="tel" id="login-phone-input" placeholder="98290 12345" maxlength="10" value="" style="padding-left: 52px; font-weight: 800; letter-spacing: 0.05em; font-size: 1.05rem; width: 100%; border: 1.5px solid #CBD5E1; border-radius: 10px; height: 46px; background: #FFFFFF; box-sizing: border-box;">
        </div>
      </div>
      <div style="margin: 0 0 14px; text-align: left;">
        <label for="login-name-input" style="font-weight: 700; color: #0F172A; font-size: 0.84rem; display: block; margin-bottom: 4px;">Your Name (Optional)</label>
        <input type="text" id="login-name-input" placeholder="e.g. Ramesh Saini" style="width: 100%; font-weight: 600; padding: 10px 12px; border: 1.5px solid #CBD5E1; border-radius: 10px; height: 42px; background: #FFFFFF; box-sizing: border-box;">
      </div>
      <button type="button" id="btn-truecaller-1tap" onclick="startTruecaller1TapFlow()" style="background: #0066F5; border: 1px solid #0056D2; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 13px 20px; border-radius: 10px; font-weight: 800; font-size: 0.98rem; color: #FFFFFF; cursor: pointer; transition: all 0.2s; width: 100%; box-shadow: 0 6px 18px rgba(0, 102, 245, 0.35);">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="#FFFFFF"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2.1 21.9l4.98-1.28C8.51 21.49 10.2 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm-1 14.5l-3.5-3.5 1.41-1.41L11 13.67l5.59-5.59L18 9.5l-7 7z"></path></svg>
        <span id="btn-tc-label">VERIFY WITH TRUECALLER</span>
      </button>
      <div id="truecaller-polling-msg" style="display: none; flex-direction: column; align-items: center; gap: 8px; background: #EFF6FF; border: 1.5px solid #BFDBFE; padding: 12px 14px; border-radius: 12px; margin-top: 14px;">
        <span style="font-size: 0.82rem; color: #1D4ED8; font-weight: 700;" id="tc-status-text">
          Checking Truecaller... Please tap Continue inside Truecaller.
        </span>
      </div>
    </div>
  </div>`;

const SIKAR_ORDER_CONFIRM_MODAL_HTML = `
  <div class="modal-backdrop" id="order-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="order-confirm-title" data-sikar-injected="1">
    <div class="order-confirm-dialog">
      <button type="button" class="modal-close-icon" onclick="closeOrderConfirmModal()" aria-label="Close confirmation dialog">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>

      <!-- CLEAN HEADER -->
      <div style="margin-bottom: 12px; padding-right: 30px;">
        <h3 id="order-confirm-title" style="margin: 0 0 2px; font-size: 1.25rem; font-family: var(--font-heading); font-weight: 800; color: #0B192C; line-height: 1.2;">
          Confirm Dispatch
        </h3>
        <p style="font-size: 0.78rem; color: #64748B; margin: 0;">
          Express tempo delivery across Sikar (45-60 Mins)
        </p>
      </div>

      <!-- COMPACT ORDER & CUSTOMER SUMMARY (SINGLE CLEAN CONTAINER) -->
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 10px 14px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
        <div style="min-width: 0;">
          <div style="font-size: 0.84rem; font-weight: 800; color: #0B192C; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" id="confirm-customer-name">
            Valued Customer
          </div>
          <div style="display: flex; align-items: center; gap: 4px; font-size: 0.76rem; color: #0369A1; font-weight: 700; margin-top: 1px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#0066F5"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2.1 21.9l4.98-1.28C8.51 21.49 10.2 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm-1 14.5l-3.5-3.5 1.41-1.41L11 13.67l5.59-5.59L18 9.5l-7 7z"></path></svg>
            <span id="confirm-customer-phone">+91 98290 XXXXX</span>
          </div>
        </div>
        <div style="text-align: right; flex-shrink: 0;">
          <span style="font-size: 0.74rem; color: #64748B; font-weight: 700; display: block;" id="confirm-total-petis">0 Cases</span>
          <strong style="font-size: 1.18rem; color: #0284C7; font-family: var(--font-heading); font-weight: 900;" id="confirm-total-amount">₹0</strong>
        </div>
      </div>

      <!-- FORM FIELDS -->
      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px;">
        <!-- FIELD 1: RECEIVER PHONE -->
        <div class="form-group-field" style="margin: 0;">
          <label for="delivery-phone-input" style="font-size: 0.76rem; font-weight: 700; color: #334155; margin-bottom: 3px; display: block;">
            Driver Contact / Receiver Mobile *
          </label>
          <div style="position: relative; display: flex; align-items: center;">
            <span style="position: absolute; left: 12px; font-weight: 700; color: #64748B; font-size: 0.88rem;">+91</span>
            <input type="tel" id="delivery-phone-input" placeholder="98290 12345" maxlength="10" style="padding-left: 48px; width: 100%; height: 40px; border: 1.5px solid #CBD5E1; border-radius: 8px; font-size: 15px; font-weight: 700; color: #0F172A; box-sizing: border-box; outline: none; background: #FFFFFF;">
          </div>
        </div>

        <!-- FIELD 2: DELIVERY CORRIDOR -->
        <div class="form-group-field" style="margin: 0;">
          <label for="delivery-corridor-select" style="font-size: 0.76rem; font-weight: 700; color: #334155; margin-bottom: 3px; display: block;">
            Select Sikar Delivery Area *
          </label>
          <select id="delivery-corridor-select" onchange="validateCheckoutAddressLocation()" style="width: 100%; height: 40px; padding: 0 10px; border: 1.5px solid #CBD5E1; border-radius: 8px; font-size: 14px; font-weight: 600; color: #0F172A; background: #FFFFFF; box-sizing: border-box; outline: none;">
            <option value="Piprali Road (Coaching Hub & Marriage Gardens)">Piprali Road (Coaching Hub &amp; Gardens)</option>
            <option value="Nawalgarh Road & Pullia Market">Nawalgarh Road &amp; Pullia Market</option>
            <option value="Station Road, Subhash Chowk & Krishi Mandi">Station Road, Subhash Chowk &amp; Krishi Mandi</option>
            <option value="Fatehpur Road & Sabalpura Corridor">Fatehpur Road &amp; Sabalpura Corridor</option>
            <option value="Rani Sati Road, Silver Jubilee & Collectorate">Rani Sati Road, Silver Jubilee &amp; Collectorate</option>
            <option value="Salasar Stand, Jaipur Road & Industrial Area">Salasar Stand, Jaipur Road &amp; Industrial Area</option>
          </select>
        </div>

        <!-- FIELD 3: STREET ADDRESS & LANDMARK -->
        <div class="form-group-field" style="margin: 0;">
          <label for="delivery-note-input" style="font-size: 0.76rem; font-weight: 700; color: #334155; margin-bottom: 3px; display: block;">
            Shop Name / Street Address / Landmark *
          </label>
          <input type="text" id="delivery-note-input" placeholder="e.g. Near Prince School, Piprali Road, Shop No. 4" oninput="validateCheckoutAddressLocation()" style="width: 100%; height: 40px; padding: 0 10px; border: 1.5px solid #CBD5E1; border-radius: 8px; font-size: 15px; font-weight: 600; color: #0F172A; box-sizing: border-box; outline: none; background: #FFFFFF;">
          <div id="checkout-area-quick-tags" style="display: none;"></div>
          <div id="checkout-location-check-status" style="margin-top: 4px; font-size: 0.74rem; font-weight: 600; color: #166534; display: flex; align-items: center; gap: 4px;">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 999px; background: #16A34A;"></span>
            <span>Verified Serviceable Area: Piprali Road &bull; Express Tempo</span>
          </div>
        </div>
      </div>

      <!-- PRIMARY ACTION BUTTON -->
      <button type="button" class="btn-checkout-gate" id="btn-confirm-dispatch-order" style="width: 100%; height: 44px; border-radius: 10px; font-size: 0.94rem; font-weight: 800; letter-spacing: 0.02em; display: flex; align-items: center; justify-content: center; gap: 8px; background: #0284C7; color: #FFFFFF; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);" onclick="dispatchFinalWhatsAppOrder()">
        <span>CONFIRM &amp; DISPATCH ORDER</span>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
      </button>
    </div>
  </div>`;

const SIKAR_CUSTOMER_PROFILE_MODAL_HTML = `
  <div class="modal-backdrop" id="customer-profile-modal" role="dialog" aria-modal="true" aria-labelledby="customer-profile-title" data-sikar-injected="1" style="display: none; align-items: center; justify-content: center; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); z-index: 10000; padding: 16px; backdrop-filter: blur(4px);">
    <div class="auth-modal-dialog" style="max-width: 480px; width: 100%; border-radius: 16px; overflow: hidden; background: #FFFFFF; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); border: 1px solid #CBD5E1; padding: 0; position: relative;">
      
      <!-- Profile Header -->
      <div style="background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%); color: #FFFFFF; padding: 22px 20px 18px; position: relative;">
        <button type="button" onclick="closeCustomerProfileModal()" aria-label="Close profile modal" style="position: absolute; top: 14px; right: 14px; background: rgba(255,255,255,0.2); border: none; width: 32px; height: 32px; border-radius: 50%; color: #FFFFFF; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div style="display: flex; align-items: center; gap: 14px;">
          <div id="profile-avatar-initials" style="width: 52px; height: 52px; border-radius: 50%; background: #FFFFFF; color: #0284C7; font-size: 1.35rem; font-weight: 800; display: flex; align-items: center; justify-content: center; border: 3px solid rgba(255,255,255,0.4); flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">C</div>
          <div style="overflow: hidden; flex: 1;">
            <h3 id="profile-header-name" style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #FFFFFF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Valued Customer</h3>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px; flex-wrap: wrap;">
              <span id="profile-header-phone" style="font-size: 0.88rem; font-weight: 700; color: #E0F2FE;">+91 98290 XXXXX</span>
              <span style="display: inline-flex; align-items: center; gap: 4px; background: #16A34A; color: #FFFFFF; font-size: 0.68rem; font-weight: 700; padding: 2px 7px; border-radius: 20px; letter-spacing: 0.02em;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>TRUECALLER SIM VERIFIED</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Live Order Statistics -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 14px 16px; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; text-align: center;">
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px 4px;">
          <div id="profile-stat-orders" style="font-size: 1.15rem; font-weight: 800; color: #0F172A;">0</div>
          <div style="font-size: 0.68rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Total Orders</div>
        </div>
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px 4px;">
          <div id="profile-stat-active" style="font-size: 1.15rem; font-weight: 800; color: #D97706;">0</div>
          <div style="font-size: 0.68rem; font-weight: 700; color: #64748B; text-transform: uppercase;">In Transit</div>
        </div>
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px 4px;">
          <div id="profile-stat-delivered" style="font-size: 1.15rem; font-weight: 800; color: #16A34A;">0</div>
          <div style="font-size: 0.68rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Delivered</div>
        </div>
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px 4px;">
          <div id="profile-stat-spend" style="font-size: 1.15rem; font-weight: 800; color: #0284C7;">₹0</div>
          <div style="font-size: 0.68rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Total Spent</div>
        </div>
      </div>

      <!-- Editable Details Form -->
      <div style="padding: 16px 20px 20px;">
        <form id="customer-profile-form" onsubmit="event.preventDefault(); handleSaveCustomerProfile();">
          <div style="margin-bottom: 12px; text-align: left;">
            <label for="profile-input-name" style="display: block; font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 4px; text-transform: uppercase;">Full Name / Firm Name</label>
            <input type="text" id="profile-input-name" required style="width: 100%; height: 40px; border-radius: 8px; border: 1.5px solid #CBD5E1; padding: 0 12px; font-weight: 600; font-size: 0.92rem; box-sizing: border-box; background: #FFFFFF; color: #0F172A;" />
          </div>

          <div style="margin-bottom: 12px; text-align: left;">
            <label for="profile-input-phone" style="display: block; font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 4px; text-transform: uppercase;">Verified Mobile (SIM Locked)</label>
            <input type="text" id="profile-input-phone" readonly style="width: 100%; height: 40px; border-radius: 8px; border: 1.5px solid #E2E8F0; background: #F1F5F9; color: #475569; padding: 0 12px; font-weight: 700; font-size: 0.92rem; box-sizing: border-box; cursor: not-allowed;" />
          </div>

          <div style="margin-bottom: 12px; text-align: left;">
            <label for="profile-input-corridor" style="display: block; font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 4px; text-transform: uppercase;">Preferred Mandi Delivery Corridor</label>
            <select id="profile-input-corridor" style="width: 100%; height: 40px; border-radius: 8px; border: 1.5px solid #CBD5E1; padding: 0 12px; font-weight: 600; font-size: 0.9rem; box-sizing: border-box; background: #FFFFFF; color: #0F172A;">
              <option value="Piprali Road Mandi">Piprali Road Mandi (Coaching &amp; Gardens Hub)</option>
              <option value="Nawalgarh Road">Nawalgarh Road &amp; Pulia Corridor</option>
              <option value="Station Road &amp; Krishi Mandi">Station Road &amp; Krishi Mandi Corridor</option>
              <option value="Fatehpur Road">Fatehpur Road &amp; Sabalpura Corridor</option>
              <option value="Rani Sati &amp; Silver Jubilee Road">Rani Sati &amp; Silver Jubilee Corridor</option>
              <option value="Jaipur Road &amp; RIICO">Jaipur Road &amp; RIICO Industrial Corridor</option>
            </select>
          </div>

          <div style="margin-bottom: 16px; text-align: left;">
            <label for="profile-input-address" style="display: block; font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 4px; text-transform: uppercase;">Delivery Address (Shop / Office / Residence)</label>
            <textarea id="profile-input-address" rows="2" style="width: 100%; border-radius: 8px; border: 1.5px solid #CBD5E1; padding: 8px 12px; font-weight: 600; font-size: 0.9rem; box-sizing: border-box; resize: vertical; background: #FFFFFF; color: #0F172A;" placeholder="Plot / Shop No., Landmark, Street, Sikar"></textarea>
          </div>

          <div style="display: flex; gap: 10px;">
            <button type="submit" id="btn-save-customer-profile" style="flex: 1; height: 42px; border-radius: 8px; background: #0284C7; color: #FFFFFF; font-weight: 700; font-size: 0.9rem; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);">
              <span>Save Changes</span>
            </button>
            <a href="/orders" onclick="closeCustomerProfileModal()" style="height: 42px; padding: 0 16px; border-radius: 8px; background: #F1F5F9; color: #0369A1; font-weight: 700; font-size: 0.9rem; border: 1.5px solid #CBD5E1; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <span>View Orders</span>
            </a>
          </div>
        </form>

        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.78rem; color: #64748B;">Customer ID: <strong id="profile-cust-id">CUST-LOAD</strong></span>
          <button type="button" onclick="closeCustomerProfileModal(); handleLogout();" style="background: none; border: none; color: #DC2626; font-size: 0.82rem; font-weight: 700; cursor: pointer; padding: 4px 6px;">
            Logout
          </button>
        </div>
      </div>
    </div>
  </div>`;

function ensureCheckoutModals() {
  if (!document.body) return;
  if (!document.getElementById('login-modal')) {
    const wrap = document.createElement('div');
    wrap.innerHTML = SIKAR_LOGIN_MODAL_HTML;
    const modal = wrap.firstElementChild;
    if (modal) document.body.appendChild(modal);
  }
  if (!document.getElementById('order-confirm-modal')) {
    const wrap = document.createElement('div');
    wrap.innerHTML = SIKAR_ORDER_CONFIRM_MODAL_HTML;
    const modal = wrap.firstElementChild;
    if (modal) document.body.appendChild(modal);
  }
  if (!document.getElementById('customer-profile-modal')) {
    const wrap = document.createElement('div');
    wrap.innerHTML = SIKAR_CUSTOMER_PROFILE_MODAL_HTML;
    const modal = wrap.firstElementChild;
    if (modal) document.body.appendChild(modal);
  }
}

// Canonical "user is signed in" check. Reads localStorage every time so a
// login performed on another page (or another tab) is always respected.
function getSignedInUser() {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('sikar_user') || 'null');
  } catch (e) {
    user = null;
  }
  if (!user || !user.phone) {
    try {
      const fallback = JSON.parse(sessionStorage.getItem('sikar_portal_operator') || 'null');
      if (fallback && fallback.phone) user = fallback;
    } catch (e) {}
  }
  if (user && user.phone) {
    window.currentUser = user;
    return user;
  }
  return null;
}

function dismissCartDrawers() {
  if (typeof toggleCartDrawer === 'function') {
    try { toggleCartDrawer(false); } catch (e) {}
  }
  document.querySelectorAll('.cart-drawer-side, .cart-drawer-panel').forEach(el => {
    el.classList.remove('open');
    el.style.right = '';
  });
  document.querySelectorAll('.drawer-backdrop, .cart-backdrop').forEach(el => {
    el.classList.remove('active');
    el.classList.remove('open');
  });
}

function proceedToCheckout() {
  const activeCart = (typeof cart !== 'undefined' && Object.keys(cart).length > 0)
    ? cart
    : JSON.parse(localStorage.getItem('sikar_cart') || '{}');
  const totalItems = Object.values(activeCart).reduce((a, b) => a + b, 0);
  if (totalItems === 0) {
    showToast('Cart is empty. Add water petis first.');
    return;
  }

  // Dismiss cart drawer immediately so it never hides the modal
  dismissCartDrawers();

  if (window.SikarAnalytics && typeof window.SikarAnalytics.trackCheckoutStart === 'function') {
    window.SikarAnalytics.trackCheckoutStart(totalItems, calculateSubtotal());
  }

  ensureCheckoutModals();

  // Login gate: signed-in users continue straight to the order step,
  // guests verify first and are then resumed automatically.
  if (!getSignedInUser()) {
    window.loginPurpose = 'checkout';
    if (typeof loginPurpose !== 'undefined') loginPurpose = 'checkout';
    openLoginModal('checkout');
    showToast('Please verify your mobile number to place the order.');
    return;
  }

  openOrderConfirmModal();
}

// Backwards-compatible alias used by the informational pages.
function initiateCheckoutGate() {
  return proceedToCheckout();
}

function openLoginModal(purpose = 'nav') {
  dismissCartDrawers();
  ensureCheckoutModals();
  window.loginPurpose = purpose;
  if (typeof loginPurpose !== 'undefined') loginPurpose = purpose;
  const modal = document.getElementById('login-modal');
  const tcMsg = document.getElementById('truecaller-polling-msg');
  const tcBtn = document.getElementById('btn-truecaller-1tap');
  const tcLabel = document.getElementById('btn-tc-label');
  const tcText = document.getElementById('tc-status-text');

  if (tcMsg) tcMsg.style.display = 'none';
  if (tcBtn) tcBtn.disabled = false;
  if (tcLabel) tcLabel.textContent = 'VERIFY WITH TRUECALLER';
  if (tcText) {
    tcText.textContent = 'Opening Truecaller... Please tap Continue inside app';
    tcText.style.color = '#1D4ED8';
  }
  if (sikarTcPollTimer) clearInterval(sikarTcPollTimer);
  if (modal) modal.classList.add('active');
}

function closeLoginModal() {
  const modal = document.getElementById('login-modal');
  if (sikarTcPollTimer) clearInterval(sikarTcPollTimer);
  if (modal) modal.classList.remove('active');
}

async function openCustomerProfileModal() {
  dismissCartDrawers();
  ensureCheckoutModals();
  const user = getSignedInUser();
  if (!user || !user.phone) {
    return openLoginModal('nav');
  }

  const modal = document.getElementById('customer-profile-modal');
  if (!modal) return;

  const phone = String(user.phone).replace(/\D/g, '').slice(-10);
  const name = user.name || 'Valued Customer';
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'C';

  const avEl = document.getElementById('profile-avatar-initials');
  const hnEl = document.getElementById('profile-header-name');
  const hpEl = document.getElementById('profile-header-phone');
  const inName = document.getElementById('profile-input-name');
  const inPhone = document.getElementById('profile-input-phone');
  const inCorr = document.getElementById('profile-input-corridor');
  const inAddr = document.getElementById('profile-input-address');
  const idEl = document.getElementById('profile-cust-id');

  if (avEl) avEl.textContent = initials;
  if (hnEl) hnEl.textContent = name;
  if (hpEl) hpEl.textContent = `+91 ${phone}`;
  if (inName) inName.value = name;
  if (inPhone) inPhone.value = `+91 ${phone}`;
  if (inCorr && user.corridor) inCorr.value = user.corridor;
  if (inAddr && user.address) inAddr.value = user.address;
  if (idEl) idEl.textContent = user.id || 'CUST-MEM';

  modal.style.display = 'flex';
  modal.classList.add('active');

  // Fetch real-time live customer profile & stats from server
  try {
    const token = user.token || '';
    const res = await fetch(`/api/customer/profile?phone=${encodeURIComponent(phone)}`, {
      headers: { 'x-truecaller-token': token }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.customer) {
        const c = data.customer;
        if (hnEl && c.name) hnEl.textContent = c.name;
        if (inName && c.name) inName.value = c.name;
        if (idEl && c.id) idEl.textContent = c.id;
        if (inCorr && c.corridor) inCorr.value = c.corridor;
        if (inAddr && c.address) inAddr.value = c.address;

        const stOrd = document.getElementById('profile-stat-orders');
        const stAct = document.getElementById('profile-stat-active');
        const stDel = document.getElementById('profile-stat-delivered');
        const stSpn = document.getElementById('profile-stat-spend');

        if (stOrd) stOrd.textContent = c.totalOrders || 0;
        if (stAct) stAct.textContent = c.activeOrders || 0;
        if (stDel) stDel.textContent = c.deliveredOrders || 0;
        if (stSpn) stSpn.textContent = `₹${Number(c.totalSpent || 0).toLocaleString('en-IN')}`;

        user.name = c.name || user.name;
        user.corridor = c.corridor || user.corridor;
        user.address = c.address || user.address;
        user.id = c.id || user.id;
        localStorage.setItem('sikar_user', JSON.stringify(user));
        window.currentUser = user;
      }
    }
  } catch (e) {
    console.warn('Customer profile fetch error:', e);
  }
}

function closeCustomerProfileModal() {
  const modal = document.getElementById('customer-profile-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
  }
}

async function handleSaveCustomerProfile() {
  const user = getSignedInUser();
  if (!user || !user.phone) return;

  const btn = document.getElementById('btn-save-customer-profile');
  const cleanPhone = String(user.phone).replace(/\D/g, '').slice(-10);
  const name = document.getElementById('profile-input-name')?.value.trim() || user.name;
  const corridor = document.getElementById('profile-input-corridor')?.value || 'Piprali Road Mandi';
  const address = document.getElementById('profile-input-address')?.value.trim() || '';

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving...';
  }

  try {
    const res = await fetch('/api/customer/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-truecaller-token': user.token || ''
      },
      body: JSON.stringify({
        phone: cleanPhone,
        name,
        corridor,
        address,
        token: user.token || ''
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update profile');

    user.name = name;
    user.corridor = corridor;
    user.address = address;
    localStorage.setItem('sikar_user', JSON.stringify(user));
    window.currentUser = user;

    showToast('Customer profile updated successfully.');
    closeCustomerProfileModal();
    if (typeof updateAuthNav === 'function') updateAuthNav();
    if (typeof renderOrdersState === 'function') renderOrdersState();
  } catch (err) {
    alert(err.message || 'Could not save profile');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  }
}

function setAuthBtnState(btn, text, disabled = false) {
  if (!btn) return;
  btn.disabled = disabled;
  const sp = btn.querySelector('#btn-tc-label') || btn.querySelector('#btn-login-label') || btn.querySelector('span');
  if (sp) {
    sp.textContent = text;
  } else {
    btn.textContent = text;
  }
}

let sikarTcPollTimer = null;

async function startTruecaller1TapFlow() {
  const tcBtn = document.getElementById('btn-truecaller-1tap');
  const tcLabel = document.getElementById('btn-tc-label');
  const tcMsg = document.getElementById('truecaller-polling-msg');
  const tcText = document.getElementById('tc-status-text');
  const phoneInput = document.getElementById('login-phone-input');
  const nameInput = document.getElementById('login-name-input');

  const rawPhone = phoneInput ? phoneInput.value.trim() : '';
  const cleanPhone = rawPhone.replace(/[^0-9]/g, '').slice(-10);

  if (!cleanPhone || cleanPhone.length !== 10) {
    if (phoneInput) {
      phoneInput.style.borderColor = '#EF4444';
      phoneInput.focus();
    }
    if (tcMsg) tcMsg.style.display = 'flex';
    if (tcText) {
      tcText.textContent = 'Please enter your 10-digit mobile number first.';
      tcText.style.color = '#DC2626';
    }
    if (typeof showToast === 'function') {
      showToast('Please enter your 10-digit mobile number first.');
    }
    return;
  }

  if (phoneInput) {
    phoneInput.style.borderColor = '#CBD5E1';
  }

  const enteredName = nameInput ? nameInput.value.trim() : '';

  try {
    if (tcBtn) tcBtn.disabled = true;
    if (tcLabel) tcLabel.textContent = 'CONNECTING TRUECALLER...';
    if (tcMsg) tcMsg.style.display = 'flex';
    if (tcText) {
      tcText.textContent = `Verifying if +91 ${cleanPhone} is active on this device...`;
      tcText.style.color = '#1D4ED8';
    }

    const initRes = await fetch('/api/truecaller/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cleanPhone, name: enteredName })
    });
    const initData = await initRes.json();

    if (!initRes.ok || !initData.deepLinkUrl) {
      throw new Error(initData.error || 'Failed to initialize Truecaller verification.');
    }

    const requestId = initData.requestId;
    try { sessionStorage.setItem('tc_pending_req', requestId); } catch (e) {}

    // Trigger Truecaller custom URI scheme deep link safely on Android
    if (/android/i.test(navigator.userAgent) && initData.deepLinkUrl) {
      try {
        window.location.href = initData.deepLinkUrl;
      } catch (e) {
        console.warn('Truecaller deep link redirect failed:', e);
      }
    } else if (!/android/i.test(navigator.userAgent)) {
      if (tcText) {
        tcText.textContent = 'Truecaller 1-Tap is optimized for Android phones with Truecaller. If on desktop, open on your mobile or confirm prompt on phone.';
        tcText.style.color = '#0284C7';
      }
    }

    let attempts = 0;
    const maxAttempts = 30; // ~18 seconds
    if (sikarTcPollTimer) clearInterval(sikarTcPollTimer);

    sikarTcPollTimer = setInterval(async () => {
      attempts++;
      try {
        const statusRes = await fetch(`/api/truecaller/status?requestId=${encodeURIComponent(requestId)}`);
        const statusData = await statusRes.json();

        // 1. Successful SIM Identity Verification
        if (statusRes.ok && statusData.verified && statusData.user) {
          clearInterval(sikarTcPollTimer);
          if (tcText) {
            tcText.textContent = `SIM Verified (+91 ${cleanPhone})! Logging in...`;
            tcText.style.color = '#16A34A';
          }
          handleAuthSuccess({ ...statusData.user, token: statusData.token }, 'Truecaller SIM Verified');
          return;
        }

        // 2. SIM Identity Mismatch Detected
        if (statusData && statusData.status === 'mismatch') {
          clearInterval(sikarTcPollTimer);
          if (tcBtn) tcBtn.disabled = false;
          if (tcLabel) tcLabel.textContent = 'MISMATCH - RETRY WITH DEVICE SIM';
          if (phoneInput) phoneInput.style.borderColor = '#EF4444';
          if (tcText) {
            tcText.textContent = statusData.error || `SIM Mismatch: Entered number (+91 ${cleanPhone}) does not match the active SIM in this device's Truecaller.`;
            tcText.style.color = '#DC2626';
          }
          if (typeof showToast === 'function') {
            showToast(`Mismatch: The number +91 ${cleanPhone} does not match this phone's SIM.`);
          }
          return;
        }

        // 3. User Rejected on Device
        if (statusData && statusData.status === 'rejected') {
          clearInterval(sikarTcPollTimer);
          if (tcBtn) tcBtn.disabled = false;
          if (tcLabel) tcLabel.textContent = 'VERIFY WITH TRUECALLER';
          if (tcText) {
            tcText.textContent = 'Truecaller prompt was dismissed. Please tap Verify again.';
            tcText.style.color = '#DC2626';
          }
          return;
        }
      } catch (e) {
        console.warn('Truecaller polling check:', e.message);
      }

      if (attempts >= maxAttempts) {
        clearInterval(sikarTcPollTimer);
        if (tcBtn) tcBtn.disabled = false;
        if (tcLabel) tcLabel.textContent = 'RETRY TRUECALLER VERIFICATION';
        if (tcText) {
          tcText.textContent = 'Truecaller did not confirm yet. Tap Retry or open Truecaller notification.';
          tcText.style.color = '#B91C1C';
        }
      }
    }, 600);
  } catch (err) {
    if (tcBtn) tcBtn.disabled = false;
    if (tcLabel) tcLabel.textContent = 'VERIFY WITH TRUECALLER';
    if (tcText) {
      tcText.textContent = err.message || 'Truecaller integration error. Please retry.';
      tcText.style.color = '#B91C1C';
    }
    if (typeof showToast === 'function') {
      showToast(err.message || 'Truecaller verification failed to launch. Please retry.');
    }
  }
}

function handleAuthSuccess(userData, method = 'Truecaller Verified') {
  const verifiedUser = {
    id: userData.id || ('CUST-' + Math.floor(1000 + Math.random() * 9000)),
    name: userData.name || 'Valued Customer',
    phone: String(userData.phone).replace(/[^0-9]/g, '').slice(-10),
    email: userData.email || 'client@sikardrop.in',
    channel: method,
    verified: true,
    verifiedBy: method,
    truecallerBadge: true,
    token: userData.token || ''
  };
  // Keep both the window property and any page-level binding in sync.
  window.currentUser = verifiedUser;
  currentUser = verifiedUser;
  localStorage.setItem('sikar_user', JSON.stringify(verifiedUser));

  const existingIdx = (typeof adminUsers !== 'undefined' && Array.isArray(adminUsers))
    ? adminUsers.findIndex(u => (u.phone && u.phone === currentUser.phone))
    : -1;
  if (existingIdx === -1 && typeof adminUsers !== 'undefined' && Array.isArray(adminUsers)) {
    adminUsers.unshift({
      name: currentUser.name,
      phone: currentUser.phone,
      email: currentUser.email,
      channel: method,
      loginTime: new Date().toLocaleDateString('en-IN') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      orders: 0
    });
    localStorage.setItem('sikar_admin_users', JSON.stringify(adminUsers));
  }

  if (typeof updateAuthNav === 'function') {
    updateAuthNav();
  }
  closeLoginModal();
  showToast(`Verified via Truecaller! Welcome, ${currentUser.name}.`);

  try {
    window.dispatchEvent(new CustomEvent('sikar_auth_changed', { detail: verifiedUser }));
  } catch (e) {}

  const purpose = window.loginPurpose || (typeof loginPurpose !== 'undefined' ? loginPurpose : 'nav');
  if (purpose === 'checkout') {
    // Resume the checkout exactly where the customer left off.
    ensureCheckoutModals();
    setTimeout(() => {
      try {
        if (typeof openOrderConfirmModal === 'function') openOrderConfirmModal();
      } catch (e) {
        console.warn('Checkout resume error:', e);
      }
    }, 60);
  } else if (purpose === 'orders') {
    if (typeof loadCustomerOrdersDirectly === 'function') {
      loadCustomerOrdersDirectly();
    }
  }
}

function handleLogout() {
  if (confirm('Are you sure you want to log out of your Sikar Drop account?')) {
    window.currentUser = null;
    currentUser = null;
    try {
      localStorage.removeItem('sikar_user');
      window.dispatchEvent(new CustomEvent('sikar_auth_changed', { detail: null }));
    } catch (e) {}
    if (typeof updateAuthNav === 'function') updateAuthNav();
    showToast('Logged out successfully.');
    if (typeof renderOrdersState === 'function') renderOrdersState();
  }
}

function updateAuthNav() {
  const user = (typeof getSignedInUser === 'function') ? getSignedInUser() : (window.currentUser || JSON.parse(localStorage.getItem('sikar_user') || 'null'));
  const slot = document.getElementById('auth-nav-slot');
  if (slot) {
    if (user && user.phone) {
      const displayName = user.name || 'Account';
      slot.innerHTML = `
        <button type="button" class="nav-icon-action-btn" onclick="openCustomerProfileModal()" title="Logged in as ${escapeHTML(displayName)} - Click to View Profile &amp; Orders" style="color:#0284C7; position:relative; display:inline-flex; align-items:center; justify-content:center; background:none; border:none; cursor:pointer;">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0 14c-5 0-9 2.5-9 5v1h18v-1c0-2.5-4-5-9-5z"/></svg>
          <span style="position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; background: #22C55E; border-radius: 50%; border: 1.5px solid #FFFFFF;"></span>
        </button>
      `;
    } else {
      slot.innerHTML = `
        <button type="button" class="nav-icon-action-btn" onclick="openLoginModal('nav')" title="Account / Login">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </button>
      `;
    }
  }

  const accBtn = document.getElementById('nav-btn-account');
  if (accBtn && !slot) {
    if (user && user.phone) {
      accBtn.onclick = () => { openCustomerProfileModal(); };
      accBtn.title = `Logged in as ${user.name || 'User'} - Customer Profile`;
      accBtn.style.color = '#0284C7';
    } else {
      accBtn.onclick = () => { openLoginModal('nav'); };
      accBtn.title = 'Account / Sign In';
      accBtn.style.color = '';
    }
  }
  try { if (typeof updateDrawerProfile === 'function') updateDrawerProfile(); } catch (e) {}
}

try {
  window.addEventListener('sikar_auth_changed', () => {
    try { updateAuthNav(); } catch (e) {}
    try { if (typeof updateDrawerProfile === 'function') updateDrawerProfile(); } catch (e) {}
  });
  const checkProfileUrl = () => {
    try {
      const p = (window.location.pathname || '').toLowerCase();
      const s = (window.location.search || '').toLowerCase();
      const h = (window.location.hash || '').toLowerCase();
      if (p.includes('profile') || s.includes('profile') || h.includes('profile')) {
        setTimeout(() => {
          if (typeof openCustomerProfileModal === 'function') {
            openCustomerProfileModal();
          }
        }, 350);
      }
    } catch (err) {}
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try { updateAuthNav(); } catch (e) {}
      checkProfileUrl();
    });
  } else {
    try { updateAuthNav(); } catch (e) {}
    checkProfileUrl();
  }
} catch (e) {}

// Global Aliases for Compatibility
// SECURITY: All aliases route to Truecaller. Old OTP-based names kept
// so any legacy HTML still referencing them does not break.
async function submitTruecallerVerification() { return startTruecaller1TapFlow(); }
async function submitLoginProcess()          { return startTruecaller1TapFlow(); }
async function requestWhatsAppOtp()          { return startTruecaller1TapFlow(); }
async function handleAuthAction()            { return startTruecaller1TapFlow(); }
async function handleOtpVerify()             { return startTruecaller1TapFlow(); } // legacy alias
async function handleOtpSend()               { return startTruecaller1TapFlow(); } // legacy alias

// Auto-check on return from Truecaller redirect
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('truecaller') === 'verified') {
      const reqId = params.get('requestId') || sessionStorage.getItem('tc_pending_req');
      if (reqId) {
        const res = await fetch(`/api/truecaller/status?requestId=${encodeURIComponent(reqId)}`);
        const data = await res.json();
        if (res.ok && data.verified && data.user) {
          handleAuthSuccess(data.user, 'Truecaller 1-Tap');
        }
      }
    }
  } catch (e) {}
});

window.SERVICEABLE_DELIVERY_ZONES = window.SERVICEABLE_DELIVERY_ZONES || JSON.parse(localStorage.getItem('sikar_delivery_zones')) || [
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
  const submitBtn = document.getElementById('btn-confirm-dispatch-order');
  if (!statusBox) return true;

  const selectedArea = sel ? sel.value.trim() : '';
  const typedAddress = noteInput ? noteInput.value.trim() : '';

  // 1. If typed address contains keywords matching an active zone, automatically sync dropdown
  if (typedAddress.length > 0) {
    const addrCheck = evaluateFrontendDeliveryMatch(typedAddress);
    if (addrCheck.available && addrCheck.zone) {
      if (sel && sel.value !== addrCheck.zone.area_name) {
        sel.value = addrCheck.zone.area_name;
      }
      statusBox.style.background = 'transparent';
      statusBox.style.border = 'none';
      statusBox.style.padding = '0';
      statusBox.style.color = '#166534';
      statusBox.innerHTML = `<span style="display:inline-block;width:6px;height:6px;border-radius:999px;background:#16A34A;margin-right:4px;"></span>Verified Sikar Area &bull; Express Tempo (${escapeHTML(addrCheck.zone.eta || '45-60 Mins')})`;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
      }
      return true;
    }
  }

  // 2. Validate selected corridor from dropdown
  const selCheck = evaluateFrontendDeliveryMatch(selectedArea);
  if (selCheck.available && selCheck.zone) {
    statusBox.style.background = '#F0FDF4';
    statusBox.style.border = '1px solid #BBF7D0';
    statusBox.style.borderRadius = '8px';
    statusBox.style.padding = '8px 12px';
    statusBox.style.color = '#166534';
    statusBox.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:#16A34A;margin-right:6px;flex-shrink:0;"></span><span>Verified Serviceable Area &bull; Express Tempo (${escapeHTML(selCheck.zone.eta || '45-60 Mins')})</span>`;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
    }
    return true;
  }

  // 3. If selected zone was paused by admin
  if (selCheck && selCheck.reason === 'paused_by_admin') {
    statusBox.style.background = '#FEF2F2';
    statusBox.style.border = '1px solid #FECACA';
    statusBox.style.borderRadius = '8px';
    statusBox.style.padding = '8px 12px';
    statusBox.style.color = '#DC2626';
    statusBox.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:#DC2626;margin-right:6px;flex-shrink:0;"></span><span>Delivery Temporarily Paused in this sector</span>`;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.45';
    }
    return false;
  }

  // Default fallback: allow delivery to Sikar corridor
  statusBox.style.background = '#F0FDF4';
  statusBox.style.border = '1px solid #BBF7D0';
  statusBox.style.borderRadius = '8px';
  statusBox.style.padding = '8px 12px';
  statusBox.style.color = '#166534';
  statusBox.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:#16A34A;margin-right:6px;flex-shrink:0;"></span><span>Delivery Area: <strong>${escapeHTML(selectedArea || 'Sikar Mandi Hub')}</strong> &bull; Express Tempo Ready (45-60 Mins)</span>`;
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
  }
  return true;
}

function openOrderConfirmModal() {
  dismissCartDrawers();
  ensureCheckoutModals();

  const signedIn = getSignedInUser();
  if (!signedIn || !signedIn.phone) {
    window.loginPurpose = 'checkout';
    if (typeof loginPurpose !== 'undefined') loginPurpose = 'checkout';
    openLoginModal('checkout');
    showToast('Please verify your mobile number to place the order.');
    return;
  }

  const modal = document.getElementById('order-confirm-modal');
  if (!modal) return;

  const totalPetis = Object.values(cart).reduce((a, b) => a + b, 0);
  const totalAmount = calculateSubtotal();

  const elName = document.getElementById('confirm-customer-name');
  const elPhone = document.getElementById('confirm-customer-phone');
  const elPetis = document.getElementById('confirm-total-petis');
  const elAmt = document.getElementById('confirm-total-amount');
  const delivPhoneInput = document.getElementById('delivery-phone-input');

  // Always resolve the signed-in customer from storage so the order screen
  // shows the right name/number no matter which page the flow started from.
  const loginPhoneVal = (signedIn && signedIn.phone) ? String(signedIn.phone).trim() : '';

  if (elName) elName.textContent = signedIn ? signedIn.name : 'Counter Guest';
  if (elPhone) elPhone.textContent = loginPhoneVal ? `+91 ${loginPhoneVal}` : '+91 98290 XXXXX';
  if (elPetis) elPetis.textContent = `${totalPetis} Petis / Cases`;
  if (elAmt) elAmt.textContent = `₹${totalAmount.toLocaleString('en-IN')}`;
  if (delivPhoneInput) {
    delivPhoneInput.value = loginPhoneVal.replace(/\D/g, '').slice(-10);
  }

  const sel = document.getElementById('delivery-corridor-select');
  const activeZones = (SERVICEABLE_DELIVERY_ZONES || []).filter(z => Number(z.serviceable) === 1);
  if (sel && activeZones.length > 0) {
    sel.innerHTML = activeZones.map(z => `<option value="${escapeHTML(z.area_name)}">${escapeHTML(z.area_name)}</option>`).join('');
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
        tagsDiv.style.display = 'none';
        wrap.appendChild(tagsDiv);

        const statusDiv = document.createElement('div');
        statusDiv.id = 'checkout-location-check-status';
        statusDiv.style.cssText = 'margin-top: 4px; font-size: 0.74rem; font-weight: 600; color: #166534; display: flex; align-items: center; gap: 4px;';
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

  // Validate address with selected corridor
  const isLocValid = validateCheckoutAddressLocation();
  if (!isLocValid) {
    showToast('Please select an active Sikar delivery corridor.');
    return;
  }

  const signedInUser = getSignedInUser();
  const loginPhoneVal = (signedInUser && signedInUser.phone)
    ? String(signedInUser.phone).trim()
    : (document.getElementById('login-phone-input')?.value.trim() || '');
  const delivPhoneInput = document.getElementById('delivery-phone-input');
  const deliveryPhoneVal = (delivPhoneInput && delivPhoneInput.value.trim()) ? delivPhoneInput.value.trim() : loginPhoneVal;

  // Use active memory cart or localStorage fallback
  const activeCart = (typeof cart !== 'undefined' && Object.keys(cart).length > 0)
    ? cart
    : JSON.parse(localStorage.getItem('sikar_cart') || '{}');

  const items = [];
  for (const [id, qty] of Object.entries(activeCart)) {
    const prod = getCatalogOrBundleItem(id);
    if (prod && qty > 0) {
      items.push({ productId: prod.id, title: prod.title, quantity: qty, price: prod.price });
    }
  }

  if (items.length === 0) {
    showToast('Cart is empty. Please add items to cart.');
    return;
  }

  const total = items.reduce((a, b) => a + (b.price * b.quantity), 0);
  const fullAddress = addressNote ? `${addressNote}, ${corridor}` : corridor;
  const couponCode = (typeof appliedCoupon !== 'undefined' && appliedCoupon && appliedCoupon.code) ? appliedCoupon.code : '';

  const btn = document.getElementById('btn-confirm-dispatch-order');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>DISPATCHING ORDER...</span>';
  }

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: signedInUser ? signedInUser.name : 'Valued Customer',
        customerPhone: loginPhoneVal,
        loginPhone: loginPhoneVal,
        deliveryPhone: deliveryPhoneVal,
        corridor,
        deliveryAddress: fullAddress,
        items,
        couponCode,
        notes: addressNote,
        attribution: window.SikarAnalytics && typeof window.SikarAnalytics.getAttributionPayload === 'function'
          ? window.SikarAnalytics.getAttributionPayload()
          : {}
      })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      // The server is the single source of truth for the order ID and totals.
      const orderId = data.orderId || (data.order && data.order.orderId) || '';
      const finalTotal = Number(data.total || (data.order && data.order.total) || total);

      if (window.SikarAnalytics && typeof window.SikarAnalytics.trackPurchase === 'function') {
        window.SikarAnalytics.trackPurchase(orderId, finalTotal);
      }

      // Clear Cart across all references
      cart = {};
      window.cart = {};
      localStorage.removeItem('sikar_cart');
      updateCartUI();
      closeOrderConfirmModal();
      toggleCartDrawer(false);

      // Persist order to customer order history for live tracking
      try {
        const cleanPhone = String(loginPhoneVal || deliveryPhoneVal || (signedInUser && signedInUser.phone) || '').replace(/\D/g, '').slice(-10);
        localStorage.setItem('sikar_last_order_id', orderId);
        if (cleanPhone) localStorage.setItem('sikar_last_order_phone', cleanPhone);
        const myOrders = JSON.parse(localStorage.getItem('sikar_my_orders') || '[]');
        myOrders.unshift({
          id: orderId,
          phone: cleanPhone,
          customerName: signedInUser ? signedInUser.name : 'Valued Customer',
          total: finalTotal,
          corridor: corridor,
          date: new Date().toISOString(),
          status: 'pending',
          itemsDesc: items.map(it => `${it.quantity || 1}x ${it.title}`).join(', ')
        });
        localStorage.setItem('sikar_my_orders', JSON.stringify(myOrders.slice(0, 20)));
      } catch (e) {}

      // Resolve depot WhatsApp number with fallback to real helpline
      const rawDepotWa = (SITE_TEXTS && (SITE_TEXTS.whatsappNumber || SITE_TEXTS.whatsapp)) || (JSON.parse(localStorage.getItem('sikar_admin_texts') || '{}').whatsappNumber) || '919829011223';
      let cleanDepotDigits = String(rawDepotWa).replace(/\D/g, '');
      if (cleanDepotDigits === '919829011223' || cleanDepotDigits === '919829012345' || !cleanDepotDigits) {
        cleanDepotDigits = '919829011223';
      }
      const depotPhone = cleanDepotDigits.length === 10 ? ('91' + cleanDepotDigits) : cleanDepotDigits;
      const itemsList = items.map(i => `• ${i.title} x ${i.quantity} = Rs.${i.price * i.quantity}`).join('\n');
      const normL = loginPhoneVal.replace(/\D/g, '').slice(-10);
      const normD = deliveryPhoneVal.replace(/\D/g, '').slice(-10);
      const phoneLines = (normL && normD && normL !== normD)
        ? `Login Phone: ${loginPhoneVal}\nAddress Phone: ${deliveryPhoneVal}`
        : `Phone: ${loginPhoneVal}`;

      const msg = `*NEW SIKAR DROP BILTY DISPATCH*\nOrder ID: ${orderId}\nCustomer: ${signedInUser ? signedInUser.name : 'Customer'}\n${phoneLines}\nCorridor: ${corridor}\nAddress: ${fullAddress}\n\n*Items Ordered:*\n${itemsList}\n\n*Total Amount:* Rs.${finalTotal}\n*Camper Notice:* 100% Factory Sealed Cases Only.`;

      const waUrl = `https://wa.me/${depotPhone}?text=${encodeURIComponent(msg)}`;
      const cleanPhone = String(loginPhoneVal || deliveryPhoneVal || (signedInUser && signedInUser.phone) || '').replace(/\D/g, '').slice(-10);

      // Show high-converting on-screen Order Success Modal
      showOrderSuccessModal({
        orderId,
        customerName: signedInUser ? signedInUser.name : 'Valued Customer',
        phone: loginPhoneVal || deliveryPhoneVal,
        corridor,
        fullAddress,
        totalAmount: finalTotal,
        waUrl,
        cleanCustPhone: cleanPhone
      });
    } else {
      showToast(data.error || 'Failed to place order. Please try again.');
    }
  } catch (e) {
    console.error('Order creation error:', e);
    showToast('Failed to record order: ' + e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>CONFIRM &amp; DISPATCH ORDER</span>';
    }
  }
}

function showOrderSuccessModal({ orderId, customerName, phone, corridor, fullAddress, totalAmount, waUrl, cleanCustPhone }) {
  const existing = document.getElementById('order-success-modal');
  if (existing) existing.remove();

  const targetTrackUrl = `/track?id=${encodeURIComponent(orderId)}${cleanCustPhone ? `&phone=${encodeURIComponent(cleanCustPhone)}` : ''}`;

  const modal = document.createElement('div');
  modal.id = 'order-success-modal';
  modal.className = 'modal-backdrop active';
  modal.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.75); backdrop-filter:blur(4px); z-index:100005; display:flex; align-items:center; justify-content:center; padding:16px; box-sizing:border-box; animation:fadeInModal 0.25s ease-out;';

  modal.innerHTML = `
    <div style="background:#FFFFFF; border-radius:20px; width:100%; max-width:440px; padding:24px 20px; box-shadow:0 25px 60px rgba(11,25,44,0.35); text-align:center; border:1px solid rgba(15,23,42,0.08); position:relative; box-sizing:border-box;">
      <button type="button" onclick="document.getElementById('order-success-modal').remove(); window.location.href='${targetTrackUrl}';" style="position:absolute; top:14px; right:14px; background:none; border:none; color:#64748B; cursor:pointer; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center;" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>

      <div style="width:58px; height:58px; border-radius:50%; background:#DCFCE7; color:#16A34A; margin:0 auto 12px; display:flex; align-items:center; justify-content:center;">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>

      <h3 style="font-family:var(--font-heading, sans-serif); font-size:1.35rem; font-weight:800; color:#0B192C; margin:0 0 4px;">Order Confirmed!</h3>
      <p style="font-size:0.82rem; color:#64748B; margin:0 0 14px;">Tempo dispatch booked from Sikar Depot (45-60 Mins)</p>

      <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:12px 14px; text-align:left; margin-bottom:14px; font-size:0.84rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; padding-bottom:6px; border-bottom:1px dashed #CBD5E1;">
          <span style="font-weight:700; color:#64748B;">Bilty / Order ID:</span>
          <strong style="color:#0284C7; font-family:monospace; font-size:1rem;">#${escapeHTML(orderId)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span style="color:#64748B;">Customer:</span>
          <strong style="color:#0F172A;">${escapeHTML(customerName)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span style="color:#64748B;">Delivery Area:</span>
          <span style="color:#0F172A; font-weight:600;">${escapeHTML(corridor)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:6px; padding-top:6px; border-top:1px dashed #CBD5E1;">
          <span style="font-weight:700; color:#0F172A;">Total Amount:</span>
          <strong style="color:#0284C7; font-size:1.05rem;">₹${Number(totalAmount).toLocaleString('en-IN')}</strong>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:8px;">
        <a href="${targetTrackUrl}" class="btn-checkout-gate" style="width:100%; height:44px; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px; background:#0284C7; color:#FFFFFF; font-weight:800; border-radius:10px; font-size:0.92rem; box-sizing:border-box;">
          <span>TRACK LIVE TEMPO DISPATCH</span>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </a>

        <a href="${escapeHTML(waUrl)}" target="_blank" rel="noopener" style="width:100%; height:42px; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px; background:#16A34A; color:#FFFFFF; font-weight:800; border-radius:10px; font-size:0.88rem; box-sizing:border-box;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
          <span>OPEN WHATSAPP BILTY</span>
        </a>

        <div style="font-size:0.76rem; color:#64748B; margin-top:4px;">
          Redirecting to live tracking in <span id="success-countdown-seconds">4</span>s...
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  let timeLeft = 4;
  const countEl = document.getElementById('success-countdown-seconds');
  const timer = setInterval(() => {
    timeLeft--;
    if (countEl) countEl.textContent = String(timeLeft);
    if (timeLeft <= 0) {
      clearInterval(timer);
      window.location.href = targetTrackUrl;
    }
  }, 1000);
}

// 4. GLOBAL ESCAPE LISTENER
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLoginModal();
    closeOrderConfirmModal();
    toggleCartDrawer(false);
    toggleMobileMenu(false);
  }
});

// 5. SEO SETTINGS (keeps admin branding in sync on static deployments)
function upsertSeoMeta(selector, attribute, name, content) {
  if (!content) return;
  let tag = document.querySelector(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function applySeoSettings(seo) {
  if (!seo || typeof seo !== 'object') return;
  const isHome = location.pathname === '/' || /\/index\.html$/i.test(location.pathname);
  const title = seo.title || seo.pageTitle;
  const description = seo.desc || seo.description;
  const keywords = seo.keywords;
  const brandName = seo.brandName || seo.brand_name;
  const tagline = seo.tagline;

  if (isHome) {
    if (title) document.title = title;
    if (description) upsertSeoMeta('meta[name="description"]', 'name', 'description', description);
    if (keywords) upsertSeoMeta('meta[name="keywords"]', 'name', 'keywords', keywords);
    if (title) {
      upsertSeoMeta('meta[property="og:title"]', 'property', 'og:title', title);
      upsertSeoMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    }
    if (description) {
      upsertSeoMeta('meta[property="og:description"]', 'property', 'og:description', description);
      upsertSeoMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    }
  }

  if (brandName) {
    upsertSeoMeta('meta[property="og:site_name"]', 'property', 'og:site_name', brandName);
  }

  // CMS brand tagline takes priority when it has a value. SEO tagline is the fallback.
  let cmsTagline = '';
  try {
    const texts = window.SITE_TEXTS || JSON.parse(localStorage.getItem('sikar_admin_texts') || 'null');
    if (texts) cmsTagline = texts.brandTagline || texts.brand_tagline || '';
  } catch (err) {}
  if (tagline && !cmsTagline) {
    const el = document.getElementById('live-brand-tagline');
    if (el) el.textContent = tagline;
  }
}

async function loadSeoSettingsFromBackend() {
  try {
    const cached = JSON.parse(localStorage.getItem('sikar_admin_seo') || 'null');
    if (cached && typeof cached === 'object' && cached.isCustom !== false) applySeoSettings(cached);
  } catch (err) {}

  try {
    const res = await fetch('/api/seo-settings', { cache: 'no-store' });
    if (!res.ok) return;
    const seo = await res.json();
    if (seo && seo.isCustom) applySeoSettings(seo);
  } catch (err) {}
}

// 6. AUTO-INITIALIZE THEME, CMS SITE TEXTS & SEO
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureCheckoutModals();
      initStorefrontTheme();
      loadSiteTextsFromBackend();
      loadSeoSettingsFromBackend();
      ensureMobileMenuElements();
    });
  } else {
    ensureCheckoutModals();
    initStorefrontTheme();
    loadSiteTextsFromBackend();
    loadSeoSettingsFromBackend();
    ensureMobileMenuElements();
  }
}

// ==========================================
// 6. SIKAR ATTRIBUTION & ANALYTICS CLIENT ENGINE
// ==========================================
(function() {
  if (typeof window === 'undefined') return;

  // Initialize or retrieve anonymous visitor ID (persisted across sessions)
  let vid = localStorage.getItem('sikar_vid');
  if (!vid) {
    vid = 'vis_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    try { localStorage.setItem('sikar_vid', vid); } catch (e) {}
  }

  // Initialize or retrieve session ID (per tab/browser session)
  let sid = sessionStorage.getItem('sikar_sid');
  if (!sid) {
    sid = 'sess_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    try { sessionStorage.setItem('sikar_sid', sid); } catch (e) {}
  }

  // Helper to extract UTM parameters and detect source/platform
  function parseCampaignAttribution() {
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = (urlParams.get('utm_source') || '').trim();
    const utmMedium = (urlParams.get('utm_medium') || '').trim();
    const utmCampaign = (urlParams.get('utm_campaign') || '').trim();
    const utmContent = (urlParams.get('utm_content') || '').trim();
    const utmTerm = (urlParams.get('utm_term') || '').trim();

    // Check referrer
    const ref = (document.referrer || '').toLowerCase();
    let detectedPlatform = 'direct';
    let defaultMedium = 'organic';

    if (ref.includes('instagram.com') || ref.includes('l.instagram.com')) {
      detectedPlatform = 'instagram';
      defaultMedium = 'social';
    } else if (ref.includes('facebook.com') || ref.includes('l.facebook.com') || ref.includes('fb.com')) {
      detectedPlatform = 'facebook';
      defaultMedium = 'social';
    } else if (ref.includes('whatsapp.com') || ref.includes('wa.me')) {
      detectedPlatform = 'whatsapp';
      defaultMedium = 'chat';
    } else if (ref.includes('youtube.com') || ref.includes('youtu.be')) {
      detectedPlatform = 'youtube';
      defaultMedium = 'video';
    } else if (ref.includes('google.com') || ref.includes('google.co.in')) {
      detectedPlatform = 'google';
      defaultMedium = 'search';
    }

    if (utmSource) {
      detectedPlatform = utmSource.toLowerCase();
    }

    // If new UTM campaign parameters are found in URL, save into session & 30-day localStorage window
    if (utmSource || utmCampaign) {
      const attributionObj = {
        platform: detectedPlatform,
        utm_source: utmSource || detectedPlatform,
        utm_medium: utmMedium || defaultMedium,
        utm_campaign: utmCampaign || `organic_${detectedPlatform}`,
        utm_content: utmContent,
        utm_term: utmTerm,
        timestamp: Date.now()
      };
      try {
        sessionStorage.setItem('sikar_current_attribution', JSON.stringify(attributionObj));
        localStorage.setItem('sikar_last_touch_attribution', JSON.stringify(attributionObj));
      } catch (e) {}
      return attributionObj;
    }

    // Check current session attribution
    try {
      const sessAttr = JSON.parse(sessionStorage.getItem('sikar_current_attribution') || 'null');
      if (sessAttr) return sessAttr;
    } catch (e) {}

    // Check 30-day Last-Touch attribution from localStorage (30 days = 30 * 86400 * 1000 ms)
    try {
      const lastTouch = JSON.parse(localStorage.getItem('sikar_last_touch_attribution') || 'null');
      if (lastTouch && (Date.now() - (lastTouch.timestamp || 0) < 30 * 86400 * 1000)) {
        return lastTouch;
      }
    } catch (e) {}

    // Direct / organic fallback
    return {
      platform: detectedPlatform,
      utm_source: detectedPlatform,
      utm_medium: defaultMedium,
      utm_campaign: '',
      utm_content: '',
      utm_term: '',
      timestamp: Date.now()
    };
  }

  const currentAttribution = parseCampaignAttribution();

  window.SikarAnalytics = {
    visitorId: vid,
    sessionId: sid,
    attribution: currentAttribution,

    getAttributionPayload() {
      return {
        utm_source: currentAttribution.utm_source || currentAttribution.platform || 'direct',
        utm_medium: currentAttribution.utm_medium || 'organic',
        utm_campaign: currentAttribution.utm_campaign || '',
        utm_content: currentAttribution.utm_content || '',
        utm_term: currentAttribution.utm_term || '',
        platform: currentAttribution.platform || 'direct',
        sessionId: sid,
        visitorId: vid
      };
    },

    track(actionType, extra = {}) {
      try {
        const payload = {
          actionType: actionType || 'click_button',
          platform: extra.platform || currentAttribution.platform || 'direct',
          sourcePage: extra.sourcePage || window.location.pathname || '/index.html',
          sessionId: sid,
          visitorId: vid,
          utmSource: currentAttribution.utm_source || '',
          utmMedium: currentAttribution.utm_medium || '',
          utmCampaign: currentAttribution.utm_campaign || '',
          utmContent: currentAttribution.utm_content || '',
          utmTerm: currentAttribution.utm_term || '',
          referrer: document.referrer || '',
          orderId: extra.orderId || '',
          orderValue: Number(extra.orderValue || 0),
          metadata: extra.metadata || {}
        };

        fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {});
      } catch (err) {}
    },

    trackPageView(page) {
      this.track('page_view', { sourcePage: page || window.location.pathname });
    },

    trackProductView(productId, title) {
      this.track('product_view', {
        sourcePage: window.location.pathname,
        metadata: { productId, title }
      });
    },

    trackAddToCart(productId, qty) {
      this.track('add_to_cart', {
        sourcePage: window.location.pathname,
        metadata: { productId, qty }
      });
    },

    trackCheckoutStart(itemsCount, total) {
      this.track('checkout_start', {
        sourcePage: window.location.pathname,
        orderValue: total,
        metadata: { itemsCount }
      });
    },

    trackPurchase(orderId, total) {
      this.track('purchase_complete', {
        sourcePage: window.location.pathname,
        orderId,
        orderValue: total
      });
    },

    trackOutboundClick(platform) {
      this.track('click_button', {
        platform: platform || 'whatsapp',
        sourcePage: window.location.pathname
      });
    }
  };

  // Automatically track page view on document load
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    window.SikarAnalytics.trackPageView();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      window.SikarAnalytics.trackPageView();
    });
  }

  // Intercept clicks on outbound social/contact buttons
  document.addEventListener('click', (e) => {
    const target = e.target && e.target.closest('a, button');
    if (!target) return;
    const href = target.getAttribute('href') || '';
    if (href.startsWith('https://wa.me') || href.includes('whatsapp.com')) {
      window.SikarAnalytics.trackOutboundClick('whatsapp');
    } else if (href.includes('instagram.com')) {
      window.SikarAnalytics.trackOutboundClick('instagram');
    } else if (href.includes('facebook.com')) {
      window.SikarAnalytics.trackOutboundClick('facebook');
    } else if (href.includes('youtube.com')) {
      window.SikarAnalytics.trackOutboundClick('youtube');
    } else if (href.startsWith('tel:')) {
      window.SikarAnalytics.trackOutboundClick('phone');
    }
  });
})();

// ==========================================================================
// 10. EXPANDED SPOTLIGHT SEARCH MODAL ENGINE ("BADA SEARCH SYSTEM")
// ==========================================================================
(function() {
  function ensureSearchModalHTML() {
    if (document.getElementById('global-search-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'global-search-modal-overlay';
    overlay.className = 'global-search-overlay';
    overlay.style.display = 'none';
    overlay.onclick = function(e) {
      if (e.target === overlay) {
        window.closeGlobalSearchModal();
      }
    };

    overlay.innerHTML = `
      <div class="global-search-container" id="global-search-container" onclick="event.stopPropagation()">
        <!-- Header with Input -->
        <div class="search-modal-header">
          <button type="button" class="search-modal-back-btn" onclick="window.closeGlobalSearchModal()" title="Back / Close" aria-label="Back">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.3">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>

          <div class="search-modal-input-wrap">
            <svg class="search-modal-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="modal-search-input" class="modal-search-input" placeholder="Search water peti, brand (Bisleri, Kinley), cold drink, juice..." autocomplete="off" spellcheck="false">
            <button type="button" id="modal-search-clear-btn" class="modal-search-clear-btn" style="display:none;" onclick="window.clearModalSearch()" title="Clear search" aria-label="Clear Search">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <button type="button" class="search-modal-close-desktop-btn" onclick="window.closeGlobalSearchModal()" title="Close Search (Esc)">
            <span class="esc-kbd">ESC</span>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Trending Search Chips -->
        <div class="search-modal-chips-bar">
          <span class="search-chips-label">Popular in Sikar:</span>
          <div class="search-chips-scroll">
            <button type="button" class="search-chip-pill" onclick="window.applyModalSearchChip('Bisleri 1L')">Bisleri 1L Peti</button>
            <button type="button" class="search-chip-pill" onclick="window.applyModalSearchChip('Kinley 1L')">Kinley 1L Case</button>
            <button type="button" class="search-chip-pill" onclick="window.applyModalSearchChip('250ml')">250ml Wedding Peti</button>
            <button type="button" class="search-chip-pill" onclick="window.applyModalSearchChip('Coca-Cola')">Coca-Cola Peti</button>
            <button type="button" class="search-chip-pill" onclick="window.applyModalSearchChip('Limca')">Limca 300ml Crate</button>
            <button type="button" class="search-chip-pill" onclick="window.applyModalSearchChip('Thums Up')">Thums Up Peti</button>
            <button type="button" class="search-chip-pill" onclick="window.applyModalSearchChip('Real')">Real Fruit Juice</button>
            <button type="button" class="search-chip-pill" onclick="window.applyModalSearchChip('Soda')">Club Soda Crate</button>
            <button type="button" class="search-chip-pill" onclick="window.applyModalSearchChip('wedding')">Shaadi Vivah Bundle</button>
            <button type="button" class="search-chip-pill" onclick="window.applyModalSearchChip('Aquafina')">Aquafina 500ml</button>
          </div>
        </div>

        <!-- Results Body -->
        <div class="search-modal-results-body" id="modal-search-results-body"></div>

        <!-- Footer -->
        <div class="search-modal-footer">
          <div class="search-modal-footer-stats">
            <span>Instant Sikar Mandi Delivery (40 Mins)</span>
            <span>•</span>
            <span>100% Factory Sealed Cases</span>
          </div>
          <button type="button" class="search-modal-view-catalog-btn" onclick="window.viewAllResultsInCatalog()">
            <span>View in Catalog</span>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = document.getElementById('modal-search-input');
    if (input) {
      input.addEventListener('input', function() {
        window.handleModalSearchInput(this.value);
      });
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          window.viewAllResultsInCatalog();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          window.closeGlobalSearchModal();
        }
      });
    }
  }

  window.openGlobalSearchModal = function(initialVal) {
    ensureSearchModalHTML();
    const overlay = document.getElementById('global-search-modal-overlay');
    const input = document.getElementById('modal-search-input');
    if (!overlay || !input) return;

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const val = (initialVal !== undefined && initialVal !== null) ? String(initialVal).trim() : '';
    input.value = val;
    window.handleModalSearchInput(val);

    setTimeout(() => {
      input.focus();
      if (val) input.setSelectionRange(val.length, val.length);
    }, 60);
  };

  window.closeGlobalSearchModal = function() {
    const overlay = document.getElementById('global-search-modal-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  };

  window.clearModalSearch = function() {
    const input = document.getElementById('modal-search-input');
    if (input) {
      input.value = '';
      input.focus();
    }
    window.handleModalSearchInput('');
  };

  window.applyModalSearchChip = function(text) {
    const input = document.getElementById('modal-search-input');
    if (input) {
      input.value = text;
      input.focus();
    }
    document.querySelectorAll('.search-chip-pill').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.toLowerCase().includes(text.toLowerCase()));
    });
    window.handleModalSearchInput(text);
  };

  window.handleModalSearchInput = function(val) {
    const query = String(val || '').trim();
    const clearBtn = document.getElementById('modal-search-clear-btn');
    if (clearBtn) clearBtn.style.display = query ? 'inline-flex' : 'none';

    renderModalResults(query);
  };

  function getAvailableCatalog() {
    let prods = [];
    if (typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS) && PRODUCTS.length > 0) {
      prods = PRODUCTS;
    } else if (window.PRODUCTS && Array.isArray(window.PRODUCTS) && window.PRODUCTS.length > 0) {
      prods = window.PRODUCTS;
    } else {
      prods = JSON.parse(localStorage.getItem('sikar_admin_products') || '[]');
    }

    let bundles = [];
    if (typeof WHOLESALE_BUNDLES !== 'undefined' && Array.isArray(WHOLESALE_BUNDLES) && WHOLESALE_BUNDLES.length > 0) {
      bundles = WHOLESALE_BUNDLES;
    } else {
      bundles = JSON.parse(localStorage.getItem('sikar_admin_bundles') || '[]');
    }

    return { prods, bundles };
  }

  function scoreSearchItem(item, query, isBundle) {
    if (!query) return 1;
    const q = query.toLowerCase();
    const title = (item.title || '').toLowerCase();
    const spec = (item.spec || item.desc || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();
    const sku = (item.sku || '').toLowerCase();
    const desc = (item.description || item.desc || '').toLowerCase();
    const combined = `${title} ${spec} ${cat} ${sku} ${desc}`;

    if (title === q) return 100;
    if (title.startsWith(q)) return 85;
    if (title.includes(q)) return 70;
    if (combined.includes(q)) return 55;

    const tokens = q.split(/\s+/).filter(Boolean);
    let score = 0;
    let matchedCount = 0;

    for (const t of tokens) {
      let matched = false;
      if (combined.includes(t)) {
        matched = true;
        score += 15;
        if (title.includes(t)) score += 10;
      } else {
        if (!isNaN(t) && combined.includes(t + 'ml')) { matched = true; score += 12; }
        else if (!isNaN(t) && (combined.includes(t + 'l') || combined.includes(t + ' liter'))) { matched = true; score += 12; }
        else if (t.endsWith('l') && combined.includes(t.replace('l', ' liter'))) { matched = true; score += 12; }
        else if (t === 'pani' || t === 'paani' || t === 'water') {
          if (combined.includes('water') || combined.includes('bisleri') || combined.includes('kinley') || combined.includes('aquafina')) { matched = true; score += 12; }
        } else if (t === 'peti' || t === 'case' || t === 'crate' || t === 'box') {
          if (combined.includes('case') || combined.includes('peti') || combined.includes('crate') || combined.includes('shrink')) { matched = true; score += 12; }
        } else if (t === 'cold' || t === 'drink' || t === 'colddrink' || t === 'cola') {
          if (combined.includes('cola') || combined.includes('drink') || combined.includes('soft') || combined.includes('thums') || combined.includes('sprite')) { matched = true; score += 12; }
        } else if (t === 'shadi' || t === 'vivah' || t === 'shaadi' || t === 'marriage' || t === 'banquet') {
          if (combined.includes('wedding') || combined.includes('shaadi') || combined.includes('vivah') || combined.includes('banquet') || isBundle) { matched = true; score += 20; }
        } else if (t === 'hostel' || t === 'pg' || t === 'coaching') {
          if (combined.includes('hostel') || combined.includes('pg') || combined.includes('coaching') || isBundle) { matched = true; score += 20; }
        } else if (t === 'bislery' || t === 'bisleri') {
          if (combined.includes('bisleri')) { matched = true; score += 15; }
        } else if (t === 'kinly' || t === 'kinley') {
          if (combined.includes('kinley')) { matched = true; score += 15; }
        } else if (t === 'juice' || t === 'frooti') {
          if (combined.includes('juice') || combined.includes('mango') || combined.includes('tetra')) { matched = true; score += 12; }
        }
      }

      if (matched) matchedCount++;
    }

    if (matchedCount === tokens.length) return score;
    if (matchedCount > 0) return score * (matchedCount / tokens.length);
    return 0;
  }

  function highlightTerms(text, query) {
    if (!text) return '';
    const cleanText = String(text);
    if (!query) return cleanText;
    const tokens = String(query).trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return cleanText;
    let res = cleanText;
    tokens.forEach(tok => {
      const regTok = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (regTok.length > 1) {
        const regex = new RegExp(`(${regTok})`, 'gi');
        res = res.replace(regex, '<mark style="background:#FEF08A; color:#854D0E; font-weight:700; padding:0 2px; border-radius:2px;">$1</mark>');
      }
    });
    return res;
  }

  function renderModalResults(query) {
    const container = document.getElementById('modal-search-results-body');
    if (!container) return;

    const { prods, bundles } = getAvailableCatalog();
    const currentCart = JSON.parse(localStorage.getItem('sikar_cart') || '{}');

    // 1. Initial State: No query typed -> Show Trending Wholesale Products
    if (!query) {
      const popular = prods.slice(0, 6);
      container.innerHTML = `
        <div class="search-results-meta-header">
          <span>Top Trending Wholesale Cases & Petis in Sikar</span>
          <span class="search-results-meta-badge">Direct Mandi Depot</span>
        </div>
        ${popular.map(p => renderSearchResultItem(p, '', currentCart, false)).join('')}
      `;
      return;
    }

    // 2. Query typed -> Match bundles & products
    const matchedBundles = bundles
      .map(b => ({ item: b, score: scoreSearchItem(b, query, true), isBundle: true }))
      .filter(x => x.score > 0);

    const matchedProds = prods
      .map(p => ({ item: p, score: scoreSearchItem(p, query, false), isBundle: false }))
      .filter(x => x.score > 0);

    const allMatches = [...matchedBundles, ...matchedProds].sort((a, b) => b.score - a.score);

    if (allMatches.length === 0) {
      container.innerHTML = `
        <div class="search-modal-empty">
          <svg class="search-modal-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
          <div class="search-modal-empty-title">No wholesale beverage found for "${query}"</div>
          <div class="search-modal-empty-desc">
            Check the spelling or try searching by popular brand (Bisleri, Kinley, Coca-Cola), bottle size (250ml, 1L, 2L), or wholesale peti.
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:6px; justify-content:center;">
            <button type="button" class="search-chip-pill" onclick="window.applyModalSearchChip('Bisleri 1L')">Bisleri 1L Peti</button>
            <button type="button" class="search-chip-pill" onclick="window.applyModalSearchChip('250ml')">250ml Water Peti</button>
            <button type="button" class="search-chip-pill" onclick="window.applyModalSearchChip('Coca-Cola')">Coca-Cola Peti</button>
            <button type="button" class="search-chip-pill" onclick="window.applyModalSearchChip('Limca')">Limca 300ml</button>
            <button type="button" class="search-chip-pill" onclick="window.applyModalSearchChip('wedding')">Shaadi Vivah Bundle</button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="search-results-meta-header">
        <span>Wholesale Results for "${query}"</span>
        <span class="search-results-meta-badge">${allMatches.length} Items Found</span>
      </div>
      ${allMatches.map(m => renderSearchResultItem(m.item, query, currentCart, m.isBundle)).join('')}
    `;
  }

  function renderSearchResultItem(item, query, currentCart, isBundle) {
    const id = String(item.id);
    const qty = currentCart[id] || 0;
    const price = item.price || 0;
    const mrp = item.mrp || 0;
    const saveAmt = (mrp > price) ? (mrp - price) : (item.save_amt || 0);
    const titleHighlighted = highlightTerms(item.title, query);
    const specHighlighted = highlightTerms(item.spec || item.desc || '', query);
    const image = item.image || (isBundle ? 'assets/cat_wedding_supply.webp' : 'assets/cat_water_cases.webp');
    const badgeText = isBundle
      ? (item.badge || 'Wholesale Event Bundle')
      : (item.category ? item.category.toUpperCase() : 'WHOLESALE PETI');

    const badgeClass = isBundle ? 'search-card-bundle-badge' : 'search-card-cat-badge';

    return `
      <div class="search-result-card" onclick="window.handleModalItemClick('${id}', ${isBundle})">
        <div class="search-card-thumb-wrap">
          <img src="${image}" alt="${item.title}" class="search-card-thumb" loading="lazy">
        </div>
        <div class="search-card-info">
          <div class="search-card-top-tags">
            <span class="${badgeClass}">${badgeText}</span>
          </div>
          <div class="search-card-title">${titleHighlighted}</div>
          <div class="search-card-spec">${specHighlighted}</div>
          <div class="search-card-price-row tabular">
            <span class="search-card-price">₹${price}</span>
            ${mrp > price ? `<span class="search-card-mrp">₹${mrp}</span>` : ''}
            ${saveAmt > 0 ? `<span class="search-card-save">Save ₹${saveAmt}</span>` : ''}
          </div>
        </div>
        <div class="search-card-action" onclick="event.stopPropagation()">
          ${qty > 0 ? `
            <div class="search-card-stepper tabular">
              <button type="button" class="search-card-stepper-btn" onclick="window.handleModalCartStep('${id}', -1, event)">-</button>
              <span class="search-card-stepper-qty">${qty}</span>
              <button type="button" class="search-card-stepper-btn" onclick="window.handleModalCartStep('${id}', 1, event)">+</button>
            </div>
          ` : `
            <button type="button" class="search-card-add-btn" onclick="window.handleModalCartStep('${id}', 1, event)">
              + Add
            </button>
          `}
        </div>
      </div>
    `;
  }

  window.handleModalCartStep = function(id, delta, event) {
    if (event) event.stopPropagation();

    if (typeof updateCart === 'function') {
      updateCart(id, delta, event);
    } else {
      const c = JSON.parse(localStorage.getItem('sikar_cart') || '{}');
      const cur = c[id] || 0;
      const next = cur + delta;
      if (next <= 0) delete c[id];
      else c[id] = next;
      localStorage.setItem('sikar_cart', JSON.stringify(c));

      if (typeof updateCartUI === 'function') updateCartUI();
    }

    const input = document.getElementById('modal-search-input');
    renderModalResults(input ? input.value : '');
  };

  window.handleModalItemClick = function(id, isBundle) {
    window.closeGlobalSearchModal();
    if (!isBundle && typeof openQuickView === 'function') {
      openQuickView(id);
    } else if (isBundle) {
      if (window.location.pathname.includes('bulk.html')) {
        const el = document.getElementById(`bundle-card-${id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.location.href = `/bulk.html#bundle-${id}`;
      }
    } else {
      if (typeof openQuickView === 'function') {
        openQuickView(id);
      } else {
        window.location.href = `/?q=${encodeURIComponent(id)}`;
      }
    }
  };

  window.viewAllResultsInCatalog = function() {
    const input = document.getElementById('modal-search-input');
    const q = input ? input.value.trim() : '';
    window.closeGlobalSearchModal();

    if (window.location.pathname === '/' || window.location.pathname.endsWith('index.html') || window.location.pathname === '') {
      if (typeof handleSearch === 'function') handleSearch(q);
      const inputHeader = document.getElementById('global-search-input');
      if (inputHeader) inputHeader.value = q;
      const sec = document.getElementById('products-section');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.location.href = `/?q=${encodeURIComponent(q)}`;
    }
  };

  // Wire up search modal triggers without blocking direct typing in search bars
  function bindSearchTriggers() {
    ensureSearchModalHTML();

    document.querySelectorAll('[data-open-search-modal]').forEach(el => {
      if (el.dataset.searchModalBound) return;
      el.dataset.searchModalBound = 'true';

      el.addEventListener('click', function(e) {
        e.preventDefault();
        window.openGlobalSearchModal();
      });
    });

    // Global keyboard hotkeys: Ctrl+K or / or Escape
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const overlay = document.getElementById('global-search-modal-overlay');
        if (overlay && overlay.style.display === 'flex') {
          window.closeGlobalSearchModal();
        } else {
          window.openGlobalSearchModal();
        }
      } else if (e.key === '/' && document.activeElement && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        window.openGlobalSearchModal();
      } else if (e.key === 'Escape') {
        const overlay = document.getElementById('global-search-modal-overlay');
        if (overlay && overlay.style.display === 'flex') {
          window.closeGlobalSearchModal();
        }
      }
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    bindSearchTriggers();
  } else {
    document.addEventListener('DOMContentLoaded', bindSearchTriggers);
  }
})();

