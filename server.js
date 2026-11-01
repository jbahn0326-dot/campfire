// 모닥불 캠핑장 — 같이 걷고, 불 앞에 앉고, 이야기하는 3D 온라인 캠핑장
// 외부 라이브러리 없이 Node.js 기본 모듈만 사용합니다. (Node 18 이상)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const MAX_CLIENTS = Number(process.env.MAX_CLIENTS || 300);
const MAX_PAYLOAD = 4096;

// ---------------- 정적 파일 ----------------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8'
};
const server = http.createServer((req, res) => {
  let u;
  try { u = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  if (u === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (u === '/config.json') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
    return res.end(JSON.stringify({ donateUrl: /^https:\/\//.test(process.env.DONATE_URL || '') ? process.env.DONATE_URL : '' }));
  }
  if (u === '/') u = '/index.html';
  const file = path.normalize(path.join(PUB, u));
  if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('없는 페이지예요'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': (file.includes(path.sep + 'vendor' + path.sep) || file.endsWith('.png')) ? 'public, max-age=86400' : 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    if (file.endsWith('index.html')) {
      // 카카오톡·인스타 미리보기는 이미지 주소가 전체 URL이어야 해서 접속 주소로 채워 넣어요
      const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').replace(/[^a-zA-Z0-9.:-]/g, '');
      const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0] === 'https' ? 'https' : 'http';
      if (host) data = Buffer.from(data.toString('utf8').replace(/content="\/og\.png"/g, `content="${proto}://${host}/og.png"`));
    }
    res.end(data);
  });
});

// ---------------- 아주 작은 WebSocket 구현 ----------------
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function frame(str) {
  const payload = Buffer.from(str);
  const len = payload.length;
  let head;
  if (len < 126) head = Buffer.from([0x81, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, payload]);
}
function ctrl(op, payload = Buffer.alloc(0)) { return Buffer.concat([Buffer.from([0x80 | op, payload.length]), payload]); }

class Conn {
  constructor(socket) {
    this.socket = socket; this.buf = Buffer.alloc(0); this.alive = true; this.closed = false;
    this.onmessage = () => {}; this.onclose = () => {};
    socket.on('data', d => this._data(d));
    socket.on('close', () => this._end());
    socket.on('error', () => this._end());
    socket.setNoDelay(true);
  }
  send(obj) { if (!this.closed) { try { this.socket.write(frame(JSON.stringify(obj))); } catch { this._end(); } } }
  close(code = 1000) { if (this.closed) return; const b = Buffer.alloc(2); b.writeUInt16BE(code); try { this.socket.write(ctrl(0x8, b)); } catch {} this.socket.end(); this._end(); }
  ping() { try { this.socket.write(ctrl(0x9)); } catch { this._end(); } }
  _end() { if (this.closed) return; this.closed = true; try { this.socket.destroy(); } catch {} this.onclose(); }
  _data(d) {
    this.buf = Buffer.concat([this.buf, d]);
    if (this.buf.length > MAX_PAYLOAD * 4) return this.close(1009);
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; const big = this.buf.readBigUInt64BE(2); if (big > BigInt(MAX_PAYLOAD)) return this.close(1009); len = Number(big); off = 10; }
      if (!masked) return this.close(1002);              // 브라우저 → 서버 메시지는 반드시 마스킹
      if (len > MAX_PAYLOAD) return this.close(1009);
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.slice(off, off + 4);
      const data = Buffer.from(this.buf.slice(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      this.buf = this.buf.slice(off + 4 + len);
      if (op === 0x8) return this.close(1000);
      if (op === 0x9) { try { this.socket.write(ctrl(0xA, data.slice(0, 125))); } catch {} continue; }
      if (op === 0xA) { this.alive = true; continue; }
      if (op === 0x1 && fin) { this.alive = true; this.onmessage(data.toString('utf8')); continue; }
      return this.close(1003);                           // 조각난 메시지·바이너리는 쓰지 않음
    }
  }
}

// ---------------- 캠핑장 상태 ----------------
const clients = new Map();           // id -> {conn, p, tokens, last, lastLog, lastChat}
const WORLD = 50;                    // 맵 크기 (가로세로 -50 ~ 50 m)
const CHAT_RANGE = 14;               // 이 거리 안에 있는 사람만 말풍선을 받아요
const FIRE_POS = { x: 0, z: 0 };

// 불: 장작을 넣으면 커지고, 가만두면 줄어들고, 비·눈이 오면 더 빨리 줄어요
const fire = { v: 0.75, t: Date.now() };
const DECAY = 0.006, MIN_FIRE = 0.22, MAX_FIRE = 1.6, LOG_BOOST = 0.22;
const WEATHER_DECAY = { clear: 1, cloudy: 1, fog: 1.2, snow: 1.8, rain: 3 };
function fireNow() {
  const n = Date.now();
  const k = WEATHER_DECAY[weather.kind] || 1;
  fire.v = Math.max(MIN_FIRE, fire.v - (n - fire.t) / 1000 * DECAY * k); fire.t = n;
  return Math.round(fire.v * 1000) / 1000;
}

// 날씨: 모두에게 같은 날씨가 몇 분마다 바뀌어요
const WEATHERS = [['clear', 38], ['cloudy', 18], ['rain', 16], ['snow', 12], ['fog', 16]];
const weather = { kind: ['clear', 'cloudy', 'rain', 'snow', 'fog'].includes(process.env.START_WEATHER) ? process.env.START_WEATHER : 'clear', until: Date.now() + 6 * 60000 };
function nextWeather() {
  fireNow();
  let total = 0; for (const [, w] of WEATHERS) total += w;
  let r = Math.random() * total, pick = 'clear';
  for (const [k, w] of WEATHERS) { if ((r -= w) < 0) { pick = k; break; } }
  if (pick === weather.kind) pick = 'clear';
  weather.kind = pick;
  weather.until = Date.now() + (5 + Math.random() * 6) * 60000;
  broadcast({ type: 'weather', kind: weather.kind, until: weather.until });
}
setInterval(() => { if (Date.now() >= weather.until) nextWeather(); }, 5000);

function broadcast(obj, exceptId) { const s = frame(JSON.stringify(obj)); for (const [id, c] of clients) if (id !== exceptId && !c.conn.closed) { try { c.conn.socket.write(s); } catch {} } }

// ---------------- 크리스마스 트리 장식 (Supabase에 영구 저장, 없으면 메모리) ----------------
const TREE = { x: -24, z: -22 };
const ORN_KINDS = new Set(['ball', 'star', 'bell', 'cane', 'heart', 'gift']);
const MAX_ORN = 3000;
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
const useDb = /^https:\/\//.test(SB_URL) && !!SB_KEY;
let ornaments = [];        // {id,kind,color,x,y,z,nick,msg}
let memId = 1;
const sbHeaders = () => ({ apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' });
async function loadOrnaments() {
  if (!useDb) { console.log('ℹ️  SUPABASE_URL/SUPABASE_SERVICE_KEY가 없어서 트리 장식은 메모리에만 저장돼요'); return; }
  try {
    const r = await fetch(`${SB_URL}/rest/v1/ornaments?select=id,kind,color,x,y,z,nick,msg&order=id.desc&limit=${MAX_ORN}`, { headers: sbHeaders() });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
    ornaments = (await r.json()).reverse();
    console.log(`🎄 트리 장식 ${ornaments.length}개를 불러왔어요`);
  } catch (e) { console.log('⚠️  트리 장식 불러오기 실패:', e.message); }
}
async function saveOrnament(o) {
  if (!useDb) { o.id = memId++; return o; }
  const r = await fetch(`${SB_URL}/rest/v1/ornaments`, { method: 'POST', headers: { ...sbHeaders(), Prefer: 'return=representation' }, body: JSON.stringify(o) });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  const [row] = await r.json(); return { ...o, id: row.id };
}
loadOrnaments();

const ACTS = new Set(['log', 'nod', 'warm', 'yawn', 'look', 'sleep', 'wish', 'fish', 'wave', 'heart', 'firework', 'cheers', 'eat', 'drink', 'splash', 'relax', 'egg', 'milk']);
const TOOLS = new Set(['stick', 'rod', 'meat', 'cup', 'sparkler', 'towel', 'milk']);
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const U = c => String.fromCharCode(92) + 'u' + c.toString(16).padStart(4, '0');  // 정규식용 \\uXXXX 표기 만들기
const INVISIBLE = new RegExp('[' + [[0x0, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff]].map(([a, b]) => U(a) + '-' + U(b)).join('') + ']', 'g');
function cleanNick(s) {
  if (typeof s !== 'string') return null;
  s = s.replace(INVISIBLE, '').replace(/[<>]/g, '').trim();
  s = Array.from(s).slice(0, 10).join('');
  return s ? filterBad(s) : null;
}

// 아주 기본적인 욕설 거르기 (필요하면 단어를 더 추가하세요)
const BAD = ['씨발', '시발', '씨빨', '시빨', '씨바', '시바', 'ㅅㅂ', 'ㅆㅂ', '병신', '븅신', '빙신', 'ㅂㅅ', 'ㅄ', '개새끼', '개새기', '개색기', '개세끼',
  '새끼', '좆', 'ㅈㄹ', '지랄', '미친놈', '미친년', '미친새', '닥쳐', '꺼져', '니애미', '니미', '느금', '애미', '애비', '썅', '엠창', '창녀', '걸레',
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'nigger', 'nigga'];
const BAD_RE = new RegExp(BAD.map(w => w.split('').map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s._\\-*0-9]*')).join('|'), 'gi');
function filterBad(s) { return s.replace(BAD_RE, m => '♡'.repeat(Math.min(Array.from(m).length, 4))); }
function cleanChat(s) {
  if (typeof s !== 'string') return null;
  s = s.replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim();
  s = Array.from(s).slice(0, 80).join('');
  if (!s) return null;
  s = s.replace(/(https?:\/\/|www\.)\S+/gi, '(링크)');           // 링크 도배 막기
  s = s.replace(/(.)\1{9,}/g, (m, ch) => ch.repeat(6));           // ㅋㅋㅋㅋㅋ... 너무 길면 줄이기
  return filterBad(s);
}
const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v)) ? Math.max(lo, Math.min(hi, v)) : null;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

server.on('upgrade', (req, socket) => {
  const url = (req.url || '').split('?')[0];
  const key = req.headers['sec-websocket-key'];
  if (url !== '/ws' || !key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { socket.destroy(); return; }
  if (clients.size >= MAX_CLIENTS) { socket.end('HTTP/1.1 503 Service Unavailable\r\n\r\n'); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);

  const id = crypto.randomBytes(6).toString('hex');
  const conn = new Conn(socket);
  const me = { conn, p: null, tokens: 30, last: Date.now(), lastLog: 0, lastChat: 0, ip: String(req.headers['x-forwarded-for'] || socket.remoteAddress || '').split(',')[0].trim() };
  clients.set(id, me);

  conn.send({ type: 'welcome', id, now: Date.now(), fire: fireNow(), weather: { kind: weather.kind, until: weather.until }, ornaments,
    peers: [...clients].filter(([cid, c]) => cid !== id && c.p).map(([cid, c]) => ({ id: cid, p: c.p })) });

  conn.onmessage = raw => {
    // 초당 12개, 최대 30개까지 몰아서 허용
    const n = Date.now(); me.tokens = Math.min(30, me.tokens + (n - me.last) / 83); me.last = n;
    if (me.tokens < 1) return; me.tokens -= 1;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;

    if (m.type === 'presence' && m.p && typeof m.p === 'object') {
      const nick = cleanNick(m.p.nick); if (!nick) return;
      const q = m.p;
      const p = {
        nick,
        color: COLOR_RE.test(q.color) ? q.color : '#8a8f98',
        x: num(q.x, -WORLD, WORLD) ?? 0,
        z: num(q.z, -WORLD, WORLD) ?? 5,
        ry: num(q.ry, -10, 10) ?? 0,
        seat: Number.isInteger(q.seat) && q.seat >= 0 && q.seat < 32 ? q.seat : null,
        tent: Number.isInteger(q.tent) && q.tent >= 0 && q.tent < 8 ? q.tent : null,
        tool: TOOLS.has(q.tool) ? q.tool : null,
        roast: num(q.roast, 0, 1.4),
        potato: q.potato === true,
        ani: Number.isInteger(q.ani) && q.ani >= 0 && q.ani < 8 ? q.ani : 0,
        since: me.p ? me.p.since : Date.now()
      };
      if (p.roast !== null) p.roast = Math.round(p.roast * 100) / 100;
      me.p = p;
      broadcast({ type: 'peer', id, p }, id);
    } else if (m.type === 'act' && ACTS.has(m.k) && me.p) {
      if (m.k === 'log') {
        if (n - me.lastLog < 3000 || dist(me.p, FIRE_POS) > 6) return;
        me.lastLog = n;
        fire.v = Math.min(MAX_FIRE, fireNow() + LOG_BOOST);
        broadcast({ type: 'fire', v: Math.round(fire.v * 1000) / 1000 });
      }
      const out = { type: 'act', id, k: m.k };
      if (m.k === 'fish' && Number.isInteger(m.f) && m.f >= 0 && m.f < 20) out.f = m.f;
      if (m.k === 'firework') {
        if (n - (me.lastFw || 0) < 2500) return;          // 불꽃은 2.5초에 한 발
        me.lastFw = n;
        out.c = Number.isInteger(m.c) && m.c >= 0 && m.c < 8 ? m.c : 0;
        out.s = Number.isInteger(m.s) && m.s >= 0 && m.s < 4 ? m.s : 0;
        out.x = me.p.x; out.z = me.p.z;
        broadcast(out); return;                           // 하늘은 모두가 같이 봐요 (보낸 사람 포함)
      }
      broadcast(out, id);
    } else if (m.type === 'chat' && me.p) {
      if (n - me.lastChat < 1200) return;               // 도배 막기
      const text = cleanChat(m.text); if (!text) return;
      me.lastChat = n;
      const msg = frame(JSON.stringify({ type: 'chat', id, text }));
      for (const [cid, c] of clients) {
        if (c.conn.closed || !c.p) continue;
        if (cid === id || dist(c.p, me.p) <= CHAT_RANGE) { try { c.conn.socket.write(msg); } catch {} }
      }
    } else if (m.type === 'ornament' && me.p) {
      if (n - (me.lastOrn || 0) < 15000) { conn.send({ type: 'ornamentWait', ms: 15000 - (n - (me.lastOrn || 0)) }); return; }
      const x = num(m.x, -60, 60), y = num(m.y, 0, 11), z = num(m.z, -60, 60);
      if (x === null || y === null || z === null || !ORN_KINDS.has(m.kind)) return;
      if (Math.hypot(x - TREE.x, z - TREE.z) > 4.6 || y < 0.6) return;          // 트리 근처만
      if (dist(me.p, TREE) > 14) return;                                          // 트리 가까이 있는 사람만
      const msg = cleanChat(typeof m.msg === 'string' ? m.msg.slice(0, 60) : '') || '';
      me.lastOrn = n;
      const o = { kind: m.kind, color: Number.isInteger(m.color) && m.color >= 0 && m.color <= 0xffffff ? m.color : 0xd94040,
        x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, z: Math.round(z * 100) / 100, nick: me.p.nick, msg: Array.from(msg).slice(0, 40).join('') };
      saveOrnament(o).then(saved => {
        ornaments.push(saved); if (ornaments.length > MAX_ORN) ornaments.shift();
        broadcast({ type: 'ornament', o: saved });
      }).catch(e => { console.log('⚠️  장식 저장 실패:', e.message); conn.send({ type: 'ornamentFail' }); });
    } else if (m.type === 'reportOrnament' && Number.isInteger(m.oid)) {
      const o = ornaments.find(x => x.id === m.oid);
      if (o) console.log(`[장식 신고] ${new Date().toISOString()} 신고자=${me.p ? me.p.nick : '?'} 장식id=${o.id} 작성자=${o.nick} 메시지=${JSON.stringify(o.msg)}`);
    } else if (m.type === 'report' && typeof m.id === 'string' && clients.has(m.id)) {
      const t = clients.get(m.id);
      console.log(`[신고] ${new Date().toISOString()} 신고자=${me.p ? me.p.nick : '?'} 대상=${t.p ? t.p.nick : '?'}(${m.id}) ip=${t.ip}`);
    }
    // 'ping' 등 나머지는 연결 유지용이라 무시
  };
  conn.onclose = () => {
    if (!clients.has(id)) return;
    const was = clients.get(id).p; clients.delete(id);
    if (was) broadcast({ type: 'leave', id });
  };
});

// 끊긴 연결 정리 + 불 세기 주기적 동기화
setInterval(() => { for (const [, c] of clients) { if (!c.conn.alive) { c.conn._end(); continue; } c.conn.alive = false; c.conn.ping(); } }, 30000);
setInterval(() => { if (clients.size) broadcast({ type: 'fire', v: fireNow() }); }, 5000);

server.listen(PORT, () => console.log(`🔥 모닥불 캠핑장이 열렸어요: http://localhost:${PORT}`));
