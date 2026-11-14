// 멍멍 전화 (/dogcall) — 강아지한테 전화가 오는 장난 앱의 서버 기능
// 1) /api/dogcall/tts    : 진짜 사람 같은 한국어 AI 목소리(mp3). Microsoft Edge 읽어주기 음성 → 안 되면 구글 번역 음성
// 2) /api/dogcall/ring 등 : 촬영폰(리모컨)으로 받는 폰에 전화 보내기
// 3) /api/dogcall/script : GEMINI_API_KEY(무료) 또는 ANTHROPIC_API_KEY 환경변수가 있으면 강아지 대본을 AI로 써 줌 (없으면 앱이 기본 대본 사용)
// 외부 라이브러리 없이 Node.js 기본 모듈만 사용합니다.
'use strict';
const tls = require('tls');
const https = require('https');
const crypto = require('crypto');
const { secMsGecV2 } = require('./edge-gec');

/* ---------------- Edge 음성 (WebSocket 직접 구현) ---------------- */
const TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM = '143.0.3650.75';
const MAJOR = CHROMIUM.split('.')[0];
const EDGE_HOST = 'speech.platform.bing.com';
const VOICES = {
  sunhi: 'ko-KR, SunHiNeural',              // 선희 (여)
  injoon: 'ko-KR, InJoonNeural',            // 인준 (남)
  hyunsu: 'ko-KR, HyunsuMultilingualNeural' // 현수 (남)
};
let clockSkew = 0; // 서버 시계가 어긋나면 Edge가 거절해서 보정값을 기억해요

