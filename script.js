/* =========================================================
   My Digital Home — script.js  (vanilla JS, no frameworks)
   Everything is saved in localStorage (keys start with "mdh.")
   Music files you add are kept in IndexedDB so they work offline.
   ========================================================= */
'use strict';
(function () {

/* ---------- tiny helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const pick = a => a[Math.floor(Math.random() * a.length)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('mdh.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('mdh.' + k, JSON.stringify(v)); } catch (e) { toast('Storage is full — could not save'); } }
};
const isAndroid = /Android/i.test(navigator.userAgent);

const settings = Object.assign({
  name: '', unit: 'F', h24: false, city: '', lat: null, lon: null,
  reduceMotion: false, wake: false, hidden: {}
}, store.get('settings', {}));
const saveSettings = () => store.set('settings', settings);

let toastT;
function toast(msg, ms = 2400) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}

/* ---------- scale the 1280×800 stage to the screen ---------- */
let baseS = 1, baseX = 0, baseY = 0, shift = 0, fullW = 0;
function applyT() { $('#stage').style.transform = `translate(${baseX}px,${baseY + shift}px) scale(${baseS})`; }
function fit() {
  const w = window.innerWidth, h = window.innerHeight, vv = window.visualViewport;
  const ae = document.activeElement;
  const typing = ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && ae.type !== 'range' && ae.type !== 'file';
  if (typing && w === fullW) {
    // on-screen keyboard is open: slide the stage up so the text box stays visible
    const vh = vv ? vv.height : h;
    const bottom = ae.getBoundingClientRect().bottom - shift;
    shift = Math.min(0, vh - 12 - bottom);
    applyT(); window.scrollTo(0, 0); return;
  }
  fullW = w;
  baseS = Math.min(w / 1280, h / 800);
  baseX = (w - 1280 * baseS) / 2; baseY = (h - 800 * baseS) / 2; shift = 0;
  applyT();
  document.body.classList.toggle('portrait', h > w * 1.05);
}

/* ---------- pixel sprite renderer (merges runs → fewer elements) ---------- */
function sprite(map, pal, px, ox = 0, oy = 0) {
  let s = '';
  map.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      if (c === '.') { x++; continue; }
      let e = x; while (e < row.length && row[e] === c) e++;
      s += `<rect x="${ox + x * px}" y="${oy + y * px}" width="${(e - x) * px}" height="${px}" fill="${pal[c]}"/>`;
      x = e;
    }
  });
  return s;
}
const PAL = { k: '#3b3346', h: '#5a5068', e: '#0f0c14', w: '#ffffff', m: '#6b5f7a', n: '#0f0c14', p: '#ff8fb1', b: '#ff9fc0', c: '#ff6fa0', y: '#ffd44d', g: '#8a7e9a' };
const KURO_AWAKE = [
  '..kk........kk..',
  '.kkkk......kkkk.',
  '.kkkkk....kkkkk.',
  '.kkkkkkkkkkkkkk.',
  '.kkhkkkkkkkkhkk.',
  'kkkkkkkkkkkkkkkk',
  'kkkewkkkkkkewkkk',
  'kkkeekkkkkkeekkk',
  'kbkkkkmmmmkkkkbk',
  '.kkkkmmnnmmkkkk.',
  '.kkkkmmmmmmkkkk.',
  '..kkkkmppmkkkk..',
  '...kkkkppkkkk...',
  '...cccccccccc...',
  '.......yy.......'
];
const KURO_SLEEPY = KURO_AWAKE.slice();
KURO_SLEEPY[6] = 'kkkkkkkkkkkkkkkk';
KURO_SLEEPY[7] = 'kkggkkkkkkkkggkk';
KURO_SLEEPY[11] = '..kkkkmmmmkkkk..';
KURO_SLEEPY[12] = '...kkkkkkkkkk...';
const KURO_BED = [
  '.kk...kk................',
  'kkkk.kkkk...............',
  'kkkkkkkkk....kkkkkk.....',
  'kkkkkkkkkkkkkkkkkkkkk.kk',
  'kgggkgggkkkkkkkhhkkkkkkk',
  'kkkkkkkkkkkkkkhkkkkkkkk.',
  'kkkmmmkkkkkkkkkkkkkkkkk.',
  'kkmmnmmkkkkkkkkkkkkkkkkk',
  '.kkmmmkkkkkkkkkkkkkkkkkk',
  '..kkkkkkkkkkkkkkkkkkkkk.',
  '...kkkkkkkkkkkkkkkkkkk..'
];

const KURO_BED_B = KURO_BED.slice();
KURO_BED_B[2] = 'kkkkkkkkk....kkkkkk...kk';
KURO_BED_B[3] = 'kkkkkkkkkkkkkkkkkkkkk...';
// side view, facing right (walking)
const WALK_A = [
  '..............kk.......',
  '.............kkkk.kk...',
  '.............kkkkkkkk..',
  '.k..........kkkkkkkkk..',
  '.kk.........kkkkkkewk..',
  '..kk........kkkkkkeekmm',
  '...kkkkkkkkkkkkkkkkkmmn',
  '...kkkkkkkkkkkkkkkkkmm.',
  '...kkkkkkkkkkkkkcccc...',
  '...khkkkkkkkkkkkkkk....',
  '...kkkkkkkkkkkkkkkk....',
  '...kk.kk.......kk.kk...',
  '...kk.kk.......kk.kk...',
  '...kk.kk.......kk.kk...'
];
const WALK_B = WALK_A.slice();
WALK_B[3] = '............kkkkkkkkk..';
WALK_B[4] = 'kk..........kkkkkkewk..';
WALK_B[5] = '.kkk........kkkkkkeekmm';
WALK_B[12] = '..kk...kk.....kk...kk..';
WALK_B[13] = '..kk...kk.....kk...kk..';
function headDown(map, c0, dy) { return map.map((row, y) => y > 10 ? row : row.slice(0, c0) + (y - dy >= 0 ? map[y - dy].slice(c0) : '.'.repeat(row.length - c0))); }
const WALK_EAT = headDown(WALK_A, 12, 2);
// sitting, facing right
const SIT_A = [
  '..........kk.......',
  '.........kkkk.kk...',
  '.........kkkkkkkk..',
  '........kkkkkkkkk..',
  '........kkkkkkewk..',
  '........kkkkkkeekmm',
  '.......kkkkkkkkkmmn',
  '......kkkkkkkkkkmm.',
  '.....kkkkkkkcccc...',
  '....kkkkkkkkkkk....',
  '...kkkkkkkkkkkk....',
  'k..kkkkkkkkkkkk....',
  'kk.kkkkkkkk.kk.....',
  '.kkkkkkkkkk.kk.....',
  '..kkkkkkkkk.kkk....'
];
const SIT_B = SIT_A.slice();
SIT_B[10] = 'k..kkkkkkkkkkkk....';
SIT_B[11] = '.k.kkkkkkkkkkkk....';
SIT_B[12] = '...kkkkkkkk.kk.....';
SIT_B[13] = '..kkkkkkkkk.kk.....';

