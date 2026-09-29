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
// I testi del sito (site.*) vengono dallo schema dei Contenuti (server/site-fields.js): si traducono solo quelli scritti dal
// backoffice, i testi standard hanno già l'inglese nel dizionario dell'interfaccia. "statements" resta per i contenuti vecchi.
const FIELDS = [
  ...require("./site-fields").I18N_PATHS, "site.statements[]",
  "caps{id}.short", "caps{id}.body", "caps{id}.tags[]", "caps{id}.tech[]", "caps{id}.uses[]",
  "works{id}.title", "works{id}.short", "works{id}.body", "works{id}.status", "works{id}.label", "works{id}.gallery[].caption",
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
- Inside JSON strings escape double quotes (\\") and use \\n for line breaks; prefer curly quotes “ ” in the English text.
- Return ONLY JSON: {"items":[{"k":"<key exactly as given, without brackets>","t":"<translation>"}]} with every key you received, in the same order.`;

let running = false, timer = 0;
// Avanzamento del giro in corso (lo mostra /admin/inglese): lotti fatti/totali, voci tradotte, errori, quando è partito
const progress = { running: false, started_at: null, batches: 0, done: 0, translated: 0, errors: [] };
// Lotti per dimensione, non per numero: i testi lunghi (le schede dei lavori) in pochi per volta, così la risposta
// del modello resta corta e non viene troncata; le voci brevi (tag, tecnologie) in tanti per volta
const BATCH_CHARS = 3000, BATCH_MAX = 12, PARALLEL = 3;
function makeBatches(items) {
  const out = []; let cur = [], chars = 0;
  items.forEach(it => { const n = it.text.length; if (cur.length && (chars + n > BATCH_CHARS || cur.length >= BATCH_MAX)) { out.push(cur); cur = []; chars = 0; } cur.push(it); chars += n; });
  if (cur.length) out.push(cur);
  return out;
}
// La risposta del modello, in tutte le forme in cui può arrivare: {"items":[{k,t}]}, una lista, o un oggetto {chiave: traduzione}
const normKey = (k) => String(k || "").trim().replace(/^\[/, "").replace(/\].*$/, "").trim();
function parseItems(out) {
  if (!out) return [];
  if (Array.isArray(out)) return out;
  if (Array.isArray(out.items)) return out.items;
  if (Array.isArray(out.translations)) return out.translations;
  if (typeof out === "object") return Object.keys(out).filter(k => typeof out[k] === "string").map(k => ({ k, t: out[k] }));
  return [];
}
// JSON rotto o troncato (una virgoletta non protetta, la risposta tagliata): si recuperano le coppie complete
function salvage(raw) {
  const out = []; const re = /"k"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"t"\s*:\s*"((?:[^"\\]|\\.)*)"/g; let m;
  while ((m = re.exec(String(raw || "")))) { let k = m[1], t = m[2]; try { k = JSON.parse('"' + m[1] + '"'); t = JSON.parse('"' + m[2] + '"'); } catch {} out.push({ k, t }); }
  return out;
}
let lastProbe = null; // l'ultima prova fatta da /admin/inglese (risposta grezza del modello, per capire cosa non va)
async function translateBatch(items, lang, { probe = false } = {}) {
  const user = items.map(it => `[${it.key}]${it.hint ? ` (${it.hint})` : ""}\n${it.text}`).join("\n\n");
  let out, raw = "", salvaged = false;
  try { out = await ai.complete({ system: SYSTEM(lang), user, json: true, maxTokens: 8000, kind: "i18n", timeoutMs: 180000 }); }
  catch (e) {
    if (e.code === "bad_json" && e.raw) { raw = e.raw; out = { items: salvage(raw) }; salvaged = true; if (!out.items.length) { e.message = "risposta non in formato JSON (inizio: " + JSON.stringify(String(raw).slice(0, 80)) + ")"; if (probe) lastProbe = { at: new Date().toISOString(), model: ai.config().model, keys: items.map(i => i.key), raw: String(raw).slice(0, 4000), matched: 0, error: e.message }; throw e; } }
    else throw e;
  }
  const byKey = new Map(items.map(it => [it.key, it])); const list = parseItems(out);
  let n = 0;
  list.forEach(r => { const it = byKey.get(normKey(r.k)); if (it && isText(r.t)) { save(lang, it.key, it.text, String(r.t).trim(), false); n++; } });
  // stesso numero di voci ma chiavi diverse (il modello le ha riscritte): si abbinano per posizione
  if (!n && list.length === items.length) list.forEach((r, i) => { if (isText(r.t)) { save(lang, items[i].key, items[i].text, String(r.t).trim(), false); n++; } });
  if (probe) lastProbe = { at: new Date().toISOString(), model: ai.config().model, keys: items.map(i => i.key), raw: raw ? String(raw).slice(0, 4000) : JSON.stringify(out, null, 1).slice(0, 4000), matched: n, salvaged, error: null };
  if (!n) { const e = new Error(list.length ? `risposta senza chiavi riconoscibili (es. ${JSON.stringify(list[0]).slice(0, 100)})` : "risposta vuota"); e.code = "no_match"; throw e; }
  return n;
}
// Prova: traduce le prime tre voci mancanti e tiene la risposta grezza del modello, da leggere in /admin/inglese
async function probe(lang = "en") {
  const content = require("./concrete").decorate(store.getContent()); content.reels = require("./reels").list(); content.figures = require("./figures").list();
  const todo = pending(content, lang).slice(0, 3); if (!todo.length) { lastProbe = { at: new Date().toISOString(), model: ai.config().model, keys: [], raw: "", matched: 0, error: "niente da tradurre" }; return lastProbe; }
  try { await translateBatch(todo, lang, { probe: true }); } catch (e) { if (!lastProbe || lastProbe.error == null) lastProbe = { at: new Date().toISOString(), model: ai.config().model, keys: todo.map(i => i.key), raw: String(e.raw || "").slice(0, 4000), matched: 0, error: e.message }; }
  return lastProbe;
}
// Traduce quello che manca: lotti per dimensione, tre alla volta. Ritorna { translated, pending, errors }
async function run(lang = "en", { max = 600 } = {}) {
  // un giro rimasto appeso (rete, processo) non deve bloccare per sempre: dopo 30 minuti si riparte
  if (running && progress.started_at && Date.now() - Date.parse(progress.started_at) > 30 * 60000) { console.warn("[i18n] giro precedente scaduto, riparto"); running = false; }
  if (running) return { skipped: true, reason: "già in esecuzione", translated: 0, pending: 0, errors: [] };
  if (!ai.isConfigured()) return { skipped: true, reason: "AI non configurata", translated: 0, pending: 0, errors: [] };
  running = true;
  const res = { translated: 0, pending: 0, errors: [] };
  Object.assign(progress, { running: true, started_at: new Date().toISOString(), batches: 0, done: 0, translated: 0, errors: [] });
  try {
    const content = require("./concrete").decorate(store.getContent()); content.reels = require("./reels").list(); content.figures = require("./figures").list();
    const todo = pending(content, lang).slice(0, max); res.pending = todo.length;
    const batches = makeBatches(todo); progress.batches = batches.length;
    if (batches.length) console.log(`[i18n] ${todo.length} voci da tradurre in ${batches.length} lotti (${PARALLEL} alla volta)`);
    let stop = false, next = 0; res.batches = batches.length; res.ok = 0;
    const worker = async () => {
      while (!stop && next < batches.length) {
        const k = next++; const batch = batches[k]; const t0 = Date.now();
        for (let attempt = 1; attempt <= 2; attempt++) {
          try { const n = await translateBatch(batch, lang); res.translated += n; progress.translated += n; res.ok++; console.log(`[i18n] lotto ${k + 1}/${batches.length}: ${n}/${batch.length} voci in ${Math.round((Date.now() - t0) / 1000)} s`); break; }
          catch (e) {
            const limit = /rate|429|overloaded|529|timeout|abort/i.test(String(e.message)) && e.code !== "rate_limited";
            if (limit && attempt === 1) { console.warn(`[i18n] lotto ${k + 1}: ${e.message} — riprovo tra 20 s`); await new Promise(r => setTimeout(r, 20000)); continue; }
            const msg = `lotto ${k + 1}: ${e.message || e}`; res.errors.push(msg); progress.errors.push(msg); console.warn("[i18n]", msg); if (e.code === "rate_limited" || e.code === "not_configured") stop = true; break;
          }
        }
        progress.done++;
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, batches.length) }, worker));
    res.pending -= res.translated;
    store.setSetting("i18n_last_run", { at: new Date().toISOString(), lang, ...res });
    return res;
  } finally { running = false; progress.running = false; }
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

module.exports = { LANGS, FIELDS, collect, apply, status, pending, save, remove, resetAuto, run, probe, lastProbe: () => lastProbe, refreshSoon, getSetting, setSetting, isPublic, resolve, cookieLang, browserLang, setCookie, hash, ui, progress, lastRun: () => store.getSetting("i18n_last_run", null) };
