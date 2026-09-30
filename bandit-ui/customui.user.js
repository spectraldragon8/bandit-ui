// ==UserScript==
// @name         customUI
// @namespace    https://bandit.rip/
// @version      5.0.1
// @description  customUI for Bandit.RIP: brush-stroke menu, animated scenes, profile hub with medals, a mod menu, and a restyle of every sub-page. Scenes and mods load from GitHub. Alt+G toggles it.
// @homepageURL  https://github.com/spectraldragon8/bandit-ui/tree/main/bandit-ui
// @updateURL    https://raw.githubusercontent.com/spectraldragon8/bandit-ui/main/bandit-ui/customui.user.js
// @downloadURL  https://raw.githubusercontent.com/spectraldragon8/bandit-ui/main/bandit-ui/customui.user.js
// @match        https://bandit.rip/*
// @match        https://*.bandit.rip/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_addElement
// @connect      raw.githubusercontent.com
// ==/UserScript==

(() => {
  'use strict';

  const PAGE = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

  const STATE = { hubOpen: false, unread: 0, settingsOpen: false };

  // ───────────────────────── CONFIG ─────────────────────────
  const CONFIG = {
    brushColor: '#c3122f',   // menu highlight stroke
    textColor:  '#dcd8d2',   // idle menu text
    rainDensity: 1.0,        // (Cyberpunk City) 0 = off, 2 = downpour
    lightning: true,         // (Cyberpunk City)
    flyingCars: true,        // (Cyberpunk City)
    parallax: true,          // background follows the mouse slightly
    maxDPR: 1.5,             // lower (e.g. 1) if the menu lags
    toggleKey: 'g',          // Alt + this key toggles the theme
    loadTimeout: 20000,      // loading screen gives up waiting after this many ms
    minLoadMs: 1400,         // keep the loading screen up at least this long
    // the GitHub repo: themes/ holds themes.txt + *.theme, mods/ holds mods.txt + *.js, assets/ holds images
    repoBase:  'https://raw.githubusercontent.com/spectraldragon8/bandit-ui/main/bandit-ui/',
    get themeBase() { return this.repoBase + 'themes/'; },
    get modBase()   { return this.repoBase + 'mods/'; },
  };
  const KANJI = '盗賊記団級経点位殺衣金設景';

  // Dancing Emy on the loading screen (toggle lives in Settings)
  const EMY_GIF = CONFIG.repoBase + 'assets/dancingemy.gif';
  const emyOn = () => { try { return localStorage.getItem('gtm-emy') !== '0'; } catch (e) { return true; } };

  // ───────────────────────── LOOK: clan tier + #1 gold ─────────────────────────
  // Scenes are open to everyone; the blue colouring (main clan) and the gold hilt (#1) stay exclusive.
  const PALETTES = {
    red:  { brush: CONFIG.brushColor, deep: '#b3122b', hi: '#ff2a4f', soft: '#ff4d67', splash: '#c8102e', dark: '#7a0a1c', pale: '#ffd9de', rgb: '255,40,80' },
    blue: { brush: '#1668d8', deep: '#1256b8', hi: '#2fb4ff', soft: '#6fd3ff', splash: '#1560cc', dark: '#0a2f6e', pale: '#d6ecff', rgb: '40,170,255' },
  };
  const OWNER = 'spectraldragon8';     // always gets the main-clan look
  const MAIN_CLAN = '****', SUB_CLAN = '**';
  // last known look is cached so the loading screen is already the right colour
  const LOOK = { tier: 'none', gold: false, firsts: [] };
  try { Object.assign(LOOK, JSON.parse(localStorage.getItem('gtm-look') || '{}')); } catch (e) {}

  const ROOT = document.documentElement;
  let enabled = true;
  try { enabled = localStorage.getItem('gtm-off') !== '1'; } catch (e) {}
  if (enabled) ROOT.classList.add('gtm');

  // ───────────────────────── FONTS ─────────────────────────
  function addLink(href) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    (document.head || ROOT).appendChild(l);
  }
  addLink('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Marcellus&display=swap');
  addLink('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@800&display=swap&text=' + encodeURIComponent(KANJI));

  // ───────────────────────── BRUSH STROKE ─────────────────────────
  const brushSVG = (C) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 80' preserveAspectRatio='none'>
<defs>
<filter id='r' x='-5%' y='-40%' width='110%' height='180%'>
<feTurbulence type='fractalNoise' baseFrequency='0.9 0.07' numOctaves='3' seed='7'/>
<feDisplacementMap in='SourceGraphic' scale='13' xChannelSelector='R' yChannelSelector='G'/>
</filter>
<linearGradient id='g' x1='0' x2='1'>
<stop offset='0' stop-color='${C}' stop-opacity='1'/>
<stop offset='.55' stop-color='${C}' stop-opacity='.95'/>
<stop offset='.85' stop-color='${C}' stop-opacity='.5'/>
<stop offset='1' stop-color='${C}' stop-opacity='0'/>
</linearGradient>
</defs>
<g filter='url(#r)' fill='url(#g)'>
<path d='M10 20 Q1 40 9 61 L545 57 Q578 45 598 40 Q560 29 520 19 Z'/>
<rect x='300' y='13' width='290' height='3'/>
<rect x='340' y='63' width='240' height='2.5'/>
<rect x='420' y='28' width='175' height='2'/>
<rect x='380' y='50' width='215' height='2'/>
</g></svg>`;
  const svgURL = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

  // ragged red ink splash used behind the selected profile card
  const splashSVG = (C) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 180' preserveAspectRatio='none'>
<defs><filter id='s' x='-10%' y='-10%' width='120%' height='120%'>
<feTurbulence type='fractalNoise' baseFrequency='0.035' numOctaves='4' seed='3'/>
<feDisplacementMap in='SourceGraphic' scale='16' xChannelSelector='R' yChannelSelector='G'/>
</filter></defs>
<g filter='url(#s)' fill='${C}'><rect x='0' y='0' width='296' height='178'/><circle cx='292' cy='12' r='7'/><circle cx='240' cy='176' r='4'/></g></svg>`;

  const MAIL_SVG = `<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="1" y="1.5" width="18" height="13" rx="1.5"/><path d="M1.5 2.5 L10 9 L18.5 2.5"/></svg>`;

  // ───────────────────────── ROUTING ─────────────────────────
  // Pages inside the Profile hub run in "embed" mode (nav bars stripped); every other page gets the page skin.
  if (window.self !== window.top) {
    if ((window.name || '').startsWith('gtembed')) { embedMode(); pageSkin(true); }
    return;
  }
  if (location.pathname !== '/') { pageSkin(false); return; }

  // ───────────────────────── SCENES (loaded from GitHub) ─────────────────────────
  // themes.txt lists "Display Name : file" per line; each <file>.theme calls BanditTheme({...}).
  // Theme code is cached in localStorage so the scene starts instantly; GitHub is checked in the background.
  const DEFAULT_THEMES = 'Cyberpunk City : ccity\nThe Hotel : hotel';
  const AUTO_SCENE = { main: 'hotel', other: 'ccity' };   // what "Auto" picks
  const THEMES = { list: [], loaded: {}, loading: {}, code: {}, want: null, obj: null, preview: null };

  function getText(url) {
    const bust = url + (url.includes('?') ? '&' : '?') + 'v=' + Math.floor(Date.now() / 60000);
    return new Promise((resolve, reject) => {
      const done = (r) => (r.status >= 200 && r.status < 300 ? resolve(r.responseText) : reject(new Error('HTTP ' + r.status)));
      const opts = { method: 'GET', url: bust, timeout: 10000, onload: done, onerror: reject, ontimeout: reject };
      if (typeof GM_xmlhttpRequest === 'function') GM_xmlhttpRequest(opts);
      else if (typeof GM !== 'undefined' && GM.xmlHttpRequest) GM.xmlHttpRequest(opts);
      else fetch(bust).then((r) => (r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status)))).then(resolve, reject);
    });
  }
  function parseThemeList(txt) {
    // each line: "Display Name : file"  or  "Display Name : file : preview.png" (optional hand-made preview picture)
    return String(txt || '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => {
      const parts = l.split(':').map((x) => x.trim());
      if (parts.length < 2) return null;
      return { name: parts[0], id: parts[1].replace(/\.theme$/i, ''), img: parts.slice(2).join(':') || null };
    }).filter((x) => x && x.name && /^[\w-]+$/.test(x.id));
  }
  try { THEMES.list = parseThemeList(localStorage.getItem('gtm-themes')); } catch (e) {}
  if (!THEMES.list.length) THEMES.list = parseThemeList(DEFAULT_THEMES);

  const scenePref = () => { try { return localStorage.getItem('gtm-scene') || 'auto'; } catch (e) { return 'auto'; } };
  const hasTheme = (id) => THEMES.list.some((x) => x.id === id);
  function sceneId() {
    if (THEMES.preview && hasTheme(THEMES.preview)) return THEMES.preview;   // first-run picker hover
    const p = scenePref();
    if (p !== 'auto' && hasTheme(p)) return p;
    const want = LOOK.tier === 'main' ? AUTO_SCENE.main : AUTO_SCENE.other;
    if (hasTheme(want)) return want;
    return THEMES.list[0] ? THEMES.list[0].id : null;
  }
  const themeName = (id) => (THEMES.list.find((x) => x.id === id) || {}).name || id;

  function runTheme(id, code) {
    let got = null;
    THEMES.code[id] = code;
    try { new Function('BanditTheme', code)((def) => { got = def; }); }
    catch (err) { console.warn('[Bandit.RIP] scene "' + id + '" failed to load:', err); return null; }
    if (got) { got.id = id; THEMES.loaded[id] = got; }
    return got;
  }
  function loadTheme(id) {
    if (THEMES.loading[id]) return THEMES.loading[id];
    return (THEMES.loading[id] = (async () => {
      let cached = null;
      try { cached = localStorage.getItem('gtm-theme:' + id); } catch (err) {}
      const fresh = getText(CONFIG.themeBase + id + '.theme').then((code) => {
        if (code === cached) return code;
        try { localStorage.setItem('gtm-theme:' + id, code); } catch (err) {}
        // a newer version arrived while the cached one is showing → swap it in
        if (cached) {
          const th = runTheme(id, code);
          if (th && THEMES.want === id) { THEMES.obj = th; if (STATE.setTheme) STATE.setTheme(th); }
        }
        return code;
      });
      if (cached) { fresh.catch(() => {}); return runTheme(id, cached); }
      try { return runTheme(id, await fresh); }
      catch (err) { console.warn('[Bandit.RIP] could not download scene "' + id + '":', err); return null; }
    })());
  }
  async function applyScene() {
    const id = sceneId();
    if (!id || id === THEMES.want) return;
    THEMES.want = id;
    const th = await loadTheme(id);
    if (THEMES.want !== id) return;
    THEMES.obj = THEMES.loaded[id] || th;
    if (STATE.setTheme) STATE.setTheme(THEMES.obj);
    if (STATE.sceneReady) STATE.sceneReady();
  }
  async function refreshThemeList() {
    try {
      const txt = await getText(CONFIG.themeBase + 'themes.txt');
      const list = parseThemeList(txt);
      if (!list.length) return;
      THEMES.list = list;
      try { localStorage.setItem('gtm-themes', txt); } catch (err) {}
      if (STATE.onThemes) STATE.onThemes();
      applyScene();
    } catch (err) { /* keep the cached list */ }
  }
  applyScene();          // start fetching/running the scene straight away
  refreshThemeList();

  // ───────────────────────── MODS (loaded from GitHub) ─────────────────────────
  // mods/mods.txt lists "Display Name : file : short description" per line; mods/<file>.js is plain page JavaScript.
  // Mods people switch on are injected into the page when it loads. A mod that disappears from mods.txt stops
  // loading for everyone on their next visit, so deleting its line is how you pull a mod.
  const MODS = { list: [], on: [] };
  function parseModList(txt) {
    return String(txt || '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => {
      const parts = l.split(':');
      if (parts.length < 2) return null;
      return { name: parts[0].trim(), id: parts[1].trim().replace(/\.js$/i, ''), desc: parts.slice(2).join(':').trim() };
    }).filter((x) => x && x.name && /^[\w-]+$/.test(x.id));
  }
  try { MODS.list = parseModList(localStorage.getItem('gtm-mods-list')); } catch (e) {}
  try { MODS.on = JSON.parse(localStorage.getItem('gtm-mods-on') || '[]'); } catch (e) {}
  if (!Array.isArray(MODS.on)) MODS.on = [];
  const modOn = (id) => MODS.on.includes(id);
  function setModOn(id, on) {
    MODS.on = MODS.on.filter((x) => x !== id);
    if (on) MODS.on.push(id);
    try { localStorage.setItem('gtm-mods-on', JSON.stringify(MODS.on)); } catch (e) {}
  }
  // runs the mod in the page itself (like its own userscript would), past the site's script rules when possible
  function injectMod(id, code) {
    const src = code + '\n//# sourceURL=customui-mod-' + id + '.js';
    try { if (typeof GM_addElement === 'function') { GM_addElement('script', { textContent: src }); return; } } catch (e) {}
    const el = document.createElement('script');
    el.textContent = src;
    (document.head || ROOT).appendChild(el);
    el.remove();
  }
  async function loadMods() {
    const listed = new Set(MODS.list.map((x) => x.id));
    for (const id of MODS.on) {
      if (!listed.has(id)) continue;                 // pulled from mods.txt → don't run it
      let cached = null;
      try { cached = localStorage.getItem('gtm-mod:' + id); } catch (e) {}
      const fresh = getText(CONFIG.modBase + id + '.js').then((code) => {
        if (code !== cached) { try { localStorage.setItem('gtm-mod:' + id, code); } catch (e) {} }
        return code;
      });
      if (cached) { fresh.catch(() => {}); injectMod(id, cached); continue; }   // newer version applies next load
      try { injectMod(id, await fresh); }
      catch (err) { console.warn('[customUI] could not download mod "' + id + '":', err); }
    }
  }
  async function refreshModList() {
    try {
      const txt = await getText(CONFIG.modBase + 'mods.txt');
      MODS.list = parseModList(txt);
      try { localStorage.setItem('gtm-mods-list', txt); } catch (e) {}
      // forget switched-on mods that are no longer offered, and their cached code
      const listed = new Set(MODS.list.map((x) => x.id));
      for (const id of MODS.on.filter((x) => !listed.has(x))) {
        setModOn(id, false);
        try { localStorage.removeItem('gtm-mod:' + id); } catch (e) {}
      }
      if (STATE.onMods) STATE.onMods();
    } catch (err) { /* keep the cached list */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadMods); else loadMods();
  refreshModList();

  // ───────────────────────── CSS ─────────────────────────
  const buildCSS = (P) => `
html:not(.gtm) #gt-bg, html:not(.gtm) #gt-title { display:none !important; }

/* declutter: topbar buttons that now live in the Profile hub, plus the social blurb */
html.gtm #topbar-discord,
html.gtm #topbar-crazy,
html.gtm #topbar-lb,
html.gtm #topbar-shop,
html.gtm #topbar-hideout,
html.gtm .topbar-notif,
html.gtm .topbar a[href="/signout"],
html.gtm .topbar-account,
html.gtm .br-error-links { display:none !important; }
html:not(.gtm) #gt-region-sec, html:not(.gtm) #gt-look-sec { display:none !important; }

html.gtm .frontpage-menu-c { background:transparent !important; isolation:isolate; }
#gt-bg { position:fixed; inset:0; width:100vw; height:100vh; z-index:-1; pointer-events:none; display:block; }

/* hide original title + decorative backdrops */
html.gtm .frontpage-menu-title,
html.gtm .frontpage-firebg-c,
html.gtm .fpm-cover2-bg,
html.gtm .fpm-cover2-c,
html.gtm .frontpage-menu-menu-create-line,
html.gtm .frontpage-menu-menu-guide-arrow { display:none !important; }

/* menu block pinned left like a title screen */
html.gtm .frontpage-menu {
  position:fixed !important; left:6vw !important; top:13vh !important; right:auto !important; bottom:auto !important;
  width:auto !important; height:auto !important; margin:0 !important; padding:0 !important;
  transform:none !important; text-align:left !important; z-index:5 !important;
}
html.gtm .frontpage-menu-menu {
  display:flex !important; flex-direction:column; align-items:flex-start; gap:.5vh;
  position:static !important; width:auto !important; margin:0 !important; transform:none !important;
}

/* menu items */
html.gtm .frontpage-menu-menu-button {
  position:relative !important; isolation:isolate;
  background:none !important; border:0 !important; box-shadow:none !important; outline:none !important;
  width:auto !important; height:auto !important; min-width:0 !important;
  left:auto !important; top:auto !important; margin:0 !important; transform:none !important; animation:none !important;
  padding:1.05vh 3.5em 1.05vh .9em !important;
  font-family:'Marcellus','Optima','Segoe UI',sans-serif !important; font-weight:400 !important;
  font-size:clamp(17px,2.35vh,28px) !important; line-height:1.2 !important; letter-spacing:.07em !important;
  text-transform:uppercase; color:${CONFIG.textColor} !important;
  text-shadow:0 2px 14px rgba(0,0,0,.85) !important;
  cursor:pointer; transition:color .25s, transform .3s cubic-bezier(.2,.7,.2,1) !important;
}
/* kill the game's rainbow hue-rotate hover animation everywhere on the menu buttons */
html.gtm .frontpage-menu-menu-button,
html.gtm .frontpage-menu-menu-button:hover,
html.gtm .frontpage-menu-menu-button *,
html.gtm .frontpage-menu-menu-button:hover *,
html.gtm .frontpage-menu-menu-button::before,
html.gtm .frontpage-menu-menu-button:hover::before,
html.gtm .frontpage-menu-menu-button::after,
html.gtm .frontpage-menu-menu-button:hover::after {
  animation:none !important; filter:none !important; mix-blend-mode:normal !important;
  -webkit-text-fill-color:currentColor !important;
}
html.gtm .frontpage-menu-menu-button span { font:inherit !important; color:inherit !important; text-shadow:inherit !important; }
html.gtm .frontpage-menu-menu-button .brbutton2-back { display:none !important; }
html.gtm .frontpage-menu-menu-button .brbutton2-front { position:static !important; transform:none !important; }
html.gtm .frontpage-menu-menu-button::after { display:none !important; }
html.gtm .frontpage-menu-menu-button::before {
  content:"" !important; display:block !important; position:absolute !important;
  left:-.4em !important; top:50% !important; right:auto !important; bottom:auto !important;
  width:max(calc(100% + 3em), 17em) !important; height:2em !important; transform:translateY(-50%) !important;
  background:${svgURL(brushSVG(P.brush))} no-repeat left center / 100% 100% !important; border:0 !important; box-shadow:none !important;
  z-index:-1 !important; opacity:.96 !important;
  clip-path:inset(0 100% 0 0); transition:clip-path .38s cubic-bezier(.2,.7,.2,1) !important;
}
html.gtm .frontpage-menu-menu-button:hover { color:#fff !important; transform:translateX(6px) !important; }
html.gtm .frontpage-menu-menu-button:hover::before,
html.gtm .frontpage-menu-menu:not(:hover) .frontpage-menu-menu-play::before { clip-path:inset(0 0 0 0); }
html.gtm .frontpage-menu-menu:not(:hover) .frontpage-menu-menu-play { color:#fff !important; }

html.gtm .frontpage-menu-menu-guide-guide {
  position:static !important; transform:none !important; margin:1.6vh 0 0 1.1em !important;
  font:italic 400 clamp(12px,1.5vh,15px) 'Marcellus',serif !important; letter-spacing:.08em;
  color:${P.soft} !important; background:none !important; border:0 !important; text-shadow:0 0 10px rgba(${P.rgb},.5) !important;
}

/* custom title */
#gt-title { position:relative; display:inline-block; margin:0 0 3.4vh .9em; user-select:none; pointer-events:none; }
#gt-title .gt-sup { font:400 clamp(11px,1.3vh,15px)/1 'Cinzel',serif; letter-spacing:.9em; color:${P.soft};
  margin-bottom:.8vh; text-shadow:0 0 12px rgba(${P.rgb},.6); }
#gt-title .gt-main { font:700 clamp(40px,7.4vh,88px)/1 'Cinzel',serif; letter-spacing:.14em; color:#eceae6;
  text-shadow:0 0 30px rgba(0,0,0,.9), 0 0 2px rgba(255,255,255,.35); }
#gt-title .gt-line { height:3px; width:70%; margin-top:1.2vh; background:linear-gradient(90deg, ${P.brush}, transparent); }
#gt-title .gt-seal { position:absolute; left:100%; top:.9em; margin-left:.5em; display:flex; flex-direction:column; align-items:center;
  background:${P.deep}; color:#f6e9e0; font:800 clamp(14px,2vh,22px)/1.08 'Shippori Mincho','Yu Mincho','MS Mincho',serif;
  padding:.35em .3em; border-radius:3px; transform:rotate(4deg); box-shadow:0 0 18px rgba(${P.rgb},.45); }

/* faint username under PROFILE */
html.gtm .frontpage-menu-menu-button .gt-user {
  position:absolute !important; left:1.05em; top:100%; margin-top:-1vh;
  font:400 10px/1 'Marcellus',serif !important; letter-spacing:.3em !important; text-transform:none !important;
  color:#fff !important; opacity:.22; pointer-events:none; white-space:nowrap; text-shadow:none !important;
}
/* unread tick: a coloured ' after PROFILE */
html.gtm .frontpage-menu-menu-button .gt-tick { display:none !important; }
html.gtm .frontpage-menu-menu-button.gt-unread .gt-tick {
  display:inline-block !important; width:.16em; height:.62em; margin-left:.28em; vertical-align:.5em;
  background:${P.hi} !important; transform:skewX(-20deg); box-shadow:0 0 8px rgba(${P.rgb},.9) !important;
  animation:gttick 1.6s ease-in-out infinite !important;
}
@keyframes gttick { 0%,100% { opacity:1; } 50% { opacity:.4; } }

/* ═════════ LOADING SCREEN (shoji doors) ═════════ */
html:not(.gtm) #gt-loader { display:none !important; }
#gt-loader { position:fixed; inset:0; z-index:2147483647; overflow:hidden; cursor:progress; }
#gt-loader .gl-door {
  position:absolute; inset:0; background-color:#050505;
  background-image:
    linear-gradient(90deg, rgba(255,255,255,.035) 2px, transparent 2px),
    linear-gradient(rgba(255,255,255,.035) 2px, transparent 2px),
    radial-gradient(ellipse at center, #0e0e0e, #030303 75%);
  background-size:11vw 100%, 100% 16vh, 100% 100%;
  transition:transform 1.2s cubic-bezier(.77,0,.18,1);
}
#gt-loader .gl-left  { clip-path:polygon(0 0, 53% 0, 47% 100%, 0 100%); }
#gt-loader .gl-right { clip-path:polygon(53% 0, 100% 0, 100% 100%, 47% 100%); }
#gt-loader.open .gl-left  { transform:translateX(-58%); }
#gt-loader.open .gl-right { transform:translateX(58%); }
#gt-loader.slash .gl-door { animation:glshake .26s .28s; }
@keyframes glshake { 0%,100%{translate:0 0} 25%{translate:-5px 2px} 50%{translate:4px -2px} 75%{translate:-2px 1px} }
#gt-loader .gl-center { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:min(420px,80vw);
  text-align:center; transition:opacity .35s, transform .35s; }
#gt-loader.done .gl-center { opacity:0; transform:translate(-50%,-45%); }
#gt-loader .gl-seal { display:inline-block; background:${P.deep}; color:#f6e9e0; font:800 26px/1.05 'Shippori Mincho','Yu Mincho',serif;
  padding:8px 7px; border-radius:3px; transform:rotate(4deg); box-shadow:0 0 24px rgba(${P.rgb},.4); margin-bottom:22px; }
#gt-loader .gl-title { font:700 22px 'Cinzel',serif; letter-spacing:.5em; padding-left:.5em; color:#e8e4de; margin-bottom:26px; }
#gt-loader .gl-bar { height:2px; background:rgba(255,255,255,.08); overflow:hidden; }
#gt-loader .gl-fill { height:100%; background:linear-gradient(90deg,${P.dark},${P.hi}); transform-origin:left; transform:scaleX(0); box-shadow:0 0 12px ${P.hi}; }
#gt-loader .gl-row { display:flex; justify-content:space-between; margin-top:12px; font:13px 'Marcellus',serif;
  letter-spacing:.14em; color:#8a8580; text-transform:uppercase; }
#gt-loader .gl-pct { color:${P.soft}; font-family:'Cinzel',serif; }
#gt-loader .gl-title, #gt-loader .gl-bar, #gt-loader .gl-row { transition:opacity .45s; }
#gt-loader.welcome .gl-title, #gt-loader.welcome .gl-bar, #gt-loader.welcome .gl-row { opacity:0; }
#gt-loader .gl-welcome { position:absolute; left:-30vw; right:-30vw; top:58%; text-align:center; pointer-events:none;
  opacity:0; transform:translateY(14px); transition:opacity .7s, transform .9s cubic-bezier(.2,.7,.2,1); }
#gt-loader.welcome .gl-welcome { opacity:1; transform:none; }
#gt-loader .gl-wel-a { font:13px 'Marcellus',serif; letter-spacing:.8em; padding-left:.8em; text-transform:uppercase; color:${P.soft}; margin-bottom:12px; }
#gt-loader .gl-wel-b { font:700 clamp(30px,5vw,58px)/1.1 'Cinzel',serif; letter-spacing:.1em; color:#f1ede6; text-shadow:0 0 26px rgba(${P.rgb},.55); }
#gt-loader .gl-wel-c { margin-top:14px; font:12px 'Cinzel',serif; letter-spacing:.4em; color:#e9cf85; text-transform:uppercase; white-space:pre; }
#gt-loader .gl-slash { position:absolute; left:53.6%; top:-10%; width:3px; height:125%; margin-left:-1.5px;
  background:linear-gradient(transparent, #fff 15%, ${P.hi} 50%, #fff 85%, transparent);
  box-shadow:0 0 16px ${P.hi}, 0 0 44px rgba(${P.rgb},.8);
  transform-origin:50% 0; transform:rotate(var(--ang,3deg)) scaleY(0); opacity:0; }
#gt-loader.slash .gl-slash { opacity:1; transform:rotate(var(--ang,3deg)) scaleY(1); transition:transform .32s cubic-bezier(.7,0,.2,1); }
#gt-loader.open .gl-slash { opacity:0; transition:opacity .5s; }
#gt-loader .gl-emy { position:absolute; left:50%; bottom:2vh; transform:translateX(-50%); z-index:2; pointer-events:none;
  image-rendering:pixelated; visibility:hidden; transition:opacity .4s; }
#gt-loader.slash .gl-emy { opacity:0; }

/* ═════════ THEMES POPUP (THEME menu button + first-run picker) ═════════ */
html:not(.gtm) #gt-themes, html:not(.gtm) .gt-theme-btn { display:none !important; }
#gt-themes { position:fixed; inset:0; z-index:2147482000; display:flex; align-items:center; justify-content:center; padding:4vh 4vw;
  background:rgba(4,4,6,.38); opacity:0; transition:opacity .35s; font-family:'Marcellus',serif; }
#gt-themes.in { opacity:1; }
#gt-themes * { box-sizing:border-box; }
#gt-themes .gs-panel { position:relative; display:flex; flex-direction:column; width:min(1000px,100%); max-height:100%; background:#f4f2ef; color:#161616;
  box-shadow:0 24px 70px rgba(0,0,0,.55); transform:translateY(14px); transition:transform .45s cubic-bezier(.2,.7,.2,1); }
#gt-themes.in .gs-panel { transform:none; }
#gt-themes .gs-top { position:relative; flex:none; display:flex; align-items:center; gap:18px; height:64px; padding:0 22px 0 28px; background:#0e0e0f; color:#f1ede6; }
#gt-themes .gs-top::after { content:""; position:absolute; left:0; right:0; bottom:0; height:3px; background:linear-gradient(90deg, ${P.deep}, transparent 70%); }
#gt-themes .gs-sup { font:11px 'Cinzel',serif; letter-spacing:.5em; color:${P.soft}; text-transform:uppercase; }
#gt-themes .gs-title { font:400 22px/1 'Marcellus',serif; letter-spacing:.14em; text-transform:uppercase; }
#gt-themes .gs-hint { margin-left:auto; font:11px 'Marcellus',serif; letter-spacing:.14em; text-transform:uppercase; color:#8a857e; }
#gt-themes .gs-x { width:34px; height:34px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#cfcac3; font-size:16px;
  border:1px solid #5a5652; transition:color .2s, background .2s, border-color .2s; }
#gt-themes .gs-x:hover { color:#fff; background:${P.deep}; border-color:${P.hi}; }
#gt-themes .gs-grid { flex:1; min-height:0; overflow:auto; display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:28px 26px; padding:30px 34px 34px; }
#gt-themes .gs-tile { position:relative; cursor:pointer; user-select:none; }
#gt-themes .gs-pic { position:relative; aspect-ratio:16/9; overflow:hidden; background:#16161a; border:1px solid rgba(0,0,0,.25);
  box-shadow:0 3px 12px rgba(0,0,0,.18); outline:3px solid transparent; outline-offset:3px;
  transition:transform .25s cubic-bezier(.2,.7,.2,1), box-shadow .25s, outline-color .2s; }
#gt-themes .gs-pic img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:0; transition:opacity .4s; }
#gt-themes .gs-pic img.ok { opacity:1; }
#gt-themes .gs-k { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  font:800 64px/1 'Shippori Mincho','Yu Mincho',serif; color:rgba(255,255,255,.08); }
#gt-themes .gs-pic::after { content:""; position:absolute; inset:0; pointer-events:none;
  background:linear-gradient(100deg, transparent 30%, rgba(255,255,255,.07) 50%, transparent 70%); background-size:250% 100%; animation:gsshim 1.4s linear infinite; }
#gt-themes .gs-pic.ready::after { display:none; }
@keyframes gsshim { from { background-position:120% 0; } to { background-position:-120% 0; } }
#gt-themes .gs-tile:hover .gs-pic { transform:translateY(-4px); box-shadow:0 10px 24px rgba(0,0,0,.28); }
#gt-themes .gs-tile.sel .gs-pic { outline-color:${P.deep}; }
#gt-themes .gs-tag { position:absolute; left:0; top:0; z-index:2; display:none; padding:4px 10px; background:${P.deep}; color:#fff;
  font:10px 'Cinzel',serif; letter-spacing:.2em; text-transform:uppercase; }
#gt-themes .gs-tile.sel .gs-tag { display:block; }
#gt-themes .gs-name { margin-top:12px; font:700 15px 'Cinzel',serif; letter-spacing:.1em; text-transform:uppercase; color:#1a1a1a; transition:color .2s; }
#gt-themes .gs-tile.sel .gs-name { color:${P.deep}; }
#gt-themes .gs-foot { flex:none; display:flex; align-items:center; justify-content:space-between; gap:16px; height:58px; padding:0 22px 0 28px;
  background:#0e0e0f; font:11px 'Marcellus',serif; letter-spacing:.14em; text-transform:uppercase; color:#8a857e; }
#gt-themes .gs-foot b { border:1px solid #5a5652; border-radius:3px; padding:2px 6px; margin-right:6px; font-weight:400; color:#cfcac3; }
#gt-themes .gs-done { height:34px; padding:0 26px; border:0; cursor:pointer; color:#fff; background:${P.deep};
  font:12px 'Cinzel',serif; letter-spacing:.2em; text-transform:uppercase; transition:background .2s; }
#gt-themes .gs-done:hover { background:${P.hi}; }

/* mods popup: same frame as the themes popup, rows instead of tiles */
#gt-themes .gs-list { flex:1; min-height:0; overflow:auto; padding:10px 0 16px; }
#gt-themes .gmr { display:grid; grid-template-columns:minmax(0,1fr) clamp(150px,20vw,220px); column-gap:28px; align-items:center;
  padding:14px 34px; cursor:pointer; border-bottom:1px solid rgba(0,0,0,.06); transition:background .18s; }
#gt-themes .gmr:hover { background:linear-gradient(90deg,#4c4c4c,#8e8e8e); }
#gt-themes .gmr-n { font:700 15px 'Cinzel',serif; letter-spacing:.1em; text-transform:uppercase; color:#1a1a1a; }
#gt-themes .gmr-d { margin-top:4px; font:12px/1.45 'Marcellus',serif; color:#7a746d; }
#gt-themes .gmr:hover .gmr-n { color:#fff; }
#gt-themes .gmr:hover .gmr-d { color:#ece8e2; }
#gt-themes .gmr-sw { display:flex; height:30px; background:#e2dfda; font:12px 'Marcellus',serif; letter-spacing:.1em; text-transform:uppercase; }
#gt-themes .gmr-sw span { flex:1; display:flex; align-items:center; justify-content:center; color:rgba(0,0,0,.3); transition:background .18s, color .18s; }
#gt-themes .gmr-sw span:first-child { background:#cfcac3; color:#222; }
#gt-themes .gmr-sw.on span:first-child { background:none; color:rgba(0,0,0,.3); }
#gt-themes .gmr-sw.on span:last-child { background:${P.deep}; color:#fff; }
#gt-themes .gs-empty { padding:40px 34px; font:14px 'Marcellus',serif; color:#7a746d; }
#gt-themes .gs-foot-r { display:flex; gap:10px; }
#gt-themes .gs-reload { height:34px; padding:0 18px; cursor:pointer; background:transparent; color:#cfcac3; border:1px solid #5a5652;
  font:12px 'Cinzel',serif; letter-spacing:.16em; text-transform:uppercase; transition:color .2s, border-color .2s; }
#gt-themes .gs-reload:hover { color:#fff; border-color:${P.hi}; }
#gt-themes .gs-reload[hidden] { display:none; }

/* ═════════ PROFILE HUB ═════════ */
html:not(.gtm) #gt-hub { display:none !important; }
#gt-hub { position:fixed; inset:0; z-index:2147483000; opacity:0; visibility:hidden; background:#e6e3de; color:#161616;
  font-family:'Marcellus',serif; transition:opacity .35s, visibility 0s .35s; }
#gt-hub.open { opacity:1; visibility:visible; transition:opacity .35s; }
#gt-hub:not(.open), #gt-hub:not(.open) * { pointer-events:none !important; }
#gt-hub * { box-sizing:border-box; }
#gt-hub .gh-top { position:absolute; left:0; right:0; top:0; height:46px; background:#0b0b0c; display:flex; align-items:center;
  gap:10px; padding:0 18px; box-shadow:0 2px 12px rgba(0,0,0,.35); z-index:3; }
#gt-hub .gh-key { font:11px/1 'Cinzel',serif; color:#cfcac3; border:1px solid #5a5652; border-radius:9px; padding:4px 9px; cursor:pointer; user-select:none; }
#gt-hub .gh-tabs { position:relative; display:flex; height:100%; align-items:stretch; }
#gt-hub .gh-pill { position:absolute; top:0; bottom:0; left:0; width:0; background:linear-gradient(#f3f1ed,#d7d3cd); z-index:0;
  transition:left .32s cubic-bezier(.2,.7,.2,1), width .32s cubic-bezier(.2,.7,.2,1), opacity .2s; }
#gt-hub .gh-tab { position:relative; z-index:1; display:flex; align-items:center; padding:0 18px; white-space:nowrap; cursor:pointer; user-select:none;
  font:14px 'Marcellus',serif; letter-spacing:.08em; text-transform:uppercase; color:#d6d2cc; transition:color .25s; }
#gt-hub .gh-tab:hover { color:#fff; }
#gt-hub .gh-tab.active { color:#141414; }
#gt-hub .gh-cur { margin-left:auto; display:flex; gap:18px; font:13px 'Cinzel',serif; color:#e8e4de; letter-spacing:.08em; white-space:nowrap; }
#gt-hub .gh-cur b { color:${P.soft}; font-weight:400; margin-right:5px; }
#gt-hub .gh-cur .gh-coins { cursor:pointer; transition:color .2s; }
#gt-hub .gh-cur .gh-coins:hover { color:#fff; }
#gt-hub .gh-mail { position:relative; display:flex; align-items:center; justify-content:center; width:36px; height:30px; margin-left:6px;
  cursor:pointer; color:#cfcac3; border-radius:3px; transition:color .2s, background .2s; }
#gt-hub .gh-mail:hover { color:#fff; }
#gt-hub .gh-mail.active { background:linear-gradient(#f3f1ed,#d7d3cd); color:#141414; }
#gt-hub .gh-mail svg { width:20px; height:16px; display:block; }
#gt-hub .gh-badge { position:absolute; right:-3px; top:-1px; min-width:15px; height:15px; padding:0 4px; border-radius:8px;
  background:${P.hi}; color:#fff; font:10px/15px 'Cinzel',serif; text-align:center; box-shadow:0 0 8px rgba(${P.rgb},.7); }
#gt-hub .gh-out { font:12px 'Cinzel',serif; letter-spacing:.12em; text-transform:uppercase; color:#cfcac3; text-decoration:none; white-space:nowrap;
  border:1px solid #5a5652; border-radius:3px; padding:5px 10px; transition:color .2s, background .2s, border-color .2s; }
#gt-hub .gh-out:hover { color:#fff; background:${P.deep}; border-color:${P.hi}; }
#gt-hub .gh-body { position:absolute; top:46px; left:0; right:0; bottom:0; overflow:hidden; }
#gt-hub .gh-panel { position:absolute; inset:0; opacity:0; visibility:hidden; pointer-events:none; transform:translateX(var(--x,28px));
  transition:opacity .32s, transform .42s cubic-bezier(.2,.7,.2,1), visibility 0s .42s; }
#gt-hub .gh-panel.active { opacity:1; visibility:visible; pointer-events:auto; transform:none;
  transition:opacity .32s, transform .42s cubic-bezier(.2,.7,.2,1); }
#gt-hub .gh-panel.frame { background:#0b0b0d; }
#gt-hub .gh-panel iframe { width:100%; height:100%; border:0; display:block; background:#0b0b0d; }
#gt-hub .gh-fail { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px;
  background:#0b0b0d; color:#d6d2cc; font:15px 'Marcellus',serif; letter-spacing:.06em; }
#gt-hub .gh-fail a, #gt-hub .gp-btn { color:#fff; background:${P.deep}; padding:9px 20px; border:0; cursor:pointer; text-decoration:none;
  font:13px 'Cinzel',serif; letter-spacing:.14em; text-transform:uppercase; }
#gt-hub .gh-foot { position:absolute; right:22px; bottom:16px; z-index:4; cursor:pointer; user-select:none;
  font:12px 'Marcellus',serif; letter-spacing:.14em; text-transform:uppercase; color:#8a857e; }
#gt-hub .gh-foot span { border:1px solid #9a958e; border-radius:3px; padding:2px 6px; margin-right:6px; }

/* profile page */
#gt-hub .gp { position:absolute; inset:0; display:flex; background:radial-gradient(ellipse at 70% 30%, #f2f0ec, #d9d5cf 85%); }
#gt-hub .gp-cards { width:clamp(220px,24vw,320px); padding:3vh 0 3vh 1.2vw; display:flex; flex-direction:column; gap:1.6vh; }
#gt-hub .gp-card { position:relative; flex:1; max-height:200px; background:#fbfaf8; overflow:hidden; cursor:pointer;
  box-shadow:0 2px 10px rgba(0,0,0,.12); transition:transform .25s, box-shadow .25s; }
#gt-hub .gp-card:hover { transform:translateX(5px); }
#gt-hub .gp-card::before { content:""; position:absolute; inset:0; background:radial-gradient(circle at 70% 60%, rgba(0,0,0,.14), transparent 60%); }
#gt-hub .gp-card.active { background:transparent; box-shadow:none; }
#gt-hub .gp-card.active::before { background:${svgURL(splashSVG(P.splash))} center / 100% 100% no-repeat; }
#gt-hub .gp-card-t { position:absolute; left:12px; top:9px; z-index:2; font:14px 'Marcellus',serif; letter-spacing:.08em; color:#1a1a1a; }
#gt-hub .gp-card.active .gp-card-t { color:#fff; }
#gt-hub .gp-card-m { position:absolute; left:14px; top:34px; z-index:2; width:22px; height:14px; opacity:.75;
  background:linear-gradient(160deg, transparent 38%, #1a1a1a 38%, #1a1a1a 52%, transparent 52%); }
#gt-hub .gp-kanji { position:absolute; right:7%; bottom:-6%; z-index:1; font:800 clamp(80px,13vh,140px)/1 'Shippori Mincho','Yu Mincho',serif; color:rgba(0,0,0,.13); }
#gt-hub .gp-card.active .gp-kanji { color:#140406; }
#gt-hub .gp-card-s { position:absolute; left:12px; bottom:9px; z-index:2; font:11px 'Marcellus',serif; letter-spacing:.1em; text-transform:uppercase; color:#6d6863; }
#gt-hub .gp-card.active .gp-card-s { color:${P.pale}; }
#gt-hub .gp-main { position:relative; flex:1; }
#gt-hub .gp-sec { position:absolute; inset:4vh 3.5vw; opacity:0; visibility:hidden; transform:translateY(8px);
  transition:opacity .3s, transform .3s, visibility 0s .3s; }
#gt-hub .gp-sec.active { opacity:1; visibility:visible; transform:none; transition:opacity .3s, transform .3s; }
#gt-hub .gp-head { font:12px 'Marcellus',serif; letter-spacing:.3em; text-transform:uppercase; color:#7b7670; margin-bottom:3.5vh; }
#gt-hub .gp-head b { font:700 20px 'Cinzel',serif; letter-spacing:.14em; color:#111; margin-right:14px; }
#gt-hub .gp-rec { display:flex; gap:4.5vw; flex-wrap:wrap; }
#gt-hub .gt-tree-t { width:150px; text-align:center; margin-bottom:12px; font:15px 'Marcellus',serif; letter-spacing:.08em; text-transform:uppercase; }
#gt-hub .gt-tree-b { position:relative; width:150px; }
#gt-hub .gt-tree-b svg { position:absolute; left:0; top:0; }
#gt-hub .gt-node { position:absolute; display:flex; align-items:center; justify-content:center; cursor:pointer; transform:translate(-50%,-50%);
  transition:background .2s, border-color .2s, box-shadow .2s; }
#gt-hub .gt-node.dia { width:30px; height:30px; background:#141414; border:1px solid #000; transform:translate(-50%,-50%) rotate(45deg); }
#gt-hub .gt-node.dia span { transform:rotate(-45deg); font:800 13px 'Shippori Mincho','Yu Mincho',serif; color:#d9b36a; }
#gt-hub .gt-node.dia:hover, #gt-hub .gt-node.dia.sel { background:${P.deep}; box-shadow:0 0 12px rgba(${P.rgb},.5); }
#gt-hub .gt-node.circ { width:62px; height:62px; border-radius:50%; background:radial-gradient(circle at 40% 35%, #2a2a2a, #0b0b0b);
  border:3px solid #d9b36a; box-shadow:0 0 0 2px #0b0b0b, 0 4px 14px rgba(0,0,0,.3); }
#gt-hub .gt-node.circ span { font:700 15px 'Cinzel',serif; color:#f1ede6; }
#gt-hub .gt-node.circ:hover, #gt-hub .gt-node.circ.sel { border-color:${P.hi}; }
#gt-hub .gp-side { flex:1; min-width:260px; display:flex; flex-direction:column; gap:5vh; align-items:center; }
#gt-hub .gp-group-t { text-align:center; font:17px 'Marcellus',serif; letter-spacing:.1em; text-transform:uppercase; }
#gt-hub .gp-group-s { text-align:center; font:12px 'Marcellus',serif; color:#4a4642; margin:4px 0 14px; }
#gt-hub .gp-circles { display:flex; flex-wrap:wrap; justify-content:center; gap:14px 10px; max-width:500px; }
#gt-hub .gp-ro { width:62px; display:flex; flex-direction:column; align-items:center; cursor:pointer; }
#gt-hub .gp-circ { position:relative; overflow:hidden; width:52px; height:52px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  background:radial-gradient(circle at 40% 35%, #2b2b2b, #0a0a0a); border:2px solid #0a0a0a; box-shadow:0 0 0 2px #cfcac3;
  color:#eee; font:700 13px 'Cinzel',serif; transition:transform .2s, box-shadow .2s; }
#gt-hub .gp-circ img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:50% 12%; image-rendering:pixelated; }
#gt-hub .gp-ro:hover .gp-circ { transform:scale(1.1); box-shadow:0 0 0 2px ${P.deep}; }
#gt-hub .gp-circ.locked { opacity:.35; filter:grayscale(1); border-style:dashed; }
#gt-hub .gp-ro-n { margin-top:6px; max-width:70px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font:11px 'Marcellus',serif; letter-spacing:.03em; color:#1a1a1a; }
#gt-hub .gp-ro-l { font:10px 'Cinzel',serif; letter-spacing:.06em; color:${P.deep}; }
#gt-hub .gp-b-img { position:absolute; right:-6px; bottom:-10px; height:125%; opacity:.9; image-rendering:pixelated; pointer-events:none; }
#gt-hub .gp-b.locked .gp-b-img { filter:grayscale(1); opacity:.35; }
#gt-hub .gp-b-n, #gt-hub .gp-b-l, #gt-hub .gp-b-s { position:relative; z-index:1; }
#gt-hub .gp-b-l { margin-top:4px; font:12px 'Cinzel',serif; letter-spacing:.06em; color:${P.deep}; }
#gt-hub .gp-detail { position:absolute; right:0; bottom:0; width:min(340px,40%); border-left:3px solid ${P.deep}; padding:10px 0 10px 16px; }
#gt-hub .gp-detail-t { font:12px 'Marcellus',serif; letter-spacing:.3em; text-transform:uppercase; color:#6d6863; }
#gt-hub .gp-detail-v { font:700 34px/1.2 'Cinzel',serif; color:#111; }
#gt-hub .gp-detail-d { font:13px/1.4 'Marcellus',serif; color:#4a4642; }
#gt-hub .gp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:14px; max-height:calc(100% - 70px); overflow:auto; padding:2px 6px 8px 2px; }
#gt-hub .gp-b { position:relative; height:110px; background:#fbfaf8; box-shadow:0 2px 8px rgba(0,0,0,.1); padding:12px 14px 12px 16px;
  cursor:pointer; overflow:hidden; transition:transform .2s; }
#gt-hub .gp-b:hover { transform:translateY(-3px); }
#gt-hub .gp-b::after { content:""; position:absolute; left:0; top:0; bottom:0; width:3px; background:${P.deep}; }
#gt-hub .gp-b-n { font:700 16px 'Cinzel',serif; letter-spacing:.06em; }
#gt-hub .gp-b-s { margin-top:6px; font:12px 'Marcellus',serif; letter-spacing:.08em; text-transform:uppercase; color:#6d6863; }
#gt-hub .gp-b-i { position:absolute; right:10px; bottom:-14px; font:800 64px/1 'Cinzel',serif; color:rgba(0,0,0,.07); }
#gt-hub .gp-b.locked { background:#e9e6e1; color:#8d8882; }
#gt-hub .gp-b.locked::after { background:#9d9891; }
#gt-hub .gp-clan { display:flex; flex-direction:column; align-items:flex-start; gap:18px; margin-top:4vh; }
#gt-hub .gp-clan-tag { font:700 clamp(60px,12vh,120px)/1 'Cinzel',serif; letter-spacing:.06em; }
#gt-hub .gp-note { font:14px/1.5 'Marcellus',serif; color:#4a4642; max-width:460px; }
/* profile medals: big ones at the top of the record, small ones at the bottom */
#gt-hub .gp-sec[data-sec="record"] { overflow-y:auto; overflow-x:hidden; }
#gt-hub .gm-top { display:flex; flex-wrap:wrap; gap:18px 30px; margin:-1.2vh 0 3.2vh; }
#gt-hub .gm-bot { margin-top:3.2vh; max-width:calc(100% - 370px); }
#gt-hub .gm-bot-t { display:flex; align-items:center; gap:12px; margin-bottom:12px; font:11px 'Cinzel',serif; letter-spacing:.3em; text-transform:uppercase; color:#8a847c; }
#gt-hub .gm-bot-t::after { content:""; flex:1; height:1px; background:rgba(0,0,0,.12); }
#gt-hub .gm-row { display:flex; flex-wrap:wrap; gap:14px 12px; }
#gt-hub .gm { position:relative; display:flex; flex-direction:column; align-items:center; width:62px; cursor:default; }
#gt-hub .gm.big { width:128px; }
#gt-hub .gm-gold   { --a:#fff4c8; --b:#e2b54c; --c:#7a5412; --ink:#3a2604; --glow:rgba(240,200,90,.55); }
#gt-hub .gm-silver { --a:#ffffff; --b:#c3c9d2; --c:#5b636e; --ink:#262a30; --glow:rgba(210,220,235,.55); }
#gt-hub .gm-bronze { --a:#ffd9b3; --b:#c07a3c; --c:#5a2e10; --ink:#2e1606; --glow:rgba(220,140,70,.45); }
#gt-hub .gm-steel  { --a:#9aa0aa; --b:#4b4f58; --c:#1d1f24; --ink:#f1ede6; --glow:rgba(0,0,0,0); }
#gt-hub .gm-rib { width:22px; height:14px; margin-bottom:-5px; background:linear-gradient(90deg, ${P.deep} 50%, ${P.dark} 50%);
  clip-path:polygon(0 0,100% 0,100% 100%,50% 62%,0 100%); }
#gt-hub .gm.big .gm-rib { width:40px; height:26px; margin-bottom:-9px; }
#gt-hub .gm-disc { position:relative; z-index:1; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  background:radial-gradient(circle at 35% 30%, var(--a), var(--b) 55%, var(--c));
  box-shadow:0 0 0 2px var(--c), inset 0 0 0 3px rgba(255,255,255,.3), 0 3px 8px rgba(0,0,0,.25);
  font:700 11px 'Cinzel',serif; color:var(--ink); letter-spacing:-.02em; transition:transform .2s; }
#gt-hub .gm.big .gm-disc { width:78px; height:78px; font-size:20px;
  box-shadow:0 0 0 3px var(--c), inset 0 0 0 5px rgba(255,255,255,.3), 0 6px 18px rgba(0,0,0,.28), 0 0 26px var(--glow); }
#gt-hub .gm:hover .gm-disc { transform:scale(1.08) rotate(-4deg); }
#gt-hub .gm-n { margin-top:7px; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:center;
  font:10px 'Marcellus',serif; letter-spacing:.04em; color:#1a1a1a; }
#gt-hub .gm.big .gm-n { margin-top:10px; font:700 13px 'Cinzel',serif; letter-spacing:.08em; text-transform:uppercase; }
#gt-hub .gm-s { margin-top:3px; font:10px 'Marcellus',serif; letter-spacing:.14em; text-transform:uppercase; color:#7b7670; }
#gt-hub .gh-setwait { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px;
  background:radial-gradient(ellipse at 75% 25%, #f2f0ec, #d6d2cc 85%); font:14px 'Marcellus',serif; letter-spacing:.1em; color:#6d6863; }

/* ═════════ SETTINGS: the game's own panel, restyled and shown inside the hub ═════════ */
html.gtm.gt-settings .frontpage-settings-c {
  position:fixed !important; left:0 !important; right:0 !important; top:46px !important; bottom:0 !important;
  width:auto !important; height:auto !important; margin:0 !important; padding:0 !important; transform:none !important;
  z-index:2147483100 !important; border:0 !important; border-radius:0 !important; box-shadow:none !important;
  background:radial-gradient(ellipse at 75% 25%, #f2f0ec, #d6d2cc 85%) !important; font-family:'Marcellus',serif !important;
}
html.gtm.gt-settings .frontpage-settings-c::before { content:"設"; position:absolute; right:4vw; bottom:-6vh; pointer-events:none;
  font:800 46vh/1 'Shippori Mincho','Yu Mincho',serif; color:rgba(0,0,0,.05); }
html.gtm.gt-settings .frontpage-settings-c2 {
  position:absolute !important; left:3vw !important; top:3vh !important; bottom:3vh !important; right:3vw !important;
  width:auto !important; max-width:none !important; height:auto !important; max-height:none !important; min-height:0 !important; margin:0 !important; padding:0 !important;
  transform:translateZ(0) !important; background:#f4f2ef !important; border:0 !important; border-radius:0 !important;
  box-shadow:0 18px 50px rgba(0,0,0,.28) !important; overflow:hidden !important;
}
html.gtm.gt-settings .frontpage-settings-c3 {
  position:absolute !important; left:0 !important; right:0 !important; top:70px !important; bottom:62px !important;
  width:auto !important; height:auto !important; max-height:none !important; margin:0 !important; padding:0 !important;
  overflow:auto !important; background:none !important; border:0 !important;
}
html.gtm.gt-settings .frontpage-settings-c4 { width:auto !important; margin:0 !important; padding:0 0 18px !important; background:none !important; }
html.gtm.gt-settings .fpset-section { margin:0 !important; padding:0 !important; background:none !important; }
/* black header bar (fixed to the panel, thanks to the transform above) */
html.gtm.gt-settings .fpset-title {
  position:fixed !important; left:0 !important; right:0 !important; top:0 !important; height:70px !important; margin:0 !important; z-index:5;
  display:flex !important; align-items:center; padding:0 26px 0 88px !important; transform:none !important;
  background:#0e0e0f !important; color:#f1ede6 !important; text-align:left !important; text-shadow:none !important;
  font:400 24px/1 'Marcellus',serif !important; letter-spacing:.14em !important; text-transform:uppercase;
}
html.gtm.gt-settings .fpset-title::before { content:""; position:absolute; left:26px; top:50%; width:42px; height:42px; margin-top:-21px;
  background:${svgURL(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 44' fill='none' stroke='#f1ede6'><rect x='3' y='3' width='38' height='38' stroke-width='2.4'/><path d='M3 16H41M3 29H41M16 3V41M29 3V41' stroke-width='1.3'/><rect x='29.6' y='29.6' width='10.8' height='10.8' fill='${P.hi}' stroke='none'/></svg>`)} center / contain no-repeat; }
