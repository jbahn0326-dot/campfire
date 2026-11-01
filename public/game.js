// 모닥불 캠핑장 — 3D 온라인 캠핑장
import * as THREE from 'three';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/jsm/postprocessing/OutputPass.js';

// =====================================================================
// 기본 도구
// =====================================================================
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const store = {
  get(k, d) { try { const v = localStorage.getItem('camp.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('camp.' + k, JSON.stringify(v)); } catch (e) {} }
};
let toastTimer;
function toast(msg, ms = 2400) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const isTouch = matchMedia('(pointer:coarse)').matches;

// =====================================================================
// 맵 배치 (단위: m, 모닥불이 0,0)
// =====================================================================
const FIRE = { x: 0, z: 0 };
const GRILL = { x: 6.5, z: -4.8 };
const DOG = { x: 2.6, z: 3.6 };
const CAMPER = { x: -9.5, z: 4.5, ry: 1.1 };
const LAKE = { x: 22, z: 10, rx: 8.5, rz: 6.2 };
const DOCK = { x0: 12.6, x1: 18.2, z: 9, w: 1.6 };
const FISH_SPOT = { x: 17.6, z: 9 };
const HILL = { x: -19, z: 17, h: 2.6, r: 8 };
const BENCH = { x: -19, z: 17, ry: Math.PI * 0.75 };
const TENT_AREA = { x: -16, z: -7 };
const BATH = { x: 23, z: -17, rx: 4.6, rz: 3.5 };
const BATH_HUT = { x: 18.4, z: -21.2 };
const SHELF = { x: 19.6, z: -18.6 };
const XMAS = { x: -24, z: -22 };
const TENTS = [
  { x: -18, z: -8, c: 0xd9783a }, { x: -13.5, z: -11, c: 0x4f8f86 }, { x: -20.5, z: -3, c: 0xd6a640 }
].map(t => { const ry = Math.atan2(FIRE.x - t.x, FIRE.z - t.z); return { ...t, ry, door: { x: t.x + Math.sin(ry) * 2.3, z: t.z + Math.cos(ry) * 2.3 } }; });
const PATHS = [
  [[0, 0], [-7, -3], [-12, -5.5], [-15.5, -6.5]],
  [[0, 0], [6, 4], [10, 7.5], [12.8, 9]],
  [[0, 0], [-6, 7], [-12, 12], [-18, 16.5]],
  [[0, 0], [1, -8], [3, -15], [0, -22], [1, -32]],
  [[0, 0], [4, -2.5], [6.5, -4.5], [12, -9.5], [17.5, -14.5], [19.2, -15.5]],
  [[1.5, -12], [-6, -15.5], [-13, -19], [-19, -21]]
];
const BOUND = 44;

function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}
function distToPaths(x, z) {
  let d = 1e9;
  for (const P of PATHS) for (let i = 0; i < P.length - 1; i++) d = Math.min(d, distToSeg(x, z, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1]));
  return d;
}
const lakeE = (x, z) => ((x - LAKE.x) / LAKE.rx) ** 2 + ((z - LAKE.z) / LAKE.rz) ** 2;
const bathE = (x, z) => ((x - BATH.x) / BATH.rx) ** 2 + ((z - BATH.z) / BATH.rz) ** 2;
const inBath = (x, z) => bathE(x, z) < 0.92;
const onDock = (x, z) => x >= DOCK.x0 - 0.3 && x <= DOCK.x1 + 0.2 && Math.abs(z - DOCK.z) <= DOCK.w / 2 + 0.05;

function groundH(x, z) {
  let h = 0;
  const dh = Math.hypot(x - HILL.x, z - HILL.z);
  h += HILL.h * Math.exp(-(dh * dh) / (2 * (HILL.r / 2.3) ** 2));
  const dc = Math.hypot(x, z);
  const flat = clamp((dc - 7) / 10, 0, 1) * clamp((Math.hypot(x - XMAS.x, z - XMAS.z) - 9) / 6, 0, 1) * clamp((Math.sqrt(bathE(x, z)) - 1.4) / 0.8, 0, 1);
  h += (0.35 * Math.sin(x * 0.13 + 1.3) * Math.cos(z * 0.11) + 0.2 * Math.sin(x * 0.31 + z * 0.23)) * flat;
  const e = lakeE(x, z);
  if (e < 1.35) h = lerp(h, -1.3, clamp((1.35 - e) / 0.6, 0, 1));
  const b = bathE(x, z);
  if (b < 1) h = lerp(h, -0.75, clamp((1 - b) / 0.25, 0, 1));
  if (dc > 40) h += (dc - 40) * 0.25;
  return h;
}
const WATER_Y = -0.2, BATH_Y = 0.02;
const walkH = (x, z) => onDock(x, z) ? 0.32 : inBath(x, z) ? -0.5 : Math.max(groundH(x, z), WATER_Y);

// =====================================================================
// 렌더러 · 장면 · 카메라 · 빛 번짐
// =====================================================================
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
let hiQuality = store.get('hi', !isTouch);
let bloomOn = store.get('bloom', true);
function pixelRatio() { return Math.min(window.devicePixelRatio || 1, hiQuality ? 2 : (isTouch ? 1 : 1.25)); }
renderer.setPixelRatio(pixelRatio());
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
const scene = new THREE.Scene();
const FOG_COLOR = new THREE.Color(0x0e1426);
scene.fog = new THREE.FogExp2(FOG_COLOR.getHex(), 0.016);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.45, 0.86);
composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(pixelRatio()); renderer.setSize(w, h, false);
  composer.setPixelRatio(pixelRatio()); composer.setSize(w, h);
  bloom.resolution.set(w / 2, h / 2);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// 하늘
function makeSkyTexture(top, mid, horizon) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(0.38, mid); gr.addColorStop(0.5, horizon); gr.addColorStop(0.56, '#0a0e18'); gr.addColorStop(1, '#05070c');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const SKY = { clear: makeSkyTexture('#02040b', '#0b1328', '#1d2846'), cloudy: makeSkyTexture('#0a0c12', '#161a24', '#22262f') };
scene.background = SKY.clear;

// 빛
const hemi = new THREE.HemisphereLight(0x6a7fc0, 0x1a140f, 1.35); scene.add(hemi);
const moonLight = new THREE.DirectionalLight(0xa9b8ff, 0.8); moonLight.position.set(-40, 60, -30); scene.add(moonLight);
const fireLight = new THREE.PointLight(0xff8a3d, 40, 0, 1.55); fireLight.position.set(0, 1.4, 0); scene.add(fireLight);
const warmLight = new THREE.PointLight(0xffb070, 6, 16, 1.8); warmLight.position.set(CAMPER.x + 1.5, 2.2, CAMPER.z + 1); scene.add(warmLight);
const flashLight = new THREE.PointLight(0xffffff, 0, 0, 1.2); flashLight.position.set(0, 20, 0); scene.add(flashLight);
const sideLight = new THREE.PointLight(0xffc68a, 5, 14, 1.8); scene.add(sideLight);   // 노천탕·트리 쪽 번갈아

function softTexture(size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const SOFT = softTexture();

// 별 + 은하수
const starGeo = new THREE.BufferGeometry();
{
  const r = mulberry32(11), pos = [], col = [];
  const R = 190;
  const push = (th, ph, b, warm) => { pos.push(R * Math.sin(ph) * Math.cos(th), R * Math.cos(ph) + 8, R * Math.sin(ph) * Math.sin(th)); col.push(b, b * (warm ? 0.86 : 0.95), b * (warm ? 0.72 : 1)); };
  for (let i = 0; i < 1800; i++) push(r() * Math.PI * 2, Math.acos(r() * 0.93 + 0.07), 0.45 + r() * 0.55, r() < 0.15);
  // 은하수: 하늘을 가로지르는 띠에 별을 촘촘히
  const tilt = 0.9;
  for (let i = 0; i < 2600; i++) {
    const a = r() * Math.PI * 2, off = (r() + r() + r() - 1.5) * 0.16;
    let x = Math.cos(a), y = off, z = Math.sin(a);
    const yy = y * Math.cos(tilt) - z * Math.sin(tilt), zz = y * Math.sin(tilt) + z * Math.cos(tilt);
    if (yy < 0.05) continue;
    const ph = Math.acos(clamp(yy, -1, 1)), th = Math.atan2(zz, x);
    push(th, ph, 0.18 + r() * 0.35, r() < 0.3);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  starGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
}
const starMat = new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false });
const stars = new THREE.Points(starGeo, starMat); scene.add(stars);
const moonTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 20, 64, 64, 64); gr.addColorStop(0, 'rgba(240,232,205,.35)'); gr.addColorStop(1, 'rgba(240,232,205,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#f1e8cf'; g.beginPath(); g.arc(64, 64, 22, 0, 7); g.fill();
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(75, 58, 20, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const moonMat = new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false });
const moon = new THREE.Sprite(moonMat); moon.scale.set(30, 30, 1); moon.position.set(-90, 80, -110); scene.add(moon);

// 먼 산 실루엣
{
  const r = mulberry32(77), mt = new THREE.MeshBasicMaterial({ color: 0x0f1628, fog: false }), mt2 = new THREE.MeshBasicMaterial({ color: 0x0b1120, fog: false });
  for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2 + r() * 0.2 + ring * 0.12, R = ring ? 150 : 125, h = (ring ? 26 : 18) + r() * 22, w = 30 + r() * 30;
    const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 5, 1), ring ? mt : mt2);
    m.position.set(Math.cos(a) * R, h / 2 - 4, Math.sin(a) * R); m.rotation.y = r() * 3; scene.add(m);
  }
}

// =====================================================================
// 텍스처 (체크무늬 돗자리, 줄무늬 어닝, 온천 간판)
// =====================================================================
function checkTex(c1, c2, n = 8) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = c2; g.fillRect(0, 0, 128, 128); g.fillStyle = c1; g.globalAlpha = 0.55;
  const s = 128 / n; for (let i = 0; i < n; i++) { g.fillRect(i * s, 0, s / 2, 128); g.fillRect(0, i * s, 128, s / 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function stripeTex(c1, c2) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 8; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect(i * 16, 0, 16, 8); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function signTex(text, bg, fg) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 128); g.fillStyle = fg; g.font = 'bold 72px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// =====================================================================
// 땅
// =====================================================================
const C = hex => new THREE.Color(hex);
let groundMesh;
{
  const SIZE = 130, SEG = 140;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, cols = [];
  const grassA = C(0x2a3d2a), grassB = C(0x34472c), dirt = C(0x5e4a36), plaza = C(0x4f3e2e), sand = C(0x6b5c45), deep = C(0x15202a), hillC = C(0x31482d), snowC = C(0xe6edf5), stone = C(0x5d5a58);
  const r = mulberry32(5), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, groundH(x, z));
    tmp.copy(grassA).lerp(grassB, r());
    const dh = Math.hypot(x - HILL.x, z - HILL.z); if (dh < HILL.r) tmp.lerp(hillC, (1 - dh / HILL.r) * 0.7);
    const dp = distToPaths(x, z); if (dp < 1.4) tmp.lerp(dirt, clamp((1.4 - dp) / 0.7, 0, 1) * 0.85);
    const dc = Math.hypot(x, z); if (dc < 8.5) tmp.lerp(plaza, clamp((8.5 - dc) / 2.5, 0, 1) * 0.92);
    const e = lakeE(x, z); if (e < 1.7) tmp.lerp(sand, clamp((1.7 - e) / 0.4, 0, 1)); if (e < 1.1) tmp.lerp(deep, clamp((1.1 - e) / 0.3, 0, 1));
    const b = bathE(x, z); if (b < 2.2) tmp.lerp(stone, clamp((2.2 - b) / 0.8, 0, 1) * 0.7);
    const dx = Math.hypot(x - XMAS.x, z - XMAS.z); if (dx < 12) tmp.lerp(snowC, clamp((12 - dx) / 3, 0, 1) * (0.85 + r() * 0.15));
    cols.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  groundMesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(groundMesh);
}
// 호수
const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshLambertMaterial({ color: 0x1b3550, emissive: 0x08121e, transparent: true, opacity: 0.9 }));
lake.rotation.x = -Math.PI / 2; lake.scale.set(LAKE.rx * 1.08, LAKE.rz * 1.08, 1); lake.position.set(LAKE.x, WATER_Y, LAKE.z); scene.add(lake);
const moonGlint = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: 0xbfd0ff, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
moonGlint.scale.set(3, 1.2, 1); moonGlint.position.set(LAKE.x - 2, WATER_Y + 0.05, LAKE.z - 1); scene.add(moonGlint);

// =====================================================================
// 소품
// =====================================================================
const mat = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const glow = (c) => new THREE.MeshBasicMaterial({ color: c });
const blockers = [];   // {x,z,r}
const seats = [];      // {x,z,ry,y,kind}
const noTree = [];     // {x,z,r}

// 나무 (인스턴스)
{
  const r = mulberry32(42), spots = [];
  noTree.push({ x: 0, z: 0, r: 11 }, { x: HILL.x, z: HILL.z, r: 5 }, { x: TENT_AREA.x, z: TENT_AREA.z, r: 8 }, { x: GRILL.x, z: GRILL.z, r: 4 }, { x: CAMPER.x, z: CAMPER.z, r: 5 },
    { x: BATH.x, z: BATH.z, r: 8 }, { x: BATH_HUT.x, z: BATH_HUT.z, r: 4 }, { x: XMAS.x, z: XMAS.z, r: 11 });
  const ok = (x, z) => {
    const d = Math.hypot(x, z); if (d < 9 || d > 64) return false;
    if (distToPaths(x, z) < 2.4) return false;
    if (lakeE(x, z) < 1.9) return false;
    for (const n of noTree) if (Math.hypot(x - n.x, z - n.z) < n.r) return false;
    for (const s of spots) if (Math.hypot(s.x - x, s.z - z) < 1.9) return false;
    return true;
  };
  for (let i = 0; i < 7000 && spots.length < 560; i++) {
    const a = r() * Math.PI * 2, d = 8 + Math.sqrt(r()) * 56, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const forestPath = z < -12 && Math.abs(x) < 14;
    const p = d > 33 ? 0.95 : forestPath ? 0.75 : 0.3;
    if (r() < p && ok(x, z)) spots.push({ x, z, s: 0.85 + r() * 0.8, round: r() < 0.18, c: r() });
  }
  const n = spots.length;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, 1, 6), mat(0x2e2219), n);
  const layers = [0, 1, 2, 3].map(k => new THREE.InstancedMesh(new THREE.ConeGeometry(1.35 - k * 0.27, 1.45, 8), mat(0xffffff, { flatShading: true }), n));
  const round = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.1, 0), mat(0xffffff, { flatShading: true }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), col = new THREE.Color();
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  spots.forEach((s, i) => {
    const y = groundH(s.x, s.z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.c * 6);
    sc.set(s.s, s.s * 1.15, s.s); pos.set(s.x, y + 0.5 * s.s, s.z); m.compose(pos, q, sc); trunk.setMatrixAt(i, m);
    col.setHSL(0.36 + s.c * 0.1, 0.32, 0.13 + s.c * 0.07);
    if (s.round) {
      pos.set(s.x, y + 1.6 * s.s, s.z); m.compose(pos, q, new THREE.Vector3(s.s, s.s * 1.1, s.s)); round.setMatrixAt(i, m); round.setColorAt(i, col);
      layers.forEach(L => { L.setMatrixAt(i, hide); L.setColorAt(i, col); });
    } else {
      round.setMatrixAt(i, hide); round.setColorAt(i, col);
      layers.forEach((L, k) => { pos.set(s.x, y + (1.25 + k * 0.78) * s.s * 1.1, s.z); m.compose(pos, q, sc); L.setMatrixAt(i, m); L.setColorAt(i, col); });
    }
    if (Math.hypot(s.x, s.z) < 46) blockers.push({ x: s.x, z: s.z, r: 0.55 * s.s + 0.2 });
  });
  [trunk, round, ...layers].forEach(o => { o.instanceMatrix.needsUpdate = true; if (o.instanceColor) o.instanceColor.needsUpdate = true; scene.add(o); });
}

// 풀숲
{
  const r = mulberry32(9), N = 2200;
  const tuft = new THREE.InstancedMesh(new THREE.ConeGeometry(0.06, 0.45, 3), mat(0xffffff), N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color(); let k = 0;
  for (let i = 0; i < N * 4 && k < N; i++) {
    const a = r() * 6.28, d = 6 + r() * 36, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (distToPaths(x, z) < 1.3 || lakeE(x, z) < 1.4 || bathE(x, z) < 2 || Math.hypot(x - XMAS.x, z - XMAS.z) < 12 || Math.hypot(x, z) < 7.5) continue;
    for (let j = 0; j < 3 && k < N; j++) {
      e.set(rand(-0.35, 0.35), r() * 6, rand(-0.35, 0.35)); q.setFromEuler(e); const s = 0.6 + r() * 0.9;
      const px = x + rand(-0.25, 0.25), pz = z + rand(-0.25, 0.25);
      m.compose(new THREE.Vector3(px, groundH(px, pz) + 0.2 * s, pz), q, new THREE.Vector3(s, s, s)); tuft.setMatrixAt(k, m);
      col.setHSL(r() < 0.2 ? 0.08 : 0.3 + r() * 0.08, 0.45, 0.16 + r() * 0.12); tuft.setColorAt(k, col); k++;
    }
  }
  tuft.count = k; tuft.instanceMatrix.needsUpdate = true; tuft.instanceColor.needsUpdate = true; scene.add(tuft);
}

// 모닥불: 돌 + 티피 장작
const firePit = new THREE.Group(); scene.add(firePit);
{
  const rockG = new THREE.DodecahedronGeometry(0.3, 0);
  for (let i = 0; i < 13; i++) { const a = i / 13 * Math.PI * 2; const m = new THREE.Mesh(rockG, mat(0x4f4b48, { flatShading: true })); m.position.set(Math.cos(a) * 1.1, 0.12, Math.sin(a) * 1.1); m.scale.set(1, 0.65, 1); m.rotation.set(rand(0, 3), rand(0, 3), 0); firePit.add(m); }
  const logG = new THREE.CylinderGeometry(0.09, 0.12, 1.7, 7);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const g = new THREE.Group(); g.rotation.y = a; const m = new THREE.Mesh(logG, mat(i % 2 ? 0x4a2c1a : 0x3a2214)); m.position.set(0.45, 0.65, 0); m.rotation.z = 0.5; g.add(m); firePit.add(g); }
  const coal = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20), new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.6 }));
  coal.rotation.x = -Math.PI / 2; coal.position.y = 0.04; firePit.add(coal); firePit.userData.coal = coal;
  blockers.push({ x: 0, z: 0, r: 1.5 });
}

