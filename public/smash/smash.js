// 강냉이 털기 3D — 30초 동안 강냉이(이빨) 털기 + 랭킹 + 결과 공유
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
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const isTouch = matchMedia('(pointer:coarse)').matches;
const store = {
  get(k, d) { try { const v = localStorage.getItem('smash.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('smash.' + k, JSON.stringify(v)); } catch {} }
};
let myId = store.get('id', '');
if (!/^[a-z0-9]{6,16}$/.test(myId)) { myId = (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).replace(/[^a-z0-9]/g, '').slice(0, 12); store.set('id', myId); }
const ROUND = 30;

// =====================================================================
// 렌더러 · 빛
// =====================================================================
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
const PR = () => Math.min(devicePixelRatio || 1, isTouch ? 1.75 : 2);
renderer.setPixelRatio(PR());
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x120e18);
scene.fog = new THREE.Fog(0x120e18, 7, 16);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.4, 0.9); composer.addPass(bloom);
composer.addPass(new OutputPass());
const camBase = new THREE.Vector3(), camLook = new THREE.Vector3(0, 1.08, 0);
function resize() {
  const w = innerWidth, h = innerHeight, asp = w / h;
  renderer.setPixelRatio(PR()); renderer.setSize(w, h, false); composer.setPixelRatio(PR()); composer.setSize(w, h);
  bloom.resolution.set(w / 2, h / 2); camera.aspect = asp; camera.updateProjectionMatrix();
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = clamp(Math.max(0.95 / (t * asp), 1.55 / t), 2.9, 5.6);
  camBase.set(0, 1.3, dist); camLook.set(0, asp < 0.8 ? 1.0 : 1.08, 0);
  const off = asp < 0.8 ? Math.round(h * 0.06) : 0; if (off) camera.setViewOffset(w, h, 0, off, w, h); else camera.clearViewOffset();
}
addEventListener('resize', resize); resize();

scene.add(new THREE.HemisphereLight(0x8a90c8, 0x2a1d14, 1.0));
const key = new THREE.DirectionalLight(0xffdcb8, 1.35); key.position.set(2.2, 5, 4); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3.5, bottom: -1, near: 1, far: 14 }); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02; scene.add(key);
const spot = new THREE.PointLight(0xffc68a, 5, 7, 1.6); spot.position.set(0, 3.0, 1.2); scene.add(spot);
const rimL = new THREE.PointLight(0x6aa8ff, 7, 8, 1.6); rimL.position.set(-2.4, 2.4, -1.2); scene.add(rimL);
const pinkL = new THREE.PointLight(0xff5aa8, 6, 7, 1.6); pinkL.position.set(2.2, 2.6, -1.4); scene.add(pinkL);

// =====================================================================
// 텍스처 · 재질
// =====================================================================
function cTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(...rep); t.anisotropy = 4; return t;
}
const MC = new Map();
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!MC.has(k)) MC.set(k, new THREE.MeshLambertMaterial({ color: c, ...o })); return MC.get(k); };
const glow = c => new THREE.MeshBasicMaterial({ color: c });
function add(geo, m, x = 0, y = 0, z = 0, parent = scene) { const o = new THREE.Mesh(geo, typeof m === 'number' ? mat(m) : m); o.position.set(x, y, z); parent.add(o); return o; }
const box = (w, h, d, m, x, y, z, p) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, p);
const cyl = (rt, rb, h, m, x, y, z, p, seg = 16) => add(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, p);
const sph = (r, m, x, y, z, p, s = 20) => add(new THREE.SphereGeometry(r, s, Math.max(8, s * 0.75 | 0)), m, x, y, z, p);

const woodTex = cTex(256, 256, (g, w, h) => { const cols = ['#9a6a45', '#8f6240', '#a5744c', '#8a5c3a']; for (let i = 0; i < 8; i++) { g.fillStyle = cols[i % 4]; g.fillRect(0, i * 32, w, 32); g.fillStyle = 'rgba(50,28,15,.4)'; g.fillRect(0, i * 32, w, 2); g.fillRect((i * 97) % 256, i * 32, 2, 32); } for (let k = 0; k < 200; k++) { g.fillStyle = `rgba(70,40,20,${Math.random() * 0.1})`; g.fillRect(Math.random() * w, Math.random() * h, Math.random() * 40, 1); } }, [4, 3]);
const wallTex = cTex(128, 128, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#3b2a44' : '#33243c'; g.fillRect(i * 16, 0, 16, h); } g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, h - 10, w, 10); }, [10, 1]);
const matTex = cTex(256, 256, (g, w, h) => {
  g.fillStyle = '#c8433a'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#f4e3c3'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.arc(128, 128, 92, 0, 7); g.stroke();
  g.fillStyle = '#f4e3c3'; g.font = '900 30px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('STRESS', 128, 112); g.fillText('ZONE', 128, 146);
});

// =====================================================================
// 방 꾸미기
// =====================================================================
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshLambertMaterial({ map: woodTex }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = 2; floor.receiveShadow = true; scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshLambertMaterial({ map: wallTex }));
  wall.position.set(0, 3, -2.3); wall.receiveShadow = true; scene.add(wall);
  [-1, 1].forEach(s => { const sw = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), new THREE.MeshLambertMaterial({ map: wallTex })); sw.rotation.y = -s * Math.PI / 2; sw.position.set(4.6 * s, 3, 2.5); scene.add(sw); });
  box(14, 0.18, 0.08, 0x6a4a32, 0, 0.09, -2.25);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40), new THREE.MeshLambertMaterial({ map: matTex }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, 0.1); rug.receiveShadow = true; scene.add(rug);

  // 네온사인
  const neon = cTex(512, 160, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 64px "Noto Sans KR",sans-serif';
    g.shadowColor = '#ff4fa8'; g.shadowBlur = 24; g.fillStyle = '#ffd1ec'; g.fillText('STRESS OUT', w / 2, 58);
    g.font = '900 40px "Noto Sans KR",sans-serif'; g.shadowColor = '#4fd8ff'; g.fillStyle = '#d8f8ff'; g.fillText('강냉이 털기 🌽', w / 2, 120);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshBasicMaterial({ map: neon, transparent: true, color: 0xffffff }));
  sign.position.set(0, 2.75, -2.27); scene.add(sign);
  setTimeout(() => { neon.image.getContext('2d'); neon.needsUpdate = true; }, 1500); // 폰트 늦게 오면 다시 그리기 위해
  document.fonts && document.fonts.ready.then(() => {
    const g = neon.image.getContext('2d'), w = 512, h = 160; g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 64px "Noto Sans KR",sans-serif'; g.shadowColor = '#ff4fa8'; g.shadowBlur = 24; g.fillStyle = '#ffd1ec'; g.fillText('STRESS OUT', w / 2, 58);
    g.font = '900 40px "Noto Sans KR",sans-serif'; g.shadowColor = '#4fd8ff'; g.fillStyle = '#d8f8ff'; g.fillText('강냉이 털기 🌽', w / 2, 120); neon.needsUpdate = true;
  });

  // 전구 줄
  const cols = [0xffd27a, 0xff7aa8, 0x7ad8ff, 0xb8ff7a];
  for (let i = 0; i < 22; i++) { const x = -4.2 + i * 0.4, y = 3.55 - Math.sin(i / 21 * Math.PI) * 0.35; sph(0.045, glow(cols[i % 4]), x, y, -2.2, scene, 8); }

  // 샌드백
  const bag = new THREE.Group(); bag.position.set(-2.3, 0, -1.2); scene.add(bag);
  cyl(0.008, 0.008, 1.0, 0x888888, 0, 3.0, 0, bag, 5);
  const b = cyl(0.26, 0.26, 1.05, 0xb8402f, 0, 1.95, 0, bag, 20); b.castShadow = true;
  cyl(0.265, 0.265, 0.06, 0x2a1d18, 0, 2.3, 0, bag, 20); cyl(0.265, 0.265, 0.06, 0x2a1d18, 0, 1.6, 0, bag, 20);
  sph(0.26, 0xb8402f, 0, 1.43, 0, bag).scale.y = 0.35;
  // 화분 · 의자
  const pot = new THREE.Group(); pot.position.set(2.6, 0, -1.4); scene.add(pot);
  cyl(0.22, 0.17, 0.4, 0xd88a5a, 0, 0.2, 0, pot); for (let k = 0; k < 7; k++) { const l = sph(0.16, 0x4f9a5a, Math.cos(k) * 0.12, 0.55 + (k % 3) * 0.12, Math.sin(k) * 0.12, pot, 10); l.scale.set(0.7, 1.4, 0.7); l.rotation.z = Math.cos(k) * 0.5; }
  // 액자
  const frame = (x, y, c1, txt) => {
    const t = cTex(128, 160, g => { g.fillStyle = c1; g.fillRect(0, 0, 128, 160); g.fillStyle = 'rgba(255,255,255,.92)'; g.font = '900 54px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 64, 80); });
    box(0.56, 0.7, 0.04, 0x2a1d18, x, y, -2.27); const p = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.62), new THREE.MeshLambertMaterial({ map: t })); p.position.set(x, y, -2.245); scene.add(p);
  };
  frame(-1.75, 2.05, '#5b8def', '🥊'); frame(1.75, 2.05, '#e9a23e', '🦷');
}