/* ---------- the pixel-art room ---------- */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function starPts(cx, cy, r) {
  let p = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; p.push((cx + Math.cos(a) * rr).toFixed(1) + ',' + (cy + Math.sin(a) * rr).toFixed(1)); }
  return p.join(' ');
}
function buildScene() {
  const R = [], rng = mulberry32(7);
  const rect = (x, y, w, h, f, c) => R.push(`<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}"${f ? ` fill="${f}"` : ''}${c ? ` class="${c}"` : ''}/>`);

  // wall + floor
  rect(0, 0, 1280, 560, '#b99ad6');
  for (let x = 20; x < 1280; x += 40) rect(x, 0, 6, 548, '#c3a7de');
  rect(0, 548, 1280, 12, '#8a5a3c');
  rect(0, 560, 1280, 240, '#b98157');
  for (let y = 560, row = 0; y < 800; y += 26, row++) {
    rect(0, y, 1280, 3, '#9d6a45');
    for (let x = (row % 2) * 90; x < 1280; x += 180) rect(x, y, 3, 26, '#9d6a45');
  }

  // window (contents clipped)
  R.push('<defs><clipPath id="winClip"><rect x="604" y="164" width="352" height="292"/></clipPath></defs><g clip-path="url(#winClip)">');
  const bh = 292 / 6;
  for (let i = 0; i < 6; i++) rect(604, 164 + i * bh, 352, bh + 1, null, 'sky' + i);
  for (let i = 0; i < 26; i++) rect(606 + rng() * 345, 168 + rng() * 150, 2, 2, null, 'nstar');
  R.push('<circle class="sun" cx="884" cy="214" r="26"/>');
  R.push('<g class="moon"><circle cx="890" cy="212" r="22" fill="#fff4d0"/><rect x="880" y="204" width="6" height="6" fill="#efdca6"/><rect x="896" y="220" width="5" height="5" fill="#efdca6"/></g>');
  let x = 604, bi = 0;
  while (x < 956) {
    const w = 22 + Math.floor(rng() * 28), h = 60 + Math.floor(rng() * 110);
    rect(x, 456 - h, w, h, null, 'bld b' + (bi++ % 3));
    for (let wy = 456 - h + 8; wy < 448; wy += 14)
      for (let wx = x + 5; wx < x + w - 6; wx += 9)
        if (rng() < 0.45) rect(wx, wy, 4, 6, null, 'lit');
    x += w + 2;
  }
  // cherry blossom tree
  rect(616, 330, 14, 126, '#6b4433'); rect(628, 300, 10, 40, '#6b4433'); rect(636, 296, 40, 8, '#6b4433'); rect(606, 320, 14, 8, '#6b4433');
  const BL = ['#f7b6cf', '#f9c9dc', '#ef9fc0', '#fde3ee', '#f3a6c0'];
  for (let i = 0; i < 110; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng());
    rect(650 + Math.cos(a) * 90 * d - 4, 268 + Math.sin(a) * 56 * d - 4, 8 + (rng() < .3 ? 4 : 0), 8, BL[Math.floor(rng() * BL.length)]);
  }
  rect(700, 170, 5, 4, '#f9c9dc', 'petal'); rect(760, 150, 5, 4, '#f7b6cf', 'petal p2'); rect(640, 180, 4, 4, '#fde3ee', 'petal p3');
  R.push('</g>');
  // frame, mullions, sill
  rect(590, 150, 380, 14, '#8a5a3c'); rect(590, 150, 14, 306, '#8a5a3c'); rect(956, 150, 14, 306, '#8a5a3c');
  rect(773, 164, 14, 292, '#8a5a3c'); rect(604, 300, 352, 10, '#8a5a3c');
  rect(578, 456, 404, 20, '#9c6844'); rect(578, 476, 404, 6, '#7a4d33'); rect(578, 456, 404, 3, '#b07a52');
  // curtains + rod
  rect(548, 132, 464, 8, '#7a4d33');
  [560, 956].forEach(cx => { rect(cx, 140, 44, 316, '#f7b6cf'); rect(cx + 10, 140, 6, 316, '#f9c9dc'); rect(cx + 28, 140, 6, 316, '#ef9fc0'); rect(cx - 2, 300, 48, 10, '#e48fb2'); });
  // things on the sill
  rect(618, 436, 26, 20, '#d98b6a'); rect(614, 432, 34, 6, '#e59a76'); rect(620, 414, 10, 18, '#5cbf98'); rect(630, 406, 10, 26, '#3f9e7a'); rect(612, 420, 10, 10, '#7fd6ad');
  rect(872, 436, 24, 20, '#fff1dc'); rect(896, 441, 6, 10, '#fff1dc'); rect(876, 440, 16, 3, '#f7b6cf');

  // star string lights
  R.push('<path d="M110 56 Q560 150 990 56" fill="none" stroke="#6b4f3a" stroke-width="2"/>');
  for (let i = 1; i < 12; i++) {
    const t = i / 12, sx = (1 - t) ** 2 * 110 + 2 * (1 - t) * t * 560 + t * t * 990, sy = (1 - t) ** 2 * 56 + 2 * (1 - t) * t * 150 + t * t * 56;
    R.push(`<polygon class="tw" style="animation-delay:${(-i * 0.7).toFixed(1)}s" points="${starPts(sx, sy + 12, 11)}" fill="#ffe08a" stroke="#f5b942" stroke-width="1.5"/>`);
  }

  // bookshelf
  rect(110, 60, 198, 12, '#9c6844'); rect(114, 72, 190, 488, '#7a4d33'); rect(122, 72, 174, 476, '#5c3a28');
  const BOOK = ['#f7b6cf', '#cdb8f0', '#bfead7', '#ffe08a', '#9fd3f0', '#f4a28c', '#fff1dc', '#b08ad6', '#8fd1b5'];
  let top = 72;
  [160, 258, 356, 454, 548].forEach(y => {
    let bx = 126;
    while (bx < 290) {
      if (rng() < 0.12 && bx < 266) {
        rect(bx + 3, y - 16, 16, 16, '#d98b6a'); rect(bx + 1, y - 30, 20, 14, '#5cbf98'); rect(bx + 7, y - 38, 8, 8, '#3f9e7a'); bx += 26; continue;
      }
      const w = 9 + Math.floor(rng() * 9), h = Math.min(y - top - 6, 46 + Math.floor(rng() * 34));
      if (bx + w > 292) break;
      const c = BOOK[Math.floor(rng() * BOOK.length)];
      rect(bx, y - h, w, h, c); rect(bx, y - h + 7, w, 3, '#ffffff55'); rect(bx, y - 12, w, 3, '#00000018');
      bx += w + 1;
    }
    rect(114, y, 190, 10, '#9c6844'); rect(114, y + 10, 190, 3, '#6b4433');
    top = y + 13;
  });
  for (let i = 0; i < 16; i++) rect(114 + rng() * 180, 64 + rng() * 40, 10, 8, rng() < .5 ? '#5cbf98' : '#3f9e7a');
  for (let i = 0; i < 8; i++) rect(118 + i * 4, 72 + i * 9, 8, 8, '#5cbf98');

  // hanging plant
  R.push('<path d="M872 46 L856 92 M872 46 L888 92" stroke="#8a5a3c" stroke-width="2"/>');
  rect(850, 90, 44, 24, '#e59a76'); rect(854, 112, 36, 6, '#d98b6a');
  [852, 866, 880, 890].forEach((vx, i) => { for (let j = 0; j < 4 + i % 3; j++) rect(vx + (j % 2) * 3, 112 + j * 12, 8, 8, j % 2 ? '#3f9e7a' : '#5cbf98'); });
  for (let i = 0; i < 7; i++) rect(848 + i * 7, 82 - (i % 2) * 6, 9, 9, i % 2 ? '#5cbf98' : '#7fd6ad');

  // big floor plant
  for (let i = 0; i < 26; i++) {
    const a = Math.PI + rng() * Math.PI, d = 20 + rng() * 52;
    rect(916 + Math.cos(a) * d - 8, 470 + Math.sin(a) * d * 1.1 - 5, 16, 10, ['#5cbf98', '#3f9e7a', '#7fd6ad'][i % 3]);
  }
  rect(912, 440, 6, 60, '#3f9e7a');
  rect(878, 494, 76, 10, '#e59a76'); rect(884, 504, 64, 52, '#d98b6a'); rect(884, 504, 64, 4, '#c8714f');

  // lamp
  R.push('<circle class="glow" cx="505" cy="432" r="72" fill="#ffe9a8"/>');
  R.push('<polygon points="482,420 528,420 520,446 490,446" fill="#fff1dc"/>');
  rect(503, 446, 5, 100, '#6b4433'); rect(490, 544, 32, 8, '#6b4433');

  // rug + bowl + sign
  rect(470, 552, 390, 44, '#f3a6c0'); rect(478, 558, 374, 32, '#f7c3d6');
  for (let i = 0; i < 12; i++) rect(490 + i * 30, 572, 6, 6, '#fff');
  rect(828, 574, 34, 12, '#8fb8ff'); rect(832, 570, 26, 5, '#c98b5f'); rect(828, 574, 34, 3, '#b5d0ff');
  rect(628, 562, 70, 24, '#c98b5f'); rect(628, 562, 70, 3, '#e0a67a');
  R.push('<text x="663" y="580" text-anchor="middle" font-size="15" font-weight="900" fill="#5b3a26">Kuro</text>');

  // Kuro's bed (tap to pet)
  R.push('<g id="kuroRoom"><rect x="556" y="400" width="210" height="160" fill="transparent"/>');
  rect(572, 488, 176, 8, '#fff1dc'); rect(566, 494, 188, 8, '#fff1dc'); rect(580, 500, 160, 8, '#eac39c');
  R.push('<g id="kBed" class="breathe"></g>');
  rect(560, 504, 200, 48, '#f6d9b8'); rect(560, 504, 200, 4, '#fff1dc'); rect(560, 540, 200, 12, '#eac39c'); rect(566, 548, 188, 6, '#d9ab80');
  rect(574, 508, 6, 32, '#f7b6cf'); rect(740, 508, 6, 32, '#f7b6cf');
  R.push('<g id="kZzz" class="zzz" font-weight="900" fill="#ffffff" stroke="#8f74c9" stroke-width="1"><text x="722" y="452" font-size="16">z</text><text x="722" y="452" font-size="20">z</text><text x="722" y="452" font-size="25">Z</text></g>');
  R.push('<g id="kWalker" style="display:none"><g id="kWalkSpr"></g></g>');
  R.push('<g id="roomHeart"><rect x="584" y="396" width="44" height="36" rx="10" fill="#fff"/><polygon points="596,431 606,431 598,442" fill="#fff"/><text x="606" y="422" text-anchor="middle" font-size="20" fill="#ff6fa0">♥</text></g>');
  R.push('</g>');

  rect(0, 0, 1280, 800, null, 'dim');
  const svg = $('#scene');
  svg.innerHTML = R.join('');
  svg.style.pointerEvents = 'none';
  $('#kuroRoom').addEventListener('click', () => petAction('pet'));
  bedSleep();
}