// 캠핑 의자 · 그루터기
const CHAIR_COLORS = [0xe0743c, 0xe6b34a, 0x34406e, 0xc0463a, 0x5a8a6a, 0x7a5aa0];
function makeChair(color) {
  const g = new THREE.Group(), fab = mat(color, { side: THREE.DoubleSide }), metal = mat(0x2a2a30);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.55), fab); seat.position.y = 0.42; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.6, 0.04), fab); back.position.set(0, 0.74, -0.3); back.rotation.x = -0.18; g.add(back);
  const leg = new THREE.CylinderGeometry(0.018, 0.018, 0.72, 5);
  for (const s of [-1, 1]) for (const r of [-1, 1]) { const l = new THREE.Mesh(leg, metal); l.position.set(0.29 * s, 0.22, 0); l.rotation.x = 0.62 * r; g.add(l); }
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.5), metal); arm.position.set(0.31 * s, 0.6, -0.02); g.add(arm); }
  return g;
}
function makeStump() { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.42, 10), mat(0x5a3a26)); m.position.y = 0.21; g.add(m); const top = new THREE.Mesh(new THREE.CircleGeometry(0.3, 10), mat(0xa47c55)); top.rotation.x = -Math.PI / 2; top.position.y = 0.425; g.add(top); return g; }
for (let i = 0; i < 10; i++) {
  const a = i / 10 * Math.PI * 2 + 0.2, R = i % 2 ? 3.5 : 3.8;
  const x = Math.cos(a) * R, z = Math.sin(a) * R, ry = Math.atan2(-x, -z);
  const obj = i % 2 ? makeStump() : makeChair(CHAIR_COLORS[(i / 2) % CHAIR_COLORS.length]);
  obj.position.set(x, 0, z); obj.rotation.y = ry; scene.add(obj);
  seats.push({ x, z, y: 0.45, ry, kind: i % 2 ? 'stump' : 'chair' });
}

// 전구 줄 (광장을 빙 둘러)
const bulbs = [];
{
  const N = 7, R = 8.2, poles = [];
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2 + 0.25; poles.push(new THREE.Vector3(Math.cos(a) * R, 2.9, Math.sin(a) * R)); }
  const poleG = new THREE.CylinderGeometry(0.05, 0.06, 3, 6), poleM = mat(0x3a2a1e);
  poles.forEach(p => { const m = new THREE.Mesh(poleG, poleM); m.position.set(p.x, 1.5, p.z); scene.add(m); blockers.push({ x: p.x, z: p.z, r: 0.2 }); });
  const wire = [];
  const bulbG = new THREE.SphereGeometry(0.055, 8, 6);
  const bulbInst = new THREE.InstancedMesh(bulbG, new THREE.MeshBasicMaterial({ color: 0xffffff }), 200); let k = 0;
  const m4 = new THREE.Matrix4(), col = new THREE.Color(0xffd08a);
  for (let i = 0; i < N; i++) {
    const a = poles[i], b = poles[(i + 1) % N];
    for (let t = 0; t <= 1.0001; t += 0.05) { const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * 0.6; wire.push(p); }
    for (let t = 0.07; t < 1; t += 0.12) { const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * 0.6 + 0.1; if (k < 200) { m4.makeTranslation(p.x, p.y, p.z); bulbInst.setMatrixAt(k, m4); bulbInst.setColorAt(k, col); bulbs.push(p); k++; } }
  }
  bulbInst.count = k; bulbInst.instanceColor.needsUpdate = true; scene.add(bulbInst);
  const lg = new THREE.BufferGeometry().setFromPoints(wire); scene.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x222222 })));
}

// 돗자리 + 방석
const blanketDefs = [
  { x: -5.5, z: 9.5, ry: 0.3, c1: '#c0392b', c2: '#f3e9e0' },
  { x: 6.5, z: 9.8, ry: -0.4, c1: '#2c3e7a', c2: '#ece8f4' },
  { x: 10.5, z: -0.5, ry: 1.3, c1: '#7a2c5e', c2: '#f4e8ef' }
];
blanketDefs.forEach(b => {
  const g = new THREE.Group(); g.position.set(b.x, groundH(b.x, b.z) + 0.02, b.z); g.rotation.y = b.ry; scene.add(g);
  const tex = checkTex(b.c1, b.c2); tex.repeat.set(2, 1.5);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4), new THREE.MeshLambertMaterial({ map: tex })); m.rotation.x = -Math.PI / 2; g.add(m);
  for (const [cx, cz] of [[-0.9, -0.5], [0.9, -0.5], [0, 0.6]]) {
    const cu = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 8), mat(0x33416e)); cu.scale.set(1, 0.32, 0.8); cu.position.set(cx, 0.08, cz); g.add(cu);
    const wx = b.x + Math.cos(b.ry) * cx + Math.sin(b.ry) * cz, wz = b.z - Math.sin(b.ry) * cx + Math.cos(b.ry) * cz;
    seats.push({ x: wx, z: wz, y: groundH(b.x, b.z) + 0.18, ry: Math.atan2(-wx, -wz), kind: 'cushion' });
  }
  noTree.push({ x: b.x, z: b.z, r: 2.5 });
});
// 랜턴
const lanterns = [];
function makeLantern(x, z) {
  const g = new THREE.Group(); g.position.set(x, groundH(x, z), z); scene.add(g);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.06, 10), mat(0x222226)); base.position.y = 0.03; g.add(base);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.24, 10), glow(0xfff1d0)); glass.position.y = 0.18; g.add(glass);
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.1, 10), mat(0x222226)); top.position.y = 0.35; g.add(top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 6, 12), mat(0x222226)); ring.position.y = 0.45; g.add(ring);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: 0xffd9a0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.set(1.4, 1.4, 1); halo.position.y = 0.2; g.add(halo);
  lanterns.push(halo); return g;
}
[[-3.2, 8], [8.6, 6.5], [-7.6, -2.6], [4.4, -7.6], [14.2, 9.7]].forEach(([x, z]) => makeLantern(x, z));

// 캠핑카 + 줄무늬 어닝
{
  const g = new THREE.Group(); g.position.set(CAMPER.x, groundH(CAMPER.x, CAMPER.z), CAMPER.z); g.rotation.y = CAMPER.ry; scene.add(g);
  const cream = mat(0xf1e4cc), orange = mat(0xe8774a), dark = mat(0x1e1e24);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.0, 2.0), orange); lower.position.y = 0.95; g.add(lower);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.0, 2.0), cream); upper.position.y = 1.95; g.add(upper);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 4.2, 16, 1, false, 0, Math.PI), cream); roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2; roof.scale.set(1, 1, 0.35); roof.position.y = 2.45; g.add(roof);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.22, 0.12, 2.02), cream); stripe.position.y = 1.3; g.add(stripe);
  for (const x of [-1.2, 0.2]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), glow(0xffcf7a)); w.position.set(x, 2.0, 1.01); g.add(w); }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.5), mat(0xd9c9a8)); door.position.set(1.3, 1.25, 1.01); g.add(door);
  const dw = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), glow(0xffcf7a)); dw.position.set(1.3, 1.65, 1.02); g.add(dw);
  for (const x of [-1.3, 1.3]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 14), dark); wh.rotation.x = Math.PI / 2; wh.position.set(x, 0.38, 1.0); g.add(wh); const hub = new THREE.Mesh(new THREE.CircleGeometry(0.14, 10), mat(0xc77a3a)); hub.position.set(x, 0.38, 1.13); g.add(hub); }
  const head = new THREE.Mesh(new THREE.CircleGeometry(0.14, 10), glow(0xffffff)); head.position.set(2.11, 1.0, 0.6); head.rotation.y = Math.PI / 2; g.add(head);
  // 어닝
  const aw = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.2), new THREE.MeshLambertMaterial({ map: stripeTex('#c0453a', '#efe4d6'), side: THREE.DoubleSide }));
  aw.position.set(-0.3, 2.45, 2.0); aw.rotation.x = -Math.PI / 2 + 0.28; g.add(aw);
  for (const x of [-2.0, 1.4]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5), mat(0x777777)); pole.position.set(x, 1.1, 3.0); g.add(pole); }
  // 테이블
  const tb = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.6), mat(0x6b4a2e)); tb.position.set(-0.4, 0.7, 2.4); g.add(tb);
  for (const sx of [-0.45, 0.45]) for (const sz of [-0.22, 0.22]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.04), mat(0x3d2a1b)); l.position.set(-0.4 + sx, 0.35, 2.4 + sz); g.add(l); }
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), mat(0xffffff)); mug.position.set(-0.2, 0.78, 2.4); g.add(mug);
  const cos = Math.cos(CAMPER.ry), sin = Math.sin(CAMPER.ry);
  for (let k = -1.6; k <= 1.6; k += 0.8) blockers.push({ x: CAMPER.x + cos * k, z: CAMPER.z - sin * k, r: 1.15 });
  blockers.push({ x: CAMPER.x + sin * 2.4 + cos * -0.4, z: CAMPER.z + cos * 2.4 - sin * -0.4, r: 0.55 });
}

// 텐트
const tentDoors = [];
TENTS.forEach((t) => {
  const g = new THREE.Group(); g.position.set(t.x, groundH(t.x, t.z), t.z); g.rotation.y = t.ry; scene.add(g);
  const body = new THREE.Mesh(new THREE.ConeGeometry(2, 2.4, 4, 1), mat(t.c, { flatShading: true })); body.rotation.y = Math.PI / 4; body.position.y = 1.2; g.add(body);
  const doorMat = new THREE.MeshBasicMaterial({ color: 0x120c08 });
  const door = new THREE.Mesh(new THREE.CircleGeometry(0.62, 3), doorMat); door.position.set(0, 0.62, 1.03); door.rotation.set(-0.36, 0, Math.PI / 2 * 3); door.scale.set(1, 1.35, 1); g.add(door);
  tentDoors.push(doorMat); blockers.push({ x: t.x, z: t.z, r: 1.8 });
});

// 호수 선착장
{
  const len = DOCK.x1 - DOCK.x0;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, DOCK.w), mat(0x6a4a30)); deck.position.set((DOCK.x0 + DOCK.x1) / 2, 0.26, DOCK.z); scene.add(deck);
  for (let x = DOCK.x0 + 0.3; x < DOCK.x1; x += 1.4) for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 6), mat(0x3d2a1b)); p.position.set(x, -0.35, DOCK.z + s * (DOCK.w / 2 - 0.08)); scene.add(p); }
  const ch = makeChair(0xe0743c); ch.position.set(DOCK.x1 - 0.35, 0.32, DOCK.z + 0.35); ch.rotation.y = Math.PI / 2; scene.add(ch);
  seats.push({ x: DOCK.x1 - 0.35, z: DOCK.z + 0.35, y: 0.77, ry: Math.PI / 2, kind: 'dock' });
}

// 별 언덕 벤치
{
  const y = groundH(BENCH.x, BENCH.z);
  const g = new THREE.Group(); g.position.set(BENCH.x, y, BENCH.z); g.rotation.y = BENCH.ry; scene.add(g);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.5), mat(0x6b4a2e)); seat.position.y = 0.45; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.08), mat(0x6b4a2e)); back.position.set(0, 0.75, -0.24); g.add(back);
  for (const sx of [-0.8, 0.8]) for (const sz of [-0.2, 0.2]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), mat(0x3d2a1b)); l.position.set(sx, 0.22, sz); g.add(l); }
  for (const off of [-0.45, 0.45]) { const x = BENCH.x + Math.cos(BENCH.ry) * off, z = BENCH.z - Math.sin(BENCH.ry) * off; seats.push({ x, z, y: y + 0.5, ry: BENCH.ry, kind: 'bench' }); }
  blockers.push({ x: BENCH.x - Math.sin(BENCH.ry) * 0.3, z: BENCH.z - Math.cos(BENCH.ry) * 0.3, r: 0.5 });
  makeLantern(BENCH.x + 1.4, BENCH.z + 0.4);
}

// 바비큐 그릴 (빨간 케틀 그릴)
const grillParts = {};
{
  const g = new THREE.Group(); g.position.set(GRILL.x, 0, GRILL.z); scene.add(g);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0xc0392b, { side: THREE.DoubleSide })); bowl.position.y = 0.95; g.add(bowl);
  const coals = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: 0xff4a12 })); coals.rotation.x = -Math.PI / 2; coals.position.y = 0.9; g.add(coals);
  const grate = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.55, 16, 1), mat(0x888888, { side: THREE.DoubleSide, wireframe: true })); grate.rotation.x = -Math.PI / 2; grate.position.y = 0.96; g.add(grate);
  for (let i = 0; i < 4; i++) { const sk = new THREE.Group(); for (let k = 0; k < 4; k++) { const piece = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.08), mat(k % 2 ? 0x8a3a24 : 0xb05030)); piece.position.x = -0.18 + k * 0.12; sk.add(piece); } sk.position.set(0, 0.99, -0.27 + i * 0.18); g.add(sk); }
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 5), mat(0x1a1a1a)); l.position.set(Math.cos(a) * 0.32, 0.45, Math.sin(a) * 0.32); l.rotation.z = Math.cos(a) * 0.25; l.rotation.x = -Math.sin(a) * 0.25; g.add(l); }
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.7), mat(0x3a2a24)); table.position.set(1.3, 0.72, 0.3); g.add(table);
  for (const sx of [-0.52, 0.52]) for (const sz of [-0.28, 0.28]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, 0.04), mat(0x222222)); l.position.set(1.3 + sx, 0.36, 0.3 + sz); g.add(l); }
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 14), mat(0xf4f0e8)); plate.position.set(1.2, 0.76, 0.35); g.add(plate);
  const cooler = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.4), mat(0x3a7bb8)); cooler.position.set(1.2, 0.22, -0.8); g.add(cooler);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.42), mat(0xeeeeee)); lid.position.set(1.2, 0.48, -0.8); g.add(lid);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 8), mat(i === 1 ? 0x2f7a3a : 0xb8862e)); b.position.set(1.5 + i * 0.13, 0.86, 0.15); g.add(b); }
  blockers.push({ x: GRILL.x, z: GRILL.z, r: 0.75 }, { x: GRILL.x + 1.3, z: GRILL.z + 0.3, r: 0.75 }, { x: GRILL.x + 1.2, z: GRILL.z - 0.8, r: 0.45 });
  grillParts.coals = coals;
}

// 잠자는 강아지
const dog = new THREE.Group();
{
  const fur = mat(0xf0e8de), dark = mat(0x3a302a);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), fur); body.scale.set(1.3, 0.6, 0.85); body.position.y = 0.25; dog.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), fur); head.position.set(-0.55, 0.24, 0.05); dog.add(head);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), dark); ear.scale.set(0.6, 1.3, 0.5); ear.position.set(-0.55, 0.3, 0.05 + s * 0.22); dog.add(ear); }
  const patch = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), dark); patch.scale.set(1, 0.4, 1); patch.position.set(0.15, 0.45, 0.1); dog.add(patch);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), dark); nose.position.set(-0.8, 0.2, 0.05); dog.add(nose);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.35, 6), fur); tail.position.set(0.58, 0.32, 0); tail.rotation.z = -1; dog.add(tail); dog.userData.tail = tail; dog.userData.body = body;
  dog.position.set(DOG.x, 0, DOG.z); dog.rotation.y = 2.2; scene.add(dog);
  blockers.push({ x: DOG.x, z: DOG.z, r: 0.6 });
}
let dogPet = -99;