// =====================================================================
// 캐릭터 (털리는 사람)
// =====================================================================
const SKIN = 0xf6dcc4, HAIR = 0x4a3326;
const ch = {};
{
  const root = new THREE.Group(); scene.add(root); ch.root = root;
  const shadowMat = new THREE.MeshBasicMaterial({ map: cTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }), transparent: true, depthWrite: false });
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.012; root.add(sh);
  const body = new THREE.Group(); root.add(body); ch.body = body;
  const skin = mat(SKIN), shirt = mat(0x5b8def), pants = mat(0x2f3a56), shoe = mat(0xf4f4f0);
  [-0.11, 0.11].forEach(x => { cyl(0.085, 0.075, 0.36, pants, x, 0.24, 0, body, 12); const s = box(0.15, 0.09, 0.24, shoe, x, 0.05, 0.04, body); s.geometry.translate(0, 0, 0); });
  const hip = sph(0.2, pants, 0, 0.44, 0, body); hip.scale.set(1.15, 0.6, 0.85);
  const torso = add(new THREE.CapsuleGeometry(0.23, 0.28, 6, 16), shirt, 0, 0.7, 0, body); torso.scale.set(1.05, 1, 0.82);
  // 셔츠 글자
  const tee = cTex(256, 128, g => {}); ch.tee = tee;
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshLambertMaterial({ map: tee, transparent: true })); logo.position.set(0, 0.74, 0.205); body.add(logo);
  // 반성문 팻말 (끝나면 들고 있음)
  const sign = new THREE.Group(); sign.position.set(0, 0.62, 0.36); sign.rotation.x = -0.12; sign.visible = false; body.add(sign); ch.sign = sign;
  ch.signTex = cTex(512, 600, g => {});
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.586), new THREE.MeshLambertMaterial({ map: ch.signTex })); sp.position.z = 0.012; sign.add(sp);
  box(0.54, 0.626, 0.02, 0x8a6a48, 0, 0, 0, sign);
  ch.arms = [-1, 1].map(s => {
    const pv = new THREE.Group(); pv.position.set(0.27 * s, 0.9, 0); body.add(pv);
    sph(0.085, shirt, 0, -0.03, 0, pv, 12); cyl(0.055, 0.05, 0.3, skin, 0, -0.2, 0, pv, 10); sph(0.07, skin, 0, -0.37, 0, pv, 12);
    pv.rotation.z = 0.25 * s; return { pv, s, rz: 0.25 * s, vz: 0, rx: 0, vx: 0 };
  });
  cyl(0.08, 0.09, 0.12, skin, 0, 1.02, 0, body, 12);
  const neck = new THREE.Group(); neck.position.set(0, 1.04, 0); body.add(neck); ch.neck = neck;
  const headG = new THREE.Group(); headG.position.set(0, 0.36, 0); neck.add(headG); ch.headG = headG;
  const R = 0.42; ch.R = R;
  const head = sph(R, skin.clone(), 0, 0, 0, headG, 40); ch.head = head;
  [-1, 1].forEach(s => { const e = sph(0.09, skin, 0.41 * s, -0.02, 0, headG, 12); e.scale.set(0.55, 1, 0.8); });
  const hair = mat(HAIR);
  const cap = add(new THREE.SphereGeometry(R * 1.035, 32, 16, 0, Math.PI * 2, 0, 1.25), hair, 0, 0, 0, headG); cap.rotation.x = -0.38;
  const fringe = sph(R, hair, 0.04, 0.27, 0.18, headG, 20); fringe.scale.set(0.92, 0.3, 0.55); fringe.rotation.z = -0.22; ch.fringe = fringe;
  for (let k = 0; k < 3; k++) { const sp = add(new THREE.ConeGeometry(0.05, 0.16, 6), hair, -0.06 + k * 0.07, 0.45, -0.04 + k * 0.02, headG); sp.rotation.z = (k - 1) * -0.4; }

  // 눈 (캔버스 그림)
  const eyeTex = kind => cTex(128, 128, g => {
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1c1410'; g.fillStyle = '#1c1410';
    if (kind === 'normal' || kind === 'shock') {
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(64, 64, 44, 52, 0, 0, 7); g.fill(); g.lineWidth = 7; g.stroke();
      g.fillStyle = '#1c1410'; g.beginPath(); g.arc(64, 70, kind === 'shock' ? 13 : 24, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(74, 58, kind === 'shock' ? 4 : 8, 0, 7); g.fill();
    } else if (kind === 'hurtL' || kind === 'hurtR') {
      const s = kind === 'hurtL' ? 1 : -1; g.lineWidth = 14; g.beginPath(); g.moveTo(64 - 30 * s, 30); g.lineTo(64 + 26 * s, 64); g.lineTo(64 - 30 * s, 98); g.stroke();
    } else if (kind === 'dizzy') {
      g.lineWidth = 8; g.beginPath(); for (let t = 0; t < 18; t += 0.2) { const r = t * 2.6; g.lineTo(64 + Math.cos(t) * r, 64 + Math.sin(t) * r); } g.stroke();
    } else if (kind === 'blink') { g.lineWidth = 12; g.beginPath(); g.moveTo(26, 70); g.quadraticCurveTo(64, 92, 102, 70); g.stroke(); }
  });
  ch.eyeT = { normal: eyeTex('normal'), shock: eyeTex('shock'), hurtL: eyeTex('hurtL'), hurtR: eyeTex('hurtR'), dizzy: eyeTex('dizzy'), blink: eyeTex('blink') };
  ch.eyes = [-1, 1].map(s => {
    const m = new THREE.MeshBasicMaterial({ map: ch.eyeT.normal, transparent: true, alphaTest: 0.35 });
    const e = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), m); const x = 0.15 * s, y = 0.05; e.position.set(x, y, Math.sqrt(R * R - x * x - y * y) + 0.008); e.rotation.y = Math.atan2(x, 0.39); headG.add(e); return e;
  });
  ch.brows = [-1, 1].map(s => { const b = box(0.13, 0.03, 0.03, hair, 0.15 * s, 0.17, 0.375, headG); b.rotation.y = 0.37 * s; return b; });
  ch.cheeks = [-1, 1].map(s => { const c = sph(0.06, mat(0xf2a69a), 0.24 * s, -0.07, 0.315, headG, 12); c.scale.set(1, 0.6, 0.4); return c; });
  ch.nose = sph(0.04, skin, 0, -0.03, 0.415, headG, 10);
  ch.tears = [-1, 1].map(s => { const t = sph(0.022, new THREE.MeshLambertMaterial({ color: 0x7ac0ff, emissive: 0x204060 }), 0.17 * s, -0.04, 0.38, headG, 8); t.scale.y = 1.4; t.visible = false; return t; });

  // 입 + 강냉이
  const mouth = new THREE.Group(); mouth.position.set(0, -0.19, 0.383); mouth.rotation.x = 0.45; headG.add(mouth); ch.mouth = mouth;
  const lip = new THREE.Mesh(new THREE.CircleGeometry(1, 36), new THREE.MeshBasicMaterial({ color: 0x2a1408 })); lip.position.z = -0.003; mouth.add(lip); ch.lip = lip;
  const inside = new THREE.Mesh(new THREE.CircleGeometry(1, 36), new THREE.MeshBasicMaterial({ color: 0x5a1418 })); mouth.add(inside); ch.inside = inside;
  const tongue = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0xe0566b })); tongue.position.z = 0.002; mouth.add(tongue); ch.tongue = tongue;
  const toothGeo = new THREE.BoxGeometry(0.03, 0.042, 0.02), toothMat = mat(0xfffdf4);
  ch.teeth = [];
  for (let i = 0; i < 16; i++) {
    const t = new THREE.Mesh(toothGeo, toothMat); const j = i % 8; t.userData.x = -0.12 + j * (0.24 / 7); t.userData.up = i < 8; t.userData.pop = 1;
    t.position.set(t.userData.x, 0, 0.008 + (i < 8 ? 0.002 : 0) - t.userData.x * t.userData.x * 1.2); mouth.add(t); ch.teeth.push(t);
  }
  ch.MW = 0.15;
  ch.bruises = new THREE.Group(); headG.add(ch.bruises);
  ch.stars = new THREE.Group(); ch.stars.position.y = 0.62; headG.add(ch.stars); ch.stars.visible = false;
  for (let k = 0; k < 3; k++) { const st = add(new THREE.OctahedronGeometry(0.06), glow(0xffd23a), 0, 0, 0, ch.stars); st.scale.y = 1.4; }
  root.traverse(m => { if (m.isMesh && m !== sh && m.material.type === 'MeshLambertMaterial') m.castShadow = true; });
}
function setShirtName(name) {
  const c = ch.tee.image, g = c.getContext('2d'); g.clearRect(0, 0, 256, 128); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 64; g.font = `900 ${fs}px "Noto Sans KR",sans-serif`; while (g.measureText(name).width > 236 && fs > 20) { fs -= 4; g.font = `900 ${fs}px "Noto Sans KR",sans-serif`; }
  g.fillText(name, 128, 66); ch.tee.needsUpdate = true;
}
function wrapK(g, text, maxW) { const out = []; let line = ''; for (const chr of Array.from(text)) { const t = line + chr; if (g.measureText(t).width > maxW && line) { out.push(line); line = chr.trim() ? chr : ''; } else line = t; } if (line) out.push(line); return out; }
function drawSign() {
  const c = ch.signTex.image, g = c.getContext('2d'), W = 512, H = 600;
  g.fillStyle = '#fbf6ea'; g.fillRect(0, 0, W, H); g.strokeStyle = '#6b4a2e'; g.lineWidth = 6; g.strokeRect(14, 14, W - 28, H - 28);
  g.fillStyle = '#2a1c0e'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 50px Gaegu,"Noto Sans KR",sans-serif'; g.fillStyle = '#6b5a44'; g.fillText('반성문', W / 2, 80);
  g.fillStyle = '#2a1c0e'; g.font = '700 68px Gaegu,"Noto Sans KR",sans-serif'; g.fillText('내가 잘못했어', W / 2, 170);
  g.font = '700 46px Gaegu,"Noto Sans KR",sans-serif'; g.fillStyle = '#6b5a44'; g.fillText('이유', W / 2, 270);
  g.strokeStyle = '#8a7458'; g.lineWidth = 4; g.strokeRect(50, 305, W - 100, 230);
  g.fillStyle = '#2a1c0e'; g.font = '700 40px Gaegu,"Noto Sans KR",sans-serif';
  const lines = wrapK(g, tWhy(), W - 140).slice(0, 4); lines.forEach((l, i) => g.fillText(l, W / 2, 420 - (lines.length - 1) * 25 + i * 50));
  ch.signTex.needsUpdate = true;
}
function applyTarget() { setShirtName(tName()); drawSign(); }
document.fonts && document.fonts.ready.then(applyTarget);

// 단계별로 망가지는 얼굴 (다크서클 → 붕대 → 퉁퉁 부음)
const dmg = {};
{
  const R = ch.R, hg = ch.headG;
  dmg.bags = [-1, 1].map(s => { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0x5a3a6a, transparent: true, opacity: 0.55, depthWrite: false })); const x = 0.15 * s, y = -0.05; m.position.set(x, y, Math.sqrt(R * R - x * x - y * y) + 0.004); m.rotation.y = Math.atan2(x, 0.39); m.scale.set(0.07, 0.035, 1); hg.add(m); return m; });
  const band = new THREE.Mesh(new THREE.TorusGeometry(R * 1.0, 0.045, 8, 40), mat(0xf6f2ea)); band.rotation.set(Math.PI / 2 - 0.35, 0.12, 0); band.position.y = 0.17; band.scale.set(1, 1, 0.9); hg.add(band); dmg.band = band;
  const knot = new THREE.Group(); const k1 = sph(0.05, mat(0xf6f2ea), 0, 0, 0, knot, 10); k1.scale.set(1, 0.7, 0.6); [-1, 1].forEach(s => { const t = box(0.03, 0.14, 0.02, mat(0xf6f2ea), 0.03 * s, -0.08, 0, knot); t.rotation.z = 0.3 * s; }); knot.position.set(0.33, 0.27, -0.2); hg.add(knot); dmg.knot = knot;
  const red = new THREE.Mesh(new THREE.CircleGeometry(0.02, 10), glow(0xd03a3a)); red.position.set(-0.1, 0.25, 0.4); red.rotation.x = -0.6; hg.add(red); dmg.red = red;
  dmg.all = [...dmg.bags, band, knot, red];
  dmg.all.forEach(m => m.visible = false);
}
function updateDamage() {
  const h = game.headHits, ph = photoOn();
  dmg.bags.forEach(m => m.visible = h >= 12 && !ph);
  dmg.band.visible = dmg.knot.visible = h >= 25; dmg.red.visible = h >= 25 && !ph;
  const sw = h >= 40 ? 1 : 0;
  ch.cheeks.forEach(c => { c.scale.set(1 + sw * 0.7, 0.6 + sw * 0.5, 0.4 + sw * 0.3); c.material.color.set(sw ? 0xe86a6a : 0xf2a69a); });
  ch.swell = sw;
  if (h === 12) say('눈이 침침해…'); else if (h === 25) say('붕대 좀 감자…'); else if (h === 40) say('얼굴이 퉁퉁 부었어ㅠ'); else if (h === 60) say('살려줘어어…');
}
function addGauge(v) {
  if (mode !== 'rank' && mode !== 'free') return;
  game.gauge = Math.min(100, game.gauge + v);
  const u = $('ult'); u.style.setProperty('--p', game.gauge + '%');
  if (game.gauge >= 100 && !u.classList.contains('ready')) { u.classList.add('ready'); SND.ult(); popText('💥 필살기 준비!', innerWidth - 60, innerHeight - 250, 's'); }
}
function fireUlt() {
  if (game.gauge < 100 || ult || ko > 0 || (mode !== 'rank' && mode !== 'free')) return;
  A(); game.gauge = 0; game.ults++; const u = $('ult'); u.classList.remove('ready'); u.style.setProperty('--p', '0%');
  const hc = new THREE.Vector3(); ch.headG.getWorldPosition(hc);
  ult = { t: 0, hit: false, at: hc.clone().add(new THREE.Vector3(0, ch.R * 0.9, 0)) };
  toolModels.ult.visible = true; say('어…? 저게 뭐야?!', 1);
}
function ultImpact() {
  SND.boom(); shake = 0.3; S.sq = 0.3; S.vsq = 0; S.open = 1.6; dizzy = 3; ko = 1.6;
  const f = $('flash'); f.style.opacity = 0.7; setTimeout(() => f.style.opacity = 0, 160);
  const mult = 1 + Math.min(2, Math.floor(game.combo / 10) * 0.5);
  game.score += Math.round(800 * mult); game.hits++; game.headHits++; updateDamage();
  const left = ch.teeth.filter(t => t.visible); const n = Math.min(left.length, 6);
  for (let k = 0; k < n; k++) { const t = left.splice(Math.floor(Math.random() * left.length), 1)[0]; spawnTooth(t, new THREE.Vector3(rand(-1.5, 1.5), 1.2, 0.3)); t.visible = false; game.teeth++; game.score += Math.round(100 * mult); }
  if (n) addTotalTeeth(n);
  const hc = new THREE.Vector3(); ch.headG.getWorldPosition(hc); const p = toScreen(hc);
  popText('K.O.!!', p.x, p.y - 40); popText(`필살기 +${Math.round(800 * mult)}`, p.x, p.y + 30, 't');
  addBruise(new THREE.Vector3(0.05, ch.R, 0.05), 'bump'); addBruise(new THREE.Vector3(-0.1, ch.R * 0.95, 0.1), 'bump');
  if (!ch.teeth.some(t => t.visible)) { game.score += Math.round(500 * mult); refillT = 1.8; }
  say('꽥…', 1.4); hud();
}
$('ult').onclick = fireUlt;