/* ---------- Kuro moving around the room ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const raf2 = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
const K = { busy: false, x: 662, y: 505, t: null };
const BED_X = 662, BED_Y = 505, FLOOR_Y = 588, BOWL_X = 776;
function bedSleep(tailB) {
  const g = $('#kBed');
  g.innerHTML = sprite(tailB ? KURO_BED_B : KURO_BED, PAL, 5, 602, 452);
  g.removeAttribute('transform'); g.classList.add('breathe'); g.style.display = '';
  $('#kZzz').style.display = '';
}
function bedSit(tailB) {
  const g = $('#kBed');
  g.innerHTML = sprite(tailB ? SIT_B : SIT_A, PAL, 5, 615, 432);
  g.classList.remove('breathe'); g.style.display = '';
  $('#kZzz').style.display = 'none';
}
function walkerDraw(map) { $('#kWalkSpr').innerHTML = sprite(map, PAL, 5, -Math.round(map[0].length * 2.5), -map.length * 5); }
function walkerAt(x, y, dur) {
  const w = $('#kWalker');
  w.style.transition = dur ? `transform ${dur}ms linear` : 'none';
  w.style.transform = `translate(${x}px,${y}px)`;
  K.x = x; K.y = y;
}
function faceDir(d) { if (d < 0) $('#kWalkSpr').setAttribute('transform', 'scale(-1,1)'); else $('#kWalkSpr').removeAttribute('transform'); }
async function wagFor(ms, where) {
  const end = Date.now() + ms; let f = 0;
  while (Date.now() < end) { if (where === 'bed') bedSit(f % 2); else walkerDraw(f % 2 ? SIT_B : SIT_A); f++; await sleep(220); }
}
async function walkTo(x, speed = 75) {
  const dx = x - K.x; if (Math.abs(dx) < 4) return;
  faceDir(dx);
  const dur = Math.abs(dx) / speed * 1000;
  let f = 0;
  const legs = setInterval(() => walkerDraw(f++ % 2 ? WALK_B : WALK_A), speed > 120 ? 110 : 170);
  walkerAt(x, FLOOR_Y, dur);
  await sleep(dur);
  clearInterval(legs); walkerDraw(WALK_A);
}
async function hopOut() {
  $('#kBed').style.display = 'none'; $('#kZzz').style.display = 'none';
  walkerDraw(WALK_A); faceDir(1); walkerAt(BED_X, BED_Y, 0);
  $('#kWalker').style.display = '';
  await raf2();
  walkerAt(700, FLOOR_Y, 320); await sleep(340);
}
async function hopIn() {
  await walkTo(700);
  faceDir(-1); walkerAt(BED_X, BED_Y, 320); await sleep(340);
  $('#kWalker').style.display = 'none';
  bedSit(false); await sleep(500);
  bedSit(true); await sleep(300);
  bedSleep();
}
function kuroFree() { return !K.busy && !settings.reduceMotion && !document.hidden; }
async function kuroDo(fn) {
  if (!kuroFree()) return;
  K.busy = true;
  try { await fn(); }
  catch (e) { $('#kWalker').style.display = 'none'; bedSleep(); }
  finally { K.busy = false; }
}
const KURO_MOVES = {
  twitch: async () => { for (let i = 0; i < 4; i++) { bedSleep(i % 2 === 0); await sleep(260); } bedSleep(); },
  peek: async () => {
    bedSit(false); await wagFor(900, 'bed');
    $('#kBed').setAttribute('transform', 'translate(1325,0) scale(-1,1)'); await sleep(1300);
    $('#kBed').removeAttribute('transform'); await wagFor(900, 'bed');
    bedSleep();
  },
  wander: async () => {
    bedSit(false); await wagFor(900, 'bed');
    await hopOut();
    await walkTo(Math.random() < .5 ? 500 + Math.random() * 60 : 800 + Math.random() * 40);
    walkerDraw(SIT_A); await wagFor(2600 + Math.random() * 2000, 'floor');
    await hopIn();
  },
  eat: async () => {
    bedSit(false); await wagFor(600, 'bed');
    await hopOut(); await walkTo(BOWL_X);
    for (let i = 0; i < 8; i++) { walkerDraw(i % 2 ? WALK_A : WALK_EAT); await sleep(240); }
    walkerDraw(SIT_A); await wagFor(1200, 'floor');
    await hopIn();
  },
  zoomies: async () => {
    bedSit(false); await wagFor(500, 'bed');
    await hopOut();
    await walkTo(500, 200); await walkTo(840, 200); await walkTo(520, 200); await walkTo(760, 200);
    walkerDraw(SIT_A); await wagFor(1600, 'floor');
    await hopIn();
  },
  wag: async () => { bedSit(false); await wagFor(1600, 'bed'); bedSleep(); }
};
function kuroLoop() {
  clearTimeout(K.t);
  K.t = setTimeout(async () => {
    const h = new Date().getHours(), night = h >= 22 || h < 6, r = Math.random();
    let move = 'twitch';
    if (!night && pet.energy >= 20) move = r < .2 ? 'twitch' : r < .45 ? 'peek' : r < .8 ? 'wander' : 'eat';
    await kuroDo(KURO_MOVES[move]);
    kuroLoop();
  }, 18000 + Math.random() * 27000);
}
function updateSky(d) {
  const h = d.getHours();
  const ph = (h >= 20 || h < 5) ? 'night' : h < 8 ? 'dawn' : h < 17 ? 'day' : 'dusk';
  $('#scene').setAttribute('class', 'ph-' + ph);
}

/* ---------- opening Android apps ---------- */
// Chrome on Android opens "intent://" links: if the app is installed it opens,
// otherwise the browser_fallback_url (the website) opens instead.
function launch(a) {
  if (isAndroid && a.pkg) {
    window.location.href = `intent://${a.host || ''}#Intent;scheme=${a.scheme};package=${a.pkg};S.browser_fallback_url=${encodeURIComponent(a.url)};end`;
  } else {
    window.open(a.url, '_blank', 'noopener');
  }
}
const APPS = [
  { id: 'home', label: 'Home', icon: '🏠', bg: '#f7b6cf', act: () => { closeSheet(); } },
  { id: 'library', label: 'Library', icon: '📚', bg: '#ffd9a8', act: () => openLibrary() },
  { id: 'wechat', label: 'WeChat', icon: '💬', bg: '#8fe0a6', pkg: 'com.tencent.mm', scheme: 'weixin', host: '', url: 'https://web.wechat.com' },
  { id: 'chatgpt', label: 'ChatGPT', icon: '✨', bg: '#cfe9e0', pkg: 'com.openai.chatgpt', scheme: 'https', host: 'chatgpt.com/', url: 'https://chatgpt.com' },
  { id: 'youtube', label: 'YouTube', icon: '▶️', bg: '#ffb8b8', pkg: 'com.google.android.youtube', scheme: 'https', host: 'www.youtube.com/', url: 'https://m.youtube.com' },
  { id: 'rednote', label: 'RedNote', icon: '📕', bg: '#ffa3b3', pkg: 'com.xingin.xhs', scheme: 'xhsdiscover', host: 'home', url: 'https://www.xiaohongshu.com' },
  { id: 'bilibili', label: 'Bilibili', icon: '📺', bg: '#a8dcf5', pkg: 'tv.danmaku.bili', scheme: 'bilibili', host: 'home', url: 'https://m.bilibili.com' },
  { id: 'play', label: 'Play Store', icon: '🛍️', bg: '#bfe3ff', pkg: 'com.android.vending', scheme: 'https', host: 'play.google.com/store/apps', url: 'https://play.google.com/store/apps' },
  { id: 'chrome', label: 'Chrome', icon: '🌐', bg: '#fff1a8', pkg: 'com.android.chrome', scheme: 'https', host: 'www.google.com/', url: 'https://www.google.com' },
  { id: 'music', label: 'Music', icon: '🎵', bg: '#d9c8ff', act: () => openPlaylist() },
  { id: 'notes', label: 'Notes', icon: '📝', bg: '#fff3a8', act: () => openNotes() },
  { id: 'garden', label: 'Garden', icon: '🌱', bg: '#bfead7', act: () => openGarden() },
  { id: 'settings', label: 'Settings', icon: '⚙️', bg: '#e3dcef', act: () => openSettings() }
];
const app = id => APPS.find(a => a.id === id);
function buildSidebar() {
  const nav = $('#sidebar');
  nav.innerHTML = APPS.map(a => `<button class="app" data-app="${a.id}"><i style="background:${a.bg}">${a.icon}</i><span>${a.label}</span></button>`).join('');
  nav.addEventListener('click', e => {
    const b = e.target.closest('.app'); if (!b) return;
    const a = app(b.dataset.app);
    if (a.act) a.act(); else launch(a);
  });
}

/* ---------- pop-up sheet ---------- */
let onSheetClose = null;
function openSheet(title, html, mount, onClose) {
  if (!$('#overlay').hidden) closeSheet();
  $('#sheetTitle').textContent = title;
  $('#sheetBody').innerHTML = html;
  $('#sheetBody').scrollTop = 0;
  $('#overlay').hidden = false;
  onSheetClose = onClose || null;
  if (mount) mount($('#sheetBody'));
}
function closeSheet() {
  if ($('#overlay').hidden) return;
  if (document.activeElement) document.activeElement.blur();
  $('#overlay').hidden = true; $('#sheetBody').innerHTML = '';
  if (onSheetClose) { const f = onSheetClose; onSheetClose = null; f(); }
}

/* ---------- clock ---------- */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtTime(d, html) {
  let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0');
  if (settings.h24) return `${String(h).padStart(2, '0')}:${m}`;
  const ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12;
  return html ? `${h}:${m}<small>${ap}</small>` : `${h}:${m} ${ap}`;
}
let clockT;
function tickClock() {
  const d = new Date();
  $('#clockTime').innerHTML = fmtTime(d, true);
  $('#clockDate').textContent = `${DAYS[d.getDay()]}, ${MONS[d.getMonth()]} ${d.getDate()}`;
  $('#tbTime').textContent = fmtTime(d, false);
  updateSky(d);
  clearTimeout(clockT);
  clockT = setTimeout(tickClock, 60000 - d.getSeconds() * 1000 - d.getMilliseconds() + 30);
}

