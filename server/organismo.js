/* =========================================================
   L'ORGANISMO — un solo organismo per tutto il sito, vivo da quando il sito è on air.
   Nessuno lo accudisce: lo nutre il mondo. Ogni segnale pubblicato dal Radar è un nodo che
   cresce nel settore del sistema a cui appartiene; gli umori dichiarati dai visitatori ne
   fissano il temperamento (i colori); il meteo di Roma ne regola il ritmo; ogni clic o tocco
   è uno stimolo che resta. Lo stato si ricostruisce dagli eventi, quindi la timeline è gratis.
   Secondo schermo: il telefono inquadra il QR ed entra nella stessa "stanza" del desktop via
   SSE (niente dipendenze): tocchi e inclinazione viaggiano in tempo reale tra i due schermi.
   Router montato su /organismo. Prototipo a sé: non tocca il resto del sito.
   ========================================================= */
const express = require("express");
const store = require("./db");
const weather = require("./weather");

const db = store.db;
db.exec(`CREATE TABLE IF NOT EXISTS organismo_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, mood TEXT DEFAULT '',
  a REAL DEFAULT 0, r REAL DEFAULT 0, src TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')));`);

const router = express.Router();
const isoOf = (sq) => { if (!sq) return null; const d = new Date(String(sq).includes("T") ? sq : sq.replace(" ", "T") + "Z"); return isNaN(d) ? null : d.toISOString(); };
const MOODS = ["vivid", "calm", "nervous", "light"];
const ROOM = /^[a-z0-9]{4,12}$/;

// ---------- nascita ----------
function bornAt() {
  const s = store.getSetting("organismo", null);
  if (s && s.born_at) return s.born_at;
  // è nato quando il Radar ha mangiato il primo segnale (cioè quando il sito è andato on air)
  const row = db.prepare("SELECT MIN(created_at) m FROM signals").get();
  const born = (row && isoOf(row.m)) || new Date().toISOString();
  store.setSetting("organismo", { born_at: born });
  return born;
}

// ---------- stato ----------
async function stato() {
  const signals = store.listSignals("published", 400).map(s => ({
    id: s.id, t: isoOf(s.created_at) || (s.date ? s.date + "T12:00:00.000Z" : null), date: s.date || "",
    caps: Array.isArray(s.caps) ? s.caps : [], score: (s.ai && +s.ai.score) || 0, title: s.title, src: s.src, url: s.url
  })).filter(s => s.t);
  const rows = db.prepare("SELECT kind, mood, a, r, src, created_at FROM organismo_events ORDER BY id DESC LIMIT 800").all().reverse();
  const stimoli = [], umori = [];
  for (const e of rows) {
    const t = isoOf(e.created_at); if (!t) continue;
    if (e.kind === "stimolo") stimoli.push({ a: +e.a, r: +e.r, mood: e.mood || "", src: e.src || "", t });
    else if (e.kind === "umore") umori.push({ mood: e.mood, t });
  }
  const counts = db.prepare("SELECT kind, COUNT(*) n FROM organismo_events GROUP BY kind").all().reduce((a, r) => (a[r.kind] = r.n, a), {});
  return {
    born_at: bornAt(), now: new Date().toISOString(), weather: await weather.getWeather(),
    signals, stimoli: stimoli.slice(-300), umori: umori.slice(-400),
    totals: { signals: signals.length, stimoli: counts.stimolo || 0, umori: counts.umore || 0 },
    viewers: clients.size, phones: [...clients].filter(c => c.role === "phone").length
  };
}

