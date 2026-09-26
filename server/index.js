require("dotenv").config();
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const compression = require("compression");
const cookieSession = require("cookie-session");
const store = require("./db");
const ai = require("./ai");
const feeds = require("./feeds");
const weather = require("./weather");
const admin = require("./admin");

store.seedIfEmpty();
store.seedTeamIfEmpty();
// Radar in tempo reale: ricerche Google News per parola chiave (it/en), aggiunte come fonti
const RADAR_QUERIES = [["DOOH", "it"], ["programmatic DOOH", "en"], ["digital signage retail", "en"], ["AI generativa pubblicità", "it"], ["generative AI advertising", "en"], ["brand content", "it"], ["retail media", "en"], ["virtual production", "en"], ["esperienze immersive museo", "it"], ["immersive brand experience", "en"], ["AI video production", "en"], ["adaptive content", "en"]];
store.migrateRadarV2(RADAR_QUERIES.map(([q, lang]) => ({ q, url: feeds.gnewsUrl(q, 7, lang) })));

// Versione degli asset per il cache-busting: cambia a ogni modifica di css/js, così i browser non tengono file vecchi.
const fs = require("fs");
const ASSET_V = (() => { try { const h = crypto.createHash("md5"); ["public/css/site.css", "public/js/site.js", "public/js/organism.js", "public/css/admin.css"].forEach(f => h.update(fs.readFileSync(path.join(__dirname, "..", f)))); return h.digest("hex").slice(0, 10); } catch { return Date.now().toString(36); } })();

const app = express();
app.locals.v = ASSET_V;
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieSession({ name: "fwks", secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"), maxAge: 12 * 3600 * 1000, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" }));
app.use("/public", express.static(path.join(__dirname, "..", "public"), { maxAge: "7d" }));
app.use("/media", express.static(path.join(__dirname, "..", "public", "media"), { maxAge: "30d" }));
app.use("/media", express.static(store.UPLOAD_DIR, { maxAge: "30d" }));

// ---------- sito pubblico ----------
app.get("/", (req, res) => {
  feeds.maybeRefresh(); // se il Radar è vecchio, si aggiorna in background
  const content = store.getContent();
  res.set("Cache-Control", "no-cache");
  res.render("index", { content, preview: false, aiOn: ai.isConfigured() });
});
app.get("/api/content", (req, res) => { feeds.maybeRefresh(); res.json(store.getContent()); });
// Radar: ricerca dal vivo per il visitatore (fonti esterne, non curate)
app.get("/api/radar/search", limit, async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 80); if (q.length < 2) return res.status(400).json({ error: "Scrivi almeno due lettere" });
  try { res.set("Cache-Control", "public, max-age=600"); res.json({ q, items: await feeds.searchLive(q), at: new Date().toISOString() }); } catch (e) { res.status(502).json({ error: "Ricerca non disponibile adesso" }); }
});
app.get("/api/radar/fresh", (req, res) => res.json({ signals: store.freshSignals(), at: (feeds.lastRun() || {}).at || null }));
app.get("/api/context", async (req, res) => {
  const w = await weather.getWeather();
  res.json({ weather: w, server_time: new Date().toISOString(), rome_time: new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }).format(new Date()) });
});

// rate limit semplice per IP (in memoria)
const buckets = new Map();
function limit(req, res, next) {
  const ip = req.ip || "x"; const now = Date.now();
  const b = buckets.get(ip) || { n: 0, t: now };
  if (now - b.t > 60000) { b.n = 0; b.t = now; }
  b.n++; buckets.set(ip, b);
  if (b.n > 20) return res.status(429).json({ error: "Troppe richieste, riprova tra un minuto." });
  next();
}
const aiError = (res, e) => {
  const map = { not_configured: 503, rate_limited: 429, not_found: 404, bad_json: 502, provider_error: 502 };
  res.status(map[e.code] || 500).json({ error: e.message, code: e.code || "error" });
};
app.post("/api/ai/console", limit, async (req, res) => {
  const q = String(req.body.q || "").trim().slice(0, 300);
  if (!q) return res.status(400).json({ error: "Richiesta vuota" });
  if (!ai.config().features.console) return res.status(503).json({ error: "Funzione disattivata", code: "disabled" });
  const history = Array.isArray(req.body.history) ? req.body.history.slice(-3).map(h => ({ q: String(h.q || "").slice(0, 300), a: String(h.a || "").slice(0, 400) })) : [];
  const p = req.body.prefs || {}; // scelte fatte nell'intro: tempo e umore
  const prefs = { time: ["2", "10", "all"].includes(String(p.time)) ? String(p.time) : null, mood: ["calm", "vivid", "nervous"].includes(p.mood) ? p.mood : null };
  try { res.json(await ai.consoleQuery(q, history, prefs)); } catch (e) { aiError(res, e); }
});
app.post("/api/ai/adapt", limit, async (req, res) => {
  const { itemId, sector, goal, channel } = req.body || {};
  if (!ai.config().features.adapt) return res.status(503).json({ error: "Funzione disattivata", code: "disabled" });
  try { res.json(await ai.adapt({ itemId: String(itemId || ""), sector: String(sector || "").slice(0, 80), goal: String(goal || "").slice(0, 120), channel: String(channel || "").slice(0, 80) })); } catch (e) { aiError(res, e); }
});
app.get("/health", (req, res) => res.json({ ok: true, ai: ai.isConfigured(), radar: feeds.lastRun() }));

// ---------- backoffice ----------
app.use("/admin", admin);

app.use((req, res) => res.status(404).render("404"));
app.use((err, req, res, next) => { console.error(err); res.status(500).send("Errore interno: " + (err.message || "")); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Frameworks site → http://localhost:${PORT}  (admin: /admin)`);
  if (!process.env.ADMIN_PASSWORD) console.warn("ATTENZIONE: ADMIN_PASSWORD non impostata, uso la password di default 'frameworks'. Cambiala nel file .env");
  if (!ai.isConfigured()) console.warn("AI non configurata: imposta ANTHROPIC_API_KEY o OPENAI_API_KEY (o inseriscila in /admin/ai)");
  if (process.env.RADAR_SCHEDULE !== "off") feeds.schedule();
});