// 친구 도전장 (?vs=닉네임&s=점수)
const challenge = (() => { const q = new URLSearchParams(location.search); const s = parseInt(q.get('s'), 10); const nk = String(q.get('vs') || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12); return nk && s > 0 && s < 100000 ? { nick: nk, score: s } : null; })();

// 머리 · 몸 흔들림 상태 (스프링)
const S = { rx: 0, vrx: 0, rz: 0, vrz: 0, ry: 0, vry: 0, x: 0, vx: 0, y: 0, vy: 0, z: 0, vz: 0, sq: 1, vsq: 0, open: 0.4, vopen: 0, lean: 0, vlean: 0, leanX: 0, vleanX: 0 };
function spring(key, target, k, c, dt) { const v = 'v' + key; S[v] += (-(S[key] - target) * k - S[v] * c) * dt; S[key] += S[v] * dt; }

function placeMouth() {
  const ry = 0.045 + 0.075 * clamp(S.open, 0, 1.6), w = ch.MW;
  ch.inside.scale.set(w, ry, 1); ch.lip.scale.set(w + 0.014, ry + 0.014, 1);
  ch.tongue.scale.set(w * 0.55, ry * 0.45, 1); ch.tongue.position.y = -ry * 0.55;
  for (const t of ch.teeth) {
    const x = t.userData.x, edge = ry * Math.sqrt(Math.max(0.12, 1 - (x / w) ** 2));
    t.position.y = t.userData.up ? edge - 0.019 : -edge + 0.019;
    const p = t.userData.pop; t.scale.setScalar(p);
  }
}

// =====================================================================
// 도구 (3D 모형 · 성능)
// =====================================================================
// 점수 균형: 빠른 도구는 약하고(콤보·필살기 게이지↑), 센 도구는 쿨타임이 길어요. 초당 빠지는 강냉이가 비슷하도록 맞춤
const TOOLS = {
  fist:    { e: '👊', l: '주먹',   style: 'jab',   pts: 10, cd: 90,  g: 5, teeth: [[0, .3], [1, .7]], pop: ['퍽!', '팍!', '퍼억!'] },
  slap:    { e: '🖐️', l: '싸대기', style: 'side',  pts: 9,  cd: 90,  g: 5, teeth: [[0, .35], [1, .65]], pop: ['짝!', '짜악!'] },
  hammer:  { e: '🔨', l: '뿅망치', style: 'top',   pts: 14, cd: 260, g: 4, teeth: [[1, .7], [2, .3]], pop: ['뿅!', '뿅뿅!'] },
  upper:   { e: '🥊', l: '어퍼컷', style: 'under', pts: 18, cd: 400, g: 4, teeth: [[1, .3], [2, .4], [3, .3]], pop: ['빡!', '콰앙!'] },
  slipper: { e: '🩴', l: '슬리퍼', style: 'side',  pts: 10, cd: 100, g: 5, teeth: [[0, .25], [1, .75]], pop: ['찰싹!', '철썩!'] },
  pan:     { e: '🍳', l: '프라이팬', style: 'side', pts: 20, cd: 450, g: 4, teeth: [[2, .7], [3, .3]], pop: ['텅!!', '띠잉~'] },
  daepa:   { e: '🥬', l: '대파',   style: 'side',  pts: 7,  cd: 70,  g: 9, teeth: [[0, .5], [1, .5]], pop: ['파!', '파파팍!', '대파 싸대기!'] },
  kick:    { e: '🦶', l: '돌려차기', style: 'kick', pts: 22, cd: 550, g: 4, teeth: [[2, .4], [3, .6]], pop: ['뻥!!', '빠악!'] },
  swatter: { e: '⚡', l: '전기 파리채', style: 'side', pts: 9, cd: 80, g: 8, teeth: [[0, .2], [1, .8]], pop: ['지지직!', '파지직!'], unlock: 100 },
  fish:    { e: '🐟', l: '동태 싸대기', style: 'side', pts: 16, cd: 300, g: 6, teeth: [[1, .2], [2, .8]], pop: ['철퍼덕!', '동태 맛 좀 봐라!'], unlock: 250 },
  gold:    { e: '🏆', l: '황금 프라이팬', style: 'side', pts: 25, cd: 400, g: 5, teeth: [[2, .3], [3, .4], [4, .3]], pop: ['황금 텅!!', '띠리링~'], unlock: 500 }
};
const toolModels = {};
{
  const G = () => { const g = new THREE.Group(); g.visible = false; scene.add(g); return g; };
  const skin = mat(SKIN);
  let g = G(); { const a = sph(0.11, 0xffd23a, 0, 0, 0, g); a.scale.set(1, 0.9, 1.15); sph(0.05, 0xffd23a, 0.08, -0.03, 0.04, g, 10); cyl(0.075, 0.08, 0.09, 0xfff4dc, 0, 0, -0.13, g).rotation.x = Math.PI / 2; } toolModels.fist = g;
  g = G(); { box(0.15, 0.17, 0.045, skin, 0, 0, 0, g); for (let k = 0; k < 4; k++) cyl(0.022, 0.02, 0.13, skin, -0.054 + k * 0.036, 0.15, 0, g, 8); const th = cyl(0.024, 0.022, 0.1, skin, 0.1, 0.0, 0, g, 8); th.rotation.z = -0.9; } toolModels.slap = g;
  g = G(); { const h = cyl(0.09, 0.09, 0.24, 0xe8483a, 0, 0, 0, g, 18); h.rotation.z = Math.PI / 2; [-1, 1].forEach(s => { const c = cyl(0.092, 0.092, 0.04, 0xffd23a, 0.12 * s, 0, 0, g, 18); c.rotation.z = Math.PI / 2; }); cyl(0.025, 0.025, 0.42, 0xffd23a, 0, 0.27, 0, g, 10); } toolModels.hammer = g;
  g = G(); { const a = sph(0.13, 0xd9302a, 0, 0, 0, g); a.scale.set(1, 1.1, 1); sph(0.055, 0xd9302a, 0.1, 0.02, 0.03, g, 10); cyl(0.085, 0.09, 0.12, 0xfff4dc, 0, -0.15, 0, g); } toolModels.upper = g;
  g = G(); { const s = box(0.12, 0.03, 0.29, 0x3a8ad8, 0, 0, 0, g); s.geometry = new THREE.CapsuleGeometry(0.06, 0.17, 4, 12); s.rotation.x = Math.PI / 2; s.scale.set(1, 1, 0.28); const st = add(new THREE.TorusGeometry(0.055, 0.014, 6, 16, Math.PI), 0xffffff, 0, 0.012, 0.03, g); st.rotation.y = Math.PI / 2; } toolModels.slipper = g;
  g = G(); { cyl(0.18, 0.16, 0.035, 0x2a2c33, 0, 0, 0, g, 24); cyl(0.15, 0.15, 0.004, 0x55585f, 0, 0.019, 0, g, 24); box(0.035, 0.03, 0.3, 0x1c1c1c, 0, 0.01, 0.31, g); } toolModels.pan = g;
  g = G(); { cyl(0.028, 0.03, 0.24, 0xfaf6ea, 0, -0.18, 0, g, 10); cyl(0.026, 0.028, 0.14, 0xc8e6a8, 0, 0.0, 0, g, 10); [-0.3, 0, 0.3].forEach((r, k) => { const l = cyl(0.016, 0.022, 0.36, 0x3f9a4a, Math.sin(r) * 0.08, 0.24, 0, g, 6); l.rotation.z = r; }); cyl(0.03, 0.03, 0.02, 0xe6dcc2, 0, -0.31, 0, g, 10); } toolModels.daepa = g;
  g = G(); { cyl(0.07, 0.08, 0.42, mat(0x2f3a56), 0, 0.25, 0, g, 10); box(0.13, 0.1, 0.27, 0xf4f4f0, 0, 0, 0.06, g); box(0.135, 0.03, 0.275, 0xe8483a, 0, -0.045, 0.06, g); } toolModels.kick = g;
  g = G(); { cyl(0.02, 0.02, 0.32, 0x2f6fd8, 0, -0.2, 0, g, 8); const f = box(0.26, 0.3, 0.025, new THREE.MeshLambertMaterial({ color: 0xbfe6ff, emissive: 0x2a6aff, emissiveIntensity: 0.6 }), 0, 0.12, 0, g); f.material.transparent = true; f.material.opacity = 0.85; box(0.28, 0.32, 0.015, glow(0x6ad8ff), 0, 0.12, -0.005, g); } toolModels.swatter = g;
  g = G(); { const b = sph(0.1, 0x9aa8b8, 0, 0, 0, g, 14); b.scale.set(1, 3.2, 0.6); const t = add(new THREE.ConeGeometry(0.1, 0.16, 4), 0x8a98a8, 0, 0.38, 0, g); t.scale.z = 0.4; sph(0.022, 0x111111, 0.05, -0.22, 0.05, g, 8); } toolModels.fish = g;
  g = G(); { const gm = new THREE.MeshLambertMaterial({ color: 0xffc83a, emissive: 0x6a4a00 }); cyl(0.19, 0.17, 0.035, gm, 0, 0, 0, g, 24); cyl(0.16, 0.16, 0.004, glow(0xffe68a), 0, 0.019, 0, g, 24); box(0.035, 0.03, 0.3, gm, 0, 0.01, 0.33, g); } toolModels.gold = g;
  { const big = toolModels.hammer.clone(); big.visible = false; scene.add(big); toolModels.ult = big; }
  Object.values(toolModels).forEach(m => m.traverse(o => { if (o.isMesh) o.castShadow = true; }));
}
const swings = [];

