// 남편 개조 프로젝트 — 3D 집안일 게임 (혼자 / 부부 같이)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// =====================================================================
// 기본 도구
// =====================================================================
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const isTouch = matchMedia('(pointer:coarse)').matches;
const store = {
  get(k, d) { try { const v = localStorage.getItem('house.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('house.' + k, JSON.stringify(v)); } catch {} }
};
const params = new URLSearchParams(location.search);
let JOIN = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
let ROLE = 'solo';
let EP = 'sofa';           // 에피소드: sofa(1화) | drink(2화)
const EPISODES = {
  sofa: { no: 1, icon: '🛋️', name: '소파 일체형 남편', desc: '7일 안에 집안일 하는 남자로!', long: '소파와 한 몸이 된 남편을 칭찬·잔소리·치킨으로 꼬셔서 7일 안에 스스로 집안일 하는 남자로 개조해요.' },
  drink: { no: 2, icon: '🍺', name: '술고래 남편', desc: '7일 금주 달력 채우기', long: '매일 저녁 "한 잔만…"을 외치는 남편! 부장님 전화, 친구 단톡, 야구 중계 유혹을 막고 탄산수·산책·홈트로 버티게 해서 7일 금주 도장을 채워요.' },
  quit: { no: 3, icon: '💼', name: '회사 때려치겠다는 남편', desc: '멘탈·통장 지키며 7일 버티기', long: '퇴근할 때마다 "나 진짜 그만둘래…"를 외치는 남편! 매일 회사 사건에 어떻게 대답하느냐, 들어주기·도시락·가계부·부업 응원으로 멘탈과 통장을 어떻게 지키느냐에 따라 버티기·이직·부부 창업·퇴사 후 유튜버까지 엔딩이 갈려요.' }
};          // solo | wife | husband
let peerOn = false;

// =====================================================================
// 렌더러 · 빛
// =====================================================================
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
const PR = () => Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 2);
renderer.setPixelRatio(PR());
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0d14);
scene.fog = new THREE.FogExp2(0x0b0d14, 0.02);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 0.86); composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(PR()); renderer.setSize(w, h, false); composer.setPixelRatio(PR()); composer.setSize(w, h);
  bloom.resolution.set(w / 2, h / 2); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

scene.add(new THREE.HemisphereLight(0x7a88c0, 0x2a1d14, 1.15));
const ceil = new THREE.DirectionalLight(0xffd8b0, 1.15); ceil.position.set(3, 14, 6); ceil.castShadow = true; ceil.shadow.mapSize.set(3072, 3072);
Object.assign(ceil.shadow.camera, { left: -18, right: 18, top: 12, bottom: -12, near: 1, far: 45 }); ceil.shadow.bias = -0.0006; ceil.shadow.normalBias = 0.02; scene.add(ceil);
const lampL = new THREE.PointLight(0xffa860, 14, 11, 1.6); lampL.position.set(-6.3, 2.1, 2.5); scene.add(lampL);
const pendL = new THREE.PointLight(0xffc68a, 12, 10, 1.6); pendL.position.set(3, 2.3, -2.2); scene.add(pendL);
const tvL = new THREE.PointLight(0x6aa8ff, 5, 8, 1.6); tvL.position.set(-4, 1.3, -4.6); scene.add(tvL);
const bathL = new THREE.PointLight(0xcfe6ff, 5, 7, 1.7); bathL.position.set(5.8, 2.4, 4.8); scene.add(bathL);
const roomL = new THREE.PointLight(0xffb878, 10, 24, 1.3); roomL.position.set(0, 4.5, 0); scene.add(roomL);

// =====================================================================
// 텍스처 · 재질
// =====================================================================
function cTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(...rep); t.anisotropy = 4; return t;
}
const woodTex = cTex(256, 256, (g, w, h) => { const cols = ['#b07b4f', '#a8724a', '#b88457', '#a06b43']; for (let i = 0; i < 8; i++) { g.fillStyle = cols[i % 4]; g.fillRect(0, i * 32, w, 32); g.fillStyle = 'rgba(60,35,20,.35)'; g.fillRect(0, i * 32, w, 2); g.fillRect((i * 97) % 256, i * 32, 2, 32); } for (let k = 0; k < 200; k++) { g.fillStyle = `rgba(80,45,25,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, Math.random() * 40, 1); } }, [4, 3]);
const tileTex = cTex(128, 128, (g, w, h) => { g.fillStyle = '#e8e2d6'; g.fillRect(0, 0, w, h); g.fillStyle = '#d8cfbf'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h); g.fillRect(0, 63, w, 2); g.fillRect(63, 0, 2, h); }, [4, 3]);
const bathTex = cTex(64, 64, (g, w, h) => { g.fillStyle = '#bcdde4'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h); }, [8, 5]);
function wallTexOf(c1, c2) { return cTex(128, 128, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c2 : c1; g.fillRect(i * 16, 0, 16, h); } }, [20, 2]); }
const rugTex = cTex(128, 128, (g, w, h) => { g.fillStyle = '#b9504a'; g.fillRect(0, 0, w, h); g.globalAlpha = 0.55; g.fillStyle = '#e9a26a'; for (let i = 0; i < 8; i++) { g.fillRect(i * 16, 0, 8, h); g.fillRect(0, i * 16, w, 8); } }, [2, 1.5]);
const nightTex = cTex(128, 96, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#040814'); gr.addColorStop(1, '#1d2a4c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.8 + 0.2})`; g.fillRect(Math.random() * w, Math.random() * h * 0.7, 1, 1); }
  g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(96, 24, 9, 0, 7); g.fill();
  for (let i = 0; i < 9; i++) { const bh = 20 + Math.random() * 40; g.fillStyle = '#0a1020'; g.fillRect(i * 15, h - bh, 13, bh); g.fillStyle = '#ffd27a'; for (let k = 0; k < 8; k++) if (Math.random() < 0.5) g.fillRect(i * 15 + 2 + (k % 3) * 4, h - bh + 4 + Math.floor(k / 3) * 7, 2, 3); }
});
const MC = new Map(); const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!MC.has(k)) MC.set(k, new THREE.MeshLambertMaterial({ color: c, ...o })); return MC.get(k); };
const glow = c => new THREE.MeshBasicMaterial({ color: c });
const SOFT = cTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });

function M(geo, m, x, y, z, p) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; (p || scene).add(o); return o; }
const box = (w, h, d, c, x, y, z, p) => M(new THREE.BoxGeometry(w, h, d), typeof c === 'object' ? c : mat(c), x, y, z, p);
const cyl = (a, b, h, c, x, y, z, p, s = 16) => M(new THREE.CylinderGeometry(a, b, h, s), typeof c === 'object' ? c : mat(c), x, y, z, p);
const sph = (r, c, x, y, z, p) => M(new THREE.SphereGeometry(r, 14, 10), typeof c === 'object' ? c : mat(c), x, y, z, p);
const clickables = [], floors = [];
function G(action) { const g = new THREE.Group(); g.userData.action = action; scene.add(g); clickables.push(g); return g; }
function floorPlane(w, d, m, x, z, y = 0) { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); o.rotation.x = -Math.PI / 2; o.position.set(x, y, z); o.receiveShadow = true; scene.add(o); floors.push(o); return o; }

// =====================================================================
// 꾸미기 설정
// =====================================================================
const DECOR = {
  sofa: [[0x4a6aa8, '네이비'], [0x6f9a7a, '세이지'], [0xd9849a, '핑크'], [0xd9a23a, '머스터드']],
  wall: [['#e9d7c0', '#e3cfb6', '베이지'], ['#cfe6dc', '#c2ddd1', '민트'], ['#f3d3dc', '#ebc4cf', '핑크'], ['#3a4260', '#333a56', '밤하늘']],
  pj: [[0xb8bcc4, '회색 티'], [0x3f5fa8, '파란 츄리닝'], [0xc0463a, '빨간 티'], [0x3a6a4a, '군복 티']]
};
const UNLOCK = [0, 1, 3, 5];   // 엔딩을 몇 개 모으면 열리는지
let decor = store.get('decor', { sofa: 0, wall: 0, pj: 0 });

// =====================================================================
// 집
// =====================================================================
woodTex.repeat.set(8, 3); floorPlane(32, 12, new THREE.MeshLambertMaterial({ map: woodTex }), 0, 0);
floorPlane(8, 6, new THREE.MeshLambertMaterial({ map: tileTex }), 4, -3, 0.01);
floorPlane(4, 2.5, new THREE.MeshLambertMaterial({ map: bathTex }), 6, 4.75, 0.012);
floorPlane(3.6, 2.6, new THREE.MeshLambertMaterial({ map: rugTex }), -4, -0.6, 0.02);
floorPlane(2.4, 1.2, mat(0x6a5a4a), 0, 5.4, 0.015);           // 현관 매트
{ const o = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), mat(0x0b0d14)); o.rotation.x = -Math.PI / 2; o.position.y = -0.05; scene.add(o); }
const wallM = new THREE.MeshLambertMaterial({ map: wallTexOf(DECOR.wall[0][0], DECOR.wall[0][1]) });
box(32.4, 3.2, 0.3, wallM, 0, 1.6, -6.15); box(0.3, 3.2, 12.3, wallM, -16.15, 1.6, 0); box(0.3, 3.2, 5.9, wallM, 16.15, 1.6, -3.1);
box(32.4, 0.12, 0.32, 0x8a6040, 0, 0.06, -5.98); box(0.32, 0.12, 12.3, 0x8a6040, -15.98, 0.06, 0);
box(32.6, 0.35, 0.3, 0x3a2e26, 0, 0.17, 6.15);
function windowAt(x, y, z, ry, w, h) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: nightTex })); gl.position.z = 0.02; g.add(gl);
  const fm = mat(0xf4ece0); box(w + 0.16, 0.08, 0.1, fm, 0, h / 2, 0.04, g); box(w + 0.16, 0.08, 0.1, fm, 0, -h / 2, 0.04, g); box(0.08, h, 0.1, fm, -w / 2, 0, 0.04, g); box(0.08, h, 0.1, fm, w / 2, 0, 0.04, g); box(0.05, h, 0.06, fm, 0, 0, 0.05, g); box(w + 0.3, 0.06, 0.22, fm, 0, -h / 2 - 0.05, 0.1, g);
  const cur = mat(0xc9a3c8); box(0.35, h + 0.3, 0.06, cur, -w / 2 - 0.25, 0, 0.1, g); box(0.35, h + 0.3, 0.06, cur, w / 2 + 0.25, 0, 0.1, g);
}
windowAt(-15.99, 1.8, -4.1, Math.PI / 2, 1.6, 1.1); windowAt(-15.99, 1.8, 3.4, Math.PI / 2, 1.4, 1.0); windowAt(-9.7, 1.95, -5.99, 0, 1.3, 1.0); windowAt(4, 2.05, -5.99, 0, 1.6, 0.95); windowAt(-1.2, 1.85, -5.99, 0, 1.4, 1.1);
[[-6.5, 2.05, 0xffd166, 0x3f5fa8], [-5.6, 1.85, 0xf2b4bf, 0x5a8a6a]].forEach(([x, y, c, b]) => { box(0.7, 0.85, 0.06, 0x6a4a32, x, y, -5.98); box(0.56, 0.7, 0.03, c, x, y, -5.94); sph(0.12, b, x, y - 0.05, -5.92); });
const bulbs = [];
function bulbLine(pts, off) {
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3a2e2a })));
  pts.forEach((p, i) => { if (i % 2) return; const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), glow([0xffd27a, 0xffe7b0, 0xffb46a][i % 3])); b.position.copy(p).add(off); scene.add(b); bulbs.push(b); });
}
{ const a = [], b = []; for (let i = 0; i <= 52; i++) a.push(new THREE.Vector3(-15.6 + i * 0.6, 2.8 - Math.sin(i / 52 * Math.PI * 8) * 0.14, -5.92)); for (let i = 0; i <= 18; i++) b.push(new THREE.Vector3(-15.92, 2.8 - Math.sin(i / 18 * Math.PI * 3) * 0.14, -5.8 + i * 0.6));
  bulbLine(a, new THREE.Vector3(0, -0.07, 0.02)); bulbLine(b, new THREE.Vector3(0.02, -0.07, 0)); }

// --- 거실 ---
const couch = G('husband');
const sofaMat = new THREE.MeshLambertMaterial({ color: DECOR.sofa[0][0] }), sofa2Mat = new THREE.MeshLambertMaterial({ color: DECOR.sofa[0][0] });
box(3.2, 0.42, 1.15, sofaMat, -4, 0.33, 1.62, couch); box(3.2, 0.55, 0.3, sofa2Mat, -4, 0.6, 2.2, couch); box(0.32, 0.7, 1.2, sofa2Mat, -5.62, 0.5, 1.62, couch); box(0.32, 0.7, 1.2, sofa2Mat, -2.38, 0.5, 1.62, couch);
box(1.45, 0.14, 1, sofaMat, -4.75, 0.6, 1.55, couch); box(1.45, 0.14, 1, sofaMat, -3.25, 0.6, 1.55, couch);
[[-5.7, 1.1], [-2.3, 1.1], [-5.7, 2.25], [-2.3, 2.25]].forEach(([x, z]) => cyl(0.04, 0.03, 0.12, 0x2a2018, x, 0.06, z, couch, 6));
box(0.45, 0.36, 0.14, 0xe6b34a, -5.15, 0.82, 2.0, couch).rotation.z = 0.15;
box(0.5, 0.18, 0.4, 0xf6efe4, -4.95, 0.75, 1.55, couch);   // 베개
cyl(0.03, 0.03, 1.9, 0x2a2018, -6.3, 0.95, 2.5); cyl(0.22, 0.22, 0.04, 0x2a2018, -6.3, 0.02, 2.5);
cyl(0.22, 0.36, 0.38, new THREE.MeshLambertMaterial({ color: 0xfff0d0, emissive: 0xffa860, emissiveIntensity: 0.8 }), -6.3, 2.0, 2.5).castShadow = false;
box(1.8, 0.08, 0.9, 0x7a5236, -4, 0.44, -0.6); [[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]].forEach(([a, b]) => box(0.07, 0.4, 0.07, 0x5a3a26, -4 + a, 0.2, -0.6 + b));
box(0.3, 0.05, 0.2, 0xe2793a, -4.5, 0.5, -0.5); cyl(0.06, 0.05, 0.14, 0xf6f1ee, -4.2, 0.55, -0.75);
const remote = box(0.1, 0.04, 0.36, 0x22222a, -3.5, 0.5, -0.55);
cyl(0.06, 0.06, 0.12, 0xfbf6ec, -3.8, 0.54, -0.85); const flame = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), glow(0xffc070)); flame.scale.y = 1.8; flame.position.set(-3.8, 0.65, -0.85); scene.add(flame);
const chickenBox = new THREE.Group(); scene.add(chickenBox); box(0.6, 0.28, 0.5, 0xffb347, -4.15, 0.62, -0.65, chickenBox); box(0.62, 0.04, 0.52, 0xd9402f, -4.15, 0.78, -0.65, chickenBox); chickenBox.visible = false;
const tv = G('tv');
box(2.9, 0.5, 0.55, 0x5a3a26, -4, 0.25, -5.6, tv); box(2.4, 1.35, 0.1, 0x15151b, -4, 1.32, -5.7, tv);
const screenMat = new THREE.MeshBasicMaterial({ color: 0x5a8cff }); const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.24, 1.2), screenMat); screen.position.set(-4, 1.32, -5.64); tv.add(screen);
// 화분 (물 주기)
const plantG = G('plant');
cyl(0.2, 0.25, 0.4, 0xd9895b, -6.6, 0.2, -5.4, plantG);
const plantOk = new THREE.Group(); plantG.add(plantOk); sph(0.42, 0x3f7f4f, -6.6, 0.8, -5.4, plantOk); sph(0.3, 0x4f9a5f, -6.4, 1.1, -5.3, plantOk);
const plantSad = new THREE.Group(); plantG.add(plantSad); { const a = sph(0.38, 0x8a7a3a, -6.6, 0.7, -5.4, plantSad); a.scale.set(1.2, 0.7, 1.2); sph(0.18, 0x7a6a2a, -6.3, 0.55, -5.2, plantSad); }
box(0.5, 1.9, 1.6, 0x6a4a32, -7.72, 0.95, 0.6); [0.35, 0.95, 1.55].forEach(y => { for (let k = 0; k < 4; k++) box(0.3, 0.42, 0.25, pick([0xc0463a, 0x3f5fa8, 0xe6b34a, 0x5a8a6a, 0x8a5a9e]), -7.58, y + 0.2, 0.08 + k * 0.34); });

// --- 주방 ---
const sink = G('dish');
box(5, 0.88, 0.7, 0xe9e4da, 4.4, 0.44, -5.6, sink); box(5.1, 0.07, 0.78, 0x6a4a32, 4.4, 0.91, -5.6, sink);
box(1, 0.03, 0.5, 0x7d8790, 4, 0.95, -5.6, sink); cyl(0.03, 0.03, 0.38, 0xbfc6cf, 4, 1.13, -5.88, sink, 8);
for (let i = 0; i < 4; i++) box(0.04, 0.12, 0.04, 0x8a6040, 2.4 + i * 1.2, 0.7, -5.24, sink);
box(1.4, 0.7, 0.42, 0x7fa88f, 2.4, 2.35, -5.8, sink); box(1.2, 0.7, 0.42, 0x7fa88f, 5.9, 2.35, -5.8, sink);
const fridge = G('fridge'); box(1.1, 2.1, 0.8, 0xdfe6ec, 7.35, 1.05, -5.5, fridge); box(0.05, 0.5, 0.05, 0x8a949d, 6.85, 1.4, -5.08, fridge); box(0.05, 0.3, 0.05, 0x8a949d, 6.85, 0.55, -5.08, fridge); box(1.12, 0.02, 0.82, 0xb9c2ca, 7.35, 0.9, -5.5, fridge);
[0xff7a8a, 0xffd166, 0x7fb3ff].forEach((c, i) => box(0.12, 0.12, 0.02, c, 7.1 + i * 0.18, 1.65, -5.09, fridge));
box(2, 0.08, 1.2, 0x8b6a45, 3, 0.76, -2.2); [[-0.85, -0.5], [0.85, -0.5], [-0.85, 0.5], [0.85, 0.5]].forEach(([a, b]) => box(0.07, 0.72, 0.07, 0x5a3a26, 3 + a, 0.36, -2.2 + b));
[[2.4, -1.35, 0], [3.6, -1.35, 0], [2.4, -3.05, Math.PI], [3.6, -3.05, Math.PI]].forEach(([x, z, r]) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = r; scene.add(g); box(0.48, 0.06, 0.48, 0xe0743c, 0, 0.46, 0, g); box(0.48, 0.5, 0.06, 0xe0743c, 0, 0.72, 0.22, g); [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([a, b]) => box(0.05, 0.44, 0.05, 0x5a3a26, a, 0.22, b, g)); });
cyl(0.005, 0.005, 1, 0x222222, 3, 2.65, -2.2, null, 4); cyl(0.03, 0.03, 0.06, 0x2a2a2e, 3, 2.15, -2.2, null, 8);
{ const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), glow(0xffe0a8)); b.position.set(3, 2.03, -2.2); scene.add(b); }
cyl(0.16, 0.12, 0.22, 0xf2ece4, 3, 0.91, -2.2); sph(0.1, 0xd94040, 2.95, 1.05, -2.2); sph(0.1, 0xe6b34a, 3.08, 1.04, -2.15);

// --- 세탁 · 욕실 · 분리수거 · 청소기 ---
const washer = G('laundry');
box(1, 1, 0.95, 0xf2f2f0, 7.4, 0.5, 2.05, washer); box(1.02, 0.18, 0.97, 0xdcdcda, 7.4, 0.92, 2.05, washer);
{ const d = cyl(0.32, 0.32, 0.05, 0x2d3a4a, 6.88, 0.5, 2.05, washer, 20); d.rotation.z = Math.PI / 2; const r = cyl(0.36, 0.36, 0.03, 0xc9ced4, 6.9, 0.5, 2.05, washer, 20); r.rotation.z = Math.PI / 2; }
cyl(0.4, 0.32, 0.5, 0xc9935a, 7.4, 0.25, 3.0, washer, 12);
const bath = G('bath');
box(0.62, 0.42, 0.72, 0xf6f6f4, 6.6, 0.21, 5.45, bath); box(0.78, 0.62, 0.26, 0xf6f6f4, 6.6, 0.72, 5.86, bath); cyl(0.32, 0.32, 0.06, 0xe8e8e6, 6.6, 0.45, 5.4, bath, 18);
box(1.9, 0.6, 1, 0xf6f6f4, 4.9, 0.3, 5.4, bath); box(1.6, 0.04, 0.72, 0x7fc6dc, 4.9, 0.57, 5.4, bath);
box(0.8, 0.02, 0.5, 0xf2b4bf, 6.6, 0.025, 4.55, bath); box(0.6, 0.9, 0.45, 0xf6f6f4, 7.55, 0.45, 4.1, bath);
box(0.12, 1.1, 1.2, 0xe9d7c0, 3.95, 0.55, 5.4);
const bins = G('trash');
[0x3f8fd0, 0xe6b34a, 0x5aa86a].forEach((c, i) => { box(0.62, 0.82, 0.58, c, -7.42, 0.41, 3.4 + i * 0.78, bins); box(0.66, 0.06, 0.62, c, -7.42, 0.85, 3.4 + i * 0.78, bins); });
const vac = G('vacuum');
cyl(0.03, 0.03, 1.3, 0xff8fab, -0.2, 0.75, -5.75, vac, 6).rotation.x = 0.15; box(0.5, 0.12, 0.25, 0xd9586f, -0.2, 0.07, -5.65, vac); cyl(0.1, 0.1, 0.34, 0xffd1dc, -0.2, 0.95, -5.68, vac, 10);
// 현관 신발장
box(1.2, 0.8, 0.4, 0x7a5a3e, 2.9, 0.4, 5.75);

const mess = {};
// =====================================================================
// 새 방: 낮은 칸막이(카메라가 넘겨볼 수 있게) + 문
// =====================================================================
const partM = mat(0xe3cfb6), capM = mat(0x8a6040);
function partX(x, z0, z1) { const d = z1 - z0; box(0.16, 1.1, d, partM, x, 0.55, (z0 + z1) / 2); box(0.22, 0.06, d, capM, x, 1.13, (z0 + z1) / 2); }
function partZ(z, x0, x1) { const d = x1 - x0; box(d, 1.1, 0.16, partM, (x0 + x1) / 2, 0.55, z); box(d, 0.06, 0.22, capM, (x0 + x1) / 2, 1.13, z); }
partX(-8, -6, -3.4); partX(-8, -2.2, 1.8); partX(-8, 2.9, 6); partZ(1, -16, -8);
partX(8, -6, -3.4); partX(8, -2.2, 0); partX(8, 1.3, 6); partZ(-0.2, 8, 16);
function roomLight(c, i, x, y, z, d = 9) { const l = new THREE.PointLight(c, i, d, 1.6); l.position.set(x, y, z); scene.add(l); return l; }
function signAt(text, x, z, ry = 0) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = 'rgba(30,24,20,.85)'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#ffe2b0'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: t, transparent: true })); m.position.set(x, 1.32, z); m.rotation.y = ry; scene.add(m);
}

// ---- 안방 (x -16..-8, z -6..1) ----
floorPlane(8, 7, mat(0xc9a98a), -12, -2.5, 0.012);
floorPlane(3.4, 3.2, mat(0xd8c4b0), -12.5, -3.6, 0.02);
signAt('🛏️ 안방', -8, -2.8, Math.PI / 2);
const bedG = G('bed');
box(2.3, 0.35, 2.5, 0x6a4a32, -12.5, 0.18, -4.6, bedG); box(2.2, 0.2, 2.4, 0xf6f1ea, -12.5, 0.45, -4.6, bedG); box(2.4, 1.15, 0.14, 0x5a3a26, -12.5, 0.6, -5.85, bedG);
box(0.85, 0.16, 0.45, 0xffffff, -13.0, 0.62, -5.4, bedG); box(0.85, 0.16, 0.45, 0xffffff, -12.0, 0.62, -5.4, bedG);
const bedNeat = new THREE.Group(); bedG.add(bedNeat); box(2.25, 0.09, 1.6, 0xd27a9a, -12.5, 0.6, -4.2, bedNeat); box(2.25, 0.06, 0.3, 0xe9b0c4, -12.5, 0.66, -4.95, bedNeat);
const bedMess = new THREE.Group(); bedG.add(bedMess);
[[-13.1, -4.3, 0.5], [-12.3, -4.9, -0.4], [-11.9, -3.9, 1.1], [-12.7, -3.6, 0.3]].forEach(([x, z, r]) => { const b = box(0.9, 0.22, 0.75, 0xd27a9a, x, 0.65, z, bedMess); b.rotation.set(0.25, r, 0.18); });
[-14.1, -10.9].forEach(x => { box(0.7, 0.55, 0.6, 0x7a5236, x, 0.28, -5.55); cyl(0.05, 0.08, 0.3, 0x2a2018, x, 0.7, -5.55); cyl(0.14, 0.2, 0.2, new THREE.MeshLambertMaterial({ color: 0xfff0d0, emissive: 0xffb070, emissiveIntensity: 0.9 }), x, 0.92, -5.55).castShadow = false; });
const closetG = G('closet');
box(0.75, 2.2, 2.0, 0xb8946e, -15.6, 1.1, -1.6, closetG); box(0.04, 2.1, 0.02, 0x5a3a26, -15.22, 1.1, -1.6, closetG); [-1.7, -1.5].forEach(z => box(0.04, 0.25, 0.04, 0xd9c08a, -15.2, 1.1, z, closetG));
const closetMess = new THREE.Group(); closetG.add(closetMess);
[[-14.7, -2.2, 0x3f5fa8], [-14.4, -1.4, 0xe6b34a], [-14.8, -0.8, 0xffffff], [-14.2, -0.3, 0xc0463a]].forEach(([x, z, c], i) => { const b = box(0.55, 0.08 + (i % 2) * 0.06, 0.45, c, x, 0.06, z, closetMess); b.rotation.y = i * 0.8; });
box(0.9, 0.75, 0.45, 0x7a5236, -9.0, 0.38, -5.6); box(0.6, 0.7, 0.04, new THREE.MeshLambertMaterial({ color: 0xbcd6e8, emissive: 0x223344 }), -9.0, 1.15, -5.78);
roomLight(0xffb070, 9, -12.5, 2.3, -3.2);

