// Radar: lettura delle fonti RSS, filtri, classificazione AI e coda di approvazione.
const Parser = require("rss-parser");
const store = require("./db");
const ai = require("./ai");

const parser = new Parser({ timeout: 10000, headers: { "user-agent": "FrameworksRadar/1.0 (+https://frame.it)" }, customFields: { item: ["source"] } });
let running = false;
let lastRun = null;

// Fonti "di ricerca": feed RSS di Google News costruiti da una parola chiave (aggiornati in tempo reale, ultimi giorni)
const isQuerySource = (url) => /news\.google\.com\/rss\/search/.test(String(url || ""));
function gnewsUrl(q, days = 7, lang = "it") { const loc = lang === "en" ? "hl=en-US&gl=US&ceid=US:en" : "hl=it&gl=IT&ceid=IT:it"; return `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:" + days + "d")}&${loc}`; }
// Google News mette l'editore nel campo <source> e in coda al titolo (" - Editore")
function normalizeItem(it, src) {
  let title = strip(it.title); let publisher = "";
  if (it.source) publisher = typeof it.source === "string" ? it.source : (it.source._ || it.source.$?.url || "");
  if (publisher && title.endsWith(" - " + publisher)) title = title.slice(0, -(publisher.length + 3)).trim();
  else if (isQuerySource(src.url)) { const m = title.match(/^(.*)\s-\s([^-]{2,40})$/); if (m) { title = m[1].trim(); publisher = publisher || m[2].trim(); } }
  return { title, publisher: publisher || src.name };
}

const norm = (s) => String(s || "").toLowerCase();
function passesFilters(item, radar) {
  const hay = norm(item.title + " " + item.summary);
  const inc = (radar.include || []).map(norm).filter(Boolean);
  const exc = (radar.exclude || []).map(norm).filter(Boolean);
  if (exc.some(k => hay.includes(k))) return { ok: false, reason: "escluso" };
  if (inc.length && !inc.some(k => hay.includes(k))) return { ok: false, reason: "nessuna parola chiave" };
  if (radar.max_age_days && item.date) {
    const age = (Date.now() - Date.parse(item.date)) / 86400000;
    if (age > radar.max_age_days) return { ok: false, reason: "troppo vecchio" };
  }
  return { ok: true };
}
const strip = (html) => String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

async function runRadar({ force = false } = {}) {
  if (running) return { skipped: true, reason: "già in esecuzione" };
  running = true;
  const radar = store.getSetting("radar", {});
  const stats = { fetched: 0, candidates: 0, added: 0, filtered: 0, duplicates: 0, classified: 0, errors: [] };
  try {
    const sources = store.listSources().filter(s => s.enabled);
    let candidates = [];
    // le fonti si leggono in parallelo (a gruppi di 6): un feed lento non blocca gli altri
    const results = [];
    for (let i = 0; i < sources.length; i += 6) results.push(...await Promise.allSettled(sources.slice(i, i + 6).map(src => parser.parseURL(src.url).then(feed => ({ src, feed })))));
    for (const r of results) {
      if (r.status !== "fulfilled") { const src = sources[results.indexOf(r)]; const msg = (r.reason && r.reason.message) || "errore"; if (src) store.touchSource(src.id, "errore: " + msg.slice(0, 80)); stats.errors.push(`${src ? src.name : "?"}: ${msg}`); continue; }
      const { src, feed } = r.value;
      store.touchSource(src.id, `ok · ${feed.items.length} voci`);
      for (const it of feed.items.slice(0, 40)) {
        stats.fetched++;
        const url = (it.link || it.guid || "").trim(); if (!url) continue;
        const n = normalizeItem(it, src); const fromQuery = isQuerySource(src.url);
        const item = { source_id: src.id, src: fromQuery ? n.publisher : src.name, url, title: n.title, summary: strip(it.contentSnippet || it.summary || it.content || "").slice(0, 800), date: it.isoDate ? it.isoDate.slice(0, 10) : (it.pubDate ? new Date(it.pubDate).toISOString().slice(0, 10) : ""), weight: src.weight, fromQuery };
        if (fromQuery && item.summary.toLowerCase().startsWith(item.title.toLowerCase().slice(0, 40))) item.summary = ""; // Google ripete il titolo nel riassunto
        if (store.signalByUrl(url)) { stats.duplicates++; continue; }
        const f = passesFilters(item, radar);
        if (!f.ok) { stats.filtered++; continue; }
        candidates.push(item);
      }
    }
    candidates.sort((a, b) => (b.weight - a.weight) || (b.date > a.date ? 1 : -1));
    candidates = candidates.slice(0, +radar.max_per_run || 30);
    stats.candidates = candidates.length;

    // Classificazione AI (facoltativa): batch da 10
    const useAi = radar.ai_classify && ai.isConfigured() && ai.config().features.radar;
    const caps = store.listCaps();
    if (useAi && candidates.length) {
      for (let i = 0; i < candidates.length; i += 10) {
        const batch = candidates.slice(i, i + 10);
        try {
          const res = await ai.classifySignals(batch, caps);
          res.forEach(r => { const c = batch[r.i]; if (!c) return; c.ai = { relevant: !!r.relevant, score: +r.score || 0, caps: (r.caps || []).filter(id => caps.some(x => x.id === id)), summary_it: r.summary_it || "", why: r.why || "" }; });
          stats.classified += batch.length;
        } catch (e) { stats.errors.push("AI: " + e.message); }
      }
    }
    for (const c of candidates) {
      if (c.ai && !c.ai.relevant && c.ai.score < 40) { stats.filtered++; continue; }
      // pubblicazione automatica: con l'AI se la giudica pertinente; senza AI, le notizie delle fonti di ricerca che passano i filtri escono comunque (il Radar resta in tempo reale)
      const status = radar.auto_publish && (c.ai ? (c.ai.relevant && c.ai.score >= 60) : c.fromQuery) ? "published" : "pending";
      store.upsertSignal({ source_id: c.source_id, src: c.src, url: c.url, title: c.title, summary: c.ai?.summary_it || c.summary, date: c.date, caps: c.ai?.caps || [], why: c.ai?.why || "", status, ai: c.ai || null });
      stats.added++;
    }
    lastRun = { at: new Date().toISOString(), stats };
    store.setSetting("radar_last_run", lastRun);
    return lastRun;
  } finally { running = false; }
}

