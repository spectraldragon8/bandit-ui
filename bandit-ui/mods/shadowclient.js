// ==UserScript==
// @name         ShadowClient for Bandit.RIP 5
// @namespace    shadowclient.bandit
// @version      4.6.0
// @description  QoL / training mod for bandit.rip — dmg numbers, HP display for all players, hitboxes, cooldown timers, infinite dummy HP, name hiding, dummy character replacement, training map switcher, combo damage counter, disable mouse parallax, name color, name-only, show usernames, floating dummy, instant reload, return-to-select hotkey, all characters in training. Press / to toggle the menu.
// @match        https://bandit.rip/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
 * Targets game.js v1.5.09. Obfuscated symbol map used below:
 *   window._$bG                       -> main game object (mode, selfid, renderer, _$3a = game state, _$1C = char select, _$iv = skill bar)
 *   window._$6d.prototype._$aB(tick)  -> per-render-frame display-state builder (players + entities)
 *   Player.prototype._$cD(ev, tick)   -> applies hp-change events (damage/heal) to a player
 *   Player.prototype._$l1(tick)       -> interpolated sim state {x, y, s, w, dc, ...} (world coords, y-up)
 *   Class.prototype._$ls/_$m1/_$n1    -> hp-after-damage calculators (hit / min-1-hp / block chip)
 *   Class.prototype._$5W(st)/_$oQ(st) -> hurtbox rects / active attack hitbox rects ({x,y,w,h}, world, y-up)
 *   window._$lQ.prototype._$ao(p, st) -> skill/cooldown bar per-frame update (st.w[i] = [ammo, cdLeft, cdTotal], st.dc = dash cd)
 *   window._$jf.prototype._$bu(key)   -> character select click handler (blocks locked chars in training)
 *   window._$1z.prototype._$nd(key)   -> training-mode spawn class validator
 *   window._$if                       -> registry: charKey -> Class subclass (prototypes are COPIES of Class.prototype,
 *                                        so damage hooks must be applied to every subclass prototype, not just Class)
 *   Class.p                           -> back-reference to owning Player; training dummy is players["2"] (shortid 2)
 *   renderer._$6G / _$87              -> mouse-parallax camera-lead flag / mouse-position-in-world getter
 *   renderer.layer                    -> world-space PIXI container (stage coords = (worldX, -worldY), 16 units = 1 tile)
 *   renderer._$dF / _$mx              -> top world render group / UI render group (pixi-display)
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------- options
  var STORE_KEY = 'sc_opts_v1';
  var opt = {
    infHP: true,
    showDmg: true,
    showHP: true,
    cdCounter: true,
    hitboxes: false,
    hideNames: false,
    comboDmg: false,
    dmgSide: false,
    noParallax: false,
    nameColor: false,
    nameColorHex: '#8a5cff',
    showNameOnly: false,
    showUsername: false,
    floatDummy: false,
    floatHeight: 48,
    instaReload: false,
    dummyChar: 'dummy',
    trainMap: 'training',
    allChars: true,
    uiVisible: true
  };
  try {
    var saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    for (var k in saved) {
      if (!(k in opt)) continue;
      if (typeof opt[k] === 'boolean') opt[k] = !!saved[k];
      else if (typeof opt[k] === 'number') opt[k] = isFinite(+saved[k]) ? +saved[k] : opt[k];
      else opt[k] = '' + saved[k];
    }
  } catch (e) {}
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(opt)); } catch (e) {}
  }

  var game = null;      // window._$bG once it exists
  var PIXI_ = null;

  // ---------------------------------------------------------------- UI panel
  var css = document.createElement('style');
  css.textContent = [
    '#sc-panel{position:fixed;top:12px;right:12px;z-index:99999;background:rgba(10,10,18,.92);',
    ' border:1px solid #6d4bd4;border-radius:8px;padding:10px 14px;min-width:230px;',
    ' font-family:monospace;font-size:12px;color:#e8e2ff;box-shadow:0 0 14px rgba(109,75,212,.55);user-select:none}',
    '#sc-panel h3{margin:0 0 6px 0;font-size:13px;color:#b9a1ff;letter-spacing:2px;text-align:center}',
    '#sc-panel h3 span{color:#7f8496;font-size:10px;letter-spacing:0}',
    '#sc-panel label{display:flex;align-items:center;gap:7px;padding:3px 0;cursor:pointer;white-space:nowrap}',
    '#sc-panel label:hover{color:#fff}',
    '#sc-panel input{accent-color:#8a5cff;cursor:pointer}',
    '#sc-panel .sc-foot{margin-top:6px;color:#7f8496;font-size:10px;text-align:center}',
    '#sc-dmg-feed{position:fixed;left:18px;top:36%;z-index:99998;pointer-events:none;',
    ' display:flex;flex-direction:column;gap:6px;font-family:monospace}',
    '.sc-dmg-row{transition:opacity .45s ease}',
    '.sc-dmg-row .sc-dmg-name{font-size:11px;color:#cfc8ea;text-shadow:0 0 3px #000,1px 1px 0 #000}',
    '.sc-dmg-row .sc-dmg-val{font-size:30px;font-weight:bold;color:#ff5d5d;line-height:1;',
    ' text-shadow:0 0 4px #000,2px 2px 0 #000,-1px -1px 0 #000}',
    '#sc-title-tag{margin-top:2px;text-align:center;font-family:monospace;font-size:16px;letter-spacing:6px;',
    ' color:#b9a1ff;text-shadow:0 0 8px #8a5cff,0 0 18px #8a5cff}',
    // visually unlock the roster while the "all characters" option is active in training
    'body.br-training-mode.sc-allchars .fgm-class-c-locked{filter:none!important;opacity:1!important}',
    'body.br-training-mode.sc-allchars .fgm-class-c-locked .fgm-class-info,',
    'body.br-training-mode.sc-allchars .fgm-class-c-locked .fgm-class-link{display:none!important}',
    // widen the leaderboard so usernames fit
    '#fgui-lb{width:auto!important;min-width:260px!important;max-width:520px!important}',
    '#fgui-lb .fgui-lb-entry{width:auto!important}',
    '#fgui-lb .fgui-lb-entry-n{white-space:nowrap}'
  ].join('\n');
  document.head.appendChild(css);

  var FEATURES = [
    ['infHP',     'Infinite Training Dummy HP'],
    ['showDmg',   'Show damage'],
    ['showHP',    'Show HP (you + enemies)'],
    ['cdCounter', 'Cooldown Counter (ms)'],
    ['hitboxes',  'Show hitboxes'],
    ['hideNames', 'Hide player names'],
    ['comboDmg',  'Combo damage counter'],
    ['dmgSide',   'Damage numbers at screen side'],
    ['noParallax','Disable mouse parallax'],
    ['nameColor', 'Custom name color (you only)'],
    ['showNameOnly', 'Show my name only (hide others)'],
    ['showUsername', 'Show usernames on leaderboard'],
    ['floatDummy', 'Floating dummy (training)'],
    ['instaReload', 'Instant reload (solo training)'],
    ['allChars',  'All characters in Training']
  ];

  var panel = document.createElement('div');
  panel.id = 'sc-panel';
  panel.innerHTML = '<h3>SHADOWCLIENT <span>v4.0</span></h3>';
  FEATURES.forEach(function (f) {
    var lb = document.createElement('label');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = opt[f[0]];
    cb.addEventListener('change', function () {
      opt[f[0]] = cb.checked;
      save();
      applyBodyClasses();
    });
    lb.appendChild(cb);
    lb.appendChild(document.createTextNode(f[1]));
    panel.appendChild(lb);
  });
  // dropdowns: dummy character + training map (populated once the game loads)
  function makeSelect(id, label) {
    var row = document.createElement('label');
    row.style.justifyContent = 'space-between';
    row.appendChild(document.createTextNode(label));
    var sel = document.createElement('select');
    sel.id = id;
    sel.style.cssText = 'background:#1a1430;color:#e8e2ff;border:1px solid #6d4bd4;' +
      'border-radius:4px;font-family:monospace;font-size:11px;max-width:120px';
    row.appendChild(sel);
    panel.appendChild(row);
    return sel;
  }
  // color picker for the custom name color
  (function () {
    var row = document.createElement('label');
    row.style.justifyContent = 'space-between';
    row.appendChild(document.createTextNode('Name color'));
    var ci = document.createElement('input');
    ci.type = 'color';
    ci.id = 'sc-name-color';
    ci.value = opt.nameColorHex;
    ci.style.cssText = 'width:34px;height:20px;border:1px solid #6d4bd4;border-radius:4px;' +
      'background:#1a1430;cursor:pointer;padding:0';
    ci.addEventListener('input', function () {
      opt.nameColorHex = ci.value;
      save();
      refreshNametags();
    });
    row.appendChild(ci);
    panel.appendChild(row);
  })();

  // float height input (world px; 16 px = 1 tile; 0 = ground level)
  (function () {
    var row = document.createElement('label');
    row.style.justifyContent = 'space-between';
    row.appendChild(document.createTextNode('Float height (px)'));
    var ni = document.createElement('input');
    ni.type = 'number';
    ni.id = 'sc-float-h';
    ni.min = '0';
    ni.max = '400';
    ni.step = '8';
    ni.value = opt.floatHeight;
    ni.style.cssText = 'width:56px;background:#1a1430;color:#e8e2ff;border:1px solid #6d4bd4;' +
      'border-radius:4px;font-family:monospace;font-size:11px;padding:1px 3px';
    ni.addEventListener('change', function () {
      var v = parseFloat(ni.value);
      if (!isFinite(v) || v < 0) v = 0;
      if (v > 400) v = 400;
      ni.value = v;
      opt.floatHeight = v;
      save();
      resetFloat(); // re-anchor at the new height on the next float
    });
    row.appendChild(ni);
    panel.appendChild(row);
  })();

  var dummySel = makeSelect('sc-dummy-sel', 'Dummy char');
  var mapSel = makeSelect('sc-map-sel', 'Training map');
  dummySel.addEventListener('change', function () {
    opt.dummyChar = dummySel.value;
    save();
    respawnDummy();
  });
  mapSel.addEventListener('change', function () {
    opt.trainMap = mapSel.value;
    save();
    switchTrainingMap(mapSel.value);
  });
  (function () {
    var row = document.createElement('label');
    row.style.justifyContent = 'space-between';
    row.appendChild(document.createTextNode('Change char'));
    var btn = document.createElement('button');
    btn.id = 'sc-select-btn';
    btn.textContent = 'Back to select (V)';
    btn.style.cssText = 'background:#2a1f4a;color:#e8e2ff;border:1px solid #6d4bd4;' +
      'border-radius:4px;font-family:monospace;font-size:11px;padding:2px 8px;cursor:pointer';
    btn.addEventListener('click', function () { returnToSelect(); });
    row.appendChild(btn);
    panel.appendChild(row);
  })();

  var foot = document.createElement('div');
  foot.className = 'sc-foot';
  foot.textContent = 'press / to show or hide';
  panel.appendChild(foot);
  document.body.appendChild(panel);
  panel.style.display = opt.uiVisible ? '' : 'none';

  function applyBodyClasses() {
    document.body.classList.toggle('sc-allchars', !!opt.allChars);
    applyParallax();
    refreshNametags();
  }
  applyBodyClasses();

  window.addEventListener('keydown', function (e) {
    if (e.key !== '/') return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault();
    e.stopPropagation();
    opt.uiVisible = !opt.uiVisible;
    panel.style.display = opt.uiVisible ? '' : 'none';
    save();
  }, true);

  // "ShadowClient" tag under the big BANDIT.RIP title on the front page
  function tagTitle() {
    var t = document.getElementById('frontpage-menu-title');
    if (t && !document.getElementById('sc-title-tag')) {
      var d = document.createElement('div');
      d.id = 'sc-title-tag';
      d.textContent = 'ShadowClient';
      t.appendChild(d);
    }
  }

  // ---------------------------------------------------------------- helpers
  function inTraining() {
    if (!game) return false;
    // _$N is the room's mode label ("training" | "ffa" | "tdm" | "ranked1v1"...).
    // Both solo and shared training set it to "training"; competitive never does.
    if (game._$N === 'training') return true;
    // fallbacks: the body class the game toggles, and the solo-sim controller
    if (typeof document !== 'undefined' &&
        document.body.classList.contains('br-training-mode')) return true;
    if (game.mode === 'training') return true;
    return false;
  }
  // shortid is parseInt'd (number) but selfid arrives raw from the room payload
  // (string in networked rooms) — always compare ids as strings
  function sameId(a, b) {
    return String(a) === String(b);
  }
  function isSelf(p) {
    return p && game && sameId(p.shortid, game.selfid);
  }
  function isTrainingDummyClass(cls) {
    // Class.p is the owning Player; the training dummy is shortid 2 in training mode only.
    return inTraining() && cls && cls.p && sameId(cls.p.shortid, 2);
  }

  // camera-lead parallax toggle. Remember the game's own setting so touch mode
  // (which legitimately disables it) isn't clobbered when we restore.
  function applyParallax() {
    try {
      var rd = game && game.renderer;
      if (!rd) return;
      if (!('__sc6G' in rd)) rd.__sc6G = rd._$6G;
      rd._$6G = opt.noParallax ? false : rd.__sc6G;
    } catch (e) {}
  }

  // ---- floating dummy state: anchor where it hovers; "broken" while comboed
  var scFloat = { anchor: null, broken: false, lastHit: 0 };
  function resetFloat() { scFloat.anchor = null; scFloat.broken = false; scFloat.lastHit = 0; }

  // resolve which shortid a _$gK display object belongs to (cached on first find)
  function idOf(gk) {
    if (gk.__scId != null) return gk.__scId;
    try {
      var es = game.renderer.entities;
      for (var k in es) { if (es[k] === gk) { gk.__scId = k; return k; } }
    } catch (e) {}
    return null;
  }

  // force every nametag to rebuild on the next frame (picks up color / star / name-only)
  function refreshNametags() {
    try {
      var es = game && game.renderer && game.renderer.entities;
      for (var k in es) { if (es[k]) es[k]._$qN = ''; }
    } catch (e) {}
  }

  // ---------------------------------------------------------------- overlay (PIXI, world space)
  var ov = {
    gfx: null,          // hitbox graphics
    hpTexts: {},        // shortid -> PIXI.Text (self = green, enemies = red)
    floats: [],         // active damage numbers
    pool: [],           // recycled PIXI.Text
    lastPos: {},        // id -> {x, y} stage coords, refreshed every frame
    combo: {},          // id -> cumulative damage of the current combo
    lastHit: {}         // id -> performance.now() of the last hit landed on them
  };

  function worldTextStyle(fill, size) {
    return {
      fontFamily: 'pixelperfect, monospace',
      fontSize: size || 26,
      fill: fill,
      stroke: '#000000',
      strokeThickness: 4
    };
  }

  function ensureOverlay(renderer) {
    if (!ov.gfx) {
      ov.gfx = new PIXI_.Graphics();
      ov.gfx.parentGroup = renderer._$dF;
    }
    if (!ov.gfx.parent) renderer.layer.addChild(ov.gfx);
  }

  function getHpText(renderer, shortid, isSelf) {
    var t = ov.hpTexts[shortid];
    if (!t || t._destroyed) {
      t = new PIXI_.Text('', worldTextStyle(isSelf ? '#8fffb0' : '#ff8f8f'));
      t.anchor.set(0.5, 1);
      t.scale.set(0.28);
      t.parentGroup = renderer._$dF;
      ov.hpTexts[shortid] = t;
    }
    t.style.fill = isSelf ? '#8fffb0' : '#ff8f8f';
    if (!t.parent) renderer.layer.addChild(t);
    return t;
  }

  // ---- side-of-screen damage feed (one row per victim, fades after the combo)
  var feed = { box: null, rows: {} };
  function feedShow(shortid, value) {
    if (!feed.box) {
      feed.box = document.createElement('div');
      feed.box.id = 'sc-dmg-feed';
      document.body.appendChild(feed.box);
    }
    var r = feed.rows[shortid];
    if (!r) {
      r = { el: document.createElement('div'), t: 0 };
      r.el.className = 'sc-dmg-row';
      r.name = document.createElement('div');
      r.name.className = 'sc-dmg-name';
      r.val = document.createElement('div');
      r.val.className = 'sc-dmg-val';
      r.el.appendChild(r.name);
      r.el.appendChild(r.val);
      feed.box.appendChild(r.el);
      feed.rows[shortid] = r;
    }
    var nick = '';
    try {
      var pl = game._$3a.players[shortid];
      if (pl && pl.nickname) nick = pl.nickname;
    } catch (e) {}
    r.name.textContent = nick;
    r.val.textContent = '-' + value;
    r.el.style.opacity = '1';
    clearTimeout(r.t);
    r.t = setTimeout(function () {
      r.el.style.opacity = '0';
      setTimeout(function () {
        if (feed.rows[shortid] === r) {
          delete feed.rows[shortid];
          if (r.el.parentNode) r.el.parentNode.removeChild(r.el);
        }
      }, 500);
    }, 1100);
  }

  function spawnFloat(shortid, amount, kind) {
    if (!game || !PIXI_ || !game.renderer || !game.renderer.layer) return;
    var shown = amount;
    if (kind === 'dmg' && opt.comboDmg) {
      ov.combo[shortid] = (ov.combo[shortid] || 0) + amount;
      ov.lastHit[shortid] = performance.now();
      shown = ov.combo[shortid];
    }
    if (kind === 'dmg' && opt.dmgSide) {
      feedShow(shortid, shown);
      return;
    }
    var pos = ov.lastPos[shortid];
    if (!pos) return;
    var t = ov.pool.pop();
    var color = kind === 'heal' ? '#7dff9e' : '#ff5d5d';
    if (!t) {
      t = new PIXI_.Text('', worldTextStyle(color));
      t.anchor.set(0.5, 1);
      t.scale.set(0.3);
      t.parentGroup = game.renderer._$dF;
    } else {
      t.style.fill = color;
    }
    t.text = (kind === 'heal' ? '+' : '-') + shown;
    t.alpha = 1;
    t.position.set(pos.x + (Math.random() * 14 - 7), pos.y - 22);
    t.visible = true;
    if (!t.parent) game.renderer.layer.addChild(t);
    ov.floats.push({ t: t, born: performance.now() });
  }

  function updateFloats() {
    var now = performance.now(), LIFE = 850;
    for (var i = ov.floats.length - 1; i >= 0; i--) {
      var f = ov.floats[i], p = (now - f.born) / LIFE;
      if (p >= 1) {
        f.t.visible = false;
        ov.floats.splice(i, 1);
        if (ov.pool.length < 40) ov.pool.push(f.t);
        continue;
      }
      f.t.position.y -= 0.45;
      f.t.alpha = 1 - p * p;
    }
  }

  // combo drops when the victim leaves hitstun ("h" no longer in their sim state)
  function updateComboResets(gs, tick) {
    var now = performance.now();
    for (var id in ov.combo) {
      var p = gs.players[id];
      if (!p || p.ingame !== true || !p.c || p.c === -1) {
        delete ov.combo[id];
        delete ov.lastHit[id];
        continue;
      }
      if (now - (ov.lastHit[id] || 0) < 300) continue; // grace between hits
      var st;
      try { st = p._$l1(tick); } catch (e) { st = -1; }
      if (st && st !== -1 && st.s && !('h' in st.s)) {
        delete ov.combo[id];
        delete ov.lastHit[id];
      }
    }
  }


  // ---------------------------------------------------------------- dummy / map helpers
  // force the training dummy to despawn so _$aH respawns it (~1s) with the new char
  function respawnDummy() {
    try {
      if (!inTraining()) return;
      var sv = game.server;              // the _$1z training controller
      if (sv && sv.dummy) sv.dummy._$l9 = 0;
      var d2 = game._$3a.players && game._$3a.players['2'];
      if (d2) d2.ingame = false;
    } catch (e) {}
  }

  // Return to the character-select screen by dying (training only). Replicates
  // exactly what the sim does on death: clears the sim self-player's ingame flag
  // and fires the "iskill" event, which drives the client to show char-select.
  // No manual spawn, so no half-spawned freeze — you just pick again normally.
  function returnToSelect() {
    try {
      if (!inTraining()) return;
      var sv = game.server;
      if (sv && sv._$R && sv._$R !== -1 && sv._$kL && sv._$kL['iskill']) {
        sv._$R.ingame = false;
        sv._$kL['iskill']({ r: 'training ded', id: 1, t: 0 });
      } else {
        // shared room / no local sim: ask the server to send us back to select
        // the same way the exit-and-reenter button would; safe no-op if ignored.
        try { if (sv && sv.emit) sv.emit('spawnb', 0); } catch (e2) {}
      }
    } catch (e) { console.error('[ShadowClient] return-to-select failed', e); }
  }

  // swap the sim + display map while staying in training mode
  function switchTrainingMap(key) {
    try {
      if (!inTraining()) return;
      if (!(key in window.mapDatas) || !(key in window.mapDisplayDatas)) return;
      var gs = game._$3a, rd = game.renderer;
      rd._$hP();                          // destroy current map layers, clear map key
      gs._$9E(key);                       // sim map (collision rects, limits, gravity)
      rd._$9E(key);                       // display layers
      if (game.minimap && game.minimap._$9d) game.minimap._$9d();
      var sp = (window.mapDatas[key].spawnpoints || [[0, 0]]);
      var s0 = sp[0] || [0, 0];
      var s1 = sp[1] || [s0[0] + 4 * 16, s0[1]];
      for (var id in gs.players) {
        var p = gs.players[id];
        p._$1W = gs.map;                  // re-link physics to the new map
        if (p.ingame === true && p.c && p.c !== -1) {
          var pt = (id === '2') ? s1 : s0;
          p._$2l(pt[0], pt[1]);           // teleport with a clean state
          p.c.hp = p.c.maxhp;             // fresh hp on map change
          p.c._$3w = p.c.maxhp;
        }
      }
      ov.combo = {};
      ov.lastHit = {};
    } catch (e) { console.error('[ShadowClient] map switch failed', e); }
  }

  // ---------------------------------------------------------------- hitboxes
  // world rect {x,y,w,h} (y-up) -> draw in stage coords (y-down)
  function drawWorldRect(g, r, color) {
    if (!r || typeof r.x !== 'number') return;
    g.lineStyle(0.6, color, 1);
    g.drawRect(r.x, -(r.y + (r.h || 0)), r.w || 0, r.h || 0);
  }

  function drawHitboxes(gs, tick) {
    var g = ov.gfx;
    // players: hurtboxes (green) + active attack boxes (red)
    for (var id in gs.players) {
      var p = gs.players[id];
      if (!p || p.ingame !== true || !p.c || p.c === -1) continue;
      var st;
      try { st = p._$l1(tick); } catch (e) { st = -1; }
      if (st === -1 || !st) continue;
      try {
        var hurt = p.c._$5W(st);
        if (Array.isArray(hurt)) for (var i = 0; i < hurt.length; i++) drawWorldRect(g, hurt[i], 0x00ff88);
      } catch (e) {}
      try {
        var atk = p.c._$oQ(st);
        if (Array.isArray(atk)) for (var j = 0; j < atk.length; j++) drawWorldRect(g, atk[j], 0xff3355);
      } catch (e) {}
    }
    // entities / projectiles: yellow marker box around current position
    for (var eid in gs.entities) {
      var ent = gs.entities[eid];
      if (!ent || ent._$4O === true) continue;
      var es;
      try { es = ent._$l1(tick); } catch (e) { es = -1; }
      if (es === -1 || !es || typeof es.x !== 'number') continue;
      g.lineStyle(0.6, 0xffe14d, 1);
      g.drawRect(es.x - 4, -es.y - 4, 8, 8);
    }
  }

  // ---------------------------------------------------------------- hook installation
  function installHooks() {
    PIXI_ = window.PIXI;
    game = window._$bG;

    // ---- 1) per-frame overlay: wrap the display-state builder --------------
    var origAB = window._$6d.prototype._$aB;
    window._$6d.prototype._$aB = function (tick) {
      var res = origAB.apply(this, arguments);
      try {
        if (this !== (game && game._$3a)) return res; // only the live game state
        var renderer = game.renderer;
        if (!renderer || !renderer.layer) return res;
        ensureOverlay(renderer);

        // refresh entity screen positions
        if (res && res.entities) {
          for (var id in res.entities) {
            var d = res.entities[id];
            if (!d || typeof d.x !== 'number') continue;
            ov.lastPos[id] = { x: d.x, y: d.y };
          }
        }

        ov.gfx.clear();
        if (opt.hitboxes) drawHitboxes(this, tick);

        // HP text for every ingame player (green = you, red = everyone else)
        var visible = {};
        if (opt.showHP) {
          for (var pid in this.players) {
            var pl = this.players[pid];
            var pp = ov.lastPos[pid];
            if (!pl || pl.ingame !== true || !pl.c || pl.c === -1 || !pp) continue;
            var self_ = sameId(pl.shortid, game.selfid);
            var ht = getHpText(renderer, pid, self_);
            ht.text = Math.max(0, Math.ceil(pl.c.hp)) + ' / ' + pl.c.maxhp;
            // nametag offset for this character (falls back to a typical value)
            var re = renderer.entities[pid];
            var ty = (re && re._$qa && typeof re._$qa.toptexty === 'number') ? re._$qa.toptexty : -26;
            // names hidden -> take the nametag's spot; visible -> stack above it
            var yOff = opt.hideNames ? ty : ty - 9;
            ht.position.set(pp.x, pp.y + yOff);
            ht.visible = true;
            visible[pid] = true;
          }
        }
        for (var hid in ov.hpTexts) {
          if (!visible[hid] && ov.hpTexts[hid]) ov.hpTexts[hid].visible = false;
        }

        // re-float the dummy ~2s after the combo ends (snaps back to its anchor)
        if (opt.floatDummy && scFloat.broken &&
            performance.now() - scFloat.lastHit > 2000) {
          var fd = this.players['2'];
          if (fd && fd.ingame === true && fd.c && fd.c !== -1) {
            var fst;
            try { fst = fd._$l1(tick); } catch (e3) { fst = -1; }
            if (fst && fst !== -1 && fst.s && !('h' in fst.s)) scFloat.broken = false;
          }
        }

        updateComboResets(this, tick);
        updateFloats();
      } catch (e) {}
      return res;
    };

    // ---- 2) damage / heal numbers: wrap hp-event application ---------------
    var origCD = window.Player.prototype._$cD;
    window.Player.prototype._$cD = function (ev, tick) {
      var pre = (this.c && this.c !== -1) ? this.c.hp : null;
      var r = origCD.apply(this, arguments);
      try {
        if (opt.showDmg && pre !== null && this.c && this.c !== -1) {
          var d = pre - this.c.hp;
          if (d >= 1) spawnFloat(this.shortid, Math.round(d), 'dmg');
          else if (d <= -1) spawnFloat(this.shortid, Math.round(-d), 'heal');
        }
      } catch (e) {}
      return r;
    };

    // ---- 3) infinite training dummy HP -------------------------------------
    // Character classes COPY Class.prototype at definition time, so patch every
    // registered subclass prototype in window._$if as well as the base.
    function patchDamageFn(proto, name) {
      var orig = proto[name];
      if (!orig || orig.__sc) return;
      var patched = function (dmg) {
        // any hit on the training dummy drops it out of float mode
        if (isTrainingDummyClass(this)) {
          scFloat.broken = true;
          scFloat.lastHit = performance.now();
        }
        if (opt.infHP && isTrainingDummyClass(this)) {
          if (opt.showDmg && dmg >= 1) {
            try { spawnFloat(2, Math.round(dmg), 'dmg'); } catch (e) {}
          }
          return this.hp; // hp unchanged -> dummy never dies
        }
        return orig.apply(this, arguments);
      };
      patched.__sc = true;
      proto[name] = patched;
    }
    var protos = [window.Class.prototype];
    for (var key in window._$if) {
      if (window._$if[key] && window._$if[key].prototype) protos.push(window._$if[key].prototype);
    }
    protos.forEach(function (pr) {
      patchDamageFn(pr, '_$ls'); // normal damage
      patchDamageFn(pr, '_$m1'); // "can't drop below 1hp" damage
      patchDamageFn(pr, '_$n1'); // chip damage on block
    });

    // ---- 4) cooldown counter (ms) on the skill bar -------------------------
    function cdStyle() {
      return {
        fontFamily: 'pixelperfect, monospace',
        fontSize: 15,
        fill: '#ffe97d',
        stroke: '#000000',
        strokeThickness: 3
      };
    }
    function ensureSlotText(bar, slot) {
      if (!slot.__scT || slot.__scT._destroyed) {
        var t = new PIXI_.Text('', cdStyle());
        t.anchor.set(0.5, 0);
        t.parentGroup = bar.renderer._$mx;
        t.position.set(0, 4); // just below the slot box
        slot.c2.addChild(t);
        slot.__scT = t;
      }
      return slot.__scT;
    }
    function fmtFrames(frames) {
      if (!(frames > 0)) return '';
      return (Math.round(frames * 1000 / 60) / 1000).toFixed(3);
    }
    var origAO = window._$lQ.prototype._$ao;
    window._$lQ.prototype._$ao = function (p, st) {
      var r = origAO.apply(this, arguments);
      try {
        if (p && p.c !== -1 && st && st !== -1) {
          var i, slot, txt;
          if (opt.cdCounter) {
            for (i = 0; i < st.w.length && i < this._$pR.length; i++) {
              slot = this._$pR[i];
              txt = fmtFrames(st.w[i][1]);
              var el = ensureSlotText(this, slot);
              if (el.text !== txt) el.text = txt;
            }
            var dash = this._$iu && this._$iu.dash;
            if (dash && dash.c2) {
              var dt = fmtFrames(st.dc);
              var del = ensureSlotText(this, dash);
              if (del.text !== dt) del.text = dt;
            }
          } else {
            for (i = 0; i < this._$pR.length; i++) {
              if (this._$pR[i].__scT) this._$pR[i].__scT.text = '';
            }
            if (this._$iu && this._$iu.dash && this._$iu.dash.__scT) this._$iu.dash.__scT.text = '';
          }
        }
      } catch (e) {}
      return r;
    };

    // ---- 5) name visibility (hide all / show mine only)
    var origTR = window._$gK.prototype._$2r;
    window._$gK.prototype._$2r = function (a) {
      var r = origTR.apply(this, arguments);
      try {
        if (this._$jp && this._$jp !== -1) {
          var id = idOf(this);
          var self_ = id != null && sameId(id, game.selfid);
          // hidden if "hide names" is on, or "show mine only" is on and this isn't me
          var nameVis = !opt.hideNames && !(opt.showNameOnly && !self_);
          this._$jp.visible = nameVis;
        }
      } catch (e) {}
      return r;
    };

    // ---- 5b) in-world nametag: recolor your own name (local view only).
    // Done in _$aS, which only runs when the nametag actually rebuilds.
    var origAS = window._$gK.prototype._$aS;
    window._$gK.prototype._$aS = function (nick, lv, a) {
      var r = origAS.apply(this, arguments);
      try {
        var id = idOf(this);
        var self_ = id != null && sameId(id, game.selfid);

        // recolor your own name (local view only — others can't see this)
        if (self_ && opt.nameColor && this._$jp && this._$jp !== -1) {
          var cur = this._$jp.styles || this._$a4 || {};
          var cl = {};
          for (var kk in cur) cl[kk] = Object.assign({}, cur[kk]);
          if (!cl.default) cl.default = {};
          cl.default.fill = opt.nameColorHex;
          this._$jp.styles = cl;
        }
      } catch (e) {}
      return r;
    };

    // ---- 5c) leaderboard row: self name color + optional username
    var origCE = window._$bY.prototype._$ce;
    window._$bY.prototype._$ce = function (e, b) {
      var r = origCE.apply(this, arguments);
      try {
        var a = this.entries[e];
        if (a) {
          // self name color (local view)
          if (a._$7g) {
            a._$7g.style.color = (opt.nameColor && sameId(e, game.selfid)) ? opt.nameColorHex : '';
          }

          // username next to the display name
          if (!a.__scUser) {
            a.__scUser = document.createElement('span');
            a.__scUser.className = 'fgui-lb-entry-n';
            a.__scUser.style.opacity = '0.6';
            a.__scUser.style.marginLeft = '4px';
            if (a._$7g && a._$7g.nextSibling) a.insertBefore(a.__scUser, a._$7g.nextSibling);
            else a.appendChild(a.__scUser);
          }
          var uname = (b && b.username && b.username !== -1) ? b.username : '';
          a.__scUser.textContent = (opt.showUsername && uname) ? ('(' + uname + ')') : '';
        }
      } catch (e2) {}
      return r;
    };



    // ---- 6) all characters in Training Mode (training only, not lobbies) ---
    // a) character-select click: lift the lock check only while in training
    var origBU = window._$jf.prototype._$bu;
    window._$jf.prototype._$bu = function (key) {
      if (opt.allChars && inTraining() && this._$lr && key in this._$lr) {
        var stash = this._$lr;
        this._$lr = {};
        try { return origBU.apply(this, arguments); }
        finally { this._$lr = stash; }
      }
      return origBU.apply(this, arguments); // lobbies keep normal lock rules
    };
    // b) training spawn validator: accept any real character
    var origND = window._$1z.prototype._$nd;
    window._$1z.prototype._$nd = function (key) {
      if (opt.allChars && key in window.classDatas && key !== 'default' && key !== 'dummy') {
        return key;
      }
      return origND.apply(this, arguments);
    };

    // ---- 7) dummy character replacement ----------------------------------
    // The dummy always spawns through Player._$bU({c:"dummy"}); swap the class
    // key there and the real character's Class (hp, hurtbox, weight, mechanics)
    // and sprite come along for free. Training-only, shortid 2 only.
    var origBUP = window.Player.prototype._$bU;
    window.Player.prototype._$bU = function (a) {
      try {
        if (a && a.c === 'dummy' && this.shortid === 2 && inTraining() &&
            opt.dummyChar && opt.dummyChar !== 'dummy' &&
            window._$if && opt.dummyChar in window._$if) {
          a = Object.assign({}, a);
          a.c = opt.dummyChar;
          delete a.cos;
        }
        if (a && 'c' in a && sameId(this.shortid, 2) && inTraining()) resetFloat();
      } catch (e) {}
      return origBUP.call(this, a);
    };

    // training respawns use hardcoded coords ((0,0) self, (64,0) dummy) which can
    // be inside walls / over void on other maps — redirect them to map spawnpoints
    var origSP = window.Player.prototype._$2l;
    window.Player.prototype._$2l = function (x, y) {
      try {
        if (inTraining() && game._$3a && game._$3a._$eC && game._$3a._$eC !== 'training') {
          var md = window.mapDatas[game._$3a._$eC];
          var sp = (md && md.spawnpoints) || [[0, 0]];
          var s0 = sp[0] || [0, 0];
          var pt = (this.shortid === 2) ? (sp[1] || [s0[0] + 4 * 16, s0[1]]) : s0;
          x = pt[0];
          y = pt[1];
        }
        if (sameId(this.shortid, 2)) resetFloat(); // respawn/teleport re-anchors
      } catch (e) {}
      return origSP.call(this, x, y);
    };

    // entering training always starts on the training map; sync the dropdown
    var origTM = window._$jm.prototype._$1m;
    window._$jm.prototype._$1m = function () {
      var r = origTM.apply(this, arguments);
      try {
        opt.trainMap = 'training';
        var ms = document.getElementById('sc-map-sel');
        if (ms) ms.value = 'training';
        save();
      } catch (e) {}
      return r;
    };

    // populate the dropdowns now that classDatas / mapDatas exist
    try {
      var ds = document.getElementById('sc-dummy-sel');
      if (ds && !ds.options.length) {
        var o0 = document.createElement('option');
        o0.value = 'dummy';
        o0.textContent = 'Dummy (default)';
        ds.appendChild(o0);
        Object.keys(window.classDatas).sort().forEach(function (k) {
          if (k === 'default' || k === 'dummy') return;
          if (!(k in window._$if)) return;
          var o = document.createElement('option');
          o.value = k;
          o.textContent = window.classDatas[k].name || k;
          ds.appendChild(o);
        });
        ds.value = (opt.dummyChar in window._$if || opt.dummyChar === 'dummy') ? opt.dummyChar : 'dummy';
      }
      var ms2 = document.getElementById('sc-map-sel');
      if (ms2 && !ms2.options.length) {
        Object.keys(window.mapDatas).forEach(function (k) {
          if (k === 'default') return;
          if (!(k in window.mapDisplayDatas)) return;
          var o = document.createElement('option');
          o.value = k;
          o.textContent = (window.mapDisplayDatas[k].name || k) + (k === 'training' ? ' (default)' : '');
          ms2.appendChild(o);
        });
        ms2.value = 'training';
      }
    } catch (e) {}

    // c) locked tiles have no click handler when logged out — delegate one.
    document.addEventListener('click', function (e) {
      if (!opt.allChars || !inTraining() || !game || !game._$1C) return;
      var el = e.target && e.target.closest && e.target.closest('.fgm-class-c-locked');
      if (!el) return;
      var m = el.className.match(/fgm-class-(?!c\b|c-locked|c-selected)([A-Za-z0-9_]+)/);
      if (m && m[1] && game._$1C._$nj && m[1] in game._$1C._$nj) {
        game._$1C._$bu(m[1]);
      }
    }, true);

    // ---- 8) sim-step tweaks: floating dummy + instant reload ---------------
    // Player._$6g(tick, state) advances one sim tick; its return feeds both the
    // state chain and the cache, so pinning values here is authoritative for the
    // local sim. Both features are gated to training.
    var origSG = window.Player.prototype._$6g;
    window.Player.prototype._$6g = function (t, st) {
      var r = origSG.apply(this, arguments);
      try {
        if (r && typeof r === 'object' && inTraining()) {
          // floating dummy: hover at spawn+3 tiles until first hit; while
          // "broken" (being comboed) normal gravity applies
          if (opt.floatDummy && sameId(this.shortid, 2) && typeof r.y === 'number') {
            if (!scFloat.broken) {
              if (!scFloat.anchor) scFloat.anchor = { x: r.x, y: r.y + (opt.floatHeight || 0) };
              r.x = scFloat.anchor.x;
              r.y = scFloat.anchor.y;
              r.dy = 0;
            }
          }
          // instant reload: zero weapon + dash cooldowns and refill ammo for
          // yourself. Only meaningful in SOLO training (local sim authority);
          // in a shared room the server simulates cooldowns and would ignore it.
          if (opt.instaReload && sameId(this.shortid, game && game.selfid) &&
              Array.isArray(r.w) && this.c && this.c !== -1) {
            for (var wi = 0; wi < r.w.length; wi++) {
              if (Array.isArray(r.w[wi])) {
                r.w[wi][1] = 0;                       // cooldown done
                try {
                  var mx = this.c._$ec('wammo' + wi); // refill to max
                  if (typeof mx === 'number' && mx > 0) r.w[wi][0] = mx;
                } catch (e2) {}
              }
            }
            if (typeof r.dc === 'number') r.dc = 0;   // dash ready
          }
        }
      } catch (e) {}
      return r;
    };

    // ---- 9) parallax toggle ------------------------------------------------
    // _$87() = mouse position in world coords. With parallax off, drop the
    // off/k7 lead so manual aim stays pixel-accurate.
    var orig87 = window._$hY.prototype._$87;
    window._$hY.prototype._$87 = function () {
      try {
        if (opt.noParallax && this === game.renderer) {
          return { x: this.camerax + this._$og, y: this.cameray + this._$iB };
        }
      } catch (e) {}
      return orig87.apply(this, arguments);
    };
    setInterval(applyParallax, 500);

    // ---- return-to-select hotkey: press C in training to die -> char select
    window.addEventListener('keydown', function (e) {
      try {
        if (!inTraining()) return;
        if (e.key !== 'v' && e.key !== 'V') return;
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
        e.stopPropagation();
        returnToSelect();
      } catch (er) {}
    }, true);
  }

  // ---------------------------------------------------------------- boot
  var tries = 0;
  var boot = setInterval(function () {
    tries++;
    tagTitle();
    if (window._$bG && window._$6d && window.Player && window.Class &&
        window._$lQ && window._$gK && window._$jf && window._$1z &&
        window._$if && window.PIXI) {
      clearInterval(boot);
      try {
        installHooks();
        console.log('%c[ShadowClient] loaded — press / for the menu',
          'color:#b9a1ff;font-weight:bold');
      } catch (e) {
        console.error('[ShadowClient] failed to install hooks', e);
      }
    } else if (tries > 200) { // ~40s, give up quietly
      clearInterval(boot);
    }
  }, 200);
})();