/* ---------- planner ---------- */
let tasks = store.get('tasks', [
  { id: 1, text: 'Finish project', done: true },
  { id: 2, text: 'Read a chapter', done: false },
  { id: 3, text: 'Relax! ♡', done: false }
]);
const saveTasks = () => store.set('tasks', tasks);
function renderTasks() {
  const ul = $('#plList');
  if (!tasks.length) { ul.innerHTML = '<li class="empty">Nothing yet — add a task below ✨</li>'; return; }
  ul.innerHTML = tasks.map(t => `<li class="${t.done ? 'done' : ''}" data-id="${t.id}"><button class="pl-tog"><span class="pl-check">${t.done ? '✓' : ''}</span><span class="pl-text">${esc(t.text)}</span></button><button class="pl-del" aria-label="Remove">×</button></li>`).join('');
}
function initPlanner() {
  $('#plList').addEventListener('click', e => {
    const li = e.target.closest('li[data-id]'); if (!li) return;
    const id = +li.dataset.id;
    if (e.target.closest('.pl-del')) tasks = tasks.filter(t => t.id !== id);
    else if (e.target.closest('.pl-tog')) { const t = tasks.find(t => t.id === id); t.done = !t.done; if (t.done && tasks.every(x => x.done)) toast('All done! Kuro is proud of you 🐾'); }
    saveTasks(); renderTasks();
  });
  $('#plForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#plInput').value.trim(); if (!v) return;
    tasks.push({ id: Date.now(), text: v, done: false });
    $('#plInput').value = ''; saveTasks(); renderTasks();
    const ul = $('#plList'); ul.scrollTop = ul.scrollHeight;
  });
  $('#plClear').addEventListener('click', () => {
    const n = tasks.filter(t => t.done).length;
    tasks = tasks.filter(t => !t.done); saveTasks(); renderTasks();
    toast(n ? `Cleared ${n} finished task${n > 1 ? 's' : ''} 🧹` : 'No finished tasks to clear');
  });
}

/* ---------- Kuro ---------- */
const pet = Object.assign({ happy: 80, energy: 75, full: 70, xp: 0, lv: 1, t: Date.now() }, store.get('pet', {}));
function petTick() {
  const now = Date.now(), h = Math.max(0, (now - pet.t) / 36e5);
  pet.t = now;
  if (h > 0) {
    pet.full = clamp(pet.full - 4 * h);
    pet.happy = clamp(pet.happy - (pet.full < 20 ? 5 : 2.5) * h);
    pet.energy = clamp(pet.energy + 8 * h);
  }
  store.set('pet', pet);
}
const SAY = {
  feed: ['Yum yum! 🍖', 'Delicious!', '*crunch crunch*', 'Best chef ever!'],
  full: ["I'm full! 🐶", 'Maybe later…', 'No more room!'],
  play: ['Again! Again! 🎾', 'Woof woof!', 'Zoomies!!', 'Catch!'],
  tired: ['Too sleepy… 💤', 'Nap first?'],
  pet: ['Good boy? Yes! ♡', '*happy wiggle*', 'More pets pls', '♡ ♡ ♡']
};
function moodLine() {
  if (pet.full < 25) return "I'm hungry! 🍖";
  if (pet.energy < 25) return 'So sleepy… 💤';
  if (pet.happy < 30) return 'I feel lonely… 🥺';
  return settings.name ? `Hi ${settings.name}! 🐾` : pick(['Woof!', 'Hi friend! 🐾', 'I missed you!', "Let's play?"]);
}
function gainXP(n) {
  pet.xp += n;
  const need = pet.lv * 50;
  if (pet.xp >= need) { pet.xp -= need; pet.lv++; setTimeout(() => toast(`🎉 Kuro reached Level ${pet.lv}!`), 300); }
}
let lastSleepy = null;
function kuroWidgetSVG(sleepy) {
  let inner;
  if (sleepy) inner = sprite(KURO_SLEEPY, PAL, 1);
  else {
    const base = KURO_AWAKE.map((r, y) => (y === 6 || y === 7) ? r.replace(/[ew]/g, 'k') : r);
    inner = sprite(base, PAL, 1) +
      `<g class="eo">${sprite([KURO_AWAKE[6].replace(/k/g, '.'), KURO_AWAKE[7].replace(/k/g, '.')], PAL, 1, 0, 6)}</g>` +
      `<g class="ec">${sprite(['...gg......gg...'], PAL, 1, 0, 7)}</g>`;
  }
  return `<svg viewBox="0 0 16 15" width="96" height="90" shape-rendering="crispEdges">${inner}</svg>`;
}
function burst(emoji, n = 3) {
  if (settings.reduceMotion) return;
  const p = $('#kPic');
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'kp'; s.textContent = emoji;
    s.style.setProperty('--dx', (Math.random() * 60 - 30).toFixed(0) + 'px');
    s.style.animationDelay = (i * 0.15) + 's';
    s.addEventListener('animationend', () => s.remove());
    p.appendChild(s);
  }
}
function kuroWidgetIdle() {
  setInterval(() => {
    if (document.hidden || settings.reduceMotion || lastSleepy) return;
    const svg = $('#kPic svg'); if (!svg) return;
    svg.classList.add('blink'); setTimeout(() => svg.classList.remove('blink'), 160);
    const p = $('#kPic');
    if (Math.random() < .2 && !/hop|tilt/.test(p.className)) p.classList.add('tilt');
  }, 4200);
  $('#kPic').addEventListener('animationend', e => { if (e.target.tagName.toLowerCase() === 'svg' && e.animationName !== 'idle') e.currentTarget.classList.remove('hop', 'hop3', 'tilt'); });
}
function renderPet(msg) {
  $('#kHappy').style.width = pet.happy + '%';
  $('#kEnergy').style.width = pet.energy + '%';
  $('#kFull').style.width = pet.full + '%';
  $('#kLv').textContent = 'Lv. ' + pet.lv;
  if (msg) $('#kSay').textContent = msg;
  const sleepy = pet.energy < 25;
  if (sleepy !== lastSleepy) {
    $('#kPic').querySelectorAll('svg').forEach(x => x.remove());
    $('#kPic').insertAdjacentHTML('afterbegin', kuroWidgetSVG(sleepy));
    lastSleepy = sleepy;
  }
}
function petAction(kind) {
  petTick();
  let msg, anim = 'hop';
  if (kind === 'feed') {
    if (pet.full >= 95) { msg = pick(SAY.full); anim = 'tilt'; }
    else { pet.full = clamp(pet.full + 25); pet.happy = clamp(pet.happy + 4); gainXP(5); msg = pick(SAY.feed); burst('🍖', 2); kuroDo(KURO_MOVES.eat); }
  } else if (kind === 'play') {
    if (pet.energy < 15) { msg = pick(SAY.tired); anim = 'tilt'; burst('💤', 2); }
    else { pet.energy = clamp(pet.energy - 15); pet.happy = clamp(pet.happy + 14); pet.full = clamp(pet.full - 5); gainXP(10); msg = pick(SAY.play); anim = 'hop3'; burst('🎾', 2); kuroDo(KURO_MOVES.zoomies); }
  } else {
    pet.happy = clamp(pet.happy + 8); gainXP(3); msg = pick(SAY.pet); burst('💗', 3);
    const h = $('#roomHeart');
    const walking = $('#kWalker').style.display !== 'none';
    h.setAttribute('transform', walking ? `translate(${Math.round(K.x - 560)},${Math.round(K.y - 520)})` : '');
    h.classList.add('show'); setTimeout(() => h.classList.remove('show'), 1500);
    kuroDo(KURO_MOVES.wag);
  }
  store.set('pet', pet);
  renderPet(msg);
  const p = $('#kPic'); p.classList.remove('hop', 'hop3', 'tilt'); void p.offsetWidth; p.classList.add(anim);
}
function initPet() {
  $$('[data-pet]').forEach(b => b.addEventListener('click', () => petAction(b.dataset.pet)));
  $('#kPic').addEventListener('click', () => petAction('pet'));
}