// 2026년 10월부터 Microsoft가 v2 토큰만 받아요 (edge-gec.js)
const secMsGec = () => secMsGecV2((Date.now() + clockSkew) / 1000);
const D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = n => String(n).padStart(2, '0');
function xts() {
  const d = new Date();
  return `${D[d.getUTCDay()]} ${M[d.getUTCMonth()]} ${p2(d.getUTCDate())} ${d.getUTCFullYear()} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
}
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

function edgeOnce(text, voice, pitchHz, ratePct) {
  return new Promise((resolve, reject) => {
    const connId = crypto.randomUUID().replace(/-/g, '');
    const reqPath = `/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TOKEN}&ConnectionId=${connId}&Sec-MS-GEC=${secMsGec()}&Sec-MS-GEC-Version=2-${CHROMIUM}`;
    const sock = tls.connect({ host: EDGE_HOST, port: 443, servername: EDGE_HOST });
    let buf = Buffer.alloc(0), upgraded = false, done = false, frag = null, fragOp = 0;
    const audio = [];
    const timer = setTimeout(() => fail(new Error('edge timeout')), 15000);
    function fail(e) { if (done) return; done = true; clearTimeout(timer); sock.destroy(); reject(e); }
    function ok() {
      if (done) return; done = true; clearTimeout(timer);
      try { sock.end(); } catch {}
      const out = Buffer.concat(audio);
      out.length ? resolve(out) : reject(new Error('edge empty'));
    }
    function frame(op, data) {
      const mask = crypto.randomBytes(4), len = data.length;
      let head;
      if (len < 126) head = Buffer.from([0x80 | op, 0x80 | len]);
      else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 0x80 | 126; head.writeUInt16BE(len, 2); }
      else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 0x80 | 127; head.writeBigUInt64BE(BigInt(len), 2); }
      const m = Buffer.from(data);
      for (let i = 0; i < m.length; i++) m[i] ^= mask[i & 3];
      sock.write(Buffer.concat([head, mask, m]));
    }
    const sendText = s => frame(1, Buffer.from(s, 'utf8'));
    function handle(op, p) {
      if (op === 1) { if (p.toString('utf8').includes('Path:turn.end')) ok(); return; }
      if (p.length < 2) return;
      const hl = p.readUInt16BE(0);
      if (p.slice(2, 2 + hl).toString('utf8').includes('Path:audio')) {
        const data = p.slice(2 + hl);
        if (data.length) audio.push(data);
      }
    }
    function parse() {
      while (!done && buf.length >= 2) {
        const b0 = buf[0], b1 = buf[1], fin = b0 & 0x80, op = b0 & 0x0f;
        let len = b1 & 0x7f, off = 2;
        if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
        let mask = null;
        if (b1 & 0x80) { if (buf.length < off + 4) return; mask = buf.slice(off, off + 4); off += 4; }
        if (buf.length < off + len) return;
        let pl = buf.slice(off, off + len); buf = buf.slice(off + len);
        if (mask) { pl = Buffer.from(pl); for (let i = 0; i < pl.length; i++) pl[i] ^= mask[i & 3]; }
        if (op === 0) { frag = Buffer.concat([frag || Buffer.alloc(0), pl]); if (fin) { handle(fragOp, frag); frag = null; } }
        else if (op === 1 || op === 2) { if (fin) handle(op, pl); else { frag = pl; fragOp = op; } }
        else if (op === 8) { return audio.length ? ok() : fail(new Error('edge closed')); }
        else if (op === 9) frame(0xA, pl);
      }
    }
    sock.on('secureConnect', () => {
      sock.write([
        `GET ${reqPath} HTTP/1.1`, `Host: ${EDGE_HOST}`, 'Upgrade: websocket', 'Connection: Upgrade',
        `Sec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}`, 'Sec-WebSocket-Version: 13',
        'Pragma: no-cache', 'Cache-Control: no-cache', 'Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MAJOR}.0.0.0 Safari/537.36 Edg/${MAJOR}.0.0.0`,
        'Accept-Encoding: gzip, deflate, br, zstd', 'Accept-Language: en-US,en;q=0.9',
        `Cookie: muid=${crypto.randomBytes(16).toString('hex').toUpperCase()};`, '', ''
      ].join('\r\n'));
    });
    sock.on('data', d => {
      buf = Buffer.concat([buf, d]);
      if (!upgraded) {
        const i = buf.indexOf('\r\n\r\n');
        if (i < 0) return;
        const head = buf.slice(0, i).toString('latin1'); buf = buf.slice(i + 4);
        if (!/^HTTP\/1\.1 101/.test(head)) {
          const err = new Error('edge handshake: ' + head.split('\r\n')[0]);
          const dm = head.match(/\r\ndate:\s*([^\r\n]+)/i);
          if (dm) err.serverDate = Date.parse(dm[1]);
          err.status = Number(head.split(' ')[1]);
          return fail(err);
        }
        upgraded = true;
        sendText(`X-Timestamp:${xts()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
          '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n');
        const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='Microsoft Server Speech Text to Speech Voice (${voice})'>` +
          `<prosody pitch='${pitchHz >= 0 ? '+' : ''}${pitchHz}Hz' rate='${ratePct >= 0 ? '+' : ''}${ratePct}%' volume='+0%'>${esc(text)}</prosody></voice></speak>`;
        sendText(`X-RequestId:${crypto.randomUUID().replace(/-/g, '')}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${xts()}Z\r\nPath:ssml\r\n\r\n${ssml}`);
      }
      parse();
    });
    sock.on('error', fail);
    sock.on('close', () => { if (!done) (audio.length ? ok() : fail(new Error('edge socket closed'))); });
  });
}
async function edgeTTS(text, voice, pitchHz, ratePct) {
  try { return await edgeOnce(text, voice, pitchHz, ratePct); }
  catch (e) {
    if (e.status === 403 && e.serverDate) { clockSkew = e.serverDate - Date.now(); return edgeOnce(text, voice, pitchHz, ratePct); }
    throw e;
  }
}

/* ---------------- 구글 번역 음성 (예비용) ---------------- */
function getBuf(url) {
  return new Promise((resolve, reject) => {
    const r = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://translate.google.com/' }, timeout: 10000 }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('google ' + res.statusCode)); }
      const out = []; res.on('data', c => out.push(c)); res.on('end', () => resolve(Buffer.concat(out)));
    });
    r.on('timeout', () => r.destroy(new Error('google timeout'))); r.on('error', reject);
  });
}
async function googleTTS(text) {
  const parts = []; let cur = '';
  for (const w of text.split(/(?<=[.!?,\s])/)) { if ((cur + w).length > 180) { if (cur) parts.push(cur); cur = w; } else cur += w; }
  if (cur.trim()) parts.push(cur);
  const bufs = [];
  for (const p of parts) bufs.push(await getBuf(`https://translate.google.com/translate_tts?ie=UTF-8&tl=ko&client=tw-ob&q=${encodeURIComponent(p.trim())}`));
  return Buffer.concat(bufs);
}