// ---------------- 노천탕 ----------------
const steam = [];
{
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshLambertMaterial({ color: 0x3a8a94, emissive: 0x0a2a30, transparent: true, opacity: 0.82 }));
  water.rotation.x = -Math.PI / 2; water.scale.set(BATH.rx * 1.02, BATH.rz * 1.02, 1); water.position.set(BATH.x, BATH_Y, BATH.z); scene.add(water);
  // 바위 테두리 (길 쪽은 계단처럼 비워둬요)
  const gapA = Math.atan2(-15.5 - BATH.z, 19.2 - BATH.x);
  const rockG = new THREE.DodecahedronGeometry(0.55, 0);
  for (let i = 0; i < 30; i++) {
    const a = i / 30 * Math.PI * 2; let da = Math.atan2(Math.sin(a - gapA), Math.cos(a - gapA)); if (Math.abs(da) < 0.32) continue;
    const x = BATH.x + Math.cos(a) * BATH.rx * 1.08, z = BATH.z + Math.sin(a) * BATH.rz * 1.08;
    const m = new THREE.Mesh(rockG, mat(0x5a5652, { flatShading: true })); const s = 0.7 + Math.random() * 0.6;
    m.position.set(x, groundH(x, z) + 0.15, z); m.scale.set(s, s * 0.7, s); m.rotation.set(rand(0, 3), rand(0, 3), 0); scene.add(m);
    blockers.push({ x, z, r: 0.45 * s });
  }
  // 오두막
  const hut = new THREE.Group(); hut.position.set(BATH_HUT.x, groundH(BATH_HUT.x, BATH_HUT.z), BATH_HUT.z); hut.rotation.y = 0.75; scene.add(hut);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.0, 2.0), mat(0x7a5638)); wall.position.y = 1.0; hut.add(wall);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.0, 4), mat(0x3a2a22, { flatShading: true })); roof.rotation.y = Math.PI / 4; roof.position.y = 2.5; roof.scale.set(1.15, 1, 0.95); hut.add(roof);
  const noren = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshLambertMaterial({ map: signTex('♨', '#2b3f7a', '#ffffff'), side: THREE.DoubleSide })); noren.position.set(0, 1.4, 1.01); hut.add(noren);
  const lampHut = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), glow(0xffd28a)); lampHut.position.set(0.95, 1.9, 1.1); hut.add(lampHut);
  blockers.push({ x: BATH_HUT.x, z: BATH_HUT.z, r: 1.6 });
  // 바나나우유 · 계란 선반
  const sh = new THREE.Group(); sh.position.set(SHELF.x, groundH(SHELF.x, SHELF.z), SHELF.z); sh.rotation.y = 0.75; scene.add(sh);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.45), mat(0x8a6a48)); board.position.y = 0.8; sh.add(board);
  for (const sx of [-0.55, 0.55]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.4), mat(0x5a4030)); l.position.set(sx, 0.4, 0); sh.add(l); }
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.18, 10), mat(0xf6d64a)); b.position.set(-0.4 + i * 0.12, 0.92, 0.05); sh.add(b); }
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.12, 12), mat(0x9a7a50)); basket.position.set(0.3, 0.89, 0); sh.add(basket);
  for (let i = 0; i < 4; i++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(0x8a6a50)); e.scale.y = 1.25; e.position.set(0.25 + (i % 2) * 0.1, 0.97, -0.04 + (i >> 1) * 0.08); sh.add(e); }
  blockers.push({ x: SHELF.x, z: SHELF.z, r: 0.6 });
  makeLantern(BATH.x - 2.8, BATH.z + 3.8); makeLantern(BATH.x + 3.6, BATH.z - 3.4);
  // 김
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: 0xdfe8ef, transparent: true, opacity: 0, depthWrite: false }));
    scene.add(s); steam.push({ s, t: Math.random() * 4, x: 0, z: 0 });
  }
}

// ---------------- 크리스마스 광장 ----------------
const treeTiers = [];          // 장식을 달 수 있는 트리 표면
const treeLights = { mesh: null, n: 0 };
let treeStar;
const TREE_TOP = 9.2;
{
  const g = new THREE.Group(); g.position.set(XMAS.x, groundH(XMAS.x, XMAS.z), XMAS.z); scene.add(g);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.4, 8), mat(0x4a3222)); trunk.position.y = 0.7; g.add(trunk);
  const tiers = [[3.6, 2.6, 1.9], [3.0, 2.4, 3.4], [2.4, 2.2, 4.9], [1.8, 2.0, 6.3], [1.1, 1.8, 7.6]];
  tiers.forEach(([r, h, y]) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 14), mat(0x1f5a38, { flatShading: true })); m.position.y = y; g.add(m); treeTiers.push(m); });
  // 전구 (나선형)
  const N = 150, bulbG = new THREE.SphereGeometry(0.07, 6, 5);
  const inst = new THREE.InstancedMesh(bulbG, new THREE.MeshBasicMaterial({ color: 0xffffff }), N); const m4 = new THREE.Matrix4(); const col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const t = i / N, y = 1.2 + t * 7.4, a = t * Math.PI * 2 * 7.5;
    const r = treeRadiusAt(y) + 0.05;
    m4.makeTranslation(Math.cos(a) * r, y, Math.sin(a) * r); inst.setMatrixAt(i, m4); inst.setColorAt(i, col.setHex(0xffffff));
  }
  g.add(inst); treeLights.mesh = inst; treeLights.n = N;
  // 별
  const starShape = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.22 : 0.52; i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  treeStar = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape, { depth: 0.12, bevelEnabled: false }), glow(0xffe27a)); treeStar.position.set(0, TREE_TOP + 0.2, 0); g.add(treeStar);
  // 선물 상자
  [[1.6, 0.9, 0xc0392b], [-1.4, 1.3, 0x2e7d4f], [0.4, -1.8, 0x3a5aa8], [-1.9, -0.6, 0xe6b34a], [2.1, -1.0, 0x8a4aa0]].forEach(([x, z, c], i) => {
    const s = 0.4 + (i % 3) * 0.12; const box = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat(c)); box.position.set(x * 1.4, s / 2, z * 1.4); box.rotation.y = i; g.add(box);
    const rib = new THREE.Mesh(new THREE.BoxGeometry(s * 1.02, s * 1.02, s * 0.18), mat(0xf4e7c8)); rib.position.copy(box.position); rib.rotation.y = i; g.add(rib);
  });
  blockers.push({ x: XMAS.x, z: XMAS.z, r: 2.4 });
  // 눈사람
  const sm = new THREE.Group(); sm.position.set(XMAS.x + 5, groundH(XMAS.x + 5, XMAS.z - 3), XMAS.z - 3); sm.rotation.y = -2.2; scene.add(sm);
  const snowM = mat(0xf4f7fb);
  [[0.55, 0.5], [0.4, 1.25], [0.3, 1.85]].forEach(([r, y]) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), snowM); b.position.y = y; sm.add(b); });
  const carrot = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25, 8), mat(0xf07a2a)); carrot.rotation.x = Math.PI / 2; carrot.position.set(0, 1.85, 0.36); sm.add(carrot);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), mat(0x1a1a1a)); e.position.set(0.1 * s, 1.95, 0.26); sm.add(e); }
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.07, 6, 16), mat(0xc0392b)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.55; sm.add(scarf);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 12), mat(0x1a1a1a)); hat.position.y = 2.25; sm.add(hat);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 14), mat(0x1a1a1a)); brim.position.y = 2.1; sm.add(brim);
  blockers.push({ x: XMAS.x + 5, z: XMAS.z - 3, r: 0.6 });
  // 가로등
  for (const [dx, dz] of [[-5, 4], [6, 4]]) {
    const x = XMAS.x + dx, z = XMAS.z + dz, y = groundH(x, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3, 8), mat(0x22252c)); pole.position.set(x, y + 1.5, z); scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), glow(0xffe0a8)); lamp.position.set(x, y + 3.05, z); scene.add(lamp);
    blockers.push({ x, z, r: 0.2 });
  }
}
function treeRadiusAt(y) {
  // 층마다 원뿔 반지름 (가장 바깥 층 기준)
  const tiers = [[3.6, 2.6, 1.9], [3.0, 2.4, 3.4], [2.4, 2.2, 4.9], [1.8, 2.0, 6.3], [1.1, 1.8, 7.6]];
  let r = 0; for (const [R, h, cy] of tiers) { const lo = cy - h / 2, hi = cy + h / 2; if (y >= lo && y <= hi) r = Math.max(r, R * (hi - y) / h); }
  return r;
}

// 트리 장식 (인스턴스로 많이)
const ORN_KINDS = { ball: { label: '공', icon: '🔴' }, star: { label: '별', icon: '⭐' }, bell: { label: '종', icon: '🔔' }, cane: { label: '지팡이', icon: '🍭' }, heart: { label: '하트', icon: '💗' }, gift: { label: '선물', icon: '🎁' } };
const ORN_COLORS = [0xd94040, 0xf2c14e, 0x4a7fd9, 0xffffff, 0xe96bb0, 0x55c27a, 0xb47ae8, 0xff8a3d];
const ornGeo = {
  ball: new THREE.SphereGeometry(0.17, 12, 10), star: new THREE.OctahedronGeometry(0.2, 0), bell: new THREE.ConeGeometry(0.15, 0.26, 10),
  cane: new THREE.TorusGeometry(0.1, 0.035, 6, 10, Math.PI * 1.3), heart: new THREE.SphereGeometry(0.16, 10, 8), gift: new THREE.BoxGeometry(0.24, 0.24, 0.24)
};
const ornMeshes = {}, ornByKind = {};
const MAX_ORN = 3000;
for (const k in ornGeo) {
  const m = new THREE.InstancedMesh(ornGeo[k], new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x222222 }), MAX_ORN);
  m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); ornMeshes[k] = m; ornByKind[k] = [];
}
const ornIds = new Set();
function addOrnament(o) {
  if (!o || !ornMeshes[o.kind] || ornIds.has(o.id)) return;
  const m = ornMeshes[o.kind], list = ornByKind[o.kind]; if (m.count >= MAX_ORN) return;
  ornIds.add(o.id);
  const i = m.count++; list[i] = o;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(o.kind === 'heart' ? 0 : Math.random() * 0.4, Math.atan2(o.x - XMAS.x, o.z - XMAS.z), o.kind === 'heart' ? Math.PI / 4 : 0));
  const s = o.kind === 'heart' ? new THREE.Vector3(1, 1, 0.6) : new THREE.Vector3(1, 1, 1);
  m.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(o.x, o.y, o.z), q, s));
  m.setColorAt(i, new THREE.Color(o.color)); m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
}
function ornCount() { let n = 0; for (const k in ornMeshes) n += ornMeshes[k].count; return n; }

// 반딧불이
const FLY_N = 70;
const flyGeo = new THREE.BufferGeometry();
const flyData = [];
{
  const p = new Float32Array(FLY_N * 3), c = new Float32Array(FLY_N * 3);
  for (let i = 0; i < FLY_N; i++) {
    const inForest = i < 50, cx = inForest ? rand(-6, 6) : HILL.x + rand(-6, 6), cz = inForest ? rand(-34, -14) : HILL.z + rand(-6, 6);
    flyData.push({ cx, cz, ph: rand(0, 6.28), sp: rand(0.3, 0.8), h: rand(0.6, 2.2) });
  }
  flyGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); flyGeo.setAttribute('color', new THREE.BufferAttribute(c, 3));
}
const flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ size: 0.28, map: SOFT, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
scene.add(flies);

// =====================================================================
// 모닥불 불꽃
// =====================================================================
let fireLevel = 0.85;
const flames = [];
const FLAME_N = 190;
for (let i = 0; i < FLAME_N; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: 0xffaa55, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  s.visible = false; scene.add(s); flames.push({ s, life: 1, max: 1, vy: 0, size: 1, seed: Math.random() * 10 });
}
const fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: 0xff7a2a, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
fireGlow.position.set(0, 1.5, 0); scene.add(fireGlow);
const tmpCol = new THREE.Color();
function flameColor(u, out) {
  if (u < 0.18) out.setRGB(1, lerp(0.85, 0.66, u / 0.18), lerp(0.45, 0.2, u / 0.18));
  else if (u < 0.55) { const k = (u - 0.18) / 0.37; out.setRGB(1, lerp(0.66, 0.32, k), lerp(0.2, 0.04, k)); }
  else { const k = (u - 0.55) / 0.45; out.setRGB(lerp(1, 0.5, k), lerp(0.32, 0.1, k), 0.04); }
  return out;
}
let flameSpawnAcc = 0;
function updateFire(dt, t) {
  const fl = fireLevel;
  flameSpawnAcc += dt * (50 + fl * 120);
  for (const f of flames) {
    if (!f.s.visible && flameSpawnAcc >= 1) {
      flameSpawnAcc -= 1;
      const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * (0.45 + fl * 0.4);
      f.s.position.set(Math.cos(a) * r, 0.25 + Math.random() * 0.15, Math.sin(a) * r);
      f.vy = rand(1.8, 3.0) * (0.8 + fl * 0.7); f.life = 0; f.max = rand(0.6, 1.25) * (0.85 + fl * 0.35); f.size = rand(1.1, 2.0) * (0.8 + fl * 0.8);
      f.s.visible = true;
    }
    if (!f.s.visible) continue;
    f.life += dt; const u = f.life / f.max;
    if (u >= 1) { f.s.visible = false; continue; }
    const p = f.s.position;
    p.x += (Math.sin(t * 3.1 + f.seed) * 0.35 - p.x * 1.8) * dt; p.z += (Math.cos(t * 2.7 + f.seed) * 0.35 - p.z * 1.8) * dt; p.y += f.vy * dt;
    const sz = f.size * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) * 0.75);
    f.s.scale.set(sz * 0.7, sz * 1.6, 1);
    f.s.material.color.copy(flameColor(u, tmpCol));
    f.s.material.opacity = (1 - u) * (u < 0.1 ? 0.16 : 0.3) * (bloomOn ? 0.62 : 1);
  }
  if (flameSpawnAcc > 30) flameSpawnAcc = 30;
  if (Math.random() < dt * (3 + fl * 9)) sparkBurst(rand(-0.3, 0.3), 0.8, rand(-0.3, 0.3), 1, 0xffb060, 0.6, 2.4, 0.05);
  const flick = 0.85 + 0.1 * Math.sin(t * 11) + 0.06 * Math.sin(t * 23 + 1) + 0.04 * Math.sin(t * 37);
  fireLight.intensity = (20 + fl * 40) * flick * weatherFireLight;
  fireLight.position.y = 1.2 + fl * 0.4;
  const gs = (3.5 + fl * 4.5) * flick; fireGlow.scale.set(gs, gs * 1.1, 1); fireGlow.material.opacity = (0.16 + fl * 0.1) * (bloomOn ? 0.5 : 1);
  firePit.userData.coal.material.opacity = 0.35 + fl * 0.3 * flick;
}

// =====================================================================
// 작은 입자들
// =====================================================================
function makePool(n, size) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3).fill(9999), col = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: SOFT, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false; scene.add(pts);
  return { n, pts, pos, col, vel: new Float32Array(n * 3), life: new Float32Array(n).fill(1), max: new Float32Array(n).fill(1), base: new Float32Array(n * 3), drag: new Float32Array(n), grav: new Float32Array(n), next: 0 };
}
const small = makePool(1800, 0.11), big = makePool(2400, 0.42);
function emit(pool, x, y, z, vx, vy, vz, color, life, grav = 3, drag = 0.4) {
  const i = pool.next; pool.next = (pool.next + 1) % pool.n;
  pool.pos[i * 3] = x; pool.pos[i * 3 + 1] = y; pool.pos[i * 3 + 2] = z;
  pool.vel[i * 3] = vx; pool.vel[i * 3 + 1] = vy; pool.vel[i * 3 + 2] = vz;
  tmpCol.set(color); pool.base[i * 3] = tmpCol.r; pool.base[i * 3 + 1] = tmpCol.g; pool.base[i * 3 + 2] = tmpCol.b;
  pool.life[i] = 0; pool.max[i] = life; pool.grav[i] = grav; pool.drag[i] = drag;
}
function sparkBurst(x, y, z, n, color, life, speed, spread) {
  for (let k = 0; k < n; k++) emit(small, x, y, z, rand(-spread, spread) * 6, rand(speed * 0.5, speed), rand(-spread, spread) * 6, color, life * rand(0.6, 1.2), -0.6, 0.3);
}
function updatePool(pool, dt) {
  const { pos, vel, life, max, col, base, grav, drag } = pool;
  for (let i = 0; i < pool.n; i++) {
    if (life[i] >= max[i]) continue;
    life[i] += dt; const u = life[i] / max[i];
    if (u >= 1) { pos[i * 3 + 1] = 9999; continue; }
    const d = Math.max(0, 1 - drag[i] * dt);
    vel[i * 3] *= d; vel[i * 3 + 2] *= d; vel[i * 3 + 1] = vel[i * 3 + 1] * d - grav[i] * dt;
    pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
    const b = (1 - u) * (u > 0.7 ? (Math.random() < 0.5 ? 1 : 0.4) : 1);
    col[i * 3] = base[i * 3] * b; col[i * 3 + 1] = base[i * 3 + 1] * b; col[i * 3 + 2] = base[i * 3 + 2] * b;
  }
  pool.pts.geometry.attributes.position.needsUpdate = true; pool.pts.geometry.attributes.color.needsUpdate = true;
}