// =====================================================================
// 날아가는 강냉이 · 멍
// =====================================================================
const flyGeo = new THREE.LatheGeometry([[0, -0.04], [0.014, -0.04], [0.017, -0.012], [0.026, 0.012], [0.028, 0.028], [0.02, 0.038], [0, 0.04]].map(p => new THREE.Vector2(p[0] * 2, p[1] * 2)), 8);
const flyMat = mat(0xfffdf4);
const flying = [];
const FLOOR_Y = 0.055;
function spawnTooth(t, dir) {
  const p = new THREE.Vector3(); t.getWorldPosition(p);
  const m = new THREE.Mesh(flyGeo, flyMat); m.position.copy(p); m.castShadow = true; scene.add(m);
  m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
  flying.push({ m, v: new THREE.Vector3(dir.x * rand(0.8, 1.9) + rand(-0.7, 0.7), rand(2.0, 3.2) + dir.y * 1.0, rand(0.15, 0.75)), w: new THREE.Vector3(rand(-14, 14), rand(-14, 14), rand(-14, 14)), rest: false, life: 0 });
  if (flying.length > 110) { const o = flying.shift(); scene.remove(o.m); }
}
const bruiseGeo = new THREE.CircleGeometry(1, 20);
function addBruise(local, kind) {
  const n = local.clone().normalize(); const R = ch.R;
  let m;
  if (kind === 'bump') { m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), mat(0xf7c9b0)); m.position.copy(n.clone().multiplyScalar(R * 0.98)); m.scale.set(1, 0.8, 1); }
  else if (kind === 'plaster') {
    m = new THREE.Group(); const a = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.008), mat(0xf2d2a2)); m.add(a); const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.051, 0.01), mat(0xe8b88a)); m.add(b);
    m.position.copy(n.clone().multiplyScalar(R + 0.006)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); m.rotateZ(rand(-0.8, 0.8));
  } else {
    const c = kind === 'hand' ? 0xff3a3a : kind === 'pan' ? 0xff6a4a : 0x8a2d6a;
    m = new THREE.Mesh(bruiseGeo, new THREE.MeshLambertMaterial({ color: c, transparent: true, opacity: kind === 'b' ? 0.5 : 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    const r = kind === 'hand' ? 0.085 : kind === 'pan' ? 0.12 : 0.065; m.scale.set(r * (kind === 'hand' ? 0.8 : 1), r, 1);
    m.position.copy(n.clone().multiplyScalar(R + 0.003)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); m.rotateZ(rand(0, 6));
  }
  ch.bruises.add(m);
  while (ch.bruises.children.length > 22) ch.bruises.remove(ch.bruises.children[0]);
}

// =====================================================================
// 소리
// =====================================================================
let ac, noiseBuf, soundOn = store.get('sound', true);
function A() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); return ac; }
function noise(dur, type, freq, gain, q = 1, delay = 0) {
  const a = A(); if (!a || !soundOn) return;
  if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate * 0.6, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = a.createBufferSource(); s.buffer = noiseBuf; const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain(); const t = a.currentTime + delay; g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(a.destination); s.start(t); s.stop(t + dur + 0.02);
}
function tone(f0, f1, dur, type, gain, delay = 0) {
  const a = A(); if (!a || !soundOn) return;
  const o = a.createOscillator(), g = a.createGain(); const t = a.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
const SND = {
  fist() { noise(0.18, 'lowpass', 900, 0.9); tone(150, 45, 0.2, 'sine', 0.9); },
  slap() { noise(0.12, 'highpass', 1800, 0.9); noise(0.08, 'bandpass', 3200, 0.6, 2); },
  hammer() { tone(520, 1500, 0.1, 'square', 0.12); tone(1300, 380, 0.16, 'triangle', 0.3, 0.06); noise(0.07, 'lowpass', 1400, 0.4); },
  upper() { noise(0.28, 'lowpass', 650, 1); tone(200, 38, 0.32, 'sine', 1); },
  slipper() { noise(0.1, 'bandpass', 1500, 1, 1.5); tone(320, 120, 0.1, 'triangle', 0.3); },
  pan() { [523, 1187, 1893, 2650].forEach((f, i) => tone(f, f * 0.98, 0.9 - i * 0.15, 'sine', 0.28 / (i + 1))); noise(0.06, 'highpass', 2500, 0.6); },
  daepa() { noise(0.14, 'bandpass', 700, 0.5, 0.7); noise(0.06, 'highpass', 2200, 0.5, 1, 0.08); },
  kick() { noise(0.2, 'bandpass', 500, 0.4, 0.5); noise(0.3, 'lowpass', 500, 1, 1, 0.1); tone(170, 35, 0.35, 'sine', 1, 0.1); },
  swatter() { tone(120, 90, 0.25, 'sawtooth', 0.18); noise(0.2, 'highpass', 4000, 0.4); tone(2400, 1800, 0.1, 'square', 0.06, 0.05); },
  fish() { noise(0.16, 'lowpass', 1200, 0.9, 0.8); noise(0.1, 'highpass', 2500, 0.3, 1, 0.03); tone(260, 90, 0.14, 'sine', 0.5); },
  gold() { [784, 1568, 2350, 3136].forEach((f, i) => tone(f, f, 1.0 - i * 0.15, 'sine', 0.25 / (i + 1))); [1320, 1760, 2640].forEach((f, i) => tone(f, f, 0.12, 'triangle', 0.15, 0.1 + i * 0.07)); },
  ult() { tone(300, 1800, 0.35, 'sawtooth', 0.12); },
  boom() { noise(0.6, 'lowpass', 300, 1.2); tone(90, 30, 0.7, 'sine', 1.2); noise(0.3, 'bandpass', 1500, 0.6, 0.6, 0.02); },
  unlock() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.18, 'triangle', 0.22, i * 0.08)); },
  miss() { noise(0.22, 'bandpass', 900, 0.25, 0.6); },
  tooth() { tone(1500, 2700, 0.09, 'sine', 0.2, 0.03); },
  land() { tone(2300, 1700, 0.05, 'triangle', 0.08); },
  refill() { [660, 880, 1320].forEach((f, i) => tone(f, f, 0.12, 'triangle', 0.25, i * 0.08)); },
  beep(h) { tone(h ? 1320 : 880, h ? 1320 : 880, h ? 0.35 : 0.15, 'square', 0.12); },
  end() { [784, 659, 523, 1047].forEach((f, i) => tone(f, f, 0.18, 'triangle', 0.25, i * 0.12)); }
};
let lastLand = 0;

// =====================================================================
// 화면 글자 · 말풍선
// =====================================================================
const fxEl = $('fx'), bubble = $('bubble');
function popText(text, x, y, cls = '') { const d = document.createElement('div'); d.className = 'pop ' + cls; d.textContent = text; d.style.left = x + 'px'; d.style.top = y + 'px'; fxEl.appendChild(d); d.addEventListener('animationend', () => d.remove()); }
const toScreen = v => { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; };
const LINES = ['아야!', '으악!', '잘못했어요ㅠ', '내 강냉이!!', '살살해…', '그만해!!', '으어어', '치과 예약해야겠다', '왜 나한테 그래', '엄마아…', '아 진짜!!', '항복! 항복!', '내가 뭘 했다고!', '보험 되나요?'];
const LINES_PAN = ['띠요오옹…', '종소리 들려…', '별이 보여…'];
const LINES_DAEPA = ['대파는 반칙이지!', '파 냄새…', '오늘 저녁 파전?'];
const LINES_TAUNT = ['그게 다야?', '하나도 안 아픈데?', '모기 물린 줄', '30초 금방 간다~', '에헤이~ 약하다'];
let speech = 0;
const short = (t, n = 12) => Array.from(t).length > n ? Array.from(t).slice(0, n).join('') + '…' : t;
const whyLines = () => [`${short(tWhy())}? 오해야!`, `${short(tWhy())} 안 할게요ㅠ`, `내가 언제 ${short(tWhy(), 9)}…`, '다시는 안 그럴게!', '잘못했다고오오'];
function say(t, dur = 1.4) { bubble.textContent = t; bubble.classList.add('show'); speech = dur; }

// =====================================================================
// 게임 상태
// =====================================================================
let mode = 'menu';         // menu | count | free | rank | result
let tool = store.get('tool', 'fist'); if (!TOOLS[tool]) tool = 'fist';
const G0 = () => ({ score: 0, teeth: 0, hits: 0, headHits: 0, combo: 0, best: 0, lastHit: 0, time: ROUND, gauge: 0, ults: 0 });
let game = G0();
let ko = 0, koA = 0, ult = null, zapT = 0, goldT = 0, bowA = 0, bow = 0, dizzy = 0, hurt = 0, shake = 0, idleT = 0, toolCd = {}, refillT = 0, timeNow = 0, blinkT = 3;
let lastResult = null, shareBlob = null, shareUrlImg = '';

let totalTeeth = store.get('totalTeeth', 0), seenTools = store.get('seenTools', []);
const unlocked = k => !TOOLS[k].unlock || totalTeeth >= TOOLS[k].unlock;
if (!unlocked(tool)) tool = 'fist';
const toolsEl = $('tools');
function renderTools() {
  toolsEl.innerHTML = '';
  for (const [k, t] of Object.entries(TOOLS)) {
    const lock = !unlocked(k), isNew = !lock && t.unlock && !seenTools.includes(k);
    const b = document.createElement('button'); b.className = 'tool' + (k === tool ? ' on' : '') + (lock ? ' lock' : '') + (isNew ? ' new' : ''); b.dataset.k = k;
    b.innerHTML = `<span class="e">${t.e}</span><span class="l">${lock ? '강냉이 ' + t.unlock : t.l}</span>${lock ? '<span class="lk">🔒</span>' : ''}<i class="cdb"></i>`;
    b.onclick = () => {
      A();
      if (lock) { toast(`${t.l}: 강냉이 ${t.unlock - totalTeeth}개 더 털면 열려요`); return; }
      if (isNew) { seenTools.push(k); store.set('seenTools', seenTools); b.classList.remove('new'); }
      tool = k; store.set('tool', k); [...toolsEl.children].forEach(c => c.classList.toggle('on', c === b));
    };
    toolsEl.appendChild(b);
  }
}
renderTools();
function addTotalTeeth(n) {
  const before = totalTeeth; totalTeeth += n; store.set('totalTeeth', totalTeeth);
  const fresh = Object.entries(TOOLS).filter(([, t]) => t.unlock && before < t.unlock && totalTeeth >= t.unlock);
  if (fresh.length) { renderTools(); for (const [, t] of fresh) { SND.unlock(); toast(`🔓 새 도구 열림: ${t.e} ${t.l}!`); popText(`🔓 ${t.l}`, innerWidth / 2, innerHeight * 0.32, 't'); } }
}
function hud() {
  $('hScore').textContent = game.score.toLocaleString('ko-KR');
  $('hTeeth').textContent = game.teeth; $('hCombo').textContent = game.best;
  $('modeTag').textContent = mode === 'rank' || (mode === 'count' && game.ranked) ? `랭킹전 ${Math.ceil(game.time)}초` : '자유 연습';
  $('ult').classList.toggle('hide', !(mode === 'rank' || mode === 'free'));
  const vl = $('vsLine'); const showVs = !!challenge && (mode === 'rank' || mode === 'count');
  vl.classList.toggle('hide', !showVs); if (showVs) { const d = challenge.score - game.score; vl.classList.toggle('ok', d < 0); vl.textContent = d < 0 ? `✅ ${challenge.nick}님 기록 돌파! (+${(-d).toLocaleString('ko-KR')})` : `🎯 ${challenge.nick}님 ${challenge.score.toLocaleString('ko-KR')}점까지 ${d.toLocaleString('ko-KR')}점`; }
  const tb = $('timebar'); tb.classList.toggle('hide', !(mode === 'rank' || mode === 'count'));
  tb.firstElementChild.style.width = (game.time / ROUND * 100) + '%'; tb.classList.toggle('low', game.time <= 5);
}