/* ---------------- 캐시 ---------------- */
const cache = new Map(); // key -> {buf, engine}
function remember(k, v) { cache.set(k, v); if (cache.size > 400) cache.delete(cache.keys().next().value); }
let busy = 0, lastEdgeError = '', lastScriptError = '';

async function ttsRoute(req, res, q) {
  const text = String(q.get('t') || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const vKey = VOICES[q.get('v')] ? q.get('v') : 'sunhi';
  const pitch = Math.max(-50, Math.min(60, parseInt(q.get('p'), 10) || 0));
  const rate = Math.max(-50, Math.min(50, parseInt(q.get('r'), 10) || 0));
  if (!text) { res.writeHead(400); return res.end(); }
  const key = [vKey, pitch, rate, text].join('|');
  let hit = cache.get(key);
  if (!hit) {
    if (busy > 8) { res.writeHead(503, { 'Retry-After': '2' }); return res.end(); }
    busy++;
    try {
      try { hit = { buf: await edgeTTS(text, VOICES[vKey], pitch, rate), engine: 'edge' }; }
      catch (e) { lastEdgeError = e.message + (e.status ? ' (' + e.status + ')' : ''); console.log('⚠️  Edge 음성 실패 → 구글 음성 사용:', e.message); hit = { buf: await googleTTS(text), engine: 'google' }; }
      remember(key, hit);
    } catch (e) {
      busy--; console.log('⚠️  음성 만들기 실패:', e.message);
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('voice failed');
    }
    busy--;
  }
  res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': hit.buf.length, 'Cache-Control': 'public, max-age=86400', 'X-TTS-Engine': hit.engine });
  res.end(hit.buf);
}

/* ---------------- 리모컨 (촬영폰 → 받는 폰) ---------------- */
const rooms = new Map(); // code -> {ring, phone:{state,name,at}, at}
const STATES = ['setup', 'waiting', 'ringing', 'incall', 'ended', 'declined'];
setInterval(() => { const n = Date.now(); for (const [k, r] of rooms) if (n - r.at > 3600e3) rooms.delete(k); }, 600e3);
function room(code) { let r = rooms.get(code); if (!r) { r = { ring: 0, phone: null, at: Date.now() }; rooms.set(code, r); } r.at = Date.now(); return r; }

/* ---------------- AI 대본 (선택) ---------------- */
function readBody(req, max = 8000) {
  return new Promise((resolve, reject) => {
    let s = ''; req.on('data', c => { s += c; if (s.length > max) { reject(new Error('too big')); req.destroy(); } });
    req.on('end', () => resolve(s)); req.on('error', reject);
  });
}
async function scriptRoute(req, res) {
  const gKey = process.env.GEMINI_API_KEY, key = process.env.ANTHROPIC_API_KEY;
  if (!gKey && !key) { res.writeHead(501); return res.end(); }
  try {
    const b = JSON.parse(await readBody(req));
    const f = k => String(b[k] || '').slice(0, k === 'memories' ? 600 : 80);
    const name = f('name') || '토리', callme = f('callme') || '언니', mood = f('mood') || '감동';
    const prompt = `너는 반려견 "${name}"이(가) 되어, 주인에게 처음으로 전화를 거는 짧은 통화 대본을 쓴다.
이 대본은 TTS로 읽히고, 주인은 대본을 모른 채 전화를 받는다. 듣는 순간 "진짜 우리 애가 하는 말 같다"고 느껴야 한다.
[강아지 정보]
- 이름: ${name}
- 주인을 부르는 호칭: ${callme}
- 성격: ${f('persona') || '(없음)'}
- 좋아하는 것: ${f('likes') || '(없음)'}
- 주인만 아는 습관·에피소드: ${f('memories') || '(없음)'}
- 통화 분위기: ${mood}
[규칙]
- 강아지 1인칭, 반말, 주인을 항상 "${callme}"(이)라고 부른다.
- 첫 줄은 전화 받자마자 하는 인사. 예: "여보세요? ${callme}! 나야, ${name}!"
- 습관·에피소드와 좋아하는 것을 최소 2개 이상 구체적으로 녹인다. 입력에 없는 큰 사건(병, 이별, 사고 등)은 지어내지 않는다.
- 강아지다운 감각(냄새, 발소리, 현관, 엘리베이터 소리, 간식 봉지 소리, 낮잠, 꼬리)을 자연스럽게 쓴다.
- 짧고 단순하게. 한 줄은 25자 이내, 전체 10~13줄.
- 분위기 "${mood}"에 맞게. 감동이면 마지막 2~3줄에서 고마움과 사랑을 담백하게, 신파 과장 금지.
- 마지막 줄은 여운이 남는 짧은 한마디.
- 이모지, 괄호 지문, 효과음 표기 금지.
출력은 JSON 하나만: {"lines": ["첫 줄", "둘째 줄", ...]}`;
    let text = '';
    if (gKey) {
      // 구글 Gemini (무료 등급)
      const model = process.env.DOGCALL_GEMINI_MODEL || 'gemini-flash-latest';
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': gKey, 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 1, responseMimeType: 'application/json' } })
      });
      if (!r.ok) { lastScriptError = 'gemini ' + r.status + ' ' + (await r.text()).slice(0, 200); if (!key) throw new Error(lastScriptError); }
      else { const j = await r.json(); text = ((j.candidates || [])[0]?.content?.parts || []).map(p => p.text || '').join(''); }
    }
    if (!text && key) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: process.env.DOGCALL_MODEL || 'claude-sonnet-5-5', max_tokens: 800, messages: [{ role: 'user', content: prompt }] })
      });
      if (!r.ok) throw new Error('anthropic ' + r.status);
      const j = await r.json();
      text = (j.content || []).map(c => c.text || '').join('');
    }
    const m = text.match(/\{[\s\S]*\}/);
    const lines = m ? JSON.parse(m[0]).lines : null;
    if (!Array.isArray(lines) || !lines.length) throw new Error('empty');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ lines: lines.map(s => String(s).trim()).filter(Boolean).slice(0, 20) }));
  } catch (e) {
    lastScriptError = lastScriptError || e.message; console.log('⚠️  대본 만들기 실패:', e.message);
    res.writeHead(502); res.end();
  }
}

