// 모닥불 캠핑장 — 3D 온라인 캠핑장
import * as THREE from './vendor/three.module.min.js';

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
const GRILL = { x: 7.5, z: -5 };
const DOG = { x: 3.4, z: 3.2 };
const LAKE = { x: 22, z: 10, rx: 8.5, rz: 6.2 };
const DOCK = { x0: 12.6, x1: 18.2, z: 9, w: 1.5 };
const FISH_SPOT = { x: 17.6, z: 9 };
const HILL = { x: -19, z: 17, h: 2.6, r: 8 };
const BENCH = { x: -19, z: 17, ry: Math.PI * 0.75 };
const TENT_AREA = { x: -15, z: -9 };
const TENTS = [
  { x: -17, z: -10, c: 0xd9783a }, { x: -12.5, z: -13, c: 0x4f8f86 }, { x: -20, z: -5, c: 0xd6a640 }
].map(t => { const ry = Math.atan2(FIRE.x - t.x, FIRE.z - t.z); return { ...t, ry, door: { x: t.x + Math.sin(ry) * 2.3, z: t.z + Math.cos(ry) * 2.3 } }; });
const PATHS = [
  [[0, 0], [-7, -4], [-12, -7.5], [-15, -8]],
  [[0, 0], [6, 4], [10, 7.5], [12.8, 9]],
  [[0, 0], [-6, 6], [-12, 12], [-18, 16.5]],
  [[0, 0], [1, -8], [4, -16], [-1, -25], [2, -34]],
  [[0, 0], [4, -2.5], [7.5, -5]]
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
const onDock = (x, z) => x >= DOCK.x0 - 0.3 && x <= DOCK.x1 + 0.2 && Math.abs(z - DOCK.z) <= DOCK.w / 2 + 0.05;

function groundH(x, z) {
  let h = 0;
  const dh = Math.hypot(x - HILL.x, z - HILL.z);
  h += HILL.h * Math.exp(-(dh * dh) / (2 * (HILL.r / 2.3) ** 2));
  const dc = Math.hypot(x, z);
  const flat = clamp((dc - 5) / 10, 0, 1);
  h += (0.35 * Math.sin(x * 0.13 + 1.3) * Math.cos(z * 0.11) + 0.2 * Math.sin(x * 0.31 + z * 0.23)) * flat;
  const e = lakeE(x, z);
  if (e < 1.35) h = lerp(h, -1.3, clamp((1.35 - e) / 0.6, 0, 1));
  if (dc > 40) h += (dc - 40) * 0.25;
  return h;
}
const WATER_Y = -0.2;
const walkH = (x, z) => onDock(x, z) ? 0.32 : Math.max(groundH(x, z), WATER_Y);

// =====================================================================
// 렌더러 · 장면 · 카메라
// =====================================================================
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.25 : 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
const scene = new THREE.Scene();
const FOG_COLOR = new THREE.Color(0x0d1220);
scene.fog = new THREE.FogExp2(FOG_COLOR.getHex(), 0.018);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// 하늘: 세로 그라데이션을 배경으로
function makeSkyTexture(top, mid, bottom) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(0.45, mid); gr.addColorStop(0.52, bottom); gr.addColorStop(1, '#05070c');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const SKY = { clear: makeSkyTexture('#03050b', '#0d1426', '#1a1d2e'), cloudy: makeSkyTexture('#0b0d12', '#171a22', '#1d1f26') };
scene.background = SKY.clear;

// 빛
const hemi = new THREE.HemisphereLight(0x7084c0, 0x1a1712, 1.7); scene.add(hemi);
const moonLight = new THREE.DirectionalLight(0xb0c0ff, 1.0); moonLight.position.set(-40, 60, -30); scene.add(moonLight);
const fireLight = new THREE.PointLight(0xff8a3d, 40, 0, 1.6); fireLight.position.set(0, 1.4, 0); scene.add(fireLight);
const grillLight = new THREE.PointLight(0xff6a2a, 3, 8, 2); grillLight.position.set(GRILL.x, 1.1, GRILL.z); scene.add(grillLight);
const flashLight = new THREE.PointLight(0xffffff, 0, 0, 1.2); flashLight.position.set(0, 20, 0); scene.add(flashLight);

// 부드러운 원형 텍스처 (불꽃, 반딧불, 눈 등에 사용)
function softTexture(inner = 'rgba(255,255,255,1)', size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const SOFT = softTexture();

// 별
const starGeo = new THREE.BufferGeometry();
{
  const r = mulberry32(11), pos = [], col = [];
  for (let i = 0; i < 1800; i++) {
    const th = r() * Math.PI * 2, ph = Math.acos(r() * 0.92 + 0.08), R = 180;
    pos.push(R * Math.sin(ph) * Math.cos(th), R * Math.cos(ph) + 6, R * Math.sin(ph) * Math.sin(th));
    const b = 0.5 + r() * 0.5, warm = r() < 0.15; col.push(b, b * (warm ? 0.85 : 0.95), b * (warm ? 0.7 : 1));
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  starGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
}
const starMat = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false });
const stars = new THREE.Points(starGeo, starMat); scene.add(stars);

// 달
const moonTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 20, 64, 64, 64); gr.addColorStop(0, 'rgba(240,232,205,.35)'); gr.addColorStop(1, 'rgba(240,232,205,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#f1e8cf'; g.beginPath(); g.arc(64, 64, 22, 0, 7); g.fill();
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(75, 58, 20, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const moonMat = new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false });
const moon = new THREE.Sprite(moonMat); moon.scale.set(30, 30, 1); moon.position.set(-90, 75, -110); scene.add(moon);

// =====================================================================
// 땅
// =====================================================================
const C = hex => new THREE.Color(hex);
{
  const SIZE = 130, SEG = 130;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, cols = [];
  const grassA = C(0x2c4a30), grassB = C(0x3a5a34), dirt = C(0x5a4632), plaza = C(0x4b3c2c), sand = C(0x6b5c45), deep = C(0x15202a), hillC = C(0x30482d);
  const r = mulberry32(5), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, groundH(x, z));
    tmp.copy(grassA).lerp(grassB, r());
    const dh = Math.hypot(x - HILL.x, z - HILL.z); if (dh < HILL.r) tmp.lerp(hillC, (1 - dh / HILL.r) * 0.7);
    const dp = distToPaths(x, z); if (dp < 1.4) tmp.lerp(dirt, clamp((1.4 - dp) / 0.7, 0, 1) * 0.85);
    const dc = Math.hypot(x, z); if (dc < 6) tmp.lerp(plaza, clamp((6 - dc) / 2, 0, 1) * 0.9);
    const dg = Math.hypot(x - GRILL.x, z - GRILL.z); if (dg < 2.6) tmp.lerp(plaza, clamp((2.6 - dg) / 1.2, 0, 1) * 0.8);
    const e = lakeE(x, z); if (e < 1.7) tmp.lerp(sand, clamp((1.7 - e) / 0.4, 0, 1)); if (e < 1.1) tmp.lerp(deep, clamp((1.1 - e) / 0.3, 0, 1));
    cols.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  var ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  scene.add(ground);
}
const groundMesh = scene.children[scene.children.length - 1];

// 호수
const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshLambertMaterial({ color: 0x1b3550, emissive: 0x08121e, transparent: true, opacity: 0.88 }));
lake.rotation.x = -Math.PI / 2; lake.scale.set(LAKE.rx * 1.08, LAKE.rz * 1.08, 1); lake.position.set(LAKE.x, WATER_Y, LAKE.z); scene.add(lake);
const moonGlint = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: 0xbfd0ff, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
moonGlint.scale.set(3, 1.2, 1); moonGlint.position.set(LAKE.x - 2, WATER_Y + 0.05, LAKE.z - 1); scene.add(moonGlint);

// =====================================================================
// 소품들
// =====================================================================
const mat = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const blockers = [];   // {x,z,r}
const seats = [];      // {x,z,ry,y}