// =====================================================================
// 때리기
// =====================================================================
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function hit(cx, cy) {
  A();
  if (mode !== 'free' && mode !== 'rank') return;
  const T = TOOLS[tool]; const now = performance.now();
  if (ko > 0 || ult) return;
  if (now - (toolCd[tool] || 0) < T.cd) { const b = toolsEl.querySelector(`[data-k=${tool}]`); if (b) { b.style.transform = 'scale(.92)'; setTimeout(() => b.style.transform = '', 90); } return; } toolCd[tool] = now;
  $('hint').classList.add('hide');
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const targets = [ch.head]; if (photoMesh && photoMesh.visible) targets.push(photoMesh);
  const hitHead = ray.intersectObjects(targets, false)[0];
  const hitBody = hitHead ? null : ray.intersectObjects(ch.body.children.filter(m => m.isMesh), false)[0];
  const H = hitHead || hitBody;
  if (!H) { popText('휙~', cx, cy, 's'); SND.miss(); swingTo(new THREE.Vector3(ray.ray.origin.x + ray.ray.direction.x * 3, ray.ray.origin.y + ray.ray.direction.y * 3, ray.ray.origin.z + ray.ray.direction.z * 3), 1); game.combo = 0; return; }
  const p = H.point.clone();
  const hc = new THREE.Vector3(); ch.headG.getWorldPosition(hc);
  const side = p.x < hc.x ? -1 : 1;        // 때린 쪽 (-1 왼쪽)
  swingTo(p, side);
  game.hits++;
  game.combo = now - game.lastHit < 800 ? game.combo + 1 : 1; game.lastHit = now; game.best = Math.max(game.best, game.combo);
  const mult = 1 + Math.min(2, Math.floor(game.combo / 10) * 0.5);
  if (!hitHead) { // 몸통
    S.vlean -= 3; S.vleanX += -side * 2; SND.fist(); game.score += Math.round(3 * mult); popText('퍽', cx, cy, 's'); hud(); return;
  }
  const local = ch.headG.worldToLocal(p.clone());
  const push = -side;                       // 머리가 밀리는 방향 (x)
  const dir = new THREE.Vector3(push, 0, -0.3);
  switch (T.style === 'side' ? tool : T.style) {
    case 'jab': S.vrx -= 7; S.vrz += push * 5; S.vz -= 1.6; S.vx += push * 0.8; S.open = 1.1; addBruise(local, 'b'); shake = Math.max(shake, 0.05); break;
    case 'slap': S.vry += push * 14; S.vrz += push * 5; S.vx += push * 1.5; S.open = 0.9; addBruise(local, 'hand'); shake = Math.max(shake, 0.04); break;
    case 'slipper': S.vry += push * 12; S.vrz += push * 6; S.vx += push * 1.3; S.open = 1; addBruise(local, 'hand'); shake = Math.max(shake, 0.04); break;
    case 'swatter': S.vry += push * 8; S.vrz += push * 3; S.open = 1; shake = Math.max(shake, 0.03); zapT = 0.35; break;
    case 'fish': S.vry += push * 13; S.vrz += push * 6; S.vx += push * 1.6; S.open = 1.1; addBruise(local, 'hand'); shake = Math.max(shake, 0.06); break;
    case 'gold': S.vry += push * 17; S.vrx -= 5; S.vrz += push * 8; S.vx += push * 2.2; S.open = 1.4; dizzy = 2; addBruise(local, 'pan'); if (Math.random() < 0.4) addBruise(local.clone().add(new THREE.Vector3(rand(-.1, .1), rand(-.1, .1), 0)), 'plaster'); shake = 0.13; goldT = 0.6; break;
    case 'daepa': S.vry += push * 9; S.vrz += push * 3; S.open = 0.8; shake = Math.max(shake, 0.02); break;
    case 'pan': S.vry += push * 16; S.vrx -= 5; S.vrz += push * 7; S.vx += push * 2; S.open = 1.3; dizzy = 1.8; addBruise(local, 'pan'); if (Math.random() < 0.35) addBruise(local.clone().add(new THREE.Vector3(rand(-.1, .1), rand(-.1, .1), 0)), 'plaster'); shake = 0.12; break;
    case 'top': S.sq = 0.6; S.vsq = 0; S.vy -= 2.2; S.open = 1.25; dizzy = 2.2; dir.set(push * 0.4, -0.4, 0); addBruise(new THREE.Vector3(rand(-0.12, 0.12), ch.R, rand(-0.05, 0.1)), 'bump'); shake = Math.max(shake, 0.04); break;
    case 'under': S.vrx -= 13; S.vy += 2.5; S.vz -= 0.6; S.sq = 1.2; S.open = 1.5; dir.set(push * 0.3, 0.9, 0); addBruise(local, 'b'); shake = 0.14; break;
    case 'kick': S.vleanX += push * 7; S.vry += push * 10; S.vrz += push * 9; S.vx += push * 2.5; S.open = 1.4; dizzy = 1.2; dir.set(push * 1.4, 0.2, 0); addBruise(local, 'b'); shake = 0.16; break;
  }
  ch.arms.forEach(a => { a.vz += rand(-14, 14); a.vx += rand(-10, 4); });
  SND[tool](); hurt = 0.45; idleT = 0;
  game.headHits++; updateDamage(); addGauge(T.g);
  game.score += Math.round(T.pts * mult);
  popText(pick(T.pop), cx, cy - 10);
  // 강냉이 빠지기
  let r = Math.random(), n = 0; for (const [cnt, pr] of T.teeth) { if ((r -= pr) <= 0) { n = cnt; break; } }
  if (game.combo >= 20 && Math.random() < 0.3) n++;
  const left = ch.teeth.filter(t => t.visible);
  n = Math.min(n, left.length);
  for (let k = 0; k < n; k++) {
    const t = left.splice(Math.floor(Math.random() * left.length), 1)[0];
    spawnTooth(t, dir); t.visible = false; game.teeth++; game.score += Math.round(100 * mult);
  }
  if (n) { addTotalTeeth(n); addGauge(n * 5); }
  if (n) { SND.tooth(); const hp = toScreen(hc.clone().add(new THREE.Vector3(0, -0.45, 0))); popText(`강냉이 +${n}`, hp.x, hp.y, 't'); }
  if (!ch.teeth.some(t => t.visible) && refillT <= 0) {
    game.score += Math.round(500 * mult); refillT = 0.9; say('이빨이 업써…', 1.2);
    const hp = toScreen(hc.clone().add(new THREE.Vector3(0, 0.6, 0))); popText('🌽 완판 보너스 +500', hp.x, hp.y, 't');
  } else if (Math.random() < (n ? 0.5 : 0.25)) say(tgt.why && Math.random() < 0.35 ? pick(whyLines()) : tool === 'pan' ? pick(LINES_PAN) : tool === 'daepa' && Math.random() < 0.6 ? pick(LINES_DAEPA) : pick(LINES));
  hud();
}
function swingTo(p, side) {
  const m = toolModels[tool]; const st = TOOLS[tool].style;
  const from = p.clone();
  if (st === 'jab') from.add(new THREE.Vector3(side * 0.25, -0.1, 0.8));
  else if (st === 'side') from.add(new THREE.Vector3(side * 0.8, 0.05, 0.35));
  else if (st === 'top') from.add(new THREE.Vector3(0.05, 0.8, 0.3));
  else if (st === 'under') from.add(new THREE.Vector3(side * 0.1, -0.8, 0.45));
  else from.add(new THREE.Vector3(side * 1.1, -0.35, 0.2));
  swings.push({ m, from, to: p.clone(), t: 0, side, st });
}
canvas.addEventListener('pointerdown', e => { e.preventDefault(); hit(e.clientX, e.clientY); });

// =====================================================================
// 진행 (메뉴 · 카운트다운 · 30초 · 결과)
// =====================================================================
function refill(instant) {
  ch.teeth.forEach(t => { t.visible = true; t.userData.pop = instant ? 1 : 0.01; });
  if (!instant) { SND.refill(); say('새 이빨 장착 완료! 😁', 1.2); const f = $('flash'); f.style.opacity = 0.35; setTimeout(() => f.style.opacity = 0, 120); }
}
function clearFloor() { flying.forEach(o => scene.remove(o.m)); flying.length = 0; }
function resetChar() { ch.bruises.clear(); dizzy = 0; bow = 0; ko = 0; ult = null; toolModels.ult.visible = false; ch.sign.visible = false; refill(true); applyTarget(); updateDamage(); const u = $('ult'); u.classList.remove('ready'); u.style.setProperty('--p', '0%'); }
function show(id, on) { $(id).classList.toggle('hide', !on); }
function startGame(ranked) {
  A(); saveNick();
  show('start', false); show('result', false); show('board', false); show('form', false);
  game = G0(); game.ranked = ranked; resetChar(); clearFloor(); hud();
  if (!ranked) { mode = 'free'; hud(); $('hint').classList.remove('hide'); say(tgt.why ? `뭐? 내가 ${short(tWhy())}? 기억 안 나는데~` : '덤벼라!', 2); return; }
  mode = 'count'; hud(); let n = 3;
  const tick = () => {
    const c = $('count');
    if (n > 0) { c.innerHTML = `<span>${n}</span>`; SND.beep(false); n--; setTimeout(tick, 800); }
    else { c.innerHTML = '<span>시작!</span>'; SND.beep(true); mode = 'rank'; game.time = ROUND; hud(); setTimeout(() => { if (c.firstChild) c.innerHTML = ''; }, 800); say(tgt.why ? `뭐? 내가 ${short(tWhy())}? 기억 안 나는데~` : pick(LINES_TAUNT), 2); }
  };
  tick();
}
function goHome() { mode = 'menu'; show('result', false); show('board', false); show('start', true); $('hint').classList.add('hide'); $('count').innerHTML = ''; game = G0(); hud(); }
function titleOf(t) {
  if (t >= 64) return '👑 전설의 강냉이 파괴자'; if (t >= 48) return '🦷 치과의사들의 공공의 적'; if (t >= 32) return '🌽 강냉이 수확왕';
  if (t >= 16) return '🔥 강냉이 사냥꾼'; if (t >= 6) return '👊 강냉이 견습생'; if (t >= 1) return '🐣 강냉이 입문자'; return '😇 양심 있는 사람';
}
async function endRound() {
  mode = 'result'; SND.end(); $('count').innerHTML = '<span style="font-size:72px">끝!</span>';
  const r = { target: getTarget(), nick: getNick(), score: game.score, teeth: game.teeth, combo: game.best, hits: game.hits };
  lastResult = r; say('잘못했어요… 😭', 3); bow = 1; ch.sign.visible = true; drawSign(); refillT = 0;
  await new Promise(res => setTimeout(res, 1400)); $('count').innerHTML = '';
  // 공유 이미지 만들기 (사진은 빼고)
  try { await makeShareCard(r); } catch (e) { console.warn(e); }
  $('cert').src = shareUrlImg;
  $('rRank').textContent = '랭킹 등록 중…'; show('result', true);
  const res = await submitScore(r);
  r.rank = res;
  if (res && res.online) {
    const parts = []; if (res.today) parts.push(`오늘 ${res.today}위`); if (res.all) parts.push(`역대 ${res.all}위`);
    $('rRank').textContent = (res.best ? '🎉 ' : '') + (parts.join(' · ') || '랭킹 100위 밖이에요') + (res.best ? '!' : ` (내 최고 ${res.myBest.toLocaleString('ko-KR')}점)`);
  } else if (res) { $('rRank').textContent = res.localBest ? '🎉 내 최고 기록!' : `내 최고 기록 ${res.myBest.toLocaleString('ko-KR')}점`; }
  if (challenge) { const d = challenge.score - r.score; $('rRank').textContent += d < 0 ? `  ·  🎉 ${challenge.nick}님 기록 돌파!` : `  ·  😭 ${challenge.nick}님보다 ${d.toLocaleString('ko-KR')}점 부족`; }
  try { await makeShareCard(r); $('cert').src = shareUrlImg; } catch {}
}