// ---- 아이 방 (x -16..-8, z 1..6) ----
floorPlane(8, 5, mat(0xe9d9b0), -12, 3.5, 0.012);
{ const mt = cTex(128, 128, g => { const cs = ['#ff9aa8', '#ffd166', '#8bd17c', '#7fb3ff']; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = cs[(i + j) % 4]; g.fillRect(i * 32, j * 32, 32, 32); } }); floorPlane(2.6, 2.2, new THREE.MeshLambertMaterial({ map: mt }), -11.8, 3.6, 0.02); }
signAt('🧸 아이 방', -8, 2.35, Math.PI / 2);
box(1.1, 0.35, 1.9, 0xf6f6f4, -15.35, 0.18, 4.8); box(1.0, 0.12, 1.8, 0xfff4dc, -15.35, 0.42, 4.8); box(1.0, 0.08, 1.2, 0x7fb3ff, -15.35, 0.5, 5.05); box(1.1, 0.7, 0.1, 0xffd166, -15.35, 0.5, 3.85);
const toyShelf = G('toys'); box(1.7, 0.95, 0.4, 0xf6e6d6, -12, 0.48, 1.3, toyShelf); [0xff6b6b, 0x7fb3ff, 0x8bd17c].forEach((c, i) => box(0.3, 0.3, 0.28, c, -12.5 + i * 0.5, 1.1, 1.3, toyShelf));
mess.toys = new THREE.Group(); toyShelf.add(mess.toys);
[[-12.8, 3.1, 0xff6b6b], [-11.4, 4.2, 0x7fb3ff], [-10.6, 2.7, 0xffd166], [-13.3, 4.4, 0x8bd17c], [-12.1, 2.5, 0xb47ae8]].forEach(([x, z, c], i) => { const b = box(0.24, 0.24, 0.24, c, x, 0.12, z, mess.toys); b.rotation.y = i; });
sph(0.18, 0xff8a3d, -10.9, 0.18, 3.6, mess.toys); { const car = box(0.4, 0.15, 0.22, 0xd94040, -13.6, 0.1, 2.4, mess.toys); car.rotation.y = 0.7; }
{ const bear = new THREE.Group(); bear.position.set(-11.0, 0, 4.9); mess.toys.add(bear); sph(0.2, 0xb88a5a, 0, 0.2, 0, bear); sph(0.15, 0xb88a5a, 0, 0.48, 0, bear); sph(0.06, 0xb88a5a, -0.11, 0.6, 0, bear); sph(0.06, 0xb88a5a, 0.11, 0.6, 0, bear); }
mess.playkid = new THREE.Group(); scene.add(mess.playkid);
const nightL = roomLight(0xffd88a, 6, -13.5, 1.8, 3.8, 7);
{ const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), glow(0xffe08a)); st.position.set(-15.9, 2.2, 2.4); scene.add(st); }

// ---- 남편 방 / 게임방 (x 8..16, z -6..-0.2) ----
floorPlane(8, 5.8, mat(0x3a3d4a), 12, -3.1, 0.012);
floorPlane(2.6, 2.0, mat(0x5a2a6a), 12.6, -4.2, 0.02);
signAt('🎮 남편 방', 8, -2.8, -Math.PI / 2);
const gameG = G('ramen');
box(2.2, 0.08, 0.8, 0x2a2a30, 12.5, 0.76, -5.55, gameG); [-0.95, 0.95].forEach(a => box(0.08, 0.74, 0.7, 0x1a1a20, 12.5 + a, 0.37, -5.55, gameG));
const gameTex = cTex(128, 72, g => { const gr = g.createLinearGradient(0, 0, 128, 72); gr.addColorStop(0, '#2a1a6a'); gr.addColorStop(1, '#0a6a8a'); g.fillStyle = gr; g.fillRect(0, 0, 128, 72); g.fillStyle = '#ffd23a'; g.fillRect(20, 44, 14, 14); g.fillStyle = '#ff4f6a'; g.fillRect(80, 30, 16, 16); g.fillStyle = '#8bd17c'; g.fillRect(0, 60, 128, 12); g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.fillText('LV 99', 6, 14); });
[-0.55, 0.55].forEach((a, i) => { box(1.0, 0.6, 0.05, 0x111114, 12.5 + a, 1.25, -5.8, gameG).rotation.y = i ? -0.15 : 0.15; const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.52), new THREE.MeshBasicMaterial({ map: gameTex })); sc.position.set(12.5 + a, 1.25, -5.77); sc.rotation.y = i ? -0.15 : 0.15; scene.add(sc); });
box(0.4, 0.8, 0.8, 0x18181c, 14.0, 0.4, -5.5, gameG); const rgb = box(0.02, 0.7, 0.02, glow(0xff4fd8), 13.79, 0.4, -5.12, gameG); rgb.castShadow = false;
const chairG = new THREE.Group(); chairG.position.set(12.5, 0, -4.35); scene.add(chairG); box(0.6, 0.12, 0.6, 0xd9402f, 0, 0.48, 0, chairG); box(0.6, 0.85, 0.12, 0x1a1a20, 0, 0.95, 0.32, chairG); box(0.5, 0.5, 0.1, 0xd9402f, 0, 0.98, 0.31, chairG); cyl(0.05, 0.05, 0.4, 0x222222, 0, 0.22, 0, chairG, 8); cyl(0.3, 0.3, 0.04, 0x222222, 0, 0.03, 0, chairG, 10);
box(0.45, 1.8, 2.2, 0x2a2a30, 15.7, 0.9, -3.0); [0.5, 1.1, 1.6].forEach(y => { for (let k = 0; k < 3; k++) { const f = sph(0.1, pick([0xff4f6a, 0x4fd8ff, 0xffd23a, 0x8bd17c]), 15.6, y + 0.1, -3.7 + k * 0.6); f.scale.y = 1.6; } });
{ const pt = cTex(64, 90, g => { g.fillStyle = '#1a1030'; g.fillRect(0, 0, 64, 90); g.fillStyle = '#ff4fd8'; g.font = 'bold 20px sans-serif'; g.fillText('GAME', 6, 30); g.fillStyle = '#4fd8ff'; g.fillText('OVER', 6, 56); }); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.0), new THREE.MeshBasicMaterial({ map: pt })); m.position.set(10.0, 1.9, -5.98); scene.add(m); }
sph(0.5, 0x6a4a9a, 14.6, 0.3, -1.1).scale.set(1.2, 0.7, 1.2);
mess.ramen = new THREE.Group(); gameG.add(mess.ramen);
[[11.9, 0.88, -5.4], [13.1, 0.88, -5.6], [11.5, 0.1, -4.6], [13.6, 0.1, -3.9], [12.9, 0.1, -3.2]].forEach(([x, y, z], i) => { cyl(0.11, 0.09, 0.16, 0xfafafa, x, y, z, mess.ramen, 12); cyl(0.112, 0.112, 0.02, 0xd9402f, x, y + 0.07, z, mess.ramen, 12); });
[[12.2, -3.6], [11.2, -3.5], [14.2, -4.6]].forEach(([x, z], i) => { const c = cyl(0.05, 0.05, 0.16, [0xd9402f, 0x3f8fd0, 0x5aa86a][i], x, 0.05, z, mess.ramen, 8); c.rotation.z = Math.PI / 2; c.rotation.y = i; });
box(0.6, 0.05, 0.6, 0xc79c6e, 10.8, 0.03, -2.4, mess.ramen).rotation.y = 0.4;
const gameL = roomLight(0x9a70ff, 7, 12.5, 1.6, -4.6, 8); roomLight(0xff7ad8, 3, 14.2, 0.6, -4.8, 4);

// ---- 베란다 (x 8..16, z -0.2..6) ----
const balTex = cTex(64, 64, (g, w, h) => { g.fillStyle = '#8e9a96'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h); }, [8, 6]);
floorPlane(8, 6.2, new THREE.MeshLambertMaterial({ map: balTex }), 12, 2.9, 0.012);
signAt('🌙 베란다', 8, 0.65, -Math.PI / 2);
const railM = new THREE.MeshLambertMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.25 });
box(0.06, 1.0, 6.2, railM, 16, 0.5, 2.9); box(0.1, 0.06, 6.2, 0x9aa4ad, 16, 1.02, 2.9); box(8, 0.06, 0.1, 0x9aa4ad, 12, 1.02, 6.05); box(8, 1.0, 0.06, railM, 12, 0.5, 6.05);
const rackG = G('hang');
[[11.9, 2.6], [13.3, 2.6], [11.9, 3.4], [13.3, 3.4]].forEach(([x, z]) => cyl(0.02, 0.02, 1.3, 0xd8dde2, x, 0.65, z, rackG, 6));
[2.6, 3.4].forEach(z => cyl(0.015, 0.015, 1.4, 0xd8dde2, 12.6, 1.28, z, rackG, 6).rotation.z = Math.PI / 2);
const hung = new THREE.Group(); rackG.add(hung);
[[12.1, 2.6, 0xf2b4bf], [12.6, 2.6, 0x7fb3ff], [13.1, 2.6, 0xffffff], [12.3, 3.4, 0xe6b34a], [12.9, 3.4, 0x5aa86a]].forEach(([x, z, c]) => box(0.38, 0.5, 0.03, c, x, 1.0, z, hung));
mess.hang = new THREE.Group(); rackG.add(mess.hang);
cyl(0.4, 0.32, 0.45, 0x8ec5e8, 10.6, 0.23, 2.2, mess.hang, 12); [0xf2b4bf, 0x7fb3ff, 0xffffff, 0xe6b34a, 0x5aa86a].forEach((c, i) => sph(0.15, c, 10.45 + (i % 3) * 0.15, 0.5 + Math.floor(i / 3) * 0.1, 2.15 + (i % 2) * 0.1, mess.hang));
[[15.4, 0.6], [15.4, 1.5], [15.5, 5.3]].forEach(([x, z], i) => { cyl(0.22, 0.17, 0.35, 0xc97a52, x, 0.18, z); sph(0.3 + i * 0.05, [0x3f7f4f, 0x5aa86a, 0x4f9a5f][i], x, 0.62, z); });
{ const ch = new THREE.Group(); ch.position.set(14.2, 0, 4.6); ch.rotation.y = -0.8; scene.add(ch); box(0.5, 0.06, 0.5, 0x3f8fd0, 0, 0.42, 0, ch); box(0.5, 0.5, 0.06, 0x3f8fd0, 0, 0.68, 0.24, ch); [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]].forEach(([a, b]) => box(0.03, 0.42, 0.03, 0x222222, a, 0.21, b, ch)); }
roomLight(0x9fb4ff, 6, 12, 2.6, 3, 9);
// 베란다 밖 야경
for (let i = 0; i < 9; i++) { const h = 4 + Math.random() * 8, x = 19 + i * 2.2, z = -4 + (i % 3) * 4; const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, h, 1.8), new THREE.MeshBasicMaterial({ map: nightTex, color: 0x8899bb })); b.position.set(x, h / 2 - 2, z); scene.add(b); }

// =====================================================================
// 어질러진 것들
// =====================================================================
mess.dish = new THREE.Group(); sink.add(mess.dish);
for (let i = 0; i < 7; i++) cyl(0.21, 0.17, 0.035, i % 2 ? 0xf6f6f4 : 0xeae0cf, 4.6 + (i > 3 ? 0.55 : 0), 0.98 + (i % 4) * 0.045, -5.55, mess.dish);
sph(0.06, 0x8a5226, 4.65, 1.18, -5.5, mess.dish); cyl(0.07, 0.06, 0.17, 0xe6b34a, 5.3, 1.03, -5.45, mess.dish); cyl(0.05, 0.05, 0.2, 0x5aa86a, 3.3, 1.04, -5.5, mess.dish);
mess.laundry = new THREE.Group(); washer.add(mess.laundry);
[0xf2b4bf, 0x7fb3ff, 0xe6b34a, 0x5aa86a, 0xb47ae8, 0xf6f6f4, 0xc0463a].forEach((c, i) => sph(0.16, c, 7.25 + (i % 3) * 0.15, 0.52 + Math.floor(i / 3) * 0.13, 2.95 + (i % 2) * 0.12, mess.laundry));
box(0.25, 0.03, 0.12, 0x7fb3ff, 6.2, 0.02, 2.2, mess.laundry).rotation.y = 0.6; box(0.5, 0.03, 0.4, 0x8a5a9e, -1.8, 0.02, 2.6, mess.laundry).rotation.y = 0.3;
mess.bath = new THREE.Group(); scene.add(mess.bath); const stink = [];
for (let i = 0; i < 5; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: 0x9bd36a, transparent: true, opacity: 0.6, depthWrite: false })); s.scale.set(0.3, 0.3, 0.3); s.userData.ph = i * 1.1; mess.bath.add(s); stink.push(s); }
[[5.6, 4.25], [6.2, 4.9], [7.1, 4.3], [4.6, 4.4]].forEach(([x, z]) => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.16, 14), mat(0xa89270)); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); mess.bath.add(m); });
mess.trash = new THREE.Group(); bins.add(mess.trash);
[[-6.8, 3.25], [-6.6, 4.05], [-6.85, 4.85], [-6.55, 5.45], [-7, 2.7]].forEach(([x, z], i) => box(0.4, 0.28, 0.34, 0xb88a5a, x, 0.14, z, mess.trash).rotation.y = i * 0.7);
[[-6.35, 3.65], [-6.3, 4.6], [-7.1, 5.65]].forEach(([x, z]) => cyl(0.07, 0.07, 0.3, 0x6fbf8f, x, 0.07, z, mess.trash, 8).rotation.z = Math.PI / 2);
const DUST = [[-1, 0.6], [-1.8, -3.3], [-5.9, -3.1], [-6.6, -0.3], [-2.6, 3.7], [0.6, -1]];
mess.vacuum = G('vacuum'); const dusts = DUST.map(([x, z]) => { const d = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), new THREE.MeshLambertMaterial({ color: 0x9a928a, flatShading: true })); d.position.set(x, 0.13, z); d.castShadow = true; mess.vacuum.add(d); return d; });
mess.plant = plantSad; plantSad.visible = false; mess.bed = bedMess; mess.closet = closetMess;
mess.parcel = G('parcel'); [[-1.6, 5.3, 0.6, 0.45], [-1.0, 5.4, 0.5, 0.35], [-1.35, 5.3, 0.4, 0.3]].forEach(([x, z, s, h], i) => { const b = box(s, h, s * 0.8, i === 1 ? 0xc79c6e : 0xb88a5a, x, h / 2 + (i === 2 ? 0.45 : 0), z, mess.parcel); b.rotation.y = i * 0.4; box(s * 0.2, h + 0.01, s * 0.81, 0xe9e0c8, x, h / 2 + (i === 2 ? 0.45 : 0), z, mess.parcel).rotation.y = i * 0.4; });
mess.shoes = G('shoes'); [[0.8, 5.0, 0.4], [1.2, 5.5, -0.8], [1.7, 4.9, 1.9], [0.5, 5.6, 2.5], [2.0, 5.3, 0.2]].forEach(([x, z, r], i) => { const s = box(0.14, 0.1, 0.3, [0xffffff, 0x2a2a2a, 0xc0463a][i % 3], x, 0.05, z, mess.shoes); s.rotation.y = r; });

// =====================================================================
// 길찾기 (0.5m 격자 A*)
// =====================================================================
const CS = 0.5, GW = 64, GH = 24; const grid = new Uint8Array(GW * GH);
const RECTS = [[-5.8, -2.2, 1, 2.4], [-4.95, -3.05, -1.1, -0.1], [-5.5, -2.5, -6, -5.3], [1.9, 6.9, -6, -5.2], [6.8, 8, -6, -5.05], [1.95, 4.05, -3.4, -1], [6.85, 8, 1.57, 2.53], [6.95, 7.85, 2.6, 3.4], [6.25, 6.95, 5.05, 6], [3.9, 5.9, 4.85, 6], [3.85, 4.05, 4.75, 6], [7.3, 8, 3.85, 4.4], [-8, -7.05, 3.05, 5.75], [-8, -7.4, -0.25, 1.45], [-6.9, -6.3, -5.7, -5.1], [-6.5, -6.1, 2.3, 2.7], [-0.5, 0.1, -6, -5.45], [2.3, 3.5, 5.5, 6],
  [-8.08, -7.92, -6, -3.4], [-8.08, -7.92, -2.2, 1.8], [-8.08, -7.92, 2.9, 6], [-16, -8, 0.92, 1.08], [7.92, 8.08, -6, -3.4], [7.92, 8.08, -2.2, 0], [7.92, 8.08, 1.3, 6], [8, 16, -0.28, -0.12],
  [-13.7, -11.3, -6, -3.35], [-14.5, -13.7, -5.9, -5.2], [-11.3, -10.5, -5.9, -5.2], [-16, -15.2, -2.6, -0.6], [-9.5, -8.5, -6, -5.35], [-16, -14.75, 3.8, 5.8], [-12.9, -11.1, 1, 1.5],
  [11.4, 13.6, -6, -5.15], [13.8, 14.2, -5.9, -5.1], [15.45, 16, -4.1, -1.9], [14.0, 15.2, -1.6, -0.6], [11.85, 13.35, 2.55, 3.45], [10.2, 11.0, 1.8, 2.6], [15.2, 16, 0.3, 1.8], [15.2, 16, 5.0, 5.6], [13.85, 14.55, 4.25, 4.95]];
const PAD = 0.22;
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const x = -16 + (i + 0.5) * CS, z = -6 + (j + 0.5) * CS; let b = x < -15.7 || x > 15.7 || z < -5.75 || z > 5.8; for (const r of RECTS) if (x > r[0] - PAD && x < r[1] + PAD && z > r[2] - PAD && z < r[3] + PAD) b = true; grid[j * GW + i] = b ? 1 : 0; }
const ci = x => Math.floor((x + 16) / CS), cj = z => Math.floor((z + 6) / CS);
const blocked = (x, z) => { const i = ci(x), j = cj(z); return i < 0 || j < 0 || i >= GW || j >= GH || grid[j * GW + i] === 1; };
function nearestFree(x, z) { if (!blocked(x, z)) return [x, z]; for (let r = 1; r < 12; r++) for (let k = 0; k < 12 * r; k++) { const a = k / (12 * r) * 6.283, nx = x + Math.cos(a) * r * 0.3, nz = z + Math.sin(a) * r * 0.3; if (!blocked(nx, nz)) return [nx, nz]; } return [x, z]; }
function lineFree(ax, az, bx, bz) { const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.2); for (let k = 1; k <= n; k++) { const t = k / n; if (blocked(lerp(ax, bx, t), lerp(az, bz, t))) return false; } return true; }
function findPath(sx, sz, tx, tz) {
  [tx, tz] = nearestFree(tx, tz); if (blocked(sx, sz)) [sx, sz] = nearestFree(sx, sz);
  if (lineFree(sx, sz, tx, tz)) return [[tx, tz]];
  const s = cj(sz) * GW + ci(sx), goal = cj(tz) * GW + ci(tx), N = GW * GH;
  const gS = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N), open = [[0, s]]; gS[s] = 0;
  const h = n => Math.hypot(n % GW - goal % GW, ((n / GW) | 0) - ((goal / GW) | 0)); let found = false;
  while (open.length) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k; const [, cur] = open.splice(bi, 1)[0];
    if (cur === goal) { found = true; break; } if (closed[cur]) continue; closed[cur] = 1; const x0 = cur % GW, y0 = (cur / GW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = x0 + dx, ny = y0 + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue; const nb = ny * GW + nx; if (grid[nb]) continue;
      if (dx && dy && (grid[y0 * GW + nx] || grid[ny * GW + x0])) continue; const g = gS[cur] + (dx && dy ? 1.414 : 1); if (g < gS[nb]) { gS[nb] = g; came[nb] = cur; open.push([g + h(nb), nb]); }
    }
  }
  if (!found) return [[tx, tz]];
  const pts = []; for (let n = goal; n !== -1 && n !== s; n = came[n]) pts.push([-16 + (n % GW + 0.5) * CS, -6 + (((n / GW) | 0) + 0.5) * CS]); pts.reverse(); if (!pts.length) return [[tx, tz]]; pts[pts.length - 1] = [tx, tz];
  const out = []; let ax = sx, az = sz, k = 0; while (k < pts.length) { let far = k; for (let m = pts.length - 1; m > k; m--) if (lineFree(ax, az, pts[m][0], pts[m][1])) { far = m; break; } out.push(pts[far]); ax = pts[far][0]; az = pts[far][1]; k = far + 1; }
  return out;
}

// =====================================================================
// 사람 캐릭터 (머리 큰 2등신)
// =====================================================================
const PG = {
  head: new THREE.SphereGeometry(0.36, 26, 20), eye: new THREE.SphereGeometry(0.042, 10, 8), shine: new THREE.SphereGeometry(0.013, 6, 4), brow: new THREE.BoxGeometry(0.1, 0.022, 0.02),
  cheek: new THREE.SphereGeometry(0.05, 8, 6), ear: new THREE.SphereGeometry(0.07, 8, 6), nose: new THREE.SphereGeometry(0.025, 8, 6),
  body: new THREE.CylinderGeometry(0.19, 0.24, 0.42, 16), hip: new THREE.CylinderGeometry(0.24, 0.23, 0.12, 16), leg: new THREE.CylinderGeometry(0.085, 0.08, 0.3, 10), shoe: new THREE.BoxGeometry(0.14, 0.08, 0.24),
  sleeve: new THREE.CylinderGeometry(0.085, 0.075, 0.17, 10), arm: new THREE.CylinderGeometry(0.058, 0.055, 0.15, 8), hand: new THREE.SphereGeometry(0.068, 10, 8),
  cap: new THREE.SphereGeometry(0.385, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), smile: new THREE.TorusGeometry(0.055, 0.013, 6, 14, Math.PI), mo: new THREE.SphereGeometry(0.04, 10, 8), flat: new THREE.BoxGeometry(0.08, 0.016, 0.02),
  apron: new THREE.BoxGeometry(0.34, 0.46, 0.035), strap: new THREE.TorusGeometry(0.2, 0.012, 4, 16), band: new THREE.TorusGeometry(0.37, 0.035, 6, 26), cape: new THREE.PlaneGeometry(0.5, 0.72),
  phone: new THREE.BoxGeometry(0.08, 0.15, 0.018), shadow: new THREE.CircleGeometry(0.42, 20)
};
const shadowMat = new THREE.MeshBasicMaterial({ map: cTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }), transparent: true, depthWrite: false });
const PM = { eye: mat(0x1c1410), shine: glow(0xffffff), cheek: mat(0xf2a69a), mouth: mat(0x5a2a22), glove: mat(0xffd23a), cape: new THREE.MeshLambertMaterial({ color: 0xd9402f, side: THREE.DoubleSide }), apron: mat(0xf6e6d6), band: mat(0xffffff), phone: mat(0x22252e), screen: glow(0x8ec5ff) };
function camoTex(base) {
  const c = new THREE.Color(base), d = c.clone().multiplyScalar(0.6), l = c.clone().lerp(new THREE.Color(0xd8c8a0), 0.35);
  return cTex(64, 64, g => { g.fillStyle = '#' + c.getHexString(); g.fillRect(0, 0, 64, 64); for (let i = 0; i < 18; i++) { g.fillStyle = '#' + (i % 2 ? d : l).getHexString(); g.beginPath(); g.ellipse(Math.random() * 64, Math.random() * 64, 4 + Math.random() * 8, 3 + Math.random() * 5, Math.random() * 3, 0, 7); g.fill(); } });
}
function makePerson(o) {
  const root = new THREE.Group(); scene.add(root);
  const shadow = new THREE.Mesh(PG.shadow, shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; root.add(shadow);
  const inner = new THREE.Group(); root.add(inner);
  const skin = mat(o.skin), hair = mat(o.hair), pants = mat(o.pants), shoe = mat(o.shoe || 0xf4f4f0);
  const shirt = new THREE.MeshLambertMaterial({ color: o.shirt });
  const legs = [-0.1, 0.1].map(x => { const pv = new THREE.Group(); pv.position.set(x, 0.36, 0); const l = new THREE.Mesh(PG.leg, pants); l.position.y = -0.15; pv.add(l); const s = new THREE.Mesh(PG.shoe, shoe); s.position.set(0, -0.31, 0.03); pv.add(s); inner.add(pv); return pv; });
  const hip = new THREE.Mesh(PG.hip, pants); hip.position.y = 0.4; inner.add(hip);
  const body = new THREE.Mesh(PG.body, shirt); body.position.y = 0.66; inner.add(body);
  const hands = [];
  const arms = [-1, 1].map(s => { const pv = new THREE.Group(); pv.position.set(0.25 * s, 0.8, 0); const sl = new THREE.Mesh(PG.sleeve, shirt); sl.position.y = -0.07; pv.add(sl); const a = new THREE.Mesh(PG.arm, skin); a.position.y = -0.2; pv.add(a); const h = new THREE.Mesh(PG.hand, skin); h.position.y = -0.3; pv.add(h); hands.push(h); pv.rotation.z = 0.18 * s; inner.add(pv); return pv; });
  const headG = new THREE.Group(); headG.position.y = 1.2; inner.add(headG);
  headG.add(new THREE.Mesh(PG.head, skin));
  [-1, 1].forEach(s => { const e = new THREE.Mesh(PG.ear, skin); e.position.set(0.35 * s, -0.02, 0); e.scale.set(0.6, 1, 0.8); headG.add(e); });
  const cap = new THREE.Mesh(PG.cap, hair); cap.rotation.x = -0.32; cap.position.set(0, 0.02, -0.02); headG.add(cap);
  const fringe = new THREE.Mesh(PG.head, hair); fringe.scale.set(0.95, 0.32, 0.55); fringe.position.set(o.part ? 0.06 : 0, 0.24, 0.17); fringe.rotation.z = o.part ? -0.25 : 0; headG.add(fringe);
  if (o.style === 'long') { const back = new THREE.Mesh(PG.head, hair); back.scale.set(1.04, 1.25, 0.75); back.position.set(0, -0.12, -0.13); headG.add(back); [-1, 1].forEach(s => { const sd = new THREE.Mesh(PG.head, hair); sd.scale.set(0.3, 0.85, 0.42); sd.position.set(0.3 * s, -0.17, 0.02); headG.add(sd); }); }
  if (o.style === 'bun') { const b = new THREE.Mesh(PG.head, hair); b.scale.setScalar(0.38); b.position.set(0, 0.36, -0.15); headG.add(b); }
  if (o.style === 'spiky') { for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 5), hair); sp.position.set(-0.2 + k * 0.1, 0.36, -0.02); sp.rotation.z = (k - 2) * -0.25; headG.add(sp); } }
  const eyes = [-0.12, 0.12].map(x => { const e = new THREE.Mesh(PG.eye, PM.eye); e.position.set(x, 0.0, 0.33); e.scale.set(1, 1.35, 0.7); headG.add(e); const sh = new THREE.Mesh(PG.shine, PM.shine); sh.position.set(x + 0.014, 0.025, 0.37); headG.add(sh); return e; });
  const brows = [-0.12, 0.12].map((x, i) => { const b = new THREE.Mesh(PG.brow, hair); b.position.set(x, 0.11, 0.335); headG.add(b); return b; });
  const cheekM = PM.cheek.clone(); const cheeks = [-0.2, 0.2].map(x => { const c = new THREE.Mesh(PG.cheek, cheekM); c.position.set(x, -0.09, 0.29); c.scale.set(1, 0.6, 0.4); headG.add(c); return c; });
  const nose = new THREE.Mesh(PG.nose, skin); nose.position.set(0, -0.05, 0.36); headG.add(nose);
  const mouths = {
    smile: (() => { const m = new THREE.Mesh(PG.smile, PM.mouth); m.rotation.z = Math.PI; m.position.set(0, -0.12, 0.34); return m; })(),
    sad: (() => { const m = new THREE.Mesh(PG.smile, PM.mouth); m.position.set(0, -0.17, 0.335); return m; })(),
    open: (() => { const m = new THREE.Mesh(PG.mo, PM.mouth); m.scale.set(1, 1.2, 0.4); m.position.set(0, -0.15, 0.335); return m; })(),
    flat: (() => { const m = new THREE.Mesh(PG.flat, PM.mouth); m.position.set(0, -0.15, 0.345); return m; })()
  };
  for (const k in mouths) { mouths[k].visible = k === 'smile'; headG.add(mouths[k]); }
  // 소품 · 옷
  const phone = new THREE.Group(); { const p = new THREE.Mesh(PG.phone, PM.phone); phone.add(p); const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.065, 0.12), PM.screen); sc.position.z = 0.011; phone.add(sc); }
  phone.position.set(0, -0.36, 0.06); phone.rotation.x = -1.2; phone.visible = false; arms[1].add(phone);
  const mug = new THREE.Group(); { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.12, 12), mat(0xfff4dc)); mug.add(m); const hn = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.01, 12), glow(0xffc24a)); hn.position.y = 0.055; mug.add(hn); }
  mug.position.set(0, -0.38, 0.05); mug.visible = false; arms[1].add(mug);
  const apron = new THREE.Mesh(PG.apron, PM.apron); apron.position.set(0, 0.6, 0.215); apron.rotation.x = -0.1; apron.visible = false; inner.add(apron);
  const strap = new THREE.Mesh(PG.strap, PM.apron); strap.rotation.x = Math.PI / 2; strap.position.y = 0.6; strap.scale.set(1.1, 1.1, 1); strap.visible = false; inner.add(strap);
  const band = new THREE.Mesh(PG.band, PM.band); band.rotation.x = Math.PI / 2 - 0.25; band.position.y = 0.12; band.visible = false; headG.add(band);
  const cape = new THREE.Mesh(PG.cape, PM.cape); cape.position.set(0, 0.5, -0.24); cape.rotation.x = 0.18; cape.visible = false; inner.add(cape);
  root.traverse(m => { if (m.isMesh && m !== shadow) m.castShadow = true; });
  return { root, inner, legs, arms, hands, headG, eyes, brows, mouths, phone, mug, cheekM, cheeks, apron, strap, band, cape, shadow, skin, shirt, pants,
    phase: Math.random() * 6, path: [], speed: 2.8, moving: false, pose: 'idle', face: 'smile', onArrive: null, targetRy: null, gloves: false };
}
function setShirt(ch, color, camo) { if (camo) { ch.shirt.map = camoTex(color); ch.shirt.color.set(0xffffff); } else { ch.shirt.map = null; ch.shirt.color.set(color); } ch.shirt.needsUpdate = true; }
function setGloves(ch, on) { if (ch.gloves === on) return; ch.gloves = on; ch.hands.forEach(h => h.material = on ? PM.glove : ch.skin); }
function setFace(ch, f) { if (ch.face === f) return; ch.face = f; for (const k in ch.mouths) ch.mouths[k].visible = (k === (f === 'sleep' ? 'flat' : f === 'angry' ? 'flat' : f === 'shock' ? 'open' : f)); ch.brows.forEach((b, i) => { b.rotation.z = f === 'angry' ? (i ? 0.45 : -0.45) : f === 'sad' ? (i ? -0.35 : 0.35) : 0; b.position.y = f === 'shock' ? 0.14 : 0.11; }); }