// 나무 (인스턴스로 가볍게)
{
  const r = mulberry32(42), spots = [];
  const ok = (x, z) => {
    const d = Math.hypot(x, z); if (d < 8 || d > 62) return false;
    if (distToPaths(x, z) < 2.4) return false;
    if (lakeE(x, z) < 1.9) return false;
    if (Math.hypot(x - HILL.x, z - HILL.z) < 5) return false;
    if (Math.hypot(x - TENT_AREA.x, z - TENT_AREA.z) < 8) return false;
    if (Math.hypot(x - GRILL.x, z - GRILL.z) < 4) return false;
    for (const s of spots) if (Math.hypot(s.x - x, s.z - z) < 1.9) return false;
    return true;
  };
  for (let i = 0; i < 6000 && spots.length < 520; i++) {
    const a = r() * Math.PI * 2, d = 6 + Math.sqrt(r()) * 56, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const forestPath = z < -12 && Math.abs(x) < 14;
    const p = d > 34 ? 0.95 : forestPath ? 0.75 : 0.28;
    if (r() < p && ok(x, z)) spots.push({ x, z, s: 0.75 + r() * 0.7, round: r() < 0.25, c: r() });
  }
  const n = spots.length;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, 1, 6), mat(0x3a2a1e), n);
  const layers = [0, 1, 2].map(k => new THREE.InstancedMesh(new THREE.ConeGeometry(1.25 - k * 0.3, 1.5, 7), mat(0xffffff, { flatShading: true }), n));
  const round = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.1, 0), mat(0xffffff, { flatShading: true }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), col = new THREE.Color();
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  spots.forEach((s, i) => {
    const y = groundH(s.x, s.z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.c * 6);
    sc.set(s.s, s.s * 1.1, s.s); pos.set(s.x, y + 0.5 * s.s, s.z); m.compose(pos, q, sc); trunk.setMatrixAt(i, m);
    col.setHSL(0.32 + s.c * 0.08, 0.35, 0.16 + s.c * 0.08);
    if (s.round) {
      pos.set(s.x, y + 1.6 * s.s, s.z); m.compose(pos, q, new THREE.Vector3(s.s, s.s * 1.1, s.s)); round.setMatrixAt(i, m); round.setColorAt(i, col);
      layers.forEach(L => { L.setMatrixAt(i, hide); L.setColorAt(i, col); });
    } else {
      round.setMatrixAt(i, hide); round.setColorAt(i, col);
      layers.forEach((L, k) => { pos.set(s.x, y + (1.3 + k * 0.85) * s.s, s.z); m.compose(pos, q, sc); L.setMatrixAt(i, m); L.setColorAt(i, col); });
    }
    if (Math.hypot(s.x, s.z) < 46) blockers.push({ x: s.x, z: s.z, r: 0.55 * s.s + 0.2 });
  });
  [trunk, round, ...layers].forEach(o => { o.instanceMatrix.needsUpdate = true; if (o.instanceColor) o.instanceColor.needsUpdate = true; scene.add(o); });
}

// 모닥불: 돌, 장작, 통나무 의자
const firePit = new THREE.Group(); scene.add(firePit);
{
  const rockG = new THREE.DodecahedronGeometry(0.32, 0);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const m = new THREE.Mesh(rockG, mat(0x55504c, { flatShading: true })); m.position.set(Math.cos(a) * 1.15, 0.12, Math.sin(a) * 1.15); m.scale.set(1, 0.7, 1); m.rotation.set(rand(0, 3), rand(0, 3), 0); firePit.add(m); }
  const logG = new THREE.CylinderGeometry(0.13, 0.15, 1.5, 7);
  [[0.4, 0], [-0.5, 1.2], [0.2, 2.2], [-0.2, 3.3]].forEach(([tilt, a]) => { const m = new THREE.Mesh(logG, mat(0x3f2618)); m.rotation.set(Math.PI / 2 - 0.35, a, 0); m.position.set(Math.cos(a) * 0.1, 0.35, Math.sin(a) * 0.1); firePit.add(m); });
  const coal = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20), new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.55 }));
  coal.rotation.x = -Math.PI / 2; coal.position.y = 0.04; firePit.add(coal); firePit.userData.coal = coal;
  blockers.push({ x: 0, z: 0, r: 1.5 });
  // 통나무 의자 6개 × 2자리
  const seatG = new THREE.CylinderGeometry(0.28, 0.3, 1.6, 9);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + Math.PI / 6, R = 3.7;
    const m = new THREE.Mesh(seatG, mat(0x5b3a24)); m.rotation.z = Math.PI / 2; m.rotation.y = -a + Math.PI / 2;
    m.position.set(Math.cos(a) * R, 0.26, Math.sin(a) * R); scene.add(m);
    const tx = -Math.sin(a), tz = Math.cos(a);
    for (const off of [-0.45, 0.45]) {
      const x = Math.cos(a) * R + tx * off, z = Math.sin(a) * R + tz * off;
      seats.push({ x, z, y: 0.48, ry: Math.atan2(-x, -z), kind: 'fire' });
    }
  }
}

// 텐트
const tentDoors = [];
TENTS.forEach((t, i) => {
  const g = new THREE.Group(); g.position.set(t.x, groundH(t.x, t.z), t.z); g.rotation.y = t.ry; scene.add(g);
  const body = new THREE.Mesh(new THREE.ConeGeometry(2, 2.4, 4, 1), mat(t.c, { flatShading: true })); body.rotation.y = Math.PI / 4; body.position.y = 1.2; g.add(body);
  const doorMat = new THREE.MeshBasicMaterial({ color: 0x120c08 });
  const door = new THREE.Mesh(new THREE.CircleGeometry(0.62, 3), doorMat); door.position.set(0, 0.62, 1.03); door.rotation.set(-0.36, 0, Math.PI / 2 * 3); door.scale.set(1, 1.35, 1); g.add(door);
  tentDoors.push(doorMat);
  blockers.push({ x: t.x, z: t.z, r: 1.8 });
});

// 호수 선착장
{
  const len = DOCK.x1 - DOCK.x0;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, DOCK.w), mat(0x6a4a30)); deck.position.set((DOCK.x0 + DOCK.x1) / 2, 0.26, DOCK.z); scene.add(deck);
  for (let x = DOCK.x0 + 0.3; x < DOCK.x1; x += 1.4) for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 6), mat(0x3d2a1b)); p.position.set(x, -0.35, DOCK.z + s * (DOCK.w / 2 - 0.08)); scene.add(p); }
  seats.push({ x: DOCK.x1 - 0.25, z: DOCK.z, y: 0.36, ry: Math.PI / 2, kind: 'dock' });
  // 랜턴
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd28a }));
  lantern.position.set(DOCK.x0 + 0.3, 1.1, DOCK.z + 0.7); scene.add(lantern);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 5), mat(0x2a1d14)); pole.position.set(DOCK.x0 + 0.3, 0.55, DOCK.z + 0.7); scene.add(pole);
  const ll = new THREE.PointLight(0xffc070, 2.5, 7, 2); ll.position.copy(lantern.position); scene.add(ll);
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
}

// 바비큐 그릴
const grillParts = {};
{
  const g = new THREE.Group(); g.position.set(GRILL.x, 0, GRILL.z); scene.add(g);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.45, 0.4, 14, 1, true), mat(0x22201f, { side: THREE.DoubleSide })); bowl.position.y = 0.85; g.add(bowl);
  const coals = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), new THREE.MeshBasicMaterial({ color: 0xff4a12 })); coals.rotation.x = -Math.PI / 2; coals.position.y = 0.9; g.add(coals);
  const grate = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.62, 16, 1), mat(0x777777, { side: THREE.DoubleSide, wireframe: true })); grate.rotation.x = -Math.PI / 2; grate.position.y = 1.05; g.add(grate);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), mat(0x1a1a1a)); l.position.set(Math.cos(a) * 0.4, 0.42, Math.sin(a) * 0.4); l.rotation.z = Math.cos(a) * 0.2; l.rotation.x = -Math.sin(a) * 0.2; g.add(l); }
  // 테이블 + 아이스박스
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.8), mat(0x6b4a2e)); table.position.set(1.6, 0.75, 0.2); g.add(table);
  for (const sx of [-0.6, 0.6]) for (const sz of [-0.3, 0.3]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.75, 0.07), mat(0x3d2a1b)); l.position.set(1.6 + sx, 0.37, 0.2 + sz); g.add(l); }
  const cooler = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.4), mat(0x3a7bb8)); cooler.position.set(1.4, 0.22, -0.8); g.add(cooler);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.42), mat(0xeeeeee)); lid.position.set(1.4, 0.48, -0.8); g.add(lid);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8), mat(i === 1 ? 0x2f7a3a : 0xb8862e)); b.position.set(1.25 + i * 0.18, 0.9, 0.35); g.add(b); }
  blockers.push({ x: GRILL.x, z: GRILL.z, r: 0.9 }, { x: GRILL.x + 1.6, z: GRILL.z + 0.2, r: 0.85 }, { x: GRILL.x + 1.4, z: GRILL.z - 0.8, r: 0.5 });
  grillParts.coals = coals;
}

// 잠자는 강아지
const dog = new THREE.Group();
{
  const fur = mat(0xb98a5a), dark = mat(0x8a6038);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), fur); body.scale.set(1.3, 0.62, 0.8); body.position.y = 0.26; dog.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), fur); head.position.set(-0.55, 0.22, 0.05); dog.add(head);
  const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), dark); ear.scale.set(0.6, 1.2, 0.5); ear.position.set(-0.6, 0.36, 0.17); dog.add(ear);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), mat(0x1a1210)); nose.position.set(-0.76, 0.2, 0.05); dog.add(nose);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.35, 6), fur); tail.position.set(0.58, 0.32, 0); tail.rotation.z = -1; dog.add(tail); dog.userData.tail = tail; dog.userData.body = body;
  dog.position.set(DOG.x, 0, DOG.z); dog.rotation.y = 2.2; scene.add(dog);
  blockers.push({ x: DOG.x, z: DOG.z, r: 0.6 });
}
let dogPet = -99;

