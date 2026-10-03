// Pack Spin — a mod for customUI (Bandit.RIP).
// Opening a pack plays a CS-style reel that lands on the skin you got, then shows the game's normal popup.
//
// Cosmetic only. The server has already decided the skin by the time this runs: the mod wraps the game's
// "show what you obtained" function (window._$34 in hideout.js v1.5.09) and never touches the request.
// The other tiles on the reel are random draws from the approximate odds below, with no near-miss rigging.
//
// Try it without spending a pack (on any /hideout/inventory page, in the console):
//     PackSpin.test('daiser1')        PackSpin.test()   ← random draw from the pack you're looking at
// The skin table is generated from the community spreadsheet by tools/build_packspin_table.py.

(function () {
  'use strict';
  if (window.PackSpin) return;

  // per pack: w = chance in % for ONE skin of that tier (each pack adds up to 100), s = [id, character, name, tier]
  // <skin-table>
  var PACKS = {
    packa: { w: {"alt": 1.804, "rare": 0.9837, "rainbow": 0.3476, "secret": 0.2146}, s: [
      ["bigb1", "bigb", "Big B Alt #1", "alt"], ["bigb2", "bigb", "Big B Alt #2", "alt"], ["bigb3", "bigb", "Big B Alt #3", "alt"],
      ["bigb4", "bigb", "Big B Alt #4", "alt"], ["bigbs1", "bigb", "Rare Big B", "rare"], ["dai1", "dai", "Dai Alt #1", "alt"],
      ["dai2", "dai", "Dai Alt #2", "alt"], ["dai3", "dai", "Dai Alt #3", "alt"], ["dai4", "dai", "Dai Alt #4", "alt"],
      ["dair1", "dai", "Rainbow Dai", "rainbow"], ["dais1", "dai", "Rare Dai", "rare"], ["emy1", "emy", "Emy Alt #1", "alt"],
      ["emy2", "emy", "Emy Alt #2", "alt"], ["emy3", "emy", "Emy Alt #3", "alt"], ["emy4", "emy", "Emy Alt #4", "alt"],
      ["emyr1", "emy", "Rainbow Emy", "rainbow"], ["emys1", "emy", "Rare Emy", "rare"], ["emyse", "emy", "Secret Emy", "secret"],
      ["janko1", "janko", "Lt. Janko Alt #1", "alt"], ["janko2", "janko", "Lt. Janko Alt #2", "alt"], ["janko3", "janko", "Lt. Janko Alt #3", "alt"],
      ["janko4", "janko", "Lt. Janko Alt #4", "alt"], ["jankos1", "janko", "Rare Lt. Janko", "rare"], ["jonjon1", "jonjon", "Jon Jon Alt #1", "alt"],
      ["jonjon2", "jonjon", "Jon Jon Alt #2", "alt"], ["jonjon3", "jonjon", "Jon Jon Alt #3", "alt"], ["jonjon4", "jonjon", "Jon Jon Alt #4", "alt"],
      ["jonjons1", "jonjon", "Rare Jon Jon", "rare"], ["magekid1", "magekid", "Olif Alt #1", "alt"], ["magekid2", "magekid", "Olif Alt #2", "alt"],
      ["magekid3", "magekid", "Olif Alt #3", "alt"], ["magekid4", "magekid", "Olif Alt #4", "alt"], ["magekidr1", "magekid", "Rainbow Olif", "rainbow"],
      ["magekids1", "magekid", "Rare Olif", "rare"], ["nero1", "nero", "Nero Alt #1", "alt"], ["nero2", "nero", "Nero Alt #2", "alt"],
      ["nero3", "nero", "Nero Alt #3", "alt"], ["nero4", "nero", "Nero Alt #4", "alt"], ["neros1", "nero", "Rare Nero", "rare"],
      ["pboi1", "pboi", "Punk", "alt"], ["pboi2", "pboi", "Punk Alt #1", "alt"], ["pboi3", "pboi", "Punk Alt #2", "alt"],
      ["pboi4", "pboi", "Punk Alt #3", "alt"], ["pboir1", "pboi", "Rainbow Punk", "rainbow"], ["pbois1", "pboi", "Rare Punk", "rare"],
      ["revis1", "revis", "Revis Alt #1", "alt"], ["revis2", "revis", "Revis Alt #2", "alt"], ["revis3", "revis", "Revis Alt #3", "alt"],
      ["revis4", "revis", "Revis Alt #4", "alt"], ["reviss1", "revis", "Rare Revis", "rare"], ["samurai1", "samurai", "Kaizen Alt #1", "alt"],
      ["samurai2", "samurai", "Kaizen Alt #2", "alt"], ["samurai3", "samurai", "Kaizen Alt #3", "alt"], ["samurai4", "samurai", "Kaizen Alt #4", "alt"],
      ["samurais1", "samurai", "Rare Kaizen", "rare"], ["sniper1", "sniper", "Donte Alt #1", "alt"], ["sniper2", "sniper", "Donte Alt #2", "alt"],
      ["sniper3", "sniper", "Donte Alt #3", "alt"], ["sniper4", "sniper", "Donte Alt #4", "alt"], ["snipers1", "sniper", "Rare Donte", "rare"],
      ["zetoman1", "zetoman", "Zetoman Alt #1", "alt"], ["zetoman2", "zetoman", "Zetoman Alt #2", "alt"], ["zetoman3", "zetoman", "Zetoman Alt #3", "alt"],
      ["zetoman4", "zetoman", "Zetoman Alt #4", "alt"], ["zetomans1", "zetoman", "Rare Zetoman", "rare"],
    ] },
    packb: { w: {"alt": 1.6958, "rare": 1.5064, "rainbow": 0.3303, "secret": 0.1813, "secretrainbow": 0.0441, "ultra": 0.3303}, s: [
      ["bazooka1", "bazooka", "Dr. U Alt #1", "alt"], ["bazooka2", "bazooka", "Dr. U Alt #2", "alt"], ["bazooka3", "bazooka", "Dr. U Alt #3", "alt"],
      ["bazooka4", "bazooka", "Dr. U Alt #4", "alt"], ["bazookas1", "bazooka", "Rare Dr. U", "rare"], ["bigb5", "bigb", "Big B Alt #5", "alt"],
      ["bigb6", "bigb", "Big B Alt #6", "alt"], ["bigb7", "bigb", "Big B Alt #7", "alt"], ["bigbr1", "bigb", "Rainbow Big B", "rainbow"],
      ["bigbs2", "bigb", "Rare Big B #2", "rare"], ["bigbse1", "bigb", "Secret Big B", "secret"], ["dai5", "dai", "Dai Alt #5", "alt"],
      ["dai6", "dai", "Dai Alt #6", "alt"], ["dai7", "dai", "Dai Alt #7", "alt"], ["dais2", "dai", "Rare Dai #2", "rare"],
      ["daise1", "dai", "Secret Dai", "secret"], ["daise2", "dai", "Secret Dai #2", "secret"], ["daiser1", "dai", "Secret Rainbow Dai", "secretrainbow"],
      ["daiu1", "dai", "Ultra Rare Dai", "ultra"], ["daiu2", "dai", "Ultra Rare Dai #2", "ultra"], ["emy5", "emy", "Emy Alt #5", "alt"],
      ["emy6", "emy", "Emy Alt #6", "alt"], ["emy7", "emy", "Emy Alt #7", "alt"], ["emys2", "emy", "Rare Emy #2", "rare"],
      ["emyu1", "emy", "Ultra Rare Emy", "ultra"], ["janko5", "janko", "Janko Alt #5", "alt"], ["janko6", "janko", "Janko Alt #6", "alt"],
      ["janko7", "janko", "Janko Alt #7", "alt"], ["jankor1", "janko", "Rainbow Lt. Janko", "rainbow"], ["jankos2", "janko", "Rare Janko #2", "rare"],
      ["jankou1", "janko", "Ultra Rare Janko", "ultra"], ["jonjon5", "jonjon", "Jon Jon Alt #5", "alt"], ["jonjon6", "jonjon", "Jon Jon Alt #6", "alt"],
      ["jonjon7", "jonjon", "Jon Jon Alt #7", "alt"], ["jonjonr1", "jonjon", "Rainbow JonJon", "rainbow"], ["jonjons2", "jonjon", "Rare Jon Jon #2", "rare"],
      ["magekid5", "magekid", "Olif Alt #5", "alt"], ["magekid6", "magekid", "Olif Alt #6", "alt"], ["magekid7", "magekid", "Olif Alt #7", "alt"],
      ["magekids2", "magekid", "Rare Olif #2", "rare"], ["magekidse1", "magekid", "Secret Olif", "secret"], ["magekidser1", "magekid", "Secret Rainbow Olif", "secretrainbow"],
      ["nero5", "nero", "Nero Alt #5", "alt"], ["nero6", "nero", "Nero Alt #6", "alt"], ["nero7", "nero", "Nero Alt #7", "alt"],
      ["neros2", "nero", "Rare Nero #2", "rare"], ["nerou1", "nero", "Ultra Rare Nero", "ultra"], ["nerou2", "nero", "Ultra Rare Nero #2", "ultra"],
      ["pboi5", "pboi", "Punk Alt #5", "alt"], ["pboi6", "pboi", "Punk Alt #6", "alt"], ["pboi7", "pboi", "Punk Alt #7", "alt"],
      ["pbois2", "pboi", "Rare Punk #2", "rare"], ["revis5", "revis", "Revis Alt #5", "alt"], ["revis6", "revis", "Revis Alt #6", "alt"],
      ["revis7", "revis", "Revis Alt #7", "alt"], ["reviss2", "revis", "Rare Revis #2", "rare"], ["samrival1", "samrival", "Rekisu Alt #1", "alt"],
      ["samrival2", "samrival", "Rekisu Alt #2", "alt"], ["samrival3", "samrival", "Rekisu Alt #3", "alt"], ["samrival4", "samrival", "Rekisu Alt #4", "alt"],
      ["samrivals1", "samrival", "Rare Rekisu", "rare"], ["samurai5", "samurai", "Samurai Alt #5", "alt"], ["samurai6", "samurai", "Samurai Alt #6", "alt"],
      ["samurai7", "samurai", "Samurai Alt #7", "alt"], ["samurais2", "samurai", "Rare Samurai #2", "rare"], ["sniper5", "sniper", "Sniper Alt #5", "alt"],
      ["sniper6", "sniper", "Sniper Alt #6", "alt"], ["sniper7", "sniper", "Sniper Alt #7", "alt"], ["sniperr1", "sniper", "Rainbow Donte", "rainbow"],
      ["snipers2", "sniper", "Rare Sniper #2", "rare"], ["zetoman5", "zetoman", "Zetoman Alt #5", "alt"], ["zetoman6", "zetoman", "Zetoman Alt #6", "alt"],
      ["zetoman7", "zetoman", "Zetoman Alt #7", "alt"], ["zetomans2", "zetoman", "Rare Zetoman #2", "rare"], ["zetomanse1", "zetoman", "Secret Zetoman", "secret"],
    ] },
    packchr2: { w: {"common": 16.5564, "secret": 0.6614}, s: [
      ["bazookachr2", "bazooka", "Dr.U Xmas23", "common"], ["bigbchr2", "bigb", "Big B Xmas23", "secret"], ["daichr2", "dai", "Dai Xmas23", "common"],
      ["huntchr2", "hunt", "Huntt Xmas23", "common"], ["jankochr2", "janko", "Lt. Janko Xmas23", "common"], ["jonjonchr2", "jonjon", "JonJon Xmas23", "common"],
      ["nerochr2", "nero", "Nero Xmas23", "common"],
    ] },
    packchr3: { w: {"secret": 0.7082, "common": 16.5486}, s: [
      ["daichr3", "dai", "Dai Xmas24", "secret"], ["emychr3", "emy", "Emy Xmas24", "common"], ["evilolifchr3", "evilolif", "Ubel Xmas24", "common"],
      ["huntchr3", "hunt", "Huntt Xmas24", "common"], ["magekidchr3", "magekid", "Olif Xmas24", "common"], ["revischr3", "revis", "Revis Xmas24", "common"],
      ["sniperchr3", "sniper", "Donte Xmas24", "common"],
    ] },
    packchr4: { w: {"common": 16.5447, "secret": 0.732}, s: [
      ["emychr4", "emy", "Emy Xmas25", "common"], ["magekidchr4", "magekid", "Olif Xmas25", "secret"], ["nerochr4", "nero", "Nero Xmas25", "common"],
      ["pboichr4", "pboi", "Punk Xmas25", "common"], ["samrivalchr4", "samrival", "Rekisu Xmas25", "common"], ["samuraichr4", "samurai", "Kaizen Xmas25", "common"],
      ["zetomanchr4", "zetoman", "Zetoman Xmas25", "common"],
    ] },
    packmarimo: { w: {"common": 9.2357, "uncommon": 5.3543, "rainbow": 0.8957, "ultra": 0.414, "ultrarainbow": 0.3185, "rare": 1.6752}, s: [
      ["bazookamari1", "bazooka", "Special Dr.U #1", "common"], ["bigbmag1", "bigb", "Beach Big B", "uncommon"], ["bigbmagr1", "bigb", "Rainbow Beach Big B", "rainbow"],
      ["bigbmari2", "bigb", "Special Big B #1", "ultra"], ["bigbmarir2", "bigb", "Special Rainbow Big B", "ultrarainbow"], ["daimag1", "dai", "Beach Dai", "uncommon"],
      ["daimagr1", "dai", "Rainbow Beach Dai", "rainbow"], ["daimari1", "dai", "Special Dai #1", "common"], ["daimari2", "dai", "Special Dai #2", "ultra"],
      ["emymari1", "emy", "Special Emy #1", "common"], ["emymari2", "emy", "Special Emy #2", "ultra"], ["jankomag1", "janko", "Beach Janko", "uncommon"],
      ["jankomagr1", "janko", "Rainbow Beach Janko", "rainbow"], ["jonjonmari1", "jonjon", "Special Jon Jon #1", "common"], ["magekidmari1", "magekid", "Special Olif #1", "ultra"],
      ["neromari1", "nero", "Special Nero #1", "rare"], ["pboimari1", "pboi", "Special Punk #1", "common"], ["pboimari2", "pboi", "Special Punk #2", "rare"],
      ["revismari2", "revis", "Special Revis #2", "rare"], ["samrivalmag1", "samrival", "Beach Rekisu", "uncommon"], ["samrivalmagr1", "samrival", "Rainbow Beach Rekisu", "rainbow"],
      ["samuraimari1", "samurai", "Special Kaizen #1", "rare"], ["snipermari1", "sniper", "Special Donte #1", "common"], ["zetomanmari1", "zetoman", "Special Zetoman #1", "common"],
      ["zetomanmari2", "zetoman", "Special Zetoman #2", "rare"],
    ] },
    packspr1: { w: {"common": 12.3763, "secret": 0.9897}, s: [
      ["bigbspr1", "bigb", "Spring Big B", "common"], ["evilolifspr1", "evilolif", "Leprechaun Ubel", "common"], ["magekidspr1", "magekid", "Leprechaun Olif", "common"],
      ["revisspr1", "revis", "Bee Revis", "common"], ["revisspr1se", "revis", "Rainbow Bee Revis", "secret"], ["samrivalspr1", "samrival", "Frog Rekisu", "common"],
      ["samuraispr1", "samurai", "Sakura Kaizen", "common"], ["sniperspr1", "sniper", "Mushroom Donte", "common"], ["zetomanspr1", "zetoman", "Duck Zetoman", "common"],
    ] },
  };
  // </skin-table>

  var TIERS = {
    common:        { label: '',               color: '#9aa7b5' },
    alt:           { label: 'Alt',            color: '#9aa7b5' },
    uncommon:      { label: 'Uncommon',       color: '#5b8dff' },
    rare:          { label: 'Rare',           color: '#a56bff' },
    rainbow:       { label: 'Rainbow',        color: '#ff5fd2', rainbow: true },
    ultra:         { label: 'Ultra Rare',     color: '#ff4a5f' },
    ultrarainbow:  { label: 'Ultra Rainbow',  color: '#ff4a5f', rainbow: true },
    secret:        { label: 'Secret',         color: '#ffc93c' },
    secretrainbow: { label: 'Secret Rainbow', color: '#ffc93c', rainbow: true }
  };

  var TILE = 124, GAP = 8, PITCH = TILE + GAP;   // px
  var COUNT = 64, WIN_AT = 56;                    // tiles on the reel / where the real skin sits
  var SPIN_MS = 6200, HOLD_MS = 1100;

  var opts = { sound: false };
  try { opts.sound = !!JSON.parse(localStorage.getItem('packspin-opts') || '{}').sound; } catch (e) {}
  function saveOpts() { try { localStorage.setItem('packspin-opts', JSON.stringify(opts)); } catch (e) {} }

  // ───────────────────────── which pack / which skin ─────────────────────────
  var lastPack = null;
  function packFromPage() {
    var m = location.pathname.match(/\/inventory\/(pack\w+)/);
    return m ? m[1] : null;
  }
  // the game deletes the pack's tile before showing the result, so note the pack when OPEN PACK is clicked
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('.playerpage-costume-open');
    if (!b || !b.parentElement) return;
    var art = b.parentElement.querySelector('.playerpage-costume');
    var m = art && String(art.style.backgroundImage).match(/packs\/(\w+)\.png/);
    lastPack = (m && m[1]) || packFromPage();
  }, true);

  function findSkin(id, pack) {
    var keys = pack && PACKS[pack] ? [pack] : Object.keys(PACKS);
    for (var k = 0; k < keys.length; k++) {
      var s = PACKS[keys[k]].s;
      for (var i = 0; i < s.length; i++) if (s[i][0] === id) return { pack: keys[k], skin: s[i] };
    }
    return null;
  }
  function draw(pack) {                // one honest weighted draw
    var p = PACKS[pack], r = Math.random() * 100;
    for (var i = 0; i < p.s.length; i++) { r -= p.w[p.s[i][3]]; if (r <= 0) return p.s[i]; }
    return p.s[p.s.length - 1];
  }
  function sprite(skin) { return '/assets/sprites/' + skin[1] + '/costumes/base' + skin[0] + '.png'; }

  // ───────────────────────── sound (off unless switched on) ─────────────────────────
  var ac = null;
  function beep(freq, ms, vol, type) {
    if (!opts.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = type || 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + ms / 1000);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + ms / 1000);
    } catch (e) {}
  }

  // ───────────────────────── look ─────────────────────────
  var css = document.createElement('style');
  css.textContent = [
    '#ps-ov{position:fixed;inset:0;z-index:2147480000;background:rgba(6,6,10,.9);display:flex;flex-direction:column;',
    ' align-items:center;justify-content:center;gap:18px;font-family:pixelperfect,monospace;color:#fff;',
    ' opacity:0;transition:opacity .25s ease;cursor:pointer;user-select:none;overflow:hidden}',
    '#ps-ov.ps-in{opacity:1}',
    '#ps-ov .ps-head{font-size:30px;letter-spacing:3px;opacity:.7;line-height:1}',
    '#ps-ov .ps-win{position:relative;width:min(94vw,' + (PITCH * 7) + 'px);height:' + (TILE + 54) + 'px;overflow:hidden;',
    ' -webkit-mask-image:linear-gradient(90deg,transparent,#000 14%,#000 86%,transparent);',
    ' mask-image:linear-gradient(90deg,transparent,#000 14%,#000 86%,transparent)}',
    '#ps-ov .ps-strip{position:absolute;left:0;top:10px;display:flex;gap:' + GAP + 'px;will-change:transform}',
    '#ps-ov .ps-tile{flex:0 0 ' + TILE + 'px;width:' + TILE + 'px;height:' + (TILE + 34) + 'px;box-sizing:border-box;position:relative;',
    ' background:linear-gradient(180deg,rgba(255,255,255,.05),var(--c-dim));border-bottom:4px solid var(--c);',
    ' transition:transform .25s ease,opacity .25s ease,box-shadow .25s ease}',
    '#ps-ov .ps-tile.ps-rb{border-image:linear-gradient(90deg,#ff5f5f,#ffd95f,#6dff8a,#5fc8ff,#c06bff,#ff5f5f) 1}',
    '#ps-ov .ps-art{position:absolute;left:8%;top:6px;width:84%;height:' + (TILE - 22) + 'px;background:no-repeat center bottom/contain;image-rendering:pixelated}',
    '#ps-ov .ps-name{position:absolute;left:4px;right:4px;bottom:4px;font-size:17px;line-height:1;text-align:center;',
    ' white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--c)}',
    '#ps-ov.ps-done .ps-tile{opacity:.3}',
    '#ps-ov.ps-done .ps-tile.ps-hit{opacity:1;transform:scale(1.07);box-shadow:0 0 26px var(--c);z-index:1}',
    '#ps-ov .ps-mark{position:absolute;left:50%;top:0;bottom:0;width:2px;margin-left:-1px;background:#ffd76a;box-shadow:0 0 10px #ffd76a;pointer-events:none}',
    '#ps-ov .ps-mark:before,#ps-ov .ps-mark:after{content:"";position:absolute;left:-7px;border:8px solid transparent}',
    '#ps-ov .ps-mark:before{top:0;border-top-color:#ffd76a}',
    '#ps-ov .ps-mark:after{bottom:0;border-bottom-color:#ffd76a}',
    '#ps-ov .ps-res{height:58px;text-align:center;line-height:1;opacity:0;transition:opacity .2s ease}',
    '#ps-ov.ps-done .ps-res{opacity:1}',
    '#ps-ov .ps-res b{display:block;font-size:38px;font-weight:normal}',
    '#ps-ov .ps-res span{font-size:20px;letter-spacing:2px;text-transform:uppercase}',
    '#ps-ov .ps-foot{font-size:18px;opacity:.45;display:flex;gap:22px;align-items:center}',
    '#ps-ov .ps-snd{cursor:pointer;border:1px solid currentColor;border-radius:4px;padding:1px 8px 2px}',
    '#ps-ov .ps-snd:hover{opacity:1;color:#ffd76a}'
  ].join('\n');

  function el(cls, parent, text) {
    var d = document.createElement('div');
    d.className = cls;
    if (text != null) d.textContent = text;
    if (parent) parent.appendChild(d);
    return d;
  }
  function makeTile(skin, parent) {
    var t = TIERS[skin[3]] || TIERS.common;
    var d = el('ps-tile' + (t.rainbow ? ' ps-rb' : ''), parent);
    d.style.setProperty('--c', t.color);
    d.style.setProperty('--c-dim', t.color + '2e');
    el('ps-art', d).style.backgroundImage = 'url(' + sprite(skin) + ')';
    el('ps-name', d, skin[2]);
    return d;
  }
  function preload(urls, maxMs) {
    return new Promise(function (done) {
      var left = urls.length, t = setTimeout(done, maxMs);
      if (!left) { clearTimeout(t); return done(); }
      urls.forEach(function (u) {
        var im = new Image();
        im.onload = im.onerror = function () { if (--left <= 0) { clearTimeout(t); done(); } };
        im.src = u;
      });
    });
  }

  // ───────────────────────── the reel ─────────────────────────
  var busy = false;
  // returns false when it can't run (unknown pack, reduced motion…); the caller then shows the popup straight away
  function spin(pack, winner, finish) {
    if (busy || !PACKS[pack] || !document.body) return false;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    busy = true;

    var ov = el('ps-ov');
    ov.id = 'ps-ov';
    el('ps-head', ov, 'OPENING PACK');
    var win = el('ps-win', ov), strip = el('ps-strip', win);
    el('ps-mark', win);
    var res = el('ps-res', ov), resName = document.createElement('b'), resTier = document.createElement('span');
    res.appendChild(resName); res.appendChild(resTier);
    var foot = el('ps-foot', ov);
    el('', foot, 'click to skip');
    var snd = el('ps-snd', foot, 'sound: ' + (opts.sound ? 'on' : 'off'));
    snd.addEventListener('click', function (e) {
      e.stopPropagation();
      opts.sound = !opts.sound; saveOpts();
      snd.textContent = 'sound: ' + (opts.sound ? 'on' : 'off');
      beep(880, 60, .05);
    });

    var skins = [], tiles = [];
    for (var i = 0; i < COUNT; i++) {
      skins.push(i === WIN_AT ? winner : draw(pack));
      tiles.push(makeTile(skins[i], strip));
    }
    tiles[WIN_AT].classList.add('ps-hit');
    var wt = TIERS[winner[3]] || TIERS.common;
    resName.textContent = winner[2];
    resTier.textContent = wt.label;
    res.style.color = wt.color;
    (document.body).appendChild(ov);

    var half = win.clientWidth / 2;
    var startX = 2 * PITCH + TILE / 2;                                    // reel position under the marker at t=0
    var endX = WIN_AT * PITCH + TILE / 2 + (Math.random() - .5) * TILE * .8;   // stops somewhere inside the real tile
    var t0 = 0, raf = 0, lastIdx = -1, ended = false, skipped = false;
    function place(x) { strip.style.transform = 'translate3d(' + (half - x) + 'px,0,0)'; }
    place(startX);

    function end() {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(raf);
      place(endX);
      ov.classList.add('ps-done');
      beep(660, 120, .06, 'triangle'); setTimeout(function () { beep(990, 260, .06, 'triangle'); }, 110);
      setTimeout(function () {
        try { finish(); } finally {
          ov.classList.remove('ps-in');
          setTimeout(function () { ov.remove(); busy = false; }, 260);
        }
      }, skipped ? 450 : HOLD_MS);
    }
    function frame(now) {
      if (ended) return;
      if (!t0) t0 = now;
      var t = Math.min(1, (now - t0) / SPIN_MS);
      var x = startX + (endX - startX) * (1 - Math.pow(1 - t, 4));       // fast start, long slow crawl
      place(x);
      var idx = Math.floor((x + GAP / 2) / PITCH);
      if (idx !== lastIdx) { lastIdx = idx; beep(1200, 28, .025); }
      if (t >= 1) return end();
      raf = requestAnimationFrame(frame);
    }
    ov.addEventListener('click', function () { if (t0 && !ended) { skipped = true; end(); } });

    var first = skins.slice(0, 8).concat([winner]).map(sprite);
    preload(first, 500).then(function () {
      ov.classList.add('ps-in');
      raf = requestAnimationFrame(frame);
      // if the tab is hidden rAF stops; make sure the result still shows up
      setTimeout(function () { if (!ended) end(); }, SPIN_MS + 1500);
    });
    return true;
  }

  // ───────────────────────── hook the game's "You obtained" popup ─────────────────────────
  function install() {
    var orig = window._$34;
    if (typeof orig !== 'function') return false;
    if (orig.__packspin) return true;
    var wrapped = function (type, chr, name, data) {
      var self = this, args = arguments, started = false;
      try {
        var hit = findSkin(type, lastPack || packFromPage());
        var pack = hit ? hit.pack : (lastPack || packFromPage());
        // a skin the table doesn't know yet still gets a reel, drawn in the plainest colour
        var winner = hit ? hit.skin : [type, chr, name, 'common'];
        started = spin(pack, winner, function () { orig.apply(self, args); });
      } catch (e) { console.warn('[PackSpin]', e); }
      lastPack = null;
      if (!started) return orig.apply(this, arguments);
    };
    wrapped.__packspin = true;
    window._$34 = wrapped;
    return true;
  }

  window.PackSpin = {
    packs: PACKS,
    // plays the reel for a skin id (or a random honest draw) without opening anything
    test: function (id, pack) {
      if (!install()) return console.warn('[PackSpin] open an inventory page first (bandit.rip/hideout/inventory/…)');
      pack = pack || packFromPage();
      var hit = id ? findSkin(id, pack) : null;
      if (id && !hit) return console.warn('[PackSpin] unknown skin id: ' + id);
      if (!hit) { pack = PACKS[pack] ? pack : 'packb'; hit = { pack: pack, skin: draw(pack) }; }
      lastPack = hit.pack;
      window._$34(hit.skin[0], hit.skin[1], hit.skin[2], {});
      return hit.skin[2] + ' (' + PACKS[hit.pack].w[hit.skin[3]] + '% each)';
    }
  };

  function boot() {
    (document.head || document.documentElement).appendChild(css);
    var tries = 0, iv = setInterval(function () { if (install() || ++tries > 100) clearInterval(iv); }, 200);
    install();
  }
  if (!/^\/hideout/.test(location.pathname)) return;   // packs are only opened from the hideout
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