const W = makePerson({ skin: 0xfbe3d0, hair: 0x5a3422, style: 'long', part: true, shirt: 0xe7a0b4, pants: 0xe9dcc4, shoe: 0xffffff });
W.speed = 3.4;
const H = makePerson({ skin: 0xf6dcc4, hair: 0x4a3326, style: 'short', shirt: 0xb8bcc4, pants: 0x2f3a56, shoe: 0xf4f4f0 });
H.speed = 2.5; H.root.userData.action = 'husband'; clickables.push(H.root);
const K = makePerson({ skin: 0xfbe3d0, hair: 0x3a2418, style: 'bun', shirt: 0xffd166, pants: 0xf2b4bf, shoe: 0xff8ab0 });
K.root.scale.setScalar(0.6); K.speed = 1.6; K.root.position.set(-12.6, 0, 4.0); K.root.rotation.y = 0.5;
const giftBox = new THREE.Group(); box(0.2, 0.16, 0.2, 0xff5a7a, 0, 0, 0, giftBox); box(0.21, 0.17, 0.04, 0xffd23a, 0, 0, 0, giftBox); box(0.04, 0.17, 0.21, 0xffd23a, 0, 0, 0, giftBox); giftBox.position.set(0, -0.42, 0.08); giftBox.visible = false; H.arms[1].add(giftBox);
const flowerP = new THREE.Group(); cyl(0.01, 0.01, 0.3, 0x3f7f4f, 0, 0, 0, flowerP, 5); sph(0.07, 0xff4f6a, 0, 0.17, 0, flowerP); sph(0.05, 0xffd23a, 0.06, 0.13, 0.02, flowerP); flowerP.position.set(0, -0.36, 0.08); flowerP.visible = false; H.arms[1].add(flowerP);
const COUCH_SIDE = [-1.75, 1.25];
function lieDown() { H.state = 'couch'; H.path = []; H.onArrive = null; H.pose = 'lie'; H.root.position.set(-2.8, 0.86, 1.48); H.root.rotation.set(0, 0, 0); H.inner.rotation.set(0, 0, Math.PI / 2); H.shadow.visible = false; H.idleT = 2; }
function standUp() { H.inner.rotation.set(0, 0, 0); H.root.position.set(COUCH_SIDE[0], 0, COUCH_SIDE[1]); H.shadow.visible = true; H.pose = 'idle'; H.phone.visible = false; }
function walk(ch, x, z, cb) { const p = findPath(ch.root.position.x, ch.root.position.z, x, z); ch.path = p; ch.onArrive = cb || null; if (!p.length && cb) cb(); }
function walkSeq(ch, pts, cb) { const go = k => { if (k >= pts.length) { cb && cb(); return; } walk(ch, pts[k][0], pts[k][1], () => { pts[k][2] && pts[k][2](); go(k + 1); }); }; go(0); }
function stepChar(ch, dt) {
  if (!ch.path.length) { ch.moving = false; return; }
  const [x, z] = ch.path[0], p = ch.root.position, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz), s = ch.speed * dt; ch.moving = true;
  let dr = Math.atan2(dx, dz) - ch.root.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); ch.root.rotation.y += dr * Math.min(1, dt * 12);
  if (d <= s) { p.x = x; p.z = z; ch.path.shift(); if (!ch.path.length) { ch.moving = false; const cb = ch.onArrive; ch.onArrive = null; cb && cb(); } } else { p.x += dx / d * s; p.z += dz / d * s; }
}
function faceTo(ch, x, z) { const p = ch.root.position; ch.targetRy = Math.atan2(x - p.x, z - p.z); }
function animPerson(ch, dt, t) {
  if (ch.targetRy != null && !ch.moving) { let dr = ch.targetRy - ch.root.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); ch.root.rotation.y += dr * Math.min(1, dt * 8); if (Math.abs(dr) < 0.01) ch.targetRy = null; }
  if (ch.moving) ch.phase += dt * 12; const sw = ch.moving ? Math.sin(ch.phase) : 0;
  const blink = Math.sin(t * 0.9 + ch.phase) > 0.993;
  if (ch.pose === 'lie') {
    const sub = ch.sub || 'tv';
    ch.legs.forEach((l, i) => l.rotation.x = Math.sin(t * 0.6 + i) * 0.06); ch.inner.position.y = Math.sin(t * 1.6) * 0.012;
    ch.arms[0].rotation.set(sub === 'yawn' ? -2.9 : sub === 'scratch' ? -0.5 + Math.sin(t * 12) * 0.25 : 0, 0, -0.18);
    ch.arms[1].rotation.set(sub === 'phone' ? -1.35 : sub === 'yawn' ? -2.9 : -0.25, 0, 0.18);
    ch.phone.visible = sub === 'phone';
    ch.headG.rotation.set(sub === 'phone' ? 0.25 : 0, 0, 0);
    const sleepy = sub === 'snore';
    ch.eyes.forEach(e => e.scale.y = sleepy || blink ? 0.15 : sub === 'yawn' ? 0.5 : 1.35);
    return;
  }
  ch.phone.visible = ch.pose === 'phone';
  ch.legs[0].rotation.x = sw * 0.75; ch.legs[1].rotation.x = -sw * 0.75;
  ch.inner.position.y = (ch.moving ? Math.abs(Math.cos(ch.phase)) * 0.06 : 0) + Math.sin(t * 1.6 + ch.phase % 3) * 0.006; ch.inner.rotation.z = ch.moving ? Math.sin(ch.phase) * 0.04 : 0;
  const A0 = ch.arms[0].rotation, A1 = ch.arms[1].rotation; A0.z = -0.18; A1.z = 0.18; ch.headG.rotation.set(0, 0, 0);
  switch (ch.pose) {
    case 'work': A0.x = -1.15 + Math.sin(t * 14) * 0.35; A1.x = -1.15 - Math.sin(t * 14) * 0.35; ch.headG.rotation.x = 0.3; ch.inner.position.y = Math.abs(Math.sin(t * 7)) * 0.03; break;
    case 'cheer': A0.x = -2.8 + Math.sin(t * 14) * 0.2; A1.x = -2.8 - Math.sin(t * 14) * 0.2; A0.z = -0.35; A1.z = 0.35; ch.headG.rotation.x = -0.15; ch.inner.position.y = Math.abs(Math.sin(t * 8)) * 0.08; break;
    case 'nag': A1.x = -1.7 + Math.sin(t * 16) * 0.35; A0.x = -0.2; A0.z = -0.9; ch.headG.rotation.x = -0.05; break;
    case 'sigh': A0.x = -0.25; A1.x = -0.25; ch.headG.rotation.x = 0.45 + Math.sin(t * 2) * 0.05; break;
    case 'heart': A0.x = -2.3; A1.x = -2.3; A0.z = 0.5; A1.z = -0.5; ch.headG.rotation.z = Math.sin(t * 4) * 0.12; break;
    case 'phone': A1.x = -1.3; A0.x = 0; ch.headG.rotation.x = 0.35; break;
    case 'wave': A1.x = -2.7 + Math.sin(t * 14) * 0.25; A1.z = 0.5; A0.x = 0; break;
    case 'sneak': A0.x = -0.9; A1.x = -0.9; ch.inner.rotation.x = 0.25; ch.headG.rotation.y = Math.sin(t * 3) * 0.6; break;
    case 'game': ch.legs[0].rotation.x = ch.legs[1].rotation.x = -1.45; ch.inner.position.y = 0.1; A0.x = -1.1 + Math.sin(t * 22) * 0.08; A1.x = -1.1 - Math.sin(t * 19) * 0.08; ch.headG.rotation.x = 0.05; break;
    case 'mug': A1.x = -1.25; A0.x = ch.moving ? -sw * 0.6 : 0; break;
    case 'smash': A1.x = -2.6 + Math.abs(Math.sin(t * 18)) * 2.2; A1.z = 0.6; A0.x = 0; break;
    case 'photo': A0.x = -1.5; A1.x = -1.5; ch.headG.rotation.x = 0.1; break;
    default: A0.x = ch.moving ? -sw * 0.6 : 0; A1.x = ch.moving ? sw * 0.6 : 0;
  }
  if (ch.pose !== 'sneak') ch.inner.rotation.x = 0;
  if (ch.drunk) { ch.inner.rotation.z += Math.sin(t * 2.6) * 0.16; ch.headG.rotation.z += Math.sin(t * 2.1) * 0.22; if (!ch.moving && ch.pose === 'idle') A1.x = -0.7 + Math.sin(t * 1.7) * 0.5; }
  ch.eyes.forEach(e => e.scale.y = blink || ch.face === 'sleep' ? 0.15 : ch.face === 'shock' ? 1.6 : ch.drunk ? 0.45 : 1.35);
}
const poseT = {};
function pose(ch, p, ms = 1800) { ch.pose = p; const k = ch === W ? 'w' : 'h'; clearTimeout(poseT[k]); poseT[k] = setTimeout(() => { if (ch.pose === p) ch.pose = 'idle'; }, ms); }
let faceTimers = {};
function emote(ch, f, ms = 2000) { setFace(ch, f); const k = ch === W ? 'w' : 'h'; clearTimeout(faceTimers[k]); ch.faceLock = performance.now() + ms; }

// =====================================================================
// 입자 · 소리
// =====================================================================
const parts = [];
function burst(x, y, z, n, color, spd = 1.5, size = 0.18, fromNet) {
  for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(size); s.position.set(x, y, z); s.userData = { v: new THREE.Vector3(rand(-1, 1) * spd, rand(0.5, 1.5) * spd, rand(-1, 1) * spd), life: rand(0.6, 1.1) }; scene.add(s); parts.push(s); }
  if (!fromNet) net({ k: 'fx', p: [x, y, z].map(v => Math.round(v * 100) / 100), n, c: color, s: spd, z: size });
}
const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 24), new THREE.MeshBasicMaterial({ color: 0xffd9a8, transparent: true, opacity: 0.6, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.visible = false; scene.add(ring);

let AC = null, muted = store.get('muted', false);
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } } if (AC.state === 'suspended') AC.resume(); return AC; }
function tone(f, dur, type = 'sine', vol = 0.12, when = 0, slide) {
  const a = ac(); if (!a || muted) return; const t0 = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(dur, vol = 0.06, freq = 1200, when = 0) {
  const a = ac(); if (!a || muted) return; const t0 = a.currentTime + when, n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(); src.buffer = buf; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8; const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(a.destination); src.start(t0); src.stop(t0 + dur + 0.05);
}
const SFX = {
  tap() { tone(700, 0.05, 'triangle', 0.06); },
  praise() { [660, 880, 1320].forEach((f, i) => tone(f, 0.2, 'sine', 0.1, i * 0.08)); },
  nag() { tone(190, 0.22, 'square', 0.05); tone(175, 0.22, 'square', 0.05, 0.13); },
  sigh() { noise(0.7, 0.07, 500); },
  ok() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, i * 0.09)); },
  no() { tone(420, 0.35, 'sawtooth', 0.045, 0, 160); },
  bell() { tone(880, 0.45, 'sine', 0.13); tone(660, 0.6, 'sine', 0.13, 0.35); },
  water() { for (let i = 0; i < 7; i++) noise(0.09, 0.05, 2400 + Math.random() * 800, i * 0.11); },
  vacuum() { noise(1.6, 0.045, 900); tone(140, 1.6, 'sawtooth', 0.015); },
  scrub() { noise(0.12, 0.05, 1800); },
  night() { [392, 494, 587].forEach(f => tone(f, 1.4, 'sine', 0.05)); },
  heart() { tone(988, 0.12, 'sine', 0.09); tone(1318, 0.2, 'sine', 0.09, 0.1); },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.35, 'triangle', 0.1, i * 0.12)); },
  door() { tone(330, 0.15, 'square', 0.04); tone(250, 0.2, 'square', 0.04, 0.12); },
  hic() { tone(520, 0.09, 'square', 0.05, 0, 950); },
  smack() { noise(0.12, 0.22, 2500); tone(120, 0.14, 'sine', 0.16); },
  camera() { noise(0.05, 0.16, 4000); noise(0.08, 0.1, 2000, 0.08); }
};
function sfx(k, fromNet) { SFX[k] && SFX[k](); if (!fromNet) net({ k: 'sfx', s: k }); }
addEventListener('pointerdown', () => ac(), { once: true });

// =====================================================================
// 머리 위 표시 · 말풍선
// =====================================================================
function makeTag(name, me) {
  const el = document.createElement('div'); el.className = 'tag' + (me ? ' me' : '');
  el.innerHTML = '<div class="bubble"></div><div class="state"></div><div class="name"><i></i><span></span><div class="bar"><b></b></div><em></em></div>';
  $('labels').appendChild(el);
  return { el, bubble: el.querySelector('.bubble'), state: el.querySelector('.state'), barWrap: el.querySelector('.bar'), bar: el.querySelector('.bar b'), num: el.querySelector('.name em'), role: el.querySelector('.name i'), name: el.querySelector('.name span'), until: 0 };
}
const WL = makeTag('', false), HL = makeTag('', false), KL = makeTag('', false);
for (const L of [WL, KL]) { L.state.remove(); L.barWrap.remove(); L.num.remove(); L.state = null; }
KL.el.classList.add('kid'); KL.role.textContent = '아이'; KL.role.style.background = '#e9a23a'; KL.name.textContent = '우리 딸';
function setTags() {
  WL.role.textContent = ROLE === 'husband' ? '아내' : '나'; WL.name.textContent = '아내';
  HL.role.textContent = ROLE === 'husband' ? '나' : '남편'; HL.name.textContent = PERS[S ? S.pers : 'lazy'].short;
  WL.el.classList.toggle('me', ROLE !== 'husband'); HL.el.classList.toggle('me', ROLE === 'husband');
}
function say(ch, text, emo = false, ms, fromNet) {
  const L = ch === W ? WL : ch === K ? KL : HL; L.bubble.textContent = text; L.bubble.classList.toggle('emo', emo); L.bubble.classList.add('show');
  L.until = performance.now() + (ms || (emo ? 2200 : clamp(2200 + text.length * 90, 2800, 5200)));
  if (!fromNet && ch !== K) net({ k: 'say', w: ch === W ? 'W' : 'H', t: text, e: emo ? 1 : 0 });
}
const _p = new THREE.Vector3(), _v = new THREE.Vector3();
function placeTag(L, ch) {
  ch.headG.getWorldPosition(_p); _p.y += (ch.pose === 'lie' ? 0.5 : 0.48) * ch.root.scale.y; _p.project(camera);
  L.vis = !(_p.z > 1 || !ch.root.visible); const ox = (_p.x * 0.5 + 0.5) * innerWidth, oy = (-_p.y * 0.5 + 0.5) * innerHeight; if (ox < -20 || ox > innerWidth + 20 || oy < 0 || oy > innerHeight + 40) L.vis = false; L.sx = (_p.x * 0.5 + 0.5) * innerWidth; L.sy = (-_p.y * 0.5 + 0.5) * innerHeight;
  if (L.until && performance.now() > L.until) { L.bubble.classList.remove('show'); L.until = 0; }
}
// 머리 위 표시가 겹치면 옆으로 밀어내기
function placeTags() {
  placeTag(WL, W); placeTag(HL, H); placeTag(KL, K);
  const Ls = [HL, WL, KL].filter(L => L.vis);
  for (let i = 0; i < Ls.length; i++) for (let j = i + 1; j < Ls.length; j++) {
    const a = Ls[i], b = Ls[j], dx = b.sx - a.sx, dy = b.sy - a.sy, need = 150;
    if (Math.abs(dx) < need && Math.abs(dy) < 80) { const push = (need - Math.abs(dx)) / 2, sgn = dx >= 0 ? 1 : -1; a.sx -= push * sgn; b.sx += push * sgn; }
  }
  for (const L of [WL, HL, KL]) { if (!L.vis) { L.el.style.display = 'none'; continue; } L.el.style.display = ''; const hw = (L.el.offsetWidth || 140) / 2 + 6, x = clamp(L.sx, hw, innerWidth - hw); L.el.style.transform = `translate(${x.toFixed(1)}px,${L.sy.toFixed(1)}px) translate(-50%,-100%)`; }
}
function floatAt(ch, text, color, fromNet) {
  ch.headG.getWorldPosition(_p); _p.y += 0.5; _p.project(camera);
  const d = document.createElement('div'); d.className = 'float'; d.textContent = text; d.style.color = color; d.style.left = ((_p.x * 0.5 + 0.5) * innerWidth) + 'px'; d.style.top = ((-_p.y * 0.5 + 0.5) * innerHeight - 70) + 'px';
  document.body.appendChild(d); setTimeout(() => d.remove(), 1200);
  if (!fromNet) net({ k: 'fl', w: ch === W ? 'W' : 'H', t: text, c: color });
}
let toT; function toast(m, ms = 2800) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toT); toT = setTimeout(() => t.classList.remove('show'), ms); }

// =====================================================================
// 게임 규칙
// =====================================================================
const AP_MAX = 7;
const PERS = {
  lazy: { icon: '😴', name: '게으른 남편', short: '게으른 남편', desc: '뭐든 보통이에요. 처음이라면 이 남편!', hair: 0x4a3326, style: 'short', m: {} },
  sly: { icon: '🦊', name: '눈치 빠른 남편', short: '눈치백단 남편', desc: '칭찬에 약하지만 한숨 연기는 금방 들켜요', hair: 0x7a4a26, style: 'spiky', m: { praise: 1.3, caught: 0.6, nagRes: 1.2 } },
  sulky: { icon: '😤', name: '잘 삐지는 남편', short: '삐돌이 남편', desc: '잔소리하면 크게 삐져요. 대신 치킨이면 끝!', hair: 0x1e1a1a, style: 'short', m: { nagRes: 2, chicken: 1.6, together: 1.3 } },
  sweet: { icon: '🐶', name: '순한 남편', short: '순둥이 남편', desc: '뭐든 잘 들어줘요. 쉬움 모드', hair: 0x8a5a2a, style: 'short', m: { all: 1.2, resMult: 0.7 } }
};
const BASE = [
  { id: 'trash', room: '거실', icon: '♻️', name: '분리수거', req: 20, gain: 8, spot: [-6.55, 4.3], look: [-7.4, 4.3], wife: [-6.2, 3.3], fx: 0xd8c8a0, snd: 'scrub' },
  { id: 'dish', room: '주방', icon: '🍽️', name: '설거지', req: 30, gain: 10, spot: [4.2, -4.75], look: [4.2, -6], wife: [5.1, -4.7], fx: 0x8ecfff, snd: 'water' },
  { id: 'laundry', room: '세탁실', icon: '👕', name: '빨래 돌리기', req: 40, gain: 12, spot: [6.35, 2.05], look: [7.4, 2.05], wife: [6.0, 3.0], fx: 0xffffff, snd: 'scrub' },
  { id: 'vacuum', room: '거실', icon: '🌀', name: '청소기', req: 50, gain: 15, spot: [-0.2, -4.85], look: [-0.2, -6], wife: [-3, -2.3], fx: 0xd8d0c8, snd: 'vacuum' },
  { id: 'bath', room: '욕실', icon: '🚽', name: '화장실 청소', req: 65, gain: 20, spot: [6.6, 4.55], look: [6.6, 6], wife: [5.2, 4.3], fx: 0x8ecfff, snd: 'water' },
  { id: 'bed', room: '안방', icon: '🛏️', name: '이불 개기', req: 22, gain: 8, spot: [-12.5, -2.85], look: [-12.5, -4.6], wife: [-11.2, -2.6], fx: 0xffd0e0, snd: 'scrub' },
  { id: 'toys', room: '아이 방', icon: '🧸', name: '장난감 정리', req: 28, gain: 9, spot: [-12, 2.2], look: [-12, 1.2], wife: [-10.8, 2.4], fx: 0xffd166, snd: 'scrub' },
  { id: 'playkid', room: '아이 방', icon: '👧', name: '아이랑 놀아주기', req: 40, gain: 13, spot: [-11.2, 3.7], look: [-12.2, 3.7], wife: [-10.2, 4.6], fx: 0xff9ab0, snd: 'heart' },
  { id: 'ramen', room: '남편 방', icon: '🍜', name: '컵라면 치우기', req: 25, gain: 8, spot: [12.4, -3.5], look: [12.5, -5.5], wife: [11.2, -3.0], fx: 0xffd0a0, snd: 'scrub' },
  { id: 'hang', room: '베란다', icon: '👚', name: '빨래 널기', req: 35, gain: 10, spot: [11.4, 3.0], look: [12.6, 3.0], wife: [10.6, 4.2], fx: 0xbfe6ff, snd: 'scrub' }
];
const EXTRAS = [
  { id: 'plant', room: '거실', icon: '🪴', name: '화분 물주기', req: 18, gain: 7, spot: [-6.05, -4.6], look: [-6.6, -5.4], wife: [-5.2, -4.2], fx: 0x8ecfff, snd: 'water', extra: true },
  { id: 'parcel', room: '현관', icon: '📦', name: '택배 정리', req: 25, gain: 8, spot: [-1.3, 4.55], look: [-1.3, 5.4], wife: [-0.3, 4.4], fx: 0xd8c8a0, snd: 'scrub', extra: true },
  { id: 'shoes', room: '현관', icon: '👟', name: '신발 정리', req: 15, gain: 6, spot: [1.3, 4.6], look: [1.3, 5.5], wife: [2.3, 4.4], fx: 0xffffff, snd: 'scrub', extra: true },
  { id: 'closet', room: '안방', icon: '👔', name: '옷장 정리', req: 30, gain: 9, spot: [-14.4, -1.5], look: [-15.6, -1.5], wife: [-13.4, -0.6], fx: 0xffffff, snd: 'scrub', extra: true }
];
const ALL = Object.fromEntries(BASE.concat(EXTRAS).map(c => [c.id, c]));
const todays = () => S ? BASE.concat(S.extra ? [ALL[S.extra]] : []) : BASE;
const EVENTS = [
  { t: '🌙 평범한 저녁. 남편이 소파와 한 몸이 됐어요.' },
  { t: '⚽ 축구 중계날! 의욕이 절반만 올라요. 리모컨을 숨기면 풀려요', tv: true },
  { t: '🎮 게임 업데이트 날… 시작 의욕 -10', f() { S.mot = clamp(S.mot - 10, 0, 100); } },
  { t: '💸 월급날! 기분 최고, 시작 의욕 +20', f() { S.mot = clamp(S.mot + 20, 0, 100); } },
  { t: '👵 시어머니 방문 예고! 오늘 화장실 청소가 쉬워져요', f() { S.mod.bath = -25; } },
  { t: '🍺 어제 회식… 숙취로 행동력 -1', f() { S.ap--; } },
  { t: '🌧️ 비 오는 밤. "이불 밖은 위험해" 시작 의욕 -8', f() { S.mot = clamp(S.mot - 8, 0, 100); } },
  { t: '🍺 회식 날! 남편이 술 먹고 들어온대요…', drunk: true }
];
function pickEvent() { const pool = EVENTS.concat(EVENTS.filter(e => e.drunk)).filter(e => !(e.drunk && peerOn)); return pick(pool); }
const ENDINGS = [
  { id: 'legend', icon: '🦸', name: '전설의 남편', hint: '개조율 100%' },
  { id: 'speed', icon: '⚡', name: '초고속 개조', hint: '5일 안에 100%' },
  { id: 'couple', icon: '💑', name: '우리는 한 팀', hint: '부부 같이 하기로 100%' },
  { id: 'almost', icon: '😎', name: '거의 개조됨', hint: '7일 뒤 70% 이상' },
  { id: 'half', icon: '🙂', name: '반쯤 개조됨', hint: '7일 뒤 40% 이상' },
  { id: 'sofa', icon: '🛋️', name: '소파 일체형', hint: '7일 뒤 40% 미만' },
  { id: 'runaway', icon: '🏃', name: 'PC방 가출', hint: '반발심 100' },
  { id: 'chicken', icon: '🍗', name: '치킨으로 키운 남편', hint: '치킨 5번 이상 시키고 끝내기' },
  { id: 'self', icon: '🙋', name: '스스로 하는 남자', hint: '부부 모드에서 남편이 스스로 3번' },
  { id: 'drunk', icon: '🍯', name: '취객 조련사', hint: '술 취한 남편을 소파에 재우기' },
  { id: 'd7', ep: 'drink', icon: '🍀', name: '7일 금주 성공', hint: '2화 · 금주 도장 7개' },
  { id: 'd5', ep: 'drink', icon: '😌', name: '거의 금주', hint: '2화 · 금주 도장 5~6개' },
  { id: 'd3', ep: 'drink', icon: '🙂', name: '반쯤 참았어요', hint: '2화 · 금주 도장 3~4개' },
  { id: 'dwhale', ep: 'drink', icon: '🐳', name: '술고래 그대로', hint: '2화 · 금주 도장 2개 이하' },
  { id: 'dgym', ep: 'drink', icon: '💪', name: '홈트 중독', hint: '2화 · 홈트 5번 이상' },
  { id: 'q_stay', ep: 'quit', icon: '🏢', name: '웃으며 출근', hint: '3화 · 안 그만두고 멘탈 50 이상' },
  { id: 'q_burn', ep: 'quit', icon: '😵', name: '번아웃 직장인', hint: '3화 · 안 그만뒀지만 멘탈 바닥' },
  { id: 'q_move', ep: 'quit', icon: '🚀', name: '더 좋은 곳으로 이직', hint: '3화 · 헤드헌터 제안 + 멘탈 지키기' },
  { id: 'q_startup', ep: 'quit', icon: '💑', name: '부부 창업 대박', hint: '3화 · 사표 내고 부업 70 이상' },
  { id: 'q_rest', ep: 'quit', icon: '🌴', name: '한 달 쉬어가기', hint: '3화 · 사표 내고 통장·멘탈 넉넉' },
  { id: 'q_youtube', ep: 'quit', icon: '📹', name: '퇴사 후 유튜버 (구독자 12명)', hint: '3화 · 사표 내고 아무 준비 없이…' }
];
let S = null;
function reqOf(c) { let r = c.req - (S.habit[c.id] || 0) * 10 + (S.mod[c.id] || 0); if (S.together) r -= 25; return clamp(r, 5, 100); }
function pm(k, d = 1) { const m = PERS[S.pers].m; return (m[k] ?? d) * (m.all && (k === 'praise' || k === 'nag' || k === 'sigh' || k === 'chicken' || k === 'together') ? m.all : 1); }