function schedule() {
  const radar = store.getSetting("radar", {});
  const hours = Math.max(1, +radar.interval_hours || 3);
  setTimeout(() => runRadar().catch(e => console.error("[radar]", e.message)), 60 * 1000); // primo giro un minuto dopo l'avvio
  setInterval(() => runRadar().catch(e => console.error("[radar]", e.message)), hours * 3600 * 1000);
}
// Aggiornamento pigro: se l'ultimo giro è più vecchio dell'intervallo, ne parte uno in background alla prima visita (copre riavvii e timer persi)
function maybeRefresh() {
  if (running || process.env.RADAR_SCHEDULE === "off") return false;
  const radar = store.getSetting("radar", {}); const last = store.getSetting("radar_last_run", null);
  const hours = Math.max(1, +radar.interval_hours || 3);
  if (last && Date.now() - Date.parse(last.at) < hours * 3600 * 1000) return false;
  runRadar().catch(e => console.error("[radar]", e.message)); return true;
}

// Ricerca dal vivo per il visitatore: Google News (it + en), ultimi 14 giorni, cache 20 minuti
const liveCache = new Map();
async function searchLive(q, days = 14) {
  q = String(q || "").trim().slice(0, 80); if (!q) return [];
  const key = q.toLowerCase(); const hit = liveCache.get(key); if (hit && Date.now() - hit.at < 20 * 60000) return hit.items;
  const radar = store.getSetting("radar", {}); const exc = (radar.exclude || []).map(norm).filter(Boolean);
  const out = [], seen = new Set();
  for (const lang of ["it", "en"]) {
    try {
      const feed = await parser.parseURL(gnewsUrl(q, days, lang));
      for (const it of feed.items.slice(0, 12)) {
        const n = normalizeItem(it, { url: "news.google.com/rss/search", name: "Google News" });
        const url = (it.link || "").trim(); const k = n.title.toLowerCase().slice(0, 60); if (!url || seen.has(k)) continue;
        if (exc.some(x => (n.title + " " + (it.contentSnippet || "")).toLowerCase().includes(x))) continue;
        seen.add(k);
        out.push({ title: n.title, src: n.publisher, url, date: it.isoDate ? it.isoDate.slice(0, 10) : "", lang });
      }
    } catch (e) { /* una lingua può fallire: si va avanti con l'altra */ }
  }
  out.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  const items = out.slice(0, 12); liveCache.set(key, { at: Date.now(), items });
  if (liveCache.size > 200) liveCache.delete(liveCache.keys().next().value);
  return items;
}

module.exports = { runRadar, schedule, maybeRefresh, searchLive, gnewsUrl, isQuerySource, lastRun: () => store.getSetting("radar_last_run", null), passesFilters };
