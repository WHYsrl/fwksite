// Radar: lettura delle fonti RSS, filtri, classificazione AI e coda di approvazione.
const Parser = require("rss-parser");
const store = require("./db");
const ai = require("./ai");

const parser = new Parser({ timeout: 15000, headers: { "user-agent": "FrameworksRadar/1.0 (+https://frame.it)" } });
let running = false;
let lastRun = null;

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
    for (const src of sources) {
      try {
        const feed = await parser.parseURL(src.url);
        store.touchSource(src.id, `ok · ${feed.items.length} voci`);
        for (const it of feed.items.slice(0, 40)) {
          stats.fetched++;
          const url = (it.link || it.guid || "").trim(); if (!url) continue;
          const item = { source_id: src.id, src: src.name, url, title: strip(it.title), summary: strip(it.contentSnippet || it.summary || it.content || "").slice(0, 800), date: it.isoDate ? it.isoDate.slice(0, 10) : (it.pubDate ? new Date(it.pubDate).toISOString().slice(0, 10) : ""), weight: src.weight };
          if (store.signalByUrl(url)) { stats.duplicates++; continue; }
          const f = passesFilters(item, radar);
          if (!f.ok) { stats.filtered++; continue; }
          candidates.push(item);
        }
      } catch (e) { store.touchSource(src.id, "errore: " + e.message.slice(0, 80)); stats.errors.push(`${src.name}: ${e.message}`); }
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
      const status = radar.auto_publish && c.ai && c.ai.relevant && c.ai.score >= 70 ? "published" : "pending";
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
  const hours = Math.max(1, +radar.interval_hours || 6);
  setTimeout(() => runRadar().catch(e => console.error("[radar]", e.message)), 60 * 1000); // primo giro un minuto dopo l'avvio
  setInterval(() => runRadar().catch(e => console.error("[radar]", e.message)), hours * 3600 * 1000);
}

module.exports = { runRadar, schedule, lastRun: () => store.getSetting("radar_last_run", null), passesFilters };