function newGame(pers) {
  S = { day: 1, ap: AP_MAX, mot: 15, res: 5, hab: 0, used: {}, habit: {}, mod: {}, done: {}, tvOff: false, together: false, tv: false, over: false, busy: false, pers, extra: null, chickens: 0, selfCount: 0, pending: null, accepted: null, stage: 0, ending: null, gifted: {}, ep: EP, crave: 35, will: 15, cal: [], clock: 0, hidden: false, tempt: null, relapsed: false, workouts: 0, mental: 45, urge: 30, money: 300, side: 0, quit: false, offer: false, quitDay: 0, storyUsed: [], tripped: false };
  applyPers(); applyDecor(); H.root.visible = true; setGloves(H, false); updateOutfit(true); startDay(true);
}
function applyPers() { const P = PERS[S.pers]; H.headG.children.forEach(m => { if (m.material === undefined) return; }); hairColor(H, P.hair); setTags(); }
function hairColor(ch, c) { ch.headG.traverse(m => { if (m.isMesh && m.material && m.material.color && m.material.userData.hair) m.material.color.set(c); }); }
function startDay(first) {
  Object.assign(S, { ap: AP_MAX, used: {}, mod: {}, done: {}, tvOff: false, together: false, tv: false, busy: false, pending: null, accepted: null, drunk: 0, slept: false, gifted: {} });
  drunkMess.clear(); H.drunk = false; H.drunkHold = false; H.speed = 2.5; H.cheekM.color.copy(PM.cheek.color); H.cheeks.forEach(c => c.scale.set(1, 0.6, 0.4)); H.mug.visible = W.mug.visible = false; H.root.visible = true;
  if (EP === 'drink') { startDrinkDay(first); return; }
  if (EP === 'quit') { startQuitDay(first); return; }
  tie.visible = false;
  beerG.visible = false;
  if (!first) S.mot = Math.round(S.mot * 0.3) + 12;
  const e = first ? EVENTS[0] : pickEvent(); if (e.tv) S.tv = true; if (e.f) e.f();
  let yday = '';
  if (!first && S.tomorrow) { const tm = S.tomorrow; S.mot = clamp(S.mot + (tm.mot || 0), 0, 100); S.res = clamp(S.res + (tm.res || 0), 0, 100); S.ap += tm.ap || 0; yday = '\n' + tm.msg; S.tomorrow = null; }
  S.extra = first ? null : pick(EXTRAS).id;
  for (const k in mess) mess[k].visible = BASE.some(c => c.id === k) || k === S.extra; dusts.forEach(d => d.visible = true);
  chickenBox.visible = false; remote.visible = true;
  if (H.state !== 'remote') lieDown();
  if (e.drunk) startDrunkNight();
  W.path = []; W.onArrive = null; W.pose = 'idle'; W.root.position.set(0, 0, 2.6); W.root.rotation.y = Math.PI;
  toast(e.t + yday + (S.extra ? `\n⭐ 오늘의 특별 집안일: ${ALL[S.extra].icon} ${ALL[S.extra].name}` : ''), 5000);
  net({ k: 'toast', t: e.t });
  setTimeout(() => { if (H.state === 'couch') say(H, pick(['…리모컨 어딨지', '오늘은 좀 쉬자~', '(쇼츠 무한 스크롤 중)', '배고프다 뭐 먹지'])); }, 900);
  closePanel(); render(); syncNow();
}
function mot(v) { if (v > 0) { if (S.tv && !S.tvOff) v *= 0.5; if (S.res >= 70) v *= 0.5; } v = Math.round(v); S.mot = clamp(S.mot + v, 0, 100); if (v) floatAt(H, (v > 0 ? '+' : '') + v + ' 의욕', v > 0 ? '#8fe3b8' : '#ff8a7a'); }
function res(v) { if (v > 0) v = Math.round(v * pm('resMult')); S.res = clamp(S.res + v, 0, 100); if (v >= 8) setTimeout(() => floatAt(H, '+' + v + ' 반발심', '#ff8a7a'), 250); }
const remoteH = () => H.state === 'remote';
function canAct() {
  if (!S || S.over || ROLE === 'husband') return false;
  if (drunkOn()) { toast('🍺 술 취한 남편한테는 왼쪽 취객 대처 버튼을 써요'); return false; }
  if (S.slept || (EP === 'drink' && S.midnight)) { toast('💤 남편이 자고 있어요. 🌙 버튼으로 하루를 마쳐요'); return false; }
  if (EP === 'drink' && S.tempt) { toast('📞 먼저 유혹 전화에 대답해 줘요!'); return false; }
  if (EP === 'quit' && S.story) { toast('💬 먼저 남편 이야기에 대답해 줘요!'); return false; }
  if (EP === 'quit' && (H.state === 'commute' || H.state === 'quitting')) { toast('남편이 아직 오는 중이에요…'); return false; }
  if (S.busy) { toast(S.busyLabel ? `${S.busyLabel}… 끝날 때까지 기다려요` : '남편이 집안일 하는 중이에요. 끝날 때까지 기다려요'); return false; }
  if (H.state === 'sneaking' || H.state === 'returning' || H.state === 'working') { toast('남편이 어디론가 가고 있어요…'); return false; }
  if (H.state === 'gifting') { toast('🎁 남편이 뭔가 준비하고 있어요… 잠깐만 기다려 봐요'); return false; }
  if (S.ap <= 0) { toast('행동력이 없어요. 🌙 버튼으로 하루를 마쳐요'); return false; }
  return true;
}
function hSay(t, emo) { if (!remoteH()) say(H, t, emo); }
function hFace(f, ms) { if (!remoteH()) emote(H, f, ms); }
// 남편 옆으로 가서 실행 (숨어 있으면 먼저 찾기)
function goHusband(fn) {
  closePanel();
  if (H.state === 'hiding') { findHusband(); return false; }
  if (remoteH() || H.state !== 'couch') { const p = H.root.position; const a = Math.atan2(W.root.position.x - p.x, W.root.position.z - p.z); walk(W, p.x + Math.sin(a) * 1.1, p.z + Math.cos(a) * 1.1, () => { faceTo(W, H.root.position.x, H.root.position.z); fn && fn(); }); return true; }
  walk(W, -2.9, 0.35, () => { faceTo(W, -4, 1.5); fn && fn(); }); return true;
}
const TACTICS = {
  praise: { icon: '💬', name: '칭찬', run() {
    const g = 22 * Math.pow(0.7, S.used.praise || 0) * pm('praise'); say(W, pick(['여보 오늘 왜 이렇게 멋있어?', '역시 우리 남편밖에 없다~', '어깨 진짜 넓다…', '우리 남편 최고!'])); pose(W, 'heart'); emote(W, 'smile'); sfx('praise');
    setTimeout(() => { mot(g); res(-5); hSay(pick(['에이~ 내가 좀 하지 ㅎㅎ', '진짜? 나 그 정도야?', '😊'])); hFace('smile'); const p = H.headG.getWorldPosition(_v); burst(p.x, p.y + 0.3, p.z, 6, 0xff8ab0, 0.6, 0.25); }, 600); } },
  nag: { icon: '📢', name: '잔소리', run() {
    say(W, pick(['또 누워 있어?!', '내가 몇 번을 말해!!', '소파랑 결혼했어?'])); pose(W, 'nag'); emote(W, 'angry'); sfx('nag');
    setTimeout(() => { mot(22 * pm('nag')); res(18 * pm('nagRes')); hSay(pick(['아 알았어 알았어!!', '지금 하려고 했거든?', '(한숨)'])); hFace('angry', 2500); maybeSneak(); }, 600); } },
  sigh: { icon: '😮‍💨', name: '한숨', run() {
    say(W, '하아… 허리야… (힐끔)'); pose(W, 'sigh', 2200); emote(W, 'sad', 2200); sfx('sigh');
    setTimeout(() => { if (!remoteH() && Math.random() < pm('caught', 0.25)) { res(10); say(H, '…방금 그거 연기지?'); emote(H, 'flat'); maybeSneak(); } else { mot(16 * pm('sigh')); res(3); hSay('(흠칫) 왜… 많이 힘들어?'); hFace('shock'); } }, 900); } },
  together: { icon: '🤝', name: '같이 하자', run() {
    say(W, '우리 같이 할래? 나도 도와줄게'); pose(W, 'cheer'); sfx('heart');
    setTimeout(() => { S.together = true; mot(6 * pm('together')); res(-6); hSay('같이? …그럼 할 만하지'); hFace('smile'); toast('다음 집안일이 25만큼 쉬워져요'); }, 600); } }
};
function useTactic(k) { if (!canAct()) return; if (H.state === 'hiding') { findHusband(); return; } S.ap--; render(); goHusband(() => { TACTICS[k].run(); S.used[k] = (S.used[k] || 0) + 1; setTimeout(() => { render(); check(); syncNow(); }, 800); }); }
function useChicken() {
  if (!canAct()) return; if (S.used.chicken) { toast('치킨은 하루에 한 번만!'); return; } S.ap--; S.used.chicken = 1; S.chickens++; render(); closePanel();
  walk(W, 6.95, -4.35, () => { faceTo(W, 7.35, -5.5); pose(W, 'phone', 1500); say(W, '여보~ 치킨 시켰어 🍗'); setTimeout(() => { sfx('bell'); chickenBox.visible = true; burst(-4.15, 0.9, -0.65, 10, 0xffc070, 0.8); mot(30 * pm('chicken')); res(-10); hSay('치킨…? 오늘 무슨 날이야?? 🥹'); hFace('shock'); render(); syncNow(); }, 1600); });
}
function useRemote() {
  if (!canAct()) return; if (S.tvOff) { toast('리모컨은 이미 숨겼어요 🤫'); return; } S.ap--; render(); closePanel();
  walk(W, -3.3, 0, () => { faceTo(W, -3.5, -0.55); remote.visible = false; say(W, '(리모컨을 조용히 숨긴다…)'); walk(W, -6, -4.6, () => { S.tvOff = true; render(); setTimeout(() => { mot(10); res(12); hSay('어?! 내 리모컨!! 😱'); hFace('shock', 2500); render(); check(); syncNow(); }, 300); }); });
}
// 몰래 도망 (반발심이 높을 때)
const HIDES = [
  { id: 'bath', name: '화장실', pos: [5.4, 3.9], look: [7, 3.9], pose: 'phone', found: '화장실에서 뭐 해?!', reply: '들켰다… 😅', label: '🫣 화장실에 숨음', wife: [4.6, 3.2] },
  { id: 'game', name: '게임방', pos: [12.5, -4.3], look: [12.5, -6], pose: 'game', found: '또 게임해?!!', reply: '한 판만… 진짜 한 판만!', label: '🎮 몰래 게임 중', wife: [11.3, -3.4] },
  { id: 'bed', name: '안방 침대', pos: [-12.5, -2.9], look: [-12.5, -4.6], pose: 'bed', found: '이불 속에서 뭐 해?!', reply: '5분만 더… 😪', label: '😪 이불 속에 숨음', wife: [-11.3, -2.5] },
  { id: 'balcony', name: '베란다', pos: [14.8, 4.4], look: [16, 4.4], pose: 'phone', found: '베란다에서 뭐 해!', reply: '바람 좀 쐬느라… 하하', label: '🌙 베란다로 도망', wife: [13.6, 3.8] }
];
function uprightAt(x, z) { H.inner.rotation.set(0, 0, 0); H.inner.position.set(0, 0, 0); H.root.position.set(x, 0, z); H.root.rotation.set(0, H.root.rotation.y, 0); H.shadow.visible = true; H.pose = 'idle'; H.phone.visible = false; }
function maybeSneak() {
  if (remoteH() || H.state !== 'couch' || S.res < 60 || Math.random() > 0.35) return;
  setTimeout(() => {
    if (H.state !== 'couch' || S.over) return; const hd = pick(HIDES); H.hide = hd; standUp(); H.state = 'sneaking'; H.pose = 'sneak'; say(H, '(슬금슬금…)'); emote(H, 'flat', 4000);
    walk(H, hd.pos[0], hd.pos[1], () => {
      H.state = 'hiding';
      if (hd.pose === 'bed') { H.pose = 'lie'; H.sub = 'snore'; H.idleT = 999; H.inner.rotation.set(0, 0, Math.PI / 2); H.root.rotation.set(0, -Math.PI / 2, 0); H.root.position.set(-12.5, 0.8, -4.2); H.shadow.visible = false; }
      else if (hd.pose === 'game') { H.pose = 'game'; H.root.position.set(12.5, 0, -4.35); H.root.rotation.y = Math.PI; H.targetRy = null; }
      else { H.pose = hd.pose; faceTo(H, hd.look[0], hd.look[1]); }
      toast(`🫣 남편이 ${hd.name} 쪽으로 숨었어요! 찾으러 가요`, 3500); render();
    });
  }, 1400);
}
function findHusband() {
  const hd = H.hide || HIDES[0]; closePanel();
  walk(W, hd.wife[0], hd.wife[1], () => {
    faceTo(W, H.root.position.x, H.root.position.z); say(W, hd.found); pose(W, 'nag'); emote(W, 'shock');
    setTimeout(() => {
      if (H.pose === 'lie' || H.pose === 'game') uprightAt(hd.pos[0], hd.pos[1]);
      faceTo(H, W.root.position.x, W.root.position.z); say(H, hd.reply); emote(H, 'sad'); res(-8); H.state = 'returning'; H.hide = null;
      setTimeout(() => walk(H, COUCH_SIDE[0], COUCH_SIDE[1], () => { lieDown(); render(); }), 700); render();
    }, 900);
  });
}
// =====================================================================
// 술 먹고 들어온 남편
// =====================================================================
const DRUNK_LINES = ['여보오~ 나 왔쪙~', '나 하나도 안 취했어…', '한 잔만 더어…', '여보 사랑해애~ 😚', '🎵 랄랄라~ 노래방 가자~', '부장님이 자꾸 따라 주잖아…', '집이 왜 빙글빙글 돌아?', '나 내일 회사 안 가!'];
const CLOTHES = [[0x2a2a33, 0.6, 0.06, 0.45], [0x7a1f2a, 0.08, 0.02, 0.6], [0xf4f4f4, 0.5, 0.05, 0.4], [0x222222, 0.13, 0.05, 0.28], [0x222222, 0.13, 0.05, 0.28]];
const drunkMess = new THREE.Group(); scene.add(drunkMess);
const drunkStink = [];
for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: 0x9bd36a, transparent: true, opacity: 0, depthWrite: false })); s.scale.setScalar(0.28); s.userData.ph = i * 0.9; scene.add(s); drunkStink.push(s); }
const drunkOn = () => !!(S && S.drunk > 0);
function startDrunkNight(level = 85) {
  S.drunk = level; S.socks = true; S.photo = false;
  H.path = []; H.onArrive = null; H.inner.rotation.set(0, 0, 0); H.shadow.visible = true; H.pose = 'idle'; H.root.visible = false; H.state = 'out'; H.drunk = true;
  H.cheekM.color.set(0xff5050); H.cheeks.forEach(c => c.scale.set(1.6, 1, 0.5));
  setTimeout(() => {
    if (!S || S.over || H.state !== 'out') return;
    sfx('door'); H.root.visible = true; H.root.position.set(0, 0, 5.9); H.root.rotation.y = Math.PI; H.state = 'drunk'; H.speed = 1.5; H.wanderT = 1.5; H.lineT = 3;
    say(H, '여보오~ 나 왔쪙~ 🍺'); emote(H, 'smile', 3000); walk(H, 0, 3.8);
    toast('🍺 남편이 술 취해서 들어왔어요! 왼쪽 버튼으로 술을 깨우고 소파에 재워요', 5000); render();
  }, 2500);
}
function drunkTick(dt, t) {
  const on = drunkOn() && S.socks && H.root.visible && H.state !== 'out', p = H.root.position;
  drunkStink.forEach(s => { const k = (t * 0.5 + s.userData.ph) % 1.4; s.position.set(p.x + Math.sin(t * 2 + s.userData.ph) * 0.25, 0.15 + k * 0.7, p.z + Math.cos(t * 1.7 + s.userData.ph) * 0.25); s.material.opacity = on ? 0.5 * (1 - k / 1.4) : 0; });
  if (!S || H.state !== 'drunk' || S.over) return;
  H.lineT -= dt; if (H.lineT <= 0) { H.lineT = rand(3, 5); if (Math.random() < 0.35) { say(H, '딸꾹! 🍺', false, 1500); sfx('hic'); } else say(H, pick(DRUNK_LINES)); }
  if (H.path.length || H.drunkHold) return;
  H.wanderT -= dt; if (H.wanderT > 0) return;
  H.wanderT = rand(1.2, 2.6);
  if (Math.random() < 0.3 && drunkMess.children.length < CLOTHES.length) dropClothes();
  const [x, z] = nearestFree(clamp(p.x + rand(-2.5, 2.5), -6.5, 6.5), clamp(p.z + rand(-2, 2), -4.5, 5));
  walk(H, x, z);
}
function dropClothes() {
  const c = CLOTHES[drunkMess.children.length], p = H.root.position;
  const m = new THREE.Mesh(new THREE.BoxGeometry(c[1], c[2], c[3]), mat(c[0])); m.position.set(p.x + rand(-0.3, 0.3), c[2] / 2 + 0.01, p.z + rand(-0.3, 0.3)); m.rotation.y = rand(0, 3); m.castShadow = true; drunkMess.add(m);
  say(H, pick(['더워어…', '(옷을 아무 데나 던진다)', '넥타이 너 이 녀석…']));
}
function canDrunk(free) {
  if (!drunkOn() || S.over) return false;
  if (H.state === 'out') { toast('남편이 아직 안 들어왔어요…'); return false; }
  if (H.state !== 'drunk') return false;
  if (!free && S.ap <= 0) { toast('행동력이 없어요. 🛌 재우기는 할 수 있어요'); return false; }
  return true;
}
function approachH(fn) {
  H.drunkHold = true; H.path = []; H.onArrive = null; const p = H.root.position, a = Math.atan2(W.root.position.x - p.x, W.root.position.z - p.z);
  walk(W, p.x + Math.sin(a) * 0.95, p.z + Math.cos(a) * 0.95, () => { faceTo(W, H.root.position.x, H.root.position.z); faceTo(H, W.root.position.x, W.root.position.z); fn(); setTimeout(() => { H.drunkHold = false; H.wanderT = 1.5; }, 2000); });
}
function sober(v) { S.drunk = clamp(S.drunk - v, 0, 100); if (S.drunk === 0) S.drunk = 1; floatAt(H, `-${v} 취기`, '#ffb070'); render(); }
const DRUNK_ACTS = {
  honey: { icon: '🍯', name: '꿀물', run() {
    if (!canDrunk()) return; S.ap--; render(); closePanel();
    walk(W, 6.95, -4.35, () => { faceTo(W, 7.35, -5.5); pose(W, 'work', 900); sfx('water');
      setTimeout(() => { W.mug.visible = true; W.pose = 'mug'; approachH(() => { say(W, '꿀물 마시고 정신 차려!');
        setTimeout(() => { W.mug.visible = false; W.pose = 'idle'; H.mug.visible = true; H.pose = 'mug'; say(H, '크으~ 시원하다… 역시 우리 여보밖에 없어'); sfx('heart'); sober(30); res(-5);
          setTimeout(() => { H.mug.visible = false; H.pose = 'idle'; }, 1600); }, 700); }); }, 900); }); } },
  smash: { icon: '🖐️', name: '등짝 스매싱', run() {
    if (!canDrunk()) return; S.ap--; render(); closePanel();
    approachH(() => { say(W, '지금 몇 시야!!'); pose(W, 'smash', 900); emote(W, 'angry', 2000);
      setTimeout(() => { sfx('smack'); const p = H.headG.getWorldPosition(_v); burst(p.x, p.y - 0.3, p.z, 18, 0xffffff, 2.2, 0.2); emote(H, 'shock', 2000); say(H, '아야!! 정신이 번쩍 드네…'); sober(25); res(15); check(); }, 500); }); } },
  socks: { icon: '🧦', name: '양말 벗기기', run() {
    if (!canDrunk()) return; if (!S.socks) { toast('양말은 이미 벗겼어요'); return; } S.ap--; render(); closePanel();
    approachH(() => { pose(W, 'work', 1200); emote(W, 'sad', 1500); say(W, '으… 발 냄새 🤢');
      setTimeout(() => { S.socks = false; sfx('scrub'); const p = H.root.position; burst(p.x, 0.3, p.z, 14, 0x9bd36a, 1, 0.25); say(H, '아 시원하다~ 여보 최고~'); sober(10); res(-3); }, 900); }); } },
  photo: { icon: '📸', name: '증거 사진', run() {
    if (!canDrunk(true)) return; if (S.photo) { toast('증거는 이미 확보했어요 😏'); return; } closePanel();
    approachH(() => { pose(W, 'photo', 1400); W.phone.visible = true;
      setTimeout(() => { flash(); sfx('camera'); S.photo = true; say(W, '찰칵 📸 내일 보여 줘야지~'); pose(H, 'wave', 1500); say(H, '브이~ ✌️ 헤헤'); toast('📸 증거 확보! 재우고 나면 내일 남편이 더 반성해요 (의욕 +15)', 3500); render(); setTimeout(() => { W.phone.visible = false; }, 800); }, 700); }); } }
};
function putToBed() {
  if (!canDrunk(true)) return;
  if (S.drunk > 40) { toast(`아직 너무 취했어요 (취기 ${S.drunk}%). 40% 이하로 깨워야 소파까지 데려가요`, 3500); say(H, pick(['나 안 자! 2차 가자!', '딸꾹! 아직 초저녁이야~'])); return; }
  closePanel();
  approachH(() => {
    say(W, '자, 이제 자러 가자~'); H.drunkHold = true; H.state = 'tobed';
    walk(H, COUCH_SIDE[0], COUCH_SIDE[1], () => {
      lieDown(); H.sub = 'snore'; H.idleT = 999; say(H, '💤', true, 4000); S.drunk = 0; S.slept = true; H.drunk = false; H.speed = 2.5;
      const bonus = 25 + (S.photo ? 15 : 0); S.drunkSaved = (S.drunkSaved || 0) + 1;
      S.tomorrow = { mot: bonus, res: -10, msg: `😳 남편: "어제는 미안했어…" 반성 모드! 의욕 +${bonus}${S.photo ? ' (증거 사진 효과)' : ''}` };
      sfx('ok'); toast('🛌 무사히 재웠어요! 내일 남편이 미안해서 말을 잘 들어요. 🌙로 하루를 마쳐요', 4500); render();
    });
    walk(W, COUCH_SIDE[0] + 0.8, COUCH_SIDE[1] - 0.7);
  });
}
function flash() { const f = $('flash'); if (!f) return; f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 120); }


// =====================================================================
// 아이 (아이 방을 돌아다녀요)
// =====================================================================
let kidT = 2, kidLineT = 5, kidPlaying = false;
function kidTick(dt) {
  if (!S || kidPlaying) return;
  kidLineT -= dt;
  if (kidLineT <= 0) { kidLineT = rand(6, 11); const sad = !S.done.playkid; say(K, sad ? pick(['아빠 놀아줘! 🥺', '아빠 어딨어?', '엄마 심심해~', '아빠 게임만 해…']) : pick(['오늘 아빠랑 놀아서 좋아! 😆', '🎵 랄라라~', '아빠 최고!']), false, 2600, true); }
  if (K.path.length) return; kidT -= dt; if (kidT > 0) return; kidT = rand(2.5, 5);
  const [x, z] = nearestFree(rand(-14.5, -9), rand(2.0, 5.3)); walk(K, x, z);
}