// ---------- presenza: SSE ----------
const clients = new Set(); // { id, res, room, role }
let nextId = 1;
const send = (c, event, data) => { try { c.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { } };
const broadcast = (event, data, filter) => { for (const c of clients) if (!filter || filter(c)) send(c, event, data); };
const roomOf = (room) => [...clients].filter(c => c.room === room);
const presenza = (room) => { const rc = roomOf(room); return { viewers: clients.size, desktops: rc.filter(c => c.role === "desktop").length, phones: rc.filter(c => c.role === "phone").length, ar: rc.filter(c => c.role === "phone" && c.ar).length }; };

router.get("/stream", (req, res) => {
  const room = ROOM.test(String(req.query.r || "")) ? String(req.query.r) : ""; const role = req.query.role === "phone" ? "phone" : "desktop"; const ar = req.query.ar === "1";
  res.set({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  const c = { id: "c" + (nextId++).toString(36) + Math.random().toString(36).slice(2, 6), res, room, role, ar };
  clients.add(c);
  send(c, "ciao", { id: c.id, ...presenza(room) });
  if (room) broadcast("presenza", presenza(room), x => x.room === room && x !== c);
  broadcast("spettatori", { viewers: clients.size }, x => x.room !== room);
  const ping = setInterval(() => { try { res.write(": ping\n\n"); } catch { } }, 20000);
  req.on("close", () => {
    clearInterval(ping); clients.delete(c);
    if (room) broadcast("presenza", presenza(room), x => x.room === room);
    broadcast("spettatori", { viewers: clients.size });
  });
});

// ---------- limiti per IP (in memoria) ----------
const buckets = new Map();
function limiter(max, windowMs) {
  return (req, res, next) => {
    const key = (req.ip || "x") + ":" + req.path; const now = Date.now(); const b = buckets.get(key) || { n: 0, t: now };
    if (now - b.t > windowMs) { b.n = 0; b.t = now; } b.n++; buckets.set(key, b);
    if (b.n > max) return res.status(429).json({ error: "Un attimo: troppi stimoli insieme." });
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now - b.t > 120000) buckets.delete(k); }, 60000).unref();

// ---------- stimoli, umori, inclinazione ----------
const num = (v, min, max) => Math.max(min, Math.min(max, +v || 0));
router.post("/api/stimolo", limiter(40, 60000), (req, res) => {
  const b = req.body || {}; const a = num(b.a, -Math.PI, Math.PI), r = num(b.r, 0, 1.4);
  const mood = MOODS.includes(b.mood) ? b.mood : ""; const src = b.role === "phone" ? "phone" : "desktop";
  db.prepare("INSERT INTO organismo_events(kind,mood,a,r,src) VALUES('stimolo',?,?,?,?)").run(mood, a, r, src);
  const ev = { a, r, mood, src, t: new Date().toISOString(), from: String(b.from || "").slice(0, 16), room: ROOM.test(String(b.room || "")) ? b.room : "" };
  broadcast("stimolo", ev); // lo stesso organismo per tutti: ogni schermo aperto lo vede reagire
  res.json({ ok: true, t: ev.t });
});
router.post("/api/umore", limiter(10, 60000), (req, res) => {
  const mood = MOODS.includes((req.body || {}).mood) ? req.body.mood : null; if (!mood) return res.status(400).json({ error: "Umore non valido" });
  db.prepare("INSERT INTO organismo_events(kind,mood) VALUES('umore',?)").run(mood);
  broadcast("umore", { mood, t: new Date().toISOString(), from: String((req.body || {}).from || "").slice(0, 16) });
  res.json({ ok: true });
});
router.post("/api/tilt", limiter(900, 60000), (req, res) => { // effimero: solo alla stanza, mai salvato
  const b = req.body || {}; const room = ROOM.test(String(b.room || "")) ? b.room : "";
  if (!room) return res.status(400).json({ error: "Stanza mancante" });
  broadcast("tilt", { gx: num(b.gx, -1, 1), gy: num(b.gy, -1, 1), from: String(b.from || "").slice(0, 16) }, c => c.room === room && c.role === "desktop");
  res.json({ ok: true });
});
router.post("/api/gesto", limiter(300, 60000), (req, res) => { // tocco/trascinamento effimero (senza stimolo salvato): solo alla stanza
  const b = req.body || {}; const room = ROOM.test(String(b.room || "")) ? b.room : "";
  if (!room) return res.status(400).json({ error: "Stanza mancante" });
  broadcast("gesto", { kind: String(b.kind || "").slice(0, 12), x: num(b.x, -1.5, 1.5), y: num(b.y, -1.5, 1.5), id: String(b.id || "").slice(0, 80), from: String(b.from || "").slice(0, 16) }, c => c.room === room);
  res.json({ ok: true });
});

router.get("/api/stato", async (req, res) => { res.set("Cache-Control", "no-store"); res.json(await stato()); });

// ---------- pagine a sé: schermo intero (proiettore / demo), secondo schermo dal QR, AR ----------
const page = (res, view, data) => { res.set("Cache-Control", "no-cache"); res.render(view, { site: store.getSetting("site", {}), ...data }); };
const roomOf_ = (req) => (ROOM.test(String(req.query.r || "")) ? String(req.query.r) : "");
router.get("/", (req, res) => page(res, "organismo", { phone: false, room: "" }));
router.get("/telefono", (req, res) => page(res, "organismo", { phone: true, room: roomOf_(req) }));
// nella stanza: AR dal telefono (8th Wall world tracking + three.js), stessa stanza del desktop
router.get("/ar", (req, res) => page(res, "organismo-ar", { room: roomOf_(req) }));

module.exports = router;