/* ---------------- 라우터 ---------------- */
const json = (res, o) => { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };

// 처리했으면 true
function handle(req, res, u) {
  if (u === '/dogcall') { res.writeHead(301, { Location: '/dogcall/' }); res.end(); return true; }
  if (!u.startsWith('/api/dogcall/')) return false;
  const q = new URLSearchParams((req.url || '').split('?')[1] || '');
  const what = u.slice('/api/dogcall/'.length);
  if (what === 'ping') { json(res, { ok: true, voices: Object.keys(VOICES), script: !!(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY), edgeError: lastEdgeError || undefined, scriptError: lastScriptError || undefined }); return true; }
  if (what === 'tts') { ttsRoute(req, res, q); return true; }
  if (what === 'script' && req.method === 'POST') { scriptRoute(req, res); return true; }
  const code = q.get('c') || '';
  if (!/^\d{4}$/.test(code)) { res.writeHead(400); res.end(); return true; }
  if (what === 'ring' && req.method === 'POST') { room(code).ring = Date.now(); json(res, { ok: true }); return true; }
  if (what === 'state' && req.method === 'POST') {
    const s = q.get('s');
    if (STATES.includes(s)) room(code).phone = { state: s, name: String(q.get('n') || '').slice(0, 20), at: Date.now() };
    json(res, { ok: true }); return true;
  }
  if (what === 'poll') {
    const r = room(code);
    const phone = r.phone && Date.now() - r.phone.at < 45000 ? r.phone : null;
    json(res, { ring: r.ring, phone, now: Date.now() }); return true;
  }
  res.writeHead(404); res.end(); return true;
}

module.exports = { handle, edgeTTS, googleTTS };