// =====================================================================
// 남편 → 아내: 몰래 선물 (아내 에너지 ⚡ 상승) ↔ 아내 반응 (남편 의욕 상승)
// =====================================================================
const GIFTS = {
  gift: { icon: '🎁', name: '몰래 산 선물', ap: 2, line: '짠~ 여보 선물이야 🎁', wline: '어머 이게 뭐야?! 🥹', go: [0.3, 5.0] },
  flower: { icon: '💐', name: '꽃 한 송이', ap: 1, line: '오다가 예뻐서 샀어 💐', wline: '웬 꽃이야~ 예쁘다 🥰', go: [0.3, 5.0] },
  coffee: { icon: '☕', name: '커피', ap: 1, line: '여보 커피 한 잔 해~ ☕', wline: '오~ 딱 마시고 싶었어!', go: [4.2, -4.75] },
  massage: { icon: '💆', name: '어깨 안마', ap: 1, line: '어깨 주물러 줄게~ 💆', wline: '아~ 시원하다…', go: null }
};
let giftT = 20;
function receiveGift(kind) {
  const g = GIFTS[kind]; if (!g || !S || S.over) return;
  S.gifted[kind] = 1; S.ap += g.ap; S.giftCount = (S.giftCount || 0) + 1;
  floatAt(W, `+${g.ap} ⚡ 에너지`, '#ffd23a'); const p = W.headG.getWorldPosition(_v); burst(p.x, p.y + 0.3, p.z, 16, 0xff8ab0, 1, 0.25);
  sfx('win'); pose(W, 'heart', 2200); emote(W, 'shock', 1500); say(W, g.wline);
  toast(`${g.icon} 남편이 ${g.name}을 줬어요! 아내 에너지 +${g.ap}`, 3500); render(); syncNow();
  setTimeout(() => { if (S && !S.over) openThanks(kind); }, 900);
}
function openThanks(kind) {
  const done = (r, fn) => () => { fn(); closePanel(); net({ k: 'thanks', r }); render(); syncNow(); };
  openPanel(`<div class="q">${GIFTS[kind].icon} 남편에게 뭐라고 할까요?</div>`, [
    { t: '💛 고마워 여보!', s: '남편 의욕 +12', cls: 'go', f: done('love', () => { say(W, '고마워 여보! 최고야 💛'); mot(12); res(-6); }) },
    { t: '😘 뽀뽀', s: '남편 의욕 +18 · 반발심 -10', f: done('kiss', () => { say(W, '😘', true); pose(W, 'heart', 1500); mot(18); res(-10); const p = H.headG.getWorldPosition(_v); burst(p.x, p.y + 0.3, p.z, 14, 0xff6a9a, 0.9, 0.25); }) },
    { t: '🤨 뭐 잘못했어?', s: '남편 반발심 +6 ㅋㅋ', f: done('what', () => { say(W, '솔직히 말해. 뭐 잘못했어?'); res(6); hSay('아니 그냥… 억울해 😭'); hFace('sad', 2000); }) }
  ], true);
}
function aiGift(kind) {
  const g = GIFTS[kind]; standUp(); H.state = 'gifting'; H.pose = 'idle'; render();
  const deliver = () => {
    if (!S || S.over) return;
    giftBox.visible = kind === 'gift'; flowerP.visible = kind === 'flower'; H.mug.visible = kind === 'coffee'; H.pose = kind === 'massage' ? 'idle' : 'mug';
    const p = W.root.position;
    walk(H, p.x + 0.9, p.z + 0.45, () => {
      faceTo(H, W.root.position.x, W.root.position.z); faceTo(W, H.root.position.x, H.root.position.z); say(H, g.line); if (kind === 'massage') H.pose = 'work';
      setTimeout(() => {
        giftBox.visible = flowerP.visible = H.mug.visible = false; H.pose = 'heart'; receiveGift(kind);
        setTimeout(() => { if (H.state !== 'gifting') return; H.pose = 'idle'; H.state = 'returning'; walk(H, COUCH_SIDE[0], COUCH_SIDE[1], () => { lieDown(); render(); }); }, 2200);
      }, kind === 'massage' ? 1800 : 900);
    });
  };
  if (g.go) {
    say(H, kind === 'coffee' ? '(부엌으로 슬쩍…)' : '(잠깐 나갔다 올게~)');
    walk(H, g.go[0], g.go[1], () => { if (kind === 'coffee') { H.pose = 'work'; sfx('water'); setTimeout(deliver, 1100); } else { H.root.visible = false; sfx('door'); setTimeout(() => { H.root.visible = true; sfx('door'); deliver(); }, 1800); } });
  } else deliver();
}
function giftTick(dt) {
  if (!S || S.over || ROLE === 'husband' || remoteH() || H.state !== 'couch' || S.busy || drunkOn() || S.slept || panelOpen) return;
  giftT -= dt; if (giftT > 0) return; giftT = rand(25, 45);
  const chance = S.mot >= 50 ? 0.55 : S.hab >= 30 ? 0.35 : 0.12, left = Object.keys(GIFTS).filter(k => !S.gifted[k]);
  if (left.length && Object.keys(S.gifted).length < 2 && Math.random() < chance) aiGift(pick(left));
}
// 부부 모드: 진짜 남편이 주는 선물
function hGift(kind) {
  if (!S || S.over) return; if (S.gifted && S.gifted[kind]) { toast('오늘은 이미 했어요. 내일 또 해요 😉'); return; }
  const g = GIFTS[kind]; if (H.pose === 'lie') standUp(); toast(`${g.icon} 아내에게 ${g.name} 주러 가요`, 2500);
  const give = () => {
    giftBox.visible = kind === 'gift'; flowerP.visible = kind === 'flower'; H.mug.visible = kind === 'coffee'; if (kind !== 'massage') H.pose = 'mug';
    const p = W.root.position;
    walk(H, p.x + 0.9, p.z + 0.45, () => { faceTo(H, W.root.position.x, W.root.position.z); say(H, g.line); if (kind === 'massage') pose(H, 'work', 1500);
      setTimeout(() => { giftBox.visible = flowerP.visible = H.mug.visible = false; pose(H, 'heart', 1500); net({ k: 'gift', g: kind }); S.gifted[kind] = 1; renderControls(); }, kind === 'massage' ? 1600 : 900); });
  };
  if (kind === 'coffee') walk(H, 4.2, -4.75, () => { pose(H, 'work', 900); sfx('water', true); setTimeout(give, 1000); });
  else give();
}