// =====================================================================
// 닉네임 · 랭킹
// =====================================================================
const nickEl = $('nick');
nickEl.value = store.get('nick', '');
const cleanNick = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);
function getNick() { return cleanNick(nickEl.value) || store.get('anon', '') || (() => { const a = '익명의 강냉이헌터' + Math.floor(rand(10, 99)); store.set('anon', a); return a; })(); }
function saveNick() { store.set('nick', cleanNick(nickEl.value)); }
const clean = (v, n) => String(v || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
let tgt = store.get('tgt', { name: '', why: '' });
const tName = () => tgt.name || '스트레스';
const tWhy = () => tgt.why || '나를 힘들게 함';
function getTarget() { return tName(); }
let online = null;
async function api(path, body) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal } : { cache: 'no-store', signal: ctl.signal });
    if (!r.ok) throw new Error('http ' + r.status); const j = await r.json(); online = true; return j;
  } finally { clearTimeout(tm); }
}
function localBoard() { return store.get('local', []); }
async function submitScore(r) {
  const loc = localBoard(); const prevBest = loc.length ? loc[0].score : 0;
  loc.push({ nick: r.nick, score: r.score, teeth: r.teeth, combo: r.combo, t: Date.now(), id: myId }); loc.sort((a, b) => b.score - a.score); loc.length = Math.min(loc.length, 20); store.set('local', loc);
  try {
    const j = await api('/api/smash/score', { id: myId, nick: r.nick, score: r.score, teeth: r.teeth, combo: r.combo, hits: r.hits });
    boardCache = j.boards || boardCache;
    return { online: true, today: j.rank && j.rank.today, all: j.rank && j.rank.all, best: r.score > prevBest || (j.rank && j.rank.today === 1), myBest: Math.max(prevBest, r.score) };
  } catch { online = false; return { online: false, localBest: r.score > prevBest && r.score > 0, myBest: Math.max(prevBest, r.score) }; }
}
let boardCache = null, boardTab = 'today';
async function openBoard() {
  show('board', true); renderBoard(boardCache);
  try { boardCache = await api('/api/smash/rank'); } catch { online = false; }
  renderBoard(boardCache);
}
function renderBoard(b) {
  const list = $('rankList'), note = $('bNote');
  $('tToday').classList.toggle('on', boardTab === 'today'); $('tAll').classList.toggle('on', boardTab === 'all');
  let rows;
  if (online === false) { rows = localBoard(); note.textContent = '온라인 랭킹에 연결할 수 없어서 이 기기의 내 기록만 보여요.'; note.classList.remove('hide'); }
  else { rows = b ? (boardTab === 'today' ? b.today : b.all) || [] : null; note.classList.add('hide'); }
  if (!rows) { list.innerHTML = '<div class="empty">불러오는 중…</div>'; return; }
  if (!rows.length) { list.innerHTML = '<div class="empty">아직 기록이 없어요. 첫 번째 주인공이 되어 보세요!</div>'; return; }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  list.innerHTML = rows.slice(0, 30).map((e, i) => `<li class="${e.id === myId ? 'me' : ''}"><span class="n">${i + 1}</span><span class="nm">${esc(e.nick)}<small>🦷${e.teeth}</small></span><span class="s">${Number(e.score).toLocaleString('ko-KR')}</span></li>`).join('');
}
$('tToday').onclick = () => { boardTab = 'today'; renderBoard(boardCache); };
$('tAll').onclick = () => { boardTab = 'all'; renderBoard(boardCache); };
$('bClose').onclick = () => show('board', false);

// =====================================================================
// 결과 공유 카드
// =====================================================================
function gameUrl() { return /^https?:$/.test(location.protocol) && !/claude|anthropic|usercontent/.test(location.hostname) ? location.origin + '/smash/' : location.href.split('#')[0]; }
function challengeUrl(r) { return gameUrl() + `?vs=${encodeURIComponent(r.nick)}&s=${r.score}`; }
function shareText(r) { return `🌽 '${r.target}' 강냉이 ${r.teeth}개 털었다! (${r.score.toLocaleString('ko-KR')}점 · ${titleOf(r.teeth).replace(/^\S+\s/, '')})\n🔥 도전장: 내 점수 넘어볼 사람? 👉 ${challengeUrl(r)}`; }
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrapLines(g, text, maxW) {
  const out = []; let line = '';
  for (const w of text.split(' ')) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}