// 불꽃놀이
const FW_COLORS = [0xff5a5a, 0xffc83d, 0x6ad1ff, 0xb48cff, 0x7dff9a, 0xff8ad8, 0xffffff, 0xffa040];
const rockets = [];
function launchFirework(x, z, c, s) {
  const y0 = walkH(x, z) + 1.2;
  if (me.seated && Math.hypot(x - me.x, z - me.z) < 40) lookSky(x, 20, z, 5200);
  rockets.push({ x, y: y0, z, vy: rand(17, 21), t: 0, fuse: rand(1.0, 1.35), c: FW_COLORS[c % 8], s });
  playWhistle(x, z);
}
function burst(r) {
  const n = 150, col = r.c, col2 = FW_COLORS[(FW_COLORS.indexOf(col) + 3) % 8];
  for (let k = 0; k < n; k++) {
    let vx, vy, vz;
    if (r.s === 1) { const a = k / n * 6.28; vx = Math.cos(a) * 9; vy = rand(-0.5, 0.5); vz = Math.sin(a) * 9; }
    else if (r.s === 2) { const a = k / n * 6.28; const hx = 16 * Math.sin(a) ** 3, hy = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); vx = hx * 0.55; vy = hy * 0.55; vz = rand(-0.6, 0.6); }
    else { const u = rand(-1, 1), a = rand(0, 6.28), sp = r.s === 3 ? rand(4, 7) : rand(7, 10); vx = Math.sqrt(1 - u * u) * Math.cos(a) * sp; vy = u * sp; vz = Math.sqrt(1 - u * u) * Math.sin(a) * sp; }
    const willow = r.s === 3;
    emit(big, r.x, r.y, r.z, vx, vy, vz, willow ? 0xffcc66 : (k % 4 === 0 ? col2 : col), willow ? rand(2.4, 3.2) : rand(1.4, 2.0), willow ? 2.2 : 3.2, willow ? 0.9 : 0.75);
  }
  flashLight.position.set(r.x, r.y, r.z); flashLight.color.set(col); flashLight.intensity = 900;
  playBoom(r.x, r.z);
}
function updateRockets(dt) {
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i]; r.t += dt; r.vy -= 6 * dt; r.y += r.vy * dt;
    emit(small, r.x + rand(-0.05, 0.05), r.y, r.z + rand(-0.05, 0.05), rand(-0.3, 0.3), -1, rand(-0.3, 0.3), 0xffd9a0, 0.5, 1, 0.5);
    if (r.t >= r.fuse) { burst(r); rockets.splice(i, 1); }
  }
  flashLight.intensity *= Math.max(0, 1 - dt * 6);
}

// =====================================================================
// 날씨
// =====================================================================
const WEATHER_INFO = { clear: ['🌙', '맑은 밤'], cloudy: ['☁️', '구름 낀 밤'], rain: ['🌧️', '비가 와요'], snow: ['❄️', '눈이 와요'], fog: ['🌫️', '안개가 꼈어요'] };
const weather = { kind: 'clear', until: 0 };
const W = { rain: 0, snow: 0, fog: 0, cloud: 0 };
let weatherFireLight = 1;
const RAIN_N = 1500, SNOW_N = 1400;
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN_N * 6), 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x9fb4d8, transparent: true, opacity: 0 })); rain.frustumCulled = false; scene.add(rain);
const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SNOW_N * 3), 3));
const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ size: 0.16, map: SOFT, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); snow.frustumCulled = false; scene.add(snow);
const rainSeed = []; for (let i = 0; i < RAIN_N; i++) rainSeed.push([rand(-22, 22), rand(0, 18), rand(-22, 22)]);
const snowSeed = []; for (let i = 0; i < SNOW_N; i++) snowSeed.push([rand(-22, 22), rand(0, 16), rand(-22, 22), rand(0, 6.28)]);
function updateWeather(dt, t, cx, cz) {
  const nearXmas = Math.hypot(cx - XMAS.x, cz - XMAS.z) < 16;    // 크리스마스 광장엔 늘 눈이 살짝
  const tgt = { rain: weather.kind === 'rain' ? 1 : 0, snow: weather.kind === 'snow' ? 1 : (nearXmas ? 0.45 : 0), fog: weather.kind === 'fog' ? 1 : 0, cloud: weather.kind === 'clear' ? 0 : 1 };
  for (const k in W) W[k] = lerp(W[k], tgt[k], Math.min(1, dt * 0.35));
  scene.fog.density = 0.014 + W.fog * 0.05 + W.rain * 0.012 + W.snow * 0.006;
  starMat.opacity = clamp(1 - W.cloud * 0.85, 0, 1) * (0.9 + 0.1 * Math.sin(t * 0.7));
  moonMat.opacity = clamp(1 - W.cloud * 0.9, 0, 1);
  moonLight.intensity = 0.8 * (1 - W.cloud * 0.55);
  hemi.intensity = 1.35 - W.cloud * 0.3 + W.snow * 0.25;
  scene.background = W.cloud > 0.5 ? SKY.cloudy : SKY.clear;
  weatherFireLight = 1 - W.rain * 0.2;
  rain.material.opacity = W.rain * 0.55; rain.visible = W.rain > 0.02;
  if (rain.visible) {
    const a = rainGeo.attributes.position.array, fall = t * 22;
    for (let i = 0; i < RAIN_N; i++) { const s = rainSeed[i]; const y = 18 - ((s[1] + fall) % 18); const x = cx + s[0] + y * 0.08, z = cz + s[2]; a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 2] = z; a[i * 6 + 3] = x - 0.04; a[i * 6 + 4] = y - 0.55; a[i * 6 + 5] = z; }
    rainGeo.attributes.position.needsUpdate = true;
  }
  snow.material.opacity = W.snow * 0.9; snow.visible = W.snow > 0.02;
  if (snow.visible) {
    const a = snowGeo.attributes.position.array, fall = t * 1.4;
    for (let i = 0; i < SNOW_N; i++) { const s = snowSeed[i]; const y = 16 - ((s[1] + fall) % 16); a[i * 3] = cx + s[0] + Math.sin(t * 0.8 + s[3]) * 0.6; a[i * 3 + 1] = y; a[i * 3 + 2] = cz + s[2] + Math.cos(t * 0.6 + s[3]) * 0.6; }
    snowGeo.attributes.position.needsUpdate = true;
  }
}

// =====================================================================
// 캐릭터 (머리 큰 동물들)
// =====================================================================
const ANIMALS = [
  { name: '강아지', icon: '🐶', fur: 0xf2ece4, ear: 0x3a2e2a, earKind: 'flop', snout: 0xffffff, patch: 0x3a2e2a },
  { name: '고양이', icon: '🐱', fur: 0xd8a06a, ear: 0xd8a06a, earKind: 'cat', snout: 0xf5e6d6 },
  { name: '곰', icon: '🐻', fur: 0x8a5a3a, ear: 0x8a5a3a, earKind: 'round', snout: 0xd9b48a },
  { name: '토끼', icon: '🐰', fur: 0xf6f1ee, ear: 0xf6f1ee, earKind: 'long', snout: 0xffffff },
  { name: '여우', icon: '🦊', fur: 0xe2793a, ear: 0xe2793a, earKind: 'cat', snout: 0xfff4ea },
  { name: '판다', icon: '🐼', fur: 0xf6f6f4, ear: 0x1e1e22, earKind: 'round', snout: 0xffffff, eyePatch: 0x1e1e22 }
];
const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
const G = {
  body: new THREE.CylinderGeometry(0.24, 0.33, 0.52, 14), head: new THREE.SphereGeometry(0.4, 20, 16), eye: new THREE.SphereGeometry(0.05, 10, 8), shine: new THREE.SphereGeometry(0.016, 6, 4),
  snout: new THREE.SphereGeometry(0.15, 12, 10), nose: new THREE.SphereGeometry(0.045, 8, 6), cheek: new THREE.SphereGeometry(0.055, 8, 6),
  leg: new THREE.CylinderGeometry(0.085, 0.08, 0.26, 8), arm: new THREE.CylinderGeometry(0.065, 0.06, 0.32, 8), hand: new THREE.SphereGeometry(0.075, 8, 6),
  scarf: new THREE.TorusGeometry(0.25, 0.075, 8, 18), scarfTail: new THREE.BoxGeometry(0.11, 0.24, 0.05), tail: new THREE.SphereGeometry(0.1, 8, 6),
  shadow: new THREE.CircleGeometry(0.5, 20), stick: new THREE.CylinderGeometry(0.012, 0.012, 1.1, 5), tip: new THREE.SphereGeometry(0.08, 10, 8),
  rod: new THREE.CylinderGeometry(0.015, 0.025, 2.2, 5), cup: new THREE.CylinderGeometry(0.07, 0.06, 0.16, 10), foam: new THREE.CylinderGeometry(0.072, 0.072, 0.04, 10),
  meat: new THREE.BoxGeometry(0.14, 0.1, 0.12), potato: new THREE.SphereGeometry(0.13, 10, 8), towel: new THREE.BoxGeometry(0.34, 0.08, 0.26), milk: new THREE.CylinderGeometry(0.05, 0.06, 0.18, 10),
  earFlop: new THREE.SphereGeometry(0.13, 10, 8), earCat: new THREE.ConeGeometry(0.12, 0.22, 4), earRound: new THREE.SphereGeometry(0.11, 10, 8), earLong: new THREE.CapsuleGeometry(0.07, 0.34, 4, 8)
};
const M = { dark: mat(0x1c1410), shine: glow(0xffffff), nose: mat(0x2a1a14), cheek: mat(0xf09a90), leg: mat(0x2b2422), wood: mat(0x8b6a45), cup: mat(0xd9a531, { transparent: true, opacity: 0.85 }), foam: mat(0xfffbf0), towel: mat(0xffffff), milk: mat(0xf6d64a), line: new THREE.LineBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.6 }), pink: mat(0xf2b4bf) };
const furMats = new Map(); const furMat = c => { if (!furMats.has(c)) furMats.set(c, mat(c)); return furMats.get(c); };
function makeCharacter(color, ani = 0) {
  const A = ANIMALS[ani] || ANIMALS[0];
  const root = new THREE.Group();
  const shadow = new THREE.Mesh(G.shadow, shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; root.add(shadow);
  const inner = new THREE.Group(); root.add(inner);
  const fur = furMat(A.fur), cloth = mat(color);
  const legs = [-0.12, 0.12].map(x => { const pv = new THREE.Group(); pv.position.set(x, 0.27, 0); const l = new THREE.Mesh(G.leg, fur); l.position.y = -0.13; pv.add(l); inner.add(pv); return pv; });
  const body = new THREE.Mesh(G.body, fur); body.position.y = 0.52; inner.add(body);
  const scarf = new THREE.Mesh(G.scarf, cloth); scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.8; inner.add(scarf);
  const st = new THREE.Mesh(G.scarfTail, cloth); st.position.set(0.12, 0.66, 0.22); st.rotation.z = 0.2; inner.add(st);
  const arms = [-1, 1].map(s => { const pv = new THREE.Group(); pv.position.set(0.29 * s, 0.72, 0); const a = new THREE.Mesh(G.arm, fur); a.position.y = -0.15; pv.add(a); const h = new THREE.Mesh(G.hand, fur); h.position.y = -0.31; pv.add(h); pv.rotation.z = 0.25 * s; inner.add(pv); return pv; });
  const tail = new THREE.Mesh(G.tail, fur); tail.position.set(0, 0.38, -0.3); if (ani === 4) tail.scale.set(1.2, 1.2, 2.4); inner.add(tail);
  const headG = new THREE.Group(); headG.position.y = 1.18; inner.add(headG);
  headG.add(new THREE.Mesh(G.head, fur));
  // 귀
  const earM = furMat(A.ear);
  for (const s of [-1, 1]) {
    let e;
    if (A.earKind === 'flop') { e = new THREE.Mesh(G.earFlop, earM); e.scale.set(0.6, 1.4, 0.45); e.position.set(0.36 * s, 0.02, 0); e.rotation.z = 0.35 * s; }
    else if (A.earKind === 'cat') { e = new THREE.Mesh(G.earCat, earM); e.position.set(0.22 * s, 0.38, 0); e.rotation.z = -0.35 * s; e.rotation.y = Math.PI / 4; }
    else if (A.earKind === 'round') { e = new THREE.Mesh(G.earRound, earM); e.scale.set(1, 1, 0.55); e.position.set(0.27 * s, 0.33, 0); }
    else { e = new THREE.Mesh(G.earLong, earM); e.position.set(0.14 * s, 0.55, -0.02); e.rotation.z = -0.15 * s; const inr = new THREE.Mesh(G.earLong, M.pink); inr.scale.set(0.6, 0.85, 0.5); inr.position.z = 0.04; e.add(inr); }
    headG.add(e);
  }
  if (A.patch) { const p = new THREE.Mesh(G.cheek, furMat(A.patch)); p.scale.set(2.2, 2.4, 0.6); p.position.set(0.17, 0.08, 0.33); p.rotation.y = 0.4; headG.add(p); }
  if (A.eyePatch) for (const s of [-1, 1]) { const p = new THREE.Mesh(G.cheek, furMat(A.eyePatch)); p.scale.set(1.5, 1.9, 0.6); p.position.set(0.14 * s, 0.03, 0.34); p.rotation.z = 0.5 * s; headG.add(p); }
  const eyes = [-0.14, 0.14].map(x => { const e = new THREE.Mesh(G.eye, M.dark); e.position.set(x, 0.03, 0.37); headG.add(e); const sh = new THREE.Mesh(G.shine, M.shine); sh.position.set(x + 0.015, 0.05, 0.415); headG.add(sh); return e; });
  const snout = new THREE.Mesh(G.snout, furMat(A.snout)); snout.scale.set(1.1, 0.75, 0.6); snout.position.set(0, -0.1, 0.33); headG.add(snout);
  const nose = new THREE.Mesh(G.nose, M.nose); nose.scale.set(1.3, 0.9, 1); nose.position.set(0, -0.06, 0.43); headG.add(nose);
  [-0.22, 0.22].forEach(x => { const c = new THREE.Mesh(G.cheek, M.cheek); c.position.set(x, -0.1, 0.31); c.scale.set(1, 0.6, 0.4); headG.add(c); });
  const towel = new THREE.Mesh(G.towel, M.towel); towel.position.set(0, 0.42, 0); towel.visible = false; headG.add(towel);
  const hand = new THREE.Group(); hand.position.set(0, -0.31, 0); arms[1].add(hand);
  const tools = {};
  { const g = new THREE.Group(); const s = new THREE.Mesh(G.stick, M.wood); s.rotation.x = Math.PI / 2; s.position.z = 0.5; g.add(s); const tip = new THREE.Mesh(G.tip, mat(0xfbf6ec)); tip.position.z = 1.05; tip.scale.set(1, 1.15, 1); g.add(tip); g.userData.tip = tip; tools.stick = g; }
  { const g = new THREE.Group(); const s = new THREE.Mesh(G.stick, M.wood); s.rotation.x = Math.PI / 2; s.position.z = 0.5; g.add(s); const tip = new THREE.Group(); [0, 1, 2].forEach(k => { const m = new THREE.Mesh(G.meat, mat(0xc0504a)); m.position.z = 0.75 + k * 0.15; tip.add(m); }); g.add(tip); g.userData.tip = tip; tools.meat = g; }
  { const g = new THREE.Group(); const r = new THREE.Mesh(G.rod, M.wood); r.rotation.x = Math.PI / 2 - 0.5; r.position.set(0, 0.5, 0.95); g.add(r);
    const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.45, 1.9), new THREE.Vector3(0, -0.4, 2.6)]); g.add(new THREE.Line(lg, M.line)); tools.rod = g; }
  { const g = new THREE.Group(); const c = new THREE.Mesh(G.cup, M.cup); c.position.set(0, 0.04, 0.06); g.add(c); const f = new THREE.Mesh(G.foam, M.foam); f.position.set(0, 0.13, 0.06); g.add(f); tools.cup = g; }
  { const g = new THREE.Group(); const b = new THREE.Mesh(G.milk, M.milk); b.position.set(0, 0.05, 0.06); g.add(b); tools.milk = g; }
  { const g = new THREE.Group(); const s = new THREE.Mesh(G.stick, mat(0x777777)); s.scale.y = 0.6; s.rotation.x = Math.PI / 2 - 0.9; s.position.set(0, 0.25, 0.22); g.add(s); const tip = new THREE.Object3D(); tip.position.set(0, 0.5, 0.42); g.add(tip); g.userData.tip = tip; tools.sparkler = g; }
  for (const k in tools) { tools[k].visible = false; hand.add(tools[k]); }
  return { root, inner, legs, arms, headG, body, cloth, eyes, tools, towel, tail, phase: Math.random() * 6, sit: 0, ani };
}
const _v = new THREE.Vector3();
function animateCharacter(ch, st, dt, t) {
  ch.root.position.set(st.x, st.y, st.z);
  let dr = st.ry - ch.root.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
  ch.root.rotation.y += dr * Math.min(1, dt * 12);
  ch.sit = lerp(ch.sit, st.sitT, Math.min(1, dt * 6));
  if (st.moving) ch.phase += dt * 12;
  const sw = st.moving ? Math.sin(ch.phase) : 0;
  ch.legs[0].rotation.x = lerp(sw * 0.8, -1.45, ch.sit); ch.legs[1].rotation.x = lerp(-sw * 0.8, -1.45, ch.sit);
  ch.inner.position.y = (st.moving ? Math.abs(Math.cos(ch.phase)) * 0.07 : 0) - ch.sit * 0.2 + Math.sin(t * 1.6 + (ch.phase % 3)) * 0.008;
  ch.inner.rotation.z = st.moving ? Math.sin(ch.phase) * 0.05 : 0;
  ch.tail.rotation.y = Math.sin(t * 6 + ch.phase) * 0.4;
  const tool = st.tool === 'towel' ? null : st.tool;
  const holdUp = tool === 'stick' || tool === 'meat' || tool === 'rod' || tool === 'sparkler';
  const drinking = (tool === 'cup' || tool === 'milk') && st.drinkT > 0;
  ch.arms[0].rotation.x = st.moving ? -sw * 0.6 : (st.emote === 'warm' ? -1.1 : 0);
  ch.arms[1].rotation.x = holdUp ? -1.0 : (tool === 'cup' || tool === 'milk') ? (drinking ? -2.3 : -1.2) : st.emote === 'wave' ? -2.7 + Math.sin(t * 14) * 0.3 : (st.moving ? sw * 0.6 : (st.emote === 'warm' ? -1.1 : 0));
  ch.arms[1].rotation.z = st.emote === 'wave' ? -0.45 : -0.25;
  ch.headG.rotation.x = st.emote === 'look' ? -0.5 : st.emote === 'sleep' ? 0.35 + Math.sin(t * 2) * 0.08 : st.emote === 'nod' ? Math.sin(t * 9) * 0.25 : drinking ? -0.35 : 0;
  ch.headG.rotation.z = st.emote === 'relax' ? Math.sin(t * 1.5) * 0.12 : 0;
  const sleepy = st.emote === 'sleep' || st.emote === 'yawn' || st.emote === 'relax';
  ch.eyes.forEach(e => e.scale.y = sleepy ? 0.18 : (Math.sin(t * 0.9 + ch.phase) > 0.995 ? 0.1 : 1));
  ch.towel.visible = st.tool === 'towel';
  for (const k in ch.tools) ch.tools[k].visible = (k === tool);
  if ((tool === 'stick' || tool === 'meat') && typeof st.roast === 'number') {
    const tip = ch.tools[tool].userData.tip;
    const c = tool === 'stick' ? mallowColor(st.roast) : meatColor(st.roast);
    tip.traverse(o => { if (o.material) o.material.color.setHex(c); });
    if (st.roast > 1.05 && Math.random() < dt * 8) { tip.getWorldPosition(_v); emit(small, _v.x, _v.y, _v.z, rand(-0.2, 0.2), 0.8, rand(-0.2, 0.2), 0x555555, 1.2, -0.3, 0.2); }
  }
  if (tool === 'sparkler') {
    ch.tools.sparkler.userData.tip.getWorldPosition(_v);
    for (let k = 0; k < 4; k++) emit(small, _v.x, _v.y, _v.z, rand(-1.6, 1.6), rand(-0.6, 1.8), rand(-1.6, 1.6), Math.random() < 0.5 ? 0xffe2a0 : 0xffffff, rand(0.15, 0.4), 4, 1);
  }
}
function mallowColor(p) { return p < 0.3 ? 0xfbf6ec : p < 0.6 ? 0xf2d7a0 : p < 0.85 ? 0xd99a4e : p < 1.05 ? 0x8a5226 : 0x2a1a12; }
function meatColor(p) { return p < 0.3 ? 0xc0504a : p < 0.55 ? 0xa8584a : p < 0.85 ? 0x8a5a3c : p < 1.05 ? 0x5e3a24 : 0x241812; }