// =====================================================================
// 2화: 술고래 남편 (저녁 6시~자정까지 술 생각을 100 아래로 지키기)
// =====================================================================
const DAY_LEN = 100;   // 저녁 6시 → 자정 (초)
const beerG = new THREE.Group(); scene.add(beerG);
[[2.3, -5.5], [2.52, -5.58], [2.72, -5.45], [2.45, -5.36]].forEach(([x, z]) => { cyl(0.05, 0.05, 0.16, 0xd9b13a, x, 1.03, z, beerG, 10); cyl(0.051, 0.051, 0.03, 0xc0c6cc, x, 1.12, z, beerG, 10); });
cyl(0.05, 0.05, 0.16, 0xd9b13a, -3.35, 0.56, -0.9, beerG, 10);
beerG.visible = false;
const TEMPTS = [
  { icon: '📞', who: '부장님', text: '김대리~ 오늘 한잔 어때? 내가 쏜다!', ch: [{ t: '😷 오늘 아내 생일이라서요', c: -12, w: 6 }, { t: '🏥 내일 건강검진이에요', c: -15, w: 4 }, { t: '🍺 딱 한 잔만요!', c: 30, w: -8, bad: true }] },
  { icon: '💬', who: '고딩 친구 단톡', text: '야 치맥 콜? 다 모였다 ㅋㅋ', ch: [{ t: '🙅 나 금주 중이다', c: -10, w: 8 }, { t: '🥤 나는 제로콜라 ㅋ', c: -8, w: 5 }, { t: '🍗 치킨만 먹고 올게…', c: 25, w: -6, bad: true }] },
  { icon: '📺', who: '야구 중계', text: '9회말 역전 찬스! (맥주 광고가 나온다…)', ch: [{ t: '🥤 탄산수로 건배!', c: -12, w: 3 }, { t: '📴 TV 끄고 스트레칭', c: -15, w: 5 }, { t: '🍺 이건 맥주 각이지', c: 28, w: -6, bad: true }] },
  { icon: '🏪', who: '편의점 앱', text: '[오늘만] 수입맥주 4캔 만 원 🍻', ch: [{ t: '🗑️ 알림 끄기', c: -10, w: 4 }, { t: '🧃 식혜 4캔 담기', c: -12, w: 3 }, { t: '🛒 장바구니 담기', c: 25, w: -5, bad: true }] },
  { icon: '📞', who: '시아버지', text: '아들~ 주말에 내려와서 한잔 하자!', ch: [{ t: '🍵 아버지, 차 한 잔 해요', c: -10, w: 6 }, { t: '⛳ 대신 같이 산책 가요', c: -12, w: 5 }, { t: '🍶 좋죠! 막걸리!', c: 22, w: -5, bad: true }] },
  { icon: '🍖', who: '고기 굽는 냄새', text: '옆집에서 삼겹살 굽는다… 소주 생각이…', ch: [{ t: '🥬 우리는 쌈 채소 먹자', c: -10, w: 4 }, { t: '🚶 바람 쐬고 올게', c: -12, w: 5 }, { t: '🍾 소주 한 병만…', c: 26, w: -6, bad: true }] }
];
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
let drinkUIt = 0;
function craveRate() { return 0.7 * (1 - S.will / 140) * (S.res >= 60 ? 1.35 : 1) * (S.hidden ? 0.8 : 1); }
function crave(v) { v = Math.round(v); S.crave = clamp(S.crave + v, 0, 100); if (v) floatAt(H, `${v > 0 ? '+' : ''}${v} 술 생각`, v < 0 ? '#8fe3b8' : '#ff8a7a'); renderBars(); }
function will(v) { v = Math.round(v); S.will = clamp(S.will + v, 0, 100); if (v) setTimeout(() => floatAt(H, `${v > 0 ? '+' : ''}${v} 참을성`, v > 0 ? '#ffd23a' : '#ff8a7a'), 300); renderBars(); }
const clockStr = () => { const m = 18 * 60 + Math.floor(S.clock / DAY_LEN * 360); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
function startDrinkDay(first) {
  for (const k in mess) mess[k].visible = false; dusts.forEach(d => d.visible = false); S.extra = null;
  chickenBox.visible = false; remote.visible = true; beerG.visible = true;
  if (!first) { S.crave = clamp(Math.round(S.crave * 0.4) + 28, 0, 90); S.will = Math.round(S.will * 0.8); }
  Object.assign(S, { clock: 0, hidden: false, tempt: null, relapsed: false, midnight: false, temptT: 7 });
  let msg = '';
  if (!first && S.tomorrow) { const tm = S.tomorrow; S.ap += tm.ap || 0; if ((tm.mot || 0) > 0) { S.will = clamp(S.will + 15, 0, 100); msg = '\n😳 어제 재워 줘서 남편이 반성 중 (참을성 +15)'; } else msg = '\n' + tm.msg; S.tomorrow = null; }
  if (H.state !== 'remote') lieDown(); H.sub = 'phone';
  W.path = []; W.onArrive = null; W.pose = 'idle'; W.root.position.set(-1.0, 0, 1.9); W.root.rotation.y = -Math.PI / 2;
  const n = S.cal.filter(Boolean).length;
  toast((first ? '🍺 2화 · 술고래 남편! 자정까지 술 생각을 100 아래로 지키면 금주 도장 ✅' : `🍺 ${S.day}일차 저녁 6시 · 금주 도장 ${n}개`) + msg, 5500);
  setTimeout(() => { if (H.state === 'couch' && !S.over) say(H, pick(['아… 시원한 맥주 한 캔만…', '오늘 회사에서 너무 힘들었어…', '치킨엔 맥주인데…'])); }, 1200);
  closePanel(); render();
}
function spawnTempt() {
  const T = pick(TEMPTS.filter(x => x !== S.lastTempt)); S.lastTempt = T; S.tempt = { T, left: 9 };
  sfx('bell'); H.sub = 'phone'; H.idleT = 99; say(H, `${T.icon} "${T.text}"`, false, 4500); emote(H, 'shock', 1500);
  openPanel(`<div class="q"><span>${T.icon} <b>${T.who}</b>의 유혹! 남편한테 뭐라고 하라고 할까요?</span><small id="tleft">⏰ 9초</small></div>`,
    shuffle(T.ch).map(c => ({ t: c.t, f: () => resolveTempt(c, false) })), true);
  renderBars();
}
function resolveTempt(c, auto) {
  if (!S || !S.tempt) return; S.tempt = null; closePanel(); H.idleT = 2;
  say(H, c.t.replace(/^\S+\s/, '') + (c.bad ? ' 🍺' : ''));
  if (c.bad) { emote(W, 'angry', 2000); pose(W, 'nag', 1500); setTimeout(() => say(W, '여보!!! 😤'), 500); sfx('no'); emote(H, 'smile'); }
  else { pose(W, 'heart', 1200); sfx('ok'); emote(H, 'flat', 1500); }
  crave(c.c); if (c.w) will(c.w);
  if (auto) toast(c.bad ? '⏰ 시간 초과! 남편이 알아서 대답했는데… 망했다 🍺' : '⏰ 시간 초과! 다행히 남편이 잘 거절했어요', 3000);
  if (S.crave >= 100 && !S.busy) relapse();
  render();
}
function relapse() {
  if (!S || S.relapsed || S.over) return; S.relapsed = true; S.tempt = null; closePanel(); S.cal[S.day - 1] = 0;
  toast('🍺 술 생각을 못 참고… 남편이 "편의점 다녀올게~" 하고 나갔어요!', 4500); sfx('door');
  H.path = []; H.onArrive = null; if (H.pose === 'lie') standUp(); H.state = 'sneaking'; H.pose = 'sneak'; say(H, '(잠깐 편의점 좀…)'); emote(H, 'flat', 3000);
  walk(H, 0.3, 5.0, () => { H.root.visible = false; startDrunkNight(60); render(); });
  render();
}
function drinkTick(dt) {
  if (EP !== 'drink' || !S || S.over || ROLE === 'husband' || S.relapsed || drunkOn() || S.slept || S.midnight) return;
  S.clock = Math.min(DAY_LEN, S.clock + dt);
  if (S.clock >= DAY_LEN) { S.midnight = true; S.tempt = null; closePanel(); H.sub = 'snore'; H.idleT = 999; say(H, '💤', true, 4000); toast('🕛 자정! 남편이 잠들었어요. 🌙 를 눌러 금주 도장을 받아요', 4500); render(); return; }
  if (!S.busy) S.crave = clamp(S.crave + craveRate() * dt, 0, 100);
  if (S.tempt) {
    S.tempt.left -= dt; const el = $('tleft'); if (el) el.textContent = `⏰ ${Math.max(0, Math.ceil(S.tempt.left))}초`;
    if (S.tempt.left <= 0) { const T = S.tempt.T, bad = T.ch.find(c => c.bad); resolveTempt(Math.random() < 0.55 - S.will / 300 ? bad : pick(T.ch.filter(c => !c.bad)), true); }
  } else if (H.state === 'couch' && !S.busy && !panelOpen && W.pose !== 'mug') {
    S.temptT -= dt; if (S.temptT <= 0 && S.clock < DAY_LEN - 8) { S.temptT = rand(16, 24); spawnTempt(); }
  }
  if (S.crave >= 100 && !S.busy) { relapse(); return; }
  drinkUIt += dt; if (drinkUIt > 0.5) { drinkUIt = 0; renderBars(); }
}
function drinkNight() {
  if (S.relapsed) { S.cal[S.day - 1] = 0; return '❌ 오늘은 못 참았어요…\n내일은 꼭!'; }
  const left = Math.max(0, DAY_LEN - S.clock), proj = S.crave + craveRate() * left + Math.floor(left / 20) * 9;   // 남은 시간 동안 올 유혹까지 계산
  if (proj >= 100) { S.cal[S.day - 1] = 0; return '🌙 밤늦게… 남편이 몰래\n편의점에 다녀왔어요 🍺❌'; }
  S.cal[S.day - 1] = 1; return `🍀 오늘 밤도 무사히!\n금주 도장 쾅 ✅ (${S.cal.filter(Boolean).length}/7)`;
}
function busyDo(label, fn) { S.busy = true; S.busyLabel = label; render(); fn(() => { S.busy = false; S.busyLabel = null; render(); }); }
const DRINK_ACTS = {
  soda: { icon: '🥤', name: '탄산수', run() {
    if (!canAct()) return; S.ap--; render(); closePanel();
    walk(W, 6.95, -4.35, () => { faceTo(W, 7.35, -5.5); pose(W, 'work', 800); sfx('water');
      setTimeout(() => { W.mug.visible = true; W.pose = 'mug'; goHusband(() => { say(W, '맥주 대신 탄산수! 톡 쏘지? 🥤');
        setTimeout(() => { W.mug.visible = false; W.pose = 'idle'; hSay(pick(['크… 이것도 나쁘지 않네', '시원하다~ 근데 맥주는 아니잖아…', '오 레몬 맛이네?'])); crave(-20); will(4); render(); }, 700); }); }, 900); }); } },
  praise: { icon: '💬', name: '칭찬', run() {
    if (!canAct()) return; S.ap--; render();
    goHusband(() => { say(W, pick(['요즘 술 안 마시니까 얼굴이 훤해!', '역시 우리 남편 의지 최고!', '배가 쏙 들어간 것 같은데?'])); pose(W, 'heart'); sfx('praise');
      setTimeout(() => { will(15 * Math.pow(0.75, S.used.praise || 0) * pm('praise')); S.used.praise = (S.used.praise || 0) + 1; crave(-5); res(-5); hSay(pick(['진짜? 나 좀 참았지 ㅎㅎ', '그치? 나 요즘 대단하지', '😊'])); hFace('smile'); render(); }, 600); }); } },
  nag: { icon: '📢', name: '잔소리', run() {
    if (!canAct()) return; S.ap--; render();
    goHusband(() => { say(W, pick(['또 맥주 생각하지?!', '간 수치 생각 좀 해!!', '그 배는 다 맥주야!'])); pose(W, 'nag'); emote(W, 'angry'); sfx('nag');
      setTimeout(() => { will(6); crave(8); res(15 * pm('nagRes')); hSay(pick(['아 알았어 알았어…', '스트레스 받으니까 더 마시고 싶네…'])); hFace('angry', 2500); render(); check(); }, 600); }); } },
  hide: { icon: '🫙', name: '술 숨기기', run() {
    if (!canAct()) return; if (S.hidden) { toast('술은 이미 숨겼어요 🤫'); return; } S.ap--; render(); closePanel();
    walk(W, 2.5, -4.6, () => { faceTo(W, 2.5, -5.6); pose(W, 'work', 1000); sfx('scrub');
      setTimeout(() => { beerG.visible = false; S.hidden = true; say(W, '(맥주를 몰래 숨긴다…🤫)'); crave(-8); toast('🫙 집에 있는 술을 다 숨겼어요! 오늘은 술 생각이 천천히 올라요', 3500); setTimeout(() => hSay('어? 냉장고 맥주 어디 갔지…?'), 1800); render(); }, 1000); }); } },
  walk: { icon: '🚶', name: '같이 산책', run() {
    if (!canAct()) return; S.ap--; closePanel();
    goHusband(() => { say(W, '여보, 우리 바람 쐬러 가자!'); busyDo('🚶 같이 산책 중', done => {
      standUp(); H.state = 'working'; hSay('그래… 나가자'); sfx('heart');
      walkSeq(H, [[12.4, 4.2], [14.6, 3.6]], () => { faceTo(H, 16, 3.6); say(H, '와… 밤공기 좋다~'); setTimeout(() => { crave(-25); will(8); walk(H, COUCH_SIDE[0], COUCH_SIDE[1], () => { lieDown(); done(); }); }, 1500); });
      walkSeq(W, [[12.2, 4.9], [14.4, 4.5]], () => { faceTo(W, 16, 4.5); W.pose = 'heart'; setTimeout(() => { W.pose = 'idle'; walk(W, -2.9, 0.35); }, 1500); });
    }); }); } },
  gym: { icon: '💪', name: '홈트', run() {
    if (!canAct()) return; S.ap--; closePanel();
    goHusband(() => { say(W, '맥주 생각날 땐 운동이지! 스쿼트 20개!'); busyDo('💪 홈트 중', done => {
      standUp(); H.state = 'working'; hSay('헉헉… 이거 맞아?');
      walk(H, 0.4, 0.2, () => { faceTo(H, 0.4, 3); H.pose = 'work'; let k = 0; const iv = setInterval(() => { const p = H.root.position; burst(p.x, 1.4, p.z, 3, 0x9fd8ff, 0.6, 0.12); sfx('scrub', true); if (++k >= 10) { clearInterval(iv); H.pose = 'cheer'; say(H, '오… 개운한데? 💪'); crave(-18); will(12); res(4); S.workouts = (S.workouts || 0) + 1; setTimeout(() => { H.pose = 'idle'; walk(H, COUCH_SIDE[0], COUCH_SIDE[1], () => { lieDown(); done(); }); }, 1200); } }, 250); });
    }); }); } }
};

// =====================================================================
// 3화: 회사 때려치겠다는 남편 (멘탈·퇴사 욕구·통장·부업)
// =====================================================================
const tie = new THREE.Group(); H.inner.add(tie);
{ const k = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.03), mat(0xb02a3a)); k.position.set(0, 0.8, 0.205); tie.add(k); const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.02), mat(0xc0343f)); b.position.set(0, 0.64, 0.23); b.rotation.x = -0.1; tie.add(b); }
tie.visible = false;
const STORIES = [
  { icon: '😤', who: '부장님', text: '"이번 주말에 출근하래… 나 진짜 그만둘래"', ch: [
    { t: '🤗 고생했어, 맛있는 거 해 줄게', m: 12, u: -5 }, { t: '😡 부장님 진짜 너무하네! 같이 욕해 줄게', m: 8, u: 6 },
    { t: '📊 주말수당은 나와?', m: -4, u: -8, $: 10 }, { t: '🏖️ 그냥 확 그만둬!', m: 5, u: 25 }] },
  { icon: '🥲', who: '후배', text: '"내 아이디어를 후배가 자기 거라고 발표했어…"', ch: [
    { t: '🫂 그거 진짜 속상했겠다', m: 12, u: -6 }, { t: '📝 증거 남겨 놓자, 메일 있어?', m: 4, u: -10 },
    { t: '💡 그 아이디어로 부업 해 보자!', m: 6, side: 12 }, { t: '🙄 회사가 원래 그렇지 뭐', m: -8, u: 10 }] },
  { icon: '💸', who: '연봉 협상', text: '"연봉 동결이래… 물가는 오르는데"', ch: [
    { t: '🍖 오늘은 고기 먹자!', m: 10, $: -5 }, { t: '📞 헤드헌터 한번 만나 봐', m: 4, u: -8, offer: true },
    { t: '📊 그래도 우리 아직 괜찮아', m: 6, u: -6 }, { t: '😮‍💨 하… 우리 대출은 어떡해', m: -10, u: 12 }] },
  { icon: '🎉', who: '팀장님', text: '"오늘 발표 칭찬받았어! 근데 일은 더 늘었어…"', ch: [
    { t: '👏 우리 남편 최고! 자랑스러워', m: 15, u: -10 }, { t: '🍰 축하 케이크 사 올게', m: 12, $: -3 },
    { t: '😏 칭찬 말고 보너스 달라 해', m: 5, u: 4 }] },
  { icon: '📞', who: '헤드헌터', text: '"헤드헌터한테 연락 왔어. 연봉 20% 더 준대…"', ch: [
    { t: '🚀 한번 만나 봐! 손해 볼 거 없잖아', m: 8, u: -12, offer: true }, { t: '🏢 지금 회사가 안정적이지 않아?', m: -3, u: 8 },
    { t: '🤔 조건 꼼꼼히 같이 보자', m: 5, u: -6, offer: true }] },
  { icon: '😴', who: '야근', text: '"야근 3일째야… 나 사람 맞아?"', ch: [
    { t: '🛁 반신욕 물 받아 놨어', m: 14, u: -6 }, { t: '🍱 내일 도시락 싸 줄게', m: 10, $: -1 },
    { t: '📢 몸 버려! 칼퇴 좀 해!', m: -4, u: 10 }] },
  { icon: '🍻', who: '동기', text: '"동기가 퇴사하고 세계여행 간대… 부럽다"', ch: [
    { t: '✈️ 우리도 주말에 가까운 데 가자', m: 12, u: -8, $: -10 }, { t: '💡 당신도 하고 싶은 거 준비해 봐', m: 6, side: 10 },
    { t: '😅 그 동기 통장은 괜찮대?', m: -2, u: -10 }, { t: '🌍 우리도 다 때려치고 가자!', m: 8, u: 22 }] }
];
const QUIT_STORIES = [
  { icon: '📉', who: '통장', text: '"통장 잔고 보니까 현타 온다…"', ch: [{ t: '📊 같이 가계부 다시 짜자', m: 4, $: 10 }, { t: '🧾 단기 알바라도 해 볼까?', m: -3, $: 25 }, { t: '🤗 괜찮아, 쉬는 것도 일이야', m: 12 }] },
  { icon: '📹', who: '유튜브', text: '"퇴사 브이로그 첫 영상 조회수 12…"', ch: [{ t: '💡 부업으로 제대로 키워 보자', side: 15, m: 4 }, { t: '👏 12명이면 시작이 반!', m: 10 }, { t: '🙄 그거 언제 돈 돼?', m: -10 }] },
  { icon: '🤝', who: '친구', text: '"친구가 같이 창업하자는데…"', ch: [{ t: '🚀 사업계획서 같이 보자', side: 18, m: 4 }, { t: '🤔 일단 작게 시작해 보자', side: 10, m: 6 }, { t: '😰 무서워, 하지 마', m: -6 }] }
];
function qd(k, v, label, col) { v = Math.round(v); if (!v) return; if (k === 'money') S.money = Math.max(0, S.money + v); else S[k] = clamp(S[k] + v, 0, 100); floatAt(H, `${v > 0 ? '+' : ''}${v}${label}`, col || (v > 0 ? '#8fe3b8' : '#ff8a7a')); }
function applyQ(o) {
  if (o.m) qd('mental', o.m * (o.m > 0 ? pm('praise') : 1), ' 멘탈');
  if (o.u && !S.quit) setTimeout(() => qd('urge', o.u, ' 퇴사 욕구', o.u > 0 ? '#ff8a7a' : '#8fe3b8'), 250);
  if (o.$) setTimeout(() => qd('money', o.$, '만 원', o.$ > 0 ? '#ffd23a' : '#ff8a7a'), 500);
  if (o.side) setTimeout(() => qd('side', o.side * (S.quit ? 1.4 : 1), ' 부업', '#9fd8ff'), 750);
  if (o.offer && !S.offer) { S.offer = true; setTimeout(() => toast('📞 헤드헌터 제안을 잡아 뒀어요! 멘탈을 지키면 이직 엔딩이 열려요', 3500), 900); }
  setTimeout(() => { renderBars(); if (!S.quit && S.urge >= 100) quitNow(); else render(); }, 900);
}
function openStory() {
  if (!S || S.over) return;
  const pool = (S.quit ? QUIT_STORIES : STORIES).filter(x => !S.storyUsed.includes(x.who));
  const T = S.day === 1 && !S.quit ? STORIES[0] : pick(pool.length ? pool : (S.quit ? QUIT_STORIES : STORIES));
  S.storyUsed.push(T.who); S.story = T;
  say(H, T.text.replace(/"/g, ''), false, 5000); emote(H, S.quit ? 'flat' : 'sad', 3000);
  openPanel(`<div class="q"><span>${T.icon} <b>${T.who}</b> 이야기 · 뭐라고 대답할까요?</span></div><div class="q"><small>${T.text}</small></div>`,
    T.ch.map(c => ({ t: c.t, f: () => { S.story = null; closePanel(); say(W, c.t.replace(/^\S+\s/, '')); pose(W, c.m >= 10 ? 'heart' : c.u >= 15 ? 'cheer' : 'idle', 1500); sfx(c.m >= 8 ? 'praise' : c.m < 0 ? 'no' : 'tap'); applyQ(c);
      setTimeout(() => hSay(c.m >= 10 ? pick(['여보밖에 없다…', '조금 살 것 같아', '고마워 진짜']) : c.u >= 15 ? '그치?! 나 진짜 그만둔다!!' : c.m < 0 ? '…그런 말 듣자고 한 얘기 아닌데' : '음… 그렇긴 하지'), 900); } })), true);
}
function startQuitDay(first) {
  for (const k in mess) mess[k].visible = false; dusts.forEach(d => d.visible = false); S.extra = null; beerG.visible = false; chickenBox.visible = false; remote.visible = true;
  let msg = '';
  if (!first) {
    if (!S.quit) { qd('mental', -8, ''); S.urge = clamp(S.urge + (100 - S.mental) / 7, 0, 100); }
    if (S.lunch) { S.mental = clamp(S.mental + 6, 0, 100); S.lunch = false; msg += '\n🍱 어제 싸 준 도시락 덕분에 점심이 행복했대요 (멘탈 +6)'; }
    if (!S.quit && S.day === 5) { S.money += 300; msg += '\n💰 월급날! 통장 +300만 원'; }
    S.money = Math.max(0, S.money - (S.quit ? 25 : 10)); msg += S.quit ? '\n💸 수입이 없어서 생활비 -25만 원' : '';
    if (S.tomorrow) { if ((S.tomorrow.mot || 0) > 0) S.mental = clamp(S.mental + 10, 0, 100); S.ap += S.tomorrow.ap || 0; S.tomorrow = null; }
  }
  Object.assign(S, { story: null });
  tie.visible = !S.quit; if (!S.quit) setShirt(H, 0xf4f4f4); else applyDecor();
  W.path = []; W.onArrive = null; W.pose = 'idle'; W.root.position.set(-1.0, 0, 1.9); W.root.rotation.y = -Math.PI / 2;
  if (S.quit) {
    lieDown(); H.sub = 'phone';
    toast(`💼 3화 · 백수 ${S.day - S.quitDay + 1}일차 저녁` + msg, 5000);
    setTimeout(() => { if (S && !S.over && !S.story) openStory(); }, 2200);
  } else {
    lieDown(); H.root.visible = false; H.state = 'commute';
    toast((first ? '💼 3화 · 회사 때려치겠다는 남편! 퇴사 욕구 100이 되면 진짜 사표를 내요' : `💼 ${S.day}일차 저녁 · 남편 퇴근 중…`) + msg, 5000);
    setTimeout(() => {
      if (!S || S.over) return; sfx('door'); H.inner.rotation.set(0, 0, 0); H.root.visible = true; H.root.position.set(0, 0, 5.9); H.root.rotation.y = Math.PI; H.pose = 'sigh'; H.shadow.visible = true; H.state = 'returning'; H.speed = 1.8;
      say(H, pick(['다녀왔어…', '하…… 나 왔어', '여보… 나 진짜 그만둘래']));
      walk(H, COUCH_SIDE[0], COUCH_SIDE[1], () => { H.speed = 2.5; lieDown(); render(); setTimeout(() => { if (S && !S.over && !S.story) openStory(); }, 600); });
      render();
    }, 1800);
  }
  closePanel(); render();
}
function quitNow() {
  if (S.quit || S.over) return; S.quit = true; S.quitDay = S.day; S.urge = 100; closePanel();
  if (H.pose === 'lie') standUp(); H.pose = 'cheer'; H.state = 'quitting'; sfx('win'); tie.visible = false; applyDecor();
  say(H, '나 사표 냈어!!!! 📝 이제 자유다!!'); emote(H, 'shock', 3000); emote(W, 'shock', 3000); pose(W, 'sigh', 2500);
  const p = H.headG.getWorldPosition(_v); burst(p.x, p.y + 0.4, p.z, 30, 0xffffff, 2.5, 0.2);
  setTimeout(() => { H.pose = 'idle'; lieDown(); render();
    showCard('<div class="em">📝</div><h2>남편이 사표를 냈어요!</h2><p>퇴사 욕구가 터졌어요. 이제부터 <b>백수 남편 모드</b>예요.</p><p>💡 부업을 키우면 <b>부부 창업</b>, 통장과 멘탈을 지키면 <b>쉬어가기</b>, 아무것도 안 하면… <b>퇴사 후 유튜버</b> 엔딩이 기다려요.</p><button class="primary" data-a="ok">어쩔 수 없지… 계속하기</button>', { ok: closeCard });
  }, 2200);
}
const QUIT_ACTS = {
  listen: { icon: '👂', name: '들어주기', run() {
    if (!canAct()) return; S.ap--; render();
    goHusband(() => { say(W, pick(['오늘 무슨 일 있었어? 다 말해 봐', '응응, 그래서? 다 들어 줄게', '당신 편이야, 무조건'])); pose(W, 'heart'); sfx('praise');
      setTimeout(() => { hSay(pick(['…사실 오늘 진짜 힘들었어', '말하니까 좀 낫다', '여보밖에 없어'])); hFace('smile'); qd('mental', 12 * Math.pow(0.8, S.used.listen || 0), ' 멘탈'); S.used.listen = (S.used.listen || 0) + 1; if (!S.quit) setTimeout(() => qd('urge', -6, ' 퇴사 욕구', '#8fe3b8'), 250); setTimeout(render, 500); }, 700); }); } },
  lunch: { icon: '🍱', name: '도시락', run() {
    if (!canAct()) return; if (S.lunch) { toast('내일 도시락은 이미 싸 뒀어요'); return; } S.ap--; render(); closePanel();
    walk(W, 4.2, -4.6, () => { faceTo(W, 4.2, -6); pose(W, 'work', 1500); sfx('water');
      setTimeout(() => { S.lunch = true; qd('money', -1, '만 원', '#ff8a7a'); say(W, '내일 도시락 완성! 🍱 (쪽지도 넣었지롱)'); setTimeout(() => hSay('헐… 도시락?! 내일 출근할 맛 난다'), 900); qd('mental', 6, ' 멘탈'); render(); }, 1500); }); } },
  treat: { icon: '🍖', name: '맛있는 거', run() {
    if (!canAct()) return; S.ap--; render(); closePanel();
    walk(W, 6.95, -4.35, () => { faceTo(W, 7.35, -5.5); pose(W, 'phone', 1500); say(W, '오늘 소고기 시켰다! 🍖');
      setTimeout(() => { sfx('bell'); chickenBox.visible = true; burst(-4.15, 0.9, -0.65, 10, 0xffc070, 0.8); qd('mental', 15, ' 멘탈'); setTimeout(() => qd('money', -5, '만 원', '#ff8a7a'), 300); hSay('고기…?! 살아갈 힘이 생긴다 🥹'); render(); }, 1600); }); } },
  budget: { icon: '📊', name: '가계부', run() {
    if (!canAct()) return; S.ap--; render();
    goHusband(() => { pose(W, 'photo', 1600); W.phone.visible = true; say(W, `우리 통장 ${S.money}만 원… 대출은 아직 이만큼 남았어`);
      setTimeout(() => { W.phone.visible = false; hSay('…현실 직시 완료. 조금만 더 다녀 볼게'); hFace('sad', 2000); if (!S.quit) qd('urge', -15, ' 퇴사 욕구', '#8fe3b8'); qd('mental', -8, ' 멘탈'); if (S.quit) qd('money', 8, '만 원 (절약)', '#ffd23a'); render(); }, 1400); }); } },
  side: { icon: '💡', name: '부업 응원', run() {
    if (!canAct()) return; S.ap--; closePanel();
    goHusband(() => { say(W, pick(['당신 하고 싶던 거 해 봐! 내가 응원할게', '그 빵 만들기 진짜 맛있었잖아!', '유튜브 편집 내가 도와줄게'])); busyDo('💡 부업 준비 중', done => {
      standUp(); H.state = 'working'; hSay('진짜? 그럼 오늘 좀 해 볼까!');
      walk(H, 12.5, -4.3, () => { H.root.position.set(12.5, 0, -4.35); H.root.rotation.y = Math.PI; H.pose = 'game'; sfx('scrub');
        setTimeout(() => { uprightAt(12.5, -3.6); H.pose = 'cheer'; say(H, '오… 이거 될 것 같은데?! 💡'); qd('side', S.quit ? 22 : 15, ' 부업', '#9fd8ff'); setTimeout(() => qd('mental', 5, ' 멘탈'), 300);
          setTimeout(() => { H.pose = 'idle'; walk(H, COUCH_SIDE[0], COUCH_SIDE[1], () => { lieDown(); done(); }); }, 1300); }, 2600); });
    }); }); } },
  trip: { icon: '✈️', name: '주말여행', run() {
    if (!canAct()) return; if (S.tripped) { toast('주말여행은 이번 주에 이미 잡았어요 ✈️'); return; } S.ap--; S.tripped = true; render();
    goHusband(() => { say(W, '이번 주말에 바다 보러 가자! 숙소 잡았어 ✈️'); pose(W, 'cheer'); sfx('win');
      setTimeout(() => { hSay('바다?! 여보 사랑해 😭'); hFace('smile', 2500); qd('mental', 25, ' 멘탈'); if (!S.quit) setTimeout(() => qd('urge', -20, ' 퇴사 욕구', '#8fe3b8'), 250); setTimeout(() => qd('money', -40, '만 원', '#ff8a7a'), 500); const p = H.headG.getWorldPosition(_v); burst(p.x, p.y + 0.3, p.z, 16, 0x8ecfff, 1, 0.25); setTimeout(render, 700); }, 700); }); } }
};
// 집안일 시키기
function command(c) {
  if (!canAct() || S.done[c.id]) return;
  if (remoteH()) {   // 부부 모드: 진짜 남편에게 물어봐요
    if (S.pending || S.accepted) { toast('남편이 이미 다른 부탁을 받고 있어요'); return; }
    S.ap--; S.pending = c.id; render();
    goHusband(() => { say(W, `여보~ ${c.name} 좀 해줄래?`); net({ k: 'req', c: c.id, r: reqOf(c), m: S.mot }); toast('남편 대답 기다리는 중… 🤔', 4000); syncNow(); });
    return;
  }
  if (H.state === 'hiding') { findHusband(); return; }
  if (H.state !== 'couch') { toast('남편이 아직 소파에 없어요'); return; }
  S.ap--; render();
  goHusband(() => {
    const r = reqOf(c); say(W, `여보~ ${c.name} 좀 해줄래?`);
    setTimeout(() => {
      let ok = S.mot >= r, grudge = false;
      if (!ok && S.mot >= r - 15 && Math.random() < 0.5) { ok = true; grudge = true; }
      if (ok) {
        S.mot = clamp(S.mot - Math.round(r * 0.5), 0, 100); S.done[c.id] = true; const tog = S.together; S.together = false;
        say(H, grudge ? '(투덜투덜) …알았어, 한다 해' : pick(['그래 알았어!', '오케이 맡겨!', '(끄응) 일어난다 일어나'])); emote(H, grudge ? 'flat' : 'smile'); sfx('ok'); render();
        setTimeout(() => sendHusband(c, tog), 900);
      } else {
        res(8); say(H, pick(['이따 할게~', '이거만 보고!', '내일 하면 안 돼?', '나 지금 바빠 (안 바쁨)'])); emote(H, 'flat'); sfx('no');
        toast(`거절당했어요 · 의욕이 ${r - S.mot} 더 필요해요 (칭찬이 제일 잘 먹혀요)`, 3500); render(); maybeSneak(); check();
      }
      syncNow();
    }, 900);
  });
}
function sendHusband(c, tog) {
  S.busy = true; standUp(); H.state = 'working'; setGloves(H, true); render();
  if (c.id === 'playkid') { kidPlaying = true; walk(K, -12.2, 3.7); }
  const work = () => {
    H.pose = 'work'; faceTo(H, c.look[0], c.look[1]);
    if (c.id === 'playkid') { H.pose = 'cheer'; K.pose = 'cheer'; faceTo(K, H.root.position.x, H.root.position.z); say(K, '꺄르르~ 비행기 태워 줘! 😆', false, 2500, true); } say(H, pick(['(열심)', '으쌰으쌰', '생각보다 할 만한데?'])); sfx(c.snd); let k = 0;
    const iv = setInterval(() => { const p = H.root.position; burst(p.x + Math.sin(H.root.rotation.y) * 0.5, 0.9, p.z + Math.cos(H.root.rotation.y) * 0.5, 4, c.fx, 0.8, 0.14); if (c.snd === 'water' && k % 4 === 0) sfx('water'); if (++k >= 10) { clearInterval(iv); finishChore(c, false); } }, 250);
  };
  if (c.id === 'vacuum') { sfx('vacuum'); const order = [0, 5, 1, 2, 3, 4]; walkSeq(H, [[c.spot[0], c.spot[1]]].concat(order.map(i => [DUST[i][0], DUST[i][1] + 0.45, () => { dusts[i].visible = false; burst(DUST[i][0], 0.3, DUST[i][1], 8, 0xd8d0c8, 0.8); sfx('scrub'); }])), () => { H.pose = 'work'; setTimeout(() => finishChore(c, false), 600); }); }
  else walk(H, c.spot[0], c.spot[1], work);
  if (tog) walk(W, c.wife[0], c.wife[1], () => { faceTo(W, c.look[0], c.look[1]); W.pose = 'work'; say(W, '같이 하니까 금방이다!'); });
}
function finishChore(c, byRemote, bonus = 0) {
  mess[c.id].visible = false; if (c.id === 'vacuum') dusts.forEach(d => d.visible = false);
  if (c.id === 'playkid') { kidPlaying = false; K.pose = 'idle'; say(K, '아빠 최고!! 💛', false, 3000, true); }
  const p = H.root.position; burst(p.x, 1, p.z, 26, 0xffe08a, 2, 0.22);
  S.habit[c.id] = (S.habit[c.id] || 0) + 1; S.done[c.id] = true; const gain = c.gain + bonus; S.hab = clamp(S.hab + gain, 0, 100); res(-3); sfx('ok');
  floatAt(H, `✨ 개조율 +${gain}%`, '#ffc08a'); toast(`${c.icon} ${c.name} 완료! 습관 ${S.habit[c.id]}회째 · 다음엔 더 쉬워져요`);
  if (!byRemote) { H.pose = 'cheer'; setGloves(H, S.stage >= 2); say(H, pick(['다 했어! 칭찬해줘!!', '나 좀 멋있지 않아?', '(뿌듯)'])); emote(H, 'smile', 2500); }
  if (W.pose === 'work') { W.pose = 'cheer'; setTimeout(() => { if (W.pose === 'cheer') W.pose = 'idle'; }, 1500); }
  S.accepted = null; updateOutfit(); render(); syncNow();
  if (byRemote) { check(); return; }
  setTimeout(() => { if (check()) return; H.pose = 'idle'; H.state = 'returning'; walk(H, COUCH_SIDE[0], COUCH_SIDE[1], () => { lieDown(); S.busy = false; render(); syncNow(); if (peerOn && ROLE === 'wife') enableRemote(); }); }, 1500);
}
// 개조율에 따라 옷이 바뀌어요
function updateOutfit(silent) {
  const st = S.hab >= 90 ? 3 : S.hab >= 60 ? 2 : S.hab >= 30 ? 1 : 0;
  H.apron.visible = H.strap.visible = st >= 1; H.band.visible = st >= 2; H.cape.visible = st >= 3; setGloves(H, st >= 2 || H.state === 'working');
  if (st > S.stage && !silent) { const msg = ['', '🧑‍🍳 남편이 앞치마를 둘렀어요!', '🧤 남편이 고무장갑과 머리띠를 장착했어요!', '🦸 남편에게 히어로 망토가 생겼어요!'][st]; setTimeout(() => toast(msg, 3500), 1800); }
  S.stage = st;
}
function check() {
  if (!S || S.over) return true;
  if (S.hab >= 100) {
    const id = peerOn ? 'couple' : S.day <= 5 ? 'speed' : 'legend';
    S.over = true; closePanel(); H.pose = 'cheer'; W.pose = 'heart'; burst(-1, 2, 0, 60, 0xffc0d0, 3, 0.3); sfx('win');
    setTimeout(() => endGame(id, '🦸', '개조 완료!', `${S.day}일 만에 성공! 남편이 퇴근하자마자 고무장갑을 끼고 "오늘 화장실은 내가 할게"라고 말합니다.`), 1800); return true;
  }
  if (S.res >= 100) {
    S.over = true; closePanel();
    if (remoteH()) { endGame('runaway', '🏃‍♂️💨', '남편 PC방 가출', '반발심이 폭발했어요. 잔소리는 적당히… 칭찬과 "같이 하자"가 제일 잘 먹혀요.'); return true; }
    if (H.state === 'couch') standUp(); H.state = 'leaving'; say(H, '나도 숨 좀 쉬자!!'); emote(H, 'angry', 5000); sfx('door');
    walkSeq(H, [[0, 5.0], [0, 9]], () => { H.root.visible = false; endGame('runaway', '🏃‍♂️💨', '남편 PC방 가출', '반발심이 폭발했어요. 잔소리는 적당히… 칭찬과 "같이 하자"가 제일 잘 먹혀요.'); }); return true;
  }
  return false;
}
function endDay() {
  if (!S || S.over || ROLE === 'husband') return; if (S.busy) { toast('남편이 일 끝나면 하루를 마칠 수 있어요'); return; }
  closePanel(); let txt = S.day >= 7 ? '일주일이 지났어요…' : `${S.day}일차 끝 · 잘 자요 💤`;
  if (EP === 'drink') txt = drinkNight() + (S.day >= 7 ? '\n일주일이 지났어요…' : '');
  if (EP === 'quit') txt = (S.quit ? `🛋️ 백수 ${S.day - S.quitDay + 1}일차 밤…\n통장 ${S.money}만 원` : `😮‍💨 ${S.day}일차도 버텼다!\n멘탈 ${Math.round(S.mental)}`) + (S.day >= 7 ? '\n일주일이 지났어요…' : '');
  night(txt, EP !== 'sofa' ? 2400 : 1600); net({ k: 'night', t: txt }); sfx('night');
  setTimeout(() => { S.res = clamp(S.res - 15, 0, 100); if (drunkOn()) S.tomorrow = { ap: -1, mot: -10, msg: '🤢 어제 그냥 둬서 남편이 숙취로 골골… 행동력 -1, 의욕 -10' }; if (S.day >= 7) finish(); else { S.day++; startDay(); } }, EP !== 'sofa' ? 2000 : 1200);
}
function night(t, ms = 1600) { $('night').textContent = t; $('night').classList.add('on'); setTimeout(() => $('night').classList.remove('on'), ms); }
function finish() {
  S.over = true;
  if (EP === 'quit') {
    const m = Math.round(S.mental); S.hab = m;
    if (!S.quit && S.offer && m >= 40) endGame('q_move', '🚀', '더 좋은 곳으로 이직!', `헤드헌터 제안을 잡았어요! 연봉도 오르고 칼퇴하는 회사로 이직 성공. 멘탈 ${m}, 통장 ${S.money}만 원. "여보 덕분이야" 소리 들었어요.`);
    else if (!S.quit && m >= 50) endGame('q_stay', '🏢', '웃으며 출근', `"그만둘래"가 "다녀올게!"로 바뀌었어요. 멘탈 ${m}으로 일주일 버티기 성공! 힘들 땐 또 들어 주기로.`);
    else if (!S.quit) endGame('q_burn', '😵', '번아웃 직장인', `그만두진 않았지만 멘탈 ${m}… 남편이 출근길에 영혼을 두고 가요. 들어 주기와 맛있는 거가 더 필요해요.`);
    else if (S.side >= 70) endGame('q_startup', '💑', '부부 창업 대박!', `사표 내고 키운 부업(${Math.round(S.side)}%)으로 둘이 가게를 차렸어요. 오픈 첫날 줄이 섰어요! 통장 ${S.money}만 원.`);
    else if (S.money >= 200 && m >= 60) endGame('q_rest', '🌴', '한 달 쉬어가기', `통장 ${S.money}만 원, 멘탈 ${m}. 한 달 푹 쉬고 더 잘 맞는 일을 찾기로 했어요. 쉼도 실력!`);
    else endGame('q_youtube', '📹', '퇴사 후 유튜버 (구독자 12명)', `아무 준비 없이 퇴사하고 "퇴사 브이로그"를 시작했어요. 구독자 12명 중 5명이 가족… 통장 ${S.money}만 원. 부업 응원을 미리 해 둘걸!`);
    return;
  }
  if (EP === 'drink') {
    const n = S.cal.filter(Boolean).length; S.hab = Math.round(n / 7 * 100);
    if (n >= 7) endGame('d7', '🍀', '7일 금주 성공!', '일주일 내내 한 방울도 안 마셨어요! 남편 얼굴에 광이 나고 뱃살이 쏙 들어갔어요. 이제 맥주 대신 탄산수로 건배!');
    else if (n >= 5) endGame('d5', '😌', '거의 금주 성공', `금주 도장 ${n}개! 딱 한두 번 무너졌지만 이 정도면 대단해요. 다음 주엔 7개 가 보자고요.`);
    else if (n >= 3) endGame('d3', '🙂', '반쯤 참았어요', `금주 도장 ${n}개. 유혹 전화가 오면 바로 거절 멘트를 골라 주는 게 핵심이에요!`);
    else endGame('dwhale', '🐳', '술고래 그대로…', `금주 도장 ${n}개… 남편은 여전히 바다를 헤엄치는 술고래예요. 팁: 술 숨기기 → 탄산수 → 산책!`);
    return;
  }
  const h = S.hab;
  if (h >= 70) endGame('almost', '😎', '거의 개조됨', `개조율 ${h}%. 시키면 군말 없이 해요. 스스로 하는 날도 머지않았어요!`);
  else if (h >= 40) endGame('half', '🙂', '반쯤 개조됨', `개조율 ${h}%. 설거지까지는 해요. 화장실은… 아직 미지의 영역.`);
  else endGame('sofa', '🛋️', '소파 일체형 남편', `개조율 ${h}%. 일주일이 지났지만 남편은 여전히 소파와 한 몸이에요. 팁: 칭찬 2번 → 같이 하자 → 시키기!`);
}
function endGame(id, em, title, text, fromNet) {
  if (S) { S.over = true; S.ending = id; }
  const got = store.get('endings', []); const extra = [];
  if (S && S.chickens >= 5) extra.push('chicken');
  if (S && S.selfCount >= 3) extra.push('self');
  if (S && S.drunkSaved >= 1) extra.push('drunk');
  if (S && S.workouts >= 5) extra.push('dgym');
  const add = [id, ...extra].filter(e => !got.includes(e)); store.set('endings', got.concat(add));
  if (!fromNet) net({ k: 'end', id, em, title, text, ch: S ? S.chickens : 0, sc: S ? S.selfCount : 0 });
  const newOnes = add.map(e => ENDINGS.find(x => x.id === e)).filter(Boolean);
  showCard(`<div class="em">${em}</div><h2>${title}</h2><p>${text}</p>${newOnes.length ? `<p><b>📖 새 엔딩:</b> ${newOnes.map(e => e.icon + ' ' + e.name).join(', ')}</p>` : ''}
    <button class="primary" data-a="share">📤 결과 공유하기</button>${ROLE !== 'husband' ? '<button class="ghost" data-a="again">다시 하기</button>' : ''}<button class="ghost" data-a="book">📖 엔딩 도감</button>`,
    { share: () => shareResult(title), again: () => { closeCard(); openStart(); }, book: openBook });
  render();
}

// =====================================================================
// 부부 모드 네트워크
// =====================================================================
let ws = null, roomCode = null, netClosing = false, syncAcc = 0, hSendAcc = 0;
function net(d) { if (!peerOn || ROLE === 'solo' || !ws || ws.readyState !== 1) return; try { ws.send(JSON.stringify({ type: 'msg', d })); } catch {} }
function netConnect(role, code, onJoined) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  try { ws = new WebSocket(`${proto}://${location.host}/house-ws`); } catch { toast('서버에 연결할 수 없어요'); return; }
  ws.onopen = () => ws.send(JSON.stringify({ type: 'join', role, code: code || null }));
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } onNet(m, onJoined); };
  ws.onclose = () => { const was = peerOn; peerOn = false; if (was) peerLeft(true); if (!netClosing && roomCode) { toast('연결이 끊겼어요. 다시 연결하는 중…'); setTimeout(() => netConnect(ROLE, roomCode), 2500); } };
}
function onNet(m, onJoined) {
  if (m.type === 'joined') { roomCode = m.code; onJoined && onJoined(m); if (m.peer) peerJoined(); }
  else if (m.type === 'error') { toast(m.msg, 4500); if (ROLE === 'husband' && !S) { netClosing = true; ws.close(); openStart(m.msg); } }
  else if (m.type === 'peer-join') peerJoined();
  else if (m.type === 'peer-leave') peerLeft();
  else if (m.type === 'msg' && m.d && typeof m.d === 'object') onMsg(m.d);
}
function peerJoined() {
  peerOn = true; setTags();
  if (ROLE === 'wife') { toast('💑 남편이 들어왔어요! 이제 진짜 남편이 움직여요', 4000); sfx('heart'); if (!S.busy) enableRemote(); syncNow(); }
  else { closeCard(); toast('💑 아내와 연결됐어요!', 3000); net({ k: 'hello' }); sendH(); }
  render();
}
function peerLeft(soft) {
  peerOn = false; setTags();
  if (ROLE === 'wife') {
    if (S && remoteH()) { H.state = 'returning'; H.pose = 'idle'; S.pending = null; S.accepted = null; walk(H, COUCH_SIDE[0], COUCH_SIDE[1], () => { lieDown(); render(); }); }
    if (!soft) toast('남편이 나갔어요. 다시 들어올 때까지 AI 남편이 대신해요', 4000);
  } else if (!soft) { showCard('<div class="em">🚪</div><h2>아내가 나갔어요</h2><p>아내가 같은 방으로 다시 들어오면 이어서 할 수 있어요.</p>', {}); }
  render();
}
function enableRemote() { if (!peerOn || ROLE !== 'wife') return; if (drunkOn()) { S.drunk = 0; H.drunk = false; H.root.visible = true; drunkMess.clear(); } H.state = 'remote'; H.path = []; H.net = { x: H.root.position.x, z: H.root.position.z, ry: H.root.rotation.y, pose: H.pose, lie: H.pose === 'lie' }; }
function snapshot() {
  return { k: 'st', S: { day: S.day, ap: S.ap, mot: S.mot, res: S.res, hab: S.hab, done: S.done, tvOff: S.tvOff, tv: S.tv, over: S.over, together: S.together, pers: S.pers, extra: S.extra, habit: S.habit, pending: S.pending, accepted: S.accepted, mod: S.mod, chickens: S.chickens, selfCount: S.selfCount, stage: S.stage, gifted: S.gifted },
    mess: Object.fromEntries(Object.keys(mess).map(k => [k, mess[k].visible ? 1 : 0])), dust: dusts.map(d => d.visible ? 1 : 0), ck: chickenBox.visible ? 1 : 0, rm: remote.visible ? 1 : 0, decor,
    W: [W.root.position.x, W.root.position.z, W.root.rotation.y].map(v => Math.round(v * 100) / 100).concat([W.pose, W.face]) };
}
function syncNow() { if (ROLE === 'wife' && peerOn && S) net(snapshot()); }
function sendH() { if (ROLE !== 'husband') return; net({ k: 'h', x: Math.round(H.root.position.x * 100) / 100, z: Math.round(H.root.position.z * 100) / 100, ry: Math.round(H.root.rotation.y * 100) / 100, pose: H.pose, lie: H.pose === 'lie' ? 1 : 0, f: H.face }); }
function onMsg(d) {
  const who = d.w === 'W' ? W : H;
  switch (d.k) {
    case 'say': if (typeof d.t === 'string') say(who, d.t.slice(0, 80), !!d.e, 0, true); return;
    case 'fl': if (typeof d.t === 'string') floatAt(who, d.t.slice(0, 30), String(d.c || '#fff').slice(0, 12), true); return;
    case 'fx': if (Array.isArray(d.p)) burst(+d.p[0] || 0, +d.p[1] || 0, +d.p[2] || 0, clamp(d.n | 0, 0, 40), d.c | 0, +d.s || 1, +d.z || 0.2, true); return;
    case 'sfx': sfx(d.s, true); return;
    case 'toast': if (ROLE === 'husband' && typeof d.t === 'string') toast(d.t.slice(0, 120), 4000); return;
  }
  if (ROLE === 'wife') {
    if (d.k === 'hello') { syncNow(); return; }
    if (d.k === 'h') { if (!remoteH() && S && !S.busy && H.state !== 'leaving') enableRemote(); if (remoteH()) H.net = d; return; }
    if (d.k === 'ans' && S && S.pending === d.c) {
      const c = ALL[d.c]; S.pending = null;
      if (d.a === 'yes') { S.accepted = d.c; toast(`🎉 남편이 ${c.name} 한대요!`, 3000); sfx('ok'); emote(W, 'smile'); }
      else if (d.a === 'praise') { toast('😏 남편이 "칭찬해 주면 할게"래요. 칭찬 한 번 해 줘요', 4000); }
      else { toast('😮‍💨 남편이 이따가 한대요…', 3000); emote(W, 'sad'); }
      render(); syncNow(); return;
    }
    if (d.k === 'vol' && S && ALL[d.c] && !S.done[d.c] && !S.accepted && !S.over) { const c = ALL[d.c]; S.accepted = d.c; S.vol = d.c; S.selfCount++; toast(`🥹 남편이 스스로 ${c.name} 한대요!! (보너스 +5%)`, 4000); sfx('win'); emote(W, 'shock', 2500); say(W, '어머 웬일이야?!'); render(); syncNow(); return; }
    if (d.k === 'done' && S && S.accepted === d.c && !S.over) { const c = ALL[d.c]; const bonus = S.vol === d.c ? 5 : 0; S.vol = null; finishChore(c, true, bonus); return; }
    if (d.k === 'gift' && S && GIFTS[d.g] && !S.gifted[d.g] && !S.over) { receiveGift(d.g); return; }
    if (d.k === 'emo') { if (d.e === 'heart') { const p = H.headG.getWorldPosition(_v); burst(p.x, p.y + 0.3, p.z, 10, 0xff6a9a, 0.8, 0.25); sfx('heart'); toast('💛 남편이 하트를 보냈어요', 2000); res(-3); render(); } else if (d.e === 'praiseme') { toast('🥺 남편이 칭찬해 달래요', 2500); } return; }
  }
  if (ROLE === 'husband') {
    if (d.k === 'st') { applyState(d); return; }
    if (d.k === 'req' && ALL[d.c]) { openRequest(ALL[d.c], d.m | 0, d.r | 0); sfx('bell'); return; }
    if (d.k === 'night' && typeof d.t === 'string') { night(d.t); sfx('night', true); return; }
    if (d.k === 'end') { if (S) { S.chickens = d.ch | 0; S.selfCount = d.sc | 0; } endGame(String(d.id), String(d.em).slice(0, 8), String(d.title).slice(0, 30), String(d.text).slice(0, 200), true); return; }
    if (d.k === 'thanks') { const m = { love: '💛 아내가 고마워해요! (의욕 +12)', kiss: '😘 아내가 뽀뽀해 줬어요! (의욕 +18)', what: '🤨 아내가 의심해요… 억울하다 ㅋㅋ' }[d.r]; if (m) toast(m, 3000); if (d.r !== 'what') { const p = H.headG.getWorldPosition(_v); burst(p.x, p.y + 0.3, p.z, 12, 0xff6a9a, 0.9, 0.25, true); sfx('heart', true); } return; }
    if (d.k === 'emo' && d.e === 'heart') { const p = W.headG.getWorldPosition(_v); burst(p.x, p.y + 0.3, p.z, 10, 0xff6a9a, 0.8, 0.25); sfx('heart'); return; }
  }
}
let lastDay = 0;
function applyState(d) {
  const first = !S;
  S = Object.assign(S || { used: {} }, d.S); S.busy = false;
  if (first) { applyPers(); updateOutfit(true); }
  for (const k in d.mess) if (mess[k]) mess[k].visible = !!d.mess[k];
  if (Array.isArray(d.dust)) d.dust.forEach((v, i) => dusts[i] && (dusts[i].visible = !!v));
  chickenBox.visible = !!d.ck; remote.visible = !!d.rm;
  if (d.decor && JSON.stringify(d.decor) !== JSON.stringify(decor)) { decor = d.decor; applyDecor(); }
  if (Array.isArray(d.W)) { W.net = { x: d.W[0], z: d.W[1], ry: d.W[2], pose: d.W[3] }; if (d.W[4]) setFace(W, d.W[4]); }
  if (lastDay && S.day !== lastDay) { setGloves(H, S.stage >= 2); }
  lastDay = S.day; updateOutfit(first); setTags(); render();
  if (S.accepted && !hJob) { hJob = { id: S.accepted, n: 0 }; toast(`🧽 ${ALL[S.accepted].name} 하러 가요! 아래 버튼을 눌러요`, 3500); }
  if (!S.accepted) hJob = null;
}
// 남편 쪽: 받은 부탁
let hJob = null;
function openRequest(c, m, r) {
  const mood = m >= r ? '아내가 정성을 많이 들였어요 💛' : m >= r - 15 ? '아내가 살짝 정성을 들였어요' : '아내가 그냥 부탁했어요';
  openPanel(`<div class="q">🙋‍♀️ 아내: "여보~ <b>${c.name}</b> 좀 해줄래?"<br><small>${mood} · 의욕 ${m} / ${r}</small></div>`,
    [{ t: '🙆 할게!', cls: 'go', f: () => { net({ k: 'ans', c: c.id, a: 'yes' }); say(H, pick(['그래 알았어!', '오케이 맡겨!'])); emote(H, 'smile'); closePanel(); } },
     { t: '😏 칭찬해 주면 할게', f: () => { net({ k: 'ans', c: c.id, a: 'praise' }); say(H, '칭찬해 주면 할게~'); closePanel(); } },
     { t: '🙅 이따가…', f: () => { net({ k: 'ans', c: c.id, a: 'no' }); say(H, pick(['이따 할게~', '이거만 보고!'])); emote(H, 'flat'); closePanel(); } }], true);
}
function hGoJob() {
  if (!hJob) return; const c = ALL[hJob.id];
  if (H.pose === 'lie') standUp();
  setGloves(H, true);
  walk(H, c.spot[0], c.spot[1], () => { faceTo(H, c.look[0], c.look[1]); toast(`🧽 문지르기 버튼을 8번 눌러요!`, 2500); renderControls(); });
  renderControls();
}
function hScrub() {
  if (!hJob) return; const c = ALL[hJob.id]; const p = H.root.position;
  if (Math.hypot(p.x - c.spot[0], p.z - c.spot[1]) > 0.8) { hGoJob(); return; }
  hJob.n++; pose(H, 'work', 600); sfx(c.snd === 'vacuum' ? 'scrub' : c.snd); burst(p.x + Math.sin(H.root.rotation.y) * 0.5, 0.9, p.z + Math.cos(H.root.rotation.y) * 0.5, 5, c.fx, 0.8, 0.15);
  if (hJob.n >= 8) { net({ k: 'done', c: c.id }); say(H, '다 했다! 😎'); pose(H, 'cheer', 1500); emote(H, 'smile'); hJob = null; setGloves(H, S.stage >= 2); }
  renderControls();
}
function hLie() { if (H.pose === 'lie') { standUp(); renderControls(); return; } walk(H, COUCH_SIDE[0], COUCH_SIDE[1], () => { lieDown(); H.state = 'me'; renderControls(); }); }