/* ---------- garden ---------- */
const FLOWERS = {
  tulip: { name: 'Tulip', petal: '#ff8fb1', petal2: '#ffc2d6', center: '#ff5f93' },
  sunflower: { name: 'Sunflower', petal: '#ffd44d', petal2: '#ffe98f', center: '#8a5a3c' },
  daisy: { name: 'Daisy', petal: '#ffffff', petal2: '#efe8f5', center: '#ffd44d' },
  bluebell: { name: 'Bluebell', petal: '#8fb8ff', petal2: '#c2d8ff', center: '#5b7fd6' },
  lavender: { name: 'Lavender', petal: '#b48ae6', petal2: '#d8c2f5', center: '#8f62c9' },
  rose: { name: 'Rose', petal: '#ff6f7d', petal2: '#ff9ca6', center: '#d9475a' }
};
const STAGES = ['Seed', 'Sprout', 'Leafy', 'Bud', 'Blooming'];
const TH = [0, 2, 8, 16, 26];           // hours of wet soil needed for each stage
const DRAIN = 3;                        // water % lost per hour
const garden = store.get('garden', null) || {
  t: Date.now(), bloomed: 0,
  plants: [['tulip', 27], ['sunflower', 17], ['daisy', 9], ['bluebell', 2]].map(([type, g]) => ({ type, water: 70, growth: g, bloomedOnce: g >= 26 }))
};
const saveGarden = () => store.set('garden', garden);
function stageOf(p) { let s = 0; TH.forEach((t, i) => { if (p.growth >= t) s = i; }); return s; }
function checkBloom(p) {
  if (stageOf(p) === 4 && !p.bloomedOnce) { p.bloomedOnce = true; garden.bloomed++; toast(`🌸 Your ${FLOWERS[p.type].name} bloomed!`); }
}
function gardenTick() {
  const now = Date.now(), h = Math.max(0, (now - garden.t) / 36e5);
  garden.t = now;
  garden.plants.forEach(p => {
    const wet = Math.min(h, p.water / DRAIN);
    p.water = Math.max(0, p.water - DRAIN * h);
    p.growth = Math.min(30, p.growth + wet);
    checkBloom(p);
  });
  saveGarden();
}
function plantSVG(p, w = 48) {
  const f = FLOWERS[p.type], st = stageOf(p), wilt = p.water <= 0 && st > 0;
  const leaf = wilt ? '#b9a66a' : '#5cbf98', leaf2 = wilt ? '#a08d55' : '#3f9e7a';
  const r = []; const R = (x, y, ww, h, c) => r.push(`<rect x="${x}" y="${y}" width="${ww}" height="${h}" fill="${c}"/>`);
  R(3, 13, 10, 1, '#6b4433'); R(2, 14, 12, 2, '#e59a76'); R(3, 16, 10, 4, '#d98b6a'); R(3, 16, 10, 1, '#c8714f');
  if (st === 0) R(7, 12, 2, 1, '#8a5a3c');
  else {
    const h = [0, 3, 6, 9, 9][st];
    R(7, 13 - h, 2, h, leaf2);
    R(5, 12, 2, 1, leaf); R(9, 11, 2, 1, leaf);
    if (st >= 2) { R(4, 9, 3, 2, leaf); R(9, 7, 3, 2, leaf); }
    if (st === 3) { R(6, 2, 4, 2, leaf2); R(7, 1, 2, 2, f.petal); }
    if (st === 4) { R(6, 0, 4, 1, f.petal2); R(5, 1, 6, 3, wilt ? '#d8c8a8' : f.petal); R(6, 4, 4, 1, f.petal2); R(7, 2, 2, 1, f.center); }
  }
  return `<svg viewBox="0 0 16 20" width="${w}" height="${w * 1.25}" shape-rendering="crispEdges">${r.join('')}</svg>`;
}
function renderGarden(splash) {
  $('#gPots').innerHTML = garden.plants.map((p, i) => `<button class="g-pot${splash ? ' splash' : ''}" data-i="${i}" aria-label="${FLOWERS[p.type].name}">${plantSVG(p)}<span class="g-wl"><i style="width:${Math.round(p.water)}%"></i></span></button>`).join('');
}
function waterAll() {
  gardenTick();
  let any = false;
  garden.plants.forEach(p => { if (p.water < 90) { p.water = Math.min(100, p.water + 40); p.growth = Math.min(30, p.growth + 0.5); any = true; checkBloom(p); } });
  saveGarden(); renderGarden(any);
  if (any) toast('💧 Watered! The plants look happy.');
  else toast('The soil is still wet — no need to water yet 🌿');
}
function initGarden() {
  $('#gWater').addEventListener('click', waterAll);
  $('#gPots').addEventListener('click', e => {
    const b = e.target.closest('.g-pot'); if (!b) return;
    const p = garden.plants[+b.dataset.i];
    toast(`${FLOWERS[p.type].name} · ${STAGES[stageOf(p)]} · 💧 ${Math.round(p.water)}%${p.water <= 0 ? ' — thirsty!' : ''}`);
  });
  $('#gHelp').addEventListener('click', () => toast('Water every day or so. Plants only grow while their soil is wet, and bloom after about a day and a half of care 🌸', 5000));
}

/* ---------- notes ---------- */
const NOTE_COLORS = ['#fff6b8', '#ffd9e6', '#d6f3e6', '#e6dcff'];
let notes = store.get('notes', [{ id: 1, text: 'A little happiness\nevery day ♡', c: 0 }]);
if (!notes.length) notes = [{ id: 1, text: '', c: 0 }];
let ni = Math.min(store.get('noteIdx', 0), notes.length - 1);
const saveNotes = () => { store.set('notes', notes); store.set('noteIdx', ni); };
function renderNote() {
  const n = notes[ni];
  $('#nText').value = n.text;
  $('#nCount').textContent = `${ni + 1}/${notes.length}`;
  $('#w-notes').style.background = NOTE_COLORS[n.c % 4];
}
function initNotes() {
  let t;
  $('#nText').addEventListener('input', e => {
    notes[ni].text = e.target.value;
    $('#nFoot').textContent = 'saving…';
    clearTimeout(t); t = setTimeout(() => { saveNotes(); $('#nFoot').textContent = '✓ saved'; }, 400);
  });
  $('#nPrev').addEventListener('click', () => { ni = (ni - 1 + notes.length) % notes.length; saveNotes(); renderNote(); });
  $('#nNext').addEventListener('click', () => { ni = (ni + 1) % notes.length; saveNotes(); renderNote(); });
  $('#nAdd').addEventListener('click', () => { notes.push({ id: Date.now(), text: '', c: notes.length % 4 }); ni = notes.length - 1; saveNotes(); renderNote(); $('#nText').focus(); });
  $('#nDel').addEventListener('click', () => {
    if (notes[ni].text.trim() && !confirm('Delete this note?')) return;
    if (notes.length === 1) notes[0].text = '';
    else { notes.splice(ni, 1); ni = Math.min(ni, notes.length - 1); }
    saveNotes(); renderNote();
  });
}
function openNotes() {
  const card = (n, i) => `<div class="nCard" style="background:${NOTE_COLORS[n.c % 4]}"><textarea data-i="${i}" placeholder="Write something…" maxlength="2000">${esc(n.text)}</textarea><div class="row"><button class="ib sm" data-color="${i}" title="Colour">🎨</button><button class="ib sm" data-del="${i}" title="Delete">🗑</button></div></div>`;
  const draw = b => { $('#nGrid', b).innerHTML = notes.map(card).join(''); };
  openSheet('📝 Notes', '<div class="row" style="margin-bottom:14px"><button class="btn yel" id="nNew">＋ New note</button><span class="hint" style="margin:0">Everything saves automatically.</span></div><div class="nGrid" id="nGrid"></div>', b => {
    draw(b);
    let t;
    b.addEventListener('input', e => { const i = e.target.dataset.i; if (i == null) return; notes[+i].text = e.target.value; clearTimeout(t); t = setTimeout(saveNotes, 400); });
    b.addEventListener('click', e => {
      const d = e.target.closest('[data-del]'), c = e.target.closest('[data-color]');
      if (d) { const i = +d.dataset.del; if (notes[i].text.trim() && !confirm('Delete this note?')) return; notes.splice(i, 1); if (!notes.length) notes.push({ id: Date.now(), text: '', c: 0 }); ni = Math.min(ni, notes.length - 1); saveNotes(); draw(b); }
      if (c) { const i = +c.dataset.color; notes[i].c = (notes[i].c + 1) % 4; saveNotes(); draw(b); }
    });
    $('#nNew', b).addEventListener('click', () => { notes.push({ id: Date.now(), text: '', c: notes.length % 4 }); saveNotes(); draw(b); const ta = $$('textarea', b).pop(); ta.focus(); });
  }, () => { saveNotes(); renderNote(); });
}

/* ---------- weather (Open-Meteo, free, no key) ---------- */
function wmo(code, day = 1) {
  if (code === 0) return [day ? '☀️' : '🌙', day ? 'Sunny' : 'Clear'];
  if (code === 1) return [day ? '🌤️' : '🌙', 'Mostly clear'];
  if (code === 2) return ['⛅', 'Partly cloudy'];
  if (code === 3) return ['☁️', 'Cloudy'];
  if (code === 45 || code === 48) return ['🌫️', 'Foggy'];
  if (code >= 51 && code <= 57) return ['🌦️', 'Drizzle'];
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return ['🌧️', 'Rain'];
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ['🌨️', 'Snow'];
  if (code >= 95) return ['⛈️', 'Thunderstorm'];
  return ['🌡️', '—'];
}
function renderWeather(c, stale) {
  const body = $('#wxBody');
  $('#wxPlace').textContent = '☀️ ' + (settings.city || 'Weather');
  if (!c) {
    body.innerHTML = `<div class="wx-empty">Where are you? I'll fetch your weather.<button class="btn mint sm" id="wxGeo">📍 Use my location</button><span>or set a city in Settings</span></div>`;
    $('#wxGeo').addEventListener('click', useMyLocation);
    return;
  }
  const d = c.data, u = '°';
  const [ico, desc] = wmo(d.current.weather_code, d.current.is_day);
  const days = [1, 2, 3].map(i => {
    const dt = new Date(d.daily.time[i] + 'T12:00');
    return `<div class="wx-d"><b>${DAYS[dt.getDay()]}</b><span>${wmo(d.daily.weather_code[i])[0]}</span><small>${Math.round(d.daily.temperature_2m_max[i])}${u}/${Math.round(d.daily.temperature_2m_min[i])}${u}</small></div>`;
  }).join('');
  body.innerHTML = `<div class="wx-now"><div class="wx-ico">${ico}</div><div><div class="wx-temp">${Math.round(d.current.temperature_2m)}°${c.unit}</div><div class="wx-desc">${desc}</div><div class="wx-hl">High ${Math.round(d.daily.temperature_2m_max[0])}${u} · Low ${Math.round(d.daily.temperature_2m_min[0])}${u}</div></div></div><div class="wx-days">${days}</div>${stale ? '<div class="wx-note">offline · last update ' + fmtTime(new Date(c.t), false) + '</div>' : ''}`;
}
let wxBusy = false;
async function loadWeather(force) {
  const cache = store.get('weather', null);
  const fresh = cache && cache.unit === settings.unit && cache.lat === settings.lat && cache.lon === settings.lon && Date.now() - cache.t < 30 * 60e3;
  if (settings.lat == null) { renderWeather(null); return; }
  if (fresh && !force) { renderWeather(cache); return; }
  if (!navigator.onLine) { renderWeather(cache && cache.lat === settings.lat ? cache : null, true); return; }
  if (wxBusy) return; wxBusy = true;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${settings.lat}&longitude=${settings.lon}&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=${settings.unit === 'C' ? 'celsius' : 'fahrenheit'}&timezone=auto&forecast_days=4`;
    const r = await fetch(url); if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    const c = { t: Date.now(), unit: settings.unit, lat: settings.lat, lon: settings.lon, data };
    store.set('weather', c); renderWeather(c);
  } catch (e) {
    if (cache && cache.lat === settings.lat) renderWeather(cache, true); else renderWeather(null);
    if (force) toast('Could not reach the weather service');
  } finally { wxBusy = false; }
}
function useMyLocation() {
  if (!navigator.geolocation) { toast('Location is not available — set a city in Settings'); return; }
  toast('Finding you… 📍');
  navigator.geolocation.getCurrentPosition(async pos => {
    settings.lat = +pos.coords.latitude.toFixed(3); settings.lon = +pos.coords.longitude.toFixed(3);
    settings.city = 'My location';
    try {
      const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${settings.lat}&longitude=${settings.lon}&localityLanguage=en`);
      const j = await r.json(); settings.city = j.city || j.locality || j.principalSubdivision || 'My location';
    } catch (e) { }
    saveSettings(); loadWeather(true);
    const l = $('#sLoc'); if (l) l.textContent = settings.city;
  }, () => toast('Location permission was denied — set a city in Settings instead'), { timeout: 15000, maximumAge: 36e5 });
}