// 군고구마
const potatoMeshes = new Map();
const potatoMat = new THREE.MeshLambertMaterial({ color: 0xcfd3d8, emissive: 0x331100 });
function potatoSpot(key) { const a = (hashStr(key) % 628) / 100; return { x: Math.cos(a) * 0.95, z: Math.sin(a) * 0.95, ry: a }; }
function setPotato(key, on) {
  let m = potatoMeshes.get(key);
  if (on && !m) { m = new THREE.Mesh(G.potato, potatoMat); const s = potatoSpot(key); m.position.set(s.x, 0.1, s.z); m.scale.set(1.4, 0.8, 0.9); m.rotation.y = s.ry; scene.add(m); potatoMeshes.set(key, m); }
  if (!on && m) { scene.remove(m); potatoMeshes.delete(key); }
}

// =====================================================================
// 이름표 · 말풍선
// =====================================================================
const labelsEl = $('labels');
function makeLabel(nick, isMe) {
  const el = document.createElement('div'); el.className = 'tag' + (isMe ? ' me' : '');
  el.innerHTML = '<div class="bubble"></div><div class="name"></div>';
  el.querySelector('.name').append(document.createTextNode(nick));
  labelsEl.appendChild(el);
  return { el, bubble: el.querySelector('.bubble'), name: el.querySelector('.name'), until: 0 };
}
function say(label, text, emo = false, ms) {
  label.bubble.textContent = text; label.bubble.classList.toggle('emo', emo); label.bubble.classList.add('show');
  label.until = performance.now() + (ms || (emo ? 2600 : clamp(2500 + text.length * 120, 3500, 8000)));
}
const _p = new THREE.Vector3();
function placeLabel(label, x, y, z, visible) {
  if (!visible) { label.el.style.display = 'none'; return; }
  _p.set(x, y, z).project(camera);
  const dist = camera.position.distanceTo(_v.set(x, y, z));
  if (_p.z > 1 || dist > 40) { label.el.style.display = 'none'; return; }
  label.el.style.display = '';
  const sx = (_p.x * 0.5 + 0.5) * innerWidth, sy = (-_p.y * 0.5 + 0.5) * innerHeight;
  label.el.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px) translate(-50%,-100%)`;
  label.el.style.opacity = dist > 28 ? String(clamp((40 - dist) / 12, 0, 1)) : '';
  if (label.until && performance.now() > label.until) { label.bubble.classList.remove('show'); label.until = 0; }
}

// =====================================================================
// 길찾기 (1m 격자 A*)
// =====================================================================
const GN = 100, GOFF = 50;
const grid = new Uint8Array(GN * GN);
function blockedRaw(x, z) {
  if (Math.hypot(x, z) > BOUND) return true;
  if (onDock(x, z)) return false;
  if (lakeE(x, z) < 1.12) return true;
  for (const b of blockers) if (Math.abs(b.x - x) < b.r + 0.35 && Math.abs(b.z - z) < b.r + 0.35 && Math.hypot(b.x - x, b.z - z) < b.r + 0.3) return true;
  return false;
}
for (let i = 0; i < GN; i++) for (let j = 0; j < GN; j++) grid[j * GN + i] = blockedRaw(i - GOFF + 0.5, j - GOFF + 0.5) ? 1 : 0;
const cellOf = v => Math.floor(v + GOFF);
function blocked(x, z) {
  const i = cellOf(x), j = cellOf(z);
  if (i < 0 || j < 0 || i >= GN || j >= GN) return true;
  if (onDock(x, z)) return false;
  return grid[j * GN + i] === 1;
}
function nearestFree(x, z) {
  if (!blocked(x, z)) return [x, z];
  for (let r = 1; r < 10; r++) for (let k = 0; k < 16 * r; k++) { const a = k / (16 * r) * 6.28, nx = x + Math.cos(a) * r * 0.5, nz = z + Math.sin(a) * r * 0.5; if (!blocked(nx, nz)) return [nx, nz]; }
  return null;
}
function lineFree(ax, az, bx, bz) {
  const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.3);
  for (let k = 1; k <= n; k++) { const t = k / n; if (blocked(lerp(ax, bx, t), lerp(az, bz, t))) return false; }
  return true;
}
function findPath(sx, sz, tx, tz) {
  if (lineFree(sx, sz, tx, tz)) return [[tx, tz]];
  const si = cellOf(sx), sj = cellOf(sz), ti = cellOf(tx), tj = cellOf(tz);
  const start = sj * GN + si, goal = tj * GN + ti;
  const gScore = new Float32Array(GN * GN).fill(Infinity), came = new Int32Array(GN * GN).fill(-1), closed = new Uint8Array(GN * GN);
  const heap = []; const push = (f, n) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const h = n => Math.hypot((n % GN) - ti, ((n / GN) | 0) - tj);
  gScore[start] = 0; push(h(start), start);
  const free = n => grid[n] === 0 || onDock((n % GN) - GOFF + 0.5, ((n / GN) | 0) - GOFF + 0.5);
  let found = false, it = 0;
  while (heap.length && it++ < 14000) {
    const [, cur] = pop(); if (cur === goal) { found = true; break; } if (closed[cur]) continue; closed[cur] = 1;
    const ci = cur % GN, cj = (cur / GN) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= GN || nj >= GN) continue;
      const nb = nj * GN + ni; if (!free(nb)) continue;
      if (di && dj && (!free(cj * GN + ni) || !free(nj * GN + ci))) continue;
      const g = gScore[cur] + (di && dj ? 1.414 : 1);
      if (g < gScore[nb]) { gScore[nb] = g; came[nb] = cur; push(g + h(nb), nb); }
    }
  }
  if (!found) return null;
  const pts = []; for (let n = goal; n !== -1 && n !== start; n = came[n]) pts.push([(n % GN) - GOFF + 0.5, ((n / GN) | 0) - GOFF + 0.5]);
  pts.reverse(); if (!pts.length) return [[tx, tz]]; pts[pts.length - 1] = [tx, tz];
  const out = []; let ax = sx, az = sz, k = 0;
  while (k < pts.length) { let far = k; for (let m = pts.length - 1; m > k; m--) if (lineFree(ax, az, pts[m][0], pts[m][1])) { far = m; break; } out.push(pts[far]); ax = pts[far][0]; az = pts[far][1]; k = far + 1; }
  return out;
}

// =====================================================================
// 나 (플레이어)
// =====================================================================
const COLORS = ['#c8553d', '#e2a03f', '#2f8f8a', '#3f5fa8', '#8a5a9e', '#d27a9a', '#5a6270', '#3f7f4f'];
const ADJ = ['조용한', '졸린', '따뜻한', '느긋한', '포근한', '멍한', '작은', '다정한', '배고픈', '반짝이는'];
const NOUN = ['여우', '곰', '고양이', '부엉이', '다람쥐', '수달', '너구리', '토끼', '고슴도치', '펭귄'];
const me = {
  nick: store.get('nick', ''), color: store.get('color', COLORS[Math.floor(Math.random() * COLORS.length)]), ani: store.get('ani', Math.floor(Math.random() * ANIMALS.length)),
  x: 0, z: 6, ry: Math.PI, path: [], moving: false, seat: null, tent: null, tool: null, roast: null, potato: null,
  since: Date.now(), seated: false, idle: 0, emote: null, emoteUntil: 0, drinkT: 0, char: null, label: null
};
const SPEED = 3.6;
const targetRing = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 24), new THREE.MeshBasicMaterial({ color: 0xffd9a8, transparent: true, opacity: 0.6, depthWrite: false }));
targetRing.rotation.x = -Math.PI / 2; targetRing.visible = false; scene.add(targetRing);

function walkTo(x, z) {
  if (me.tent != null) return;
  const f = nearestFree(x, z); if (!f) return;
  const p = findPath(me.x, me.z, f[0], f[1]); if (!p) { toast('그쪽으로는 갈 수 없어요'); return; }
  me.path = p; leaveSeat();
  targetRing.position.set(f[0], walkH(f[0], f[1]) + 0.04, f[1]); targetRing.visible = true;
}
function leaveSeat() { if (me.seat != null) { me.seat = null; sendPresence(); } }
const seatTaken = i => { for (const o of others.values()) if (o.p.seat === i) return true; return false; };
const keys = new Set();
const KEYMAP = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd', a: 'l', d: 'r', w: 'u', s: 'd', A: 'l', D: 'r', W: 'u', S: 'd' };
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT')) { if (e.key === 'Escape') e.target.blur(); return; }
  if (!me.seated) return;
  const k = KEYMAP[e.key]; if (k) { keys.add(k); e.preventDefault(); }
  if (e.key === 'Enter') { $('chatIn').focus(); e.preventDefault(); }
});
addEventListener('keyup', e => { const k = KEYMAP[e.key]; if (k) keys.delete(k); });
addEventListener('blur', () => keys.clear());

let lastSend = 0, wasMoving = false, wasInBath = false;
function updateMe(dt) {
  if (me.tent != null) { me.moving = false; return; }
  let ix = 0, iz = 0;
  if (keys.has('l')) ix -= 1; if (keys.has('r')) ix += 1; if (keys.has('u')) iz -= 1; if (keys.has('d')) iz += 1;
  const speed = SPEED * (inBath(me.x, me.z) ? 0.55 : 1);
  if (ix || iz) {
    me.path = []; targetRing.visible = false; leaveSeat();
    // 카메라 방향 기준으로 움직여요
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let vx = rx * ix - fx * iz, vz = rz * ix - fz * iz; const n = Math.hypot(vx, vz); vx /= n; vz /= n;
    const nx = me.x + vx * speed * dt, nz = me.z + vz * speed * dt;
    if (!blocked(nx, nz)) { me.x = nx; me.z = nz; } else if (!blocked(nx, me.z)) me.x = nx; else if (!blocked(me.x, nz)) me.z = nz;
    me.ry = Math.atan2(vx, vz); me.moving = true;
  } else if (me.path.length) {
    const [tx, tz] = me.path[0]; const dx = tx - me.x, dz = tz - me.z, d = Math.hypot(dx, dz), stepLen = speed * dt;
    if (d <= stepLen) { me.x = tx; me.z = tz; me.path.shift(); if (!me.path.length) targetRing.visible = false; }
    else { me.x += dx / d * stepLen; me.z += dz / d * stepLen; }
    if (d > 0.01) me.ry = Math.atan2(dx, dz);
    me.moving = true;
  } else me.moving = false;
  if (me.moving) me.idle = 0; else me.idle += dt;
  if (!me.moving && me.seat == null && me.idle > 0.35) {
    let best = -1, bd = 1.0;
    seats.forEach((s, i) => { const d = Math.hypot(s.x - me.x, s.z - me.z); if (d < bd && !seatTaken(i)) { bd = d; best = i; } });
    if (best >= 0) { me.seat = best; const s = seats[best]; me.x = s.x; me.z = s.z; me.ry = s.ry; sendPresence(); }
  }
  if (!me.moving && me.seat == null && me.idle > 0.6 && Math.hypot(me.x, me.z) < 6) me.ry = Math.atan2(-me.x, -me.z);
  const ib = inBath(me.x, me.z);
  if (ib && !wasInBath) { toast('♨️ 아~ 따뜻해요. 노천탕에 들어왔어요'); playSplash(0.3); }
  if (!ib && wasInBath && me.tool === 'towel') setTool(null);
  wasInBath = ib;
  const now = performance.now();
  if (me.moving && now - lastSend > 130) { lastSend = now; sendPresence(); }
  if (!me.moving && wasMoving) sendPresence();
  wasMoving = me.moving;
}
function myState() {
  const s = me.seat != null ? seats[me.seat] : null, ib = inBath(me.x, me.z);
  return { x: me.x, z: me.z, y: s ? s.y : walkH(me.x, me.z), ry: me.ry, moving: me.moving, sitT: s || (ib && !me.moving) ? 1 : 0, tool: me.tool, roast: me.roast, emote: performance.now() < me.emoteUntil ? me.emote : null, drinkT: me.drinkT };
}

// =====================================================================
// 다른 사람들
// =====================================================================
const others = new Map();
const muted = new Set(store.get('muted', []));
function upsertOther(id, p) {
  let o = others.get(id);
  if (o && (o.p.ani | 0) !== (p.ani | 0)) { removeOther(id); o = null; }
  if (!o) {
    o = { p, char: makeCharacter(p.color, p.ani | 0), label: makeLabel(p.nick, false), cur: { x: p.x, z: p.z }, moving: false, emote: null, emoteUntil: 0, drinkT: 0, id, ry: p.ry || 0 };
    scene.add(o.char.root); others.set(id, o);
    o.label.name.addEventListener('click', ev => openPeerMenu(id, ev));
  } else {
    if (o.p.color !== p.color) o.char.cloth.color.set(p.color);
    if (o.p.nick !== p.nick) { o.label.name.textContent = p.nick; }
    o.p = p;
  }
  setPotato(id, !!p.potato);
}
function removeOther(id) { const o = others.get(id); if (!o) return; scene.remove(o.char.root); o.label.el.remove(); others.delete(id); setPotato(id, false); }
function updateOther(o, dt) {
  const p = o.p, s = p.seat != null && seats[p.seat] ? seats[p.seat] : null;
  const tx = s ? s.x : p.x, tz = s ? s.z : p.z;
  const dx = tx - o.cur.x, dz = tz - o.cur.z, d = Math.hypot(dx, dz);
  if (d > 10) { o.cur.x = tx; o.cur.z = tz; o.moving = false; }
  else if (d > 0.03) { const sp = Math.max(SPEED * 1.05, d * 3) * dt, k = Math.min(1, sp / d); o.cur.x += dx * k; o.cur.z += dz * k; o.moving = true; o.ry = Math.atan2(dx, dz); }
  else { o.moving = false; o.ry = s ? s.ry : (typeof p.ry === 'number' ? p.ry : o.ry || 0); }
  o.drinkT = Math.max(0, o.drinkT - dt);
  const ib = inBath(o.cur.x, o.cur.z);
  return { x: o.cur.x, z: o.cur.z, y: s && !o.moving ? s.y : walkH(o.cur.x, o.cur.z), ry: o.ry || 0, moving: o.moving, sitT: (s || ib) && !o.moving ? 1 : 0, tool: p.tool, roast: p.roast, emote: performance.now() < o.emoteUntil ? o.emote : null, drinkT: o.drinkT };
}

let menuFor = null;
function openMenu(el, ev) { el.classList.add('show'); el.style.left = Math.min(ev.clientX, innerWidth - 220) + 'px'; el.style.top = Math.min(ev.clientY, innerHeight - 140) + 'px'; }
function openPeerMenu(id, ev) {
  const o = others.get(id); if (!o) return;
  menuFor = id; $('menuWho').textContent = o.p.nick;
  $('menuMute').textContent = muted.has(o.p.nick) ? '👀 다시 보기' : '🙈 이 사람 숨기기';
  openMenu($('peerMenu'), ev); ev.stopPropagation();
}
addEventListener('pointerdown', e => { if (!e.target.closest('.menu') && !e.target.closest('.name')) { $('peerMenu').classList.remove('show'); $('ornMenu').classList.remove('show'); } });
$('menuMute').onclick = () => {
  const o = others.get(menuFor); if (!o) return;
  if (muted.has(o.p.nick)) { muted.delete(o.p.nick); toast(`${o.p.nick}님을 다시 볼 수 있어요`); } else { muted.add(o.p.nick); toast(`${o.p.nick}님의 말과 모습을 숨겼어요`); }
  store.set('muted', [...muted]); $('peerMenu').classList.remove('show');
};
$('menuReport').onclick = () => {
  const o = others.get(menuFor); if (!o) return;
  send({ type: 'report', id: menuFor }); muted.add(o.p.nick); store.set('muted', [...muted]);
  toast('신고했어요. 이 사람은 이제 안 보여요'); $('peerMenu').classList.remove('show');
};

// =====================================================================
// 네트워크
// =====================================================================
let ws = null, connected = false, retry = 0, myId = null, clockOffset = 0;
function send(o) { if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(o)); } catch (e) {} } }
function sendPresence() {
  if (!me.seated) return;
  send({ type: 'presence', p: { nick: me.nick, color: me.color, ani: me.ani, x: +me.x.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2), seat: me.seat, tent: me.tent, tool: me.tool, roast: me.roast == null ? null : +me.roast.toFixed(2), potato: me.potato != null } });
}
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  try { ws = new WebSocket(`${proto}://${location.host}/ws`); } catch (e) { return scheduleReconnect(); }
  ws.onopen = () => { connected = true; retry = 0; sendPresence(); updateCount(); };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    switch (m.type) {
      case 'welcome':
        myId = m.id; clockOffset = (m.now || Date.now()) - Date.now();
        for (const id of [...others.keys()]) removeOther(id);
        for (const p of (m.peers || [])) if (p && p.p && p.p.nick) upsertOther(p.id, p.p);
        if (typeof m.fire === 'number') fireLevel = m.fire;
        if (m.weather) setWeather(m.weather.kind, m.weather.until, true);
        if (Array.isArray(m.ornaments)) m.ornaments.forEach(addOrnament);
        updateCount(); break;
      case 'peer': if (m.p && m.p.nick) { upsertOther(m.id, m.p); updateCount(); } break;
      case 'leave': removeOther(m.id); updateCount(); break;
      case 'fire': if (typeof m.v === 'number') fireLevel = clamp(m.v, 0.2, 1.6); break;
      case 'weather': setWeather(m.kind, m.until); break;
      case 'act': onAct(m); break;
      case 'chat': onChat(m); break;
      case 'ornament': addOrnament(m.o); if (m.o && m.o.nick === me.nick && pendingOrn) { pendingOrn = false; toast('🎄 장식을 달았어요!'); playChime(); } break;
      case 'ornamentWait': pendingOrn = false; toast(`조금만 기다려요 (${Math.ceil(m.ms / 1000)}초 뒤에 또 달 수 있어요)`); break;
      case 'ornamentFail': pendingOrn = false; toast('장식을 저장하지 못했어요. 잠시 후 다시 해봐요'); break;
    }
  };
  ws.onclose = () => { connected = false; for (const id of [...others.keys()]) removeOther(id); updateCount(); scheduleReconnect(); };
  ws.onerror = () => { try { ws.close(); } catch (e) {} };
}
function scheduleReconnect() { setTimeout(connect, Math.min(15000, 800 * Math.pow(2, retry++))); }
setInterval(() => send({ type: 'ping' }), 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && (!ws || ws.readyState > 1)) { retry = 0; connect(); } });