// 반딧불이 (숲길과 언덕)
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
// 모닥불 불꽃 (크게! 멍때리기 좋게)
// =====================================================================
let fireLevel = 0.85;
const flames = [], embers = [];
const FLAME_N = 190;
for (let i = 0; i < FLAME_N; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: 0xffaa55, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  s.visible = false; scene.add(s); flames.push({ s, life: 1, max: 1, vx: 0, vy: 0, vz: 0, size: 1, seed: Math.random() * 10 });
}
const fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: 0xff7a2a, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
fireGlow.position.set(0, 1.5, 0); scene.add(fireGlow);
const tmpCol = new THREE.Color();
function flameColor(u, out) {
  if (u < 0.18) out.setRGB(1, lerp(0.85, 0.66, u / 0.18), lerp(0.45, 0.2, u / 0.18));
  else if (u < 0.55) { const k = (u - 0.18) / 0.37; out.setRGB(1, lerp(0.66, 0.32, k), lerp(0.2, 0.04, k)); }
  else { const k = (u - 0.55) / 0.45; out.setRGB(lerp(1, 0.5, k), lerp(0.4, 0.1, k), 0.05); }
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
      f.vx = 0; f.vz = 0; f.vy = rand(1.8, 3.0) * (0.8 + fl * 0.7);
      f.life = 0; f.max = rand(0.6, 1.25) * (0.85 + fl * 0.35); f.size = rand(1.1, 2.0) * (0.8 + fl * 0.8);
      f.s.visible = true;
    }
    if (!f.s.visible) continue;
    f.life += dt; const u = f.life / f.max;
    if (u >= 1) { f.s.visible = false; continue; }
    const p = f.s.position;
    p.x += (Math.sin(t * 3.1 + f.seed) * 0.35 - p.x * 1.8) * dt;     // 위로 갈수록 가운데로 모여 불꽃 모양
    p.z += (Math.cos(t * 2.7 + f.seed) * 0.35 - p.z * 1.8) * dt;
    p.y += f.vy * dt;
    const sz = f.size * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) * 0.75);
    f.s.scale.set(sz * 0.7, sz * 1.6, 1);
    f.s.material.color.copy(flameColor(u, tmpCol));
    f.s.material.opacity = (1 - u) * (u < 0.1 ? 0.18 : 0.34);
  }
  if (flameSpawnAcc > 30) flameSpawnAcc = 30;
  // 불티
  if (Math.random() < dt * (3 + fl * 9)) sparkBurst(rand(-0.3, 0.3), 0.8, rand(-0.3, 0.3), 1, 0xffb060, 0.6, 2.4, 0.05);
  const flick = 0.85 + 0.1 * Math.sin(t * 11) + 0.06 * Math.sin(t * 23 + 1) + 0.04 * Math.sin(t * 37);
  fireLight.intensity = (18 + fl * 38) * flick * weatherFireLight;
  fireLight.position.y = 1.2 + fl * 0.4;
  const gs = (3.5 + fl * 4.5) * flick; fireGlow.scale.set(gs, gs * 1.1, 1); fireGlow.material.opacity = 0.18 + fl * 0.1;
  firePit.userData.coal.material.opacity = 0.35 + fl * 0.3 * flick;
  grillLight.intensity = 2.6 + Math.sin(t * 7) * 0.5;
}

// =====================================================================
// 작은 입자들 (불티 · 손불꽃 · 불꽃놀이)
// =====================================================================
function makePool(n, size) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3).fill(9999), col = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: SOFT, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false; scene.add(pts);
  return { n, pts, pos, col, vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n).fill(1), base: new Float32Array(n * 3), drag: new Float32Array(n), grav: new Float32Array(n), next: 0 };
}
const small = makePool(1600, 0.11), big = makePool(2400, 0.42);
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
const W = { rain: 0, snow: 0, fog: 0, cloud: 0 };   // 현재 강도 (부드럽게 변해요)
let weatherFireLight = 1;
const RAIN_N = 1500, SNOW_N = 1400;
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN_N * 6), 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x9fb4d8, transparent: true, opacity: 0 })); rain.frustumCulled = false; scene.add(rain);
const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SNOW_N * 3), 3));
const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ size: 0.16, map: SOFT, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); snow.frustumCulled = false; scene.add(snow);
const rainSeed = []; for (let i = 0; i < RAIN_N; i++) rainSeed.push([rand(-22, 22), rand(0, 18), rand(-22, 22)]);
const snowSeed = []; for (let i = 0; i < SNOW_N; i++) snowSeed.push([rand(-22, 22), rand(0, 16), rand(-22, 22), rand(0, 6.28)]);
function updateWeather(dt, t, cx, cz) {
  const tgt = { rain: weather.kind === 'rain' ? 1 : 0, snow: weather.kind === 'snow' ? 1 : 0, fog: weather.kind === 'fog' ? 1 : 0, cloud: weather.kind === 'clear' ? 0 : 1 };
  for (const k in W) W[k] = lerp(W[k], tgt[k], Math.min(1, dt * 0.25));
  scene.fog.density = 0.016 + W.fog * 0.05 + W.rain * 0.012 + W.snow * 0.01;
  starMat.opacity = clamp(1 - W.cloud * 0.85, 0, 1) * (0.9 + 0.1 * Math.sin(t * 0.7));
  moonMat.opacity = clamp(1 - W.cloud * 0.9, 0, 1);
  moonLight.intensity = 1.0 * (1 - W.cloud * 0.55);
  hemi.intensity = 1.7 - W.cloud * 0.4 + W.snow * 0.4;
  scene.background = W.cloud > 0.5 ? SKY.cloudy : SKY.clear;
  weatherFireLight = 1 - W.rain * 0.2;
  // 비
  rain.material.opacity = W.rain * 0.55; rain.visible = W.rain > 0.02;
  if (rain.visible) {
    const a = rainGeo.attributes.position.array, fall = t * 22;
    for (let i = 0; i < RAIN_N; i++) {
      const s = rainSeed[i]; const y = 18 - ((s[1] + fall) % 18);
      const x = cx + s[0] + y * 0.08, z = cz + s[2];
      a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 2] = z; a[i * 6 + 3] = x - 0.04; a[i * 6 + 4] = y - 0.55; a[i * 6 + 5] = z;
    }
    rainGeo.attributes.position.needsUpdate = true;
  }
  // 눈
  snow.material.opacity = W.snow * 0.9; snow.visible = W.snow > 0.02;
  if (snow.visible) {
    const a = snowGeo.attributes.position.array, fall = t * 1.4;
    for (let i = 0; i < SNOW_N; i++) {
      const s = snowSeed[i]; const y = 16 - ((s[1] + fall) % 16);
      a[i * 3] = cx + s[0] + Math.sin(t * 0.8 + s[3]) * 0.6; a[i * 3 + 1] = y; a[i * 3 + 2] = cz + s[2] + Math.cos(t * 0.6 + s[3]) * 0.6;
    }
    snowGeo.attributes.position.needsUpdate = true;
  }
}

