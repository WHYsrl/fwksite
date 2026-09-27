// Versione inglese dei contenuti: le traduzioni dei testi che stanno nel database (testi del sito, aree, lavori,
// team, letture del Radar, reel, dati del contesto) vivono nella tabella "translations", una riga per campo.
// Le fa l'AI (a lotti, con l'adattatore di ai.js) per i campi che mancano o il cui testo italiano è cambiato
// (si confronta l'hash del sorgente); dal backoffice (/admin/inglese) si correggono a mano, e le correzioni
// restano finché il testo italiano non cambia. L'interfaccia (etichette, bottoni) invece è tradotta nel codice:
// public/js/i18n.js, condiviso tra server (template EJS) e browser.
const crypto = require("crypto");
const store = require("./db");
const ai = require("./ai");
const ui = require("../public/js/i18n.js");

const LANGS = ["it", "en"];
const db = store.db;
db.exec(`CREATE TABLE IF NOT EXISTS translations (
  lang TEXT NOT NULL, key TEXT NOT NULL, src_hash TEXT NOT NULL, value TEXT NOT NULL, manual INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (lang, key))`);

const hash = (s) => crypto.createHash("sha1").update(String(s)).digest("hex").slice(0, 12);
const isText = (v) => typeof v === "string" && v.trim().length > 0;

// ---------- i campi traducibili, come percorsi dentro il contenuto ----------
// "[]" = ogni elemento; "{id}" = ogni elemento, con chiave stabile dal suo id; "*" = ogni voce di un oggetto.
// Le liste di stringhe (tag, tecnologie, casi d'uso, statement) hanno chiave dal testo: riordinarle non invalida nulla.
const FIELDS = [
  "site.tagline", "site.hero_title", "site.hero_text", "site.hero_cta", "site.hero_concrete", "site.context_text",
  "site.organism_title", "site.organism_text", "site.tech_title", "site.method_intro", "site.contact_title", "site.contact_address",
  "site.footer_note", "site.radar_title", "site.radar_text", "site.team_title", "site.team_text",
  "site.statements[]", "site.triad[].it", "site.triad[].text", "site.tech[].k", "site.tech[].text", "site.method[].text",
  "caps{id}.short", "caps{id}.body", "caps{id}.tags[]", "caps{id}.tech[]", "caps{id}.uses[]",
  "works{id}.title", "works{id}.short", "works{id}.body", "works{id}.status", "works{id}.label",
  "team{id}.role", "team{id}.unit", "team{id}.bio",
  "signals{id}.summary", "signals{id}.why",
  "reels{id}.title", "reels{id}.theme",
  "figures{id}.cat", "figures{id}.label", "figures{id}.display", "figures{id}.counter", "figures{id}.date", "figures{id}.bars[].display"
];
// Contesto per il traduttore: cosa sono questi campi (aiuta a scegliere tono e lunghezza)
const HINTS = { site: "site copy (headlines, manifesto)", caps: "service area", works: "case history", team: "team member", signals: "Radar: third-party news, our reading", reels: "video reel", figures: "context figures (numbers with source)" };