const ACT_EMO = { log: '🪵', nod: '🙂', warm: '🤲', yawn: '🥱', look: '🌌', sleep: '💤', wish: '🌠', fish: '🎣', wave: '👋', heart: '💛', cheers: '🥂', eat: '😋', drink: '🍺', firework: '🎆', splash: '💦', relax: '♨️', egg: '🥚', milk: '🥛' };
const EMOTE_POSE = new Set(['nod', 'warm', 'yawn', 'look', 'sleep', 'wave', 'relax']);
function onAct(m) {
  if (m.k === 'firework') { launchFirework(m.x, m.z, m.c | 0, m.s | 0); if (m.id === myId) return; }
  const o = others.get(m.id); if (!o || muted.has(o.p.nick)) return;
  let emo = ACT_EMO[m.k] || '·';
  if (m.k === 'fish' && Number.isInteger(m.f) && FISH[m.f]) emo = FISH[m.f][1];
  if (m.k === 'cheers') { emo = '🥂 건배!'; playClink(o.cur.x, o.cur.z); }
  if (m.k === 'drink' || m.k === 'milk') o.drinkT = 1.2;
  if (m.k === 'log') { playThunk(); fireBurst(); }
  if (m.k === 'wish') playChime();
  if (m.k === 'splash') splashAt(o.cur.x, o.cur.z);
  say(o.label, emo, m.k !== 'cheers', 2600);
  if (EMOTE_POSE.has(m.k)) { o.emote = m.k; o.emoteUntil = performance.now() + 3000; }
}
function onChat(m) {
  if (m.id === myId) { say(me.label, m.text); addLog(me.nick, m.text); return; }
  const o = others.get(m.id); if (!o || muted.has(o.p.nick)) return;
  say(o.label, m.text); addLog(o.p.nick, m.text); playPop();
}
function addLog(nick, text, sys = false) {
  const log = $('log'), d = document.createElement('div');
  if (sys) { d.className = 'sys'; d.textContent = text; } else d.innerHTML = `<b>${escapeHtml(nick)}</b>${escapeHtml(text)}`;
  log.appendChild(d); while (log.children.length > 6) log.firstChild.remove();
  setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 1000); }, 25000);
}
function updateCount() {
  const total = others.size + (me.seated ? 1 : 0);
  $('countNum').textContent = connected ? String(Math.max(total, 1)) : '…';
}
setInterval(updateCount, 2000);

let lastWeatherKind = null;
function setWeather(kind, until, silent) {
  if (!WEATHER_INFO[kind]) return;
  weather.kind = kind; weather.until = until || 0;
  if (!silent && lastWeatherKind && lastWeatherKind !== kind && me.seated) {
    const msg = { rain: '🌧️ 비가 내리기 시작했어요. 불이 약해져요', snow: '❄️ 눈이 내려요', fog: '🌫️ 안개가 깔려요', cloudy: '☁️ 구름이 몰려와요', clear: '🌙 하늘이 맑게 갰어요' }[kind];
    addLog('', msg, true);
  }
  lastWeatherKind = kind;
}

// =====================================================================
// 놀이
// =====================================================================
const FISH = [['송사리', '🐟', 28], ['붕어', '🐟', 24], ['피라미', '🐟', 16], ['메기', '🐟', 10], ['잉어', '🐠', 8], ['무지개송어', '🐠', 5], ['낡은 장화', '👢', 6], ['빈 깡통', '🥫', 4], ['황금 잉어', '✨', 2]];
const near = {
  fire: () => Math.hypot(me.x, me.z) < 5.5,
  grill: () => Math.hypot(me.x - GRILL.x, me.z - GRILL.z) < 2.8,
  fish: () => Math.hypot(me.x - FISH_SPOT.x, me.z - FISH_SPOT.z) < 1.7,
  tent: () => TENTS.findIndex(t => Math.hypot(me.x - t.door.x, me.z - t.door.z) < 2),
  hill: () => Math.hypot(me.x - HILL.x, me.z - HILL.z) < 9,
  bath: () => inBath(me.x, me.z),
  shelf: () => Math.hypot(me.x - SHELF.x, me.z - SHELF.z) < 2.6,
  tree: () => Math.hypot(me.x - XMAS.x, me.z - XMAS.z) < 8
};
function zoneName() {
  if (me.tent != null) return '⛺ 텐트 안';
  if (near.bath()) return '♨️ 노천탕 안';
  if (Math.sqrt(bathE(me.x, me.z)) < 2 || Math.hypot(me.x - BATH_HUT.x, me.z - BATH_HUT.z) < 4) return '♨️ 노천탕';
  if (Math.hypot(me.x - XMAS.x, me.z - XMAS.z) < 13) return '🎄 크리스마스 광장';
  if (near.grill()) return '🥩 바비큐 그릴';
  if (Math.hypot(me.x, me.z) < 9) return '🔥 모닥불 광장';
  if (onDock(me.x, me.z) || lakeE(me.x, me.z) < 2.6) return '🌊 호숫가';
  if (near.hill()) return '🌌 별 언덕';
  if (Math.hypot(me.x - TENT_AREA.x, me.z - TENT_AREA.z) < 8) return '⛺ 텐트촌';
  if (Math.hypot(me.x - CAMPER.x, me.z - CAMPER.z) < 5) return '🚐 캠핑카';
  if (me.z < -12 && Math.abs(me.x) < 15) return '🌲 숲길';
  return '모닥불 캠핑장';
}
function doAct(k, extra = {}) {
  send({ type: 'act', k, ...extra });
  if (k !== 'firework') {
    let emo = ACT_EMO[k] || '·';
    if (k === 'fish' && FISH[extra.f]) emo = FISH[extra.f][1];
    say(me.label, k === 'cheers' ? '🥂 건배!' : emo, k !== 'cheers', 2600);
  }
  if (EMOTE_POSE.has(k)) { me.emote = k; me.emoteUntil = performance.now() + 3000; }
  if (k === 'look') lookSky(me.x - Math.sin(camYaw) * 30, 22, me.z - Math.cos(camYaw) * 30, 4500);
}
function setTool(t) { me.tool = t; if (t !== 'stick' && t !== 'meat') me.roast = null; sendPresence(); }
function walkNear(x, z, msg) { const a = Math.atan2(me.x - x, me.z - z); walkTo(x + Math.sin(a) * 1.3, z + Math.cos(a) * 1.3); if (msg) toast(msg); }

// 굽기
let roasting = null;
function startRoast(kind) {
  if (kind === 'stick' && !near.fire()) return walkNear(0, 0, '모닥불 가까이 가는 중…');
  if (kind === 'meat' && !near.grill()) return walkNear(GRILL.x, GRILL.z, '그릴 앞으로 가는 중…');
  roasting = kind; if (me.tool !== kind) { me.tool = kind; me.roast = 0; } else if (me.roast == null) me.roast = 0;
  sendPresence();
}
function endRoast() {
  if (!roasting) return; const kind = roasting; roasting = null;
  const p = me.roast ?? 0;
  if (p < 0.25) { toast(kind === 'stick' ? '아직 하얘요. 꾹 눌러서 더 구워요' : '아직 생고기예요. 꾹 눌러서 더!'); sendPresence(); return; }
  let msg;
  if (kind === 'stick') msg = p < 0.55 ? '살짝 노릇. 말랑해요 🍡' : p < 0.85 ? '완벽한 황금빛! 🤤' : p < 1.05 ? '겉바속촉 진한 갈색 🍡' : '앗… 새까맣게 탔어요 🔥';
  else msg = p < 0.55 ? '레어! 육즙 가득 🥩' : p < 0.85 ? '미디엄, 딱 좋아요 🍖' : p < 1.05 ? '웰던, 바삭하게 🍖' : '숯이 됐어요… 🔥';
  const key = kind === 'stick' ? 'eatenMallow' : 'eatenMeat', n = store.get(key, 0) + 1; store.set(key, n);
  toast(`${msg}  (지금까지 ${n}개)`); doAct('eat');
  me.tool = null; me.roast = null; sendPresence();
}
addEventListener('pointerup', endRoast); addEventListener('pointercancel', endRoast);

// 군고구마
const POTATO_GOOD = [45, 80];
function potatoAction() {
  if (!near.fire()) return walkNear(0, 0, '모닥불 가까이 가는 중…');
  if (me.potato == null) { me.potato = performance.now(); toast('🍠 고구마를 숯불에 묻었어요. 45초쯤 기다려요', 3000); sendPresence(); return; }
  const s = (performance.now() - me.potato) / 1000; me.potato = null; sendPresence();
  let msg; if (s < 20) msg = '딱딱해요… 너무 일찍 꺼냈어요'; else if (s < POTATO_GOOD[0]) msg = '반쯤 익었어요. 아삭아삭'; else if (s < POTATO_GOOD[1]) msg = '호호 불어먹는 완벽한 군고구마! 🍠🤤'; else if (s < 140) msg = '겉이 좀 탔지만 달아요 🍠'; else msg = '숯덩이가 됐어요… 🖤';
  const n = store.get('eatenPotato', 0) + 1; store.set('eatenPotato', n);
  toast(`${msg}  (지금까지 ${n}개)`, 3000); doAct('eat');
}

// 낚시
let fishing = null;
const bobber = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4040 }));
bobber.visible = false; scene.add(bobber);
function fishAction() {
  if (!near.fish()) { walkTo(FISH_SPOT.x - 0.3, FISH_SPOT.z); toast('선착장 끝으로 가는 중…'); return; }
  if (!fishing) { setTool('rod'); fishing = { state: 'wait', t: 0, biteAt: rand(3, 9) }; bobber.position.set(FISH_SPOT.x + 2.3, WATER_Y + 0.03, FISH_SPOT.z + rand(-0.6, 0.6)); bobber.visible = true; playSplash(0.3); toast('찌를 던졌어요. 입질을 기다려요…'); return; }
  if (fishing.state === 'wait') { toast('아직이에요… 물고기가 놀라 도망갔어요'); fishing.t = 0; fishing.biteAt = rand(3, 9); return; }
  if (fishing.state === 'bite') {
    let total = 0; for (const f of FISH) total += f[2]; let r = Math.random() * total, idx = 0; for (let i = 0; i < FISH.length; i++) { if ((r -= FISH[i][2]) < 0) { idx = i; break; } }
    const f = FISH[idx]; const caught = store.get('fish', {}); caught[f[0]] = (caught[f[0]] || 0) + 1; store.set('fish', caught);
    toast(`${f[1]} ${f[0]}${idx >= 6 && idx <= 7 ? '… 꽝이에요' : '을(를) 낚았어요!'}  (${caught[f[0]]}번째)`, 3200);
    doAct('fish', { f: idx }); playSplash(0.6); stopFishing();
  }
}
function stopFishing() { fishing = null; bobber.visible = false; if (me.tool === 'rod') setTool(null); }
function updateFishing(dt, t) {
  if (!fishing) return;
  if (!near.fish() || me.tool !== 'rod') { fishing = null; bobber.visible = false; return; }
  fishing.t += dt;
  if (fishing.state === 'wait') { bobber.position.y = WATER_Y + 0.03 + Math.sin(t * 2) * 0.015; if (fishing.t > fishing.biteAt) { fishing.state = 'bite'; fishing.t = 0; say(me.label, '❗', true, 1100); playSplash(0.2); } }
  else { bobber.position.y = WATER_Y - 0.05 + Math.sin(t * 25) * 0.03; if (fishing.t > 1.1) { toast('놓쳤어요! 다시 기다려요'); fishing.state = 'wait'; fishing.t = 0; fishing.biteAt = rand(3, 9); } }
}

// 텐트
function enterTent(i) { me.tent = i; me.path = []; targetRing.visible = false; leaveSeat(); if (fishing) stopFishing(); setTool(null); $('tentView').classList.add('show'); sendPresence(); }
function exitTent() { if (me.tent == null) return; const t = TENTS[me.tent]; me.x = t.door.x; me.z = t.door.z; me.ry = t.ry; me.tent = null; $('tentView').classList.remove('show'); sendPresence(); }
$('tentExit').onclick = exitTent;

// 한잔 · 바나나우유
function drinkAction(kind = 'cup') {
  if (me.tool !== kind) { setTool(kind); toast(kind === 'cup' ? '🍺 시원하게 한잔 들었어요. 옆 사람과 건배해봐요' : '🥛 목욕 후엔 바나나우유죠'); return; }
  let mate = null; for (const o of others.values()) if ((o.p.tool === 'cup' || o.p.tool === 'milk') && Math.hypot(o.cur.x - me.x, o.cur.z - me.z) < 3.2) { mate = o; break; }
  me.drinkT = 1.2;
  if (mate) { doAct('cheers'); playClink(me.x, me.z); toast(`${mate.p.nick}님과 건배! 🥂`); }
  else { doAct(kind === 'cup' ? 'drink' : 'milk'); toast(kind === 'cup' ? '캬~ 🍺' : '캬~ 달다 🥛'); }
}

// 노천탕 놀이
function splashAt(x, z) { for (let k = 0; k < 30; k++) emit(small, x + rand(-0.3, 0.3), BATH_Y + 0.1, z + rand(-0.3, 0.3), rand(-1.5, 1.5), rand(2, 4), rand(-1.5, 1.5), 0xbfe6ff, rand(0.5, 0.9), 9, 0.2); playSplash(0.4); }
function splashAction() { if (!near.bath()) return; splashAt(me.x, me.z); doAct('splash'); }
function towelAction() { if (!near.bath()) return walkTo(BATH.x, BATH.z); setTool(me.tool === 'towel' ? null : 'towel'); if (me.tool === 'towel') toast('🧖 수건을 머리에 얹었어요'); }
function eggAction() { if (!near.shelf()) return walkNear(SHELF.x, SHELF.z, '선반으로 가는 중…'); const n = store.get('eggs', 0) + 1; store.set('eggs', n); toast(`🥚 맥반석 계란 톡! 냠 (지금까지 ${n}개)`); doAct('egg'); }

