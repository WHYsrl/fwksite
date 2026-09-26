// Database SQLite (better-sqlite3): schema, seed e accesso ai contenuti.
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "site.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS caps (
  id TEXT PRIMARY KEY, sort INTEGER DEFAULT 0, name TEXT NOT NULL, accent TEXT DEFAULT '',
  short TEXT DEFAULT '', body TEXT DEFAULT '', tags TEXT DEFAULT '[]', image TEXT DEFAULT '', published INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY, sort INTEGER DEFAULT 0, client TEXT NOT NULL, label TEXT DEFAULT '', title TEXT NOT NULL,
  year TEXT DEFAULT '', caps TEXT DEFAULT '[]', short TEXT DEFAULT '', body TEXT DEFAULT '', image TEXT DEFAULT '',
  video_url TEXT DEFAULT '', status TEXT DEFAULT 'placeholder', published INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY, source_id TEXT DEFAULT '', src TEXT NOT NULL, url TEXT NOT NULL, title TEXT NOT NULL,
  summary TEXT DEFAULT '', date TEXT DEFAULT '', caps TEXT DEFAULT '[]', why TEXT DEFAULT '',
  status TEXT DEFAULT 'pending', ai TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS signals_url ON signals(url);
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, enabled INTEGER DEFAULT 1, weight INTEGER DEFAULT 1,
  last_run TEXT DEFAULT '', last_status TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY, filename TEXT NOT NULL, path TEXT NOT NULL, mime TEXT DEFAULT '', size INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS team (
  id TEXT PRIMARY KEY, sort INTEGER DEFAULT 0, name TEXT NOT NULL, role TEXT DEFAULT '', unit TEXT DEFAULT '',
  bio TEXT DEFAULT '', photo TEXT DEFAULT '', is_key INTEGER DEFAULT 0, published INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS ai_cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS ai_log (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, tokens INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
`);

const J = (v, d) => { try { return v == null || v === "" ? d : JSON.parse(v); } catch { return d; } };
const S = (v) => JSON.stringify(v == null ? null : v);
const slug = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || ("id-" + Date.now().toString(36));

// ---------- settings ----------
const getSetting = (key, def) => { const r = db.prepare("SELECT value FROM settings WHERE key=?").get(key); return r ? J(r.value, def) : def; };
const setSetting = (key, val) => db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, S(val));

// ---------- seed ----------
function seedIfEmpty() {
  if (getSetting("seeded", false)) return;
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "content", "seed.json"), "utf8"));
  const tx = db.transaction(() => {
    setSetting("site", seed.site); setSetting("radar", seed.radar); setSetting("ai", seed.ai);
    seed.caps.forEach(upsertCap); seed.works.forEach(upsertWork); seed.sources.forEach(upsertSource);
    seed.signals.forEach(s => upsertSignal({ ...s, status: s.status || "published" }));
    setSetting("seeded", true);
  });
  tx();
}
// Radar in tempo reale (v2): fonti di ricerca Google News per parola chiave, pubblicazione automatica, intervallo più corto.
// Si applica una volta sola anche ai database già esistenti (flag radar_v2), senza toccare le fonti aggiunte a mano.
function migrateRadarV2(queries) {
  if (getSetting("radar_v2", false)) return;
  const tx = db.transaction(() => {
    const radar = getSetting("radar", {});
    setSetting("radar", { ...radar, auto_publish: true, ai_classify: radar.ai_classify !== false, max_age_days: 14, interval_hours: 3, max_per_run: 40, live_queries: queries.map(q => q.q) });
    queries.forEach(q => upsertSource({ id: "q-" + slug(q.q), name: "Ricerca · " + q.q, url: q.url, enabled: true, weight: 2 }));
    setSetting("radar_v2", true);
  });
  tx();
}
// Il team è arrivato dopo il primo seed: si popola se la tabella è vuota (anche su database già esistenti), e i testi della sezione se mancano.
function seedTeamIfEmpty() {
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "content", "seed.json"), "utf8"));
  const n = db.prepare("SELECT COUNT(*) n FROM team").get().n;
  const tx = db.transaction(() => {
    if (!n && Array.isArray(seed.team)) seed.team.forEach(upsertMember);
    const site = getSetting("site", {});
    if (!site.team_title && seed.site.team_title) setSetting("site", { ...site, team_title: seed.site.team_title, team_text: seed.site.team_text });
  });
  tx();
}

// ---------- caps ----------
const rowCap = (r) => r && ({ ...r, tags: J(r.tags, []), published: !!r.published });
function listCaps(all = false) { return db.prepare(`SELECT * FROM caps ${all ? "" : "WHERE published=1"} ORDER BY sort, name`).all().map(rowCap); }
function getCap(id) { return rowCap(db.prepare("SELECT * FROM caps WHERE id=?").get(id)); }
function upsertCap(c) {
  const id = c.id || slug(c.name);
  db.prepare(`INSERT INTO caps(id,sort,name,accent,short,body,tags,image,published) VALUES(@id,@sort,@name,@accent,@short,@body,@tags,@image,@published)
    ON CONFLICT(id) DO UPDATE SET sort=excluded.sort,name=excluded.name,accent=excluded.accent,short=excluded.short,body=excluded.body,tags=excluded.tags,image=excluded.image,published=excluded.published`)
    .run({ id, sort: +c.sort || 0, name: c.name, accent: c.accent || "", short: c.short || "", body: c.body || "", tags: S(Array.isArray(c.tags) ? c.tags : String(c.tags || "").split(",").map(t => t.trim()).filter(Boolean)), image: c.image || "", published: c.published ? 1 : 0 });
  return id;
}
const deleteCap = (id) => db.prepare("DELETE FROM caps WHERE id=?").run(id);

// ---------- works ----------
const rowWork = (r) => r && ({ ...r, caps: J(r.caps, []), published: !!r.published });
function listWorks(all = false) { return db.prepare(`SELECT * FROM works ${all ? "" : "WHERE published=1"} ORDER BY sort, client`).all().map(rowWork); }
function getWork(id) { return rowWork(db.prepare("SELECT * FROM works WHERE id=?").get(id)); }
function upsertWork(w) {
  const id = w.id || slug(w.client + "-" + w.title);
  db.prepare(`INSERT INTO works(id,sort,client,label,title,year,caps,short,body,image,video_url,status,published)
    VALUES(@id,@sort,@client,@label,@title,@year,@caps,@short,@body,@image,@video_url,@status,@published)
    ON CONFLICT(id) DO UPDATE SET sort=excluded.sort,client=excluded.client,label=excluded.label,title=excluded.title,year=excluded.year,caps=excluded.caps,short=excluded.short,body=excluded.body,image=excluded.image,video_url=excluded.video_url,status=excluded.status,published=excluded.published`)
    .run({ id, sort: +w.sort || 0, client: w.client, label: w.label || "", title: w.title, year: w.year || "", caps: S(Array.isArray(w.caps) ? w.caps : [].concat(w.caps || [])), short: w.short || "", body: w.body || "", image: w.image || "", video_url: w.video_url || "", status: w.status || "placeholder", published: w.published ? 1 : 0 });
  return id;
}
const deleteWork = (id) => db.prepare("DELETE FROM works WHERE id=?").run(id);

// ---------- team ----------
const rowMember = (r) => r && ({ ...r, is_key: !!r.is_key, published: !!r.published });
function listTeam(all = false) { return db.prepare(`SELECT * FROM team ${all ? "" : "WHERE published=1"} ORDER BY sort, name`).all().map(rowMember); }
function getMember(id) { return rowMember(db.prepare("SELECT * FROM team WHERE id=?").get(id)); }
function upsertMember(m) {
  const id = m.id || slug(m.name);
  db.prepare(`INSERT INTO team(id,sort,name,role,unit,bio,photo,is_key,published) VALUES(@id,@sort,@name,@role,@unit,@bio,@photo,@is_key,@published)
    ON CONFLICT(id) DO UPDATE SET sort=excluded.sort,name=excluded.name,role=excluded.role,unit=excluded.unit,bio=excluded.bio,photo=excluded.photo,is_key=excluded.is_key,published=excluded.published`)
    .run({ id, sort: +m.sort || 0, name: m.name, role: m.role || "", unit: m.unit || "", bio: m.bio || "", photo: m.photo || "", is_key: m.is_key ? 1 : 0, published: m.published ? 1 : 0 });
  return id;
}
const deleteMember = (id) => db.prepare("DELETE FROM team WHERE id=?").run(id);

// ---------- signals ----------
const rowSignal = (r) => r && ({ ...r, caps: J(r.caps, []), ai: J(r.ai, null) });
function listSignals(status = "published", limit = 200) {
  const sql = status === "all" ? "SELECT * FROM signals ORDER BY date DESC, created_at DESC LIMIT ?" : "SELECT * FROM signals WHERE status=? ORDER BY date DESC, created_at DESC LIMIT ?";
  return (status === "all" ? db.prepare(sql).all(limit) : db.prepare(sql).all(status, limit)).map(rowSignal);
}
function getSignal(id) { return rowSignal(db.prepare("SELECT * FROM signals WHERE id=?").get(id)); }
function signalByUrl(url) { return rowSignal(db.prepare("SELECT * FROM signals WHERE url=?").get(url)); }
function upsertSignal(s) {
  const id = s.id || ("sig-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
  db.prepare(`INSERT INTO signals(id,source_id,src,url,title,summary,date,caps,why,status,ai)
    VALUES(@id,@source_id,@src,@url,@title,@summary,@date,@caps,@why,@status,@ai)
    ON CONFLICT(id) DO UPDATE SET source_id=excluded.source_id,src=excluded.src,url=excluded.url,title=excluded.title,summary=excluded.summary,date=excluded.date,caps=excluded.caps,why=excluded.why,status=excluded.status,ai=excluded.ai`)
    .run({ id, source_id: s.source_id || "", src: s.src, url: s.url, title: s.title, summary: s.summary || "", date: s.date || "", caps: S(Array.isArray(s.caps) ? s.caps : [].concat(s.caps || [])), why: s.why || "", status: s.status || "pending", ai: s.ai ? S(s.ai) : "" });
  return id;
}
const setSignalStatus = (id, status) => db.prepare("UPDATE signals SET status=? WHERE id=?").run(status, id);
const deleteSignal = (id) => db.prepare("DELETE FROM signals WHERE id=?").run(id);
const countSignals = () => db.prepare("SELECT status, COUNT(*) n FROM signals GROUP BY status").all().reduce((a, r) => (a[r.status] = r.n, a), {});

// ---------- sources ----------
function listSources() { return db.prepare("SELECT * FROM sources ORDER BY weight DESC, name").all().map(r => ({ ...r, enabled: !!r.enabled })); }
function getSource(id) { return db.prepare("SELECT * FROM sources WHERE id=?").get(id); }
function upsertSource(s) {
  const id = s.id || ("src-" + slug(s.name));
  db.prepare(`INSERT INTO sources(id,name,url,enabled,weight) VALUES(@id,@name,@url,@enabled,@weight)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,url=excluded.url,enabled=excluded.enabled,weight=excluded.weight`)
    .run({ id, name: s.name, url: s.url, enabled: s.enabled ? 1 : 0, weight: +s.weight || 1 });
  return id;
}
const deleteSource = (id) => db.prepare("DELETE FROM sources WHERE id=?").run(id);
const touchSource = (id, status) => db.prepare("UPDATE sources SET last_run=datetime('now'), last_status=? WHERE id=?").run(status, id);

// ---------- media ----------
function listMedia() { return db.prepare("SELECT * FROM media ORDER BY created_at DESC").all(); }
function addMedia(m) { db.prepare("INSERT INTO media(id,filename,path,mime,size) VALUES(?,?,?,?,?)").run(m.id, m.filename, m.path, m.mime, m.size); }
const deleteMedia = (id) => db.prepare("DELETE FROM media WHERE id=?").run(id);
const getMedia = (id) => db.prepare("SELECT * FROM media WHERE id=?").get(id);

// ---------- ai cache / log ----------
function cacheGet(key, maxAgeMinutes = 60 * 24) { const r = db.prepare("SELECT value, created_at FROM ai_cache WHERE key=?").get(key); if (!r) return null; if ((Date.now() - Date.parse(r.created_at + "Z")) > maxAgeMinutes * 60000) return null; return J(r.value, null); }
function cacheSet(key, val) { db.prepare("INSERT INTO ai_cache(key,value,created_at) VALUES(?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, created_at=datetime('now')").run(key, S(val)); }
function logAi(kind, tokens = 0) { db.prepare("INSERT INTO ai_log(kind,tokens) VALUES(?,?)").run(kind, tokens); }
function aiCallsToday() { return db.prepare("SELECT COUNT(*) n FROM ai_log WHERE created_at > datetime('now','-1 day')").get().n; }
function aiStats() { return db.prepare("SELECT kind, COUNT(*) n, SUM(tokens) tokens FROM ai_log WHERE created_at > datetime('now','-30 day') GROUP BY kind").all(); }

// ---------- contenuto pubblico ----------
// Solo notizie recenti (max_age_days, di default 14); se sono meno di 5, si tengono comunque le ultime 5
function freshSignals() {
  const radar = getSetting("radar", {}); const days = Math.max(1, +radar.max_age_days || 14);
  const all = listSignals("published", 80); const limit = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const fresh = all.filter(s => s.date && s.date >= limit);
  return (fresh.length >= 5 ? fresh : all.slice(0, 5)).slice(0, 40);
}
function getContent() {
  return {
    site: getSetting("site", {}),
    caps: listCaps(),
    works: listWorks(),
    signals: freshSignals(),
    radar_at: (getSetting("radar_last_run", null) || {}).at || null,
    team: listTeam(),
    features: (() => { const ai = getSetting("ai", {}); return { console: !!ai.console_enabled, adapt: !!ai.adapt_enabled }; })()
  };
}

// ---------- export / import ----------
function exportAll() {
  return { exported_at: new Date().toISOString(), site: getSetting("site", {}), radar: getSetting("radar", {}), ai: { ...getSetting("ai", {}), anthropic_key: undefined, openai_key: undefined },
    caps: listCaps(true), works: listWorks(true), signals: listSignals("all", 5000), sources: listSources(), team: listTeam(true) };
}
function importAll(data) {
  const tx = db.transaction(() => {
    if (data.site) setSetting("site", data.site);
    if (data.radar) setSetting("radar", data.radar);
    (data.caps || []).forEach(upsertCap); (data.works || []).forEach(upsertWork); (data.sources || []).forEach(upsertSource); (data.signals || []).forEach(upsertSignal); (data.team || []).forEach(upsertMember);
  });
  tx();
}

module.exports = { db, DATA_DIR, UPLOAD_DIR, slug, getSetting, setSetting, seedIfEmpty, seedTeamIfEmpty, migrateRadarV2, freshSignals,
  listTeam, getMember, upsertMember, deleteMember,
  listCaps, getCap, upsertCap, deleteCap, listWorks, getWork, upsertWork, deleteWork,
  listSignals, getSignal, signalByUrl, upsertSignal, setSignalStatus, deleteSignal, countSignals,
  listSources, getSource, upsertSource, deleteSource, touchSource, listMedia, addMedia, deleteMedia, getMedia,
  cacheGet, cacheSet, logAi, aiCallsToday, aiStats, getContent, exportAll, importAll };