function flourish(g, x, y, sx, sy) {
  g.save(); g.translate(x, y); g.scale(sx, sy); g.strokeStyle = '#6b4a2e'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 46); g.bezierCurveTo(0, 10, 10, 0, 46, 0); g.stroke();
  g.beginPath(); g.arc(22, 22, 9, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(8, 60); g.quadraticCurveTo(14, 38, 32, 30); g.moveTo(60, 8); g.quadraticCurveTo(38, 14, 30, 32); g.stroke();
  g.restore();
}
async function makeShareCard(r) {
  // 사진 없이 한 장 렌더
  const hadPhoto = photoOn(); if (hadPhoto) setPhotoVisible(false);
  composer.render();
  const shot = document.createElement('canvas'); shot.width = canvas.width; shot.height = canvas.height; shot.getContext('2d').drawImage(canvas, 0, 0);
  if (hadPhoto) setPhotoVisible(true);
  try { await Promise.all([document.fonts.load('80px "Black Han Sans"'), document.fonts.load('900 40px "Noto Sans KR"'), document.fonts.load('500 40px "Noto Sans KR"')]); } catch {}
  const W = 1080, H = 1560, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2a1c38'); bg.addColorStop(1, '#0b0d14'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // 장면 (털린 캐릭터)
  const hc = new THREE.Vector3(); ch.headG.getWorldPosition(hc); const sp = toScreen(hc.clone().add(new THREE.Vector3(0, -0.32, 0)));
  const bx = 40, by = 40, bw = 1000, bh = 800, sx = shot.width / innerWidth;
  const k = Math.max(bw / shot.width, bh / shot.height) * 1.0; const cw = bw / k, chh = bh / k;
  let ox = sp.x * sx - cw / 2, oy = sp.y * sx - chh / 2; ox = clamp(ox, 0, shot.width - cw); oy = clamp(oy, 0, shot.height - chh);
  g.save(); rrect(g, bx, by, bw, bh, 36); g.clip(); g.drawImage(shot, ox, oy, cw, chh, bx, by, bw, bh);
  const vg = g.createLinearGradient(0, by, 0, by + 220); vg.addColorStop(0, 'rgba(11,13,20,.7)'); vg.addColorStop(1, 'rgba(11,13,20,0)'); g.fillStyle = vg; g.fillRect(bx, by, bw, 220);
  g.restore();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.font = '96px "Black Han Sans","Noto Sans KR",sans-serif';
  g.shadowColor = 'rgba(120,255,120,.9)'; g.shadowBlur = 40; g.lineWidth = 16; g.strokeStyle = '#1a1206'; g.strokeText('스트레스 해결 완료!', W / 2, 135);
  g.shadowBlur = 0; g.fillStyle = '#fff'; g.fillText('스트레스 해결 완료!', W / 2, 135);
  // 수료증 종이
  const px = 50, py = 760, pw = 980, ph = 700;
  g.save(); g.translate(W / 2, py + ph / 2); g.rotate(-0.012); g.translate(-W / 2, -(py + ph / 2));
  g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 30; g.shadowOffsetY = 10;
  const pg = g.createLinearGradient(0, py, 0, py + ph); pg.addColorStop(0, '#fff6d6'); pg.addColorStop(1, '#f6e6b8'); g.fillStyle = pg; g.fillRect(px, py, pw, ph);
  g.shadowColor = 'transparent';
  g.strokeStyle = '#6b4a2e'; g.lineWidth = 6; g.strokeRect(px + 18, py + 18, pw - 36, ph - 36); g.lineWidth = 2; g.strokeRect(px + 32, py + 32, pw - 64, ph - 64);
  flourish(g, px + 26, py + 26, 1, 1); flourish(g, px + pw - 26, py + 26, -1, 1); flourish(g, px + 26, py + ph - 26, 1, -1); flourish(g, px + pw - 26, py + ph - 26, -1, -1);
  // 워터마크 강냉이
  g.globalAlpha = 0.08; g.font = '260px serif'; g.fillText('🌽', px + 170, py + ph / 2 + 60); g.globalAlpha = 1;
  g.fillStyle = '#2a1c0e'; g.font = '900 64px "Noto Sans KR",sans-serif'; g.fillText('강냉이 털기 수료증', W / 2, py + 110);
  g.fillStyle = '#b8452e'; g.font = '700 30px "Noto Sans KR",sans-serif'; g.fillText(titleOf(r.teeth), W / 2, py + 170);
  g.fillStyle = '#3a2a1a'; g.font = '500 36px "Noto Sans KR",sans-serif';
  const body = `귀하 ${r.nick} 님은 '${r.target}'(을)를 완벽하게 털어 강냉이 ${r.teeth}개를 수확했으므로, 이에 따라 스트레스도 털렸음을 공식 확인하며 본 수료증을 수여합니다.`;
  wrapLines(g, body, pw - 180).forEach((l, i) => g.fillText(l, W / 2, py + 245 + i * 56));
  g.font = '900 34px "Noto Sans KR",sans-serif'; g.fillStyle = '#2a1c0e';
  const rk = r.rank && r.rank.online && r.rank.today ? `  ·  오늘 ${r.rank.today}위` : '';
  g.fillText(`${r.score.toLocaleString('ko-KR')}점  ·  최고 콤보 ${r.combo}${rk}`, W / 2, py + 480);
  const d = new Date(); g.font = '500 28px "Noto Sans KR",sans-serif'; g.fillStyle = '#6b5a44';
  g.fillText(`${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`, W / 2, py + 540);
  g.textAlign = 'right'; g.fillStyle = '#3a2a1a'; g.font = '700 32px "Noto Sans KR",sans-serif'; g.fillText('강냉이 상담소장 (인)', px + pw - 190, py + 615);
  // 도장
  g.save(); g.translate(px + pw - 120, py + 605); g.rotate(-0.2); g.globalAlpha = 0.85; g.strokeStyle = '#d6332a'; g.fillStyle = '#d6332a'; g.lineWidth = 6;
  g.beginPath(); g.arc(0, 0, 50, 0, 7); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 42, 0, 7); g.stroke();
  g.textAlign = 'center'; g.font = '900 24px "Noto Sans KR",sans-serif'; g.fillText('강냉이', 0, -12); g.fillText('털기 인증', 0, 18); g.restore();
  g.restore();
  g.textAlign = 'center'; g.fillStyle = '#9aa3bd'; g.font = '700 30px "Noto Sans KR",sans-serif'; g.fillText('🔥 내 점수 넘어봐 👉 ' + gameUrl().replace(/^https?:\/\//, ''), W / 2, H - 45);
  shareUrlImg = c.toDataURL('image/png');
  shareBlob = await new Promise(res => c.toBlob(res, 'image/png'));
}
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800); }
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {}
  try { const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = 0; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch { return false; }
}
$('rShare').onclick = async () => {
  if (!lastResult) return; const text = shareText(lastResult);
  try {
    if (shareBlob && navigator.canShare) { const file = new File([shareBlob], 'kangnaengi.png', { type: 'image/png' }); if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: '강냉이 털기 3D', text }); return; } }
    if (navigator.share) { await navigator.share({ title: '강냉이 털기 3D', text }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  $('sTitle').textContent = '📤 결과 공유'; $('shareImg').src = shareUrlImg; show('share', true);
};
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inApp = /Instagram|FBAN|FBAV|KAKAOTALK|NAVER|Line\//i.test(navigator.userAgent);
$('rSave').onclick = () => {
  if (!shareUrlImg) return;
  const sandboxed = !/^https?:$/.test(location.protocol) || /claude|anthropic|usercontent/.test(location.hostname);
  if (!isIOS && !inApp && !sandboxed) { try { const a = document.createElement('a'); a.href = URL.createObjectURL(shareBlob); a.download = '강냉이털기_수료증.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('수료증을 저장했어요!'); return; } catch {} }
  $('sTitle').textContent = '💾 수료증 저장'; $('shareImg').src = shareUrlImg; show('share', true);
};
$('sCopy').onclick = async () => { toast(await copyText(shareText(lastResult)) ? '링크와 문구를 복사했어요!' : '복사가 안 돼요. 직접 길게 눌러 복사해 주세요'); };
$('sClose').onclick = () => show('share', false);

// =====================================================================
// 사진 넣기 (얼굴 앞면에 붙이기)
// =====================================================================
let photoMesh = null, photo = null, pm = null;
const faceParts = () => [...ch.eyes, ...ch.brows, ...ch.cheeks, ch.nose, ch.fringe];
function photoOn() { return !!(photoMesh && photoMesh.visible); }
function setPhotoVisible(v) { if (!photoMesh) return; photoMesh.visible = v; faceParts().forEach(m => m.visible = !v); }
function applyPhoto(p) {
  if (!p) { if (photoMesh) { photoMesh.visible = false; faceParts().forEach(m => m.visible = true); } photo = null; return; }
  photo = p;
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.translate(256, 256); drawPhoto(g, p, 256); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in'; const gr = g.createRadialGradient(256, 256, 200, 256, 256, 256); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  if (!photoMesh) {
    photoMesh = new THREE.Mesh(new THREE.SphereGeometry(ch.R + 0.0015, 40, 24, Math.PI / 2 - 0.9, 1.8, Math.PI / 2 - 0.9, 1.8), new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false }));
    ch.headG.add(photoMesh);
  }
  photoMesh.material.map = tex; photoMesh.material.needsUpdate = true; setPhotoVisible(true);
}
function drawPhoto(g, p, r) { const im = p.img, k = 2.2 * r / Math.min(im.width, im.height) * p.s; g.save(); g.translate(p.tx * r, p.ty * r); g.rotate(p.rot); g.drawImage(im, -im.width * k / 2, -im.height * k / 2, im.width * k, im.height * k); g.restore(); }
const pv = $('pv'), pc = pv.getContext('2d'), PVR = 190, PCX = 240, PCY = 240;
function drawPreview() {
  pc.setTransform(1, 0, 0, 1, 0, 0); pc.fillStyle = '#22252e'; pc.fillRect(0, 0, 480, 480); if (!pm) return;
  pc.save(); pc.translate(PCX, PCY); drawPhoto(pc, pm, PVR); pc.restore();
  pc.fillStyle = 'rgba(8,10,16,.6)'; pc.beginPath(); pc.rect(0, 0, 480, 480); pc.arc(PCX, PCY, PVR, 0, Math.PI * 2); pc.fill('evenodd');
  pc.strokeStyle = '#fff'; pc.lineWidth = 4; pc.beginPath(); pc.arc(PCX, PCY, PVR, 0, Math.PI * 2); pc.stroke();
  pc.setLineDash([12, 9]); pc.strokeStyle = '#ff8a45'; pc.lineWidth = 5; pc.beginPath(); pc.ellipse(PCX, PCY + 0.52 * PVR, 0.34 * PVR, 0.11 * PVR, 0, 0, Math.PI * 2); pc.stroke(); pc.setLineDash([]);
}
function openPhoto() {
  pm = photo ? { ...photo } : null; show('pPick', !pm); show('pAdj', !!pm); $('pApply').disabled = !pm; show('pRemove', !!photo);
  if (pm) { $('pZ').value = pm.s; drawPreview(); } show('photo', true);
}
function loadFile(f) {
  if (!f) return; const url = URL.createObjectURL(f), im = new Image();
  im.onload = () => {
    const m = 1024, k = Math.min(1, m / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    pm = { img: c, tx: 0, ty: 0, s: 1, rot: 0 }; $('pZ').value = 1; show('pPick', false); show('pAdj', true); $('pApply').disabled = false; drawPreview();
  };
  im.onerror = () => { URL.revokeObjectURL(url); toast('이 사진은 열 수 없어요'); }; im.src = url;
}
$('pFile').onchange = e => { loadFile(e.target.files[0]); e.target.value = ''; };
$('pFile2').onchange = e => { loadFile(e.target.files[0]); e.target.value = ''; };
$('pApply').onclick = () => { if (pm) applyPhoto({ ...pm }); show('photo', false); if (!$('form').classList.contains('hide')) formStep(3); };
$('pCancel').onclick = () => show('photo', false);
$('pRemove').onclick = () => { applyPhoto(null); show('photo', false); if (!$('form').classList.contains('hide')) formStep(3); };
$('pZ').oninput = () => { if (pm) { pm.s = +$('pZ').value; drawPreview(); } };
$('pZo').onclick = () => { if (pm) { pm.s = Math.max(0.5, pm.s / 1.1); $('pZ').value = pm.s; drawPreview(); } };
$('pZi').onclick = () => { if (pm) { pm.s = Math.min(4, pm.s * 1.1); $('pZ').value = pm.s; drawPreview(); } };
$('pRot').onclick = () => { if (pm) { pm.rot += Math.PI / 2; drawPreview(); } };
{
  const ptrs = new Map(); let g0 = null;
  const gest = () => { const a = [...ptrs.values()]; if (a.length < 2) return null; return { d: Math.hypot(a[1].x - a[0].x, a[1].y - a[0].y), a: Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x) }; };
  pv.addEventListener('pointerdown', e => { pv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); g0 = gest(); });
  pv.addEventListener('pointermove', e => {
    if (!pm || !ptrs.has(e.pointerId)) return; const pr = ptrs.get(e.pointerId), sc = 480 / pv.getBoundingClientRect().width;
    if (ptrs.size === 1) { pm.tx += (e.clientX - pr.x) * sc / PVR; pm.ty += (e.clientY - pr.y) * sc / PVR; }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size >= 2) { const g = gest(); if (g0 && g) { pm.s = clamp(pm.s * g.d / g0.d, 0.5, 4); pm.rot += g.a - g0.a; $('pZ').value = pm.s; } g0 = g; }
    drawPreview();
  });
  const up = e => { ptrs.delete(e.pointerId); g0 = gest(); };
  pv.addEventListener('pointerup', up); pv.addEventListener('pointercancel', up);
  pv.addEventListener('wheel', e => { if (!pm) return; e.preventDefault(); pm.s = clamp(pm.s * Math.exp(-e.deltaY * 0.0015), 0.5, 4); $('pZ').value = pm.s; drawPreview(); }, { passive: false });
}

// =====================================================================
// 버튼
// =====================================================================
let formRanked = true, fStep = 1;
const BUBS = ['', '어서와…<br>뭐? 누가 너를 힘들게 했다고?', '너한테<br>어케 했는데?', '사진 있으면 보여줘 봐.<br>없어도 괜찮아!'];
function formStep(n) {
  fStep = n; [1, 2, 3].forEach(i => show('fs' + i, i === n));
  $('fBub').innerHTML = BUBS[n]; document.querySelectorAll('.psteps i').forEach((d, i) => d.classList.toggle('on', i < n));
  $('fNext').textContent = n === 3 ? '작성 완료!' : '다음!'; $('fPrev').textContent = n === 1 ? '취소' : '이전';
  $('fPhotoState').textContent = photo ? '✅ 사진이 들어갔어요' : '사진은 없어도 돼요'; $('fPhoto').textContent = photo ? '📷 사진 바꾸기' : '📷 사진도 넣기';
  if (n === 1) setTimeout(() => $('fName').focus(), 50);
}
function openForm(ranked) { A(); saveNick(); formRanked = ranked; $('fName').value = tgt.name; $('fWhy').value = tgt.why; show('start', false); show('result', false); show('form', true); formStep(1); }
$('fNext').onclick = () => {
  if (fStep === 1) { tgt.name = clean($('fName').value, 10); if (!tgt.name) { $('fBub').innerHTML = '이름이 없으면<br>누굴 털어? 🤨'; return; } $('fBub').innerHTML = '빠직…'; return setTimeout(() => formStep(2), 350); }
  if (fStep === 2) { tgt.why = clean($('fWhy').value, 40); return formStep(3); }
  store.set('tgt', tgt); show('form', false); $('fBub').innerHTML = '좋아, 맡겨만 줘!'; startGame(formRanked);
};
$('fPrev').onclick = () => { if (fStep === 1) { show('form', false); show('start', true); } else formStep(fStep - 1); };
$('fName').addEventListener('keydown', e => { if (e.key === 'Enter') $('fNext').click(); });
$('fPhoto').onclick = openPhoto;
$('goRank').onclick = () => openForm(true);
$('goFree').onclick = () => openForm(false);
$('rNew').onclick = () => openForm(true);
$('goBoard').onclick = openBoard;
$('rAgain').onclick = () => startGame(true);
$('rBoard').onclick = openBoard;
$('rHome').onclick = goHome;
$('bHome').onclick = () => { if (mode === 'rank' && !confirmLeave()) return; goHome(); };
function confirmLeave() { return true; }
$('bRank').onclick = openBoard;
$('bPhoto').onclick = openPhoto;
$('bSound').textContent = soundOn ? '🔊' : '🔇';
$('bSound').onclick = () => { soundOn = !soundOn; store.set('sound', soundOn); $('bSound').textContent = soundOn ? '🔊' : '🔇'; A(); };
nickEl.addEventListener('keydown', e => { if (e.key === 'Enter') { nickEl.blur(); } });
if (challenge) { const b = $('vsBan'); b.innerHTML = `🔥 <b>${challenge.nick.replace(/[&<>]/g, '')}</b>님이 도전장을 보냈어요!<br>30초 랭킹전에서 <b>${challenge.score.toLocaleString('ko-KR')}점</b>을 넘어 보세요.`; b.classList.remove('hide'); }
hud();
api('/api/smash/rank').then(b => { boardCache = b; }).catch(() => { online = false; });