// 불꽃놀이
let lastFw = 0;
function fireworkAction() {
  if (me.tent != null) return;
  const now = performance.now(); if (now - lastFw < 2600) return; lastFw = now;
  const c = Math.floor(Math.random() * 8), s = Math.random() < 0.15 ? 2 : Math.floor(Math.random() * 4);
  if (connected) send({ type: 'act', k: 'firework', c, s }); else launchFirework(me.x, me.z, c, s);
}

// 장작
let logCd = 0;
function logAction() {
  if (!near.fire()) return walkNear(0, 0, '모닥불 가까이 가는 중…');
  const now = performance.now(); if (now < logCd) return; logCd = now + 3500;
  fireLevel = clamp(fireLevel + 0.22, 0.2, 1.6); fireBurst(); playThunk(); doAct('log');
  if (fireLevel > 1.4) toast('불이 활활 타올라요 🔥');
}
function fireBurst() { for (let k = 0; k < 40; k++) emit(small, rand(-0.4, 0.4), 0.6, rand(-0.4, 0.4), rand(-2, 2), rand(3, 7), rand(-2, 2), 0xffb060, rand(0.8, 1.8), 1.5, 0.4); }

// 불멍
let bulmung = false;
function toggleBulmung() {
  if (!bulmung && !near.fire()) return walkNear(0, 0, '모닥불 가까이 가는 중…');
  bulmung = !bulmung; document.body.classList.toggle('bulmung', bulmung);
  if (bulmung) toast('🔥 불멍 중… 아무 데나 누르면 돌아와요', 2600);
}

// 트리 장식
let ornPick = { kind: 'ball', color: ORN_COLORS[0] }, placingOrn = false, pendingOrn = false;
{
  const kEl = $('ornKinds'); for (const k in ORN_KINDS) { const b = document.createElement('button'); b.innerHTML = `<span>${ORN_KINDS[k].icon}</span>${ORN_KINDS[k].label}`; if (k === ornPick.kind) b.classList.add('sel'); b.onclick = () => { ornPick.kind = k; [...kEl.children].forEach(x => x.classList.toggle('sel', x === b)); }; kEl.appendChild(b); }
  const cEl = $('ornColors'); ORN_COLORS.forEach((c, i) => { const b = document.createElement('button'); b.style.background = '#' + c.toString(16).padStart(6, '0'); if (!i) b.classList.add('sel'); b.onclick = () => { ornPick.color = c; [...cEl.children].forEach(x => x.classList.toggle('sel', x === b)); }; cEl.appendChild(b); });
}
function ornamentAction() {
  if (!near.tree()) return walkNear(XMAS.x, XMAS.z + 3, '트리 앞으로 가는 중…');
  $('ornModal').classList.remove('hide'); setTimeout(() => $('ornMsg').focus(), 60);
}
$('ornCancel').onclick = () => $('ornModal').classList.add('hide');
$('ornNext').onclick = () => { $('ornModal').classList.add('hide'); placingOrn = true; $('placeHint').classList.add('show'); };
$('placeCancel').onclick = () => { placingOrn = false; $('placeHint').classList.remove('show'); };
function tryPlaceOrnament(ray) {
  const hit = ray.intersectObjects(treeTiers, false)[0];
  if (!hit) { toast('트리를 눌러주세요 🎄'); return; }
  const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 0, 1);
  const p = hit.point.clone().addScaledVector(n, 0.1);
  if (!connected) { toast('연결 중이에요. 잠시 후 다시 해봐요'); return; }
  pendingOrn = true; placingOrn = false; $('placeHint').classList.remove('show');
  send({ type: 'ornament', kind: ornPick.kind, color: ornPick.color, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), msg: $('ornMsg').value.trim() });
  $('ornMsg').value = '';
}
let ornMenuFor = null;
function showOrnament(o, ev) {
  ornMenuFor = o;
  $('ornWho').innerHTML = `${ORN_KINDS[o.kind] ? ORN_KINDS[o.kind].icon : '🎄'} <b>${escapeHtml(o.nick)}</b>${o.msg ? '<br>' + escapeHtml(o.msg) : ''}`;
  openMenu($('ornMenu'), ev);
}
$('ornReport').onclick = () => { if (ornMenuFor) { send({ type: 'reportOrnament', oid: ornMenuFor.id }); toast('신고했어요. 확인할게요'); } $('ornMenu').classList.remove('show'); };

// 별똥별
function starFor(m) {
  const r = mulberry32(m * 9301 + 49297); if (r() > 0.6) return null;
  const a = r() * 6.28, el = 0.35 + r() * 0.35, len = 0.35 + r() * 0.25;
  return { start: m * 60000 + r() * 50000, a, el, len, dur: 1400 };
}
const starLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xfff6dd, transparent: true, opacity: 0, fog: false }));
starLine.frustumCulled = false; scene.add(starLine);
let wishUntil = 0, lastStar = 0;
function updateShootingStar() {
  const now = Date.now() + clockOffset, m = Math.floor(now / 60000);
  starLine.material.opacity = 0;
  for (const mm of [m - 1, m]) {
    const s = starFor(mm); if (!s) continue; const dt = now - s.start;
    if (dt >= 0 && dt < s.dur) {
      const u = dt / s.dur, R = 160;
      const p = (a, e) => new THREE.Vector3(Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R);
      const head = p(s.a + s.len * u, s.el - 0.12 * u), tail = p(s.a + s.len * Math.max(0, u - 0.25), s.el - 0.12 * Math.max(0, u - 0.25));
      starLine.geometry.setFromPoints([tail.add(camera.position), head.add(camera.position)]);
      starLine.material.opacity = (1 - u * 0.5) * clamp(1 - W.cloud, 0, 1);
      if (lastStar !== s.start && me.seated && W.cloud < 0.5) { lastStar = s.start; wishUntil = performance.now() + 8000; if (near.hill()) { toast('🌠 별똥별이다! 소원을 빌어봐요'); const mid = s.a + s.len * 0.5; lookSky(me.x + Math.cos(mid) * 60, 45, me.z + Math.sin(mid) * 60, 3500); } }
    }
  }
}
$('wishCancel').onclick = () => $('wishModal').classList.add('hide');
function makeWish() {
  const w = $('wishIn').value.trim(); $('wishModal').classList.add('hide'); wishUntil = 0; if (!w) return;
  const list = store.get('wishes', []); list.push({ w, t: Date.now() }); store.set('wishes', list.slice(-50));
  playChime(); doAct('wish'); toast('별똥별에 소원을 빌었어요 🌠');
}
$('wishOk').onclick = makeWish; $('wishIn').addEventListener('keydown', e => { if (e.key === 'Enter') makeWish(); });

// 상황에 맞는 버튼
const actionsEl = $('actions');
let actionsKey = '';
const btn = (id, icon, label, opts = {}) => ({ id, icon, label, ...opts });
function currentActions() {
  if (me.tent != null) return [];
  const list = [];
  if (performance.now() < wishUntil && near.hill()) list.push(btn('wish', '🌠', '소원 빌기', { hot: true }));
  if (near.fire()) {
    list.push(btn('log', '🪵', '장작'));
    list.push(btn('mallow', '🍡', roasting === 'stick' ? '굽는 중' : '마시멜로', { hold: true, on: roasting === 'stick' }));
    list.push(btn('potato', '🍠', me.potato == null ? '고구마' : `꺼내기 ${Math.floor((performance.now() - me.potato) / 1000)}초`, { on: me.potato != null }));
    list.push(btn('bulmung', '🔥', bulmung ? '그만 보기' : '불멍', { on: bulmung }));
  }
  if (near.grill()) list.push(btn('meat', '🥩', roasting === 'meat' ? '굽는 중' : '바베큐', { hold: true, on: roasting === 'meat' }));
  if (near.fish()) list.push(btn('fish', '🎣', !fishing ? '낚시' : fishing.state === 'bite' ? '당겨!' : '기다리는 중', { hot: fishing && fishing.state === 'bite', on: !!fishing }));
  if (near.bath()) { list.push(btn('relax', '♨️', '아~ 좋다')); list.push(btn('splash', '💦', '물장구')); list.push(btn('towel', '🧖', me.tool === 'towel' ? '수건 내리기' : '수건 얹기', { on: me.tool === 'towel' })); }
  if (near.shelf()) { list.push(btn('milk', '🥛', me.tool === 'milk' ? '마시기' : '바나나우유')); list.push(btn('egg', '🥚', '맥반석 계란')); }
  if (near.tree()) list.push(btn('orn', '🎄', '장식 달기', { hot: !store.get('ornDone', false) }));
  const ti = near.tent(); if (ti >= 0) list.push(btn('tent', '⛺', '텐트 쉬기'));
  list.push(btn('drink', me.tool === 'cup' ? '🥂' : '🍺', me.tool === 'cup' ? '건배' : '한잔'));
  list.push(btn('firework', '🎆', '불꽃'));
  list.push(btn('sparkler', '🎇', me.tool === 'sparkler' ? '끄기' : '손불꽃', { on: me.tool === 'sparkler' }));
  if (me.tool && me.tool !== 'sparkler' && me.tool !== 'towel' && !roasting) list.push(btn('drop', '✋', '내려놓기'));
  return list;
}
function renderActions() {
  const list = currentActions();
  const key = list.map(b => b.id + b.label + (b.on ? 1 : 0) + (b.hot ? 1 : 0)).join('|');
  if (key === actionsKey) return; actionsKey = key;
  actionsEl.innerHTML = '';
  actionsEl.style.display = list.length ? '' : 'none';
  for (const b of list) {
    const el = document.createElement('button'); el.className = 'act' + (b.on ? ' on' : '') + (b.hot ? ' hot' : ''); el.type = 'button';
    el.innerHTML = `<span class="i">${b.icon}</span><span>${escapeHtml(b.label)}</span>`;
    if (b.hold) { el.addEventListener('pointerdown', e => { e.preventDefault(); startRoast(b.id === 'mallow' ? 'stick' : 'meat'); }); el.addEventListener('contextmenu', e => e.preventDefault()); }
    else el.addEventListener('click', () => handleAction(b.id));
    actionsEl.appendChild(el);
  }
}
function handleAction(id) {
  switch (id) {
    case 'log': return logAction();
    case 'potato': return potatoAction();
    case 'bulmung': return toggleBulmung();
    case 'fish': return fishAction();
    case 'tent': { const i = near.tent(); if (i >= 0) enterTent(i); return; }
    case 'drink': return drinkAction('cup');
    case 'milk': return drinkAction('milk');
    case 'egg': return eggAction();
    case 'relax': return doAct('relax');
    case 'splash': return splashAction();
    case 'towel': return towelAction();
    case 'orn': store.set('ornDone', true); return ornamentAction();
    case 'firework': return fireworkAction();
    case 'sparkler': return setTool(me.tool === 'sparkler' ? null : 'sparkler');
    case 'drop': if (fishing) stopFishing(); return setTool(null);
    case 'wish': $('wishModal').classList.remove('hide'); $('wishIn').value = ''; setTimeout(() => $('wishIn').focus(), 50); return;
  }
}
$('emoteBtn').onclick = () => $('emotes').classList.toggle('show');
$('emotes').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !me.seated) return; doAct(b.dataset.e); $('emotes').classList.remove('show'); });
$('chatForm').addEventListener('submit', e => {
  e.preventDefault(); const inp = $('chatIn'); const text = inp.value.trim(); if (!text || !me.seated) return;
  if (!connected) { toast('연결 중이에요. 잠시 후 다시 말해요'); return; }
  send({ type: 'chat', text }); inp.value = ''; if (isTouch) inp.blur();
});

// =====================================================================
// 소리
// =====================================================================
let actx = null, crackleGain = null, rainGain = null, soundOn = false;
function initAudio() {
  if (actx) return;
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; return; }
  const mk = (lpf) => { const len = actx.sampleRate * 2, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0); let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = lpf ? last * 3.5 : w * 0.5; } const src = actx.createBufferSource(); src.buffer = buf; src.loop = true; return src; };
  const a = mk(true), lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; crackleGain = actx.createGain(); crackleGain.gain.value = 0; a.connect(lp).connect(crackleGain).connect(actx.destination); a.start();
  const b = mk(false), bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 0.4; rainGain = actx.createGain(); rainGain.gain.value = 0; b.connect(bp).connect(rainGain).connect(actx.destination); b.start();
}
function noiseHit(dur, freq, vol, q = 0.8, type = 'bandpass') {
  if (!actx || !soundOn) return;
  const t = actx.currentTime, len = Math.floor(actx.sampleRate * dur), b = actx.createBuffer(1, len, actx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const s = actx.createBufferSource(); s.buffer = b; const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = actx.createGain(); g.gain.value = vol; s.connect(f).connect(g).connect(actx.destination); s.start(t);
}
function tone(freq, dur, vol, type = 'sine', slideTo) {
  if (!actx || !soundOn) return;
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.05);
}
const distVol = (x, z) => clamp(1 - Math.hypot(x - me.x, z - me.z) / 40, 0.15, 1);
function playThunk() { tone(140, 0.3, 0.35, 'sine', 55); for (let i = 0; i < 6; i++) setTimeout(() => noiseHit(0.03, 2000 + Math.random() * 2500, 0.25), 80 + i * 60); }
function playChime() { [1318, 1760, 2093].forEach((f, i) => setTimeout(() => tone(f, 1.2, 0.07), i * 90)); }
function playPop() { tone(880, 0.08, 0.04, 'sine', 1200); }
function playClink(x, z) { const v = distVol(x, z); tone(2600, 0.35, 0.08 * v, 'triangle'); setTimeout(() => tone(3300, 0.3, 0.06 * v, 'triangle'), 40); }
function playSplash(v) { noiseHit(0.35, 900, v, 0.6, 'lowpass'); }
function playWhistle(x, z) { tone(900, 1.1, 0.03 * distVol(x, z), 'sine', 2400); }
function playBoom(x, z) { const v = distVol(x, z); setTimeout(() => { noiseHit(0.9, 160, 0.9 * v, 0.7, 'lowpass'); tone(70, 0.8, 0.4 * v, 'sine', 35); for (let i = 0; i < 10; i++) setTimeout(() => noiseHit(0.03, 3000 + Math.random() * 3000, 0.12 * v), 300 + Math.random() * 900); }, Math.hypot(x - me.x, z - me.z) * 8); }
function updateAudio(dt) {
  if (!actx) return;
  const nearF = clamp(1 - Math.hypot(me.x, me.z) / 25, 0, 1);
  crackleGain.gain.setTargetAtTime(soundOn ? (0.03 + fireLevel * 0.06) * nearF * (me.tent != null ? 0.3 : 1) : 0, actx.currentTime, 0.3);
  rainGain.gain.setTargetAtTime(soundOn ? W.rain * (me.tent != null ? 0.16 : 0.07) : 0, actx.currentTime, 0.5);
  if (soundOn && Math.random() < dt * (2 + fireLevel * 8) * nearF) noiseHit(0.03, 1500 + Math.random() * 3000, (0.06 + fireLevel * 0.08) * nearF);
}
function setSound(on) {
  soundOn = on; if (on) { initAudio(); if (actx && actx.state === 'suspended') actx.resume().catch(() => {}); }
  store.set('sound', on); $('setSound').classList.toggle('on', on);
}