/* ---------- music ---------- */
const idb = {
  db: null,
  open() { return this.db || (this.db = new Promise((res, rej) => { const r = indexedDB.open('mdh', 1); r.onupgradeneeded = () => r.result.createObjectStore('songs'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); },
  async run(mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('songs', mode); const req = fn(tx.objectStore('songs')); tx.oncomplete = () => res(req && req.result); tx.onerror = () => rej(tx.error); }); },
  put(k, v) { return this.run('readwrite', s => s.put(v, k)); },
  get(k) { return this.run('readonly', s => s.get(k)); },
  del(k) { return this.run('readwrite', s => s.delete(k)); }
};
const DEFAULT_PL = [
  { id: 'r1', title: 'Groove Salad', artist: 'SomaFM · chill radio', url: 'https://ice2.somafm.com/groovesalad-128-mp3', kind: 'stream' },
  { id: 'r2', title: 'Fluid', artist: 'SomaFM · instrumental hip-hop', url: 'https://ice2.somafm.com/fluid-128-mp3', kind: 'stream' },
  { id: 'r3', title: 'Drone Zone', artist: 'SomaFM · ambient', url: 'https://ice2.somafm.com/dronezone-128-mp3', kind: 'stream' }
];
let playlist = store.get('playlist', DEFAULT_PL);
let mi = clamp(store.get('musicIdx', 0), 0, Math.max(0, playlist.length - 1));
const audio = new Audio(); audio.preload = 'none';
audio.volume = store.get('vol', 60) / 100;
let objURL = null, loadedId = null;
function renderMusic() {
  const t = playlist[mi];
  $('#muTitle').textContent = t ? t.title : 'No songs yet';
  $('#muArtist').textContent = t ? t.artist : 'Tap ☰ to add music';
  $('#muPlay').textContent = audio.paused ? '▶' : '❚❚';
  $('#muPlay').setAttribute('aria-label', audio.paused ? 'Play' : 'Pause');
  $('.mu-prog').classList.toggle('live', !!t && t.kind !== 'file' && !audio.paused && !isFinite(audio.duration));
  if ('mediaSession' in navigator && t && window.MediaMetadata) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, artwork: [{ src: 'assets/icon-512.png', sizes: '512x512', type: 'image/png' }] });
  }
}
async function loadTrack(i, autoplay) {
  if (!playlist.length) { audio.pause(); renderMusic(); return; }
  mi = (i + playlist.length) % playlist.length; store.set('musicIdx', mi);
  const t = playlist[mi];
  if (objURL) { URL.revokeObjectURL(objURL); objURL = null; }
  let src = t.url;
  if (t.kind === 'file') {
    try { const blob = await idb.get(t.id); if (!blob) { toast('That song file is missing'); return; } objURL = URL.createObjectURL(blob); src = objURL; }
    catch (e) { toast('Could not load that song'); return; }
  }
  audio.src = src; loadedId = t.id; $('#muProg').style.width = '0';
  renderMusic();
  if (autoplay) play();
}
function play() {
  if (!playlist.length) { toast('Add some songs first 🎵'); openPlaylist(); return; }
  if (loadedId !== playlist[mi].id) { loadTrack(mi, true); return; }
  audio.play().catch(() => toast(navigator.onLine ? 'Could not play this track' : "You're offline — try a song saved on the tablet"));
}
function initMusic() {
  $('#muVol').value = Math.round(audio.volume * 100);
  $('#muVol').addEventListener('input', e => { audio.volume = e.target.value / 100; store.set('vol', +e.target.value); });
  $('#muPlay').addEventListener('click', () => audio.paused ? play() : audio.pause());
  $('#muNext').addEventListener('click', () => loadTrack(mi + 1, true));
  $('#muPrev').addEventListener('click', () => { if (audio.currentTime > 5 && isFinite(audio.duration)) audio.currentTime = 0; else loadTrack(mi - 1, true); });
  $('#muList').addEventListener('click', openPlaylist);
  ['play', 'pause', 'playing'].forEach(ev => audio.addEventListener(ev, renderMusic));
  audio.addEventListener('ended', () => loadTrack(mi + 1, true));
  audio.addEventListener('timeupdate', () => { if (isFinite(audio.duration) && audio.duration > 0) $('#muProg').style.width = (audio.currentTime / audio.duration * 100) + '%'; });
  audio.addEventListener('error', () => { if (audio.getAttribute('src')) toast('This track could not be played'); renderMusic(); });
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', play);
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
      navigator.mediaSession.setActionHandler('nexttrack', () => loadTrack(mi + 1, true));
      navigator.mediaSession.setActionHandler('previoustrack', () => loadTrack(mi - 1, true));
    } catch (e) { }
  }
  renderMusic();
}
function openPlaylist() {
  const list = () => playlist.length ? playlist.map((t, i) => `<div class="song${i === mi ? ' cur' : ''}"><button class="ib big" data-play="${i}" aria-label="Play">${i === mi && !audio.paused ? '❚❚' : '▶'}</button><div><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></div><button class="ib" data-del="${i}" aria-label="Remove">🗑</button></div>`).join('') : '<p class="hint">Your playlist is empty.</p>';
  openSheet('🎵 Music', `<div class="songs" id="mSongs"></div>
    <div class="row wrap"><label class="btn mint">＋ Add songs from this tablet<input type="file" accept="audio/*" multiple hidden id="mFile"></label></div>
    <h3 class="sec">Add a song or radio link</h3>
    <div class="row"><input id="mTitle" placeholder="Name" style="max-width:200px"><input id="mUrl" placeholder="https://… (mp3 or internet radio)" inputmode="url"><button class="btn" id="mAddUrl">Add</button></div>
    <p class="hint">Songs you add from the tablet are stored inside the app, so they play offline. Radio links need internet.</p>`, b => {
    const draw = () => { $('#mSongs', b).innerHTML = list(); };
    draw();
    b.addEventListener('click', async e => {
      const p = e.target.closest('[data-play]'), d = e.target.closest('[data-del]');
      if (p) { const i = +p.dataset.play; if (i === mi && !audio.paused) audio.pause(); else if (i === mi) play(); else await loadTrack(i, true); setTimeout(draw, 150); }
      if (d) {
        const i = +d.dataset.del, t = playlist[i];
        if (t.kind === 'file') { try { await idb.del(t.id); } catch (er) { } }
        if (t.id === loadedId) { audio.pause(); audio.removeAttribute('src'); audio.load(); loadedId = null; }
        playlist.splice(i, 1);
        if (mi >= playlist.length) mi = Math.max(0, playlist.length - 1); else if (i < mi) mi--;
        store.set('playlist', playlist); store.set('musicIdx', mi); draw(); renderMusic();
      }
    });
    $('#mFile', b).addEventListener('change', async e => {
      const files = Array.from(e.target.files || []); if (!files.length) return;
      toast('Saving songs…');
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
      let n = 0;
      for (const f of files) {
        const id = 'f' + Date.now() + Math.random().toString(36).slice(2, 7);
        try { await idb.put(id, f); playlist.push({ id, title: f.name.replace(/\.[^.]+$/, ''), artist: 'On this tablet', kind: 'file' }); n++; } catch (er) { toast('Not enough space to save ' + f.name); }
      }
      store.set('playlist', playlist); draw(); renderMusic(); e.target.value = '';
      if (n) toast(`Added ${n} song${n > 1 ? 's' : ''} 🎶`);
    });
    $('#mAddUrl', b).addEventListener('click', () => {
      const url = $('#mUrl', b).value.trim(); if (!/^https?:\/\//i.test(url)) { toast('Paste a link starting with https://'); return; }
      const title = $('#mTitle', b).value.trim() || url.split('/').pop() || 'Radio';
      playlist.push({ id: 'u' + Date.now(), title, artist: 'Link', url, kind: 'url' });
      store.set('playlist', playlist); $('#mUrl', b).value = ''; $('#mTitle', b).value = ''; draw(); renderMusic();
    });
  });
}

/* ---------- library ---------- */
const LIB = [
  { icon: '🦉', label: 'Kiwix', sub: 'Offline Wikipedia', pkg: 'com.android.vending', scheme: 'market', host: 'details?id=org.kiwix.kiwixmobile', url: 'https://play.google.com/store/apps/details?id=org.kiwix.kiwixmobile' },
  { icon: '📗', label: 'Play Books', sub: 'Your e-books', pkg: 'com.google.android.apps.books', scheme: 'https', host: 'play.google.com/store/books', url: 'https://play.google.com/books' },
  { icon: '📜', label: 'Gutenberg', sub: '70,000 free classics', url: 'https://www.gutenberg.org' },
  { icon: '🏛️', label: 'Open Library', sub: 'Borrow books free', url: 'https://openlibrary.org' },
  { icon: '🌍', label: 'Wikipedia', sub: 'Online encyclopedia', pkg: 'org.wikipedia', scheme: 'https', host: 'en.wikipedia.org/', url: 'https://en.wikipedia.org' },
  { icon: '🔭', label: 'NASA', sub: 'Space pictures', url: 'https://science.nasa.gov/image-of-the-day/' },
  { icon: '🎨', label: 'Art', sub: 'Met Museum collection', url: 'https://www.metmuseum.org/art/collection' },
  { icon: '🗺️', label: 'Maps', sub: 'Google Maps', pkg: 'com.google.android.apps.maps', scheme: 'https', host: 'maps.google.com/', url: 'https://maps.google.com' }
];
function openLibrary() {
  let links = store.get('links', []);
  const tile = (l, i, custom) => `<button class="tile" data-${custom ? 'c' : 'l'}="${i}"><i>${l.icon}</i><b>${esc(l.label)}</b><small>${esc(l.sub || '')}</small>${custom ? `<span class="rm" data-rm="${i}">✕</span>` : ''}</button>`;
  openSheet('📚 Library', `<div class="tiles">${LIB.map((l, i) => tile(l, i)).join('')}</div>
    <h3 class="sec">My bookmarks</h3><div class="tiles" id="lCustom"></div>
    <div class="row" style="margin-top:12px"><input id="lName" placeholder="Name" style="max-width:200px"><input id="lUrl" placeholder="https://…" inputmode="url"><button class="btn" id="lAdd">Add</button></div>`, b => {
    const draw = () => { $('#lCustom', b).innerHTML = links.length ? links.map((l, i) => tile(l, i, true)).join('') : '<p class="hint" style="grid-column:1/-1;margin:0">Add your favourite reading sites below.</p>'; };
    draw();
    b.addEventListener('click', e => {
      const rm = e.target.closest('[data-rm]');
      if (rm) { links.splice(+rm.dataset.rm, 1); store.set('links', links); draw(); return; }
      const l = e.target.closest('[data-l]'), c = e.target.closest('[data-c]');
      if (l) launch(LIB[+l.dataset.l]);
      if (c) launch(links[+c.dataset.c]);
    });
    $('#lAdd', b).addEventListener('click', () => {
      let url = $('#lUrl', b).value.trim(); if (!url) return;
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      links.push({ icon: '🔖', label: $('#lName', b).value.trim() || url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0], sub: 'Bookmark', url });
      store.set('links', links); $('#lUrl', b).value = ''; $('#lName', b).value = ''; draw();
    });
  });
}