// Visita il contenuto lungo un percorso e chiama fn(obj, prop, key) per ogni foglia di testo
function walk(content, path, fn) {
  const steps = path.split(".");
  const go = (node, i, key) => {
    if (node == null) return;
    const st = steps[i]; const last = i === steps.length - 1;
    const m = /^([a-z_]+)(\[\]|\{id\})?$/.exec(st); if (!m) return;
    const prop = m[1], mode = m[2];
    if (!mode) { if (last) { if (isText(node[prop])) fn(node, prop, key + "." + prop); } else go(node[prop], i + 1, key + "." + prop); return; }
    const list = node[prop]; if (!Array.isArray(list)) return;
    list.forEach((it, k) => {
      if (last) { if (isText(it)) fn(list, k, `${key}.${prop}.${hash(it)}`); return; } // lista di stringhe: chiave dal testo
      const id = mode === "{id}" && it && it.id ? String(it.id) : String(k);
      go(it, i + 1, `${key}.${prop}.${id}`);
    });
  };
  go(content, 0, "");
}
// Tutte le foglie traducibili di un contenuto: [{ key, text, hint }]
function collect(content) {
  const out = [];
  FIELDS.forEach(path => walk(content, path, (obj, prop, key) => out.push({ key: key.slice(1), text: String(obj[prop]), hint: HINTS[path.split(/[.\[{]/)[0]] || "" })));
  return out;
}

// ---------- lettura ----------
let cache = { at: 0, map: null };
function map(lang) {
  if (cache.map && Date.now() - cache.at < 5000 && cache.lang === lang) return cache.map;
  const m = new Map(); db.prepare("SELECT key, src_hash, value, manual FROM translations WHERE lang=?").all(lang).forEach(r => m.set(r.key, r));
  cache = { at: Date.now(), map: m, lang }; return m;
}
const bust = () => { cache = { at: 0, map: null }; };
// Il contenuto nella lingua chiesta: copia profonda con i campi tradotti dove la traduzione c'è (anche se il sorgente
// è cambiato nel frattempo: meglio una traduzione un po' vecchia che l'italiano; l'aggiornamento arriva in background)
function apply(content, lang) {
  if (!content || lang === "it" || !LANGS.includes(lang)) return content;
  const c = JSON.parse(JSON.stringify(content)); const m = map(lang);
  FIELDS.forEach(path => walk(c, path, (obj, prop, key) => { const r = m.get(key.slice(1)); if (r && r.value) obj[prop] = r.value; }));
  c.lang = lang;
  return c;
}
function status(content, lang = "en") {
  const items = collect(content); const m = map(lang);
  let ok = 0, stale = 0, missing = 0, manual = 0;
  items.forEach(it => { const r = m.get(it.key); if (!r) missing++; else if (r.src_hash !== hash(it.text)) stale++; else { ok++; if (r.manual) manual++; } });
  return { total: items.length, ok, stale, missing, manual };
}
// Le voci da tradurre: mancanti o con sorgente cambiato
function pending(content, lang = "en") {
  const m = map(lang);
  return collect(content).filter(it => { const r = m.get(it.key); return !r || r.src_hash !== hash(it.text); });
}

// ---------- scrittura ----------
const put = db.prepare("INSERT INTO translations(lang,key,src_hash,value,manual,updated_at) VALUES(?,?,?,?,?,datetime('now')) ON CONFLICT(lang,key) DO UPDATE SET src_hash=excluded.src_hash, value=excluded.value, manual=excluded.manual, updated_at=datetime('now')");
function save(lang, key, srcText, value, manual = false) { put.run(lang, key, hash(srcText), String(value), manual ? 1 : 0); bust(); }
function remove(lang, key) { db.prepare("DELETE FROM translations WHERE lang=? AND key=?").run(lang, key); bust(); }
function resetAuto(lang = "en") { const r = db.prepare("DELETE FROM translations WHERE lang=? AND manual=0").run(lang); bust(); return r.changes; }

// ---------- traduzione automatica ----------
const LANG_NAME = { en: "English" };
const SYSTEM = (lang) => `You translate the website of Frameworks, the unit of Frame by Frame S.p.A. (Rome) that designs "Adaptive Content Systems": living synthetic communication organisms that adapt to every context. The site sells creative production (CGI, video, immersive/XR experiences, AI production systems, DOOH and retail activations) to brands and agencies.
Translate each Italian text into ${LANG_NAME[lang] || lang} for an international business audience. Rules:
- Tone: lucid, concrete, elegant, short sentences; British/international English, not salesy. Keep the meaning and the length; do not add or drop information.
- Keep HTML tags exactly as they are (<em>…</em>, <b>, <br>), and keep line breaks (\\n).
- Do not translate brand names, product names, client names, people, technologies, formats (16:9, 9:16, LED wall, Reels, DOOH, XR…), "Adaptive Content Systems", "Frameworks", "Frame by Frame", "Radar", "Console", nor the Latin words Firmitas/Utilitas/Venustas.
- Numbers: use English formatting ("6,04 mld" → "6.04 bn", "500 mln" → "500 m", "3,2 quadrilioni" → "3.2 quadrillion"; dates like "ott 2025" → "Oct 2025").
- Radar items are third-party news: "why" texts are our reading of them, keep the first person plural ("we").
- Return ONLY JSON: {"items":[{"k":"<key exactly as given>","t":"<translation>"}]} with every key you received.`;

let running = false, timer = 0;
async function translateBatch(items, lang) {
  const user = items.map(it => `[${it.key}]${it.hint ? ` (${it.hint})` : ""}\n${it.text}`).join("\n\n");
  const out = await ai.complete({ system: SYSTEM(lang), user, json: true, maxTokens: 4000, kind: "i18n" });
  const byKey = new Map(items.map(it => [it.key, it]));
  let n = 0;
  (out.items || []).forEach(r => { const it = byKey.get(String(r.k || "").trim()); if (it && isText(r.t)) { save(lang, it.key, it.text, String(r.t).trim(), false); n++; } });
  return n;
}
// Traduce quello che manca (a lotti di 20). Ritorna { translated, pending, errors }
async function run(lang = "en", { max = 400 } = {}) {
  if (running) return { skipped: true, reason: "già in esecuzione", translated: 0, pending: 0, errors: [] };
  if (!ai.isConfigured()) return { skipped: true, reason: "AI non configurata", translated: 0, pending: 0, errors: [] };
  running = true;
  const res = { translated: 0, pending: 0, errors: [] };
  try {
    const content = require("./concrete").decorate(store.getContent()); content.reels = require("./reels").list(); content.figures = require("./figures").list();
    const todo = pending(content, lang).slice(0, max); res.pending = todo.length;
    for (let i = 0; i < todo.length; i += 20) {
      const batch = todo.slice(i, i + 20);
      try { res.translated += await translateBatch(batch, lang); }
      catch (e) { res.errors.push(e.message || String(e)); if (e.code === "rate_limited" || e.code === "not_configured") break; }
    }
    res.pending -= res.translated;
    store.setSetting("i18n_last_run", { at: new Date().toISOString(), lang, ...res });
    return res;
  } finally { running = false; }
}
// Aggiornamento in background, con un piccolo ritardo (si chiama dopo ogni modifica dal backoffice e dopo ogni giro del Radar)
function refreshSoon(delayMs = 15000) {
  if (!isPublic() && !getSetting().auto_when_private) return; // finché l'inglese non è pubblico, si traduce solo su richiesta (o se l'opzione è attiva)
  clearTimeout(timer); timer = setTimeout(() => run("en").catch(e => console.error("[i18n]", e.message)), delayMs);
}

// ---------- impostazioni ----------
const getSetting = () => store.getSetting("i18n", { en_public: false, auto_when_private: true });
const setSetting = (v) => store.setSetting("i18n", { ...getSetting(), ...v });
const isPublic = () => !!getSetting().en_public;

// ---------- lingua della richiesta ----------
function cookieLang(req) { const m = /(?:^|;\s*)fw_lang=(it|en)\b/.exec(req.headers.cookie || ""); return m ? m[1] : null; }
function browserLang(req) { const al = String(req.headers["accept-language"] || "").toLowerCase().split(",")[0].trim(); if (!al) return "it"; return al.startsWith("it") ? "it" : "en"; }
// Per "/": il cookie (scelta esplicita), altrimenti la lingua del browser; l'inglese solo se è pubblico
function resolve(req) { const c = cookieLang(req); const l = c || browserLang(req); return l === "en" && !isPublic() ? "it" : l; }
function setCookie(res, lang) { res.cookie("fw_lang", lang, { maxAge: 365 * 24 * 3600 * 1000, sameSite: "lax", httpOnly: false, path: "/" }); }

module.exports = { LANGS, FIELDS, collect, apply, status, pending, save, remove, resetAuto, run, refreshSoon, getSetting, setSetting, isPublic, resolve, cookieLang, browserLang, setCookie, hash, ui, lastRun: () => store.getSetting("i18n_last_run", null) };