// =====================================================================
// 카메라 (캐릭터 뒤에서 낮게, 끌어서 둘러보기)
// =====================================================================
let zoom = store.get('zoom2', 1);
let camYaw = 0;           // 0이면 남쪽에서 북쪽을 바라봐요
const camTarget = new THREE.Vector3(0, 1, 6);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pointers = new Map(); let pinchStart = 0, pinchZoom = 1, downAt = null, dragging = false;
canvas.addEventListener('wheel', e => { e.preventDefault(); zoom = clamp(zoom * (e.deltaY > 0 ? 1.1 : 0.9), 0.45, 2.0); store.set('zoom2', zoom); }, { passive: false });
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture?.(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchStart = Math.hypot(a.x - b.x, a.y - b.y); pinchZoom = zoom; downAt = null; }
  else { downAt = { x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX }; dragging = false; }
  $('emotes').classList.remove('show');
});
canvas.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2 && pinchStart) { const [a, b] = [...pointers.values()]; zoom = clamp(pinchZoom * pinchStart / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 0.45, 2.0); return; }
  if (downAt) {
    if (!dragging && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 10) dragging = true;
    if (dragging && me.seated && !bulmung) { camYaw -= (e.clientX - downAt.lx) * 0.006; downAt.lx = e.clientX; }
  }
});
canvas.addEventListener('pointerup', e => {
  pointers.delete(e.pointerId); if (pointers.size < 2) pinchStart = 0;
  if (!downAt) return; const quick = performance.now() - downAt.t < 600; const wasDrag = dragging; downAt = null; dragging = false;
  if (wasDrag || !quick) return;
  if (bulmung) { toggleBulmung(); return; }
  onTap(e.clientX, e.clientY, e);
});
function onTap(x, y, ev) {
  if (!me.seated || me.tent != null) return;
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); raycaster.setFromCamera(ndc, camera);
  if (placingOrn) { tryPlaceOrnament(raycaster); return; }
  // 장식 누르면 메시지 보기
  const ornHit = raycaster.intersectObjects(Object.values(ornMeshes), false)[0];
  if (ornHit && ornHit.distance < 30 && ornHit.instanceId != null) {
    const kind = Object.keys(ornMeshes).find(k => ornMeshes[k] === ornHit.object); const o = ornByKind[kind][ornHit.instanceId];
    if (o) { showOrnament(o, ev); return; }
  }
  if (raycaster.intersectObject(dog, true).length) { dogPet = performance.now(); walkNear(DOG.x, DOG.z); return; }
  const hit = raycaster.intersectObject(groundMesh, false)[0];
  let px, pz;
  if (hit) { px = hit.point.x; pz = hit.point.z; }
  else { const pl = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.32), new THREE.Vector3()); if (!pl) return; px = pl.x; pz = pl.z; }
  if (onDock(px, pz) || (lakeE(px, pz) < 1.12 && Math.abs(pz - DOCK.z) < 1.4 && px > DOCK.x0 && px < DOCK.x1 + 1)) { walkTo(clamp(px, DOCK.x0, DOCK.x1 - 0.2), DOCK.z); return; }
  for (const t of TENTS) if (Math.hypot(px - t.x, pz - t.z) < 2) { walkTo(t.door.x, t.door.z); return; }
  walkTo(px, pz);
}
let skyLook = null;
function lookSky(x, y, z, ms) { skyLook = { x, y, z, until: performance.now() + ms }; }
const _want = new THREE.Vector3(), _look = new THREE.Vector3();
function updateCamera(dt, t) {
  if (!me.seated) { const a = t * 0.05; camera.position.set(Math.sin(a) * 14, 5.5, Math.cos(a) * 14); camera.lookAt(0, 1.6, 0); return; }
  let tx = me.x, ty = walkH(me.x, me.z) + 1, tz = me.z;
  const portrait = camera.aspect < 0.8 ? 1.3 : 1;
  const dist = 8.2 * zoom * portrait, h = 3.6 * zoom * portrait + 0.6;
  if (me.tent != null) { const tt = TENTS[me.tent]; tx = tt.x; tz = tt.z; ty = groundH(tt.x, tt.z) + 1; }
  if (bulmung) {
    const a = Math.atan2(me.x, me.z), r = 3.8;
    _want.set(Math.sin(a) * r, 1.5, Math.cos(a) * r);
    camera.position.lerp(_want, Math.min(1, dt * 1.5)); camTarget.lerp(_look.set(0, 1.4 + fireLevel * 0.35, 0), Math.min(1, dt * 2));
    camera.lookAt(camTarget); return;
  }
  const sky = skyLook && performance.now() < skyLook.until && !me.moving && me.tent == null;
  if (sky) {
    _want.set(tx + Math.sin(camYaw) * 6 * portrait, ty + 1.2, tz + Math.cos(camYaw) * 6 * portrait);
    camera.position.lerp(_want, Math.min(1, dt * 2.2));
    camTarget.lerp(_look.set(skyLook.x, skyLook.y * 0.8, skyLook.z), Math.min(1, dt * 2.2));
    camera.lookAt(camTarget); return;
  }
  camTarget.lerp(_look.set(tx, ty, tz), Math.min(1, dt * 6));
  _want.set(camTarget.x + Math.sin(camYaw) * dist, camTarget.y + h, camTarget.z + Math.cos(camYaw) * dist);
  const gh = groundH(_want.x, _want.z) + 1.0; if (_want.y < gh) _want.y = gh;
  camera.position.lerp(_want, Math.min(1, dt * 4));
  _look.copy(camTarget); _look.y += 0.9; camera.lookAt(_look);
}

// =====================================================================
// 미니맵
// =====================================================================
const mini = $('mini'), mctx = mini.getContext('2d');
const MW = 240, MS = MW / 94;
const m2 = (x, z) => [MW / 2 + x * MS, MW / 2 + z * MS];
function drawMini() {
  mctx.clearRect(0, 0, MW, MW);
  mctx.save(); mctx.beginPath(); mctx.arc(MW / 2, MW / 2, MW / 2, 0, 7); mctx.clip();
  mctx.fillStyle = 'rgba(14,20,34,.9)'; mctx.fillRect(0, 0, MW, MW);
  mctx.strokeStyle = 'rgba(160,130,90,.55)'; mctx.lineWidth = 4; mctx.lineCap = 'round';
  for (const P of PATHS) { mctx.beginPath(); P.forEach(([x, z], i) => { const [a, b] = m2(x, z); i ? mctx.lineTo(a, b) : mctx.moveTo(a, b); }); mctx.stroke(); }
  mctx.fillStyle = 'rgba(40,80,130,.95)'; mctx.beginPath(); { const [lx, lz] = m2(LAKE.x, LAKE.z); mctx.ellipse(lx, lz, LAKE.rx * MS, LAKE.rz * MS, 0, 0, 7); } mctx.fill();
  mctx.fillStyle = 'rgba(60,150,160,.95)'; mctx.beginPath(); { const [bx, bz] = m2(BATH.x, BATH.z); mctx.ellipse(bx, bz, BATH.rx * MS, BATH.rz * MS, 0, 0, 7); } mctx.fill();
  mctx.fillStyle = 'rgba(230,236,245,.55)'; mctx.beginPath(); { const [xx, xz] = m2(XMAS.x, XMAS.z); mctx.arc(xx, xz, 11 * MS, 0, 7); } mctx.fill();
  mctx.font = '17px sans-serif'; mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
  const icon = (e, x, z) => { const [a, b] = m2(x, z); mctx.fillText(e, a, b); };
  icon('🔥', 0, 0); icon('🥩', GRILL.x, GRILL.z); icon('⛺', TENT_AREA.x, TENT_AREA.z); icon('🎣', FISH_SPOT.x, FISH_SPOT.z); icon('🌌', HILL.x, HILL.z); icon('♨️', BATH.x, BATH.z); icon('🎄', XMAS.x, XMAS.z); icon('🚐', CAMPER.x, CAMPER.z);
  for (const o of others.values()) { const [a, b] = m2(o.cur.x, o.cur.z); mctx.fillStyle = o.p.color; mctx.beginPath(); mctx.arc(a, b, 4.5, 0, 7); mctx.fill(); }
  if (me.seated) {
    const [a, b] = m2(me.x, me.z); mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.arc(a, b, 6, 0, 7); mctx.fill(); mctx.strokeStyle = me.color; mctx.lineWidth = 3; mctx.stroke();
    mctx.strokeStyle = 'rgba(255,255,255,.55)'; mctx.lineWidth = 2; mctx.beginPath(); mctx.moveTo(a, b); mctx.lineTo(a - Math.sin(camYaw) * 16, b - Math.cos(camYaw) * 16); mctx.stroke();
  }
  mctx.restore();
  mctx.strokeStyle = 'rgba(150,165,220,.3)'; mctx.lineWidth = 3; mctx.beginPath(); mctx.arc(MW / 2, MW / 2, MW / 2 - 2, 0, 7); mctx.stroke();
}
mini.addEventListener('click', e => {
  const r = mini.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * MW, py = (e.clientY - r.top) / r.height * MW;
  walkTo((px - MW / 2) / MS, (py - MW / 2) / MS);
});

// =====================================================================
// 상단 버튼 · 설정 · 후원
// =====================================================================
$('inviteBtn').onclick = async () => {
  const url = location.origin + location.pathname;
  try { if (navigator.share) { await navigator.share({ title: '모닥불 캠핑장', text: '같이 불멍하러 올래? 🔥', url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('링크를 복사했어요. 친구에게 보내보세요'); } catch (e) { toast(url); }
};
fetch('/config.json').then(r => r.json()).then(c => { if (c && c.donateUrl) { const a = $('donateBtn'); a.href = c.donateUrl; a.style.display = ''; } }).catch(() => {});
$('settingsBtn').onclick = () => $('settings').classList.remove('hide');
$('settingsClose').onclick = () => $('settings').classList.add('hide');
$('setSound').onclick = () => setSound(!soundOn);
$('setBloom').classList.toggle('on', bloomOn);
$('setBloom').onclick = () => { bloomOn = !bloomOn; store.set('bloom', bloomOn); $('setBloom').classList.toggle('on', bloomOn); };
$('setHi').classList.toggle('on', hiQuality);
$('setHi').onclick = () => { hiQuality = !hiQuality; store.set('hi', hiQuality); $('setHi').classList.toggle('on', hiQuality); resize(); };

// =====================================================================
// 입장
// =====================================================================
{
  const sw = $('swatches');
  COLORS.forEach(c => { const b = document.createElement('button'); b.style.background = c; b.setAttribute('aria-label', '색'); if (c === me.color) b.classList.add('sel'); b.onclick = () => { me.color = c; [...sw.children].forEach(x => x.classList.toggle('sel', x === b)); }; sw.appendChild(b); });
  const an = $('animals');
  ANIMALS.forEach((A, i) => { const b = document.createElement('button'); b.innerHTML = `<span>${A.icon}</span>${A.name}`; if (i === me.ani) b.classList.add('sel'); b.onclick = () => { me.ani = i; [...an.children].forEach(x => x.classList.toggle('sel', x === b)); }; an.appendChild(b); });
  $('nickIn').value = me.nick;
}
function enter() {
  let n = $('nickIn').value.replace(/[<>]/g, '').trim();
  if (!n) n = ADJ[Math.floor(Math.random() * ADJ.length)] + ' ' + NOUN[Math.floor(Math.random() * NOUN.length)];
  me.nick = Array.from(n).slice(0, 10).join(''); store.set('nick', me.nick); store.set('color', me.color); store.set('ani', me.ani);
  const a = rand(0.8, 2.3), r = rand(4.6, 5.2); me.x = Math.cos(a) * r; me.z = Math.sin(a) * r; me.ry = Math.atan2(-me.x, -me.z);
  camYaw = Math.atan2(me.x, me.z);       // 불을 바라보는 방향으로 시작
  me.char = makeCharacter(me.color, me.ani); scene.add(me.char.root); me.label = makeLabel(me.nick, true);
  me.seated = true; me.since = Date.now();
  camTarget.set(me.x, 1, me.z); camera.position.set(me.x + Math.sin(camYaw) * 9, 5, me.z + Math.cos(camYaw) * 9);
  $('intro').classList.add('hide');
  setSound(store.get('sound', true));
  sendPresence(); updateCount();
  setTimeout(() => doAct('wave'), 500);
  setTimeout(() => toast(isTouch ? '땅을 톡 누르면 걸어가요 · 끌면 둘러봐요' : '땅을 클릭하면 걸어가요 · 끌면 둘러봐요 · Enter로 말하기', 3200), 1300);
  addLog('', '가까이 있는 사람에게만 말이 들려요. 서로 배려해요 🙂', true);
}
$('enterBtn').onclick = enter;
$('nickIn').addEventListener('keydown', e => { if (e.key === 'Enter') enter(); });
$('setSound').classList.toggle('on', store.get('sound', true));

// =====================================================================
// 메인 루프
// =====================================================================
let lastT = performance.now(), miniAcc = 0, firstFrame = true, subAcc = 0;
const lightCol = new THREE.Color();
function frame(nowP) {
  const dt = Math.min(0.1, (nowP - lastT) / 1000); lastT = nowP; const t = nowP / 1000;
  const k = { clear: 1, cloudy: 1, fog: 1.2, snow: 1.8, rain: 3 }[weather.kind] || 1;
  fireLevel = Math.max(0.22, fireLevel - dt * 0.006 * k);
  if (roasting && me.roast != null) {
    const ok = roasting === 'stick' ? near.fire() : near.grill();
    const before = me.roast; if (ok) me.roast += dt * (roasting === 'stick' ? 0.12 + fireLevel * 0.12 : 0.16);
    if (Math.floor(me.roast * 10) !== Math.floor(before * 10)) sendPresence();
  }
  if (me.seated) {
    updateMe(dt); updateFishing(dt, t);
    me.drinkT = Math.max(0, me.drinkT - dt);
    animateCharacter(me.char, myState(), dt, t);
    me.char.root.visible = me.tent == null;
    setPotato('me', me.potato != null);
  }
  for (const o of others.values()) {
    const st = updateOther(o, dt);
    const hidden = o.p.tent != null || muted.has(o.p.nick);
    o.char.root.visible = !hidden;
    if (!hidden) animateCharacter(o.char, st, dt, t);
    placeLabel(o.label, st.x, st.y + 1.95 - st.sitT * 0.2, st.z, !hidden);
  }
  if (me.seated) { const st = myState(); placeLabel(me.label, me.x, st.y + 1.95 - st.sitT * 0.2, me.z, me.tent == null); }
  tentDoors.forEach((m, i) => { const occ = me.tent === i || [...others.values()].some(o => o.p.tent === i); m.color.setHex(occ ? 0x7a4a18 : 0x120c08); });
  const pet = (performance.now() - dogPet) / 1000;
  dog.userData.tail.rotation.z = -1 + (pet < 3 ? Math.sin(t * 20) * 0.5 : Math.sin(t * 1.2) * 0.05);
  dog.userData.body.scale.y = 0.6 + Math.sin(t * 1.3) * 0.02;
  if (pet > 0 && pet < 0.05) emit(small, DOG.x, 0.9, DOG.z, 0, 1, 0, 0xff8aa8, 1.2, 0, 0.5);
  // 반딧불이
  { const pa = flyGeo.attributes.position.array, ca = flyGeo.attributes.color.array;
    flyData.forEach((f, i) => { pa[i * 3] = f.cx + Math.sin(t * f.sp + f.ph) * 2; pa[i * 3 + 1] = groundH(f.cx, f.cz) + f.h + Math.sin(t * f.sp * 2 + f.ph) * 0.4; pa[i * 3 + 2] = f.cz + Math.cos(t * f.sp * 0.8 + f.ph) * 2;
      const b = Math.max(0, Math.sin(t * 1.5 + f.ph * 3)) * (1 - W.rain) * (1 - W.snow * 0.5); ca[i * 3] = 0.75 * b; ca[i * 3 + 1] = 1 * b; ca[i * 3 + 2] = 0.35 * b; });
    flyGeo.attributes.position.needsUpdate = true; flyGeo.attributes.color.needsUpdate = true; }
  // 그릴 연기, 랜턴 깜빡임
  grillParts.coals.material.color.setHSL(0.04, 1, 0.45 + Math.sin(t * 5) * 0.05);
  if (Math.random() < dt * 4) emit(small, GRILL.x + rand(-0.3, 0.3), 1.1, GRILL.z + rand(-0.3, 0.3), rand(-0.2, 0.2), rand(0.5, 1.2), rand(-0.2, 0.2), 0x444444, 1.8, -0.2, 0.3);
  lanterns.forEach((h, i) => h.material.opacity = 0.3 + Math.sin(t * 3 + i * 1.7) * 0.04);
  // 노천탕 김
  steam.forEach((s, i) => {
    s.t += dt * 0.35; if (s.t > 1) { s.t = 0; const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * 0.85; s.x = BATH.x + Math.cos(a) * BATH.rx * r; s.z = BATH.z + Math.sin(a) * BATH.rz * r; }
    s.s.position.set(s.x + Math.sin(t + i) * 0.3 * s.t, BATH_Y + 0.2 + s.t * 2.4, s.z); const sc = 1.2 + s.t * 2.4; s.s.scale.set(sc, sc, 1);
    s.s.material.opacity = Math.sin(s.t * Math.PI) * 0.16 * (1 + W.snow * 0.6);
  });
  // 트리 전구 반짝반짝, 별
  if (treeLights.mesh && Math.floor(t * 3) !== treeLights.last) {
    treeLights.last = Math.floor(t * 3);
    const pal = [0xff5a5a, 0xffd25a, 0x6ad1ff, 0x7dff9a, 0xffffff, 0xff8ad8];
    for (let i = 0; i < treeLights.n; i++) treeLights.mesh.setColorAt(i, lightCol.setHex(pal[(i + treeLights.last) % pal.length]).multiplyScalar((i + treeLights.last) % 4 === 0 ? 0.25 : 1));
    treeLights.mesh.instanceColor.needsUpdate = true;
  }
  if (treeStar) { treeStar.rotation.y = t * 0.6; }
  // 노천탕·트리 쪽 따뜻한 빛
  const toBath = Math.hypot(me.x - BATH.x, me.z - BATH.z) < Math.hypot(me.x - XMAS.x, me.z - XMAS.z);
  sideLight.position.set(toBath ? BATH.x : XMAS.x, toBath ? 2.6 : 4.5, toBath ? BATH.z : XMAS.z + 2.5);
  sideLight.color.setHex(toBath ? 0xffd2a0 : 0xffe0b0); sideLight.intensity = toBath ? 6 : 4;
  updateFire(dt, t); updateRockets(dt); updatePool(small, dt); updatePool(big, dt);
  updateCamera(dt, t);
  updateWeather(dt, t, camTarget.x, camTarget.z);
  updateShootingStar(); updateAudio(dt);
  moonGlint.material.opacity = 0.25 * moonMat.opacity;
  subAcc += dt;
  if (subAcc > 0.3) {
    subAcc = 0;
    $('zone').textContent = me.seated ? zoneName() : '모닥불 캠핑장';
    const [ic, txt] = WEATHER_INFO[weather.kind] || ['', ''];
    let sub = `${ic} ${txt}`;
    if (me.seated && near.tree()) sub += ` · 장식 ${ornCount()}개`;
    if (me.seated) { const mins = Math.floor((Date.now() - me.since) / 60000); if (mins > 0) sub += ` · 캠핑 ${mins}분째`; }
    $('subLine').textContent = sub;
  }
  if (me.seated) renderActions();
  miniAcc += dt; if (miniAcc > 0.2) { miniAcc = 0; drawMini(); }
  if (bloomOn) composer.render(); else renderer.render(scene, camera);
  if (firstFrame) { firstFrame = false; $('loading').classList.add('hide'); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
connect();