// =====================================================================
// 매 프레임
// =====================================================================
const clock = new THREE.Clock(); let lastReal = performance.now();
const tmpV = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.033); timeNow += dt;
  const nowR = performance.now(), realDt = Math.min(0.25, (nowR - lastReal) / 1000); lastReal = nowR;
  // 타이머
  if (mode === 'rank') {
    const prev = Math.ceil(game.time); game.time = Math.max(0, game.time - realDt); const cur = Math.ceil(game.time);
    if (cur !== prev && cur <= 5 && cur > 0) SND.beep(false);
    if (game.time <= 0) endRound();
    hud();
  }
  if (mode === 'rank' && performance.now() - game.lastHit > 3500 && speech <= 0 && Math.random() < dt * 0.6) say(pick(LINES_TAUNT));
  // 스프링
  spring('rx', 0, 90, 9, dt); spring('rz', 0, 90, 9, dt); spring('ry', 0, 80, 8, dt);
  spring('x', 0, 120, 11, dt); spring('y', 0, 140, 11, dt); spring('z', 0, 120, 11, dt);
  spring('sq', 1, 260, 12, dt); spring('lean', 0, 60, 7, dt); spring('leanX', 0, 50, 6, dt);
  const baseOpen = ch.teeth.some(t => t.visible) ? 0.32 : 0.75; spring('open', baseOpen, 90, 9, dt);
  S.rx = clamp(S.rx, -1.1, 0.8); S.ry = clamp(S.ry, -1.3, 1.3); S.rz = clamp(S.rz, -0.9, 0.9); S.leanX = clamp(S.leanX, -0.6, 0.6);
  bowA += ((bow ? 1 : 0) - bowA) * Math.min(1, dt * 5);
  const breathe = Math.sin(timeNow * 2.2) * 0.012;
  ch.neck.rotation.set(S.rx * 0.5 + Math.sin(timeNow * 1.3) * 0.02 + bowA * 0.45, S.ry * 0.6, S.rz * 0.6 + (dizzy > 0 ? Math.sin(timeNow * 6) * 0.12 : 0));
  ch.headG.rotation.set(S.rx * 0.5, S.ry * 0.4, S.rz * 0.4);
  ch.headG.position.set(S.x * 0.12, 0.36 + S.y * 0.06 + breathe, S.z * 0.1);
  ch.headG.scale.set(1 + (1 - S.sq) * 0.5, S.sq, 1 + (1 - S.sq) * 0.5);
  ch.body.rotation.set(S.lean * 0.12 - koA * 1.35, 0, S.leanX * 0.5 + S.rz * 0.08);
  ch.headG.scale.x *= 1 + (ch.swell || 0) * 0.06;
  ch.body.position.y = breathe * 0.5;
  for (const a of ch.arms) { const tz = a.rz * (1 - bowA) + a.s * 0.1 * bowA, tx = -1.0 * bowA; a.vz += (-(a.pv.rotation.z - tz) * 60 - a.vz * 5) * dt; a.pv.rotation.z += a.vz * dt; a.vx += (-(a.pv.rotation.x - tx) * 60 - a.vx * 5) * dt; a.pv.rotation.x += a.vx * dt; if (mode === 'menu' || mode === 'free') a.pv.rotation.z += Math.sin(timeNow * 2 + a.s) * 0.002; }
  // 필살기: 하늘에서 대형 뿅망치
  if (ult) {
    ult.t += dt; const m = toolModels.ult, p = ult.at; const k = Math.min(1, ult.t / 0.45);
    m.scale.setScalar(4.2); m.position.set(p.x, p.y + 0.62 * 4.2 * 0 + (1 - k * k) * 4 + 0.36, p.z); m.rotation.set(0, 0, 0);
    if (!ult.hit && k >= 1) { ult.hit = true; ultImpact(); }
    if (ult.t > 0.9) { m.visible = false; ult = null; }
  }
  if (ko > 0) { ko -= dt; }
  koA += ((ko > 0.3 ? 1 : 0) - koA) * Math.min(1, dt * (ko > 0.3 ? 9 : 4));
  zapT -= dt; goldT -= dt;
  ch.head.material.emissive && (ch.head.material.emissive.setHex(zapT > 0 && Math.sin(timeNow * 60) > 0 ? 0x3a6aff : goldT > 0 ? 0x4a3a00 : 0x000000));
  for (const b of toolsEl.children) { const k = b.dataset.k, cd = TOOLS[k].cd, el = performance.now() - (toolCd[k] || 0); const bar = b.lastElementChild; if (bar) bar.style.transform = `scaleX(${el < cd ? 1 - el / cd : 0})`; }
  // 이빨 다시 나기
  if (refillT > 0) { refillT -= dt; if (refillT <= 0) refill(false); }
  for (const t of ch.teeth) if (t.userData.pop < 1) t.userData.pop = Math.min(1, t.userData.pop + dt * 5);
  placeMouth();
  // 표정
  hurt -= dt; dizzy -= dt; blinkT -= dt; if (blinkT < -0.12) blinkT = rand(2, 4.5);
  const toothless = !ch.teeth.some(t => t.visible);
  let ek = 'normal';
  if (dizzy > 0 || game.combo >= 12 && performance.now() - game.lastHit < 800) ek = 'dizzy'; else if (hurt > 0) ek = 'hurt'; else if (toothless) ek = 'shock'; else if (blinkT < 0) ek = 'blink';
  ch.eyes.forEach((e, i) => { const t = ek === 'hurt' ? (i ? ch.eyeT.hurtR : ch.eyeT.hurtL) : ch.eyeT[ek]; if (e.material.map !== t) { e.material.map = t; e.material.needsUpdate = true; } e.rotation.z = ek === 'dizzy' ? timeNow * 8 * (i ? 1 : -1) : 0; });
  ch.brows.forEach((b, i) => { const s = i ? 1 : -1; const tgt = hurt > 0 || toothless ? -0.45 * s : 0; b.rotation.z += (tgt - b.rotation.z) * Math.min(1, dt * 12); b.position.y = 0.17 + (hurt > 0 ? 0.03 : 0); });
  const cry = toothless || (hurt > 0 && game.combo >= 6);
  ch.tears.forEach((t, i) => { t.visible = cry && !photoOn(); if (t.visible) { const ph = (timeNow * 1.6 + i * 0.5) % 1; t.position.set((i ? 1 : -1) * 0.17, -0.04 - ph * 0.2, 0.38 - ph * 0.04); } });
  ch.stars.visible = dizzy > 0; if (dizzy > 0) ch.stars.children.forEach((s, k) => { const a = timeNow * 5 + k * 2.09; s.position.set(Math.cos(a) * 0.4, Math.sin(a * 2) * 0.03, Math.sin(a) * 0.4); s.rotation.y = timeNow * 6; });
  // 도구 휘두르기
  for (let i = swings.length - 1; i >= 0; i--) {
    const s = swings[i]; s.t += dt; const m = s.m; m.visible = true;
    const k = s.t < 0.07 ? s.t / 0.07 : s.t < 0.12 ? 1 : 1 - (s.t - 0.12) / 0.16;
    m.position.lerpVectors(s.from, s.to, clamp(k, 0, 1) * 0.92 + 0.08 * (s.t < 0.07 ? 0 : 1));
    m.rotation.set(0, 0, 0);
    if (s.st === 'jab') { m.lookAt(s.to.x, s.to.y, s.to.z - 5); }
    else if (s.st === 'side') { m.rotation.set(0, s.side > 0 ? -Math.PI / 2 : Math.PI / 2, (1 - clamp(k, 0, 1)) * -s.side * 0.9); if (s.m === toolModels.pan || s.m === toolModels.gold) m.rotation.x = Math.PI / 2; if (s.m === toolModels.daepa) m.rotation.z = s.side * (1.2 - k * 0.6); }
    else if (s.st === 'top') { m.rotation.x = -(1 - clamp(k, 0, 1)) * 1.3; m.rotation.z = 0; }
    else if (s.st === 'under') { m.rotation.x = 0.3; }
    else { m.rotation.z = s.side * 1.3; m.rotation.y = s.side * -0.4; }
    const sc = s.t < 0.12 ? 1 : Math.max(0.01, 1 - (s.t - 0.12) / 0.16); m.scale.setScalar(sc * 1.4);
    if (s.t > 0.28) { m.visible = false; swings.splice(i, 1); }
  }
  // 날아가는 강냉이
  for (const o of flying) {
    if (o.rest) continue; o.life += dt;
    o.v.y -= 9.8 * dt; o.m.position.addScaledVector(o.v, dt);
    o.m.rotation.x += o.w.x * dt; o.m.rotation.y += o.w.y * dt; o.m.rotation.z += o.w.z * dt;
    const p = o.m.position;
    if (p.x < -4.3 || p.x > 4.3) { p.x = clamp(p.x, -4.3, 4.3); o.v.x *= -0.5; }
    if (p.z < -2.2) { p.z = -2.2; o.v.z *= -0.5; }
    if (p.y < FLOOR_Y) {
      p.y = FLOOR_Y;
      if (Math.abs(o.v.y) > 1.2) { const n = performance.now(); if (n - lastLand > 45) { SND.land(); lastLand = n; } o.v.y *= -0.35; o.v.x *= 0.7; o.v.z *= 0.7; o.w.multiplyScalar(0.5); }
      else { o.v.set(0, 0, 0); o.rest = true; o.m.rotation.x = Math.PI / 2; o.m.rotation.z = rand(0, 6); }
    }
  }
  // 카메라
  shake = Math.max(0, shake - dt * 0.6);
  camera.position.copy(camBase).add(tmpV.set(Math.sin(timeNow * 0.4) * 0.05 + rand(-shake, shake), Math.sin(timeNow * 0.3) * 0.03 + rand(-shake, shake), 0));
  camera.lookAt(camLook);
  // 말풍선 · 콤보
  if (speech > 0) {
    speech -= dt; const hc = new THREE.Vector3(); ch.headG.getWorldPosition(hc); const sp = toScreen(hc.add(tmpV.set(0.28, 0.5, 0)));
    bubble.style.transform = `translate(${clamp(sp.x - 18, 8, innerWidth - bubble.offsetWidth - 8)}px, ${Math.max(110, sp.y - bubble.offsetHeight - 10)}px)`;
    if (speech <= 0) bubble.classList.remove('show');
  }
  { const nt = $('nameTag'); const on = false; nt.classList.toggle('hide', !on); if (on) { const hc = new THREE.Vector3(); ch.headG.getWorldPosition(hc); const sp = toScreen(hc.add(tmpV.set(0, 0.62, 0))); if (nt.dataset.n !== tgt.name) { nt.dataset.n = tgt.name; nt.innerHTML = '<i>타깃</i>' + tgt.name.replace(/[&<>]/g, ''); } nt.style.transform = `translate(${sp.x - nt.offsetWidth / 2}px, ${Math.max(100, sp.y - 30)}px)`; } }
  const cEl = $('combo'), showC = game.combo >= 3 && performance.now() - game.lastHit < 800 && (mode === 'rank' || mode === 'free');
  cEl.classList.toggle('hide', !showC);
  if (showC) { const m = 1 + Math.min(2, Math.floor(game.combo / 10) * 0.5); cEl.innerHTML = `${game.combo} COMBO${m > 1 ? `<small>점수 x${m}</small>` : ''}`; }
  composer.render();
}
frame();