// =====================================================================
// 캐릭터
// =====================================================================
const SKIN = 0xe9c39b;
const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
const G = {
  body: new THREE.CylinderGeometry(0.26, 0.4, 0.8, 14), head: new THREE.SphereGeometry(0.3, 18, 14),
  hat: new THREE.SphereGeometry(0.315, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), band: new THREE.CylinderGeometry(0.322, 0.322, 0.08, 18),
  pom: new THREE.SphereGeometry(0.085, 10, 8), eye: new THREE.SphereGeometry(0.036, 8, 6), cheek: new THREE.SphereGeometry(0.05, 8, 6),
  leg: new THREE.CylinderGeometry(0.075, 0.07, 0.38, 8), arm: new THREE.CylinderGeometry(0.06, 0.055, 0.42, 8), hand: new THREE.SphereGeometry(0.07, 8, 6),
  shadow: new THREE.CircleGeometry(0.55, 20), stick: new THREE.CylinderGeometry(0.012, 0.012, 1.1, 5), tip: new THREE.SphereGeometry(0.08, 10, 8),
  rod: new THREE.CylinderGeometry(0.015, 0.025, 2.2, 5), cup: new THREE.CylinderGeometry(0.07, 0.06, 0.16, 10), foam: new THREE.CylinderGeometry(0.072, 0.072, 0.04, 10),
  meat: new THREE.BoxGeometry(0.14, 0.1, 0.12), potato: new THREE.SphereGeometry(0.13, 10, 8)
};
const M = { skin: mat(SKIN), dark: mat(0x2a1c14), cheek: mat(0xe88a80), leg: mat(0x2b2422), white: mat(0xf3eee6), wood: mat(0x8b6a45), cup: mat(0xd9a531, { transparent: true, opacity: 0.85 }), foam: mat(0xfffbf0), line: new THREE.LineBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.6 }) };
function makeCharacter(color) {
  const root = new THREE.Group();
  const shadow = new THREE.Mesh(G.shadow, shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; root.add(shadow);
  const inner = new THREE.Group(); root.add(inner);
  const cm = mat(color);
  const legs = [-0.13, 0.13].map(x => { const pv = new THREE.Group(); pv.position.set(x, 0.38, 0); const l = new THREE.Mesh(G.leg, M.leg); l.position.y = -0.19; pv.add(l); inner.add(pv); return pv; });
  const body = new THREE.Mesh(G.body, cm); body.position.y = 0.76; inner.add(body);
  const arms = [-1, 1].map(s => { const pv = new THREE.Group(); pv.position.set(0.33 * s, 1.05, 0); const a = new THREE.Mesh(G.arm, cm); a.position.y = -0.2; pv.add(a); const h = new THREE.Mesh(G.hand, M.skin); h.position.y = -0.42; pv.add(h); pv.rotation.z = 0.18 * s; inner.add(pv); return pv; });
  const headG = new THREE.Group(); headG.position.y = 1.42; inner.add(headG);
  headG.add(new THREE.Mesh(G.head, M.skin));
  const hat = new THREE.Mesh(G.hat, cm); hat.position.y = 0.05; headG.add(hat);
  const band = new THREE.Mesh(G.band, M.white); band.position.y = 0.06; headG.add(band);
  const pom = new THREE.Mesh(G.pom, M.white); pom.position.y = 0.37; headG.add(pom);
  const eyes = [-0.1, 0.1].map(x => { const e = new THREE.Mesh(G.eye, M.dark); e.position.set(x, -0.01, 0.275); headG.add(e); return e; });
  [-0.17, 0.17].forEach(x => { const c = new THREE.Mesh(G.cheek, M.cheek); c.position.set(x, -0.09, 0.235); c.scale.set(1, 0.7, 0.5); headG.add(c); });
  // 손에 드는 것들 (오른손)
  const hand = new THREE.Group(); hand.position.set(0, -0.42, 0); arms[1].add(hand);
  const tools = {};
  { const g = new THREE.Group(); const s = new THREE.Mesh(G.stick, M.wood); s.rotation.x = Math.PI / 2; s.position.z = 0.5; g.add(s); const tip = new THREE.Mesh(G.tip, mat(0xfbf6ec)); tip.position.z = 1.05; tip.scale.set(1, 1.15, 1); g.add(tip); g.userData.tip = tip; tools.stick = g; }
  { const g = new THREE.Group(); const s = new THREE.Mesh(G.stick, M.wood); s.rotation.x = Math.PI / 2; s.position.z = 0.5; g.add(s);
    const tip = new THREE.Group(); [0, 1, 2].forEach(k => { const m = new THREE.Mesh(G.meat, mat(0xc0504a)); m.position.z = 0.75 + k * 0.15; tip.add(m); }); g.add(tip); g.userData.tip = tip; tools.meat = g; }
  { const g = new THREE.Group(); const r = new THREE.Mesh(G.rod, M.wood); r.rotation.x = Math.PI / 2 - 0.5; r.position.set(0, 0.5, 0.95); g.add(r);
    const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.45, 1.9), new THREE.Vector3(0, -0.4, 2.6)]); const line = new THREE.Line(lg, M.line); g.add(line); g.userData.line = line; tools.rod = g; }
  { const g = new THREE.Group(); const c = new THREE.Mesh(G.cup, M.cup); c.position.set(0, 0.04, 0.06); g.add(c); const f = new THREE.Mesh(G.foam, M.foam); f.position.set(0, 0.13, 0.06); g.add(f); tools.cup = g; }
  { const g = new THREE.Group(); const s = new THREE.Mesh(G.stick, mat(0x777777)); s.scale.y = 0.6; s.rotation.x = Math.PI / 2 - 0.9; s.position.set(0, 0.25, 0.22); g.add(s); const tip = new THREE.Object3D(); tip.position.set(0, 0.5, 0.42); g.add(tip); g.userData.tip = tip; tools.sparkler = g; }
  for (const k in tools) { tools[k].visible = false; hand.add(tools[k]); }
  return { root, inner, legs, arms, headG, body, cm, eyes, tools, color, phase: Math.random() * 6, sit: 0, moving: false, lastTool: null };
}
const _v = new THREE.Vector3();
function animateCharacter(ch, st, dt, t) {
  // st: {x,z,y,ry,moving,sit(0..1 target),tool,roast,key}
  ch.root.position.set(st.x, st.y, st.z);
  let dr = st.ry - ch.root.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
  ch.root.rotation.y += dr * Math.min(1, dt * 12);
  ch.sit = lerp(ch.sit, st.sitT, Math.min(1, dt * 6));
  if (st.moving) ch.phase += dt * 11;
  const sw = st.moving ? Math.sin(ch.phase) : 0;
  ch.legs[0].rotation.x = lerp(sw * 0.7, -1.45, ch.sit); ch.legs[1].rotation.x = lerp(-sw * 0.7, -1.45, ch.sit);
  ch.inner.position.y = (st.moving ? Math.abs(Math.cos(ch.phase)) * 0.06 : 0) - ch.sit * 0.3 + Math.sin(t * 1.6 + (ch.phase % 3)) * 0.008;
  ch.body.scale.y = 1 + Math.sin(t * 1.6 + ch.phase) * 0.012;
  // 팔: 걷기 흔들기 / 도구 들기
  const tool = st.tool;
  const holdUp = tool === 'stick' || tool === 'meat' || tool === 'rod' || tool === 'sparkler';
  ch.arms[0].rotation.x = st.moving ? -sw * 0.5 : (st.emote === 'warm' ? -1.1 : 0);
  ch.arms[1].rotation.x = holdUp ? -1.0 : tool === 'cup' ? (st.drinkT > 0 ? -2.2 : -1.2) : st.emote === 'wave' ? -2.6 + Math.sin(t * 14) * 0.3 : (st.moving ? sw * 0.5 : (st.emote === 'warm' ? -1.1 : 0));
  ch.arms[1].rotation.z = st.emote === 'wave' ? -0.4 : -0.18;
  ch.headG.rotation.x = st.emote === 'look' ? -0.5 : st.emote === 'sleep' ? 0.35 + Math.sin(t * 2) * 0.08 : st.emote === 'nod' ? Math.sin(t * 9) * 0.25 : 0;
  const sleepy = st.emote === 'sleep' || st.emote === 'yawn';
  ch.eyes.forEach(e => e.scale.y = sleepy ? 0.2 : (Math.sin(t * 0.9 + ch.phase) > 0.995 ? 0.1 : 1));
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

// 군고구마 (불가에 묻어둔 고구마)
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
  el.innerHTML = '<div class="bubble"></div><div class="name"></div><div class="sub"></div>';
  el.querySelector('.name').textContent = nick + (isMe ? ' (나)' : '');
  labelsEl.appendChild(el);
  return { el, bubble: el.querySelector('.bubble'), name: el.querySelector('.name'), sub: el.querySelector('.sub'), until: 0 };
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
  if (_p.z > 1 || dist > 42) { label.el.style.display = 'none'; return; }
  label.el.style.display = '';
  const sx = (_p.x * 0.5 + 0.5) * innerWidth, sy = (-_p.y * 0.5 + 0.5) * innerHeight;
  label.el.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px) translate(-50%,-100%)`;
  label.el.style.opacity = dist > 30 ? String(clamp((42 - dist) / 12, 0, 1)) : '';
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
  while (heap.length && it++ < 12000) {
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
  pts.reverse(); pts[pts.length - 1] = [tx, tz];
  // 직선으로 갈 수 있는 곳은 건너뛰어 자연스럽게
  const out = []; let ax = sx, az = sz, k = 0;
  while (k < pts.length) { let far = k; for (let m = pts.length - 1; m > k; m--) if (lineFree(ax, az, pts[m][0], pts[m][1])) { far = m; break; } out.push(pts[far]); ax = pts[far][0]; az = pts[far][1]; k = far + 1; }
  return out;
}

// =====================================================================
// 나 (플레이어)
// =====================================================================
const COLORS = ['#c8553d', '#e2a03f', '#5b8e7d', '#4f6d9a', '#8a5a9e', '#d27a9a', '#8a8f98', '#3f7f4f'];
const ADJ = ['조용한', '졸린', '따뜻한', '느긋한', '포근한', '멍한', '작은', '다정한', '배고픈', '반짝이는'];
const NOUN = ['여우', '곰', '고양이', '부엉이', '다람쥐', '수달', '너구리', '토끼', '고슴도치', '펭귄'];
const me = {
  nick: store.get('nick', ''), color: store.get('color', COLORS[Math.floor(Math.random() * COLORS.length)]),
  x: 0, z: 6, ry: Math.PI, path: [], moving: false, seat: null, tent: null, tool: null, roast: null, potato: null,
  since: Date.now(), seated: false, idle: 0, emote: null, emoteUntil: 0, drinkT: 0, char: null, label: null
};
const SPEED = 3.6;
let target = null;
const targetRing = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 24), new THREE.MeshBasicMaterial({ color: 0xffd9a8, transparent: true, opacity: 0.6, depthWrite: false }));
targetRing.rotation.x = -Math.PI / 2; targetRing.visible = false; scene.add(targetRing);

function walkTo(x, z) {
  if (me.tent != null) return;
  const f = nearestFree(x, z); if (!f) return;
  const p = findPath(me.x, me.z, f[0], f[1]); if (!p) { toast('그쪽으로는 갈 수 없어요'); return; }
  me.path = p; target = f; leaveSeat();
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

let lastSend = 0, wasMoving = false;
function updateMe(dt) {
  if (me.tent != null) { me.moving = false; return; }
  let vx = 0, vz = 0;
  if (keys.has('l')) vx -= 1; if (keys.has('r')) vx += 1; if (keys.has('u')) vz -= 1; if (keys.has('d')) vz += 1;
  if (vx || vz) {
    me.path = []; targetRing.visible = false; leaveSeat();
    const n = Math.hypot(vx, vz); vx /= n; vz /= n;
    const nx = me.x + vx * SPEED * dt, nz = me.z + vz * SPEED * dt;
    if (!blocked(nx, nz)) { me.x = nx; me.z = nz; } else if (!blocked(nx, me.z)) me.x = nx; else if (!blocked(me.x, nz)) me.z = nz;
    me.ry = Math.atan2(vx, vz); me.moving = true;
  } else if (me.path.length) {
    const [tx, tz] = me.path[0]; const dx = tx - me.x, dz = tz - me.z, d = Math.hypot(dx, dz), stepLen = SPEED * dt;
    if (d <= stepLen) { me.x = tx; me.z = tz; me.path.shift(); if (!me.path.length) targetRing.visible = false; }
    else { me.x += dx / d * stepLen; me.z += dz / d * stepLen; }
    if (d > 0.01) me.ry = Math.atan2(dx, dz);
    me.moving = true;
  } else me.moving = false;
  // 멈추면 가까운 빈 자리에 앉아요
  if (me.moving) me.idle = 0; else me.idle += dt;
  if (!me.moving && me.seat == null && me.idle > 0.35) {
    let best = -1, bd = 1.1;
    seats.forEach((s, i) => { const d = Math.hypot(s.x - me.x, s.z - me.z); if (d < bd && !seatTaken(i)) { bd = d; best = i; } });
    if (best >= 0) { me.seat = best; const s = seats[best]; me.x = s.x; me.z = s.z; me.ry = s.ry; sendPresence(); }
  }
  // 불 근처에 서 있으면 불 쪽을 봐요
  if (!me.moving && me.seat == null && me.idle > 0.6 && Math.hypot(me.x, me.z) < 6) { me.ry = Math.atan2(-me.x, -me.z); }
  const now = performance.now();
  if (me.moving && now - lastSend > 130) { lastSend = now; sendPresence(); }
  if (!me.moving && wasMoving) sendPresence();
  wasMoving = me.moving;
}
function myState(t) {
  const s = me.seat != null ? seats[me.seat] : null;
  return { x: me.x, z: me.z, y: s ? s.y : walkH(me.x, me.z), ry: me.ry, moving: me.moving, sitT: s ? 1 : 0, tool: me.tool, roast: me.roast, emote: performance.now() < me.emoteUntil ? me.emote : (me.tool === 'stick' || me.tool === 'meat' ? null : null), drinkT: me.drinkT };
}

// =====================================================================
// 다른 사람들
// =====================================================================
const others = new Map();   // id -> {p, char, label, cur:{x,z}, moving, emote, emoteUntil, drinkT}
const muted = new Set(store.get('muted', []));
function upsertOther(id, p) {
  let o = others.get(id);
  if (!o) {
    o = { p, char: makeCharacter(p.color), label: makeLabel(p.nick, false), cur: { x: p.x, z: p.z }, moving: false, emote: null, emoteUntil: 0, drinkT: 0, id };
    scene.add(o.char.root); others.set(id, o);
    o.label.name.addEventListener('click', ev => openPeerMenu(id, ev));
  } else {
    if (o.p.color !== p.color) { o.char.cm.color.set(p.color); }
    if (o.p.nick !== p.nick) o.label.name.textContent = p.nick;
    o.p = p;
  }
  setPotato(id, !!p.potato);
}
function removeOther(id) {
  const o = others.get(id); if (!o) return;
  scene.remove(o.char.root); o.label.el.remove(); others.delete(id); setPotato(id, false);
}
function updateOther(o, dt) {
  const p = o.p, s = p.seat != null && seats[p.seat] ? seats[p.seat] : null;
  const tx = s ? s.x : p.x, tz = s ? s.z : p.z;
  const dx = tx - o.cur.x, dz = tz - o.cur.z, d = Math.hypot(dx, dz);
  if (d > 10) { o.cur.x = tx; o.cur.z = tz; o.moving = false; }
  else if (d > 0.03) { const sp = Math.max(SPEED * 1.05, d * 3) * dt, k = Math.min(1, sp / d); o.cur.x += dx * k; o.cur.z += dz * k; o.moving = true; o.ry = Math.atan2(dx, dz); }
  else { o.moving = false; o.ry = s ? s.ry : (typeof p.ry === 'number' ? p.ry : o.ry || 0); }
  o.drinkT = Math.max(0, o.drinkT - dt);
  return { x: o.cur.x, z: o.cur.z, y: s && !o.moving ? s.y : walkH(o.cur.x, o.cur.z), ry: o.ry || 0, moving: o.moving, sitT: s && !o.moving ? 1 : 0, tool: p.tool, roast: p.roast, emote: performance.now() < o.emoteUntil ? o.emote : null, drinkT: o.drinkT };
}

// 이름 눌러 숨기기 / 신고
let menuFor = null;
function openPeerMenu(id, ev) {
  const o = others.get(id); if (!o) return;
  menuFor = id; $('menuWho').textContent = o.p.nick;
  $('menuMute').textContent = muted.has(o.p.nick) ? '👀 다시 보기' : '🙈 이 사람 숨기기';
  const m = $('peerMenu'); m.classList.add('show');
  m.style.left = Math.min(ev.clientX, innerWidth - 150) + 'px'; m.style.top = Math.min(ev.clientY, innerHeight - 120) + 'px';
  ev.stopPropagation();
}
addEventListener('pointerdown', e => { if (!e.target.closest('#peerMenu') && !e.target.closest('.name')) $('peerMenu').classList.remove('show'); });
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
  send({ type: 'presence', p: { nick: me.nick, color: me.color, x: +me.x.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2), seat: me.seat, tent: me.tent, tool: me.tool, roast: me.roast == null ? null : +me.roast.toFixed(2), potato: me.potato != null } });
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
        updateCount(); break;
      case 'peer': if (m.p && m.p.nick) { upsertOther(m.id, m.p); updateCount(); } break;
      case 'leave': removeOther(m.id); updateCount(); break;
      case 'fire': if (typeof m.v === 'number') fireLevel = clamp(m.v, 0.2, 1.6); break;
      case 'weather': setWeather(m.kind, m.until); break;
      case 'act': onAct(m); break;
      case 'chat': onChat(m); break;
    }
  };
  ws.onclose = () => { connected = false; for (const id of [...others.keys()]) removeOther(id); updateCount(); scheduleReconnect(); };
  ws.onerror = () => { try { ws.close(); } catch (e) {} };
}
function scheduleReconnect() { setTimeout(connect, Math.min(15000, 800 * Math.pow(2, retry++))); }
setInterval(() => send({ type: 'ping' }), 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && (!ws || ws.readyState > 1)) { retry = 0; connect(); } });

const ACT_EMO = { log: '🪵', nod: '🙂', warm: '🤲', yawn: '🥱', look: '🌌', sleep: '💤', wish: '🌠', fish: '🎣', wave: '👋', heart: '💛', cheers: '🥂', eat: '😋', drink: '🍺', firework: '🎆' };
const EMOTE_POSE = new Set(['nod', 'warm', 'yawn', 'look', 'sleep', 'wave']);
function onAct(m) {
  if (m.k === 'firework') { launchFirework(m.x, m.z, m.c | 0, m.s | 0); if (m.id === myId) return; }
  const o = others.get(m.id); if (!o) return;
  if (muted.has(o.p.nick)) return;
  let emo = ACT_EMO[m.k] || '·';
  if (m.k === 'fish' && Number.isInteger(m.f) && FISH[m.f]) emo = FISH[m.f][1];
  if (m.k === 'cheers') { emo = '🥂 건배!'; playClink(o.cur.x, o.cur.z); }
  if (m.k === 'drink') o.drinkT = 1.2;
  if (m.k === 'log') { playThunk(); fireBurst(); }
  if (m.k === 'wish') playChime();
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
  const total = [...others.values()].length + (me.seated ? 1 : 0);
  if (!connected) { $('countLine').textContent = '캠핑장에 다가가는 중…'; return; }
  let near = 0; for (const o of others.values()) if (Math.hypot(o.cur.x - me.x, o.cur.z - me.z) < 14) near++;
  $('countLine').innerHTML = total <= 1 ? (me.seated ? '지금은 <b>혼자</b> 캠핑 중이에요' : '캠핑장이 조용해요') : `캠핑장에 <b>${total}명</b> · 근처에 ${near}명`;
}
setInterval(updateCount, 2000);

let lastWeatherKind = null;
function setWeather(kind, until, silent) {
  if (!WEATHER_INFO[kind]) return;
  weather.kind = kind; weather.until = until || 0;
  const [ic, txt] = WEATHER_INFO[kind];
  $('weatherLine').textContent = `${ic} ${txt}`;
  if (!silent && lastWeatherKind && lastWeatherKind !== kind && me.seated) {
    const msg = { rain: '🌧️ 비가 내리기 시작했어요. 불이 약해져요', snow: '❄️ 눈이 내려요', fog: '🌫️ 안개가 깔려요', cloudy: '☁️ 구름이 몰려와요', clear: '🌙 하늘이 맑게 갰어요' }[kind];
    addLog('', msg, true);
  }
  lastWeatherKind = kind;
}

// =====================================================================
// 놀이: 장작, 마시멜로, 고기, 군고구마, 낚시, 텐트, 한잔, 불꽃놀이, 소원
// =====================================================================
const FISH = [['송사리', '🐟', 28], ['붕어', '🐟', 24], ['피라미', '🐟', 16], ['메기', '🐟', 10], ['잉어', '🐠', 8], ['무지개송어', '🐠', 5], ['낡은 장화', '👢', 6], ['빈 깡통', '🥫', 4], ['황금 잉어', '✨', 2]];
const near = {
  fire: () => Math.hypot(me.x, me.z) < 5.5,
  grill: () => Math.hypot(me.x - GRILL.x, me.z - GRILL.z) < 2.8,
  fish: () => Math.hypot(me.x - FISH_SPOT.x, me.z - FISH_SPOT.z) < 1.7,
  tent: () => TENTS.findIndex(t => Math.hypot(me.x - t.door.x, me.z - t.door.z) < 2),
  hill: () => Math.hypot(me.x - HILL.x, me.z - HILL.z) < 9
};
function zoneName() {
  if (me.tent != null) return '⛺ 텐트 안';
  if (near.grill()) return '🥩 바비큐 그릴';
  if (Math.hypot(me.x, me.z) < 7) return '🔥 모닥불 광장';
  if (onDock(me.x, me.z) || lakeE(me.x, me.z) < 2.6) return '🌊 호숫가';
  if (near.hill()) return '🌌 별 언덕';
  if (Math.hypot(me.x - TENT_AREA.x, me.z - TENT_AREA.z) < 9) return '⛺ 텐트촌';
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
function walkNear(x, z, msg) { const a = Math.atan2(me.x - x, me.z - z); walkTo(x + Math.sin(a) * 1.2, z + Math.cos(a) * 1.2); if (msg) toast(msg); }

// 꾹 누르는 굽기 (마시멜로 · 고기)
let roasting = null;   // 'stick' | 'meat'
function startRoast(kind) {
  if (kind === 'stick' && !near.fire()) return walkNear(0, 0, '모닥불 가까이 가는 중…');
  if (kind === 'meat' && !near.grill()) return walkNear(GRILL.x, GRILL.z, '그릴 앞으로 가는 중…');
  roasting = kind; if (me.tool !== kind) { me.tool = kind; me.roast = 0; } else if (me.roast == null) me.roast = 0;
  sendPresence();
}
function endRoast() {
  if (!roasting) return; const kind = roasting; roasting = null;
  const p = me.roast ?? 0;
  if (p < 0.25) { toast(kind === 'stick' ? '아직 하얘요. 조금 더 구워요' : '아직 생고기예요. 조금 더!'); sendPresence(); return; }
  let msg;
  if (kind === 'stick') msg = p < 0.55 ? '살짝 노릇. 말랑해요 🍡' : p < 0.85 ? '완벽한 황금빛! 🤤' : p < 1.05 ? '겉바속촉 진한 갈색 🍡' : '앗… 새까맣게 탔어요 🔥';
  else msg = p < 0.55 ? '레어! 육즙 가득 🥩' : p < 0.85 ? '미디엄, 딱 좋아요 🍖' : p < 1.05 ? '웰던, 바삭하게 🍖' : '숯이 됐어요… 🔥';
  const key = kind === 'stick' ? 'eatenMallow' : 'eatenMeat', n = store.get(key, 0) + 1; store.set(key, n);
  toast(`${msg}  (지금까지 ${n}개)`); doAct('eat');
  me.tool = null; me.roast = null; sendPresence();
}
addEventListener('pointerup', endRoast); addEventListener('pointercancel', endRoast);

// 군고구마: 묻고 → 기다렸다 → 꺼내기
const POTATO_GOOD = [45, 80];  // 초
function potatoAction() {
  if (!near.fire()) return walkNear(0, 0, '모닥불 가까이 가는 중…');
  if (me.potato == null) { me.potato = performance.now(); toast('🍠 고구마를 숯불에 묻었어요. 45초쯤 기다려요', 3000); sendPresence(); return; }
  const s = (performance.now() - me.potato) / 1000; me.potato = null; sendPresence();
  let msg; if (s < 20) msg = '딱딱해요… 너무 일찍 꺼냈어요'; else if (s < POTATO_GOOD[0]) msg = '반쯤 익었어요. 아삭아삭'; else if (s < POTATO_GOOD[1]) msg = '호호 불어먹는 완벽한 군고구마! 🍠🤤'; else if (s < 140) msg = '겉이 좀 탔지만 달아요 🍠'; else msg = '숯덩이가 됐어요… 🖤';
  const n = store.get('eatenPotato', 0) + 1; store.set('eatenPotato', n);
  toast(`${msg}  (지금까지 ${n}개)`, 3000); doAct('eat');
}

// 낚시
let fishing = null;   // {state:'wait'|'bite', t, biteAt}
const bobber = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4040 }));
bobber.visible = false; scene.add(bobber);
function fishAction() {
  if (!near.fish()) return walkTo(FISH_SPOT.x - 0.3, FISH_SPOT.z), toast('선착장 끝으로 가는 중…');
  if (!fishing) { setTool('rod'); fishing = { state: 'wait', t: 0, biteAt: rand(3, 9) }; bobber.position.set(FISH_SPOT.x + 2.3, WATER_Y + 0.03, FISH_SPOT.z + rand(-0.6, 0.6)); bobber.visible = true; playSplash(0.3); toast('찌를 던졌어요. 입질을 기다려요…'); return; }
  if (fishing.state === 'wait') { toast('아직이에요… 물고기가 놀라 도망갔어요'); fishing.t = 0; fishing.biteAt = rand(3, 9); return; }
  if (fishing.state === 'bite') {
    let total = 0; for (const f of FISH) total += f[2]; let r = Math.random() * total, idx = 0; for (let i = 0; i < FISH.length; i++) { if ((r -= FISH[i][2]) < 0) { idx = i; break; } }
    const f = FISH[idx]; const caught = store.get('fish', {}); caught[f[0]] = (caught[f[0]] || 0) + 1; store.set('fish', caught);
    toast(`${f[1]} ${f[0]}${idx >= 6 && idx <= 7 ? '… 꽝이에요' : '을(를) 낚았어요!'}  (${f[0]} ${caught[f[0]]}번째)`, 3200);
    doAct('fish', { f: idx }); playSplash(0.6); stopFishing(false);
  }
}
function stopFishing(clearTool = true) { fishing = null; bobber.visible = false; if (clearTool && me.tool === 'rod') setTool(null); else if (!clearTool) setTool(null); }
function updateFishing(dt, t) {
  if (!fishing) return;
  if (!near.fish() || me.tool !== 'rod') { stopFishing(); return; }
  fishing.t += dt;
  if (fishing.state === 'wait') { bobber.position.y = WATER_Y + 0.03 + Math.sin(t * 2) * 0.015; if (fishing.t > fishing.biteAt) { fishing.state = 'bite'; fishing.t = 0; say(me.label, '❗', true, 1100); playSplash(0.2); } }
  else { bobber.position.y = WATER_Y - 0.05 + Math.sin(t * 25) * 0.03; if (fishing.t > 1.1) { toast('놓쳤어요! 다시 기다려요'); fishing.state = 'wait'; fishing.t = 0; fishing.biteAt = rand(3, 9); } }
}

// 텐트
function enterTent(i) { me.tent = i; me.path = []; targetRing.visible = false; leaveSeat(); if (fishing) stopFishing(); setTool(null); $('tentView').classList.add('show'); sendPresence(); }
function exitTent() { if (me.tent == null) return; const t = TENTS[me.tent]; me.x = t.door.x; me.z = t.door.z; me.ry = t.ry; me.tent = null; $('tentView').classList.remove('show'); sendPresence(); }
$('tentExit').onclick = exitTent;

// 한잔 · 건배
function drinkAction() {
  if (me.tool !== 'cup') { setTool('cup'); toast('🍺 시원하게 한잔 들었어요. 옆 사람과 건배해봐요'); return; }
  let mate = null; for (const o of others.values()) if (o.p.tool === 'cup' && Math.hypot(o.cur.x - me.x, o.cur.z - me.z) < 3.2) { mate = o; break; }
  me.drinkT = 1.2;
  if (mate) { doAct('cheers'); playClink(me.x, me.z); toast(`${mate.p.nick}님과 건배! 🥂`); }
  else { doAct('drink'); toast('캬~ 🍺'); }
}

// 불꽃놀이
let lastFw = 0;
function fireworkAction() {
  if (me.tent != null) return;
  const now = performance.now(); if (now - lastFw < 2600) return; lastFw = now;
  const c = Math.floor(Math.random() * 8), s = Math.random() < 0.15 ? 2 : Math.floor(Math.random() * 4);
  if (connected) send({ type: 'act', k: 'firework', c, s }); else launchFirework(me.x, me.z, c, s);
  const n = store.get('fireworks', 0) + 1; store.set('fireworks', n);
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

// 불멍 모드
let bulmung = false;
function toggleBulmung() {
  if (!bulmung && !near.fire()) return walkNear(0, 0, '모닥불 가까이 가는 중…');
  bulmung = !bulmung; document.body.classList.toggle('bulmung', bulmung);
  document.querySelectorAll('.hud,.top-right,#mini,#log').forEach(el => el.style.opacity = bulmung ? '0' : '');
  if (bulmung) toast('🔥 불멍 중… 아무 데나 누르면 돌아와요', 2600);
}

// 별똥별 (분 단위로 모두 같은 시각에)
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

// 상황에 맞는 버튼들
const actionsEl = $('actions');
let actionsKey = '';
function btn(id, icon, label, opts = {}) { return { id, icon, label, ...opts }; }
function currentActions() {
  if (me.tent != null) return [];
  const list = [];
  const wishOn = performance.now() < wishUntil && near.hill();
  if (wishOn) list.push(btn('wish', '🌠', '소원 빌기', { hot: true }));
  if (near.fire()) {
    list.push(btn('log', '🪵', '장작'));
    list.push(btn('mallow', '🍡', roasting === 'stick' ? '굽는 중…' : '마시멜로', { hold: true, on: roasting === 'stick' }));
    list.push(btn('potato', '🍠', me.potato == null ? '고구마 묻기' : `고구마 꺼내기 ${Math.floor((performance.now() - me.potato) / 1000)}초`, { on: me.potato != null }));
    list.push(btn('bulmung', '🔥', bulmung ? '그만 보기' : '불멍', { on: bulmung }));
  }
  if (near.grill()) list.push(btn('meat', '🥩', roasting === 'meat' ? '굽는 중…' : '고기 굽기', { hold: true, on: roasting === 'meat' }));
  if (near.fish()) list.push(btn('fish', '🎣', !fishing ? '낚시하기' : fishing.state === 'bite' ? '지금 당겨!' : '기다리는 중…', { hot: fishing && fishing.state === 'bite', on: !!fishing }));
  const ti = near.tent(); if (ti >= 0) list.push(btn('tent', '⛺', '텐트에서 쉬기'));
  list.push(btn('drink', me.tool === 'cup' ? '🥂' : '🍺', me.tool === 'cup' ? '건배/마시기' : '한잔'));
  list.push(btn('firework', '🎆', '불꽃 쏘기'));
  list.push(btn('sparkler', '🎇', me.tool === 'sparkler' ? '불꽃 끄기' : '손불꽃', { on: me.tool === 'sparkler' }));
  if (me.tool && me.tool !== 'sparkler' && !roasting) list.push(btn('drop', '✋', '내려놓기'));
  return list;
}
function renderActions() {
  const list = currentActions();
  const key = list.map(b => b.id + b.label + (b.on ? 1 : 0) + (b.hot ? 1 : 0)).join('|');
  if (key === actionsKey) return; actionsKey = key;
  actionsEl.innerHTML = '';
  for (const b of list) {
    const el = document.createElement('button'); el.className = 'act panel' + (b.on ? ' on' : '') + (b.hot ? ' hot' : ''); el.type = 'button';
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
    case 'drink': return drinkAction();
    case 'firework': return fireworkAction();
    case 'sparkler': return setTool(me.tool === 'sparkler' ? null : 'sparkler');
    case 'drop': if (fishing) stopFishing(); return setTool(null);
    case 'wish': $('wishModal').classList.remove('hide'); $('wishIn').value = ''; setTimeout(() => $('wishIn').focus(), 50); return;
  }
}

// 몸짓
$('emoteBtn').onclick = () => $('emotes').classList.toggle('show');
$('emotes').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !me.seated) return; doAct(b.dataset.e); $('emotes').classList.remove('show'); });

// 채팅
$('chatForm').addEventListener('submit', e => {
  e.preventDefault(); const inp = $('chatIn'); const text = inp.value.trim(); if (!text || !me.seated) return;
  if (!connected) { toast('연결 중이에요. 잠시 후 다시 말해요'); return; }
  send({ type: 'chat', text }); inp.value = '';
  if (isTouch) inp.blur();
});

// =====================================================================
// 소리 (직접 합성)
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
  const dFire = Math.hypot(me.x, me.z), near = clamp(1 - dFire / 25, 0, 1);
  crackleGain.gain.setTargetAtTime(soundOn ? (0.03 + fireLevel * 0.06) * near * (me.tent != null ? 0.3 : 1) : 0, actx.currentTime, 0.3);
  rainGain.gain.setTargetAtTime(soundOn ? W.rain * (me.tent != null ? 0.16 : 0.07) : 0, actx.currentTime, 0.5);
  if (soundOn && Math.random() < dt * (2 + fireLevel * 8) * near) noiseHit(0.03, 1500 + Math.random() * 3000, (0.06 + fireLevel * 0.08) * near);
}
$('soundBtn').onclick = () => {
  initAudio(); soundOn = !soundOn; if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  $('soundBtn').classList.toggle('on', soundOn); $('soundBtn').textContent = soundOn ? '🔊' : '🔈'; store.set('sound', soundOn);
};

// =====================================================================
// 카메라 · 화면 조작
// =====================================================================
let zoom = store.get('zoom', 1);
const camTarget = new THREE.Vector3(0, 1, 6);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pointers = new Map(); let pinchStart = 0, pinchZoom = 1, downAt = null;
canvas.addEventListener('wheel', e => { e.preventDefault(); zoom = clamp(zoom * (e.deltaY > 0 ? 1.1 : 0.9), 0.45, 1.7); store.set('zoom', zoom); }, { passive: false });
canvas.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchStart = Math.hypot(a.x - b.x, a.y - b.y); pinchZoom = zoom; downAt = null; }
  else downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
  $('emotes').classList.remove('show');
});
canvas.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2 && pinchStart) { const [a, b] = [...pointers.values()]; zoom = clamp(pinchZoom * pinchStart / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 0.45, 1.7); }
});
canvas.addEventListener('pointerup', e => {
  pointers.delete(e.pointerId); if (pointers.size < 2) pinchStart = 0;
  if (!downAt) return; const d = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y); const quick = performance.now() - downAt.t < 600; downAt = null;
  if (d > 10 || !quick) return;
  if (bulmung) { toggleBulmung(); return; }
  onTap(e.clientX, e.clientY);
});
function onTap(x, y) {
  if (!me.seated || me.tent != null) return;
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); raycaster.setFromCamera(ndc, camera);
  const hd = raycaster.intersectObject(dog, true); if (hd.length) { dogPet = performance.now(); walkNear(DOG.x, DOG.z); return; }
  // 텐트 누르면 문 앞으로
  const hit = raycaster.intersectObject(groundMesh, false)[0];
  let px, pz;
  if (hit) { px = hit.point.x; pz = hit.point.z; }
  else { const pl = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.32), new THREE.Vector3()); if (!pl) return; px = pl.x; pz = pl.z; }
  if (onDock(px, pz) || (lakeE(px, pz) < 1.12 && Math.abs(pz - DOCK.z) < 1.4 && px > DOCK.x0 && px < DOCK.x1 + 1)) { walkTo(clamp(px, DOCK.x0, DOCK.x1 - 0.2), DOCK.z); return; }
  for (const t of TENTS) if (Math.hypot(px - t.x, pz - t.z) < 2) { walkTo(t.door.x, t.door.z); return; }
  walkTo(px, pz);
}
let skyLook = null;          // {x,y,z,until}
const camYaw = 0;           // 카메라는 남쪽에서 북쪽을 바라봐요
function lookSky(x, y, z, ms) { skyLook = { x, y, z, until: performance.now() + ms }; }
const _want = new THREE.Vector3(), _look = new THREE.Vector3();
function updateCamera(dt, t) {
  let tx = me.x, ty = walkH(me.x, me.z) + 1, tz = me.z;
  if (!me.seated) { const a = t * 0.05; camera.position.set(Math.sin(a) * 15, 7.5, Math.cos(a) * 15); camera.lookAt(0, 1.2, 0); return; }
  const portrait = camera.aspect < 0.8 ? 1.35 : 1;
  const onHill = near.hill();
  const z = zoom * portrait;
  const off = onHill ? new THREE.Vector3(0, 4.2 * z, 10 * z) : new THREE.Vector3(0, 9.5 * z, 11.5 * z);
  if (me.tent != null) { const tt = TENTS[me.tent]; tx = tt.x; tz = tt.z; ty = groundH(tt.x, tt.z) + 1; off.set(Math.sin(tt.ry) * 5, 3, Math.cos(tt.ry) * 5); }
  if (bulmung) {
    const a = Math.atan2(me.x, me.z), r = 3.8;
    _want.set(Math.sin(a) * r, 1.5, Math.cos(a) * r);
    camera.position.lerp(_want, Math.min(1, dt * 1.5)); camTarget.lerp(_look.set(0, 1.4 + fireLevel * 0.35, 0), Math.min(1, dt * 2));
    camera.lookAt(camTarget); return;
  }
  const sky = skyLook && performance.now() < skyLook.until && !me.moving && me.tent == null;
  if (sky) {
    // 하늘을 올려다봐요 (불꽃놀이 · 별똥별)
    _want.set(tx + (tx - skyLook.x) * 0.06, ty + 1.2, tz + 6 * portrait + (tz - skyLook.z) * 0.06);
    camera.position.lerp(_want, Math.min(1, dt * 2.2));
    camTarget.lerp(_look.set(skyLook.x, skyLook.y * 0.8, skyLook.z), Math.min(1, dt * 2.2));
    camera.lookAt(camTarget); return;
  }
  camTarget.lerp(_look.set(tx, ty, tz), Math.min(1, dt * 6));
  _want.copy(camTarget).add(off);
  camera.position.lerp(_want, Math.min(1, dt * 4));
  _look.copy(camTarget); _look.y += onHill ? 1.6 : 0.3; camera.lookAt(_look);
}

// =====================================================================
// 미니맵
// =====================================================================
const mini = $('mini'), mctx = mini.getContext('2d');
const MW = 280, MS = MW / 92;
const m2 = (x, z) => [MW / 2 + x * MS, MW / 2 + z * MS];
function drawMini() {
  mctx.clearRect(0, 0, MW, MW);
  mctx.save(); mctx.beginPath(); mctx.arc(MW / 2, MW / 2, MW / 2, 0, 7); mctx.clip();
  mctx.fillStyle = 'rgba(16,26,20,.88)'; mctx.fillRect(0, 0, MW, MW);
  mctx.strokeStyle = 'rgba(160,130,90,.6)'; mctx.lineWidth = 5; mctx.lineCap = 'round';
  for (const P of PATHS) { mctx.beginPath(); P.forEach(([x, z], i) => { const [a, b] = m2(x, z); i ? mctx.lineTo(a, b) : mctx.moveTo(a, b); }); mctx.stroke(); }
  mctx.fillStyle = 'rgba(40,80,130,.95)'; mctx.beginPath(); const [lx, lz] = m2(LAKE.x, LAKE.z); mctx.ellipse(lx, lz, LAKE.rx * MS, LAKE.rz * MS, 0, 0, 7); mctx.fill();
  mctx.font = '20px sans-serif'; mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
  const icon = (e, x, z) => { const [a, b] = m2(x, z); mctx.fillText(e, a, b); };
  icon('🔥', 0, 0); icon('🥩', GRILL.x, GRILL.z); icon('⛺', TENT_AREA.x, TENT_AREA.z); icon('🎣', FISH_SPOT.x, FISH_SPOT.z); icon('🌌', HILL.x, HILL.z); icon('🌲', 0, -26);
  for (const o of others.values()) { const [a, b] = m2(o.cur.x, o.cur.z); mctx.fillStyle = o.p.color; mctx.beginPath(); mctx.arc(a, b, 5, 0, 7); mctx.fill(); }
  if (me.seated) { const [a, b] = m2(me.x, me.z); mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.arc(a, b, 7, 0, 7); mctx.fill(); mctx.strokeStyle = me.color; mctx.lineWidth = 3; mctx.stroke(); }
  mctx.restore();
  mctx.strokeStyle = 'rgba(255,200,140,.3)'; mctx.lineWidth = 3; mctx.beginPath(); mctx.arc(MW / 2, MW / 2, MW / 2 - 2, 0, 7); mctx.stroke();
}
mini.addEventListener('click', e => {
  const r = mini.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * MW, py = (e.clientY - r.top) / r.height * MW;
  walkTo((px - MW / 2) / MS, (py - MW / 2) / MS);
});

// =====================================================================
// 초대 · 후원
// =====================================================================
$('inviteBtn').onclick = async () => {
  const url = location.origin + location.pathname;
  try { if (navigator.share) { await navigator.share({ title: '모닥불 캠핑장', text: '같이 불멍하러 올래? 🔥', url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('링크를 복사했어요. 친구에게 보내보세요'); } catch (e) { toast(url); }
};
fetch('/config.json').then(r => r.json()).then(c => { if (c && c.donateUrl) { const a = $('donateBtn'); a.href = c.donateUrl; a.style.display = ''; } }).catch(() => {});

// =====================================================================
// 입장
// =====================================================================
const sw = $('swatches');
COLORS.forEach(c => { const b = document.createElement('button'); b.style.background = c; b.setAttribute('aria-label', '색'); if (c === me.color) b.classList.add('sel'); b.onclick = () => { me.color = c; [...sw.children].forEach(x => x.classList.toggle('sel', x === b)); }; sw.appendChild(b); });
$('nickIn').value = me.nick;
function enter() {
  let n = $('nickIn').value.replace(/[<>]/g, '').trim();
  if (!n) n = ADJ[Math.floor(Math.random() * ADJ.length)] + ' ' + NOUN[Math.floor(Math.random() * NOUN.length)];
  me.nick = Array.from(n).slice(0, 10).join(''); store.set('nick', me.nick); store.set('color', me.color);
  const a = rand(0.6, 2.5), r = rand(4.4, 5.0); me.x = Math.cos(a) * r; me.z = Math.sin(a) * r; me.ry = Math.atan2(-me.x, -me.z);
  me.char = makeCharacter(me.color); scene.add(me.char.root); me.label = makeLabel(me.nick, true);
  me.seated = true; me.since = Date.now();
  camTarget.set(me.x, 1, me.z); camera.position.set(me.x, 12, me.z + 14);
  $('intro').classList.add('hide');
  if (store.get('sound', true)) { initAudio(); soundOn = true; if (actx && actx.state === 'suspended') actx.resume().catch(() => {}); $('soundBtn').classList.add('on'); $('soundBtn').textContent = '🔊'; }
  sendPresence(); updateCount();
  setTimeout(() => doAct('wave'), 500);
  setTimeout(() => toast(isTouch ? '땅을 톡 누르면 그쪽으로 걸어가요' : '땅을 클릭하면 걸어가요 · Enter로 말하기'), 1300);
  addLog('', '가까이 있는 사람에게만 말이 들려요. 서로 배려해요 🙂', true);
}
$('enterBtn').onclick = enter;
$('nickIn').addEventListener('keydown', e => { if (e.key === 'Enter') enter(); });

// =====================================================================
// 메인 루프
// =====================================================================
let lastT = performance.now(), miniAcc = 0, firstFrame = true;
function frame(nowP) {
  const dt = Math.min(0.1, (nowP - lastT) / 1000); lastT = nowP; const t = nowP / 1000;
  // 불은 서버와 같은 속도로 줄어요 (비·눈이면 더 빨리)
  const k = { clear: 1, cloudy: 1, fog: 1.2, snow: 1.8, rain: 3 }[weather.kind] || 1;
  fireLevel = Math.max(0.22, fireLevel - dt * 0.006 * k);
  if (roasting && me.roast != null) {
    const ok = roasting === 'stick' ? near.fire() : near.grill();
    if (ok) me.roast += dt * (roasting === 'stick' ? 0.12 + fireLevel * 0.12 : 0.16);
    if (Math.floor(me.roast * 10) !== Math.floor((me.roast - dt * 0.3) * 10)) sendPresence();
  }
  if (me.seated) {
    updateMe(dt); updateFishing(dt, t);
    me.drinkT = Math.max(0, me.drinkT - dt);
    animateCharacter(me.char, myState(t), dt, t);
    me.char.root.visible = me.tent == null;
    setPotato('me', me.potato != null);
  }
  for (const o of others.values()) {
    const st = updateOther(o, dt);
    const hidden = o.p.tent != null || muted.has(o.p.nick);
    o.char.root.visible = !hidden;
    if (!hidden) animateCharacter(o.char, st, dt, t);
    placeLabel(o.label, st.x, st.y + 2.15 - st.sitT * 0.3, st.z, !hidden);
  }
  if (me.seated) placeLabel(me.label, me.x, myState(t).y + 2.15 - (me.seat != null ? 0.3 : 0), me.z, me.tent == null);
  // 텐트 안에 누가 있으면 문이 은은하게 빛나요
  tentDoors.forEach((m, i) => { const occ = me.tent === i || [...others.values()].some(o => o.p.tent === i); m.color.setHex(occ ? 0x7a4a18 : 0x120c08); });
  // 강아지
  const pet = (performance.now() - dogPet) / 1000;
  dog.userData.tail.rotation.z = -1 + (pet < 3 ? Math.sin(t * 20) * 0.5 : Math.sin(t * 1.2) * 0.05);
  dog.userData.body.scale.y = 0.62 + Math.sin(t * 1.3) * 0.02;
  if (pet < 0.05) { const lb = { el: null }; }
  // 반딧불이
  { const pa = flyGeo.attributes.position.array, ca = flyGeo.attributes.color.array;
    flyData.forEach((f, i) => { pa[i * 3] = f.cx + Math.sin(t * f.sp + f.ph) * 2; pa[i * 3 + 1] = groundH(f.cx, f.cz) + f.h + Math.sin(t * f.sp * 2 + f.ph) * 0.4; pa[i * 3 + 2] = f.cz + Math.cos(t * f.sp * 0.8 + f.ph) * 2;
      const b = Math.max(0, Math.sin(t * 1.5 + f.ph * 3)) * (1 - W.rain) * (1 - W.snow * 0.5); ca[i * 3] = 0.75 * b; ca[i * 3 + 1] = 1 * b; ca[i * 3 + 2] = 0.35 * b; });
    flyGeo.attributes.position.needsUpdate = true; flyGeo.attributes.color.needsUpdate = true; }
  grillParts.coals.material.color.setHSL(0.04, 1, 0.45 + Math.sin(t * 5) * 0.05);
  if (Math.random() < dt * 4) emit(small, GRILL.x + rand(-0.3, 0.3), 1.1, GRILL.z + rand(-0.3, 0.3), rand(-0.2, 0.2), rand(0.5, 1.2), rand(-0.2, 0.2), 0x444444, 1.8, -0.2, 0.3);
  updateFire(dt, t); updateRockets(dt); updatePool(small, dt); updatePool(big, dt);
  updateCamera(dt, t);
  updateWeather(dt, t, camTarget.x, camTarget.z);
  updateShootingStar(); updateAudio(dt);
  moonGlint.material.opacity = 0.25 * moonMat.opacity;
  $('zone').textContent = me.seated ? zoneName() : '모닥불 캠핑장';
  if (me.seated) renderActions();
  miniAcc += dt; if (miniAcc > 0.2) { miniAcc = 0; drawMini(); }
  renderer.render(scene, camera);
  if (firstFrame) { firstFrame = false; $('loading').classList.add('hide'); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
connect();