/* ---------- garden sheet ---------- */
function openGarden() {
  gardenTick();
  const opts = sel => Object.keys(FLOWERS).map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${FLOWERS[k].name}</option>`).join('');
  const draw = b => {
    $('#gCards', b).innerHTML = garden.plants.map((p, i) => {
      const st = stageOf(p), next = TH[st + 1];
      const grow = st === 4 ? 100 : Math.round((p.growth - TH[st]) / (next - TH[st]) * 100);
      return `<div class="gcard">${plantSVG(p, 72)}<b>${FLOWERS[p.type].name}</b><span>${STAGES[st]}${p.water <= 0 && st > 0 ? ' · thirsty!' : ''}</span>
        <span style="width:100%">💧 water</span><div class="gbar"><i style="width:${Math.round(p.water)}%;background:#6cb8f0"></i></div>
        <span style="width:100%">🌱 ${st === 4 ? 'fully grown' : 'next stage'}</span><div class="gbar"><i style="width:${grow}%;background:#5cc79c"></i></div>
        <select data-sel="${i}">${opts(p.type)}</select><button class="btn sm mint" data-re="${i}">Replant</button></div>`;
    }).join('');
  };
  openSheet('🌱 Garden', `<div class="row" style="margin-bottom:14px"><button class="btn" id="gW2" style="background:#d8ecfb;box-shadow:0 3px 0 #a9cdeb">💧 Water all</button><span class="hint" style="margin:0">Flowers grown so far: <b id="gCount">${garden.bloomed}</b> 🌸</span></div><div class="gcards" id="gCards"></div>
    <p class="hint">Plants drink a little every hour and only grow while their soil is wet. Water about once a day — a fully watered pot lasts about 33 hours.</p>`, b => {
    draw(b);
    $('#gW2', b).addEventListener('click', () => { waterAll(); draw(b); });
    b.addEventListener('click', e => {
      const r = e.target.closest('[data-re]'); if (!r) return;
      const i = +r.dataset.re, type = $(`[data-sel="${i}"]`, b).value;
      if (stageOf(garden.plants[i]) > 0 && !confirm('Replant this pot? The current plant will be removed.')) return;
      garden.plants[i] = { type, water: 50, growth: 0, bloomedOnce: false };
      saveGarden(); draw(b); renderGarden(); toast(`Planted a ${FLOWERS[type].name} seed 🌱`);
    });
  });
}

/* ---------- quick tools ---------- */
const TOOLS = [
  { icon: '▶️', label: 'YouTube', bg: '#ffb8b8', run: () => launch(app('youtube')) },
  { icon: '📕', label: 'RedNote', bg: '#ffa3b3', run: () => launch(app('rednote')) },
  { icon: '📺', label: 'Bilibili', bg: '#a8dcf5', run: () => launch(app('bilibili')) },
  { icon: '🌐', label: 'Browser', bg: '#fff1a8', run: () => openBrowser() },
  { icon: '🧮', label: 'Calculator', bg: '#d9c8ff', run: () => openCalc() },
  { icon: '📖', label: 'Dictionary', bg: '#bfead7', run: () => openDict() }
];
function buildTools() {
  $('#qt').innerHTML = TOOLS.map((t, i) => `<button data-t="${i}"><i style="background:${t.bg}">${t.icon}</i>${t.label}</button>`).join('');
  $('#qt').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) TOOLS[+b.dataset.t].run(); });
}
function openBrowser() {
  const QUICK = [['🔎', 'Google', 'https://www.google.com'], ['🌍', 'Wikipedia', 'https://en.wikipedia.org'], ['📌', 'Pinterest', 'https://www.pinterest.com'], ['✉️', 'Gmail', 'https://mail.google.com']];
  openSheet('🌐 Browser', `<form class="row" id="bForm"><input id="bIn" placeholder="Search or type a web address" inputmode="url" enterkeyhint="go"><button class="btn">Go</button></form>
    <div class="tiles" style="margin-top:16px">${QUICK.map(q => `<button class="tile" data-u="${q[2]}"><i>${q[0]}</i><b>${q[1]}</b></button>`).join('')}</div>
    <p class="hint">Pages open in Chrome. Press the back button to return to your Digital Home.</p>`, b => {
    $('#bForm', b).addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#bIn', b).value.trim(); if (!v) return;
      const url = /^https?:\/\//i.test(v) ? v : (/^[^\s]+\.[a-z]{2,}(\/.*)?$/i.test(v) ? 'https://' + v : 'https://www.google.com/search?q=' + encodeURIComponent(v));
      window.open(url, '_blank', 'noopener');
    });
    b.addEventListener('click', e => { const t = e.target.closest('[data-u]'); if (t) window.open(t.dataset.u, '_blank', 'noopener'); });
  });
}
function openCalc() {
  const KEYS = ['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '⌫', '='];
  let ex = '', last = '';
  openSheet('🧮 Calculator', `<div class="calc"><div class="calc-disp"><div class="ex" id="cEx"></div><div class="rs" id="cRs">0</div></div><div class="calc-keys">${KEYS.map(k => `<button class="${'÷×−+()'.includes(k) ? 'op' : k === '=' ? 'eq' : ''}" data-k="${k}">${k}</button>`).join('')}</div></div>`, b => {
    const show = () => { $('#cRs', b).textContent = (ex || '0').slice(-16); $('#cEx', b).textContent = last; };
    b.addEventListener('click', e => {
      const k = e.target.closest('[data-k]'); if (!k) return;
      const v = k.dataset.k;
      if (v === 'C') { ex = ''; last = ''; }
      else if (v === '⌫') ex = ex.slice(0, -1);
      else if (v === '=') {
        const js = ex.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
        if (!/^[0-9+\-*/.() ]+$/.test(js)) return;
        try { const r = Function('"use strict";return (' + js + ')')(); if (!isFinite(r)) throw 0; last = ex + ' ='; ex = String(+r.toPrecision(12)); }
        catch (er) { last = 'Oops — check that sum'; }
      } else ex += v;
      show();
    });
  });
}
function openDict() {
  openSheet('📖 Dictionary', `<form class="row" id="dForm"><input id="dIn" placeholder="Type an English word…" autocomplete="off" enterkeyhint="search"><button class="btn">Look up</button></form><div id="dOut" class="d-out"><p class="hint">Definitions come from the free dictionaryapi.dev service (needs internet).</p></div>`, b => {
    $('#dForm', b).addEventListener('submit', async e => {
      e.preventDefault();
      const w = $('#dIn', b).value.trim(); if (!w) return;
      const out = $('#dOut', b);
      if (!navigator.onLine) { out.innerHTML = "<p class='hint'>You're offline — connect to Wi-Fi to look up words.</p>"; return; }
      out.innerHTML = '<p class="hint">Looking up…</p>';
      try {
        const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(w));
        if (!r.ok) throw 0;
        const d = (await r.json())[0];
        const ph = d.phonetic || ((d.phonetics || []).find(p => p.text) || {}).text || '';
        let h = `<h3>${esc(d.word)} <small>${esc(ph)}</small></h3>`;
        (d.meanings || []).slice(0, 3).forEach(m => {
          h += `<p class="pos">${esc(m.partOfSpeech)}</p><ol>` + m.definitions.slice(0, 3).map(x => `<li>${esc(x.definition)}${x.example ? `<br><i>“${esc(x.example)}”</i>` : ''}</li>`).join('') + '</ol>';
        });
        out.innerHTML = h;
      } catch (er) { out.innerHTML = `<p class="hint">No definition found for “${esc(w)}”.</p>`; }
    });
  });
}

/* ---------- settings ---------- */
const WIDGETS = [['clock', 'Clock'], ['weather', 'Weather'], ['planner', 'Planner'], ['music', 'Music'], ['kuro', 'Kuro'], ['garden', 'Garden'], ['tools', 'Quick tools'], ['notes', 'Notes']];
function applySettings() {
  $('#tbTitle').textContent = settings.name ? `${settings.name}'s Digital Home` : 'My Digital Home';
  document.body.classList.toggle('reduce', !!settings.reduceMotion);
  WIDGETS.forEach(([id]) => $('#w-' + id).classList.toggle('hide', !!settings.hidden[id]));
  applyWake();
}
let wakeLock = null;
async function applyWake() {
  if (settings.wake && 'wakeLock' in navigator && document.visibilityState === 'visible') {
    if (!wakeLock) { try { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } catch (e) { } }
  } else if (wakeLock) { wakeLock.release().catch(() => { }); wakeLock = null; }
}
function goFull() {
  const el = document.documentElement;
  if (document.fullscreenElement) { document.exitFullscreen().catch(() => { }); return; }
  if (!el.requestFullscreen) { toast('Fullscreen is not available here'); return; }
  el.requestFullscreen().then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => { }); }).catch(() => toast('Fullscreen is not available here'));
}
function openSettings() {
  openSheet('⚙️ Settings', `
    <div class="two">
      <label class="field"><span>Your name</span><input id="sName" maxlength="20" value="${esc(settings.name)}" placeholder="e.g. Rashid"></label>
      <div class="field"><span>Temperature & clock</span><div class="row"><div class="seg" data-k="unit"><button data-v="F">°F</button><button data-v="C">°C</button></div><div class="seg" data-k="h24"><button data-v="0">12h</button><button data-v="1">24h</button></div></div></div>
    </div>
    <div class="field"><span>Weather location: <b id="sLoc">${esc(settings.city || 'not set')}</b></span>
      <div class="row"><button class="btn mint" id="sGeo">📍 Use my location</button><input id="sCity" placeholder="or type a city…" enterkeyhint="search"><button class="btn" id="sCityGo">Search</button></div>
      <div class="res" id="sRes"></div></div>
    <div class="field"><span>Show widgets</span><div class="row wrap" id="sWid">${WIDGETS.map(([id, l]) => `<button class="tog${settings.hidden[id] ? '' : ' on'}" data-w="${id}">${l}</button>`).join('')}</div></div>
    <div class="field"><span>Tablet</span><div class="row wrap">
      <button class="tog${settings.wake ? ' on' : ''}" data-s="wake">☀️ Keep screen awake</button>
      <button class="tog${settings.reduceMotion ? ' on' : ''}" data-s="reduceMotion">🐢 Fewer animations</button>
      <button class="btn" id="sFs">⛶ Fullscreen</button></div></div>
    <div class="field"><span>Your data (saved only on this tablet)</span><div class="row wrap">
      <button class="btn" id="sExp">⬇ Back up</button>
      <label class="btn">⬆ Restore<input type="file" accept="application/json,.json" hidden id="sImp"></label>
      <button class="btn pink" id="sReset">Reset everything</button></div></div>
    <p class="hint">My Digital Home v1.0 · made for G-TiDE H1 · Weather by Open-Meteo</p>`, b => {
    const segs = () => { $$('.seg', b).forEach(s => $$('button', s).forEach(x => { const k = s.dataset.k; const cur = k === 'h24' ? (settings.h24 ? '1' : '0') : settings[k]; x.classList.toggle('on', x.dataset.v === cur); })); };
    segs();
    $('#sName', b).addEventListener('input', e => { settings.name = e.target.value.trim(); saveSettings(); applySettings(); });
    b.addEventListener('click', e => {
      const sb = e.target.closest('.seg button');
      if (sb) {
        const k = sb.parentNode.dataset.k;
        if (k === 'h24') { settings.h24 = sb.dataset.v === '1'; tickClock(); }
        else { settings.unit = sb.dataset.v; loadWeather(true); }
        saveSettings(); segs();
      }
      const w = e.target.closest('[data-w]');
      if (w) { const id = w.dataset.w; settings.hidden[id] = !settings.hidden[id]; w.classList.toggle('on', !settings.hidden[id]); saveSettings(); applySettings(); }
      const s = e.target.closest('[data-s]');
      if (s) { const k = s.dataset.s; settings[k] = !settings[k]; s.classList.toggle('on', settings[k]); saveSettings(); applySettings(); if (k === 'wake' && settings.wake && !('wakeLock' in navigator)) toast('This browser cannot keep the screen awake'); }
      const r = e.target.closest('[data-lat]');
      if (r) { settings.lat = +r.dataset.lat; settings.lon = +r.dataset.lon; settings.city = r.dataset.name; saveSettings(); $('#sLoc', b).textContent = settings.city; $('#sRes', b).innerHTML = ''; loadWeather(true); toast('Weather set to ' + settings.city); }
    });
    $('#sGeo', b).addEventListener('click', useMyLocation);
    const search = async () => {
      const q = $('#sCity', b).value.trim(); if (!q) return;
      if (!navigator.onLine) { toast("You're offline"); return; }
      try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`);
        const j = await r.json();
        $('#sRes', b).innerHTML = (j.results || []).map(c => `<button data-lat="${c.latitude}" data-lon="${c.longitude}" data-name="${esc(c.name)}">📍 ${esc(c.name)}${c.admin1 ? ', ' + esc(c.admin1) : ''} · ${esc(c.country || '')}</button>`).join('') || '<p class="hint">No places found.</p>';
      } catch (er) { toast('Could not search right now'); }
    };
    $('#sCityGo', b).addEventListener('click', search);
    $('#sCity', b).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
    $('#sFs', b).addEventListener('click', goFull);
    $('#sExp', b).addEventListener('click', () => {
      const o = {};
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('mdh.') && k !== 'mdh.weather') o[k] = localStorage.getItem(k); }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(o, null, 1)], { type: 'application/json' }));
      a.download = 'my-digital-home-backup.json'; document.body.appendChild(a); a.click(); a.remove();
      toast('Backup saved to Downloads (music files are not included)');
    });
    $('#sImp', b).addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => {
        const o = JSON.parse(t);
        if (!confirm('Replace your current data with this backup?')) return;
        Object.keys(o).forEach(k => { if (k.startsWith('mdh.')) localStorage.setItem(k, o[k]); });
        location.reload();
      }).catch(() => toast('That file is not a valid backup'));
    });
    $('#sReset', b).addEventListener('click', () => {
      if (!confirm('Erase all tasks, notes, Kuro and garden progress, and settings?')) return;
      Object.keys(localStorage).filter(k => k.startsWith('mdh.')).forEach(k => localStorage.removeItem(k));
      try { indexedDB.deleteDatabase('mdh'); } catch (er) { }
      location.reload();
    });
  });
}

/* ---------- status bar ---------- */
function updateNet() { $('#tbNet').textContent = navigator.onLine ? '📶' : '🚫'; $('#tbNet').title = navigator.onLine ? 'Online' : 'Offline'; }
function initBattery() {
  if (!navigator.getBattery) return;
  navigator.getBattery().then(b => {
    const upd = () => { $('#tbBat').textContent = (b.charging ? '⚡' : '🔋') + Math.round(b.level * 100) + '%'; };
    upd(); b.addEventListener('levelchange', upd); b.addEventListener('chargingchange', upd);
  }).catch(() => { });
}

/* ---------- start ---------- */
function init() {
  buildScene(); buildSidebar(); buildTools();
  initPlanner(); initPet(); initGarden(); initNotes(); initMusic();
  applySettings(); fit(); tickClock();
  petTick(); renderPet(moodLine());
  gardenTick(); renderGarden();
  renderTasks(); renderNote(); updateNet(); initBattery();
  loadWeather();
  kuroWidgetIdle(); kuroLoop();

  $('#sheetClose').addEventListener('click', closeSheet);
  $('#overlay').addEventListener('click', e => { if (e.target.id === 'overlay') closeSheet(); });
  $('#fsBtn').addEventListener('click', goFull);
  $('#wxRefresh').addEventListener('click', () => settings.lat == null ? useMyLocation() : loadWeather(true));

  window.addEventListener('resize', fit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  document.addEventListener('focusin', () => setTimeout(fit, 350));
  document.addEventListener('focusout', () => setTimeout(() => { if (shift) { shift = 0; applyT(); } window.scrollTo(0, 0); }, 150));
  window.addEventListener('online', () => { updateNet(); loadWeather(); });
  window.addEventListener('offline', updateNet);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    tickClock(); petTick(); renderPet(); gardenTick(); renderGarden(); loadWeather(); applyWake();
  });
  // one light check every 5 minutes (skipped while the screen is off / app hidden)
  setInterval(() => { if (document.hidden) return; petTick(); renderPet(); gardenTick(); renderGarden(); loadWeather(); }, 5 * 60e3);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('service-worker.js').catch(() => { });
  }
}
init();
})();
