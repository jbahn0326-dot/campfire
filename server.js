// 모닥불 — 말없이 같이 불을 보는 온라인 캠핑장
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
  if (u === '/') u = '/index.html';
  const file = path.normalize(path.join(PUB, u));
  if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('없는 페이지예요'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': file.endsWith('.html') ? 'no-cache' : 'public, max-age=86400',
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

// ---------------- 모닥불 상태 ----------------
const clients = new Map();           // id -> {conn, p, tokens, lastLog}
const fire = { v: 0.75, t: Date.now() };
const DECAY = 0.006, MIN_FIRE = 0.22, MAX_FIRE = 1.6, LOG_BOOST = 0.22;
function fireNow() { const n = Date.now(); fire.v = Math.max(MIN_FIRE, fire.v - (n - fire.t) / 1000 * DECAY); fire.t = n; return Math.round(fire.v * 1000) / 1000; }
function broadcast(obj, exceptId) { const s = frame(JSON.stringify(obj)); for (const [id, c] of clients) if (id !== exceptId && !c.conn.closed) { try { c.conn.socket.write(s); } catch {} } }

const ACTS = new Set(['log', 'nod', 'warm', 'yawn', 'look', 'sleep', 'wish']);
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
function cleanNick(s) {
  if (typeof s !== 'string') return null;
  s = s.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff<>]/g, '').trim();
  s = Array.from(s).slice(0, 10).join('');
  return s || null;
}

server.on('upgrade', (req, socket) => {
  const url = (req.url || '').split('?')[0];
  const key = req.headers['sec-websocket-key'];
  if (url !== '/ws' || !key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { socket.destroy(); return; }
  if (clients.size >= MAX_CLIENTS) { socket.end('HTTP/1.1 503 Service Unavailable\r\n\r\n'); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);

  const id = crypto.randomBytes(6).toString('hex');
  const conn = new Conn(socket);
  const me = { conn, p: null, tokens: 30, last: Date.now(), lastLog: 0 };
  clients.set(id, me);

  conn.send({ type: 'welcome', id, now: Date.now(), fire: fireNow(),
    peers: [...clients].filter(([cid, c]) => cid !== id && c.p).map(([cid, c]) => ({ id: cid, p: c.p })) });

  conn.onmessage = raw => {
    // 초당 10개, 최대 30개까지 몰아서 허용
    const n = Date.now(); me.tokens = Math.min(30, me.tokens + (n - me.last) / 100); me.last = n;
    if (me.tokens < 1) return; me.tokens -= 1;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;

    if (m.type === 'presence' && m.p && typeof m.p === 'object') {
      const nick = cleanNick(m.p.nick); if (!nick) return;
      const color = COLOR_RE.test(m.p.color) ? m.p.color : '#8a8f98';
      const roast = typeof m.p.roast === 'number' && isFinite(m.p.roast) ? Math.round(Math.max(0, Math.min(1.4, m.p.roast)) * 100) / 100 : null;
      const since = me.p ? me.p.since : Date.now();
      me.p = { nick, color, roast, since };
      broadcast({ type: 'peer', id, p: me.p }, id);
    } else if (m.type === 'act' && ACTS.has(m.k) && me.p) {
      if (m.k === 'log') {
        if (n - me.lastLog < 3000) return;
        me.lastLog = n;
        fire.v = Math.min(MAX_FIRE, fireNow() + LOG_BOOST);
        broadcast({ type: 'fire', v: Math.round(fire.v * 1000) / 1000 });
      }
      broadcast({ type: 'act', id, k: m.k }, id);
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

server.listen(PORT, () => console.log(`🔥 모닥불이 켜졌어요: http://localhost:${PORT}`));