html.gtm.gt-settings .fpset-title::after { content:""; position:absolute; left:0; right:0; bottom:0; height:3px; background:linear-gradient(90deg, ${P.deep}, transparent 70%); }
/* section headings */
html.gtm.gt-settings .fpset-section-title {
  display:flex !important; align-items:center; gap:12px; margin:0 !important; padding:22px 26px 8px !important;
  background:none !important; border:0 !important; text-align:left !important; text-shadow:none !important;
  font:400 11px/1 'Cinzel',serif !important; letter-spacing:.34em !important; text-transform:uppercase; color:#8a847c !important;
}
html.gtm.gt-settings .fpset-section-title::after { content:""; flex:1; height:1px; background:rgba(0,0,0,.12); }
html.gtm.gt-settings .fpset-ss-c { width:auto !important; margin:0 !important; padding:0 !important; background:none !important; border:0 !important; box-shadow:none !important; }
html.gtm.gt-settings .fpset-ss-c-title { margin:0 !important; padding:12px 26px 6px !important; background:none !important; text-align:left !important; text-shadow:none !important;
  font:400 10px/1 'Cinzel',serif !important; letter-spacing:.24em !important; text-transform:uppercase; color:#a39d95 !important; }
/* rows: label left, value box right */
html.gtm.gt-settings .fpset-ss, html.gtm.gt-settings .fpset-ss2 {
  position:relative !important; display:grid !important; grid-template-columns:minmax(0,1fr) clamp(240px,28vw,380px); column-gap:32px; align-items:center;
  width:auto !important; height:auto !important; min-height:42px; margin:0 !important; padding:6px 36px !important; float:none !important;
  background:none !important; border:0 !important; border-radius:0 !important; box-shadow:none !important; cursor:pointer; transition:background .18s;
}
html.gtm.gt-settings .fpset-ss:hover, html.gtm.gt-settings .fpset-ss2:hover { background:linear-gradient(90deg,#4c4c4c,#8e8e8e) !important; }
html.gtm.gt-settings .fpset-ss-text {
  grid-column:1; grid-row:1; position:static !important; width:auto !important; margin:0 !important; padding:0 !important; float:none !important; transform:none !important;
  font:400 13px/1.3 'Marcellus',serif !important; letter-spacing:.08em !important; text-transform:uppercase; color:#1c1c1c !important; text-align:left !important; text-shadow:none !important;
}
html.gtm.gt-settings .fpset-ss-button, html.gtm.gt-settings .fpset-ss-bdisplay, html.gtm.gt-settings .gt-region-slot {
  grid-column:2; grid-row:1; position:relative !important; left:auto !important; right:auto !important; top:auto !important; bottom:auto !important;
  float:none !important; width:100% !important; height:30px !important; margin:0 !important; padding:0 !important; transform:none !important;
}
html.gtm.gt-settings .fpset-ss-bdisplay { display:flex !important; align-items:center; justify-content:center; background:#e2dfda !important; color:#222 !important;
  border:0 !important; border-radius:0 !important; box-shadow:none !important; text-shadow:none !important;
  font:400 12px 'Marcellus',serif !important; letter-spacing:.1em !important; text-transform:uppercase; }
html.gtm.gt-settings .fpset-ss-desc { grid-column:1 / -1; position:static !important; width:auto !important; margin:3px 0 2px !important; padding:0 !important; text-align:left !important;
  font:400 11px/1.45 'Marcellus',serif !important; letter-spacing:.02em !important; text-transform:none; color:#7a746d !important; text-shadow:none !important; }
html.gtm.gt-settings .fpset-ss:hover .fpset-ss-text, html.gtm.gt-settings .fpset-ss2:hover .fpset-ss-text { color:#fff !important; }
html.gtm.gt-settings .fpset-ss:hover .fpset-ss-desc, html.gtm.gt-settings .fpset-ss2:hover .fpset-ss-desc { color:#ece8e2 !important; }
html.gtm.gt-settings .fpset-ss2:hover .fpset-ss-bdisplay { background:${P.deep} !important; color:#fff !important; }
/* on/off switches become "‹ On ›" selectors */
html.gtm.gt-settings .gswitch { position:relative !important; display:block !important; width:100% !important; height:30px !important; margin:0 !important; }
html.gtm.gt-settings .gswitch input { position:absolute !important; inset:0 !important; width:100% !important; height:100% !important; margin:0 !important; opacity:0 !important; z-index:3; cursor:pointer; }
html.gtm.gt-settings .gswitch-slider { position:absolute !important; inset:0 !important; background:#e2dfda !important; border:0 !important; border-radius:0 !important; box-shadow:none !important; transition:background .18s !important;
  --a:#222; --b:rgba(0,0,0,.2); }
html.gtm.gt-settings .gswitch input:checked + .gswitch-slider { --a:rgba(0,0,0,.2); --b:#222; }
html.gtm.gt-settings .gswitch-slider::before { content:"Off" !important; position:absolute !important; inset:0 !important; left:0 !important; bottom:0 !important;
  width:auto !important; height:auto !important; transform:none !important; transition:none !important; background:none !important; border-radius:0 !important; box-shadow:none !important;
  display:flex; align-items:center; justify-content:center; padding-bottom:3px; font:400 12px 'Marcellus',serif; letter-spacing:.1em; text-transform:uppercase; color:#222; }
html.gtm.gt-settings .gswitch input:checked + .gswitch-slider::before { content:"On" !important; }
html.gtm.gt-settings .gswitch-slider::after { content:""; position:absolute; left:50%; bottom:4px; width:14px; height:4px; margin-left:-7px;
  background:radial-gradient(circle at 2px 2px, var(--a) 1.4px, transparent 1.9px), radial-gradient(circle at 12px 2px, var(--b) 1.4px, transparent 1.9px); }
html.gtm.gt-settings .gswitch::before, html.gtm.gt-settings .gswitch::after { position:absolute; top:0; bottom:0; z-index:2; display:flex; align-items:center;
  font:20px/1 'Marcellus',serif; color:#fff; opacity:0; pointer-events:none; transition:opacity .18s; }
html.gtm.gt-settings .gswitch::before { content:"‹"; left:10px; }
html.gtm.gt-settings .gswitch::after { content:"›"; right:10px; }
html.gtm.gt-settings .fpset-ss:hover .gswitch-slider, html.gtm.gt-settings .fpset-ss2:hover .gswitch-slider { background:${P.deep} !important; --a:#fff; --b:rgba(255,255,255,.35); }
html.gtm.gt-settings .fpset-ss:hover input:checked + .gswitch-slider, html.gtm.gt-settings .fpset-ss2:hover input:checked + .gswitch-slider { --a:rgba(255,255,255,.35); --b:#fff; }
html.gtm.gt-settings .fpset-ss:hover .gswitch-slider::before, html.gtm.gt-settings .fpset-ss2:hover .gswitch-slider::before { color:#fff; }
html.gtm.gt-settings .fpset-ss:hover .gswitch::before, html.gtm.gt-settings .fpset-ss:hover .gswitch::after,
html.gtm.gt-settings .fpset-ss2:hover .gswitch::before, html.gtm.gt-settings .fpset-ss2:hover .gswitch::after { opacity:1; }
/* black footer with Save / Reset */
html.gtm.gt-settings .frontpage-settings-c2::after { content:"Esc  ·  Back        Changes are saved when you leave"; white-space:pre; position:absolute; left:0; right:0; bottom:0; height:62px;
  z-index:1; display:flex; align-items:center; padding:0 300px 0 36px; overflow:hidden; background:#0e0e0f; font:11px 'Marcellus',serif; letter-spacing:.14em; text-transform:uppercase; color:#8a857e; }
html.gtm.gt-settings .frontpage-settings-save, html.gtm.gt-settings .frontpage-settings-reset {
  position:absolute !important; top:auto !important; left:auto !important; bottom:14px !important; z-index:2; transform:none !important;
  display:flex !important; align-items:center; width:auto !important; min-width:0 !important; height:34px !important; margin:0 !important; padding:0 20px !important;
  border-radius:0 !important; box-shadow:none !important; text-shadow:none !important; animation:none !important; filter:none !important; cursor:pointer;
  font:400 12px 'Cinzel',serif !important; letter-spacing:.16em !important; text-transform:uppercase; transition:background .2s, color .2s, border-color .2s;
}
html.gtm.gt-settings .frontpage-settings-save::before, html.gtm.gt-settings .frontpage-settings-save::after,
html.gtm.gt-settings .frontpage-settings-reset::before, html.gtm.gt-settings .frontpage-settings-reset::after { display:none !important; }
html.gtm.gt-settings .frontpage-settings-save { right:22px !important; background:${P.deep} !important; color:#fff !important; border:0 !important; }
html.gtm.gt-settings .frontpage-settings-save:hover { background:${P.hi} !important; }
html.gtm.gt-settings .frontpage-settings-reset { right:150px !important; background:transparent !important; color:#cfcac3 !important; border:1px solid #5a5652 !important; }
html.gtm.gt-settings .frontpage-settings-reset:hover { color:#fff !important; border-color:${P.hi} !important; }
html.gtm.gt-settings .frontpage-settings-c2 .frontpage-close-button { display:none !important; }
/* "press any key" while rebinding */
html.gtm.gt-settings .frontpage-settings-capture { position:fixed !important; inset:0 !important; width:auto !important; height:auto !important; margin:0 !important;
  padding-top:46vh !important; transform:none !important; z-index:2147483200 !important; text-align:center !important; background:rgba(8,8,9,.9) !important;
  font:700 26px 'Cinzel',serif !important; letter-spacing:.3em !important; color:#f1ede6 !important; text-shadow:0 0 22px rgba(${P.rgb},.6) !important; }
/* region switcher, moved into the settings list */
html.gtm #gt-region-sec .frontpage-menu-region-c { position:relative !important; inset:auto !important; transform:none !important; display:block !important;
  width:100% !important; height:30px !important; margin:0 !important; padding:0 !important; z-index:4; background:none !important; border:0 !important; box-shadow:none !important; outline:none; }
html.gtm #gt-region-sec .frontpage-menu-region { position:absolute !important; inset:0 !important; width:auto !important; height:auto !important; margin:0 !important; padding:0 10px !important;
  display:flex !important; align-items:center; justify-content:center; gap:6px; transform:none !important; cursor:pointer;
  background:#e2dfda !important; color:#222 !important; border:0 !important; border-radius:0 !important; box-shadow:none !important; text-shadow:none !important;
  font:400 12px 'Marcellus',serif !important; letter-spacing:.1em !important; text-transform:uppercase; }
html.gtm #gt-region-sec .frontpage-menu-region-o { display:inline !important; position:static !important; margin:0 !important; font:400 11px 'Marcellus',serif !important; text-transform:none; color:#6d6863 !important; }
html.gtm #gt-region-sec .fpset-ss2:hover .frontpage-menu-region { background:${P.deep} !important; color:#fff !important; }
html.gtm #gt-region-sec .fpset-ss2:hover .frontpage-menu-region-o { color:${P.pale} !important; }
html.gtm #gt-region-sec .frontpage-menu-regions { position:absolute !important; left:0 !important; right:0 !important; top:100% !important; bottom:auto !important; transform:none !important;
  width:auto !important; background:#f4f2ef !important; border:0 !important; border-radius:0 !important; box-shadow:0 10px 24px rgba(0,0,0,.25) !important; z-index:6; }
html.gtm #gt-region-sec .frontpage-menu-regions > * { background:none !important; color:#1c1c1c !important; border:0 !important; border-bottom:1px solid rgba(0,0,0,.06) !important;
  padding:8px 12px !important; text-shadow:none !important; cursor:pointer; font:400 12px 'Marcellus',serif !important; letter-spacing:.1em !important; text-transform:uppercase; }
html.gtm #gt-region-sec .frontpage-menu-regions > *:hover { background:${P.deep} !important; color:#fff !important; }
`;
  const style = document.createElement('style');
  style.id = 'gt-style';
  style.textContent = buildCSS(PALETTES[LOOK.tier === 'main' ? 'blue' : 'red']);
  (document.head || ROOT).appendChild(style);

  // ───────────────────────── TOGGLE ─────────────────────────
  addEventListener('keydown', (e) => {
    if (e.altKey && e.key && e.key.toLowerCase() === CONFIG.toggleKey) {
      const on = ROOT.classList.toggle('gtm');
      try { localStorage.setItem('gtm-off', on ? '0' : '1'); } catch (err) {}
      window.dispatchEvent(new Event('gtm-toggle'));
    }
  }, true);

  // ───────────────────────── LOADING SCREEN ─────────────────────────
  const THEMED = ROOT.classList.contains('gtm');
  const TASKS = [];
  function task(label) {
    const t = { label, done: false };
    TASKS.push(t);
    return () => { t.done = true; };
  }
  const T = {
    dom:     task('Reading the scroll'),
    fonts:   task('Sharpening the brush'),
    scene:   task('Painting the scene'),
    blade:   task('Forging the blade'),
    hideout: task('Opening the hideout'),
    outfits: task('Gathering outfits'),
    shop:    task('Stocking the shop'),
    clan:    task('Calling your clan'),
    msgs:    task('Collecting messages'),
    lb:      task('Ranking the warriors'),
    player:  task('Reading your record'),
    icons:   task('Painting portraits'),
    rank:    task('Checking the rankings'),
    arena:   task('Entering the arena'),
  };
  STATE.sceneReady = T.scene;
  if (THEMES.obj) T.scene();

  let loader = null, loaderDone = false, shownPct = 0;
  const loaderStart = performance.now();
  if (THEMED) {
    loader = document.createElement('div');
    loader.id = 'gt-loader';
    loader.innerHTML = `
      <div class="gl-door gl-left"></div><div class="gl-door gl-right"></div>
      <div class="gl-center">
        <div class="gl-seal">盗<br>賊</div>
        <div class="gl-title">SUPER BANDIT</div>
        <div class="gl-bar"><div class="gl-fill"></div></div>
        <div class="gl-row"><span class="gl-step">Awakening…</span><span class="gl-pct">0%</span></div>
        <div class="gl-welcome"><div class="gl-wel-a">Welcome,</div><div class="gl-wel-b"></div><div class="gl-wel-c"></div></div>
      </div>
      <div class="gl-slash"></div>
      ${emyOn() ? `<img class="gl-emy" src="${EMY_GIF}" alt="">` : ''}`;
    ROOT.appendChild(loader);
    // show Emy at half her natural size (hidden until sized, so there's no full-size flash)
    const emy = loader.querySelector('.gl-emy');
    if (emy) {
      const size = () => { emy.style.width = (emy.naturalWidth / 2) + 'px'; emy.style.visibility = 'visible'; };
      if (emy.complete && emy.naturalWidth) size();
      else { emy.onload = size; emy.onerror = () => emy.remove(); }
    }
    requestAnimationFrame(tickLoader);
    setTimeout(finishLoader, CONFIG.loadTimeout);
  }

  function tickLoader() {
    if (!loader || loaderDone) return;
    const done = TASKS.filter((t) => t.done).length;
    const target = (done / TASKS.length) * 100;
    shownPct += (target - shownPct) * 0.12;
    if (target - shownPct < 0.4) shownPct = target;
    loader.querySelector('.gl-fill').style.transform = `scaleX(${shownPct / 100})`;
    loader.querySelector('.gl-pct').textContent = Math.floor(shownPct) + '%';
    const next = TASKS.find((t) => !t.done);
    loader.querySelector('.gl-step').textContent = next ? next.label + '…' : 'Ready';
    if (!next && shownPct >= 100) { finishLoader(); return; }
    requestAnimationFrame(tickLoader);
  }

  function finishLoader() {
    if (!loader || loaderDone) return;
    loaderDone = true;
    const wait = Math.max(0, CONFIG.minLoadMs - (performance.now() - loaderStart));
    setTimeout(() => {
      if (!loader) return;
      loader.querySelector('.gl-fill').style.transform = 'scaleX(1)';
      loader.querySelector('.gl-pct').textContent = '100%';
      loader.querySelector('.gl-step').textContent = 'Ready';
      // angle of the diagonal cut between the two doors (53% at top → 47% at bottom)
      const ang = Math.atan2(0.06 * innerWidth, innerHeight) * 180 / Math.PI;
      loader.style.setProperty('--ang', ang.toFixed(2) + 'deg');
      const name = sd().username || 'Bandit';
      loader.querySelector('.gl-wel-b').textContent = name;
      loader.querySelector('.gl-wel-c').textContent = LOOK.tier === 'main' ? '★ ★ ★ ★   Hotel of the Elite' : '';
      setTimeout(() => loader && loader.classList.add('welcome'), 200);
      setTimeout(() => loader && loader.classList.add('done'), 1900);
      setTimeout(() => loader && loader.classList.add('slash'), 2300);
      setTimeout(() => loader && loader.classList.add('open'), 2700);
      setTimeout(firstRunPicker, 3000);          // new users pick a scene as the doors open
      setTimeout(() => { if (loader) { loader.remove(); loader = null; } }, 4100);
    }, wait);
  }

  // progress sources
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', T.dom); else T.dom();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(T.fonts, T.fonts); else T.fonts();
  if (document.readyState === 'complete') T.arena(); else window.addEventListener('load', T.arena);

  // ───────────────────────── HELPERS ─────────────────────────
  const sd = () => PAGE.SERVERDATA || {};

  // unread count from the game's (now hidden) topbar mail/notification button
  const readUnread = () => parseInt((document.querySelector('.topbar-notif') || {}).textContent, 10) || 0;
  function setUnread(n) {
    STATE.unread = n;
    if (setBtn) setBtn.classList.toggle('gt-unread', n > 0);
    if (!hub) return;
    const badge = hub.querySelector('.gh-badge');
    if (badge) { badge.textContent = n > 99 ? '99+' : String(n); badge.style.display = n > 0 ? '' : 'none'; }
  }

  function applyLook(changes) {
    Object.assign(LOOK, changes);
    try { localStorage.setItem('gtm-look', JSON.stringify(LOOK)); } catch (err) {}
    style.textContent = buildCSS(PALETTES[LOOK.tier === 'main' ? 'blue' : 'red']);
    ROOT.classList.toggle('gt-gold', !!LOOK.gold);
    ROOT.dataset.gtTier = LOOK.tier;
    if (STATE.onLook) STATE.onLook();
    applyScene();          // "Auto" scene follows the clan tier
    updateSceneRow();
  }
  function resolveTier() {
    const S = sd();
    if ((S.username || '').toLowerCase() === OWNER) return 'main';
    if (S.clan === MAIN_CLAN) return 'main';
    if (S.clan === SUB_CLAN) return 'sub';
    return 'none';
  }

  // ── Leaderboard placings → profile medals (and the gold hilt if you're #1 anywhere). Cached 30 min. ──
  // Tier by how high you sit on the board: top 20% gold · top 40% silver · top 60% bronze · anywhere else on it = steel.
  // Medals sort by tier first, then board: Level → Ranked → bandit Mastery → any other board, then by position.
  const FEATURED_MEDALS = 3;                          // how many get the big slot at the top of the profile
  const MEDAL_CAT = { level: 0, ranked: 1, mastery: 2, other: 3 };
  const MEDAL_TIER = [null,
    { k: 'gold',   n: 'Gold',   d: 'Top 20% of the board' },
    { k: 'silver', n: 'Silver', d: 'Top 40% of the board' },
    { k: 'bronze', n: 'Bronze', d: 'Top 60% of the board' },
    { k: 'steel',  n: 'Steel',  d: 'On the leaderboard' }];
  const sortMedals = (list) => list.sort((a, b) =>
    a.tier - b.tier || MEDAL_CAT[a.cat] - MEDAL_CAT[b.cat] || a.pos - b.pos || b.total - a.total);
  const medalLabel = (m) => (m.cat === 'mastery'
    ? (EXTRA.mastery[m.board] && EXTRA.mastery[m.board].name) || NAMES[m.board] || m.board
    : m.label);

  // a leaderboard's own heading, if it has one ("Level", "Kills", …)
  function boardTitle(lb) {
    const own = lb.querySelector('[class*="title"], h1, h2, h3, h4');
    if (own && own.textContent.trim()) return own.textContent.trim();
    let p = lb.previousElementSibling;
    for (let k = 0; p && k < 2; k++, p = p.previousElementSibling) {
      if (/^H\d$/.test(p.tagName) || /title/i.test(p.className)) return p.textContent.trim();
    }
    return '';
  }

  async function checkRankings() {
    try {
      const u = (sd().username || '').toLowerCase();
      if (!u) { applyLook({ gold: false, firsts: [], medals: [] }); return; }
      let cache = null;
      try { cache = JSON.parse(localStorage.getItem('gtm-rank') || 'null'); } catch (err) {}
      if (cache && cache.user === u && cache.medals && Date.now() - cache.t < 30 * 60 * 1000) {
        applyLook({ gold: cache.firsts.length > 0, firsts: cache.firsts, medals: cache.medals });
        return;
      }
      const boards = ['', 'ranked', ...Object.keys(sd().allcost || {})];
      const medals = [];
      await Promise.all(boards.map(async (b) => {
        try {
          const html = await (await fetch('/leaderboards' + (b ? '/' + b : ''), { credentials: 'same-origin' })).text();
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const lbs = [...doc.querySelectorAll('.leaderboard')];
          lbs.forEach((lb, i) => {
            const rows = [...lb.querySelectorAll('.leaderboard-entry')];
            const me = rows.findIndex((r) => {
              const a = r.querySelector('a.leaderboard-entry-username');
              return a && a.textContent.trim().toLowerCase() === u;
            });
            if (me < 0) return;
            const posTxt = (rows[me].querySelector('.leaderboard-entry-position') || {}).textContent || '';
            const pos = parseInt(posTxt.replace(/[^\d]/g, ''), 10) || me + 1;
            const total = Math.max(rows.length, pos);
            const title = boardTitle(lb).slice(0, 24);
            let cat, label;
            if (b === 'ranked') { cat = 'ranked'; label = lbs.length > 1 && title ? 'Ranked · ' + title : 'Ranked'; }
            else if (b) { cat = 'mastery'; label = NAMES[b] || b; }
            // the main /leaderboards page: the level board is the one titled "level"/"exp", or the first one if untitled
            else if (/level|lvl|\bexp|\bxp/i.test(title) || (!title && i === 0)) { cat = 'level'; label = 'Level'; }
            else { cat = 'other'; label = title || 'Leaderboard'; }
            const r = pos / total;
            const tier = r <= .2 ? 1 : r <= .4 ? 2 : r <= .6 ? 3 : 4;
            medals.push({ cat, label, board: b, pos, total, tier });
          });
        } catch (err) {}
      }));
      sortMedals(medals);
      const firsts = medals.filter((m) => m.pos === 1).map(medalLabel);
      try { localStorage.setItem('gtm-rank', JSON.stringify({ user: u, t: Date.now(), firsts, medals })); } catch (err) {}
      applyLook({ gold: firsts.length > 0, firsts, medals });
    } finally {
      T.rank();
      renderProfile();
    }
  }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => { const x = Number(n); return isFinite(x) ? x.toLocaleString('en-US') : esc(n); };

  // ───────────────────────── BOOT ─────────────────────────
  let tries = 0;
  function whenReady() {
    const host = document.querySelector('.frontpage-menu-c');
    const menu = document.querySelector('.frontpage-menu');
    const list = document.querySelector('.frontpage-menu-menu');
    if (host && menu && list) { init(host, menu, list); return; }
    if (++tries < 200) setTimeout(whenReady, 100);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', whenReady);
  else setTimeout(whenReady, 0);

  function init(host, menu, list) {
    if (!document.getElementById('gt-title')) {
      const t = document.createElement('div');
      t.id = 'gt-title';
      t.innerHTML = `<div class="gt-sup">SUPER</div><div class="gt-main">BANDIT</div><div class="gt-line"></div><div class="gt-seal"><span>盗</span><span>賊</span></div>`;
      menu.insertBefore(t, list);
    }
    startScene(host);
    applyLook({ tier: resolveTier() });
    setupProfileButton();
    setupMenuButtons(list);
    buildHub();
    placeRegion(ROOT.classList.contains('gtm'));
    setUnread(readUnread());
    loadPlayer();
    loadIcons();
    checkRankings();
    if (THEMED) ensureFrames();   // preload every hub page behind the loading screen
    else for (const k of ['hideout', 'outfits', 'shop', 'clan', 'msgs', 'lb']) T[k]();
  }

  // ───────────────────────── PROFILE BUTTON (replaces SETTINGS) ─────────────────────────
  let bypass = false, setBtn = null;
  function setupProfileButton() {
    setBtn = document.querySelector('.frontpage-menu-menu-settings');
    if (!setBtn) return;
    setBtn.dataset.gtOrig = setBtn.innerHTML;
    applyBtn();
    window.addEventListener('gtm-toggle', () => {
      const on = ROOT.classList.contains('gtm');
      applyBtn(); placeRegion(on);
      if (!on) closeHub();
    });

    // swallow the game's own settings handler and open the hub instead
    ['pointerdown', 'mousedown', 'touchstart', 'mouseup', 'click'].forEach((type) => {
      window.addEventListener(type, (e) => {
        if (bypass || !ROOT.classList.contains('gtm')) return;
        const b = e.target && e.target.closest && e.target.closest('.frontpage-menu-menu-settings');
        if (!b) return;
        e.stopImmediatePropagation();
        if (type !== 'touchstart') e.preventDefault();
        if (type === 'click') openHub('profile');
      }, true);
    });
  }
  function applyBtn() {
    if (!setBtn) return;
    if (ROOT.classList.contains('gtm')) {
      setBtn.textContent = 'PROFILE';
      const tick = document.createElement('span');
      tick.className = 'gt-tick';
      setBtn.appendChild(tick);
      const u = document.createElement('span');
      u.className = 'gt-user';
      u.textContent = sd().username || '';
      setBtn.appendChild(u);
      setBtn.classList.toggle('gt-unread', STATE.unread > 0);
    } else {
      setBtn.innerHTML = setBtn.dataset.gtOrig;
      setBtn.classList.remove('gt-unread');
    }
  }
  function openNativeSettings() {
    if (!setBtn) return;
    bypass = true;
    try { setBtn.click(); } finally { bypass = false; }
  }

  // ───────────────────────── SETTINGS (native panel, shown inside the hub) ─────────────────────────
  const setBox = () => document.querySelector('.frontpage-settings-c');
  const shown = (el) => {
    if (!el || !el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > .05;
  };
  // true while the game is waiting for a key to bind (the hub must not eat Q / E / Esc then)
  const capturing = () => STATE.settingsOpen && shown(document.getElementById('frontpage-settings-capture'));

  let leaveTimer = 0;
  function enterSettings() {
    clearTimeout(leaveTimer);
    ROOT.classList.add('gt-settings');
    if (STATE.settingsOpen && shown(setBox())) return;
    STATE.settingsOpen = true;
    placeRegion(true);
    placeLookRows();
    if (!shown(setBox())) { openNativeSettings(); setTimeout(placeLookRows, 50); }
  }
  function leaveSettings() {
    if (!STATE.settingsOpen) return;
    STATE.settingsOpen = false;
    const box = setBox();
    const save = box && box.querySelector('.frontpage-settings-save');
    if (save) save.click();                       // keep whatever was changed
    leaveTimer = setTimeout(() => {
      if (box && shown(box)) { const c = box.querySelector('.frontpage-close-button'); if (c) c.click(); }
      leaveTimer = setTimeout(() => ROOT.classList.remove('gt-settings'), 350);
    }, 60);
  }

  // The region switcher lives in the settings list while the theme is on.
  let regionHome = null;
  function placeRegion(inSettings) {
    const r = document.querySelector('.frontpage-menu-region-c');
    const c4 = document.querySelector('.frontpage-settings-c4');
    if (!r || !c4) return;
    if (!regionHome) regionHome = { parent: r.parentNode, next: r.nextSibling };
    if (inSettings) {
      let sec = document.getElementById('gt-region-sec');
      if (!sec) {
        sec = document.createElement('div');
        sec.id = 'gt-region-sec';
        sec.innerHTML = `<div class="fpset-section-title">GAME</div>
          <div class="fpset-ss2 gt-region-row"><div class="fpset-ss-text">Server region</div><div class="gt-region-slot"></div>
          <div class="fpset-ss-desc">Pick the server closest to you for the lowest ping.</div></div>`;
        const title = c4.querySelector('.fpset-title');
        if (title) title.after(sec); else c4.prepend(sec);
      }
      const slot = sec.querySelector('.gt-region-slot');
      if (r.parentNode !== slot) slot.appendChild(r);
    } else if (regionHome.parent && r.parentNode !== regionHome.parent) {
      const next = regionHome.next && regionHome.next.parentNode === regionHome.parent ? regionHome.next : null;
      regionHome.parent.insertBefore(r, next);
    }
  }

  // "Appearance" rows in the settings list: Scene picker + Dancing Emy switch
  function placeLookRows() {
    const c4 = document.querySelector('.frontpage-settings-c4');
    if (!c4) return;
    if (!document.getElementById('gt-look-sec')) {
      const sec = document.createElement('div');
      sec.id = 'gt-look-sec';
      sec.innerHTML = `<div class="fpset-section-title">APPEARANCE</div>
        <div class="fpset-ss2 gt-scene-row"><div class="fpset-ss-text">Scene</div><div class="fpset-ss-bdisplay gt-scene-val"></div>
          <div class="fpset-ss-desc">The menu background. Auto picks one for your clan. Click the left half of the box to go back.</div></div>
        <div class="fpset-ss2 gt-emy-row"><div class="fpset-ss-text">Dancing Emy</div>
          <div class="fpset-ss-button"><label class="gswitch"><input type="checkbox"><span class="gswitch-slider"></span></label></div>
          <div class="fpset-ss-desc">Show Emy dancing at the bottom of the loading screen.</div></div>`;

      sec.querySelector('.gt-scene-row').addEventListener('click', (e) => {
        const opts = ['auto', ...THEMES.list.map((x) => x.id)];
        const box = e.currentTarget.querySelector('.gt-scene-val').getBoundingClientRect();
        const back = e.clientX >= box.left && e.clientX < box.left + box.width / 2;
        let i = opts.indexOf(scenePref());
        if (i < 0) i = 0;
        const next = opts[(i + (back ? -1 : 1) + opts.length) % opts.length];
        try { localStorage.setItem('gtm-scene', next); } catch (err) {}
        updateSceneRow();
        applyScene();
      });

      const input = sec.querySelector('.gt-emy-row input');
      input.checked = emyOn();
      input.addEventListener('change', () => {
        try { localStorage.setItem('gtm-emy', input.checked ? '1' : '0'); } catch (err) {}
      });
      // clicking anywhere on the row flips it, like the game's own rows
      sec.querySelector('.gt-emy-row').addEventListener('click', (e) => {
        if (e.target.closest('.gswitch')) return;
        input.checked = !input.checked;
        input.dispatchEvent(new Event('change'));
      });

      const after = document.getElementById('gt-region-sec') || c4.querySelector('.fpset-title');
      if (after) after.after(sec); else c4.prepend(sec);
    }
    updateSceneRow();
  }
  function updateSceneRow() {
    const v = document.querySelector('#gt-look-sec .gt-scene-val');
    if (!v) return;
    const p = scenePref();
    const label = p !== 'auto' && hasTheme(p) ? themeName(p) : 'Auto · ' + themeName(sceneId());
    v.textContent = '‹  ' + label + '  ›';
  }
  STATE.onThemes = updateSceneRow;

  // ───────────────────────── THEMES POPUP ─────────────────────────
  // Opened by the THEME menu button, and once on first run (first: true) so new users pick a scene.
  // Hovering a tile previews it live behind the popup.
  function firstRunPicker() {
    let chosen = null;
    try { chosen = localStorage.getItem('gtm-scene'); } catch (e) { return; }
    if (chosen || THEMES.list.length < 2) return;
    openThemes({ first: true });
  }

  function openThemes(opts) {
    const first = !!(opts && opts.first);
    if (document.getElementById('gt-themes') || !THEMES.list.length || !ROOT.classList.contains('gtm')) return;
    const ids = THEMES.list.map((x) => x.id);
    let sel = sceneId();
    if (!ids.includes(sel)) sel = ids[0];

    const box = document.createElement('div');
    box.id = 'gt-themes';
    box.innerHTML = `
      <div class="gs-panel" role="dialog" aria-label="Themes">
        <div class="gs-top">${first ? '<div class="gs-sup">Welcome</div>' : ''}
          <div class="gs-title">${first ? 'Choose your scene' : 'Themes'}</div>
          <div class="gs-hint">Hover to preview · click to ${first ? 'select' : 'equip'}</div>
          ${first ? '' : '<div class="gs-x" title="Close">✕</div>'}</div>
        <div class="gs-grid">${THEMES.list.map((x) => `
          <div class="gs-tile" data-id="${esc(x.id)}">
            <div class="gs-pic"><div class="gs-k">景</div><div class="gs-tag"></div></div>
            <div class="gs-name">${esc(x.name)}</div>
          </div>`).join('')}</div>
        <div class="gs-foot"><span>${first ? 'Change it any time with the Theme button' : '<b>Esc</b>Back'}</span>
          <button class="gs-done">${first ? 'Enter' : 'Done'}</button></div>
      </div>`;
    document.body.appendChild(box);
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('in')));

    const preview = (id) => { THEMES.preview = id; applyScene(); };
    const save = () => { try { localStorage.setItem('gtm-scene', sel); } catch (e) {} updateSceneRow(); };
    const mark = () => box.querySelectorAll('.gs-tile').forEach((t) => {
      t.classList.toggle('sel', t.dataset.id === sel);
      t.querySelector('.gs-tag').textContent = first ? 'Selected' : (scenePref() === 'auto' ? 'Auto' : 'Equipped');
    });
    const onKey = (e) => {
      if (e.key === 'Escape' && !first) close();
      else if (e.key === 'Enter') close();
      else return;
      e.preventDefault(); e.stopImmediatePropagation();
    };
    function close() {
      if (first) save();
      THEMES.preview = null;
      applyScene();
      removeEventListener('keydown', onKey, true);
      box.classList.remove('in');
      setTimeout(() => box.remove(), 400);
    }

    box.addEventListener('mouseover', (e) => { const t = e.target.closest('.gs-tile'); if (t) preview(t.dataset.id); });
    box.querySelector('.gs-grid').addEventListener('mouseleave', () => preview(sel));
    box.addEventListener('click', (e) => {
      const t = e.target.closest('.gs-tile');
      if (t) { sel = t.dataset.id; if (!first) save(); mark(); preview(sel); return; }
      if (e.target.closest('.gs-done, .gs-x')) { close(); return; }
      if (e.target === box && !first) close();           // click outside the panel
    });
    addEventListener('keydown', onKey, true);
    mark(); preview(sel);

    // fill in the preview pictures one at a time
    (async () => {
      for (const x of THEMES.list) {
        const url = await themeThumb(x);
        const pic = box.querySelector(`.gs-tile[data-id="${x.id}"] .gs-pic`);
        if (!box.isConnected || !pic) return;
        pic.classList.add('ready');
        if (!url) continue;
        const img = new Image();
        img.alt = '';
        img.onload = () => img.classList.add('ok');
        img.src = url;
        pic.prepend(img);
      }
    })();
  }

  // Preview picture for a theme: the hand-made image from themes.txt if there is one,
  // otherwise a snapshot rendered from the theme itself (cached until the theme file changes).
  const thumbs = {};
  const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(src); i.onerror = () => res(null); i.src = src; });
  const hashStr = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + '.' + str.length; };
  function themeThumb(x) {
    if (thumbs[x.id]) return thumbs[x.id];
    return (thumbs[x.id] = (async () => {
      if (x.img) {
        const url = await loadImg(/^https?:/i.test(x.img) ? x.img : CONFIG.themeBase + x.img);
        if (url) return url;
      }
      await loadTheme(x.id);
      const code = THEMES.code[x.id];
      if (!code) return null;
      const key = 'gtm-thumb:' + x.id, sig = hashStr(code);
      try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c && c.sig === sig) return c.url; } catch (e) {}
      await new Promise((r) => setTimeout(r, 40));        // let the popup paint before the heavy render
      const url = renderThumb(x.id, code);
      if (url) { try { localStorage.setItem(key, JSON.stringify({ sig, url })); } catch (e) {} }
      return url;
    })());
  }
  // Runs a separate copy of the theme on a hidden canvas, so the live menu scene isn't disturbed.
  function renderThumb(id, code) {
    let th = null;
    try { new Function('BanditTheme', code)((d) => { th = d; }); } catch (e) { return null; }
    if (!th || typeof th.drawBack !== 'function') return null;
    const W = 1280, H = 720;
    const off = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return [c, c.getContext('2d')]; };
    const [big, ctx] = off(W, H);
    const env = { ctx, off, config: Object.assign({}, CONFIG, { lightning: false }), W, H, DPR: 1, t: 0, parX: 0, parY: 0, flash: 0, tier: LOOK.tier, gold: !!LOOK.gold };
    try {
      if (th.build) th.build(env);
      for (let i = 0; i < 12; i++) {
        env.t += 1 / 20;
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        th.drawBack(env.t, 1 / 20, env);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        if (th.drawFront) th.drawFront(env.t, 1 / 20, env);
      }
      const [small, sx] = off(480, 270);
      sx.drawImage(big, 0, 0, 480, 270);
      return small.toDataURL('image/jpeg', .85);
    } catch (err) {
      console.warn('[Bandit.RIP] could not draw a preview of scene "' + id + '":', err);
      return null;
    }
  }

  // THEME and MODS buttons, right under PROFILE on the main menu
  let menuBtns = null;
  function setupMenuButtons(list) {
    if (menuBtns) return;
    const make = (label, open) => {
      const btn = document.createElement('div');
      btn.className = 'frontpage-menu-menu-button gt-theme-btn';
      btn.textContent = label;
      // keep the game's own menu handlers from reacting to it
      ['pointerdown', 'mousedown', 'touchstart', 'mouseup', 'click'].forEach((type) => btn.addEventListener(type, (e) => {
        e.stopPropagation();
        if (type === 'click') open();
      }));
      return btn;
    };
    menuBtns = [make('THEME', () => openThemes()), make('MODS', () => openMods())];
    if (setBtn && setBtn.parentNode) setBtn.after(...menuBtns); else list.append(...menuBtns);
  }

  // Mod menu: every mod listed in mods/mods.txt with an On/Off switch. Changes apply on the next page load.
  function openMods() {
    if (document.getElementById('gt-themes') || !ROOT.classList.contains('gtm')) return;
    const startOn = MODS.on.slice().sort().join();
    const box = document.createElement('div');
    box.id = 'gt-themes';
    const rows = () => MODS.list.length
      ? MODS.list.map((m) => `
          <div class="gmr" data-id="${esc(m.id)}">
            <div><div class="gmr-n">${esc(m.name)}</div>${m.desc ? `<div class="gmr-d">${esc(m.desc)}</div>` : ''}</div>
            <div class="gmr-sw${modOn(m.id) ? ' on' : ''}"><span>Off</span><span>On</span></div>
          </div>`).join('')
      : `<div class="gs-empty">No mods available yet.</div>`;
    box.innerHTML = `
      <div class="gs-panel" role="dialog" aria-label="Mods">
        <div class="gs-top"><div class="gs-title">Mods</div>
          <div class="gs-hint">Click to switch on or off</div><div class="gs-x" title="Close">✕</div></div>
        <div class="gs-list">${rows()}</div>
        <div class="gs-foot"><span class="gs-note"><b>Esc</b>Back · changes apply after a reload</span>
          <div class="gs-foot-r"><button class="gs-reload" hidden>Reload now</button><button class="gs-done">Done</button></div></div>
      </div>`;
    document.body.appendChild(box);
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('in')));

    const reloadBtn = box.querySelector('.gs-reload');
    const syncReload = () => { reloadBtn.hidden = MODS.on.slice().sort().join() === startOn; };
    STATE.onMods = () => { box.querySelector('.gs-list').innerHTML = rows(); };   // list refreshed from GitHub
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault(); e.stopImmediatePropagation();
      close();
    };
    function close() {
      STATE.onMods = null;
      removeEventListener('keydown', onKey, true);
      box.classList.remove('in');
      setTimeout(() => box.remove(), 400);
    }
    box.addEventListener('click', (e) => {
      const row = e.target.closest('.gmr');
      if (row) {
        const on = !modOn(row.dataset.id);
        setModOn(row.dataset.id, on);
        row.querySelector('.gmr-sw').classList.toggle('on', on);
        syncReload();
        return;
      }
      if (e.target.closest('.gs-reload')) { location.reload(); return; }
      if (e.target.closest('.gs-done, .gs-x') || e.target === box) close();
    });
    addEventListener('keydown', onKey, true);
  }

  // ───────────────────────── HUB ─────────────────────────
  const TABS = [
    { key: 'profile',      label: 'Profile' },
    { key: 'clan',         label: 'Clan',         task: 'clan',    src: () => (sd().clan ? '/clan/' + encodeURIComponent(sd().clan) : null) },
    { key: 'outfits',      label: 'Outfits',      task: 'outfits', src: () => '/hideout/costumes/' },
    { key: 'hideout',      label: 'Hideout',      task: 'hideout', src: () => '/hideout/' },
    { key: 'shop',         label: 'Shop',         task: 'shop',    src: () => '/shop' },
    { key: 'messages',     label: 'Messages',     task: 'msgs',    src: () => '/hideout/messages/' },
    { key: 'leaderboards', label: 'Leaderboards', task: 'lb',      src: () => '/leaderboards' },
    { key: 'options',      label: 'Settings' },
  ];
  let hub = null, curTab = 'profile';

  function buildHub() {
    if (hub) return;
    hub = document.createElement('div');
    hub.id = 'gt-hub';
    hub.innerHTML = `
      <div class="gh-top">
        <div class="gh-key" data-nav="-1">Q</div>
        <nav class="gh-tabs"><div class="gh-pill"></div>${TABS.map((t) =>
          `<div class="gh-tab${t.key === curTab ? ' active' : ''}" data-tab="${t.key}">${t.label}</div>`).join('')}</nav>
        <div class="gh-key" data-nav="1">E</div>
        <div class="gh-cur"></div>
        <div class="gh-mail" data-go="notifs" title="Notifications">${MAIL_SVG}<span class="gh-badge" style="display:none"></span></div>
        <a class="gh-out" href="/signout" title="Sign out">Sign out</a>
      </div>
      <div class="gh-body">
        <section class="gh-panel active" data-tab="profile"></section>
        ${TABS.filter((t) => t.src).map((t) => `<section class="gh-panel frame" data-tab="${t.key}"></section>`).join('')}
        <section class="gh-panel frame" data-tab="notifs"></section>
        <section class="gh-panel" data-tab="options"><div class="gh-setwait">Opening settings…<button class="gp-btn" data-reopen>Open settings</button></div></section>
      </div>
      <div class="gh-foot"><span>Esc</span>Back</div>`;
    document.body.appendChild(hub);
    renderProfile();

    hub.addEventListener('click', (e) => {
      const tab = e.target.closest('.gh-tab');
      if (tab) { showTab(tab.dataset.tab); return; }
      const nav = e.target.closest('[data-nav]');
      if (nav) { stepTab(+nav.dataset.nav); return; }
      if (e.target.closest('.gh-foot')) { closeHub(); return; }
      if (e.target.closest('[data-reopen]')) { STATE.settingsOpen = false; enterSettings(); return; }
      const card = e.target.closest('.gp-card');
      if (card) { showSection(card.dataset.sec); return; }
      const go = e.target.closest('[data-go]');
      if (go) { showTab(go.dataset.go); return; }
      const node = e.target.closest('.gt-node');
      if (node) selectNode(node);
    });
    hub.addEventListener('mouseover', (e) => {
      const node = e.target.closest && e.target.closest('.gt-node, .gm');
      if (node) showDetail(node);
    });
    // a portrait that fails to load falls back to the initials underneath it
    hub.addEventListener('error', (e) => { if (e.target && e.target.tagName === 'IMG') e.target.remove(); }, true);

    window.addEventListener('keydown', (e) => {
      if (!STATE.hubOpen || capturing()) return;
      const k = e.key;
      if (k === 'Escape') closeHub();
      else if (k === 'q' || k === 'Q') stepTab(-1);
      else if (k === 'e' || k === 'E') stepTab(1);
      else return;
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);
    window.addEventListener('resize', movePill);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(movePill);
  }

  function makeFrame(panel, key, label, src, onFirst) {
    const f = document.createElement('iframe');
    f.name = 'gtembed-' + key;   // tells the script inside the frame to run in embed mode
    f.title = label;
    f.src = src;
    let first = true;
    f.addEventListener('load', () => {
      let ok = true;
      try { const d = f.contentDocument; ok = !!d && d.URL !== 'about:blank'; } catch (err) { ok = false; }
      if (!ok && !panel.querySelector('.gh-fail')) {
        const fb = document.createElement('div');
        fb.className = 'gh-fail';
        fb.innerHTML = `This page can't be shown here.<a href="${esc(src)}" target="_blank" rel="noopener">Open ${esc(label)} ↗</a>`;
        panel.appendChild(fb);
      }
      if (first) { first = false; if (onFirst) onFirst(); }
    });
    panel.appendChild(f);
  }

  function ensureFrames() {
    if (ensureFrames.done || !hub) return;
    ensureFrames.done = true;
    for (const t of TABS) {
      if (!t.src) continue;
      const panel = hub.querySelector(`.gh-panel[data-tab="${t.key}"]`);
      const finish = T[t.task];
      const src = t.src();
      if (!src) {
        panel.innerHTML = `<div class="gh-fail">You're not in a clan yet.<a href="/hideout/" target="_blank" rel="noopener">Find one in the Hideout</a></div>`;
        finish();
        continue;
      }
      makeFrame(panel, t.key, t.label, src, finish);
    }
  }

  // Notifications load only when you open them (preloading could mark them read before you've seen them).
  function ensureNotifs() {
    const panel = hub.querySelector('.gh-panel[data-tab="notifs"]');
    if (!panel || panel.querySelector('iframe')) return;
    makeFrame(panel, 'notifs', 'Notifications', '/notifications');
  }

  function openHub(tab) {
    if (!hub) return;
    ensureFrames();
    renderProfile();
    hub.classList.add('open');
    STATE.hubOpen = true;
    if (tab && tab !== curTab) showTab(tab);
    else if (curTab === 'options') enterSettings();
    requestAnimationFrame(movePill);
  }
  function closeHub() {
    if (!hub) return;
    if (curTab === 'options') leaveSettings();
    hub.classList.remove('open');
    STATE.hubOpen = false;
  }

  const tabIndex = (k) => { const i = TABS.findIndex((t) => t.key === k); return i < 0 ? TABS.length : i; };
  function showTab(key) {
    if (key === 'notifs') { ensureNotifs(); setUnread(0); }
    if (key === curTab) { if (key === 'options') enterSettings(); return; }
    const dir = tabIndex(key) > tabIndex(curTab) ? 1 : -1;
    const oldP = hub.querySelector(`.gh-panel[data-tab="${curTab}"]`);
    const newP = hub.querySelector(`.gh-panel[data-tab="${key}"]`);
    if (!newP) return;
    if (curTab === 'options') leaveSettings();
    if (oldP) { oldP.style.setProperty('--x', (-dir * 28) + 'px'); oldP.classList.remove('active'); }
    newP.style.transition = 'none';
    newP.style.setProperty('--x', (dir * 28) + 'px');
    void newP.offsetWidth;          // commit the start position before animating in
    newP.style.transition = '';
    newP.classList.add('active');
    curTab = key;
    movePill();
    if (key === 'options') enterSettings();
  }
  function stepTab(d) {
    const keys = TABS.map((t) => t.key);
    const i = (keys.indexOf(curTab) + d + keys.length) % keys.length;
    showTab(keys[i]);
  }
  function movePill() {
    if (!hub) return;
    const tab = hub.querySelector(`.gh-tab[data-tab="${curTab}"]`);
    hub.querySelectorAll('.gh-tab').forEach((el) => el.classList.toggle('active', el === tab));
    const mail = hub.querySelector('.gh-mail');
    if (mail) mail.classList.toggle('active', curTab === 'notifs');
    const pill = hub.querySelector('.gh-pill');
    if (!pill) return;
    if (tab) { pill.style.opacity = '1'; pill.style.left = tab.offsetLeft + 'px'; pill.style.width = tab.offsetWidth + 'px'; }
    else pill.style.opacity = '0';
  }

  // ───────────────────────── PROFILE PAGE ─────────────────────────
  // Fallback display names (the real ones are read from your player page when it loads).
  const NAMES = {
    magekid: 'Olif', dai: 'Dai', emy: 'Emy', pboi: 'Pico', janko: 'Lt. Janko', jonjon: 'Jon Jon', bigb: 'Big B',
    sniper: 'Donte', zetoman: 'Zetoman', samurai: 'Kaizen', revis: 'Revis', nero: 'Nero', samrival: 'Rekisu',
    bazooka: 'Dr. U', hunt: 'Huntt', evilolif: 'Ubel',
  };
  // /bandits/<slug> page for each internal key (only three differ)
  const SLUG = { magekid: 'olif', sniper: 'donte', pboi: 'pico' };
  const EXTRA = { stats: {}, mastery: {}, order: [], icons: {} };

  // Reads KDR, kills/deaths and bandit mastery levels from your public player page.
  async function loadPlayer() {
    try {
      const u = sd().username;
      if (!u) return;
      const r = await fetch('/player/@' + encodeURIComponent(u), { credentials: 'same-origin' });
      const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
      doc.querySelectorAll('.playerpage-profile-stats').forEach((el) => {
        const m = el.textContent.trim().match(/^([A-Z ]+):\s*([\d.,]+)/i);
        if (m) EXTRA.stats[m[1].trim().toUpperCase()] = m[2];
      });
      doc.querySelectorAll('a.playerpage-profile-cl-c').forEach((a) => {
        const k = (a.getAttribute('href') || '').split('/').filter(Boolean).pop();
        if (!k) return;
        const name = (a.firstChild && a.firstChild.textContent || '').trim();
        const lvl = parseInt((a.querySelector('span') || {}).textContent, 10);
        EXTRA.mastery[k] = { name, lvl: isFinite(lvl) ? lvl : null };
        EXTRA.order.push(k);
      });
    } catch (err) { /* keep fallbacks */ }
    finally { T.player(); renderProfile(); }
  }

  // Finds each bandit's preview image on its /bandits page (cached), then preloads the images.
  async function loadIcons() {
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem('gtm-icons') || '{}'); } catch (err) {}
    const keys = Object.keys(sd().allcost || {});
    await Promise.all(keys.map(async (k) => {
      if (cache[k]) return;
      try {
        const html = await (await fetch('/bandits/' + (SLUG[k] || k), { credentials: 'same-origin' })).text();
        const m = html.match(/https?:\/\/cdn1\.bandit\.rip\/imgs\/bandits\/[^"'\s)<>]+/);
        if (m) cache[k] = m[0].replace(/&amp;/g, '&');
      } catch (err) {}
    }));
    for (const k of keys) if (!cache[k]) cache[k] = `https://cdn1.bandit.rip/imgs/bandits/${k}.png`;
    EXTRA.icons = cache;
    try { localStorage.setItem('gtm-icons', JSON.stringify(cache)); } catch (err) {}
    await Promise.race([
      Promise.all(keys.map((k) => new Promise((res) => { const i = new Image(); i.onload = i.onerror = res; i.src = cache[k]; }))),
      new Promise((res) => setTimeout(res, 5000)),
    ]);
    T.icons();
    renderProfile();
  }
  // Bandits everyone starts with; the rest count as unlocked only if they're in SERVERDATA.unlo.
  const DEFAULT_BANDITS = ['magekid', 'dai', 'emy', 'pboi', 'janko', 'jonjon', 'bigb', 'sniper'];

  function bandits() {
    const S = sd(), all = S.allcost || {}, unlo = S.unlo || [];
    const list = Object.keys(all).map((k) => {
      const m = EXTRA.mastery[k] || {};
      return {
        k, name: m.name || NAMES[k] || (k.charAt(0).toUpperCase() + k.slice(1)),
        lvl: m.lvl ?? null,
        icon: EXTRA.icons[k] || null,
        outfits: (all[k] || []).length,
        unlocked: DEFAULT_BANDITS.includes(k) || unlo.includes(k),
      };
    });
    // highest mastery first, like the player page
    return list.sort((a, b) => (b.lvl ?? -1) - (a.lvl ?? -1));
  }

  const TREE_POS = [[75, 40], [40, 116], [110, 116], [75, 166], [40, 216], [110, 216], [75, 266]];
  const TREE_LINES = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [4, 6], [5, 6]];
  function tree(title, nodes) {
    const n = Math.min(nodes.length, TREE_POS.length);
    const h = TREE_POS[n - 1][1] + 40;
    const lines = TREE_LINES.filter(([a, b]) => a < n && b < n).map(([a, b]) =>
      `<line x1="${TREE_POS[a][0]}" y1="${TREE_POS[a][1]}" x2="${TREE_POS[b][0]}" y2="${TREE_POS[b][1]}" stroke="${a === 0 ? '#b8964f' : '#2a2a2a'}" stroke-width="2"/>`).join('');
    const html = nodes.slice(0, n).map((d, i) =>
      `<div class="gt-node ${i ? 'dia' : 'circ'}" style="left:${TREE_POS[i][0]}px;top:${TREE_POS[i][1]}px"
        data-t="${esc(d.t)}" data-v="${esc(d.v)}" data-d="${esc(d.d)}"><span>${esc(d.g)}</span></div>`).join('');
    return `<div class="gt-tree"><div class="gt-tree-t">${esc(title)}</div>
      <div class="gt-tree-b" style="height:${h}px"><svg width="150" height="${h}">${lines}</svg>${html}</div></div>`;
  }

  function renderProfile() {
    if (!hub) return;
    const S = sd();
    const user = S.username || 'Guest';
    const coins = ((document.querySelector('.topbar-coins') || {}).textContent || '0').trim();
    const xpBar = document.querySelector('.topbar-account-expbar');
    const xp = xpBar && xpBar.style.width ? xpBar.style.width : '—';
    const elo = isFinite(parseFloat(S.elo)) ? Math.round(parseFloat(S.elo)) : '—';
    const bl = bandits(), un = bl.filter((b) => b.unlocked), locked = bl.filter((b) => !b.unlocked);
    const outfitTotal = un.reduce((a, b) => a + b.outfits, 0);

    hub.querySelector('.gh-cur').innerHTML =
      `<span><b>Lv</b>${esc(S.level ?? '—')}</span><span class="gh-coins" data-go="shop" title="Shop"><b>◎</b>${esc(coins)}</span><span><b>ELO</b>${esc(elo)}</span>`;

    const rank = tree('Rank', [
      { g: S.level ?? '—', t: 'Level', v: S.level ?? '—', d: 'Your account level. Earn EXP in matches to climb.' },
      { g: '経', t: 'Experience', v: xp, d: 'Progress toward your next level.' },
      { g: '点', t: 'Score', v: fmt(S.score), d: 'Total score earned across every match.' },
      { g: '位', t: 'ELO', v: fmt(elo), d: 'Your ranked rating. Win ranked 1v1s to raise it.' },
      { g: '殺', t: 'K/D', v: EXTRA.stats.KDR || S.kd || '—',
        d: EXTRA.stats.KILLS ? `${fmt(String(EXTRA.stats.KILLS).replace(/,/g, ''))} kills · ${fmt(String(EXTRA.stats.DEATHS || '').replace(/,/g, ''))} deaths` : 'Kills per death.' },
    ]);
    const armory = tree('Armory', [
      { g: `${un.length}/${bl.length}`, t: 'Bandits', v: `${un.length} / ${bl.length}`, d: 'Bandits you can fight as.' },
      { g: '衣', t: 'Outfits', v: fmt(outfitTotal), d: 'Outfits that exist for your unlocked bandits.' },
      { g: '金', t: 'Coins', v: coins, d: 'Spend them in the Shop.' },
      { g: '団', t: 'Clan', v: S.clan || 'None', d: S.clan ? 'The clan you fight for.' : 'You have not joined a clan.' },
    ]);
    const initials = (b) => {
      const words = b.name.split(/[\s-]+/).filter(Boolean);
      return esc(words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : b.name.slice(0, 2).toUpperCase());
    };
    const portrait = (b) => `<div class="gp-circ${b.unlocked ? '' : ' locked'}"><span>${initials(b)}</span>${b.icon ? `<img src="${esc(b.icon)}" alt="">` : ''}</div>`;
    const lvlText = (b) => (b.lvl != null ? `Lv ${b.lvl}` : '—');
    const rosterItem = (b) => `
      <div class="gp-ro" data-go="${b.unlocked ? 'outfits' : 'hideout'}" title="${esc(b.name)}${b.lvl != null ? ' · Mastery ' + b.lvl : ''}">
        ${portrait(b)}<div class="gp-ro-n">${esc(b.name)}</div><div class="gp-ro-l">${b.unlocked ? lvlText(b) : 'Locked'}</div>
      </div>`;
    const roster = un.map(rosterItem).join('');
    const lockedHtml = locked.length
      ? `<div class="gp-circles">${locked.map(rosterItem).join('')}</div>`
      : `<div class="gp-group-s">Every bandit unlocked.</div>`;
    const grid = bl.map((b) => `
      <div class="gp-b${b.unlocked ? '' : ' locked'}" data-go="${b.unlocked ? 'outfits' : 'hideout'}">
        ${b.icon ? `<img class="gp-b-img" src="${esc(b.icon)}" alt="">` : `<div class="gp-b-i">${initials(b)}</div>`}
        <div class="gp-b-n">${esc(b.name)}</div>
        <div class="gp-b-l">${b.lvl != null ? `Mastery Lv ${b.lvl}` : ''}</div>
        <div class="gp-b-s">${b.unlocked ? `${b.outfits} outfits` : 'Locked · unlock in Hideout'}</div>
      </div>`).join('');

    // medals: best few big at the top, the rest small at the bottom
    const medals = sortMedals((LOOK.medals || []).slice());
    const catName = (m) => ({ level: 'Level', ranked: 'Ranked', mastery: 'Mastery' })[m.cat] || m.label;
    const medalHTML = (m, big) => {
      const T = MEDAL_TIER[m.tier] || MEDAL_TIER[4], name = medalLabel(m);
      return `<div class="gm gm-${T.k}${big ? ' big' : ''}" data-t="${esc(T.n + ' medal')}" data-v="${esc('#' + m.pos + ' ' + name)}"
        data-d="${esc(`${catName(m)} leaderboard · #${m.pos} of ${m.total} · ${T.d}`)}">
        <div class="gm-rib"></div><div class="gm-disc">#${m.pos}</div>
        <div class="gm-n">${esc(name)}</div>${big ? `<div class="gm-s">${esc(T.n + ' · ' + catName(m))}</div>` : ''}</div>`;
    };
    const top = medals.slice(0, FEATURED_MEDALS), rest = medals.slice(FEATURED_MEDALS);
    const medalsTop = top.length ? `<div class="gm-top">${top.map((m) => medalHTML(m, true)).join('')}</div>` : '';
    const medalsBot = rest.length
      ? `<div class="gm-bot"><div class="gm-bot-t">More medals</div><div class="gm-row">${rest.map((m) => medalHTML(m, false)).join('')}</div></div>`
      : top.length ? '' : `<div class="gm-bot"><div class="gm-bot-t">Medals</div><div class="gp-note">Place on any leaderboard to earn medals.</div></div>`;

    hub.querySelector('.gh-panel[data-tab="profile"]').innerHTML = `
      <div class="gp">
        <aside class="gp-cards">
          <div class="gp-card active" data-sec="record"><div class="gp-card-t">RECORD</div><div class="gp-card-m"></div>
            <div class="gp-kanji">記</div><div class="gp-card-s">Lv ${esc(S.level ?? '—')}</div></div>
          <div class="gp-card" data-sec="roster"><div class="gp-card-t">BANDITS</div><div class="gp-card-m"></div>
            <div class="gp-kanji">盗</div><div class="gp-card-s">${un.length} / ${bl.length} unlocked</div></div>
          <div class="gp-card" data-sec="clan"><div class="gp-card-t">CLAN</div><div class="gp-card-m"></div>
            <div class="gp-kanji">団</div><div class="gp-card-s">${esc(S.clan || 'None')}</div></div>
        </aside>
        <main class="gp-main">
          <div class="gp-sec active" data-sec="record">
            <div class="gp-head"><b>${esc(user)}</b>Warrior record</div>
            ${medalsTop}
            <div class="gp-rec">
              ${rank}${armory}
              <div class="gp-side">
                <div><div class="gp-group-t">Roster</div><div class="gp-group-s">Bandits at your command</div>
                  <div class="gp-circles">${roster}</div></div>
                <div><div class="gp-group-t">Locked</div><div class="gp-group-s">Earn them in the Hideout</div>${lockedHtml}</div>
              </div>
            </div>
            ${medalsBot}
            <div class="gp-detail"><div class="gp-detail-t"></div><div class="gp-detail-v"></div><div class="gp-detail-d"></div></div>
          </div>
          <div class="gp-sec" data-sec="roster">
            <div class="gp-head"><b>Bandits</b>${un.length} of ${bl.length} unlocked</div>
            <div class="gp-grid">${grid}</div>
          </div>
          <div class="gp-sec" data-sec="clan">
            <div class="gp-head"><b>Clan</b>Your banner</div>
            <div class="gp-clan">${S.clan
              ? `<div class="gp-clan-tag">${esc(S.clan)}</div><button class="gp-btn" data-go="clan">Open clan hall</button>`
              : `<div class="gp-note">You haven't joined a clan yet. Find or found one in the Hideout.</div><button class="gp-btn" data-go="hideout">Go to Hideout</button>`}</div>
          </div>
        </main>
      </div>`;
    const first = hub.querySelector('.gt-node');
    if (first) selectNode(first);
  }

  function showSection(sec) {
    hub.querySelectorAll('.gp-card').forEach((c) => c.classList.toggle('active', c.dataset.sec === sec));
    hub.querySelectorAll('.gp-sec').forEach((s) => s.classList.toggle('active', s.dataset.sec === sec));
  }
  function showDetail(node) {
    const box = hub.querySelector('.gp-detail');
    if (!box) return;
    box.querySelector('.gp-detail-t').textContent = node.dataset.t;
    box.querySelector('.gp-detail-v').textContent = node.dataset.v;
    box.querySelector('.gp-detail-d').textContent = node.dataset.d;
  }
  function selectNode(node) {
    hub.querySelectorAll('.gt-node.sel').forEach((n) => n.classList.remove('sel'));
    node.classList.add('sel');
    showDetail(node);
  }

  // ───────────────────────── KATANA SVG ─────────────────────────
  function katanaSVG(alt) {
    // colours depend on clan tier (main = blue energy, sub = enhanced red) and #1 gold fittings
    const gold = !!LOOK.gold, tier = LOOK.tier;
    const K = {
      rim: gold ? '#ffe08a' : tier === 'main' ? '#2fb4ff' : '#ff2a4f',
      tsA: gold ? '#4a3208' : '#3a0710', tsB: gold ? '#f5d67e' : '#c8142f',
      ito: gold ? '#1a1206' : '#0a0a0c', petal: gold ? '#1a1206' : '#040304',
      band: gold ? ['#2a1c06', '#8a6420', '#f0cf78'] : ['#070608', '#2e262b', '#4a3b42'],
      face: gold ? ['#f5d67e', '#b8903a', '#5a3f10'] : ['#34292f', '#161215', '#0a080a'],
      engrave: gold ? '#5a3f10' : '#6b5a44', kashira: gold ? 'url(#hb)' : '#111',
      bl: tier === 'main' ? ['#00132e', '#0a4fb0', '#2fb4ff', '#c8f3ff']
        : tier === 'sub' ? ['#3a0008', '#b00d2a', '#ff2a4f', '#ffc0cc']
        : ['#2a0006', '#8e0b22', '#e0203f', '#ff8fa3'],
      groove: tier === 'main' ? '#001633' : '#1a0004',
      ham: tier === 'main' ? '#e0f7ff' : '#ffc2cc',
      edge: tier === 'main' ? '#7fdcff' : tier === 'sub' ? '#ff6f8a' : '#ff5c7a',
      edgeW: tier === 'none' ? 3 : 5,
      core: tier === 'main' ? '#f0fcff' : '#ffd6de',
    };
    // the second (owner) sword: black-lacquer grip with gold diamonds, deeper blade, six-petal guard
    if (alt) {
      const main = tier === 'main';
      Object.assign(K, {
        tsA: '#040509', tsB: main ? '#132a52' : '#2c0710', ito: gold ? '#f0cf78' : '#b8964f',
        rim: gold ? '#ffe08a' : '#b8964f', petal: '#0b0b0e', engrave: '#8a6a34', kashira: 'url(#hb)',
        band: ['#050506', '#1d1d22', '#34343c'], face: ['#2a2a30', '#111114', '#060607'],
        bl: main ? ['#000712', '#062658', '#1a74c8', '#9fdcff'] : ['#160003', '#5a0714', '#a8102a', '#ff7089'],
        groove: main ? '#000c1f' : '#120003', edge: main ? '#5cc8ff' : '#ff4d6d', edgeW: 3,
      });
    }
    let ito = '';
    for (let i = 0; i < 10; i++) {
      const y = 30 + i * 22.5;
      ito += `<polygon points='60,${y - 8} 69,${y} 60,${y + 8} 51,${y}' fill='${K.ito}'/>`;
    }
    // quadratic bezier helper along blade
    const q = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * t * (1 - t) * b + t * t * c;
    let ham = '';
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      const x = q(72, 74, 94, t) - 6 - 2.5 * Math.sin(i * 1.3);
      const y = q(310, 652, 1000, t);
      ham += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    // ── detailed tsuba (hand guard) ──
    let petals = '', studs = '';
    const nP = alt ? 6 : 4;
    for (let i = 0; i < nP; i++) {
      const a = Math.PI / nP + i * 2 * Math.PI / nP;
      const px = 60 + 26 * Math.cos(a), py = 272 + 6.8 * Math.sin(a);
      const rot = Math.atan2(6.8 * Math.sin(a), 26 * Math.cos(a)) * 180 / Math.PI;
      petals += `<ellipse cx='${px.toFixed(1)}' cy='${py.toFixed(1)}' rx='${alt ? 5 : 6.5}' ry='2' transform='rotate(${rot.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)})' fill='${K.petal}' stroke='${K.rim}' stroke-width='.6' stroke-opacity='.7'/>`;
      if (alt || i > 3) continue;
      const b = i * Math.PI / 2;
      studs += `<circle cx='${(60 + 31 * Math.cos(b)).toFixed(1)}' cy='${(272 + 8.1 * Math.sin(b)).toFixed(1)}' r='1.3' fill='#e2bf73'/>`;
    }
    const tsuba = `
<rect x='44' y='250' width='32' height='13' fill='url(#hb)'/>
<rect x='44' y='250' width='32' height='1.5' fill='#f3d99a'/>
<rect x='44' y='261.5' width='32' height='1.5' fill='#5a3d12'/>
<ellipse cx='60' cy='265' rx='19' ry='4' fill='url(#hb)'/>
<path d='M18 272 L18 279 A42 11 0 0 0 102 279 L102 272 Z' fill='url(#tb)'/>
<path d='M18 279 A42 11 0 0 0 102 279' fill='none' stroke='${K.rim}' stroke-width='1' opacity='.6'/>
<ellipse cx='60' cy='272' rx='42' ry='11' fill='url(#tf)'/>
<ellipse cx='60' cy='272' rx='42' ry='11' fill='none' stroke='${K.rim}' stroke-width='1.6'/>
<ellipse cx='60' cy='272' rx='38.5' ry='10' fill='none' stroke='${K.engrave}' stroke-width='.7'/>
<ellipse cx='60' cy='272' rx='21' ry='5.5' fill='none' stroke='${K.engrave}' stroke-width='.6'/>
${petals}${studs}
<ellipse cx='60' cy='272' rx='16' ry='4.2' fill='url(#hb)'/>
<ellipse cx='60' cy='289' rx='17' ry='3.5' fill='url(#hb)'/>`;

    const blade = 'M48 304 Q50 652 70 1000 L94 1000 Q74 652 72 304 Z';
    const edge = 'M72 304 Q74 652 94 1000';
    const groove = 'M53 320 Q55 652 75 1000';
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 1000' width='240' height='2000'>
<defs>
<linearGradient id='ts' x1='0' x2='1'><stop offset='0' stop-color='${K.tsA}'/><stop offset='.5' stop-color='${K.tsB}'/><stop offset='1' stop-color='${K.tsA}'/></linearGradient>
<linearGradient id='bl' x1='0' x2='1'><stop offset='0' stop-color='${K.bl[0]}'/><stop offset='.45' stop-color='${K.bl[1]}'/><stop offset='.8' stop-color='${K.bl[2]}'/><stop offset='1' stop-color='${K.bl[3]}'/></linearGradient>
<linearGradient id='hb' x1='0' x2='1'><stop offset='0' stop-color='#6b4a1a'/><stop offset='.5' stop-color='#e2bf73'/><stop offset='1' stop-color='#6b4a1a'/></linearGradient>
<linearGradient id='tb' x1='0' x2='1'><stop offset='0' stop-color='${K.band[0]}'/><stop offset='.35' stop-color='${K.band[1]}'/><stop offset='.5' stop-color='${K.band[2]}'/><stop offset='.65' stop-color='${K.band[1]}'/><stop offset='1' stop-color='${K.band[0]}'/></linearGradient>
<radialGradient id='tf' cx='.45' cy='.4' r='.7'><stop offset='0' stop-color='${K.face[0]}'/><stop offset='.7' stop-color='${K.face[1]}'/><stop offset='1' stop-color='${K.face[2]}'/></radialGradient>
<filter id='gl' x='-50%' y='-5%' width='200%' height='110%'><feGaussianBlur stdDeviation='2.4'/></filter>
</defs>
<rect x='44' y='0' width='32' height='16' rx='5' fill='${K.kashira}' stroke='${K.rim}' stroke-width='1.5'/>
<rect x='45' y='14' width='30' height='250' fill='url(#ts)'/>
${ito}
<ellipse cx='60' cy='150' rx='5' ry='9' fill='#d9b36a' opacity='.85'/>
${tsuba}
<rect x='47' y='291' width='26' height='15' fill='url(#hb)'/>
<rect x='47' y='291' width='26' height='1.2' fill='#f3d99a'/>
<path d='${blade}' fill='url(#bl)'/>
<path d='${groove}' stroke='${K.groove}' stroke-width='2' fill='none' opacity='.8'/>
<path d='${ham}' stroke='${K.ham}' stroke-width='1.4' fill='none' opacity='.55'/>
<path d='${edge}' stroke='${K.edge}' stroke-width='${K.edgeW}' fill='none' filter='url(#gl)'/>
<path d='${edge}' stroke='${K.core}' stroke-width='.8' fill='none'/>
</svg>`;
  }

  // ───────────────────────── SCENE ENGINE ─────────────────────────
  // Draws: theme.drawBack → katana → grass → theme.drawFront → vignette.
  // The background itself (sky, buildings, weather…) comes from the active .theme file.
  function startScene(host) {
    if (document.getElementById('gt-bg')) return;
    const cvs = document.createElement('canvas');
    cvs.id = 'gt-bg';
    host.appendChild(cvs);
    const ctx = cvs.getContext('2d');
    const rnd = (a, b) => a + Math.random() * (b - a);

    let W = 0, H = 0, DPR = 1;
    let vignette, katanaC, katanaGlow, katanaAura, kw = 0, kh = 0, blades = [];
    let parX = 0, parY = 0, tParX = 0, tParY = 0;
    let theme = THEMES.obj || null;

    function off(w, h) {
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * DPR); c.height = Math.ceil(h * DPR);
      const x = c.getContext('2d'); x.setTransform(DPR, 0, 0, DPR, 0, 0);
      return [c, x];
    }

    // everything a theme gets to draw with
    const env = {
      ctx, off, config: CONFIG,
      W: 0, H: 0, DPR: 1, t: 0, parX: 0, parY: 0,
      flash: 0,                                   // a theme sets this 0…1 to light up the katana and screen (lightning)
      get tier() { return LOOK.tier; },
      get gold() { return !!LOOK.gold; },
    };

    // run a theme hook; a crashing theme is dropped so the menu keeps working
    function call(fn, ...args) {
      if (!theme || typeof theme[fn] !== 'function') return false;
      try { theme[fn](...args); return true; }
      catch (err) {
        console.warn('[Bandit.RIP] scene "' + (theme.id || '?') + '" crashed in ' + fn + ':', err);
        theme = null; env.flash = 0;
        return false;
      }
    }

    const svgData = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const IS_OWNER = (sd().username || '').toLowerCase() === OWNER;
    const katanaImg = new Image();
    katanaImg.onload = () => { buildKatana(); T.blade(); };
    katanaImg.onerror = T.blade;
    katanaImg.src = svgData(katanaSVG());
    // owner only: a second, smaller sword planted behind the first, leaning the other way
    const katanaImg2 = new Image();
    let kat2 = null;
    if (IS_OWNER) { katanaImg2.onload = () => buildKatana(); katanaImg2.src = svgData(katanaSVG(true)); }
    // clan tier / gold changed → redraw the blades with the new colours
    STATE.onLook = () => {
      katanaImg.src = svgData(katanaSVG());
      if (IS_OWNER) katanaImg2.src = svgData(katanaSVG(true));
    };
    // a new scene was picked or downloaded
    STATE.setTheme = (th) => { theme = th; env.flash = 0; if (W) build(); };

    function buildVignette() {
      const [c, x] = off(W, H);
      const r = x.createRadialGradient(W * .55, H * .5, Math.min(W, H) * .3, W * .55, H * .5, Math.max(W, H) * .75);
      r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,.7)');
      x.fillStyle = r; x.fillRect(0, 0, W, H);
      const l = x.createLinearGradient(0, 0, W * .5, 0);
      l.addColorStop(0, 'rgba(0,0,0,.55)'); l.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = l; x.fillRect(0, 0, W, H);
      return c;
    }

    // a sword drawn at size plus its glow (and optionally a glow-only "aura" pass)
    function swordSet(img, withAura) {
      const pad = 70, col = LOOK.tier === 'main' ? '#2aa8ff' : '#ff1f45', s = {};
      let x;
      [s.c, x] = off(kw, kh);
      x.drawImage(img, 0, 0, kw, kh);
      [s.glow, x] = off(kw + pad * 2, kh + pad * 2);
      x.shadowColor = col; x.shadowBlur = LOOK.tier === 'none' ? 38 : 52;
      x.drawImage(img, pad, pad, kw, kh);
      if (withAura) {
        // glow only (no sword): draw the sword far off-canvas and let only its shadow land here
        [s.aura, x] = off(kw + pad * 2, kh + pad * 2);
        x.shadowColor = col; x.shadowBlur = 60;
        x.shadowOffsetX = 10000 * DPR;
        x.drawImage(img, pad - 10000, pad, kw, kh);
      }
      return s;
    }
    function buildKatana() {
      if (!W) return;
      kh = H * .82; kw = kh * .12;
      if (katanaImg.complete && katanaImg.naturalWidth) {
        const s = swordSet(katanaImg, true);
        katanaC = s.c; katanaGlow = s.glow; katanaAura = s.aura;
      }
      if (IS_OWNER && katanaImg2.complete && katanaImg2.naturalWidth) kat2 = swordSet(katanaImg2, false);
    }

    function buildGrass() {
      blades = [];
      const n = Math.floor(W / 3.5);
      for (let i = 0; i < n; i++) {
        const x = rnd(-20, W + 20), edge = Math.abs(x / W - .5) * 2;
        blades.push({ x, h: H * rnd(.06, .13 + edge * .12), w: rnd(2, 5), lean: rnd(-.25, .35), ph: rnd(0, 6.28), d: Math.random() < .5 ? 0 : 1 });
      }
    }

    function build() {
      DPR = Math.min(window.devicePixelRatio || 1, CONFIG.maxDPR);
      W = window.innerWidth; H = window.innerHeight;
      Object.assign(env, { W, H, DPR });
      cvs.width = Math.ceil(W * DPR); cvs.height = Math.ceil(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      call('build', env);
      vignette = buildVignette();
      buildGrass(); buildKatana();
    }

    // grass colours come from the theme: [front gradient top, front gradient bottom, back layer]
    function drawGrass(t) {
      const G = (theme && theme.grass) || ['#1a1a1f', '#050507', '#030304'];
      const base = H + 4, gust = Math.sin(t * .35) * .08;
      for (let pass = 0; pass < 2; pass++) {
        ctx.beginPath();
        for (const b of blades) {
          if (b.d !== pass) continue;
          const s = Math.sin(t * 1.4 + b.ph + b.x * .003) * .1 + gust, l = b.lean + s;
          const tipx = b.x + l * b.h, tipy = base - b.h * (1 - Math.abs(l) * .3);
          const cx = b.x + l * b.h * .35, cy = base - b.h * .6;
          ctx.moveTo(b.x - b.w, base);
          ctx.quadraticCurveTo(cx, cy, tipx, tipy);
          ctx.quadraticCurveTo(cx + b.w * .4, cy, b.x + b.w, base);
          ctx.closePath();
        }
        if (pass === 0) {
          const g = ctx.createLinearGradient(0, H * .7, 0, H);
          g.addColorStop(0, G[0]); g.addColorStop(1, G[1]);
          ctx.fillStyle = g;
        } else ctx.fillStyle = G[2];
        ctx.fill();
      }
    }

    // point on the blade in katana-local coords: t 0 = habaki … 1 = tip end, off -1 = spine … 1 = edge
    function bladePt(t, off) {
      const q = (a, b, c, u) => (1 - u) * (1 - u) * a + 2 * u * (1 - u) * b + u * u * c;
      const sx = q(48, 50, 70, t), ex = q(72, 74, 94, t), y = q(304, 652, 1000, t);
      const x = (sx + ex) / 2 + off * (ex - sx) / 2;
      return [-kw / 2 + (x / 120) * kw, -kh + (y / 1000) * kh];
    }
    let arcs = [], arcTimer = 0;
    const sparks = [];
    function drawAura(t, dt) {
      if (LOOK.tier === 'none') return;
      const main = LOOK.tier === 'main';
      ctx.globalCompositeOperation = 'lighter';
      // energy pulse: a second, breathing glow pass
      ctx.globalAlpha = main ? .45 + .35 * Math.sin(t * 6) : .55 + .3 * Math.sin(t * 2.4);
      if (katanaAura) ctx.drawImage(katanaAura, -kw / 2 - 70, -kh - 70, kw + 140, kh + 140);
      ctx.globalAlpha = 1;
      // particles: blue motes (main) or rising embers (sub)
      for (let i = 0; i < (main ? 1 : 2); i++) {
        if (Math.random() < dt * (main ? 40 : 30)) {
          const [x, y] = bladePt(rnd(.02, .78), rnd(-1.2, 1.2));
          sparks.push({ x, y, vx: rnd(-14, 14), vy: main ? rnd(-30, -8) : rnd(-60, -25), life: 0, max: rnd(.6, 1.4), r: rnd(.8, 2.2) });
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (!main) p.vx += Math.sin(t * 3 + i) * 8 * dt;
        if (p.life > p.max) { sparks.splice(i, 1); continue; }
        const a = (1 - p.life / p.max) * (main ? .9 : .8) * (main ? 1 : .6 + .4 * Math.random());
        ctx.fillStyle = main ? `rgba(120,220,255,${a})` : `rgba(255,${80 + (Math.random() * 60 | 0)},60,${a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.29); ctx.fill();
      }
      // crackling electric arcs along the blade (main clan only)
      if (main) {
        arcTimer -= dt;
        if (arcTimer <= 0) {
          arcTimer = rnd(.05, .12);
          arcs = [];
          const n = Math.random() < .75 ? 1 + (Math.random() * 3 | 0) : 0;
          for (let j = 0; j < n; j++) {
            const t0 = rnd(.02, .7), len = rnd(.05, .16), pts = [];
            for (let k = 0; k <= 7; k++) pts.push(bladePt(t0 + len * k / 7, rnd(-2.2, 2.2)));
            arcs.push(pts);
          }
        }
        ctx.save();
        ctx.shadowColor = '#39b8ff'; ctx.shadowBlur = 12;
        ctx.strokeStyle = 'rgba(200,245,255,.95)'; ctx.lineWidth = 1.3;
        for (const pts of arcs) {
          ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
          for (const q of pts) ctx.lineTo(q[0], q[1]);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawSecondSword(t) {
      ctx.save();
      ctx.translate(W * .6 + parX * 1.05, H * .985 + parY * .95);
      ctx.rotate(0.22);
      ctx.scale(.84, .84);
      ctx.globalAlpha = .3 + .18 * Math.sin(t * 1.3 + 1.7);
      ctx.drawImage(kat2.glow, -kw / 2 - 70, -kh - 70, kw + 140, kh + 140);
      ctx.globalAlpha = 1;
      ctx.filter = 'brightness(.78)';          // it sits further back
      ctx.drawImage(kat2.c, -kw / 2, -kh, kw, kh);
      ctx.filter = 'none';
      if (env.flash > .02) {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = env.flash * .4;
        ctx.drawImage(kat2.c, -kw / 2, -kh, kw, kh);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    function drawKatana(t, dt) {
      if (kat2) drawSecondSword(t);
      if (!katanaC) return;
      ctx.save();
      ctx.translate(W * .66 + parX * 1.15, H * .97 + parY);
      ctx.rotate(-0.2);
      ctx.globalAlpha = .5 + .25 * Math.sin(t * 1.6);
      ctx.drawImage(katanaGlow, -kw / 2 - 70, -kh - 70, kw + 140, kh + 140);
      ctx.globalAlpha = 1;
      ctx.drawImage(katanaC, -kw / 2, -kh, kw, kh);
      if (env.flash > .02) {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = env.flash * .55;
        ctx.drawImage(katanaC, -kw / 2, -kh, kw, kh);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
      drawAura(t, dt);
      ctx.restore();
    }

    // visibility check (menu hidden while in a match → stop drawing)
    let visCache = true, visCounter = 0;
    function visible() {
      if (STATE.hubOpen) return false;   // hub covers the screen, no need to draw
      if (++visCounter % 15 !== 1) return visCache;
      if (!ROOT.classList.contains('gtm') || !host.isConnected || host.getClientRects().length === 0) return (visCache = false);
      const cs = getComputedStyle(host);
      return (visCache = cs.visibility !== 'hidden' && parseFloat(cs.opacity) > .02);
    }

    const reset = () => { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; };
    let last = performance.now(), t = 0;
    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, .05); last = now;
      if (!visible()) return;
      t += dt;

      parX += (tParX - parX) * Math.min(1, dt * 3);
      parY += (tParY - parY) * Math.min(1, dt * 3);
      env.t = t; env.parX = parX; env.parY = parY;

      reset();
      if (!call('drawBack', t, dt, env)) {
        // no scene (still downloading, or it failed): plain night backdrop
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#05060a'); g.addColorStop(1, '#0c0b10');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      reset();
      drawKatana(t, dt);
      drawGrass(t);
      reset();
      call('drawFront', t, dt, env);
      reset();

      ctx.drawImage(vignette, 0, 0, W, H);
      if (env.flash > .02) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(120,140,200,${env.flash * .12})`; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    if (CONFIG.parallax) {
      addEventListener('mousemove', (e) => {
        tParX = (e.clientX / W - .5) * -W * .05;
        tParY = (e.clientY / H - .5) * -H * .012;
      }, { passive: true });
    }
    let rT;
    addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(build, 150); });

    build();
    requestAnimationFrame(frame);
  }

  // ───────────────────────── EMBED MODE (pages inside the hub) ─────────────────────────
  function embedMode() {
    const s = document.createElement('style');
    s.textContent = `.topbar-container, #topbar, .bottombar-container { display:none !important; }`;
    (document.head || document.documentElement).appendChild(s);
    // links back to the front page (or sign-out) should leave the hub, not load inside it
    document.addEventListener('click', (e) => {
      const a = e.target && e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      let u;
      try { u = new URL(a.href, location.href); } catch (err) { return; }
      if (u.origin === location.origin && (u.pathname === '/' || u.pathname === '/signout')) {
        e.preventDefault();
        window.top.location.href = u.href;
      }
    }, true);
  }

  // ───────────────────────── PAGE SKIN (hideout, clans, shop, leaderboards, tournaments, …) ─────────────────────────
  // These pages' markup varies, so the skin works on shared building blocks: page, type, links, buttons, inputs, tables.
  function pageSkin(embedded) {
    let on = true;
    try { on = localStorage.getItem('gtm-off') !== '1'; } catch (e) {}
    ROOT.classList.toggle('gtm-page', on);
    const P = PALETTES[LOOK.tier === 'main' ? 'blue' : 'red'];
    const s = document.createElement('style');
    s.id = 'gt-page-style';
    s.textContent = pageCSS(P, embedded);
    (document.head || ROOT).appendChild(s);
    // follow the Alt+G toggle from the menu (or from this page, when it isn't inside the hub)
    addEventListener('storage', (e) => { if (e.key === 'gtm-off') ROOT.classList.toggle('gtm-page', e.newValue !== '1'); });
    if (!embedded) {
      addEventListener('keydown', (e) => {
        if (e.altKey && e.key && e.key.toLowerCase() === CONFIG.toggleKey) {
          const now = ROOT.classList.toggle('gtm-page');
          try { localStorage.setItem('gtm-off', now ? '0' : '1'); } catch (err) {}
        }
      }, true);
    }
  }

  function pageCSS(P, embedded) {
    const grain = svgURL(`<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .055 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`);
    const G = 'html.gtm-page';
    return `
${G}, ${G} body {
  background-color:#0c0c0e !important;
  background-image:${grain}, radial-gradient(ellipse at 18% -10%, rgba(${P.rgb},.13), transparent 55%), radial-gradient(ellipse at 90% 110%, rgba(${P.rgb},.07), transparent 50%) !important;
  background-attachment:fixed !important; color:#dcd8d2 !important;
}
${G} body { font-family:'Marcellus','Optima',serif !important; }
${G} body :where(div,span,p,a,li,td,th,label,input,textarea,select,button,small,b,strong,em) { font-family:'Marcellus','Optima',serif !important; }
${G} body::after { content:"盗賊"; position:fixed; right:1.5vw; bottom:-5vh; z-index:0; pointer-events:none; writing-mode:vertical-rl;
  font:800 26vh/1 'Shippori Mincho','Yu Mincho',serif; color:rgba(255,255,255,.025); }

/* titles */
${G} :where(h1,h2,h3,h4,.f1,.f2,.brtitle,.brtitle2,[class$="-title"],[class*="-title "]) {
  font-family:'Cinzel',serif !important; font-weight:700 !important; letter-spacing:.12em !important; text-transform:uppercase;
  color:#eceae6 !important; text-shadow:0 0 18px rgba(0,0,0,.85) !important; -webkit-text-stroke:0 !important; filter:none !important; animation:none !important;
}
${G} :where(h1,h2) { position:relative; padding-bottom:10px; }
${G} :where(h1,h2)::after { content:""; position:absolute; left:0; bottom:0; width:min(160px,60%); height:3px; background:linear-gradient(90deg, ${P.brush}, transparent); }
${G} :where(h3,h4) { color:${P.soft} !important; font-size:.95em; letter-spacing:.26em !important; }

/* links */
${G} a { color:#ebe6de; text-decoration:none; transition:color .2s; }
${G} a:hover { color:${P.soft}; }
${G} ::selection { background:${P.deep}; color:#fff; }

/* buttons: thin outline, brush stroke on hover */
${G} :where(.brbutton, button, input[type=submit], input[type=button], [class*="-button"], [class*="-btn"]):not(.gswitch):not(.gswitch *) {
  position:relative; background:transparent !important; background-image:none !important; border:1px solid rgba(220,216,210,.3) !important; border-radius:0 !important;
  box-shadow:none !important; text-shadow:none !important; filter:none !important; animation:none !important; color:#e8e4de !important;
  font-family:'Cinzel',serif !important; letter-spacing:.14em !important; text-transform:uppercase; cursor:pointer;
  transition:background .25s, border-color .25s, color .25s, transform .25s cubic-bezier(.2,.7,.2,1) !important;
}
${G} :where(.brbutton, button, input[type=submit], input[type=button], [class*="-button"], [class*="-btn"]):not(.gswitch):not(.gswitch *):hover {
  background:${svgURL(brushSVG(P.brush))} no-repeat left center / 100% 100% !important; border-color:transparent !important; color:#fff !important; transform:translateX(3px);
}

/* inputs */
${G} :where(input[type=text], input[type=password], input[type=number], input[type=search], input:not([type]), textarea, select) {
  background:rgba(255,255,255,.04) !important; color:#eee !important; border:0 !important; border-bottom:1px solid rgba(220,216,210,.35) !important;
  border-radius:0 !important; box-shadow:none !important; outline:none !important; transition:border-color .2s, background .2s;
}
${G} :where(input, textarea, select):focus { border-bottom-color:${P.hi} !important; background:rgba(255,255,255,.07) !important; }
${G} select option { background:#141416; color:#eee; }

/* tables */
${G} table { border-collapse:collapse !important; }
${G} th { font-family:'Cinzel',serif !important; font-weight:400 !important; font-size:11px; letter-spacing:.24em !important; text-transform:uppercase;
  color:#8a8580 !important; background:none !important; border:0 !important; border-bottom:1px solid rgba(255,255,255,.14) !important; }
${G} td { border:0 !important; border-bottom:1px solid rgba(255,255,255,.06) !important; }
${G} tr:hover > td { background:rgba(${P.rgb},.07) !important; }

/* leaderboards */
${G} .leaderboard { background:rgba(8,8,10,.55) !important; border:0 !important; border-left:3px solid ${P.deep} !important; border-radius:0 !important; box-shadow:0 8px 30px rgba(0,0,0,.35) !important; }
${G} .leaderboard-entry { border:0 !important; border-bottom:1px solid rgba(255,255,255,.06) !important; border-radius:0 !important; transition:background .2s, transform .2s; }
${G} .leaderboard-entry:hover { background:rgba(${P.rgb},.08) !important; transform:translateX(4px); }
${G} .leaderboard-entry-position { font-family:'Cinzel',serif !important; color:${P.soft} !important; }
${G} .leaderboard-entry-username { color:#f1ede6 !important; letter-spacing:.04em; }

/* player page */
${G} .playerpage-profile-stats { font-family:'Cinzel',serif !important; letter-spacing:.1em !important; }
${G} .playerpage-profile-cl-c { border-radius:0 !important; transition:transform .2s; }
${G} .playerpage-profile-cl-c:hover { transform:translateY(-2px); }

/* nav bars (pages opened on their own, outside the hub) */
${G} .topbar { background:#0b0b0c !important; background-image:none !important; border:0 !important; box-shadow:0 2px 14px rgba(0,0,0,.45) !important; }
${G} .topbar .brbutton { border-color:transparent !important; }
${G} .bottombar { background:transparent !important; border:0 !important; }
${G} .bottombar-option { color:#8a857e !important; letter-spacing:.14em; text-transform:uppercase; font-size:11px; }
${G} .brcoin3 { color:${P.soft} !important; }

/* scrollbars */
${G} { scrollbar-color:rgba(255,255,255,.2) transparent; scrollbar-width:thin; }
${G} ::-webkit-scrollbar { width:8px; height:8px; }
${G} ::-webkit-scrollbar-track { background:transparent; }
${G} ::-webkit-scrollbar-thumb { background:rgba(255,255,255,.18); }
${G} ::-webkit-scrollbar-thumb:hover { background:${P.deep}; }
${embedded ? `${G} body { padding-top:10px !important; }` : ''}
`;
  }
})();