// =====================================================================
// 화면 (버튼 · 패널 · 모달)
// =====================================================================
function lbtn(i, t, f, o = {}) { return { i, t, f, ...o }; }
let panelOpen = false, panelSticky = false;
function openPanel(html, choices, sticky) {
  panelOpen = true; panelSticky = !!sticky; const el = $('bpanel'); el.innerHTML = html || ''; el.classList.add('show'); el.scrollTop = 0; $('menu').classList.remove('show');
  choices.forEach(c => { const b = document.createElement('button'); b.className = 'ch' + (c.cls ? ' ' + c.cls : ''); b.innerHTML = c.t + (c.s ? `<small>${c.s}</small>` : '') + (c.pb != null ? `<div class="pb"><b style="width:${c.pb}%"></b></div>` : ''); b.disabled = !!c.dis; b.onclick = () => { sfx('tap', true); c.f(); }; el.appendChild(b); });
  if (!sticky) { const b = document.createElement('button'); b.className = 'ch close'; b.textContent = '닫기 ✕'; b.onclick = closePanel; el.appendChild(b); }
}
function closePanel() { panelOpen = false; panelSticky = false; renderControls(); }
function openChores() {
  if (!S || S.over) return;
  const list = todays().map(c => { const r = reqOf(c), d = S.done[c.id], pct = d ? 100 : Math.min(100, S.mot / r * 100);
    const st = d ? '✅ 오늘 끝!' : remoteH() ? `필요 의욕 ${r} · 진짜 남편에게 물어봐요` : S.mot >= r ? '지금 하면 해요!' : S.mot >= r - 15 ? '반반… 투덜대며 할 수도' : `의욕 ${r - S.mot} 부족`;
    return { t: `${c.extra ? '⭐ ' : ''}${c.icon} ${c.name} <small style="display:inline;color:#e9c46a">+${c.gain}%</small>`, s: `${c.room} · ${st}`, pb: pct, dis: d || S.ap <= 0 || S.busy, cls: !d && S.mot >= r && !remoteH() ? 'hot' : '', f: () => command(c) }; });
  openPanel(`<div class="q">🧹 무슨 집안일을 부탁할까요?<br><small>남편 의욕 ${S.mot}${S.together ? ' · 🤝 같이 하자 적용 중' : ''}</small></div>`, list);
}
function renderControls() {
  const lc = $('lcol'), bp = $('bpanel');
  const B = [];   // 아래 줄 버튼: { i, t, f, dis, hot, main }
  if (S && ROLE === 'husband') {
    if (hJob) { const c = ALL[hJob.id], p = H.root.position, at = Math.hypot(p.x - c.spot[0], p.z - c.spot[1]) < 0.8;
      B.push(at ? lbtn('🧽', `문지르기 ${hJob.n}/8`, hScrub, { main: true, hot: true }) : lbtn('🧽', `${c.name} 하러`, hGoJob, { main: true, hot: true })); }
    else B.push(lbtn('🙋', '스스로 하기', () => {
      openPanel('<div class="q">🙋 뭘 해 볼까요? <small>아내가 엄청 놀랄 거예요</small></div>', todays().filter(c => !S.done[c.id]).map(c => ({ t: `${c.icon} ${c.name}`, s: `${c.room} · +${c.gain + 5}%`, dis: !!S.accepted || S.over, f: () => { net({ k: 'vol', c: c.id }); say(H, `${c.name} 내가 할게!`); closePanel(); } })));
    }, { main: true, dis: S.over || !!S.accepted }));
    const gd = k => !S || S.over || (S.gifted && S.gifted[k]);
    B.push(lbtn('🎁', '선물', () => hGift('gift'), { dis: gd('gift'), hot: !gd('gift') }), lbtn('☕', '커피', () => hGift('coffee'), { dis: gd('coffee') }), lbtn('💐', '꽃', () => hGift('flower'), { dis: gd('flower') }), lbtn('💆', '안마', () => hGift('massage'), { dis: gd('massage') }),
      lbtn('💛', '하트', () => { net({ k: 'emo', e: 'heart' }); pose(H, 'heart', 1500); const p = H.headG.getWorldPosition(_v); burst(p.x, p.y + 0.3, p.z, 10, 0xff6a9a, 0.8, 0.25, true); sfx('heart', true); }),
      lbtn('🥺', '칭찬해줘', () => { net({ k: 'emo', e: 'praiseme' }); say(H, '나 칭찬해 줘…🥺'); }),
      lbtn(H.pose === 'lie' ? '🧍' : '🛋️', H.pose === 'lie' ? '일어나기' : '눕기', hLie));
  } else if (S && drunkOn()) {
    B.push(lbtn('🛌', H.state === 'out' ? '귀가 중…' : `재우기 ${S.drunk}%`, putToBed, { main: true, hot: S.drunk <= 40 && H.state === 'drunk', dis: S.over || H.state !== 'drunk' }));
    Object.entries(DRUNK_ACTS).forEach(([k, a]) => B.push(lbtn(a.icon, a.name.replace(' 스매싱', '').replace(' 벗기기', '').replace('증거 ', ''), () => a.run(), { dis: S.over || (k !== 'photo' && S.ap <= 0) || (k === 'photo' && S.photo) || (k === 'socks' && !S.socks) })));
  } else if (S && EP === 'quit') {
    B.push(lbtn('👂', '들어주기', () => QUIT_ACTS.listen.run(), { main: true, hot: S.mental < 35 && S.ap > 0, dis: S.over || S.ap <= 0 || S.busy }));
    ['lunch', 'treat', 'budget', 'side', 'trip'].forEach(k => { const a = QUIT_ACTS[k]; B.push(lbtn(a.icon, a.name, () => a.run(), { dis: S.over || S.ap <= 0 || S.busy || (k === 'trip' && S.tripped) || (k === 'lunch' && S.lunch), hot: k === 'side' && S.quit })); });
  } else if (S && EP === 'drink') {
    B.push(lbtn('🥤', '탄산수', () => DRINK_ACTS.soda.run(), { main: true, hot: S.crave >= 60 && S.ap > 0, dis: S.over || S.ap <= 0 || S.busy || S.midnight }));
    ['praise', 'nag', 'hide', 'walk', 'gym'].forEach(k => { const a = DRINK_ACTS[k]; B.push(lbtn(a.icon, a.name.replace('같이 ', '').replace('술 ', ''), () => a.run(), { dis: S.over || S.ap <= 0 || S.busy || S.midnight || (k === 'hide' && S.hidden) })); });
  } else if (S) {
    const can = todays().some(c => !S.done[c.id] && S.mot >= reqOf(c));
    B.push(lbtn('🧹', S.pending ? '대답 기다림' : S.accepted ? '하는 중…' : '시키기', openChores, { main: true, hot: can && !S.busy && !remoteH(), dis: S.over || S.busy }));
    Object.entries(TACTICS).forEach(([k, t]) => B.push(lbtn(t.icon, t.name.replace(' 하자', ''), () => useTactic(k), { dis: S.over || S.ap <= 0 || S.slept })));
    B.push(lbtn('🍗', '치킨', useChicken, { dis: S.over || S.ap <= 0 || S.used.chicken }), lbtn('🙈', '리모컨', useRemote, { dis: S.over || S.ap <= 0 || S.tvOff }));
  }
  lc.innerHTML = ''; lc.style.display = B.length ? '' : 'none';
  B.forEach(b => { const e = document.createElement('button'); e.className = 'lb' + (b.main ? ' main' : '') + (b.hot ? ' hot' : ''); e.innerHTML = `<span class="i">${b.i}</span>${b.t}`; e.disabled = !!b.dis; e.onclick = () => { sfx('tap', true); b.f(); }; lc.appendChild(e); });
  bp.classList.toggle('show', panelOpen);
}
function stateText() {
  if (!S) return '';
  if (drunkOn()) return H.state === 'out' ? '🚪 귀가 중…' : `🍺 만취 ${S.drunk}%`;
  if (S.slept) return '💤 꿀잠 중';
  if (H.state === 'gifting') return '🎁 뭔가 준비 중…';
  if (EP !== 'sofa' && S.busyLabel) return S.busyLabel;
  if (EP === 'quit') { if (H.state === 'commute') return '🚇 퇴근 중…'; if (S.quit) return `🛋️ 백수 ${S.day - S.quitDay + 1}일차`; if (S.story) return '💬 하소연 중…'; return S.urge >= 80 ? '📝 사직서 쓰는 중…' : S.urge >= 50 ? '😩 그만둘까 고민 중' : '🙂 그럭저럭 버티는 중'; }
  if (H.state === 'hiding') return H.hide ? H.hide.label : '🫣 숨어 있음';
  if (H.state === 'sneaking') return '🤫 슬금슬금';
  if (H.state === 'leaving') return '💢 가출 중';
  if (H.state === 'working' || (hJob && ROLE === 'husband')) return '🧽 집안일 하는 중';
  if (S.accepted) return '🧽 집안일 하는 중';
  if (S.pending) return '🤔 고민 중…';
  if (EP === 'drink') { if (S.relapsed) return '🏪 편의점 가는 중…'; if (S.tempt) return '📞 유혹 받는 중!'; if (S.midnight) return '😴 잠듦 · 오늘 버팀!'; return S.crave >= 80 ? '😵 술 생각 폭발 직전' : S.crave >= 50 ? '🍺 맥주 생각 중…' : '😌 잘 버티는 중'; }
  if (S.res >= 70) return '😤 단단히 삐짐';
  if (H.pose === 'lie') return S.mot >= 60 ? '😆 의욕 충전 완료' : S.mot >= 30 ? '🙂 일어날까 고민 중' : '🛋️ 소파 흡착 중';
  return S.mot >= 60 ? '😆 뭐든 할 기세' : '🚶 돌아다니는 중';
}
function renderBars() {
  if (!S) return;
  const L = (id, t) => { $(id).textContent = t; };
  if (EP === 'drink') {
    const n = S.cal.filter(Boolean).length;
    $('dayTxt').textContent = `${S.day}일차 · ${clockStr()}`;
    L('l1', '참을성'); $('mot').style.width = S.will + '%'; $('motV').textContent = Math.round(S.will); $('mot').style.background = '#ffd23a';
    L('l2', '술 생각'); $('res').style.width = S.crave + '%'; $('resV').textContent = Math.round(S.crave); $('res').style.background = S.crave >= 80 ? '#ef4a4a' : '#ff9a4a';
    L('l3', '금주'); $('hab').style.width = (n / 7 * 100) + '%'; $('habV').textContent = `${n}/7`;
    $('calRow').classList.add('show'); $('calRow').innerHTML = Array.from({ length: 7 }, (_, i) => `<i class="${S.cal[i] === 1 ? 'ok' : S.cal[i] === 0 ? 'no' : ''}${i === S.day - 1 && !S.over ? ' today' : ''}">${S.cal[i] === 1 ? '✓' : S.cal[i] === 0 ? '✕' : i + 1}</i>`).join('');
  } else if (EP === 'quit') {
    $('dayTxt').textContent = `${S.day}일차${S.quit ? ' · 백수' : ''}`;
    L('l1', '멘탈'); $('mot').style.width = S.mental + '%'; $('motV').textContent = Math.round(S.mental); $('mot').style.background = S.mental < 30 ? '#ef6a5a' : '#5fd38d';
    L('l2', S.quit ? '부업' : '퇴사욕구'); const u = S.quit ? S.side : S.urge; $('res').style.width = u + '%'; $('resV').textContent = Math.round(u); $('res').style.background = S.quit ? '#4fb8ff' : u >= 80 ? '#ef4a4a' : '#ff9a4a';
    L('l3', '통장'); $('hab').style.width = Math.min(100, S.money / 6) + '%'; $('habV').textContent = `${S.money}만`;
    $('calRow').classList.remove('show');
  } else {
    $('dayTxt').textContent = `${S.day}일차 / 7`;
    L('l1', '의욕'); L('l2', '반발'); L('l3', '개조'); $('mot').style.background = '#5fd38d'; $('res').style.background = '#ef6a5a'; $('calRow').classList.remove('show');
    $('mot').style.width = S.mot + '%'; $('motV').textContent = S.mot; $('res').style.width = S.res + '%'; $('resV').textContent = S.res >= 70 ? S.res + ' 삐짐' : S.res; $('hab').style.width = S.hab + '%'; $('habV').textContent = S.hab + '%';
  }
  HL.state.textContent = stateText();
  if (drunkOn()) { HL.bar.style.width = S.drunk + '%'; HL.num.textContent = '🍺' + S.drunk; HL.bar.style.background = '#ff9a4a'; }
  else if (EP === 'quit') { HL.bar.style.width = S.mental + '%'; HL.num.textContent = '🧠' + Math.round(S.mental); HL.bar.style.background = S.mental < 30 ? '#ef6a5a' : '#5fd38d'; }
  else if (EP === 'drink') { HL.bar.style.width = S.crave + '%'; HL.num.textContent = '🍺' + Math.round(S.crave); HL.bar.style.background = S.crave >= 80 ? '#ef4a4a' : '#ff9a4a'; }
  else { HL.bar.style.width = S.mot + '%'; HL.num.textContent = S.mot; HL.bar.style.background = S.res >= 70 ? '#ef6a5a' : '#5fd38d'; }
}
function render() {
  if (!S) { renderControls(); return; }
  renderBars();
  $('apBox').innerHTML = (ROLE === 'husband' ? '아내 ' : '') + '⚡' + Array.from({ length: Math.max(AP_MAX, S.ap) }, (_, i) => `<span class="${i < S.ap ? (i >= AP_MAX ? 'bonus' : '') : 'off'}"></span>`).join('');
  $('whoTxt').textContent = `${PERS[S.pers].icon} ${PERS[S.pers].name}` + (ROLE === 'solo' ? ' · 혼자 하기' : ROLE === 'wife' ? (peerOn ? ` · 💑 남편 접속 중 (방 ${roomCode})` : ` · 방 ${roomCode || '…'} · 남편 기다리는 중`) : (peerOn ? ' · 💑 아내와 연결됨' : ' · 아내 기다리는 중'));
  $('endBtn').disabled = ROLE === 'husband' || S.busy || S.over;
  screenMat.color.set(S.tvOff ? 0x0b0b10 : S.tv ? 0x3fbf5a : 0x5a8cff); tvL.intensity = S.tvOff ? 0 : 5;
  plantOk.visible = !mess.plant.visible; bedNeat.visible = !mess.bed.visible; hung.visible = !mess.hang.visible;
  renderControls();
  if (panelOpen && !panelSticky && ROLE !== 'husband' && $('bpanel').querySelector('.q') && $('bpanel').querySelector('.q').textContent.startsWith('🧹')) openChores();
}
// 모달
function showCard(html, actions) {
  $('modalCard').innerHTML = html; $('modal').classList.remove('hide');
  $('modalCard').querySelectorAll('[data-a]').forEach(b => b.onclick = () => { sfx('tap', true); actions[b.dataset.a] && actions[b.dataset.a](b); });
}
function closeCard() { $('modal').classList.add('hide'); }
const HELP = `<p>🛋️ 소파와 한 몸이 된 남편을 7일 안에 <b>스스로 집안일 하는 남자</b>로 개조해요.</p>
<p>💬 왼쪽 버튼을 누르면 아내가 남편에게 걸어가서 작전을 써요. 의욕이 차면 🧹 <b>집안일 시키기</b>가 반짝여요.</p>
<p>✨ 같은 일을 할수록 습관이 돼서 쉬워지고, 개조율이 오르면 남편 옷이 바뀌어요. 매일 ⭐ 특별 집안일도 생겨요.</p>
<p>😤 잔소리를 너무 하면 남편이 몰래 숨거나, 반발심 100이면 가출해요.</p>
<p>🏠 집이 넓어졌어요! 🛏️ 안방, 🧸 아이 방, 🎮 남편 방, 🌙 베란다에도 할 일이 있고, 반발심이 높으면 남편이 게임방이나 침대, 베란다로 숨어요.</p>
<p>🎁 남편 기분이 좋으면 몰래 선물·커피·꽃·안마를 해 줘요. 아내 에너지(⚡)가 늘고, 아내 반응에 따라 남편 의욕이 달라져요. 부부 모드에선 진짜 남편이 직접 해요!</p>
<p>🍺 회식 날엔 남편이 술 취해 들어와요. 🍯 꿀물, 🖐️ 등짝 스매싱, 🧦 양말 벗기기로 술을 깨우고 소파에 재우면 다음 날 반성 모드! 그냥 두면 숙취로 고생해요.</p>
<p>💑 <b>부부 같이 하기</b>를 고르면 링크를 남편에게 보내요. 남편이 자기 폰으로 들어와서 부탁을 받거나 거절하고, 직접 걸어가서 집안일을 해요.</p>
<p>팁: <b>칭찬 2번 → 같이 하자 → 시키기</b></p>`;
const HELP2 = `<p>🍺 매일 저녁 6시부터 자정까지, 남편의 <b>술 생각</b>이 100이 되지 않게 지켜요. 버티면 금주 달력에 ✅ 도장!</p>
<p>📞 부장님 전화, 친구 단톡, 야구 중계 같은 <b>유혹</b>이 오면 9초 안에 거절 멘트를 골라 줘요. 늦으면 남편이 알아서 대답하는데… 보통 망해요.</p>
<p>🥤 탄산수, 🫙 술 숨기기, 🚶 같이 산책, 💪 홈트로 술 생각을 낮추고, 💬 칭찬으로 <b>참을성</b>을 키우면 술 생각이 천천히 올라요. 📢 잔소리는 스트레스라 오히려 술 생각이 올라요.</p>
<p>🌙 를 일찍 누르면 남은 시간 동안 올라갈 술 생각까지 계산해요. 100을 넘으면 밤에 몰래 편의점행…</p>
<p>🏪 못 참고 마시면 취해서 돌아와요. 꿀물·양말 벗기기로 재우면 다음 날 반성해서 참을성이 올라요.</p>`;
const HELP3 = `<p>💼 매일 저녁 남편이 퇴근하며 <b>회사 이야기</b>를 털어놔요. 어떻게 대답하느냐에 따라 <b>멘탈</b>과 <b>퇴사 욕구</b>가 바뀌어요.</p>
<p>👂 들어주기, 🍱 도시락, 🍖 맛있는 거, ✈️ 주말여행은 멘탈을 올리고, 📊 가계부는 퇴사 욕구를 확 낮추지만 멘탈이 깎여요. 💡 부업 응원은 부업을 키워요.</p>
<p>📝 퇴사 욕구가 100이 되면 남편이 진짜 <b>사표</b>를 내고 백수 모드가 돼요. 수입이 없어서 통장이 줄어요!</p>
<p>🏁 엔딩: 안 그만두면 <b>웃으며 출근 / 번아웃</b>, 헤드헌터 제안을 잡고 멘탈을 지키면 <b>이직</b>, 사표 낸 뒤엔 부업에 따라 <b>부부 창업 / 쉬어가기 / 퇴사 후 유튜버</b>.</p>`;
function helpText() { return EP === 'drink' ? HELP2 : EP === 'quit' ? HELP3 : HELP; }
let chosenPers = 'lazy';
function openStart(err) {
  netClosing = true; if (ws) { try { ws.close(); } catch {} } ws = null; roomCode = null; peerOn = false; netClosing = false;
  if (JOIN && !err) {
    showCard(`<div class="em">💌</div><h2>아내가 초대했어요</h2><p>방 <b>${JOIN}</b>에 <b>남편</b>으로 들어가요. 아내가 부탁하면 받거나 거절하고, 직접 걸어가서 집안일을 해요. 스스로 하면 보너스!</p><button class="primary" data-a="join">🙋‍♂️ 남편으로 들어가기</button><button class="ghost" data-a="solo">그냥 혼자 하기</button>`,
      { join: () => { EP = 'sofa'; joinAsHusband(); }, solo: () => { history.replaceState(null, '', location.pathname); JOIN = ''; openStart(); } });
    return;
  }
  const got = store.get('endings', []);
  const eps = Object.entries(EPISODES).map(([k, e]) => { const n = ENDINGS.filter(x => (x.ep || 'sofa') === k && got.includes(x.id)).length, tot = ENDINGS.filter(x => (x.ep || 'sofa') === k).length;
    return `<button class="pick ep" data-a="ep_${k}" ${e.locked ? 'disabled' : ''}><div class="i">${e.icon}</div><div><b>${e.no}화 · ${e.name}</b><small>${e.locked ? '🔒 공개 예정' : `${e.desc} · 엔딩 ${n}/${tot}`}</small></div></button>`; }).join('');
  const acts = { book: openBook, decor: () => openDecor(true), help: () => showCard(`<div class="em">❓</div><h2>하는 법</h2>${helpText()}<button class="primary" data-a="back">알겠어요</button>`, { back: () => openStart() }) };
  Object.keys(EPISODES).forEach(k => acts['ep_' + k] = () => openEpisode(k));
  showCard(`<div class="em">🛋️</div><h2>남편 개조 시리즈</h2>${err ? `<p style="color:#ffb0a0">${err}</p>` : ''}<p>오늘은 어떤 남편을 개조할까요?</p><div class="eps">${eps}</div>
    <div class="grid2"><button class="ghost" data-a="book" style="margin:0">📖 엔딩 도감</button><button class="ghost" data-a="decor" style="margin:0">🎨 꾸미기</button></div>
    <button class="ghost" data-a="help">❓ 하는 법</button><a href="/" style="display:block;margin-top:12px;color:var(--dim);font-size:13px">🔥 모닥불 캠핑장으로 놀러 가기</a>`, acts);
}
function openEpisode(k) {
  const e = EPISODES[k]; if (!e || e.locked) return; EP = k;
  showCard(`<div class="em">${e.icon}</div><h2>${e.no}화 · ${e.name}</h2><p>${e.long}</p>
    <button class="primary" data-a="solo">🙋‍♀️ 혼자 하기</button>${k === 'sofa' ? '<button class="ghost" data-a="wife">💑 부부 같이 하기 (남편 초대)</button>' : '<p style="text-align:center;font-size:13px">💑 부부 같이 하기는 1화에서 할 수 있어요</p>'}
    <button class="ghost" data-a="help">❓ 하는 법</button><button class="ghost" data-a="back">뒤로</button>`,
    { solo: () => pickPers('solo'), wife: () => pickPers('wife'), help: () => showCard(`<div class="em">❓</div><h2>하는 법</h2>${helpText()}<button class="primary" data-a="back">알겠어요</button>`, { back: () => openEpisode(k) }), back: () => openStart() });
}
function pickPers(role) {
  const html = Object.entries(PERS).map(([k, p]) => `<button class="pick${k === chosenPers ? ' sel' : ''}" data-a="p_${k}"><div class="i">${p.icon}</div><b>${p.name}</b><small>${p.desc}</small></button>`).join('');
  const acts = { go: () => startAs(role), back: () => openEpisode(EP) };
  Object.keys(PERS).forEach(k => acts['p_' + k] = b => { chosenPers = k; $('modalCard').querySelectorAll('.pick').forEach(x => x.classList.toggle('sel', x === b)); });
  showCard(`<div class="em">🧑</div><h2>어떤 남편인가요?</h2><div class="grid2">${html}</div><button class="primary" data-a="go">${role === 'wife' ? '방 만들기' : '시작하기'}</button><button class="ghost" data-a="back">뒤로</button>`, acts);
}
function startAs(role) {
  ROLE = role; peerOn = false; hJob = null; setTags();
  if (role === 'solo') { closeCard(); newGame(chosenPers); return; }
  newGame(chosenPers);
  showCard('<div class="em">⏳</div><h2>방을 만드는 중…</h2>', {});
  netConnect('wife', null, m => {
    if (m.role !== 'wife') return; render();
    if ($('modal').classList.contains('hide') && !$('modalCard').textContent.includes('방을 만드는 중')) return;
    const link = `${location.origin}/house/?room=${m.code}`;
    showCard(`<div class="em">💌</div><h2>남편을 불러요</h2><p>이 링크를 남편에게 보내요. 남편이 자기 폰으로 열면 같은 집에 들어와요.</p><div class="code">${m.code}</div><div class="linkbox">${link}</div>
      <button class="primary" data-a="send">📤 링크 보내기</button><button class="ghost" data-a="copy">링크 복사</button><button class="ghost" data-a="go">먼저 시작하기 (그동안 AI 남편)</button>`,
      { send: () => shareLink(link), copy: b => copyText(link, b), go: closeCard });
  });
}
function joinAsHusband() {
  ROLE = 'husband'; S = null; hJob = null; closeCard(); showCard('<div class="em">⏳</div><h2>아내 집으로 가는 중…</h2>', {});
  lieDown(); H.state = 'me'; setTags();
  netConnect('husband', JOIN, m => { showCard('<div class="em">⏳</div><h2>아내를 기다리는 중…</h2><p>아내가 게임 화면을 켜 두면 바로 연결돼요.</p>', {}); });
}
async function shareLink(link) {
  const text = '여보, 이 집 같이 치우자 🧹 (남편 개조 프로젝트)';
  try { if (navigator.share) { await navigator.share({ title: '남편 개조 프로젝트', text, url: link }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  copyText(link);
}
async function copyText(t, btn) { try { await navigator.clipboard.writeText(t); toast('링크를 복사했어요. 카톡에 붙여 넣어요'); if (btn) btn.textContent = '복사했어요 ✓'; } catch { toast('복사가 안 돼요. 링크를 길게 눌러 복사해요', 3500); } }
function openBook() {
  const got = store.get('endings', []);
  const cell = e => { const ok = got.includes(e.id); return `<div class="end${ok ? '' : ' lock'}"><div class="i">${ok ? e.icon : '❔'}</div><b>${ok ? e.name : '???'}</b><small>${e.hint}</small></div>`; };
  const cells = Object.entries(EPISODES).filter(([, e]) => !e.locked).map(([k, e]) => `<div style="grid-column:1/-1;text-align:left;font-weight:900;margin-top:6px">${e.icon} ${e.no}화 · ${e.name}</div>` + ENDINGS.filter(x => (x.ep || 'sofa') === k).map(cell).join('')).join('');
  showCard(`<div class="em">📖</div><h2>엔딩 도감 ${got.length}/${ENDINGS.length}</h2><p>엔딩을 모으면 🎨 꾸미기 아이템이 열려요.</p><div class="grid2" style="grid-template-columns:1fr 1fr 1fr">${cells}</div><button class="primary" data-a="close">닫기</button>`,
    { close: () => { if (!S || (S.over && ROLE !== 'husband')) openStart(); else closeCard(); } });
}
function applyDecor() {
  const s = DECOR.sofa[decor.sofa][0]; sofaMat.color.set(s); sofa2Mat.color.set(new THREE.Color(s).multiplyScalar(0.85));
  const w = DECOR.wall[decor.wall]; wallM.map = wallTexOf(w[0], w[1]); wallM.needsUpdate = true;
  const pj = DECOR.pj[decor.pj]; setShirt(H, pj[0], decor.pj === 3);
}
function openDecor(fromStart) {
  const n = store.get('endings', []).length;
  const row = (key, list, sw) => `<div class="lbl">${{ sofa: '🛋️ 소파', wall: '🧱 벽지', pj: '👕 남편 잠옷' }[key]}</div><div class="sw">${list.map((it, i) => { const lock = n < UNLOCK[i]; return `<button data-a="${key}_${i}" class="${decor[key] === i ? 'sel' : ''}" ${lock ? 'disabled' : ''}><i style="background:${sw(it)}"></i>${lock ? `🔒 엔딩 ${UNLOCK[i]}개` : it[it.length - 1]}</button>`; }).join('')}</div>`;
  const hex = c => '#' + new THREE.Color(c).getHexString();
  const acts = { close: () => { if (fromStart) openStart(); else closeCard(); } };
  ['sofa', 'wall', 'pj'].forEach(k => DECOR[k].forEach((_, i) => acts[`${k}_${i}`] = () => { if (ROLE === 'husband') { toast('꾸미기는 아내가 해요'); return; } decor[k] = i; store.set('decor', decor); applyDecor(); syncNow(); openDecor(fromStart); }));
  showCard(`<div class="em">🎨</div><h2>꾸미기</h2><p>엔딩 ${n}개 모음 · 엔딩을 더 모으면 잠긴 것도 열려요.</p>${row('sofa', DECOR.sofa, it => hex(it[0]))}${row('wall', DECOR.wall, it => `linear-gradient(90deg,${it[0]} 50%,${it[1]} 50%)`)}${row('pj', DECOR.pj, it => hex(it[0]))}<button class="primary" data-a="close">닫기</button>`, acts);
}
// 결과 공유 (화면 + 글씨 → 이미지)
async function shareResult(title) {
  composer.render();
  const src = renderer.domElement, W0 = 720, H0 = 960, c = document.createElement('canvas'); c.width = W0; c.height = H0; const g = c.getContext('2d');
  const sr = src.width / src.height, dr = W0 / H0; let sw = src.width, sh = src.height, sx = 0, sy = 0; if (sr > dr) { sw = sh * dr; sx = (src.width - sw) / 2; } else { sh = sw / dr; sy = (src.height - sh) / 2; }
  g.drawImage(src, sx, sy, sw, sh, 0, 0, W0, H0);
  const gr = g.createLinearGradient(0, H0 * 0.45, 0, H0); gr.addColorStop(0, 'rgba(8,9,14,0)'); gr.addColorStop(1, 'rgba(8,9,14,.92)'); g.fillStyle = gr; g.fillRect(0, 0, W0, H0);
  g.fillStyle = 'rgba(8,9,14,.75)'; g.fillRect(0, 0, W0, 92); g.fillStyle = '#fff'; g.font = '34px "Gowun Dodum", sans-serif'; g.textAlign = 'left'; g.fillText(EP === 'drink' ? '🍺 술고래 남편 개조' : EP === 'quit' ? '💼 회사 때려치겠다는 남편' : '🛋️ 남편 개조 프로젝트', 30, 58);
  g.textAlign = 'center'; g.font = '30px "Gowun Dodum", sans-serif'; g.fillStyle = '#e9c46a'; g.fillText(title || (S ? `${S.day}일차 진행 중` : ''), W0 / 2, H0 - 210);
  g.fillStyle = '#fff'; g.font = '84px "Gowun Dodum", sans-serif'; g.fillText(EP === 'drink' && S ? `금주 ${S.cal.filter(Boolean).length}/7일` : EP === 'quit' && S ? `멘탈 ${Math.round(S.mental)}` : `개조율 ${S ? S.hab : 0}%`, W0 / 2, H0 - 115);
  g.font = '24px "Gowun Dodum", sans-serif'; g.fillStyle = '#9aa3bd'; g.fillText(`${S ? PERS[S.pers].name : ''} · ${location.host}/house`, W0 / 2, H0 - 55);
  const url = `${location.origin}/house/`, text = EP === 'quit' && S ? `우리 남편 회사 그만둔다는 거 막았다(?) 멘탈 ${Math.round(S.mental)}! ${title || ''} 💼 너희 남편도 개조해 봐` : EP === 'drink' && S ? `우리 남편 금주 ${S.cal.filter(Boolean).length}/7일! ${title || ''} 🍺 너희 남편도 개조해 봐` : `우리 남편 개조율 ${S ? S.hab : 0}%! ${title || ''} 🛋️ 너희 남편도 개조해 봐`;
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  try { const file = new File([blob], 'husband.png', { type: 'image/png' }); if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: text + ' ' + url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  const dataUrl = c.toDataURL('image/png');
  showCard(`<div class="em">📤</div><h2>결과 공유</h2><p>이미지를 길게 눌러 저장한 뒤 인스타·카톡에 올려요.</p><img id="shareImg" src="${dataUrl}"><button class="primary" data-a="copy">글과 링크 복사</button><button class="ghost" data-a="close">닫기</button>`,
    { copy: b => copyText(text + ' ' + url, b), close: () => { if (S && S.over) closeCard(); else closeCard(); } });
}

// 접속자 · 방문자 수
const VID = (() => { let v = store.get('vid', ''); if (!/^[a-z0-9]{6,16}$/.test(v)) { v = Math.random().toString(36).slice(2, 12).replace(/[^a-z0-9]/g, 'x').padEnd(8, '0'); store.set('vid', v); } return v; })();
let liveStats = null;
const nf = n => Number(n || 0).toLocaleString('ko-KR');
async function pingVisit() {
  try { const r = await fetch(`/api/visit?g=house&id=${VID}`, { cache: 'no-store' }); if (!r.ok) throw 0; liveStats = await r.json();
    $('liveTxt').textContent = `👥 ${nf(liveStats.online.house)}`; } catch { $('liveTxt').textContent = '👥 -'; }
}
pingVisit(); setInterval(pingVisit, 30000);
$('liveBtn').onclick = async () => {
  await pingVisit(); const j = liveStats; if (!j) return;
  const days = (j.recent || []).slice(-7).reverse().map(r => `<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--dim);padding:3px 0"><span>${r.day.slice(5)}</span><span>🛋️ ${nf(r.house)} · 🔥 ${nf(r.camp)}</span></div>`).join('');
  showCard(`<div class="em">👥</div><h2>접속자 현황</h2>
    <p style="margin-bottom:4px"><b>🛋️ 남편 개조</b></p><div class="stt"><div><small>지금 접속</small><b style="color:#5fd38d">${nf(j.online.house)}</b></div><div><small>오늘 방문</small><b>${nf(j.today.house)}</b></div><div><small>누적 방문</small><b>${nf(j.total.house)}</b></div><div><small>🔥 캠핑장 지금</small><b>${nf(j.online.camp)}</b></div></div>
    <p style="margin:10px 0 2px"><b>최근 7일 방문</b></p>${days}<button class="primary" data-a="close">닫기</button><a href="/stats" style="display:block;margin-top:10px;color:var(--dim);font-size:13px">전체 통계 보기 →</a>`, { close: closeCard });
};

// 오른쪽 버튼
const SND_ON = '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/>', SND_OFF = '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>';
function soundIcon() { $('soundIco').innerHTML = muted ? SND_OFF : SND_ON; }
soundIcon();
$('soundBtn').onclick = () => { muted = !muted; store.set('muted', muted); soundIcon(); if (!muted) sfx('tap', true); };
$('shareBtn').onclick = () => shareResult(S && S.over ? null : null);
$('helpBtn').onclick = () => showCard(`<div class="em">❓</div><h2>하는 법</h2>${helpText()}<button class="primary" data-a="close">계속하기</button>`, { close: closeCard });
$('decorBtn').onclick = () => openDecor(false);
$('bookBtn').onclick = openBook;
$('menuBtn').onclick = e => { e.stopPropagation(); $('menu').classList.toggle('show'); };
$('menu').addEventListener('click', () => setTimeout(() => $('menu').classList.remove('show'), 0));
canvas.addEventListener('pointerdown', () => $('menu').classList.remove('show'));
$('statsBtn').onclick = () => $('liveBtn').onclick();
$('endBtn').onclick = endDay;
let overview = false; $('viewBtn').onclick = () => { overview = !overview; $('viewBtn').textContent = overview ? '👁️ 가까이 보기' : '👁️ 집 전체 보기'; toast(overview ? '집 전체 보기' : '가까이 보기', 1200); };

// =====================================================================
// 입력
// =====================================================================
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
const me = () => ROLE === 'husband' ? H : W;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) return; down = null; if (!S || !$('modal').classList.contains('hide')) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  if (ROLE !== 'husband' && !S.over) {
    for (const h of ray.intersectObjects(clickables, true)) {
      let o = h.object; if (!o.visible) continue; while (o && !o.userData.action) o = o.parent; if (!o || !o.visible) continue; const k = o.userData.action;
      if (k === 'husband') { if (drunkOn()) { toast('🍺 왼쪽 취객 대처 버튼을 눌러요'); return; } if (H.state === 'hiding') { findHusband(); return; } if (S.busy) { hSay('지금 하는 중이잖아~'); return; } goHusband(() => openChores()); return; }
      if (k === 'tv') { walk(W, -4, -4.5, () => { faceTo(W, -4, -6); toast(S.tvOff ? '리모컨은 숨겨 뒀어요 🤫' : '🙈 리모컨 버튼으로 리모컨을 숨길 수 있어요'); }); return; }
      if (k === 'fridge') { walk(W, 6.95, -4.35, () => { faceTo(W, 7.35, -5.5); toast(S.used.chicken ? '오늘 치킨은 이미 시켰어요' : '🍗 치킨 버튼으로 치킨을 시킬 수 있어요'); }); return; }
      const c = ALL[k]; if (c) { if (c.extra && S.extra !== c.id) break; walk(W, c.wife[0], c.wife[1], () => { faceTo(W, c.look[0], c.look[1]); toast(S.done[c.id] ? `${c.icon} ${c.name}: 오늘은 끝났어요` : `${c.icon} ${c.name} · 필요 의욕 ${reqOf(c)} · 남편에게 시켜야 해요`); }); return; }
    }
  }
  const f = ray.intersectObjects(floors, false)[0];
  if (f) {
    if (!panelSticky) closePanel(); const [x, z] = nearestFree(f.point.x, f.point.z); ring.position.set(x, 0.04, z); ring.visible = true; ring.material.opacity = 0.7; ring.scale.setScalar(1);
    if (ROLE === 'husband') { if (H.pose === 'lie') standUp(); H.pose = 'idle'; walk(H, x, z, () => renderControls()); }
    else walk(W, x, z);
  }
});

// =====================================================================
// 루프
// =====================================================================
const camT = new THREE.Vector3(), camP = new THREE.Vector3(); let first = true;
const clock = new THREE.Clock();
function followRemote(ch, dt) {
  const n = ch.net; if (!n) return;
  const p = ch.root.position;
  if (n.lie) { if (ch.pose !== 'lie') { if (ch === H) { lieDown(); H.state = 'remote'; } } return; }
  if (ch.pose === 'lie' && ch === H) { standUp(); }
  const dx = n.x - p.x, dz = n.z - p.z, d = Math.hypot(dx, dz);
  if (d > 3) { p.x = n.x; p.z = n.z; } else { const k = Math.min(1, dt * 8); p.x += dx * k; p.z += dz * k; }
  ch.moving = d > 0.03; let dr = n.ry - ch.root.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); ch.root.rotation.y += dr * Math.min(1, dt * 10);
  if (!ch.moving && n.pose && n.pose !== 'lie') ch.pose = n.pose; else if (ch.moving) ch.pose = 'idle';
  if (n.f && ch === H) setFace(H, n.f);
}
function idleFace(ch) {
  if (ch.faceLock && performance.now() < ch.faceLock) return;
  if (ch === H && S) { if (H.pose === 'lie' && H.sub === 'snore') return setFace(H, 'sleep'); if (H.pose === 'lie' && H.sub === 'yawn') return setFace(H, 'shock'); setFace(H, S.res >= 70 ? 'angry' : H.state === 'working' ? 'flat' : S.mot >= 30 ? 'smile' : 'flat'); }
  else setFace(ch, 'smile');
}
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (ROLE === 'husband') { stepChar(H, dt); followRemote(W, dt); }
  else { stepChar(W, dt); if (remoteH()) followRemote(H, dt); else stepChar(H, dt); }
  stepChar(K, dt); kidTick(dt); animPerson(W, dt, t); animPerson(H, dt, t); animPerson(K, dt, t);
  // 소파 위 남편의 딴짓
  if (H.pose === 'lie' && ROLE !== 'husband' && !remoteH()) { H.idleT -= dt; if (H.idleT <= 0) { H.sub = pick(['phone', 'phone', 'yawn', 'snore', 'scratch', 'tv']); H.idleT = rand(4, 8); if (S && !S.over) { if (H.sub === 'yawn') say(H, '🥱', true); if (H.sub === 'snore') say(H, '💤', true, 3500); if (H.sub === 'phone' && Math.random() < 0.4) say(H, pick(['(쇼츠 보는 중)', 'ㅋㅋㅋㅋ', '(게임 중)'])); } } }
  if (ROLE === 'husband' && H.pose === 'lie') { H.idleT -= dt; if (H.idleT <= 0) { H.sub = pick(['phone', 'tv', 'scratch']); H.idleT = rand(5, 9); } }
  if (S) { idleFace(H); if (ROLE !== 'husband') idleFace(W); }
  if (ROLE !== 'husband') drunkTick(dt, t);
  giftTick(dt);
  drinkTick(dt);
  for (let i = parts.length - 1; i >= 0; i--) { const s = parts[i], u = s.userData; u.life -= dt; u.v.y -= dt * 1.5; s.position.addScaledVector(u.v, dt); s.material.opacity = Math.max(0, u.life); if (u.life <= 0) { scene.remove(s); s.material.dispose(); parts.splice(i, 1); } }
  stink.forEach(s => { const k = (t * 0.45 + s.userData.ph) % 1.6; s.position.set(6.45 + Math.sin(t * 2 + s.userData.ph) * 0.15 + s.userData.ph * 0.05, 0.75 + k, 5.4); s.material.opacity = 0.55 * (1 - k / 1.6); });
  if (ring.visible) { ring.material.opacity -= dt * 1.2; ring.scale.multiplyScalar(1 + dt * 0.8); if (ring.material.opacity <= 0) ring.visible = false; }
  bulbs.forEach((b, i) => b.scale.setScalar(0.85 + Math.sin(t * 2 + i) * 0.2));
  flame.scale.set(1 + Math.sin(t * 20) * 0.1, 1.8 + Math.sin(t * 13) * 0.3, 1);
  if (S && !S.tvOff) tvL.intensity = 4 + Math.sin(t * 9) + Math.sin(t * 3.3);
  if (S) { plantOk.visible = !mess.plant.visible; bedNeat.visible = !mess.bed.visible; hung.visible = !mess.hang.visible; }
  // 네트워크 동기화
  if (peerOn) { syncAcc += dt; hSendAcc += dt; if (ROLE === 'wife' && syncAcc > 0.25) { syncAcc = 0; syncNow(); } if (ROLE === 'husband' && hSendAcc > 0.12) { hSendAcc = 0; sendH(); } }
  if (ROLE === 'husband' && hJob) { const c = ALL[hJob.id], p = H.root.position, at = Math.hypot(p.x - c.spot[0], p.z - c.spot[1]) < 0.8; if (at !== hJob.at) { hJob.at = at; renderControls(); } }
  // 카메라: 내 캐릭터를 비스듬히 위에서 가까이
  const portrait = camera.aspect < 0.8, focus = me().root.position;
  const off = overview ? (portrait ? _v.set(0, 34, 21) : _v.set(0, 22, 15)) : (portrait ? _v.set(1.4, 7.4, 8.4) : _v.set(1.2, 5.8, 7.0));
  const tgt = overview ? new THREE.Vector3(portrait ? clamp(focus.x, -9, 9) : 0, 0, portrait ? 0.8 : 0.5) : new THREE.Vector3(clamp(focus.x, -14.5, 14.5), 0.9, clamp(focus.z, -4.6, 4.6) + (portrait ? 1.3 : 0.5));
  if (first) { camT.copy(tgt); camP.copy(tgt).add(off); first = false; }
  camT.lerp(tgt, Math.min(1, dt * 3)); camP.lerp(tgt.clone().add(off), Math.min(1, dt * 3)); camera.position.copy(camP); camera.lookAt(camT);
  composer.render();
  placeTags();
  requestAnimationFrame(loop);
}

// 머리카락 재질 표시 (성격별 색 바꾸기용)
H.headG.traverse(m => { if (m.isMesh && m.material && m.material.color && m.material.color.getHex() === 0x4a3326) { m.material = m.material.clone(); m.material.userData.hair = true; } });
{ const hm = H.headG.children.find(m => m.material && m.material.userData.hair); if (hm) { const shared = hm.material; H.headG.traverse(m => { if (m.isMesh && m.material && m.material.userData.hair) m.material = shared; }); H.brows.forEach(b => b.material = shared); } }
applyDecor();
lieDown(); W.root.position.set(0, 0, 2.6); W.root.rotation.y = Math.PI;
setTags(); render();
$('loading').remove();
loop();
openStart();
